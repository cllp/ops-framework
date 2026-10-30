#!/usr/bin/env node
/**
 * Vakt: rullningslistens tumme och väljarens lista, mätta i en riktig webbläsare (0.95.1).
 *
 * ══ ⛔ VARFÖR EN VAKT SOM KÖR CSS ═══════════════════════════════════════════
 *
 * Båda felen i 0.95.1 var osynliga för provsviten, eftersom jsdom varken ritar en rullningslist eller räknar en bredd:
 *
 *   1. TUMMEN. 0.95.0 målade den i `ink-muted` till hälften genomskinlig. I lifehub.app:s ompinning (PR 206) syntes den
 *      knappt i Idags ruta i mörkt läge, sämre än operativsystemets list den ersatte. `check-kontrast` räknar nu
 *      uttrycket ur tokens; den här vakten mäter pixeln Chromium faktiskt ritar, i vila, med pekaren på ytan och med
 *      pekaren på tummen, där Chromium tonar tummen själv.
 *   2. VÄLJARENS LISTA. I Identitys AI-nycklar var fältet Leverantör cirka 640 px och den öppna listan cirka 150 px,
 *      bara så bred som det längsta alternativet. Vakten öppnar `OpsSelect` i ett 640 px fält och kräver att listan är
 *      minst lika bred som knappen.
 *
 * ⛔ PLAYWRIGHT STARTAR CHROMIUM MED `--hide-scrollbars`. Utan `visaRullningslister` ritas ingen list alls, och en
 * mätning av tummen hade blivit grön av att inget fanns att mäta. Därför har vakten ett golv: varje lista måste ha en
 * ritad list och en tumme som går att hitta, annars är den röd.
 *
 * ⛔ FAIL-CLOSED när webbläsaren saknas, som `check-skalyta`.
 *
 * Kör:  npm run build && node scripts/check-kontrollyta.mjs
 *       node scripts/check-kontrollyta.mjs --dist <fil> --tokens <fil>    mät en annan version (röd-beviset mot 0.95.0)
 *       node scripts/check-kontrollyta.mjs --bilder <mapp>                skriver skärmbilderna dit
 *       node scripts/check-kontrollyta.mjs --montage <före> <efter> <ut>  sätter ihop två --bilder-mappar till montage
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { contrast } from "./vendor/validate_palette.js";
import { startaWebblasare } from "./lib/matVyport.mjs";
import { distUtanKommentarer } from "./lib/dist-text.mjs";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
/** @param {string} namn */
const arg = (namn) => {
  const i = argv.indexOf(namn);
  return i >= 0 ? argv[i + 1] : undefined;
};

/** Tummen visar var man är i listan: en grafisk del, WCAG 1.4.11. */
const GRAFIK = 3;
const TEMAN = /** @type {const} */ (["light", "dark"]);
/*
 * ⛔ HÖJDEN RYMMER HELA MÄTSIDAN MED LISTAN ÖPPEN. En helsidesbild ändrar vyportens storlek, och Radix stänger då
 * väljaren och Chromium ritade inga lister i den smala bilden: montaget visade alltså inte det som mättes. Därför tas
 * bilden ur vyporten som den är, och 390 px får plats med tre listor under varandra.
 */
const BREDDER = [
  { width: 1440, height: 760 },
  { width: 390, height: 1240 },
];

/** @param {number[]} c */
const hex = (c) => "#" + c.map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");

if (argv.includes("--montage")) {
  const i = argv.indexOf("--montage");
  await montage(path.resolve(argv[i + 1]), path.resolve(argv[i + 2]), path.resolve(argv[i + 3]));
  process.exit(0);
}

const dist = path.resolve(arg("--dist") ?? path.join(rot, "dist", "index.js"));
const tokensFil = path.resolve(arg("--tokens") ?? path.join(rot, "tokens", "tokens.css"));
const bildmapp = arg("--bilder") ? path.resolve(/** @type {string} */ (arg("--bilder"))) : null;
if (bildmapp) fs.mkdirSync(bildmapp, { recursive: true });

if (!fs.existsSync(dist)) {
  console.error(`check-kontrollyta: ${dist} saknas. Kör npm run build först. Ett överhoppat mått räknas aldrig som grönt.`);
  process.exit(1);
}

const { build } = await import("esbuild");
const { default: postcss } = await import("postcss");
const { default: tailwind } = await import("@tailwindcss/postcss");

const arbetsmapp = fs.mkdtempSync(path.join(rot, "node_modules", ".ops-kontrollyta-"));
/** @type {string[]} */
const brott = [];
/** @type {string[]} */
const rader = [];
let matningar = 0;

