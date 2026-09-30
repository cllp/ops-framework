#!/usr/bin/env node
/**
 * Skriver provreglerna ur regelfragmentet, inför emulatorkörningen.
 *
 * ⛔ GENERERAD OCH ALDRIG HANDSKRIVEN. Provas en handskriven kopia av reglerna
 * bevisar proven att någon skrev rätt en gång, inte att `regelfragment()` gör
 * det. Det är samma falska grönhet som arbetsreglernas "tautologisk lista":
 * provet kan inte faila på det det finns för att fånga.
 *
 * ⛔ FILEN ÄR GIT-IGNORERAD. Två sanningar om samma regeltext, en genererad och
 * en committad, glider isär i samma sekund som någon rättar den incheckade.
 *
 * Kör: node scripts/skriv-provregler.mjs
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { gruppadSamling, katalogregelfragment, regelfragment, samtalsregelfragment } from "../src/lib/regler.js";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ut = path.join(rot, "rules", "provregler.rules");

/*
 * ⛔ `handelser` OCH `konfig` ÄR PÅHITTADE APP-SAMLINGAR, med flit. Ramverket
 * äger dem inte, och det är just det proven ska visa: samma fragment skyddar en
 * samling ramverket aldrig hört talas om. `konfig` kräver ägare, så skillnaden
 * mellan de två skrivvillkoren också blir mätt.
 *
 * ⛔ `kataloger` ÄR RAMVERKETS EGET FRAGMENT (#162), INTE `gruppadSamling`
 * direkt: `katalogregelfragment` är den funktion en app faktiskt limmar in,
 * och provet ska mäta DEN, inte mönstret den råkar bygga på.
 *
 * ⛔ `samtal` MED FÖRVALDA NAMN (0.34.0): samma skäl, det är `samtalsregelfragment()` som provas.
 */
const text = `rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

${regelfragment()}
${gruppadSamling("handelser")}
${gruppadSamling("konfig", { agareKravsForSkrivning: true })}
${katalogregelfragment("kataloger")}
${samtalsregelfragment()}
    // ⛔ Catch-all sist, och den nekar. En samling utan block ska falla här och
    // inte råka ärva någon annans villkor.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
`;

fs.mkdirSync(path.dirname(ut), { recursive: true });
fs.writeFileSync(ut, text, "utf8");
console.log(`skriv-provregler: ${path.relative(rot, ut)}, ${text.split("\n").length} rader`);
process.exit(0);
