import { useState } from "react";
import { Pencil } from "lucide-react";
import { ordet } from "../lib/ord.js";
import { OpsButton } from "./OpsButton.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";

/**
 * Läsvy och redigeringsvy för ett dokument.
 *
 * ⛔ HÄNDELSEN: CP om Bibliotekets anteckningar. Posten öppnades som fält
 * (Rubrik, Text) med Spara och en stor röd Radera. SessionStudios `NotesSection`
 * visar texten, och Redigera byter till fält med Avbryt och Spara. Öppning är
 * läsning. Ett nytt dokument börjar i redigering, för det finns inget att läsa.
 *
 * Radering hör inte hemma här. Den ligger i menyn, med en fråga. Komponenten
 * känner ingen anteckning: läsningen och fälten skickas in.
 */

export const ORD_OPSDOKUMENT = {
  redigera: { sv: "Redigera", en: "Edit" },
  spara: { sv: "Spara", en: "Save" },
  avbryt: { sv: "Avbryt", en: "Cancel" },
};

/**
 * @param {object} props
 * @param {boolean} [props.ny] Nytt dokument. Börjar i redigering. Avbryt stänger, via `onAvbryt`.
 * @param {boolean} [props.kanRedigera] Pennan ritas bara då.
 * @param {"las" | "redigera"} [props.lage] Styrd av anroparen. Utan den äger komponenten läget.
 * @param {(lage: "las" | "redigera") => void} [props.onLage]
 * @param {"las" | "redigera"} [props.start] Startläge när komponenten äger läget. Förval läsning.
 * @param {string} props.rubrik Rubriken i läsläget, och sidans rubrik i redigering.
 * @param {import("react").ReactNode} props.lasning Renderad text. Inga fält.
 * @param {import("react").ReactNode} props.redigering Fälten.
 * @param {() => void | boolean | Promise<void | boolean>} [props.onSpara] `false` betyder att det inte gick, och läget står kvar.
 * @param {() => void} [props.onAvbryt] På ett nytt dokument stänger anroparen. På ett befintligt återställer anroparen fälten.
 * @param {string} [props.fel]
 * @param {import("react").ReactNode} [props.extra] Till höger om rubriken, till exempel menyn.
 */
export function OpsDokument({ ny = false, kanRedigera = false, lage, onLage, start = "las", rubrik, lasning, redigering, onSpara, onAvbryt, fel = "", extra = null }) {
  const sprak = useOpsSprak();
  const t = (/** @type {keyof typeof ORD_OPSDOKUMENT} */ nyckel) => ordet(ORD_OPSDOKUMENT, nyckel, sprak);
  const styrd = lage === "las" || lage === "redigera";
  const [eget, setEget] = useState(ny || start === "redigera" ? "redigera" : "las");
  const nu = styrd ? lage : eget;

  if (start !== "las" && start !== "redigera") {
    throw new Error(`OpsDokument: start är "${start}". Giltiga: las, redigera.`);
  }
  if (lage !== undefined && !styrd) {
    throw new Error(`OpsDokument: lage är "${lage}". Giltiga: las, redigera, eller utelämnad.`);
  }
  if (typeof rubrik !== "string") {
    throw new Error("OpsDokument: rubrik krävs, en sträng. Utan den har läsläget ingen rubrik att annonsera.");
  }

  /**
   * @param {"las" | "redigera"} nasta
   */
  function byt(nasta) {
    if (!styrd) setEget(nasta);
    onLage?.(nasta);
  }

  function avbryt() {
    onAvbryt?.();
    if (!ny) byt("las");
  }

  function spara() {
    let svar;
    try {
      svar = onSpara?.();
    } catch (e) {
      return;
    }
    if (svar === false) return;
    if (svar && typeof svar === "object" && typeof svar.then === "function") {
      svar.then((/** @type {void | boolean} */ v) => {
        if (v !== false && !ny) byt("las");
      }).catch(() => {});
      return;
    }
    if (!ny) byt("las");
  }

  if (nu === "redigera") {
    return (
      <article data-ops-dokument="redigera" className="flex min-w-0 flex-col gap-4">
        <header className="flex items-start justify-between gap-3">
 <h1 className="m-0 min-w-0 flex-1 font-display text-sida leading-tight tracking-tight text-ink">{rubrik}</h1>
          {extra}
        </header>
        {redigering}
        {fel ? <p role="alert" className="text-brod text-danger">{fel}</p> : null}
        <div className="flex flex-wrap gap-2">
          <OpsButton variant="secondary" onClick={avbryt}>{t("avbryt")}</OpsButton>
          <OpsButton variant="primary" onClick={spara}>{t("spara")}</OpsButton>
        </div>
      </article>
    );
  }

  return (
    <article data-ops-dokument="las" className="flex min-w-0 flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
 <h1 className="m-0 min-w-0 flex-1 font-display text-sida leading-tight tracking-tight text-ink">{rubrik}</h1>
        <div className="flex shrink-0 items-center gap-1">
          {kanRedigera ? (
            <OpsButton variant="secondary" size="sm" onClick={() => byt("redigera")}>
              <Pencil size={16} aria-hidden="true" />
              {t("redigera")}
            </OpsButton>
          ) : null}
          {extra}
        </div>
      </header>
      <div data-ops-dokument-text="" className="max-w-prose">{lasning}</div>
    </article>
  );
}
