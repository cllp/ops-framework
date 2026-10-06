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
 * ⛔ #157, CP 2026-09-28: typsnittet bytte namn från Inter till Plus Jakarta
 * Sans (samma orsak som ursprungstexten nedan syftar på), och vakten bytte med.
 * Mekaniken den provar är oförändrad: det spelar ingen roll VILKET typsnitt som
 * hämtas fel, bara att hämtningen sker på rätt ställe.
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
 * Kör: node scripts/check-fonts.mjs
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
if (!/<link[^>]+fonts\.googleapis\.com\/css2[^>]*Plus\+Jakarta\+Sans/i.test(mall)) {
  fel.push(
    `${mallRad} saknar <link rel="stylesheet"> för Plus Jakarta Sans.\n` +
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

// ── 4. Ett SJÄLVVÄRDAT typsnitt (0.31.0): filen finns och licensen följer med ──
//
// ⛔ Märket ritas i Glacial Indifference, som paketeras i ramverket
// (`fonts/glacial-indifference/`, SIL Open Font License 1.1). OFL tillåter det på
// ett villkor: licenstexten ska följa med varje kopia. Två saker kan därför gå
// tyst fel, och båda är kontrollerade här:
//   a. `@font-face` pekar på en fil som inte finns. Bygget säger inget, märket
//      ritas i reservtypsnittet och ser nästan rätt ut.
//   b. Filen finns men licensen har försvunnit ur mappen. Ramverket distribuerar
//      då ett typsnitt utan sin licens, vilket OFL inte medger.
// Ett typsnitt utan licensfil fälls alltså, ett med licensfil godtas.
//
// ⛔ GOLV: minst en `@font-face`. En vakt som blir grön av att ingen regel hittades
// har inte mätt något (arbetsreglernas punkt 4, "tomt underlag").
//
// ⛔ EN APP BÄR INGEN EGEN @font-face, DEN ÄRVER RAMVERKETS. Appens stilrot
// (`create-ops-app`-mallen, bolag-ops) har bara `@import "ops-framework/tokens.css"`,
// och det är där regeln står. Att kräva den i appens egen fil fällde scaffold-jobbet
// i PR 176 på en app som ritade märket rätt. Vakten följer därför importen till
// ramverkets tokens.css och mäter regeln där den faktiskt bor, och golvet gäller
// summan: en app som varken har en egen regel eller importerar ramverkets fälls.
const kallor = [{ fil: tokenfil, text: tokenUtanKommentarer }];
if (tokenfil !== path.join(rot, "tokens", "tokens.css") && /@import\s+["']ops-framework\/tokens\.css["']/.test(tokenUtanKommentarer)) {
  const ramverkets = path.join(rot, "tokens", "tokens.css");
  kallor.push({ fil: ramverkets, text: fs.readFileSync(ramverkets, "utf8").replace(/\/\*[\s\S]*?\*\//g, "") });
}
const fontRegler = kallor.flatMap(({ fil, text }) =>
  [...text.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => ({ regel: m[1], dir: path.dirname(fil) })),
);
if (fontRegler.length < 1) {
  fel.push(`${path.relative(rot, tokenfil)} har ingen @font-face och importerar inte ramverkets tokens.css. Märket (font-marke) hade ritats i reservtypsnittet. Väntat minst 1 regel, hittade ${fontRegler.length}.`);
}
for (const { regel, dir: tokenDir } of fontRegler) {
  const familj = regel.match(/font-family:\s*['"]?([^'";]+)['"]?/)?.[1]?.trim() ?? "(okänd familj)";
  const url = regel.match(/url\(\s*["']?([^"')]+)["']?\s*\)/)?.[1];
  if (!url) {
    fel.push(`@font-face för ${familj} saknar url(). Ett typsnitt utan fil är ett namn utan innehåll.`);
    continue;
  }
  if (/^https?:|^data:/.test(url)) continue;
  const fil = path.resolve(tokenDir, url);
  if (!fs.existsSync(fil)) {
    fel.push(`@font-face för ${familj} pekar på ${url}, men filen finns inte (${path.relative(rot, fil)}). Märket ritas i reservtypsnittet utan felmeddelande.`);
    continue;
  }
  const mapp = path.dirname(fil);
  const licens = fs.readdirSync(mapp).filter((f) => /^(licen[sc]e|ofl|copying)/i.test(f) && fs.statSync(path.join(mapp, f)).size > 500);
  if (licens.length === 0) {
    fel.push(
      `${familj} (${path.relative(rot, fil)}) saknar licensfil i sin mapp. Ett typsnitt som paketeras måste ha sin licens bredvid sig ` +
        "(SIL Open Font License kräver det). Lägg LICENSE.txt i samma mapp, tas den bort fälls bygget.",
    );
  }
}

if (fel.length > 0) {
  console.error("check-fonts: FEL\n");
  for (const f of fel) console.error(`  - ${f}\n`);
  process.exit(1);
}

console.log(`check-fonts: Plus Jakarta Sans hämtas med <link> i mallen (ingen @import som ignoreras), och ${fontRegler.length} självvärdat typsnitt har sin fil och sin licens.`);
