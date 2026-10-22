import { useRef } from "react";

/**
 * Vågrätt svep på en yta: `onForra` (fingret åt höger) och `onNasta` (fingret åt vänster) (0.138.0).
 *
 * ⛔ HÄNDELSEN: CP 2026-10-22, "Ja, kör båda." på förslaget att datumväljaren bläddrar månad med ett svep och att Dagen i appen
 * byter dag på samma sätt. Gesten behövs på två ställen redan nu, och `OpsSvepRad` har sin egen vågräta gest på raderna. En kopia
 * per yta hade glidit isär i tröskel, i vad som räknas som vågrätt och i vad som händer med klicket efteråt (se `useLangtryck`).
 *
 * Kroken ger PROPS att sprida på ytan, den lägger inga lyssnare själv:
 *
 *   const svep = useSidsvep({ onForra: gaTillbaka, onNasta: gaFramat });
 *   <div {...svep}>...</div>
 *
 * Det den gör, i den ordning det händer:
 *   - Ett finger eller en penna (`pointerType` `touch` eller `pen`) sätts ned. En mus räknas inte: ett drag med musen är en
 *     textmarkering, och en dator har pilar. Ett andra finger avbryter gesten (nypa är inget svep).
 *   - När fingret lyfts mäts rörelsen. Den räknas som ett svep bara när den är tydligt vågrät: minst `minX` px i x (förval 48) OCH mer
 *     än dubbelt så mycket i x som i y. Därför utlöser vertikal rullning aldrig något, och en snedrörelse inte heller.
 *   - ⛔ ETT SVEP SOM BÖRJAR PÅ ETT ELEMENT MED EGEN VÅGRÄT GEST ÄR INTE ETT SVEP: `input`, `textarea`, `select`, `[contenteditable]`,
 *     `[role="slider"]`, `OpsSvepRad` (`[data-ops-svep]`), allt som bär `data-ingen-sidsvep`, och ett element som själv rullar i sidled
 *     (en tabell, en chipsrad). Det som äger gesten får behålla den.
 *   - ⛔ ETT SVEP BLIR ALDRIG ETT KLICK PÅ RADEN. Klicket som webbläsaren kan skicka när fingret lyfts sväljs (`onClickCapture`) i
 *     en kort stund efter ett svep, och aldrig längre än till nästa tryck. Ett klick utan föregående svep går alltid fram.
 *   - `touchAction: "pan-y pinch-zoom"` följer med i `style`: webbläsaren får rulla lodrätt och zooma, men tar inte det vågräta
 *     draget åt sig. Utan den skickar en touch-enhet `pointercancel` så fort en rörelse liknar en panorering, och svepet försvinner.
 *     Har ytan ett eget `style` ska det slås ihop med detta, inte ersätta det.
 *
 * ⛔ Kroken känner ingen domän. Vad "nästa" betyder (en månad, en dag) och om riktningen ska vändas för ett språk som läses från
 * höger är anropets sak. Utan en mottagare för en riktning händer ingenting åt det hållet.
 *
 * @param {object} val
 * @param {(() => void) | null} [val.onForra] Fingret rör sig åt höger: det som kommer före.
 * @param {(() => void) | null} [val.onNasta] Fingret rör sig åt vänster: det som kommer efter.
 * @param {number} [val.minX] Minsta vågräta rörelse i px. Förval 48.
 * @param {boolean} [val.inaktiv] Sant: inga svep räknas och ytan får ingen `touchAction`.
 * @returns {{ onPointerDown: (e: any) => void, onPointerUp: (e: any) => void, onPointerCancel: () => void, onClickCapture: (e: any) => void, style?: import("react").CSSProperties }}
 */
