/**
 * Ramverkets NODSIDA. Importeras som `@staiger/ops-framework/node`.
 *
 * ══ ⛔ VARFÖR EN ANDRA INGÅNG, OCH NÄR NÅGOT FÅR LIGGA HÄR ═══════════════
 *
 * Huvudingången (`src/index.js`) buntas för webbläsaren. Allt som når den hamnar
 * i varje besökares JS-fil. Det är rätt för komponenter och för datakontraktet,
 * och fel för allt som hanterar en hemlighet.
 *
 * ⛔ REGELN, I EN MENING: hit hör det som behöver en token, en filsökväg eller
 * ett nätanrop mot ett system som kräver autentisering som inte är användarens
 * egen. Allt annat hör i huvudingången, där vakterna för stängt API och datalager
 * redan gäller.
 *
 * ⛔ GRÄNSEN ÄR EN VAKT. `scripts/check-nodsida.mjs` gör det till rött bygge om
 * något under `src/` utanför `src/node/` importerar härifrån, och kräver dessutom
 * att varje export här nämns i README. Utan det första vore gränsen ett löfte om
 * att en hemlighet inte läcker, alltså värt vad den som bryter det råkar minnas.
 * Utan det andra hade ramverket fått en publik yta som dokumentationsvakten inte
 * ser, vilket är precis det hål den finns för.
 *
 * ⛔ INGEN BUNDLE OCH INGET BYGGSTEG. Filerna här är ren ESM utan JSX och
 * importeras direkt av Node. Ett byggsteg hade gett en andra artefakt att hålla i
 * synk med källan, för noll vinst: Node läser ESM som det är.
 */

export { createCaseMirror } from "./caseMirror.js";
export { createActivityWriter } from "./aktivitet.js";

/*
 * ⛔ `createActivityLog` ÅTEREXPORTERAS HÄRIFRÅN, OCH DET ÄR EN MÄTNING OCH INTE
 * EN BEKVÄMLIGHET.
 *
 * `createActivityWriter` kräver en modell, alltså resultatet av
 * `createActivityLog`. Den låg bara i huvudingången, så ett Cloud Function som
 * ville skriva en rad i loggen tvingades importera hela webbuntlen.
 *
 * Mätt 2026-09-25, Node 20, paketet installerat ur den utgivna tarbollen:
 *
 *   import("@staiger/ops-framework/node")   ->     8 ms
 *   import("@staiger/ops-framework")        ->  1946 ms
 *
 * Nästan två sekunder per kallstart, för att en funktion som skriver ETT
 * dokument skulle ladda React, Radix och en kalender. Det är inte en optimering
 * att slippa det, det är att inte göra något uppenbart fel.
 *
 * ⛔ FILEN ÄR REN. `src/lib/aktivitet.js` importerar ingenting alls, så den här
 * raden drar inte in webbsidan bakvägen. Provet `nodsidan.test.js` kräver det,
 * eftersom en framtida import av React där hade gjort mätningen ovan osann utan
 * att någon märkte det.
 *
 * Bakgrund: cllp/ops-framework#93, functions i bolag-ops.
 */
export { createActivityLog } from "../lib/aktivitet.js";

/*
 * ⛔ SAMMA FYRA FUNKTIONER SOM I HUVUDINGÅNGEN, av samma skäl som
 * `createActivityLog` ovan: både klienten och det som körs utan skärm skriver
 * `skapadAv`, och två former av samma fält är precis det den här modulen finns
 * för att förhindra. Filen är ren, `check-node-side` kräver det.
 */
export { byggSkapare, laesSkapare, skaparensNamn, arGammalForm, SKAPARTYPER } from "../lib/skapare.js";

/*
 * ⛔ KATALOGEN OCH SPRÅKEN LIGGER I BÅDA INGÅNGARNA, av samma skäl som
 * `createActivityLog` ovan: konfigurationen läses både av klienten och av det
 * som körs utan skärm. Functions ska kunna fråga vilka sorter som finns utan
 * att dra in React (cllp/bolag-ops#385), och huvudingången kostar 1946 ms mot
 * nodsidans 8 ms, mätt i cllp/ops-framework#93.
 */
export { FASER, AVSLUTADE_FASER, byggKategori, validateKatalog, valjbara, kategorin, arAvslutad, texten } from "../lib/katalog.js";
export { SPRAK, RESERVSPRAK, byggNamn, text, arGammalNamn, saknadeSprak } from "../lib/sprak.js";
export { KONFIGHANDELSER, byggKonfigandring, beskrivKonfigandring, createConfigLog } from "../lib/konfiglogg.js";
export { kopplaBeteenden, beteendet } from "../lib/beteenden.js";
export { createCatalogSource } from "../data/katalogkalla.js";
