import { useLayoutEffect } from "react";
import { cx } from "../lib/cx.js";
import { PlusIkon } from "./icons.jsx";
import { flytandeSkapaSyns, useDialogOppen } from "../lib/flytandeSkapa.js";
import { useTangentbordUppe } from "../lib/tangentbord.js";

/**
 * Den flytande Skapa-knappen (ej utgivet, cllp/lifehub.app#582). Internt för `OpsAppShell`, inte i det publika API:et: appen slår på den
 * med skalets `flytandeSkapa`. Beslutet om den ritas bor i `src/lib/flytandeSkapa.js` (läs filhuvudet där för händelsen).
 *
 * ⛔ DEN TAR SIN PLATS (regel 3 i CP:s beslut). Medan knappen syns står `--flytande-skapa-h` på <html> och `OpsAppShell`s `main` lägger
 * den ovanpå sin `padding-bottom`, så sista raden går att rulla fram ovanför knappen. Går knappen undan tas måttet bort med den.
 * Samma mönster som `--spelrad-h` (`OpsSpelare`). Måttet är storlek plus luft ur `tokens.css`, inte en mätning: knappen har fast storlek.
 *
 * ⛔ INGEN GÖM-VID-RULLNING. Den försvinner inte när man rullar och kommer inte tillbaka när man slutar: en knapp som rör sig är en
 * knapp man missar med tummen, och den som hade den i handen för en sekund sedan hittar den inte (CP:s beslut 2026-11-02).
 *
 * ⛔ Knappen ligger ovanför spelraden (`--spelrad-h`) och bottenraden (`--bottom-nav-h`, 0 medan tangentbordet är uppe), under dialoger
 * (`--z-chrome` mot `--z-overlay`). Från 768 px finns den inte (`md:hidden`): där har huvudet ett plus.
 *
 * @param {{ mojlig: boolean, panelOppen: boolean, talkLage: string, onOppna: () => void, label: string }} props
 *   `mojlig`: appen har slagit på knappen för vyn och skalet har en lista att öppna. `onOppna` är SAMMA funktion som mikrofonens långtryck.
 */
export function OpsFlytandeSkapa({ mojlig, panelOppen, talkLage, onOppna, label }) {
  const tangentbordUppe = useTangentbordUppe();
  const dialogOppen = useDialogOppen(mojlig);
  const syns = flytandeSkapaSyns({ pa: mojlig, tangentbordUppe, panelOppen, dialogOppen, talkLage });

  useLayoutEffect(() => {
    if (!syns || typeof document === "undefined") return undefined;
    const rot = document.documentElement;
    rot.style.setProperty("--flytande-skapa-h", "calc(var(--flytande-skapa-storlek) + var(--flytande-skapa-luft))");
    return () => {
      rot.style.removeProperty("--flytande-skapa-h");
    };
  }, [syns]);

  if (!syns) return null;
  return (
    <button
      type="button"
      data-ops-flytande-skapa=""
      aria-label={label}
      aria-haspopup="dialog"
      onClick={onOppna}
      className={cx(
        "fixed z-(--z-chrome) inline-flex size-(--flytande-skapa-storlek) cursor-pointer items-center justify-center rounded-full md:hidden",
        "right-[calc(var(--flytande-skapa-luft)+var(--safe-right))]",
        "bottom-[calc(var(--bottom-nav-h)+var(--safe-bottom)+var(--spelrad-h,0px)+var(--flytande-skapa-luft))]",
        "bg-accent text-accent-contrast shadow-lg",
        "transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-hover",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
      )}
    >
      <PlusIkon size={26} />
    </button>
  );
}
