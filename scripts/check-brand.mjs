#!/usr/bin/env node
/**
 * Vakt: en instans kan branda ramverket i EN fil och lägga på egen CSS som vinner, mätt i en riktig webbläsare (0.94.0).
 *
 * ══ ⛔ VARFÖR (CP 2026-10-12) ═══════════════════════════════════════════════
 *
 * "Tänk på vårt koncept att det ska vara enkelt att branda en instans och overrida om man så vill med egen css."
 * En hubb, Identity eller en kunds egen kopia ska kunna byta typsnitt för rubriker, publika rubriker och märket, plus
 * accent och märkets mått, i en brandfil, utan att röra en komponent. Och egen CSS ska vinna över ramverkets UTAN
 * `!important`.
 *
 * Båda är påståenden om hur något SER UT, och jsdom kör ingen CSS (samma skäl som `check-skalyta`). Före 0.94.0 stämde
 * det andra inte: ramverkets mörkerblock (`:root:not([data-theme="light"])`, specificitet 0,2,0) låg olagrade, så en
 * instans `:root { --color-accent }` (0,1,0) förlorade i mörkt läge hur sist den än laddades. Lösningen är ett lager,
 * `ops-ramverk` (se lagerordningen överst i `tokens.css`), och den här vakten är beviset att det håller.
 *
 * ══ VAD DEN MÄTER ═══════════════════════════════════════════════════════════
 *
 *   Statiskt (utan webbläsare):
 *     1. Varje variabel i `tokens/brand-kontrakt.json` finns i tokenfilen och i `docs/brand.md`. Ett kontrakt som pekar
 *        på ett namn som slutat finnas är ett löfte ingen kan hålla.
 *     2. Exemplet `examples/brand/brand.css` sätter bara kontraktets namn, och inte `!important`.
 *     3. Exemplets accent klarar WCAG AA för texten på accentytan, i båda lägena (4,5:1).
 *
 *   I Chromium, `getComputedStyle` på en riktig rubrik, knapp och märke (de riktiga komponenterna ur `dist`):
 *     4. UTAN brandfil har ytorna ramverkets värden (annars jämför provet mot sig självt).
 *     5. MED brandfilen ändras rubrikens familj i appen, den publika rubrikens familj, märkets familj och knappens
 *        bakgrund, och i mörkt läge får knappen brandfilens `--dark-accent`.
 *     6. Brödtextens familj (`--font-sans`) står kvar: den är inte en brandvariabel.
 *     7. En egen OLAGRAD regel vinner över ramverkets utan `!important`: `h1 { letter-spacing }` slår verktygsklassen
 *        `tracking-tight`, och `:root { --color-accent }` slår ramverkets mörkeralias i MÖRKT läge. Den andra är
 *        provet som var rött före 0.94.0.
 *
 * ⛔ GOLV: provet kräver minst 20 mätningar och minst 20 kontraktsvariabler. Ett prov som blir grönt av att inget
 * mättes mäter ingenting (arbetsreglernas punkt 4, "tomt underlag").
 *
 * ⛔ FAIL-CLOSED när webbläsaren saknas, som `check-skalyta`.
 *
 * ⛔ RÖTT UTAN LAGREN, GRÖNT MED DEM: `test-guards` kör vakten mot en tokenfil där `@layer ops-ramverk` är utbytt mot
 * `@media all` (alltså som före 0.94.0) och kräver rött på punkt 7, och mot en brandfil som saknar sin typsnittsrad och
 * kräver rött på punkt 5.
 *
 * Kör:  npm run build && node scripts/check-brand.mjs
 *       node scripts/check-brand.mjs --bevisa          kör de två röda proven mot sig själv och kräver rött (arbetsreglernas punkt 4)
 *       node scripts/check-brand.mjs --tokens <fil>   bygg CSS ur en annan tokenfil (röd-beviset utan lagren)
 *       node scripts/check-brand.mjs --brand <fil>    mät en annan brandfil än exemplet
 *       node scripts/check-brand.mjs --dist <fil>     mät en annan byggd version
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { startaWebblasare } from "./lib/matVyport.mjs";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
/** @param {string} flagga @param {string} forval */
const flaggVarde = (flagga, forval) => {
  const i = argv.indexOf(flagga);
  if (i < 0) return forval;
  if (!argv[i + 1] || argv[i + 1].startsWith("--")) {
    console.error(`check-brand: ${flagga} kräver en sökväg.`);
    process.exit(1);
  }
  return path.resolve(argv[i + 1]);
};
const tokensFil = flaggVarde("--tokens", path.join(rot, "tokens", "tokens.css"));
const brandFil = flaggVarde("--brand", path.join(rot, "examples", "brand", "brand.css"));
const egenFil = path.join(rot, "examples", "brand", "egen.css");
const dist = flaggVarde("--dist", path.join(rot, "dist", "index.js"));
const kontraktFil = path.join(rot, "tokens", "brand-kontrakt.json");
const docsFil = path.join(rot, "docs", "brand.md");

