import { useEffect, useState } from "react";

/**
 * Höjden ut till bottenraden (eller skärmens underkant), mätt och räknad i CSS.
 *
 * ══ ⛔ VARFÖR DEN FINNS, OCH VARFÖR DEN INTE ÄR EN KLASS ════════════════
 *
 * En yta som ska rulla i sig själv i stället för att rulla sidan måste veta hur
 * hög den får vara. `flex-1 min-h-0` räcker när ytan bor i en kolumn med känd
 * höjd, vilket den gör i SessionStudio. I en app där skalet rullar dokumentet
 * finns ingen sådan förälder: ytan sitter mitt på en sida och vet ingenting om
 * var den hamnade.
 *
 * ⛔ DÄRFÖR MÄTS BÅDA KANTERNA, var ytan börjar och var den får sluta, och
 * läggs i två CSS-variabler. Höjden räknas sedan i klassen, så att `min-h-60`
 * fortfarande kan vara ett golv som en inline-höjd hade kört över.
 *
 * ⛔ DE MÄTS OM NÄR NÅGON AV KANTERNA KAN HA FLYTTAT, inte bara vid mount. Varför
 * står vid `useFullHeight`, och händelsen som gjorde det nödvändigt (0.32.1) står
 * vid `FULL_HEIGHT_CLASSES`.
 *
 * ══ ⛔ EN DELAD HOOK OCH INTE TVÅ KOPIOR ═══════════════════════════════
 *
 * Kalendern fick det här först. När listan behövde samma sak (CP 2026-09-22:
 * "filterraden är fast i kalendervyn men den scrollar i listvyn, låt listvyn
 * fungera precis som kalendervyn") fanns två vägar: kopiera tjugo rader, eller
 * flytta dem hit. En kopia hade glidit isär första gången någon rättade den ena,
 * och den rättelsen hade inte synts på den andra sidan förrän någon jämförde dem.
 */

/**
 * Klassraderna som räknar höjden ur de två uppmätta talen.
 *
 * ══ ⛔ 0.32.1: INGEN VIEWPORT-ENHET I HÖJDEN, OCH VARFÖR ════════════════
 *
 * CP 2026-09-30, två skärmbilder från telefonen: "Kalender och idag går inte
 * ända ner utan huggs av i botten." Innehållet slutade långt ovanför
 * bottenraden, ett kort i Idag klipptes rakt av och veckoraden i Kalender
 * klipptes horisontellt.
 *
 * Rotorsaken var två antaganden i samma uttryck, `calc(100svh - topp - rad -
 * säker yta - 1.5rem)`:
 *
 *   1. `svh` ÄR DEN MINSTA VYHÖJDEN, men bottenraden är `fixed bottom-0` och
 *      följer den VERKLIGA kanten. När Safaris verktygsfält fälls in växer den
 *      synliga ytan och raden flyttar ner, medan `100svh` står still: ytan
 *      slutade för tidigt. I hemskärmsläget kan `svh` dessutom skilja sig från
 *      den synliga höjden med de säkra zonerna. Mätt i diagnosen: 107 och 104 px
 *      mellan ytan och raden i stället för 23.
 *   2. TOPPEN MÄTTES BARA VID MOUNT OCH RESIZE. Försvann en rad ovanför ytan
 *      (en banner, ett filter) låg talet kvar för högt. Mätt: 209 px.
 *
 * ⛔ NU RÄKNAS INGENTING UR EN ENHET SOM BESKRIVER FÖNSTRET. Det som mäts är
 * precis det ytan ska nå: bottenradens övre kant om raden syns, annars fönstrets
 * underkant minus den säkra ytan. Ingen enhet kan ha fel åsikt om var raden
 * sitter när det är raden själv som mäts.
 *
 * ⛔ `--fullhojd-botten` ÄR REDAN BOTTENRADEN OCH DEN SÄKRA YTAN. Därför finns
 * ingen `md:`-variant längre: på en dator finns ingen synlig rad, och då är
 * botten fönstrets kant minus den säkra ytan, precis det `md:`-raden räknade förut.
 *
 * ⛔ 1,5 rem ÄR `OpsView`s EGEN BOTTENPADDING (0.31.2, CP 2026-09-29 22:33, "Den
 * scrollar liksom upp"). Sidan är ytan plus `pb-6` plus `main`s `pb` (radens
 * höjd och den säkra ytan). Drogs `pb-6` inte bort blev sidan högre än fönstret
 * och dokumentet rullade OVANPÅ ytans egen rullning.
 *
 * ⛔ ETT GOLV PÅ `min-h-60`, för den dag ytan hamnar långt ner på en kort sida.
 * Utan det kan uttrycket bli noll eller negativt, och då försvinner innehållet
 * helt i stället för att bli obekvämt litet.
 */
export const FULL_HEIGHT_CLASSES = [
  "overflow-y-auto overscroll-contain",
  "h-[calc(var(--fullhojd-botten)_-_var(--fullhojd-topp)_-_1.5rem)]",
  "min-h-60",
].join(" ");

/** Reservvärde när inget går att mäta (SSR, jsdom före mount): en telefonhöjd, så att uttrycket aldrig blir tomt. */
const RESERV_BOTTEN = 800;

