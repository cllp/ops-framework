#!/usr/bin/env node
/**
 * Vakt: README och exempelmodulen säger samma sak om modulkontraktet.
 *
 * ══ ⛔ VARFÖR DEN HÄR VAKTEN FINNS (#131) ══════════════════════════════
 *
 * Klarkriteriet i epiken #92: en modulbyggare ska kunna bygga en händelsekälla
 * ur README och exempelmodulen UTAN att öppna ramverkets källkod. Det går inte
 * att bevisa med ett prov, bara med att någon gör det. Det som DÄREMOT går att
 * vakta är att de två dokumenten inte glider isär: ett fält som finns i koden
 * men inte i README är ett fält ingen hittar, och ett fält README lovar men
 * exemplet inte visar är ett löfte utan täckning.
 *
 * ⛔ FÄLTEN LÄSES UR KÄLLAN, DE SKRIVS INTE HÄR. En lista i den här filen hade
 * varit en tredje sanning som glider isär från de två den vaktar, alltså exakt
 * det arbetsreglernas punkt 2 handlar om. `MODULFALT`, `SAMLINGSFALT` och
 * `KALLTYPER` läses ur `src/lib/modul.js`.
 *
 * Kör: node scripts/check-exempelmodul.mjs [rot]
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const har = path.dirname(fileURLToPath(import.meta.url));
const rot = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(har, "..");

const modulkallan = path.join(rot, "src", "lib", "modul.js");
const readme = path.join(rot, "README.md");
const exempelmapp = path.join(rot, "examples", "paminnelser");

for (const [vad, sokvag] of [["modul.js", modulkallan], ["README.md", readme], ["exempelmodulen", exempelmapp]]) {
  if (!fs.existsSync(sokvag)) {
    console.error(`check-exempelmodul: hittar inte ${vad} på ${sokvag}. Fel sökväg i vakten, inte ett godkänt utfall.`);
    process.exit(1);
  }
}

const kalla = fs.readFileSync(modulkallan, "utf8");

/**
 * Fältlistorna ur källan.
 *
 * ⛔ TVÅ FORMER, EFTERSOM KÄLLAN HAR TVÅ. `KALLTYPER` är en frusen const med
 * `@type {const}`, `MODULFALT` en vanlig array. En vakt som bara kände den ena
 * hade läst noll fält ur den andra och stått grön på tom indata.
 *
 * @param {string} namn
 * @returns {string[]}
 */
