# Design: ett ärendes filer (cllp/lifehub.app#366, punkt 3)

Status: förslag, granskas av Claude innan steget mergas. Ärende: cllp/lifehub.app#366, CP:s beslut 2026-10-19 (https://github.com/cllp/lifehub.app/issues/366#issuecomment-6271704171). Ramverkets del: cllp/ops-framework, gren `claude/366-arendefiler`, 0.122.0.
Relaterat: beslut 0006 (en händelses filer, 0.121.0, den modell det här följer), 0004 (biblioteket), 0.101.0 (Mitt bibliotek), 0.119.0 (delning).

## Händelsen

CP 2026-10-19, #366: biljetterna till bion ska ligga på ärendet "köpa biljetter före fredag", inte bara på händelsen. Mätt mot appen samma dag är ett ärende i LIFE Hub i själva verket två poster som inte har ett gemensamt hem:

| | Inkorgsposten | GitHub-kopian |
|---|---|---|
| Var | `inkorg/{id}`, appens egen | `groups/{gid}/arenden/github_{nr}`, serverns spegel |
| Filer | en bilaga som data-URL, tak 700 000 tecken (cirka 500 kB) | inga, bara texten "Bilaga i inkorgen: namn" |
| Klienten får ändra | nej (`update, delete: if false`) | nej (`write: if false`) |

En vanlig biljett-PDF går inte in under 500 kB, och en bilaga som bor i GitHub-kopian syns inte för den som inte har ett repo kopplat. CP:s beslut samma dag: ja på alla tre frågorna i förslaget. Ärendet bor i appen oavsett GitHub, fliken Ärenden finns i alla grupper, och datumet skrivs till GitHub som `due:` åt ett håll (appens delar, A1 till A4).

## Beslutet: ärendet bor i appen, GitHub är en spegel, och filerna har en egen plats

Tre rader som gäller före allt annat:

1. **Hemmet är inkorgsposten.** Dess id är ärendets id. GitHub-kopian är en spegel och pekar tillbaka via `resultat.url`. Ett ärende som aldrig kom ur appen (repots egna) förblir en spegelrad med `github_{nr}` som id och har inga filer, för det finns ingen post att hänga dem på.
2. **Filerna bor på en egen plats**, `arende~<grupp>~<inkorgspostens id>`, på samma sätt som en händelses (beslut 0006) och Mitt bibliotek (0.101.0). Valet mot ett fält `arendeId` på en post i gruppens plats är det som redan gjordes för händelsen och gäller här av samma skäl: ingen ny modell (posten och dess fält är desamma), frågan `where groupId == plats` är ett fält och behöver inget index, gruppens bibliotek ser aldrig ärendets filer, och storage-sökvägen bär platsen så behörigheten är två dokument och inte tre.
3. **GitHub får aldrig filer.** Bara filnamnen i texten vid skapandet, som i dag. Ett kundunderlag ska inte bli publikt av misstag, och filer till ett repo kräver en egen åtkomstmodell mot det.

Prefixet är `arende~`. Ett grupp-id följer `ID_FORM` och ett ärende-id (inkorgspostens id) `ARENDEIDFORM`, som är samma uttryck som `HANDELSEIDFORM` (ett id i Firestore: `[A-Za-z0-9][A-Za-z0-9_-]{0,127}`), och ingen av dem har `~`. Platsen kan alltså aldrig krocka med en grupp, `mitt~<uid>`, `handelse~...` eller kalenderpostens `post~<id>`. Formen byggs av samma funktion som händelsens (`platsform`), så de två inte kan glida isär.

## Vem får läsa och skriva

Samma behörighet som händelsens, och skälet är samma: ett ärende har ingen egen behörighet, det ärver gruppens.

| | Regel (Firestore, posten under platsen) |
|---|---|
| Läsa | Aktiv medlem i platsens grupp, OCH posten finns i appens ärendesamling, OCH postens `groupId` är platsens grupp. |
| Lägga till | Samma, OCH medlemskapet är en person (inte en agent), OCH `typ == "fil"`, OCH `skapadAv.uid` är den inloggade, OCH vanliga postvillkor (serverns klocka, fält, tak, MIME, sökvägen = platsen). |
| Ändra | Författaren (aktiv medlem), eller ägare/admin i gruppen. |
| Radera | Den som laddade upp sin egen fil, ägare och admin alla. |
| Storage | Läsa: aktiv medlem i platsens grupp. Skriva: som posten, alltså aktiv medlem som skrev posten, eller ägare/admin, och posten finns med samma plats. Ingen radering från klient. |

