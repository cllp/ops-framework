#!/usr/bin/env node
/**
 * Vakt: en vy ritar aldrig vem som skrev något utan att gå genom `skaparensNamn` / `namnMedVia` (0.135.0, cllp/lifehub.app#409).
 *
 * ══ ⛔ VARFÖR (CP 2026-10-21, "Ja på alla") ═══════════════════════════════════════════════════════════
 *
 * En personlig API-nyckel skriver SOM personen: raden bär personens uid och namn. Det som gör att en läsare ändå kan se skillnad på
 * "Miranda skrev det" och "Miranda skrev det via Byggagent" är `skapadAv.via`, och märket syns bara om VARJE vy som ritar en
 * skapare ritar det. En vy som skriver `skapadAv.namn` rakt av visar raden som personens egen. Det är samma fel som uid:t i
 * en lista (0.40.1): en enda vy som hoppar över det gemensamma stället räcker för att märket saknas just där någon tittar.
 * Därför finns det EN funktion som sätter ihop texten (`namnMedVia`, ordet "via" ur textlagret), och den här vakten blir röd
 * när en vy ritar namnet vid sidan av den.
 *
 * ══ ⛔ TRE KRAV, OCH ALLA TRE MÅSTE HÅLLA ═════════════════════════════════════════════════════════════
 *
 *   1. INGEN VY LÄSER `skapadAv.namn` RAKT AV. (`skapadAv?.namn`, `skapadAv.namn`, `skapadAv?.["namn"]`.) Kommentarer räknas inte.
 *   2. VARJE VY SOM RITAR EN SKAPARE ANROPAR FUNKTIONEN. `VYER` listar dem, med skälet. En vy som slutar anropa den (en
 *      omskrivning som lägger tillbaka `.namn`, eller en vy som tas bort ur listan) gör vakten röd, och det är därför listan
 *      är ett krav och inte en kopia av vad som råkar finnas: den kan inte bli grön av att inget hittas.
 *   3. CHATTEN: `OpsMeddelanden` ritar avsändaren ur `namnFor(<meddelande>.av)`, inte ur `skapadAv`. Den får bara göra det
 *      `TAK_CHATT` gånger, och det är de ställen som medvetet ritar PERSONEN utan märket (avatar, initialer, jämförelsen mot
 *      NAMN_SAKNAS). Allt som ritar en text någon läser går genom `avNamnFor`. ⛔ Taket får bara sjunka (arbetsreglernas punkt 4):
 *      ett nytt ställe som ritar ett namn rakt av ger rött, och svaret är `avNamnFor`, inte ett högre tak.
 *
 * ══ ⛔ DET SOM MEDVETET INTE ÄR MED, OCH VARFÖR ═══════════════════════════════════════════════════════
 *
 *   - Gästvyerna (`OpsGastChatt`, `OpsGastArenden`, `OpsGastGrupp`): de ritar DTO:er som `node/gast.js` släpper ut ur en vitlista, och
 *     där finns ingen `via`. En gäst ser personens namn. Att släppa ut nyckelns namn till en gäst är ett eget beslut (vad en gäst
 *     får veta), inte en följd av den här ändringen. Ett ändrat beslut lägger till ett fält i vitlistan och tar vyn in i `VYER`.
 *   - `OpsMinne` (`lyftAv`): minnet lyfts av en person i appen, aldrig av en nyckel. Regeln nekar `via` där och `minnesradFel` avvisar det.
 *   - Utskriftsjobbets `av` i `OpsBibliotek`: vem som STARTADE en utskrift, inte vem som skrev posten.
 *
 * GOLV: minst 90 komponentfiler lästa och alla `VYER` funna. En vakt som blir grön av att inget lästes mäter ingenting.
 *
 * Kör: node scripts/check-skaparnamn.mjs [mapp med .jsx-filer]
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Vyerna som ritar en skapare, och vad de ritar. Varje fil MÅSTE anropa `skaparensNamn(` eller `namnMedVia(`. */
export const VYER = /** @type {const} */ ([
  ["Ursprungsrad.jsx", "Skapad av ... på händelser och ärenden (OpsHandelsePanel, OpsEventList)"],
  ["OpsBibliotek.jsx", "Skriven av ... i en posts detalj"],
  ["OpsBeskrivenApp.jsx", "Skapad av ... på en rad i en beskriven app"],
  ["OpsKommentarer.jsx", "Namnet på en kommentar"],
  ["OpsMeddelanden.jsx", "Avsändaren på ett chattmeddelande (via ligger på meddelandet)"],
  ["OpsKatalogInstallning.jsx", "Vem som ändrade i konfigurationens logg (av)"],
]);

