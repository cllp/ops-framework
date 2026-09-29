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

const LANGUAGE = "sv-SE";

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
export const NUMBER_SPACE = /[\u00A0\u202F\u2009\u2007\u0020]/g;

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
export const MISSING = "-";

/**
 * Belopp med valuta.
 * @param {number | null | undefined} value
 * @param {{ currency?: string, decimals?: number, locale?: string }} [choice]
 * @returns {string}
 */
export function formatCurrency(value, choice = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return MISSING;
  const { currency = "SEK", decimals = 0, locale = LANGUAGE } = choice;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Tal utan valuta.
 * @param {number | null | undefined} value
 * @param {{ decimals?: number, locale?: string }} [choice]
 * @returns {string}
 */
export function formatNumber(value, choice = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return MISSING;
  const { decimals = 0, locale = LANGUAGE } = choice;
  return new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}

/**
 * Andel. Tar 0,42 och ger "42 %", inte 42.
 *
 * ⛔ Gränssnittet tar ANDEL, inte procenttal, eftersom det är så `Intl` och
 * matematiken fungerar. Tar en funktion emot både 0,42 och 42 utan att kunna
 * skilja dem åt blir felet tyst och hundra gånger för stort.
 * @param {number | null | undefined} share
 * @param {{ decimals?: number, locale?: string }} [choice]
 * @returns {string}
 */
export function formatPercent(share, choice = {}) {
  if (share === null || share === undefined || Number.isNaN(share)) return MISSING;
  const { decimals = 0, locale = LANGUAGE } = choice;
  return new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(share);
}

/**
 * Datum. Tar Date, tidsstämpel eller ISO-sträng.
 *
 * ⛔ `new Date("2026-09-15")` tolkas som midnatt i UTC, medan
 * `new Date("2026-09-15T00:00")` tolkas som lokal tid. I Sverige på sommaren
 * betyder det att ett rent datum kan visas som dagen innan. Därför behandlas
 * en ren datumsträng här som ett kalenderdatum utan tidszon.
 * @param {Date | number | string | null | undefined} value
 * @param {{ style?: "short" | "long" | "month", locale?: string }} [choice]
 * @returns {string}
 */
export function formatDate(value, choice = {}) {
  const d = toDate(value);
  if (!d) return MISSING;
  const { style = "short", locale = LANGUAGE } = choice;
  const pureDateString = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

  // ⛔ Annoteringen är inte kosmetik. Utan den vidgas "numeric" till `string`,
  // och då slutar typkontrollen märka om någon skriver "numerisk" eller
  // "2digit". Felet syns först som fel datumformat på skärmen.
  /** @type {Intl.DateTimeFormatOptions} */
  const options =
    style === "long"
      ? { year: "numeric", month: "long", day: "numeric" }
      : style === "month"
        ? { year: "numeric", month: "long" }
        : { year: "numeric", month: "2-digit", day: "2-digit" };
  if (pureDateString) options.timeZone = "UTC";
  return new Intl.DateTimeFormat(locale, options).format(d);
}

/**
 * Datum och klockslag.
 * @param {Date | number | string | null | undefined} value
 * @param {{ locale?: string }} [choice]
 * @returns {string}
 */
export function formatDateTime(value, choice = {}) {
  const d = toDate(value);
  if (!d) return MISSING;
  return new Intl.DateTimeFormat(choice.locale ?? LANGUAGE, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * Dag, månad och klockslag i lokal tid: "29 sep 09:12" (sv) eller "29 Sep 09:12" (en).
 *
 * ⛔ SAMMANSATT UR `formatToParts` OCH INTE UR `format()` (0.30.0, #173). Svenska
 * `Intl` skriver "29 sep. 09:12" med punkt efter månaden, engelska "29 Sept" i
 * vissa ICU-versioner, och exakt vilket beror på ICU-versionen, alltså på vilken
 * Node som råkar köra (samma lärdom som `NUMBER_SPACE`). Delarna sätts ihop här
 * så raden ser likadan ut överallt och ett test inte går sönder vid en
 * runtime-uppgradering.
 *
 * ⛔ LOKAL TIDSZON, MED FLIT. Ingen `timeZone` sätts: en händelse som skapades
 * 09:12 hos den som ser den ska stå 09:12 hos den som ser den. Ett värde utan
 * tidszon (`2026-09-29T09:12`) tolkas redan som lokal tid av `Date`.
 * @param {Date | number | string | null | undefined} value
 * @param {{ locale?: string }} [choice]
 * @returns {string}
 */
export function formatDagOchKlockslag(value, choice = {}) {
  const d = toDate(value);
  if (!d) return MISSING;
  const delar = new Intl.DateTimeFormat(choice.locale ?? LANGUAGE, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const del = (/** @type {string} */ typ) => (delar.find((p) => p.type === typ)?.value ?? "").replace(/\.$/, "");
  return `${del("day")} ${del("month")} ${del("hour")}:${del("minute")}`;
}

/**
 * Bara klockslaget: "11:57".
 *
 * ⛔ FINNS FÖR ATT SLIPPA SÄGA DAGEN TVÅ GÅNGER. CP 2026-09-25, om
 * aktivitetslistan: «Dubblerad tid. Rubriken "Idag" plus "i dag" på varje rad.»
 * Står raderna redan under en dagsrubrik är dagen sagd, och det raden saknar är
 * NÄR PÅ DAGEN. Med "i dag" på varje rad går två poster samma dag inte att
 * ordna, vilket är just det man vill veta.
 *
 * ⛔ TVÅ SIFFROR I BÅDA FÄLTEN, via `Intl`. "9:5" är inget klockslag, och
 * handskriven nollutfyllnad är precis det fel som syns först före klockan tio.
 *
 * @param {Date | number | string | null | undefined} value
 * @param {{ locale?: string }} [choice]
 * @returns {string}
 */
export function formatTime(value, choice = {}) {
  const d = toDate(value);
  if (!d) return MISSING;
  return new Intl.DateTimeFormat(choice.locale ?? LANGUAGE, { hour: "2-digit", minute: "2-digit" }).format(d);
}

/**
 * Ålder i ord: "i dag", "i går", "för 3 dagar sedan".
 *
 * ⛔ Finns för att en siffra utan ålder alltid läses som färsk. Det är den
 * enskilt vanligaste tysta lögnen i en översiktsvy: talet stod där i morse,
 * står där nu, och ingenting säger att källan slutade svara i tisdags.
 *
 * ⛔ Går via `Intl.RelativeTimeFormat`, inte via egna strängar. "för 1 dagar
 * sedan" är precis den sortens fel handskriven pluralisering ger, och den syns
 * bara vid vissa värden.
 *
 * ⛔ Räknar i KALENDERDAGAR, inte i dygn om 24 timmar. Något som hände 23:50 i
 * går är "i går" klockan 00:10, inte "i dag". Skillnaden är hela skälet att
 * texten finns: den ska stämma med vad läsaren själv skulle kalla det.
 *
 * @param {Date | number | string | null | undefined} value
 * @param {{ locale?: string, now?: Date | number | string }} [choice]
 * @returns {string}
 */
export function formatRelativeDate(value, choice = {}) {
  const d = toDate(value);
  if (!d) return MISSING;
  const nu = toDate(choice.now ?? Date.now());
  if (!nu) return MISSING;
  const locale = choice.locale ?? LANGUAGE;

  const days = Math.round((midnight(d) - midnight(nu)) / 86400000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (Math.abs(days) < 1) return rtf.format(0, "day");
  if (Math.abs(days) < 30) return rtf.format(days, "day");
  if (Math.abs(days) < 365) return rtf.format(Math.round(days / 30), "month");
  return rtf.format(Math.round(days / 365), "year");
}

/** @param {Date} d @returns {number} */
function midnight(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * @param {Date | number | string | null | undefined} value
 * @returns {Date | null}
 */
function toDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
