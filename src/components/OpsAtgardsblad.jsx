import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Popover from "@radix-ui/react-popover";
import { MoreVertical } from "lucide-react";
import { LANGTRYCK_MS } from "../lib/apparark.js";
import { cx } from "../lib/cx.js";
import { ordet } from "../lib/ord.js";
import { radBehallare, radKlass } from "../lib/radKlass.js";
import { useOpsSprak } from "./OpsSprak.jsx";

/**
 * Långtryck, högerklick och en ⋮-knapp öppnar samma åtgärder för en post.
 *
 * ⛔ HÄNDELSEN: CP om Bibliotekets lista. SessionStudios `ResourceCard` har ett
 * överflödesmeny (Öppna, Redigera, Radera) och ett långtryck. På skrivbordet
 * finns inget långtryck att lita på, och en skärmläsare når det inte: därför
 * ⋮ och högerklick, samma poster. Ett långtryck som också var ett klick hade
 * både öppnat menyn och posten. Klicket sväljs när hålltiden nåtts.
 *
 * Hålltiden är `LANGTRYCK_MS` i `apparark.js`, samma som app-arket. En egen
 * millisekund här hade glidit isär.
 *
 * Under 768 px är ytan ett ark från botten. På md och uppåt en meny. Komponenten
 * känner ingen fil: den får poster och anropar dem.
 */

export const ORD_OPSATGARDSBLAD = {
  atgarder: { sv: "Åtgärder för {namn}", en: "Actions for {namn}" },
  stang: { sv: "Stäng", en: "Close" },
};

/**
 * @typedef {object} Atgard
 * @property {string} id
 * @property {string} etikett
 * @property {() => void} onValj
 * @property {boolean} [fara]
 * @property {import("react").ReactNode} [ikon]
 */

/**
 * @param {string} [fraga]
 */
function lasSmal(fraga = "(max-width: 767px)") {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(fraga).matches;
}

/**
 * @param {object} props
 * @param {string} props.namn Postens namn. Knappen och menyn annonserar det.
 * @param {readonly Atgard[]} props.poster
 * @param {import("react").ReactNode} [props.children] Raden som tar långtryck och högerklick. Utan barn ritas bara knappen.
 * @param {boolean} [props.baraKnapp] Bara ⋮, utan radomslag. För ett öppet dokument.
 */
