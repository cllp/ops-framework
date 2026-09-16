import { cx } from "../lib/cx.js";

/**
 * En rad som går att tona ned: med i summan, eller inte.
 *
 * ── ⛔ VARFÖR INTE EN KRYSSRUTA ───────────────────────────────────────────
 *
 * Den här ersätter `OpsCheckbox` i summeringslistor, och skälet är inte bara
 * att kryssrutan är ful (CP: "istället för checkbox som är svinfult").
 *
 * En kryssruta ställer frågan "är det här sant?". I en summeringslista är
 * frågan en annan: "ska det här räknas med?". Det är ett filter, inte ett
 * påstående, och kryssrutan får raden att se ut som data man redigerar snarare
 * än som ett urval man leker med.
 *
 * ⛔ Följden syns i vad som händer när man glömmer. Bockar man ur en kryssruta
 * ser raden nästan likadan ut, och totalen ovanför är plötsligt inte ens
 * riktiga total utan att något säger det. En nedtonad rad SER nedtonad ut, och
 * hela listan visar med en blick vad som räknas.
 *
 * ── ⛔ OPACITETEN BÄR INTE BETYDELSEN ENSAM ──────────────────────────────
 *
 * Tre saker säger samma sak, av tre olika skäl:
 *
 *   1. `aria-pressed` gör tillståndet läsbart för skärmläsare. Utan den finns
 *      urvalet helt enkelt inte för den som inte ser skärmen.
 *   2. Beloppet får genomstruken stil. Nedtonad text kan läsas som "inaktiv"
 *      eller "inte klar" lika gärna som "räknas inte", och en genomstrykning
 *      betyder bara en sak.
 *   3. Nedtoningen är kraftig nog att synas i förbifarten men inte så kraftig
 *      att raden blir oläslig. Man ska kunna läsa vad man valt bort.
 *
 * ⛔ Nedtonad är INTE `disabled`. Raden går att trycka på igen, och en
 * `disabled`-knapp hade tagits bort ur tabbordningen, alltså gjort urvalet
 * omöjligt att ångra med tangentbord.
 */

/**
 * @param {object} props
 * @param {import("react").ReactNode} props.label Vänsterkolumnen: vad raden heter.
 * @param {import("react").ReactNode} [props.value] Högerkolumnen: beloppet eller talet.
 * @param {boolean} props.on Sant = räknas med, skarp. Falskt = nedtonad.
 * @param {(on: boolean) => void} props.onChange
 * @param {string} [props.offLabel] Vad nedtonat betyder, för skärmläsare. Läggs efter etiketten.
 */
export function OpsToggleRow({ label, value, on, onChange, offLabel = "räknas inte" }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={cx(
        "flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left",
        "transition-opacity duration-(--duration-fast) ease-standard",
        "hover:bg-accent-faint focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
        on ? "opacity-100" : "opacity-45",
      )}
    >
      <span className="min-w-0 flex-1 truncate text-ink">
        {label}
        {/* ⛔ Ordet, inte bara opaciteten. Skärmläsaren får `aria-pressed`, men
            den som ser skärmen med nedsatt kontrastseende får ingenting av en
            opacitetsskillnad, och det här kostar ingenting. */}
        {on ? null : <span className="sr-only">, {offLabel}</span>}
      </span>
      {value === undefined || value === null ? null : (
        <span className={cx("shrink-0 tabular-nums text-ink-secondary", on ? null : "line-through")}>{value}</span>
      )}
    </button>
  );
}
