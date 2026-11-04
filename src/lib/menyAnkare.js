/**
 * Var en meny förankras och hur mycket av fönstrets underkant bottenraden täcker (0.185.0, `OpsAtgardsblad`).
 *
 * Händelsen: CP 2026-11-04, lifehub.app v1.0.1114, Ärenden på telefon. Menyn för ett ärendekort öppnades under hela kortet och
 * täckte nästa kort, eller hamnade bakom bottenraden, eftersom rutan förankrades vid hela raden och bottenraden ligger ovanpå sidan.
 */

/**
 * En punkt i raden som en rektangel utan storlek, i fönstrets koordinater: där fingret höll in.
 * @param {{ left: number, top: number }} rad Radens rektangel just nu (följer med när sidan rullar).
 * @param {{ x: number, y: number }} punkt Punkten relativt raden.
 */
export function punktRekt(rad, punkt) {
  const x = rad.left + punkt.x;
  const y = rad.top + punkt.y;
  return { x, y, left: x, top: y, right: x, bottom: y, width: 0, height: 0, toJSON: () => ({}) };
}

/**
 * Hur många px av fönstrets underkant bottenraden täcker, med mikrofonen som sticker upp ur den. 0 när raden inte syns
 * (bred skärm, tangentbordet uppe, en vy utan skal). Raden mäts, så en ändrad höjd följer med.
 * @param {Document} [doc] @param {Window} [win]
 */
export function bottenReservPx(doc = typeof document === "undefined" ? undefined : document, win = typeof window === "undefined" ? undefined : window) {
  if (!doc || !win) return 0;
  const nav = doc.querySelector("[data-ops-bottenrad]");
  if (!nav) return 0;
  const stil = win.getComputedStyle(nav);
  if (stil.display === "none" || stil.visibility === "hidden") return 0;
  let topp = nav.getBoundingClientRect().top;
  for (const el of nav.querySelectorAll("a, button")) {
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.top < topp) topp = r.top;
  }
  const under = win.innerHeight - topp;
  return under > 0 ? Math.round(under) : 0;
}
