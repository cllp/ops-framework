import { cx } from "../lib/cx.js";

/**
 * Statusprick: var ett ärende står, som en färgad punkt i en kortrubrik.
 *
 * ── ⛔ VARFÖR EN PRICK OCH INTE ETT PILLER ───────────────────────────────
 *
 * CP (bolag-ops #249): "Status ska vara en färgprick i kortets header", och
 * synlig även när kortet är kollapsat.
 *
 * Skälet är mätt, inte tyckt. Raden i `OpsEventList` bär redan rollmärke,
 * slag, datum och ärendenummer, och vid 390 px finns 280 px kvar efter
 * chevronkolumnen. Ett sjätte piller på 70 px hade tvingat fram en radbrytning
 * på varje rad, alltså en lista som är en tredjedel längre för ett faktum man
 * skummar. Pricken kostar 8 px plus mellanrum.
 *
 * ── ⛔ FÄRGEN ÄR ALDRIG DEN ENDA BÄRAREN, OCH DET LÖSES I TRE LAGER ──────
 *
 * Ramverkets regel (se `OpsPill` och `OpsEventList`) är att en färg inte går
 * att läsa upp och är osynlig för ungefär var tjugonde man. En prick som bara
 * är färgad bryter den regeln. Därför:
 *
 * 1. `label` KRÄVS och renderas alltid, som `sr-only`. Skärmläsaren säger
 *    "Väntar" där ögat ser orange.
 * 2. `title` sätter samma ord, så en muspekare svarar på samma fråga.
 * 3. **`urgent` skriver dessutom ut sitt ord synligt.** Det är det enda läget där
 *    ett missat besked kostar något, och det följer samma logik som
 *    `OpsEventList`: bara `late` får ett ord som standard, eftersom bara
 *    den lånar larmfärgen.
 *
 * ⛔ DE ANDRA FYRA ORDEN MÅSTE FINNAS SYNLIGA NÅGON ANNANSTANS I VYN. I
 * bolag-ops står de i utfällningens `Status`-rad. Det går inte att vakta i kod,
 * så det står här: en prick som är vyns ENDA besked om status är fel användning
 * av den här primitiven, hur grön CI än är.
 *
 * ── ⛔ FEM LÄGEN, OCH DE ÄR EN SLUTEN MÄNGD ─────────────────────────────
 *
 * Kartan är CP:s (bolag-ops #249). Ett okänt värde kastar i stället för att
 * rendera något godtyckligt, precis som `OpsPill`: en prick i fel färg är
 * sämre än ingen prick, för den ser ut att betyda något.
 *
 * `waiting` har ett EGET token (`--color-blocked`) och lånar inte `warning`.
 * Skälet står i `tokens/tokens.css`: "väntar på någon annan" är varken en
 * varning eller ett fel, och delade de färg skulle guld betyda två saker.
 */

const TONER = {
  open: "bg-warning",
  inProgress: "bg-info",
  waiting: "bg-blocked",
  done: "bg-success",
  urgent: "bg-danger",
};

/**
 * @param {object} props
 * @param {"open"|"inProgress"|"waiting"|"done"|"urgent"} props.status
 * @param {string} props.label Ordet för läget. ⛔ Krävs: färgen får aldrig bära betydelsen ensam.
 */
export function OpsStatusDot({ status, label }) {
  const tonKlass = TONER[status];
  if (!tonKlass) {
    throw new Error(`OpsStatusDot: okänd status "${status}". Giltiga: ${Object.keys(TONER).join(", ")}.`);
  }
  if (!label) {
    throw new Error(
      "OpsStatusDot: label saknas. En färgad prick utan ord är osynlig för skärmläsaren och för var tjugonde man som inte skiljer färgerna åt.",
    );
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      {/* ⛔ `size-2` och inte en ikon. En 8 px punkt är den minsta form som
          läses som ett tillstånd och inte som skräp, och en ikon i den
          storleken är en suddig fläck.

          ⛔ `title` SITTER PÅ DEN DOLDA PRICKEN OCH INTE PÅ omslaget. En
          `title` på omslaget hade lästs upp UTÖVER `sr-only`-ordet, alltså
          samma ord två gånger i följd, och på `urgent`-raden tre. Här är
          elementet `aria-hidden`, så attributet ger muspekaren sitt svar utan
          att säga något till skärmläsaren. */}
      <span aria-hidden="true" title={label} className={cx("size-2 shrink-0 rounded-full", tonKlass)} />
      {status === "urgent" ? (
        <span className="text-xs font-semibold text-danger">{label}</span>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </span>
  );
}
