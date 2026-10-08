import * as Tabs from "@radix-ui/react-tabs";
import { cx } from "../lib/cx.js";

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
 * @param {object} props
 * @param {{ id: string, label: string, disabled?: boolean, icon?: import("react").ReactNode, badge?: number }[]} props.tabs
 * @param {string} props.value
 * @param {(id: string) => void} props.onChange
 * @param {string} props.ariaLabel Vad flikraden styr. Krävs, annars är den namnlös för skärmläsare.
 * @param {import("react").ReactNode} props.children Ett `OpsTabPanel` per flik.
 */
export function OpsTabs({ tabs, value, onChange, ariaLabel, children }) {
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

  return (
    <Tabs.Root value={value} onValueChange={onChange}>
      {/* Flikraden scrollar i sidled när den inte får plats. Utan det trängs
          flikarna ihop till oläsliga stumpar på telefon. */}
      <Tabs.List aria-label={ariaLabel} className="flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((f) => (
          <Tabs.Trigger
            key={f.id}
            value={f.id}
            disabled={f.disabled}
            className={cx(
              ikoner
                ? "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-t-md px-2 py-2 text-meta font-semibold"
                : "shrink-0 whitespace-nowrap rounded-t-md px-4 py-2 text-brod font-semibold",
              "border-b-2 border-transparent text-ink-secondary",
              "transition-colors duration-(--duration-fast) ease-standard",
              "hover:bg-accent-faint hover:text-ink",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
              "data-[state=active]:border-accent data-[state=active]:text-ink",
              "disabled:opacity-55 disabled:cursor-not-allowed",
            )}
          >
            {ikoner ? (
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
