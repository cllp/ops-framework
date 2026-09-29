/**
 * Grupper och medlemskap: de fyra samlingar ramverket äger, och vad som avvisas.
 *
 * ══ ⛔ VARFÖR EN GRUPP OCH INTE EN LISTA MEDLEMMAR (#136) ══════════════
 *
 * Fas 2.5 i epiken #92, beslutat av CP 2026-09-27. Fas 1 gav appen
 * `members/{uid}`, alltså "vem får använda appen". Det svarar inte på "vems rad
 * är det här", och utan det svaret kan två verksamheter inte dela en app.
 *
 * ══ ⛔ EXAKT EN GRUPPNYCKEL PER RAD, OCH DET ÄR HELA POÄNGEN ═══════════
 *
 * Varje rad bär `groupId`, ett värde, aldrig en lista. Läsregeln blir ETT
 * uppslag: finns `memberships/{uid}|{groupId}` med status aktiv.
 *
 * Skälet är mätt någon annanstans och dyrt: SessionStudio bar `invitedGroupIds`
 * på raderna, alltså delning inbakad i datamodellen, och varje regel, varje
 * fråga och varje vy fick bära "eller någon av de här". Det går inte att ta
 * bort sedan, eftersom datan redan har formen. `check-gruppnyckel` vaktar den
 * här raden, och den vakten är billig i dag och omöjlig att eftermontera.
 *
 * ⛔ SAMMANSLAGNING ÄR INTE DELNING. Att se flera gruppers rader i samma vy
 * (#139) görs med en fråga per grupp och en hopslagning i ramverket. Ingen rad
 * ändras, ingen regel ändras, och en rad tillhör fortfarande en grupp.
 *
 * ══ ⛔ `memberships` SKRIVS ALDRIG AV KLIENTEN ═════════════════════════
 *
 * Den som kan skriva sitt eget medlemskap kan ge sig själv rollen ägare i vilken
 * grupp som helst vars id hen gissar. Därför skrivs samlingen bara av
 * serversidan, och regelfragmentet nedan säger det med `allow write: if false`.
 * Samma beslut som SessionStudio ADR-019, och det är det enda stället i
 * modellen där en klient inte får skriva sin egen rad.
 */

import { ID_FORM } from "./katalog.js";
import { byggSkapare } from "./skapare.js";
import { byggNamn } from "./sprak.js";
import { SPRAK } from "./sprak.js";

/**
 * Rollerna i en grupp. Tre, och fler kräver en ändring här och i reglerna.
 *
 * ⛔ TRE OCH INTE FYRA (0.32.0, #180, CP 2026-09-29 23:30: "Skapa grupp och bjuda in till
 * grupp finns inte ännu. Skapa grupp i web skall ha samma funktion som i SessionStudio").
 * Före 0.32.0 var de två, `agare` och `medlem`, med skälet att en roll finns för att STOPPA
 * något. `admin` stoppar något nytt: en admin får ändra gruppens utseende och uppgifter och
 * bjuda in, men aldrig arkivera gruppen, ändra dess moduler eller göra någon till ägare.
 * Det är SS `isGroupAdmin` (ägare eller admin) mot ägarens egna rättigheter, och gränsen
 * står i `regelfragment()` (`opsArAdmin` mot `opsArAgare`) och i `bjudIn`, inte här.
 *
 * ⛔ EN LÄSARE finns fortfarande inte: ingen yta skiljer på att få läsa och få skriva rader.
 */
export const ROLLER = /** @type {const} */ (["agare", "admin", "medlem"]);

/**
 * Vad en medlem ÄR. Samma delning som `SKAPARTYPER` men utan `okand`: ett
 * medlemskap skrivs alltid av serversidan, så det finns ingen väg in för en
 * post som inte vet vad den är.
 */
export const MEDLEMSTYPER = /** @type {const} */ (["person", "agent"]);

/**
 * Medlemskapets läge.
 *
 * ⛔ `avslutad` OCH INTE RADERING. En raderad rad tar med sig svaret på varför
 * någon inte längre har åtkomst, och den frågan kommer alltid efteråt. Samma
 * skäl som `arkiverad` på en grupp.
 */
export const MEDLEMSSTATUS = /** @type {const} */ (["aktiv", "avslutad"]);

/** Inbjudans läge. Flödet som flyttar den hör till #137, formen hör hit. */
export const INBJUDNINGSSTATUS = /** @type {const} */ (["vantar", "accepterad", "aterkallad"]);

/** Teman en person kan välja. `system` är förvalet och betyder "fråga enheten". */
export const TEMAN = /** @type {const} */ (["system", "ljust", "morkt"]);

/**
 * Standardikoner för en profilbild UTAN Storage (#164, korrigering C).
 *
 * ⛔ VARFÖR DEN HÄR LISTAN FINNS: CP 2026-09-28, mätt mot en skärmbild av
 * SessionStudios profilvy: "PROFILBILD-sektionen erbjuder 'Välj standardikon'
 * ... Det viktiga: standardikon plus färg kräver INGEN Storage, så
 * profilbilden fungerar i bolag-ops i dag." bolag-ops har ingen Storage-
 * konfiguration ännu (`OpsProfil props.lagring` är valfri av precis det
 * skälet), och en profilbild som KRÄVER uppladdning hade alltså varit
 * oanvändbar där tills den dagen. Ett ikon-id plus ett palett-id är två
 * strängar i `users/{uid}`, inga filer, ingen regel för lagring.
 *
 * ⛔ IKON-ID:N ÄR RAMVERKETS EGNA, INTE LUCIDE-KOMPONENTNAMN. `OpsProfil` slår
 * upp id:t mot `src/lib/profilikoner.js` för att rita SVG:n. Skulle raden bära
 * ett Lucide-namn direkt hade ett byte av ikonbibliotek förvandlat varje sparad
 * profil till ett fält ingen kod längre känner igen.
 */
