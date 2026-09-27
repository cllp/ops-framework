#!/usr/bin/env node
/**
 * Vakt: exakt EN gruppnyckel per rad, i varje samling ramverket äger.
 *
 * ══ ⛔ VARFÖR DEN HÄR VAKTEN FINNS (#136) ══════════════════════════════
 *
 * SessionStudio bar `invitedGroupIds` på raderna, alltså delning inbakad i
 * datamodellen. Följden var att varje regel, varje fråga och varje vy fick bära
 * "eller någon av de här", och att ingen längre kunde svara på vems rad något
 * var. Det går inte att ta bort efteråt, eftersom datan redan har formen.
 *
 * Fas 2.5 valde motsatsen: ett `groupId`, ett uppslag. Sammanslagning över
 * flera grupper (#139) sker i RAMVERKET, med en fråga per grupp, och ändrar
 * ingen rad och ingen regel.
 *
 * ⛔ VAKTEN ÄR BILLIG I DAG OCH OMÖJLIG ATT EFTERMONTERA. Det är hela skälet
 * att den skrivs nu, innan den första raden finns.
 *
 * Kör: node scripts/check-gruppnyckel.mjs
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/*
 * ⛔ KÄLLTRÄDET GÅR ATT PEKA OM, av samma skäl som i de andra vakterna: en
 * vakt som bara kan köras mot ett träd som råkar vara grönt går inte att se
 * falla. `test-guards` pekar den mot en kopia med ett planterat `groupIds`.
 *
 * ⛔ OCH REGELTEXTEN IMPORTERAS UR SAMMA TRÄD. Läste vakten fältlistorna ur
 * kopian men reglerna ur originalet vore halva mätningen alltid grön, oavsett
 * vad som planterades.
 */
const kalltrad = process.argv[2] ? path.resolve(process.argv[2]) : path.join(rot, "src");
const libmapp = path.join(kalltrad, "lib");

if (!fs.existsSync(libmapp)) {
  console.error(`check-gruppnyckel: hittar inte ${libmapp}. Fel sökväg i vakten, inte ett godkänt utfall.`);
  process.exit(1);
}

const { gruppadSamling, regelfragment } = await import(pathToFileURL(path.join(libmapp, "regler.js")).href);

/** Den enda tillåtna gruppnyckeln. */
const ENDA = "groupId";

/** Ett fältnamn som rör grupper men inte är `groupId`. */
const RORGRUPP = /grupp|group/i;

/** @type {string[]} */
const brott = [];

// ── 1. Fältlistorna i samlingarna ramverket äger ───────────────────────────
//
// ⛔ LISTORNA LÄSES UR KÄLLAN OCH IMPORTERAS INTE. En import hade gett vakten
// de värden modulen råkar exportera, medan felet vi letar efter är ett fält
// någon SKREV. Att läsa texten fångar också en lista som glömts exporteras.
const libfiler = fs
  .readdirSync(libmapp)
  .filter((f) => f.endsWith(".js"))
  .map((f) => path.join(libmapp, f));

/** @type {{ lista: string, falt: string[], fil: string }[]} */
const listor = [];
for (const fil of libfiler) {
  const kalla = fs.readFileSync(fil, "utf8");
  for (const m of kalla.matchAll(/(?:export\s+)?const\s+([A-Z][A-Z0-9_]*FALT)\s*=\s*\[([^\]]*)\]/g)) {
    const falt = [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    listor.push({ lista: m[1], falt, fil: path.relative(rot, fil) });
  }
}

// ⛔ GOLV. En vakt som blir grön av att ingenting lästes är det arbetsreglerna
// kallar tomt underlag. Fyra listor är de fyra samlingarna i #136.
if (listor.length < 4) {
  console.error(`check-gruppnyckel: bara ${listor.length} fältlistor lästes ur ${libmapp}. Fel mönster, eller en samling som saknar sin lista.`);
  process.exit(1);
}

for (const { lista, falt, fil } of listor) {
  for (const namn of falt) {
    if (!RORGRUPP.test(namn)) continue;
    if (namn === ENDA) continue;
    brott.push(
      `${fil}: ${lista} bär fältet "${namn}". En rad får peka på EXAKT en grupp, och nyckeln heter ${ENDA}. Ett fält som pekar på flera är delning inbakad i datamodellen, och det går inte att ta bort sedan.`,
    );
  }
}

// ── 2. Regeltexten ─────────────────────────────────────────────────────────
//
// ⛔ OCH REGLERNA, INTE BARA FORMEN. En rad kan bära ett enda `groupId` medan
// regeln ändå frågar "är du med i NÅGON av de här", och då är hålet lika stort.
// `array-contains` och `in` över en grupplista är hur det skulle se ut.
const regeltexter = [regelfragment(), gruppadSamling("provsamling"), gruppadSamling("provkonfig", { agareKravsForSkrivning: true })];
const FORBJUDET = [
  ["array-contains", "en fråga mot en lista grupper på raden"],
  ["groupIds", "en gruppnyckel i plural"],
  ["invitedGroupIds", "SessionStudios delningsfält"],
];

for (const text of regeltexter) {
  for (const [nal, vad] of FORBJUDET) {
    if (text.includes(nal)) {
      brott.push(`regelfragmentet innehåller "${nal}", alltså ${vad}. Regeln ska vara ETT uppslag mot memberships, inget OR.`);
    }
  }
}

// ⛔ OCH ATT DET FAKTISKT ÄR ETT UPPSLAG. Utan den här kontrollen är vakten
// nöjd med en regel som släpper igenom allt, eftersom den bara letar efter det
// som INTE får stå. Ett golv för närvaro, inte bara för frånvaro.
if (!regelfragment().includes("opsArMedlem") || !regelfragment().includes("exists(")) {
  brott.push("regelfragmentet saknar opsArMedlem eller exists(). Då mäter resten av vakten ingenting.");
}

if (brott.length === 0) {
  const falt = listor.reduce((n, l) => n + l.falt.length, 0);
  console.log(`check-gruppnyckel: ${listor.length} fältlistor och ${falt} fält, plus ${regeltexter.length} regeltexter. Exakt en gruppnyckel, och den heter ${ENDA}.`);
  process.exit(0);
}

console.error(`check-gruppnyckel: ${brott.length} brott mot en gruppnyckel per rad\n`);
for (const b of brott) console.error(`  ${b}`);
process.exit(1);
