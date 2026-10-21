/**
 * Gruppens bibliotek: en anteckning eller en länk.
 *
 * ══ ⛔ VARFÖR DET HÄR INTE ÄR SESSIONSTUDIOS ARTEFAKT (analys 0004, #192) ═
 *
 * SessionStudio samlar åtta typer i en samling och avgör vem som ser dem i
 * klienten, eftersom läsregeln är `allow read: if isAuth()` (ADR-020). Den
 * regeln föddes när en medlemsmedveten läsning inte gick att bevisa mot
 * Firestore. Ramverket har redan medlemskapet som ett uppslag, och en
 * bibliotekspost är gruppens: den som är medlem läser den, och ingen annan.
 *
 * Anteckning och länk är SessionStudios `note` och `link`. Låt, spellista och
 * rider är musikappens modell och hör inte hemma i varje ops-app. Filen är en
 * typ, "fil", och vyn styrs av MIME (CP 2026-10-08): bild, ljud eller dokument.
 * Sökvägen namnger appen. Ramverket lagrar den, det hittar inte på den.
 *
 * ⛔ KATALOGEN ÄR INTE BIBLIOTEKET. Katalogen är gruppens konfiguration
 * (kategori, färg, fas) och skrivs av admin. En anteckning är ett dokument en
 * medlem lägger in. Samma samling för båda hade gett två betydelser åt ett
 * dokument.
 */

import { ID_FORM } from "./katalog.js";
import { SKAPARFALT, byggSkapare } from "./skapare.js";
import { formatDagOchKlockslag } from "./format.js";
import { lankKalla } from "./lankkalla.js";

/**
 * Anteckning, länk, fil och lista. En fil är en post, och MIME avgör hur den visas.
 *
 * ⛔ EN LISTA ÄR EN POST I BIBLIOTEKET (0.128.0, cllp/lifehub.app#378, CP 2026-10-20: "ingen ny app och ingen ny låttyp"). Den pekar på andra poster från SAMMA plats, i en bestämd
 * ordning (`poster: [id, ...]`), och kopierar dem inte. Se `MAX_LISTPOSTER` och `listFel`.
 */
export const BIBLIOTEKTYPER = /** @type {const} */ (["anteckning", "lank", "fil", "lista"]);

/**
 * Flikar i vyn. `ljud` är härlett ur fil+MIME (0.92.0, lifehub.app#163), inte en
 * egen typ i dokumentet.
 *
 * ⛔ BILDER OCH DOKUMENT ÄR TVÅ FLIKAR (0.102.0, CP 2026-10-14: "Det måste se ut exakt som SessionStudio"). SessionStudios
 * bibliotek har Allt, Inspelningar, Anteckningar, Bilder, Dokument och Länkar. `bild` är en fil med bild-MIME, och `fil` är
 * resten av filerna, alltså dokumenten. Båda härledda ur MIME som ljudet, ingen ny typ i dokumentet. Ordningen är SessionStudios.
 *
 * ⛔ EN SJUNDE FLIK, `lista` (0.128.0, cllp/lifehub.app#378), är den enda som SessionStudio inte har, och det är avsiktligt (regel 13: förebilden är ett golv).
 * SessionStudio har ingen lista; en lista som bara syns under Allt hade legat bland hundra poster. Fliken ritas bara när det finns en lista
 * (`OpsBibliotek`, som för Bilder och Anteckningar), så ett bibliotek utan listor ser ut som förut.
 */
export const BIBLIOTEKFLIKAR = /** @type {const} */ (["alla", "ljud", "anteckning", "bild", "fil", "lank", "lista"]);

/** Tak. Samma tal skrivs in i regelfragmentet, ur de här konstanterna. */
export const MAX_BIBLIOTEKRUBRIK = 200;
export const MAX_BIBLIOTEKTEXT = 8000;
export const MAX_BIBLIOTEKURL = 2000;
/**
 * Högst så här många poster i en lista (0.128.0). Taket finns i regeln också, ur den här konstanten. 200 rymmer en spellista och en mapp med kvitton, och håller
 * dokumentet långt under en megabyte (ett id är högst 128 tecken).
 */
export const MAX_LISTPOSTER = 200;
/**
 * Ett postid som en lista får peka på: Firestores automatiska id:n (a-z, A-Z, 0-9), `crypto.randomUUID()` och det en app själv sätter, utan `/` och `~`.
 * Samma form som en händelses id (`HANDELSEIDFORM`), en konstruktion för båda (regel 2). Skrivs in i regeln via `regelRegex`.
 */
export const POSTIDFORM = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
/**
 * Omslaget på en länk: https och sedan synliga tecken. ⛔ BARA https, och inte `ADRESSFORM`s http: bilden hämtas av webbläsaren från en tredje part, och en klartextadress
 * i en sida som annars är https blir ett blandat innehåll som webbläsaren blockerar. Skrivs in i regeln via `regelRegex`.
 */
export const BILDFORM = /^https:\/\/[!-~]+$/;
/** Upp till 25 MB, inklusive gränsen. Samma tal i storage-regeln. */
export const MAX_BIBLIOTEKFIL = 25 * 1024 * 1024;
/**
 * Taket för en ljudfil: 250 MB (CP 2026-10-18). En WAV på fyra minuter är 40 till 70 MB, och CP:s första var 64 264 206 byte.
 * ⛔ BARA LJUD. Bilder och dokument behåller `MAX_BIBLIOTEKFIL`. Samma tal i regeln för posten och för lagringen.
 */
export const MAX_BIBLIOTEKLJUD = 250 * 1024 * 1024;
/**
 * Taket för en videofil: 100 MB (CP 2026-10-19, cllp/lifehub.app#358: "Vi behöver kunna lägga upp upp till 100mb filer. Wav är vanligt
 * och nödvändigt. Men andra filer kan vi ha mindre storlek på."). Ljud behåller sina 250 MB och övriga filer sina 25 MB.
 * ⛔ BARA VIDEO. Samma tal i regeln för posten och för lagringen, och båda får det ur `FILTAK` nedan, aldrig ur en egen kopia.
 */
export const MAX_BIBLIOTEKVIDEO = 100 * 1024 * 1024;
/** Inspelning av en idé, i sekunder. TALK behåller sitt eget tak på 120. */
export const IDE_MAX_SEKUNDER = 10 * 60;
/**
 * Stolpar i vågen. Samma tal i spelaren och i regeln: en post som sparar
 * ett annat antal går inte att rita, och en våg som räknas på två sätt
 * är två sanningar.
 */
export const LJUD_STOLPAR = 48;
/** Längsta ljudet som får sparas, i millisekunder. Tolv timmar. */
export const MAX_LJUD_MS = 12 * 60 * 60 * 1000;
/** Utskrift på en ljudpost. Samma tal i regeln. */
export const MAX_BIBLIOTEKUTSKRIFT = 20000;
export const MAX_BIBLIOTEKFILNAMN = 200;
export const MAX_BIBLIOTEKSOKVAG = 1024;

/**
 * ⛔ TAGGAR (lifehub.app#214, CP 2026-10-13: "Precis som i sessionstudio skall man kunna tagga artefakter så att det blir lättare att
 * filtrera och hitta sina saker även om det är mkt."). En post bär högst `MAX_TAGGAR` taggar. En tagg är gemener, siffror, mellanslag
 * och bindestreck, börjar och slutar med en bokstav eller siffra och är högst `MAX_TAGGLANGD` tecken.
 *
 * ⛔ GEMENER I DOKUMENTET, INTE BARA I VISNINGEN. "Kvitto" och "kvitto" hade annars blivit två taggar i filtret, och två
 * sanningar om samma sak (regel 2). `normaliseraTaggar` gör om det personen skriver, och regeln kräver formen.
 *
 * ⛔ MÖNSTRET SKRIVS IN I REGELN (`regelRegex`), så modell och regel kan inte glida isär. Därför är bokstäverna uppräknade och
 * inte `\p{L}`: Firestores `matches()` får inga omvända snedstreck härifrån. Tecknen täcker svenska, norska, danska, tyska och
 * franska accenter. En tagg med ett tecken utanför dem skrivs om eller avvisas med ett skäl, aldrig tyst.
 */
export const MAX_TAGGAR = 8;
export const MAX_TAGGLANGD = 24;
const TAGGTECKEN = "a-z0-9åäöæøüéèêàâçîïôûëÿ";
export const TAGGFORM = new RegExp(`^[${TAGGTECKEN}]([${TAGGTECKEN} -]{0,${MAX_TAGGLANGD - 2}}[${TAGGTECKEN}])?$`);

/**
 * ⛔ MITT BIBLIOTEK ÄR EN PLATS, INTE EN FLAGGA (0.101.0, lifehub.app#226). CP 2026-10-13: en post "ska antingen kunna vara helt
 * privata till mig själv eller visa till gruppen". Beslutet på #226 var att privat är en egen plats bredvid gruppens, och att dela
 * är att flytta posten dit.
 *
 * En flagga "privat" på en post i gruppens samling hade krävt en läsregel som avgör synlighet per post, och en lista i gruppen hade
 * då varit en fråga regeln inte kan bevisa. Det är permissions-träsket (kanonens regel 13, SessionStudios ADR-020). Platsen är i
 * stället ett eget värde i `groupId`: `mitt~<uid>`. Frågan `where groupId == "mitt~<uid>"` går att bevisa, och regeln är en enda
 * jämförelse med den inloggades uid. Allt annat (fälten, filen, taggarna, sökvägen, storage-regeln) är detsamma som i en grupp, så
 * en post blir inte en annan sorts post när den flyttas.
 *
 * ⛔ PREFIXET KAN INTE KROCKA MED EN GRUPP. Ett grupp-id följer `ID_FORM`, som inte släpper igenom `~`. Resten är uid:t, med de
 * tecken ett Firebase-uid har: bokstäver, siffror, `-` och `_`. Ett snedstreck hade delat sökvägen i lagringen, och ett styrtecken
 * hade godtagits av modellen men nekats av sökvägsregeln (granskningen av PR 365).
 */
