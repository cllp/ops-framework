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
import { pathToFileURL } from "node:url";

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

// ── Regel 8+9, ersatta av #167: ett genererat block, inte en handskriven lista ──
// #157/#164 skrev in SessionStudios palett och rundningsskala som två listor
// HÄR, i vakten själv. Det höll rent tekniskt (vakten blev röd om en av
// filerna glömdes), men det var ändå ett andra original: samma tal stod en
// gång i `tokens.css` och en gång i den här filens `SESSIONSTUDIO_LJUST`
// /`_MORKT`/`_RUNDNING`-objekt, och en agent som bytte det ena utan att veta
// om det andra fick ett kryptiskt diff-fel i stället för en tydlig fixtur att
// ändra.
//
// #167 gör SessionStudios utseende till EN fixtur,
// `tokens/sessionstudio-profil.json`, och `scripts/generate-tokens.mjs`
// skriver ur den in i de markerade blocken i `tokens.css`. Regel 8/9 blir då
// EN regel: är det som faktiskt står mellan markörerna BYTE FÖR BYTE det
// generatorn skulle skrivit just nu? Är det inte det, har någon antingen
// redigerat det genererade blocket för hand (förbjudet, se filhuvudet i
// `tokens.css`) eller ändrat fixturen utan att köra om generatorn.
//
// ⛔ INGEN NY LISTA MED FÖRVÄNTADE VÄRDEN HÄR. Just det var problemet: en lista
// i vakten är sin egen lilla kopia. Genom att importera generatorns EGNA
// funktion och köra den mot fixturen just nu, finns bara ETT ställe som vet
// vad SessionStudios tal är.
//
// ⛔ "npm run check" NORMALISERAR FÖRST. `npm run build` (som `check` kör
// innan den här vakten) har `prebuild: ... && npm run generate:tokens`, precis
// som versionskonstanten. Är fixturen och tokens.css redan i takt gör det
// ingenting; har någon redigerat det genererade blocket för hand skrivs det
// tyst tillbaka INNAN den här vakten hinner se det, och `git status`/`git
// diff` efter bygget visar rättningen. Vakten biter alltså skarpast när den
// körs FRISTÅENDE (`node tokens/check-tokens.mjs`, t.ex. i en snabb
// pre-commit-hook utan fullt bygge), precis som `check-kanon.mjs` i bolag-ops.
const generatorVag = path.join(path.dirname(file), "..", "scripts", "generate-tokens.mjs");
if (fs.existsSync(generatorVag)) {
  try {
    const { generera, skrivMellanMarkorer, MARKORER } = await import(pathToFileURL(generatorVag).href);
    const { block } = generera();
    let forvantat = kalla;
    for (const namn of /** @type {const} */ (["theme", "dark", "ikonlager"])) {
      forvantat = skrivMellanMarkorer(forvantat, MARKORER[namn], block[namn]);
    }
    if (forvantat !== kalla) {
      brott.push({
        rule: "8/9. genererat block matchar inte fixturen",
        detail: `${file} skiljer sig från vad scripts/generate-tokens.mjs skulle skriva ur tokens/sessionstudio-profil.json just nu. Antingen är det genererade blocket redigerat för hand (förbjudet), eller så har fixturen ändrats utan att "node scripts/generate-tokens.mjs" körts om. Kör den och committa resultatet.`,
      });
    }
  } catch (e) {
    brott.push({
      rule: "8/9. genererat block matchar inte fixturen",
      detail: `Kunde inte köra generatorn för att jämföra: ${e instanceof Error ? e.message : String(e)}`,
    });
  }
} else {
  brott.push({
    rule: "8/9. genererat block matchar inte fixturen",
    detail: `Hittar inte ${generatorVag}. Utan generatorn går det inte att veta om det genererade blocket i ${file} fortfarande stämmer med fixturen.`,
  });
}

