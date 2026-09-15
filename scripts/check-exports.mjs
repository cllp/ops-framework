#!/usr/bin/env node
/**
 * Vakt: ramverkets publika yta stämmer med vad modulerna faktiskt exporterar.
 *
 * ⛔ Den här vakten skrevs efter ett fel under samma arbetspass, och felet är
 * lärorikare än regeln.
 *
 * Jag döpte om en exporterad konstant i `src/index.js` men ändringen av
 * `src/lib/format.js` matchade aldrig, så källfilen exporterade fortfarande det
 * gamla namnet. Resultatet blev **inte** ett fel. Importen gav `undefined`,
 * `.replace(undefined, "")` letade efter strängen "undefined", hittade inget,
 * och två tester föll på ett sätt som pekade mot formateringen i stället för
 * mot orsaken. Jag letade på fel ställe i flera steg.
 *
 * Så ser en tyst yta-drift ut: inget kastar, inget loggar, och felet dyker upp
 * långt ifrån sin orsak. En konsumentapp hade fått exakt samma sak, fast i
 * produktion.
 *
 * Vakten importerar den BYGGDA bundlen, alltså det konsumenten faktiskt får,
 * och kräver att varje namn i `src/index.js` finns där och inte är undefined.
 *
 * Kör: node scripts/check-exports.mjs
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexfil = path.join(rot, "src", "index.js");
const dist = path.join(rot, "dist", "index.js");

if (!fs.existsSync(dist)) {
  console.error("check-exports: dist/index.js saknas. Kör `npm run build` först.");
  process.exit(1);
}

const kalla = fs.readFileSync(indexfil, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** @type {{ namn: string, fran: string }[]} */
const utlovade = [];
for (const m of kalla.matchAll(/export\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
  for (const del of m[1].split(",")) {
    const namn = del.trim().split(/\s+as\s+/).pop()?.trim();
    if (namn) utlovade.push({ namn, fran: m[2] });
  }
}

// ⛔ Aven direktdeklarerade exporter. Forsta versionen last bara `export { ... }`,
// och ett `export const X` i index.js hade darfor varit osynligt for vakten.
// Mutationsharnesset hittade det direkt, vilket ar precis dess uppgift.
for (const m of kalla.matchAll(/export\s+(?:const|let|var|function|class)\s+([A-Za-z0-9_$]+)/g)) {
  utlovade.push({ namn: m[1], fran: "src/index.js" });
}


/** @type {string[]} */
const brott = [];

// ── Golv: en vakt som läste noll exporter säger ingenting ───────────────────
if (utlovade.length < 15) {
  console.error(`check-exports: bara ${utlovade.length} exporter lästes ur src/index.js. Fel fil, eller en trasig.`);
  process.exit(1);
}

const bundle = await import(`file://${dist}?t=${Date.now()}`);

for (const { namn, fran } of utlovade) {
  if (!(namn in bundle)) {
    brott.push(`${namn} utlovas i src/index.js (från ${fran}) men finns inte i den byggda bundlen. Konsumenten får ett importfel eller, värre, undefined.`);
    continue;
  }
  if (bundle[namn] === undefined) {
    brott.push(
      `${namn} finns som namn men är undefined. Det är det tysta fallet: ingenting kastar, och felet dyker upp långt från sin orsak. Nästan alltid en omdöpt export i ${fran} som index.js inte följde med på.`,
    );
  }
}

// ── Åt andra hållet: allt som exporteras ska vara avsiktligt publikt ────────
// ⛔ `cx` får ALDRIG läcka ut. Finns den tillgänglig är nästa steg att en app
// sätter ihop sin egen knapp av våra klasser, och då är det stängda API:et
// öppet igen fast via en omväg som ingen granskning fångar.
const FORBJUDNA = ["cx"];
for (const namn of FORBJUDNA) {
  if (namn in bundle) {
    brott.push(`${namn} är exporterad ur bundlen. Den är ramverksintern, och exporterad blir den vägen runt det stängda API:et.`);
  }
}

const antalIBundle = Object.keys(bundle).filter((k) => k !== "default").length;
if (antalIBundle !== utlovade.length) {
  brott.push(
    `Bundlen exporterar ${antalIBundle} namn, men src/index.js utlovar ${utlovade.length}. Ytan och listan har glidit isär, och listan är den som läses av människor.`,
  );
}

if (brott.length === 0) {
  console.log(`check-exports: ${utlovade.length} exporter, alla finns i bundlen och inget internt läcker`);
  process.exit(0);
}

console.error(`check-exports: ${brott.length} brott\n`);
for (const b of brott) console.error(`  ${b}`);
process.exit(1);
