import { useEffect, useId, useRef, useState } from "react";
import { forslagssvar, kontrolleraForslag } from "../lib/forslag.js";
import { talkOrd } from "../lib/talk.js";
import { rapporteraFel } from "../lib/felrapport.js";
import { useOpsSprak } from "./OpsSprak.jsx";
import { OpsSpinner } from "./OpsSpinner.jsx";
import { ArendePlusIkon, BockIkon, GruppIkon, HandelsePlusIkon, HubIkon, MeddelandeIkon, TradIkon } from "./icons.jsx";

/**
 * Agentens förslag som knappar under ett svar (0.105.0). Formen och skälet står i `src/lib/forslag.js`.
 *
 * ⛔ ETT TRYCK ÄR ETT ANROP. Ett andra tryck medan anropet pågår gör ingenting, och efter Klart eller Gjordes inte gör knappen
 * ingenting mer. Spärren står i en ref, inte bara i tillståndet: två tryck i samma ögonblick hinner inte se ett nytt tillstånd.
 * ⛔ ETT FEL SÄGS MED VÅRA ORD, INTE MED FELETS (granskningen av PR 387). `felForslag` står i statusraden på personens språk, och felets
 * egen text ("onForslag ska lösa till …", ett serverfel) går bara till felrapporten: den är skriven för den som bygger, inte för den
 * som tryckte.
 * ⛔ ETT FEL GÅR ATT FÖRSÖKA IGEN. Ett avvisat löfte betyder att trycket inte nådde fram eller att appen föll, och då har inget
 * gjorts. Att ett förslag bara kan utföras en gång är serverns sak: den ser om det redan är använt.
 * ⛔ aria-disabled OCH INTE disabled. En knapp som blir `disabled` tappar fokus, och tangentbordet hamnar i sidans topp.
 * ⛔ UTFALLET SÄGS I EN STATUSRAD SOM FINNS FRÅN BÖRJAN (samma skäl som TALK:s statusregion, 0.97.0): en region som föds med sin
 * text läses inte alltid upp.
 *
 * @param {{
 *   forslag: ReadonlyArray<import("../lib/forslag.js").Forslag>,
 *   onForslag: (id: string) => Promise<import("../lib/forslag.js").Forslagssvar>,
 * }} props
 */
export function OpsForslag(props) {
  const okanda = Object.keys(props).filter((k) => k !== "forslag" && k !== "onForslag");
  if (okanda.length) throw new Error(`OpsForslag: okända props ${okanda.join(", ")}. Tillåtna: forslag, onForslag.`);
  const { forslag, onForslag } = props;
  kontrolleraForslag(forslag, "OpsForslag");
  if (typeof onForslag !== "function") throw new Error(`OpsForslag: onForslag ska vara en funktion, fick ${typeof onForslag}. En knapp som inte går att trycka på hade lovat något som inte händer.`);
  const sprak = useOpsSprak();
  const rubrik = useId();
  /** @typedef {Record<string, { lage: "pagar" | "ok" | "nekad" | "fel", text: string }>} Utfallen */
  const [utfall, setUtfall] = useState(/** @type {Utfallen} */ ({}));
  /** Förslag vars anrop pågår eller är avgjort. Läses i trycket, före tillståndet. */
  const spard = useRef(/** @type {Set<string>} */ (new Set()));
  const monterad = useRef(true);
  useEffect(() => {
    monterad.current = true;
    return () => {
      monterad.current = false;
    };
  }, []);
  if (forslag.length === 0) return null;

  /** @param {string} id */
  const tryck = (id) => {
    if (spard.current.has(id)) return;
    spard.current.add(id);
    setUtfall((/** @type {Utfallen} */ u) => ({ ...u, [id]: { lage: "pagar", text: "" } }));
    Promise.resolve()
      .then(() => onForslag(id))
      .then((svar) => {
        const s = forslagssvar(svar);
        if (monterad.current) setUtfall((/** @type {Utfallen} */ u) => ({ ...u, [id]: { lage: s.utfall, text: s.text } }));
      })
      .catch((fel) => {
        rapporteraFel(fel, { yta: "OpsForslag", steg: "tryck" });
        spard.current.delete(id);
        if (monterad.current) setUtfall((/** @type {Utfallen} */ u) => ({ ...u, [id]: { lage: "fel", text: "" } }));
      });
  };

  return (
    <div role="group" aria-labelledby={rubrik} data-ops-forslag="" className="flex w-full min-w-0 flex-col gap-2">
      <span id={rubrik} className="sr-only">{talkOrd("forslagen", sprak)}</span>
      {forslag.map((f) => {
        const u = utfall[f.id];
        const klar = u?.lage === "ok" || u?.lage === "nekad";
        const pagar = u?.lage === "pagar";
        const Ikon = IKONER[f.ikon ?? ""] ?? BockIkon;
        return (
          <div key={f.id} data-forslag={f.id} data-forslag-lage={u?.lage ?? "vilar"} className="flex min-w-0 flex-col gap-1">
            <button
              type="button"
              aria-disabled={pagar || klar || undefined}
              aria-busy={pagar || undefined}
              onClick={() => tryck(f.id)}
              className="inline-flex min-h-11 min-w-0 cursor-pointer items-center gap-2 self-start rounded-3xl border border-line-strong bg-raised px-4 py-2 text-left text-etikett font-medium text-ink hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-disabled:cursor-default aria-disabled:opacity-60 [overflow-wrap:anywhere]"
            >
              {pagar ? <OpsSpinner size="sm" decorative /> : <Ikon size={16} />}
              <span className="min-w-0">{f.etikett}</span>
            </button>
            {f.text ? <p data-forslag-text="" className="m-0 ml-4 text-liten text-ink-secondary [overflow-wrap:anywhere] line-clamp-3">{f.text}</p> : null}
            <p role="status" aria-live="polite" className={u && u.lage !== "pagar" ? `m-0 ml-4 text-liten ${u.lage === "ok" ? "text-ink-secondary" : "text-danger"}` : "sr-only"}>
              {u?.lage === "pagar" ? talkOrd("forslagPagar", sprak) : null}
              {u?.lage === "ok" ? u.text || talkOrd("forslagKlart", sprak) : null}
              {u?.lage === "nekad" ? u.text || talkOrd("forslagNekat", sprak) : null}
              {u?.lage === "fel" ? talkOrd("felForslag", sprak) : null}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/** Ikonerna i `FORSLAG_IKONER`, i samma ordning. */
const IKONER = /** @type {Record<string, typeof BockIkon>} */ ({
  arende: ArendePlusIkon,
  handelse: HandelsePlusIkon,
  meddelande: MeddelandeIkon,
  app: HubIkon,
  kommentar: TradIkon,
  hantera: BockIkon,
  dela: GruppIkon,
});
