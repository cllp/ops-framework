import { sakertBildnamn } from "./markdown.js";

/**
 * Delningslänken: formen på det som visas och orden för det som inte går att visa.
 *
 * ══ ⛔ VARFÖR DEN HÄR FILEN INTE RÄKNAR NÅGON HASH (lifehub.app#356) ═══════════════════════════════════════════════════
 *
 * En delning är en länk utan inloggning till ett MÅL: en fil i biblioteket (0.119.0) eller en händelse (0.125.0, lifehub.app#377).
 * Själva delningsraden (`byggDelning`, `byggAdressdelning`), tokenet och hashen av det ligger i `src/node/delning.js`: tokenet slumpas och
 * hashas med `node:crypto`, och det ska aldrig bundlas till en besökares webbläsare. Här ligger bara det som vyn, reglerna och servern
 * delar, så att varje tal och varje ord står på ETT ställe (regel 2): utgångstiderna, orsakerna, texterna, formen på en adress och
 * vilken sorts fil som visas hur.
 *
 * ══ ⛔ EN ADRESSMODELL FÖR BÅDA MÅLEN (0.125.0, CP 2026-10-19) ═══════════════════════════════════════════════════════
 *
 * En ny delning har en läsbar adress under `/g/`: `/g/<gruppdel>/event/<händelsedel>` för en händelse och `/g/<gruppdel>/lib/<fildel>` för en
 * fil. Prefixet `/g/` finns för att en grupps namn aldrig ska kunna krocka med appens egna sökvägar, och typsegmentet (`event`, `lib`) för att
 * det syns vilket område adressen hör till och inget namn kan krocka med ett annat mål. Segmenten är en fast lista (`ADRESSSEGMENT`): ett
 * framtida mål, till exempel ett ärende, blir ett nytt ord i listan och inte en ny form. Delningar från 0.119.0 till 0.124.0 har ett slumpat
 * token under `/d/<token>` och lever kvar oförändrade tills de går ut (se beslut 0009).
 */

/** Utgångstider i dagar för en FIL. "Ingen utgång" finns inte för en fil (CP 2026-10-19): en länk som aldrig går ut är en länk som aldrig stängs. */
export const DELNINGSDAGAR = /** @type {const} */ ([1, 7, 30]);

/**
 * Förvald utgångstid i dagar: 30, samma som en gästlänk (`GASTLANKDAGAR`). ⛔ (0.201.0) CP 2026-11-07: "Ja, 30 dagar som förval, ta bort Ingen gräns" (cllp/ops-framework#544).
 * Före 0.201.0 var förvalet 7 dagar för en fil och "ingen gräns" för en händelse: samma sorts länk gällde olika länge beroende på var den skapades.
 */
export const FORVAL_DELNINGSDAGAR = 30;

/**
 * Utgångstider för en HÄNDELSE: samma lista som för en fil (0.201.0, cllp/ops-framework#544). "Ingen gräns" (`null`) finns inte längre för en ny länk.
 * ⛔ EN LÄNK SOM SKAPATS MED INGEN GRÄNS FÖRE 0.201.0 GÄLLER SOM FÖRUT: raden bär `giltigTill: null` och `hamta` läser den som förut. Det är bara en NY länk som måste ha ett slutdatum.
 * Namnet står kvar så att appar som läser det inte går sönder, och värdet är samma lista (en sanning, regel 2).
 */
export const HANDELSEDAGAR = DELNINGSDAGAR;

/** Förvald utgångstid för en händelse: samma som för en fil. */
export const FORVAL_HANDELSEDAGAR = FORVAL_DELNINGSDAGAR;

/** Så länge den signerade adressen till filen gäller, i sekunder. Vyn hämtar en ny när den gått ut. */
export const SIGNERAD_SEKUNDER = 15 * 60;

/** Ett token är 32 slumpbyte i base64url utan utfyllnad: 43 tecken. Så ser en gammal filänk ut (`/d/<token>`). */
export const TOKENFORM = /^[A-Za-z0-9_-]{43}$/;

