/**
 * Gäster: en person som bjudits in utan konto (0.131.0, cllp/lifehub.app#389, skiva 1: "en sak", omröstningen först).
 *
 * ══ ⛔ EN GÄST ÄR EN INBJUDAN OCH ALDRIG ETT MEDLEMSKAP, ETT KONTO ELLER EN FIREBASE-INLOGGNING ═════════════════════════
 *
 * Se `src/lib/gast.js` och `docs/beslut/0011`. Gästen når bara servern (appens `POST /api/gast`) och aldrig Firestore. Varje anrop bär en sessionsnyckel i
 * kroppen, och tjänsten läser sessionen och inbjudan på nytt varje gång: det finns ingen token med inbyggd livslängd att vänta ut när någon dras tillbaka.
 * `memberships` skrivs, läses och provas aldrig här för en gäst.
 *
 * ══ ⛔ NYCKELN LEDER ALDRIG UT UR TJÄNSTEN ANNAT ÄN GENOM `skicka` ════════════════════════════════════════════════════
 *
 * Nyckeln i brevet är 32 slumpbyte och lagras bara som hash. Den enda vägen ut är den inskickade `skicka`-funktionen (appens mejlväg), som får `{ id, nyckel }`
 * per länk och bygger adressen med `gastLank`. Inget returvärde från en metod här bär en nyckel, så en handler som av misstag returnerar tjänstens svar rakt ut
 * till webbläsaren läcker ingenting. Sessionsnyckeln är undantaget: den är svaret på `los`, och den hör hemma hos gästen.
 *
 * ══ ⛔ UNIKHET ÄR DOKUMENT-ID, ALDRIG EN LÄSNING FÖLJD AV EN SKRIVNING ═══════════════════════════════════════════════════
 *
 * Inbjudans id är SHA-256 av (grupp, adress, omfång), så samma adress till samma sak är en rad (`createNew`). Taket på `GAST_PLATSER_GRATIS` gäster per grupp är
 * lika många dokument med fasta id (`<grupp>|1` till `<grupp>|5`): att ta en plats är att skapa ett av dem med `createNew`. Två samtidiga inbjudningar går mot
 * samma lediga dokument och en får ett nej som visar vem som vann, så sju samtidiga inbjudningar till sju adresser ger exakt fem platser. Det finns ingen räkning med
 * en fråga, och därmed inget fönster mellan "räkna" och "skriv". Datakontraktet har ingen transaktion över flera dokument (regel 6 och 8), och den behövs inte här.
 *
 * ⛔ EN GÄST SOM FÅR EN PLATS FÖRE SIN INBJUDAN OCH BEKRÄFTAR DEN EFTER. Platsen tas först, eftersom en kvarglömd plats kostar en plats (säkert håll) medan en aktiv
 * inbjudan utan plats bryter taket (osäkert håll). Efter att inbjudan skrivits bekräftas platsen en gång till, så att en återkallelse som hann tömma platsen mitt i
 * ett nytt utskick av samma gäst inte lämnar en aktiv inbjudan utan plats. Det som återstår är en plats som ingen längre använder (processen dog mellan platsen och inbjudan):
 * den tas tillbaka av `tagPlats` när taket nås, om den är äldre än `PLATSFRIST_MS` och gästen saknar aktiv inbjudan. En ny plats på samma gäst räknas aldrig två gånger.
 *
 * ══ ⛔ FEL ADRESS RÄKNAS PER INBJUDAN OCH PER IP, OCH ALLA NEJ ÄR BYTE FÖR BYTE LIKA ═════════════════════════════════════════
 *
 * Försöket RESERVERAS innan nyckeln och adressen prövas (en villkorad skrivning, `updateIf`) och ges tillbaka om det lyckades, så att hundra parallella gissningar
 * inte alla hinner pröva innan någon räknats (samma mönster som delningens `reservera`). Svaret på okänt id, fel nyckel och fel adress är ett och samma: `{ ok: false,
 * orsak: "nej" }`. `aterkallad` och `utgangen` ges först när nyckeln OCH adressen stämde.
 *
 * ══ ⛔ RAMVERKET KÄNNER INGEN DATABAS, INGA SAMLINGSNAMN OCH INGA FÄLT HOS APPENS HÄNDELSE ═════════════════════════════════
 *
 * Datakällan skickas in, samlingsnamnen likaså. Appens händelse läses bara för `groupId` och `arkiverad`. Vad gästen får se av saken är appens (`sak.bygg`), men bara
 * de fält appen uttryckligen listat i `sak.falt` lämnar tjänsten.
 */

// @ts-expect-error Noden har crypto. Ramverket har inga Node-typer: lib är DOM, för webben. Samma rad som i delning.js.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
// @ts-expect-error Samma skäl: ramverket har inga Node-typer.
import { Buffer } from "node:buffer";
import {
  GASTFEL_FONSTER_MS,
  GASTFEL_MAX,
  GASTFELKODER,
  GASTIP_FONSTER_MS,
  GASTIP_MAX,
  GASTLANKDAGAR,
  GASTLISTFALT,
  GASTNYCKELFORM,
  GASTNYLANK_BREV_PER_DYGN,
  GASTNYLANKIP_FONSTER_MS,
  GASTNYLANKIP_MAX,
  GASTNYLANK_MAX_LANKAR,
  GASTNYLANK_SVAR,
  GASTPLATSNUMMER,
  GASTSESSIONSDAGAR,
  GASTSVARSFALT,
  GASTINBJUDNINGSIDFORM,
  GAST_PLATSER_GRATIS,
  MAX_GASTNAMN,
  gastId,
  gastStatus,
  gastomfangsnyckel,
  gastplatsId,
  normaliseraGastepost,
} from "../lib/gast.js";
import { medlemskapsId } from "../lib/grupp.js";
import { epostFel } from "../lib/mejl.js";

const DYGN_MS = 24 * 60 * 60 * 1000;

/** Hur gammal en plats ska vara innan den får tas tillbaka som övergiven. En plats vars inbjudan skrivs just nu är yngre än så. */
export const PLATSFRIST_MS = 10 * 60 * 1000;

/** Hur ofta en sessions `senast` skrivs om. Ett anrop per minut ska inte vara en skrivning per minut. */
export const SESSIONSUPPDATERING_MS = 60 * 60 * 1000;

/** Samma form som regelfragmentens samlingsnamn: ett namn, inte en sökväg. */
const SAMLINGSFORM = /^[A-Za-z][A-Za-z0-9_-]*$/;

/** @param {unknown} v @returns {string} */
const text = (v) => (typeof v === "string" ? v.trim() : "");

/** @param {string} t @returns {string} */
const hash = (t) => createHash("sha256").update(t).digest("hex");

/** En ny nyckel eller sessionsnyckel: 32 slumpbyte i base64url. Det enda stället en nyckel blir till. @returns {string} */
export function nyGastnyckel() {
  return randomBytes(32).toString("base64url");
}

