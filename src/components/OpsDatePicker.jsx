import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { DayPicker } from "react-day-picker";
import { sv } from "react-day-picker/locale";
import { cx } from "../lib/cx.js";
import { formatDate } from "../lib/format.js";
import { useFieldBinding } from "./OpsField.jsx";
import { ChevronNedIkon } from "./icons.jsx";

/**
 * Datumväljare.
 *
 * ⛔ Den här komponenten finns för att `OpsInput` FÖRBJUDER `type="date"` och
 * lovar en ersättare. Ett förbud utan ersättare är gnäll, och ett löfte i koden
 * som inte hålls är skuld. Nu är löftet infriat.
 *
 * ⛔ Värdet är en ISO-sträng `"ÅÅÅÅ-MM-DD"`, inte ett `Date`.
 *
 * Skälet är den dyraste datumfällan som finns: `new Date("2026-07-01")` tolkas
 * som midnatt i UTC, medan `new Date("2026-07-01T00:00")` tolkas som lokal tid.
 * I svensk sommartid betyder det att ett kalenderdatum kan visas, sparas eller
 * jämföras som dagen innan. Ett `Date`-objekt i API:et hade bjudit in det felet
 * vid varje anropsställe. En ren datumsträng kan inte gå fel.
 *
 * Kalenderns beteende, alltså tangentbord, månadsnavigering och veckostart, kommer
 * från react-day-picker. Utseendet är vårt.
 */

/** @param {Date} d @returns {string} */
function tillIso(d) {
  const ar = d.getFullYear();
  const man = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${ar}-${man}-${day}`;
}

/**
 * ⛔ Byggs som LOKAL midnatt, med avsikt. Kalendern arbetar i användarens
 * tidszon, och att skapa datumet via `new Date(iso)` hade gett UTC-midnatt,
 * alltså fel dag markerad för halva jordklotet.
 * @param {string | undefined} iso @returns {Date | undefined}
 */
function franIso(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const [ar, man, day] = iso.split("-").map(Number);
  return new Date(ar, man - 1, day);
}

/**
 * @param {object} props
 * @param {string} [props.value] ISO-datum, "ÅÅÅÅ-MM-DD".
 * @param {(iso: string | undefined) => void} props.onChange
 * @param {string} [props.placeholder]
 * @param {boolean} [props.disabled]
 * @param {string} [props.ariaLabel] Bara när väljaren står utanför en OpsField.
 * @param {string} [props.clearLabel]
 */
export function OpsDatePicker({ value, onChange, placeholder = "Välj datum", disabled = false, ariaLabel, clearLabel = "Rensa datum" }) {
  const [oppen, setOppen] = useState(false);
  const f = useFieldBinding();
  const chosen = franIso(value);

  return (
    <Popover.Root open={oppen} onOpenChange={setOppen}>
      <Popover.Trigger
        id={f.id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={f.invalid || undefined}
        aria-describedby={f.describedBy}
        className={cx(
          "inline-flex w-full items-center justify-between gap-2 rounded-md border bg-canvas px-3 py-2 min-h-11 text-md md:text-base",
          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
          "disabled:opacity-55 disabled:cursor-not-allowed",
          f.invalid ? "border-danger" : "border-line",
          chosen ? "text-ink" : "text-ink-muted",
        )}
      >
        {chosen ? formatDate(value) : placeholder}
        <ChevronNedIkon />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          className="z-(--z-dropdown) max-w-[calc(100vw---spacing(6))] rounded-md border border-line bg-raised p-3 shadow-md"
        >
          <DayPicker
            mode="single"
            locale={sv}
            weekStartsOn={1}
            showOutsideDays
            selected={chosen}
            month={chosen}
            onSelect={(d) => {
              onChange(d ? tillIso(d) : undefined);
              setOppen(false);
            }}
            classNames={{
              months: "text-base text-ink",
              month_caption: "flex items-center justify-center py-1 text-base font-semibold text-ink",
              nav: "flex items-center justify-between",
              // 44px träffyta på telefon (size-11), tätare på desktop (md:size-9).
              button_previous: "inline-flex size-11 md:size-9 items-center justify-center rounded-md text-ink-secondary hover:bg-accent-faint",
              button_next: "inline-flex size-11 md:size-9 items-center justify-center rounded-md text-ink-secondary hover:bg-accent-faint",
              weekday: "text-xs font-semibold text-ink-muted",
              day: "p-0",
              day_button:
                "inline-flex size-11 md:size-9 items-center justify-center rounded-md text-base text-ink hover:bg-accent-faint focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
              selected: "[&_button]:bg-accent [&_button]:text-accent-contrast",
              today: "[&_button]:font-bold [&_button]:text-accent",
              outside: "[&_button]:text-ink-muted",
              disabled: "[&_button]:opacity-40",
            }}
          />
          {value ? (
            <button
              type="button"
              onClick={() => {
                onChange(undefined);
                setOppen(false);
              }}
              className="mt-2 w-full rounded-md px-3 py-2 text-base text-ink-secondary hover:bg-accent-faint hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {clearLabel}
            </button>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
