#!/usr/bin/env node
/**
 * Montaget till #265 (granskningen av PR 266, KAN 9): hur BEFINTLIGA grupper ändras, före och efter, i ljust och mörkt läge.
 *
 * Före är `origin/main` (0.64.0) och efter är grenen. Båda bilderna tas av `check-skalyta` mot en byggd `dist` och en byggd
 * CSS, alltså en riktig app i Chromium och aldrig jsdom (regel 12):
 *
 *   node scripts/check-skalyta.mjs --dist <main>/dist/index.js --tokens <main>/tokens/tokens.css --bilder <mapp>/fore-ljust
 *   node scripts/check-skalyta.mjs --dist <main>/dist/index.js --tokens <main>/tokens/tokens.css --tema dark --bilder <mapp>/fore-morkt
 *   node scripts/check-skalyta.mjs --bilder <mapp>/efter-ljust
 *   node scripts/check-skalyta.mjs --tema dark --bilder <mapp>/efter-morkt
 *   node docs/bilder/265/gor-montage.mjs <mapp>
 *
 * Grupperna i bilderna har sparade äldre toner ("1" till "6") och äldre ikon-id, precis som befintliga grupper i en app.
 * Skriver `montage-fore-efter-ljust.png` och `montage-fore-efter-morkt.png` i den här mappen: gruppkortet vid 1280 px och
 * gruppsidans rubrik vid 390 px, före till vänster och efter till höger.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { startaWebblasare } from "../../../scripts/lib/matVyport.mjs";

const har = path.dirname(fileURLToPath(import.meta.url));
const mapp = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!mapp) {
  console.error("gor-montage: ange mappen med fore-ljust, fore-morkt, efter-ljust och efter-morkt.");
  process.exit(1);
}
const data = (/** @type {string} */ f) => `data:image/png;base64,${fs.readFileSync(f).toString("base64")}`;
const { browser } = await startaWebblasare();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });

for (const lage of ["ljust", "morkt"]) {
  const bild = (/** @type {string} */ nar, /** @type {string} */ namn) => {
    const f = path.join(mapp, `${nar}-${lage}`, namn);
    if (!fs.existsSync(f)) {
      console.error(`gor-montage: ${f} saknas.`);
      process.exit(1);
    }
    return data(f);
  };
  const bg = lage === "morkt" ? "#181c18" : "#ffffff";
  const fg = lage === "morkt" ? "#e8ece6" : "#222";
  const par = (/** @type {string} */ rubrik, /** @type {string} */ namn, /** @type {number} */ bredd, /** @type {number | null} */ hojd) => `
    <h2 style="margin:16px 0 8px;font:600 15px system-ui">${rubrik}</h2>
    <div style="display:flex;gap:16px">
      ${["fore", "efter"]
        .map(
          (nar) => `<figure style="margin:0"><figcaption style="margin-bottom:6px;font:600 13px system-ui">${nar === "fore" ? "Före (0.64.0)" : "Efter (0.65.0)"}</figcaption>
          <div style="width:${bredd}px;${hojd ? `height:${hojd}px;` : ""}overflow:hidden;border:1px solid #888"><img src="${bild(nar, namn)}" style="width:${bredd}px;display:block"></div></figure>`,
        )
        .join("")}
    </div>`;
  await page.setContent(`<!doctype html><html><body style="margin:0;padding:16px;background:${bg};color:${fg};font:14px system-ui">
    <h1 style="margin:0 0 4px;font:700 18px system-ui">Befintliga grupper före och efter #265, ${lage === "morkt" ? "mörkt" : "ljust"} läge</h1>
    <p style="margin:0">Samma grupper med sparade äldre toner och ikon-id. Kulören är densamma, märket ritas som ikon i färgen på en tonad platta.</p>
    ${par("Gruppkorten i panelen, 1280 px", "gruppkort-1280.png", 300, null)}
    ${par("Gruppsidans rubrik, 390 px", "gruppsida-390.png", 390, 260)}
  </body></html>`);
  await page.waitForTimeout(200);
  const ut = path.join(har, `montage-fore-efter-${lage}.png`);
  await page.screenshot({ path: ut, fullPage: true });
  console.log(`skrev ${path.relative(process.cwd(), ut)}`);
}
await browser.close();
