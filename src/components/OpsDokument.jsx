import { useEffect, useRef, useState } from "react";
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
 *
 * ⛔ RUBRIKEN HAR EGEN RAD OCH ROLLEN `rubrik` (CP 2026-10-10, iPhone).
 * Förr stod `text-sida` + `font-display` på samma rad som ikonen och Redigera,
 * och ordet trängdes. Rubriken är nu ensam under verktygsraden (pennan och
 * `extra`), med `text-rubrik`. Bibliotekets detaljhuvud (Tillbaka, ikon, ⋯)
 * ritas utanför den här komponenten.
 *
 * ⛔ ETT SPARANDE SOM FALLER SYNS OCH STÅR KVAR I REDIGERING (0.93.0). Förut sväljdes både ett kast och ett avvisat löfte
 * (`catch (e) { return; }` och `.catch(() => {})`): knappen gjorde ingenting, ingen text visades, och den som skrivit en
 * anteckning trodde att den var sparad eller trodde att knappen var trasig. Nu visas felet, läget står kvar, och en
 * `sparar`-flagga spärrar ett andra tryck medan det första pågår: två tryck på en långsam förbindelse skapade två poster.
 */

export const ORD_OPSDOKUMENT = {
  redigera: { sv: "Redigera", en: "Edit" },
  spara: { sv: "Spara", en: "Save" },
  avbryt: { sv: "Avbryt", en: "Cancel" },
};

const RUBRIK_KLASS = "m-0 min-w-0 text-rubrik text-ink wrap-anywhere";

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
 * @param {() => void | boolean | Promise<void | boolean>} [props.onSpara] `false` betyder att det inte gick, och läget står kvar. Kastar den eller avvisas löftet visas felet och läget står kvar (0.93.0).
 * @param {() => void} [props.onAvbryt] På ett nytt dokument stänger anroparen. På ett befintligt återställer anroparen fälten.
 * @param {string} [props.fel]
 * @param {import("react").ReactNode} [props.extra] Till höger i verktygsraden, till exempel menyn. Inte på samma rad som rubriken.
 * @param {boolean} [props.visaRubrik] Förval sant. Falskt när anroparen redan ritat rubriken (Bibliotekets detaljhuvud).
 */
export function OpsDokument({ ny = false, kanRedigera = false, lage, onLage, start = "las", rubrik, lasning, redigering, onSpara, onAvbryt, fel = "", extra = null, visaRubrik = true }) {
  const sprak = useOpsSprak();
  const t = (/** @type {keyof typeof ORD_OPSDOKUMENT} */ nyckel) => ordet(ORD_OPSDOKUMENT, nyckel, sprak);
  const styrd = lage === "las" || lage === "redigera";
  const [eget, setEget] = useState(ny || start === "redigera" ? "redigera" : "las");
  const nu = styrd ? lage : eget;
  const [sparar, setSparar] = useState(false);
  const [sparFel, setSparFel] = useState("");
  // Flaggan i en ref: två tryck i samma tick ser annars båda `sparar === false`.
  const pagar = useRef(false);
  // Vilket sparande ett svar hör till. Avbryt räknar upp den, och ett svar från ett avbrutet sparande görs ingenting av.
  const forsok = useRef(0);
  // Ett fel hör till redigeringen det uppstod i. Nästa gång läget blir redigering börjar det utan gammalt fel.
  useEffect(() => {
    setSparFel("");
  }, [nu]);

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
    // ⛔ Avbryt avslutar ett pågående sparande som sak (0.93.0): felet nollas, flaggan släpps och ett svar som kommer efteråt
    // ignoreras. Förut visades ett avslag som kom efter Avbryt i nästa redigering.
    forsok.current += 1;
    pagar.current = false;
    setSparar(false);
    setSparFel("");
    onAvbryt?.();
    if (!ny) byt("las");
  }

  /** @param {unknown} e */
  const felText = (e) => (e instanceof Error && e.message ? e.message : String(e));

  function spara() {
    if (pagar.current) return;
    setSparFel("");
    const mitt = ++forsok.current;
    let svar;
    try {
      svar = onSpara?.();
    } catch (e) {
      setSparFel(felText(e));
      return;
    }
    if (svar === false) return;
    if (svar && typeof svar === "object" && typeof svar.then === "function") {
      pagar.current = true;
      setSparar(true);
      svar.then(
        (/** @type {void | boolean} */ v) => {
          if (mitt !== forsok.current) return;
          pagar.current = false;
          setSparar(false);
          if (v !== false && !ny) byt("las");
        },
        (/** @type {unknown} */ e) => {
          if (mitt !== forsok.current) return;
          pagar.current = false;
          setSparar(false);
          setSparFel(felText(e));
        },
      );
      return;
    }
    if (!ny) byt("las");
  }

  const verktyg = kanRedigera || extra ? (
    <div data-ops-dokument-verktyg="" className="flex shrink-0 items-center justify-end gap-1">
      {kanRedigera ? (
        <OpsButton variant="secondary" size="sm" onClick={() => byt("redigera")}>
          <Pencil size={16} aria-hidden="true" />
          {t("redigera")}
        </OpsButton>
      ) : null}
      {extra}
    </div>
  ) : null;

  if (nu === "redigera") {
    return (
      <article data-ops-dokument="redigera" className="flex min-w-0 flex-col gap-4">
        {visaRubrik ? <h1 className={RUBRIK_KLASS}>{rubrik}</h1> : null}
        {redigering}
        {fel || sparFel ? <p role="alert" className="text-etikett text-danger">{fel || sparFel}</p> : null}
        <div className="flex flex-wrap gap-2">
          <OpsButton variant="secondary" onClick={avbryt}>{t("avbryt")}</OpsButton>
          <OpsButton variant="primary" onClick={spara} busy={sparar}>{t("spara")}</OpsButton>
        </div>
      </article>
    );
  }

  return (
    <article data-ops-dokument="las" className="flex min-w-0 flex-col gap-4">
      {verktyg}
      {visaRubrik ? <h1 className={RUBRIK_KLASS}>{rubrik}</h1> : null}
      <div data-ops-dokument-text="" className="max-w-prose">{lasning}</div>
    </article>
  );
}
