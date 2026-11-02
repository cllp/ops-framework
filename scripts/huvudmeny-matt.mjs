/**
 * Taket för appikonerna i toppraden mot en byggd dist (0.177.0): MÄTNING.
 *
 * Kör: npm run build && node scripts/huvudmeny-matt.mjs [--bevisa]   (`npm run check:huvudmeny` kör båda, i `check:all`)
 *
 * ⛔ HÄNDELSEN: CP 2026-11-02 20:58, med en skärmbild från telefonen. Sju appar hade "Visa i huvudmenyn" och toppraden klippte den sista ikonen. CP:s beslut ("4, kör"):
 * man får välja fyra (`HUVUDMENY_MAX`, src/lib/modulinstallningar.js), och hur många som SYNS följer bredden. Båda tal ska mätas, inte antas.
 *
 *   1. KAPACITET: största antal appikoner som ryms i toppraden vid 320, 360, 390, 768, 1024 och 1280 px, tillsammans med hemikon, gruppmärke, Inkorg som åtgärd och
 *      avatar (scenen `kapacitet` i scripts/lib/huvudmeny-yta.jsx, där ikonerna INTE bär `kvarIHuvudet` så skalet inte kan dölja eller kapa dem). "Ryms" är samma mått
 *      som hemikon-montage.mjs: raden rullar inte i sidled, ingen kontroll sticker ut eller ligger över en annan, och klungan tränger inte in i radens högerpadding.
 *      Tabellen i `HUVUDMENY_MAX` (1 vid 320, 2 vid 360, 3 vid 390 och 768, fler än 4 från 1024) är det här utfallet, och dold-klasserna i `HUVUDMENY_BREDDSTEG` är byggda på den.
 *   2. TAKET I BRUK, med fyra och med sju fästa appar (CP:s har sju), vid 15 bredder runt varje brytpunkt (320, 340, 359, 360, 375, 389, 390, 414, 600, 767, 768, 1000, 1023, 1024, 1280):
 *      a. Toppraden ska rymmas: ingen rullning, ingen klippning, inget överlapp (RÖTT annars, utom 320 px, se nedan).
 *      b. ⛔ VARJE APP STÅR PÅ EXAKT ETT STÄLLE: som synlig ikon i toppraden eller som synlig rad i Meny (bottenradens ark under 768 px, huvudets meny från 768 px).
 *         Aldrig på båda och aldrig på inget. Det är det som gör att en dold ikon inte försvinner.
 *      c. Med sju: de efter de första fyra står i Meny på alla bredder.
 *      d. Synliga ikoner får aldrig vara fler än kapaciteten vid bredden. Är de färre skrivs en varning (en tom plats är ett val, inget brott).
 *
 * 320 px: tabellen säger 1, och dold-klasserna visar 1 där också. Klungan tränger in 0 px. Mäts som alla andra bredder.
 *
 * ⛔ GOLV: minst 54 kapacitets- och 30 bruksmätpunkter måste ha hittat huvudet och minst en kontroll i det.
 * ⛔ BEVISET ÅT MOTSATT HÅLL (`--bevisa`), två gånger: (1) en dold-klass tas bort ur ikon 1 vid 320 px, och mätaren MÅSTE bli röd (raden klipps, appen står på två ställen).
 *    (2) den omvända klassen tas bort ur ikon 1:s rad i Meny vid 400 px, och mätaren MÅSTE bli röd (appen står på två ställen). En mätare som aldrig sett ett fel är ingen vakt (regel 4).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startaWebblasare } from "./lib/matVyport.mjs";
import { byggYta } from "./lib/byggYta.mjs";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bevisa = process.argv.includes("--bevisa");

const { sida: grundsida, stada } = await byggYta({ rot, yta: "scripts/lib/huvudmeny-yta.jsx", namn: "huvudmeny" });
const sida = (/** @type {Record<string, unknown>} */ v) => grundsida.replace('<div id="root"></div>', `<div id="root"></div><script>${Object.entries(v).map(([k, x]) => `window.__${k}=${JSON.stringify(x)};`).join("")}</script>`);
const { browser, varifran } = await startaWebblasare();
console.log(`webbläsare: ${varifran}`);

