#!/usr/bin/env node
/**
 * Kontrasten på de text-mot-yta-par komponenterna faktiskt använder, i BÅDA
 * teman.
 *
 * ══ ⛔ VARFÖR VAKTEN FINNS ══════════════════════════════════════════════════
 *
 * CP 2026-09-25, om notispanelen i mörkt tema: "Etikettchipsen är oläsbara.
 * Ljust krämfärgat chip med ljus/nästan osynlig text."
 *
 * Rotorsaken var inte ett dåligt färgval. Chippet skrev `bg-accent
 * text-on-accent`, och **`--color-on-accent` har aldrig funnits**. Tailwind
 * skriver då `color: var(--color-on-accent)`, som resolvar till ingenting, så
 * texten ärvde föräldern. I ljust tema råkade det se rimligt ut; i mörkt blev
 * ljus text på krämfärgad yta.
 *
 * ⛔ INGEN BEFINTLIG VAKT KUNDE FÅNGA DET. `check-token-overrides` läser appens
 * CSS, inte komponenternas klasser. `check-closed-api` bryr sig om vem som får
 * ta emot `className`. Ett fantomtoken passerade alltså hela grinden och syntes
 * först när en människa tittade på en telefon i mörkt rum.
 *
 * Den här vakten gör två saker:
 *   1. VARJE token ett par pekar på måste FINNAS, i båda teman.
 *   2. Paret måste klara WCAG AA, 4.5:1 för brödtext och 3:1 för stor text.
 *
 * ══ ⛔ `ink-muted` BÄR ALDRIG INFORMATION ═══════════════════════════════════
 *
 * Den ger 3,65:1 mot `raised` i båda teman, alltså under AA. Det är med flit:
 * tokenet finns för dekor, avstängda kontroller och chevroner som ändå är
 * `aria-hidden`. Står det ett klockslag eller en rubrik i `ink-muted` är det ett
 * fel, och rättningen är `ink-secondary` och inte en sänkt ribba här.
 *
 * ⛔ Det gäller FLER YTOR ÄN DEN HÄR PANELEN, och de är inte genomgångna. Se
 * noten i PR:en till ops-framework#89.
 *
 * ⛔ PAREN STÅR UTSKRIVNA OCH HÄRLEDS INTE UR KLASSERNA. En parser som gissar
 * vilken bakgrund en text ligger på ur Tailwind-klasser blir fel i första
 * kapslade fallet, och en vakt som har fel ibland stängs av. Listan underhålls
 * för hand, och det är billigare än ett svar man inte litar på.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { contrast } from "./vendor/validate_palette.js";

const HAR = path.dirname(fileURLToPath(import.meta.url));
const TOKENS = path.join(HAR, "..", "tokens", "tokens.css");

/** AA: 4.5 för brödtext, 3.0 för stor eller halvfet text från 18,66 px. */
const BROD = 4.5;
const STOR = 3.0;
/** Grafik och kontrollers ytor, alltså inte text. WCAG 1.4.11. */
const GRAFIK = 3.0;

/**
 * Paren som ska hålla. `text` mot `yta`, per tema.
 *
 * ⛔ `nivå: STOR` bara där texten FAKTISKT är stor eller halvfet och ≥ 18,66 px.
 * Att sänka ribban för en liten metarad är att skriva in felet i vakten.
 */
export const PAR = [
  { vad: "panelens rubrik", text: "ink", yta: "raised", niva: BROD },
  { vad: "radens rubrik", text: "ink", yta: "raised", niva: BROD },
  { vad: "radens detalj", text: "ink-secondary", yta: "raised", niva: BROD },
  { vad: "radens metarad (klockslag, slag)", text: "ink-secondary", yta: "raised", niva: BROD },
  { vad: "dagsrubriken (Idag, I går)", text: "ink-secondary", yta: "raised", niva: BROD },
  { vad: "chipset Ny", text: "badge-contrast", yta: "badge", niva: BROD },
  { vad: "räknaren på klockan", text: "badge-contrast", yta: "badge", niva: BROD },
  /* ⛔ MÄRKET SJÄLVT MOT PANELEN, inte bara siffran i det. Ett märke som går i
     ett med ytan syns inte, hur läsbar siffran i det än är, och det är ett
     KRAV PÅ GRAFIK och därför 3:1 och inte 4,5. */
  { vad: "märket mot panelen", text: "badge", yta: "raised", niva: GRAFIK },
  { vad: "Gick fel", text: "danger", yta: "raised", niva: BROD },
  { vad: "tillbakapilen", text: "ink-secondary", yta: "raised", niva: BROD },
  { vad: "panelrad, vilande", text: "ink-secondary", yta: "raised", niva: BROD },
  { vad: "panelrad, aktiv", text: "ink", yta: "raised", niva: BROD },
];

/**
 * Läser tokens för ett tema.
 *
 * ⛔ MÖRKT TEMA LÄSES UR `--dark-*`, alltså källan, och inte ur `@media`-blocket.
 * Blocket pekar bara vidare (`--color-ink: var(--dark-ink)`), så en parser som
 * läste det skulle få strängen "var(--dark-ink)" och tro att den är en färg.
 *
 * @param {string} css @param {"light"|"dark"} tema
 */
