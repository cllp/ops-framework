import { gruppikonNamn } from "./gruppikonarv.js";
import { GRUPPIKON_SVG } from "./gruppikonsvg.generated.js";

/**
 * En gruppikon som SVG-text, för en app utan React (0.70.0, lifehub.identity#27).
 *
 * ⛔ SAMMA IKON SOM KOMPONENTEN, INTE EN LIKNANDE. Innehållet är genererat ur `lucide-react` med `react-dom/server`
 * (`scripts/generate-gruppikoner.mjs`), och det yttre elementet har samma attribut som `gruppikonKomponent(namn)` ritar:
 * streckvikt 1,5, `currentColor` och `aria-hidden`. Provet `gruppmarke.test.jsx` jämför de två för varje ikon i katalogen.
 *
 * @param {string} namn Ett katalognamn eller ett äldre grupp- eller profil-id.
 * @param {number} [storlek] Bredd och höjd i px. Förval 20, som komponenten.
 * @returns {string} `<svg ...>...</svg>`, eller tom sträng när namnet inte är känt.
 */
export function gruppikonSvg(namn, storlek = 20) {
  const n = gruppikonNamn(namn);
  if (!n) return "";
  const s = Number.isFinite(storlek) && storlek > 0 ? Math.round(storlek) : 20;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GRUPPIKON_SVG[n]}</svg>`
  );
}
