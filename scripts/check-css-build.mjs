#!/usr/bin/env node
/**
 * Vakt: bygger CSS på riktigt och kontrollerar vad som kom ut.
 *
 * ⛔ Den här vakten finns för att alla andra påståenden om utseendet är
 * påståenden tills någon kompilerar. Tokenvakten läser en textfil. Den här
 * kör Tailwind och tittar i resultatet.
 *
 * Tre frågor, och den andra är den som gör den värd att ha:
 *
 *   1. Genereras våra utilities? (`bg-accent`, `text-ink`, `bg-identity-3`)
 *   2. Är `bg-red-500` verkligen borta? Tokenkontraktet PÅSTÅR att
 *      `--color-*: initial` tar bort Tailwinds palett. Här bevisas det, genom
 *      att klassen faktiskt står i underlaget och ändå inte hamnar i utdata.
 *   3. Överlevde klassnamnen bygget av `dist`? Hittar Tailwind dem inte där är
 *      hela ramverket osynligt för konsumentens bygge, och felet visar sig som
 *      en ostylad app utan ett enda felmeddelande.
 *
 * Kör: node scripts/check-css-build.mjs
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(rot, "dist", "index.js");

// Tokenfilen kan pekas om. Det används av `test-guards.mjs`, som matar in en
// medvetet trasig kopia och kräver att den här vakten blir röd. En vakt ingen
// sett faila är en förhoppning.
const tokenfil = process.argv[2] ? path.resolve(process.argv[2]) : path.join(rot, "tokens", "tokens.css");

if (!fs.existsSync(dist)) {
  console.error("check-css-build: dist/index.js saknas. Kör `npm run build` först.");
  process.exit(1);
}

/**
 * Arbetsmappen ligger INUTI repot, inte i systemets temp.
 *
 * ⛔ Första versionen lade den i /tmp och dog på `Can't resolve 'tailwindcss'`.
 * `@import "tailwindcss"` slås upp relativt filens plats, och från /tmp finns
 * ingen node_modules att hitta. Samma fälla väntar varje konsument som lägger
 * sin CSS utanför projektet.
 */
const arbetsmapp = fs.mkdtempSync(path.join(rot, "node_modules", ".ops-css-"));

/**
 * Underlaget innehåller MED FLIT en förbjuden klass. En vakt som bara testar
 * det som ska fungera bevisar aldrig att något är stoppat.
 */
const fixtur = `
export const prov = (
  <div className="bg-canvas text-ink p-4">
    <span className="bg-red-500 text-blue-700" />
    <span className="bg-[#ff0000]" />
  </div>
);
`;
fs.writeFileSync(path.join(arbetsmapp, "fixtur.jsx"), fixtur);

/*
 * ⛔ DIST SKANNAS UTAN SINA KOMMENTARER, OCH DET ÄR INTE KOSMETIK.
 *
 * Tailwinds skanner letar efter klassnamn i TEXT. Den skiljer inte kod från
 * prosa, så varje klass som står citerad i en kommentar genererar en regel.
 * Ramverket citerar SessionStudios klasser på flera ställen, med flit och med
 * skälet utskrivet, och de citaten är inte vår kod.
 *
 * Utan den här tvätten rapporterar vakten nedanför fyra brott i förlagans
 * citat och noll i vår egen kod, alltså rätt sorts larm på fel rad. Och att
 * skriva om ett citat för att blidka en vakt vore att förfalska det.
 *
 * ⛔ Regexen kan kapa fel i en sträng som innehåller `/*`. Det är avsiktligt
 * ofarligt: indata går till en SKANNER och inte till en JS-motor, och skulle
 * den äta för mycket blir MASTE_FINNAS-listan ovan röd. Vakten vaktas alltså
 * av de andra kontrollerna i samma fil.
 */
const distUtanKommentarer = path.join(arbetsmapp, "dist-skannad.js");
fs.writeFileSync(
  distUtanKommentarer,
  fs.readFileSync(dist, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/[^\n]*$/gm, " "),
);

/*
 * ⛔ `source(none)`: ingen automatisk innehållsdetektering. Utan den skannar
 * Tailwind vad som råkar ligga i arbetskatalogen, och då avgör en kvarglömd
 * byggartefakt om vakten blir grön. En vakt vars utfall beror på skräp i
 * arbetsträdet mäter inte ramverket.
 */
