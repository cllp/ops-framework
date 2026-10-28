import { useOpsSprak } from "./OpsSprak.jsx";
import { forvalda } from "../lib/ord.js";

/**
 * Märket "Dold" och blekningen av en rad som kalenderlistan döljer (0.151.0, CP 2026-10-28: "Dagen i appen").
 *
 * ══ ⛔ ETT MÄRKE, ETT ORD, TVÅ ANVÄNDARE ════════════════════════════════════════════════════════════════════════════════
 *
 * Månadsvyns snabbtitt (`OpsCalendar`) visar en dags alla poster och märker de som filtret döljer med ordet "Dold". Appens Dagen ska kunna göra samma sak på ett tryck
 * utan att ändra valen. Skrev appen märket själv blev det en andra kopia av både utseendet och ordet (regel 2), och den första dagen någon ändrade det ena stod
 * "Dold" på två olika sätt i samma produkt. Därför ritar snabbtitten märket med den här komponenten, och appen gör det med.
 *
 * Vad som ÄR dolt avgör `delaPosterPaSynlighet` (`useKalenderSynlighet().dela`), inte märket: det här är bara hur det ser ut.
 *
 * ⛔ Märket är text och inte bara färg eller blekning: en rad som bara är blekare läses inte som dold av den som inte ser skillnaden, och en skärmläsare läser ordet.
 */
export const ORD_OPSDOLDMARKE = {
  dold: { sv: "Dold", en: "Hidden" },
};

/**
 * Klassen på en rad vars kalender är dold: halv täckning. Skriven ut ord för ord, Tailwind läser källan som text.
 * @type {string}
 */
export const DOLD_RAD_KLASS = "opacity-50";

/**
 * @param {object} props
 * @param {string} [props.sprak] Förval språket ur `OpsSprakProvider`.
 */
export function OpsDoldMarke({ sprak }) {
  const kontext = useOpsSprak();
  const o = forvalda(ORD_OPSDOLDMARKE, sprak ?? kontext);
  return (
    <span data-dold-marke="" className="shrink-0 rounded-full border border-line px-1.5 text-mikro uppercase tracking-wide">
      {o.dold}
    </span>
  );
}
