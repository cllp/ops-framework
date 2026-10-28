#!/usr/bin/env node
/**
 * Mätning: kontot i den publika toppraden trycker inte ut raden, mätt i en riktig webbläsare (0.150.0, #352).
 *
 * ══ VARFÖR ══════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * `OpsPublikHuvud` fick en prop `konto` som ersätter Logga in och accentknappen och, under `md`, står bredvid hamburgaren. Att
 * den ritas och står i rätt ordning provas i jsdom (`publik-konto.test.jsx`), men jsdom kör ingen CSS: att raden RYMMER en
 * avatar på 320 px, att loggan ligger kvar där den låg och att ingen horisontell rullning uppstår går bara att mäta här.
 *
 * ══ VAD DEN MÄTER, i 320, 360, 390, 768 och 1280 px ═════════════════════════════════════════════════════════════
 *
 *   1. Ingen horisontell rullning på sidan.
 *   2. Loggan ligger på exakt samma plats MED ett konto som UTAN (rätt `getBoundingClientRect`): ett konto flyttar inte märket.
 *   3. Loggan, kontot och (under `md`) hamburgaren överlappar inte varandra, i den ordningen från vänster.
 *   4. Hela klustret ligger inom radens sidomarginaler, och kontot inom toppradens höjd.
 *   5. Under `md` syns hamburgaren; från `md` är den borta och Logga in och accentknappen är ersatta av kontot.
 *
 * ⛔ GOLV: minst 5 vyportar och minst 40 mätningar. ⛔ FAIL-CLOSED när webbläsaren saknas.
 * ⛔ RÖTT UTAN RÄTT RAD: `--bevisa` ritar ett konto som är för brett för 320 px och kräver rött (arbetsreglernas punkt 4).
 *
 * Kör:  npm run build && node scripts/konto-matt.mjs
 *       node scripts/konto-matt.mjs --bevisa
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { startaWebblasare } from "./lib/matVyport.mjs";
import { byggYta } from "./lib/byggYta.mjs";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bevisa = process.argv.includes("--bevisa");
const VYPORTAR = [320, 360, 390, 768, 1280];
const MD = 768;

if (!fs.existsSync(path.join(rot, "dist", "index.js"))) {
  console.error("konto-matt: dist/index.js saknas. Kör `npm run build` först.");
  process.exit(1);
}

const { sida, stada } = await byggYta({ rot, yta: "scripts/lib/konto-yta.jsx", namn: "konto" });
const { browser } = await startaWebblasare();

/** @type {string[]} */ const brott = [];
let matningar = 0;
/** @param {boolean} ok @param {string} skal */
const krav = (ok, skal) => {
  matningar += 1;
  if (!ok) brott.push(skal);
};

/**
 * @param {number} bredd @param {"ingen" | "avatar" | "bred"} konto
 */
async function mat(bredd, konto) {
  const context = await browser.newContext({ viewport: { width: bredd, height: 700 } });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(4000);
    const fel = /** @type {string[]} */ ([]);
    page.on("pageerror", (e) => fel.push(e.message));
    // Scenariot sätts i själva sidan, före paketet: `addInitScript` körs inte för `setContent`.
    await page.setContent(sida.replace('<div id="root"></div>', `<div id="root"></div><script>window.__prov = ${JSON.stringify({ konto })};</script>`));
    await page.waitForFunction("window.__redo === true", null, { timeout: 5000 }).catch(() => {});
    if (fel.length) throw new Error(`provsidan kastade: ${fel[0]}`);
    return await page.evaluate(() => {
      const r = (/** @type {Element | null} */ el) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height };
      };
      const nav = document.querySelector("nav[data-ops-publik='huvud']");
      const rad = nav?.firstElementChild ?? null;
      const stil = rad ? getComputedStyle(rad) : null;
      const kontoPlats = document.querySelector("[data-publik-konto]");
      const hamburgare = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Öppna meny") ?? null;
      const synlig = (/** @type {Element | null} */ el) => Boolean(el) && /** @type {HTMLElement} */ (el).offsetParent !== null && /** @type {HTMLElement} */ (el).getBoundingClientRect().width > 0;
      const text = (/** @type {string} */ t) => [...document.querySelectorAll("a")].some((a) => a.textContent === t && /** @type {HTMLElement} */ (a).offsetParent !== null);
      return {
        scrollBredd: document.documentElement.scrollWidth,
        // Radens egen bredd och inte fönstrets: tokens har `scrollbar-gutter: stable`, så en webbläsare med rullningslist reserverar
        // 10 px till höger (310 px raden i ett 320 px fönster). Raden mäts mot det den faktiskt får, vilket är det snävare fallet.
        innerBredd: rad ? rad.getBoundingClientRect().right : window.innerWidth,
        fonsterBredd: window.innerWidth,
        logga: r(document.querySelector("[data-publik-logga]")),
        nav: r(nav),
        kontoPlats: r(kontoPlats),
        kluster: r(kontoPlats?.parentElement ?? null),
        hamburgare: synlig(hamburgare) ? r(hamburgare) : null,
        padVanster: stil ? parseFloat(stil.paddingLeft) : 0,
        padHoger: stil ? parseFloat(stil.paddingRight) : 0,
        loggaInSynlig: text("Logga in"),
        komSynlig: text("Kom igång"),
        kontoSynligt: synlig(kontoPlats),
      };
    });
  } finally {
    await context.close();
  }
}