const indata = `
@import "tailwindcss" source(none);
@import "${tokenfil.replace(/\\/g, "/")}";
@source "${distUtanKommentarer.replace(/\\/g, "/")}";
@source "${path.join(arbetsmapp, "fixtur.jsx").replace(/\\/g, "/")}";
`;

const resultat = await postcss([tailwind()]).process(indata, { from: path.join(arbetsmapp, "app.css") });
const css = resultat.css;

/** @type {string[]} */
const brott = [];

// ── 1 + 3: våra utilities finns, alltså hittades dist ────────────────────────
// ⛔ Listan vaxer med varje ny primitiv. Skalet: en primitiv vars klasser inte
// genereras ser ratt ut i kallkoden och blir helt ostylad i bygget, utan ett
// enda felmeddelande. Utan en rad har upptacks det av en anvandare.
//
// Opacitetsmodifierarna (`/12`, `/30`) star med FOR ATT de bygger pa color-mix
// mot en CSS-variabel. Det ar den enda konstruktionen i hela ramverket dar jag
// inte kunde slå upp mig till svaret, sa den matas i stallet.
const MASTE_FINNAS = [
  ".bg-accent",
  ".text-ink",
  ".bg-identity-3",
  ".bg-danger",
  ".text-xs",
  ".rounded-full",
  ".tabular-nums",
  ".overflow-x-auto",
  ".bg-human-bg",
  ".text-agent",
  ".bg-identity-1\\/12",
  // ⛔ Kortets färgade vänsterkant. Den kombinerar en riktnings-utility med
  // vår egen färgnamnrymd, och det är precis den sortens klass som tyst
  // uteblir: kortet renderas, kanten blir bara osynlig.
  ".border-l-identity-2",
  ".border-info\\/30",
  ".peer-checked\\:bg-accent",
  // Rubriktokenet. Utan raden hade en app som pekar --font-display mot en
  // antikva sett precis likadan ut, och felet hade lastats pa tokenet.
  ".font-display",
  // Vantan. `sr-only` ar texten skarmlasaren far i stallet for snurran.
  // Genereras den inte blir vantan helt tyst, och det marks aldrig med ogat.
  ".sr-only",
  ".animate-spin",
  ".motion-reduce\\:animate-spin-slow",
  // Markets bildtoken. Genereras den inte star varumarket som en tom ruta i
  // topraden, och det ar det forsta anvandaren ser.
  ".bg-\\(image\\:--logo-phst\\)",
];
for (const v of MASTE_FINNAS) {
  if (!css.includes(v)) {
    brott.push(
      `${v} genererades inte. Antingen saknas tokenet, eller så hittade Tailwind inte klassnamnen i dist/index.js. Det andra fallet ger en helt ostylad app utan felmeddelande.`,
    );
  }
}

// ── 2: paletten är verkligen borta ───────────────────────────────────────────
const MASTE_SAKNAS = [".bg-red-500", ".text-blue-700"];
for (const v of MASTE_SAKNAS) {
  if (css.includes(v)) {
    brott.push(
      `${v} genererades trots att tokenkontraktet nollar Tailwinds palett. Då är "inga ad-hoc-färger" en rekommendation igen, inte en mekanism.`,
    );
  }
}

// ── Snurren måste ha sina keyframes, inte bara sin utility ──────────────────
//
// ⛔ Det här är ett TYST fel om det inträffar. `animate-spin` utan
// `@keyframes ops-spin` ger en regel som pekar på en animation som inte finns:
// ingen varning i konsolen, ingen röd rad i bygget, bara en ikon som står
// still. Och en väntesymbol som står still läses som en trasig sida, alltså
// tvärtemot vad den ska säga.
if (!/@keyframes\s+ops-spin/.test(css)) {
  brott.push(
    "@keyframes ops-spin finns inte i utdata trots att .animate-spin gör det. Snurran skulle stå stilla, och det syns varken som varning eller som byggfel.",
  );
}

