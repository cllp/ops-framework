#!/usr/bin/env node
/**
 * Mät en apps byggda `dist` i en riktig webbläsare vid telefonbredd och
 * surfplattebredd.
 *
 * ⛔ Den här finns för att mätningen annars bara nådde mallappen.
 *
 * `check-scaffold` har mätt layout sedan v0.3.0, men på appen som
 * `create-ops-app` producerar: två rutter och nästan inget innehåll. UX-auditen
 * av bolag-ops listade horisontell scroll på flera av **appens** sidor, alltså
 * fanns mätningen precis där problemet inte var.
 *
 * ⛔ Skriver varje app sin egen mätning får vi tre olika definitioner av "ingen
 * horisontell scroll", och minst två av dem kommer ha samma hål: att räkna en
 * tabell som medvetet scrollar i sidled som ett brott, bli röd varje dag, och
 * stängas av inom en månad. Den avvägningen är redan gjord en gång, och ska
 * inte göras om per app.
 *
 * Rutterna är appens beslut. Ramverket vet aldrig vilka sidor en plattform har.
 *
 * Kör:
 *   npx ops-viewport dist
 *   npx ops-viewport dist --rutter /,/kostnader,/tillgangar
 *
 * Exit: 0 grönt, 1 brott med bredd, rutt och det element som sticker ut.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { matVyport } from "./lib/matVyport.mjs";

const argv = process.argv.slice(2);

if (argv.includes("--help") || argv.includes("-h")) {
  console.log(
    [
      "ops-viewport <dist-mapp> [--rutter /,/en-sida,/en-till]",
      "",
      "  Mäter tre saker vid 390, 768 och 1280 px, på varje rutt:",
      "    1. sidan är inte bredare än fönstret",
      "    2. exakt en navigering syns per bredd",
      "    3. main har botteninset minst lika stort som bottenraden",
      "",
      "  OPS_CHROMIUM pekar ut en egen Chromium om playwrights egen inte finns.",
    ].join("\n"),
  );
  process.exit(0);
}

const distArg = argv.find((a) => !a.startsWith("--"));
if (!distArg) {
  console.error("ops-viewport: ange mappen med den byggda appen, t.ex. `npx ops-viewport dist`.");
  process.exit(1);
}
const dist = path.resolve(distArg);

// ⛔ Golv. En mätning mot en mapp som inte finns, eller mot en utan index.html,
// skulle annars kunna se ut som noll brott. Ett tomt underlag är inte ett
// godkänt utfall, det är en vakt som tittade på fel ställe.
if (!fs.existsSync(dist) || !fs.statSync(dist).isDirectory()) {
  console.error(`ops-viewport: ${dist} finns inte eller är ingen mapp. Bygg appen först.`);
  process.exit(1);
}
if (!fs.existsSync(path.join(dist, "index.html"))) {
  console.error(`ops-viewport: ${dist} saknar index.html. Det är nästan säkert fel mapp, och en mätning mot fel mapp ger falskt grönt.`);
  process.exit(1);
}

const rutter = lasRutter(argv);

/**
 * Tar både `--rutter=/,/a` och `--rutter /,/a`, eftersom båda formerna skrivs
 * i verkligheten och den som skriver fel form ska få rätt svar, inte tyst bara
 * mäta startsidan.
 * @param {string[]} argv @returns {string[]}
 */
function lasRutter(argv) {
  const i = argv.findIndex((a) => a === "--rutter" || a.startsWith("--rutter="));
  if (i === -1) return ["/"];
  const rad = argv[i].includes("=") ? argv[i].slice(argv[i].indexOf("=") + 1) : argv[i + 1];
  const lista = (rad ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
  if (lista.length === 0) {
    console.error("ops-viewport: --rutter angavs utan värden. Skriv t.ex. --rutter /,/kostnader.");
    process.exit(1);
  }
  return lista;
}

console.log(`ops-viewport: ${dist}`);
console.log(`  rutter: ${rutter.join(", ")}`);

let resultat;
try {
  resultat = await matVyport({ dist, rutter });
} catch (e) {
  console.error(`\nops-viewport: mätningen kunde inte köras.\n\n  ${/** @type {Error} */ (e).message}\n`);
  process.exit(1);
}

if (resultat.brott.length > 0) {
  console.error(`\nops-viewport: ${resultat.brott.length} brott\n`);
  for (const b of resultat.brott) console.error(`  ${b}`);
  process.exit(1);
}

console.log(`\nops-viewport: ${resultat.matningar} mätningar, inga brott (${resultat.varifran})`);
