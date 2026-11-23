import { JOBBKODFORM, JOBBUTFALL, jobbKorningsId, nastaKorning } from "../lib/jobb.js";
import { STANDARD_TIDSZON } from "../lib/format.js";

/**
 * Återkommande jobb på servern: låset, körningen och utfallet (0.256.0, cllp/lifehub.app#888).
 *
 * ══ ⛔ EN DATAKÄLLA, SOM VARJE TJÄNST HÄR, OCH ETT VERSIONSFÄLT SOM GÖR LÅSET TILL EN LIKHET ═══════════════════════════════
 *
 * Händelsen: första versionen (05ec99b) tog en rå Firestore-`db` med `runTransaction`, med skälet att låset behöver "mindre än"
 * (`las.till` före nu) och att kontraktets `updateIf` bara prövar likhet. Granskningen sa nej: varje tjänst under `src/node` tar en
 * datakälla, och det är det som låter samma serverkod gå mot Postgres-adaptern. Ett undantag för en tjänst hade varit ett andra
 * mönster för samma sak (regel 2), och nästa tjänst med ett lås hade haft två att välja mellan.
 *
 * Låset går att uttrycka med kontraktet som det är:
 *
 * - "Mindre än" behövs bara för att HITTA jobben, och där har kontraktet `fore` (strikt mindre än) i `list`. Varvet frågar efter
 *   `nastaKorning < nu + 1`, alltså `<= nu` i hela millisekunder, sorterat på `nastaKorning`.
 * - Själva anspråket är en jämförelse-och-byt på ett heltal. Varje jobb bär `version`. Tjänsten läser jobbet, prövar i JS att det är
 *   förfallet, inte `av` och att låset är fritt eller har löpt ut, och skriver sedan låset med
 *   `updateIf(samling, id, { version: v }, { las, version: v + 1 })`. Två varv som läste samma jobb ser båda `v`, men bara det första
 *   som skriver hittar `v` kvar; det andra får `updated: false` och lämnar jobbet. Prövningen i JS är alltså ett urval, och likheten
 *   på `version` är beslutet.
 * - Avslutet skriver med villkoret `{ version: v + 1 }` och sätter `v + 2`. Har låset löpt ut och tagits av ett annat varv står en
 *   annan version där, och en sen körning skriver ingenting. Körningens id (`las.korning`) står kvar i låset för den som läser
 *   dokumentet och som typens idempotensnyckel, men det är versionen som avgör.
 *
 * ⛔ `updateIf` KRÄVS. En källa utan den kan bara läsa och sedan skriva, och då kan två varv ta samma jobb (kontraktets regel 7).
 * Tjänsten säger nej när den anropas, i stället för att låtsas.
 *
 * ⛔ SAMLINGEN SKICKAS IN. Ramverket känner inga samlingsnamn (arbetsreglerna, "Vad som inte är regler här").
 *
 * ══ ⛔ DOKUMENTETS FORM (design #888) ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `{ id, groupId, typ, lage, schema, nastaKorning, version, agare, senast, las, skapad, andrad, andradAv }`.
 *
 * - **`nastaKorning`, `las.till` och `senast.tid` är millisekunder sedan epok (tal)**, aldrig `Date` eller `Timestamp`. `fore`
 *   jämför samma typ med samma typ i varje adapter (minnet, JSON, Firestore, Postgres), och ett tal är den enda tidsformen alla
 *   fyra jämför likadant. Läs dem med `jobbTidpunkt`.
 * - **`version` är ett heltal, `0` när appen skapar jobbet.** Det tillhör låset: appens `sparaJobb` skriver aldrig `version`,
 *   `las` eller `senast`. Ett jobb utan heltalsversion går inte att låsa, och tjänsten kastar i stället för att hoppa över det tyst.
 * - **Ett jobb med läget `av` ska ha `nastaKorning: null`.** Varvet filtrerar bort `av` i JS (en likhet på `lage` bredvid olikheten
 *   på `nastaKorning` hade krävt ett sammansatt index i Firestore), och ett avslaget jobb med en gammal tid hade tagit en plats av
 *   `max` i varje varv. `null` kommer inte med i `fore` i någon adapter.
 *
 * Tjänsten läser `typ`, `lage`, `schema`, `nastaKorning`, `version` och `las`, och skriver bara `las`, `senast`, `nastaKorning` och
 * `version`. Resten äger appens `sparaJobb`.
 *
 * @typedef {import("../data/contract.js").DataSource<any>} Kalla
 * @typedef {{ utfall?: unknown, paborjat?: unknown, bekraftat?: unknown, kod?: unknown }} Rattutfall Vad en typ svarar, före vitlistningen.
 * @typedef {{ tid: number, utfall: import("../lib/jobb.js").Jobbutfall, paborjat?: number, bekraftat?: number, kod?: string }} Senast `tid` i millisekunder.
 * @typedef {{ id: string, typ?: string, lage?: string, schema?: unknown, nastaKorning?: number | null, version?: number, las?: { till?: number, korning?: string } | null, [k: string]: unknown }} Jobb
 * @typedef {{ kor: (jobb: Jobb, ctx: { lage: "prov" | "skarp", korningId: string }) => Promise<Rattutfall | undefined> | Rattutfall | undefined, tidsgransMs?: number }} Jobbtyp
 * @typedef {{ paborjade: number, bekraftade: number, fel: number, hoppade: number }} Korningsrapport
 * @typedef {(jobbId: string, fel: unknown) => void} OnFel Får varje undantag (ur en typ, låset eller skrivningen). Appen avgör vad som
 *   loggas: ett fel ur banksynken kan bära bankens text, och det ska inte hamna i dokumentet, men det ska inte heller tystas (regel 1).
 */

