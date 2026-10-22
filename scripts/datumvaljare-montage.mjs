/**
 * Skärmbilder av datumväljarens prickar mot en byggd dist, 390 och 1280 px.
 *
 * Kör: npm run build && node scripts/datumvaljare-montage.mjs
 * Bilderna hamnar i docs/bilder/datumvaljare-prickar.
 *
 * ⛔ Ärendet citerar ingen SessionStudio-bild (det kommer från CP:s önskan att se vilka dagar som har händelser), så regel 12 kräver inget
 * montage mot en förebild. Bilderna visar vad som ritas (skillens punkt 7: skärmbild på 390 och 1280 px) och bevisar inte att det är rätt:
 * det beviset är proven.
 *
 * Ytan är en app i miniatyr: en lista med händelser och en väljare. Appen räknar fram dagarna ur sin lista när `onManadVisas` anropas,
 * precis som en riktig app ska. Väljaren hämtar ingenting.
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
const ut = path.join(rot, "docs", "bilder", "datumvaljare-prickar");
fs.mkdirSync(ut, { recursive: true });
if (!fs.existsSync(dist)) {
  console.error("datumvaljare-montage: dist/index.js saknas. Kör npm run build först.");
  process.exit(1);
}

const ENTRY = `
import { createRoot } from "react-dom/client";
import { useState } from "react";
import * as Ops from "OPS_DIST";

// Syntetiska händelser. Appen äger dem och räknar fram dagarna per månad.
const HANDELSER = ["2026-10-05", "2026-10-12", "2026-10-14", "2026-10-14", "2026-10-21", "2026-10-26", "2026-11-03", "2026-11-17"];

function Yta() {
  const lage = window.__lage;
  const [datum, setDatum] = useState("2026-10-12");
  const [dagar, setDagar] = useState(() => new Set());
  const props =
    lage === "utan"
      ? {}
      : {
          markeradeDagar: dagar,
          onManadVisas: (forstaDag) => setDagar(new Set(HANDELSER.filter((d) => d.startsWith(forstaDag.slice(0, 7))))),
        };
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3 px-4 py-6">
      <Ops.OpsField label="Datum">
        <Ops.OpsDatePicker value={datum} onChange={setDatum} {...props} />
      </Ops.OpsField>
    </main>
  );
}
createRoot(document.getElementById("root")).render(<Yta />);
`;

const arbetsmapp = fs.mkdtempSync(path.join(rot, "node_modules", ".ops-datum-"));
const entryFil = path.join(arbetsmapp, "entry.jsx");
fs.writeFileSync(entryFil, ENTRY.replace("OPS_DIST", dist.replace(/\\/g, "/")));
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
  `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body class="bg-canvas text-ink font-sans"><div id="root"></div><script>window.__lage=${JSON.stringify(lage)};</script><script>${js.outputFiles[0].text.replace(/<\/script>/g, "<\\/script>")}</script></body></html>`;

const { browser, varifran } = await startaWebblasare();
console.log(`webbläsare: ${varifran}`);

const oppna = async (page) => {
  await page.getByLabel("Datum").click();
  await page.locator('[role="grid"]').waitFor();
};

/** Varje bild: namn, väljarens läge, och vad som görs innan bilden tas. */
const BILDER = [
  ["1-utan-prickar", "utan", oppna],
  ["2-med-prickar", "med", oppna],
  [
    "3-nasta-manad",
    "med",
    async (page) => {
      await oppna(page);
      await page.getByRole("button", { name: /next month/i }).click();
      await page.locator('[data-day="2026-11-03"] [data-prick]').waitFor();
    },
  ],
];

for (const [namn, lage, efterAtt] of BILDER) {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: "light" });
    const page = await context.newPage();
    const fel = [];
    page.on("pageerror", (e) => fel.push(e.message));
    await page.setContent(sida(lage), { waitUntil: "load" });
    await efterAtt(page);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(400);
    if (fel.length) throw new Error(`${namn}: ${fel.join("\n")}`);
    const prickar = await page.locator("[data-prick]").count();
    console.log(`${namn} ${viewport.width}: ${prickar} prickar`);
    await page.screenshot({ path: path.join(ut, `${namn}-${viewport.width}.png`) });
    await context.close();
  }
}
await browser.close();
fs.rmSync(arbetsmapp, { recursive: true, force: true });
process.exit(0);