const rader = /** @type {string[]} */ ([]);
for (const bredd of VYPORTAR) {
  const utan = await mat(bredd, "ingen");
  const med = await mat(bredd, bevisa ? "bred" : "avatar");
  const namn = `${bredd} px`;
  const L = /** @type {any} */ (med.logga);
  const K = /** @type {any} */ (med.kluster);
  const P = /** @type {any} */ (med.kontoPlats);
  const H = /** @type {any} */ (med.hamburgare);
  const N = /** @type {any} */ (med.nav);

  krav(med.scrollBredd <= med.innerBredd + 0.5, `${namn}: sidan rullar i sidled (${med.scrollBredd} px mot raden ${med.innerBredd} px)`);
  krav(Boolean(L && utan.logga && Math.abs(L.left - utan.logga.left) < 0.5 && Math.abs(L.top - utan.logga.top) < 0.5), `${namn}: loggan flyttar sig när ett konto ritas (${L?.left} mot ${utan.logga?.left})`);
  krav(med.kontoSynligt && Boolean(P), `${namn}: kontot syns inte`);
  if (!K || !P || !N || !L) continue;
  krav(L.right + 16 <= K.left + 0.5, `${namn}: loggan (till ${L.right.toFixed(1)}) och kontoklustret (från ${K.left.toFixed(1)}) har mindre än 16 px mellan sig`);
  krav(K.right <= med.innerBredd - med.padHoger + 0.5, `${namn}: klustret går ${(K.right - (med.innerBredd - med.padHoger)).toFixed(1)} px över högermarginalen`);
  krav(L.left >= med.padVanster - 0.5, `${namn}: loggan går utanför vänstermarginalen`);
  krav(P.top >= N.top - 0.5 && P.bottom <= N.bottom + 0.5, `${namn}: kontot (${P.top.toFixed(1)} till ${P.bottom.toFixed(1)}) ligger utanför toppraden (${N.top.toFixed(1)} till ${N.bottom.toFixed(1)})`);
  if (bredd < MD) {
    krav(Boolean(H), `${namn}: hamburgaren syns inte under md`);
    if (H) krav(P.right <= H.left + 0.5, `${namn}: kontot (till ${P.right.toFixed(1)}) överlappar hamburgaren (från ${H.left.toFixed(1)})`);
  } else {
    krav(!H, `${namn}: hamburgaren syns från md`);
  }
  krav(!med.loggaInSynlig && !med.komSynlig, `${namn}: Logga in eller accentknappen syns trots kontot`);
  rader.push(`${namn} (raden ${med.innerBredd} px): logga ${L.left.toFixed(0)}-${L.right.toFixed(0)}, konto ${P.left.toFixed(0)}-${P.right.toFixed(0)}${H ? `, hamburgare ${H.left.toFixed(0)}-${H.right.toFixed(0)}` : ""}, luft mellan loggan och klustret ${(K.left - L.right).toFixed(1)} px (minst 16), marginal kvar till höger ${(med.innerBredd - med.padHoger - K.right).toFixed(1)} px`);
}
await browser.close();
stada();

console.log(rader.join("\n"));
krav(VYPORTAR.length >= 5 && rader.length === VYPORTAR.length, `golvet: ${rader.length} av ${VYPORTAR.length} vyportar mättes helt`);
if (matningar < 40) brott.push(`golvet: ${matningar} mätningar, minst 40 krävs. Ett prov som mäter för lite är grönt av en tom anledning.`);

if (bevisa) {
  if (brott.length === 0) {
    console.error("konto-matt --bevisa: provet blev GRÖNT för ett konto som inte får plats. Då mäter det ingenting.");
    process.exit(1);
  }
  console.log(`konto-matt --bevisa: rött som väntat för ett för brett konto (${brott.length} brott, t.ex. ${brott[0]}).`);
  process.exit(0);
}
if (brott.length) {
  console.error(`konto-matt: ${brott.length} brott:\n  ${brott.join("\n  ")}`);
  process.exit(1);
}
console.log(`konto-matt: ${matningar} mätningar i ${VYPORTAR.join(", ")} px, inga brott.`);
