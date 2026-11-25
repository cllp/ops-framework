import { useEffect, useId, useRef, useState } from "react";
import { IKON_FOR } from "./ikonlexikon.js";
import { LagerIkon } from "./icons.jsx";
import { OpsSegmented } from "./OpsSegmented.jsx";
import { OpsSwitch } from "./OpsToggle.jsx";
import { arAppleEnhet, kartlankar, popupTexter } from "../lib/karta.js";
import { cx } from "../lib/cx.js";

/**
 * Kartans paneler, knappar och infofält i den öppnade kartan (0.258.0, cllp/lifehub.app#950 skiva 3, och 0.263.0, #967). Importeras bara av
 * `OpsKartaVy`, så de ligger i kartans lata bit.
 *
 * ══ ⛔ BESLUTET ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * CP 2026-11-24: "Det som saknas i kartorna innan är ju paneler för info och inställningar och lager", "VI skall ju kunna fälla ut på ett bra
 * sätt", och "Ja kör" på skissen (lifehub.app `docs/skiss/kartor/kartor-v1.0.pdf`):
 *   - Panelerna finns bara i den öppnade kartan (helskärm). Rutan i Biblioteket är 288 punkter hög på telefon och rymmer dem inte.
 *   - Dator: panelerna ligger till höger. Läget minns i den här webbläsaren.
 *   - Telefon: en panel i taget, som ett ark nerifrån. Arket dras mellan halv och nästan hel skärm, och drags ner för att fällas in. Allt är
 *     infällt från början.
 *
 * ══ ⛔ KNAPPARNA FLYTER ÖVER KARTAN, OCH INFO ÄR ETT FÄLT LÄNGST NED (0.263.0, cllp/lifehub.app#967) ═══════════════════════════════════════
 * CP 2026-11-25, med appens karta bredvid Sardinienkartan gjord med skissramverket: "istället för att ha så stora knappar längst ner så har man
 * lite fina knappar som flyter över med lager och inställningar ... så att kartan blir lite mer självständig", och "lägga till ett fält längst ner
 * som man kan dra upp när kartan är helskärm med information också."
 *   - Raden längst ned på telefon och flikarna vid kanten på dator är borta. Lager och Inställningar är två runda knappar under zoomen och Min
 *     position, i samma form (`KARTKNAPP`). De öppnar samma paneler som förut.
 *   - Infofältet (`KartaInfo`) är skiva 5:s "Info": kartans titel i ett handtag längst ned. Uppdraget visar beskrivningen och lagren som en lista
 *     med färg, namn och antal, som "Resrutten" i Sardinienkartan. Ett tryck på en punkt visar punktens namn, beskrivning och länkar i samma fält,
 *     i stället för en popup ovanpå kartan. Fältet dras med pekaren och fälls ut och in med en knapp (tangentbord och skärmläsare).
 *
 * ⛔ ALLT RITAS INUTI KARTANS ELEMENT, inte genom ramverkets ark (`OpsApparArk`, Radix i sidans rot). I webbläsarens helskärm syns bara det som
 * ligger i elementet, så ett ark i sidans rot hade varit osynligt där (Fables granskning, punkt 6).
 */

/** Nyckeln för panelernas läge på dator. Per enhet i webbläsaren, aldrig på kontot (Fables punkt 7): telefon och dator ska kunna skilja sig. */
export const KARTPANELER_NYCKEL = "ops-karta-paneler-v1";

/**
 * Formen på kartans flytande knappar: zoom, Min position, Helskärm, Lager och Inställningar (0.263.0). Rund, 44 px, appens yta och bläck, så att de
 * följer temat ovanpå den ljusa kartan. ⛔ EN FORM FÖR ALLA: MapLibres vita fyrkanter var det CP kallade "90-tal buggigt".
 */
export const KARTKNAPP =
  "pointer-events-auto flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-raised text-ink shadow-md hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** @typedef {"lager" | "installningar"} KartPanel */
/** @typedef {{ dator: Record<KartPanel, boolean>, telefon: { panel: KartPanel, lage: "halv" | "hel" } | null, arOppen: (p: KartPanel) => boolean, vaxla: (p: KartPanel) => void, stang: (p: KartPanel) => void, setTelefonLage: (lage: "halv" | "hel" | null) => void }} KartPanelLage */

