import { useEffect, useRef, useState } from "react";
import { IKON_FOR } from "./ikonlexikon.js";
import { LagerIkon } from "./icons.jsx";
import { OpsSegmented } from "./OpsSegmented.jsx";
import { OpsSwitch } from "./OpsToggle.jsx";
import { cx } from "../lib/cx.js";

/**
 * Kartans paneler i den öppnade kartan (0.258.0, cllp/lifehub.app#950 skiva 3). Importeras bara av `OpsKartaVy`, så de ligger i kartans lata bit.
 *
 * ══ ⛔ BESLUTET ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * CP 2026-11-24: "Det som saknas i kartorna innan är ju paneler för info och inställningar och lager", "VI skall ju kunna fälla ut på ett bra
 * sätt", och "Ja kör" på skissen (lifehub.app `docs/skiss/kartor/kartor-v1.0.pdf`):
 *   - Panelerna finns bara i den öppnade kartan (helskärm). Rutan i Biblioteket är 288 punkter hög på telefon och rymmer dem inte.
 *   - Dator: panelerna ligger till höger och blir smala flikar vid kanten när de fälls in. Läget minns i den här webbläsaren.
 *   - Telefon: en panel i taget, som ett ark nerifrån. Knapparna längst ner byter panel. Arket dras mellan halv och nästan hel skärm, och
 *     drags ner för att fällas in. Allt är infällt från början.
 * Info (den valda platsen och platslistan) kommer i skiva 5 och får samma ark.
 *
 * ⛔ ARKET RITAS INUTI KARTANS ELEMENT, inte genom ramverkets ark (`OpsApparArk`, Radix i sidans rot). I webbläsarens helskärm syns bara det som
 * ligger i elementet, så ett ark i sidans rot hade varit osynligt där (Fables granskning, punkt 6).
 */

/** Nyckeln för panelernas läge på dator. Per enhet i webbläsaren, aldrig på kontot (Fables punkt 7): telefon och dator ska kunna skilja sig. */
export const KARTPANELER_NYCKEL = "ops-karta-paneler-v1";

/** @typedef {"lager" | "installningar"} KartPanel */

/** @returns {{ lager: boolean, installningar: boolean }} */
function lasPanelLage() {
  try {
    const sparat = JSON.parse(globalThis.localStorage?.getItem(KARTPANELER_NYCKEL) ?? "null");
    if (sparat && typeof sparat === "object") return { lager: sparat.lager === true, installningar: sparat.installningar === true };
  } catch {
    // Lagring som är blockerad eller trasig ger förvalet: allt infällt. Kartan ritas ändå.
  }
  return { lager: false, installningar: false };
}

/** @param {{ lager: boolean, installningar: boolean }} lage */
function sparaPanelLage(lage) {
  try {
    globalThis.localStorage?.setItem(KARTPANELER_NYCKEL, JSON.stringify(lage));
  } catch {
    // Går läget inte att spara fälls panelerna in nästa gång. Inget annat påverkas.
  }
}

/**
 * @param {object} props
 * @param {import("../lib/karta.js").KartaLager[]} props.lager
 * @param {string[]} props.avslagna
 * @param {(typ: string, pa: boolean) => void} props.onLager
 * @param {string} props.grund
 * @param {(grund: string) => void} props.onGrund
 * @param {boolean} props.ortnamn
 * @param {(pa: boolean) => void} props.onOrtnamn
 * @param {boolean} props.minPosition
 * @param {(pa: boolean) => void} props.onMinPosition
 * @param {"" | "fel"} props.terrangFel
 * @param {boolean} props.bred Dator (från 768 px) eller telefon.
 * @param {Record<string, string>} props.texter
 */
export function KartaPaneler({ lager, avslagna, onLager, grund, onGrund, ortnamn, onOrtnamn, minPosition, onMinPosition, terrangFel, bred, texter }) {
  const innehall = {
    lager: <LagerInnehall lager={lager} avslagna={avslagna} onLager={onLager} texter={texter} />,
    installningar: (
      <InstallningarInnehall grund={grund} onGrund={onGrund} ortnamn={ortnamn} onOrtnamn={onOrtnamn} minPosition={minPosition} onMinPosition={onMinPosition} terrangFel={terrangFel} texter={texter} />
    ),
  };
  return bred ? <DatorPaneler innehall={innehall} texter={texter} /> : <TelefonArk innehall={innehall} texter={texter} />;
}

/**
 * @param {{ innehall: Record<KartPanel, import("react").ReactNode>, texter: Record<string, string> }} props
 */
