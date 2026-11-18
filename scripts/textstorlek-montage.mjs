#!/usr/bin/env node
/**
 * Skärmbilder och mätning av textstorleken (cllp/lifehub.app#873): Liten, Mellan och Stor sida vid sida, 390 och 1280 px, mot en byggd
 * dist. Ytorna är de ärendet nämner: bottenraden (`fasta`), rubrikerna (`profil`), gruppsidan (`gruppsida`) och chatten (`chattnatt`).
 *
 * Kör: npm run build && node scripts/textstorlek-montage.mjs [--ut <katalog>] [--tokens=<fil>]
 * Förval för katalogen: docs/bilder/textstorlek.
 *
 * ⛔ MÄTNINGEN SKRIVS UT, INTE BARA BILDERNA. För varje yta och bredd: hur många rader varje etikett i bottenraden och varje rubrik
 * bryts på, och varje textelement som KLIPPS (texten går utanför en förälder med `overflow` som inte är `visible`, eller elementet
 * har en fast höjd som är lägre än texten). Ett klipp vid Stor som inte finns vid Mellan är ett fynd.
 *
 * ⛔ Ärendet citerar ingen SessionStudio-bild (SessionStudio har inget textstorleksval), så regel 12 kräver inget montage mot en
 * förebild. Montaget här är de tre lägena bredvid varandra, Mellan i mitten som är dagens storlek.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { startaWebblasare } from "./lib/matVyport.mjs";
import { byggYta } from "./lib/byggYta.mjs";
import { FORVALD_TEXTSTORLEK, TEXTSTORLEKAR, TEXTSTORLEK_ATTRIBUT } from "../src/lib/textstorlek.js";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const i = process.argv.indexOf("--ut");
const ut = path.resolve(i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : path.join(rot, "docs", "bilder", "textstorlek"));
const tokens = process.argv.find((a) => a.startsWith("--tokens="))?.slice(9);
/** `--css=<regler>`: extra CSS i sidan, bara för att bevisa att mätningen ser ett klipp (till exempel en överdriven `--textskala`). */
const extraCss = process.argv.find((a) => a.startsWith("--css="))?.slice(6) ?? "";
fs.mkdirSync(ut, { recursive: true });

const { sida: grund, stada } = await byggYta({ rot, yta: "scripts/lib/skalyta-entry.jsx", namn: "textstorlek-montage", tokens: tokens ? path.resolve(tokens) : undefined });
// Brödtextens typsnitt inbäddat, som i check-skalyta (#448): radbrytningen beror på typsnittet, och systemets sans mäter maskinen.
const jakarta = fs.readFileSync(path.join(rot, "scripts", "lib", "typsnitt", "plus-jakarta-sans", "plus-jakarta-sans-latin-wght.woff2")).toString("base64");
const face = `<style>@font-face{font-family:'Plus Jakarta Sans';font-style:normal;font-weight:200 800;font-display:block;src:url(data:font/woff2;base64,${jakarta}) format('woff2');}</style>`;
const MARK = '<div id="root"></div><script>';
const sist = grund.indexOf(MARK) + MARK.length - "<script>".length;
if (sist < MARK.length) throw new Error("textstorlek-montage: hittar inte appens skript i sidan.");
/** Appen startar först när typsnittet är laddat, så att komponenter som mäter sin text vid första ritningen mäter rätt typsnitt. */
const sida = (/** @type {string} */ scen, /** @type {string | null} */ aktiv, /** @type {string} */ lage) => {
  const skript = grund.slice(sist + 8, grund.lastIndexOf("</script></body>"));
  const html = grund.slice(0, sist).replace("</head>", `${face}${extraCss ? `<style>${extraCss}</style>` : ""}</head>`) +
    `<script>window.__skal=${JSON.stringify(scen)};window.__aktiv=${JSON.stringify(aktiv)};window.__manga=0;</script>` +
    `<script>window.__start=function(){${skript}};document.fonts.load('400 16px "Plus Jakarta Sans"').then(function(){window.__start()},function(){window.__start()});</script></body></html>`;
  return lage === FORVALD_TEXTSTORLEK ? html : html.replace('<html lang="sv">', `<html lang="sv" ${TEXTSTORLEK_ATTRIBUT}="${lage}">`);
};

