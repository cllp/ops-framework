import { cx } from "../lib/cx.js";

/**
 * Nyckeltal.
 *
 * ⛔ Den här komponenten finns för att ramverkets EGEN exempelvy handrullade
 * en av rå markup. Att mitt eget exempel behövde uppfinna något är det
 * tydligaste beviset på en lucka som finns: varje app hade gjort samma sak, och
 * efter tre appar finns det tre olika nyckeltalsrutor.
 *
 * ⛔ Siffran får `tabular-nums`. Ett tal som ändras varje minut hoppar i bredd
 * med proportionella siffror, och en ruta som rör sig när ingenting hänt läser
 * ögat som att något hänt.
 *
 * Rutnätet är INTE inbyggt här. Att lägga tre nyckeltal bredvid varandra är
 * layout, och layout är Tailwinds jobb: `grid gap-4 md:grid-cols-3`.
 */

const TONER = {
  neutral: "text-ink",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

/**
 * @param {object} props
 * @param {string} props.label
 * @param {string | number} props.value
 * @param {string} [props.hint] Rad under siffran. Jämförelse, period, eller vad talet avser.
 * @param {"neutral"|"success"|"warning"|"danger"} [props.tone]
 * @param {import("react").ReactNode} [props.badge] Litet märke uppe till höger, till exempel ett piller.
 */
export function OpsStat({ label, value, hint, tone = "neutral", badge }) {
  const tonKlass = TONER[tone];
  if (!tonKlass) {
    throw new Error(`OpsStat: okänd tone "${tone}". Giltiga: ${Object.keys(TONER).join(", ")}.`);
  }
  return (
    <div className="rounded-lg border border-line bg-raised p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="m-0 text-sm font-semibold text-ink-secondary">{label}</p>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      <p className={cx("m-0 mt-1 text-xl font-bold leading-tight tabular-nums", tonKlass)}>{value}</p>
      {hint ? <p className="m-0 mt-1 text-sm text-ink-muted">{hint}</p> : null}
    </div>
  );
}
