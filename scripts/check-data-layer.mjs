#!/usr/bin/env node
/**
 * Vakt: databasen når aldrig längre in än till en adapter.
 *
 * ⛔ DET HÄR ÄR DEN REGEL SOM AVGÖR OM DATALAGRET ÄR VÄRT NÅGOT.
 *
 * Alla bygger ett datalager. Nästan alla får det förstört på samma sätt, och
 * inte genom ett stort beslut: en enda vy anropar något källspecifikt "bara den
 * här gången", för att det går fortare just då. Ingen märker det. Ett år senare
 * går källan inte att byta, och ingen kan säga när det slutade gå.
 *
 * Det är exakt samma mekanik som `className` på en primitiv, och den behöver
 * samma medicin: en vakt, inte en överenskommelse.
 *
 * Tre regler:
 *
 *   1. En databas-SDK importeras bara i en fil under `adapters/` eller `data/`.
 *   2. Ingen vy gör nätverksanrop på egen hand. `fetch` hör hemma i en adapter.
 *   3. Vakten har ett golv: läser den noll filer är det fel sökväg.
 *
 * Kör:  node .../check-data-layer.mjs <katalog> [...]
 * Exit: 0 grönt, 1 brott med fil, rad och skäl.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const rotter = process.argv.slice(2);
if (rotter.length === 0) {
  console.error("check-data-layer: ange minst en katalog att granska");
  process.exit(1);
}

/**
 * Paket som binder koden till en viss datakälla.
 *
 * Listan är avsiktligt bred. Hellre en falsk träff som flyttar en import till
 * rätt ställe än ett SDK som slinker in i en vy.
 */
const SDK = [
  "firebase",
  "firebase-admin",
  "@firebase/",
  "@google-cloud/",
  "pg",
  "postgres",
  "mysql",
  "mysql2",
  "sqlite",
  "better-sqlite3",
  "mongodb",
  "mongoose",
  "prisma",
  "@prisma/client",
  "drizzle-orm",
  "@supabase/",
  "dynamodb",
  "@aws-sdk/client-dynamodb",
];

/** Kataloger där en SDK får förekomma. */
const TILLATNA = ["adapters", "adaptrar", "data", "datakallor"];

/** @param {string} dir @returns {string[]} */
function filer(dir) {
  /** @type {string[]} */
  const ut = [];
  if (!fs.existsSync(dir)) return ut;
  if (fs.statSync(dir).isFile()) return /\.(jsx?|tsx?)$/.test(dir) ? [dir] : [];
  for (const post of fs.readdirSync(dir, { withFileTypes: true })) {
    if (post.name === "node_modules" || post.name === "dist" || post.name.startsWith(".")) continue;
    const full = path.join(dir, post.name);
    if (post.isDirectory()) ut.push(...filer(full));
    else if (/\.(jsx?|tsx?)$/.test(post.name)) ut.push(full);
  }
  return ut;
}

const utanKommentarer = (/** @type {string} */ text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => "\n".repeat((m.match(/\n/g) || []).length))
    .replace(/(^|[^:])\/\/[^\n]*/g, (_m, p1) => p1);

/** @type {{ fil: string, rad: number, skal: string }[]} */
const brott = [];
let filerLasta = 0;

for (const rot of rotter) {
  for (const fil of filer(rot)) {
    const text = utanKommentarer(fs.readFileSync(fil, "utf8"));
    filerLasta += 1;
    const delar = fil.split(path.sep);
    const iAdapter = delar.some((d) => TILLATNA.includes(d));
    const radAv = (/** @type {number} */ i) => text.slice(0, i).split("\n").length;

    for (const m of text.matchAll(/(?:from|require\s*\(|import\s*\()\s*["']([^"']+)["']/g)) {
      const paket = m[1];
      if (!SDK.some((s) => paket === s || paket.startsWith(s))) continue;
      if (iAdapter) continue;
      brott.push({
        fil,
        rad: radAv(m.index),
        skal: `"${paket}" importeras utanför en adapter. Då är datakällan inbakad i vyn, och den låsningen syns inte förrän någon vill byta källa. Lägg anropet i en adapter bakom datakontraktet.`,
      });
    }

    if (!iAdapter) {
      for (const m of text.matchAll(/\bfetch\s*\(/g)) {
        brott.push({
          fil,
          rad: radAv(m.index),
          skal: "fetch utanför en adapter. Ett nätverksanrop i en vy går förbi datalagret, saknar felhantering och går inte att byta ut i test.",
        });
      }
    }
  }
}

if (filerLasta === 0) {
  console.error(`check-data-layer: noll filer lästa ur ${rotter.join(", ")}. Fel sökväg, inte ett godkänt utfall.`);
  process.exit(1);
}

if (brott.length === 0) {
  console.log(`check-data-layer: ${filerLasta} filer, datakällan når inte längre in än adaptern`);
  process.exit(0);
}

console.error(`check-data-layer: ${brott.length} brott\n`);
for (const b of brott) console.error(`  ${b.fil}:${b.rad}\n      ${b.skal}`);
process.exit(1);
