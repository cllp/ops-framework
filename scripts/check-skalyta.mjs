#!/usr/bin/env node
/**
 * Vakt: skalets YTA mätt i en riktig webbläsare (0.30.0, #173).
 *
 * ══ ⛔ VARFÖR EN VAKT SOM KÖR CSS ═══════════════════════════════════════════
 *
 * Fem av sex punkter i CP:s 2026-09-29-lista var påståenden om hur något SER UT:
 * en linje för mycket i menyn, en knapp som sitter en pixel för högt, en logga
 * med text under sig, en inställningsvy som flödar ut i sidled. Alla fem gick
 * igenom hela provsviten grönt, eftersom jsdom inte kör någon CSS: `border-t`,
 * `size-9` och `min-w-0` är bara strängar där. Samma felklass som
 * `check-page-frame` och `check-slider`, och samma lösning: mät den renderade rutan.
 *
 * ══ VAD DEN MÄTER (varje punkt har sin händelse i CHANGELOG 0.30.0) ═════════
 *
 *   1. MENYN: ingen avgränsare närmare en annan än 24 px, i arket (390 px) och i
 *      rullgardinen (1280 px). Två streck 8 px från varandra under arkets rubrik.
 *   2. HUVUDETS KNAPPAR: plus, ikonlänk och hamburgare är 36 px cirklar, avataren
 *      en 28 px cirkel i en 32 px knapp, alla med 44 px träffyta, och mittlinjerna
 *      skiljer högst 1 px.
 *   3. LOGGAN: märket i toppraden bär ingen text och är inte högre än toppraden (56 px).
 *   4. RADEN: 12 px rundning och hover i `--color-raised`.
 *   5. INSTÄLLNINGSVYN vid 390 px: ingen horisontell överflödning.
 *   6. BOTTENRADEN med `fasta`: Idag, Kalender, STORT PLUS i mitten, Hub, Meny; ikon
 *      20 px, etikett 10 px, höjd 56 px; huvudets plus gömt i mobil.
 *
 * ⛔ GOLV: varje mätning kräver att det den mäter FANNS (minst så många rader, knappar
 * eller streck), annars är den röd. En mätning som blir grön av att inget hittades
 * mäter ingenting (arbetsreglernas punkt 4, "tomt underlag").
 *
 * ⛔ FAIL-CLOSED när webbläsaren saknas, precis som `check-viewport-guard`: att
 * hoppa över tyst gör vakten grön av att inte ha tittat.
 *
 * Kör:  npm run build && node scripts/check-skalyta.mjs
 *       node scripts/check-skalyta.mjs --dist <fil>       mät en annan byggd version (röd-beviset mot origin/main)
 *       node scripts/check-skalyta.mjs --utan-fasta     bara för att bevisa vakten mot en äldre dist (0.29)
 *       node scripts/check-skalyta.mjs --bilder <mapp>   skriver skärmbilderna dit (för montaget, regel 12)
 *       node scripts/check-skalyta.mjs --tema dark        alla sidor i mörkt tema (förebilden CP jämför mot är mörk)
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
// `--dist <fil>`: mät en ANNAN byggd version (t.ex. origin/main), för att bevisa att ett prov är rött utan sin fix.
const distI = argv.indexOf("--dist");
const dist = distI >= 0 ? path.resolve(argv[distI + 1]) : path.join(rot, "dist", "index.js");
const utanFasta = argv.includes("--utan-fasta");
// `--tokens <fil>`: bygg CSS:en ur en ANNAN tokens.css (0.31.0). Ett lager (`--z-dropdown`) ligger i tokens, inte i dist,
// så röd-beviset mot origin/main kräver båda: `--dist ../base/dist/index.js --tokens ../base/tokens/tokens.css`.
const tokI = argv.indexOf("--tokens");
const tokensFil = tokI >= 0 ? path.resolve(argv[tokI + 1]) : path.join(rot, "tokens", "tokens.css");
const temaI = argv.indexOf("--tema");
const standardtema = temaI >= 0 && argv[temaI + 1] === "dark" ? "dark" : "light";
const bildI = argv.indexOf("--bilder");
const bildmapp = bildI >= 0 ? path.resolve(argv[bildI + 1]) : null;
if (bildmapp) fs.mkdirSync(bildmapp, { recursive: true });

if (!fs.existsSync(dist)) {
  console.error("check-skalyta: dist/index.js saknas. Kör `npm run build` först.");
  process.exit(1);
}

const arbetsmapp = fs.mkdtempSync(path.join(rot, "node_modules", ".ops-skalyta-"));
process.on("exit", () => fs.rmSync(arbetsmapp, { recursive: true, force: true }));

// ── Bygg sidan: entry + CSS ─────────────────────────────────────────────────
const entry = fs.readFileSync(path.join(rot, "scripts", "lib", "skalyta-entry.jsx"), "utf8").replace("OPS_DIST", dist.replace(/\\/g, "/"));
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
const skript = js.outputFiles[0].text;

// ⛔ dist skannas UTAN kommentarer, av samma skäl som i check-css-build: citerade
// klasser i ett filhuvud är inte vår kod och ska inte generera regler.
const distSkannad = path.join(arbetsmapp, "dist-skannad.js");
fs.writeFileSync(distSkannad, fs.readFileSync(dist, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/[^\n]*$/gm, " "));
const cssRatt = (
  await postcss([tailwind()]).process(
    `@import "tailwindcss" source(none);\n@import "${tokensFil.replace(/\\/g, "/")}";\n@source "${distSkannad.replace(/\\/g, "/")}";\n@source "${entryFil.replace(/\\/g, "/")}";\n`,
    { from: path.join(arbetsmapp, "app.css") },
  )
).css;

// ⛔ Sidan laddas med `setContent` och har därför ingen adress att lösa `url("../fonts/...")` mot. I en riktig app
// skriver byggverktyget om sökvägen och kopierar ut filen (det mäter `check-scaffold`). Här bäddas SAMMA fil in som
// data-URL, så att `document.fonts.check` mäter det verkliga typsnittet och inte reservtypsnittet.
const fontData = fs.readFileSync(path.join(rot, "fonts", "glacial-indifference", "glacial-indifference-400.woff2")).toString("base64");
const css = cssRatt.replace(/url\(["']?[^)"']*glacial-indifference-400\.woff2["']?\)/g, `url(data:font/woff2;base64,${fontData})`);
if (css === cssRatt && tokI < 0) throw new Error("check-skalyta: @font-face för Glacial Indifference hittades inte i den byggda CSS:en. Märket hade mätts i reservtypsnittet.");

/** @param {string} scen @param {string | null} [aktiv] Vilken grupp som är vald i `full`. @returns {string} */
const sida = (scen, aktiv = null) =>
  `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body class="bg-canvas text-ink font-sans"><div id="root"></div><script>window.__skal=${JSON.stringify(scen)};window.__aktiv=${JSON.stringify(aktiv)};</script><script>${skript.replace(/<\/script>/g, "<\\/script>")}</script></body></html>`;

const { browser, varifran } = await startaWebblasare();

/** @type {string[]} */
const brott = [];
/** @type {string[]} */
const matt = [];
let mattningar = 0;

/** @param {boolean} ok @param {string} text */
function krav(ok, text) {
  mattningar += 1;
  if (!ok) brott.push(text);
}

/**
 * @param {string} scen @param {{ width: number, height: number }} viewport @param {string} [tema] @param {number} [skala] @param {string | null} [aktiv]
 */
async function oppna(scen, viewport, tema = standardtema, skala = 1, aktiv = null) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: skala });
  const page = await context.newPage();
  const fel = /** @type {string[]} */ ([]);
  page.on("pageerror", (e) => fel.push(e.message));
  await page.emulateMedia({ colorScheme: tema === "dark" ? "dark" : "light" });
  await page.setContent(sida(scen, aktiv));
  await page.waitForFunction("window.__redo === true", null, { timeout: 5000 }).catch(() => {});
  if (fel.length) throw new Error(`sidan "${scen}" kastade: ${fel[0]}`);
  return { page, context };
}

/**
 * Horisontella linjer i ett element: varje underelement med en synlig ovan- eller
 * underkant som är minst 60 procent så bred som behållaren.
 * @param {import("playwright").Page} page @param {string} valjare
 * @returns {Promise<number[]>} y-lägen, sorterade och utan dubbletter inom 1 px.
 */
async function linjer(page, valjare) {
  return page.evaluate((v) => {
    const behallare = /** @type {HTMLElement} */ (document.querySelector(v));
    const b = behallare.getBoundingClientRect();
    /** @type {number[]} */
    const ys = [];
    /** @param {string} c */
    const synlig = (c) => !/rgba?\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(c) && c !== "transparent";
    for (const el of behallare.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width < b.width * 0.6) continue;
      const cs = getComputedStyle(el);
      if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== "none" && synlig(cs.borderTopColor)) ys.push(Math.round(r.top));
      if (parseFloat(cs.borderBottomWidth) > 0 && cs.borderBottomStyle !== "none" && synlig(cs.borderBottomColor)) ys.push(Math.round(r.bottom));
    }
    return [...new Set(ys)].sort((a, c) => a - c);
  }, valjare);
}

/** @param {number[]} ys @returns {number} minsta avstånd mellan två intilliggande linjer */
const minGap = (ys) => ys.slice(1).reduce((m, y, i) => Math.min(m, y - ys[i]), Infinity);

// ══ 1. MENYN: EN AVGRÄNSARE MELLAN SEKTIONER, ALDRIG TVÅ ═════════════════════
for (const [namn, vp, oppnaMeny] of /** @type {const} */ ([
  ["arket (390 px)", { width: 390, height: 844 }, async (/** @type {any} */ p) => p.getByRole("button", { name: "Meny" }).last().click()],
  ["rullgardinen (1280 px)", { width: 1280, height: 800 }, async (/** @type {any} */ p) => p.getByRole("button", { name: /Meny, fler/ }).click()],
])) {
  const { page, context } = await oppna("meny", vp);
  await oppnaMeny(page);
  await page.waitForSelector('[role="dialog"]');
  const ys = await linjer(page, '[role="dialog"]');
  krav(ys.length >= 3, `menyn i ${namn}: bara ${ys.length} linjer lästa, väntat minst 3 (fyra sektioner). Fel scenario, eller en meny som inte ritades.`);
  const gap = minGap(ys);
  matt.push(`menyn i ${namn}: ${ys.length} linjer, minsta avstånd ${gap} px`);
  krav(gap >= 24, `menyn i ${namn}: två avgränsare ${gap} px från varandra (linjer på y=${ys.join(", ")}). Väntat minst 24 px: en linje mellan varje par sektioner, aldrig två.`);
  if (bildmapp) await page.screenshot({ path: path.join(bildmapp, vp.width < 800 ? "meny-mobil.png" : "meny-desktop.png") });
  await context.close();
}

// ══ 2. HUVUDETS KNAPPAR, 3. LOGGAN, 4. RADEN ═════════════════════════════════
{
  const { page, context } = await oppna("meny", { width: 1280, height: 800 });
  const m = await page.evaluate(() => {
    /** @param {Element | null} el */
    const rut = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const efter = getComputedStyle(el, "::after");
      return { x: r.x, y: r.y, w: r.width, h: r.height, mitt: r.y + r.height / 2, radie: parseFloat(cs.borderTopLeftRadius) || 0, efterBredd: parseFloat(efter.width) || 0, efterHojd: parseFloat(efter.height) || 0 };
    };
    const q = (/** @type {string} */ s) => document.querySelector(s);
    const header = q("header");
    const brand = q('header a[href="/"]');
    return {
      plus: rut(q('button[aria-label="Skapa"]')),
      inkorg: rut(q('a[aria-label="Inkorg"]')),
      avatar: rut(q('a[aria-label="Min profil"]')),
      avatarBild: rut(q('a[aria-label="Min profil"] [role="img"]')),
      hamburgare: rut(q('button[aria-label^="Meny,"]')),
      // ⛔ Toppradens INNERRAD (`header > div`), inte `<header>`: den senare bär också sin egen 1 px
      // underkant (`border-b`), och 56 px är radens höjd, inte kantens.
      header: rut(header ? header.firstElementChild : null),
      brand: rut(brand),
      topbar: parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--topbar-height")) || 56,
    };
  });
  const knappar = /** @type {const} */ (["plus", "inkorg", "hamburgare", "avatar"]);
  for (const k of knappar) krav(m[k] !== null, `huvudet: ${k} hittades inte i toppraden. Fel scenario, eller en knapp som inte ritades.`);
  if (knappar.every((k) => m[k])) {
    matt.push(`huvudet: mittlinjer plus ${m.plus.mitt.toFixed(1)}, inkorg ${m.inkorg.mitt.toFixed(1)}, avatar ${m.avatar.mitt.toFixed(1)}, hamburgare ${m.hamburgare.mitt.toFixed(1)}`);
    const mitt = knappar.map((k) => m[k].mitt);
    krav(Math.max(...mitt) - Math.min(...mitt) <= 1, `huvudet: mittlinjerna skiljer ${(Math.max(...mitt) - Math.min(...mitt)).toFixed(2)} px (${knappar.map((k, i) => `${k} ${mitt[i].toFixed(1)}`).join(", ")}). Väntat högst 1 px.`);
    for (const k of /** @type {const} */ (["plus", "inkorg", "hamburgare"])) {
      const r = m[k];
      krav(Math.abs(r.w - 36) < 0.5 && Math.abs(r.h - 36) < 0.5, `huvudet: ${k} är ${r.w}x${r.h} px, väntat en 36 px cirkel (SS \`p-2\` runt en 20 px ikon).`);
      krav(r.radie >= 18, `huvudet: ${k} har rundning ${r.radie} px, väntat en cirkel (minst 18 px).`);
      krav(r.efterBredd >= 44 && r.efterHojd >= 44, `huvudet: ${k} har träffyta ${r.efterBredd}x${r.efterHojd} px, väntat minst 44x44 som osynlig \`after:\`-yta.`);
    }
    krav(Math.abs(m.avatar.w - 32) < 0.5 && Math.abs(m.avatar.h - 32) < 0.5, `huvudet: avatarknappen är ${m.avatar.w}x${m.avatar.h} px, väntat 32x32.`);
    krav(m.avatarBild !== null && Math.abs(m.avatarBild.w - 28) < 0.5 && m.avatarBild.radie >= 14, `huvudet: avataren är ${m.avatarBild ? `${m.avatarBild.w} px, rundning ${m.avatarBild.radie}` : "inte hittad"}, väntat en 28 px cirkel.`);
    krav(m.avatar.efterBredd >= 44, `huvudet: avatarens träffyta är ${m.avatar.efterBredd} px, väntat minst 44.`);
  }
  // Loggan: höjden (texten mäts i sektion 10, märket är text sedan 0.31.0)
  krav(m.brand !== null && m.header !== null, "loggan: märket eller toppraden hittades inte.");
  if (m.brand && m.header) {
    matt.push(`loggan: toppraden ${m.header.h} px, märket ${m.brand.h} px`);
    krav(Math.abs(m.header.h - m.topbar) < 0.5, `loggan: toppraden är ${m.header.h} px, väntat --topbar-height (${m.topbar}).`);
    krav(m.brand.h <= m.topbar, `loggan: märket är ${m.brand.h} px högt i en topprad på ${m.topbar} px.`);
  }
  // Raden: rundning och hover i den öppnade menyn
  await page.getByRole("button", { name: /Meny, fler/ }).click();
  await page.waitForSelector('[role="dialog"]');
  const rad = page.locator('[role="dialog"] button', { hasText: "Notiser" }).first();
  const radie = await rad.evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius));
  const raised = await page.evaluate(() => {
    const p = document.createElement("div");
    p.style.backgroundColor = "var(--color-raised)";
    document.body.appendChild(p);
    const c = getComputedStyle(p).backgroundColor;
    p.remove();
    return c;
  });
  const yta = await page.locator('[role="dialog"]').evaluate((el) => getComputedStyle(el).backgroundColor);
  await rad.hover();
  await page.waitForTimeout(250);
  const hover = await rad.evaluate((el) => getComputedStyle(el).backgroundColor);
  matt.push(`raden: rundning ${radie} px, hover ${hover}, raised ${raised}, behållarens yta ${yta}${hover === yta ? " (OBS: hover syns INTE mot ytan i det här temat)" : ""}`);
  krav(radie === 12, `raden: rundning ${radie} px, väntat 12 (--radius-base, SS \`--radius\`).`);
  krav(hover === raised, `raden: hover-färgen är ${hover}, väntat --color-raised (${raised}).`);
  if (bildmapp) {
    await page.keyboard.press("Escape");
    // Escape lämnar fokus på hamburgaren (Radix återställer det), och dess fokusring ska inte hamna i bilden av avatarens hover.
    await page.evaluate(() => /** @type {HTMLElement} */ (document.activeElement)?.blur());
    await page.locator('a[aria-label="Min profil"]').hover();
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(bildmapp, "huvud-avatar-hover.png"), clip: { x: 640, y: 0, width: 640, height: 130 } });
    await page.getByRole("button", { name: "Skapa" }).click();
    await page.waitForSelector('[role="dialog"]');
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(bildmapp, "huvud-plus-meny.png"), clip: { x: 640, y: 0, width: 640, height: 340 } });
  }
  await context.close();
}

