import { useId } from "react";
import { cx } from "../lib/cx.js";

/**
 * En kompakt ratt för att laborera med ett tal, samma kontrakt som `OpsSlider`.
 *
 * ── ⛔ DET HÄR ÄR ETT SIMULERINGSREGLAGE, INTE ETT INMATNINGSFÄLT ────────
 *
 * Samma premiss som `OpsSlider`: nolläget är verkligheten, och det måste gå
 * att träffa EXAKT. Skillnaden är formen. Ratten sitter INLINE på en rad
 * (Översikt Kostnader/Inkomster), så den får inte ta en egen rad under
 * kategorinamnet. Dubbelklick återställer till `noll` — det finns ingen
 * Återställ-knapp, för knappen hade krävt bredd raden inte har.
 *
 * ── ⛔ NATIVT `input type=range` UNDER YTAN ──────────────────────────────
 *
 * Precis som `OpsSlider`: pekarfångst, touch, piltangenter, Home/End och hela
 * aria-värdefamiljen kommer gratis. Den synliga ratten är målad dekoration
 * (`aria-hidden`) som speglar värdet. Utan det nativa elementet hade vi byggt
 * om allt det, och det är precis det som brukar gå sönder på mobil.
 *
 * ⛔ `formateraVarde` är obligatorisk och syns under ratten. På en 44 px-kolumn
 * ska den vara KORT (till exempel "0 %" / "+25 %"); belopp och "idag"-text hör
 * hemma i radens värdekolumn, inte här.
 */

/**
 * @param {object} props
 * @param {string} props.label Vad reglaget styr. Syns (eller sr-only), och är kontrollens namn.
 * @param {number} props.value Nuvarande läge.
 * @param {(value: number) => void} props.onChange
 * @param {number} props.min
 * @param {number} props.max
 * @param {number} props.noll Läget som betyder "som det är idag".
 * @param {(value: number) => string} props.formateraVarde Läget i ord, för både skärm och uppläsning.
 * @param {boolean} [props.doldEtikett] Döljer etiketten VISUELLT, aldrig för skärmläsare.
 * @param {number} [props.step]
 */
export function OpsKnob({
  label,
  value,
  onChange,
  min,
  max,
  noll,
  formateraVarde,
  doldEtikett = false,
  step = 1,
}) {
  if (!(noll >= min && noll <= max)) {
    throw new Error(
      `OpsKnob: noll (${noll}) ligger utanför ${min} till ${max}. Nolläget är det man återställer till, så ett nolläge utanför spannet är en ratt som inte går att nollställa.`,
    );
  }
  if (typeof formateraVarde !== "function") {
    throw new Error(
      "OpsKnob: formateraVarde måste vara en funktion. En ratt som läses upp som ett naket tal säger inte vad talet betyder.",
    );
  }

  const id = useId();
  const text = formateraVarde(value);
  const vidNoll = value === noll;
  const spann = max - min;
  // Nålens vinkel: noll pekar rakt upp. Positivt medurs över 270° båge.
  const nalGrad = spann === 0 ? 0 : ((value - noll) / spann) * 270;
  const bagProcent = spann === 0 ? 0 : (Math.abs(value - noll) / spann) * 100;
  const positiv = value >= noll;

  /** @param {import('react').SyntheticEvent} e */
  const aterstall = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(noll);
  };

  /*
   * Conic-gradient för den varma bågen. Vid noll: bara spår. Vid positivt:
   * fyll medurs från toppen. Vid negativt: fyll moturs.
   */
  const bagGrad = bagProcent * 2.7;
  const bagStil =
    bagProcent < 0.01
      ? undefined
      : positiv
        ? {
            background: `conic-gradient(from 210deg, var(--color-laborera) 0 ${bagGrad}deg, var(--color-laborera-glow) ${bagGrad}deg ${bagGrad}deg, var(--color-laborera-track) ${bagGrad}deg 270deg)`,
          }
        : {
            background: `conic-gradient(from ${210 + 270 - bagGrad}deg, var(--color-laborera-track) 0 ${270 - bagGrad}deg, var(--color-laborera) ${270 - bagGrad}deg 270deg)`,
          };

  return (
    <div className="ops-ratt" title="Dubbelklick = återställ" onDoubleClick={aterstall}>
      <label htmlFor={id} className={cx("text-sm font-medium text-ink", doldEtikett ? "sr-only" : "mb-1 block")}>
        {label}
      </label>

      <div className="ops-ratt-kolumn">
        <div
          className={cx("ops-ratt-dial", !vidNoll && "ops-ratt-dial--justerad")}
          aria-hidden="true"
        >
          <span className="ops-ratt-bag" style={bagStil} />
          <span
            className="ops-ratt-nal"
            style={{ transform: `translateX(-50%) rotate(${nalGrad}deg)` }}
          />
        </div>

        {/*
         * ⛔ Det nativa reglaget ÄR kontrollen. Det ligger osynligt över ratten
         * så tangentbord, skärmläsare och proven som använder fireEvent.change
         * fungerar utan egen aria-slider-återimplementation. Den synliga ratten
         * speglar bara värdet.
         */}
        <input
          id={id}
          type="range"
          className="ops-ratt-input"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-valuetext={text}
          onChange={(e) => onChange(Number(e.target.value))}
          onDoubleClick={aterstall}
        />

        <span className={cx("ops-ratt-pct", !vidNoll && "ops-ratt-pct--on")}>{text}</span>
      </div>
    </div>
  );
}
