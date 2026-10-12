#!/usr/bin/env node
/**
 * Vakt: `package.json` och `package-lock.json` säger samma version.
 *
 * ══ ⛔ VARFÖR (0.93.0, granskningen 2026-10-12) ═══════════════════════════
 *
 * Mätt på main 2026-10-12: `package.json` stod på 0.92.5 medan `package-lock.json` stod på
 * 0.92.4, både överst (`version`) och i `packages[""].version`. Releaser bumpades i ena filen och
 * glömdes i den andra, och ingenting kontrollerade det. `npm ci` bryr sig inte om versionen i
 * lockfilen, så bygget var grönt. Men lockfilen är det som beskriver vad som installerades: en
 * lockfil som säger 0.92.4 i en tarboll som heter 0.92.5 är två sanningar om samma sak, och den
 * som läser lockfilen för att veta vilken version som körs får fel svar.
 *
 * ══ ⛔ VAD DEN LÄSER ══════════════════════════════════════════════════════
 *
 * Tre tal ska vara lika: `package.json`.version, `package-lock.json`.version och
 * `package-lock.json`.packages[""].version. Det andra och tredje är samma uppgift i lockfilen
 * (npm skriver båda), men de glider isär när någon handredigerar, och då är det inte lockfilen
 * som ljuger utan den som skrev i den.
 *
 * ⛔ GOLV: tre tal lästa. En lockfil utan `packages[""]` (en äldre lockfileVersion, eller en
 * avkortad fil) skulle ge två tal att jämföra, och två tal som är lika bevisar inte att det
 * tredje stämmer. Det blir rött och säger vilket som saknas, inte grönt på tomt underlag
 * (arbetsreglernas punkt 4).
 *
 * Kör: node scripts/check-lasversion.mjs [package.json] [package-lock.json]
 *   Utan argument läses repots egna filer. Argumenten är för `test-guards`, som planterar glidna filer.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [pkgArg, lasArg] = process.argv.slice(2);
const pkgVag = pkgArg ? path.resolve(pkgArg) : path.join(rot, "package.json");
const lasVag = lasArg ? path.resolve(lasArg) : path.join(rot, "package-lock.json");

const GOLV = 3;

/**
 * @param {string} vag
 * @returns {any}
 */
function las(vag) {
  if (!fs.existsSync(vag)) {
    console.error(`check-lasversion: ${vag} finns inte. Fel sökväg i vakten, inte ett godkänt utfall.`);
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(vag, "utf8"));
  } catch (e) {
    console.error(`check-lasversion: ${vag} är inte JSON: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}

const pkg = las(pkgVag);
const lock = las(lasVag);

/** @type {Array<[string, unknown]>} */
const kandidater = [
  ["package.json: version", pkg?.version],
  ["package-lock.json: version", lock?.version],
  ['package-lock.json: packages[""].version', lock?.packages?.[""]?.version],
];

// ⛔ GOLVET ÄR EN MÄTNING (0.93.0): hur många versioner som faktiskt lästs ur filerna, alltså sträng som inte är tom. Förut
// jämfördes längden på listan med talet tre, och listan hade alltid tre poster, så golvet kunde inte falla.
const lasta = kandidater.filter(([, v]) => typeof v === "string" && v !== "");
if (lasta.length < GOLV) {
  const saknas = kandidater.filter(([, v]) => !(typeof v === "string" && v !== ""));
  console.error(
    `check-lasversion: ${lasta.length} av ${GOLV} versioner lästa. Saknas: ${saknas.map(([namn]) => namn).join(", ")}. Två tal som är lika bevisar inte att det tredje stämmer, så det här är inte ett godkänt utfall.`,
  );
  process.exit(1);
}

const facit = String(pkg.version);
const avvikande = lasta.filter(([, v]) => v !== facit);
if (avvikande.length > 0) {
  console.error(`check-lasversion: package.json säger ${facit}, men:`);
  for (const [namn, v] of avvikande) console.error(`  ${namn} är ${String(v)}`);
  console.error("Synka lockfilen med `npm install --package-lock-only` (eller `npm version <x> --no-git-tag-version`), så båda filerna skrivs av npm och inte för hand.");
  process.exit(1);
}

console.log(`check-lasversion: package.json och package-lock.json säger båda ${facit} (${lasta.length} tal lästa, golv ${GOLV}).`);
