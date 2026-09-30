#!/usr/bin/env node
/**
 * Vakt: generatorn ändrar inte reglernas mönster utan att någon ser det.
 *
 * ══ ⛔ VARFÖR EN GYLLENE FIL OCH INTE EN ANDRA SANNING (#130) ══════════
 *
 * `rules/__fixturer__/genererad.rules` är inte en handskriven kopia av
 * reglerna, den är FÖRRA UTFALLET av generatorn för en fast fixtur. Skillnaden
 * är avgörande: en handskriven kopia glider isär i tysthet, medan en gyllene
 * fil INTE KAN glida isär, eftersom varje avvikelse är precis det den här
 * vakten larmar på.
 *
 * ⛔ DEN BEVISAR STABILITET, INTE RIKTIGHET. Att mönstret är rätt bevisas av
 * emulatorproven i `rules/__tests__/`, som kör riktiga läsningar mot riktiga
 * regler. Den här vakten svarar på en annan fråga: ändrades något utan att
 * någon nämnde det i en PR.
 *
 * ⛔ BYTE-FÖR-BYTE MOT bolag-ops EGEN `firestore.rules` HÖR INTE HIT. Den filen
 * bor i appen, och en incheckad kopia av den här vore just den andra
 * handskrivna sanningen arbetsreglernas punkt 2 förbjuder. Den diffen är
 * appens kedja, där båda halvorna finns. Frågan är ställd i #130.
 *
 * Kör: node scripts/check-regelgenerator.mjs [--skriv]
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { defineModule } from "../src/lib/modul.js";
import { generateRules } from "../src/lib/regler.js";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gyllene = path.join(rot, "rules", "__fixturer__", "genererad.rules");

/**
 * Fixturen: två moduler, fyra samlingar, båda skrivvillkoren och båda
 * formerna av formvalidering.
 *
 * ⛔ FIXTUREN TÄCKER VARJE GREN I GENERATORN. En fixtur som bara använder
 * förvalen bevisar att förvalen är stabila och ingenting annat, och då är
 * vakten grön genom varje ändring av det som faktiskt varierar.
 */
const MODULER = [
  defineModule({
    id: "ekonomi",
    namn: { sv: "Ekonomi", en: "Finance" },
    nav: [],
    routes: [],
    kallor: {},
    skapar: [],
    hubb: null,
    samlingar: [
      { namn: "fakturor", falt: ["id", "groupId", "belopp", "skapadAv"] },
      { namn: "konfig", falt: ["id", "groupId", "varde"], agareKravsForSkrivning: true },
    ],
  }),
  defineModule({
    id: "liv",
    namn: { sv: "Liv", en: "Life" },
    nav: [],
    routes: [],
    kallor: {},
    skapar: [],
    hubb: null,
    // ⛔ Strängformen med flit: den är utgiven i 0.25.0 och ska fortsätta ge
    // ett block utan formvalidering, inte ett block som låser allt ute.
    samlingar: ["matningar", { namn: "mal", agareKravsForSkrivning: true }],
  }),
];

const EXTRA = `    // Appens eget undantag, skrivet för hand och skickat in som extra.
    match /grundarreserv/{id} {
      allow read: if opsInloggad();
      allow write: if false;
    }
`;

const text = generateRules(MODULER, { extra: EXTRA });

if (process.argv.includes("--skriv")) {
  fs.mkdirSync(path.dirname(gyllene), { recursive: true });
  fs.writeFileSync(gyllene, text);
  console.log(`check-regelgenerator: skrev om ${path.relative(rot, gyllene)}. Granska diffen i PR:en, det är hela poängen med filen.`);
  process.exit(0);
}

if (!fs.existsSync(gyllene)) {
  console.error(`check-regelgenerator: ${path.relative(rot, gyllene)} saknas. Kör med --skriv och granska resultatet.`);
  process.exit(1);
}

const fanns = fs.readFileSync(gyllene, "utf8");

/*
 * ⛔ GOLV. En fixtur som slutat ge samlingar gör diffen grön mot en fil som
 * också är tom, alltså grönt av att ingenting mättes. Fyra samlingar plus
 * ramverkets fyra egna, och katch-allen.
 */
const block = (text.match(/^ {4}match \//gm) ?? []).length;
if (block < 9) {
  console.error(`check-regelgenerator: bara ${block} match-block genererades, väntade minst 9. Fixturen mäter inte längre det den påstår.`);
  process.exit(1);
}
if (!text.includes("hasOnly")) {
  console.error("check-regelgenerator: ingen formvalidering i utfallet. Fixturen har tappat sin fältlista, och då provas inte den grenen.");
  process.exit(1);
}

if (fanns !== text) {
  const nya = text.split("\n");
  const gamla = fanns.split("\n");
  const rad = nya.findIndex((r, i) => r !== gamla[i]);
  console.error(
    `check-regelgenerator: generatorn ger inte längre samma text som ${path.relative(rot, gyllene)}.\n\n` +
      `  Första skillnaden på rad ${rad + 1}:\n` +
      `    var:  ${gamla[rad] ?? "(filen slutar)"}\n` +
      `    blev: ${nya[rad] ?? "(filen slutar)"}\n\n` +
      "  Är ändringen avsedd: kör med --skriv och lägg diffen i PR:en. Är den inte det är det generatorn som är fel, inte filen.",
  );
  process.exit(1);
}

console.log(`check-regelgenerator: ${block} match-block, formvalidering på plats, och texten är identisk med den gyllene filen.`);
process.exit(0);