/** Mäter huvudet. Allt mäts i sidan, så att samma mätare används överallt. */
function mat() {
  const dok = document.documentElement;
  const rad = document.querySelector("header > div");
  const syns = [...document.querySelectorAll("header a, header button")].filter((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
  });
  const poster = syns.map((el) => {
    const r = el.getBoundingClientRect();
    return { namn: (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 30), x: r.x, r: r.right, y: r.y, b: r.bottom };
  });
  const par = [];
  for (let i = 0; i < poster.length; i++) for (let j = i + 1; j < poster.length; j++) {
    const dx = Math.min(poster[i].r, poster[j].r) - Math.max(poster[i].x, poster[j].x);
    const dy = Math.min(poster[i].b, poster[j].b) - Math.max(poster[i].y, poster[j].y);
    if (dx > 0.5 && dy > 0.5) par.push(`${poster[i].namn} x ${poster[j].namn}`);
  }
  const APPAR = ["Bibliotek", "Meddelanden", "Ekonomi", "Recept", "Agenter", "Foton", "Planering", "Resor", "Kalendrar", "Budget"];
  return {
    sida: dok.scrollWidth - dok.clientWidth,
    rad: rad ? rad.scrollWidth - rad.clientWidth : null,
    langstUt: Math.max(0, ...poster.map((p) => p.r)),
    inneKant: rad ? rad.getBoundingClientRect().right - parseFloat(getComputedStyle(rad).paddingRight) : null,
    antal: poster.length,
    par,
    max: /** @type {any} */ (window).__max,
    apparIHuvudet: APPAR.filter((n) => poster.some((p) => p.namn === n)),
  };
}

/** @param {Awaited<ReturnType<typeof mat>>} m @param {number} bredd @returns {string[]} */
function brott(m, bredd) {
  /** @type {string[]} */
  const fil = [];
  if (m.antal < 2) fil.push(`bara ${m.antal} kontroller i huvudet, väntat minst 2`);
  if (m.sida > 0) fil.push(`sidan rullar i sidled (${m.sida})`);
  if (m.rad !== null && m.rad > 0) fil.push(`raden rullar i sidled (${m.rad})`);
  if (m.langstUt > bredd + 0.5) fil.push(`en kontroll sticker ut till ${m.langstUt.toFixed(0)} av ${bredd}`);
  if (m.inneKant !== null && m.langstUt > m.inneKant + 0.5) fil.push(`klungan tränger in i högerpaddingen: ${m.langstUt.toFixed(0)} mot innekant ${m.inneKant.toFixed(0)}`);
  if (m.par.length) fil.push(`överlapp: ${m.par.join("; ")}`);
  return fil;
}

/** @param {number} bredd @param {Record<string, unknown>} v */
async function rita(bredd, v) {
  const context = await browser.newContext({ viewport: { width: bredd, height: 844 }, deviceScaleFactor: 1, colorScheme: "light" });
  const page = await context.newPage();
  /** @type {string[]} */
  const sidfel = [];
  page.on("pageerror", (e) => sidfel.push(e.message));
  await page.setContent(sida(v), { waitUntil: "load" });
  await page.waitForSelector("[data-huvudmeny-yta]", { state: "attached", timeout: 8000 }).catch(() => {
    throw new Error(`${JSON.stringify(v)} ${bredd}: skalet ritades inte. ${sidfel.join("\n")}`);
  });
  await page.waitForTimeout(120);
  return { page, context, sidfel };
}

const APPNAMN = ["Bibliotek", "Meddelanden", "Ekonomi", "Recept", "Agenter", "Foton", "Planering"];

/**
 * Öppnar Meny på bredden (bottenradens ark under 768 px, huvudets meny från 768 px) och ger namnen på de rader som SYNS.
 * @param {import("playwright").Page} page @param {number} bredd @returns {Promise<string[]>}
 */
async function synligaMenyrader(page, bredd) {
  try {
    if (bredd < 768) {
      await page.getByRole("navigation", { name: "Snabbnavigering" }).getByRole("button", { name: "Meny" }).click();
      await page.waitForSelector('[role="dialog"]', { timeout: 4000 });
      return await page.$$eval('[role="dialog"] a', (as) => as.filter((a) => a.getBoundingClientRect().height > 0).map((a) => (a.getAttribute("aria-label") || a.textContent || "").trim()));
    }
    await page.locator("header").getByRole("button", { name: /fler åtgärder/ }).click();
    await page.waitForSelector('[role="dialog"], [data-radix-popper-content-wrapper]', { timeout: 4000 });
    // Överskottet bor i en egen navigering; saknas den finns inga rader, och det är inget fel för en grupp inom taket.
    return await page.$$eval("[data-huvudmeny-overskott] a", (as) => as.filter((a) => a.getBoundingClientRect().height > 0).map((a) => (a.textContent || "").trim()));
  } catch {
    return [];
  }
}

