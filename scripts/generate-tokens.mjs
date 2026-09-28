#!/usr/bin/env node
/**
 * Skriver de delar av tokens/tokens.css som tokens/sessionstudio-profil.json
 * ÄGER, mellan namngivna markörer.
 *
 * ⛔ #167: "SessionStudios hela utseende som EN fixtur i ramverket, med vakt."
 * Fixturen är källan. Den här filen är den enda som får skriva mellan
 * markörerna. Allt annat i tokens.css, identitetstoner, slag, provenienstoner,
 * z-index, säkra ytor, är ramverkets egna beslut och ligger UTANFÖR dem.
 *
 * ⛔ TVÅ MARKÖRPAR, INTE ETT. SessionStudios ljusa värden hör hemma i
 * `@theme static` (Tailwind-namnrymder: --color-*, --radius-*, --text-*).
 * De mörka råvärdena (--dark-*) hör hemma i det fristående `:root`-blocket
 * enligt filens egen regel: en `--dark-*` är aldrig en Tailwind-namnrymd och
 * ska inte stå i `@theme`. Ett tredje litet par bär `.lucide`-regeln, som
 * inte är ett tokenblock alls utan en @layer-regel.
 *
 * Aliasblocken (`:root:not([data-theme="light"])` och `:root[data-theme="dark"]`)
 * rörs INTE av den här generatorn. De innehåller bara pekare
 * (`--color-x: var(--dark-x);`), aldrig ett värde, och växer med en rad per
 * nytt tokennamn, inte med varje ändrat SessionStudio-tal. Den raden läggs för
 * hand när ett nytt namn tillkommer (samma sätt som alla andra alias-rader i
 * filen skrevs), och `tokens/check-tokens.mjs` regel 3/6/7 vaktar att
 * paren ändå aldrig glider isär.
 *
 * Kör:  node scripts/generate-tokens.mjs           skriver om tokens.css
 *       node scripts/generate-tokens.mjs --kontrollera   avslutar rött om filen INTE redan matchar
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturVag = path.join(rot, "tokens", "sessionstudio-profil.json");
const tokenVag = path.join(rot, "tokens", "tokens.css");

export const MARKORER = /** @type {const} */ ({
  theme: {
    start: "  /* ── GENERERAT UR sessionstudio-profil.json, RÖR INTE (@theme) ── */",
    slut: "  /* ── SLUT GENERERAT (@theme) ── */",
  },
  dark: {
    start: "  /* ── GENERERAT UR sessionstudio-profil.json, RÖR INTE (:root mörkt) ── */",
    slut: "  /* ── SLUT GENERERAT (:root mörkt) ── */",
  },
  ikonlager: {
    start: "/* ── GENERERAT UR sessionstudio-profil.json, RÖR INTE (@layer base) ── */",
    slut: "/* ── SLUT GENERERAT (@layer base) ── */",
  },
});

/** @param {object} f Fixturen, redan JSON.parse:ad. */
export function byggThemeBlock(f) {
  const { farger, radier, typografi, diagram } = f;
  const rader = [
    `  --color-canvas: ${farger.ljus.canvas.varde};`,
    `  --color-surface: ${farger.ljus.surface.varde};`,
    `  --color-raised: ${farger.ljus.raised.varde};`,
    `  --color-elevated: ${farger.ljus.elevated.varde};`,
    `  --color-hover: ${farger.ljus.hover.varde};`,
    `  --color-sunken: ${farger.ljus.sunken.varde};`,
    ``,
    `  --color-ink: ${farger.ljus.ink.varde};`,
    `  --color-ink-secondary: ${farger.ljus.ink_secondary.varde};`,
    `  --color-ink-muted: ${farger.ljus.ink_muted.varde};`,
    ``,
    `  --color-line: ${farger.ljus.line.varde};`,
    ``,
    `  --color-accent: ${farger.ljus.accent.varde};`,
    `  --color-accent-hover: ${farger.ljus.accent_hover.varde};`,
    ``,
    `  --radius-sm: ${radier.sm};`,
    `  --radius-md: ${radier.md};`,
    `  --radius-lg: ${radier.lg};`,
    `  --radius-xl: ${radier.xl};`,
    `  --radius-card: ${radier.card};`,
    ``,
    `  --text-sm: ${typografi.skala.sm};`,
    `  --text-base: ${typografi.skala.base};`,
    ``,
    `  --shadow-sm: ${f.skuggor.ljus.sm.varde};`,
    `  --shadow-md: ${f.skuggor.ljus.md.varde};`,
    `  --shadow-lg: ${f.skuggor.ljus.lg.varde};`,
    ``,
    ...diagram.chart.ljus.map((hex, i) => `  --color-chart-${i + 1}: ${hex};`),
  ];
  return rader.join("\n");
}

/**
 * ⛔ Dark-blocket ligger i det fristående `:root { ... }`, INTE i
 * `@theme static`. `--dark-*` är aldrig en Tailwind-namnrymd (den läses bara
 * via `var(--dark-x)` inne i ett alias), så den ska inte stå bland
 * `--color-*`/`--shadow-*` där Tailwind läser strukturen vid bygget. Samma
 * regel som redan stod skriven för `--duration-*`/`--z-*`/`--safe-*` i
 * filens ursprungliga kommentar.
 * @param {object} f
 */
