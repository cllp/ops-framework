import { cx } from "../lib/cx.js";
import { handelseHref } from "../lib/handelsepanel.js";

/**
 * Titeln som länk till händelsens panel (0.40.0, #214): ETT ställe för en rad i Idag, ett postkort i kalenderns dagpanel och en rad i snabbtitten.
 *
 * ══ ⛔ EN LÄNK, INTE EN KNAPP, OCH DEN TÄCKER HELA RADEN ═════════════════════════════════════════════════════════════
 *
 * SS gör hela kortet tryckbart (`TodayView.jsx`, `DayDetailPanel.jsx`). Ett kort som är en `<button>` med knappar inuti är ogiltig
 * HTML och en skärmläsare som läser upp allt som en enda knapp. Här är titeln en `<a href="?handelse=<id>">` med ett riktigt namn och en
 * riktig adress (högerklick, ny flik), och länkens `::after` ligger över raden (`tacker`: raden måste vara `relative`, eller bära en negativ
 * `inset` som når kortets kant). Kontroller på raden (en åtgärd, en utfällning, en länk) har `relative z-10` och tar sina egna tryck.
 *
 * ⛔ ETT VANLIGT TRYCK ÖPPNAR PANELEN, ett tryck med Ctrl, Cmd, Skift, Alt eller mittknappen lämnas åt webbläsaren (en ny flik på samma sida med
 * `?handelse=<id>`, som skalet öppnar panelen på vid inläsning).
 *
 * @param {object} props
 * @param {string} props.id
 * @param {(id: string) => void} props.oppna
 * @param {string} props.tacker Klasserna för `::after` som gör länken till hela radens yta.
 * @param {import("react").ReactNode} props.children
 */
export function HandelseLank({ id, oppna, tacker, children }) {
  return (
    <a
      href={handelseHref(id)}
      data-handelselank=""
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        oppna(id);
      }}
      className={cx(
        "rounded-sm hover:underline focus-visible:outline-none",
        "after:absolute after:cursor-pointer focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent",
        tacker,
      )}
    >
      {children}
    </a>
  );
}
