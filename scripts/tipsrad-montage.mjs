#!/usr/bin/env node
/**
 * Skärmbilder av tipsraden ("Tips: håll in Kalender ..."), 390 och 1280 px, ljust och mörkt tema. CP 2026-10-23: "man ser
 * knappt den rutan som kommer upp". Ytan är samma som mikrofonmontagets. Från 768 px visas raden inte (`md:hidden`), och
 * bilden i 1280 visar just det. Kör `npm run build` först. Valfri första parameter: mappen bilderna hamnar i.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { byggYta } from "./lib/byggYta.mjs";
import { startaWebblasare } from "./lib/matVyport.mjs";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(fs.readFileSync(path.join(rot, "package.json"), "utf8")).version;
const ut = process.argv[2] ? path.resolve(process.argv[2]) : path.join(rot, "docs", "jamforelser", version);
fs.mkdirSync(ut, { recursive: true });

const { sida, stada } = await byggYta({ rot, yta: path.join("scripts", "lib", "mikrofon-yta.jsx"), namn: "tipsrad" });
try {
  const { browser } = await startaWebblasare();
  for (const bredd of [390, 1280]) {
    for (const tema of /** @type {const} */ (["light", "dark"])) {
      const context = await browser.newContext({ viewport: { width: bredd, height: bredd < 768 ? 844 : 800 }, deviceScaleFactor: 2, colorScheme: tema });
      const page = await context.newPage();
      await page.setContent(sida, { waitUntil: "load" });
      const kal = page.locator("nav[aria-label='Snabbnavigering'] a[href='/kalender']").first();
      if (bredd < 768) {
        await kal.click();
        await page.locator("[data-skapa-genvag-tips]").waitFor();
      } else if (await kal.isVisible()) {
        await kal.click();
      }
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);
      const fil = path.join(ut, `tipsrad-${tema === "light" ? "ljus" : "mork"}-${bredd}.png`);
      await page.screenshot({ path: fil });
      console.log(fil);
      await context.close();
    }
  }
  await browser.close();
} finally {
  stada();
}
