#!/usr/bin/env node
/**
 * Vakt för tokenkontraktet.
 *
 * ⛔ Varje regel här finns för att den brutits, och två av dem bröts under
 * den timme filen skrevs. Det är inte en pedagogisk poäng, det är skälet.
 *
 * Kör: node tokens/check-tokens.mjs [sökväg till tokens.css]
 * Exit 0 = grönt. Exit 1 = brott, med rad och skäl.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const file = process.argv[2] || path.join(process.cwd(), "tokens", "tokens.css");
const css = fs.readFileSync(file, "utf8");

/** @type {{ rule: string, detail: string }[]} */
const brott = [];

/** Namn som beskriver hur något SER UT i stället för vad det BETYDER. */
const FARGORD = [
  "gold", "guld", "silver", "red", "green", "blue", "yellow", "orange",
  "purple", "pink", "brown", "grey", "gray", "teal", "cyan", "magenta",
  "rod", "gron", "bla", "gul",
];

const deklarationer = [...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/gm)].map((m) => ({
  namn: m[1],
  varde: m[2].trim(),
  rad: css.slice(0, m.index).split("\n").length,
}));

// ── Regel 1: namnge efter roll, aldrig efter färg ────────────────────────────
// Skälet är mätt: SessionStudio har 148 tokens som heter `--color-gold-*` och
// som är satta till varm grädde, samtidigt som repots toppregel säger att guld
// är permanent borttaget. Namnen ljuger, och nästa läsare tror att guld lever.
for (const d of deklarationer) {
  const ord = d.namn.split("-").filter(Boolean);
  const traff = ord.find((o) => FARGORD.includes(o));
  if (traff) {
    brott.push({
      rule: "1. roll, inte färg",
      detail: `${file}:${d.rad} ${d.namn} bär färgordet "${traff}". Namnge efter vad den betyder (accent, state-error, bg-sunken), inte efter hur den ser ut. Byter du färg annars ljuger namnet.`,
    });
  }
}

// ── Regel 2: ingen fallback i var() ─────────────────────────────────────────
// En fallback gör ett saknat token osynligt: sidan ser rimlig ut och ingen får
// veta att kontraktet inte följdes. Tomhet ska vara ett svar, inte tystnad.
for (const m of css.matchAll(/var\(\s*(--[a-z0-9-]+)\s*,/g)) {
  const rad = css.slice(0, m.index).split("\n").length;
  brott.push({
    rule: "2. ingen fallback i var()",
    detail: `${file}:${rad} var(${m[1]}, ...) har en fallback. Saknas token ska det synas, inte täckas över.`,
  });
}

// ── Regel 3: de två mörka blocken måste vara identiska ──────────────────────
// ⛔ Den här vakten skrevs för att författaren bröt regeln i samma fil: de två
// blocken fick olika värde på --color-state-error-bg. Två handskrivna original
// glider isär, alltid, och ett mörkt läge som skiljer sig beroende på HUR du
// valde det är nästan omöjligt att felsöka.
const media = css.match(/:root:not\(\[data-theme="light"\]\)\s*\{([\s\S]*?)\n {2}\}/);
const attr = css.match(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/);
if (!media || !attr) {
  brott.push({
    rule: "3. mörka block",
    detail: "Hittade inte båda mörka blocken. Kontraktet kräver ett media-block och ett data-theme-block.",
  });
} else {
  const plocka = (b) => Object.fromEntries(
    [...b.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
  );
  const a = plocka(media[1]);
  const b = plocka(attr[1]);
  for (const nyckel of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (a[nyckel] !== b[nyckel]) {
      brott.push({
        rule: "3. mörka block",
        detail: `${nyckel} skiljer sig: media="${a[nyckel] ?? "saknas"}" mot data-theme="${b[nyckel] ?? "saknas"}".`,
      });
    }
  }
}

// ── Regel 4: golv, så vakten inte kan bli grön på tomhet ────────────────────
// En vakt som blir grön av att ingenting lästes är den vanligaste falska
// grönheten vi har haft. Den ska säga ifrån, inte tiga.
if (deklarationer.length < 40) {
  brott.push({
    rule: "golv",
    detail: `Bara ${deklarationer.length} tokens lästes ur ${file}. Kontraktet har fler än så, alltså lästes fel fil eller en trasig.`,
  });
}

if (brott.length === 0) {
  console.log(`check-tokens: ${deklarationer.length} tokens, alla regler gröna (${file})`);
  process.exit(0);
}

console.error(`check-tokens: ${brott.length} brott mot tokenkontraktet\n`);
for (const b of brott) console.error(`  [${b.rule}] ${b.detail}`);
process.exit(1);
