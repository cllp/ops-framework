import { cx } from "../lib/cx.js";

/**
 * Räknemärket: ETT antal, en form, överallt där ramverket visar hur många.
 *
 * ── ⛔ VARFÖR EN KOMPONENT OCH INTE FYRA ──────────────────────────────────
 *
 * CP 2026-09-25 (ops-framework #97, bolag-ops #363), med skärmdump: inkorgens
 * märke var en liten röd cirkel med 8 px-siffra, klockans var en bred pill med
 * 12 px fet siffra, och en äldre version av klockans var krämfärgad med en
 * textfärg som aldrig funnits ("Nu har de ändrat färg men funkar inte i olika
 * ljus/mörk teman. Och för stor."). Tre ritningar av samma sak i samma rad, och
 * var och en hade sin egen bugg. Därför finns det nu en.
 *
 * ⛔ STORLEKEN: 16 px hög, siffran på typskalans MINSTA steg (`text-xs`) med
 * `tabular-nums`, halvfet och inte fet. Den tidigare 8 px-siffran låg utanför
 * skalan och gick inte att läsa på en telefon; den feta 12 px-siffran med luft
 * runt blev en klump som täckte halva klockan.
 *
 * ⛔ KAPAS VID 99+. "99+" ryms i samma höjd, och ett märke svarar på "finns det
 * något och ungefär hur mycket", inte på exakt antal. Det RIKTIGA talet står i
 * skärmläsartexten, så kapningen är en bredd och inte en lögn.
 *
 * ⛔ FÄRGEN ÄR `badge` / `badge-contrast`, i båda teman. Paret och märket mot
 * ytorna det sitter på är vaktade i `scripts/check-kontrast.mjs`. Skriv aldrig
 * `bg-accent` här: accenten är kräm i mörkt tema, och det var precis den
 * klumpen CP såg.
 *
 * ⛔ PLACERINGEN:
 *   - `icon`:   på en ikonknapp (44 px). Märket börjar strax till höger om
 *               ikonens mitt och sticker upp över dess hörn, så själva ikonen
 *               syns. Ringen i headerns ytfärg skiljer märket från ikonen.
 *   - `corner`: i hörnet på en flik med text (toppradens destinationer,
 *               filterknappen).
 *   - `inline`: efter ett ord i en rad (panelens rader).
 *
 * ⛔ Både siffra och skärmläsartext. En prick utan namn säger ingenting till den
 * som inte ser den, och en siffra utan substantiv säger inte nio av vad.
 *
 * @param {{ count: number, text?: string, placement?: "icon" | "corner" | "inline", max?: number }} props
 */
export function OpsCountBadge({ count, text = "", placement = "corner", max = 99 }) {
  if (!(typeof count === "number" && count > 0)) return null;
  const plats = PLATS[placement];
  if (plats === undefined) throw new Error(`OpsCountBadge: okänd placement "${placement}". Giltiga: ${Object.keys(PLATS).join(", ")}.`);
  return (
    <span
      data-ops-count-badge=""
      className={cx(
        "flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1",
        "bg-badge text-xs leading-none font-semibold tabular-nums text-badge-contrast",
        plats,
      )}
    >
      <span aria-hidden="true">{count > max ? `${max}+` : count}</span>
      {/* ⛔ Det riktiga talet och substantivet, uppläst, som EN text. */}
      <span className="sr-only">{text ? ` ${count} ${text}` : ` ${count}`}</span>
    </span>
  );
}

const PLATS = {
  icon: "pointer-events-none absolute top-1 left-1/2 ml-2 ring-2 ring-surface",
  corner: "pointer-events-none absolute -top-0.5 -right-0.5 ring-2 ring-surface",
  inline: "",
};

/**
 * Den gamla ingången, kvar för de interna anropen. Samma märke.
 * @param {{ count: number, text: string }} props
 */
export function Counter({ count, text }) {
  return <OpsCountBadge count={count} text={text} placement="corner" />;
}
