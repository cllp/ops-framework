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
 * ⛔ TVÅ STORLEKAR, OCH STANDARD ÄR OFÖRÄNDRAD (0.32.1).
 *
 * CP 2026-09-30 08:04: "Kolla storleken och fint på texten i händelserna. Matchar inte det vi har i SessionStudio.
 * Dubbelkolla även inkorgen." SessionStudios typbadge i inkorgen (`ChatInboxPanel.jsx:743`) är 9 px, vikt 500,
 * `px-1.5 py-0.5`. Ramverkets piller var 12 px och 600 med `px-3 py-1`, alltså ett märke som tog lika mycket plats
 * som raden det beskrev. `liten` är rollen `liten` (10/500, närmaste steg i skalan: 9 px finns inte och ska inte
 * uppfinnas för ett märke) med SS luft. Standard ändras inte, eftersom pillret står som status på många ytor som inte
 * är typbadgar.
 */
const STORLEKAR = {
  standard: "px-3 py-1 text-meta font-semibold",
  liten: "px-1.5 py-0.5 text-liten",
};

/**
 * @param {object} props
 * @param {"neutral"|"success"|"warning"|"danger"|"info"} [props.tone]
 * @param {"standard"|"liten"} [props.size] `liten` är typbadgen (0.32.1), se `STORLEKAR`.
 * @param {import("react").ReactNode} props.children
 */
export function OpsPill({ tone = "neutral", size = "standard", children }) {
  const tonKlass = TONER[tone];
  if (!tonKlass) {
    throw new Error(`OpsPill: okänd tone "${tone}". Giltiga: ${Object.keys(TONER).join(", ")}.`);
  }
  const storlek = STORLEKAR[size];
  if (!storlek) {
    throw new Error(`OpsPill: okänd size "${size}". Giltiga: ${Object.keys(STORLEKAR).join(", ")}.`);
  }
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full leading-tight", storlek, tonKlass)}>
      {children}
    </span>
  );
}
