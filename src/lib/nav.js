/**
 * Delade regler för navigeringen: validering av nav-kontraktet och matchning av
 * aktiv post. Både OpsAppShell (toppraden) och OpsBottomNav (bottenraden) läser
 * härifrån, så att "vad räknas som aktivt" har EN definition och inte två som
 * glider isär.
 *
 * Nav-kontraktet:
 *   { href, label, icon?, badge?, children?: { href, label }[] }
 * EN nivå barn, aldrig fler. Se issue #1 för varför djupare hierarki är en egen
 * vy, inte en djupare meny.
 */

/**
 * @typedef {object} NavPost
 * @property {string} href
 * @property {string} label
 * @property {import("react").ReactNode} [icon] Krävs i praktiken för bottenraden.
 * @property {number} [badge] Oläst, att göra, vad appen nu räknar.
 * @property {{ href: string, label: string }[]} [children] EN nivå, aldrig fler.
 */

/**
 * Kastar med förklarande text om nav har fel form. `children` som själv
 * innehåller `children` failar direkt — begränsningen "en nivå" är bara verklig
 * om den vaktas, inte om den står i en kommentar.
 *
 * @param {any} nav
 * @param {string} component Namnet som ska stå i felmeddelandet.
 */
export function validateNav(nav, component) {
  if (!Array.isArray(nav)) {
    throw new Error(`${component}: nav krävs och måste vara en lista av { href, label }.`);
  }
  for (const entry of nav) {
    if (!entry || typeof entry.href !== "string" || typeof entry.label !== "string") {
      throw new Error(`${component}: varje nav-post måste ha href och label som strängar.`);
    }
    if (entry.children === undefined) continue;
    if (!Array.isArray(entry.children)) {
      throw new Error(`${component}: nav-postens children måste vara en lista av { href, label }.`);
    }
    for (const children of entry.children) {
      if (!children || typeof children.href !== "string" || typeof children.label !== "string") {
        throw new Error(`${component}: varje barn i children måste ha href och label som strängar.`);
      }
      if (children.children !== undefined) {
        throw new Error(
          `${component}: nav får ha EN nivå barn. Posten "${children.label}" ligger i children och har själv children. ` +
            "En meny djupare än så hittar ingen i, och det finns ingen telefon där nivå tre är rätt. " +
            "Vill du ha djupare hierarki är svaret en egen vy, inte en djupare meny.",
        );
      }
    }
  }
}

/**
 * Sant om posten är den aktiva sidan, inklusive när en av dess undersidor är
 * aktiv (så att ett avsnitt markeras när man står på en av dess undersidor).
 *
 * @param {{ href: string, children?: { href: string }[] }} entry
 * @param {string} activeHref
 * @returns {boolean}
 */
export function entryActive(entry, activeHref) {
  if (entry.href === activeHref) return true;
  if (Array.isArray(entry.children)) {
    return entry.children.some((children) => children.href === activeHref);
  }
  return false;
}
