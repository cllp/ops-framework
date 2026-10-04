import { useCallback, useEffect, useRef, useState } from "react";
import { cx } from "../lib/cx.js";
import { LANGTRYCK_MS, MAX_SEKUNDER, talkFeltext, talkNasta, webblasarensInspelare } from "../lib/talk.js";
import { rapporteraFel } from "../lib/felrapport.js";
import { KryssIkon, KugghjulIkon, MikrofonIkon } from "./icons.jsx";

/**
 * TALK i komponenterna: kroken som binder ihop flödet, inspelaren och plusknappen, och fältet som ligger över appen
 * (0.57.0, cllp/lifehub.app#2). Flödet och skälen står i `src/lib/talk.js`.
 */

/**
 * @typedef {object} TalkVal
 * @property {(blob: Blob, meta: { mimeType: string, sekunder: number }) => Promise<void> | void} onTalk Appens mottagare.
 *   ⛔ Kastar den eller avvisar löftet visas felet i fältet. Ett ljud som tyst försvann hade sett ut som ett skickat.
 * @property {() => void} [onInstallningar] Kugghjulet i fältet. Utan den ritas inget kugghjul.
 * @property {import("react").ReactNode} [marke] Märket längst till vänster i fältet, vanligen hubbens.
 * @property {import("../lib/talk.js").Inspelare} [inspelare] Bara för prov. Förval: webbläsarens `MediaRecorder`.
 */

/**
 * @param {TalkVal & { onKlick: () => void }} val `onKlick` är det ett vanligt tryck gör, Skapa.
 */
export function useTalk({ onTalk, onKlick, inspelare }) {
  const [tillstand, setTillstand] = useState(/** @type {{ lage: import("../lib/talk.js").Talklage, fel?: string }} */ ({ lage: "vila" }));
  const lageRef = useRef(tillstand);
  lageRef.current = tillstand;
  const inspRef = useRef(inspelare || null);
  const timer = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const tak = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const svalj = useRef(false);
  const insp = () => {
    if (!inspRef.current) inspRef.current = webblasarensInspelare();
    return inspRef.current;
  };
  const rensa = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const skicka = useCallback(
    /** @param {import("../lib/talk.js").Talkhandelse} h */
    (h) => {
      const nasta = talkNasta(lageRef.current, h);
      lageRef.current = nasta;
      setTillstand({ lage: nasta.lage, ...(nasta.fel ? { fel: nasta.fel } : {}) });
      if (nasta.gor === "klick") onKlick();
      if (nasta.gor === "kasta") {
        if (tak.current) clearTimeout(tak.current);
        try {
          insp().kasta();
        } catch (fel) {
          rapporteraFel(fel, { yta: "OpsTalk", steg: "kasta" });
        }
      }
      if (nasta.gor === "starta") {
        insp()
          .starta()
          .then(() => {
            // ⛔ Krysset kan ha tryckts medan mikrofonen öppnades. Då ska den stängas igen, inte spela in i bakgrunden.
            const l = lageRef.current.lage;
            if (l !== "haller" && l !== "lyssnar") {
              insp().kasta();
              return;
            }
            tak.current = setTimeout(() => skicka({ typ: "tak" }), MAX_SEKUNDER * 1000);
          })
          .catch((fel) => skicka({ typ: "fel", text: talkFeltext(fel) }));
      }
      if (nasta.gor === "skicka") {
        if (tak.current) clearTimeout(tak.current);
        insp()
          .stoppa()
          .then(({ blob, mimeType, sekunder }) => onTalk(blob, { mimeType, sekunder }))
          .then(() => skicka({ typ: "klar" }))
          .catch((fel) => {
            rapporteraFel(fel, { yta: "OpsTalk", steg: "skicka" });
            skicka({ typ: "fel", text: fel instanceof Error && fel.message ? fel.message : "Det inspelade kunde inte skickas." });
          });
      }
    },
    [onKlick, onTalk],
  );

  useEffect(() => () => {
    rensa();
    if (tak.current) clearTimeout(tak.current);
    if (lageRef.current.lage === "haller" || lageRef.current.lage === "lyssnar") inspRef.current?.kasta();
  }, []);

  /**
   * Plusknappens händelser. ⛔ KLICKET STYRS HÄR OCH INTE AV `onClick`: ett långtryck följs av ett klick i varje
   * webbläsare, och det klicket får inte öppna Skapa ovanpå fältet.
   */
  const knapp = {
    onPointerDown: (/** @type {import("react").PointerEvent} */ e) => {
      if (e.button !== undefined && e.button !== 0) return;
      svalj.current = true;
      skicka({ typ: "ner" });
      rensa();
      timer.current = setTimeout(() => skicka({ typ: "langtryck" }), LANGTRYCK_MS);
    },
    onPointerUp: () => {
      rensa();
      skicka({ typ: "upp" });
    },
    onPointerCancel: () => {
      rensa();
      if (lageRef.current.lage === "trycker") skicka({ typ: "avbryt" });
      else skicka({ typ: "upp" });
    },
    onContextMenu: (/** @type {import("react").MouseEvent} */ e) => e.preventDefault(),
    onClick: (/** @type {import("react").MouseEvent} */ e) => {
      // Ett klick utan pekare före (tangentbordet) är ett vanligt klick.
      if (svalj.current) {
        svalj.current = false;
        e.preventDefault();
        return;
      }
      onKlick();
    },
  };

  // ⛔ Stabil: fältets animation startar om när `niva` byts.
  const niva = useCallback(() => {
    try {
      return inspRef.current ? inspRef.current.niva() : 0;
    } catch {
      return 0;
    }
  }, []);

  return {
    lage: tillstand.lage,
    fel: tillstand.fel,
    knapp,
    direkt: () => skicka({ typ: "direkt" }),
    skickaIn: () => skicka({ typ: "skicka" }),
    avbryt: () => skicka({ typ: "avbryt" }),
    niva,
  };
}