/**
 * Vad en delning gäller: en post i biblioteket (`post`, också raderna från före 0.125.0 som saknar fältet) eller en händelse.
 *
 * ⛔ `post` ÄR NUMERA ALLA FYRA TYPERNA (0.133.0, lifehub.app#356, CP 2026-10-18: "Vi skall ju ha en publik länk till varje artefakt"): en fil, en anteckning, en länk eller en lista.
 * Raden har inget nytt fält för vilken: typen är postens egen (`typ`) och läses ur posten, en sanning (regel 2). Adressen är fortfarande `<gruppdel>/lib/<del>`.
 */
export const DELNINGSSLAG = /** @type {const} */ (["post", "handelse"]);

/**
 * Vad en länk ger. I skiva 1 finns bara `las`, och `hamta` släpper bara igenom `las` (eller en rad utan fältet): en rad med en
 * rättighet som den här versionen inte känner öppnas aldrig, så en framtida skrivlänk inte kan läsas som en läslänk av en äldre server.
 */
export const DELNINGSRATTIGHETER = /** @type {const} */ (["las"]);

/** Fälten i en delningspost. `id` är hashen av tokenet eller adressen och är dokumentets id, inte ett fält. */
export const DELNINGSFALT = /** @type {const} */ ([
  "slag",
  "rattighet",
  "postId",
  "handelseId",
  "groupId",
  "adress",
  "skapadAv",
  "skapad",
  "giltigTill",
  "aterkallad",
  "nedladdning",
  "kod",
  "felAntal",
  "felFonster",
]);

// ── Adressen ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Prefixet i sökvägen: `/g/...`. Ramverket bygger bara sökvägen, domänen är appens (`delningsUrl`). */
export const ADRESSPREFIX = "g";

/**
 * Typsegmentet i adressen, per slag: `/g/<gruppdel>/lib/<fildel>` och `/g/<gruppdel>/event/<händelsedel>`. En fast lista, och den enda platsen
 * ett nytt mål läggs till på (CP 2026-10-19): ordet är områdets namn i adressen, så ingen sista del behöver reserveras.
 */
export const ADRESSSEGMENT = /** @type {const} */ ({ post: "lib", handelse: "event" });

/** En del av en adress: gemener och siffror, med enstaka bindestreck emellan. Ingen punkt, inget snedstreck, inga versaler. */
export const ADRESSDELFORM = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Längsta delen en person skriver, i tecken (CP: "högst cirka 40 tecken per del"). */
export const MAX_ADRESSDEL = 40;

/** Längsta delen i en lagrad adress: det personen skrev plus bindestrecket och det slumpade slutet. */
export const MAX_ADRESSDEL_TOTALT = 64;

/** Längden på det slumpade slutet (CP: minst 8 tecken ur a-z och 0-9). 36^8 är drygt 2,8 biljoner. */
export const SLUMPSLUT_TECKEN = 8;

/** Så ser det slumpade slutet ut. */
export const SLUMPSLUTFORM = new RegExp(`^[a-z0-9]{${SLUMPSLUT_TECKEN}}$`);

/** Kodens längd i tecken. Sex är golvet: felförsöken är begränsade per länk (se `FELKOD_MAX`), och en kort kod är ändå en kort kod. */
export const KODLANGD = /** @type {const} */ ({ min: 6, max: 64 });

/** Högst så här många felaktiga koder per fönster och länk, sedan svarar länken `for-manga` även på rätt kod. */
export const FELKOD_MAX = 5;

/** Fönstret för `FELKOD_MAX`, i millisekunder. */
export const FELKOD_FONSTER_MS = 15 * 60 * 1000;

/** Teckenbyten som Unicode-uppdelningen (NFKD) inte tar: bokstäver som inte är en bokstav plus ett accenttecken. */
const BOKSTAVER = /** @type {Record<string, string>} */ ({ "ø": "o", "æ": "ae", "œ": "oe", "ß": "ss", "ð": "d", "þ": "th", "ł": "l", "đ": "d" });

