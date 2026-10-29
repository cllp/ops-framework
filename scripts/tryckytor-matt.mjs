#!/usr/bin/env node
/**
 * Mätning: tryckytor och överlapp på listrader, i knappar, bilagor och toasten, mätt i en riktig webbläsare (0.153.0, cllp/ops-framework#460 punkt 1 och 2).
 *
 * ══ VARFÖR ══════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * lifehub.app mäter sina åtta sidor (`check:layout`, lifehub.app#246) och hittade att ramverkets form bär det som stod kvar under taket: listradens titel är en knapp på 20 px, chevronen
 * ligger över ärendenumret (`#1`), `OpsButton` i storlek `sm` är 32 till 36 px hög och bilagelänkar är 17 till 20 px. Appen kan inte laga det: formen är ramverkets. jsdom ritar ingen CSS, så inget prov i
 * sviten såg det. Den här mätningen använder SAMMA kriterier som appens (`web/scripts/lib/matLayout.mjs`), mot ramverkets egna komponenter i den form appen ritar dem, så att en ändring här syns som en
 * siffra innan den når appen och inte först efter ompinningen.
 *
 * ══ VAD DEN MÄTER, vid 390 px (telefon) och 1280 px (dator) ═════════════════════════════════════════════════════
 *
 *   1. TRYCKYTA (bara 390 px): varje kontroll en tumme ska träffa är minst 44 px hög (en bildpunkt tolerans, som appens). En länk inne i löptext (inline, inuti ett stycke) är undantagen, som i appen.
 *   2. ÖVERLAPP (båda bredderna): två kontroller i samma lager vars rutor skär varandra mer än 4 px i båda riktningar, där det som ligger överst i skärningens mitt är den ena av dem. Chevronen får alltså
 *      inte ligga över ärendenumret eller över en lång titel, och toastens åtgärd inte över dess stängknapp.
 *   3. RADENS YTA: ett tryck var som helst på en rad med en titelknapp eller titellänk träffar titeln (`elementFromPoint` i radens fyra hörn och mitt), så att tryckområdet täcker hela raden
 *      även om titelns egen ruta är en rad hög.
 *   4. RADENS HÖJD rapporteras (ingen gräns): en ändring som gör raderna högre ska synas som en siffra i PR-texten, inte upptäckas av den som skrollar (CLAUDE.md, "gör det här att någon tittar mer på skärmen?").
 *
 * ⛔ GOLV: minst 20 kontroller vid varje bredd, och varje slag som ska mätas (titelknapp, titellänk, ärendenummer, chevron, `sm`-knapp, ikonknapp `sm`, filbilaga, toastens åtgärd) måste ha setts.
 *    En mätning som blev grön av att inget fanns att mäta har inte mätt något (arbetsreglernas punkt 4). ⛔ FAIL-CLOSED när webbläsaren saknas.
 * ⛔ BEVISAD ÅT BÅDA HÅLLEN: `--bevisa` planterar en layoutbugg per slag (alla knappar och länkar 20 px höga; kontroller flyttade över varandra) och kräver att just det slaget blir rött.
 *    `--dist <fil>` mäter en ANNAN byggd version (före-läget mot origin/main), och PR-texten visar båda utfallen.
 *
 * Kör:  npm run build && node scripts/tryckytor-matt.mjs
 *       node scripts/tryckytor-matt.mjs --bevisa
 *       node scripts/tryckytor-matt.mjs --dist <dist/index.js>    mät en annan version
 *       node scripts/tryckytor-matt.mjs --rapport                 skriv ut varje slags mått
 */

/* global window, document, getComputedStyle, HTMLInputElement -- ⛔ `matIWebblasaren` körs i webbläsaren (`page.evaluate`), där de finns. */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { startaWebblasare } from "./lib/matVyport.mjs";
import { byggYta } from "./lib/byggYta.mjs";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const bevisa = argv.includes("--bevisa");
const rapport = argv.includes("--rapport");
const varde = (/** @type {string} */ flagga) => (argv.includes(flagga) ? argv[argv.indexOf(flagga) + 1] : undefined);
const annanDist = varde("--dist") ? path.resolve(/** @type {string} */ (varde("--dist"))) : undefined;

