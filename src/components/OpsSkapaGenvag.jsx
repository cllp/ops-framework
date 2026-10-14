import { createContext, useContext, useEffect, useRef, useState } from "react";
import { ordet } from "../lib/ord.js";
import { cx } from "../lib/cx.js";
import { KryssIkon } from "./icons.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { LANGTRYCK_KLASS, useLangtryck } from "./useLangtryck.js";

/**
 * Långtryck på en ikon i skalets rader skapar i den modulen (0.103.0).
 *
 * ⛔ HÄNDELSEN: CP 2026-10-14, "kör": "Jag funderar på om vi skulle ha långpress på ikonerna i menyraden. Att håller man inne knappen
 * på kalender kommer man direkt in i skapa ny händelse, default datum är idag ... Under appar, blir det 'Skapa app', under Ärenden
 * blir det Skapa ärende. Grupp-ikonen i telefonen långpress blir skapa grupp. Då skulle vi kunna göra +:et till en Mikrofon".
 *
 * Hur vägen går:
 *   - En nav-post (`nav`, `fasta`) eller en `OpsIconLink` bär `skapa`, en NYCKEL: samma nycklar som `useOppnaSkapa()` och adressens
 *     `?skapa=` ("handelse", "arende", "grupp", "meddelande" eller en moduls registrerings id). `validateNav` prövar formen.
 *   - Skalet säger om nyckeln har en mottagare just nu (`mal`), med samma `skapaFormFranNyckel` som plusset. Ett långtryck öppnar
 *     då samma panel som raden i plusset, genom skalets `oppnaSkapa`.
 *   - ⛔ UTAN MOTTAGARE ÄR DET INGEN GENVÄG. En nyckel som skalet inte kan öppna (en modul som inte är påslagen i gruppen, ett
 *     `skapa` som saknar posten, en ikon utanför skalet) ger inga händelser och ingen `LANGTRYCK_KLASS`: ikonen beter sig som
 *     innan, och inget ser ut att gå att hålla in.
 *
 * ⛔ TIPSRADEN SYNS EN GÅNG PER WEBBLÄSARE. Ett långtryck syns inte, och en gest ingen vet om finns inte. Första gången någon
 * trycker på en ikon som har en genväg säger en rad ovanför bottenraden att den går att hålla in, och vad det skapar. Den
 * sparas i `localStorage` (inom try/catch: en privat flik utan lagring visar raden igen nästa gång, hellre än att kasta). Den
 * visas inte från 768 px, där plusset i huvudet är vägen och raden hade varit ett tips om en telefongest. Och den visas inte
 * efter att någon redan hållit in en ikon: då vet de.
 */

/** Nyckeln i `localStorage`. */
export const GENVAG_TIPS_NYCKEL = "ops-skapa-genvag-tips";
/** Hur länge tipsraden står innan den går undan av sig själv. Samma som toasten: en mening ska hinna läsas. */
export const GENVAG_TIPS_MS = 6000;

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_SKAPAGENVAG = {
  tips: { sv: "Tips: håll in {ikon} så öppnas {vad} direkt.", en: "Tip: press and hold {ikon} to open {vad} directly." },
  stang: { sv: "Stäng tipset", en: "Close the tip" },
};

/**
 * @typedef {object} SkapaGenvagar
 * @property {(nyckel: string) => ({ namn: string, oppna: () => void } | null)} mal Mottagaren för en nyckel, eller `null`.
 * @property {(ikon: string, vad: string) => void} tryckt En ikon med genväg trycktes på vanligt sätt. Visar tipsraden första gången.
 * @property {() => void} hollIn En genväg hölls in. Tipsraden behövs inte längre.
 */

/** @type {import("react").Context<SkapaGenvagar | null>} */
const SkapaGenvagKontext = createContext(/** @type {SkapaGenvagar | null} */ (null));

/** @returns {boolean} */
function settTipset() {
  try {
    return window.localStorage.getItem(GENVAG_TIPS_NYCKEL) === "1";
  } catch {
    return false;
  }
}