// ══ 5. INSTÄLLNINGSVYN VID 390 PX ════════════════════════════════════════════
{
  const { page, context } = await oppna("installning", { width: 390, height: 844 });
  const m = await page.evaluate(() => {
    const dok = document.documentElement;
    let bredast = 0;
    let vem = "";
    for (const el of document.body.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > bredast) {
        bredast = r.right;
        vem = `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.split(/\s+/).slice(0, 3).join(".") : ""}`;
      }
    }
    return { scroll: dok.scrollWidth, klient: dok.clientWidth, bredast, vem, rader: document.querySelectorAll("li").length };
  });
  matt.push(`inställningsvyn 390 px: scrollWidth ${m.scroll}, clientWidth ${m.klient}, längst ut ${m.bredast.toFixed(1)} (${m.vem})`);
  // ⛔ ORDEN BRYTS INTE I EN SMAL KOLUMN: namnet får en egen rad, minst 200 px bred, och ett namn som ryms (37 tecken) står på EN rad.
  const namn = await page.evaluate(() =>
    ["Leverantörsfakturaattesteringsunderlagsgranskning", "Kostnadsersättningsgranskningsärenden"].map((t) => {
      const el = [...document.querySelectorAll("li span")].find((e) => e.textContent === t);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { t, w: r.width, h: r.height, rad: parseFloat(getComputedStyle(el).lineHeight) };
    }),
  );
  matt.push(`inställningsvyn namn: ${namn.map((n) => (n ? `${n.t.length} tecken ${n.w.toFixed(0)}x${n.h.toFixed(0)} px` : "saknas")).join(", ")}`);
  for (const n of namn) {
    krav(n !== null, "inställningsvyn: ett kategorinamn hittades inte.");
    if (n) krav(n.w >= 200, `inställningsvyn: namnet på ${n.t.length} tecken är bara ${n.w.toFixed(0)} px brett, väntat minst 200 (en smal kolumn bryter ord mitt i).`);
  }
  if (namn[1]) krav(namn[1].h <= namn[1].rad * 1.1, `inställningsvyn: namnet på 37 tecken tar ${namn[1].h.toFixed(0)} px höjd, väntat en rad (${namn[1].rad.toFixed(0)}).`);
  krav(m.rader >= 3, `inställningsvyn: bara ${m.rader} rader ritades, väntat minst 3 kategorier.`);
  krav(m.scroll <= m.klient, `inställningsvyn: scrollWidth ${m.scroll} > clientWidth ${m.klient} vid 390 px. Det som sticker ut längst: ${m.vem} (${m.bredast.toFixed(0)} px).`);
  if (bildmapp) await page.screenshot({ path: path.join(bildmapp, "installning-390.png"), fullPage: true });
  await context.close();
}

// ══ 6. BOTTENRADEN MED fasta ═════════════════════════════════════════════════
if (!utanFasta) {
  const { page, context } = await oppna("fasta", { width: 390, height: 844 });
  const m = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Snabbnavigering"]');
    if (!nav) return null;
    const rut = (/** @type {Element} */ el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, w: r.width, h: r.height, mitt: r.x + r.width / 2 };
    };
    const poster = [...nav.querySelectorAll("a, button")].map((el) => ({ namn: (el.getAttribute("aria-label") || el.textContent || "").trim(), ...rut(el) }));
    const lank = nav.querySelector("a");
    const ikon = lank?.querySelector("svg");
    const etikett = lank?.querySelector("span:last-child");
    const huvudPlus = document.querySelector('header button[aria-label="Skapa"]');
    return {
      poster,
      hojd: nav.firstElementChild ? nav.firstElementChild.getBoundingClientRect().height : 0,
      ikon: ikon ? ikon.getBoundingClientRect().width : 0,
      etikett: etikett ? parseFloat(getComputedStyle(etikett).fontSize) : 0,
      huvudPlusVisas: huvudPlus ? getComputedStyle(huvudPlus).display !== "none" : null,
      // ⛔ RADENS EGEN BREDD och inte fönstrets: en klassisk rullningslist (Chromium utan touch-emulering,
      // `scrollbar-gutter: stable` i basskiktet) tar 15 px av raden, och "mitt i raden" är mitten av det som ritas.
      bredd: nav.getBoundingClientRect().width,
    };
  });
  krav(m !== null, "bottenraden: hittades inte med `fasta`.");
  if (m) {
    const namn = m.poster.map((p) => p.namn);
    matt.push(`bottenraden x: ${m.poster.map((p) => `${p.namn}@${p.x.toFixed(0)}+${p.w.toFixed(0)}`).join(" ")}`);
    matt.push(`bottenraden: ${namn.join(" | ")}; höjd ${m.hojd} px, ikon ${m.ikon} px, etikett ${m.etikett} px, huvudets plus ${m.huvudPlusVisas ? "syns" : "gömt"}`);
    krav(JSON.stringify(namn) === JSON.stringify(["Idag", "Kalender", "Skapa", "Hub", "Meny"]), `bottenraden: ordningen är ${namn.join(", ")}, väntat Idag, Kalender, Skapa (stort plus), Hub, Meny.`);
    const plus = m.poster.find((p) => p.namn === "Skapa");
    krav(!!plus && Math.abs(plus.w - 56) < 0.5 && Math.abs(plus.h - 56) < 0.5, `bottenraden: plusset är ${plus?.w}x${plus?.h} px, väntat 56x56.`);
    krav(!!plus && Math.abs(plus.mitt - m.bredd / 2) <= 2, `bottenraden: plusset ligger på x=${plus?.mitt.toFixed(1)}, väntat mitt i raden (${m.bredd / 2}).`);
    krav(Math.abs(m.hojd - 56) < 0.5, `bottenraden: höjd ${m.hojd} px, väntat 56 (SS \`h-14\`).`);
    krav(Math.abs(m.ikon - 20) < 0.5, `bottenraden: ikonen är ${m.ikon} px, väntat 20 (SS \`w-5 h-5\`).`);
    krav(Math.abs(m.etikett - 10) < 0.5, `bottenraden: etiketten är ${m.etikett} px, väntat 10 (SS \`text-[10px]\`).`);
    krav(m.huvudPlusVisas === false, "bottenraden: huvudets plus syns också i mobil. Väntat ETT plus per yta: det i huvudet gömt när bottenradens finns.");
  }
  if (bildmapp) {
    await page.screenshot({ path: path.join(bildmapp, "bottenrad-mobil.png") });
    await page.getByRole("button", { name: "Meny" }).last().click();
    await page.waitForSelector('[role="dialog"]');
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(bildmapp, "bottenrad-meny-mobil.png") });
  }
  await context.close();
}

// ══ 7. MOBILHUVUDET FÅR ALDRIG FLÖDA ÖVER (0.30.1) ═══════════════════════════
// CP 2026-09-29 13:44, med bild från telefonen: märket, temaväljaren, gruppväxlarens namn, inkorg, sök, fråga och
// avataren låg ovanpå varandra i 390 px. Provet är appens VERKLIGA uppsättning med ett långt gruppnamn.
{
  const { page, context } = await oppna("full", { width: 390, height: 844 }, standardtema, 2);
  const m = await page.evaluate(() => {
    const dok = document.documentElement;
    const poster = [...document.querySelectorAll("header a, header button")]
      .map((el) => {
        const r = el.getBoundingClientRect();
        const namn = (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30);
        return { namn, x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom };
      })
      .filter((p) => p.w > 0 && p.h > 0);
    const gruppText = [...document.querySelectorAll("header button")].find((b) => b.getAttribute("aria-label") === "Byt grupp");
    const namnSpan = gruppText ? [...gruppText.querySelectorAll("span")].find((sp) => (sp.textContent || "").includes("Staiger")) : null;
    return {
      poster,
      scroll: dok.scrollWidth,
      klient: dok.clientWidth,
      gruppNamnSynligt: namnSpan ? namnSpan.getBoundingClientRect().width > 0 : null,
      fraga: [...document.querySelectorAll("header a")].some((a) => a.getAttribute("aria-label") === "Fråga" && a.getBoundingClientRect().width > 0),
    };
  });
  krav(m.poster.length >= 6, `mobilhuvudet: bara ${m.poster.length} kontroller lästa i huvudet, väntat minst 6 (märke, gruppväxlare, tema, inkorg, sök, avatar). Fel scenario.`);
  matt.push(`mobilhuvudet 390 px: ${m.poster.map((p) => `${p.namn}@${p.x.toFixed(0)}+${p.w.toFixed(0)}`).join(" ")}`);
  /** @type {string[]} */
  const over = [];
  for (let i = 0; i < m.poster.length; i += 1) {
    for (let j = i + 1; j < m.poster.length; j += 1) {
      const a = m.poster[i];
      const b = m.poster[j];
      const dx = Math.min(a.r, b.r) - Math.max(a.x, b.x);
      const dy = Math.min(a.b, b.b) - Math.max(a.y, b.y);
      if (dx > 0.5 && dy > 0.5) over.push(`"${a.namn}" och "${b.namn}" överlappar ${dx.toFixed(0)} px`);
    }
  }
  krav(over.length === 0, `mobilhuvudet 390 px: barn i huvudet ligger ovanpå varandra: ${over.join("; ")}.`);
  krav(m.scroll <= m.klient, `mobilhuvudet 390 px: horisontell överflödning, scrollWidth ${m.scroll} > clientWidth ${m.klient}.`);
  const ut = m.poster.filter((p) => p.r > 390.5 || p.x < -0.5);
  krav(ut.length === 0, `mobilhuvudet 390 px: ${ut.map((p) => p.namn).join(", ")} ligger utanför skärmen.`);
  krav(m.gruppNamnSynligt === false, "mobilhuvudet 390 px: gruppväxlaren visar gruppnamnet i klartext. Under md visas bara märket (SS har ingen namnrad i mobilhuvudet).");
  krav(m.fraga === false, "mobilhuvudet 390 px: Fråga ligger kvar i huvudet. Väntat: åtgärder utöver de tre som ryms flyttar till menyn under md.");
  if (bildmapp) await page.screenshot({ path: path.join(bildmapp, "mobilhuvud-390.png"), clip: { x: 0, y: 0, width: 390, height: 140 } });
  await context.close();
}