/**
 * Hur länge ett lås står när typen inte säger något: tio minuter. Längre än en banksynk tar, kortare än schemaläggarens varv gånger
 * två, så att ett jobb vars körning dog tas av ett av de närmaste varven (design #888: "Ett lås som löpt ut får tas av nästa varv").
 */
export const JOBB_TIDSGRANS_MS = 10 * 60 * 1000;

/** @param {string} namn @param {any} kalla @param {unknown} samling @returns {string} */
function kontrollera(namn, kalla, samling) {
  if (!kalla || typeof kalla.read !== "function" || typeof kalla.list !== "function") {
    throw new Error(`${namn}: en datakälla med read och list krävs. Ramverket känner ingen databas; appen skickar in sin.`);
  }
  if (typeof kalla.updateIf !== "function") {
    throw new Error(`${namn}: datakällan saknar updateIf. Låset är en jämförelse-och-byt på jobbets version, och en källa som bara kan läsa och sedan skriva låter två varv ta samma jobb. Med Admin SDK är updateIf en db.runTransaction, se datakontraktets regel 7.`);
  }
  if (typeof samling !== "string" || !samling.trim()) {
    throw new Error(`${namn}: samlingens namn krävs. Ramverket känner inga samlingsnamn; appen skickar in det.`);
  }
  return samling.trim();
}

/** @param {string} namn @param {unknown} nu */
function kravNu(namn, nu) {
  if (!(nu instanceof Date) || !Number.isFinite(nu.getTime())) throw new Error(`${namn}: nu ska vara ett giltigt Date.`);
  return nu;
}

/** @param {string} namn @param {unknown} id */
function kravId(namn, id) {
  const ut = typeof id === "string" ? id.trim() : "";
  if (!ut) throw new Error(`${namn}: jobbets id krävs.`);
  return ut;
}

/** @param {unknown} v */
const arMs = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * Tar låset på ett jobb med en jämförelse-och-byt på `version`.
 *
 * Svarar `null`, och skriver ingenting, när låset är giltigt (`las.till` efter `nu`), när jobbet inte är förfallet
 * (`nastaKorning` saknas eller ligger efter `nu`), när läget är `av` eller okänt, när jobbet inte finns, eller när ett annat varv
 * hann skriva mellan läsningen och skrivningen (versionen stämde inte). Annars står `las = { till, korning }` och `version + 1` i
 * dokumentet, och svaret är körningens id, låsets version och jobbet som det lästes.
 *
 * ⛔ `direkt` ÄR KÖR NU. Då prövas inte om jobbet är förfallet, och körningens planerade tid är `nu` (ett eget id, så att den inte
 * förväxlas med nästa schemalagda körning). Låset och läget prövas ändå: Kör nu får inte köra ett jobb som redan körs, och ett
 * avslaget jobb har inget läge att köra i.
 *
 * @param {{ kalla: Kalla, samling: string, jobbId: string, nu: Date, tidsgransMs?: number, direkt?: boolean }} b
 * @returns {Promise<{ korningId: string, version: number, jobb: Jobb } | null>}
 */
