import { BockIkon } from "./icons.jsx";
import { radKlass } from "../lib/radKlass.js";

/**
 * EN valbar rad i en meny eller dropdown: ikon (valfri), text, bock när den är vald.
 *
 * ══ ⛔ INTERN, OCH DEN ENDA RADEN SOM ÄR ETT VAL (0.31.2) ═════════════════════
 *
 * CP 2026-09-29 19:50, med en skärmbild av filtrets "Slag"-dropdown: "Typsnitten är inte syncade. Stor text och kanske inte rätt
 * typsnitt? Har ni verkligen gått igenom allt?" Raderna var `text-base` (16 px), `rounded-sm` och en tjock ram runt den valda,
 * skrivna om i `OpsFilterPanel`, `OpsFilterChip`, `OpsThemeToggle` och `OpsSegmented`, en kopia var, och ingen av dem var
 * `radKlass`. Menyns rader (`OpsPanelRow`) hade rättats i 0.30.0, valraderna glömdes eftersom de inte hette "meny".
 *
 * Raden är `radKlass` (SS `MobileHamburgerMenu.jsx:288`, `text-xs`, `px-3 py-2.5`, `rounded-[var(--radius)]`), vald = `bg-accent-subtle text-ink`
 * och en bock; SS filterdropdown (`ThemedDropdown.jsx:122-129`: vald rad `gold-overlay-subtle`, `Check` 12 px accent).
 * Ingen kant runt den valda raden.
 *
 * @param {object} props
 * @param {boolean} props.chosen
 * @param {() => void} props.onClick
 * @param {import("react").ReactNode} [props.ikon]
 * @param {boolean} [props.stor] `text-sm`, `py-2.5`: SS `TodayView.jsx:294` (statusmenyn). Utan: `text-xs`, `py-1.5`, SS `ThemedDropdown.jsx:122`.
 * @param {boolean} [props.radio] `role="menuitemradio"` och `aria-checked` i stället för `aria-pressed` (rader i en `role="menu"`).
 * @param {import("react").ReactNode} props.children
 */
export function ValRad({ chosen, onClick, ikon, radio = false, stor = false, children }) {
  return (
    <button
      type="button"
      {...(radio ? { role: "menuitemradio", "aria-checked": chosen } : { "aria-pressed": chosen })}
      onClick={onClick}
      className={radKlass(stor ? { vald: chosen, stor: true } : { vald: chosen, py: 1.5 })}
    >
      {ikon ? (
        <span aria-hidden="true" className="flex shrink-0 items-center [&_svg]:size-4">
          {ikon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {chosen ? (
        <span aria-hidden="true" className="shrink-0 text-accent">
          <BockIkon size={14} />
        </span>
      ) : null}
    </button>
  );
}
