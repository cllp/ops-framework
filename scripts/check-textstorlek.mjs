#!/usr/bin/env node
/**
 * Vakt: textstorleken Liten, Mellan och Stor gäller hela typografin, mätt i en riktig webbläsare (cllp/lifehub.app#873).
 *
 * ══ ⛔ VARFÖR ════════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-11-17, "kör" på ärendet: ett val med tre lägen som ändrar typografins roller och inte varje komponent, och fält
 * som aldrig är under 16 px på en telefon, också vid Liten. Båda påståendena handlar om vad som RITAS. jsdom kör ingen CSS,
 * och ett prov som läser tokens.css som text ser att det står `var(--textskala)`, aldrig att en etikett faktiskt blev
 * 16,1 px eller att ett fält blev 14,4 px och fick iOS att zooma.
 *
 * ══ ⛔ VAD DEN GÖR ═════════════════════════════════════════════════════════════════════════════════
 *
 * Ritar `scripts/lib/typografi-yta.jsx` (ramverkets riktiga komponenter ur dist) på 390 och 1280 px i alla tre lägen och läser
 * den BERÄKNADE storleken och radhöjden för varje rad i `typografi.element.lista` (tokens/sessionstudio-profil.json):
 *
 *   1. Vid Mellan är storleken SessionStudios, alltså dagens (samma tal som `check-typografimatning`).
 *   2. Vid Liten och Stor är storleken Mellans gånger faktorn ur `TEXTSKALOR`, och en radhöjd i px följer med.
 *   3. `body` följer faktorn, så text utan klass gör det också.
 *   4. Med en grov pekare (telefon, pekskärm) är fältet minst 16 px i alla tre lägen.
 *
 * ⛔ GOLV: minst 12 element mäts per läge och bredd, och inget får saknas. Ett element som inte hittas är ett brott.
 *
 * ⛔ `--bevisa` kör vakten på nytt med ett inplanterat brott per påstående och kräver rött av rätt anledning. `--tokens=<fil>`
 * mäter en annan tokenfil (rött-beviset mot origin/main, där rollerna inte följer valet).
 *
 * Kör: npm run build && node scripts/check-textstorlek.mjs [--bevisa] [--tokens=<fil>]
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { startaWebblasare } from "./lib/matVyport.mjs";
import { FORVALD_TEXTSTORLEK, TEXTSKALOR, TEXTSTORLEK_ATTRIBUT } from "../src/lib/textstorlek.js";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const bevisa = argv.includes("--bevisa");
const tokens = argv.find((a) => a.startsWith("--tokens="))?.slice(9);
const GOLV = 12;
const BREDDER = [390, 1280];
/** En pixels avrundning i webbläsarens radhöjd, och lite till för calc-avrundningen. */
const TOLERANS = 0.06;

const profil = JSON.parse(fs.readFileSync(path.join(rot, "tokens", "sessionstudio-profil.json"), "utf8")).typografi;
/** @type {{ namn: string, text?: string, input?: string, storlek: number, bara_dator?: boolean }[]} */
const ELEMENT = profil?.element?.lista ?? [];
if (ELEMENT.length < GOLV) {
  console.error(`check-textstorlek: typografi.element.lista har ${ELEMENT.length} element (väntat minst ${GOLV}). En tom lista är grön av att inte mäta.`);
  process.exit(1);
}
if (Object.keys(TEXTSKALOR).length !== 3 || TEXTSKALOR[FORVALD_TEXTSTORLEK] !== 1) {
  console.error("check-textstorlek: TEXTSKALOR ska ha tre lägen och förvalet ska vara 1 (dagens storlek).");
  process.exit(1);
}
if (!fs.existsSync(path.join(rot, "dist", "index.js"))) {
  console.error("check-textstorlek: dist/index.js saknas. Kör npm run build först. Ett överhoppat mått räknas aldrig som grönt.");
  process.exit(1);
}

