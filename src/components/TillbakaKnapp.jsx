import { cx } from "../lib/cx.js";
import { ChevronVansterIkon } from "./icons.jsx";

/**
 * Tillbaka-knappen i en PANEL: en textlänk med chevron, SS `GroupEditRouteView.jsx:41-47` (0.40.0, #214).
 *
 * ══ ⛔ EN KNAPP FÖR ALLA PANELER, INTE EN KOPIA I VARJE ═══════════════════════
 *
 * Skapa-panelen (`OpsSkapaPanel`) hade knappen skriven inline sedan 0.31.0, och händelsepanelen (`OpsHandelsePanel`) behöver
 * samma rad: samma chevron, samma 44 px träffyta, samma ord. Två handskrivna kopior hade glidit isär första gången någon
 * justerade den ena (arbetsreglernas punkt 2), och en panel som går tillbaka med en annan knapp än nästa säger olika saker om
 * samma gest. Klasserna flyttades hit oförändrade, så check-skalyta avsnitt 15 och 26 mäter fortfarande samma pixlar.
 *
 * ⛔ INTERN: den exporteras inte ur paketet. Panelerna är det man importerar, knappen är en detalj i dem.
 *
 * @param {{ onClick: () => void, etikett: string, className?: string }} props
 */
export function TillbakaKnapp({ onClick, etikett, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "-ml-2 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-base px-2 text-etikett text-ink-muted transition-colors duration-(--duration-fast) ease-standard hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
        className,
      )}
    >
      <ChevronVansterIkon size={20} />
      <span>{etikett}</span>
    </button>
  );
}