/** Raderna bär ikonens initial före namnet (scenens OpsIdentity) och ibland räknaren efter, så namnet söks inuti. Appnamnen är inte delar av varandra. @param {string[]} rader @param {string} namn */
const harRad = (rader, namn) => rader.some((r) => r.includes(namn));

/**
 * Mäter en bredd med `antal` fästa appar: raden, och var varje app står.
 * @param {number} bredd @param {number} antal @param {(page: import("playwright").Page) => Promise<void>} [forandra] Ändrar sidan före mätningen (bara beviset).
 */
async function matBruk(bredd, antal, forandra) {
  const { page, context, sidfel } = await rita(bredd, { lage: "tak", antal });
  if (forandra) await forandra(page);
  const m = await page.evaluate(mat);
  const rader = await synligaMenyrader(page, bredd);
  await context.close();
  /** @type {string[]} */
  const f = [];
  if (sidfel.length) f.push(`sidfel: ${sidfel.join("; ")}`);
  f.push(...brott(m, bredd));
  /** @type {string[]} */
  const placering = [];
  for (const namn of APPNAMN.slice(0, antal)) {
    const iHuvud = m.apparIHuvudet.includes(namn);
    const iMeny = harRad(rader, namn);
    placering.push(`${namn}:${iHuvud ? "H" : ""}${iMeny ? "M" : ""}`);
    if (iHuvud && iMeny) f.push(`${namn} står på TVÅ ställen (toppraden och Meny)`);
    if (!iHuvud && !iMeny) f.push(`${namn} står INGENSTANS (varken i toppraden eller i Meny)`);
  }
  // Med fler än taket ska de efter de första `max` stå i Meny.
  for (const namn of APPNAMN.slice(m.max, antal)) if (!harRad(rader, namn)) f.push(`${namn} (efter de första ${m.max}) saknas i Meny`);
  if (m.apparIHuvudet.length > m.max) f.push(`${m.apparIHuvudet.length} appikoner i toppraden, taket är ${m.max}`);
  return { m, f, placering, rader };
}

if (bevisa) {
  const forsta = await rita(360, { lage: "kapacitet", antal: 0 });
  const max = (await forsta.page.evaluate(mat)).max;
  await forsta.context.close();
  /** @type {string[]} */
  const falsk = [];
  // (1) Dold-klassen av ikon 1 borttagen vid 320 px: två ikoner där bara en ryms.
  const ett = await matBruk(320, max, (page) => page.evaluate(() => {
    const el = document.querySelector('[data-huvudmeny-plats="1"]');
    if (el) el.className = el.className.replace("max-[360px]:hidden", "");
    else throw new Error("ikon 1 saknar omslag");
  }));
  console.log(`bevis 1: dold-klassen borttagen ur ikon 1 vid 320 px: ${ett.f.length ? `RÖTT som väntat (${ett.f.join(" | ")})` : "GRÖNT, och det är fel"}`);
  if (ett.f.length === 0) falsk.push("bevis 1");
  // (2) Den omvända klassen borttagen ur ikon 1:s rad i Meny vid 400 px: appen står i toppraden och i Meny.
  // Raden finns först när Meny är öppen, så klassen tas bort efter öppningen.
  {
    const { page, context } = await rita(400, { lage: "tak", antal: max });
    const m = await page.evaluate(mat);
    await page.getByRole("navigation", { name: "Snabbnavigering" }).getByRole("button", { name: "Meny" }).click();
    await page.waitForSelector('[role="dialog"]', { timeout: 4000 });
    await page.evaluate(() => {
      for (const d of document.querySelectorAll('[role="dialog"] a')) {
        const o = d.parentElement;
        if (o && (d.textContent || "").includes("Meddelanden")) o.className = o.className.replace("min-[360px]:hidden", "");
      }
    });
    const rader = await page.$$eval('[role="dialog"] a', (as) => as.filter((a) => a.getBoundingClientRect().height > 0).map((a) => (a.textContent || "").trim()));
    await context.close();
    const dubbel = m.apparIHuvudet.includes("Meddelanden") && harRad(rader, "Meddelanden");
    console.log(`bevis 2: den omvända klassen borttagen ur ikon 1:s rad i Meny vid 400 px: ${dubbel ? "RÖTT som väntat (Meddelanden står på TVÅ ställen)" : "GRÖNT, och det är fel"}`);
    if (!dubbel) falsk.push("bevis 2");
  }
  await browser.close();
  stada();
  if (falsk.length) {
    console.error(`huvudmeny-matt --bevisa: mätaren blev inte röd i ${falsk.join(", ")}. Den mäter då inte att ikonerna klipps eller dubbleras.`);
    process.exit(1);
  }
  process.exit(0);
}

