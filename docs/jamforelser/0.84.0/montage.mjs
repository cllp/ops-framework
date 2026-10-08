/**
 * Skärmbilder för 0.84.0 (#315, #309) mot en byggd dist, med Playwright.
 *
 * Kör från repots rot, en gång per dist:
 *   node docs/jamforelser/0.84.0/montage.mjs --dist <väg till dist/index.js> --namn fore|efter
 * och sist, för montagen sida vid sida:
 *   node docs/jamforelser/0.84.0/montage.mjs --montage
 * Ingen webbläsare installeras här: den är den `startaWebblasare` hittar.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { startaWebblasare } from "../../../scripts/lib/matVyport.mjs";

const har = path.dirname(fileURLToPath(import.meta.url));
const rot = path.resolve(har, "..", "..", "..");
const arg = (n) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : null;
};
const VYPORTAR = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
];

const { browser, varifran } = await startaWebblasare();
console.log(`webbläsare: ${varifran}`);

if (process.argv.includes("--montage")) {
  const bild = (f) => `data:image/png;base64,${fs.readFileSync(path.join(har, f)).toString("base64")}`;
  for (const namn of fs.readdirSync(har).filter((f) => f.startsWith("fore-") && f.endsWith(".png"))) {
    const efter = namn.replace(/^fore-/, "efter-");
    if (!fs.existsSync(path.join(har, efter))) continue;
    const page = await browser.newPage({ viewport: { width: 400, height: 400 }, deviceScaleFactor: 1 });
    const html = `<!doctype html><html><body style="margin:0;background:#fff;font:600 20px system-ui"><div id="m" style="display:inline-flex;gap:24px;padding:16px;align-items:flex-start">
      <figure style="margin:0"><figcaption style="padding:0 0 8px">Före (main, 0.82.0)</figcaption><img src="${bild(namn)}" style="border:1px solid #ccc;max-width:900px"></figure>
      <figure style="margin:0"><figcaption style="padding:0 0 8px">Efter (0.84.0)</figcaption><img src="${bild(efter)}" style="border:1px solid #ccc;max-width:900px"></figure>
    </div></body></html>`;
    await page.setContent(html, { waitUntil: "load" });
    const ut = path.join(har, namn.replace(/^fore-/, "montage-"));
    await page.locator("#m").screenshot({ path: ut });
    console.log(ut);
    await page.close();
  }
  await browser.close();
  process.exit(0);
}

const dist = path.resolve(arg("--dist") ?? path.join(rot, "dist", "index.js"));
const prefix = arg("--namn") ?? "efter";
if (!fs.existsSync(dist)) {
  console.error(`montage: ${dist} saknas. Bygg först.`);
  process.exit(1);
}

const arbetsmapp = fs.mkdtempSync(path.join(rot, "node_modules", ".ops-0840-"));
const entryFil = path.join(arbetsmapp, "entry.jsx");
fs.writeFileSync(entryFil, fs.readFileSync(path.join(har, "yta.jsx"), "utf8").replace("OPS_DIST", dist.replace(/\\/g, "/")));
const js = await build({
  entryPoints: [entryFil],
  bundle: true,
  write: false,
  format: "iife",
  jsx: "automatic",
  platform: "browser",
  target: ["es2022"],
  nodePaths: [path.join(rot, "node_modules")],
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "error",
});
const distSkannad = path.join(arbetsmapp, "dist-skannad.js");
fs.writeFileSync(distSkannad, fs.readFileSync(dist, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/[^\n]*$/gm, " "));
const tokensFil = path.join(path.dirname(path.dirname(dist)), "tokens", "tokens.css");
const cssRatt = (
  await postcss([tailwind()]).process(
    `@import "tailwindcss" source(none);\n@import "${tokensFil.replace(/\\/g, "/")}";\n@source "${distSkannad.replace(/\\/g, "/")}";\n@source "${entryFil.replace(/\\/g, "/")}";\n`,
    { from: path.join(arbetsmapp, "app.css") },
  )
).css;
const fontData = fs.readFileSync(path.join(rot, "fonts", "glacial-indifference", "glacial-indifference-400.woff2")).toString("base64");
const css = cssRatt.replace(/url\(["']?[^)"']*glacial-indifference-400\.woff2["']?\)/g, `url(data:font/woff2;base64,${fontData})`);
fs.rmSync(arbetsmapp, { recursive: true, force: true });

const sida = (yta) =>
  `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body class="bg-canvas text-ink font-sans"><div id="root"></div><script>window.__yta=${JSON.stringify(yta)};</script><script>${js.outputFiles[0].text.replace(/<\/script>/g, "<\\/script>")}</script></body></html>`;

// En liten PNG att välja i skrivfältet.
const PNG = fs.readFileSync(path.join(rot, "docs", "bilder", "0.57.0-talk", "talk-falt-390.png"));

async function oppna(yta, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await context.newPage();
  /** @type {string[]} */
  const fel = [];
  page.on("pageerror", (e) => fel.push(e.message));
  await page.setContent(sida(yta), { waitUntil: "load" });
  return { context, page, fel };
}

