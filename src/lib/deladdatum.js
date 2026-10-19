import { RESERVSPRAK, SPRAK } from "./sprak.js";

/**
 * Datum, tid och språk på den publika händelsesidan (0.125.0, cllp/lifehub.app#377).
 *
 * ══ ⛔ VARFÖR DATUMEN SKRIVS UT HÄR OCH INTE MED `Intl` ═══════════════════════════════════════════════════════════
 *
 * CP 2026-10-19: "Det skall vara tydligt på händelsen, vilka datum det gäller." Sidan visar datumet som `lör 26 dec 2026` på svenska och
 * `Sat 26 Dec 2026` på engelska. `Intl.DateTimeFormat` ger `lör 26 dec. 2026` (med punkt) i ena versionen av ICU och utan i den andra, och ett
 * engelskt datum med komma i vissa versioner. En mottagares webbläsare är inte vår: formen ska vara densamma överallt, och ett prov
 * kan bara mäta det som inte beror på maskinen. Veckodagen räknas ur datumet som en kalenderdag i UTC (samma fälla som `langtDatum`:
 * `new Date("2026-12-26")` är midnatt UTC, och i en annan zon hade samma sträng blivit dagen innan).
 *
 * ══ ⛔ SPRÅKET ÄR BESÖKARENS, INTE APPENS ═════════════════════════════════════════════════════════════════════════
 *
 * En besökare har ingen profil. Förvalet är webbläsarens språk (svenska om det börjar på `sv`, annars engelska), valet i sidhuvudet sparas
 * i webbläsarens minne, och bara ramverkets egen text följer valet. Händelsens titel och beskrivning är den som skrev dem och översätts
 * inte. Lagringen kan saknas (privat läge, blockerad) eller kasta: sidan ritas ändå, på det språk webbläsaren har.
 */

/** Nyckeln språkvalet sparas under i webbläsarens minne. */
export const DELAD_SPRAKNYCKEL = "ops-delad-sprak";

/** @type {Record<"sv" | "en", readonly string[]>} */
const VECKODAG = {
  sv: ["sön", "mån", "tis", "ons", "tors", "fre", "lör"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};
/** @type {Record<"sv" | "en", readonly string[]>} */
const MANAD = {
  sv: ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

/** @param {string} sprak @returns {"sv" | "en"} */
const spr = (sprak) => (sprak === "en" ? "en" : "sv");

/**
 * Webbläsarens språk som ett av våra: svenska om det börjar på `sv` (sv, sv-SE, sv-FI), annars engelska. Okänt eller saknat är engelska,
 * eftersom en besökare vars språk vi inte känner hellre läser engelska än svenska.
 *
 * @param {unknown} webblasare `navigator.language`.
 * @returns {"sv" | "en"}
 */
export function webblasarSprak(webblasare) {
  return typeof webblasare === "string" && /^sv(?:$|[-_])/i.test(webblasare.trim()) ? "sv" : "en";
}

/**
 * Språket sidan ritas på: det sparade om det är ett av våra, annars webbläsarens.
 *
 * @param {{ sparat?: unknown, webblasare?: unknown }} d
 * @returns {"sv" | "en"}
 */
export function valdSprak(d) {
  const sparat = d?.sparat;
  if (typeof sparat === "string" && /** @type {readonly string[]} */ (SPRAK).includes(sparat)) return /** @type {"sv" | "en"} */ (sparat);
  return webblasarSprak(d?.webblasare);
}

/**
 * Det sparade språkvalet, eller `null`. Kastar aldrig.
 * @param {{ getItem: (k: string) => string | null } | null | undefined} [lagring]
 * @returns {string | null}
 */
export function lasSparatSprak(lagring) {
  try {
    const l = lagring === undefined ? globalThis.localStorage : lagring;
    return l ? l.getItem(DELAD_SPRAKNYCKEL) : null;
  } catch {
    return null;
  }
}

/**
 * Sparar språkvalet. Svarar om det gick, och kastar aldrig: ett val som inte kan sparas gäller ändå tills sidan lämnas.
 * @param {string} sprak
 * @param {{ setItem: (k: string, v: string) => void } | null | undefined} [lagring]
 * @returns {boolean}
 */
export function sparaSprak(sprak, lagring) {
  if (!(/** @type {readonly string[]} */ (SPRAK).includes(sprak))) return false;
  try {
    const l = lagring === undefined ? globalThis.localStorage : lagring;
    if (!l) return false;
    l.setItem(DELAD_SPRAKNYCKEL, sprak);
    return true;
  } catch {
    return false;
  }
}

/** @param {string} datum @returns {Date | null} */
function dag(datum) {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datum);
  if (!d) return null;
  const t = new Date(Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3])));
  return Number.isNaN(t.getTime()) ? null : t;
}

