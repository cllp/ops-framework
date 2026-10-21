/**
 * Vem som skapade en post.
 *
 * ══ ⛔ VARFÖR EN E-POSTADRESS INTE ÄR EN IDENTITET ══════════════════════
 *
 * Fältet `skapadAv` bar en fri sträng, och tre olika sorters värde hamnade i
 * det. Mätt i bolag-ops 2026-09-25: klienten skrev `user.email`, agenten skrev
 * `"ops-agent"`, och mätbygget skrev `"matning@example.invalid"`.
 *
 * En adress går att byta. Den säger ingenting om huruvida skribenten var en
 * människa eller ett jobb. Och framför allt: den går inte att kontrollera i en
 * Firestore-regel, eftersom regeln bara har `request.auth.uid` att jämföra med.
 * Så länge fältet är en sträng är det ett PÅSTÅENDE, och en identitet som bara
 * är ett påstående är värdelös i precis det ögonblick den behövs.
 *
 * ══ ⛔ FYRA FÄLT, OCH VARFÖR INGET AV DEM GÅR ATT HÄRLEDA ══════════════
 *
 *   uid    Firebase Auth-uid, eller null för en skrivare utan inloggning.
 *          Det ENDA reglerna kan jämföra mot.
 *   namn   Det som visas. Ingen vy ska rita ett uid.
 *   typ    "manniska", "agent" eller "okand".
 *   kalla  Vilket jobb eller vilken vy som skrev.
 *
 * ⛔ `typ` HÄRLEDS INTE UR `uid`. Frestelsen är att säga "uid finns, alltså en
 * människa". Det går sönder i båda riktningarna: en agent kan få ett eget konto
 * (det är till och med den väg som föreslås i cllp/bolag-ops#376), och en
 * människa kan skrivas in av ett importskript. Ett fält som ibland gissar är
 * sämre än ett fält som alltid frågar.
 *
 * ⛔ `okand` FINNS OCH ÄR INTE ETT FEL. Bakfyllnaden av gamla dokument
 * (cllp/bolag-ops#377) träffar rader där ingen vet vem som skrev. Att gissa CP
 * där hade skapat ett faktum av en tomhet, vilket är värre än ett tomt fält:
 * det går inte att skilja från de rader där vi faktiskt vet.
 *
 * ══ ⛔ `via`: SKRIVET AV EN NYCKEL FÖR PERSONEN (0.135.0, cllp/lifehub.app#409) ═══
 *
 * En personlig API-nyckel skriver SOM personen: `uid` och `namn` är personens, och `typ` är "manniska". Men det nyckeln
 * skriver ska ALDRIG kunna läsas som om personen själv hade skrivit det för hand. Därför bär stämpeln ett valfritt fält
 * `via: { nyckelId, namn }`, och varje vy ritar "Miranda via Byggagent" i stället för "Miranda" (`skaparensNamn`).
 *
 * ⛔ `via` SKRIVS BARA AV SERVERN. En klient kan inte skriva en rad i någon annans namn (reglerna jämför `uid` mot
 * `request.auth.uid`), men en klient som FICK skriva `via` kunde skriva en rad som påstår att en nyckel skrev den, eller
 * utelämna fältet och låta en rad från nyckeln se ut som personens egen. Ett märke som vem som helst kan sätta eller
 * ta bort är inget märke. Därför är det INTE med i `SKAPARFALT`, som är de fyra fält en KLIENT får skriva och som
 * regelfragmentens `hasOnly` är härledda ur: ett nytt fält som läggs i den listan öppnar varje regel på en gång, och
 * det var just den fällan (granskningen av 0.135.0). `SKAPARFALT_SERVER` är samma lista plus `via`, och bara kod som
 * körs med Admin SDK (och därför går förbi reglerna) ska skriva den formen. Reglerna släpper in ett `via` som redan
 * står på raden OFÖRÄNDRAT (en person som ändrar en post hens nyckel skrev), men aldrig ett nytt.
 *
 * ⛔ `via` KRÄVER `uid`. Ett märke utan person säger "skrivet av en nyckel för ingen". Gruppens egen nyckel (en medlem av
 * typen agent) skriver som sig själv och har inget `via`.
 *
 * ══ ⛔ LÄSAREN TÅL DEN GAMLA STRÄNGEN, OCH DET ÄR INTE SNÄLLHET ════════
 *
 * Ordningen i en migrering är tvingande: läsaren måste tåla båda formerna INNAN
 * skrivaren byter, annars visar varje vy tomt för varje omigrerat dokument i
 * samma sekund. Utan en läsare här skriver i stället varje vy sin egen
 * `typeof === "string"`-gren, och då är det fem ställen som ska städas den dag
 * bakfyllnaden är klar i stället för ett.
 */

