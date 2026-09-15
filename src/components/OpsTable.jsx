import { cx } from "../lib/cx.js";

/**
 * Tabell.
 *
 * ⛔ Den viktigaste raden i filen är `overflow-x-auto` på omslaget. En tabell
 * som är bredare än skärmen ska scrolla i SIN EGEN behållare. Utan det scrollar
 * hela sidan i sidled på telefon, och då glider rubrik och innehåll isär så att
 * inget går att läsa. Det är ett fel som aldrig syns på en stor skärm.
 *
 * ⛔ Cellvärden får vara React-noder, och det bryter INTE det stängda API:et.
 * Skillnaden är att en nod är *innehåll*, medan `className` är *utseende*. En
 * tabell utan möjlighet att lägga ett piller i en cell är oanvändbar, men den
 * behöver aldrig kunna färgas om utifrån.
 *
 * ⛔ Siffror högerställs och får `tabular-nums`. Beloppskolumner med
 * proportionella siffror gör att kronorna inte linjerar, och då går kolumnen
 * inte att summera med ögat, vilket är hela poängen med en beloppskolumn.
 *
 * ⛔ Det finns med flit ingen `onRowClick`. En klickbar `<tr>` går inte att nå
 * med tangentbord, och att ge raden `role="button"` förstör tabellsemantiken:
 * en rad kan inte vara både rad och knapp. Lägg en länk eller en knapp i en
 * cell i stället. Samma regel som i OpsListRow, av samma skäl.
 */

/**
 * @typedef {object} Kolumn
 * @property {string} key
 * @property {string} label
 * @property {boolean} [numeric] Högerställd med tabular-nums.
 * @property {boolean} [tight] Kolumnen tar bara den bredd innehållet kräver.
 */

/**
 * @param {object} props
 * @param {Kolumn[]} props.columns
 * @param {Record<string, any>[]} props.rows Varje rad behöver ett `id`.
 * @param {string} props.caption Läses av skärmläsare. Dölj den visuellt med `hideCaption`.
 * @param {boolean} [props.hideCaption]
 * @param {boolean} [props.stickyHeader]
 * @param {import("react").ReactNode} [props.empty] Visas i stället för tom tabellkropp.
 */
export function OpsTable({ columns, rows, caption, hideCaption = false, stickyHeader = false, empty }) {
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error("OpsTable: columns krävs och måste ha minst en kolumn.");
  }
  if (!caption) {
    throw new Error(
      "OpsTable: caption krävs. Den är det enda som talar om för en skärmläsare vad tabellen innehåller, och utan den är en tabell bara ett rutnät av lösryckta värden.",
    );
  }

  if (Array.isArray(rows) && rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-base">
        <caption className={cx("text-left text-sm text-ink-muted", hideCaption ? "sr-only" : "pb-2")}>{caption}</caption>
        <thead>
          <tr className="border-b border-line">
            {columns.map((k) => (
              <th
                key={k.key}
                scope="col"
                className={cx(
                  "px-3 py-2 text-sm font-semibold text-ink-secondary",
                  k.numeric ? "text-right" : "text-left",
                  k.tight && "w-px whitespace-nowrap",
                  stickyHeader && "sticky top-0 z-(--z-sticky) bg-raised",
                )}
              >
                {k.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(rows ?? []).map((rad) => (
            <tr key={rad.id} className="border-b border-divider last:border-b-0">
              {columns.map((k) => (
                <td
                  key={k.key}
                  className={cx(
                    "px-3 py-2 align-top text-ink",
                    k.numeric ? "text-right tabular-nums" : "text-left",
                    k.tight && "whitespace-nowrap",
                  )}
                >
                  {rad[k.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
