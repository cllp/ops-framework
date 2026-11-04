import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cx } from "../lib/cx.js";
import { IKON_FOR } from "./ikonlexikon.js";

/**
 * Snabbmeny som växer ut från en knapp (0.184.0).
 *
 * Två former, samma stängning:
 *   - `skapa`: högerjusterad kolumn ovanför knappen. Etiketten till vänster i ett litet mörkt märke, rund mörk ikonknapp
 *     till höger. Kolumnen läses uppifrån: första valet högst upp, sista närmast knappen.
 *   - `appar`: centrerad kolumn rakt ovanför knappen. Rund ikon med etiketten under, och en liten pil mot knappen.
 *
 * Bakgrunden dimmas och blurras. Stängs med tryck utanför, Escape och bakåt. Fokusfällan, Escape och dialogen är Radix.
 * Bakåt är en egen post i historiken: den tas bort när menyn stängs på annat sätt, så att nästa bakåt inte är en tom post.
 *
 * ⛔ SKAPA-MENYN DÖLJER INTE PLUSKNAPPEN. Dialogen bär `data-ops-snabbmeny="skapa"`, och `arDialogOppen` hoppar över den,
 * så pluset kan bli ett kryss i stället för att försvinna. Appar-menyn är en vanlig dialog och döljer pluset.
 *
 * @param {object} props
 * @param {boolean} props.oppen
 * @param {(oppen: boolean) => void} props.onOppen
 * @param {"skapa" | "appar"} props.variant
 * @param {string} props.etikett Skärmläsarnamn på dialogen.
 * @param {ReadonlyArray<{ id: string, etikett: string, ikon?: string | null, ikonNod?: import("react").ReactNode, onValj: () => void }>} props.poster
 *   `ikon` är en nyckel i `IKON_FOR`. Saknas den ritas `ikonNod`, och saknas båda ritas `IKON_FOR.appar`.
 * @param {string | ReadonlyArray<string>} props.ankare CSS-väljare till knappen menyn växer från. Den första som syns (har bredd) vinner.
 * @param {string} [props.tomText] När `poster` är tom. En tom lista är ett svar, inte en meny utan rader.
 */
