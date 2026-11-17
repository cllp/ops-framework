import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  PDF_ZOOM_MAX,
  PDF_ZOOM_MIN,
  RITA_OM_MS,
  DUBBELTRYCK_MS,
  TRYCK_RORELSE,
  arDubbeltryck,
  dubbeltryckZoom,
  forankradRullning,
  hjulZoom,
  klampZoom,
  nypZoom,
  stegaZoom,
} from "../lib/pdfzoom.js";

/**
 * Zoomens tillstånd och gester i PDF-vyn (0.235.0). Reglerna och händelsen står i `lib/pdfzoom.js`. CP 2026-11-16: "Det går inte att zooma i pdf:er i biblioteket. Det vore bra om det funkade."
 *
 * Kroken äger den rullande rutan (`ruta`, en ref-funktion) och lyssnar där på:
 * - två fingrar: nypningen, med punkten mellan fingrarna kvar under fingrarna (`forankradRullning`). `preventDefault` på `touchmove` och Safaris `gesturestart` och `gesturechange`, så att telefonen inte zoomar hela appen samtidigt.
 * - ett finger: rullar som förut (rutan har `overflow: auto`). Ett tryck utan rörelse räknas, och två inom `DUBBELTRYCK_MS` är ett dubbeltryck som växlar mellan hel bredd och 2x kring trycket.
 *   Ett ensamt tryck går till `onTryck` först när ett andra inte kommit (helskärmens sidbyte), så att dubbeltrycket inte först byter sida.
 * - hjulet med Ctrl eller Cmd: zoomar kring pekaren. Utan dem rullar hjulet som förut.
 *
 * ⛔ RUTAN BÄR `touch-action: pan-x pan-y` (`PDF_TOUCH_ACTION`): webbläsaren rullar med ett finger men nyper inte och dubbeltrycker inte själv. Det är det som lämnar gesterna till kroken.
 *
 * `faktor` är zoomen nu (ramarnas storlek, under nypningen sträcks den ritade bilden), `ritad` är den som sidorna ritas i, och den följer `faktor` först när den stått still `RITA_OM_MS`.
 *
 * @param {{ onTryck?: (punkt: { x: number, y: number }) => void }} [val]
 */
