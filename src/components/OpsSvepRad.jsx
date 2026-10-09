import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { cx } from "../lib/cx.js";
import { ordet } from "../lib/ord.js";
import { useOpsSprak } from "./OpsSprak.jsx";

/**
 * En listrad som går att svepa åt vänster så att åtgärder syns.
 *
 * ⛔ HÄNDELSEN: CP om Bibliotekets anteckningar, samma mönster som SessionStudios
 * `LibrarySwipeableRow` (cllp/sessions-platform). Svepet avslöjar Radera. Ett tryck
 * utför. Själva svepet tar aldrig bort något: ett kort oavsiktligt svep hade
 * raderat en post. Ångra ligger i raden i åtta sekunder, samma fönster som
 * `libraryDelayedAction.js` (`LIBRARY_UNDO_MS`), och först därefter anropas
 * `onValj`. En toast som enda kopia hade försvunnit om man tittade bort.
 *
 * Komponenten känner ingen post. Den får åtgärder och anropar dem.
 */

/** Åtta sekunder, samma fönster som SessionStudios biblioteksångra. */
export const ANGRA_MS = 8000;

const BREDD = 96;
const TROSKEL = 40;

export const ORD_OPSSVEPRAD = {
  angra: { sv: "Ångra", en: "Undo" },
  saknas: { sv: "Åtgärden är inte kopplad. Ingenting ändrades.", en: "The action is not connected. Nothing changed." },
};

/**
 * @typedef {object} SvepAtgard
 * @property {string} id
 * @property {string} etikett
 * @property {() => void | Promise<void>} [onValj]
 * @property {boolean} [fara]
 * @property {string} [angraMeddelande] Sätts den visas meddelandet med Ångra i `ANGRA_MS` innan `onValj`.
 */

/**
 * @param {object} props
 * @param {import("react").ReactNode} props.children
 * @param {readonly SvepAtgard[]} [props.atgarder]
 */
export function OpsSvepRad({ children, atgarder = [] }) {
  const sprak = useOpsSprak();
  const t = (/** @type {keyof typeof ORD_OPSSVEPRAD} */ nyckel) => ordet(ORD_OPSSVEPRAD, nyckel, sprak);
  const [oppna, setOppna] = useState(0);
  const [drar, setDrar] = useState(false);
  const [angra, setAngra] = useState(/** @type {{ meddelande: string } | null} */ (null));
  const [fel, setFel] = useState("");
  const oppnaRef = useRef(0);
  const svept = useRef(false);
  const timer = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const atgarderRef = useRef(atgarder);
  const atgardYta = useRef(/** @type {HTMLDivElement | null} */ (null));
  oppnaRef.current = oppna;
  atgarderRef.current = atgarder;

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    const node = atgardYta.current;
    if (!node) return;
    // React 18 räknar inte `inert` som ett booleskt attribut. Närvaron är det som stänger av ytan.
    if (oppna > 0) node.removeAttribute("inert");
    else node.setAttribute("inert", "");
  });

  if (atgarder.length === 0 && !angra && !fel) {
    return <li>{children}</li>;
  }

  /**
   * @param {SvepAtgard} a
   */
  function kor(a) {
    if (typeof a.onValj !== "function") {
      setAngra(null);
      setFel(t("saknas"));
      return;
    }
    try {
      const svar = a.onValj();
      if (svar && typeof svar.then === "function") {
        svar.then(() => setAngra(null)).catch((e) => {
          setAngra(null);
          setFel(e instanceof Error ? e.message : String(e));
        });
        return;
      }
      setAngra(null);
    } catch (e) {
      setAngra(null);
      setFel(e instanceof Error ? e.message : String(e));
    }
  }

  /**
   * @param {SvepAtgard} a
   */
  function valj(a) {
    setOppna(0);
    setFel("");
    if (!a.angraMeddelande) {
      kor(a);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setAngra({ meddelande: a.angraMeddelande });
    timer.current = setTimeout(() => {
      timer.current = null;
      kor(a);
    }, ANGRA_MS);
  }

  /**
   * @param {any} e
   */
  function ner(e) {
    // Ett tryck på den avslöjade knappen är ett nytt grepp. Flaggan från svepet
    // får inte svälja det trycket: då gick Radera inte att träffa. Kontrollen
    // står före knapphalten, för en händelse utan `button` är ändå ett tryck.
    if (e.target instanceof Element && e.target.closest("[data-ops-svep-atgard]")) {
      svept.current = false;
      return;
    }
    if ((e.button ?? 0) !== 0 || atgarderRef.current.length === 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startOppna = oppnaRef.current;
    let las = /** @type {null | "x" | "y"} */ (null);
    let flytt = 0;
    const move = (/** @type {PointerEvent} */ ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!las) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        las = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
      if (las !== "x") return;
      flytt = dx;
      const tak = atgarderRef.current.length * BREDD;
      setDrar(true);
      setOppna(Math.min(tak, Math.max(0, startOppna - dx)));
    };
    const upp = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", upp);
      document.removeEventListener("pointercancel", upp);
      setDrar(false);
      const tak = atgarderRef.current.length * BREDD;
      setOppna((nu) => (nu > TROSKEL ? tak : 0));
      if (las === "x" && Math.abs(flytt) > 8) svept.current = true;
      else if (startOppna > 0 && las !== "x") {
        setOppna(0);
        svept.current = true;
      }
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", upp);
    document.addEventListener("pointercancel", upp);
  }

  return (
    <li
      data-ops-svep={angra ? "angra" : oppna > 0 ? "oppen" : "stangd"}
      className="relative overflow-hidden"
      onPointerDown={ner}
      onClickCapture={(e) => {
        if (!svept.current) return;
        svept.current = false;
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div
        ref={atgardYta}
        data-ops-svep-atgard=""
        aria-hidden={oppna > 0 ? undefined : true}
        className="absolute inset-y-0 right-0 flex"
      >
        {atgarder.map((a) => (
          <button
            key={a.id}
            type="button"
            className={cx(
              "inline-flex w-24 cursor-pointer flex-col items-center justify-center gap-1 px-2 text-meta font-medium",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
              a.fara ? "bg-danger text-ink-inverse" : "bg-raised text-ink",
            )}
            onClick={() => valj(a)}
          >
            {a.fara ? <Trash2 size={18} aria-hidden="true" /> : null}
            <span>{a.etikett}</span>
          </button>
        ))}
      </div>
      <div
        className={cx("relative bg-canvas touch-pan-y", drar ? "select-none" : "transition-transform duration-(--duration-fast) ease-standard motion-reduce:transition-none")}
        style={{ transform: oppna > 0 ? `translateX(-${oppna}px)` : undefined }}
      >
        {angra ? (
          <div role="status" className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="min-w-0 flex-1 text-brod text-ink">{angra.meddelande}</span>
            <button
              type="button"
              className="inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-full px-3 text-etikett font-medium text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              onClick={() => {
                if (timer.current) clearTimeout(timer.current);
                timer.current = null;
                setAngra(null);
              }}
            >
              {t("angra")}
            </button>
          </div>
        ) : (
          children
        )}
        {fel ? <p role="alert" className="px-4 pb-3 text-brod text-danger">{fel}</p> : null}
      </div>
    </li>
  );
}
