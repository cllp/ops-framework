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
 * @param {object} props
 * @param {{ id: string, label: string, disabled?: boolean }[]} props.tabs
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
              "shrink-0 whitespace-nowrap rounded-t-md px-4 py-2 text-base font-semibold",
              "border-b-2 border-transparent text-ink-secondary",
              "transition-colors duration-(--duration-fast) ease-standard",
              "hover:bg-accent-faint hover:text-ink",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
              "data-[state=active]:border-accent data-[state=active]:text-ink",
              "disabled:opacity-55 disabled:cursor-not-allowed",
            )}
          >
            {f.label}
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
