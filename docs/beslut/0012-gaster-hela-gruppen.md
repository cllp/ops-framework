# Design: gäster i hela gruppen och det bantade gränssnittet (cllp/lifehub.app#389, ramverkets del, skiva 2 och 3)

Status: byggd i 0.132.0, granskas av Claude innan steget mergas. Ärende: cllp/lifehub.app#389 (epiken). Designförslaget: https://github.com/cllp/lifehub.app/issues/389#issuecomment-6295916087. CP:s beslut 2026-10-20: https://github.com/cllp/lifehub.app/issues/389#issuecomment-6296743377.
Bygger på beslut 0011 (en gäst är en inbjudan och aldrig ett konto, skiva 1) och ändrar inget av det: modellen, sessionen, platserna och felräknarna är desamma, med ett andra omfång.

## Händelsen

Skiva 1 gav en gäst en sak: rösta på ett datum. CP vill att en extern ska kunna vara med i hela projektet. CP:s beslut på designen, ordagrant i sak:

1. **Ägare och admin bjuder in till hela gruppen.** Inte vem som helst som får bjuda in till en omröstning.
2. **Gästen ser chattens hela historik, och dialogen säger det tydligt.** Inte bara det som skrivs efter inbjudan.
3. **Radering av en gästs uppgifter och en text om integritet är klara före första gruppgästen.** Skiva 1 lät det vara "CP:s bedömning"; nu är det ett krav.

Tre beslut kom under bygget, alla 2026-10-20, och ändrade designen:

4. **Gästen får skriva i gruppchatten.** Designen sade "utan skrivfält". Nu skriver gästen som gäst, aldrig som medlem, och meddelandet märks Gäst i medlemmarnas chatt.
5. **Gästen ser inte gruppens ärenden.** I skiva 2 fanns ingen ärendeåtgärd alls; skiva 3 (nedan, CP 2026-10-20: "Lägg den i samma PR") ger gästen bara de ärenden som delegerats till hen.
6. **Gästen bjuds in från gruppens medlemsvy**, som ett val i Roll under Bjud in ("Gäst (utan konto)"), och inte på en egen plats.

## Beslutet i en tabell

| Fråga | Svar | Varför |
|---|---|---|
| Vad är "hela gruppen"? | Omfånget `{ slag: "grupp" }`. Inbjudans id är fortfarande SHA-256 av (grupp, adress, omfångsnyckel); omfångsnyckeln `"grupp"` ger en andra rad per person bredvid en eventuell `sak:rosta:<händelse>`. | Befintliga id ändras inte (skiva 1:s rader har samma id som förut, och ett prov bevisar det). Samma adress till samma omfång är fortfarande samma rad. |
| Taket | Oförändrat: 5 platser per grupp, och **en person tar en plats oavsett hur många omfång hen har**. | Platsen är nyckad på gästen (`g_`-id) och inte på inbjudan. Annars hade en gäst med en grupp och tre omröstningar tagit fyra av fem platser. |
| Vem bjuder in? | Ägare eller admin, **i ramverket och inte i en callback** (`bjud` med `slag: "grupp"`). `farBjuda` gäller bara en omröstning. | Gästen läser hela chatthistoriken. En app som lade regeln själv kunde släppa in fler, och ändringen är en ny händelse här. |
| Vad ser och kan gästen? | Gruppens chatt (hela historiken, och hen kan skriva i den), kalendern och händelserna (svara och rösta) och biblioteket (läsa, spela, ladda ned). **Bara de ärenden som delegerats till hen** (skiva 3), aldrig gruppens ärendelista. Gästen kan inte bifoga eller ladda upp. | CP:s beslut. Ärendelistan kan bära sådant som inte rör gästen, och uppladdning för gäster stryks i #389. |
| Hur når gästen det? | Samma väg som i skiva 1: bara servern, `POST /api/gast`, sessionsnyckeln i kroppen. Åtta nya åtgärder (`GASTGRUPPATGARDER`) bakom samma tjänst. | Inga regler, index eller callables släpper in en gäst, och ingen av dem ändras. |
| Vad lämnar servern? | Öppna listor fält för fält per åtgärd. Aldrig en medlems adress eller uid. Chattens avsändare är ett namn. | Allt som skickas ut är något som kan läcka. |
| Filer | En signerad adress, 15 minuter, högst 50 per inbjudan och dygn, bara filer i gruppens egen plats med exakt sökväg. | Trafiken ut ur lagringen är det enda en gäst kan driva upp. |
| Radering | Medlemmen raderar en gästs uppgifter i gruppen; gästen raderar allt om sig, i alla grupper, från gästsidan. Inga spår av adressen blir kvar, och platsen frigörs. | CP:s beslut 3. |

