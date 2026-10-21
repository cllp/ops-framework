/**
 * Skärmbilder av kalenderlistan mot en byggd dist (0.134.0, cllp/lifehub.app#402), 390 och 1280 px.
 *
 * Kör: npm run build && node scripts/kalender-montage.mjs
 * Bilderna hamnar i docs/bilder/0.134.0-kalendrar. Webbläsaren är den startaWebblasare hittar.
 *
 * ⛔ Ärendet citerar ingen SessionStudio-bild (det citerar CP:s skärmbild av LifeHubs egna dubblerade lista), så regel 12 kräver inget montage mot en förebild.
 * Bilderna visar vad som ritas och är inget bevis på att det är rätt: det beviset är proven.
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
const ut = path.join(rot, "docs", "bilder", "0.134.0-kalendrar");
fs.mkdirSync(ut, { recursive: true });
if (!fs.existsSync(dist)) {
  console.error("kalender-montage: dist/index.js saknas. Kör npm run build först.");
  process.exit(1);
}

const arbetsmapp = fs.mkdtempSync(path.join(rot, "node_modules", ".ops-kalender-"));
const entry = fs.readFileSync(path.join(rot, "scripts", "lib", "kalender-yta.jsx"), "utf8").replace("OPS_DIST", dist.replace(/\\/g, "/"));
const entryFil = path.join(arbetsmapp, "entry.jsx");
fs.writeFileSync(entryFil, entry);
const js = await build({ entryPoints: [entryFil], bundle: true, write: false, format: "iife", jsx: "automatic", platform: "browser", target: ["es2022"], define: { "process.env.NODE_ENV": '"production"' }, logLevel: "error" });
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
  `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body class="bg-canvas text-ink font-sans"><div id="root"></div><script>window.__kalender=${JSON.stringify(lage)};</script><script>${js.outputFiles[0].text.replace(/<\/script>/g, "<\\/script>")}</script></body></html>`;

const { browser, varifran } = await startaWebblasare();
console.log(`webbläsare: ${varifran}`);

/** Varje bild: namn, vad som görs efter att kalendern ritats, och vad som ska synas innan bilden tas. */
const BILDER = [
  ["1-kalendrar-lista", async (page) => { await page.getByRole("button", { name: /^Kalendrar: / }).click(); await page.getByRole("dialog", { name: "Kalendrar" }).waitFor(); }],
  ["2-visning-utfalld", async (page) => {
    await page.getByRole("button", { name: /^Kalendrar: / }).click();
    const lista = page.getByRole("dialog", { name: "Kalendrar" });
    await lista.getByRole("button", { name: /Visas som/ }).nth(3).click();
    await lista.getByRole("tab", { name: "Ram" }).waitFor();
  }],
  ["3-visning-handelser", async () => {}],
  ["4-visning-ram", async (page) => { await valj(page, "Ram"); }],
  ["5-visning-bada", async (page) => { await valj(page, "Båda"); }],
  ["6-laspanel", async (page) => {
    await page.locator('[data-cal-day="2026-10-12"]').click();
    await page.getByRole("button", { name: "Tandläkare" }).first().click();
    await page.locator("[data-externpanel]").waitFor();
  }],
  ["7-kopiera-till", async (page) => {
    await page.locator('[data-cal-day="2026-10-12"]').click();
    await page.getByRole("button", { name: "Tandläkare" }).first().click();
    await page.getByRole("button", { name: "Kopiera till…" }).click();
    await page.getByRole("dialog", { name: "Kopiera till kalender" }).waitFor();
  }],
];

/** Apple-kalendern till vald visning, listan stängd, och en dag vald så att dagpanelen också syns. */
async function valj(page, visning) {
  await page.getByRole("button", { name: /^Kalendrar: / }).click();
  const lista = page.getByRole("dialog", { name: "Kalendrar" });
  await lista.getByRole("button", { name: /Visas som/ }).nth(3).click();
  await lista.getByRole("tab", { name: visning }).click();
  await page.keyboard.press("Escape");
  await page.locator('[data-cal-day="2026-10-12"]').click();
}

for (const [namn, efterAtt] of BILDER) {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: "light" });
    const page = await context.newPage();
    const fel = [];
    page.on("pageerror", (e) => fel.push(e.message));
    await page.setContent(sida(namn), { waitUntil: "load" });
    await page.waitForSelector('[data-cal-day="2026-10-12"]', { timeout: 8000 }).catch((e) => {
      throw new Error(`${namn}: kalendern ritades inte. ${fel.join("\n") || e.message}`);
    });
    await efterAtt(page);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(400);
    if (fel.length) throw new Error(`${namn}: ${fel.join("\n")}`);
    const fil = path.join(ut, `${namn}-${viewport.width}.png`);
    await page.screenshot({ path: fil });
    console.log(fil);
    await context.close();
  }
}
await browser.close();
fs.rmSync(arbetsmapp, { recursive: true, force: true });
process.exit(0);
