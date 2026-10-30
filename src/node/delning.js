/**
 * Publik delning av en biblioteksfil, anteckning, länk eller lista, eller en händelse: en länk utan inloggning (0.119.0, lifehub.app#356, 0.125.0, lifehub.app#377 och 0.133.0).
 *
 * ══ ⛔ ALLA FYRA TYPER GÅR ATT DELA, OCH EN DELAD LISTA ÄR EN LEVANDE SPEGEL (0.133.0, lifehub.app#356) ═══════════════════════════════
 *
 * CP 2026-10-18: "Vi skall ju ha en publik länk till varje artefakt med option på att den som ser kan ladda ner." Förut gick bara en färdig fil att dela. Nu går en fil, en anteckning, en länk
 * och en lista (`arDelbar`). Delningsraden är oförändrad: den pekar på posten (`postId`) och typen läses ur posten, så ingen rad skrivs om och inget nytt fält finns.
 *
 * Svaret bär bara vitlistade fält per typ (`DELNINGSSVARSFALT` för en fil, `ANTECKNINGSSVARSFALT`, `LANKSVARSFALT`, `LISTSVARSFALT`), och `typ` skiljer dem åt.
 *
 * ⛔ HELA LISTAN DELAS MED LÄNKEN. CP 2026-10-20: "EN lista måste kunna delas ... det ser ut som en lista, men alla sakerna i listan delas. Som att jag vill dela en playlist för ett gig."
 * Den som får dela listan (`farAndra`, prövas på listan som i dag) delar därmed också posterna i den, också de hen inte själv skrivit. Det är beslutet, och det är därför
 * dialogen säger det.
 *
 * ⛔ LISTAN LAGRAS INTE I DELNINGEN. CP 2026-10-20: "Ändras listan kan den ju bara ändras för alla som den delas med. Om en låt tas bort kan den bara tas bort precis som för den som skapade den."
 * Servern läser listan vid VARJE hämtning och ritar den som medlemmen ser den nu: samma poster i samma ordning (`losLista`, den funktion medlemmens egen listvy använder). En post som tagits
 * ur listan finns inte i nästa svar. En post som raderats blir raden "Finns inte längre", som i medlemmens vy (`LISTRADTEXT`), och mottagaren kan inte ändra något. Ingen ögonblicksbild finns att
 * glida isär från listan (regel 2), och en spelare som hämtar om efter att en adress gått ut (15 minuter) får den nya listan.
 *
 * Taket är `MAX_DELADE_LISTPOSTER`: varje fil får en egen signerad adress. Poster efter taket kommer inte med och `ejVisade` säger hur många. En lista i en lista finns inte (reglerna
 * låter den inte skrivas, och `losLista` visar en sådan rad som en rad som inte går att visa), så ingen rekursion finns. Posterna läses bara på listans egen plats.
 *
 * ══ ⛔ VARFÖR SERVERSIDAN, OCH VARFÖR REGLERNA NEKAR ALLT ═══════════════════════════════════════════════════════════════
 *
 * En delningsrad skrivs och läses bara av Admin SDK. `delningsregelfragment()` säger `allow read, write: if false`, så en klient
 * kan varken ge sig själv en länk till ett mål i en grupp hen inte är med i eller läsa vilka länkar som finns. Eftersom en
 * callable kör FÖRBI reglerna kontrolleras behörigheten här, i funktionen, på samma sätt som i `createInvitationService`.
 *
 * ══ ⛔ EN MODELL FÖR TVÅ MÅL, OCH EN ADRESS SOM ÄR NYCKELN (0.125.0, beslut 0009) ═════════════════════════════════════════
 *
 * En rad bär `slag` (`post`, en fil, eller `handelse`) och `rattighet` (`las`). En rad utan `slag` är en filänk från 0.119.0 till 0.124.0 och
 * läses som `post`: ingenting i produktion skrivs om. En NY delning har en läsbar adress, `<gruppdel>/lib/<fildel>` eller
 * `<gruppdel>/event/<händelsedel>`, och dokumentets id är SHA-256 (hex) av adressen. Unikhet är då en nyckel (`createNew` på id:t) och
 * ingen läs-sedan-skriv-kontroll. En gammal länk har ett slumpat token (32 byte, base64url) som id-hash, och `/d/<token>` fortsätter fungera
 * tills länken går ut. Det finns inget sätt att skapa en ny tokenlänk: `skapa` kräver en adress.
 *
 * ⛔ UTAN KOD FÅR SISTA DELEN ETT SLUMPAT SLUT SOM INTE GÅR ATT TA BORT (`SLUMPSLUT_TECKEN` tecken ur a-z0-9, `randomBytes`). En läsbar adress utan
 * slut kan gissas; med slut är den lika svårgissad som ett kort token. MED KOD får adressen vara exakt det personen skrev, eftersom koden då
 * är skyddet. En upptagen adress är ett eget fel (`kod: "adress-upptagen"`) och rutan föreslår en annan; en stängd eller utgången adress
 * blir aldrig ledig igen, så att en gammal länk i ett sms aldrig kan börja visa något annat.
 *
 * ⛔ ADRESSEN LAGRAS I KLARTEXT PÅ RADEN (`adress`), SAMTIDIGT SOM ID:T ÄR DESS HASH. Panelen ska visa varje aktiv länk med full adress så att
 * den går att klippa ur och skicka (CP 2026-10-19), och det går inte om bara hashen finns. Priset: den som läser databasen (administratör,
 * export, säkerhetskopia) ser adresserna. För en händelse är det den som redan ser händelsens innehåll i samma databas. Hashen är kvar som
 * nyckel och unikhet. Se beslut 0009 för alternativet (visa adressen bara en gång) och varför det inte valdes.
 *
 * ══ ⛔ EN GRUPPDEL TILLHÖR EN PLATS, FÖR ALLTID (0.125.0, granskningen av PR 417) ═══════════════════════════════════════════
 *
 * Gruppdelen (`/g/<gruppdel>/...`) är det som får en länk att se ut att komma från en viss grupp. Utan en spärr kunde en medlem i grupp A skapa
 * `/g/music/event/...` fast `music` är grupp B:s, och länken såg ut att komma från B. Därför har varje gruppdel en rad i en egen samling
 * (`samlingar.gruppdelar`, förval `delningsgruppdelar`): dokumentets id ÄR gruppdelen och raden bär `{ plats, skapad }`, skriven med `createNew`.
 * Unikheten är då en nyckel och inte en läsning följd av en skrivning: två samtidiga första användningar från två platser ger exakt en vinnare. Platsen
 * är gruppens id (eller `mitt~<uid>` för Mitt bibliotek); för en händelse eller ett ärende är det gruppen och inte objektets plats. En plats får
 * använda flera gruppdelar, men en gruppdel byter aldrig plats, och en rad tas aldrig bort. En gruppdel som en annan plats redan har är `adress-upptagen`
 * (med `del: "gruppdel"`, så att rutan ändrar rätt fält). Den kvarvarande risken är att en grupp tar ett namn som liknar något utanför appen,
 * först till kvarn, som för en URL-förkortare.
 *
 * ══ ⛔ KODEN SPARAS ALDRIG I KLARTEXT, OCH FELAKTIGA KODER RÄKNAS PER LÄNK ═════════════════════════════════════════════════
 *
 * `scrypt` med eget salt per länk, jämförelse med `timingSafeEqual`. Den publika sidan svarar `kod-kravs` när koden saknas och `fel-kod` när
 * den är fel, och säger inget annat om målet. Gränsen mot gissning är TVÅ lager: appens uppslagsräknare (per adress och per IP, den som
 * redan finns för filer) tar förfrågningar, och tjänsten har en EGEN räknare per länk för felaktiga koder (`FELKOD_MAX` per
 * `FELKOD_FONSTER_MS`, på raden: `felAntal` och `felFonster`). Appens räknare räcker inte för en kod: 60 uppslag i minuten mot en sexsiffrig
 * kod är en kod på drygt tre dygn, och räknaren ser inte vilka försök som var koder. Försöket RESERVERAS innan koden prövas (en villkorad skrivning,
 * `updateIf`), och ges tillbaka om koden stämde, så att ett hundratal parallella gissningar inte alla hinner pröva innan någon räknats.
 * Tar försöken slut svarar länken `for-manga` även på rätt kod. Det är medvetet: annars kan gissningen fortsätta.
 *
 * ══ ⛔ ETT OKÄNT TOKEN ELLER EN OKÄND ADRESS SVARAR SOM ETT UTGÅNGET ══════════════════════════════════════════════════════
 *
 * `hamta` är en publik funktion. Skilde svaret på "finns inte" och "har gått ut" gick det att pröva sig fram till vilka länkar
 * som någon gång funnits. Därför är de ett och samma svar, byte för byte. "Stängd" och "målet finns inte" kan bara ses av den
 * som redan har en riktig länk, och den får veta det. En länk med kod avslöjar att den finns när den svarar `kod-kravs`; det går inte att
 * undvika för en sida som ska be om koden.
 *
 * ══ ⛔ SVARET HAR EN ÖPPEN LISTA FÄLT OCH INGET ANNAT ═════════════════════════════════════════════════════════════════
 *
 * `DELNINGSSVARSFALT` (en fil) och `HANDELSESVARSFALT` (en händelse) är hela svaret. Sökvägen i lagringen, grupp-id, taggar, utskrift, skaparens
 * e-post och uid, och för en händelse allt appen inte listat i `handelseSida`, lämnar aldrig servern genom den här funktionen: den publika
 * sidan behöver dem inte, och allt som skickas ut är något som kan läcka. Händelsens grupp, medlemmar, svar, chatt och kommentarer är inte
 * med, och ramverket läser dem aldrig.
 *
 * ══ ⛔ RAMVERKET KÄNNER INGEN DATABAS, INGEN LAGRING OCH INGA FÄLT HOS APPENS HÄNDELSE ═══════════════════════════════════
 *
 * Datakällan och lagringen skickas in, samlingsnamnen likaså (`delningar`, `bibliotek` och `handelser` har inga förval: det är appens namn).
 * Lagringen behöver bara en metod, `signeradAdress`, som med Admin SDK är `bucket.file(sokvag).getSignedUrl(...)`. Appens händelse har appens
 * egna fält (`rubrik`, `text`, `plats`): `handelseSida(handelse)` säger vilka som är titel, beskrivning och plats på den publika sidan, och
 * tidsfälten läser ramverket själv ur `HANDELSEKONTRAKT`.
 */

