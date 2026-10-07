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
import { mejlregelfragment } from "../src/lib/mejl.js";
import { gruppadSamling, handelseregelfragment, kalenderregelfragment, katalogregelfragment, konfigloggregelfragment, regelfragment, samtalsregelfragment } from "../src/lib/regler.js";

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
 * ⛔ `konfiglogg` ÄR RAMVERKETS FRAGMENT FÖR ÄNDRINGSLOGGEN (0.39.0, #188), med samlingsnamnet som en app skickar in det.
 *
 * ⛔ `samtal` MED FÖRVALDA NAMN (0.34.0): samma skäl, det är `samtalsregelfragment()` som provas. `tradar` (0.68.0) skickas UTTRYCKLIGEN: den har inget förval.
 *   Samma sak för chattens nattskiva (#273): `status` och de undersamlingar och fält som följer, alla uttryckligen påslagna, så att
 *   `rules/__tests__/chattnatt.test.mjs` mäter dem. Att de är AVSLAGNA utan nyckel mäts byte för byte i jsdom-proven.
 *
 * ⛔ KALENDRARNA MED FÖRVALDA NAMN (0.36.0, #179 F0): `kalenderregelfragment()`, alltså `gruppkalendrar`,
 * `users/{uid}/minaKalendrar` och `users/{uid}/kalenderposter`.
 *
 * ⛔ HÄNDELSEMODELLEN MED FÖRVALDA NAMN (0.37.0, #179 F3): `handelseregelfragment()`, alltså svaren under
 * `handelser/{hid}/svar/{uid}`. `kalhandelser` är en påhittad APP-samling vars block är skrivet som en app skriver sitt:
 * handskrivet, med ramverkets `opsHandelsefaltGiltiga` anropad. Det är den funktionen provet mäter, inte blocket runt den.
 *
 * ⛔ MEJLKÖN (0.74.0, #101): `mejlregelfragment("mejl")`. Samlingsnamnet är påhittat, som appens. Provet som
 * mäter att en klient inte skriver ligger i `rules/__tests__/mejl.test.mjs` och bygger sina egna regler ur samma
 * funktion, med en öppen samling bredvid, så att ett nej går att skilja från en emulator som nekar allt.
 */
const text = `rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

${regelfragment()}
${gruppadSamling("handelser")}
${gruppadSamling("konfig", { agareKravsForSkrivning: true })}
${katalogregelfragment("kataloger")}
${konfigloggregelfragment("konfiglogg")}
${samtalsregelfragment({ tradar: "tradar", status: "status", reaktioner: "reaktioner", omnamnanden: true, citat: true, fasta: "fasta" })}
${kalenderregelfragment()}
${handelseregelfragment()}
${mejlregelfragment("mejl")}
    // Påhittad app-samling (se filhuvudet): appens eget block, med ramverkets fält prövade av opsHandelsefaltGiltiga.
    match /kalhandelser/{id} {
      allow read: if opsArMedlem(resource.data.groupId);
      allow create: if opsArMedlem(request.resource.data.groupId)
        && opsHandelsefaltGiltiga(request.resource.data, {});
      allow update: if opsArMedlem(resource.data.groupId)
        && request.resource.data.groupId == resource.data.groupId
        && opsHandelsefaltGiltiga(request.resource.data, resource.data);
      allow delete: if false;
    }
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