export const PROFILIKONER = /** @type {const} */ (["person", "stjarna", "hjarta", "blixt", "leende", "krona"]);

/**
 * Palettens id:n för en profils bakgrundsfärg, samma sex toner som
 * `OpsIdentity` redan väljer AUTOMATISKT ur `seed` (#164, korrigering C).
 * Ett uttryckligt val åsidosätter det härledda: `identityTone(seed)` förblir
 * FÖRVALET så länge `farg` är tom sträng, ingen ny färgskala.
 */
export const PROFILFARGER = /** @type {const} */ (["1", "2", "3", "4", "5", "6"]);

/**
 * Standardikoner för en GRUPPS märke (0.32.0, #180), utan Storage, samma tanke som `PROFILIKONER`.
 *
 * ⛔ EGNA ID:N OCH EN EGEN LISTA, INTE `PROFILIKONER`. En profil är en person (person, leende), en
 * grupp är en verksamhet (grupp, portfölj, byggnad, hus, bok, jordglob), och att låta en grupp
 * bära "leende" hade sparat ett id vars mening är en annan. Ikonerna ritas ur
 * `src/lib/gruppikoner.js`, och en sparad grupp bär id:t, aldrig ett Lucide-namn.
 *
 * ⛔ SS-GRUPPERNAS IKONER ÄR MUSIKALISKA (`groupDefaults.js`: gitarr, mikrofon, piano ...). Det är
 * SessionStudios domän, inte ramverkets, och en ops-plattform för bolag ska inte bära den.
 * Formen är densamma: ett ikon-id, eller initialer.
 */
export const GRUPPIKONER = /** @type {const} */ (["grupp", "portfolj", "byggnad", "hus", "bok", "jordglob", "stjarna", "hjarta", "blixt", "krona"]);

/**
 * En grupps märke kan vara initialer i stället för en ikon: `initialer:AB` (1 till 3 tecken).
 * Formen är SS `GROUP_ICON_INITIALS_ID` plus `initialsOverride` i ETT fält, så en grupp har en
 * sanning om sitt märke och inte två fält som kan säga emot varandra.
 */
export const GRUPPINITIALER_FORM = /^initialer:([A-Za-zÅÄÖåäö0-9]{1,3})$/;

/** Tak för gruppens beskrivning och ort (SS `groupDesc`/`groupCityLabel`, här med tak som en rad i en regel kan hålla). */
export const MAX_GRUPPBESKRIVNING = 280;
export const MAX_GRUPPORT = 80;

/**
 * @typedef {object} Anvandare
 * @property {string} id Firebase Auth-uid.
 * @property {string} namn Ur inloggningen, sedan #156 redigerbar av personen själv.
 * @property {string} epost Identiteten. Ändras aldrig här.
 * @property {string} bild URL, eller tom sträng. Sedan #156 personens egen uppladdning.
 * @property {string} sprak Ur `SPRAK`.
 * @property {"system"|"ljust"|"morkt"} tema
 * @property {string} telefon E.164 (`+46701234567`), eller tom sträng. #156.
 * @property {string} stad Fritext, eller tom sträng. #156.
 * @property {string} presentation Kort text om personen, max `MAX_PRESENTATION` tecken. #156.
 * @property {ReadonlyArray<LankRad>} lankar Länkar till andra sidor. #156.
 * @property {string} bildSokvag Lagringssökvägen till `bild`, eller tom sträng. Behövs
 *   för att kunna TA BORT filen: en URL ensam räcker inte för att peka ut en
 *   sökväg i en fillagring (Storage-URL:er är inte reversibla till sin sökväg
 *   utan att fråga lagringen, och det kravet hade gjort borttagning till ett
 *   nätverksanrop till, med ett eget felfall). #156.
 * @property {string} ikon Ett id ur `PROFILIKONER`, eller tom sträng. Ritas bara när
 *   `bild` saknas. #164, kräver ingen Storage.
 * @property {string} farg Ett id ur `PROFILFARGER`, eller tom sträng (då väljer
 *   `OpsIdentity` tonen ur `seed`, precis som innan detta fält fanns). #164.
 */

/**
 * @typedef {object} LankRad En rad i `Anvandare.lankar`.
 * @property {string} plattform Ett värde ur den lista APPEN skickar in. Ramverket
 *   vet inte vad en "plattform" är, bara att raden pekar på en.
 * @property {string} url Måste vara https. En http-länk går att byta ut på vägen
 *   till den som saknar säker uppkoppling, och en `javascript:`-länk är kod.
 */

/** Tak för presentationen. En biografi som aldrig tar slut är ingen kort presentation. */
export const MAX_PRESENTATION = 500;

/**
 * @typedef {object} Grupp
 * @property {string} id
 * @property {import("./sprak.js").Namn} namn
 * @property {ReadonlyArray<string>} moduler Modul-id, samma form som `defineModule`.
 * @property {boolean} arkiverad
 * @property {import("./skapare.js").Skapare} skapadAv
 * @property {string} farg Ett id ur `PROFILFARGER`, eller tom sträng (då väljer märket tonen ur `id`). 0.32.0.
 * @property {string} ikon Ett id ur `GRUPPIKONER`, `initialer:<1-3 tecken>`, eller tom sträng (initialer ur namnet). 0.32.0.
 * @property {string} bild Lagringssökvägen till gruppens bild, eller tom sträng. Sökvägen och inte en URL, av samma skäl som `Anvandare.bildSokvag`. 0.32.0.
 * @property {string} beskrivning Högst `MAX_GRUPPBESKRIVNING` tecken, eller tom sträng. 0.32.0.
 * @property {string} ort Högst `MAX_GRUPPORT` tecken, eller tom sträng. 0.32.0.
 * @property {"sv"|"en"} epostsprak Språket gruppens utskick skrivs på (inbjudningar). Förval `sv`. 0.32.0.
 */

