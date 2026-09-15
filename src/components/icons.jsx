/**
 * De tre ikoner primitiverna själva behöver, inlagda som SVG.
 *
 * ⛔ Ramverket tar medvetet INTE ett ikonberoende. Ikonuppsättningen är ett val
 * appen gör (vi kör Lucide, se skillen), och ett ramverk som drar in ett helt
 * ikonbibliotek för tre pilar tvingar på alla konsumenter en dependency de inte
 * bad om. Tre SVG:er är billigare än den kopplingen.
 *
 * Alla är `aria-hidden`: ikonen är dekor, betydelsen sitter i texten bredvid
 * eller i komponentens aria-label.
 */

/** @param {{ size?: number }} props */
export function ChevronNedIkon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** @param {{ size?: number }} props */
export function KryssIkon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

/** @param {{ size?: number }} props */
export function BockIkon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
