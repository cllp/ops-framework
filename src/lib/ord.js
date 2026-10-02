import { RESERVSPRAK, SPRAK } from "./sprak.js";

/**
 * Ramverkets egna förvalda texter på flera språk (0.46.0, cllp/bolag-ops#528).
 *
 * ══ ⛔ HÄNDELSEN ═════════════════════════════════════════════════════════
 *
 * CP 2026-10-01: "Har noterat att byta språk i profil inte byter språk. Se till att allt är språkhanterat, svenska engelska."
 * Mätt samma morgon: profilen sparade språket i `users/{uid}.sprak`, och INGENTING läste det. Varje komponent hade sina etiketter som
 * svenska förval i parameterlistan (`menuLabel = "Meny"`), och de som tog ett språk hade `sprak = "sv"`. Språket i profilen var alltså
 * ett fält utan läsare.
 *
 * ⛔ EN ORDBOK PER KOMPONENT, BREDVID KOMPONENTEN, och den är den enda källan till förvalen (arbetsreglernas punkt 2). Den svenska
 * texten står där och ingen annanstans: en komponent som bar sitt svenska förval kvar i parameterlistan hade haft två sanningar.
 *
 * ⛔ APPENS EGNA ETIKETTER VINNER ALLTID. En app som skickar `menuLabel="Huvudmeny"` får det, på vilket språk som helst. Ordboken fyller
 * bara i det appen lämnat tomt.
 *
 * @typedef {Record<string, { sv: string, en: string }>} Ordbok
 */

/**
 * Förvalen ur en ordbok på ett språk. Ett språk utan text i ordboken ger svenska, som är reserven (`RESERVSPRAK`).
 *
 * @param {Ordbok} ordbok
 * @param {string} sprak
 * @returns {Record<string, string>}
 */
export function forvalda(ordbok, sprak) {
  const sp = SPRAK.includes(/** @type {any} */ (sprak)) ? sprak : RESERVSPRAK;
  /** @type {Record<string, string>} */
  const ut = {};
  for (const [nyckel, texter] of Object.entries(ordbok)) ut[nyckel] = /** @type {any} */ (texter)[sp] || texter[RESERVSPRAK];
  return ut;
}

/**
 * Props utan de som är `undefined`, så att en utelämnad etikett inte skriver över ordbokens förval när de sprids ihop.
 *
 * ⛔ TYPEN ÄR `T` OCH INTE `Partial<T>`: bara nycklar vars värde redan VAR `undefined` tas bort, så ett obligatoriskt fält som appen gav
 * står kvar. `Partial` hade fått typkontrollen att tro att obligatoriska props kan saknas.
 *
 * @template {Record<string, any>} T
 * @param {T} props
 * @returns {T}
 */
export function definierade(props) {
  /** @type {Record<string, any>} */
  const ut = {};
  for (const [k, v] of Object.entries(props)) if (v !== undefined) ut[k] = v;
  return /** @type {T} */ (ut);
}

/**
 * Ett ord ur en ordbok på ett språk, för text som en komponent ritar SJÄLV och som inte är ett förval appen kan byta (en växlares
 * etikett, ett laddningsläge). Samma reserv som `forvalda`: svenska.
 *
 * @param {Ordbok} ordbok
 * @param {string} nyckel
 * @param {string} sprak
 */
export function ordet(ordbok, nyckel, sprak) {
  const t = ordbok[nyckel];
  if (!t) throw new Error(`ordet: nyckeln ${JSON.stringify(nyckel)} finns inte i ordboken. Ett ord som saknas ska bli ett fel här, inte en tom etikett på skärmen.`);
  return (/** @type {any} */ (t))[sprak] || t[RESERVSPRAK];
}
