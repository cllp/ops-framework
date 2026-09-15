import { cx } from "../lib/cx.js";

/**
 * Piller, alltså en liten statusetikett.
 *
 * ⛔ Färgen kommer ur vad pillret BETYDER, aldrig ur vad någon tyckte passade.
 * Ett piller som är grönt för att grönt såg fint ut lär användaren att grönt
 * inte betyder något, och då slutar även de riktiga gröna pillren fungera.
 *
 * ⛔ Färgen får heller aldrig vara den enda bäraren av betydelsen. Texten i
 * pillret ska räcka för den som inte ser skillnad på rött och grönt, vilket är
 * ungefär var tjugonde man.
 */

const TONER = {
  neutral: "bg-sunken text-ink-secondary",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
};

/**
 * @param {object} props
 * @param {"neutral"|"success"|"warning"|"danger"|"info"} [props.tone]
 * @param {import("react").ReactNode} props.children
 */
export function OpsPill({ tone = "neutral", children }) {
  const tonKlass = TONER[tone];
  if (!tonKlass) {
    throw new Error(`OpsPill: okänd tone "${tone}". Giltiga: ${Object.keys(TONER).join(", ")}.`);
  }
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold leading-tight", tonKlass)}>
      {children}
    </span>
  );
}
