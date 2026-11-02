/**
 * Taket för appikonerna i toppraden mot en byggd dist (0.177.0): MÄTNING.
 *
 * Kör: npm run build && node scripts/huvudmeny-matt.mjs [--bevisa]   (`npm run check:huvudmeny` kör båda, i `check:all`)
 *
 * ⛔ HÄNDELSEN: CP 2026-11-02 20:58, med en skärmbild från telefonen. Sju appar hade "Visa i huvudmenyn" och toppraden klippte den sista ikonen. Taket
 * `HUVUDMENY_MAX` (src/lib/modulinstallningar.js) är ett tal, och ett tal som ingen mätt är en gissning. Den här mätningen gör två saker.
 *
 *   1. KAPACITET: största antal appikoner som ryms i toppraden vid 320, 360 och 390 px, tillsammans med hemikon, gruppmärke, Inkorg som åtgärd och avatar
 *      (scenen `kapacitet` i scripts/lib/huvudmeny-yta.jsx, där ikonerna INTE bär `kvarIHuvudet` så skalet inte kan kapa dem). "Ryms" är samma mått som
 *      hemikon-montage.mjs: raden rullar inte i sidled, ingen kontroll sticker ut eller ligger över en annan, och klungan tränger inte in i radens högerpadding.
 *      RÖTT när `HUVUDMENY_MAX` är större än kapaciteten vid 360 px: taket lovar då en plats som inte finns. Är taket mindre skrivs det ut som en varning,
 *      eftersom en tom plats är ett val och inget brott. 320 px skrivs ut men fäller inte: den bredden rymmer en ikon mindre och gäller en telefon från 2016.
 *   2. TAKET I BRUK: en grupp med sju fästa appar (CP:s) ritas vid 320 till 1280 px. Toppraden ska rymmas, ha exakt `HUVUDMENY_MAX` appikoner, och resten ska
 *      vara rader i Meny (bottenradens ark under 768 px, huvudets meny från 768 px), så att ingen app försvunnit utan att det syns.
 *
 * ⛔ GOLV: minst 3 bredder x 9 antal i kapacitetsmätningen och 6 bredder i bruket måste ha hittat huvudet och minst en kontroll i det.
 * ⛔ BEVISET ÅT MOTSATT HÅLL (`--bevisa`): samma mätare på taket + 1 appikoner vid 360 px MÅSTE bli röd. En mätare som aldrig sett ikoner klippas är ingen vakt (regel 4).
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

/** @type {string[]} */
const fel = [];
let punkter = 0;

if (bevisa) {
  // Taket + 1 vid 360 px måste klippas, annars mäter mätaren ingenting.
  const forsta = await rita(360, { lage: "kapacitet", antal: 0 });
  const max = (await forsta.page.evaluate(mat)).max;
  await forsta.context.close();
  const { page, context } = await rita(360, { lage: "kapacitet", antal: max + 1 });
  const m = await page.evaluate(mat);
  await context.close();
  const f = brott(m, 360);
  console.log(`bevis: ${max + 1} appikoner (taket + 1) vid 360 px: ${f.length ? `RÖTT som väntat (${f.join(" | ")})` : "GRÖNT, och det är fel"}`);
  await browser.close();
  stada();
  if (f.length === 0) {
    console.error("huvudmeny-matt --bevisa: mätaren blev inte röd för taket + 1 vid 360 px. Den mäter då inte att ikonerna klipps.");
    process.exit(1);
  }
  process.exit(0);
}

// ── 1. KAPACITET ─────────────────────────────────────────────────────────────────────────────────────────
const KAP_BREDDER = [320, 360, 390];
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
if (max > kapacitet[360]) fel.push(`HUVUDMENY_MAX (${max}) är större än vad som ryms vid 360 px (${kapacitet[360]}): taket lovar en plats som inte finns`);
if (max < kapacitet[360]) console.log(`  VARNING: taket (${max}) är lägre än vad som ryms vid 360 px (${kapacitet[360]}). En plats står tom. Höj HUVUDMENY_MAX om det inte är ett val.`);
if (max > kapacitet[320]) console.log(`  OBS: vid 320 px ryms ${kapacitet[320]}, en mindre än taket. Gäller en telefon från 2016 och fäller inte mätningen.`);

