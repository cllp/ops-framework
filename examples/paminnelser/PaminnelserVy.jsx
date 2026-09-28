import { OpsView, OpsViewHeader, OpsEmpty } from "@staiger/ops-framework";

/**
 * Modulens egen sida.
 *
 * ⛔ EN VANLIG VY, INGET SÄRSKILT. Poängen med exemplet är att en modulsida är
 * precis en vy: den får sin data av appen och ritar den med ramverkets
 * primitiver. Det finns ingen modul-API att lära sig utöver manifestet.
 */

/**
 * @param {object} props
 * @param {{ id: string, titel: string, dagar: number }[]} [props.rader]
 */
export function PaminnelserVy({ rader = [] }) {
  return (
    <OpsView>
      <OpsViewHeader title="Påminnelser" />
      {rader.length === 0 ? <OpsEmpty title="Inga påminnelser i den här gruppen." /> : rader.map((r) => <p key={r.id}>{r.titel}</p>)}
    </OpsView>
  );
}

/*
 * ⛔ OCKSÅ SOM DEFAULT, eftersom `lazy` kräver det. Den namngivna exporten
 * finns kvar för proven, som importerar den rakt av.
 */
export default PaminnelserVy;
