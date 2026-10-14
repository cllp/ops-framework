/**
 * Mittknappens mikrofon, mätt i en riktig webbläsare (0.103.0, #382; 0.104.0).
 *
 * ⛔ EN MÄTNING FÖR TVÅ LÄSARE: `check-skalyta.mjs` avsnitt 39 och `mikrofon-montage.mjs`. Två kopior av samma krav hade glidit
 * isär (arbetsreglernas punkt 2), och den ena hade larmat på något den andra inte längre följde. Här står både vad som mäts i
 * sidan (`matMittknappen`, körs med `locator.evaluate`) och vad som krävs av det (`kravPaMittknappen`).
 *
 * ⛔ ÄNDRAT 0.104.0: PLUSSET ÄR BORTA. CP 2026-10-14: "Sak bara vi måste ta bort plusset till plus-knappen. Den ser bara skräpig ut."
 * I 0.103.0 mätte den här filen motsatsen: ett plus på 18 till 20 px upp till höger, bakom mikrofonen, dämpat och med minst lika
 * tjockt streck som mikrofonen (CP 2026-10-14 samma dag: "en stor mikrofon och liksom lite bakomliggande ett plus som indikerar
 * det"). Långtrycket finns kvar, så det som säger att det finns är nu bara namnet. Kraven:
 *   - knappen är en 56 px cirkel,
 *   - inget plus ritas på knappen: inget `[data-skapa-marke]` och bara en ritning, mikrofonen,
 *   - mikrofonen ritas i 30 till 32 px, lika stor som i 0.103.0, och står mitt i cirkeln (högst 1,5 px från mitten åt varje håll),
 *   - namnet nämner fortfarande långtrycket.
 */

/**
 * Körs i sidan. Självbärande: Playwright skickar funktionens källa, inga importer följer med.
 * @param {Element} b Mittknappen.
 */
export function matMittknappen(b) {
  const ruta = (/** @type {Element | null} */ el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, b: r.width, h: r.height };
  };
  const ikon = b.querySelector("[data-skapa-ikon]");
  const ikonSvg = ikon?.querySelector("svg") ?? null;
  return {
    namn: b.getAttribute("aria-label"),
    lage: b.getAttribute("data-talk-knapp"),
    knapp: ruta(b),
    marke: ruta(b.querySelector("[data-skapa-marke]")),
    ritningar: b.querySelectorAll("svg").length,
    ikon: ruta(ikonSvg),
    mikDelar: ikonSvg ? [...ikonSvg.children].length : 0,
  };
}

/**
 * Kraven på mätningen. Ger raderna som ska skrivas ut och felen; tomt fel betyder grönt.
 * @param {ReturnType<typeof matMittknappen>} m
 * @param {{ langtryckText?: string }} [val] Andra halvan av namnet. Förval den svenska ("Håll inne för att skapa").
 * @returns {{ rader: string[], fel: string[] }}
 */
export function kravPaMittknappen(m, val = {}) {
  const langtryckText = val.langtryckText ?? "Håll inne för att skapa";
  /** @type {string[]} */
  const fel = [];
  const krav = (/** @type {boolean} */ ok, /** @type {string} */ text) => {
    if (!ok) fel.push(text);
  };
  if (!m.knapp || !m.ikon) return { rader: [], fel: [`mittknappen saknar mikrofonen: ${JSON.stringify(m)}`] };
  const radie = m.knapp.b / 2;
  const dx = m.ikon.x + m.ikon.b / 2 - (m.knapp.x + radie);
  const dy = m.ikon.y + m.ikon.h / 2 - (m.knapp.y + m.knapp.h / 2);
  const rader = [
    `knappen ${m.knapp.b}x${m.knapp.h} px, ${m.ritningar} ritning(ar), mikrofonen ${m.ikon.b.toFixed(1)} px i ${m.mikDelar} delar med mitten ${dx.toFixed(1)}, ${dy.toFixed(1)} px från knappens, plusset ${m.marke ? "ritat" : "inte ritat"}, namnet ${JSON.stringify(m.namn)}`,
  ];
  krav(Math.abs(m.knapp.b - 56) < 0.5 && Math.abs(m.knapp.h - 56) < 0.5, `mittknappen är ${m.knapp.b}x${m.knapp.h} px, väntat 56x56.`);
  krav(m.mikDelar >= 2, `mikrofonens ritning har ${m.mikDelar} delar, väntat minst 2: mätningen mäter inget.`);
  krav(!m.marke && m.ritningar === 1, `mittknappen ritar ett plus (${m.marke ? "data-skapa-marke finns" : `${m.ritningar} ritningar`}), väntat bara mikrofonen. CP 2026-10-14: "Den ser bara skräpig ut."`);
  krav(m.ikon.b >= 29.5 && m.ikon.b <= 32.5, `mikrofonen är ${m.ikon.b} px, väntat 30 till 32 px i 56 px-cirkeln, som i 0.103.0.`);
  krav(Math.abs(dx) <= 1.5 && Math.abs(dy) <= 1.5, `mikrofonens mitt står ${dx.toFixed(1)}, ${dy.toFixed(1)} px från knappens, väntat högst 1,5 px åt varje håll.`);
  krav(typeof m.namn === "string" && m.namn.endsWith(`. ${langtryckText}`), `mittknappen heter ${JSON.stringify(m.namn)}, väntat att namnet slutar med ". ${langtryckText}": utan plusset är namnet det enda som säger att långtrycket finns.`);
  return { rader, fel };
}
