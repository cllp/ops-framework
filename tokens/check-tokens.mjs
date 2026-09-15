#!/usr/bin/env node
/**
 * Vakt för tokenkontraktet.
 *
 * ⛔ Varje regel här finns för att den brutits, och två av dem bröts under den
 * timme filen först skrevs. Det är inte en pedagogisk poäng, det är skälet.
 *
 * Kör:  node tokens/check-tokens.mjs [sökväg till tokens.css]
 * Exit: 0 grönt, 1 brott med rad och skäl.
 *
 * ⛔ Prova att göra vakten röd innan du litar på den. En vakt ingen sett faila
 * är en förhoppning. `npm run test:guards` gör precis det: bryter varje regel
 * i en kopia och kräver rött.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const file = process.argv[2] || path.join(process.cwd(), "tokens", "tokens.css");
if (!fs.existsSync(file)) {
  console.error(`check-tokens: hittar inte ${file}. Fel sökväg, inte ett godkänt utfall.`);
  process.exit(1);
}
const kalla = fs.readFileSync(file, "utf8");

/**
 * Kommentarer tas bort innan reglerna körs, men radbrytningarna behålls så att
 * radnumren fortfarande stämmer mot filen på disk.
 *
 * ⛔ Första versionen saknade det här steget och flaggade sin egen varningstext
 * ("ALDRIG @theme inline") som ett brott. En vakt med falska positiva blir
 * avstängd, och då spelar det ingen roll hur rätt den hade i sak.
 */
