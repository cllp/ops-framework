#!/usr/bin/env node
/**
 * Vakt: varje gruppkulör håller kontrasten, i ljust och mörkt läge (0.65.0, #265).
 *
 * ══ ⛔ VARFÖR ════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-10-06 (#265) valde bort den fria färgväljaren: "den ger färger bakgrunden inte tål, text som tappar
 * läsbarhet och grupper som inte ser ut som en familj". I stället väljer man en KULÖR, och ljusheten och mättnaden
 * står i temat (`--gruppmarke-*` i tokens.css). Det är ett löfte om att VARJE kulör fungerar, och ett löfte om 360
 * färger går inte att kontrollera med ögat. Den här vakten räknar dem.
 *
 * ══ ⛔ VAD SOM MÄTS ══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Talen läses ur tokens.css, inte ur en kopia här: ljushet och mättnad för ikonen och plattan, och ytorna canvas,
 * surface och raised, i båda lägena. För varje kulör 0 till 359 räknas färgen som webbläsaren ritar
 * (`src/lib/oklch.js`), både med CSS Color 4:s gamut-kartläggning (mättnaden sänks) och med Chromiums klippning per kanal,
 * och WCAG-kontrasten för den sämre av de två:
 *
 *   ikonen mot plattan   golv 4,5:1   initialer är text, så textens krav gäller och inte grafikens
 *   ikonen mot ytan      golv 3:1     WCAG 1.4.11, grafik; kulörrutan i väljaren och kanten på ett valt kort
 *
 * ⛔ KALENDRARNA RITAS MED SAMMA KULÖR (0.238.0, cllp/lifehub.app#882): pricken, vänsterkanten och den hela kanten är
 * ikonens färg och mäts alltså av "ikonen mot ytan" ovan. Det som är nytt är TEXT PÅ TONEN: bandets titel (`--color-ink`)
 * står på ytan med kulören ovanpå vid 20 procent (`.ops-kulor-ton`), och dagens siffra på 15 procent (`.ops-kulor-dagton`).
 * Tonen läggs på varje yta som den sämre av de två kartläggningarna, blandad i gammakodad sRGB som webbläsaren gör:
 *
 *   bandets text mot tonen   golv 4,5:1   titeln är text
 *
 * ⛔ GOLV FÖR UNDERLAGET (regel 4): minst 12 kulörer i tabellen (de tolv snabbvalen), minst 300 olika ritade ikonfärger
 * av 360 per läge, och tre ytor per läge. Läser vakten färre blir den röd i stället för grön på tomhet.
 *
 * Kör: node scripts/check-gruppfarg.mjs [tokens.css]
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { hexTillLinjar, iGamut, klippt, kontrast, luminans } from "../src/lib/oklch.js";
import { GRUPPKULORFORSLAG } from "../src/lib/gruppfarg.js";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fil = process.argv[2] ? path.resolve(process.argv[2]) : path.join(rot, "tokens", "tokens.css");
const css = fs.readFileSync(fil, "utf8");

const GOLV_PLATTA = 4.5;
const GOLV_YTA = 3;
const MIN_KULORER_I_TABELL = 12;

const fel = [];
/** @param {string} namn */
function varde(namn) {
  // ⛔ Första RÅVÄRDET, aldrig en alias-rad (`var(--dark-...)`) i mörkerblocken: den är ingen siffra att räkna på.
  const m = [...css.matchAll(new RegExp(`^\\s*${namn.replace(/[-]/g, "\\-")}:\\s*([^;]+);`, "gm"))].find((x) => !x[1].trim().startsWith("var("));
  if (!m) {
    fel.push(`${namn} saknas i ${path.relative(rot, fil)}`);
    return null;
  }
  return m[1].trim();
}

/*
 * ⛔ LJUSA LÄGETS TAL HETER `--ljust-gruppmarke-*` sedan 0.238.0: `--gruppmarke-*` är pekare (i mörkt läge på de mörka talen), och
 * färgväljarens förhandsvisning behöver båda lägenas tal samtidigt.
 */