/**
 * Text till en adressdel: gemener, å/ä/ö till a/a/o, allt som inte är en bokstav eller en siffra till ETT bindestreck, inga bindestreck
 * i början eller slutet, och högst `max` tecken (kapas vid ett ord om det går).
 *
 * ⛔ PUNKTEN BLIR BINDESTRECK, och står inte kvar: "bubbelglasen.ver2" blir "bubbelglasen-ver2". En punkt i sista delen av en adress läses
 * som ett filnamn (`.pdf`, `.mp3`) av CDN-regler, webbläsare och länkigenkänning, och en punkt sist i en länk i ett sms tas bort av
 * meddelandeappar som skiljetecken. Bindestrecket är säkert i alla tre. Ett "..." kan dessutom aldrig bli en sökväg som går uppåt.
 *
 * @param {unknown} text
 * @param {number} [max]
 * @returns {string}
 */
export function adressdel(text, max = MAX_ADRESSDEL) {
  const gemener = (typeof text === "string" ? text : "").normalize("NFKD").toLowerCase();
  let t = gemener.replace(/[̀-ͯ]/g, "").replace(/[øæœßðþłđ]/g, (c) => BOKSTAVER[c] ?? "");
  t = t.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (t.length <= max) return t;
  // Kapa vid ett ord om kapningen hamnar mitt i ett: slutar de första `max` tecknen på en hel del (nästa tecken är ett bindestreck) behålls den.
  const motOrd = t[max] !== "-";
  t = t.slice(0, max);
  const sista = t.lastIndexOf("-");
  if (motOrd && sista > max / 2) t = t.slice(0, sista);
  return t.replace(/-+$/g, "");
}

/**
 * Är det här en adressdel? Rätt form och inte längre än `max`.
 * @param {unknown} del
 * @param {number} [max]
 * @returns {boolean}
 */
export function arAdressdel(del, max = MAX_ADRESSDEL) {
  return typeof del === "string" && del.length <= max && ADRESSDELFORM.test(del);
}

/**
 * Nästa förslag när en adress är upptagen: `resa` blir `resa-2`, `resa-2` blir `resa-3`. Delen hålls under `max` tecken.
 * @param {string} del
 * @param {number} [max]
 * @returns {string}
 */
export function nastaAdressdel(del, max = MAX_ADRESSDEL) {
  const m = /^(.*?)-(\d{1,3})$/.exec(del);
  const bas = m ? m[1] : del;
  const n = m ? Number(m[2]) + 1 : 2;
  const slut = `-${n}`;
  return `${adressdel(bas, max - slut.length) || bas.slice(0, max - slut.length)}${slut}`;
}

/**
 * Förslaget till en adress ur gruppens namn och målets titel. Personen får ändra båda delarna innan länken skapas.
 *
 * ⛔ GRUPPDELEN HAR INGEN RESERV (0.127.0). Förut blev den ett fast ord ("grupp") när namnet saknades. En gruppdel tillhör den första plats som tar den för
 * alltid, så den första gruppen som delade något utan att namnet kom fram fick ordet, och alla andra grupper fick "används av en annan grupp". Utan namn är
 * gruppdelen därför tom: rutan visar ett tomt fält och Skapa säger att adressen inte kan vara tom, i stället för att föreslå ett ord som är fel för nästa grupp.
 * Sista delen har kvar sin reserv (`fil`, `handelse`): den är unik bara inom gruppens egen gruppdel, och en krock där löses med `-2`.
 *
 * @param {{ grupp?: unknown, titel?: unknown, slag: "post" | "handelse" }} d
 * @returns {{ gruppdel: string, sista: string }}
 */
export function foreslaAdress(d) {
  return { gruppdel: adressdel(d?.grupp), sista: adressdel(d?.titel) || (d?.slag === "post" ? "fil" : "handelse") };
}

/**
 * Adressen som en sträng: `<gruppdel>/event/<händelsedel>` eller `<gruppdel>/lib/<fildel>`. Det här är nyckeln: dokumentets id är SHA-256 av den.
 *
 * @param {{ slag: "post" | "handelse", gruppdel: string, sista: string }} d
 * @returns {string}
 */
