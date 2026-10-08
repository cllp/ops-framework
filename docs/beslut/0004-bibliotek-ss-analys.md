# Analys 0004: biblioteket i SessionStudio, och skivplanen för ramverket

Status: **förslag till granskning** (2026-10-07). Ärendet: [cllp/ops-framework#192](https://github.com/cllp/ops-framework/issues/192).
CP:s två kommentarer samma dag, 2026-09-30: riktningen (GUI och de flesta artefakterna, förenkla, ny kod bara vid vinst) och kravet att analysen ligger i ärendet eller som ADR innan någon kod.

Den här texten är analysen. Den ligger i `docs/` eftersom passet inte kan skriva en kommentar på ärendet: GitHub-MCP-anslutningen svarar med fel, och den här miljöns `gh` får bara läsa. Ingen bibliotekskod följer med i den här leveransen.

Mätt mot `cllp/sessions-platform` på `main` `f305de6` (2026-09-28), och mot ramverkets `main` `1d1bf66` (0.78.0). Siffrorna är rader där filen lästs, och byte ur git-trädet där bara storleken mätts.

## Vad som fungerar, och var tiden sitter

SessionStudio har redan gjort den svåra sammanslagningen. Fyra äldre samlingar (`songs`, `userResources`, `groupResources`, `riders`) är avskrivna. Allt nytt skrivs genom `saveArtifact` till en samling, `artifacts`, med ett fält `type`. Det står i `memory/data-model.md` (läst, 604 rader) och i `packages/shared/firestore-queries/artifacts/saveDeleteArtifact.js` (416 rader).

De åtta typerna är en lista, `ALL_ARTIFACT_TYPES` i `packages/shared/constants.js`. SessionStudio delar redan listan i två:

| Grupp | Typer | Vad de är |
|---|---|---|
| Strukturerade, musik | `song`, `setlist`, `rider`, `recording` | Låt med tonart och tempo, spellista med låtreferenser, teknisk rider, inspelning |
| Enkla, allmänna | `note`, `image`, `link`, `file` | Text, bild, länk, dokument |

Ytan som är värd att behålla är liten jämfört med resten:

- Flikar per typ, och en flik för allt. `useMyLibraryTabs.js` är 231 rader och hör till det personliga biblioteket ("Mitt bibliotek"), inte till gruppens. Där syns en flik när det finns poster av den typen. Gruppens bibliotek har sina egna flikar inne i `GroupResourcesPanel.jsx`.
- Listraden. `LibraryArtifactListRow.jsx` är 152 rader: ikon, huvud, högerkant, och en osynlig knapp över raden så att radens egna knappar inte hamnar inuti en annan knapp. Den kommentaren pekar på ett axe-fel (`nested-interactive`, GitHub #1701 i sessions-platform).
- Tomt läge, sökfält och ett formulär per enkel typ. Fälten för de enkla typerna plus `recording` och `rider` står i `builtinTypeElements.js` (248 rader): titel, text, url, fil.
- En detaljvy. För en låt är den `SongDetailView.jsx`, 1024 rader, med sex flikar: info, noter, ackord, dokument, ljud, länkar.

Gruppens bibliotek och det personliga biblioteket använder samma rad och samma filter (`libraryResourceFilter.js`, `filterGroupResourceList` och `filterMyLibraryResourceList`).

## Vad som är tungt eller dubbelt

Storleken sitter inte i de åtta typerna. Den sitter i att samma bibliotek finns i flera skal, med en synlighetsmodell som reglerna inte kan bära.

Mätt storlek, ur git-trädet:

| Fil | Byte |
|---|---|
| `apps/mobile/app/(tabs)/library.js` | 76 483 |
| `apps/web/src/components/GroupResourcesPanel.jsx` | 68 226 (1 401 rader) |
| `apps/web/src/components/EventDetailSessionLibrary.jsx` | 52 175 |
| `apps/web/src/components/ElementRenderer.jsx` | 49 700 (1 163 rader) |
| `apps/web/src/components/library/LibraryRow.jsx` | 42 858 |
| `apps/web/src/components/MyLibraryPanel.jsx` | 35 282 (892 rader) |
| `apps/web/src/components/ArtifactLibraryPanel.jsx` | 31 574 |

Samma sak finns på webben och i den inbyggda appen: `ElementRenderer`, taggredigerare, synlighetsmärke, skapa-dialog. Två klienter håller samma beteende.

Tre sätt att säga "den här posten hör ihop med något", och de får inte blandas (`data-model.md`, avsnittet Parent-Child):

1. Träd. `parentId`, `ancestorIds`, `rootId`. En förälder, ingen omflyttning, kaskadradering via molnfunktion. ADR-023.
2. Aggregat. En spellista pekar på låtar med `songRefs`. Det är en annan relation än trädet.
3. Synlighet. `linkedTo`, `linkedGroupIds` (tak 50, och reglernas reserv läser bara index 0 till 19), `sharedWithGroupIds`. Effektiv åtkomst är postens egen lista plus alla förfäders listor, räknad i klienten.

Läsregeln för `artifacts` är ADR-020: `allow read: if isAuth()`. Vilken inloggad användare som helst kan hämta vilket dokument som helst. `visibility: "private"` hålls i klienten (`packages/shared/artifactVisibility.js`, 329 rader). Beslutstexten säger att den medlemsmedvetna regeln var grön i proven och röd live, eftersom Firestore inte kan bevisa en fråga med `array-contains-any` och en kedja av `exists()`. Det är permissions-träsket. Samma klass som `blockedDates` i ramverkets regel 13.

SessionStudios egen väg bort från ADR-020 är hybriddoktrinen (ADR-021): relationsdata, och biblioteket först, flyttar till Postgres där radernas behörighet är en join med RLS, medan realtid som chatt stannar i Firestore. Ramverket behöver inte den vägen för skiva 1, av skälet i nästa avsnitt.

## Varför ramverkets regel inte hamnar i permissions-träsket

SessionStudio föll på frågans form, inte på att det fanns en regel. Två mätta fall:

- **`artifacts` (ADR-020).** Prenumerationen hämtade flera gruppers poster i en fråga med `array-contains-any` över `linkedGroupIds`. Läsregeln måste då bevisa, för hela frågan på en gång, att varje möjlig träff ligger i någon av den läsandes grupper. Regeln var en OR-kedja över JWT-anspråk och medlemskapsdokument, och Firestores frågebevis klarar inte den kedjan. Grön i enhetsproven, `permission-denied` i den riktiga SDK:n.
- **`blockedDates` (0.9.328 till 0.9.329).** I 0.9.328 fick läsningen en regel som provade medlemskap per grupp i `visibleToGroupIds`, alltså ett `exists(memberships/...)` per index. I 0.9.329 föll den på Firestores tak för antal `exists()` i en utvärdering (`subscribe_blocked_shared_error`), och backades till JWT-anspråken.

Ramverkets regel har ingen av de två formerna:

1. **En likhet, inte en mängd.** Raden bär ett `groupId`, en sträng, och frågan är alltid `where groupId == <gruppen>`. Firestore bevisar en sådan fråga genom att sätta in värdet ur frågan i regeln. Det finns inget `array-contains-any`, ingen lista av grupper att pröva och ingen OR mellan källor.
2. **Ett bestämt dokument, inte en kedja.** `opsArMedlem(groupId)` slår upp exakt ett dokument, `memberships/<uid>|<groupId>`, vars nyckel är härledd ur den inloggade och radens grupp. Det är ett `exists()` och ett `get()` på samma väg, oavsett hur många grupper personen har. Taket för antal uppslag nås inte, eftersom antalet inte växer med datan.
3. **Ingen JWT-fördröjning.** Medlemskapet läses ur dokumentet, inte ur anspråk i token. En nyss tillagd medlem behöver ingen ny token för att få läsa.

Det är samma form som katalogen och samtalen redan har, och den är provad mot emulatorn med riktiga frågor. Kostnaden är att en fråga över flera grupper inte går att ställa. Det är avsett: ramverket har ett omfång, den aktiva gruppen.

Ovanpå det: egna mallar (`artifactTemplates`, `ElementRenderer` med många fältslag), ett personligt bibliotek, en flik "delat", publika gruppresurser, sessionsbibliotek på en händelse, idéinspelare, kopiera mellan mål, personliga taggar vid sidan av gruppens taggar, och MIME-routing som byter `type` när en fil råkar vara en bild. Äldre fältnamn (`artifactType`, `url`, `audioUrl`) finns kvar i kommentarerna fast skrivningen ska använda `type` och `fileUrl`.

Ramverkets `OpsList` bär redan lärdomen från virtualiseringen: en fast radhöjd mot innehåll som fälls ut klippte rader och gjorde spara-knappen omöjlig att träffa. Den höjden ska inte tillbaka.

## Gränsen mot katalogen

Ramverket har redan en katalog (`src/lib/katalog.js`, `createCatalogSource`). Den är gruppens konfiguration: kategorier, färg, ikon, fas. Ägare och admin skriver, en medlem läser. En bibliotekspost är något annat: ett dokument gruppen samlar, som en anteckning eller en länk. Samma samling för båda hade gett två betydelser åt ett dokument, och regel 2 förbjuder det.

Ärende #192 säger att biblioteket är kärnlager, och att modulen bara styr vilka listor en grupp visar. Det stämmer med beslut 0003: en yta som två appar vill ha hör hemma i ramverket. Musiktyperna är en apps yta, den dagen en app ber om dem.

## Vad som kopieras, vad som byggs om, vad som lämnas

### Kopieras, som yta

- Listan med typflikar, en rad med ikon, titel och meta, och en detalj bakom raden.
- Tomt läge med en mening som säger att listan är tom.
- Ett fält `typ` med en sluten lista.
- Sök i den redan lästa listan, i klienten. Ingen andra samling för sökord.

### Byggs om, eftersom SessionStudios form inte får plats här

- **Gruppens omfång.** Varje rad bär `groupId`. Källan är `createBibliotekskalla({ source, collection, groupId })`, samma form som `createCatalogSource`: samlingsnamnet kommer utifrån, frågan är alltid `where: { groupId }`, och en källa utan grupp kastas. Ramverket skriver aldrig samlingsnamnet.
- **Reglerna.** `bibliotekregelfragment(namn)` limmas in efter `regelfragment()`, och använder `opsArMedlem` mot radens `groupId`. En fråga utan grupp nekas, en medlem i en annan grupp nekas, radering nekas. Det är katalogens lås, med en annan skrivroll: en medlem får skapa, eftersom en anteckning är medlemmens bidrag och inte gruppens konfiguration. `skapadAv.uid` ska vara den inloggade, samma skäl som ändringsloggen. ADR-020 kopieras inte. Ingen klientfiltrering av synlighet, ingen `linkedGroupIds`, inget träd.
- **Typernas namn** blir ramverkets svenska nycklar: `anteckning` och `lank`. SessionStudios engelska id följer med i analysen som källa, och skrivs inte in i databasen.
- **Identiteten** är `byggSkapare`, inte ett fritt `ownerId` plus ett denormaliserat `createdBy`.

### Lämnas, och vad det hade kostat

| Lämnas | Kostnaden om det kommit med |
|---|---|
| ADR-020, öppen läsning och synlighet i klienten | Varje inloggad kan läsa varje dokument. Det är den risk SessionStudio dokumenterat och accepterat. Ramverket har redan medlemskapet i JWT-anspråken och `opsArMedlem`. |
| Trädet (`parentId`, `ancestorIds`, `rootId`) och kaskadradering | En molnfunktion, en cykelvakt, och en läsning som måste hämta förfäder för att veta vem som ser barnet. |
| `song`, `setlist`, `recording`, `rider` | Noter (OSMD), ackord, tonart, tempo, spellistans låtreferenser, ljudfil. Det är musikappens modell. Varje ops-app hade burit den. |
| Egna mallar och `ElementRenderer` | En andra konfiguration vid sidan av katalogen, och en renderare med fält ramverket inte har en vy för. |
| Personligt bibliotek, fliken delat, publik sida, sessionsbibliotek | Fyra omfång till. Ramverket har ett omfång: den aktiva gruppen (0.35.0). |
| Video och inline-fil på hundratals kilobyte | Samma kostnad som #300 mäter i chatten: listläsningen drar med sig filen. Fil och bild väntar tills lagringen är en sökväg appen namnger. `lagringsregelfragment` finns redan. |
| Fast radhöjd och virtualisering | Redan struken i `OpsList`, med felet beskrivet där. |

## Regelfragmentet i skiva 1

Ett fragment, `bibliotekregelfragment(samlingsnamn)`:

- Läsa: aktiv medlem i radens grupp.
- Skapa: aktiv medlem i radens grupp, `skapadAv.uid` är den inloggade, `typ` är `anteckning` eller `lank`, fälten är exakt listan modellen äger.
- Ändra: författaren, eller admin i gruppen. `groupId` och `typ` står stilla. En medlem ändrar inte någon annans rad.
- Radera: aldrig. Arkivering kan komma senare, som i katalogen. Skiva 1 har ingen radering och inget arkivfält, så att fragmentet inte lovar ett fält vyn inte har.
  **Det här är ett öppet val för CP, inte ett beslut.** Det skiljer sig från SessionStudio, där ägaren kan radera sin post. Följden av "aldrig" är att en felaktig post, en länk till fel ställe eller en anteckning i fel grupp, ligger kvar för alltid tills ett arkivfält finns. Den kan rättas av författaren eller en admin, men inte tas bort. Alternativen är radering för författaren och admin, eller ett arkivfält redan i skiva 1.

Fält: `groupId`, `typ`, `rubrik`, `text`, `url`, `skapadAv`, `skapad`, `andrad`. En anteckning har `text` och saknar `url`. En länk har `url` på `http` eller `https` och saknar `text`. Båda har rubrik.

**Regeln och klientens kontroll kommer ur samma källa.** Det som regeln prövar och det som modellen (`postFel`) prövar ska vara samma sak, annars kan en rad gå igenom regeln och sedan avvisas av klienten, eller tvärtom. Två krav följer:

- **Trim.** En rubrik eller text som bara är mellanslag är tom. Regeln prövar `trim().size() > 0`, samma som modellen gör med `trim()`.
- **Adressformen.** En länks adress prövas mot ett och samma `RegExp`, exporterat ur modellen. Regeln får det som `matches()` genom `regelRegex`, samma mönster som externa datakällor (#216). Ett handskrivet uttryck i regeln och ett `new URL()` i klienten är två sanningar: regeln släpper då igenom `http://exa mple`, som klienten sedan inte kan läsa.

Läsningen ska dessutom tåla en rad som ändå är trasig, till exempel en som skrevs före en skärpning. En sådan rad märks och hoppas över, med ett synligt fel. Den släcker inte resten av gruppens bibliotek, eftersom den inte går att radera.

## Vilka av de åtta som tas först

Först `note` och `link`, som `anteckning` och `lank`. De är två av de fyra allmänna typerna, de behöver ingen lagring, och de är begripliga i en styrelse, ett bolag och ett korpus. Det är skiva 1.

Sedan `file` och `image`, som `fil` och `bild`, när appen skickar in en lagringssökväg. Det är skiva 2. Video tas upp då, tillsammans med beslutet i #301: video kräver lagring utanför dokumentet.

`song`, `setlist`, `recording` och `rider` tas inte in i kärnan. En app som vill ha dem bygger en egen yta (beslut 0003, nivå 3) den dagen någon ber om den. Att ta in dem nu hade varit paritet med en musikapp, och #192 säger att ny kod ska ha en vinst.

## Skivplan

1. **Skiva 1.** Datakälla, regelfragment, listvy och detaljvy för `anteckning` och `lank`. Prov röda utan spärren och gröna med. Montage mot förebilden, och de tre listorna. Ingen annan typ.
2. **Skiva 2.** `fil` och `bild`, med appens lagringssökväg och det befintliga lagringsfragmentet. Listläsningen bär metadata, inte filens byte.
3. **Senare, var för sig, om en app ber om det.** Sökindex om klientfiltret tar slut. Arkiv i stället för att låta en rad ligga kvar. En plats på händelsen där en modul kan peka på en bibliotekspost (beslut 0003, nivå 2). Musiktyperna som en egen app.

Skiva 1 skrivs först när den här texten ligger i en PR. Ärende #192 får kommentaren när någon med skrivrätt lägger in den, eller en länk till den här filen.
