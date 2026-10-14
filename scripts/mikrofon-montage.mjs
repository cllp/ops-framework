/**
 * Skärmbilder av bottenraden med mikrofonen och långtrycken (0.103.0) mot en byggd dist, 390 px i mörkt läge:
 *   - `ramverk-mikrofon-390.png`: bottenraden med mikrofonen i mitten, Inkorgen och gruppikonen i huvudet.
 *   - `ramverk-mikrofon-ljus-390.png`: samma i ljust läge. (#382) Plusmärket i mikrofonens hörn ska gå att läsa i båda.
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
   * ⛔ #382: mikrofonen bär ett plus när ett långtryck öppnar skapa. Mätt i bilden: märket finns, ligger inom knappens cirkel och
   * överlappar inte mikrofonens ritning. Talen skrivs ut, så att den som läser körningen ser vad som mättes.
   * @param {import("playwright").Page} page
   */
  const mittknappen = async (page) => {
    const m = await page.locator("[data-talk-knapp]").evaluate((b) => {
      const ruta = (/** @type {Element | null} */ el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, b: r.width, h: r.height };
      };
      return {
        namn: b.getAttribute("aria-label"),
        lage: b.getAttribute("data-talk-knapp"),
        knapp: ruta(b),
        marke: ruta(b.querySelector("[data-skapa-marke]")),
        ikon: ruta(b.querySelector("[data-skapa-ikon] svg")),
        // Varje del av mikrofonens ritning (kapseln, bågen, foten) för sig: svg-rutan är större än det som syns.
        delar: [...b.querySelectorAll("[data-skapa-ikon] svg > *")].map(ruta),
        // Rutorna ovan är ritningens geometri utan streck. Halva strecket (i skärmens px) läggs på varje sida nedan.
        streck: (() => {
          const svg = b.querySelector("[data-skapa-ikon] svg");
          if (!svg) return 0;
          const vb = /** @type {SVGSVGElement} */ (svg).viewBox.baseVal;
          return Number.parseFloat(getComputedStyle(svg).strokeWidth) * (svg.getBoundingClientRect().width / (vb?.width || 24));
        })(),
      };
    });
    const vantat = "TALK, prata in. Håll inne för att skapa";
    if (m.namn !== vantat || m.lage !== "vila") throw new Error(`mittknappen: ${JSON.stringify(m)}, väntat ${JSON.stringify(vantat)} i vila`);
    if (!m.knapp || !m.marke || !m.ikon) throw new Error(`mittknappen saknar plusmärke eller ikon: ${JSON.stringify(m)}`);
    const radie = m.knapp.b / 2;
    const mitt = { x: m.knapp.x + radie, y: m.knapp.y + radie };
    const markeMitt = { x: m.marke.x + m.marke.b / 2, y: m.marke.y + m.marke.h / 2 };
    const ytterkant = Math.hypot(markeMitt.x - mitt.x, markeMitt.y - mitt.y) + m.marke.b / 2;
    // Märket med sin ring (2 px i knappens färg), mot varje del av mikrofonen. Minsta avståndet ska vara större än noll.
    const ring = 2;
    const ytter = { x: m.marke.x - ring, y: m.marke.y - ring, b: m.marke.b + 2 * ring, h: m.marke.h + 2 * ring };
    const avstand = (/** @type {{ x: number, y: number, b: number, h: number }} */ d) =>
      Math.max(ytter.x - (d.x + d.b), d.x - (ytter.x + ytter.b), ytter.y - (d.y + d.h), d.y - (ytter.y + ytter.h));
    const halv = m.streck / 2;
    const delar = m.delar.filter((d) => d && d.b > 0 && d.h > 0).map((d) => {
      const r = /** @type {{ x: number, y: number, b: number, h: number }} */ (d);
      return { x: r.x - halv, y: r.y - halv, b: r.b + 2 * halv, h: r.h + 2 * halv };
    });
    const narmast = Math.min(...delar.map((d) => avstand(/** @type {any} */ (d))));
    console.log(`  plusmärket ${m.marke.b}x${m.marke.h} px, ytterkant med ring ${(ytterkant + ring).toFixed(1)} px från mitten (knappens radie ${radie}), ikonen ${m.ikon.b} px i ${delar.length} delar med ${m.streck} px streck, närmast ${narmast.toFixed(1)} px från märkets ring`);
    if (delar.length < 2) throw new Error(`mikrofonens ritning har ${delar.length} delar, väntat minst 2: mätningen mäter inget`);
    if (ytterkant + ring > radie) throw new Error(`plusmärket med ring går ${(ytterkant + ring - radie).toFixed(1)} px utanför knappens cirkel`);
    if (m.marke.b < 12) throw new Error(`plusmärket är ${m.marke.b} px, för litet att se`);
    if (narmast <= 0) throw new Error(`plusmärket ligger ovanpå mikrofonen (${narmast.toFixed(1)} px): ${JSON.stringify(m)}`);
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