/**
 * @typedef {object} Medlemskap
 * @property {string} id `${userId}|${groupId}`, alltså userId, MEDLEMSKAPSAVGRANSARE, groupId. Härledd, aldrig skriven för hand.
 * @property {string} userId
 * @property {string} groupId
 * @property {"agare"|"admin"|"medlem"} roll
 * @property {"person"|"agent"} typ
 * @property {"aktiv"|"avslutad"} status
 * @property {string} namn Denormaliserat ur `users`, se noten vid MEDLEMSKAPSFALT.
 * @property {string} bild Denormaliserat ur `users`, eller tom sträng.
 */

/**
 * @typedef {object} Inbjudan
 * @property {string} id
 * @property {string} epost Gemener. Se noten i `byggInbjudan`.
 * @property {string} groupId
 * @property {"agare"|"admin"|"medlem"} roll
 * @property {"vantar"|"accepterad"|"aterkallad"} status
 * @property {import("./skapare.js").Skapare} skapadAv
 * @property {string} tokenHash SHA-256 (hex) av inbjudans engångskod, eller tom sträng när ingen kod skapats än. Koden själv lagras aldrig. 0.32.0.
 * @property {string} giltigTill ISO 8601. Förval 30 dagar efter att raden byggdes. 0.32.0.
 * @property {string} skickad ISO 8601 för senaste utskicket, eller tom sträng (aldrig skickad). 0.32.0.
 * @property {number} antalSkickade Hur många gånger inbjudan skickats, 0 eller fler. 0.32.0.
 */

/** Hur länge en inbjudan gäller (0.32.0, #180). Ett tal på ETT ställe: raden bär ett slutdatum, inte ett antal dagar. */
export const INBJUDNING_GILTIGHET_DAGAR = 30;

/** @param {unknown} v @returns {string} */
const rensa = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * Fälten varje samling får bära. Allt annat avvisas.
 *
 * ⛔ LISTORNA ÄR OCKSÅ VAKTENS UNDERLAG. `check-gruppnyckel` läser dem och
 * fäller varje fältnamn som pekar på FLER än en grupp. Står ett fält inte i en
 * sådan lista är det heller inte vaktat, så en ny samling utan sin lista är ett
 * hål och inte en förenkling.
 */
export const ANVANDARFALT = ["id", "namn", "epost", "bild", "sprak", "tema", "telefon", "stad", "presentation", "lankar", "bildSokvag", "ikon", "farg"];

/*
 * ⛔ TVÅ LISTOR FÖR VAD EN KLIENT FÅR ÄNDRA PÅ EN GRUPP, OCH `GRUPPFALT` HÄRLEDS UR DEM (0.32.0, #180).
 * Reglerna (`regelfragment()`) läser samma två, så modellen och `hasOnly` inte kan glida isär, samma
 * beslut som `ANVANDARFALT` (#156). `ADMINGRUPPFALT` är det en admin får ändra: utseende och
 * uppgifter. `AGARGRUPPFALT` är det ägaren får ändra: det ovan plus `moduler` och `arkiverad`.
 * `id` och `skapadAv` står i ingen av dem: vem som skapade gruppen och vad den heter i databasen
 * ändras aldrig.
 */
export const ADMINGRUPPFALT = ["namn", "farg", "ikon", "bild", "beskrivning", "ort", "epostsprak"];
export const AGARGRUPPFALT = [...ADMINGRUPPFALT, "moduler", "arkiverad"];
export const GRUPPFALT = ["id", ...AGARGRUPPFALT, "skapadAv"];
/*
 * ⛔ `namn` OCH `bild` LIGGER HÄR DENORMALISERAT, OCH DET ÄR ETT BESLUT MED ETT
 * SKÄL (#138, architect 2026-09-27).
 *
 * Klarkriteriet löd "ingen läser en annans e-post utan att vara medlem i en
 * gemensam grupp". Det går inte att skriva som Firestore-regel: villkoret
 * kräver en iteration över mina medlemskap, och en läsregel på `users/{uid}`
 * får ingen grupp-parameter att bygga uppslaget av. Det enda som gick utan
 * iteration var "alla inloggade läser alla profiler", och då bär `users`
 * e-postadresser åt vem som helst som är inloggad någonstans.
 *
 * ⛔ DÄRFÖR LÄMNAR E-POSTEN ALDRIG `users`. Medlemslistan visar namn och bild
 * ur `memberships`, som ändå bara skrivs av serversidan. Kriteriets ANDA är
 * uppfylld av konstruktion i stället för av en regel som inte finns.
 *
 * ⛔ ATT DE KAN BLI INAKTUELLA ÄR REDAN MODELLENS BETEENDE. `sakerstallAnvandare`
 * rör inte namnet efter första inloggningen, så ett namn som släpar efter
 * Google är ingen ny avvikelse. Priset är litet och synligt, till skillnad mot
 * ett nätverksanrop per vy (väg B) eller en läsbar e-post (väg C).
 */
export const MEDLEMSKAPSFALT = ["id", "userId", "groupId", "roll", "typ", "status", "namn", "bild"];
export const INBJUDNINGSFALT = ["id", "epost", "groupId", "roll", "status", "skapadAv", "tokenHash", "giltigTill", "skickad", "antalSkickade"];