import { RESERVSPRAK } from "./sprak.js";
import { ordet } from "./ord.js";

/**
 * @typedef {object} Via
 * @property {string} nyckelId API-nyckelns id (inte hemligheten). Högst `MAX_NYCKELID` tecken, gemener och siffror a-f.
 * @property {string} namn Nyckelns namn, så som personen gav den. Det är det som visas efter "via".
 */

/**
 * @typedef {object} Skapare
 * @property {string | null} uid Firebase Auth-uid, eller null.
 * @property {string} namn Det som visas.
 * @property {"manniska" | "agent" | "okand"} typ
 * @property {string} kalla Vilket jobb eller vilken vy.
 * @property {Via} [via] (0.135.0) Skrivet av en API-nyckel för personen. Bara servern skriver det, se filhuvudet.
 */

/** De tre tillåtna sorterna. */
export const SKAPARTYPER = /** @type {const} */ (["manniska", "agent", "okand"]);

/**
 * De fyra fält en KLIENT får skriva på en skaparstämpel. Regeln och modellen läser den här listan, så ett nytt fält på
 * skaparen inte kan glömmas i `hasOnly`.
 *
 * ⛔ `via` STÅR MEDVETET INTE HÄR (0.135.0). Se `SKAPARFALT_SERVER` och filhuvudet: listan är härledd in i varje regels
 * `hasOnly`, så ett fält som läggs till här blir skrivbart för varje klient.
 */
export const SKAPARFALT = /** @type {const} */ (["uid", "namn", "typ", "kalla"]);

/** Fälten på `via`. Reglerna skriver aldrig ut dem: en klient får inte skriva fältet alls. */
export const VIAFALT = /** @type {const} */ (["nyckelId", "namn"]);

/**
 * Hela formen en skaparstämpel kan ha i databasen: de fyra klientfälten plus `via`. ⛔ BARA FÖR KOD SOM SKRIVER MED ADMIN
 * SDK OCH FÖR VALIDERARE SOM LÄSER EN RAD SOM SERVERN KAN HA SKRIVIT. Aldrig i en regels `hasOnly` för en klients skrivning.
 */
export const SKAPARFALT_SERVER = /** @type {const} */ ([...SKAPARFALT, "via"]);

/**
 * Taket för nyckelns id. Appens nycklar har 16 tecken (8 slumpade byte som hex), taket lämnar luft utan att släppa in en
 * text som kan ritas som en hel mening. Teckenmängden är appens: gemena hexsiffror.
 */
export const MAX_NYCKELID = 64;
const NYCKELIDFORM = /^[0-9a-f]+$/;

/**
 * Taken för `namn` och `kalla`, som regelfragmenten för beskrivna appar skriver in ur de här konstanterna (en sanning för taket).
 *
 * ⛔ UTAN TAK ÄR FÄLTEN BARA BEGRÄNSADE AV DOKUMENTETS EGEN STORLEK. Regeln prövade att `namn` och `kalla` var text, men inte hur
 * lång: ett namn på hundratals kilobyte skrivet förbi klienten ritades i full längd i varje vy som visar vem som skapade raden
 * (granskningen av 0.99.0). `byggSkapare` håller samma tak, så att en klient aldrig skriver det regeln nekar.
 */
export const MAX_SKAPARNAMN = 100;
export const MAX_SKAPARKALLA = 100;

/** @type {Skapare} */
const OKAND = Object.freeze({ uid: null, namn: "", typ: "okand", kalla: "" });

/** @param {unknown} v @returns {string} */
const text = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * Skälet till att `via` inte duger, eller `null`. Ett ställe för formen: `byggSkapare`, `byggMeddelande` och en server som
 * vill ge ett vänligt fel åt den som skickade in nyckeln använder alla den här.
 *
 * @param {unknown} via
 * @returns {string | null}
 */
export function viaFel(via) {
  if (!via || typeof via !== "object" || Array.isArray(via)) return "via ska vara ett objekt med nyckelId och namn.";
  const o = /** @type {Record<string, unknown>} */ (via);
  const okanda = Object.keys(o).filter((k) => !(/** @type {readonly string[]} */ (VIAFALT).includes(k)));
  if (okanda.length > 0) return `via har fälten ${okanda.join(", ")}, och de hör inte dit. Giltiga: ${VIAFALT.join(", ")}.`;
  if (typeof o.nyckelId !== "string" || o.nyckelId === "") return "via.nyckelId saknas. Det är nyckelns id, inte hemligheten.";
  if (o.nyckelId.length > MAX_NYCKELID) return `via.nyckelId är ${o.nyckelId.length} tecken. Högst ${MAX_NYCKELID}.`;
  if (!NYCKELIDFORM.test(o.nyckelId)) return "via.nyckelId får bara ha gemena hexsiffror (0-9, a-f), som appens nyckel-id.";
  const namn = text(o.namn);
  if (!namn) return "via.namn saknas. Det är det som visas efter \"via\".";
  if (namn.length > MAX_SKAPARNAMN) return `via.namn är ${namn.length} tecken. Högst ${MAX_SKAPARNAMN}.`;
  return null;
}

