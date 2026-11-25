import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IKON_FOR } from "./ikonlexikon.js";
import { useHelskarm } from "./useHelskarm.js";
import { GeolocateControl, Map, Popup, getWorkerUrl, setWorkerUrl } from "maplibre-gl";
// @ts-expect-error CSS-importen löses av appens bundler. tsc har ingen deklaration för den.
import "maplibre-gl/dist/maplibre-gl.css";
import { basPensel, berika, byggStil, granser, grundensSynlighet, kartansLager, KARTPOPUP_CSS, KARTPOPUP_KLASS, KARTPOPUP_STIL_ID, KARTVY_CSS, lagerFilter, lasKartFarger, objektPensel, OBJEKT_FILTERLAGER, OBJEKT_LAGER, popupElement, skuggPensel, terrangKalla, terrangSkugga, TERRANG_SKUGGA } from "../lib/karta.js";
import { KARTKNAPP, KartaInfo, KartaPanelKnappar, KartaPaneler, PopupLankar, useBredKarta, useKartPaneler } from "./OpsKartaPaneler.jsx";
import { cx } from "../lib/cx.js";

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
  const ram = useRef(/** @type {HTMLDivElement | null} */ (null));
  const karta = useRef(/** @type {any} */ (null));
  const senast = useRef({ samling, texter });
  senast.current = { samling, texter };
  const [fel, setFel] = useState(/** @type {string} */ (""));
  // Den öppna popupen: platsen i dess innehåll där vyn ritar sina knappar (en portal), och popupen själv.
  // ⛔ MIN POSITION SOM INTE GICK ATT FÅ SYNS (0.234.0, regel 5): "nekad" när personen eller telefonen sagt nej, "fel" när positionen inte kom.
  const [platsFel, setPlatsFel] = useState(/** @type {"" | "nekad" | "fel"} */ (""));
  const [popupMal, setPopupMal] = useState(/** @type {{ plats: HTMLElement, popup: any, feature: any } | null} */ (null));
  const popupNu = useRef(popupMal);
  popupNu.current = popupMal;
  /*
   * ══ ⛔ HELSKÄRM (0.234.0) ═══════════════════════════════════════════════════════════════════════════════════════════════════════
   * CP 2026-11-16: "Jag kan inte få en fullscreen för kartor, det är ett måste." Samma beteende och samma ord som PDF-vyns Helskärm (0.196.0),
   * genom `useHelskarm`: webbläsarens helskärm där den finns, annars ett fast lager över hela skärmen (iPhone ger inte ett element helskärm),
   * med Stäng, säkra zoner och Escape. Kartan ritas om till den nya storleken när den går in i och ut ur läget (`resize`).
   *
   * ⛔ BARA ETT AKTIVT TRYCK STÄNGER HELSKÄRMEN (0.263.0, cllp/lifehub.app#967). CP 2026-11-25: "det ska vara lite svårare att stänga helskärmsläge, man
   * får aktivt trycka för att stänga helskärm. Annars så stängs den nästan hela tiden när man sveper runt." Mätt i WebKits källa: på iPhone och iPad stänger
   * ett svep nedåt webbläsarens helskärm, och sidan kan inte stänga av det (`useHelskarm`, `undvikSvep`). Kartan väljer därför lagret där, och lagret stängs
   * bara av Stäng uppe till vänster och av Escape på ett tangentbord. Ett tryck på kartan väljer en punkt, det stänger ingenting. Lagret täcker hela
   * skärmen: kartan ritas också under statusraden, och knapparna står innanför de säkra zonerna. CP om helskärmen: "Där blir verkligen helskärm för hela
   * kartan. Det gillar jag skarpt."
   */
  const { lage: helskarm, oppna: oppnaHelskarm, avsluta: stangHelskarm } = useHelskarm(ram, { undvikSvep: true });
  const helskarmNu = useRef(helskarm);
  helskarmNu.current = helskarm;
  /*
   * ══ ⛔ KARTGRUND, ORTNAMN OCH LAGER (0.258.0, cllp/lifehub.app#950 skiva 2 och 3) ══════════════════════════════════════════════════════
   * Valen görs i panelerna Inställningar och Lager, som bara finns i den öppnade kartan (`KartaPaneler`). Kartan börjar alltid i Karta med
   * ortnamnen på och alla lager på: förhandsvisningen i Biblioteket ser ut som förut.
   */
  const bred = useBredKarta();
  const paneler = useKartPaneler(bred);
  const stangTelefonpanel = useRef(paneler.setTelefonLage);
  stangTelefonpanel.current = paneler.setTelefonLage;
  // (0.263.0) Infofältet i helskärm: den valda punkten och om fältet är uppdraget.
  const [vald, setVald] = useState(/** @type {any | null} */ (null));
  const [infoUppe, setInfoUppe] = useState(false);
  // (0.263.0) Min position som knappen visar: av, följer (kartan följer positionen) eller bakgrund (positionen ritas, kartan har flyttats bort från den).
  const [platsLage, setPlatsLage] = useState(/** @type {"av" | "foljer" | "bakgrund"} */ ("av"));
  const [grund, setGrund] = useState("karta");
  const [ortnamn, setOrtnamn] = useState(true);
  const [avslagna, setAvslagna] = useState(/** @type {string[]} */ ([]));
  const [minPosition, setMinPosition] = useState(false);
  const [terrangFel, setTerrangFel] = useState(/** @type {"" | "fel"} */ (""));
  const lager = useMemo(() => kartansLager(samling), [samling]);
  const grundfilter = useRef(/** @type {Record<string, unknown>} */ ({}));
  const platsKontroll = useRef(/** @type {any} */ (null));
  const terrangReserv = useRef(false);
  const val = useRef({ grund, ortnamn, avslagna });
  val.current = { grund, ortnamn, avslagna };
  /*
   * ⛔ ETT FINGER I HELSKÄRM (0.258.0, cllp/lifehub.app#950 skiva 1). Tvåfingersläget (`cooperativeGestures`) finns för att sidan ska gå att
   * rulla förbi en karta i en lista. I helskärm finns ingen sida att rulla, och där var det bara i vägen: ett finger flyttade ingenting, som
   * om kartan var trasig. Det slås av i helskärm och på igen när läget lämnas, i samma steg som kartan ritas om till sin nya storlek.
   */
  useEffect(() => {
    const k = karta.current;
    k?.resize?.();
    if (helskarm) k?.cooperativeGestures?.disable?.();
    else k?.cooperativeGestures?.enable?.();
    // (0.263.0) I helskärm står punktens text i infofältet, så en popup från rutan tas bort. Ut ur helskärm börjar fältet om från översikten.
    // Popupens egen "close" tömmer `popupMal`.
    if (helskarm) popupNu.current?.popup?.remove?.();
    else {
      setVald(null);
      setInfoUppe(false);
    }
  }, [helskarm]);

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
    const stil = byggStil(farger, senast.current.samling);
    grundfilter.current = Object.fromEntries(stil.layers.filter((l) => OBJEKT_FILTERLAGER.includes(l.id)).map((l) => [l.id, /** @type {any} */ (l).filter]));
    try {
      kartaNu = new Map({
        container: el,
        style: /** @type {any} */ (stil),
        attributionControl: { compact: false },
        cooperativeGestures: true,
        locale: {
          "Popup.Close": senast.current.texter.stang,
          "GeolocateControl.FindMyLocation": senast.current.texter.minPosition,
          "GeolocateControl.LocationNotAvailable": senast.current.texter.positionSaknas,
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
    // Popupens stil läggs när kartan finns, inte först vid ett tryck, så att den står i dokumentet före första popupen.
    installeraPopupStil();
    /*
     * ══ ⛔ ZOOM OCH MIN POSITION ÄR RAMVERKETS KNAPPAR (0.263.0, cllp/lifehub.app#967) ═══════════════════════════════════════════════
     * CP 2026-11-25 om MapLibres vita fyrkanter och positionens röda snedstreck: "Ser bara lite 90-tal buggigt ut." `NavigationControl` läggs inte till
     * längre: zoomen är två knappar i kartans knappkolumn (`zoomIn`, `zoomOut`). Min position ritas också av vyn, men logiken är kvar i `GeolocateControl`
     * (följ-läget, punkten och träffsäkerhetens cirkel), vars egen knapp döljs (`KARTVY_CSS`) och styrs med `trigger()`.
     *
     * ══ ⛔ MIN POSITION (0.234.0) ═══════════════════════════════════════════════════════════════════════════════════════════════════
     * CP 2026-11-16: "Kan man få sin position i en karta också?" MapLibres egen kontroll, med följ-läge och träffsäkerhetens cirkel. Positionen
     * ritas bara i kartan i den här webbläsaren: ingenting sparas och ingenting skickas. Knappen står under zoomen, och följer med i helskärm.
     * Ett nej eller en position som inte kommer blir en rad i kartan (`data-karta-plats-fel`) och en dämpad knapp med ett namn som säger varför,
     * aldrig en knapp som bara slutar svara.
     */
    const plats = new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showAccuracyCircle: true, showUserLocation: true });
    plats.on("error", (/** @type {{ code?: number }} */ e) => {
      if (kvar) setPlatsFel(e?.code === 1 ? "nekad" : "fel");
    });
    plats.on("geolocate", () => {
      if (kvar) setPlatsFel("");
    });
    // (0.258.0) Min position i panelen Inställningar följer kontrollens eget läge, så att reglaget och knappen i kartan aldrig säger olika saker.
    plats.on("trackuserlocationstart", () => {
      if (!kvar) return;
      setMinPosition(true);
      setPlatsLage("foljer");
    });
    plats.on("trackuserlocationend", () => {
      if (!kvar) return;
      setMinPosition(false);
      setPlatsLage("av");
    });
    // Kartan flyttades bort från positionen: punkten ritas fortfarande, men kartan följer inte. Ett tryck på knappen följer igen.
    plats.on("userlocationlostfocus", () => {
      if (kvar) setPlatsLage("bakgrund");
    });
    platsKontroll.current = plats;
    kartaNu.addControl(plats, "top-right");
    kartaNu.on("click", (e) => {
      const traff = kartaNu.queryRenderedFeatures(e.point, { layers: OBJEKT_LAGER });
      const feature = OBJEKT_LAGER.map((id) => traff.find((f) => f.layer?.id === id)).find(Boolean);
      // ⛔ I HELSKÄRM VISAS PUNKTEN I INFOFÄLTET (0.263.0, cllp/lifehub.app#967), inte i en popup ovanpå kartan. Ett tryck bredvid en punkt går tillbaka
      // till översikten. Inget tryck på kartan stänger helskärmen.
      if (helskarmNu.current) {
        if (!feature) {
          setVald(null);
          return;
        }
        if (!popupElement(feature)) return;
        stangTelefonpanel.current(null);
        setVald(feature);
        setInfoUppe(true);
        return;
      }
      if (!feature) return;
      const innehall = popupElement(feature);
      if (!innehall) return;
      // ⛔ POPUPEN I APPENS TOKEN (0.234.0, `KARTPOPUP_CSS`), med en egen Stäng: en riktig knapp med namn och en träffyta på 44 px. MapLibres kryss var 20 px och nästan osynligt
      // i mörkt läge. Knappen ritas av vyn genom en portal till `plats`, så att ikonen är ramverkets (`IKON_FOR.stang`) och inte en handritad.
      const popup = new Popup({ closeButton: false, maxWidth: "16rem", className: KARTPOPUP_KLASS });
      const plats = document.createElement("div");
      plats.setAttribute("data-karta-popup-tillagg", "");
      innehall.append(plats);
      popup.on?.("close", () => {
        if (kvar) setPopupMal((m) => (m?.plats === plats ? null : m));
      });
      setPopupMal({ plats, popup, feature });
      popup.setLngLat(e.lngLat).setDOMContent(innehall).addTo(kartaNu);
    });
    kartaNu.on("load", () => {
      if (!kvar) return;
      laggData(kartaNu, senast.current.samling);
      passa(kartaNu, senast.current.samling);
      tillampaVal(kartaNu, val.current, grundfilter.current, terrangReserv.current);
    });
    kartaNu.on("error", (e) => {
      // ⛔ TERRÄNGENS KÄLLA FALLER: byt till reserven en gång, och säg till om också den faller (regel 5). Kartan i sig står kvar.
      // `sourceId` sätts av stilen på varje händelse från en källa (MapLibre 6.17.0, `tileManager.setEventedParent` med `sourceId: id`). En bricka
      // som svarar 404 ger inget fel alls (havet har ingen höjd), så det som når hit är en källa som inte svarar eller en beskrivning som inte går att läsa.
      if (kvar && /** @type {any} */ (e)?.sourceId === "terrang") {
        if (!terrangReserv.current) {
          terrangReserv.current = true;
          bytTerrangKalla(kartaNu);
        } else setTerrangFel("fel");
        return;
      }
      // En bricka som faller är inte kartan som faller: underlaget fylls i när nästa kommer. Bara att ytan inte går att rita alls (WebGL) byter ut vyn.
      const meddelande = String(e?.error?.message || "");
      if (kvar && /webgl|initialize/i.test(meddelande)) setFel("lasfel");
    });
    // ⛔ YTAN MÄTS, OCH EN YTA UTAN MÅTT ÄR ETT FEL SOM SYNS (cllp/lifehub.app#765, CP 2026-11-14: kartan var en svart ruta, utan ett enda fel i konsolen).
    // Rutan har höjd, men ytan MapLibre ritar i hade 0 px. MapLibre ritar då ingenting och säger ingenting. Är rutan hög och ytan platt är det ett
    // layoutfel och inte ett nätfel, så det får sin egen rad (`ytfel`) och inte "kontrollera nätet".
    const matYtan = () => {
      const yttre = ram.current;
      if (!kvar || !yttre || yttre.clientHeight === 0 || yttre.clientWidth === 0) return;
      if (el.clientHeight === 0 || el.clientWidth === 0) setFel((f) => f || "ytfel");
    };
    const observator = new ResizeObserver(() => {
      kartaNu.resize();
      matYtan();
    });
    observator.observe(el);
    matYtan();
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
    const kartaNu = karta.current;
    if (!kartaNu?.isStyleLoaded?.()) return;
    tillampaVal(kartaNu, { grund, ortnamn, avslagna }, grundfilter.current, terrangReserv.current);
  }, [grund, ortnamn, avslagna]);

  useEffect(() => {
    const rot = document.documentElement;
    const medier = window.matchMedia?.("(prefers-color-scheme: dark)");
    const uppdatera = () => {
      const kartaNu = karta.current;
      if (!kartaNu) return;
      const { farger, saknas } = lasKartFarger();
      if (saknas.length) return;
      laggData(kartaNu, senast.current.samling);
      const skugga = kartaNu.getLayer?.(TERRANG_SKUGGA) ? skuggPensel(farger) : [];
      for (const [lager, prop, varde] of [...basPensel(farger), ...objektPensel(farger), ...skugga]) {
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
  // ⛔ DEN INRE YTAN ÄR `h-full w-full`, ALDRIG `absolute inset-0` (0.229.1, cllp/lifehub.app#765, CP 2026-11-14: "helt mörk"). MapLibre sätter klassen `maplibregl-map` på ytan,
  // och `maplibre-gl.css` ger den `position: relative`. Den regeln ligger utanför alla lager och vinner därför över Tailwinds `absolute` (som ligger i `@layer utilities`),
  // var den än står i filen. `inset-0` utan `absolute` ger ingen höjd: ytan blev 0 px i en ruta på 384, och MapLibre ritade ingenting. Höjden ärvs nu av rutans
  // egen höjd, som MapLibres CSS inte rör. `check-skalyta` bäddar in `maplibre-gl.css` som appen gör och mäter ytan mot rutan.
  const HelskarmIkon = IKON_FOR.helskarm;
  const StangIkon = IKON_FOR.stang;
  const ZoomaInIkon = IKON_FOR.zoomaIn;
  const ZoomaUtIkon = IKON_FOR.zoomaUt;
  const PositionIkon = IKON_FOR.minPosition;
  // ⛔ KNAPPARNA STÅR INNANFÖR DE SÄKRA ZONERNA I HELSKÄRM. Kartan själv fyller hela skärmen, också under statusraden (0.263.0).
  const kant = helskarm ? { top: "calc(var(--safe-top, 0px) + 0.75rem)" } : undefined;
  const platsFinns = typeof navigator !== "undefined" && "geolocation" in navigator;
  const platsNamn = !platsFinns ? texter.positionSaknas : platsFel === "nekad" ? texter.platsNekad : platsFel === "fel" ? texter.platsFel : texter.minPosition;
  const huvud = samling.karta;
  return (
    <div
      ref={ram}
      className={cx(
        "w-full min-w-0 overflow-hidden bg-sunken",
        // ⛔ RESERVLAGRET (`fonster`) täcker hela skärmen UTAN egen marginal (0.263.0): kartan ritas ända ut, och knapparna räknar de säkra zonerna själva.
        // Till 0.262.0 hade lagret de säkra zonerna som utfyllnad, och då stod en mörk rand över och under kartan. I webbläsarens helskärm sätter webbläsaren storleken.
        // ⛔ `fixed` ELLER `relative`, ALDRIG BÅDA (0.263.0, mätt i montaget för #967). Till 0.262.0 bar lagret båda klasserna, och i Tailwinds ordning kommer
        // `relative` efter `fixed`: lagret blev aldrig fast, utan låg kvar i sidans kolumn med sidan synlig runt sig. Ingen såg det, eftersom Chromium (och vakten)
        // fick webbläsarens helskärm och CP:s iPhone också. Nu när iPhone får lagret mäter `check-skalyta` det (avsnitt 52e).
        helskarm === "fonster" ? "fixed inset-0 z-[1000] h-dvh" : helskarm ? "relative" : "relative h-72 rounded-lg md:h-96",
      )}
      role="region"
      aria-label={texter.rubrik}
      data-karta=""
      data-karta-helskarm={helskarm || undefined}
      data-karta-bred={bred ? "ja" : "nej"}
      data-karta-fel={fel || undefined}
    >
      <div ref={ruta} className="h-full w-full" data-karta-yta="" />
      {/* ⛔ KNAPPEN STÅR UPPE TILL VÄNSTER: zoomen och Min position står uppe till höger. I helskärm är den Stäng, den enda vägen ut med ett tryck. */}
      <button
        type="button"
        data-karta-helskarm-knapp={helskarm ? "stang" : "oppna"}
        aria-label={helskarm ? texter.avslutaHelskarm : texter.helskarm}
        title={helskarm ? texter.avslutaHelskarm : texter.helskarm}
        onClick={() => (helskarm ? stangHelskarm() : oppnaHelskarm())}
        className={cx(KARTKNAPP, "absolute z-40", helskarm ? "" : "top-2 left-2")}
        style={helskarm ? { ...kant, left: "calc(var(--safe-left, 0px) + 0.75rem)" } : undefined}
      >
        {helskarm ? <StangIkon size={20} aria-hidden="true" /> : <HelskarmIkon size={20} aria-hidden="true" />}
      </button>
      {/* (0.263.0) Knappkolumnen uppe till höger: zoom, Min position och, i helskärm, Lager och Inställningar. */}
      <div
        data-karta-kontroller=""
        className={cx("pointer-events-none absolute z-10 flex flex-col items-end gap-2", helskarm ? "" : "top-2 right-2")}
        style={helskarm ? { ...kant, right: "calc(var(--safe-right, 0px) + 0.75rem)" } : undefined}
      >
        <div className="pointer-events-auto flex flex-col overflow-hidden rounded-full border border-line bg-raised shadow-md" data-karta-zoom="">
          <button type="button" aria-label={texter.zoomaIn} title={texter.zoomaIn} data-karta-zoom-in="" onClick={() => karta.current?.zoomIn?.()} className={ZOOMKNAPP}>
            <ZoomaInIkon size={20} aria-hidden="true" />
          </button>
          <span aria-hidden="true" className="mx-2 h-px bg-line" />
          <button type="button" aria-label={texter.zoomaUt} title={texter.zoomaUt} data-karta-zoom-ut="" onClick={() => karta.current?.zoomOut?.()} className={ZOOMKNAPP}>
            <ZoomaUtIkon size={20} aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          data-karta-plats-knapp={!platsFinns ? "saknas" : platsFel ? "fel" : platsLage}
          aria-label={platsNamn}
          title={platsNamn}
          aria-pressed={platsLage !== "av"}
          aria-disabled={!platsFinns || undefined}
          onClick={() => {
            if (platsFinns) platsKontroll.current?.trigger?.();
          }}
          className={cx(KARTKNAPP, platsLage === "foljer" && "border-accent text-accent", platsLage === "bakgrund" && "text-accent", (!platsFinns || platsFel) && "text-ink-muted opacity-60")}
        >
          <PositionIkon size={20} aria-hidden="true" />
        </button>
        {helskarm ? <KartaPanelKnappar paneler={paneler} texter={texter} /> : null}
      </div>
      {popupMal
        ? createPortal(
            <>
            <button
              type="button"
              aria-label={texter.stang}
              data-karta-popup-stang=""
              onClick={() => popupMal.popup.remove()}
              className="absolute top-0 right-0 flex size-11 cursor-pointer items-center justify-center rounded-base text-ink-secondary hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
            >
              <StangIkon size={18} aria-hidden="true" />
            </button>
            <PopupLankar feature={popupMal.feature} texter={texter} />
            </>,
            popupMal.plats,
          )
        : null}
      {helskarm ? (
        <>
          <KartaInfo
            titel={huvud?.titel || texter.rubrik}
            beskrivning={huvud?.beskrivning ?? ""}
            lager={lager}
            vald={vald}
            uppe={infoUppe}
            onUppe={setInfoUppe}
            onOversikt={() => setVald(null)}
            bred={bred}
            texter={texter}
          />
          <KartaPaneler
            paneler={paneler}
            lager={lager}
            avslagna={avslagna}
            onLager={(typ, pa) => setAvslagna((nu) => (pa ? nu.filter((t) => t !== typ) : nu.includes(typ) ? nu : [...nu, typ]))}
            grund={grund}
            onGrund={(g) => {
              setTerrangFel("");
              setGrund(g);
            }}
            ortnamn={ortnamn}
            onOrtnamn={setOrtnamn}
            minPosition={minPosition}
            onMinPosition={(pa) => {
              if (pa !== minPosition) platsKontroll.current?.trigger?.();
            }}
            terrangFel={terrangFel}
            bred={bred}
            texter={texter}
          />
        </>
      ) : null}
      {platsFel ? (
        <p
          role="status"
          data-karta-plats-fel={platsFel}
          className={cx("absolute z-10 m-0 rounded-base border border-line bg-raised px-3 py-2 text-etikett text-ink shadow-md", helskarm ? "" : "inset-x-2 bottom-2")}
          style={
            helskarm
              ? {
                  // Bredvid infofältet: på telefon ovanför det (fältet går i full bredd längst ned), på dator till höger om det (fältet står nere till vänster).
                  left: bred ? "calc(var(--safe-left, 0px) + 23.5rem)" : "calc(var(--safe-left, 0px) + 0.75rem)",
                  right: "calc(var(--safe-right, 0px) + 0.75rem)",
                  bottom: bred ? "calc(var(--safe-bottom, 0px) + 0.75rem)" : "calc(var(--safe-bottom, 0px) + 4.5rem)",
                }
              : undefined
          }
        >
          {platsFel === "nekad" ? texter.platsNekad : texter.platsFel}
        </p>
      ) : null}
      {fel === "lasfel" || fel === "ytfel" ? <p role="alert" className="absolute inset-x-0 bottom-0 m-0 bg-karta-papper px-3 py-2 text-etikett text-karta-text">{texter[fel]}</p> : null}
    </div>
  );
}

/** Zoomens två knappar i sin gemensamma pill (0.263.0): samma storlek och tryckyta som kartans andra knappar (`KARTKNAPP`), utan egen ram. */
const ZOOMKNAPP = "flex size-11 cursor-pointer items-center justify-center text-ink hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";

/** Popupens och kartvyns stil i dokumentet, en gång (`KARTPOPUP_CSS`, `KARTVY_CSS`). */
function installeraPopupStil() {
  if (typeof document === "undefined" || document.getElementById(KARTPOPUP_STIL_ID)) return;
  const stil = document.createElement("style");
  stil.id = KARTPOPUP_STIL_ID;
  stil.textContent = `${KARTPOPUP_CSS}\n${KARTVY_CSS}`;
  document.head.appendChild(stil);
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

/**
 * Kartgrunden, ortnamnen och lagren på kartan (0.258.0). Terrängens skuggning och källa läggs till första gången Terräng väljs, aldrig förr: en källa
 * i stilen hade hämtat sin beskrivning vid varje karta (Fables punkt om vem som får adressen).
 *
 * @param {any} kartaNu
 * @param {{ grund: string, ortnamn: boolean, avslagna: string[] }} val
 * @param {Record<string, unknown>} grundfilter
 * @param {boolean} reserv
 */
function tillampaVal(kartaNu, val, grundfilter, reserv) {
  if (val.grund === "terrang" && !kartaNu.getLayer?.(TERRANG_SKUGGA)) laggTillTerrang(kartaNu, reserv);
  if (kartaNu.getLayer?.(TERRANG_SKUGGA)) kartaNu.setLayoutProperty(TERRANG_SKUGGA, "visibility", val.grund === "terrang" ? "visible" : "none");
  for (const [id, synlig] of grundensSynlighet(val.grund, val.ortnamn)) {
    if (!kartaNu.getLayer || kartaNu.getLayer(id)) kartaNu.setLayoutProperty(id, "visibility", synlig);
  }
  for (const id of OBJEKT_FILTERLAGER) if (!kartaNu.getLayer || kartaNu.getLayer(id)) kartaNu.setFilter(id, lagerFilter(grundfilter[id], val.avslagna));
}

/** @param {any} kartaNu @param {boolean} reserv */
function laggTillTerrang(kartaNu, reserv) {
  const { farger, saknas } = lasKartFarger();
  if (saknas.length) return;
  if (!kartaNu.getSource("terrang")) kartaNu.addSource("terrang", terrangKalla(reserv));
  kartaNu.addLayer(terrangSkugga(farger), "vatten");
}

/** Mapterhorn föll: samma lager, med AWS Terrain Tiles som källa. @param {any} kartaNu */
function bytTerrangKalla(kartaNu) {
  const synlig = kartaNu.getLayoutProperty?.(TERRANG_SKUGGA, "visibility");
  if (kartaNu.getLayer?.(TERRANG_SKUGGA)) kartaNu.removeLayer(TERRANG_SKUGGA);
  if (kartaNu.getSource("terrang")) kartaNu.removeSource("terrang");
  laggTillTerrang(kartaNu, true);
  if (synlig === "none") kartaNu.setLayoutProperty(TERRANG_SKUGGA, "visibility", "none");
}
