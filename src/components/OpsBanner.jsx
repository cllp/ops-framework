import { cx } from "../lib/cx.js";
import { KryssIkon } from "./icons.jsx";

/**
 * Banderoll, alltså ett meddelande som gäller hela vyn eller ett avsnitt.
 *
 * ⛔ Rollen växlar med tonen, och det är inte kosmetik. `info` och `success` får
 * `role="status"`, som skärmläsaren läser upp när den är klar med annat.
 * `warning` och `danger` får `role="alert"`, som avbryter. Ger man allt
 * `role="alert"` slutar användaren lita på avbrotten, och då går det riktiga
 * felet förlorat i bruset.
 *
 * ⛔ En banderoll ersätter inte ett fältfel. Ett fel som hör till ett fält hör
 * till det fältet (`OpsField`), annars måste den som ska rätta något gissa
 * vilket av nio fält som avses.
 */

const TONER = {
  info: { yta: "bg-info-bg border-info/30", text: "text-info", role: "status" },
  success: { yta: "bg-success-bg border-success/30", text: "text-success", role: "status" },
  warning: { yta: "bg-warning-bg border-warning/30", text: "text-warning", role: "alert" },
  danger: { yta: "bg-danger-bg border-danger/30", text: "text-danger", role: "alert" },
};

/**
 * @param {object} props
 * @param {"info"|"success"|"warning"|"danger"} [props.tone]
 * @param {string} props.title
 * @param {import("react").ReactNode} [props.children] Brödtext.
 * @param {import("react").ReactNode} [props.action] Knapp till höger.
 * @param {() => void} [props.onDismiss]
 * @param {string} [props.dismissLabel]
 */
export function OpsBanner({ tone = "info", title, children, action, onDismiss, dismissLabel = "Stäng meddelandet" }) {
  const t = TONER[tone];
  if (!t) {
    throw new Error(`OpsBanner: okänd tone "${tone}". Giltiga: ${Object.keys(TONER).join(", ")}.`);
  }
  return (
    <div role={t.role} className={cx("flex items-start gap-3 rounded-md border p-3", t.yta)}>
      <div className="min-w-0 flex-1">
        <p className={cx("m-0 text-base font-semibold", t.text)}>{title}</p>
        {children ? <div className="mt-1 text-base text-ink-secondary">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          /* ⛔ 44 px på telefon, 32 på skrivbord. En stängknapp som är för liten
             för tummen träffar antingen ingenting eller det som ligger bredvid,
             och det är värre än att inte kunna stänga alls. */
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-accent-faint hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:min-h-8 md:min-w-8"
        >
          <KryssIkon />
        </button>
      ) : null}
    </div>
  );
}