// ── Regel 11: fixturens golv ─────────────────────────────────────────────────
// Samma skäl som Regel 4 nedan: ett prov som blir grönt av en tom eller
// halvskriven fixtur mäter ingenting. Minsta antal nycklar per grupp, satt
// till vad #167 faktiskt levererade, inte till noll.
const fixturVag2 = path.join(path.dirname(file), "sessionstudio-profil.json");
if (fs.existsSync(fixturVag2)) {
  const fixtur = JSON.parse(fs.readFileSync(fixturVag2, "utf8"));
  const GOLV_PER_GRUPP = {
    "farger.ljus": 12,
    "farger.mork": 12,
    "radier": 5,
    "diagram.presets": 8,
    "diagram.chart.ljus": 6,
    "diagram.chart.mork": 6,
  };
  for (const [sokvag, minst] of Object.entries(GOLV_PER_GRUPP)) {
    const varde = sokvag.split(".").reduce((v, k) => v?.[k], fixtur);
    const antal = Array.isArray(varde) ? varde.length : Object.keys(varde ?? {}).length;
    if (antal < minst) {
      brott.push({
        rule: "11. fixturens golv",
        detail: `tokens/sessionstudio-profil.json: gruppen "${sokvag}" har ${antal} poster, golvet är ${minst}. Antingen lästes fel fil, eller så har någon tömt fixturen.`,
      });
    }
  }
} else {
  brott.push({
    rule: "11. fixturens golv",
    detail: `Hittar inte ${fixturVag2}. Utan fixturen kan det genererade blocket inte kontrolleras alls.`,
  });
}

// ── Regel 10: ett radie-literal som matchar ett token är ett andra original ─
// ops-framework#164 (arkitekturgranskningen): fyra `border-radius: 9999px`
// stod handskrivna i `.ops-reglage`-pseudoelementen, trots att `--radius-full`
// redan var 999px, exakt samma tal i sak. Ett literal utanför `@theme static`
// som råkar träffa ett redan deklarerat tokenvärde är Regel 2 i sin renaste
// form ("en sanning per faktum"): ändras skalan i `@theme static` glider
// literalet isär utan att något blir rött, för det är inte en referens.
//
// ⛔ Läser bara UTANFÖR `@theme static`-blocket, tokendeklarationerna SJÄLVA
// får förstås sätta sina egna pixeltal. Läser bara `border-radius`, inte
// `border-top-left-radius` med flera: den formen används inte i den här
// filen, och att gissa dess mönster hade varit att bygga en regel mot ett
// fynd som inte finns.
if (tema) {
  const temaVarden = deklarationerI(tema.body);
  const RADIE_VARDEN = new Set();
  for (const [namn, varde] of Object.entries(temaVarden)) {
    if (namn.startsWith("--radius-")) RADIE_VARDEN.add(varde);
  }
  // Blockets kropp börjar direkt efter öppningsparentesen och slutar där den
  // egna stängningsparentesen står, `tema.start` pekar på "@theme".
  const temaSlut = tema.start + "@theme static {".length + tema.body.length + 1;
  for (const m of css.matchAll(/border-radius\s*:\s*([^;]+);/g)) {
    if (m.index >= tema.start && m.index < temaSlut) continue; // tokendeklarationen själv
    const varde = m[1].trim();
    if (RADIE_VARDEN.has(varde)) {
      brott.push({
        rule: "10. radie-literal dubblerar ett token",
        detail: `"border-radius: ${varde}" i ${file} (rad ${radAv(m.index)}) skriver samma tal som ett token i @theme static gör. Använd var(--radius-*) i stället, annars glider de isär när skalan ändras (#164).`,
      });
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
  console.log(`check-tokens: ${alla.length} tokens, alla elva regler gröna (${file})`);
  process.exit(0);
}

console.error(`check-tokens: ${brott.length} brott mot tokenkontraktet\n`);
for (const b of brott) console.error(`  [${b.rule}] ${b.detail}`);
process.exit(1);
