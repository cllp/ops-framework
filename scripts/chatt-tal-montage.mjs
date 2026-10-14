/**
 * Skärmbild av tal i chatten (0.103.0) mot en byggd dist, 390 px i mörkt läge: `ramverk-chatt-tal-390.png`, agentens samtal medan
 * man pratar, med TALK:s yta i skrivfältets plats och texten som hörs i den.
 *
 * CP 2026-10-14, med en skärmbild av agentchatten: "Sedan funkar inte tal i meddelanden på samma sätt som TALK, det skall skrivas ut
 * text i realtid och inte gå en omväg via textfältet." Förebilden är ramverkets eget TALK-fält (`ramverk-samtal-390.png` från
 * `talk-montage.mjs`), inte en SessionStudio-skärmbild.
 *
 * Kör: npm run build && node scripts/chatt-tal-montage.mjs
 * Webbläsaren är den startaWebblasare hittar. Ingen webbläsare installeras här.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { byggYta } from "./lib/byggYta.mjs";
import { startaWebblasare } from "./lib/matVyport.mjs";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ut = path.join(rot, "docs", "jamforelser", "0.103.0");
fs.mkdirSync(ut, { recursive: true });

const { sida, stada } = await byggYta({ rot, yta: path.join("scripts", "lib", "chatt-tal-yta.jsx"), namn: "chatt-tal" });
try {
  const { browser, varifran } = await startaWebblasare();
  console.log(`webbläsare: ${varifran}`);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: "dark" });
  const page = await context.newPage();
  /** @type {string[]} */
  const fel = [];
  page.on("pageerror", (e) => fel.push(e.message));
  await page.setContent(sida, { waitUntil: "load" });
  await page.getByRole("button", { name: "Prata in" }).click();
  await page.locator('[data-rostyta][data-rostlage="spelar"]').waitFor();
  await page.waitForFunction(() => (document.querySelector("[data-rostyta] [data-talk-text]")?.textContent || "").endsWith("efter lunch"));
  // ⛔ Mätt, inte bara fotograferat: ytan står i fältets plats, fältet är borta, och texten står i ytan.
  const matt = await page.evaluate(() => ({
    text: document.querySelector("[data-rostyta] [data-talk-text]")?.textContent ?? null,
    falt: Boolean(document.querySelector("[data-skrivruta]")),
    knappar: [...document.querySelectorAll("[data-rostyta] button")].map((b) => b.getAttribute("aria-label")),
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  console.log(JSON.stringify(matt));
  if (matt.falt || matt.knappar.join("|") !== "Avbryt|Klar, skicka det du sagt" || matt.over > 0) throw new Error(`ytan: ${JSON.stringify(matt)}`);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
  if (fel.length) throw new Error(fel.join("\n"));
  const fil = path.join(ut, "ramverk-chatt-tal-390.png");
  await page.screenshot({ path: fil });
  console.log(fil);
  await context.close();
  await browser.close();
} finally {
  stada();
}
