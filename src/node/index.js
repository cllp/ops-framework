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
// ⛔ Samma `buildEntry` som formuläret, på servern utan React (#279). `caseModel.js` importerar ingenting.
export { createCaseModel } from "../lib/caseModel.js";
export { createActivityWriter } from "./aktivitet.js";

/*
 * ⛔ INBJUDAN OCH ACCEPTANS LIGGER BARA HÄR (#137). `memberships` skrivs aldrig
 * av en klient, alltså är en callable med Admin SDK det enda som kan skriva
 * dem. Låg funktionen i huvudingången vore den en yta en vy kunde anropa, och
 * då vore regeln `allow write: if false` en dörr med ett fönster bredvid.
 */
export { createInvitationService, inbjudningsId } from "./inbjudan.js";

/* Samma skäl som inbjudan: agentens medlemskap skrivs bara av servern (lifehub.app#47). */
export { createAgentService } from "./agent.js";

/*
 * ⛔ STANDARDKALENDERN (0.120.0, cllp/lifehub.app#367). Engångssteget för grupper som redan finns skriver i gruppens samlingar med
 * Admin SDK, och raden är samma som `createGroupService` skriver vid skapandet. Konstanterna och byggaren hör till de rena filerna
 * och exporteras även här, så att en nodfunktion inte behöver dra in React för dem.
 */
export { createStandardkalenderService } from "./standardkalender.js";
export { STANDARDKALENDER_ID, STANDARDKALENDER_NAMN, standardGruppkalender } from "../lib/kalendrar.js";

/*
 * ⛔ STÄDNINGEN AV ETT OBJEKTS FILER (0.121.0 för en händelse, 0.122.0 för ett ärende, cllp/lifehub.app#366). Hård radering av en händelse eller ett
 * ärende med Admin SDK lämnar posterna på dess plats kvar. Tjänsten tar bort dem (torrt som förval) och rör aldrig bucketen. Platsen och dess uppslag hör till de rena filerna och exporteras
 * även här, så att en nodfunktion inte behöver dra in React för dem.
 */
export { createHandelsefilerService, createPlatsfilerService } from "./handelsefiler.js";
export { arDelbar } from "../lib/bibliotek.js";
export { handelseBibliotek, handelsedelar, arHandelseBibliotek, arendeBibliotek, arendedelar, arArendeBibliotek, arObjektbibliotek, gruppForPlats } from "../lib/bibliotek.js";

/*
 * ⛔ AGENTENS ID OCH MEDDELANDETS FORM ÄVEN HÄR (lifehub.app#47). Servern som svarar som agenten skriver ett vanligt
 * meddelande med `av` = agentens id. En kopia av `byggMeddelande` eller av id-formen i appens functions hade varit en
 * andra sanning om vad ett meddelande är, och huvudingången drar in React. Filerna är rena.
 */
export { AGENT_NAMN, agentId, agentMedlemskap } from "../lib/grupp.js";
export { byggMeddelande, samtalsnyckel, MAX_MEDDELANDE, autonamn, tradensNamn, rensaForNamn, NAMNLOS_TRAD, AGENTSTATUS_ID, AGENTLAGEN, AGENTSTATUS_MAX_ALDER, byggAgentstatus, agentenNamnd, namnda, arNamnd, NAMNER_ALLA, MAX_NAMNER, amnesId, parnyckel, kravAmnesrubrik, amnesrubrik, MAX_AMNESRUBRIK, byggArendemottagare, ARENDEMOTTAGARSLAG } from "../lib/samtal.js";

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
export { byggSkapare, laesSkapare, skaparensNamn, arGammalForm, SKAPARTYPER, namnMedVia, byggVia, viaFel, VIAFALT, MAX_NYCKELID, ORD_SKAPARE } from "../lib/skapare.js";

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
// ⛔ 0.105.0: förslagens form på serversidan också. Appens server bygger knapparna som `OpsMeddelanden` ritar, och prövar dem med samma
// funktion som komponenten, så att ett tak eller en ikon inte står på två ställen.
export { FORSLAG_IKONER, MAX_FORSLAG, MAX_FORSLAG_ETIKETT, MAX_FORSLAG_TEXT, forslagetsFel, kontrolleraForslag } from "../lib/forslag.js";
export { personnamn, NAMN_SAKNAS } from "../lib/personnamn.js";

