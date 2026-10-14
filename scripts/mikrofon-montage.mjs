/**
 * Skärmbilder av bottenraden med mikrofonen och långtrycken (0.103.0) mot en byggd dist, 390 px i mörkt läge:
 *   - `ramverk-mikrofon-390.png`: bottenraden med mikrofonen i mitten, Inkorgen och gruppikonen i huvudet.
 *   - `ramverk-tips-390.png`: tipsraden efter första vanliga trycket på Kalender.
 *   - `ramverk-kalender-hall-390.png`: Ny händelse efter ett långtryck på Kalender, med dagen formuläret fick.
 *
 * CP 2026-10-14, "kör": "Långpress på ikoner och TALK med Microfon-ikon direkt". Bilderna är ramverket ensamt: beslutet citerar
 * ingen SessionStudio-skärmbild, så det finns ingen förebild att ställa bredvid (regel 12).
 *
 * Kör: npm run build && node scripts/mikrofon-montage.mjs
 * Webbläsaren är den startaWebblasare hittar. Ingen webbläsare installeras här.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { byggYta } from "./lib/byggYta.mjs";
import { LANGTRYCK_MS } from "../src/lib/apparark.js";
import { startaWebblasare } from "./lib/matVyport.mjs";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ut = path.join(rot, "docs", "jamforelser", "0.103.0");
fs.mkdirSync(ut, { recursive: true });

const { sida, stada } = await byggYta({ rot, yta: path.join("scripts", "lib", "mikrofon-yta.jsx"), namn: "mikrofon" });
try {
  const { browser, varifran } = await startaWebblasare();
  console.log(`webbläsare: ${varifran}`);
  const viewport = { width: 390, height: 844 };
  /** @param {string} namn @param {(page: import("playwright").Page) => Promise<void>} steg */
  const bild = async (namn, steg) => {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: "dark" });
    const page = await context.newPage();
    /** @type {string[]} */
    const fel = [];
    page.on("pageerror", (e) => fel.push(e.message));
    await page.setContent(sida, { waitUntil: "load" });
    await page.locator("[data-talk-knapp]").waitFor();
    await steg(page);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);
    if (fel.length) throw new Error(`${namn}: ${fel.join("\n")}`);
    const fil = path.join(ut, `ramverk-${namn}.png`);
    await page.screenshot({ path: fil });
    console.log(fil);
    await context.close();
  };
  const kalender = (/** @type {import("playwright").Page} */ page) => page.locator("nav[aria-label='Snabbnavigering'] a[href='/kalender']");

  await bild("mikrofon-390", async (page) => {
    const m = await page.locator("[data-talk-knapp]").evaluate((b) => ({ namn: b.getAttribute("aria-label"), lage: b.getAttribute("data-talk-knapp") }));
    if (m.namn !== "TALK, prata in" || m.lage !== "vila") throw new Error(`mittknappen: ${JSON.stringify(m)}, väntat "TALK, prata in" i vila`);
  });
  await bild("tips-390", async (page) => {
    await kalender(page).click();
    await page.locator("[data-skapa-genvag-tips]").waitFor();
  });
  await bild("kalender-hall-390", async (page) => {
    const r = await kalender(page).boundingBox();
    if (!r) throw new Error("Kalender har ingen yta");
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(LANGTRYCK_MS + 150);
    await page.mouse.up();
    await page.getByRole("region", { name: "Ny händelse" }).waitFor();
  });
  await browser.close();
} finally {
  stada();
}
