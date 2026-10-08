/**
 * Skärmbilder av biblioteket mot en byggd dist, för montaget (regel 12).
 *
 * Kör: npm run build && node scripts/bibliotek-montage.mjs
 * Webbläsaren är den startaWebblasare hittar. Ingen webbläsare installeras här.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { startaWebblasare } from "./lib/matVyport.mjs";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(rot, "dist", "index.js");
const tokensFil = path.join(rot, "tokens", "tokens.css");
const ut = path.join(rot, "docs", "jamforelser", "0.79.0");
fs.mkdirSync(ut, { recursive: true });

if (!fs.existsSync(dist)) {
  console.error("bibliotek-montage: dist/index.js saknas. Kör npm run build först.");
  process.exit(1);
}

const arbetsmapp = fs.mkdtempSync(path.join(rot, "node_modules", ".ops-bibliotek-"));
const entry = fs.readFileSync(path.join(rot, "scripts", "lib", "bibliotek-yta.jsx"), "utf8").replace("OPS_DIST", dist.replace(/\\/g, "/"));
const entryFil = path.join(arbetsmapp, "entry.jsx");
fs.writeFileSync(entryFil, entry);
const js = await build({
  entryPoints: [entryFil],
  bundle: true,
  write: false,
  format: "iife",
  jsx: "automatic",
  platform: "browser",
  target: ["es2022"],
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "error",
});
const distSkannad = path.join(arbetsmapp, "dist-skannad.js");
fs.writeFileSync(distSkannad, fs.readFileSync(dist, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/[^\n]*$/gm, " "));
const cssRatt = (
  await postcss([tailwind()]).process(
    `@import "tailwindcss" source(none);\n@import "${tokensFil.replace(/\\/g, "/")}";\n@source "${distSkannad.replace(/\\/g, "/")}";\n@source "${entryFil.replace(/\\/g, "/")}";\n`,
    { from: path.join(arbetsmapp, "app.css") },
  )
).css;
const fontData = fs.readFileSync(path.join(rot, "fonts", "glacial-indifference", "glacial-indifference-400.woff2")).toString("base64");
const css = cssRatt.replace(/url\(["']?[^)"']*glacial-indifference-400\.woff2["']?\)/g, `url(data:font/woff2;base64,${fontData})`);

const sida = (lage) =>
  `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body class="bg-canvas text-ink font-sans"><div id="root"></div><script>window.__bibliotek=${JSON.stringify(lage)};</script><script>${js.outputFiles[0].text.replace(/<\/script>/g, "<\\/script>")}</script></body></html>`;

const { browser, varifran } = await startaWebblasare();
console.log(`webbläsare: ${varifran}`);

for (const [namn, lage, viewport] of [
  ["bibliotek-lista-390", "lista", { width: 390, height: 844 }],
  ["bibliotek-lista-1024", "lista", { width: 1024, height: 900 }],
  ["bibliotek-detalj-390", "detalj", { width: 390, height: 844 }],
  ["bibliotek-lank-las-390", "lank", { width: 390, height: 844 }],
  ["bibliotek-ny-1024", "ny", { width: 1024, height: 900 }],
]) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const fel = [];
  page.on("pageerror", (e) => fel.push(e.message));
  await page.setContent(sida(lage), { waitUntil: "load" });
  await page.waitForSelector("[data-bibliotek]");
  if (fel.length) throw new Error(fel.join("\n"));
  const fil = path.join(ut, `${namn}.png`);
  await page.locator("[data-bibliotek]").screenshot({ path: fil });
  console.log(fil);
  await context.close();
}

const forebild = path.join(ut, "ss-bibliotek-butik.png");
if (fs.existsSync(forebild)) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const vanster = fs.readFileSync(path.join(ut, "bibliotek-lista-390.png")).toString("base64");
  const hoger = fs.readFileSync(forebild).toString("base64");
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 0; background: #f4f1ea; font-family: sans-serif; color: #1c1915; }
    .rad { display: flex; gap: 24px; padding: 24px; align-items: flex-start; }
    figure { margin: 0; }
    figcaption { font-size: 14px; margin-bottom: 8px; }
    img { max-height: 820px; width: auto; border: 1px solid #d9d3c7; background: white; }
  </style></head><body><div class="rad">
    <figure><figcaption>Ramverket, 390 px, Playwright mot byggd dist</figcaption><img src="data:image/png;base64,${vanster}" alt="Ramverkets bibliotek"></figure>
    <figure><figcaption>SessionStudio, butiksbild av biblioteket</figcaption><img src="data:image/png;base64,${hoger}" alt="SessionStudios bibliotek"></figure>
  </div></body></html>`);
  await page.locator(".rad").screenshot({ path: path.join(ut, "bibliotek-lista-390-ramverk-ss.png") });
  console.log(path.join(ut, "bibliotek-lista-390-ramverk-ss.png"));
  await context.close();
}

await browser.close();
fs.rmSync(arbetsmapp, { recursive: true, force: true });
