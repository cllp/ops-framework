import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { cx } from "../lib/cx.js";
import { OpsSlider } from "./OpsSlider.jsx";

/**
 * Ikon som öppnar ett simuleringsreglage i en popover.
 *
 * ── ⛔ VARFÖR INTE ALLTID-SYNLIG `OpsKnob` PÅ RADEN ───────────────────────
 *
 * CP godkände popover-varianten ("Kör den"): den alltid synliga 28 px-ratten
 * var för liten att ta i på telefon. Raden ska vara lugn — namn, belopp,
 * "idag" — och reglaget får komma fram när man ber om det.
 *
 * ⛔ TRIGGERN ÄR EN DIAL-IKON, INTE SJÄLVA REGLAGET. Den speglar läget (nål +
 * varm amber när justerad ≠ noll, valfri %-bricka) men har ingen `input
 * type=range`. Själva dragandet sker i popovern, med fullbredds-`OpsSlider`
 * och Återställ. Samma kontrakt som `OpsSlider`/`OpsKnob`: nolläge, spann,
 * obligatorisk `formateraVarde`.
 *
 * ⛔ INTE `modal`. `OpsFilterChip`/`OpsThemeToggle` är samma mönster: Escape
 * och klick utanför stänger. En fokusfälla här gjorde jsdom-proven mångsekunders
 * långsamma per fall (Presence + scroll-lock), och på riktig skärm räcker att
 * slidern får fokus vid öppning via Radix autoFocus.
 *
 * ⛔ EN I TAGET. Radix stänger den öppna när man klickar utanför, vilket
 * inkluderar nästa radens trigger. Ingen delad state behövs.
 */

/**
 * @param {object} props
 * @param {string} props.label Vad reglaget styr. Syns i popovern och i triggerns namn.
 * @param {number} props.value Nuvarande läge.
 * @param {(value: number) => void} props.onChange
 * @param {number} props.min
 * @param {number} props.max
 * @param {number} props.noll Läget som betyder "som det är idag".
 * @param {(value: number) => string} props.formateraVarde Läget i ord, för både skärm och uppläsning.
 * @param {number} [props.step]
 * @param {string} [props.aterstallLabel]
 */
export function OpsLaboreraPopover({
  label,
  value,
  onChange,
  min,
  max,
  noll,
  formateraVarde,
  step = 1,
  aterstallLabel = "Återställ",
}) {
  if (!(noll >= min && noll <= max)) {
    throw new Error(
      `OpsLaboreraPopover: noll (${noll}) ligger utanför ${min} till ${max}. Nolläget är det man återställer till, så ett nolläge utanför spannet är ett reglage som inte går att nollställa.`,
    );
  }
  if (typeof formateraVarde !== "function") {
    throw new Error(
      "OpsLaboreraPopover: formateraVarde måste vara en funktion. Ett reglage som läses upp som ett naket tal säger inte vad talet betyder.",
    );
  }

  const [oppen, setOppen] = useState(false);
  const text = formateraVarde(value);
  const vidNoll = value === noll;
  const spann = max - min;
  const nalGrad = spann === 0 ? 0 : ((value - noll) / spann) * 270;
  const bagProcent = spann === 0 ? 0 : (Math.abs(value - noll) / spann) * 100;
  const positiv = value >= noll;

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
    <Popover.Root open={oppen} onOpenChange={setOppen}>
      <Popover.Trigger
        type="button"
        aria-label={`Justera ${label}: ${text}`}
        aria-haspopup="dialog"
        title={vidNoll ? `Justera ${label}` : `${label}: ${text}`}
        className={cx(
          "ops-laborera-trigger inline-flex min-h-11 min-w-11 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md px-1",
          "transition-colors duration-(--duration-fast) ease-standard",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          vidNoll ? "text-ink-muted hover:bg-accent-faint hover:text-ink-secondary" : "ops-laborera-trigger--justerad",
        )}
      >
        {/*
         * ⛔ Dekoration, samma måleri som OpsKnob. Ingen range-input här —
         * den skulle vara 44×28 på en telefon och det var hela problemet.
         */}
        <span className={cx("ops-ratt-dial", !vidNoll && "ops-ratt-dial--justerad")} aria-hidden="true">
          <span className="ops-ratt-bag" style={bagStil} />
          <span className="ops-ratt-nal" style={{ transform: `translateX(-50%) rotate(${nalGrad}deg)` }} />
        </span>
        {/* %-bricka bara när justerad: raden ska vara lugn vid noll. */}
        {vidNoll ? null : <span className="ops-ratt-pct ops-ratt-pct--on">{text}</span>}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
          aria-label={`Justera ${label}`}
          className={cx(
            "z-(--z-dropdown) w-[min(calc(100vw---spacing(8)),20rem)] rounded-lg border border-line bg-raised p-4 shadow-lg",
            "outline-none",
          )}
        >
          {/*
           * ⛔ OpsSlider, inte en andra OpsKnob. Popovern har bredd nog för
           * skena + Återställ, och det är vad som saknades på raden.
           */}
          <OpsSlider
            label={label}
            value={value}
            onChange={onChange}
            min={min}
            max={max}
            noll={noll}
            formateraVarde={formateraVarde}
            step={step}
            aterstallLabel={aterstallLabel}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
