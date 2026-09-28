import { useState } from "react";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsField } from "./OpsField.jsx";
import { OpsSelect } from "./OpsSelect.jsx";
import { OpsPanelRow } from "./OpsPanel.jsx";
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
 *
 * ══ ⛔ #164, KORRIGERING D, CP 2026-09-28: FLIKARNA FÖRSVINNER, EN LISTA
 * ERSÄTTER DEM ═══════════════════════════════════════════════════════════
 *
 * "Modulkontraktet (#150/#153, modulen registrerar vad den kan skapa)
 * behålls. Det som ändras är FÖRSTA NIVÅN: när plusset trycks visas en platt
 * lista med en rad per registrering, ikon plus ord, ingen rubrik, inga
 * flikar, exakt som SessionStudios plus-meny. Trycket på en rad öppnar det
 * som i dag ligger bakom fliken (typval via OpsSelect om registreringen har
 * flera typer, sedan formuläret)."
 *
 * `OpsTabs` (flikrad + alla paneler monterade parallellt, en `aria-selected`
 * som byter vilken som syns) är ersatt av en enkel `vald`-state: `null`
 * betyder "visa listan", ett id betyder "visa den registreringens flöde".
 * Det är SAMMA form som `OpsMeny`s sektioner redan använder (`OpsPanelRow`,
 * ikon vänster, ord, ingen chevron här eftersom raden inte öppnar en
 * undermeny i SAMMA panel, den byter hela panelens innehåll som en riktig
 * navigering skulle). Panelen ska inte likna listan ungefär, den ska vara
 * DENSAMMA primitiv.
 *
 * ⛔ IKONEN ÄR APPENS, INTE RAMVERKETS (`ikonRitare`, samma mönster som
 * `OpsKatalogInstallning props.ikonRitare`): `Skaparregistrering.ikon` är ett
 * namn ur appens egen tillåtelselista, en sträng ramverket inte vet hur man
 * ritar. Utan `ikonRitare` ritas ingen ikon, bara ordet, vilket är rätt svar
 * för en app som inte (ännu) skickat in en ikonuppsättning.
 */

/**
 * @param {object} props
 * @param {ReadonlyArray<import("../lib/modul.js").Skaparregistrering & { modulId: string }>} props.registreringar Ur `skaparFor`.
 * @param {string | null} props.lage Aktivt gruppläge. `ALLA_GRUPPER` betyder att en grupp måste väljas först.
 * @param {ReadonlyArray<{ id: string, kategorier?: ReadonlyArray<any> }>} [props.kataloger] Gruppens kataloger.
 * @param {string} [props.sprak]
 * @param {(arg: { registrering: string, typ: string | null }) => void} [props.onKlar] Anropas av modulens formulär när raden är skriven.
 * @param {(namn: string) => import("react").ReactNode} [props.ikonRitare] Registreringens `ikon`-namn till en ritad ikon. Utan den ritas ingen ikon.
 * @param {string} [props.ariaLabel]
 * @param {string} [props.valjGruppText]
 * @param {string} [props.tomText]
 * @param {string} [props.typEtikett]
 * @param {string} [props.tillbakaEtikett]
 */
export function OpsSkapa({
  registreringar,
  lage,
  kataloger = [],
  sprak = "sv",
  onKlar,
  ikonRitare,
  ariaLabel = "Skapa",
  valjGruppText = "Välj en grupp först. Det som skapas hamnar i den gruppen, och när Alla är valt finns ingen att skriva i.",
  tomText = "Ingen av gruppens moduler kan skapa något än.",
  typEtikett = "Typ",
  tillbakaEtikett = "Tillbaka",
}) {
  const laget = skapalaget({ lage, registreringar });
  /** @type {[string | null, Function]} */
  const [vald, setVald] = useState(/** @type {string | null} */ (null));
  /** @type {[Record<string, string>, Function]} */
  const [valdTyp, setValdTyp] = useState({});

  if (laget.tillstand === "valjGrupp") return <OpsEmpty title={ariaLabel} description={valjGruppText} />;
  if (laget.tillstand === "tomt") return <OpsEmpty title={ariaLabel} description={tomText} />;

  /*
   * ⛔ VALET FALLER TILLBAKA PÅ LISTAN NÄR DEN VALDA REGISTRERINGEN FÖRSVUNNIT.
   * Byter gruppen moduler medan panelen är öppen pekar `vald` annars på en
   * registrering som inte längre finns, och komponenten hade ritat en tom
   * yta utan förklaring i stället för att falla tillbaka till listan.
   */
  const valdRegistrering = vald ? registreringar.find((r) => r.id === vald) : undefined;

  if (!valdRegistrering) {
    // ⛔ EN PLATT LISTA, INGEN RUBRIK, INGA FLIKAR (#164 korrigering D).
    // `ariaLabel` bär `role="region"`s namn i stället för ett `<h2>` ingen
    // bad om: SessionStudios plus-meny har ingen synlig rubrik ovanför
    // raderna.
    return (
      <div role="region" aria-label={ariaLabel} className="flex flex-col gap-0.5">
        {registreringar.map((r) => (
          <OpsPanelRow key={r.id} icon={ikonRitare ? ikonRitare(r.ikon) : undefined} label={text(r.namn, sprak)} onClick={() => setVald(r.id)} />
        ))}
      </div>
    );
  }

  const r = valdRegistrering;
  const typer = typerAttValja(r.katalog, kataloger);
  const Form = /** @type {any} */ (r.form);
  const typ = valdTyp[r.id] ?? typer[0]?.id ?? null;

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setVald(null)}
        className="flex items-center gap-1 self-start text-xs font-medium text-ink-muted transition-colors hover:text-accent"
      >
        ← {tillbakaEtikett}
      </button>
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
    </div>
  );
}