const LAGEN = {
  ljust: { pre: "--ljust-", ytor: ["--color-canvas", "--color-surface", "--color-raised"], text: "--color-ink" },
  morkt: { pre: "--dark-", ytor: ["--dark-canvas", "--dark-surface", "--dark-raised"], text: "--dark-ink" },
};
const GOLV_TON = 4.5;
/** Tonens täckning: bandet (`.ops-kulor-ton`) och dagrutan (`.ops-kulor-dagton`). */
const TONER = [0.2, 0.15];

/** @type {Record<string, { ikon: [number, number], platta: [number, number], ytor: Array<{ namn: string, y: number, lin: [number, number, number] }>, text: number }>} */
const tema = {};
for (const [lage, { pre, ytor, text }] of Object.entries(LAGEN)) {
  const texthex = varde(text);
  if (texthex && !/^#[0-9a-f]{6}$/i.test(texthex)) fel.push(`${lage}: ${text} är inte #rrggbb (${texthex})`);
  const tal = (n) => Number(varde(`${pre}gruppmarke-${n}`));
  const ytorna = ytor.map((n) => ({ namn: n, hex: varde(n) })).filter((y) => y.hex && /^#[0-9a-f]{6}$/i.test(y.hex));
  if (ytorna.length < 3) fel.push(`${lage}: läste ${ytorna.length} ytor som #rrggbb, golvet är 3`);
  tema[lage] = {
    ikon: [tal("ikon-l"), tal("ikon-c")],
    platta: [tal("platta-l"), tal("platta-c")],
    ytor: ytorna.map((y) => ({ namn: y.namn, y: luminans(hexTillLinjar(/** @type {string} */ (y.hex))), lin: hexTillLinjar(/** @type {string} */ (y.hex)) })),
    text: texthex && /^#[0-9a-f]{6}$/i.test(texthex) ? luminans(hexTillLinjar(texthex)) : NaN,
  };
  for (const [k, v] of [["ikon-l", tema[lage].ikon[0]], ["ikon-c", tema[lage].ikon[1]], ["platta-l", tema[lage].platta[0]], ["platta-c", tema[lage].platta[1]]]) {
    if (!Number.isFinite(v)) fel.push(`${lage}: ${pre}gruppmarke-${k} saknas i ${path.relative(rot, fil)} eller är inget tal`);
  }
}

/** Gammakodning och tillbaka: webbläsaren blandar en halvgenomskinlig färg i kodad sRGB. @param {number} v */
const koda = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
/** @param {number} k */
const avkoda = (k) => (k <= 0.04045 ? k / 12.92 : ((k + 0.055) / 1.055) ** 2.4);
/** @param {[number, number, number]} fg @param {[number, number, number]} bg @param {number} a */
const blanda = (fg, bg, a) => /** @type {[number, number, number]} */ (fg.map((v, i) => avkoda(a * koda(v) + (1 - a) * koda(bg[i]))));

/** @param {string} lage @param {number} h */
function mat(lage, h) {
  const t = tema[lage];
  // ⛔ Båda kartläggningarna (se oklch.js): CSS Color 4:s sänkta mättnad och Chromiums klippta kanaler. Golvet gäller den sämre.
  let platta = Infinity;
  let yta = Infinity;
  let ton = Infinity;
  for (const karta of [iGamut, klippt]) {
    const ikon = karta(t.ikon[0], t.ikon[1], h);
    const yi = luminans(ikon);
    const yp = luminans(karta(t.platta[0], t.platta[1], h));
    platta = Math.min(platta, kontrast(yi, yp));
    yta = Math.min(yta, ...t.ytor.map((y) => kontrast(yi, y.y)));
    for (const a of TONER) ton = Math.min(ton, ...t.ytor.map((y) => kontrast(t.text, luminans(blanda(ikon, y.lin, a)))));
  }
  return { platta, yta, ton };
}

let raknade = 0;
/*
 * ⛔ GOLVET ÄR ANTALET OLIKA FÄRGER, INTE ANTALET VARV (granskningen av PR 266). "Räknade minst 720" kunde aldrig bli rött:
 * slingan går alltid 360 varv. Det som kan gå fel är att kulören inte når färgen, till exempel en mättnad 0 i temat. Då klarar
 * varje kulör kontrasten (allt är grått) och vakten hade varit grön genom precis det felet. Golvet: minst MIN_OLIKA olika
 * ritade ikonfärger (8 bitar per kanal) av 360 per läge.
 */
const MIN_OLIKA = 300;
/** @param {[number, number, number]} lin */
const ritad = (lin) => lin.map((v) => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055))).join(",");
const sammanfattning = {};
if (fel.length === 0) {
  for (const lage of Object.keys(LAGEN)) {
    const olika = new Set();
    let samstPlatta = { v: Infinity, h: -1 };
    let samstYta = { v: Infinity, h: -1 };
    let samstTon = { v: Infinity, h: -1 };
    if (!Number.isFinite(tema[lage].text)) fel.push(`${lage}: ${LAGEN[lage].text} saknas, bandets text går inte att mäta`);
    for (let h = 0; h < 360; h++) {
      const m = mat(lage, h);
      raknade++;
      olika.add(ritad(iGamut(tema[lage].ikon[0], tema[lage].ikon[1], h)));
      if (m.platta < samstPlatta.v) samstPlatta = { v: m.platta, h };
      if (m.yta < samstYta.v) samstYta = { v: m.yta, h };
      if (m.ton < samstTon.v) samstTon = { v: m.ton, h };
      if (m.ton < GOLV_TON) fel.push(`${lage}, kulör ${h}: kalenderbandets text mot tonen ${m.ton.toFixed(2)}:1, golvet är ${GOLV_TON}:1`);
      if (m.platta < GOLV_PLATTA) fel.push(`${lage}, kulör ${h}: ikonen mot plattan ${m.platta.toFixed(2)}:1, golvet är ${GOLV_PLATTA}:1`);
      if (m.yta < GOLV_YTA) fel.push(`${lage}, kulör ${h}: ikonen mot ytan ${m.yta.toFixed(2)}:1, golvet är ${GOLV_YTA}:1`);
    }
    sammanfattning[lage] = { samstPlatta, samstYta, samstTon, olika: olika.size };
    if (olika.size < MIN_OLIKA) fel.push(`${lage}: bara ${olika.size} olika ikonfärger av 360 kulörer, golvet är ${MIN_OLIKA}. Når kulören färgen (mättnad över 0)?`);
  }

  console.log("Kulör  Namn       ljust ikon/platta  ljust ikon/yta  mörkt ikon/platta  mörkt ikon/yta");
  for (const f of GRUPPKULORFORSLAG) {
    const l = mat("ljust", f.kulor);
    const d = mat("morkt", f.kulor);
    console.log(`${String(f.kulor).padStart(5)}  ${f.sv.padEnd(9)}  ${l.platta.toFixed(2).padStart(17)}  ${l.yta.toFixed(2).padStart(14)}  ${d.platta.toFixed(2).padStart(17)}  ${d.yta.toFixed(2).padStart(14)}`);
  }
  if (GRUPPKULORFORSLAG.length < MIN_KULORER_I_TABELL) fel.push(`tabellen har ${GRUPPKULORFORSLAG.length} kulörer, golvet är ${MIN_KULORER_I_TABELL}`);
  for (const [lage, s] of Object.entries(sammanfattning)) {
    console.log(
      `${lage}: sämsta av 360, ikonen mot plattan ${s.samstPlatta.v.toFixed(2)}:1 (kulör ${s.samstPlatta.h}), ikonen mot ytan ${s.samstYta.v.toFixed(2)}:1 (kulör ${s.samstYta.h}), kalenderbandets text mot tonen ${s.samstTon.v.toFixed(2)}:1 (kulör ${s.samstTon.h}), ${s.olika} olika ikonfärger`,
    );
  }
}

if (fel.length > 0) {
  console.error(`check-gruppfarg: ${fel.length} brott`);
  for (const f of fel.slice(0, 20)) console.error(`  ${f}`);
  if (fel.length > 20) console.error(`  ... och ${fel.length - 20} till`);
  process.exit(1);
}
console.log(`check-gruppfarg: ${raknade} kulörer räknade i två lägen mot tre ytor, alla över golven (${GOLV_PLATTA}:1 mot plattan, ${GOLV_YTA}:1 mot ytan, ${GOLV_TON}:1 för kalenderbandets text mot tonen)`);