/** Hur många gånger `OpsMeddelanden` får skriva `namnFor(x.av)` rakt av. ⛔ FÅR BARA SJUNKA. */
export const TAK_CHATT = 2;
const GOLV_FILER = 90;

const KRAV_ANROP = /\b(?:skaparensNamn|namnMedVia)\(/;
const RAKT_AV = /\bskapadAv\s*(?:\?\.|\.)\s*namn\b|\bskapadAv\s*\??\.?\s*\[\s*["']namn["']\s*\]/;
const CHATT_RAKT_AV = /\bnamnFor\(\s*\w+\.av\s*\)/g;

/** Koden utan kommentarer: blockkommentarer, och rad- och slutkommentarer (men inte `//` i en adress). Radbrytningarna blir kvar, så att radnumren stämmer. */
export function utanKommentarer(/** @type {string} */ kod) {
  return kod.replace(/\/\*[\s\S]*?\*\//g, (/** @type {string} */ m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:\w"'`])\/\/.*$/gm, "$1");
}

/**
 * @param {Record<string, string>} filer Filnamn till innehåll, bara .jsx-filerna i komponentmappen.
 * @returns {string[]} Felen. Tom lista är grönt.
 */
export function kontrollera(filer) {
  /** @type {string[]} */
  const fel = [];
  const namn = Object.keys(filer);
  if (namn.length < GOLV_FILER) {
    fel.push(`Bara ${namn.length} komponentfiler lästes, golvet är ${GOLV_FILER}. En vakt utan underlag mäter ingenting.`);
    return fel;
  }
  /** @type {Record<string, string>} */
  const kod = {};
  for (const [f, text] of Object.entries(filer)) kod[f] = utanKommentarer(text);

  for (const [f, text] of Object.entries(kod)) {
    const rader = text.split("\n");
    rader.forEach((rad, i) => {
      if (RAKT_AV.test(rad)) fel.push(`${f}:${i + 1} ritar skapadAv.namn rakt av. Gå genom skaparensNamn(skapadAv, sprak) eller namnMedVia(namn, skapadAv?.via, sprak), annars saknas "via Nyckeln" på rader som en API-nyckel skrev.`);
    });
  }

  for (const [f, vad] of VYER) {
    if (!(f in kod)) fel.push(`${f} finns inte bland komponenterna. Den ritar: ${vad}. Flyttades den, uppdatera VYER; togs den bort, ta bort raden med skälet.`);
    else if (!KRAV_ANROP.test(kod[f])) fel.push(`${f} anropar varken skaparensNamn( eller namnMedVia(. Den ritar: ${vad}.`);
  }

  if ("OpsMeddelanden.jsx" in kod) {
    const antal = (kod["OpsMeddelanden.jsx"].match(CHATT_RAKT_AV) ?? []).length;
    if (antal > TAK_CHATT) fel.push(`OpsMeddelanden.jsx skriver namnFor(<meddelande>.av) rakt av ${antal} gånger, taket är ${TAK_CHATT}. Allt som ritar en text går genom avNamnFor, så att meddelandets via följer med.`);
  }
  return fel;
}

function main() {
  const mapp = path.resolve(rot, process.argv[2] ?? path.join("src", "components"));
  if (!fs.existsSync(mapp)) {
    console.error(`check-skaparnamn: hittar inte ${path.relative(rot, mapp)}. Vakten mäter ingenting mot en mapp som inte finns.`);
    process.exit(1);
  }
  /** @type {Record<string, string>} */
  const filer = {};
  for (const f of fs.readdirSync(mapp).filter((n) => n.endsWith(".jsx"))) filer[f] = fs.readFileSync(path.join(mapp, f), "utf8");
  const fel = kontrollera(filer);
  if (fel.length > 0) {
    console.error(`check-skaparnamn: RÖTT. ${fel.length} fel.`);
    for (const f of fel) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log(`check-skaparnamn: ${Object.keys(filer).length} komponentfiler lästa, ${VYER.length} vyer som ritar en skapare anropar skaparensNamn eller namnMedVia, ingen läser skapadAv.namn rakt av, chatten har högst ${TAK_CHATT} direkta namn.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
