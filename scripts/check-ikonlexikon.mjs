#!/usr/bin/env node
/**
 * Vakt: en ikon, en betydelse. Kartan `IKON_FOR` (src/components/ikonlexikon.js) är det enda stället där en betydelse
 * får en bild.
 *
 * ══ ⛔ HÄNDELSEN ═══════════════════════════════════════════════════════
 *
 * Designgenomgången 2026-11-04 (lifehub.app i 390 och 1280 px) och Groks granskning (cllp/lifehub.app#633): skjutreglaget
 * betydde filter, Inställningar och platsväljaren i Biblioteket, kugghjulet betydde också Inställningar, och `Inbox` var
 * både Inkorgen och Ärenden. Varje val gjordes med en direkt import ur `lucide-react` i den fil där ikonen ritades, och
 * ingen fil var fel för sig: felet syntes först när två filer stod på samma skärm. Sprinten cllp/lifehub.app#634.
 *
 * ══ ⛔ VAD DEN MÄTER ═══════════════════════════════════════════════════
 *
 * 1. KARTAN. Den importeras (inte läses som text), alltså mäts samma objekt som appen får. Röd om två betydelser pekar
 *    på samma ikon, jämfört på identitet, så att ett alias (`SearchIcon`, `LucideSearch`) inte smiter förbi under ett
 *    annat namn. Röd om ett värde inte är en Lucide-ikon, och om kartan inte är fryst.
 * 2. INGÅNGEN. Röd om en fil i `src/components` eller `src/lib` importerar en ikon som finns i kartan direkt ur
 *    `lucide-react`. Det är så andra betydelsen kom in varje gång: platsväljaren tog `SlidersHorizontal` ur Lucide, inte
 *    ur `ReglageIkon`. Går ikonen genom kartan (eller ett omslag i `icons.jsx` som hämtar ur kartan) står betydelsen i
 *    koden som ett namn: `IKON_FOR.filter` eller `ReglageIkon`, och en granskare ser det.
 *
 * ══ ⛔ VAD DEN INTE MÄTER, OCH VARFÖR ══════════════════════════════════
 *
 * Att `ReglageIkon` (eller `IKON_FOR.filter`) faktiskt sitter på ett FILTER. Det kräver att vakten vet vad knappen gör,
 * och det enda som säger det i koden är `aria-label` eller rubriken bredvid. Att matcha de orden mot betydelsen hade
 * varit ett närvarogrep (regel 4): grönt för att ordet "filter" råkar stå i en etikett, rött för en riktig filterknapp
 * som heter "Typ och status". Den delen bärs av namnet i koden och av granskningen, inte av den här vakten.
 *
 * ══ ⛔ VAD SOM INTE LÄSES ══════════════════════════════════════════════
 *
 * `ikonlexikon.js` själv, `*.generated.*` (gruppikonkatalogen: bilder användaren VÄLJER åt sin grupp, utan betydelse i
 * ramverkets mening) och `__tests__/`.
 *
 * Kör: node scripts/check-ikonlexikon.mjs [--lexikon fil] [katalog ...]
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
let lexikonfil = path.join(rot, "src", "components", "ikonlexikon.js");
/** @type {string[]} */
const kataloger = [];
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--lexikon") lexikonfil = path.resolve(args[++i] ?? "");
  else kataloger.push(path.resolve(args[i]));
}
if (kataloger.length === 0) kataloger.push(path.join(rot, "src", "components"), path.join(rot, "src", "lib"));

// ⛔ GOLV (regel 4, tomt underlag). Kartan bär minst tio betydelser, och de två katalogerna har över 200 filer. Färre
// betyder en trasig sökväg eller en karta som tömts, inte en ren kodbas.
const GOLV_BETYDELSER = 10;
const GOLV_FILER = 50;

if (!fs.existsSync(lexikonfil)) {
  console.error(`check-ikonlexikon: ${lexikonfil} finns inte. Fel sökväg i vakten, inte ett godkänt utfall.`);
  process.exit(1);
}
for (const k of kataloger) {
  if (!fs.existsSync(k)) {
    console.error(`check-ikonlexikon: ${k} finns inte. Fel sökväg i vakten, inte ett godkänt utfall.`);
    process.exit(1);
  }
}

const lucide = /** @type {Record<string, unknown>} */ (await import("lucide-react"));
/** @type {Map<unknown, string>} Ikon till sitt kanoniska namn (displayName), så att alias känns igen. */
const lucideNamn = new Map();
for (const [namn, varde] of Object.entries(lucide)) {
  if (varde && (typeof varde === "object" || typeof varde === "function") && "displayName" in varde) {
    const visning = /** @type {{ displayName?: string }} */ (varde).displayName;
    if (!lucideNamn.has(varde)) lucideNamn.set(varde, visning ?? namn);
  }
}

