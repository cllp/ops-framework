import { cx } from "../lib/cx.js";

/**
 * Kort.
 *
 * ⛔ En box sätter aldrig sin egen radie eller skugga. Tre olika "kort" i samma
 * vy är det första någon lägger märke till utan att kunna säga varför något
 * känns slarvigt. Radien kommer ur tokenkontraktet och varianterna är fyra.
 */

const TONER = {
  raised: "bg-raised border-line",
  sunken: "bg-sunken border-transparent",
  plain: "bg-canvas border-line",
};

/**
 * @param {object} props
 * @param {"raised"|"sunken"|"plain"} [props.tone]
 * @param {boolean} [props.elevated] Skugga. Används för det som ligger ÖVER sidan, inte för att lyfta fram.
 * @param {boolean} [props.flush] Ingen inre padding. För kort som bär en lista kant i kant.
 * @param {string} [props.id]
 * @param {import("react").ReactNode} props.children
 */
export function OpsCard({ tone = "raised", elevated = false, flush = false, id, children }) {
  const tonKlass = TONER[tone];
  if (!tonKlass) {
    throw new Error(`OpsCard: okänd tone "${tone}". Giltiga: ${Object.keys(TONER).join(", ")}.`);
  }
  return (
    <div
      id={id}
      className={cx(
        "rounded-lg border",
        tonKlass,
        elevated && "shadow-md",
        flush ? "p-0 overflow-hidden" : "p-4",
      )}
    >
      {children}
    </div>
  );
}
