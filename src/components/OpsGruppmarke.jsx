import { OpsIdentity } from "./OpsIdentity.jsx";
import { text } from "../lib/sprak.js";

/**
 * Gruppens märke på en rad, i läget "alla".
 *
 * ⛔ MÄRKET ÄR IDENTITET OCH INTE STATUS, alltså `OpsIdentity` och inte
 * `OpsPill`. Ett piller bär betydelse ur sin färg (`success`, `danger`), och
 * ett grönt märke på en grupp hade lärt läsaren att grönt inte betyder något.
 * Se noten överst i `OpsPill`.
 *
 * ⛔ NAMNET SKRIVS UT, INTE BARA INITIALERNA. Två grupper som börjar på samma
 * bokstav får samma initialer, och tonen är sex färger för hur många grupper
 * som helst. Initialer plus färg är igenkänning, inte identifikation.
 *
 * ⛔ OCH MÄRKET RITAS BARA I LÄGET "alla". Står jag i en grupp säger märket
 * samma sak på varje rad, och en upplysning som upprepas på varje rad läses
 * inte på någon av dem. Det är anroparens val, alltså ritar den här
 * komponenten alltid när den anropas.
 */

/**
 * @param {object} props
 * @param {{ id: string, namn: import("../lib/sprak.js").Namn }} props.gruppmarke Ur `slaIhopSvar`.
 * @param {string} [props.sprak]
 */
export function OpsGruppmarke({ gruppmarke, sprak }) {
  if (!gruppmarke || typeof gruppmarke.id !== "string" || !gruppmarke.id) {
    throw new Error("OpsGruppmarke: gruppmarke krävs, med id och namn. Det sätts av slaIhopSvar och lagras aldrig på raden.");
  }
  const namn = text(gruppmarke.namn, sprak);
  return (
    <span className="inline-flex items-center gap-1.5 text-meta text-ink-secondary">
      <OpsIdentity name={namn} seed={gruppmarke.id} size="sm" />
      {namn}
    </span>
  );
}
