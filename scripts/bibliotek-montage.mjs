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
const lageArg = process.argv[2];
const skivor = lageArg === "skivor";
const laslage = lageArg === "laslage";
const ut = skivor
  ? path.join(rot, "docs", "jamforelser", "bibliotek-filer-ljud")
  : laslage
    ? path.join(rot, "docs", "jamforelser", "0.90.4")
    : path.join(rot, "docs", "jamforelser", "0.79.0");
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

if (skivor) {
  const forebild = path.join(rot, "docs", "jamforelser", "forebild-ss-bibliotek");
  const vyer = [
    ["alla", "alla", "ss-alla.png", "Alla: anteckning, länk, ljud, bild och PDF"],
    ["inspelningar", "inspelningar", "ss-inspelningar.png", "Spela in idé och spelare i listan"],
    ["bilder", "bilder", "ss-bilder.png", "Bilder med förhandsbild"],
    ["dokument", "dokument", "ss-dokument.png", "Dokument med ikon och storlek"],
    ["radera", "detalj", "lifehub-fore.png", "Radering med bekräftelse"],
    ["utskrift", "utskrift", "ss-inspelningar.png", "Utskrift och förslag på ljudposten"],
    ["plus", "plus", "ss-inspelningar.png", "Spela in idé i plusmenyn"],
  ];
  async function oppna(lage, viewport, efter) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const fel = [];
    page.on("pageerror", (e) => fel.push(e.message));
    await page.setContent(sida(lage), { waitUntil: "load" });
    if (lage === "plus") await page.getByRole("button", { name: "Skapa" }).waitFor();
    else await page.waitForSelector("[data-bibliotek]");
    if (efter) await efter(page);
    if (fel.length) throw new Error(`${lage}: ${fel.join("\n")}`);
    return { context, page };
  }
  function efter(namn) {
    if (namn === "radera") {
      return async (page) => {
        await page.getByRole("button", { name: "Åtgärder för Protokoll" }).click();
        await page.getByRole("menuitem", { name: "Radera" }).click();
        await page.getByRole("button", { name: "Radera posten" }).waitFor();
      };
    }
    if (namn === "utskrift") {
      return async (page) => {
        await page.getByRole("button", { name: "Skriv ut" }).click();
        await page.getByRole("button", { name: "Spara som anteckning, förslag" }).waitFor();
      };
    }
    if (namn === "plus") {
      return async (page) => {
        await page.getByRole("button", { name: "Skapa" }).click();
        await page.getByRole("button", { name: "Spela in idé" }).waitFor();
      };
    }
    if (namn === "bild") {
      return async (page) => {
        await page.getByRole("button", { name: "Förhandsvisa Kvitto" }).click();
        await page.getByRole("dialog", { name: "Förhandsvisning" }).waitFor();
      };
    }
    return null;
  }
  const tagna = [];
  for (const [namn, lage, fore, text] of vyer) {
    for (const viewport of [{ width: 390, height: 844, mark: "390" }, { width: 1280, height: 900, mark: "1280" }]) {
      const { context, page } = await oppna(lage, viewport, efter(namn));
      const fil = path.join(ut, `ramverk-${namn}-${viewport.mark}.png`);
      await page.screenshot({ path: fil, fullPage: true });
      console.log(fil);
      tagna.push({ namn, mark: viewport.mark, fil, fore, text });
      await context.close();
    }
  }
  const { context, page } = await oppna("bild", { width: 390, height: 844 }, efter("bild"));
  const ljus = path.join(ut, "ramverk-ljus-390.png");
  await page.screenshot({ path: ljus, fullPage: true });
  console.log(ljus);
  await context.close();

  for (const rad of tagna) {
    const context = await browser.newContext({ viewport: { width: 1100, height: 1400 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const vanster = fs.readFileSync(rad.fil).toString("base64");
    const hoger = fs.readFileSync(path.join(forebild, rad.fore)).toString("base64");
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
      body { margin: 0; background: #f4f1ea; font-family: sans-serif; color: #1c1915; }
      .rad { display: flex; gap: 16px; padding: 16px; align-items: flex-start; }
      figure { margin: 0; max-width: 520px; }
      figcaption { font-size: 14px; margin-bottom: 8px; }
      img { max-height: 900px; max-width: 500px; width: auto; border: 1px solid #d9d3c7; background: white; }
    </style></head><body><div class="rad">
      <figure><figcaption>Ramverket, ${rad.mark} px. ${rad.text}</figcaption><img src="data:image/png;base64,${vanster}" alt="Ramverket"></figure>
      <figure><figcaption>Förebild: ${rad.fore}</figcaption><img src="data:image/png;base64,${hoger}" alt="Förebild"></figure>
    </div></body></html>`);
    const montage = path.join(ut, `montage-${rad.namn}-${rad.mark}.png`);
    await page.locator(".rad").screenshot({ path: montage });
    console.log(montage);
    await context.close();
  }
  await browser.close();
  fs.rmSync(arbetsmapp, { recursive: true, force: true });
  process.exit(0);
}

if (!laslage) for (const [namn, lage, viewport] of [
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

const forebildButik = path.join(ut, "ss-bibliotek-butik.png");
if (!laslage && fs.existsSync(forebildButik)) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const vanster = fs.readFileSync(path.join(ut, "bibliotek-lista-390.png")).toString("base64");
  const hoger = fs.readFileSync(forebildButik).toString("base64");
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

if (laslage) {
  const forebild = path.join(rot, "docs", "jamforelser", "forebild-ss-bibliotek");
  async function oppna(lage, viewport, efter) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const fel = [];
    page.on("pageerror", (e) => fel.push(e.message));
    await page.setContent(sida(lage), { waitUntil: "load" });
    await page.waitForSelector("[data-bibliotek]");
    if (efter) await efter(page);
    if (fel.length) throw new Error(`${lage}: ${fel.join("\n")}`);
    return { context, page };
  }
  async function svepRad(page) {
    const rad = page.getByRole("button", { name: "Protokoll", exact: true });
    const box = await rad.boundingBox();
    if (!box) throw new Error("raden saknar yta");
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width - 24, y);
    await page.mouse.down();
    await page.mouse.move(box.x + 24, y, { steps: 12 });
    await page.mouse.up();
    await page.getByRole("button", { name: "Radera" }).waitFor();
  }
  const vyer = [
    ["las", "las", null, "Anteckning i läsläge, utan fält"],
    ["redigera", "las", async (page) => {
      await page.getByRole("button", { name: "Redigera" }).click();
      await page.getByRole("textbox", { name: "Text" }).waitFor();
    }, "Redigera med Spara och Avbryt"],
    ["svep", "lista", svepRad, "Svep åt vänster avslöjar Radera"],
    ["meny", "lista", async (page) => {
      await page.getByRole("button", { name: "Åtgärder för Protokoll" }).click();
      await page.getByRole("menuitem", { name: "Öppna" }).waitFor();
    }, "Radmeny: Öppna, Redigera, Byt namn, Radera"],
  ];
  const tagna = [];
  for (const [namn, lage, efter, text] of vyer) {
    for (const viewport of [{ width: 390, height: 844, mark: "390" }, { width: 1280, height: 900, mark: "1280" }]) {
      const { context, page } = await oppna(lage, viewport, efter);
      const fil = path.join(ut, `ramverk-${namn}-${viewport.mark}.png`);
      await page.screenshot({ path: fil, fullPage: true });
      console.log(fil);
      tagna.push({ namn, mark: viewport.mark, fil, text });
      await context.close();
    }
  }
  for (const rad of tagna) {
    const context = await browser.newContext({ viewport: { width: 1100, height: 1400 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const vanster = fs.readFileSync(rad.fil).toString("base64");
    const hogerFil = path.join(forebild, "ss-alla.png");
    const hoger = fs.readFileSync(hogerFil).toString("base64");
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
      body { margin: 0; background: #f4f1ea; font-family: sans-serif; color: #1c1915; }
      .rad { display: flex; gap: 16px; padding: 16px; align-items: flex-start; }
      figure { margin: 0; max-width: 520px; }
      figcaption { font-size: 14px; margin-bottom: 8px; }
      img { max-height: 900px; max-width: 500px; width: auto; border: 1px solid #d9d3c7; background: white; }
    </style></head><body><div class="rad">
      <figure><figcaption>Ramverket, ${rad.mark} px. ${rad.text}</figcaption><img src="data:image/png;base64,${vanster}" alt="Ramverket"></figure>
      <figure><figcaption>Förebild: ss-alla.png, listan. Anteckningens läsvy finns inte i den här telefonbilden.</figcaption><img src="data:image/png;base64,${hoger}" alt="Förebild"></figure>
    </div></body></html>`);
    const montage = path.join(ut, `montage-${rad.namn}-${rad.mark}.png`);
    await page.locator(".rad").screenshot({ path: montage });
    console.log(montage);
    await context.close();
  }
  await browser.close();
  fs.rmSync(arbetsmapp, { recursive: true, force: true });
  process.exit(0);
}

await browser.close();
fs.rmSync(arbetsmapp, { recursive: true, force: true });