const BREDDER = [
  { namn: "telefon 390", bredd: 390, hojd: 900, tumme: true },
  { namn: "dator 1280", bredd: 1280, hojd: 900, tumme: false },
];
const TRAFFYTA_MIN = 44;
const TOLERANS = 1;
const OVERLAPP_MIN = 4;
const GOLV_KONTROLLER = 20;

/**
 * Slagen som mäts, med hur de hittas på ytan. `min` är det minsta antal som måste ha setts.
 * @type {ReadonlyArray<{ slag: string, valjare: string, min: number }>}
 */
const SLAG = [
  { slag: "titelknapp", valjare: "[data-radlank]", min: 1 },
  { slag: "titellänk", valjare: "[data-handelselank]", min: 1 },
  { slag: "ärendenummer", valjare: 'a[href*="/issues/"]', min: 3 },
  { slag: "chevron", valjare: "button[aria-expanded]", min: 3 },
  { slag: "sm-knapp", valjare: 'main section[data-yta="knappar"] button:not([aria-label])', min: 4 },
  { slag: "ikonknapp sm", valjare: 'main section[data-yta="knappar"] button[aria-label="Mer"]', min: 1 },
  { slag: "ta bort (kommentar)", valjare: 'section[data-yta="kommentarer"] li button', min: 1 },
  { slag: "filbilaga", valjare: "a[download]", min: 1 },
  { slag: "toastens åtgärd", valjare: "[data-toast-atgard] button:not([aria-label])", min: 1 },
];

/**
 * Det som mäts, körs i webbläsaren. Samma kriterier som lifehub.app:s `matIWebblasaren` (web/scripts/lib/matLayout.mjs, #246), för punkterna tryckyta och överlapp.
 * @param {{ tumme: boolean, min: number, overlappMin: number, tolerans: number, slag: ReadonlyArray<{ slag: string, valjare: string, min: number }> }} p
 */