/**
 * @param {string} samling
 * @param {Record<string, any>} d
 * @param {readonly string[]} tillatna
 * @param {string} id
 */
function avvisaOkanda(samling, d, tillatna, id) {
  const okanda = Object.keys(d).filter((n) => !tillatna.includes(n));
  if (okanda.length > 0) {
    throw new Error(
      `${samling}: fälten ${okanda.join(", ")} för "${id}" känns inte igen. En rad bär ${tillatna.join(", ")}. Ett fält som slängs tyst blir en rad som ser hel ut och saknar sin halva.`,
    );
  }
}

/** @param {unknown} v @returns {Record<string, any>} */
function somObjekt(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? /** @type {Record<string, any>} */ (v) : {};
}

/**
 * Bygger en användarrad, eller kastar med skälet.
 *
 * ⛔ E-POSTEN NORMALISERAS TILL GEMENER, och det är inte kosmetik. Inbjudan i
 * #137 matchar på e-post, och `CP@Staiger.se` och `cp@staiger.se` är samma
 * brevlåda men två strängar. Matchas de inte blir följden en person som loggar
 * in och inte får sin inbjudan, alltså en tom app utan förklaring.
 *
 * ⛔ #156: FEM FÄLT TILL, OCH ALLA FEM FÖLJER SAMMA REGEL SOM RESTEN AV RADEN:
 * TOMMA STRÄNGAR, ALDRIG UTELÄMNADE FÄLT (arbetsreglernas punkt 5). En profil
 * utan telefon har `telefon: ""`, inte ett fält som saknas, av samma skäl som
 * `bild` redan är tom sträng och inte `undefined`: annars går "har ingen
 * telefon" inte att skilja från "raden skrevs av en äldre version".
 *
 * @param {Record<string, any>} d
 * @param {ReadonlyArray<{ id: string }> | ReadonlyArray<string>} [tillatnaPlattformar]
 *   Länkarnas plattformar, eller deras id. Samma tvådelade mönster som
 *   `byggGrupp(d, kandaModuler)`: SKRIVVÄGEN skickar alltid in listan, så ett
 *   påhittat plattforms-id avvisas i stället för att sparas som en rad ingen
 *   väljare känner igen. LÄSVÄGEN utelämnar den, så en plattform som tagits
 *   bort ur appens lista sedan raden skrevs inte gör hela profilen oläsbar.
 * @returns {Anvandare}
 */
export function byggAnvandare(d, tillatnaPlattformar) {
  const rad = somObjekt(d);
  const id = rensa(rad.id);
  if (!id) throw new Error("users: id krävs. Det är Firebase Auth-uid och nyckeln varje medlemskap pekar på.");
  avvisaOkanda("users", rad, ANVANDARFALT, id);

  const epost = rensa(rad.epost).toLowerCase();
  if (!epost) throw new Error(`users: epost krävs för "${id}". Den är identiteten, och det är den en inbjudan matchar mot.`);

  const sprak = rensa(rad.sprak) || "sv";
  if (!(/** @type {readonly string[]} */ (SPRAK).includes(sprak))) {
    throw new Error(`users: språket "${sprak}" för "${id}" finns inte. Giltiga: ${SPRAK.join(", ")}.`);
  }

  const tema = rensa(rad.tema) || "system";
  if (!(/** @type {readonly string[]} */ (TEMAN).includes(tema))) {
    throw new Error(`users: temat "${tema}" för "${id}" finns inte. Giltiga: ${TEMAN.join(", ")}.`);
  }

  const telefon = rensa(rad.telefon);
  if (telefon && !E164_FORM.test(telefon)) {
    throw new Error(
      `users: telefon "${telefon}" för "${id}" är inte E.164 (till exempel "+46701234567"). Ett nummer i lokalt format går inte att ringa eller skicka SMS till från ett annat land, och det är precis den gissning ett fritt textfält tvingar fram.`,
    );
  }

  const presentation = rensa(rad.presentation);
  if (presentation.length > MAX_PRESENTATION) {
    throw new Error(`users: presentationen för "${id}" är ${presentation.length} tecken. Taket är ${MAX_PRESENTATION}.`);
  }

  const lankar = byggLankar(rad.lankar, id, tillatnaPlattformar);

  const ikon = rensa(rad.ikon);
  if (ikon && !(/** @type {readonly string[]} */ (PROFILIKONER).includes(ikon))) {
    throw new Error(`users: ikonen "${ikon}" för "${id}" finns inte. Giltiga: ${PROFILIKONER.join(", ")}, eller tom sträng.`);
  }

  const farg = rensa(rad.farg);
  if (farg && !(/** @type {readonly string[]} */ (PROFILFARGER).includes(farg))) {
    throw new Error(`users: färgen "${farg}" för "${id}" finns inte. Giltiga: ${PROFILFARGER.join(", ")}, eller tom sträng.`);
  }

  return Object.freeze({
    id,
    namn: rensa(rad.namn),
    epost,
    bild: rensa(rad.bild),
    sprak,
    tema: /** @type {Anvandare["tema"]} */ (tema),
    telefon,
    stad: rensa(rad.stad),
    presentation,
    lankar,
    bildSokvag: rensa(rad.bildSokvag),
    ikon,
    farg,
  });
}

/**
 * Ett telefonnummer i E.164: `+`, ett inledande 1-9, sedan upp till 14 siffror
 * till, aldrig fler än 15 siffror totalt. Se `byggAnvandare`.
 */
const E164_FORM = /^\+[1-9]\d{1,14}$/;