export function byggAdress(d) {
  return `${d.gruppdel}/${ADRESSSEGMENT[d.slag]}/${d.sista}`;
}

/**
 * Vad en lagrad eller inkommande adress gäller, eller `null` om den inte är en adress. Tre delar med ett känt typsegment i mitten
 * (`ADRESSSEGMENT`): `lib` är en fil, `event` en händelse.
 *
 * @param {unknown} adress `<gruppdel>/<typsegment>/<sista del>`, utan `/g/` framför.
 * @returns {null | { slag: "post" | "handelse", gruppdel: string, sista: string, adress: string }}
 */
export function tolkaAdress(adress) {
  if (typeof adress !== "string") return null;
  const delar = adress.split("/");
  if (delar.length !== 3) return null;
  const [gruppdel, segment, sista] = delar;
  const slag = /** @type {Array<"post" | "handelse">} */ (/** @type {unknown} */ (Object.keys(ADRESSSEGMENT))).find((s) => ADRESSSEGMENT[s] === segment);
  if (!slag) return null;
  if (!arAdressdel(gruppdel, MAX_ADRESSDEL_TOTALT) || !arAdressdel(sista, MAX_ADRESSDEL_TOTALT)) return null;
  return { slag, gruppdel, sista, adress };
}

/**
 * Sökvägen för en lagrad adress: `/g/travel/resa-med-kusiner-k7f3q9x2`. Ramverket bygger bara sökvägen; domänen är appens (`delningsUrl`).
 * @param {string} adress
 * @returns {string}
 */
export function delningsSokvag(adress) {
  return `/${ADRESSPREFIX}/${adress}`;
}

/**
 * Hela adressen: appens basadress plus sökvägen. Basadressen är instansens och kommer från appen (för LifeHub `https://my.life-hub.app`).
 * Ett snedstreck sist i basadressen tas bort, och en basadress som inte är `https://` eller `http://` kastar (en länk utan protokoll blir
 * ingen länk i ett sms).
 *
 * @param {string} bas
 * @param {string} sokvag Ur `delningsSokvag` eller ur svaret från `skapa` och `lista`.
 * @returns {string}
 */
export function delningsUrl(bas, sokvag) {
  if (typeof bas !== "string" || !/^https?:\/\/[^\s/]+$/.test(bas.replace(/\/+$/, ""))) {
    throw new Error("delningsUrl: basadressen är instansens adress med protokoll och utan sökväg, till exempel https://my.life-hub.app.");
  }
  if (typeof sokvag !== "string" || !sokvag.startsWith(`/${ADRESSPREFIX}/`)) {
    throw new Error(`delningsUrl: sökvägen börjar på /${ADRESSPREFIX}/ (ur delningsSokvag, skapa eller lista).`);
  }
  return `${bas.replace(/\/+$/, "")}${sokvag}`;
}

/**
 * Inkommande uppslag (sökvägen efter `/g/`) till den form den lagras i, eller `null`. Gemener: en adress som skrivits om med versaler i ett
 * meddelande ska ändå hitta rätt. Ett avslutande snedstreck tas bort.
 *
 * @param {unknown} ref
 * @returns {string | null}
 */
export function adressUrUppslag(ref) {
  if (typeof ref !== "string") return null;
  const t = ref.trim().toLowerCase().replace(/\/+$/, "");
  return tolkaAdress(t) ? t : null;
}

/**
 * Är koden godtagbar som kod? Tom text: koden är inte vald, det är inget fel. Annars `min` till `max` tecken efter NFC och trim.
 * @param {unknown} kod
 * @returns {string} Felet som mening, eller en tom sträng.
 */
export function kodFel(kod) {
  if (kod === undefined || kod === null) return "";
  if (typeof kod !== "string") return "Koden ska vara text.";
  const k = kod.normalize("NFC").trim();
  if (k === "") return "";
  if (k.length < KODLANGD.min) return `Koden ska vara minst ${KODLANGD.min} tecken.`;
  if (k.length > KODLANGD.max) return `Koden får vara högst ${KODLANGD.max} tecken.`;
  return "";
}

