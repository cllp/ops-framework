/**
 * Modulens hjälpavsnitt (0.92.1).
 *
 * ══ ⛔ HJÄLPEN HAR TVÅ LAGER ═══════════════════════════════════════════════
 *
 * CP 2026-10-10: hjälpen i appen ska ha grundfunktioner (ramverkets) och ett
 * avsnitt per installerad app. Texten för en app ägs av modulen och följer med
 * den. En avinstallerad app visar inget avsnitt.
 *
 * ⛔ DET HÄR ÄR INTE `kallor.hjalp`. Källan `hjalp` är den korta förklaringen
 * bakom frågetecknet på en sida (`OpsModulHjalp`). Fältet `hjalp` på
 * manifestet är FAQ-avsnitten på hjälpsidan. Två jobb, två former, ett namn
 * för att båda handlar om hjälp.
 *
 * ⛔ VALFRITT I MANIFESTET, `null` NÄR DET SAKNAS. En tom lista hade varit
 * "modulen har hjälp men inga frågor", och det är inte ett svar någon vill ha.
 * Utan fält: ingen sektion. Med fält: minst ett avsnitt.
 */

import { ID_FORM } from "./katalog.js";

/** Tak, samma storleksordning som kopplingar. */
export const MAX_HJALP_AVSNITT = 24;

/** Fält manifestets `hjalp` får bära. */
export const HJALPFALT = /** @type {const} */ (["rubrik", "avsnitt"]);

/** Fält ett avsnitt får bära. */
export const HJALPAVSNITTSFALT = /** @type {const} */ (["id", "fraga", "svar", "sokord"]);

/**
 * @typedef {object} HjalpAvsnitt
 * @property {string} id Stabil nyckel. Djuplänk och lagringsnyckel.
 * @property {string} fraga Rubriken i listan.
 * @property {string} svar Markdown. Samma sträng söks och ritas.
 * @property {ReadonlyArray<string>} sokord Extra ord sökningen träffar på.
 */

/**
 * @typedef {object} ModulHjalp
 * @property {string} rubrik Sektionens namn på hjälpsidan.
 * @property {ReadonlyArray<HjalpAvsnitt>} avsnitt
 */

/** @param {unknown} v @returns {string} */
const rensa = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * Bygger modulens hjälp, eller kastar med skälet.
 *
 * Utelämnat fält blir `null`. En tom lista eller ett objekt utan avsnitt kastas:
 * det är ett löfte om hjälp utan innehåll.
 *
 * @param {unknown} varde
 * @param {(falt: string, skal: string) => Error} var_
 * @returns {ModulHjalp | null}
 */