export function usePdfZoom(val = {}) {
  const [el, setEl] = useState(/** @type {HTMLElement | null} */ (null));
  const [faktor, setFaktor] = useState(PDF_ZOOM_MIN);
  const [ritad, setRitad] = useState(PDF_ZOOM_MIN);
  const faktorRef = useRef(PDF_ZOOM_MIN);
  const lagdRef = useRef(PDF_ZOOM_MIN);
  const elRef = useRef(/** @type {HTMLElement | null} */ (null));
  elRef.current = el;
  const onTryckRef = useRef(val.onTryck);
  onTryckRef.current = val.onTryck;
  /** Senaste beröringen, i `Date.now()`. Helskärmens klick efter ett tryck med fingret är webbläsarens eget och ska inte byta sida en gång till. */
  const beroring = useRef(0);
  /** @type {import("react").MutableRefObject<{ x: number, y: number, sl: number, st: number, fore: number } | null>} */
  const ankare = useRef(null);

  const satt = useCallback((/** @type {number} */ f, /** @type {{ x: number, y: number } | undefined} */ punkt = undefined) => {
    const ny = klampZoom(f);
    if (Math.abs(ny - faktorRef.current) < 1e-9) return;
    const ruta = elRef.current;
    if (ruta) {
      const p = punkt ?? { x: ruta.clientWidth / 2, y: ruta.clientHeight / 2 };
      // Flera steg före nästa ritning räknas från läget som syns (rullningen och faktorn när ankaret sattes), och bara punkten följer med.
      if (ankare.current) ankare.current = { ...ankare.current, x: p.x, y: p.y };
      else ankare.current = { x: p.x, y: p.y, sl: ruta.scrollLeft, st: ruta.scrollTop, fore: lagdRef.current };
    }
    faktorRef.current = ny;
    setFaktor(ny);
  }, []);

  const nollstall = useCallback(() => {
    ankare.current = null;
    faktorRef.current = PDF_ZOOM_MIN;
    setFaktor(PDF_ZOOM_MIN);
    setRitad(PDF_ZOOM_MIN);
  }, []);

  // ── Punkten under fingrarna står kvar: rullningen sätts i samma ritning som ramarna fick sin nya storlek ─────────────
  useLayoutEffect(() => {
    const a = ankare.current;
    ankare.current = null;
    const ruta = elRef.current;
    if (a && ruta) {
      ruta.scrollLeft = forankradRullning(a.sl, a.x, a.fore, faktor);
      ruta.scrollTop = forankradRullning(a.st, a.y, a.fore, faktor);
    }
    lagdRef.current = faktor;
  }, [faktor]);

  // ── Omritningen väntar tills zoomen stått still ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (faktor === ritad) return undefined;
    const t = setTimeout(() => setRitad(faktor), RITA_OM_MS);
    return () => clearTimeout(t);
  }, [faktor, ritad]);

  // ── Gesterna ────────────────────────────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!el) return undefined;
    /** @type {{ avstand: number, f: number } | null} */
    let nyp = null;
    /** @type {{ x: number, y: number, rorde: boolean } | null} */
    let tryck = null;
    /** @type {{ t: number, x: number, y: number } | null} */
    let forra = null;
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let tryckKlocka;
    const iRutan = (/** @type {number} */ x, /** @type {number} */ y) => {
      const r = el.getBoundingClientRect();
      return { x: x - r.left, y: y - r.top };
    };
    const tva = (/** @type {TouchEvent} */ e) => {
      const a = e.touches[0];
      const b = e.touches[1];
      return { avstand: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), mitt: iRutan((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2) };
    };
    const start = (/** @type {TouchEvent} */ e) => {
      beroring.current = Date.now();
      if (e.touches.length >= 2) {
        nyp = { avstand: tva(e).avstand, f: faktorRef.current };
        tryck = null;
        forra = null;
        clearTimeout(tryckKlocka);
      } else if (e.touches.length === 1 && !nyp) {
        tryck = { x: e.touches[0].clientX, y: e.touches[0].clientY, rorde: false };
      }
    };
    const flytta = (/** @type {TouchEvent} */ e) => {
      if (nyp && e.touches.length >= 2) {
        // ⛔ Telefonens egen nypning stoppas här, annars zoomar hela appen samtidigt med sidan.
        if (e.cancelable) e.preventDefault();
        const { avstand, mitt } = tva(e);
        satt(nypZoom(nyp.f, nyp.avstand, avstand), mitt);
        return;
      }
      const t = e.touches[0];
      if (tryck && t && Math.hypot(t.clientX - tryck.x, t.clientY - tryck.y) > TRYCK_RORELSE) tryck.rorde = true;
    };
    const slut = (/** @type {TouchEvent} */ e) => {
      beroring.current = Date.now();
      if (nyp) {
        // Ett finger som lyfts sist efter en nypning är inget tryck.
        if (e.touches.length === 0) nyp = null;
        tryck = null;
        return;
      }
      const t = e.changedTouches[0];
      if (!tryck || tryck.rorde || e.touches.length > 0 || !t) {
        tryck = null;
        return;
      }
      tryck = null;
      const nu = { t: Date.now(), x: t.clientX, y: t.clientY };
      if (arDubbeltryck(forra, nu)) {
        clearTimeout(tryckKlocka);
        forra = null;
        // Webbläsarens klick efter dubbeltrycket ska inte nå sidan (helskärmens sidbyte).
        if (e.cancelable) e.preventDefault();
        satt(dubbeltryckZoom(faktorRef.current), iRutan(nu.x, nu.y));
        return;
      }
      forra = nu;
      clearTimeout(tryckKlocka);
      if (onTryckRef.current) {
        const punkt = iRutan(nu.x, nu.y);
        tryckKlocka = setTimeout(() => onTryckRef.current?.(punkt), DUBBELTRYCK_MS);
      }
    };
    const avbryt = () => {
      nyp = null;
      tryck = null;
    };
    // Safari på iPhone: nypningen kommer också som `gesture*`. Att stoppa dem stoppar sidans egen zoom. Faktorn räknas ur `touch*` ovan, så att nypningen inte räknas två gånger.
    const gest = (/** @type {Event} */ e) => {
      if (e.cancelable) e.preventDefault();
    };
    const hjul = (/** @type {WheelEvent} */ e) => {
      const f = hjulZoom(faktorRef.current, e);
      if (f === null) return;
      e.preventDefault();
      satt(f, iRutan(e.clientX, e.clientY));
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", flytta, { passive: false });
    el.addEventListener("touchend", slut, { passive: false });
    el.addEventListener("touchcancel", avbryt, { passive: true });
    el.addEventListener("gesturestart", gest, { passive: false });
    el.addEventListener("gesturechange", gest, { passive: false });
    el.addEventListener("wheel", hjul, { passive: false });
    return () => {
      clearTimeout(tryckKlocka);
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", flytta);
      el.removeEventListener("touchend", slut);
      el.removeEventListener("touchcancel", avbryt);
      el.removeEventListener("gesturestart", gest);
      el.removeEventListener("gesturechange", gest);
      el.removeEventListener("wheel", hjul);
    };
  }, [el, satt]);

  /** Raden (`HtmlZoomRad` i `Dokumentrad`): procenten är faktorn, 100 är hel bredd. */
  const rad = useMemo(
    () => ({
      skala: faktor,
      anpassa: Math.abs(faktor - PDF_ZOOM_MIN) < 1e-9,
      min: PDF_ZOOM_MIN,
      max: PDF_ZOOM_MAX,
      steg: (/** @type {1 | -1} */ riktning) => satt(stegaZoom(faktorRef.current, riktning)),
      anpassaTillBredd: () => satt(PDF_ZOOM_MIN),
    }),
    [faktor, satt],
  );

  return { ruta: setEl, el, faktor, ritad, satt, nollstall, rad, beroring };
}

/** Rutans `touch-action`: ett finger rullar i båda led, och webbläsaren nyper eller dubbeltrycker inte själv. Se `usePdfZoom`. */
export const PDF_TOUCH_ACTION = "pan-x pan-y";