// ══ 8. GRUPPPANELEN OCH LOGGAN PÅ DATOR, EXAKT SOM SS (0.30.1) ═══════════════
// SS `AppSidebar.jsx:51-59` (knappen överst i panelen) och `AppHeader.jsx:174-193` (loggan i en ruta lika bred som
// panelens innehåll, märkets vänsterkant på panelens). Panelen är 184/44 px BREDD men bär `px-0.5`, så dess innehåll är
// 180/40 px: exakt loggrutan (`--logo-bredd`/`--logo-bredd-infalld`).
for (const bredd of [1280, 1600]) {
  const { page, context } = await oppna("full", { width: bredd, height: 900 });
  /** @param {"utfalld"|"infalld"} lage */
  const mata = async (lage) =>
    page.evaluate(() => {
      const q = (/** @type {string} */ sel) => document.querySelector(sel);
      const box = q('header a[href="/"] > span');
      const panel = q('nav[aria-label="Alla mina grupper"]');
      const flik = q('header nav[aria-label="Huvudnavigering"] a');
      if (!box || !panel) return null;
      const b = box.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      const cs = getComputedStyle(panel);
      const forst = /** @type {HTMLElement | null} */ (panel.firstElementChild);
      const fr = forst ? forst.getBoundingClientRect() : null;
      return {
        logoX: b.x,
        logoW: b.width,
        logoR: b.right,
        panelX: p.x,
        panelInnerX: p.x + parseFloat(cs.paddingLeft),
        panelY: p.y,
        panelInnerW: p.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
        forstTagg: forst ? forst.tagName : null,
        forstLabel: forst ? forst.getAttribute("aria-label") : null,
        forstW: fr ? fr.width : 0,
        forstTop: fr ? fr.y : 0,
        flikX: flik ? flik.getBoundingClientRect().x : null,
      };
    });
  const ut = await mata("utfalld");
  krav(ut !== null, `panelen ${bredd} px: märkesrutan eller panelen hittades inte. Fel scenario.`);
  if (ut) {
    await page.locator('nav[aria-label="Alla mina grupper"] > button').first().click();
    await page.waitForTimeout(350);
    const in_ = await mata("infalld");
    krav(in_ !== null, `panelen ${bredd} px: märkesrutan eller panelen hittades inte efter infällning.`);
    if (in_) {
      // ⛔ Den infällda remsan (0.30.1, SS `AppSidebar.jsx:54,77,89`): varje post är en 40x40-ruta med kant, märket 34 px
      // inuti, och den aktiva gruppen har accentkant. Före 0.30.1 var växlaren en naken chevron och märkena fyllde rutan.
      const rem = await page.evaluate(() => {
        const nav = document.querySelector('nav[aria-label="Alla mina grupper"]');
        const rut = (/** @type {Element} */ el) => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          const barn = el.firstElementChild ? el.firstElementChild.getBoundingClientRect() : null;
          return { namn: el.getAttribute("aria-label") || "", w: r.width, h: r.height, kant: parseFloat(cs.borderTopWidth), kantFarg: cs.borderTopColor, markeW: barn ? barn.width : 0 };
        };
        const accent = (() => { const p = document.createElement("div"); p.style.borderTop = "1px solid var(--color-accent)"; document.body.appendChild(p); const c = getComputedStyle(p).borderTopColor; p.remove(); return c; })();
        return { poster: nav ? [...nav.querySelectorAll(":scope > button, ul button")].map(rut) : [], accent };
      });
      krav(rem.poster.length >= 4, `remsan ${bredd} px: bara ${rem.poster.length} poster lästa, väntat minst 4 (växlare, alla, två grupper, skapa).`);
      for (const p of rem.poster) {
        krav(Math.abs(p.w - 40) < 0.5 && Math.abs(p.h - 40) < 0.5 && p.kant >= 1, `remsan ${bredd} px: "${p.namn}" är ${p.w}x${p.h} px med kant ${p.kant}, väntat 40x40 med kant.`);
      }
      const gm = rem.poster.filter((p) => p.markeW > 0 && p.namn && !/^(Alla|Fäll|Skapa)/.test(p.namn));
      krav(gm.length >= 2 && gm.every((p) => Math.abs(p.markeW - 34) < 0.5), `remsan ${bredd} px: gruppmärkena är ${gm.map((p) => p.markeW).join(", ")} px, väntat 34 (SS GroupMark sizePx=34).`);
      const aktivRad = rem.poster.find((p) => p.namn.startsWith("Claes"));
      krav(!!aktivRad && aktivRad.kantFarg === rem.accent, `remsan ${bredd} px: aktiv grupp har kantfärg ${aktivRad?.kantFarg}, väntat accent (${rem.accent}).`);
      for (const [lage, v] of /** @type {const} */ ([["utfälld", ut], ["infälld", in_]])) {
        matt.push(`panelen ${bredd} px ${lage}: logo x ${v.logoX.toFixed(1)} bredd ${v.logoW.toFixed(1)}, panel x ${v.panelX.toFixed(1)} innerbredd ${v.panelInnerW.toFixed(1)}, första barn ${v.forstTagg} ${v.forstW.toFixed(0)} px`);
        // ⛔ 0.31.0: MOT PANELENS INNEHÅLL, inte dess ytterkant. CP: "centrerad över gruppmenyn": loggan står över kortens bredd, som börjar `--panel-kant` (2 px) in.
        krav(Math.abs(v.logoX - v.panelInnerX) <= 1, `panelen ${bredd} px ${lage}: märkesrutans vänsterkant ${v.logoX.toFixed(1)} mot panelinnehållets ${v.panelInnerX.toFixed(1)}. Väntat högst 1 px skillnad (SS \`AppHeader.jsx:174\`, CP 2026-09-29).`);
        krav(Math.abs(v.logoW - v.panelInnerW) <= 1, `panelen ${bredd} px ${lage}: märkesrutan är ${v.logoW.toFixed(1)} px bred mot panelens innehåll ${v.panelInnerW.toFixed(1)}. Väntat högst 1 px.`);
        krav(v.forstTagg === "BUTTON", `panelen ${bredd} px ${lage}: panelens första barn är ${v.forstTagg}, väntat knappen för in- och utfällning (SS \`AppSidebar.jsx:51\`).`);
        krav(Math.abs(v.forstW - v.panelInnerW) <= 1, `panelen ${bredd} px ${lage}: knappen överst är ${v.forstW.toFixed(1)} px bred, väntat full bredd (${v.panelInnerW.toFixed(1)}).`);
        krav(Math.abs(v.forstTop - v.panelY) <= 1, `panelen ${bredd} px ${lage}: knappen överst börjar ${(v.forstTop - v.panelY).toFixed(1)} px under panelens överkant, väntat 0.`);
        krav(v.flikX !== null && v.flikX >= v.logoR - 0.5, `panelen ${bredd} px ${lage}: toppradens första flik (x ${v.flikX}) börjar före märkesrutans högerkant (${v.logoR.toFixed(1)}).`);
      }
      krav(ut.flikX !== null && in_.flikX !== null && ut.flikX - in_.flikX >= 20, `panelen ${bredd} px: toppradens flikar flyttade sig ${ut.flikX !== null && in_.flikX !== null ? (ut.flikX - in_.flikX).toFixed(0) : "?"} px när panelen fälldes in, väntat minst 20 (de börjar efter märkesrutan, SS \`AppHeader.jsx:194\`).`);
    }
  }
  await context.close();
}

// Bilderna till montaget (regel 12): 1024 px bredd i skala 2, alltså samma skala och beskärning som SS-bildrutorna (1600 px = 800 CSS-px).
if (bildmapp) {
  const { page, context } = await oppna("full", { width: 1024, height: 460 }, standardtema, 2);
  for (const lage of ["utfalld", "infalld"]) {
    if (lage === "infalld") {
      await page.locator('nav[aria-label="Alla mina grupper"] > button').first().click();
      await page.waitForTimeout(350);
    }
    await page.screenshot({ path: path.join(bildmapp, `panel-${lage}-skala2.png`), clip: { x: 0, y: 0, width: 800, height: 450 } });
  }
  await context.close();
}

// ══ 9. HUB: VARJE MODUL ÄR ETT KORT, EN MODUL MED BARN HAR EN EGEN SIDA (0.30.1) ═
// CP 2026-09-29 13:44: "ekonomi skall vara expanderbar", ändrat samma dag till modulkort med räknare och infolinje, en
// modulsida med tillbaka-rad och barnen som mindre kort. Rullgardinen i toppraden har en chevron som fäller ut barnen.
for (const [namn, vp] of /** @type {const} */ ([["1280 px", { width: 1280, height: 900 }], ["390 px", { width: 390, height: 844 }]])) {
  const { page, context } = await oppna("hub", vp);
  const kort = page.locator("main ul[aria-label] > li > a");
  const antal = await kort.count();
  krav(antal === 4, `Hub ${namn}: ${antal} modulkort ritades, väntat 4 (fyra moduler, varje kort en länk).`);
  if (antal === 4) {
    const k = await page.evaluate(() =>
      [...document.querySelectorAll("main ul[aria-label] > li > a")].map((a) => {
        const r = a.getBoundingClientRect();
        const rader = [...a.querySelectorAll("span")].map((sp) => (sp.textContent || "").trim());
        return { text: (a.textContent || "").trim(), x: r.x, y: Math.round(r.y), w: r.width, h: Math.round(r.height), flodar: a.scrollWidth > a.clientWidth + 1, rader };
      }),
    );
    matt.push(`Hub ${namn}: ${k.map((c) => `${c.text.slice(0, 22)} ${c.w.toFixed(0)}x${c.h}`).join(" | ")}`);
    const ekonomi = k.find((c) => c.text.startsWith("Ekonomi"));
    const schema = k.find((c) => c.text.startsWith("Schema"));
    const cutover = k.find((c) => c.text.startsWith("Cutover"));
    krav(!!ekonomi && ekonomi.text.includes("2") && ekonomi.text.includes("Skatten förfaller 12 oktober"), `Hub ${namn}: Ekonomi-kortet saknar räknaren 2 eller infolinjen ("${ekonomi?.text}").`);
    krav(!!schema && schema.text.includes("Inget nytt") && !/\b0\b/.test(schema.text), `Hub ${namn}: Schema med info null ska säga "Inget nytt" och ingen räknare ("${schema?.text}"), badge 0 ritas aldrig.`);
    krav(!!cutover && cutover.text === "Cutover", `Hub ${namn}: Cutover utan info och räknare ska bara bära namnet ("${cutover?.text}"): utelämnad info ritar ingenting.`);
    // Alla kort i en rad är lika höga.
    /** @type {Record<number, number[]>} */
    const rader = {};
    for (const c of k) (rader[c.y] ??= []).push(c.h);
    const olika = Object.entries(rader).filter(([, hs]) => Math.max(...hs) - Math.min(...hs) > 1);
    krav(olika.length === 0, `Hub ${namn}: kort i samma rad har olika höjd (${olika.map(([y, hs]) => `y=${y}: ${hs.join(", ")}`).join("; ")}).`);
    krav(k.every((c) => !c.flodar), `Hub ${namn}: text flödar ut ur ett kort (${k.filter((c) => c.flodar).map((c) => c.text.slice(0, 12)).join(", ")}).`);
    krav(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `Hub ${namn}: sidan flödar i sidled.`);
    // Ett klick öppnar modulen: kortet är en riktig länk och appen får ett `onNavigate`.
    await kort.filter({ hasText: "Ekonomi" }).click();
    const gick = await page.evaluate(() => window.__gick);
    krav(gick.length === 1 && gick[0] === "/ekonomi", `Hub ${namn}: klick på Ekonomi-kortet navigerade till ${JSON.stringify(gick)}, väntat ["/ekonomi"].`);
    if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `hub-${vp.width}.png`), fullPage: true });
  }
  if (vp.width > 800) {
    // Hub-rullgardinen i toppraden: Ekonomi är en rad med chevron, barnen infällda tills den trycks.
    await page.getByRole("button", { name: "Visa sidorna under Hub" }).click();
    const dd = page.locator('[role="dialog"]');
    await dd.waitFor();
    const rad = dd.getByRole("button", { name: /Ekonomi/ });
    const harRad = (await rad.count()) === 1;
    krav(harRad, "Hub-rullgardinen: Ekonomi har ingen chevronknapp.");
    const lankar = () => dd.evaluate((el) => [...el.querySelectorAll("a")].filter((a) => a.getBoundingClientRect().height > 0).map((a) => a.textContent));
    const l0 = await lankar();
    krav(!l0.includes("Inkomster"), `Hub-rullgardinen: Ekonomis barn syns från början (${l0.join(", ")}), väntat infällt.`);
    krav(harRad && (await rad.getAttribute("aria-expanded")) === "false", 'Hub-rullgardinen: chevronen bär inte aria-expanded="false" från början.');
    if (harRad) {
      await rad.click();
      const l1 = await lankar();
      krav(l1.includes("Inkomster") && l1.includes("Bokslut"), `Hub-rullgardinen: barnen syns inte efter klick på chevronen (${l1.join(", ")}).`);
      krav((await rad.getAttribute("aria-expanded")) === "true", 'Hub-rullgardinen: chevronen bär inte aria-expanded="true" efter klick.');
      if (bildmapp) await page.screenshot({ path: path.join(bildmapp, "hub-dropdown-utfalld.png"), clip: { x: 300, y: 0, width: 700, height: 520 } });
    }
  }
  await context.close();
}

// ══ 9b. MODULSIDAN: TILLBAKA-RAD OCH BARNEN SOM KORT (0.30.1) ════════════════
for (const [namn, vp] of /** @type {const} */ ([["1280 px", { width: 1280, height: 900 }], ["390 px", { width: 390, height: 844 }]])) {
  const { page, context } = await oppna("hubmodul", vp);
  const rad = page.locator('nav[aria-label="Var du är"]');
  krav((await rad.count()) === 1, `Modulsidan ${namn}: tillbaka-raden hittades inte.`);
  if ((await rad.count()) === 1) {
    const barn = await page.locator("main ul[aria-label] > li > a").evaluateAll((els) => els.map((a) => (a.textContent || "").trim()));
    matt.push(`Modulsidan ${namn}: ${barn.length} barnkort (${barn.join(" | ")})`);
    krav(barn.length === 6, `Modulsidan ${namn}: ${barn.length} barnkort, väntat 6.`);
    krav(barn[0]?.includes("1") && barn[0]?.includes("Ny faktura i går") && barn[1]?.includes("Inget nytt"), `Modulsidan ${namn}: barnkorten bär inte räknare och info ("${barn[0]}", "${barn[1]}").`);
    const tillbaka = rad.getByRole("link", { name: "Hub" });
    krav((await tillbaka.getAttribute("href")) === "/hub", `Modulsidan ${namn}: tillbaka-raden leder inte till /hub.`);
    krav((await rad.locator('[aria-current="page"]').textContent()) === "Ekonomi", `Modulsidan ${namn}: modulens namn saknas i tillbaka-raden.`);
    // ⛔ Sidan görs kort (240 px hög) så att den rullar: raden ligger fast så länge modulens lista syns, och en
    // sida som ryms utan rullning kan inte visa om raden är fast eller bara ligger överst.
    await page.setViewportSize({ width: vp.width, height: 240 });
    const fast = await page.evaluate(() => {
      let rullar = false;
      const n = document.querySelector('nav[aria-label="Var du är"]');
      window.scrollTo(0, 40);
      rullar = document.documentElement.scrollHeight > window.innerHeight;
      const r = n.getBoundingClientRect();
      return { rullar, position: getComputedStyle(n).position, top: r.top, topbar: parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--topbar-height")) || 56, hojd: r.height };
    });
    krav(fast.rullar, `Modulsidan ${namn}: sidan rullar inte i det låga fönstret, så "fast" går inte att mäta.`);
    krav(fast.position === "sticky" && Math.abs(fast.top - fast.topbar) <= 1, `Modulsidan ${namn}: tillbaka-raden ligger inte fast under toppraden efter rullning (position ${fast.position}, top ${fast.top}, väntat ${fast.topbar}).`);
    krav(fast.hojd >= 44, `Modulsidan ${namn}: tillbaka-raden är ${fast.hojd} px hög, väntat minst 44 (tumme).`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await tillbaka.click();
    const gick = await page.evaluate(() => window.__gick);
    krav(gick.length === 1 && gick[0] === "/hub", `Modulsidan ${namn}: tillbaka gick till ${JSON.stringify(gick)}, väntat ["/hub"].`);
    if (bildmapp) {
      await page.setViewportSize(vp);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(bildmapp, `hubmodul-${vp.width}.png`), clip: { x: 0, y: 0, width: vp.width, height: vp.width > 800 ? 560 : 844 } });
    }
  }
  await context.close();
}