const YTOR = [
  { scen: "fasta", aktiv: null, namn: "bottenraden" },
  { scen: "profil", aktiv: null, namn: "rubrikerna" },
  { scen: "gruppsida", aktiv: null, namn: "gruppsidan" },
  { scen: "chattnatt", aktiv: "grupp", namn: "chatten" },
  // Bara mätta, utan montage: fler ytor där en fast höjd kan klippa (dagens kort, kalenderns rutor, händelsen, arket, inställningarna).
  { scen: "idag", aktiv: null, namn: "idag", utanBild: true },
  { scen: "kalender", aktiv: null, namn: "kalendern", utanBild: true },
  { scen: "handelse", aktiv: null, namn: "handelsen", utanBild: true },
  { scen: "apparark", aktiv: null, namn: "apparna", utanBild: true },
  { scen: "installningar", aktiv: null, namn: "installningar", utanBild: true },
];
const BREDDER = [
  [390, 844],
  [1280, 900],
];

const { browser, varifran } = await startaWebblasare();
console.log(`webbläsare: ${varifran}`);

/** Mäter radbrytning och klipp i sidan som den står. */
const MATNING = () => {
  /** @param {Element} el */
  const egenText = (el) => [...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join("").replace(/\s+/g, " ").trim();
  /** @param {Element} el */
  const rader = (el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    const tops = new Set([...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top)));
    return tops.size;
  };
  const klipp = [];
  let texter = 0;
  for (const el of document.querySelectorAll("body *")) {
    const t = egenText(el);
    if (!t || t.length < 2) continue;
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    texter += 1;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || el.closest(".sr-only")) continue;
    // Textens egen yta (en Range över elementets textnoder), inte elementets: en text som rinner ur en ruta med fast storlek och
    // `overflow: visible` (en avatars initialer i en cirkel) syns bara så.
    const r = document.createRange();
    const noder = [...el.childNodes].filter((c) => c.nodeType === 3 && (c.textContent ?? "").trim());
    r.setStartBefore(noder[0]);
    r.setEndAfter(noder[noder.length - 1]);
    const tb = r.getBoundingClientRect();
    const ute = (/** @type {DOMRect} */ ram) => tb.left < ram.left - 1 || tb.right > ram.right + 1 || tb.top < ram.top - 1 || tb.bottom > ram.bottom + 1;
    const beskriv = (/** @type {Element} */ x) => `${x.tagName.toLowerCase()}.${String(x.className).split(" ").filter(Boolean).slice(0, 3).join(".")}`;
    // Rutan texten ska rymmas i: elementet, eller för en inline-text närmaste förälder som är en ruta. En avsiktlig ellips
    // (`truncate`) är inget klipp, den säger att texten fortsätter.
    let ruta = /** @type {Element} */ (el);
    while (ruta.parentElement && getComputedStyle(ruta).display === "inline") ruta = ruta.parentElement;
    const ellips = cs.textOverflow === "ellipsis" || getComputedStyle(ruta).textOverflow === "ellipsis";
    const rb = ruta.getBoundingClientRect();
    if (!ellips && ute(rb)) {
      klipp.push(`"${t.slice(0, 40)}": texten ${Math.round(tb.width)}x${Math.round(tb.height)} px rinner ur sin ruta ${Math.round(rb.width)}x${Math.round(rb.height)} px (${beskriv(ruta)})`);
      continue;
    }
    if (ellips) continue;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const pcs = getComputedStyle(p);
      if (pcs.overflowY === "auto" || pcs.overflowY === "scroll" || pcs.overflowX === "auto" || pcs.overflowX === "scroll") break;
      if (pcs.overflowY === "visible" && pcs.overflowX === "visible") continue;
      if (ute(p.getBoundingClientRect()) && pcs.textOverflow !== "ellipsis") {
        klipp.push(`"${t.slice(0, 40)}": texten klipps av ${beskriv(p)} (${Math.round(p.getBoundingClientRect().width)}x${Math.round(p.getBoundingClientRect().height)} px)`);
      }
      break;
    }
  }
  // Bottenradens knappar: radbrytning, och om etiketten går utanför sin knapp (då krockar den med grannen).
  const nav = [...document.querySelectorAll("[data-ops-bottenrad] a, [data-ops-bottenrad] button")]
    .map((a) => {
      const spans = [...a.querySelectorAll("span")].filter((x) => (x.textContent ?? "").trim() && !x.querySelector("span"));
      const kb = a.getBoundingClientRect();
      const utanfor = spans.some((x) => {
        const rr = document.createRange();
        rr.selectNodeContents(x);
        const b = rr.getBoundingClientRect();
        return b.width > 0 && (b.left < kb.left - 1 || b.right > kb.right + 1);
      });
      return { t: (a.textContent ?? "").trim(), r: spans.map(rader).reduce((x, y) => Math.max(x, y), 0), utanfor };
    })
    .filter((x) => x.t);
  for (const n of nav) if (n.utanfor) klipp.push(`bottenraden "${n.t}": etiketten går utanför sin knapp`);
  const rubriker = [...document.querySelectorAll("h1, h2, h3")].filter((h) => h.getBoundingClientRect().width > 0).map((h) => ({ t: (h.textContent ?? "").trim().slice(0, 40), r: rader(h) }));
  const sidled = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  // Fältens storlek: under 16 px zoomar iOS in sidan när fältet får fokus.
  const falt = [...document.querySelectorAll('input:not([type="checkbox"], [type="radio"], [type="range"], [type="hidden"]), textarea')]
    .filter((f) => f.getBoundingClientRect().width > 0)
    .map((f) => Number.parseFloat(getComputedStyle(f).fontSize));
  return { klipp: [...new Set(klipp)], nav, rubriker, sidled, texter, falt };
};

