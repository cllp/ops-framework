#!/usr/bin/env node
/**
 * Vakt: `ops-framework/gruppmarke` når aldrig React, och varje export är dokumenterad (0.70.0, lifehub.identity#27).
 *
 * ══ ⛔ VARFÖR VAKTEN FINNS ═══════════════════════════════════════════════
 *
 * Ingången finns för en app utan React (LifeHubs Identity), och hela skälet är storleken: mätt i identitys bygge lade
 * React med gruppväljaren till 103,6 kB gzip, ingången med SVG-datan 23,5 kB. En enda import av en komponent någonstans
 * i grafen, eller av `lucide-react`, gör ingången till React igen, och ingenting annat hade sagt till: identitys bygge
 * hade bara blivit tyngre, eller fallit på ett beroende appen inte har.
 *
 * ⛔ STRÄNGARE ÄN NODSIDAN: GRAFEN FÅR INTE IMPORTERA NÅGOT PAKET ALLS, bara ramverkets egna filer under `src/lib/`.
 * Ett paket här är ett paket i varje app som använder ingången.
 *
 * Kör: node scripts/check-gruppmarke.mjs [rot]
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// ⛔ Roten går att peka om, så att `test-guards` kan plantera ett brott i en kopia och se vakten falla.
const bas = process.argv[2] ? path.resolve(process.argv[2]) : rot;
const src = path.join(bas, "src");
const lib = path.join(src, "lib");
const start = path.join(src, "gruppmarke", "index.js");

if (!fs.existsSync(start)) {
  console.error(`check-gruppmarke: ${path.relative(bas, start)} finns inte. Fel sökväg i vakten, inte ett godkänt utfall.`);
  process.exit(1);
}

const IMPORTMONSTER = /(?:^|[^\w$.])(?:from|import)\s*\(?\s*["']([^"']+)["']/g;
/** @param {string} t */
const utanKommentarer = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/[^\n]*/g, "$1");

/** @type {Set<string>} */
const besokta = new Set();
/** @type {string[]} */
const brott = [];
const ko = [start];
while (ko.length > 0) {
  const fil = /** @type {string} */ (ko.pop());
  if (besokta.has(fil)) continue;
  if (!fs.existsSync(fil)) {
    brott.push(`${path.relative(bas, fil)} importeras men finns inte`);
    continue;
  }
  besokta.add(fil);
  const text = utanKommentarer(fs.readFileSync(fil, "utf8"));
  for (const m of text.matchAll(IMPORTMONSTER)) {
    const spec = m[1];
    if (!spec.startsWith(".")) {
      brott.push(`${path.relative(bas, fil)} importerar paketet "${spec}". Ingången får inte nå något paket, och allra minst React eller lucide-react.`);
      continue;
    }
    const mal = path.resolve(path.dirname(fil), spec);
    if (fil !== start && !mal.startsWith(lib + path.sep)) {
      brott.push(`${path.relative(bas, fil)} importerar ${path.relative(bas, mal)}, utanför src/lib/. En komponent är webben även om den inte själv skriver "react".`);
      continue;
    }
    if (fil === start && !mal.startsWith(lib + path.sep)) {
      brott.push(`ingången återexporterar ${path.relative(bas, mal)}, utanför src/lib/.`);
      continue;
    }
    ko.push(mal);
  }
}

// ⛔ GOLV. En graf med nästan inga filer betyder att ingången läste fel, inte att den är ren.
if (besokta.size < 8) brott.push(`bara ${besokta.size} filer i grafen. Väntat minst 8 (katalogen, SVG-datan, sökningen, namnen, kulören ...).`);

const index = utanKommentarer(fs.readFileSync(start, "utf8"));
/** @type {string[]} */
const exporter = [];
for (const m of index.matchAll(/export\s*\{([^}]*)\}/g)) {
  for (const del of m[1].split(",")) {
    const namn = del.trim().split(/\s+as\s+/).pop()?.trim();
    if (namn) exporter.push(namn);
  }
}
if (exporter.length < 20) brott.push(`bara ${exporter.length} exporter lästes ur ingången. Väntat minst 20.`);

const readmeFil = path.join(bas, "README.md");
const readme = fs.existsSync(readmeFil) ? fs.readFileSync(readmeFil, "utf8") : "";
if (!readme.includes("ops-framework/gruppmarke")) brott.push("README nämner inte ops-framework/gruppmarke.");
for (const namn of exporter) if (!readme.includes(namn)) brott.push(`exporten ${namn} saknas i README.`);

if (brott.length > 0) {
  console.error(`check-gruppmarke: ${brott.length} brott\n`);
  for (const b of brott) console.error(`  ${b}`);
  process.exit(1);
}
console.log(`check-gruppmarke: ${besokta.size} filer i grafen, inga paket, ${exporter.length} exporter nämnda i README`);