// ══ 10. MÄRKET ÄR TEXT, I RÄTT TYPSNITT OCH RÄTT FÄRG, CENTRERAT ÖVER PANELEN (0.31.0) ═
// CP 2026-09-29: "Vi tar bort bilder, kör med text. Font: Glacial Indifference Regular. Colors: Light Gray och Gray
// Orange", och: "Logotext måste vara centrerad över gruppmenyn i båda lägen. Beakta ringen att den skall vara samma
// som för grupperna runt texten i infällt läge." Alla mått i en riktig webbläsare, aldrig jsdom (regel 12).
/** @param {import("playwright").Page} page */
const matMarke = (page) =>
  page.evaluate(() => {
    const q = (/** @type {string} */ sel) => document.querySelector(sel);
    const hex = (/** @type {string} */ token) => {
      const p = document.createElement("div");
      p.style.color = `var(${token})`;
      document.body.appendChild(p);
      const c = getComputedStyle(p).color;
      p.remove();
      return c;
    };
    const box = q('header a[href="/"] > span');
    const ord = q('header a[href="/"] [data-marke="ordmarke"]');
    const mono = q('header a[href="/"] [data-marke="monogram"]');
    const ruta = q('header a[href="/"] [data-marke="ruta"]');
    const rad1 = q('header a[href="/"] [data-marke="rad1"]');
    const rad2 = q('header a[href="/"] [data-marke="rad2"]');
    const panel = q('nav[aria-label="Alla mina grupper"]');
    const kort = panel ? panel.querySelector("ul > li") : null;
    const remsGrupp = [...document.querySelectorAll('nav[aria-label="Alla mina grupper"] ul button')].find((b) => b.getAttribute("aria-label") === "Testgruppen");
    /** Textens synliga mittlinje: raden minus den tomma spärrningen efter sista bokstaven. */
    const inkMitt = (/** @type {Element | null} */ el) => {
      if (!el) return null;
      const r = document.createRange();
      r.selectNodeContents(el);
      const b = r.getBoundingClientRect();
      const ls = parseFloat(getComputedStyle(el).letterSpacing) || 0;
      return (b.left + b.right - ls) / 2;
    };
    const stil = (/** @type {Element | null} */ el) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height, x: r.x, mittX: r.x + r.width / 2, radie: cs.borderTopLeftRadius, kantFarg: cs.borderTopColor, kantBredd: cs.borderTopWidth, bg: cs.backgroundColor };
    };
    const forsta = rad1 ? rad1.querySelector("span:first-child") : null;
    const andra = rad1 ? rad1.querySelector("span:nth-child(2)") : null;
    return {
      finns: { box: !!box, ord: !!ord, mono: !!mono, ruta: !!ruta, rad1: !!rad1, panel: !!panel },
      bilder: box ? box.querySelectorAll("img").length : -1,
      bakgrundsbild: box ? [...box.querySelectorAll("*")].filter((e) => getComputedStyle(e).backgroundImage !== "none").length : -1,
      ordOpacity: ord ? parseFloat(getComputedStyle(ord).opacity) : null,
      monoOpacity: mono ? parseFloat(getComputedStyle(mono).opacity) : null,
      tid: ord ? getComputedStyle(ord).transitionDuration : null,
      tidMono: mono ? getComputedStyle(mono).transitionDuration : null,
      rad1Text: rad1 ? rad1.textContent : null,
      rad2Text: rad2 ? rad2.textContent : null,
      rad1Storlek: rad1 ? parseFloat(getComputedStyle(rad1).fontSize) : null,
      rad1Sparrning: rad1 ? parseFloat(getComputedStyle(rad1).letterSpacing) : null,
      rad2Storlek: rad2 ? parseFloat(getComputedStyle(rad2).fontSize) : null,
      familj: rad1 ? getComputedStyle(rad1).fontFamily : null,
      transform: rad1 ? getComputedStyle(rad1).textTransform : null,
      fontLaddad: document.fonts.check('16px "Glacial Indifference"'),
      fontStatus: [...document.fonts].filter((f) => f.family.includes("Glacial")).map((f) => f.status),
      passar: [rad1, rad2].filter(Boolean).map((el) => ({ sw: /** @type {HTMLElement} */ (el).scrollWidth, cw: /** @type {HTMLElement} */ (el).clientWidth })),
      hojd: ord ? ord.getBoundingClientRect().height : null,
      boxRut: stil(box),
      farg: { ink: hex("--color-ink"), marke: hex("--color-marke-accent") },
      rad1Farg: forsta ? getComputedStyle(forsta).color : null,
      rad1AndraFarg: andra ? getComputedStyle(andra).color : null,
      rad2Farg: rad2 ? getComputedStyle(rad2).color : null,
      textMitt: inkMitt(rad1),
      text2Mitt: inkMitt(rad2),
      kortMitt: kort ? kort.getBoundingClientRect().x + kort.getBoundingClientRect().width / 2 : null,
      ruta: stil(ruta),
      remsa: stil(remsGrupp ?? null),
    };
  });

for (const bredd of [1280, 1600]) {
  const { page, context } = await oppna("full", { width: bredd, height: 900 }, standardtema, 1, "g3");
  await page.evaluate(() => document.fonts.ready);
  const ut = await matMarke(page);
  krav(ut.finns.box && ut.finns.ord && ut.finns.rad1 && ut.finns.mono && ut.finns.ruta && ut.finns.panel, `märket ${bredd} px: delar saknas i DOM (${JSON.stringify(ut.finns)}). Väntat ordmärke, monogram och ruta.`);
  if (ut.finns.rad1 && ut.finns.mono) {
    matt.push(`märket ${bredd} px utfälld: rad 1 "${ut.rad1Text}" ${ut.rad1Storlek} px spärrning ${ut.rad1Sparrning} px, rad 2 "${ut.rad2Text}" ${ut.rad2Storlek} px, typsnitt ${ut.familj}, ordmärkets höjd ${ut.hojd} px, textens mitt ${ut.textMitt?.toFixed(2)} / ${ut.text2Mitt?.toFixed(2)} mot kortens ${ut.kortMitt?.toFixed(2)}`);
    krav(ut.bilder === 0 && ut.bakgrundsbild === 0, `märket ${bredd} px: ${ut.bilder} <img> och ${ut.bakgrundsbild} bakgrundsbilder i märket. Väntat 0: märket är text sedan 0.31.0.`);
    krav(ut.fontLaddad === true && ut.fontStatus.length >= 1 && ut.fontStatus.every((/** @type {string} */ x) => x === "loaded"), `märket ${bredd} px: Glacial Indifference är inte laddad (document.fonts.check ${ut.fontLaddad}, status ${JSON.stringify(ut.fontStatus)}). Märket ritas då i reservtypsnittet.`);
    krav(/Glacial Indifference/.test(ut.familj ?? ""), `märket ${bredd} px: raden ritas i "${ut.familj}", väntat Glacial Indifference först (--font-marke).`);
    krav(ut.transform === "uppercase", `märket ${bredd} px: rad 1 har text-transform ${ut.transform}, väntat versaler (uppercase).`);
    krav(ut.rad1Text === "OPS HUB" && ut.rad2Text === "CLAES PHILIP STAIGER AB", `märket ${bredd} px: raderna är "${ut.rad1Text}" och "${ut.rad2Text}", väntat "OPS HUB" och den aktiva gruppens namn i versaler.`);
    krav(Math.abs((ut.rad1Storlek ?? 0) - 13) < 0.1 && Math.abs((ut.rad2Storlek ?? 0) - 9.5) < 0.1, `märket ${bredd} px: storlekarna är ${ut.rad1Storlek} och ${ut.rad2Storlek} px, väntat 13 och 9,5 (mätta i CP:s bild).`);
    krav(ut.passar.length === 2 && ut.passar.every((/** @type {{ sw: number, cw: number }} */ x) => x.sw <= x.cw), `märket ${bredd} px: texten ryms inte i sin ruta (${JSON.stringify(ut.passar)}). Väntat scrollWidth <= clientWidth på båda raderna.`);
    krav((ut.hojd ?? 999) <= 56, `märket ${bredd} px: ordmärket är ${ut.hojd} px högt, väntat högst toppradens 56.`);
    krav(ut.rad1Farg === ut.farg.ink && ut.rad2Farg === ut.farg.ink, `märket ${bredd} px: OPS och undertexten är ${ut.rad1Farg} / ${ut.rad2Farg}, väntat ink (${ut.farg.ink}).`);
    krav(ut.rad1AndraFarg === ut.farg.marke, `märket ${bredd} px: HUB är ${ut.rad1AndraFarg}, väntat --color-marke-accent (${ut.farg.marke}).`);
    krav((ut.ordOpacity ?? 0) === 1 && (ut.monoOpacity ?? 1) === 0, `märket ${bredd} px utfälld: ordmärkets opacity ${ut.ordOpacity} och monogrammets ${ut.monoOpacity}, väntat 1 och 0.`);
    krav(ut.tid === "0.2s" && ut.tidMono === "0.2s", `märket ${bredd} px: crossfaden är ${ut.tid} / ${ut.tidMono}, väntat 0.2s (SS \`AppHeader.jsx:174-193\`, 200 ms).`);
    krav(ut.textMitt !== null && ut.kortMitt !== null && Math.abs(ut.textMitt - ut.kortMitt) <= 1, `märket ${bredd} px utfälld: rad 1 har mittlinje ${ut.textMitt?.toFixed(2)} mot kortens ${ut.kortMitt?.toFixed(2)}. Väntat högst 1 px (CP: centrerad över gruppmenyn).`);
    krav(ut.text2Mitt !== null && ut.kortMitt !== null && Math.abs(ut.text2Mitt - ut.kortMitt) <= 1, `märket ${bredd} px utfälld: rad 2 har mittlinje ${ut.text2Mitt?.toFixed(2)} mot kortens ${ut.kortMitt?.toFixed(2)}. Väntat högst 1 px.`);
  }

  await page.locator('nav[aria-label="Alla mina grupper"] > button').first().click();
  await page.waitForTimeout(350);
  const in_ = await matMarke(page);
  matt.push(`märket ${bredd} px infälld: ruta ${JSON.stringify(in_.ruta)} mot remsans ${JSON.stringify(in_.remsa)}`);
  krav(in_.ruta !== null && in_.remsa !== null, `märket ${bredd} px infälld: monogramrutan eller remsans grupprutor hittades inte.`);
  if (in_.ruta && in_.remsa) {
    for (const f of /** @type {const} */ (["w", "h", "radie", "kantFarg", "kantBredd", "bg"])) {
      krav(in_.ruta[f] === in_.remsa[f], `märket ${bredd} px infälld: monogramrutans ${f} är ${in_.ruta[f]}, remsans ${in_.remsa[f]}. CP: exakt samma ruta som grupperna (storlek, rundning, kant, yta).`);
    }
    krav(Math.abs(in_.ruta.mittX - in_.remsa.mittX) <= 1, `märket ${bredd} px infälld: monogrammets mittlinje ${in_.ruta.mittX.toFixed(2)} mot remsans ${in_.remsa.mittX.toFixed(2)}. Väntat högst 1 px.`);
    krav(Math.abs(in_.ruta.w - 40) < 0.5, `märket ${bredd} px infälld: rutan är ${in_.ruta.w} px bred, väntat 40.`);
  }
  krav((in_.monoOpacity ?? 0) === 1 && (in_.ordOpacity ?? 1) === 0, `märket ${bredd} px infälld: monogrammets opacity ${in_.monoOpacity} och ordmärkets ${in_.ordOpacity}, väntat 1 och 0.`);
  krav(in_.bilder === 0, `märket ${bredd} px infälld: ${in_.bilder} <img> i märket.`);
  await context.close();
}

// Bilderna till montaget (0.31.0): skala 2,283, alltså samma skala som CP:s förlagor (panelens kort är 411 bildpixlar mot 180 CSS-pixlar).
if (bildmapp) {
  const { page, context } = await oppna("full", { width: 1024, height: 460 }, standardtema, 2.283, "g3");
  await page.evaluate(() => document.fonts.ready);
  for (const lage of ["utfalld", "infalld"]) {
    if (lage === "infalld") {
      await page.locator('nav[aria-label="Alla mina grupper"] > button').first().click();
      await page.waitForTimeout(350);
    }
    await page.screenshot({ path: path.join(bildmapp, `marke-${lage}-${standardtema}.png`), clip: { x: 0, y: 0, width: 800, height: 300 } });
  }
  await context.close();
}

// Ett långt gruppnamn får inte vidga märkesrutan: raden kapas med ellipsis och rutan är fortfarande 180 px.
{
  const { page, context } = await oppna("full", { width: 1280, height: 900 }, standardtema, 1, "g1");
  await page.evaluate(() => document.fonts.ready);
  const m = await matMarke(page);
  krav(m.boxRut !== null && Math.abs(m.boxRut.w - 180) < 0.5 && (m.hojd ?? 999) <= 56, `märket med långt gruppnamn: rutan är ${m.boxRut?.w} px bred och ${m.hojd} px hög, väntat 180 och högst 56 (namnet kapas, rutan växer inte).`);
  await context.close();
}

