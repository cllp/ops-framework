/**
 * Gäster: en person som bjudits in utan konto (0.131.0, cllp/lifehub.app#389, skiva 1: "en sak", omröstningen först; 0.132.0, skiva 2: hela gruppen).
 *
 * ══ ⛔ EN GÄST ÄR EN INBJUDAN OCH ALDRIG ETT MEDLEMSKAP, ETT KONTO ELLER EN FIREBASE-INLOGGNING ═════════════════════════
 *
 * Se `src/lib/gast.js` och `docs/beslut/0011`. Gästen når bara servern (appens `POST /api/gast`) och aldrig Firestore. Varje anrop bär en sessionsnyckel i
 * kroppen, och tjänsten läser sessionen och inbjudan på nytt varje gång: det finns ingen token med inbyggd livslängd att vänta ut när någon dras tillbaka.
 * `memberships` skrivs, läses och provas aldrig här för en gäst.
 *
 * ══ ⛔ NYCKELN LEDER ALDRIG UT UR TJÄNSTEN ANNAT ÄN PÅ TVÅ VÄGAR: BREVET (`skicka`) OCH `kopieraLank` ══════════════════════════
 *
 * Nyckeln i brevet är 32 slumpbyte och lagras på inbjudans rad bara som hash. Den ena vägen ut är den inskickade `skicka`-funktionen (appens mejlväg), som får `{ id, nyckel }`
 * per länk och bygger adressen med `gastLank`. Inget returvärde från en metod här bär en nyckel, så en handler som av misstag returnerar tjänstens svar rakt ut
 * till webbläsaren läcker ingenting. Sessionsnyckeln är undantaget: den är svaret på `los`, och den hör hemma hos gästen.
 *
 * Den andra vägen kom 2026-11-05 (CP: "Jag skulle också vilja kunna se länken till inbjudningen, eller kopiera den", och när det gällde om länken skulle bytas: "Man kan behöva ge länken igen för de som
 * fibblar bort den"): `kopieraLank` ger samma `{ id, nyckel }` till en medlem som får förvalta inbjudan, ur appens `lankvalv`, och är därmed det ENDA returvärdet som bär en nyckel. Det är säkert av tre skäl: bara den som
 * får Skicka igen (samma prövning, ägare eller admin för en gruppinbjudan) får nyckeln, och kopian ligger krypterad i ett valv som bara servern läser och inte på raden som medlemmens klient kan läsa.
 * ⛔ (0.200.0) Den som öppnar länken skriver inte längre gästens adress: länken loggar in direkt (`los`). Det tredje skälet, att adressen ändå krävdes, finns alltså inte kvar. Det som skyddar en kopierad
 * eller vidarebefordrad länk är detsamma som för länken i brevet: gästen syns i gästlistan, och Dra tillbaka stänger allt med ett tryck.
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
 * ══ ⛔ FEL NYCKEL RÄKNAS PER INBJUDAN OCH PER IP, OCH ALLA NEJ ÄR BYTE FÖR BYTE LIKA ═════════════════════════════════════════
 *
 * Försöket RESERVERAS innan nyckeln prövas (en villkorad skrivning, `updateIf`) och ges tillbaka om det lyckades, så att hundra parallella gissningar
 * inte alla hinner pröva innan någon räknats (samma mönster som delningens `reservera`). Svaret på okänt id och fel nyckel är ett och samma: `{ ok: false,
 * orsak: "nej" }`. `aterkallad` och `utgangen` ges först när nyckeln stämde.
 *
 * ⛔ (0.200.0) GÄSTEN SKRIVER INGEN ADRESS. Före 0.200.0 krävde `los` också gästens adress (eller nummer), och fel adress var samma nej. QA 2026-11-07 och CP samma dag: gästen ska "komma direkt in ...
 * hoppa över att bekräfta med mailen". Second opinion (Fable, cllp/ops-framework#540): mejlet öppnas ofta i mejlappens egen webbvy, med egen lagring, så gästen fick skriva adressen i varje webbläsare.
 * Nyckeln (32 slumpbyte, räknad per inbjudan och IP) är beviset, och en kontakt i anropet läses inte. Se `los`.
 *
 * ══ ⛔ HELA GRUPPEN (0.132.0): SERVERN LÄSER OCH SVARAR MED VITLISTADE FÄLT, PER ÅTGÄRD ═════════════════════════════════════
 *
 * En inbjudan med omfånget `{ slag: "grupp" }` ger gästen fyra funktioner (`GASTGRUPPFUNKTIONER`): chatt, kalender, bibliotek och, när appen gett `grupp.arenden`, de ärenden som delegerats till just hen (skiva 3: aldrig gruppens ärendelista, som kan bära sådant som inte rör gästen). Varje åtgärd (`chatt`, `kalender`,
 * `skrivChatt`, `kommenteraPost`, `handelse`, `svara`, `rosta`, `bibliotek`, `fil`, `arenden`, `kommenteraArende`, `markeraArendeKlart`) börjar med `session` och kravet `{ slag: "grupp", funktion }`, som läser sessionen OCH inbjudan på nytt: en återkallad
 * gäst nekas vid nästa anrop, i varje åtgärd. Gruppen kommer ur inbjudan och aldrig ur anropet. Svaret byggs fält för fält ur listorna i `GASTGRUPPSVARSFALT`: ett helt dokument
 * sprids aldrig ut, och en medlems adress, uid eller namn (utom som avsändarnamn i chatten) har ingen plats i något svar. Gästen når fortfarande bara servern och aldrig Firestore.
 *
 * ⛔ DET SOM ÄR APPENS HÄR: appens fält på en händelse (`grupp.handelseSida`), och omröstningens
 * modell (`grupp.omrostning`: förslagen, rösterna). Ramverket läser dem aldrig själv, och allt som appens `bygg` ger utöver `falt` tas bort innan svaret lämnar tjänsten.
 *
 * ══ ⛔ DELTA (0.146.0, cllp/ops-framework#445, skiva 1): EN GÄST FÖR EN SAK SVARAR OCH SER HÄNDELSEN, INGET ANNAT ═══════════════════
 *
 * En inbjudan med omfånget `{ slag: "sak", funktion: "delta", handelseId }` ger gästen två saker: att se händelsens rubrik, tid och plats (`GASTDELTAHANDELSEFALT`) och att svara Kommer, Kommer inte eller Kanske
 * (`GASTDELTASVAR`) på just den. Svaret är ett fält på inbjudan (`deltasvar`), skrivet av `deltaSvara` med ett villkor på `aterkallad: null`: en återkallelse och ett svar kan inte korsa varandra, och raderingen av
 * gästen tar svaret med sig utan att något nytt ställe behöver minnas att rensa. Ingen ny samling, inga nya regler (regel 13): inbjudningarna nekas redan alla klientskrivningar (`gastregelfragment`).
 * `delta` är en egen konfiguration (`createGastService({ delta })`), och en tjänst utan den svarar `ogiltigt-omfang` på `bjud` och `nej` på allt annat.
 *
 * Ett omfång ger EN funktion: en `delta`-session är ett nej för varje gruppåtgärd och för appens `rosta`-väg, och en `rosta`- eller gruppsession är ett nej för `deltaSvara`. `hamta` för en `delta`-gäst bygger aldrig
 * saken ur appens `sak.bygg` (det är omröstningens kort, med förslag och röster).
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
  GASTDELTAHANDELSEFALT,
  GASTDELTALISTFALT,
  GASTDELTASVAR,
  GASTFEL_FONSTER_MS,
  GASTFEL_MAX,
  GASTFELKODER,
  GASTFIL_PER_DYGN,
  GASTFUNKTIONER,
  GASTSKRIV_MAX_TECKEN,
  GASTSKRIV_PER_MINUT,
  arGastId,
  GASTNAMNLOS,
  GASTGRUPPFUNKTIONER,
  GASTGRUPPSVARSFALT,
  GASTOVERSIKTFALT,
  GASTOVERSIKT_SENASTE,
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
  GASTGRUPPLISTFALT,
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
  gastSerBibliotekspost,
  GASTPOSTKORTFALT,
  gastStatus,
  gastomfangsnyckel,
  gastplatsId,
  normaliseraGastepost,
  normaliseraGasttelefon,
  gastkontaktnyckel,
  gastkontaktPaRad,
} from "../lib/gast.js";
import { MAX_GRUPPBESKRIVNING, agentId, medlemskapsId } from "../lib/grupp.js";
import { arArkiverad, trimSomRegeln } from "../lib/bibliotek.js";
import { KLOCKFORM, SVARSVAL, byggSvar, handelsefel, sammanstallSvar } from "../lib/handelsemodell.js";
import { validateGruppkalendrar } from "../lib/kalendrar.js";
import { gruppensRader } from "../lib/katalog.js";
import { NAMNER_ALLA, samtalsnyckel } from "../lib/samtal.js";
import { adresserIText, bibliotekslank, kommentarRotId, kommentarRotText, lasBibliotekslank } from "../lib/postkommentar.js";
import { MAX_ANTECKNINGSBILDER, SIGNERAD_SEKUNDER, delningsTyp } from "../lib/delning.js";
import { anteckningsbildAdresser, delningsDisposition } from "./delning.js";
import { epostFel } from "../lib/mejl.js";
import { isOpenCase } from "../lib/caseModel.js";
import { andringsnyckel, nastaSekvens } from "./ics.js";

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
 * Kontakten i ett anrop eller en byggd rad: `epost` ELLER `telefon` (0.197.0), normaliserad, eller `null` om den inte går att använda. Båda på en gång är `null`: en inbjudan gäller en kontakt.
 * @param {{ epost?: unknown, telefon?: unknown } | null | undefined} d
 * @param {readonly string[]} [extraSparrade]
 * @returns {import("../lib/gast.js").Gastkontakt | null}
 */
function kontaktIAnrop(d, extraSparrade = []) {
  if (d?.telefon !== undefined) {
    if (d?.epost !== undefined) return null;
    const varde = normaliseraGasttelefon(d.telefon);
    return varde === null ? null : { slag: "telefon", varde };
  }
  const varde = normaliseraGastepost(d?.epost, extraSparrade);
  return varde === null ? null : { slag: "epost", varde };
}

/**
 * Inbjudans dokument-id: SHA-256 i hex av (grupp, normaliserad kontakt, omfångsnyckel). JSON-kodat, så att inget tecken i en adress kan flytta gränsen mellan delarna.
 * Samma kontakt till samma sak i samma grupp är samma id, och det är hela unikhetsmekanismen.
 *
 * ⛔ (0.197.0) FÖR EN ADRESS ÄR MITTDELEN ADRESSEN SJÄLV, SOM FÖRE TELEFONEN (`gastkontaktnyckel`). Ett befintligt id räknas exakt som förut och provet i `gast-telefon.test.js` låser värdena. Ett nummer är `tel:<nummer>`.
 *
 * @param {{ groupId: string, epost?: string, telefon?: string, omfang: import("../lib/gast.js").Gastomfang }} d
 * @returns {string}
 */
export function gastInbjudningsId(d) {
  const kontakt = kontaktIAnrop(d);
  if (kontakt === null) throw new Error("gastInbjudningsId: en inbjudan har en e-postadress som går att skicka till, eller ett telefonnummer.");
  const groupId = text(d?.groupId);
  if (!groupId) throw new Error("gastInbjudningsId: groupId krävs.");
  return hash(JSON.stringify([groupId, gastkontaktnyckel(kontakt), gastomfangsnyckel(d.omfang)]));
}

/**
 * Inbjudningspostens form, eller felet som säger varför den inte går att bygga. `id` är hashen och är dokumentets id; nyckeln finns inte i raden, bara dess hash.
 *
 * ⛔ `felAntal` OCH `felFonster` FINNS FRÅN BÖRJAN, som på en delning: räknaren är då alltid ett tal och aldrig ett fält som saknas, vilket en villkorad skrivning inte
 * kan jämföra på ett pålitligt sätt.
 *
 * @param {object} d
 * @param {string} d.groupId
 * @param {string} [d.epost] Adressen, eller
 * @param {string} [d.telefon] (0.197.0) numret. Exakt en av dem, och raden bär bara den.
 * @param {string} [d.namn]
 * @param {import("../lib/gast.js").Gastomfang} d.omfang
 * @param {{ uid: string, namn?: string }} d.skapadAv
 * @param {number} d.skapad Millisekunder.
 * @param {string} d.nyckel Nyckeln i brevet. Lagras aldrig, bara hashen.
 * @param {string} [d.andringsnyckel] KRÄVS för en `delta`-inbjudan: `andringsnyckel()` för händelsen som den är när brevet skickas. Övriga omfång bär inget sådant fält.
 * @param {boolean} [d.laddaNed] (0.203.0, lifehub.app#691) Får gästen ladda ned filer? Bara för en inbjudan till hela gruppen, och utelämnad är `false`: en ny gäst laddar inte ned
 *   förrän någon slagit på det. En sak bär aldrig fältet, och ett värde för en sak är ett fel.
 * @returns {Record<string, any>}
 */
