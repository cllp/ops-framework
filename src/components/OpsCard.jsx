import { cx } from "../lib/cx.js";
import { kantKlass } from "../lib/kant.js";

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
 * @param {"kort"|"bubbla"} [props.rounding] Hur mjukt hörnet är. `kort` (8 px) är
 *   förvalet och gäller allt som är en RUTA: en panel, en sektion, en tabell.
 *   `bubbla` (24 px) är för det som är ett OBJEKT i en ström, alltså en händelse,
 *   ett meddelande, ett kort i en lista man bläddrar igenom.
 *   ⛔ TVÅ RADIER OCH INTE EN SKALA. Skillnaden ska gå att se utan att jämföra;
 *   ett tredje steg emellan gör att ingen av dem längre betyder något.
 * @param {1|2|3|4|5|6} [props.edge] Färgad vänsterkant ur identitetspaletten. För kort som tillhör något: en scope, en grupp, en avdelning.
 * @param {string} [props.edgeLabel] Vad kanten betyder, för skärmläsare. ⛔ Krävs när `edge` används.
 * @param {string} [props.id]
 * @param {import("react").ReactNode} props.children
 */
export function OpsCard({ tone = "raised", rounding = "kort", elevated = false, flush = false, edge, edgeLabel, id, children }) {
  const tonKlass = TONER[tone];
  if (!tonKlass) {
    throw new Error(`OpsCard: okänd tone "${tone}". Giltiga: ${Object.keys(TONER).join(", ")}.`);
  }

  /*
   * ⛔ 24 px ÄR MÄTT MOT FÖREBILDEN OCH INTE VALT PÅ KÄNSLA. SessionStudios
   * `--radius-card` är 1.5rem, alltså 24 px, och vår `--radius-3xl` råkade
   * redan vara exakt det. CP 2026-09-22: "Samma mjuka SS-rundning på alla
   * händelsebubblor (hög radius / squircle som SessionStudio session-kort)."
   *
   * ⛔ INGET NYTT TOKEN. Steget fanns, det användes bara inte här.
   */
  const rundningKlass = RUNDNINGAR[rounding];
  if (!rundningKlass) {
    throw new Error(`OpsCard: okänd rounding "${rounding}". Giltiga: ${Object.keys(RUNDNINGAR).join(", ")}.`);
  }

  // ⛔ KANTEN OCH DESS KRAV BOR I `lib/kant.js`, eftersom kalenderns postkort
  // ritar samma sak. Se den filen för varför ett ord krävs.
  const kanten = kantKlass(edge, edgeLabel, "OpsCard");

  return (
    <div
      id={id}
      className={cx(
        rundningKlass,
        "border",
        tonKlass,
        // Kanten ritas som en tjockare vänsterram i stället för ett extra
        // element, så den följer radien och inte kan hamna utanför kortet.
        kanten && cx("border-l-4", kanten),
        elevated && "shadow-md",
        flush ? "p-0 overflow-hidden" : "p-4",
      )}
    >
      {kanten ? <span className="sr-only">{edgeLabel}</span> : null}
      {children}
    </div>
  );
}

const RUNDNINGAR = /** @type {const} */ ({
  kort: "rounded-lg",
  bubbla: "rounded-3xl",
});