// @ts-expect-error Noden har crypto. Ramverket har inga Node-typer: lib är DOM, för webben. Samma rad som i inbjudan.js.
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
// @ts-expect-error Samma skäl: ramverket har inga Node-typer.
import { Buffer } from "node:buffer";
import { arDelbar, arHtmlMime, arLjudpost, arMittBibliotek, gruppForPlats, handelseBibliotek, ljudRubrik, mittBibliotek, peaksGiltiga, POSTIDFORM, trimSomRegeln } from "../lib/bibliotek.js";
import { losLista } from "../lib/biblioteklista.js";
import {
  ADRESSSEGMENT,
  DELNINGSDAGAR,
  DELNINGSSLAG,
  FELKOD_FONSTER_MS,
  FELKOD_MAX,
  HANDELSEDAGAR,
  KODLANGD,
  MAX_ADRESSDEL,
  MAX_DELADE_LISTPOSTER,
  MAX_HANDELSEFILER,
  SIGNERAD_SEKUNDER,
  SLUMPSLUT_TECKEN,
  TOKENFORM,
  adressUrUppslag,
  arAdressdel,
  byggAdress,
  delningsSokvag,
  delningsTyp,
  kodFel,
  normaliseraKod,
  tolkaAdress,
} from "../lib/delning.js";
import { medlemskapsId } from "../lib/grupp.js";
import { KLOCKFORM, handelsefel } from "../lib/handelsemodell.js";

const DYGN_MS = 24 * 60 * 60 * 1000;

/** Samma form som regelfragmentens samlingsnamn: ett namn, inte en sökväg. */
const SAMLINGSFORM = /^[A-Za-z][A-Za-z0-9_-]*$/;

/** @param {unknown} v @returns {string} */
const text = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * Ett fel som bär en `kod` för appens callable att översätta (samma mönster som `FLYTTFELKODER`). Meddelandet är för loggen.
 * @param {(typeof import("../lib/delning.js").DELNINGSFELKODER)[number]} kod
 * @param {string} meddelande
 * @param {Record<string, unknown>} [extra] Fler fält på felet. `del` säger vilken del av adressen som var upptagen (`gruppdel` eller `sista`).
 * @returns {Error & { kod: string, del?: string }}
 */
function felMedKod(kod, meddelande, extra = {}) {
  return Object.assign(new Error(meddelande), { kod }, extra);
}

/**
 * Ett nytt token: 32 slumpbyte i base64url. Det enda stället ett token blir till.
 *
 * ⛔ `skapa` GER INGET TOKEN LÄNGRE (0.125.0): nya delningar har en adress. Funktionen finns kvar för att bygga en gammal rad i prov (en länk från
 * 0.119.0 till 0.124.0 ska bevisas fungera) och går att ta bort när alla filänkar har gått ut, högst 30 dagar efter utgivningen (beslut 0009).
 * @returns {string}
 */
export function nyttDelningstoken() {
  return randomBytes(32).toString("base64url");
}

/**
 * Dokument-id:t för ett token: SHA-256 i hex. Kastar för något som inte är ett token, så att en felskriven hash aldrig blir ett id.
 *
 * @param {string} token
 * @returns {string}
 */
