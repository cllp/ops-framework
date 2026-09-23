import { cx } from "../lib/cx.js";

/**
 * Lista och listrad.
 *
 * ⛔ RADHÖJD SÄTTS ALDRIG I PIXLAR. Den regeln kostade oss mest av alla.
 *
 * SessionStudio virtualiserade sitt bibliotek med en fast radhöjd mot innehåll
 * som kunde fällas ut. Höjdkartan stämde inte längre med verkligheten, rader
 * klipptes, klick landade på fel rad och spara-knappen slutade gå att träffa.
 * Felet såg ut som tre olika buggar och var ett enda.
 *
 * Höjden kommer därför ur padding och innehåll. Behöver listan virtualiseras
 * ska mätaren mäta, och komponenten måste monteras om när utfällt läge ändras.
 */

/**
 * @param {object} props
 * @param {boolean} [props.divided] Avdelare mellan raderna.
 * @param {string} [props.ariaLabel]
 * @param {import("react").ReactNode} props.children
 */
export function OpsList({ divided = true, ariaLabel, children }) {
  return (
    <ul className={cx("m-0 flex list-none flex-col p-0", divided && "divide-y divide-divider")} aria-label={ariaLabel}>
      {children}
    </ul>
  );
}

/**
 * @param {object} props
 * @param {boolean} [props.interactive] Raden går att aktivera. Kräver onClick eller href.
 * @param {boolean} [props.selected]
 * @param {string} [props.href]
 * @param {(event: any) => void} [props.onClick]
 * @param {string} [props.ariaLabel] Radens namn för skärmläsare, när innehållet är visuellt.
 * @param {import("react").ReactNode} props.children
 */
export function OpsListRow({ interactive = false, selected = false, href, onClick, ariaLabel, children }) {
  const innehall = <div className="flex w-full items-center gap-3">{children}</div>;
  const rowClass = cx("px-4 py-3", selected && "bg-accent-subtle");

  if (!interactive) {
    return <li className={rowClass}>{innehall}</li>;
  }

  if (!href && !onClick) {
    throw new Error("OpsListRow: interactive kräver href eller onClick. En rad som ser klickbar ut men inte är det är en bugg användaren aldrig rapporterar.");
  }

  // ⛔ Den aktiverbara ytan är ett riktigt <a> eller <button>, aldrig ett <div>
  // med onClick. Ett div går inte att nå med tangentbord, saknar roll och
  // annonseras inte. Den genvägen ser ut att fungera i musen och stänger ute
  // alla andra.
  const ytKlass = cx(
    "flex w-full items-center gap-3 text-left cursor-pointer",
    "transition-colors duration-(--duration-fast) ease-standard",
    "hover:bg-accent-faint focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
  );

  return (
    <li className={cx(selected && "bg-accent-subtle")}>
      {href ? (
        <a className={cx(ytKlass, "px-4 py-3")} href={href} aria-label={ariaLabel} aria-current={selected || undefined}>
          {children}
        </a>
      ) : (
        <button type="button" className={cx(ytKlass, "px-4 py-3")} onClick={onClick} aria-label={ariaLabel} aria-current={selected || undefined}>
          {children}
        </button>
      )}
    </li>
  );
}
