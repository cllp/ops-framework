import { OpsEmpty } from "@staiger/ops-framework";

/**
 * Modulens tillägg på händelsepanelen: platsen `handelse.sektion` (0.60.0, #251).
 *
 * ⛔ EN APP ÄNDRAR ALDRIG EN RAMVERKSYTA (beslut 0003). Panelen ritar rubriken ur manifestets `etikett` och lämnar sektionen till
 * modulen. Komponenten får `{ handelse, grupp }` och inget annat, och läser resten ur modulens egen data.
 */

/**
 * @param {object} props
 * @param {{ id: string, titel: string, datum: string }} props.handelse
 * @param {{ id: string }} props.grupp
 */
export function PaminnelserTillagg({ handelse, grupp }) {
  return <OpsEmpty title="Inga påminnelser kopplade" description={`${handelse.titel} i ${grupp.id} har inga påminnelser än.`} />;
}

/* ⛔ OCKSÅ SOM DEFAULT, eftersom `lazy` kräver det. */
export default PaminnelserTillagg;