/**
 * Validerar och bygger `lankar`. Egen funktion, inte inline i `byggAnvandare`,
 * av samma skäl som `avvisaOkanda`: en lista är lättare att pröva för sig och
 * lättare att läsa i felmeddelandet.
 *
 * @param {unknown} varde
 * @param {string} id Användarens id, bara för felmeddelandet.
 * @param {ReadonlyArray<{ id: string }> | ReadonlyArray<string>} [tillatnaPlattformar]
 * @returns {ReadonlyArray<{ plattform: string, url: string }>}
 */
function byggLankar(varde, id, tillatnaPlattformar) {
  if (varde === undefined) return Object.freeze([]);
  if (!Array.isArray(varde)) {
    throw new Error(`users: lankar för "${id}" måste vara en lista, inte ${typeof varde}.`);
  }

  const tillatna =
    tillatnaPlattformar === undefined
      ? null
      : tillatnaPlattformar.map((p) => (typeof p === "string" ? p : p?.id)).filter((x) => typeof x === "string");
  /*
   * ⛔ GOLV, SAMMA SKÄL SOM `kandaModuler` I `byggGrupp`. En tom lista tillåtna
   * plattformar skulle annars fälla varenda länk, och en app som glömt skicka
   * in sin lista ser då likadan ut som en app som medvetet inte tillåter några
   * länkar alls. Den frågan ska ställas uttryckligen med `[]`.
   */
  if (tillatna && tillatna.length === 0) {
    throw new Error(`users: tillatnaPlattformar för "${id}" är en tom lista. Utelämna argumentet helt om profilen inte ska kunna bära länkar, annars fälls varje länk.`);
  }

  /** @type {{ plattform: string, url: string }[]} */
  const lankar = [];
  varde.forEach((/** @type {any} */ rad, /** @type {number} */ i) => {
    const r = somObjekt(rad);
    const plattform = rensa(r.plattform);
    if (!plattform) throw new Error(`users: lankar[${i}] för "${id}" saknar plattform.`);
    if (tillatna && !tillatna.includes(plattform)) {
      throw new Error(`users: lankar[${i}] för "${id}" pekar på plattformen "${plattform}" som inte finns i appens lista. Kända: ${tillatna.length > 0 ? tillatna.join(", ") : "inga"}.`);
    }
    const url = rensa(r.url);
    if (!url) throw new Error(`users: lankar[${i}] för "${id}" (${plattform}) saknar url.`);
    if (!/^https:\/\//.test(url)) {
      throw new Error(`users: lankar[${i}] för "${id}" (${plattform}) har url:en "${url}", som inte börjar med "https://". En http-länk kan bytas ut på vägen, och en javascript:-länk är kod.`);
    }
    const okanda = Object.keys(r).filter((n) => n !== "plattform" && n !== "url");
    if (okanda.length > 0) {
      throw new Error(`users: lankar[${i}] för "${id}" bär fälten ${okanda.join(", ")}. En rad är bara plattform och url.`);
    }
    lankar.push({ plattform, url });
  });
  return Object.freeze(lankar);
}

/**
 * Bygger en grupp, eller kastar med skälet.
 *
 * ⛔ `moduler` ÄR MODUL-ID OCH INTE NAMN, samma form som `defineModule`. Det är
 * den listan som avgör vilka ytor gruppen ser, alltså måste den gå att jämföra
 * med ett manifest utan att någon gissar hur ett namn blev ett id.
 *
 * ⛔ `kandaModuler` ÄR VALFRI, OCH DET ÄR INTE EN HALVMESYR UTAN TVÅ OLIKA
 * FRÅGOR. Den som SKRIVER en grupp måste avvisa ett modul-id som inte finns,
 * annars sparas ett skrivfel som en flik ingen hittar. Den som LÄSER en gammal
 * rad måste tåla att en modul avinstallerats sedan raden skrevs, för annars
 * ligger appen nere för den gruppen utan väg till en som fungerar. Läsvägens
 * svar är `navForLage`, som skriver ut `saknade`.
 *
 * ⛔ SKRIVVÄGEN SKICKAR ALLTID IN LISTAN. Står det `byggGrupp(rad)` i något som
 * sparar är det ett hål, och det är hela skälet att argumentet finns.
 *
 * @param {Record<string, any>} d
 * @param {ReadonlyArray<{ id: string }> | ReadonlyArray<string>} [kandaModuler] Installerade moduler, eller deras id.
 * @returns {Grupp}
 */