export function byggDarkBlock(f) {
  const { farger, diagram, skuggor, rorelse, ikoner, topprad, typografi } = f;
  const rader = [
    `  --dark-canvas: ${farger.mork.canvas.varde};`,
    `  --dark-surface: ${farger.mork.surface.varde};`,
    `  --dark-raised: ${farger.mork.raised.varde};`,
    `  --dark-elevated: ${farger.mork.elevated.varde};`,
    `  --dark-hover: ${farger.mork.hover.varde};`,
    `  --dark-sunken: ${farger.mork.sunken.varde};`,
    ``,
    `  --dark-ink: ${farger.mork.ink.varde};`,
    `  --dark-ink-secondary: ${farger.mork.ink_secondary.varde};`,
    `  --dark-ink-muted: ${farger.mork.ink_muted.varde};`,
    ``,
    `  --dark-line: ${farger.mork.line.varde};`,
    ``,
    `  --dark-accent: ${farger.mork.accent.varde};`,
    `  --dark-accent-hover: ${farger.mork.accent_hover.varde};`,
    ``,
    `  --dark-shadow-sm: ${skuggor.mork.sm.varde};`,
    `  --dark-shadow-md: ${skuggor.mork.md.varde};`,
    `  --dark-shadow-lg: ${skuggor.mork.lg.varde};`,
    ``,
    ...diagram.chart.mork.map((hex, i) => `  --dark-chart-${i + 1}: ${hex};`),
    ``,
    `  --word-spacing-normal: ${typografi.word_spacing_normal.varde};`,
    ``,
    `  --duration-fast: ${rorelse.fast};`,
    `  --duration-base: ${rorelse.normal};`,
    `  --duration-slow: ${rorelse.slow};`,
    ``,
    `  --icon-stroke-width: ${ikoner.strokeWidth};`,
    `  --topbar-height: ${topprad.hojd};`,
  ];
  return rader.join("\n");
}

/** @param {object} f */
export function byggIkonlagerBlock(f) {
  return [
    "@layer base {",
    "  /* SessionStudios tunna linjeikoner (index.css:437-445). Gäller ALLA",
    "   * lucide-ikoner, inte bara ramverkets egna omslag i icons.jsx, så att en",
    "   * apps direkta <Icon/>-import också följer profilen. */",
    "  .lucide {",
    "    stroke-width: var(--icon-stroke-width);",
    "  }",
    "}",
  ].join("\n");
}

/** @returns {{ fixtur: object, block: { theme: string, dark: string, ikonlager: string } }} */
export function generera() {
  if (!fs.existsSync(fixturVag)) {
    throw new Error(`generate-tokens: hittar inte fixturen ${fixturVag}.`);
  }
  const fixtur = JSON.parse(fs.readFileSync(fixturVag, "utf8"));
  return {
    fixtur,
    block: {
      theme: byggThemeBlock(fixtur),
      dark: byggDarkBlock(fixtur),
      ikonlager: byggIkonlagerBlock(fixtur),
    },
  };
}

/**
 * Ersätter innehållet MELLAN (men inte inklusive) start- och slutmarkören.
 * @param {string} kalla @param {{start:string, slut:string}} par @param {string} nyttInnehall
 */
export function skrivMellanMarkorer(kalla, par, nyttInnehall) {
  const i = kalla.indexOf(par.start);
  const j = kalla.indexOf(par.slut);
  if (i === -1 || j === -1 || j < i) {
    throw new Error(`generate-tokens: hittar inte markörparet "${par.start.trim()}" / "${par.slut.trim()}" i filen. Har någon rört markörraderna för hand?`);
  }
  const fore = kalla.slice(0, i + par.start.length);
  const efter = kalla.slice(j);
  return `${fore}\n${nyttInnehall}\n${efter}`;
}

function main() {
  const { block } = generera();
  let kalla = fs.readFileSync(tokenVag, "utf8");
  kalla = skrivMellanMarkorer(kalla, MARKORER.theme, block.theme);
  kalla = skrivMellanMarkorer(kalla, MARKORER.dark, block.dark);
  kalla = skrivMellanMarkorer(kalla, MARKORER.ikonlager, block.ikonlager);

  const kontrollera = process.argv.includes("--kontrollera");
  if (kontrollera) {
    const nuvarande = fs.readFileSync(tokenVag, "utf8");
    if (nuvarande !== kalla) {
      console.error(
        "generate-tokens --kontrollera: tokens.css matchar INTE generatorns utfall.\n" +
          "Det generererade blocket har redigerats för hand, eller fixturen har\n" +
          "ändrats utan att generatorn körts om. Kör: node scripts/generate-tokens.mjs",
      );
      process.exit(1);
    }
    console.log("generate-tokens --kontrollera: tokens.css matchar fixturen, byte för byte.");
    return;
  }

  fs.writeFileSync(tokenVag, kalla);
  console.log("generate-tokens: tokens/tokens.css uppdaterad ur tokens/sessionstudio-profil.json.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
