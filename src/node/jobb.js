import { JOBBKODFORM, JOBBLAGEN, JOBBUTFALL, jobbKorningsId, jobbTidpunkt, nastaKorning } from "../lib/jobb.js";
import { STANDARD_TIDSZON } from "../lib/format.js";

/**
 * Återkommande jobb på servern: låset, körningen och utfallet (0.256.0, cllp/lifehub.app#888).
 *
 * ══ ⛔ EN FIRESTORE-LIK `db` OCH INTE EN DATAKÄLLA ═════════════════════════════════════════════════════════════════════════
 *
 * Övriga tjänster här tar en datakälla (`DataSource`) och kräver `updateIf` för ett atomärt anspråk. Låset kan inte uttryckas så:
 * `updateIf` prövar att fält är LIKA med ett värde, och låset ska tas när `las.till` är MINDRE än nu eller saknas, och bara om
 * jobbet är förfallet och inte avslaget. Det är en läsning och ett villkorat skrivande i samma transaktion, och en läs-sedan-skriv
 * utanför en transaktion hade låtit två schemaläggarvarv ta samma jobb (regel 2: unikhet med riktiga villkor). Tjänsten tar därför
 * det Admin SDK ger, `db.collection(samling).doc(id)` och `db.runTransaction`, och en fråga med `where`, `orderBy`, `limit` och `get`.
 * Den importerar ingen Firebase: appen skickar in sin `db`, och proven en i minnet med samma form.
 *
 * ⛔ SAMLINGEN SKICKAS IN. Ramverket känner inga samlingsnamn (arbetsreglerna, "Vad som inte är regler här").
 *
 * ══ ⛔ DOKUMENTETS FORM (design #888) ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `{ groupId, typ, lage, schema, nastaKorning, agare, senast, las, skapad, andrad, andradAv }`. Den här filen läser `typ`, `lage`,
 * `schema` och `nastaKorning`, och skriver bara `las`, `senast` och `nastaKorning`. Resten äger appens `sparaJobb`.
 *
 * @typedef {{ utfall?: unknown, paborjat?: unknown, bekraftat?: unknown, kod?: unknown }} Rattutfall Vad en typ svarar, före vitlistningen.
 * @typedef {{ tid: Date, utfall: import("../lib/jobb.js").Jobbutfall, paborjat?: number, bekraftat?: number, kod?: string }} Senast
 * @typedef {{ id: string, typ?: string, lage?: string, schema?: unknown, nastaKorning?: unknown, las?: { till?: unknown, korning?: string } | null, [k: string]: unknown }} Jobb
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

/** @param {string} namn @param {any} db @param {unknown} samling */
function kontrollera(namn, db, samling) {
  if (!db || typeof db.collection !== "function" || typeof db.runTransaction !== "function") {
    throw new Error(`${namn}: en Firestore-lik db med collection och runTransaction krävs. Ramverket känner ingen databas; appen skickar in sin.`);
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

/**
 * Tar låset på ett jobb, i en transaktion.
 *
 * Svarar `null`, och skriver ingenting, när låset är giltigt (`las.till` efter `nu`), när jobbet inte är förfallet
 * (`nastaKorning` saknas eller ligger efter `nu`), när läget är `av` eller okänt, eller när jobbet inte finns. Annars sätts
 * `las = { till: nu + tidsgräns, korning }` och svaret är körningens id och jobbet som det lästes.
 *
 * ⛔ `direkt` ÄR KÖR NU. Då prövas inte om jobbet är förfallet, och körningens planerade tid är `nu` (ett eget id, så att den inte
 * förväxlas med nästa schemalagda körning). Låset och läget prövas ändå: Kör nu får inte köra ett jobb som redan körs, och ett
 * avslaget jobb har inget läge att köra i.
 *
 * @param {{ db: any, samling: string, jobbId: string, nu: Date, tidsgransMs?: number, direkt?: boolean }} b
 * @returns {Promise<{ korningId: string, jobb: Jobb } | null>}
 */
export async function tilldelaJobb(b) {
  const SAMLING = kontrollera("tilldelaJobb", b?.db, b?.samling);
  const jobbId = kravId("tilldelaJobb", b.jobbId);
  const nu = kravNu("tilldelaJobb", b.nu);
  const tidsgrans = b.tidsgransMs ?? JOBB_TIDSGRANS_MS;
  if (typeof tidsgrans !== "number" || !Number.isFinite(tidsgrans) || tidsgrans <= 0) throw new Error("tilldelaJobb: tidsgransMs ska vara ett positivt antal millisekunder.");
  const ref = b.db.collection(SAMLING).doc(jobbId);
  return b.db.runTransaction(async (/** @type {any} */ tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const data = snap.data() ?? {};
    if (data.lage !== "prov" && data.lage !== "skarp") return null;
    const lasTill = jobbTidpunkt(data.las?.till);
    if (lasTill && lasTill.getTime() > nu.getTime()) return null;
    /** @type {Date} */
    let planerad;
    if (b.direkt === true) {
      planerad = nu;
    } else {
      const forfaller = jobbTidpunkt(data.nastaKorning);
      if (!forfaller || forfaller.getTime() > nu.getTime()) return null;
      planerad = forfaller;
    }
    const korningId = jobbKorningsId(jobbId, planerad);
    tx.update(ref, { las: { till: new Date(nu.getTime() + tidsgrans), korning: korningId } });
    return { korningId, jobb: /** @type {Jobb} */ ({ ...data, id: jobbId }) };
  });
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
  const ut = { tid: nu, utfall: kand ? /** @type {any} */ (u.utfall) : "fel" };
  for (const k of /** @type {const} */ (["paborjat", "bekraftat"])) {
    const v = u[k];
    if (typeof v === "number" && Number.isInteger(v) && v >= 0) ut[k] = v;
  }
  if (!kand) ut.kod = "okant-utfall";
  else if (typeof u.kod === "string" && JOBBKODFORM.test(u.kod)) ut.kod = u.kod;
  return ut;
}

/**
 * Skriver utfallet och nästa körning, och släpper låset, i en transaktion.
 *
 * ⛔ BARA OM LÅSETS KÖRNING ÄR DENNA. Har låset löpt ut och tagits av ett annat varv, eller släppts, är det inte den här körningens
 * jobb längre att skriva: svaret är `null` och ingenting skrivs. Annars hade en körning som dog och kom tillbaka skrivit över
 * utfallet för den som tog vid.
 *
 * ⛔ ETT SCHEMA SOM INTE GÅR ATT LÄSA STOPPAR JOBBET SYNLIGT. `nastaKorning` blir `null` och utfallet `fel` med koden
 * `ogiltigt-schema`, i stället för ett undantag som lämnar låset kvar och jobbet förfallet: då hade varje varv tagit det igen, och
 * ingenting i vyn hade sagt varför (regel 5).
 *
 * @param {{ db: any, samling: string, jobbId: string, korningId: string, utfall: Rattutfall, nu: Date, tidszon?: string }} b
 * @returns {Promise<Senast | null>} Det som skrevs i `senast`, eller `null` när ingenting skrevs.
 */
export async function slutforJobb(b) {
  const SAMLING = kontrollera("slutforJobb", b?.db, b?.samling);
  const jobbId = kravId("slutforJobb", b.jobbId);
  const nu = kravNu("slutforJobb", b.nu);
  const korningId = typeof b.korningId === "string" ? b.korningId : "";
  if (!korningId) throw new Error("slutforJobb: körningens id krävs. Utan det går det inte att veta att låset är den här körningens.");
  const tidszon = b.tidszon ?? STANDARD_TIDSZON;
  const ref = b.db.collection(SAMLING).doc(jobbId);
  return b.db.runTransaction(async (/** @type {any} */ tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const data = snap.data() ?? {};
    if (data.las?.korning !== korningId) return null;
    let senast = vitlistaUtfall(b.utfall, nu);
    /** @type {Date | null} */
    let nasta;
    try {
      nasta = nastaKorning(data.schema, nu, tidszon);
    } catch {
      nasta = null;
      senast = { ...senast, utfall: "fel", kod: "ogiltigt-schema" };
    }
    tx.update(ref, { senast, nastaKorning: nasta, las: null });
    return senast;
  });
}

/**
 * Kör ett tilldelat jobb med dess typ och skriver utfallet. Gemensam för schemaläggaren och Kör nu.
 * @param {{ db: any, samling: string, nu: Date, tidszon?: string, typer: Record<string, Jobbtyp>, onFel?: OnFel }} b
 * @param {{ korningId: string, jobb: Jobb }} tilldelat
 * @returns {Promise<{ senast: Senast, bekraftad: boolean }>}
 */
async function korTilldelat(b, tilldelat) {
  const { jobb, korningId } = tilldelat;
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
  const skrivet = await slutforJobb({ db: b.db, samling: b.samling, jobbId: jobb.id, korningId, utfall, nu: b.nu, tidszon: b.tidszon });
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
 * Svarar `null` när jobbet inte gick att ta (låst, avslaget eller borta), annars utfallet som det skrevs och om skrivningen
 * bekräftades. ⛔ NÄSTA KÖRNING RÄKNAS FRÅN NU, också efter Kör nu: ett jobb som körts 05:50 ska inte köras igen 06:15 samma dag.
 *
 * @param {{ db: any, samling: string, jobbId: string, nu: Date, tidszon?: string, typer: Record<string, Jobbtyp>, onFel?: OnFel }} b
 * @returns {Promise<{ senast: Senast, bekraftad: boolean } | null>}
 */
export async function korJobbNu(b) {
  const SAMLING = kontrollera("korJobbNu", b?.db, b?.samling);
  kravTyper(b.typer, "korJobbNu");
  const jobbId = kravId("korJobbNu", b.jobbId);
  // Typens tidsgräns behövs för låset, och typen står på dokumentet. Läsningen är bara för tidsgränsen: transaktionen prövar allt igen.
  const forhand = await b.db.collection(SAMLING).doc(jobbId).get();
  const typ = forhand?.exists ? b.typer[forhand.data()?.typ] : undefined;
  const tilldelat = await tilldelaJobb({ db: b.db, samling: b.samling, jobbId, nu: b.nu, tidsgransMs: typ?.tidsgransMs, direkt: true });
  if (!tilldelat) return null;
  return korTilldelat(b, tilldelat);
}

/**
 * Schemaläggarens varv: hämtar förfallna jobb, tar vart och ett, kör dess typ och skriver utfallet.
 *
 * ⛔ ETT JOBB STOPPAR ALDRIG DE ANDRA. En typ som kastar ger `fel` med en kod, en okänd typ ger `hoppad` med koden `okand-typ`,
 * och ett fel i själva låset eller skrivningen räknas som `fel` för det jobbet. Varvet går vidare i alla tre fallen.
 *
 * ⛔ PÅBÖRJADE OCH BEKRÄFTADE RÄKNAS VAR FÖR SIG (regel 4: tystnad). `paborjade` är jobben vars lås togs, `bekraftade` de vars
 * utfall faktiskt skrevs. Skillnaden är jobb som började och inte slutfördes, och den ska synas i stället för att ett varv som dog
 * halvvägs rapporterar noll fel. `fel` och `hoppade` räknar utfallen. Ett jobb som var låst eller hann ändras räknas inte alls:
 * det var inte detta varvs jobb.
 *
 * ⛔ FRÅGAN ÄR ETT INDEX, INTE EN SKANNING: `lage in [prov, skarp]` och `nastaKorning <= nu`, sorterat på `nastaKorning`, högst `max`.
 * Appen lägger det sammansatta indexet. Transaktionen prövar allt igen, så frågan får vara ett urval och inte ett beslut.
 *
 * @param {{ db: any, samling: string, nu: Date, tidszon?: string, typer: Record<string, Jobbtyp>, max?: number, onFel?: OnFel }} b
 * @returns {Promise<Korningsrapport>}
 */
export async function korForfallnaJobb(b) {
  const SAMLING = kontrollera("korForfallnaJobb", b?.db, b?.samling);
  const nu = kravNu("korForfallnaJobb", b.nu);
  const typer = kravTyper(b.typer, "korForfallnaJobb");
  const max = b.max ?? 50;
  if (!Number.isInteger(max) || max < 1) throw new Error("korForfallnaJobb: max ska vara ett positivt heltal.");
  const svar = await b.db
    .collection(SAMLING)
    .where("lage", "in", JOBBLAGEN.filter((l) => l !== "av"))
    .where("nastaKorning", "<=", nu)
    .orderBy("nastaKorning")
    .limit(max)
    .get();
  /** @type {Korningsrapport} */
  const rapport = { paborjade: 0, bekraftade: 0, fel: 0, hoppade: 0 };
  for (const dok of svar.docs ?? []) {
    const typ = typer[dok.data()?.typ];
    try {
      const tilldelat = await tilldelaJobb({ db: b.db, samling: SAMLING, jobbId: dok.id, nu, tidsgransMs: typ?.tidsgransMs });
      if (!tilldelat) continue;
      rapport.paborjade += 1;
      const { senast, bekraftad } = await korTilldelat({ ...b, samling: SAMLING, typer }, tilldelat);
      if (bekraftad) rapport.bekraftade += 1;
      if (senast.utfall === "fel") rapport.fel += 1;
      if (senast.utfall === "hoppad") rapport.hoppade += 1;
    } catch (e) {
      // Låset eller skrivningen föll (inte typen, den fångas i `korTilldelat`). Räknas och lämnas till appen, aldrig tystat.
      rapport.fel += 1;
      b.onFel?.(dok.id, e);
    }
  }
  return rapport;
}