Appens ärendesamling skickas in (`bibliotekregelfragment(namn, { arenden: "inkorg" })`): ramverket känner aldrig samlingsnamnet. Det ramverket kräver av den är att dokumentet har ett `groupId`, vilket en inkorgspost har.

Tre skydd som inte får saknas, alla tre provade ett i taget i emulatorn:

- **Platsens grupp = postens grupp.** Utan det kan en medlem i A skapa `arende~A~<id>` där id:t ligger i B och få läsa B:s ärendefiler via sin egen gruppbehörighet.
- **Posten måste finnas, i RÄTT samling.** Ett ärende-id slås upp i ärendesamlingen och ett händelse-id i händelsesamlingen. Ett id som finns i den andra samlingen är ingen post här. Det provas åt båda hållen, eftersom de två grenarna ligger i samma fil.
- **Grenarna utesluter varandra.** En plats som börjar `arende~` prövas bara som ärendeplats, aldrig mot `memberships` med hela strängen som grupp. Provat med ett medlemskap vars grupp är själva platsen.

Stora val som tas utan att fråga, med skäl:

- **Bara filer.** En anteckning på ett ärende är ärendets text, och kommentarerna finns redan (inkorgens tråd, #381). Regeln nekar `anteckning` och `lank` på platsen, och `postFel` säger samma sak i klienten, med ett skäl som nämner ärendet.
- **Alla aktiva medlemmar får lägga till filer, inte bara den som skapade ärendet.** Inkorgsposten kan inte ändras av klienten (`update, delete: if false`), så det finns ingen "redigera ärendet" att binda sig vid. Samma regel som för gruppens bibliotek och för en händelse. Appen döljer Ladda upp via `kanLaggaTill`.
- **Ingen `skrivvillkor`-ratt**, av samma skäl som för händelsen: en andra konfigurationspunkt att hålla lika med appens egen regel.

## Gränssnitt: en komponent, inte en kopia

`OpsHandelsefiler` (0.121.0) var sektionen "Filer" för en händelse. Att kopiera den till ett ärende hade gett två komponenter som glider isär (regel 2), så den görs generell:

- **`OpsPlatsfiler`** är sektionen. Den tar `kalla` (bibliotekskällan för objektets plats), `jag`, `kanLaggaTill`, `rubrik` och de övriga propar `OpsBibliotek` redan har. Vilket slag objektet är (händelse eller ärende) läses ur källans plats, så det finns ingen andra uppgift att hålla lika med den. `slag` är bara en spärr: ger appen det kastar komponenten om källan är av ett annat slag, så att ett ärendes filer aldrig ritas under en händelse. Utan `slag` godtas båda. En källa för gruppens plats kastar alltid.
- **`OpsHandelsefiler`** finns kvar som ett namn: `OpsPlatsfiler` med slaget låst till händelse. En app som redan använder den ser ingen skillnad (samma `data-handelsefiler`, samma texter). Ett ärende får `data-arendefiler`.
- **`OpsBibliotek`** får `tomText` (meningen under "Inga filer än."), eftersom den stod hårdskriven till händelsen.
- **Platsen syns inte i platsväljaren, och inget flyttas dit eller därifrån**, av samma tre skäl som för händelsen (en flytt är ett beslut om vem som ser filen; varje extra väg in är en väg som måste hålla reglerna; en lista man inte kan välja ur är en lista man inte kan välja fel i). `OpsBibliotek` kastar om en ärendeplats ges som `platser` eller `grupper`, och `flyttaBibliotekspost` kastar åt alla håll, också mellan ett ärende och en händelse. En gemensam `arObjektbibliotek` gör det till en regel och inte två.
- **Delning och utskrift** fungerar utan ny kod i vyn. Delningstjänsten slår upp medlemskapet via `gruppForPlats`, som nu känner båda platserna. Appens server (utskrift, delningens callable) gör samma uppslag.

## När ärendet tas bort

En klient raderar aldrig en inkorgspost (`update, delete: if false`), så det vanliga fallet behöver ingen städning: filerna ligger kvar med ärendet. Hård radering med Admin SDK (gallring, en begäran om radering av uppgifter) lämnar posterna på platsen kvar, och reglerna gör dem osynliga i samma stund (läsning kräver att posten finns). Det som återstår är skräp och inte åtkomst.

- `createPlatsfilerService({ kalla, samlingar: { bibliotek } })` (ny, `ops-framework/node`): `stada({ plats, skarpt })` raderar platsens poster, för en händelses eller ett ärendes plats. Torrt som förval, och svaret har alltid alla fält. Den kastar för allt som inte är en objektplats, före något läses: en städning av gruppens egen plats hade tagit bort alla gruppens filer.
- `createHandelsefilerService` är kvar med samma anrop (`stada({ groupId, handelseId, skarpt })`), byggd på samma tjänst.
- Objekten tar appens `bibliotekstadning` bort när posten försvinner. Ramverket rör inte bucketen.

## Regel 13: tre listor

**Tas som det är:** posten, fälten, taken, MIME-listan, ljudspelaren, utskriften, delningen, kallan, `farAndra`, storage-sökvägen, hela behörighetsmodellen och prövningen av regler från beslut 0006, och förslagets modell: inkorgsposten som ärendets hem.

**Görs bättre än förebilden:**
- Filer får en plats i stället för en data-URL i ärendets dokument. Taket 700 000 tecken stoppar en vanlig biljett-PDF; biblioteket klarar 25 MB.
- Länk och filer är oberoende av GitHub. Ingenting av detta beror på att ett repo är kopplat.
- Platsens grupp pinnas mot postens grupp i reglerna, så en påhittad plats inte öppnar en annan grupps ärendefiler.
- Händelsens och ärendets grenar byggs av en konstruktion i generatorn (och en i platsformen), inte två kopior. Utan valen är texten byte för byte den som 0.121.0 skrev, mätt mot sparade fixturer.

**Stryks, och vad det hade kostat:**
- Ärende och händelse som en post: status, prio och GitHub-spegling på varje möte, eller klockslag på varje uppgift. Två modeller i en.
- Anteckningar och länkar i ärendets filplats: kommentarerna finns redan och reglerna nekar dem på platsen.
- Flytta eller kopiera filer mellan ärende och händelse: ett beslut om vem som ser filen utan en kontroll i klienten.
- Filer till GitHub: publicerar underlag och kräver en egen åtkomstmodell mot repot.
- En fältkopia av `groupId` eller ärende-id på posten som en andra sanning: härleds ur platsen (`arendedelar`).

## Vad som INTE ingår (och varför)

- **Allt i appen** (A1 till A4): fältet Förfaller och postens synliga bilaga, regeldeployen före klienten, sektionen Filer på ärenderad och post, länken nycklad på postens id, fliken Ärenden i alla grupper, serverfunktionen som ändrar datumet, `due:` mot GitHub och kalenderlagret. Ramverket levererar platsen, reglerna, sektionen och städningen.
- **Montage mot SessionStudio (regel 12):** ärendet citerar ingen SS-skärmbild, bara "som i sessionstudio", så regeln utlöses inte. Ingen skärmbild bredvid förebilden har tagits.
- **Spegelrader** (`github_{nr}`) får inga filer: de är serverns och saknar post.

## Prov (golv och båda riktningarna)

Emulatorprov (`rules/__tests__/arendefiler.test.mjs`, Firestore och Storage): medlem läser; utomstående nekas; medlem i en annan grupp nekas; ett ärende i en annan grupp nekas; plats för ett ärende som inte finns nekas; ett ärende-id som bara finns som händelse nekas och tvärtom; ett medlemskap vars grupp är platsen nekas; avslutad medlem och agent nekas att lägga till; anteckning och länk nekas; författaren raderar sin fil, en annan medlem inte, admin och ägare alla; storage läser och skriver enligt samma; händelsens filer läses och skrivs som förut. Golv: minst 12 släppta och 30 nekade utfall mätta, och listan en medlem läser har minst 4 poster. Mutationskörning: varje nekande villkor tas bort ett i taget och provet för det ska bli rött (utfallen skrivs i PR-texten). Vitest: platsen, `gruppForPlats`, `postFel` och `farAndra`, platsväljaren och flytten kastar, regelfragmenten byte för byte utan valen (mot fixturerna i `rules/__fixturer__`), delningen, städningen, `OpsPlatsfiler` och spärren mellan slagen.
