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
 * Sex regler, och regel 1 är den som räddar mest tid:
 *
 *   1. `@source`-raden mot ramverkets dist finns. Saknas den hittar Tailwind
 *      inga klassnamn i primitiverna, och appen blir HELT OSTYLAD utan ett enda
 *      felmeddelande. Felet ser ut som ett trasigt bygge och är en saknad rad.
 *   2. Ramverkets tokenfil importeras, och efter `tailwindcss`.
 *   3. Appen deklarerar bara tokens som FINNS i kontraktet.
 *   4. Inga färgord i namn, ingen fallback i `var()`.
 *   5. Appen har inget eget mörkerblock. Mörka värden sätts som `--dark-*`.
 *   6. (0.31.2) Appens stilrot innehåller INGEN regel som stilar element eller ramverkets klasser.
 *
 * ══ ⛔ REGEL 6: STRUKTUR ÄR RAMVERKETS (0.31.2, bolag-ops #240) ═════════════
 *
 * bolag-ops hade i `web/src/index.css` en regel: `header.sticky > div.max-w-7xl { max-width: 64rem; }`. Den smalnade
 * skalets toppruta till 1024 px medan grupppanelen under den låg kvar i `max-w-7xl` (1280), så ordmärket stod 120 till
 * 128 px till höger om panelen vid 1280 och 1600 (mätt av CP, 2026-09-29). Vakten gick GRÖN: regel 3 och 4 läser bara
 * custom properties, och en vanlig regel med ett elementval har inga. Appen hade alltså skrivit om ramverkets STRUKTUR
 * utan att någon vakt kunde säga något, och felet upptäcktes av en människa som mätte i en webbläsare.
 *
 * Tillåtet på toppnivå, och bara detta: `@import`, `@source`, `@font-face`, `@theme` (bara `--*`-rader), samt
 * `:root`, `.dark` och `[data-theme...]` med bara `--*`-rader. ALLT som stilar ett element eller en klass (`header`,
 * `.max-w-7xl`, `body`, `@media`, `@layer`, `@utility`) är rött, med väljaren i meddelandet. Behövs en annan layout:
 * be ramverket om den (ärende i cllp/ops-framework). Att lägga den i appen är att ha två original av samma struktur.
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

// ── Regel 6: appen omformar inte ramverkets struktur (0.31.2) ───────────────
/**
 * Delar en stilrot i toppnivåsatser utan beroenden (ingen postcss: den här filen körs i appens grind).
 * @param {string} css @returns {{ prelude: string, body: string | null, rad: number }[]}
 */
function toppnivaSatser(css) {
  /** @type {{ prelude: string, body: string | null, rad: number }[]} */
  const ut = [];
  let i = 0;
  let start = 0;
  let djup = 0;
  let citat = "";
  let paren = 0;
  let bodyStart = -1;
  let prelude = "";
  const radAv = (/** @type {number} */ pos) => css.slice(0, pos).split("\n").length;
  for (; i < css.length; i++) {
    const c = css[i];
    if (citat) {
      if (c === "\\") i++;
      else if (c === citat) citat = "";
      continue;
    }
    if (c === '"' || c === "'") { citat = c; continue; }
    if (c === "(") paren++;
    else if (c === ")") paren = Math.max(0, paren - 1);
    if (djup === 0 && paren === 0 && c === ";") {
      const p = css.slice(start, i).trim();
      if (p) ut.push({ prelude: p, body: null, rad: radAv(start + css.slice(start, i).search(/\S/)) });
      start = i + 1;
    } else if (c === "{") {
      if (djup === 0) { prelude = css.slice(start, i).trim(); bodyStart = i + 1; }
      djup++;
    } else if (c === "}") {
      djup--;
      if (djup === 0) {
        ut.push({ prelude, body: css.slice(bodyStart, i), rad: radAv(start + Math.max(0, css.slice(start, bodyStart).search(/\S/))) });
        start = i + 1;
      }
    }
  }
  const rest = css.slice(start).trim();
  if (rest) ut.push({ prelude: rest, body: null, rad: radAv(start) });
  return ut;
}

/** En väljare som bara pekar ut tema eller rot, aldrig ett element eller en klass i ramverket. */
const TEMAVALJARE = /^(?:html|:root|\.dark|\[data-theme(?:[~|^$*]?=(?:"[^"]*"|'[^']*'|[\w-]+))?\])(?::not\(\s*(?:\.dark|\[data-theme[^\]]*\])\s*\))*(?:\s*(?:\.dark|\[data-theme[^\]]*\]))?$/;
const TILLATNA_ATREGLER = new Set(["import", "source", "font-face", "theme"]);

for (const { prelude, body, rad } of toppnivaSatser(app)) {
  const plats = `${appfil}:${rad}`;
  const svar = "Appen får skriva om VÄRDEN (@theme och :root med --*-rader), inte omforma ramverkets struktur. Behövs en annan layout eller ett annat mått: fråga ramverket (ärende i cllp/ops-framework) i stället för att skriva regeln i appen.";
  if (prelude.startsWith("@")) {
    const namn = prelude.slice(1).split(/[\s({]/)[0].toLowerCase();
    if (!TILLATNA_ATREGLER.has(namn)) {
      brott.push(`${plats} @${namn} är inte tillåten i appens stilrot (tillåtet: @import, @source, @font-face, @theme). ${svar}`);
      continue;
    }
    if (namn === "theme" && body !== null) {
      for (const d of body.split(";").map((x) => x.trim()).filter(Boolean)) {
        if (!d.startsWith("--")) brott.push(`${plats} @theme innehåller "${d.slice(0, 60)}", som inte är ett token (--*). ${svar}`);
      }
    }
    continue;
  }
  const valjare = prelude.split(",").map((x) => x.trim());
  const fel = valjare.filter((v) => !TEMAVALJARE.test(v));
  if (fel.length > 0) {
    brott.push(`${plats} regeln "${prelude.replace(/\s+/g, " ")}" stilar ${fel[0].startsWith(".") ? "en klass" : "ett element"} i stället för att deklarera tokens. ${svar}`);
    continue;
  }
  if (body !== null && body.includes("{")) {
    brott.push(`${plats} "${prelude}" innehåller en nästlad regel. ${svar}`);
    continue;
  }
  for (const d of (body ?? "").split(";").map((x) => x.trim()).filter(Boolean)) {
    if (!d.startsWith("--")) brott.push(`${plats} "${prelude}" sätter "${d.slice(0, 60)}", som inte är ett token (--*). ${svar}`);
  }
}

if (brott.length === 0) {
  console.log(`check-token-overrides: ${appfil} följer tokenkontraktet`);
  process.exit(0);
}

console.error(`check-token-overrides: ${brott.length} brott\n`);
for (const b of brott) console.error(`  ${b}`);
process.exit(1);