// ── --bevisa: rött utan lagren, rött utan typsnittsraden, och grönt med båda ──────────────────────────────────────
// Ligger i vakten och inte i `test-guards`, eftersom `check`-jobbet saknar webbläsare och det här provet kräver en.
if (argv.includes("--bevisa")) {
  const { spawnSync } = await import("node:child_process");
  const os = await import("node:os");
  const mapp = fs.mkdtempSync(path.join(os.tmpdir(), "ops-brand-bevis-"));
  try {
    const original = fs.readFileSync(tokensFil, "utf8");
    // Före 0.94.0 låg mörkerblocken olagrade. `@media all` är samma regler utan lager.
    const utanLager = original.replace(/^@layer ops-ramverk \{/gm, "@media all {");
    if (utanLager === original) throw new Error("check-brand --bevisa: tokens.css har inget `@layer ops-ramverk {` att ta bort. Då provar mutationen ingenting.");
    fs.writeFileSync(path.join(mapp, "tokens-utan-lager.css"), utanLager);
    const brand = fs.readFileSync(brandFil, "utf8");
    const utanPublik = brand.replace(/^\s*--font-display-publik:.*\n/m, "");
    if (utanPublik === brand) throw new Error("check-brand --bevisa: brandfilen har ingen --font-display-publik-rad att ta bort.");
    fs.writeFileSync(path.join(mapp, "brand-utan-publik.css"), utanPublik);

    /** @type {{ namn: string, args: string[], forvantat: string | null }[]} */
    const fall = [
      { namn: "grönt: ramverket med lagren och exempelfilen", args: [], forvantat: null },
      { namn: "rött: utan lagren vinner ramverkets mörkeralias över instansens regel", args: ["--tokens", path.join(mapp, "tokens-utan-lager.css")], forvantat: "över ramverkets mörkeralias" },
      { namn: "rött: en brandfil utan typsnittsraden ändrar inte den publika rubriken", args: ["--brand", path.join(mapp, "brand-utan-publik.css")], forvantat: "brandfilen ändrade inte den publika rubriken" },
    ];
    let fel = 0;
    for (const f of fall) {
      const k = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...f.args, ...(argv.includes("--dist") ? ["--dist", dist] : [])], { encoding: "utf8" });
      const ut = `${k.stdout ?? ""}${k.stderr ?? ""}`;
      const brottRad = /(\d+) brott av/.exec(ut)?.[1];
      let utfall = "ok";
      if (f.forvantat === null && k.status !== 0) utfall = `blev RÖD mot korrekt underlag: ${ut.trim().split("\n").slice(0, 2).join(" | ")}`;
      else if (f.forvantat !== null && k.status === 0) utfall = "blev GRÖN trots ett inplanterat brott";
      else if (f.forvantat !== null && !ut.includes(f.forvantat)) utfall = `blev röd av fel anledning (väntade "${f.forvantat}"): ${ut.trim().split("\n").slice(0, 2).join(" | ")}`;
      else if (f.forvantat !== null && brottRad !== "1") utfall = `blev röd av ${brottRad ?? "?"} brott, väntat exakt 1: provet ska peka ut en sak`;
      if (utfall !== "ok") fel += 1;
      console.log(`  ${utfall === "ok" ? (f.forvantat === null ? "grön som väntat" : "röd som väntat") : "FEL"}  ${f.namn}${utfall === "ok" ? "" : `\n      ${utfall}`}`);
    }
    if (fel > 0) {
      console.error(`check-brand --bevisa: ${fel} av ${fall.length} utfall stämde inte.`);
      process.exit(1);
    }
    console.log(`check-brand --bevisa: ${fall.length} utfall, grönt med lagren och rött utan dem`);
    process.exit(0);
  } finally {
    fs.rmSync(mapp, { recursive: true, force: true });
  }
}

