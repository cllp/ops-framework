#!/usr/bin/env node
/**
 * Vakt: varje fabrik säger vad appen glömde, med sitt eget namn.
 *
 * ══ ⛔ VARFÖR VAKTEN FINNS ═══════════════════════════════════════════════
 *
 * Ramverket tar sin konfiguration av appen genom ett växande antal
 * `skapaNagot(konfig)`. Varje sådan fabrik kontrollerar sin konfiguration vid
 * uppstart, och skälet står i tre filers kommentarer: en halv konfiguration
 * kraschar annars först den dag någon råkar anropa just den metoden, och felet
 * pekar mot anropsstället i stället för mot uppsättningen.
 *
 * ⛔ DEN REGELN UPPRÄTTHÖLLS AV INGENTING. Den stod som text i tre filer, och
 * fyra av nio fabriker bröt mot den utan att någon sett det. De destrukturerade i
 * parameterlistan:
 *
 *   export function skapaFirestoreKalla({ db, sdk }) {
 *     if (!db) throw new Error("skapaFirestoreKalla: db krävs. ...");
 *
 * Valideringen var utmärkt och hann aldrig tala. Ett anrop utan argument dog på
 * destrukturen med "Cannot destructure property 'db' of 'undefined'", alltså ett
 * fel som nämner en variabel inne i ramverket och inte vad appen glömde.
 *
 * ══ ⛔ VAD DEN MÄTER, OCH VARFÖR NAMNET ÄR NYCKELN ═══════════════════════
 *
 * Vakten ANROPAR varje fabrik utan argument och kräver att felet innehåller
 * fabrikens eget namn. Det kravet är precis vad som skiljer de två fallen:
 *
 *   "skapaFirestoreKalla: db krävs. Skicka in ..."     namnger sig, alltså vårt
 *   "Cannot destructure property 'db' of 'undefined'"  gör det inte
 *
 * Ett krav på "kastar något" hade varit grönt för båda, och det farliga är just
 * att det andra ÄR ett kast. Det ser ut som en kontroll och är en krasch.
 *
 * ══ ⛔ REGISTRET ÄR EN LISTA NÅGON MÅSTE FYLLA I ════════════════════════
 *
 * Alla fabriker kräver inte konfiguration. `skapaMinneskalla()` utan argument är
 * en tom lagring, vilket är ett giltigt och användbart svar. Vakten kan därför
 * inte kräva ett kast av alla.
 *
 * Den kan däremot kräva att varje fabrik är KLASSIFICERAD. En ny fabrik som ingen
 * tagit ställning till gör bygget rött, i stället för att tyst hamna utanför. Samma
 * mönster som destinationslistorna i bolag-ops: att glömma blir rött, inte tyst.
 *
 * Kör: node scripts/check-config-requirements.mjs
 */

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Fabriker som klarar sig utan konfiguration, med skälet.
 *
 * ⛔ SKÄLET STÅR MED, inte bara namnet. En rad utan skäl är en rad nästa person
 * lägger till sin egen under, och listan blir en undantagshink.
 */
const KLARAR_UTAN = {
  createMemorySource: "utan argument är en tom lagring, vilket är giltigt och används av varje prov",
};

const misslyckanden = [];

/*
 * ⛔ LÄSER BUNDLEN OCH INTE KÄLLAN, för webbsidan. `src/index.js` når `.jsx`, och
 * Node kan inte importera JSX. Bundlen byggs av `npm run build`, som kör före den
 * här vakten i `npm run check`.
 *
 * Nodsidan läses som källa, eftersom den avsiktligt inte buntas.
 *
 * ⛔ MODULERNA GÅR ATT PEKA OM, OCH DET ÄR INTE EN BEKVÄMLIGHET. Utan argument kan
 * vakten bara köras mot ramverket som det råkar se ut, alltså grönt, och då går det
 * inte att plantera ett brott och se den falla. `scripts/test-guards.mjs` pekar den
 * mot små fixturmoduler. En vakt ingen sett falla är en förhoppning.
 */
const moduler = process.argv.slice(2);
const vagar = moduler.length > 0 ? moduler : [path.join(rot, "dist", "index.js"), path.join(rot, "src", "node", "index.js")];

/** @type {Record<string, any>} */
const alla = {};
for (const vag of vagar) {
  try {
    Object.assign(alla, await import(path.resolve(vag)));
  } catch (e) {
    console.error(`check-config-requirements: kunde inte importera ${vag}. Fel sökväg i vakten, inte ett godkänt utfall.`);
    console.error(`  ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}

const fabriker = Object.keys(alla)
  /*
   * ⛔ PREFIXET ÄR "create" SEDAN NAMNBYTET TILL ENGELSKA, och vakten hittade
   * noll fabriker tills det ändrades. Att den sade ifrån i stället för att bli
   * grön på en tom lista är precis vad den finns för: en vakt som blir grön av
   * ingenting lovar ett skydd den inte ger.
   */
  .filter((namn) => namn.startsWith("create") && typeof alla[namn] === "function")
  .sort();

if (fabriker.length === 0) {
  console.error("check-config-requirements: hittade noll fabriker. En tom lista gör vakten grön av fel skäl, alltså är den ett fel i sig.");
  process.exit(1);
}

for (const namn of fabriker) {
  const klararUtan = Object.prototype.hasOwnProperty.call(KLARAR_UTAN, namn);

  let kastade = null;
  try {
    alla[namn]();
  } catch (e) {
    kastade = e instanceof Error ? e.message : String(e);
  }

  if (klararUtan) {
    if (kastade !== null) {
      misslyckanden.push({
        namn,
        varfor: `står i KLARAR_UTAN ("${KLARAR_UTAN[namn]}") men kastade ändå: ${kastade.slice(0, 120)}`,
        atgard: "Antingen är klassificeringen fel, eller så har fabriken fått ett krav som registret inte känner till.",
      });
    }
    continue;
  }

  if (kastade === null) {
    misslyckanden.push({
      namn,
      varfor: "tog emot en tom konfiguration utan att säga ifrån",
      atgard:
        "Kontrollera konfigurationen vid uppstart, eller lägg fabriken i KLARAR_UTAN med ett skäl. " +
        "En halv konfiguration kraschar annars först den dag någon anropar just den metoden.",
    });
    continue;
  }

  if (!kastade.includes(namn)) {
    misslyckanden.push({
      namn,
      varfor: `kastade, men felet nämner inte fabriken: "${kastade.slice(0, 90)}"`,
      atgard:
        "Ser felet ut som 'Cannot destructure property' ligger destruktureringen i parameterlistan och " +
        "hinner före valideringen. Flytta den till kroppen: `function f(konfig) { const { x } = konfig ?? {}; }`. " +
        "Behåll den strikta typen i @param, annars tappar en typad anropare sitt kompileringsfel.",
    });
  }
}

if (misslyckanden.length > 0) {
  console.error("check-config-requirements: fabriker som inte säger vad appen glömde\n");
  for (const m of misslyckanden) {
    console.error(`  ${m.namn}`);
    console.error(`    ${m.varfor}`);
    console.error(`    ${m.atgard}\n`);
  }
  process.exit(1);
}

const kravande = fabriker.length - Object.keys(KLARAR_UTAN).length;
console.log(
  `check-config-requirements: ${fabriker.length} fabriker klassificerade, ${kravande} namnger sig vid tom konfiguration`,
);
