/**
 * Gäster: en person som bjudits in utan konto (0.131.0, cllp/lifehub.app#389, skiva 1: "en sak", omröstningen först; 0.132.0, skiva 2: hela gruppen).
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
 * ══ ⛔ HELA GRUPPEN (0.132.0): SERVERN LÄSER OCH SVARAR MED VITLISTADE FÄLT, PER ÅTGÄRD ═════════════════════════════════════
 *
 * En inbjudan med omfånget `{ slag: "grupp" }` ger gästen fyra funktioner (`GASTGRUPPFUNKTIONER`): chatt, kalender, bibliotek och, när appen gett `grupp.arenden`, de ärenden som delegerats till just hen (skiva 3: aldrig gruppens ärendelista, som kan bära sådant som inte rör gästen). Varje åtgärd (`chatt`, `kalender`,
 * `skrivChatt`, `handelse`, `svara`, `rosta`, `bibliotek`, `fil`, `arenden`, `kommenteraArende`, `markeraArendeKlart`) börjar med `session` och kravet `{ slag: "grupp", funktion }`, som läser sessionen OCH inbjudan på nytt: en återkallad
 * gäst nekas vid nästa anrop, i varje åtgärd. Gruppen kommer ur inbjudan och aldrig ur anropet. Svaret byggs fält för fält ur listorna i `GASTGRUPPSVARSFALT`: ett helt dokument
 * sprids aldrig ut, och en medlems adress, uid eller namn (utom som avsändarnamn i chatten) har ingen plats i något svar. Gästen når fortfarande bara servern och aldrig Firestore.
 *
 * ⛔ DET SOM ÄR APPENS HÄR: appens fält på en händelse (`grupp.handelseSida`), och omröstningens
 * modell (`grupp.omrostning`: förslagen, rösterna). Ramverket läser dem aldrig själv, och allt som appens `bygg` ger utöver `falt` tas bort innan svaret lämnar tjänsten.
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
  GASTANROP_PER_MINUT,
  GASTARENDE_MAX,
  GASTARENDE_SKANNA_MAX,
  GASTARENDEFALT,
  GASTARENDEKOMMENTARER_MAX,
  GASTARENDEKOMMENTARFALT,
  GASTBIBLIOTEK_MAX,
  GASTBIBLIOTEKFALT,
  GASTCHATT_SIDA,
  GASTCHATTFALT,
  GASTFEL_FONSTER_MS,
  GASTFEL_MAX,
  GASTFELKODER,
  GASTFIL_PER_DYGN,
  GASTSKRIV_MAX_TECKEN,
  GASTSKRIV_PER_MINUT,
  arGastId,
  GASTNAMNLOS,
  GASTGRUPPFUNKTIONER,
  GASTGRUPPSVARSFALT,
  GASTHANDELSEFALT,
  GASTIP_FONSTER_MS,
  GASTIP_MAX,
  GASTKALENDER_MAX,
  GASTKALENDERFALT,
  GASTLANKDAGAR,
  GASTLISTFALT,
  GASTNYCKELFORM,
  GASTNYLANK_BREV_PER_DYGN,
  GASTNYLANKIP_FONSTER_MS,
  GASTNYLANKIP_MAX,
  GASTNYLANK_MAX_LANKAR,
  GASTNYLANK_SVAR,
  GASTPERSONFALT,
  GASTPERSONINBJUDANFALT,
  GASTPLATSNUMMER,
  GASTSESSIONSDAGAR,
  GASTSVARSFALT,
  GASTINBJUDNINGSIDFORM,
  GASTFILFALT,
  GASTIDFORM,
  GASTTIDIGAREMEDLEM,
  GAST_PLATSER_GRATIS,
  MAX_GASTNAMN,
  gastDelegerad,
  gastId,
  gastOmfangGer,
  gastStatus,
  gastomfangsnyckel,
  gastplatsId,
  normaliseraGastepost,
} from "../lib/gast.js";
import { agentId, medlemskapsId } from "../lib/grupp.js";
import { BIBLIOTEKTYPER, trimSomRegeln } from "../lib/bibliotek.js";
import { KLOCKFORM, SVARSVAL, byggSvar, handelsefel, sammanstallSvar } from "../lib/handelsemodell.js";
import { validateGruppkalendrar } from "../lib/kalendrar.js";
import { gruppensRader } from "../lib/katalog.js";
import { NAMNER_ALLA, samtalsnyckel } from "../lib/samtal.js";
import { SIGNERAD_SEKUNDER, delningsTyp } from "../lib/delning.js";
import { delningsDisposition } from "./delning.js";
import { epostFel } from "../lib/mejl.js";

const DYGN_MS = 24 * 60 * 60 * 1000;

/** Hur gammal en plats ska vara innan den får tas tillbaka som övergiven. En plats vars inbjudan skrivs just nu är yngre än så. */
export const PLATSFRIST_MS = 10 * 60 * 1000;

/** Hur ofta en sessions `senast` skrivs om. Ett anrop per minut ska inte vara en skrivning per minut. */
export const SESSIONSUPPDATERING_MS = 60 * 60 * 1000;

/** Samma form som regelfragmentens samlingsnamn: ett namn, inte en sökväg. */
const SAMLINGSFORM = /^[A-Za-z][A-Za-z0-9_-]*$/;
/** Ett ärendes id som en gäst skickar: inga snedstreck, så att ett id aldrig kan bli en annan sökväg. */
const ARENDEIDFORM = /^[A-Za-z0-9_~.-]{1,200}$/;

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
  // gastomfangsnyckel kastar för ett omfång som inte hör hemma (ett grupp med extra fält, en sak utan händelse) INNAN raden byggs.
  gastomfangsnyckel(d.omfang);
  const omfang = d.omfang.slag === "grupp" ? { slag: /** @type {const} */ ("grupp") } : { slag: d.omfang.slag, funktion: d.omfang.funktion, handelseId: d.omfang.handelseId };
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

/**
 * @typedef {object} Gastgrupp Det som slår på omfånget "grupp" (0.132.0). Utelämnad: `bjud` med `slag: "grupp"` kastar `ogiltigt-omfang` och ingen grupp-åtgärd svarar.
 * @property {{ grupper: string, samtal: string, meddelanden: string, bibliotek: string, svar: string, gruppkalendrar?: string }} samlingar
 *   Appens samlingsnamn, inga förval. `samtal` och `meddelanden`: gruppchatten ligger i `<samtal>/<groupId>|grupp/<meddelanden>` (`samtalsnyckel`). `svar`: undersamlingens namn
 *   under en händelse, `<handelser>/<id>/<svar>/<uid>` (som medlemmens, med gästens `g_`-id). `gruppkalendrar` (valfri): gruppens kalendrar, för kalenderlistans `kalendrar`.
 * @property {{ signeradAdress: (b: { sokvag: string, sekunder: number, disposition: string, mime: string }) => Promise<string>, gruppPrefix?: string, postPrefix?: string }} lagring
 *   Som delningens lagring. `gruppPrefix` och `postPrefix` är samma namn som `lagringsregelfragment({ bibliotek })` fick (förval `grupper` och `bibliotek`): en fils sökväg är exakt
 *   `<gruppPrefix>/<groupId>/<postPrefix>/<postId>/<filnamn>` med postens egen grupp och id, annars signeras den aldrig.
 * @property {(handelse: Record<string, any>) => { titel: string, beskrivning?: string, plats?: string }} handelseSida Vilka av appens fält som är titel, beskrivning och plats (som delningens).
 * @property {Gastarenden} [arenden] (Skiva 3) Ärenden som delegerats till en gäst. Utelämnad: ingen ärendeflik och inga ärendeåtgärder (`arenden` svarar `nej`).
 * @property {{ falt: readonly string[], bygg: (arg: { handelse: Record<string, any>, gastId: string, groupId: string }) => Record<string, any> | null | Promise<Record<string, any> | null>,
 *   rosta: (arg: { handelse: Record<string, any>, gastId: string, groupId: string, forslagId: string, val: string }) => { ok: boolean } | Promise<{ ok: boolean }> }} [omrostning]
 *   Omröstningen på ett datum är appens modell. `bygg` ger det en gäst ser (förslag, summor, egna röster) och `falt` är hela listan; `rosta` skriver rösten (appens prövning, samma som en
 *   medlems). Utelämnad: `rosta` svarar `nej` och `handelse` bär ingen `omrostning`. Rösterna tas bort av `radering.roster`.
 */

/**
 * @typedef {object} Gastarenden Appens ärenden för en gäst (skiva 3, cllp/lifehub.app#389). Ramverket väljer VILKA ärenden en gäst rör (radens `mottagare` mot sessionens `gastId`, `gastDelegerad`); appen äger formen.
 * @property {string} samling Appens ärendesamling. Raderna har `groupId` och `mottagare` (`byggArendemottagare`). Ramverket gissar inget samlingsnamn.
 * @property {readonly string[]} falt Hela listan över vad en gäst får se av ett ärende (en delmängd av `GASTARENDEFALT`, utan `id` och `kommentarer`, som ramverket sätter). Allt som `bygg` ger utöver den tas bort.
 * @property {(arg: { rad: Record<string, any>, groupId: string }) => Record<string, any> | null | Promise<Record<string, any> | null>} bygg Väljer ur appens rad: rubrik, text, status, förfallodag. ⛔ ALDRIG ärendets GitHub-adress eller repots namn. `null` hoppar över raden.
 * @property {(arg: { rad: Record<string, any>, groupId: string }) => Array<{ id: string, text: string, tid: number, namn: string, gastId?: string }> | Promise<Array<{ id: string, text: string, tid: number, namn: string, gastId?: string }>>} kommentarer
 *   Ärendets kommentarer i appens modell, som `{ id, text, tid (ms), namn }`; `gastId` sätts på en kommentar en gäst skrivit. ⛔ Aldrig ett uid eller en adress: ramverket tar bara de fälten.
 * @property {(arg: { rad: Record<string, any>, groupId: string, gastId: string, namn: string, text: string }) => { id: string } | Promise<{ id: string }>} kommentera
 *   Skriver gästens kommentar i appens form, med gästen som skapare (aldrig ett medlemsuid) och `gastId` så att `kommentarer` kan märka den. Texten är redan prövad (inte tom, högst `GASTSKRIV_MAX_TECKEN`).
 * @property {(arg: { rad: Record<string, any>, groupId: string, gastId: string, namn: string }) => { ok: boolean } | Promise<{ ok: boolean }>} markeraKlart
 *   Sätter ärendet som hanterat i appens modell (`createCaseModel().buildClose`), med en not som säger att gästen gjorde det. Appen gör det atomärt (`updateIf` på status) och svarar `{ ok: false }` när ärendet inte längre är öppet.
 * @property {(arg: { gastId: string, groupId: string }) => number | void | Promise<number | void>} radera
 *   KRÄVS. Tar bort det som bär gästen på appens ärenden vid radering: gästens kommentarer, och `gastId` och `namn` ur delegeringarna. Svarar hur många ärenden som rörts. En radering som lämnar identiteten kvar är ingen radering.
 */