const css = kalla.replace(/\/\*[\s\S]*?\*\//g, (m) => "\n".repeat((m.match(/\n/g) || []).length));

/** @type {{ rule: string, detail: string }[]} */
const brott = [];
const radAv = (index) => css.slice(0, index).split("\n").length;

/** Namn som beskriver hur något SER UT i stället för vad det BETYDER. */
const FARGORD = [
  "gold", "guld", "silver", "red", "green", "blue", "yellow", "orange",
  "purple", "pink", "brown", "grey", "gray", "teal", "cyan", "magenta",
  "beige", "rod", "gron", "bla", "gul",
];

/**
 * Plockar ut kroppen av ett block genom att räkna klamrar, inte genom regex.
 * Regex över nästlade block är hur man får en vakt som tyst läser fel halva.
 * @param {string} text @param {string} oppning
 * @returns {{ body: string, start: number } | null}
 */
function block(text, oppning) {
  const i = text.indexOf(oppning);
  if (i === -1) return null;
  let djup = 0;
  for (let j = i + oppning.length - 1; j < text.length; j += 1) {
    if (text[j] === "{") djup += 1;
    else if (text[j] === "}") {
      djup -= 1;
      if (djup === 0) return { body: text.slice(i + oppning.length, j), start: i };
    }
  }
  return null;
}

/** @param {string} body @returns {Record<string, string>} */
const deklarationerI = (body) =>
  Object.fromEntries(
    [...body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
  );

const alla = [...css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => ({
  namn: m[1],
  varde: m[2].trim(),
  rad: radAv(m.index),
}));

// ── Regel 1: namnge efter roll, aldrig efter färg ────────────────────────────
// Skälet är mätt: SessionStudio har 148 tokens som heter `--color-gold-*` och
// som är satta till varm grädde, samtidigt som repots toppregel säger att guld
// är permanent borttaget. Namnen ljuger, och nästa läsare tror att guld lever.
for (const d of alla) {
  const traff = d.namn.split("-").filter(Boolean).find((o) => FARGORD.includes(o));
  if (traff) {
    brott.push({
      rule: "1. roll, inte färg",
      detail: `${file}:${d.rad} ${d.namn} bär färgordet "${traff}". Namnge efter vad den betyder (accent, danger, sunken), inte efter hur den ser ut. Byter du färg annars ljuger namnet.`,
    });
  }
}

// ── Regel 2: ingen fallback i var() ──────────────────────────────────────────
// En fallback gör ett saknat token osynligt: sidan ser rimlig ut och ingen får
// veta att kontraktet inte följdes. Tomhet ska vara ett svar, inte tystnad.
for (const m of css.matchAll(/var\(\s*(--[a-z0-9-]+)\s*,/g)) {
  brott.push({
    rule: "2. ingen fallback i var()",
    detail: `${file}:${radAv(m.index)} var(${m[1]}, ...) har en fallback. Saknas ett token ska det synas, inte täckas över.`,
  });
}

// ── Regel 5 (körs tidigt, den gör alla andra meningslösa) ────────────────────
// `@theme inline` bakar in värdet i varje utility i stället för att gå via
// variabeln. Allt ser rätt ut tills någon växlar till mörkt läge, och då är
// felet stumt: inga röda vakter, ingen konsolrad, bara fel färger.
if (/@theme\s+[^{]*\binline\b/.test(css)) {
  brott.push({
    rule: "5. inte @theme inline",
    detail: `${file} använder "@theme inline". Då går utilities inte via variabeln, och mörkt läge slutar fungera utan att något blir rött. Använd "@theme static".`,
  });
}

const tema = block(css, "@theme static {");
if (!tema) {
  brott.push({
    rule: "struktur",
    detail: `${file} saknar "@theme static { ... }". Utan static skrivs bara de variabler ut som råkar användas av en utility, och mörkerblocken skriver då över något som inte finns.`,
  });
}

// ── Regel 3: mörkerblocken är rena omdirigeringar, inte andra original ──────
// ⛔ Den här vakten skrevs för att författaren bröt regeln i samma fil: de två
// blocken fick olika värde på samma token. Nu deklareras mörkerpaletten en
// gång som `--dark-*`, och blocken nedanför får bara peka. Ett råvärde i ett
// aliasblock är början på det andra originalet.
const media = block(css, ':root:not([data-theme="light"]) {');
const attr = block(css, ':root[data-theme="dark"] {');

if (!media || !attr) {
  brott.push({
    rule: "3. mörkerblock",
    detail: "Hittade inte båda mörkerblocken. Kontraktet kräver ett media-block och ett data-theme-block, annars vinner inte ett uttryckligt val i båda riktningarna.",
  });
} else {
  const a = deklarationerI(media.body);
  const b = deklarationerI(attr.body);

  for (const nyckel of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (a[nyckel] !== b[nyckel]) {
      brott.push({
        rule: "3. mörkerblock",
        detail: `${nyckel} skiljer sig mellan blocken: media="${a[nyckel] ?? "saknas"}" mot data-theme="${b[nyckel] ?? "saknas"}". Ett uttryckligt mörkt val skulle då se annorlunda ut än systemets, vilket är nästan omöjligt att felsöka.`,
      });
    }
  }

  for (const [namn, varde] of [...Object.entries(a), ...Object.entries(b)]) {
    if (!/^var\(--dark-[a-z0-9-]+\)$/.test(varde)) {
      brott.push({
        rule: "3. mörkerblock",
        detail: `${file} aliasblocket sätter ${namn}: ${varde}. Mörkerpaletten deklareras EN gång som --dark-*, blocken får bara peka. Ett råvärde här är början på det andra originalet som glider isär.`,
      });
    }
  }

  // ── Regel 6: inga föräldralösa i någon riktning ───────────────────────────
  // En `--dark-*` som ingen alias pekar på är en färg som aldrig syns, och en
  // alias mot en odeklarerad `--dark-*` ger tom sträng, alltså ärvd färg. Båda
  // är tysta, och båda upptäcks annars först av någon som tittar i mörkt läge.
  const darkDeklarerade = new Set(alla.filter((d) => d.namn.startsWith("--dark-")).map((d) => d.namn));
  const darkAnvanda = new Set(
    [...Object.values(a), ...Object.values(b)]
      .map((v) => v.match(/^var\((--dark-[a-z0-9-]+)\)$/)?.[1])
      .filter(Boolean),
  );

  for (const namn of darkAnvanda) {
    if (!darkDeklarerade.has(namn)) {
      brott.push({
        rule: "6. föräldralös",
        detail: `Aliasblocket pekar på ${namn} som aldrig deklareras. var() mot ett saknat token ger tom sträng, alltså ärvd färg, utan ett enda felmeddelande.`,
      });
    }
  }
  for (const namn of darkDeklarerade) {
    if (!darkAnvanda.has(namn)) {
      brott.push({
        rule: "6. föräldralös",
        detail: `${namn} deklareras men ingen alias pekar på den. Antingen glömdes raden i mörkerblocken, eller så är tokenet dött. Båda ska åtgärdas, inte lämnas.`,
      });
    }
  }

  // ── Regel 7: mörkret får bara skriva över något som finns i temat ─────────
  if (tema) {
    const temaNamn = new Set(Object.keys(deklarationerI(tema.body)));
    for (const namn of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!temaNamn.has(namn)) {
        brott.push({
          rule: "7. skriver över tomhet",
          detail: `Mörkerblocken sätter ${namn}, men den finns inte i @theme. Ljust läge saknar då sitt grundvärde och Tailwind genererar ingen utility för den.`,
        });
      }
    }
  }
}

// ── Regel 4: golv, så vakten inte kan bli grön på tomhet ────────────────────
// En vakt som blir grön av att ingenting lästes är den vanligaste falska
// grönheten vi haft. Den ska säga ifrån, inte tiga.
const GOLV = 60;
if (alla.length < GOLV) {
  brott.push({
    rule: "4. golv",
    detail: `Bara ${alla.length} tokens lästes ur ${file}, kontraktet har fler än ${GOLV}. Alltså lästes fel fil, eller en trasig.`,
  });
}

if (brott.length === 0) {
  console.log(`check-tokens: ${alla.length} tokens, alla sju regler gröna (${file})`);
  process.exit(0);
}

console.error(`check-tokens: ${brott.length} brott mot tokenkontraktet\n`);
for (const b of brott) console.error(`  [${b.rule}] ${b.detail}`);
process.exit(1);