/**
 * Bottenraden, om den finns och SYNS. `OpsBottomNav` är `md:hidden`, så på en
 * dator finns noden men har ingen yta: då räknas den som frånvarande.
 * @returns {DOMRect | null}
 */
function synligBottenrad() {
  const nav = document.querySelector("nav[data-ops-bottenrad]");
  if (!nav) return null;
  const r = nav.getBoundingClientRect();
  return r.height > 0 && getComputedStyle(nav).display !== "none" ? r : null;
}

/**
 * Den säkra ytan i botten i pixlar. `--safe-bottom` är `env(...)`, och ett
 * `env()` i en egen egenskap går inte att läsa som ett tal ur
 * `getComputedStyle`: därför mäts den som höjden på en osynlig låda.
 * @returns {number}
 */
function sakerBotten() {
  const d = document.createElement("div");
  d.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;width:0;height:var(--safe-bottom,0px)";
  document.body.appendChild(d);
  const h = d.getBoundingClientRect().height || 0;
  d.remove();
  return h;
}

/**
 * Mäter var ytan börjar och var den får sluta, och ger stilen som bär talen.
 *
 * ⛔ TOPPEN ÄR DOKUMENTETS OFFSET OCH INTE RUTANS. `getBoundingClientRect().top`
 * ensamt är avståndet till fönstrets överkant PRECIS NU, och en höjd räknad ur
 * det växer med lika mycket som sidan rullas: då blir sidan längre, går att
 * rulla längre, och ytan växer igen. Med `scrollY` adderat är talet detsamma
 * oavsett när mätningen sker. Botten är bottenradens kant, som är `fixed` och
 * alltså också oberoende av rullningen.
 *
 * ⛔ OMMÄTS VID ALLT SOM FLYTTAR NÅGON AV KANTERNA:
 *   - `resize` och `orientationchange` (fönstret, en vriden telefon, Safaris
 *     verktygsfält som fälls in eller ut),
 *   - `visualViewport` `resize` och `scroll` (verktygsfältet och zoomen på iOS,
 *     där fönstrets egen `resize` inte alltid kommer),
 *   - en `ResizeObserver` på föräldern, `offsetParent`, `main`, dokumentets
 *     kropp och syskonen ovanför. Det är den som fångar en banner eller ett
 *     filter som försvinner OVANFÖR ytan (0.32.1: 209 px för högt utan den).
 *
 * ⛔ EN MÄTNING PER BILDRUTA (`requestAnimationFrame`). Ytans egen nya höjd
 * ändrar kroppens höjd, och observatören svarar då med en mätning till. Den ger
 * samma tal och därmed ingen ny rendering, men utan ramen kunde ett tal som
 * pendlar en pixel bli en slinga inom samma bildruta.
 *
 * @param {{ current: HTMLElement | null }} ref Elementet som ska rulla.
 * @returns {import("react").CSSProperties} Sätts som `style` på samma element.
 */
export function useFullHeight(ref) {
  const [mat, setMat] = useState(() => ({
    topp: 0,
    botten: typeof window !== "undefined" && window.innerHeight > 0 ? window.innerHeight : RESERV_BOTTEN,
  }));

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === "undefined") return undefined;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const topp = Math.max(0, Math.round(rect.top + (window.scrollY || 0)));
      const rad = synligBottenrad();
      const fonster = window.innerHeight || window.visualViewport?.height || RESERV_BOTTEN;
      const botten = Math.max(0, Math.round(rad ? rad.top : fonster - sakerBotten()));
      setMat((f) => (f.topp === topp && f.botten === botten ? f : { topp, botten }));
    };

    let ram = 0;
    const planera = () => {
      if (ram) return;
      ram = typeof requestAnimationFrame === "function" ? requestAnimationFrame(() => { ram = 0; measure(); }) : 0;
      if (!ram) measure();
    };

    measure();
    window.addEventListener("resize", planera);
    window.addEventListener("orientationchange", planera);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", planera);
    vv?.addEventListener("scroll", planera);

    /** @type {ResizeObserver | null} */
    let obs = null;
    if (typeof ResizeObserver === "function") {
      obs = new ResizeObserver(planera);
      const bevakade = new Set(/** @type {(Element | null)[]} */ ([el.parentElement, el.offsetParent, el.closest("main"), document.body]));
      for (let s = el.previousElementSibling; s; s = s.previousElementSibling) bevakade.add(s);
      for (const b of bevakade) if (b) obs.observe(b);
    }

    return () => {
      window.removeEventListener("resize", planera);
      window.removeEventListener("orientationchange", planera);
      vv?.removeEventListener("resize", planera);
      vv?.removeEventListener("scroll", planera);
      obs?.disconnect();
      if (ram && typeof cancelAnimationFrame === "function") cancelAnimationFrame(ram);
    };
  }, [ref]);

  /*
   * ⛔ Kastad till `CSSProperties`, eftersom TypeScript inte känner till egna
   * CSS-variabler i ett stilobjekt. Det är typsystemets lucka och inte en
   * osäkerhet: webbläsaren tar emot variablerna som vilken deklaration som helst.
   */
  return /** @type {import("react").CSSProperties} */ ({ "--fullhojd-topp": `${mat.topp}px`, "--fullhojd-botten": `${mat.botten}px` });
}
