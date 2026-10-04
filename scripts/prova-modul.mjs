#!/usr/bin/env node
/**
 * Provar en modul mot ramverkets kontrakt (0.56.0, cllp/ops-framework#244). Det en agent kör innan modulen lämnas till
 * granskning, och det granskaren kör för att se samma sak.
 *
 *   node node_modules/@staiger/ops-framework/scripts/prova-modul.mjs <fil> --grupp <groupId> [--export <namn>]
 *
 * `<fil>` är modulens manifestfil. `--export` väljer exporten när filen har flera, annars tas den första exporten som har
 * `id` och `kallor`. Avslutas med 1 när ett steg faller, och skriver ut varje steg, också de godkända.
 */

import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { provaModul, provrapport } from "../src/lib/modulprov.js";

const args = process.argv.slice(2);
const fil = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--grupp" && args[args.indexOf(a) - 1] !== "--export");
const grupp = args.includes("--grupp") ? args[args.indexOf("--grupp") + 1] : "";
const exportnamn = args.includes("--export") ? args[args.indexOf("--export") + 1] : "";

if (!fil || !grupp) {
  console.error("prova-modul: ange modulens fil och en grupp med data: prova-modul.mjs <fil> --grupp <groupId> [--export <namn>]");
  process.exit(2);
}

const mod = await import(pathToFileURL(path.resolve(fil)).href);
const kandidater = Object.entries(mod).filter(([, v]) => v && typeof v === "object" && typeof v.id === "string" && v.kallor && typeof v.kallor === "object");
const vald = exportnamn ? kandidater.find(([n]) => n === exportnamn) : kandidater[0];
if (!vald) {
  console.error(`prova-modul: ${fil} exporterar ${exportnamn ? `ingen modul med namnet ${exportnamn}` : "ingen modul (ett objekt med id och kallor)"}. Exporter: ${Object.keys(mod).join(", ") || "inga"}.`);
  process.exit(2);
}

const svar = await provaModul(vald[1], { groupId: grupp });
const text = provrapport(svar);
if (svar.ok) console.log(text);
else {
  console.error(text);
  process.exit(1);
}
