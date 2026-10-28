#!/usr/bin/env node
/**
 * Skärmbilder av dagens ramar, en och två, i 390 och 1280 px (0.151.0, CP 2026-10-28), mot en byggd dist.
 *
 * Kör: npm run build && node scripts/kalenderramar-montage.mjs --ut <katalog>
 * Förval för katalogen: docs/bilder/0.151.0-kalenderramar. Webbläsaren är den startaWebblasare hittar.
 *
 * ⛔ Ärendet citerar ingen SessionStudio-bild, så regel 12 kräver inget montage mot en förebild. Bilderna visar vad som ritas och bevisar inte att det är rätt: det beviset är
 * `scripts/kalenderramar-matt.mjs`. Veckan 12 till 18 oktober beskärs ut ur kalendern: måndagen har tre kalendrar med ram (två ritas), tisdagen två, onsdagen en,
 * torsdagen ingen, fredagen en ram med hörnbrickor, lördagen fyra kalendrar med ram (två ritas, brickan säger "+2") och söndagen tre ("+1").
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { startaWebblasare } from "./lib/matVyport.mjs";
import { byggYta } from "./lib/byggYta.mjs";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const i = process.argv.indexOf("--ut");
const ut = path.resolve(i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : path.join(rot, "docs", "bilder", "0.151.0-kalenderramar"));
fs.mkdirSync(ut, { recursive: true });
if (!fs.existsSync(path.join(rot, "dist", "index.js"))) {
  console.error("kalenderramar-montage: dist/index.js saknas. Kör npm run build först.");
  process.exit(1);
}

const { sida, stada } = await byggYta({ rot, yta: "scripts/lib/kalenderramar-yta.jsx", namn: "kalenderramar-montage" });
const { browser, varifran } = await startaWebblasare();
console.log(`webbläsare: ${varifran}`);

/** @type {Array<[string, number, string, number]>} namn, bredd, läge, skala */
const BILDER = [
  ["1-en-ram-390", 390, "en", 3],
  ["2-tva-ramar-390", 390, "tva", 3],
  ["3-en-ram-1280", 1280, "en", 2],
  ["4-tva-ramar-1280", 1280, "tva", 2],
  ["5-tva-ramar-320", 320, "tva", 3],
  // Tre kalendrar med ram (måndagen, "+1") och fyra (lördagen, "+2" bredvid tillgänglighetsbrickan), 0.151.0.
  ["6-tre-och-fyra-ramar-390", 390, "tva", 3],
  ["7-tre-och-fyra-ramar-1280", 1280, "tva", 2],
];
for (const [namn, bredd, lage, skala] of BILDER) {
  const context = await browser.newContext({ viewport: { width: bredd, height: 900 }, deviceScaleFactor: skala });
  try {
    const page = await context.newPage();
    await page.setContent(sida.replace('<div id="root"></div>', `<div id="root"></div><script>window.__prov = ${JSON.stringify({ lage })};</script>`));
    await page.waitForSelector('[data-cal-day="2026-10-12"]');
    // Veckan 12 till 18 oktober: från måndagens ruta till söndagens, med lite luft runt.
    const klipp = await page.evaluate(() => {
      const a = /** @type {HTMLElement} */ (document.querySelector('[data-cal-day="2026-10-12"]')).getBoundingClientRect();
      const b = /** @type {HTMLElement} */ (document.querySelector('[data-cal-day="2026-10-18"]')).getBoundingClientRect();
      return { x: Math.max(0, a.left - 8), y: Math.max(0, a.top - 8), width: b.right - a.left + 16, height: Math.max(a.height, b.height) + 16 };
    });
    await page.screenshot({ path: path.join(ut, `${namn}.png`), clip: klipp });
    console.log(`${namn}.png (${bredd} px, läge ${lage}, x${skala})`);
  } finally {
    await context.close();
  }
}
await browser.close();
stada();
