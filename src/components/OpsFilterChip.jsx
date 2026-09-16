import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { cx } from "../lib/cx.js";
import { BockIkon, ChevronNedIkon } from "./icons.jsx";

/**
 * Pillerformat filter: visar vad som är valt, öppnar resten.
 *
 * ── ⛔ VARFÖR INTE `OpsSelect` ────────────────────────────────────────────
 *
 * `OpsSelect` är ett FORMULÄRFÄLT: rektangulärt, med etikett, byggt för att
 * fyllas i. Det här är ett FILTER: det står bredvid en lista, ändrar vad som
 * syns, och har inget värde att spara.
 *
 * Skillnaden syns i att ett tomt formulärfält är ofullständigt medan ett tomt
 * filter är normalläget. Därför visar den här "Alla X" och inte en tom ruta,
 * och därför är den ett piller och inte ett fält.
 *
 * Formen är avläst ur SessionStudios gruppfilter i Idag-vyn: ett piller med
 * text och chevron som öppnar en meny.
 *
 * ⛔ Valt värde står I PILLRET, inte bara i menyn. Ett filter som ser likadant
 * ut oavsett vad som är valt gör att man läser en filtrerad lista i tron att
 * den är komplett, och det är ett värre fel än att inte ha något filter alls.
 */

/**
 * @template {string} T
 * @param {object} props
 * @param {{ value: T | null, label: string }[]} props.options ⛔ Ta med `null` som "alla" om det ska gå att nollställa.
 * @param {T | null} props.value
 * @param {(value: T | null) => void} props.onChange
 * @param {string} props.ariaLabel Vad filtret filtrerar på.
 * @param {string} [props.allLabel] Texten när inget är valt.
 */
export function OpsFilterChip({ options, value, onChange, ariaLabel, allLabel = "Alla" }) {
  const [oppen, setOppen] = useState(false);
  const vald = options.find((o) => o.value === value);
  const text = value === null || value === undefined ? allLabel : (vald?.label ?? allLabel);
  const filtrerar = value !== null && value !== undefined;

  return (
    <Popover.Root open={oppen} onOpenChange={setOppen}>
      <Popover.Trigger
        aria-label={`${ariaLabel}: ${text}`}
        className={cx(
          "inline-flex min-h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium",
          "transition-colors duration-(--duration-fast) ease-standard",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          // ⛔ Ett aktivt filter ser annorlunda ut än ett vilande. Utan det går
          // det inte att se i förbifarten att listan är beskuren.
          filtrerar ? "bg-accent-subtle text-ink" : "bg-surface text-ink-secondary hover:text-ink",
        )}
      >
        {text}
        <span aria-hidden="true" className={cx("shrink-0 transition-transform duration-(--duration-fast)", oppen && "rotate-180")}>
          <ChevronNedIkon size={14} />
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-(--z-dropdown) min-w-52 rounded-md border border-line bg-raised p-1 shadow-md"
        >
          <div role="group" aria-label={ariaLabel} className="flex flex-col">
            {options.map((o) => {
              const valt = o.value === value;
              return (
                <button
                  key={o.value ?? "__alla"}
                  type="button"
                  aria-pressed={valt}
                  onClick={() => {
                    onChange(o.value);
                    setOppen(false);
                  }}
                  className={cx(
                    "flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-3 text-left text-base",
                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                    valt ? "bg-accent-subtle font-semibold text-ink" : "text-ink-secondary hover:bg-accent-faint hover:text-ink",
                  )}
                >
                  <span className="flex-1">{o.label}</span>
                  {valt ? (
                    <span aria-hidden="true" className="shrink-0 text-accent">
                      <BockIkon />
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
}
