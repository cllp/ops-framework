import { useEffect, useRef, useState } from "react";
import { Map, NavigationControl, Popup, getWorkerUrl, setWorkerUrl } from "maplibre-gl";
// @ts-expect-error CSS-importen löses av appens bundler. tsc har ingen deklaration för den.
import "maplibre-gl/dist/maplibre-gl.css";
import { basPensel, berika, byggStil, granser, lasKartFarger, objektPensel, OBJEKT_LAGER, popupElement } from "../lib/karta.js";

/**
 * Själva kartan (0.223.0, cllp/ops-framework#570). Importeras bara av `OpsKarta`, med en dynamisk import, så MapLibre och dess CSS ligger i en egen bit.
 *
 * ⛔ WORKERN. MapLibre 6 lämnar workerns adress tom (`getWorkerUrl()` är `""`, mätt). Utan `setWorkerUrl` ritas ingen karta.
 * Samma mönster som pdf.js: `new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url)`, som Vite gör till en egen fil. `check:delbarhet` mäter den.
 */
if (!getWorkerUrl()) setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);

/**
 * @param {object} props
 * @param {import("../lib/karta.js").KartaSamling} props.samling
 * @param {Record<string, string>} props.texter
 */
export function OpsKartaVy({ samling, texter }) {
  const ruta = useRef(/** @type {HTMLDivElement | null} */ (null));
  const karta = useRef(/** @type {any} */ (null));
  const senast = useRef({ samling, texter });
  senast.current = { samling, texter };
  const [fel, setFel] = useState(/** @type {string} */ (""));

  useEffect(() => {
    const el = ruta.current;
    if (!el) return undefined;
    const { farger, saknas } = lasKartFarger();
    if (saknas.length) {
      setFel("farger");
      return undefined;
    }
    setFel("");
    let kvar = true;
    /** @type {Map} */
    let kartaNu;
    // ⛔ KONSTRUKTORN KASTAR SYNKRONT UTAN WEBGL (MapLibre 6.17.0, `map.ts:4242`, GPUInitializationError), före varje lyssnare, så lyssnaren
    // på "error" nedan når aldrig det felet. Utan fångsten kraschade effekten i stället för att visa kartans egen felrad (ChatGPT:s granskning av 587).
    try {
      kartaNu = new Map({
        container: el,
        style: /** @type {any} */ (byggStil(farger, senast.current.samling)),
        attributionControl: { compact: false },
        cooperativeGestures: true,
        locale: {
          "NavigationControl.ZoomIn": senast.current.texter.zoomaIn,
          "NavigationControl.ZoomOut": senast.current.texter.zoomaUt,
          "NavigationControl.ResetBearing": senast.current.texter.aterstall,
          "Popup.Close": senast.current.texter.stang,
          "AttributionControl.ToggleAttribution": senast.current.texter.visaTillhorighet,
          "CooperativeGesturesHandler.WindowsHelpText": senast.current.texter.ctrl,
          "CooperativeGesturesHandler.MacHelpText": senast.current.texter.cmd,
          "CooperativeGesturesHandler.MobileHelpText": senast.current.texter.tvaFingrar,
        },
        fadeDuration: 0,
      });
    } catch {
      setFel("lasfel");
      return undefined;
    }
    karta.current = kartaNu;
    kartaNu.addControl(new NavigationControl({ showCompass: false, visualizePitch: false }), "top-right");
    kartaNu.on("click", (e) => {
      const traff = kartaNu.queryRenderedFeatures(e.point, { layers: OBJEKT_LAGER });
      const feature = OBJEKT_LAGER.map((id) => traff.find((f) => f.layer?.id === id)).find(Boolean);
      if (!feature) return;
      const innehall = popupElement(feature);
      if (!innehall) return;
      new Popup({ closeButton: true, maxWidth: "16rem" }).setLngLat(e.lngLat).setDOMContent(innehall).addTo(kartaNu);
    });
    kartaNu.on("load", () => {
      if (!kvar) return;
      laggData(kartaNu, senast.current.samling);
      passa(kartaNu, senast.current.samling);
    });
    kartaNu.on("error", (e) => {
      // En bricka som faller är inte kartan som faller: underlaget fylls i när nästa kommer. Bara att ytan inte går att rita alls (WebGL) byter ut vyn.
      const meddelande = String(e?.error?.message || "");
      if (kvar && /webgl|initialize/i.test(meddelande)) setFel("lasfel");
    });
    const observator = new ResizeObserver(() => kartaNu.resize());
    observator.observe(el);
    return () => {
      kvar = false;
      observator.disconnect();
      kartaNu.remove();
      if (karta.current === kartaNu) karta.current = null;
    };
  }, []);

  useEffect(() => {
    const kartaNu = karta.current;
    if (!kartaNu?.isStyleLoaded?.()) return;
    laggData(kartaNu, samling);
    passa(kartaNu, samling);
  }, [samling]);

  useEffect(() => {
    const rot = document.documentElement;
    const medier = window.matchMedia?.("(prefers-color-scheme: dark)");
    const uppdatera = () => {
      const kartaNu = karta.current;
      if (!kartaNu) return;
      const { farger, saknas } = lasKartFarger();
      if (saknas.length) return;
      laggData(kartaNu, senast.current.samling);
      for (const [lager, prop, varde] of [...basPensel(farger), ...objektPensel(farger)]) {
        kartaNu.setPaintProperty(lager, prop, varde);
      }
    };
    const observator = new MutationObserver(uppdatera);
    observator.observe(rot, { attributes: true, attributeFilter: ["data-theme"] });
    medier?.addEventListener?.("change", uppdatera);
    return () => {
      observator.disconnect();
      medier?.removeEventListener?.("change", uppdatera);
    };
  }, []);

  if (fel === "farger") return <p role="alert" data-karta-fel="farger" className="m-0 text-etikett text-danger">{texter.farger}</p>;
  // ⛔ RUTAN HAR EN EGEN HÖJD (0.228.0, cllp/lifehub.app#765, CP 2026-11-14: "Jag kan inte se att jag får upp en karta."). Från 0.223.0 bar den bara klassnamnet `ops-karta`, som ingen CSS
  // någonstans definierade, och den inre ytan är `absolute inset-0`. Rutan blev 0 px hög, och MapLibre ritade i en yta som inte syntes. jsdom mäter ingen CSS, så inget prov såg det:
  // `check-skalyta` mäter höjden (avsnittet om kartan i Bibliotekets detalj). Storleken följer Bibliotekets andra förhandsvisningar: full bredd, `rounded-lg`, `bg-sunken`,
  // och samma tak som textrutan och videon (`max-h-96`, 384 px) från 768 px (`md:h-96`), lägre på telefon (`h-72`, 288 px) så att Ladda ned syns under. `relative` ger den inre ytan och felraden något att stå i.
  return (
    <div className="relative h-72 w-full min-w-0 overflow-hidden rounded-lg bg-sunken md:h-96" role="region" aria-label={texter.rubrik} data-karta="" data-karta-fel={fel || undefined}>
      <div ref={ruta} className="absolute inset-0" />
      {fel === "lasfel" ? <p role="alert" className="absolute inset-x-0 bottom-0 m-0 bg-karta-papper px-3 py-2 text-etikett text-karta-text">{texter.lasfel}</p> : null}
    </div>
  );
}

/**
 * @param {any} kartaNu
 * @param {import("../lib/karta.js").KartaSamling} samling
 */
function laggData(kartaNu, samling) {
  const { farger, saknas } = lasKartFarger();
  if (saknas.length) return;
  const kalla = kartaNu.getSource("objekt");
  if (kalla && "setData" in kalla) kalla.setData(berika(samling, farger));
}

/**
 * @param {any} kartaNu
 * @param {import("../lib/karta.js").KartaSamling} samling
 */
function passa(kartaNu, samling) {
  const ruta = granser(samling);
  if (!ruta) return;
  const [a, b] = ruta;
  if (a[0] === b[0] && a[1] === b[1]) {
    kartaNu.jumpTo({ center: a, zoom: 13 });
    return;
  }
  kartaNu.fitBounds(ruta, { padding: 32, maxZoom: 15, animate: false });
}
