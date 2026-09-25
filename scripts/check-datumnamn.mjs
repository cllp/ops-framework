#!/usr/bin/env node
/**
 * Vakt: inga månads- eller veckodagsnamn skrivna för hand.
 *
 * ══ ⛔ VARFÖR ══════════════════════════════════════════════════════════
 *
 * `Intl` kan dem i varje språk som finns. En egen lista är tolv plus sju ord
 * per språk som någon ska skriva, stava och hålla i takt, och den kan bara ett
 * språk. Ramverket hade två sådana listor, `MONTH_NAMES` i `src/lib/calendar.js`
 * och `WEEKDAYS` i `OpsCalendar`, och de var den enda anledningen till att
 * kalendern inte gick att visa på engelska (cllp/ops-framework#95).
 *
 * ══ ⛔ VARFÖR EN VAKT OCH INTE BARA ETT PROV ═══════════════════════════
 *
 * Proven i `locale.test.jsx` bevisar att `monthNames("en-GB")` svarar engelska.
 * De säger ingenting om att någon EN MÅNAD SENARE lägger tillbaka en rad
 * `const MANADER = ["januari", ...]` i en ny komponent för att det gick
 * fortare. Sviten förblir grön, och det andra språket är trasigt igen på precis
 * ett ställe. Det är en vakts jobb, inte ett provs.
 *
 * ══ ⛔ VAD DEN LÄSER ═══════════════════════════════════════════════════
 *
 * Stränglitteraler utanför kommentarer, i kod som inte är prov, och bara när
 * HELA strängen är ett namn. "september" fälls, "17 september 2026 mättes..."
 * gör det inte: ett datum i en text är ett exempel, inte en ordlista.
 *
 * Kör: node scripts/check-datumnamn.mjs [katalog]
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = process.argv[2];
const katalog = arg ? path.resolve(arg) : path.join(rot, "src");

if (!fs.existsSync(katalog)) {
  console.error(`check-datumnamn: ${katalog} finns inte. Fel sökväg i vakten, inte ett godkänt utfall.`);
  process.exit(1);
}

/*
 * ⛔ NAMNEN HÄMTAS UR `Intl`, INTE UR EN LISTA I VAKTEN. En vakt mot handskrivna
 * ordlistor som själv bär en handskriven ordlista hade varit en travesti, och
 * dessutom fel: listan här måste täcka precis de ord `Intl` producerar, annars
 * missar den just den stavning någon kopierade därifrån.
 */
const SPRAK = ["sv-SE", "en-GB", "en-US"];

/** @type {Set<string>} */
const NAMN = new Set();
for (const sprak of SPRAK) {
  for (const stil of /** @type {const} */ (["long", "short"])) {
    const manad = new Intl.DateTimeFormat(sprak, { month: stil });
    for (let i = 0; i < 12; i += 1) NAMN.add(manad.format(new Date(2021, i, 1)).toLowerCase());
    const dag = new Intl.DateTimeFormat(sprak, { weekday: stil });
    for (let i = 0; i < 7; i += 1) NAMN.add(dag.format(new Date(2024, 0, 1 + i)).toLowerCase());
  }
}

/*
 * ⛔ "May" ÄR ETT MÅNADSNAMN OCH ETT VANLIGT ENGELSKT ORD, och "mars" är en
 * planet. Ett ensamt sådant ord i en sträng är inte en ordlista. Undantagen
 * gäller ordet i sig, inte en fil, eftersom risken finns överallt.
 */
const TVETYDIGA = new Set(["may", "mars", "march"]);

/** @param {string} kod @returns {string} */
function utanKommentarer(kod) {
  return kod.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/\/\/[^\n]*/g, "");
}

/** @param {string} rad @returns {string[]} */
function strangar(rad) {
  const ut = [];
  for (const m of rad.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'/g)) ut.push(m[1] ?? m[2] ?? "");
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

/** @type {{ fil: string, rad: number, ord: string }[]} */
const fynd = [];
let lasta = 0;

for (const full of filer(katalog)) {
  lasta += 1;
  utanKommentarer(fs.readFileSync(full, "utf8"))
    .split("\n")
    .forEach((rad, i) => {
      for (const s of strangar(rad)) {
        const ord = s.trim().toLowerCase();
        if (!NAMN.has(ord) || TVETYDIGA.has(ord)) continue;
        fynd.push({ fil: path.relative(katalog, full), rad: i + 1, ord: s.trim() });
      }
    });
}

if (fynd.length > 0) {
  console.error(`check-datumnamn: ${fynd.length} handskri${fynd.length === 1 ? "vet" : "vna"} datumnamn. Ta dem ur Intl i stället.`);
  for (const f of fynd) console.error(`  ${f.fil}:${f.rad}  "${f.ord}"`);
  console.error("");
  console.error("`monthNames(locale)` och `weekdayNames(locale)` i src/lib/calendar.js svarar på varje språk. En egen lista kan bara ett.");
  process.exit(1);
}

console.log(`check-datumnamn: ${lasta} filer, inga handskrivna månads- eller veckodagsnamn (${NAMN.size} namn i ${SPRAK.length} språk kontrollerade).`);
