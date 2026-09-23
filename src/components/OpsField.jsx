import { createContext, useContext, useId } from "react";
import { cx } from "../lib/cx.js";

/**
 * Fält, etikett, hjälptext och fel.
 *
 * ⛔ Felet hör till fältet, aldrig till en global banner högst upp. Den som ska
 * rätta något behöver se VAD som är fel utan att leta, och en banner som säger
 * "något gick fel" kräver att användaren gissar vilket av nio fält som menas.
 *
 * Kopplingen mellan etikett, fält, hjälptext och fel görs med id som ramverket
 * genererar. Det är precis den sortens arbete som blir fel när varje vy gör det
 * själv, och som ingen upptäcker förrän någon använder skärmläsare.
 */

/**
 * @typedef {object} FieldBinding
 * @property {string} id
 * @property {string} [describedBy]
 * @property {boolean} invalid
 * @property {boolean} required
 */

/** @type {import("react").Context<FieldBinding | null>} */
const FieldContext = createContext(/** @type {FieldBinding | null} */ (null));

/**
 * @param {object} props
 * @param {string} props.label
 * @param {string} [props.hint]
 * @param {string} [props.error] Sträng, inte boolean. Ett fält som bara vet ATT det är fel hjälper ingen.
 * @param {boolean} [props.required]
 * @param {import("react").ReactNode} props.children
 */
export function OpsField({ label, hint, error, required = false, children }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-fel` : undefined;
  const describedBy = cx(hintId, errorId) || undefined;

  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error), required: required }}>
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-sm font-semibold text-ink-secondary">
          {label}
          {required ? (
            <span className="text-danger" aria-hidden="true">
              {" *"}
            </span>
          ) : null}
        </label>
        {children}
        {hint ? (
          <p id={hintId} className="text-sm text-ink-muted">
            {hint}
          </p>
        ) : null}
        {error ? (
          // role="alert" gör att felet läses upp när det dyker upp, inte bara
          // när någon råkar navigera förbi det.
          <p id={errorId} role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

/** @returns {{ id?: string, describedBy?: string, invalid: boolean, required: boolean }} */
export function useFieldBinding() {
  return useContext(FieldContext) ?? { invalid: false, required: false };
}

// ⛔ `text-md` (16px) på telefon, `md:text-base` (14px) på desktop. Under 16px
// zoomar iOS Safari in fältet vid fokus och lämnar användaren utzoomad efteråt.
// Densiteten på desktop är oförändrad.
const KONTROLL_BAS =
  "w-full rounded-md border bg-canvas px-3 py-2 text-md md:text-base text-ink placeholder:text-ink-muted " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent " +
  "disabled:opacity-55 disabled:cursor-not-allowed";

/**
 * ⛔ `date`, `time`, `datetime-local`, `month`, `week` och `color` saknas
 * medvetet. De renderas av webbläsaren, ser olika ut i var och en, går inte att
 * tokenisera och kan inte översättas. Ett förbud utan ersättare är bara gnäll,
 * så ramverket levererar `OpsSelect` och (nästa steg) en datumväljare.
 */
const TILLATNA_TYPER = ["text", "email", "search", "tel", "url", "password", "number"];

/**
 * @param {object} props
 * @param {string} [props.value]
 * @param {(value: string) => void} [props.onChange]
 * @param {"text"|"email"|"search"|"tel"|"url"|"password"|"number"} [props.type]
 * @param {string} [props.placeholder]
 * @param {string} [props.name]
 * @param {string} [props.autoComplete]
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.readOnly]
 * @param {number} [props.maxLength]
 * @param {string} [props.ariaLabel] Bara när fältet står utanför en OpsField.
 */
export function OpsInput({
  value,
  onChange,
  type = "text",
  placeholder,
  name,
  autoComplete,
  disabled = false,
  readOnly = false,
  maxLength,
  ariaLabel,
}) {
  if (!TILLATNA_TYPER.includes(type)) {
    throw new Error(
      `OpsInput: typen "${type}" är inte tillåten. Giltiga: ${TILLATNA_TYPER.join(", ")}. ` +
        "Webbläsarens egna datum- och färgväljare ser olika ut i varje webbläsare och går inte att tokenisera.",
    );
  }
  const f = useFieldBinding();
  return (
    <input
      id={f.id}
      className={cx(KONTROLL_BAS, f.invalid ? "border-danger" : "border-line")}
      type={type}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      placeholder={placeholder}
      name={name}
      autoComplete={autoComplete}
      disabled={disabled}
      readOnly={readOnly}
      maxLength={maxLength}
      required={f.required || undefined}
      aria-label={ariaLabel}
      aria-invalid={f.invalid || undefined}
      aria-describedby={f.describedBy}
    />
  );
}

/**
 * @param {object} props
 * @param {string} [props.value]
 * @param {(value: string) => void} [props.onChange]
 * @param {string} [props.placeholder]
 * @param {string} [props.name]
 * @param {number} [props.rows]
 * @param {boolean} [props.disabled]
 * @param {number} [props.maxLength]
 * @param {string} [props.ariaLabel]
 * @param {() => void} [props.onSend] Anropas på Cmd eller Ctrl plus Enter.
 *
 *   ⛔ EN NAMNGIVEN GENVÄG OCH INTE EN RÅ `onKeyDown`. Tog fältet emot godtyckliga
 *   tangenthanterare skulle varje app välja sin egen genväg, och samma ruta skickas
 *   med Enter i den ena appen och med Cmd plus Enter i den andra. Det är samma sorts
 *   drift som ett `className` ger, fast i beteende.
 *
 *   ⛔ ENTER ENSAMT SKICKAR ALDRIG. En textarea bär flera rader, och en ruta där
 *   Enter skickar gör radbrytning omöjlig utan att man först lärt sig en genväg.
 */
export function OpsTextarea({ value, onChange, placeholder, name, rows = 4, disabled = false, maxLength, ariaLabel, onSend }) {
  const f = useFieldBinding();
  return (
    <textarea
      onKeyDown={
        onSend
          ? (e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onSend();
              }
            }
          : undefined
      }
      id={f.id}
      className={cx(KONTROLL_BAS, "resize-y", f.invalid ? "border-danger" : "border-line")}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      placeholder={placeholder}
      name={name}
      rows={rows}
      disabled={disabled}
      maxLength={maxLength}
      required={f.required || undefined}
      aria-label={ariaLabel}
      aria-invalid={f.invalid || undefined}
      aria-describedby={f.describedBy}
    />
  );
}