## Valen i bygget, och vad som avviker från förslaget

1. **Gästens API bor i samma tjänst** (`createGastService`), med appens delar injicerade: `grupp.handelseSida` (vilka av appens fält som är titel, beskrivning och plats), `grupp.omrostning` (`falt`, `bygg`, `rosta`), `grupp.lagring.signeradAdress`. Ramverket känner aldrig samlingsnamn eller projekt-id. En app som utelämnar `grupp` får skiva 1 oförändrat, och `bjud` med `slag: "grupp"` kastar `ogiltigt-omfang`.
2. **Kravet prövas mot omfånget på ett ställe** (`gastOmfangGer`), och det anropas av `session` vid varje anrop. En omröstningsgäst ger aldrig en gruppfunktion, och en gruppgäst ger aldrig `rosta` på en sak. Ett nekat anrop (okänd session, återkallad, fel slag) kostar ingen räknare.
3. **Vyerna är medlemmens, inte en andra uppsättning.** Kalendern är `OpsCalendar` och en händelse öppnas i `OpsHandelsePanel` utan penna eller flytt. Biblioteket är `OpsBibliotek` med `jag: null`. Chattens bubblor är medlemmens (`Meddelanderader` ur `OpsMeddelanden`, den rena ritaren, exporterad för det). Svarsraden är `OpsSvarSummor`, som `OpsSvar` delar. Chattens skrivfält är chattens (`Skrivfalt`, delat) utan bilagor, mikrofon, omnämnanden och agent. Skalet är bantat: tre flikar och ingen väg ut ur `/gast` (mätt: inga länkar och inga ord ur appens skal i sidan).
4. **Förslaget antog att biblioteket hämtade en adress bara när en post öppnas. Det gjorde det inte.** `OpsBibliotek` hämtade en adress för varje filpost när listan ritades. För en medlem är det billigt (`getDownloadURL`); för en gäst är varje adress en signering som räknas mot taket, så en lista med 60 filer hade tagit 60 av 50. Rättat med `adresserPaBegaran` (bara den öppna posten), och provet är rött utan den.
5. **Hålet i `OpsGastSida` rättades i samma steg.** Skiva 1 prövade bara den senast öppnade sessionen på enheten. En gäst med en återkallad grupp och en levande omröstning (eller tvärtom) fick då "Inbjudan är återkallad" fast hen hade en giltig inbjudan. Nu prövas alla sparade sessioner, senast öppnade först, och orsaken visas först när alla nekats. Provet är rött utan rättelsen.
6. **Listan över gäster är en rad per person.** `lista({ groupId })` ger `personer` med inbjudningarna under, eftersom en gäst nu kan ha flera omfång och platsen är en. Åtgärder per inbjudan (Skicka igen, Dra tillbaka) och per person (Dra tillbaka alla, Radera uppgifter).
7. **Att bjuda in till hela gruppen bekräftas i en dialog** som säger vad gästen ser (chattens hela historik, och att hen kan skriva i den; kalendern och händelserna, att svara och rösta; biblioteket, att läsa, spela och ladda ned), vad gästen inte ser (gruppens ärenden och medlemmarnas adresser), och att det gästen hunnit läsa eller ladda ned inte går att ta tillbaka (en redan öppnad fil går att nå i högst 15 minuter efter en återkallelse). Inget anrop går före bekräftelsen.
8. **En verklig bugg hittades av ett prov under bygget:** `nyLank` sorterade på tid ensam, så en gruppinbjudan kunde hamna utanför de fem länkarna. Grupplänken sorteras nu först. Provet är rött utan sorteringen.
9. **Två loopar blev en** (`aterkallaRader`): `aterkallaAlla` och `ersattAvMedlem` återkallade på samma sätt på två ställen. En sanning.
10. **Gästens svar och röst skrivs med `g_`-id i medlemmens form.** Medlemsregeln kräver `request.auth.uid == uid`, så ingen klient kan skriva raden, och servern får aldrig vara löslare än regeln: tabellen `rules/__tests__/svarfall.mjs` (14 fall) körs som medlem mot de riktiga reglerna och som gäst mot servern. Raden `arkiverad` är den enda där de skiljer sig (servern är strängare) och står utskriven.

