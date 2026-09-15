import { useId } from "react";
import { cx } from "../lib/cx.js";
import { BockIkon } from "./icons.jsx";

/**
 * Kryssruta och reglage.
 *
 * ⛔ Båda bygger på en riktig `<input type="checkbox">`, som ligger kvar i
 * DOM:en och bara är visuellt dold. Ett `<div>` med `role="checkbox"` måste
 * annars återimplementera fokus, mellanslagstangenten, formulärinlämning och
 * webbläsarens autofyll, och det blir fel på minst ett av fyra sätt varje gång.
 *
 * `sr-only` och inte `display: none`: ett gömt fält med `display: none` går
 * inte att fokusera och skickas inte med i formuläret.
 *
 * ⛔ Skillnaden mellan de två är BETYDELSE, inte utseende. En kryssruta väljer
 * något som träder i kraft när man sparar. Ett reglage slår om något direkt.
 * Använder man reglage för det första undrar användaren varför inget hände.
 */

/** @param {{ label: string, checked: boolean, onChange: (v: boolean) => void, disabled?: boolean, hint?: string }} props */
export function OpsCheckbox({ label, checked, onChange, disabled = false, hint }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={cx("flex cursor-pointer items-center gap-2 text-base text-ink", disabled && "cursor-not-allowed opacity-55")}>
        <input
          id={id}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          aria-describedby={hintId}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          aria-hidden="true"
          className={cx(
            "inline-flex size-5 shrink-0 items-center justify-center rounded-sm border border-line-strong bg-canvas text-accent-contrast",
            "peer-checked:border-accent peer-checked:bg-accent",
            "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
          )}
        >
          {checked ? <BockIkon size={14} /> : null}
        </span>
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="pl-7 text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** @param {{ label: string, checked: boolean, onChange: (v: boolean) => void, disabled?: boolean, hint?: string }} props */
export function OpsSwitch({ label, checked, onChange, disabled = false, hint }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={cx("flex cursor-pointer items-center gap-3 text-base text-ink", disabled && "cursor-not-allowed opacity-55")}>
        <input
          id={id}
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          aria-describedby={hintId}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          aria-hidden="true"
          className={cx(
            "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full bg-sunken",
            "transition-colors duration-(--duration-fast) ease-standard",
            "peer-checked:bg-accent",
            "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
          )}
        >
          <span
            className={cx(
              "absolute left-0.5 size-5 rounded-full bg-canvas shadow-sm",
              "transition-transform duration-(--duration-fast) ease-standard",
              checked && "translate-x-4",
            )}
          />
        </span>
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="pl-13 text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
