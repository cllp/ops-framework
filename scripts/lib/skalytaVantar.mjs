/**
 * Avsnitt 65 i check-skalyta: väntraden RÖR SIG (0.229.0).
 *
 * CP 2026-11-14: "progressbars som rör sig överallt där vi behöver vänta". jsdom mäter ingen CSS (arbetsreglernas regel 12), så att
 * `OpsVantar` har klassen `animate-vantar` säger ingenting om att raden faktiskt löper. Här mäts det i en riktig webbläsare vid 390 px:
 *
 *   - varje väntrad har animationen `ops-vantar` satt på biten, och spåret och biten har bredd större än 0;
 *   - biten STÅR INTE STILL: dess läge skiljer sig mellan två mätningar med 200 ms emellan;
 *   - raden har tonats in (`data-ops-vantar="syns"`, opacitet 1) efter fördröjningen;
 *   - med `prefers-reduced-motion` är animationen `none`, men spåret och biten syns fortfarande med bredd större än 0.
 *
 * ⛔ GOLV: minst tre väntrader i scenen (en `md`, en `sm`, en i `OpsEmpty`). En äldre dist utan `OpsVantar` ritar ingen och blir röd
 * på golvet, inte grön av att inget fanns.
 *
 * Kör ensamt: `node scripts/check-skalyta.mjs --bara-vantar`. Hela körningen kör det också.
 */

/** @typedef {import("./skalyta0106.mjs").Verktyg} Verktyg */

const GOLV = 3;

/** @param {import("playwright").Page} page */
function mat(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("[data-ops-vantar]")].map((el) => {
      const rad = /** @type {HTMLElement | null} */ (el.querySelector("[data-ops-vantar-rad]"));
      const bit = /** @type {HTMLElement | null} */ (rad?.firstElementChild ?? null);
      const sp = rad?.getBoundingClientRect();
      const b = bit?.getBoundingClientRect();
      return {
        lage: el.getAttribute("data-ops-vantar"),
        opacitet: Number(getComputedStyle(el).opacity),
        animation: bit ? getComputedStyle(bit).animationName : null,
        spar: sp ? sp.width : 0,
        bit: b ? b.width : 0,
        x: b ? b.left : null,
      };
    }),
  );
}

/**
 * @param {Verktyg} v
 */
export async function vantraden(v) {
  const vp = { width: 390, height: 844 };
  /** @type {import("playwright").BrowserContext | null} */
  let context = null;
  try {
    const o = await v.oppna("vantar", vp);
    context = o.context;
    const page = o.page;
    await page.waitForFunction(() => document.querySelectorAll('[data-ops-vantar="syns"]').length >= 3, null, { timeout: 3000 }).catch(() => {});
    // Övergången in är `--duration-base`; vänta ut den innan opaciteten läses.
    await page.waitForTimeout(400);
    const forsta = await mat(page);
    await page.waitForTimeout(200);
    const andra = await mat(page);
    v.krav(forsta.length >= GOLV, `vantar 390 px: ${forsta.length} väntrader, väntat minst ${GOLV}. Golv.`);
    forsta.forEach((m, i) => {
      v.krav(m.lage === "syns" && m.opacitet === 1, `vantar 390 px, rad ${i}: har inte tonats in (${JSON.stringify(m)}).`);
      v.krav(m.animation === "ops-vantar", `vantar 390 px, rad ${i}: animationen är ${JSON.stringify(m.animation)}, väntat "ops-vantar".`);
      v.krav(m.spar > 0 && m.bit > 0, `vantar 390 px, rad ${i}: spåret ${m.spar} px och biten ${m.bit} px, väntat båda större än 0.`);
      const x2 = andra[i]?.x;
      v.krav(m.x !== null && x2 != null && Math.abs(x2 - m.x) > 0.5, `vantar 390 px, rad ${i}: biten stod still (${m.x} och ${x2} med 200 ms emellan).`);
    });
    v.matt.push(`vantar 390 px: ${forsta.length} väntrader, animationen ${forsta.map((m) => m.animation).join(", ")}, biten flyttade ${forsta.map((m, i) => Math.round(Math.abs((andra[i]?.x ?? 0) - (m.x ?? 0)))).join(", ")} px på 200 ms`);
    if (v.bildmapp) await page.screenshot({ path: `${v.bildmapp}/vantar-390.png` });

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(100);
    const stilla = await mat(page);
    v.krav(stilla.length >= GOLV, `vantar 390 px, reducerad rörelse: ${stilla.length} väntrader, väntat minst ${GOLV}. Golv.`);
    stilla.forEach((m, i) => {
      v.krav(m.animation === "none", `vantar 390 px, reducerad rörelse, rad ${i}: animationen är ${JSON.stringify(m.animation)}, väntat "none".`);
      v.krav(m.spar > 0 && m.bit > 0 && m.opacitet === 1, `vantar 390 px, reducerad rörelse, rad ${i}: raden syns inte (${JSON.stringify(m)}).`);
    });
    v.matt.push(`vantar 390 px, reducerad rörelse: ${stilla.length} väntrader står still och syns (bit ${stilla.map((m) => Math.round(m.bit)).join(", ")} px)`);
  } catch (e) {
    v.krav(false, `vantar 390 px: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
  }
  await context?.close();
}
