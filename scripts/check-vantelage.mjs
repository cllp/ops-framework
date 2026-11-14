#!/usr/bin/env node
/**
 * Vakt: ett väntläge i ramverket rör sig (0.229.0).
 *
 * CP 2026-11-14: "progressbars som rör sig överallt där vi behöver vänta". Röd för en `role="status"` med väntetext och för en
 * annonserande `OpsSpinner` som står för en väntande yta: båda ska vara `OpsVantar`. Reglerna och golvet står i `scripts/lib/vantelage.mjs`.
 * Läget skrivs ut även när det är grönt (arbetsreglernas punkt 5).
 *
 * ⛔ Bevisad åt båda hållen i `src/__tests__/vakt-vantelage.test.jsx`: grön mot komponenterna, röd för ett inplanterat stillastående
 * väntläge och en fristående snurra, röd under golvet.
 *
 * Kör:  node scripts/check-vantelage.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GOLV, granska } from "./lib/vantelage.mjs";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(rot, "src", "components");

/** @type {Record<string, string>} */
const filer = {};
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".jsx")).sort()) filer[f] = fs.readFileSync(path.join(dir, f), "utf8");

const { brott, golv, stat } = granska(filer);

console.log(
  `check-vantelage: ${stat.filer} komponentfiler, ${stat.statusytor} statusytor, ${stat.vantelagen} OpsVantar, ${stat.undantag} undantag ` +
    `(golv: ${GOLV.filer} filer, ${GOLV.statusytor} statusytor, ${GOLV.vantelagen} OpsVantar).`,
);

if (brott.length === 0 && golv.length === 0) {
  console.log("check-vantelage: grönt. Varje väntläge är OpsVantar och rör sig.");
  process.exit(0);
}

for (const g of golv) console.error(`check-vantelage: ${g}`);
for (const b of brott) console.error(`check-vantelage: src/components/${b.fil}:${b.rad} [${b.regel}] ${b.text}`);
console.error(`\ncheck-vantelage: ${brott.length} brott, ${golv.length} golvfel. En väntan på data är <OpsVantar text="..." />, som rör sig.`);
process.exit(1);
