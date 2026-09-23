#!/usr/bin/env node
/**
 * Vakt: reglagets tumme och skena målas med tokens, inte av webbläsaren.
 *
 * ══ ⛔ VARFÖR EN VAKT OCH INTE ETT PROV ══════════════════════════════════
 *
 * Samma felklass som `check-page-frame.mjs`: jsdom kör ingen CSS, Vitest ritar ingen
 * tumme, och ingen komponent importerar `tokens.css`. `reglage.test.jsx` provar
 * elva saker om `OpsSlider` och skulle vara grönt även om hela `.ops-reglage`
 * försvann ur tokenfilen.
 *
 * ══ ⛔ VAD SOM GÅR SÖNDER NÄR DEN FÖRSVINNER ════════════════════════════
 *
 * Reglaget blir inte OSTYLAT, det blir FEL stylat. Ett `input type=range` utan
 * `appearance: none` ritas av webbläsaren i SYSTEMETS accentfärg, alltså:
 *
 *   en färg som ligger utanför tokenkontraktet
 *   en färg som inte byter med mörkt läge
 *   en färg som är olika på en Mac, en telefon och en PC
 *
 * Det är den enda ytan i ramverket som kan råka bli blå hos en användare och
 * grön hos en annan, och ingen av dem ser något fel: de ser en kontroll som ser
 * ut som operativsystemets.
 *
 * ⛔ DEN ANDRA HALVAN ÄR SKENAN. Utan `appearance: none` på SJÄLVA elementet
 * ritar webbläsaren sin egen skena under vår, alltså två skenor ovanpå varandra
 * där bara den ena följer värdet. Därför kräver vakten den raden separat och
 * inte bara på tumme-pseudoelementet.
 *
 * ══ ⛔ VAD VAKTEN INTE BEVISAR ══════════════════════════════════════════
 *
 * Att reglaget går att ta tag i med en tumme. Träffytan är 44px i komponenten,
 * inte här, och den kontrollen är ett öga på en riktig telefon enligt
 * bolag-ops#141. En vakt som utgav sig för att vara det vore sämre än ingen.
 *
 * Kör: node scripts/check-slider.mjs [tokens.css]
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/*
 * ⛔ SÖKVÄGEN GÅR ATT PEKA OM, och det är inte en bekvämlighet. Utan argument kan
 * vakten bara köras mot filen som den råkar se ut, alltså grönt, och då går det
 * inte att plantera ett brott och se den falla. En vakt ingen sett falla är en
 * förhoppning. `scripts/test-guards.mjs` pekar den mot stympade kopior.
 */
const arg = process.argv[2];
const vag = arg ? path.resolve(arg) : path.join(rot, "tokens", "tokens.css");

if (!fs.existsSync(vag)) {
  console.error(`check-slider: ${vag} finns inte. Fel sökväg i vakten, inte ett godkänt utfall.`);
  process.exit(1);
}

const css = fs.readFileSync(vag, "utf8");

// Kommentarer räknas inte. En bortkommenterad regel är en borttagen regel, och
// det är det vanligaste sättet en regel faktiskt försvinner.
const utanKommentarer = css.replace(/\/\*[\s\S]*?\*\//g, "");

/*
 * ⛔ LÄSER `.ops-reglage`-REGLERNA OCH INTE HELA FILEN. En träff var som helst
 * hade varit grön även om raden låg i en helt annan selektor, och en vakt som är
 * grön av fel skäl är precis det den finns för att förhindra.
 */
const regler = [...utanKommentarer.matchAll(/(\.ops-reglage[^{]*)\{([^}]*)\}/g)].map((m) => ({
  selektor: m[1].trim(),
  kropp: m[2],
}));

if (regler.length === 0) {
  console.error("check-slider: hittade inga `.ops-reglage`-regler alls.\n");
  console.error("  Reglaget ritas då av webbläsaren i systemets accentfärg, alltså en färg utanför");
  console.error("  tokenkontraktet som inte byter med mörkt läge och är olika på olika maskiner.");
  console.error("  Se bolag-ops#141 och kommentaren i tokens.css.");
  process.exit(1);
}

/** @param {(r: { selektor: string, kropp: string }) => boolean} test */
const finns = (test) => regler.some(test);

/** @type {string[]} */
const brott = [];

// 1. Elementet självt. Utan den här ritas webbläsarens egen skena UNDER vår.
if (!finns((r) => r.selektor === ".ops-reglage" && /appearance:\s*none/.test(r.kropp))) {
  brott.push(
    "`.ops-reglage` saknar `appearance: none`. Webbläsaren ritar då sin egen skena under vår, alltså två skenor ovanpå varandra där bara den ena följer värdet.",
  );
}

// 2. Tummen i båda motorerna. De delar inte pseudoelement, så en av dem räcker
//    inte: då är reglaget rätt i Chrome och systemfärgat i Firefox.
for (const pseudo of ["::-webkit-slider-thumb", "::-moz-range-thumb"]) {
  const tummen = regler.filter((r) => r.selektor === `.ops-reglage${pseudo}`);
  if (tummen.length === 0) {
    brott.push(`\`.ops-reglage${pseudo}\` saknas. Tummen målas då av webbläsaren i systemets accentfärg.`);
    continue;
  }
  if (!tummen.some((r) => /background:\s*var\(--color-/.test(r.kropp))) {
    brott.push(
      `\`.ops-reglage${pseudo}\` sätter ingen bakgrund ur ett token. En hårdkodad färg här byter inte med mörkt läge.`,
    );
  }
}

// 3. Skenan i båda motorerna.
for (const pseudo of ["::-webkit-slider-runnable-track", "::-moz-range-track"]) {
  if (!finns((r) => r.selektor === `.ops-reglage${pseudo}` && /background:\s*var\(--color-/.test(r.kropp))) {
    brott.push(`\`.ops-reglage${pseudo}\` saknas eller målas utan token. Skenan blir då webbläsarens egen.`);
  }
}

/*
 * ⛔ INGEN HÅRDKODAD FÄRG NÅGONSTANS I BLOCKET. Det här är regeln som fångar den
 * troligaste framtida ändringen: någon vill justera tummen en aning, skriver in
 * ett hexvärde "bara här", och då finns en färg i ramverket som inte finns i
 * tokenkontraktet och inte byter med läget.
 */
for (const r of regler) {
  const hex = r.kropp.match(/#[0-9a-fA-F]{3,8}\b/);
  if (hex) brott.push(`\`${r.selektor}\` har ett hårdkodat färgvärde (${hex[0]}). Använd ett token, eller lägg till ett.`);
  const funk = r.kropp.match(/\b(rgba?|hsla?|oklch|oklab)\(/);
  if (funk) brott.push(`\`${r.selektor}\` räknar fram en färg med ${funk[1]}(). Samma problem som ett hexvärde, bara svårare att söka efter.`);
}

if (brott.length > 0) {
  console.error(`check-slider: ${brott.length} brott\n`);
  for (const b of brott) console.error(`  ${b}`);
  console.error("\n  ⛔ Reglagets tumme och skena går bara att måla genom leverantörsspecifika");
  console.error("     pseudoelement. De finns inte som verktygsklasser, så de bor i tokens.css");
  console.error("     och ingen annanstans. Se bolag-ops#141.");
  process.exit(1);
}

console.log(`check-slider: ${regler.length} \`.ops-reglage\`-regler, tumme och skena målade ur tokens i båda motorerna`);