/*
 * ⛔ MEJL (0.76.0, ops-framework#101, lifehub.app#103 lane 18A). Kön bär andras
 * adresser, och utskicket bär en hemlighet. Båda ligger här, inte i webbundlen.
 * Appen skickar in samlingsnamn, SMTP och avsändare. Modulen läser inga
 * hemligheter, varken vid laddning eller senare: funktionen gör det och skickar
 * in auth. Regelfragmentet nekar klienten både läsning och skrivning.
 */
export {
  SPARRADA_MEJLDOMANER,
  byggMejl,
  byggMejlhandelse,
  createMailQueue,
  createMailSender,
  createMockMailTransport,
  createNodemailerTransport,
  losMejlsprak,
  mejlregelfragment,
  normaliseraMejlsprak,
} from "./mejl.js";

/*
 * ⛔ BESKRIVNA APPAR PÅ NODSIDAN (0.99.0, beslut 0005, lifehub.app#213). Agentens verktyg `skapaApp` bygger en beskrivning på servern, och den ska
 * prövas med SAMMA funktion som klienten läser med, så att "giltig" inte kan betyda två saker. Felen är skrivna för en agent som rättar sig efter
 * dem. `byggBeskrivningsdokument` ger dokumentet och dess id för Admin SDK: formen finns på ett ställe. Filen är ren.
 */
export {
  BESKRIVNINGSFORMAT, FALTTYPER, VISNINGAR, BESKRIVNINGSIDFORM, MAX_BESKRIVNINGSNAMN, MAX_APPBESKRIVNING, MIN_LISTOR, MAX_LISTOR, MIN_FALT, MAX_FALT, MIN_VAL, MAX_VAL, MAX_VALTEXT,
  MAX_TEXTVARDE, MAX_LANGTEXTVARDE, MAX_LANKVARDE, BESKRIVNINGSFALT, LISTFALT, FALTFALT, BESKRIVENAPPDATAFALT, BESKRIVNINGSDOKUMENTFALT,
  validateBeskrivning, validateRad, beskrivningsId, byggBeskrivningsdokument,
} from "../lib/beskrivenapp.js";

/*
 * ⛔ PUBLIK DELNING AV EN BIBLIOTEKSFIL (0.119.0, lifehub.app#356) OCH EN HÄNDELSE (0.125.0, lifehub.app#377). Hashen av adressen (och av ett gammalt token), slumpslutet och koden görs här och bundlas aldrig till en webbläsare, och
 * raderna nekas klienten av `delningsregelfragment()`. Konstanterna och texterna som vyn också läser ligger i `lib/delning.js` (huvudingången
 * och här): en sanning om utgångstiderna, orsakerna och orden. Filen är ren utom `node:crypto`.
 */
