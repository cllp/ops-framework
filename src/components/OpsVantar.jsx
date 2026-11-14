import { useEffect, useState } from "react";
import { cx } from "../lib/cx.js";

/**
 * Ett väntläge som rör sig: en tunn rad som löper fram och tillbaka, med texten bredvid eller ovanför (0.229.0).
 *
 * ══ ⛔ VARFÖR (CP 2026-11-14) ══════════════════════════════════════════════════════════════════════════
 *
 * CP om Programåtkomst: "Under programåtkomst så finns en text 'läser nycklarna'. Det är bra, men det är liksom ingen progress och man
 * ser inte informationen så lätt att nåt faktiskt händer ... bra om det inte bara är en text utan att det faktiskt är en animering under
 * tiden. Detta gäller överallt där man väntar." Och: "progressbars som rör sig överallt där vi behöver vänta".
 *
 * Ramverket hade då trettiofem väntelägen, och de flesta var en stillastående textrad i en `role="status"`. En rad som står stilla går
 * inte att skilja från en rad som har fastnat. Den här komponenten är det enda hemmet för väntan på data; `check-vantelage` är röd om en
 * komponent visar en väntetext på något annat sätt.
 *
 * ══ VAD DEN GÖR ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * - **Obestämd rad.** Vi vet aldrig hur lång tid det tar, så raden visar ATT något pågår, inte hur långt det kommit. En procentstapel som
 *   gissar hade lovat något vi inte kan hålla.
 * - **Neutral färg ur tokens** (`bg-ink-muted` på `bg-sunken`). Väntan är inte ett besked som ska dra blicken som accenten gör.
 * - **Fördröjd i `FORDROJNING_MS`.** En hämtning som är klar på 100 ms ska inte blinka förbi som en rad som syns en bildruta. Elementet och
 *   texten finns i DOM:en från början, så att skärmläsaren har sin `role="status"` på plats innan texten behövs, men raden tonas in
 *   först efter fördröjningen. `data-ops-vantar` säger vilket läge den är i: `vilar` före, `syns` efter.
 * - **`prefers-reduced-motion`:** raden står still men syns. Samma skäl som snurrans långsamma läge: den som bett om mindre rörelse ska
 *   fortfarande se att något pågår.
 * - **Tillgänglighet:** `role="status"`, `aria-live="polite"` och `aria-busy`. Raden är `aria-hidden`; texten är beskedet.
 *
 * ⛔ STÄNGT API: inga klasser in, inga data-attribut. Behöver anropsstället ett märke eller luft runt väntan sitter de på ett omslag.
 *
 * @param {object} props
 * @param {string} props.text Vad som väntas på, till exempel "Hämtar dokumentet." Syns och läses upp.
 * @param {"sm"|"md"} [props.storlek] `md` (standard): texten ovanför en rad. `sm`: en kort rad bredvid texten, för en plats i en rad.
 */
export function OpsVantar({ text, storlek = "md" }) {
  const [syns, setSyns] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSyns(true), FORDROJNING_MS);
    return () => clearTimeout(t);
  }, []);

  if (storlek !== "sm" && storlek !== "md") throw new Error(`OpsVantar: okänd storlek "${storlek}". Giltiga: sm, md.`);
  if (!text) throw new Error("OpsVantar: text krävs. En väntan som inte säger vad den väntar på läses upp som tystnad.");

  const rad = (
    <span aria-hidden="true" data-ops-vantar-rad="" className={cx("relative block h-1 overflow-hidden rounded-full bg-sunken", storlek === "sm" ? "w-12 shrink-0" : "w-full max-w-60")}>
      <span className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-ink-muted animate-vantar motion-reduce:animate-none" />
    </span>
  );

  return (
    <span
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-ops-vantar={syns ? "syns" : "vilar"}
      className={cx(
        "transition-opacity duration-(--duration-base) motion-reduce:transition-none",
        syns ? "opacity-100" : "opacity-0",
        storlek === "sm" ? "inline-flex items-center gap-2 text-meta text-ink-muted" : "flex w-full flex-col gap-2 text-etikett text-ink-muted",
      )}
    >
      {storlek === "sm" ? rad : null}
      <span className="min-w-0">{text}</span>
      {storlek === "md" ? rad : null}
    </span>
  );
}

/** Hur länge en väntan får pågå innan raden syns. Kortare hämtningar ritar ingenting. */
export const FORDROJNING_MS = 300;
