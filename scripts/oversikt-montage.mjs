/**
 * Skärmbilder av översikten i skalet mot en byggd dist (0.112.0, cllp/lifehub.app#319).
 *
 * Kör: npm run build && node scripts/oversikt-montage.mjs
 * Webbläsaren är den startaWebblasare hittar. Ingen webbläsare installeras här.
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
const ut = path.join(rot, "docs", "jamforelser", "0.113.0");
fs.mkdirSync(ut, { recursive: true });

if (!fs.existsSync(dist)) {
  console.error("oversikt-montage: dist/index.js saknas. Kör npm run build först.");
  process.exit(1);
}

const arbetsmapp = fs.mkdtempSync(path.join(rot, "node_modules", ".ops-oversikt-"));
const entry = fs.readFileSync(path.join(rot, "scripts", "lib", "oversikt-yta.jsx"), "utf8").replace("OPS_DIST", dist.replace(/\\/g, "/"));
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
fs.writeFileSync(distSkannad, distUtanKommentarer(dist));
const cssRatt = (
  await postcss([tailwind()]).process(
    `@import "tailwindcss" source(none);\n@import "${tokensFil.replace(/\\/g, "/")}";\n@source "${distSkannad.replace(/\\/g, "/")}";\n@source "${entryFil.replace(/\\/g, "/")}";\n`,
    { from: path.join(arbetsmapp, "app.css") },
  )
).css;
const fontData = fs.readFileSync(path.join(rot, "fonts", "glacial-indifference", "glacial-indifference-400.woff2")).toString("base64");
const css = cssRatt.replace(/url\(["']?[^)"']*glacial-indifference-400\.woff2["']?\)/g, `url(data:font/woff2;base64,${fontData})`);

const sida = (lage) =>
  `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body class="bg-canvas text-ink font-sans"><div id="root"></div><script>window.__oversikt=${JSON.stringify(lage)};</script><script>${js.outputFiles[0].text.replace(/<\/script>/g, "<\\/script>")}</script></body></html>`;

const { browser, varifran } = await startaWebblasare();
console.log(`webbläsare: ${varifran}`);
const vyer = [
  ["oversikt", "oversikt", null],
  ["vaxlare", "oversikt", async (page) => {
    await page.getByRole("button", { name: /^Byt grupp, nu: Översikt/ }).click();
    await page.locator("[data-oversikt]").waitFor();
  }],
  ["grupp", "grupp", null],
  ["hem", "hem", null],
  ["hem-idag", "hem", async (page) => {
    await page.getByRole("navigation", { name: "Snabbnavigering" }).getByRole("link", { name: /Idag/ }).click();
    await page.getByRole("heading", { name: /Idag/ }).first().waitFor();
  }],
];
for (const [namn, lage, efter] of vyer) {
  for (const viewport of [{ width: 390, height: 844, mark: "telefon-390" }, { width: 1280, height: 800, mark: "dator-1280" }]) {
    // Bottenraden finns bara under md, så trycket i den fotograferas på telefon.
    if (namn === "hem-idag" && viewport.width >= 768) continue;
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const fel = [];
    page.on("pageerror", (e) => fel.push(e.message));
    await page.setContent(sida(lage), { waitUntil: "load" });
    await page.waitForSelector("[data-oversikt-yta]", { timeout: 8000, state: "attached" }).catch((e) => {
      throw new Error(`${namn}: skalet ritades inte. ${fel.join("\n") || e.message}`);
    });
    if (efter) await efter(page);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);
    if (fel.length) throw new Error(`${namn}: ${fel.join("\n")}`);
    const fil = path.join(ut, `${namn}-${viewport.mark}.png`);
    await page.screenshot({ path: fil });
    console.log(fil);
    await context.close();
  }
}
await browser.close();
fs.rmSync(arbetsmapp, { recursive: true, force: true });
