# Design: en händelses filer (cllp/lifehub.app#366, punkt 2)

Status: förslag, granskas av Claude innan steg 2 mergas. Ärende: cllp/lifehub.app#366. Ramverkets del: cllp/ops-framework, gren `claude/366-handelsefiler`, 0.121.0.
Relaterat: beslut 0002 (kommentarer och flera bilagor på händelse), 0004 (biblioteket), 0.101.0 (Mitt bibliotek), 0.119.0 (delning).

## Händelsen

CP 2026-10-19, #366: "Jag vill ta detta mail och skapa en händelse och lägga till PDF:erna, och eventuellt bilder på biljetter mm. I kalendern gick inte detta, att ha attachement på en händelse. Detta är jätteviktigt att som i sessionstudio ha ett händelsebibliotek som bara gäller den händelsen."

Det som finns i dag är `HandelseVy.bilaga`: EN fil som data-URL i händelsens eget dokument, tak 700 000 tecken (beslut 0002, 0.45.0). Två biljetter får inte plats, ett ljud inte alls. Beslut 0002 sade vägen: flera bilagor är fillagring via Biblioteket, aldrig en lista av data-URL. Biblioteket finns sedan #192, så nu byggs vägen.

## Valet: en egen PLATS per händelse, inte ett fält på posten

Två sätt att säga "den här filen hör till den här händelsen":

| | A) Plats `handelse~<grupp>~<händelse>` i `groupId` | B) Fältet `handelseId` på en post i gruppens plats |
|---|---|---|
| Ny modell | Ingen. Postens fält är desamma (`BIBLIOTEKFALT` rörs inte). `groupId` får ett tredje värde, som Mitt bibliotek fick `mitt~<uid>` i 0.101.0. | Nytt fält i `BIBLIOTEKFALT`, nya regelvillkor (bara på `fil`, händelsen finns, fältet står stilla vid update), ny typ-rad i varje post-kontroll. |
| Frågan | `where groupId == plats`. Ett fält, inget index. | `where groupId == g and handelseId == h`: sammansatt index som appen måste deploya. Och "gruppens poster UTAN händelse" kan inte uttryckas (ett fält som saknas matchar inte `== null`), så gruppens bibliotek måste antingen läsa alla händelsefiler och sålla i klienten, eller backfilla `handelseId: null` på varje gammal post. |
| Synlighet | Händelsens filer syns bara i händelsen. Gruppens bibliotek frågar efter gruppens plats och ser dem aldrig. | Filerna ligger i gruppens lista, där biljetten till bion bara är brus. SS vill motsatsen: ett bibliotek "som bara gäller den händelsen". |
| Storage-regel | Sökvägen `grupper/<plats>/bibliotek/<post>/<fil>` bär platsen. Behörighet = medlemskap i platsens grupp + posten finns: två dokument, som i dag. | Sökvägen bär bara gruppen. Regeln måste slå upp posten, läsa `handelseId`, slå upp händelsen och medlemskapet: tre dokument. |
| Kod som redan gäller | `createBibliotekskalla({ groupId: plats })` ger uppladdning, ljudmeta, utskrift, radering och prenumeration oförändrade. `OpsBibliotek`, `OpsLjudspelare`, `OpsDelad` ser en post som alla andra. | `spara`, `laddaUppFil`, frågan och listan behöver alla veta om fältet. |
| Pris | Platsen är en sträng med tre delar som regel och klient tolkar (`split('~')`). Samma sak som `mitt~`, fast med två skarvar. | Ingen strängtolkning. |

**Valet är A.** Det ger minst ny modell (inget nytt fält, ingen ny samling, ingen ny typ), enklast regler (en gren i samma ternär som redan skiljer `mitt~` från grupp) och att allt som redan fungerar på en post fortsätter göra det utan ny kod. B:s enda fördel är att slippa tolka en sträng, och den betalas med ett index, ett fält som inte går att fråga efter och en synlighet CP inte vill ha. Det är regel 13: modellen följer den enklare formen, inte förebildens.

Prefixet är `handelse~`. Ett grupp-id följer `ID_FORM`, som inte har `~`, och ett händelse-id följer `[A-Za-z0-9][A-Za-z0-9_-]{0,127}`, som inte heller har det. Platsen kan alltså aldrig krocka med en grupp, med `mitt~<uid>` eller med kalenderpostens `post~<id>` (0.120.0). Formen i ett uttryck: `handelse~<ID_FORM>~<händelse-id>`, samma uttryck i klienten och i reglerna via `regelRegex` (en sanning).

## Vem får läsa och skriva

Händelsen har ingen egen behörighet; den ärver gruppens. Appens händelseregel (lifehub.app `match /handelser/{id}`) och ramverkets `gruppadSamling` ger samma sak: aktiv medlem i händelsens grupp läser och redigerar, ingen raderar (`delete: if false`, en händelse arkiveras). Filerna följer det.

