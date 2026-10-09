import { useLayoutEffect, useRef } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { cx } from "../lib/cx.js";
import { FLIKIKON, FLIKOMSLAG, FLIKRAD, flikKlass, rullaInAktiv } from "../lib/modulram.js";

/**
 * Flikar inom en sida.
 *
 * ⛔ Beteendet är inte handskrivet. Piltangenter, Home och End, roving
 * tabindex, och kopplingen mellan flik och panel via `aria-controls` är fem
 * saker som alla måste stämma samtidigt för att flikarna ska gå att använda med
 * tangentbord. Att bygga det själv tar en dag och att bygga det fel märks inte
 * förrän någon faktiskt slutar använda musen.
 *
 * ⛔ Flikar är för innehåll på SAMMA sida. Navigering mellan sidor ska vara
 * länkar, annars tappar användaren adressfältet, bakåtknappen och möjligheten
 * att dela en länk till det hen tittar på. bolag-ops `.page-tabs` är i dag
 * sidnavigering och hör alltså inte hit.
 */

/**
 * ⛔ IKONFLIKAR (0.80.0, granskningen av PR 307). Med `icon` på en flik ritas ikonen med `badge` under, i lika breda
 * kolumner, och ordet står kvar som `sr-only`. Chattinfo i en panel på 320 px fick inte plats med fyra ord och antal:
 * Dokument och Länkar hamnade utanför och syntes inte utan att raden rullades, och montaget mot förebilden visade det
 * direkt. Samma regel som `OpsSegmented`: antingen alla flikar eller ingen, annars kastar den, för en ikon bredvid ett
 * ord ser ut som ett fel. `badge` ritas när den är ett tal, också 0 (regel 5: tomhet är ett svar).
 *
 * ⛔ IKON, ORD OCH ANTAL PÅ EN RAD (`medOrd`, 0.83.0). CP 2026-10-08 17:52, med bilder av Bibliotek och Ekonomi: "Sedan
 * navigeringen på liknande sätt." Bibliotekets typer stod som en segmentväljare i pillerform medan Ekonomi har en rad med
 * ikon, namn och accentlinje (`OpsModulSida`). Med `medOrd` ritas varje flik som en post i den raden, med samma klasser
 * (`flikKlass` i `modulram.js`, en gång för båda), och antalet efter ordet som SessionStudios bibliotek ("All 61"). Formen
 * kräver ikoner på alla flikar: utan ikon står ordet redan på raden, och då behövs ingen ny form.
 *
 * @param {object} props
 * @param {{ id: string, label: string, disabled?: boolean, icon?: import("react").ReactNode, badge?: number }[]} props.tabs
 * @param {string} props.value
 * @param {(id: string) => void} props.onChange
 * @param {string} props.ariaLabel Vad flikraden styr. Krävs, annars är den namnlös för skärmläsare.
 * @param {boolean} [props.medOrd] (0.83.0) Ikon, ord och antal på en rad, som modulens länkrad. Kräver `icon` på varje flik.
 * @param {import("react").ReactNode} props.children Ett `OpsTabPanel` per flik.
 */
export function OpsTabs({ tabs, value, onChange, ariaLabel, medOrd = false, children }) {
  if (!Array.isArray(tabs) || tabs.length === 0) {
    throw new Error("OpsTabs: tabs krävs och måste ha minst en flik.");
  }
  if (!ariaLabel) {
    throw new Error("OpsTabs: ariaLabel krävs. En namnlös flikrad annonseras bara som 'flikar', vilket inte hjälper någon.");
  }
  const medIkon = tabs.filter((f) => Boolean(f.icon)).length;
  if (medIkon !== 0 && medIkon !== tabs.length) {
    throw new Error(`OpsTabs: ${medIkon} av ${tabs.length} flikar har icon. Antingen alla eller ingen: en ikon bredvid ett ord ser ut som ett fel.`);
  }
  const ikoner = medIkon > 0;
  if (medOrd && !ikoner) {
    throw new Error("OpsTabs: medOrd kräver icon på varje flik. Formen är ikon bredvid ordet, och utan ikon står ordet redan på raden.");
  }
  const lista = useRef(/** @type {HTMLDivElement | null} */ (null));
  useLayoutEffect(() => {
    rullaInAktiv(lista.current);
  }, [value]);

  return (
    <Tabs.Root value={value} onValueChange={onChange} className={medOrd ? FLIKOMSLAG : undefined}>
      {/* ⛔ `medOrd` använder `FLIKRAD` (samma som modulens delar): en rad som rullar i sidled.
          Omslaget (`FLIKOMSLAG`) gör att raden kan bli smalare än orden, annars rullar sidan.
          De andra formerna behåller sin egen sidorullning: ikonformen delar bredden (`flex-1`). */}
      <Tabs.List ref={lista} aria-label={ariaLabel} className={medOrd ? FLIKRAD : "flex gap-1 overflow-x-auto border-b border-line"}>
        {tabs.map((f) => (
          <Tabs.Trigger
            key={f.id}
            value={f.id}
            disabled={f.disabled}
            className={
              medOrd
                ? cx(flikKlass({ oppen: f.id === value }), "shrink-0 cursor-pointer", "disabled:opacity-55 disabled:cursor-not-allowed")
                : cx(
                    ikoner
                      ? "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-t-md px-2 py-2 text-meta font-semibold"
                      : "shrink-0 whitespace-nowrap rounded-t-md px-4 py-2 text-brod font-semibold",
                    "border-b-2 border-transparent text-ink-secondary",
                    "transition-colors duration-(--duration-fast) ease-standard",
                    "hover:bg-accent-faint hover:text-ink",
                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                    "data-[state=active]:border-accent data-[state=active]:text-ink",
                    "disabled:opacity-55 disabled:cursor-not-allowed",
                  )
            }
          >
            {medOrd ? (
              <>
                <span aria-hidden="true" className={FLIKIKON}>
                  {f.icon}
                </span>
                <span>{f.label}</span>
                {/* Mellanslaget är för namnet ("Alla 1", inte "Alla1"). I en flexrad ritas det inte. */}
                {typeof f.badge === "number" ? " " : null}
                {/* ⛔ 0 RITAS (regel 5): en typ utan poster säger att den finns och är tom. */}
                {typeof f.badge === "number" ? <span className="tabular-nums font-normal text-ink-muted">{f.badge}</span> : null}
              </>
            ) : ikoner ? (
              <>
                <span aria-hidden="true" className="inline-flex">
                  {f.icon}
                </span>
                <span className="sr-only">{`${f.label} `}</span>
                <span className="tabular-nums">{typeof f.badge === "number" ? f.badge : ""}</span>
              </>
            ) : typeof f.badge === "number" ? (
              `${f.label} ${f.badge}`
            ) : (
              f.label
            )}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {children}
    </Tabs.Root>
  );
}

/**
 * @param {object} props
 * @param {string} props.id Matchar en fliks id.
 * @param {import("react").ReactNode} props.children
 */
export function OpsTabPanel({ id, children }) {
  return (
    <Tabs.Content value={id} className="pt-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
      {children}
    </Tabs.Content>
  );
}
