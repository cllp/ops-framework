#!/usr/bin/env node
/**
 * Vakt: ordet "läge" betyder inte status i ramverkets gränssnittssträngar.
 *
 * ══ ⛔ VARFÖR ORDET SPELAR ROLL ═════════════════════════════════════════
 *
 * CP 2026-09-25 i cllp/bolag-ops#359: taxonomin heter Status, inte Läge.
 * Ett fält som heter `status` i koden och "Läge" på skärmen tvingar varje
 * läsare att hålla två ord för en sak i huvudet, och det är exakt den sortens
 * glapp som gör en konfigurerbar katalog omöjlig att förklara.
 *
 * ══ ⛔ VARFÖR EN NAIV GREP HADE VARIT VÄRDELÖS ══════════════════════════
 *
 * Mätt på ramverkets main 414c56d: ordet "läge" står på ~60 rader i `src/`.
 * Nästan alla är riktig svenska om något annat än status: "mörkt läge",
 * "nolläget", "utvecklingsläge", "radläget", "det tomma läget". En vakt som
 * fällde på alla hade behövt sextio undantag, och en vakt med sextio undantag
 * är en lista, inte en vakt.
 *
 * ══ ⛔ DEN SPRÅKLIGA REGELN SOM GÖR DEN MÄTBAR ═════════════════════════
 *
 * Svenskan skiljer själv på de två betydelserna, och skillnaden syns i
 * sammansättningen:
 *
 *   led ordet är EFTERled  → tillstånd eller position → nolläge, mörkt läge
 *   led ordet är FÖRled    → taxonomin               → lägesfilter, lägesväljare
 *
 * Därför matchar vakten "läge" bara när ordet INLEDER ett ord, alltså när det
 * inte föregås av en bokstav. "nolläget" går fritt, "lägesfiltret" fälls, och
 * det fristående "Läge" och "Lägen" fälls. Det är ingen fullständig
 * betydelseanalys, och vakten påstår inte att den är det.
 *
 * ══ ⛔ VAD VAKTEN LÄSER, OCH VAD DEN INTE LÄSER ════════════════════════
 *
 * Bara stränglitteraler utanför kommentarer, och bara i kod som inte är prov.
 *
 *   - Kommentarer är resonemang om varför koden ser ut som den gör. De ska
 *     få säga "mörkt läge" och "nolläget" utan att bygget faller.
 *   - Prov beskriver sig själva på svenska ("visar det tomma läget"), och det
 *     är inte gränssnittssträngar.
 *   - Ett kastat felmeddelande i en primitiv är ett meddelande till en
 *     utvecklare, men det står ändå här: det är en sträng, och den dagen det
 *     är fel ord i den vill vi veta.
 *
 * Den ser alltså inte ord som byggs ihop i körtid, och inte ord i README.
 * Prosan i README är mätt för hand i PR:en för #94, inte av den här vakten.
 *
 * Kör: node scripts/check-statusord.mjs [katalog]
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/*
 * ⛔ SÖKVÄGEN GÅR ATT PEKA OM, av samma skäl som i de andra vakterna: en vakt
 * som bara kan köras mot en katalog som råkar vara grön går inte att se falla.
 * bolag-ops pekar den mot sin egen `web/src` (cllp/bolag-ops#362).
 */
const arg = process.argv[2];
const katalog = arg ? path.resolve(arg) : path.join(rot, "src");

if (!fs.existsSync(katalog)) {
  console.error(`check-statusord: ${katalog} finns inte. Fel sökväg i vakten, inte ett godkänt utfall.`);
  process.exit(1);
}

/**
 * Undantag: strängar där "läge" bevisligen betyder något annat än status.
 *
 * ⛔ VARJE UNDANTAG BÄR ETT SKÄL, och skälet ska säga vilken annan betydelse
 * ordet har. "Det är okej" är inte ett skäl, det är en tystad vakt.
 *
 * `fil` matchas som ändelse på sökvägen, så listan fungerar från vilken
 * katalog vakten än pekas mot.
 *
 * @type {{ fil: string, fras: string, skal: string }[]}
 */
const UNDANTAG = [
  {
    fil: "src/lib/theme.js",
    fras: "okänt läge",
    skal: "temats tre lägen (ljust, mörkt, system). Ett tema är inte en status på en post.",
  },
  {
    fil: "src/components/OpsSegmented.jsx",
    fras: "två eller tre lägen",
    skal: "antalet segment i en växel. Ett segment är ett val, inte en status.",
  },
  {
    fil: "src/components/OpsSegmented.jsx",
    fras: "lägen har icon",
    skal: "samma segment som ovan, i den andra kontrollen.",
  },
];