/** Hur många prickar fältet ritar. */
export const TALK_PRICKAR = 10;

/**
 * Fältet som ligger över appen medan man pratar (förebild: CP:s skärmbild 2026-10-04).
 *
 * ⛔ EN KONTROLL FINNS BARA NÄR DEN GÖR NÅGOT. Kugghjulet ritas bara med `onInstallningar`.
 *
 * ⛔ FELET STÅR I FÄLTET, med orden. Ett fält som bara försvann efter ett fel hade sett ut som ett skickat ljud.
 *
 * @param {{ lage: import("../lib/talk.js").Talklage, fel?: string, niva: () => number, onSkicka: () => void, onAvbryt: () => void, onInstallningar?: () => void, marke?: import("react").ReactNode }} props
 */
export function OpsTalk({ lage, fel, niva, onSkicka, onAvbryt, onInstallningar, marke }) {
  const [nedfalld, setNedfalld] = useState(false);
  const [nivaer, setNivaer] = useState(() => Array.from({ length: TALK_PRICKAR }, () => 0));
  const lyssnar = lage === "haller" || lage === "lyssnar";

  useEffect(() => {
    if (!lyssnar || typeof requestAnimationFrame !== "function") return undefined;
    let id = 0;
    let senast = 0;
    const steg = (/** @type {number} */ t) => {
      if (t - senast > 80) {
        senast = t;
        const n = niva();
        setNivaer((f) => [...f.slice(1), n]);
      }
      id = requestAnimationFrame(steg);
    };
    id = requestAnimationFrame(steg);
    return () => cancelAnimationFrame(id);
  }, [lyssnar, niva]);

  if (lage === "vila" || lage === "trycker") return null;

  const statustext = lage === "fel" ? fel || "Något gick fel." : lage === "skickar" ? "Skickar" : "Lyssnar";

  if (nedfalld && lage !== "fel") {
    return (
      <div className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-(--z-dropdown) md:bottom-6">
        <button
          type="button"
          data-talk-pill=""
          onClick={() => setNedfalld(false)}
          aria-label={`${statustext}. Visa fältet`}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-raised px-4 text-etikett font-medium text-ink shadow-lg"
        >
          <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-accent" />
          {statustext}
        </button>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="TALK"
      data-ops-talk=""
      data-lage={lage}
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-(--z-dropdown) mx-auto max-w-md md:bottom-6"
    >
      <div className="relative flex min-h-18 items-center gap-2 rounded-full border border-line-strong bg-raised/95 py-2 pr-2 pl-4 shadow-lg backdrop-blur">
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center">
          {marke}
        </span>
        <span className="sr-only" role="status" aria-live="polite">
          {statustext}
        </span>
        {lage === "fel" ? (
          <p data-talk-fel="" className="m-0 min-w-0 flex-1 text-etikett text-danger">
            {statustext}
          </p>
        ) : (
          <span aria-hidden="true" data-talk-prickar="" className="flex min-w-0 flex-1 items-center justify-between gap-1 overflow-hidden px-1">
            {nivaer.map((n, i) => (
              <span
                key={i}
                className="block w-1.5 shrink-0 rounded-full bg-accent transition-[height,opacity] duration-75"
                // ⛔ Prickarna växer på höjden, aldrig på bredden: en prick som växer i sidled går in i grannen och raden ser ut
                // som streck (mätt i skärmbilden 390 px).
                style={{ height: `${6 + Math.round(14 * n)}px`, opacity: lage === "skickar" ? 0.35 : 0.35 + 0.65 * n }}
              />
            ))}
          </span>
        )}
        {onInstallningar && lage !== "fel" ? (
          <button type="button" aria-label="Inställningar för TALK" onClick={onInstallningar} className={runda()}>
            <KugghjulIkon />
          </button>
        ) : null}
        {lage !== "fel" ? (
          <button type="button" aria-label="Skicka" data-talk-skicka="" disabled={lage === "skickar"} onClick={onSkicka} className={runda()}>
            <MikrofonIkon />
          </button>
        ) : null}
        <button type="button" aria-label={lage === "fel" ? "Stäng" : "Avbryt"} data-talk-avbryt="" onClick={onAvbryt} className={runda("fara")}>
          <KryssIkon size={22} />
        </button>
        {lage !== "fel" ? (
          <button
            type="button"
            aria-label="Fäll ned fältet"
            onClick={() => setNedfalld(true)}
            className="absolute bottom-1 left-1/2 h-3 w-16 -translate-x-1/2 cursor-pointer"
          >
            <span aria-hidden="true" className="mx-auto block h-1 w-10 rounded-full bg-line-strong" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** @param {"vanlig" | "fara"} [ton] */
function runda(ton = "vanlig") {
  return cx(
    "inline-flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-50",
    ton === "fara" ? "bg-danger text-white hover:bg-danger/90" : "bg-sunken text-ink hover:bg-accent-faint",
  );
}
