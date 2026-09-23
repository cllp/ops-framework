import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { cx } from "../lib/cx.js";
import { BockIkon, ChevronNedIkon, ReglageIkon } from "./icons.jsx";

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
 * Formen är avläst ur SessionStudio: piller med text+chevron, eller (variant
 * `icon`) en reglageikon bredvid ett centrerat segment — som SS Idag.
 *
 * ⛔ Valt värde syns PÅ TRIGGERN, inte bara i menyn. Chip-varianten skriver
 * ordet i pillret; ikon-varianten tänder accentfärg (och appen kan dessutom
 * skriva etiketten under verktygsraden). Ett filter som ser likadant ut oavsett
 * val gör att man läser en filtrerad lista i tron att den är komplett.
 *
 * ⛔ Menyval får valfri `icon`. Utan den är raden bara text+bock — bra nog för
 * Inkorgs statusfilter — men Idags slagfilter behöver ikon per typ.
 */

/**
 * @template {string} T
 * @param {object} props
 * @param {{ value: T | null, label: string, icon?: import("react").ReactNode }[]} props.options ⛔ Ta med `null` som "alla" om det ska gå att nollställa.
 * @param {T | null} props.value
 * @param {(value: T | null) => void} props.onChange
 * @param {string} props.ariaLabel Vad filtret filtrerar på.
 * @param {string} [props.allLabel] Texten när inget är valt (chip-variant).
 * @param {"chip"|"icon"} [props.variant] `chip` = textpiller (default). `icon` = reglageikon som SessionStudio.
 */
export function OpsFilterChip({ options, value, onChange, ariaLabel, allLabel = "Alla", variant = "chip" }) {
  const [oppen, setOppen] = useState(false);
  const chosen = options.find((o) => o.value === value);
  const text = value === null || value === undefined ? allLabel : (chosen?.label ?? allLabel);
  const filters = value !== null && value !== undefined;

  if (variant !== "chip" && variant !== "icon") {
    throw new Error(`OpsFilterChip: okänd variant "${variant}". Giltiga: chip, icon.`);
  }

  return (
    <Popover.Root open={oppen} onOpenChange={setOppen}>
      <Popover.Trigger
        aria-label={`${ariaLabel}: ${text}`}
        aria-pressed={filters}
        title={text}
        className={cx(
          "inline-flex cursor-pointer items-center transition-colors duration-(--duration-fast) ease-standard",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          variant === "icon"
            ? cx(
                "min-h-11 min-w-11 justify-center rounded-md",
                // ⛔ Accentfärg när filtret är aktivt — subtil yta räcker inte:
                // på mörk duk syns den knappt, och då ser reglaget likadant ut
                // som i Alla-läget (felet CP skärmdumpade).
                filters
                  ? "bg-accent-subtle text-accent"
                  : "text-ink-secondary hover:bg-accent-faint hover:text-ink",
              )
            : cx(
                "min-h-9 gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium",
                filters ? "bg-accent-subtle font-semibold text-accent" : "bg-surface text-ink-secondary hover:text-ink",
              ),
        )}
      >
        {variant === "icon" ? (
          <ReglageIkon size={20} />
        ) : (
          <>
            {text}
            <span aria-hidden="true" className={cx("shrink-0 transition-transform duration-(--duration-fast)", oppen && "rotate-180")}>
              <ChevronNedIkon size={14} />
            </span>
          </>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={variant === "icon" ? "end" : "start"}
          sideOffset={4}
          className="z-(--z-dropdown) min-w-52 rounded-md border border-line bg-raised p-1 shadow-md"
        >
          <div role="group" aria-label={ariaLabel} className="flex flex-col">
            {options.map((o) => {
              const chosen = o.value === value;
              return (
                <button
                  key={o.value ?? "__alla"}
                  type="button"
                  aria-pressed={chosen}
                  onClick={() => {
                    onChange(o.value);
                    setOppen(false);
                  }}
                  className={cx(
                    "flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-3 text-left text-base",
                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                    chosen ? "bg-accent-subtle font-semibold text-ink" : "text-ink-secondary hover:bg-accent-faint hover:text-ink",
                  )}
                >
                  {o.icon ? <span className="shrink-0 text-ink-secondary">{o.icon}</span> : null}
                  <span className="flex-1">{o.label}</span>
                  {chosen ? (
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
