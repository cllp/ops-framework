import { createContext, useContext } from "react";

/**
 * Skalets `oppnaHandelse`, åtkomlig för ytorna under det (0.40.0, #214). `null` utanför skalet, eller när skalet saknar `handelsepanel`.
 *
 * ⛔ EN KONTEXT OCH INTE EN PROP PER YTA. Idag-listan (`OpsEventList`) och kalenderns dagpanel (`OpsCalendar`) ska öppna SAMMA panel,
 * och appen ska inte behöva skicka samma callback till båda och bygga adressen och historiken två gånger. Skalet äger panelen och
 * adressen (`?handelse=`); en yta som har en post med `handelseId` frågar skalet. En yta utanför skalet (ett prov, en annan layout)
 * tar `onOppnaHandelse` som prop i stället, och propen går före kontexten.
 *
 * ⛔ I EN EGEN FIL, INTE I `OpsAppShell`: ytorna importerar kontexten, och skalet importerar ytor. Ligger den i skalet blir det en
 * importcykel.
 */
export const OppnaHandelseKontext = createContext(/** @type {((id: string) => void) | null} */ (null));

/**
 * Vad en rad ska göra när man trycker på en händelse: propen, annars skalets, annars ingenting (`null`).
 * @param {((id: string) => void) | undefined} prop
 * @returns {((id: string) => void) | null}
 */
export function useHandelseOppnare(prop) {
  const fran = useContext(OppnaHandelseKontext);
  return prop ?? fran;
}