function matIWebblasaren({ tumme, min, overlappMin, tolerans, slag }) {
  /** @param {Element} el */
  const namn = (el) => {
    const text = (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30);
    return `${el.tagName.toLowerCase()}[${text}]`;
  };
  const VALJARE = 'button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [role="menuitem"], [role="switch"], [role="checkbox"], [role="radio"], [role="combobox"]';
  /** @param {Element} el */
  const synlig = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) === 0) return false;
    if (el.closest("[aria-hidden='true'], [inert], [hidden]")) return false;
    return true;
  };
  const kontroller = Array.from(document.querySelectorAll(VALJARE)).filter(synlig);
  /** @param {Element} el */
  const lager = (el) => {
    for (let p = /** @type {Element | null} */ (el); p && p !== document.body; p = p.parentElement) {
      const pos = getComputedStyle(p).position;
      if (pos === "fixed" || pos === "sticky") return p;
    }
    return null;
  };
  /** @type {string[]} */
  const overlapp = [];
  for (let i = 0; i < kontroller.length; i += 1) {
    const a = kontroller[i];
    const ra = a.getBoundingClientRect();
    for (let j = i + 1; j < kontroller.length; j += 1) {
      const b = kontroller[j];
      if (a.contains(b) || b.contains(a)) continue;
      if (lager(a) !== lager(b)) continue;
      const rb = b.getBoundingClientRect();
      const x1 = Math.max(ra.left, rb.left);
      const x2 = Math.min(ra.right, rb.right);
      const y1 = Math.max(ra.top, rb.top);
      const y2 = Math.min(ra.bottom, rb.bottom);
      if (x2 - x1 <= overlappMin || y2 - y1 <= overlappMin) continue;
      const overst = document.elementFromPoint((x1 + x2) / 2, (y1 + y2) / 2);
      if (!overst || !(a.contains(overst) || b.contains(overst))) continue;
      overlapp.push(`${namn(a)} och ${namn(b)} (${Math.round(x2 - x1)}x${Math.round(y2 - y1)} px)`);
    }
  }
  /** @type {string[]} */
  const smala = [];
  if (tumme) {
    for (const el of kontroller) {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (el.tagName === "A" && s.display === "inline" && el.closest("p, li, span, dd, td, label, h1, h2, h3, h4")) continue;
      if (r.height < min - tolerans || (r.width < min - tolerans && (el.tagName === "BUTTON" || el.getAttribute("role") === "button") && !el.textContent?.trim())) {
        smala.push(`${namn(el)} är ${Math.round(r.width)}x${Math.round(r.height)} px`);
      }
    }
  }
  // Varje slag: antal sedda och minsta/största ruta.
  const slagmatt = slag.map((s) => {
    const alla = Array.from(document.querySelectorAll(s.valjare)).filter(synlig);
    const mått = alla.map((e) => e.getBoundingClientRect());
    return {
      slag: s.slag,
      antal: alla.length,
      minHojd: mått.length ? Math.round(Math.min(...mått.map((r) => r.height))) : 0,
      minBredd: mått.length ? Math.round(Math.min(...mått.map((r) => r.width))) : 0,
    };
  });
  // Radens yta: ett tryck i radens hörn och mitt träffar radens titel (knapp eller länk), så tryckområdet täcker hela raden.
  /** @type {Array<{ rad: string, traffar: number, av: number, hojd: number }>} */
  const rader = [];
  for (const li of Array.from(document.querySelectorAll('section[data-yta="lista"] > ul > li'))) {
    const titel = li.querySelector("[data-radlank], [data-handelselank]");
    if (!titel) continue;
    const kort = /** @type {HTMLElement} */ (li.firstElementChild ?? li);
    const r = kort.getBoundingClientRect();
    // 14 px in från hörnen: kortet har 24 px rundning, och `::after` följer den, så ett tryck i själva hörnet träffar inte kortet.
    const punkter = [
      [r.left + 14, r.top + 14],
      [r.right - 14, r.bottom - 14],
      [r.left + r.width / 2, r.top + r.height / 2],
      [r.left + 14, r.bottom - 14],
    ];
    let traffar = 0;
    for (const [x, y] of punkter) {
      const e = document.elementFromPoint(x, y);
      // Ett tryck som landar på en annan kontroll på raden (chevronen, ärendenumret) är avsiktligt: de har `z-10` och tar sina egna tryck.
      if (e && (titel.contains(e) || e.closest("button, a[href]") !== null)) traffar += 1;
    }
    rader.push({ rad: (li.textContent ?? "").trim().slice(0, 24), traffar, av: punkter.length, hojd: Math.round(r.height) });
  }
  return { overlapp, smala, kontroller: kontroller.length, slagmatt, rader, bredd: window.innerWidth };
}

/** Layoutbuggarna som beviset planterar: CSS ovanpå ytan. Varje bugg ska göra JUST sitt slag rött. */
const PLANTERADE = {
  tryckyta: "main button, main a[href] { min-height: 0 !important; height: 20px !important; padding-top: 0 !important; padding-bottom: 0 !important; }",
  overlapp: "main button[aria-expanded] { right: 60% !important; } main a[href*='/issues/'] { position: relative !important; left: -40px !important; }",
};

if (!fs.existsSync(annanDist ?? path.join(rot, "dist", "index.js"))) {
  console.error("tryckytor-matt: dist/index.js saknas. Kör `npm run build` först.");
  process.exit(1);
}

const { sida, stada } = await byggYta({ rot, yta: "scripts/lib/tryckytor-yta.jsx", namn: "tryckytor", dist: annanDist });
const { browser } = await startaWebblasare();

/**
 * @param {typeof BREDDER[number]} vy @param {string} [plantera]
 */
