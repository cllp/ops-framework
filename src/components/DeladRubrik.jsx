import { cx } from "../lib/cx.js";
import { deladTid } from "../lib/deladdatum.js";
import { DATUM_EJ_SATT } from "../lib/handelsemodell.js";
import { PUBLIK_KLASS } from "../lib/publikKlass.js";
import { DatumIkon, KlockaIkon, PlatsIkon } from "./icons.jsx";

/**
 * Rubriken, dagen, klockslaget och platsen på en publik händelsesida (0.146.0): det som `OpsDeladHandelse` ritade högst upp och som gästens sida för `delta` (`OpsGastSida`) ritar likadant.
 *
 * ══ ⛔ EN RITNING, TVÅ SIDOR (regel 2) ═══════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-10-19: "Det skall vara tydligt på händelsen, vilka datum det gäller." En extern som blivit bjuden till en händelse ser samma rubrik, datum, klockslag och plats som den som fått en delad länk till den,
 * och en andra kopia av markeringen hade glidit isär första gången någon rörde den. Orden (`tidEtikett`, `till`, `platsEtikett`) kommer ur `ORD_OPSDELADHANDELSE`, och `data-dh-*`-attributen är oförändrade
 * (skalmätningen och proven läser dem). Intern: filen exporteras inte ur `src/index.js`.
 *
 * ⛔ UTAN DATUM STÅR DET (`DATUM_EJ_SATT`), det tystas inte: en händelse som fått sitt datum borttaget medan en inbjudan levde ska säga det, inte rita en tom rad.
 *
 * @param {object} props
 * @param {{ titel: string, plats?: string | null, datum?: string | null, slutDatum?: string | null, tid?: string | null, slutTid?: string | null, heldag?: boolean }} props.delning
 * @param {Record<string, string>} props.t Orden `tidEtikett`, `till` och `platsEtikett` på besökarens språk.
 * @param {string} props.sprak
 */
export function DeladRubrik({ delning, t, sprak }) {
  const tid = typeof delning.datum === "string" && delning.datum !== "" ? deladTid(/** @type {Parameters<typeof deladTid>[0]} */ (delning), sprak) : null;
  return (
    <header className="flex min-w-0 flex-col gap-5">
      <h1 data-dh-titel="" className={cx(PUBLIK_KLASS.sida, "wrap-anywhere")}>{delning.titel}</h1>
      <section aria-label={t.tidEtikett} data-dh-tid="" className="flex min-w-0 flex-col gap-3">
        <p data-dh-datum="" className="m-0 flex items-start gap-3 font-display-publik text-publik-block text-publik-ljus-text">
          <span aria-hidden="true" className="mt-1 flex shrink-0 items-center"><DatumIkon size={28} /></span>
          <span className="min-w-0">
            {tid === null ? (
              DATUM_EJ_SATT[sprak === "en" ? "en" : "sv"]
            ) : (
              <>
                {tid.start}
                {tid.slut ? (
                  <>
                    {" "}
                    <span className="text-publik-ljus-dampad">{t.till}</span>
                    {" "}
                    {tid.slut}
                  </>
                ) : null}
                {tid.dagar ? <span className="text-publik-ljus-dampad">{`, ${tid.dagar}`}</span> : null}
              </>
            )}
          </span>
        </p>
        {tid?.tid ? (
          <p data-dh-klockslag="" className="m-0 flex items-center gap-3 text-publik-ingress text-publik-ljus-text">
            <span aria-hidden="true" className="flex shrink-0 items-center"><KlockaIkon size={24} /></span>
            <span className="min-w-0">{tid.tid}</span>
          </p>
        ) : null}
        {delning.plats ? (
          <p data-dh-plats="" className="m-0 flex items-start gap-3 text-publik-ingress text-publik-ljus-text">
            <span aria-hidden="true" className="mt-1 flex shrink-0 items-center"><PlatsIkon size={24} /></span>
            <span className="sr-only">{t.platsEtikett}: </span>
            <span className="min-w-0 wrap-anywhere">{delning.plats}</span>
          </p>
        ) : null}
      </section>
    </header>
  );
}
