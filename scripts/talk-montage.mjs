/**
 * Skärmbilder av TALK-fältets samtal mot en byggd dist (0.103.0): kvittot efter två omgångar, med rubrikradens tre ikoner, den
 * rullande samtalsytan och knapparna under den. 390 px och 1280 px, mörkt läge.
 *
 * Kör: npm run build && node scripts/talk-montage.mjs
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
const ut = path.join(rot, "docs", "jamforelser", "0.103.0");
fs.mkdirSync(ut, { recursive: true });

if (!fs.existsSync(dist)) {
  console.error("talk-montage: dist/index.js saknas. Kör npm run build först.");
  process.exit(1);
}

// ⛔ Arbetsmappen ligger i repots rot och inte i node_modules: där kan node_modules vara en länk till en annan arbetskopia, och
// montaget ska inte skriva i någon annans träd. Paketen hittas ändå, eftersom esbuild letar uppåt från ingången.
const arbetsmapp = fs.mkdtempSync(path.join(rot, ".ops-talk-"));
try {
  const entry = fs.readFileSync(path.join(rot, "scripts", "lib", "talk-yta.jsx"), "utf8").replace("OPS_DIST", dist.replace(/\\/g, "/"));
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
  const sida = `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body class="bg-canvas text-ink font-sans"><div id="root"></div><script>${js.outputFiles[0].text.replace(/<\/script>/g, "<\\/script>")}</script></body></html>`;

  const { browser, varifran } = await startaWebblasare();
  console.log(`webbläsare: ${varifran}`);
  for (const [namn, viewport] of /** @type {const} */ ([
    ["samtal-390", { width: 390, height: 844 }],
    ["samtal-1280", { width: 1280, height: 800 }],
  ])) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: "dark" });
    const page = await context.newPage();
    /** @type {string[]} */
    const fel = [];
    page.on("pageerror", (e) => fel.push(e.message));
    await page.setContent(sida, { waitUntil: "load" });
    // Vägen in är den personen tar: mikrofonen i huvudet på dator, raden "TALK, prata in" i bottenradens plus på telefon.
    if (viewport.width >= 768) {
      await page.locator("[data-talk-huvud]").click();
    } else {
      await page.locator("[data-talk-knapp]").click();
      await page.getByRole("button", { name: "TALK, prata in" }).click();
    }
    for (const steg of ["forsta", "svara"]) {
      if (steg === "svara") await page.getByRole("button", { name: "Svara" }).click();
      await page.getByRole("button", { name: "Klar, spara inspelningen" }).click();
      await page.locator("[data-talk-kvitto]").waitFor();
    }
    await page.locator("[data-talk-rubrikrad]").waitFor();
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
  fs.rmSync(arbetsmapp, { recursive: true, force: true });
}