/**
 * Koden som den jämförs och lagras: NFC och utan blanksteg i ändarna. Tom text och `undefined` är "ingen kod".
 * @param {unknown} kod
 * @returns {string}
 */
export function normaliseraKod(kod) {
  return typeof kod === "string" ? kod.normalize("NFC").trim() : "";
}

// ── Orsakerna ───────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Orsakerna till att en länk inte går att visa, och texten för var och en.
 *
 * ⛔ ETT OKÄNT TOKEN HAR SAMMA ORSAK SOM ETT UTGÅNGET. Skulle svaret skilja dem åt gick det att pröva sig fram till vilka tokens
 * som en gång funnits. Texten för "stangd" och "saknas" kan bara nås av den som redan har en riktig länk. Samma gäller en adress.
 *
 * `kod-kravs` och `fel-kod` svarar bara för en länk som finns och går att visa, och säger inget annat om målet. `for-manga` är den
 * enda orsaken som inte hör till länken: för många felaktiga koder på samma länk inom `FELKOD_FONSTER_MS`.
 */
export const DELNINGSORSAKER = /** @type {const} */ (["utgangen", "stangd", "saknas", "handelse-saknas", "kod-kravs", "fel-kod", "for-manga"]);

/**
 * Orden för en länk som inte går att visa, på svenska och engelska (0.201.0, cllp/ops-framework#544).
 *
 * ══ ⛔ SAMMA BESKED SOM GÄSTENS (CP 2026-11-07: "Se till att allt är enhetligt med gästinbjudan så att det är samma upplevelse för användaren") ══
 *
 * Före 0.201.0 var rubriken orsaken ("Länken har gått ut", "Länken är stängd", "Finns inte längre"), bara på svenska på filens sida, och ingen sida sa vad man gör sedan.
 * Gästens sida säger "Länken fungerar inte längre" och vad gästen gör. Nu har en delad länk samma rubrik (`rubrik`), en rad om varför (`orsak_<orsak>`) och nästa väg (`nasta`).
 * Varför får stå kvar: en delad länk är ingen personlig inbjudan, och texten för `stangd` och `saknas` nås bara av den som redan har en riktig länk (se `DELNINGSORSAKER`).
 * ⛔ "Finns inte längre" påstår ingen typ (0.133.0): en raderad post bär ingen typ att läsa.
 * @type {import("./ord.js").Ordbok}
 */
export const ORD_DELNINGSFEL = {
  rubrik: { sv: "Länken fungerar inte längre", en: "The link no longer works" },
  orsak_utgangen: { sv: "Den har gått ut.", en: "It has expired." },
  orsak_stangd: { sv: "Den som delade den har dragit tillbaka den.", en: "The person who shared it has withdrawn it." },
  orsak_saknas: { sv: "Det som delades finns inte längre.", en: "What was shared no longer exists." },
  "orsak_handelse-saknas": { sv: "Händelsen finns inte längre.", en: "The event no longer exists." },
  nasta: { sv: "Be den som delade den om en ny länk.", en: "Ask the person who shared it for a new link." },
  "kod-kravs": { sv: "Länken kräver en kod", en: "This link needs a code" },
  "fel-kod": { sv: "Koden stämde inte", en: "The code was not right" },
  "for-manga": { sv: "För många försök. Vänta en stund och försök igen", en: "Too many attempts. Wait a while and try again" },
};

/**
 * Den svenska rubriken för en orsak, härledd ur `ORD_DELNINGSFEL` (en sanning, regel 2). En länk som inte fungerar har rubriken "Länken fungerar inte längre" oavsett varför,
 * och raden om varför står i `delningsbesked`.
 * @type {Record<"utgangen" | "stangd" | "saknas" | "handelse-saknas" | "kod-kravs" | "fel-kod" | "for-manga", string>}
 */
