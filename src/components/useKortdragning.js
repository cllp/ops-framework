import { useCallback, useEffect, useRef, useState } from "react";
import { slappIndex } from "../lib/kortdragning.js";

/**
 * Dra kort mellan kolumner och upp eller ned i en kolumn, med finger eller mus (0.241.0, cllp/lifehub.app#894).
 *
 * ══ ⛔ HÄNDELSEN ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-11-18 22.58, om ärendetavlan: "Vi har inte dra och släpp heller, det måste gå horisontellt och vertikalt." Tavlan hade
 * webbläsarens egen dragning (`draggable`), bara med en mus och bara mellan kolumner. I telefonen var den avstängd med flit: när hela
 * kortet var dragbart lyfte Safari kortet vid ett långtryck, och långtrycksmenyn öppnades aldrig (CP 2026-11-04: "Långpress finns ingen
 * funktion?").
 *
 * ══ ⛔ ETT GREPP, INTE HELA KORTET ═════════════════════════════════════════════════════════════════════════════════════════
 *
 * Dragningen börjar bara i kortets grepp (`greppProps`). Greppet har `touch-action: none`, så fingret flyttar kortet direkt i stället
 * för att rulla sidan. Resten av kortet är som förut: ett tryck öppnar, ett långtryck öppnar menyn och en svepning rullar. Samma
 * pekhändelser gäller mus och finger, så dragningen beter sig likadant på datorn och i telefonen.
 *
 * ⛔ GREPPET ÄR INTE EN KNAPP och ligger inte i tabbordningen. Den som använder tangentbord eller skärmläsare flyttar med menyn (Flytta
 * till, Överst, Upp, Ned), som gör samma sak. Ett grepp som tar fokus men inte kan användas med tangenter hade varit en fälla.
 *
 * ══ HUR PLATSEN RÄKNAS UT ═════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Under dragningen läses elementet under pekaren (`elementFromPoint`). Närmaste `[data-drag-kolumn]` är målkolumnen, och dess
 * `[data-drag-kort]` mäts för att få platsen (`slappIndex`, kortet som dras räknas inte). En kolumn som `tillat` säger nej till blir
 * inget mål. Nära skärmens eller tavlans kant rullar ytan, så att en lång kolumn och kolumner utanför skärmen går att nå.
 * Escape avbryter. Ett släpp utanför en kolumn, eller på kortets egen plats, gör ingenting.
 *
 * ══ ⛔ KORTET FÖLJER FINGRET, OCH TAVLAN RITAS BARA OM NÄR MÅLET BYTS (0.243.0) ═══════════════════════════════════════════
 *
 * CP 2026-11-19, om tavlan i 0.242.0: "Se till att det är flygande lätt med drag and drop. Känns lite trögt idag och man ser inte objektet
 * som man drar medans man drar." Två mätbara skäl i koden:
 *
 * 1. **Inget följde pekaren.** Kortet stod kvar, halvt genomskinligt, och det enda som rörde sig var en tunn linje där det skulle hamna.
 *    Nu lyfts en kopia av kortet (`[data-drag-skugga]`) och följer pekaren, med samma avstånd till pekaren som när greppet togs. Den
 *    flyttas med `transform` direkt i pekarhändelsen, utan React, så den följer i varje bildruta. Kortet på sin plats får
 *    `data-drag-kalla`, så att appen kan visa var det kom ifrån, och kroken ger kortets höjd (`hojd`) så att platsen det ska till kan
 *    ritas lika stor som kortet i stället för som en linje.
 * 2. **Hela tavlan ritades om för varje pekarhändelse.** `setMal` anropades med ett nytt objekt varje gång, också när målet var
 *    detsamma, och en tavla med 121 kort ritades om 60 gånger i sekunden. Nu sätts målet bara när kolumnen eller platsen byts.
 *
 * Kopian är dekoration: `aria-hidden`, `pointer-events: none`, och den tas bort när dragningen slutar på vilket sätt som helst
 * (släpp, Escape, avbrott, eller att komponenten försvinner).
 *
 * @param {object} opts
 * @param {(slapp: { id: string, fran: string, till: string, index: number }) => void} opts.onSlapp Anropas en gång när kortet släpps på en ny plats.
 * @param {(id: string, kolumn: string) => boolean} [opts.tillat] Får kortet släppas i kolumnen? Förval ja.
 * @param {{ current: HTMLElement | null }} [opts.rullyta] Ytan som rullar i sidled (tavlan). Fönstret rullar alltid i höjdled.
 * @returns {{ greppProps: (id: string, kolumn: string) => Record<string, any>, drar: string | null, mal: { kolumn: string, index: number } | null, hojd: number }}
 */
