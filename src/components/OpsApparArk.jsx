import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { arkRader, flyttaFore, flyttaId, LANGTRYCK_MS, medInstallningslage, ordningMedSynliga } from "../lib/apparark.js";
import { cx } from "../lib/cx.js";
import { ordet } from "../lib/ord.js";
import { arkHyllaZ, arkOvanforRad, radBehallare } from "../lib/radKlass.js";
import { text } from "../lib/sprak.js";
import { ChevronHogerIkon, ChevronVansterIkon, HubIkon } from "./icons.jsx";
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
 * Byt ordning (ägare och admin) visar grepp och en vickande ikon. Ikonerna
 * dras med pekaren (mus och finger), och pilarna på rutan och piltangenterna
 * gör samma flytt. Klar skriver `groups.moduler` via `onOrdning` och lämnar
 * läget. Det är samma lista som inställningarnas Ordning och huvudmenyn.
 * Stängning utan Klar släpper utkastet. Ett långt tryck öppnar modulen i
 * inställningsläge (`?lage=installningar`).
 *
 * På surfplatta och dator är samma innehåll en panel under huvudet. Bottenraden
 * finns inte där, och ett ark mot skärmens underkant hade täckt något som inte
 * är en flikrad.
 *
 * ⛔ HANDTAGETS FOKUSRING ÄR INTE EN APP (CP 2026-10-10, gruppen Travel, dator).
 * Arket öppnas och Radix fokuserar första knappen. Det är handtaget som drar
 * ned arket på telefonen: träffytan är `h-11` gånger `w-16`, en tunn list i
 * mitten, och `:focus-visible` ritar en accentkant runt hela träffytan. Den
 * kanten är den tomma inramade rutan högst upp, före apparna. Mätt i CP:s bild:
 * rutan sitter centrerad i panelens överkant, i accentfärgen, i samma ruta som
 * handtagets fokusring. På dator är ytan en panel, inte ett ark man drar ned,
 * så handtaget ritas inte där (`md:hidden`). Det ligger utanför tabbordningen,
 * får ingen kontur, och öppning flyttar inte fokus till det. Släppmarkeringen
 * (`data-ark-mal`) finns bara medan en app dras.
 *
 * ⛔ KROMET SKA GÅ ATT TRYCKA PÅ. En modal sätter `pointer-events: none` på
 * `body`, och då är fliken Appar död fast den syns ovanför arket. Mätt
 * 2026-10-09: arkets ruta slutade vid bottenradens överkant, men
 * `elementFromPoint` på fliken missade den. Huvudet och bottenraden får
 * pekarhändelser tillbaka, och ett tryck där stänger inte arket som ett
 * tryck utanför: flikens egen klick växlar eller navigerar.
 *
 * ⛔ HYLLAN LIGGER UNDER KROMET. Samma dag: arket ritades på `--z-modal` och
 * klippte den upphöjda plusknappen, fast underkanten redan satt vid raden.
 * Knappen bor i raden (`--z-chrome`). `arkHyllaZ` är `--z-ark`, under kromet,
 * så pluset målar över kanten. En modal som täcker skärmen från underkanten
 * stannar på `--z-modal`.
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
  vanster: { sv: "Flytta vänster", en: "Move left" },
  hoger: { sv: "Flytta höger", en: "Move right" },
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
  const [utkast, setUtkast] = useState(/** @type {string[] | null} */ (null));
  const [hallen, setHallen] = useState(/** @type {string[] | null} */ (null));
  const [drar, setDrar] = useState(/** @type {string | null} */ (null));
  const [mal, setMal] = useState(/** @type {string | null} */ (null));
  const [fel, setFel] = useState("");
  const drag = useRef(/** @type {{ y: number, dy: number } | null} */ (null));
  const pek = useRef(/** @type {{ id: string, mal: string | null } | null} */ (null));
  const startOrdning = useRef(/** @type {string[] | null} */ (null));
  const [dragY, setDragY] = useState(0);
  const smal = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(max-width: 767px)").matches;
  const rader = arkRader(grupp, moduler ?? []);
  const propIds = rader.map((r) => r.id);
  const propNyckel = propIds.join("\0");
  const hallenNyckel = hallen ? hallen.join("\0") : null;
  const visadeIds = ordnar && utkast ? utkast : hallen && hallenNyckel !== propNyckel ? hallen : propIds;
  const visade = visadeIds.map((id) => rader.find((r) => r.id === id)).filter((r) => r != null);
  const reducerad = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (hallenNyckel !== null && hallenNyckel === propNyckel) setHallen(null);
  }, [hallenNyckel, propNyckel]);

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

  const nollstallPek = () => {
    pek.current = null;
    startOrdning.current = null;
    setOrdnar(false);
    setUtkast(null);
    setDrar(null);
    setMal(null);
  };

  const stang = (/** @type {boolean} */ nasta) => {
    if (!nasta) {
      nollstallPek();
      setDragY(0);
      setFel("");
    }
    onOppen(nasta);
  };

  const ga = (/** @type {string} */ href, /** @type {any} */ e) => {
    stang(false);
    onNavigate?.(href, e);
  };

  /** @param {string[]} nasta @returns {boolean} Sant när anropet gick iväg. */
  const spara = (nasta) => {
    if (typeof onOrdning !== "function") {
      setFel(t("sparandeSaknas"));
      return false;
    }
    setFel("");
    try {
      const svar = onOrdning(nasta);
      if (svar && typeof svar.then === "function") svar.catch((e) => setFel(e instanceof Error ? e.message : String(e)));
      return true;
    } catch (e) {
      setFel(e instanceof Error ? e.message : String(e));
      return false;
    }
  };

  const oppnaOrdning = () => {
    const ids = visade.map((r) => r.id);
    startOrdning.current = ids;
    setUtkast(ids);
    setFel("");
    setOrdnar(true);
  };

  const stangOrdning = () => {
    const ut = utkast;
    const fran = startOrdning.current;
    if (grupp && ut && fran) {
      const samma = fran.length === ut.length && fran.every((id, i) => id === ut[i]);
      if (!samma && spara(ordningMedSynliga(grupp.moduler, propIds, ut))) setHallen(ut);
    }
    nollstallPek();
  };

  const flytta = (/** @type {string} */ id, /** @type {number} */ steg) => {
    setUtkast((nu) => flyttaId(nu ?? propIds, id, steg));
  };

  /** @param {EventTarget | null} nod */
  const idPa = (nod) => (nod instanceof Element ? nod.closest("[data-ark-id]")?.getAttribute("data-ark-id") ?? null : null);

  /**
   * Utan pekarfångst är händelsens mål rutan under pekaren. Med fångst blir
   * målet listan, och då är punkten under fingret sanningen.
   * @param {{ clientX: number, clientY: number, target: EventTarget | null }} e
   */
  const idUnder = (e) => {
    const franMal = idPa(e.target);
    if (franMal) return franMal;
    const punkt = typeof document.elementFromPoint === "function" ? document.elementFromPoint(e.clientX, e.clientY) : null;
    return idPa(punkt);
  };

  /** @param {import("react").PointerEvent<HTMLElement>} e */
  const borja = (e) => {
    // jsdom lämnar `button` tomt. En riktig primärknapp och ett finger är 0.
    const knapp = e.button ?? 0;
    if (!ordnar || knapp !== 0) return;
    if (e.target instanceof Element && e.target.closest("[data-ark-pil]")) return;
    const id = idPa(e.target);
    if (!id) return;
    pek.current = { id, mal: null };
    setDrar(id);
    setMal(null);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // jsdom har ingen aktiv pekare. Proven skickar händelserna direkt till rutan.
    }
  };

  /** @param {import("react").PointerEvent<HTMLElement>} e */
  const under = (e) => {
    if (!pek.current) return;
    const id = idUnder(e);
    pek.current.mal = id && id !== pek.current.id ? id : null;
    setMal(pek.current.mal);
  };

  /** @param {import("react").PointerEvent<HTMLElement>} e */
  const slapp = (e) => {
    const fran = pek.current?.id ?? null;
    const till = idUnder(e) || pek.current?.mal || null;
    pek.current = null;
    setDrar(null);
    setMal(null);
    if (!fran || !till || fran === till) return;
    setUtkast((nu) => flyttaFore(nu ?? [], fran, till));
  };

  const avbrytPek = () => {
    pek.current = null;
    setDrar(null);
    setMal(null);
  };

  return (
    <Dialog.Root open={oppen} onOpenChange={stang}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cx(
            "fixed inset-x-0 top-0 z-(--z-scrim) bg-scrim",
            arkOvanforRad,
            "md:bottom-0 md:top-[calc(var(--safe-top)+var(--topbar-height))]",
          )}
        />
        <Dialog.Content
          id="ops-appar-ark"
          data-appar-ark=""
          data-rorelse={reducerad ? "reducerad" : "normal"}
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            // Första knappen är handtaget. Dess fokusring är den tomma rutan, se filhuvudet.
            e.preventDefault();
          }}
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
            "fixed flex flex-col outline-none",
            arkHyllaZ,
            radBehallare({ ark: true }),
            "inset-x-0 max-h-[min(24rem,70dvh)]",
            arkOvanforRad,
            "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-[calc(var(--safe-top)+var(--topbar-height)+0.5rem)] md:w-[28rem] md:max-w-[calc(100vw-2rem)] md:-translate-x-1/2 md:rounded-b-card md:border",
            !reducerad && "motion-safe:transition-transform motion-safe:duration-200",
          )}
        >
          <Dialog.Title className="sr-only">{t("titel")}</Dialog.Title>
          <div className="relative flex min-h-11 items-center justify-end px-3">
            <button
              type="button"
              data-ark-handtag=""
              tabIndex={-1}
              aria-label={t("handtag")}
              className="absolute top-2 left-1/2 inline-flex h-11 w-16 -translate-x-1/2 cursor-grab items-center justify-center focus-visible:outline-none md:hidden"
            >
              <span aria-hidden="true" className="h-1 w-9 rounded-full bg-line-strong" />
            </button>
            {farAndra ? (
              <button
                type="button"
                onClick={() => (ordnar ? stangOrdning() : oppnaOrdning())}
                className="relative z-(--z-base) inline-flex min-h-11 items-center rounded-base px-2 text-etikett font-semibold text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {ordnar ? t("klar") : t("bytOrdning")}
              </button>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-3 pb-4">
            {fel ? <p role="alert">{fel}</p> : null}
            {!grupp ? <p role="status">{t("hamtar")}</p> : null}
            {grupp && visade.length === 0 ? <p data-appar-ark-tom="">{t("inga")}</p> : null}
            <ul
              aria-label={ordnar ? t("ordning") : t("lista")}
              role={ordnar ? "listbox" : "list"}
              className={cx("m-0 grid list-none grid-cols-4 gap-2 p-0", ordnar && "touch-none select-none")}
              onPointerDown={ordnar ? borja : undefined}
              onPointerMove={ordnar ? under : undefined}
              onPointerUp={ordnar ? slapp : undefined}
              onPointerCancel={ordnar ? avbrytPek : undefined}
            >
              {visade.map((rad, index) =>
                ordnar ? (
                  <OrdnaRuta
                    key={rad.id}
                    rad={rad}
                    sprak={sprak}
                    flyttaEtikett={t("flytta")}
                    vansterEtikett={`${t("vanster")}, ${text(rad.namn, sprak)}`}
                    hogerEtikett={`${t("hoger")}, ${text(rad.namn, sprak)}`}
                    forst={index === 0}
                    sist={index === visade.length - 1}
                    drar={drar === rad.id}
                    mal={mal === rad.id}
                    onFlytta={(steg) => flytta(rad.id, steg)}
                  />
                ) : (
                  <li key={rad.id} className="min-w-0">
                    <ArkRuta
                      rad={rad}
                      sprak={sprak}
                      installningarEtikett={t("installningar")}
                      onOppna={(e) => ga(rad.href, e)}
                      onInstallningar={(e) => ga(medInstallningslage(rad.href), e)}
                    />
                  </li>
                ),
              )}
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
 * Rutan i ordningsläget. Den är inte en knapp: pilknapparna inuti får inte
 * ligga i en knapp. Piltangenter och knapparna flyttar ett steg. Själva rutan
 * dras via pekarhändelser på listan.
 *
 * @param {object} props
 * @param {{ id: string, href: string, ikon: unknown, namn: { sv: string, en: string } }} props.rad
 * @param {string} props.sprak
 * @param {string} props.flyttaEtikett
 * @param {string} props.vansterEtikett
 * @param {string} props.hogerEtikett
 * @param {boolean} props.forst
 * @param {boolean} props.sist
 * @param {boolean} props.drar
 * @param {boolean} props.mal
 * @param {(steg: number) => void} props.onFlytta
 */
function OrdnaRuta({ rad, sprak, flyttaEtikett, vansterEtikett, hogerEtikett, forst, sist, drar, mal, onFlytta }) {
  const namn = text(rad.namn, sprak);
  return (
    <li
      role="option"
      aria-selected={drar}
      aria-label={namn}
      data-ark-id={rad.id}
      data-ark-drar={drar ? "" : undefined}
      data-ark-mal={mal ? "" : undefined}
      tabIndex={0}
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
      title={flyttaEtikett}
      onKeyDown={(e) => {
        if (e.target instanceof Element && e.target.closest("[data-ark-pil]")) return;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          onFlytta(1);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          onFlytta(-1);
        }
      }}
      className={cx(rutaKlass(), "relative cursor-grab", drar && "opacity-60", mal && "bg-accent-subtle")}
    >
      <span data-ark-grepp="" aria-hidden="true" className="absolute top-1 right-1 grid grid-cols-2 gap-0.5">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className="size-1 rounded-full bg-ink-muted" />
        ))}
      </span>
      <Ikonruta ikon={rad.ikon} vicka />
      <span className="line-clamp-2 w-full">{namn}</span>
      <span className="flex w-full justify-center gap-1">
        <button
          type="button"
          data-ark-pil=""
          aria-label={vansterEtikett}
          disabled={forst}
          onClick={() => onFlytta(-1)}
          className={pilKlass()}
        >
          <ChevronVansterIkon size={16} />
        </button>
        <button
          type="button"
          data-ark-pil=""
          aria-label={hogerEtikett}
          disabled={sist}
          onClick={() => onFlytta(1)}
          className={pilKlass()}
        >
          <ChevronHogerIkon size={16} />
        </button>
      </span>
    </li>
  );
}

/**
 * @param {object} props
 * @param {{ id: string, href: string, ikon: unknown, namn: { sv: string, en: string } }} props.rad
 * @param {string} props.sprak
 * @param {string} props.installningarEtikett
 * @param {(e: any) => void} props.onOppna
 * @param {(e: any) => void} props.onInstallningar
 */
function ArkRuta({ rad, sprak, installningarEtikett, onOppna, onInstallningar }) {
  const timer = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const langt = useRef(false);
  const namn = text(rad.namn, sprak);
  const avbryt = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const start = () => {
    langt.current = false;
    avbryt();
    timer.current = setTimeout(() => {
      langt.current = true;
      onInstallningar(null);
    }, LANGTRYCK_MS);
  };
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

/** @param {{ ikon: unknown, vicka?: boolean }} props */
function Ikonruta({ ikon, vicka = false }) {
  return (
    <span aria-hidden="true" className={cx(ikonLada(), vicka && "animate-vicka")}>
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

function pilKlass() {
  return "inline-flex size-11 items-center justify-center rounded-full text-ink hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40";
}
