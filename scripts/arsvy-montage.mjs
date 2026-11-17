#!/usr/bin/env node
/**
 * Skärmbilder av årsvyn (0.237.0, cllp/lifehub.app#874): knappen "Visa året" i verktygsraden och året i helskärm, 390 och 1280 px, ljust och mörkt, mot en byggd dist.
 *
 * Kör: npm run build && node scripts/arsvy-montage.mjs --ut <katalog>
 * Förval för katalogen: docs/bilder/0.237.0-arsvy.
 *
 * ⛔ Ärendet citerar ingen SessionStudio-bild (SessionStudio har ingen årsvy), så regel 12 kräver inget montage mot en förebild. Bilderna visar vad som ritas.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { startaWebblasare } from "./lib/matVyport.mjs";
import { byggYta } from "./lib/byggYta.mjs";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const i = process.argv.indexOf("--ut");
const ut = path.resolve(i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : path.join(rot, "docs", "bilder", "0.237.0-arsvy"));
fs.mkdirSync(ut, { recursive: true });
if (!fs.existsSync(path.join(rot, "dist", "index.js"))) {
  console.error("arsvy-montage: dist/index.js saknas. Kör npm run build först.");
  process.exit(1);
}

const { sida, stada } = await byggYta({ rot, yta: "scripts/lib/arsvy-yta.jsx", namn: "arsvy-montage" });
const { browser, varifran } = await startaWebblasare();
console.log(`webbläsare: ${varifran}`);

/** @type {Array<[number, number, "light" | "dark"]>} */
const LAGEN = [
  [390, 844, "light"],
  [390, 844, "dark"],
  [1280, 900, "light"],
  [1280, 900, "dark"],
];
for (const [bredd, hojd, tema] of LAGEN) {
  const context = await browser.newContext({ viewport: { width: bredd, height: hojd }, deviceScaleFactor: 2, colorScheme: tema });
  try {
    const page = await context.newPage();
    await page.setContent(sida);
    await page.waitForSelector("[data-kalender-arsvy]");
    const rad = await page.evaluate(() => {
      const b = /** @type {HTMLElement} */ (document.querySelector("[data-kalender-arsvy]")).closest("div")?.getBoundingClientRect();
      return b ? { x: 0, y: Math.max(0, b.top - 8), width: window.innerWidth, height: b.height + 16 } : null;
    });
    if (rad) await page.screenshot({ path: path.join(ut, `verktygsrad-${bredd}-${tema}.png`), clip: rad });
    await page.click("[data-kalender-arsvy]");
    await page.waitForSelector("[data-ops-arsvy]");
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(ut, `aret-${bredd}-${tema}.png`) });
    console.log(`verktygsrad-${bredd}-${tema}.png, aret-${bredd}-${tema}.png`);
  } finally {
    await context.close();
  }
}
await browser.close();
stada();
