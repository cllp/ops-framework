import { cx } from "../lib/cx.js";

/**
 * Knapp.
 *
 * ⛔ Tar inte emot `className`, `style` eller `...rest`. Varianter ÄR API:et.
 * Saknas något: lägg till en variant här, lappa inte på anropsstället. Det är
 * den enda regeln som håller ihop resten, och den är vaktad av
 * `scripts/check-closed-api.mjs`.
 */

const VARIANTER = {
  primary: "border-transparent bg-accent text-accent-contrast hover:bg-accent-hover",
  secondary: "border-line-strong bg-raised text-ink hover:bg-sunken",
  ghost: "border-transparent text-ink-secondary hover:bg-accent-faint hover:text-ink",
  danger: "border-transparent bg-danger text-ink-inverse hover:bg-danger-hover",
};

/**
 * ⛔ Varken bredd eller höjd sätts i pixlar. En knapp som är exakt 32 px hög
 * klipper sin text så fort någon översätter etiketten till tyska. Höjden kommer
 * ur padding och radhöjd, alltså ur innehållet.
 *
 * `min-h-11` på md är däremot avsiktligt: 44 px är den minsta träffytan som
 * fungerar på en telefon, och den gränsen har vi mätt oss fram till en gång för
 * mycket.
 */
const STORLEKAR = {
  sm: "gap-1.5 px-3 py-1 text-sm min-h-8",
  md: "gap-2 px-4 py-2 text-base min-h-11",
};

const IKONSTORLEKAR = {
  sm: "px-1 py-1 min-w-8 min-h-8",
  md: "px-2 py-2 min-w-11 min-h-11",
};

const BAS =
  "inline-flex items-center justify-center rounded-md border font-semibold leading-tight " +
  "transition-colors duration-(--duration-fast) ease-standard " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:opacity-55 disabled:cursor-not-allowed aria-disabled:opacity-55 aria-disabled:cursor-not-allowed";

/**
 * @param {object} props
 * @param {"primary"|"secondary"|"ghost"|"danger"} [props.variant]
 * @param {"sm"|"md"} [props.size]
 * @param {"button"|"submit"|"reset"} [props.type]
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.busy] Visar och annonserar pågående arbete, och spärrar knappen.
 * @param {boolean} [props.fullWidth]
 * @param {boolean} [props.iconOnly] Kvadratisk träffyta. Kräver `ariaLabel`.
 * @param {string} [props.href] Anges href renderas en länk i stället för en knapp.
 * @param {boolean} [props.newTab]
 * @param {string} [props.ariaLabel]
 * @param {string} [props.title]
 * @param {string} [props.id]
 * @param {(event: any) => void} [props.onClick]
 * @param {import("react").ReactNode} props.children
 */
export function OpsButton({
  variant = "secondary",
  size = "md",
  type = "button",
  disabled = false,
  busy = false,
  fullWidth = false,
  iconOnly = false,
  href,
  newTab = false,
  ariaLabel,
  title,
  id,
  onClick,
  children,
}) {
  const variantKlass = VARIANTER[variant];
  if (!variantKlass) {
    throw new Error(
      `OpsButton: okänd variant "${variant}". Giltiga: ${Object.keys(VARIANTER).join(", ")}. ` +
        "En femte variant läggs till i OpsButton.jsx, inte på anropsstället.",
    );
  }
  const storlekKlass = iconOnly ? IKONSTORLEKAR[size] : STORLEKAR[size];
  if (!storlekKlass) {
    throw new Error(`OpsButton: okänd size "${size}". Giltiga: ${Object.keys(STORLEKAR).join(", ")}.`);
  }

  // ⛔ En ikonknapp utan namn är osynlig för skärmläsare och för röststyrning.
  // Att låta det passera är att bygga in ett tillgänglighetsfel som ingen ser
  // förrän någon faktiskt behöver det, alltså när det är dyrast att laga.
  if (iconOnly && !ariaLabel) {
    throw new Error("OpsButton: iconOnly kräver ariaLabel. En ikon utan namn går inte att nå med tangentbord eller röst.");
  }

  const klass = cx(BAS, variantKlass, storlekKlass, fullWidth && "w-full");
  const sparrad = disabled || busy;

  if (href) {
    // En spärrad länk har inget href. `pointer-events-none` räcker inte: den
    // stoppar musen men inte tangentbordet, och länken är kvar i tabordningen.
    return (
      <a
        id={id}
        className={klass}
        href={sparrad ? undefined : href}
        target={newTab ? "_blank" : undefined}
        rel={newTab ? "noreferrer noopener" : undefined}
        aria-label={ariaLabel}
        aria-disabled={sparrad || undefined}
        aria-busy={busy || undefined}
        title={title}
        onClick={sparrad ? undefined : onClick}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      id={id}
      className={klass}
      type={type}
      disabled={sparrad}
      aria-label={ariaLabel}
      aria-busy={busy || undefined}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