/**
 * Ett datum `YYYY-MM-DD` som `lör 26 dec 2026` (svenska) eller `Sat 26 Dec 2026` (engelska). Ett datum som inte går att läsa returneras som det är.
 *
 * @param {string} datum
 * @param {string} [sprak]
 * @returns {string}
 */
export function kortDatum(datum, sprak = RESERVSPRAK) {
  const t = dag(datum);
  if (!t) return datum;
  const s = spr(sprak);
  return `${VECKODAG[s][t.getUTCDay()]} ${t.getUTCDate()} ${MANAD[s][t.getUTCMonth()]} ${t.getUTCFullYear()}`;
}

/**
 * Antalet kalenderdagar från `datum` till `slutDatum`, båda inklusive: 26 dec till 10 jan är 16 dagar. 0 när något inte går att läsa eller slutet inte är efter början.
 *
 * @param {string} datum
 * @param {string} slutDatum
 * @returns {number}
 */
export function antalDagar(datum, slutDatum) {
  const a = dag(datum);
  const b = dag(slutDatum);
  if (!a || !b || b <= a) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
}

/**
 * @typedef {object} DeladTid
 * @property {string} datum `YYYY-MM-DD`.
 * @property {string | null} [slutDatum] Sista dagen, inklusive.
 * @property {string | null} [tid] `HH:MM`.
 * @property {string | null} [slutTid] `HH:MM`.
 * @property {boolean} [heldag]
 */

/**
 * Det som står om när en händelse är: `start`, `slut` (bara över flera dagar), `dagar` ("16 dagar", bara över flera dagar) och `tid`
 * ("Heldag", "09:00 - 17:00", "kl 09:00", eller en tom sträng när händelsen saknar klockslag).
 *
 * ⛔ ÖVER FLERA DAGAR HÖR KLOCKSLAGEN TILL FÖRSTA OCH SISTA DAGEN och står som det ("börjar kl 22:00, slutar kl 02:00"): "22:00 - 02:00" läses som ett
 * klockslag varje dag. Ett bindestreck och inte tankstreck (arbetsreglernas punkt 6).
 *
 * @param {DeladTid} h
 * @param {string} [sprak]
 * @returns {{ start: string, slut: string, dagar: string, tid: string }}
 */
export function deladTid(h, sprak = RESERVSPRAK) {
  const s = spr(sprak);
  const n = typeof h.slutDatum === "string" ? antalDagar(h.datum, h.slutDatum) : 0;
  const flera = n > 1;
  const sv = s === "sv";
  let tid = "";
  if (h.heldag === true) tid = sv ? "Heldag" : "All day";
  else if (h.tid && h.slutTid) {
    tid = flera ? (sv ? `börjar kl ${h.tid}, slutar kl ${h.slutTid}` : `starts at ${h.tid}, ends at ${h.slutTid}`) : `${h.tid} - ${h.slutTid}`;
  } else if (h.tid) {
    tid = flera ? (sv ? `börjar kl ${h.tid}` : `starts at ${h.tid}`) : sv ? `kl ${h.tid}` : `at ${h.tid}`;
  }
  return {
    start: kortDatum(h.datum, s),
    slut: flera && typeof h.slutDatum === "string" ? kortDatum(h.slutDatum, s) : "",
    dagar: flera ? (sv ? `${n} dagar` : `${n} days`) : "",
    tid,
  };
}
