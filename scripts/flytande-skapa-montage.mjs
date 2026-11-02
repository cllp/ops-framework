/**
 * Mätning och skärmbilder av den flytande Skapa-knappen (ej utgivet, cllp/lifehub.app#582) mot en byggd dist, i en riktig webbläsare.
 *
 * CP 2026-11-02: under 768 px är mikrofonen mittknapp och skapa-listan ligger bakom ett långtryck som inget avslöjar. Plustecknet på
 * mikrofonen togs bort i 0.104.0, så knappen är en EGEN, rund plusknapp nere till höger. jsdom kör ingen CSS, så det som handlar om
 * hur den SER UT och var den STÅR mäts här: syns på 390 px och inte på 1280, ligger över bottenraden och bredvid mikrofonen, träffas
 * av ett tryck i mitten (`elementFromPoint`), är minst 44 px, har fokusring, går inte undan vid rullning och täcker aldrig sista raden.
 *
 * Bilderna är ramverket ensamt: beslutet citerar ingen SessionStudio-skärmbild, så det finns ingen förebild att ställa bredvid (regel 12).
 *
 * Kör: npm run build && node scripts/flytande-skapa-montage.mjs [--bilder <mapp>]
 * Förval för bilderna: docs/jamforelser/flytande-skapa-582. Webbläsaren är den startaWebblasare hittar.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { byggYta } from "./lib/byggYta.mjs";
import { startaWebblasare } from "./lib/matVyport.mjs";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const i = process.argv.indexOf("--bilder");
const ut = i > 0 ? path.resolve(process.argv[i + 1]) : path.join(rot, "docs", "jamforelser", "flytande-skapa-582");
fs.mkdirSync(ut, { recursive: true });

/** @type {string[]} */
const fel = [];
const krav = (/** @type {boolean} */ ok, /** @type {string} */ text) => {
  if (!ok) fel.push(text);
};

/**
 * Körs i sidan: knappens ruta och det som avgör om den ser rätt ut.
 * @param {HTMLElement} k
 */
function matKnappen(k) {
  const r = k.getBoundingClientRect();
  const cs = getComputedStyle(k);
  const mikR = document.querySelector("[data-talk-knapp]")?.getBoundingClientRect();
  const radR = document.querySelector("nav[data-ops-bottenrad]")?.getBoundingClientRect();
  const mitt = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  const hornet = document.elementFromPoint(r.x + r.width * 0.15, r.y + r.height * 0.5);
  return {
    r: { x: r.x, y: r.y, b: r.width, h: r.height, botten: r.bottom, hoger: r.right },
    mik: mikR ? { x: mikR.x, y: mikR.y, hoger: mikR.right, botten: mikR.bottom } : null,
    radTop: radR ? radR.top : null,
    tr: mitt === k || k.contains(mitt),
    trHorn: hornet === k || k.contains(hornet),
    bg: cs.backgroundColor,
    radie: cs.borderRadius,
    namn: k.getAttribute("aria-label"),
    haspopup: k.getAttribute("aria-haspopup"),
    tag: k.tagName,
  };
}