export function byggGrupp(d, kandaModuler) {
  const rad = somObjekt(d);
  const id = rensa(rad.id);
  if (!id) throw new Error("groups: id krävs. Det är nyckeln varje rad i varje samling pekar på.");
  if (!ID_FORM.test(id)) {
    throw new Error(
      `groups: id "${id}" får bara innehålla små bokstäver, siffror, bindestreck och understreck. Ett id med punkt blir en sökväg i en Firestore-regel, och gruppnyckeln står i varje regel.`,
    );
  }
  avvisaOkanda("groups", rad, GRUPPFALT, id);

  if (typeof rad.namn === "string") {
    throw new Error(`groups: namn för "${id}" är en sträng. Ett namn är { sv, en }. Gruppnamnet visas i gruppväljaren, alltså på varje sida.`);
  }
  let namn;
  try {
    namn = byggNamn(somObjekt(rad.namn));
  } catch (fel) {
    throw new Error(`groups: namn för "${id}" ${fel instanceof Error ? fel.message.replace(/^byggNamn: /, "") : String(fel)}`);
  }

  if (!Array.isArray(rad.moduler)) {
    throw new Error(`groups: moduler för "${id}" krävs och måste vara en lista, även när den är tom. En grupp utan moduler och en grupp som glömt listan ser likadana ut om fältet är valfritt.`);
  }
  /** @type {string[]} */
  const moduler = [];
  rad.moduler.forEach((/** @type {any} */ m, /** @type {number} */ i) => {
    const modulId = rensa(m);
    if (!modulId || !ID_FORM.test(modulId)) {
      throw new Error(`groups: moduler[${i}] för "${id}" måste vara ett modul-id i samma form som i defineModule, inte ${JSON.stringify(m)}.`);
    }
    if (moduler.includes(modulId)) {
      throw new Error(`groups: moduler[${i}] "${modulId}" för "${id}" står två gånger.`);
    }
    moduler.push(modulId);
  });

  if (kandaModuler !== undefined) {
    if (!Array.isArray(kandaModuler)) {
      throw new Error(`groups: kandaModuler måste vara en lista moduler eller modul-id, inte ${typeof kandaModuler}. Utelämna den helt på läsvägen.`);
    }
    const kanda = kandaModuler.map((m) => (typeof m === "string" ? m : m?.id)).filter((x) => typeof x === "string");
    /*
     * ⛔ GOLV. En tom lista kända moduler skulle annars fälla ALLT, alltså
     * göra vakten till en vägg, och en app som glömt skicka in sina moduler
     * ser likadan ut som en app som inte har några. Den frågan ska ställas
     * uttryckligen: skicka `[]` bara om gruppen verkligen inte får ha moduler.
     */
    const okanda = moduler.filter((m) => !kanda.includes(m));
    if (okanda.length > 0) {
      throw new Error(
        `groups: gruppen "${id}" pekar på modulerna ${okanda.join(", ")} som inte är registrerade. Kända: ${kanda.length > 0 ? kanda.join(", ") : "inga"}. Ett påhittat modul-id sparas annars som en flik ingen hittar.`,
      );
    }
  }

  const farg = rensa(rad.farg);
  if (farg && !(/** @type {readonly string[]} */ (PROFILFARGER).includes(farg))) {
    throw new Error(`groups: färgen "${farg}" för "${id}" finns inte. Giltiga: ${PROFILFARGER.join(", ")}, eller tom sträng.`);
  }

  const ikon = rensa(rad.ikon);
  if (ikon && !(/** @type {readonly string[]} */ (GRUPPIKONER).includes(ikon)) && !GRUPPINITIALER_FORM.test(ikon)) {
    throw new Error(
      `groups: ikonen "${ikon}" för "${id}" finns inte. Giltiga: ${GRUPPIKONER.join(", ")}, initialer:<1-3 tecken>, eller tom sträng.`,
    );
  }

  const beskrivning = rensa(rad.beskrivning);
  if (beskrivning.length > MAX_GRUPPBESKRIVNING) {
    throw new Error(`groups: beskrivningen för "${id}" är ${beskrivning.length} tecken. Taket är ${MAX_GRUPPBESKRIVNING}.`);
  }
  const ort = rensa(rad.ort);
  if (ort.length > MAX_GRUPPORT) {
    throw new Error(`groups: orten för "${id}" är ${ort.length} tecken. Taket är ${MAX_GRUPPORT}.`);
  }

  const epostsprak = rensa(rad.epostsprak) || "sv";
  if (!(/** @type {readonly string[]} */ (SPRAK).includes(epostsprak))) {
    throw new Error(`groups: e-postspråket "${epostsprak}" för "${id}" finns inte. Giltiga: ${SPRAK.join(", ")}.`);
  }

  /*
   * ⛔ TOMMA STRÄNGAR OCH INTE UTELÄMNADE FÄLT (arbetsreglernas punkt 5), och en rad skriven före
   * 0.32.0 läses med dem: ingen migrering, ingen vy som måste veta om raden är gammal.
   */
  return Object.freeze({
    id,
    namn,
    moduler: Object.freeze(moduler),
    arkiverad: rad.arkiverad === true,
    skapadAv: byggSkapare(somObjekt(rad.skapadAv)),
    farg,
    ikon,
    bild: rensa(rad.bild),
    beskrivning,
    ort,
    epostsprak: /** @type {Grupp["epostsprak"]} */ (epostsprak),
  });
}

/**
 * Tecknet som skiljer `userId` från `groupId` i ett medlemskaps nyckel.
 *
 * ══ ⛔ VARFÖR DET INTE ÄR ETT UNDERSTRECK (#152) ══════════════════════
 *
 * Det VAR ett understreck, och `ID_FORM` tillåter understreck i ett id. Alltså
 * var avgränsaren ett lagligt tecken i båda halvorna, och nyckeln var tvetydig:
 *
 *   medlemskapsId("a_b", "c")  ->  "a_b_c"
 *   medlemskapsId("a", "b_c")  ->  "a_b_c"
 *
 * Två olika medlemskap pekade på SAMMA dokument, och vilken roll som gällde
 * avgjordes av vem som skrev sist. Regeln slår upp exakt den nyckeln.
 *
 * ⛔ FELET VAR AV DEN TYSTA SORTEN. Ingenting kraschar. En person får fel roll
 * i en grupp, eller ser en grupp hen inte är med i, och det syns inte i en logg.
 *
 * ⛔ OCH DET ÄNDRAS NU FÖR ATT MIGRERINGEN ÄR TOM. Noll skarpa medlemskap
 * finns. Om en månad hade varje nyckel i databasen behövt skrivas om, plus
 * reglerna, i samma andetag. Det här är det billigaste tillfället som någonsin
 * kommer att finnas.
 *
 * `|` går inte att skriva i ett id: `ID_FORM` släpper bara små bokstäver,
 * siffror, bindestreck och understreck. Det är också giltigt i ett
 * Firestore-dokument-id, till skillnad från snedstreck.
 */
export const MEDLEMSKAPSAVGRANSARE = "|";