function sparaSett() {
  try {
    window.localStorage.setItem(GENVAG_TIPS_NYCKEL, "1");
  } catch {
    // Utan lagring visas tipset igen nästa gång. Det är priset, och det är litet.
  }
}

/** Från 768 px är plusset i huvudet vägen, och ett tips om att hålla in en ikon gäller telefonen. @returns {boolean} */
function bredSkarm() {
  try {
    return typeof window.matchMedia === "function" && window.matchMedia("(min-width: 768px)").matches;
  } catch {
    return false;
  }
}

/**
 * Skalets genvägar och tipsraden. Läggs av `OpsAppShell`, som äger `oppnaSkapa`.
 * @param {{ mal: SkapaGenvagar["mal"], children: import("react").ReactNode }} props
 */
export function OpsSkapaGenvagar({ mal, children }) {
  const sprak = useOpsSprak();
  const [tips, setTips] = useState(/** @type {{ ikon: string, vad: string } | null} */ (null));
  const timer = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const stang = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setTips(null);
  };
  /** @type {SkapaGenvagar} */
  const varde = {
    mal,
    tryckt: (ikon, vad) => {
      if (tips || bredSkarm() || settTipset()) return;
      sparaSett();
      setTips({ ikon, vad });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setTips(null), GENVAG_TIPS_MS);
    },
    hollIn: () => {
      sparaSett();
      stang();
    },
  };
  return (
    <SkapaGenvagKontext.Provider value={varde}>
      {children}
      {tips ? (
        <div
          role="status"
          data-skapa-genvag-tips=""
          className={cx(
            "fixed inset-x-4 z-(--z-chrome) mx-auto flex max-w-md items-center gap-2 rounded-base border border-line bg-elevated py-1 pr-1 pl-3 text-brod text-ink shadow-md md:hidden",
            "bottom-[calc(var(--bottom-nav-h)+var(--safe-bottom)+var(--bottom-nav-overhang)+0.5rem)]",
          )}
        >
          <span className="min-w-0 flex-1">{ordet(ORD_SKAPAGENVAG, "tips", sprak).replace("{ikon}", tips.ikon).replace("{vad}", tips.vad)}</span>
          <button
            type="button"
            aria-label={ordet(ORD_SKAPAGENVAG, "stang", sprak)}
            onClick={stang}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <KryssIkon size={18} />
          </button>
        </div>
      ) : null}
    </SkapaGenvagKontext.Provider>
  );
}

/**
 * Genvägen för en ikon. Utan skal, utan nyckel eller utan mottagare: `aktiv` falskt, inga händelser, ingen klass.
 *
 * @param {string | null | undefined} nyckel Vad ett långtryck skapar, en nyckel som `useOppnaSkapa()` tar.
 * @param {string} ikon Ikonens namn, för tipsraden ("håll in Kalender").
 * @returns {{ aktiv: boolean, namn: string | null, handelser: Record<string, (e: any) => void>, kortkommando: string | undefined, klass: string, tryckt: () => void }}
 */
export function useSkapaGenvag(nyckel, ikon) {
  const g = useContext(SkapaGenvagKontext);
  const mal = g && typeof nyckel === "string" && nyckel !== "" ? g.mal(nyckel) : null;
  // ⛔ `kortkommando` (granskningen av PR 383, MÅSTE 1): Shift+F10 öppnar genvägen, och ytan säger det med `aria-keyshortcuts`.
  const { aktiv, handelser, kortkommando } = useLangtryck({
    onLangtryck: mal && g
      ? () => {
          g.hollIn();
          mal.oppna();
        }
      : null,
    haptik: true,
  });
  return {
    aktiv,
    namn: mal ? mal.namn : null,
    handelser,
    kortkommando,
    klass: aktiv ? LANGTRYCK_KLASS : "",
    tryckt: () => {
      if (mal && g) g.tryckt(ikon, mal.namn);
    },
  };
}