export async function tilldelaJobb(b) {
  const SAMLING = kontrollera("tilldelaJobb", b?.kalla, b?.samling);
  const jobbId = kravId("tilldelaJobb", b.jobbId);
  const nu = kravNu("tilldelaJobb", b.nu).getTime();
  const tidsgrans = b.tidsgransMs ?? JOBB_TIDSGRANS_MS;
  if (typeof tidsgrans !== "number" || !Number.isFinite(tidsgrans) || tidsgrans <= 0) throw new Error("tilldelaJobb: tidsgransMs ska vara ett positivt antal millisekunder.");
  /** @type {Jobb | null} */
  const jobb = await b.kalla.read(SAMLING, jobbId);
  if (!jobb) return null;
  if (jobb.lage !== "prov" && jobb.lage !== "skarp") return null;
  const v = jobb.version;
  if (typeof v !== "number" || !Number.isInteger(v)) {
    throw new Error(`tilldelaJobb: "${SAMLING}/${jobbId}" saknar version (ett heltal, 0 när jobbet skapas). Utan den går låset inte att ta atomärt.`);
  }
  if (jobb.las && arMs(jobb.las.till) && /** @type {number} */ (jobb.las.till) > nu) return null;
  /** @type {number} */
  let planerad;
  if (b.direkt === true) {
    planerad = nu;
  } else {
    if (!arMs(jobb.nastaKorning) || /** @type {number} */ (jobb.nastaKorning) > nu) return null;
    planerad = /** @type {number} */ (jobb.nastaKorning);
  }
  const korningId = jobbKorningsId(jobbId, new Date(planerad));
  const las = { till: nu + tidsgrans, korning: korningId };
  const svar = await /** @type {NonNullable<Kalla["updateIf"]>} */ (b.kalla.updateIf).call(b.kalla, SAMLING, jobbId, { version: v }, { las, version: v + 1 });
  if (!svar?.updated) return null;
  return { korningId, version: v + 1, jobb: { ...jobb, las, version: v + 1, id: jobbId } };
}

/**
 * Vitlistar en typs svar till det som får stå i `senast`.
 *
 * ⛔ BARA ANTAL OCH EN KOD (design #888). Resultatet ska aldrig bära text ur banken, belopp, namn eller nycklar. En typ som råkar
 * svara med hela bankens svar ska inte kunna skriva det i dokumentet, så allt som inte är ett icke-negativt heltal i `paborjat` och
 * `bekraftat`, eller en kod på formen `JOBBKODFORM`, tas bort här och inte i typen. Ett okänt utfall blir `fel` med koden
 * `okant-utfall`: ett svar som inte går att läsa är inte ett lyckat jobb (regel 5).
 *
 * @param {unknown} utfall @param {Date} nu
 * @returns {Senast}
 */
export function vitlistaUtfall(utfall, nu) {
  const u = utfall && typeof utfall === "object" ? /** @type {Record<string, unknown>} */ (utfall) : {};
  const kand = typeof u.utfall === "string" && JOBBUTFALL.includes(/** @type {any} */ (u.utfall));
  /** @type {Senast} */
  const ut = { tid: nu.getTime(), utfall: kand ? /** @type {any} */ (u.utfall) : "fel" };
  for (const k of /** @type {const} */ (["paborjat", "bekraftat"])) {
    const v = u[k];
    if (typeof v === "number" && Number.isInteger(v) && v >= 0) ut[k] = v;
  }
  if (!kand) ut.kod = "okant-utfall";
  else if (typeof u.kod === "string" && JOBBKODFORM.test(u.kod)) ut.kod = u.kod;
  return ut;
}

/**
 * Skriver utfallet och nästa körning, och släpper låset, med villkoret att låsets version står kvar.
 *
 * ⛔ BARA OM VERSIONEN ÄR LÅSETS (`version` ur `tilldelaJobb`). Har låset löpt ut och tagits av ett annat varv, eller släppts, står en
 * annan version i dokumentet, och då är det inte den här körningens jobb längre att skriva: svaret är `null` och ingenting skrivs.
 * Annars hade en körning som dog och kom tillbaka skrivit över utfallet för den som tog vid.
 *
 * ⛔ SCHEMAT LÄSES OM PRECIS FÖRE SKRIVNINGEN, inte ur låsets läsning: appen kan ha bytt tid medan typen körde, och nästa körning ska
 * följa det nya schemat.
 *
 * ⛔ ETT SCHEMA SOM INTE GÅR ATT LÄSA STOPPAR JOBBET SYNLIGT. `nastaKorning` blir `null` och utfallet `fel` med koden
 * `ogiltigt-schema`, i stället för ett undantag som lämnar låset kvar och jobbet förfallet: då hade varje varv tagit det igen, och
 * ingenting i vyn hade sagt varför (regel 5).
 *
 * @param {{ kalla: Kalla, samling: string, jobbId: string, version: number, utfall: Rattutfall, nu: Date, tidszon?: string }} b
 * @returns {Promise<Senast | null>} Det som skrevs i `senast`, eller `null` när ingenting skrevs.
 */
