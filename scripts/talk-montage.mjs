/**
 * Skärmbilder av TALK-fältets val mot en byggd dist (0.105.0): det sagda och valen Meddelande, Händelse, Ärende och Agent efter Klar.
 * 390 px och 1280 px, mörkt läge. (0.103.0 tog bilder av kvittot efter två omgångar med Svara. Svara är borta i 0.105.0.)
 *
 * Kör: npm run build && node scripts/talk-montage.mjs
 * Webbläsaren är den startaWebblasare hittar. Ingen webbläsare installeras här.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { byggYta } from "./lib/byggYta.mjs";
import { startaWebblasare } from "./lib/matVyport.mjs";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ut = path.join(rot, "docs", "jamforelser", "0.105.0");
fs.mkdirSync(ut, { recursive: true });

// Bygget av sidan är delat med `mikrofon-montage.mjs` (0.103.0), se `scripts/lib/byggYta.mjs`.
const { sida, stada } = await byggYta({ rot, yta: path.join("scripts", "lib", "talk-yta.jsx"), namn: "talk" });
try {
  const { browser, varifran } = await startaWebblasare();
  console.log(`webbläsare: ${varifran}`);
  for (const [namn, viewport] of /** @type {const} */ ([
    ["val-390", { width: 390, height: 844 }],
    ["val-1280", { width: 1280, height: 800 }],
  ])) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: "dark" });
    const page = await context.newPage();
    /** @type {string[]} */
    const fel = [];
    page.on("pageerror", (e) => fel.push(e.message));
    await page.setContent(sida, { waitUntil: "load" });
    // Vägen in är den personen tar: mikrofonen i huvudet på dator, bottenradens mikrofon på telefon (0.103.0: ett tryck räcker).
    if (viewport.width >= 768) {
      await page.locator("[data-talk-huvud]").click();
    } else {
      await page.locator("[data-talk-knapp]").click();
    }
    await page.getByRole("button", { name: "Klar, spara inspelningen" }).click();
    await page.locator("[data-talk-val]").waitFor();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);
    if (fel.length) throw new Error(`${namn}: ${fel.join("\n")}`);
    const fil = path.join(ut, `ramverk-${namn}.png`);
    await page.screenshot({ path: fil });
    console.log(fil);
    await context.close();
  }
  await browser.close();
} finally {
  stada();
}