function lista(namn) {
  const rad = kalla.split("\n").find((r) => r.includes(`${namn} =`));
  if (!rad) return [];
  return [...rad.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

const modulfalt = lista("MODULFALT");
const samlingsfalt = lista("SAMLINGSFALT");
const kalltyper = lista("KALLTYPER");

/*
 * ⛔ GOLV. Blir mönstret fel läser vakten noll fält och står grön mot två
 * dokument den inte jämfört. Talen är dagens, och de får bara växa.
 */
if (modulfalt.length < 6 || samlingsfalt.length < 3 || kalltyper.length < 6) {
  console.error(
    `check-exempelmodul: läste ${modulfalt.length} manifestfält, ${samlingsfalt.length} samlingsfält och ${kalltyper.length} källtyper ur modul.js. Väntade minst 6, 3 och 6. Fel mönster, alltså mäter vakten ingenting.`,
  );
  process.exit(1);
}

/** @type {string[]} */
const brott = [];

const readmetext = fs.readFileSync(readme, "utf8");
const i = readmetext.indexOf("### Modulkontraktet");
if (i < 0) {
  console.error('check-exempelmodul: README saknar rubriken "### Modulkontraktet". Utan den finns ingenting att hålla exemplet i takt med.');
  process.exit(1);
}
/*
 * ⛔ BARA AVSNITTET, INTE HELA README. Ett fältnamn som råkar nämnas i ett
 * annat kapitel bevisar inte att modulkontraktet är dokumenterat, och en vakt
 * som läser hela filen blir grön av en slump.
 */
const slut = readmetext.indexOf("\n### ", i + 5);
const avsnitt = readmetext.slice(i, slut < 0 ? readmetext.length : slut);

const exempelfiler = fs
  .readdirSync(exempelmapp)
  .filter((f) => f.endsWith(".js") || f.endsWith(".jsx"))
  .map((f) => ({ namn: f, text: fs.readFileSync(path.join(exempelmapp, f), "utf8") }));

const exempel = exempelfiler.map((f) => f.text).join("\n");

/*
 * ══ ⛔ EXEMPLET FÅR INTE NÅ UT UR SIN EGEN MAPP ════════════════════════
 *
 * Granskningsfynd på #151. Exemplet importerade `../../src/lib/modul.js`,
 * alltså ramverkets INNANMÄTE, medan README säger
 * `import { defineModule } from "@staiger/ops-framework"`.
 *
 * ⛔ DET BRÖT MOT DET ENDA LÖFTE MAPPEN FINNS FÖR: att den ska gå att kopiera
 * och bygga vidare på ur README, utan att öppna ramverkets källkod. En
 * modulbyggare som kopierade mappen fick sökvägar som inte finns i en
 * installerad tarboll, och felet kom först vid bygget i hens eget projekt.
 *
 * ⛔ OCH DEN GAMLA VAKTEN KUNDE INTE SE DET. Den jämför FÄLTNAMN mellan
 * README, modul.js och exemplet. Importvägar är inte fältnamn, så avvikelsen
 * var osynlig genom varje grön körning.
 *
 * Node tillåter självreferens via paketnamnet när `exports` finns, så
 * exemplet importerar `@staiger/ops-framework` även inne i repot. Relativa
 * vägar INOM mappen är tillåtna: det är så en kopierad mapp hänger ihop.
 */
/** @type {string[]} */
const importrader = [];
for (const fil of exempelfiler) {
  for (const rad of fil.text.split("\n")) {
    const m = /^\s*(?:import|export)\b[^"']*from\s*["']([^"']+)["']/.exec(rad) || /^\s*import\s*\(\s*["']([^"']+)["']/.exec(rad.trim());
    const dynamisk = /import\(\s*["']([^"']+)["']\s*\)/.exec(rad);
    const spec = m ? m[1] : dynamisk ? dynamisk[1] : null;
    if (!spec) continue;
    importrader.push(`${fil.namn}: ${spec}`);
    if (spec.startsWith("../")) {
      brott.push(
        `exempelmodulen: ${fil.namn} importerar "${spec}", alltså utanför sin egen mapp. Den ska gå att kopiera och bygga ur README, och README säger import från "@staiger/ops-framework". En relativ väg ut ur mappen finns inte i en installerad tarboll.`,
      );
    }
  }
}

/*
 * ⛔ GOLV PÅ IMPORTRADERNA. Utan det blir kontrollen grön av att mönstret
 * slutade matcha, alltså av att den inte läste någon import alls. Talet är
 * dagens och får bara växa.
 */
if (importrader.length < 4) {
  console.error(
    `check-exempelmodul: läste bara ${importrader.length} importrader ur exempelmappen, golvet är 4. Fel mönster, alltså mäter importkontrollen ingenting.`,
  );
  process.exit(1);
}

/** @param {string[]} falt @param {string} vad */
function kravBada(falt, vad) {
  for (const f of falt) {
    if (!avsnitt.includes(f)) brott.push(`${vad} "${f}" finns i modul.js men inte i README-avsnittet "Modulkontraktet". Ett fält ingen dokumenterar är ett fält ingen hittar.`);
    if (!exempel.includes(f)) brott.push(`${vad} "${f}" finns i modul.js men inte i exempelmodulen. Ett fält exemplet inte visar är ett löfte utan täckning.`);
  }
}

kravBada(modulfalt, "manifestfältet");
kravBada(samlingsfalt, "samlingsfältet");
kravBada(kalltyper, "källtypen");

if (brott.length === 0) {
  console.log(
    `check-exempelmodul: ${modulfalt.length} manifestfält, ${samlingsfalt.length} samlingsfält och ${kalltyper.length} källtyper finns både i README-avsnittet och i exempelmodulen, och exemplets ${importrader.length} importer går alla via paketnamnet eller inom mappen.`,
  );
  process.exit(0);
}

console.error(`check-exempelmodul: ${brott.length} fält som README och exemplet inte är överens om\n`);
for (const b of brott) console.error(`  ${b}`);
process.exit(1);
