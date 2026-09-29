import { cx } from "../lib/cx.js";

/**
 * Ett val i pillform: ikon, ord, och ett av/på-läge.
 *
 * ══ ⛔ VARFÖR INTE `OpsFilterChip` ══════════════════════════════════════════
 *
 * `OpsFilterChip` är en TRIGGER: den öppnar en meny och visar vad menyn
 * innehåller. Den här är VALET SJÄLVT: en av flera pillerformade knappar som
 * står bredvid varandra och trycks direkt, utan att något fälls ut. #157,
 * CP:s tillägg om SessionStudios primitiver: "val som pillformade chips med
 * ikon och valt läge". Mätt i `ProfileView.jsx` (disciplin- och rollvalet):
 *
 *   flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs
 *   valt:    bg-accent (svag ton) + text-accent + kant i samma ton
 *   ovalt:   ytfärg + dämpad text + tunn kant
 *
 * ⛔ TILLSTÅNDET STÅR OCKSÅ I TEXTEN, INTE BARA I FÄRGEN. `aria-pressed` gör
 * "valt" hörbart för den som lyssnar, av samma skäl som `OpsFilterChip`
 * redan följer.
 *
 * ⛔ INGEN INBYGGD LISTA. Chipsen står i en `flex flex-wrap gap-2` som appen
 * själv sätter runt dem, precis som SessionStudios rad av discipliner. En
 * primitiv som också vore sin egen lista hade behövt känna till hur många som
 * får plats per rad, vilket den inte kan veta.
 *
 * @param {object} props
 * @param {import("react").ReactNode} [props.icon]
 * @param {import("react").ReactNode} props.children Ordet på chipet.
 * @param {boolean} [props.selected]
 * @param {() => void} props.onClick
 * @param {boolean} [props.disabled]
 */
export function OpsChip({ icon, children, selected = false, onClick, disabled = false }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-meta",
        "transition-colors duration-(--duration-fast) ease-standard",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:pointer-events-none disabled:opacity-50",
        selected
          ? "border-accent-subtle bg-accent-subtle font-semibold text-accent"
          : "border-line bg-surface text-ink-secondary hover:text-ink",
      )}
    >
      {icon ? (
        <span aria-hidden="true" className="flex shrink-0 items-center">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}