export const MITT_PREFIX = "mitt~";
export const MITTFORM = /^mitt~[A-Za-z0-9_-]{1,128}$/;

/**
 * Platsen för en persons eget bibliotek.
 * @param {unknown} uid
 * @returns {string}
 */
export function mittBibliotek(uid) {
  const id = typeof uid === "string" ? uid.trim() : "";
  const plats = `${MITT_PREFIX}${id}`;
  if (!MITTFORM.test(plats)) throw new Error(`mittBibliotek: "${id}" går inte att använda som plats. Ett uid med bokstäver, siffror, - och _ krävs.`);
  return plats;
}

/**
 * Är platsen någons eget bibliotek, och inte en grupp?
 * @param {unknown} groupId
 * @returns {boolean}
 */
export function arMittBibliotek(groupId) {
  return typeof groupId === "string" && MITTFORM.test(groupId);
}

/**
 * `jag` i ens eget bibliotek. Personen är ensam där och får ändra allt hen skrivit, vilket är allt som finns.
 * @param {string} uid
 * @returns {{ uid: string, roll: "agare", groupId: string, status: "aktiv" }}
 */
export function mittJag(uid) {
  return { uid, roll: "agare", groupId: mittBibliotek(uid), status: "aktiv" };
}

/**
 * ⛔ EN HÄNDELSES BIBLIOTEK ÄR OCKSÅ EN PLATS (0.121.0, lifehub.app#366). CP 2026-10-19: "ett händelsebibliotek som bara gäller den
 * händelsen", som i SessionStudio. Ett biljettmejl ska bli en händelse med PDF:erna på, och PDF:erna hör till bion och inte till gruppens
 * bibliotek.
 *
 * Valet stod mellan en egen plats och ett fält `handelseId` på en post i gruppens plats. Platsen vann (docs/beslut/0006): ingen ny modell,
 * för posten är densamma; frågan `where groupId == plats` är ett fält och behöver inget index, medan "gruppens poster utan händelse" inte går
 * att fråga efter i Firestore (ett fält som saknas matchar inte `== null`) och hade krävt en backfill eller ett klientfilter; och
 * storage-sökvägen bär platsen, så behörigheten är två dokument (medlemskapet och posten) och inte tre. Det är samma mönster som Mitt bibliotek
 * (0.101.0), med två skarvar i strängen i stället för en: `handelse~<grupp>~<händelse>`.
 *
 * ⛔ PREFIXET KAN INTE KROCKA. Ett grupp-id följer `ID_FORM` och ett händelse-id `HANDELSEIDFORM`, och ingen av dem har `~`. Platsen kan alltså inte
 * likna en grupp, `mitt~<uid>` eller kalenderpostens `post~<id>` (0.120.0).
 *
 * ⛔ GRUPPEN I PLATSEN ÄR GRUPPENS MEDLEMSKAP. Behörigheten har ingen egen modell: den som är aktiv medlem i `handelsedelar(plats).groupId` läser,
 * och reglerna kräver att händelsen finns och ligger i just den gruppen (annars öppnar en påhittad plats en annan grupps händelsefiler).
 * Server och delning slår upp medlemskapet via `gruppForPlats`, aldrig med hela strängen.
 */
export const HANDELSE_PREFIX = "handelse~";

/** Ett händelse-id: Firestores automatiska id:n (a-z, A-Z, 0-9) och det en app själv sätter. Inget `~`, inget `/`. */
export const HANDELSEIDFORM = POSTIDFORM;

/**
 * Hela platsen. Gruppdelen är `ID_FORM` ur katalogen (inte en kopia av den), så de två inte kan glida isär. Samma uttryck skrivs in i
 * regeln via `regelRegex`.
 */
export const HANDELSEFORM = platsform(HANDELSE_PREFIX, HANDELSEIDFORM);

/**
 * Formen för en plats som hör till ett objekt i gruppen: `<prefix><grupp>~<objekt-id>`. Gruppdelen är `ID_FORM` ur katalogen, id-delen får
 * objektets egen form. En enda konstruktion för händelsens och ärendets plats (regel 2), så att de inte kan glida isär.
 * @param {string} prefix
 * @param {RegExp} idForm
 * @returns {RegExp}
 */
function platsform(prefix, idForm) {
  return new RegExp(`^${prefix}${ID_FORM.source.replace(/^\^|\$$/g, "")}~${idForm.source.replace(/^\^|\$$/g, "")}$`);
}

/**
 * Platsen för ett objekt i en grupp, eller `null` när grupp-id:t eller objekt-id:t inte ger en plats med rätt form.
 * @param {string} prefix
 * @param {RegExp} form
 * @param {unknown} groupId
 * @param {unknown} objektId
 * @returns {{ plats: string | null, g: string, o: string }}
 */
function byggObjektplats(prefix, form, groupId, objektId) {
  const g = typeof groupId === "string" ? groupId.trim() : "";
  const o = typeof objektId === "string" ? objektId.trim() : "";
  const plats = `${prefix}${g}~${o}`;
  return { plats: form.test(plats) ? plats : null, g, o };
}

/**
 * Grupp-id och objekt-id ur en objektplats, eller `null` för allt annat.
 * @param {RegExp} form
 * @param {unknown} plats
 * @returns {{ groupId: string, id: string } | null}
 */
function objektdelar(form, plats) {
  if (typeof plats !== "string" || !form.test(plats)) return null;
  const [, groupId, id] = plats.split("~");
  return { groupId, id };
}

/**
 * Platsen för en händelses filer.
 * @param {unknown} groupId
 * @param {unknown} handelseId
 * @returns {string}
 */
export function handelseBibliotek(groupId, handelseId) {
  const { plats, g, o } = byggObjektplats(HANDELSE_PREFIX, HANDELSEFORM, groupId, handelseId);
  if (!plats) {
    throw new Error(`handelseBibliotek: grupp "${g}" och händelse "${o}" går inte att använda som plats. Ett grupp-id (a-z, 0-9, - och _) och ett händelse-id (a-z, A-Z, 0-9, - och _, utan ~ och /) krävs.`);
  }
  return plats;
}

/**
 * Är platsen en händelses bibliotek?
 * @param {unknown} plats
 * @returns {boolean}
 */
export function arHandelseBibliotek(plats) {
  return typeof plats === "string" && HANDELSEFORM.test(plats);
}

/**
 * Gruppen och händelsen ur en händelseplats, eller `null` för allt annat. Den enda platsen platsen tolkas på i klienten.
 * @param {unknown} plats
 * @returns {{ groupId: string, handelseId: string } | null}
 */
export function handelsedelar(plats) {
  const d = objektdelar(HANDELSEFORM, plats);
  return d ? { groupId: d.groupId, handelseId: d.id } : null;
}

/**
 * ⛔ ETT ÄRENDES FILER ÄR OCKSÅ EN PLATS (0.122.0, lifehub.app#366 punkt 3, docs/beslut/0007). Samma mönster som en händelses (0.121.0):
 * `arende~<grupp>~<id>` i `groupId`, där id:t är INKORGSPOSTENS id. Ärendet bor i appen (inkorgsposten är hemmet, GitHub en spegel), så ärendets
 * filer hör till posten och aldrig till spegelraden. Posten är densamma som alla andra bibliotekposter, så uppladdning, ljudspelare, utskrift och
 * delning fungerar utan ny kod.
 *
 * ⛔ PREFIXET KAN INTE KROCKA med en grupp, `mitt~<uid>`, `handelse~…` eller kalenderpostens `post~<id>`: ingen av dem har samma prefix, och ett grupp-id
 * (`ID_FORM`) har aldrig ett `~`.
 *
 * ⛔ GRUPPEN I PLATSEN ÄR GRUPPENS MEDLEMSKAP, som för en händelse. Slå alltid upp medlemskapet med `gruppForPlats`.
 */
export const ARENDE_PREFIX = "arende~";

/**
 * Ett ärende-id, alltså id:t på appens inkorgspost: Firestores automatiska id:n och det en app själv sätter. Samma form som en händelses
 * (`HANDELSEIDFORM`), inget `~` och inget `/`. En källa, så att de två inte glider isär.
 */
export const ARENDEIDFORM = HANDELSEIDFORM;

/** Hela platsen, med samma konstruktion som `HANDELSEFORM`. Samma uttryck skrivs in i regeln via `regelRegex`. */
export const ARENDEFORM = platsform(ARENDE_PREFIX, ARENDEIDFORM);

/**
 * Platsen för ett ärendes filer.
 * @param {unknown} groupId
 * @param {unknown} arendeId Inkorgspostens id.
 * @returns {string}
 */
export function arendeBibliotek(groupId, arendeId) {
  const { plats, g, o } = byggObjektplats(ARENDE_PREFIX, ARENDEFORM, groupId, arendeId);
  if (!plats) {
    throw new Error(`arendeBibliotek: grupp "${g}" och ärende "${o}" går inte att använda som plats. Ett grupp-id (a-z, 0-9, - och _) och ett ärende-id (a-z, A-Z, 0-9, - och _, utan ~ och /) krävs.`);
  }
  return plats;
}

/**
 * Är platsen ett ärendes bibliotek?
 * @param {unknown} plats
 * @returns {boolean}
 */
export function arArendeBibliotek(plats) {
  return typeof plats === "string" && ARENDEFORM.test(plats);
}