export async function slutforJobb(b) {
  const SAMLING = kontrollera("slutforJobb", b?.kalla, b?.samling);
  const jobbId = kravId("slutforJobb", b.jobbId);
  const nu = kravNu("slutforJobb", b.nu);
  const version = b.version;
  if (typeof version !== "number" || !Number.isInteger(version)) throw new Error("slutforJobb: låsets version krävs, den som tilldelaJobb svarade med. Utan den går det inte att veta att låset är den här körningens.");
  const tidszon = b.tidszon ?? STANDARD_TIDSZON;
  /** @type {Jobb | null} */
  const jobb = await b.kalla.read(SAMLING, jobbId);
  if (!jobb || jobb.version !== version) return null;
  let senast = vitlistaUtfall(b.utfall, nu);
  /** @type {number | null} */
  let nasta;
  try {
    // Ett jobb som slogs av medan det körde får ingen nästa körning (filhuvudet: `av` har `nastaKorning: null`).
    nasta = jobb.lage === "av" ? null : nastaKorning(jobb.schema, nu, tidszon).getTime();
  } catch {
    nasta = null;
    senast = { ...senast, utfall: "fel", kod: "ogiltigt-schema" };
  }
  const svar = await /** @type {NonNullable<Kalla["updateIf"]>} */ (b.kalla.updateIf).call(b.kalla, SAMLING, jobbId, { version }, { senast, nastaKorning: nasta, las: null, version: version + 1 });
  return svar?.updated ? senast : null;
}

/**
 * Kör ett tilldelat jobb med dess typ och skriver utfallet. Gemensam för schemaläggaren och Kör nu.
 * @param {{ kalla: Kalla, samling: string, nu: Date, tidszon?: string, typer: Record<string, Jobbtyp>, onFel?: OnFel }} b
 * @param {{ korningId: string, version: number, jobb: Jobb }} tilldelat
 * @returns {Promise<{ senast: Senast, bekraftad: boolean }>}
 */
async function korTilldelat(b, tilldelat) {
  const { jobb, korningId, version } = tilldelat;
  const typ = typeof jobb.typ === "string" ? b.typer[jobb.typ] : undefined;
  /** @type {Rattutfall} */
  let utfall;
  if (!typ || typeof typ.kor !== "function") {
    utfall = { utfall: "hoppad", kod: "okand-typ" };
  } else {
    try {
      utfall = (await typ.kor(jobb, { lage: /** @type {"prov" | "skarp"} */ (jobb.lage), korningId })) ?? { utfall: "fel", kod: "inget-utfall" };
    } catch (e) {
      // ⛔ FELET BLIR EN KOD I DOKUMENTET OCH INTE MEDDELANDET: ett undantag ur banksynken kan bära bankens text. Typen kan sätta
      // `kod` på felet. Själva felet går till appens `onFel`, som avgör vad som får loggas, så att det inte tystas (regel 1).
      b.onFel?.(jobb.id, e);
      const kod = /** @type {any} */ (e)?.kod;
      utfall = { utfall: "fel", kod: typeof kod === "string" && JOBBKODFORM.test(kod) ? kod : "undantag" };
    }
  }
  const skrivet = await slutforJobb({ kalla: b.kalla, samling: b.samling, jobbId: jobb.id, version, utfall, nu: b.nu, tidszon: b.tidszon });
  return { senast: skrivet ?? vitlistaUtfall(utfall, b.nu), bekraftad: skrivet !== null };
}

/** @param {Record<string, Jobbtyp>} typer @param {string} namn */
function kravTyper(typer, namn) {
  if (!typer || typeof typer !== "object") throw new Error(`${namn}: typer krävs, { [typ]: { kor, tidsgransMs } }. Ramverket känner inga jobbtyper; appen skickar in dem.`);
  return typer;
}

/**
 * Kör ett jobb nu, oavsett schemat (Kör nu). Tar låset med `direkt`, kör typen och skriver utfallet.
 *
 * Svarar `null` när jobbet inte gick att ta (låst, avslaget, borta eller taget av ett varv under tiden), annars utfallet som det
 * skrevs och om skrivningen bekräftades. ⛔ NÄSTA KÖRNING RÄKNAS FRÅN NU, också efter Kör nu: ett jobb som körts 05:50 ska inte
 * köras igen 06:15 samma dag.
 *
 * @param {{ kalla: Kalla, samling: string, jobbId: string, nu: Date, tidszon?: string, typer: Record<string, Jobbtyp>, onFel?: OnFel }} b
 * @returns {Promise<{ senast: Senast, bekraftad: boolean } | null>}
 */
