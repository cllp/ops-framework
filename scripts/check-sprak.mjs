#!/usr/bin/env node
/**
 * Vakt: ramverkets komponenter bär inte sina etiketter som svenska förval i parameterlistan (0.46.0, cllp/bolag-ops#528).
 *
 * ══ ⛔ HÄNDELSEN ═════════════════════════════════════════════════════════
 *
 * CP 2026-10-01: "byta språk i profil byter inte språk". Mätt: profilen sparade valet, men varje komponent hade sina etiketter som
 * svenska förval (`menuLabel = "Meny"`), och ingenting läste språket. 0.46.0 flyttade de mest synliga ytornas förval till en ordbok
 * per komponent (`src/lib/ord.js`, `ORD_*`) och lade språket i `OpsSprakProvider`.
 *
 * ══ ⛔ ETT TAK SOM BARA FÅR SJUNKA, INTE NOLL ════════════════════════════
 *
 * Arbetsreglernas punkt 4: vaktar man en skuld sätter man ett tak, inte noll. 183 förval före 0.46.0, 118 efter, 112 i 0.63.0 (OpsNyttMeddelande och skalets skickaEtikett borttagna, #263). Noll hade gjort varje
 * kvarvarande komponent röd på en gång, och då hade vakten stängts av. Taket sänks i samma PR som flyttar fler förval till en ordbok;
 * det höjs aldrig. En ny komponent med ett svenskt förval gör vakten röd, och svaret är en ordbok, inte ett högre tak.
 *
 * ══ ⛔ VAD SOM RÄKNAS ════════════════════════════════════════════════════
 *
 * En parameter vars namn slutar på Label, Etikett, Text, Rubrik, Titel eller Beskrivning och som har en icke-tom sträng som förval.
 * Namnet avgör och inte värdets form: "nya" och "nu" är svenska etiketter fast de är gemena enstaka ord, och ett mönster på värdet
 * släppte igenom dem. Ett förval som pekar på en ordbok (`= ORD_X.y.sv`) räknas inte, för det är ingen litteral.
 *
 * GOLV: minst 90 komponentfiler lästa. En vakt som blir grön av att inget lästes mäter ingenting.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const katalog = path.join(rot, "src", "components");

/** Taket. ⛔ FÅR BARA SJUNKA. */
export const TAK = 112;
const GOLV_FILER = 90;
const MONSTER = /(?:^|[\s({,])([a-zA-Z]*(?:[Ll]abel|[Ee]tikett|[Tt]ext|[Rr]ubrik|[Tt]itel|[Bb]eskrivning)) = "([^"]+)"/g;

/** @param {string} kod */
export function rakna(kod) {
  const utanKommentarer = kod.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  return [...utanKommentarer.matchAll(MONSTER)].map((m) => `${m[1]} = "${m[2]}"`);
}

function main() {
  const filer = fs.readdirSync(katalog).filter((f) => f.endsWith(".jsx"));
  if (filer.length < GOLV_FILER) {
    console.error(`check-sprak: RÖTT. Bara ${filer.length} komponentfiler lästes, golvet är ${GOLV_FILER}. En vakt utan underlag mäter ingenting.`);
    process.exit(1);
  }
  /** @type {Array<[string, string[]]>} */
  const per = filer.map((f) => [f, rakna(fs.readFileSync(path.join(katalog, f), "utf8"))]);
  const antal = per.reduce((n, [, t]) => n + t.length, 0);
  if (antal > TAK) {
    console.error(`check-sprak: RÖTT. ${antal} svenska förval i komponenternas parametrar, taket är ${TAK}.`);
    console.error("  Lägg etiketterna i en ordbok (src/lib/ord.js, mönstret i OpsAppShell) i stället för att höja taket.");
    for (const [f, t] of per.filter(([, t]) => t.length).sort((a, b) => b[1].length - a[1].length).slice(0, 10)) console.error(`  ${f}: ${t.length}`);
    process.exit(1);
  }
  const marginal = TAK - antal;
  console.log(`check-sprak: ${filer.length} komponentfiler, ${antal} svenska förval kvar (tak ${TAK})${marginal > 0 ? `. ⛔ ${marginal} under taket: sänk TAK till ${antal} i samma PR` : ""}.`);
  if (marginal > 0) process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