const lexikon = await import(pathToFileURL(lexikonfil).href);
const karta = lexikon.IKON_FOR;
/** @type {string[]} */
const brott = [];

if (!karta || typeof karta !== "object") {
  console.error(`check-ikonlexikon: ${path.relative(rot, lexikonfil)} exporterar ingen IKON_FOR. Vakten har inget att mäta.`);
  process.exit(1);
}
const betydelser = Object.entries(karta);
if (betydelser.length < GOLV_BETYDELSER) {
  console.error(`check-ikonlexikon: kartan har bara ${betydelser.length} betydelser, väntat minst ${GOLV_BETYDELSER}. En tömd karta är inte en ren karta.`);
  process.exit(1);
}
if (!Object.isFrozen(karta)) brott.push("IKON_FOR är inte fryst. En app som skriver över en betydelse ska ändra lexikonet, inte kartan i minnet.");

/** @type {Map<unknown, string[]>} */
const perIkon = new Map();
for (const [betydelse, ikon] of betydelser) {
  if (!lucideNamn.has(ikon)) {
    brott.push(`betydelsen "${betydelse}" pekar inte på en Lucide-ikon (${String(ikon)}).`);
    continue;
  }
  perIkon.set(ikon, [...(perIkon.get(ikon) ?? []), betydelse]);
}
for (const [ikon, lista] of perIkon) {
  if (lista.length > 1) brott.push(`samma ikon (${lucideNamn.get(ikon)}) har två betydelser: ${lista.join(", ")}. En bild får betyda en sak.`);
}

/** @param {string} dir @returns {string[]} */
function filer(dir) {
  /** @type {string[]} */
  const ut = [];
  for (const post of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, post.name);
    if (post.isDirectory()) {
      if (post.name === "node_modules" || post.name === "dist" || post.name === "__tests__") continue;
      ut.push(...filer(full));
      continue;
    }
    if (!/\.(m?js|jsx)$/.test(post.name)) continue;
    if (post.name === path.basename(lexikonfil) || /\.generated\./.test(post.name)) continue;
    ut.push(full);
  }
  return ut;
}

let lasta = 0;
let importer = 0;
for (const katalog of kataloger) {
  for (const full of filer(katalog)) {
    lasta += 1;
    const kalla = fs.readFileSync(full, "utf8").replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
    const rel = path.relative(rot, full);
    for (const m of kalla.matchAll(/import\s+([^;]*?)\s+from\s*["']lucide-react["']/g)) {
      const rad = kalla.slice(0, m.index).split("\n").length;
      const klausul = m[1].trim();
      const namngivna = /^\{([\s\S]*)\}$/.exec(klausul);
      // ⛔ TYSTNAD (regel 4): en import vakten inte kan läsa är inte en ren import. `import * as L` eller en
      // standardimport gömmer vilka ikoner som används, och då kan vakten inte säga något om dem.
      if (!namngivna) {
        brott.push(`${rel}:${rad} importerar ur lucide-react på ett sätt vakten inte känner igen (${klausul}). Importera ikonerna med namn.`);
        continue;
      }
      for (const del of namngivna[1].split(",")) {
        const namn = del.trim().split(/\s+as\s+/)[0]?.trim();
        if (!namn) continue;
        importer += 1;
        if (!(namn in lucide)) {
          brott.push(`${rel}:${rad} importerar "${namn}", som lucide-react inte har. Vakten kan inte avgöra vad den är.`);
          continue;
        }
        const ikon = lucide[namn];
        const betydelse = betydelser.find(([, v]) => v === ikon)?.[0];
        if (betydelse) {
          brott.push(`${rel}:${rad} importerar ${namn} direkt ur lucide-react. Den ikonen betyder "${betydelse}" i IKON_FOR; hämta den därifrån (eller ur omslaget i icons.jsx), eller välj en annan ikon för en annan betydelse.`);
        }
      }
    }
  }
}

if (lasta < GOLV_FILER) {
  console.error(`check-ikonlexikon: bara ${lasta} filer lästa, väntat fler än ${GOLV_FILER}. Fel katalog, eller en trasig.`);
  process.exit(1);
}

if (brott.length > 0) {
  console.error(`check-ikonlexikon: ${brott.length} brott mot en ikon, en betydelse.`);
  for (const b of brott) console.error(`  ${b}`);
  console.error("");
  console.error("Kartan står i src/components/ikonlexikon.js. Designgenomgången 2026-11-04 (cllp/lifehub.app#634) är skälet.");
  process.exit(1);
}

console.log(`check-ikonlexikon: ${betydelser.length} betydelser med var sin ikon, ${lasta} filer lästa, ${importer} namngivna lucide-importer, ingen ikon ur kartan importerad förbi den`);
process.exit(0);
