#!/usr/bin/env node
/**
 * Vakt: allt som är publikt är också dokumenterat.
 *
 * ⛔ Frågan "har du dokumenterat allt?" ska inte besvaras av en människa som
 * minns, och inte av en agent som tror. Den ska besvaras av en körning.
 *
 * Skälet är att dokumentation ruttnar tyst. En ny primitiv läggs till, README
 * uppdateras inte, och sex månader senare beskriver dokumentet ett ramverk som
 * inte längre är det som finns. Då är dokumentet sämre än inget dokument, för
 * det ser fortfarande auktoritativt ut och ingen tänker kontrollera det.
 *
 * Vakten är avsiktligt grov: den kräver att varje exporterat namn NÄMNS i
 * README. Den kan inte avgöra om texten är begriplig eller sann, bara att den
 * finns. Det är allt en maskin kan göra här, och det räcker för att fånga det
 * som faktiskt händer: att någon glömmer.
 *
 * Kör: node scripts/check-docs.mjs
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readme = fs.readFileSync(path.join(rot, "README.md"), "utf8");
const indexfil = fs.readFileSync(path.join(rot, "src", "index.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** @type {string[]} */
const utlovade = [];
for (const m of indexfil.matchAll(/export\s*\{([^}]*)\}/g)) {
  for (const del of m[1].split(",")) {
    const namn = del.trim().split(/\s+as\s+/).pop()?.trim();
    if (namn) utlovade.push(namn);
  }
}

// ⛔ Aven direktdeklarerade exporter. Forsta versionen last bara `export { ... }`,
// och ett `export const X` i index.js hade darfor varit osynligt for vakten.
// Mutationsharnesset hittade det direkt, vilket ar precis dess uppgift.
for (const m of indexfil.matchAll(/export\s+(?:const|let|var|function|class)\s+([A-Za-z0-9_$]+)/g)) {
  utlovade.push(m[1]);
}

// ── Golv: läste vakten inga exporter är det fel fil, inte ett tomt API ──────
if (utlovade.length < 15) {
  console.error(`check-docs: bara ${utlovade.length} exporter lästes ur src/index.js. Fel fil, eller en trasig.`);
  process.exit(1);
}

/** @type {string[]} */
const brott = [];

for (const namn of utlovade) {
  if (!readme.includes(namn)) {
    brott.push(`${namn} är exporterad men nämns inte i README. Det som inte står där finns inte för den som ska använda ramverket.`);
  }
}

// ── Vakterna ska också stå i README, av samma skäl ──────────────────────────
//
// ⛔ `test-` RÄKNAS OCKSÅ, OCH DET ÄR EN RÄTTELSE. Filtret läste bara `check-`,
// så vakterna som PROVAR vakterna (`test-guards`, `test-viewport-guard`) kunde
// existera utan att stå någonstans. Just de är de som är lättast att missa, för
// ingen saknar dem i vardagen: de körs sällan och nämns aldrig i ett felmeddelande.
// `check-scaffold` levde nio dagar utanför både CI och `test-guards` av precis
// den anledningen.
const vakter = fs
  .readdirSync(path.join(rot, "scripts"))
  .filter((f) => (f.startsWith("check-") || f.startsWith("test-")) && f.endsWith(".mjs"))
  .map((f) => f.replace(/\.mjs$/, ""));

for (const vakt of vakter) {
  if (!readme.includes(vakt)) {
    brott.push(`Vakten ${vakt} finns men nämns inte i README. En vakt ingen vet om blir kringgången utan illvilja.`);
  }
}

// ── Avsnitt som måste finnas, inte bara namn som nämns ─────────────────────
//
// ⛔ ATT ETT NAMN NÄMNS ÄR INTE ATT KONTRAKTET ÄR BESKRIVET (#128). Vakten
// ovanför är nöjd så fort `defineModule` står någonstans i README, alltså även
// om det bara är i en tabellrad eller i en länk. Modulkontraktet är däremot det
// en modulbyggare ska kunna arbeta ur UTAN att öppna ramverkets källkod, och då
// räcker inte ett omnämnande.
//
// ⛔ OCH LISTAN ÄR EN LISTA MED FLIT. Nästa Fas 3-ärende (#129) fyller samma
// avsnitt med källornas form, och #131 lägger till exempelmodulen. En
// hårdkodad enstaka sträng hade blivit en rad någon kopierar i stället för en
// rad någon fyller på.
const AVSNITT = ["Modulkontraktet", "Grupper och medlemskap", "Inloggning och profil", "Felrapportering", "Navigationen", "Typografin"];

for (const avsnitt of AVSNITT) {
  if (!new RegExp(`^#{2,4} .*${avsnitt}`, "m").test(readme)) {
    brott.push(`README saknar ett avsnitt med rubriken "${avsnitt}". Att namnen nämns någonstans är inte samma sak som att kontraktet är beskrivet där någon hittar det.`);
  }
}

// ── Och antalet ska stämma ─────────────────────────────────────────────────
//
// ⛔ Den här kontrollen finns för att README påstod "femton komponenter" när
// det fanns tjugotre. En siffra i en text är ett påstående som åldras snabbast
// av allt, och den som läser har ingen anledning att misstro den.
const komponenter = utlovade.filter((n) => n.startsWith("Ops")).length;
const pastatt = readme.match(/\*\*(\d+) komponenter\.?\*\*/);
if (!pastatt) {
  brott.push('README saknar en rad på formen "**N komponenter**". Utan den kan antalet inte kontrolleras och hinner glida.');
} else if (Number(pastatt[1]) !== komponenter) {
  brott.push(`README påstår ${pastatt[1]} komponenter, men ${komponenter} exporteras. En siffra i en text åldras snabbast av allt.`);
}

// ── Sentry-ingången (#159), som utlovade INTE ser ───────────────────────────
//
// ⛔ `@staiger/ops-framework/sentry` ÄR EN EGEN INGÅNG, src/sentry.js, som
// varken ligger i src/index.js eller src/node/index.js. Ingen av de andra
// kontrollerna ovan ser den. Utan en egen rad hade den kunnat glömmas bort
// helt, dokumentationslöst, trots att den är en publik del av paketets API.
const SENTRY_STRANGAR = ["@staiger/ops-framework/sentry", "sentryMottagare", "felmottagare"];
for (const strang of SENTRY_STRANGAR) {
  if (!readme.includes(strang)) {
    brott.push(`README nämner inte "${strang}". Sentry-ingången (src/sentry.js, #159) syns inte i den andra kontrollen ovan: den ligger varken i src/index.js eller src/node/index.js.`);
  }
}

// ── Namnet är "OPS Hub", inte "Operations Hub" (#164) ────────────────────
//
// ⛔ CP döpte ramverkets exempelapp om, och "Operations Hub" är kvar på
// gamla ställen om ingen jagar det aktivt. En sträng i ett exempel är
// precis den sortens påstående som glider utan att bygget märker det,
// samma mekanism som komponent- och Sentry-kontrollerna ovan.
if (readme.includes("Operations Hub")) {
  brott.push('README nämner det gamla namnet "Operations Hub". #164 döpte det till "OPS Hub", byt varje förekomst.');
}

if (brott.length === 0) {
  console.log(`check-docs: ${utlovade.length} exporter och ${vakter.length} vakter, alla omnämnda i README`);
  process.exit(0);
}

console.error(`check-docs: ${brott.length} odokumenterade\n`);
for (const b of brott) console.error(`  ${b}`);
process.exit(1);
