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
 * ⛔ EXPORTERAS SEDAN 0.250.0 SOM `OpsTillbakaKnapp` (cllp/lifehub.app#933). Här stod att knappen var intern, eftersom panelerna var det man
 * importerade. Sedan kom ett ärende som öppnas i appens egen vy: CP 2026-11-21, "öppna ärendet ... i sin egna vy, men med en pil tillbaka".
 * Vyn är appens, eftersom ärendet är appens data. Utan exporten hade appen fått skriva en egen kopia av knappen, och två kopior glider isär
 * (punkt 2). Panelerna använder den fortfarande inifrån, oförändrad.
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

/**
 * Den exporterade knappen (0.250.0, cllp/lifehub.app#933). ⛔ UTAN `className`: ramverkets komponenter har ett stängt API (README, "Alla har ett
 * stängt API"), och panelerna som behöver flytta knappen gör det inifrån med `TillbakaKnapp`. En app som fick en klass hade kunnat göra
 * knappen till något annat än panelernas knapp, och då är vi tillbaka i två knappar.
 *
 * @param {{ onClick: () => void, etikett: string }} props
 */
export function OpsTillbakaKnapp({ onClick, etikett }) {
  return <TillbakaKnapp onClick={onClick} etikett={etikett} />;
}
