#!/usr/bin/env node
/**
 * Vakt: diagramfärgerna är mätta, inte valda med ögat.
 *
 * ── ⛔ VARFÖR DEN FINNS ───────────────────────────────────────────────────
 *
 * Färg i ett diagram är det enda i hela ramverket som INTE går att bedöma
 * genom att titta. En palett kan se utmärkt ut och ändå ha två serier som är
 * identiska för var tjugonde man, och den som ritar diagrammet ser det aldrig.
 *
 * Det är inte hypotetiskt här. Första försöket använde ramverkets
 * identitetstoner, som redan fanns och såg rimliga ut. Mätta föll de på tre av
 * fem kontroller: fyra av sex läses som grått, och identity-5 mot identity-6
 * ligger på delta E 8.9 för NORMALSEENDE, alltså under golvet. De är dämpade med
 * flit för att vara bakgrund till initialer, och just det gör dem oanvändbara
 * som diagramytor.
 *
 * ⛔ Vakten läser tokens.css och mäter de faktiska värdena. Den provar ingen
 * regel och litar inte på den här kommentaren: byter någon ett hex blir den röd
 * i samma stund.
 *
 * ── ⛔ FYRA KÖRNINGAR, INTE EN ───────────────────────────────────────────
 *
 * Serierna mäts i ljust OCH mörkt läge, mot ramverkets EGNA ytor. Ett värde som
 * klarar sig mot vitt kan ligga under kontrastgolvet mot #16161c, och tvärtom.
 * Skalan mäts som ordinal i båda lägen, alltså ska den vara en nyans som
 * mörknar med jämna steg och ändå synas mot ytan i sin ljusa ände.
 *
 * Mätverktyget i `vendor/` kommer från dataviz-skillen och är oförändrat. Det
 * ligger i repot i stället för att köras ur en skill, eftersom en vakt som bara
 * finns i någons verktygslåda inte är en vakt.
 *
 * Kör: node scripts/check-diagramfarger.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tokenfil = process.argv[2] ? path.resolve(process.argv[2]) : path.join(rot, "tokens", "tokens.css");
const matverktyg = path.join(rot, "scripts", "vendor", "validate_palette.js");

const css = fs.readFileSync(tokenfil, "utf8");

/**
 * ⛔ Läser deklarationerna i den ordning de står i filen. Ordningen ÄR
 * mekaniken för färgblindhet: paletten är validerad som en följd av grannar, så
 * en sorterad läsning hade mätt en annan palett än den som ritas.
 *
 * @param {RegExp} monster
 */
function hexIOrdning(monster) {
  /** @type {{ nr: number, hex: string }[]} */
  const ut = [];
  for (const m of css.matchAll(monster)) ut.push({ nr: Number(m[1]), hex: m[2] });
  return ut;
}

const ljusSerier = hexIOrdning(/--color-series-(\d+):\s*(#[0-9a-f]{6})/g);
const morkSerier = hexIOrdning(/--dark-series-(\d+):\s*(#[0-9a-f]{6})/g);
const ljusSkala = hexIOrdning(/--color-scale-(\d+):\s*(#[0-9a-f]{6})/g);
const morkSkala = hexIOrdning(/--dark-scale-(\d+):\s*(#[0-9a-f]{6})/g);

/** @type {string[]} */
const fel = [];

// ⛔ Golv. Matchar inget blir varje körning grön av tom indata, och det är den
// vanligaste orsaken till att en vakt är grön i månader utan att göra något.
for (const [namn, lista] of /** @type {[string, {nr:number,hex:string}[]][]} */ ([
  ["--color-series-*", ljusSerier],
  ["--dark-series-*", morkSerier],
  ["--color-scale-*", ljusSkala],
  ["--dark-scale-*", morkSkala],
])) {
  if (lista.length < 3) fel.push(`Hittade bara ${lista.length} ${namn} i ${path.relative(rot, tokenfil)}. Fel fil, eller tokens borttagna.`);
}

// Ljus och mörk uppsättning måste ha samma antal slottar. En serie som saknar
// sitt mörka steg ärver en färg som aldrig mättes.
if (ljusSerier.length !== morkSerier.length) {
  fel.push(`${ljusSerier.length} ljusa serier men ${morkSerier.length} mörka. Varje slot måste finnas i båda lägen, annars ritas en omätt färg i det ena.`);
}
if (ljusSkala.length !== morkSkala.length) {
  fel.push(`${ljusSkala.length} ljusa skalsteg men ${morkSkala.length} mörka.`);
}

/**
 * ⛔ Den MÖRKA skalan läses baklänges med flit. Mot en mörk yta betyder
 * "mer" ljusare, så stegen är deklarerade mörkast först. Verktyget kräver en
 * monoton ljus-till-mörk följd, alltså ska den vändas innan den mäts. Skulle
 * den mätas som den står blir vakten röd mot en skala som är rätt.
 */
const korningar = [
  { namn: "serier, ljust läge", hex: ljusSerier.map((x) => x.hex), flaggor: ["--mode", "light", "--surface", "#ffffff"] },
  { namn: "serier, mörkt läge", hex: morkSerier.map((x) => x.hex), flaggor: ["--mode", "dark", "--surface", "#16161c"] },
  { namn: "skala, ljust läge", hex: ljusSkala.map((x) => x.hex), flaggor: ["--ordinal", "--mode", "light", "--surface", "#ffffff"] },
  { namn: "skala, mörkt läge", hex: [...morkSkala].reverse().map((x) => x.hex), flaggor: ["--ordinal", "--mode", "dark", "--surface", "#16161c"] },
];

for (const k of korningar) {
  if (k.hex.length === 0) continue;
  const res = spawnSync(process.execPath, [matverktyg, k.hex.join(","), ...k.flaggor], { encoding: "utf8" });
  const utdata = `${res.stdout ?? ""}${res.stderr ?? ""}`;
  if (!/ALL CHECKS PASS/.test(utdata)) {
    const rader = utdata
      .split("\n")
      .filter((r) => /\[(FAIL|WARN)\]/.test(r))
      .map((r) => `      ${r.trim()}`)
      .join("\n");
    fel.push(`${k.namn}: paletten klarar inte alla kontroller.\n${rader}`);
  } else {
    // WARN är inte ett fel men får inte vara osynligt: ett kontrastvarnat slot
    // förpliktigar till synliga etiketter eller tabellvy, och den som ritar
    // nästa diagram ska se kravet utan att leta.
    const varningar = utdata.split("\n").filter((r) => /\[WARN\]/.test(r));
    console.log(`  · ${k.namn}: alla kontroller gröna${varningar.length ? ", med varning" : ""}`);
    for (const v of varningar) console.log(`      ${v.trim()}`);
  }
}

if (fel.length > 0) {
  console.error("\ncheck-diagramfarger: FEL\n");
  for (const f of fel) console.error(`  - ${f}\n`);
  console.error("  Färg i diagram går inte att bedöma med ögat. Fixa värdena, stäng inte av mätningen.\n");
  process.exit(1);
}

console.log(`\ncheck-diagramfarger: ${ljusSerier.length} serier och ${ljusSkala.length} skalsteg mätta i båda lägen, mot ramverkets egna ytor.`);