try {
  const entryFil = path.join(arbetsmapp, "entry.jsx");
  fs.writeFileSync(entryFil, fs.readFileSync(path.join(rot, "scripts", "lib", "kontrollyta-entry.jsx"), "utf8").replace("OPS_DIST", dist.replace(/\\/g, "/")));
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
  // ⛔ Kommentarerna bort ur dist innan Tailwind skannar den, annars blir ord i kommentarer klasser (samma som bibliotek-montage).
  const distSkannad = path.join(arbetsmapp, "dist-skannad.js");
  fs.writeFileSync(distSkannad, distUtanKommentarer(dist));
  const cssRatt = (
    await postcss([tailwind()]).process(
      `@import "tailwindcss" source(none);\n@import "${tokensFil.replace(/\\/g, "/")}";\n@source "${distSkannad.replace(/\\/g, "/")}";\n@source "${entryFil.replace(/\\/g, "/")}";\n`,
      { from: path.join(arbetsmapp, "app.css") },
    )
  ).css;
  const fontData = fs.readFileSync(path.join(rot, "fonts", "glacial-indifference", "glacial-indifference-400.woff2")).toString("base64");
  const css = cssRatt.replace(/url\(["']?[^)"']*glacial-indifference-400\.woff2["']?\)/g, `url(data:font/woff2;base64,${fontData})`);
  /** @param {string} tema */
  const sida = (tema) =>
    `<!doctype html><html lang="sv" data-theme="${tema}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body class="bg-canvas text-ink font-sans"><div id="root"></div><script>${js.outputFiles[0].text.replace(/<\/script>/g, "<\\/script>")}</script></body></html>`;

  const { browser, varifran } = await startaWebblasare({ visaRullningslister: true });
  console.log(`check-kontrollyta: webbläsare ${varifran} ${browser.version()}`);
  try {
    for (const tema of TEMAN) {
      for (const vp of BREDDER) {
        const kontext = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, colorScheme: tema });
        const page = await kontext.newPage();
        await page.setContent(sida(tema), { waitUntil: "load" });
        await page.waitForSelector("[data-rullyta]");
        const etikett = `${tema} ${vp.width} px`;

        /** Pixlarna i en ruta, som [r, g, b] per pixel, rad för rad. @param {{ x: number, y: number, width: number, height: number }} clip */
        const pixlar = async (clip) => {
          const png = await page.screenshot({ clip });
          return /** @type {number[][]} */ (
            await page.evaluate(async (b64) => {
              const bild = new Image();
              bild.src = `data:image/png;base64,${b64}`;
              await bild.decode();
              const c = document.createElement("canvas");
              c.width = bild.width;
              c.height = bild.height;
              const x = /** @type {CanvasRenderingContext2D} */ (c.getContext("2d"));
              x.drawImage(bild, 0, 0);
              const d = x.getImageData(0, 0, c.width, c.height).data;
              const ut = [];
              for (let i = 0; i < d.length; i += 4) ut.push([d[i], d[i + 1], d[i + 2]]);
              return ut;
            }, png.toString("base64"))
          );
        };

        const ytor = await page.$$eval("[data-rullyta]", (el) =>
          el.map((e) => {
            const r = e.getBoundingClientRect();
            const s = getComputedStyle(e);
            const kant = parseFloat(s.borderLeftWidth) + parseFloat(s.borderRightWidth);
            return {
              namn: e.getAttribute("data-rullyta"),
              x: r.x,
              y: r.y + window.scrollY,
              hojd: r.height,
              hoger: r.right,
              listbredd: /** @type {HTMLElement} */ (e).offsetWidth - /** @type {HTMLElement} */ (e).clientWidth - kant,
              bg: s.backgroundColor,
            };
          }),
        );
        if (ytor.length < 3) brott.push(`${etikett}: bara ${ytor.length} rullande ytor på mätsidan, väntat 3. Fel sida.`);

        for (const y of ytor) {
          const bg = hex((y.bg.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number));
          if (y.listbredd < 6) {
            brott.push(`${etikett} ${y.namn}: ingen ritad rullningslist (${y.listbredd} px). Utan list finns ingen tumme att mäta.`);
            continue;
          }
          await page.evaluate((yy) => window.scrollTo(0, Math.max(0, yy - 40)), y.y);
          const vy = await page.evaluate(() => window.scrollY);
          const kolumn = { x: Math.round(y.hoger - 1 - y.listbredd / 2), y: Math.round(y.y - vy + 1), width: 1, height: Math.round(y.hojd - 2) };

          /**
           * Tummen är den längsta sammanhängande raden pixlar som skiljer sig från ytan. Pilarna i ändarna är några få
           * pixlar höga och tas därför aldrig för tummen, och mittpixeln är fri från kantutjämning.
           */
          const tumme = async () => {
            const p = await pixlar(kolumn);
            let bast = { start: -1, langd: 0 };
            let start = -1;
            for (let i = 0; i <= p.length; i += 1) {
              const skiljer = i < p.length && contrast(hex(p[i]), bg) > 1.15;
              if (skiljer && start < 0) start = i;
              if (!skiljer && start >= 0) {
                if (i - start > bast.langd) bast = { start, langd: i - start };
                start = -1;
              }
            }
            if (bast.langd < 10) return null;
            const mitt = bast.start + Math.floor(bast.langd / 2);
            return { farg: hex(p[mitt]), y: kolumn.y + mitt, langd: bast.langd };
          };

          await page.mouse.move(1, 1);
          await page.waitForTimeout(150);
          const vila = await tumme();
          if (!vila) {
            brott.push(`${etikett} ${y.namn}: ingen tumme hittades i listen. Mätningen mäter då ingenting.`);
            continue;
          }
          await page.mouse.move(y.x + 40, kolumn.y + y.hojd / 2);
          await page.waitForTimeout(150);
          const ytHover = await tumme();
          await page.mouse.move(kolumn.x, vila.y);
          await page.waitForTimeout(250);
          const tumHover = await tumme();
          await page.mouse.move(1, 1);

          const kv = contrast(vila.farg, bg);
          const ky = ytHover ? contrast(ytHover.farg, bg) : 0;
          const kt = tumHover ? contrast(tumHover.farg, bg) : 0;
          matningar += 3;
          rader.push(
            `  ${etikett.padEnd(13)} ${String(y.namn).padEnd(8)} vila ${vila.farg} ${kv.toFixed(2)}:1   pekaren på ytan ${ytHover?.farg ?? "-"} ${ky.toFixed(2)}:1   pekaren på tummen ${tumHover?.farg ?? "-"} ${kt.toFixed(2)}:1`,
          );
          if (kv < GRAFIK) brott.push(`${etikett} ${y.namn}: tummen ger ${kv.toFixed(2)}:1 i vila (${vila.farg} mot ${bg}). Kravet är ${GRAFIK}:1 (WCAG 1.4.11).`);
          if (ky < kv) brott.push(`${etikett} ${y.namn}: tummen ger ${ky.toFixed(2)}:1 med pekaren på ytan, svagare än vilans ${kv.toFixed(2)}:1. Hover ska vara starkare.`);
          if (kt < GRAFIK) brott.push(`${etikett} ${y.namn}: tummen ger ${kt.toFixed(2)}:1 med pekaren på den. Kravet är ${GRAFIK}:1.`);
          if (kt < kv) brott.push(`${etikett} ${y.namn}: tummen ger ${kt.toFixed(2)}:1 med pekaren på den, svagare än vilans ${kv.toFixed(2)}:1. Hover ska vara starkare.`);
        }

        // ── Väljarens lista: minst lika bred som knappen ──
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.mouse.move(1, 1);
        const knapp = page.locator("[data-valjare] button[role=combobox]");
        await knapp.scrollIntoViewIfNeeded();
        await knapp.click();
        await page.waitForSelector("[role=listbox]");
        await page.waitForTimeout(200);
        const lista = await page.evaluate(() => {
          const k = /** @type {HTMLElement} */ (document.querySelector("[data-valjare] button[role=combobox]")).getBoundingClientRect();
          const l = /** @type {HTMLElement} */ (document.querySelector("[role=listbox]"));
          return { knapp: k.width, lista: l.getBoundingClientRect().width, alternativ: l.querySelectorAll("[role=option]").length };
        });
        matningar += 1;
        rader.push(`  ${etikett.padEnd(13)} väljaren: knappen ${lista.knapp.toFixed(0)} px, listan ${lista.lista.toFixed(0)} px, ${lista.alternativ} alternativ`);
        if (lista.alternativ < 6) brott.push(`${etikett}: väljarens lista har ${lista.alternativ} alternativ, väntat 6. Listan öppnades inte, alltså mättes ingenting.`);
        else if (lista.lista + 0.5 < lista.knapp) {
          brott.push(`${etikett}: väljarens lista är ${lista.lista.toFixed(0)} px och knappen ${lista.knapp.toFixed(0)} px. Listan ska vara minst lika bred som fältet den öppnas ur.`);
        }
        if (bildmapp) {
          // Hela ytan med listan öppen, beskuren till innehållet, och en förstoring av listen på `raised`.
          const ruta = await page.evaluate(() => {
            const a = /** @type {HTMLElement} */ (document.querySelector("[data-yta]")).getBoundingClientRect();
            const l = /** @type {HTMLElement} */ (document.querySelector("[role=listbox]")).getBoundingClientRect();
            const r = /** @type {HTMLElement} */ (document.querySelector("[data-rullyta=raised]")).getBoundingClientRect();
            return { x: a.x, y: a.y, hoger: a.right, botten: Math.max(a.bottom, l.bottom + 16), raised: { x: r.right - 70, y: r.y, width: 70, height: 110 } };
          });
          await page.screenshot({ path: path.join(bildmapp, `${tema}-${vp.width}.png`), clip: { x: ruta.x, y: ruta.y, width: ruta.hoger - ruta.x, height: Math.min(vp.height, ruta.botten) - ruta.y } });
          await page.screenshot({ path: path.join(bildmapp, `${tema}-${vp.width}-detalj.png`), clip: ruta.raised });
        }
        await kontext.close();
      }
    }
  } finally {
    await browser.close();
  }
} finally {
  fs.rmSync(arbetsmapp, { recursive: true, force: true });
}