for (const f of [tokensFil, brandFil, egenFil, kontraktFil, docsFil]) {
  if (!fs.existsSync(f)) {
    console.error(`check-brand: ${path.relative(rot, f)} finns inte. Fel sökväg, inte ett godkänt utfall.`);
    process.exit(1);
  }
}
if (!fs.existsSync(dist)) {
  console.error("check-brand: dist/index.js saknas. Kör `npm run build` först.");
  process.exit(1);
}

/** @type {string[]} */
const brott = [];
let matningar = 0;
/** @param {boolean} ok @param {string} text */
function krav(ok, text) {
  matningar += 1;
  if (!ok) brott.push(text);
}

/** @param {string} t */
const utanKommentarer = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "");

// ── Statiskt: kontraktet ─────────────────────────────────────────────────────
const kontrakt = JSON.parse(fs.readFileSync(kontraktFil, "utf8"));
/** @type {{ namn: string, grupp: string, plats: string }[]} */
const variabler = kontrakt.variabler;
const KONTRAKTGOLV = 20;
if (!Array.isArray(variabler) || variabler.length < KONTRAKTGOLV) {
  console.error(`check-brand: bara ${variabler?.length ?? 0} variabler i tokens/brand-kontrakt.json, väntat minst ${KONTRAKTGOLV}. Fel fil, eller ett tömt kontrakt.`);
  process.exit(1);
}
const tokenText = utanKommentarer(fs.readFileSync(tokensFil, "utf8"));
const docsText = fs.readFileSync(docsFil, "utf8");
const brandText = fs.readFileSync(brandFil, "utf8");
const egenText = fs.readFileSync(egenFil, "utf8");
const namnISet = new Set(variabler.map((v) => v.namn));

for (const v of variabler) {
  krav(new RegExp(`(^|[\\s;{])${v.namn}\\s*:`).test(tokenText), `kontraktet nämner ${v.namn}, som inte deklareras i ${path.relative(rot, tokensFil)}. Ett namn som slutat finnas är ett löfte ingen kan hålla.`);
  krav(docsText.includes(`\`${v.namn}\``), `${v.namn} står i kontraktet men inte i docs/brand.md. Det som inte är dokumenterat är inte ett gränssnitt.`);
}
const deklarerade = [...utanKommentarer(brandText).matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]);
krav(deklarerade.length >= 8, `${path.relative(rot, brandFil)} deklarerar bara ${deklarerade.length} variabler, väntat minst 8. Fel fil, eller en tom brandfil.`);
for (const namn of deklarerade) krav(namnISet.has(namn), `${path.relative(rot, brandFil)} sätter ${namn}, som inte är en brandvariabel (tokens/brand-kontrakt.json). Allt utanför kontraktet är ramverkets och kan byta namn.`);
krav(!/!important/.test(utanKommentarer(brandText)), `${path.relative(rot, brandFil)} använder !important. En brandfil vinner genom lagren, aldrig genom !important.`);
krav(!/!important/.test(utanKommentarer(egenText)), `${path.relative(rot, egenFil)} använder !important. Egen CSS vinner genom lagren, aldrig genom !important.`);

