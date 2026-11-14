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
 *   - `appar`: centrerad kolumn rakt ovanför knappen. Rund ikon med etiketten under, fritt på dimman (ingen panel och ingen pil, 0.227.0).
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
      // ⛔ CP 2026-11-05, v1.0.1117: `orsak` stod kvar på "bak" från förra stängningen, och `onOpenChange` hoppar över "bak".
      // Andra gången gick menyn därför inte att stänga med tryck utanför eller Escape. Varje öppning börjar utan orsak.
      orsak.current = null;
      vald.current = null;
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
            "fixed z-(--z-dropdown) m-0 overflow-auto overscroll-contain border-0 bg-transparent p-0 shadow-none outline-none",
            "transition duration-150 ease-standard motion-reduce:transition-none",
            inne ? "translate-y-0 opacity-100" : upp ? "translate-y-2 opacity-0" : "-translate-y-2 opacity-0",
          )}
          style={
            // ⛔ HÖJDEN ÄR PLATSEN SOM FINNS, INTE 70 PROCENT (CP 2026-11-13, skärmbild av Appar i TestFlight: "Liten visuell bug").
            // Med fem appar på en telefon med 667 punkters höjd räckte inte 70dvh: listan rullade, den översta appens cirkel klipptes
            // mot kanten, och rullningslisten låg över etiketten Meddelanden. Nu får menyn hela höjden mellan knappen och skärmens
            // överkant (minus säker yta och en halv rem), och den rullar bara när den platsen inte räcker.
            ruta
              ? variant === "appar"
                ? { left: ruta.left + ruta.width / 2, bottom: `calc(100dvh - ${ruta.top}px + 8px)`, transform: "translateX(-50%)", maxHeight: ovanfor(ruta.top, 8) }
                : upp
                  ? { right: `calc(100vw - ${ruta.right}px)`, bottom: `calc(100dvh - ${ruta.top}px + 12px)`, maxHeight: ovanfor(ruta.top, 12) }
                  : {
                      right: `calc(100vw - ${ruta.right}px)`,
                      top: ruta.bottom + 12,
                      maxHeight: `calc(100dvh - ${ruta.bottom + 12}px - env(safe-area-inset-bottom, 0px) - 0.5rem)`,
                    }
              : { right: 16, bottom: 96, maxHeight: "70dvh" }
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
            // Luft runt kolumnen: cirkelns skugga klipps inte mot kanten, och telefonens rullningsindikator ligger utanför etiketterna.
            <div className="relative flex flex-col items-center gap-3 px-4 pt-2 pb-2" data-snabbmeny="appar">
              {rader.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => stang("val", p.onValj)}
                  className="flex min-h-11 min-w-11 flex-col items-center gap-1 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-surface"
                >
                  <IkonCirkel post={p} />
                  {/* ⛔ Etiketten i ett mörkt märke, som i skapa-menyn: vit text direkt på dimman hade låg kontrast i ljust läge
                      (CP 2026-11-13: "Syns mest i ljust läge"), eftersom dimman där är grå och inte mörk. */}
                  <span className="max-w-28 truncate rounded-full bg-ink px-2 py-0.5 text-meta font-medium text-canvas" data-snabbmeny-etikett="">{p.etikett}</span>
                </button>
              ))}
              {/* ⛔ INGEN PIL MOT KNAPPEN (0.227.0). CP 2026-11-14, med en skärmbild av menyn ovanför fliken: "Fortfarande en liten
                  ruta här i menyn?" Pilen (en vriden ruta i bg-surface) pekade från en panel mot fliken. Sedan 12200f6 står ikonerna
                  fritt på dimman utan panel, och då var den en lös vit ruta under kolumnen. */}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Höjden ovanför knappen som menyn får använda: från knappens överkant, minus avståndet till knappen, upp till den säkra ytan.
 * @param {number} topp Knappens överkant i px.
 * @param {number} avstand Avståndet mellan menyn och knappen i px.
 */
export function ovanfor(topp, avstand) {
  return `calc(${topp - avstand}px - env(safe-area-inset-top, 0px) - 0.5rem)`;
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