console.log(rader.join("\n"));
/*
 * ⛔ GOLV: tre mätningar per lista (vila, pekaren på ytan, pekaren på tummen) och en per väljare, i två teman och två
 * bredder. Färre betyder att något inte ritades, och då är grönt inte ett svar.
 */
const golv = TEMAN.length * BREDDER.length * (3 * 3 + 1);
if (matningar < golv && brott.length === 0) brott.push(`bara ${matningar} av ${golv} mätningar gick att göra.`);
if (brott.length) {
  console.error(`\ncheck-kontrollyta: ${brott.length} brott av ${matningar} mätningar\n`);
  for (const b of brott) console.error(`  ${b}`);
  process.exit(1);
}
console.log(`\ncheck-kontrollyta: ${matningar} mätningar, inga brott`);

/**
 * Sätter ihop två `--bilder`-mappar till ett montage per bredd: före och efter, ljust och mörkt.
 * @param {string} fore @param {string} efter @param {string} ut
 */
async function montage(fore, efter, ut) {
  fs.mkdirSync(ut, { recursive: true });
  const { browser } = await startaWebblasare();
  try {
    for (const vp of BREDDER) {
      /** @param {string} mapp @param {string} tema */
      const bild = (mapp, tema) => `data:image/png;base64,${fs.readFileSync(path.join(mapp, `${tema}-${vp.width}.png`)).toString("base64")}`;
      const ruta = (/** @type {string} */ rubrik, /** @type {string} */ src) =>
        `<div><p style="margin:0 0 6px;font:600 15px system-ui;color:#eee">${rubrik}</p><img src="${src}" style="display:block;border:1px solid #444"></div>`;
      /** @param {string} mapp @param {string} tema */
      const detalj = (mapp, tema) => `data:image/png;base64,${fs.readFileSync(path.join(mapp, `${tema}-${vp.width}-detalj.png`)).toString("base64")}`;
      const forstorad = (/** @type {string} */ rubrik, /** @type {string} */ src) =>
        `<div><p style="margin:0 0 6px;font:600 15px system-ui;color:#eee">${rubrik}</p><img src="${src}" style="display:block;width:280px;image-rendering:pixelated;border:1px solid #444"></div>`;
      const smal = vp.width < 600;
      const kol = smal ? 4 : 2;
      const html = `<!doctype html><html><body style="margin:0;background:#111;padding:12px;width:max-content">
        <p style="margin:0 0 10px;font:700 17px system-ui;color:#fff">Rullningslisten och väljarens lista, ${vp.width} px</p>
        <div style="display:grid;grid-template-columns:repeat(${kol}, max-content);gap:16px">
          ${ruta("Före (0.95.0), ljust", bild(fore, "light"))}${ruta("Efter (0.95.1), ljust", bild(efter, "light"))}
          ${ruta("Före (0.95.0), mörkt", bild(fore, "dark"))}${ruta("Efter (0.95.1), mörkt", bild(efter, "dark"))}
        </div>
        <p style="margin:16px 0 10px;font:700 17px system-ui;color:#fff">Listen på raised, fyra gånger förstorad</p>
        <div style="display:grid;grid-template-columns:repeat(4, max-content);gap:16px">
          ${forstorad("Före, ljust", detalj(fore, "light"))}${forstorad("Efter, ljust", detalj(efter, "light"))}
          ${forstorad("Före, mörkt", detalj(fore, "dark"))}${forstorad("Efter, mörkt", detalj(efter, "dark"))}
        </div></body></html>`;
      const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: "load" });
      const fil = path.join(ut, `rullningslist-och-valjare-${vp.width}.jpg`);
      await page.screenshot({ path: fil, fullPage: true, type: "jpeg", quality: 85 });
      await page.close();
      console.log(`montage: ${path.relative(rot, fil)}`);
    }
  } finally {
    await browser.close();
  }
}
