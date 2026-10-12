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
 *   Det publika skalet (0.94.0, `OpsPublikSkal`, `OpsPublikHuvud`, `OpsPublikHjalte`, `OpsPublikBlock`, `OpsPublikUppmaning`, `OpsPublikFot`):
 *     8. Toppradens logga har samma `getBoundingClientRect` på två olika sidor (startsidan med hjälte och en kort innehållssida),
 *        i 1280 och 390 px, och efter scroll. "Loggan flyttar sig mellan sidor" var CP:s kritik.
 *     9. Under `md` ligger länkarna bakom en meny som öppnas och stängs; ingen horisontell scroll i 390 px.
 *    10. Brandfilen byter tonerna: med `examples/brand/sessionstudio.css` är banden SessionStudios (kräm, orange, ink), med
 *        `lifehub.css` Life Hubs (ljus, taupe, mörk), och accent och rubrikfamilj följer med.
 *    13. Spärrningen: varje publik rubrik (hjälte, block, sida, avsnitt) är lika bred som med SS `-0,01em` (`--letter-spacing-tight`),
 *        ur rollens egen token och inte en klass. Rött utan spärrningen (`--bevisa`).
 *    12. Rytmen mellan blocken ägs av ramverket: 96 px mellan två ljusa block, efter fotohjälten och före uppmaningen, 0 mellan
 *        olika toner; innehållssidans avsnitt 96 px (80 under `sm`). Rött utan regeln (`--bevisa`).
 *    11. Kontrasten för varje text mot sin bakgrund i varje ton, i båda brandfilerna (WCAG AA).
 *
 * ⛔ GOLV: provet kräver minst 20 mätningar och minst 20 kontraktsvariabler. Ett prov som blir grönt av att inget
 * mättes mäter ingenting (arbetsreglernas punkt 4, "tomt underlag").
 *
 * ⛔ FAIL-CLOSED när webbläsaren saknas, som `check-skalyta`.
 *
 * ⛔ RÖTT UTAN LAGREN, GRÖNT MED DEM: `test-guards` kör vakten mot en tokenfil där `@layer ops-ramverk` är utbytt mot
 * `@media all` (alltså som före 0.94.0) och kräver rött på punkt 7, och mot en brandfil som saknar sin typsnittsrad och
 * kräver rött på punkt 5, och mot en provsida där toppraden ligger i en smal centrerad kolumn (kompositionen CP kritiserade),
 * som kräver rött på punkt 8.
 *
 * Kör:  npm run build && node scripts/check-brand.mjs
 *       node scripts/check-brand.mjs --bevisa          kör de två röda proven mot sig själv och kräver rött (arbetsreglernas punkt 4)
 *       node scripts/check-brand.mjs --logga-mitt     lägg toppraden i en smal kolumn på innehållssidan (bara för --bevisa)
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
import { innehall } from "./lib/publik-innehall.mjs";

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
const ssFil = path.join(rot, "examples", "brand", "sessionstudio.css");
const lhFil = path.join(rot, "examples", "brand", "lifehub.css");
const loggaMitt = argv.includes("--logga-mitt");
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
    // Rytmen: regeln mellan markörerna RYTM i tokens.css tas bort, alltså som före granskningen av PR 350 (instansen hade ägt luften).
    const utanRytm = original.replace(/\/\* RYTM \*\/[\s\S]*?\/\* SLUT RYTM \*\//, "");
    if (utanRytm === original) throw new Error("check-brand --bevisa: tokens.css har ingen RYTM-regel att ta bort.");
    fs.writeFileSync(path.join(mapp, "tokens-utan-rytm.css"), utanRytm);
    // Spärrningen: rollernas `--letter-spacing` tas bort, alltså som före runda 2 av granskningen av PR 350.
    const utanSparrning = original.replace(/^\s*--text-publik-(?:rubrik|sida|block)--letter-spacing:[^;]*;\n/gm, "");
    if (utanSparrning === original) throw new Error("check-brand --bevisa: tokens.css har ingen spärrning på rubrikrollerna att ta bort.");
    fs.writeFileSync(path.join(mapp, "tokens-utan-sparrning.css"), utanSparrning);

    /** @type {{ namn: string, args: string[], forvantat: string | null, flera?: boolean }[]} */
    const fall = [
      { namn: "grönt: ramverket med lagren och exempelfilen", args: [], forvantat: null },
      { namn: "rött: utan lagren vinner ramverkets mörkeralias över instansens regel", args: ["--tokens", path.join(mapp, "tokens-utan-lager.css")], forvantat: "över ramverkets mörkeralias" },
      { namn: "rött: en brandfil utan typsnittsraden ändrar inte den publika rubriken", args: ["--brand", path.join(mapp, "brand-utan-publik.css")], forvantat: "brandfilen ändrade inte den publika rubriken" },
      { namn: "rött: utan ramverkets rytmregel ligger blocken tätt, 0 px i stället för 96", args: ["--tokens", path.join(mapp, "tokens-utan-rytm.css")], forvantat: "rytmen:", flera: true },
      { namn: "rött: utan spärrningen på rubrikrollerna är rubrikerna bredare än SS", args: ["--tokens", path.join(mapp, "tokens-utan-sparrning.css")], forvantat: "spärrningen:", flera: true },
      { namn: "rött: toppraden i en smal centrerad kolumn flyttar loggan mellan sidor", args: ["--logga-mitt"], forvantat: "loggan ligger inte på samma plats", flera: true },
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
      else if (f.forvantat !== null && !f.flera && brottRad !== "1") utfall = `blev röd av ${brottRad ?? "?"} brott, väntat exakt 1: provet ska peka ut en sak`;
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

for (const f of [tokensFil, brandFil, egenFil, ssFil, lhFil, kontraktFil, docsFil]) {
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


// ── Statiskt: kontrasten i varje ton, i SessionStudios och Life Hubs brandfil (WCAG AA) ─────────────────────────────
/** @param {string} v `#rrggbb` eller `rgba(r, g, b, a)` @returns {{ r: number, g: number, b: number, a: number } | null} */
function farg(v) {
  const h = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(v.trim());
  if (h) return { r: parseInt(h[1], 16), g: parseInt(h[2], 16), b: parseInt(h[3], 16), a: 1 };
  const r = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(v.trim());
  return r ? { r: +r[1], g: +r[2], b: +r[3], a: r[4] === undefined ? 1 : +r[4] } : null;
}
/** @param {{ r: number, g: number, b: number, a: number }} f @param {{ r: number, g: number, b: number }} bg */
const blanda = (f, bg) => ({ r: f.r * f.a + bg.r * (1 - f.a), g: f.g * f.a + bg.g * (1 - f.a), b: f.b * f.a + bg.b * (1 - f.a) });
/** @param {{ r: number, g: number, b: number }} c */
const lum = (c) => {
  const k = [c.r, c.g, c.b].map((x) => x / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2];
};
/** @param {{ r: number, g: number, b: number }} a @param {{ r: number, g: number, b: number }} b */
const forhall = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

/**
 * Paren som ritas: text mot bakgrund, per ton. Brödtext och överrad är 12 till 18 px och kräver 4,5:1; rubrikerna är stora
 * (30 px och uppåt) och kräver 3:1, men prövas här mot 4,5:1 också, eftersom en rubrik som klarar det aldrig är ett problem.
 * @type {{ par: string, text: string, bg: string, min: number }[]}
 */
const TONPAR = [
  { par: "ljus: rubrik", text: "--color-publik-ljus-text", bg: "--color-publik-ljus", min: 4.5 },
  { par: "ljus: brödtext", text: "--color-publik-ljus-dampad", bg: "--color-publik-ljus", min: 4.5 },
  { par: "ljus: överrad", text: "--color-publik-markering", bg: "--color-publik-ljus", min: 4.5 },
  { par: "accentband: rubrik", text: "--color-publik-accentband-text", bg: "--color-publik-accentband", min: 4.5 },
  { par: "accentband: brödtext och överrad", text: "--color-publik-accentband-dampad", bg: "--color-publik-accentband", min: 4.5 },
  { par: "mörk: rubrik", text: "--color-publik-mork-text", bg: "--color-publik-mork", min: 4.5 },
  { par: "mörk: brödtext", text: "--color-publik-mork-dampad", bg: "--color-publik-mork", min: 4.5 },
  { par: "mörk: överrad", text: "--color-publik-mork-markering", bg: "--color-publik-mork", min: 4.5 },
  { par: "uppmaning: rubrik, mörk-text på accentband", text: "--color-publik-mork-text", bg: "--color-publik-accentband", min: 3 },
  { par: "primärknappen: texten på accenten", text: "--color-accent-contrast", bg: "--color-accent", min: 4.5 },
];
/**
 * ⛔ UNDANTAG SOM BARA FÅR SJUNKA INTE STIGA: SessionStudios egna värden, avlästa och inte åtgärdade, eftersom
 * `sessionstudio.css` ska ge SS utseende. Värdet är det uppmätta förhållandet; blir det sämre blir vakten röd, blir det
 * bättre ska raden bort. Life Hub-filen har inga undantag.
 * @type {Record<string, number>}
 */
const KANDA_UNDANTAG = {
  "sessionstudio.css|ljus: överrad": 2.41,
  "sessionstudio.css|uppmaning: rubrik, mörk-text på accentband": 2.76,
  "sessionstudio.css|accentband: brödtext och överrad": 4.41,
};
/** @type {string[]} */
const kontrastRader = [];
for (const fil of [ssFil, lhFil]) {
  const text = utanKommentarer(fs.readFileSync(fil, "utf8"));
  const v = (/** @type {string} */ namn) => new RegExp(`${namn}\\s*:\\s*([^;]+);`).exec(text)?.[1].trim() ?? "";
  for (const { par, text: tn, bg, min } of TONPAR) {
    const t = farg(v(tn));
    const b = farg(v(bg));
    if (!t || !b) {
      krav(false, `${path.basename(fil)}: ${par}: ${t ? bg : tn} saknas eller går inte att läsa som färg.`);
      continue;
    }
    const bgFast = { r: b.r, g: b.g, b: b.b };
    const kon = forhall(blanda(t, bgFast), bgFast);
    const nyckel = `${path.basename(fil)}|${par}`;
    const undantag = KANDA_UNDANTAG[nyckel];
    kontrastRader.push(`${path.basename(fil)} ${par}: ${kon.toFixed(2)}:1${kon >= min ? "" : undantag ? " (känt undantag)" : ""}`);
    if (kon >= min) {
      krav(undantag === undefined, `${nyckel} står som känt undantag (${undantag}) men klarar nu ${min}:1 (${kon.toFixed(2)}). Ta bort raden ur KANDA_UNDANTAG.`);
    } else if (undantag !== undefined) {
      krav(kon >= undantag - 0.05, `${nyckel}: ${kon.toFixed(2)}:1 är sämre än det kända undantaget ${undantag}:1. Ett undantag får bara sjunka i antal, inte i kontrast.`);
    } else {
      krav(false, `${nyckel}: ${kon.toFixed(2)}:1, under ${min}:1 (WCAG AA). Texten blir svår att läsa.`);
    }
  }
}

// ── CSS: bygg som en konsument gör, med och utan brandfil ────────────────────
const arbetsmapp = fs.mkdtempSync(path.join(rot, "node_modules", ".ops-brand-"));
process.on("exit", () => fs.rmSync(arbetsmapp, { recursive: true, force: true }));

const entry = fs.readFileSync(path.join(rot, "scripts", "lib", "brand-entry.jsx"), "utf8").replace("OPS_DIST", dist.replace(/\\/g, "/"));
const entryFil = path.join(arbetsmapp, "entry.jsx");
fs.writeFileSync(entryFil, entry);
const js = await build({ entryPoints: [entryFil], bundle: true, write: false, format: "iife", jsx: "automatic", platform: "browser", target: ["es2022"], define: { "process.env.NODE_ENV": '"production"' }, logLevel: "error" });
const skript = js.outputFiles[0].text;
const publikEntryFil = path.join(arbetsmapp, "publik-entry.jsx");
fs.writeFileSync(publikEntryFil, fs.readFileSync(path.join(rot, "scripts", "lib", "publik-prov.jsx"), "utf8").replace("OPS_DIST", dist.replace(/\\/g, "/")));
const publikJs = await build({ entryPoints: [publikEntryFil], bundle: true, write: false, format: "iife", jsx: "automatic", platform: "browser", target: ["es2022"], define: { "process.env.NODE_ENV": '"production"' }, logLevel: "error" });
const publikSkript = publikJs.outputFiles[0].text;

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
    `@import "tailwindcss" source(none);\n@import "${tokensFil.replace(/\\/g, "/")}";\n${importer}\n@source "${distSkannad.replace(/\\/g, "/")}";\n@source "${entryFil.replace(/\\/g, "/")}";\n@source "${publikEntryFil.replace(/\\/g, "/")}";\n`,
    { from: path.join(arbetsmapp, "app.css") },
  );
  return r.css;
}
const cssBas = await byggCss([]);
const cssBrand = await byggCss([brandFil]);
const cssEgen = await byggCss([brandFil, egenFil, provEgen]);
const cssSS = await byggCss([ssFil]);
const cssLH = await byggCss([lhFil]);

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
  krav(baseLjus.publikVikt === "500" && baseLjus.publikStorlek === "48px", `innehållshjältens rubrik (text-publik-sida, SS HowItWorksPage) ska vara 48 px och 500 vid 1280 px: ${baseLjus.publikStorlek} / ${baseLjus.publikVikt}`);
  krav(baseLjus.avsnittStorlek === "36px", `avsnittsrubriken (text-publik-block, SS HowItWorksPage) ska vara 36 px vid 1280 px: ${baseLjus.avsnittStorlek}`);

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

  // ── Det publika skalet (0.94.0) ─────────────────────────────────────────────────────────────────────────────────
  const demo = innehall();
  /** @typedef {{ x: number, y: number, w: number, h: number }} Rect */
  /**
   * @param {string} css @param {"start" | "kort"} sidan @param {number} bredd @param {{ tema?: "light" | "dark", meny?: boolean, scroll?: number }} [val]
   */
  async function publik(css, sidan, bredd, val = {}) {
    const context = await browser.newContext({ viewport: { width: bredd, height: 900 } });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(4000);
      const fel = /** @type {string[]} */ ([]);
      page.on("pageerror", (e) => fel.push(e.message));
      await page.emulateMedia({ colorScheme: val.tema ?? "light" });
      const prov = JSON.stringify({ sida: sidan, innehall: demo, loggaMitt: loggaMitt && sidan === "kort" }).replace(/</g, "\\u003c");
      await page.setContent(`<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>window.__prov = ${prov};</script><script>${publikSkript.replace(/<\/script>/g, "<\\/script>")}</script></body></html>`);
      await page.waitForFunction("window.__redo === true", null, { timeout: 5000 }).catch(() => {});
      if (fel.length) throw new Error(`publika provsidan "${sidan}" kastade: ${fel[0]}`);
      if (val.scroll) await page.evaluate((y) => window.scrollTo(0, y), val.scroll);
      /** @type {{ menyOppnad?: boolean, menyLankar?: number, menyStangd?: boolean, desktopListaDold?: boolean }} */
      let meny = {};
      if (val.meny) {
        const lista = page.locator('[data-ops-publik="huvud"] ul').first();
        const desktopListaDold = await lista.evaluate((el) => getComputedStyle(el).display === "none");
        await page.getByRole("button", { name: demo.texter.oppnaMeny }).click();
        await page.locator('[data-ops-publik="mobilmeny"]').waitFor();
        const menyLankar = await page.locator('[data-ops-publik="mobilmeny"] a').count();
        await page.keyboard.press("Escape");
        const menyStangd = await page.locator('[data-ops-publik="mobilmeny"]').count().then((n) => n === 0);
        meny = { menyOppnad: true, menyLankar, menyStangd, desktopListaDold };
      }
      const m = await page.evaluate(() => {
        const rect = (/** @type {Element | null} */ el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2) };
        };
        const cs = (/** @type {Element | null} */ el, /** @type {string} */ p) => (el ? getComputedStyle(el).getPropertyValue(p) : "");
        const huvud = document.querySelector('[data-ops-publik="huvud"]');
        const hjalte = document.querySelector('[data-ops-publik="hjalte"]');
        const block = [...document.querySelectorAll('[data-ops-publik="block"]')];
        const uppmaning = document.querySelector('[data-ops-publik="uppmaning"]');
        return {
          logga: rect(document.querySelector("[data-publik-logga] img")),
          huvud: rect(huvud),
          huvudBg: cs(huvud, "background-color"),
          scrollBredd: document.documentElement.scrollWidth,
          fonsterBredd: window.innerWidth,
          hjalteFamilj: cs(hjalte?.querySelector("h1") ?? null, "font-family"),
          hjalteH1Farg: cs(hjalte?.querySelector("h1") ?? null, "color"),
          hjalteOverrad: cs(hjalte?.querySelector("p") ?? null, "color"),
          hjalteKnapp: cs(hjalte?.querySelector("a.bg-accent") ?? null, "background-color"),
          komKnapp: cs(huvud?.querySelector("a.bg-accent") ?? null, "background-color"),
          blockBg: block.map((b) => cs(b, "background-color")),
          blockOverrad: block.map((b) => cs(b.querySelector("p"), "color")),
          blockRubrik: block.map((b) => cs(b.querySelector("h2"), "color")),
          blockRubrikFamilj: block.map((b) => cs(b.querySelector("h2"), "font-family")),
          uppmaningBg: cs(uppmaning, "background-color"),
          skalBg: cs(document.querySelector('[data-ops-publik="skal"]'), "background-color"),
          hjalteH1Storlek: cs(hjalte?.querySelector("h1") ?? null, "font-size"),
          // Spärrningen (granskningen av PR 350, runda 2): rubrikens bredd i EN rad som den ritas, och samma rubrik med SS
          // spärrning -0,01em (`--letter-spacing-tight`, SS index.css:411 och :433, ärvd av SS landningsrubriker) tvingad på. Är rollens
          // spärrning rätt är de lika; saknas den är den ritade bredare.
          rubriker: [
            ["hjälterubrik (publik-rubrik)", hjalte?.querySelector("h1")],
            ["blockrubrik (publik-block)", block[0]?.querySelector("h2")],
            ["sidrubrik (publik-sida)", hjalte && !hjalte.hasAttribute("data-med-bild") ? hjalte.querySelector("h1") : null],
            ["avsnittsrubrik (publik-block)", document.querySelector('[data-ops-publik="avsnitt"] h2')],
          ]
            .filter(([, el]) => el)
            .map(([namn, el]) => {
              const bredd = (/** @type {string | null} */ tvinga) => {
                const k = /** @type {HTMLElement} */ (/** @type {Element} */ (el).cloneNode(true));
                k.style.cssText = `position:absolute;left:-9999px;top:0;width:auto;max-width:none;white-space:nowrap;${tvinga ? `letter-spacing:${tvinga};` : ""}`;
                /** @type {Element} */ (el).parentElement?.appendChild(k);
                const w = k.getBoundingClientRect().width;
                k.remove();
                return +w.toFixed(2);
              };
              return { namn: /** @type {string} */ (namn), sparrning: cs(/** @type {Element} */ (el), "letter-spacing"), ritad: bredd(null), ss: bredd("-0.01em") };
            }),
          // Rytmen: varje blocks, hjältens, uppmaningens och avsnittens övre och nedre kant, i dokumentets ordning.
          rytm: [...document.querySelectorAll('[data-ops-publik="hjalte"], [data-ops-publik="block"], [data-ops-publik="uppmaning"], [data-ops-publik="avsnitt"]')].map((e) => {
            const r = e.getBoundingClientRect();
            return { typ: e.getAttribute("data-ops-publik") ?? "", ton: e.getAttribute("data-ton") ?? "", top: +r.top.toFixed(2), bottom: +r.bottom.toFixed(2) };
          }),
          huvudPosition: cs(huvud, "position"),
          huvudTop: huvud ? Math.round(huvud.getBoundingClientRect().top) : -1,
        };
      });
      return { ...m, ...meny };
    } finally {
      await context.close();
    }
  }
  /** @param {any} a @param {any} b */
  const lika = (a, b) => a && b && ["x", "y", "w", "h"].every((k) => Math.abs(a[k] - b[k]) <= 0.01);

  // 8. Loggan ligger på samma plats på två olika sidor, i båda bredderna och efter scroll.
  for (const bredd of [1280, 390]) {
    const start = await publik(cssSS, "start", bredd);
    const kort = await publik(cssSS, "kort", bredd);
    const startScroll = await publik(cssSS, "start", bredd, { scroll: 700 });
    krav(lika(start.logga, kort.logga), `loggan ligger inte på samma plats på startsidan och innehållssidan vid ${bredd} px: ${JSON.stringify(start.logga)} mot ${JSON.stringify(kort.logga)}`);
    krav(lika(start.logga, startScroll.logga), `loggan flyttade sig vid scroll vid ${bredd} px: ${JSON.stringify(start.logga)} mot ${JSON.stringify(startScroll.logga)}`);
    krav(lika(start.huvud, kort.huvud), `toppraden har olika mått på startsidan och innehållssidan vid ${bredd} px: ${JSON.stringify(start.huvud)} mot ${JSON.stringify(kort.huvud)}`);
    krav(startScroll.huvudPosition === "sticky" && startScroll.huvudTop === 0, `toppraden ska ligga fast överst efter scroll: ${startScroll.huvudPosition} ${startScroll.huvudTop}`);
    krav(!!start.logga && start.logga.x < bredd / 4, `loggan ska ligga till vänster, inte i mitten: x ${start.logga?.x} vid ${bredd} px`);
    // 9. Ingen horisontell scroll.
    krav(start.scrollBredd <= start.fonsterBredd && kort.scrollBredd <= kort.fonsterBredd, `horisontell scroll vid ${bredd} px: start ${start.scrollBredd} / kort ${kort.scrollBredd} mot ${start.fonsterBredd}`);
  }
  // 12. Rytmen mellan blocken ägs av ramverket (granskningen av PR 350): 96 px mellan två ljusa block, efter fotohjälten före ett
  // ljust block och före uppmaningen, 0 mellan olika toner; innehållssidans avsnitt 96 px från sm och 80 px under.
  for (const bredd of [1280, 390]) {
    const start = await publik(cssSS, "start", bredd);
    const r = start.rytm;
    krav(r.length >= 7, `rytmen: bara ${r.length} element mättes på startsidan vid ${bredd} px, väntat hjälte, fem block och uppmaning (7)`);
    for (let k = 1; k < r.length; k++) {
      const luft = +(r[k].top - r[k - 1].bottom).toFixed(2);
      const [a, b] = [r[k - 1], r[k]];
      const beskr = `${a.typ}${a.ton ? ` ${a.ton}` : ""} till ${b.typ}${b.ton ? ` ${b.ton}` : ""}`;
      const vantat = b.typ === "uppmaning" ? (a.ton === "ljus" ? 96 : 0) : a.typ === "hjalte" && b.ton === "ljus" ? 96 : a.ton === "ljus" && b.ton === "ljus" ? 96 : 0;
      krav(Math.abs(luft - vantat) <= 0.5, `rytmen: avståndet ${beskr} är ${luft} px vid ${bredd} px, väntat ${vantat}. Luften mellan blocken ägs av ramverkets CSS (96 px mellan två ljusa block, 0 mellan olika toner).`);
    }
    const kort = await publik(cssSS, "kort", bredd);
    const av = kort.rytm.filter((e) => e.typ === "avsnitt");
    krav(av.length === 2, `rytmen: innehållssidan ska ha två avsnitt, hade ${av.length}`);
    if (av.length === 2) {
      const luft = +(av[1].top - av[0].bottom).toFixed(2);
      const vantat = bredd >= 640 ? 96 : 80;
      krav(Math.abs(luft - vantat) <= 0.5, `rytmen: avståndet mellan två avsnitt är ${luft} px vid ${bredd} px, väntat ${vantat} (SS space-y-20 sm:space-y-24)`);
    }
  }
  // 13. Spärrningen: varje publik rubrik är lika bred som med SS spärrning -0,01em. Rött utan den (`--bevisa`).
  for (const [sida, bredd] of /** @type {const} */ ([["start", 1280], ["kort", 1280], ["start", 390]])) {
    const m = await publik(cssSS, sida, bredd);
    krav(m.rubriker.length >= (sida === "start" ? 2 : 2), `spärrningen: bara ${m.rubriker.length} rubriker mättes på ${sida} vid ${bredd} px`);
    for (const r of m.rubriker) {
      krav(r.sparrning !== "normal" && r.sparrning.endsWith("px"), `spärrningen: ${r.namn} på ${sida} har spärrning "${r.sparrning}", väntat -0,01em (rollens --letter-spacing)`);
      krav(Math.abs(r.ritad - r.ss) <= 0.5, `spärrningen: ${r.namn} på ${sida} vid ${bredd} px är ${r.ritad} px bred, med SS spärrning -0,01em ${r.ss} px. Rollen saknar -0,01em.`);
    }
  }
  const foto = await publik(cssSS, "start", 1280);
  krav(foto.hjalteH1Storlek === "56px", `fotohjältens rubrik ska vara 56 px vid 1280 px (text-publik-rubrik): ${foto.hjalteH1Storlek}`);

  // 9. Mobilmenyn.
  const mobil = await publik(cssSS, "start", 390, { meny: true });
  krav(mobil.desktopListaDold === true, "länkarna i toppraden ska vara dolda under md");
  krav((mobil.menyLankar ?? 0) >= demo.mobilLankar.length + 1, `mobilmenyn ska bära alla ${demo.mobilLankar.length} sidor, plus Logga in: ${mobil.menyLankar} länkar`);
  krav(mobil.menyStangd === true, "mobilmenyn ska stängas med Escape");
  const bred = await publik(cssSS, "start", 1280);
  krav((await publik(cssSS, "kort", 1280)).komKnapp === bred.komKnapp, "accentknappen i toppraden ska vara samma på båda sidorna");

  // 10. Brandfilerna byter tonerna.
  const ss = bred;
  const rgbT = (/** @type {string} */ h) => rgb(h);
  krav(JSON.stringify(ss.blockBg) === JSON.stringify([rgbT("#f4efe6"), rgbT("#f4efe6"), rgbT("#e8804a"), rgbT("#1a1a1a"), rgbT("#f4efe6")]), `med sessionstudio.css ska banden vara kräm, kräm, orange, ink, kräm: ${ss.blockBg.join(" | ")}`);
  krav(ss.uppmaningBg === rgbT("#e8804a"), `uppmaningen ska vara orange: ${ss.uppmaningBg}`);
  krav(ss.komKnapp === rgbT("#e8804a") && ss.hjalteKnapp === rgbT("#e8804a"), `accentknapparna ska vara SS orange: ${ss.komKnapp} / ${ss.hjalteKnapp}`);
  krav(ss.hjalteOverrad === rgbT("#e8804a") && ss.hjalteH1Farg === rgbT("#ffffff"), `hjälten ska ha orange överrad och vit rubrik: ${ss.hjalteOverrad} / ${ss.hjalteH1Farg}`);
  krav(ss.blockOverrad[0] === rgbT("#e8804a") && ss.blockOverrad[3] === rgbT("#e8804a"), `överraden på kräm och ink ska vara orange: ${ss.blockOverrad.join(" | ")}`);
  krav(ss.skalBg === rgbT("#f4efe6"), `sidans bakgrund ska vara kräm: ${ss.skalBg}`);
  krav(/Georgia/.test(ss.hjalteFamilj) && ss.blockRubrikFamilj.every((f) => /Georgia/.test(f)), `rubrikerna ska vara Georgia: ${ss.hjalteFamilj}`);
  const lh = await publik(cssLH, "start", 1280);
  krav(JSON.stringify(lh.blockBg) === JSON.stringify([rgbT("#f4f1ea"), rgbT("#f4f1ea"), rgbT("#7d6b5d"), rgbT("#202420"), rgbT("#f4f1ea")]), `med lifehub.css ska banden vara ljus, ljus, taupe, mörk, ljus: ${lh.blockBg.join(" | ")}`);
  krav(lh.komKnapp === rgbT("#c99a3e") && lh.uppmaningBg === rgbT("#7d6b5d"), `Life Hub: guldknapp och taupeband: ${lh.komKnapp} / ${lh.uppmaningBg}`);
  krav(lh.blockOverrad[0] === rgbT("#202420") && lh.blockOverrad[3] === rgbT("#c99a3e"), `Life Hub: mörk överrad på ljust och guld på mörkt: ${lh.blockOverrad.join(" | ")}`);
  krav(JSON.stringify(lh.blockBg) !== JSON.stringify(ss.blockBg) && lh.komKnapp !== ss.komKnapp, "två brandfiler gav samma toner: brandfilen når inte sidan");
  const nord = await publik(cssBrand, "start", 1280);
  krav(nord.blockRubrikFamilj.every((f) => f.includes(brandFamilj("--font-display-publik"))) && nord.hjalteFamilj.includes(brandFamilj("--font-display-publik")), `brandfilens publika rubrikfamilj ska gälla i hjälten och blocken: ${nord.hjalteFamilj}`);
  const utanTon = await publik(cssBas, "start", 1280);
  krav(utanTon.blockBg[0] === rgbT("#fdf8ef") && utanTon.komKnapp === rgbT("#8e7a4e"), `utan brandfil ska tonerna vara ramverkets egna tokens (canvas, accent): ${utanTon.blockBg[0]} / ${utanTon.komKnapp}`);
  const mork = await publik(cssBas, "start", 1280, { tema: "dark" });
  krav(mork.blockBg[3] === rgbT("#202420"), `det mörka bandet ska vara det mörka temats yta också i mörkt läge: ${mork.blockBg[3]}`);
} finally {
  await browser.close();
}

const GOLV = 100;
if (matningar < GOLV) {
  console.error(`check-brand: bara ${matningar} mätningar, väntat minst ${GOLV}. En vakt som är grön av att inte ha mätt skyddar ingenting.`);
  process.exit(1);
}
if (brott.length > 0) {
  console.error(`check-brand: ${brott.length} brott av ${matningar} mätningar (0.94.0).`);
  for (const b of brott) console.error(`  ${b}`);
  process.exit(1);
}
console.log(`check-brand: ${matningar} mätningar, brandfilen ändrar rubrik, publik rubrik, märke och knapp i båda lägena, en olagrad regel vinner utan !important, och det publika skalet har loggan på samma plats och tonerna ur brandfilen`);
console.log("  kontrast per ton (WCAG, text mot bakgrund):");
for (const r of kontrastRader) console.log(`    ${r}`);
