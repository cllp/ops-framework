#!/usr/bin/env node
/**
 * Skriver ramverkets versionskonstant ur `package.json`.
 *
 * ⛔ #157: versionsraden i `OpsAnvandarmeny` ska bära ramverkets version "läst
 * ur paketets `package.json` vid bygget (en konstant i bundeln, inte en
 * läsning i körtid)". Det kravet har två delar, och båda löses här:
 *
 *   1. EN SANNING PER FAKTUM. Numret finns redan i `package.json`. Ett
 *      handskrivet `export const VERSION = "0.26.0"` i källkoden hade varit en
 *      andra kopia, och de två glider isär första gången någon bumpar den ena
 *      utan den andra, precis den bugg `check-paket.mjs` och `test-guards.mjs`
 *      redan jagar på andra ställen i det här repot.
 *   2. EN KONSTANT, INTE ETT `fetch`. `package.json` finns inte i en
 *      konsumentapps webbläsare, så en körtidsläsning hade krävt att appen
 *      bunta med paketfilen eller att ramverket exponerade ett nätverksanrop
 *      för ett tal som är känt redan vid bygget.
 *
 * ⛔ FILEN SOM SKRIVS ÄR GIT-IGNORERAD, av samma skäl som
 * `rules/provregler.rules`: en genererad fil och en committad kopia av samma
 * sanning glider isär i samma sekund som någon bumpar `package.json` utan att
 * köra om generatorn. Den körs därför automatiskt före `build`, `check:types`
 * och `test` (se `package.json` `pre*`-skript), så en färsk checkout aldrig
 * kan råka läsa en gammal siffra.
 *
 * Kör: node scripts/generate-framework-version.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const paket = JSON.parse(fs.readFileSync(path.join(rot, "package.json"), "utf8"));

if (!paket.version || typeof paket.version !== "string") {
  throw new Error("generate-framework-version: package.json saknar ett versionsfält. Kan inte skriva konstanten.");
}

const ut = path.join(rot, "src", "lib", "frameworkVersion.generated.js");

fs.writeFileSync(
  ut,
  `/**
 * ⛔ GENERERAD AV scripts/generate-framework-version.mjs. RÖR ALDRIG FÖR HAND.
 *
 * Källan är package.json, inte den här filen. En handskriven ändring här
 * överlevde till nästa körning av "npm run build" eller "npm test" och
 * skrivs då över, tyst. Vill du ändra numret: bumpa package.json och kör
 * generatorn (den körs redan automatiskt före build, check:types och test).
 */
export const OPS_FRAMEWORK_VERSION = ${JSON.stringify(paket.version)};
`,
);

console.log(`generate-framework-version: OPS_FRAMEWORK_VERSION = ${paket.version}`);