| | Regel (Firestore, posten under platsen) |
|---|---|
| Läsa | Aktiv medlem i platsens grupp, OCH händelsen finns, OCH händelsens `groupId` är platsens grupp. |
| Lägga till | Samma, OCH medlemskapet är en person (inte en agent, som biblioteket redan kräver), OCH `typ == "fil"`, OCH `skapadAv.uid` är den inloggade, OCH vanliga postvillkor (serverns klocka, fält, tak, MIME, sökvägen = platsen). Det är "den som får redigera händelsen": i båda appar och i generatorn är det en aktiv medlem. |
| Ändra | Författaren (aktiv medlem), eller ägare/admin i gruppen. Som i gruppens bibliotek. |
| Radera | Den som laddade upp sin egen fil, ägare och admin alla. Som i gruppens bibliotek (#311). |
| Storage | Läsa: aktiv medlem i platsens grupp. Skriva: som posten, alltså aktiv medlem som skrev posten, eller ägare/admin, och posten finns med samma plats. Ingen radering från klient (servern städar, som idag). |

Tre skydd som inte får saknas:

- **Platsens grupp = händelsens grupp.** Utan det kan medlem i A skapa `handelse~A~h` där `h` ligger i B och få läsa B:s händelsefiler via sin egen gruppbehörighet. Villkoret är `get(händelsen).data.groupId == split('~')[1]`.
- **Händelsen måste finnas** för att läsa eller skriva. En händelse som tagits bort med Admin SDK lämnar posterna osynliga för klienten direkt (som kommentarerna, 0.48.0).
- **Grenarna utesluter varandra.** En plats som börjar `handelse~` prövas bara mot händelsegrenen, aldrig mot `memberships` med hela strängen som grupp (samma lärdom som Mitt bibliotek, granskningen av PR 365).

Stora val som jag tar utan att fråga, med skäl:

- **Bara filer.** En anteckning på en händelse är händelsens beskrivning (en sanning) och en länk likaså. Regeln nekar `anteckning` och `lank` på platsen, och `postFel` säger samma sak i klienten. Det är också vad #366 ber om: "PDF:erna, och eventuellt bilder på biljetter".
- **Fil som `FILMIME` säger.** PDF, bilder, ljud, text. Ingen ny MIME, inga nya tak (25 MB, ljud 250 MB).
- **Ingen `skrivvillkor`-ratt** ("bara ägare får lägga till filer"). Den hade varit en andra konfigurationspunkt som måste hållas lika med händelsesamlingens egen, alltså två sanningar. Ingen app behöver den. Ändrar en app vem som redigerar händelser ska filregeln ändras med, och då är det ett beslut, inte en inställning.
- **Arkiverade händelser** tar emot filer i reglerna: `arkiverad` är appens fält, inte ramverkets. Appen döljer Ladda upp via `kanLaggaTill`.

## Gränssnitt

- **Sektion, inte flik.** `OpsHandelsePanel` har inga flikar (beslut: "flikar och bibliotek hör till en senare leverans"), bara sektioner. Panelen får en ny slot `filer`, som `svar` och `kommentarer`, ritad efter bilagan och före svaren: `<div data-handelsefiler>`. Appen skickar `<OpsHandelsefiler kalla={...} jag={...} kanLaggaTill />`.
- **`OpsHandelsefiler`** (ny, tunn): rubriken "Filer", knappen "Ladda upp", listan, och detaljen när en fil öppnas. Den håller `vald`/`skapar` själv och kopplar `onSpara`, `onLaddaUpp`, `onRadera` direkt mot `kalla` (`createBibliotekskalla`), så appen skickar en källa och inte sex callbacks. Den ritar `OpsBibliotek`, inte en ny lista: ljudspelaren, förhandsvisning av bild, PDF-länk, utskrift och Dela länk är därmed samma kod som i Biblioteket.
- **`OpsBibliotek` får `inbaddad`** (och `kanSkapa`): ingen `OpsView`-ram, ingen tillbaka-rad till hubben (`hubHref` krävs inte), ingen sök/tagg/flikrad, "Ladda upp" i stället för "+ Ny"-menyn, tom lista skriven som "Inga filer än." (punkt 5), detaljens tillbaka heter "Filer" så den inte förväxlas med panelens Tillbaka. `kanSkapa={false}` är en medlem som får läsa och radera sitt eget men inte lägga till.
- **Platsen syns inte i platsväljaren, och inget flyttas dit eller därifrån.** `OpsBibliotek` kastar om `platser` eller `grupper` innehåller en händelseplats, och `flyttaBibliotekspost` kastar om `fran` eller `till` är en. Skäl: (1) en flytt är ett beslut om vem som ser filen, och en händelsefils synlighet är händelsens. In från Mitt bibliotek skulle göra en privat fil synlig för gruppen under ordet "flytta"; in från gruppens bibliotek skulle gömma den för dem som söker där; ut skulle klippa loss biljetten från bion. (2) Varje extra väg in till platsen är en väg som måste hålla händelsereglerna, och flytten kontrollerar dem inte i klienten. (3) En lista man inte kan välja ur är en lista man inte kan välja fel i. Att kopiera ut till gruppens bibliotek är en uppföljning, inte med nu.
- **Delning och utskrift** fungerar utan ny kod i vyn. Delningstjänsten (`createDelningService`) slår upp medlemskapet på platsens grupp (`gruppForPlats`), annars hade en händelsefil nekats tyst. Appens server (utskrift) måste göra samma uppslag.

## När händelsen raderas

En klient raderar aldrig en händelse (`delete: if false` i appens regel och i generatorn). Den arkiveras, och då ligger filerna kvar med den och syns igen om arkiveringen ångras. Ingen kaskad behövs för det vanliga fallet, och ingen skrivs.

Hård radering sker bara med Admin SDK (gallring, en begäran om radering av uppgifter). Då är kvarlämnat tvåfaldigt: posterna på platsen och deras objekt i bucketen. Reglerna gör posterna osynliga för klienten i samma stund (läsning kräver att händelsen finns), så ingenting läcker; städningen är serverns:

- `createHandelsefilerService({ kalla, samlingar: { bibliotek } }).stada({ groupId, handelseId, skarpt })` (ny, `ops-framework/node`) raderar platsens poster med Admin SDK-källan. Torrt som förval (`skarpt` måste sägas), och svaret har alltid alla fält: `funna`, `raderade`, `fel`, också som noll (punkt 5).
- Objekten tar appens befintliga `bibliotekstadning` bort när posten försvinner (`delar[1] === groupId`, vilket gäller platsens sträng som den är). Ramverket rör inte bucketen.

Den enskilda filens radering är oförändrad: posten raderas (författare, ägare, admin), servern tar bort objektet.

## Regel 13: tre listor

**Tas som det är:** posten, fälten, taken, MIME-listan, ljudspelaren, utskriften, taggarna, delningen, kallan, `farAndra`, storage-sökvägen, Mitt biblioteks mönster med en plats i `groupId` och regelgrenar som utesluter varandra. SS:s tanke att händelsen har ett eget bibliotek.

**Görs bättre än SS:**
- Behörigheten är medlemskapet i gruppen, prövad i en regel, inte ett klientfilter (SS ADR-020 tvingades dit av `isAuth()`; här finns medlemskapet som uppslag och Mitt bibliotek bevisade mönstret).
- Platsens grupp pinnas mot händelsens grupp, så en påhittad plats inte öppnar en annan grupps händelsefiler.
- Ingen fil kan hamna i fel bibliotek med en flytt, för det finns ingen flytt.
- Tom lista och läsfel skrivs ut, inte en tom yta.

**Stryks, och vad det hade kostat:**
- Anteckningar, länkar och låtar/setlistor på en händelse (SS-artefakter): en andra sanning om beskrivningen och musikappens modell i varje ops-app.
- Flytta/kopiera mellan platser: se ovan, ett synlighetsbeslut utan kontroll.
- `skrivvillkor`-ratten: en andra konfigurationspunkt.
- Taggar, sök och flikar i händelsens lista: UI för ett litet antal filer; modellen bär taggar ändå om det behövs.
- Röstinspelning direkt i händelsen: kräver att skalets inspelare får ett mål per händelse.
- En fältkopia av `groupId` (t.ex. `handelseId` på posten) som en andra sanning: härleds ur platsen (`handelsedelar`).

## Vad som INTE ingår (och varför)

- **Migreringen av den singulära `bilaga`** till en fil (beslut 0002, steg 3): en uttalad migrering i appen med egen deploysekvens. Tills dess ritar panelen båda. Appen bör sluta erbjuda `bilaga` när Filer är inkopplad, så att nya händelser bara har ett ställe.
- **Mejl till händelse** (#366 öppningstexten: "ta detta mail och skapa en händelse"): en egen skiva i inkorgen, inte filer.
- **Slutdatum samma dag** och **ärende med bilaga** (resten av #366): andra punkter i ärendet.
- **Montage mot SessionStudio (regel 12):** ärendet citerar ingen SS-skärmbild, bara "som i sessionstudio". Ingen skärmbild bredvid förebilden har tagits; det står i PR-texten.

## Prov (golv och båda riktningarna)

Emulatorprov (`rules/__tests__/handelsefiler.test.mjs`, Firestore och Storage): medlem läser; utomstående nekas; medlem i en annan grupp nekas; plats med fel grupp nekas; plats för en händelse som inte finns nekas; avslutad medlem och agent nekas att lägga till; anteckning/länk på platsen nekas; författaren raderar sin fil, en annan medlem inte, admin och ägare alla; storage läser/skriver enligt samma. Golv: minst 4 lyckade och 8 nekade utfall mätta, och fragmentet får inte vara tomt. Mutationskörning: varje nekande villkor tas bort ett i taget och provet för det ska bli rött (utfallen skrivs i PR-texten). Vitest: `handelsePlats`/`handelsedelar`/`gruppForPlats`, `postFel` och `farAndra` för platsen, platsväljaren och flytten kastar, `OpsHandelsefiler` (lista, tom, ladda upp, ta bort, `kanLaggaTill`), panelens slot, delningstjänsten på platsen, städtjänsten.