// Utan vald grupp ("Alla mina grupper") och utan undertext: bara rad 1, centrerad lodrätt i rutan.
{
  const { page, context } = await oppna("full", { width: 1280, height: 900 }, standardtema, 1, "alla");
  await page.evaluate(() => document.fonts.ready);
  const m = await page.evaluate(() => {
    const rad1 = document.querySelector('header a[href="/"] [data-marke="rad1"]');
    const box = document.querySelector('header a[href="/"] > span');
    if (!rad1 || !box) return null;
    const r = rad1.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    return { rad2: !!document.querySelector('header a[href="/"] [data-marke="rad2"]'), mittY: r.y + r.height / 2, boxMittY: b.y + b.height / 2 };
  });
  krav(m !== null && m.rad2 === false, "märket i läget Alla mina grupper: rad 2 ritas trots att ingen grupp är vald och ingen undertext finns. Väntat bara rad 1.");
  krav(m !== null && Math.abs(m.mittY - m.boxMittY) <= 1, `märket utan undertext: rad 1 mitt ${m?.mittY.toFixed(1)} mot rutans ${m?.boxMittY.toFixed(1)}. Väntat lodrätt centrerad (högst 1 px).`);
  await context.close();
}

// 390 px: monogramrutan i mobilens huvud, vänsterställd, exakt 40 px, och ordmärket syns inte.
{
  const { page, context } = await oppna("full", { width: 390, height: 844 }, standardtema, 1, "g3");
  await page.evaluate(() => document.fonts.ready);
  const m = await matMarke(page);
  krav(m.ruta !== null && Math.abs(m.ruta.w - 40) < 0.5 && Math.abs(m.ruta.h - 40) < 0.5, `märket 390 px: monogramrutan är ${m.ruta?.w}x${m.ruta?.h} px, väntat 40x40.`);
  krav(m.ruta !== null && Math.abs(m.ruta.x - 16) <= 1, `märket 390 px: monogramrutan börjar på x ${m.ruta?.x.toFixed(1)}, väntat 16 (huvudets vänsterkant, vänsterställd som SS).`);
  krav((m.monoOpacity ?? 0) === 1 && (m.ordOpacity ?? 1) === 0, `märket 390 px: monogrammets opacity ${m.monoOpacity} och ordmärkets ${m.ordOpacity}, väntat 1 och 0.`);
  krav(m.bilder === 0, `märket 390 px: ${m.bilder} <img> i märket.`);
  await context.close();
}

// Inloggningen: samma märke, större, centrerat, inga bilder.
for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  const { page, context } = await oppna("inloggning", vp);
  await page.evaluate(() => document.fonts.ready);
  const m = await page.evaluate(() => {
    const rad1 = document.querySelector('[data-marke="rad1"]');
    const rad2 = document.querySelector('[data-marke="rad2"]');
    if (!rad1) return null;
    const r = rad1.getBoundingClientRect();
    const dok = document.documentElement;
    // Kortet är kolumnens bredd (max 360 px, centrerad i sidan): sidans mittlinje är kortets.
    const kort = document.querySelector("h2")?.closest("div.relative, [class*='rounded']");
    const kr = kort ? kort.getBoundingClientRect() : null;
    const rg = document.createRange();
    rg.selectNodeContents(rad1);
    const b = rg.getBoundingClientRect();
    return {
      text: rad1.textContent,
      under: rad2 ? rad2.textContent : null,
      storlek: parseFloat(getComputedStyle(rad1).fontSize),
      understorlek: rad2 ? parseFloat(getComputedStyle(rad2).fontSize) : null,
      familj: getComputedStyle(rad1).fontFamily,
      synlig: r.width > 0 && r.height > 0 && r.x >= 0 && r.right <= dok.clientWidth,
      bilder: document.querySelectorAll("img").length,
      fontLaddad: document.fonts.check('16px "Glacial Indifference"'),
      passar: [rad1, rad2].filter(Boolean).map((el) => ({ sw: /** @type {HTMLElement} */ (el).scrollWidth, cw: /** @type {HTMLElement} */ (el).clientWidth })),
      mittX: (b.left + b.right - (parseFloat(getComputedStyle(rad1).letterSpacing) || 0)) / 2,
      kortMittX: kr ? kr.x + kr.width / 2 : null,
      overflow: dok.scrollWidth > dok.clientWidth,
    };
  });
  krav(m !== null, `inloggningen ${vp.width} px: ingen märkestext ritades (data-marke=rad1 saknas).`);
  if (m) {
    matt.push(`inloggningen ${vp.width} px: rad 1 "${m.text}" ${m.storlek} px, rad 2 "${m.under}" ${m.understorlek} px, mitt ${m.mittX.toFixed(1)} mot kortets ${m.kortMittX?.toFixed(1)}`);
    krav(m.text === "OPS HUB" && m.under === "Bolag Ops", `inloggningen ${vp.width} px: raderna är "${m.text}" och "${m.under}", väntat "OPS HUB" och appens namn.`);
    krav(Math.abs(m.storlek - 32) < 0.1, `inloggningen ${vp.width} px: rad 1 är ${m.storlek} px, väntat 32.`);
    krav(m.synlig, `inloggningen ${vp.width} px: märket syns inte helt i vyn.`);
    krav(m.bilder === 0, `inloggningen ${vp.width} px: ${m.bilder} <img> på sidan. Väntat 0: inga bilder.`);
    krav(m.fontLaddad === true && /Glacial Indifference/.test(m.familj), `inloggningen ${vp.width} px: typsnittet är inte Glacial Indifference (${m.familj}, laddad ${m.fontLaddad}).`);
    krav(m.passar.every((/** @type {{ sw: number, cw: number }} */ x) => x.sw <= x.cw), `inloggningen ${vp.width} px: texten ryms inte (${JSON.stringify(m.passar)}).`);
    krav(m.kortMittX !== null && Math.abs(m.mittX - m.kortMittX) <= 1, `inloggningen ${vp.width} px: märkets mittlinje ${m.mittX.toFixed(1)} mot kortets ${m.kortMittX?.toFixed(1)}. Väntat centrerat (högst 1 px).`);
    krav(!m.overflow, `inloggningen ${vp.width} px: horisontell överflödning.`);
  }
  if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `inloggning-${vp.width}.png`) });
  await context.close();
}

// ══ 11. TOPPRADENS FLIKAR: CHEVRONEN LIGGER INNE I FLIKEN (0.31.0, avsnitt 9) ═
// CP 2026-09-29: "Hub ⌄ står längre bort än Idag och Kalender". SS `AppHeader.jsx:217-230`: en flik, chevronen `ml-0.5` efter ordet.
// Mått: ordet och chevronen högst 4 px isär, flikens luft efter chevronen = luften före ordet = en vanlig flik (±1 px).
for (const bredd of [900, 1280, 1600]) {
  const { page, context } = await oppna("full", { width: bredd, height: 800 });
  const t = await page.evaluate(() => {
    const lankar = [...document.querySelectorAll("header a")];
    /** @param {string} etikett */
    const mat = (etikett) => {
      const a = lankar.find((x) => (x.textContent || "").trim() === etikett);
      if (!a) return null;
      const box = a.parentElement && a.parentElement.tagName === "SPAN" && a.parentElement.querySelector("button") ? a.parentElement : a;
      const rg = document.createRange();
      rg.selectNodeContents(a);
      const ord = rg.getBoundingClientRect();
      const chev = box.querySelector("svg");
      const br = box.getBoundingClientRect();
      const cr = chev ? chev.getBoundingClientRect() : null;
      return { boxL: br.left, boxR: br.right, ordL: ord.left, ordR: ord.right, chevL: cr ? cr.left : null, chevR: cr ? cr.right : null };
    };
    return { idag: mat("Idag"), kalender: mat("Kalender"), hub: mat("Hub") };
  });
  const ok = !!t.idag && !!t.kalender && !!t.hub && t.hub.chevL !== null;
  krav(ok, `flikarna ${bredd} px: Idag, Kalender eller Hub med chevron hittades inte.`);
  if (ok) {
    const h = /** @type {any} */ (t.hub);
    const luftFore = (/** @type {any} */ x) => x.ordL - x.boxL;
    const luftEfter = (/** @type {any} */ x) => x.boxR - (x.chevR ?? x.ordR);
    const vanlig = luftFore(t.idag);
    matt.push(`flikarna ${bredd} px: luft före ordet Idag ${vanlig.toFixed(1)}, Kalender ${luftFore(t.kalender).toFixed(1)}, Hub ${luftFore(h).toFixed(1)}; efter Hub-chevronen ${luftEfter(h).toFixed(1)}; ord till chevron ${(h.chevL - h.ordR).toFixed(1)} px; avstånd Idag till Kalender ${(t.kalender.ordL - t.idag.ordR).toFixed(1)}, Kalender till Hub ${(h.ordL - t.kalender.ordR).toFixed(1)}`);
    krav(h.chevL - h.ordR <= 6, `flikarna ${bredd} px: chevronen står ${(h.chevL - h.ordR).toFixed(1)} px efter ordet Hub, väntat högst 6 (SS ml-0.5 plus ikonens egen marginal): den ligger inte inne i fliken.`);
    krav(Math.abs(luftEfter(h) - vanlig) <= 1, `flikarna ${bredd} px: luften efter Hub-chevronen är ${luftEfter(h).toFixed(1)} px mot en vanlig fliks ${vanlig.toFixed(1)} (±1).`);
    const gap1 = t.kalender.ordL - t.idag.ordR;
    const gap2 = h.ordL - t.kalender.ordR;
    krav(Math.abs(gap1 - gap2) <= 1, `flikarna ${bredd} px: avståndet Idag till Kalender är ${gap1.toFixed(1)} px, Kalender till Hub ${gap2.toFixed(1)} (±1).`);
  }
  await context.close();
}

// ══ 12. MODULSIDANS TILLBAKA-RAD HÅLLS I INNEHÅLLSKOLUMNEN (0.31.0, avsnitt 10) ═
// CP: raden "‹ Hub / Ekonomi" ritades över den infällda gruppanelen. Radens ruta får aldrig korsa panelens, panelen
// ligger över raden i z-led, raden är inte bredare än kortens rutnät och har ingen negativ marginal.
for (const bredd of [1280, 1600]) {
  for (const lage of /** @type {const} */ (["utfälld", "infälld"])) {
    const { page, context } = await oppna("hubmodul", { width: bredd, height: 900 });
    if (lage === "infälld") {
      await page.locator('nav[aria-label="Alla mina grupper"] > button').first().click();
      await page.waitForTimeout(350);
    }
    const m = await page.evaluate(() => {
      const rad = document.querySelector('nav[aria-label="Var du är"]');
      const panel = document.querySelector('nav[aria-label="Alla mina grupper"]');
      const rutnat = document.querySelector("main ul[aria-label]");
      if (!rad || !panel || !rutnat) return null;
      const r = rad.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      const u = rutnat.getBoundingClientRect();
      const kol = /** @type {HTMLElement} */ (panel.parentElement && panel.parentElement.parentElement);
      return {
        radL: r.left, radR: r.right, panelR: p.right, rutL: u.left, rutR: u.right,
        marginL: parseFloat(getComputedStyle(rad).marginLeft), marginR: parseFloat(getComputedStyle(rad).marginRight),
        zRad: parseInt(getComputedStyle(rad).zIndex, 10),
        zPanel: parseInt(getComputedStyle(/** @type {HTMLElement} */ (panel.closest(".lg\\:sticky, [class*='lg:sticky']"))).zIndex, 10),
        kolL: kol ? kol.getBoundingClientRect().right : null,
      };
    });
    krav(m !== null, `tillbaka-raden ${bredd} px ${lage}: raden, panelen eller rutnätet hittades inte.`);
    if (m) {
      matt.push(`tillbaka-raden ${bredd} px ${lage}: rad ${m.radL.toFixed(1)}..${m.radR.toFixed(1)}, panelens högerkant ${m.panelR.toFixed(1)}, rutnät ${m.rutL.toFixed(1)}..${m.rutR.toFixed(1)}, z rad ${m.zRad} panel ${m.zPanel}, marginaler ${m.marginL}/${m.marginR}`);
      krav(m.radL >= m.panelR - 0.5, `tillbaka-raden ${bredd} px ${lage}: radens vänsterkant ${m.radL.toFixed(1)} ligger till vänster om panelens högerkant ${m.panelR.toFixed(1)}: raden korsar panelen.`);
      krav(m.marginL >= 0 && m.marginR >= 0, `tillbaka-raden ${bredd} px ${lage}: negativ marginal (${m.marginL}/${m.marginR}).`);
      krav(Math.abs(m.radL - m.rutL) <= 1 && Math.abs(m.radR - m.rutR) <= 1, `tillbaka-raden ${bredd} px ${lage}: raden ${m.radL.toFixed(1)}..${m.radR.toFixed(1)} är inte lika bred som kortens rutnät ${m.rutL.toFixed(1)}..${m.rutR.toFixed(1)}: den hålls inte i innehållskolumnen.`);
      krav(Number.isFinite(m.zRad) && Number.isFinite(m.zPanel) && m.zPanel > m.zRad, `tillbaka-raden ${bredd} px ${lage}: panelens z-index (${m.zPanel}) är inte över radens (${m.zRad}).`);
    }
    await context.close();
  }
}

