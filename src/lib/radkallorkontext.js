import { createContext, useContext, useMemo } from "react";
import { validateRadkallor } from "./radkallor.js";

/**
 * Skalets `radkallor`, åtkomligt för ytorna under det (0.145.0, cllp/ops-framework#446). `null` utanför skalet, eller när skalet inte fått något manifest.
 *
 * ⛔ SAMMA MÖNSTER SOM `OppnaHandelseKontext` (`lib/handelsekontext.js`), av samma skäl: Idag (`OpsEventList`) och kalendern (`OpsCalendar`) ska öppna SAMMA
 * panel med SAMMA knappar, och appen ska inte behöva skicka samma karta till båda och riskera att de glider isär. En yta utanför skalet (ett prov, en
 * annan layout) tar `radkallor` som prop, och propen går före kontexten.
 *
 * ⛔ HETER `radkallor` OCH INTE `kallor`: `lib/kallor.js` är modulernas källkontrakt (`skapaKallregister`, rader som en modul lämnar), en helt annan sak än vilken
 * sort en RAD i listan är. Två "kallor" i samma ramverk hade fått den ena att läsas som den andra.
 *
 * ⛔ I EN EGEN FIL, INTE I `OpsAppShell`: ytorna importerar kontexten, och skalet importerar ytor. Ligger den i skalet blir det en importcykel.
 */
export const RadkallorKontext = createContext(/** @type {import("./radkallor.js").Radkallor | null} */ (null));

/**
 * Manifestet en yta ska använda: propen, annars skalets, annars `null` (då gäller allt som förut). Kontrolleras en gång per ny karta.
 * @param {import("./radkallor.js").Radkallor | undefined} prop
 * @param {string} komponent
 * @returns {import("./radkallor.js").Radkallor | null}
 */
export function useRadkallor(prop, komponent) {
  const fran = useContext(RadkallorKontext);
  const val = prop ?? fran;
  return useMemo(() => validateRadkallor(val, komponent), [val, komponent]);
}
