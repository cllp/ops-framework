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
 * ⛔ `fler` (chattens nattskiva): antalet är ett GOLV, inte ett antal. Chattens olästa räknas över de senaste 50 meddelandena, och 120
 * olästa visades som 50, utan plustecken. Märket skriver då "50+" och skärmläsaren "50 eller fler", så att taket syns i stället
 * för att se ut som en exakt siffra (arbetsreglernas punkt 5).
 *
 * @param {{ count: number, text?: string, placement?: "icon" | "corner" | "inline", max?: number, fler?: boolean }} props
 */
export function OpsCountBadge({ count, text = "", placement = "corner", max = 99, fler = false }) {
  if (!(typeof count === "number" && count > 0)) return null;
  const plats = PLATS[placement];
  if (plats === undefined) throw new Error(`OpsCountBadge: okänd placement "${placement}". Giltiga: ${Object.keys(PLATS).join(", ")}.`);
  return (
    <span
      data-ops-count-badge=""
      className={cx(
        "flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-0.5",
        "bg-badge text-mikro tabular-nums text-badge-contrast",
        plats,
      )}
    >
      <span aria-hidden="true">{count > max ? `${max}+` : fler ? `${count}+` : count}</span>
      {/* ⛔ Det riktiga talet och substantivet, uppläst, som EN text. Med `fler` är talet ett golv, och det sägs. */}
      <span className="sr-only">{`${fler ? ` ${count} eller fler` : ` ${count}`}${text ? ` ${text}` : ""}`}</span>
    </span>
  );
}

const PLATS = {
  icon: "pointer-events-none absolute -top-0.5 -right-0.5",
  corner: "pointer-events-none absolute -top-0.5 -right-0.5",
  inline: "",
};

/**
 * Felmärket (0.45.0, cllp/bolag-ops#150): räknaren kunde inte läsas.
 *
 * ── ⛔ VARFÖR DET FINNS ─────────────────────────────────────────────────────
 *
 * En räknare som inte kunde läsas ritade förut INGET märke, och inget märke
 * är exakt vad den ritar när inget väntar. "Klart" och "vet inte" såg alltså
 * likadana ut i toppraden, och en siffra man ska agera på slutar man titta på
 * så fort man vet att den kan ljuga (arbetsreglernas punkt 5: tomhet är ett
 * svar, och en tyst nedsläppsväg är värre än ett fel).
 *
 * ⛔ ALDRIG EN SIFFRA, INTE ENS EN NOLLA. En siffra är ett påstående om datan,
 * och vi vet inte hur många som väntar. Därför ett utropstecken.
 *
 * ⛔ EN ANNAN FORM OCH EN ANNAN TON ÄN RÄKNAREN. Räknaren är en fylld röd pill
 * med vit siffra (`badge`). Felmärket är samma storlek men IHÅLIGT: ytans färg
 * med en ring och ett tecken i `danger`. Hade det varit en fylld röd cirkel
 * till hade ögat läst "något väntar" i stället för "något är trasigt", och
 * det är de två läsningarna märket finns för att skilja på. Tonen är `danger`
 * och inte `badge`: ett fel är ett fel (se kommentaren vid `--color-badge`).
 *
 * ⛔ TEXTEN BÄR BETYDELSEN, tecknet gör det inte. `text` läses upp och står i
 * ikonlänkens tooltip, t.ex. "kunde inte läsas".
 *
 * @param {{ text: string, placement?: "icon" | "corner" | "inline" }} props
 */
export function OpsFelBadge({ text, placement = "corner" }) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("OpsFelBadge: text krävs. Ett utropstecken utan ord säger att något är fel men inte vad, och för skärmläsaren säger det ingenting alls.");
  }
  const plats = PLATS[placement];
  if (plats === undefined) throw new Error(`OpsFelBadge: okänd placement "${placement}". Giltiga: ${Object.keys(PLATS).join(", ")}.`);
  return (
    <span
      data-ops-fel-badge=""
      className={cx(
        "flex size-4 shrink-0 items-center justify-center rounded-full",
        "bg-surface text-mikro font-bold text-danger ring-1 ring-danger",
        plats,
      )}
    >
      <span aria-hidden="true">!</span>
      <span className="sr-only">{` ${text}`}</span>
    </span>
  );
}

/**
 * Den gamla ingången, kvar för de interna anropen. Samma märke.
 * @param {{ count: number, text: string }} props
 */
export function Counter({ count, text }) {
  return <OpsCountBadge count={count} text={text} placement="corner" />;
}