/**
 * Nyckeln till ett medlemskap.
 *
 * ⛔ HÄRLEDD OCH ALDRIG SKRIVEN FÖR HAND. Vore id fritt kunde samma person och
 * grupp få två rader med olika roll, och vilken som gäller avgörs då av vilken
 * regeln råkar slå upp. Med ett härlett id är unikheten en egenskap hos nyckeln
 * i stället för en kontroll någon måste komma ihåg, alltså arbetsreglernas
 * punkt 2 om riktiga constraints.
 *
 * @param {string} userId
 * @param {string} groupId
 * @returns {string}
 */
export function medlemskapsId(userId, groupId) {
  const u = rensa(userId);
  const g = rensa(groupId);
  if (!u || !g) throw new Error("medlemskapsId: både userId och groupId krävs.");
  /*
   * ⛔ OCH KONTROLLEN KVARSTÅR FASTÄN AVGRÄNSAREN INTE GÅR ATT SKRIVA I ETT
   * GRUPP-ID. `ID_FORM` släpper inte igenom den, men `userId` är ett
   * Firebase-uid och alltså någon annans format: med en custom token är det
   * fritt. Att lita på att en annan leverantörs format aldrig råkar innehålla
   * ett tecken är ett antagande, i en kodrad som avgör behörighet.
   *
   * Med kontrollen är unikheten en egenskap hos koden i stället för en
   * egenskap hos något vi inte styr över.
   */
  for (const [namn, varde] of [["userId", u], ["groupId", g]]) {
    if (varde.includes(MEDLEMSKAPSAVGRANSARE)) {
      throw new Error(
        `medlemskapsId: ${namn} "${varde}" innehåller avgränsaren "${MEDLEMSKAPSAVGRANSARE}". Nyckeln är userId, avgränsaren, groupId, så ett tecken i någon halva gör nyckeln tvetydig och två medlemskap kan kollapsa till ett dokument.`,
      );
    }
  }
  return `${u}${MEDLEMSKAPSAVGRANSARE}${g}`;
}

/**
 * Bygger ett medlemskap, eller kastar med skälet.
 *
 * @param {Record<string, any>} d
 * @returns {Medlemskap}
 */
export function byggMedlemskap(d) {
  const rad = somObjekt(d);
  const userId = rensa(rad.userId);
  const groupId = rensa(rad.groupId);
  if (!userId) throw new Error("memberships: userId krävs.");
  if (!groupId) throw new Error("memberships: groupId krävs. Det är den enda gruppnyckeln, och regeln slår upp exakt den.");
  const id = medlemskapsId(userId, groupId);
  avvisaOkanda("memberships", rad, MEDLEMSKAPSFALT, id);

  /*
   * ⛔ ETT INSKICKAT `id` SOM INTE STÄMMER AVVISAS, det rättas inte. Ett id som
   * tyst skrivs om döljer att anroparen trodde något annat om raden, och nästa
   * gång är det inte id:t som är fel utan gruppen.
   */
  const inskickat = rensa(rad.id);
  if (inskickat && inskickat !== id) {
    throw new Error(`memberships: id "${inskickat}" stämmer inte med userId och groupId, som ger "${id}". Nyckeln härleds, den skrivs inte.`);
  }

  const roll = rensa(rad.roll);
  if (!(/** @type {readonly string[]} */ (ROLLER).includes(roll))) {
    throw new Error(`memberships: rollen "${roll}" för "${id}" finns inte. Giltiga: ${ROLLER.join(", ")}.`);
  }
  const typ = rensa(rad.typ);
  if (!(/** @type {readonly string[]} */ (MEDLEMSTYPER).includes(typ))) {
    throw new Error(`memberships: typen "${typ}" för "${id}" finns inte. Giltiga: ${MEDLEMSTYPER.join(", ")}.`);
  }
  const status = rensa(rad.status) || "aktiv";
  if (!(/** @type {readonly string[]} */ (MEDLEMSSTATUS).includes(status))) {
    throw new Error(`memberships: statusen "${status}" för "${id}" finns inte. Giltiga: ${MEDLEMSSTATUS.join(", ")}.`);
  }

  return Object.freeze({
    id,
    userId,
    groupId,
    roll: /** @type {Medlemskap["roll"]} */ (roll),
    typ: /** @type {Medlemskap["typ"]} */ (typ),
    status: /** @type {Medlemskap["status"]} */ (status),
    /*
     * ⛔ TOMMA STRÄNGAR OCH INTE UTELÄMNADE FÄLT. En agent har inget namn hos
     * Google, och en person kan sakna bild. Skrivs fältet inte alls går "har
     * ingen bild" inte att skilja från "raden skrevs av en äldre version", och
     * det är arbetsreglernas punkt 5.
     */
    namn: rensa(rad.namn),
    bild: rensa(rad.bild),
  });
}

/**
 * Bygger en inbjudan, eller kastar med skälet. Flödet hör till #137, koden och utskicket till #180.
 *
 * @param {Record<string, any>} d
 * @returns {Inbjudan}
 */