// ══ 13. MENYN HAR EN BREDD: AKTIVITET ÖPPNAS I SAMMA RULLGARDIN (0.31.0, avsnitt 13) ═
// CP: "Aktivitet ... Modalen blir superbred. Skall vara samma som i dropdown så det inte känns hackigt." SS `AppHeader.jsx:514` `w-80`.
// Mått: rullgardinens bredd, position och rundning före och efter att Aktivitet öppnats (högst 1 px), tillbaka-pil i rubriken,
// och raden utan ikon ("Primitiver") står i samma kolumn som raderna med.
{
  const { page, context } = await oppna("meny", { width: 1280, height: 800 });
  await page.getByRole("button", { name: /Meny, fler/ }).click();
  await page.waitForSelector('[role="dialog"]');
  const yta = () =>
    page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      if (!d) return null;
      const r = d.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, radie: getComputedStyle(d).borderTopLeftRadius, right: r.right };
    });
  const kol = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    const x = (/** @type {string} */ t) => {
      const el = [...(d ? d.querySelectorAll("a, button") : [])].find((e) => (e.textContent || "").includes(t));
      const span = el ? [...el.querySelectorAll("span")].find((s) => (s.textContent || "").trim() === t) : null;
      return span ? span.getBoundingClientRect().left : null;
    };
    return { sida: x("Appens egen sida"), primitiver: x("Primitiver") };
  });
  krav(kol.sida !== null && kol.primitiver !== null && Math.abs(kol.sida - kol.primitiver) <= 1, `menyn 1280 px: raden utan ikon börjar på x ${kol.primitiver} mot raden med ikon på ${kol.sida}. Väntat samma kolumn (±1 px).`);
  const fore = await yta();
  await page.getByRole("button", { name: /Aktivitet/ }).click();
  await page.waitForTimeout(150);
  const efter = await yta();
  krav(fore !== null && efter !== null, "menyn 1280 px: rullgardinen hittades inte före eller efter Aktivitet.");
  if (fore && efter) {
    matt.push(`menyn 1280 px: bredd ${fore.w.toFixed(1)} före och ${efter.w.toFixed(1)} efter Aktivitet, x ${fore.x.toFixed(1)}/${efter.x.toFixed(1)}, y ${fore.y.toFixed(1)}/${efter.y.toFixed(1)}, rundning ${fore.radie}/${efter.radie}; rad utan ikon x ${kol.primitiver?.toFixed(1)} mot ${kol.sida?.toFixed(1)}`);
    krav(Math.abs(fore.w - efter.w) <= 1, `menyn 1280 px: bredden ${fore.w.toFixed(1)} före och ${efter.w.toFixed(1)} efter att Aktivitet öppnats. Väntat högst 1 px skillnad: undervyn ritas i samma ruta.`);
    krav(Math.abs(fore.right - efter.right) <= 1 && Math.abs(fore.y - efter.y) <= 1, `menyn 1280 px: ytan flyttade sig när Aktivitet öppnades (höger ${fore.right.toFixed(1)} till ${efter.right.toFixed(1)}, y ${fore.y.toFixed(1)} till ${efter.y.toFixed(1)}).`);
    krav(fore.radie === efter.radie, `menyn 1280 px: rundningen ändrades (${fore.radie} till ${efter.radie}).`);
    krav(fore.w >= 300 && fore.w <= 340, `menyn 1280 px: bredden är ${fore.w.toFixed(1)}, väntat cirka 320 (SS w-80).`);
  }
  krav((await page.getByRole("button", { name: "Tillbaka till menyn" }).count()) === 1, "menyn 1280 px: Aktivitet har ingen tillbaka-pil i rubriken.");
  if (bildmapp) await page.screenshot({ path: path.join(bildmapp, "meny-aktivitet-1280.png"), clip: { x: 800, y: 0, width: 480, height: 500 } });
  await context.close();
}

// ══ 14. TYP, DATUM OCH TID GÅR ATT VÄLJA INUTI EN MODAL (0.31.0, avsnitt 11) ══
// CP: "Ny händelse: datum går inte att välja, och det finns ingen tidsväljare", "Går heller inte att välja typ i dropdown".
// Rotorsak: listorna ritades på `--z-dropdown` (200) och modalen på `--z-modal` (400), alltså bakom modalen; och
// `OpsDatePicker` gav react-day-picker en STYRD månad, så pilarna dog när ett datum var valt. Mått: listan syns, ligger
// inom vyn, det som ligger överst i mittpunkten av ett val ÄR listan (inte modalen), valet når värdet, Escape stänger bara listan.
for (const [namn, vp] of /** @type {const} */ ([["390 px", { width: 390, height: 844 }], ["1280 px", { width: 1280, height: 800 }]])) {
  const { page, context } = await oppna("modal", vp);
  let vantat = 0;
  /** @type {any} */
  let typVal = {};
  /** @type {any} */
  let dag = {};
  let varde = async () => ({});
  try {
  vantat = await page.locator("[data-saknas]").count();
  // Modalens mått är SS `ModalShell`: `md` max-w-2xl (672 px) och rundningen `--radius` (12 px), från md.
  if (vp.width >= 800) {
    const dm = await page.evaluate(() => { const d = /** @type {HTMLElement} */ (document.querySelector('[role="dialog"]')); const r = d.getBoundingClientRect(); return { w: r.width, radie: parseFloat(getComputedStyle(d).borderTopLeftRadius) }; });
    matt.push(`modalen ${namn}: ${dm.w.toFixed(0)} px bred, rundning ${dm.radie} px`);
    krav(Math.abs(dm.w - 672) <= 1 && dm.radie === 12, `modalen ${namn}: ${dm.w.toFixed(0)} px bred och rundning ${dm.radie}, väntat 672 och 12 (SS ModalShell size md, --radius).`);
  }
  krav(vantat === 0, `modalen ${namn}: OpsTimePicker finns inte i den här versionen (ingen tidsväljare).`);
  /** @param {string} valjare @param {string} text */
  const overst = (valjare, text) =>
    page.evaluate(
      ([v, t]) => {
        const el = [...document.querySelectorAll(v)].find((e) => (e.textContent || "").trim() === t);
        if (!el) return { finns: false };
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        const top = document.elementFromPoint(x, y);
        return { finns: true, iVyn: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, overst: !!top && (el === top || el.contains(top) || top.contains(el)) };
      },
      [valjare, text],
    );
  varde = async () => JSON.parse((await page.locator("[data-varde]").textContent()) || "{}");

  // Typ
  await page.getByRole("combobox", { name: "Typ" }).click();
  const typLista = await page.locator('[role="listbox"]').count();
  krav(typLista === 1, `modalen ${namn}: typlistan öppnades inte (${typLista} listor).`);
  typVal = await overst('[role="option"]', "Deadline");
  krav(typVal.finns === true && typVal.iVyn === true && typVal.overst === true, `modalen ${namn}: typlistans val "Deadline" ${JSON.stringify(typVal)}: väntat synligt, inom vyn och överst (ej bakom modalen).`);
  if (typVal.finns) {
    await page.getByRole("option", { name: "Deadline" }).click({ timeout: 3000 }).catch(() => krav(false, `modalen ${namn}: "Deadline" gick inte att klicka (något ligger över listan).`));
    krav((await varde()).typ === "deadline", `modalen ${namn}: valet nådde inte formulärets typ (${JSON.stringify(await varde())}).`);
  }

  // Datum (en typlista som blev kvar öppen stängs först, så att resten av provet kan mäta sitt)
  if ((await page.locator('[role="listbox"]').count()) > 0) await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Datum", exact: true }).click({ timeout: 3000 }).catch(() => krav(false, `modalen ${namn}: datumknappen gick inte att trycka på.`));
  dag = await overst('[role="gridcell"] button', "15");
  krav(dag.finns === true && dag.iVyn === true && dag.overst === true, `modalen ${namn}: kalenderns dag 15 ${JSON.stringify(dag)}: väntat synlig, inom vyn och överst.`);
  if (dag.finns) {
    await page.locator('[role="gridcell"] button:not([disabled])', { hasText: /^15$/ }).first().click({ timeout: 3000 }).catch(() => krav(false, `modalen ${namn}: dag 15 gick inte att klicka (något ligger över kalendern).`));
    krav(/-15$/.test((await varde()).datum || ""), `modalen ${namn}: dag 15 nådde inte formulärets datum (${JSON.stringify(await varde())}).`);
    // Månadsnavigering efter ett valt datum (rotorsaken: styrd månad).
    await page.getByRole("button", { name: "Datum", exact: true }).click();
    const rubrikFore = await page.locator('[role="grid"]').first().evaluate((g) => g.closest("[data-radix-popper-content-wrapper]")?.textContent?.slice(0, 40) ?? "");
    await page.getByRole("button", { name: /next|nästa|Go to the Next Month/i }).first().click();
    const rubrikEfter = await page.locator('[role="grid"]').first().evaluate((g) => g.closest("[data-radix-popper-content-wrapper]")?.textContent?.slice(0, 40) ?? "");
    krav(rubrikFore !== rubrikEfter, `modalen ${namn}: månadspilen gjorde ingenting med ett valt datum (${rubrikFore} / ${rubrikEfter}).`);
    // Escape stänger kalendern men inte modalen.
    await page.keyboard.press("Escape");
    krav((await page.locator('[role="grid"]').count()) === 0, `modalen ${namn}: Escape stängde inte kalendern.`);
    krav((await page.locator('[role="dialog"]').count()) >= 1, `modalen ${namn}: Escape stängde hela modalen i stället för bara kalendern.`);
  }

  // Tid
  if (vantat === 0) {
    await page.getByRole("combobox", { name: "Timme" }).click();
    const tim = await overst('[role="option"]', "01");
    krav(tim.finns === true && tim.iVyn === true && tim.overst === true, `modalen ${namn}: timlistans val "01" ${JSON.stringify(tim)}: väntat synligt, inom vyn och överst.`);
    await page.getByRole("option", { name: "01" }).click({ timeout: 3000 }).catch(() => krav(false, `modalen ${namn}: timme 01 gick inte att klicka.`));
    await page.getByRole("combobox", { name: "Minut" }).click({ timeout: 3000 }).catch(() => {});
    await page.getByRole("option", { name: "30", exact: true }).click({ timeout: 3000 }).catch(() => krav(false, `modalen ${namn}: minut 30 gick inte att klicka.`));
    krav((await varde()).tid === "01:30", `modalen ${namn}: tiden blev ${JSON.stringify((await varde()).tid)}, väntat "01:30".`);
    // Tangentbord: fokusera timknappen, öppna med Enter, välj med pilar och Enter.
    await page.getByRole("combobox", { name: "Timme" }).focus();
    await page.keyboard.press("Enter");
    await page.waitForSelector('[role="option"][data-highlighted]');
    await page.waitForTimeout(150);
    // Radix flyttar fokus till det valda valet först efter en ram: pila tills nästa val är markerat (högst tre gånger).
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(60);
      if ((await page.locator('[role="option"][data-highlighted]').first().textContent().catch(() => "")) === "02") break;
    }
    await page.keyboard.press("Enter");
    const efterTangent = (await varde()).tid;
    krav(efterTangent === "02:30", `modalen ${namn}: tangentbordsval (Enter, pil ned, Enter) av timme gav ${JSON.stringify(efterTangent)}, väntat "02:30".`);
  }
  } catch (e) {
    krav(false, `modalen ${namn}: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}): något i kedjan gick inte att göra.`);
  }
  matt.push(`modalen ${namn}: typ ${JSON.stringify(typVal)}, dag 15 ${JSON.stringify(dag)}, värde ${JSON.stringify(await varde())}`);
  if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `modal-${vp.width}.png`) });
  await context.close();
}

