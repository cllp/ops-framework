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
 * ⛔ Klassnamnen står utskrivna, inte byggda med `border-l-identity-${n}`.
 *
 * Tailwind läser källkoden som text och hittar bara klasser som faktiskt står
 * där. En interpolerad sträng genererar ingen CSS, och resultatet är ett kort
 * utan kantfärg som fungerar i utvecklingsläge och tappar färgen i bygget.
 * Samma fälla som `OpsIdentity` redan bär en kommentar om.
 */
const KANTKLASSER = {
  1: "border-l-identity-1",
  2: "border-l-identity-2",
  3: "border-l-identity-3",
  4: "border-l-identity-4",
  5: "border-l-identity-5",
  6: "border-l-identity-6",
};

/**
 * @param {object} props
 * @param {"raised"|"sunken"|"plain"} [props.tone]
 * @param {boolean} [props.elevated] Skugga. Används för det som ligger ÖVER sidan, inte för att lyfta fram.
 * @param {boolean} [props.flush] Ingen inre padding. För kort som bär en lista kant i kant.
 * @param {"kort"|"bubbla"} [props.rundning] Hur mjukt hörnet är. `kort` (8 px) är
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
export function OpsCard({ tone = "raised", rundning = "kort", elevated = false, flush = false, edge, edgeLabel, id, children }) {
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
  const rundningKlass = RUNDNINGAR[rundning];
  if (!rundningKlass) {
    throw new Error(`OpsCard: okänd rundning "${rundning}". Giltiga: ${Object.keys(RUNDNINGAR).join(", ")}.`);
  }

  const kantKlass = edge === undefined ? null : KANTKLASSER[edge];
  if (edge !== undefined && !kantKlass) {
    throw new Error(`OpsCard: okänd edge "${edge}". Giltiga: ${Object.keys(KANTKLASSER).join(", ")}.`);
  }

  // ⛔ FÄRGEN ENSAM FÅR INTE BÄRA BETYDELSEN, och det är samma regel som gäller
  // för identitet och proveniens. En kant i en färg säger ingenting till den som
  // inte redan lärt sig koden, går inte att läsa upp, och är osynlig för var
  // tjugonde man. Därför krävs ett ord, och kortet kastar hellre än att rendera
  // en färg som låtsas betyda något.
  if (kantKlass && !edgeLabel) {
    throw new Error(
      "OpsCard: edge kräver edgeLabel. En färgad kant utan ord betyder ingenting för den som inte ser färgen eller inte lärt sig koden.",
    );
  }

  return (
    <div
      id={id}
      className={cx(
        rundningKlass,
        "border",
        tonKlass,
        // Kanten ritas som en tjockare vänsterram i stället för ett extra
        // element, så den följer radien och inte kan hamna utanför kortet.
        kantKlass && cx("border-l-4", kantKlass),
        elevated && "shadow-md",
        flush ? "p-0 overflow-hidden" : "p-4",
      )}
    >
      {kantKlass ? <span className="sr-only">{edgeLabel}</span> : null}
      {children}
    </div>
  );
}

const RUNDNINGAR = /** @type {const} */ ({
  kort: "rounded-lg",
  bubbla: "rounded-3xl",
});
