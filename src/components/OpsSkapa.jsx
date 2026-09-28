import { useState } from "react";
import { OpsTabs, OpsTabPanel } from "./OpsTabs.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsField } from "./OpsField.jsx";
import { OpsSelect } from "./OpsSelect.jsx";
import { text } from "../lib/sprak.js";
import { skapalaget, typerAttValja } from "../lib/skapa.js";

/**
 * Plusset: vad som går att skapa i den aktiva gruppen (#150).
 *
 * ══ ⛔ RAMVERKET ÄGER PANELEN, MODULEN ÄGER FORMULÄRET ═════════════════
 *
 * Flikarna, typvalet och tomlägena är ramverkets. Fälten och skrivningen är
 * modulens. Skulle ramverket skriva raden måste det känna till modulens
 * samling, och då är modulkontraktet bara en uppdelning på papperet.
 *
 * ⛔ DÄRFÖR FÅR FORMULÄRET `groupId` OCH `typ` INSKICKADE, och ingenting mer.
 * Allt annat modulen behöver vet den själv. En panel som började skicka in
 * appens datalager hade gjort ramverket till en app.
 *
 * ══ ⛔ TRE TOMLÄGEN, INTE ETT ═════════════════════════════════════════
 *
 * "Välj en grupp först" och "inget att skapa här" är olika svar och kräver
 * olika handlingar. Samma text för båda lär användaren att plusset är trasigt,
 * och den läxan sitter kvar efter att texten rättats. Beslutet ligger i
 * `skapalaget`, alltså i en ren funktion, av samma skäl som `iOrdning` i
 * Översikten: ett beslut inne i en komponent är ett beslut inget prov når.
 */

/**
 * @param {object} props
 * @param {ReadonlyArray<import("../lib/modul.js").Skaparregistrering & { modulId: string }>} props.registreringar Ur `skaparFor`.
 * @param {string | null} props.lage Aktivt gruppläge. `ALLA_GRUPPER` betyder att en grupp måste väljas först.
 * @param {ReadonlyArray<{ id: string, kategorier?: ReadonlyArray<any> }>} [props.kataloger] Gruppens kataloger.
 * @param {string} [props.sprak]
 * @param {(arg: { registrering: string, typ: string | null }) => void} [props.onKlar] Anropas av modulens formulär när raden är skriven.
 * @param {string} [props.ariaLabel]
 * @param {string} [props.valjGruppText]
 * @param {string} [props.tomText]
 * @param {string} [props.typEtikett]
 */
export function OpsSkapa({
  registreringar,
  lage,
  kataloger = [],
  sprak = "sv",
  onKlar,
  ariaLabel = "Skapa",
  valjGruppText = "Välj en grupp först. Det som skapas hamnar i den gruppen, och när Alla är valt finns ingen att skriva i.",
  tomText = "Ingen av gruppens moduler kan skapa något än.",
  typEtikett = "Typ",
}) {
  const laget = skapalaget({ lage, registreringar });
  const [aktiv, setAktiv] = useState(registreringar?.[0]?.id ?? "");
  /** @type {[Record<string, string>, Function]} */
  const [valdTyp, setValdTyp] = useState({});

  if (laget.tillstand === "valjGrupp") return <OpsEmpty title={ariaLabel} description={valjGruppText} />;
  if (laget.tillstand === "tomt") return <OpsEmpty title={ariaLabel} description={tomText} />;

  /*
   * ⛔ FLIKEN FALLER TILLBAKA PÅ DEN FÖRSTA när det valda id:t inte längre
   * finns. Byter gruppen moduler medan panelen är öppen pekar `aktiv` annars
   * på en flik som försvunnit, och Radix ritar då ingen panel alls: en tom yta
   * utan förklaring, vilket ser ut som ett fel i appen.
   */
  const valdId = registreringar.some((r) => r.id === aktiv) ? aktiv : registreringar[0].id;

  return (
    <OpsTabs
      ariaLabel={ariaLabel}
      value={valdId}
      onChange={setAktiv}
      tabs={registreringar.map((r) => ({ id: r.id, label: text(r.namn, sprak) }))}
    >
      {registreringar.map((r) => {
        const typer = typerAttValja(r.katalog, kataloger);
        const Form = /** @type {any} */ (r.form);
        const typ = valdTyp[r.id] ?? typer[0]?.id ?? null;
        return (
          <OpsTabPanel key={r.id} id={r.id}>
            {r.katalog !== null && (
              <OpsField label={typEtikett}>
                <OpsSelect
                  ariaLabel={`${typEtikett}, ${text(r.namn, sprak)}`}
                  value={typ ?? ""}
                  onChange={(/** @type {string} */ v) => setValdTyp({ ...valdTyp, [r.id]: v })}
                  options={typer.map((k) => ({ value: k.id, label: text(/** @type {any} */ (k).namn, sprak) || k.id }))}
                />
              </OpsField>
            )}
            {/*
              ⛔ `groupId` KOMMER UR `skapalaget` OCH INTE UR `lage` DIREKT.
              De är samma värde i redo-läget, men att läsa det ur beslutet gör
              att en framtida ändring av vad "aktiv grupp" betyder bara behöver
              göras på ett ställe.
            */}
            <Form groupId={laget.grupp} typ={typ} onKlar={() => onKlar?.({ registrering: r.id, typ })} />
          </OpsTabPanel>
        );
      })}
    </OpsTabs>
  );
}
