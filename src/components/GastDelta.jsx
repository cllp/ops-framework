import { useId, useState } from "react";
import { GASTDELTASVAR } from "../lib/gast.js";
import { PUBLIK_KLASS } from "../lib/publikKlass.js";
import { DeladRubrik } from "./DeladRubrik.jsx";
import { OpsButton } from "./OpsButton.jsx";

/** Orden i svarsknapparnas nycklar: `GASTDELTASVAR` i ordning, med den ordbokspost varje svar har. */
const SVARSORD = /** @type {const} */ ({ kommer: "deltaKommer", kommerInte: "deltaKommerInte", kanske: "deltaKanske" });

/**
 * Gästens sida för en händelse (0.146.0, cllp/ops-framework#445, skiva 1): rubriken, dagen, klockslaget och platsen, frågan "Kommer du?" med tre knappar, och en rad som säger vad som svarats. Intern: ritas av
 * `OpsGastSida` när gästens funktion är `delta`, och exporteras inte ur `src/index.js`.
 *
 * ══ ⛔ DEN EXTERNA ÄR MED FRÅN SIN EGEN MEJL, UTAN KONTO (visionen, epiken cllp/ops-framework#445) ════════════════════
 *
 * Sidan visar bara det en inbjuden behöver för att svara: vad, när, var, och tre val. Ingen grupp, inga andra, ingen beskrivning. Samma rubrik och samma tid som en delad länk till händelsen (`DeladRubrik`).
 *
 * ⛔ TOMT OCH SVARAT HAR VARSIN RAD (regel 5): innan gästen svarat står "Du har inte svarat än", efteråt vad hen svarade. Raden är en `role="status"` som finns hela tiden, så att en skärmläsare hör ändringen.
 *
 * ⛔ KNAPPARNA VÄNTAR SJÄLVA (`OpsButton`, `busyLabel`) och de andra två spärras medan en skrivs, så att två svar inte är på väg samtidigt. Ett svar som inte sparades står som en rad vid knapparna och knapparna är
 * tryckbara igen (skillen `interaktionsdesign`, avsnitt 7). Valet syns som den fyllda knappen och i knappens namn ("Jag kommer, valt"), eftersom `OpsButton` saknar `aria-pressed`.
 *
 * @param {object} props
 * @param {{ handelse: { titel: string, plats?: string | null, datum?: string | null, slutDatum?: string | null, tid?: string | null, slutTid?: string | null, heldag?: boolean }, mitt?: string | null }} props.delta Tjänstens `hamta().delta`.
 * @param {(val: string) => Promise<boolean>} props.onSvara Svarar och ger sant om det sparades. Kastar aldrig: ett fel är `false`.
 * @param {Record<string, string>} props.t Sidans ord på besökarens språk (`ORD_OPSGASTSIDA` och `ORD_OPSDELADHANDELSE`:s tre).
 * @param {string} props.sprak
 */
export function GastDelta({ delta, onSvara, t, sprak }) {
  const fragaId = useId();
  const [skriver, setSkriver] = useState(/** @type {string | null} */ (null));
  const [fel, setFel] = useState(false);
  const mitt = typeof delta.mitt === "string" && /** @type {readonly string[]} */ (GASTDELTASVAR).includes(delta.mitt) ? delta.mitt : null;

  /** @param {string} val */
  async function svara(val) {
    setFel(false);
    setSkriver(val);
    try {
      if (!(await onSvara(val))) setFel(true);
    } finally {
      setSkriver(null);
    }
  }

  return (
    <article data-gast-delta="" className="flex min-w-0 flex-col gap-8">
      <DeladRubrik delning={delta.handelse} t={t} sprak={sprak} />
      <section aria-labelledby={fragaId} data-gast-delta-svar="" className="flex min-w-0 flex-col gap-3">
        <h2 id={fragaId} className={PUBLIK_KLASS.eyebrow}>{t.deltaFraga}</h2>
        <div role="group" aria-labelledby={fragaId} data-gast-delta-knappar="" className="flex flex-wrap gap-2">
          {GASTDELTASVAR.map((val) => {
            const ord = t[SVARSORD[val]];
            const vald = mitt === val;
            return (
              <OpsButton
                key={val}
                variant={vald ? "primary" : "secondary"}
                disabled={skriver !== null && skriver !== val}
                busyLabel={t.deltaSparar}
                ariaLabel={vald ? `${ord}, ${t.deltaValt}` : undefined}
                onClick={() => svara(val)}
              >
                {ord}
              </OpsButton>
            );
          })}
        </div>
        <p role="status" data-gast-delta-svarat={mitt ?? ""} className={PUBLIK_KLASS.brod}>
          {mitt ? t[`deltaSvarade_${mitt}`] : t.deltaOsvarad}
        </p>
        {fel ? <p role="alert" data-gast-delta-fel="" className="m-0 text-etikett text-danger wrap-anywhere">{t.kundeInte}</p> : null}
      </section>
    </article>
  );
}
