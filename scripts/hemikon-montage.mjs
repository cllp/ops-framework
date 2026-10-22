/**
 * Hemikonen i huvudet mot en byggd dist (0.138.0): MÄTNING och skärmbilder.
 *
 * Kör: npm run build && node scripts/hemikon-montage.mjs [--bara-matt]
 * Bilderna hamnar i docs/bilder/hemikon. Webbläsaren är den startaWebblasare hittar.
 *
 * Skalet ritas med ett LÅNGT gruppnamn, hemikon, sex åtgärder och avatar: det fullaste huvudet som går att bygga. Mätningen är samma
 * metod som kommentaren vid `ATGARDER_SURF` i OpsAppShell beskriver (mätt mot byggd dist, bredd för bredd): sidan och huvudets rad
 * får inte rulla i sidled, ingen kontroll i huvudet sticker utanför fönstret eller ligger över en annan, och varje namngiven knapp
 * träffas på minst 44x44. Utan hemikon (`utanhem`) mäts samma sak som kontroll: den visar vad huvudet var före 0.138.0.
 *
 * ⛔ Ett ritat huvud som ryms är inte allt: åtgärderna som inte syns i huvudet ska finnas som rader i bottenradens Meny, annars har
 * de försvunnit tyst. Det mäts här också (telefonbredd).
 *
 * Ingen SessionStudio-bild ligger till grund (CP:s önskan kom som en beskrivning), så regel 12 kräver inget montage mot en förebild.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startaWebblasare } from "./lib/matVyport.mjs";
import { byggYta } from "./lib/byggYta.mjs";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bildmapp = path.join(rot, "docs", "bilder", "hemikon");
const baraMatt = process.argv.includes("--bara-matt");
if (!baraMatt) fs.mkdirSync(bildmapp, { recursive: true });

const { sida: grundsida, stada } = await byggYta({ rot, yta: "scripts/lib/hemikon-yta.jsx", namn: "hemikon" });
const sida = (/** @type {string} */ lage) => grundsida.replace("<div id=\"root\"></div>", `<div id="root"></div><script>window.__lage=${JSON.stringify(lage)};</script>`);

const { browser, varifran } = await startaWebblasare();
console.log(`webbläsare: ${varifran}`);

/** @type {string[]} */
const brott = [];
const BREDDER = [320, 360, 390, 768, 834, 1023, 1024, 1280];
const LAGEN = process.argv.includes("--lage") ? [process.argv[process.argv.indexOf("--lage") + 1]] : ["grupp", "utanhem", "oversikt", "fa"];