/**
 * @typedef {object} Gastradering Det som gör att en gästs uppgifter går att radera (0.132.0, CP 2026-10-20: klart före första gruppgästen). KRÄVS när `grupp` finns.
 * @property {string} [svar] Undersamlingens namn för händelsesvar (`<handelser>/<id>/<svar>/<g_-id>`), för en app utan `grupp` (med `grupp` är det `grupp.samlingar.svar`).
 * @property {(arg: { gastId: string, groupId: string }) => void | Promise<void>} [roster] Tar bort gästens röster i gruppen (appens modell). Utan den tas inga röster bort: ge den när appen har omröstning.
 * @property {(arg: { epost: string, gastId: string, grupper: readonly string[], alla: boolean }) => void | Promise<void>} [spar]
 *   Där appen själv sparat adressen (mejlkön, loggar): tas bort vid radering. Ramverket kan inte veta var. `alla`: personens sista inbjudan försvann, inte bara i `grupper`.
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
 * @param {Gastgrupp} [konfig.grupp] (0.132.0) Slår på omfånget "grupp": gästens chatt, kalender, ärenden och bibliotek. Utan den finns bara "en sak".
 * @param {Gastradering} [konfig.radering] (0.132.0) Raderingen av en gästs uppgifter. KRÄVS med `grupp`; utan den kastar `radera` och `raderaMig`.
 * @param {readonly string[]} [konfig.extraSparrade] Appens egna spärrade mejldomäner (`epostFel`).
 * @param {(fel: unknown) => void} [konfig.rapportera] Där ett brev som inte gick att skicka rapporteras när svaret ändå måste vara neutralt (`nyLank`). Förval `console.error`.
 * @param {() => number} [konfig.klocka] Millisekunder. Förval `Date.now`. Provens enda sätt att låta en länk gå ut.
 */
