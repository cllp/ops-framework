/**
 * Skärmbild av knappradens felplats mot en byggd dist (0.147.0, cllp/ops-framework#451), 390 px (och 1280 px).
 *
 * Kör: npm run build && node scripts/atgardsfel-montage.mjs
 * Bilderna hamnar i docs/bilder/0.147.0-atgardsfel. Webbläsaren är den startaWebblasare hittar.
 *
 * ⛔ Ärendet citerar ingen SessionStudio-bild, så regel 12 kräver inget montage mot en förebild. Bilden visar vad som ritas; beviset är proven (`radpanel-atgard.test.jsx`).
 * Det bilden visar och proven inte mäter (jsdom kör ingen CSS) är PLATSEN, och den mäts här: felraden ligger i knappraden, ovanför knapparna och inom skärmen,
 * knappraden står kvar på samma ställe när felet kommer (underkanten rör sig inte, raden växer uppåt; mäts vid 390 px där panelen är hela skärmen), och felet bryter rad i stället för att gå utanför kanten.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { startaWebblasare } from "./lib/matVyport.mjs";
import { distUtanKommentarer } from "./lib/dist-text.mjs";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(rot, "dist", "index.js");
const tokensFil = path.join(rot, "tokens", "tokens.css");
const ut = path.join(rot, "docs", "bilder", "0.147.0-atgardsfel");
fs.mkdirSync(ut, { recursive: true });
if (!fs.existsSync(dist)) {
  console.error("atgardsfel-montage: dist/index.js saknas. Kör npm run build först.");
  process.exit(1);
}

const arbetsmapp = fs.mkdtempSync(path.join(rot, "node_modules", ".ops-atgardsfel-"));
const entry = fs.readFileSync(path.join(rot, "scripts", "lib", "atgardsfel-yta.jsx"), "utf8").replace("OPS_DIST", dist.replace(/\\/g, "/"));
const entryFil = path.join(arbetsmapp, "entry.jsx");
fs.writeFileSync(entryFil, entry);
const js = await build({ entryPoints: [entryFil], bundle: true, write: false, format: "iife", jsx: "automatic", platform: "browser", target: ["es2022"], define: { "process.env.NODE_ENV": '"production"' }, logLevel: "error" });
const distSkannad = path.join(arbetsmapp, "dist-skannad.js");
fs.writeFileSync(distSkannad, distUtanKommentarer(dist));
const cssRatt = (
  await postcss([tailwind()]).process(
    `@import "tailwindcss" source(none);\n@import "${tokensFil.replace(/\\/g, "/")}";\n@source "${distSkannad.replace(/\\/g, "/")}";\n@source "${entryFil.replace(/\\/g, "/")}";\n`,
    { from: path.join(arbetsmapp, "app.css") },
  )
).css;
const fontData = fs.readFileSync(path.join(rot, "fonts", "glacial-indifference", "glacial-indifference-400.woff2")).toString("base64");
const css = cssRatt.replace(/url\(["']?[^)"']*glacial-indifference-400\.woff2["']?\)/g, `url(data:font/woff2;base64,${fontData})`);
const sida = (text) =>
  `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body class="bg-canvas text-ink font-sans"><div id="root"></div><script>window.__atgardsfel=${JSON.stringify(text)};</script><script>${js.outputFiles[0].text.replace(/<\/script>/g, "<\\/script>")}</script></body></html>`;

const { browser, varifran } = await startaWebblasare();
console.log(`webbläsare: ${varifran}`);

const TEXT = "Kunde inte nå servern. Kontrollera nätet och försök igen om en stund.";
let brott = 0;
for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: "light" });
  const page = await context.newPage();
  const fel = [];
  page.on("pageerror", (e) => fel.push(e.message));
  await page.setContent(sida(TEXT), { waitUntil: "load" });
  await page.getByRole("button", { name: "Attest större leverantörsfakturor" }).click();
  await page.locator("[data-radpanel]").waitFor();
  const radUnderFore = await page.evaluate(() => Math.round(document.querySelector("[data-knapprad]").getBoundingClientRect().bottom));
  await page.getByRole("button", { name: "Klar" }).click();
  // Väntläget syns medan löftet pågår.
  await page.getByRole("button", { name: /Bockar av/ }).waitFor();
  await page.locator("[data-knapprad-fel]").waitFor();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);
  if (fel.length) throw new Error(fel.join("\n"));

  const m = await page.evaluate(() => {
    const r = (el) => el.getBoundingClientRect();
    const rad = r(document.querySelector("[data-knapprad]"));
    const felRuta = r(document.querySelector("[data-knapprad-fel]"));
    const knappar = r(document.querySelector("[data-knapprad-knappar]"));
    const skal = r(document.querySelector("[data-knapprad-skal]"));
    return {
      radUnder: Math.round(rad.bottom),
      radUnderFore: null,
      radBredd: Math.round(rad.width),
      felOver: Math.round(felRuta.bottom) <= Math.round(knappar.top),
      felInomRaden: felRuta.top >= rad.top - 0.5 && felRuta.bottom <= rad.bottom + 0.5 && felRuta.left >= rad.left - 0.5 && felRuta.right <= rad.right + 0.5,
      felFore: Math.round(felRuta.bottom) <= Math.round(skal.top) + 1,
      felHojd: Math.round(felRuta.height),
      sidled: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  m.radUnderFore = radUnderFore;
  console.log(`mätt vid ${viewport.width} px: ${JSON.stringify(m)}`);
  const problem = [];
  if (!m.felOver) problem.push("felraden ligger inte ovanför knapparna");
  if (!m.felInomRaden) problem.push("felraden går utanför knappraden");
  if (!m.felFore) problem.push("felraden ligger efter skälet till att Dela saknas");
  if (viewport.width === 390 && m.radUnder !== m.radUnderFore) problem.push(`knappraden flyttade sig när felet kom (underkant ${m.radUnderFore} före, ${m.radUnder} efter)`);
  if (m.sidled) problem.push("sidan rullar i sidled");
  if (problem.length) {
    brott += 1;
    console.error(`atgardsfel-montage: ${viewport.width} px: ${problem.join("; ")}`);
  }
  const fil = path.join(ut, `1-felet-i-knappraden-${viewport.width}.png`);
  await page.screenshot({ path: fil });
  console.log(fil);
  await context.close();
}
await browser.close();
fs.rmSync(arbetsmapp, { recursive: true, force: true });
if (brott) process.exit(1);
process.exit(0);