export const DELNINGSFEL = {
  utgangen: ORD_DELNINGSFEL.rubrik.sv,
  stangd: ORD_DELNINGSFEL.rubrik.sv,
  saknas: ORD_DELNINGSFEL.rubrik.sv,
  "handelse-saknas": ORD_DELNINGSFEL.rubrik.sv,
  "kod-kravs": ORD_DELNINGSFEL["kod-kravs"].sv,
  "fel-kod": ORD_DELNINGSFEL["fel-kod"].sv,
  "for-manga": ORD_DELNINGSFEL["for-manga"].sv,
};

/**
 * Felkoderna som `skapa` lägger på sina fel (`fel.kod`), för appens callable att översätta. Meddelandet är för loggen, koden är för klienten.
 * `adress-upptagen` är den som rutan svarar på med ett nytt förslag.
 */
export const DELNINGSFELKODER = /** @type {const} */ (["adress-upptagen", "ogiltig-adress", "ogiltig-kod", "finns-inte", "ej-behorig"]);

/** Fälten i svaret för en FIL som går att visa. Inget annat lämnar servern. */
export const DELNINGSSVARSFALT = /** @type {const} */ (["rubrik", "typ", "mime", "storlek", "langd", "peaks", "nedladdning", "url", "visaUrl"]);

/**
 * Fälten i svaret för en HÄNDELSE som går att visa. Inget annat lämnar servern: inte gruppen, medlemmarna, svaren, chatten, kommentarerna,
 * vem som skapade händelsen eller något annat av appens fält än de `handelseSida` listar. `ejVisade` är hur många filer som inte fick plats
 * (tak: `MAX_HANDELSEFILER`), så att en lista som kapats aldrig ser ut som hela listan.
 */
export const HANDELSESVARSFALT = /** @type {const} */ (["slag", "titel", "beskrivning", "plats", "datum", "slutDatum", "tid", "slutTid", "heldag", "filer", "ejVisade"]);

/**
 * Fälten i svaret för en ANTECKNING (0.133.0): typen, rubriken och texten. Inget annat lämnar servern: inte taggar, inte vem som skrev den, inte gruppen.
 * `typ` skiljer svaret från en fils (vars `typ` är `ljud`, `bild`, `video`, `pdf` eller `dokument`).
 */
export const ANTECKNINGSSVARSFALT = /** @type {const} */ (["typ", "rubrik", "text", "bilder"]);

/**
 * ⛔ BILDERNA I EN DELAD ANTECKNING (0.207.0, cllp/lifehub.app#696 skiva 2). `bilder` i `ANTECKNINGSSVARSFALT` (och i svaret på gästens `anteckningsbilder`) är bildens filnamn i texten
 * (`![alt](namn)`, `bilderI` i `lib/markdown.js`) till en signerad adress som gäller `SIGNERAD_SEKUNDER`. Fältet finns bara när texten har minst en bild och lagringen kan pröva att
 * filen finns (`finns`); en fil som saknas utelämnas, och vyn säger då "Bilden kunde inte visas.".
 *
 * ⛔ TAKEN. Varje bild kostar två anrop mot lagringen vid varje hämtning (finns, och en signering, som i Cloud Functions går genom IAM), och sidan är publik: vem som helst med länken
 * kan hämta den om och om igen. `MAX_ANTECKNINGSBILDER` (20) per anteckning räcker för ett kvitto, ett protokoll med skärmbilder eller en reseanteckning, och en anteckning med fler
 * bilder är ett album som hör hemma som filer i biblioteket. `MAX_ANTECKNINGSBILDER_PER_SVAR` (100) gäller hela svaret: en delad lista har upp till `MAX_DELADE_LISTPOSTER` (100)
 * poster, och utan ett tak för svaret hade en hämtning kunnat bli tusentals anrop. Bilder efter postens tak får ingen adress (vyn: "Bilden kunde inte visas."), och en anteckning som
 * kommer efter svarets tak får inget `bilder` alls (vyn: "Bilden visas inte här än."). ⛔ Gästens bibliotek skickar inga bilder med listan: de signeras först när gästen öppnar en
 * anteckning (`anteckningsbilder` i gästtjänsten), som filerna (regel 13).
 */
