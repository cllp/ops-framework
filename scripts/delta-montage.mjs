/**
 * Skärmbilder av gästens sida för en händelse (`delta`) mot en byggd dist (0.146.0, cllp/ops-framework#445, skiva 1), 390 och 1280 px.
 *
 * Kör: npm run build && node scripts/delta-montage.mjs
 * Bilderna hamnar i docs/bilder/0.146.0-delta. Webbläsaren är den startaWebblasare hittar.
 *
 * ⛔ Ärendet citerar CP:s ord om en extern i en händelse och inte en SessionStudio-skärmbild, så regel 12 kräver inget montage mot en förebild. Bilderna visar vad som ritas och är inget bevis på att det är rätt: det beviset är
 * proven (`gast-delta-vy.test.jsx`). Det bilderna visar och proven inte mäter (jsdom kör ingen CSS) är LAYOUTEN, och den mäts också här: ingen horisontell rullning vid 390 px, de tre knapparna ryms på en rad eller bryts utan
 * att klippas, varje knapp är minst 44 px hög, och rubriken, dagen, platsen och frågan syns utan att rulla vid 844 px höjd.
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
const ut = path.join(rot, "docs", "bilder", "0.146.0-delta");
fs.mkdirSync(ut, { recursive: true });
if (!fs.existsSync(dist)) {
  console.error("delta-montage: dist/index.js saknas. Kör npm run build först.");
  process.exit(1);
}

const arbetsmapp = fs.mkdtempSync(path.join(rot, "node_modules", ".ops-delta-"));
const entry = fs.readFileSync(path.join(rot, "scripts", "lib", "delta-yta.jsx"), "utf8").replace("OPS_DIST", dist.replace(/\\/g, "/"));
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
// Typsnittet appen ritar i, bäddat in som i check:skalyta (0.145.0): annars ritas brödtexten i maskinens sans och måtten skiljer sig mellan miljöer.
const fontFil = path.join(rot, "scripts", "lib", "typsnitt", "plus-jakarta-sans", "plus-jakarta-sans-latin-wght.woff2");
const fontData = fs.readFileSync(fontFil).toString("base64");
const fontCss = `@font-face{font-family:"Plus Jakarta Sans";src:url(data:font/woff2;base64,${fontData}) format("woff2");font-weight:200 800;font-style:normal;font-display:block}`;
const css = fontCss + cssRatt;
const sida = (lage) =>
  `<!doctype html><html lang="${lage.sprak}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body class="bg-canvas text-ink font-sans"><div id="root"></div><script>window.__delta=${JSON.stringify(lage)};</script><script>${js.outputFiles[0].text.replace(/<\/script>/g, "<\\/script>")}</script></body></html>`;

const { browser, varifran } = await startaWebblasare();
console.log(`webbläsare: ${varifran}`);

/** Varje bild: namn, läge och vad som görs efter att sidan ritats. */
const BILDER = [
  ["1-fraga", { sprak: "sv", mitt: null }, async () => {}],
  ["2-svarat", { sprak: "sv", mitt: null }, async (page) => {
    await page.getByRole("button", { name: "Jag kommer" }).click();
    await page.locator('[data-gast-delta-svarat="kommer"]').waitFor();
  }],
  ["3-engelska-kanske", { sprak: "en", mitt: "kanske" }, async () => {}],
];

let brott = 0;
const krav = (ok, text) => {
  if (!ok) {
    brott += 1;
    console.error(`  brott: ${text}`);
  }
};

for (const [namn, lage, efterAtt] of BILDER) {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: "light" });
    const page = await context.newPage();
    const fel = [];
    page.on("pageerror", (e) => fel.push(e.message));
    await page.setContent(sida(lage), { waitUntil: "load" });
    await page.waitForFunction(() => document.fonts.status === "loaded");
    await page.waitForSelector("[data-gast-delta]", { timeout: 8000 }).catch((e) => {
      throw new Error(`${namn}: sidan ritades inte. ${fel.join("\n") || e.message}`);
    });
    await efterAtt(page);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);
    if (fel.length) throw new Error(`${namn}: ${fel.join("\n")}`);

    const mat = await page.evaluate(() => {
      const r = (el) => (el ? el.getBoundingClientRect() : null);
      const knappar = [...document.querySelectorAll("[data-gast-delta-knappar] button")].map((b) => {
        const rr = b.getBoundingClientRect();
        return { text: (b.textContent || "").trim(), hojd: Math.round(rr.height), vanster: Math.round(rr.left), hoger: Math.round(rr.right), klippt: b.scrollWidth > b.clientWidth + 1 };
      });
      const rubrik = r(document.querySelector("[data-dh-titel]"));
      const fraga = r(document.querySelector("[data-gast-delta-svar] h2"));
      const rad = r(document.querySelector("[data-gast-delta-svarat]"));
      return {
        bredd: document.documentElement.scrollWidth,
        fonster: window.innerWidth,
        hojd: window.innerHeight,
        knappar,
        rubrikTop: rubrik && Math.round(rubrik.top),
        fragaBotten: fraga && Math.round(fraga.bottom),
        radBotten: rad && Math.round(rad.bottom),
        radText: (document.querySelector("[data-gast-delta-svarat]")?.textContent || "").trim(),
      };
    });
    const etikett = `${namn} ${viewport.width}`;
    krav(mat.bredd <= mat.fonster, `${etikett}: sidan är ${mat.bredd} px bred i ett fönster på ${mat.fonster} (horisontell rullning).`);
    krav(mat.knappar.length === 3, `${etikett}: ${mat.knappar.length} knappar, väntat tre.`);
    for (const k of mat.knappar) {
      krav(k.hojd >= 44, `${etikett}: knappen "${k.text}" är ${k.hojd} px hög, väntat minst 44.`);
      krav(!k.klippt, `${etikett}: knappen "${k.text}" klipper sin text.`);
      krav(k.vanster >= 0 && k.hoger <= mat.fonster, `${etikett}: knappen "${k.text}" ligger utanför fönstret (${k.vanster} till ${k.hoger}).`);
    }
    krav(mat.radBotten !== null && mat.radBotten <= mat.hojd, `${etikett}: raden som säger vad som svarats syns inte utan att rulla (underkant ${mat.radBotten}, fönstret är ${mat.hojd} högt).`);
    console.log(`mätt: ${etikett}: bredd ${mat.bredd}/${mat.fonster}, knappar ${mat.knappar.map((k) => `${k.text} ${k.vanster}-${k.hoger} (${k.hojd})`).join(" | ")}, raden slutar på ${mat.radBotten} av ${mat.hojd}, "${mat.radText}"`);

    const fil = path.join(ut, `${namn}-${viewport.width}.png`);
    await page.screenshot({ path: fil });
    console.log(fil);
    await context.close();
  }
}
await browser.close();
fs.rmSync(arbetsmapp, { recursive: true, force: true });
if (brott) {
  console.error(`delta-montage: ${brott} brott.`);
  process.exit(1);
}
process.exit(0);
