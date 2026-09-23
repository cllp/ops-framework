/**
 * Slår ihop klassnamn. Ramverksinternt, exporteras inte.
 *
 * ⛔ Den här funktionen finns medvetet BARA inuti ramverket. Exporterades den
 * skulle nästa steg vara att en app använder den för att sätta ihop en egen
 * knapp, och då är API:et öppet igen fast via en omväg.
 *
 * @param {...(string | false | null | undefined)} parts
 * @returns {string}
 */
export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}