export function delningsId(token) {
  if (typeof token !== "string" || !TOKENFORM.test(token)) {
    throw new Error("delningsId: ett token är 43 tecken ur A-Z, a-z, 0-9, - och _ (32 slumpbyte i base64url).");
  }
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Dokument-id:t för en adress: SHA-256 i hex av `<gruppdel>/<typsegment>/<sista del>`. Kastar för något som inte är en adress.
 *
 * @param {string} adress
 * @returns {string}
 */
export function adressId(adress) {
  if (!tolkaAdress(adress)) {
    throw new Error("adressId: en adress är <gruppdel>/lib/<fildel> eller <gruppdel>/event/<händelsedel>, med delar ur a-z, 0-9 och bindestreck.");
  }
  return createHash("sha256").update(adress).digest("hex");
}

/**
 * Nyckeln för det en besökare skrev: dokument-id:t för ett token (43 tecken) eller en adress (`<gruppdel>/<typsegment>/<sista del>`, utan `/g/`),
 * eller `null` för allt annat. Appens uppslagsräknare ska räkna på den här nyckeln i stället för på tokenet, så att den täcker båda formerna
 * och en adress som inte finns (en gissning) räknas lika som en som finns.
 *
 * @param {unknown} ref
 * @returns {string | null}
 */
export function delningsNyckel(ref) {
  return nyckelFor(ref)?.id ?? null;
}

/**
 * @param {unknown} ref
 * @returns {{ id: string, form: "token" } | { id: string, form: "adress", adress: string } | null}
 */
function nyckelFor(ref) {
  if (typeof ref !== "string") return null;
  if (TOKENFORM.test(ref)) return { id: delningsId(ref), form: "token" };
  const adress = adressUrUppslag(ref);
  return adress ? { id: adressId(adress), form: "adress", adress } : null;
}

const SLUMPTECKEN = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Det slumpade slutet på en adress: `SLUMPSLUT_TECKEN` tecken ur a-z och 0-9, kryptografiskt slumpade.
 *
 * ⛔ UTAN MODULOSKEVHET: 256 går inte jämnt upp i 36, så en byte som är 252 eller mer kastas. Annars hade de fyra första tecknen varit något
 * vanligare än de andra.
 * @returns {string}
 */
export function nyttSlumpslut() {
  let ut = "";
  while (ut.length < SLUMPSLUT_TECKEN) {
    for (const b of randomBytes(SLUMPSLUT_TECKEN * 2)) {
      if (b >= 252) continue;
      ut += SLUMPTECKEN[b % 36];
      if (ut.length === SLUMPSLUT_TECKEN) break;
    }
  }
  return ut;
}

/** scrypt-parametrarna: Nodes förval (N 16384, r 8, p 1). Ungefär 50 ms, och 16 MB minne. */
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/**
 * @param {string} kod
 * @param {Uint8Array} salt
 * @returns {Promise<Uint8Array>}
 */
function scryptAsync(kod, salt) {
  return new Promise((klar, fel) => {
    scrypt(kod, salt, 32, SCRYPT, (/** @type {Error | null} */ e, /** @type {Uint8Array} */ nyckel) => (e ? fel(e) : klar(nyckel)));
  });
}

/**
 * Koden som den lagras: `scrypt` med eget salt per länk. Koden själv finns inte i raden.
 *
 * @param {string} kod
 * @returns {Promise<{ salt: string, hash: string }>}
 */
export async function hashaKod(kod) {
  const fel = kodFel(kod);
  const k = normaliseraKod(kod);
  if (fel || !k) throw new Error(`hashaKod: ${fel || "en kod krävs."}`);
  const salt = randomBytes(16);
  const hash = await scryptAsync(k, salt);
  return { salt: Buffer.from(salt).toString("hex"), hash: Buffer.from(hash).toString("hex") };
}

/**
 * Stämmer koden mot det som lagrades? Jämförelsen tar lika lång tid oavsett var koderna skiljer sig (`timingSafeEqual`).
 *
 * @param {unknown} lagrad `{ salt, hash }` ur raden.
 * @param {unknown} kod
 * @returns {Promise<boolean>}
 */
export async function kodStammer(lagrad, kod) {
  const l = /** @type {{ salt?: unknown, hash?: unknown } | null} */ (lagrad);
  if (!l || typeof l.salt !== "string" || typeof l.hash !== "string") return false;
  const k = normaliseraKod(kod);
  if (!k || k.length > KODLANGD.max) return false;
  const fore = Buffer.from(l.hash, "hex");
  if (fore.length !== 32) return false;
  const nu = await scryptAsync(k, Buffer.from(l.salt, "hex"));
  return nu.length === fore.length && timingSafeEqual(nu, fore);
}

/**
 * Delningspostens form för en GAMMAL filänk (ett token), eller felet som säger varför den inte går att bygga.
 *
 * ⛔ `skapa` BYGGER INTE LÄNGRE DEN HÄR RADEN (0.125.0): nya delningar går genom `byggAdressdelning`. Funktionen finns för att bevisa att en
 * rad från 0.119.0 till 0.124.0 fortfarande öppnas, och för ingenting annat (se `nyttDelningstoken`).
 *
 * ⛔ `id` ÄR HASHEN AV TOKENET OCH TOKENET FINNS INTE I RADEN. En kopia av tokenet i raden vore en andra sanning om hur länken
 * ser ut, och det är precis den som en läsning av databasen inte får ge.
 *
 * ⛔ UTGÅNGSTIDEN ÄR EN AV `DELNINGSDAGAR`. `nedladdning` är sant eller falskt och inget annat: en sträng "false" är sann i en jämförelse, och
 * ett förval på sant hade gjort varje länk till en nedladdning.
 *
 * @param {object} d
 * @param {string} d.token
 * @param {string} d.postId
 * @param {string} d.groupId
 * @param {{ uid: string, namn?: string }} d.skapadAv
 * @param {number} d.skapad Millisekunder.
 * @param {number} d.dagar En av `DELNINGSDAGAR`.
 * @param {boolean} d.nedladdning
 * @returns {{ id: string, postId: string, groupId: string, skapadAv: { uid: string, namn: string }, skapad: number, giltigTill: number, aterkallad: null, nedladdning: boolean }}
 */
export function byggDelning(d) {
  if (!d || typeof d !== "object") throw new Error("byggDelning: en delning krävs.");
  const postId = text(d.postId);
  const groupId = text(d.groupId);
  const uid = text(d.skapadAv?.uid);
  if (!postId) throw new Error("byggDelning: postId krävs.");
  if (!groupId) throw new Error("byggDelning: groupId krävs.");
  if (!uid) throw new Error("byggDelning: skapadAv.uid krävs. Utan den går det inte att se vem som får stänga länken.");
  if (!Number.isInteger(d.skapad) || d.skapad < 0) throw new Error("byggDelning: skapad ska vara ett heltal, millisekunder.");
  if (!(/** @type {readonly number[]} */ (DELNINGSDAGAR).includes(d.dagar))) {
    throw new Error(`byggDelning: utgångstiden ${String(d.dagar)} dagar finns inte. Giltiga: ${DELNINGSDAGAR.join(", ")}. Ingen utgång finns inte för en fil.`);
  }
  if (typeof d.nedladdning !== "boolean") throw new Error("byggDelning: nedladdning ska vara sant eller falskt.");
  return {
    id: delningsId(d.token),
    postId,
    groupId,
    skapadAv: { uid, namn: text(d.skapadAv?.namn) },
    skapad: d.skapad,
    giltigTill: d.skapad + d.dagar * DYGN_MS,
    aterkallad: null,
    nedladdning: d.nedladdning,
  };
}

/**
 * Delningspostens form för en NY delning, en fil eller en händelse, eller felet som säger varför den inte går att bygga.
 *
 * ⛔ `id` ÄR HASHEN AV ADRESSEN, och adressen står i klartext i `adress` (se filhuvudet: panelen ska kunna visa den). Raden bär `felAntal` och
 * `felFonster` från början, också utan kod: räknaren för felaktiga koder är då alltid ett tal och aldrig ett fält som saknas, vilket en villkorad skrivning
 * inte kan jämföra på ett pålitligt sätt.
 *
 * ⛔ GILTIGHETEN ÄR EN AV `DELNINGSDAGAR` FÖR EN FIL, OCH `null` ("ingen gräns") ÄR BARA TILLÅTET FÖR EN HÄNDELSE (`HANDELSEDAGAR`). Reglerna för en
 * fil är oförändrade: en fillänk som aldrig går ut är en länk som aldrig stängs.
 *
 * @param {object} d
 * @param {"post" | "handelse"} d.slag
 * @param {string} d.adress `<gruppdel>/lib/<fildel>` eller `<gruppdel>/event/<händelsedel>`, med slumpslutet redan på om länken saknar kod.
 * @param {string} [d.postId] Krävs för en fil.
 * @param {string} [d.handelseId] Krävs för en händelse.
 * @param {string} d.groupId
 * @param {{ uid: string, namn?: string }} d.skapadAv
 * @param {number} d.skapad Millisekunder.
 * @param {number | null} d.dagar
 * @param {boolean} [d.nedladdning] Krävs för en fil.
 * @param {{ salt: string, hash: string } | null} [d.kod]
 * @returns {Record<string, any>}
 */
export function byggAdressdelning(d) {
  if (!d || typeof d !== "object") throw new Error("byggAdressdelning: en delning krävs.");
  if (!(/** @type {readonly string[]} */ (DELNINGSSLAG).includes(d.slag))) throw new Error(`byggAdressdelning: slaget "${String(d.slag)}" finns inte. Giltiga: ${DELNINGSSLAG.join(", ")}.`);
  const tolkad = tolkaAdress(d.adress);
  if (!tolkad || tolkad.slag !== d.slag) {
    throw new Error(`byggAdressdelning: adressen "${String(d.adress)}" är ingen ${d.slag === "post" ? `fil-adress (<gruppdel>/${ADRESSSEGMENT.post}/<fildel>)` : `händelse-adress (<gruppdel>/${ADRESSSEGMENT.handelse}/<händelsedel>)`}.`);
  }
  const groupId = text(d.groupId);
  const uid = text(d.skapadAv?.uid);
  if (!groupId) throw new Error("byggAdressdelning: groupId krävs.");
  if (!uid) throw new Error("byggAdressdelning: skapadAv.uid krävs. Utan den går det inte att se vem som får stänga länken.");
  if (!Number.isInteger(d.skapad) || d.skapad < 0) throw new Error("byggAdressdelning: skapad ska vara ett heltal, millisekunder.");
  const bas = {
    id: adressId(d.adress),
    slag: d.slag,
    rattighet: /** @type {const} */ ("las"),
    adress: d.adress,
    groupId,
    skapadAv: { uid, namn: text(d.skapadAv?.namn) },
    skapad: d.skapad,
    aterkallad: null,
    felAntal: 0,
    felFonster: 0,
    ...(d.kod ? { kod: { salt: d.kod.salt, hash: d.kod.hash } } : {}),
  };
  if (d.slag === "post") {
    const postId = text(d.postId);
    if (!postId) throw new Error("byggAdressdelning: postId krävs för en fil.");
    if (!(/** @type {readonly number[]} */ (DELNINGSDAGAR).includes(/** @type {number} */ (d.dagar)))) {
      throw new Error(`byggAdressdelning: utgångstiden ${String(d.dagar)} dagar finns inte för en fil. Giltiga: ${DELNINGSDAGAR.join(", ")}. Ingen utgång finns inte för en fil.`);
    }
    if (typeof d.nedladdning !== "boolean") throw new Error("byggAdressdelning: nedladdning ska vara sant eller falskt.");
    return { ...bas, postId, giltigTill: d.skapad + /** @type {number} */ (d.dagar) * DYGN_MS, nedladdning: d.nedladdning };
  }
  const handelseId = text(d.handelseId);
  if (!handelseId) throw new Error("byggAdressdelning: handelseId krävs för en händelse.");
  if (!(/** @type {readonly (number | null)[]} */ (HANDELSEDAGAR).includes(d.dagar))) {
    throw new Error(`byggAdressdelning: utgångstiden ${String(d.dagar)} dagar finns inte. Giltiga: ingen gräns, ${DELNINGSDAGAR.join(", ")}.`);
  }
  return { ...bas, handelseId, giltigTill: d.dagar === null ? null : d.skapad + d.dagar * DYGN_MS };
}

/**
 * Headern som lagringen sätter på svaret: `inline` när nedladdning är av, `attachment` med filnamn när den är på.
 *
 * ⛔ FILNAMNET ÄR ANVÄNDARENS TEXT OCH BLIR EN HEADER. Citationstecken, radbrytningar och allt utanför ASCII rensas ur den enkla
 * formen, och den riktiga formen går som `filename*` med procentkodning (RFC 5987). Annars är ett filnamn med `"` eller en
 * radbrytning ett sätt att skriva egna headrar.
 *
 * ⛔ EN HTML-FIL ÄR ALLTID `attachment` (0.156.0, cllp/ops-framework#472). `mime` är valfri och bara HTML ändras av den: en signerad adress som svarade `inline` på en HTML-fil hade ritat den som en sida på lagringens
 * adress, med dokumentets kod körande, utanför den avspärrade rutan. Det gäller också en länk som delats utan nedladdning och en fil på en händelsesida (som annars öppnas inline).
 *
 * @param {string} namn
 * @param {boolean} bifoga
 * @param {unknown} [mime] Filens MIME. Anropare som har den ska skicka den.
 * @returns {string}
 */
export function delningsDisposition(namn, bifoga, mime) {
  if (!bifoga && !arHtmlMime(mime)) return "inline";
  const rent = (typeof namn === "string" ? namn : "").trim();
  const enkel = rent.replace(/[^A-Za-z0-9._ -]/g, "_") || "fil";
  const kodad = encodeURIComponent(rent || "fil").replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${enkel}"; filename*=UTF-8''${kodad}`;
}

/**
 * @typedef {object} Delningssamlingar
 * @property {string} delningar Samlingen delningarna ligger i. Inget förval: det är appens namn.
 * @property {string} bibliotek Samlingen biblioteksposterna ligger i. Inget förval.
 * @property {string} [gruppdelar] (0.125.0) Samlingen gruppdelarna ligger i, en rad per gruppdel med `{ plats, skapad }`. Förval `delningsgruppdelar`. Appens regelfragment ska nekas klienten (`delningsregelfragment("delningar", { gruppdelar: true })`).
 * @property {string} [handelser] (0.125.0) Appens händelsesamling. Utan den går ingen händelse att dela: `skapa` med `handelseId` kastar och en händelselänk öppnas inte.
 * @property {string} [medlemskap] Förval `memberships`.
 */

/**
 * @typedef {object} Delningslagring
 * @property {(b: { sokvag: string, sekunder: number, disposition: string, mime: string }) => Promise<string>} signeradAdress
 *   En adress till filen som gäller i `sekunder` och svarar med headern `disposition` som `Content-Disposition`. Med Admin SDK:
 *   `bucket.file(sokvag).getSignedUrl({ version: "v4", action: "read", expires, responseDisposition, responseType })`.
 */

/**
 * @typedef {object} Handelsesida
 * @property {string} titel Händelsens titel i appens fält. Krävs och får inte vara tom.
 * @property {string} [beskrivning] Löptext. Visas med radbrytningar, aldrig som HTML.
 * @property {string} [plats]
 */

/**
 * Svaret för en länk som inte går att visa. Alltid en ny kopia: svaret är samma sak men inte samma objekt.
 * @param {(typeof import("../lib/delning.js").DELNINGSORSAKER)[number]} orsak
 */
const nej = (orsak) => ({ ok: /** @type {const} */ (false), orsak });

/**
 * Bygger tjänsten bakom länken.
 *
 * @param {object} konfig
 * @param {import("../data/contract.js").DataSource<any>} konfig.kalla Kräver `createNew` och `updateIf`.
 * @param {Delningslagring} konfig.lagring
 * @param {Delningssamlingar} konfig.samlingar
 * @param {(handelse: Record<string, any>) => Handelsesida} [konfig.handelseSida] Krävs när `samlingar.handelser` finns: vilka av appens fält som är titel, beskrivning och plats.
 * @param {(arg: { uid: string, groupId: string, medlemskap: Record<string, any>, handelse: Record<string, any> }) => boolean | Promise<boolean>} [konfig.farDelaHandelse]
 *   Appens regel för vem som får dela och stänga en händelses länkar, om den är snävare än "aktiv medlem". Prövas EFTER medlemskapet, aldrig i stället för det
 *   (samma mönster som `farRedigera` i `createFlyttaService`).
 * @param {() => number} [konfig.klocka] Millisekunder. Förval `Date.now`. Provens enda sätt att låta en länk gå ut.
 */
export function createDelningService(konfig) {
  /*
   * ⛔ DESTRUKTURERINGEN LIGGER I KROPPEN, av samma skäl som i `inbjudningstjanst`: `({ kalla })` i signaturen kastar Nodes
   * "Cannot destructure" innan valideringen hinner köra, och det felet nämner inte fabriken.
   */
  const { kalla, lagring, samlingar, handelseSida, farDelaHandelse, klocka = Date.now } = konfig ?? {};
  const namn = "createDelningService";
  if (!kalla || typeof kalla.read !== "function" || typeof kalla.list !== "function") {
    throw new Error(`${namn}: en datakälla med read och list krävs. Ramverket känner ingen databas.`);
  }
  if (typeof kalla.createNew !== "function") {
    throw new Error(`${namn}: datakällan saknar createNew. Id:t är en hash och en delning skrivs aldrig över. Se datakontraktets regel 8.`);
  }
  if (typeof kalla.updateIf !== "function") {
    throw new Error(`${namn}: datakällan saknar updateIf. Att stänga en länk, att ändra nedladdning och att räkna felaktiga koder får inte kunna korsa varandra, och en läsning följd av en skrivning gör det. Se datakontraktets regel 7.`);
  }
  if (!lagring || typeof lagring.signeradAdress !== "function") {
    throw new Error(`${namn}: en lagring med signeradAdress krävs. Den publika sidan får aldrig en öppen sökväg, bara en adress som går ut.`);
  }
  for (const falt of /** @type {const} */ (["delningar", "bibliotek"])) {
    const v = samlingar?.[falt];
    if (typeof v !== "string" || !SAMLINGSFORM.test(v)) {
      throw new Error(`${namn}: samlingar.${falt} krävs, ett samlingsnamn. Ramverket känner inte appens samlingsnamn och gissar inget.`);
    }
  }
  if (samlingar.handelser !== undefined && (typeof samlingar.handelser !== "string" || !SAMLINGSFORM.test(samlingar.handelser))) {
    throw new Error(`${namn}: samlingar.handelser är ett samlingsnamn (appens händelser), eller utelämnas.`);
  }
  if (samlingar.handelser !== undefined && typeof handelseSida !== "function") {
    throw new Error(`${namn}: handelseSida krävs när samlingar.handelser finns, en funktion som säger vilka av appens fält som är titel, beskrivning och plats. Ramverket känner inte appens fält på en händelse och gissar inte.`);
  }
  if (samlingar.handelser === undefined && (handelseSida !== undefined || farDelaHandelse !== undefined)) {
    throw new Error(`${namn}: handelseSida och farDelaHandelse hör till händelsedelningen och kräver samlingar.handelser. Utan den går ingen händelse att dela, och en regel som aldrig anropas hade bara sett ut som ett skydd.`);
  }
  if (handelseSida !== undefined && typeof handelseSida !== "function") throw new Error(`${namn}: handelseSida måste vara en funktion (eller utelämnas).`);
  if (farDelaHandelse !== undefined && typeof farDelaHandelse !== "function") throw new Error(`${namn}: farDelaHandelse måste vara en funktion (eller utelämnas).`);
  /*
   * ⛔ ANROPEN GÅR TILL KÄLLAN VARJE GÅNG, METODEN FÅNGAS INTE VID BYGGET (samma skäl som i `inbjudningstjanst`). En källa som lindas in efteråt,
   * till exempel av ett prov som lägger in ett fel mellan läsningen och skrivningen, träffas av samma anrop som `read`.
   */
  /** @type {(samling: string, data: any) => Promise<{ created: boolean, row: any }>} */
  const skapaNy = (samling, data) => /** @type {any} */ (kalla).createNew(samling, data);
  /** @type {(samling: string, id: string, villkor: Record<string, unknown>, data: any) => Promise<{ updated: boolean, row: any }>} */
  const uppdateraOm = (samling, id, villkor, data) => /** @type {any} */ (kalla).updateIf(samling, id, villkor, data);
  const DELNINGAR = samlingar.delningar;
  const BIBLIOTEK = samlingar.bibliotek;
  const HANDELSER = samlingar.handelser;
  const MEDLEMSKAP = samlingar.medlemskap ?? "memberships";
  const GRUPPDELAR = samlingar.gruppdelar ?? "delningsgruppdelar";
  if (!SAMLINGSFORM.test(GRUPPDELAR)) throw new Error(`${namn}: samlingar.gruppdelar är ett samlingsnamn, eller utelämnas (förval delningsgruppdelar).`);

  /**
   * Platsen en gruppdel tillhör: gruppens id, eller `mitt~<uid>` för Mitt bibliotek. En händelses eller ett ärendes plats ger gruppen.
   * @param {string} groupId
   */
  const platsForGruppdel = (groupId) => (arMittBibliotek(groupId) ? groupId : gruppForPlats(groupId));

  /**
   * @param {string} uid
   * @param {string} groupId
   */
  async function aktivtMedlemskap(uid, groupId) {
    // ⛔ EN HÄNDELSES FILER DELAR GRUPPENS MEDLEMSKAP (0.121.0, lifehub.app#366). Platsen `handelse~<grupp>~<händelse>` är ingen grupp, och ett
    // medlemskap med hela strängen som grupp finns inte: utan uppslaget via `gruppForPlats` hade en händelsefil nekats tyst, för alla.
    const rad = await kalla.read(MEDLEMSKAP, medlemskapsId(uid, gruppForPlats(groupId)));
    return rad && rad.status === "aktiv" && rad.typ !== "agent" ? rad : null;
  }

  /**
   * @param {string} uid
   * @param {string} groupId
   */
  async function forvaltar(uid, groupId) {
    if (arMittBibliotek(groupId)) return false;
    const m = await aktivtMedlemskap(uid, groupId);
    return Boolean(m) && (m.roll === "agare" || m.roll === "admin");
  }

  /**
   * Får personen dela den här händelsen enligt appens egen regel? Falskt när appen inte har någon: då gäller bara medlemskapet, som prövas av den som anropar.
   * @param {string} uid
   * @param {Record<string, any>} medlemskap
   * @param {Record<string, any>} handelse
   */
  async function appenTillater(uid, medlemskap, handelse) {
    if (!farDelaHandelse) return true;
    return (await farDelaHandelse({ uid, groupId: handelse.groupId, medlemskap, handelse })) === true;
  }

  /**
   * Den som delade, eller en admin eller ägare i delningens grupp, eller (för en händelse) den som appens regel släpper in, får ändra den.
   *
   * ⛔ DEN SOM DELADE FÅR ALLTID STÄNGA, ÄVEN EFTER ATT HEN LÄMNAT GRUPPEN. Att kräva ett aktivt medlemskap här hade låtit en
   * länk leva vidare efter att personen som skapade den inte längre kunde stänga den.
   *
   * ⛔ FÖR EN HÄNDELSE STÄNGER ÄVEN DEN SOM FÅR ÄNDRA HÄNDELSEN (CP 2026-10-19: "den som får skapa och återkalla en länk är den som får ändra händelsen").
   * Det kräver att händelsen finns och att appen släpper in personen: en stängning minskar vad länken ger, men en främling ska inte kunna stänga.
   *
   * @param {string} vem
   * @param {Record<string, any>} rad
   * @param {string} vad
   */
  async function kravForvalta(vem, rad, vad) {
    if (rad.skapadAv?.uid === vem) return;
    if (typeof rad.groupId === "string" && (await forvaltar(vem, rad.groupId))) return;
    if (rad.slag === "handelse" && (await kanAndraHandelse(vem, rad))) return;
    throw new Error(`${vad}: ${vem} är inte den som delade och inte admin eller ägare i platsen. Länken ändras inte.`);
  }

  /**
   * Är personen aktiv medlem och släpper appen in hen på händelsen som raden delar? Händelsen läses nu; finns den inte är svaret nej.
   * @param {string} vem
   * @param {Record<string, any>} rad
   */
  async function kanAndraHandelse(vem, rad) {
    // ⛔ UTAN APPENS REGEL FINNS INGEN "FÅR ÄNDRA HÄNDELSEN" ATT LÅNA: då stänger bara den som delade, admin och ägare. Annars hade varje aktiv medlem
    // kunnat stänga andras länkar.
    if (!farDelaHandelse || !HANDELSER || typeof rad.handelseId !== "string" || typeof rad.groupId !== "string") return false;
    const h = await kalla.read(HANDELSER, rad.handelseId);
    if (!h || h.groupId !== rad.groupId) return false;
    const m = await aktivtMedlemskap(vem, rad.groupId);
    return Boolean(m) && (await appenTillater(vem, m, h));
  }

  /**
   * Att SLÅ PÅ nedladdning kräver mer än att stänga: den som delade ska fortfarande höra till platsen, annars krävs admin eller ägare.
   *
   * ⛔ EN BORTTAGEN MEDLEM FÅR STÄNGA MEN INTE ÖPPNA. Att stänga minskar vad en länk ger, så det är rätt även efter att personen lämnat
   * gruppen. Att slå på nedladdning ökar det, och en person som tagits bort ur gruppen hade annars kunnat göra en fil i gruppen
   * nedladdningsbar för vem som helst med länken. Samma krav gäller att slå av, för ett enda villkor är lättare att resonera om.
   *
   * @param {string} vem
   * @param {Record<string, any>} rad
   * @param {string} vad
   */
  async function kravAndraNedladdning(vem, rad, vad) {
    if (rad.skapadAv?.uid === vem && typeof rad.groupId === "string") {
      if (arMittBibliotek(rad.groupId)) {
        // I ett eget bibliotek är platsen personens egen så länge uid:t är ägarens.
        let egen = "";
        try {
          egen = mittBibliotek(vem);
        } catch {
          egen = "";
        }
        if (rad.groupId === egen) return;
      } else if (await aktivtMedlemskap(vem, rad.groupId)) {
        return;
      }
    }
    if (typeof rad.groupId === "string" && (await forvaltar(vem, rad.groupId))) return;
    throw new Error(`${vad}: ${vem} är inte aktiv medlem som delade, och inte admin eller ägare i platsen. Länken ändras inte.`);
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
   * En fil som är färdig uppladdad. En post utan `klar` räknas som klar (poster före 0.117.0), `klar: false` gör den inte. Samma fråga som `arDelbar` ställer för en fil (en sanning).
   * @param {Record<string, any> | null | undefined} post
   */
  const arKlarFil = (post) => post?.typ === "fil" && arDelbar(post);

  /**
   * Adressdelarna ur anropet, eller `ogiltig-adress`. Delen en person skriver är högst `MAX_ADRESSDEL` tecken: slumpslutet läggs på efteråt.
   * @param {unknown} gruppdel
   * @param {unknown} sista
   * @param {string} vad
   */
  function kravAdressdelar(gruppdel, sista, vad) {
    if (!arAdressdel(gruppdel, MAX_ADRESSDEL) || !arAdressdel(sista, MAX_ADRESSDEL)) {
      throw felMedKod(
        "ogiltig-adress",
        `${vad}: gruppdel och sista del är gemener, siffror och enstaka bindestreck, högst ${MAX_ADRESSDEL} tecken var (adressdel() ger rätt form ur en text).`,
      );
    }
    return { gruppdel: /** @type {string} */ (gruppdel), sista: /** @type {string} */ (sista) };
  }

  /**
   * Koden ur anropet som den lagras, eller `null` utan kod. En ogiltig kod är ett fel (`ogiltig-kod`) och aldrig "ingen kod": en länk som skulle vara
   * skyddad får aldrig bli öppen för att koden var för kort.
   * @param {unknown} kod
   * @param {string} vad
   */
  async function kodForSkapa(kod, vad) {
    const fel = kodFel(kod);
    if (fel) throw felMedKod("ogiltig-kod", `${vad}: ${fel}`);
    return normaliseraKod(kod) ? hashaKod(/** @type {string} */ (kod)) : null;
  }

  /**
   * Gruppdelen tillhör platsen, eller `adress-upptagen`. Finns den och hör till en annan plats nekas den; hör den till samma plats går det bra; finns den inte
   * skapas den för platsen med `createNew`. Hinner en annan plats före (`created: false`) prövas den raden i stället.
   *
   * ⛔ INGEN LÄS-SEDAN-SKRIV-KONTROLL SOM AVGÖR: läsningen först är bara ett snabbt nej. Det som avgör vem som äger namnet är `createNew`, och den som förlorar
   * en kapplöpning får raden den andra skrev tillbaka och prövas mot den.
   *
   * @param {string} gruppdel
   * @param {string} plats
   * @param {string} vad
   */
  async function sakraGruppdel(gruppdel, plats, vad) {
    for (let i = 0; i < 3; i++) {
      let rad = await kalla.read(GRUPPDELAR, gruppdel);
      if (!rad) {
        const { created, row } = await skapaNy(GRUPPDELAR, { id: gruppdel, plats, skapad: klocka() });
        if (created) return;
        rad = row;
      }
      if (!rad) continue;
      if (rad.plats === plats) return;
      throw felMedKod("adress-upptagen", `${vad}: gruppdelen "${gruppdel}" används av en annan grupp. Välj en annan gruppdel.`, { del: "gruppdel" });
    }
    throw felMedKod("adress-upptagen", `${vad}: gruppdelen "${gruppdel}" kunde inte tas just nu. Försök igen.`, { del: "gruppdel" });
  }

  /**
   * Skriver raden under en ledig adress. UTAN kod läggs ett slumpat slut på sista delen och en krock försöks om med ett nytt; MED kod är adressen exakt
   * det personen skrev och en krock är `adress-upptagen`. `createNew` är det som avgör: id:t är hashen av adressen. Gruppdelen tas först för platsen (`sakraGruppdel`).
   *
   * @param {{ slag: "post" | "handelse", gruppdel: string, sista: string, harKod: boolean, plats: string, bygg: (adress: string) => Record<string, any>, vad: string }} d
   * @returns {Promise<Record<string, any>>}
   */
  async function skrivUnderAdress(d) {
    await sakraGruppdel(d.gruppdel, d.plats, d.vad);
    const forsok = d.harKod ? 1 : 5;
    for (let i = 0; i < forsok; i++) {
      const sista = d.harKod ? d.sista : `${d.sista}-${nyttSlumpslut()}`;
      const adress = byggAdress({ slag: d.slag, gruppdel: d.gruppdel, sista });
      const rad = d.bygg(adress);
      const { created } = await skapaNy(DELNINGAR, rad);
      if (created) return rad;
    }
    throw felMedKod("adress-upptagen", `${d.vad}: adressen är upptagen. Välj en annan${d.harKod ? "" : " (ett nytt slumpat slut gav också en krock, försök igen)"}.`, { del: "sista" });
  }

  /**
   * Svaret från `skapa`: adressen, sökvägen och det som gäller. Tokenet finns inte längre.
   * @param {Record<string, any>} rad
   */
  function skapaSvar(rad) {
    return {
      id: /** @type {string} */ (rad.id),
      adress: /** @type {string} */ (rad.adress),
      sokvag: delningsSokvag(rad.adress),
      giltigTill: /** @type {number | null} */ (rad.giltigTill),
      harKod: Boolean(rad.kod),
      rattighet: /** @type {"las"} */ (rad.rattighet),
      ...(rad.slag === "post" ? { nedladdning: rad.nedladdning === true } : {}),
    };
  }

  /**
   * Delar en post: en fil, en anteckning, en länk eller en lista (0.133.0; förut bara en fil).
   *
   * ⛔ POSTENS EGEN GRUPP ÄR DEN SOM GÄLLER (IDOR). `groupId` i anropet är det anroparen tror, och det är posten som avgör. En
   * medlem i grupp A som skickar groupId "A" med en post-id ur grupp B får samma nej som för en post som inte finns:
   * behörigheten prövas mot den grupp posten faktiskt ligger i, aldrig mot den som angavs.
   *
   * @param {Record<string, any>} b
   */
  async function skapaPost(b) {
    const uid = kravText(b?.uid, "uid", "skapa");
    const postId = kravText(b?.postId, "postId", "skapa");
    const groupId = kravText(b?.groupId, "groupId", "skapa");
    if (!(/** @type {readonly number[]} */ (DELNINGSDAGAR).includes(b?.dagar))) {
      throw new Error(`skapa: utgångstiden ${String(b?.dagar)} dagar finns inte. Giltiga: ${DELNINGSDAGAR.join(", ")}.`);
    }
    const nedladdning = b.nedladdning === undefined ? false : b.nedladdning;
    if (typeof nedladdning !== "boolean") throw new Error("skapa: nedladdning ska vara sant eller falskt.");
    const delar = kravAdressdelar(b.gruppdel, b.fildel, "skapa");
    const kod = await kodForSkapa(b.kod, "skapa");

    const post = await kalla.read(BIBLIOTEK, postId);
    // ⛔ `arDelbar` ÄR MENYNS FRÅGA OCKSÅ (regel 2): en fil som är färdig, en anteckning med text, en länk med en http- eller https-adress, en lista. Allt annat är "finns inte", med samma
    // svar som för en post i en annan grupp, så att den som inte hör dit inte kan skilja dem åt.
    if (!arDelbar(post) || post.groupId !== groupId) {
      throw new Error(`skapa: posten finns inte i platsen "${groupId}", eller går inte att dela (en fil som inte blev klar har inget att visa). Inget har delats.`);
    }
    if (nedladdning && post.typ !== "fil" && post.typ !== "lista") {
      throw new Error(`skapa: en ${post.typ === "anteckning" ? "anteckning" : "länk"} har ingenting att ladda ner. Nedladdning gäller en fil och en lista (alla filer i den). Inget har delats.`);
    }

    let medlem = null;
    if (arMittBibliotek(groupId)) {
      // ⛔ I ETT EGET BIBLIOTEK GÄLLER BARA ÄGAREN, samma som regeln för posten. En roll i en grupp ger ingenting här.
      let egen = "";
      try {
        egen = mittBibliotek(uid);
      } catch {
        egen = "";
      }
      if (groupId !== egen || post.skapadAv?.uid !== uid) {
        throw new Error(`skapa: ${uid} äger inte biblioteket "${groupId}" och får inte dela ur det.`);
      }
    } else {
      medlem = await aktivtMedlemskap(uid, groupId);
      if (!medlem) throw new Error(`skapa: ${uid} är inte aktiv medlem i gruppen "${groupId}" och får inte dela.`);
      const alla = medlem.roll === "agare" || medlem.roll === "admin";
      // En vanlig medlem delar bara sina egna poster. Admin och ägare delar alla i gruppen.
      if (!alla && post.skapadAv?.uid !== uid) {
        throw new Error(`skapa: ${uid} har inte skrivit posten och är inte admin eller ägare i "${groupId}". En medlem delar bara sina egna poster.`);
      }
    }

    const skapad = klocka();
    const rad = await skrivUnderAdress({
      slag: "post",
      gruppdel: delar.gruppdel,
      sista: delar.sista,
      harKod: kod !== null,
      plats: platsForGruppdel(groupId),
      vad: "skapa",
      bygg: (adress) =>
        byggAdressdelning({ slag: "post", adress, postId, groupId, skapadAv: { uid, namn: text(b.namn) || text(medlem?.namn) }, skapad, dagar: b.dagar, nedladdning, kod }),
    });
    return skapaSvar(rad);
  }

  /**
   * Delar en händelse. Gruppen läses ur händelsens egen rad och aldrig ur anropet: det finns ingen `groupId` att lita fel på.
   *
   * @param {Record<string, any>} b
   */
  async function skapaHandelse(b) {
    if (!HANDELSER) throw new Error("skapa: händelser går inte att dela. Tjänsten byggdes utan samlingar.handelser.");
    const uid = kravText(b?.uid, "uid", "skapa");
    const handelseId = kravText(b?.handelseId, "handelseId", "skapa");
    const dagar = b.dagar === undefined || b.dagar === null ? null : b.dagar;
    if (!(/** @type {readonly (number | null)[]} */ (HANDELSEDAGAR).includes(dagar))) {
      throw new Error(`skapa: utgångstiden ${String(b.dagar)} dagar finns inte. Giltiga: ingen gräns, ${DELNINGSDAGAR.join(", ")}.`);
    }
    const delar = kravAdressdelar(b.gruppdel, b.handelsedel, "skapa");
    const kod = await kodForSkapa(b.kod, "skapa");

    const h = await kalla.read(HANDELSER, handelseId);
    // ⛔ En arkiverad eller borttagen händelse delas inte, och svaret är detsamma för båda: den som inte hör till gruppen får inte veta vilket.
    if (!h || h.arkiverad === true || !text(h.groupId)) {
      throw felMedKod("finns-inte", `skapa: händelsen "${handelseId}" finns inte, eller är arkiverad. Inget har delats.`);
    }
    const groupId = text(h.groupId);
    // ⛔ MEDLEMSKAPET FÖRST, appens regel efter: en callback som släppte in en icke-medlem hade varit en dörr bredvid reglerna.
    const medlem = await aktivtMedlemskap(uid, groupId);
    if (!medlem) throw felMedKod("ej-behorig", `skapa: ${uid} är inte aktiv medlem i gruppen "${groupId}" och får inte dela dess händelser.`);
    if (!(await appenTillater(uid, medlem, h))) throw felMedKod("ej-behorig", `skapa: ${uid} får inte dela händelsen "${handelseId}".`);

    const skapad = klocka();
    const rad = await skrivUnderAdress({
      slag: "handelse",
      gruppdel: delar.gruppdel,
      sista: delar.sista,
      harKod: kod !== null,
      plats: platsForGruppdel(groupId),
      vad: "skapa",
      bygg: (adress) =>
        byggAdressdelning({ slag: "handelse", adress, handelseId, groupId, skapadAv: { uid, namn: text(b.namn) || text(medlem.namn) }, skapad, dagar, kod }),
    });
    return skapaSvar(rad);
  }

  /**
   * Reserverar ett kodförsök på länken. En villkorad skrivning (`updateIf`), så att två samtidiga försök aldrig räknas som ett.
   *
   * ⛔ FÖRSÖKET RÄKNAS INNAN KODEN PRÖVAS, inte efter. Räknades det efter kunde hundra parallella gissningar alla passera spärren medan räknaren
   * stod på noll, och rätt kod bland dem hade släppts in. Nu får högst `FELKOD_MAX` försök per fönster prövas över huvud taget.
   *
   * @param {string} id
   * @param {Record<string, any>} rad
   * @returns {Promise<{ fonster: number } | null>} `null`: inga försök kvar (eller raden går inte att räkna på, och då öppnas den inte).
   */
  async function reservera(id, rad) {
    let aktuell = rad;
    for (let i = 0; i < 4; i++) {
      if (typeof aktuell.felAntal !== "number" || typeof aktuell.felFonster !== "number") return null;
      const nu = klocka();
      const galler = aktuell.felFonster > 0 && nu < aktuell.felFonster + FELKOD_FONSTER_MS;
      const antal = galler ? aktuell.felAntal : 0;
      if (antal >= FELKOD_MAX) return null;
      const fonster = galler ? aktuell.felFonster : nu;
      const { updated, row } = await uppdateraOm(DELNINGAR, id, { felAntal: aktuell.felAntal, felFonster: aktuell.felFonster }, { felAntal: antal + 1, felFonster: fonster });
      if (updated) return { fonster };
      if (!row) return null;
      aktuell = row;
    }
    return null;
  }

  /**
   * Ger tillbaka ett reserverat försök när koden stämde, så att en besökare som öppnar sidan igen inte låser länken. Gäller bara samma fönster: ett
   * fönster som hunnit bytas lämnas orört.
   *
   * @param {string} id
   * @param {number} fonster
   */
  async function aterlamna(id, fonster) {
    for (let i = 0; i < 3; i++) {
      const rad = await kalla.read(DELNINGAR, id);
      if (!rad || rad.felFonster !== fonster || typeof rad.felAntal !== "number" || rad.felAntal < 1) return;
      const { updated } = await uppdateraOm(DELNINGAR, id, { felAntal: rad.felAntal, felFonster: rad.felFonster }, { felAntal: rad.felAntal - 1 });
      if (updated) return;
    }
  }

  /**
   * Släpper in en besökare på en länk med kod, eller säger varför inte: `kod-kravs` (ingen kod angiven), `for-manga` (försöken slut) eller `fel-kod`.
   *
   * @param {string} id
   * @param {Record<string, any>} rad
   * @param {unknown} kodIn
   * @returns {Promise<null | "kod-kravs" | "fel-kod" | "for-manga">}
   */
  async function provaKod(id, rad, kodIn) {
    const kod = normaliseraKod(kodIn);
    if (!kod) return "kod-kravs";
    // En kod som inte kan vara rätt (för lång) prövas aldrig, och kostar inget försök: det finns ingenting att gissa.
    if (kod.length > KODLANGD.max) return "fel-kod";
    const res = await reservera(id, rad);
    if (!res) return "for-manga";
    if (await kodStammer(rad.kod, kod)) {
      await aterlamna(id, res.fonster);
      return null;
    }
    return "fel-kod";
  }

  /**
   * Det en besökare får se av en FIL: de vitlistade fälten (`DELNINGSSVARSFALT`) och en signerad adress. Används för en fil som delas ensam och för varje fil i en delad lista, så att
   * en fil i en lista bär samma fält som om den delats ensam.
   *
   * @param {Record<string, any>} post En färdig fil (`arKlarFil`).
   * @param {boolean} nedladdning
   */
  async function filInnehall(post, nedladdning) {
    const filnamn = text(post.fil.namn);
    const typ = delningsTyp(post.fil.mime);
    const sign = (/** @type {boolean} */ bifoga) =>
      lagring.signeradAdress({ sokvag: post.fil.sokvag, sekunder: SIGNERAD_SEKUNDER, disposition: delningsDisposition(filnamn, bifoga, post.fil.mime), mime: post.fil.mime });
    const url = await sign(nedladdning);
    // En PDF som ska visas inbäddad kan inte komma från en adress med `attachment`: webbläsaren sparar den i stället för att visa den.
    const visaUrl = nedladdning && typ === "pdf" ? await sign(false) : null;
    const rubrik = arLjudpost(post) ? ljudRubrik(post) : trimSomRegeln(post.rubrik) || filnamn;
    return {
      rubrik,
      typ,
      mime: post.fil.mime,
      storlek: Number.isInteger(post.fil.byte) ? post.fil.byte : null,
      langd: Number.isInteger(post.durationMs) ? post.durationMs : null,
      peaks: peaksGiltiga(post.peaks) ? post.peaks : null,
      nedladdning,
      url,
      visaUrl,
    };
  }

  /**
   * Det en besökare får se av en ANTECKNING (`ANTECKNINGSSVARSFALT`).
   * @param {Record<string, any>} post
   */
  function anteckningInnehall(post) {
    return { typ: /** @type {const} */ ("anteckning"), rubrik: trimSomRegeln(post.rubrik), text: String(post.text) };
  }

  /**
   * Det en besökare får se av en LÄNK (`LANKSVARSFALT`): rubriken och adressen, som `arDelbar` redan prövat är http eller https.
   * @param {Record<string, any>} post
   */
  function lankInnehall(post) {
    return { typ: /** @type {const} */ ("lank"), rubrik: trimSomRegeln(post.rubrik) || String(post.url), url: String(post.url) };
  }

  /**
   * En ogenomskinlig nyckel för en rad i en delad lista: samma vid varje hämtning av samma delning, men ingenting som går att slå upp. Postens eget id lämnar inte servern.
   * @param {string} delningsRadId
   * @param {string} postId
   */
  const radnyckel = (delningsRadId, postId) => createHash("sha256").update(`${delningsRadId}:${postId}`).digest("hex").slice(0, 16);

  /**
   * Det en besökare får se av en LISTA: listan som den ser ut JUST NU (`losLista`, samma funktion som medlemmens vy), vare sig en post tagits ur den, lagts till eller bytt plats sedan
   * länken skapades. Se filhuvudet för CP:s beslut.
   *
   * ⛔ BARA POSTER PÅ LISTANS EGEN PLATS LÄSES IN (`groupId` lika med listans), som i medlemmens vy: ett id från en annan plats blir raden "Finns inte längre" och aldrig innehåll därifrån.
   * ⛔ EN RAD BLIR "FINNS INTE LÄNGRE" OCH BÄR INGET ANNAT FÄLT när posten är borttagen, ligger på en annan plats eller är en fil som inte blev klar (`arDelbar`): det som inte går att visa
   * läcker aldrig sin rubrik. En lista i listan blir `lista-i-lista`, utan fält.
   *
   * @param {Record<string, any>} rad Delningsraden.
   * @param {Record<string, any>} lista Listposten.
   */
  async function listaSvar(rad, lista) {
    const nedladdning = rad.nedladdning === true;
    const alla = Array.isArray(lista.poster) ? /** @type {unknown[]} */ (lista.poster).filter((x) => typeof x === "string") : [];
    const valda = /** @type {string[]} */ (alla.slice(0, MAX_DELADE_LISTPOSTER));
    // Varje id läses för sig (och går därmed genom appens egen läsning). Ett id som inte har postidform slås aldrig upp: det finns inget sådant dokument att fråga efter.
    const lasta = await Promise.all(valda.map(async (id) => (POSTIDFORM.test(id) ? await kalla.read(BIBLIOTEK, id) : null)));
    const platsens = lasta.flatMap((p, i) => (p && typeof p === "object" && p.groupId === lista.groupId ? [{ ...p, id: valda[i] }] : []));
    const poster = await Promise.all(
      losLista({ poster: valda }, /** @type {any} */ (platsens)).map(async (r) => {
        if (!r.post) return { typ: r.skal === "lista" ? /** @type {const} */ ("lista-i-lista") : /** @type {const} */ ("saknas") };
        const post = /** @type {Record<string, any>} */ (r.post);
        if (!arDelbar(post)) return { typ: /** @type {const} */ ("saknas") };
        const id = radnyckel(rad.id, r.id);
        if (post.typ === "fil") return { id, ...(await filInnehall(post, nedladdning)) };
        if (post.typ === "anteckning") return { id, ...anteckningInnehall(post) };
        return { id, ...lankInnehall(post) };
      }),
    );
    return {
      ok: /** @type {const} */ (true),
      delning: {
        typ: /** @type {const} */ ("lista"),
        rubrik: trimSomRegeln(lista.rubrik),
        nedladdning,
        poster,
        ejVisade: alla.length - valda.length,
      },
    };
  }

  /**
   * Det en besökare får se av en POST: en fil, en anteckning, en länk eller en lista. Typen läses ur posten.
   * @param {Record<string, any>} rad
   */
  async function postSvar(rad) {
    if (typeof rad.postId !== "string" || typeof rad.groupId !== "string") return nej("saknas");

    const post = await kalla.read(BIBLIOTEK, rad.postId);
    // ⛔ POSTENS GRUPP MÅSTE VARA DELNINGENS. En post som flyttats till en annan grupp eller till Mitt bibliotek delades inte dit.
    if (!arDelbar(post) || post.groupId !== rad.groupId) return nej("saknas");

    switch (post.typ) {
      case "fil":
        return { ok: /** @type {const} */ (true), delning: await filInnehall(post, rad.nedladdning === true) };
      case "anteckning":
        return { ok: /** @type {const} */ (true), delning: anteckningInnehall(post) };
      case "lank":
        return { ok: /** @type {const} */ (true), delning: lankInnehall(post) };
      default:
        return listaSvar(rad, post);
    }
  }

  /**
   * Det en besökare får se av en HÄNDELSE: bara de listade fälten (`HANDELSESVARSFALT`) och händelsens filer. Allt byggs upp fält för fält, så att ett
   * fält som appen lägger på sin händelse eller på `handelseSida`-svaret aldrig följer med av misstag.
   *
   * @param {Record<string, any>} rad
   */
  async function handelseSvar(rad) {
    if (!HANDELSER || typeof rad.handelseId !== "string" || typeof rad.groupId !== "string") return nej("handelse-saknas");
    const h = await kalla.read(HANDELSER, rad.handelseId);
    // ⛔ En arkiverad eller borttagen händelse visas inte, och en händelse som flyttats till en annan grupp delades inte dit. En händelse med en tid som
    // inte går att läsa öppnar aldrig en länk: fel i datan öppnar ingenting.
    if (!h || h.arkiverad === true || h.groupId !== rad.groupId || handelsefel(h).length > 0) return nej("handelse-saknas");

    // ⛔ APPENS FUNKTION KASTAR VIDARE. En sida utan titel är en felkonfigurerad app, och ett internt fel som loggas är bättre än en publik sida som
    // ser ut att fungera (arbetsreglernas punkt 5).
    const sida = /** @type {Handelsesida | null | undefined} */ (/** @type {any} */ (handelseSida)(h));
    if (!sida || typeof sida !== "object" || typeof sida.titel !== "string" || sida.titel.trim() === "") {
      throw new Error("handelseSida: funktionen ska svara med { titel, beskrivning?, plats? } där titel är en text som inte är tom. Sidan har ingen annan rubrik.");
    }
    for (const falt of /** @type {const} */ (["beskrivning", "plats"])) {
      if (sida[falt] !== undefined && typeof sida[falt] !== "string") throw new Error(`handelseSida: ${falt} ska vara en text (eller utelämnas), inte ${typeof sida[falt]}.`);
    }

    // Filerna: händelsens plats i biblioteket. Varje post läses om med `read` (och går därmed genom appens egen läsning), så en post vars sökväg appen inte
    // vill signera aldrig kommer med via listan.
    // ⛔ BARA PLATSENS FORM FÅNGAS. Ett id som inte går att göra till en plats ger en händelse utan filer; ett fel från databasen kastas vidare, så att en
    // sida utan sina filer aldrig ser ut som en sida som inte hade några.
    let plats = "";
    try {
      plats = handelseBibliotek(rad.groupId, rad.handelseId);
    } catch {
      plats = "";
    }
    const kandidater = plats ? await kalla.list(BIBLIOTEK, { where: { groupId: plats } }) : [];
    const lasta = (await Promise.all(kandidater.map((p) => (typeof p?.id === "string" ? kalla.read(BIBLIOTEK, p.id) : null)))).filter(
      (p) => arKlarFil(p) && p?.groupId === plats,
    );
    lasta.sort((a, b) => (a.skapad ?? 0) - (b.skapad ?? 0) || String(a.id).localeCompare(String(b.id)));
    const valda = lasta.slice(0, MAX_HANDELSEFILER);
    const filer = await Promise.all(
      valda.map(async (post) => {
        const filnamn = text(post.fil.namn);
        return {
          rubrik: arLjudpost(post) ? ljudRubrik(post) : trimSomRegeln(post.rubrik) || filnamn,
          typ: delningsTyp(post.fil.mime),
          mime: String(post.fil.mime ?? ""),
          storlek: Number.isInteger(post.fil.byte) ? post.fil.byte : null,
          // En fil på en händelsesida ÖPPNAS (inline): en bild, en PDF och ett ljud ska visas, och webbläsaren sparar det den inte kan visa.
          url: await lagring.signeradAdress({ sokvag: post.fil.sokvag, sekunder: SIGNERAD_SEKUNDER, disposition: delningsDisposition(filnamn, false, post.fil.mime), mime: post.fil.mime }),
        };
      }),
    );

    const klockslag = (/** @type {unknown} */ v) => (typeof v === "string" && KLOCKFORM.test(v) ? v : null);
    const heldag = h.heldag === true;
    return {
      ok: /** @type {const} */ (true),
      delning: {
        slag: /** @type {const} */ ("handelse"),
        titel: sida.titel.trim(),
        beskrivning: text(sida.beskrivning) || null,
        plats: text(sida.plats) || null,
        datum: /** @type {string} */ (h.datum),
        slutDatum: typeof h.slutDatum === "string" && h.slutDatum > h.datum ? h.slutDatum : null,
        tid: heldag ? null : klockslag(h.tid),
        slutTid: heldag ? null : klockslag(h.slutTid),
        heldag,
        filer,
        ejVisade: lasta.length - valda.length,
      },
    };
  }

  return {
    /**
     * Delar en post (en fil, en anteckning, en länk eller en lista, 0.133.0) eller en händelse. Svarar med adressen (`sokvag`, utan domän) och det som gäller. Anger anropet `handelseId` delas en händelse,
     * annars `postId`. Precis en av dem.
     *
     * Post: `{ uid, postId, groupId, gruppdel, fildel, dagar, nedladdning?, kod?, namn? }`. `nedladdning` gäller en fil och en lista (alla filer i den); `true` för en anteckning eller en länk nekas. Händelse: `{ uid, handelseId, gruppdel, handelsedel, dagar?, kod?, namn? }`
     * där `dagar` utelämnad eller `null` är ingen gräns. Utan kod läggs ett slumpat slut på sista delen.
     *
     * @param {Record<string, any>} b
     * @returns {Promise<{ id: string, adress: string, sokvag: string, giltigTill: number | null, harKod: boolean, rattighet: "las", nedladdning?: boolean }>}
     */
    async skapa(b) {
      const handelse = b?.handelseId !== undefined;
      const fil = b?.postId !== undefined;
      if (handelse === fil) throw new Error("skapa: ange precis en av postId (en fil) och handelseId (en händelse).");
      return handelse ? skapaHandelse(b) : skapaPost(b);
    },

    /**
     * Slår på eller av nedladdning. Bara på en fillänk som inte är stängd.
     *
     * ⛔ VILLKORAT PÅ ATT LÄNKEN INTE ÄR STÄNGD, I SAMMA STEG. En stängd länk öppnas aldrig igen, och en ändring som korsar en
     * stängning får inte lyckas. En händelselänk har ingen nedladdning att ändra: filerna på dess sida öppnas alltid.
     *
     * @param {{ uid: string, id: string, nedladdning: boolean }} b
     * @returns {Promise<{ id: string, nedladdning: boolean }>}
     */
    async andraNedladdning(b) {
      const uid = kravText(b?.uid, "uid", "andraNedladdning");
      const id = kravText(b?.id, "id", "andraNedladdning");
      if (typeof b.nedladdning !== "boolean") throw new Error("andraNedladdning: nedladdning ska vara sant eller falskt.");
      const rad = await kalla.read(DELNINGAR, id);
      if (!rad) throw new Error("andraNedladdning: delningen finns inte.");
      await kravAndraNedladdning(uid, rad, "andraNedladdning");
      if (rad.slag === "handelse") throw new Error("andraNedladdning: en händelselänk har ingen nedladdning att ändra.");
      // ⛔ EN ANTECKNING OCH EN LÄNK HAR INGET ATT LADDA NER (0.133.0). Typen bor i posten och inte i raden (en sanning), så posten läses. Är den borta finns inget att neka: länken öppnas ändå inte.
      if (typeof rad.postId === "string") {
        const mal = await kalla.read(BIBLIOTEK, rad.postId);
        if (mal && (mal.typ === "anteckning" || mal.typ === "lank")) throw new Error(`andraNedladdning: en ${mal.typ === "anteckning" ? "anteckning" : "länk"} har ingenting att ladda ner.`);
      }
      if (rad.aterkallad !== null && rad.aterkallad !== undefined) throw new Error("andraNedladdning: länken är stängd. En stängd länk öppnas inte igen, skapa en ny.");
      const { updated, row } = await uppdateraOm(DELNINGAR, id, { aterkallad: null }, { nedladdning: b.nedladdning });
      if (!updated) throw new Error("andraNedladdning: länken stängdes medan ändringen gjordes. Skapa en ny länk.");
      return { id, nedladdning: Boolean(row?.nedladdning) };
    },

    /**
     * Stänger länken, för alltid. Att stänga en stängd länk är inget fel: svaret är då tiden den redan stängdes.
     *
     * @param {{ uid: string, id: string }} b
     * @returns {Promise<{ id: string, aterkallad: number }>}
     */
    async aterkalla(b) {
      const uid = kravText(b?.uid, "uid", "aterkalla");
      const id = kravText(b?.id, "id", "aterkalla");
      const rad = await kalla.read(DELNINGAR, id);
      if (!rad) throw new Error("aterkalla: delningen finns inte.");
      await kravForvalta(uid, rad, "aterkalla");
      const nu = klocka();
      const { updated, row } = await uppdateraOm(DELNINGAR, id, { aterkallad: null }, { aterkallad: nu });
      if (updated) return { id, aterkallad: nu };
      if (typeof row?.aterkallad === "number") return { id, aterkallad: row.aterkallad };
      throw new Error("aterkalla: länken kunde inte stängas. Försök igen.");
    },

    /**
     * Länkarna som lever: de som inte är stängda och inte har gått ut. Raderna bär adressen (`sokvag`) för en länk skapad med 0.125.0 eller senare, och `null`
     * för en gammal tokenlänk (där finns bara hashen).
     *
     * Utan `handelseId`: filänkarna i platsen `groupId` (som förut). En medlem ser sina egna, en admin och en ägare ser alla i gruppen.
     * Med `handelseId`: länkarna till den händelsen i gruppen `groupId`. En medlem ser sina egna; admin, ägare och den som appens regel
     * släpper in på händelsen ser alla.
     *
     * @param {{ uid: string, groupId: string, handelseId?: string }} b
     * @returns {Promise<Array<{ id: string, slag: "post" | "handelse", postId?: string, handelseId?: string, giltigTill: number | null, nedladdning?: boolean, harKod: boolean, rattighet: "las", sokvag: string | null, skapad: number | null, skapadAv: { uid: string, namn: string } }>>}
     */
    async lista(b) {
      const uid = kravText(b?.uid, "uid", "lista");
      const groupId = kravText(b?.groupId, "groupId", "lista");
      const handelseId = b?.handelseId === undefined ? null : kravText(b.handelseId, "handelseId", "lista");
      let alla = false;
      if (handelseId !== null) {
        if (!HANDELSER) throw new Error("lista: händelser går inte att dela. Tjänsten byggdes utan samlingar.handelser.");
        const m = await aktivtMedlemskap(uid, groupId);
        if (!m) throw new Error(`lista: ${uid} är inte aktiv medlem i gruppen "${groupId}".`);
        alla = m.roll === "agare" || m.roll === "admin";
        if (!alla) {
          const h = await kalla.read(HANDELSER, handelseId);
          alla = Boolean(h) && h?.groupId === groupId && Boolean(farDelaHandelse) && (await appenTillater(uid, m, h));
        }
      } else if (arMittBibliotek(groupId)) {
        if (groupId !== mittBibliotek(uid)) throw new Error(`lista: ${uid} äger inte biblioteket "${groupId}".`);
      } else {
        const m = await aktivtMedlemskap(uid, groupId);
        if (!m) throw new Error(`lista: ${uid} är inte aktiv medlem i gruppen "${groupId}".`);
        alla = m.roll === "agare" || m.roll === "admin";
      }
      const nu = klocka();
      const rader = await kalla.list(DELNINGAR, { where: { groupId } });
      return rader
        .filter((r) => (handelseId !== null ? r.slag === "handelse" && r.handelseId === handelseId : r.slag !== "handelse"))
        .filter((r) => (r.aterkallad === null || r.aterkallad === undefined) && (typeof r.giltigTill === "number" ? r.giltigTill > nu : r.slag === "handelse" && r.giltigTill === null))
        .filter((r) => alla || r.skapadAv?.uid === uid)
        .map((r) => ({
          id: r.id,
          slag: /** @type {"post" | "handelse"} */ (r.slag === "handelse" ? "handelse" : "post"),
          ...(r.slag === "handelse" ? { handelseId: r.handelseId } : { postId: r.postId, nedladdning: r.nedladdning === true }),
          giltigTill: typeof r.giltigTill === "number" ? r.giltigTill : null,
          harKod: Boolean(r.kod),
          rattighet: /** @type {"las"} */ ("las"),
          sokvag: typeof r.adress === "string" && tolkaAdress(r.adress) ? delningsSokvag(r.adress) : null,
          skapad: typeof r.skapad === "number" ? r.skapad : null,
          skapadAv: { uid: r.skapadAv?.uid ?? "", namn: r.skapadAv?.namn ?? "" },
        }));
    },

    /**
     * Gruppdelarna en plats redan har, de senast tagna först, och den senaste. Rutan föreslår den i stället för ett namn ur gruppens namn, så att en grupps länkar
     * ser ut att komma från samma ställe. `groupId` är platsen personen delar ur: gruppen, `mitt~<uid>`, eller en händelses eller ett ärendes plats (som ger gruppens).
     * Den som inte är aktiv medlem (eller i Mitt bibliotek inte ägaren) får ett fel och ingenting om vilka namn som finns.
     *
     * @param {{ uid: string, groupId: string }} b
     * @returns {Promise<{ plats: string, gruppdelar: string[], senaste: string | null }>}
     */
    async gruppdelar(b) {
      const uid = kravText(b?.uid, "uid", "gruppdelar");
      const groupId = kravText(b?.groupId, "groupId", "gruppdelar");
      if (arMittBibliotek(groupId)) {
        if (groupId !== mittBibliotek(uid)) throw new Error(`gruppdelar: ${uid} äger inte biblioteket "${groupId}".`);
      } else if (!(await aktivtMedlemskap(uid, groupId))) {
        throw new Error(`gruppdelar: ${uid} är inte aktiv medlem i gruppen "${groupId}".`);
      }
      const plats = platsForGruppdel(groupId);
      const rader = await kalla.list(GRUPPDELAR, { where: { plats } });
      const sorterade = rader
        .filter((r) => typeof r.id === "string" && r.plats === plats)
        .sort((a, c) => (c.skapad ?? 0) - (a.skapad ?? 0) || String(a.id).localeCompare(String(c.id)));
      const gruppdelar = sorterade.map((r) => r.id);
      return { plats, gruppdelar, senaste: gruppdelar[0] ?? null };
    },

    /**
     * Det den publika sidan får veta om en länk. Anropas utan inloggning, med det som stod i adressen: ett token (en gammal filänk, `/d/<token>`)
     * eller en adress (`<gruppdel>/lib/<fildel>` eller `<gruppdel>/event/<händelsedel>`, utan `/g/`). Koden, om länken har en, kommer i `kod`.
     *
     * @param {unknown} ref
     * @param {{ kod?: unknown }} [val]
     * @returns {Promise<
     *   | { ok: false, orsak: (typeof import("../lib/delning.js").DELNINGSORSAKER)[number] }
     *   | { ok: true, delning: { rubrik: string, typ: string, mime: string, storlek: number | null, langd: number | null, peaks: string | null, nedladdning: boolean, url: string, visaUrl: string | null } }
     *   | { ok: true, delning: { typ: "anteckning", rubrik: string, text: string } }
     *   | { ok: true, delning: { typ: "lank", rubrik: string, url: string } }
     *   | { ok: true, delning: { typ: "lista", rubrik: string, nedladdning: boolean, ejVisade: number, poster: Array<
     *       | { id: string, rubrik: string, typ: string, mime: string, storlek: number | null, langd: number | null, peaks: string | null, nedladdning: boolean, url: string, visaUrl: string | null }
     *       | { id: string, typ: "anteckning", rubrik: string, text: string }
     *       | { id: string, typ: "lank", rubrik: string, url: string }
     *       | { typ: "saknas" | "lista-i-lista" }
     *     > } }
     *   | { ok: true, delning: { slag: "handelse", titel: string, beskrivning: string | null, plats: string | null, datum: string, slutDatum: string | null, tid: string | null, slutTid: string | null, heldag: boolean, filer: Array<{ rubrik: string, typ: string, mime: string, storlek: number | null, url: string }>, ejVisade: number } }
     * >}
     */
    async hamta(ref, val = {}) {
      // ⛔ EN NYCKEL I FEL FORM SLÅS INTE UPP, och svarar som ett utgånget. Det kastar aldrig: skräp i adressen är inget serverfel.
      const n = nyckelFor(ref);
      if (!n) return nej("utgangen");
      const rad = await kalla.read(DELNINGAR, n.id);
      if (!rad) return nej("utgangen");

      // Slaget och rättigheten ur raden. ⛔ Ett okänt slag eller en annan rättighet än `las` öppnas aldrig: en framtida skrivlänk får inte kunna läsas som en läslänk.
      const slag = rad.slag === undefined ? "post" : rad.slag;
      if (!(/** @type {readonly string[]} */ (DELNINGSSLAG).includes(slag))) return nej("utgangen");
      if (rad.rattighet !== undefined && rad.rattighet !== "las") return nej("utgangen");
      // Ett token hör till en gammal filänk. En adress ska vara raden egen: hashen av dess `adress`, med rätt slag. Annars är raden trasig och öppnas inte.
      if (n.form === "token" && slag !== "post") return nej("utgangen");
      if (n.form === "adress") {
        const t = tolkaAdress(rad.adress);
        if (!t || t.slag !== slag || rad.adress !== n.adress) return nej("utgangen");
      }

      if (rad.aterkallad !== null && rad.aterkallad !== undefined) return nej("stangd");
      // En rad med en utgångstid som inte är ett tal gäller inte: fel i datan öppnar aldrig en länk. `null` ("ingen gräns") gäller bara en händelse.
      if (rad.giltigTill === null) {
        if (slag !== "handelse") return nej("utgangen");
      } else if (typeof rad.giltigTill !== "number" || rad.giltigTill <= klocka()) {
        return nej("utgangen");
      }

      // ⛔ KODEN FÖRE ALLT SOM RÖR MÅLET: en besökare utan rätt kod får inte veta något om vad länken pekar på.
      if (rad.kod !== undefined && rad.kod !== null) {
        const stopp = await provaKod(n.id, rad, val?.kod);
        if (stopp) return nej(stopp);
      }

      return slag === "handelse" ? handelseSvar(rad) : postSvar(rad);
    },
  };
}