// ══ 15. SKAPA ÄR EN PANEL, INTE EN MODAL, OCH "SKAPA I" ÄR EN DIALOG (0.31.0, avsnitt 16 och 12) ═
// CP: "Låt det vara paneler istället för modaler precis som i sessionstudio", och (15:01, 390 px): arket täckte hela huvudet, nästa
// fält klipptes utan knapprad, och valkorten var höga med stor text. Mått: ingen role=dialog för formuläret, panelen i
// innehållskolumnen på dator (max 880 px, centrerad, huvudet och gruppanelen kvar, fast knapprad längst ned till höger) och helskärm
// på telefon (rubrikrad, minst tre valkort och knappraden samtidigt, ingen överflödning, tangentbord simulerat med 500 px höjd).
/** @param {import("playwright").Page} page @param {boolean} mobil */
async function oppnaSkapaPanel(page, mobil) {
  await page.getByRole("button", { name: "Skapa", exact: true }).last().click();
  await page.getByRole("button", { name: "Ny händelse" }).click();
}
for (const [namn, vp] of /** @type {const} */ ([["1280 px", { width: 1280, height: 800 }], ["390 px", { width: 390, height: 844 }]])) {
  const mobil = vp.width < 800;
  const { page, context } = await oppna("skapa", vp);
  try {
    await oppnaSkapaPanel(page, mobil);
    await page.waitForSelector("[data-skapa-panel]", { timeout: 3000 });
    const m = await page.evaluate(() => {
      const panel = /** @type {HTMLElement} */ (document.querySelector("[data-skapa-panel]"));
      const r = panel.getBoundingClientRect();
      const kol = panel.firstElementChild ? panel.firstElementChild.getBoundingClientRect() : r;
      const knappar = /** @type {HTMLElement} */ (document.querySelector("[data-skapa-knappar]"));
      const kr = knappar.getBoundingClientRect();
      const h2 = panel.querySelector("h2");
      const hr = h2 ? h2.getBoundingClientRect() : null;
      const tillbaka = [...panel.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "Tillbaka");
      const tr = tillbaka ? tillbaka.getBoundingClientRect() : null;
      const kort = [...panel.querySelectorAll('[role="radiogroup"] label')].map((l) => l.getBoundingClientRect());
      const spara = [...panel.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "Skicka in");
      const avbryt = [...panel.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "Avbryt");
      const sr = spara ? spara.getBoundingClientRect() : null;
      const header = document.querySelector("header");
      const gruppPanel = document.querySelector('nav[aria-label="Alla mina grupper"]');
      const inHeader = header ? header.getBoundingClientRect() : null;
      const inner = /** @type {HTMLElement} */ (panel.querySelector("[data-skapa-panel] > div"));
      const ir = inner ? inner.getBoundingClientRect() : kol;
      return {
        panel: { x: r.x, y: r.y, w: r.width, h: r.height },
        kolW: ir.width, kolMitt: ir.x + ir.width / 2, panelMitt: r.x + r.width / 2,
        dialoger: document.querySelectorAll('[role="dialog"]').length,
        knappar: { top: kr.top, bottom: kr.bottom },
        rubrik: hr ? { top: hr.top, bottom: hr.bottom, x: hr.x, w: hr.width } : null,
        tillbaka: tr ? { top: tr.top, bottom: tr.bottom, x: tr.x } : null,
        kortAntal: kort.length,
        kortSynliga: kort.filter((k) => k.top >= 0 && k.bottom <= innerHeight).length,
        kortHojd: kort.map((k) => Math.round(k.height)),
        sparaR: sr ? sr.right : null,
        sparaBg: spara ? getComputedStyle(spara).backgroundColor : null,
        avbrytBg: avbryt ? getComputedStyle(avbryt).backgroundColor : null,
        knappraden: knappar.querySelector("div") ? knappar.querySelector("div").getBoundingClientRect().right : null,
        headerSyns: !!inHeader && inHeader.height > 0 && inHeader.bottom > 0 && getComputedStyle(header).visibility !== "hidden",
        headerTop: inHeader ? inHeader.top : null,
        gruppPanelSyns: !!gruppPanel && gruppPanel.getBoundingClientRect().width > 0 && getComputedStyle(gruppPanel.closest("div.hidden, div") || gruppPanel).display !== "none",
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        appvy: (() => { const a = document.querySelector("[data-appvy]"); return a ? a.getBoundingClientRect().height : -1; })(),
        vh: innerHeight,
        cw: header ? header.getBoundingClientRect().width : document.documentElement.clientWidth,
      };
    });
    matt.push(`skapa-panelen ${namn}: panel ${JSON.stringify(m.panel)}, kolumn ${m.kolW.toFixed(0)} px, dialoger ${m.dialoger}, knapprad ${m.knappar.top.toFixed(0)}..${m.knappar.bottom.toFixed(0)} av ${m.vh}, valkort ${m.kortSynliga}/${m.kortAntal} synliga (höjd ${m.kortHojd.join(",")}), Spara höger ${m.sparaR} mot knapprad ${m.knappraden}`);
    krav(m.dialoger === 0, `skapa-panelen ${namn}: ${m.dialoger} role=dialog medan formuläret visas. Väntat 0: skapa är en panel, inte en modal.`);
    krav(m.knappar.bottom <= m.vh + 0.5 && m.knappar.top >= 0, `skapa-panelen ${namn}: knappraden ligger utanför vyn (${m.knappar.top.toFixed(0)}..${m.knappar.bottom.toFixed(0)} av ${m.vh}).`);
    krav(m.knappar.bottom >= m.vh - 1, `skapa-panelen ${namn}: knappraden vilar inte längst ned (slutar ${m.knappar.bottom.toFixed(0)} av ${m.vh}).`);
    krav(m.sparaR !== null && m.knappraden !== null && Math.abs(m.sparaR - (m.knappraden - 16)) <= 1.5, `skapa-panelen ${namn}: Spara slutar ${m.sparaR} men knappradens innerkant är ${m.knappraden === null ? "?" : m.knappraden - 16}. Väntat längst till höger.`);
    krav(m.sparaBg !== null && m.sparaBg !== "rgba(0, 0, 0, 0)" && m.avbrytBg === "rgba(0, 0, 0, 0)", `skapa-panelen ${namn}: Spara har bakgrund ${m.sparaBg} och Avbryt ${m.avbrytBg}. Väntat en fylld Spara och en Avbryt som textknapp.`);
    krav(!m.overflow, `skapa-panelen ${namn}: horisontell överflödning.`);
    krav(m.tillbaka !== null && m.rubrik !== null && (mobil ? Math.abs(m.tillbaka.top - m.rubrik.top) < 40 : m.tillbaka.bottom <= m.rubrik.top + 1), `skapa-panelen ${namn}: Tillbaka och rubriken ligger inte som väntat (${JSON.stringify(m.tillbaka)} ${JSON.stringify(m.rubrik)}).`);
    krav(m.kortSynliga >= 3, `skapa-panelen ${namn}: ${m.kortSynliga} av ${m.kortAntal} valkort syns samtidigt med rubrikraden och knappraden, väntat minst 3.`);
    if (mobil) {
      krav(Math.abs(m.panel.x) < 0.5 && Math.abs(m.panel.y) < 0.5 && Math.abs(m.panel.w - m.cw) < 0.5 && Math.abs(m.panel.h - vp.height) < 1, `skapa-panelen ${namn}: panelen är ${JSON.stringify(m.panel)}, väntat helskärm 0,0 ${m.cw}x${vp.height} (sidans bredd, scrollbar-gutter stable tar en rullningslist).`);
      krav(m.kortHojd.every((h) => h <= 60), `skapa-panelen ${namn}: valkorten är ${m.kortHojd.join(", ")} px höga, väntat högst 60 (tätt, som SS).`);
      // Tangentbord: fönstret krymper till 500 px. Aktivt fält och knapprad ska båda synas.
      await page.setViewportSize({ width: vp.width, height: 500 });
      await page.waitForTimeout(150);
      await page.locator("[data-beskrivning]").focus();
      await page.locator("[data-beskrivning]").scrollIntoViewIfNeeded();
      const t = await page.evaluate(() => {
        const b = /** @type {HTMLElement} */ (document.querySelector("[data-skapa-knappar]")).getBoundingClientRect();
        const f = /** @type {HTMLElement} */ (document.querySelector("[data-beskrivning]")).getBoundingClientRect();
        const p = /** @type {HTMLElement} */ (document.querySelector("[data-skapa-panel]")).getBoundingClientRect();
        return { knTop: b.top, knBottom: b.bottom, fBottom: f.bottom, fTop: f.top, pH: p.height, vh: innerHeight };
      });
      matt.push(`skapa-panelen ${namn} med tangentbord (500 px): panel ${t.pH.toFixed(0)} px hög, knapprad ${t.knTop.toFixed(0)}..${t.knBottom.toFixed(0)}, fältet ${t.fTop.toFixed(0)}..${t.fBottom.toFixed(0)}`);
      krav(t.pH <= 500.5 && t.knBottom <= 500.5 && t.knTop >= 0, `skapa-panelen ${namn} med tangentbord: panelen ${t.pH.toFixed(0)} px och knappraden ${t.knTop.toFixed(0)}..${t.knBottom.toFixed(0)} ryms inte i 500 px.`);
      krav(t.fBottom <= t.knTop + 0.5 && t.fTop >= 0, `skapa-panelen ${namn} med tangentbord: aktivt fält ${t.fTop.toFixed(0)}..${t.fBottom.toFixed(0)} ligger under knappraden (${t.knTop.toFixed(0)}) eller utanför vyn.`);
      await page.setViewportSize(vp);
    } else {
      krav(m.headerSyns && m.headerTop !== null && m.headerTop <= 0.5, `skapa-panelen ${namn}: huvudet syns inte (top ${m.headerTop}).`);
      krav(m.gruppPanelSyns, `skapa-panelen ${namn}: gruppanelen syns inte medan panelen visas.`);
      krav(m.kolW <= 880.5 && m.kolW >= 700, `skapa-panelen ${namn}: kolumnen är ${m.kolW.toFixed(0)} px bred, väntat högst 880 (SS-panelens kolumn).`);
      krav(Math.abs(m.kolMitt - m.panelMitt) <= 1, `skapa-panelen ${namn}: kolumnen är inte centrerad i innehållskolumnen (${m.kolMitt.toFixed(1)} mot ${m.panelMitt.toFixed(1)}).`);
      krav(m.appvy === 0, `skapa-panelen ${namn}: appens vy är inte dold medan panelen visas (höjd ${m.appvy}).`);
    }
    if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `skapa-panel-${vp.width}.png`) });
    // Tillbaka: appens vy tillbaka, panelen borta.
    await page.getByRole("button", { name: "Tillbaka" }).click();
    const efter = await page.evaluate(() => ({ panel: document.querySelectorAll("[data-skapa-panel]").length, vy: (() => { const a = document.querySelector("[data-appvy]"); return a ? a.getBoundingClientRect().height : -1; })() }));
    krav(efter.panel === 0 && efter.vy > 0, `skapa-panelen ${namn}: efter Tillbaka finns ${efter.panel} paneler och appens vy har höjd ${efter.vy}. Väntat 0 och synlig.`);
  } catch (e) {
    krav(false, `skapa-panelen ${namn}: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}): panelen öppnades inte.`);
    if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `skapa-panel-${vp.width}-avbrott.png`) }).catch(() => {});
  }
  await context.close();
}
// "Skapa i": läget Alla frågar först (som SS bild b), med grupper och appens egen sektion; en vald grupp visar "Skapas i".
for (const [namn, vp] of /** @type {const} */ ([["1280 px", { width: 1280, height: 800 }], ["390 px", { width: 390, height: 844 }]])) {
  const { page, context } = await oppna("skapa", vp, standardtema, 1, "alla");
  try {
    await oppnaSkapaPanel(page, vp.width < 800);
    const dlg = page.getByRole("dialog", { name: "Skapa i" });
    await dlg.waitFor({ timeout: 3000 });
    const d = await dlg.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const rader = [...el.querySelectorAll("section")].map((s) => ({ namn: s.getAttribute("aria-label"), antal: s.querySelectorAll("button").length }));
      const mark = el.querySelector("section button span");
      const mr = mark ? mark.getBoundingClientRect() : null;
      return { x: r.x, w: r.width, top: r.top, bottom: r.bottom, vw: (document.querySelector('header') || document.documentElement).getBoundingClientRect().width, vh: innerHeight, rader, markW: mr ? mr.width : 0, radie: parseFloat(getComputedStyle(el).borderTopLeftRadius), avbryt: [...el.querySelectorAll("button")].some((b) => (b.textContent || "").trim() === "Avbryt"), panelBakom: document.querySelectorAll("[data-skapa-panel]").length };
    });
    matt.push(`skapa i ${namn}: dialog ${d.w.toFixed(0)} px bred, sektioner ${JSON.stringify(d.rader)}, märke ${d.markW} px, panelen bakom ${d.panelBakom}`);
    krav(vp.width < 640 ? true : d.radie === 24, `skapa i ${namn}: dialogen har rundning ${d.radie}, väntat 24 (SS rounded-2xl).`);
    krav(d.panelBakom === 0, `skapa i ${namn}: panelen ritades före valet (${d.panelBakom}). Väntat väljaren först i läget Alla.`);
    krav(d.rader.length === 2 && d.rader[0].namn === "Grupper" && d.rader[1].namn === "Mina kalendrar", `skapa i ${namn}: sektionerna är ${JSON.stringify(d.rader)}, väntat Grupper och Mina kalendrar.`);
    krav(Math.abs(d.markW - 34) < 0.6, `skapa i ${namn}: gruppmärket är ${d.markW} px, väntat 34.`);
    krav(d.avbryt && d.x >= 0 && d.x + d.w <= d.vw + 0.5 && d.bottom <= d.vh + 0.5, `skapa i ${namn}: Avbryt saknas eller dialogen ligger utanför vyn.`);
    krav(vp.width < 800 ? Math.abs(d.w - d.vw) < 1 : d.w <= 384.5, `skapa i ${namn}: dialogen är ${d.w.toFixed(0)} px bred (väntat helbredd som ark på telefon, högst 384 centrerad på dator).`);
    if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `skapa-i-${vp.width}.png`) });
    await dlg.getByRole("button", { name: /Testgruppen/ }).click();
    await page.waitForSelector("[data-skapa-panel]", { timeout: 3000 });
    const efter = await page.evaluate(() => ({ grupp: (document.querySelector("[data-grupp]") || {}).textContent, rad: [...document.querySelectorAll("[data-skapa-panel] button")].map((b) => b.getAttribute("aria-label")).filter(Boolean) }));
    krav(efter.grupp === "groupId=g2", `skapa i ${namn}: formuläret fick ${efter.grupp}, väntat groupId=g2 (Testgruppen).`);
    krav(efter.rad.includes("Skapas i: Testgruppen"), `skapa i ${namn}: raden "Skapas i: Testgruppen" saknas (${efter.rad.join(", ")}).`);
  } catch (e) {
    krav(false, `skapa i ${namn}: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
  }
  await context.close();
}

// ══ 16. DESIGN-QA cllp/bolag-ops#475, RAMVERKETS DEL (0.31.0, avsnitt 8) ══════
// Fynd 1: ingen horisontell överflödning på Hub eller modulsidan, varken med eller utan appens egen padding, vid 390, 768 och
// 1280 px. Fynd 2: samma modell överallt (panel från lg, annars en växlare i huvudet som visar den aktiva gruppen, aldrig en
// ensam chevron). Fynd 3: en sida under modulen bär samma tillbaka-rad. Fynd 4: barnkorten är samma kort som Hubs, med ikon och
// info. Fynd 5: Fråga står med namn i mobilmenyn, och ikonknapparna i huvudet har aria-label och tooltip. Fynd 8: infon i
// `ink-secondary`, "Inget nytt" i en egen statusstil.
for (const scen of ["hub", "hubmodul", "hubnaken", "hubmodulnaken"]) {
  for (const bredd of [390, 768, 1280]) {
    const { page, context } = await oppna(scen, { width: bredd, height: 900 });
    const o = await page.evaluate(() => {
      const d = document.documentElement;
      const bredaste = [...document.querySelectorAll("main *")].reduce((m, el) => Math.max(m, el.getBoundingClientRect().right), 0);
      return { sw: d.scrollWidth, cw: d.clientWidth, bredaste: Math.round(bredaste) };
    });
    krav(o.sw <= o.cw, `${scen} ${bredd} px: horisontell överflödning (scrollWidth ${o.sw} mot clientWidth ${o.cw}, bredaste element i main slutar ${o.bredaste}).`);
    await context.close();
  }
}
// Fynd 2: samma modell överallt.
for (const scen of ["hub", "hubmodul"]) {
  for (const bredd of [390, 900, 1280]) {
    const { page, context } = await oppna(scen, { width: bredd, height: 900 });
    const g = await page.evaluate(() => {
      const syns = (/** @type {Element | null} */ el) => !!el && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
      const panel = document.querySelector('nav[aria-label="Alla mina grupper"]');
      const vaxlare = document.querySelector('header button[aria-label^="Byt grupp"]');
      const vr = vaxlare ? vaxlare.getBoundingClientRect() : null;
      const namn = vaxlare ? [...vaxlare.querySelectorAll("span")].map((x) => x.textContent || "").join("|") : "";
      const markW = vaxlare && vaxlare.firstElementChild ? vaxlare.firstElementChild.getBoundingClientRect().width : 0;
      const synligText = vaxlare ? [...vaxlare.querySelectorAll("span")].filter((x) => x.getBoundingClientRect().width > 0 && (x.textContent || "").trim().length > 3).map((x) => (x.textContent || "").trim()) : [];
      return { panel: syns(panel), vaxlare: syns(vaxlare), namn, markW, synligText, vr: vr ? { w: vr.width, h: vr.height } : null };
    });
    matt.push(`gruppmodellen ${scen} ${bredd} px: panel ${g.panel}, växlare ${g.vaxlare}${g.vr ? ` ${g.vr.w.toFixed(0)}x${g.vr.h.toFixed(0)}` : ""}, märke ${g.markW} px, synlig text ${JSON.stringify(g.synligText)}`);
    if (bredd >= 1024) {
      krav(g.panel && !g.vaxlare, `gruppmodellen ${scen} ${bredd} px: panel ${g.panel} och växlare ${g.vaxlare}. Väntat panel och ingen växlare från lg.`);
    } else {
      krav(!g.panel && g.vaxlare, `gruppmodellen ${scen} ${bredd} px: panel ${g.panel} och växlare ${g.vaxlare}. Väntat en växlare i huvudet och ingen panel under lg.`);
      krav(g.markW >= 20, `gruppmodellen ${scen} ${bredd} px: växlaren har inget märke (${g.markW} px): en ensam chevron utan grupp.`);
      if (bredd >= 768) krav(g.synligText.some((/** @type {string} */ t) => t.startsWith("Claes Philip Staiger Konsulting")), `gruppmodellen ${scen} ${bredd} px: växlaren visar inte den aktiva gruppens namn (${JSON.stringify(g.synligText)}).`);
    }
    await context.close();
  }
}
// Fynd 3: en sida under modulen bär samma tillbaka-rad.
{
  const { page, context } = await oppna("hubbarn", { width: 1280, height: 900 });
  const r = await page.evaluate(() => {
    const n = document.querySelector('nav[aria-label="Var du är"]');
    if (!n) return null;
    return { text: (n.textContent || "").replace(/\s+/g, " ").trim(), lankar: [...n.querySelectorAll("a")].map((a) => a.getAttribute("href")), aktuell: (n.querySelector('[aria-current="page"]') || {}).textContent, sticky: getComputedStyle(n).position };
  });
  krav(r !== null, "sidan under modulen: tillbaka-raden saknas. Varje sida under Hub ska ha den (OpsView tillbaka).");
  if (r) {
    matt.push(`sidan under modulen: "${r.text}", länkar ${JSON.stringify(r.lankar)}`);
    krav(r.text === "Hub/Ekonomi/Inkomster" && JSON.stringify(r.lankar) === '["/hub","/ekonomi"]' && r.aktuell === "Inkomster" && r.sticky === "sticky", `sidan under modulen: raden är "${r.text}" med länkar ${JSON.stringify(r.lankar)}, nuvarande "${r.aktuell}", position ${r.sticky}. Väntat "Hub/Ekonomi/Inkomster" (snedstrecken är dekor), /hub och /ekonomi, sticky.`);
  }
  await context.close();
}
// Fynd 4 och 8: barnkorten är samma kort som Hubs, och infon är läsbar.
{
  const { page, context } = await oppna("hubmodul", { width: 1280, height: 900 });
  const k = await page.evaluate(() => {
    const kort = (/** @type {Element} */ a) => {
      const cs = getComputedStyle(a);
      const ikon = a.querySelector("span svg");
      return { radie: cs.borderTopLeftRadius, padding: cs.padding, bg: cs.backgroundColor, ikon: !!ikon, ikonStorlek: ikon ? ikon.getBoundingClientRect().width : 0, text: (a.textContent || "").trim() };
    };
    const barn = [...document.querySelectorAll("main ul[aria-label] > li > a")].map(kort);
    const p = document.createElement("div");
    p.style.color = "var(--color-ink-secondary)";
    document.body.appendChild(p);
    const sek = getComputedStyle(p).color;
    p.remove();
    const infoFarger = [...document.querySelectorAll("main ul[aria-label] > li > a > span:not(:first-child)")].map((e) => ({ text: (e.textContent || "").trim(), farg: getComputedStyle(e).color, status: e.getAttribute("data-status") }));
    return { barn, sek, infoFarger };
  });
  krav(k.barn.length === 6 && k.barn.every((b) => b.ikon && Math.abs(b.ikonStorlek - 20) < 0.6), `barnkorten: ${k.barn.filter((b) => b.ikon).length} av ${k.barn.length} har ikon på 20 px (väntat alla, samma som Hubs kort).`);
  krav(k.barn.every((b) => b.radie === k.barn[0].radie && b.padding === k.barn[0].padding && b.bg === k.barn[0].bg), `barnkorten: rundning, padding eller yta skiljer sig mellan korten.`);
  const inkomster = k.infoFarger.filter((i) => i.text.length > 0);
  krav(inkomster.length >= 2 && inkomster.every((i) => i.farg === k.sek), `infon: färgerna är ${JSON.stringify(inkomster.map((i) => i.farg))}, väntat ink-secondary ${k.sek}.`);
  krav(inkomster.some((i) => i.status === "inget-nytt" && i.text === "Inget nytt") && inkomster.some((i) => i.status === null && i.text.startsWith("Ny faktura")), `"Inget nytt" har inte en egen statusstil skild från infon (${JSON.stringify(inkomster)}).`);
  await context.close();
}
// Fynd 5: Fråga står med namn i mobilmenyn, och ikonknapparna i huvudet har aria-label och en synlig tooltip.
{
  const { page, context } = await oppna("full", { width: 390, height: 844 });
  await page.getByRole("button", { name: "Meny" }).last().click();
  const dlg = page.locator('[role="dialog"]');
  await dlg.waitFor({ timeout: 3000 }).catch(() => {});
  const fraga = await dlg.locator("a, button").filter({ hasText: "Fråga" }).count().catch(() => 0);
  krav(fraga === 1, `mobilmenyn: ${fraga} rader med namnet Fråga, väntat 1 (åtgärden som flyttats till menyn måste heta något där).`);
  await context.close();
}
{
  const { page, context } = await oppna("full", { width: 1280, height: 800 });
  const lankar = await page.evaluate(() => [...document.querySelectorAll("header a[aria-label]")].map((a) => a.getAttribute("aria-label")));
  krav(["Inkorg", "Sök", "Fråga", "Min profil"].every((n) => lankar.includes(n)), `huvudets ikonknappar: aria-label ${JSON.stringify(lankar)}, väntat Inkorg, Sök, Fråga och Min profil.`);
  await page.locator('header a[aria-label="Sök"]').hover();
  const tip = await page.getByRole("tooltip").first().waitFor({ timeout: 2500 }).then(() => page.getByRole("tooltip").first().textContent()).catch(() => null);
  matt.push(`huvudets tooltip vid hover på Sök: ${JSON.stringify(tip)}`);
  krav(tip !== null && tip.includes("Sök"), `huvudets ikonknappar: hover på Sök gav ingen synlig tooltip med namnet (${JSON.stringify(tip)}).`);
  await context.close();
}

// ══ 17. PRIMITIVERNA MOT SS OCH TOKENS (0.31.0, avsnitt 14) ═════════════════
// CP: "Dubbelkolla alla primitiver så att det blir enhetligt med sessionstudio nu." Ett urval mäts i BÅDA teman: knapp, fält,
// väljare, datum, tid, segmenterad, kort, rad, pill och tagg: rundning, höjd, kantbredd, yta och hover mot tokens (SS-förlagorna
// står i docs/jamforelser/0.31.0/primitiver.md). Värdena är SS egna: fält `rounded` 12 px och 1,5 px kant (`TextInput.jsx:102`),
// väljare 1 px (`themedSelectShared.js:72`), knapp `md` 44 px hög och `sm` 12 px text (`PrimaryButton.jsx:44-47`).
for (const tema of /** @type {const} */ (["light", "dark"])) {
  const { page, context } = await oppna("galleri", { width: 1280, height: 1600 }, tema, 2);
  await page.evaluate(() => document.fonts.ready);
  const g = await page.evaluate(() => {
    /** @param {string} v */
    const tok = (v) => { const p = document.createElement("div"); p.style.cssText = `border-radius:var(${v});background:var(${v})`; document.body.appendChild(p); const cs = getComputedStyle(p); const r = { radie: cs.borderTopLeftRadius, farg: cs.backgroundColor }; p.remove(); return r; };
    /** @param {string} v */
    const farg = (v) => { const p = document.createElement("div"); p.style.backgroundColor = `var(${v})`; document.body.appendChild(p); const c = getComputedStyle(p).backgroundColor; p.remove(); return c; };
    /** @param {string} p */
    const mat = (p) => {
      const el = /** @type {HTMLElement | null} */ (document.querySelector(`[data-p="${p}"]`));
      if (!el) return null;
      const valjare = { falt: "input", select: "button", datum: "button", tid: "button", segment: "[role='tablist']", radio: "[role='radiogroup'] label", kort: ":scope > *", checkbox: "label span[aria-hidden]", pill: "span", tag: "span", chip: "button" };
      const t = /** @type {HTMLElement} */ (el.matches("button, input, textarea, a") ? el : el.querySelector(/** @type {any} */ (valjare)[p] || "button, span") || el);
      const cs = getComputedStyle(t);
      const r = t.getBoundingClientRect();
      // ⛔ Chromium (headless) AVRUNDAR en 1,5 px kant till 1 px i det BERÄKNADE värdet även vid skala 2 (mätt: `border: 1.5px solid` ger
      // "1px" i `getComputedStyle`), så kantbredden läses ur stilmallens regel för klassen, det som författaren skrev och webbläsaren ritar
      // på en riktig skärm. Klassen måste också sitta på elementet.
      /** @param {any} lista @returns {any} */
      const finn = (lista) => { for (const r of lista) { if (r.selectorText === ".border-\\[1\\.5px\\]") return r; if (r.cssRules) { const x = finn(r.cssRules); if (x) return x; } } return null; };
      const regel = finn([...document.styleSheets].flatMap((ss) => [...ss.cssRules]));
      return { klass: t.className, kantRegel: regel ? /** @type {any} */ (regel).style.borderWidth : null, dpr: devicePixelRatio, tagg: t.tagName, radie: parseFloat(cs.borderTopLeftRadius), kant: parseFloat(cs.borderTopWidth), bg: cs.backgroundColor, h: r.height, font: parseFloat(cs.fontSize) };
    };
    const ut = { base: parseFloat(tok("--radius-base").radie), card: parseFloat(tok("--radius-card").radie), surface: farg("--color-surface"), raised: farg("--color-raised") };
    /** @type {Record<string, any>} */
    const m = {};
    for (const p of ["knapp-primary", "knapp-secondary", "knapp-ghost", "knapp-sm", "falt", "select", "datum", "tid", "segment", "kort", "pill", "tag", "chip", "checkbox"]) m[p] = mat(p);
    return { ...ut, m };
  });
  const m = g.m;
  const finns = Object.entries(m).filter(([, v]) => v === null).map(([k]) => k);
  krav(finns.length === 0, `primitiverna ${tema}: ${finns.join(", ")} hittades inte i galleriet (golv: alla fjorton).`);
  if (finns.length === 0) {
    matt.push(`primitiverna ${tema}: fält ${m.falt.radie}px/${m.falt.kant}px/${m.falt.h.toFixed(0)}px, väljare ${m.select.radie}px/${m.select.kant}px, datum ${m.datum.radie}px, tid ${m.tid.radie}px, knapp ${m["knapp-primary"].h.toFixed(0)}px hög, liten ${m["knapp-sm"].font}px text, kort ${m.kort.radie}px (bas ${g.base}px, kort ${g.card}px)`);
    for (const k of ["knapp-primary", "knapp-secondary", "knapp-ghost"]) {
      krav(m[k].h >= 43.5 && m[k].radie >= m[k].h / 2, `primitiverna ${tema}: ${k} är ${m[k].h.toFixed(0)} px hög med rundning ${m[k].radie}: väntat 44 och piller (CP 2026-09-28).`);
    }
    krav(m["knapp-sm"].font === 12 && m["knapp-sm"].h >= 31.5, `primitiverna ${tema}: liten knapp har text ${m["knapp-sm"].font} px och höjd ${m["knapp-sm"].h.toFixed(0)}, väntat 12 px och minst 32 (SS PrimaryButton sm).`);
    krav(m.falt.radie === g.base && m.falt.klass.split(/\s+/).includes("border-[1.5px]") && m.falt.kantRegel === "1.5px" && m.falt.bg === g.surface && m.falt.h >= 43.5, `primitiverna ${tema}: textfältet är ${m.falt.radie}px, kantregel ${m.falt.kantRegel}, yta ${m.falt.bg}, höjd ${m.falt.h.toFixed(0)}. Väntat ${g.base}px, 1,5px, ${g.surface}, minst 44 (SS TextInput).`);
    for (const k of ["select", "datum", "tid"]) {
      krav(m[k].radie === g.base && Math.abs(m[k].kant - 1) < 0.05 && m[k].bg === g.surface && m[k].h >= 43.5, `primitiverna ${tema}: ${k} är ${m[k].radie}px, kant ${m[k].kant}px, yta ${m[k].bg}, höjd ${m[k].h.toFixed(0)}. Väntat ${g.base}px, 1px, ${g.surface}, minst 44 (SS väljare).`);
    }
    krav(m.segment.radie >= 100, `primitiverna ${tema}: den segmenterade väljaren har rundning ${m.segment.radie}, väntat piller.`);
    krav(m.kort.radie === g.card, `primitiverna ${tema}: kortet har rundning ${m.kort.radie}, väntat kortets ${g.card} (SS rounded-2xl).`);
    for (const k of ["pill", "tag", "chip"]) krav(m[k].radie >= 8 && m[k].radie >= m[k].h / 2 - 0.5, `primitiverna ${tema}: ${k} har rundning ${m[k].radie} vid höjd ${m[k].h.toFixed(0)}, väntat piller.`);
  }
  // Hover på en rad: bakgrunden blir tokenets `raised` (SS `hover:bg-card`).
  await page.locator('[data-p="rad"] button, [data-p="rad"] a').first().hover();
  await page.waitForTimeout(400); // hover-övergången (`--duration-fast`) ska ha gått klart
  const hov = await page.evaluate(() => {
    const el = document.querySelector('[data-p="rad"] button, [data-p="rad"] a');
    const p = document.createElement("div");
    p.style.backgroundColor = "var(--color-raised)";
    document.body.appendChild(p);
    const raised = getComputedStyle(p).backgroundColor;
    p.remove();
    return { bg: el ? getComputedStyle(el).backgroundColor : null, raised, radie: el ? parseFloat(getComputedStyle(el).borderTopLeftRadius) : null };
  });
  krav(hov.bg === hov.raised, `primitiverna ${tema}: hover på en rad ger ${hov.bg}, väntat raised ${hov.raised} (SS hover:bg-card).`);
  krav(hov.radie === g.base, `primitiverna ${tema}: raden har rundning ${hov.radie}, väntat ${g.base} (SS --radius).`);
  if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `galleri-${tema}.png`), fullPage: true });
  await context.close();
}

await browser.close();

for (const rad of matt) console.log(`  mätt: ${rad}`);
if (brott.length > 0) {
  console.error(`\ncheck-skalyta: ${brott.length} brott av ${mattningar} kontroller (${varifran})\n`);
  for (const b of brott) console.error(`  ${b}`);
  process.exit(1);
}
console.log(`\ncheck-skalyta: ${mattningar} kontroller, inga brott (${varifran})`);