/**
 * Hashen av en nyckel: SHA-256 i hex. Kastar för något som inte är en nyckel, så att en felskriven hash aldrig lagras som en.
 * @param {string} nyckel
 * @returns {string}
 */
export function gastnyckelHash(nyckel) {
  if (typeof nyckel !== "string" || !GASTNYCKELFORM.test(nyckel)) {
    throw new Error("gastnyckelHash: en nyckel är 43 tecken ur A-Z, a-z, 0-9, - och _ (32 slumpbyte i base64url).");
  }
  return hash(nyckel);
}

/**
 * Är två hex-hashar lika? Jämförelsen tar lika lång tid oavsett var de skiljer sig.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function likaHash(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === 32 && y.length === 32 && timingSafeEqual(x, y);
}

/**
 * Inbjudans dokument-id: SHA-256 i hex av (grupp, normaliserad adress, omfångsnyckel). JSON-kodat, så att inget tecken i en adress kan flytta gränsen mellan delarna.
 * Samma adress till samma sak i samma grupp är samma id, och det är hela unikhetsmekanismen.
 *
 * @param {{ groupId: string, epost: string, omfang: import("../lib/gast.js").Gastomfang }} d
 * @returns {string}
 */
export function gastInbjudningsId(d) {
  const epost = normaliseraGastepost(d?.epost);
  if (epost === null) throw new Error("gastInbjudningsId: en inbjudan har en e-postadress som går att skicka till.");
  const groupId = text(d?.groupId);
  if (!groupId) throw new Error("gastInbjudningsId: groupId krävs.");
  return hash(JSON.stringify([groupId, epost, gastomfangsnyckel(d.omfang)]));
}

/**
 * Inbjudningspostens form, eller felet som säger varför den inte går att bygga. `id` är hashen och är dokumentets id; nyckeln finns inte i raden, bara dess hash.
 *
 * ⛔ `felAntal` OCH `felFonster` FINNS FRÅN BÖRJAN, som på en delning: räknaren är då alltid ett tal och aldrig ett fält som saknas, vilket en villkorad skrivning inte
 * kan jämföra på ett pålitligt sätt.
 *
 * @param {object} d
 * @param {string} d.groupId
 * @param {string} d.epost
 * @param {string} [d.namn]
 * @param {import("../lib/gast.js").Gastomfang} d.omfang
 * @param {{ uid: string, namn?: string }} d.skapadAv
 * @param {number} d.skapad Millisekunder.
 * @param {string} d.nyckel Nyckeln i brevet. Lagras aldrig, bara hashen.
 * @returns {Record<string, any>}
 */
export function byggGastinbjudan(d) {
  if (!d || typeof d !== "object") throw new Error("byggGastinbjudan: en inbjudan krävs.");
  const epost = normaliseraGastepost(d.epost);
  if (epost === null) throw new Error("byggGastinbjudan: epost är ingen adress som går att skicka till.");
  const groupId = text(d.groupId);
  const uid = text(d.skapadAv?.uid);
  if (!groupId) throw new Error("byggGastinbjudan: groupId krävs.");
  if (!uid) throw new Error("byggGastinbjudan: skapadAv.uid krävs. Utan den går det inte att se vem som får dra tillbaka inbjudan.");
  if (!Number.isInteger(d.skapad) || d.skapad < 0) throw new Error("byggGastinbjudan: skapad ska vara ett heltal, millisekunder.");
  const namn = text(d.namn);
  if (namn.length > MAX_GASTNAMN) throw new Error(`byggGastinbjudan: namnet får vara högst ${MAX_GASTNAMN} tecken.`);
  const omfang = { slag: d.omfang.slag, funktion: d.omfang.funktion, handelseId: d.omfang.handelseId };
  return {
    id: gastInbjudningsId({ groupId, epost, omfang }),
    groupId,
    epost,
    namn,
    omfang,
    skapadAv: { uid, namn: text(d.skapadAv?.namn) },
    skapad: d.skapad,
    skickad: d.skapad,
    antalSkickade: 1,
    lankGiltigTill: d.skapad + GASTLANKDAGAR * DYGN_MS,
    nyckelHash: gastnyckelHash(d.nyckel),
    forstInloggad: null,
    aterkallad: null,
    felAntal: 0,
    felFonster: 0,
  };
}

/**
 * Ett fel som bär en `kod` för appens callable att översätta. Meddelandet är för loggen.
 * @param {(typeof GASTFELKODER)[number]} kod
 * @param {string} meddelande
 * @returns {Error & { kod: string }}
 */
function felMedKod(kod, meddelande) {
  return Object.assign(new Error(meddelande), { kod });
}

/**
 * @typedef {object} Gastsamlingar
 * @property {string} inbjudningar Samlingen inbjudningarna ligger i. Inget förval: det är appens namn. Klienten läser den (`gastregelfragment`).
 * @property {string} sessioner Samlingen sessionerna ligger i, en rad per session med hashen av sessionsnyckeln som id. Nekas klienten (ingen match, catch-allen).
 * @property {string} platser Samlingen platserna ligger i, `GAST_PLATSER_GRATIS` fasta dokument per grupp. Nekas klienten.
 * @property {string} raknare Samlingen räknarna ligger i (en per IP och en per adress, båda som hash). Nekas klienten.
 * @property {string} handelser Appens händelsesamling. Läses bara för `groupId` och `arkiverad`.
 * @property {string} [medlemskap] Förval `memberships`.
 */

/** @typedef {"nej" | "aterkallad" | "utgangen" | "for-manga" | "saknas"} Gastorsak */

/**
 * @typedef {object} Gastbrev
 * @property {"inbjudan" | "igen" | "ny-lank"} typ
 * @property {string} till Adressen, normaliserad.
 * @property {string} namn Namnet som den som bjöd gav, eller en tom sträng.
 * @property {ReadonlyArray<{ id: string, nyckel: string, groupId: string, omfang: import("../lib/gast.js").Gastomfang }>} lankar En per inbjudan. Bygg adressen med `gastLank`.
 * @property {{ uid: string, namn: string } | null} skickadAv Den som bjöd eller skickade om. `null` för "ny länk", som gästen själv bad om.
 */