export function byggGastinbjudan(d) {
  if (!d || typeof d !== "object") throw new Error("byggGastinbjudan: en inbjudan krävs.");
  const kontakt = kontaktIAnrop(d);
  if (kontakt === null) throw new Error("byggGastinbjudan: epost är ingen adress som går att skicka till (eller telefon inget nummer, eller båda angavs).");
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
  const delta = omfang.slag === "sak" && omfang.funktion === "delta";
  const grupp = omfang.slag === "grupp";
  if (d.laddaNed !== undefined && typeof d.laddaNed !== "boolean") throw new Error("byggGastinbjudan: laddaNed ska vara sant eller falskt, eller utelämnas.");
  if (d.laddaNed !== undefined && !grupp) throw new Error("byggGastinbjudan: laddaNed gäller bara en inbjudan till hela gruppen. En sak har inget bibliotek att ladda ned ur.");
  if (delta && (typeof d.andringsnyckel !== "string" || d.andringsnyckel === "")) {
    throw new Error("byggGastinbjudan: en delta-inbjudan bär andringsnyckel (ur andringsnyckel()), det som SEQUENCE jämförs mot vid nästa utskick.");
  }
  // ⛔ EN E-POSTRAD HAR EXAKT DE FÄLT DEN HADE FÖRE 0.197.0. En telefonrad har `telefon` där e-postraden har `epost`, och inget annat skiljer.
  const kontaktfalt = kontakt.slag === "telefon" ? { telefon: kontakt.varde } : { epost: kontakt.varde };
  return {
    id: gastInbjudningsId({ groupId, ...kontaktfalt, omfang }),
    groupId,
    ...kontaktfalt,
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
    // (0.146.0) Bara en delta-rad: svaret, SEQUENCE för det första brevet och vad brevet sade om tid och plats. `GASTDELTARADFALT`.
    ...(delta ? { deltasvar: null, sekvens: 0, andringsnyckel: d.andringsnyckel } : {}),
    // (0.203.0) Bara en gruppinbjudan, och bara `true` slår på: allt annat än ett uttryckligt ja är nej för en ny gäst.
    ...(grupp ? { laddaNed: d.laddaNed === true } : {}),
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
 * @property {{ grupper: string, samtal: string, meddelanden: string, bibliotek: string, svar: string, gruppkalendrar?: string, tradar?: string }} samlingar
 *   Appens samlingsnamn, inga förval. `samtal` och `meddelanden`: gruppchatten ligger i `<samtal>/<groupId>|grupp/<meddelanden>` (`samtalsnyckel`). `svar`: undersamlingens namn
 *   under en händelse, `<handelser>/<id>/<svar>/<uid>` (som medlemmens, med gästens `g_`-id). `gruppkalendrar` (valfri): gruppens kalendrar, för kalenderlistans `kalendrar`.
 *   `tradar` (valfri, 0.191.0, cllp/lifehub.app#663): chattens trådar, samma namn som till `createSamtalskalla({ tradar })` och `samtalsregelfragment({ tradar })`. Med den ser gästen
 *   antalet svar under ett meddelande och svaren i en tråd (`chatt({ trad })`), och svarar i en tråd (`skrivChatt({ trad })`). Utan den: inga trådar, som förut.
 * @property {string} [bibliotekBas] (0.191.0) Appens adress till biblioteket, samma som till `createPostkommentarer` och `bibliotekPostkort` (`bibliotekslank`). Med den bär ett meddelande i gästens chatt
 *   ett kort för varje länk till en post som gästen ser (`kort`, `gastSerBibliotekspost`), och med `tradar` dessutom får gästen kommentera en post (`kommenteraPost`, och `hamta` bär `kommentera: true`).
 * @property {{ signeradAdress: (b: { sokvag: string, sekunder: number, disposition: string, mime: string }) => Promise<string>, finns?: (b: { sokvag: string }) => Promise<boolean>, gruppPrefix?: string, postPrefix?: string }} lagring
 *   Som delningens lagring. `gruppPrefix` och `postPrefix` är samma namn som `lagringsregelfragment({ bibliotek })` fick (förval `grupper` och `bibliotek`): en fils sökväg är exakt
 *   `<gruppPrefix>/<groupId>/<postPrefix>/<postId>/<filnamn>` med postens egen grupp och id, annars signeras den aldrig. (0.207.0, cllp/lifehub.app#696) `finns({ sokvag })` (valfri,
 *   Admin SDK: `(await bucket.file(sokvag).exists())[0]`): med den får gästen bilderna i en anteckning när den öppnas (`anteckningsbilder`); utan den inga bilder.
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
 * @property {(arg: { epost: string | null, telefon?: string, gastId: string, grupper: readonly string[], alla: boolean }) => void | Promise<void>} [spar]
 *   Där appen själv sparat adressen (mejlkön, loggar): tas bort vid radering. Ramverket kan inte veta var. `alla`: personens sista inbjudan försvann, inte bara i `grupper`.
 *   (0.197.0) En gäst med telefonnummer ger `{ epost: null, telefon }`. En gäst med e-post ger exakt det den gav förut, utan `telefon`.
 */

/** @typedef {"nej" | "aterkallad" | "utgangen" | "for-manga" | "saknas"} Gastorsak */

/**
 * @typedef {object} Gastbrev
 * @property {"inbjudan" | "igen" | "ny-lank" | "andrad-tid"} typ `andrad-tid` (0.146.0): händelsens tid eller plats har ändrats sedan förra brevet till en `delta`-gäst (`tidAndrad`). Brevet bär den nya posten (`handelse`, `sekvens`) och en ny länk.
 * @property {string} till Adressen, normaliserad.
 * @property {string} namn Namnet som den som bjöd gav, eller en tom sträng.
 * @property {ReadonlyArray<{ id: string, nyckel: string, groupId: string, omfang: import("../lib/gast.js").Gastomfang, sekvens?: number, handelse?: { id: string, titel: string, plats: string | null, datum: string | null, slutDatum: string | null, tid: string | null, slutTid: string | null, heldag: boolean } }>} lankar
 *   En per inbjudan. Bygg adressen med `gastLank`. ⛔ För en `delta`-inbjudan bär länken också `handelse` (händelsen som gästen ser den, med `id`) och `sekvens`: `byggIcs({ handelse, sekvens, domän, tidszon, stampel })` ger kalenderposten
 *   som ska bifogas, och rubriken, tiden och platsen i brevet och på sidan kommer ur samma ställe (regel 2).
 * @property {{ uid: string, namn: string } | null} skickadAv Den som bjöd eller skickade om. `null` för "ny länk", som gästen själv bad om.
 */

/** (0.202.0) Hur många tidigare nycklar en inbjudan minns för `nyLank`. */
const GASTTIDIGARE_NYCKLAR = 5;

/**
 * Bygger tjänsten.
 *
 * @param {object} konfig
 * @param {import("../data/contract.js").DataSource<any>} konfig.kalla Kräver `read`, `list`, `remove`, `createNew` och `updateIf`.
 * @param {Gastsamlingar} konfig.samlingar
 * @param {(arg: { uid: string, groupId: string, medlemskap: Record<string, any>, handelse: Record<string, any>, funktion: "rosta" | "delta" }) => boolean | Promise<boolean>} konfig.farBjuda
 *   Appens regel för vem som får bjuda in gäster till en händelse och dra tillbaka dem: för omröstningen skaparen, en admin eller en ägare, och bara medan datumet
 *   inte är valt. ⛔ `funktion` (0.146.0) säger vad inbjudan gäller: omröstningens regel ("bara medan datumet inte är valt") är fel för `delta`, som kräver ett datum. Appen svarar per funktion. KRÄVS, utan förval: att bjuda in en utomstående är att skicka ett brev i gruppens namn, och en tyst bred regel vore en dörr bredvid reglerna. Prövas
 *   EFTER medlemskapet (aktiv, och en person), aldrig i stället för det.
 * @param {(brev: Gastbrev) => void | Promise<void>} konfig.skicka Appens mejlväg. Får nyckeln. Brevet är den ena av två vägar en nyckel lämnar tjänsten på; den andra är `kopieraLank` ur `lankvalv` (CP 2026-11-05: "Man kan behöva ge länken igen för de som fibblar bort den").
 * @param {{ falt: readonly string[], bygg: (arg: { inbjudan: Record<string, any>, gastId: string, handelse: Record<string, any> }) => Record<string, any> | Promise<Record<string, any>> }} [konfig.sak]
 *   Det gästen ser av saken. `falt` är hela listan: allt som `bygg` ger utöver den tas bort innan svaret lämnar tjänsten. Utan den ger `hamta` inget `sak`.
 * @param {{ handelseSida: (handelse: Record<string, any>) => { titel: string, plats?: string | null } }} [konfig.delta] (0.146.0) Slår på funktionen `delta` för en sak: gästen svarar Kommer, Kommer inte eller Kanske på en händelse och
 *   ser dess rubrik, tid och plats. `handelseSida` säger vilka av appens fält som är rubrik och plats; tiden är ramverkets (`HANDELSEKONTRAKT`). KRÄVER `radering`: tjänsten sparar gästens adress och svar. Utan `delta` svarar `bjud` med funktionen `delta` `ogiltigt-omfang`.
 * @param {Gastgrupp} [konfig.grupp] (0.132.0) Slår på omfånget "grupp": gästens chatt, kalender, ärenden och bibliotek. Utan den finns bara "en sak".
 * @param {Gastradering} [konfig.radering] (0.132.0) Raderingen av en gästs uppgifter. KRÄVS med `grupp`; utan den kastar `radera` och `raderaMig`.
 * @param {{ spara: (arg: { id: string, groupId: string, nyckel: string }) => Promise<void>, hamta: (arg: { id: string, groupId: string }) => Promise<string | null>, radera: (arg: { id: string, groupId: string }) => Promise<void> }} [konfig.lankvalv]
 *   (0.189.0) Valvet som gör `kopieraLank` möjlig (CP 2026-11-05: "Man kan behöva ge länken igen för de som fibblar bort den"). Servern sparar annars bara en hash av nyckeln, och en hash går inte att läsa ut.
 *   Appen krypterar och lagrar: ramverket känner varken samling eller hemlighet. `spara` anropas varje gång en nyckel skapas eller roteras, INNAN brevet skickas, och kastar den får anroparen `valv-misslyckades`.
 *   `radera` anropas för varje inbjudan som raderas (inte vid återkallelse: Skicka igen väcker den med en ny nyckel ändå). ⛔ Nyckeln ligger i valvet och inte på inbjudans rad, eftersom raden kan läsas av medlemmens klient
 *   (`gastregelfragment`) och valvet bara av servern. Utelämnad: ingen kopia sparas och `kopieraLank` ger `ej-konfigurerad`.
 * @param {readonly string[]} [konfig.extraSparrade] Appens egna spärrade mejldomäner (`epostFel`).
 * @param {(fel: unknown) => void} [konfig.rapportera] Där ett brev som inte gick att skicka rapporteras när svaret ändå måste vara neutralt (`nyLank`). Förval `console.error`.
 * @param {() => number} [konfig.klocka] Millisekunder. Förval `Date.now`. Provens enda sätt att låta en länk gå ut.
 */
export function createGastService(konfig) {
  /*
   * ⛔ DESTRUKTURERINGEN LIGGER I KROPPEN, av samma skäl som i `createDelningService`: `({ kalla })` i signaturen kastar Nodes "Cannot destructure" innan
   * valideringen hinner köra, och det felet nämner inte fabriken.
   */
  const { kalla, samlingar, farBjuda, skicka, sak, delta, grupp, radering, lankvalv, extraSparrade = [], rapportera = (/** @type {unknown} */ fel) => console.error("createGastService:", fel), klocka = Date.now } = konfig ?? {};
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
  if (lankvalv !== undefined) {
    if (!lankvalv || typeof lankvalv !== "object") throw new Error(`${namn}: lankvalv är ett objekt { spara, hamta, radera }, eller utelämnas.`);
    for (const f of /** @type {const} */ (["spara", "hamta", "radera"])) if (typeof lankvalv[f] !== "function") throw new Error(`${namn}: lankvalv.${f} krävs, en funktion. Ett valv som inte kan radera lämnar nycklar kvar efter en radering.`);
  }
  const VALV = lankvalv ?? null;
  if (typeof skicka !== "function") {
    throw new Error(`${namn}: skicka krävs, appens mejlväg. Nyckeln lämnar tjänsten bara genom den och genom kopieraLank (lankvalv).`);
  }
  if (sak !== undefined) {
    if (!sak || !Array.isArray(sak.falt) || sak.falt.length === 0 || sak.falt.some((/** @type {unknown} */ f) => typeof f !== "string" || f === "")) {
      throw new Error(`${namn}: sak.falt är en icke-tom lista med fältnamn. Den är hela listan över vad en gäst får se av saken.`);
    }
    if (typeof sak.bygg !== "function") throw new Error(`${namn}: sak.bygg krävs när sak finns, en funktion som ger saken som en gäst ser den.`);
  }
  if (delta !== undefined) {
    if (!delta || typeof delta.handelseSida !== "function") {
      throw new Error(`${namn}: delta.handelseSida krävs, en funktion som säger vilka av appens fält som är rubrik och plats. Ramverket känner inte appens händelsefält och gissar inget.`);
    }
    if (radering === undefined) {
      throw new Error(`${namn}: radering krävs med delta. Tjänsten sparar gästens adress och svar, och en gäst som går att bjuda in måste också gå att radera (samma krav som för grupp).`);
    }
  }
  const DELTA = delta ?? null;
  /** @type {null | { samlingar: Record<string, string>, lagring: Gastgrupp["lagring"], gruppPrefix: string, postPrefix: string, handelseSida: Gastgrupp["handelseSida"], arenden?: Gastarenden, omrostning?: Gastgrupp["omrostning"], tradar: string | null, bibliotekBas: string | null, funktioner: readonly string[] }} */
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
    if (gs.tradar !== undefined && (typeof gs.tradar !== "string" || !SAMLINGSFORM.test(gs.tradar))) throw new Error(`${namn}: grupp.samlingar.tradar är ett samlingsnamn, eller utelämnas.`);
    // ⛔ (0.191.0) Trådarna är en undersamling till samtalet, bredvid meddelandena: samma namn hade blandat trådar och meddelanden (samma prövning som `createSamtalskalla`).
    if (gs.tradar !== undefined && gs.tradar === gs.meddelanden) throw new Error(`${namn}: grupp.samlingar.tradar och meddelanden ska ha olika namn. Båda ligger under samtalet, och samma namn blandar trådar med meddelanden.`);
    const gruppnamn = [gs.grupper, gs.samtal, gs.bibliotek, ...(gs.gruppkalendrar ? [gs.gruppkalendrar] : []), ...(gs.tradar ? [gs.tradar] : [])];
    if (new Set([...gruppnamn, samlingar.inbjudningar, samlingar.sessioner, samlingar.platser, samlingar.raknare, samlingar.handelser, samlingar.medlemskap ?? "memberships"]).size !== gruppnamn.length + 6) {
      throw new Error(`${namn}: varje samling i grupp.samlingar ska ha sitt eget namn, skilt från de andra gästsamlingarna. Två samlingar med samma namn blandar id:n som inte hör ihop.`);
    }
    if (typeof grupp.lagring?.signeradAdress !== "function") throw new Error(`${namn}: grupp.lagring.signeradAdress krävs. Gästen får aldrig en öppen sökväg, bara en adress som går ut.`);
    if (typeof grupp.handelseSida !== "function") throw new Error(`${namn}: grupp.handelseSida krävs, en funktion som säger vilka av appens fält som är titel, beskrivning och plats.`);
    if (grupp.bibliotekBas !== undefined) lasBibliotekslank(grupp.bibliotekBas, "");
    // ⛔ (0.204.0, lifehub.app#691) GRUPPENS STRÖMBRYTARE ÄR BORTTAGEN, OCH EN APP SOM FORTFARANDE SKICKAR DEN STOPPAS HÄR. Nedladdningen avgörs av gästens `laddaNed` och inget annat
    // (`nedladdningTillaten`). Att ta emot `farLaddaNed` och inte fråga den hade varit en strömbrytare som tyst slutat göra något: värden tror att gruppen är avstängd medan gästen med `true` laddar ned.
    if ("farLaddaNed" in grupp) throw new Error(`${namn}: grupp.farLaddaNed finns inte sedan 0.204.0. Nedladdningen gäller per gäst (inbjudans laddaNed, sattNedladdning). Ta bort den ur konfigurationen, och kör appens bakfyllnad av laddaNed först (CHANGELOG 0.204.0).`);
    const prefix = (/** @type {unknown} */ v, /** @type {string} */ fall, /** @type {string} */ falt) => {
      const x = v === undefined ? fall : v;
      if (typeof x !== "string" || !SAMLINGSFORM.test(x)) throw new Error(`${namn}: grupp.lagring.${falt} är ett namn.`);
      return x;
    };
    if (grupp.lagring.finns !== undefined && typeof grupp.lagring.finns !== "function") throw new Error(`${namn}: grupp.lagring.finns är en funktion ({ sokvag }) => Promise<boolean>, eller utelämnas.`);
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
      // ⛔ `gruppnamn` och inte en egen lista (0.191.0): när `tradar` kom till hade en egen lista räknat en samling för lite, och taket nedan hade blivit fel.
      if (new Set([a.samling, ...gruppnamn, samlingar.inbjudningar, samlingar.sessioner, samlingar.platser, samlingar.raknare, samlingar.handelser, samlingar.medlemskap ?? "memberships"]).size !== gruppnamn.length + 7) {
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
      tradar: gs.tradar ?? null,
      bibliotekBas: grupp.bibliotekBas ?? null,
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
  /**
   * (0.190.0) `nedladdning-av` bara från `fil`, när gruppen stängt av nedladdning. Mallen behåller den smala typen, så att `los` och `hamta` fortfarande bara kan svara med `Gastorsak`.
   * @template {"aterkallad" | "utgangen" | "for-manga" | "saknas" | "nedladdning-av"} T
   * @param {T} orsak
   */
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
      if (m && (await farBjuda({ uid, groupId: rad.groupId, medlemskap: m, handelse: h, funktion: rad.omfang?.funktion ?? "rosta" })) === true) return;
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
   * Fältet en kontakt står i på inbjudans rad, som ett villkor för en fråga: `{ epost }` eller `{ telefon }` (0.197.0). En e-postkontakt frågas exakt som förut.
   * @param {import("../lib/gast.js").Gastkontakt} kontakt
   */
  const kontaktVillkor = (kontakt) => (kontakt.slag === "telefon" ? { telefon: kontakt.varde } : { epost: kontakt.varde });

  /**
   * Gästens aktiva inbjudningar i gruppen.
   * @param {string} groupId
   * @param {import("../lib/gast.js").Gastkontakt} kontakt
   */
  async function aktivaInbjudningar(groupId, kontakt) {
    const rader = await kalla.list(INB, { where: kontaktVillkor(kontakt) });
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
    const levande = new Set(alla.filter((r) => r.aterkallad === null).map((r) => gastIdEllerNull(r)));
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
   * @param {import("../lib/gast.js").Gastkontakt} kontakt
   * @returns {Promise<boolean>} Sant om en plats släpptes.
   */
  async function slappPlatsOmTom(groupId, kontakt) {
    if ((await aktivaInbjudningar(groupId, kontakt)).length > 0) return false;
    const gId = gastId(kontakt);
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

  // ── Delta: händelsen som gästen ser den, och SEQUENCE ─────────────────────────────────────────────────────────────

  /**
   * Händelsen som en `delta`-gäst ser den: rubrik och plats ur appen (`delta.handelseSida`), tiden ur ramverkets egna fält. Fältens form är fast (`null` när något saknas, aldrig utelämnat), så att sidan och
   * brevet aldrig behöver gissa skillnaden mellan "tomt" och "inte hämtat". ⛔ Beskrivningen, filerna och allt annat appen har på händelsen är inte med.
   *
   * @param {Record<string, any>} h
   * @returns {{ titel: string, plats: string | null, datum: string | null, slutDatum: string | null, tid: string | null, slutTid: string | null, heldag: boolean }}
   */
  function deltaHandelseUt(h) {
    const sida = /** @type {NonNullable<typeof DELTA>} */ (DELTA).handelseSida(h);
    const plats = text(sida?.plats);
    /** @param {unknown} v */
    const eller = (v) => (typeof v === "string" && v !== "" ? v : null);
    return { titel: text(sida?.titel), plats: plats === "" ? null : plats, datum: eller(h.datum), slutDatum: eller(h.slutDatum), tid: eller(h.tid), slutTid: eller(h.slutTid), heldag: h.heldag === true };
  }

  /**
   * Nästa SEQUENCE för en `delta`-rad, utan att skriva något: det som lagrades vid förra utskicket mot händelsen som den är nu (`nastaSekvens`).
   * @param {Record<string, any>} rad
   * @param {ReturnType<typeof deltaHandelseUt>} ut
   */
  function planeraSekvens(rad, ut) {
    const forra = Number.isInteger(rad.sekvens) && typeof rad.andringsnyckel === "string" ? { sekvens: rad.sekvens, andringsnyckel: rad.andringsnyckel } : null;
    return nastaSekvens(forra, andringsnyckel(ut));
  }

  /**
   * Sparar en planerad SEQUENCE. Villkoret är det som lästes: har en annan hunnit före (ett samtidigt utskick) skrivs ingenting över, och anroparen får `false`.
   *
   * ⛔ EN ÄNDRING NOLLSTÄLLER SVARET, I SAMMA SKRIVNING SOM HÖJER SEQUENCE (CP 2026-09-24 i SS, och samordnarens granskning av skiva 1): "Jag kommer" till 18:00 är inget svar på 19:00. Gästen ser då
   * "Du har inte svarat än" med knapparna på sidan, och medlemmens lista säger Har inte svarat. Gäller varje utskick som höjer SEQUENCE (`tidAndrad`, Skicka igen, Bjud in igen, en ny länk), eftersom brevet
   * då bär en ny post. En oförändrad händelse rör inte svaret.
   *
   * @param {Record<string, any>} rad
   * @param {{ sekvens: number, andringsnyckel: string, andrad?: boolean }} nasta
   */
  async function sparaSekvens(rad, nasta) {
    if (rad.sekvens === nasta.sekvens && rad.andringsnyckel === nasta.andringsnyckel) return true;
    const { updated } = await uppdateraOm(INB, rad.id, { sekvens: rad.sekvens, andringsnyckel: rad.andringsnyckel }, { sekvens: nasta.sekvens, andringsnyckel: nasta.andringsnyckel, ...(nasta.andrad ? { deltasvar: null } : {}) });
    return updated;
  }

  /**
   * SEQUENCE för ett utskick som en människa begärt (Bjud in igen, Skicka igen, en ny länk): planeras och sparas FÖRE brevet skickas, och försöker om när ett samtidigt utskick hann före. Går brevet inte iväg
   * räcker Skicka igen: samma SEQUENCE är redan sparad, och brevet bär den.
   *
   * @param {Record<string, any>} rad Raden som den lästes.
   * @param {ReturnType<typeof deltaHandelseUt>} ut
   * @returns {Promise<number>}
   */
  async function sekvensForUtskick(rad, ut) {
    let aktuell = rad;
    for (let i = 0; i < 4; i++) {
      const nasta = planeraSekvens(aktuell, ut);
      if (await sparaSekvens(aktuell, nasta)) return nasta.sekvens;
      const ny = await kalla.read(INB, rad.id);
      if (!ny) break;
      aktuell = ny;
    }
    throw new Error("delta: inbjudan ändrades hela tiden av någon annan. Försök igen.");
  }

  /**
   * Länken i ett brev. För en `delta`-inbjudan bär den också händelsen och SEQUENCE (se `Gastbrev`).
   *
   * @param {Record<string, any>} rad
   * @param {string} nyckel
   * @param {{ ut: ReturnType<typeof deltaHandelseUt>, sekvens: number } | null} [delta]
   */
  function brevlank(rad, nyckel, delta = null) {
    return { id: rad.id, nyckel, groupId: rad.groupId, omfang: rad.omfang, ...(delta ? { sekvens: delta.sekvens, handelse: { id: rad.omfang.handelseId, ...delta.ut } } : {}) };
  }

  // ── Utskicken ─────────────────────────────────────────────────────────────────────────────────────────────────────

  /**
   * (0.202.0) Hashen av nycklarna en inbjudan haft, den senaste först, högst `GASTTIDIGARE_NYCKLAR`. Bara `nyLank` läser dem: en gäst med ett gammalt brev får be om en ny länk
   * (QA 2026-11-07, punkt 4 i cllp/lifehub.app#687), men en nyckel som aldrig funnits får inget brev. Ingen gammal nyckel öppnar något: `los` och `prova` läser bara `nyckelHash`.
   * @param {Record<string, any>} rad Raden före bytet.
   * @returns {string[]}
   */
  function tidigareHashar(rad) {
    const forra = Array.isArray(rad?.tidigareNyckelHashar) ? rad.tidigareNyckelHashar.filter((h) => typeof h === "string") : [];
    return [rad.nyckelHash, ...forra].filter((h) => typeof h === "string").slice(0, GASTTIDIGARE_NYCKLAR);
  }

  /**
   * Roterar nyckeln på en inbjudan (den gamla slutar fungera) och räknar ett utskick. Försöker om när en annan hann ändra raden.
   *
   * @param {Record<string, any>} rad Raden som den lästes.
   * @returns {Promise<{ rad: Record<string, any>, nyckel: string }>}
   */
  async function roteraNyckel(rad) {
    const { rad: ny, nyckel } = await roteraNyckelUtanValv(rad);
    await sparaIValv(ny, nyckel);
    return { rad: ny, nyckel };
  }

  /**
   * Sparar nyckeln i valvet (`lankvalv`) INNAN brevet skickas. ⛔ Kastar valvet blir det `valv-misslyckades`, aldrig tyst (regel 5): inbjudan finns, men länken går inte att kopiera förrän Skicka igen lyckats.
   * @param {Record<string, any>} rad
   * @param {string} nyckel
   */
  async function sparaIValv(rad, nyckel) {
    if (!VALV) return;
    try {
      await VALV.spara({ id: rad.id, groupId: rad.groupId, nyckel });
    } catch (fel) {
      throw Object.assign(felMedKod("valv-misslyckades", "länken gick inte att spara för kopiering. Inbjudan finns: använd Skicka igen."), { orsak: fel });
    }
  }

  /**
   * @param {Record<string, any>} rad
   * @returns {Promise<{ rad: Record<string, any>, nyckel: string }>}
   */
  async function roteraNyckelUtanValv(rad) {
    let aktuell = rad;
    for (let i = 0; i < 4; i++) {
      const nyckel = nyGastnyckel();
      const nu = klocka();
      const { updated, row } = await uppdateraOm(INB, aktuell.id, { nyckelHash: aktuell.nyckelHash }, {
        nyckelHash: gastnyckelHash(nyckel),
        tidigareNyckelHashar: tidigareHashar(aktuell),
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
   * ⛔ (0.197.0, cllp/lifehub.app#661) MED `telefon` I STÄLLET FÖR `epost` SKICKAS INGET BREV. Inbjudan skapas och nyckeln sparas i valvet (`lankvalv`), och svaret bär `slag: "telefon"` och inbjudans id, så att vyn genast hämtar
   * länken med `kopieraLank` och visar Dela (SMS från den inbjudandes egen telefon) och Kopiera. Utan valv svarar den `ej-konfigurerad` INNAN något skrivs: länken hade annars aldrig nått någon. Bara till hela gruppen
   * (`slag: "grupp"`): en händelse att svara på (`delta`) lever av kalenderbrevet och dess ändringar, och en omröstning bjuds in från händelsen med e-post. Platser, tak och räknare är desamma som för en adress.
   *
   * ⛔ (0.203.0, lifehub.app#691) `laddaNed` GÄLLER BARA HELA GRUPPEN, och förvalet för en ny gäst är `false`. En ny rad får värdet som det angavs (utelämnat är `false`). En befintlig rad (Bjud in igen) får
   * det nya värdet bara när ett angavs: utelämnat lämnar det sparade orört, så att ett nytt utskick aldrig i tysthet tar ifrån eller ger en gäst nedladdning. Ändras det senare med `sattNedladdning`.
   *
   * @param {Record<string, any>} b `{ uid, handelseId, epost, namn?, funktion? }` för en sak (`funktion` är `rosta`, förval, eller `delta`, 0.146.0), `{ uid, slag: "grupp", groupId, epost | telefon, namn?, laddaNed? }` för hela gruppen.
   * @returns {Promise<{ id: string, gastId: string, ny: boolean, vackt: boolean, slag: "epost" | "telefon" }>}
   */
  async function bjud(b) {
    const uid = kravText(b?.uid, "uid", "bjud");
    const grupplage = b?.slag === "grupp";
    if (b?.slag !== undefined && b.slag !== "grupp" && b.slag !== "sak") throw felMedKod("ogiltigt-omfang", `bjud: slaget ${JSON.stringify(b.slag)} finns inte. Giltiga: sak, grupp.`);
    if (grupplage && b?.handelseId !== undefined) throw felMedKod("ogiltigt-omfang", "bjud: en inbjudan till hela gruppen har ingen händelse. Ange antingen handelseId eller slag: \"grupp\".");
    if (grupplage && b?.funktion !== undefined) throw felMedKod("ogiltigt-omfang", "bjud: en inbjudan till hela gruppen har ingen funktion. Funktionen hör till en sak.");
    // (0.203.0) Sant, falskt eller utelämnat, och bara för hela gruppen. En sträng "false" hade varit sann i en jämförelse.
    const laddaNed = b?.laddaNed;
    if (laddaNed !== undefined && typeof laddaNed !== "boolean") throw felMedKod("ogiltigt-omfang", "bjud: laddaNed ska vara sant eller falskt, eller utelämnas.");
    if (laddaNed !== undefined && !grupplage) throw felMedKod("ogiltigt-omfang", "bjud: laddaNed gäller en inbjudan till hela gruppen (slag: \"grupp\"). En sak har inget bibliotek att ladda ned ur.");
    const funktion = b?.funktion === undefined ? /** @type {const} */ ("rosta") : b.funktion;
    if (!(/** @type {readonly unknown[]} */ (GASTFUNKTIONER).includes(funktion))) throw felMedKod("ogiltigt-omfang", `bjud: funktionen ${JSON.stringify(funktion)} finns inte. Giltiga: ${GASTFUNKTIONER.join(", ")}.`);
    if (funktion === "delta" && !DELTA) throw felMedKod("ogiltigt-omfang", "bjud: delta är inte påslaget (createGastService fick ingen delta).");
    const telefonlage = b?.telefon !== undefined;
    if (telefonlage) {
      if (b?.epost !== undefined) throw felMedKod("ogiltig-telefon", "bjud: ange antingen epost eller telefon. En inbjudan gäller en kontakt.");
      if (!grupplage) throw felMedKod("ogiltigt-omfang", "bjud: en inbjudan med telefon gäller hela gruppen (slag: \"grupp\"). En omröstning och en händelse bjuds in med e-post.");
      if (normaliseraGasttelefon(b.telefon) === null) throw felMedKod("ogiltig-telefon", "bjud: telefonnumret går inte att använda. Skriv det med riktnummer (070 ...) eller landsnummer (+46 ...).");
      // ⛔ VALVET FÖRE ALLT SOM SKRIVS: utan brev är länken i valvet den enda vägen till gästen.
      if (!VALV) throw felMedKod("ej-konfigurerad", "bjud: en inbjudan med telefon kräver lankvalv. Inget brev skickas, och utan valvet når länken aldrig någon.");
    }
    const kontakt = kontaktIAnrop(telefonlage ? { telefon: b.telefon } : { epost: b?.epost }, extraSparrade);
    const epost = telefonlage ? null : kontakt?.varde ?? null;
    // Ordningen i skiva 1: händelsen läses före adressen prövas bara när det är en sak. Ett fel ska vara samma fel som förut.
    const handelseId = grupplage ? "" : kravText(b?.handelseId, "handelseId", "bjud");
    if (kontakt === null) throw felMedKod("ogiltig-epost", `bjud: ${epostFel(b?.epost, extraSparrade) ?? "adressen går inte att skicka till"}`);
    const gastnamn = text(b?.namn);
    if (gastnamn.length > MAX_GASTNAMN) throw felMedKod("ogiltigt-namn", `bjud: namnet får vara högst ${MAX_GASTNAMN} tecken.`);

    /** @type {string} */
    let groupId;
    /** @type {Record<string, any>} */
    let medlem;
    /** @type {import("../lib/gast.js").Gastomfang} */
    let omfang;
    /** @type {ReturnType<typeof deltaHandelseUt> | null} */
    let deltaUt = null;
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
      if ((await farBjuda({ uid, groupId, medlemskap: m, handelse: h, funktion })) !== true) {
        throw felMedKod("ej-behorig", `bjud: ${uid} får inte bjuda in gäster till händelsen "${handelseId}".`);
      }
      // ⛔ DELTA KRÄVER ETT DATUM: en händelse utan dag har ingen kalenderpost att skicka och ingenting att komma till. Omröstningen om dagen är `rosta`.
      if (funktion === "delta") {
        deltaUt = deltaHandelseUt(h);
        if (deltaUt.datum === null) throw felMedKod("ogiltigt-omfang", `bjud: händelsen "${handelseId}" har inget datum, och det går inte att svara på om man kommer. Bjud in till omröstningen om dagen (funktion rosta) i stället.`);
      }
      medlem = m;
      omfang = { slag: "sak", funktion, handelseId };
    }

    const gId = gastId(kontakt);
    // ⛔ PLATSEN FÖRST: en plats utan inbjudan kostar en plats, en inbjudan utan plats bryter taket. En person tar EN plats oavsett omfång (platsen är nyckad på gästen).
    await tagPlats(groupId, gId);

    const nyckel = nyGastnyckel();
    const skapad = klocka();
    const skapadAv = { uid, namn: text(medlem.namn) };
    const ny = byggGastinbjudan({ groupId, ...kontaktVillkor(kontakt), namn: gastnamn, omfang, skapadAv, skapad, nyckel, ...(deltaUt ? { andringsnyckel: andringsnyckel(deltaUt) } : {}), ...(laddaNed !== undefined ? { laddaNed } : {}) });
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
          tidigareNyckelHashar: tidigareHashar(aktuell),
          aterkallad: null,
          skickad: nu,
          antalSkickade: (typeof aktuell.antalSkickade === "number" ? aktuell.antalSkickade : 0) + 1,
          lankGiltigTill: nu + GASTLANKDAGAR * DYGN_MS,
          ...(gastnamn ? { namn: gastnamn } : {}),
          // (0.203.0) Bara ett angivet värde skrivs: utelämnat lämnar gästens sparade nedladdning orörd.
          ...(laddaNed !== undefined ? { laddaNed } : {}),
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

    // En ny rad börjar på SEQUENCE 0. En befintlig rad (Bjud in igen) jämförs mot det som skickades förra gången: ändrades tid eller plats däremellan stiger SEQUENCE.
    const sekvens = deltaUt ? (created ? 0 : await sekvensForUtskick(/** @type {Record<string, any>} */ (row), deltaUt)) : 0;
    await sparaIValv(ny, brevNyckel);
    // ⛔ ETT NUMMER FÅR INGET BREV: länken ligger i valvet, och den som bjöd delar den från sin egen telefon (`kopieraLank`).
    if (kontakt.slag === "telefon") return { id: ny.id, gastId: gId, ny: created, vackt, slag: kontakt.slag };
    await levereraBrev({
      typ: created ? "inbjudan" : "igen",
      till: /** @type {string} */ (epost),
      namn: gastnamn || text(row?.namn),
      lankar: [brevlank(ny, brevNyckel, deltaUt ? { ut: deltaUt, sekvens } : null)],
      skickadAv: skapadAv,
    });
    return { id: ny.id, gastId: gId, ny: created, vackt, slag: kontakt.slag };
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
    const platsSlappt = await slappPlatsOmTom(rad.groupId, radensKontakt(rad));
    return { id, platsSlappt };
  }

  /**
   * (0.203.0, lifehub.app#691, CP-beslut) Slår på eller av nedladdning för EN gäst i gruppen: `pa` skrivs som radens `laddaNed`, och inget annat på raden ändras.
   *
   * ⛔ BARA ÄGARE OCH ADMIN, SOM ATT BJUDA IN TILL HELA GRUPPEN. Att ge en gäst nedladdning ökar vad hen får ta med sig ur gruppen, så det kräver samma roll som att släppa in hen,
   * och den som bjöd men sedan blivit en vanlig medlem får inte ändra det. Samma krav för av som för på: ett enda villkor är lättare att resonera om (som delningens `andraNedladdning`).
   *
   * ⛔ VÄRDET ÄR HELA REGELN (0.204.0, `nedladdningTillaten`): `true` ger gästen nedladdning och `false` tar den, och ingen inställning på gruppen står över. En återkallad inbjudan får
   * ändras: värdet står kvar till nästa Bjud in igen och ger ingenting så länge raden är återkallad.
   *
   * @param {Record<string, any>} b `{ uid, id, pa }`, där `id` är inbjudans id och `pa` är `true` eller `false`.
   * @returns {Promise<{ id: string, laddaNed: boolean }>}
   */
  async function sattNedladdning(b) {
    const uid = kravText(b?.uid, "uid", "sattNedladdning");
    const id = kravText(b?.id, "id", "sattNedladdning");
    if (typeof b?.pa !== "boolean") throw felMedKod("ogiltigt-omfang", "sattNedladdning: pa ska vara sant eller falskt.");
    const pa = b.pa;
    if (!GASTINBJUDNINGSIDFORM.test(id)) throw felMedKod("finns-inte", "sattNedladdning: id är en hash på 64 hextecken.");
    const rad = await kalla.read(INB, id);
    if (!rad) throw felMedKod("finns-inte", `sattNedladdning: inbjudan "${id}" finns inte.`);
    if (rad.omfang?.slag !== "grupp") throw felMedKod("ogiltigt-omfang", `sattNedladdning: inbjudan "${id}" gäller en sak och inte hela gruppen. En sak har inget bibliotek att ladda ned ur.`);
    if (!(await forvaltar(uid, rad.groupId))) throw felMedKod("ej-behorig", `sattNedladdning: ${uid} är inte aktiv ägare eller admin i gruppen "${rad.groupId}". Bara de ändrar en gästs nedladdning.`);
    // Villkorad på att raden fortfarande hör till samma grupp: en rad som raderats under tiden ger `finns-inte` och skapas aldrig på nytt av en uppdatering.
    const { updated } = await uppdateraOm(INB, id, { groupId: rad.groupId }, { laddaNed: pa });
    if (!updated) throw felMedKod("finns-inte", `sattNedladdning: inbjudan "${id}" togs bort medan ändringen gjordes.`);
    return { id, laddaNed: pa };
  }

  /**
   * Prövningen som `skickaOm` och `kopieraLank` delar (en sanning, regel 2): giltigt id, raden finns, medlemmen får förvalta den, ägare eller admin för en gruppinbjudan och inte återkallad.
   *
   * @param {Record<string, any>} b `{ uid, id }`.
   * @param {string} metod Metodens namn, för felmeddelandena.
   * @returns {Promise<{ uid: string, rad: Record<string, any> }>}
   */
  async function provaForvaltning(b, metod) {
    const uid = kravText(b?.uid, "uid", metod);
    const id = kravText(b?.id, "id", metod);
    if (!GASTINBJUDNINGSIDFORM.test(id)) throw felMedKod("finns-inte", `${metod}: id är en hash på 64 hextecken.`);
    const rad = await kalla.read(INB, id);
    if (!rad) throw felMedKod("finns-inte", `${metod}: inbjudan "${id}" finns inte.`);
    await kravForvalta(uid, rad, metod);
    // ⛔ ATT SKICKA OM EN GRUPPINBJUDAN ÄR ATT GE NY ÅTKOMST TILL HELA GRUPPEN, så det kräver ägare eller admin NU. Den som bjöd och sedan blev en vanlig medlem får fortfarande dra tillbaka
    // (en dörr hen öppnat ska hen kunna stänga) men inte öppna den igen. Samma krav gäller att få länken (`kopieraLank`): en länk är en dörr, vare sig den skickas eller kopieras.
    if (rad.omfang?.slag === "grupp" && !(await forvaltar(uid, rad.groupId))) {
      throw felMedKod("ej-behorig", `${metod}: ${uid} är inte ägare eller admin i gruppen. Bara de ${metod === "kopieraLank" ? "hämtar länken till" : "skickar"} en gruppinbjudan.`);
    }
    if (rad.aterkallad !== null) throw felMedKod("aterkallad", `${metod}: inbjudan "${id}" är återkallad. Bjud in på nytt.`);
    return { uid, rad };
  }

  /**
   * Skickar en ny länk till en aktiv inbjudan. Nyckeln roteras, så den gamla länken slutar fungera. Platsen bekräftas, så att ett utskick också lagar en plats som
   * en samtidig återkallelse tömde. En återkallad inbjudan skickas inte om: väck den med `bjud`, som tar en plats på nytt.
   *
   * ⛔ (0.197.0) EN TELEFONINBJUDAN FÅR EN NY LÄNK OCH INGET BREV: nyckeln roteras och sparas i valvet, och svaret bär `slag: "telefon"` så att vyn hämtar den nya länken (`kopieraLank`) och erbjuder Dela.
   * Utan valv `ej-konfigurerad`, innan något ändras.
   *
   * @param {Record<string, any>} b `{ uid, id }`.
   * @returns {Promise<{ id: string, slag: "epost" | "telefon" }>}
   */
  async function skickaOm(b) {
    const { uid, rad } = await provaForvaltning(b, "skickaOm");
    const id = rad.id;
    const kontakt = radensKontakt(rad);
    if (kontakt.slag === "telefon") {
      if (!VALV) throw felMedKod("ej-konfigurerad", "skickaOm: en inbjudan med telefon har inget brev, och utan lankvalv går en ny länk inte att ge.");
      await tagPlats(rad.groupId, gastId(kontakt));
      await roteraNyckel(rad);
      return { id, slag: kontakt.slag };
    }
    // ⛔ EN DELTA-INBJUDAN PÅ EN HÄNDELSE SOM FÖRSVUNNIT SKICKAS INTE OM: länken i brevet leder till en sida som säger att det inte finns. Rosta-inbjudan är som förut.
    const delta = rad.omfang?.funktion === "delta" && DELTA ? deltaHandelseUt(await lasHandelse(rad.omfang.handelseId, "skickaOm")) : null;
    await tagPlats(rad.groupId, gastId(kontakt));
    const { rad: ny, nyckel } = await roteraNyckel(rad);
    const sekvens = delta ? await sekvensForUtskick(ny, delta) : 0;
    const medlem = await aktivtMedlemskap(uid, rad.groupId);
    await levereraBrev({
      typ: "igen",
      till: ny.epost,
      namn: text(ny.namn),
      lankar: [brevlank(ny, nyckel, delta ? { ut: delta, sekvens } : null)],
      skickadAv: { uid, namn: text(medlem?.namn) || text(rad.skapadAv?.namn) },
    });
    return { id, slag: kontakt.slag };
  }

  /**
   * ⛔ DEN ANDRA VÄGEN UT FÖR EN NYCKEL (CP 2026-11-05: "Man kan behöva ge länken igen för de som fibblar bort den"). Ger SAMMA länk som i mejlet, ur valvet (`lankvalv`): ingen rotation, ingen plats, inget brev,
   * och raden ändras inte. Samma krav som Skicka igen, och dessutom: länken får inte ha gått ut (`utgangen`; då behövs en ny, alltså Skicka igen), valvet måste vara på (`ej-konfigurerad`) och ha en kopia
   * som hör till inbjudans nuvarande nyckel (`ingen-kopia`: en inbjudan från före valvet, eller en kopia som inte hann sparas när nyckeln roterades).
   *
   * ⛔ (0.197.0) SVARET BÄR `slag` ("epost" eller "telefon"), som appen ger `gastLank`: en telefonlänk bär tecknet som får sidan att fråga efter ett nummer.
   *
   * @param {Record<string, any>} b `{ uid, id }`.
   * @returns {Promise<{ id: string, nyckel: string, lankGiltigTill: number, slag: "epost" | "telefon" }>}
   */
  async function kopieraLank(b) {
    const { rad } = await provaForvaltning(b, "kopieraLank");
    if (!VALV) throw felMedKod("ej-konfigurerad", "kopieraLank: createGastService fick inget lankvalv. Utan det sparas ingen kopia av nyckeln och länken går inte att ge igen.");
    if (typeof rad.lankGiltigTill === "number" && rad.lankGiltigTill < klocka()) throw felMedKod("utgangen", `kopieraLank: länken till "${rad.id}" har gått ut. Skicka igen för en ny.`);
    const nyckel = await VALV.hamta({ id: rad.id, groupId: rad.groupId });
    // ⛔ KOPIAN MÅSTE HÖRA TILL RADENS NUVARANDE NYCKEL. En kopia som inte matchar hashen är en gammal länk som inte fungerar, och den får aldrig lämna tjänsten som om den gjorde det.
    if (typeof nyckel !== "string" || nyckel === "" || gastnyckelHash(nyckel) !== rad.nyckelHash) {
      throw felMedKod("ingen-kopia", `kopieraLank: det finns ingen kopia av den nuvarande länken till "${rad.id}". Skicka igen en gång, sedan går den att kopiera.`);
    }
    return { id: rad.id, nyckel, lankGiltigTill: rad.lankGiltigTill, slag: radensKontakt(rad).slag };
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
   * @param {Record<string, any>} b `{ uid, handelseId, funktion?, harRostat? }` eller `{ uid, groupId, harRostat? }`. `harRostat` är en lista med `gastId` som appen vet har röstat. `funktion` (0.146.0) säger vilka av händelsens
   *   gäster som listas: `rosta` (förval, som förut) eller `delta`. En delta-rad bär gästens svar (`deltasvar`: `kommer`, `kommerInte`, `kanske`, eller `null` så länge hen inte svarat).
   */
  async function lista(b) {
    const uid = kravText(b?.uid, "uid", "lista");
    if (b?.groupId !== undefined && b?.handelseId !== undefined) throw new Error("lista: ange antingen handelseId (en omröstning) eller groupId (hela gruppen), inte båda.");
    if (b?.groupId !== undefined && b?.funktion !== undefined) throw new Error("lista: funktion hör till en händelse (handelseId). Listan över hela gruppen har alla funktioner.");
    const funktion = b?.funktion === undefined ? "rosta" : b.funktion;
    if (!(/** @type {readonly unknown[]} */ (GASTFUNKTIONER)).includes(funktion)) throw new Error(`lista: funktionen ${JSON.stringify(funktion)} finns inte. Giltiga: ${GASTFUNKTIONER.join(", ")}.`);
    const rostat = new Set(Array.isArray(b?.harRostat) ? b.harRostat : []);
    const nu = klocka();
    if (b?.groupId !== undefined) {
      const groupId = kravText(b.groupId, "groupId", "lista");
      if (!(await aktivtMedlemskap(uid, groupId))) throw felMedKod("ej-behorig", `lista: ${uid} är inte aktiv medlem i gruppen "${groupId}".`);
      const alla = (await kalla.list(INB, { where: { groupId } })).sort((x, y) => x.skapad - y.skapad);
      /** @type {Map<string, string>} */
      const titlar = new Map();
      // Rubriken ur appens egen funktion: gruppens om den finns, annars deltas (samma form: `{ titel, ... }`).
      const rubrikur = GS?.handelseSida ?? DELTA?.handelseSida;
      if (rubrikur) {
        for (const hid of new Set(alla.map((r) => r.omfang?.handelseId).filter((x) => typeof x === "string"))) {
          const h = await kalla.read(HANDELSER, hid);
          if (h && h.groupId === groupId) {
            try {
              titlar.set(hid, text(rubrikur(h).titel));
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
        const id = gastIdEllerNull(r);
        if (!id) continue;
        perPerson.set(id, [...(perPerson.get(id) ?? []), r]);
      }
      const personer = [...perPerson.entries()].map(([id, rader]) => {
        const inbjudningar = rader.map((r) => {
          // `harRostat` är appens kunskap om omröstningen: den säger ingenting om en delta-inbjudan.
          // (0.204.0) `laddaNed` på en gruppinbjudan är alltid `true` eller `false`: en rad utan fältet visas som `false`, eftersom den är det (`nedladdningTillaten`). Listan visar aldrig
          // något annat än det servern gör, och `null` ("följer gruppen") finns inte längre när gruppen inte är en del av regeln.
          const visad = { ...r, laddaNed: r.laddaNed === true, titel: titlar.get(r.omfang?.handelseId) ?? null, status: gastStatus(r, { nu, harRostat: rostat.has(id) && r.omfang?.funktion !== "delta" }), omfang: r.omfang?.slag === "grupp" ? { slag: "grupp" } : { slag: r.omfang?.slag, funktion: r.omfang?.funktion, handelseId: r.omfang?.handelseId } };
          // Svaret hör bara till en delta-rad: en omröstnings- och en gruppinbjudan har exakt fälten de hade före 0.146.0.
          // (0.203.0) Nedladdningen hör bara till en gruppinbjudan (`GASTGRUPPLISTFALT`), av samma skäl.
          const falt = r.omfang?.funktion === "delta" ? [...GASTPERSONINBJUDANFALT, ...GASTDELTALISTFALT] : r.omfang?.slag === "grupp" ? [...GASTPERSONINBJUDANFALT, ...GASTGRUPPLISTFALT] : GASTPERSONINBJUDANFALT;
          return Object.fromEntries(falt.map((f) => [f, /** @type {Record<string, any>} */ (visad)[f]]));
        });
        const status = inbjudningar.map((i) => i.status).sort((x, y) => ordning.indexOf(x) - ordning.indexOf(y))[0];
        const senaste = rader[rader.length - 1];
        // (0.197.0) Kontakten som `epost` eller `telefon`, den andra `null`: en person är samma kontakt på alla sina rader (gästens id är kontaktens).
        const kontakt = radensKontakt(senaste);
        const person = { gastId: id, epost: kontakt.slag === "epost" ? kontakt.varde : null, telefon: kontakt.slag === "telefon" ? kontakt.varde : null, namn: text(rader.find((r) => text(r.namn))?.namn), status, inbjudningar };
        return Object.fromEntries(GASTPERSONFALT.map((f) => [f, /** @type {Record<string, any>} */ (person)[f]]));
      });
      return { personer, platser: await platsLage(groupId) };
    }
    const handelseId = kravText(b?.handelseId, "handelseId", "lista");
    const h = await lasHandelse(handelseId, "lista");
    const groupId = text(h.groupId);
    if (!(await aktivtMedlemskap(uid, groupId))) throw felMedKod("ej-behorig", `lista: ${uid} är inte aktiv medlem i gruppen "${groupId}".`);
    const rader = (await kalla.list(INB, { where: { groupId } })).filter((r) => r.omfang?.handelseId === handelseId && r.omfang?.funktion === funktion).sort((x, y) => x.skapad - y.skapad);
    const gaster = rader.map((r) => {
      const id = gastId(radensKontakt(r));
      /** @type {Record<string, any>} */
      const ut = {};
      const visad = { epost: null, telefon: null, ...r, gastId: id, status: gastStatus(r, { nu, harRostat: rostat.has(id) && funktion !== "delta" }) };
      for (const f of funktion === "delta" ? [...GASTLISTFALT, ...GASTDELTALISTFALT] : GASTLISTFALT) ut[f] = /** @type {Record<string, any>} */ (visad)[f];
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
   * Löser in en länk: nyckeln stämmer, inbjudan är aktiv och länken har inte gått ut. Svaret är en sessionsnyckel som gästen sparar i webbläsaren.
   *
   * ⛔ (0.200.0) NYCKELN RÄCKER, GÄSTEN SKRIVER INGENTING. QA 2026-11-07 och CP samma dag: gästen ska "komma direkt in ... hoppa över att bekräfta med mailen", och det ska vara "SUPERSIMPELT". Second opinion (Fable,
   * cllp/ops-framework#540) visade varför adressteget kostade mer än det skyddade: mejlet öppnas ofta i mejlappens egen webbvy, som har sin egen lagring, och gästen fick skriva adressen på nytt i varje
   * webbläsare. Nyckeln är 32 slumpbyte och räknas per inbjudan och per IP: den går inte att gissa. Det som återstår är en vidarebefordrad länk, och den syns i gästlistan och stängs med Dra tillbaka.
   * En kontakt i anropet (`epost`, `telefon`, från en sida före 0.200.0) läses aldrig: den jämförs inte och kan inte ge ett nej.
   *
   * ⛔ LÄNKEN FÖRBRUKAS INTE. Samma länk går att lösa in många gånger, och varje gång ger en ny session: mejlappen, Safari och datorn fungerar alla med samma länk. Den gäller tills den går ut
   * (`GASTLANKDAGAR`) eller en medlem skickar en ny (nyckeln roteras och den gamla slutar fungera).
   *
   * Fel nyckel och okänd inbjudan är samma `nej` byte för byte, och fel nyckel räknas mot inbjudan och IP:n. `aterkallad` och `utgangen` ges först när nyckeln stämde.
   *
   * @param {Record<string, any>} b `{ id, nyckel, ip }`.
   * @returns {Promise<{ ok: true, sessionsnyckel: string } | { ok: false, orsak: Gastorsak }>}
   */
  async function los(b) {
    const provat = await provaLank(b, "los");
    if (!provat.ok) return provat;
    const sessionsnyckel = await oppnaSession(provat.id);
    return { ok: true, sessionsnyckel };
  }

  /**
   * (0.202.0) Prövar en länk utan att lösa in den: samma prövning, samma räknare och samma svar som `los`, men ingen session skapas och ingenting märks.
   *
   * ⛔ VARFÖR (QA 2026-11-07, punkt 3 i cllp/lifehub.app#687): en ändrad eller gammal länk visade först Välkommen och Öppna, och felet kom först efter trycket. Sidan frågar nu när den
   * laddas och visar felet direkt. Att sidan inte LÖSER IN länken vid sidladdningen står kvar (0.200.0): en mejlskanner som öppnar länken ska inte skapa en session. Den här frågan skapar
   * ingenting, och fel nyckel räknas som i `los`, så den är inget nytt sätt att gissa.
   *
   * @param {Record<string, any>} b `{ id, nyckel, ip }`.
   * @returns {Promise<{ ok: true } | { ok: false, orsak: Gastorsak }>}
   */
  async function prova(b) {
    const provat = await provaLank(b, "prova");
    return provat.ok ? { ok: true } : provat;
  }

  /**
   * Prövningen `los` och `prova` delar (regel 2: en prövning, inte två som kan glida isär). Räknaren per IP är densamma för båda.
   * @param {Record<string, any>} b
   * @param {string} vad Anropets namn i felet när IP saknas.
   * @returns {Promise<{ ok: true, id: string } | { ok: false, orsak: Gastorsak }>}
   */
  async function provaLank(b, vad) {
    const ipHash = ipId(b?.ip, vad, "los");
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
    if (!likaHash(hash(nyckel), rad.nyckelHash)) return nej();

    // Nyckeln stämde: det här är gästen, eller någon gästen gett länken. Försöket ges tillbaka, eftersom det inte var en gissning som missade.
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

    await ge();
    return { ok: true, id };
  }

  /**
   * Skapar sessionen för en inbjudan och märker första inloggningen. ⛔ DET ENDA STÄLLET EN SESSION BLIR TILL (regel 2): länken (`los`) och den inloggade personens väg (`oppnaGruppgast`) ger samma form,
   * och en session som bara kan nås genom ett av dem hade varit en andra sorts session.
   * @param {string} id Inbjudans id.
   * @returns {Promise<string>} Sessionsnyckeln. Den lämnar tjänsten bara som returvärde till anroparen, aldrig i en logg.
   */
  async function oppnaSession(id) {
    const sessionsnyckel = nyGastnyckel();
    const nu = klocka();
    await skapaNy(SESS, { id: gastnyckelHash(sessionsnyckel), inbjudningId: id, skapad: nu, senast: nu });
    await uppdateraOm(INB, id, { forstInloggad: null }, { forstInloggad: nu });
    return sessionsnyckel;
  }

  /**
   * Gruppgästinbjudningarna som en INLOGGAD person har, för hubbens grupplista (cllp/lifehub.app#658 punkt 0): gruppen, och det minsta en lista behöver.
   *
   * ⛔ ADRESSEN MÅSTE VARA BEVISAD AV ANROPAREN (`epostBekraftad: true`) OCH ÄR ANNARS INGEN ADRESS. En obekräftad adress ger en tom lista, aldrig ett fel: ett fel hade låtit en person fråga vilka adresser som
   * har en inbjudan. Ramverket kan inte själv se vad inloggningen bevisat, så anroparen säger det, på samma sätt som `epostVerifierad` till medlemsaccepten.
   *
   * ⛔ BARA LEVANDE INBJUDNINGAR TILL HELA GRUPPEN: inte återkallad och gruppen finns. ⛔ LÄNKENS GILTIGHET (`lankGiltigTill`, `GASTLANKDAGAR`) GÄLLER INTE HÄR. Den skyddar mejllänkens nyckel, som kan ha hamnat hos fel person. Här är beviset den
   * bekräftade adressen, samma bevis som `nyLank` använder för att skicka en ny länk, och en gäst som inte svarat på 30 dagar ska inte försvinna ur hubben för att mejlet blev gammalt. En inbjudan till en omröstning eller en händelse är inte en grupp och listas inte.
   * ⛔ INGEN ADRESS, INGET NAMN PÅ ANDRA OCH INGEN NYCKEL I SVARET: `{ id, groupId, namn }`, med gruppens namn ur appens egen läsning.
   *
   * @param {Record<string, any>} b `{ epost, epostBekraftad }`.
   * @returns {Promise<{ gruppgaster: Array<{ id: string, groupId: string, namn: string }> }>}
   */
  async function minaGruppgaster(b) {
    if (b?.epostBekraftad !== true) return { gruppgaster: [] };
    const epost = normaliseraGastepost(b?.epost, extraSparrade);
    if (epost === null || !GS) return { gruppgaster: [] };
    const rader = (await kalla.list(INB, { where: { epost } })).filter((r) => r.omfang?.slag === "grupp" && r.aterkallad === null);
    /** @type {Array<{ id: string, groupId: string, namn: string }>} */
    const ut = [];
    for (const r of rader) {
      const g = await kalla.read(GS.samlingar.grupper, r.groupId);
      if (!g) continue;
      ut.push({ id: String(r.id), groupId: String(r.groupId), namn: text(g.namn) });
    }
    return { gruppgaster: ut.sort((x, y) => x.namn.localeCompare(y.namn, "sv") || x.id.localeCompare(y.id)) };
  }

  /**
   * Öppnar gruppen som gäst för en INLOGGAD person, utan mejllänken: samma session som `los` ger, mot samma tak och med samma felräknare per IP (`GASTIP_MAX`), och inget medlemskap skrivs.
   *
   * ⛔ BEVISET ÄR DEN BEKRÄFTADE ADRESSEN I STÄLLET FÖR NYCKELN. `epostBekraftad: true` och en adress som är inbjudans, jämförd i konstant tid (alla villkor prövas alltid). Fel adress, obekräftad adress,
   * okänd inbjudan och en inbjudan av fel slag är samma `nej` byte för byte. `aterkallad` ges först när adressen stämde, som `los` ger den först när nyckeln stämde.
   * ⛔ LÄNKENS GILTIGHET PRÖVAS INTE (ingen `utgangen`): den skyddar mejllänkens nyckel, och här bevisar den bekräftade adressen, som när `nyLank` skickar en ny länk.
   * ⛔ INGEN RÄKNARE PÅ INBJUDAN, BARA PÅ IP. Räknaren per inbjudan i `los` skyddar en nyckel som går att gissa. Här är det adressen som bevisar, och en främmande inloggad person som fick ett inbjudnings-id
   * hade kunnat låsa ute gästen genom att misslyckas på den. IP-taket gäller ändå, och ett lyckat anrop ger tillbaka sitt försök.
   *
   * @param {Record<string, any>} b `{ id, epost, epostBekraftad, ip }`.
   * @returns {Promise<{ ok: true, sessionsnyckel: string } | { ok: false, orsak: Gastorsak }>}
   */
  async function oppnaGruppgast(b) {
    const ipHash = ipId(b?.ip, "oppnaGruppgast", "los");
    const ipRes = await reserveraRaknare(ipHash, { max: GASTIP_MAX, fonsterMs: GASTIP_FONSTER_MS });
    if (!ipRes) return orsak("for-manga");
    const id = b?.id;
    if (typeof id !== "string" || !GASTINBJUDNINGSIDFORM.test(id)) return nej();
    const rad = await kalla.read(INB, id);
    if (!rad) return nej();
    const epost = normaliseraGastepost(b?.epost, extraSparrade);
    // Båda jämförelserna görs alltid, så att tiden inte säger vilken av dem som var fel.
    const epostStammer = epost !== null && likaHash(hash(epost), hash(text(rad.epost)));
    if (b?.epostBekraftad !== true || !epostStammer || rad.omfang?.slag !== "grupp" || !GS) return nej();
    const ge = () => aterlamna(RAKNARE, ipRes.id, RAKNEFALT, ipRes.fonster);
    if (rad.aterkallad !== null) {
      await ge();
      return orsak("aterkallad");
    }
    const sessionsnyckel = await oppnaSession(id);
    await ge();
    return { ok: true, sessionsnyckel };
  }

  /**
   * Prövar en session: den finns, har inte stått oanvänd i `GASTSESSIONSDAGAR` dagar, och dess inbjudan finns och är aktiv. Läser inbjudan på nytt varje gång.
   *
   * @param {Record<string, any>} b `{ sessionsnyckel, krav?: { slag?, funktion } }`. `krav` är vad anropet gäller: en inbjudan som inte ger funktionen (eller inte är av slaget) nekas som en okänd session.
   * @returns {Promise<{ ok: true, gastId: string, inbjudan: { id: string, groupId: string, slag: "sak" | "grupp", handelseId: string | null, funktion: string, namn: string, laddaNed?: boolean } } | { ok: false, orsak: Gastorsak }>}
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
      gastId: gastId(radensKontakt(rad)),
      inbjudan: {
        id: rad.id,
        groupId: rad.groupId,
        slag: /** @type {"sak" | "grupp"} */ (grupplage ? "grupp" : "sak"),
        handelseId: grupplage ? null : rad.omfang.handelseId,
        funktion: grupplage ? "grupp" : rad.omfang.funktion,
        namn: text(rad.namn),
        // (0.203.0) Bara en gruppsession: gästens egen nedladdning. (0.204.0) Alltid `true` eller `false`, och en rad utan fältet är `false` (`nedladdningTillaten`). En sak har inget sådant fält.
        ...(grupplage ? { laddaNed: rad.laddaNed === true } : {}),
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
    // ⛔ EN DELTA-GÄST FÅR ALDRIG APPENS `sak.bygg`: det är omröstningens kort, med förslag och röster. Hens svar byggs fält för fält ur `GASTDELTAHANDELSEFALT`.
    if (s.inbjudan.funktion === "delta") return hamtaDelta(s);
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
   * Någon ber om en ny länk, på ett av två sätt, och får samma svar hur det än går (`GASTNYLANK_SVAR`):
   *
   *   - `{ epost, ip }`: de skriver sin adress. Har adressen aktiva inbjudningar roteras deras nycklar och ett brev skickas med högst `GASTNYLANK_MAX_LANKAR` länkar.
   *   - `{ id, nyckel, ip }` (0.200.0): de håller en länk, också en som gått ut, och trycker Skicka en ny länk. Stämmer nyckeln, är inbjudan inte återkallad och är dess kontakt en e-postadress, får
   *     inbjudans EGEN adress ett brev med en ny länk till just den inbjudan. Gästen skriver ingenting (CP 2026-11-07: "SUPERSIMPELT", second opinion i cllp/ops-framework#540). En telefoninbjudan får
   *     inget brev: den har ingen adress, och den som bjöd ger en ny med Dela. Fel nyckel räknas mot inbjudan som i `los`, och en rätt nyckel ger tillbaka sitt försök.
   *
   * Båda vägarna har samma tak: `GASTNYLANKIP_MAX` förfrågningar per IP och timme, och `GASTNYLANK_BREV_PER_DYGN` brev per adress och dygn, räknat på adressen oavsett väg. Brevet byggs på ett ställe
   * (`skickaNyaLankar`), så att de två vägarna inte kan börja skicka olika brev (regel 2).
   *
   * ⛔ SVARET ÄR ALLTID `GASTNYLANK_SVAR`. Ett annat svar för en adress som är gäst hade låtit vem som helst fråga vilka adresser som är det, och ett annat svar för en länk hade sagt om
   * nyckeln stämde. Adressen står aldrig i svaret. Ett brev som inte gick att skicka rapporteras (`rapportera`) och syns inte i svaret, av samma skäl.
   *
   * @param {Record<string, any>} b `{ epost, ip }` eller `{ id, nyckel, ip }`.
   * @returns {Promise<{ ok: true, svar: string }>}
   */
  async function nyLank(b) {
    const ipHash = ipId(b?.ip, "nyLank", "nylank");
    const svar = { ok: /** @type {const} */ (true), svar: GASTNYLANK_SVAR };
    if (!(await reserveraRaknare(ipHash, { max: GASTNYLANKIP_MAX, fonsterMs: GASTNYLANKIP_FONSTER_MS }))) return svar;
    if (b?.id !== undefined || b?.nyckel !== undefined) {
      await nyLankForLank(b);
      return svar;
    }
    const epost = normaliseraGastepost(b?.epost, extraSparrade);
    if (epost === null) return svar;
    // ⛔ GRUPPLÄNKEN KOMMER FÖRST (0.132.0). Brevet bär högst `GASTNYLANK_MAX_LANKAR` länkar, och sorterat på `skapad` ensam kan hela gruppen hamna utanför när personen har fler omröstningar: den inbjudan
    // som ger mest är den som inte får tappas. Därefter nyast först, som förut.
    await skickaNyaLankar(epost, async () =>
      (await kalla.list(INB, { where: { epost } }))
        .filter((r) => r.aterkallad === null)
        .sort((x, y) => Number(y.omfang?.slag === "grupp") - Number(x.omfang?.slag === "grupp") || y.skapad - x.skapad)
        .slice(0, GASTNYLANK_MAX_LANKAR),
    );
    return svar;
  }

  /**
   * `nyLank` för den som håller en länk (`{ id, nyckel }`). Svarar ingenting: anroparen ger samma svar oavsett utfall.
   * @param {Record<string, any>} b
   */
  async function nyLankForLank(b) {
    const id = b?.id;
    const nyckel = b?.nyckel;
    if (typeof id !== "string" || !GASTINBJUDNINGSIDFORM.test(id) || typeof nyckel !== "string" || !GASTNYCKELFORM.test(nyckel)) return;
    const rad = await kalla.read(INB, id);
    if (!rad) return;
    const res = await reservera(INB, id, rad, INBFALT, { max: GASTFEL_MAX, fonsterMs: GASTFEL_FONSTER_MS });
    if (!res) return;
    // ⛔ (0.202.0, QA 2026-11-07, punkt 4 i cllp/lifehub.app#687) ÄVEN EN NYCKEL SOM HAR GÄLLT FÅR BE OM EN NY LÄNK: sidan "Länken fungerar inte längre" saknade knappen, och gästen med
    // förra brevet kunde inte ta sig vidare. Brevet går bara till inbjudans EGEN adress. En nyckel som aldrig funnits är en gissning: den räknas och får inget brev, som förut.
    const h = hash(nyckel);
    const nu = likaHash(h, rad.nyckelHash);
    const tidigare = !nu && Array.isArray(rad.tidigareNyckelHashar) && rad.tidigareNyckelHashar.some((/** @type {unknown} */ t) => typeof t === "string" && likaHash(h, t));
    if (!nu && !tidigare) return;
    // Nyckeln har gällt: ingen gissning, så försöket ges tillbaka som i `los`.
    await aterlamna(INB, id, INBFALT, res.fonster);
    if (rad.aterkallad !== null) return;
    const kontakt = gastkontaktPaRad(rad);
    if (kontakt?.slag !== "epost") return;
    // Raden läses om i `skickaNyaLankar`: den som lästes ovan har en räknare som just ändrats, och rotationen villkoras på nyckelns hash.
    await skickaNyaLankar(kontakt.varde, async () => {
      const aktuell = await kalla.read(INB, id);
      return aktuell && aktuell.aterkallad === null && aktuell.nyckelHash === rad.nyckelHash ? [aktuell] : [];
    });
  }

  /**
   * Brevet med nya länkar, för båda vägarna i `nyLank`: taket per adress och dygn, nya nycklar (de gamla slutar fungera) och ett brev av typen `ny-lank` till adressen. Fel kastas aldrig ut:
   * de rapporteras, eftersom svaret till den som bad är detsamma hur det än gick.
   * @param {string} epost Adressen brevet går till, normaliserad.
   * @param {() => Promise<Record<string, any>[]>} rader Inbjudningarna som får nya länkar. Läses först när taket släppt igenom.
   */
  async function skickaNyaLankar(epost, rader) {
    if (!(await reserveraRaknare(hash(`nylank-epost|${gastId(epost)}`), { max: GASTNYLANK_BREV_PER_DYGN, fonsterMs: DYGN_MS }))) return;
    const aktiva = await rader();
    if (aktiva.length === 0) return;
    try {
      const lankar = [];
      for (const r of aktiva) {
        // En delta-inbjudan på en händelse som försvunnit får ingen ny länk: den leder ingenstans. (Svaret är ändå detsamma för den som bad, så ingen kan se skillnaden.)
        let delta = null;
        if (r.omfang?.funktion === "delta") {
          const h = DELTA ? await kalla.read(HANDELSER, r.omfang.handelseId) : null;
          if (!h || h.arkiverad === true || h.groupId !== r.groupId) continue;
          delta = deltaHandelseUt(h);
        }
        const { rad, nyckel } = await roteraNyckel(r);
        lankar.push(brevlank(rad, nyckel, delta ? { ut: delta, sekvens: await sekvensForUtskick(rad, delta) } : null));
      }
      if (lankar.length === 0) return;
      await skicka({ typ: "ny-lank", till: epost, namn: text(aktiva[0].namn), lankar, skickadAv: null });
    } catch (fel) {
      rapportera(fel);
    }
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
   * Får just den här gästen ladda ned? Gästens egen inställning (0.203.0, lifehub.app#691), och sedan 0.204.0 bara den.
   *
   * ⛔ BARA `true` GER JA. En rad utan fältet, eller med något annat än sant, räknas som nej: det säkra förvalet, samma som för en ny gäst (`bjud`). I 0.203.0 följde en rad utan fältet
   * gruppens strömbrytare (`grupp.farLaddaNed`), och raderna från före 0.203.0 saknade det. Appen bakfyllde dem med just den åtkomst de hade (lifehub.app `bakfyll-gastnedladdning`) innan
   * gruppen togs ur regeln, så att ingen befintlig gäst fick mer eller mindre. En rad som ändå saknar fältet efter det är ett fel i datan, och ett fel ska stänga, inte öppna.
   *
   * ⛔ INGEN LÄSNING AV GRUPPEN. Svaret avgörs av inbjudan som `session` redan läst, och funktionen behöver varken gruppens id eller en fråga till appen.
   *
   * @param {{ laddaNed?: boolean }} inbjudan Sessionens inbjudan (`session`).
   * @returns {boolean}
   */
  function nedladdningTillaten(inbjudan) {
    return inbjudan.laddaNed === true;
  }

  /**
   * `hamta` för en gruppinbjudan: gruppens namn och funktionerna, och inget annat. `nedladdning` är gästens egen inställning (`nedladdningTillaten`).
   * @param {{ gastId: string, inbjudan: { id: string, groupId: string, namn: string, laddaNed?: boolean } }} s
   */
  async function hamtaGrupp(s) {
    if (!GS) return nej();
    if (!(await reserveraAnrop(s.inbjudan.id))) return orsak("for-manga");
    const g = await kalla.read(GS.samlingar.grupper, s.inbjudan.groupId);
    if (!g) return orsak("saknas");
    const svar = { ok: true, namn: s.inbjudan.namn, funktion: "grupp", grupp: vitlista({ namn: text(g.namn), funktioner: [...GS.funktioner], nedladdning: nedladdningTillaten(s.inbjudan), kommentera: Boolean(GS.tradar && GS.bibliotekBas), beskrivning: text(g.beskrivning).slice(0, MAX_GRUPPBESKRIVNING) }, GASTGRUPPSVARSFALT.hamta) };
    return Object.fromEntries(Object.entries(svar).filter(([k]) => /** @type {readonly string[]} */ (GASTSVARSFALT).includes(k)));
  }

  /**
   * @param {string} t
   * @param {number} max
   */
  const kapa = (t, max) => (t.length > max ? `${t.slice(0, max - 1)}…` : t);

  /**
   * Gruppchattens sökväg, och (0.191.0) en tråds.
   * @param {string} groupId
   */
  const chattvag = (groupId) => `${GS?.samlingar.samtal}/${samtalsnyckel({ groupId, slag: "grupp" })}`;
  /** @param {string} groupId */
  const meddelandevag = (groupId) => `${chattvag(groupId)}/${GS?.samlingar.meddelanden}`;
  /** @param {string} groupId */
  const tradvag = (groupId) => `${chattvag(groupId)}/${GS?.tradar}`;
  /** @param {string} groupId @param {string} trad */
  const tradmeddelandevag = (groupId, trad) => `${tradvag(groupId)}/${trad}/${GS?.samlingar.meddelanden}`;

  /**
   * Avsändarna i gruppen, för namnen och för att dölja agenten.
   * @param {string} groupId
   */
  async function chattavsandare(groupId) {
    const medlemmar = await kalla.list(MEDLEMSKAP, { where: { groupId } });
    const namnFor = new Map(medlemmar.filter((m) => typeof m.userId === "string").map((m) => [m.userId, text(m.namn)]));
    const agenter = new Set([agentId(groupId), ...medlemmar.filter((m) => m.typ === "agent" && typeof m.userId === "string").map((m) => m.userId)]);
    return { namnFor, agenter };
  }

  /**
   * (0.191.0, cllp/lifehub.app#663) Korten för länkarna i en text: bara länkar i appens form (`lasBibliotekslank` mot `grupp.bibliotekBas`), till gruppens egen plats, och bara för en post
   * som gästen ser (`gastSerBibliotekspost`, samma som listan). En post på en annan plats, en borttagen post eller en post gästen inte ser ger inget kort, bara texten. Posten läses
   * NÄR CHATTEN LÄSES: titeln lagras aldrig, så en post som bytt namn visar det nya.
   *
   * @param {unknown} t
   * @param {string} groupId
   * @param {Map<string, Promise<any>>} lasta Posterna som redan lästs i det här anropet.
   */
  async function kortFor(t, groupId, lasta) {
    if (!GS?.bibliotekBas) return [];
    const bas = GS.bibliotekBas;
    /** @type {Record<string, any>[]} */
    const ut = [];
    for (const url of adresserIText(t)) {
      if (ut.length >= 2) break;
      const d = lasBibliotekslank(bas, url);
      if (!d || d.plats !== groupId) continue;
      if (!lasta.has(d.postId)) lasta.set(d.postId, kalla.read(GS.samlingar.bibliotek, d.postId));
      const p = await lasta.get(d.postId);
      if (!gastSerBibliotekspost(p, groupId) || p.id !== d.postId) continue;
      ut.push(vitlista({ url, postId: p.id, typ: p.typ, rubrik: trimSomRegeln(p.rubrik), ...(p.typ === "fil" && p.fil && typeof p.fil.mime === "string" ? { mime: text(p.fil.mime) } : {}) }, GASTPOSTKORTFALT));
    }
    return ut;
  }

  /**
   * (0.191.0) Antalet svar gästen ser i meddelandets tråd, eller `null` utan tråd. Agentens svar räknas inte, eftersom gästen inte ser dem. Taket är en sida (`GASTCHATT_SIDA`): fler än så står som det.
   * @param {string} groupId @param {string} mid @param {Set<string>} agenter
   */
  async function antalSvar(groupId, mid, agenter) {
    if (!GS?.tradar) return null;
    if (!(await kalla.read(tradvag(groupId), mid))) return null;
    const rader = await kalla.list(tradmeddelandevag(groupId, mid), { sortBy: "tid", direction: "desc", limit: GASTCHATT_SIDA });
    return rader.filter((m) => !agenter.has(m.av)).length;
  }

  /**
   * Gästernas namn bland raderna: `avNamn`, satt av `skrivChatt`, eller "Gäst".
   * @param {Record<string, any>[]} rader
   */
  const gastnamnI = (rader) => new Map(rader.filter((m) => arGastId(m.av)).map((m) => [m.av, text(m.avNamn) || GASTNAMNLOS]));

  /**
   * Ett meddelande i den form en gäst ser det (`GASTCHATTFALT`). En form för huvudchatten, tråden och roten.
   * @param {Record<string, any>} m
   * @param {{ groupId: string, gastId: string, sida: Record<string, any>[], namnFor: Map<string, string>, agenter: Set<string>, lasta: Map<string, Promise<any>>, medSvar: boolean }} c
   */
  async function chattrad(m, c) {
    // En gäst som skrivit bär sitt namn på meddelandet (`avNamn`, satt av `skrivChatt`) eller "Gäst". Märket Gäst härleds ur `av` (`arGastId`) och ingenting annat.
    const gastnamn = gastnamnI(c.sida);
    /** @param {unknown} uid */
    const namnPa = (uid) => (typeof uid === "string" && (c.namnFor.get(uid) || gastnamn.get(uid))) || GASTTIDIGAREMEDLEM;
    const ut = {
      id: m.id,
      av: { namn: namnPa(m.av) },
      text: typeof m.text === "string" ? m.text : "",
      tid: m.tid,
      gast: arGastId(m.av),
      egen: m.av === c.gastId,
    };
    /** @type {Record<string, any>} */
    const extra = {};
    if (Array.isArray(m.namner) && m.namner.length > 0) extra.namner = m.namner.filter((/** @type {unknown} */ x) => typeof x === "string").map((/** @type {string} */ x) => (x === NAMNER_ALLA ? NAMNER_ALLA : namnPa(x)));
    const citerad = typeof m.svarPa === "string" ? c.sida.find((x) => x.id === m.svarPa) : null;
    if (citerad) extra.svarPa = { id: citerad.id, namn: namnPa(citerad.av), text: kapa(typeof citerad.text === "string" ? citerad.text : "", 140) };
    if (m.bilaga && typeof m.bilaga === "object") extra.bilaga = { namn: text(m.bilaga.namn), typ: text(m.bilaga.typ) };
    const [kort, svar] = await Promise.all([kortFor(m.text, c.groupId, c.lasta), c.medSvar ? antalSvar(c.groupId, m.id, c.agenter) : Promise.resolve(null)]);
    if (kort.length > 0) extra.kort = kort;
    if (typeof svar === "number" && svar > 0) extra.svar = svar;
    return vitlista({ ...ut, ...extra }, GASTCHATTFALT);
  }

  /**
   * Gruppens chatt, hela historiken, en sida åt gången (`GASTCHATT_SIDA`), äldst överst. `fore` (millisekunder) ger sidan före det äldsta gästen läst. `nyast` är en ping:
   * finns inget nyare svarar den `ingetNytt` med en läsning.
   *
   * ⛔ BARA GRUPPENS EGET SAMTAL, byggt ur sessionens grupp (`samtalsnyckel`): aldrig ett privat samtal, aldrig agentens. Agentens egna meddelanden döljs (CP:s beslut 6 stryker Ekonomi,
   * och agenten svarar i gruppchatten med innehåll därifrån). Ett medlemsmeddelande som citerar agenten går inte att filtrera, och ingen påstår något annat.
   *
   * ⛔ TRÅDAR (0.191.0, cllp/lifehub.app#663, med `grupp.samlingar.tradar`): ett meddelande bär `svar`, antalet svar gästen ser i dess tråd. Med `trad` (rotmeddelandets id) läses tråden i
   * stället: `rot` är rotmeddelandet och `meddelanden` svaren, i samma vitlistade form som huvudchatten, en sida åt gången med samma `fore`. En rot som inte finns, eller som agenten skrev,
   * ger `rot: null` och inga svar: samma svar som en tråd ingen svarat i, så att ett id gästen inte ser inte går att skilja från ett som inte finns. Agentens svar i en tråd döljs som i chatten.
   * Pingen (`nyast`) gäller huvudchatten: ett nytt svar i en tråd syns när chatten eller tråden läses om.
   *
   * ⛔ KORTEN (0.191.0, med `grupp.bibliotekBas`): ett meddelande med en länk till en post i gruppens bibliotek bär ett kort (`kort`), byggt ur posten när chatten läses och bara för en post
   * gästen ser (`kortFor`).
   *
   * @param {Record<string, any>} b `{ sessionsnyckel, fore?, nyast?, trad? }`.
   */
  async function chatt(b) {
    const s = await gruppSession(b, "chatt");
    if (!s.ok || !GS) return s.ok ? nej() : s;
    for (const f of /** @type {const} */ (["fore", "nyast"])) {
      if (b?.[f] !== undefined && !Number.isFinite(b[f])) throw new Error(`chatt: ${f} är ett tal, millisekunder.`);
    }
    const groupId = s.inbjudan.groupId;
    if (b?.trad !== undefined) return lasTrad(s, b);
    const vag = meddelandevag(groupId);
    if (b?.nyast !== undefined) {
      const [sen] = await kalla.list(vag, { sortBy: "tid", direction: "desc", limit: 1 });
      if (!sen || !(sen.tid > b.nyast)) return { ok: true, meddelanden: [], fler: false, ingetNytt: true };
    }
    const rader = await kalla.list(vag, { sortBy: "tid", direction: "desc", limit: GASTCHATT_SIDA + 1, ...(b?.fore !== undefined ? { fore: { falt: "tid", varde: b.fore } } : {}) });
    const fler = rader.length > GASTCHATT_SIDA;
    const sida = rader.slice(0, GASTCHATT_SIDA).reverse();
    const { namnFor, agenter } = await chattavsandare(groupId);
    const c = { groupId, gastId: s.gastId, sida, namnFor, agenter, lasta: new Map(), medSvar: true };
    const meddelanden = await Promise.all(sida.filter((m) => !agenter.has(m.av)).map((m) => chattrad(m, c)));
    return vitlista({ ok: true, meddelanden, fler }, GASTGRUPPSVARSFALT.chatt);
  }

  /**
   * Ett tråd-id från en gäst: ett dokument-id, utan snedstreck. Kastar annars, med koden för en felaktig text (400).
   * @param {unknown} v
   * @param {string} vad
   */
  function kravTrad(v, vad, falt = "trad") {
    if (typeof v !== "string" || v === "" || v.length > 200 || v.includes("/") || v === "." || v === "..") throw felMedKod("ogiltig-text", `${vad}: ${falt} är ${falt === "trad" ? "rotmeddelandets" : "det citerade meddelandets"} id.`);
    return v;
  }

  /**
   * (0.191.0) Tråden ur rotmeddelandet `b.trad`, för `chatt({ trad })`. Se `chatt`.
   * @param {{ gastId: string, inbjudan: { groupId: string } }} s
   * @param {Record<string, any>} b
   */
  async function lasTrad(s, b) {
    if (!GS?.tradar) return nej();
    const trad = kravTrad(b.trad, "chatt");
    const groupId = s.inbjudan.groupId;
    const { namnFor, agenter } = await chattavsandare(groupId);
    const rot = await kalla.read(meddelandevag(groupId), trad);
    if (!rot || agenter.has(rot.av)) return vitlista({ ok: true, rot: null, meddelanden: [], fler: false }, GASTGRUPPSVARSFALT.chatt);
    const rader = await kalla.list(tradmeddelandevag(groupId, trad), { sortBy: "tid", direction: "desc", limit: GASTCHATT_SIDA + 1, ...(b?.fore !== undefined ? { fore: { falt: "tid", varde: b.fore } } : {}) });
    const fler = rader.length > GASTCHATT_SIDA;
    const sida = rader.slice(0, GASTCHATT_SIDA).reverse();
    const c = { groupId, gastId: s.gastId, sida: [rot, ...sida], namnFor, agenter, lasta: new Map(), medSvar: false };
    const [rotUt, ...meddelanden] = await Promise.all([rot, ...sida.filter((m) => !agenter.has(m.av))].map((m) => chattrad(m, c)));
    return vitlista({ ok: true, rot: rotUt, meddelanden, fler }, GASTGRUPPSVARSFALT.chatt);
  }

  /**
   * Gästens text, prövad: inga andra fält än de listade, inte tom och inte över taket. Prövas FÖRE takten, så att ett avvisat försök inte kostar en plats i minuten.
   * @param {Record<string, any>} b
   * @param {string} vad
   */
  function gastText(b, vad, { medCitat = false } = {}) {
    for (const f of ["bilaga", "svarPa", "namner", "av", "tid"]) {
      if (f === "svarPa" && medCitat) continue;
      if (b?.[f] !== undefined) throw felMedKod("ogiltig-text", `${vad}: "${f}" kan en gäst inte skicka. En gäst skriver bara text.`);
    }
    const t = typeof b?.text === "string" ? b.text.trim() : "";
    if (t === "") throw felMedKod("ogiltig-text", `${vad}: texten är tom.`);
    if (t.length > GASTSKRIV_MAX_TECKEN) throw felMedKod("ogiltig-text", `${vad}: texten är ${t.length} tecken, taket är ${GASTSKRIV_MAX_TECKEN}.`);
    return t;
  }

  /**
   * (0.191.0) Öppnar tråden ur roten `trad` om den inte finns. Unikheten är id:t (`createNew`): två som öppnar samtidigt får samma tråd. ⛔ `skapadAv` är gästens `g_`-id, och
   * raderingen byter det (`raderaTradsvar`): en tråd som bär gästens id efter en radering hade varit en uppgift kvar.
   * @param {string} groupId @param {string} trad @param {string} gId @param {number} tid
   */
  async function oppnaTradForGast(groupId, trad, gId, tid) {
    await skapaNy(tradvag(groupId), { id: trad, skapad: tid, skapadAv: gId });
  }

  /**
   * Gästen skriver ett meddelande i gruppens chatt (0.132.0, CP 2026-10-20: "Gästen får skriva"), och (0.191.0, med `grupp.samlingar.tradar`) ett svar i en tråd (`trad`).
   *
   * ⛔ SERVERN SKRIVER, ALDRIG KLIENTEN, OCH ALDRIG SOM EN MEDLEM. Meddelandet får `av` = gästens `g_`-id (inget uid), gästens namn som `avNamn` och inget annat fält: ingen bilaga,
   * inga omnämnanden, och citat (`svarPa`) bara i gruppens chatt, inte i en tråd (0.196.0, se nedan). Märket Gäst härleds ur `av` (`arGastId`) i medlemmarnas chatt, så det kan inte saknas på ett meddelande en gäst skrivit och inte läggas på ett en medlem skrev.
   * En klient kan inte skriva raden: reglernas `av == request.auth.uid` och `hasOnly` nekar ett `g_`-id och ett `avNamn`.
   *
   * ⛔ ETT SVAR I EN TRÅD KRÄVER EN ROT SOM GÄSTEN SER: ett meddelande i gruppens chatt som inte är agentens. Annars `saknas`, samma svar som för en rot som inte finns.
   *
   * ⛔ SAMMA KRAV SOM ATT LÄSA (`chatt`): `gruppSession(b, "chatt")` läser sessionen OCH inbjudan på nytt, så en återkallad eller utgången gäst nekas vid nästa försök, och en omröstningsgäst
   * (som inte har `chatt`) nekas alltid. Texten prövas FÖRE takten, så ett avvisat försök inte kostar ett av de tio meddelandena i minuten.
   *
   * Taket på texten är `GASTSKRIV_MAX_TECKEN` och takten `GASTSKRIV_PER_MINUT` per inbjudan, i `gastraknare` som de andra räknarna (id = hash av `gastskriv|<inbjudan>`). En bilaga kastas
   * tillbaka: #389 stryker uppladdning för gäster.
   *
   * ⛔ CITAT I GRUPPENS CHATT (0.196.0, CP 2026-11-06 via koordinatorn: "Det enda jag undrar är chatt trådar. Finns ju i appen idag."): `svarPa` är id:t på ett meddelande i gruppens chatt som gästen ser
   * (inte agentens), samma fält som medlemmarnas citat (`svarPa` i `samtal.js`). Ett id som inte finns, eller som är agentens, ger `saknas` och inget skrivs. I en tråd nekas citatet som förut
   * (`ogiltig-text`): gästens tråd har inget citat, och den regeln står kvar. Förut nekades citatet överallt ("En gäst skriver bara text").
   *
   * @param {Record<string, any>} b `{ sessionsnyckel, text, trad?, svarPa? }`.
   */
  async function skrivChatt(b) {
    const s = await gruppSession(b, "chatt");
    if (!s.ok || !GS) return s.ok ? nej() : s;
    const trad = b?.trad === undefined ? null : kravTrad(b.trad, "skrivChatt");
    const t = gastText(b, "skrivChatt", { medCitat: trad === null });
    const svarPa = b?.svarPa === undefined ? null : kravTrad(b.svarPa, "skrivChatt", "svarPa");
    if (trad !== null && !GS.tradar) return nej();
    const groupId = s.inbjudan.groupId;
    if (trad !== null) {
      const rot = await kalla.read(meddelandevag(groupId), trad);
      if (!rot || (await chattavsandare(groupId)).agenter.has(rot.av)) return orsak("saknas");
    }
    /** @type {Record<string, any> | null} */
    let citerad = null;
    if (svarPa !== null) {
      citerad = await kalla.read(meddelandevag(groupId), svarPa);
      if (!citerad || (await chattavsandare(groupId)).agenter.has(citerad.av)) return orsak("saknas");
    }
    const takt = await reserveraRaknare(hash(`gastskriv|${s.inbjudan.id}`), { max: GASTSKRIV_PER_MINUT, fonsterMs: MINUT_MS });
    if (!takt) return orsak("for-manga");
    const tid = klocka();
    const namn = text(s.inbjudan.namn);
    /** @type {Record<string, any>} */
    const rad = { text: t, av: s.gastId, tid };
    if (namn) rad.avNamn = namn;
    if (svarPa !== null) rad.svarPa = svarPa;
    let sparad;
    try {
      if (trad !== null) await oppnaTradForGast(groupId, trad, s.gastId, tid);
      sparad = await kalla.create(trad !== null ? tradmeddelandevag(groupId, trad) : meddelandevag(groupId), rad);
    } catch (fel) {
      await aterlamna(RAKNARE, takt.id, RAKNEFALT, takt.fonster);
      throw fel;
    }
    /** @type {Record<string, any>} */
    const citat = {};
    if (citerad) {
      // Citatet i svaret i samma form som `chatt` ger det (`chattrad`), så att det syns hos gästen direkt och inte först vid nästa hämtning.
      const { namnFor, agenter } = await chattavsandare(groupId);
      const form = await chattrad({ ...rad, id: sparad.id }, { groupId, gastId: s.gastId, sida: [citerad], namnFor, agenter, lasta: new Map(), medSvar: false });
      if (form.svarPa) citat.svarPa = form.svarPa;
    }
    return vitlista(
      { ok: true, meddelande: vitlista({ id: sparad.id, av: { namn: namn || GASTNAMNLOS }, text: t, tid, gast: true, egen: true, ...citat }, GASTCHATTFALT) },
      GASTGRUPPSVARSFALT.skrivChatt,
    );
  }

  /**
   * Gästen kommenterar en post i gruppens bibliotek (0.191.0, cllp/lifehub.app#663, CP 2026-11-05: "Vi behöver ha kommentarer på artefakter, även för gäster."). Kräver
   * `grupp.samlingar.tradar` och `grupp.bibliotekBas`; utan dem `nej`.
   *
   * ⛔ SAMMA MODELL SOM FÖR EN MEDLEM (`lib/postkommentar.js`): kommentarstråden är ett rotmeddelande i gruppchatten med id `post-<postens id>`. Den första kommentaren SKAPAR roten
   * (`createNew`), med kommentaren och postens länk som text, så att medlemmarna ser posten som kort. Finns roten redan blir kommentaren ett svar i dess tråd. Två som skriver samtidigt:
   * den som får "finns redan" skriver som svar. Ingen läsning före skrivningen avgör något.
   *
   * ⛔ BARA EN POST GÄSTEN SER (`gastSerBibliotekspost`, samma som listan): en annan plats, en annan grupps post eller en post som inte finns är `saknas`. Bara text, samma tak och samma
   * takt som chatten (`gastText`, `gastskriv`).
   *
   * @param {Record<string, any>} b `{ sessionsnyckel, postId, text }`.
   */
  async function kommenteraPost(b) {
    const s = await gruppSession(b, "chatt");
    if (!s.ok || !GS) return s.ok ? nej() : s;
    if (!GS.tradar || !GS.bibliotekBas) return nej();
    const t = gastText(b, "kommenteraPost");
    const groupId = s.inbjudan.groupId;
    const postId = typeof b?.postId === "string" ? b.postId : "";
    const post = postId ? await kalla.read(GS.samlingar.bibliotek, postId) : null;
    if (!gastSerBibliotekspost(post, groupId) || post.id !== postId) return orsak("saknas");
    const takt = await reserveraRaknare(hash(`gastskriv|${s.inbjudan.id}`), { max: GASTSKRIV_PER_MINUT, fonsterMs: MINUT_MS });
    if (!takt) return orsak("for-manga");
    const tid = klocka();
    const namn = text(s.inbjudan.namn);
    const rot = kommentarRotId(postId);
    /** @type {Record<string, any>} */
    const forsta = { id: rot, text: kommentarRotText(t, bibliotekslank(GS.bibliotekBas, { plats: groupId, postId })), av: s.gastId, tid };
    if (namn) forsta.avNamn = namn;
    /** @type {Record<string, any>} */
    let sparad;
    let somRot = false;
    try {
      const svar = await skapaNy(meddelandevag(groupId), forsta);
      if (svar.created) {
        sparad = svar.row;
        somRot = true;
      } else {
        /** @type {Record<string, any>} */
        const rad = { text: t, av: s.gastId, tid };
        if (namn) rad.avNamn = namn;
        await oppnaTradForGast(groupId, rot, s.gastId, tid);
        sparad = await kalla.create(tradmeddelandevag(groupId, rot), rad);
      }
    } catch (fel) {
      await aterlamna(RAKNARE, takt.id, RAKNEFALT, takt.fonster);
      throw fel;
    }
    const c = { groupId, gastId: s.gastId, sida: [sparad], namnFor: new Map(), agenter: new Set(), lasta: new Map(), medSvar: false };
    return vitlista({ ok: true, rot: somRot, meddelande: await chattrad({ ...sparad, av: s.gastId, avNamn: namn }, c) }, GASTGRUPPSVARSFALT.kommenteraPost);
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
   * Gruppens händelser som en gäst ser dem (`handelseUt`), i datumordning: ⛔ EN LÄSNING FÖR KALENDERN OCH ÖVERSIKTEN (0.198.0), så att nästa händelse på översikten aldrig är en som kalendern inte visar.
   * Högst `GASTKALENDER_MAX`; `avkortad` och `ejVisade` (en tid som inte går att läsa) räknas här.
   * @param {string} groupId
   */
  async function gruppensHandelser(groupId) {
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
    return { handelser, avkortad, ejVisade };
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
    const { handelser, avkortad, ejVisade } = await gruppensHandelser(groupId);
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
      // ⛔ BARA GÄSTER I GRUPPEN, samma mängd som `levandeGaster` och medlemmens `OpsSvar` räknar. En gäst för en sak (omröstning, delta) har ingen svarsrad här och hade annars alltid räknats som "har inte svarat".
      const gaster = (await kalla.list(INB, { where: { groupId } })).filter((r) => r.aterkallad === null && r.omfang?.slag === "grupp").map((r) => gastIdEllerNull(r)).filter((g) => g !== null);
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

  // ── Delta: svara på en händelse (0.146.0, cllp/ops-framework#445, skiva 1) ──────────────────────────────────────────

  /**
   * Det en `delta`-gäst ser: händelsens rubrik, tid och plats, och sitt eget svar. Inget om gruppen, medlemmarna, andra gäster eller andras svar, och ingen beskrivning.
   * Inbjudan läses på nytt: en återkallad gäst får `aterkallad` här, inte händelsen.
   *
   * @param {{ gastId: string, inbjudan: { id: string, groupId: string, handelseId: string | null, namn: string } }} s Sessionen (ur `session`).
   */
  async function hamtaDelta(s) {
    if (!DELTA) return nej();
    const h = await kalla.read(HANDELSER, /** @type {string} */ (s.inbjudan.handelseId));
    if (!h || h.arkiverad === true || h.groupId !== s.inbjudan.groupId) return orsak("saknas");
    const rad = await kalla.read(INB, s.inbjudan.id);
    if (!rad || rad.aterkallad !== null) return orsak("aterkallad");
    const mitt = /** @type {readonly unknown[]} */ (GASTDELTASVAR).includes(rad.deltasvar) ? rad.deltasvar : null;
    const svar = { ok: true, namn: s.inbjudan.namn, funktion: "delta", delta: { handelse: vitlista(deltaHandelseUt(h), GASTDELTAHANDELSEFALT), mitt } };
    // ⛔ SISTA SPÄRREN, som i `hamta`: bara fälten i GASTSVARSFALT lämnar tjänsten.
    return Object.fromEntries(Object.entries(svar).filter(([k]) => /** @type {readonly string[]} */ (GASTSVARSFALT).includes(k)));
  }

  /**
   * Gästen svarar Kommer, Kommer inte eller Kanske på sin händelse. Svaret är ETT fält på gästens egen inbjudan (`deltasvar`), skrivet med villkoret att inbjudan inte är återkallad: en återkallelse och ett
   * svar kan inte korsa varandra så att ett svar landar på en dragen inbjudan. Ett nytt svar ersätter det förra.
   *
   * ⛔ INGET ID, INGEN ADRESS OCH INGEN GRUPP KOMMER FRÅN ANROPET. Raden är den sessionen hör till (kravet `{ slag: "sak", funktion: "delta" }`), och bara sessionsnyckeln och svaret skickas: en gäst kan inte rikta
   * ett svar mot någon annans inbjudan, och en `rosta`-session eller en gruppsession är ett nej.
   *
   * @param {Record<string, any>} b `{ sessionsnyckel, val }`, `val` ur `GASTDELTASVAR`.
   * @returns {Promise<{ ok: true, mitt: string } | { ok: false, orsak: Gastorsak }>}
   */
  async function deltaSvara(b) {
    if (!DELTA) return nej();
    const s = await session({ sessionsnyckel: b?.sessionsnyckel, krav: { slag: "sak", funktion: "delta" } });
    if (!s.ok) return s;
    if (!(/** @type {readonly unknown[]} */ (GASTDELTASVAR)).includes(b?.val)) throw new Error(`deltaSvara: val är ${GASTDELTASVAR.join(", ")}.`);
    if (!(await reserveraAnrop(s.inbjudan.id))) return orsak("for-manga");
    const h = await kalla.read(HANDELSER, /** @type {string} */ (s.inbjudan.handelseId));
    if (!h || h.arkiverad === true || h.groupId !== s.inbjudan.groupId) return orsak("saknas");
    const { updated } = await uppdateraOm(INB, s.inbjudan.id, { aterkallad: null }, { deltasvar: b.val });
    return updated ? { ok: true, mitt: b.val } : orsak("aterkallad");
  }

  /**
   * Händelsens tid eller plats har ändrats: varje `delta`-gäst med en aktiv inbjudan på den, vars senaste brev sade något annat, får ett nytt brev (typ `andrad-tid`) med den nya posten, en högre SEQUENCE och en ny
   * länk. Gäster vars brev redan sade det som gäller får inget: anropet är idempotent, och appen kan anropa det efter varje ändring av händelsen utan att veta om just tid eller plats rörts.
   *
   * ⛔ ANROPAS BARA AV APPENS SERVERKOD EFTER EN ÄNDRING, aldrig av en klient: ingen uid prövas, som `ersattAvMedlem`. Mottagarna är de som redan bjudits in av någon som fick det.
   *
   * ⛔ ETT BREV SOM INTE GICK ÄR ETT FEL MED KOD, OCH ÄNDRINGEN GLÖMS INTE. SEQUENCE sparas först när brevet gått iväg, så ett misslyckat utskick finns kvar som en ändring att skicka nästa gång `tidAndrad` körs. Gästens svar nollställs i samma sparning (se `sparaSekvens`), så ett brev som inte gick lämnar svaret orört.
   * De brev som gick är sparade och skickas inte igen. Felet bär `skickade` och `misslyckade`.
   *
   * @param {Record<string, any>} b `{ handelseId }`.
   * @returns {Promise<{ skickade: number, aktiva: number, saknas: boolean }>} `aktiva`: delta-inbjudningar utan återkallelse på händelsen. `saknas`: händelsen finns inte längre eller är arkiverad (då skickas inget).
   */
  async function tidAndrad(b) {
    if (!DELTA) throw felMedKod("ogiltigt-omfang", "tidAndrad: delta är inte påslaget (createGastService fick ingen delta).");
    const handelseId = kravText(b?.handelseId, "handelseId", "tidAndrad");
    const h = await kalla.read(HANDELSER, handelseId);
    if (!h || h.arkiverad === true || !text(h.groupId)) return { skickade: 0, aktiva: 0, saknas: true };
    const groupId = text(h.groupId);
    const rader = (await kalla.list(INB, { where: { groupId } }))
      // (0.197.0) Bara rader med en adress: ett brev går bara till en adress (en telefoninbjudan gäller aldrig en händelse, se `bjud`).
      .filter((r) => r.omfang?.slag === "sak" && r.omfang.funktion === "delta" && r.omfang.handelseId === handelseId && r.aterkallad === null && typeof r.epost === "string")
      .sort((x, y) => x.skapad - y.skapad);
    const ut = deltaHandelseUt(h);
    let skickade = 0;
    /** @type {unknown[]} */
    const fel = [];
    for (const r of rader) {
      const nasta = planeraSekvens(r, ut);
      if (!nasta.andrad) continue;
      try {
        const { rad, nyckel } = await roteraNyckel(r);
        await levereraBrev({ typ: "andrad-tid", till: rad.epost, namn: text(rad.namn), lankar: [brevlank(rad, nyckel, { ut, sekvens: nasta.sekvens })], skickadAv: null });
        await sparaSekvens(r, nasta);
        skickade++;
      } catch (e) {
        fel.push(e);
      }
    }
    if (fel.length > 0) {
      throw Object.assign(felMedKod("brev-misslyckades", `tidAndrad: ${fel.length} av ${skickade + fel.length} brev gick inte att skicka. De som gick är sparade och skickas inte igen; kör tidAndrad igen för resten.`), { skickade, misslyckade: fel.length, orsaker: fel });
    }
    return { skickade, aktiva: rader.length, saknas: false };
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
   * aldrig servern. Tom lista är ett svar (`poster: []`): gästen har inga, och vyn visar då ingen ärendeflik. Öppna ärenden först, nyast först; högst `GASTARENDE_MAX`, och `avkortad` säger när fler fanns.
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
    // ⛔ FRÅGAN ÄR PÅ GÄSTEN, INTE PÅ GRUPPEN: `groupId` OCH `mottagare.gastId` (två likhetsvillkor, inget sammansatt index; Firestore indexerar kartfältet av sig själv). En grupp med tusen ärenden kostar en gäst
    // med tre ärenden tre läsningar, inte tusen. ⛔ SVARET PRÖVAS ÄNDÅ RAD FÖR RAD (`gastDelegerad` och gruppen): en källa som tolkar frågan fel, eller ett index som släpar, ska aldrig kunna ge en gäst en annans ärende.
    const rader = await kalla.list(a.samling, { where: { groupId, "mottagare.gastId": s.gastId }, limit: GASTARENDE_SKANNA_MAX + 1 });
    const alla = rader
      .slice(0, GASTARENDE_SKANNA_MAX)
      .filter((r) => r.groupId === groupId && gastDelegerad(r.mottagare, s.gastId))
      .sort((x, y) => Number(isOpenCase(y.status)) - Number(isOpenCase(x.status)) || String(y.skapad ?? "").localeCompare(String(x.skapad ?? "")) || String(x.id).localeCompare(String(y.id)));
    const egna = alla.slice(0, GASTARENDE_MAX);
    // `avkortad`: gästen har fler ärenden än listan visar (sorterat: öppna först, nyast först), eller fler än servern läser. En kapad lista säger det och ser aldrig ut som hela.
    const avkortad = rader.length > GASTARENDE_SKANNA_MAX || alla.length > egna.length;
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
   * Postera i gruppens egen plats som en gäst ser, nyast först: ⛔ EN LÄSNING FÖR BIBLIOTEKET OCH ÖVERSIKTEN (0.198.0). Samma prövning som kortet i chatten (`gastSerBibliotekspost`, 0.191.0):
   * en sanning för vad en gäst ser av biblioteket. Högst `GASTBIBLIOTEK_MAX`.
   * @param {string} groupId
   */
  async function gruppensPoster(groupId) {
    const rader = await kalla.list(/** @type {any} */ (GS).samlingar.bibliotek, { where: { groupId }, limit: GASTBIBLIOTEK_MAX + 1 });
    return {
      avkortad: rader.length > GASTBIBLIOTEK_MAX,
      rader: rader
        .slice(0, GASTBIBLIOTEK_MAX)
        .filter((p) => gastSerBibliotekspost(p, groupId))
        .sort((x, y) => (y.skapad ?? 0) - (x.skapad ?? 0) || String(x.id).localeCompare(String(y.id))),
    };
  }

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
    const { rader: synliga, avkortad } = await gruppensPoster(groupId);
    /*
     * ⛔ (0.207.0, cllp/lifehub.app#696 skiva 2) LISTAN SIGNERAR INGA BILDER, av samma skäl som den inte signerar filerna (`adresserPaBegaran`): listan hämtas om varje gång fliken
     * öppnas och har upp till `GASTBIBLIOTEK_MAX` poster, och en signering per bild vid varje hämtning hade varit en kostnad för poster ingen öppnar (regel 13). Bilderna i en
     * anteckning signeras när gästen öppnar den (`anteckningsbilder`).
     */
    const poster = synliga
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
   * (0.207.0, cllp/lifehub.app#696 skiva 2) Bilderna i EN anteckning i gruppens bibliotek, när gästen öppnar den: `{ ok, bilder: { [namn]: url } }`. Samma väg som en delad anteckning
   * (`anteckningsbildAdresser`): namnen ur texten, postens egen mapp (`<gruppPrefix>/<groupId>/<postPrefix>/<postId>/<namn>`), bara en fil som finns (`lagring.finns`), `SIGNERAD_SEKUNDER`
   * och `inline`, högst `MAX_ANTECKNINGSBILDER`. ⛔ Posten prövas som i listan (`gastSerBibliotekspost`: gruppens egen plats), och en post på en annan plats, en annan sorts post eller
   * en post som inte finns ger `saknas`: gästen når aldrig en annan posts bilder. Utan `lagring.finns` är `bilder` tomt, och vyn säger "Bilden kunde inte visas." för varje bild.
   *
   * ⛔ GÄSTENS `laddaNed` GÄLLER INTE EN BILD I EN TEXT. `laddaNed` avgör om gästen får en adress med `attachment`, alltså en fil att spara (`fil`). En bild i en anteckning är en del
   * av texten gästen redan får läsa, och den signeras alltid `inline`, samma sak som `fil` ger för en bild när nedladdningen är av ("spela och visa går som förut"). Att dölja
   * bilderna för en gäst utan `laddaNed` hade gjort texten ofullständig utan att skydda något: en bild som visas kan sparas av webbläsaren ändå.
   *
   * ⛔ BILDERNA RÄKNAS INTE MOT `GASTFIL_PER_DYGN`. Den räknaren gäller en fil gästen ber om och sparar. En anteckning med bilder kostar en öppning, inte en fil per bild, och
   * åtgärden räknas som alla andra mot `GASTANROP_PER_MINUT`. Taket per anteckning håller nere vad en öppning kostar.
   *
   * @param {Record<string, any>} b `{ sessionsnyckel, postId }`.
   */
  async function anteckningsbilder(b) {
    const s = await gruppSession(b, "bibliotek");
    if (!s.ok || !GS) return s.ok ? nej() : s;
    const groupId = s.inbjudan.groupId;
    const postId = typeof b?.postId === "string" ? b.postId : "";
    if (!postId) return orsak("saknas");
    const post = await kalla.read(GS.samlingar.bibliotek, postId);
    if (!gastSerBibliotekspost(post, groupId) || post?.typ !== "anteckning") return orsak("saknas");
    const bilder = await anteckningsbildAdresser({ post: /** @type {Record<string, any>} */ (post), postId, lagring: GS.lagring, gruppPrefix: GS.gruppPrefix, postPrefix: GS.postPrefix, budget: { kvar: MAX_ANTECKNINGSBILDER } });
    return vitlista({ ok: true, bilder: bilder ?? {} }, GASTGRUPPSVARSFALT.anteckningsbilder);
  }


  /**
   * (0.198.0, cllp/ops-framework#536, förslag B) Gästens översikt i ETT anrop: det som hänt i chatten och biblioteket sedan gästens senaste besök, och nästa händelse med gästens eget svar.
   * Klienten skickar tiderna för sina senaste besök (`sedan`, millisekunder per område, sparade på enheten) och får antalen räknade. Utan en tid för ett område räknas inget som nytt där
   * (första besöket).
   *
   * ⛔ BARA DET GÄSTEN REDAN SER, MED SAMMA FILTER: chattens rader utan agentens (`chattavsandare`) och med namnen som i `chatt` (`chattrad`), händelserna ur samma läsning som `kalender`
   * (`gruppensHandelser`), posterna ur samma som `bibliotek` (`gruppensPoster`). Svaret byggs fält för fält ur `GASTGRUPPSVARSFALT.oversikt` och `GASTOVERSIKTFALT`.
   *
   * ⛔ GÄSTENS EGNA MEDDELANDEN ÄR ALDRIG NYA. `nya` räknas över de senaste `GASTCHATT_SIDA` meddelandena: var alla nya är `fler` sant och talet ett golv.
   *
   * @param {Record<string, any>} b `{ sessionsnyckel, sedan?: { chatt?: number, bibliotek?: number }, idag?: "ÅÅÅÅ-MM-DD" }`. `idag` är gästens dag (enhetens tidszon), förval dagen i UTC.
   */
  async function oversikt(b) {
    if (!GS) return nej();
    // ⛔ ÖVERSIKTEN ÄR INGEN FUNKTION: sessionen prövas mot den första funktion tjänsten har (för en gruppgäst prövar `gastOmfangGer` bara att namnet är en gruppfunktion), och varje del
    // nedan läses bara när dess funktion finns i `GS.funktioner`. En del utan funktion är `null` i svaret. Inget prov för en `null`-del: chatt, kalender och bibliotek går inte att välja
    // bort i dag (`GS.funktioner` ovan är alla gruppfunktioner utom ärenden utan `grupp.arenden`), så vakten skrivs ett prov för den dag funktionerna blir valbara.
    const s = await gruppSession(b, /** @type {(typeof GASTGRUPPFUNKTIONER)[number]} */ (GS.funktioner[0]));
    if (!s.ok || !GS) return s.ok ? nej() : s;
    const har = (/** @type {string} */ f) => /** @type {readonly string[]} */ (/** @type {any} */ (GS).funktioner).includes(f);
    const sedan = b?.sedan === undefined ? {} : b.sedan;
    if (!sedan || typeof sedan !== "object" || Array.isArray(sedan)) throw new Error("oversikt: sedan är { chatt?, bibliotek? } i millisekunder.");
    for (const f of /** @type {const} */ (["chatt", "bibliotek"])) {
      if (sedan[f] !== undefined && !Number.isFinite(sedan[f])) throw new Error(`oversikt: sedan.${f} är ett tal, millisekunder.`);
    }
    if (b?.idag !== undefined && (typeof b.idag !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.idag))) throw new Error("oversikt: idag är ÅÅÅÅ-MM-DD.");
    const idag = b?.idag ?? new Date(klocka()).toISOString().slice(0, 10);
    const groupId = s.inbjudan.groupId;

    // Chatten: de senaste meddelandena utan agentens, samma som `chatt`.
    const chattUt = har("chatt") ? await oversiktChatt(groupId, s.gastId, sedan.chatt) : null;
    const kalenderUt = har("kalender") ? await oversiktKalender(groupId, s.gastId, idag) : null;
    const bibliotekUt = har("bibliotek") ? oversiktBibliotek(await gruppensPoster(groupId), sedan.bibliotek) : null;
    return vitlista({ ok: true, chatt: chattUt, kalender: kalenderUt, bibliotek: bibliotekUt }, GASTGRUPPSVARSFALT.oversikt);
  }

  /** (0.198.0) Översiktens chattdel. @param {string} groupId @param {string} gastIdet @param {number | undefined} sedanChatt */
  async function oversiktChatt(groupId, gastIdet, sedanChatt) {
    const rader = await kalla.list(meddelandevag(groupId), { sortBy: "tid", direction: "desc", limit: GASTCHATT_SIDA });
    const { namnFor, agenter } = await chattavsandare(groupId);
    const synliga = rader.filter((m) => !agenter.has(m.av));
    const nyaRader = typeof sedanChatt === "number" ? synliga.filter((m) => m.av !== gastIdet && typeof m.tid === "number" && m.tid > sedanChatt) : [];
    const c = { groupId, gastId: gastIdet, sida: rader, namnFor, agenter, lasta: new Map(), medSvar: false };
    const senasteMeddelanden = await Promise.all(
      synliga.slice(0, GASTOVERSIKT_SENASTE).map(async (m) => {
        const r = await chattrad(m, c);
        return vitlista({ id: r.id, namn: r.av.namn, text: kapa(r.text, 140), tid: r.tid, egen: r.egen }, GASTOVERSIKTFALT.meddelande);
      }),
    );
    return vitlista({ nya: nyaRader.length, fler: nyaRader.length > 0 && nyaRader.length === synliga.length && rader.length === GASTCHATT_SIDA, senaste: senasteMeddelanden }, GASTOVERSIKTFALT.chatt);
  }

  /** (0.198.0) Översiktens kalenderdel. @param {string} groupId @param {string} gastIdet @param {string} idag */
  async function oversiktKalender(groupId, gastIdet, idag) {
    // Kalendern: nästa händelse som slutar i dag eller senare, i kalenderns ordning (heldag före klockslag samma dag), och gästens eget svar.
    const { handelser } = await gruppensHandelser(groupId);
    const nasta = handelser
      .filter((h) => typeof h.datum === "string" && String(h.slutDatum ?? h.datum) >= idag)
      .sort((x, y) => String(x.datum).localeCompare(String(y.datum)) || (x.heldag ? -1 : 0) - (y.heldag ? -1 : 0) || String(x.tid ?? "").localeCompare(String(y.tid ?? "")) || String(x.id).localeCompare(String(y.id)))[0];
    /** @type {Record<string, any> | null} */
    let nastaUt = null;
    if (nasta) {
      let mitt = null;
      if (nasta.kravSvar === true) {
        const rad = await kalla.read(svarVag(nasta.id), gastIdet);
        mitt = rad?.svar === "kommer" || rad?.svar === "kommerInte" ? rad.svar : null;
      }
      nastaUt = vitlista({ ...nasta, mitt }, GASTOVERSIKTFALT.handelse);
    }
    return vitlista({ nasta: nastaUt }, GASTOVERSIKTFALT.kalender);
  }

  /**
   * (0.198.0) Översiktens biblioteksdel: samma poster som `bibliotek`, nyast först.
   * (Nästa version, CP 2026-11-07: "Vore bra med lite statistik med bibliotek om hur många artefakter det faktiskt är i biblioteket så man vill klicka där, även om inget är nytt")
   * `antal` är hur många poster gästen ser, `filer` hur många av dem som är filer, och `fler` att biblioteket har fler än `GASTBIBLIOTEK_MAX` och att `antal` alltså är en undre gräns.
   * @param {{ rader: Record<string, any>[], avkortad: boolean }} lasta @param {number | undefined} sedanBibliotek
   */
  function oversiktBibliotek({ rader, avkortad }, sedanBibliotek) {
    // ⛔ RUTAN RÄKNAR DET LISTAN VISAR (QA 2026-11-07: rutan sa 3 filer, listan visade 2). En arkiverad post når gästen bara genom att välja arkivtaggen (`filtreraBibliotek`),
    // så den är varken ny, senast eller räknad. Samma prövning som listan, inte en egen.
    const poster = rader.filter((p) => !arArkiverad(p));
    const nyaPoster = typeof sedanBibliotek === "number" ? poster.filter((p) => typeof p.skapad === "number" && p.skapad > sedanBibliotek).length : 0;
    const senastePoster = poster.slice(0, GASTOVERSIKT_SENASTE).map((p) => vitlista({ id: p.id, rubrik: trimSomRegeln(p.rubrik), typ: p.typ, tid: p.skapad }, GASTOVERSIKTFALT.post));
    return vitlista(
      { nya: nyaPoster, senaste: senastePoster, antal: poster.length, filer: poster.filter((p) => p.typ === "fil").length, fler: avkortad === true },
      GASTOVERSIKTFALT.bibliotek,
    );
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
    const filnamn = text(post?.fil.namn);
    const mime = text(post?.fil.mime);
    const visas = ["bild", "ljud", "video", "pdf"].includes(delningsTyp(mime));
    const bifoga = b?.bifoga === true || (b?.bifoga === undefined && !visas);
    // ⛔ NEDLADDNINGEN KAN VARA AVSTÄNGD FÖR GÄSTEN (`laddaNed`, och sedan 0.204.0 bara där): en adress med `attachment` ges inte, och ingen räknare tas. Spela och visa (`inline`) går som förut.
    // Ett dokument som bara kan laddas ned (Word, en okänd sort) har ingen `inline`-väg och nekas också, OCKSÅ när gästen ber om `bifoga: false`:
    // en `inline`-adress till en sort webbläsaren inte kan visa laddas ned ändå, så frågan avgörs på sorten och inte på vad gästen ber om (granskningen).
    if ((bifoga || !visas) && !nedladdningTillaten(s.inbjudan)) return orsak("nedladdning-av");
    const rakn = await reserveraRaknare(hash(`gastfil|${s.inbjudan.id}`), { max: GASTFIL_PER_DYGN, fonsterMs: DYGN_MS });
    if (!rakn) return orsak("for-manga");
    try {
      const url = await GS.lagring.signeradAdress({ sokvag: post?.fil.sokvag, sekunder: SIGNERAD_SEKUNDER, disposition: delningsDisposition(filnamn, bifoga, mime), mime });
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
    const k = gastkontaktPaRad(r);
    if (!k) return null;
    try {
      return gastId(k);
    } catch {
      return null;
    }
  }

  /**
   * Radens kontakt, eller ett fel om raden inte bär någon. ⛔ Ingen tyst reserv: en rad utan kontakt är en trasig rad, och en tjänst som gissade en kontakt hade kunnat ge fel gäst en plats.
   * @param {Record<string, any>} r
   * @returns {import("../lib/gast.js").Gastkontakt}
   */
  function radensKontakt(r) {
    const k = gastkontaktPaRad(r);
    if (!k) throw new Error(`gast: inbjudan "${String(r?.id)}" bär varken epost eller telefon.`);
    return k;
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
    const platsSlappt = await slappPlatsOmTom(groupId, radensKontakt(rader[0]));
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
    const platsSlappt = rader.length > 0 ? await slappPlatsOmTom(groupId, { slag: "epost", varde: epost }) : false;
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
    const vag = meddelandevag(groupId);
    let n = 0;
    for (const m of await kalla.list(vag, { where: { av: gId } })) {
      await taBort(vag, m.id);
      n++;
    }
    n += await raderaTradsvar(groupId, gId);
    return n;
  }

  /**
   * (0.191.0) Gästens svar i chattens trådar, och gästens id på de trådar hen öppnade. ⛔ KASTAR när gruppen har fler trådar än taket, samma skäl som `raderaSvar`: en radering som inte kan
   * lova att ha sett allt ska inte säga att den är klar. En tråd tas inte bort (andras svar ligger i den): dess `skapadAv` byts mot gruppens agent, som inte är någon person.
   * @param {string} groupId
   * @param {string} gId
   * @returns {Promise<number>}
   */
  async function raderaTradsvar(groupId, gId) {
    if (!GS?.tradar) return 0;
    const TAK = 20000;
    const tradar = await kalla.list(tradvag(groupId), { limit: TAK + 1 });
    if (tradar.length > TAK) throw new Error(`radera: gruppchatten har fler än ${TAK} trådar, och svaren går inte att söka igenom på ett säkert sätt. Raderingen avbröts.`);
    let n = 0;
    for (let i = 0; i < tradar.length; i += 25) {
      await Promise.all(
        tradar.slice(i, i + 25).map(async (t) => {
          const vag = tradmeddelandevag(groupId, t.id);
          for (const m of await kalla.list(vag, { where: { av: gId } })) {
            await taBort(vag, m.id);
            n++;
          }
          if (t.skapadAv === gId) await kalla.update(tradvag(groupId), t.id, { skapadAv: agentId(groupId) });
        }),
      );
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
   * ⛔ (0.197.0) KONTAKTEN, INTE ADRESSEN: en telefongäst raderas på samma sätt, med `radering.spar({ epost: null, telefon, ... })`. En e-postgäst ger `spar` exakt det den fick förut.
   *
   * @param {{ kontakt: import("../lib/gast.js").Gastkontakt, grupper: readonly string[] | null }} d `grupper: null` är alla personens grupper.
   */
  async function raderaUppgifter(d) {
    if (!radering) throw new Error("radera: createGastService fick ingen radering. Utan den går en gästs uppgifter inte att ta bort, och tjänsten gör det därför inte till hälften.");
    const gId = gastId(d.kontakt);
    const alla = await kalla.list(INB, { where: kontaktVillkor(d.kontakt) });
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
    if (radering.spar) {
      const kontaktUt = d.kontakt.slag === "telefon" ? { epost: null, telefon: d.kontakt.varde } : { epost: d.kontakt.varde };
      await radering.spar({ ...kontaktUt, gastId: gId, grupper: berorda, alla: allaBort });
    }
    for (const r of rader) {
      await taBort(INB, r.id);
      // Kopian av nyckeln följer med raden: en raderad inbjudan lämnar ingen länk kvar. Raden först, så att en körning som dör mellan de två går att köra om (valvets `radera` är idempotent).
      if (VALV) await VALV.radera({ id: r.id, groupId: r.groupId });
    }
    let platserSlappta = 0;
    for (const g of berorda) if (await slappPlatsOmTom(g, d.kontakt)) platserSlappta++;
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
    return raderaUppgifter({ kontakt: radensKontakt(rader[0]), grupper: [groupId] });
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
    await raderaUppgifter({ kontakt: radensKontakt(rad), grupper: null });
    return { ok: true };
  }

  return { bjud, aterkalla, sattNedladdning, skickaOm, kopieraLank, lista, platser, los, prova, minaGruppgaster, oppnaGruppgast, session, hamta, sattNamn, nyLank, stadaSessioner, deltaSvara, tidAndrad, oversikt, chatt, skrivChatt, kommenteraPost, kalender, handelse, svara, rosta, bibliotek, anteckningsbilder, fil, arenden, kommenteraArende, markeraArendeKlart, levandeGaster, aterkallaAlla, ersattAvMedlem, radera, raderaMig };
}
