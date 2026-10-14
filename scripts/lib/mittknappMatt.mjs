/**
 * Mittknappens mikrofon med plusset bakom (0.103.0, #382; granskningen av PR 383, BÖR 5), mätt i en riktig webbläsare.
 *
 * ⛔ EN MÄTNING FÖR TVÅ LÄSARE: `check-skalyta.mjs` avsnitt 39 och `mikrofon-montage.mjs`. Två kopior av samma krav hade glidit
 * isär (arbetsreglernas punkt 2), och den ena hade larmat på något den andra inte längre följde. Här står både vad som mäts i
 * sidan (`matMittknappen`, körs med `locator.evaluate`) och vad som krävs av det (`kravPaMittknappen`).
 *
 * CP 2026-10-14: "en stor mikrofon och liksom lite bakomliggande ett plus som indikerar det". Kraven:
 *   - knappen är en 56 px cirkel,
 *   - mikrofonen ritas i 30 till 32 px,
 *   - plusset är 18 till 20 px, står med sina streck helt inom cirkeln och är förskjutet upp till höger,
 *   - plusset ligger FÖRE mikrofonen i ordningen och dess streck möter mikrofonens kapsel, så att mikrofonen täcker en del av det,
 *   - kapseln är fylld i knappens färg (annars syns plusset genom den, och då ligger det inte bakom),
 *   - plusset är dämpat (opacitet mellan 0,35 och 0,8): lägre kontrast än mikrofonen, men fortfarande där.
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
  /** Strecket i skärmens px för en svg (stroke-width är i viewBox-enheter). @param {Element | null} svg */
  const streck = (svg) => {
    if (!svg) return 0;
    const vb = /** @type {SVGSVGElement} */ (svg).viewBox.baseVal;
    return Number.parseFloat(getComputedStyle(svg).strokeWidth) * (svg.getBoundingClientRect().width / (vb?.width || 24));
  };
  const marke = b.querySelector("[data-skapa-marke]");
  const ikon = b.querySelector("[data-skapa-ikon]");
  const markeSvg = marke?.querySelector("svg") ?? null;
  const ikonSvg = ikon?.querySelector("svg") ?? null;
  // Kapseln är lucides första del (en sluten `path`), bågen och foten följer.
  const kapsel = ikonSvg?.firstElementChild ?? null;
  return {
    namn: b.getAttribute("aria-label"),
    lage: b.getAttribute("data-talk-knapp"),
    knapp: ruta(b),
    knappFarg: getComputedStyle(b).backgroundColor,
    marke: ruta(marke),
    markeDold: marke?.getAttribute("aria-hidden") === "true",
    markeOpacitet: marke ? Number.parseFloat(getComputedStyle(marke).opacity) : null,
    // Plussets streck (två linjer), utan sina streckbredder: de läggs på nedan.
    plusDelar: markeSvg ? [...markeSvg.children].map(ruta) : [],
    plusStreck: streck(markeSvg),
    ikon: ruta(ikonSvg),
    mikDelar: ikonSvg ? [...ikonSvg.children].map(ruta) : [],
    mikStreck: streck(ikonSvg),
    kapsel: ruta(kapsel),
    kapselFyllning: kapsel ? getComputedStyle(kapsel).fill : null,
    plusForeMikrofonen: Boolean(marke && ikon && marke.compareDocumentPosition(ikon) & Node.DOCUMENT_POSITION_FOLLOWING),
  };
}

/**
 * Kraven på mätningen. Ger raderna som ska skrivas ut och felen; tomt fel betyder grönt.
 * @param {ReturnType<typeof matMittknappen>} m
 * @returns {{ rader: string[], fel: string[] }}
 */