function DatorPaneler({ innehall, texter }) {
  const [oppna, setOppna] = useState(lasPanelLage);
  /** @param {KartPanel} panel @param {boolean} pa */
  const satt = (panel, pa) => {
    setOppna((nu) => {
      const nytt = { ...nu, [panel]: pa };
      sparaPanelLage(nytt);
      return nytt;
    });
  };
  /** @type {KartPanel[]} */
  const ordning = ["lager", "installningar"];
  return (
    <div data-karta-paneler="dator" className="pointer-events-none absolute right-0 top-28 bottom-8 z-10 flex w-80 max-w-[45%] flex-col items-end gap-3 pr-3" style={{ right: "var(--safe-right, 0px)" }}>
      {ordning.map((panel) =>
        oppna[panel] ? (
          <section
            key={panel}
            aria-label={texter[panel]}
            data-karta-panel={panel}
            className="pointer-events-auto flex max-h-full w-full min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-raised text-ink shadow-md"
          >
            <PanelRubrik titel={texter[panel]} onStang={() => satt(panel, false)} stangOrd={texter.fallIn} />
            <div className="min-h-0 overflow-y-auto px-4 pb-4">{innehall[panel]}</div>
          </section>
        ) : (
          <button
            key={panel}
            type="button"
            data-karta-flik={panel}
            aria-label={`${texter.fallUt} ${texter[panel].toLowerCase()}`}
            aria-expanded="false"
            onClick={() => satt(panel, true)}
            className="pointer-events-auto -mr-3 flex min-h-11 items-center gap-2 rounded-l-lg border border-r-0 border-line bg-raised px-3 py-2 text-etikett font-medium text-ink shadow-sm hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <PanelIkon panel={panel} />
            {texter[panel]}
          </button>
        ),
      )}
    </div>
  );
}

/**
 * Arket på telefon. Tre lägen: infällt (bara knapparna), halvt och nästan helt. Handtaget dras: uppåt mot helt, nedåt mot halvt och sedan infällt.
 * Ett tryck på handtaget växlar mellan halvt och helt, så att det fungerar också utan att dra (och med skärmläsare).
 *
 * @param {{ innehall: Record<KartPanel, import("react").ReactNode>, texter: Record<string, string> }} props
 */
function TelefonArk({ innehall, texter }) {
  const [ark, setArk] = useState(/** @type {{ panel: KartPanel, lage: "halv" | "hel" } | null} */ (null));
  const drag = useRef(/** @type {{ start: number, flyttat: boolean } | null} */ (null));
  /** @type {KartPanel[]} */
  const ordning = ["lager", "installningar"];

  /** @param {import("react").PointerEvent} e */
  const borja = (e) => {
    drag.current = { start: e.clientY, flyttat: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  /** @param {import("react").PointerEvent} e */
  const slappa = (e) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !ark) return;
    const dy = e.clientY - d.start;
    if (Math.abs(dy) < 24) {
      setArk({ ...ark, lage: ark.lage === "halv" ? "hel" : "halv" });
      return;
    }
    if (dy < 0) setArk({ ...ark, lage: "hel" });
    else setArk(ark.lage === "hel" ? { ...ark, lage: "halv" } : null);
  };

  return (
    <>
      {ark ? (
        <section
          aria-label={texter[ark.panel]}
          data-karta-ark={ark.lage}
          data-karta-panel={ark.panel}
          className={cx("absolute inset-x-0 z-20 flex flex-col overflow-hidden rounded-t-xl border border-b-0 border-line bg-raised text-ink shadow-lg", ark.lage === "hel" ? "top-16" : "top-1/2")}
          style={{ bottom: "calc(var(--safe-bottom, 0px) + 4rem)" }}
        >
          <button
            type="button"
            data-karta-handtag=""
            aria-label={ark.lage === "halv" ? texter.arkHelt : texter.arkHalvt}
            onPointerDown={borja}
            onPointerUp={slappa}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setArk({ ...ark, lage: ark.lage === "halv" ? "hel" : "halv" });
              }
            }}
            className="flex h-6 w-full shrink-0 touch-none items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
          >
            <span aria-hidden="true" className="h-1 w-12 rounded-full bg-line" />
          </button>
          <PanelRubrik titel={texter[ark.panel]} onStang={() => setArk(null)} stangOrd={texter.fallIn} />
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{innehall[ark.panel]}</div>
        </section>
      ) : null}
      <nav
        aria-label={texter.paneler}
        data-karta-paneler="telefon"
        className="absolute inset-x-0 bottom-0 z-20 flex justify-center gap-2 border-t border-line bg-raised px-3 py-2"
        style={{ paddingBottom: "calc(var(--safe-bottom, 0px) + 0.5rem)" }}
      >
        {ordning.map((panel) => {
          const vald = ark?.panel === panel;
          return (
            <button
              key={panel}
              type="button"
              aria-pressed={vald}
              data-karta-panelknapp={panel}
              onClick={() => setArk(vald ? null : { panel, lage: ark?.lage ?? "halv" })}
              className={cx(
                "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-4 text-etikett font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                vald ? "bg-accent text-on-accent" : "bg-sunken text-ink hover:bg-hover",
              )}
            >
              <PanelIkon panel={panel} />
              {texter[panel]}
            </button>
          );
        })}
      </nav>
    </>
  );
}

