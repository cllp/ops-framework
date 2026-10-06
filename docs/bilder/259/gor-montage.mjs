#!/usr/bin/env node
/**
 * Montaget till #259 skiva 1 (regel 12): förebild 3 ur SessionStudio-appen och ramverkets kalender sida vid sida, plus ett
 * förstorat utsnitt av samma veckor, så att brickornas läge går att jämföra utan att zooma; och i bred vy förebild 6 ur SS webb
 * (mörkt tema) bredvid ramverket i 1280 px, mörkt tema.
 *
 * Ramverkets bilder tas av `check-skalyta` (avsnitt 41) mot den byggda `dist`, i 393 px och skala 3 (samma mått som förebilden,
 * 1179 x 2556), och i 1280 px:
 *
 *   npm run build && node scripts/check-skalyta.mjs --bilder <mapp>
 *   node docs/bilder/259/gor-montage.mjs <mapp>
 *
 * Skriver `montage-393.png`, `montage-393-utsnitt.png` och `montage-1280.png` i den här mappen.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { startaWebblasare } from "../../../scripts/lib/matVyport.mjs";

const har = path.dirname(fileURLToPath(import.meta.url));
const mapp = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!mapp) {
  console.error("gor-montage: ange mappen som check-skalyta --bilder skrev till.");
  process.exit(1);
}
const ss = path.join(har, "ss-lager-och-tillganglighet-mobil-3.png");
const ram393 = path.join(mapp, "tillganglighet-393.png");
const ssWebb = path.join(har, "ss-tillganglighet-webb-6.png");
const ram1280 = path.join(mapp, "tillganglighet-1280-mork.png");
for (const f of [ss, ram393, ssWebb, ram1280]) {
  if (!fs.existsSync(f)) {
    console.error(`gor-montage: ${f} saknas.`);
    process.exit(1);
  }
}
const data = (/** @type {string} */ f) => `data:image/png;base64,${fs.readFileSync(f).toString("base64")}`;

const { browser } = await startaWebblasare();
const page = await browser.newPage({ viewport: { width: 1240, height: 1400 }, deviceScaleFactor: 2 });

/**
 * @param {string} a @param {string} b @param {string} rubrikA @param {string} rubrikB
 * @param {{ y: number, h: number } | null} utsnitt I förebildens pixlar (1179 bred).
 * @param {number} [bredd] Varje bilds bredd i montaget.
 */
const sida = (a, b, rubrikA, rubrikB, utsnitt, bredd = 600) => {
  const bild = (/** @type {string} */ src) =>
    utsnitt
      ? `<div style="width:${bredd}px;height:${Math.round((utsnitt.h / 1179) * bredd)}px;overflow:hidden;position:relative;border:1px solid #ccc"><img src="${src}" style="position:absolute;left:0;top:${-Math.round((utsnitt.y / 1179) * bredd)}px;width:${bredd}px"></div>`
      : `<img src="${src}" style="width:${bredd}px;border:1px solid #ccc;display:block">`;
  return `<!doctype html><html><body style="margin:0;padding:16px;background:#fff;font:600 16px system-ui"><div style="display:flex;gap:16px">
    <figure style="margin:0"><figcaption style="margin-bottom:8px">${rubrikA}</figcaption>${bild(a)}</figure>
    <figure style="margin:0"><figcaption style="margin-bottom:8px">${rubrikB}</figcaption>${bild(b)}</figure>
  </div></body></html>`;
};

async function skriv(/** @type {string} */ html, /** @type {string} */ ut) {
  await page.setContent(html);
  await page.waitForTimeout(200);
  const r = await page.evaluate(() => { const b = document.body.getBoundingClientRect(); return { w: Math.ceil(b.width), h: Math.ceil(document.body.scrollHeight) }; });
  await page.setViewportSize({ width: r.w, height: r.h });
  await page.screenshot({ path: path.join(har, ut), fullPage: true });
}

await skriv(sida(data(ss), data(ram393), "SessionStudio-appen (förebild 3, CP 2026-10-06)", "Ramverket 0.61.0, 393 px i skala 3", null), "montage-393.png");
// Utsnittet: september 2026, raderna med lager och borta (förebildens y 400 till 1250 i bildpixlar, alltså 133 till 417 pt).
await skriv(sida(data(ss), data(ram393), "SessionStudio-appen, september", "Ramverket, september", { y: 560, h: 1050 }), "montage-393-utsnitt.png");
await page.setViewportSize({ width: 1240, height: 1400 });
await skriv(sida(data(ssWebb), data(ram1280), "SessionStudio webb (förebild 6, CP 2026-10-06), mörkt tema", "Ramverket 0.61.0, 1280 px, mörkt tema", null, 900), "montage-1280.png");
await browser.close();
console.log("gor-montage: montage-393.png, montage-393-utsnitt.png och montage-1280.png skrivna.");
