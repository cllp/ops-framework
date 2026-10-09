/**
 * Mäter app-arket i en riktig webbläsare (0.89.0).
 *
 * jsdom kör ingen CSS. Den här sidan svarar på tre påståenden:
 * arket slutar ovanför bottenraden på telefon, fliken Appar går att träffa
 * medan arket är öppet, och på skrivbordet är samma innehåll en panel under
 * huvudet. Sidan får inte bli bredare än fönstret.
 *
 * Kör: npm run build && node scripts/mat-apparark.mjs
 * Bilder: /tmp/appar-ark-390.png och /tmp/appar-ark-1280.png, om mappen finns.
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
if (!fs.existsSync(dist)) {
  console.error("mat-apparark: dist/index.js saknas. Kör npm run build först.");
  process.exit(1);
}

const arbetsmapp = fs.mkdtempSync(path.join(rot, "node_modules", ".ops-apparark-"));
process.on("exit", () => fs.rmSync(arbetsmapp, { recursive: true, force: true }));

const entryKalla = `import { createRoot } from "react-dom/client";
import { useState } from "react";
import * as Ops from ${JSON.stringify(dist)};

const Ikon = () => <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="4" /></svg>;
const NAMN = ["Ekonomi", "Bibliotek", "Meddelanden", "Kontakter", "Filer", "Copilot"];
const moduler = NAMN.map((namn) => {
  const id = namn.toLowerCase();
  return Ops.defineModule({
    id,
    namn: { sv: namn, en: namn },
    nav: [],
    routes: [],
    samlingar: [],
    kallor: {},
    skapar: [],
    hubb: { ikon: <Ikon />, rutt: "/" + id, startsida: "start", delar: [{ id: "start", namn: { sv: "Start", en: "Start" }, ikon: <Ikon />, rutt: "/" + id + "/start" }] },
  });
});

function App() {
  const [href, setHref] = useState("/");
  return (
    <Ops.OpsAppShell
      fasta={{ idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } }}
      moduler={[]}
      activeHref={href}
      onNavigate={(h, e) => { e.preventDefault(); setHref(h); }}
      apparArk={{
        moduler,
        grupp: { moduler: moduler.map((m) => m.id), huvudmeny: ["ekonomi"] },
        farAndra: true,
      }}
    >
      <p style={{ padding: 16 }}>Sidans innehåll under arket.</p>
    </Ops.OpsAppShell>
  );
}
createRoot(document.getElementById("root")).render(<App />);
`;
const entryFil = path.join(arbetsmapp, "entry.jsx");
fs.writeFileSync(entryFil, entryKalla);
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
const tokensFil = path.join(rot, "tokens", "tokens.css");
const css = (
  await postcss([tailwind()]).process(
    `@import "tailwindcss" source(none);\n@import "${tokensFil}";\n@source "${distSkannad}";\n@source "${entryFil}";\n`,
    { from: path.join(arbetsmapp, "app.css") },
  )
).css;
const html = `<!doctype html><html lang="sv"><head><meta charset="utf-8"><style>${css}</style></head><body class="bg-canvas text-ink font-sans"><div id="root"></div><script>${js.outputFiles[0].text.replace(/<\/script>/g, "<\\/script>")}</script></body></html>`;

const { browser } = await startaWebblasare();
/** @type {string[]} */
const brott = [];
function krav(ok, text) {
  console.log(`${ok ? "OK" : "FEL"}  ${text}`);
  if (!ok) brott.push(text);
}

const bilder = process.env.APPARK_BILDER || "/tmp";
fs.mkdirSync(bilder, { recursive: true });