export { createDelningService, byggDelning, byggAdressdelning, delningsId, adressId, delningsNyckel, delningsDisposition, nyttDelningstoken, nyttSlumpslut, hashaKod, kodStammer } from "./delning.js";
export { DELNINGSDAGAR, FORVAL_DELNINGSDAGAR, HANDELSEDAGAR, FORVAL_HANDELSEDAGAR, SIGNERAD_SEKUNDER, TOKENFORM, DELNINGSSLAG, DELNINGSRATTIGHETER, DELNINGSFALT, ADRESSPREFIX, ADRESSSEGMENT, ADRESSDELFORM, MAX_ADRESSDEL, MAX_ADRESSDEL_TOTALT, SLUMPSLUT_TECKEN, SLUMPSLUTFORM, KODLANGD, FELKOD_MAX, FELKOD_FONSTER_MS, adressdel, arAdressdel, nastaAdressdel, foreslaAdress, byggAdress, tolkaAdress, delningsSokvag, delningsUrl, adressUrUppslag, kodFel, normaliseraKod, DELNINGSORSAKER, DELNINGSFEL, DELNINGSFELKODER, DELNINGSSVARSFALT, HANDELSESVARSFALT, HANDELSEFILFALT, MAX_HANDELSEFILER, ANTECKNINGSSVARSFALT, LANKSVARSFALT, LISTSVARSFALT, LISTRADSNYCKEL, LISTRADSKAL, MAX_DELADE_LISTPOSTER, delningsTyp, delningsfel } from "../lib/delning.js";

/*
 * ⛔ FLYTTA EN POST ELLER EN HÄNDELSE TILL EN ANNAN KALENDER (0.123.0, cllp/lifehub.app#371). Att göra en post till en gruppens händelse är en
 * skrivning och en radering i en batch med Admin SDK, och prövningen av medlemskapet hör till servern. Vart något får flyttas (`flyttmal`) och
 * postens tid som en händelses fält (`postensTidsfalt`) är rena funktioner och exporteras även här, så att en nodfunktion inte behöver dra in React.
 */
export { createFlyttaService, FLYTTFELKODER } from "./flytta.js";
export { flyttmal, postensTidsfalt } from "../lib/flytta.js";

/*
 * ⛔ TITEL, ARTIST OCH OMSLAG FÖR EN MUSIKLÄNK (0.128.0, cllp/lifehub.app#378). Serverns halva av den smarta länken i Biblioteket: appen anropar den i en callable och
 * skickar in sin egen `fetch`. Bara https och bara de fyra källornas värdar (inget SSRF), med tidsgräns och tak på svarets storlek. Källan, värdlistan och rubriken hör till de rena
 * filerna och exporteras även här, så att en nodfunktion inte behöver dra in React för dem.
 */
export { lankInfoUrOembed } from "./lankinfo.js";
export { LANKKALLOR, lankKalla, lankRubrik } from "../lib/lankkalla.js";

/*
 * ⛔ GÄSTER (0.131.0, cllp/lifehub.app#389, skiva 1; 0.132.0, skiva 2: hela gruppen, se `docs/beslut/0012`). En gäst är en inbjudan och aldrig ett medlemskap eller ett konto, och nyckeln och sessionen hashas med `node:crypto`, som aldrig ska bundlas till en
 * webbläsare. Tjänsten bär inbjudan, återkallelsen, platserna (fem fasta dokument per grupp, `createNew`), räknarna per inbjudan och per IP och sessionen. Konstanterna, formerna och `gastId` är rena
 * och exporteras även här, så att en nodfunktion inte behöver dra in React för dem. Raderna nekas klienten av `gastregelfragment()` (utom att en medlem läser inbjudningarna).
 */
