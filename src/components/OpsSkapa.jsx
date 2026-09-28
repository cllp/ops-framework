import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsPanelRow } from "./OpsPanel.jsx";
import { text } from "../lib/sprak.js";
import { skapalaget } from "../lib/skapa.js";

/**
 * Plusset: vad som går att skapa i den aktiva gruppen (#150).
 *
 * ══ ⛔ RAMVERKET ÄGER LISTAN, APPEN ÄGER PANELEN OCH FORMULÄRET (#168) ═══
 *
 * Den här filen ritade tidigare (0.27.0) BÅDE listan OCH, efter ett tryck,
 * typvalet och formuläret själv, inne i sin egen yta med en "Tillbaka"-länk.
 * CP:s skärminspelning 2026-09-28 visade att SessionStudios plusknapp gör
 * något annat: knappen sitter i TOPPRADEN och öppnar en POPOVER med bara
 * listan (`ss-skapa-meny.png`), och ett tryck på en rad öppnar en RIKTIG
 * modal med stängknapp, aldrig en andra vy inuti samma popover.
 *
 * `OpsSkapa` är därför bara LISTAN och de två tomlägena. Popovern, modalen,
 * typvalet och "ramverkets egna rader" (Ny händelse, Nytt ärende, #168) hör
 * hemma i `OpsAppShell props.skapa`, som är den yta som faktiskt äger
 * plusknappen. Modulkontraktet (#150/#153) är oförändrat: modulen
 * registrerar fortfarande vad den kan skapa, `OpsSkapa` bara BYTTE vem som
 * bestämmer vad som händer efter ett tryck.
 *
 * ⛔ DÄRFÖR TAR RADEN NU `onValj`, INTE `onKlar`. Ett tryck på raden är ett
 * VAL, inte ett "klart": det är den som ritar popovern (skalet) som vet vad
 * ett val ska göra (stänga popovern, öppna en modal), och `OpsSkapa` känner
 * varken till Radix-popovern som omsluter den eller modalen som kommer sen.
 *
 * ══ ⛔ TRE TOMLÄGEN, INTE ETT ═════════════════════════════════════════
 *
 * "Välj en grupp först" och "inget att skapa här" är olika svar och kräver
 * olika handlingar. Samma text för båda lär användaren att plusset är trasigt,
 * och den läxan sitter kvar efter att texten rättats. Beslutet ligger i
 * `skapalaget`, alltså i en ren funktion, av samma skäl som `iOrdning` i
 * Översikten: ett beslut inne i en komponent är ett beslut inget prov når.
 *
 * ══ ⛔ EN AVDELARE MELLAN MODULERNA, INTE MELLAN VARJE RAD ═══════════════
 *
 * En modul kan registrera flera rader (en app med "Ärende" och "Kvitto" i
 * samma modul). Delades varje RAD av en linje såg listan ut som tio separata
 * saker i stället för två moduler; en tunn avdelare ritas därför bara när
 * MODULEN byter, inte mellan rader i samma modul.
 *
 * ⛔ IKONEN ÄR APPENS, INTE RAMVERKETS (`ikonRitare`, samma mönster som
 * `OpsKatalogInstallning props.ikonRitare`): `Skaparregistrering.ikon` är ett
 * namn ur appens egen tillåtelselista, en sträng ramverket inte vet hur man
 * ritar. Utan `ikonRitare` ritas ingen ikon, bara ordet.
 */

/**
 * @param {object} props
 * @param {ReadonlyArray<import("../lib/modul.js").Skaparregistrering & { modulId: string }>} props.registreringar Ur `skaparFor`, i manifestets ordning.
 * @param {string | null} props.lage Aktivt gruppläge. `ALLA_GRUPPER` betyder att en grupp måste väljas först.
 * @param {string} [props.sprak]
 * @param {(registrering: import("../lib/modul.js").Skaparregistrering & { modulId: string }) => void} [props.onValj] Anropas när en rad trycks.
 * @param {(namn: string) => import("react").ReactNode} [props.ikonRitare] Registreringens `ikon`-namn till en ritad ikon. Utan den ritas ingen ikon.
 * @param {string} [props.ariaLabel]
 * @param {string} [props.valjGruppText]
 * @param {string} [props.tomText]
 */
export function OpsSkapa({
  registreringar,
  lage,
  sprak = "sv",
  onValj,
  ikonRitare,
  ariaLabel = "Skapa",
  valjGruppText = "Välj en grupp först. Det som skapas hamnar i den gruppen, och när Alla är valt finns ingen att skriva i.",
  tomText = "Ingen av gruppens moduler kan skapa något än.",
}) {
  const laget = skapalaget({ lage, registreringar });

  if (laget.tillstand === "valjGrupp") return <OpsEmpty title={ariaLabel} description={valjGruppText} />;
  if (laget.tillstand === "tomt") return <OpsEmpty title={ariaLabel} description={tomText} />;

  // ⛔ EN PLATT LISTA, INGEN RUBRIK, INGA FLIKAR (#164 korrigering D, kvar
  // sedan #168). `ariaLabel` bär `role="region"`s namn i stället för ett
  // `<h2>` ingen bad om: SessionStudios plus-meny har ingen synlig rubrik.
  const rader = registreringar ?? [];
  return (
    <div role="region" aria-label={ariaLabel} className="flex flex-col gap-0.5">
      {rader.map((r, i) => (
        <div key={r.id} className="flex flex-col gap-0.5">
          {/* ⛔ AVDELARE FÖRE RADEN, NÄR MODULEN BYTER (och inte för första
              raden, den har inget att avskilja sig från). */}
          {i > 0 && r.modulId !== rader[i - 1].modulId ? <div role="separator" className="my-0.5 border-t border-line" /> : null}
          {/* ⛔ #168, ANDRA GRANSKNINGEN: `accent`, SOM RAMVERKETS EGNA RADER I
              SAMMA POPOVER. Listan är bara nådd genom plusset numera (se
              filhuvudet); en modulrad som ser ut som en vanlig menyrad bredvid
              ramverkets accentfärgade "Ny händelse"/"Nytt ärende" hade sett ut
              som en annan sorts knapp i samma lista. */}
          <OpsPanelRow icon={ikonRitare ? ikonRitare(r.ikon) : undefined} label={text(r.namn, sprak)} accent onClick={() => onValj?.(r)} />
        </div>
      ))}
    </div>
  );
}