/**
 * Bygger tjänsten.
 *
 * @param {object} konfig
 * @param {import("../data/contract.js").DataSource<any>} konfig.kalla Kräver `read`, `list`, `remove`, `createNew` och `updateIf`.
 * @param {Gastsamlingar} konfig.samlingar
 * @param {(arg: { uid: string, groupId: string, medlemskap: Record<string, any>, handelse: Record<string, any> }) => boolean | Promise<boolean>} konfig.farBjuda
 *   Appens regel för vem som får bjuda in gäster till en händelse och dra tillbaka dem: för omröstningen skaparen, en admin eller en ägare, och bara medan datumet
 *   inte är valt. KRÄVS, utan förval: att bjuda in en utomstående är att skicka ett brev i gruppens namn, och en tyst bred regel vore en dörr bredvid reglerna. Prövas
 *   EFTER medlemskapet (aktiv, och en person), aldrig i stället för det.
 * @param {(brev: Gastbrev) => void | Promise<void>} konfig.skicka Appens mejlväg. Får nyckeln, och är den enda väg en nyckel lämnar tjänsten på.
 * @param {{ falt: readonly string[], bygg: (arg: { inbjudan: Record<string, any>, gastId: string, handelse: Record<string, any> }) => Record<string, any> | Promise<Record<string, any>> }} [konfig.sak]
 *   Det gästen ser av saken. `falt` är hela listan: allt som `bygg` ger utöver den tas bort innan svaret lämnar tjänsten. Utan den ger `hamta` inget `sak`.
 * @param {readonly string[]} [konfig.extraSparrade] Appens egna spärrade mejldomäner (`epostFel`).
 * @param {(fel: unknown) => void} [konfig.rapportera] Där ett brev som inte gick att skicka rapporteras när svaret ändå måste vara neutralt (`nyLank`). Förval `console.error`.
 * @param {() => number} [konfig.klocka] Millisekunder. Förval `Date.now`. Provens enda sätt att låta en länk gå ut.
 */