/** @type {KartPanel[]} */
const ORDNING = ["lager", "installningar"];

/** @returns {Record<KartPanel, boolean>} */
function lasPanelLage() {
  try {
    const sparat = JSON.parse(globalThis.localStorage?.getItem(KARTPANELER_NYCKEL) ?? "null");
    if (sparat && typeof sparat === "object") return { lager: sparat.lager === true, installningar: sparat.installningar === true };
  } catch {
    // Lagring som är blockerad eller trasig ger förvalet: allt infällt. Kartan ritas ändå.
  }
  return { lager: false, installningar: false };
}

/** @param {Record<KartPanel, boolean>} lage */
function sparaPanelLage(lage) {
  try {
    globalThis.localStorage?.setItem(KARTPANELER_NYCKEL, JSON.stringify(lage));
  } catch {
    // Går läget inte att spara fälls panelerna in nästa gång. Inget annat påverkas.
  }
}

/**
 * Panelernas läge, delat av knapparna och panelerna (0.263.0): knapparna står i kartans knappkolumn, panelerna på sin egen plats.
 *
 * @param {boolean} bred
 * @returns {KartPanelLage}
 */
export function useKartPaneler(bred) {
  const [dator, setDator] = useState(lasPanelLage);
  const [telefon, setTelefon] = useState(/** @type {{ panel: KartPanel, lage: "halv" | "hel" } | null} */ (null));
  /** @param {KartPanel} panel @param {boolean} pa */
  const sattDator = (panel, pa) =>
    setDator((nu) => {
      const nytt = { ...nu, [panel]: pa };
      sparaPanelLage(nytt);
      return nytt;
    });
  return {
    dator,
    telefon,
    arOppen: (panel) => (bred ? dator[panel] : telefon?.panel === panel),
    vaxla: (panel) => {
      if (bred) sattDator(panel, !dator[panel]);
      else setTelefon((nu) => (nu?.panel === panel ? null : { panel, lage: nu?.lage ?? "halv" }));
    },
    stang: (panel) => {
      if (bred) sattDator(panel, false);
      else setTelefon((nu) => (nu?.panel === panel ? null : nu));
    },
    setTelefonLage: (lage) => setTelefon((nu) => (nu && lage ? { ...nu, lage } : null)),
  };
}

/**
 * Lager och Inställningar som runda knappar i kartans knappkolumn (0.263.0).
 *
 * @param {{ paneler: KartPanelLage, texter: Record<string, string> }} props
 */
export function KartaPanelKnappar({ paneler, texter }) {
  return (
    <>
      {ORDNING.map((panel) => {
        const oppen = paneler.arOppen(panel);
        return (
          <button
            key={panel}
            type="button"
            data-karta-panelknapp={panel}
            aria-label={texter[panel]}
            title={texter[panel]}
            aria-expanded={oppen}
            onClick={() => paneler.vaxla(panel)}
            className={cx(KARTKNAPP, oppen && "border-accent text-accent")}
          >
            <PanelIkon panel={panel} size={20} />
          </button>
        );
      })}
    </>
  );
}

/**
 * @param {object} props
 * @param {KartPanelLage} props.paneler
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
export function KartaPaneler({ paneler, lager, avslagna, onLager, grund, onGrund, ortnamn, onOrtnamn, minPosition, onMinPosition, terrangFel, bred, texter }) {
  const innehall = {
    lager: <LagerInnehall lager={lager} avslagna={avslagna} onLager={onLager} texter={texter} />,
    installningar: (
      <InstallningarInnehall grund={grund} onGrund={onGrund} ortnamn={ortnamn} onOrtnamn={onOrtnamn} minPosition={minPosition} onMinPosition={onMinPosition} terrangFel={terrangFel} texter={texter} />
    ),
  };
  return bred ? <DatorPaneler paneler={paneler} innehall={innehall} texter={texter} /> : <TelefonArk paneler={paneler} innehall={innehall} texter={texter} />;
}

/**
 * Panelerna på dator: till vänster om knappkolumnen, överst i kartan.
 *
 * @param {{ paneler: KartPanelLage, innehall: Record<KartPanel, import("react").ReactNode>, texter: Record<string, string> }} props
 */
