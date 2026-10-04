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

/** @param {string} scen @param {string | null} [aktiv] Vilken grupp som är vald i `full`. @param {number} [manga] Så många extra grupper (och samtalsmeddelanden), så att en yta måste rulla (0.39.1). @returns {string} */
const sida = (scen, aktiv = null, manga = 0) =>
  `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body class="bg-canvas text-ink font-sans"><div id="root"></div><script>window.__skal=${JSON.stringify(scen)};window.__aktiv=${JSON.stringify(aktiv)};window.__manga=${manga};</script><script>${skript.replace(/<\/script>/g, "<\\/script>")}</script></body></html>`;

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
 * @param {string} scen @param {{ width: number, height: number }} viewport @param {string} [tema] @param {number} [skala] @param {string | null} [aktiv] @param {number} [manga]
 */
async function oppna(scen, viewport, tema = standardtema, skala = 1, aktiv = null, manga = 0) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: skala });
  const page = await context.newPage();
  // 0.31.2: en kort tidsgräns, så att ett saknat element (röd mot en äldre dist) blir ett brott och inte 30 sekunders väntan.
  page.setDefaultTimeout(4000);
  const fel = /** @type {string[]} */ ([]);
  page.on("pageerror", (e) => fel.push(e.message));
  await page.emulateMedia({ colorScheme: tema === "dark" ? "dark" : "light" });
  await page.setContent(sida(scen, aktiv, manga));
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
    krav(JSON.stringify(namn) === JSON.stringify(["Idag", "Kalender", "Skapa", "Appar", "Meny"]), `bottenraden: ordningen är ${namn.join(", ")}, väntat Idag, Kalender, Skapa (stort plus), Appar, Meny.`);
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
    const gruppText = [...document.querySelectorAll("header button")].find((b) => (b.getAttribute("aria-label") || "").startsWith("Byt grupp"));
    const namnSpan = gruppText ? [...gruppText.querySelectorAll("span")].find((sp) => (sp.textContent || "").includes("Staiger")) : null;
    const gr = gruppText ? gruppText.getBoundingClientRect() : null;
    const gm = gruppText ? gruppText.querySelector("[data-gruppmarke]") : null;
    const gmr = gm ? gm.getBoundingClientRect() : null;
    // Ingen SYNLIG text "OPS HUB" (eller märkets rader) någonstans i huvudet, och märkeslänken till startsidan ritas inte alls.
    const ordmarke = [...document.querySelectorAll("header [data-marke], header a[href='/']")].filter((el) => el.getBoundingClientRect().width > 0);
    const synligText = [...document.querySelectorAll("header *")].filter((el) => el.children.length === 0 && /OPS\s*HUB/i.test(el.textContent || "") && el.getBoundingClientRect().width > 0 && !el.classList.contains("sr-only"));
    return {
      forsta: poster.length ? poster.reduce((a, b) => (b.x < a.x ? b : a)).namn : null,
      grupp: gr ? { x: gr.x, w: gr.width, h: gr.height } : null,
      marke: gmr ? { w: gmr.width, h: gmr.height } : null,
      ordmarke: ordmarke.length,
      synligText: synligText.length,
      poster,
      scroll: dok.scrollWidth,
      klient: dok.clientWidth,
      gruppNamnSynligt: namnSpan ? namnSpan.getBoundingClientRect().width > 0 : null,
      fraga: [...document.querySelectorAll("header a")].some((a) => a.getAttribute("aria-label") === "Fråga" && a.getBoundingClientRect().width > 0),
    };
  });
  krav(m.poster.length >= 5, `mobilhuvudet: bara ${m.poster.length} kontroller lästa i huvudet, väntat minst 5 (gruppväxlare, tema, inkorg, sök, avatar). Fel scenario.`);
  // 0.31.1 (CP 2026-09-29 18:40: "Header i mobil skall vi ta bort texten helt. VI behöver en bra Grupp-väljare-ikon i mobil istället för logga"):
  krav(m.ordmarke === 0 && m.synligText === 0, `mobilhuvudet 390 px: märket ritas (${m.ordmarke} märkeselement, ${m.synligText} synliga "OPS HUB"). Väntat inget märke och ingen text i mobilhuvudet.`);
  krav(m.grupp !== null && m.forsta !== null && m.forsta.startsWith("Byt grupp"), `mobilhuvudet 390 px: längst till vänster står "${m.forsta}", väntat gruppväxlaren.`);
  krav(m.grupp !== null && Math.abs(m.grupp.w - 44) < 0.5 && Math.abs(m.grupp.h - 44) < 0.5, `mobilhuvudet 390 px: gruppväxlarens träffyta är ${m.grupp?.w}x${m.grupp?.h} px, väntat 44x44.`);
  krav(m.marke !== null && m.marke.w > 0 && m.marke.h > 0, `mobilhuvudet 390 px: gruppmärket syns inte i gruppväxlaren.`);
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
  matt.push(`mobilhuvudet 390 px: märkeselement ${m.ordmarke}, "OPS HUB" synligt ${m.synligText}, först "${m.forsta}", växlare ${m.grupp?.w}x${m.grupp?.h}, gruppmärke ${m.marke?.w}x${m.marke?.h}`);
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
      const panel = q('nav[aria-label="Mina grupper"]');
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
    await page.locator('nav[aria-label="Mina grupper"] > button').first().click();
    await page.waitForTimeout(350);
    const in_ = await mata("infalld");
    krav(in_ !== null, `panelen ${bredd} px: märkesrutan eller panelen hittades inte efter infällning.`);
    if (in_) {
      // ⛔ Den infällda remsan (0.30.1, SS `AppSidebar.jsx:54,77,89`): varje post är en 40x40-ruta med kant, märket 34 px
      // inuti, och den aktiva gruppen har accentkant. Före 0.30.1 var växlaren en naken chevron och märkena fyllde rutan.
      const rem = await page.evaluate(() => {
        const nav = document.querySelector('nav[aria-label="Mina grupper"]');
        const rut = (/** @type {Element} */ el) => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          const barn = el.firstElementChild ? el.firstElementChild.getBoundingClientRect() : null;
          return { namn: el.getAttribute("aria-label") || "", w: r.width, h: r.height, kant: parseFloat(cs.borderTopWidth), kantFarg: cs.borderTopColor, markeW: barn ? barn.width : 0 };
        };
        const accent = (() => { const p = document.createElement("div"); p.style.borderTop = "1px solid var(--color-accent)"; document.body.appendChild(p); const c = getComputedStyle(p).borderTopColor; p.remove(); return c; })();
        return { poster: nav ? [...nav.querySelectorAll(":scope > button, ul button")].map(rut) : [], accent };
      });
      // ⛔ 0.35.0 (#190): ingen post "Alla mina grupper". Golvet är växlaren, scenens tre grupper och Skapa, alltså fem.
      krav(rem.poster.length >= 5, `remsan ${bredd} px: bara ${rem.poster.length} poster lästa, väntat minst 5 (växlare, tre grupper, skapa).`);
      krav(!rem.poster.some((p) => /^Alla/.test(p.namn)), `remsan ${bredd} px: en post heter ${JSON.stringify(rem.poster.filter((p) => /^Alla/.test(p.namn)).map((p) => p.namn))}. Läget "Alla mina grupper" är borttaget (0.35.0, #190).`);
      for (const p of rem.poster) {
        krav(Math.abs(p.w - 40) < 0.5 && Math.abs(p.h - 40) < 0.5 && p.kant >= 1, `remsan ${bredd} px: "${p.namn}" är ${p.w}x${p.h} px med kant ${p.kant}, väntat 40x40 med kant.`);
      }
      const gm = rem.poster.filter((p) => p.markeW > 0 && p.namn && !/^(Fäll|Skapa)/.test(p.namn));
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
      // ⛔ 0.38.0 (#203): ÄNDRAT PROV. Hette "flyttade sig minst 20 (åt vänster)": märket krympte alltid från 180 till 40 px när panelen fälldes
      // in, så flikarna gick åt vänster. Sedan 0.38.0 står gruppens namn bredvid OH i det infällda läget (CP 2026-09-30: "OH | Travel"),
      // och OH + namn är bredare än det utfällda ordmärket, så flikarna går åt HÖGER. Det som provet skyddar är att flikarna FÖLJER märket
      // och inte står fast (SS `AppHeader.jsx:194`): de ska flytta sig minst 20 px åt det håll märkets bredd ändrats, och inte ligga
      // ovanpå det (raden över och märkesavsnittet mäter att de börjar efter namnet).
      krav(ut.flikX !== null && in_.flikX !== null && Math.abs(ut.flikX - in_.flikX) >= 20, `panelen ${bredd} px: toppradens flikar flyttade sig ${ut.flikX !== null && in_.flikX !== null ? (ut.flikX - in_.flikX).toFixed(0) : "?"} px när panelen fälldes in, väntat minst 20 åt endera hållet (de följer märkets bredd och börjar efter det, SS \`AppHeader.jsx:194\`).`);
    }
  }
  await context.close();
}

// Bilderna till montaget (regel 12): 1024 px bredd i skala 2, alltså samma skala och beskärning som SS-bildrutorna (1600 px = 800 CSS-px).
if (bildmapp) {
  const { page, context } = await oppna("full", { width: 1024, height: 460 }, standardtema, 2);
  for (const lage of ["utfalld", "infalld"]) {
    if (lage === "infalld") {
      await page.locator('nav[aria-label="Mina grupper"] > button').first().click();
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
  const kort = page.locator("main ul[aria-label] > li > *");
  const antal = await kort.count();
  krav(antal === 4, `Hub ${namn}: ${antal} modulkort ritades, väntat 4 (fyra moduler, varje kort en länk).`);
  if (antal === 4) {
    const k = await page.evaluate(() =>
      [...document.querySelectorAll("main ul[aria-label] > li > *")].map((a) => {
        const r = a.getBoundingClientRect();
        const rader = [...a.querySelectorAll("span")].map((sp) => (sp.textContent || "").trim());
        return { text: /** @type {HTMLElement} */ (a).innerText.replace(/\s+/g, " ").trim(), x: r.x, y: Math.round(r.y), w: r.width, h: Math.round(r.height), flodar: a.scrollWidth > a.clientWidth + 1, rader };
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
    // Ett klick öppnar modulen: ett kort utan barn är en riktig länk och appen får ett `onNavigate`. (0.31.2: Ekonomi, som har barn, fälls ut i stället, se avsnitt 19.)
    await kort.filter({ hasText: "Schema" }).click();
    const gick = await page.evaluate(() => window.__gick);
    krav(gick.length === 1 && gick[0] === "/schema", `Hub ${namn}: klick på Schema-kortet navigerade till ${JSON.stringify(gick)}, väntat ["/schema"].`);
    if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `hub-${vp.width}.png`), fullPage: true });
  }
  if (vp.width > 800) {
    // Hub-rullgardinen i toppraden: Ekonomi är en rad med chevron, barnen infällda tills den trycks.
    await page.getByRole("button", { name: "Visa sidorna under Appar" }).click();
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
    const tillbaka = rad.getByRole("link", { name: "Tillbaka till Appar" });
    const harTillbaka = (await tillbaka.count()) === 1;
    krav(harTillbaka, `Modulsidan ${namn}: länken "Tillbaka till Appar" hittades inte (0.31.2: en textlänk, inte "‹ Hub / Ekonomi").`);
    if (!harTillbaka) { await context.close(); continue; }
    krav((await tillbaka.getAttribute("href")) === "/hub", `Modulsidan ${namn}: tillbaka-länken leder inte till /hub.`);
    krav((await page.locator("h1").count()) === 1 && (await page.locator("h1").textContent()) === "Ekonomi", `Modulsidan ${namn}: modulens namn saknas som rubrik under tillbaka-länken.`);
    krav(((await tillbaka.boundingBox())?.height ?? 0) >= 44, `Modulsidan ${namn}: tillbaka-länken är under 44 px hög (tumme).`);
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

// ══ 9c. HUBBEN PER GRUPP OCH MODULENS INSIDA (0.37.0, #184) ════════════════════
// CP 2026-09-30: "Ekonomi är EN modul. Inte massa moduler med komponenter." Hubben visar den aktiva gruppens moduler och inget
// annat, och en modul har en egen insida med sin egen navigation. Mått vid 390 och 1280:
//   (a) en grupp med Ekonomi: ETT kort, en länk till /ekonomi, inga delar i hubben, minst 44 px högt, klick navigerar;
//       på dator listar toppradens rullgardin bara modulen (inga chevronrader, inga delar).
//   (b) en grupp utan moduler: rubriken och en rad med gruppens namn, inga kort, ingen tom yta.
//   (c) en grupp med en modul appen inte registrerat: kortet för Ekonomi OCH en synlig rad som säger vilken som inte visas.
//   (d) modulens insida: tillbaka till /hub, rubriken, fjorton länkar i en rad, EN öppen del med en synlig accentlinje under,
//       varje länk minst 44 px hög, raden rullar i sidled i stället för sidan, och den öppna delen syns också när den är den sista.
// Ingen horisontell överflödning någonstans. ⛔ GOLV: varje delmätning kräver att det den mäter fanns.
for (const [namn, vp] of /** @type {const} */ ([["1280 px", { width: 1280, height: 900 }], ["390 px", { width: 390, height: 844 }]])) {
  const over = async (/** @type {import("playwright").Page} */ p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  // (a)
  {
    const { page, context } = await oppna("grupphubb", vp, standardtema, 1, "g3");
    try {
      const lista = page.locator('main ul[aria-label="Appar i Claes Philip Staiger AB"]');
      const kort = lista.locator(":scope > li > a");
      const antal = await kort.count();
      krav(antal === 1, `Hubben per grupp ${namn} (a): ${antal} kort ritades i gruppen med Ekonomi, väntat 1.`);
      if (antal === 1) {
        const k = await kort.evaluate((a) => ({ href: a.getAttribute("href"), text: /** @type {HTMLElement} */ (a).innerText.replace(/\s+/g, " ").trim(), h: a.getBoundingClientRect().height }));
        matt.push(`Hubben per grupp ${namn} (a): ${JSON.stringify(k)}`);
        krav(k.href === "/ekonomi" && k.text.startsWith("Ekonomi") && k.text.includes("Skatten förfaller 12 oktober"), `Hubben per grupp ${namn} (a): kortet ${JSON.stringify(k)}, väntat Ekonomi med infolinjen och länken /ekonomi.`);
        krav(k.h >= 44, `Hubben per grupp ${namn} (a): kortet är ${k.h} px högt, under tumkravet 44.`);
        krav(!(await page.locator("main").innerText()).includes("Inkomster"), `Hubben per grupp ${namn} (a): en del av Ekonomi står i hubben.`);
        await kort.click();
        const gick = await page.evaluate(() => window.__gick);
        krav(gick.length === 1 && gick[0] === "/ekonomi", `Hubben per grupp ${namn} (a): klick på kortet gick till ${JSON.stringify(gick)}, väntat ["/ekonomi"].`);
      }
      krav((await over(page)) <= 0, `Hubben per grupp ${namn} (a): sidan flödar ${await over(page)} px i sidled.`);
      if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `grupphubb-ekonomi-${vp.width}.png`) });
      if (vp.width > 800) {
        await page.getByRole("button", { name: "Visa sidorna under Appar" }).click();
        const dd = page.locator('[role="dialog"]');
        await dd.waitFor();
        const rader = await dd.evaluate((el) => ({
          lankar: [...el.querySelectorAll("a")].filter((a) => a.getBoundingClientRect().height > 0).map((a) => (a.textContent || "").trim()),
          knappar: [...el.querySelectorAll("button[aria-expanded]")].length,
        }));
        matt.push(`Hubben per grupp ${namn} (a): rullgardinen ${JSON.stringify(rader)}`);
        krav(rader.lankar.length === 1 && rader.lankar[0].startsWith("Ekonomi") && rader.knappar === 0, `Hubben per grupp ${namn} (a): rullgardinen ${JSON.stringify(rader)}, väntat bara Ekonomi och inga utfällbara rader.`);
        if (bildmapp) await page.screenshot({ path: path.join(bildmapp, "grupphubb-rullgardin-1280.png"), clip: { x: 300, y: 0, width: 700, height: 360 } });
      }
    } catch (e) {
      krav(false, `Hubben per grupp ${namn} (a): provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
    }
    await context.close();
  }
  // (b)
  {
    const { page, context } = await oppna("grupphubb", vp, standardtema, 1, "g2");
    try {
      const main = page.locator("main");
      const rubrik = main.getByText("Inga appar i gruppen", { exact: true });
      const rad = main.getByText(/Testgruppen har inga appar installerade/);
      krav((await rubrik.count()) === 1 && (await rubrik.isVisible()), `Hubben per grupp ${namn} (b): rubriken "Inga appar i gruppen" syns inte i gruppen utan moduler.`);
      krav((await rad.count()) === 1 && (await rad.isVisible()), `Hubben per grupp ${namn} (b): raden med gruppens namn syns inte.`);
      const lankar = await main.locator("a").count();
      krav(lankar === 0, `Hubben per grupp ${namn} (b): ${lankar} länkar i hubben för en grupp utan moduler.`);
      krav((await over(page)) <= 0, `Hubben per grupp ${namn} (b): sidan flödar i sidled.`);
      if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `grupphubb-tom-${vp.width}.png`) });
    } catch (e) {
      krav(false, `Hubben per grupp ${namn} (b): provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
    }
    await context.close();
  }
  // (c)
  {
    const { page, context } = await oppna("grupphubb", vp, standardtema, 1, "g1");
    try {
      const kort = await page.locator("main ul[aria-label] > li > a").count();
      const rad = page.locator('[data-saknad="inte-registrerad"]');
      const syns = (await rad.count()) === 1 && (await rad.isVisible());
      const r = syns ? await rad.evaluate((el) => ({ text: (el.textContent || "").trim(), h: el.getBoundingClientRect().height, flodar: el.scrollWidth > el.clientWidth + 1 })) : null;
      matt.push(`Hubben per grupp ${namn} (c): ${kort} kort, raden ${JSON.stringify(r)}`);
      krav(kort === 1, `Hubben per grupp ${namn} (c): ${kort} kort, väntat 1 (Ekonomi; "bokning" är inte registrerad).`);
      krav(!!r && r.text.includes('"bokning"') && r.h > 0 && !r.flodar, `Hubben per grupp ${namn} (c): raden om modulen som inte visas ${JSON.stringify(r)}, väntat synlig och med id:t.`);
      krav((await over(page)) <= 0, `Hubben per grupp ${namn} (c): sidan flödar i sidled.`);
    } catch (e) {
      krav(false, `Hubben per grupp ${namn} (c): provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
    }
    await context.close();
  }
  // (d)
  for (const href of ["/ekonomi/inkomster", "/ekonomi/jamforelse"]) {
    const { page, context } = await oppna(`modulsida|${href}`, vp);
    try {
      const nav = page.locator('nav[aria-label="Ekonomi: delar"]');
      krav((await nav.count()) === 1, `Modulens insida ${namn} ${href}: navigationen "Ekonomi: delar" hittades inte.`);
      if ((await nav.count()) === 1) {
        const m = await nav.evaluate((n) => {
          const ul = /** @type {HTMLElement} */ (n.querySelector("ul"));
          const lankar = [...n.querySelectorAll("a")];
          const oppna = lankar.filter((a) => a.getAttribute("aria-current") === "page");
          const o = oppna[0];
          const cs = o ? getComputedStyle(o) : null;
          const ro = o ? o.getBoundingClientRect() : null;
          return {
            antal: lankar.length,
            oppna: oppna.map((a) => (a.textContent || "").trim()),
            minH: Math.min(...lankar.map((a) => a.getBoundingClientRect().height)),
            linje: cs ? { bredd: parseFloat(cs.borderBottomWidth), farg: cs.borderBottomColor } : null,
            ovriga: lankar.filter((a) => a !== o).map((a) => getComputedStyle(a).borderBottomColor),
            rullar: ul.scrollWidth > ul.clientWidth,
            synlig: ro ? ro.left >= 0 && ro.right <= window.innerWidth : false,
          };
        });
        matt.push(`Modulens insida ${namn} ${href}: ${JSON.stringify({ ...m, ovriga: [...new Set(m.ovriga)] })}`);
        const vantad = href.endsWith("jamforelse") ? "Jämförelse" : "Inkomster";
        krav(m.antal === 14, `Modulens insida ${namn} ${href}: ${m.antal} länkar i navigationen, väntat 14.`);
        krav(m.oppna.length === 1 && m.oppna[0] === vantad, `Modulens insida ${namn} ${href}: öppen del ${JSON.stringify(m.oppna)}, väntat ["${vantad}"].`);
        krav(m.minH >= 44, `Modulens insida ${namn} ${href}: en länk är ${m.minH} px hög, under tumkravet 44.`);
        krav(!!m.linje && m.linje.bredd >= 2 && !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/.test(m.linje.farg) && !m.ovriga.includes(m.linje.farg), `Modulens insida ${namn} ${href}: den öppna delen har ingen egen synlig linje under sig (${JSON.stringify(m.linje)}).`);
        krav(m.synlig, `Modulens insida ${namn} ${href}: den öppna delen ligger utanför skärmen.`);
        if (vp.width < 800) krav(m.rullar, `Modulens insida ${namn} ${href}: fjorton delar ryms på 390 px utan att raden rullar, alltså mäter provet inte rullningen.`);
        const tillbaka = page.getByRole("link", { name: "Tillbaka till Appar" });
        krav((await tillbaka.count()) === 1 && (await tillbaka.getAttribute("href")) === "/hub", `Modulens insida ${namn} ${href}: tillbaka-länken till /hub saknas.`);
        krav((await page.locator("h1").count()) === 1 && (await page.locator("h1").textContent()) === "Ekonomi", `Modulens insida ${namn} ${href}: rubriken "Ekonomi" saknas.`);
        krav((await page.locator("[data-moduldel-innehall]").count()) === 1, `Modulens insida ${namn} ${href}: delens innehåll ritades inte.`);
        krav((await over(page)) <= 0, `Modulens insida ${namn} ${href}: sidan flödar ${await over(page)} px i sidled.`);
        if (href.endsWith("inkomster")) {
          await nav.getByRole("link", { name: "Kostnader" }).click();
          const gick = await page.evaluate(() => window.__gick);
          krav(gick.length === 1 && gick[0] === "/ekonomi/kostnader", `Modulens insida ${namn}: klick på Kostnader gick till ${JSON.stringify(gick)}.`);
        }
        if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `modulsida-${href.split("/").pop()}-${vp.width}.png`) });
      }
    } catch (e) {
      krav(false, `Modulens insida ${namn} ${href}: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
    }
    await context.close();
  }
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
    const panel = q('nav[aria-label="Mina grupper"]');
    const kort = panel ? panel.querySelector("ul > li") : null;
    const remsGrupp = [...document.querySelectorAll('nav[aria-label="Mina grupper"] ul button')].find((b) => b.getAttribute("aria-label") === "Testgruppen");
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

  await page.locator('nav[aria-label="Mina grupper"] > button').first().click();
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

  // ⛔ 0.38.0 (#203): infälld panel på dator visar OH OCH den aktiva gruppens namn. CP 2026-09-30: "Desktop infällt grupper-panel:
  // OH | Travel (inte byta ut OH mot gruppbokstäver)." Mått: OH syns och är kvar (monogramrutan har texten OH, full opacitet),
  // gruppnamnet syns, står på EN rad bredvid rutan, ryms i högst ungefär 20 tecken (kapat med CSS, inte rutan som växer), ligger
  // inte ovanpå första fliklänken, och toppraden flödar inte över.
  const gn = await page.evaluate(() => {
    const lank = document.querySelector('header a[href="/"]');
    const namn = lank ? lank.querySelector('[data-marke="gruppnamn"]') : null;
    const ruta = lank ? lank.querySelector('[data-marke="ruta"]') : null;
    const text = namn ? namn.querySelector(".truncate") : null;
    const monoWrap = lank ? lank.querySelector('[data-marke="monogram"]') : null;
    const nav = document.querySelector("header nav");
    const forstaFlik = nav ? nav.querySelector("a") : null;
    const syns = (/** @type {Element | null} */ el) => (el ? el.getBoundingClientRect().width > 0 && getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el).display !== "none" : false);
    const r = (/** @type {Element | null} */ el) => (el ? el.getBoundingClientRect() : null);
    const nr = r(namn);
    const rr = r(ruta);
    const tr = r(text);
    const fr = r(forstaFlik);
    const header = document.querySelector("header");
    return {
      namnSyns: syns(namn),
      rutaText: ruta ? ruta.textContent : null,
      rutaSyns: syns(ruta),
      monoOpacity: monoWrap ? parseFloat(getComputedStyle(monoWrap).opacity) : null,
      text: text ? text.textContent : null,
      titel: namn ? namn.getAttribute("title") : null,
      kapad: text ? /** @type {HTMLElement} */ (text).scrollWidth > /** @type {HTMLElement} */ (text).clientWidth : null,
      namnVanster: nr ? nr.left : null,
      rutaHoger: rr ? rr.right : null,
      namnHoger: nr ? nr.right : null,
      namnBredd: nr ? nr.width : null,
      textHojd: tr ? tr.height : null,
      textFontPx: text ? parseFloat(getComputedStyle(text).fontSize) : null,
      flikVanster: fr ? fr.left : null,
      namnMittY: nr ? nr.y + nr.height / 2 : null,
      rutaMittY: rr ? rr.y + rr.height / 2 : null,
      over: header ? header.scrollWidth - header.clientWidth : null,
    };
  });
  matt.push(`märket ${bredd} px infälld, gruppnamn: ${JSON.stringify(gn)}`);
  krav(gn.rutaSyns && gn.rutaText === "OH" && (gn.monoOpacity ?? 0) === 1, `infälld panel ${bredd} px: OH syns inte kvar i monogramrutan (text ${JSON.stringify(gn.rutaText)}, opacity ${gn.monoOpacity}). OH får aldrig bytas mot gruppens bokstäver.`);
  krav(gn.namnSyns && gn.text === "CLAES PHILIP STAIGER AB", `infälld panel ${bredd} px: gruppnamnet syns inte bredvid OH (syns ${gn.namnSyns}, text ${JSON.stringify(gn.text)}). Väntat den aktiva gruppens namn.`);
  krav(gn.titel === "CLAES PHILIP STAIGER AB", `infälld panel ${bredd} px: hela namnet saknas i title (${JSON.stringify(gn.titel)}).`);
  if (gn.namnVanster !== null && gn.rutaHoger !== null && gn.namnHoger !== null && gn.namnBredd !== null) {
    krav(gn.namnVanster >= gn.rutaHoger - 0.5, `infälld panel ${bredd} px: gruppnamnet börjar ${gn.namnVanster.toFixed(1)} men OH-rutan slutar ${gn.rutaHoger.toFixed(1)}. Väntat bredvid, aldrig ovanpå.`);
    // ~20 tecken: 20 ch plus spärrningen per tecken, i det mätta typsnittet. Taket är bredden på namnblocket, inte på texten.
    const tak = 20 * (gn.textFontPx ?? 13) * 0.75 + 20 * 0.26 * (gn.textFontPx ?? 13) + 16 + 1;
    krav(gn.namnBredd <= tak, `infälld panel ${bredd} px: gruppnamnets block är ${gn.namnBredd.toFixed(1)} px, taket för ungefär 20 tecken är ${tak.toFixed(0)}. Namnet ska kapas, inte vidga huvudet.`);
    if (gn.flikVanster !== null) krav(gn.namnHoger <= gn.flikVanster + 0.5, `infälld panel ${bredd} px: gruppnamnet slutar ${gn.namnHoger.toFixed(1)} men första fliken börjar ${gn.flikVanster.toFixed(1)}. Namnet ligger ovanpå navigeringen.`);
  }
  krav(gn.textHojd !== null && gn.textHojd < 20, `infälld panel ${bredd} px: gruppnamnet är ${gn.textHojd} px högt, alltså på mer än en rad.`);
  krav(gn.namnMittY !== null && gn.rutaMittY !== null && Math.abs(gn.namnMittY - gn.rutaMittY) <= 1.5, `infälld panel ${bredd} px: gruppnamnets mitt ${gn.namnMittY?.toFixed(1)} mot OH-rutans ${gn.rutaMittY?.toFixed(1)}. Väntat på samma linje.`);
  krav(gn.kapad === true, `infälld panel ${bredd} px: det långa namnet "CLAES PHILIP STAIGER AB" kapas inte (scrollWidth <= clientWidth). Då mäter provet inte avkortningen (golv).`);
  krav((gn.over ?? 1) <= 0, `infälld panel ${bredd} px: toppraden flödar ${gn.over} px i sidled med gruppnamnet.`);
  if (bildmapp && bredd === 1280) await page.screenshot({ path: path.join(bildmapp, "header-infalld-1280.png"), clip: { x: 0, y: 0, width: 1280, height: 120 } });
  await context.close();
}

// ⛔ 0.38.0 (#203): vid 1024 px (smalaste bredden med panel) får gruppnamnet inte trycka ut flikarna ur huvudet: ingen flik gömd av namnet,
// ingen överlappning, inget överflöde. Mäts utfälld mot infälld så att en flik som försvinner av namnet syns som skillnad.
{
  const { page, context } = await oppna("full", { width: 1024, height: 700 }, standardtema, 1, "g3");
  await page.evaluate(() => document.fonts.ready);
  const flikar = () =>
    page.evaluate(() => {
      const nav = document.querySelector("header nav");
      const syns = (/** @type {Element} */ el) => el.getBoundingClientRect().width > 0 && getComputedStyle(el).display !== "none";
      const l = nav ? [...nav.querySelectorAll("a")].filter(syns) : [];
      const namn = document.querySelector('header [data-marke="gruppnamn"]');
      const nr = namn && namn.getBoundingClientRect().width > 0 ? namn.getBoundingClientRect() : null;
      const header = document.querySelector("header");
      return { antal: l.length, forstaX: l.length ? l[0].getBoundingClientRect().left : null, sistaRight: l.length ? l[l.length - 1].getBoundingClientRect().right : null, namnHoger: nr ? nr.right : null, over: header ? header.scrollWidth - header.clientWidth : null };
    });
  const ut = await flikar();
  await page.locator('nav[aria-label="Mina grupper"] > button').first().click();
  await page.waitForTimeout(350);
  const in_ = await flikar();
  matt.push(`huvudet 1024 px: utfälld ${JSON.stringify(ut)}, infälld ${JSON.stringify(in_)}`);
  krav(ut.antal >= 3, `huvudet 1024 px: bara ${ut.antal} flikar synliga utfälld (golv 3).`);
  krav(in_.antal === ut.antal, `huvudet 1024 px: ${in_.antal} flikar synliga infälld mot ${ut.antal} utfälld. Gruppnamnet får inte trycka bort en flik.`);
  krav(in_.namnHoger !== null && in_.forstaX !== null && in_.namnHoger <= in_.forstaX + 0.5, `huvudet 1024 px infälld: namnet slutar ${in_.namnHoger} men första fliken börjar ${in_.forstaX}.`);
  krav((in_.over ?? 1) <= 0 && (ut.over ?? 1) <= 0, `huvudet 1024 px: toppraden flödar ${in_.over} px (infälld) och ${ut.over} px (utfälld) i sidled.`);
  await context.close();
}

// ⛔ 0.38.0 (#203): 390 px har ingen extra rad i huvudet. CP: "Mobil: gruppikon kan kompletteras med kort namn om headern tål det; undvik tre
// konkurrerande rader." Beslut: telefonen behåller bara gruppmärket (inget namn bredvid, inget märke): huvudet är en rad, 56 px.
{
  const { page, context } = await oppna("full", { width: 390, height: 844 }, standardtema, 1, "g3");
  await page.evaluate(() => document.fonts.ready);
  const m = await page.evaluate(() => {
    const header = document.querySelector("header");
    const hr = header ? header.getBoundingClientRect() : null;
    const syns = (/** @type {Element | null} */ el) => (el ? el.getBoundingClientRect().width > 0 && getComputedStyle(el).display !== "none" : false);
    const barn = header ? [...header.querySelectorAll("a, button")].filter((e) => syns(e)).map((e) => e.getBoundingClientRect()) : [];
    const ytor = barn.map((b) => Math.round(b.y + b.height / 2));
    return {
      hojd: hr ? hr.height : null,
      namnSyns: syns(document.querySelector('header [data-marke="gruppnamn"]')),
      antalKnappar: barn.length,
      spridning: ytor.length ? Math.max(...ytor) - Math.min(...ytor) : null,
      over: header ? header.scrollWidth - header.clientWidth : null,
    };
  });
  matt.push(`huvudet 390 px: ${JSON.stringify(m)}`);
  krav(m.antalKnappar >= 3, `huvudet 390 px: bara ${m.antalKnappar} synliga kontroller (golv 3).`);
  krav(m.hojd !== null && m.hojd <= 57, `huvudet 390 px: ${m.hojd} px högt, väntat toppradens 56 (ingen extra rad).`);
  krav(!m.namnSyns, `huvudet 390 px: ett gruppnamn ritas bredvid märket i mobilhuvudet. Väntat bara gruppmärket (tre konkurrerande rader undviks).`);
  krav(m.spridning !== null && m.spridning <= 2, `huvudet 390 px: kontrollernas mittlinjer skiljer ${m.spridning} px i höjdled, alltså mer än en rad.`);
  krav((m.over ?? 1) <= 0, `huvudet 390 px: flödar ${m.over} px i sidled.`);
  if (bildmapp) await page.screenshot({ path: path.join(bildmapp, "header-390.png"), clip: { x: 0, y: 0, width: 390, height: 120 } });
  await context.close();
}

// Bilderna till montaget (0.31.0): skala 2,283, alltså samma skala som CP:s förlagor (panelens kort är 411 bildpixlar mot 180 CSS-pixlar).
if (bildmapp) {
  const { page, context } = await oppna("full", { width: 1024, height: 460 }, standardtema, 2.283, "g3");
  await page.evaluate(() => document.fonts.ready);
  for (const lage of ["utfalld", "infalld"]) {
    if (lage === "infalld") {
      await page.locator('nav[aria-label="Mina grupper"] > button').first().click();
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

// Utan grupp (0.35.0: personen är inte med i någon, det enda tillståndet utan aktiv grupp) och utan undertext: bara rad 1,
// centrerad lodrätt i rutan.
{
  const { page, context } = await oppna("full", { width: 1280, height: 900 }, standardtema, 1, "ingen");
  await page.evaluate(() => document.fonts.ready);
  const m = await page.evaluate(() => {
    const rad1 = document.querySelector('header a[href="/"] [data-marke="rad1"]');
    const box = document.querySelector('header a[href="/"] > span');
    if (!rad1 || !box) return null;
    const r = rad1.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    return { rad2: !!document.querySelector('header a[href="/"] [data-marke="rad2"]'), mittY: r.y + r.height / 2, boxMittY: b.y + b.height / 2 };
  });
  krav(m !== null && m.rad2 === false, "märket utan grupp: rad 2 ritas trots att ingen grupp är aktiv och ingen undertext finns. Väntat bara rad 1.");
  krav(m !== null && Math.abs(m.mittY - m.boxMittY) <= 1, `märket utan undertext: rad 1 mitt ${m?.mittY.toFixed(1)} mot rutans ${m?.boxMittY.toFixed(1)}. Väntat lodrätt centrerad (högst 1 px).`);
  await context.close();
}

// 390 px: märket ritas inte i mobilens huvud (0.31.1). Före 0.31.1 stod monogramrutan här, 40 px och vänsterställd; nu är det
// gruppväxlarens märke som står på den platsen (avsnitt 7 mäter det), och varken monogram eller ordmärke syns.
{
  const { page, context } = await oppna("full", { width: 390, height: 844 }, standardtema, 1, "g3");
  await page.evaluate(() => document.fonts.ready);
  const m = await page.evaluate(() => {
    const syns = (/** @type {Element | null} */ el) => (el ? el.getBoundingClientRect().width > 0 && getComputedStyle(el).visibility !== "hidden" : false);
    const lank = document.querySelector('header a[href="/"]');
    const g = document.querySelector("header [data-gruppmarke]");
    const r = g ? g.getBoundingClientRect() : null;
    return {
      lankSyns: syns(lank),
      monogramSyns: syns(document.querySelector('header [data-marke="ruta"]')),
      gruppmarke: r ? { x: r.x, w: r.width, h: r.height } : null,
    };
  });
  krav(!m.lankSyns && !m.monogramSyns, `märket 390 px: märkeslänken (${m.lankSyns}) eller monogrammet (${m.monogramSyns}) syns. Väntat inget märke i mobilhuvudet.`);
  krav(m.gruppmarke !== null && Math.abs(m.gruppmarke.w - 40) < 0.5 && Math.abs(m.gruppmarke.h - 40) < 0.5, `märket 390 px: gruppmärket är ${m.gruppmarke?.w}x${m.gruppmarke?.h} px, väntat 40x40.`);
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

// Inloggningen med appens BILDLOGGA (0.31.1): syns, centrerad över kortet, högst 40 procent av vyhöjden, och rätt bild för temat.
// CP 2026-09-29 18:40: "INloggningen den nya loggan."
for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  for (const tema of /** @type {const} */ (["light", "dark"])) {
    const { page, context } = await oppna("inloggningbild", vp, tema);
    const m = await page.evaluate(() => {
      const dok = document.documentElement;
      const bilder = [...document.querySelectorAll('[data-marke="bild"] img')];
      const synliga = bilder.filter((i) => i.getBoundingClientRect().width > 0);
      const i = /** @type {HTMLElement | undefined} */ (synliga[0]);
      const r = i ? i.getBoundingClientRect() : null;
      const kort = document.querySelector("h2")?.closest("div.relative, [class*='rounded']");
      const kr = kort ? kort.getBoundingClientRect() : null;
      return {
        antal: bilder.length,
        synliga: synliga.length,
        vald: i ? decodeURIComponent(/** @type {HTMLImageElement} */ (i).src).includes('fill="#ffffff"') ? "ljus" : "mork" : null,
        hojd: r ? r.height : 0,
        mittX: r ? r.x + r.width / 2 : null,
        kortMittX: kr ? kr.x + kr.width / 2 : null,
        inom: r ? r.x >= 0 && r.right <= dok.clientWidth && r.y >= 0 : false,
        text: document.querySelector('[data-marke="rad1"]') !== null,
        alt: i ? /** @type {HTMLImageElement} */ (i).alt : null,
        overflow: dok.scrollWidth > dok.clientWidth,
      };
    });
    const id = `inloggning med bildlogga ${vp.width} px, tema ${tema}`;
    matt.push(`${id}: ${m.synliga} av ${m.antal} bilder synliga (${m.vald}), höjd ${m.hojd.toFixed(0)} px (${((m.hojd / vp.height) * 100).toFixed(0)} % av vyn), mitt ${m.mittX?.toFixed(1)} mot kortets ${m.kortMittX?.toFixed(1)}`);
    krav(m.antal === 2 && m.synliga === 1, `${id}: ${m.synliga} av ${m.antal} bilder syns. Väntat exakt en (en per tema).`);
    krav(m.vald === (tema === "dark" ? "mork" : "ljus"), `${id}: bilden som syns är "${m.vald}", väntat "${tema === "dark" ? "mork" : "ljus"}".`);
    krav(m.hojd > 40 && m.hojd <= vp.height * 0.4, `${id}: bildens höjd ${m.hojd.toFixed(0)} px, väntat mellan 40 px och 40 procent av vyn (${(vp.height * 0.4).toFixed(0)} px).`);
    krav(m.inom, `${id}: bilden ligger inte helt inom vyn.`);
    krav(m.kortMittX !== null && m.mittX !== null && Math.abs(m.mittX - m.kortMittX) <= 1, `${id}: bildens mittlinje ${m.mittX?.toFixed(1)} mot kortets ${m.kortMittX?.toFixed(1)}. Väntat centrerad (högst 1 px).`);
    krav(!m.text, `${id}: textmärket ritas också. Väntat bara bilden.`);
    krav(m.alt === "Bolag Ops", `${id}: alt-texten är "${m.alt}", väntat appens namn "Bolag Ops".`);
    krav(!m.overflow, `${id}: horisontell överflödning.`);
    // Den ljusa bildens VITA botten ska bli sidans papper (mix-blend-multiply), inte en vit ruta på krämfärgad sida. Mäts på pixlarna:
    // bildens övre vänstra hörn (inom clip-path) mot en punkt på sidan strax utanför bilden. Provet kräver att blandningen inte isoleras
    // av ett staplingssammanhang (t.ex. `z-10` på kolumnen), vilket är exakt det som gjorde den verkningslös första gången.
    if (tema === "light") {
      const box = await page.evaluate(() => {
        const i = [...document.querySelectorAll('[data-marke="bild"] img')].find((x) => x.getBoundingClientRect().width > 0);
        const r = /** @type {Element} */ (i).getBoundingClientRect();
        return { x: r.x, y: r.y + 42, w: r.width };
      });
      const png = await page.screenshot({ clip: { x: Math.max(0, box.x - 6), y: box.y, width: 12, height: 1 } });
      const px = await page.evaluate(async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const g = /** @type {CanvasRenderingContext2D} */ (c.getContext("2d"));
        g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, img.width, 1).data;
        return { fora: [d[0], d[1], d[2]], inne: [d[(img.width - 1) * 4], d[(img.width - 1) * 4 + 1], d[(img.width - 1) * 4 + 2]] };
      }, png.toString("base64"));
      const diff = Math.max(...px.fora.map((v, k) => Math.abs(v - px.inne[k])));
      matt.push(`${id}: pixel strax utanför bilden ${px.fora.join(",")}, inne i bildens hörn ${px.inne.join(",")}`);
      krav(diff <= 3, `${id}: bildens vita botten syns som en ruta mot sidan (utanför ${px.fora.join(",")}, inne ${px.inne.join(",")}). Väntat samma färg (mix-blend-multiply utan isolerande staplingssammanhang).`);
    }
    if (bildmapp && tema === "light") await page.screenshot({ path: path.join(bildmapp, `inloggning-bild-${vp.width}.png`) });
    await context.close();
  }
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
    return { idag: mat("Idag"), kalender: mat("Kalender"), hub: mat("Appar") };
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
      await page.locator('nav[aria-label="Mina grupper"] > button').first().click();
      await page.waitForTimeout(350);
    }
    const m = await page.evaluate(() => {
      const rad = document.querySelector('nav[aria-label="Var du är"]');
      const panel = document.querySelector('nav[aria-label="Mina grupper"]');
      const rutnat = document.querySelector("main ul[aria-label]");
      if (!rad || !panel || !rutnat) return null;
      const r = rad.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      const u = rutnat.getBoundingClientRect();
      const kol = /** @type {HTMLElement} */ (panel.parentElement && panel.parentElement.parentElement);
      return {
        radL: r.left, radR: r.right, panelR: p.right, rutL: u.left, rutR: u.right,
        marginL: parseFloat(getComputedStyle(rad).marginLeft), marginR: parseFloat(getComputedStyle(rad).marginRight),
        posRad: getComputedStyle(rad).position,
        kolL: kol ? kol.getBoundingClientRect().right : null,
      };
    });
    krav(m !== null, `tillbaka-raden ${bredd} px ${lage}: raden, panelen eller rutnätet hittades inte.`);
    if (m) {
      matt.push(`tillbaka-raden ${bredd} px ${lage}: rad ${m.radL.toFixed(1)}..${m.radR.toFixed(1)}, panelens högerkant ${m.panelR.toFixed(1)}, rutnät ${m.rutL.toFixed(1)}..${m.rutR.toFixed(1)}, position ${m.posRad}, marginaler ${m.marginL}/${m.marginR}`);
      krav(m.radL >= m.panelR - 0.5, `tillbaka-raden ${bredd} px ${lage}: radens vänsterkant ${m.radL.toFixed(1)} ligger till vänster om panelens högerkant ${m.panelR.toFixed(1)}: raden korsar panelen.`);
      krav(m.marginL >= 0 && m.marginR >= 0, `tillbaka-raden ${bredd} px ${lage}: negativ marginal (${m.marginL}/${m.marginR}).`);
      krav(Math.abs(m.radL - m.rutL) <= 1 && Math.abs(m.radR - m.rutR) <= 1, `tillbaka-raden ${bredd} px ${lage}: raden ${m.radL.toFixed(1)}..${m.radR.toFixed(1)} är inte lika bred som kortens rutnät ${m.rutL.toFixed(1)}..${m.rutR.toFixed(1)}: den hålls inte i innehållskolumnen.`);
      krav(m.posRad !== "sticky" && m.posRad !== "fixed", `tillbaka-raden ${bredd} px ${lage}: raden är ${m.posRad}: den ska ligga i flödet (0.31.2), ingen fast rad som kan hamna över panelen eller över första kortet.`);
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
  // ⛔ En lista eller kalender i en popover placeras och animeras EFTER klicket (Radix mäter sin position i nästa
  // bildruta). Att mäta i samma ögonblick gav "överst false" på CI:s långsammare maskin i PR 183 fast lokalt grönt,
  // samma felform som värdet i PR 176. Vänta därför högst 3 s på att elementet ligger överst, och döm det sista som
  // mättes: något som fortfarande ligger över efter 3 s är ett riktigt fel, och `ovanpa` säger då vad det är.
  const overstNu = (valjare, text) =>
    page.evaluate(
      ([v, t]) => {
        const el = [...document.querySelectorAll(v)].find((e) => (e.textContent || "").trim() === t);
        if (!el) return { finns: false };
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        const top = document.elementFromPoint(x, y);
        const arOverst = !!top && (el === top || el.contains(top) || top.contains(el));
        const ovanpa = arOverst || !top ? null : `${top.tagName.toLowerCase()}.${String(top.className).split(/\s+/).slice(0, 4).join(".")}`;
        return { finns: true, iVyn: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, overst: arOverst, ovanpa };
      },
      [valjare, text],
    );
  /** @param {string} valjare @param {string} text */
  const overst = async (valjare, text) => {
    const slut = Date.now() + 3000;
    let m = await overstNu(valjare, text);
    while (!(m.finns && m.iVyn && m.overst) && Date.now() < slut) {
      await page.waitForTimeout(50);
      m = await overstNu(valjare, text);
    }
    return m;
  };
  varde = async () => JSON.parse((await page.locator("[data-varde]").textContent()) || "{}");
  // ⛔ Ett val skrivs till formuläret när React har renderat om, inte i samma ögonblick som
  // klicket. Att läsa värdet direkt gav {} på CI:s långsammare maskin i PR 176 fast valet
  // landade (slutmätningen visade typ "deadline"). Vänta därför på värdet, högst 3 s, och
  // döm det sista som lästes: ett val som aldrig når formuläret är fortfarande rött.
  /** @param {(v: any) => boolean} villkor */
  const vantaPaVarde = async (villkor) => {
    const slut = Date.now() + 3000;
    let v = await varde();
    while (!villkor(v) && Date.now() < slut) {
      await page.waitForTimeout(50);
      v = await varde();
    }
    return v;
  };

  // Typ
  await page.getByRole("combobox", { name: "Typ" }).click();
  const typLista = await page.locator('[role="listbox"]').count();
  krav(typLista === 1, `modalen ${namn}: typlistan öppnades inte (${typLista} listor).`);
  typVal = await overst('[role="option"]', "Deadline");
  krav(typVal.finns === true && typVal.iVyn === true && typVal.overst === true, `modalen ${namn}: typlistans val "Deadline" ${JSON.stringify(typVal)}: väntat synligt, inom vyn och överst (ej bakom modalen).`);
  if (typVal.finns) {
    await page.getByRole("option", { name: "Deadline" }).click({ timeout: 3000 }).catch(() => krav(false, `modalen ${namn}: "Deadline" gick inte att klicka (något ligger över listan).`));
    { const v = await vantaPaVarde((x) => x.typ === "deadline"); krav(v.typ === "deadline", `modalen ${namn}: valet nådde inte formulärets typ (${JSON.stringify(v)}).`); }
  }

  // Datum (en typlista som blev kvar öppen stängs först, så att resten av provet kan mäta sitt)
  if ((await page.locator('[role="listbox"]').count()) > 0) await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Datum", exact: true }).click({ timeout: 3000 }).catch(() => krav(false, `modalen ${namn}: datumknappen gick inte att trycka på.`));
  dag = await overst('[role="gridcell"] button', "15");
  krav(dag.finns === true && dag.iVyn === true && dag.overst === true, `modalen ${namn}: kalenderns dag 15 ${JSON.stringify(dag)}: väntat synlig, inom vyn och överst.`);
  if (dag.finns) {
    await page.locator('[role="gridcell"] button:not([disabled])', { hasText: /^15$/ }).first().click({ timeout: 3000 }).catch(() => krav(false, `modalen ${namn}: dag 15 gick inte att klicka (något ligger över kalendern).`));
    { const v = await vantaPaVarde((x) => /-15$/.test(x.datum || "")); krav(/-15$/.test(v.datum || ""), `modalen ${namn}: dag 15 nådde inte formulärets datum (${JSON.stringify(v)}).`); }
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
    { const v = await vantaPaVarde((x) => x.tid === "01:30"); krav(v.tid === "01:30", `modalen ${namn}: tiden blev ${JSON.stringify(v.tid)}, väntat "01:30".`); }
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
    const efterTangent = (await vantaPaVarde((x) => x.tid === "02:30")).tid;
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
// innehållskolumnen på dator (896 px som SS EventEditRouteView, centrerad, huvudet och gruppanelen kvar, fast knapprad längst ned till höger) och helskärm
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
      const gruppPanel = document.querySelector('nav[aria-label="Mina grupper"]');
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
      krav(Math.abs(m.kolW - 896) <= 1, `skapa-panelen ${namn}: kolumnen är ${m.kolW.toFixed(0)} px bred, väntat 896 (SS EventEditRouteView.jsx:145 max-w-4xl).`);
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
// "Skapa i" (0.35.0, #190): ingen gruppväljare. Panelen öppnas direkt i den aktiva gruppen, och dialogen nås bara från raden
// "Skapas i" och visar bara appens egna mål (Mina kalendrar), aldrig en sektion Grupper. Ett val där når formuläret som `mal`,
// och posten skapas ändå i den aktiva gruppen.
for (const [namn, vp] of /** @type {const} */ ([["1280 px", { width: 1280, height: 800 }], ["390 px", { width: 390, height: 844 }]])) {
  const { page, context } = await oppna("skapa", vp, standardtema, 1, "g2");
  try {
    await oppnaSkapaPanel(page, vp.width < 800);
    await page.waitForSelector("[data-skapa-panel]", { timeout: 3000 });
    const fore = await page.evaluate(() => ({ dialoger: document.querySelectorAll('[role="dialog"][aria-label="Skapa i"]').length, grupp: (document.querySelector("[data-grupp]") || {}).textContent }));
    krav(fore.dialoger === 0, `skapa i ${namn}: väljaren "Skapa i" öppnades före panelen (${fore.dialoger}). Väntat panelen direkt, i den aktiva gruppen.`);
    krav(fore.grupp === "groupId=g2", `skapa i ${namn}: formuläret fick ${fore.grupp}, väntat groupId=g2 (den aktiva gruppen).`);
    await page.getByRole("button", { name: "Skapas i: Testgruppen" }).click();
    const dlg = page.getByRole("dialog", { name: "Skapa i" });
    await dlg.waitFor({ timeout: 3000 });
    const d = await dlg.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const rader = [...el.querySelectorAll("section")].map((s) => ({ namn: s.getAttribute("aria-label"), antal: s.querySelectorAll("button").length }));
      return { x: r.x, w: r.width, top: r.top, bottom: r.bottom, vw: (document.querySelector('header') || document.documentElement).getBoundingClientRect().width, vh: innerHeight, rader, radie: parseFloat(getComputedStyle(el).borderTopLeftRadius), avbryt: [...el.querySelectorAll("button")].some((b) => (b.textContent || "").trim() === "Avbryt") };
    });
    matt.push(`skapa i ${namn}: dialog ${d.w.toFixed(0)} px bred, sektioner ${JSON.stringify(d.rader)}`);
    krav(vp.width < 640 ? true : d.radie === 24, `skapa i ${namn}: dialogen har rundning ${d.radie}, väntat 24 (SS rounded-2xl).`);
    krav(d.rader.length === 1 && d.rader[0].namn === "Mina kalendrar" && d.rader[0].antal === 2, `skapa i ${namn}: sektionerna är ${JSON.stringify(d.rader)}, väntat bara Mina kalendrar med två poster (ingen sektion Grupper sedan 0.35.0).`);
    krav(d.avbryt && d.x >= 0 && d.x + d.w <= d.vw + 0.5 && d.bottom <= d.vh + 0.5, `skapa i ${namn}: Avbryt saknas eller dialogen ligger utanför vyn.`);
    krav(vp.width < 800 ? Math.abs(d.w - d.vw) < 1 : d.w <= 384.5, `skapa i ${namn}: dialogen är ${d.w.toFixed(0)} px bred (väntat helbredd som ark på telefon, högst 384 centrerad på dator).`);
    if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `skapa-i-${vp.width}.png`) });
    await dlg.getByRole("button", { name: /Semester/ }).click();
    await page.waitForSelector("[data-skapa-panel]", { timeout: 3000 });
    const efter = await page.evaluate(() => ({ grupp: (document.querySelector("[data-grupp]") || {}).textContent, rad: [...document.querySelectorAll("[data-skapa-panel] button")].map((b) => b.getAttribute("aria-label")).filter(Boolean) }));
    krav(efter.grupp === "groupId=g2", `skapa i ${namn}: formuläret fick ${efter.grupp} efter valet av kalender, väntat groupId=g2 (posten skapas i den aktiva gruppen).`);
    krav(efter.rad.includes("Skapas i: Semester"), `skapa i ${namn}: raden "Skapas i: Semester" saknas (${efter.rad.join(", ")}).`);
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
      const panel = document.querySelector('nav[aria-label="Mina grupper"]');
      const vaxlare = document.querySelector('header button[aria-label^="Byt grupp"]');
      const vr = vaxlare ? vaxlare.getBoundingClientRect() : null;
      const namn = vaxlare ? [...vaxlare.querySelectorAll("span")].map((x) => x.textContent || "").join("|") : "";
      // 0.31.1: knappen har två former (mobilens gruppmärke `md:hidden`, från md märke + namn). Märket är det första SYNLIGA barnets första barn.
      const synligtBarn = vaxlare ? [...vaxlare.children].find((c) => c.getBoundingClientRect().width > 0) : null;
      const markW = synligtBarn ? (synligtBarn.hasAttribute("data-gruppmarke") ? synligtBarn : synligtBarn.firstElementChild ?? synligtBarn).getBoundingClientRect().width : 0;
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
// Fynd 3: en sida under modulen bär samma tillbaka-rad (0.31.2: en textlänk "Tillbaka" till ETT steg upp, se avsnitt 19).
{
  const { page, context } = await oppna("hubbarn", { width: 1280, height: 900 });
  const r = await page.evaluate(() => {
    const n = document.querySelector('nav[aria-label="Var du är"]');
    if (!n) return null;
    return { text: (n.textContent || "").replace(/\s+/g, " ").trim(), lankar: [...n.querySelectorAll("a")].map((a) => a.getAttribute("href")) };
  });
  krav(r !== null, "sidan under modulen: tillbaka-raden saknas. Varje sida under Hub ska ha den (OpsView tillbaka).");
  if (r) {
    matt.push(`sidan under modulen: "${r.text}", länkar ${JSON.stringify(r.lankar)}`);
    krav(r.text === "Tillbaka" && JSON.stringify(r.lankar) === '["/ekonomi"]', `sidan under modulen: raden är "${r.text}" med länkar ${JSON.stringify(r.lankar)}. Väntat "Tillbaka" med en länk till /ekonomi (ett steg upp).`);
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

// ══ 18. VARJE VALMENY: RADENS TEXT, HÖJD OCH VALDA TILLSTÅND MOT SS (0.31.2) ═════════════════════
// CP 2026-09-29 19:50, med en skärmbild av filtrets "Slag"-dropdown: "Typsnitten är inte syncade. Stor text och kanske inte rätt typsnitt?
// Har ni verkligen gått igenom allt? Kolla olika 'slag'". Raderna var 16 px (SS: 12), hade rundning 8 px och en tjock accentram runt den
// valda raden (Radix flyttar fokus in i menyn). Fyra kopior av samma rad i fyra filer, och menyns egen rad (`radKlass`) hade rättats i
// 0.30.0 utan att valraderna följde med. Tabellen med varje yta och dess SS-förlaga står i docs/jamforelser/0.31.2/menyer.md.
//
// Mäts per yta i BÅDA bredderna (1280 och 390), efter att ytan öppnats med TANGENTBORDET (så att Radix fokus i menyn syns som det gör för
// den som använder tangentbord): radens textstorlek, vikt och typsnitt, vänster- och övre luft, höjd (minst 44 px: tumkravet, SS är 38),
// och på den VALDA raden: ingen kant, ingen konturram, en bock (utom aktiv menyrad, som är färgad som SS) och en yta som skiljer sig
// från behållaren.
//
// ⛔ GOLV: minst så många rader som ytan har, annars är mätningen tom. Och minst 12 ytor mättes (ytorna i tabellen).
const FAMILJ = "Plus Jakarta Sans";
/** @typedef {{ id: string, namn: string, scen?: string, aktiv?: string | null, bredd?: number[], oppna: (page: import("playwright").Page) => Promise<void>, rader: string, valt?: string | null, font: number, vikt?: number, padX?: number | null, padY?: number | null, hojdMin?: number, bock?: boolean, minRader: number, dialog?: boolean, viktUndantag?: number, hojd?: number }} MenyYta */
/** @type {MenyYta[]} */
const MENYYTOR = [
  { id: "filter-slag", namn: "Filter, en ikon per grupp (Slag)", scen: "menyer", oppna: (p) => p.locator('[data-m="filter-ikoner"] button[aria-label^="Slag"]').press("Enter"), rader: '[data-radix-popper-content-wrapper] button[aria-pressed]', valt: '[aria-pressed="true"]', font: 12, padX: 12, padY: 6, vikt: 500, hojd: 28, bock: true, minRader: 4 },
  { id: "filter-sortering", namn: "Filter, sorteringsikonen", scen: "menyer", oppna: (p) => p.locator('[data-m="filter-ikoner"] button[aria-label^="Sortera"]').press("Enter"), rader: '[data-radix-popper-content-wrapper] button[aria-pressed]', valt: '[aria-pressed="true"]', font: 12, padX: 12, padY: 6, vikt: 500, hojd: 28, bock: true, minRader: 2 },
  { id: "filter-samlad", namn: "Filter, samlad panel", scen: "menyer", oppna: (p) => p.locator('[data-m="filter-samlad"] button[aria-label="Filter och sortering"]').press("Enter"), rader: '[data-radix-popper-content-wrapper] button[aria-pressed]', valt: '[aria-pressed="true"]', font: 12, padX: 12, padY: 6, vikt: 500, hojd: 28, bock: true, minRader: 6 },
  { id: "chip-ikon", namn: "OpsFilterChip, ikon", scen: "menyer", oppna: (p) => p.locator('[data-m="chip-ikon"] button').press("Enter"), rader: '[data-radix-popper-content-wrapper] button[aria-pressed]', valt: '[aria-pressed="true"]', font: 12, padX: 12, padY: 6, vikt: 500, hojd: 28, bock: true, minRader: 4 },
  { id: "chip-text", namn: "OpsFilterChip, textpiller", scen: "menyer", oppna: (p) => p.locator('[data-m="chip-text"] button').press("Enter"), rader: '[data-radix-popper-content-wrapper] button[aria-pressed]', valt: '[aria-pressed="true"]', font: 12, padX: 12, padY: 6, vikt: 500, hojd: 28, bock: true, minRader: 4 },
  { id: "tema", namn: "Temaväljaren", scen: "menyer", oppna: (p) => p.locator('[data-m="tema"] button').press("Enter"), rader: '[data-radix-popper-content-wrapper] button[aria-pressed]', valt: '[aria-pressed="true"]', font: 12, padX: 12, padY: 6, vikt: 500, hojd: 28, bock: true, minRader: 3 },
  { id: "status", namn: "Idag/Kommande, statusmenyn", scen: "menyer", oppna: (p) => p.locator('[data-m="status"] [role="tab"]').last().click(), rader: '[role="menuitemradio"]', valt: '[aria-checked="true"]', font: 14, padX: 12, padY: 10, hojd: 40, bock: true, minRader: 3 },
  { id: "select", namn: "OpsSelect", scen: "menyer", oppna: (p) => p.locator('[data-m="select"] button').press("Enter"), rader: '[role="option"]', valt: '[role="option"][data-state="checked"]', font: 14, padX: 12, padY: 8, hojd: 36, bock: true, minRader: 3 },
  { id: "tid", namn: "OpsTimePicker", scen: "menyer", oppna: (p) => p.locator('[data-m="tid"] button').first().press("Enter"), rader: '[role="option"]', valt: '[role="option"][data-state="checked"]', font: 14, padX: 12, padY: 8, hojd: 36, bock: true, minRader: 10 },
  { id: "datum", namn: "OpsDatePicker, dagarna", scen: "menyer", oppna: (p) => p.locator('[data-m="datum"] button').press("Enter"), rader: '[role="grid"] button', valt: null, font: 12, padX: null, padY: null, minRader: 28, dialog: true, viktUndantag: 1 },
  { id: "aktivitet", namn: "Aktivitet, Mer-menyn", scen: "menyer", oppna: (p) => p.locator('[data-m="aktivitet"] button[aria-label="Mer"]').press("Enter"), rader: '[data-radix-popper-content-wrapper] button', valt: null, font: 12, padX: 12, padY: 10, hojd: 36, minRader: 1 },
  { id: "gruppvaljare", namn: "OpsGruppvaljare", scen: "menyer", oppna: async () => {}, rader: '[data-m="gruppvaljare"] ul button', valt: '[aria-current="true"]', font: 12, padX: 12, padY: 8, bock: true, minRader: 3 },
  { id: "header-meny", namn: "Huvudets meny", scen: "full", oppna: async (p) => { const v = p.viewportSize(); if (v && v.width < 800) await p.getByRole("button", { name: "Meny" }).last().click(); else await p.getByRole("button", { name: /Meny, fler/ }).click(); }, rader: '[role="dialog"] a[href], [role="dialog"] button[class*="rounded-base"][class*="min-h-11"]', valt: null, font: 12, padX: 12, padY: 10, minRader: 3, dialog: true },
  { id: "skapa-dropdown", namn: "Skapa-menyn (plus)", scen: "skapa", bredd: [1280], oppna: (p) => p.getByRole("button", { name: "Skapa", exact: true }).last().click(), rader: '[role="dialog"] button[class*="min-h-11"]', valt: null, font: 14, vikt: 500, padX: 16, padY: 10, minRader: 1, dialog: true },
  { id: "hub-dropdown", namn: "Hub-rullgardinen", scen: "full", bredd: [1280], oppna: (p) => p.getByRole("button", { name: "Visa sidorna under Appar" }).click(), rader: '[role="dialog"] a[href]', valt: null, font: 12, padX: 12, padY: 10, minRader: 2, dialog: true },
  { id: "skapa-i", namn: "Skapa i, dialogen", scen: "skapa", aktiv: "g1", oppna: async (p) => { await p.getByRole("button", { name: "Skapa", exact: true }).last().click(); await p.getByRole("button", { name: "Ny händelse" }).click(); await p.getByRole("button", { name: /^Skapas i:/ }).click(); }, rader: '[role="dialog"][aria-label="Skapa i"] section button, [role="dialog"] section button', valt: null, font: 14, padX: 12, padY: 12, minRader: 2, dialog: true },
];
let ytorMatta = 0;
for (const y of MENYYTOR) {
  for (const bredd of y.bredd ?? [1280, 390]) {
    const vp = { width: bredd, height: bredd < 800 ? 844 : 800 };
    const etikett = `${y.namn} (${bredd} px)`;
    const { page, context } = await oppna(y.scen ?? "menyer", vp, standardtema, 1, y.aktiv ?? null);
    try {
      await page.evaluate(() => document.fonts.ready);
      await y.oppna(page);
      await page.waitForSelector(y.rader.split(",")[0].trim(), { timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(250);
      const m = await page.evaluate(({ raderSel, valtSel }) => {
        /** @param {string} c */
        const opak = (c) => !/rgba?\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(c) && c !== "transparent";
        /** @param {Element} el */
        const rad = (el) => {
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          const kant = Math.max(...["Top", "Right", "Bottom", "Left"].map((k) => parseFloat(/** @type {any} */ (cs)[`border${k}Width`]) || 0));
          const kontur = cs.outlineStyle !== "none" ? parseFloat(cs.outlineWidth) || 0 : 0;
          /** @type {Element | null} */
          let b = el.parentElement;
          while (b && !opak(getComputedStyle(b).backgroundColor)) b = b.parentElement;
          return { font: parseFloat(cs.fontSize), vikt: parseInt(cs.fontWeight, 10), familj: cs.fontFamily, lh: cs.lineHeight, h: r.height, w: r.width, padX: parseFloat(cs.paddingLeft), padY: parseFloat(cs.paddingTop), kant, kontur, farg: cs.color, bg: cs.backgroundColor, behallare: b ? getComputedStyle(b).backgroundColor : "", bockar: el.querySelectorAll("svg").length, fokus: el === document.activeElement || el.matches(":focus-visible"), text: (el.textContent || "").trim().slice(0, 24) };
        };
        const rader = [...document.querySelectorAll(raderSel)].filter((e) => e.getBoundingClientRect().height > 0).map(rad);
        const valt = valtSel ? [...document.querySelectorAll(raderSel)].filter((e) => e.matches(valtSel) && e.getBoundingClientRect().height > 0).map(rad) : [];
        const inkEl = document.createElement("div");
        inkEl.style.color = "var(--color-ink)";
        document.body.appendChild(inkEl);
        const ink = getComputedStyle(inkEl).color;
        inkEl.remove();
        return { ink, rader, valt, aktivt: document.activeElement ? (document.activeElement.textContent || "").trim().slice(0, 20) : "" };
      }, { raderSel: y.rader, valtSel: y.valt ?? null });
      ytorMatta += 1;
      krav(m.rader.length >= y.minRader, `${etikett}: ${m.rader.length} rader lästa, väntat minst ${y.minRader}. Ytan öppnades inte eller raderna har ett annat namn (mätningen får inte bli grön av att inget hittades).`);
      const r0 = m.rader[0];
      if (r0) {
        const fonts = [...new Set(m.rader.map((r) => r.font))];
        const hojder = [...new Set(m.rader.map((r) => Math.round(r.h)))];
        matt.push(`valmeny ${etikett}: ${m.rader.length} rader, text ${fonts.join("/")} px vikt ${r0.vikt} ${r0.familj.split(",")[0].replace(/"/g, "")}, luft ${r0.padX}/${r0.padY} px, höjd ${hojder.join("/")} px, vald ${m.valt.length ? `kant ${m.valt[0].kant} kontur ${m.valt[0].kontur} bockar ${m.valt[0].bockar} yta ${m.valt[0].bg === m.valt[0].behallare ? "lika som behållaren" : "skild"}` : "ingen"}`);
        krav(m.rader.every((r) => r.font === y.font), `${etikett}: textstorlek ${fonts.join("/")} px, väntat ${y.font} px (SS: ${y.font === 12 ? "text-xs" : y.font === 14 ? "text-sm" : "text-base"}). CP 2026-09-29: "Stor text".`);
        krav(m.rader.every((r) => r.familj.includes(FAMILJ)), `${etikett}: typsnittet är ${r0.familj}, väntat ${FAMILJ} (tokenets --font-sans).`);
        krav(m.rader.filter((r) => r.vikt !== (y.vikt ?? 400)).length <= (y.viktUndantag ?? 0), `${etikett}: vikten är ${[...new Set(m.rader.map((r) => r.vikt))].join("/")}, väntat ${y.vikt ?? 400}.`);
        if (y.padX !== null && y.padX !== undefined) krav(m.rader.every((r) => r.padX === y.padX && r.padY === y.padY), `${etikett}: luften är ${r0.padX}/${r0.padY} px, väntat ${y.padX}/${y.padY} (SS px-${y.padX / 4} py-${y.padY / 4}).`);
        // Höjden: SS egen på dator (radhöjd = radens text 16 eller 20 px + 2 x luften), 44 px träffyta under md (koordinatorn: "CP vill exakt SS").
        if (bredd < 800) krav(m.rader.every((r) => r.h >= 43.5), `${etikett}: en rad är ${Math.min(...m.rader.map((r) => r.h)).toFixed(1)} px hög, väntat minst 44 (tumkravet under md).`);
        else if (y.hojd !== undefined) krav(m.rader.every((r) => Math.abs(r.h - /** @type {number} */ (y.hojd)) <= 0.5), `${etikett}: raderna är ${[...new Set(m.rader.map((r) => r.h))].join("/")} px höga, väntat ${y.hojd} (SS: ${y.hojd - 2 * /** @type {number} */ (y.padY)} px text + 2 x ${y.padY} px).`);
        if (y.valt !== null && y.valt !== undefined) {
          krav(m.valt.length >= 1, `${etikett}: ingen vald rad hittades (${y.valt}). Golv: minst en.`);
          const v = m.valt[0];
          if (v) {
            krav(v.kant === 0, `${etikett}: den valda raden har en kant på ${v.kant} px, väntat ingen (SS: tonad yta och bock, ingen ram).`);
            krav(v.kontur === 0, `${etikett}: den valda raden har en konturram på ${v.kontur} px efter att ytan öppnats med tangentbordet, väntat ingen. Det är den tjocka accentramen i CP:s bild (Radix flyttar fokus till första raden).`);
            krav(v.farg === m.ink, `${etikett}: den valda radens text är ${v.farg}, väntat inkfärgen ${m.ink} (SS ThemedDropdown: text-primary, inte accentfärgad text).`);
            krav(v.bg !== v.behallare, `${etikett}: den valda raden har samma yta (${v.bg}) som behållaren, så valet syns inte.`);
            if (y.bock) krav(v.bockar >= 1, `${etikett}: den valda raden har ingen bock.`);
          }
        }
      }
      if (bildmapp && (y.id === "filter-slag" || y.id === "filter-samlad")) await page.screenshot({ path: path.join(bildmapp, `meny-${y.id}-${bredd}.png`) });
    } catch (e) {
      krav(false, `${etikett}: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
    }
    await context.close();
  }
}
krav(ytorMatta >= 28, `valmenyerna: bara ${ytorMatta} ytor mätta, väntat minst 28 (14 ytor i två bredder, 2 i en). Golv.`);

// ══ 19. HUB, TILLBAKA-RAD OCH MENYHÖJD (0.31.2, CP 2026-09-29 20:57) ══════════
// CP, med två bilder från telefonen (bolag-ops, mörkt, 390 px): "Hubbens kort måste få lite distans från headern. Ekonomi fäller
// inte ut submenyer. Navigeringen tillbaka ser inget bra ut. Gör samma som SessionStudio och aktivitet. Se till att
// aktivitetspanelen blir lika hög som menyn så den inte hoppar. Kanske att meny skall vara en standardhöjd."
// 19a: avståndet under toppraden och sidomarginalen är Idags (OpsView), ingen horisontell överflödning.
// 19b: ett kort med barn fälls ut på plats (aria-expanded, tangentbord), modulens egen sida nås via "Visa Ekonomi".
// 19c: tillbaka-raden är SS textlänk (chevron 20 px, gap 8, text 14 px), inget band, rubriken under, första kortet fritt.
// 19d: menyns rullgardin (1280) och ark (390) har SAMMA höjd i roten och i Aktivitet.
for (const bredd of [390, 768, 1280]) {
  const mat = async (/** @type {string} */ scen, /** @type {string} */ forst) => {
    const { page, context } = await oppna(scen, { width: bredd, height: 900 });
    const m = await page.evaluate((sel) => {
      const h = document.querySelector("header");
      const el = document.querySelector(sel);
      if (!h || !el) return null;
      const d = document.documentElement;
      return { gap: el.getBoundingClientRect().top - h.getBoundingClientRect().bottom, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right, sw: d.scrollWidth, cw: d.clientWidth };
    }, forst);
    await context.close();
    return m;
  };
  const idag = await mat("idag", "[data-idag-forst]");
  const hub = await mat("hub", "main ul[aria-label]");
  krav(idag !== null && hub !== null, `hub ${bredd} px: Idag-referensen eller Hub-rutnätet hittades inte.`);
  if (idag && hub) {
    matt.push(`hub ${bredd} px: avstånd under toppraden ${hub.gap.toFixed(1)} px (Idag ${idag.gap.toFixed(1)}), vänster ${hub.left.toFixed(1)} (Idag ${idag.left.toFixed(1)}), höger ${hub.right.toFixed(1)} av ${hub.cw}, scrollWidth ${hub.sw}`);
    krav(idag.gap >= 20, `hub ${bredd} px: Idag-referensen har bara ${idag.gap.toFixed(1)} px under toppraden, golv 20.`);
    krav(Math.abs(hub.gap - idag.gap) <= 1, `hub ${bredd} px: Hubbens första kort börjar ${hub.gap.toFixed(1)} px under toppraden, Idags första innehåll ${idag.gap.toFixed(1)}. CP: "Hubbens kort måste få lite distans från headern".`);
    krav(Math.abs(hub.left - idag.left) <= 1 && hub.left >= 16 - 0.5 - (bredd >= 1024 ? 16 : 0), `hub ${bredd} px: rutnätets vänsterkant ${hub.left.toFixed(1)} px, Idags ${idag.left.toFixed(1)}. Väntat samma sidomarginal (Hub äger sin ram).`);
    krav(hub.right <= hub.cw - 16 + 0.5 && Math.abs(hub.right - idag.right) <= 1, `hub ${bredd} px: rutnätets högerkant ${hub.right.toFixed(1)} av ${hub.cw} px, Idags ${idag.right.toFixed(1)}. Väntat samma marginal åt höger: korten går inte ut i kanten.`);
    krav(hub.sw <= hub.cw, `hub ${bredd} px: horisontell överflödning (scrollWidth ${hub.sw} mot ${hub.cw}).`);
  }
}
// 19b
for (const bredd of [390, 1280]) {
  const { page, context } = await oppna("hub", { width: bredd, height: 900 });
  const knappar = page.locator("main ul[aria-label] button[aria-expanded]");
  krav((await knappar.count()) === 1, `hub ${bredd} px: ${await knappar.count()} utfällbara kort, väntat 1 (Ekonomi, den enda modulen med barn).`);
  if ((await knappar.count()) === 1) {
    const knapp = knappar.first();
    const synliga = () => page.evaluate(() => [...document.querySelectorAll("main ul[aria-label] a")].filter((a) => a.getBoundingClientRect().height > 0).map((a) => (a.textContent || "").trim().replace(/\s+/g, " ")));
    const fore = await synliga();
    krav((await knapp.getAttribute("aria-expanded")) === "false" && !fore.some((t) => t.startsWith("Inkomster")), `hub ${bredd} px: Ekonomi ska börja hopfälld (aria-expanded false, inga barn synliga), var ${await knapp.getAttribute("aria-expanded")} med ${fore.join(" | ")}.`);
    await knapp.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    const efter = await synliga();
    const rot = await page.evaluate(() => {
      const b = document.querySelector("main ul[aria-label] button[aria-expanded] > span > span:last-child");
      return b ? `${getComputedStyle(b).rotate} ${getComputedStyle(b).transform}`.trim() : "saknas";
    });
    matt.push(`hub ${bredd} px: Ekonomi utfälld med Enter: ${efter.filter((t) => !fore.includes(t)).join(" | ")}; chevron ${rot}`);
    krav((await knapp.getAttribute("aria-expanded")) === "true", `hub ${bredd} px: aria-expanded är inte true efter Enter på Ekonomi.`);
    krav(efter.some((t) => t.startsWith("Visa Ekonomi")) && efter.some((t) => t.startsWith("Inkomster")) && efter.some((t) => t.startsWith("Bokslut")), `hub ${bredd} px: efter utfällning saknas "Visa Ekonomi", Inkomster eller Bokslut (${efter.join(" | ")}).`);
    krav(/180deg|matrix\(-1/.test(rot), `hub ${bredd} px: chevronen vrids inte när kortet är utfällt (transform ${rot}).`);
    krav(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `hub ${bredd} px: utfällt kort flödar i sidled.`);
    if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `hub-utfalld-${bredd}.png`), fullPage: true });
    await page.getByRole("link", { name: "Visa Ekonomi" }).click();
    krav(JSON.stringify(await page.evaluate(() => window.__gick)) === '["/ekonomi"]', `hub ${bredd} px: "Visa Ekonomi" navigerade inte till /ekonomi.`);
    await knapp.focus();
    await page.keyboard.press("Space");
    krav((await knapp.getAttribute("aria-expanded")) === "false" && !(await synliga()).some((t) => t.startsWith("Inkomster")), `hub ${bredd} px: Space på Ekonomi fäller inte ihop kortet.`);
  }
  await context.close();
}
// 19c
for (const [scen, bredd] of /** @type {const} */ ([["hubmodul", 390], ["hubmodul", 1280], ["hubbarn", 390]])) {
  const { page, context } = await oppna(scen, { width: bredd, height: 900 });
  const m = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Var du är"]');
    if (!nav) return null;
    const lank = nav.querySelector("a");
    const svg = lank && lank.querySelector("svg");
    const ord = lank && lank.querySelector("span");
    const kant = (/** @type {Element} */ e) => Math.max(...["Top", "Right", "Bottom", "Left"].map((k) => parseFloat(/** @type {any} */ (getComputedStyle(e))[`border${k}Width`]) || 0));
    /** @type {string[]} */
    const fasta = [];
    for (let e = /** @type {Element | null} */ (nav); e && e !== document.body; e = e.parentElement) if (["sticky", "fixed"].includes(getComputedStyle(e).position)) fasta.push(e.tagName);
    const h1 = document.querySelector("main h1");
    const rutnat = document.querySelector("main ul[aria-label]");
    const lr = lank ? lank.getBoundingClientRect() : null;
    return {
      kant: kant(nav), kantForalder: nav.parentElement ? kant(nav.parentElement) : 0,
      bg: getComputedStyle(nav).backgroundColor, bgForalder: nav.parentElement ? getComputedStyle(nav.parentElement).backgroundColor : "",
      fasta, text: lank ? (lank.textContent || "").trim() : "", font: ord ? parseFloat(getComputedStyle(ord).fontSize) : 0,
      svgW: svg ? svg.getBoundingClientRect().width : 0, gap: svg && ord ? ord.getBoundingClientRect().left - svg.getBoundingClientRect().right : -1,
      lankBottom: lr ? lr.bottom : 0, lankH: lr ? lr.height : 0, lankLeft: lr ? lr.left : 0,
      h1Top: h1 ? h1.getBoundingClientRect().top : null, h1Bottom: h1 ? h1.getBoundingClientRect().bottom : null, h1Font: h1 ? parseFloat(getComputedStyle(h1).fontSize) : 0,
      rutTop: rutnat ? rutnat.getBoundingClientRect().top : null, rutLeft: rutnat ? rutnat.getBoundingClientRect().left : null,
    };
  });
  krav(m !== null, `tillbaka-raden ${scen} ${bredd} px: raden hittades inte.`);
  if (m) {
    matt.push(`tillbaka-raden ${scen} ${bredd} px: "${m.text}", ram ${m.kant}/${m.kantForalder} px, bakgrund ${m.bg}, fast ${JSON.stringify(m.fasta)}, chevron ${m.svgW} px, glapp ${m.gap.toFixed(1)}, text ${m.font} px, rubrik ${m.h1Top === null ? "ingen" : `${m.h1Font} px, ${(m.h1Top - m.lankBottom).toFixed(1)} px under länken`}`);
    krav(m.kant === 0 && m.kantForalder === 0, `tillbaka-raden ${scen} ${bredd} px: raden har en ram (${m.kant}/${m.kantForalder} px). CP: inget band med linje under, en textlänk som SessionStudio.`);
    krav(/rgba?\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)|transparent/.test(m.bg) && /rgba?\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)|transparent/.test(m.bgForalder), `tillbaka-raden ${scen} ${bredd} px: raden har en bakgrundsyta (${m.bg} / ${m.bgForalder}), väntat ingen (inget band).`);
    krav(m.fasta.length === 0, `tillbaka-raden ${scen} ${bredd} px: raden eller en förälder är sticky/fixed (${m.fasta.join(", ")}). Ett fast band täckte första kortet i CP:s bild.`);
    krav(m.text === "Tillbaka" && m.svgW === 20 && Math.abs(m.gap - 8) <= 0.5 && m.font === 14, `tillbaka-raden ${scen} ${bredd} px: "${m.text}", chevron ${m.svgW} px, glapp ${m.gap.toFixed(1)}, text ${m.font} px. Väntat SS: "Tillbaka", ChevronLeft w-5 (20), gap-2 (8), text-sm (14) (GroupEditRouteView.jsx:41-47).`);
    krav(m.lankH >= 44, `tillbaka-raden ${scen} ${bredd} px: länken är ${m.lankH} px hög, väntat minst 44 (tumme).`);
    if (scen === "hubmodul") {
      krav(m.h1Top !== null && m.h1Top >= m.lankBottom - 1 && m.h1Top - m.lankBottom <= 12, `tillbaka-raden ${scen} ${bredd} px: rubriken ska stå direkt under länken (${m.h1Top === null ? "saknas" : (m.h1Top - m.lankBottom).toFixed(1)} px under).`);
      krav(m.rutTop !== null && m.h1Bottom !== null && m.rutTop - m.h1Bottom >= 12, `tillbaka-raden ${scen} ${bredd} px: första kortet börjar ${m.rutTop === null || m.h1Bottom === null ? "?" : (m.rutTop - m.h1Bottom).toFixed(1)} px under rubriken, väntat minst 12 (CP: "första kortets överkant" låg under raden).`);
      krav(m.rutLeft !== null && Math.abs(m.rutLeft - m.lankLeft) <= 1, `tillbaka-raden ${scen} ${bredd} px: länkens vänsterkant ${m.lankLeft.toFixed(1)} är inte kortens ${m.rutLeft}.`);
    }
  }
  if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `tillbaka-${scen}-${bredd}.png`), clip: { x: 0, y: 0, width: bredd, height: 420 } });
  await context.close();
}
// 19d
for (const [bredd, hojd] of /** @type {const} */ ([[1280, 800], [390, 844]])) {
  const { page, context } = await oppna("meny", { width: bredd, height: hojd });
  await (bredd < 800 ? page.getByRole("button", { name: "Meny" }).last() : page.getByRole("button", { name: /Meny, fler/ })).click();
  await page.waitForSelector('[role="dialog"]');
  const h = () => page.evaluate(() => { const r = document.querySelector('[role="dialog"]').getBoundingClientRect(); return { h: r.height, y: r.top, bottom: r.bottom }; });
  const rot = await h();
  if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `meny-rot-hojd-${bredd}.png`) });
  await page.getByRole("button", { name: /Aktivitet/ }).click();
  await page.waitForTimeout(200);
  const akt = await h();
  krav(rot.h > 200, `menyn ${bredd} px: rutan är bara ${rot.h.toFixed(1)} px hög, väntat en standardhöjd (över 200).`);
  matt.push(`menyn ${bredd} px: höjd ${rot.h.toFixed(1)} i roten och ${akt.h.toFixed(1)} i Aktivitet, överkant ${rot.y.toFixed(1)}/${akt.y.toFixed(1)}`);
  krav(Math.abs(rot.h - akt.h) <= 1, `menyn ${bredd} px: höjden är ${rot.h.toFixed(1)} i roten och ${akt.h.toFixed(1)} i Aktivitet. CP: "Se till att aktivitetspanelen blir lika hög som menyn så den inte hoppar."`);
  krav(akt.bottom <= hojd + 0.5 && akt.y >= 0, `menyn ${bredd} px: rutan ligger utanför fönstret (${akt.y.toFixed(1)}..${akt.bottom.toFixed(1)} av ${hojd}).`);
  if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `meny-aktivitet-hojd-${bredd}.png`) });
  await context.close();
}

// ══ 20. TEXTSTORLEK: EN SKALA, HÄMTAD FRÅN ROLLERNA (0.31.2, uppgift 5) ═══════
// CP 2026-09-29 21:00, med en bild av Idag (390 px, ett utfällt kort): "Fortfarande jävla diffar i textstorlek på olika håll. Kan det
// bli enhetligt och läsa från samma klasser." På bilden hade Idag/Kommande-pillret, hjälptexten, kortets chips, kortets meta,
// kortets titel, faktatabellens etiketter och värden, och bottenraden alla olika storlekar: komponenterna skrev `text-sm`,
// `text-xs`, `text-base` och `text-lg` rakt av, och det som saknade storlek ärvde 16 px från body.
// Mått (samma element på båda bredderna jämförs inom `main`, eftersom skalets krom byter form vid brytpunkten): varje synligt textelement på fixtursidorna vid 390 och 1280 (a) bär en roll (klassen självt eller en förälder), (b) har en
// storlek ur rollmängden, (c) har SS-värdet för sin roll PER BRYTPUNKT (`sm:text-<roll>`: basrollen under 640 px, den andra från), (d) har samma storlek på mobil och dator utom där SS själv har en `sm:`-variant, och (e) ingen komponent
// skriver `text-xs/sm/base/md/lg/xl` längre. Golv: minst 60 textelement.
/** SS-värdena (px) per roll, avlästa ur SessionStudio: se `tokens/sessionstudio-profil.json` typografi.roller. */
const ROLLER = { mikro: 8, liten: 10, hjalp: 11, meta: 12, sektion: 12, etikett: 14, brod: 16, rubrik: 16, titel: 18, sida: 20 };
const ROLLMANGD = new Set(Object.values(ROLLER));
const TYPSIDOR = /** @type {const} */ ([
  ["idagkort", async (/** @type {any} */ p) => { await p.locator("main ul button[aria-expanded]").first().click(); }],
  ["hub", async (/** @type {any} */ p) => { await p.locator("main ul[aria-label] button[aria-expanded]").first().click(); }],
  ["hubmodul", async () => {}],
  ["installning", async () => {}],
  ["full", async (/** @type {any} */ p) => { const v = p.viewportSize(); await (v && v.width < 800 ? p.getByRole("button", { name: "Meny" }).last() : p.getByRole("button", { name: /Meny, fler/ })).click(); }],
]);
/** @type {Map<string, number>} */
const storlekPerText = new Map();
let textMatta = 0;
/** @type {string[]} */
const avvikelser = [];
const listor = argv.includes("--storlekar");
for (const bredd of [390, 1280]) {
  for (const [scen, oppnaSida] of TYPSIDOR) {
    const { page, context } = await oppna(scen, { width: bredd, height: bredd < 800 ? 844 : 900 });
    try { await oppnaSida(page); await page.waitForTimeout(250); } catch { /* sidan saknar det som ska öppnas: mätningen nedan räknar det */ }
    const m = await page.evaluate((roller) => {
      /** @type {{ text: string, px: number, vikt: number, lh: string, roll: string | null, klass: string, gammal: string[], tag: string, iMain: boolean, smRoll: string | null }[]} */
      const ut = [];
      const namn = Object.keys(roller).join("|");
      const rollRe = new RegExp(`(?:^|\\s)text-(${namn})(?:\\s|$)`);
      const smRe = new RegExp(`(?:^|\\s)sm:text-(${namn})(?:\\s|$)`);
      const gammalRe = /(?:^|\s)(?:[a-z]+:)*text-(?:xs|sm|base|md|lg|xl|2xl|3xl)(?:\s|$)/;
      for (const el of document.querySelectorAll("body *")) {
        if (["SCRIPT", "STYLE", "SVG", "PATH"].includes(el.tagName.toUpperCase())) continue;
        // Märket (loggan) är text ritad som bild och mäts i avsnitt 10, inte här.
        if (el.closest("[data-marke]")) continue;
        const egen = [...el.childNodes].filter((n) => n.nodeType === 3 && (n.textContent || "").trim()).map((n) => (n.textContent || "").trim()).join(" ");
        if (!egen) continue;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (r.width <= 1 || r.height <= 1 || cs.visibility === "hidden" || cs.display === "none") continue;
        let roll = null;
        let smRoll = null;
        for (let e = /** @type {Element | null} */ (el); e && e !== document.body; e = e.parentElement) {
          const k = typeof e.className === "string" ? e.className : "";
          const mm = rollRe.exec(k);
          const sv = smRe.exec(k);
          if (mm || sv) { roll = mm ? mm[1] : sv ? sv[1] : null; smRoll = sv ? sv[1] : null; break; }
        }
        const klass = typeof el.className === "string" ? el.className : "";
        ut.push({ text: egen.slice(0, 30), px: parseFloat(cs.fontSize), vikt: parseInt(cs.fontWeight, 10), lh: cs.lineHeight, roll, klass, gammal: gammalRe.test(klass) ? klass.split(/\s+/).filter((c) => /text-(xs|sm|base|md|lg|xl|2xl|3xl)$/.test(c)) : [], tag: el.tagName.toLowerCase(), iMain: !!el.closest("main"), smRoll });
      }
      return ut;
    }, ROLLER);
    textMatta += m.length;
    /** @type {Map<string, number>} */
    const antalPerText = new Map();
    const dist = [...new Set(m.map((e) => e.px))].sort((a, b) => a - b);
    matt.push(`textstorlek ${scen} ${bredd} px: ${m.length} textelement, storlekar ${dist.join("/")} px${listor ? ` [${dist.map((d) => `${d}: ${[...new Set(m.filter((e) => e.px === d).map((e) => e.text))].slice(0, 6).join(" | ")}`).join(" ;; ")}]` : ""}`);
    for (const e of m) {
      const id = `${scen} ${bredd} px "${e.text}"`;
      if (!ROLLMANGD.has(e.px)) avvikelser.push(`${id}: ${e.px} px är ingen roll (rollmängd ${[...ROLLMANGD].join("/")}).`);
      if (e.gammal.length) avvikelser.push(`${id}: bär ${e.gammal.join(" ")} i stället för en roll.`);
      if (e.roll === null) avvikelser.push(`${id}: ingen roll (varken elementet eller en förälder bär text-<roll>), storleken ${e.px} px är ärvd.`);
      else {
        // ⛔ SS-värdet PER BRYTPUNKT: en roll med `sm:text-<roll>` är basrollen under 640 px och den andra från 640 px (SS `text-xs sm:text-sm`).
        const vantatPx = bredd >= 640 && e.smRoll ? ROLLER[/** @type {keyof typeof ROLLER} */ (e.smRoll)] : ROLLER[/** @type {keyof typeof ROLLER} */ (e.roll)];
        if (e.px !== vantatPx) avvikelser.push(`${id}: rollen ${e.smRoll && bredd >= 640 ? e.smRoll : e.roll} ger ${e.px} px, SS-värdet vid ${bredd} px är ${vantatPx}.`);
      }
      if (!e.iMain) continue;
      const nte = (antalPerText.get(`${e.text}|${e.tag}`) ?? 0) + 1;
      antalPerText.set(`${e.text}|${e.tag}`, nte);
      const nyckel = `${scen}|${e.text}|${e.tag}|${nte}`;
      const forra = storlekPerText.get(nyckel);
      if (e.smRoll) continue;
      if (bredd === 390) storlekPerText.set(nyckel, e.px);
      else if (forra !== undefined && forra !== e.px) avvikelser.push(`${id}: ${forra} px på mobil och ${e.px} px på dator (samma element, samma roll ska ge samma storlek).`);
    }
    // Idag-kortet: rollerna per innehåll (uppgift 5, bild från CP).
    if (scen === "idagkort") {
      /** @param {string} t */
      const px = (t) => m.filter((e) => e.iMain && e.text.startsWith(t)).map((e) => e.px);
      /** @type {[string, number][]} */
      // 0.33.1: händelsekortet följer inkorgens skala (titel 14, meta 12, pill 10) i alla bredder, CP 2026-09-30 #187. Historik, SS per brytpunkt: titel `text-lg sm:text-xl` (18/20, `TodayView.jsx:89`), metaraden `text-xs sm:text-sm` (12/14, `:83/86`), övrigt `text-sm` (`:258/438/544`).
      const bp = bredd >= 640;
      const vantat = [["Kundfaktura 119223", 14], ["Bara påminnelser", 14], ["Idag", 14], ["Kommande", 14], ["Belopp inkl moms", 14], ["158 400 kr", 14], ["För 19 dagar", 12], ["Faktura", 12], ["Du", 10], ["Försenat", 10]];
      for (const [t, v] of vantat) {
        const funna = px(t);
        // "Du" är här en ROLLTEXT i omslaget (12, text-meta) eller ett rollmärke (10). Rollmärkets 10/500 mäts i avsnitt 25 (0.33.1).
        if (t === "Du") { krav(funna.length > 0 && funna.every((f) => f === 10 || f === 12), `Idag-kortet ${bredd} px: "Du" är ${funna.join("/") || "inte hittad"} px, väntat 12 (rolltext, text-meta) eller 10 (rollmärket).`); continue; }
        krav(funna.length > 0 && funna.every((f) => f === v), `Idag-kortet ${bredd} px: "${t}" är ${funna.length ? funna.join("/") : "inte hittad"} px, väntat ${v} (SS).`);
      }
    }
    if (bildmapp && scen === "idagkort") await page.screenshot({ path: path.join(bildmapp, `idagkort-${bredd}.png`), fullPage: true });
    await context.close();
  }
}
krav(textMatta >= 60, `textstorlek: bara ${textMatta} textelement mätta, väntat minst 60. Golv (en vakt som mäter inget är grön av att inte ha tittat).`);
krav(avvikelser.length === 0, `textstorlek: ${avvikelser.length} avvikelser från rollskalan. Första tio:\n    ${avvikelser.slice(0, listor ? 500 : 10).join("\n    ")}`);
matt.push(`textstorlek: ${textMatta} textelement mätta, ${avvikelser.length} avvikelser`);

// ══ 21. HEMSKÄRMSAPP (iOS STANDALONE): SÄKRA ZONER, INGET KLIPPS, DOKUMENTET SCROLLAR (0.31.2, uppgift 6) ═════
// CP 2026-09-29 22:33, bolag-ops på hemskärmen (viewport-fit=cover, status-bar black-translucent): "Ser ut att scrollningen blir fel. Den scrollar
// liksom upp." På bilden: en mörk remsa ovanför headern (statusfältets höjd, headern nedanför den) och nederst korten klippta ovanför bottenraden.
// Emulering: `--safe-top: 47px` och `--safe-bottom: 34px` som inline style på :root (samma tokens som `env(safe-area-inset-*)` fyller), 390x844.
// Mått: (a) headerns yta börjar vid y = 0 och täcker statusfältet, före och efter rullning, (b) sista kortets underkant ligger ovanför bottenradens
// överkant och inget element med bakgrund som inte är kortet eller raden ligger över innehållet i bandet ovanför raden, (c) dokumentet rullar, ingen inre behållare.
{
  const { page, context } = await oppna("lang", { width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.style.setProperty("--safe-top", "47px"); document.documentElement.style.setProperty("--safe-bottom", "34px"); });
  await page.waitForTimeout(150);
  /** @param {number} y */
  const matHuvud = async (y) => {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(150);
    return page.evaluate(() => {
      const h = document.querySelector("header");
      const r = h ? h.getBoundingClientRect() : null;
      const bg = h ? getComputedStyle(h).backgroundColor : "";
      // Vad ligger överst i skärmens allra översta pixelrad, mitt på sidan?
      const topEl = document.elementFromPoint(195, 2);
      return { top: r ? r.top : null, bottom: r ? r.bottom : null, bg, hojd: r ? r.height : 0, ovanEl: topEl ? (topEl.closest("header") ? "header" : topEl.tagName.toLowerCase()) : "inget", sy: window.scrollY };
    });
  };
  const h0 = await matHuvud(0);
  const h1 = await matHuvud(300);
  matt.push(`hemskärm 390 px (säker zon 47/34): headern ${h0.top}..${h0.bottom} (${h0.hojd.toFixed(1)} px) i toppläget, ${h1.top}..${h1.bottom} efter rullning ${h1.sy}, översta pixelraden tillhör ${h1.ovanEl}`);
  krav(h0.top !== null && Math.abs(h0.top) <= 0.5 && h1.top !== null && Math.abs(h1.top) <= 0.5, `hemskärm: headerns ovankant är ${h0.top} (toppläge) och ${h1.top} (rullad), väntat 0. En sticky header med top = säker zon lämnar en otäckt remsa på ${h1.top} px ovanför sig där innehållet rullar förbi statusfältet.`);
  krav(h1.ovanEl === "header", `hemskärm: det som ligger överst på skärmen efter rullning är ${h1.ovanEl}, väntat headern (den ska täcka statusfältet).`);
  krav(h0.hojd >= 47 + 56 - 0.5, `hemskärm: headern är ${h0.hojd.toFixed(1)} px hög, väntat minst 103 (säker zon 47 + toppraden 56).`);
  // Rulla till botten.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(200);
  const b = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Snabbnavigering"]') || document.querySelector("nav.fixed");
    const kort = [...document.querySelectorAll("main ul > li")];
    const sista = kort[kort.length - 1];
    const nr = nav ? nav.getBoundingClientRect() : null;
    const sr = sista ? sista.getBoundingClientRect() : null;
    /** @type {string[]} */
    const tacker = [];
    if (nr && sr) {
      // Punkter i bandet från sista kortets överkant ned till bottenradens överkant: det som ligger överst där ska höra till kortet, main eller sidan.
      for (const y of [sr.top + 8, sr.top + sr.height / 2, sr.bottom - 4]) {
        if (y >= nr.top - 1) continue;
        const el = document.elementFromPoint(195, y);
        if (!el) continue;
        const inne = !!el.closest("main");
        const bgEl = (() => { for (let e = /** @type {Element | null} */ (el); e && e !== document.body; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (!/rgba?\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)|transparent/.test(c)) return e; } return null; })();
        if (!inne && bgEl && bgEl !== document.documentElement) tacker.push(`${el.tagName.toLowerCase()}.${String(/** @type {any} */ (bgEl).className).split(" ").slice(0, 3).join(".")} vid y=${Math.round(y)}`);
      }
    }
    const de = document.documentElement;
    /** @type {string[]} */
    const inre = [];
    for (const e of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(e);
      if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 1 && e.clientHeight > 200 && !e.closest('[role="dialog"]')) inre.push(`${e.tagName.toLowerCase()}.${String(e.className).split(" ").slice(0, 3).join(".")}`);
    }
    return { navTop: nr ? nr.top : null, kortBottom: sr ? sr.bottom : null, tacker, sy: window.scrollY, max: de.scrollHeight - window.innerHeight, inre, antalKort: kort.length };
  });
  matt.push(`hemskärm 390 px: rullad till botten (scrollY ${b.sy} av ${b.max}), sista kortets underkant ${b.kortBottom} mot bottenradens överkant ${b.navTop}, täckande ytor ${JSON.stringify(b.tacker)}, inre rullbehållare ${JSON.stringify(b.inre)}`);
  krav(b.antalKort >= 12, `hemskärm: bara ${b.antalKort} kort ritades, väntat 12 (golv: sidan måste rulla).`);
  krav(b.sy > 100, `hemskärm: dokumentet rullade inte (scrollY ${b.sy}). Rullar en inre behållare i stället? ${JSON.stringify(b.inre)}`);
  krav(b.inre.length === 0, `hemskärm: en inre behållare rullar i stället för dokumentet (${b.inre.join(", ")}).`);
  krav(b.kortBottom !== null && b.navTop !== null && b.kortBottom <= b.navTop + 0.5, `hemskärm: sista kortets underkant ${b.kortBottom} ligger under bottenradens överkant ${b.navTop}: kortet klipps.`);
  krav(b.tacker.length === 0, `hemskärm: en yta med bakgrund ligger över innehållet ovanför bottenraden (${b.tacker.join("; ")}).`);
  krav(b.kortBottom !== null && b.navTop !== null && b.navTop - b.kortBottom <= 25, `hemskärm: ${(b.navTop - b.kortBottom).toFixed(1)} px tom yta mellan sista kortet och bottenraden, väntat högst 25 (OpsView pb-6 = 24, säker yta räknas två gånger om mer).`);
  if (bildmapp) await page.screenshot({ path: path.join(bildmapp, "hemskarm-botten-390.png") });
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(150);
  if (bildmapp) await page.screenshot({ path: path.join(bildmapp, "hemskarm-rullad-390.png") });
  await context.close();
}

// 21b: samma emulering med listan i `OpsScrollArea` (bolag-ops Idag): ytan rullar i sig själv och DOKUMENTET ska inte rulla ovanpå (CP: "Den scrollar liksom upp").
{
  const { page, context } = await oppna("langarea", { width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.style.setProperty("--safe-top", "47px"); document.documentElement.style.setProperty("--safe-bottom", "34px"); });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  await page.waitForTimeout(200);
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(150);
  const a = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Snabbnavigering"]') || document.querySelector("nav.fixed");
    const yta = [...document.querySelectorAll("main div")].find((d) => getComputedStyle(d).overflowY === "auto" && d.scrollHeight > d.clientHeight + 1);
    const de = document.documentElement;
    const yr = yta ? yta.getBoundingClientRect() : null;
    const nr = nav ? nav.getBoundingClientRect() : null;
    return { dokHojd: de.scrollHeight, fonster: window.innerHeight, sy: window.scrollY, ytaBottom: yr ? yr.bottom : null, ytaTop: yr ? yr.top : null, navTop: nr ? nr.top : null, ytaRullar: !!yta };
  });
  matt.push(`hemskärm 390 px, lista i OpsScrollArea: dokumentet ${a.dokHojd} px i ett fönster på ${a.fonster}, scrollY ${a.sy}, ytan ${a.ytaTop}..${a.ytaBottom}, bottenradens överkant ${a.navTop}`);
  krav(a.ytaRullar, "hemskärm (OpsScrollArea): ytan rullar inte i sig själv (ingen behållare med overflow-y auto och mer innehåll än höjd).");
  krav(a.dokHojd <= a.fonster + 1 && a.sy === 0, `hemskärm (OpsScrollArea): dokumentet är ${a.dokHojd} px i ett fönster på ${a.fonster} (scrollY ${a.sy}): sidan rullar ${a.dokHojd - a.fonster} px OVANPÅ ytans egen rullning. CP: "Den scrollar liksom upp."`);
  krav(a.ytaBottom !== null && a.navTop !== null && a.ytaBottom <= a.navTop + 0.5 && a.navTop - a.ytaBottom <= 25, `hemskärm (OpsScrollArea): ytans underkant ${a.ytaBottom} mot bottenradens överkant ${a.navTop}, väntat 0 till 25 px ovanför.`);
  if (bildmapp) await page.screenshot({ path: path.join(bildmapp, "hemskarm-lista-390.png") });
  await context.close();
}

// ══ 22. NY GRUPP: EN PANEL MED SS FÄLT I SS ORDNING (0.32.0, #180) ═══════════════════════════════════════════════════
// CP 2026-09-29 23:30: "Skapa grupp och bjuda in till grupp finns inte ännu. Skapa grupp i web skall ha samma funktion som i SessionStudio."
// SS `ManageGroupModal.jsx:479-640` (inline, ritad i `GroupEditRouteView`): Visuell identitet, Namn, Beskrivning, Ort, Medlemmar, Mer inställningar.
// Mått vid 390 och 1280 px: en panel och ingen dialog, fälten i SS ordning och alla synliga, namnet obligatoriskt, panelens fasta Spara, ingen
// horisontell överflödning, identitetsrutorna har 44 px träffyta och märket ritas i den valda färgen, samt att båda ingångarna (plusset,
// gruppanelen på dator) öppnar samma panel. Växlarens ark på telefon är ingen ingång från 0.37.0. Golv: minst 6 färgprickar och 11 ikonrutor.
for (const [namn, vp] of /** @type {const} */ ([["1280 px", { width: 1280, height: 800 }], ["390 px", { width: 390, height: 844 }]])) {
  const mobil = vp.width < 800;
  const { page, context } = await oppna("nygrupp", vp);
  try {
    await page.getByRole("button", { name: "Skapa", exact: true }).last().click();
    await page.getByRole("button", { name: "Ny grupp" }).click({ timeout: 3000 });
    await page.waitForSelector("[data-gruppformular]", { timeout: 3000 });
    const m = await page.evaluate(() => {
      const panel = /** @type {HTMLElement} */ (document.querySelector("[data-skapa-panel]"));
      const falt = (/** @type {string} */ etikett) => {
        const l = [...document.querySelectorAll("[data-gruppformular] label")].find((x) => (x.textContent || "").trim().startsWith(etikett));
        return l ? /** @type {HTMLElement | null} */ (document.getElementById(/** @type {HTMLLabelElement} */ (l).htmlFor)) : null;
      };
      const top = (/** @type {Element | null} */ e) => (e ? e.getBoundingClientRect().top + window.scrollY : NaN);
      const rader = {
        identitet: top(document.querySelector("[data-gruppidentitet] button")),
        namn: top(falt("Gruppnamn")),
        beskrivning: top(falt("Beskrivning")),
        ort: top(falt("Ort")),
        medlemmar: top(document.querySelector("[data-gruppmedlemmar]")),
        mer: top(document.querySelector("[data-mer-installningar] button")),
      };
      const namnEl = falt("Gruppnamn");
      const namnLabel = [...document.querySelectorAll("[data-gruppformular] label")].find((x) => (x.textContent || "").trim().startsWith("Gruppnamn"));
      const sektion = document.querySelector("[data-gruppidentitet] > p");
      const scs = sektion ? getComputedStyle(sektion) : null;
      const lcs = namnLabel ? getComputedStyle(namnLabel) : null;
      const kol = /** @type {HTMLElement} */ (panel.firstElementChild).getBoundingClientRect();
      const kn = /** @type {HTMLElement} */ (document.querySelector("[data-skapa-knappar]")).getBoundingClientRect();
      const spara = [...document.querySelectorAll("[data-skapa-knappar] button")].find((b) => (b.textContent || "").trim() === "Spara");
      const h2 = panel.querySelector("h2");
      return {
        dialoger: document.querySelectorAll('[role="dialog"]').length,
        rubrik: h2 ? (h2.textContent || "").trim() : null,
        rader,
        obligatoriskt: !!namnEl && /** @type {HTMLInputElement} */ (namnEl).required,
        stjarna: !!namnLabel && (namnLabel.textContent || "").includes("*"),
        sektion: scs ? { fs: scs.fontSize, tt: scs.textTransform } : null,
        etikett: lcs ? { fs: lcs.fontSize, fw: lcs.fontWeight } : null,
        falt: [...panel.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea')].map((e) => { const c = getComputedStyle(e); return { fs: c.fontSize, fw: c.fontWeight }; }),
        kolW: kol.width,
        knappar: { top: kn.top, bottom: kn.bottom },
        spara: !!spara,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        vh: innerHeight,
        appvy: (() => { const a = document.querySelector("[data-appvy]"); return a ? a.getBoundingClientRect().height : -1; })(),
        headerTop: (() => { const h = document.querySelector("header"); return h ? h.getBoundingClientRect().top : null; })(),
      };
    });
    const r = m.rader;
    matt.push(`ny grupp ${namn}: rubrik "${m.rubrik}", dialoger ${m.dialoger}, kolumn ${m.kolW.toFixed(0)} px, fältens topp ${JSON.stringify(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(v)])))}, sektionsrubrik ${JSON.stringify(m.sektion)}, etikett ${JSON.stringify(m.etikett)}`);
    krav(m.dialoger === 0, `ny grupp ${namn}: ${m.dialoger} role=dialog. Väntat 0: skapa grupp är en panel, inte en modal.`);
    krav(m.rubrik === "Ny grupp", `ny grupp ${namn}: panelens rubrik är "${m.rubrik}", väntat "Ny grupp".`);
    krav(
      r.identitet < r.namn && r.namn < r.beskrivning && r.beskrivning < r.ort && r.ort < r.medlemmar && r.medlemmar < r.mer,
      `ny grupp ${namn}: fälten ligger inte i SS ordning (Visuell identitet, Namn, Beskrivning, Ort, Medlemmar, Mer inställningar): ${JSON.stringify(r)}.`,
    );
    krav(m.obligatoriskt && m.stjarna, `ny grupp ${namn}: namnfältet är inte markerat som obligatoriskt (required ${m.obligatoriskt}, stjärna ${m.stjarna}).`);
    krav(m.etikett !== null && m.etikett.fs === "14px" && m.etikett.fw === "500", `ny grupp ${namn}: fältets etikett är ${JSON.stringify(m.etikett)}, väntat 14 px och 500 (SS text-sm font-medium, ManageGroupModal.jsx:590).`);
    krav(
      m.falt.length >= 3 && m.falt.every((f) => f.fs === "16px" && f.fw === "400"),
      `ny grupp ${namn}: textfälten ska vara 16 px och vikt 400 (SS text-base i fält, 16 px hindrar iOS zoom), mätt ${JSON.stringify(m.falt)}.`,
    );
    krav(m.sektion !== null && m.sektion.fs === "12px" && m.sektion.tt === "uppercase", `ny grupp ${namn}: raden "Visuell identitet" är ${JSON.stringify(m.sektion)}, väntat 12 px versaler (SS text-xs uppercase, ManageGroupModalGroupImages.jsx:32).`);
    krav(m.spara, `ny grupp ${namn}: skalets fasta Spara saknas.`);
    krav(m.knappar.bottom >= m.vh - 1 && m.knappar.bottom <= m.vh + 0.5, `ny grupp ${namn}: knappraden vilar inte längst ned (${m.knappar.top.toFixed(0)}..${m.knappar.bottom.toFixed(0)} av ${m.vh}).`);
    krav(!m.overflow, `ny grupp ${namn}: horisontell överflödning.`);
    if (!mobil) {
      krav(Math.abs(m.kolW - 672) <= 1, `ny grupp ${namn}: kolumnen är ${m.kolW.toFixed(0)} px, väntat 672 (SS GroupEditRouteView.jsx:40 max-w-2xl).`);
      krav(m.headerTop !== null && m.headerTop <= 0.5 && m.appvy === 0, `ny grupp ${namn}: huvudet ska stå kvar (top ${m.headerTop}) och appens vy vara dold (höjd ${m.appvy}).`);
    }
    if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `ny-grupp-${vp.width}.png`) });

    // Namnet är obligatoriskt: Spara utan namn stannar kvar och säger det.
    await page.getByRole("button", { name: "Spara", exact: true }).click();
    const fel = await page.getByText("Gruppen behöver ett namn.").isVisible();
    const kvar = await page.evaluate(() => document.querySelectorAll("[data-skapa-panel]").length);
    matt.push(`ny grupp ${namn}: Spara utan namn, felet synligt ${fel}, panelen kvar ${kvar}`);
    krav(fel && kvar === 1, `ny grupp ${namn}: Spara utan namn ska visa "Gruppen behöver ett namn." och stanna (fel synligt ${fel}, paneler ${kvar}).`);

    // Visuell identitet: rutorna har träffyta, och märket ritas i den valda färgen.
    await page.getByRole("button", { name: /Färg och ikon/ }).click();
    const id = await page.evaluate(() => {
      const prickar = [...document.querySelectorAll('[data-gruppidentitet] [aria-label^="Färg "]')];
      const ikoner = [...document.querySelectorAll('[data-gruppidentitet] [role="group"][aria-label="Ikon eller initialer"] button')];
      const minsta = (/** @type {Element[]} */ l) => (l.length ? Math.min(...l.map((e) => Math.min(e.getBoundingClientRect().width, e.getBoundingClientRect().height))) : 0);
      return { prickar: prickar.length, ikoner: ikoner.length, prickMin: minsta(prickar), ikonMin: minsta(ikoner) };
    });
    matt.push(`ny grupp ${namn}: identitet öppen, ${id.prickar} färgprickar (minsta träffyta ${id.prickMin.toFixed(0)}), ${id.ikoner} ikonrutor (minsta ${id.ikonMin.toFixed(0)})`);
    krav(id.prickar >= 6 && id.ikoner >= 11, `ny grupp ${namn}: ${id.prickar} färgprickar och ${id.ikoner} ikonrutor, väntat minst 6 och 11 (golv: Aa plus tio ikoner).`);
    krav(id.prickMin >= 43.5 && id.ikonMin >= 43.5, `ny grupp ${namn}: minsta träffyta är ${id.prickMin.toFixed(0)} (prickar) och ${id.ikonMin.toFixed(0)} (ikoner), väntat 44.`);
    await page.getByRole("button", { name: "Färg 3", exact: true }).click();
    const farg = await page.evaluate(() => {
      const sonda = document.createElement("span");
      sonda.className = "bg-identity-3";
      document.body.append(sonda);
      const vantad = getComputedStyle(sonda).backgroundColor;
      sonda.remove();
      const marke = document.querySelector("[data-gruppidentitet] > button [role=img]");
      return { vantad, faktisk: marke ? getComputedStyle(marke).backgroundColor : null };
    });
    matt.push(`ny grupp ${namn}: märket efter Färg 3 är ${farg.faktisk}, identitetston 3 är ${farg.vantad}`);
    krav(farg.faktisk === farg.vantad && farg.vantad !== "rgba(0, 0, 0, 0)", `ny grupp ${namn}: märket har bakgrund ${farg.faktisk} efter Färg 3, väntat identitetston 3 (${farg.vantad}).`);

    // Medlemmar och Mer inställningar.
    await page.getByLabel(/Gruppnamn/).fill("Åkeriet Örebro");
    await page.getByLabel("E-postadress").fill("kollega@exempel.se");
    await page.getByRole("button", { name: "Lägg till" }).click();
    await page.getByRole("button", { name: "Mer inställningar" }).click();
    const mer = await page.evaluate(() => {
      const lista = [...document.querySelectorAll("[data-gruppmedlemmar] li")];
      const region = document.querySelector('[data-mer-installningar] [role="region"]');
      const sprak = [...document.querySelectorAll("[data-mer-installningar] label")].some((l) => (l.textContent || "").trim() === "E-postspråk");
      const r = region ? /** @type {HTMLElement} */ (region).getBoundingClientRect() : null;
      return { rader: lista.length, synlig: !!r && r.height > 0, sprak, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    });
    matt.push(`ny grupp ${namn}: ${mer.rader} inbjuden, Mer inställningar synlig ${mer.synlig}, E-postspråk ${mer.sprak}`);
    krav(mer.rader === 1, `ny grupp ${namn}: ${mer.rader} rader i medlemslistan efter Lägg till, väntat 1.`);
    krav(mer.synlig && mer.sprak, `ny grupp ${namn}: Mer inställningar fälls inte ut med E-postspråk (synlig ${mer.synlig}, fält ${mer.sprak}).`);
    krav(!mer.overflow, `ny grupp ${namn}: horisontell överflödning med allt utfällt.`);
    if (bildmapp) {
      // Bilden ska visa panelen uppifrån (montaget mot SS): rulla sidan och panelens egen kropp till toppen först.
      await page.evaluate(() => { window.scrollTo(0, 0); for (const d of document.querySelectorAll("[data-skapa-panel] div")) if (d.scrollTop) d.scrollTop = 0; });
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(bildmapp, `ny-grupp-${vp.width}-utfalld.png`) });
    }

    if (mobil) {
      // Tangentbord: fönstret krymper till 500 px. Namnfältet och knappraden ska båda synas.
      await page.setViewportSize({ width: vp.width, height: 500 });
      await page.waitForTimeout(150);
      await page.getByLabel(/Gruppnamn/).focus();
      await page.getByLabel(/Gruppnamn/).scrollIntoViewIfNeeded();
      const t = await page.evaluate(() => {
        const b = /** @type {HTMLElement} */ (document.querySelector("[data-skapa-knappar]")).getBoundingClientRect();
        const l = [...document.querySelectorAll("[data-gruppformular] label")].find((x) => (x.textContent || "").trim().startsWith("Gruppnamn"));
        const f = l ? /** @type {HTMLElement} */ (document.getElementById(/** @type {HTMLLabelElement} */ (l).htmlFor)).getBoundingClientRect() : null;
        return { knTop: b.top, knBottom: b.bottom, fTop: f ? f.top : NaN, fBottom: f ? f.bottom : NaN };
      });
      matt.push(`ny grupp ${namn} med tangentbord (500 px): knapprad ${t.knTop.toFixed(0)}..${t.knBottom.toFixed(0)}, namnfältet ${t.fTop.toFixed(0)}..${t.fBottom.toFixed(0)}`);
      krav(t.knBottom <= 500.5 && t.fBottom <= t.knTop + 0.5 && t.fTop >= 0, `ny grupp ${namn} med tangentbord: namnfältet ${t.fTop.toFixed(0)}..${t.fBottom.toFixed(0)} och knappraden ${t.knTop.toFixed(0)}..${t.knBottom.toFixed(0)} ryms inte i 500 px.`);
      await page.setViewportSize(vp);
    }

    // Spara med namn: onSkapad anropas, panelen är borta och appens vy tillbaka.
    await page.getByRole("button", { name: "Spara", exact: true }).click();
    await page.waitForFunction("window.__skapad === 1", null, { timeout: 3000 }).catch(() => {});
    const efter = await page.evaluate(() => ({ skapad: /** @type {any} */ (window).__skapad ?? 0, paneler: document.querySelectorAll("[data-skapa-panel]").length, vy: (() => { const a = document.querySelector("[data-appvy]"); return a ? a.getBoundingClientRect().height : -1; })(), skapaParam: new URL(location.href).searchParams.has("skapa") }));
    matt.push(`ny grupp ${namn}: efter Spara onSkapad ${efter.skapad}, paneler ${efter.paneler}, appens vy ${efter.vy}, ?skapa kvar ${efter.skapaParam}`);
    krav(efter.skapad === 1 && efter.paneler === 0 && efter.vy > 0 && !efter.skapaParam, `ny grupp ${namn}: efter Spara: onSkapad ${efter.skapad} (väntat 1), paneler ${efter.paneler}, appens vy ${efter.vy}, ?skapa kvar ${efter.skapaParam}.`);
  } catch (e) {
    krav(false, `ny grupp ${namn}: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}): panelen "Ny grupp" öppnades inte eller ett fält saknades.`);
    if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `ny-grupp-${vp.width}-avbrott.png`) }).catch(() => {});
  }
  await context.close();
}
// Gruppanelens "Skapa grupp" på dator öppnar SAMMA panel. (Växlarens ark på telefon hade samma knapp till 0.36.0, se nedan.)
{
  const { page, context } = await oppna("nygrupp", { width: 1280, height: 800 });
  try {
    await page.locator('nav[aria-label="Mina grupper"]').getByRole("button", { name: "Skapa grupp" }).click({ timeout: 3000 });
    await page.waitForSelector("[data-gruppformular]", { timeout: 3000 });
    const d = await page.evaluate(() => ({ rubrik: (document.querySelector("[data-skapa-panel] h2") || {}).textContent, dialoger: document.querySelectorAll('[role="dialog"]').length }));
    matt.push(`ny grupp via gruppanelen 1280 px: rubrik "${d.rubrik}", dialoger ${d.dialoger}`);
    krav(d.rubrik === "Ny grupp" && d.dialoger === 0, `ny grupp via gruppanelen: rubrik "${d.rubrik}", ${d.dialoger} dialoger, väntat panelen "Ny grupp" utan dialog.`);
  } catch (e) {
    krav(false, `ny grupp via gruppanelen: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}): "Skapa grupp" öppnade inte panelen.`);
  }
  await context.close();
}
// ⛔ 0.37.0: VÄXLARENS ARK PÅ TELEFON HAR INGEN "Skapa grupp" LÄNGRE. CP 2026-09-30: knappen i arket "Byt grupp" var en
// tredje väg till samma panel, och på telefonen finns redan plusset med "Ny grupp" (mätt i avsnitt 22 vid 390 px). Arket
// ska bara byta grupp. Gruppanelen på dator behåller sin knapp (mätt ovan). Golv: arket har minst två grupprader.
{
  const { page, context } = await oppna("nygrupp", { width: 390, height: 844 });
  try {
    await page.getByRole("button", { name: /^Byt grupp, nu:/ }).click({ timeout: 3000 });
    await page.getByRole("dialog").waitFor({ timeout: 3000 });
    await page.waitForTimeout(200);
    const d = await page.evaluate(() => {
      const ark = /** @type {HTMLElement} */ (document.querySelector('[role="dialog"]'));
      const knappar = [...ark.querySelectorAll("button")].map((x) => (x.getAttribute("aria-label") || x.textContent || "").trim());
      return { knappar, skapa: knappar.filter((k) => /Skapa grupp/i.test(k)).length, rader: ark.querySelectorAll('[role="option"], [aria-pressed], [aria-current]').length };
    });
    matt.push(`växlarens ark 390 px: knapparna ${JSON.stringify(d.knappar)}`);
    krav(d.knappar.length >= 3, `växlarens ark 390 px: ${d.knappar.length} knappar, väntat minst 3 (golv: två grupper och stäng).`);
    krav(d.skapa === 0, `växlarens ark 390 px: "Skapa grupp" står ${d.skapa} gång(er) i arket, väntat 0 (CP 2026-09-30, plusset har "Ny grupp").`);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Skapa", exact: true }).last().click({ timeout: 3000 });
    const ny = await page.getByRole("button", { name: "Ny grupp" }).count();
    krav(ny >= 1, `växlarens ark 390 px: plusset saknar "Ny grupp" (${ny}), så telefonen har ingen väg till en ny grupp.`);
  } catch (e) {
    krav(false, `växlarens ark 390 px: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
  }
  await context.close();
}

// ══ 23. GRUPPKORTET OCH GRUPPENS DETALJSIDA MOT SS (0.32.0, #180 G2) ══════════════════════════════════════════════
// CP 2026-09-29 23:30: "Gruppkortet skall ha lite mer info i sig som i SessionStudio." Kortet (SS `GroupCard.jsx`) mäts på dator, där gruppanelen finns (från 1024 px):
// (i) för alla, penna bara för ägare och admin, knappen 26 px (p-1.5 + 14), namn 12 px/600, antal 10 px, fyra avatarer om 20 px plus "+N", valt kort i gruppens färg
// (kant och en yta vid ca 6 procent), märket 20 px i gruppens färg eller ikon. Detaljsidan (SS `GroupDetailView.jsx`) mäts vid 390 och 1280 px: kolumn 768, märke 56,
// rubrik 20 px/600, beskrivning 14, ort 12, tre snabbval i en rad (p-3, ikon 20, text 12/500), medlemsrubrik 12 px versaler, avatar 32, etikett 10 px versaler.
{
  const { page, context } = await oppna("gruppkort", { width: 1280, height: 800 }, standardtema, 1, "g1");
  try {
    const k = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Mina grupper"]');
      const kort = (/** @type {string} */ n) => /** @type {HTMLElement | null} */ ([...nav.querySelectorAll("li[role=button]")].find((l) => l.getAttribute("aria-label") === n) ?? null);
      const sonda = (/** @type {string} */ klass, /** @type {string} */ prop) => { const e = document.createElement("span"); e.className = klass; document.body.append(e); const v = getComputedStyle(e)[prop]; e.remove(); return v; };
      const knapp = (/** @type {HTMLElement | null} */ li, /** @type {string} */ n) => li ? /** @type {HTMLElement | null} */ (li.querySelector(`button[aria-label="${n}"]`)) : null;
      const a = kort("Alfa AB"), b = kort("Beta AB"), c = kort("Gamma AB");
      const cs = (/** @type {Element | null} */ e) => (e ? getComputedStyle(e) : null);
      const info = knapp(a, "Visa grupp");
      const ir = info ? info.getBoundingClientRect() : null;
      const namn = a ? a.querySelector("p") : null;
      const antal = a ? [...a.querySelectorAll("span")].find((x) => /^\s*6\s/.test(x.textContent || "") || (x.textContent || "").trim().startsWith("6")) : null;
      const avatarer = a ? [...a.querySelectorAll("span[role=img]")].slice(1) : [];
      const marke = a ? /** @type {HTMLElement} */ (a.querySelector("span[role=img]")) : null;
      const mg = c ? /** @type {HTMLElement} */ (c.querySelector("span[role=img]")) : null;
      const alfa = a ? getComputedStyle(a) : null;
      return {
        harKort: !!(a && b && c),
        infoAlla: !!(knapp(a, "Visa grupp") && knapp(b, "Visa grupp") && knapp(c, "Visa grupp")),
        pennaAlfa: !!knapp(a, "Redigera grupp"), pennaGamma: !!knapp(c, "Redigera grupp"), pennaBeta: !!knapp(b, "Redigera grupp"),
        knapp: ir ? { w: ir.width, h: ir.height } : null,
        ikon: info && info.querySelector("svg") ? info.querySelector("svg").getBoundingClientRect().width : null,
        namn: namn ? { fs: cs(namn).fontSize, fw: cs(namn).fontWeight } : null,
        antalFs: antal ? cs(antal).fontSize : null,
        avatarAntal: avatarer.length, avatarPx: avatarer[0] ? avatarer[0].getBoundingClientRect().width : null,
        plusN: a ? [...a.querySelectorAll("span")].some((x) => (x.textContent || "").trim().startsWith("+2")) : false,
        markePx: marke ? marke.getBoundingClientRect().width : null,
        markeBg: marke ? getComputedStyle(marke).backgroundColor : null, ton3: sonda("bg-identity-3", "backgroundColor"),
        gammaIkon: !!(mg && mg.querySelector("svg")), gammaBg: mg ? getComputedStyle(mg).backgroundColor : null, ton5: sonda("bg-identity-5", "backgroundColor"),
        kant: alfa ? alfa.borderTopColor : null, kantVantad: sonda("border-identity-3", "borderTopColor"),
        yta: alfa ? alfa.backgroundColor : null, betaKant: b ? getComputedStyle(b).borderTopColor : null,
      };
    });
    matt.push(`gruppkort 1280 px: ${JSON.stringify(k)}`);
    krav(k.harKort, "gruppkort: tre kort saknas.");
    krav(k.infoAlla, "gruppkort: (i) saknas på något kort. SS visar Info för alla (GroupCard.jsx:88-99).");
    krav(k.pennaAlfa && k.pennaGamma && !k.pennaBeta, `gruppkort: pennan ska finnas för ägare och admin och inte för medlem (ägare ${k.pennaAlfa}, admin ${k.pennaGamma}, medlem ${k.pennaBeta}). SS canEditGroup.`);
    krav(k.knapp !== null && Math.abs(k.knapp.w - 26) <= 0.6 && Math.abs(k.knapp.h - 26) <= 0.6 && k.ikon === 14, `gruppkort: (i) är ${JSON.stringify(k.knapp)} med ikon ${k.ikon} px, väntat 26x26 och 14 (SS p-1.5 w-3.5).`);
    krav(k.namn !== null && k.namn.fs === "12px" && k.namn.fw === "600", `gruppkort: namnet är ${JSON.stringify(k.namn)}, väntat 12 px och 600 (SS text-xs font-semibold).`);
    krav(k.antalFs === "10px", `gruppkort: medlemsantalet är ${k.antalFs}, väntat 10px (SS text-[10px]).`);
    krav(k.avatarAntal === 4 && Math.abs((k.avatarPx ?? 0) - 20) < 0.6 && k.plusN, `gruppkort: ${k.avatarAntal} avatarer om ${k.avatarPx} px och "+2" ${k.plusN}, väntat 4, 20 och "+2" (SS slice(0,4), Avatar size=5).`);
    krav(k.markePx !== null && Math.abs(k.markePx - 20) < 0.6 && k.markeBg === k.ton3, `gruppkort: märket är ${k.markePx} px med bakgrund ${k.markeBg}, väntat 20 och identitetston 3 (${k.ton3}).`);
    krav(k.gammaIkon && k.gammaBg === k.ton5, `gruppkort: Gamma ska ha ikon i identitetston 5 (ikon ${k.gammaIkon}, bakgrund ${k.gammaBg}, väntat ${k.ton5}).`);
    krav(k.kant === k.kantVantad && k.kant !== k.betaKant, `gruppkort: det valda kortets kant är ${k.kant}, väntat gruppens färg ${k.kantVantad} (och inte ovalda ${k.betaKant}). SS GroupCard.jsx:60-65.`);
    const alfa = /\/\s*([0-9.]+)\)|,\s*([0-9.]+)\)\s*$/.exec(k.yta ?? "");
    krav(!!alfa && Number(alfa[1] ?? alfa[2]) >= 0.05 && Number(alfa[1] ?? alfa[2]) <= 0.075, `gruppkort: det valda kortets yta är ${k.yta}, väntat gruppens färg vid ca 6 procent (SS \`${"${group.color}"}10\`).`);
    if (bildmapp) await page.locator('nav[aria-label="Mina grupper"]').screenshot({ path: path.join(bildmapp, "gruppkort-1280.png") });
  } catch (e) {
    krav(false, `gruppkort: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
  }
  await context.close();
}
for (const [namn, vp] of /** @type {const} */ ([["1280 px", { width: 1280, height: 800 }], ["390 px", { width: 390, height: 844 }]])) {
  const { page, context } = await oppna("gruppsida", vp);
  try {
    await page.waitForSelector("[data-gruppsida]", { timeout: 3000 });
    const d = await page.evaluate(() => {
      const rot = /** @type {HTMLElement} */ (document.querySelector("[data-gruppsida]"));
      const cs = (/** @type {Element | null} */ e) => (e ? getComputedStyle(e) : null);
      const h1 = rot.querySelector("h1");
      const beskr = h1 ? h1.nextElementSibling : null;
      const ort = beskr ? beskr.nextElementSibling : null;
      const marke = rot.querySelector("[data-gruppsida-rubrik] span[role=img]");
      const sn = [...rot.querySelectorAll("[data-gruppsida-snabbval] > button")];
      const snR = sn.map((b) => b.getBoundingClientRect());
      const snText = sn[0] ? sn[0].querySelector("span:last-child") : null;
      const snIkon = sn[0] ? sn[0].querySelector("svg") : null;
      const rub = rot.querySelector("[data-gruppsida-medlemmar] h2");
      const rader = [...rot.querySelectorAll("[data-gruppsida-medlemmar] li")];
      const av = rader[0] ? rader[0].querySelector("span[role=img]") : null;
      const etikett = rader[0] ? [...rader[0].querySelectorAll("span")].find((x) => (x.textContent || "").trim() === "Ägare") : null;
      const sonda = (/** @type {string} */ k) => { const e = document.createElement("span"); e.className = k; document.body.append(e); const v = getComputedStyle(e).backgroundColor; e.remove(); return v; };
      const redigera = [...rot.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Redigera grupp");
      return {
        kolW: rot.getBoundingClientRect().width,
        marke: marke ? marke.getBoundingClientRect().width : null, markeBg: marke ? cs(marke).backgroundColor : null, ton3: sonda("bg-identity-3"),
        h1: h1 ? { fs: cs(h1).fontSize, fw: cs(h1).fontWeight } : null,
        beskr: beskr ? cs(beskr).fontSize : null, ort: ort ? cs(ort).fontSize : null,
        snAntal: sn.length, snEnRad: snR.length === 3 && snR.every((r) => Math.abs(r.top - snR[0].top) < 1),
        snPad: sn[0] ? cs(sn[0]).paddingTop : null, snText: snText ? { fs: cs(snText).fontSize, fw: cs(snText).fontWeight } : null, snIkon: snIkon ? snIkon.getBoundingClientRect().width : null,
        rub: rub ? { fs: cs(rub).fontSize, tt: cs(rub).textTransform } : null,
        rader: rader.length, av: av ? av.getBoundingClientRect().width : null,
        etikett: etikett ? { fs: cs(etikett).fontSize, tt: cs(etikett).textTransform } : null,
        redigera: !!redigera, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        vw: (document.querySelector("header") || document.documentElement).getBoundingClientRect().width,
      };
    });
    matt.push(`gruppsida ${namn}: ${JSON.stringify(d)}`);
    krav(Math.abs(d.kolW - Math.min(768, d.vw)) <= 1, `gruppsida ${namn}: kolumnen är ${d.kolW} px, väntat ${Math.min(768, d.vw)} (SS GroupDetailView.jsx:79 max-w-3xl).`);
    krav(d.marke !== null && Math.abs(d.marke - 56) < 0.6 && d.markeBg === d.ton3, `gruppsida ${namn}: märket är ${d.marke} px med bakgrund ${d.markeBg}, väntat 56 och identitetston 3 (${d.ton3}).`);
    krav(d.h1 !== null && d.h1.fs === "20px" && d.h1.fw === "600", `gruppsida ${namn}: rubriken är ${JSON.stringify(d.h1)}, väntat 20 px och 600 (SS text-xl font-semibold).`);
    krav(d.beskr === "14px" && d.ort === "12px", `gruppsida ${namn}: beskrivning ${d.beskr} och ort ${d.ort}, väntat 14px och 12px (SS text-sm, text-xs).`);
    krav(d.snAntal === 3 && d.snEnRad, `gruppsida ${namn}: ${d.snAntal} snabbval, i en rad ${d.snEnRad}, väntat 3 i en rad (SS grid-cols-3).`);
    krav(d.snPad === "12px" && d.snIkon === 20 && d.snText !== null && d.snText.fs === "12px" && d.snText.fw === "500", `gruppsida ${namn}: snabbvalet har luft ${d.snPad}, ikon ${d.snIkon} och text ${JSON.stringify(d.snText)}, väntat 12px, 20, 12px/500 (SS p-3, w-5, text-xs font-medium).`);
    krav(d.rub !== null && d.rub.fs === "12px" && d.rub.tt === "uppercase", `gruppsida ${namn}: medlemsrubriken är ${JSON.stringify(d.rub)}, väntat 12 px versaler.`);
    krav(d.rader === 3 && d.av !== null && Math.abs(d.av - 32) < 0.6, `gruppsida ${namn}: ${d.rader} medlemsrader med avatar ${d.av} px, väntat 3 och 32 (SS Avatar size={8}).`);
    krav(d.etikett !== null && d.etikett.fs === "10px" && d.etikett.tt === "uppercase", `gruppsida ${namn}: Ägare-etiketten är ${JSON.stringify(d.etikett)}, väntat 10 px versaler (SS text-[10px] uppercase).`);
    krav(d.redigera, `gruppsida ${namn}: Redigera saknas för ägaren.`);
    krav(!d.overflow, `gruppsida ${namn}: horisontell överflödning.`);
    if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `gruppsida-${vp.width}.png`) });
  } catch (e) {
    krav(false, `gruppsida ${namn}: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}): OpsGruppSida ritades inte.`);
  }
  await context.close();
}

// ══ 24. IDAG OCH KALENDERN NÅR BOTTENRADEN, OCKSÅ NÄR FÖNSTRET ÄNDRAS EFTER MOUNT (0.32.1) ══════════════════════════════
// CP 2026-09-30, två skärmbilder från telefonen: "Kalender och idag går inte ända ner utan huggs av i botten." Innehållet slutade
// långt ovanför bottenraden: ett kort i Idag klipptes rakt av och veckoraden i Kalender klipptes horisontellt. Rotorsaken var
// `useFullHeight` (src/lib/fullHeight.js): höjden räknades ur `100svh`, men raden är `fixed bottom-0` och följer den verkliga
// kanten, och toppen mättes bara vid mount och resize.
//
// ⛔ VARFÖR 21 OCH 21b VAR GRÖNA GENOM HELA FELET (tomt underlag av annat slag): i en skrivbords-Chromium är `100svh` ALLTID
// lika med fönstrets höjd, eftersom det inte finns något verktygsfält som fälls in. Säkra zoner sattes som tokens och inte som
// en skillnad mellan `svh` och den synliga höjden, fönstret ändrades aldrig efter mount, och ingenting ovanför ytan försvann.
// Alla tre sakerna som skiljer en iPhone från skrivbordet saknades, så uttrycket mättes bara i det enda läge där det råkar stämma.
//
// Här mäts `navTop - ytaBottom` vid 390x844, med `--safe-top: 47px` och `--safe-bottom: 34px` satta FÖRE mount, i tre lägen:
//   (a) Safaris verktygsfält fälls in EFTER mount: fönstret växer från 844 till 928. Chromium har inget verktygsfält, och
//       dess `100svh` följer med när fönstret växer (mätt nedan), så `svh` modelleras som det Safari gör: fast vid höjden
//       vid mount. `100svh` i höjduttrycken skrivs om till `844px` i den genererade CSS:en, och skillnaden mot den synliga
//       höjden mäts efteråt.
//   (b) Hemskärmsläget, där `svh` skiljer sig från den synliga höjden med de säkra zonerna: `100svh` blir `calc(100dvh - 81px)`.
//   (c) En rad på 170 px står ovanför ytan vid mount och tas bort efteråt, utan resize.
// Krav (0.33.1): gapet är 0 +- 1 px i alla lägen, och rullad till botten har sista elementet minst 16 px luft över radens överkant.
// ⛔ 0.32.1 KRÄVDE 23 +- 2 ("24 px luft som i dag"). Det var arkitektens miss: 24 px var en remsa canvas UTANFÖR ytan, och den remsan är det
// CP ser på telefonen (2026-09-30 11:50). Luften hör hemma inuti rullytan. Golv: minst 2 vyer och 3 lägen mätta.
{
  const safeCss = ":root{--safe-top:47px!important;--safe-bottom:34px!important}";
  /**
   * Skriver om `100svh` i HÖJDUTTRYCKEN (efter `calc(`) och aldrig i väljarna, där parentesen är escapad (`calc\(100svh`).
   * @param {string} c @param {string} till @returns {{ css: string, antal: number }}
   */
  const svhTill = (c, till) => {
    let antal = 0;
    const ny = c.replace(/(?<!\\)\(100svh/g, () => { antal += 1; return `(${till}`; });
    return { css: ny, antal };
  };
  /** @type {Set<string>} */
  const vyerMatta = new Set();
  /** @type {Set<string>} */
  const lagenMatta = new Set();
  for (const vy of /** @type {const} */ (["idag", "kalender"])) {
    for (const lage of /** @type {const} */ (["a", "b", "c"])) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      page.setDefaultTimeout(4000);
      const fel = /** @type {string[]} */ ([]);
      page.on("pageerror", (e) => fel.push(e.message));
      await page.emulateMedia({ colorScheme: standardtema === "dark" ? "dark" : "light" });
      const om = lage === "a" ? svhTill(css, "844px") : lage === "b" ? svhTill(css, "calc(100dvh - 81px)") : { css, antal: 0 };
      const html = sida(`fullyta-${vy}`).replace(css, () => om.css);
      await page.addInitScript(({ regel, banner }) => {
        const sh = new CSSStyleSheet();
        sh.replaceSync(regel);
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, sh];
        /** @type {any} */ (window).__banner = banner;
      }, { regel: safeCss, banner: lage === "c" });
      await page.route("http://skalyta.test/**", (r) => r.fulfill({ contentType: "text/html; charset=utf-8", body: html }));
      await page.goto("http://skalyta.test/");
      await page.waitForFunction("window.__redo === true", null, { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(400);
      const mat = () => page.evaluate(() => {
        const nav = document.querySelector('nav[aria-label="Snabbnavigering"]');
        const yta = /** @type {HTMLElement | null} */ (document.querySelector('main [style*="--fullhojd"]'));
        const probe = (h) => { const d = document.createElement("div"); d.style.cssText = `position:fixed;visibility:hidden;width:1px;height:${h}`; document.body.append(d); const v = d.getBoundingClientRect().height; d.remove(); return v; };
        const cs = getComputedStyle(document.documentElement);
        return {
          navTop: nav ? nav.getBoundingClientRect().top : null,
          ytaBottom: yta ? yta.getBoundingClientRect().bottom : null,
          ytaTop: yta ? yta.getBoundingClientRect().top : null,
          fonster: window.innerHeight, svhRiktig: probe("100svh"), safeTop: cs.getPropertyValue("--safe-top").trim(), safeBottom: cs.getPropertyValue("--safe-bottom").trim(),
          dok: document.documentElement.scrollHeight, banner: !!document.querySelector("[data-banner]"),
        };
      });
      const fore = await mat();
      /** @type {string} */
      let skillnad = "";
      if (lage === "a") {
        await page.setViewportSize({ width: 390, height: 928 });
        await page.waitForTimeout(400);
        const f = await page.evaluate(() => window.innerHeight);
        // Skillnaden mellan den modellerade `svh` (844, fast vid mount) och den synliga höjden efter att fältet fällts in.
        skillnad = `synlig ${f} mot modellerad svh 844 (${f - 844} px), Chromiums egen 100svh följde med till ${await page.evaluate(() => { const d = document.createElement("div"); d.style.cssText = "position:fixed;height:100svh"; document.body.append(d); const v = d.getBoundingClientRect().height; d.remove(); return v; })}`;
        krav(f - 844 >= 50, `fullyta ${vy} (a): fönstret växte bara till ${f}, ingen skillnad mot den modellerade svh 844 uppstod. Läget mäter då ingenting.`);
      } else if (lage === "b") {
        skillnad = `synlig ${fore.fonster} mot modellerad svh ${fore.fonster - 81}`;
      } else {
        krav(fore.banner, `fullyta ${vy} (c): raden på 170 px ovanför ytan ritades inte vid mount.`);
        await page.evaluate(() => /** @type {any} */ (window).__tabortBanner());
        await page.waitForTimeout(400);
      }
      const e = await mat();
      if (fel.length) krav(false, `fullyta ${vy} (${lage}): sidan kastade: ${fel[0]}`);
      krav(e.safeTop === "47px" && e.safeBottom === "34px", `fullyta ${vy} (${lage}): säkra zoner ${e.safeTop}/${e.safeBottom}, väntat 47px/34px före mount.`);
      if (e.navTop === null || e.ytaBottom === null) {
        krav(false, `fullyta ${vy} (${lage}): ${e.navTop === null ? "bottenraden" : "ytan"} hittades inte, inget att mäta.`);
      } else {
        vyerMatta.add(vy);
        lagenMatta.add(lage);
        const gap = e.navTop - e.ytaBottom;
        matt.push(`fullyta ${vy} (${lage}): ytan ${e.ytaTop}..${e.ytaBottom}, bottenraden ${e.navTop}, gap ${gap.toFixed(1)} px, fönster ${e.fonster}, dokument ${e.dok}, svh omskrivet ${om.antal} gånger${skillnad ? `, ${skillnad}` : ""}${lage === "c" ? `, raden ovanför borta: ${!e.banner}` : ""}`);
        krav(Math.abs(gap) <= 1, `fullyta ${vy} (${lage}): ${gap.toFixed(1)} px mellan ytans underkant och bottenradens överkant, väntat 0 +- 1. ${gap > 1 ? "Ytan slutar för tidigt och lämnar en remsa canvas över raden: CP 2026-09-30 11:50 (0.33.1) efter 0.32.1, \"glappet är mindre men kvar\"." : "Ytan går in under bottenraden."}`);
        // 0.33.1: luften hör hemma INUTI rullytan. Rullad till botten ska innehållets sista element ha minst 16 px över radens kant.
        const luft = await page.evaluate(() => {
          const yta = /** @type {HTMLElement | null} */ (document.querySelector('main [style*="--fullhojd"]'));
          const nav = document.querySelector('nav[aria-label="Snabbnavigering"]');
          if (!yta || !nav) return null;
          yta.scrollTop = yta.scrollHeight;
          let botten = -Infinity;
          let antal = 0;
          for (const el of yta.querySelectorAll("*")) {
            const r = el.getBoundingClientRect();
            if (r.height > 0 && r.width > 0) {
              // Innehållets underkant, inte lådans: en behållare med `pb-6` når annars ytans kant och ser ut som att sista elementet gör det.
              const cs = getComputedStyle(el);
              antal += 1;
              botten = Math.max(botten, r.bottom - parseFloat(cs.paddingBottom || "0") - parseFloat(cs.borderBottomWidth || "0"));
            }
          }
          return { luft: nav.getBoundingClientRect().top - botten, antal, rullat: yta.scrollTop > 0 };
        });
        krav(luft !== null && luft.antal >= 5, `fullyta ${vy} (${lage}): bara ${luft ? luft.antal : 0} element i ytan, väntat minst 5 (golv: sista elementet måste ha mätts).`);
        if (luft) {
          matt.push(`fullyta ${vy} (${lage}): rullad till botten, sista elementet ${luft.luft.toFixed(1)} px över bottenradens överkant (${luft.antal} element, rullat ${luft.rullat})`);
          krav(luft.rullat, `fullyta ${vy} (${lage}): ytan gick inte att rulla, luften under sista elementet kan inte mätas.`);
          krav(luft.luft >= 16, `fullyta ${vy} (${lage}): sista elementet ligger ${luft.luft.toFixed(1)} px över bottenraden när ytan är rullad till botten, väntat minst 16. Luften ska ligga inuti rullytan (pb-6).`);
        }
        if (lage === "c") krav(!e.banner, `fullyta ${vy} (c): raden ovanför ytan togs inte bort.`);
      }
      if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `fullyta-${vy}-${lage}-390.png`) });
      await context.close();
    }
  }
  matt.push(`fullyta: ${vyerMatta.size} vyer och ${lagenMatta.size} lägen mätta`);
  krav(vyerMatta.size >= 2 && lagenMatta.size >= 3, `fullyta: bara ${vyerMatta.size} vyer och ${lagenMatta.size} lägen mätta, väntat minst 2 och 3 (golv: ett gap som inte mättes är inte grönt).`);
}

// ══ 25. HÄNDELSEKORTET OCH INKORGSRADEN MOT SS VID 390 PX (0.32.1) ══════════════════════════════════════════════════════
// CP 2026-09-30 08:04: "Kolla storleken och fint på texten i händelserna. Matchar inte det vi har i SessionStudio. Dubbelkolla
// även inkorgen." Titeln var redan 18/700 som SS (avsnitt 20 mäter det). Felet låg i kompositionen: chevronkolumnen (44 px)
// tog bredd från titeln (251 px mot SS 301, en rad extra), tidsgruppen (`ml-auto`) blev högerställd på en egen rad, en
// summary utan egen klass ärvde 16 px, och typbadgen hade pillrets 12/600 där SS har 9/500. CP valde samma dag 24 px radie som
// SS (`--radius-card`, SS `index.css:228`), där `bubbla` hade blivit 28.
// Krav: titeln minst 95 procent av kortets innerbredd, datumradens vänsterkant lika med titelns (+-1), radien 24 +- 0,5,
// rollmärket samma storlek, vikt, luft och höjd som "Försenat", summary utan klass 14 px, `OpsPill size="liten"` 10 px.
// ⛔ 0.33.1 (CP 2026-09-30, #187): "Textstorlek och typsnitt på händelserna ska matcha det inkorgen har nu." CP:s önskan gick före SS-förebilden
// (TodayView 18/700) som 0.32.1 följde. Nu: titel 14/500, datumrad 12, Försenat och rollmärke 10/500 (inkorgens skala). Raderna ovan
// står kvar som historik. Golv: minst 2 kort mätta.
{
  const { page, context } = await oppna("handelsekort", { width: 390, height: 844 });
  const m = await page.evaluate(() => {
    const kort = [...document.querySelectorAll("[data-handelser] ul > li > div")];
    const rader = kort.map((k) => {
      const cs = getComputedStyle(k);
      const inner = k.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const titel = [...k.querySelectorAll("span")].find((e) => /^(Kundfaktura 119223|Attest större)/.test(e.textContent || "") && e.children.length === 0);
      const nar = [...k.querySelectorAll("span")].find((e) => /^(För 20 dagar sedan|Om 3 dagar)$/.test((e.textContent || "").trim()));
      const tr = titel ? titel.getBoundingClientRect() : null;
      const nr = nar ? nar.getBoundingClientRect() : null;
      return { titelFs: titel ? getComputedStyle(titel).fontSize : null, titelFw: titel ? getComputedStyle(titel).fontWeight : null, narFs: nar ? getComputedStyle(nar).fontSize : null, inner, titelW: tr ? tr.width : null, titelX: tr ? tr.left : null, narX: nr ? nr.left : null, narOvanTitel: tr && nr ? nr.bottom <= tr.top + 0.5 : null, radie: parseFloat(cs.borderTopRightRadius) };
    });
    const forsenat = [...document.querySelectorAll("[data-handelser] span")].find((e) => (e.textContent || "").trim() === "Försenat" && e.children.length === 0);
    const du = [...document.querySelectorAll("[data-handelser] span")].find((e) => (e.textContent || "").trim() === "Du" && e.children.length === 0);
    /** @param {Element | undefined} e */
    const matt = (e) => {
      if (!e) return null;
      const cs = getComputedStyle(e);
      return { fs: cs.fontSize, fw: cs.fontWeight, pad: `${cs.paddingTop} ${cs.paddingRight}`, h: Math.round(e.getBoundingClientRect().height * 10) / 10, saknas: e.hasAttribute("data-saknas") };
    };
    const summary = document.querySelector("[data-summary-utan-klass]");
    const liten = document.querySelector("[data-pill-liten] > span");
    return { rader, forsenat: matt(forsenat), du: matt(du), summary: summary ? getComputedStyle(summary).fontSize : null, liten: liten ? { fs: getComputedStyle(liten).fontSize, fw: getComputedStyle(liten).fontWeight } : null };
  });
  const matda = m.rader.filter((r) => r.titelW !== null && r.titelX !== null && r.narX !== null);
  krav(matda.length >= 2, `händelsekort: bara ${matda.length} kort med titel och datumrad mätta, väntat minst 2 (golv).`);
  for (const [i, r] of m.rader.entries()) {
    matt.push(`händelsekort ${i + 1} (390 px): titel ${r.titelW?.toFixed(1)} av innerbredd ${r.inner.toFixed(1)} px, datumradens vänsterkant ${r.narX?.toFixed(1)} mot titelns ${r.titelX?.toFixed(1)}, datumraden ovanför titeln ${r.narOvanTitel}, radie ${r.radie} px`);
    krav(r.titelW !== null && r.titelW >= 0.95 * r.inner, `händelsekort ${i + 1}: titeln är ${r.titelW?.toFixed(1)} px av kortets innerbredd ${r.inner.toFixed(1)} (${r.titelW !== null ? Math.round((100 * r.titelW) / r.inner) : "?"} procent), väntat minst 95. En kolumn bredvid titeln tar bredden (SS 301 px).`);
    krav(r.narX !== null && r.titelX !== null && Math.abs(r.narX - r.titelX) <= 1, `händelsekort ${i + 1}: datumradens vänsterkant ${r.narX?.toFixed(1)} mot titelns ${r.titelX?.toFixed(1)}, väntat samma (+-1). SS: datumraden vänsterställd direkt ovanför titeln (TodayView.jsx:527).`);
    krav(r.narOvanTitel === true, `händelsekort ${i + 1}: datumraden ligger inte ovanför titeln.`);
    // 0.33.1: inkorgens skala (bolag-ops `check-inkorgstypografi`, SS `ChatInboxPanel.jsx:735-745`): titel 14/500, datum 12.
    krav(r.titelFs === "14px" && r.titelFw === "500", `händelsekort ${i + 1}: titeln är ${r.titelFs}/${r.titelFw}, väntat 14px/500 som inkorgens rader (text-etikett font-medium). CP 2026-09-30, #187: "inte ett eget större/tyngre utseende".`);
    krav(r.narFs === "12px", `händelsekort ${i + 1}: datumraden är ${r.narFs}, väntat 12px (text-meta, som inkorgens datum).`);
    krav(Math.abs(r.radie - 24) <= 0.5, `händelsekort ${i + 1}: radien är ${r.radie} px, väntat 24 (CP 2026-09-30 valde SS --radius-card).`);
  }
  matt.push(`rollmärket ${JSON.stringify(m.du)} mot Försenat ${JSON.stringify(m.forsenat)}, summary utan klass ${m.summary}, OpsPill liten ${JSON.stringify(m.liten)}`);
  krav(!!m.forsenat && m.forsenat.fs === "10px" && m.forsenat.fw === "500", `Försenat: ${JSON.stringify(m.forsenat)}, väntat 10px/500 (0.33.1, samma som inkorgens typpill).`);
  krav(!!m.du && m.du.fs === "10px" && m.du.fw === "500", `rollmärket: ${JSON.stringify(m.du)}, väntat 10px/500 (0.33.1, samma som inkorgens typpill).`);
  krav(!!m.du && !m.du.saknas && !!m.forsenat && m.du.fs === m.forsenat.fs && m.du.fw === m.forsenat.fw && m.du.pad === m.forsenat.pad && Math.abs(m.du.h - m.forsenat.h) <= 0.5, `rollmärket: ${JSON.stringify(m.du)} mot Försenat ${JSON.stringify(m.forsenat)}, väntat samma storlek, vikt, luft och höjd (OpsRollmarke).`);
  krav(m.summary === "14px", `inkorgsraden: en summary utan egen klass är ${m.summary}, väntat 14px (text-etikett, SS text-sm).`);
  krav(!!m.liten && m.liten.fs === "10px" && m.liten.fw === "500", `OpsPill size="liten": ${JSON.stringify(m.liten)}, väntat 10px och 500 (SS typbadge 9/500, närmaste roll).`);
  if (bildmapp) await page.locator("[data-handelser]").screenshot({ path: path.join(bildmapp, "handelsekort-390.png") });
  if (bildmapp) await page.locator("[data-inkorgsrad]").screenshot({ path: path.join(bildmapp, "inkorgsrad-390.png") });
  await context.close();
}

// ══ 26. LUFT MELLAN SKAPA-PANELENS HUVUD OCH FÖRSTA RADEN (0.32.1) ══════════════════════════════════════════════════════
// CP 2026-09-30 08:12, med en skärmbild av "Nytt ärende" vid 390 px: "Vidare är det skönt om det är lite luft mellan första raden
// och headern." Första raden låg direkt under huvudets linje. SS har 16 px (`py-4`) i båda inline-formulären (ManageGroupModal.jsx:479,
// eventModal/sizeClasses.js:7). Krav vid 390: 16 +- 1 px från huvudets underkant (linjen) till innehållets första rad. 1280 mäts och skrivs ut.
for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  const { page, context } = await oppna("skapa", vp);
  try {
    await oppnaSkapaPanel(page, vp.width < 768);
    await page.waitForSelector("[data-skapa-panel]");
    await page.waitForTimeout(200);
    const d = await page.evaluate(() => {
      const kol = document.querySelector("[data-skapa-panel] > div");
      const huvud = kol ? kol.children[0] : null;
      const inne = kol ? kol.children[1] : null;
      const forsta = inne ? inne.firstElementChild : null;
      if (!huvud || !forsta) return null;
      return { huvudBotten: huvud.getBoundingClientRect().bottom, forstaTopp: forsta.getBoundingClientRect().top, linje: getComputedStyle(huvud).borderBottomWidth, text: (forsta.textContent || "").trim().slice(0, 30) };
    });
    if (!d) {
      krav(false, `skapa-panelen ${vp.width}: huvudet eller första raden hittades inte.`);
    } else {
      const luft = d.forstaTopp - d.huvudBotten;
      matt.push(`skapa-panelen ${vp.width} px: ${luft.toFixed(1)} px från huvudets underkant (linje ${d.linje}) till första raden ("${d.text}")`);
      if (vp.width < 768) krav(Math.abs(luft - 16) <= 1, `skapa-panelen ${vp.width}: ${luft.toFixed(1)} px mellan huvudets linje och första raden, väntat 16 (SS py-4). CP 2026-09-30 08:12: "lite luft mellan första raden och headern".`);
    }
  } catch (e) {
    krav(false, `skapa-panelen ${vp.width}: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
  }
  await context.close();
}

// ══ 27. PROFILEN MOT SS ProfileView VID 390 OCH 1280 PX (0.32.1) ══════════════════════════════════════════════════════
// CP 2026-09-30, med en skärmbild av Profil på dator: "Typsnitten på profil är också fel. Storlek / typsnitt". Mätt mot SS `ProfileView.jsx`:
// kolumnen `max-w-2xl` (672 px, :106), varje sektion ett kort med rubriken INUTI (`h3 text-xs font-bold text-[var(--color-accent)] uppercase
// tracking-wider mb-3`, :122 och :242), fältetiketterna `text-[10px] text-[var(--color-text-muted)]` (:245). Förut var OpsProfil 1024 px bred,
// rubrikerna 12/600 utanför korten, Personuppgifter utan kort och etiketterna 14/500.
// Krav: rubrikerna 12 px, 700, versaler, accentfärg och inuti ett kort; etiketterna 10 px och 400; kolumnen högst 672 px vid 1280 och
// ingen horisontell överflödning, inget kort utanför sidans marginal. Golv: minst 2 rubriker och 3 etiketter.
for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  const { page, context } = await oppna("profil", vp);
  const d = await page.evaluate(() => {
    const accent = (() => { const e = document.createElement("span"); e.className = "text-accent"; document.body.append(e); const c = getComputedStyle(e).color; e.remove(); return c; })();
    /** @param {Element} el */
    const kortRunt = (el) => {
      for (let e = el.parentElement, i = 0; e && i < 4; e = e.parentElement, i += 1) {
        const cs = getComputedStyle(e);
        if (parseFloat(cs.borderTopLeftRadius) >= 8 && !/rgba?\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)|transparent/.test(cs.backgroundColor)) return e;
      }
      return null;
    };
    const rubriker = [...document.querySelectorAll("main p, main h2, main h3")].filter((e) => /^(profilbild|personuppgifter)$/i.test((e.textContent || "").trim()));
    const r = rubriker.map((e) => { const cs = getComputedStyle(e); return { text: (e.textContent || "").trim(), fs: cs.fontSize, fw: cs.fontWeight, tt: cs.textTransform, farg: cs.color === accent, iKort: !!kortRunt(e) }; });
    const etiketter = [...document.querySelectorAll("main label")].filter((e) => /^(Namn|Telefon|Stad)$/.test((e.textContent || "").trim()));
    const et = etiketter.map((e) => ({ text: (e.textContent || "").trim(), fs: getComputedStyle(e).fontSize, fw: getComputedStyle(e).fontWeight }));
    const kort = rubriker.map((e) => kortRunt(e)).filter(Boolean).map((k) => { const b = /** @type {Element} */ (k).getBoundingClientRect(); const cs = getComputedStyle(/** @type {Element} */ (k)); return { x: b.left, h: b.right, w: b.width, radie: cs.borderTopLeftRadius, pad: cs.paddingTop }; });
    const falt = document.querySelector("main input");
    const knappar = [...document.querySelectorAll("main button")].filter((b) => /^(Ta bort|Använd initialer)$/.test((b.textContent || "").trim())).map((b) => ({ text: (b.textContent || "").trim(), fs: getComputedStyle(b).fontSize, fw: getComputedStyle(b).fontWeight }));
    const kolumn = (() => { for (let e = rubriker[0] ? rubriker[0].parentElement : null; e && e !== document.body; e = e.parentElement) { if (getComputedStyle(e).maxWidth !== "none") return e.getBoundingClientRect().width; } return null; })();
    return { r, et, kort, kolumn, faltFs: falt ? getComputedStyle(falt).fontSize : null, knappar, over: document.documentElement.scrollWidth - document.documentElement.clientWidth, vw: document.documentElement.clientWidth };
  });
  matt.push(`profil ${vp.width} px: rubriker ${JSON.stringify(d.r)}, etiketter ${JSON.stringify(d.et)}, kort ${JSON.stringify(d.kort)}, kolumn ${d.kolumn} px, fälttext ${d.faltFs}, knappar ${JSON.stringify(d.knappar)}, överflöde ${d.over} px`);
  krav(d.r.length >= 2 && d.et.length >= 3, `profil ${vp.width}: ${d.r.length} rubriker och ${d.et.length} etiketter hittade, väntat minst 2 och 3 (golv).`);
  for (const r of d.r) krav(r.fs === "12px" && r.fw === "700" && r.tt === "uppercase" && r.farg, `profil ${vp.width}: rubriken "${r.text}" är ${r.fs}/${r.fw} ${r.tt}${r.farg ? "" : ", inte accentfärg"}, väntat 12px/700 versaler i accentfärg (SS text-xs font-bold uppercase, ProfileView.jsx:122).`);
  for (const r of d.r) krav(r.iKort, `profil ${vp.width}: rubriken "${r.text}" står utanför sitt kort. SS har rubriken inuti kortet (ProfileView.jsx:121-122).`);
  for (const e of d.et) krav(e.fs === "10px" && e.fw === "400", `profil ${vp.width}: etiketten "${e.text}" är ${e.fs}/${e.fw}, väntat 10px/400 (SS text-[10px], ProfileView.jsx:245).`);
  krav(d.over <= 0, `profil ${vp.width}: sidan flödar över ${d.over} px horisontellt.`);
  for (const k of d.kort) krav(k.x >= 15.5 && k.h <= d.vw - 15.5, `profil ${vp.width}: ett kort går från ${k.x} till ${k.h} i en sida på ${d.vw}, utanför marginalen på 16 px.`);
  if (vp.width >= 1024) krav(d.kolumn !== null && d.kolumn <= 672.5, `profil ${vp.width}: kolumnen är ${d.kolumn} px bred, väntat högst 672 (SS max-w-2xl, ProfileView.jsx:106).`);
  if (vp.width >= 1024) for (const k of d.kort) krav(k.w <= 672.5, `profil ${vp.width}: kortet är ${k.w} px brett, väntat högst 672 (SS max-w-2xl, ProfileView.jsx:106).`);
  if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `profil-${vp.width}.png`), fullPage: true });
  await context.close();
}

// ══ 28. INSTÄLLNINGSVYN MED TVÅ GRUPPER: KATALOGEN BYTS NÄR GRUPPEN BYTS (0.33.0, #162) ══════════════════════════════
// Väg C (CP 2026-09-28 i #160): katalogerna är gruppens. Vyn får två grupper med OLIKA händelsetyper och en växlare. Mätt vid
// 390 och 1280: (a) listan visar bara den aktiva gruppens kategorier, före och efter bytet; (b) ett utkast som öppnats med
// "Ändra" i den ena gruppen står INTE kvar efter bytet (före 0.33.0 gjorde det, och Spara skrev då den förra gruppens kategori
// in i den nya gruppens katalog); (c) ingen horisontell överflödning. Golv: minst 2 rader per grupp, och utkastet måste ha
// synts före bytet, annars mäter (b) ingenting.
for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  const { page, context } = await oppna("installning-grupper", vp);
  try {
    /** @returns {Promise<{ namn: string[], utkast: string | null, spara: boolean, over: number }>} */
    const las = () =>
      page.evaluate(() => {
        const lista = document.querySelector('[aria-label="Händelsetyper"]');
        const namn = lista ? [...lista.querySelectorAll("li")].map((li) => (li.querySelector("span.font-medium")?.textContent || "").trim()).filter(Boolean) : [];
        const sv = /** @type {HTMLInputElement | null} */ (document.querySelector('input[name="sv"]'));
        const spara = [...document.querySelectorAll("button")].some((b) => (b.textContent || "").trim() === "Spara");
        return { namn, utkast: sv ? sv.value : null, spara, over: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
    const fore = await las();
    await page.getByRole("button", { name: "Ändra" }).first().click();
    const oppnat = await las();
    await page.getByRole("button", { name: "miranda-ab", exact: true }).click();
    await page.waitForTimeout(100);
    const efter = await las();
    matt.push(`inställningsvyn två grupper ${vp.width} px: cps-ab ${JSON.stringify(fore.namn)}, utkast "${oppnat.utkast}", efter bytet miranda-ab ${JSON.stringify(efter.namn)}, utkast ${efter.utkast === null ? "stängt" : `"${efter.utkast}"`}, Spara ${efter.spara ? "synlig" : "borta"}, överflöde ${efter.over} px`);
    krav(fore.namn.length >= 2 && efter.namn.length >= 2, `inställningsvyn två grupper ${vp.width}: ${fore.namn.length} och ${efter.namn.length} rader, väntat minst 2 per grupp (golv).`);
    krav(oppnat.utkast === "Styrelsemöte", `inställningsvyn två grupper ${vp.width}: utkastet visade "${oppnat.utkast}" före bytet, väntat "Styrelsemöte" (golv: annars mäter bytet ingenting).`);
    krav(fore.namn.every((n) => ["Styrelsemöte", "Deklaration"].includes(n)), `inställningsvyn två grupper ${vp.width}: cps-ab visar ${JSON.stringify(fore.namn)}, en annan grupps kategori syns.`);
    krav(efter.namn.every((n) => ["Turné", "Repetition"].includes(n)), `inställningsvyn två grupper ${vp.width}: efter bytet visar miranda-ab ${JSON.stringify(efter.namn)}, en annan grupps kategori syns.`);
    krav(efter.utkast === null && !efter.spara, `inställningsvyn två grupper ${vp.width}: efter bytet till miranda-ab står cps-ab:s utkast kvar ("${efter.utkast}", Spara ${efter.spara ? "synlig" : "borta"}). Spara skriver då cps-ab:s kategori in i miranda-ab:s katalog.`);
    krav(efter.over <= 0 && fore.over <= 0, `inställningsvyn två grupper ${vp.width}: sidan flödar över ${Math.max(fore.over, efter.over)} px horisontellt.`);
    if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `installning-grupper-${vp.width}.png`), fullPage: true });
  } catch (e) {
    krav(false, `inställningsvyn två grupper ${vp.width}: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
  }
  await context.close();
}

// ══ 29. MEDDELANDEN MOT SS ChatInboxPanel VID 390 OCH 1280 PX (0.34.0, #182) ══════════════════════════════════════════
// CP 2026-09-30: ett meddelande till en person är PRIVAT och ska finnas i ramverket, med samma yta som SessionStudio. Förebilden är
// SS `ChatInboxPanel.jsx`: på dator listan till vänster (35 procent, minst 220 px, högst 40, `:959`) och samtalet till höger (`:1194`),
// båda kort med rundade hörn och 8 px mellanrum (`sm:gap-2 sm:p-2`, `:957`). På telefon är listan hela sidan och ett valt samtal
// ersätter den (`:880-892`). Krav:
//   (a) 1280: listan 35 till 40 procent av ytan och minst 220 px, samtalsytan bredvid, båda med rundning minst 12 och 8 px mellan;
//       raden: märke 36 px, namn 14 px, tid och etikett 10 px, utdrag 12 px, räknaren i märkets hörn på det privata samtalet.
//   (b) 1280, privat samtal valt: raden "Bara ni två ser det här" syns i huvudet, egna bubblor till höger och andras till vänster,
//       bubblans text 14 px och rundning minst 16 och en bakgrund som skiljer sig från ytan (i det ljusa temat är `raised` samma
//       färg som `surface`, och andras bubblor var osynliga tills montaget visade det), skrivfältet längst ned i samtalsytan.
//   (c) 390: listan är hela bredden och samtalet dolt; efter ett tryck är listan dold, "Tillbaka" syns, och skrivfältet ligger
//       ovanför bottenraden, inom fönstret.
//   (d) Nytt meddelande (plusset): en region och ingen dialog, minst två personer att välja med 44 px träffyta, raden om att det är
//       privat MELLAN väljaren och textrutan, knappen Skicka, kolumnen högst 672 px vid 1280.
// Ingen horisontell överflödning någonstans. Golv: minst 2 rader i listan och minst 3 bubblor i samtalet.
for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  const { page, context } = await oppna("meddelanden", vp);
  const namn = `meddelanden ${vp.width}`;
  try {
    await page.waitForSelector("[data-samtalsrad]", { timeout: 4000 });
    await page.waitForTimeout(150);
    const over = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const lista = await page.evaluate(() => {
      const yta = /** @type {HTMLElement} */ (document.querySelector("[data-ops-meddelanden]"));
      const l = /** @type {HTMLElement} */ (document.querySelector("[data-samtalslista]"));
      const s = /** @type {HTMLElement} */ (l.nextElementSibling);
      const b = (/** @type {Element} */ e) => e.getBoundingClientRect();
      const rader = [...document.querySelectorAll("[data-samtalsrad]")].map((r) => {
        const marke = r.querySelector("[role=img]");
        const namnEl = r.querySelector(".text-etikett");
        const tid = r.querySelector("[data-tid]");
        const etikett = r.querySelector("[data-slag]");
        const utdrag = r.querySelector(".text-meta");
        const badge = r.querySelector("[data-ops-count-badge]");
        return {
          slag: r.getAttribute("data-samtalsrad"),
          marke: marke ? b(marke).width : null,
          namn: namnEl ? getComputedStyle(namnEl).fontSize + "/" + getComputedStyle(namnEl).fontWeight : null,
          tid: tid ? getComputedStyle(tid).fontSize : null,
          etikett: etikett ? getComputedStyle(etikett).fontSize : null,
          utdrag: utdrag ? getComputedStyle(utdrag).fontSize : null,
          badgeIHorn: badge && marke ? Math.abs(b(badge).right - b(marke).right) < 6 && Math.abs(b(badge).top - b(marke).top) < 6 : false,
        };
      });
      return {
        yta: b(yta).width,
        // ⛔ Dokumentets bredd och inte clientWidth: tokens.css har `scrollbar-gutter: stable`, så rullningslistens plats är alltid reserverad.
        vw: document.documentElement.getBoundingClientRect().width,
        rullar: document.documentElement.scrollHeight - window.innerHeight,
        lista: { x: b(l).left, w: b(l).width, synlig: getComputedStyle(l).display !== "none", radie: parseFloat(getComputedStyle(l).borderTopLeftRadius) },
        samtal: { x: b(s).left, w: b(s).width, synlig: getComputedStyle(s).display !== "none", radie: parseFloat(getComputedStyle(s).borderTopLeftRadius) },
        rader,
      };
    });
    matt.push(`${namn}: listan ${JSON.stringify(lista.lista)}, samtalsytan ${JSON.stringify(lista.samtal)}, ytan ${lista.yta} px, rader ${JSON.stringify(lista.rader)}`);
    krav(lista.rullar <= 0, `${namn}: sidan är ${lista.rullar} px högre än fönstret. Meddelanden fyller fönstret, och listan och samtalet rullar var för sig.`);
    krav(lista.rader.length >= 2, `${namn}: ${lista.rader.length} rader i listan, väntat minst 2 (gruppchatten och det privata samtalet). Golv.`);
    for (const r of lista.rader) {
      krav(r.marke !== null && Math.abs(r.marke - 36) < 0.5, `${namn}: raden (${r.slag}) har märket ${r.marke} px, väntat 36.`);
      krav(r.namn === "14px/500", `${namn}: raden (${r.slag}) har namnet ${r.namn}, väntat 14px/500 (SS text-sm font-medium, :735).`);
      krav(r.tid === "10px" && r.etikett === "10px", `${namn}: raden (${r.slag}) har tiden ${r.tid} och etiketten ${r.etikett}, väntat 10px (ramverkets minsta roll, SS 9px, :738 och :745).`);
      krav(r.utdrag === "12px", `${namn}: raden (${r.slag}) har utdraget ${r.utdrag}, väntat 12px (SS text-xs, :755).`);
    }
    const privat = lista.rader.find((r) => r.slag === "personer");
    krav(!!privat && privat.badgeIHorn, `${namn}: det privata samtalet med två olästa har ${privat ? "ingen räknare i märkets hörn" : "ingen rad"} (SS :727).`);
    if (vp.width >= 1024) {
      const andel = lista.lista.w / lista.yta;
      krav(lista.lista.synlig && lista.samtal.synlig, `${namn}: listan (${lista.lista.synlig}) och samtalsytan (${lista.samtal.synlig}) ska synas samtidigt på dator.`);
      krav(andel >= 0.33 && andel <= 0.41 && lista.lista.w >= 219.5, `${namn}: listan är ${lista.lista.w.toFixed(0)} px, ${(andel * 100).toFixed(1)} procent av ${lista.yta.toFixed(0)}, väntat 35 till 40 procent och minst 220 (SS :959).`);
      krav(lista.lista.radie >= 12 && lista.samtal.radie >= 12, `${namn}: rundningen är ${lista.lista.radie} och ${lista.samtal.radie}, väntat minst 12 (SS rounded-xl).`);
      const glapp = lista.samtal.x - (lista.lista.x + lista.lista.w);
      krav(Math.abs(glapp - 8) < 1, `${namn}: ${glapp.toFixed(1)} px mellan listan och samtalet, väntat 8 (SS sm:gap-2).`);
    } else {
      krav(lista.lista.synlig && !lista.samtal.synlig && lista.lista.w >= lista.vw - 1, `${namn}: listan ska vara hela bredden (${lista.lista.w} av ${lista.vw}) och samtalet dolt (${lista.samtal.synlig ? "synligt" : "dolt"}) på telefon.`);
    }
    if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `meddelanden-lista-${vp.width}.png`) });

    await page.locator('[data-samtalsrad="personer"]').click();
    await page.waitForSelector("[data-meddelande]", { timeout: 4000 });
    await page.waitForTimeout(150);
    const samtal = await page.evaluate(() => {
      const vy = /** @type {HTMLElement} */ (document.querySelector("[data-ops-samtal]"));
      const b = (/** @type {Element} */ e) => e.getBoundingClientRect();
      const logg = /** @type {HTMLElement} */ (vy.querySelector("[role=log]"));
      const bubblor = [...vy.querySelectorAll("[data-meddelande]")].map((m) => {
        const bubbla = /** @type {HTMLElement} */ (m.querySelector(".rounded-2xl"));
        const cs = getComputedStyle(bubbla);
        return { slag: m.getAttribute("data-meddelande"), v: b(bubbla).left - b(logg).left, h: b(logg).right - b(bubbla).right, fs: cs.fontSize, radie: parseFloat(cs.borderTopLeftRadius), bg: cs.backgroundColor, yta: getComputedStyle(/** @type {Element} */ (vy.closest("section"))).backgroundColor };
      });
      const rad = vy.querySelector("[data-privat-rad]");
      const form = /** @type {HTMLElement} */ (vy.querySelector("form"));
      const lista = /** @type {HTMLElement} */ (document.querySelector("[data-samtalslista]"));
      const tillbaka = [...document.querySelectorAll("button")].find((x) => (x.textContent || "").trim() === "Tillbaka" && getComputedStyle(x).display !== "none");
      return {
        privatRad: rad ? (rad.textContent || "").trim() : null,
        privatSynlig: rad ? b(rad).height > 0 : false,
        bubblor,
        formNederkant: b(form).bottom,
        vyNederkant: b(vy).bottom,
        listaSynlig: getComputedStyle(lista).display !== "none",
        tillbaka: !!tillbaka,
        vh: window.innerHeight,
      };
    });
    const bottenrad = vp.width < 768 ? 56 : 0;
    matt.push(`${namn}, privat samtal: rad "${samtal.privatRad}", bubblor ${JSON.stringify(samtal.bubblor)}, skrivfältets nederkant ${samtal.formNederkant} (ytans ${samtal.vyNederkant}, fönstret ${samtal.vh}), listan ${samtal.listaSynlig ? "synlig" : "dold"}, Tillbaka ${samtal.tillbaka ? "synlig" : "saknas"}`);
    krav(samtal.privatRad === "Bara ni två ser det här" && samtal.privatSynlig, `${namn}: samtalets huvud säger "${samtal.privatRad}", väntat "Bara ni två ser det här" synligt (CP:s beslut 1).`);
    krav(samtal.bubblor.length >= 3, `${namn}: ${samtal.bubblor.length} bubblor, väntat minst 3. Golv.`);
    for (const bu of samtal.bubblor) {
      krav(bu.bg !== bu.yta && !/rgba\(0, 0, 0, 0\)|transparent/.test(bu.bg), `${namn}: bubblan (${bu.slag}) har bakgrunden ${bu.bg} på ytan ${bu.yta}. En bubbla i samma färg som ytan är text utan bubbla (SS --color-chat-bubble-other-bg).`);
      krav(bu.fs === "14px" && bu.radie >= 16, `${namn}: bubblan (${bu.slag}) har ${bu.fs} och rundning ${bu.radie}, väntat 14px och minst 16 (SS rounded-2xl, :145).`);
      if (bu.slag === "eget") krav(bu.h < 16 && bu.v > bu.h, `${namn}: en egen bubbla ligger ${bu.v.toFixed(0)} px från vänster och ${bu.h.toFixed(0)} från höger, väntat till höger.`);
      else krav(bu.v < 60 && bu.h > bu.v, `${namn}: en annans bubbla ligger ${bu.v.toFixed(0)} px från vänster och ${bu.h.toFixed(0)} från höger, väntat till vänster.`);
    }
    krav(Math.abs(samtal.formNederkant - samtal.vyNederkant) < 1.5, `${namn}: skrivfältet slutar ${samtal.formNederkant}, samtalsytan ${samtal.vyNederkant}. Det ska ligga längst ned.`);
    krav(samtal.formNederkant <= samtal.vh - bottenrad + 0.5, `${namn}: skrivfältet slutar ${samtal.formNederkant}, under ${samtal.vh - bottenrad} (fönstret minus bottenraden).`);
    if (vp.width < 768) krav(!samtal.listaSynlig && samtal.tillbaka, `${namn}: på telefon ska listan döljas (${samtal.listaSynlig ? "synlig" : "dold"}) och Tillbaka synas (${samtal.tillbaka}).`);
    krav((await over()) <= 0, `${namn}: sidan flödar över ${await over()} px horisontellt.`);
    if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `meddelanden-samtal-${vp.width}.png`) });

    // (d) Nytt meddelande ur plusset. På telefon är det bottenradens plus (ett ark), på dator huvudets.
    if (vp.width < 768) await page.locator('nav button[aria-label="Skapa"]').last().click();
    else await page.getByRole("button", { name: "Skapa" }).first().click();
    await page.getByRole("button", { name: "Nytt meddelande" }).last().click();
    const panel = page.getByRole("region", { name: "Nytt meddelande" });
    await panel.waitFor({ timeout: 4000 });
    const ny = await panel.evaluate((p) => {
      const b = (/** @type {Element} */ e) => e.getBoundingClientRect();
      const radio = [...p.querySelectorAll("[role=radio]")].map((r) => b(r).height);
      const grupp = p.querySelector("[role=radiogroup]");
      const rad = p.querySelector("[data-privat]");
      const text = p.querySelector("textarea");
      const kolumn = /** @type {HTMLElement} */ (p.querySelector(".max-w-2xl"));
      const skicka = [...document.querySelectorAll("[data-skapa-knappar] button")].map((x) => (x.textContent || "").trim());
      return {
        radio,
        ordning: grupp && rad && text ? b(grupp).bottom <= b(rad).top + 0.5 && b(rad).bottom <= b(text).top + 0.5 : false,
        rad: rad ? (rad.textContent || "").trim() : null,
        kolumn: kolumn ? b(kolumn).width : null,
        skicka,
        dialoger: document.querySelectorAll("[role=dialog]").length,
      };
    });
    matt.push(`${namn}, Nytt meddelande: radioknappar ${JSON.stringify(ny.radio)}, rad "${ny.rad}", ordning ${ny.ordning}, kolumn ${ny.kolumn}, knappar ${JSON.stringify(ny.skicka)}, dialoger ${ny.dialoger}`);
    krav(ny.dialoger === 0, `${namn}: Nytt meddelande öppnade ${ny.dialoger} dialoger, väntat en panel (0.31.0).`);
    krav(ny.radio.length >= 2 && ny.radio.every((h) => h >= 43.5), `${namn}: ${ny.radio.length} personer att välja med höjderna ${JSON.stringify(ny.radio)}, väntat minst 2 och 44 px.`);
    krav(ny.rad === "Bara ni två ser det här." && ny.ordning, `${namn}: raden om det privata ("${ny.rad}") ska stå mellan väljaren och textrutan (${ny.ordning}).`);
    krav(ny.skicka.includes("Skicka") && !ny.skicka.includes("Spara"), `${namn}: panelens knappar är ${JSON.stringify(ny.skicka)}, väntat Skicka och ingen Spara.`);
    if (vp.width >= 1024) krav(ny.kolumn !== null && ny.kolumn <= 672.5, `${namn}: Nytt meddelande är ${ny.kolumn} px brett, väntat högst 672 (smal kolumn som Ny grupp).`);
    krav((await over()) <= 0, `${namn}, Nytt meddelande: sidan flödar över ${await over()} px horisontellt.`);
    if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `nytt-meddelande-${vp.width}.png`) });
  } catch (e) {
    krav(false, `${namn}: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
  }
  await context.close();
}

// ══ 30. KALENDERN MOT SS CalView VID 390 OCH 1280 PX (0.36.0, #179 F1) ════════════════════════════════════════════════
// CP 2026-09-29 i #179: "Kolla alla kalender inställningar och funktioner i SessionStudio. [...] Samma vill jag ha i ramverket."
// Förebilderna: SS `CalView.jsx`, `calView/MonthGrid.jsx`, `useCalendarDaySelection.js`, `CalendarDayPeekPopover.jsx`,
// `calendarSpanLayout.js`, `CalendarView.jsx` och `CalendarViewToolbar.jsx`. Scenen `kalender`: idag är onsdag 30 september 2026.
// Krav, varje del för sig:
//   (a) 25 månader, september 2025 till september 2027, och innevarande månad rullad upp under veckodagsraden. Måndag först.
//   (b) Verktygsraden. Från 768 px: Kalendrar, Veckonummer, Typ och status, Sök, Skapa i den ordningen, 32 px. Under 768
//       (0.37.0, CP 2026-09-30 mot SS-appen): Sök, Veckonummer, Typ och status som RENA ikoner till vänster (ingen kant, ingen
//       yta), kalenderpillret med text längst till höger, Skapa inte i raden (plusset finns), och allt med 44 px träffyta.
//   (c) Rutan: rundningen är tokens 12 px (vald 16), en kant. På telefon (0.37.0, SS-appen `DayCell`): siffran centrerad,
//       idag en mörk cirkel på 28 px, märkena prickar och streck i kategorins färg och INGA ikoner i rutan. Från 640 px:
//       idag ett fyllt piller, piller med titel. Det som varit nedtonat.
//   (d) Band från 640 px: flerdagsposten 5-7 oktober är ETT band över tre kolumner, semestern 9-13 oktober två (ett per
//       vecka), heldagen 1 oktober ett band över en kolumn, under dagsiffrorna. På telefon inga band: ett streck i VARJE
//       ruta posten täcker, och inte i rutan före eller efter.
//   (e) Idag-knappen: syns när månaden rullat ur bild, pilen pekar ned när idag ligger under och upp när den ligger över.
//   (f) Veckonummer: av från början, på efter ett tryck, sparat i enhetens minne, och "Välj vecka 41" väljer sju dagar.
//   (g) Dra-markering: ett drag från den 14:e till den 16:e oktober väljer tre dagar, tre piller med var sitt kryss; ett kryss tar bort en.
//   (h) Dagpanelen: på dator en kolumn till höger om rutnätet, 360 px vid 1280. På telefon (0.37.0, CP 2026-09-30 med SS-appens
//       skärmbilder) FLYTER den över rutnätet: ingen egen yta eller kant, rullytan behåller sin höjd, högst 45 procent av ytan.
//       Den valda rutan är mörk med ljus text och rundning 16. Posterna står i EN bubbla med tak 140 px (SS `abEventsScroll`)
//       som rullar invändigt medan kalendern bakom står still, med rubrikerna Grupp och Mina när båda slagen finns. Antalet och
//       skapa-rutan finns, skapa ger de valda dagarna, och lagrens bubbla ritas inte utan innehåll.
//   (i) Kalenderfiltret: Alla kalendrar, gruppens och mina, och knappen Hantera kalendrar (0.37.0; till 0.36.0 en rad om att
//       den kommer); en vald kalender ändrar
//       rutnätet, och snabbtitten (högerklick, eller långtryck på telefon) visar det dolda märkt "Dold".
//   (j) Sök tonar ned dagar utan träff och skriver ut antalet.
//   (k) Plats för F6 (0.37.0): den 14 oktober har en ton och två hörnmärken, ritade inom rutan (hörnmärkena högst 6 px utanför,
//       som SS `top: -6, right: -6`), och märkenas ord står i rutans namn.
// Ingen horisontell överflödning. Golv: minst 25 månader, 4 synliga verktyg, 3 bandbitar (dator) eller 8 streck (telefon), 4 märken
// den 12 oktober, 2 hörnmärken och 7 dagar i veckan mätta.
for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  const { page, context } = await oppna("kalender", vp);
  const namn = `kalendern ${vp.width}`;
  const telefon = vp.width < 768;
  try {
    // ⛔ Sektionen och inte rullytan: mot en äldre dist (0.35.0) ska varje del bli röd för sig, inte hela avsnittet avbrytas.
    await page.waitForSelector('section[aria-label="Kalender"]', { timeout: 4000 });
    await page.waitForTimeout(300);
    const over = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const b = (/** @type {string} */ v) => page.evaluate((x) => { const e = document.querySelector(x); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, top: r.top, bottom: r.bottom, right: r.right }; }, v);

    // (a) månaderna och rullningen
    try {
      const man = await page.evaluate(() => {
        const rulle = /** @type {HTMLElement} */ (document.querySelector("[data-kalender-rulle]"));
        const rubriker = [...rulle.querySelectorAll("h3")].map((h) => (h.textContent || "").trim().toLowerCase());
        const idag = [...rulle.querySelectorAll("h3")].find((h) => /september 2026/i.test(h.textContent || ""));
        const huvud = /** @type {HTMLElement} */ (rulle.firstElementChild);
        return { rubriker, idagTopp: idag ? idag.getBoundingClientRect().top - rulle.getBoundingClientRect().top - huvud.offsetHeight : null, veckodagar: [...huvud.children].map((c) => (c.textContent || "").trim()) };
      });
      matt.push(`${namn}: ${man.rubriker.length} månader (${man.rubriker[0]} till ${man.rubriker[man.rubriker.length - 1]}), september 2026 ${man.idagTopp} px under veckodagsraden, veckodagarna ${man.veckodagar.join(" ")}`);
      krav(man.rubriker.length >= 25 && man.rubriker[0] === "september 2025" && man.rubriker[24] === "september 2027", `${namn}: månaderna är ${man.rubriker.length} (${man.rubriker[0]} till ${man.rubriker[man.rubriker.length - 1]}), väntat 25, september 2025 till september 2027 (SS monthsBefore = 12, monthsToShow = 12).`);
      krav(man.idagTopp !== null && man.idagTopp >= -1 && man.idagTopp <= 24, `${namn}: september 2026 står ${man.idagTopp} px under veckodagsraden vid öppning, väntat 0 till 24 (rullad till innevarande månad).`);
      krav(man.veckodagar.length === 7 && /^mån/i.test(man.veckodagar[0]), `${namn}: veckodagsraden är ${JSON.stringify(man.veckodagar)}, väntat sju dagar med måndag först.`);

    } catch (e) {
      krav(false, `${namn} (a): delen avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
      await page.keyboard.press("Escape").catch(() => {});
    }

    // (b) verktygsraden
    try {
      const verktyg = await page.evaluate(() => [...document.querySelectorAll("[data-kalender-verktyg] > button")].map((x) => {
        const r = x.getBoundingClientRect();
        const cs = getComputedStyle(x);
        const svg = x.querySelector("svg");
        return { namn: (x.getAttribute("aria-label") || "").split(":")[0], x: r.x, h: r.height, w: r.width, h2: r.right, syns: cs.display !== "none" && r.width > 0, kant: cs.borderTopColor, kantB: parseFloat(cs.borderTopWidth), bg: cs.backgroundColor, radie: parseFloat(cs.borderTopLeftRadius), text: (x.textContent || "").trim(), ikon: svg ? svg.getBoundingClientRect().width : 0 };
      }));
      const synliga = verktyg.filter((v) => v.syns).sort((p, q) => p.x - q.x);
      matt.push(`${namn}: verktygen ${synliga.map((v) => `${v.namn} ${v.h}x${v.w} kant ${v.kant}/${v.kantB} yta ${v.bg} ikon ${v.ikon}`).join(", ")}`);
      krav(synliga.length >= 4, `${namn}: ${synliga.length} synliga verktyg, väntat minst 4 (golv).`);
      const ordning = synliga.map((v) => v.namn);
      const genom = (/** @type {string} */ c) => /^rgba\([^)]*,\s*0\)$/.test(c) || c === "transparent";
      if (telefon) {
        krav(JSON.stringify(ordning) === JSON.stringify(["Sök i kalendern", "Veckonummer", "Typ och status", "Kalendrar"]), `${namn}: verktygen står ${JSON.stringify(ordning)} från vänster, väntat Sök, Veckonummer, Typ och status och sist kalenderpillret (SS-appens rad; Skapa är plusset).`);
        const ikoner = synliga.slice(0, 3);
        krav(ikoner.every((v) => (genom(v.kant) || v.kantB === 0) && genom(v.bg)), `${namn}: ikonerna har kant ${JSON.stringify(ikoner.map((v) => v.kant))} och yta ${JSON.stringify(ikoner.map((v) => v.bg))}, väntat rena ikoner utan ruta (CP 2026-09-30 mot SS-appen).`);
        krav(ikoner.every((v) => v.ikon >= 20), `${namn}: ikonerna är ${JSON.stringify(ikoner.map((v) => v.ikon))} px, väntat minst 20 (SS-appen ritar dem stora, utan ruta).`);
        const pill = synliga[synliga.length - 1];
        const radensHoger = await page.evaluate(() => { const r = document.querySelector("[data-kalender-verktyg]"); return r ? r.getBoundingClientRect().right : 0; });
        krav(!!pill && pill.namn === "Kalendrar" && pill.radie >= pill.h / 2 - 0.5 && /kalend/i.test(pill.text) && !genom(pill.kant) && pill.h2 >= radensHoger - 1, `${namn}: kalenderpillret ${JSON.stringify(pill)}, väntat en kapsel med text och kant som slutar vid radens högerkant ${radensHoger} (SS-appens "Musikkollektive..."-piller).`);
      } else {
        krav(JSON.stringify(ordning) === JSON.stringify(["Kalendrar", "Veckonummer", "Typ och status", "Sök i kalendern", "Skapa"]), `${namn}: verktygens ordning är ${JSON.stringify(ordning)}, väntat Kalendrar, Veckonummer, Typ och status, Sök, Skapa (SS CalendarViewToolbar).`);
      }
      const vantadH = telefon ? 44 : 32;
      krav(synliga.every((v) => Math.abs(v.h - vantadH) < 0.6), `${namn}: verktygens höjder ${JSON.stringify(synliga.map((v) => v.h))}, väntat ${vantadH} (SS w-8 h-8 från 768 px, 44 px träffyta under).`);
      krav(synliga.every((v) => v.h2 <= vp.width + 0.5), `${namn}: ett verktyg slutar utanför fönstret (${JSON.stringify(synliga.map((v) => v.h2))}).`);

    } catch (e) {
      krav(false, `${namn} (b): delen avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
      await page.keyboard.press("Escape").catch(() => {});
    }

    // (c) rutan
    try {
      const ruta = await page.evaluate(() => {
        const r = (/** @type {string} */ d) => /** @type {HTMLElement | null} */ (document.querySelector(`[data-cal-day="${d}"]`));
        const idag = r("2026-09-30");
        const forbi = r("2026-09-14");
        const tolfte = r("2026-10-12");
        const vanlig = r("2026-10-15");
        const cs = vanlig ? getComputedStyle(vanlig) : null;
        const siffra = idag ? /** @type {HTMLElement} */ (idag.querySelector("[data-dagnummer]")) : null;
        const syns = (/** @type {Element | null} */ e) => !!e && getComputedStyle(e).display !== "none" && e.getBoundingClientRect().height > 0;
        const mitt = (/** @type {Element} */ e) => { const b = e.getBoundingClientRect(); return b.x + b.width / 2; };
        const vs = vanlig ? /** @type {HTMLElement} */ (vanlig.querySelector("[data-dagnummer]")) : null;
        const ljus = (/** @type {string} */ c) => { const m = c.match(/[\d.]+/g); return m ? (0.2126 * +m[0] + 0.7152 * +m[1] + 0.0722 * +m[2]) / 255 : 1; };
        const markeFarg = tolfte ? [...tolfte.querySelectorAll("[data-prick], [data-streck]")].map((x) => ({ id: x.getAttribute("data-prick") || x.getAttribute("data-streck"), slag: x.hasAttribute("data-streck") ? "streck" : "prick", bg: getComputedStyle(x).backgroundColor, w: x.getBoundingClientRect().width, h: x.getBoundingClientRect().height })) : [];
        const ikonerIRutor = [...document.querySelectorAll("[data-cal-day] svg")].filter((x) => !x.closest("[data-hornmarken]") && x.getBoundingClientRect().width > 0).length;
        const siffraRuta = siffra ? siffra.getBoundingClientRect() : null;
        return {
          radie: cs ? parseFloat(cs.borderTopLeftRadius) : 0,
          kant: cs ? parseFloat(cs.borderTopWidth) : 0,
          siffraBg: siffra ? getComputedStyle(siffra).backgroundColor : "",
          siffraLjus: siffra ? ljus(getComputedStyle(siffra).backgroundColor) : 1,
          siffraRadie: siffra ? parseFloat(getComputedStyle(siffra).borderTopLeftRadius) : 0,
          siffraMatt: siffraRuta ? [siffraRuta.width, siffraRuta.height] : null,
          centrerad: vanlig && vs ? Math.abs(mitt(vanlig) - mitt(vs)) : 99,
          forbiNedtonad: !!forbi && !!forbi.querySelector('[data-nedtonad="forbi"]'),
          idagNedtonad: !!idag && !!idag.querySelector("[data-nedtonad]"),
          prickar: syns(tolfte && tolfte.querySelector("[data-kalender-marken]")),
          piller: syns(tolfte && tolfte.querySelector("[data-kalender-piller]")),
          pillerText: tolfte ? [...tolfte.querySelectorAll("[data-kalender-piller] > span")].map((x) => (x.textContent || "").trim()) : [],
          markenSpill: tolfte ? (() => { const m = tolfte.querySelector("[data-kalender-marken]"); return m ? m.scrollWidth - m.clientWidth : 0; })() : 0,
          markeFarg,
          ikonerIRutor,
        };
      });
      matt.push(`${namn}: rutan rundning ${ruta.radie}, kant ${ruta.kant}, siffran ${ruta.centrerad.toFixed(1)} px från mitten, idag ${ruta.siffraBg} ${JSON.stringify(ruta.siffraMatt)} rundning ${ruta.siffraRadie}, förbi nedtonad ${ruta.forbiNedtonad}, prickar ${ruta.prickar}, piller ${ruta.piller} ${JSON.stringify(ruta.pillerText)}, märkena den 12:e ${JSON.stringify(ruta.markeFarg)}, ikoner i rutor ${ruta.ikonerIRutor}`);
      krav(Math.abs(ruta.radie - 12) < 0.5 && ruta.kant >= 1, `${namn}: rutan har rundning ${ruta.radie} och kant ${ruta.kant}, väntat 12 (--radius-base, SS-appens radius.md och SS webb rounded-xl) och en kant. CP 2026-09-30: "Rundningen i cellerna är fel."`);
      krav(ruta.forbiNedtonad && !ruta.idagNedtonad, `${namn}: den 14 september är ${ruta.forbiNedtonad ? "" : "inte "}nedtonad och idag ${ruta.idagNedtonad ? "är" : "är inte"} det, väntat det som varit nedtonat och idag inte (SS :413).`);
      if (vp.width < 640) {
        krav(ruta.centrerad <= 1, `${namn}: siffran står ${ruta.centrerad.toFixed(1)} px från rutans mitt, väntat centrerad (SS-appen dayNumberContainer).`);
        krav(!!ruta.siffraMatt && Math.abs(ruta.siffraMatt[0] - 28) < 0.6 && Math.abs(ruta.siffraMatt[1] - 28) < 0.6 && ruta.siffraRadie >= 13.5 && ruta.siffraLjus < 0.35, `${namn}: idags siffra är ${JSON.stringify(ruta.siffraMatt)} px, rundning ${ruta.siffraRadie}, bakgrund ${ruta.siffraBg}, väntat en mörk cirkel på 28 px (SS-appen todayCircle).`);
        krav(ruta.prickar && !ruta.piller, `${namn}: den 12 oktober visar märken ${ruta.prickar} och piller ${ruta.piller}, väntat märken och inga piller under 640 px (SS sm:hidden).`);
        const prickar = ruta.markeFarg.filter((m) => m.slag === "prick");
        const streck = ruta.markeFarg.filter((m) => m.slag === "streck");
        krav(prickar.length >= 3 && streck.length >= 1, `${namn}: den 12 oktober har ${prickar.length} prickar och ${streck.length} streck, väntat minst 3 prickar (möte, lön, tåg) och ett streck (semestern 9-13 oktober). Golv.`);
        krav(prickar.every((m) => Math.abs(m.w - 6) < 0.6 && Math.abs(m.h - 6) < 0.6) && streck.every((m) => Math.abs(m.w - 10) < 0.6 && Math.abs(m.h - 4) < 0.6), `${namn}: märkenas mått ${JSON.stringify(ruta.markeFarg.map((m) => [m.slag, m.w, m.h]))}, väntat prickar 6x6 och streck 10x4 (SS-appen eventDot, eventDash).`);
        const farger = new Set(ruta.markeFarg.map((m) => m.bg));
        krav(ruta.markeFarg.every((m) => !/^rgba\([^)]*,\s*0\)$/.test(m.bg)) && farger.size >= 3, `${namn}: märkenas färger ${JSON.stringify(ruta.markeFarg.map((m) => [m.id, m.bg]))}, väntat varje märke i sin kategoris färg, minst 3 olika för fyra poster i fyra kategorier (CP 2026-09-30: "prickar och streck istället med rätt färg för kategori").`);
        krav(ruta.ikonerIRutor === 0, `${namn}: ${ruta.ikonerIRutor} ikoner ritas i dagsrutorna, väntat 0 (CP 2026-09-30: SS format rakt av, ikonerna finns i panelens kort och i snabbtitten).`);
      } else {
        krav(!/rgba\(0, 0, 0, 0\)|transparent/.test(ruta.siffraBg) && ruta.siffraRadie >= 8, `${namn}: idags siffra har bakgrunden ${ruta.siffraBg} och rundning ${ruta.siffraRadie}, väntat ett fyllt piller (SS :450).`);
        krav(!ruta.prickar && ruta.piller && ruta.pillerText.includes("Styrelsemöte") && ruta.pillerText.some((t) => t.startsWith("+")), `${namn}: den 12 oktober visar märken ${ruta.prickar} och piller ${JSON.stringify(ruta.pillerText)}, väntat piller med titel och "+N" från 640 px (SS :579).`);
      }
      krav(ruta.markenSpill <= 0, `${namn}: märkesraden spiller ${ruta.markenSpill} px ur rutan.`);

    } catch (e) {
      krav(false, `${namn} (c): delen avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
      await page.keyboard.press("Escape").catch(() => {});
    }

    // (d) banden (från 640 px) och strecken (telefon)
    try {
      const band = await page.evaluate(() => {
        const bitar = (/** @type {string} */ id) => [...document.querySelectorAll(`[data-bandbit="${id}"]`)].filter((x) => x.getBoundingClientRect().width > 0).map((x) => { const r = x.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
        const cell = (/** @type {string} */ d) => { const e = document.querySelector(`[data-cal-day="${d}"]`); return e ? e.getBoundingClientRect() : null; };
        const siffra = (/** @type {string} */ d) => { const e = document.querySelector(`[data-cal-day="${d}"] [data-dagnummer]`); return e ? e.getBoundingClientRect().bottom : null; };
        const strecket = (/** @type {string} */ id) => [...document.querySelectorAll(`[data-streck="${id}"]`)].filter((x) => x.getBoundingClientRect().width > 0).map((x) => (x.closest("[data-cal-day]") || { getAttribute: () => "" }).getAttribute("data-cal-day"));
        const c5 = cell("2026-10-05"), c7 = cell("2026-10-07");
        return { konferens: bitar("konferens"), semester: bitar("semester"), heldag: bitar("stamma"), c5: c5 && { x: c5.x, r: c5.right }, c7: c7 && { r: c7.right }, siffra5: siffra("2026-10-05"), streckKonferens: strecket("konferens"), streckSemester: strecket("semester") };
      });
      matt.push(`${namn}: band konferens ${JSON.stringify(band.konferens)}, semester ${band.semester.length} bitar, heldag ${JSON.stringify(band.heldag)}, streck konferens ${JSON.stringify(band.streckKonferens)}, semester ${JSON.stringify(band.streckSemester)}`);
      if (vp.width < 640) {
        krav(band.konferens.length + band.semester.length + band.heldag.length === 0, `${namn}: ${band.konferens.length + band.semester.length + band.heldag.length} bandbitar syns, väntat inga band på telefon (SS-appen ritar ett streck per ruta).`);
        krav(JSON.stringify(band.streckKonferens) === JSON.stringify(["2026-10-05", "2026-10-06", "2026-10-07"]), `${namn}: konferensens streck står i ${JSON.stringify(band.streckKonferens)}, väntat den 5, 6 och 7 oktober och inte den 4:e eller 8:e.`);
        krav(JSON.stringify(band.streckSemester) === JSON.stringify(["2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13"]), `${namn}: semesterns streck står i ${JSON.stringify(band.streckSemester)}, väntat den 9 till 13 oktober, över veckogränsen.`);
      } else {
        krav(band.konferens.length + band.semester.length + band.heldag.length >= 3, `${namn}: ${band.konferens.length + band.semester.length + band.heldag.length} bandbitar, väntat minst 3 (golv).`);
        krav(band.konferens.length === 1 && !!band.c5 && !!band.c7 && Math.abs(band.konferens[0].x - band.c5.x) < 2 && Math.abs(band.konferens[0].x + band.konferens[0].w - band.c7.r) < 2, `${namn}: konferensen 5-7 oktober är ${band.konferens.length} bitar ${JSON.stringify(band.konferens)}, väntat ETT band från den 5:e till den 7:e (${JSON.stringify(band.c5)}, ${JSON.stringify(band.c7)}).`);
        krav(band.semester.length === 2, `${namn}: semestern 9-13 oktober är ${band.semester.length} bitar, väntat 2 (en per vecka, SS getSpanSegmentsForWeekRow).`);
        krav(band.heldag.length === 1, `${namn}: heldagen 1 oktober är ${band.heldag.length} bitar, väntat 1 (heldag ritas som band).`);
        krav(band.konferens.length === 1 && band.siffra5 !== null && band.konferens[0].y >= band.siffra5 - 0.5, `${namn}: bandet börjar på y=${band.konferens[0] && band.konferens[0].y}, siffran slutar ${band.siffra5}: bandet ska ligga under siffran (SS #999).`);
      }

    } catch (e) {
      krav(false, `${namn} (d): delen avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
      await page.keyboard.press("Escape").catch(() => {});
    }

    // (e) Idag-knappen
    try {
      const idagKnapp = async () => page.evaluate(() => { const x = [...document.querySelectorAll("button")].find((k) => /Idag$/.test((k.textContent || "").trim()) && k.closest("[data-ops-kalender]")); return x ? (x.textContent || "").trim() : null; });
      await page.evaluate(() => { /** @type {HTMLElement} */ (document.querySelector("[data-kalender-rulle]")).scrollTop = 0; });
      await page.waitForTimeout(250);
      const uppe = await idagKnapp();
      // ⛔ 0.37.0: knappen står MITT över rutnätet och är mörk, som SS-appens "Idag"-piller (0.36.0: nere till höger).
      const idagLage = await page.evaluate(() => {
        const k = document.querySelector("[data-idagknapp]");
        const rulle = document.querySelector("[data-kalender-rulle]");
        if (!k || !rulle) return null;
        const a = k.getBoundingClientRect(), r = rulle.getBoundingClientRect();
        const m = getComputedStyle(k).backgroundColor.match(/[\d.]+/g);
        return { fran: Math.abs(a.x + a.width / 2 - (r.x + r.width / 2)), ljus: m ? (0.2126 * +m[0] + 0.7152 * +m[1] + 0.0722 * +m[2]) / 255 : 1 };
      });
      matt.push(`${namn}: Idag-knappen ${JSON.stringify(idagLage)}`);
      krav(!!idagLage && idagLage.fran <= 1 && idagLage.ljus < 0.35, `${namn}: Idag-knappen ${JSON.stringify(idagLage)}, väntat mörk och centrerad över rutnätet (SS-appen; 0.36.0 hade den i hörnet).`);
      await page.evaluate(() => { const r = /** @type {HTMLElement} */ (document.querySelector("[data-kalender-rulle]")); r.scrollTop = r.scrollHeight; });
      await page.waitForTimeout(250);
      const nere = await idagKnapp();
      matt.push(`${namn}: Idag-knappen rullad överst "${uppe}", rullad nederst "${nere}"`);
      krav(uppe === "↓Idag" && nere === "↑Idag", `${namn}: Idag-knappen är "${uppe}" överst och "${nere}" nederst, väntat "↓Idag" och "↑Idag" (pilen pekar mot idag).`);
      await page.getByRole("button", { name: /Idag$/ }).last().click();
      await page.waitForTimeout(700);

    } catch (e) {
      krav(false, `${namn} (e): delen avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
      await page.keyboard.press("Escape").catch(() => {});
    }

    // (f) veckonummer
    try {
      const fore = await page.evaluate(() => document.querySelectorAll("[data-veckonummer]").length);
      await page.getByRole("button", { name: "Veckonummer" }).click();
      await page.waitForTimeout(150);
      const vecka = await page.evaluate(() => ({ antal: document.querySelectorAll("[data-veckonummer]").length, sparat: /** @type {any} */ (window).__lagring["ops-kalender-veckonummer"] }));
      matt.push(`${namn}: veckonummer före ${fore}, efter ${vecka.antal}, sparat "${vecka.sparat}"`);
      krav(fore === 0 && vecka.antal >= 100 && vecka.sparat === "1", `${namn}: veckonummer ${fore} före och ${vecka.antal} efter, sparat "${vecka.sparat}", väntat 0, minst 100 och "1" (per enhet).`);
      // ⛔ Oktober 2027 har också en vecka 41, så knappen väljs i raden med den 5 oktober 2026.
      await page.locator('[data-veckorad]:has([data-cal-day="2026-10-05"]) [data-veckonummer]').click();
      const v41 = await page.evaluate(() => [...document.querySelectorAll("[data-dagpanel] .rounded-full.animate-svep")].length);
      krav(v41 === 7, `${namn}: "Välj vecka 41" gav ${v41} datumpiller, väntat 7 (5 till 11 oktober).`);
      await page.getByRole("button", { name: /^Stäng/ }).first().click();
      await page.getByRole("button", { name: "Veckonummer" }).click();
      krav(await page.evaluate(() => /** @type {any} */ (window).__lagring["ops-kalender-veckonummer"]) === "0", `${namn}: veckonumren stängdes av men det sparade värdet ändrades inte.`);

    } catch (e) {
      krav(false, `${namn} (f): delen avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
      await page.keyboard.press("Escape").catch(() => {});
    }

    // (g) dra-markering
    try {
      await page.locator('[data-cal-day="2026-10-14"]').scrollIntoViewIfNeeded();
      const c14 = await b('[data-cal-day="2026-10-14"]');
      const c16 = await b('[data-cal-day="2026-10-16"]');
      if (c14 && c16) {
        await page.mouse.move(c14.x + c14.w / 2, c14.y + c14.h / 2);
        await page.mouse.down();
        await page.mouse.move(c14.x + c14.w / 2 + 6, c14.y + c14.h / 2, { steps: 2 });
        await page.mouse.move(c16.x + c16.w / 2, c16.y + c16.h / 2, { steps: 6 });
        await page.mouse.up();
        await page.waitForTimeout(200);
      }
      const drag = await page.evaluate(() => ({ region: (document.querySelector("[data-dagpanel]") || { getAttribute: () => null }).getAttribute("aria-label"), kryss: document.querySelectorAll('[data-dagpanel] button[aria-label^="Ta bort"]').length }));
      matt.push(`${namn}: drag 14 till 16 oktober gav "${drag.region}" med ${drag.kryss} kryss`);
      krav(drag.region === "Poster för 3 valda dagar" && drag.kryss === 3, `${namn}: draget gav "${drag.region}" med ${drag.kryss} kryss, väntat "Poster för 3 valda dagar" och 3 (SS 12 px tröskel, handleCalRangeSweepSelect).`);
      /*
       * ⛔ bolag-ops#556: pillernas BOXAR får inte överlappa. Kryssens absolutplacerade
       * träffytor får sticka utanför (SS top/right -8), men själva bubblorna ska wrappa
       * och behålla sin bredd (`shrink-0`). Mätt på den visuella ytan utan kryssknappen.
       */
      const overlap = await page.evaluate(() => {
        const piller = [...document.querySelectorAll("[data-datumpiller]")].map((el) => {
          const r = el.getBoundingClientRect();
          return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width };
        });
        let par = 0;
        for (let i = 0; i < piller.length; i += 1) {
          for (let j = i + 1; j < piller.length; j += 1) {
            const a = piller[i];
            const b = piller[j];
            const overlapX = a.l < b.r && a.r > b.l;
            const overlapY = a.t < b.b && a.b > b.t;
            if (overlapX && overlapY) par += 1;
          }
        }
        const smal = piller.filter((p) => p.w < 72).length;
        return { antal: piller.length, par, smal, bredder: piller.map((p) => Math.round(p.w)) };
      });
      matt.push(`${namn}: datumpiller overlap ${JSON.stringify(overlap)}`);
      krav(overlap.antal === 3 && overlap.par === 0 && overlap.smal === 0, `${namn}: datumpiller ${JSON.stringify(overlap)}, väntat 3 utan överlapp och ingen smalare än 72 px (bolag-ops#556).`);
      await page.getByRole("button", { name: "Ta bort 15 oktober" }).click();
      krav((await page.evaluate(() => document.querySelectorAll('[data-dagpanel] button[aria-label^="Ta bort"]').length)) === 2, `${namn}: ett kryss tog inte bort en dag.`);

    } catch (e) {
      krav(false, `${namn} (g): delen avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
      await page.keyboard.press("Escape").catch(() => {});
    }

    // (h) dagpanelen
    try {
      const rulleFore = await page.evaluate(() => /** @type {HTMLElement} */ (document.querySelector("[data-kalender-rulle]")).getBoundingClientRect().height);
      // ⛔ Den 12 oktober läggs till, så att panelen får fler kort än bubblans tak rymmer: annars mäts taket aldrig.
      await page.locator('[data-cal-day="2026-10-12"]').scrollIntoViewIfNeeded();
      // ⛔ 0.37.0: rutan läggs så att dess MITT ligger strax ovanför panelens topp och underkanten under den. Då går den att
      // trycka på (Playwright rullar annars själv en täckt ruta fri, och provet blev grönt utan rättelsen: mätt), men en tredjedel
      // av den täcks av panelen, som i CP:s bild. Utan rullningen efter valet står den kvar så.
      if (telefon) {
        await page.evaluate(() => {
          const r = /** @type {HTMLElement} */ (document.querySelector("[data-kalender-rulle]"));
          const c = /** @type {HTMLElement} */ (document.querySelector('[data-cal-day="2026-10-12"]'));
          const pl = document.querySelector("[data-dagpanel-plats]");
          const grans = pl ? pl.getBoundingClientRect().top : r.getBoundingClientRect().bottom;
          const cr = c.getBoundingClientRect();
          r.scrollTop += cr.top + cr.height * 0.6 - grans;
        });
        await page.waitForTimeout(150);
      }
      await page.locator('[data-cal-day="2026-10-12"]').click();
      await page.waitForTimeout(300);
      const p = await page.evaluate(() => {
        const r = (/** @type {string} */ v) => { const e = document.querySelector(v); if (!e) return null; const x = e.getBoundingClientRect(); return { x: x.x, y: x.y, w: x.width, h: x.height, bottom: x.bottom, right: x.right }; };
        const rulle = /** @type {HTMLElement} */ (document.querySelector("[data-kalender-rulle]"));
        const st = getComputedStyle(rulle);
        const pl = /** @type {HTMLElement | null} */ (document.querySelector("[data-dagpanel-plats]"));
        const sek = /** @type {HTMLElement | null} */ (document.querySelector("[data-dagpanel]"));
        const pr = /** @type {HTMLElement | null} */ (document.querySelector("[data-postrulle]"));
        const vald = /** @type {HTMLElement | null} */ (document.querySelector('[data-cal-day="2026-10-12"]'));
        const ljus = (/** @type {string} */ c) => { const m = c.match(/[\d.]+/g); return m ? (0.2126 * +m[0] + 0.7152 * +m[1] + 0.0722 * +m[2]) / 255 : 1; };
        const vs = vald ? getComputedStyle(vald) : null;
        const vn = vald ? vald.querySelector("[data-dagnummer]") : null;
        return {
          rulle: r("[data-kalender-rulle]"), plats: r("[data-dagpanel-plats]"), nav: r('nav[aria-label="Snabbnavigering"]'), antal: r("[data-dagantal]"),
          skapa: !!document.querySelector('[data-dagpanel] button[aria-label^="Skapa"]'),
          yta: parseFloat(st.getPropertyValue("--fullhojd-botten")) - parseFloat(st.getPropertyValue("--fullhojd-topp")),
          platsYta: pl ? [getComputedStyle(pl).backgroundColor, getComputedStyle(pl).borderTopWidth] : null,
          sekYta: sek ? [getComputedStyle(sek).backgroundColor, getComputedStyle(sek).borderTopWidth] : null,
          bubblor: document.querySelectorAll("[data-postbubbla]").length,
          postrulle: pr ? { ch: pr.clientHeight, sh: pr.scrollHeight } : null,
          rubriker: [...document.querySelectorAll("[data-postrubrik]")].map((x) => x.getAttribute("data-postrubrik")),
          lager: document.querySelectorAll("[data-lagerbubbla]").length,
          vald: vs && vn ? { radie: parseFloat(vs.borderTopLeftRadius), bg: ljus(vs.backgroundColor), text: ljus(getComputedStyle(vn).color) } : null,
        };
      });
      matt.push(`${namn}: rullytan ${JSON.stringify(p.rulle)} (före ${rulleFore}), panelen ${JSON.stringify(p.plats)} yta ${JSON.stringify(p.platsYta)}, bubblan ${JSON.stringify(p.postrulle)}, rubriker ${JSON.stringify(p.rubriker)}, vald ${JSON.stringify(p.vald)}, bottenraden ${p.nav && p.nav.y}, ytan ${p.yta}`);
      krav(!!p.antal && p.skapa, `${namn}: dagpanelen saknar ${p.antal ? "" : "antalet "}${p.skapa ? "" : "skapa-rutan"} (SS CalendarView :302-321).`);
      krav(!!p.vald && Math.abs(p.vald.radie - 16) < 0.5 && p.vald.bg < 0.35 && p.vald.text > 0.6, `${namn}: den valda rutan ${JSON.stringify(p.vald)}, väntat rundning 16 (--radius-lg, SS radius.lg), mörk yta och ljus siffra (CP 2026-09-30 mot SS-appen).`);
      krav(p.bubblor === 1 && !!p.postrulle && p.rubriker.join() === "Grupp,Mina", `${namn}: ${p.bubblor} postbubblor med rubrikerna ${JSON.stringify(p.rubriker)}, väntat EN bubbla med Grupp och Mina (SS-appen, båda slagen finns de valda dagarna).`);
      krav(p.lager === 0, `${namn}: lagrens bubbla ritas (${p.lager}) fast inget lager skickades, väntat ingen (plats för F6, ritas bara med innehåll).`);
      if (p.rulle && p.plats) {
        if (telefon) {
          const genom = (/** @type {string[] | null} */ y) => !!y && (/^rgba\([^)]*,\s*0\)$/.test(y[0]) || y[0] === "transparent") && parseFloat(y[1]) === 0;
          krav(genom(p.platsYta) && genom(p.sekYta), `${namn}: panelens yta ${JSON.stringify(p.platsYta)} och ${JSON.stringify(p.sekYta)}, väntat genomskinlig och utan kant: bubblorna flyter över rutnätet (CP 2026-09-30, SS-appen).`);
          krav(p.plats.y < p.rulle.bottom - 40, `${namn}: panelen börjar ${p.plats.y}, rullytan slutar ${p.rulle.bottom}: panelen ska ligga ÖVER rutnätets nedre del, inte under det (0.36.0 staplade den under).`);
          krav(Math.abs(p.rulle.h - rulleFore) <= 1, `${namn}: rullytan var ${rulleFore} px och är ${p.rulle.h} med panelen öppen, väntat samma: panelen flyter och tar ingen plats från rutnätet.`);
          // ⛔ 0.37.0 (CP 2026-09-30, SS-appen, `ss-dagpanel-en-dag-390-cp.png`): den valda veckan rullas upp OVANFÖR panelen. Före
          // rättelsen hamnade den valda rutan under chipraden. Rullningen är mjuk, så vi väntar in den. Mäts mot panelens toppkant.
          await page.waitForTimeout(900);
          const ovan = await page.evaluate(() => {
            const v = document.querySelector('[data-cal-day="2026-10-12"]');
            const pl = document.querySelector("[data-dagpanel-plats]");
            if (!v || !pl) return null;
            return { rutansUnderkant: v.getBoundingClientRect().bottom, rutansTopp: v.getBoundingClientRect().top, panelensTopp: pl.getBoundingClientRect().top };
          });
          matt.push(`${namn}: vald ruta ${JSON.stringify(ovan)}`);
          krav(!!ovan && ovan.rutansUnderkant <= ovan.panelensTopp + 0.5 && ovan.rutansTopp >= 0, `${namn}: den valda rutans underkant är ${ovan && ovan.rutansUnderkant} och panelens topp ${ovan && ovan.panelensTopp}, väntat rutan helt ovanför panelen (SS-appen rullar den valda veckan upp ovanför panelen).`);
          krav(p.plats.h <= p.yta * 0.75 + 1.5, `${namn}: panelen är ${p.plats.h} px, taket är 75 procent av ${p.yta} = ${(p.yta * 0.75).toFixed(0)} (0.53.0, var 45).`);
          krav(!!p.postrulle && p.postrulle.ch <= 140.5 && p.postrulle.sh > p.postrulle.ch, `${namn}: bubblans rullyta ${JSON.stringify(p.postrulle)}, väntat högst 140 px hög och rullbar (SS abEventsScroll maxHeight 140). Golv: fyra poster ska inte rymmas.`);
          // ⛔ 0.37.1: SLAGETS IKON STÅR FÖRE TITELN PÅ BUBBLANS RAD. 0.37.0 lovade den i sin CHANGELOG men ritade den aldrig här
          // (CP 2026-09-30: "Jag gillar ikonerna för typerna hos oss"). Mäts i den byggda appen: en svg i raden för Styrelsemöte,
          // den står till vänster om titeln på samma rad, titeln är hel (inte trunkerad) och raden sticker inte ut ur bubblan.
          const ikonrad = await page.evaluate(() => {
            const rad = [...document.querySelectorAll("[data-postbubbla] [data-postrad]")].find((x) => (x.textContent || "").includes("Styrelsemöte"));
            if (!rad) return null;
            const ikon = rad.querySelector("[data-postikon]");
            const svg = ikon ? ikon.querySelector("svg") : null;
            const titel = [...rad.querySelectorAll("span")].find((x) => (x.textContent || "").trim() === "Styrelsemöte" && !x.querySelector("svg"));
            if (!ikon || !svg || !titel) return { svg: !!svg, titel: !!titel };
            const i = ikon.getBoundingClientRect();
            const t = titel.getBoundingClientRect();
            const bub = /** @type {Element} */ (document.querySelector("[data-postbubbla]")).getBoundingClientRect();
            return { svg: true, titel: true, ikonB: i.width, ikonH: i.height, ikonRight: i.right, titelLeft: t.left, titelRight: t.right, titelH: t.height, ikonMittY: i.top + i.height / 2, titelTopp: t.top, titelBotten: t.bottom, trunkerad: /** @type {HTMLElement} */ (titel).scrollWidth > /** @type {HTMLElement} */ (titel).clientWidth + 1, bubblaRight: bub.right, dolt: ikon.getAttribute("aria-hidden") };
          });
          if (bildmapp) await page.locator("[data-postbubbla]").screenshot({ path: path.join(bildmapp, `kalender-bubbla-ikon-${vp.width}.png`) });
          matt.push(`${namn}: bubblans rad Styrelsemöte med ikon ${JSON.stringify(ikonrad)}`);
          krav(!!ikonrad && ikonrad.svg === true && ikonrad.titel === true, `${namn}: bubblans rad för Styrelsemöte har ${ikonrad && ikonrad.svg ? "" : "ingen ikon (svg) "}${ikonrad && ikonrad.titel ? "" : "ingen titel"} (${JSON.stringify(ikonrad)}), väntat slagets ikon före titeln (CP 2026-09-30: "Jag gillar ikonerna för typerna hos oss").`);
          if (ikonrad && ikonrad.svg && ikonrad.titel) {
            krav(ikonrad.ikonRight <= ikonrad.titelLeft + 0.5 && ikonrad.ikonMittY >= ikonrad.titelTopp - 0.5 && ikonrad.ikonMittY <= ikonrad.titelBotten + 0.5, `${namn}: ikonen slutar ${ikonrad.ikonRight} och titeln börjar ${ikonrad.titelLeft}, ikonens mitt ${ikonrad.ikonMittY} mot titelns ${ikonrad.titelTopp} till ${ikonrad.titelBotten}, väntat ikonen till vänster om titeln på samma rad.`);
            krav(!ikonrad.trunkerad && ikonrad.titelH <= 26 && ikonrad.titelRight <= ikonrad.bubblaRight + 0.5 && ikonrad.ikonB >= 12 && ikonrad.ikonB <= 20 && ikonrad.dolt === "true", `${namn}: titeln är ${ikonrad.titelH} px hög, trunkerad ${ikonrad.trunkerad}, slutar ${ikonrad.titelRight} (bubblan ${ikonrad.bubblaRight}), ikonen ${ikonrad.ikonB} px bred och aria-hidden ${ikonrad.dolt}, väntat en rad utan trunkering, ikon 12 till 20 px och dold för läsaren.`);
          }
          // Bubblan rullar, kalendern bakom står still.
          // ⛔ "Sidan bakom" är varje rullyta utom bubblan: kalenderns rulle, dagpanelens plats och dokumentet. Bara rullen hade
          // missat en kedja till dokumentet, eftersom rullen inte är bubblans förälder.
          const rullat = () => page.evaluate(() => [...document.querySelectorAll("*")].filter((x) => !x.hasAttribute("data-postrulle")).reduce((n, x) => n + x.scrollTop, 0) + scrollY);
          const fore = await rullat();
          const pb = await b("[data-postrulle]");
          if (pb) {
            await page.mouse.move(pb.x + pb.w / 2, pb.y + pb.h / 2);
            for (let i = 0; i < 4; i += 1) { await page.mouse.wheel(0, 200); await page.waitForTimeout(80); }
            await page.waitForTimeout(250);
          }
          const efter = { kal: await rullat(), bubbla: await page.evaluate(() => (/** @type {HTMLElement | null} */ (document.querySelector("[data-postrulle]")) || { scrollTop: 0 }).scrollTop) };
          matt.push(`${namn}: hjulet i bubblan: bubblan ${efter.bubbla} px, övriga rullytor ${fore} till ${efter.kal}`);
          krav(efter.bubbla > 0 && Math.abs(efter.kal - fore) < 1, `${namn}: efter hjulet i bubblan rullade bubblan ${efter.bubbla} px och sidan bakom (alla andra rullytor) från ${fore} till ${efter.kal}, väntat att bara bubblan rullar (overscroll-contain).`);
          if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `kalender-bubbla-${vp.width}.png`) });
        } else {
          krav(p.plats.x >= p.rulle.right - 0.5 && Math.abs(p.plats.w - 360) < 1, `${namn}: panelen ${JSON.stringify(p.plats)} ska vara en kolumn på 360 px till höger om rutnätet (${p.rulle.right}).`);
        }
      }
      if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `kalender-panel-${vp.width}.png`) });
      if (telefon) {
        // ⛔ 0.53.0 (CP 2026-10-04, skärmbild från telefonen): "När datum bubblorna i kalendern blir två rader så får det inte
        // plats i den allokerade rutan, storleken måste anpassas till vad som är i." Med tre valda dagar bryter pillren rad
        // vid 390 px. Golvet är just det, två rader; utan det mäter kravet en panel som aldrig behövde växa.
        const vaxer = await page.evaluate(() => {
          const pl = /** @type {HTMLElement | null} */ (document.querySelector("[data-dagpanel-plats]"));
          const rad = document.querySelector("[data-datumpiller-rad]");
          const rader = rad ? new Set([...rad.children].map((c) => Math.round(c.getBoundingClientRect().top))).size : 0;
          // Krysset får inte täcka datumet: textens högerkant mot märkets vänsterkant, för varje piller.
          const tacker = [...document.querySelectorAll("[data-datumpiller]")].map((pill) => {
            const t = [...pill.childNodes].find((n) => n.nodeType === 3);
            const m = pill.querySelector("button > span");
            if (!t || !m) return null;
            const r = document.createRange();
            r.selectNodeContents(t);
            return Math.round(r.getBoundingClientRect().right - m.getBoundingClientRect().left);
          });
          return pl ? { rader, ch: pl.clientHeight, sh: pl.scrollHeight, tacker } : null;
        });
        matt.push(`${namn}: dagpanelen med tre dagar ${JSON.stringify(vaxer)}`);
        if (vaxer && vaxer.rader >= 2) {
          krav(vaxer.tacker.length >= 3 && vaxer.tacker.every((x) => x !== null && x <= 0), `${namn}: krysset täcker datumet i pillren, textens högerkant minus märkets vänsterkant ${JSON.stringify(vaxer.tacker)} px, väntat högst 0 i alla tre (CP:s skärmbild 2026-10-04, "12 oktobe").`);
          krav(vaxer.sh <= vaxer.ch + 1, `${namn}: dagpanelen rullar invändigt (${vaxer.sh} px innehåll i ${vaxer.ch} px) med ${vaxer.rader} rader datumpiller, väntat att den växer med sitt innehåll (CP 2026-10-04).`);
        } else if (vp.width <= 400) {
          krav(false, `${namn}: datumpillren bröt inte rad (${JSON.stringify(vaxer)}), så kravet att panelen växer mäter ingenting här. Golvet är två rader vid 390 px.`);
        }
      }
      await page.locator('[data-dagpanel] button[aria-label^="Skapa"]').click();
      const skapat = await page.evaluate(() => JSON.stringify(/** @type {any} */ (window).__skapat.at(-1)));
      krav(skapat === JSON.stringify(["2026-10-12", "2026-10-14", "2026-10-16"]), `${namn}: skapa-rutan gav ${skapat}, väntat de valda dagarna ["2026-10-12","2026-10-14","2026-10-16"].`);
      await page.getByRole("button", { name: /^Stäng 3 dagar/ }).click();

    } catch (e) {
      krav(false, `${namn} (h): delen avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
      await page.keyboard.press("Escape").catch(() => {});
    }

    // (i) kalenderfiltret och snabbtitten
    try {
      await page.getByRole("button", { name: /^Kalendrar:/ }).click();
      const meny = await page.evaluate(() => (document.querySelector("[data-radix-popper-content-wrapper]") || { textContent: "" }).textContent || "");
      // ⛔ 0.37.0 (#179 F2): raden "Hantera kalendrar kommer i nästa steg" är ersatt av en knapp. Att den öppnar hanteringen
      // mäts i avsnitt 31 (g), här bara att den står i menyn och att löftet om nästa steg är borta.
      const hanteraKnapp = await page.evaluate(() => [...document.querySelectorAll("[data-radix-popper-content-wrapper] button")].some((b) => (b.textContent || "").trim() === "Hantera kalendrar"));
      krav(/Alla kalendrar/.test(meny) && /Gruppens kalendrar/.test(meny) && /Styrelsen/.test(meny) && /Mina kalendrar/.test(meny) && /Privat/.test(meny) && hanteraKnapp && !/kommer i nästa steg/.test(meny), `${namn}: kalendermenyn säger "${meny.slice(0, 160)}" (knappen Hantera kalendrar ${hanteraKnapp ? "finns" : "saknas"}), väntat Alla kalendrar, gruppens (Styrelsen), mina (Privat) och knappen Hantera kalendrar, utan "kommer i nästa steg".`);
      if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `kalender-kalendrar-${vp.width}.png`) });
      await page.locator("[data-radix-popper-content-wrapper] button", { hasText: "Styrelsen" }).click();
      await page.keyboard.press("Escape");
      await page.waitForTimeout(150);
      const tolv = await page.evaluate(() => (document.querySelector('[data-cal-day="2026-10-12"]') || { getAttribute: () => "" }).getAttribute("aria-label"));
      krav(tolv === "12, 2 poster", `${namn}: med bara Styrelsen vald heter den 12 oktober "${tolv}", väntat "12, 2 poster" (tåget i Resor och semestern i Privat dolda).`);
      const cell12 = await b('[data-cal-day="2026-10-12"]');
      if (cell12) {
        if (telefon) {
          await page.mouse.move(cell12.x + cell12.w / 2, cell12.y + 12);
          await page.mouse.down();
          await page.waitForTimeout(600);
          await page.mouse.up();
        } else {
          await page.mouse.click(cell12.x + cell12.w / 2, cell12.y + 12, { button: "right" });
        }
        await page.waitForTimeout(150);
      }
      const titt = await page.evaluate(() => {
        const t = document.querySelector("[data-snabbtitt]");
        if (!t) return null;
        const r = t.getBoundingClientRect();
        return { rader: [...t.querySelectorAll("[data-titt-rad]")].map((x) => x.getAttribute("data-titt-rad")), dold: /Dold/.test(t.textContent || ""), inom: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, urval: !!document.querySelector("[data-dagpanel]") };
      });
      matt.push(`${namn}: snabbtitten ${JSON.stringify(titt)}`);
      krav(!!titt && titt.rader.length === 4 && titt.rader.filter((r) => r === "dold").length === 2 && titt.dold && titt.inom, `${namn}: snabbtitten ${JSON.stringify(titt)}, väntat fyra rader varav två märkta Dold, inom fönstret (SS CalendarDayPeekPopover).`);
      krav(!!titt && !titt.urval, `${namn}: snabbtitten ändrade urvalet (en dagpanel öppnades).`);
      if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `kalender-snabbtitt-${vp.width}.png`) });
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: /^Kalendrar:/ }).click();
      await page.locator("[data-radix-popper-content-wrapper] button", { hasText: "Alla kalendrar" }).click();
      await page.keyboard.press("Escape");

    } catch (e) {
      krav(false, `${namn} (i): delen avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
      await page.keyboard.press("Escape").catch(() => {});
    }

    // (j) sök
    try {
      await page.getByRole("button", { name: "Sök i kalendern" }).click();
      await page.getByRole("searchbox", { name: "Sök i kalendern" }).fill("visby");
      await page.waitForTimeout(150);
      const sok = await page.evaluate(() => ({ miss: document.querySelectorAll('[data-nedtonad="sok"]').length, traff: [...document.querySelectorAll("[data-cal-day]")].filter((d) => !d.querySelector("[data-nedtonad]")).length, antal: (document.querySelector("[data-sok-antal]") || { textContent: "" }).textContent }));
      matt.push(`${namn}: sökningen "visby" ${JSON.stringify(sok)}`);
      krav(sok.traff === 3 && sok.miss >= 700 && sok.antal === "3 dagar", `${namn}: sökningen gav ${JSON.stringify(sok)}, väntat 3 dagar utan nedtoning (5-7 oktober), resten nedtonade, och "3 dagar" utskrivet.`);
      if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `kalender-sok-${vp.width}.png`) });

    } catch (e) {
      krav(false, `${namn} (j): delen avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
      await page.keyboard.press("Escape").catch(() => {});
    }

    // (k) plats för F6: ton och hörnmärken den 14 oktober
    try {
      await page.locator('[data-cal-day="2026-10-14"]').scrollIntoViewIfNeeded();
      const d = await page.evaluate(() => {
        const c = /** @type {HTMLElement | null} */ (document.querySelector('[data-cal-day="2026-10-14"]'));
        if (!c) return null;
        const r = c.getBoundingClientRect();
        const ton = c.querySelector("[data-dagton]");
        return {
          namn: c.getAttribute("aria-label"),
          ton: ton ? getComputedStyle(ton).backgroundColor : null,
          marken: [...c.querySelectorAll("[data-hornmarke]")].map((m) => { const x = m.getBoundingClientRect(); return { id: m.getAttribute("data-hornmarke"), topp: x.top - r.top, hoger: x.right - r.right, vanster: x.left - r.left, botten: x.bottom - r.bottom, w: x.width }; }),
        };
      });
      matt.push(`${namn}: den 14 oktober ${JSON.stringify(d)}`);
      krav(!!d && d.marken.length === 2, `${namn}: den 14 oktober har ${d ? d.marken.length : 0} hörnmärken, väntat 2 (golv).`);
      krav(!!d && !!d.ton && !/^rgba\([^)]*,\s*0\)$/.test(d.ton), `${namn}: den 14 oktober har tonen ${d && d.ton}, väntat en synlig ton (SS lagrets tint).`);
      krav(!!d && d.marken.every((m) => m.topp >= -6.5 && m.hoger <= 6.5 && m.vanster >= 0 && m.botten <= 0), `${namn}: hörnmärkena ${JSON.stringify(d && d.marken)}, väntat inom rutan och högst 6 px utanför dess övre högra hörn (SS top: -6, right: -6).`);
      krav(!!d && /2 borta/.test(d.namn || "") && /1 lager/.test(d.namn || ""), `${namn}: rutans namn är "${d && d.namn}", väntat att märkenas ord (2 borta, 1 lager) läses upp.`);
    } catch (e) {
      krav(false, `${namn} (k): delen avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
    }

    krav((await over()) <= 0, `${namn}: sidan flödar över ${await over()} px horisontellt.`);
  } catch (e) {
    krav(false, `${namn}: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
  }
  await context.close();
}

// ══ 31. HANTERA KALENDRAR MOT SS PersonalCalendarsInlineSection VID 390 OCH 1280 PX (0.37.0, #179 F2) ═══════════════════
// CP 2026-09-29 i #179: "Vidare kunna skapa olika kalendrar". Förebilden är SS `components/PersonalCalendarsInlineSection.jsx` i
// kalenderhubben: ett kort per sektion, rubrik och hjälptext, en rad per kalender med märke, namn och "Förvald" under, och
// "+ Ny kalender" som fäller ut redigeraren med namn, färg, ikon, Förvald och två lika breda knappar. Scenen `kalendrar`.
// Krav, varje del för sig:
//   (a) Två kort, gruppens och mina, med rundning minst 12 och en kant; en rad per valbar kalender med märket 24 px,
//       knapparna 44 px under 768 och 32 från, allt inom kortet.
//   (b) "Förvald" under den förvalda i båda korten, och arkiverade under en egen rubrik.
//   (c) Ny kalender: redigeraren har namn, sex färger, åtta ikoner och Förvald; Skapa är avstängd utan namn; Avbryt och Skapa
//       är lika breda; efter Skapa står den nya kalendern i listan och sparningen fick id ur namnet.
//   (d) Flytta upp: Resor står först efteråt, och sparningen fick två rader.
//   (e) Arkivera: kalendern försvinner ur listan och räknas under Arkiverade.
//   (f) Ingen horisontell överflödning.
//   (g) I kalendern (scenen `kalender`) öppnar "Hantera kalendrar" hanteringen.
// Golv: minst 4 valbara rader, 6 färger och 8 ikoner mätta.
for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  const namn = `hantera kalendrar ${vp.width}`;
  const telefon = vp.width < 768;
  const { page, context } = await oppna("kalendrar", vp);
  try {
    await page.waitForSelector("[data-ops-kalendrar]", { timeout: 4000 });
    const over = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    // (a)
    try {
      const a = await page.evaluate(() => {
        const kort = [...document.querySelectorAll("[data-kalendersektion]")].map((k) => {
          const cs = getComputedStyle(k);
          const r = k.getBoundingClientRect();
          const rader = [...k.querySelectorAll("[data-kalenderrad]")].map((rad) => {
            const rr = rad.getBoundingClientRect();
            const marke = /** @type {HTMLElement} */ (rad.firstElementChild).getBoundingClientRect();
            const knappar = [...rad.querySelectorAll("button")].map((b) => { const br = b.getBoundingClientRect(); return { h: br.height, w: br.width, hoger: br.right }; });
            return { marke: Math.round(marke.width), knappar, hoger: rr.right };
          });
          return { slag: k.getAttribute("data-kalendersektion"), rubrik: (k.querySelector("h3") || { textContent: "" }).textContent, radie: parseFloat(cs.borderTopLeftRadius), kant: parseFloat(cs.borderTopWidth), hoger: r.right, rader };
        });
        return kort;
      });
      const rader = a.flatMap((k) => k.rader);
      matt.push(`${namn}: korten ${a.map((k) => `${k.rubrik} (${k.rader.length} rader, rundning ${k.radie}, kant ${k.kant})`).join(", ")}, knapparna ${JSON.stringify([...new Set(rader.flatMap((r) => r.knappar.map((b) => b.h)))])}`);
      krav(a.length === 2 && a[0].slag === "grupp" && a[1].slag === "mina", `${namn}: korten är ${JSON.stringify(a.map((k) => k.slag))}, väntat gruppens och sedan mina.`);
      krav(rader.length >= 4, `${namn}: ${rader.length} valbara rader, väntat minst 4 (golv).`);
      krav(a.every((k) => k.radie >= 12 && k.kant >= 1), `${namn}: korten har rundning ${a.map((k) => k.radie)} och kant ${a.map((k) => k.kant)}, väntat minst 12 och en kant (SS rounded border p-5).`);
      krav(rader.every((r) => r.marke === 24), `${namn}: märkena är ${JSON.stringify(rader.map((r) => r.marke))} px, väntat 24 (SS CalendarMark sizePx={24}).`);
      const vantad = telefon ? 44 : 32;
      krav(rader.every((r) => r.knappar.length === 4 && r.knappar.every((b) => Math.abs(b.h - vantad) < 0.6)), `${namn}: radernas knappar ${JSON.stringify(rader.map((r) => r.knappar.map((b) => b.h)))}, väntat fyra per rad på ${vantad} px.`);
      krav(a.every((k) => k.rader.every((r) => r.hoger <= k.hoger + 0.5 && r.knappar.every((b) => b.hoger <= r.hoger + 0.5))), `${namn}: en rad eller knapp slutar utanför sitt kort.`);
    } catch (e) {
      krav(false, `${namn} (a): delen avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
    }
    // (b)
    try {
      const b = await page.evaluate(() => ({
        forvalda: [...document.querySelectorAll("[data-kalenderrad]")].filter((r) => /Förvald/.test(r.textContent || "")).map((r) => r.getAttribute("data-kalenderrad")),
        arkiverade: (document.querySelector('[data-kalendersektion="grupp"] [data-arkiverade] summary') || { textContent: "" }).textContent,
      }));
      matt.push(`${namn}: förvalda ${JSON.stringify(b.forvalda)}, ${b.arkiverade}`);
      krav(JSON.stringify(b.forvalda) === JSON.stringify(["styrelse", "privat"]), `${namn}: "Förvald" står under ${JSON.stringify(b.forvalda)}, väntat Styrelsen och Privat.`);
      krav(b.arkiverade === "Arkiverade (1)", `${namn}: gruppens arkiverade heter "${b.arkiverade}", väntat "Arkiverade (1)".`);
      if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `kalendrar-${vp.width}.png`) });
    } catch (e) {
      krav(false, `${namn} (b): delen avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
    }
    // (c)
    try {
      const mina = page.locator('[data-kalendersektion="mina"]');
      await mina.getByRole("button", { name: "Ny kalender" }).click();
      await page.waitForTimeout(150);
      const red = await page.evaluate(() => {
        const r = document.querySelector('[data-kalendersektion="mina"] [data-kalenderredigerare]');
        if (!r) return null;
        const knapp = (/** @type {string} */ t) => [...r.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === t);
        const avbryt = knapp("Avbryt"), skapa = knapp("Skapa kalender");
        return { falt: !!r.querySelector("input"), farger: r.querySelectorAll('[aria-label="Färg"] button').length, ikoner: r.querySelectorAll('[aria-label="Ikon"] button').length, forvald: !!r.querySelector('[role="checkbox"], input[type="checkbox"]'), skapaAv: !!skapa && /** @type {HTMLButtonElement} */ (skapa).disabled, bredder: [avbryt, skapa].map((b) => (b ? Math.round(b.getBoundingClientRect().width) : 0)) };
      });
      matt.push(`${namn}: redigeraren ${JSON.stringify(red)}`);
      krav(!!red && red.falt && red.farger === 6 && red.ikoner === 8 && red.forvald, `${namn}: redigeraren ${JSON.stringify(red)}, väntat namnfält, 6 färger, 8 ikoner och Förvald (SS :181-288; golv).`);
      krav(!!red && red.skapaAv, `${namn}: Skapa kalender går att trycka utan namn.`);
      krav(!!red && red.bredder[0] > 0 && Math.abs(red.bredder[0] - red.bredder[1]) <= 1, `${namn}: Avbryt och Skapa är ${JSON.stringify(red && red.bredder)} px breda, väntat lika (SS flex-1 på båda).`);
      await mina.getByRole("textbox").fill("Resor privat");
      await mina.getByRole("button", { name: "Färg 6" }).click();
      await mina.getByRole("button", { name: "Bok" }).click();
      if (bildmapp) {
        await mina.locator("[data-kalenderredigerare]").scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(bildmapp, `kalendrar-ny-${vp.width}.png`) });
      }
      await mina.getByRole("button", { name: "Skapa kalender" }).click();
      await page.waitForTimeout(150);
      const efter = await page.evaluate(() => ({ rader: [...document.querySelectorAll('[data-kalendersektion="mina"] [data-kalenderrad]')].map((r) => r.getAttribute("data-kalenderrad")), sparat: JSON.stringify(/** @type {any} */ (window).__sparat.at(-1)) }));
      matt.push(`${namn}: efter Skapa ${JSON.stringify(efter.rader)}, sparat ${efter.sparat}`);
      krav(efter.rader.includes("resor-privat") && /"id":"resor-privat".*"farg":6.*"ikon":"bok"/.test(efter.sparat), `${namn}: efter Skapa står ${JSON.stringify(efter.rader)} och sparningen var ${efter.sparat}, väntat resor-privat med färg 6 och ikonen bok.`);
    } catch (e) {
      krav(false, `${namn} (c): delen avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
    }
    // (d)
    try {
      await page.locator('[data-kalendersektion="grupp"]').getByRole("button", { name: "Flytta upp Resor" }).click();
      await page.waitForTimeout(150);
      const d = await page.evaluate(() => ({ forst: (document.querySelector('[data-kalendersektion="grupp"] [data-kalenderrad]') || { getAttribute: () => null }).getAttribute("data-kalenderrad"), sparat: /** @type {any} */ (window).__sparat.at(-1).map((/** @type {any} */ k) => `${k.id}:${k.ordning}`) }));
      matt.push(`${namn}: efter Flytta upp ${d.forst} först, sparat ${JSON.stringify(d.sparat)}`);
      krav(d.forst === "resor" && d.sparat.length === 2, `${namn}: efter Flytta upp står ${d.forst} först och sparningen var ${JSON.stringify(d.sparat)}, väntat Resor först och två rader.`);
    } catch (e) {
      krav(false, `${namn} (d): delen avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
    }
    // (e)
    try {
      await page.locator('[data-kalendersektion="mina"]').getByRole("button", { name: "Arkivera Träning" }).click();
      await page.waitForTimeout(150);
      const e2 = await page.evaluate(() => ({ rader: [...document.querySelectorAll('[data-kalendersektion="mina"] [data-kalenderrad]')].map((r) => r.getAttribute("data-kalenderrad")), ark: (document.querySelector('[data-kalendersektion="mina"] [data-arkiverade] summary') || { textContent: "" }).textContent }));
      matt.push(`${namn}: efter Arkivera ${JSON.stringify(e2)}`);
      krav(!e2.rader.includes("traning") && e2.ark === "Arkiverade (1)", `${namn}: efter Arkivera ${JSON.stringify(e2)}, väntat Träning borta ur listan och "Arkiverade (1)".`);
    } catch (e) {
      krav(false, `${namn} (e): delen avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
    }
    krav((await over()) <= 0, `${namn}: sidan flödar över ${await over()} px horisontellt.`);
  } catch (e) {
    krav(false, `${namn}: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
  }
  await context.close();
  // (g)
  const k = await oppna("kalender", vp);
  try {
    await k.page.waitForSelector('section[aria-label="Kalender"]', { timeout: 4000 });
    await k.page.getByRole("button", { name: /^Kalendrar:/ }).click();
    await k.page.getByRole("button", { name: "Hantera kalendrar" }).click({ timeout: 2000 });
    await k.page.waitForTimeout(200);
    const g = await k.page.evaluate(() => ({ oppnad: !!document.querySelector("[data-ops-kalendrar]"), anrop: /** @type {any} */ (window).__hantera }));
    matt.push(`${namn}: Hantera kalendrar i kalendern ${JSON.stringify(g)}`);
    krav(g.oppnad && g.anrop === 1, `${namn}: Hantera kalendrar i kalendern gav ${JSON.stringify(g)}, väntat hanteringen öppen efter ett anrop.`);
  } catch (e) {
    krav(false, `${namn} (g): delen avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
  }
  await k.context.close();
}

// ══ 33. SKAPA-PANELEN LÅSER INTE NAVIGERINGEN (0.38.0, #194) ═══════════════════════════════════════════════════════════════
// CP 2026-09-30: "Nytt ärende-panelen låser all annan navigering i appen. Samma sak med Ny händelse. Topnav (Idag/Kalender/Hub) och
// övrigt går inte att använda medan panelen är uppe." Scenen `ny-handelse-nav` öppnar panelen och har en app som byter vy ur `activeHref`.
// Krav, i en riktig webbläsare (jsdom ritar ingen yta och ser inte om något ligger ovanpå):
//   1280: (a) panelen är öppen; (b) mitt i fliken Kalender ligger fliken själv (`elementFromPoint`), ingenting täcker den; (c) ett klick
//         stänger panelen och appens vy är Kalender och SYNS (inte dold); (d) adressen har ingen `skapa` kvar.
//   390:  panelen är helskärm och täcker huvudet och bottenraden med flit. Då måste vägen ut vara tydlig: Tillbaka sitter överst till
//         vänster, minst 44 px hög, och ett tryck stänger panelen och visar vyn man kom från.
// Golv: fliken Kalender finns i huvudet (1280), och Tillbaka finns (390).
for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  const namn = `skapa-panelen låser inte navigeringen ${vp.width}`;
  const telefon = vp.width < 768;
  const { page, context } = await oppna("ny-handelse-nav", vp, standardtema, 1, "g3");
  try {
    await page.waitForSelector("section[data-skapa-panel]", { timeout: 4000 });
    await page.waitForTimeout(300);
    const tillstand = () =>
      page.evaluate(() => {
        const panel = document.querySelector("section[data-skapa-panel]");
        const vy = document.querySelector("[data-vy]");
        const vr = vy ? vy.getBoundingClientRect() : null;
        return { panel: !!panel, vy: vy ? vy.getAttribute("data-vy") : null, vySyns: !!vr && vr.width > 0 && vr.height > 0, skapaIAdress: new URL(window.location.href).searchParams.has("skapa") };
      });
    const fore = await tillstand();
    if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `skapa-navigering-${vp.width}-fore.png`) });
    krav(fore.panel, `${namn}: panelen var inte öppen före klicket (golv: annars mäter provet ingenting).`);
    if (!telefon) {
      const flik = page.locator('header nav a[href="/kalender"]');
      krav((await flik.count()) === 1, `${namn}: fliken Kalender finns inte i huvudet (golv).`);
      const ligger = await page.evaluate(() => {
        const a = document.querySelector('header nav a[href="/kalender"]');
        if (!a) return null;
        const r = a.getBoundingClientRect();
        const traff = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { traffadeFliken: !!traff && (traff === a || a.contains(traff)), traff: traff ? `${traff.tagName}.${String(traff.className).slice(0, 40)}` : null };
      });
      matt.push(`${namn}: mitt på fliken Kalender ligger ${ligger?.traff}`);
      krav(!!ligger && ligger.traffadeFliken, `${namn}: mitt på fliken Kalender ligger ${ligger?.traff}, väntat fliken själv. Något ligger över navigeringen.`);
      await flik.click();
    } else {
      const tb = page.getByRole("button", { name: "Tillbaka" });
      krav((await tb.count()) >= 1, `${namn}: knappen Tillbaka finns inte (golv).`);
      const m = await tb.first().boundingBox();
      matt.push(`${namn}: Tillbaka ${JSON.stringify(m)}`);
      krav(!!m && m.height >= 44 && m.x < 60 && m.y < 120, `${namn}: Tillbaka är ${JSON.stringify(m)}, väntat minst 44 px hög och överst till vänster (den enda vägen ut i helskärm).`);
      await tb.first().click();
    }
    await page.waitForTimeout(300);
    const efter = await tillstand();
    matt.push(`${namn}: före ${JSON.stringify(fore)}, efter ${JSON.stringify(efter)}`);
    krav(!efter.panel, `${namn}: panelen står kvar efter ${telefon ? "Tillbaka" : "klicket på Kalender"}. Navigeringen är låst.`);
    krav(efter.vy === (telefon ? "/" : "/kalender") && efter.vySyns, `${namn}: appens vy är ${JSON.stringify(efter.vy)} (synlig ${efter.vySyns}), väntat ${telefon ? "/" : "/kalender"} och synlig. Adressen byttes men skärmen stod still.`);
    krav(!efter.skapaIAdress, `${namn}: ?skapa= står kvar i adressen, en omladdning öppnar panelen igen.`);
    if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `skapa-navigering-${vp.width}-efter.png`) });
  } catch (e) {
    krav(false, `${namn}: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
  }
  await context.close();
}

// ══ 32. NY HÄNDELSE MED KALENDER, KRÄV SVAR OCH DAGEN, MOT SS EventModal VID 390 OCH 1280 PX (0.37.0, #179 F3, #206) ════════
// CP 2026-09-30 i #179: "Skapa händelse, man skall kunna välja att skapa en händelse i olika kalendrar [...] om det är i
// gruppens kalender så skall vi kunna välja att händelsen skall kräva medlemmars bekräftelse". Förebilder: SS `EventModal`
// (rubrikraden och formuläret) och `PersonalCalendarEntryModal` (kalendern överst i en egen post, "blockerar tillgänglighet").
// Scenen `ny-handelse` öppnar panelen med `useOppnaSkapa()("handelse", { datum: "2026-10-12" })`, som appens kalender gör.
// Krav, varje del för sig:
//   (a) Raden "Kalender: Styrelsen" står överst i panelens innehåll, ovanför Typ och appens fält.
//   (b) #206: formuläret fick dagen, och datumfältet visar 2026-10-12.
//   (c) "Kräv svar" är en brytare, av, med 44 px träffyta under 768; ingenting om mejl står i panelen.
//   (d) Väljaren heter Kalender och har gruppens kalendrar och Mina kalendrar, Styrelsen vald, inom fönstret, och på telefon ett
//       ark som slutar vid fönstrets botten.
//   (e) Mina kalendrar: efter Privat står "Kalender: Privat", Kräv svar och Typ är borta och "Blockerar tillgänglighet" finns.
//   (f) Ingen horisontell överflödning.
// Golv: minst 3 rader i väljaren och 4 fält i formuläret mätta.
for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  const namn = `ny händelse ${vp.width}`;
  const telefon = vp.width < 768;
  const { page, context } = await oppna("ny-handelse", vp, standardtema, 1, "g3");
  try {
    await page.waitForSelector('section[data-skapa-panel]', { timeout: 4000 });
    await page.waitForTimeout(300);
    const over = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    // (a)
    try {
      const a = await page.evaluate(() => {
        const panel = /** @type {HTMLElement} */ (document.querySelector("section[data-skapa-panel]"));
        const kal = [...panel.querySelectorAll("button")].find((b) => /^Kalender:/.test(b.getAttribute("aria-label") || ""));
        const etiketter = [...panel.querySelectorAll("label")].map((l) => ({ t: (l.textContent || "").trim(), y: l.getBoundingClientRect().top }));
        return { kal: kal ? { namn: kal.getAttribute("aria-label"), y: kal.getBoundingClientRect().top } : null, etiketter };
      });
      matt.push(`${namn}: ${a.kal ? `"${a.kal.namn}" på y=${Math.round(a.kal.y)}` : "ingen kalenderrad"}, fälten ${a.etiketter.map((e) => `${e.t}@${Math.round(e.y)}`).join(", ")}`);
      krav(a.etiketter.length >= 4, `${namn}: ${a.etiketter.length} fält i formuläret, väntat minst 4 (golv).`);
      krav(!!a.kal && a.kal.namn === "Kalender: Styrelsen", `${namn}: kalenderraden är ${JSON.stringify(a.kal)}, väntat "Kalender: Styrelsen" (gruppens förvalda).`);
      krav(!!a.kal && a.etiketter.length > 0 && a.etiketter.every((e) => e.y > a.kal.y), `${namn}: kalenderraden står inte överst (${JSON.stringify(a.kal)} mot ${JSON.stringify(a.etiketter)}).`);
    } catch (e) {
      krav(false, `${namn} (a): delen avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
    }
    // (b)
    try {
      const b = await page.evaluate(() => ({ props: /** @type {any} */ (window).__formProps, falt: [...document.querySelectorAll("section[data-skapa-panel] button, section[data-skapa-panel] input")].some((x) => /2026-10-12/.test(x.textContent || "") || /** @type {HTMLInputElement} */ (x).value === "2026-10-12") }));
      matt.push(`${namn}: formuläret fick ${JSON.stringify(b.props)}, datumfältet visar dagen ${b.falt}`);
      krav(!!b.props && b.props.datum === "2026-10-12" && b.falt, `${namn}: formuläret fick datum ${JSON.stringify(b.props && b.props.datum)} och fältet visar dagen ${b.falt}, väntat 2026-10-12 (#206).`);
    } catch (e) {
      krav(false, `${namn} (b): delen avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
    }
    // (c)
    try {
      const c = await page.evaluate(() => {
        const panel = /** @type {HTMLElement} */ (document.querySelector("section[data-skapa-panel]"));
        const bry = [...panel.querySelectorAll('[role="switch"]')].map((x) => ({ namn: x.getAttribute("aria-label") || (x.closest("label") || x.parentElement || { textContent: "" }).textContent || "", pa: x.getAttribute("aria-checked") ?? String(/** @type {HTMLInputElement} */ (x).checked), h: Math.max(x.getBoundingClientRect().height, (x.closest("label") || x).getBoundingClientRect().height) }));
        return { bry, mejl: /mejl|e-post/i.test(panel.textContent || "") };
      });
      matt.push(`${namn}: brytarna ${JSON.stringify(c.bry)}, mejl i panelen ${c.mejl}`);
      const krav1 = c.bry.find((x) => /Kräv svar/.test(x.namn));
      krav(!!krav1 && krav1.pa === "false", `${namn}: Kräv svar är ${JSON.stringify(krav1)}, väntat en brytare som är av.`);
      if (telefon) krav(!!krav1 && krav1.h >= 44, `${namn}: Kräv svar har träffytan ${krav1 && krav1.h} px, väntat minst 44.`);
      krav(!c.mejl, `${namn}: panelen nämner mejl, men Skicka mejl ska inte visas förrän avsändaren finns (#180 G3).`);
      if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `ny-handelse-${vp.width}.png`) });
    } catch (e) {
      krav(false, `${namn} (c): delen avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
    }
    // (d)
    try {
      await page.getByRole("button", { name: /^Kalender:/ }).click({ timeout: 2000 });
      await page.waitForTimeout(250);
      const d = await page.evaluate(() => {
        const dlg = document.querySelector('[role="dialog"]');
        if (!dlg) return null;
        const r = dlg.getBoundingClientRect();
        return {
          rubrik: (dlg.querySelector("h2") || { textContent: "" }).textContent,
          sektioner: [...dlg.querySelectorAll("section")].map((x) => ({ namn: x.getAttribute("aria-label"), rader: [...x.querySelectorAll("button")].map((b) => ({ t: (b.textContent || "").trim(), vald: b.getAttribute("aria-pressed") })) })),
          box: { left: r.left, right: r.right, top: r.top, bottom: r.bottom },
          vh: innerHeight,
          vw: innerWidth,
        };
      });
      matt.push(`${namn}: väljaren ${JSON.stringify(d)}`);
      const rader = d ? d.sektioner.flatMap((x) => x.rader) : [];
      krav(!!d && d.rubrik === "Kalender", `${namn}: väljarens rubrik är ${JSON.stringify(d && d.rubrik)}, väntat "Kalender".`);
      krav(rader.length >= 3, `${namn}: ${rader.length} rader i väljaren, väntat minst 3 (golv).`);
      krav(!!d && JSON.stringify(d.sektioner.map((x) => x.namn)) === JSON.stringify(["Claes Philip Staiger AB: kalendrar", "Mina kalendrar"]), `${namn}: väljarens sektioner ${JSON.stringify(d && d.sektioner.map((x) => x.namn))}, väntat gruppens kalendrar och Mina kalendrar.`);
      krav(rader.filter((x) => x.vald === "true").map((x) => x.t).join() === "Styrelsen", `${namn}: vald i väljaren ${JSON.stringify(rader.filter((x) => x.vald === "true"))}, väntat Styrelsen.`);
      if (d) {
        krav(d.box.left >= -0.5 && d.box.right <= d.vw + 0.5 && d.box.top >= -0.5 && d.box.bottom <= d.vh + 0.5, `${namn}: väljaren ${JSON.stringify(d.box)} ligger utanför fönstret.`);
        if (telefon) krav(Math.abs(d.box.bottom - d.vh) <= 1, `${namn}: väljaren slutar ${d.box.bottom}, fönstret ${d.vh}: på telefon ett ark nerifrån (SS align="bottom").`);
      }
      if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `ny-handelse-valjare-${vp.width}.png`) });
      await page.locator('[role="dialog"] section[aria-label="Mina kalendrar"] button', { hasText: "Privat" }).click({ timeout: 2000 });
      await page.waitForTimeout(250);
    } catch (e) {
      krav(false, `${namn} (d): delen avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
      await page.keyboard.press("Escape").catch(() => {});
    }
    // (e)
    try {
      const e2 = await page.evaluate(() => {
        const panel = /** @type {HTMLElement} */ (document.querySelector("section[data-skapa-panel]"));
        const kal = [...panel.querySelectorAll("button")].find((b) => /^Kalender:/.test(b.getAttribute("aria-label") || ""));
        return {
          kal: kal ? kal.getAttribute("aria-label") : null,
          dialog: !!document.querySelector('[role="dialog"]'),
          krav: /Kräv svar/.test(panel.textContent || ""),
          blockerar: [...panel.querySelectorAll('[role="switch"]')].some((x) => /Blockerar tillgänglighet/.test((x.closest("label") || x.parentElement || { textContent: "" }).textContent || "") || /Blockerar/.test(x.getAttribute("aria-label") || "")),
          typ: [...panel.querySelectorAll("label")].some((l) => (l.textContent || "").trim() === "Typ"),
          props: /** @type {any} */ (window).__formProps,
        };
      });
      matt.push(`${namn}: efter Privat ${JSON.stringify(e2)}`);
      krav(e2.kal === "Kalender: Privat" && !e2.dialog, `${namn}: efter Privat är raden ${JSON.stringify(e2.kal)} och väljaren ${e2.dialog ? "öppen" : "stängd"}, väntat "Kalender: Privat" och stängd.`);
      krav(!e2.krav && e2.blockerar && !e2.typ, `${namn}: i Privat står Kräv svar ${e2.krav}, Blockerar ${e2.blockerar}, Typ ${e2.typ}, väntat bara Blockerar tillgänglighet (i en egen kalender finns inga svar och ingen typ).`);
      krav(!!e2.props && e2.props.kalender && e2.props.kalender.slag === "mina" && e2.props.typ === null, `${namn}: formuläret fick ${JSON.stringify(e2.props)}, väntat kalendern Privat (mina) och ingen typ.`);
      if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `ny-handelse-mina-${vp.width}.png`) });
    } catch (e) {
      krav(false, `${namn} (e): delen avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
    }
    krav((await over()) <= 0, `${namn}: sidan flödar över ${await over()} px horisontellt.`);
  } catch (e) {
    krav(false, `${namn}: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
  }
  await context.close();
}

// ══ 33. SVAREN OCH INKORGENS RAD MOT SS EventDetailAvailabilityListInline VID 390 OCH 1280 PX (0.37.0, #179 F3) ══════════
// Scenen `svar`: Anna tittar, Bo har svarat Kommer inte, Cecilia inget. Krav:
//   (a) Sammanställningen skriver ut alla tre delarna, också nollan: "0 kommer, 1 kommer inte, 2 har inte svarat".
//   (b) Bara Annas rad har knappar, två, 44 px under 768 och 32 från, inom raden.
//   (c) Ett tryck på Kommer ändrar sammanställningen till "1 kommer, 1 kommer inte, 1 har inte svarat" och markerar knappen.
//   (d) Inkorgens rad har Kommer och Kommer inte och ligger inom fönstret.
// Ingen horisontell överflödning. Golv: tre medlemsrader.
for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  const namn = `svaren ${vp.width}`;
  const { page, context } = await oppna("svar", vp);
  try {
    await page.waitForSelector("[data-ops-svar]", { timeout: 4000 });
    const las = () => page.evaluate(() => {
      const s = /** @type {HTMLElement} */ (document.querySelector("[data-ops-svar]"));
      const rader = [...s.querySelectorAll("[data-svarsrad]")].map((r) => {
        const rr = r.getBoundingClientRect();
        return { uid: r.getAttribute("data-svarsrad"), knappar: [...r.querySelectorAll("button")].map((b) => { const br = b.getBoundingClientRect(); return { t: (b.textContent || "").trim(), h: br.height, hoger: br.right, vald: b.getAttribute("aria-pressed") }; }), hoger: rr.right };
      });
      const rad = document.querySelector("[data-ops-svarsrad]");
      const radR = rad ? rad.getBoundingClientRect() : null;
      return { summa: (s.querySelector("[data-sammanstallning]") || { textContent: "" }).textContent, rader, inkorg: rad ? { knappar: [...rad.querySelectorAll("button")].map((b) => (b.textContent || "").trim()), hoger: radR && radR.right } : null, vw: innerWidth };
    });
    const f = await las();
    matt.push(`${namn}: "${f.summa}", rader ${JSON.stringify(f.rader.map((r) => `${r.uid}:${r.knappar.map((k) => `${k.t} ${k.h}`).join("/")}`))}, inkorgens rad ${JSON.stringify(f.inkorg)}`);
    krav(f.rader.length >= 3, `${namn}: ${f.rader.length} medlemsrader, väntat minst 3 (golv).`);
    krav(f.summa === "0 kommer, 1 kommer inte, 2 har inte svarat", `${namn}: sammanställningen är "${f.summa}", väntat "0 kommer, 1 kommer inte, 2 har inte svarat" (nollan utskriven).`);
    const vantad = vp.width < 768 ? 44 : 32;
    const anna = f.rader.find((r) => r.uid === "anna");
    krav(!!anna && anna.knappar.length === 2 && anna.knappar.every((k) => Math.abs(k.h - vantad) < 0.6 && k.hoger <= anna.hoger + 0.5), `${namn}: Annas knappar ${JSON.stringify(anna && anna.knappar)}, väntat två på ${vantad} px inom raden.`);
    // ⛔ 0.37.0 (CP 2026-09-30): det egna namnet trycktes ihop till "Ann..." av knapparna vid 390. Namnet får aldrig vara avkortat
    // (scrollWidth över clientWidth på en truncate-ruta), och vid 390 ligger knapparna under namnet.
    const namnMatt = await page.evaluate(() => {
      const r = document.querySelector('[data-svarsrad="anna"]');
      if (!r) return null;
      const n = /** @type {HTMLElement | null} */ (r.querySelector("span.truncate"));
      const k = r.querySelector("[data-svarsknappar]");
      if (!n || !k) return null;
      return { avkortat: n.scrollWidth - n.clientWidth, namnUnderkant: n.getBoundingClientRect().bottom, knapparTopp: k.getBoundingClientRect().top, text: (n.textContent || "").trim() };
    });
    matt.push(`${namn}: egna namnet ${JSON.stringify(namnMatt)}`);
    krav(!!namnMatt && namnMatt.avkortat <= 0, `${namn}: det egna namnet är avkortat ${namnMatt && namnMatt.avkortat} px (${JSON.stringify(namnMatt)}), väntat hela namnet synligt.`);
    if (vp.width < 768) krav(!!namnMatt && namnMatt.knapparTopp >= namnMatt.namnUnderkant - 0.5, `${namn}: knapparnas topp ${namnMatt && namnMatt.knapparTopp} ligger inte under namnets underkant ${namnMatt && namnMatt.namnUnderkant}, väntat knapparna under namnet på smal bredd.`);
    krav(f.rader.filter((r) => r.uid !== "anna").every((r) => r.knappar.length === 0), `${namn}: en annan medlems rad har knappar, men bara personen själv svarar.`);
    krav(!!f.inkorg && JSON.stringify(f.inkorg.knappar) === JSON.stringify(["Kommer", "Kommer inte"]) && f.inkorg.hoger <= f.vw + 0.5, `${namn}: inkorgens rad ${JSON.stringify(f.inkorg)}, väntat Kommer och Kommer inte inom fönstret.`);
    if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `svar-${vp.width}.png`) });
    await page.locator('[data-svarsrad="anna"] button', { hasText: /^Kommer$/ }).click();
    await page.waitForTimeout(150);
    const e = await las();
    const annaEfter = e.rader.find((r) => r.uid === "anna");
    krav(e.summa === "1 kommer, 1 kommer inte, 1 har inte svarat" && !!annaEfter && annaEfter.knappar[0].vald === "true", `${namn}: efter Kommer är sammanställningen "${e.summa}" och knappen ${annaEfter && annaEfter.knappar[0].vald}, väntat "1 kommer, 1 kommer inte, 1 har inte svarat" och vald.`);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    krav(over <= 0, `${namn}: sidan flödar över ${over} px horisontellt.`);
  } catch (e) {
    krav(false, `${namn}: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
  }
  await context.close();
}

// Bilderna för montaget: kalendern vid öppning och med den 12 oktober vald, utan annat tillstånd (regel 12).
// ══ 34. GRUPPANELENS NEDERKANT: SISTA RADEN GÅR ATT RULLA FRAM HELT (0.39.1, cllp/bolag-ops#497) ═══════════════════════
// CP 2026-09-30 16:58: "Bubblornas scroll kan gå ända ner, huggs av. Scolla ända ner på sidan i web samma som kalendern
// bredvid." Bubblorna är gruppmärkena i den INFÄLLDA panelen. Mätt med tolv extra grupper vid 1280x800 och 1024x768, rullad till
// botten: pluset sist i remsan var 16 px högt i stället för 40 (flexbarn krymper i en kolumn med fast höjd), och dokumentet
// rullade 865 px över en sida utan innehåll, eftersom `sr-only`-spanen på varje kort är `position: absolute` och
// panelen inte var positionerad. Krav, i båda lägena (utfälld och infälld) och båda storlekarna:
//   (a) panelen rullar (golv: scrollHeight större än clientHeight, minst 12 grupper i listan),
//   (b) rullad till botten: sista knappen har sin naturliga höjd (infälld 40 px, utfälld minst 40 px), ligger helt inom panelen
//       och minst 16 px över fönstrets underkant,
//   (c) dokumentet är inte högre än fönstret (panelen är `sticky`, sidan har inget innehåll att rulla).
// Telefon (390) saknas med flit: gruppanelen är `hidden lg:block`, och där finns bara gruppväxlarens ark (avsnitt 8).
{
  const lage = /** @type {const} */ ([["utfälld", false], ["infälld", true]]);
  for (const [lagenamn, infalld] of lage) {
    for (const vp of [{ width: 1280, height: 800 }, { width: 1024, height: 768 }]) {
      const namn = `gruppanelens nederkant ${lagenamn} ${vp.width}`;
      const { page, context } = await oppna("full", vp, standardtema, 1, "g3", 12);
      try {
        await page.waitForSelector("nav[aria-label='Mina grupper']", { timeout: 4000 });
        const panel = page.locator("nav[aria-label='Mina grupper']").first();
        if (infalld) await panel.locator(":scope > button").first().click();
        await page.waitForTimeout(250);
        const m = await panel.evaluate((nav) => {
          nav.scrollTop = nav.scrollHeight;
          const nr = nav.getBoundingClientRect();
          const sista = /** @type {HTMLElement} */ (nav.lastElementChild);
          const sr = sista.getBoundingClientRect();
          return {
            grupper: nav.querySelectorAll("li").length,
            scrollHeight: nav.scrollHeight, clientHeight: nav.clientHeight, scrollTop: nav.scrollTop,
            sistaHojd: sr.height, sistaTop: sr.top, sistaBottom: sr.bottom, navBottom: nr.bottom,
            vh: window.innerHeight, dok: document.documentElement.scrollHeight,
          };
        });
        matt.push(`${namn}: ${m.grupper} grupper, panelen ${m.clientHeight}/${m.scrollHeight} px rullad ${m.scrollTop}, sista knappen ${m.sistaHojd.toFixed(1)} px hög ${m.sistaTop.toFixed(1)}..${m.sistaBottom.toFixed(1)} (panelens kant ${m.navBottom}, fönstret ${m.vh}), dokumentet ${m.dok}`);
        krav(m.grupper >= 12 && m.scrollHeight > m.clientHeight + 40, `${namn}: ${m.grupper} grupper och scrollHeight ${m.scrollHeight} mot clientHeight ${m.clientHeight}. Panelen måste rulla för att botten ska kunna mätas (golv).`);
        krav(m.sistaHojd >= 39.5, `${namn}: sista knappen är ${m.sistaHojd.toFixed(1)} px hög rullad till botten, väntat minst 40. Flexen har tryckt ihop den (CP 2026-09-30 16:58, "huggs av").`);
        krav(m.sistaBottom <= m.navBottom - 16 + 0.5 && m.sistaBottom <= m.vh - 16 + 0.5, `${namn}: sista knappen slutar ${m.sistaBottom.toFixed(1)}, panelen ${m.navBottom} och fönstret ${m.vh}. Väntat minst 16 px luft ovanför fönstrets underkant.`);
        krav(m.dok <= m.vh + 1, `${namn}: dokumentet är ${m.dok} px högt i ett fönster på ${m.vh}. Något i panelen (sr-only) ligger utanför dess rullyta och förlänger sidan.`);
        if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `grupppanel-nederkant-${lagenamn}-${vp.width}.png`) });
      } catch (e) {
        krav(false, `${namn}: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
      }
      await context.close();
    }
  }
}

// ══ 35. HÄNDELSEPANELEN MOT SS EventDetail VID 390 OCH 1280 PX (0.40.0, #214) ═══════════════════════════════════════════════
// CP 2026-10-01: "Vi behöver en händelsepanel. Så man navigerar dit från kalender och från idag. Händelsepanelen skall ha en tillbaka
// knapp. Kolla SessionStudio." Scenen `handelse` är en app med Idag (två flikar, tolv uppgifter och tre händelser) och Kalender, och skalets
// `handelsepanel`. Krav, vid båda bredderna:
//   (a) INGÅNGAR: en rad i Idag och en post i kalenderns dagpanel är länkar till `?handelse=<id>` och ett tryck var som helst på kortet (inte bara på
//       titeln) öppnar panelen, medan åtgärden och utfällningen på samma kort tar sina egna tryck och inte öppnar den. Snabbtitten öppnar också.
//   (b) TILLBAKA: knappen står överst längst till vänster, minst 44 px hög, och ligger ovanför titeln.
//   (c) INNEHÅLL I SS ORDNING: Tillbaka, titel, typrad, informationsruta (datum, tid, plats), beskrivning, svar, uppifrån och ned, och bara det händelsen
//       har (en händelse utan plats och beskrivning ritar ingen tom ruta). Inget klipps: ingen horisontell överflödning, ingen text bredare än fönstret,
//       en mycket lång rubrik och ett långt ord bryts.
//   (d) VÄGEN TILLBAKA: Tillbaka, webbläsarens bakåt och en omladdning på adressen. Idag står kvar på sin flik och på sin rullning, kalendern med sin
//       valda dag, sin månad och utan snabbtitt. Framåt öppnar panelen igen.
// Golv: minst två händelselänkar på fliken Idag, tre på Kommande och tre i dagpanelen, och minst nio mätta element i panelen.
for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  const namn = `händelsepanelen ${vp.width}`;
  const context = await browser.newContext({ viewport: vp });
  const page = await context.newPage();
  page.setDefaultTimeout(4000);
  const fel = /** @type {string[]} */ ([]);
  page.on("pageerror", (e) => fel.push(e.message));
  await page.emulateMedia({ colorScheme: standardtema === "dark" ? "dark" : "light" });
  const html = sida("handelse");
  await page.route("http://skalyta.test/**", (r) => r.fulfill({ contentType: "text/html; charset=utf-8", body: html }));
  /** @param {string} [sokvag] */
  const ga = async (sokvag = "") => {
    await page.goto(`http://skalyta.test/${sokvag}`);
    await page.waitForFunction("window.__redo === true", null, { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(250);
  };
  const panelOppen = () => page.evaluate(() => { const p = document.querySelector("[data-handelsepanel]"); return !!p && p.getBoundingClientRect().width > 0; });
  const adress = () => new URL(page.url()).searchParams.get("handelse");
  /** Mäter panelen: ordning, Tillbaka, klippning. */
  const matPanel = () => page.evaluate(() => {
    const p = /** @type {HTMLElement} */ (document.querySelector("[data-handelsepanel]"));
    const r = (/** @type {Element | null} */ e) => (e ? e.getBoundingClientRect() : null);
    const tillbaka = /** @type {HTMLElement | null} */ (p.querySelector("button"));
    const h1 = p.querySelector("h1");
    const del = {
      tillbaka: r(tillbaka), h1: r(h1), meta: r(p.querySelector("[data-handelsemeta]")), info: r(p.querySelector("[data-handelseinfo]")), datum: r(p.querySelector("[data-handelsedatum]")),
      tid: r(p.querySelector("[data-handelsetid]")), plats: r(p.querySelector("[data-handelseplats]")), beskrivning: r(p.querySelector("[data-handelsebeskrivning]")), svar: r(p.querySelector("[data-handelsesvar]")),
    };
    /** @type {{ el: string, over: number }[]} */
    const klippta = [];
    let atMatt = 0;
    for (const e of p.querySelectorAll("h1, [data-handelsedatum], [data-handelsetid], [data-handelseplats], [data-handelsebeskrivning], [data-handelsemeta] span, [data-ops-svar] span.truncate")) {
      atMatt += 1;
      const el = /** @type {HTMLElement} */ (e);
      const b = el.getBoundingClientRect();
      if (b.right > window.innerWidth + 0.5 || b.left < -0.5) klippta.push({ el: `${el.tagName}.${(el.getAttribute("data-handelsedatum") ?? el.getAttribute("data-handelseplats") ?? el.className).toString().slice(0, 30)} utanför fönstret ${b.left.toFixed(0)}..${b.right.toFixed(0)}`, over: 1 });
      if (el.scrollWidth - el.clientWidth > 1 && getComputedStyle(el).overflow !== "visible") klippta.push({ el: `${el.tagName} scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}`, over: el.scrollWidth - el.clientWidth });
    }
    return {
      del, klippta, atMatt, h1Text: h1 ? (h1.textContent || "").trim() : "", tillbakaText: tillbaka ? (tillbaka.textContent || "").trim() : "",
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth, vw: window.innerWidth, panelLeft: p.getBoundingClientRect().left,
      harSvar: !!p.querySelector("[data-ops-svar]"), harPlats: !!p.querySelector("[data-handelseplats]"), harBeskrivning: !!p.querySelector("[data-handelsebeskrivning]"),
    };
  });
  try {
    await ga();
    // ── (a) Idag ──────────────────────────────────────────────────────────────────────────────────────────────────
    const lankarIdag = await page.locator("[data-handelselank]").count();
    krav(lankarIdag >= 2, `${namn}: ${lankarIdag} händelselänkar på fliken Idag, väntat minst 2 (golv: styrelsemötet och löneutbetalningen). Panelen finns inte, eller raderna ritar ingen länk.`);
    krav(await page.locator('a[data-handelselank][href="?handelse=mote"]').count() === 1, `${namn}: raden för styrelsemötet är ingen länk till ?handelse=mote.`);
    krav(await page.locator("li", { hasText: "Uppgift nummer 1" }).locator("a[data-handelselank]").count() === 0, `${namn}: en uppgift utan handelseId har fått en länk.`);
    if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `handelse-idag-${vp.width}.png`) });
    // Ett tryck var som helst på kortet, inte bara på titeln: längst till höger i kortet, under datumraden.
    const kort = page.locator("li", { has: page.locator('a[href="?handelse=mote"]') }).first();
    const kr = await kort.boundingBox();
    if (kr) await page.mouse.click(kr.x + kr.width - 28, kr.y + kr.height - 14);
    await page.waitForTimeout(250);
    krav(await panelOppen() && adress() === "mote", `${namn}: ett tryck i kortets nedre högra hörn öppnade ingen panel (adress ${adress()}). Länkens ::after täcker inte kortet.`);
    // Tillbaka: rullning och flik. Först utan att öppna: åtgärden och utfällningen på ett kort öppnar inte panelen.
    await ga();
    await page.locator('[data-flik="kommande"]').click();
    const lankar = await page.locator("[data-handelselank]").count();
    krav(lankar >= 3, `${namn}: ${lankar} händelselänkar på fliken Kommande, väntat minst 3 (golv: mötet, löneutbetalningen och tåget).`);
    await page.getByRole("button", { name: "Markera" }).click();
    krav(!(await panelOppen()) && await page.evaluate(() => /** @type {any} */ (window).__atgard) === 1, `${namn}: ett tryck på åtgärden Markera öppnade panelen eller räknades inte (${await page.evaluate(() => /** @type {any} */ (window).__atgard)} anrop). Kontrollerna på kortet måste ligga över länken.`);
    await page.getByRole("button", { name: /^Visa detaljer för Löneutbetalning/ }).click();
    krav(!(await panelOppen()) && (await page.getByRole("button", { name: /^Visa detaljer för Löneutbetalning/ }).getAttribute("aria-expanded")) === "true", `${namn}: ett tryck på utfällningen öppnade panelen eller fällde inte ut.`);
    const tag = page.locator("li", { has: page.locator('a[href="?handelse=tag"]') }).first();
    await tag.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 40));
    const yFore = await page.evaluate(() => Math.round(window.scrollY));
    krav(yFore > 100, `${namn}: Idag rullade bara ${yFore} px, väntat mer än 100 (golv: annars mäter återställningen ingenting).`);
    const tr = await tag.boundingBox();
    if (tr) await page.mouse.click(tr.x + tr.width - 28, tr.y + tr.height / 2);
    await page.waitForTimeout(300);
    const m = await matPanel().catch(() => null);
    krav(!!m && adress() === "tag", `${namn}: tåget öppnades inte (adress ${adress()}).`);
    if (m) krav(m.harPlats === false && m.harBeskrivning === false && m.harSvar === false && m.over <= 0, `${namn}: tåget har varken plats, beskrivning eller svar, men panelen ritar plats ${m.harPlats}, beskrivning ${m.harBeskrivning}, svar ${m.harSvar} (överflöd ${m.over}). En tom ruta är inte ett svar.`);
    krav(await page.evaluate(() => window.scrollY) === 0, `${namn}: panelen öppnades inte överst, rullningen är ${await page.evaluate(() => window.scrollY)}.`);
    await page.getByRole("button", { name: "Tillbaka" }).click();
    await page.waitForTimeout(300);
    const yEfter = await page.evaluate(() => Math.round(window.scrollY));
    krav(!(await panelOppen()) && adress() === null && await page.locator('[data-flik="kommande"]').getAttribute("aria-selected") === "true", `${namn}: efter Tillbaka står panelen ${await panelOppen() ? "kvar" : "borta"}, adressen är ${adress()} och fliken Kommande är ${await page.locator('[data-flik="kommande"]').getAttribute("aria-selected")}, väntat borta, ingen adress och vald.`);
    krav(Math.abs(yEfter - yFore) <= 2, `${namn}: rullningen var ${yFore} före och är ${yEfter} efter Tillbaka, väntat samma plats i Idag.`);
    krav(await page.getByRole("button", { name: /^Visa detaljer för Löneutbetalning/ }).getAttribute("aria-expanded") === "true", `${namn}: Löneutbetalningens utfällning är stängd efter Tillbaka, väntat kvar utfälld (vyn ska inte ha ritats om).`);

    // ── (b), (c) panelen för styrelsemötet ───────────────────────────────────────────────────────────────────────
    await ga("?handelse=mote");
    krav(await panelOppen(), `${namn}: en omladdning på ?handelse=mote öppnade ingen panel.`);
    const p = await matPanel();
    const d = p.del;
    matt.push(`${namn}: Tillbaka ${d.tillbaka && `${d.tillbaka.left.toFixed(0)},${d.tillbaka.top.toFixed(0)} ${d.tillbaka.width.toFixed(0)}x${d.tillbaka.height.toFixed(0)}`}, rubrik "${p.h1Text}" ${d.h1 && `${d.h1.left.toFixed(0)},${d.h1.top.toFixed(0)} ${d.h1.width.toFixed(0)}x${d.h1.height.toFixed(0)}`}, ruta ${d.info && `${d.info.top.toFixed(0)}..${d.info.bottom.toFixed(0)}`}, svar ${d.svar && d.svar.top.toFixed(0)}, ${p.atMatt} mätta element, ${p.klippta.length} klippta, överflöd ${p.over}`);
    krav(p.atMatt >= 9, `${namn}: bara ${p.atMatt} element mätta i panelen, väntat minst 9 (golv).`);
    krav(!!d.tillbaka && p.tillbakaText === "Tillbaka", `${namn}: ingen Tillbaka-knapp i panelen (${JSON.stringify(p.tillbakaText)}).`);
    if (d.tillbaka && d.h1) {
      krav(d.tillbaka.height >= 44 - 0.5, `${namn}: Tillbaka är ${d.tillbaka.height.toFixed(1)} px hög, väntat minst 44 (tumme).`);
      krav(d.tillbaka.bottom <= d.h1.top + 4 && d.tillbaka.top < 160, `${namn}: Tillbaka ligger inte överst (${d.tillbaka.top.toFixed(0)}..${d.tillbaka.bottom.toFixed(0)}) ovanför rubriken (${d.h1.top.toFixed(0)}).`);
      krav(d.tillbaka.left <= p.panelLeft + 24 && d.tillbaka.left >= p.panelLeft - 12 && Math.abs(d.tillbaka.left - d.h1.left) <= 12, `${namn}: Tillbaka står inte till vänster i kolumnen (vänsterkant ${d.tillbaka.left.toFixed(1)}, rubrikens ${d.h1.left.toFixed(1)}, panelens ${p.panelLeft.toFixed(1)}).`);
    }
    const ordning = [["Tillbaka", d.tillbaka], ["rubriken", d.h1], ["typraden", d.meta], ["informationsrutan", d.info], ["beskrivningen", d.beskrivning], ["svaren", d.svar]];
    for (let i = 1; i < ordning.length; i += 1) {
      const [a, ra] = /** @type {[string, DOMRect | null]} */ (ordning[i - 1]);
      const [b, rb] = /** @type {[string, DOMRect | null]} */ (ordning[i]);
      krav(!!ra && !!rb && rb.top >= ra.bottom - 1, `${namn}: ${b} (${rb && rb.top.toFixed(0)}) ligger inte under ${a} (${ra && ra.bottom.toFixed(0)}). Ordningen är SS: Tillbaka, titel, typrad, ruta, beskrivning, svar.`);
    }
    krav(!!d.datum && !!d.tid && !!d.plats && !!d.info && d.datum.bottom <= d.tid.top + 1 && d.tid.bottom <= d.plats.top + 1 && d.plats.bottom <= d.info.bottom, `${namn}: datum, tid och plats står inte i den ordningen inne i informationsrutan.`);
    krav(p.klippta.length === 0, `${namn}: ${p.klippta.length} element klipps eller sticker ut: ${p.klippta.map((k) => k.el).slice(0, 3).join(" | ")}.`);
    krav(p.over <= 0, `${namn}: sidan flödar över ${p.over} px horisontellt.`);
    krav(p.harSvar, `${namn}: styrelsemötet kräver svar men panelen ritar inga svar.`);
    if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `handelse-panel-${vp.width}.png`), fullPage: true });

    // en mycket lång rubrik, ett långt ord och en lång plats bryts i stället för att klippas
    await ga("?handelse=lang");
    const l = await matPanel();
    matt.push(`${namn}: lång rubrik ${l.del.h1 && `${l.del.h1.width.toFixed(0)}x${l.del.h1.height.toFixed(0)}`}, ${l.klippta.length} klippta, överflöd ${l.over}`);
    krav(l.klippta.length === 0 && l.over <= 0, `${namn}: den långa rubriken, platsen eller det långa ordet klipps (${l.klippta.map((k) => k.el).slice(0, 2).join(" | ")}, överflöd ${l.over}).`);
    if (vp.width < 768) krav(!!l.del.h1 && l.del.h1.height > 40, `${namn}: den långa rubriken är ${l.del.h1 && l.del.h1.height.toFixed(0)} px hög på en telefon, väntat flera rader (den ska brytas, inte trunkeras).`);
    krav(await page.evaluate(() => /** @type {string} */ ((document.querySelector("[data-handelsedatum]") || { textContent: "" }).textContent).includes("onsdag 7 oktober 2026") && !!document.querySelector("[data-handelsedatum] .sr-only")), `${namn}: en händelse över flera dagar skriver inte båda datumen med pilen.`);

    // ── (d) vägen tillbaka: webbläsarens bakåt och framåt, och ett id som inte finns ──────────────────────────────
    await ga();
    await page.locator('a[href="?handelse=mote"]').click();
    await page.waitForTimeout(250);
    await page.goBack();
    await page.waitForTimeout(250);
    krav(!(await panelOppen()) && adress() === null, `${namn}: webbläsarens bakåt stängde inte panelen (panelen ${await panelOppen()}, adress ${adress()}).`);
    await page.goForward();
    await page.waitForTimeout(250);
    krav(await panelOppen() && adress() === "mote", `${namn}: webbläsarens framåt öppnade inte panelen igen (adress ${adress()}).`);
    await ga("?handelse=finns-inte");
    krav(await page.getByText("Händelsen finns inte").count() === 1 && await page.getByRole("button", { name: "Tillbaka" }).count() === 1, `${namn}: ett id som inte finns ger inte "Händelsen finns inte" med en Tillbaka-knapp.`);

    // ── (a), (d) Kalendern: dagpanelens rad och snabbtitten ───────────────────────────────────────────────────────
    await ga();
    await page.locator('a[href="/kalender"]:visible').first().click();
    await page.waitForSelector('[data-cal-day="2026-10-12"]');
    await page.locator('[data-cal-day="2026-10-12"]').click();
    await page.waitForSelector("[data-dagpanel]");
    const dagLankar = await page.locator("[data-dagpanel] [data-handelselank]").count();
    krav(dagLankar >= 3, `${namn}: ${dagLankar} händelselänkar i dagpanelen den 12 oktober, väntat minst 3 (golv: mötet, löneutbetalningen och tåget).`);
    if (bildmapp) {
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(bildmapp, `handelse-kalender-dagpanel-${vp.width}.png`) });
    }
    const rulle = () => page.evaluate(() => { const r = document.querySelector("[data-kalender-rulle]"); return { rulle: r ? Math.round(r.scrollTop) : -1, fonster: Math.round(window.scrollY) }; });
    // ⛔ Låt dagpanelens egen rullning (`behavior: "smooth"`, uppåt över den flytande panelen) hinna klart INNAN något mäts: en mätning mitt i
    // animeringen ger en skillnad som inte har med Tillbaka att göra (4832 mot 4847 i en körning som annars var grön).
    await page.waitForTimeout(900);
    // ⛔ Rulla kalendern UPPÅT så att den valda dagen hamnar UNDER den flytande dagpanelen (under 1024 px). Då är det som dagpanelens effekt vill rätta
    // ("rulla dagen ovanför panelen") sant igen, och en effekt som körs en gång till när kalendern visas på nytt syns som en rullning efter Tillbaka.
    // En dag som redan ligger ovanför panelen ger ingen rullning, och provet hade då varit grönt av sig självt.
    await page.evaluate(() => { const r = document.querySelector("[data-kalender-rulle]"); if (r) r.scrollTop = Math.max(0, r.scrollTop - 500); });
    await page.waitForTimeout(150);
    const rFore = await rulle();
    // ⛔ Titeln ligger aldrig över kontrollerna på samma rad: i den smala bubblan (239 px vid 390) gick "Löneutbetalning" in under en pil som stod i en
    // egen kolumn bredvid utfällningen. Mäts på varje rad med en länk och en utfällning: titelns TEXT (en `Range` över textnoden, inte länkens ruta, som
    // också bär pilen) slutar före en pil som står i en egen kolumn och före utfällningsknappen. En pil i själva länken (efter texten, i textflödet) kan inte
    // ligga över titeln och mäts inte.
    const kollision = await page.evaluate(() => [...document.querySelectorAll("[data-dagpanel] [data-postrad]")].flatMap((r) => {
      const l = r.querySelector("[data-handelselank]");
      const k = r.querySelector("button[aria-expanded]");
      const t = l ? [...l.childNodes].find((n) => n.nodeType === 3 && (n.textContent || "").trim()) : null;
      if (!l || !k || !t) return [];
      const range = document.createRange();
      range.selectNodeContents(t);
      const slut = Math.max(...[...range.getClientRects()].map((x) => x.right));
      const cue = r.querySelector("[data-oppna-cue]");
      return [{ titel: (t.textContent || "").trim(), slut, knappStart: k.getBoundingClientRect().left, pilStart: cue && !l.contains(cue) ? cue.getBoundingClientRect().left : null }];
    }));
    matt.push(`${namn}: dagpanelens rader: ${JSON.stringify(kollision.map((k) => `${k.titel} slutar ${k.slut.toFixed(0)}, pilen ${k.pilStart === null ? "-" : k.pilStart.toFixed(0)}, utfällningen ${k.knappStart.toFixed(0)}`))}`);
    krav(kollision.length >= 2, `${namn}: bara ${kollision.length} rader i dagpanelen har både en händelselänk och en utfällning, väntat minst 2 (golv).`);
    krav(kollision.every((k) => k.slut <= k.knappStart + 0.5 && (k.pilStart === null || k.slut <= k.pilStart + 0.5)), `${namn}: titeln går in under pilen eller utfällningsknappen på ${kollision.filter((k) => k.slut > k.knappStart + 0.5 || (k.pilStart !== null && k.slut > k.pilStart + 0.5)).map((k) => `${k.titel} (slutar ${k.slut.toFixed(0)}, pilen ${k.pilStart}, utfällningen ${k.knappStart.toFixed(0)})`).join(", ")}.`);
    const rad = page.locator("[data-dagpanel] [data-postrad]", { has: page.locator("[data-handelselank]") }).first();
    const rr = await rad.boundingBox();
    if (rr) await page.mouse.click(rr.x + rr.width - 60, rr.y + rr.height / 2);
    await page.waitForTimeout(300);
    krav(await panelOppen() && !!adress(), `${namn}: ett tryck på en rad i dagpanelen öppnade ingen panel (adress ${adress()}). Länkens ::after täcker inte raden.`);
    const mk = await matPanel().catch(() => null);
    krav(!!mk && mk.klippta.length === 0 && mk.over <= 0 && !!mk.del.tillbaka && mk.del.tillbaka.height >= 43.5, `${namn}: panelen ur kalendern: ${mk ? `${mk.klippta.length} klippta, överflöd ${mk.over}, Tillbaka ${mk.del.tillbaka && mk.del.tillbaka.height.toFixed(0)} px` : "kunde inte mätas"}.`);
    if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `handelse-fran-kalender-${vp.width}.png`) });
    await page.getByRole("button", { name: "Tillbaka" }).click();
    await page.waitForTimeout(1000);
    const rEfter = await rulle();
    const dagKvar = await page.locator('[data-cal-day="2026-10-12"]').getAttribute("aria-pressed");
    krav(!(await panelOppen()) && adress() === null && dagKvar === "true" && (await page.locator("[data-dagpanel]").count()) === 1, `${namn}: efter Tillbaka i kalendern: panel ${await panelOppen()}, adress ${adress()}, den valda dagen ${dagKvar}, dagpanelen ${await page.locator("[data-dagpanel]").count()}. Väntat stängd, ingen adress, dagen vald och dagpanelen kvar.`);
    krav(Math.abs(rEfter.rulle - rFore.rulle) <= 2 && Math.abs(rEfter.fonster - rFore.fonster) <= 2, `${namn}: kalenderns rullning var ${JSON.stringify(rFore)} före och är ${JSON.stringify(rEfter)} efter Tillbaka, väntat samma månad.`);
    if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `handelse-kalender-efter-tillbaka-${vp.width}.png`) });
    await page.locator('[data-cal-day="2026-10-12"]').click({ button: "right" });
    await page.waitForSelector("[data-snabbtitt]");
    await page.locator("[data-snabbtitt] [data-handelselank]").first().click();
    await page.waitForTimeout(250);
    krav(await panelOppen() && (await page.locator("[data-snabbtitt]").count()) === 0, `${namn}: raden i snabbtitten öppnade ingen panel, eller titten står kvar (${await page.locator("[data-snabbtitt]").count()}).`);
    await page.getByRole("button", { name: "Tillbaka" }).click();
    await page.waitForTimeout(300);
    krav((await page.locator("[data-snabbtitt]").count()) === 0 && (await page.locator('[data-cal-day="2026-10-12"]').getAttribute("aria-pressed")) === "true", `${namn}: efter Tillbaka ur snabbtitten står titten kvar eller dagen har tappat sitt val.`);
    krav(fel.length === 0, `${namn}: sidan kastade: ${fel[0]}`);
  } catch (e) {
    krav(false, `${namn}: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
  }
  await context.close();
}

// ══ 36. ÄNDRA EN HÄNDELSE MOT SS EventDetail + EventEditRouteView VID 390 OCH 1280 PX (0.40.0, #214) ═══════════════════════
// CP 2026-10-01: "Kolla med sessionstudio också så att det går att editera en händelse." SS har en penna i händelsens titelrad
// (`EventDetailInlinePanel.jsx:84-86`) som öppnar SAMMA formulär som skapar, förifyllt (`EventEditRouteView.jsx`), med en rad "Tillbaka" som går
// tillbaka till händelsen. Scenen `handelse-redigera` är panelen med `onRedigera` och skalets redigeringsläge. Krav, vid båda bredderna:
//   (a) PENNAN: en knapp med namnet Redigera i titelraden, till höger om titeln (och statusen), på rubrikens rad, minst 44 px under md. Utan `onRedigera`
//       (`?utanpenna=1`) finns ingen penna.
//   (b) REDIGERINGSPANELEN: rubriken är "Redigera händelse" (inte "Ny händelse"), adressen bär `skapa=handelse&redigera=mote`, Tillbaka överst är minst 44 px,
//       formuläret är förifyllt ur händelsen och skalets val (Kalender, Kräv svar) står som händelsen har dem, och knappraden (Avbryt, Spara) ligger kvar.
//   (c) TILLBAKA ÄR TILLBAKA: Tillbaka och webbläsarens bakåt visar händelsepanelen oförändrad, utan att ha sparat.
//   (d) SPARA: ändringen syns i händelsepanelen (rubrik och tid), adressen tappar `redigera`, och formuläret fick `redigera: mote` men inget nytt id.
// Golv: minst sex mätta delar i redigeringspanelen och en sparad ändring.
for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  const namn = `ändra händelse ${vp.width}`;
  const context = await browser.newContext({ viewport: vp });
  const page = await context.newPage();
  page.setDefaultTimeout(4000);
  const fel = /** @type {string[]} */ ([]);
  page.on("pageerror", (e) => fel.push(e.message));
  await page.emulateMedia({ colorScheme: standardtema === "dark" ? "dark" : "light" });
  const html = sida("handelse-redigera");
  await page.route("http://skalyta.test/**", (r) => r.fulfill({ contentType: "text/html; charset=utf-8", body: html }));
  /** @param {string} [sokvag] */
  const ga = async (sokvag = "") => {
    await page.goto(`http://skalyta.test/${sokvag}`);
    await page.waitForFunction("window.__redo === true", null, { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(250);
  };
  const param = (/** @type {string} */ n) => new URL(page.url()).searchParams.get(n);
  const panelRubrik = () => page.evaluate(() => { const h = document.querySelector("[data-handelsepanel] h1"); return h ? (h.textContent || "").trim() : null; });
  try {
    // ── (a) pennan ────────────────────────────────────────────────────────────────────────────────────────────────
    await ga("?handelse=mote");
    const penna = page.getByRole("button", { name: "Redigera", exact: true });
    krav(await penna.count() === 1, `${namn}: ${await penna.count()} knappar med namnet Redigera i händelsepanelen, väntat exakt 1 (pennan finns inte, eller finns flera).`);
    const mp = await page.evaluate(() => {
      const k = /** @type {HTMLElement | null} */ (document.querySelector("[data-handelse-redigera]"));
      const h = document.querySelector("[data-handelsepanel] h1");
      const st = document.querySelector("[data-handelsestatus]");
      const r = (/** @type {Element | null} */ e) => { const b = e && e.getBoundingClientRect(); return b ? { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height } : null; };
      const kolumn = document.querySelector("[data-handelsepanel]");
      return { k: r(k), h: r(h), st: r(st), kol: r(kolumn), titel: k ? k.getAttribute("title") : null, over: document.documentElement.scrollWidth - document.documentElement.clientWidth, ikon: k ? !!k.querySelector("svg") : false };
    });
    matt.push(`${namn}: pennan ${mp.k && `${mp.k.l.toFixed(0)},${mp.k.t.toFixed(0)} ${mp.k.w.toFixed(0)}x${mp.k.h.toFixed(0)}`}, rubriken ${mp.h && `${mp.h.l.toFixed(0)}..${mp.h.r.toFixed(0)} x ${mp.h.t.toFixed(0)}..${mp.h.b.toFixed(0)}`}, status ${mp.st && `${mp.st.l.toFixed(0)}..${mp.st.r.toFixed(0)}`}`);
    if (mp.k && mp.h && mp.kol) {
      const minst = vp.width < 768 ? 44 : 36;
      krav(mp.k.w >= minst - 0.5 && mp.k.h >= minst - 0.5, `${namn}: pennan är ${mp.k.w.toFixed(1)}x${mp.k.h.toFixed(1)} px, väntat minst ${minst}x${minst} (SS p-2 ger 36, under md krävs 44).`);
      krav(mp.k.l >= mp.h.r - 0.5 && (!mp.st || mp.k.l >= mp.st.r - 0.5), `${namn}: pennan (vänsterkant ${mp.k.l.toFixed(0)}) ligger inte till höger om rubriken (${mp.h.r.toFixed(0)}) och statusen (${mp.st && mp.st.r.toFixed(0)}).`);
      krav(mp.k.t < mp.h.b && mp.k.b > mp.h.t - 8, `${namn}: pennan (${mp.k.t.toFixed(0)}..${mp.k.b.toFixed(0)}) står inte på rubrikens rad (${mp.h.t.toFixed(0)}..${mp.h.b.toFixed(0)}).`);
      krav(mp.k.r <= mp.kol.r + 0.5 && mp.k.r <= vp.width + 0.5 && mp.over <= 0, `${namn}: pennan sticker ut (${mp.k.r.toFixed(0)}, kolumnen ${mp.kol.r.toFixed(0)}, fönstret ${vp.width}, överflöd ${mp.over}).`);
      krav(mp.titel === "Redigera" && mp.ikon, `${namn}: pennan saknar title (${mp.titel}) eller ikon (${mp.ikon}).`);
    } else krav(false, `${namn}: pennan, rubriken eller kolumnen kunde inte mätas.`);
    if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `handelse-redigera-penna-${vp.width}.png`), fullPage: true });
    await ga("?handelse=mote&utanpenna=1");
    krav(await page.getByRole("button", { name: "Redigera", exact: true }).count() === 0 && await panelRubrik() === "Styrelsemöte", `${namn}: utan onRedigera finns en penna (${await page.getByRole("button", { name: "Redigera", exact: true }).count()} st), eller panelen ritades inte.`);

    // ── (b) redigeringspanelen ────────────────────────────────────────────────────────────────────────────────────
    await ga("?handelse=mote");
    await page.getByRole("button", { name: "Redigera", exact: true }).click();
    await page.waitForSelector("[data-skapa-panel]");
    await page.waitForTimeout(300);
    krav(param("skapa") === "handelse" && param("redigera") === "mote" && param("handelse") === "mote", `${namn}: adressen är skapa=${param("skapa")}, redigera=${param("redigera")}, handelse=${param("handelse")}, väntat handelse, mote och mote.`);
    const e = await page.evaluate(() => {
      const p = /** @type {HTMLElement} */ (document.querySelector("[data-skapa-panel]"));
      const r = (/** @type {Element | null} */ el) => { const b = el && el.getBoundingClientRect(); return b ? { l: b.left, t: b.top, b: b.bottom, w: b.width, h: b.height } : null; };
      const tillbaka = [...p.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "Tillbaka");
      const h2 = p.querySelector("h2");
      const falt = [...p.querySelectorAll("input")].map((i) => /** @type {HTMLInputElement} */ (i).value);
      const knappar = [...p.querySelectorAll("[data-skapa-knappar] button")].map((b) => (b.textContent || "").trim());
      const kal = [...p.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") || "").startsWith("Kalender:"));
      const krav = p.querySelector('[data-krav-svar] [role="switch"]');
      return {
        rubrik: h2 ? (h2.textContent || "").trim() : null, tillbaka: r(tillbaka || null), h2: r(h2), falt, knappar, kalender: kal ? kal.getAttribute("aria-label") : null,
        kravSvar: krav ? String(/** @type {HTMLInputElement} */ (krav).checked || krav.getAttribute("aria-checked") === "true") : null, etiketter: p.querySelectorAll("[data-app-formular] label").length, over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        props: /** @type {any} */ (window).__redigeraProps, vyDold: !!document.querySelector("[hidden] [data-vy]"), harNy: /Ny händelse/.test(p.textContent || ""),
      };
    });
    matt.push(`${namn}: redigeringspanel "${e.rubrik}", Tillbaka ${e.tillbaka && `${e.tillbaka.w.toFixed(0)}x${e.tillbaka.h.toFixed(0)}`}, fält ${JSON.stringify(e.falt)}, ${e.kalender}, Kräv svar ${e.kravSvar}, knappar ${JSON.stringify(e.knappar)}`);
    krav(e.rubrik === "Redigera händelse" && !e.harNy, `${namn}: rubriken är ${JSON.stringify(e.rubrik)}${e.harNy ? " och texten Ny händelse finns i panelen" : ""}, väntat Redigera händelse.`);
    krav(!!e.tillbaka && e.tillbaka.h >= 43.5 && !!e.h2 && e.tillbaka.t < e.h2.t + 60, `${namn}: Tillbaka i redigeringspanelen ${e.tillbaka && `${e.tillbaka.h.toFixed(0)} px hög`}, ${e.tillbaka && e.h2 ? "" : "rubriken eller knappen saknas"}.`);
    krav(e.falt.includes("Styrelsemöte"), `${namn}: formuläret är inte förifyllt ur händelsen (fälten ${JSON.stringify(e.falt)}), väntat rubriken Styrelsemöte.`);
    krav(e.kalender === "Kalender: Styrelsen" && e.kravSvar === "true", `${namn}: skalets val är ${JSON.stringify([e.kalender, e.kravSvar])}, väntat Kalender: Styrelsen och Kräv svar på (ifyllda ur händelsen).`);
    krav(!!e.props && e.props.redigera === "mote" && e.props.typ === "mote" && e.props.kalender?.id === "styrelse" && e.props.kravSvar === true, `${namn}: formuläret fick ${JSON.stringify(e.props)}, väntat redigera mote, typ mote, kalender styrelse och Kräv svar sant.`);
    krav(e.knappar.includes("Avbryt") && e.knappar.includes("Spara"), `${namn}: knappraden är ${JSON.stringify(e.knappar)}, väntat Avbryt och Spara.`);
    krav(e.over <= 0 && e.etiketter >= 4, `${namn}: redigeringspanelen flödar över ${e.over} px, eller bara ${e.etiketter} fältetiketter mättes (golv 4: Rubrik, Datum, Från, Till).`);
    if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `handelse-redigera-formular-${vp.width}.png`), fullPage: true });

    // ── (c) Tillbaka och webbläsarens bakåt: utan att spara ──────────────────────────────────────────────────────
    const rubrikFalt = page.locator("[data-skapa-panel] input").first();
    await rubrikFalt.fill("Osparad rubrik");
    await page.locator("[data-skapa-panel]").getByRole("button", { name: "Tillbaka" }).click();
    await page.waitForTimeout(300);
    krav(await panelRubrik() === "Styrelsemöte" && param("redigera") === null && param("skapa") === null && param("handelse") === "mote" && await page.locator("[data-skapa-panel]").count() === 0, `${namn}: efter Tillbaka är händelsens rubrik ${JSON.stringify(await panelRubrik())}, adressen skapa=${param("skapa")}, redigera=${param("redigera")}, handelse=${param("handelse")}. Väntat Styrelsemöte (osparat) och bara handelse=mote.`);
    await page.getByRole("button", { name: "Redigera", exact: true }).click();
    await page.waitForSelector("[data-skapa-panel]");
    await page.goBack();
    await page.waitForTimeout(300);
    krav(await panelRubrik() === "Styrelsemöte" && await page.locator("[data-skapa-panel]").count() === 0, `${namn}: webbläsarens bakåt ur redigeringspanelen visar ${JSON.stringify(await panelRubrik())}, väntat händelsepanelen oförändrad.`);
    krav(await page.evaluate(() => /** @type {any} */ (window).__sparade.length) === 0, `${namn}: något sparades utan att någon tryckt Spara.`);

    // ── (d) Spara ─────────────────────────────────────────────────────────────────────────────────────────────────
    await page.getByRole("button", { name: "Redigera", exact: true }).click();
    await page.waitForSelector("[data-skapa-panel]");
    await page.waitForTimeout(200);
    await page.locator("[data-skapa-panel] input").first().fill("Flyttat styrelsemöte");
    await page.locator("[data-skapa-panel]").getByRole("button", { name: "Spara" }).click();
    await page.waitForTimeout(400);
    const sp = await page.evaluate(() => /** @type {any} */ (window).__sparade);
    krav(sp.length === 1 && sp[0].id === "mote" && sp[0].rubrik === "Flyttat styrelsemöte" && sp[0].kalenderId === "styrelse" && sp[0].kravSvar === true, `${namn}: sparat ${JSON.stringify(sp)}, väntat en ändring av mote med den nya rubriken, kalendern och Kräv svar kvar.`);
    krav(await panelRubrik() === "Flyttat styrelsemöte" && param("redigera") === null && param("skapa") === null && await page.locator("[data-skapa-panel]").count() === 0, `${namn}: efter Spara visar panelen ${JSON.stringify(await panelRubrik())}, adressen skapa=${param("skapa")}, redigera=${param("redigera")}. Väntat Flyttat styrelsemöte och ingen redigeringspanel.`);
    krav(await page.evaluate(() => /** @type {any} */ (window).__redigeraProps?.redigera) === "mote", `${namn}: formuläret fick aldrig redigera=mote.`);
    if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `handelse-redigera-efter-${vp.width}.png`), fullPage: true });
    krav(fel.length === 0, `${namn}: sidan kastade: ${fel[0]}`);
  } catch (e) {
    krav(false, `${namn}: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
  }
  await context.close();
}

// ══ 37. MODULERNAS TYPBIDRAG MÄRKS «från <modul>» VID 390 OCH 1280 PX (0.42.0, #217) ══════════════════════════════════════════
// CP 2026-10-01 (en skärmbild av "Nytt ärende"): "Vissa av dessa typer kommer ju med modulerna? Ekonomi t ex." Ett bidrag från en modul får
// inte se ut som en fri kategori. Scenen `modultyper` är valen som ett skapa-formulär ritar dem (OpsRadioGroup med `typerTillValg`) och ägarens
// lista (`OpsModulTyper`). Krav, vid båda bredderna:
//   (a) VALEN: de två egna typerna (Ärende, Bugg) saknar märke, de två bidragen bär «från Ekonomi» som hjälptext på sin rad, och märket är
//       samma ord i listan under.
//   (b) LISTAN: varje rad har en pill med «från Ekonomi», knapparna Byt namn och Dölj är minst 44 px höga.
//   (c) DÖLJ: efter ett tryck på Dölj på första raden försvinner bidraget ur valen men står kvar i listan som «från Ekonomi, dold» med knappen Visa,
//       och Visa ger tillbaka det.
//   (d) INGEN horisontell överflödning, och det långa bidragsnamnet bryts inom fönstret.
// Golv: minst 4 val, 2 listrader.
for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  const namn = `modultyper ${vp.width}`;
  const { page, context } = await oppna("modultyper", vp);
  try {
    await page.waitForSelector("[data-modultyp-val] label", { timeout: 4000 });
    const las = () =>
      page.evaluate(() => {
        const val = [...document.querySelectorAll("[data-modultyp-val] label")].map((l) => ({
          titel: (l.querySelector(".text-etikett")?.textContent || "").trim(),
          hint: (l.querySelector(".text-hjalp")?.textContent || "").trim(),
          rakt: l.getBoundingClientRect().right,
        }));
        const rader = [...document.querySelectorAll("[data-modultyp-lista] li")].map((li) => ({
          namn: (li.querySelector("span.font-medium")?.textContent || "").trim(),
          pill: (li.querySelector("span.rounded-full:not(.size-2)")?.textContent || "").trim(),
          knappar: [...li.querySelectorAll("button")].map((b) => ({ text: (b.textContent || "").trim(), h: Math.round(b.getBoundingClientRect().height) })),
          rakt: li.getBoundingClientRect().right,
        }));
        return { val, rader, over: document.documentElement.scrollWidth - document.documentElement.clientWidth, bredd: window.innerWidth };
      });
    const fore = await las();
    matt.push(`${namn}: val ${JSON.stringify(fore.val.map((v) => [v.titel, v.hint]))}, lista ${JSON.stringify(fore.rader.map((r) => [r.namn, r.pill]))}, knapphöjd ${fore.rader[0]?.knappar.map((k) => k.h).join("/")}, överflöde ${fore.over} px`);
    krav(fore.val.length >= 4 && fore.rader.length >= 2, `${namn}: ${fore.val.length} val och ${fore.rader.length} listrader, väntat minst 4 och 2 (golv).`);
    krav(fore.val.filter((v) => v.hint === "").map((v) => v.titel).join() === "Ärende,Bugg", `${namn}: valen utan märke är ${JSON.stringify(fore.val.filter((v) => v.hint === "").map((v) => v.titel))}, väntat bara de egna (Ärende, Bugg).`);
    krav(fore.val.filter((v) => v.hint === "från Ekonomi").length === 2, `${namn}: ${fore.val.filter((v) => v.hint === "från Ekonomi").length} val bär «från Ekonomi», väntat 2.`);
    krav(fore.rader.every((r) => r.pill === "från Ekonomi"), `${namn}: listradernas märke är ${JSON.stringify(fore.rader.map((r) => r.pill))}, väntat «från Ekonomi» på alla.`);
    krav(fore.rader.every((r) => r.knappar.length === 2 && r.knappar.every((k) => k.h >= 44)), `${namn}: knapparna i listan är ${JSON.stringify(fore.rader.map((r) => r.knappar))}, väntat Byt namn och Dölj, minst 44 px höga.`);
    krav(fore.over <= 0 && fore.val.every((v) => v.rakt <= fore.bredd) && fore.rader.every((r) => r.rakt <= fore.bredd), `${namn}: sidan flödar över ${fore.over} px horisontellt, eller en rad går utanför fönstret.`);

    await page.locator("[data-modultyp-lista]").getByRole("button", { name: "Dölj" }).first().click();
    await page.waitForTimeout(100);
    const dold = await las();
    matt.push(`${namn} efter Dölj: val ${JSON.stringify(dold.val.map((v) => v.titel))}, lista ${JSON.stringify(dold.rader.map((r) => [r.namn, r.pill]))}`);
    krav(dold.val.length === fore.val.length - 1, `${namn}: efter Dölj är det ${dold.val.length} val, väntat ${fore.val.length - 1}.`);
    krav(dold.rader.length === fore.rader.length && dold.rader[0].pill === "från Ekonomi, dold" && dold.rader[0].knappar.some((k) => k.text === "Visa"), `${namn}: efter Dölj visar första raden ${JSON.stringify(dold.rader[0])}, väntat «från Ekonomi, dold» med knappen Visa.`);
    await page.locator("[data-modultyp-lista]").getByRole("button", { name: "Visa" }).first().click();
    await page.waitForTimeout(100);
    const igen = await las();
    krav(igen.val.length === fore.val.length && igen.rader[0].pill === "från Ekonomi", `${namn}: efter Visa är det ${igen.val.length} val och första radens märke ${JSON.stringify(igen.rader[0]?.pill)}, väntat tillbaka som före.`);
    if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `modultyper-${vp.width}.png`), fullPage: true });
  } catch (e) {
    krav(false, `${namn}: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
  }
  await context.close();
}

// ══ 38. APPRADEN I KALENDERN VID 390 OCH 1280 PX (0.54.0, #244 beslut B och C) ═══════════════════════════════════════════════
// CP 2026-10-04: "Om man har många appar i en grupp. Hur skall det då funka?" Sex appar: fyra i raden, två under Fler. Mätt:
// raden är EN rad (alla knappar på samma höjd), knapparna är minst 44 px höga på telefon, sidan flödar inte i sidled, och ett
// tryck på en app tar bort dess poster ur dagen och sparar valet under gruppen. jsdom kör ingen CSS, så höjd och radbrytning
// går bara att se här.
for (const [namn, vp] of /** @type {const} */ ([["apparaden 390 px", { width: 390, height: 844 }], ["apparaden 1280 px", { width: 1280, height: 900 }]])) {
  const { page, context } = await oppna("kalender-appar", vp);
  try {
    await page.waitForSelector("[data-kalender-appar]", { timeout: 4000 });
    const las = () => page.evaluate(() => {
      const rad = /** @type {HTMLElement} */ (document.querySelector("[data-kalender-appar]"));
      const knappar = [...rad.querySelectorAll("button")].map((b) => { const r = b.getBoundingClientRect(); return { text: (b.textContent || "").trim(), top: Math.round(r.top), h: r.height, r: r.right, pressed: b.getAttribute("aria-pressed") }; });
      const dag = document.querySelector('[data-cal-day="2026-10-12"]');
      return { knappar, radR: rad.getBoundingClientRect().right, scroll: document.documentElement.scrollWidth, klient: document.documentElement.clientWidth, dag: dag ? dag.getAttribute("aria-label") : null };
    });
    const fore = await las();
    matt.push(`${namn}: ${JSON.stringify(fore.knappar.map((k) => [k.text, k.top, Math.round(k.h)]))}, dagen ${fore.dag}`);
    const appknappar = fore.knappar.filter((k) => k.pressed !== null);
    krav(appknappar.length >= 2 && appknappar.length <= 4, `${namn}: ${appknappar.length} appknappar i raden, väntat 2 till 4 (så många som ryms, resten under Fler).`);
    if (vp.width >= 1024) krav(appknappar.length === 4, `${namn}: ${appknappar.length} appknappar på en bred skärm, väntat 4.`);
    krav(fore.knappar.some((k) => /^Fler/.test(k.text)), `${namn}: ingen Fler-knapp med sex appar.`);
    krav(new Set(fore.knappar.map((k) => k.top)).size === 1, `${namn}: knapparna står på ${new Set(fore.knappar.map((k) => k.top)).size} olika höjder, väntat en rad.`);
    if (vp.width < 768) krav(fore.knappar.every((k) => k.h >= 43.5), `${namn}: en knapp är ${Math.min(...fore.knappar.map((k) => k.h))} px hög, väntat minst 44 på telefon.`);
    krav(fore.scroll <= fore.klient, `${namn}: sidan flödar i sidled, scrollWidth ${fore.scroll} > clientWidth ${fore.klient}.`);
    // ⛔ VARJE KNAPP HELT INOM SKÄRMEN. Första versionen klippte "Planering" och sköt Fler utanför 390 px, och raden rullade i
    // sidled utan att det syntes. Höjd och radbrytning var gröna genom hela felet.
    const utanfor = fore.knappar.filter((k) => k.r > vp.width - 15.5);
    krav(utanfor.length === 0, `${namn}: ${utanfor.map((k) => `${k.text} slutar på ${k.r.toFixed(0)}`).join(", ")}, väntat inom ${vp.width - 16} px (sidans marginal).`);
    krav(fore.knappar.some((k) => /^Fler/.test(k.text) && k.r <= vp.width - 15.5), `${namn}: Fler syns inte inom skärmen, så de dolda apparna går inte att nå.`);
    await page.getByRole("button", { name: "Ekonomi", exact: true }).click();
    await page.waitForTimeout(150);
    const efter = await las();
    const sparat = await page.evaluate(() => window.__lagring["ops-kalender-dolda-appar:g1"] ?? null);
    matt.push(`${namn} efter Ekonomi: dagen ${efter.dag}, sparat ${sparat}`);
    krav(efter.knappar.find((k) => k.text === "Ekonomi")?.pressed === "false", `${namn}: Ekonomi är inte markerad som dold efter trycket.`);
    krav(efter.dag !== fore.dag, `${namn}: den 12 oktober säger samma sak före och efter att Ekonomi dolts (${efter.dag}). Kvittot ska inte räknas.`);
    krav(sparat === '["ekonomi"]', `${namn}: valet sparades som ${sparat}, väntat ["ekonomi"] under gruppen g1.`);
    // ⛔ RADEN BYTER INTE INNEHÅLL AV ETT TRYCK: samma appar i samma ordning före och efter (första mätningen flyttade Ekonomi
    // in under Fler när Visa alla dök upp).
    const appar = (/** @type {{ knappar: { text: string, pressed: string | null }[] }} */ x) => x.knappar.filter((k) => k.pressed !== null).map((k) => k.text);
    krav(JSON.stringify(appar(efter)) === JSON.stringify(appar(fore)), `${namn}: raden bytte innehåll av trycket: ${JSON.stringify(appar(fore))} blev ${JSON.stringify(appar(efter))}.`);
    const visaAlla = efter.knappar.some((k) => k.text === "Visa alla") || (await page.locator("[data-appar-fler]").count()) > 0;
    krav(visaAlla, `${namn}: Visa alla går inte att nå när en app är dold (varken i raden eller under Fler).`);
    if (bildmapp) await page.screenshot({ path: path.join(bildmapp, `apprad-${vp.width}.png`), clip: { x: 0, y: 0, width: vp.width, height: Math.min(vp.height, 420) } });
  } catch (e) {
    krav(false, `${namn}: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
  }
  await context.close();
}

if (bildmapp) {
  for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const { page, context } = await oppna("kalender", vp);
    await page.waitForSelector("[data-kalender-rulle]", { timeout: 4000 }).catch(() => {});
    await page.evaluate(() => { const r = document.querySelector("[data-kalender-rulle]"); const h = [...(r ? r.querySelectorAll("h3") : [])].find((x) => /oktober 2026/i.test(x.textContent || "")); if (r && h) r.scrollTop = /** @type {HTMLElement} */ (h.parentElement).offsetTop - /** @type {HTMLElement} */ (r.firstElementChild).offsetHeight; });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(bildmapp, `kalender-${vp.width}.png`) });
    await page.locator('[data-cal-day="2026-10-12"]').click().catch(() => {});
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(bildmapp, `kalender-dag-${vp.width}.png`) });
    await context.close();
  }
}

await browser.close();

for (const rad of matt) console.log(`  mätt: ${rad}`);
if (brott.length > 0) {
  console.error(`\ncheck-skalyta: ${brott.length} brott av ${mattningar} kontroller (${varifran})\n`);
  for (const b of brott) console.error(`  ${b}`);
  process.exit(1);
}
console.log(`\ncheck-skalyta: ${mattningar} kontroller, inga brott (${varifran})`);
