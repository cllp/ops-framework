#!/usr/bin/env node
/**
 * Vakt: varje knapp som startar ett anrop visar att den väntar (0.141.0).
 *
 * CP 2026-10-23, om en knapp som blev blek utan att något syntes medan servern svarade: "Medans man kopplar måste man få en progress.
 * Detta glömmer vi ofta. Se till att alla ställen där användaren väntar på svar får en progress."
 *
 * Reglerna, hur filerna läses och varför undantagen har ett tak står i `scripts/lib/vantar.mjs`. Den här filen läser komponenterna och
 * skriver ut resultatet, med läget även när det är grönt (arbetsreglernas punkt 5: tomhet är ett svar).
 *
 * ⛔ Bevisad åt båda hållen i `src/__tests__/vakt-vantar.test.js`: grön mot komponenterna, röd för varje inplanterat brott
 * (en rå knapp, ett svalt löfte, en submit utan väntan, ett undantag utan skäl, ett dött undantag) och röd under golvet.
 *
 * Kör:  node scripts/check-vantar.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GOLV, UNDANTAGSTAK, granska } from "./lib/vantar.mjs";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(rot, "src", "components");

/** @type {Record<string, string>} */
const filer = {};
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".jsx")).sort()) filer[f] = fs.readFileSync(path.join(dir, f), "utf8");

const { brott, golv, stat } = granska(filer);

console.log(
  `check-vantar: ${stat.filer} komponentfiler, ${stat.knappar} knappar, ${stat.anropande} handlare som startar ett anrop, ` +
    `${stat.undantag} undantag av högst ${UNDANTAGSTAK} (vantar-ej), ${stat.loftesprops} löftesprops i JSDoc, ${stat.val} val (OpsSwitch, OpsCheckbox, OpsSelect) ` +
    `(golv: ${GOLV.filer} filer, ${GOLV.knappar} knappar, ${GOLV.anropande} anropande, ${GOLV.loftesprops} props, ${GOLV.val} val).`,
);

if (brott.length === 0 && golv.length === 0) {
  console.log("check-vantar: grönt. Varje knapp som startar ett anrop väntar synligt, eller bär ett undantag med skäl.");
  process.exit(0);
}

for (const g of golv) console.error(`check-vantar: ${g}`);
for (const b of brott) console.error(`check-vantar: src/components/${b.fil}:${b.rad} [${b.regel}] ${b.text}`);
console.error(
  `\ncheck-vantar: ${brott.length} brott, ${golv.length} golvfel. En knapp som startar ett anrop visar en snurra och är aria-busy medan den väntar ` +
    "(OpsButton gör det själv när onClick ger ett löfte, annars busy). Skillen interaktionsdesign, avsnitt 7, säger hur.",
);
process.exit(1);