const { sida, stada } = await byggYta({ rot, yta: path.join("scripts", "lib", "flytande-skapa-yta.jsx"), namn: "flytande-skapa" });
try {
  const { browser, varifran } = await startaWebblasare();
  console.log(`webbläsare: ${varifran}`);
  /** @param {{ width: number, height: number }} viewport @param {"dark" | "light"} [colorScheme] */
  const ny = async (viewport, colorScheme = "dark") => {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme, hasTouch: viewport.width < 768 });
    const page = await context.newPage();
    page.on("pageerror", (e) => fel.push(`sidfel: ${e.message}`));
    await page.setContent(sida, { waitUntil: "load" });
    await page.locator("main").waitFor();
    return { context, page };
  };
  const knapp = (/** @type {import("playwright").Page} */ page) => page.locator("[data-ops-flytande-skapa]");
  const synlig = async (/** @type {import("playwright").Page} */ page) => (await knapp(page).count()) > 0 && (await knapp(page).isVisible());
  const bild = async (/** @type {import("playwright").Page} */ page, /** @type {string} */ namn) => {
    await page.mouse.move(0, 0);
    await page.waitForTimeout(250);
    const fil = path.join(ut, `ramverk-${namn}.png`);
    await page.screenshot({ path: fil });
    console.log(fil);
  };

  // ── 390 px, mörkt: läge, storlek, träff, fokusring, marginal, rullning ──────────────────────────────────────────────────
  {
    const { context, page } = await ny({ width: 390, height: 844 });
    // Utan knappen finns inget mer att mäta: röd direkt och tydligt, inte en timeout i Playwright.
    if (!(await synlig(page))) throw new Error("390 px: knappen syns inte på en vy som appen slagit på den för (data-ops-flytande-skapa saknas)");
    const m = await knapp(page).evaluate(matKnappen);
    console.log(`  390 px: ${m.r.b}x${m.r.h} px, höger kant ${m.r.hoger}, botten ${m.r.botten}, bottenradens överkant ${m.radTop}, mikrofonen höger ${m.mik?.hoger}, bakgrund ${m.bg}`);
    krav(m.tag === "BUTTON", `en riktig button, inte ${m.tag}`);
    krav(m.r.b >= 44 && m.r.h >= 44, `minst 44 px, var ${m.r.b}x${m.r.h}`);
    krav(Math.abs(m.r.b - m.r.h) < 0.5 && m.radie !== "0px", "rund");
    krav(m.namn === "Skapa" && m.haspopup === "dialog", `namn ${m.namn}, aria-haspopup ${m.haspopup}`);
    krav(m.radTop !== null && m.r.botten <= m.radTop - 8, `knappen ska ligga minst 8 px ovanför bottenraden (botten ${m.r.botten}, radens överkant ${m.radTop})`);
    krav(m.mik !== null && m.r.x > m.mik.hoger + 8, "knappen ska ligga till höger om mikrofonen, utan att röra den");
    krav(m.r.hoger <= 390 - 12, `knappen ska ha luft till höger kant (höger ${m.r.hoger})`);
    krav(m.tr && m.trHorn, "ett tryck i mitten och nära kanten ska landa på knappen (elementFromPoint)");
    krav(!/rgba?\(0, 0, 0, 0\)/.test(m.bg), "knappen har en fylld accentfärg");

    // Marginal: main ska ha bottenradens höjd PLUS knappens höjd plus luft som padding. Sista raden ska gå att rulla fram ovanför knappen.
    const marg = await page.evaluate(() => {
      const main = document.querySelector("main");
      const rad = document.querySelector("nav[data-ops-bottenrad]");
      const pb = main ? parseFloat(getComputedStyle(main).paddingBottom) : NaN;
      return { pb, rad: rad ? rad.getBoundingClientRect().height : NaN };
    });
    const knappH = m.r.h + 16;
    console.log(`  main padding-bottom ${marg.pb} px, bottenraden ${marg.rad} px, knappen med luft ${knappH} px`);
    krav(marg.pb >= marg.rad + knappH - 1, `main ska reservera bottenraden plus knappen (${marg.pb} < ${marg.rad} + ${knappH})`);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(150);
    const efter = await page.evaluate(() => {
      const k = document.querySelector("[data-ops-flytande-skapa]")?.getBoundingClientRect();
      const s = document.querySelector("[data-sista-kort]")?.getBoundingClientRect();
      return k && s ? { kTop: k.top, kX: k.x, kHoger: k.right, sBotten: s.bottom, sHoger: s.right } : null;
    });
    krav(efter !== null && efter.sBotten <= efter.kTop - 1, `sista raden ska sluta ovanför knappen när sidan rullats till slutet (${JSON.stringify(efter)})`);
    krav(m.r.y === (await knapp(page).evaluate((k) => k.getBoundingClientRect().y)), "knappen står på samma ställe efter rullning (ingen göm-vid-rullning)");
    await bild(page, "knapp-mork-390");
    await page.evaluate(() => window.scrollTo(0, 0));

    // Fokusring: Tab till knappen och mät konturen.
    await knapp(page).focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    const fokus = await knapp(page).evaluate((k) => {
      const cs = getComputedStyle(k);
      return { aktiv: document.activeElement === k, kant: cs.outlineStyle, bredd: parseFloat(cs.outlineWidth) };
    });
    krav(fokus.aktiv && fokus.kant !== "none" && fokus.bredd >= 2, `synlig fokusring på tangentbordsfokus: ${JSON.stringify(fokus)}`);
    await bild(page, "knapp-fokus-390");

    // Ett tryck öppnar skapa-listan, och knappen går då undan.
    await knapp(page).click();
    await page.getByRole("dialog", { name: "Skapa" }).waitFor();
    krav(!(await synlig(page)), "knappen ska gå undan medan skapa-listan är öppen");
    await bild(page, "lista-oppen-390");
    await page.keyboard.press("Escape");
    await page.getByRole("dialog", { name: "Skapa" }).waitFor({ state: "detached" });
    krav(await synlig(page), "knappen ska komma tillbaka när listan stängts");

    // En vy som appen inte slagit på den för: Hub.
    await page.locator("nav[data-ops-bottenrad] a[href='/hub']").click();
    await page.waitForTimeout(150);
    krav(!(await synlig(page)), "Hub: knappen ska inte synas på en vy som inte slagit på den");
    const pbHub = await page.evaluate(() => parseFloat(getComputedStyle(/** @type {Element} */ (document.querySelector("main"))).paddingBottom));
    krav(pbHub < marg.pb, `Hub: ingen reserverad plats utan knapp (${pbHub} mot ${marg.pb})`);
    await bild(page, "hub-utan-knapp-390");
    await context.close();
  }

  // ── 390 px, ljust ────────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    const { context, page } = await ny({ width: 390, height: 844 }, "light");
    krav(await synlig(page), "ljust: knappen syns inte");
    await bild(page, "knapp-ljus-390");
    await context.close();
  }

  // ── Liggande telefon (låg skärm): knappen krymper till golvet, 44 px, och marginalen följer ───────────────────────────────
  {
    const { context, page } = await ny({ width: 640, height: 360 });
    krav(await synlig(page), "låg skärm: knappen syns inte");
    const m = await knapp(page).evaluate(matKnappen);
    console.log(`  640x360: ${m.r.b}x${m.r.h} px`);
    krav(m.r.b >= 44 && m.r.h >= 44 && m.r.b <= 45, `låg skärm: 44 px, var ${m.r.b}x${m.r.h}`);
    await context.close();
  }

  // ── 1280 px: dator, knappen finns inte ───────────────────────────────────────────────────────────────────────────────────
  {
    const { context, page } = await ny({ width: 1280, height: 800 });
    krav(!(await synlig(page)), "1280 px: knappen ska inte synas på dator");
    await bild(page, "dator-utan-knapp-1280");
    await context.close();
  }
  await browser.close();
} finally {
  stada();
}
if (fel.length > 0) {
  console.error(`flytande-skapa: ${fel.length} fel\n  ${fel.join("\n  ")}`);
  process.exit(1);
}
console.log("flytande-skapa: grönt (390 mörkt och ljust, 640x360, 1280)");