/**
 * Gruppen och ärendet ur en ärendeplats, eller `null` för allt annat.
 * @param {unknown} plats
 * @returns {{ groupId: string, arendeId: string } | null}
 */
export function arendedelar(plats) {
  const d = objektdelar(ARENDEFORM, plats);
  return d ? { groupId: d.groupId, arendeId: d.id } : null;
}

/**
 * Är platsen ett objekts bibliotek, alltså en händelses eller ett ärendes? Det gäller allt som är gemensamt för de två: bara filer, ingen flytt dit
 * eller därifrån, och inte bland platserna i en väljare.
 * @param {unknown} plats
 * @returns {boolean}
 */
export function arObjektbibliotek(plats) {
  return arHandelseBibliotek(plats) || arArendeBibliotek(plats);
}

/**
 * Vilket slags objektbibliotek en plats är, med orden för det i ett felmeddelande: `slag` ("handelse" eller "arende"), `ord` ("en händelses bibliotek",
 * "ett ärendes bibliotek") och `objekt` ("händelsen", "ärendet"), eller `null` för en plats som inte är ett. Det enda stället orden skrivs, så att felen
 * om de två inte glider isär.
 * @param {unknown} plats
 * @returns {{ slag: "handelse" | "arende", ord: string, objekt: string } | null}
 */
export function beskrivObjektbibliotek(plats) {
  if (arHandelseBibliotek(plats)) return { slag: "handelse", ord: "en händelses bibliotek", objekt: "händelsen" };
  if (arArendeBibliotek(plats)) return { slag: "arende", ord: "ett ärendes bibliotek", objekt: "ärendet" };
  return null;
}

/**
 * Gruppen vars medlemskap gäller på platsen: en händelses eller ett ärendes plats ger sin grupp, allt annat ges tillbaka som det är.
 *
 * ⛔ EN SANNING FÖR VEM SOM FÅR (regel 2). Delningstjänsten och appens server (utskrift, städning) slår upp medlemskapet med den här
 * i stället för att tolka strängen var för sig. Glömmer en server den nekas objektets filer, den släpper aldrig in fel person: ett
 * medlemskap med hela platsen som grupp finns inte.
 *
 * @param {string} plats
 * @returns {string}
 */
export function gruppForPlats(plats) {
  return handelsedelar(plats)?.groupId ?? arendedelar(plats)?.groupId ?? plats;
}

/**
 * Format en fil får ha. Bild, ljud och dokument. En sort per fält hade varit
 * en andra typ, och CP valde en typ.
 */
export const FILMIME = /** @type {const} */ ([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/aiff",
  "audio/flac",
  // ⛔ AAC (0.133.0, CP 2026-10-20: "Ladda upp ljudfil" med .aac för iOS). Listan är regelns och Storage-regelns (`filMimeMonster`), så formatet nås först när reglerna är deployade.
  "audio/aac",
  // ⛔ VIDEO (0.127.0, cllp/lifehub.app#358): mp4 och iPhones quicktime (.mov). Andra videoformat tas inte emot förrän någon ber om dem.
  "video/mp4",
  "video/quicktime",
  "application/pdf",
  "text/plain",
]);

/**
 * Taken per MIME-familj, UTÖVER `MAX_BIBLIOTEKFIL` som gäller allt annat. ⛔ ETT HEM FÖR VARJE TAK (regel 2): `filTak` (klienten),
 * Firestore-regeln för posten och Storage-regeln läser alla ur den här listan. Före 0.127.0 stod ljudets tak som en kopia i
 * båda reglerna (`'^audio/.*'` i regler.js) och som en `startsWith("audio/")` i `filTak`: en tredje familj hade krävt tre handskrivna
 * ändringar, och den som glömde en hade fått en klient som släpper in en fil lagringen nekar.
 *
 * @type {ReadonlyArray<{ familj: string, monster: string, tak: number, ord: string }>}
 */
export const FILTAK = Object.freeze([
  Object.freeze({ familj: "audio", monster: "^audio/.*", tak: MAX_BIBLIOTEKLJUD, ord: "ljud" }),
  Object.freeze({ familj: "video", monster: "^video/.*", tak: MAX_BIBLIOTEKVIDEO, ord: "video" }),
]);

/**
 * Regeluttrycket för filens storlek, härlett ur `MAX_BIBLIOTEKFIL` och `FILTAK`: under det allmänna taket, eller under familjens tak.
 *
 * @param {string} mime Regeluttrycket för filens MIME, till exempel `d.fil.mime`.
 * @param {string} storlek Regeluttrycket för filens storlek, till exempel `d.fil.byte`.
 * @param {string} [radbrott] Mellanrummet före varje alternativ. Förval ett blanksteg (en rad); Storage-regeln skickar ett radbrott med indrag.
 * @returns {string}
 */
export function filtakRegel(mime, storlek, radbrott = " ") {
  const grenar = FILTAK.map((g) => `${radbrott}|| (${mime}.matches('${g.monster}') && ${storlek} <= ${g.tak})`).join("");
  return `(${storlek} <= ${MAX_BIBLIOTEKFIL}${grenar})`;
}

/** Fälten i `fil`. Samma lista i regelns `hasOnly`. */
export const FILFALT = /** @type {const} */ (["sokvag", "namn", "mime", "byte", "klar"]);

/**
 * Ett fel när filens adress hämtas, som en text för människor (lifehub.app, CP 2026-10-18).
 *
 * ⛔ ALDRIG LAGRINGENS RÅA FEL I VYN. "Firebase Storage: Object grupper/... does not exist (storage/object-not-found)" säger
 * ingenting till den som ser posten, och visar en sökväg. Ett fel utan lagringskod (appens egna) går igenom som det är.
 *
 * @param {unknown} e
 * @returns {string}
 */
