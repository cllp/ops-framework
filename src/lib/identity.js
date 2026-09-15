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
export const ANTAL_IDENTITETSTONER = 6;

/**
 * @param {string} seed Stabilt id, till exempel ett dokument-id. Inte ett namn.
 * @returns {number} 1 till och med ANTAL_IDENTITETSTONER
 */
export function identityTone(seed) {
  const text = String(seed ?? "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 100000007;
  }
  return (hash % ANTAL_IDENTITETSTONER) + 1;
}

/**
 * Initialer ur ett namn. Max två tecken.
 *
 * Använder Intl.Segmenter när den finns, eftersom `name[0]` klipper mitt i en
 * emoji eller ett tecken utanför BMP och ger en trasig ruta i stället för en
 * bokstav.
 *
 * @param {string} namn
 * @returns {string}
 */
export function initials(namn) {
  const rent = String(namn ?? "").trim();
  if (!rent) return "?";
  const ord = rent.split(/\s+/).slice(0, 2);
  return ord.map((o) => forstaTecknet(o)).join("").toUpperCase() || "?";
}

/** @param {string} text @returns {string} */
function forstaTecknet(text) {
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    for (const s of seg.segment(text)) return s.segment;
    return "";
  }
  return [...text][0] ?? "";
}
