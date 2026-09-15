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
 * @typedef {object} Faltkoppling
 * @property {string} id
 * @property {string} [beskrivsAv]
 * @property {boolean} ogiltigt
 * @property {boolean} kravs
 */

/** @type {import("react").Context<Faltkoppling | null>} */
const FaltContext = createContext(/** @type {Faltkoppling | null} */ (null));

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
  const felId = error ? `${id}-fel` : undefined;
  const beskrivsAv = cx(hintId, felId) || undefined;

  return (
    <FaltContext.Provider value={{ id, beskrivsAv, ogiltigt: Boolean(error), kravs: required }}>
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
          <p id={felId} role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </FaltContext.Provider>
  );
}

/** @returns {{ id?: string, beskrivsAv?: string, ogiltigt: boolean, kravs: boolean }} */
export function useFaltKoppling() {
  return useContext(FaltContext) ?? { ogiltigt: false, kravs: false };
}

const KONTROLL_BAS =
  "w-full rounded-md border bg-canvas px-3 py-2 text-base text-ink placeholder:text-ink-muted " +
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
 * @param {(varde: string) => void} [props.onChange]
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
  const f = useFaltKoppling();
  return (
    <input
      id={f.id}
      className={cx(KONTROLL_BAS, f.ogiltigt ? "border-danger" : "border-line")}
      type={type}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      placeholder={placeholder}
      name={name}
      autoComplete={autoComplete}
      disabled={disabled}
      readOnly={readOnly}
      maxLength={maxLength}
      required={f.kravs || undefined}
      aria-label={ariaLabel}
      aria-invalid={f.ogiltigt || undefined}
      aria-describedby={f.beskrivsAv}
    />
  );
}

/**
 * @param {object} props
 * @param {string} [props.value]
 * @param {(varde: string) => void} [props.onChange]
 * @param {string} [props.placeholder]
 * @param {string} [props.name]
 * @param {number} [props.rows]
 * @param {boolean} [props.disabled]
 * @param {number} [props.maxLength]
 * @param {string} [props.ariaLabel]
 */
export function OpsTextarea({ value, onChange, placeholder, name, rows = 4, disabled = false, maxLength, ariaLabel }) {
  const f = useFaltKoppling();
  return (
    <textarea
      id={f.id}
      className={cx(KONTROLL_BAS, "resize-y", f.ogiltigt ? "border-danger" : "border-line")}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      placeholder={placeholder}
      name={name}
      rows={rows}
      disabled={disabled}
      maxLength={maxLength}
      required={f.kravs || undefined}
      aria-label={ariaLabel}
      aria-invalid={f.ogiltigt || undefined}
      aria-describedby={f.beskrivsAv}
    />
  );
}
