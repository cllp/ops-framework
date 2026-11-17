import { useCallback, useEffect, useRef, useState } from "react";
import { OpsButton } from "./OpsButton.jsx";
import { IKON_FOR } from "./ikonlexikon.js";
import { ZOOM_MAX, ZOOM_MIN, anpassadSkala, zoomHjul, zoomSteg } from "../lib/htmlruta.js";
import { ordet } from "../lib/ord.js";

/**
 * Zoomen i den avspärrade rutan (0.192.0, cllp/ops-framework#529). Tillståndet här, mekanismen (skriptet och meddelandena) i `lib/htmldokument.js`, och rutan som skickar och tar emot i `HtmlRuta`.
 *
 * CP 2026-11-06: "Zoomen måste finnas med i förhandstitt." Därför bor den med den enda rutan: detaljen, versionsraden och helfönstret får samma sak.
 *
 * ⛔ ANPASSA TILL BREDD ÄR FÖRVALET. Skalan räknas ur rutans eget mått (`anpassadSkala`) varje gång rutan eller dokumentet ändrar bredd, tills någon trycker − eller +, zoomar med hjulet eller nyper med två fingrar. Ett tryck på procenten
 * går tillbaka till Anpassa till bredd. Nypningen kommer som samma stegmeddelande som hjulet (`ta`), och små steg samlas i `zoomHjul`.
 *
 * @typedef {{ skala: number, anpassa: boolean, fokus: boolean, mattNr: number, ta: (m: NonNullable<ReturnType<typeof import("../lib/htmlruta.js").tolkaRutmeddelande>>) => void, steg: (riktning: 1 | -1) => void, anpassaTillBredd: () => void }} HtmlZoom
 * @returns {HtmlZoom}
 */
export function useHtmlZoom() {
  const [manuell, setManuell] = useState(/** @type {number | null} */ (null));
  const [matt, setMatt] = useState(/** @type {{ innehall: number, synlig: number } | null} */ (null));
  const [mattNr, setMattNr] = useState(0);
  const [fokus, setFokus] = useState(false);
  const skala = manuell ?? (matt ? anpassadSkala(matt) : 1);
  const skalaRef = useRef(skala);
  skalaRef.current = skala;
  const ta = useCallback((/** @type {any} */ m) => {
    if (m.typ === "matt") {
      setMatt({ innehall: m.innehall, synlig: m.synlig });
      // Varje mått skickar skalan på nytt: ett dokument som laddats om (en annan version) börjar på zoom 1 och vet inte vad appen valt.
      setMattNr((n) => n + 1);
    } else if (m.typ === "steg") {
      setManuell(zoomHjul(skalaRef.current, m.delta));
    } else if (m.typ === "fokus") {
      setFokus(m.fokus);
    }
  }, []);
  const steg = useCallback((/** @type {1 | -1} */ riktning) => setManuell(zoomSteg(skalaRef.current, riktning)), []);
  const anpassaTillBredd = useCallback(() => setManuell(null), []);
  return { skala, anpassa: manuell === null, fokus, mattNr, ta, steg, anpassaTillBredd };
}

/**
 * Det raden behöver av en zoom. HTML-rutans (`useHtmlZoom`) och PDF-vyns (`usePdfZoom`, 0.235.0) har var sin räkning men samma knappar (regel 2).
 * `min` och `max` är gränserna för − och +. Utan dem gäller HTML-rutans, 10 och 200 procent. PDF-vyn räknar från hel bredd, 100 till 400 procent (`lib/pdfzoom.js`).
 * @typedef {{ skala: number, anpassa: boolean, steg: (riktning: 1 | -1) => void, anpassaTillBredd: () => void, min?: number, max?: number }} ZoomRad
 */

/**
 * Knapparna − , procenten och + vid rutan. Varje knapp är minst 44 px på telefonen (`OpsButton` sm).
 *
 * @param {{ zoom: ZoomRad, sprak: string }} props
 */
export function HtmlZoomRad({ zoom, sprak }) {
  const o = (/** @type {keyof typeof ORD_HTMLZOOM} */ k) => ordet(ORD_HTMLZOOM, k, sprak);
  const min = zoom.min ?? ZOOM_MIN;
  const max = zoom.max ?? ZOOM_MAX;
  const vidMin = zoom.skala <= min + 1e-9;
  const vidMax = zoom.skala >= max - 1e-9;
  // ⛔ FOKUS TAPPAS INTE VID GRÄNSEN (granskningen av 0.235.0, nit 6). En knapp som blir avstängd under fokus lämnar fokus på <body>, och den som går med tangentbordet hamnar i början av sidan.
  // Blir knappen man nyss tryckte på avstängd får den andra knappen fokus.
  const grupp = useRef(/** @type {HTMLDivElement | null} */ (null));
  const senast = useRef(/** @type {"ut" | "in" | null} */ (null));
  useEffect(() => {
    const knapp = senast.current;
    senast.current = null;
    const el = grupp.current;
    if (!knapp || !el) return;
    const knappar = el.querySelectorAll("button");
    const ut = /** @type {HTMLButtonElement | undefined} */ (knappar[0]);
    const inn = /** @type {HTMLButtonElement | undefined} */ (knappar[knappar.length - 1]);
    const tryckt = knapp === "ut" ? ut : inn;
    const annan = knapp === "ut" ? inn : ut;
    if (tryckt?.disabled && annan && !annan.disabled && (document.activeElement === tryckt || document.activeElement === document.body || document.activeElement === null)) annan.focus();
  }, [zoom.skala]);
  const procent = new Intl.NumberFormat(sprak === "en" ? "en-GB" : "sv-SE", { style: "percent", maximumFractionDigits: 0 }).format(zoom.skala);
  const Ut = IKON_FOR.zoomaUt;
  const In = IKON_FOR.zoomaIn;
  return (
    <div ref={grupp} role="group" aria-label={o("grupp")} data-html-zoom="" data-html-zoom-anpassad={zoom.anpassa ? "" : undefined} className="flex items-center gap-1">
      <OpsButton variant="ghost" size="sm" iconOnly ariaLabel={o("ut")} disabled={vidMin} onClick={() => {
          senast.current = "ut";
          zoom.steg(-1);
        }}>
        <Ut size={18} aria-hidden="true" />
      </OpsButton>
      <OpsButton variant="ghost" size="sm" ariaLabel={(zoom.anpassa ? o("anpassad") : o("anpassa")).replace("{procent}", procent)} onClick={zoom.anpassaTillBredd}>
        <span data-html-zoom-procent="" className="tabular-nums">{procent}</span>
      </OpsButton>
      <OpsButton variant="ghost" size="sm" iconOnly ariaLabel={o("in")} disabled={vidMax} onClick={() => {
          senast.current = "in";
          zoom.steg(1);
        }}>
        <In size={18} aria-hidden="true" />
      </OpsButton>
    </div>
  );
}

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_HTMLZOOM = {
  grupp: { sv: "Zoom", en: "Zoom" },
  ut: { sv: "Zooma ut", en: "Zoom out" },
  in: { sv: "Zooma in", en: "Zoom in" },
  anpassa: { sv: "{procent}. Anpassa till bredd", en: "{procent}. Fit to width" },
  anpassad: { sv: "{procent}, anpassad till bredd", en: "{procent}, fitted to width" },
};