export function OpsAtgardsblad({ namn, poster, children = null, baraKnapp = false }) {
  const sprak = useOpsSprak();
  const [oppen, setOppen] = useState(false);
  const [smal, setSmal] = useState(() => lasSmal());
  const langt = useRef(false);
  const menyRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const mq = window.matchMedia("(max-width: 767px)");
    const las = () => setSmal(mq.matches);
    las();
    mq.addEventListener("change", las);
    return () => mq.removeEventListener("change", las);
  }, []);

  if (typeof namn !== "string" || namn === "") {
    throw new Error("OpsAtgardsblad: namn krävs. Knappen och menyn annonserar vilken post det gäller, och utan namn är ⋮ en ikon utan ord.");
  }
  if (!Array.isArray(poster) || poster.length === 0) {
    return baraKnapp ? null : children;
  }
  for (const p of poster) {
    if (!p || typeof p.etikett !== "string" || p.etikett === "" || typeof p.onValj !== "function") {
      throw new Error("OpsAtgardsblad: varje post behöver etikett och onValj. En tom rad i menyn går att fokusera och gör ingenting.");
    }
  }

  const etikett = ordet(ORD_OPSATGARDSBLAD, "atgarder", sprak).replace("{namn}", namn);
  const stang = ordet(ORD_OPSATGARDSBLAD, "stang", sprak);

  /**
   * @param {any} e
   */
  function ner(e) {
    if (e.button !== 0) return;
    if (e.target instanceof Element && e.target.closest("[data-ops-atgard-knapp]")) return;
    langt.current = false;
    const startX = e.clientX;
    const startY = e.clientY;
    const timer = setTimeout(() => {
      langt.current = true;
      setOppen(true);
    }, LANGTRYCK_MS);
    const move = (/** @type {PointerEvent} */ ev) => {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 8) {
        clearTimeout(timer);
        slapp();
      }
    };
    const slapp = () => {
      clearTimeout(timer);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", slapp);
      document.removeEventListener("pointercancel", slapp);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", slapp);
    document.addEventListener("pointercancel", slapp);
  }

  /**
   * @param {any} e
   */
  function tangenter(e) {
    const rot = menyRef.current;
    if (!rot) return;
    const rader = [...rot.querySelectorAll("[role='menuitem']")];
    if (rader.length === 0) return;
    const index = rader.indexOf(/** @type {Element} */ (document.activeElement));
    const nu = index < 0 ? 0 : index;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      /** @type {HTMLElement} */ (rader[(nu + 1) % rader.length]).focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      /** @type {HTMLElement} */ (rader[(nu - 1 + rader.length) % rader.length]).focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      /** @type {HTMLElement} */ (rader[0]).focus();
    } else if (e.key === "End") {
      e.preventDefault();
      /** @type {HTMLElement} */ (rader[rader.length - 1]).focus();
    }
  }

  const rader = (
    <div ref={menyRef} role="menu" aria-label={namn} onKeyDown={tangenter} className="flex flex-col p-1">
      {poster.map((p) => (
        <button
          key={p.id}
          type="button"
          role="menuitem"
          tabIndex={-1}
          className={radKlass({ stor: true })}
          onClick={() => {
            setOppen(false);
            p.onValj();
          }}
        >
          {p.ikon ? <span aria-hidden="true" className="flex shrink-0 items-center text-ink-secondary [&_svg]:size-4">{p.ikon}</span> : null}
          <span className={cx("min-w-0 flex-1 truncate", p.fara && "text-danger")}>{p.etikett}</span>
        </button>
      ))}
    </div>
  );

  const fokusForsta = (/** @type {any} */ e) => {
    const rot = /** @type {HTMLElement} */ (e.currentTarget);
    const forsta = rot.querySelector("[role='menuitem']");
    if (forsta instanceof HTMLElement) {
      e.preventDefault();
      forsta.focus();
    }
  };

  const knappKlass = "inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-secondary hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  const knappInnehall = <MoreVertical size={20} aria-hidden="true" />;
  const knapp = smal ? (
    <button
      type="button"
      data-ops-atgard-knapp=""
      aria-label={etikett}
      aria-haspopup="menu"
      aria-expanded={oppen}
      className={knappKlass}
      onClick={() => setOppen((v) => !v)}
    >
      {knappInnehall}
    </button>
  ) : (
    <Popover.Trigger
      type="button"
      data-ops-atgard-knapp=""
      aria-label={etikett}
      className={knappKlass}
    >
      {knappInnehall}
    </Popover.Trigger>
  );

  const rad = baraKnapp ? (
    <span className="inline-flex">{knapp}</span>
  ) : (
    <div
      data-ops-atgard=""
      className="flex w-full items-center gap-1 px-4 py-3"
      onPointerDown={ner}
      onContextMenu={(e) => {
        e.preventDefault();
        setOppen(true);
      }}
      onClickCapture={(e) => {
        if (!langt.current) return;
        langt.current = false;
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
      {knapp}
    </div>
  );

  if (smal) {
    return (
      <>
        {rad}
        <Dialog.Root open={oppen} onOpenChange={setOppen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-(--z-overlay) bg-scrim" />
            <Dialog.Content
              className={cx(
                "fixed inset-x-0 bottom-0 z-(--z-modal) flex max-h-[calc(100dvh-var(--safe-top))] flex-col pb-(--safe-bottom)",
                radBehallare({ ark: true }),
              )}
              onOpenAutoFocus={fokusForsta}
              aria-describedby={undefined}
            >
              <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line" aria-hidden="true" />
              <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-1">
                <Dialog.Title className="m-0 truncate text-etikett font-medium text-ink">{namn}</Dialog.Title>
                <Dialog.Close className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-etikett text-ink-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                  {stang}
                </Dialog.Close>
              </div>
              {rader}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </>
    );
  }

  return (
    <Popover.Root open={oppen} onOpenChange={setOppen}>
      {rad}
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={4}
          className={cx("z-(--z-dropdown) min-w-52", radBehallare())}
          onOpenAutoFocus={fokusForsta}
          /*
           * Långtryck sätter `open` utan ett klick på ⋮. Fokus ligger då kvar
           * på body, och DismissableLayer läser det som fokus utanför och
           * stänger menyn i samma varv. Samma avvärjning som `OpsPanel`.
           * Ett klick utanför stänger fortfarande.
           */
          onFocusOutside={(e) => e.preventDefault()}
        >
          {rader}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
