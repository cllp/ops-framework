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
    `@import "tailwindcss" source(none);\n@import "${path.join(rot, "tokens", "tokens.css").replace(/\\/g, "/")}";\n@source "${distSkannad.replace(/\\/g, "/")}";\n@source "${entryFil.replace(/\\/g, "/")}";\n`,
    { from: path.join(arbetsmapp, "app.css") },
  )
).css;

// ⛔ Sidan laddas med `setContent` och har därför ingen adress att lösa `url("../fonts/...")` mot. I en riktig app
// skriver byggverktyget om sökvägen och kopierar ut filen (det mäter `check-scaffold`). Här bäddas SAMMA fil in som
// data-URL, så att `document.fonts.check` mäter det verkliga typsnittet och inte reservtypsnittet.
const fontData = fs.readFileSync(path.join(rot, "fonts", "glacial-indifference", "glacial-indifference-400.woff2")).toString("base64");
const css = cssRatt.replace(/url\(["']?[^)"']*glacial-indifference-400\.woff2["']?\)/g, `url(data:font/woff2;base64,${fontData})`);
if (css === cssRatt) throw new Error("check-skalyta: @font-face för Glacial Indifference hittades inte i den byggda CSS:en. Märket hade mätts i reservtypsnittet.");

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

await browser.close();

for (const rad of matt) console.log(`  mätt: ${rad}`);
if (brott.length > 0) {
  console.error(`\ncheck-skalyta: ${brott.length} brott av ${mattningar} kontroller (${varifran})\n`);
  for (const b of brott) console.error(`  ${b}`);
  process.exit(1);
}
console.log(`\ncheck-skalyta: ${mattningar} kontroller, inga brott (${varifran})`);