const { byggYta } = await import("./lib/byggYta.mjs");
const { sida, stada } = await byggYta({ rot, yta: "scripts/lib/typografi-yta.jsx", namn: "textstorlek", tokens: tokens ? path.resolve(tokens) : undefined });
const { browser } = await startaWebblasare();

/**
 * Ritar ytan i ett läge och läser storlek och radhöjd per element, bodyns storlek och fältets storlek.
 * @param {{ bredd: number, lage: string, css: string, pek: boolean }} val
 */
async function las({ bredd, lage, css, pek }) {
  const kontext = await browser.newContext({ viewport: { width: bredd, height: 1000 }, ...(pek ? { hasTouch: true, isMobile: true } : {}) });
  const page = await kontext.newPage();
  let html = css ? sida.replace("</head>", `<style>${css}</style></head>`) : sida;
  if (lage !== FORVALD_TEXTSTORLEK) html = html.replace('<html lang="sv">', `<html lang="sv" ${TEXTSTORLEK_ATTRIBUT}="${lage}">`);
  await page.setContent(html, { waitUntil: "load" });
  await page.waitForSelector("h1");
  const svar = await page.evaluate((lista) => {
    /** @type {Record<string, { storlek: number, radhojd: number } | null>} */
    const ut = {};
    for (const e of lista) {
      /** @type {Element | null} */
      let hit = null;
      if (e.input) hit = [...document.querySelectorAll("input:not([type=checkbox])")].find((i) => /** @type {HTMLInputElement} */ (i).value === e.input) ?? null;
      else
        hit =
          [...document.querySelectorAll("body *")].find((n) => {
            const egen = [...n.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join("").replace(/\s+/g, " ").trim();
            return egen === e.text && n.getBoundingClientRect().width > 0;
          }) ?? null;
      if (!hit) {
        ut[e.namn] = null;
        continue;
      }
      const cs = getComputedStyle(hit);
      ut[e.namn] = { storlek: Number.parseFloat(cs.fontSize), radhojd: Number.parseFloat(cs.lineHeight) };
    }
    const falt = document.querySelector("input:not([type=checkbox])");
    return {
      element: ut,
      body: Number.parseFloat(getComputedStyle(document.body).fontSize),
      falt: falt ? Number.parseFloat(getComputedStyle(falt).fontSize) : 0,
      grov: matchMedia("(pointer: coarse)").matches,
    };
  }, ELEMENT);
  await kontext.close();
  return svar;
}

/** @param {string} css Inplanterat brott (bara `--bevisa`). @returns {Promise<{ brott: string[], matt: number }>} */
async function mat(css) {
  /** @type {string[]} */
  const brott = [];
  let matt = 0;
  for (const bredd of BREDDER) {
    const mellan = await las({ bredd, lage: FORVALD_TEXTSTORLEK, css, pek: false });
    for (const [lage, faktor] of Object.entries(TEXTSKALOR)) {
      const nu = lage === FORVALD_TEXTSTORLEK ? mellan : await las({ bredd, lage, css, pek: false });
      let mattHar = 0;
      for (const e of ELEMENT) {
        if (e.bara_dator && bredd < 1024) continue;
        const m = nu.element[e.namn];
        const bas = mellan.element[e.namn];
        if (!m || !bas) {
          brott.push(`${bredd} px, ${lage}: "${e.namn}" hittades inte på ytan. Ett element som inte mäts är ett brott.`);
          continue;
        }
        mattHar += 1;
        if (lage === FORVALD_TEXTSTORLEK && m.storlek !== e.storlek) {
          brott.push(`${bredd} px, mellan: ${e.namn} ritas ${m.storlek} px, dagens storlek är ${e.storlek} px. Mellan ska vara oförändrat.`);
        }
        const vantat = e.storlek * faktor;
        if (Math.abs(m.storlek - vantat) > TOLERANS) {
          brott.push(`${bredd} px, ${lage}: ${e.namn} ritas ${m.storlek} px, väntat ${vantat.toFixed(2)} px (${e.storlek} x ${faktor}). Rollen följer inte textstorleken.`);
        }
        if (Number.isFinite(bas.radhojd) && Number.isFinite(m.radhojd) && Math.abs(m.radhojd - bas.radhojd * faktor) > 0.6) {
          brott.push(`${bredd} px, ${lage}: ${e.namn} har radhöjden ${m.radhojd} px, väntat ${(bas.radhojd * faktor).toFixed(2)} px. Radhöjden följer inte texten, och raderna kryper ihop eller glesnar.`);
        }
      }
      if (mattHar < GOLV) brott.push(`${bredd} px, ${lage}: bara ${mattHar} element mätta, golvet är ${GOLV}.`);
      matt += mattHar;
      if (Math.abs(nu.body - 16 * faktor) > TOLERANS) brott.push(`${bredd} px, ${lage}: body ritas ${nu.body} px, väntat ${(16 * faktor).toFixed(2)} px. Text utan klass följer inte valet.`);
      const pek = await las({ bredd, lage, css, pek: true });
      if (!pek.grov) brott.push(`${bredd} px, ${lage}: kontexten med pekskärm matchar inte (pointer: coarse). Fältets golv gick inte att mäta.`);
      const vantatFalt = Math.max(16, 16 * faktor);
      if (pek.falt < 16 || Math.abs(pek.falt - vantatFalt) > TOLERANS) {
        brott.push(`${bredd} px, ${lage}, pekskärm: fältet ritas ${pek.falt} px, väntat ${vantatFalt.toFixed(2)} px. Under 16 px zoomar iOS in sidan när fältet får fokus.`);
      }
      matt += 1;
    }
  }
  return { brott, matt };
}

try {
  if (bevisa) {
    const PROV = [
      { namn: "valet når inte rollerna (--textskala låst till 1)", css: ":root { --textskala: 1 !important; }", vantat: "Rollen följer inte textstorleken" },
      { namn: "radhöjden står kvar i rem", css: ":root { --text-etikett--line-height: 1.25rem; }", vantat: "Radhöjden följer inte texten" },
      { namn: "fältet följer brödtexten utan golv", css: "@media (pointer: coarse) { input { font-size: var(--text-brod) !important; } }", vantat: "zoomar iOS" },
      { namn: "body utan storlek", css: "body { font-size: 16px !important; }", vantat: "Text utan klass" },
    ];
    const gron = await mat("");
    if (gron.brott.length > 0) {
      console.error(`check-textstorlek --bevisa: utgångsläget är inte grönt (${gron.matt} mätta):\n  ${gron.brott.join("\n  ")}`);
      process.exitCode = 1;
    } else {
      console.log(`  grön som väntat  utan inplanterat brott (${gron.matt} mätningar)`);
      for (const p of PROV) {
        const r = await mat(p.css);
        if (r.brott.some((b) => b.includes(p.vantat))) console.log(`  röd som väntat   ${p.namn}`);
        else {
          console.error(`  FEL  ${p.namn}: vakten blev ${r.brott.length === 0 ? "GRÖN trots brottet" : `röd av fel anledning (${r.brott[0]})`}`);
          process.exitCode = 1;
        }
      }
    }
  } else {
    const { brott, matt } = await mat("");
    if (brott.length > 0) {
      console.error(`check-textstorlek: ${brott.length} brott (${matt} mätningar):\n  ${brott.join("\n  ")}`);
      process.exitCode = 1;
    } else {
      console.log(`check-textstorlek: ${matt} mätningar i tre lägen på ${BREDDER.join(" och ")} px. Rollerna, radhöjden och body följer valet, och fältet är minst 16 px på en pekskärm.`);
    }
  }
} finally {
  await browser.close();
  stada();
}