function DatorPaneler({ paneler, innehall, texter }) {
  const oppna = ORDNING.filter((p) => paneler.dator[p]);
  if (!oppna.length) return null;
  return (
    <div
      data-karta-paneler="dator"
      className="pointer-events-none absolute z-20 flex w-80 max-w-[calc(100%-6rem)] flex-col items-end gap-3"
      style={{ top: "calc(var(--safe-top, 0px) + 0.75rem)", right: "calc(var(--safe-right, 0px) + 4.25rem)", bottom: "calc(var(--safe-bottom, 0px) + 0.75rem)" }}
    >
      {oppna.map((panel) => (
        <section
          key={panel}
          aria-label={texter[panel]}
          data-karta-panel={panel}
          className="pointer-events-auto flex max-h-full w-full min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-raised text-ink shadow-lg"
        >
          <PanelRubrik titel={texter[panel]} onStang={() => paneler.stang(panel)} stangOrd={texter.fallIn} />
          <div className="min-h-0 overflow-y-auto px-4 pb-4">{innehall[panel]}</div>
        </section>
      ))}
    </div>
  );
}

/**
 * Arket på telefon. Två lägen när det är öppet: halvt och nästan helt. Handtaget dras: uppåt mot helt, nedåt mot halvt och sedan infällt.
 * Ett tryck på handtaget växlar mellan halvt och helt, så att det fungerar också utan att dra (och med skärmläsare).
 *
 * @param {{ paneler: KartPanelLage, innehall: Record<KartPanel, import("react").ReactNode>, texter: Record<string, string> }} props
 */
function TelefonArk({ paneler, innehall, texter }) {
  const ark = paneler.telefon;
  const drag = useDrag((dy) => {
    if (!ark) return;
    if (dy < 0) paneler.setTelefonLage("hel");
    else paneler.setTelefonLage(ark.lage === "hel" ? "halv" : null);
  });
  if (!ark) return null;
  return (
    <section
      aria-label={texter[ark.panel]}
      data-karta-ark={ark.lage}
      data-karta-panel={ark.panel}
      data-karta-paneler="telefon"
      className={cx("absolute inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden rounded-t-2xl border border-b-0 border-line bg-raised text-ink shadow-lg", ark.lage === "hel" ? "top-16" : "top-1/2")}
      style={{ paddingBottom: "var(--safe-bottom, 0px)", transform: drag.forskjutning > 0 ? `translateY(${drag.forskjutning}px)` : undefined }}
    >
      <button
        type="button"
        data-karta-handtag=""
        aria-label={ark.lage === "halv" ? texter.arkHelt : texter.arkHalvt}
        {...drag.pekare}
        onClick={() => {
          if (drag.slukaKlick()) return;
          paneler.setTelefonLage(ark.lage === "halv" ? "hel" : "halv");
        }}
        className="flex h-6 w-full shrink-0 cursor-grab touch-none items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        <span aria-hidden="true" className="h-1 w-10 rounded-full bg-line" />
      </button>
      <PanelRubrik titel={texter[ark.panel]} onStang={() => paneler.stang(ark.panel)} stangOrd={texter.fallIn} />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{innehall[ark.panel]}</div>
    </section>
  );
}

/**
 * Ett handtag som dras med pekaren (0.263.0). En dragning längre än `TROSKEL` px ger `vid(dy)` när fingret släpps, och klicket som följer sväljs, så
 * att ett drag aldrig också räknas som ett tryck. Ett kort tryck är ett vanligt klick: det fungerar med tangentbord och skärmläsare, som inte ger
 * några pekarhändelser. Medan fingret drar följer `forskjutning` med, så att den som drar ser att något händer.
 *
 * @param {(dy: number) => void} vid
 */
