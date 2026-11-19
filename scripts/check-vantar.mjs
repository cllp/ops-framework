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
 * ══ ⛔ MED ETT ARGUMENT LÄSER DEN APPENS KATALOG (0.245.0) ═════════════════════════════════════════════════════════════════════════
 *
 * Mätt 2026-11-19: lifehub.app körde `node node_modules/ops-framework/scripts/check-vantar.mjs src`, men skriptet läste alltid ramverkets
 * egen `src/components` och argumentet användes aldrig. Appens vakt var grön utan att ha läst en enda av appens filer (arbetsreglernas
 * punkt 4, tomt underlag), och en granskning samma natt hittade två brott i appen som vakten aldrig hade sett.
 *
 * Nu läser den katalogen, relativt arbetskatalogen och rekursivt, alla `.jsx` utom proven (`__tests__/` och `*.test.jsx`: ett prov som
 * renderar en knapp är inte appens knapp). Sökvägarna i brotten står relativt katalogen, och raden säger vilken katalog som lästes.
 * Ramverkets golv och tak är ramverkets mått, så en app anger sina egna:
 *
 *   --tak=N            antalet `vantar-ej` som får finnas (standard 0). Röd över taket, och röd när taket står högre än antalet.
 *   --golv-filer=N     minst så många filer lästa (standard 1)
 *   --golv-knappar=N   minst så många knappar lästa (standard 1)
 *
 * ⛔ En katalog som inte finns, en tom katalog och en okänd flagga är röda. Ingen av dem får bli en tyst grön (punkt 5).
 *
 * ⛔ Bevisad åt båda hållen i `src/__tests__/vakt-vantar.test.jsx`: grön mot komponenterna, röd för varje inplanterat brott
 * (en rå knapp, ett svalt löfte, en submit utan väntan, ett undantag utan skäl, ett dött undantag) och röd under golvet. Proven för
 * katalogen kör det här skriptet som en process, som appen gör.
 *
 * Kör:  node scripts/check-vantar.mjs                                        (ramverkets komponenter)
 *       node node_modules/ops-framework/scripts/check-vantar.mjs src --tak=2 --golv-filer=100 --golv-knappar=200   (i en app)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GOLV, UNDANTAGSTAK, granska } from "./lib/vantar.mjs";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** @param {string} text */
function stopp(text) {
  console.error(`check-vantar: ${text}`);
  process.exit(1);
}

const FLAGGOR = { "--tak": "tak", "--golv-filer": "filer", "--golv-knappar": "knappar" };
/** @type {string[]} */
const kataloger = [];
/** @type {Record<string, number>} */
const angivet = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith("--")) {
    kataloger.push(a);
    continue;
  }
  const [namn, varde] = a.split("=");
  const nyckel = /** @type {Record<string, string>} */ (FLAGGOR)[namn];
  if (!nyckel) stopp(`okänd flagga "${a}". Giltiga: ${Object.keys(FLAGGOR).join(", ")}.`);
  if (varde === undefined || !/^\d+$/.test(varde)) stopp(`${namn} kräver ett heltal (${namn}=N), fick "${a}".`);
  angivet[nyckel] = Number(varde);
}
if (kataloger.length > 1) stopp(`en katalog åt gången, fick ${kataloger.length}: ${kataloger.join(", ")}.`);
const appen = kataloger.length === 1;
if (!appen && Object.keys(angivet).length > 0) stopp("--tak och --golv-* gäller en apps katalog. Utan katalog läser vakten ramverkets komponenter med ramverkets mått.");

/** @type {Record<string, string>} */
const filer = {};
/** @type {string} */
let etikett;
/** @type {Record<string, number>} */
let golvMatt;
/** @type {number} */
let tak;

if (appen) {
  const katalog = path.resolve(process.cwd(), kataloger[0]);
  if (!fs.existsSync(katalog) || !fs.statSync(katalog).isDirectory()) stopp(`katalogen "${kataloger[0]}" finns inte (${katalog}). En vakt som läser fel sökväg mäter ingenting.`);
  etikett = kataloger[0].replace(/\/+$/, "") || ".";
  golvMatt = { filer: angivet.filer ?? 1, knappar: angivet.knappar ?? 1 };
  tak = angivet.tak ?? 0;
  /** @param {string} dir */
  const las = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((x, y) => x.name.localeCompare(y.name))) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === "__tests__" || e.name.startsWith(".")) continue;
        las(full);
      } else if (e.isFile() && e.name.endsWith(".jsx") && !e.name.endsWith(".test.jsx")) {
        filer[path.relative(katalog, full).split(path.sep).join("/")] = fs.readFileSync(full, "utf8");
      }
    }
  };
  las(katalog);
} else {
  const dir = path.join(rot, "src", "components");
  etikett = "src/components";
  golvMatt = GOLV;
  tak = UNDANTAGSTAK;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".jsx")).sort()) filer[f] = fs.readFileSync(path.join(dir, f), "utf8");
}

const { brott, golv, stat } = granska(filer, { golv: golvMatt, tak });

const golvText = Object.entries(golvMatt)
  .map(([namn, min]) => `${min} ${namn}`)
  .join(", ");
console.log(
  `check-vantar: läste ${etikett}: ${stat.filer} filer, ${stat.knappar} knappar, ${stat.anropande} handlare som startar ett anrop, ` +
    `${stat.undantag} undantag av högst ${tak} (vantar-ej), ${stat.loftesprops} löftesprops i JSDoc, ${stat.val} val (OpsSwitch, OpsCheckbox, OpsSelect) ` +
    `(golv: ${golvText}).`,
);

if (brott.length === 0 && golv.length === 0) {
  console.log("check-vantar: grönt. Varje knapp som startar ett anrop väntar synligt, eller bär ett undantag med skäl.");
  process.exit(0);
}

for (const g of golv) console.error(`check-vantar: ${g}`);
// Ramverkets egna rader står som förut (`src/components/X.jsx`). En apps står relativt katalogen, som raden ovan namnger.
for (const b of brott) console.error(`check-vantar: ${appen ? "" : "src/components/"}${b.fil}:${b.rad} [${b.regel}] ${b.text}`);
console.error(
  `\ncheck-vantar: ${brott.length} brott, ${golv.length} golvfel. En knapp som startar ett anrop visar en snurra och är aria-busy medan den väntar ` +
    "(OpsButton gör det själv när onClick ger ett löfte, annars busy). Skillen interaktionsdesign, avsnitt 7, säger hur.",
);
process.exit(1);