async function mat(vy, plantera) {
  const context = await browser.newContext({ viewport: { width: vy.bredd, height: vy.hojd } });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(4000);
    /** @type {string[]} */
    const fel = [];
    page.on("pageerror", (e) => fel.push(e.message));
    await page.setContent(sida);
    await page.waitForFunction("window.__redo === true", null, { timeout: 5000 }).catch(() => {});
    if (fel.length) throw new Error(`provsidan kastade: ${fel[0]}`);
    await page.waitForSelector("[data-toast-atgard]", { timeout: 4000 }).catch(() => {});
    if (plantera) await page.addStyleTag({ content: plantera });
    await page.waitForTimeout(150);
    return await page.evaluate(matIWebblasaren, { tumme: vy.tumme, min: TRAFFYTA_MIN, overlappMin: OVERLAPP_MIN, tolerans: TOLERANS, slag: SLAG });
  } finally {
    await context.close();
  }
}

/** @type {string[]} */ const brott = [];
let matningar = 0;
let kontrollerSedda = 0;
/** @param {boolean} ok @param {string} skal */
const krav = (ok, skal) => {
  matningar += 1;
  if (!ok) brott.push(skal);
};

try {
  if (bevisa) {
    // Beviset: den orörda ytan ger X fynd, den med buggen fler. Utan beviset är en grön mätning bara en mätning som aldrig sett något rött.
    const vy = BREDDER[0];
    const ren = await mat(vy);
    const tryckyta = await mat(vy, PLANTERADE.tryckyta);
    const overl = await mat(vy, PLANTERADE.overlapp);
    krav(tryckyta.smala.length > ren.smala.length, `buggen "tryckyta" gav ${tryckyta.smala.length} fynd mot ${ren.smala.length} utan: mätningen är blind för tryckytor`);
    krav(overl.overlapp.length > ren.overlapp.length, `buggen "overlapp" gav ${overl.overlapp.length} fynd mot ${ren.overlapp.length} utan: mätningen är blind för överlapp`);
    console.log(`tryckytor-matt: beviset (telefon 390): tryckyta ${ren.smala.length} fynd utan buggen, ${tryckyta.smala.length} med; överlapp ${ren.overlapp.length} utan, ${overl.overlapp.length} med.`);
  } else {
    for (const vy of BREDDER) {
      const m = await mat(vy);
      kontrollerSedda += m.kontroller;
      krav(m.kontroller >= GOLV_KONTROLLER, `${vy.namn}: bara ${m.kontroller} kontroller sågs, golvet är ${GOLV_KONTROLLER}. Ytan ritades inte som den ska.`);
      for (const s of SLAG) {
        const sett = m.slagmatt.find((x) => x.slag === s.slag);
        krav((sett?.antal ?? 0) >= s.min, `${vy.namn}: slaget "${s.slag}" sågs ${sett?.antal ?? 0} gånger, golvet är ${s.min}. Det som ska mätas fanns inte på ytan.`);
      }
      for (const o of m.overlapp) krav(false, `${vy.namn}: överlapp, ${o}.`);
      for (const t of m.smala) krav(false, `${vy.namn}: tryckyta, ${t} (golvet är ${TRAFFYTA_MIN} px).`);
      krav(m.rader.length >= 4, `${vy.namn}: bara ${m.rader.length} rader med titel sågs, golvet är 4.`);
      for (const r of m.rader) krav(r.traffar === r.av, `${vy.namn}: ett tryck på raden "${r.rad}" träffar bara titeln eller en kontroll på ${r.traffar} av ${r.av} punkter. Tryckområdet täcker inte hela raden.`);
      if (rapport) {
        console.log(`\n${vy.namn}: ${m.kontroller} kontroller`);
        for (const s of m.slagmatt) console.log(`  ${s.slag.padEnd(22)} ${String(s.antal).padStart(2)} st, minsta höjd ${s.minHojd} px, minsta bredd ${s.minBredd} px`);
        console.log(`  radernas höjd (px): ${m.rader.map((r) => r.hojd).join(", ")}`);
      }
    }
  }
} finally {
  stada();
  await browser.close();
}

if (brott.length > 0) {
  console.error(`tryckytor-matt: RÖTT. ${brott.length} av ${matningar} krav bröts.`);
  for (const b of brott) console.error(`  ${b}`);
  process.exit(1);
}
console.log(`tryckytor-matt: ${matningar} krav uppfyllda${bevisa ? " (beviset)" : `, ${kontrollerSedda} kontroller sedda vid ${BREDDER.length} bredder`}.`);
