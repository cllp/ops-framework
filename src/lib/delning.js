/**
 * Delningslänken: formen på det som visas och orden för det som inte går att visa.
 *
 * ══ ⛔ VARFÖR DEN HÄR FILEN INTE RÄKNAR NÅGON HASH (lifehub.app#356) ═══════════════════════════════════════════════════
 *
 * En delning är en länk utan inloggning till en fil i biblioteket. Själva delningsraden (`byggDelning`), tokenet och hashen
 * av det ligger i `src/node/delning.js`: tokenet slumpas och hashas med `node:crypto`, och det ska aldrig bundlas till en
 * besökares webbläsare. Här ligger bara det som vyn, reglerna och servern delar, så att varje tal och varje ord står på ETT
 * ställe (regel 2): utgångstiderna, orsakerna, texterna och vilken sorts fil som visas hur.
 */

/** Utgångstider i dagar. "Ingen utgång" finns inte (CP 2026-10-19): en länk som aldrig går ut är en länk som aldrig stängs. */
export const DELNINGSDAGAR = /** @type {const} */ ([1, 7, 30]);

/** Förvald utgångstid i dagar (CP 2026-10-19). */
export const FORVAL_DELNINGSDAGAR = 7;

/** Så länge den signerade adressen till filen gäller, i sekunder. Vyn hämtar en ny när den gått ut. */
export const SIGNERAD_SEKUNDER = 15 * 60;

/** Ett token är 32 slumpbyte i base64url utan utfyllnad: 43 tecken. */
export const TOKENFORM = /^[A-Za-z0-9_-]{43}$/;

/** Fälten i en delningspost. `id` är hashen av tokenet och är dokumentets id, inte ett fält. */
export const DELNINGSFALT = /** @type {const} */ (["postId", "groupId", "skapadAv", "skapad", "giltigTill", "aterkallad", "nedladdning"]);

/**
 * Orsakerna till att en länk inte går att visa, och texten för var och en.
 *
 * ⛔ ETT OKÄNT TOKEN HAR SAMMA ORSAK SOM ETT UTGÅNGET. Skulle svaret skilja dem åt gick det att pröva sig fram till vilka tokens
 * som en gång funnits. Texten för "stangd" och "saknas" kan bara nås av den som redan har en riktig länk.
 */
export const DELNINGSORSAKER = /** @type {const} */ (["utgangen", "stangd", "saknas"]);

/** @type {Record<"utgangen" | "stangd" | "saknas", string>} */
export const DELNINGSFEL = {
  utgangen: "Länken har gått ut",
  stangd: "Länken är stängd",
  saknas: "Filen finns inte längre",
};

/** Fälten i svaret för en länk som går att visa. Inget annat lämnar servern. */
export const DELNINGSSVARSFALT = /** @type {const} */ (["rubrik", "typ", "mime", "storlek", "langd", "peaks", "nedladdning", "url", "visaUrl"]);

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
