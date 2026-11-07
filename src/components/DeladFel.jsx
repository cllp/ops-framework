import { DELNINGSORSAKER, delningsbesked } from "../lib/delning.js";
import { OpsEmpty } from "./OpsEmpty.jsx";

/**
 * En delad länk som inte går att visa (0.201.0, cllp/ops-framework#544): samma besked som gästens sida. Rubriken "Länken fungerar inte längre", en rad om varför och nästa väg
 * ("Be den som delade den om en ny länk."), på sidans språk. Samma komponent på filens och händelsens sida, så att beskedet inte kan glida isär mellan dem (regel 2).
 *
 * ⛔ `data-delad="fel"` och `data-delad-orsak` står kvar: appar och prov läser dem.
 *
 * @param {object} props
 * @param {string} props.orsak En av `DELNINGSORSAKER`. En okänd orsak är en utgången länk.
 * @param {string} [props.sprak] `sv` eller `en`.
 */
export function DeladFel({ orsak, sprak }) {
  const b = delningsbesked(orsak, sprak);
  const kand = /** @type {readonly string[]} */ (DELNINGSORSAKER).includes(orsak) ? orsak : "utgangen";
  return (
    <div data-delad="fel" data-delad-orsak={kand}>
      <OpsEmpty title={b.rubrik} description={[b.varfor, b.nasta].filter(Boolean).join(" ")} />
    </div>
  );
}