export function createGastService(konfig) {
  /*
   * ⛔ DESTRUKTURERINGEN LIGGER I KROPPEN, av samma skäl som i `createDelningService`: `({ kalla })` i signaturen kastar Nodes "Cannot destructure" innan
   * valideringen hinner köra, och det felet nämner inte fabriken.
   */
  const { kalla, samlingar, farBjuda, skicka, sak, extraSparrade = [], rapportera = (/** @type {unknown} */ fel) => console.error("createGastService:", fel), klocka = Date.now } = konfig ?? {};
  const namn = "createGastService";
  if (!kalla || typeof kalla.read !== "function" || typeof kalla.list !== "function" || typeof kalla.remove !== "function") {
    throw new Error(`${namn}: en datakälla med read, list och remove krävs. Ramverket känner ingen databas.`);
  }
  if (typeof kalla.createNew !== "function") {
    throw new Error(`${namn}: datakällan saknar createNew. Id:t är en hash och en plats tas bara om dokumentet är ledigt. Se datakontraktets regel 8.`);
  }
  if (typeof kalla.updateIf !== "function") {
    throw new Error(`${namn}: datakällan saknar updateIf. Att räkna felaktiga försök och att rotera en nyckel får inte kunna korsa varandra. Se datakontraktets regel 7.`);
  }
  for (const falt of /** @type {const} */ (["inbjudningar", "sessioner", "platser", "raknare", "handelser"])) {
    const v = samlingar?.[falt];
    if (typeof v !== "string" || !SAMLINGSFORM.test(v)) {
      throw new Error(`${namn}: samlingar.${falt} krävs, ett samlingsnamn. Ramverket känner inte appens samlingsnamn och gissar inget.`);
    }
  }
  if (samlingar.medlemskap !== undefined && (typeof samlingar.medlemskap !== "string" || !SAMLINGSFORM.test(samlingar.medlemskap))) {
    throw new Error(`${namn}: samlingar.medlemskap är ett samlingsnamn, eller utelämnas (förval memberships).`);
  }
  const unika = new Set([samlingar.inbjudningar, samlingar.sessioner, samlingar.platser, samlingar.raknare, samlingar.handelser, samlingar.medlemskap ?? "memberships"]);
  if (unika.size !== 6) throw new Error(`${namn}: varje samling ska ha sitt eget namn. Två samlingar med samma namn blandar id:n som inte hör ihop.`);
  if (typeof farBjuda !== "function") {
    throw new Error(`${namn}: farBjuda krävs, appens regel för vem som får bjuda in gäster. Det finns inget förval: ramverket gissar inte vem som får skicka ett brev i gruppens namn.`);
  }
  if (typeof skicka !== "function") {
    throw new Error(`${namn}: skicka krävs, appens mejlväg. Nyckeln lämnar tjänsten bara genom den.`);
  }
  if (sak !== undefined) {
    if (!sak || !Array.isArray(sak.falt) || sak.falt.length === 0 || sak.falt.some((/** @type {unknown} */ f) => typeof f !== "string" || f === "")) {
      throw new Error(`${namn}: sak.falt är en icke-tom lista med fältnamn. Den är hela listan över vad en gäst får se av saken.`);
    }
    if (typeof sak.bygg !== "function") throw new Error(`${namn}: sak.bygg krävs när sak finns, en funktion som ger saken som en gäst ser den.`);
  }
  /*
   * ⛔ ANROPEN GÅR TILL KÄLLAN VARJE GÅNG, METODEN FÅNGAS INTE VID BYGGET (samma skäl som i `createDelningService`): en källa som lindas in efteråt, till exempel av
   * ett prov som lägger in ett fel mellan läsningen och skrivningen, träffas av samma anrop som `read`.
   */
  /** @type {(samling: string, data: any) => Promise<{ created: boolean, row: any }>} */
  const skapaNy = (samling, data) => /** @type {any} */ (kalla).createNew(samling, data);
  /** @type {(samling: string, id: string, villkor: Record<string, unknown>, data: any) => Promise<{ updated: boolean, row: any }>} */
  const uppdateraOm = (samling, id, villkor, data) => /** @type {any} */ (kalla).updateIf(samling, id, villkor, data);
  /**
   * Tar bort en rad så att den är borta efteråt. ⛔ ETT FEL SÄGER INTE ATT RADEN FINNS KVAR: en annan körning kan ha hunnit före (två återkallelser som släpper samma plats), och
   * Firestore tar bort en rad som redan är borta utan att klaga medan minneskällan kastar. Slutläget är det som räknas, så felet sväljs bara om en läsning visar att raden är borta.
   * @param {string} samling
   * @param {string} id
   */
  async function taBort(samling, id) {
    try {
      await kalla.remove(samling, id);
    } catch (fel) {
      if (await kalla.read(samling, id)) throw fel;
    }
  }
  const INB = samlingar.inbjudningar;
  const SESS = samlingar.sessioner;
  const PLATSER = samlingar.platser;
  const RAKNARE = samlingar.raknare;
  const HANDELSER = samlingar.handelser;
  const MEDLEMSKAP = samlingar.medlemskap ?? "memberships";

  /** Det enda nej som skiljer sig från ingenting: byte för byte detsamma varje gång. */
  const nej = () => ({ ok: /** @type {const} */ (false), orsak: /** @type {const} */ ("nej") });
  /** @param {"aterkallad" | "utgangen" | "for-manga" | "saknas"} orsak */
  const orsak = (orsak) => ({ ok: /** @type {const} */ (false), orsak });

  // ── Medlemskap och behörighet ─────────────────────────────────────────────────────────────────────────────────────

  /**
   * @param {string} uid
   * @param {string} groupId
   */
  async function aktivtMedlemskap(uid, groupId) {
    const rad = await kalla.read(MEDLEMSKAP, medlemskapsId(uid, groupId));
    return rad && rad.status === "aktiv" && rad.typ !== "agent" ? rad : null;
  }

  /**
   * @param {string} uid
   * @param {string} groupId
   */
  async function forvaltar(uid, groupId) {
    const m = await aktivtMedlemskap(uid, groupId);
    return Boolean(m) && (m.roll === "agare" || m.roll === "admin");
  }

  /**
   * @param {unknown} v
   * @param {string} falt
   * @param {string} vad
   */
  function kravText(v, falt, vad) {
    const t = text(v);
    if (!t) throw new Error(`${vad}: ${falt} krävs.`);
    return t;
  }

  /**
   * Händelsen, eller `finns-inte`. En arkiverad och en borttagen händelse ger samma svar: den som inte hör till gruppen får inte veta vilket.
   * @param {string} handelseId
   * @param {string} vad
   */
  async function lasHandelse(handelseId, vad) {
    const h = await kalla.read(HANDELSER, handelseId);
    if (!h || h.arkiverad === true || !text(h.groupId)) {
      throw felMedKod("finns-inte", `${vad}: händelsen "${handelseId}" finns inte, eller är arkiverad.`);
    }
    return h;
  }

  /**
   * Den som delade, en admin eller ägare i gruppen, eller den som appens regel släpper in på händelsen, får ändra en inbjudan. ⛔ DEN SOM BJÖD FÅR ALLTID DRA
   * TILLBAKA, ÄVEN EFTER ATT HEN LÄMNAT GRUPPEN (som en delning): en inbjudan som lever vidare efter att den som skapade den inte längre kan stänga den är en dörr
   * ingen kan stänga. Appens regel prövas bara om händelsen finns, och aldrig i stället för medlemskapet.
   *
   * @param {string} uid
   * @param {Record<string, any>} rad
   * @param {string} vad
   */
  async function kravForvalta(uid, rad, vad) {
    if (rad.skapadAv?.uid === uid) return;
    if (await forvaltar(uid, rad.groupId)) return;
    const h = await kalla.read(HANDELSER, rad.omfang?.handelseId);
    if (h && h.groupId === rad.groupId) {
      const m = await aktivtMedlemskap(uid, rad.groupId);
      if (m && (await farBjuda({ uid, groupId: rad.groupId, medlemskap: m, handelse: h })) === true) return;
    }
    throw felMedKod("ej-behorig", `${vad}: ${uid} är inte den som bjöd in, och inte admin eller ägare i gruppen. Inbjudan ändras inte.`);
  }

  // ── Räknare ───────────────────────────────────────────────────────────────────────────────────────────────────────

  /**
   * Reserverar ett försök på en rad med ett antal och ett fönster. En villkorad skrivning (`updateIf`), så att två samtidiga försök aldrig räknas som ett.
   *
   * ⛔ FÖRSÖKET RÄKNAS INNAN DET PRÖVAS, inte efter. Räknades det efter kunde hundra parallella gissningar alla passera spärren medan räknaren stod på noll.
   *
   * @param {string} samling
   * @param {string} id
   * @param {Record<string, any>} rad
   * @param {{ antal: string, fonster: string }} falt Fältnamnen: en inbjudan har `felAntal`/`felFonster`, en räknare `antal`/`fonster`.
   * @param {{ max: number, fonsterMs: number }} gräns
   * @returns {Promise<{ fonster: number } | null>} `null`: inga försök kvar (eller raden går inte att räkna på).
   */
  async function reservera(samling, id, rad, falt, gräns) {
    let aktuell = rad;
    // ⛔ HÖGST 50 VARV, OCH INTE FYRA: varje misslyckat varv betyder att en annan hann före och höjde räknaren, så loopen tar slut när räknaren nått taket. Fyra varv gav ett falskt
    // `for-manga` åt de sista av tjugo samtidiga anrop som tagit slut på varv innan de hunnit se att det fanns försök kvar (mätt i gast-tjanst.test.js).
    for (let i = 0; i < 50; i++) {
      if (typeof aktuell[falt.antal] !== "number" || typeof aktuell[falt.fonster] !== "number") return null;
      const nu = klocka();
      const galler = aktuell[falt.fonster] > 0 && nu < aktuell[falt.fonster] + gräns.fonsterMs;
      const antal = galler ? aktuell[falt.antal] : 0;
      if (antal >= gräns.max) return null;
      const fonster = galler ? aktuell[falt.fonster] : nu;
      const { updated, row } = await uppdateraOm(samling, id, { [falt.antal]: aktuell[falt.antal], [falt.fonster]: aktuell[falt.fonster] }, { [falt.antal]: antal + 1, [falt.fonster]: fonster });
      if (updated) return { fonster };
      if (!row) return null;
      aktuell = row;
    }
    return null;
  }

  /**
   * Ger tillbaka ett reserverat försök. Gäller bara samma fönster: ett fönster som hunnit bytas lämnas orört.
   * @param {string} samling
   * @param {string} id
   * @param {{ antal: string, fonster: string }} falt
   * @param {number} fonster
   */
  async function aterlamna(samling, id, falt, fonster) {
    for (let i = 0; i < 50; i++) {
      const rad = await kalla.read(samling, id);
      if (!rad || rad[falt.fonster] !== fonster || typeof rad[falt.antal] !== "number" || rad[falt.antal] <= 0) return;
      const { updated } = await uppdateraOm(samling, id, { [falt.antal]: rad[falt.antal], [falt.fonster]: rad[falt.fonster] }, { [falt.antal]: rad[falt.antal] - 1 });
      if (updated) return;
    }
  }

  const RAKNEFALT = { antal: "antal", fonster: "fonster" };
  const INBFALT = { antal: "felAntal", fonster: "felFonster" };

  /**
   * Reserverar ett försök på en räknare som kanske inte finns än. Räknarens id är hashen av vad som räknas (en IP, en adress), så ingen IP eller adress lagras i klartext.
   *
   * @param {string} id
   * @param {{ max: number, fonsterMs: number }} gräns
   * @returns {Promise<{ id: string, fonster: number } | null>}
   */
  async function reserveraRaknare(id, gräns) {
    let rad = await kalla.read(RAKNARE, id);
    if (!rad) {
      const { row } = await skapaNy(RAKNARE, { id, antal: 0, fonster: 0 });
      rad = row;
    }
    if (!rad) return null;
    const res = await reservera(RAKNARE, id, rad, RAKNEFALT, gräns);
    return res ? { id, fonster: res.fonster } : null;
  }

  /**
   * Hashen som identifierar en IP som räknare. `ip` är en text; att inte ange den är ett programfel hos appen och inte ett läge: en tjänst som tyst slutade räkna per IP
   * hade sett ut som en som gör det.
   *
   * @param {unknown} ip
   * @param {string} vad
   * @param {string} slag
   */
  function ipId(ip, vad, slag) {
    if (typeof ip !== "string" || ip.trim() === "") {
      throw new Error(`${vad}: ip krävs, en text. Gränsen per IP är inte valfri, och en tjänst som tyst slutade räkna hade sett ut som en som gör det. Okänd IP: ange en fast text, och räkna då alla okända som en.`);
    }
    return hash(`${slag}|${ip.trim()}`);
  }

  // ── Platserna ─────────────────────────────────────────────────────────────────────────────────────────────────────

  /**
   * Alla platser i en grupp, i nummerordning. Fem läsningar på fasta id, ingen fråga.
   * @param {string} groupId
   * @returns {Promise<Array<Record<string, any> | null>>}
   */
  const lasPlatser = (groupId) => Promise.all(GASTPLATSNUMMER.map((n) => kalla.read(PLATSER, gastplatsId(groupId, n))));

  /**
   * Gästens aktiva inbjudningar i gruppen.
   * @param {string} groupId
   * @param {string} epost
   */
  async function aktivaInbjudningar(groupId, epost) {
    const rader = await kalla.list(INB, { where: { epost } });
    return rader.filter((r) => r.groupId === groupId && r.aterkallad === null);
  }

  /**
   * Tar tillbaka platser som ingen längre använder: äldre än `PLATSFRIST_MS` och med en gäst som saknar aktiv inbjudan i gruppen. Körs bara när taket nåtts.
   * ⛔ ÅLDERSGRÄNSEN ÄR INTE EN DETALJ. Platsen tas före inbjudan skrivs; utan den hade den här funktionen kunnat ta tillbaka en plats mitt i en inbjudan som just håller på att skrivas.
   * @param {string} groupId
   * @param {Array<Record<string, any> | null>} rader
   * @returns {Promise<number>} Hur många platser som släpptes.
   */
  async function frigorOvergivna(groupId, rader) {
    const nu = klocka();
    const gamla = rader.map((r, i) => ({ r, nummer: GASTPLATSNUMMER[i] })).filter((p) => p.r && typeof p.r.skapad === "number" && nu - p.r.skapad > PLATSFRIST_MS);
    if (gamla.length === 0) return 0;
    const alla = await kalla.list(INB, { where: { groupId } });
    const levande = new Set(alla.filter((r) => r.aterkallad === null).map((r) => gastId(r.epost)));
    let n = 0;
    for (const p of gamla) {
      if (levande.has(/** @type {Record<string, any>} */ (p.r).gastId)) continue;
      await taBort(PLATSER, gastplatsId(groupId, p.nummer));
      n++;
    }
    return n;
  }

  /**
   * Gästen har en plats i gruppen när den här är klar, eller så kastas `platser-slut`. Har gästen redan en (annan adress-sak, samma adress) tas ingen ny.
   * @param {string} groupId
   * @param {string} gId
   */
  async function tagPlats(groupId, gId) {
    for (let varv = 0; varv < 2; varv++) {
      const rader = await lasPlatser(groupId);
      if (rader.some((r) => r?.gastId === gId)) return;
      for (const [i, r] of rader.entries()) {
        if (r) continue;
        const { created, row } = await skapaNy(PLATSER, { id: gastplatsId(groupId, GASTPLATSNUMMER[i]), gastId: gId, skapad: klocka() });
        if (created || row?.gastId === gId) return;
      }
      if (varv === 0 && (await frigorOvergivna(groupId, rader)) === 0) break;
    }
    throw felMedKod("platser-slut", `Gruppen har ${GAST_PLATSER_GRATIS} gäster och det är taket. Betalning för fler finns inte än.`);
  }

  /**
   * Släpper gästens plats när hen inte har någon aktiv inbjudan kvar i gruppen.
   * @param {string} groupId
   * @param {string} epost
   * @returns {Promise<boolean>} Sant om en plats släpptes.
   */
  async function slappPlatsOmTom(groupId, epost) {
    if ((await aktivaInbjudningar(groupId, epost)).length > 0) return false;
    const gId = gastId(epost);
    let slappt = false;
    const rader = await lasPlatser(groupId);
    for (const [i, r] of rader.entries()) {
      if (r?.gastId !== gId) continue;
      await taBort(PLATSER, gastplatsId(groupId, GASTPLATSNUMMER[i]));
      slappt = true;
    }
    return slappt;
  }

  /**
   * Så här många platser används i gruppen och så många finns. Fem läsningar.
   * @param {string} groupId
   */
  async function platsLage(groupId) {
    const anvanda = (await lasPlatser(groupId)).filter(Boolean).length;
    return { anvanda, totalt: GAST_PLATSER_GRATIS, lediga: GAST_PLATSER_GRATIS - anvanda };
  }

  // ── Utskicken ─────────────────────────────────────────────────────────────────────────────────────────────────────

  /**
   * Roterar nyckeln på en inbjudan (den gamla slutar fungera) och räknar ett utskick. Försöker om när en annan hann ändra raden.
   *
   * @param {Record<string, any>} rad Raden som den lästes.
   * @returns {Promise<{ rad: Record<string, any>, nyckel: string }>}
   */
  async function roteraNyckel(rad) {
    let aktuell = rad;
    for (let i = 0; i < 4; i++) {
      const nyckel = nyGastnyckel();
      const nu = klocka();
      const { updated, row } = await uppdateraOm(INB, aktuell.id, { nyckelHash: aktuell.nyckelHash }, {
        nyckelHash: gastnyckelHash(nyckel),
        skickad: nu,
        antalSkickade: (typeof aktuell.antalSkickade === "number" ? aktuell.antalSkickade : 0) + 1,
        lankGiltigTill: nu + GASTLANKDAGAR * DYGN_MS,
      });
      if (updated) return { rad: row, nyckel };
      if (!row) break;
      aktuell = row;
    }
    throw new Error("rotera: inbjudan ändrades hela tiden av någon annan. Försök igen.");
  }

  /**
   * Skickar brevet. ⛔ Ett brev som inte gick är ett fel med kod, aldrig ett tyst lyckande: inbjudan ligger kvar och Skicka igen löser det.
   * @param {Gastbrev} brev
   */
  async function levereraBrev(brev) {
    try {
      await skicka(brev);
    } catch (fel) {
      throw Object.assign(felMedKod("brev-misslyckades", "brevet gick inte att skicka. Inbjudan finns kvar: använd Skicka igen."), { orsak: fel });
    }
  }

  // ── Metoderna ─────────────────────────────────────────────────────────────────────────────────────────────────────

  /**
   * Bjuder in en gäst till en omröstning, eller skickar om och väcker upp en inbjudan som redan finns (samma adress till samma sak är samma rad).
   *
   * @param {Record<string, any>} b `{ uid, handelseId, epost, namn? }`.
   * @returns {Promise<{ id: string, gastId: string, ny: boolean, vackt: boolean }>}
   */
  async function bjud(b) {
    const uid = kravText(b?.uid, "uid", "bjud");
    const handelseId = kravText(b?.handelseId, "handelseId", "bjud");
    const epost = normaliseraGastepost(b?.epost, extraSparrade);
    if (epost === null) throw felMedKod("ogiltig-epost", `bjud: ${epostFel(b?.epost, extraSparrade) ?? "adressen går inte att skicka till"}`);
    const gastnamn = text(b?.namn);
    if (gastnamn.length > MAX_GASTNAMN) throw felMedKod("ogiltigt-namn", `bjud: namnet får vara högst ${MAX_GASTNAMN} tecken.`);

    const h = await lasHandelse(handelseId, "bjud");
    const groupId = text(h.groupId);
    // ⛔ MEDLEMSKAPET FÖRST, appens regel efter: en callback som släppte in en icke-medlem hade varit en dörr bredvid reglerna.
    const medlem = await aktivtMedlemskap(uid, groupId);
    if (!medlem) throw felMedKod("ej-behorig", `bjud: ${uid} är inte aktiv medlem i gruppen "${groupId}" och får inte bjuda in gäster.`);
    if ((await farBjuda({ uid, groupId, medlemskap: medlem, handelse: h })) !== true) {
      throw felMedKod("ej-behorig", `bjud: ${uid} får inte bjuda in gäster till händelsen "${handelseId}".`);
    }

    const omfang = /** @type {const} */ ({ slag: "sak", funktion: "rosta", handelseId });
    const gId = gastId(epost);
    // ⛔ PLATSEN FÖRST: en plats utan inbjudan kostar en plats, en inbjudan utan plats bryter taket.
    await tagPlats(groupId, gId);

    const nyckel = nyGastnyckel();
    const skapad = klocka();
    const skapadAv = { uid, namn: text(medlem.namn) };
    const ny = byggGastinbjudan({ groupId, epost, namn: gastnamn, omfang, skapadAv, skapad, nyckel });
    const { created, row } = await skapaNy(INB, ny);
    let brevNyckel = nyckel;
    let vackt = false;
    if (!created) {
      if (!row) throw new Error("bjud: inbjudan fanns och försvann i samma stund. Försök igen.");
      vackt = typeof row.aterkallad === "number";
      // Nytt utskick på en befintlig rad: en återkallad väcks (aterkallad rensas), en aktiv får bara en ny nyckel. Namnet ändras bara om den som bjuder gav ett.
      let aktuell = row;
      let klar = false;
      for (let i = 0; i < 4 && !klar; i++) {
        const k = nyGastnyckel();
        const nu = klocka();
        const { updated, row: ny2 } = await uppdateraOm(INB, aktuell.id, { nyckelHash: aktuell.nyckelHash, aterkallad: aktuell.aterkallad }, {
          nyckelHash: gastnyckelHash(k),
          aterkallad: null,
          skickad: nu,
          antalSkickade: (typeof aktuell.antalSkickade === "number" ? aktuell.antalSkickade : 0) + 1,
          lankGiltigTill: nu + GASTLANKDAGAR * DYGN_MS,
          ...(gastnamn ? { namn: gastnamn } : {}),
        });
        if (updated) {
          brevNyckel = k;
          klar = true;
        } else if (ny2) aktuell = ny2;
        else break;
      }
      if (!klar) throw new Error("bjud: inbjudan ändrades hela tiden av någon annan. Försök igen.");
    }

    // ⛔ PLATSEN BEKRÄFTAS EFTER INBJUDAN: en återkallelse som hann tömma platsen mitt i det här anropet får inte lämna en aktiv inbjudan utan plats.
    try {
      await tagPlats(groupId, gId);
    } catch (fel) {
      await uppdateraOm(INB, ny.id, { aterkallad: null }, { aterkallad: klocka() });
      throw fel;
    }

    await levereraBrev({
      typ: created ? "inbjudan" : "igen",
      till: epost,
      namn: gastnamn || text(row?.namn),
      lankar: [{ id: ny.id, nyckel: brevNyckel, groupId, omfang }],
      skickadAv: skapadAv,
    });
    return { id: ny.id, gastId: gId, ny: created, vackt };
  }

  /**
   * Drar tillbaka en inbjudan: gästens nästa anrop nekas (med `aterkallad`, så att sidan kan säga det), och platsen släpps om det var gästens sista aktiva inbjudan i gruppen. Idempotent.
   * Rösten står kvar i appens data men räknas inte (appens `sammanstall` räknar bara aktiva gäster), som för en medlem som lämnat gruppen.
   *
   * @param {Record<string, any>} b `{ uid, id }`.
   * @returns {Promise<{ id: string, platsSlappt: boolean }>}
   */
  async function aterkalla(b) {
    const uid = kravText(b?.uid, "uid", "aterkalla");
    const id = kravText(b?.id, "id", "aterkalla");
    if (!GASTINBJUDNINGSIDFORM.test(id)) throw felMedKod("finns-inte", "aterkalla: id är en hash på 64 hextecken.");
    const rad = await kalla.read(INB, id);
    if (!rad) throw felMedKod("finns-inte", `aterkalla: inbjudan "${id}" finns inte.`);
    await kravForvalta(uid, rad, "aterkalla");
    await uppdateraOm(INB, id, { aterkallad: null }, { aterkallad: klocka() });
    // ⛔ SESSIONERNA RADERAS INTE HÄR. Varje anrop läser inbjudan på nytt och nekas redan, och en öppen sida ska kunna säga "Inbjudan är återkallad" inom en minut i stället för
    // ett nej som läses som ett fel på länken. Sessionen får ligga: den ger `aterkallad` så länge inbjudan är återkallad, förnyas inte av det, och tas av `stadaSessioner` när den
    // blivit 90 dagar gammal. En inbjudan som väcks igen (`bjud`) öppnar samma session på nytt, vilket är avsikten.
    const platsSlappt = await slappPlatsOmTom(rad.groupId, rad.epost);
    return { id, platsSlappt };
  }

  /**
   * Skickar en ny länk till en aktiv inbjudan. Nyckeln roteras, så den gamla länken slutar fungera. Platsen bekräftas, så att ett utskick också lagar en plats som
   * en samtidig återkallelse tömde. En återkallad inbjudan skickas inte om: väck den med `bjud`, som tar en plats på nytt.
   *
   * @param {Record<string, any>} b `{ uid, id }`.
   * @returns {Promise<{ id: string }>}
   */
  async function skickaOm(b) {
    const uid = kravText(b?.uid, "uid", "skickaOm");
    const id = kravText(b?.id, "id", "skickaOm");
    if (!GASTINBJUDNINGSIDFORM.test(id)) throw felMedKod("finns-inte", "skickaOm: id är en hash på 64 hextecken.");
    const rad = await kalla.read(INB, id);
    if (!rad) throw felMedKod("finns-inte", `skickaOm: inbjudan "${id}" finns inte.`);
    await kravForvalta(uid, rad, "skickaOm");
    if (rad.aterkallad !== null) throw felMedKod("aterkallad", `skickaOm: inbjudan "${id}" är återkallad. Bjud in på nytt.`);
    await tagPlats(rad.groupId, gastId(rad.epost));
    const { rad: ny, nyckel } = await roteraNyckel(rad);
    const medlem = await aktivtMedlemskap(uid, rad.groupId);
    await levereraBrev({
      typ: "igen",
      till: ny.epost,
      namn: text(ny.namn),
      lankar: [{ id, nyckel, groupId: ny.groupId, omfang: ny.omfang }],
      skickadAv: { uid, namn: text(medlem?.namn) || text(rad.skapadAv?.namn) },
    });
    return { id };
  }

  /**
   * Gästerna på en händelse, för en medlem, och platserna i gruppen.
   *
   * ⛔ ETT VITLISTAT SVAR (`GASTLISTFALT`): inte `nyckelHash` och inte felräknarna. Medlemmens klient kan läsa raderna direkt (`gastregelfragment`), men en callable ger samma
   * lista utan fälten som inte är till för att visas.
   *
   * @param {Record<string, any>} b `{ uid, handelseId, harRostat? }`. `harRostat` är en lista med `gastId` som appen vet har röstat.
   */
  async function lista(b) {
    const uid = kravText(b?.uid, "uid", "lista");
    const handelseId = kravText(b?.handelseId, "handelseId", "lista");
    const h = await lasHandelse(handelseId, "lista");
    const groupId = text(h.groupId);
    if (!(await aktivtMedlemskap(uid, groupId))) throw felMedKod("ej-behorig", `lista: ${uid} är inte aktiv medlem i gruppen "${groupId}".`);
    const rostat = new Set(Array.isArray(b?.harRostat) ? b.harRostat : []);
    const nu = klocka();
    const rader = (await kalla.list(INB, { where: { groupId } })).filter((r) => r.omfang?.handelseId === handelseId).sort((x, y) => x.skapad - y.skapad);
    const gaster = rader.map((r) => {
      const id = gastId(r.epost);
      /** @type {Record<string, any>} */
      const ut = {};
      const visad = { ...r, gastId: id, status: gastStatus(r, { nu, harRostat: rostat.has(id) }) };
      for (const f of GASTLISTFALT) ut[f] = /** @type {Record<string, any>} */ (visad)[f];
      return ut;
    });
    return { gaster, platser: await platsLage(groupId) };
  }

  /**
   * Platserna i en grupp, för en medlem.
   * @param {Record<string, any>} b `{ uid, groupId }`.
   */
  async function platser(b) {
    const uid = kravText(b?.uid, "uid", "platser");
    const groupId = kravText(b?.groupId, "groupId", "platser");
    if (!(await aktivtMedlemskap(uid, groupId))) throw felMedKod("ej-behorig", `platser: ${uid} är inte aktiv medlem i gruppen "${groupId}".`);
    return platsLage(groupId);
  }

  /**
   * Löser in en länk: nyckeln och adressen stämmer, inbjudan är aktiv och länken har inte gått ut. Svaret är en sessionsnyckel som gästen sparar på enheten.
   *
   * @param {Record<string, any>} b `{ id, nyckel, epost, ip }`.
   * @returns {Promise<{ ok: true, sessionsnyckel: string } | { ok: false, orsak: Gastorsak }>}
   */
  async function los(b) {
    const ipHash = ipId(b?.ip, "los", "los");
    const id = b?.id;
    const nyckel = b?.nyckel;
    // En form som aldrig kan stämma kostar ingenting att svara på. Den räknas mot IP:n ändå: ett skript som skickar skräp är det räknaren finns för.
    const ipRes = await reserveraRaknare(ipHash, { max: GASTIP_MAX, fonsterMs: GASTIP_FONSTER_MS });
    if (!ipRes) return orsak("for-manga");
    if (typeof id !== "string" || !GASTINBJUDNINGSIDFORM.test(id) || typeof nyckel !== "string" || !GASTNYCKELFORM.test(nyckel)) return nej();

    const rad = await kalla.read(INB, id);
    if (!rad) return nej();
    const res = await reservera(INB, id, rad, INBFALT, { max: GASTFEL_MAX, fonsterMs: GASTFEL_FONSTER_MS });
    if (!res) return orsak("for-manga");

    const epost = normaliseraGastepost(b?.epost, extraSparrade);
    // Båda jämförelserna görs alltid, så att tiden inte säger vilken av dem som var fel.
    const nyckelStammer = likaHash(hash(nyckel), rad.nyckelHash);
    const epostStammer = epost !== null && likaHash(hash(epost), hash(text(rad.epost)));
    if (!nyckelStammer || !epostStammer) return nej();

    // Nyckeln och adressen stämde: det här är gästen, eller någon som har allt gästen har. Försöket ges tillbaka, eftersom det inte var en gissning som missade.
    const ge = async () => {
      await aterlamna(INB, id, INBFALT, res.fonster);
      await aterlamna(RAKNARE, ipRes.id, RAKNEFALT, ipRes.fonster);
    };
    if (rad.aterkallad !== null) {
      await ge();
      return orsak("aterkallad");
    }
    if (!(typeof rad.lankGiltigTill === "number" && rad.lankGiltigTill > klocka())) {
      await ge();
      return orsak("utgangen");
    }

    const sessionsnyckel = nyGastnyckel();
    const nu = klocka();
    await skapaNy(SESS, { id: gastnyckelHash(sessionsnyckel), inbjudningId: id, skapad: nu, senast: nu });
    await uppdateraOm(INB, id, { forstInloggad: null }, { forstInloggad: nu });
    await ge();
    return { ok: true, sessionsnyckel };
  }

  /**
   * Prövar en session: den finns, har inte stått oanvänd i `GASTSESSIONSDAGAR` dagar, och dess inbjudan finns och är aktiv. Läser inbjudan på nytt varje gång.
   *
   * @param {Record<string, any>} b `{ sessionsnyckel, krav?: { funktion } }`. `krav` är vad anropet gäller: en inbjudan som inte ger funktionen nekas som en okänd session.
   * @returns {Promise<{ ok: true, gastId: string, inbjudan: { id: string, groupId: string, handelseId: string, funktion: string, namn: string } } | { ok: false, orsak: Gastorsak }>}
   */
  async function session(b) {
    const nyckel = b?.sessionsnyckel;
    if (typeof nyckel !== "string" || !GASTNYCKELFORM.test(nyckel)) return nej();
    const sid = gastnyckelHash(nyckel);
    const s = await kalla.read(SESS, sid);
    if (!s) return nej();
    const nu = klocka();
    if (typeof s.senast !== "number" || nu - s.senast > GASTSESSIONSDAGAR * DYGN_MS) {
      await taBort(SESS, sid);
      return nej();
    }
    const rad = await kalla.read(INB, s.inbjudningId);
    if (!rad) return nej();
    if (rad.aterkallad !== null) return orsak("aterkallad");
    if (b?.krav && b.krav.funktion !== rad.omfang?.funktion) return nej();
    if (nu - s.senast > SESSIONSUPPDATERING_MS) await uppdateraOm(SESS, sid, { senast: s.senast }, { senast: nu });
    return {
      ok: true,
      gastId: gastId(rad.epost),
      inbjudan: { id: rad.id, groupId: rad.groupId, handelseId: rad.omfang.handelseId, funktion: rad.omfang.funktion, namn: text(rad.namn) },
    };
  }

  /**
   * Det gästen ser: sitt namn, funktionen och saken, och inget annat (`GASTSVARSFALT`, och av saken bara `sak.falt`).
   *
   * @param {Record<string, any>} b `{ sessionsnyckel }`.
   */
  async function hamta(b) {
    const s = await session({ sessionsnyckel: b?.sessionsnyckel });
    if (!s.ok) return s;
    const h = await kalla.read(HANDELSER, s.inbjudan.handelseId);
    if (!h || h.arkiverad === true || h.groupId !== s.inbjudan.groupId) return orsak("saknas");
    /** @type {Record<string, any>} */
    const svar = { ok: true, namn: s.inbjudan.namn, funktion: s.inbjudan.funktion };
    if (sak) {
      const bygget = await sak.bygg({ inbjudan: { ...s.inbjudan }, gastId: s.gastId, handelse: h });
      /** @type {Record<string, any>} */
      const ren = {};
      for (const f of sak.falt) if (bygget && Object.hasOwn(bygget, f)) ren[f] = bygget[f];
      svar.sak = ren;
    }
    // ⛔ SISTA SPÄRREN: bara fälten i GASTSVARSFALT lämnar tjänsten, oavsett vad som lagts på ovan.
    return Object.fromEntries(Object.entries(svar).filter(([k]) => /** @type {readonly string[]} */ (GASTSVARSFALT).includes(k)));
  }

  /**
   * Gästens eget namn, för inbjudan som sessionen hör till. Ett tomt namn rensar det.
   *
   * @param {Record<string, any>} b `{ sessionsnyckel, namn }`.
   */
  async function sattNamn(b) {
    const s = await session({ sessionsnyckel: b?.sessionsnyckel });
    if (!s.ok) return s;
    const nytt = text(b?.namn);
    if (nytt.length > MAX_GASTNAMN || /[\u0000-\u001f\u007f]/.test(nytt)) throw felMedKod("ogiltigt-namn", `sattNamn: namnet får vara högst ${MAX_GASTNAMN} tecken och inga styrtecken.`);
    // Villkoret hindrar att ett namn skrivs på en inbjudan som drogs tillbaka mellan sessionsprövningen och skrivningen.
    const { updated } = await uppdateraOm(INB, s.inbjudan.id, { aterkallad: null }, { namn: nytt });
    return updated ? { ok: /** @type {const} */ (true), namn: nytt } : orsak("aterkallad");
  }

  /**
   * Någon ber om en ny länk: de skriver sin adress, och får samma svar hur det än går. Har adressen aktiva inbjudningar roteras deras nycklar och ett brev skickas
   * med högst `GASTNYLANK_MAX_LANKAR` länkar. Högst `GASTNYLANK_BREV_PER_DYGN` brev per adress och dygn, och `GASTNYLANKIP_MAX` förfrågningar per IP och timme.
   *
   * ⛔ SVARET ÄR ALLTID `GASTNYLANK_SVAR`. Ett annat svar för en adress som är gäst hade låtit vem som helst fråga vilka adresser som är det. Ett brev som inte gick att
   * skicka rapporteras (`rapportera`) och syns inte i svaret, av samma skäl.
   *
   * @param {Record<string, any>} b `{ epost, ip }`.
   * @returns {Promise<{ ok: true, svar: string }>}
   */
  async function nyLank(b) {
    const ipHash = ipId(b?.ip, "nyLank", "nylank");
    const svar = { ok: /** @type {const} */ (true), svar: GASTNYLANK_SVAR };
    if (!(await reserveraRaknare(ipHash, { max: GASTNYLANKIP_MAX, fonsterMs: GASTNYLANKIP_FONSTER_MS }))) return svar;
    const epost = normaliseraGastepost(b?.epost, extraSparrade);
    if (epost === null) return svar;
    if (!(await reserveraRaknare(hash(`nylank-epost|${gastId(epost)}`), { max: GASTNYLANK_BREV_PER_DYGN, fonsterMs: DYGN_MS }))) return svar;
    const aktiva = (await kalla.list(INB, { where: { epost } })).filter((r) => r.aterkallad === null).sort((x, y) => y.skapad - x.skapad).slice(0, GASTNYLANK_MAX_LANKAR);
    if (aktiva.length === 0) return svar;
    try {
      const lankar = [];
      for (const r of aktiva) {
        const { rad, nyckel } = await roteraNyckel(r);
        lankar.push({ id: r.id, nyckel, groupId: rad.groupId, omfang: rad.omfang });
      }
      await skicka({ typ: "ny-lank", till: epost, namn: text(aktiva[0].namn), lankar, skickadAv: null });
    } catch (fel) {
      rapportera(fel);
    }
    return svar;
  }

  /**
   * Raderar sessioner som stått oanvända längre än `GASTSESSIONSDAGAR` dagar. Appen kör den som ett schemalagt jobb: sessionerna går ut vid anrop ändå, men en gäst
   * som aldrig kommer tillbaka lämnar en rad kvar.
   *
   * @param {{ gräns?: number }} [b] Högst så många rader per körning. Förval 500.
   * @returns {Promise<{ raderade: number }>}
   */
  async function stadaSessioner(b) {
    const grans = Number.isInteger(b?.gräns) && /** @type {number} */ (b?.gräns) > 0 ? /** @type {number} */ (b?.gräns) : 500;
    const gamla = await kalla.list(SESS, { fore: { falt: "senast", varde: klocka() - GASTSESSIONSDAGAR * DYGN_MS }, limit: grans });
    for (const s of gamla) await taBort(SESS, s.id);
    return { raderade: gamla.length };
  }

  return { bjud, aterkalla, skickaOm, lista, platser, los, session, hamta, sattNamn, nyLank, stadaSessioner };
}