export async function korJobbNu(b) {
  const SAMLING = kontrollera("korJobbNu", b?.kalla, b?.samling);
  const typer = kravTyper(b.typer, "korJobbNu");
  const jobbId = kravId("korJobbNu", b.jobbId);
  // Typens tidsgräns behövs för låset, och typen står på dokumentet. Läsningen är bara för tidsgränsen: versionen avgör anspråket.
  const forhand = await b.kalla.read(SAMLING, jobbId);
  const typ = forhand && typeof forhand.typ === "string" ? typer[forhand.typ] : undefined;
  const tilldelat = await tilldelaJobb({ kalla: b.kalla, samling: SAMLING, jobbId, nu: b.nu, tidsgransMs: typ?.tidsgransMs, direkt: true });
  if (!tilldelat) return null;
  return korTilldelat({ ...b, samling: SAMLING, typer }, tilldelat);
}

/**
 * Schemaläggarens varv: hämtar förfallna jobb, tar vart och ett, kör dess typ och skriver utfallet.
 *
 * ⛔ ETT JOBB STOPPAR ALDRIG DE ANDRA. En typ som kastar ger `fel` med en kod, en okänd typ ger `hoppad` med koden `okand-typ`,
 * och ett fel i själva låset eller skrivningen räknas som `fel` för det jobbet. Varvet går vidare i alla tre fallen.
 *
 * ⛔ PÅBÖRJADE OCH BEKRÄFTADE RÄKNAS VAR FÖR SIG (regel 4: tystnad). `paborjade` är jobben vars lås togs, `bekraftade` de vars
 * utfall faktiskt skrevs. Skillnaden är jobb som började och inte slutfördes, och den ska synas i stället för att ett varv som dog
 * halvvägs rapporterar noll fel. `fel` och `hoppade` räknar utfallen. Ett jobb som var låst eller togs av ett annat varv räknas inte
 * alls: det var inte detta varvs jobb.
 *
 * ⛔ FRÅGAN: `fore: { falt: "nastaKorning", varde: nu + 1 }` (strikt mindre än nu + 1 ms är högst nu), sorterat på `nastaKorning`,
 * högst `max`. Läget filtreras i JS, så Firestore behöver bara det enkla index den lägger av sig själv på `nastaKorning`; se
 * filhuvudet om varför ett avslaget jobb har `nastaKorning: null`. `tilldelaJobb` prövar allt igen, så frågan är ett urval och inte
 * ett beslut.
 *
 * @param {{ kalla: Kalla, samling: string, nu: Date, tidszon?: string, typer: Record<string, Jobbtyp>, max?: number, onFel?: OnFel }} b
 * @returns {Promise<Korningsrapport>}
 */
export async function korForfallnaJobb(b) {
  const SAMLING = kontrollera("korForfallnaJobb", b?.kalla, b?.samling);
  const nu = kravNu("korForfallnaJobb", b.nu);
  const typer = kravTyper(b.typer, "korForfallnaJobb");
  const max = b.max ?? 50;
  if (!Number.isInteger(max) || max < 1) throw new Error("korForfallnaJobb: max ska vara ett positivt heltal.");
  /** @type {Jobb[]} */
  const rader = await b.kalla.list(SAMLING, { fore: { falt: "nastaKorning", varde: nu.getTime() + 1 }, sortBy: "nastaKorning", limit: max });
  /** @type {Korningsrapport} */
  const rapport = { paborjade: 0, bekraftade: 0, fel: 0, hoppade: 0 };
  for (const rad of rader.filter((r) => r && r.lage !== "av")) {
    const typ = typeof rad.typ === "string" ? typer[rad.typ] : undefined;
    try {
      const tilldelat = await tilldelaJobb({ kalla: b.kalla, samling: SAMLING, jobbId: rad.id, nu, tidsgransMs: typ?.tidsgransMs });
      if (!tilldelat) continue;
      rapport.paborjade += 1;
      const { senast, bekraftad } = await korTilldelat({ ...b, samling: SAMLING, typer }, tilldelat);
      if (bekraftad) rapport.bekraftade += 1;
      if (senast.utfall === "fel") rapport.fel += 1;
      if (senast.utfall === "hoppad") rapport.hoppade += 1;
    } catch (e) {
      // Låset eller skrivningen föll (inte typen, den fångas i `korTilldelat`). Räknas och lämnas till appen, aldrig tystat.
      rapport.fel += 1;
      b.onFel?.(rad.id, e);
    }
  }
  return rapport;
}