async function oppna(bredd, hojd, reduced) {
  const context = await browser.newContext({
    viewport: { width: bredd, height: hojd },
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const fel = [];
  page.on("pageerror", (e) => fel.push(e.message));
  await page.setContent(html, { waitUntil: "load" });
  // Komma-selektorn tar första träffen i DOM, och den är huvudraden som är
  // `hidden` under md. Vänta på den rad som faktiskt ritas.
  await page.waitForFunction(() => {
    for (const n of document.querySelectorAll("nav[aria-label='Snabbnavigering'], nav[aria-label='Huvudnavigering']")) {
      if (getComputedStyle(n).display !== "none" && n.getClientRects().length > 0) return true;
    }
    return false;
  });
  return { page, context, fel };
}

const telefon = await oppna(390, 844, false);
const botten = telefon.page.locator("nav[aria-label='Snabbnavigering']");
krav(await botten.isVisible(), "telefon: bottenraden syns");
krav(!(await telefon.page.locator("nav[aria-label='Huvudnavigering']").isVisible()), "telefon: huvudraden är dold");
await botten.getByRole("button", { name: "Appar" }).click();
await telefon.page.waitForSelector("[data-appar-ark]");
const mat390 = await telefon.page.evaluate(() => {
  const ark = document.querySelector("[data-appar-ark]");
  const nav = document.querySelector("nav[aria-label='Snabbnavigering']");
  const ar = ark.getBoundingClientRect();
  const nr = nav.getBoundingClientRect();
  const knapp = nav.querySelector("button");
  const kr = knapp.getBoundingClientRect();
  const traff = document.elementFromPoint(kr.left + kr.width / 2, kr.top + kr.height / 2);
  const rut = ark.querySelector("ul");
  const kolumner = getComputedStyle(rut).gridTemplateColumns.split(" ").filter(Boolean).length;
  return {
    arkBotten: ar.bottom,
    navTopp: nr.top,
    traffarKnapp: Boolean(traff && (traff === knapp || knapp.contains(traff))),
    kolumner,
    rutor: ark.querySelectorAll("[data-ark-id], a").length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    rorelse: ark.getAttribute("data-rorelse"),
    roll: ark.getAttribute("role"),
  };
});
console.log("390", mat390);
krav(mat390.arkBotten <= mat390.navTopp + 1, `telefon: arket slutar vid ${Math.round(mat390.arkBotten)} och bottenraden börjar vid ${Math.round(mat390.navTopp)}`);
krav(mat390.traffarKnapp, "telefon: fliken Appar träffas medan arket är öppet");
krav(mat390.kolumner === 4, `telefon: rutnätet har 4 kolumner, mätt ${mat390.kolumner}`);
krav(mat390.rutor >= 7, `telefon: minst sju rutor (sex appar och Alla appar), mätt ${mat390.rutor}`);
krav(mat390.overflow <= 1, `telefon: sidan är inte bredare än fönstret, överskott ${mat390.overflow}`);
krav(mat390.roll === "dialog", "telefon: arket har rollen dialog");
const bild390 = path.join(bilder, "appar-ark-390.png");
await telefon.page.screenshot({ path: bild390 });
console.log("bild", bild390, fs.existsSync(bild390) ? fs.statSync(bild390).size : "saknas");
// getByRole ser inte fliken: modalen sätter aria-hidden på allt utanför dialogen.
// CSS-klicket är ett riktigt tryck, utan force, och bevisar att pekarhändelsen når fram.
await telefon.page.locator("[data-ops-bottenrad] button").filter({ hasText: "Appar" }).click();
await telefon.page.waitForSelector("[data-appar-ark]", { state: "detached" });
const idagNu = await telefon.page.locator("nav[aria-label='Snabbnavigering']").getByRole("link", { name: "Idag" }).getAttribute("aria-current");
krav(idagNu === "page", `telefon: ett nytt tryck på Appar stänger arket och Idag är vald igen, mätt ${idagNu}`);
await telefon.context.close();

const dator = await oppna(1280, 900, false);
const huvud = dator.page.locator("nav[aria-label='Huvudnavigering']");
krav(await huvud.isVisible(), "skrivbord: huvudraden syns");
krav(!(await dator.page.locator("nav[aria-label='Snabbnavigering']").isVisible()), "skrivbord: bottenraden är dold");
await huvud.getByRole("button", { name: "Appar" }).click();
await dator.page.waitForSelector("[data-appar-ark]");
const mat1280 = await dator.page.evaluate(() => {
  const ark = document.querySelector("[data-appar-ark]");
  const header = document.querySelector("header");
  const ar = ark.getBoundingClientRect();
  const hr = header.getBoundingClientRect();
  return {
    arkTopp: ar.top,
    headerBotten: hr.bottom,
    arkBotten: ar.bottom,
    hojd: window.innerHeight,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
});
console.log("1280", mat1280);
krav(mat1280.arkTopp >= mat1280.headerBotten - 1, `skrivbord: panelen börjar under huvudet (${Math.round(mat1280.arkTopp)} mot ${Math.round(mat1280.headerBotten)})`);
krav(mat1280.arkBotten < mat1280.hojd - 40, `skrivbord: panelen ligger inte mot skärmens underkant (${Math.round(mat1280.arkBotten)} av ${mat1280.hojd})`);
krav(mat1280.overflow <= 1, `skrivbord: sidan är inte bredare än fönstret, överskott ${mat1280.overflow}`);
await dator.page.screenshot({ path: path.join(bilder, "appar-ark-1280.png") });
await dator.page.locator("header button").filter({ hasText: "Appar" }).click();
await dator.page.waitForSelector("[data-appar-ark]", { state: "detached" });
console.log("OK  skrivbord: ett nytt tryck på Appar i huvudet stänger panelen");
await dator.context.close();

const stilla = await oppna(390, 844, true);
await stilla.page.locator("nav[aria-label='Snabbnavigering']").getByRole("button", { name: "Appar" }).click();
await stilla.page.waitForSelector("[data-appar-ark]");
const rorelse = await stilla.page.locator("[data-appar-ark]").getAttribute("data-rorelse");
krav(rorelse === "reducerad", `reducerad rörelse märks på arket, mätt ${rorelse}`);
await stilla.context.close();

await browser.close();
if (brott.length) {
  console.error(`mat-apparark: ${brott.length} brott`);
  process.exit(1);
}
console.log("mat-apparark: grön");
