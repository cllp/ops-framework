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

const indata = `
@import "tailwindcss";
@import "${tokenfil.replace(/\\/g, "/")}";
@source "${dist.replace(/\\/g, "/")}";
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
  ".border-info\\/30",
  ".peer-checked\\:bg-accent",
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