/** @type {Record<string, any>} */
const resultat = {};
try {
  for (const yta of YTOR) {
    for (const [bredd, hojd] of BREDDER) {
      const bilder = [];
      for (const lage of TEXTSTORLEKAR) {
        // 390 px är en telefon med pekskärm (`pointer: coarse`): där gäller fältens golv på 16 px, som iOS kräver.
        const context = await browser.newContext({ viewport: { width: bredd, height: hojd }, deviceScaleFactor: 1, ...(bredd < 768 ? { hasTouch: true, isMobile: true } : {}) });
        const page = await context.newPage();
        page.setDefaultTimeout(6000);
        const fel = /** @type {string[]} */ ([]);
        page.on("pageerror", (e) => fel.push(e.message));
        if (yta.scen === "chattnatt") {
          await page.clock.setFixedTime(new Date(2026, 9, 6, 22, 0));
          await page.emulateMedia({ reducedMotion: "reduce" });
        }
        if (process.env.TEXTSTORLEK_SPARA_SIDA) fs.writeFileSync(path.join(ut, `${yta.namn}-${bredd}-${lage}.html`), sida(yta.scen, yta.aktiv, lage));
        await page.setContent(sida(yta.scen, yta.aktiv, lage));
        await page.waitForFunction("window.__redo === true", null, { timeout: 5000 }).catch(() => {});
        await page.evaluate(async () => {
          await document.fonts.ready;
        });
        await page.waitForTimeout(400);
        if (fel.length) throw new Error(`textstorlek-montage: "${yta.scen}" kastade: ${fel[0]}`);
        const r = await page.evaluate(MATNING);
        // ⛔ GOLV: en yta utan text är en tom sida, aldrig "noll klipp" (arbetsreglernas punkt 4, tomt underlag).
        if (r.texter < 5) throw new Error(`textstorlek-montage: "${yta.scen}" ${bredd} px ${lage} ritade ${r.texter} textelement. Sidan renderade inte.`);
        resultat[`${yta.namn} ${bredd} ${lage}`] = r;
        if (!yta.utanBild) {
          const fil = path.join(ut, `${yta.namn}-${bredd}-${lage}.png`);
          await page.screenshot({ path: fil });
          bilder.push({ lage, data: fs.readFileSync(fil).toString("base64") });
        }
        await context.close();
      }
      if (yta.utanBild) continue;
      // Montaget: de tre lägena bredvid varandra, med läget som rubrik.
      const context = await browser.newContext({ viewport: { width: Math.min(bredd, 1280) * 3 + 64, height: hojd + 60 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      await page.setContent(
        `<!doctype html><html><body style="margin:0;background:#888;font:600 20px sans-serif;display:flex;gap:16px;padding:16px">${bilder
          .map((b) => `<figure style="margin:0"><figcaption style="color:#fff;padding:0 0 8px">${b.lage}</figcaption><img style="display:block;width:${bredd}px" src="data:image/png;base64,${b.data}"></figure>`)
          .join("")}</body></html>`,
      );
      await page.screenshot({ path: path.join(ut, `montage-${yta.namn}-${bredd}.png`), fullPage: true });
      await context.close();
    }
  }
} finally {
  await browser.close();
  stada();
}

for (const [nyckel, r] of Object.entries(resultat)) {
  const nav = r.nav.length ? ` bottenraden: ${r.nav.map((/** @type {any} */ n) => `${n.t} ${n.r} rad`).join(", ")}.` : "";
  const rub = r.rubriker.filter((/** @type {any} */ h) => h.r > 1).map((/** @type {any} */ h) => `"${h.t}" ${h.r} rader`).join(", ");
  const falt = r.falt.length ? ` Fält: ${[...new Set(r.falt)].join(", ")} px.` : "";
  console.log(`${nyckel}: ${r.klipp.length} klipp, sidled ${r.sidled} px.${nav}${rub ? ` Rubriker på flera rader: ${rub}.` : ""}${falt}`);
  for (const k of r.klipp) console.log(`    klipp: ${k}`);
}
// ⛔ FYNDET ÄR SKILLNADEN MOT MELLAN. En text som redan rinner ur sin ruta vid Mellan (märkets undertext på 9,5 px med en radhöjd
// lägre än glyferna) är dagens läge och inte textstorlekens; ett klipp som bara finns vid Liten eller Stor är det.
let nya = 0;
for (const yta of YTOR) {
  for (const [bredd] of BREDDER) {
    const bas = new Set(resultat[`${yta.namn} ${bredd} ${FORVALD_TEXTSTORLEK}`].klipp.map((/** @type {string} */ k) => k.split(":")[0]));
    for (const lage of TEXTSTORLEKAR) {
      if (lage === FORVALD_TEXTSTORLEK) continue;
      const r = resultat[`${yta.namn} ${bredd} ${lage}`];
      const extra = r.klipp.filter((/** @type {string} */ k) => !bas.has(k.split(":")[0]));
      const navMer = r.nav.filter((/** @type {any} */ n, /** @type {number} */ j) => n.r > (resultat[`${yta.namn} ${bredd} ${FORVALD_TEXTSTORLEK}`].nav[j]?.r ?? 0));
      nya += extra.length + navMer.length;
      for (const k of extra) console.log(`NYTT vid ${lage}, ${yta.namn} ${bredd} px: ${k}`);
      for (const n of navMer) console.log(`NYTT vid ${lage}, ${yta.namn} ${bredd} px: bottenradens "${n.t}" bryts på ${n.r} rader`);
    }
  }
}
console.log(`${nya} nya klipp eller radbrytningar i bottenraden jämfört med Mellan.`);
fs.writeFileSync(path.join(ut, "matning.json"), `${JSON.stringify(resultat, null, 2)}\n`);
console.log(`bilder och matning.json i ${path.relative(rot, ut)}`);