export function byggInbjudan(d) {
  const rad = somObjekt(d);
  const id = rensa(rad.id);
  if (!id) throw new Error("invitations: id krävs.");
  avvisaOkanda("invitations", rad, INBJUDNINGSFALT, id);

  const epost = rensa(rad.epost).toLowerCase();
  if (!epost) throw new Error(`invitations: epost krävs för "${id}". Det är det enda inbjudan har att matcha på innan personen finns.`);
  const groupId = rensa(rad.groupId);
  if (!groupId) throw new Error(`invitations: groupId krävs för "${id}".`);

  const roll = rensa(rad.roll);
  if (!(/** @type {readonly string[]} */ (ROLLER).includes(roll))) {
    throw new Error(`invitations: rollen "${roll}" för "${id}" finns inte. Giltiga: ${ROLLER.join(", ")}.`);
  }
  const status = rensa(rad.status) || "vantar";
  if (!(/** @type {readonly string[]} */ (INBJUDNINGSSTATUS).includes(status))) {
    throw new Error(`invitations: statusen "${status}" för "${id}" finns inte. Giltiga: ${INBJUDNINGSSTATUS.join(", ")}.`);
  }

  /*
   * ⛔ KODEN LAGRAS ALDRIG, BARA DESS SHA-256. Den som kan läsa `invitations` (en admin) ska inte
   * kunna acceptera någon annans inbjudan genom att läsa koden ur raden. Tom sträng betyder "ingen
   * kod skapad än" och matchar aldrig något: den som jämför måste avvisa ett tomt värde först.
   */
  const tokenHash = rensa(rad.tokenHash).toLowerCase();
  if (tokenHash && !/^[0-9a-f]{64}$/.test(tokenHash)) {
    throw new Error(`invitations: tokenHash för "${id}" är inte en SHA-256 i hex (64 tecken). En kod lagras aldrig i klartext.`);
  }

  /*
   * ⛔ SLUTDATUMET ÄR EN TID PÅ RADEN OCH INTE ETT ANTAL DAGAR, och en rad utan ett sätts till 30
   * dagar framåt när den byggs. En gammal rad utan fältet får då ett slutdatum räknat från när den
   * först läses, vilket är ett generöst svar på en fråga ingen ställde: `bjudIn` skriver alltid fältet.
   */
  const giltigTill = rensa(rad.giltigTill) || new Date(Date.now() + INBJUDNING_GILTIGHET_DAGAR * 86_400_000).toISOString();
  if (Number.isNaN(Date.parse(giltigTill))) {
    throw new Error(`invitations: giltigTill "${giltigTill}" för "${id}" är inte en tid (ISO 8601).`);
  }
  const skickad = rensa(rad.skickad);
  if (skickad && Number.isNaN(Date.parse(skickad))) {
    throw new Error(`invitations: skickad "${skickad}" för "${id}" är inte en tid (ISO 8601), eller tom sträng.`);
  }
  const antalSkickade = rad.antalSkickade === undefined ? 0 : rad.antalSkickade;
  if (!Number.isInteger(antalSkickade) || antalSkickade < 0) {
    throw new Error(`invitations: antalSkickade för "${id}" måste vara ett heltal 0 eller större, inte ${JSON.stringify(antalSkickade)}.`);
  }

  return Object.freeze({
    id,
    epost,
    groupId,
    roll: /** @type {Inbjudan["roll"]} */ (roll),
    status: /** @type {Inbjudan["status"]} */ (status),
    skapadAv: byggSkapare(somObjekt(rad.skapadAv)),
    tokenHash,
    giltigTill,
    skickad,
    antalSkickade,
  });
}

/**
 * @typedef {object} Vitlisterad En rad i vitlistan, id är e-postadressen (#160).
 * @property {string} epost Gemener. Samma nyckel som dokumentets id.
 * @property {import("./skapare.js").Skapare} tillagdAv
 * @property {string} tid ISO 8601, när raden lades till.
 */

/**
 * Vitlistans fält. Ett dokument per e-postadress (#160, CP-beslut 2026-09-28
 * i #161).
 *
 * ══ ⛔ VARFÖR EN VITLISTA OCH INTE EN ROLL PÅ users (#160) ═══════════════
 *
 * "Vem får logga in" är en fråga som måste besvaras INNAN någon har ett
 * `users`-dokument: raden kontrolleras vid `skapaGrupp`, av samma serversida
 * som `memberships`, och en klient som ännu inte finns i `users` kan ändå
 * behöva veta att den är avvisad. En vitlista är därför sin egen samling, inte
 * ett fält på en rad som förutsätter att raden redan finns.
 *
 * ⛔ DOKUMENTETS ID ÄR E-POSTEN, GEMENER, AV SAMMA SKÄL SOM ÖVERALLT ANNARS I
 * DEN HÄR FILEN: `CP@Staiger.se` och `cp@staiger.se` är samma brevlåda och två
 * strängar. Ett id som ID:T ger unikheten som en egenskap hos nyckeln
 * (arbetsreglernas punkt 2), inte som en kontroll `skapaGrupp` måste komma
 * ihåg att göra rätt varje gång.
 *
 * ⛔ BARA SERVERSIDAN LÄSER DEN, ALDRIG KLIENTEN. Läser klienten vitlistan kan
 * vem som helst se varje adress som någonsin bjudits in att skapa en grupp,
 * alltså en lista över precis vem det är värt att gissa lösenord för. Samma
 * `allow read, write: if false` som `memberships`, se `regelfragment()`.
 */
export const VITLISTEFALT = ["epost", "tillagdAv", "tid"];

/**
 * Bygger en vitlisterad, eller kastar med skälet. Flödet hör till #161/#162.
 *
 * @param {Record<string, any>} d
 * @returns {Vitlisterad}
 */
export function byggVitlisterad(d) {
  const rad = somObjekt(d);
  const epost = rensa(rad.epost).toLowerCase();
  if (!epost) throw new Error("vitlista: epost krävs. Dokumentets id ÄR e-postadressen, gemener.");
  avvisaOkanda("vitlista", rad, VITLISTEFALT, epost);

  const tid = rensa(rad.tid) || new Date().toISOString();

  return Object.freeze({
    epost,
    tillagdAv: byggSkapare(somObjekt(rad.tillagdAv)),
    tid,
  });
}
