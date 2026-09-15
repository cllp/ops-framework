/**
 * Formatering av tal, pengar och datum.
 *
 * ⛔ Det här hör hemma i ramverket, inte i varje app, av ett skäl som är lätt
 * att underskatta: formatering är en del av utseendet. Två appar som skriver
 * `1 234,50 kr` och `1234.5 SEK` ser inte ut som samma produkt, hur lika deras
 * knappar än är. bolag-ops är dessutom en ekonomiplattform, där nästan varje
 * siffra på skärmen är ett belopp.
 *
 * ⛔ Allt går via `Intl`. Handskriven formatering med `toFixed` och
 * strängersättning ger fel tusentalsavgränsare, fel decimaltecken och fel
 * avrundning för negativa tal, och felen syns bara i vissa värden.
 *
 * Språket är sv-SE som standard och kan bytas per anrop. Det är inte
 * internationalisering av produkten, det är att inte låsa in oss.
 */

const SPRAK = "sv-SE";

/**
 * Matchar det mellanslag `Intl` stoppar in i tal, oavsett vilket det är.
 *
 * ⛔ Den här konstanten bär ett fel jag själv gjorde, och felet är mer lärorikt
 * än regeln.
 *
 * Första versionen hette `TUSENTALSAVGRANSARE` och var satt till smalt hårt
 * mellanslag (U+202F), med en kommentar som förklarade att svenska använder
 * det. Det stod med full säkerhet och var **inte uppmätt**. Ramverkets eget
 * test fällde det inom minuten: Node 22 med ICU 78 ger U+00A0, vanligt hårt
 * mellanslag, både mellan tusentalen och före `kr`.
 *
 * Den riktiga lärdomen är därför inte att det är 00A0. Det är att **vilket
 * tecken det är beror på ICU-versionen**, alltså på vilken Node som råkar köra.
 * Ett test som låser tecknet går sönder vid en runtime-uppgradering och ser då
 * ut som att formateringen är trasig.
 *
 * Jämför därför aldrig formaterad utdata tecken för tecken. Formaterade tal är
 * till för att visas. Behöver du ändå jämföra: strippa med den här.
 *
 * ⛔ Negativa tal får dessutom U+2212 MINUSTECKEN, inte bindestreck. Samma
 * fälla, samma lösning: jämför inte på tecknet.
 */
export const TALMELLANSLAG = /[\u00A0\u202F\u2009\u2007\u0020]/g;

/**
 * Vad som visas när ett värde saknas.
 *
 * ⛔ Ett saknat värde får ALDRIG visas som 0. En nolla är ett påstående om
 * datan, och det påståendet syns inte som en gissning. I en kostnadstabell är
 * skillnaden mellan "kostar ingenting" och "vi vet inte" hela poängen.
 *
 * Tecknet är ett vanligt bindestreck, inte tankstreck. Dels för att tankstreck
 * är förbjudet i all vår text, dels för att det inte kan förväxlas med ett
 * negativt tal: `Intl` sätter U+2212 MINUSTECKEN framför negativa belopp, inte
 * bindestreck. Uppmätt, inte antaget.
 */
export const SAKNAS = "-";

/**
 * Belopp med valuta.
 * @param {number | null | undefined} varde
 * @param {{ currency?: string, decimals?: number, locale?: string }} [val]
 * @returns {string}
 */
export function formatCurrency(varde, val = {}) {
  if (varde === null || varde === undefined || Number.isNaN(varde)) return SAKNAS;
  const { currency = "SEK", decimals = 0, locale = SPRAK } = val;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(varde);
}

/**
 * Tal utan valuta.
 * @param {number | null | undefined} varde
 * @param {{ decimals?: number, locale?: string }} [val]
 * @returns {string}
 */
export function formatNumber(varde, val = {}) {
  if (varde === null || varde === undefined || Number.isNaN(varde)) return SAKNAS;
  const { decimals = 0, locale = SPRAK } = val;
  return new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(varde);
}

/**
 * Andel. Tar 0,42 och ger "42 %", inte 42.
 *
 * ⛔ Gränssnittet tar ANDEL, inte procenttal, eftersom det är så `Intl` och
 * matematiken fungerar. Tar en funktion emot både 0,42 och 42 utan att kunna
 * skilja dem åt blir felet tyst och hundra gånger för stort.
 * @param {number | null | undefined} andel
 * @param {{ decimals?: number, locale?: string }} [val]
 * @returns {string}
 */
export function formatPercent(andel, val = {}) {
  if (andel === null || andel === undefined || Number.isNaN(andel)) return SAKNAS;
  const { decimals = 0, locale = SPRAK } = val;
  return new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(andel);
}

/**
 * Datum. Tar Date, tidsstämpel eller ISO-sträng.
 *
 * ⛔ `new Date("2026-09-15")` tolkas som midnatt i UTC, medan
 * `new Date("2026-09-15T00:00")` tolkas som lokal tid. I Sverige på sommaren
 * betyder det att ett rent datum kan visas som dagen innan. Därför behandlas
 * en ren datumsträng här som ett kalenderdatum utan tidszon.
 * @param {Date | number | string | null | undefined} varde
 * @param {{ style?: "short" | "long" | "month", locale?: string }} [val]
 * @returns {string}
 */
export function formatDate(varde, val = {}) {
  const d = tillDatum(varde);
  if (!d) return SAKNAS;
  const { style = "short", locale = SPRAK } = val;
  const renDatumstrang = typeof varde === "string" && /^\d{4}-\d{2}-\d{2}$/.test(varde);
  const options =
    style === "long"
      ? { year: "numeric", month: "long", day: "numeric" }
      : style === "month"
        ? { year: "numeric", month: "long" }
        : { year: "numeric", month: "2-digit", day: "2-digit" };
  if (renDatumstrang) options.timeZone = "UTC";
  return new Intl.DateTimeFormat(locale, options).format(d);
}

/**
 * Datum och klockslag.
 * @param {Date | number | string | null | undefined} varde
 * @param {{ locale?: string }} [val]
 * @returns {string}
 */
export function formatDateTime(varde, val = {}) {
  const d = tillDatum(varde);
  if (!d) return SAKNAS;
  return new Intl.DateTimeFormat(val.locale ?? SPRAK, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * @param {Date | number | string | null | undefined} varde
 * @returns {Date | null}
 */
function tillDatum(varde) {
  if (varde === null || varde === undefined || varde === "") return null;
  const d = varde instanceof Date ? varde : new Date(varde);
  return Number.isNaN(d.getTime()) ? null : d;
}