function useDrag(vid) {
  const start = useRef(/** @type {number | null} */ (null));
  const draget = useRef(false);
  const [forskjutning, setForskjutning] = useState(0);
  return {
    forskjutning,
    slukaKlick: () => {
      const var_ = draget.current;
      draget.current = false;
      return var_;
    },
    pekare: {
      /** @param {import("react").PointerEvent<HTMLElement>} e */
      onPointerDown: (e) => {
        start.current = e.clientY;
        draget.current = false;
        e.currentTarget.setPointerCapture?.(e.pointerId);
      },
      /** @param {import("react").PointerEvent<HTMLElement>} e */
      onPointerMove: (e) => {
        if (start.current === null) return;
        setForskjutning(e.clientY - start.current);
      },
      /** @param {import("react").PointerEvent<HTMLElement>} e */
      onPointerUp: (e) => {
        const s = start.current;
        start.current = null;
        setForskjutning(0);
        if (s === null) return;
        const dy = e.clientY - s;
        if (Math.abs(dy) < TROSKEL) return;
        draget.current = true;
        vid(dy);
      },
      onPointerCancel: () => {
        start.current = null;
        setForskjutning(0);
      },
    },
  };
}

/** Infofältets handtag är 3,5 rem högt (`min-h-14`). Kreditens plats i helskärm på telefon räknas från det (`KARTVY_CSS`, 4 rem). */
const INFO_HANDTAG = "3.5rem";

/** Så många pixlar måste ett handtag dras för att räknas som ett drag och inte ett tryck. */
const TROSKEL = 24;

/**
 * Infofältet längst ned i den öppnade kartan (0.263.0, cllp/lifehub.app#967, skiva 5:s "Info"). Nere är det ett handtag med kartans titel. Uppe visar det
 * beskrivningen och lagren, eller den valda punkten med namn, beskrivning och länkar.
 *
 * ⛔ HANDTAGET ÄR EN KNAPP MED `aria-expanded`. Det dras med pekaren (`useDrag`), och ett tryck eller Enter fäller ut och in. Ingen annan väg finns för den
 * som inte kan dra.
 *
 * @param {object} props
 * @param {string} props.titel Kartans titel ur huvudet, eller kartans namn när huvudet saknar titel.
 * @param {string} props.beskrivning
 * @param {import("../lib/karta.js").KartaLager[]} props.lager
 * @param {any | null} props.vald Den valda punkten (en GeoJSON-feature), eller `null` för översikten.
 * @param {boolean} props.uppe
 * @param {(uppe: boolean) => void} props.onUppe
 * @param {() => void} props.onOversikt
 * @param {boolean} props.bred
 * @param {Record<string, string>} props.texter
 */