export function useKortdragning({ onSlapp, tillat, rullyta }) {
  const [drar, setDrar] = useState(/** @type {string | null} */ (null));
  const [mal, setMal] = useState(/** @type {{ kolumn: string, index: number } | null} */ (null));
  const [hojd, setHojd] = useState(0);
  /** Kopian som följer pekaren, kortet den kopierar, och var i kortet greppet togs. */
  const skugga = useRef(/** @type {null | { el: HTMLElement, kalla: HTMLElement, dx: number, dy: number }} */ (null));
  const lage = useRef(/** @type {null | { id: string, fran: string, pekare: number, mal: { kolumn: string, index: number } | null, x: number, y: number }} */ (null));
  const senaste = useRef({ onSlapp, tillat });
  senaste.current = { onSlapp, tillat };
  const ram = useRef(/** @type {number | null} */ (null));

  const avsluta = useCallback(() => {
    lage.current = null;
    const s = skugga.current;
    skugga.current = null;
    if (s) {
      s.el.remove();
      s.kalla.removeAttribute("data-drag-kalla");
    }
    if (ram.current !== null) cancelAnimationFrame(ram.current);
    ram.current = null;
    setDrar(null);
    setMal(null);
    setHojd(0);
  }, []);

  /** Flyttar kopian till pekaren. Direkt i DOM:en, utan att React ritar om. */
  const flyttaSkugga = useCallback((/** @type {number} */ x, /** @type {number} */ y) => {
    const s = skugga.current;
    if (s) s.el.style.transform = `translate3d(${Math.round(x - s.dx)}px, ${Math.round(y - s.dy)}px, 0) rotate(1.5deg) scale(1.02)`;
  }, []);

  /**
   * Sätter målet bara när kolumnen eller platsen byts, så att tavlan inte ritas om för varje pekarhändelse. Jämförelsen görs mot målet i
   * `lage` och inte i en `setMal`-funktion: en funktion som ger tillbaka samma värde ritar ändå om komponenten en gång innan React ger upp.
   */
  const sattMal = useCallback((/** @type {{ kolumn: string, index: number } | null} */ m) => {
    const l = lage.current;
    if (!l) return;
    const f = l.mal;
    if (f === m || (f && m && f.kolumn === m.kolumn && f.index === m.index)) return;
    l.mal = m;
    setMal(m);
  }, []);

  /** Målet under pekaren: kolumn och plats, eller `null`. */
  const malVid = useCallback((/** @type {number} */ x, /** @type {number} */ y) => {
    const l = lage.current;
    if (!l || typeof document.elementFromPoint !== "function") return null;
    const el = document.elementFromPoint(x, y);
    const kolumn = el instanceof Element ? el.closest("[data-drag-kolumn]") : null;
    if (!kolumn) return null;
    const id = kolumn.getAttribute("data-drag-kolumn") ?? "";
    if (senaste.current.tillat && !senaste.current.tillat(l.id, id)) return null;
    const kort = [...kolumn.querySelectorAll("[data-drag-kort]")].map((k) => {
      const r = k.getBoundingClientRect();
      return { id: k.getAttribute("data-drag-kort") ?? "", top: r.top, height: r.height };
    });
    return { kolumn: id, index: slappIndex(kort, y, l.id) };
  }, []);

  // Kantrullning: så länge pekaren står nära en kant rullar fönstret i höjdled och tavlan i sidled.
  const rulla = useCallback(() => {
    const l = lage.current;
    if (!l) return;
    const KANT = 48;
    const STEG = 12;
    const h = window.innerHeight;
    if (l.y < KANT) window.scrollBy(0, -STEG);
    else if (l.y > h - KANT) window.scrollBy(0, STEG);
    const yta = rullyta?.current;
    if (yta) {
      const r = yta.getBoundingClientRect();
      if (l.x < r.left + KANT) yta.scrollLeft -= STEG;
      else if (l.x > r.right - KANT) yta.scrollLeft += STEG;
    }
    ram.current = requestAnimationFrame(rulla);
  }, [rullyta]);

  useEffect(() => {
    if (!drar) return undefined;
    const flytt = (/** @type {PointerEvent} */ e) => {
      const l = lage.current;
      if (!l || e.pointerId !== l.pekare) return;
      e.preventDefault();
      l.x = e.clientX;
      l.y = e.clientY;
      flyttaSkugga(e.clientX, e.clientY);
      sattMal(malVid(e.clientX, e.clientY));
    };
    const slapp = (/** @type {PointerEvent} */ e) => {
      const l = lage.current;
      if (!l || e.pointerId !== l.pekare) return;
      const m = malVid(e.clientX, e.clientY) ?? l.mal;
      avsluta();
      if (m) senaste.current.onSlapp({ id: l.id, fran: l.fran, till: m.kolumn, index: m.index });
    };
    const avbryt = (/** @type {PointerEvent} */ e) => {
      if (lage.current && e.pointerId === lage.current.pekare) avsluta();
    };
    const tangent = (/** @type {KeyboardEvent} */ e) => {
      if (e.key === "Escape") avsluta();
    };
    window.addEventListener("pointermove", flytt, { passive: false });
    window.addEventListener("pointerup", slapp);
    window.addEventListener("pointercancel", avbryt);
    window.addEventListener("keydown", tangent);
    ram.current = requestAnimationFrame(rulla);
    return () => {
      window.removeEventListener("pointermove", flytt);
      window.removeEventListener("pointerup", slapp);
      window.removeEventListener("pointercancel", avbryt);
      window.removeEventListener("keydown", tangent);
      if (ram.current !== null) cancelAnimationFrame(ram.current);
      ram.current = null;
    };
  }, [drar, malVid, avsluta, rulla, flyttaSkugga, sattMal]);

  // ⛔ Försvinner tavlan mitt i en dragning (vyn byts) får kopian inte bli kvar över sidan.
  useEffect(() => () => {
    if (skugga.current) {
      skugga.current.el.remove();
      skugga.current.kalla.removeAttribute("data-drag-kalla");
      skugga.current = null;
    }
  }, []);

  const greppProps = useCallback(
    (/** @type {string} */ id, /** @type {string} */ kolumn) => ({
      "data-drag-grepp": id,
      "aria-hidden": true,
      style: { touchAction: "none" },
      onPointerDown: (/** @type {import("react").PointerEvent} */ e) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        // ⛔ Trycket stannar i greppet: kortets länk och långtrycksmeny ska inte se det.
        e.stopPropagation();
        e.preventDefault();
        lage.current = { id, fran: kolumn, pekare: e.pointerId, mal: null, x: e.clientX, y: e.clientY };
        const kort = /** @type {HTMLElement | null} */ (e.currentTarget.closest("[data-drag-kort]"));
        if (kort) {
          const r = kort.getBoundingClientRect();
          const el = /** @type {HTMLElement} */ (kort.cloneNode(true));
          el.removeAttribute("data-drag-kort");
          el.querySelectorAll("[data-drag-grepp]").forEach((g) => g.removeAttribute("data-drag-grepp"));
          el.setAttribute("data-drag-skugga", id);
          el.setAttribute("aria-hidden", "true");
          Object.assign(el.style, {
            position: "fixed",
            left: "0px",
            top: "0px",
            width: `${r.width}px`,
            margin: "0",
            zIndex: "1000",
            pointerEvents: "none",
            willChange: "transform",
            boxShadow: "0 12px 32px rgba(0, 0, 0, 0.35)",
            cursor: "grabbing",
          });
          kort.setAttribute("data-drag-kalla", "");
          skugga.current = { el, kalla: kort, dx: e.clientX - r.left, dy: e.clientY - r.top };
          document.body.appendChild(el);
          flyttaSkugga(e.clientX, e.clientY);
          setHojd(Math.round(r.height));
        }
        setDrar(id);
      },
      onClick: (/** @type {import("react").MouseEvent} */ e) => {
        e.stopPropagation();
        e.preventDefault();
      },
      onContextMenu: (/** @type {import("react").MouseEvent} */ e) => e.preventDefault(),
    }),
    [flyttaSkugga],
  );

  return { greppProps, drar, mal, hojd };
}
