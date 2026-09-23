/**
 * Ramverkets NODSIDA. Importeras som `@staiger/ops-framework/nod`.
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