/**
 * Bygger `via`, eller kastar med skälet (`viaFel`).
 *
 * ⛔ KASTAR I STÄLLET FÖR ATT KORTA. Nyckelns namn sätts av appen, som själv har ett lägre tak (40), så ett för långt namn är
 * ett programfel och inget en persons profil bestämt. Det är motsatsen till `namn` på skaparen, som kortas.
 *
 * @param {unknown} via
 * @returns {Via}
 */
export function byggVia(via) {
  const fel = viaFel(via);
  if (fel) throw new Error(`byggVia: ${fel}`);
  const o = /** @type {Record<string, string>} */ (via);
  return { nyckelId: o.nyckelId, namn: text(o.namn) };
}

/**
 * Bygger fältet.
 *
 * ⛔ KASTAR PÅ EN OKÄND `typ` i stället för att tyst skriva den vidare. Ett
 * stavfel som `"människa"` hade annars legat i databasen och matchat ingenting,
 * och symptomet vore en rad som ritas utan sort. Samma regel som resten av
 * ramverket: en okänd sort är ett programfel och inte data.
 *
 * ⛔ KASTAR PÅ ETT `via` SOM INTE HÅLLER, och på ett `via` utan `uid` (0.135.0). Fältet är valfritt, och utan det är resultatet
 * exakt de fyra fälten som förut. Att bygga ett `via` gör det inte skrivbart för en klient: reglerna nekar det, se filhuvudet.
 *
 * @param {{ uid?: string | null, namn?: string, typ?: string, kalla?: string, via?: { nyckelId: string, namn: string } | null }} [d]
 * @returns {Skapare}
 */
export function byggSkapare(d = {}) {
  const typ = text(d.typ) || "okand";
  if (!(/** @type {readonly string[]} */ (SKAPARTYPER).includes(typ))) {
    throw new Error(`byggSkapare: okänd typ "${typ}". Giltiga: ${SKAPARTYPER.join(", ")}.`);
  }
  const uid = text(d.uid);
  const kalla = text(d.kalla);
  // `kalla` sätts av appens kod och är ett jobb- eller vynamn: för långt är ett programfel, som en okänd `typ`.
  if (kalla.length > MAX_SKAPARKALLA) {
    throw new Error(`byggSkapare: kalla är ${kalla.length} tecken. Högst ${MAX_SKAPARKALLA}. Det är ett jobb- eller vynamn, inte en text.`);
  }
  const via = d.via === undefined || d.via === null ? null : byggVia(d.via);
  if (via && !uid) throw new Error("byggSkapare: via kräver uid. Ett märke om att en nyckel skrev åt någon måste peka ut vem.");
  return {
    uid: uid || null,
    // `namn` är en persons visningsnamn och kommer ur en profil appen inte styr: det kortas i stället för att stoppa skrivningen.
    namn: text(d.namn).slice(0, MAX_SKAPARNAMN).trimEnd(),
    typ: /** @type {Skapare["typ"]} */ (typ),
    kalla,
    ...(via ? { via } : {}),
  };
}

/**
 * Läser fältet, oavsett vilken form det har i databasen.
 *
 * Svarar ALLTID med den nya formen, så anroparen aldrig behöver veta vilken
 * form dokumentet hade.
 *
 * ⛔ EN GAMMAL STRÄNG BLIR `typ: "okand"` OCH INTE `"manniska"`. Strängen var
 * oftast en e-postadress, men `"ops-agent"` skrevs i samma fält. Att kalla båda
 * människor hade gjort agentens rader omöjliga att skilja ut, alltså förstört
 * precis den spårbarhet fältet byggs om för.
 *
 * ⛔ NAMNET BEHÅLLS ÄNDÅ. Det är det som står i vyn i dag, och en migrering som
 * gör raden tommare än den var läses som att data försvunnit.
 *
 * @param {unknown} varde
 * @returns {Skapare}
 */
