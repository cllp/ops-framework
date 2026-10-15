/**
 * Elementet som har fokus, som en kort rad att skriva i ett felmeddelande.
 *
 * ⛔ Ett felmeddelande får inte bära elementets hela text (#389). När fokus hamnade på `body` skrev valen-efter-talet-mätningen ut
 * hela dokumentets `textContent`, inklusive den inbäddade bundlen: 5,8 MB på en rad, som dolde det enda som skulle läsas (att fokus
 * stod på body). Taggnamnet säger vilket element det är, och de första tecknen av texten säger vilket av dem.
 */

/** Hur många tecken av texten som följer med. */
export const FOKUS_TECKEN = 60;

/**
 * @param {string | null | undefined} tagg elementets `tagName`, eller tomt när inget element har fokus
 * @param {string | null | undefined} text elementets text (får vara hela dokumentets)
 * @returns {string} till exempel `button "Meddelande"`, `body "Boka rep med bandet. Ta me…"` eller `inget element`
 */
export function fokusKort(tagg, text) {
  if (!tagg) return "inget element";
  const ren = (text ?? "").trim();
  const bit = ren.length > FOKUS_TECKEN ? `${ren.slice(0, FOKUS_TECKEN)}…` : ren;
  return `${tagg.toLowerCase()} ${JSON.stringify(bit)}`;
}