export function kravPaMittknappen(m) {
  /** @type {string[]} */
  const fel = [];
  const krav = (/** @type {boolean} */ ok, /** @type {string} */ text) => {
    if (!ok) fel.push(text);
  };
  if (!m.knapp || !m.marke || !m.ikon) return { rader: [], fel: [`mittknappen saknar plusset eller mikrofonen: ${JSON.stringify(m)}`] };
  const radie = m.knapp.b / 2;
  const mitt = { x: m.knapp.x + radie, y: m.knapp.y + radie };
  /** @param {{ x: number, y: number, b: number, h: number } | null} r @param {number} s */
  const medStreck = (r, s) => (r ? { x: r.x - s / 2, y: r.y - s / 2, b: r.b + s, h: r.h + s } : null);
  const plus = m.plusDelar.filter((d) => d && (d.b > 0 || d.h > 0)).map((d) => /** @type {{ x: number, y: number, b: number, h: number }} */ (medStreck(d, m.plusStreck)));
  const mik = m.mikDelar.filter((d) => d && d.b > 0 && d.h > 0).map((d) => /** @type {{ x: number, y: number, b: number, h: number }} */ (medStreck(d, m.mikStreck)));
  const kapsel = medStreck(m.kapsel, m.mikStreck);
  // Plussets längst ut ritade punkt: hörnen på varje strecks ruta.
  const ytterst = Math.max(
    ...plus.flatMap((d) => [[d.x, d.y], [d.x + d.b, d.y], [d.x, d.y + d.h], [d.x + d.b, d.y + d.h]].map(([x, y]) => Math.hypot(x - mitt.x, y - mitt.y))),
  );
  const plusMitt = { x: m.marke.x + m.marke.b / 2 - mitt.x, y: m.marke.y + m.marke.h / 2 - mitt.y };
  const krockar = (/** @type {{ x: number, y: number, b: number, h: number }} */ a, /** @type {{ x: number, y: number, b: number, h: number }} */ c) =>
    a.x < c.x + c.b && c.x < a.x + a.b && a.y < c.y + c.h && c.y < a.y + a.h;
  const motesKapseln = Boolean(kapsel) && plus.some((d) => krockar(d, /** @type {any} */ (kapsel)));
  const rader = [
    `knappen ${m.knapp.b}x${m.knapp.h} px (${m.knappFarg}), mikrofonen ${m.ikon.b.toFixed(1)} px i ${mik.length} delar, plusset ${m.marke.b}x${m.marke.h} px med mitten ${plusMitt.x.toFixed(1)}, ${plusMitt.y.toFixed(1)} px från knappens`,
    `plussets streck längst ut ${ytterst.toFixed(1)} px från mitten (radie ${radie}), opacitet ${m.markeOpacitet}, kapselns fyllning ${m.kapselFyllning}, möter kapseln: ${motesKapseln}, ritas före mikrofonen: ${m.plusForeMikrofonen}`,
  ];
  krav(Math.abs(m.knapp.b - 56) < 0.5 && Math.abs(m.knapp.h - 56) < 0.5, `mittknappen är ${m.knapp.b}x${m.knapp.h} px, väntat 56x56.`);
  krav(m.ikon.b >= 29.5 && m.ikon.b <= 32.5, `mikrofonen är ${m.ikon.b} px, väntat 30 till 32 px i 56 px-cirkeln.`);
  krav(mik.length >= 2, `mikrofonens ritning har ${mik.length} delar, väntat minst 2: mätningen mäter inget.`);
  krav(plus.length >= 2, `plusset har ${plus.length} streck, väntat 2: mätningen mäter inget.`);
  krav(m.marke.b >= 17.5 && m.marke.b <= 20.5 && m.marke.h >= 17.5 && m.marke.h <= 20.5, `plusset är ${m.marke.b}x${m.marke.h} px, väntat 18 till 20.`);
  krav(m.markeDold, "plusset är inte dolt för skärmläsare (aria-hidden), men namnet säger redan håll inne.");
  krav(ytterst <= radie, `plussets streck går ${(ytterst - radie).toFixed(1)} px utanför knappens cirkel, väntat helt inom.`);
  krav(plusMitt.x > 4 && plusMitt.y < -4, `plussets mitt står ${plusMitt.x.toFixed(1)}, ${plusMitt.y.toFixed(1)} px från knappens, väntat upp till höger.`);
  krav(m.plusForeMikrofonen, "plusset ritas efter mikrofonen och ligger alltså framför den, väntat bakom.");
  krav(motesKapseln, "plussets streck möter inte mikrofonens kapsel: mikrofonen täcker inget av plusset, så det ser inte ut att ligga bakom.");
  krav(m.kapselFyllning === m.knappFarg, `kapseln är fylld med ${m.kapselFyllning}, väntat knappens färg ${m.knappFarg}: annars syns plusset genom mikrofonen.`);
  krav(m.markeOpacitet !== null && m.markeOpacitet >= 0.35 && m.markeOpacitet <= 0.8, `plussets opacitet är ${m.markeOpacitet}, väntat 0,35 till 0,8: dämpat men synligt.`);
  return { rader, fel };
}