export const MAX_ANTECKNINGSBILDER = 20;
/** Se `MAX_ANTECKNINGSBILDER`. */
export const MAX_ANTECKNINGSBILDER_PER_SVAR = 100;

/** Bildtyperna en bild i en anteckning får ha, ur ändelsen: de typer bibliotekets lagringsregel tar emot för en bild (`BibliotekAnteckningsbild.jsx`). */
const ANTECKNINGSBILDMIME = /** @type {Record<string, string>} */ ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" });

/**
 * Bildens MIME ur filnamnet, eller `""` för ett namn som inte är en bild. Bara en bild signeras: postens mapp kan bära annat (en HTML-fils versioner), och ett namn i texten får aldrig
 * göra en sådan fil nåbar.
 * @param {unknown} namn
 */
export function anteckningsbildMime(namn) {
  const m = typeof namn === "string" ? /\.([a-z0-9]+)$/i.exec(namn) : null;
  return (m && Object.hasOwn(ANTECKNINGSBILDMIME, m[1].toLowerCase()) ? ANTECKNINGSBILDMIME[m[1].toLowerCase()] : "") ?? "";
}

/** Ett segment i en lagringssökväg: inte tomt, inte `.` eller `..`, inget snedstreck och inga styrtecken. @param {unknown} s */
const segment = (s) => typeof s === "string" && s !== "" && s !== "." && s !== ".." && !/[/\\\u0000-\u001f\u007f]/.test(s);

/**
 * Sökvägen till en bild i en anteckning: `<gruppPrefix>/<groupId>/<postPrefix>/<postId>/<namn>`, med postens EGEN plats och id, samma form som en fil i biblioteket
 * (`grupper/<plats>/bibliotek/<post>/<fil>`, som lagringsregeln och gästens `arGruppFil` kräver). `null` när något segment inte är ett segment, när namnet inte är ett säkert
 * bildnamn (`sakertBildnamn`) eller inte är en bild (`anteckningsbildMime`). ⛔ Det finns ingen väg ut ur postens mapp: namnet har inget snedstreck och inget `..`.
 *
 * @param {{ gruppPrefix: string, postPrefix: string, groupId: unknown, postId: unknown, namn: unknown }} b
 * @returns {string | null}
 */
export function anteckningsbildSokvag({ gruppPrefix, postPrefix, groupId, postId, namn }) {
  if (!sakertBildnamn(namn) || !anteckningsbildMime(namn)) return null;
  if (![gruppPrefix, groupId, postPrefix, postId].every(segment)) return null;
  return `${gruppPrefix}/${groupId}/${postPrefix}/${postId}/${namn}`;
}

/** Fälten i svaret för en LÄNK (0.133.0): typen, rubriken och adressen (bara http eller https). Inte källan, inte omslaget, inte vem som la till den. */
export const LANKSVARSFALT = /** @type {const} */ (["typ", "rubrik", "url"]);

/**
 * Fälten i svaret för en LISTA (0.133.0): typen, rubriken, om nedladdning är på (gäller varje fil i listan), posterna i listans ordning och hur många som inte fick plats.
 *
 * ⛔ LISTAN ÄR EN LEVANDE SPEGEL AV LISTAN, INGEN KOPIA (CP 2026-10-20: "Ändras listan kan den ju bara ändras för alla som den delas med. Om en låt tas bort kan den bara tas bort
 * precis som för den som skapade den."). Servern läser listan vid varje hämtning och svaret är det medlemmen ser just nu. Ingenting av listan lagras i delningsraden.
 */
export const LISTSVARSFALT = /** @type {const} */ (["typ", "rubrik", "nedladdning", "poster", "ejVisade"]);

/**
 * En rad i en delad lista är en post med SAMMA fält som om den delats ensam (en fils `DELNINGSSVARSFALT`, `ANTECKNINGSSVARSFALT` eller `LANKSVARSFALT`) plus `id`, en ogenomskinlig
 * nyckel (hash av delningen och postens id) som är densamma vid varje hämtning. Spelaren behöver den för att veta vilken låt som spelas när listan hämtas om. Postens eget id lämnar aldrig servern.
 */
