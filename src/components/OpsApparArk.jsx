import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { arkRader, flyttaId, LANGTRYCK_MS, medInstallningslage, ordningMedSynliga } from "../lib/apparark.js";
import { cx } from "../lib/cx.js";
import { ordet } from "../lib/ord.js";
import { radBehallare } from "../lib/radKlass.js";
import { text } from "../lib/sprak.js";
import { HubIkon } from "./icons.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";

/**
 * App-arket (0.89.0).
 *
 * CP 2026-10-09, med en bild av Outlook på telefonen: ett tryck på Appar i
 * bottenraden öppnar ett ark ovanför raden, inte en ny sida. Arket dimmar
 * innehållet, har ett handtag, och stängs med dimningen, ett drag nedåt eller
 * Escape. Appar lyser medan arket är öppet. När det stängs är den flik man
 * stod på vald igen, eftersom adressen aldrig byttes.
 *
 * Innehållet är gruppens installerade moduler, fyra i bredd, också de som är
 * fästa i huvudet. Sista rutan är Alla appar och leder till hubbsidan.
 * Byt ordning (ägare och admin) sparar `groups.moduler`. Ett långt tryck
 * öppnar modulen i inställningsläge (`?lage=installningar`).
 *
 * På surfplatta och dator är samma innehåll en panel under huvudet. Bottenraden
 * finns inte där, och ett ark mot skärmens underkant hade täckt något som inte
 * är en flikrad.
 *
 * ⛔ KROMET SKA GÅ ATT TRYCKA PÅ. En modal sätter `pointer-events: none` på
 * `body`, och då är fliken Appar död fast den syns ovanför arket. Mätt
 * 2026-10-09: arkets ruta slutade vid bottenradens överkant, men
 * `elementFromPoint` på fliken missade den. Huvudet och bottenraden får
 * pekarhändelser tillbaka, och ett tryck där stänger inte arket som ett
 * tryck utanför: flikens egen klick växlar eller navigerar.
 *
 * ⛔ FOKUSFÄLLA, ESCAPE OCH ROLL ÄR RADIX. Samma skäl som Mer-arket: det är
 * lätt att glömma en av dem när man skriver dem själv.
 */

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_OPSAPPARARK = {
  titel: { sv: "Appar", en: "Apps" },
  bytOrdning: { sv: "Byt ordning", en: "Reorder" },
  klar: { sv: "Klar", en: "Done" },
  allaAppar: { sv: "Alla appar", en: "All apps" },
  hamtar: { sv: "Hämtar apparna.", en: "Loading the apps." },
  inga: { sv: "Gruppen har inga appar.", en: "The group has no apps." },
  handtag: { sv: "Dra ned för att stänga", en: "Drag down to close" },
  ordning: { sv: "Ordning på apparna", en: "App order" },
  lista: { sv: "Installerade appar", en: "Installed apps" },
  installningar: { sv: "Öppna inställningar", en: "Open settings" },
  flytta: { sv: "Använd piltangenterna för att flytta.", en: "Use the arrow keys to move." },
  sparandeSaknas: { sv: "Ordningen är inte kopplad. Ingenting sparades.", en: "The order is not connected. Nothing was saved." },
};

/**
 * @param {object} props
 * @param {boolean} props.oppen
 * @param {(oppen: boolean) => void} props.onOppen
 * @param {ReadonlyArray<import("../lib/modul.js").Modul>} props.moduler
 * @param {{ moduler: ReadonlyArray<string>, huvudmeny?: ReadonlyArray<string> | null } | null} props.grupp
 * @param {boolean} props.farAndra Sant för ägare och admin. Annars syns inte Byt ordning.
 * @param {(moduler: string[]) => void | Promise<void>} [props.onOrdning]
 * @param {string} props.allaHref Hubbsidans adress, sista rutan.
 * @param {(href: string, event: any) => void} [props.onNavigate]
 */