// ── Hålet Tailwind INTE täpper till, uttalat i stället för underförstått ─────
//
// `bg-[#ff0000]` genereras fortfarande. Att nolla paletten stoppar namngivna
// färger, inte godtyckliga värden. Vi hävdar det inte, vi mäter det: går den
// här kontrollen sönder betyder det att Tailwind blivit striktare, och då ska
// motsvarande regel i check-closed-api.mjs tas bort, inte den här raden.
if (!css.includes("#ff0000")) {
  brott.push(
    "bg-[#ff0000] genererades INTE längre. Antagandet att godtyckliga färgvärden måste stoppas i källkoden gäller inte i den här Tailwind-versionen. Läs om regel 3 i scripts/check-closed-api.mjs innan du ändrar något här.",
  );
}

// ── Ingen deklaration får bära ett bart `--namn` som VÄRDE ──────────────────
//
// ⛔ DEN HÄR VAKTEN FINNS FÖR ATT FELET ÄR OSYNLIGT PÅ VARJE NIVÅ UTOM DEN HÄR.
//
// CP 2026-09-18, med bild: formuläret för nytt ärende gick inte att scrolla på
// telefon, och dess överkant låg utanför skärmen. OpsModal hade skrivits
//
//   max-h-[calc(100dvh---safe-top)]
//
// i tron att Tailwind expanderar `--safe-top` till `var(--safe-top)`. Det gör
// den inte. Den gör det för sina EGNA funktioner, så `--spacing(8)` bredvid i
// samma fil blev `calc(var(--spacing) * 8)` och såg ut att bevisa mönstret.
//
// Utdata blev `max-height: calc(100dvh - --safe-top)`, vilket är ogiltig CSS.
// Webbläsaren slänger hela deklarationen utan att säga något. Dialogen fick då
// ingen takhöjd alls, växte förbi fönstret, och den inre `overflow-auto` slog
// aldrig till eftersom en obegränsad flexbehållare aldrig blir för liten.
//
// Inget fångade det: klassnamnet är korrekt skrivet, Tailwind kompilerar utan
// varning, jsdom räknar ingen layout, och `check-closed-api` läser källkod och
// inte utdata. Den enda platsen där felet SYNS är den kompilerade CSS:en.
{
  // Deklarationer, alltså `prop: värde;` inuti en regel. Egna egenskaper
  // (`--tw-x: initial`) hoppas över: där står namnet till VÄNSTER, vilket är
  // hela skillnaden.
  const misstankta = [];
  for (const m of css.matchAll(/([a-zA-Z-]+)\s*:\s*([^;{}]+)/g)) {
    const [, egenskap, varde] = m;
    if (egenskap.startsWith("--")) continue;
    /*
     * ⛔ TVÅ EGENSKAPER TAR EGENSKAPSNAMN SOM VÄRDE, och där är ett bart
     * `--namn` det enda rätta. `transition-property: --tw-gradient-from` säger
     * vilken egenskap som ska övergå; skrevs den `var(--tw-gradient-from)` hade
     * den i stället läst variabelns VÄRDE och blivit meningslös.
     *
     * Tailwind genererar själv den första, så utan undantaget är vakten röd
     * från första körningen mot kod som är korrekt, och en vakt som alltid är
     * röd slutar man läsa.
     */
    if (egenskap === "transition-property" || egenskap === "will-change") continue;
    // Ett `--namn` som inte står direkt efter `var(`.
    if (/(^|[^a-zA-Z0-9_(-])--[a-zA-Z]/.test(varde.replace(/var\(\s*--/g, "var(§"))) {
      misstankta.push(`${egenskap}: ${varde.trim()}`);
    }
  }
  for (const d of misstankta.slice(0, 5)) {
    brott.push(
      `Deklarationen "${d}" bär ett bart --namn som värde i stället för var(--namn). Det är ogiltig CSS, webbläsaren slänger hela raden utan att varna, och felet syns först som en trasig layout på en riktig telefon.`,
    );
  }
}

// ── Golv: en tom utdata får aldrig räknas som grön ───────────────────────────
if (css.length < 2000) {
  brott.push(`Utdata är bara ${css.length} tecken. Bygget producerade i praktiken ingenting, vilket inte är ett godkänt utfall.`);
}

fs.rmSync(arbetsmapp, { recursive: true, force: true });

if (brott.length === 0) {
  console.log(`check-css-build: ${css.length} tecken CSS, utilities på plats och Tailwinds palett är borta`);
  process.exit(0);
}

console.error(`check-css-build: ${brott.length} brott\n`);
for (const b of brott) console.error(`  ${b}`);
process.exit(1);
