/**
 * Presentationen av en PDF, sida för sida (0.193.0, cllp/ops-framework#530): sidbytet, tangenterna, klicket, svepet och skalan. Utan pdf.js och utan React, så att reglerna går att pröva var för sig.
 *
 * ⛔ BARA DEN LATA VYN (`OpsPdfVisning`) LÄSER FILEN. Den låg först i `lib/pdfvisning.js`, som Biblioteket importerar, och växte då en startfil som importerar `OpsBibliotek` med regler för en vy som kanske aldrig öppnas.
 */

// ── Sidbytet och presentationen ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Sidan efter ett steg, inom 1 och `antal`. Ett steg förbi första eller sista sidan stannar där: presentationen börjar inte om och går inte till en sida som inte finns.
 * @param {number} sida
 * @param {number} antal
 * @param {number} steg
 * @returns {number}
 */
export function bytSida(sida, antal, steg) {
  if (!(antal >= 1)) return 1;
  const nasta = Math.round(sida) + Math.round(steg);
  return Math.min(antal, Math.max(1, Number.isFinite(nasta) ? nasta : 1));
}

/**
 * Vad en tangent gör i presentationen: ett steg framåt eller bakåt, första eller sista sidan, avsluta, eller ingenting (`null`).
 *
 * Framåt: pil höger, pil ned, mellanslag, PageDown och Enter. Bakåt: pil vänster, pil upp, Skift+mellanslag och PageUp. Home och End går till första och sista sidan. Esc avslutar.
 * En tangent med Ctrl, Cmd eller Alt gör ingenting här: den hör till webbläsaren.
 *
 * @param {{ key: string, shiftKey?: boolean, ctrlKey?: boolean, metaKey?: boolean, altKey?: boolean }} e
 * @returns {1 | -1 | "forsta" | "sista" | "avsluta" | null}
 */
export function tangentIPresentation(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  switch (e.key) {
    case "ArrowRight":
    case "ArrowDown":
    case "PageDown":
    case "Enter":
      return 1;
    case " ":
    case "Spacebar":
      return e.shiftKey ? -1 : 1;
    case "ArrowLeft":
    case "ArrowUp":
    case "PageUp":
      return -1;
    case "Home":
      return "forsta";
    case "End":
      return "sista";
    case "Escape":
    case "Esc":
      return "avsluta";
    default:
      return null;
  }
}

/** Ett svep är minst så här långt i sidled, i CSS-pixlar. Kortare är ett tryck. */
export const SVEP_MIN = 50;

/**
 * Vad ett svep gör: åt vänster är nästa sida, åt höger föregående. Ett svep som går mer uppåt eller nedåt än åt sidan, eller är kortare än `SVEP_MIN`, gör ingenting (`0`).
 * @param {number} dx Fingrets väg i sidled, positivt åt höger.
 * @param {number} dy Fingrets väg i höjdled.
 * @returns {1 | -1 | 0}
 */
export function svepSteg(dx, dy) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return 0;
  if (Math.abs(dx) < SVEP_MIN || Math.abs(dx) <= Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}

/**
 * Vad ett klick gör i presentationen: i vänstra tredjedelen föregående sida, annars nästa. Som ett bildspel där man klickar sig framåt, med en väg tillbaka utan tangentbord.
 * @param {number} x Klickets läge i sidled, från ytans vänsterkant.
 * @param {number} bredd Ytans bredd.
 * @returns {1 | -1}
 */
export function klickSteg(x, bredd) {
  return bredd > 0 && x < bredd / 3 ? -1 : 1;
}

/**
 * Skalan som gör att sidan ryms på skärmen i presentationen, både i bredd och höjd. Den får förstora: en sida i presentation ska fylla skärmen.
 * @param {{ bredd: number, hojd: number }} sida Sidans mått vid skala 1.
 * @param {{ bredd: number, hojd: number }} yta Skärmens eller fönstrets mått.
 * @returns {number}
 */
export function skarmSkala(sida, yta) {
  if (!(sida.bredd > 0) || !(sida.hojd > 0) || !(yta.bredd > 0) || !(yta.hojd > 0)) return 1;
  return Math.min(yta.bredd / sida.bredd, yta.hojd / sida.hojd);
}

/** Så länge sidnumret syns efter ett sidbyte i presentationen, i millisekunder. */
export const SIDNUMMER_MS = 1500;