export function OpsApparArk({ oppen, onOppen, moduler, grupp, farAndra, onOrdning, allaHref, onNavigate }) {
  if (typeof farAndra !== "boolean") {
    throw new Error("OpsApparArk: farAndra krävs som true eller false. Utan propen syns Byt ordning för den som inte får ordna, eller tvärtom.");
  }
  if (typeof allaHref !== "string" || allaHref === "") {
    throw new Error("OpsApparArk: allaHref krävs, hubbsidans adress. Sista rutan ska öppna Appar-sidan som redan finns.");
  }
  const sprak = useOpsSprak();
  const t = (/** @type {keyof typeof ORD_OPSAPPARARK} */ nyckel) => ordet(ORD_OPSAPPARARK, nyckel, sprak);
  const [ordnar, setOrdnar] = useState(false);
  const [fel, setFel] = useState("");
  const drag = useRef(/** @type {{ y: number, dy: number } | null} */ (null));
  const [dragY, setDragY] = useState(0);
  const smal = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(max-width: 767px)").matches;
  const rader = arkRader(grupp, moduler ?? []);
  const reducerad = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!oppen || typeof document === "undefined") return undefined;
    const noder = document.querySelectorAll("header, [data-ops-bottenrad]");
    /** @type {Array<[HTMLElement, string]>} */
    const tidigare = [];
    for (const nod of noder) {
      if (!(nod instanceof HTMLElement)) continue;
      tidigare.push([nod, nod.style.pointerEvents]);
      nod.style.pointerEvents = "auto";
    }
    return () => {
      for (const [nod, varde] of tidigare) nod.style.pointerEvents = varde;
    };
  }, [oppen]);

  const stang = (/** @type {boolean} */ nasta) => {
    if (!nasta) {
      setOrdnar(false);
      setDragY(0);
      setFel("");
    }
    onOppen(nasta);
  };

  const ga = (/** @type {string} */ href, /** @type {any} */ e) => {
    stang(false);
    onNavigate?.(href, e);
  };

  const spara = (/** @type {string[]} */ nasta) => {
    if (typeof onOrdning !== "function") {
      setFel(t("sparandeSaknas"));
      return;
    }
    setFel("");
    try {
      const svar = onOrdning(nasta);
      if (svar && typeof svar.then === "function") svar.catch((e) => setFel(e instanceof Error ? e.message : String(e)));
    } catch (e) {
      setFel(e instanceof Error ? e.message : String(e));
    }
  };

  const flytta = (/** @type {string} */ id, /** @type {number} */ steg) => {
    if (!grupp) return;
    const synliga = rader.map((r) => r.id);
    const ny = flyttaId(synliga, id, steg);
    if (ny.every((x, i) => x === synliga[i])) return;
    spara(ordningMedSynliga(grupp.moduler, synliga, ny));
  };

  return (
    <Dialog.Root open={oppen} onOpenChange={stang}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cx(
            "fixed inset-x-0 top-0 z-(--z-scrim) bg-scrim",
            "bottom-[calc(var(--bottom-nav-h)+var(--safe-bottom))] md:bottom-0 md:top-[calc(var(--safe-top)+var(--topbar-height))]",
          )}
        />
        <Dialog.Content
          id="ops-appar-ark"
          data-appar-ark=""
          data-rorelse={reducerad ? "reducerad" : "normal"}
          aria-describedby={undefined}
          onPointerDownOutside={(e) => {
            if (arKrom(e.target)) e.preventDefault();
          }}
          onFocusOutside={(e) => {
            if (arKrom(e.target)) e.preventDefault();
          }}
          onPointerDown={(e) => {
            const tanger = /** @type {HTMLElement} */ (e.target).closest?.("[data-ark-handtag]");
            if (!tanger) return;
            drag.current = { y: e.clientY, dy: 0 };
            setDragY(0);
            e.currentTarget.setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const dy = Math.max(0, e.clientY - drag.current.y);
            drag.current.dy = dy;
            if (!reducerad && smal) setDragY(dy);
          }}
          onPointerUp={() => {
            if (drag.current && drag.current.dy > 72) stang(false);
            drag.current = null;
            setDragY(0);
          }}
          style={dragY > 0 ? { transform: `translateY(${dragY}px)` } : undefined}
          className={cx(
            "fixed z-(--z-modal) flex flex-col outline-none",
            radBehallare({ ark: true }),
            "inset-x-0 bottom-[calc(var(--bottom-nav-h)+var(--safe-bottom))] max-h-[min(24rem,70dvh)]",
            "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-[calc(var(--safe-top)+var(--topbar-height)+0.5rem)] md:w-[28rem] md:max-w-[calc(100vw-2rem)] md:-translate-x-1/2 md:rounded-b-card md:border",
            !reducerad && "motion-safe:transition-transform motion-safe:duration-200",
          )}
        >
          <Dialog.Title className="sr-only">{t("titel")}</Dialog.Title>
          <div className="relative flex min-h-11 items-center justify-end px-3">
            <button
              type="button"
              data-ark-handtag=""
              aria-label={t("handtag")}
              className="absolute top-2 left-1/2 inline-flex h-11 w-16 -translate-x-1/2 cursor-grab items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span aria-hidden="true" className="h-1 w-9 rounded-full bg-line-strong" />
            </button>
            {farAndra ? (
              <button
                type="button"
                onClick={() => setOrdnar((v) => !v)}
                className="relative z-(--z-base) inline-flex min-h-11 items-center rounded-base px-2 text-etikett font-semibold text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {ordnar ? t("klar") : t("bytOrdning")}
              </button>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-3 pb-4">
            {fel ? <p role="alert">{fel}</p> : null}
            {!grupp ? <p role="status">{t("hamtar")}</p> : null}
            {grupp && rader.length === 0 ? <p data-appar-ark-tom="">{t("inga")}</p> : null}
            <ul
              aria-label={ordnar ? t("ordning") : t("lista")}
              role={ordnar ? "listbox" : "list"}
              className={cx("m-0 grid list-none grid-cols-4 gap-2 p-0", ordnar && "touch-none")}
            >
              {rader.map((rad) => (
                <li key={rad.id} className="min-w-0">
                  <ArkRuta
                    rad={rad}
                    ordnar={ordnar}
                    sprak={sprak}
                    installningarEtikett={t("installningar")}
                    flyttaEtikett={t("flytta")}
                    onOppna={(e) => ga(rad.href, e)}
                    onInstallningar={(e) => ga(medInstallningslage(rad.href), e)}
                    onFlytta={(steg) => flytta(rad.id, steg)}
                  />
                </li>
              ))}
              <li className="min-w-0">
                <a
                  href={allaHref}
                  onClick={(e) => ga(allaHref, e)}
                  className={rutaKlass()}
                >
                  <span aria-hidden="true" className={ikonLada()}>
                    <HubIkon size={24} />
                  </span>
                  <span className="line-clamp-2 w-full">{t("allaAppar")}</span>
                </a>
              </li>
            </ul>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * @param {object} props
 * @param {{ id: string, href: string, ikon: unknown, namn: { sv: string, en: string } }} props.rad
 * @param {boolean} props.ordnar
 * @param {string} props.sprak
 * @param {string} props.installningarEtikett
 * @param {string} props.flyttaEtikett
 * @param {(e: any) => void} props.onOppna
 * @param {(e: any) => void} props.onInstallningar
 * @param {(steg: number) => void} props.onFlytta
 */
function ArkRuta({ rad, ordnar, sprak, installningarEtikett, flyttaEtikett, onOppna, onInstallningar, onFlytta }) {
  const timer = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const langt = useRef(false);
  const namn = text(rad.namn, sprak);
  const avbryt = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const start = () => {
    if (ordnar) return;
    langt.current = false;
    avbryt();
    timer.current = setTimeout(() => {
      langt.current = true;
      onInstallningar(null);
    }, LANGTRYCK_MS);
  };
  if (ordnar) {
    return (
      <button
        type="button"
        role="option"
        aria-selected="false"
        data-ark-id={rad.id}
        aria-label={namn}
        aria-keyshortcuts="ArrowLeft ArrowRight"
        title={flyttaEtikett}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault();
            onFlytta(1);
          } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            onFlytta(-1);
          }
        }}
        className={rutaKlass()}
      >
        <Ikonruta ikon={rad.ikon} />
        <span className="line-clamp-2 w-full">{namn}</span>
      </button>
    );
  }
  return (
    <a
      href={rad.href}
      data-ark-id={rad.id}
      aria-label={namn}
      title={installningarEtikett}
      onPointerDown={start}
      onPointerUp={avbryt}
      onPointerCancel={avbryt}
      onPointerLeave={avbryt}
      onContextMenu={(e) => {
        e.preventDefault();
        onInstallningar(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.shiftKey) {
          e.preventDefault();
          onInstallningar(e);
        }
      }}
      onClick={(e) => {
        avbryt();
        if (langt.current) {
          e.preventDefault();
          langt.current = false;
          return;
        }
        onOppna(e);
      }}
      className={rutaKlass()}
    >
      <Ikonruta ikon={rad.ikon} />
      <span className="line-clamp-2 w-full">{namn}</span>
    </a>
  );
}

/** @param {{ ikon: unknown }} props */
function Ikonruta({ ikon }) {
  return (
    <span aria-hidden="true" className={ikonLada()}>
      {/** @type {import("react").ReactNode} */ (ikon)}
    </span>
  );
}

/**
 * Huvudet och bottenraden ligger utanför dialogen med flit: de ska synas och gå
 * att trycka på medan arket är öppet.
 * @param {EventTarget | null} mal
 */
function arKrom(mal) {
  return mal instanceof Element && Boolean(mal.closest("header, [data-ops-bottenrad]"));
}

function rutaKlass() {
  return cx(
    "flex min-h-11 w-full flex-col items-center gap-1 rounded-base px-1 py-2 text-center text-liten text-ink",
    "hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  );
}

function ikonLada() {
  return "flex size-12 items-center justify-center rounded-xl bg-raised text-ink [&_svg]:size-6";
}