export function laesSkapare(varde) {
  if (typeof varde === "string") {
    const namn = varde.trim();
    return namn ? { uid: null, namn, typ: "okand", kalla: "" } : OKAND;
  }
  if (!varde || typeof varde !== "object") return OKAND;
  const o = /** @type {Record<string, unknown>} */ (varde);
  const typ = text(o.typ);
  const via = laesVia(o.via);
  return {
    uid: text(o.uid) || null,
    namn: text(o.namn),
    // ⛔ Ett halvt objekt ur en halvfärdig migrering faller till "okand" i
    // stället för att kasta. Läsaren körs i en vy, och en vy som kastar på en
    // enda trasig rad tar ned hela listan.
    typ: /** @type {Skapare["typ"]} */ (/** @type {readonly string[]} */ (SKAPARTYPER).includes(typ) ? typ : "okand"),
    kalla: text(o.kalla),
    ...(via ? { via } : {}),
  };
}

/**
 * Läser `via` ur en rad, mild som resten av läsaren: ett `via` med ett namn är ett märke, allt annat är inget märke.
 *
 * ⛔ `nyckelId` KRÄVS INTE HÄR. Läsaren ritar ett namn och prövar ingenting; det är `byggVia` som håller formen vid skrivning. En
 * vy som vägrade rita "via Byggagent" för att id:t var skadat hade dolt att raden kom från en nyckel, och det är märkets enda jobb.
 *
 * @param {unknown} varde
 * @returns {Via | null}
 */
function laesVia(varde) {
  if (!varde || typeof varde !== "object" || Array.isArray(varde)) return null;
  const o = /** @type {Record<string, unknown>} */ (varde);
  const namn = text(o.namn).slice(0, MAX_SKAPARNAMN).trimEnd();
  return namn ? { nyckelId: text(o.nyckelId), namn } : null;
}

/**
 * Orden skaparens namn ritas med. Ramverkets textlager (`ord.js`): en komponent som ritar en skapare tar språket och inte egna ord.
 * @type {import("./ord.js").Ordbok}
 */
export const ORD_SKAPARE = {
  via: { sv: "via", en: "via" },
};

/**
 * Ett namn, och nyckeln som skrev det om det finns en: "Miranda via Byggagent".
 *
 * ⛔ DEN ENDA PLATSEN SOM SÄTTER IHOP DET (0.135.0, cllp/lifehub.app#409). Alla vyer som ritar vem som skrev något går hit, antingen
 * genom `skaparensNamn` eller, när vyn redan löst namnet själv (`personnamn`, medlemslistan), direkt hit med `via` från raden.
 * `check:skaparnamn` blir röd om en vy ritar `skapadAv.namn` utan att gå hit. Skrevs "via" i varje vy skulle ett märke som ska
 * synas överallt saknas på exakt det ställe någon glömde.
 *
 * ⛔ TOMT NAMN GER TOMT SVAR även när `via` finns: ett "via Byggagent" utan person säger inte vem, och den som ritar raden väljer själv
 * sin text för "okänd" (`NAMN_SAKNAS`), som för alla andra rader.
 *
 * @param {unknown} namn
 * @param {unknown} via Raden `via`, i valfri form: tolkas som `laesSkapare` tolkar den.
 * @param {string} [sprak]
 * @returns {string}
 */
export function namnMedVia(namn, via, sprak = RESERVSPRAK) {
  const n = text(namn);
  if (!n) return "";
  const v = laesVia(via);
  return v ? `${n} ${ordet(ORD_SKAPARE, "via", sprak)} ${v.namn}` : n;
}

/**
 * Det som ska stå i en vy.
 *
 * ⛔ SVARAR MED EN TOM STRÄNG NÄR NAMNET SAKNAS, ALDRIG MED UID:T ELLER EN BIT AV DET
 * (0.40.1, #218). Här föll den tidigare tillbaka på uid:ts åtta första tecken, med
 * resonemanget att en bit signalerar "maskinnyckel". CP 2026-10-01: "Bra om
 * användarnamnet inte är Guid." Ett id i en vy läses som ett fel i appen, hel eller
 * halv. Den som ritar raden väljer själv sin text för "okänd" (`NAMN_SAKNAS`).
 *
 * ⛔ MED ETT `via` BLIR SVARET "Miranda via Byggagent" (0.135.0), se `namnMedVia`. `sprak` väljer ordet "via".
 *
 * @param {unknown} varde @param {string} [sprak] @returns {string}
 */
export function skaparensNamn(varde, sprak = RESERVSPRAK) {
  const s = laesSkapare(varde);
  return namnMedVia(s.namn, s.via, sprak);
}

/**
 * Om fältet fortfarande bär den gamla formen.
 *
 * Finns för bakfyllnaden: den ska kunna köras om utan att röra det som redan är
 * migrerat, och räkningen efteråt ska kunna visa noll.
 *
 * @param {unknown} varde @returns {boolean}
 */
export function arGammalForm(varde) {
  return typeof varde === "string" && varde.trim().length > 0;
}