for (const vp of VYPORTAR) {
  // (1) #315: skrivfältet i vila och med en vald bild.
  {
    const { context, page, fel } = await oppna("skrivfalt", vp);
    await page.waitForSelector("[data-skrivruta]");
    const knappar = () => page.evaluate(() => [...document.querySelectorAll("[data-skrivruta] button")].map((b) => b.getAttribute("aria-label")));
    console.log(`${prefix} skrivfält ${vp.width} vila: ${JSON.stringify(await knappar())}`);
    await page.locator("[data-plus]").click();
    await page.locator('input[data-plusval="bild"]').setInputFiles({ name: "kvitto.png", mimeType: "image/png", buffer: PNG });
    await page.waitForSelector("[data-bilageutkast] img", { timeout: 8000 });
    const med = await knappar();
    console.log(`${prefix} skrivfält ${vp.width} med bild: ${JSON.stringify(med)}`);
    await page.locator('[data-yta="skrivfalt"]').screenshot({ path: path.join(har, `${prefix}-skrivfalt-bilaga-${vp.width}.png`) });
    if (fel.length) throw new Error(fel.join("\n"));
    await context.close();
  }
  // (2) #309: Ny händelse för en grupp utan namngivna kalendrar.
  {
    const { context, page, fel } = await oppna("nyhandelse", vp);
    await page.locator("[data-oppna-handelse]").click();
    const panel = page.getByRole("region", { name: "Ny händelse" });
    await panel.waitFor();
    const rad = await panel.evaluate((p) => {
      const etikett = [...p.querySelectorAll("span")].find((s) => s.textContent === "Kalender:");
      return etikett?.parentElement?.textContent ?? null;
    });
    console.log(`${prefix} ny händelse ${vp.width}: ${JSON.stringify(rad)}`);
    await page.screenshot({ path: path.join(har, `${prefix}-ny-handelse-${vp.width}.png`) });
    if (fel.length) throw new Error(fel.join("\n"));
    await context.close();
  }
  // (2b) #309: kalendermenyn med bara egna kalendrar.
  {
    const { context, page, fel } = await oppna("kalendermeny", vp);
    await page.locator('[aria-label="Kalendrar: Alla kalendrar"]').click();
    const meny = page.getByRole("dialog", { name: "Kalendrar" });
    await meny.waitFor();
    const rubriker = await meny.evaluate((m) => [...m.querySelectorAll("p")].map((p) => p.textContent));
    console.log(`${prefix} kalendermeny ${vp.width}: ${JSON.stringify(rubriker)}`);
    await page.screenshot({ path: path.join(har, `${prefix}-kalendermeny-${vp.width}.png`) });
    if (fel.length) throw new Error(fel.join("\n"));
    await context.close();
  }
}
await browser.close();