export function lasTokens(css, tema) {
  /*
   * ⛔ BARA `@theme static`-BLOCKET, och det är inte överdriven försiktighet.
   * Första versionen läste varje `--color-*` i hela filen och fick
   * `--color-raised: #3a3530` ur `.ops-contrast-panel`, en lokal inversion
   * längst ned. Utfallet var att svart text på vit yta rapporterades som
   * 1,44:1, alltså en vakt som var röd på allt och därför oanvändbar.
   */
  const bas = blocket(css, "@theme static {");
  const ljus = deklarationer(bas, "--color-");
  if (tema === "light") return ljus;

  /*
   * ⛔ `--dark-*` BOR I `:root`, INTE I `@theme static`, och det är värt en rad
   * eftersom misstaget är tyst: hittar parsern inga mörka värden faller allt
   * tillbaka på de ljusa, och vakten rapporterar två identiska teman som gröna.
   * Precis så såg första körningen ut, med 17,40:1 i BÅDA kolumnerna.
   */
  const rot = blocket(css, ":root {");
  const morka = deklarationer(rot, "--dark-");
  if (Object.keys(morka).length === 0) {
    throw new Error("check-kontrast: hittade inga --dark-*. Utan dem mäts ljust tema två gånger och vakten blir grön på fel grund.");
  }
  return { ...ljus, ...morka };
}

/**
 * Texten i ett block, från dess öppningsklammer till den matchande stängande.
 *
 * ⛔ RÄKNAR KLAMRAR i stället för att leta efter nästa `}`. Tokenfilen har
 * nästlade block, och en naiv sökning slutar vid den första inre stängningen.
 *
 * @param {string} css @param {string} start
 */
function blocket(css, start) {
  const i = css.indexOf(start);
  if (i < 0) throw new Error(`check-kontrast: hittade inte "${start}" i tokens.css.`);
  let djup = 0;
  for (let j = i + start.length - 1; j < css.length; j += 1) {
    if (css[j] === "{") djup += 1;
    else if (css[j] === "}") {
      djup -= 1;
      if (djup === 0) return css.slice(i, j);
    }
  }
  throw new Error(`check-kontrast: "${start}" stängs aldrig.`);
}

/**
 * Färgdeklarationerna med ett visst prefix.
 *
 * ⛔ BARA RIKTIGA FÄRGER. En `var(...)`-hänvisning är ingen färg att mäta, och
 * en parser som tog med den skulle jämföra strängen "var(--dark-ink)" med ett
 * hexvärde och svara med NaN.
 *
 * @param {string} css @param {string} prefix
 */
function deklarationer(css, prefix) {
  /** @type {Record<string, string>} */
  const ut = {};
  for (const m of css.matchAll(new RegExp(`${prefix}([a-z0-9-]+):\\s*([^;]+);`, "g"))) {
    const varde = m[2].trim();
    if (varde.startsWith("#") || varde.startsWith("rgb")) ut[m[1]] = varde;
  }
  return ut;
}

/**
 * Kontrollerar alla par i ett tema.
 *
 * ⛔ ETT SAKNAT TOKEN ÄR ETT EGET FEL OCH INTE "kontrast 0". Skillnaden avgör
 * vad man gör: en dålig färg justeras, ett stavfel rättas.
 *
 * @param {Record<string, string>} tokens @param {"light"|"dark"} tema
 */
export function granska(tokens, tema) {
  const brott = [];
  for (const p of PAR) {
    for (const roll of ["text", "yta"]) {
      if (!tokens[p[roll]]) {
        brott.push(`${tema}: ${p.vad} pekar på --color-${p[roll]}, som inte finns. Ett fantomtoken resolvar till ingenting och texten ärver föräldern.`);
      }
    }
    if (!tokens[p.text] || !tokens[p.yta]) continue;
    const kvot = contrast(tokens[p.text], tokens[p.yta]);
    if (kvot < p.niva) {
      brott.push(`${tema}: ${p.vad} ger ${kvot.toFixed(2)}:1 (${p.text} mot ${p.yta}). Kravet är ${p.niva}:1.`);
    }
  }
  return brott;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const css = fs.readFileSync(TOKENS, "utf8");
  const brott = [];
  const rader = [];
  for (const tema of /** @type {const} */ (["light", "dark"])) {
    const tokens = lasTokens(css, tema);
    brott.push(...granska(tokens, tema));
    for (const p of PAR) {
      if (tokens[p.text] && tokens[p.yta]) {
        rader.push(`  ${tema.padEnd(5)} ${p.vad.padEnd(34)} ${contrast(tokens[p.text], tokens[p.yta]).toFixed(2)}:1`);
      }
    }
  }

  if (brott.length) {
    console.error("check-kontrast: par som inte håller\n\n" + brott.map((b) => `  ${b}`).join("\n") + "\n");
    process.exit(1);
  }
  console.log(`check-kontrast: ${PAR.length} par i 2 teman, alla över AA`);
  console.log(rader.join("\n"));
}
