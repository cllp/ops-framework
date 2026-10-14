/**
 * Skärmbilder av bottenraden med mikrofonen och långtrycken (0.103.0) mot en byggd dist, 390 px i mörkt läge:
 *   - `ramverk-mikrofon-390.png`: bottenraden med mikrofonen i mitten, Inkorgen och gruppikonen i huvudet.
 *   - `ramverk-mikrofon-ljus-390.png`: samma i ljust läge. (0.104.0) Mikrofonen ensam, utan plus, i båda.
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
import { kravPaMittknappen, matMittknappen } from "./lib/mittknappMatt.mjs";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// ⛔ 0.104.0: bilderna hamnar under versionen som byggs, så att en ny körning inte skriver över förra versionens bilder.
const version = JSON.parse(fs.readFileSync(path.join(rot, "package.json"), "utf8")).version;
const ut = path.join(rot, "docs", "jamforelser", version);
fs.mkdirSync(ut, { recursive: true });

const { sida, stada } = await byggYta({ rot, yta: path.join("scripts", "lib", "mikrofon-yta.jsx"), namn: "mikrofon" });
try {
  const { browser, varifran } = await startaWebblasare();
  console.log(`webbläsare: ${varifran}`);
  const viewport = { width: 390, height: 844 };
  /** @param {string} namn @param {(page: import("playwright").Page) => Promise<void>} steg @param {"dark" | "light"} [colorScheme] */
  const bild = async (namn, steg, colorScheme = "dark") => {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme });
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

  /**
   * ⛔ 0.104.0: mikrofonen ensam, utan plus (CP 2026-10-14: "Den ser bara skräpig ut."). Mätningen och kraven är samma som i
   * `check-skalyta.mjs` avsnitt 39 (`scripts/lib/mittknappMatt.mjs`). Talen skrivs ut, så att den som läser körningen ser vad som mättes.
   * @param {import("playwright").Page} page
   */
  const mittknappen = async (page) => {
    const m = await page.locator("[data-talk-knapp]").evaluate(matMittknappen);
    const vantat = "TALK, prata in. Håll inne för att skapa";
    if (m.namn !== vantat || m.lage !== "vila") throw new Error(`mittknappen: ${JSON.stringify(m)}, väntat ${JSON.stringify(vantat)} i vila`);
    const { rader, fel } = kravPaMittknappen(m);
    for (const rad of rader) console.log(`  ${rad}`);
    if (fel.length) throw new Error(`mittknappen:\n  ${fel.join("\n  ")}`);
  };
  await bild("mikrofon-390", mittknappen);
  await bild("mikrofon-ljus-390", mittknappen, "light");
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