/**
 * ⛔ FÖRLED, INTE EFTERLED. Se resonemanget överst. Negativ lookbehind på en
 * bokstav, inklusive å, ä och ö, som annars räknas som ordgräns av `\b`.
 */
const ORDET = /(?<![\p{L}])läge/giu;

/** @param {string} kod @returns {string} */
function utanKommentarer(kod) {
  // Blockkommentarer först: en `//` inuti en blockkommentar är inte en radkommentar.
  return kod.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/\/\/[^\n]*/g, "");
}

/**
 * Stränglitteraler i en rad kod, utan omgivande citattecken.
 *
 * ⛔ Enkel avsiktligt. Den missar en sträng som spänner över flera rader i en
 * mall, och det är ett medvetet val: att tolka JavaScript riktigt kräver en
 * parser, och en vakt som kräver en parser blir inte skriven.
 *
 * @param {string} rad @returns {string[]}
 */
function strangar(rad) {
  const ut = [];
  for (const m of rad.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`/g)) {
    ut.push(m[1] ?? m[2] ?? m[3] ?? "");
  }
  return ut;
}

/** @param {string} dir @returns {string[]} */
function filer(dir) {
  /** @type {string[]} */
  const ut = [];
  for (const post of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, post.name);
    if (post.isDirectory()) {
      if (post.name === "node_modules" || post.name === "dist" || post.name === "__tests__") continue;
      ut.push(...filer(full));
      continue;
    }
    if (/\.(js|jsx)$/.test(post.name) && !/\.test\.jsx?$/.test(post.name)) ut.push(full);
  }
  return ut;
}

/**
 * @param {string} full @param {string} fras
 * @returns {{ fil: string, fras: string, skal: string } | undefined}
 */
function undantaget(full, fras) {
  const vag = full.split(path.sep).join("/");
  return UNDANTAG.find((u) => vag.endsWith(u.fil) && fras.includes(u.fras));
}

/** @type {{ fil: string, rad: number, strang: string }[]} */
const fynd = [];
/** @type {Set<string>} */
const anvanda = new Set();
let lasta = 0;

for (const full of filer(katalog)) {
  lasta += 1;
  const rader = utanKommentarer(fs.readFileSync(full, "utf8")).split("\n");
  rader.forEach((rad, i) => {
    for (const s of strangar(rad)) {
      if (!ORDET.test(s)) {
        ORDET.lastIndex = 0;
        continue;
      }
      ORDET.lastIndex = 0;
      const u = undantaget(full, s);
      if (u) {
        anvanda.add(`${u.fil}::${u.fras}`);
        continue;
      }
      fynd.push({ fil: path.relative(katalog, full), rad: i + 1, strang: s.trim().slice(0, 120) });
    }
  });
}

if (fynd.length > 0) {
  console.error(`check-statusord: ${fynd.length} gränssnittssträng${fynd.length === 1 ? "" : "ar"} säger "läge" där taxonomin heter Status.`);
  for (const f of fynd) console.error(`  ${f.fil}:${f.rad}  ${f.strang}`);
  console.error("");
  console.error('Byt ordet till "status". Betyder det något annat än en status på en post, lägg ett undantag i UNDANTAG med ett skäl som säger vilken betydelse det är.');
  process.exit(1);
}

/*
 * ⛔ ETT UNDANTAG SOM INTE LÄNGRE BEHÖVS ÄR OCKSÅ ETT FEL. Annars blir listan
 * ett arkiv över strängar som togs bort för ett år sedan, och nästa läsare
 * tror att den beskriver koden.
 */
const oanvanda = UNDANTAG.filter((u) => !anvanda.has(`${u.fil}::${u.fras}`));
if (oanvanda.length > 0 && !arg) {
  console.error(`check-statusord: ${oanvanda.length} undantag matchar ingen sträng längre. Ta bort dem.`);
  for (const u of oanvanda) console.error(`  ${u.fil}  "${u.fras}"`);
  process.exit(1);
}

console.log(`check-statusord: ${lasta} filer, inga gränssnittssträngar kallar en status för läge (${UNDANTAG.length} undantag med skäl).`);