export function createGastService(konfig) {
  /*
   * ⛔ DESTRUKTURERINGEN LIGGER I KROPPEN, av samma skäl som i `createDelningService`: `({ kalla })` i signaturen kastar Nodes "Cannot destructure" innan
   * valideringen hinner köra, och det felet nämner inte fabriken.
   */
  const { kalla, samlingar, farBjuda, skicka, sak, grupp, radering, extraSparrade = [], rapportera = (/** @type {unknown} */ fel) => console.error("createGastService:", fel), klocka = Date.now } = konfig ?? {};
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
  /** @type {null | { samlingar: Record<string, string>, lagring: Gastgrupp["lagring"], gruppPrefix: string, postPrefix: string, handelseSida: Gastgrupp["handelseSida"], arenden?: Gastarenden, omrostning?: Gastgrupp["omrostning"], funktioner: readonly string[] }} */
  let GS = null;
  if (radering !== undefined) {
    if (!radering || typeof radering !== "object") throw new Error(`${namn}: radering är ett objekt (Gastradering), eller utelämnas.`);
    if (radering.svar !== undefined && (typeof radering.svar !== "string" || !SAMLINGSFORM.test(radering.svar))) throw new Error(`${namn}: radering.svar är ett samlingsnamn, eller utelämnas.`);
    for (const f of /** @type {const} */ (["roster", "spar"])) if (radering[f] !== undefined && typeof radering[f] !== "function") throw new Error(`${namn}: radering.${f} är en funktion, eller utelämnas.`);
  }
  if (grupp !== undefined && radering === undefined) {
    throw new Error(`${namn}: radering krävs med grupp. En gäst som läser gruppens chatt och går att bjuda in måste också gå att radera (CP 2026-10-20: klart före första gruppgästen).`);
  }
  if (grupp !== undefined) {
    if (!grupp || typeof grupp !== "object") throw new Error(`${namn}: grupp är ett objekt (Gastgrupp), eller utelämnas.`);
    const gs = grupp.samlingar;
    for (const falt of /** @type {const} */ (["grupper", "samtal", "meddelanden", "bibliotek", "svar"])) {
      if (typeof gs?.[falt] !== "string" || !SAMLINGSFORM.test(gs[falt])) throw new Error(`${namn}: grupp.samlingar.${falt} krävs, ett samlingsnamn. Ramverket känner inte appens samlingsnamn och gissar inget.`);
    }
    if (gs.gruppkalendrar !== undefined && (typeof gs.gruppkalendrar !== "string" || !SAMLINGSFORM.test(gs.gruppkalendrar))) throw new Error(`${namn}: grupp.samlingar.gruppkalendrar är ett samlingsnamn, eller utelämnas.`);
    const gruppnamn = [gs.grupper, gs.samtal, gs.bibliotek, ...(gs.gruppkalendrar ? [gs.gruppkalendrar] : [])];
    if (new Set([...gruppnamn, samlingar.inbjudningar, samlingar.sessioner, samlingar.platser, samlingar.raknare, samlingar.handelser, samlingar.medlemskap ?? "memberships"]).size !== gruppnamn.length + 6) {
      throw new Error(`${namn}: varje samling i grupp.samlingar ska ha sitt eget namn, skilt från de andra gästsamlingarna. Två samlingar med samma namn blandar id:n som inte hör ihop.`);
    }
    if (typeof grupp.lagring?.signeradAdress !== "function") throw new Error(`${namn}: grupp.lagring.signeradAdress krävs. Gästen får aldrig en öppen sökväg, bara en adress som går ut.`);
    if (typeof grupp.handelseSida !== "function") throw new Error(`${namn}: grupp.handelseSida krävs, en funktion som säger vilka av appens fält som är titel, beskrivning och plats.`);
    const prefix = (/** @type {unknown} */ v, /** @type {string} */ fall, /** @type {string} */ falt) => {
      const x = v === undefined ? fall : v;
      if (typeof x !== "string" || !SAMLINGSFORM.test(x)) throw new Error(`${namn}: grupp.lagring.${falt} är ett namn.`);
      return x;
    };
    const gruppPrefix = prefix(grupp.lagring.gruppPrefix, "grupper", "gruppPrefix");
    const postPrefix = prefix(grupp.lagring.postPrefix, "bibliotek", "postPrefix");
    if (grupp.omrostning !== undefined) {
      const o = grupp.omrostning;
      if (!o || typeof o.bygg !== "function" || typeof o.rosta !== "function" || !Array.isArray(o.falt) || o.falt.length === 0 || o.falt.some((/** @type {unknown} */ f) => typeof f !== "string" || f === "")) {
        throw new Error(`${namn}: grupp.omrostning är { falt, bygg, rosta }. Rösterna är appens modell, och falt är hela listan över vad en gäst får se av dem.`);
      }
    }
    if (grupp.arenden !== undefined) {
      const a = grupp.arenden;
      const ok = a && typeof a === "object" && typeof a.samling === "string" && SAMLINGSFORM.test(a.samling);
      if (!ok) throw new Error(`${namn}: grupp.arenden.samling krävs, ett samlingsnamn. Ramverket känner inte appens samlingsnamn och gissar inget.`);
      if (!Array.isArray(a.falt) || a.falt.length === 0 || a.falt.some((/** @type {unknown} */ f) => typeof f !== "string" || f === "" || f === "id" || f === "kommentarer" || f === "fler" || !(/** @type {readonly string[]} */ (GASTARENDEFALT)).includes(/** @type {string} */ (f)))) {
        throw new Error(`${namn}: grupp.arenden.falt är en icke-tom lista ur ${GASTARENDEFALT.filter((f) => f !== "id" && f !== "kommentarer" && f !== "fler").join(", ")}: hela listan över vad en gäst får se av ett ärende.`);
      }
      for (const f of /** @type {const} */ (["bygg", "kommentarer", "kommentera", "markeraKlart", "radera"])) {
        if (typeof a[f] !== "function") throw new Error(`${namn}: grupp.arenden.${f} krävs, en funktion. Ärendets form är appens, och en gäst som får röra ärenden måste också gå att radera (radera).`);
      }
      if (new Set([a.samling, gs.grupper, gs.samtal, gs.bibliotek, ...(gs.gruppkalendrar ? [gs.gruppkalendrar] : []), samlingar.inbjudningar, samlingar.sessioner, samlingar.platser, samlingar.raknare, samlingar.handelser, samlingar.medlemskap ?? "memberships"]).size !== gruppnamn.length + 7) {
        throw new Error(`${namn}: grupp.arenden.samling ska ha ett eget namn, skilt från de andra samlingarna.`);
      }
    }
    GS = {
      samlingar: gs,
      lagring: grupp.lagring,
      gruppPrefix,
      postPrefix,
      handelseSida: grupp.handelseSida,
      arenden: grupp.arenden,
      omrostning: grupp.omrostning,
      // ⛔ FUNKTIONERNA SOM FINNS ÄR DE SOM ÄR KONFIGURERADE. En gruppinbjudan ger fyra, men en ärendeflik utan ärenden bakom sig hade varit en död flik (skiva 3).
      funktioner: GASTGRUPPFUNKTIONER.filter((f) => f !== "arenden" || grupp.arenden !== undefined),
    };
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
    // ⛔ EN GRUPPINBJUDAN HAR INGEN HÄNDELSE ATT PRÖVA APPENS REGEL MOT: bara den som bjöd och en ägare eller admin i gruppen får röra den.
    if (rad.omfang?.slag === "grupp") {
      throw felMedKod("ej-behorig", `${vad}: ${uid} är inte den som bjöd in, och inte admin eller ägare i gruppen. Inbjudan till hela gruppen ändras inte.`);
    }
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
   * Bjuder in en gäst till en omröstning (`{ handelseId }`) eller till hela gruppen (`{ slag: "grupp", groupId }`), eller skickar om och väcker upp en inbjudan som redan finns
   * (samma adress till samma omfång är samma rad).
   *
   * ⛔ HELA GRUPPEN KRÄVER ÄGARE ELLER ADMIN, och regeln är ramverkets och inte en callback (CP 2026-10-20: "Ägare och admin bjuder in till hela gruppen"). En app kan inte släppa in fler:
   * gästen läser gruppens hela chatthistorik, och det är mer än en omröstning. Vill man släppa in fler ändras ramverket, med en ny händelse här.
   *
   * @param {Record<string, any>} b `{ uid, handelseId, epost, namn? }` för en sak, `{ uid, slag: "grupp", groupId, epost, namn? }` för hela gruppen.
   * @returns {Promise<{ id: string, gastId: string, ny: boolean, vackt: boolean }>}
   */
  async function bjud(b) {
    const uid = kravText(b?.uid, "uid", "bjud");
    const grupplage = b?.slag === "grupp";
    if (b?.slag !== undefined && b.slag !== "grupp" && b.slag !== "sak") throw felMedKod("ogiltigt-omfang", `bjud: slaget ${JSON.stringify(b.slag)} finns inte. Giltiga: sak, grupp.`);
    if (grupplage && b?.handelseId !== undefined) throw felMedKod("ogiltigt-omfang", "bjud: en inbjudan till hela gruppen har ingen händelse. Ange antingen handelseId eller slag: \"grupp\".");
    const epost = normaliseraGastepost(b?.epost, extraSparrade);
    // Ordningen i skiva 1: händelsen läses före adressen prövas bara när det är en sak. Ett fel ska vara samma fel som förut.
    const handelseId = grupplage ? "" : kravText(b?.handelseId, "handelseId", "bjud");
    if (epost === null) throw felMedKod("ogiltig-epost", `bjud: ${epostFel(b?.epost, extraSparrade) ?? "adressen går inte att skicka till"}`);
    const gastnamn = text(b?.namn);
    if (gastnamn.length > MAX_GASTNAMN) throw felMedKod("ogiltigt-namn", `bjud: namnet får vara högst ${MAX_GASTNAMN} tecken.`);

    /** @type {string} */
    let groupId;
    /** @type {Record<string, any>} */
    let medlem;
    /** @type {import("../lib/gast.js").Gastomfang} */
    let omfang;
    if (grupplage) {
      if (!GS) throw felMedKod("ogiltigt-omfang", "bjud: gruppgäster är inte påslagna (createGastService fick ingen grupp).");
      groupId = kravText(b?.groupId, "groupId", "bjud");
      const m = await aktivtMedlemskap(uid, groupId);
      if (!m) throw felMedKod("ej-behorig", `bjud: ${uid} är inte aktiv medlem i gruppen "${groupId}" och får inte bjuda in gäster.`);
      if (m.roll !== "agare" && m.roll !== "admin") throw felMedKod("ej-behorig", `bjud: ${uid} är inte ägare eller admin i gruppen "${groupId}". Bara de bjuder in en gäst till hela gruppen.`);
      medlem = m;
      omfang = { slag: "grupp" };
    } else {
      const h = await lasHandelse(handelseId, "bjud");
      groupId = text(h.groupId);
      // ⛔ MEDLEMSKAPET FÖRST, appens regel efter: en callback som släppte in en icke-medlem hade varit en dörr bredvid reglerna.
      const m = await aktivtMedlemskap(uid, groupId);
      if (!m) throw felMedKod("ej-behorig", `bjud: ${uid} är inte aktiv medlem i gruppen "${groupId}" och får inte bjuda in gäster.`);
      if ((await farBjuda({ uid, groupId, medlemskap: m, handelse: h })) !== true) {
        throw felMedKod("ej-behorig", `bjud: ${uid} får inte bjuda in gäster till händelsen "${handelseId}".`);
      }
      medlem = m;
      omfang = { slag: "sak", funktion: "rosta", handelseId };
    }

    const gId = gastId(epost);
    // ⛔ PLATSEN FÖRST: en plats utan inbjudan kostar en plats, en inbjudan utan plats bryter taket. En person tar EN plats oavsett omfång (platsen är nyckad på gästen).
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
    // ⛔ ATT SKICKA OM EN GRUPPINBJUDAN ÄR ATT GE NY ÅTKOMST TILL HELA GRUPPEN, så det kräver ägare eller admin NU. Den som bjöd och sedan blev en vanlig medlem får fortfarande dra tillbaka
    // (en dörr hen öppnat ska hen kunna stänga) men inte öppna den igen.
    if (rad.omfang?.slag === "grupp" && !(await forvaltar(uid, rad.groupId))) {
      throw felMedKod("ej-behorig", `skickaOm: ${uid} är inte ägare eller admin i gruppen. Bara de skickar en gruppinbjudan.`);
    }
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
   * Gästerna på en händelse (`{ uid, handelseId }`) eller i en hel grupp (`{ uid, groupId }`), för en medlem, och platserna i gruppen.
   *
   * ⛔ ETT VITLISTAT SVAR (`GASTLISTFALT`, för grupplistan `GASTPERSONFALT`): inte `nyckelHash` och inte felräknarna. Medlemmens klient kan läsa raderna direkt (`gastregelfragment`), men en callable ger samma
   * lista utan fälten som inte är till för att visas.
   *
   * ⛔ GRUPPLISTAN HAR EN RAD PER PERSON, INTE PER INBJUDAN (0.132.0): en person med en omröstning och hela gruppen är en person, en plats och två inbjudningar under sig. Raden bär `titel`
   * på omröstningarna när appen gett `grupp.handelseSida`.
   *
   * @param {Record<string, any>} b `{ uid, handelseId, harRostat? }` eller `{ uid, groupId, harRostat? }`. `harRostat` är en lista med `gastId` som appen vet har röstat.
   */
  async function lista(b) {
    const uid = kravText(b?.uid, "uid", "lista");
    if (b?.groupId !== undefined && b?.handelseId !== undefined) throw new Error("lista: ange antingen handelseId (en omröstning) eller groupId (hela gruppen), inte båda.");
    const rostat = new Set(Array.isArray(b?.harRostat) ? b.harRostat : []);
    const nu = klocka();
    if (b?.groupId !== undefined) {
      const groupId = kravText(b.groupId, "groupId", "lista");
      if (!(await aktivtMedlemskap(uid, groupId))) throw felMedKod("ej-behorig", `lista: ${uid} är inte aktiv medlem i gruppen "${groupId}".`);
      const alla = (await kalla.list(INB, { where: { groupId } })).sort((x, y) => x.skapad - y.skapad);
      /** @type {Map<string, string>} */
      const titlar = new Map();
      if (GS) {
        for (const hid of new Set(alla.map((r) => r.omfang?.handelseId).filter((x) => typeof x === "string"))) {
          const h = await kalla.read(HANDELSER, hid);
          if (h && h.groupId === groupId) {
            try {
              titlar.set(hid, text(GS.handelseSida(h).titel));
            } catch {
              /* Appens funktion kastade för en trasig händelse: raden står då utan rubrik, och listan faller inte. */
            }
          }
        }
      }
      const ordning = ["har-rostat", "inloggad", "vantar", "utgangen", "aterkallad"];
      /** @type {Map<string, Record<string, any>[]>} */
      const perPerson = new Map();
      for (const r of alla) {
        const id = gastId(r.epost);
        perPerson.set(id, [...(perPerson.get(id) ?? []), r]);
      }
      const personer = [...perPerson.entries()].map(([id, rader]) => {
        const inbjudningar = rader.map((r) => {
          const visad = { ...r, titel: titlar.get(r.omfang?.handelseId) ?? null, status: gastStatus(r, { nu, harRostat: rostat.has(id) }), omfang: r.omfang?.slag === "grupp" ? { slag: "grupp" } : { slag: r.omfang?.slag, funktion: r.omfang?.funktion, handelseId: r.omfang?.handelseId } };
          return Object.fromEntries(GASTPERSONINBJUDANFALT.map((f) => [f, /** @type {Record<string, any>} */ (visad)[f]]));
        });
        const status = inbjudningar.map((i) => i.status).sort((x, y) => ordning.indexOf(x) - ordning.indexOf(y))[0];
        const senaste = rader[rader.length - 1];
        const person = { gastId: id, epost: senaste.epost, namn: text(rader.find((r) => text(r.namn))?.namn), status, inbjudningar };
        return Object.fromEntries(GASTPERSONFALT.map((f) => [f, /** @type {Record<string, any>} */ (person)[f]]));
      });
      return { personer, platser: await platsLage(groupId) };
    }
    const handelseId = kravText(b?.handelseId, "handelseId", "lista");
    const h = await lasHandelse(handelseId, "lista");
    const groupId = text(h.groupId);
    if (!(await aktivtMedlemskap(uid, groupId))) throw felMedKod("ej-behorig", `lista: ${uid} är inte aktiv medlem i gruppen "${groupId}".`);
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
   * @param {Record<string, any>} b `{ sessionsnyckel, krav?: { slag?, funktion } }`. `krav` är vad anropet gäller: en inbjudan som inte ger funktionen (eller inte är av slaget) nekas som en okänd session.
   * @returns {Promise<{ ok: true, gastId: string, inbjudan: { id: string, groupId: string, slag: "sak" | "grupp", handelseId: string | null, funktion: string, namn: string } } | { ok: false, orsak: Gastorsak }>}
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
    // ⛔ KRAVET PRÖVAS MOT OMFÅNGET (`gastOmfangGer`), ETT HEM: en omröstningsgäst ger aldrig en gruppfunktion, och en gruppgäst aldrig `rosta` på en sak.
    if (b?.krav && !gastOmfangGer(rad.omfang, b.krav)) return nej();
    if (nu - s.senast > SESSIONSUPPDATERING_MS) await uppdateraOm(SESS, sid, { senast: s.senast }, { senast: nu });
    const grupplage = rad.omfang?.slag === "grupp";
    return {
      ok: true,
      gastId: gastId(rad.epost),
      inbjudan: {
        id: rad.id,
        groupId: rad.groupId,
        slag: /** @type {"sak" | "grupp"} */ (grupplage ? "grupp" : "sak"),
        handelseId: grupplage ? null : rad.omfang.handelseId,
        funktion: grupplage ? "grupp" : rad.omfang.funktion,
        namn: text(rad.namn),
      },
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
    if (s.inbjudan.slag === "grupp") return hamtaGrupp(s);
    const h = await kalla.read(HANDELSER, /** @type {string} */ (s.inbjudan.handelseId));
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
    // ⛔ GRUPPLÄNKEN KOMMER FÖRST (0.132.0). Brevet bär högst `GASTNYLANK_MAX_LANKAR` länkar, och sorterat på `skapad` ensam kan hela gruppen hamna utanför när personen har fler omröstningar: den inbjudan
    // som ger mest är den som inte får tappas. Därefter nyast först, som förut.
    const aktiva = (await kalla.list(INB, { where: { epost } }))
      .filter((r) => r.aterkallad === null)
      .sort((x, y) => Number(y.omfang?.slag === "grupp") - Number(x.omfang?.slag === "grupp") || y.skapad - x.skapad)
      .slice(0, GASTNYLANK_MAX_LANKAR);
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


  // ══ Hela gruppen (0.132.0) ═════════════════════════════════════════════════════════════════════════════════════════
  //
  // ⛔ ALLA ÅTGÄRDER NEDAN BÖRJAR MED `gruppSession`: sessionen OCH inbjudan läses på nytt, kravet är `{ slag: "grupp", funktion }`, och gruppen kommer ur inbjudan. Anropet bär aldrig
  // ett gruppid som tjänsten litar på. En återkallad gäst får `aterkallad` vid nästa anrop, en omröstningsgäst `nej`.

  const MINUT_MS = 60 * 1000;

  /**
   * Ett objekt med bara de fält som står i listan och finns. ⛔ Det enda sättet ett svar byggs på: fält för fält, aldrig ett dokument som sprids ut.
   * @param {Record<string, any>} obj
   * @param {readonly string[]} falt
   * @returns {Record<string, any>}
   */
  function vitlista(obj, falt) {
    /** @type {Record<string, any>} */
    const ut = {};
    for (const f of falt) if (obj && Object.hasOwn(obj, f) && obj[f] !== undefined) ut[f] = obj[f];
    return ut;
  }

  /**
   * Räknar ett anrop mot inbjudans tak per minut. Räknaren är en rad i `raknare` vars id är hashen av inbjudans id (ingen adress och inget inbjudnings-id i klartext).
   * @param {string} inbjudningsId
   */
  const reserveraAnrop = (inbjudningsId) => reserveraRaknare(hash(`gastanrop|${inbjudningsId}`), { max: GASTANROP_PER_MINUT, fonsterMs: MINUT_MS });

  /**
   * Sessionen för en åtgärd med gruppens funktioner, och anropet räknat. Nekade anrop (okänd session, återkallad, fel slag) kostar ingen räknare.
   * @param {Record<string, any>} b
   * @param {(typeof GASTGRUPPFUNKTIONER)[number]} funktion
   */
  async function gruppSession(b, funktion) {
    if (!GS) return nej();
    const s = await session({ sessionsnyckel: b?.sessionsnyckel, krav: { slag: "grupp", funktion } });
    if (!s.ok) return s;
    if (!(await reserveraAnrop(s.inbjudan.id))) return orsak("for-manga");
    return s;
  }

  /**
   * `hamta` för en gruppinbjudan: gruppens namn och funktionerna, och inget annat.
   * @param {{ gastId: string, inbjudan: { id: string, groupId: string, namn: string } }} s
   */
  async function hamtaGrupp(s) {
    if (!GS) return nej();
    if (!(await reserveraAnrop(s.inbjudan.id))) return orsak("for-manga");
    const g = await kalla.read(GS.samlingar.grupper, s.inbjudan.groupId);
    if (!g) return orsak("saknas");
    const svar = { ok: true, namn: s.inbjudan.namn, funktion: "grupp", grupp: vitlista({ namn: text(g.namn), funktioner: [...GS.funktioner] }, GASTGRUPPSVARSFALT.hamta) };
    return Object.fromEntries(Object.entries(svar).filter(([k]) => /** @type {readonly string[]} */ (GASTSVARSFALT).includes(k)));
  }

  /**
   * @param {string} t
   * @param {number} max
   */
  const kapa = (t, max) => (t.length > max ? `${t.slice(0, max - 1)}…` : t);

  /**
   * Gruppens chatt, hela historiken, en sida åt gången (`GASTCHATT_SIDA`), äldst överst. `fore` (millisekunder) ger sidan före det äldsta gästen läst. `nyast` är en ping:
   * finns inget nyare svarar den `ingetNytt` med en läsning.
   *
   * ⛔ BARA GRUPPENS EGET SAMTAL, byggt ur sessionens grupp (`samtalsnyckel`): aldrig ett privat samtal, aldrig agentens. Agentens egna meddelanden döljs (CP:s beslut 6 stryker Ekonomi,
   * och agenten svarar i gruppchatten med innehåll därifrån). Ett medlemsmeddelande som citerar agenten går inte att filtrera, och ingen påstår något annat. Svar i trådar visas inte än.
   *
   * @param {Record<string, any>} b `{ sessionsnyckel, fore?, nyast? }`.
   */
  async function chatt(b) {
    const s = await gruppSession(b, "chatt");
    if (!s.ok || !GS) return s.ok ? nej() : s;
    for (const f of /** @type {const} */ (["fore", "nyast"])) {
      if (b?.[f] !== undefined && !Number.isFinite(b[f])) throw new Error(`chatt: ${f} är ett tal, millisekunder.`);
    }
    const groupId = s.inbjudan.groupId;
    const vag = `${GS.samlingar.samtal}/${samtalsnyckel({ groupId, slag: "grupp" })}/${GS.samlingar.meddelanden}`;
    if (b?.nyast !== undefined) {
      const [sen] = await kalla.list(vag, { sortBy: "tid", direction: "desc", limit: 1 });
      if (!sen || !(sen.tid > b.nyast)) return { ok: true, meddelanden: [], fler: false, ingetNytt: true };
    }
    const rader = await kalla.list(vag, { sortBy: "tid", direction: "desc", limit: GASTCHATT_SIDA + 1, ...(b?.fore !== undefined ? { fore: { falt: "tid", varde: b.fore } } : {}) });
    const fler = rader.length > GASTCHATT_SIDA;
    const sida = rader.slice(0, GASTCHATT_SIDA).reverse();
    const medlemmar = await kalla.list(MEDLEMSKAP, { where: { groupId } });
    const namnFor = new Map(medlemmar.filter((m) => typeof m.userId === "string").map((m) => [m.userId, text(m.namn)]));
    // En gäst som skrivit bär sitt namn på meddelandet (`avNamn`, satt av `skrivChatt`) eller "Gäst". Märket Gäst härleds ur `av` (`arGastId`) och ingenting annat.
    const gastnamn = new Map(sida.filter((m) => arGastId(m.av)).map((m) => [m.av, text(m.avNamn) || GASTNAMNLOS]));
    const agenter = new Set([agentId(groupId), ...medlemmar.filter((m) => m.typ === "agent" && typeof m.userId === "string").map((m) => m.userId)]);
    /** @param {unknown} uid */
    const namnPa = (uid) => (typeof uid === "string" && (namnFor.get(uid) || gastnamn.get(uid))) || GASTTIDIGAREMEDLEM;
    const meddelanden = sida
      .filter((m) => !agenter.has(m.av))
      .map((m) => {
        const ut = {
          id: m.id,
          av: { namn: namnPa(m.av) },
          text: typeof m.text === "string" ? m.text : "",
          tid: m.tid,
          gast: arGastId(m.av),
          egen: m.av === s.gastId,
        };
        /** @type {Record<string, any>} */
        const extra = {};
        if (Array.isArray(m.namner) && m.namner.length > 0) extra.namner = m.namner.filter((/** @type {unknown} */ x) => typeof x === "string").map((/** @type {string} */ x) => (x === NAMNER_ALLA ? NAMNER_ALLA : namnPa(x)));
        const citerad = typeof m.svarPa === "string" ? sida.find((x) => x.id === m.svarPa) : null;
        if (citerad) extra.svarPa = { id: citerad.id, namn: namnPa(citerad.av), text: kapa(typeof citerad.text === "string" ? citerad.text : "", 140) };
        if (m.bilaga && typeof m.bilaga === "object") extra.bilaga = { namn: text(m.bilaga.namn), typ: text(m.bilaga.typ) };
        return vitlista({ ...ut, ...extra }, GASTCHATTFALT);
      });
    return vitlista({ ok: true, meddelanden, fler }, GASTGRUPPSVARSFALT.chatt);
  }

  /**
   * Gästen skriver ett meddelande i gruppens chatt (0.132.0, CP 2026-10-20: "Gästen får skriva").
   *
   * ⛔ SERVERN SKRIVER, ALDRIG KLIENTEN, OCH ALDRIG SOM EN MEDLEM. Meddelandet får `av` = gästens `g_`-id (inget uid), gästens namn som `avNamn` och inget annat fält: ingen bilaga, inga trådar,
   * inga omnämnanden, inget citat. Märket Gäst härleds ur `av` (`arGastId`) i medlemmarnas chatt, så det kan inte saknas på ett meddelande en gäst skrivit och inte läggas på ett en medlem skrev.
   * En klient kan inte skriva raden: reglernas `av == request.auth.uid` och `hasOnly` nekar ett `g_`-id och ett `avNamn`.
   *
   * ⛔ SAMMA KRAV SOM ATT LÄSA (`chatt`): `gruppSession(b, "chatt")` läser sessionen OCH inbjudan på nytt, så en återkallad eller utgången gäst nekas vid nästa försök, och en omröstningsgäst
   * (som inte har `chatt`) nekas alltid. Texten prövas FÖRE takten, så ett avvisat försök inte kostar ett av de tio meddelandena i minuten.
   *
   * Taket på texten är `GASTSKRIV_MAX_TECKEN` och takten `GASTSKRIV_PER_MINUT` per inbjudan, i `gastraknare` som de andra räknarna (id = hash av `gastskriv|<inbjudan>`). En bilaga kastas
   * tillbaka: #389 stryker uppladdning för gäster.
   *
   * @param {Record<string, any>} b `{ sessionsnyckel, text }`.
   */
  async function skrivChatt(b) {
    const s = await gruppSession(b, "chatt");
    if (!s.ok || !GS) return s.ok ? nej() : s;
    for (const f of ["bilaga", "svarPa", "namner", "av", "tid"]) {
      if (b?.[f] !== undefined) throw felMedKod("ogiltig-text", `skrivChatt: "${f}" kan en gäst inte skicka. En gäst skriver bara text.`);
    }
    const t = typeof b?.text === "string" ? b.text.trim() : "";
    if (t === "") throw felMedKod("ogiltig-text", "skrivChatt: texten är tom.");
    if (t.length > GASTSKRIV_MAX_TECKEN) throw felMedKod("ogiltig-text", `skrivChatt: texten är ${t.length} tecken, taket är ${GASTSKRIV_MAX_TECKEN}.`);
    const takt = await reserveraRaknare(hash(`gastskriv|${s.inbjudan.id}`), { max: GASTSKRIV_PER_MINUT, fonsterMs: MINUT_MS });
    if (!takt) return orsak("for-manga");
    const groupId = s.inbjudan.groupId;
    const vag = `${GS.samlingar.samtal}/${samtalsnyckel({ groupId, slag: "grupp" })}/${GS.samlingar.meddelanden}`;
    const tid = klocka();
    const namn = text(s.inbjudan.namn);
    /** @type {Record<string, any>} */
    const rad = { text: t, av: s.gastId, tid };
    if (namn) rad.avNamn = namn;
    let sparad;
    try {
      sparad = await kalla.create(vag, rad);
    } catch (fel) {
      await aterlamna(RAKNARE, takt.id, RAKNEFALT, takt.fonster);
      throw fel;
    }
    return vitlista(
      { ok: true, meddelande: vitlista({ id: sparad.id, av: { namn: namn || GASTNAMNLOS }, text: t, tid, gast: true, egen: true }, GASTCHATTFALT) },
      GASTGRUPPSVARSFALT.skrivChatt,
    );
  }

  /**
   * En händelse som en gäst får se: i sessionens grupp, inte arkiverad och med en tid som går att läsa (läget "Datum ej satt" tillåtet). Annars `null`, och en annan grupps händelse är
   * samma `null` som en som inte finns.
   *
   * @param {string} groupId
   * @param {unknown} handelseId
   */
  async function gruppHandelse(groupId, handelseId) {
    if (typeof handelseId !== "string" || handelseId === "") return null;
    const h = await kalla.read(HANDELSER, handelseId);
    if (!h || h.arkiverad === true || h.groupId !== groupId || handelsefel(h, { datumEjSatt: true }).length > 0) return null;
    return h;
  }

  /**
   * Händelsen som gästen ser den: ramverkets tidsfält och appens titel, beskrivning och plats (`grupp.handelseSida`). Kastar när appens funktion gör det: den som anropar fångar.
   * @param {Record<string, any>} h
   */
  function handelseUt(h) {
    const sida = /** @type {any} */ (GS).handelseSida(h);
    if (!sida || typeof sida !== "object" || typeof sida.titel !== "string" || sida.titel.trim() === "") {
      throw new Error("handelseSida: funktionen ska svara med { titel, beskrivning?, plats? } där titel är en text som inte är tom.");
    }
    const klockslag = (/** @type {unknown} */ v) => (typeof v === "string" && KLOCKFORM.test(v) ? v : null);
    const heldag = h.heldag === true;
    const ejSatt = h.datum === undefined;
    return vitlista(
      {
        id: h.id,
        titel: sida.titel.trim(),
        beskrivning: text(sida.beskrivning) || null,
        plats: text(sida.plats) || null,
        datum: ejSatt ? null : h.datum,
        slutDatum: typeof h.slutDatum === "string" && typeof h.datum === "string" && h.slutDatum > h.datum ? h.slutDatum : null,
        tid: heldag ? null : klockslag(h.tid),
        slutTid: heldag ? null : klockslag(h.slutTid),
        heldag,
        kalenderId: typeof h.kalenderId === "string" && h.kalenderId ? h.kalenderId : null,
        kravSvar: h.kravSvar === true,
        ejSatt,
      },
      GASTHANDELSEFALT,
    );
  }

  /**
   * Gruppens kalender: alla händelser som inte är arkiverade, högst `GASTKALENDER_MAX`. Frågan kan inte avgränsas på datum: en händelse utan datum (en omröstning som pågår) saknar nyckeln, och
   * Firestore kan inte fråga efter ett fält som saknas. Servern läser därför hela gruppens händelser med tak och filtrerar i minnet, som kalenderflödet. `avkortad` och `ejVisade` (händelser
   * med en tid som inte går att läsa) skrivs alltid ut, också när de är noll.
   *
   * @param {Record<string, any>} b `{ sessionsnyckel }`.
   */
  async function kalender(b) {
    const s = await gruppSession(b, "kalender");
    if (!s.ok || !GS) return s.ok ? nej() : s;
    const groupId = s.inbjudan.groupId;
    const rader = await kalla.list(HANDELSER, { where: { groupId }, limit: GASTKALENDER_MAX + 1 });
    const avkortad = rader.length > GASTKALENDER_MAX;
    let ejVisade = 0;
    /** @type {Record<string, any>[]} */
    const handelser = [];
    for (const h of rader.slice(0, GASTKALENDER_MAX)) {
      if (h.arkiverad === true) continue;
      if (handelsefel(h, { datumEjSatt: true }).length > 0) {
        ejVisade++;
        continue;
      }
      try {
        handelser.push(handelseUt(h));
      } catch {
        ejVisade++;
      }
    }
    handelser.sort((x, y) => (x.datum ?? "9999") .localeCompare(y.datum ?? "9999") || String(x.tid ?? "").localeCompare(String(y.tid ?? "")) || String(x.id).localeCompare(String(y.id)));
    /** @type {Record<string, any>[]} */
    let kalendrar = [];
    if (GS.samlingar.gruppkalendrar) {
      const krader = await kalla.list(GS.samlingar.gruppkalendrar, { where: { groupId } });
      kalendrar = validateGruppkalendrar(gruppensRader(krader, { groupId }).rader)
        .filter((k) => !k.arkiverad)
        .map((k) => vitlista({ id: k.id, namn: typeof k.namn === "string" ? k.namn : text(k.namn?.sv) || text(k.namn?.en) || String(k.id), farg: k.farg }, GASTKALENDERFALT));
    }
    return vitlista({ ok: true, handelser, kalendrar, avkortad, ejVisade }, GASTGRUPPSVARSFALT.kalender);
  }

  /** @param {string} handelseId */
  const svarVag = (handelseId) => `${HANDELSER}/${handelseId}/${/** @type {any} */ (GS).samlingar.svar}`;

  /**
   * Händelsen i detalj: fälten, och när den ber om svar summorna och gästens eget svar (aldrig namn på de som svarat). Summan räknar gruppens aktiva personer och aktiva gäster
   * som en och samma mängd (`sammanstallSvar`), så "har inte svarat" stämmer med det medlemmen ser.
   *
   * @param {Record<string, any>} b `{ sessionsnyckel, handelseId }`.
   */
  async function handelse(b) {
    const s = await gruppSession(b, "kalender");
    if (!s.ok || !GS) return s.ok ? nej() : s;
    const groupId = s.inbjudan.groupId;
    const h = await gruppHandelse(groupId, b?.handelseId);
    if (!h) return orsak("saknas");
    /** @type {Record<string, any>} */
    const svar = { ok: true, handelse: handelseUt(h) };
    if (h.kravSvar === true) {
      const rader = await kalla.list(svarVag(h.id));
      const medlemmar = await kalla.list(MEDLEMSKAP, { where: { groupId } });
      const personer = medlemmar.filter((m) => m.status === "aktiv" && m.typ !== "agent" && typeof m.userId === "string").map((m) => m.userId);
      const gaster = (await kalla.list(INB, { where: { groupId } })).filter((r) => r.aterkallad === null).map((r) => gastId(r.epost));
      const summa = sammanstallSvar(rader, [...personer, ...new Set(gaster)]);
      const mitt = rader.find((r) => r.id === s.gastId)?.svar;
      svar.svar = { kommer: summa.kommer, kommerInte: summa.kommerInte, ejSvarat: summa.ejSvarat, text: summa.text, mitt: mitt === "kommer" || mitt === "kommerInte" ? mitt : null };
    }
    if (GS.omrostning) {
      const bygget = await GS.omrostning.bygg({ handelse: { ...h }, gastId: s.gastId, groupId });
      if (bygget && typeof bygget === "object") svar.omrostning = vitlista(bygget, GS.omrostning.falt);
    }
    return vitlista(svar, GASTGRUPPSVARSFALT.handelse);
  }

  /**
   * Gästen svarar Kommer eller Kommer inte på en händelse som ber om svar. Raden är medlemmens form (`byggSvar`) med gästens `g_`-id: ingen klient kan skriva den raden (medlemsregeln
   * kräver `request.auth.uid == uid`), bara servern.
   *
   * ⛔ SAMMA VILLKOR SOM REGELN FÖR EN MEDLEM: händelsen finns i gruppen, är inte arkiverad, och har `kravSvar`.
   *
   * @param {Record<string, any>} b `{ sessionsnyckel, handelseId, val }`.
   */
  async function svara(b) {
    const s = await gruppSession(b, "kalender");
    if (!s.ok || !GS) return s.ok ? nej() : s;
    if (!(/** @type {readonly unknown[]} */ (SVARSVAL)).includes(b?.val)) throw new Error(`svara: val är ${SVARSVAL.join(" eller ")}.`);
    const h = await gruppHandelse(s.inbjudan.groupId, b?.handelseId);
    if (!h || h.kravSvar !== true) return orsak("saknas");
    await kalla.create(svarVag(h.id), { id: s.gastId, ...byggSvar(b.val) });
    return { ok: true };
  }

  /**
   * Gästen röstar på ett datum. Omröstningens modell är appens (`grupp.omrostning.rosta`, samma prövning som en medlems röst); ramverket prövar sessionen, att händelsen finns i gruppen och
   * att anropet har former. Utan `grupp.omrostning` är svaret `nej`.
   *
   * @param {Record<string, any>} b `{ sessionsnyckel, handelseId, forslagId, val }`.
   */
  async function rosta(b) {
    const s = await gruppSession(b, "kalender");
    if (!s.ok || !GS) return s.ok ? nej() : s;
    if (!GS.omrostning) return nej();
    if (typeof b?.forslagId !== "string" || b.forslagId === "" || typeof b?.val !== "string" || b.val === "") throw new Error("rosta: forslagId och val är texter som inte är tomma.");
    const h = await gruppHandelse(s.inbjudan.groupId, b?.handelseId);
    if (!h) return orsak("saknas");
    const r = await GS.omrostning.rosta({ handelse: { ...h }, gastId: s.gastId, groupId: s.inbjudan.groupId, forslagId: b.forslagId, val: b.val });
    return r && r.ok === true ? { ok: true } : nej();
  }

  // ── Ärenden delegerade till gästen (skiva 3) ──────────────────────────────────────────────────────────────────────

  /**
   * Ett ärende som den här gästen är ansvarig för, eller `null`. ⛔ ETT ENDA SVAR FÖR "FINNS INTE", "ANNAN GRUPP" OCH "INTE DELEGERAT TILL DIG": en gäst som gissar ett id lär sig ingenting av skillnaden.
   * Urvalet är radens egen `mottagare` mot sessionens `gastId` (`gastDelegerad`), varje gång: ingen separat lista, inget som vyn skickar.
   *
   * @param {{ gastId: string, inbjudan: { groupId: string } }} s
   * @param {unknown} arendeId
   * @returns {Promise<Record<string, any> | null>}
   */
  async function gastensArende(s, arendeId) {
    if (!GS?.arenden || typeof arendeId !== "string" || !ARENDEIDFORM.test(arendeId)) return null;
    const rad = await kalla.read(GS.arenden.samling, arendeId);
    return rad && rad.groupId === s.inbjudan.groupId && gastDelegerad(rad.mottagare, s.gastId) ? rad : null;
  }

  /**
   * Gästens ärenden: bara de som delegerats till hen, med rubrik, text, status, förfallodag och kommentarer (`GASTARENDEFALT`). Gruppens övriga ärenden, ärendets GitHub-adress och allt annat appen har på raden lämnar
   * aldrig servern. Tom lista är ett svar (`poster: []`): gästen har inga, och vyn visar då ingen ärendeflik.
   *
   * ⛔ GRUPPSESSIONEN LÄSER INBJUDAN PÅ NYTT, så en återkallad gäst nekas här som i varje annan åtgärd och ärendena försvinner ur hens vy. Delegeringen på ärendet rörs inte: medlemmarna ser den kvar.
   *
   * @param {Record<string, any>} b `{ sessionsnyckel }`.
   */
  async function arenden(b) {
    const s = await gruppSession(b, "arenden");
    if (!s.ok || !GS?.arenden) return s.ok ? nej() : s;
    const a = GS.arenden;
    const groupId = s.inbjudan.groupId;
    const rader = await kalla.list(a.samling, { where: { groupId }, limit: GASTARENDE_SKANNA_MAX + 1 });
    const avkortad = rader.length > GASTARENDE_SKANNA_MAX;
    const egna = rader
      .slice(0, GASTARENDE_SKANNA_MAX)
      .filter((r) => r.groupId === groupId && gastDelegerad(r.mottagare, s.gastId))
      .sort((x, y) => Number(y.status === "ny") - Number(x.status === "ny") || String(y.skapad ?? "").localeCompare(String(x.skapad ?? "")) || String(x.id).localeCompare(String(y.id)))
      .slice(0, GASTARENDE_MAX);
    /** @type {Record<string, any>[]} */
    const poster = [];
    for (const rad of egna) {
      const ut = await a.bygg({ rad: { ...rad }, groupId });
      if (!ut || typeof ut !== "object") continue;
      const alla = (await a.kommentarer({ rad: { ...rad }, groupId })).slice().sort((x, y) => x.tid - y.tid || String(x.id).localeCompare(String(y.id)));
      const senaste = alla.slice(-GASTARENDEKOMMENTARER_MAX);
      poster.push(
        vitlista(
          { ...vitlista(ut, a.falt), id: rad.id, kommentarer: senaste.map((k) => arendekommentar(k, s.gastId)), ...(alla.length > senaste.length ? { fler: true } : {}) },
          GASTARENDEFALT,
        ),
      );
    }
    return vitlista({ ok: true, poster, avkortad }, GASTGRUPPSVARSFALT.arenden);
  }

  /**
   * En kommentar som en gäst ser den: bara text, tid och ett namn (aldrig ett uid eller en adress). `gast` härleds ur `gastId` (`arGastId`) och `egen` ur sessionen, som chattens.
   * @param {{ id: string, text: string, tid: number, namn: string, gastId?: string }} k
   * @param {string} gId
   */
  function arendekommentar(k, gId) {
    const gast = arGastId(k.gastId);
    return vitlista({ id: k.id, text: typeof k.text === "string" ? k.text : "", tid: k.tid, av: { namn: text(k.namn) || (gast ? GASTNAMNLOS : GASTTIDIGAREMEDLEM) }, gast, egen: gast && k.gastId === gId }, GASTARENDEKOMMENTARFALT);
  }

  /**
   * Gästen kommenterar ett ärende som är delegerat till hen. Texten har chattens tak och takt (`GASTSKRIV_MAX_TECKEN`, `GASTSKRIV_PER_MINUT`, SAMMA räknare som chattens skrivning: en gäst har en takt för allt hen skriver),
   * och ingen bilaga, inga omnämnanden och inget citat. Appen skriver kommentaren i sin form (`grupp.arenden.kommentera`) med gästen som skapare.
   *
   * ⛔ ÄRENDET PRÖVAS FÖRE TAKTEN, och texten också: ett nej på ett ärende som inte är gästens kostar inget av de tio skrivningarna i minuten. Sessionen prövas på nytt (`gruppSession`), så en återkallad gäst nekas.
   *
   * @param {Record<string, any>} b `{ sessionsnyckel, arendeId, text }`.
   */
  async function kommenteraArende(b) {
    const s = await gruppSession(b, "arenden");
    if (!s.ok || !GS?.arenden) return s.ok ? nej() : s;
    for (const f of ["bilaga", "svarPa", "namner", "av", "tid", "namn", "gastId"]) {
      if (b?.[f] !== undefined) throw felMedKod("ogiltig-text", `kommenteraArende: "${f}" kan en gäst inte skicka. En gäst skriver bara text.`);
    }
    const rad = await gastensArende(s, b?.arendeId);
    if (!rad) return nej();
    const t = typeof b?.text === "string" ? b.text.trim() : "";
    if (t === "") throw felMedKod("ogiltig-text", "kommenteraArende: texten är tom.");
    if (t.length > GASTSKRIV_MAX_TECKEN) throw felMedKod("ogiltig-text", `kommenteraArende: texten är ${t.length} tecken, taket är ${GASTSKRIV_MAX_TECKEN}.`);
    const takt = await reserveraRaknare(hash(`gastskriv|${s.inbjudan.id}`), { max: GASTSKRIV_PER_MINUT, fonsterMs: MINUT_MS });
    if (!takt) return orsak("for-manga");
    const namn = text(s.inbjudan.namn);
    let sparad;
    try {
      sparad = await GS.arenden.kommentera({ rad: { ...rad }, groupId: s.inbjudan.groupId, gastId: s.gastId, namn: namn || GASTNAMNLOS, text: t });
    } catch (fel) {
      await aterlamna(RAKNARE, takt.id, RAKNEFALT, takt.fonster);
      throw fel;
    }
    return vitlista(
      { ok: true, kommentar: arendekommentar({ id: sparad.id, text: t, tid: klocka(), namn: namn || GASTNAMNLOS, gastId: s.gastId }, s.gastId) },
      GASTGRUPPSVARSFALT.kommenteraArende,
    );
  }

  /**
   * Gästen markerar ett ärende hen är ansvarig för som klart. Appen avgör hur (`grupp.arenden.markeraKlart`, atomärt på status); ramverket prövar sessionen och att ärendet är gästens, och svarar `nej` när
   * appen säger att ärendet inte längre är öppet. En gäst kan inte öppna det igen.
   *
   * @param {Record<string, any>} b `{ sessionsnyckel, arendeId }`.
   */
  async function markeraArendeKlart(b) {
    const s = await gruppSession(b, "arenden");
    if (!s.ok || !GS?.arenden) return s.ok ? nej() : s;
    const rad = await gastensArende(s, b?.arendeId);
    if (!rad) return nej();
    const r = await GS.arenden.markeraKlart({ rad: { ...rad }, groupId: s.inbjudan.groupId, gastId: s.gastId, namn: text(s.inbjudan.namn) || GASTNAMNLOS });
    return r && r.ok === true ? { ok: true } : nej();
  }

  /**
   * Gäster med en levande gruppinbjudan i gruppen, för en aktiv medlem: `{ gastId, namn }` och inget annat (ingen adress, ingen status, ingen nyckel). Det är listan appen delegerar mot (`byggGastMottagare`)
   * och som medlemmarnas rad läser "inbjudan återkallad" ur (`tolkaGastMottagare`): en gäst som saknas här har ingen levande inbjudan.
   *
   * ⛔ ALLA AKTIVA MEDLEMMAR FÅR LISTAN OCH INTE BARA DEM SOM FÅR BJUDA IN. Namnen är redan synliga för gruppen i chatten (märket Gäst), och raden "återkallad" ska kunna ritas för varje medlem som ser ärendet.
   * Vem som får VÄLJA en gäst som ansvarig är appens regel för utdelning: ramverket ger bara underlaget.
   *
   * @param {Record<string, any>} b `{ uid, groupId }`.
   * @returns {Promise<{ gaster: Array<{ gastId: string, namn: string }> }>}
   */
  async function levandeGaster(b) {
    const uid = kravText(b?.uid, "uid", "levandeGaster");
    const groupId = kravText(b?.groupId, "groupId", "levandeGaster");
    if (!(await aktivtMedlemskap(uid, groupId))) throw felMedKod("ej-behorig", `levandeGaster: ${uid} är inte aktiv medlem i gruppen "${groupId}".`);
    const rader = (await kalla.list(INB, { where: { groupId } })).filter((r) => r.omfang?.slag === "grupp" && r.aterkallad === null).sort((x, y) => x.skapad - y.skapad);
    /** @type {Map<string, string>} */
    const per = new Map();
    for (const r of rader) {
      const id = gastIdEllerNull(r);
      if (!id) continue;
      per.set(id, text(r.namn) || per.get(id) || "");
    }
    return { gaster: [...per.entries()].map(([id, namn]) => ({ gastId: id, namn: namn || GASTNAMNLOS })) };
  }

  /** @param {unknown} v @returns {string[]} */
  const strangar = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);

  /**
   * Gruppens bibliotek: posterna i gruppens egen plats (`groupId` är exakt gruppen, aldrig `handelse~...`, `arende~...` eller `mitt~...`), högst `GASTBIBLIOTEK_MAX`.
   * ⛔ `fil.sokvag` I SVARET ÄR POSTENS ID och ingen lagringssökväg: den riktiga sökvägen lämnar aldrig servern, och `fil` är det enda som signerar.
   *
   * @param {Record<string, any>} b `{ sessionsnyckel }`.
   */
  async function bibliotek(b) {
    const s = await gruppSession(b, "bibliotek");
    if (!s.ok || !GS) return s.ok ? nej() : s;
    const groupId = s.inbjudan.groupId;
    const rader = await kalla.list(GS.samlingar.bibliotek, { where: { groupId }, limit: GASTBIBLIOTEK_MAX + 1 });
    const avkortad = rader.length > GASTBIBLIOTEK_MAX;
    const poster = rader
      .slice(0, GASTBIBLIOTEK_MAX)
      .filter((p) => p.groupId === groupId && /** @type {readonly unknown[]} */ (BIBLIOTEKTYPER).includes(p.typ))
      .sort((x, y) => (y.skapad ?? 0) - (x.skapad ?? 0) || String(x.id).localeCompare(String(y.id)))
      .map((p) => {
        /** @type {Record<string, any>} */
        const ut = { id: p.id, typ: p.typ, rubrik: trimSomRegeln(p.rubrik), skapad: p.skapad, andrad: p.andrad, skapadAvNamn: text(p.skapadAv?.namn) };
        if (p.typ === "anteckning" && typeof p.text === "string") ut.text = p.text;
        if (p.typ === "lank") {
          if (typeof p.url === "string") ut.url = p.url;
          if (typeof p.kalla === "string") ut.kalla = p.kalla;
          if (typeof p.bild === "string") ut.bild = p.bild;
        }
        if (p.typ === "lista") ut.poster = strangar(p.poster);
        if (p.typ === "fil" && p.fil && typeof p.fil === "object") {
          ut.fil = vitlista({ sokvag: p.id, namn: text(p.fil.namn), mime: text(p.fil.mime), byte: Number.isInteger(p.fil.byte) ? p.fil.byte : null, klar: p.fil.klar !== false }, GASTFILFALT);
          if (typeof p.utskrift === "string") ut.utskrift = p.utskrift;
          if (Number.isInteger(p.durationMs)) ut.durationMs = p.durationMs;
          if (typeof p.peaks === "string") ut.peaks = p.peaks;
        }
        const taggar = strangar(p.taggar);
        if (taggar.length > 0) ut.taggar = taggar;
        return vitlista(ut, GASTBIBLIOTEKFALT);
      });
    return vitlista({ ok: true, poster, avkortad }, GASTGRUPPSVARSFALT.bibliotek);
  }

  /**
   * Är posten en färdig fil i gruppens egen plats, med lagringssökvägen exakt som lagringsreglerna kräver? ⛔ Fem segment: `<gruppPrefix>/<groupId>/<postPrefix>/<postId>/<filnamn>`, med
   * postens EGEN grupp och id. En post som pekar på någon annans fil (en medlem som skrivit en annan sökväg) signeras aldrig.
   *
   * @param {Record<string, any> | null} post
   * @param {string} groupId
   */
  function arGruppFil(post, groupId) {
    if (!post || !GS || post.groupId !== groupId || post.typ !== "fil" || typeof post.id !== "string" || !post.fil || typeof post.fil.sokvag !== "string") return false;
    if (post.fil.klar === false) return false;
    const seg = post.fil.sokvag.split("/");
    if (post.fil.sokvag.includes("\\") || seg.length !== 5 || seg.some((/** @type {string} */ x) => x === "" || x === "." || x === "..")) return false;
    return seg[0] === GS.gruppPrefix && seg[1] === groupId && seg[2] === GS.postPrefix && seg[3] === post.id;
  }

  /**
   * En signerad adress till en fil i gruppens bibliotek, giltig `SIGNERAD_SEKUNDER` sekunder. Högst `GASTFIL_PER_DYGN` filer per inbjudan och dygn: trafiken ut ur lagringen är det enda en
   * gäst kan driva upp. Försöket räknas FÖRE signeringen och ges tillbaka om signeringen faller. Filer som visas (bild, ljud, video, PDF) öppnas inline, övriga hämtas (`attachment`
   * med ett rensat filnamn), om inte anropet säger `bifoga`.
   *
   * ⛔ EN ADRESS ÄR ETT BÄRARBEVIS I `SIGNERAD_SEKUNDER` SEKUNDER. En gäst som dras tillbaka kan öppna en redan utfärdad adress i högst så lång tid, men får ingen ny: nästa `fil` ger `aterkallad`.
   *
   * @param {Record<string, any>} b `{ sessionsnyckel, postId, bifoga? }`.
   */
  async function fil(b) {
    const s = await gruppSession(b, "bibliotek");
    if (!s.ok || !GS) return s.ok ? nej() : s;
    const groupId = s.inbjudan.groupId;
    const postId = typeof b?.postId === "string" ? b.postId : "";
    if (!postId) return orsak("saknas");
    const post = await kalla.read(GS.samlingar.bibliotek, postId);
    if (!arGruppFil(post, groupId)) return orsak("saknas");
    const rakn = await reserveraRaknare(hash(`gastfil|${s.inbjudan.id}`), { max: GASTFIL_PER_DYGN, fonsterMs: DYGN_MS });
    if (!rakn) return orsak("for-manga");
    const filnamn = text(post?.fil.namn);
    const mime = text(post?.fil.mime);
    const visas = ["bild", "ljud", "video", "pdf"].includes(delningsTyp(mime));
    const bifoga = b?.bifoga === true || (b?.bifoga === undefined && !visas);
    try {
      const url = await GS.lagring.signeradAdress({ sokvag: post?.fil.sokvag, sekunder: SIGNERAD_SEKUNDER, disposition: delningsDisposition(filnamn, bifoga), mime });
      return vitlista({ ok: true, url, namn: filnamn, mime }, GASTGRUPPSVARSFALT.fil);
    } catch (fel) {
      await aterlamna(RAKNARE, rakn.id, RAKNEFALT, rakn.fonster);
      throw fel;
    }
  }

  // ── Återkalla, ersätt och radera ─────────────────────────────────────────────────────────────────────────────────

  /**
   * @param {Record<string, any>} r
   * @returns {string | null}
   */
  function gastIdEllerNull(r) {
    try {
      return gastId(r.epost);
    } catch {
      return null;
    }
  }

  /**
   * Drar tillbaka ALLA en persons inbjudningar i en grupp i ett anrop (en omröstning och hela gruppen), idempotent. Platsen släpps när ingen är aktiv. `groupId` står i villkoret: en
   * annan grupps inbjudningar till samma person rörs aldrig. Den som anropar måste få dra tillbaka VAR och en av raderna (`kravForvalta`): saknas rätt på en rad ändras ingen.
   *
   * @param {Record<string, any>} b `{ uid, groupId, gastId }`.
   * @returns {Promise<{ aterkallade: number, platsSlappt: boolean }>}
   */
  async function aterkallaAlla(b) {
    const uid = kravText(b?.uid, "uid", "aterkallaAlla");
    const groupId = kravText(b?.groupId, "groupId", "aterkallaAlla");
    const gId = kravText(b?.gastId, "gastId", "aterkallaAlla");
    if (!GASTIDFORM.test(gId)) throw felMedKod("finns-inte", "aterkallaAlla: gastId har formen g_ och 40 hextecken.");
    const rader = (await kalla.list(INB, { where: { groupId } })).filter((r) => gastIdEllerNull(r) === gId);
    if (rader.length === 0) throw felMedKod("finns-inte", `aterkallaAlla: gästen har inga inbjudningar i gruppen "${groupId}".`);
    for (const r of rader) await kravForvalta(uid, r, "aterkallaAlla");
    let aterkallade = 0;
    for (const r of rader) {
      if (r.aterkallad !== null) continue;
      const { updated } = await uppdateraOm(INB, r.id, { aterkallad: null }, { aterkallad: klocka() });
      if (updated) aterkallade++;
    }
    const platsSlappt = await slappPlatsOmTom(groupId, rader[0].epost);
    return { aterkallade, platsSlappt };
  }

  /**
   * En gäst har blivit medlem i gruppen (appens växling, efter en verifierad adress): personens gästinbjudningar DÄR dras tillbaka och platsen släpps. Gästens röster och svar står kvar men
   * räknas inte (bara aktiva gäster räknas, som för en medlem som lämnat), så personen röstar om som medlem.
   *
   * ⛔ ANROPAS BARA AV APPENS SERVERKOD EFTER EN VERIFIERAD ADRESS, aldrig av en klient: ingen uid prövas här, och en callable som släppte igenom anropet hade låtit vem som helst dra tillbaka någons
   * gästinbjudan. Bara den grupp personen blev medlem i rörs.
   *
   * @param {Record<string, any>} b `{ epost, groupId }`.
   * @returns {Promise<{ aterkallade: number, platsSlappt: boolean }>}
   */
  async function ersattAvMedlem(b) {
    const epost = normaliseraGastepost(b?.epost, extraSparrade);
    if (epost === null) throw felMedKod("ogiltig-epost", "ersattAvMedlem: adressen går inte att skicka till.");
    const groupId = kravText(b?.groupId, "groupId", "ersattAvMedlem");
    const rader = (await kalla.list(INB, { where: { epost } })).filter((r) => r.groupId === groupId);
    let aterkallade = 0;
    for (const r of rader) {
      if (r.aterkallad !== null) continue;
      const { updated } = await uppdateraOm(INB, r.id, { aterkallad: null }, { aterkallad: klocka() });
      if (updated) aterkallade++;
    }
    const platsSlappt = rader.length > 0 ? await slappPlatsOmTom(groupId, epost) : false;
    return { aterkallade, platsSlappt };
  }

  /**
   * Tar bort gästens egna chattmeddelanden i gruppen (`av` = gästens `g_`-id), med namnet de bär. ⛔ En gäst som raderas ska inte lämna sitt namn kvar i gruppens historik: meddelandet är gästens
   * uppgift lika mycket som adressen. Ett citat som pekar på ett borttaget meddelande visas utan citatet.
   * @param {string} groupId
   * @param {string} gId
   * @returns {Promise<number>}
   */
  async function raderaMeddelanden(groupId, gId) {
    if (!GS) return 0;
    const vag = `${GS.samlingar.samtal}/${samtalsnyckel({ groupId, slag: "grupp" })}/${GS.samlingar.meddelanden}`;
    let n = 0;
    for (const m of await kalla.list(vag, { where: { av: gId } })) {
      await taBort(vag, m.id);
      n++;
    }
    return n;
  }

  /**
   * Tar bort gästens svar på gruppens händelser (`<handelser>/<id>/<svar>/<g_-id>`). ⛔ KASTAR när gruppen har fler händelser än taket: en radering som inte kan lova att ha sett allt
   * ska inte säga att den är klar.
   * @param {string} groupId
   * @param {string} gId
   */
  async function raderaSvar(groupId, gId) {
    const svarNamn = GS?.samlingar.svar ?? radering?.svar;
    if (!svarNamn) return 0;
    const TAK = 20000;
    const handelser = await kalla.list(HANDELSER, { where: { groupId }, limit: TAK + 1 });
    if (handelser.length > TAK) throw new Error(`radera: gruppen har fler än ${TAK} händelser, och svaren går inte att söka igenom på ett säkert sätt. Raderingen avbröts utan att något raderades av svaren.`);
    let n = 0;
    for (let i = 0; i < handelser.length; i += 25) {
      await Promise.all(
        handelser.slice(i, i + 25).map(async (h) => {
          const vag = `${HANDELSER}/${h.id}/${svarNamn}`;
          if (await kalla.read(vag, gId)) {
            await taBort(vag, gId);
            n++;
          }
        }),
      );
    }
    return n;
  }

  /**
   * Raderar en persons uppgifter: inbjudningarna, sessionerna, räknarna, rösterna och svaren, platserna och appens egna kopior av adressen.
   *
   * ⛔ INBJUDNINGARNA TAS BORT SIST. De är det som visar vad som återstår att radera (sessionerna pekar på dem, räknarnas id härleds ur dem), så en radering som dör på vägen går att köra om.
   * ⛔ ALLT SOM BÄR ADRESSEN ELLER DEN HÄRLEDDA IDENTITETEN SKA BORT. Kvar blir bara räknare per IP (en hash av en IP och inget av personen) och det som aldrig hört till personen.
   *
   * @param {{ epost: string, grupper: readonly string[] | null }} d `grupper: null` är alla personens grupper.
   */
  async function raderaUppgifter(d) {
    if (!radering) throw new Error("radera: createGastService fick ingen radering. Utan den går en gästs uppgifter inte att ta bort, och tjänsten gör det därför inte till hälften.");
    const gId = gastId(d.epost);
    const alla = await kalla.list(INB, { where: { epost: d.epost } });
    const rader = d.grupper ? alla.filter((r) => /** @type {readonly string[]} */ (d.grupper).includes(r.groupId)) : alla;
    const berorda = [...new Set(rader.map((r) => String(r.groupId)))];
    let roster = 0;
    let meddelanden = 0;
    let arendenRorda = 0;
    for (const g of berorda) {
      roster += await raderaSvar(g, gId);
      meddelanden += await raderaMeddelanden(g, gId);
      // (Skiva 3) Det som bär gästen på appens ärenden: kommentarerna gästen skrev, och gästens id och namn på delegeringarna. Appens ärendeform, så appen tar bort det (`grupp.arenden.radera`).
      if (GS?.arenden) arendenRorda += Number(await GS.arenden.radera({ gastId: gId, groupId: g })) || 0;
      if (radering.roster) await radering.roster({ gastId: gId, groupId: g });
    }
    let sessioner = 0;
    for (const r of rader) {
      for (const sr of await kalla.list(SESS, { where: { inbjudningId: r.id } })) {
        await taBort(SESS, sr.id);
        sessioner++;
      }
      for (const slag of ["gastanrop", "gastfil", "gastskriv"]) {
        const rid = hash(`${slag}|${r.id}`);
        if (await kalla.read(RAKNARE, rid)) await taBort(RAKNARE, rid);
      }
    }
    const allaBort = alla.length === rader.length;
    if (allaBort) {
      const nid = hash(`nylank-epost|${gId}`);
      if (await kalla.read(RAKNARE, nid)) await taBort(RAKNARE, nid);
    }
    if (radering.spar) await radering.spar({ epost: d.epost, gastId: gId, grupper: berorda, alla: allaBort });
    for (const r of rader) await taBort(INB, r.id);
    let platserSlappta = 0;
    for (const g of berorda) if (await slappPlatsOmTom(g, d.epost)) platserSlappta++;
    return { inbjudningar: rader.length, sessioner, roster, meddelanden, arenden: arendenRorda, platserSlappta, grupper: berorda };
  }

  /**
   * Raderar en gästs uppgifter i en grupp, för en medlem (listans "Radera uppgifter"). Samma behörighet som att dra tillbaka: den som bjöd, en ägare eller admin, eller appens regel för en
   * omröstning. ⛔ ALLA personens rader i gruppen prövas FÖRE något raderas: saknas rätt på en, raderas ingen.
   *
   * @param {Record<string, any>} b `{ uid, groupId, gastId }`.
   * @returns {Promise<{ inbjudningar: number, sessioner: number, roster: number, meddelanden: number, arenden: number, platserSlappta: number, grupper: string[] }>}
   */
  async function radera(b) {
    const uid = kravText(b?.uid, "uid", "radera");
    const groupId = kravText(b?.groupId, "groupId", "radera");
    const gId = kravText(b?.gastId, "gastId", "radera");
    if (!GASTIDFORM.test(gId)) throw felMedKod("finns-inte", "radera: gastId har formen g_ och 40 hextecken.");
    const rader = (await kalla.list(INB, { where: { groupId } })).filter((r) => gastIdEllerNull(r) === gId);
    if (rader.length === 0) throw felMedKod("finns-inte", `radera: gästen har inga uppgifter i gruppen "${groupId}".`);
    for (const r of rader) await kravForvalta(uid, r, "radera");
    return raderaUppgifter({ epost: rader[0].epost, grupper: [groupId] });
  }

  /**
   * Gästen raderar sig själv, från gästsidan: ALLA personens uppgifter i ALLA grupper. Sessionen bevisar att det är gästen (eller någon som har allt gästen har). Även en återkallad gäst får radera sig:
   * en dragen inbjudan är inget skäl att behålla någons adress.
   *
   * @param {Record<string, any>} b `{ sessionsnyckel }`.
   * @returns {Promise<{ ok: true } | { ok: false, orsak: Gastorsak }>}
   */
  async function raderaMig(b) {
    const nyckel = b?.sessionsnyckel;
    if (typeof nyckel !== "string" || !GASTNYCKELFORM.test(nyckel)) return nej();
    const sid = gastnyckelHash(nyckel);
    const s = await kalla.read(SESS, sid);
    if (!s || typeof s.senast !== "number" || klocka() - s.senast > GASTSESSIONSDAGAR * DYGN_MS) return nej();
    const rad = await kalla.read(INB, s.inbjudningId);
    if (!rad) return nej();
    await raderaUppgifter({ epost: rad.epost, grupper: null });
    return { ok: true };
  }

  return { bjud, aterkalla, skickaOm, lista, platser, los, session, hamta, sattNamn, nyLank, stadaSessioner, chatt, skrivChatt, kalender, handelse, svara, rosta, bibliotek, fil, arenden, kommenteraArende, markeraArendeKlart, levandeGaster, aterkallaAlla, ersattAvMedlem, radera, raderaMig };
}
