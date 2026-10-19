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

/** Förvald utgångstid i dagar för en fil (CP 2026-10-19). */
export const FORVAL_DELNINGSDAGAR = 7;

/**
 * Utgångstider för en HÄNDELSE: `null` är "ingen gräns" och är förvalet (CP 2026-10-19: "förvalt INGEN gräns, men alltid möjlig att
 * återkalla"). Samma 1, 7 och 30 dagar som för en fil, så att en siffra har ett ställe.
 */
export const HANDELSEDAGAR = /** @type {const} */ ([null, ...DELNINGSDAGAR]);

/** Förvald utgångstid för en händelse: ingen gräns. */
export const FORVAL_HANDELSEDAGAR = null;

/** Så länge den signerade adressen till filen gäller, i sekunder. Vyn hämtar en ny när den gått ut. */
export const SIGNERAD_SEKUNDER = 15 * 60;

/** Ett token är 32 slumpbyte i base64url utan utfyllnad: 43 tecken. Så ser en gammal filänk ut (`/d/<token>`). */
export const TOKENFORM = /^[A-Za-z0-9_-]{43}$/;

/** Vad en delning gäller: en fil i biblioteket (`post`, också raderna från före 0.125.0 som saknar fältet) eller en händelse. */
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
 * @param {{ grupp?: unknown, titel?: unknown, slag: "post" | "handelse" }} d
 * @returns {{ gruppdel: string, sista: string }}
 */
export function foreslaAdress(d) {
  return { gruppdel: adressdel(d?.grupp) || "grupp", sista: adressdel(d?.titel) || (d?.slag === "post" ? "fil" : "handelse") };
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

/** @type {Record<"utgangen" | "stangd" | "saknas" | "handelse-saknas" | "kod-kravs" | "fel-kod" | "for-manga", string>} */
export const DELNINGSFEL = {
  utgangen: "Länken har gått ut",
  stangd: "Länken är stängd",
  saknas: "Filen finns inte längre",
  "handelse-saknas": "Händelsen finns inte längre",
  "kod-kravs": "Länken kräver en kod",
  "fel-kod": "Koden stämde inte",
  "for-manga": "För många försök. Vänta en stund och försök igen",
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
