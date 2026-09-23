import * as Select from "@radix-ui/react-select";
import { cx } from "../lib/cx.js";
import { useFieldBinding } from "./OpsField.jsx";
import { BockIkon, ChevronNedIkon } from "./icons.jsx";

/**
 * Designad väljare.
 *
 * ⛔ Rå `<select>` är förbjuden i produkt-UI. Den renderas av operativsystemet,
 * ser olika ut i varje webbläsare, kan inte bära tokens och kan inte visa något
 * annat än text. Ett förbud utan ersättare är bara gnäll, alltså finns den här.
 *
 * ⛔ Beteendet är INTE handskrivet. Tangentbordsnavigering, typeahead,
 * fokushantering, positionering och att stänga på Escape är veckor att göra
 * själv och osynligt fel tills någon faktiskt använder tangentbord. Radix gör
 * beteendet, vi gör utseendet. Det är den enda arbetsdelning som håller.
 */

/**
 * @param {object} props
 * @param {{ value: string, label: string, disabled?: boolean }[]} props.options
 * @param {string} [props.value]
 * @param {(value: string) => void} props.onChange
 * @param {string} [props.placeholder]
 * @param {boolean} [props.disabled]
 * @param {string} [props.ariaLabel] Bara när väljaren står utanför en OpsField.
 */
export function OpsSelect({ options, value, onChange, placeholder = "Välj", disabled = false, ariaLabel }) {
  if (!Array.isArray(options)) {
    throw new Error("OpsSelect: options måste vara en lista av { value, label }.");
  }
  const f = useFieldBinding();

  return (
    <Select.Root value={value} onValueChange={onChange} disabled={disabled} required={f.required || undefined}>
      <Select.Trigger
        id={f.id}
        className={cx(
          "inline-flex w-full items-center justify-between gap-2 rounded-md border bg-canvas px-3 py-2 min-h-11",
          "text-md md:text-base text-ink data-[placeholder]:text-ink-muted",
          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
          "disabled:opacity-55 disabled:cursor-not-allowed",
          f.invalid ? "border-danger" : "border-line",
        )}
        aria-label={ariaLabel}
        aria-invalid={f.invalid || undefined}
        aria-describedby={f.describedBy}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon className="text-ink-muted">
          <ChevronNedIkon />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        {/* Lagret kommer ur tokenkontraktet. ⛔ Aldrig en siffra här: två
            gissningar i olika komponenter blir en meny bakom en modal. */}
        <Select.Content
          position="popper"
          sideOffset={4}
          className="z-(--z-dropdown) overflow-hidden rounded-md border border-line bg-raised shadow-md"
        >
          <Select.Viewport className="max-h-72 p-1">
            {options.map((o) => (
              <Select.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className={cx(
                  "relative flex cursor-pointer select-none items-center gap-2 rounded-sm py-2 pl-8 pr-3 text-base text-ink",
                  "data-[highlighted]:bg-accent-faint data-[highlighted]:outline-none",
                  "data-[disabled]:opacity-55 data-[disabled]:cursor-not-allowed",
                )}
              >
                <Select.ItemIndicator className="absolute left-2 text-accent">
                  <BockIkon />
                </Select.ItemIndicator>
                <Select.ItemText>{o.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