export const LISTRADSNYCKEL = "id";

/**
 * Raderna i en delad lista som inte är en post, med `typ` och inget annat fält (CP 2026-10-20: en raderad post visas som medlemmens egen listvy visar den):
 * `saknas` (posten är borttagen, ligger på en annan plats eller är en fil som inte blev klar) och `lista-i-lista` (en lista kan inte ligga i en lista).
 */
export const LISTRADSKAL = /** @type {const} */ (["saknas", "lista-i-lista"]);

/**
 * Högsta antalet poster en delad lista visar (0.133.0). Varje fil får en signerad adress (en PDF med nedladdning två), och en lista får vara 200 poster (`MAX_LISTPOSTER`). Poster efter
 * taket kommer inte med, och `ejVisade` säger hur många, så att en kapad lista aldrig ser ut som hela listan (regel 5). Samma mönster som `MAX_HANDELSEFILER`.
 */
export const MAX_DELADE_LISTPOSTER = 100;

/** Fälten på en fil i en händelses svar. Bara det sidan visar, plus en adress som går ut. */
export const HANDELSEFILFALT = /** @type {const} */ (["rubrik", "typ", "mime", "storlek", "url"]);

/** Högsta antalet filer en händelsesida visar (varje fil får en signerad adress). */
export const MAX_HANDELSEFILER = 50;

/**
 * Hur en delad fil visas, härlett ur MIME. Video finns här fast biblioteket ännu inte tar emot den: vyn ska kunna visa det
 * den får, och biblioteket öppnas för formatet i ett eget steg.
 *
 * @param {unknown} mime
 * @returns {"ljud" | "bild" | "video" | "pdf" | "dokument"}
 */
export function delningsTyp(mime) {
  const m = typeof mime === "string" ? mime.trim().toLowerCase() : "";
  if (m.startsWith("audio/")) return "ljud";
  if (m.startsWith("image/")) return "bild";
  if (m.startsWith("video/")) return "video";
  if (m === "application/pdf") return "pdf";
  return "dokument";
}

/**
 * Texten för en orsak. En okänd orsak är den som ett utgånget token ger, aldrig ett undantag: vyn visar ett svar från en server
 * den inte styr, och ett fel i vyn är sämre än en vänlig text.
 *
 * @param {unknown} orsak
 * @returns {string}
 */
export function delningsfel(orsak) {
  return typeof orsak === "string" && Object.hasOwn(DELNINGSFEL, orsak) ? DELNINGSFEL[/** @type {keyof typeof DELNINGSFEL} */ (orsak)] : DELNINGSFEL.utgangen;
}

/**
 * Beskedet för en länk som inte fungerar (0.201.0): rubriken, raden om varför och nästa väg, på språket. För en kodorsak (`kod-kravs`, `fel-kod`, `for-manga`) är rubriken orsakens egen text
 * och raderna tomma: kodrutan säger resten. En okänd orsak är en utgången länk, som i `delningsfel`.
 *
 * @param {unknown} orsak
 * @param {unknown} [sprak] `sv` eller `en`. Allt annat är svenska.
 * @returns {{ rubrik: string, varfor: string, nasta: string }}
 */
export function delningsbesked(orsak, sprak) {
  const s = sprak === "en" ? "en" : "sv";
  const kand = typeof orsak === "string" && Object.hasOwn(DELNINGSFEL, orsak) ? orsak : "utgangen";
  if (kand === "kod-kravs" || kand === "fel-kod" || kand === "for-manga") return { rubrik: ORD_DELNINGSFEL[kand][s], varfor: "", nasta: "" };
  return { rubrik: ORD_DELNINGSFEL.rubrik[s], varfor: ORD_DELNINGSFEL[`orsak_${kand}`][s], nasta: ORD_DELNINGSFEL.nasta[s] };
}
