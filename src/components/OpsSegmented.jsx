import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { cx } from "../lib/cx.js";
import { BockIkon, ChevronNedIkon } from "./icons.jsx";

/**
 * Segmenterad väljare: två eller tre lägen som delar en yta, där ett är valt.
 *
 * ── ⛔ VARFÖR DEN INTE ÄR `OpsTabs` ────────────────────────────────────────
 *
 * `OpsTabs` byter INNEHÅLL: varje flik har sin egen panel, och panelerna är
 * olika saker. Den här byter URVAL i samma innehåll: samma sorts rader, ett
 * annat filter. Skillnaden är inte kosmetisk. En flikrad lovar "här finns mer
 * att läsa", en segmentväljare lovar "det här är samma lista, sedd annorlunda",
 * och byter man dem mot varandra letar läsaren efter innehåll som inte finns.
 *
 * ── ⛔ FORMEN ÄR AVLÄST, INTE VALD ────────────────────────────────────────
 *
 * SessionStudios Idag/Kommande-väljare (`apps/web/src/views/TodayView.jsx`):
 *
 *   spår:     flex items-center bg-[--color-bg-surface] rounded-full p-1
 *   segment:  flex items-center gap-1 px-5 py-2 rounded-full text-sm
 *             font-medium transition-all
 *   valt:     bg-[--color-text-primary] text-[--color-bg-primary] shadow-sm
 *   ovalt:    text-[--color-text-muted] hover:text-[--color-text-secondary]
 *
 * Översatt till tokenkontraktet: `text-primary` är `ink`, `bg-primary` är
 * `canvas`, `bg-surface` är `surface`.
 *
 * ⛔ Det valda segmentet är FYLLT och mörkt, till skillnad från toppradens
 * understrykning. Det är inte en inkonsekvens: i en flikrad konkurrerar den
 * aktiva med tio andra ord och ska vara lugn, i en väljare med två lägen är
 * fyllningen det som säger vilket läge man står i. Samma skillnad gör
 * SessionStudio.
 *
 * ⛔ Antalet segment är två eller tre. Fler och orden blir för korta för att
 * betyda något, och då är det en flikrad eller en dropdown man vill ha.
 *
 * ── ⛔ VALFRI UNDERMENY (SessionStudio Idag | Tidigare) ───────────────────
 *
 * Ett segment kan bära `menu` med underlägen. Chevron syns bara när segmentet
 * är aktivt. Klick på ett inaktivt segment byter till segmentets `value`
 * (huvudläge). Klick på ett redan aktivt segment öppnar menyn. `value` från
 * föräldern får vara antingen segmentets `value` eller ett menyitems `value`;
 * båda räknas som att segmentet är valt, och etiketten följer menyvalet.
 */

/**
 * @template {string} T
 * @param {object} props
 * @param {{
 *   value: T,
 *   label: string,
 *   badge?: number,
 *   menu?: { items: { value: T, label: string, icon?: import("react").ReactNode }[] },
 * }[]} props.options Två eller tre lägen.
 * @param {T} props.value
 * @param {(value: T) => void} props.onChange
 * @param {string} props.ariaLabel Vad väljaren väljer bland, för skärmläsare.
 */
export function OpsSegmented({ options, value, onChange, ariaLabel }) {
  if (!Array.isArray(options) || options.length < 2 || options.length > 3) {
    throw new Error(
      `OpsSegmented: två eller tre lägen, inte ${Array.isArray(options) ? options.length : "inget"}. Fler lägen gör orden för korta för att betyda något, och då är det OpsTabs eller OpsSelect du vill ha.`,
    );
  }

  const [menyFor, setMenyFor] = useState(/** @type {string | null} */ (null));

  return (
    <div role="tablist" aria-label={ariaLabel} className="inline-flex items-center rounded-full bg-surface p-1">
      {options.map((o) => {
        const menyItems = o.menu?.items;
        const harMeny = Array.isArray(menyItems) && menyItems.length > 0;
        const menyMatch = harMeny ? menyItems.find((i) => i.value === value) : undefined;
        const valt = o.value === value || Boolean(menyMatch);
        const etikett = menyMatch?.label ?? o.label;
        const menyOppen = harMeny && valt && menyFor === o.value;

        const knappen = (
          <button
            type="button"
            role="tab"
            aria-selected={valt}
            aria-haspopup={harMeny ? "menu" : undefined}
            aria-expanded={harMeny ? menyOppen : undefined}
            onClick={() => {
              if (!valt) {
                onChange(o.value);
                setMenyFor(null);
                return;
              }
              if (harMeny) {
                setMenyFor((nu) => (nu === o.value ? null : o.value));
              }
            }}
            className={cx(
              "inline-flex min-h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-5 py-2 text-sm font-medium",
              "transition-all duration-(--duration-fast) ease-standard",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              valt ? "bg-ink text-canvas shadow-sm" : "text-ink-muted hover:text-ink-secondary",
            )}
          >
            {etikett}
            {typeof o.badge === "number" && o.badge > 0 ? (
              // ⛔ Siffran står INNE i segmentet och inte som en cirkel ovanpå.
              // En påhängd badge på ett valt, fyllt segment får två bakgrunder
              // ovanpå varandra och blir en fläck. Här är den en del av ordet.
              <span className={cx("tabular-nums", valt ? "opacity-80" : "opacity-70")}>{o.badge}</span>
            ) : null}
            {valt && harMeny ? (
              <span
                aria-hidden="true"
                className={cx("shrink-0 transition-transform duration-(--duration-fast)", menyOppen && "rotate-180")}
              >
                <ChevronNedIkon size={14} />
              </span>
            ) : null}
          </button>
        );

        if (!harMeny) {
          return <span key={o.value}>{knappen}</span>;
        }

        return (
          <Popover.Root
            key={o.value}
            open={menyOppen}
            onOpenChange={(nasta) => {
              if (!nasta) setMenyFor(null);
            }}
          >
            <Popover.Anchor asChild>{knappen}</Popover.Anchor>
            <Popover.Portal>
              <Popover.Content
                align="center"
                sideOffset={8}
                className="z-(--z-dropdown) min-w-52 overflow-hidden rounded-xl border border-line bg-raised py-1 shadow-md"
                onCloseAutoFocus={(e) => e.preventDefault()}
              >
                <div role="menu" aria-label={o.label} className="flex flex-col">
                  {menyItems.map((item) => {
                    const aktiv = item.value === value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={aktiv}
                        onClick={() => {
                          onChange(item.value);
                          setMenyFor(null);
                        }}
                        className={cx(
                          "flex min-h-11 w-full cursor-pointer items-center gap-3 px-3 text-left text-sm",
                          "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                          aktiv
                            ? "bg-accent-subtle font-semibold text-ink"
                            : "text-ink-secondary hover:bg-accent-faint hover:text-ink",
                        )}
                      >
                        {item.icon ? <span className="shrink-0 text-ink-secondary">{item.icon}</span> : null}
                        <span className="flex-1">{item.label}</span>
                        {aktiv ? (
                          <span aria-hidden="true" className="shrink-0 text-accent">
                            <BockIkon size={14} />
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        );
      })}
    </div>
  );
}
