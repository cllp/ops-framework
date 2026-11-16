/**
 * Är en länk en adress i appen själv? (0.234.0, cllp/lifehub.app#860, L3)
 *
 * ══ ⛔ HÄNDELSEN ════════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-11-16 bad agenten om en länk till en låt i biblioteket: "Jag vill att agenten skall vara en riktig assistens i Life Hub. Ha
 * tillgång till allt och kunna skapa genvägar och länkar direkt till kanske att spela upp en låt eller visa en fil." Läst i koden: varje
 * länk i en text (`OpsMarkdown`) öppnades i en ny flik, också en länk till appen själv, och en relativ adress som `/bibliotek?...` blev
 * inte klickbar alls. CP om förslaget: "Kör snyggt".
 *
 * ⛔ EN RELATIV ADRESS RÄKNAS BARA NÄR DEN BÖRJAR MED ETT ENDA `/`. `//annan.se/x` är en adress till en annan värd (protokollrelativ), och
 * `/\annan.se` tolkas av webbläsare som samma sak. `javascript:`, `data:` och allt annat utan `/` först är aldrig en adress i appen.
 *
 * Ren, utan React och utan `window`: ursprunget skickas in.
 */

/** En relativ adress i appen: ett `/` följt av något som inte är `/` eller `\`, och inga blanksteg. */
const RELATIV = /^\/(?![/\\])[^\s]*$/;

/**
 * Sant för en relativ adress som säkert stannar i appen (`/bibliotek?plats=g&post=p`).
 * @param {unknown} url
 */
export function arRelativAppadress(url) {
  return typeof url === "string" && RELATIV.test(url);
}

/**
 * Adressen i appen (`/sökväg?fråga#ankare`) när länken är appens egen, annars `null`. En relativ adress är appens. En hel adress är det
 * när den har samma ursprung som appen.
 *
 * @param {unknown} url
 * @param {string | null | undefined} ursprung Appens ursprung, `window.location.origin`. Utan ursprung räknas bara relativa adresser.
 * @returns {string | null}
 */
export function appadress(url, ursprung) {
  if (typeof url !== "string" || url === "") return null;
  if (arRelativAppadress(url)) return url;
  if (!ursprung || !/^https?:\/\//i.test(url)) return null;
  try {
    const u = new URL(url);
    if (u.origin !== ursprung) return null;
    // ⛔ SAMMA URSPRUNG RÄCKER INTE (granskningen av 0.234.0): `https://<app>//evil.com/x`, `https://<app>/\evil.com` och
    // `https://<app>/..//evil.com` har appens ursprung men en sökväg som börjar med `//`, alltså en adress till en annan värd när den
    // används som `href` eller skickas till `onNavigate`. Resultatet prövas därför med samma regel som en relativ adress.
    const vag = `${u.pathname}${u.search}${u.hash}`;
    return arRelativAppadress(vag) ? vag : null;
  } catch {
    return null;
  }
}
