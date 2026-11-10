import { useCallback, useRef, useState } from "react";
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
 * Knapparna − , procenten och + vid rutan. Varje knapp är minst 44 px på telefonen (`OpsButton` sm).
 *
 * @param {{ zoom: HtmlZoom, sprak: string }} props
 */
export function HtmlZoomRad({ zoom, sprak }) {
  const o = (/** @type {keyof typeof ORD_HTMLZOOM} */ k) => ordet(ORD_HTMLZOOM, k, sprak);
  const procent = new Intl.NumberFormat(sprak === "en" ? "en-GB" : "sv-SE", { style: "percent", maximumFractionDigits: 0 }).format(zoom.skala);
  const Ut = IKON_FOR.zoomaUt;
  const In = IKON_FOR.zoomaIn;
  return (
    <div role="group" aria-label={o("grupp")} data-html-zoom="" data-html-zoom-anpassad={zoom.anpassa ? "" : undefined} className="flex items-center gap-1">
      <OpsButton variant="ghost" size="sm" iconOnly ariaLabel={o("ut")} disabled={zoom.skala <= ZOOM_MIN + 1e-9} onClick={() => zoom.steg(-1)}>
        <Ut size={18} aria-hidden="true" />
      </OpsButton>
      <OpsButton variant="ghost" size="sm" ariaLabel={(zoom.anpassa ? o("anpassad") : o("anpassa")).replace("{procent}", procent)} onClick={zoom.anpassaTillBredd}>
        <span data-html-zoom-procent="" className="tabular-nums">{procent}</span>
      </OpsButton>
      <OpsButton variant="ghost" size="sm" iconOnly ariaLabel={o("in")} disabled={zoom.skala >= ZOOM_MAX - 1e-9} onClick={() => zoom.steg(1)}>
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
