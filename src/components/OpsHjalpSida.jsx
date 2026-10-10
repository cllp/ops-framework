import { useEffect, useRef, useState } from "react";
import { aktivHjalpSektion, hjalpSektioner, sokHjalp } from "../hjalp/sok.js";
import { GRUND_ID } from "../hjalp/generell.js";
import { OpsBanner } from "./OpsBanner.jsx";
import { OpsCard } from "./OpsCard.jsx";
import { OpsDisclosure } from "./OpsDisclosure.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsField, OpsInput } from "./OpsField.jsx";
import { OpsMarkdown } from "./OpsMarkdown.jsx";
import { OpsPill } from "./OpsPill.jsx";
import { OpsView, OpsViewHeader } from "./OpsView.jsx";

/**
 * Hjälpsidan: grundfunktioner plus ett avsnitt per installerad app (0.92.1).
 *
 * CP 2026-10-10: två lager. Ramverket äger grunderna. Varje modul äger sin
 * text i `hjalp`. Sökningen går över båda. Djuplänk `#hjalp/<modulId>` (eller
 * `#hjalp/grund`) rullar fram rätt sektion.
 *
 * ⛔ VYN ÄGER INGEN TEXT. Innehållet kommer ur `GENERELL_HJALP` och modulernas
 * `hjalp`. Det är samma strängar som söks.
 */

/**
 * @param {{ rubrik: string, under?: string, ikon?: unknown }} props
 */
function Sektionsrubrik({ rubrik, under, ikon }) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      {ikon ? (
        <span aria-hidden="true" className="inline-flex size-6 shrink-0 items-center justify-center text-ink-secondary">
          {/** @type {import("react").ReactNode} */ (ikon)}
        </span>
      ) : null}
      <span className="text-rubrik text-ink">{rubrik}</span>
      {under ? <span className="text-etikett text-ink-muted">{under}</span> : null}
    </span>
  );
}

/**
 * @param {{ traff: any, sokt: boolean, sektionId: string }} props
 */
function Avsnitt({ traff, sokt, sektionId }) {
  const a = traff.avsnitt;
  return (
    <OpsDisclosure
      summary={<Sektionsrubrik rubrik={a.fraga} under={sokt ? traff.omradeRubrik : undefined} />}
      defaultOpen={sokt}
      storageKey={sokt ? undefined : `hjalp:${sektionId}:${a.id}`}
    >
      <div className="flex flex-col gap-3">
        {traff.utdrag ? <p className="m-0 text-etikett text-ink-muted italic">{traff.utdrag}</p> : null}
        <OpsMarkdown text={a.svar} />
      </div>
    </OpsDisclosure>
  );
}

/**
 * @param {object} props
 * @param {ReadonlyArray<import("../lib/modul.js").Modul>} props.moduler
 * @param {{ moduler?: ReadonlyArray<string> } | null} [props.grupp]
 * @param {string} [props.hash] `location.hash`, för djuplänk.
 * @param {string} [props.title]
 * @param {string} [props.description]
 * @param {string} [props.sokHint]
 * @param {import("react").ReactNode} [props.barnEfter] Extra under listan (till exempel en banner).
 */
export function OpsHjalpSida({
  moduler,
  grupp = null,
  hash = "",
  title = "Hjälp",
  description = "Hur appen fungerar. Sök bland grunderna och de appar som är installerade i gruppen.",
  sokHint = "Till exempel kalender, grupp, inkorg eller en apps namn.",
  barnEfter = null,
}) {
  const [fraga, setFraga] = useState("");
  const sokt = fraga.trim().length > 0;
  const sektioner = hjalpSektioner({ moduler, grupp });
  const traffar = sokHjalp(sektioner, fraga);
  const aktiv = aktivHjalpSektion(sektioner, hash);
  const sektionsRef = useRef(/** @type {Record<string, HTMLElement | null>} */ ({}));

  useEffect(() => {
    if (!aktiv || sokt) return;
    const el = sektionsRef.current[aktiv];
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "start" });
    }
  }, [aktiv, sokt, sektioner]);

  return (
    <OpsView>
      <OpsViewHeader title={title} description={description} />

      <OpsCard>
        <OpsField label="Sök i hjälpen" hint={sokHint}>
          <OpsInput
            type="search"
            value={fraga}
            onChange={setFraga}
            name="q"
            placeholder="Sök i hjälpen"
            autoComplete="off"
            ariaLabel="Sök i hjälpen"
          />
        </OpsField>
      </OpsCard>

      {sokt ? (
        <>
          <div className="flex items-center gap-2">
            <OpsPill>{traffar.length === 1 ? "1 träff" : `${traffar.length} träffar`}</OpsPill>
          </div>
          {traffar.length === 0 ? (
            <OpsEmpty
              title={`Inga träffar för "${fraga.trim()}"`}
              description="Prova ett kortare ord. Sökningen letar i frågor, svar och sökord, men den böjer inte orden."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {traffar.map((t) => (
                <Avsnitt key={`${t.sektionId}-${t.avsnitt.id}`} traff={t} sokt sektionId={t.sektionId} />
              ))}
            </div>
          )}
        </>
      ) : (
        sektioner.map((s) => (
          <section
            key={s.id}
            id={`hjalp-${s.id}`}
            data-hjalp-sektion={s.id}
            ref={(el) => {
              sektionsRef.current[s.id] = el;
            }}
            className="flex flex-col gap-3 scroll-mt-4"
          >
            <h2 className="m-0 flex items-center gap-2 text-sektion uppercase text-accent">
              {s.ikon ? (
                <span aria-hidden="true" className="inline-flex size-5 items-center justify-center">
                  {/** @type {import("react").ReactNode} */ (s.ikon)}
                </span>
              ) : null}
              {s.rubrik}
            </h2>
            {s.slag === "grund"
              ? s.omraden.map((o) => (
                  <div key={o.id} className="flex flex-col gap-2">
                    <h3 className="m-0 text-etikett font-semibold uppercase tracking-wide text-ink-muted">{o.rubrik}</h3>
                    {o.avsnitt.map((a) => (
                      <Avsnitt
                        key={a.id}
                        traff={{ avsnitt: a, utdrag: "", omradeRubrik: o.rubrik }}
                        sokt={false}
                        sektionId={s.id}
                      />
                    ))}
                  </div>
                ))
              : s.omraden[0]?.avsnitt.map((a) => (
                  <Avsnitt
                    key={a.id}
                    traff={{ avsnitt: a, utdrag: "", omradeRubrik: s.rubrik }}
                    sokt={false}
                    sektionId={s.id}
                  />
                ))}
          </section>
        ))
      )}

      {barnEfter}

      {!sokt && sektioner.length === 1 && sektioner[0]?.id === GRUND_ID ? (
        <OpsBanner tone="info" title="Inga appar i hjälpen ännu">
          Installera en app i gruppen för att se dess hjälp här. Grundfunktionerna ovan gäller alltid.
        </OpsBanner>
      ) : null}
    </OpsView>
  );
}