// ── 2. TAKET I BRUK ──────────────────────────────────────────────────────────────────────────────────────
const SJU = 7;
for (const bredd of [320, 360, 390, 768, 1024, 1280]) {
  const { page, context, sidfel } = await rita(bredd, { lage: "tak", antal: SJU });
  const m = await page.evaluate(mat);
  /** @type {string[]} */
  const f = [];
  if (sidfel.length) f.push(`sidfel: ${sidfel.join("; ")}`);
  if (m.antal >= 2) punkter++;
  // 320 px rymmer en ikon mindre än taket (se ovan) och mäts för att skrivas ut, inte för att fälla.
  const rymmer = brott(m, bredd);
  const bindande = bredd !== 320;
  if (m.apparIHuvudet.length !== m.max) f.push(`${m.apparIHuvudet.length} appikoner i toppraden, väntat ${m.max}`);
  // Resten ska vara rader i Meny.
  const rest = ["Bibliotek", "Meddelanden", "Ekonomi", "Recept", "Agenter", "Foton", "Planering"].slice(m.max);
  /** @type {string[]} */
  let imeny = [];
  // En Meny utan raderna är ett brott, inte ett kraschat skript: skalet utan taket har ingen "Fler appar".
  try {
    if (bredd < 768) {
      await page.getByRole("navigation", { name: "Snabbnavigering" }).getByRole("button", { name: "Meny" }).click();
      await page.waitForSelector('[role="dialog"]', { timeout: 4000 });
      imeny = await page.$$eval('[role="dialog"] a', (as) => as.map((a) => (a.getAttribute("aria-label") || a.textContent || "").trim()));
    } else {
      await page.locator("header").getByRole("button", { name: /fler åtgärder/ }).click();
      await page.waitForSelector("[data-huvudmeny-overskott]", { timeout: 2000 });
      imeny = await page.$$eval("[data-huvudmeny-overskott] a", (as) => as.map((a) => (a.textContent || "").trim()));
    }
  } catch {
    f.push("Meny gick inte att öppna med raderna för apparna som inte ryms");
  }
  // Raderna bär ikonens initial före namnet (scenens OpsIdentity), så namnet kan stå sist.
  const saknas = rest.filter((n) => !imeny.some((r) => r.endsWith(n)));
  if (saknas.length) f.push(`saknas i Meny: ${saknas.join(", ")} (Meny har ${imeny.join(", ") || "inget"})`);
  await context.close();
  console.log(`tak ${String(bredd).padStart(4)} px: ${m.apparIHuvudet.length} av ${SJU} appikoner i toppraden, ${rest.length - saknas.length} av ${rest.length} i Meny, längst ut ${m.langstUt.toFixed(0)} av ${m.inneKant === null ? "?" : m.inneKant.toFixed(0)}${rymmer.length ? `  ${bindande ? "ROTT" : "OBS"}: ${rymmer.join(" | ")}` : ""}${f.length ? `  ROTT: ${f.join(" | ")}` : ""}`);
  for (const x of f) fel.push(`tak ${bredd}: ${x}`);
  if (bindande) for (const x of rymmer) fel.push(`tak ${bredd}: ${x}`);
}

await browser.close();
stada();
if (punkter < 3 * 9 + 6) {
  console.error(`huvudmeny-matt: bara ${punkter} mätpunkter, väntat ${3 * 9 + 6}. En vakt som mäter färre är grön av att ingenting lästes.`);
  process.exit(1);
}
if (fel.length) {
  console.error(`\nhuvudmeny-matt: ${fel.length} brott.\n${fel.map((x) => `  - ${x}`).join("\n")}`);
  process.exit(1);
}
console.log(`huvudmeny-matt: ${punkter} mätpunkter, inga brott.`);
process.exit(0);