export function KartaInfo({ titel, beskrivning, lager, vald, uppe, onUppe, onOversikt, bred, texter }) {
  const id = useId();
  const drag = useDrag((dy) => onUppe(dy < 0));
  const punkt = vald ? popupTexter(vald) : null;
  const rubrik = punkt ? punkt.namn || texter.plats : titel;
  const synlig = uppe || drag.forskjutning < 0;
  // Medan fingret drar uppåt från nere följer fältets höjd med (innehållet ritas och klipps), nedåt från uppe flyttas fältet ned.
  const hojd = uppe ? undefined : drag.forskjutning < 0 ? `calc(${INFO_HANDTAG} + ${-drag.forskjutning}px)` : undefined;
  return (
    <section
      aria-label={texter.info}
      data-karta-info={uppe ? "uppe" : "nere"}
      className={cx(
        "absolute z-20 flex flex-col overflow-hidden border-line bg-raised text-ink shadow-lg",
        bred ? "w-[22rem] max-w-[calc(100%-1.5rem)] rounded-xl border" : "inset-x-0 bottom-0 rounded-t-2xl border border-b-0",
      )}
      style={{
        ...(bred ? { left: "calc(var(--safe-left, 0px) + 0.75rem)", bottom: "calc(var(--safe-bottom, 0px) + 0.75rem)" } : { paddingBottom: "var(--safe-bottom, 0px)" }),
        maxHeight: hojd ?? (synlig ? "min(65dvh, 30rem)" : undefined),
        transform: uppe && drag.forskjutning > 0 ? `translateY(${drag.forskjutning}px)` : undefined,
      }}
    >
      <button
        type="button"
        data-karta-info-handtag=""
        aria-expanded={uppe}
        aria-controls={`${id}-innehall`}
        {...drag.pekare}
        onClick={() => {
          if (drag.slukaKlick()) return;
          onUppe(!uppe);
        }}
        className="flex min-h-14 w-full shrink-0 cursor-grab touch-none flex-col items-center justify-center gap-1.5 px-4 pt-1.5 pb-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        <span aria-hidden="true" className="h-1 w-10 rounded-full bg-line" />
        <span className="w-full truncate text-center font-karta-ort text-rubrik text-ink">{rubrik}</span>
      </button>
      {synlig ? (
        <div id={`${id}-innehall`} className="min-h-0 flex-1 overflow-y-auto px-4 pb-4" data-karta-info-innehall="">
          {punkt ? (
            <div className="flex flex-col gap-2" data-karta-info-punkt="">
              {punkt.beskrivning ? <p className="m-0 text-etikett text-ink-secondary wrap-anywhere">{punkt.beskrivning}</p> : null}
              <PopupLankar feature={vald} texter={texter} />
              <button
                type="button"
                onClick={onOversikt}
                data-karta-info-oversikt=""
                className="inline-flex min-h-11 cursor-pointer items-center self-start text-etikett font-medium text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {texter.infoOversikt}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {beskrivning ? <p className="m-0 text-etikett text-ink-secondary">{beskrivning}</p> : null}
              <InfoLagerlista lager={lager} texter={texter} />
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Lagren som en lista att läsa: färg, namn och antal. Reglagen för att slå av och på står i panelen Lager. Ett lager utan objekt står kvar med 0
 * (regel 5): huvudet sade att det finns.
 *
 * @param {{ lager: import("../lib/karta.js").KartaLager[], texter: Record<string, string> }} props
 */
function InfoLagerlista({ lager, texter }) {
  if (!lager.length) return <p className="m-0 text-etikett text-ink-secondary" data-karta-info-lager-tomt="">{texter.lagerTomt}</p>;
  return (
    <ul className="m-0 flex list-none flex-col divide-y divide-line p-0" data-karta-info-lager="">
      {lager.map((l) => (
        <li key={l.typ || "__utan-typ"} className="flex min-h-11 items-center gap-3 py-2">
          <span aria-hidden="true" className="inline-block size-3 shrink-0 rounded-full" style={{ background: l.farg ? `var(--color-karta-${l.farg})` : "var(--color-accent)" }} />
          <span className="min-w-0 flex-1 truncate text-etikett font-medium text-ink">{l.typ ? l.etikett : texter.utanTyp}</span>
          <span className="shrink-0 text-meta text-ink-secondary">{l.antal === 1 ? texter.enPlats : texter.antalPlatser.replace("{n}", String(l.antal))}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * "Öppna i Kartor" och "Öppna i Google Maps" för en punkt eller en rutt (0.234.0). CP 2026-11-16: "Samt en länk, öppna rutt eller position i telefonens
 * Kartor eller Google Maps om det är installerat." Kartor bara på en Apple-enhet, där appen finns. Båda öppnas utanför appen (`target="_blank"`),
 * som appens andra externa länkar: i appens skal är en adress utanför `allowNavigation` en adress som telefonen öppnar, och en universell länk
 * öppnar då appen om den är installerad. Står i popupen i rutan och i infofältet i helskärm.
 * @param {{ feature: any, texter: Record<string, string> }} props
 */
export function PopupLankar({ feature, texter }) {
  const lankar = kartlankar(feature);
  if (!lankar) return null;
  const klass = "inline-flex min-h-11 items-center text-etikett font-medium text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  return (
    <span className="mt-1 flex flex-wrap gap-x-4" data-karta-lankar="">
      {arAppleEnhet() ? (
        <a href={lankar.apple} target="_blank" rel="noopener noreferrer" className={klass} data-karta-lank="apple">
          {texter.oppnaKartor}
        </a>
      ) : null}
      <a href={lankar.google} target="_blank" rel="noopener noreferrer" className={klass} data-karta-lank="google">
        {texter.oppnaGoogle}
      </a>
    </span>
  );
}

/** @param {{ panel: KartPanel, size?: number }} props */
function PanelIkon({ panel, size = 16 }) {
  if (panel === "lager") return <LagerIkon size={size} />;
  const Ikon = IKON_FOR.installningar;
  return <Ikon size={size} aria-hidden="true" />;
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
