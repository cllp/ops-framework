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
 * ⛔ UTSEENDET ÄR INKORGENS GAMLA MÄRKE, ORD FÖR ORD. CP 2026-09-25 18:10, om
 * första versionen (#100) som gick på `text-xs` halvfet med ring: "Du tog den
 * som var ful. Du skulle ta den som var på inkorg innan." Förlagan är
 * `Counter` i 414c56d: `absolute -top-0.5 -right-0.5 flex h-4 min-w-4
 * items-center justify-center rounded-full px-0.5 bg-badge text-[8px]
 * font-bold text-badge-contrast`, ingen ring. De värdena gäller här, för
 * varje placering. Ändra dem inte mot typskalan utan att CP ser en bild först:
 * 12 px-siffran var precis den klump han inte ville ha.
 *
 * ⛔ Två siffror och "99+" breddar PILLEN (`min-w-4` + `px-0.5`), texten
 * växer aldrig.
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
 *   - `icon`:   på en ikonknapp (44 px), i knappens övre högra hörn
 *               (`-top-0.5 -right-0.5`), som inkorgens märke alltid suttit.
 *               Ikonen syns, eftersom knappen är större än ikonen.
 *   - `corner`: samma hörn på en flik med text (toppradens destinationer,
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
        "flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-0.5",
        "bg-badge text-[8px] font-bold tabular-nums text-badge-contrast",
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
  icon: "pointer-events-none absolute -top-0.5 -right-0.5",
  corner: "pointer-events-none absolute -top-0.5 -right-0.5",
  inline: "",
};

/**
 * Den gamla ingången, kvar för de interna anropen. Samma märke.
 * @param {{ count: number, text: string }} props
 */
export function Counter({ count, text }) {
  return <OpsCountBadge count={count} text={text} placement="corner" />;
}