// ── Statiskt: kontrast i exemplets accent (WCAG AA 4,5:1 för text på accentytan) ──
/** @param {string} hex */
function luminans(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
/** @param {string} a @param {string} b */
const kontrast = (a, b) => (Math.max(luminans(a), luminans(b)) + 0.05) / (Math.min(luminans(a), luminans(b)) + 0.05);
/** @param {string} namn @returns {string | null} */
const hexAv = (namn) => new RegExp(`${namn}\\s*:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(utanKommentarer(brandText))?.[1] ?? null;
for (const [text, yta, lage] of [
  ["--color-accent-contrast", "--color-accent", "ljust"],
  ["--dark-accent-contrast", "--dark-accent", "mörkt"],
]) {
  const t = hexAv(text);
  const y = hexAv(yta);
  if (!t || !y) continue; // en annan brandfil (--brand) behöver inte sätta paret
  krav(kontrast(t, y) >= 4.5, `${path.relative(rot, brandFil)}: ${text} ${t} på ${yta} ${y} ger ${kontrast(t, y).toFixed(2)}:1 i ${lage} läge, under AA 4,5:1. Texten på accentytan blir oläslig.`);
}

// ── CSS: bygg som en konsument gör, med och utan brandfil ────────────────────
const arbetsmapp = fs.mkdtempSync(path.join(rot, "node_modules", ".ops-brand-"));
process.on("exit", () => fs.rmSync(arbetsmapp, { recursive: true, force: true }));

const entry = fs.readFileSync(path.join(rot, "scripts", "lib", "brand-entry.jsx"), "utf8").replace("OPS_DIST", dist.replace(/\\/g, "/"));
const entryFil = path.join(arbetsmapp, "entry.jsx");
fs.writeFileSync(entryFil, entry);
const js = await build({ entryPoints: [entryFil], bundle: true, write: false, format: "iife", jsx: "automatic", platform: "browser", target: ["es2022"], define: { "process.env.NODE_ENV": '"production"' }, logLevel: "error" });
const skript = js.outputFiles[0].text;

// ⛔ dist skannas utan sina kommentarer, av samma skäl som i check-css-build: citerade klasser är inte vår kod.
const distSkannad = path.join(arbetsmapp, "dist-skannad.js");
fs.writeFileSync(distSkannad, fs.readFileSync(dist, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/[^\n]*$/gm, " "));

// Provets egen olagrade regel: det vakten kräver att en instans ska kunna skriva. `:root { --color-accent }` är
// raden som förlorade i mörkt läge före 0.94.0.
const provEgen = path.join(arbetsmapp, "prov-egen.css");
fs.writeFileSync(provEgen, ":root {\n  --color-accent: #123456;\n}\n");

/** @param {string[]} filer Instansens filer, i ordning, efter ramverkets tokens. */
async function byggCss(filer) {
  const importer = filer.map((f) => `@import "${f.replace(/\\/g, "/")}";`).join("\n");
  const r = await postcss([tailwind()]).process(
    `@import "tailwindcss" source(none);\n@import "${tokensFil.replace(/\\/g, "/")}";\n${importer}\n@source "${distSkannad.replace(/\\/g, "/")}";\n@source "${entryFil.replace(/\\/g, "/")}";\n`,
    { from: path.join(arbetsmapp, "app.css") },
  );
  return r.css;
}
const cssBas = await byggCss([]);
const cssBrand = await byggCss([brandFil]);
const cssEgen = await byggCss([brandFil, egenFil, provEgen]);

/** @param {string} css */
const sida = (css) =>
  `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${skript.replace(/<\/script>/g, "<\\/script>")}</script></body></html>`;

const { browser } = await startaWebblasare();

/**
 * @param {string} css @param {"light" | "dark"} tema
 * @returns {Promise<Record<string, string>>}
 */
async function mat(css, tema) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(4000);
    const fel = /** @type {string[]} */ ([]);
    page.on("pageerror", (e) => fel.push(e.message));
    await page.emulateMedia({ colorScheme: tema });
    await page.setContent(sida(css));
    await page.waitForFunction("window.__redo === true", null, { timeout: 5000 }).catch(() => {});
    if (fel.length) throw new Error(`provsidan kastade: ${fel[0]}`);
    return await page.evaluate(() => {
      /** @param {string} sel @returns {Element} */
      const hamta = (sel) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error(`provsidan saknar ${sel}`);
        return el;
      };
      const stil = (/** @type {Element} */ el) => getComputedStyle(el);
      const appRubrik = hamta('[data-prov="app"] h1');
      const knapp = hamta('[data-prov="knapp"] button');
      const marke = hamta('[data-prov="marke"] [data-marke="rad1"]').parentElement;
      const publik = hamta('[data-prov="publik"] h1');
      const avsnitt = hamta('[data-prov="publik"] h2');
      const brodtext = hamta('[data-prov="brodtext"] p');
      const sidoyta = hamta('[data-prov="sidoyta"] [data-ops-sidoyta]');
      return {
        appRubrikFamilj: stil(appRubrik).fontFamily,
        appRubrikSparrning: stil(appRubrik).letterSpacing,
        appRubrikStorlek: stil(appRubrik).fontSize,
        appRubrikVikt: stil(appRubrik).fontWeight,
        knappBakgrund: stil(knapp).backgroundColor,
        knappText: stil(knapp).color,
        markeFamilj: stil(/** @type {Element} */ (marke)).fontFamily,
        publikFamilj: stil(publik).fontFamily,
        publikStorlek: stil(publik).fontSize,
        publikVikt: stil(publik).fontWeight,
        avsnittFamilj: stil(avsnitt).fontFamily,
        avsnittStorlek: stil(avsnitt).fontSize,
        brodFamilj: stil(brodtext).fontFamily,
        sidoytaBredd: stil(sidoyta).maxWidth,
      };
    });
  } finally {
    await context.close();
  }
}

/** Färgen som `rgb(r, g, b)`, som webbläsaren skriver den. @param {string} hex */
const rgb = (hex) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;
/** @param {string} namn @returns {string} */
const brandVarde = (namn) => new RegExp(`${namn}\\s*:\\s*([^;]+);`).exec(utanKommentarer(brandText))?.[1].trim() ?? "";
const brandFamilj = (/** @type {string} */ namn) => (brandVarde(namn).split(",")[0] ?? "").replace(/['"]/g, "").trim();

try {
  const baseLjus = await mat(cssBas, "light");
  const brandLjus = await mat(cssBrand, "light");
  const brandMork = await mat(cssBrand, "dark");
  const egenLjus = await mat(cssEgen, "light");
  const egenMork = await mat(cssEgen, "dark");

  // 4. Utan brandfil: ramverkets värden. Annars jämför provet mot sig självt.
  krav(/Plus Jakarta Sans/.test(baseLjus.appRubrikFamilj), `utan brandfil är appens rubrik inte i Plus Jakarta Sans: "${baseLjus.appRubrikFamilj}"`);
  krav(/Georgia/.test(baseLjus.publikFamilj), `utan brandfil är den publika rubriken inte i Georgia: "${baseLjus.publikFamilj}". --font-display-publik saknas eller används inte.`);
  krav(/Glacial Indifference/.test(baseLjus.markeFamilj), `utan brandfil är märket inte i Glacial Indifference: "${baseLjus.markeFamilj}"`);
  krav(baseLjus.knappBakgrund === rgb("#8E7A4E".toLowerCase()), `utan brandfil är primärknappen inte ramverkets accent: ${baseLjus.knappBakgrund}`);
  krav(baseLjus.publikVikt === "500" && baseLjus.publikStorlek === "56px", `den publika rubriken ska vara 56 px och 500 vid 1280 px: ${baseLjus.publikStorlek} / ${baseLjus.publikVikt}`);
  krav(baseLjus.avsnittStorlek === "44px", `avsnittsrubriken ska vara 44 px vid 1280 px: ${baseLjus.avsnittStorlek}`);

  // 5. MED brandfilen: familjer och accent ändras.
  const visaFamilj = (/** @type {string} */ namn) => brandFamilj(namn);
  krav(brandLjus.appRubrikFamilj.includes(visaFamilj("--font-display")) && brandLjus.appRubrikFamilj !== baseLjus.appRubrikFamilj, `brandfilen ändrade inte appens rubrik: "${brandLjus.appRubrikFamilj}" mot "${baseLjus.appRubrikFamilj}"`);
  krav(brandLjus.publikFamilj.includes(visaFamilj("--font-display-publik")) && brandLjus.publikFamilj !== baseLjus.publikFamilj, `brandfilen ändrade inte den publika rubriken: "${brandLjus.publikFamilj}" mot "${baseLjus.publikFamilj}"`);
  krav(brandLjus.avsnittFamilj.includes(visaFamilj("--font-display-publik")), `brandfilen ändrade inte avsnittsrubriken: "${brandLjus.avsnittFamilj}"`);
  krav(brandLjus.markeFamilj.includes(visaFamilj("--font-marke")) && brandLjus.markeFamilj !== baseLjus.markeFamilj, `brandfilen ändrade inte märket: "${brandLjus.markeFamilj}" mot "${baseLjus.markeFamilj}"`);
  const accentLjus = brandVarde("--color-accent");
  const accentMork = brandVarde("--dark-accent");
  krav(/^#[0-9a-f]{6}$/i.test(accentLjus) && brandLjus.knappBakgrund === rgb(accentLjus), `primärknappen i ljust läge ska vara brandfilens accent ${accentLjus}: ${brandLjus.knappBakgrund}`);
  krav(/^#[0-9a-f]{6}$/i.test(accentMork) && brandMork.knappBakgrund === rgb(accentMork), `primärknappen i mörkt läge ska vara brandfilens --dark-accent ${accentMork}: ${brandMork.knappBakgrund}`);
  krav(brandLjus.knappBakgrund !== brandMork.knappBakgrund, "knappen har samma bakgrund i ljust och mörkt läge: brandfilens mörka accent når inte sidan");
  krav(brandLjus.knappText === rgb(brandVarde("--color-accent-contrast")), `texten på knappen ska vara brandfilens --color-accent-contrast: ${brandLjus.knappText}`);

  // 6. Brödtextens familj är ramverkets och står kvar.
  krav(brandLjus.brodFamilj === baseLjus.brodFamilj && /Plus Jakarta Sans/.test(brandLjus.brodFamilj), `brödtextens familj ändrades av brandfilen: "${brandLjus.brodFamilj}" mot "${baseLjus.brodFamilj}"`);
  // Rollens storlek och vikt rörs inte av en brandfil som bara byter familj.
  krav(brandLjus.publikStorlek === baseLjus.publikStorlek && brandLjus.publikVikt === baseLjus.publikVikt, "brandfilen ändrade den publika rubrikens storlek eller vikt: en familj är inte en roll");
  krav(brandLjus.appRubrikStorlek === baseLjus.appRubrikStorlek && brandLjus.appRubrikVikt === baseLjus.appRubrikVikt, "brandfilen ändrade appens rubrikroll");

  // 7. Egen OLAGRAD CSS vinner utan !important.
  // `h1 { letter-spacing: 0.02em }` i exemplet: 0,02 av rubrikens egen storlek (20 px = 0.4px). `tracking-tight` är -0,025em, alltså negativt.
  const vantadSparrning = `${+(0.02 * parseFloat(egenLjus.appRubrikStorlek)).toFixed(2)}px`;
  krav(egenLjus.appRubrikSparrning !== brandLjus.appRubrikSparrning && egenLjus.appRubrikSparrning === vantadSparrning, `en olagrad h1-regel ska slå verktygsklassen tracking-tight: ${egenLjus.appRubrikSparrning} (väntat ${vantadSparrning} = 0,02em av ${egenLjus.appRubrikStorlek})`);
  krav(egenLjus.sidoytaBredd === "896px", `en olagrad .ops-sidoyta-regel ska slå ramverkets: ${egenLjus.sidoytaBredd} (väntat 896px = 56rem)`);
  krav(egenLjus.knappBakgrund === rgb("#123456"), `en olagrad :root { --color-accent } ska gälla i ljust läge: ${egenLjus.knappBakgrund}`);
  krav(
    egenMork.knappBakgrund === rgb("#123456"),
    `en olagrad :root { --color-accent } ska gälla också i MÖRKT läge, över ramverkets mörkeralias: ${egenMork.knappBakgrund} (väntat ${rgb("#123456")}). ` +
      "Är den brandfilens --dark-accent ligger ramverkets mörkerblock olagrade och slår en instans regel med högre specificitet: det som var fel före 0.94.0.",
  );
} finally {
  await browser.close();
}

const GOLV = 40;
if (matningar < GOLV) {
  console.error(`check-brand: bara ${matningar} mätningar, väntat minst ${GOLV}. En vakt som är grön av att inte ha mätt skyddar ingenting.`);
  process.exit(1);
}
if (brott.length > 0) {
  console.error(`check-brand: ${brott.length} brott av ${matningar} mätningar (0.94.0).`);
  for (const b of brott) console.error(`  ${b}`);
  process.exit(1);
}
console.log(`check-brand: ${matningar} mätningar, brandfilen ändrar rubrik, publik rubrik, märke och knapp i båda lägena, och en olagrad regel vinner utan !important`);
