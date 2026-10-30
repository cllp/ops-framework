/**
 * Skärmbilder av "en rad, en panel" mot en byggd dist (0.145.0, cllp/ops-framework#446), 390 och 1280 px.
 *
 * Kör: npm run build && node scripts/radpanel-montage.mjs
 * Bilderna hamnar i docs/bilder/0.145.0-radpanel. Webbläsaren är den startaWebblasare hittar.
 *
 * ⛔ Ärendet citerar CP:s skärmbild av LifeHubs egen dagruta, inte en SessionStudio-bild, så regel 12 kräver inget montage mot en förebild.
 * Bilderna visar vad som ritas och är inget bevis på att det är rätt: det beviset är proven (`radpanel.test.jsx`). Det bilderna visar och proven inte mäter
 * (jsdom kör ingen CSS) är PLATSEN: knappraden längst ned, på samma ställe för en kort och en lång panel. Det mäts också här, i `Knappradens ställe` nedan.
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
const ut = path.join(rot, "docs", "bilder", "0.145.0-radpanel");
fs.mkdirSync(ut, { recursive: true });
if (!fs.existsSync(dist)) {
  console.error("radpanel-montage: dist/index.js saknas. Kör npm run build först.");
  process.exit(1);
}

const arbetsmapp = fs.mkdtempSync(path.join(rot, "node_modules", ".ops-radpanel-"));
const entry = fs.readFileSync(path.join(rot, "scripts", "lib", "radpanel-yta.jsx"), "utf8").replace("OPS_DIST", dist.replace(/\\/g, "/"));
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
const sida = (lage) =>
  `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body class="bg-canvas text-ink font-sans"><div id="root"></div><script>window.__radpanel=${JSON.stringify(lage)};</script><script>${js.outputFiles[0].text.replace(/<\/script>/g, "<\\/script>")}</script></body></html>`;

const { browser, varifran } = await startaWebblasare();
console.log(`webbläsare: ${varifran}`);

/** Varje bild: namn, vilken yta, vad som görs efter att den ritats. */
const BILDER = [
  ["1-dagruta", "kalender", async (page) => { await page.locator('[data-cal-day="2026-10-28"]').click(); await page.locator("[data-dagpanel]").waitFor(); }],
  ["2-paminnelse", "kalender", async (page) => {
    await page.locator('[data-cal-day="2026-10-28"]').click();
    await page.getByRole("button", { name: "Attest större leverantörsfakturor" }).first().click();
    await page.locator("[data-radpanel]").waitFor();
  }],
  ["3-faktura", "kalender", async (page) => {
    await page.locator('[data-cal-day="2026-10-30"]').click();
    await page.getByRole("button", { name: "Kundfaktura 114 till Visby Kakel" }).first().click();
    await page.locator("[data-radpanel]").waitFor();
  }],
  ["4-idag-lista", "idag", async () => {}],
  ["5-idag-paminnelse", "idag", async (page) => {
    await page.getByRole("button", { name: "Attest större leverantörsfakturor" }).click();
    await page.locator("[data-radpanel]").waitFor();
  }],
];

/** Knappradens överkant i fönstret, per bild som öppnar en panel: kort och lång text ska ge samma y. */
const knappradY = new Map();

for (const [namn, yta, efterAtt] of BILDER) {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: "light" });
    const page = await context.newPage();
    const fel = [];
    page.on("pageerror", (e) => fel.push(e.message));
    await page.setContent(sida(yta), { waitUntil: "load" });
    await page.waitForSelector(yta === "idag" ? "[data-titel]" : '[data-cal-day="2026-10-28"]', { timeout: 8000 }).catch((e) => {
      throw new Error(`${namn}: ytan ritades inte. ${fel.join("\n") || e.message}`);
    });
    await efterAtt(page);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(400);
    if (fel.length) throw new Error(`${namn}: ${fel.join("\n")}`);
    const rad = page.locator("[data-knapprad]");
    if (await rad.count()) {
      const ruta = await rad.boundingBox();
      knappradY.set(`${namn}-${viewport.width}`, Math.round(ruta.y + ruta.height));
    }
    const fil = path.join(ut, `${namn}-${viewport.width}.png`);
    await page.screenshot({ path: fil });
    console.log(fil);
    await context.close();
  }
}
await browser.close();

// ⛔ Knappradens ställe: underkanten av knappraden är skärmens underkant på varje bild där en panel är öppen, oavsett hur mycket text panelen har.
let brott = 0;
for (const bredd of [390, 1280]) {
  const y = [...knappradY].filter(([k]) => k.endsWith(`-${bredd}`)).map(([k, v]) => `${k}=${v}`);
  const varden = new Set([...knappradY].filter(([k]) => k.endsWith(`-${bredd}`)).map(([, v]) => v));
  console.log(`knappradens underkant vid ${bredd} px: ${y.join(", ")}`);
  if (bredd === 390 && varden.size !== 1) brott += 1;
}
if (brott) {
  console.error("radpanel-montage: knappraden står inte på samma ställe vid 390 px (kort och lång panel).");
  process.exitCode = 1;
}
fs.rmSync(arbetsmapp, { recursive: true, force: true });
process.exit(0);