export function OpsSnabbmeny({ oppen, onOppen, variant, etikett, poster, ankare, tomText }) {
  const [ruta, setRuta] = useState(/** @type {{ top: number, left: number, right: number, bottom: number, width: number, height: number } | null} */ (null));
  const [inne, setInne] = useState(false);
  const orsak = useRef(/** @type {null | "val" | "utanfor" | "bak"} */ (null));
  const vald = useRef(/** @type {null | (() => void)} */ (null));
  const pushede = useRef(false);

  useLayoutEffect(() => {
    if (!oppen || typeof document === "undefined") {
      setRuta(null);
      setInne(false);
      return undefined;
    }
    const valjare = Array.isArray(ankare) ? ankare : [ankare];
    const mat = () => {
      for (const s of valjare) {
        const el = document.querySelector(s);
        if (!(el instanceof HTMLElement)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        setRuta({ top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height });
        return;
      }
      setRuta(null);
    };
    mat();
    const id = requestAnimationFrame(() => setInne(true));
    window.addEventListener("resize", mat);
    window.addEventListener("scroll", mat, true);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", mat);
      window.removeEventListener("scroll", mat, true);
    };
  }, [oppen, ankare]);

  useEffect(() => {
    if (!oppen || typeof window === "undefined") {
      pushede.current = false;
      return undefined;
    }
    if (!pushede.current) {
      window.history.pushState({ ...(window.history.state ?? {}), opsSnabbmeny: variant }, "");
      pushede.current = true;
    }
    const lyssna = () => {
      const o = orsak.current;
      const klar = vald.current;
      orsak.current = "bak";
      vald.current = null;
      pushede.current = false;
      onOppen(false);
      if (o === "val" && klar) setTimeout(klar, 0);
    };
    window.addEventListener("popstate", lyssna);
    return () => {
      window.removeEventListener("popstate", lyssna);
      // Föräldern stängde (pluset blev tryckt igen) utan att gå bakåt. Posten ska inte ligga kvar.
      if (orsak.current !== "bak" && pushede.current && window.history.state?.opsSnabbmeny) {
        orsak.current = "bak";
        window.history.back();
      }
    };
  }, [oppen, onOppen, variant]);

  const stang = (/** @type {"val" | "utanfor"} */ o, /** @type {null | (() => void)} */ klar = null) => {
    orsak.current = o;
    vald.current = klar;
    if (pushede.current && window.history.state?.opsSnabbmeny) {
      window.history.back();
      return;
    }
    pushede.current = false;
    onOppen(false);
    if (o === "val" && klar) setTimeout(klar, 0);
  };

  const upp = !ruta || ruta.top > (typeof window !== "undefined" ? window.innerHeight : 800) / 2;
  const rader = poster ?? [];

  return (
    <Dialog.Root
      open={oppen}
      onOpenChange={(nasta) => {
        if (nasta || orsak.current === "bak") return;
        stang("utanfor");
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-(--z-overlay) bg-scrim backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          id={variant === "appar" ? "ops-snabbmeny-appar" : "ops-snabbmeny-skapa"}
          data-ops-snabbmeny={variant}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            const valjare = Array.isArray(ankare) ? ankare : [ankare];
            for (const s of valjare) {
              const el = document.querySelector(s);
              if (el instanceof HTMLElement && el.getBoundingClientRect().width > 0) {
                el.focus();
                return;
              }
            }
          }}
          className={cx(
            "fixed z-(--z-dropdown) m-0 max-h-[70dvh] overflow-auto border-0 bg-transparent p-0 shadow-none outline-none",
            "transition duration-150 ease-standard motion-reduce:transition-none",
            inne ? "translate-y-0 opacity-100" : upp ? "translate-y-2 opacity-0" : "-translate-y-2 opacity-0",
          )}
          style={
            ruta
              ? variant === "appar"
                ? { left: ruta.left + ruta.width / 2, bottom: `calc(100dvh - ${ruta.top}px + 8px)`, transform: "translateX(-50%)" }
                : upp
                  ? { right: `calc(100vw - ${ruta.right}px)`, bottom: `calc(100dvh - ${ruta.top}px + 12px)` }
                  : { right: `calc(100vw - ${ruta.right}px)`, top: ruta.bottom + 12 }
              : { right: 16, bottom: 96 }
          }
        >
          <Dialog.Title className="sr-only">{etikett}</Dialog.Title>
          {rader.length === 0 ? (
            <p className="m-0 rounded-full bg-ink px-3 py-1.5 text-meta font-medium text-canvas">{tomText}</p>
          ) : variant === "skapa" ? (
            <div className="flex flex-col items-end gap-3" data-snabbmeny="skapa">
              {rader.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => stang("val", p.onValj)}
                  className="flex min-h-11 items-center gap-2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-surface"
                >
                  <span className="rounded-full bg-ink px-2.5 py-1 text-meta font-medium text-canvas">{p.etikett}</span>
                  <IkonCirkel post={p} mork />
                </button>
              ))}
            </div>
          ) : (
            <div className="relative flex flex-col items-center gap-3 pb-2" data-snabbmeny="appar">
              {rader.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => stang("val", p.onValj)}
                  className="flex min-h-11 min-w-11 flex-col items-center gap-1 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-surface"
                >
                  <IkonCirkel post={p} />
                  <span className="max-w-24 truncate text-meta font-medium text-white">{p.etikett}</span>
                </button>
              ))}
              <span
                data-snabbmeny-pil=""
                aria-hidden="true"
                className="absolute -bottom-1 left-1/2 size-2 -translate-x-1/2 rotate-45 bg-surface"
              />
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * @param {{ post: { ikon?: string | null, ikonNod?: import("react").ReactNode }, mork?: boolean }} props
 */
function IkonCirkel({ post, mork = false }) {
  const nyckel = post.ikon && post.ikon in IKON_FOR ? post.ikon : null;
  const Ikon = nyckel ? IKON_FOR[/** @type {keyof typeof IKON_FOR} */ (nyckel)] : null;
  return (
    <span
      className={cx(
        "inline-flex size-12 shrink-0 items-center justify-center rounded-full shadow-md [&_svg]:size-6",
        mork ? "bg-ink text-canvas" : "bg-surface text-ink",
      )}
    >
      {Ikon ? <Ikon size={24} aria-hidden="true" strokeWidth={1.5} /> : post.ikonNod ?? <IKON_FOR.appar size={24} aria-hidden="true" strokeWidth={1.5} />}
    </span>
  );
}
