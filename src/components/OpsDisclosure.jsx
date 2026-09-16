import { useState } from "react";
import { cx } from "../lib/cx.js";
import { ChevronNedIkon } from "./icons.jsx";

/**
 * Hopfällbart kort: en alltid synlig rubrik som fäller ut ett innehåll.
 *
 * ⛔ Byggt på native `<details>`/`<summary>`, inte en egen knapp med state.
 * Skälet är mätt: en hopfällning gjord av `<div onClick>` tappar tangentbord
 * (Enter/Space), fokusordning och skärmläsarens "expanderad/hopfälld" gratis,
 * och någon måste återuppfinna dem, oftast fel. `<details>` bär allt det i
 * plattformen. Den här komponenten lägger bara till form (token-radie, ram,
 * chevron) och ett valfritt styrt läge.
 *
 * ⛔ Ramverket äger formen, inte innehållet. `summary` och `children` är vad
 * appen än vill visa: en rubrik med etiketter och ett belopp till höger, en
 * lista, en tabell. Ingen domän här.
 *
 * @param {object} props
 * @param {import("react").ReactNode} props.summary Alltid synlig rad. Klickytan som fäller ut.
 * @param {import("react").ReactNode} props.children Innehållet som visas när den är öppen.
 * @param {boolean} [props.defaultOpen] Startläge när komponenten är ostyrd.
 * @param {boolean} [props.open] Styrt läge. Anges det äger appen öppet/stängt via `onOpenChange`.
 * @param {(open: boolean) => void} [props.onOpenChange] Anropas när användaren fäller ut eller ihop.
 * @param {string} [props.id]
 */
export function OpsDisclosure({ summary, children, defaultOpen = false, open, onOpenChange, id }) {
  const styrd = open !== undefined;
  const [internOppen, setInternOppen] = useState(defaultOpen);
  const arOppen = styrd ? open : internOppen;

  /** @param {any} e */
  function hanteraToggle(e) {
    const ny = e.currentTarget.open;
    // ⛔ I ostyrt läge följer state med native-elementet. I styrt läge rör vi
    // INTE internt state; appen bestämmer, annars finns två sanningar om öppet.
    if (!styrd) setInternOppen(ny);
    if (ny !== arOppen) onOpenChange?.(ny);
  }

  return (
    <details
      id={id}
      open={arOppen}
      onToggle={hanteraToggle}
      className="group rounded-lg border border-line bg-raised"
    >
      <summary
        className={cx(
          "flex cursor-pointer list-none items-center gap-3 p-4",
          // Native marker bort (den ligger annars kvar bredvid chevronen).
          "[&::-webkit-details-marker]:hidden",
          "rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        )}
      >
        <div className="min-w-0 flex-1">{summary}</div>
        <span
          aria-hidden="true"
          className={cx("shrink-0 text-ink-secondary transition-transform duration-(--duration-fast)", arOppen && "rotate-180")}
        >
          <ChevronNedIkon />
        </span>
      </summary>
      <div className="border-t border-divider p-4">{children}</div>
    </details>
  );
}
