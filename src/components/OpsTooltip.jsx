import * as Tooltip from "@radix-ui/react-tooltip";
import { cx } from "../lib/cx.js";

/**
 * Förklaring vid hover och fokus.
 *
 * ⛔ EN TOOLTIP FÅR ALDRIG BÄRA INFORMATION SOM BEHÖVS. Den syns inte på
 * pekskärm, den syns inte i utskrift, och den syns inte för den som skummar.
 * Allt som användaren måste veta för att fatta ett beslut ska stå i vyn.
 *
 * Använd den för det som är bra att veta men inte nödvändigt: en förklaring av
 * en förkortning, en exakt tidpunkt bakom "för 3 dagar sedan", var en siffra
 * kommer ifrån.
 *
 * ⛔ Behöver en ikonknapp ett NAMN är svaret `ariaLabel` på knappen, inte en
 * tooltip. Namn och förklaring är två olika saker, och skärmläsaren läser bara
 * det första.
 */

/**
 * @param {object} props
 * @param {string} props.content Förklaringen. Kort, en mening.
 * @param {"top"|"right"|"bottom"|"left"} [props.side]
 * @param {import("react").ReactNode} props.children Det som förklaras. Måste gå att fokusera.
 */
export function OpsTooltip({ content, side = "top", children }) {
  if (!content) throw new Error("OpsTooltip: content krävs. En tom tooltip är en hoverfälla utan innehåll.");

  return (
    // `delayDuration` 200 ms: kortare gör att tooltips blinkar fram när pekaren
    // bara passerar, vilket läses som att gränssnittet är oroligt.
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side={side}
            sideOffset={6}
            className={cx(
              "z-(--z-dropdown) max-w-xs rounded-md border border-line bg-raised px-3 py-2",
              "text-sm text-ink shadow-md",
            )}
          >
            {content}
            <Tooltip.Arrow className="fill-raised" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