/** @param {{ panel: KartPanel }} props */
function PanelIkon({ panel }) {
  if (panel === "lager") return <LagerIkon size={16} />;
  const Ikon = IKON_FOR.installningar;
  return <Ikon size={16} aria-hidden="true" />;
}

/** @param {{ titel: string, onStang: () => void, stangOrd: string }} props */
function PanelRubrik({ titel, onStang, stangOrd }) {
  const StangIkon = IKON_FOR.stang;
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 pl-4">
      <h2 className="m-0 text-etikett font-semibold text-ink">{titel}</h2>
      <button
        type="button"
        aria-label={`${stangOrd} ${titel.toLowerCase()}`}
        data-karta-panel-stang=""
        onClick={onStang}
        className="flex size-11 items-center justify-center rounded-base text-ink-secondary hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        <StangIkon size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Ett reglage per lager, med lagrets färg och antal. Ett lager utan objekt står kvar med 0 (regel 5): huvudet sade att det finns.
 *
 * @param {{ lager: import("../lib/karta.js").KartaLager[], avslagna: string[], onLager: (typ: string, pa: boolean) => void, texter: Record<string, string> }} props
 */
function LagerInnehall({ lager, avslagna, onLager, texter }) {
  if (!lager.length) return <p className="m-0 text-etikett text-ink-secondary" data-karta-lager-tomt="">{texter.lagerTomt}</p>;
  return (
    <div className="flex flex-col" data-karta-lagerlista="">
      {lager.map((l) => (
        <OpsSwitch
          key={l.typ || "__utan-typ"}
          placering="rad"
          label={l.typ ? l.etikett : texter.utanTyp}
          hint={l.antal === 1 ? texter.enPlats : texter.antalPlatser.replace("{n}", String(l.antal))}
          checked={!avslagna.includes(l.typ)}
          onChange={(pa) => onLager(l.typ, pa)}
          ikon={<span className="inline-block size-3 rounded-full" style={{ background: l.farg ? `var(--color-karta-${l.farg})` : "var(--color-accent)" }} />}
        />
      ))}
    </div>
  );
}

/**
 * @param {{ grund: string, onGrund: (g: string) => void, ortnamn: boolean, onOrtnamn: (pa: boolean) => void, minPosition: boolean, onMinPosition: (pa: boolean) => void, terrangFel: "" | "fel", texter: Record<string, string> }} props
 */
function InstallningarInnehall({ grund, onGrund, ortnamn, onOrtnamn, minPosition, onMinPosition, terrangFel, texter }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <p className="m-0 text-meta text-ink-secondary">{texter.kartgrund}</p>
        <OpsSegmented
          ariaLabel={texter.kartgrund}
          value={grund}
          onChange={onGrund}
          options={[
            { value: "karta", label: texter.grundKarta },
            { value: "terrang", label: texter.grundTerrang },
          ]}
        />
        {terrangFel ? (
          <p role="status" data-karta-terrang-fel="" className="m-0 text-meta text-ink-secondary">
            {texter.terrangFel}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col">
        <OpsSwitch placering="rad" label={texter.ortnamn} checked={ortnamn} onChange={onOrtnamn} />
        <OpsSwitch placering="rad" label={texter.minPositionRad} checked={minPosition} onChange={onMinPosition} />
      </div>
    </div>
  );
}

/**
 * Bredden avgör dator eller telefon: från 768 px, samma gräns som resten av ramverket (`md`).
 * @returns {boolean}
 */
export function useBredKarta() {
  const fraga = "(min-width: 768px)";
  const [bred, setBred] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(fraga).matches);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const m = window.matchMedia(fraga);
    const andra = () => setBred(m.matches);
    m.addEventListener?.("change", andra);
    andra();
    return () => m.removeEventListener?.("change", andra);
  }, []);
  return bred;
}