export function filadressFel(e) {
  const kod = e && typeof e === "object" && typeof (/** @type {any} */ (e).code) === "string" ? /** @type {any} */ (e).code : "";
  const text = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  const lagring = kod.startsWith("storage/") || /firebase storage|\(storage\//i.test(text);
  if (kod === "storage/object-not-found" || (lagring && /object-not-found|does not exist/i.test(text))) {
    return "Filen finns inte. Uppladdningen blev troligen inte klar. Ladda upp filen igen.";
  }
  if (kod === "storage/unauthorized" || kod === "storage/unauthenticated" || (lagring && /unauthorized|unauthenticated/i.test(text))) {
    return "Du har inte behörighet att öppna filen.";
  }
  if (lagring) return "Filen gick inte att hämta just nu. Försök igen om en stund.";
  return text || "Filen har ingen adress.";
}

/**
 * `matches()`-uttrycket för MIME, härlett ur `FILMIME`. Regeln och storage-regeln
 * skriver in det här, så listan inte kan glida isär.
 * @returns {string}
 */
export function filMimeMonster() {
  return `^(${FILMIME.join("|")})$`;
}

/**
 * Rubriken på en ny idé: ordet Idé, datum och tid. Personen kan döpa om den.
 *
 * @param {Date} [nu]
 * @returns {string}
 */
export function ideRubrik(nu = new Date()) {
  const d = nu instanceof Date && !Number.isNaN(nu.getTime()) ? nu : new Date();
  const pad = (/** @type {number} */ n) => String(n).padStart(2, "0");
  return `Idé ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Rubriken en ny anteckning får när rubriken lämnas tom: "Anteckning 18 okt 00:47" (CP 2026-10-18).
 *
 * ⛔ INTE DEN TRANSKRIBERADE TEXTEN. Förut fick en inpratad anteckning sin text både som rubrik och text. Texten står nu bara i
 * texten, och rubriken säger när anteckningen gjordes. Ramverkets datumform (`formatDagOchKlockslag`), i den lokala tidszonen.
 * Rubriken går att ändra, och en rubrik som användaren skrivit eller dikterat vinner alltid.
 *
 * @param {Date | number} [nu]
 * @returns {string}
 */
export function anteckningsrubrikNu(nu = new Date()) {
  return `Anteckning ${formatDagOchKlockslag(nu)}`;
}

/**
 * Kort datum för en ljudrad, samma form som SessionStudios metarad.
 * Tom sträng när tiden inte är ett heltal: då är datumet oställt, inte "noll".
 *
 * @param {unknown} ms
 * @returns {string}
 */
export function ljudDatum(ms) {
  if (!Number.isInteger(ms)) return "";
  const d = new Date(/** @type {number} */ (ms));
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

/**
 * Namnet som visas på ett ljud. En sparad rubrik vinner. Saknas den blir det
 * "Röstinspelning" plus datumet posten skapades, så raden aldrig är namnlös.
 *
 * @param {{ rubrik?: unknown, skapad?: unknown } | null | undefined} post
 * @returns {string}
 */
export function ljudRubrik(post) {
  const namn = trimSomRegeln(post?.rubrik);
  if (namn) return namn;
  const datum = ljudDatum(post?.skapad);
  return datum ? `Röstinspelning ${datum}` : "Röstinspelning";
}

/**
 * Tecknen vågen sparas med: base64url, 64 nivåer. Ordningen är nivåns värde, `A` är 0 och `_` är 63.
 *
 * ⛔ VÅGEN SPARAS SOM EN STRÄNG, ETT TECKEN PER STOLPE (https://github.com/cllp/ops-framework/issues/349).
 * CP 2026-10-13 20:24, i Chrome på iPhone: en röstinspelning sparades i Biblioteket och svaret blev "Missing or
 * insufficient permissions." Reglerna prövade varje av de 48 topparna som ett eget uttryck, och Firestore räknar
 * högst 1000 uttryck per skrivning. Både att skapa en inspelning med våg och bakfyllnaden av en gammal nekades med
 * "maximum of 1000 expressions to evaluate has been reached", mätt i emulatorn. Att dela prövningen i bitar om åtta
 * (0.92.4) flyttade taket men tog inte bort det. En sträng prövas med ett uttryck, `matches()`, oavsett hur många
 * stolpar den har, och 64 nivåer är mer än en våg på en telefonskärm kan visa.
 */
export const TOPP_TECKEN = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Antal nivåer en stolpe kan ha. Härlett ur tecknen: en andra siffra för samma sak hade glidit isär. */
export const TOPP_NIVAER = TOPP_TECKEN.length;

/**
 * Formen en sparad våg har: exakt `LJUD_STOLPAR` tecken ur `TOPP_TECKEN`. Regeln skriver samma uttryck via
 * `regelRegex`, och `peaksGiltiga` prövar mot det här, så att regeln och modellen inte kan säga olika (regel 2).
 * Att klassen här och tecknen ovan är samma mängd bevisas i `bibliotek.test.js`.
 */
export const TOPPFORM = new RegExp(`^[A-Za-z0-9_-]{${LJUD_STOLPAR}}$`);

/**
 * Räknade toppar, som de ritas: exakt `LJUD_STOLPAR` tal mellan 0 och 1. Det här är ritformen, aldrig det som
 * sparas. Det som sparas är strängen `kodaToppar` ger.
 *
 * @param {unknown} toppar
 * @returns {toppar is number[]}
 */
export function toppListaGiltig(toppar) {
  if (!Array.isArray(toppar) || toppar.length !== LJUD_STOLPAR) return false;
  return toppar.every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1);
}

/**
 * Vågen som den sparas på posten: en sträng med `LJUD_STOLPAR` tecken ur `TOPP_TECKEN`.
 *
 * ⛔ EN LISTA MED FEL FORM KASTAR, den klipps inte till. En våg som tyst fick tre stolpar för lite hade sparats och
 * sedan sett ut som en inspelning med ett kort ljud.
 *
 * @param {readonly number[]} toppar `LJUD_STOLPAR` tal mellan 0 och 1.
 * @returns {string}
 */
export function kodaToppar(toppar) {
  if (!toppListaGiltig(toppar)) {
    throw new Error(`kodaToppar: vågen ska vara ${LJUD_STOLPAR} tal mellan 0 och 1.`);
  }
  return toppar.map((v) => TOPP_TECKEN[Math.round(v * (TOPP_NIVAER - 1))]).join("");
}

/**
 * Vågen som den sparas, tillbaka till tal att rita. `null` när det inte finns någon sparad våg att rita: fältet
 * saknas, är en lista, har fel längd eller bär ett tecken utanför `TOPP_TECKEN`. Spelaren räknar då fram vågen ur
 * ljudet, som för en post som aldrig fått någon.
 *
 * ⛔ EN GAMMAL LISTA ÄR "INGEN VÅG", INTE ETT FEL. Vågen sparades som en lista av 48 tal innan 0.98.0, men ingen
 * skrivning med den formen gick någonsin igenom reglerna (se `TOPP_TECKEN`), så det finns ingen sådan post i en
 * databas och ingen migrering behövs. Läsaren tål den ändå: en källa som inte är Firestore, eller en post som
 * skrivits för hand, ska ge en våg som räknas om och inte en vy som kastar.
 *
 * @param {unknown} peaks
 * @returns {number[] | null}
 */
export function avkodaToppar(peaks) {
  if (!peaksGiltiga(peaks)) return null;
  return Array.from(peaks, (tecken) => TOPP_TECKEN.indexOf(tecken) / (TOPP_NIVAER - 1));
}

/**
 * Toppar som får sparas: en sträng med exakt `LJUD_STOLPAR` tecken ur `TOPP_TECKEN`.
 *
 * @param {unknown} peaks
 * @returns {peaks is string}
 */
export function peaksGiltiga(peaks) {
  return typeof peaks === "string" && TOPPFORM.test(peaks);
}

/**
 * Fälten en rad får bära. `id` är dokumentets nyckel och står inte här: en
 * kopia av nyckeln inne i dokumentet är en andra sanning.
 *
 * `text` hör till en anteckning och `url` till en länk. Regeln kräver att den
 * andra saknas, så en anteckning inte kan bära en adress vid sidan av texten.
 */
export const BIBLIOTEKFALT = /** @type {const} */ (["groupId", "typ", "rubrik", "text", "url", "kalla", "bild", "poster", "fil", "utskrift", "utskriftJobb", "durationMs", "peaks", "taggar", "skapadAv", "skapad", "andrad"]);

/**
 * En länks adress: http eller https, och sedan bara synliga ASCII-tecken.
 *
 * ⛔ EN SANNING FÖR ADRESSEN (regel 2, granskningen av #304). Regeln får samma
 * uttryck som `matches()` genom `regelRegex` i `regler.js`, och `postFel` prövar
 * mot det här. Förut prövade regeln `https?://.+` och klienten `new URL()`. Då
 * släppte regeln igenom `http://exa mple`, klienten avvisade raden, och hela
 * gruppens bibliotek blev ett läsfel som ingen kunde radera bort.
 *
 * `[!-~]` är tecknen från `!` till `~`: inget mellanslag, ingen tabb, ingen
 * radbrytning. Ett å i en adress skrivs med procentkod, och `normaliseraAdress`
 * gör det åt den som skriver.
 */
export const ADRESSFORM = /^https?:\/\/[!-~]+$/;

/**
 * Roller som får ändra någon annans post. Samma två som `opsArAdmin` i
 * `regelfragment()`, ägare eller admin.
 */
const FORVALTARROLLER = /** @type {const} */ (["agare", "admin"]);

/**
 * @typedef {object} Bibliotekspost
 * @property {string} groupId
 * @property {"anteckning"|"lank"|"fil"|"lista"} typ
 * @property {string} rubrik
 * @property {string} [text] Bara på en anteckning.
 * @property {string} [url] Bara på en länk.
 * @property {"spotify"|"youtube"|"applemusic"|"soundcloud"|"annat"} [kalla] (0.128.0) Bara på en länk: källan, ALLTID härledd ur `url` (`lankKalla`) och aldrig vald. Saknas på en länk från före 0.128.0, och vyn härleder den då ur adressen.
 * @property {string} [bild] (0.128.0) Bara på en länk: omslaget, en https-adress (`BILDFORM`). Saknas när källan inte gav något.
 * @property {string[]} [poster] (0.128.0) Bara på en lista: id:n på poster i SAMMA plats, i ordning, högst `MAX_LISTPOSTER` och utan dubbletter. En tom lista är `[]`, och fältet finns alltid på en lista.
 * @property {{ sokvag: string, namn: string, mime: string, byte: number, klar?: boolean }} [fil] Bara på en fil. `klar: false` medan byte laddas upp, `true` när de finns. Utan fältet (äldre poster) räknas filen som klar.
 * @property {string} [utskrift] Bara på ett ljud. Saknas fältet har ingen bett om en utskrift. Tom sträng är en utskrift utan ord.
 * @property {Record<string, unknown>} [utskriftJobb] (0.133.0) Bara på ett ljud, och bara servern skriver det: läget för en utskrift som pågår eller gick fel (`{ status: "pagar" | "fel", startad, av: { uid, namn }, fel? }`, se `utskriftLage`). Tas bort när utskriften är klar, för då finns `utskrift`. Klienten skriver det aldrig (reglerna).
 * @property {number} [durationMs] Bara på ett ljud. Millisekunder. Saknas fältet är längden inte räknad än.
 * @property {string[]} [taggar] (0.100.0) Högst `MAX_TAGGAR`, var och en i `TAGGFORM`, utan dubbletter. Saknas fältet har posten inga.
 * @property {string} [peaks] Bara på ett ljud. Vågen som en sträng: `LJUD_STOLPAR` tecken ur `TOPP_TECKEN`, ett per stolpe (`kodaToppar`, `avkodaToppar`). Saknas fältet är vågen inte räknad än.
 * @property {import("./skapare.js").Skapare} skapadAv
 * @property {number} skapad Millisekunder.
 * @property {number} andrad Millisekunder.
 */

/**
 * En sträng trimmad som Firestores `trim()` gör det, eller `""` för allt som
 * inte är en sträng.
 *
 * ⛔ TOMHET RÄKNAS SOM I REGELN (regel 2, granskningen av #304). Regeln prövar
 * `d.rubrik.trim().size() > 0`, och Firestores `trim()` tar bara bort tecknen
 * U+0000 till U+0020 i ändarna. JavaScripts `trim()` tar bort alla Unicode-
 * blanktecken (U+00A0, U+3000, U+2028, U+FEFF och fler) men inte U+001F. Med
 * JavaScripts trim släppte regeln in en rubrik av bara U+00A0, och modellen
 * sade "Rubriken saknas." om samma rad. Raden hamnade i `trasiga`, och i skiva 1
 * fick ingen radera, så den stod där för alltid. #311 låter författaren eller
 * admin ta bort en sådan rad. Trimmet står kvar: de två funktionerna räknar
 * fortfarande olika. Mätt mot emulatorn räknades 46
 * tecken olika: 27 kontrolltecken som regeln trimmar och JavaScript inte, och
 * 19 Unicode-blanktecken som JavaScript trimmar och regeln inte. Varje trim i modellen går därför
 * genom den här funktionen, också den som vyn använder.
 *
 * @param {unknown} v
 * @returns {string}
 */
export function trimSomRegeln(v) {
  if (typeof v !== "string") return "";
  let start = 0;
  let slut = v.length;
  while (start < slut && v.charCodeAt(start) <= 0x20) start += 1;
  while (slut > start && v.charCodeAt(slut - 1) <= 0x20) slut -= 1;
  return v.slice(start, slut);
}

const str = trimSomRegeln;

/**
 * Adressen som den sparas: trimmad, och med procentkod och gemener i schema och värdnamn när
 * den går att läsa som http eller https. Annars oförändrad, så att `ADRESSFORM`
 * får säga nej med sitt eget skäl.
 *
 * @param {unknown} v
 * @returns {string}
 */
export function normaliseraAdress(v) {
  const url = str(v);
  try {
    const u = new URL(url);
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
  } catch {
    // Går inte att läsa. ADRESSFORM avgör.
  }
  return url;
}

/**
 * MIME utan parametrar, i gemener. iPhone och Chromium säger `audio/mp4` eller
 * `audio/webm;codecs=opus`. Regeln känner den första formen.
 *
 * @param {unknown} v
 * @returns {string}
 */
export function normaliseraMime(v) {
  const raw = str(v).toLowerCase();
  const semikolon = raw.indexOf(";");
  const bas = semikolon === -1 ? raw : raw.slice(0, semikolon);
  // ⛔ SAMMA FORMAT, FLERA NAMN (CP 2026-10-18, WAV). Webbläsarna säger audio/x-wav, audio/wave eller audio/vnd.wave om en WAV,
  // och audio/x-aiff eller audio/x-flac om de andra. Regeln känner ett namn per format.
  return MIMEALIAS[bas] ?? bas;
}

/** @type {Record<string, string>} */
const MIMEALIAS = {
  "audio/x-wav": "audio/wav",
  "audio/wave": "audio/wav",
  "audio/vnd.wave": "audio/wav",
  "audio/x-aiff": "audio/aiff",
  "audio/x-flac": "audio/flac",
  // ⛔ (0.133.0) Ljudfiler som personen väljer: iOS och Android säger audio/x-m4a eller audio/m4a för en .m4a, audio/mp3 för en .mp3 och audio/x-aac för en .aac.
  "audio/x-m4a": "audio/mp4",
  "audio/m4a": "audio/mp4",
  "audio/mp3": "audio/mpeg",
  "audio/x-aac": "audio/aac",
  // ⛔ SAMMA FORMAT, FLERA NAMN, VIDEO (0.127.0). En .m4v är en mp4 med ett annat namn, och Safari rapporterar den som video/x-m4v.
  "video/x-m4v": "video/mp4",
};

/**
 * Taket för en fil med den här MIME:n: familjens tak ur `FILTAK` (ljud 250 MB, video 100 MB), annars `MAX_BIBLIOTEKFIL`.
 * @param {unknown} mime
 * @returns {number}
 */
export function filTak(mime) {
  const m = normaliseraMime(mime);
  return FILTAK.find((g) => m.startsWith(`${g.familj}/`))?.tak ?? MAX_BIBLIOTEKFIL;
}

/**
 * MIME ur filnamnet när webbläsaren inte säger någon (Safari ger ofta tom typ för AIFF och FLAC, och Windows för .mov). Bara
 * ljudformaten och videoformaten som annars faller bort. `.mp4` och `.m4v` ger `video/mp4`, `.mov` ger `video/quicktime`. Tom sträng
 * när ändelsen är okänd.
 * @param {unknown} namn
 * @returns {string}
 */
export function mimeUrFilnamn(namn) {
  const m = /\.([a-z0-9]+)$/i.exec(str(namn));
  const andelse = m ? m[1].toLowerCase() : "";
  // (0.133.0) m4a, mp3, aac och ogg: Safari och Android ger ofta tom typ för dem, och utan namnet blev en vald ljudfil "Formatet (tom) går inte att lägga in".
  return ({ wav: "audio/wav", wave: "audio/wav", aif: "audio/aiff", aiff: "audio/aiff", flac: "audio/flac", m4a: "audio/mp4", mp3: "audio/mpeg", aac: "audio/aac", ogg: "audio/ogg", oga: "audio/ogg", mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime" })[andelse] ?? "";
}

/**
 * Filväljarens `accept` för "Ladda upp ljudfil" (0.133.0): all ljud-MIME, plus ändelserna som iOS och Android annars gömmer filer för. Ett hem (regel 2): menyn och proven läser den här.
 */
export const LJUDFIL_ACCEPT = "audio/*,.m4a,.mp3,.wav,.aac,.ogg,.flac";

/**
 * Det som är fel med en vald ljudfil, eller `null`. Samma prövning som formuläret Ny fil (`filInmatningsfel`, med MIME ur namnet när webbläsaren inte säger någon), plus att filen ska vara
 * ett LJUD: en bild eller en PDF som valts i väljaren (ändelsen går att kringgå) laddas inte upp som en inspelning.
 *
 * @param {{ name?: unknown, type?: unknown, size?: unknown }} fil
 * @returns {string | null}
 */
export function ljudfilFel(fil) {
  const namn = str(fil?.name);
  const mime = str(fil?.type) || mimeUrFilnamn(namn);
  if (filSort(mime) !== "ljud") return "Det där är inte en ljudfil. Välj en ljudfil: m4a, mp3, wav, aac, ogg eller flac.";
  return filInmatningsfel({ namn, mime, byte: /** @type {number} */ (fil?.size) });
}

/**
 * Hur vyn visar filen. Härlett ur MIME, lagras inte.
 *
 * ⛔ VIDEO HAR EN EGEN SORT MEN INGEN EGEN FLIK (0.127.0). Sorten styr ikon, etikett och att detaljen spelar filen med en `<video>`.
 * Fliken Dokument visar den (`BIBLIOTEKFLIKAR` har samma sex som SessionStudio, och en sjunde för en sort ensam är en funktion förebilden inte har,
 * regel 13): se `filtreraBibliotek`.
 *
 * @param {unknown} mime
 * @returns {"bild" | "ljud" | "video" | "dokument"}
 */
export function filSort(mime) {
  const m = normaliseraMime(mime);
  if (m.startsWith("image/")) return "bild";
  if (m.startsWith("audio/")) return "ljud";
  if (m.startsWith("video/")) return "video";
  return "dokument";
}

/**
 * Hur länge en uppladdning får pågå innan posten räknas som ett avbrott (cllp/ops-framework, granskningen av PR 408).
 * En post skrivs med `fil.klar: false` och blir klar när filen är uppladdad. Stängs fliken mitt i blir den aldrig klar, och utan en
 * gräns stod den och hämtade för alltid, för alla medlemmar.
 *
 * ⛔ GRÄNSEN MÅSTE VARA LÄNGRE ÄN DEN LÅNGSAMMASTE UPPLADDNING SOM ÄR VERKLIG, INTE KORT NOG ATT KÄNNAS SNABB. Ett ljud får vara 250 MB
 * (`MAX_BIBLIOTEKLJUD`). 250 MB är 2000 Mbit, och på en telefons uppkoppling om 5 Mbit/s tar det 400 s, drygt 6 minuter. Vid 1 Mbit/s är det
 * drygt 33 minuter. Två minuter (första förslaget) hade stämplat en uppladdning som pågår som avbruten för alla andra medlemmar och
 * erbjudit Radera mitt i den. 60 minuter rymmer även ett så långsamt nät som 0,6 Mbit/s och löser ändå "Hämtar för alltid": ett avbrott
 * visar sig inom en timme i stället för aldrig.
 */
export const UPPLADDNING_MAX_MS = 60 * 60 * 1000;

/**
 * Har uppladdningen avbrutits? Sant för en filpost vars `fil.klar` är `false` och som skapades för mer än `UPPLADDNING_MAX_MS` sedan.
 * Räknat på postens `skapad`. En post utan ett heltal som skapad-tid går inte att döma och räknas som pågående: en gissning åt
 * fel håll hade stämplat en uppladdning som pågår som misslyckad.
 *
 * @param {{ typ?: unknown, skapad?: unknown, fil?: { klar?: unknown } } | null | undefined} post
 * @param {number} [nu] Klockan i ms. Förval nu.
 * @returns {boolean}
 */
export function uppladdningAvbruten(post, nu = Date.now()) {
  if (post?.typ !== "fil" || post.fil?.klar !== false) return false;
  if (!Number.isInteger(post.skapad)) return false;
  return nu - /** @type {number} */ (post.skapad) > UPPLADDNING_MAX_MS;
}

/**
 * När en pågående uppladdning (`fil.klar === false`, ännu inte avbruten) räknas som avbruten, i ms, eller `null` när posten inte väntar
 * på någon gräns. Används för att rita om vid rätt tillfälle utan att något i posten ändras.
 *
 * @param {{ typ?: unknown, skapad?: unknown, fil?: { klar?: unknown } } | null | undefined} post
 * @param {number} [nu]
 * @returns {number | null}
 */
export function uppladdningenAvbrytsKl(post, nu = Date.now()) {
  if (post?.typ !== "fil" || post.fil?.klar !== false) return null;
  if (!Number.isInteger(post.skapad)) return null;
  if (uppladdningAvbruten(post, nu)) return null;
  return /** @type {number} */ (post.skapad) + UPPLADDNING_MAX_MS + 1;
}

/**
 * Är posten ett ljud? Härlett ur typ och MIME, lagras inte.
 *
 * @param {{ typ?: unknown, fil?: { mime?: unknown } } | null | undefined} post
 * @returns {boolean}
 */
export function arLjudpost(post) {
  return post?.typ === "fil" && filSort(post.fil?.mime) === "ljud";
}

/**
 * Går posten att dela med en publik länk? (0.133.0, lifehub.app#356, CP 2026-10-18: "en publik länk till varje artefakt".) EN funktion för menyn och servern (regel 2): knappen ska inte lova
 * något som `createDelningService` sedan nekar.
 *
 * - **fil:** en färdig fil med sökväg (`klar: false` medan byte laddas upp, och utan fältet räknas filen som klar, som före 0.117.0).
 * - **anteckning:** har text. **länk:** har en adress som är http eller https (`ADRESSFORM`). **lista:** har fältet `poster` (en tom lista går att dela och visas som tom).
 *
 * Rättigheten att dela prövas på annat håll (`farAndra`); den här säger bara om det finns något att visa.
 *
 * @param {{ typ?: unknown, text?: unknown, url?: unknown, poster?: unknown, fil?: { sokvag?: unknown, klar?: unknown } | null } | null | undefined} post
 * @returns {boolean}
 */
export function arDelbar(post) {
  if (!post || typeof post !== "object") return false;
  switch (post.typ) {
    case "fil":
      return Boolean(post.fil) && typeof post.fil?.sokvag === "string" && post.fil.sokvag !== "" && post.fil.klar !== false;
    case "anteckning":
      return typeof post.text === "string" && trimSomRegeln(post.text) !== "";
    case "lank":
      return typeof post.url === "string" && ADRESSFORM.test(post.url);
    case "lista":
      return Array.isArray(post.poster);
    default:
      return false;
  }
}

/**
 * Det filväljaren kan ha fel på, innan sökvägen finns.
 *
 * @param {{ namn?: unknown, mime?: unknown, byte?: unknown }} fil
 * @returns {string | null}
 */
export function filInmatningsfel(fil) {
  const namn = str(fil?.namn);
  if (!namn) return "Filen saknar namn.";
  if (namn.length > MAX_BIBLIOTEKFILNAMN) return `Filnamnet är ${namn.length} tecken. Taket är ${MAX_BIBLIOTEKFILNAMN}.`;
  if (namn.includes("/") || namn.includes("\\") || namn === "." || namn === "..") return "Filnamnet innehåller ett snedstreck.";
  const mime = normaliseraMime(fil?.mime);
  if (!(/** @type {readonly string[]} */ (FILMIME).includes(mime))) {
    return `Formatet "${mime || "(tom)"}" går inte att lägga in. Giltiga: ${FILMIME.join(", ")}.`;
  }
  const byte = fil?.byte;
  if (!Number.isInteger(byte) || /** @type {number} */ (byte) < 1) return "Filen är tom.";
  const tak = filTak(mime);
  if (/** @type {number} */ (byte) > tak) {
    const familj = FILTAK.find((g) => g.tak === tak && mime.startsWith(`${g.familj}/`));
    return `Filen är ${byte} byte. Taket är ${tak}${familj ? ` för ${familj.ord}` : ""}.`;
  }
  return null;
}

/**
 * Hela filobjektet, inklusive sökvägen appen gav.
 *
 * @param {unknown} fil
 * @returns {string | null}
 */
export function filFel(fil) {
  if (!fil || typeof fil !== "object") return "Filen saknas.";
  const okanda = Object.keys(/** @type {object} */ (fil)).filter((k) => !(/** @type {readonly string[]} */ (FILFALT).includes(k)));
  if (okanda.length > 0) return `Filen har fälten ${okanda.join(", ")}, och de hör inte dit.`;
  const yta = filInmatningsfel(/** @type {any} */ (fil));
  if (yta) return yta;
  if ("klar" in /** @type {object} */ (fil) && typeof (/** @type {any} */ (fil).klar) !== "boolean") return "Filens klar-markering ska vara sant eller falskt.";
  const sokvag = str(/** @type {any} */ (fil).sokvag);
  if (!sokvag) return "Sökvägen saknas.";
  if (sokvag.length > MAX_BIBLIOTEKSOKVAG) return `Sökvägen är ${sokvag.length} tecken. Taket är ${MAX_BIBLIOTEKSOKVAG}.`;
  if (sokvag.startsWith("/") || sokvag.includes("\\") || sokvag.split("/").includes("..")) return "Sökvägen går inte att läsa.";
  return null;
}

/**
 * Utskriften på ett ljud, eller skälet till att den inte får sparas.
 *
 * @param {unknown} text
 * @param {{ mime?: unknown } | null | undefined} fil
 * @returns {string | null}
 */
export function utskriftFel(text, fil) {
  if (typeof text !== "string") return "Utskriften ska vara text.";
  if (text.length > MAX_BIBLIOTEKUTSKRIFT) return `Utskriften är ${text.length} tecken. Taket är ${MAX_BIBLIOTEKUTSKRIFT}.`;
  if (filSort(fil?.mime) !== "ljud") return "Bara ett ljud har en utskrift.";
  return null;
}

/**
 * Längd och våg hör bara till ett ljud, och bara i den form listan kan rita.
 *
 * @param {Record<string, unknown>} d
 * @returns {string | null}
 */
export function ljudMetaFel(d) {
  const harD = "durationMs" in d && d.durationMs != null;
  const harP = "peaks" in d && d.peaks != null;
  const ljud = d.typ === "fil" && filSort(/** @type {{ mime?: unknown }} */ (d.fil)?.mime) === "ljud";
  if (!ljud) {
    if (harD || harP) return "Bara ett ljud har längd och våg.";
    return null;
  }
  if (harD) {
    const ms = d.durationMs;
    if (!Number.isInteger(ms) || /** @type {number} */ (ms) < 1 || /** @type {number} */ (ms) > MAX_LJUD_MS) {
      return `durationMs ska vara ett heltal i millisekunder, från 1 till ${MAX_LJUD_MS}.`;
    }
  }
  if (harP && !peaksGiltiga(d.peaks)) {
    return `Vågen ska vara en sträng med ${LJUD_STOLPAR} tecken, ett per topp, ur A-Z, a-z, 0-9, - och _.`;
  }
  return null;
}

/**
 * Utskriftsjobbet på en post, eller skälet till att det inte får ligga där (0.133.0). Det hör bara till ett ljud, och det ska vara ett objekt.
 *
 * ⛔ FORMEN PRÖVAS INTE HÄR (`utskriftLage` gör det, och tolkar en trasig rad som ett fel som syns). Skälet är att en post vars jobbstatus servern skrev fel inte ska bli en
 * post som inte går att läsa alls: `postFel` fäller hela posten, och då hade ljudet, taggarna och menyn försvunnit tillsammans med ett statusfält. Servern skriver fältet, och
 * klienten får aldrig skriva det (reglerna), så formen är serverns att hålla.
 *
 * @param {Record<string, unknown>} d
 * @returns {string | null}
 */
export function utskriftJobbFel(d) {
  if (!("utskriftJobb" in d) || d.utskriftJobb == null) return null;
  if (d.typ !== "fil" || filSort(/** @type {{ mime?: unknown }} */ (d.fil)?.mime) !== "ljud") return "Bara ett ljud har ett utskriftsjobb.";
  if (typeof d.utskriftJobb !== "object" || Array.isArray(d.utskriftJobb)) return "utskriftJobb ska vara ett objekt.";
  return null;
}

/**
 * En tagg som den sparas: gemener, ändarnas mellanslag borta, mellanslag i rad till ett, och `#` i början borta (den som skriver
 * "#kvitto" menar taggen kvitto). Det som då inte är i `TAGGFORM` lämnas som det är, så att `taggarFel` säger vad som är fel.
 *
 * @param {unknown} v
 * @returns {string}
 */
export function normaliseraTagg(v) {
  // ⛔ NFC FÖRST (granskningen av PR 363): inklistrad text från macOS kan bära "å" som a plus en kombinerande ring, och den formen
  // står inte i TAGGFORM. Personen ser samma bokstav, så felet hade varit obegripligt.
  return str(v).normalize("NFC").replace(/^#+/, "").toLocaleLowerCase("sv").replace(/\s+/g, " ").trim();
}

/**
 * Taggarna som de sparas, i den ordning de skrevs och utan dubbletter. En tom tagg tas bort. Allt annat lämnas åt `taggarFel`.
 *
 * @param {unknown} v
 * @returns {string[]}
 */
export function normaliseraTaggar(v) {
  if (!Array.isArray(v)) return [];
  /** @type {string[]} */
  const ut = [];
  for (const t of v) {
    const n = normaliseraTagg(t);
    if (n && !ut.includes(n)) ut.push(n);
  }
  return ut;
}

/**
 * Skälet till att taggarna inte får sparas, eller `null`. Samma villkor som regeln: en lista, högst `MAX_TAGGAR`, var och en i
 * `TAGGFORM`, inga dubbletter.
 *
 * @param {unknown} v
 * @returns {string | null}
 */
export function taggarFel(v) {
  if (!Array.isArray(v)) return "Taggarna ska vara en lista.";
  if (v.length > MAX_TAGGAR) return `Posten har ${v.length} taggar. Taket är ${MAX_TAGGAR}.`;
  for (const t of v) {
    if (typeof t !== "string" || !TAGGFORM.test(t)) {
      return `Taggen "${typeof t === "string" ? t : String(t)}" går inte att spara. En tagg är högst ${MAX_TAGGLANGD} tecken, med bokstäver, siffror, mellanslag och bindestreck.`;
    }
  }
  if (new Set(v).size !== v.length) return "Samma tagg står två gånger.";
  return null;
}

/**
 * Gruppens taggar, räknade ur posterna, flest först och sedan i bokstavsordning. Ingen egen samling: listan är härledd ur
 * posterna (regel 2), och en tagg utan poster finns inte.
 *
 * @param {ReadonlyArray<{ taggar?: unknown }>} poster
 * @returns {Array<{ tagg: string, antal: number }>}
 */
export function allaTaggar(poster) {
  /** @type {Map<string, number>} */
  const antal = new Map();
  for (const p of poster) for (const t of Array.isArray(p.taggar) ? p.taggar : []) if (typeof t === "string") antal.set(t, (antal.get(t) ?? 0) + 1);
  return [...antal].map(([tagg, n]) => ({ tagg, antal: n })).sort((a, b) => b.antal - a.antal || a.tagg.localeCompare(b.tagg, "sv"));
}

/** Hur många taggfärger det finns: `--color-tagg-1` till `--color-tagg-8` i tokens. */
export const TAGGFARGER = 8;

/**
 * Taggens färg som ett tal 1 till `TAGGFARGER`, alltid samma för samma tagg.
 *
 * ⛔ SESSIONSTUDIOS HASH, TECKEN FÖR TECKEN (0.102.0, `tagColorFromHash` i `packages/shared/artifactTags.js`): `(h << 5) - h + c`
 * med 32-bitars heltal, och index `abs(h) % 8`. Samma tagg får alltså samma ton här som där, vilket är det CP jämför mot. Färgen
 * väljs inte och lagras inte: den härleds ur namnet (regel 2), och en egen färgväljare per tagg hade varit ett fält till på varje
 * post att hålla i takt.
 *
 * @param {string} tagg
 * @returns {number}
 */
export function taggfarg(tagg) {
  const ord = normaliseraTagg(tagg);
  let h = 0;
  for (const c of ord) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
  return (Math.abs(h) % TAGGFARGER) + 1;
}

/**
 * Får den här personen ändra eller radera posten? Samma villkor som regelns
 * `update` och, sedan #311, som regelns `delete`: författaren, eller ägare
 * eller admin i gruppen. Båda kräver ett aktivt medlemskap (`opsArMedlem`).
 *
 * `jag` är den inloggades medlemskap i postens grupp, eller `null` när det
 * saknas. Utan medlemskap blir svaret nej, och vyn visar posten i läsläge.
 * Saknas `status` räknas medlemskapet som aktivt: anroparen skickar redan bara
 * aktiva rader, och de proven som byggdes före statusfältet här står kvar.
 * En status som inte är `aktiv`, till exempel en avslutad admin, är ett nej,
 * samma som regeln.
 *
 * @param {{ groupId?: string, skapadAv?: { uid?: string | null } } | null | undefined} post
 * @param {{ uid?: string | null, roll?: string, groupId?: string, status?: string } | null | undefined} jag
 * @returns {boolean}
 */
export function farAndra(post, jag) {
  if (!post || !jag || typeof jag.uid !== "string" || !jag.uid) return false;
  // ⛔ I ETT EGET BIBLIOTEK GÄLLER BARA ÄGAREN (0.101.0). En roll i en grupp ger ingenting här: regeln jämför platsen med
  // den inloggades uid och inget annat, och en admin i någon grupp hade annars sett knappar regeln nekar.
  if (arMittBibliotek(post.groupId)) return post.groupId === `${MITT_PREFIX}${jag.uid}` && post.skapadAv?.uid === jag.uid;
  if (jag.status !== undefined && jag.status !== "aktiv") return false;
  // ⛔ PÅ EN HÄNDELSES ELLER ETT ÄRENDES PLATS GÄLLER GRUPPENS ROLLER (0.121.0, 0.122.0). `jag` är medlemskapet i gruppen, och platsen är gruppens plus ett objekt.
  if (jag.groupId !== undefined && jag.groupId !== gruppForPlats(String(post.groupId))) return false;
  if (post.skapadAv?.uid === jag.uid) return true;
  return /** @type {readonly string[]} */ (FORVALTARROLLER).includes(String(jag.roll ?? ""));
}

/**
 * Det formuläret kan ha fel på, utan grupp och utan författare.
 *
 * Vyn anropar den här. Källan anropar `postFel`, som lägger till resten.
 *
 * @param {Record<string, unknown>} d
 * @returns {string | null}
 */
export function inmatningsfel(d) {
  const typ = str(d.typ);
  if (!(/** @type {readonly string[]} */ (BIBLIOTEKTYPER).includes(typ))) {
    return `Biblioteket känner typen "${typ || "(tom)"}". Giltiga: ${BIBLIOTEKTYPER.join(", ")}.`;
  }
  const rubrik = str(d.rubrik);
  if (!rubrik) return "Rubriken saknas.";
  if (rubrik.length > MAX_BIBLIOTEKRUBRIK) return `Rubriken är ${rubrik.length} tecken. Taket är ${MAX_BIBLIOTEKRUBRIK}.`;
  if ("taggar" in d && d.taggar != null) {
    const tf = taggarFel(d.taggar);
    if (tf) return tf;
  }

  if (typ === "lista") {
    const f = fremmandeFalt(d, ["text", "url", "kalla", "bild", "fil", "utskrift", "utskriftJobb", "durationMs", "peaks"]);
    if (f) return `En lista har rubrik och poster, och fältet ${f} hör inte dit.`;
    return listaFel(d.poster);
  }

  if (typ === "anteckning") {
    const fa = fremmandeFalt(d, ["kalla", "bild", "poster"]);
    if (fa) return `En anteckning har text, och fältet ${fa} hör inte dit.`;
    if ("url" in d && d.url != null && str(d.url) !== "") return "En anteckning har text, och ingen adress.";
    if ("fil" in d && d.fil != null) return "En anteckning har text, och ingen fil.";
    if ("utskrift" in d && d.utskrift != null) return "En anteckning har text, och ingen utskrift.";
    if ("utskriftJobb" in d && d.utskriftJobb != null) return "En anteckning har text, och inget utskriftsjobb.";
    if (("durationMs" in d && d.durationMs != null) || ("peaks" in d && d.peaks != null)) return "En anteckning har text, och ingen längd.";
    const text = str(d.text);
    if (!text) return "Anteckningen saknar text.";
    if (text.length > MAX_BIBLIOTEKTEXT) return `Texten är ${text.length} tecken. Taket är ${MAX_BIBLIOTEKTEXT}.`;
    return null;
  }

  if (typ === "fil") {
    const ff = fremmandeFalt(d, ["kalla", "bild", "poster"]);
    if (ff) return `En fil har en fil, och fältet ${ff} hör inte dit.`;
    if ("text" in d && d.text != null && str(d.text) !== "") return "En fil har en fil, och ingen brödtext.";
    if ("url" in d && d.url != null && str(d.url) !== "") return "En fil har en fil, och ingen adress.";
    const filfel = filFel(d.fil);
    if (filfel) return filfel;
    const metaf = ljudMetaFel(d);
    if (metaf) return metaf;
    const jobbf = utskriftJobbFel(d);
    if (jobbf) return jobbf;
    if (!("utskrift" in d) || d.utskrift == null) return null;
    return utskriftFel(d.utskrift, /** @type {any} */ (d.fil));
  }

  if ("poster" in d && d.poster != null) return "En länk har en adress, och inga poster.";
  if ("text" in d && d.text != null && str(d.text) !== "") return "En länk har en adress, och ingen brödtext.";
  if ("fil" in d && d.fil != null) return "En länk har en adress, och ingen fil.";
  if ("utskrift" in d && d.utskrift != null) return "En länk har en adress, och ingen utskrift.";
  if ("utskriftJobb" in d && d.utskriftJobb != null) return "En länk har en adress, och inget utskriftsjobb.";
  if (("durationMs" in d && d.durationMs != null) || ("peaks" in d && d.peaks != null)) return "En länk har en adress, och ingen längd.";
  const url = str(d.url);
  if (!url) return "Länken saknar adress.";
  if (!/^https?:/.test(url)) return "Adressen ska börja med http eller https.";
  if (!ADRESSFORM.test(url)) return "Adressen går inte att läsa. Den ska börja med http:// eller https:// och sakna mellanslag.";
  if (url.length > MAX_BIBLIOTEKURL) return `Adressen är ${url.length} tecken. Taket är ${MAX_BIBLIOTEKURL}.`;
  // ⛔ KÄLLAN HÄRLEDS, DEN VÄLJS INTE (0.128.0, regel 2). En `kalla` som inte är den adressen ger är ett fel, så att en klient inte kan sätta Spotifys märke på en annan adress.
  if ("kalla" in d && d.kalla != null && d.kalla !== lankKalla(url)) {
    return `Källan "${String(d.kalla)}" stämmer inte med adressen, som är "${lankKalla(url)}". Källan härleds ur adressen och väljs inte.`;
  }
  if ("bild" in d && d.bild != null) {
    const bild = typeof d.bild === "string" ? d.bild : "";
    if (!BILDFORM.test(bild)) return "Omslaget ska vara en https-adress utan mellanslag.";
    if (bild.length > MAX_BIBLIOTEKURL) return `Omslagets adress är ${bild.length} tecken. Taket är ${MAX_BIBLIOTEKURL}.`;
  }
  return null;
}

/**
 * Det första av fälten som finns (inte `null`, inte `undefined`) i `d`, eller `null`. För fält som bara hör till en sort av post.
 *
 * @param {Record<string, unknown>} d
 * @param {readonly string[]} falt
 * @returns {string | null}
 */
function fremmandeFalt(d, falt) {
  return falt.find((f) => f in d && d[f] != null) ?? null;
}

/**
 * Skälet till att listan inte får sparas, eller `null`: en lista (inte en sträng), högst `MAX_LISTPOSTER`, varje id på `POSTIDFORM` och inga dubbletter.
 * En tom lista är giltig (`[]`), men ett fält som saknas är det inte: en lista utan `poster` har ingen form, och vyn ska inte gissa vad som menas.
 *
 * ⛔ DET HÄR SÄGER INGET OM ATT POSTERNA FINNS ELLER LIGGER PÅ SAMMA PLATS. Det går inte att pröva i en regel (högst tio uppslag per skrivning, och listan har 200 id:n)
 * och inte här (modellen ser en post i taget). "Bara från samma plats" gäller genom hur listan LÄSES: `losLista` slår bara upp id:n bland platsens egna poster, så ett
 * id från en annan plats blir en rad som säger "Finns inte längre" och aldrig innehåll från en annan plats.
 *
 * @param {unknown} poster
 * @returns {string | null}
 */
export function listaFel(poster) {
  if (!Array.isArray(poster)) return "Listan saknar poster. En tom lista har poster: [].";
  if (poster.length > MAX_LISTPOSTER) return `Listan har ${poster.length} poster. Taket är ${MAX_LISTPOSTER}.`;
  for (const id of poster) {
    if (typeof id !== "string" || !POSTIDFORM.test(id)) {
      return `"${typeof id === "string" ? id : String(id)}" är inte ett postid. Ett id har bokstäver, siffror, - och _, högst 128 tecken, utan snedstreck.`;
    }
  }
  if (new Set(poster).size !== poster.length) return "Samma post står två gånger i listan.";
  return null;
}

/**
 * Hela dokumentet, eller skälet till att det inte får skrivas.
 *
 * @param {Record<string, unknown>} d
 * @returns {string | null}
 */
export function postFel(d) {
  if (!d || typeof d !== "object") return "Posten saknas.";
  const okanda = Object.keys(d).filter((k) => k !== "id" && !(/** @type {readonly string[]} */ (BIBLIOTEKFALT).includes(k)));
  if (okanda.length > 0) return `Fälten ${okanda.join(", ")} hör inte till en bibliotekspost.`;

  const yta = inmatningsfel(d);
  if (yta) return yta;

  const groupId = str(d.groupId);
  if (!ID_FORM.test(groupId) && !MITTFORM.test(groupId) && !arObjektbibliotek(groupId)) return `Gruppen "${groupId}" är inte ett grupp-id.`;
  // ⛔ EN HÄNDELSES OCH ETT ÄRENDES BIBLIOTEK HAR BARA FILER (0.121.0, 0.122.0). En anteckning eller en länk på en händelse är händelsens beskrivning en gång till
  // (regel 2), och på ett ärende är den ärendets text och kommentarerna.
  const objektord = beskrivObjektbibliotek(groupId)?.ord;
  if (objektord && str(d.typ) !== "fil") return `${objektord[0].toUpperCase()}${objektord.slice(1)} har filer, och inga anteckningar, länkar eller listor.`;

  const skapadAv = byggSkapare(/** @type {any} */ (d.skapadAv && typeof d.skapadAv === "object" ? d.skapadAv : {}));
  if (!skapadAv.uid) return "Posten saknar vem som skrev den.";
  if (skapadAv.typ !== "manniska") return "En bibliotekspost skrivs av en medlem, och typen på skaparen är manniska.";
  const skaparnycklar = d.skapadAv && typeof d.skapadAv === "object" ? Object.keys(/** @type {object} */ (d.skapadAv)) : [];
  const extraSkapare = skaparnycklar.filter((k) => !(/** @type {readonly string[]} */ (SKAPARFALT).includes(k)));
  if (extraSkapare.length > 0) return `Skaparen har fälten ${extraSkapare.join(", ")}, och de hör inte dit.`;

  if (!Number.isInteger(d.skapad)) return "skapad ska vara ett heltal, millisekunder.";
  if (!Number.isInteger(d.andrad)) return "andrad ska vara ett heltal, millisekunder.";
  if (/** @type {number} */ (d.andrad) < /** @type {number} */ (d.skapad)) return "andrad ligger före skapad.";
  return null;
}

/**
 * Bygger raden som skrivs. Kastar med samma text som `postFel`.
 *
 * @param {Record<string, unknown>} d
 * @returns {Bibliotekspost}
 */
export function byggPost(d) {
  if (d && typeof d === "object" && str(d.typ) === "lank" && "url" in d) d = { ...d, url: normaliseraAdress(d.url) };
  if (d && typeof d === "object" && "taggar" in d && Array.isArray(d.taggar)) d = { ...d, taggar: normaliseraTaggar(d.taggar) };
  if (d && typeof d === "object" && str(d.typ) === "fil" && d.fil && typeof d.fil === "object") {
    d = { ...d, fil: { .../** @type {object} */ (d.fil), mime: normaliseraMime(/** @type {any} */ (d.fil).mime) } };
  }
  const fel = postFel(d);
  if (fel) throw new Error(fel);
  const typ = /** @type {Bibliotekspost["typ"]} */ (str(d.typ));
  const skapadAv = byggSkapare(/** @type {any} */ (d.skapadAv));
  /** @type {Bibliotekspost} */
  const post = {
    groupId: str(d.groupId),
    typ,
    rubrik: str(d.rubrik),
    skapadAv,
    skapad: /** @type {number} */ (d.skapad),
    andrad: /** @type {number} */ (d.andrad),
  };
  // ⛔ EN TOM LISTA SPARAS INTE: en post utan taggar saknar fältet, så "inga taggar" har en form och inte två.
  if (Array.isArray(d.taggar) && d.taggar.length > 0) post.taggar = /** @type {string[]} */ ([...d.taggar]);
  if (typ === "anteckning") post.text = str(d.text);
  else if (typ === "lista") {
    // ⛔ MOTSATSEN TILL TAGGARNA: en tom lista SPARAS som `poster: []`. En lista har alltid fältet, så "tom lista" och "lista utan form" inte är samma sak (regel 5).
    post.poster = [.../** @type {string[]} */ (d.poster)];
  } else if (typ === "lank") {
    post.url = str(d.url);
    // ⛔ KÄLLAN SKRIVS ALLTID, OCH ALLTID UR ADRESSEN. En länk från före 0.128.0 får den när den läses och sparas om.
    post.kalla = lankKalla(post.url);
    if ("bild" in d && d.bild != null) post.bild = str(d.bild);
  } else {
    const fil = /** @type {{ sokvag: unknown, namn: unknown, mime: unknown, byte: unknown, klar?: unknown }} */ (d.fil);
    post.fil = { sokvag: str(fil.sokvag), namn: str(fil.namn), mime: normaliseraMime(fil.mime), byte: /** @type {number} */ (fil.byte) };
    if (typeof fil.klar === "boolean") post.fil.klar = fil.klar;
    if ("utskrift" in d && d.utskrift != null) post.utskrift = /** @type {string} */ (d.utskrift);
    if ("utskriftJobb" in d && d.utskriftJobb != null) post.utskriftJobb = { .../** @type {Record<string, unknown>} */ (d.utskriftJobb) };
    if ("durationMs" in d && d.durationMs != null) post.durationMs = /** @type {number} */ (d.durationMs);
    if ("peaks" in d && d.peaks != null) post.peaks = /** @type {string} */ (d.peaks);
  }
  return post;
}

/**
 * Listan efter flik och sök. Sökningen läser det som redan hämtats: en andra
 * samling för sökord hade varit en kopia av rubriken.
 *
 * ⛔ LJUD ÄR INTE EN TYP (0.92.0). Fliken `ljud` filtrerar `typ === "fil"` med
 * ljud-MIME, `bild` bild-MIME, och `fil` resten (dokumenten, 0.102.0), så samma
 * post aldrig syns under två flikar.
 *
 * @template {Bibliotekspost & { id?: string }} T
 * @param {readonly T[]} poster
 * ⛔ TAGGARNA ÄR "OCH" (0.100.0): två valda taggar visar posterna som bär båda. Det är så filtret blir smalare för varje val, som
 * flikarna. Sökningen läser också taggarna, så den som skriver "kvitto" hittar en post taggad kvitto.
 *
 * @param {{ flik?: string, sok?: string, taggar?: readonly string[] }} [val]
 * @returns {T[]}
 */
export function filtreraBibliotek(poster, val = {}) {
  const flik = val.flik ?? "alla";
  if (!(/** @type {readonly string[]} */ (BIBLIOTEKFLIKAR).includes(flik))) {
    throw new Error(`filtreraBibliotek: okänd flik "${flik}". Giltiga: ${BIBLIOTEKFLIKAR.join(", ")}.`);
  }
  // ⛔ "#kvitto" SÖKER PÅ TAGGEN (granskningen av PR 363): raden visar taggen med #, och den som söker skriver det den ser.
  const sok = str(val.sok).toLowerCase().replace(/^#+/, "");
  const valda = Array.isArray(val.taggar) ? val.taggar : [];
  return [...poster]
    .filter((p) => valda.every((t) => Array.isArray(p.taggar) && p.taggar.includes(t)))
    .filter((p) => {
      if (flik === "alla") return true;
      if (flik === "ljud") return arLjudpost(p);
      if (flik === "bild") return p.typ === "fil" && filSort(p.fil?.mime) === "bild";
      // ⛔ Dokument-fliken är resten av filerna, video inbegripet (0.127.0): se `filSort`.
      if (flik === "fil") return p.typ === "fil" && ["dokument", "video"].includes(filSort(p.fil?.mime));
      return p.typ === flik;
    })
    .filter((p) => {
      if (!sok) return true;
      const hay = `${p.rubrik}\n${p.text ?? ""}\n${p.url ?? ""}\n${p.fil?.namn ?? ""}\n${(p.taggar ?? []).join("\n")}`.toLowerCase();
      return hay.includes(sok);
    })
    .sort((a, b) => b.andrad - a.andrad || a.rubrik.localeCompare(b.rubrik, "sv"));
}
