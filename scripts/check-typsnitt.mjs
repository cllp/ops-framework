#!/usr/bin/env node
/**
 * Vakt: typsnittet hämtas där det faktiskt hämtas, och inte där det inte gör det.
 *
 * ── ⛔ FELET SOM GAV UPPHOV TILL VAKTEN ───────────────────────────────────
 *
 * Inter hämtades med `@import url(...)` överst i `tokens/tokens.css`, bredvid en
 * utförlig kommentar om varför ramverket och inte varje app skulle äga
 * hämtningen. Argumentet höll. Importen hämtade ingenting.
 *
 * En CSS-`@import` måste stå före alla andra regler, annars ignoreras den. Appens
 * stilrot börjar med `@import "tailwindcss"`, så när allt plattats ut låg
 * tusentals rader före vår rad. Bygget sade det rakt ut, som en varning bland
 * andra varningar:
 *
 *   @import rules must precede all rules aside from @charset and @layer
 *
 * ⛔ Följden var exakt det fel kommentaren påstod att den skyddade mot: en sida i
 * systemets typsnitt, som ser nästan rätt ut. Skillnaden mot att inte ha någon
 * kommentar alls var att ingen tittade efter, eftersom det redan stod att det var
 * löst.
 *
 * ── ⛔ VARFÖR EN VAKT I GRINDEN OCH INTE EN KONTROLL I KÖRTID ────────────
 *
 * Första lösningen var en `useEffect` i `OpsAppShell` som läste
 * `document.fonts.check` och varnade i utvecklingsläge. Den skrotades innan den
 * committades, av samma sort av skäl som den skulle vaka över:
 *
 *   - Den hade behövt `import.meta.env.DEV` för att inte skälla i produktion, och
 *     esbuild-bygget här ersätter inte den variabeln. Vad konsumentens Vite gör
 *     med den inuti en förbuntad `node_modules`-fil är inte något vi styr, alltså
 *     hade vakten kanske aldrig körts.
 *   - `document.fonts` rapporterar falskt negativt bakom en blockerad
 *     fontleverantör eller en strikt CSP, och då hade den skällt på en användare
 *     för något hen inte kan åtgärda.
 *
 * Det vill säga: en vakt vars egen körning är osäker är samma slags påstående som
 * den trasiga importen. Den här filen körs varje gång grinden körs, på samma sätt
 * varje gång, och kan inte sluta köra i tysthet.
 *
 * Kör: node scripts/check-typsnitt.mjs
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Går att peka om, så `test-guards.mjs` kan mata in en trasig kopia. */
const tokenfil = process.argv[2] ? path.resolve(process.argv[2]) : path.join(rot, "tokens", "tokens.css");
const mallfil = process.argv[3] ? path.resolve(process.argv[3]) : path.join(rot, "create-ops-app", "template", "index.html");

const fel = [];

// ── 1. Tokenfilen får inte hämta typsnitt ────────────────────────────────
// Kommentarer räknas inte: filen FÅR och SKA berätta historien i klartext.
// Därför strippas de innan raden letas efter.
const token = fs.readFileSync(tokenfil, "utf8");
const tokenUtanKommentarer = token.replace(/\/\*[\s\S]*?\*\//g, "");
const fontImport = tokenUtanKommentarer.match(/@import\s+url\([^)]*fonts\.googleapis[^)]*\)/i);
if (fontImport) {
  fel.push(
    `${path.relative(rot, tokenfil)} hämtar typsnitt med @import (${fontImport[0].slice(0, 60)}...).\n` +
      "    Den raden ignoreras av webbläsaren, eftersom appens stilrot börjar med @import \"tailwindcss\"\n" +
      "    och en CSS-import som inte står först inte gäller. Sidan ritas då i systemets typsnitt.\n" +
      "    Lägg <link rel=\"stylesheet\"> i appens index.html i stället. Hela historien står i tokenfilen.",
  );
}

// ── 2. Mallen måste hämta det, annars ärver ingen ny plattform typsnittet ──
const mall = fs.readFileSync(mallfil, "utf8");
const mallRad = path.relative(rot, mallfil);
if (!/<link[^>]+fonts\.googleapis\.com\/css2[^>]*Inter/i.test(mall)) {
  fel.push(
    `${mallRad} saknar <link rel="stylesheet"> för Inter.\n` +
      "    En ny plattform hade då ritats i systemets typsnitt från första minuten, utan felmeddelande.",
  );
}
// ⛔ preconnect mot gstatic MÅSTE bära crossorigin. Fontfiler hämtas anonymt, så
// utan attributet öppnas anslutningen en andra gång och förhämtningen blir ren
// kostnad. Det är den sortens fel som ser ut som en optimering i koden.
if (!/<link[^>]+rel="preconnect"[^>]+fonts\.gstatic\.com[^>]*crossorigin/i.test(mall)) {
  fel.push(
    `${mallRad} har preconnect mot fonts.gstatic.com utan crossorigin, eller saknar den helt.\n` +
      "    Utan crossorigin öppnas anslutningen en andra gång när fontfilen hämtas, och förhämtningen\n" +
      "    blir en kostnad utan nytta i stället för en besparing.",
  );
}

// ── 3. Vikterna ska matcha vad komponenterna ritar ───────────────────────
if (!/wght@400;500;600;700/.test(mall)) {
  fel.push(`${mallRad} hämtar andra vikter än 400;500;600;700, som är de komponenterna använder.`);
}

if (fel.length > 0) {
  console.error("check-typsnitt: FEL\n");
  for (const f of fel) console.error(`  - ${f}\n`);
  process.exit(1);
}

console.log("check-typsnitt: typsnittet hämtas med <link> i mallen, inte med en @import som ignoreras.");
