import { cx } from "../lib/cx.js";
import { formatDateTime, formatRelativeDate } from "../lib/format.js";
import { OpsFact } from "./OpsFact.jsx";

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
 *
 * ── ⛔ ETT NYCKELTAL UTAN VÄG VIDARE ÄR EN ÅTERVÄNDSGRÄND ──────────────────
 *
 * Den första versionen visade bara en siffra. Den kunde inte klickas, sade inte
 * var talet kom ifrån och inte när det senast stämde. Följden syntes direkt i
 * bolag-ops: Kostnader summerade inte synligt mot Översiktens totalsumma, och
 * enda sättet att kontrollera var att räkna för hand.
 *
 * Därför tre tillägg, alla valfria och alla bakåtkompatibla:
 *
 *   - `source` säger varifrån talet kommer. Appens ord; ramverket vet aldrig
 *     vad Bokio är.
 *   - `updatedAt` säger när det senast stämde. **En siffra utan ålder läses som
 *     färsk**, alltid, och det är den vanligaste tysta lögnen i en översikt.
 *   - `onDrillDown` gör rutan till en riktig knapp som leder till de rader som
 *     bidrar till talet.
 *
 * ⛔ Rutan blir en `<button>` BARA när `onDrillDown` finns. En klickbar yta som
 * inte leder någonstans är värre än en död ruta: användaren trycker igen och
 * tror att appen hängt sig. Utan propen renderas ingen knapp och inget
 * fokusbart element, så tangentbordet hoppar inte heller över tomma rutor.
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
 * @param {"uppmatt"|"uppskattat"|"okant"|"scenario"} [props.fact] Hur sann siffran är. Märket hamnar under talet.
 * @param {string} [props.factLabel] Egen text i märket, t.ex. "Snitt 12 mån".
 * @param {string} [props.source] Varifrån talet kommer. Appens ord.
 * @param {Date|number|string} [props.updatedAt] När talet senast stämde. Visas i ord, med exakt tid i `title`.
 * @param {() => void} [props.onDrillDown] Gör rutan klickbar och leder till de rader som bidrar till talet.
 * @param {string} [props.drillDownLabel] Vad knappen heter för en skärmläsare. Standard säger att den visar underlaget.
 */
export function OpsStat({
  label,
  value,
  hint,
  tone = "neutral",
  badge,
  fact,
  factLabel,
  source,
  updatedAt,
  onDrillDown,
  drillDownLabel,
}) {
  const tonKlass = TONER[tone];
  if (!tonKlass) {
    throw new Error(`OpsStat: okänd tone "${tone}". Giltiga: ${Object.keys(TONER).join(", ")}.`);
  }

  const innehall = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="m-0 text-sm font-semibold text-ink-secondary">{label}</p>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      <p className={cx("m-0 mt-1 text-xl font-bold leading-tight tabular-nums", tonKlass)}>{value}</p>
      {hint ? <p className="m-0 mt-1 text-sm text-ink-muted">{hint}</p> : null}

      {fact ? (
        <div className="mt-2">
          <OpsFact kind={fact} label={factLabel} />
        </div>
      ) : null}

      {/* ⛔ Källa och ålder står på samma rad och i samma ton. De besvarar samma
          fråga, "kan jag lita på det här", och delas de upp läses den ena som
          viktigare än den andra. */}
      {source || updatedAt ? (
        <p className="m-0 mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-ink-muted">
          {source ? <span>{source}</span> : null}
          {source && updatedAt ? (
            <span aria-hidden="true" className="opacity-50">
              ·
            </span>
          ) : null}
          {updatedAt ? (
            // Exakt tid i `title`, ord på skärmen. "för 3 dagar sedan" är det
            // man vill veta i förbifarten; datumet är det man vill veta i det
            // ögonblick man börjar misstro talet.
            <time dateTime={tillIso(updatedAt)} title={formatDateTime(updatedAt)}>
              {formatRelativeDate(updatedAt)}
            </time>
          ) : null}
        </p>
      ) : null}
    </>
  );

  const base = "rounded-lg border border-line bg-raised p-4 text-left";

  if (!onDrillDown) {
    return <div className={base}>{innehall}</div>;
  }

  return (
    <button
      type="button"
      onClick={onDrillDown}
      aria-label={drillDownLabel ?? `${label}: visa underlaget`}
      className={cx(
        base,
        "block min-h-11 w-full cursor-pointer",
        "transition-colors duration-(--duration-fast) ease-standard hover:border-accent hover:bg-accent-faint",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
      )}
    >
      {innehall}
    </button>
  );
}

/** @param {Date|number|string} displayValue @returns {string | undefined} */
function tillIso(displayValue) {
  const d = displayValue instanceof Date ? displayValue : new Date(displayValue);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