/** @type {string[]} */
const fel = [];
let punkter = 0;

// ── 1. KAPACITET ─────────────────────────────────────────────────────────────────────────────────────────
const KAP_BREDDER = [320, 360, 390, 768, 1024, 1280];
/** @type {Record<number, number>} */
const kapacitet = {};
let max = NaN;
for (const bredd of KAP_BREDDER) {
  let storst = -1;
  const rad = [];
  for (let n = 0; n <= 8; n++) {
    const { page, context, sidfel } = await rita(bredd, { lage: "kapacitet", antal: n });
    const m = await page.evaluate(mat);
    await context.close();
    max = m.max;
    if (sidfel.length) fel.push(`kapacitet ${bredd}/${n}: sidfel ${sidfel.join("; ")}`);
    if (m.antal >= 2) punkter++;
    const ryms = brott(m, bredd).length === 0;
    rad.push(`${n}${ryms ? "+" : "-"}`);
    if (ryms) storst = n;
  }
  kapacitet[bredd] = storst;
  console.log(`kapacitet ${String(bredd).padStart(4)} px: ryms ${storst} appikoner (${rad.join(" ")}, + ryms, - klipps)`);
}
if (!Number.isInteger(max) || max < 1) fel.push(`HUVUDMENY_MAX lästes som ${max}. Ett tak ska vara ett heltal från 1.`);
console.log(`HUVUDMENY_MAX = ${max}`);

// ── 2. TAKET I BRUK ──────────────────────────────────────────────────────────────────────────────────────
const BRUKS_BREDDER = [320, 340, 359, 360, 375, 389, 390, 414, 600, 767, 768, 1000, 1023, 1024, 1280];
/** Kapaciteten vid en bredd: den närmaste uppmätta bredden under eller på den. @param {number} bredd */
const kapVid = (bredd) => kapacitet[[...KAP_BREDDER].reverse().find((b) => b <= bredd) ?? 320];
for (const antal of [Math.min(4, max), 7]) {
  for (const bredd of BRUKS_BREDDER) {
    const { m, f, placering } = await matBruk(bredd, antal, undefined);
    if (m.antal >= 2) punkter++;
    const synliga = m.apparIHuvudet.length;
    const cap = kapVid(bredd);
    if (synliga > cap) f.push(`${synliga} synliga appikoner men bara ${cap} ryms vid ${bredd} px`);
    const varning = synliga < Math.min(cap, antal, max) ? `  VARNING: ${synliga} syns men ${Math.min(cap, antal, max)} hade rymts` : "";
    console.log(`bruk ${String(antal).padStart(1)} appar ${String(bredd).padStart(4)} px: ${synliga} i toppraden (ryms ${cap}), längst ut ${m.langstUt.toFixed(0)} av ${m.inneKant === null ? "?" : m.inneKant.toFixed(0)}${f.length ? `  ROTT: ${f.join(" | ")}` : ""}${varning}`);
    if (antal === 7 && (bredd === 360 || bredd === 768)) console.log(`   ${placering.join(" ")}   (H toppraden, M Meny)`);
    for (const x of f) fel.push(`bruk ${antal} appar ${bredd}: ${x}`);
  }
}

await browser.close();
stada();
if (punkter < 54 + 30) {
  console.error(`huvudmeny-matt: bara ${punkter} mätpunkter, väntat ${54 + 30}. En vakt som mäter färre är grön av att ingenting lästes.`);
  process.exit(1);
}
if (fel.length) {
  console.error(`\nhuvudmeny-matt: ${fel.length} brott.\n${fel.map((x) => `  - ${x}`).join("\n")}`);
  process.exit(1);
}
console.log(`huvudmeny-matt: ${punkter} mätpunkter, inga brott.`);
process.exit(0);
