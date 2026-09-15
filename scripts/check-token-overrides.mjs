#!/usr/bin/env node
/**
 * Vakt för en KONSUMENTAPPS stilrot. Körs i appens grind, inte i ramverkets.
 *
 * ⛔ Den här vakten skrevs efter ett fel i mallen: appens `check:tokens` pekade
 * först på ramverkets tokenvakt och matade den med appens `index.css`. Den
 * filen kan aldrig uppfylla ramverkets kontrakt, eftersom den bara innehåller
 * avvikelser. Vakten hade blivit permanent röd, och en permanent röd vakt
 * stängs av inom en vecka. Det är samma slutliga utfall som ingen vakt alls,
 * fast med sämre samvete.
 *
 * Appen får skriva om VÄRDEN. Den får inte hitta på struktur.
 *
 * Fem regler, och regel 1 är den som räddar mest tid:
 *
 *   1. `@source`-raden mot ramverkets dist finns. Saknas den hittar Tailwind
 *      inga klassnamn i primitiverna, och appen blir HELT OSTYLAD utan ett enda
 *      felmeddelande. Felet ser ut som ett trasigt bygge och är en saknad rad.
 *   2. Ramverkets tokenfil importeras, och efter `tailwindcss`.
 *   3. Appen deklarerar bara tokens som FINNS i kontraktet.
 *   4. Inga färgord i namn, ingen fallback i `var()`.
 *   5. Appen har inget eget mörkerblock. Mörka värden sätts som `--dark-*`.
 *
 * Kör:  node .../check-token-overrides.mjs <appens index.css> [kontrakt]
 * Exit: 0 grönt, 1 brott med skäl.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const harRot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appfil = process.argv[2];
const kontraktfil = process.argv[3] ?? path.join(harRot, "tokens", "tokens.css");

if (!appfil) {
  console.error("check-token-overrides: ange appens stilrot, till exempel src/index.css");
  process.exit(1);
}
if (!fs.existsSync(appfil)) {
  console.error(`check-token-overrides: hittar inte ${appfil}. Fel sökväg, inte ett godkänt utfall.`);
  process.exit(1);
}

const utanKommentarer = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => "\n".repeat((m.match(/\n/g) || []).length));
const app = utanKommentarer(fs.readFileSync(appfil, "utf8"));
const kontrakt = fs.readFileSync(kontraktfil, "utf8");

/** @type {string[]} */
const brott = [];

// ── Regel 1: den tysta fällan ───────────────────────────────────────────────
if (!/@source\s+["'][^"']*@staiger\/ops-framework[^"']*["']/.test(app)) {
  brott.push(
    `${appfil} saknar @source mot ramverkets dist. Tailwind läser inte node_modules av sig själv, så utan den raden hittas inga klassnamn i primitiverna och appen blir helt ostylad UTAN felmeddelande. Lägg till: @source "../node_modules/@staiger/ops-framework/dist";`,
  );
}

// ── Regel 2: importerna finns och i rätt ordning ────────────────────────────
const iTailwind = app.indexOf('@import "tailwindcss"');
const iTokens = app.search(/@import\s+["']@staiger\/ops-framework\/tokens\.css["']/);
if (iTailwind === -1) brott.push(`${appfil} importerar inte "tailwindcss".`);
if (iTokens === -1) {
  brott.push(`${appfil} importerar inte "@staiger/ops-framework/tokens.css". Utan den finns inga tokens och varje utility faller tillbaka på Tailwinds standard.`);
} else if (iTailwind !== -1 && iTokens < iTailwind) {
  brott.push(`${appfil} importerar tokens FÖRE tailwindcss. Då skriver Tailwinds standardtema över kontraktet, och nollningen av paletten slutar gälla.`);
}

// ── Regel 5: appen äger inte mörkerlägets mekanik ───────────────────────────
if (/prefers-color-scheme/.test(app) || /\[data-theme\s*=\s*["']dark["']\]/.test(app)) {
  brott.push(
    `${appfil} har ett eget mörkerblock. Ramverkets block pekar redan på --dark-*, så ett eget block blir det andra originalet som glider isär. Sätt mörka värden som --dark-accent och så vidare.`,
  );
}

// ── Regel 3 + 4: bara kända namn, inga färgord, ingen fallback ─────────────
const kandaNamn = new Set([...kontrakt.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
const FARGORD = ["gold", "guld", "silver", "red", "green", "blue", "yellow", "orange", "purple", "pink", "brown", "grey", "gray", "teal", "cyan", "magenta", "beige", "rod", "gron", "bla", "gul"];

for (const m of app.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
  const [, namn] = m;
  if (!kandaNamn.has(namn)) {
    brott.push(
      `${appfil} deklarerar ${namn}, som inte finns i tokenkontraktet. Appen får skriva om värden, inte hitta på struktur. Behövs tokenet ska det läggas till i ramverket, annars börjar plattformarna se olika ut i tysthet.`,
    );
  }
  const traff = namn.split("-").filter(Boolean).find((o) => FARGORD.includes(o));
  if (traff) brott.push(`${appfil} ${namn} bär färgordet "${traff}". Namnge efter roll, inte efter utseende.`);
}

for (const m of app.matchAll(/var\(\s*(--[a-z0-9-]+)\s*,/g)) {
  brott.push(`${appfil} var(${m[1]}, ...) har en fallback. Saknas ett token ska det synas, inte täckas över.`);
}

if (brott.length === 0) {
  console.log(`check-token-overrides: ${appfil} följer tokenkontraktet`);
  process.exit(0);
}

console.error(`check-token-overrides: ${brott.length} brott\n`);
for (const b of brott) console.error(`  ${b}`);
process.exit(1);
