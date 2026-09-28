import { useState } from "react";
import { OpsField, OpsButton } from "@staiger/ops-framework";

/**
 * Formuläret plusset ritar för en ny påminnelse (#150).
 *
 * ══ ⛔ RAMVERKET SKICKAR IN GRUPPEN OCH TYPEN, INGET MER ═══════════════
 *
 * `groupId` är den aktiva gruppen och `typ` är den kategori användaren valt i
 * panelens typväljare. Allt annat vet modulen själv, och det är hela poängen:
 * ramverket kan inte veta vilka fält en påminnelse har.
 *
 * ⛔ OCH MODULEN SKRIVER SIN EGEN RAD. Här är skrivningen en `console.log`,
 * eftersom exemplet inte har någon databas. I en riktig modul står anropet mot
 * appens datalager här, med `groupId` på raden. Ramverket rör den aldrig: det
 * skulle kräva att det kände till samlingen.
 *
 * ⛔ `onKlar` ANROPAS EFTER SKRIVNINGEN, inte före. Anropas den först stänger
 * panelen medan skrivningen fortfarande kan falla, och användaren får veta att
 * det gick bra innan det gjorde det.
 */

/**
 * @param {object} props
 * @param {string} props.groupId Den aktiva gruppen. Raden hamnar här.
 * @param {string | null} props.typ Vald kategori ur katalogen `sorter`.
 * @param {() => void} [props.onKlar]
 */
export default function PaminnelserForm({ groupId, typ, onKlar }) {
  const [titel, setTitel] = useState("");
  const [sparar, setSparar] = useState(false);

  async function spara() {
    setSparar(true);
    try {
      // I en riktig modul: skriv raden via appens datalager, med groupId på den.
      console.log("ny påminnelse", { groupId, sort: typ, titel });
      onKlar?.();
    } finally {
      setSparar(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <OpsField label="Titel">
        <input
          value={titel}
          onChange={(e) => setTitel(e.target.value)}
          className="w-full rounded-md border border-line bg-canvas px-3 py-2 min-h-11 text-ink"
        />
      </OpsField>
      {/* ⛔ Knappen är avstängd utan titel OCH utan typ. En påminnelse utan
          sort går inte att gruppera i listan, och en utan titel är en rad utan
          ord. Att spara den och rätta sedan är hur tomma rader uppstår. */}
      <OpsButton onClick={spara} disabled={sparar || titel.trim() === "" || typ === null}>
        Spara
      </OpsButton>
    </div>
  );
}