## Skiva 3: ärenden till en gäst

CP 2026-10-20 (https://github.com/cllp/lifehub.app/issues/389#issuecomment-6299049879): ett ärende kan få en gäst som ansvarig, på samma sätt som det i dag kan få en aktiv medlem. Gästen ser bara sina egna ärenden, kan kommentera dem och markera dem klara. Vem som får dela ut är samma som i dag; servern prövar att gästen har en levande gruppinbjudan. Drar man tillbaka inbjudan försvinner ärendena ur gästens vy, men ärendet och delegeringen står kvar för medlemmarna. Beslutet kom när skiva 2 var klar: "Lägg den i samma PR (424)", så skivorna är två commits i en PR.

| Fråga | Svar | Varför |
|---|---|---|
| Hur bärs en gäst som ansvarig? | I ärendets `mottagare`: `{ slag: "gast", gastId, namn }`, bredvid `{ slag: "person", uid }`. | Appens ärende bär redan sin mottagare där (`byggMottagare`). Ett andra fält hade varit två sanningar om samma sak. |
| Var bor formen? | I ramverket, på ett ställe: `byggArendemottagare`/`byggGastMottagare` (utdelningen), `gastDelegerad` (serverns urval), `tolkaGastMottagare` (medlemmarnas rad). | Regel 2. Appen, servern och vyn läser samma tre funktioner och ingen skriver en egen `slag === "gast"`. |
| Får ett meddelande en gäst som mottagare? | Nej. `byggMottagare` är meddelandets och kastar på slaget `gast`; ett prov bevisar det. | Gästen når bara servern och har ingen samtalsrad. |
| Vem väljer vilka ärenden gästen ser? | Servern: frågan är på gästen (`where groupId, mottagare.gastId`) och varje svarad rad prövas på nytt mot radens `mottagare` och sessionens `gastId`, i varje åtgärd. `gastId` följer adressen och inte gruppen, så gruppen prövas på raden. | En vy som själv gallrade en längre lista hade varit en andra gräns att hålla i takt, och en delegering i en annan grupp hade synts. Frågan på gästen gör läsningen proportionell mot gästens ärenden, och prövningen per rad gör att en källa som tolkar frågan fel inte kan ge en gäst något hen inte äger. |
| Vad ser gästen av ett ärende? | `GASTARENDEFALT`: rubrik, text, status, förfallodag och kommentarer. Aldrig GitHub-adressen, repots namn, ett uid eller en adress. Appens `bygg` får sprida ut mer; allt utöver `falt` tas bort. | Öppen lista fält för fält, som övriga åtgärder. |
| Vad kan gästen göra? | `kommenteraArende` (1000 tecken, SAMMA takt som chatten, bara text) och `markeraArendeKlart`. Inte öppna igen, byta ansvarig eller skapa. | CP:s spec. Markera klar frågar först i vyn, eftersom den inte går att ångra. |
| Ett ärende som inte är gästens? | Samma `nej` för "någon annans", "en person", "gruppen", "ingen", "en annan grupp", "finns inte" och ett id som försöker bli en sökväg. | En gäst som gissar id lär sig ingenting av skillnaden. |
| Återkallelse? | Ingen skrivning. Åtgärderna går genom `gruppSession`, som läser inbjudan på nytt; ärendena är borta vid nästa anrop. Märket "återkallad" **lagras inte** utan härleds ur `levandeGaster` (`tolkaGastMottagare`). | Ett märke på ärendet hade glidit isär från inbjudan, och en ny inbjudan hade lämnat det kvar. |
| Hur ser medlemmarna det? | `levandeGaster({ uid, groupId })` (alla aktiva medlemmar): `{ gastId, namn }` för gäster med levande gruppinbjudan. `OpsGastMottagare` visar Gäst, eller Gäst (inbjudan återkallad) när gästen saknas i listan. Utan listan: bara Gäst. | "Vet inte" är inte "återkallad". Namnen är redan synliga för gruppen i chatten. |
| Väljaren? | `OpsMottagare` får `gaster`; appen skickar den bara till den som får dela ut. Bara i ärendeläget. | Komponenten gissar inte vem som får. |
| Radering? | `grupp.arenden.radera` KRÄVS och anropas per berörd grupp före inbjudningarna tas bort. | `gastId` är härlett ur adressen: ett id kvar på ett ärende är adressen kvar. |

**Tas som det är / görs bättre / stryks (regel 13, för skiva 3).**
- *Tas som det är:* medlemmens ärendevy som förebild för vad som visas (rubrik, status, text, förfallodag, kommentarer), chattens skrivfält och takt, statuspillret (`statusTone`).
- *Görs bättre:* urvalet görs på servern och inte i vyn; ett nej är likadant för allt gästen inte äger; "återkallad" härleds; en kommentar som appen inte kunde skriva ger tillbaka sin skrivning; Markera klar frågar först.
- *Stryks:* att gästen ser gruppens ärendelista (kan bära sådant som inte rör gästen, och hade krävt en behörighetsmodell per ärende); att gästen öppnar igen, byter ansvarig, skapar eller bifogar; en ärendeinkorg, notiser och sök för gästen; en spegelkolumn med gästens ärenden (en `gastId`-kolumn bredvid `mottagare` hade varit en kopia av samma uppgift; frågan går i stället mot kartfältet `mottagare.gastId` självt, som Firestore indexerar av sig själv).

**Kvar för appen (lifehub.app), för en annan agent att bygga ur detta:**
1. *Serverns delegering* (`DELA_UT_ARENDE`/`delaUtArende` i `functions/agentinkorg.js` och agentregistret): ta emot en gäst som mottagare. Bygg mottagaren med `byggArendemottagare(m, { medlemmar, gaster })`, där `gaster` är `levandeGaster({ uid, groupId }).gaster`, och skriv den med `sattMottagare` (Admin SDK). Samma rätt som att dela ut i dag (`farHantera`). ⛔ **Ändra inte `mottagareGiltig` i `firestore.rules`.** `inkorg` har `allow update, delete: if false` och `create` släpper bara `slag in ['grupp', 'person', 'agent']` (`hasOnly(['slag', 'uid'])`), så en klient kan varken skapa eller ändra ett ärende till en gäst. Det är rätt: delegeringen till en gäst är en serverskrivning och ska förbli det. Läsarna i appen måste däremot tåla slaget `gast` (visa med `OpsGastMottagare`, inte krascha på ett okänt slag).
2. *Kopplingen till tjänsten:* `grupp.arenden` i `createGastService` (se README), med `bygg` som lämnar ut `rubrik`, `text`, `status` och `forfallodag` och ALDRIG GitHub-adressen; `kommentarer` som läser `inkorg/{id}/kommentarer` till `{ id, text, tid, namn, gastId? }`; `kommentera` som skriver kommentaren i appens lokala form (`skrivLokalKommentar`: `synk: "lokal"`, `resultat: null`, `fel: null`, `groupId`) med `skapadAv` = gästen (`uid: null`; reglerna kräver `skapadAv.uid == request.auth.uid`, så bara servern kan skriva den) och ett `gastId` så att `kommentarer` kan märka den. ⛔ **`synk: "lokal"`, aldrig `"vantar"`:** `kommentarTillGitHub` lägger en kommentar med `vantar` på GitHub-ärendet med appens token, och en gästs text ska inte hamna i ett repo (den går då inte heller att radera med gästen); `markeraKlart` som kör `createCaseModel().buildClose("hanterad", { not: "Markerad klar av gästen <namn>" })` med `updateIf` på status `ny`; `radera` som tar bort gästens kommentarer och tömmer `mottagare` på ärenden där `gastId` stämmer. `/api/gast` skickar `GASTGRUPPATGARDER` (nu med `arenden`, `kommenteraArende`, `markeraArendeKlart`) vidare; ett fel med `kod: "ogiltig-text"` är 400 som för chatten.
3. *Spegeln till GitHub:* en gäst kan inte vara assignee. **Rekommendation: ingen tilldelning på GitHub och etiketten `ansvarig:gast`** (skapas om den saknas). Skälet: etiketten är sökbar och syns i listan utan att peka ut en person, medan ingen tilldelning ensam gör ärendet omöjligt att skilja från ett som ingen tagit. Gästens namn skrivs inte till GitHub (ett externt namn i ett repo är en uppgift som sedan inte går att radera med gästen). Tar delegeringen bort gästen (eller flyttas ärendet till en medlem) tas etiketten bort.
4. *Mejl till gästen vid delegering:* en brevvariant i appens `skicka` (`typ`), som bär ärendets rubrik och en länk till `/gast` (gästen har redan en länk; skicka inte om nyckeln, den roteras bara av `skickaOm`). Valfritt: utan det ser gästen ärendet först nästa gång hen öppnar sidan.
5. *Vyerna:* `OpsGastGrupp` visar fliken Ärenden av sig själv när `grupp.funktioner` innehåller `arenden`. I ärendelistan för medlemmar: `OpsGastMottagare` med `levande` ur `levandeGaster` bredvid en `mottagare` av slaget `gast`; i utdelningen: `OpsMottagare` med `gaster` bara för den som får dela ut.
6. *Mätning som inte gjorts:* att frågan `groupId == X och mottagare.gastId == Y` går mot en riktig Firestore utan ett sammansatt index (se risken ovan), och hur många delegerade ärenden en riktig gäst har (taket är `GASTARENDE_SKANNA_MAX`, 2 000 lästa, `GASTARENDE_MAX`, 100 visade).

## Det som inte är gjort, och varför

- **Delegeringen i appen** (servern, reglerna, spegeln till GitHub, mejlet): se "Kvar för appen" i skiva 3. Att en gäst som blir medlem får sina delegeringar flyttade: `ersattAvMedlem` återkallar inbjudan, och delegeringen pekar sedan på ett `gastId` utan levande inbjudan (medlemmarna ser det som återkallad).
- **Att en gäst bifogar något eller svarar i en tråd.** Gästen skriver bara text i huvudchatten (och i kommentarerna på sina ärenden), och vyn säger det ("Du kan inte bifoga filer. Svar i trådar visas inte än").
- **Trådsvar och bilagornas innehåll i gästens chatt.** Bilagan visas med sitt namn ("Bilagor visas inte för gäster"). Se regel 13.
- **Sms (46elks).** Skiva 4.
- **Brevets text** (appens, med en variant för omfånget `grupp`), omröstningens modell, ärendets form, samlingsnamnen och routen `/gast`: appens.
- **Att växla en gäst till medlem.** Appens växling anropar `ersattAvMedlem({ epost, groupId })`, som drar tillbaka gästens inbjudningar i just den gruppen och släpper platsen. Bara servern, aldrig en klient.
- **Mätning mot en riktig Firestore med riktig data.** Tjänsten är provad mot minneskällan (datakontraktet), reglerna mot emulatorn, vyerna i jsdom och i en riktig webbläsare. Ingen produktionsdata har lästs eller skrivits (CP:s säkerhetsregel för det här passet), så "hur många dokument har en grupp i `meddelanden`" är inte mätt: chatten läses en sida om 50 i taget just därför.

## Kvarvarande risker, utskrivna

- **(Skiva 3) En gäst som delegerats ett ärende ser dess text och kommentarer, inklusive vad medlemmar skrivit där.** Det är meningen, men en medlem som kommenterar ett ärende ansvarigt för en gäst skriver till en extern. Vyn säger det inte vid skrivandet på medlemmens sida; det är appens vy att varna i.
- **(Skiva 3) Delegeringen följer adressen, inte inbjudan.** Samma `gastId` efter en ny inbjudan ger tillbaka ärendena. Det är avsett (en återkallad gäst som bjuds in igen ska hitta sitt), men en gäst vars inbjudan drogs tillbaka för att den inte skulle se något får det tillbaka när inbjudan väcks. Den som bjuder in igen bör veta det.
- **(Skiva 3) Frågan förutsätter att appens källa skickar `where`-nyckeln `mottagare.gastId` som den är.** Firestore-källan gör det (`where(field, "==", value)`), minneskällan följer med efter 0.132.0, och Postgres-källan kastar (avsiktligt). Mätt bara mot minneskällan; att Firestore faktiskt behöver inget sammansatt index för `groupId` + `mottagare.gastId` är hämtat ur Firestores dokumentation (två likhetsvillkor slås ihop ur enfältsindex) och inte provat mot en riktig Firestore (ingen produktionsdata har rörts i det här passet). Ger Firestore ändå ett indexfel i appen står indexet i felet: lägg det i `firestore.indexes.json` och deploya index före klienten.
- **(Skiva 3) Namnet på ärendet är en kopia av inbjudans namn.** `levandeGaster` ger det aktuella namnet och `tolkaGastMottagare` föredrar det, så en listad gäst visas alltid med sitt nuvarande namn; en återkallad visas med namnet som stod på ärendet.

- **En gäst är en medlem med få rättigheter för tre funktioner.** Allt som ligger i gruppens kalender och bibliotek syns för hen, också sådant en medlem lagt där men tänker sig som halvprivat, och hen kan skriva i chatten. Appens `handelseSida` avgör hur mycket av en händelse som lämnar servern, och det är appens val att granska.
- **En gäst kan skriva, och en medlem kan bli lurad av ett namn.** Gästens `avNamn` är vad gästen eller den som bjöd in angav, och märket Gäst står alltid bredvid (härlett ur `av`), men ett namn som liknar en medlems syns ändå. Takten (10 per minut) och längden (1000 tecken) begränsar skadan, och `aterkalla` stänger skrivandet vid nästa försök. Ramverket har ingen synlighet per post för gäster med flit (regel 13).
- **Chattens hela historik**, också det som skrevs innan gästen fanns. CP:s beslut, och dialogen säger det.
- **En redan utfärdad filadress lever 15 minuter efter en återkallelse.** Det går inte att dra tillbaka en signerad adress. Texten i dialogen och i `OpsGastLista` säger det.
- **`raderaSvar` kastar när gruppen har fler än 20 000 händelser**: en radering som inte kan lova att ha sett allt ska inte säga att den är klar. En grupp som når taket behöver ett eget städjobb.
- **Kvar efter radering är räknare per IP**, som är en hash av en IP och inget av personen.
- **Servern prövar medlemsregelns villkor för ett svar på egen hand** (`svara`), för det finns ingen transaktion mot reglerna. Tabellen ovan är vakten. Ändras medlemsregeln utan att tabellen ändras blir provet rött på den raden.

## Regel 13: förebilden är ett golv

Ärendet citerar ingen SessionStudio-skärmbild, så regel 12 utlöses inte. Förebilden för ytan är medlemmens egna vyer (golvet), och för modellen designen i #389. De tre listorna:

**Tas som det är.** Modellen från skiva 1 (en gäst är en inbjudan, sessionen per inbjudan, platser som fasta dokument, nyckeln i fragmentet, felräknare per inbjudan och IP). Medlemmens kalender, händelsepanel, biblioteksvy och chattbubblor: ytan ska se likadan ut för den som redan känner appen. Rollen ägare eller admin för att bjuda in. Hela chatthistoriken.

**Görs bättre, och skälet.**
- *Biblioteket signerar bara det som öppnas*, inte hela listan (punkt 4). Billigare och rätt tak.
- *En person en plats*, oavsett antal omfång. Ett omfång ska inte kosta en plats till.
- *Dra tillbaka alla* i ett anrop, med rätten prövad på varje rad före något ändras.
- *Bekräftelsen säger vad gästen ser.* Medlemmen annars inte vet att hela historiken följer med.
- *Radering och integritetstext finns före första gästen*, på båda sidor (medlemmen och gästen).
- *Alla sparade sessioner prövas* (punkt 5).
- *Flikarna är 44 px* (`OpsTabs`, grundformen, var 42) och får plats i en telefon (12 px sidoluft under 640 px).
- *Gästen ser aldrig vem som svarat*, bara summor och sitt eget svar.
- *Gästen skriver som gäst och aldrig som medlem*: egen identitet (`g_`-id), märket Gäst härlett ur `av`, tak på längd och takt, och gästens meddelanden raderas med gästen. Förebilden (chatten) ger en medlems ställning; en gäst får hälften.
- *Bifoga på kommentarer är en gem i skrivrutan* (som chattens Bifoga) och inte en stor knapp under rutan.
- *Gästen bjuds in där medlemmar bjuds in* (`OpsMedlemmar`), i samma ruta, med räknare och bekräftelse.

**Stryks, och vad det hade kostat.**
- *Gruppens ärendelista i gästvyn:* **stryks**, skälet är att ärendelistan kan bära sådant som inte rör gästen (en sort som hör till Ekonomi, ett ärendes GitHub-adress, ett kvitto). Att filtrera fram det som rör gästen hade krävt en behörighetsmodell per ärende. Det som är med är bara det som delegerats till gästen (skiva 3, ovan), valt av servern på gästens id.
- *Bilagor och uppladdning från en gäst:* en gäst som laddar upp är en gäst som kan fylla lagringen. Gästen skriver bara text.
- *Skriva i trådar:* trådsvar visas inte i gästens chatt, och gästen skriver bara i huvudchatten.
- *Privata samtal, agentens meddelanden och Ekonomi:* en gäst har inget i dem att göra. Agentens egna meddelanden döljs i chatten; ett medlemsmeddelande som citerar agenten går inte att filtrera och ingen påstår något annat.
- *Mitt bibliotek och händelsens eller ärendets filer i gästens bibliotek:* bara gruppens egen plats. Hade krävt en behörighetsmodell per post.
- *Synlighet per post för gäster:* hade varit "permissions-träsket" (ADR-020 i SessionStudio: läsregler som avgör vem som ser vad, som föll på Firestores gräns för `exists()`). Gäster når bara servern, så ingen läsregel behövs, och priset är den kvarvarande risken ovan: allt i kalendern och biblioteket syns, och chatten.
- *Bilagornas innehåll och trådsvar i gästens chatt:* en signering per bild i en historik på hundratals meddelanden hade tagit gästens filtak på en sida.
- *Reaktioner, fästa meddelanden och sök i chatten:* ingen av dem behövs för att läsa, och varje är en egen yta att hålla i takt.

## Proven, båda riktningarna

Siffrorna och mutationerna står i CHANGELOG och i PR-texten. Kärnan: tjänsten har läckageprov med seedade medlemmar (adresser, uid, andra gäster, privata samtal, agenten, pengar och en annan grupp: inget syns i något svar), återkallelse nekas vid nästa anrop i varje åtgärd, en omröstningsgäst når inte gruppen, taket delas mellan omfången, den signerade nedladdningen har rätt fil, tak per dygn och ingen adress efter återkallelse, och radering lämnar ingen adress, identitet eller sessionsnyckel i någon samling (provet kan SE ett spår: före raderingen finns alla).

## Ompinningen i appen (lifehub.app)

Se README, avsnittet "Gäster", och slutrapporten i PR-texten. För skiva 3, se "Kvar för appen" ovan: appens ärendedelegering, `grupp.arenden`, spegeln till GitHub och mejlet. I korthet, i den ordning som är säker: ompinna till 0.132.0; lägg `grupp` (utan `arenden`) och `radering` i `createGastService`; låt `/api/gast` skicka `GASTGRUPPATGARDER` (nu med `skrivChatt`) och `raderaMig` vidare, svara 429 på `for-manga` och 400 på ett fel med `kod: "ogiltig-text"`; ge `gastBjud` slaget `grupp`, `gastLista` ett `groupId`, och två nya callables (`gastAterkallaAlla`, `gastRadera`); en brevvariant för omfånget `grupp`; `ersattAvMedlem` i växlingen; och i vyerna `OpsMedlemmar` med `gaster` (inbjudan sitter i Roll under Bjud in) och `/gast` med `renderGrupp` och `onRaderaMig`. Medlemmarnas chatt behöver ingenting: `Meddelanderader` märker en gäst ur `av`. Inga regler, index eller `firebase.json` ändras, så ordningen "regler före klient" gäller inte; deploy är bara functions.