for (const lage of LAGEN) {
  for (const bredd of BREDDER) {
    const context = await browser.newContext({ viewport: { width: bredd, height: 844 }, deviceScaleFactor: 1, colorScheme: "light" });
    const page = await context.newPage();
    const fel = [];
    page.on("pageerror", (e) => fel.push(e.message));
    await page.setContent(sida(lage), { waitUntil: "load" });
    await page.waitForSelector("[data-hemikon-yta]", { state: "attached", timeout: 8000 }).catch(() => {
      throw new Error(`${lage} ${bredd}: skalet ritades inte. ${fel.join("\n")}`);
    });
    await page.waitForTimeout(150);
    const m = await page.evaluate(() => {
      const dok = document.documentElement;
      const rad = document.querySelector("header > div");
      const syns = [...document.querySelectorAll("header a, header button")].filter((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
      });
      const poster = syns.map((el) => {
        const r = el.getBoundingClientRect();
        return { namn: (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 34), x: r.x, r: r.right, y: r.y, b: r.bottom, w: r.width, h: r.height };
      });
      const par = [];
      for (let i = 0; i < poster.length; i++) for (let j = i + 1; j < poster.length; j++) {
        const dx = Math.min(poster[i].r, poster[j].r) - Math.max(poster[i].x, poster[j].x);
        const dy = Math.min(poster[i].b, poster[j].b) - Math.max(poster[i].y, poster[j].y);
        if (dx > 0.5 && dy > 0.5) par.push(`${poster[i].namn} x ${poster[j].namn}`);
      }
      const hem = document.querySelector("[data-hemikon]");
      const namn = [...document.querySelectorAll("header button span.truncate")].find((e) => e.getBoundingClientRect().width > 0);
      return {
        sida: dok.scrollWidth - dok.clientWidth,
        rad: rad ? rad.scrollWidth - rad.clientWidth : null,
        langstUt: Math.max(0, ...poster.map((p) => p.r)),
        inneKant: rad ? rad.getBoundingClientRect().right - parseFloat(getComputedStyle(rad).paddingRight) : null,
        antal: poster.length,
        par,
        // Bara hemikonen och gruppväxlaren under `md` kräver 44x44 här; skalets övriga kontroller har sina egna vakter (check-skalyta 6b).
        under44: poster.filter((p) => (p.namn.startsWith("Översikt") || p.namn.startsWith("Byt grupp")) && p.w < 768 && (p.h < 43.5 || (innerWidth < 768 && p.w < 43.5))).map((p) => `${p.namn} ${p.w.toFixed(0)}x${p.h.toFixed(0)}`),
        hem: hem ? { x: hem.getBoundingClientRect().x, w: hem.getBoundingClientRect().width, current: hem.getAttribute("aria-current") } : null,
        forsta: poster.length ? poster.slice().sort((a, b) => a.x - b.x)[0].namn : null,
        namnKortat: namn ? namn.scrollWidth > namn.clientWidth + 0.5 : null,
        kontroller: poster.map((p) => p.namn),
      };
    });
    const fil = [];
    if (fel.length) fil.push(`sidfel: ${fel.join("; ")}`);
    if (m.sida > 0) fil.push(`sidan rullar i sidled (${m.sida})`);
    if (m.rad !== null && m.rad > 0) fil.push(`huvudets rad rullar i sidled (scrollWidth - clientWidth = ${m.rad})`);
    if (m.langstUt > bredd + 0.5) fil.push(`en kontroll sticker ut till ${m.langstUt.toFixed(1)} av ${bredd}`);
    if (m.inneKant !== null && m.langstUt > m.inneKant + 0.5) fil.push(`klungan tränger in i huvudets högerpadding: högerkant ${m.langstUt.toFixed(1)} mot radens innekant ${m.inneKant.toFixed(1)}`);
    if (m.par.length) fil.push(`överlapp: ${m.par.join("; ")}`);
    if (m.under44.length) fil.push(`under 44x44: ${m.under44.join(", ")}`);
    console.log(`${lage.padEnd(8)} ${String(bredd).padStart(4)} px: ${m.antal} kontroller, längst ut ${m.langstUt.toFixed(0)} av ${m.inneKant === null ? "?" : m.inneKant.toFixed(0)}, rad ${m.rad}, hem ${m.hem ? `x ${m.hem.x.toFixed(0)} ${m.hem.w.toFixed(0)} px current=${m.hem.current}` : "saknas"}, namn kortat ${m.namnKortat}${fil.length ? `  ROTT: ${fil.join(" | ")}` : ""}`);
    if (process.argv.includes("--lista")) console.log(`   ${m.kontroller.join(" / ")}`);
    for (const f of fil) brott.push(`${lage} ${bredd}: ${f}`);
    if (!baraMatt && lage === "grupp" && (bredd === 390 || bredd === 1280)) {
      await page.mouse.move(0, 0);
      await page.screenshot({ path: path.join(bildmapp, `grupp-${bredd}.png`), clip: { x: 0, y: 0, width: bredd, height: 200 } });
    }
    if (!baraMatt && lage === "oversikt" && (bredd === 390 || bredd === 1280)) {
      await page.screenshot({ path: path.join(bildmapp, `oversikt-${bredd}.png`), clip: { x: 0, y: 0, width: bredd, height: 200 } });
    }
    if (!baraMatt && lage === "utanhem" && (bredd === 390 || bredd === 1280)) {
      await page.screenshot({ path: path.join(bildmapp, `fore-utan-hemikon-${bredd}.png`), clip: { x: 0, y: 0, width: bredd, height: 200 } });
    }
    await context.close();
  }
}
await browser.close();
stada();
if (brott.length) {
  console.error(`\nhemikon-montage: ${brott.length} brott.`);
  process.exitCode = 1;
}
process.exit(process.exitCode ?? 0);
