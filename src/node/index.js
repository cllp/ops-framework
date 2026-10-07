/**
 * Ramverkets NODSIDA. Importeras som `ops-framework/node`.
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
 * ⛔ INBJUDAN OCH ACCEPTANS LIGGER BARA HÄR (#137). `memberships` skrivs aldrig
 * av en klient, alltså är en callable med Admin SDK det enda som kan skriva
 * dem. Låg funktionen i huvudingången vore den en yta en vy kunde anropa, och
 * då vore regeln `allow write: if false` en dörr med ett fönster bredvid.
 */
export { createInvitationService } from "./inbjudan.js";

/* Samma skäl som inbjudan: agentens medlemskap skrivs bara av servern (lifehub.app#47). */
export { createAgentService } from "./agent.js";

/*
 * ⛔ AGENTENS ID OCH MEDDELANDETS FORM ÄVEN HÄR (lifehub.app#47). Servern som svarar som agenten skriver ett vanligt
 * meddelande med `av` = agentens id. En kopia av `byggMeddelande` eller av id-formen i appens functions hade varit en
 * andra sanning om vad ett meddelande är, och huvudingången drar in React. Filerna är rena.
 */
export { AGENT_NAMN, agentId, agentMedlemskap } from "../lib/grupp.js";
export { byggMeddelande, samtalsnyckel, MAX_MEDDELANDE, autonamn, tradensNamn, rensaForNamn, NAMNLOS_TRAD, AGENTSTATUS_ID, AGENTLAGEN, AGENTSTATUS_MAX_ALDER, byggAgentstatus, agentenNamnd, namnda, arNamnd, NAMNER_ALLA, MAX_NAMNER } from "../lib/samtal.js";

/*
 * ⛔ SAMMA SKÄL SOM INBJUDAN OVAN (#161). Vitlistan nekar en klient allt
 * (`regelfragment()`, `allow read, write: if false`), så `skapaGrupp` MÅSTE
 * ligga bakom Admin SDK för att kunna kontrollera den alls.
 */
export { createGroupService } from "./grupp.js";

/*
 * ⛔ SAMMA SKÄL SOM INBJUDAN OVAN (#156). `memberships` skrivs aldrig av en
 * klient, alltså är `uppdateraProfil` (Admin SDK, skriver users OCH
 * memberships i samma steg) bara meningsfull härifrån.
 */
export { uppdateraProfil, bakfyllMedlemsnamn } from "./profil.js";

/*
 * ⛔ GRUPPENS EXTERNA DATAKÄLLOR PÅ NODSIDAN (0.46.0, cllp/bolag-ops#512). Appens funktion som skapar ett GitHub-ärende ska skicka det
 * till gruppens kopplade repo, och den måste läsa listan med SAMMA byggare som klienten och reglerna, inte en egen tolkning av ett
 * repo-namn. Ren funktion ur `lib/grupp.js`, som nodsidan redan importerar: inget nytt beroende, och `ops-framework` (två
 * sekunder vid kallstart) behövs inte för att läsa en lista.
 */
export { byggExternaDatakallor, MAX_EXTERNA } from "../lib/grupp.js";

/*
 * ⛔ PERSONEN PÅ NODSIDAN (0.53.0, cllp/lifehub.app#32). LifeHubs Identity äger personen och sparar den i en funktion, och
 * varje hubb speglar den vid inloggningen. Båda ska pröva den med SAMMA byggare som klienten läser med, annars glider
 * Identitys "giltig" och hubbens "giltig" isär. Ren funktion ur `lib/grupp.js`, ingen React.
 */
export { byggAnvandare, PROFILIKONER, PROFILFARGER, MAX_PRESENTATION } from "../lib/grupp.js";

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
 *   import("ops-framework/node")   ->     8 ms
 *   import("ops-framework")        ->  1946 ms
 *
 * Nästan två sekunder per kallstart, för att en funktion som skriver ETT
 * dokument skulle ladda React, Radix och en kalender. Det är inte en optimering
 * att slippa det, det är att inte göra något uppenbart fel.
 *
 * ⛔ FILEN ÄR REN. `src/lib/aktivitet.js` importerar sedan #158/#159-passet
 * `byggNamn` ur `src/lib/sprak.js` (för `ACTIVITY_SECTIONS`), en fil som i sin
 * tur importerar ingenting. Kedjan når alltså fortfarande aldrig React eller
 * Radix, vilket är det ENDA mätningen ovan handlar om. `scripts/check-node-side.mjs`
 * följer hela importgrafen från den här filen och kräver det, eftersom en
 * framtida import av React någonstans i kedjan hade gjort mätningen ovan osann
 * utan att någon märkte det.
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
export { FASER, AVSLUTADE_FASER, byggKategori, validateKatalog, valjbara, kategorin, arAvslutad, texten, katalognyckel, gruppensRader } from "../lib/katalog.js";
export { SPRAK, RESERVSPRAK, byggNamn, text, arGammalNamn, saknadeSprak } from "../lib/sprak.js";
export { KONFIGHANDELSER, KONFIGLOGGFALT, byggKonfigandring, beskrivKonfigandring, createConfigLog } from "../lib/konfiglogg.js";
export { kopplaBeteenden, beteendet } from "../lib/beteenden.js";
export { createCatalogSource } from "../data/katalogkalla.js";

/*
 * ⛔ SEEDNINGEN VID `skapaGrupp` (#161, #162). Samma skäl som `uppdateraProfil`
 * ovan: `skapaGrupp` kör med Admin SDK, utan skärm, och behöver kunna seeda
 * en nyskapad grupps kataloger utan att själv känna `createCatalogSource`s
 * konfiguration för var och en. Se `src/node/katalog.js` för signaturen och
 * ett användningsexempel.
 */
export { seedaKataloger } from "./katalog.js";

/*
 * ⛔ BAKFYLLNADEN (0.33.0, #162). Appens skript anropar den, med Admin SDK. Ramverket äger vad en
 * bakfylld rad är (nyckeln och formen), appen äger när den körs och med vilka standardvärden.
 */
export { bakfyllKatalogGrupp } from "./katalog.js";

/*
 * ⛔ `medlemsinfo` LIGGER I BÅDA INGÅNGARNA (0.32.0, #180 G2), av samma skäl som `createActivityLog`: kortets antal och avatarer härleds
 * ur medlemskapen, och det som svarar med dem utan skärm ska inte dra in React. Filen är ren.
 */
export { medlemsinfo } from "../lib/gruppmedlemmar.js";

/*
 * ⛔ GRUPPENS TYPER OCH TALK-TAKEN PÅ NODSIDAN (0.60.0, cllp/lifehub.app#37). Servern som gör ljud till ett förslag ska ge
 * modellen samma sorter som Nytt ärende visar, och pröva ljudet mot samma tak som inspelaren stoppar vid. Utan exporten
 * importerade lifehub `src/lib/modultyper.js` förbi exports-kartan, och skrev taket en gång till. Båda filerna är rena.
 */
export { typerForGrupp } from "../lib/modultyper.js";
export { MAX_SEKUNDER, LJUDFORMAT } from "../lib/talk.js";
export { personnamn, NAMN_SAKNAS } from "../lib/personnamn.js";
