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

const LAGEN = {
  ljust: { pre: "--", ytor: ["--color-canvas", "--color-surface", "--color-raised"] },
  morkt: { pre: "--dark-", ytor: ["--dark-canvas", "--dark-surface", "--dark-raised"] },
};

/** @type {Record<string, { ikon: [number, number], platta: [number, number], ytor: Array<{ namn: string, y: number }> }>} */
const tema = {};
for (const [lage, { pre, ytor }] of Object.entries(LAGEN)) {
  const tal = (n) => Number(varde(`${pre}gruppmarke-${n}`));
  const ytorna = ytor.map((n) => ({ namn: n, hex: varde(n) })).filter((y) => y.hex && /^#[0-9a-f]{6}$/i.test(y.hex));
  if (ytorna.length < 3) fel.push(`${lage}: läste ${ytorna.length} ytor som #rrggbb, golvet är 3`);
  tema[lage] = {
    ikon: [tal("ikon-l"), tal("ikon-c")],
    platta: [tal("platta-l"), tal("platta-c")],
    ytor: ytorna.map((y) => ({ namn: y.namn, y: luminans(hexTillLinjar(/** @type {string} */ (y.hex))) })),
  };
  for (const [k, v] of [["ikon-l", tema[lage].ikon[0]], ["ikon-c", tema[lage].ikon[1]], ["platta-l", tema[lage].platta[0]], ["platta-c", tema[lage].platta[1]]]) {
    if (!Number.isFinite(v)) fel.push(`${lage}: ${pre}gruppmarke-${k} saknas i ${path.relative(rot, fil)} eller är inget tal`);
  }
}

/** @param {string} lage @param {number} h */
function mat(lage, h) {
  const t = tema[lage];
  // ⛔ Båda kartläggningarna (se oklch.js): CSS Color 4:s sänkta mättnad och Chromiums klippta kanaler. Golvet gäller den sämre.
  let platta = Infinity;
  let yta = Infinity;
  for (const karta of [iGamut, klippt]) {
    const yi = luminans(karta(t.ikon[0], t.ikon[1], h));
    const yp = luminans(karta(t.platta[0], t.platta[1], h));
    platta = Math.min(platta, kontrast(yi, yp));
    yta = Math.min(yta, ...t.ytor.map((y) => kontrast(yi, y.y)));
  }
  return { platta, yta };
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
    for (let h = 0; h < 360; h++) {
      const m = mat(lage, h);
      raknade++;
      olika.add(ritad(iGamut(tema[lage].ikon[0], tema[lage].ikon[1], h)));
      if (m.platta < samstPlatta.v) samstPlatta = { v: m.platta, h };
      if (m.yta < samstYta.v) samstYta = { v: m.yta, h };
      if (m.platta < GOLV_PLATTA) fel.push(`${lage}, kulör ${h}: ikonen mot plattan ${m.platta.toFixed(2)}:1, golvet är ${GOLV_PLATTA}:1`);
      if (m.yta < GOLV_YTA) fel.push(`${lage}, kulör ${h}: ikonen mot ytan ${m.yta.toFixed(2)}:1, golvet är ${GOLV_YTA}:1`);
    }
    sammanfattning[lage] = { samstPlatta, samstYta, olika: olika.size };
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
      `${lage}: sämsta av 360, ikonen mot plattan ${s.samstPlatta.v.toFixed(2)}:1 (kulör ${s.samstPlatta.h}), ikonen mot ytan ${s.samstYta.v.toFixed(2)}:1 (kulör ${s.samstYta.h}), ${s.olika} olika ikonfärger`,
    );
  }
}

if (fel.length > 0) {
  console.error(`check-gruppfarg: ${fel.length} brott`);
  for (const f of fel.slice(0, 20)) console.error(`  ${f}`);
  if (fel.length > 20) console.error(`  ... och ${fel.length - 20} till`);
  process.exit(1);
}
console.log(`check-gruppfarg: ${raknade} kulörer räknade i två lägen mot tre ytor, alla över golven (${GOLV_PLATTA}:1 mot plattan, ${GOLV_YTA}:1 mot ytan)`);