export function useSidsvep({ onForra, onNasta, minX = SIDSVEP_MIN_X, inaktiv = false }) {
  /** Fingret som följs: var det började, och vilken pekare det var. `null` när ingen gest pågår. */
  const start = useRef(/** @type {null | { x: number, y: number, id: number | undefined }} */ (null));
  /** När det senaste svepet räknades (`Date.now()`), så att klicket som följer kan sväljas. `null` tills ett svep skett. */
  const svepad = useRef(/** @type {number | null} */ (null));
  // ⛔ Senaste anropen läses ur en ref: en yta som byter `onNasta` vid varje ritning (en ny pil-funktion) ska inte kunna missa
  // ett svep som började före ritningen.
  const senaste = useRef({ onForra, onNasta, minX });
  senaste.current = { onForra, onNasta, minX };

  if (inaktiv) {
    return { onPointerDown: ignorera, onPointerUp: ignorera, onPointerCancel: ignorera, onClickCapture: ignorera };
  }

  return {
    onPointerDown: (e) => {
      // En ny gest nollställer spärren från den förra: nästa tryck är alltid ett riktigt tryck.
      svepad.current = null;
      // jsdom saknar PointerEvent, och där kan `pointerType` saknas. Ett tryck utan typ är ett finger.
      if (e.pointerType === "mouse") return;
      const pagar = start.current;
      if (pagar && pagar.id !== undefined && e.pointerId !== undefined && e.pointerId !== pagar.id) {
        // Ett andra finger: det är en nypa eller en panorering, inget svep. (Samma pekare igen är en gest som aldrig avslutades,
        // en penna släpps utan att fångas, och den börjar om.)
        start.current = null;
        return;
      }
      if (e.button !== undefined && e.button !== 0) return;
      if (!(e.target instanceof Element) || arUndantaget(e.target, e.currentTarget)) return;
      start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    },
    onPointerUp: (e) => {
      const s = start.current;
      if (!s || (s.id !== undefined && e.pointerId !== undefined && e.pointerId !== s.id)) return;
      start.current = null;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (!arSvep(dx, dy, senaste.current.minX)) return;
      svepad.current = Date.now();
      if (dx < 0) senaste.current.onNasta?.();
      else senaste.current.onForra?.();
    },
    onPointerCancel: () => {
      start.current = null;
    },
    onClickCapture: (e) => {
      const nar = svepad.current;
      if (nar === null) return;
      // Fönstret gäller bara klicket som hör till svepet. Ett klick långt efteråt är ett nytt tryck.
      if (Date.now() - nar > SIDSVEP_KLICK_MS) {
        svepad.current = null;
        return;
      }
      svepad.current = null;
      e.preventDefault();
      e.stopPropagation();
    },
    style: { touchAction: "pan-y pinch-zoom" },
  };
}

/** Minsta vågräta rörelse som räknas som ett svep, i px. */
export const SIDSVEP_MIN_X = 48;
/** Hur länge efter ett svep ett klick räknas som svepets och sväljs. Klicket kommer inom några tiotal millisekunder. */
export const SIDSVEP_KLICK_MS = 600;

/** @type {() => void} */
function ignorera() {}

/**
 * Är rörelsen tydligt vågrät? Minst `minX` px i x och mer än dubbelt så mycket som i y.
 * @param {number} dx @param {number} dy @param {number} minX @returns {boolean}
 */
export function arSvep(dx, dy, minX = SIDSVEP_MIN_X) {
  return Math.abs(dx) >= minX && Math.abs(dx) > 2 * Math.abs(dy);
}

/** Element som äger sin egen vågräta gest eller sin egen inmatning. */
const UNDANTAG = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="slider"], [data-ops-svep], [data-ingen-sidsvep]';

/**
 * Börjar svepet på något som äger gesten? Går uppåt från målet till ytan själv (ytan räknas inte) och stannar vid första träffen.
 * @param {Element} mal @param {Element | null} yta @returns {boolean}
 */
function arUndantaget(mal, yta) {
  for (let el = /** @type {Element | null} */ (mal); el && el !== yta; el = el.parentElement) {
    if (el.matches(UNDANTAG)) return true;
    // Ett element som rullar i sidled äger det vågräta draget. jsdom mäter ingen layout (0 mot 0), så där träffar det aldrig.
    if (el.scrollWidth > el.clientWidth + 1) {
      const ox = getComputedStyle(el).overflowX;
      if (ox === "auto" || ox === "scroll") return true;
    }
  }
  return false;
}
