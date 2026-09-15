#!/usr/bin/env node
/**
 * Vakt: primitiverna har ett STÄNGT API.
 *
 * ⛔ Det här är den regel som skiljer ett ramverk från en rekommendation.
 *
 * Rörig CSS orsakas inte av teknikvalet. Den orsakas av kryphål. Så fort en
 * primitiv tar emot godtyckliga klasser lägger varje anropsställe på tre
 * utilities, och efter tre månader beskriver ramverket inte längre vad som
 * renderas. Varje enskilt tillägg är rimligt. Summan är soppan.
 *
 * Vakten kontrollerar tre saker:
 *
 *   1. Ramverkets egna primitiver tar inte emot `className` eller `style`,
 *      varken som prop, via destrukturering eller via `...rest`-spread.
 *   2. Konsumentkod skickar inte `className` till en primitiv.
 *   3. Konsumentkod hittar inte på egna `ops-`-klasser. Prefixet ägs av
 *      ramverket, och en lokal `ops-btn--danger` är en gaffel ingen ser.
 *
 * Kör:  node css/check-closed-api.mjs <katalog> [...]
 * Exit: 0 grönt, 1 brott med fil, rad och skäl.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const rotter = process.argv.slice(2);
if (rotter.length === 0) {
  console.error("check-closed-api: ange minst en katalog att granska");
  process.exit(1);
}

/** Primitiverna ramverket äger. Håll i takt med `css/ops.css`. */
const PRIMITIVER = ["OpsButton", "OpsCard", "OpsField", "OpsPill", "OpsList", "OpsListRow", "OpsView", "OpsModal"];

/** @type {{ fil: string, rad: number, regel: string, skal: string }[]} */
const brott = [];
let filerLasta = 0;

/** @param {string} dir @returns {string[]} */
function filer(dir) {
  /** @type {string[]} */
  const ut = [];
  if (!fs.existsSync(dir)) return ut;
  for (const post of fs.readdirSync(dir, { withFileTypes: true })) {
    if (post.name === "node_modules" || post.name.startsWith(".")) continue;
    const full = path.join(dir, post.name);
    if (post.isDirectory()) ut.push(...filer(full));
    else if (/\.(jsx?|tsx?)$/.test(post.name)) ut.push(full);
  }
  return ut;
}

const radAv = (text, index) => text.slice(0, index).split("\n").length;

for (const rot of rotter) {
  for (const fil of filer(rot)) {
    const text = fs.readFileSync(fil, "utf8");
    filerLasta += 1;
    const arPrimitiv = PRIMITIVER.some((p) => new RegExp(`function ${p}\\b|const ${p}\\s*=`).test(text));

    // ── Regel 1: primitiven får inte ta emot className, style eller ...rest
    if (arPrimitiv) {
      for (const m of text.matchAll(/\b(className|style)\b\s*[,}:=]/g)) {
        brott.push({
          fil,
          rad: radAv(text, m.index),
          regel: "1. stängt API",
          skal: `Primitiven tar emot "${m[1]}". Varianter är API:et: variant, tone, size. Behövs något som inte finns, utöka css/ops.css.`,
        });
      }
      for (const m of text.matchAll(/\.\.\.(rest|props|others)\b/g)) {
        brott.push({
          fil,
          rad: radAv(text, m.index),
          regel: "1. stängt API",
          skal: `"...${m[1]}" är samma kryphål som className, bara svårare att se. Namnge de props primitiven faktiskt stödjer.`,
        });
      }
      continue;
    }

    // ── Regel 2: konsument skickar inte className till en primitiv
    for (const p of PRIMITIVER) {
      const re = new RegExp(`<${p}\\b[^>]*?\\b(className|style)\\s*=`, "gs");
      for (const m of text.matchAll(re)) {
        brott.push({
          fil,
          rad: radAv(text, m.index),
          regel: "2. ingen lappning",
          skal: `<${p}> får "${m[1]}" på anropsstället. Det är den väg som gör ramverket till en rekommendation.`,
        });
      }
    }

    // ── Regel 3: prefixet ops- ägs av ramverket
    //
    // ⛔ Första versionen flaggade importsökvägen `@staiger/ops-framework`, och
    // en vakt med falska positiva blir avstängd. Två undantag, båda smala:
    // paketnamn innehåller snedstreck, och import- eller require-rader är inte
    // klassnamn oavsett hur de ser ut.
    for (const m of text.matchAll(/["'`]([^"'`]*\bops-[a-z0-9-]+)/g)) {
      const traff = m[1].trim();
      if (traff.includes("/")) continue;
      const radStart = text.lastIndexOf("\n", m.index) + 1;
      const radSlut = text.indexOf("\n", m.index);
      const rad = text.slice(radStart, radSlut === -1 ? undefined : radSlut);
      if (/^\s*(import\b|export\b.*\bfrom\b)|require\s*\(/.test(rad)) continue;
      brott.push({
        fil,
        rad: radAv(text, m.index),
        regel: "3. prefixet ops-",
        skal: `Egen ops-klass: "${traff}". Prefixet ägs av ramverket. En lokal ops-variant är en gaffel ingen ser.`,
      });
    }
  }
}

// ── Golv: en vakt som blir grön av att ingenting lästes säger ingenting ─────
if (filerLasta === 0) {
  console.error(`check-closed-api: noll filer lästa ur ${rotter.join(", ")}. Fel sökväg, inte ett godkänt utfall.`);
  process.exit(1);
}

if (brott.length === 0) {
  console.log(`check-closed-api: ${filerLasta} filer, API:et är stängt`);
  process.exit(0);
}

console.error(`check-closed-api: ${brott.length} brott\n`);
for (const b of brott) console.error(`  [${b.regel}] ${b.fil}:${b.rad}\n      ${b.skal}`);
process.exit(1);