export function byggModulHjalp(varde, var_) {
  if (varde === undefined || varde === null) return null;
  if (!varde || typeof varde !== "object" || Array.isArray(varde)) {
    throw var_("hjalp", `måste vara { rubrik, avsnitt }, inte ${Array.isArray(varde) ? "en lista" : typeof varde}. Utelämna fältet om modulen inte har hjälp.`);
  }
  const d = /** @type {Record<string, unknown>} */ (varde);
  const okanda = Object.keys(d).filter((n) => !/** @type {readonly string[]} */ (HJALPFALT).includes(n));
  if (okanda.length > 0) {
    throw var_(`hjalp.${okanda[0]}`, `känns inte igen. Ett hjälpfält bär ${HJALPFALT.join(", ")}.`);
  }

  const rubrik = rensa(d.rubrik);
  if (!rubrik) throw var_("hjalp.rubrik", "krävs. Det är namnet som står över modulens avsnitt på hjälpsidan.");

  if (!Array.isArray(d.avsnitt)) {
    throw var_("hjalp.avsnitt", `måste vara en lista, inte ${d.avsnitt === null ? "null" : typeof d.avsnitt}.`);
  }
  if (d.avsnitt.length === 0) {
    throw var_("hjalp.avsnitt", "får inte vara tom. Utelämna hjalp om modulen inte har något att säga.");
  }
  if (d.avsnitt.length > MAX_HJALP_AVSNITT) {
    throw var_("hjalp.avsnitt", `har ${d.avsnitt.length} poster. Taket är ${MAX_HJALP_AVSNITT}.`);
  }

  /** @type {HjalpAvsnitt[]} */
  const avsnitt = [];
  /** @type {Set<string>} */
  const sedda = new Set();
  d.avsnitt.forEach((/** @type {unknown} */ rad, /** @type {number} */ i) => {
    if (!rad || typeof rad !== "object" || Array.isArray(rad)) {
      throw var_(`hjalp.avsnitt[${i}]`, "måste vara { id, fraga, svar, sokord }.");
    }
    const a = /** @type {Record<string, unknown>} */ (rad);
    const okandaA = Object.keys(a).filter((n) => !/** @type {readonly string[]} */ (HJALPAVSNITTSFALT).includes(n));
    if (okandaA.length > 0) {
      throw var_(`hjalp.avsnitt[${i}].${okandaA[0]}`, `känns inte igen. Ett avsnitt bär ${HJALPAVSNITTSFALT.join(", ")}.`);
    }
    const id = rensa(a.id);
    if (!id) throw var_(`hjalp.avsnitt[${i}].id`, "krävs.");
    if (!ID_FORM.test(id)) {
      throw var_(`hjalp.avsnitt[${i}].id "${id}"`, "får bara innehålla små bokstäver, siffror, bindestreck och understreck.");
    }
    if (sedda.has(id)) {
      throw var_(`hjalp.avsnitt[${i}].id "${id}"`, "står två gånger. Djuplänken och lagringsnyckeln skulle peka på två svar.");
    }
    sedda.add(id);
    const fraga = rensa(a.fraga);
    if (!fraga) throw var_(`hjalp.avsnitt[${i}].fraga`, "krävs. Det är raden som syns i listan.");
    const svar = rensa(a.svar);
    if (!svar) throw var_(`hjalp.avsnitt[${i}].svar`, "krävs. Samma text ritas och söks, så en tom sträng ger en tom träff.");
    if (a.sokord === undefined) {
      throw var_(`hjalp.avsnitt[${i}].sokord`, "krävs, även när den är tom. Skriv sokord: [] när inga extra ord behövs.");
    }
    if (!Array.isArray(a.sokord)) {
      throw var_(`hjalp.avsnitt[${i}].sokord`, `måste vara en lista strängar, inte ${typeof a.sokord}.`);
    }
    const sokord = a.sokord.map((ord, j) => {
      const t = rensa(ord);
      if (!t) throw var_(`hjalp.avsnitt[${i}].sokord[${j}]`, "får inte vara tom.");
      return t;
    });
    avsnitt.push(Object.freeze({ id, fraga, svar, sokord: Object.freeze(sokord) }));
  });

  return Object.freeze({ rubrik, avsnitt: Object.freeze(avsnitt) });
}

/**
 * Hashen till en hjälpsektion: `#hjalp/<modulId>`.
 *
 * ⛔ `grund` ÄR RAMVERKETS ID för grundfunktionerna. En modul får inte heta så.
 *
 * @param {string} modulId
 * @returns {string}
 */
export function hjalpAnkare(modulId) {
  const id = rensa(modulId);
  if (!id) throw new Error("hjalpAnkare: modulId krävs.");
  return `#hjalp/${id}`;
}

/**
 * Full adress till hjälpsidan med ankare.
 *
 * @param {string} bas Till exempel `/hjalp`.
 * @param {string} modulId
 * @returns {string}
 */
export function hjalpAdress(bas, modulId) {
  const rot = rensa(bas) || "/hjalp";
  return `${rot}${hjalpAnkare(modulId)}`;
}

/**
 * Läser modul-id ur `location.hash` eller en hash-sträng.
 *
 * @param {string | null | undefined} hash
 * @returns {string | null} modul-id, eller null när hashen inte är ett hjälpankare.
 */
export function lasHjalpAnkare(hash) {
  const h = String(hash || "").replace(/^#/, "").trim();
  const m = /^hjalp\/([a-z0-9_-]+)$/.exec(h);
  return m ? m[1] : null;
}
