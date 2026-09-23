/**
 * Identitetston och initialer.
 *
 * ⛔ Tonen måste vara deterministisk ur ett stabilt id, aldrig slumpad och
 * aldrig härledd ur namnet. Slumpas den byter samma grupp färg mellan två
 * renderingar, och härleds den ur namnet byter gruppen färg den dag någon
 * rättar en stavning. Båda gör färgen oanvändbar som igenkänning, vilket är
 * hela poängen med den.
 */

/** Antalet toner i tokenkontraktet (`--color-identity-1` .. `-6`). */
export const IDENTITY_TONE_COUNT = 6;

/**
 * ⛔ Returtypen är en union och inte `number`. Det gör att uppslaget i
 * primitivernas tonkarta typkontrolleras exakt: lägger någon till en sjunde ton
 * utan att utöka kartan blir det ett fel i editorn, i stället för ett element
 * som tyst renderas utan bakgrundsfärg.
 *
 * @param {string} seed Stabilt id, till exempel ett dokument-id. Inte ett namn.
 * @returns {1|2|3|4|5|6}
 */
export function identityTone(seed) {
  const text = String(seed ?? "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 100000007;
  }
  return /** @type {1|2|3|4|5|6} */ ((hash % IDENTITY_TONE_COUNT) + 1);
}

/**
 * Initialer ur ett namn. Max två tecken.
 *
 * Använder Intl.Segmenter när den finns, eftersom `name[0]` klipper mitt i en
 * emoji eller ett tecken utanför BMP och ger en trasig ruta i stället för en
 * bokstav.
 *
 * @param {string} name
 * @returns {string}
 */
export function initials(name) {
  const clean = String(name ?? "").trim();
  if (!clean) return "?";
  const word = clean.split(/\s+/).slice(0, 2);
  return word.map((o) => firstChar(o)).join("").toUpperCase() || "?";
}

/** @param {string} text @returns {string} */
function firstChar(text) {
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    for (const s of seg.segment(text)) return s.segment;
    return "";
  }
  return [...text][0] ?? "";
}