export { createGastService, byggGastinbjudan, gastInbjudningsId, gastnyckelHash, nyGastnyckel, PLATSFRIST_MS, SESSIONSUPPDATERING_MS } from "./gast.js";
export {
  GAST_PLATSER_GRATIS, GASTSLAG, GASTFUNKTIONER, GASTLANKDAGAR, GASTSESSIONSDAGAR, GASTFEL_MAX, GASTFEL_FONSTER_MS, GASTIP_MAX, GASTIP_FONSTER_MS, GASTNYLANKIP_MAX, GASTNYLANKIP_FONSTER_MS,
  GASTNYLANK_BREV_PER_DYGN, GASTNYLANK_MAX_LANKAR, MAX_GASTNAMN, MAX_GASTEPOST, GASTNYCKELFORM, GASTINBJUDNINGSIDFORM, GASTIDFORM, GASTSOKVAG, GASTFALT, GASTLISTFALT, GASTSVARSFALT,
  GASTORSAKER, GASTFEL, GASTFELKODER, GASTNYLANK_SVAR, GASTSTATUSAR, GASTPLATSNUMMER, normaliseraGastepost, gastId, gastomfangsnyckel, gastplatsId, gastLank, tolkaGastLank, gastStatus,
  GASTGRUPPFUNKTIONER, GASTARENDE_MAX, GASTARENDE_SKANNA_MAX, GASTARENDEKOMMENTARER_MAX, GASTARENDEFALT, GASTARENDEKOMMENTARFALT, byggGastMottagare, gastDelegerad, tolkaGastMottagare, GASTCHATT_SIDA, GASTKALENDER_MAX, GASTBIBLIOTEK_MAX, GASTANROP_PER_MINUT, GASTFIL_PER_DYGN, GASTGRUPPSVARSFALT, GASTCHATTFALT, GASTHANDELSEFALT, GASTKALENDERFALT, GASTFILFALT, GASTBIBLIOTEKFALT, GASTPERSONFALT, GASTPERSONINBJUDANFALT, GASTTIDIGAREMEDLEM, arGastId, GASTNAMNLOS, GASTSKRIV_MAX_TECKEN, GASTSKRIV_PER_MINUT, GASTGRUPPATGARDER, gastOmfangGer, gastGruppApi,
} from "../lib/gast.js";

/*
 * ⛔ UTSKRIFTENS LÄGE PÅ POSTEN (0.133.0, lifehub.app#349). Appens server sätter och tar bort `utskriftJobb`, och fälten som rensas (`UTSKRIFT_FALT`), tiden ett jobb får leva (`UTSKRIFT_TAK_MS`) och
 * tolkningen av läget (`utskriftLage`) ligger i en ren fil som vyn också läser. En egen lista i appens functions hade glidit isär den dag ett statusfält tillkommer (regel 2).
 */
export { UTSKRIFT_FALT, UTSKRIFT_TAK_MS, UTSKRIFT_TIMEOUT_TEXT, UTSKRIFTJOBB_STATUS, UTSKRIFT_UPPSKATTNING, utskriftLage, uppskattadUtskriftstid, utanUtskrift } from "../lib/utskrift.js";

/*
 * ⛔ ALLT SOM APPENS FUNKTIONER LÄSER UR RAMVERKET, UTAN REACT (0.139.0, cllp/lifehub.app `docs/prestanda-strategi.md`). Mätt mot lifehub.app main: 21 filer i
 * `functions/` importerade huvudingången `ops-framework` för de här namnen, och det kostade 2,4 till 2,7 s och cirka 200 MB vid varje kallstart, mot 60 ms för den här
 * ingången. Namnen exporteras ur SAMMA källmodul som huvudingången (ingen kopia, regel 2), och varje källmodul är ren: `scripts/check-node-side.mjs` följer importgrafen
 * statiskt, och `src/__tests__/nod-ren-ingang.test.js` laddar ingången i en ren Node-process och kräver att varken React, Radix, en komponent eller `dist/` kommer med.
 * Listan som appen behöver står i provet, och är röd om ett namn saknas här.
 */
export { AGENTMODELLER, FORVALD_AGENTMODELL } from "../lib/agentmodeller.js";
export { GRUPPIKONKATALOG } from "../lib/gruppikonkatalog.generated.js";
export { KALENDERFARGER, KALENDERIKONER, forvaldKalender } from "../lib/kalendrar.js";
export { MAX_BIBLIOTEKURL, MAX_BIBLIOTEKUTSKRIFT, arLjudpost, arMittBibliotek, byggPost, ljudRubrik, utskriftFel } from "../lib/bibliotek.js";
export { byggGrupp, byggMedlemskap, medlemskapsId } from "../lib/grupp.js";
export { byggSamtal, byggTrad } from "../lib/samtal.js";
export { epostFel } from "../lib/mejl.js";
export { foreVillkor } from "../data/contract.js";
