# Design: publik delning av en händelse, och en adressmodell för fil och händelse (cllp/lifehub.app#377)

Status: förslag, granskas av Claude innan steget mergas. Ärende: cllp/lifehub.app#377, CP:s beslut 2026-10-19 ("Ja på båda, kör skiva 1", och de tillägg som kom under arbetet, nedan). Ramverkets del: cllp/ops-framework, gren `claude/377-publik-handelse`, version 0.125.0.
Relaterat: 0.119.0 (delning av en biblioteksfil, lifehub.app#356), 0.121.0 (en händelses filer är en plats, beslut 0006), 0.123.0 (`farRedigera` i `createFlyttaService`, beslut 0008).

## Händelsen

CP 2026-10-19: "Om jag vill att andra skall kunna ta del av resan men inte är med i gruppen? Kan vi ha en publik händelse som jag kan dela med sms eller mail och som ser ut som en bra strukturerad websida. Kan vara skyddad med en kod (optional). Då kan vem som helst se den. Vidare kan jag välja att skapa olika länkar för olika rättigheter, läsa eller skriva. Vill att man skall kunna ta del av filer också."

Skiva 1 är läslänken. Skrivlänken (skiva 2) byggs inte nu, men modellen ska inte göra den svår. Under arbetet kom fem tillägg från CP, och de ändrar formen på lösningen:

1. Språkval i en egen header på den publika sidan, och datum och tid högst upp och stort ("Det skall vara tydligt på händelsen, vilka datum det gäller").
2. En läsbar adress i stället för ett slumpat token, "t ex. life-hub.app/g/travel/resa-med-kusiner".
3. Alla länkar ska synas på händelsen med sin fulla adress, så att man kan klippa ur dem och skicka dem ("Alla url:er måste framgå på händelsen").
4. Samma läsbara adress för delade filer ("https://my.life-hub.app/music/lib/bubbelglasen.ver2 istället för https://my.life-hub.app/d/gr0g87fx-Eg8...").
5. Typsegment i adressen för båda målen: `lib` för en fil och `event` för en händelse.

## En modell, inte två (regel 2)

Delningen från 0.119.0 har redan det svåra: en rad per länk, giltighet, återkallning, en lista över aktiva länkar och en publik sida. En händelse är ett nytt MÅL för samma länk, och en fil får samma adress som en händelse. Det finns därför en delningsrad, med tre nya fält:

| Fält | Värden | Gammal rad |
|---|---|---|
| `slag` | `post` (en fil) eller `handelse` | saknas, läses som `post` |
| `rattighet` | `las`, och inget annat i skiva 1 | saknas, läses som `las` |
| `adress` | `<gruppdel>/lib/<fildel>` eller `<gruppdel>/event/<händelsedel>` | saknas (raden har ett token) |

Plus `handelseId` för en händelse (där `postId` är filens), `kod` (valfri, `{ salt, hash }`) och `felAntal` och `felFonster` (räknaren för felaktiga koder). `giltigTill` är `null` för ingen gräns, och bara för en händelse.

**Rättigheten är ett fält som skiva 2 kan ge ett andra värde.** `hamta` öppnar bara `las` (eller en rad utan fältet) och svarar `utgangen` på allt annat. En framtida skrivlänk kan alltså inte läsas som en läslänk av en server som inte känner den, och det är bevisat i `delning-adress.test.js`. En skrivlänk kommer att kräva kod (CP:s förslag på #377), vilket modellen redan stödjer.

## Adressen

`/g/<gruppdel>/<typsegment>/<sista del>`, med typsegmenten `lib` (en fil) och `event` (en händelse). Segmenten är en fast lista i ramverket (`ADRESSSEGMENT`): ett framtida mål, till exempel ett ärende, blir ett nytt ord i listan och inte en ny form. Därför behövs inga reserverade ord i sista delen: `/g/travel/event/lib` är en vanlig händelse.

- **Prefixet `/g/` behålls** så att en grupps namn aldrig krockar med appens egna sökvägar (`/d/`, `/hub`, ...).
- **Delarna** är gemener, siffror och enstaka bindestreck, högst 40 tecken när en person skriver dem (`adressdel`). Förslaget kommer ur gruppens namn och målets titel: gemener, å/ä/ö till a/a/o, allt annat till ett bindestreck. Personen kan ändra båda delarna i rutan.
- **Punkten blir ett bindestreck** (`bubbelglasen.ver2` blir `bubbelglasen-ver2`). Skälet: en punkt i sista delen av en adress läses som ett filnamn (`.pdf`, `.mp3`) av CDN-regler, webbläsare och länkigenkänning; en punkt sist i en länk i ett sms tas bort av meddelandeappar som skiljetecken; och `..` kan aldrig bli en sökväg som går uppåt. Bindestrecket är säkert i alla tre. Kostnaden är att CP:s exempel `bubbelglasen.ver2` blir `bubbelglasen-ver2`.
- **Ramverket bygger bara sökvägen** (`delningsSokvag`). Domänen är appens: `delningsUrl(bas, sokvag)` lägger ihop dem, och basadressen är instansens (för LifeHub `https://my.life-hub.app`).

### Utan kod: ett slumpat slut. Med kod: exakt det personen skrev

UTAN kod lägger servern själv till `-` och åtta tecken ur a-z och 0-9 på sista delen (`resa-med-kusiner-k7f3q9x2`), slumpade med `randomBytes` och utan modulo-skevhet. Slutet går inte att ta bort: det läggs på av `skapa`, inte av rutan. Skälet är CP:s: en läsbar adress kan gissas, och utan en kod är adressen det enda skyddet. Åtta tecken ger drygt 2,8 biljoner möjligheter. MED kod får adressen vara exakt det personen skrev, eftersom koden då är skyddet. Rutan säger det i en mening som byter text medan koden skrivs.

### Id är SHA-256 av sökvägen, och `createNew` avgör unikheten

Dokumentets id är SHA-256 (hex) av `<gruppdel>/<typsegment>/<sista del>`, som tokenet var det. Att adressen redan är upptagen avgörs av `createNew` på id:t, alltså av databasen och inte av en läsning följd av en skrivning (regel 2). Svaret är ett eget fel, `kod: "adress-upptagen"`, och rutan föreslår nästa (`resa`, `resa-2`, `resa-3`). Utan kod försöks en krock på slumpslutet om fem gånger innan felet kastas.

**En stängd eller utgången adress blir aldrig ledig.** Raden finns kvar, så `createNew` nekar. Skälet: en gammal länk i ett sms ska aldrig kunna börja visa något annat. Priset är att en person som återkallat `/g/travel/event/kusinresan` inte kan skapa exakt den igen och får förslaget `kusinresan-2`.

### Adressen lagras ändå i klartext (en avvägning, och den är CP:s att vända)

Den första versionen av beslutet var att bara hashen sparas, så att en läsning av databasen inte ger alla adresser. CP:s senare krav, att varje aktiv länk ska stå på händelsen med sin fulla adress så att den går att klippa ur och skicka, går inte att uppfylla med bara en hash. Raden bär därför `adress` i klartext, och id:t är kvar som hashen av den (nyckeln och unikheten).

- **Vad som förloras:** den som kan läsa databasen (administratör, export, säkerhetskopia, en logg som skriver hela raden) ser adresserna, och för en länk utan kod är adressen hela skyddet. För en händelse ser den personen redan händelsens innehåll i samma databas, så det som läcker är inte mer än det som redan låg där. För en fil gäller samma resonemang om filens post, men inte filen: den ligger i Storage och nås bara via en signerad adress.
- **Vad som är kvar:** hashen som nyckel, `createNew` som unikhet, och att adresser aldrig skrivs i en logg av ramverket.
- **Alternativet:** visa adressen en gång, som för tokenet i 0.119.0, och spara bara hashen. Det ger ingen lista med adresser på händelsen. Det valdes bort för att CP uttryckligen bad om det motsatta. Vill CP vända det är ändringen liten: ta bort `adress` ur raden och `sokvag` ur `lista`, och panelens rader visar då en text i stället för adressen.
- **Gammal tokenlänk:** har bara hashen. `lista` svarar `sokvag: null` för den, och dialogen säger att adressen bara visades när länken skapades.

## Koden

- **Sparas aldrig i klartext.** `scrypt` (N 16384, r 8, p 1, 32 byte) med eget salt på 16 byte per länk, och jämförelse med `timingSafeEqual`. Två länkar med samma kod får olika salt och olika hash.
- **Längd:** 6 till 64 tecken efter NFC och trim. Golvet 6 beror på räknaren nedan: en kort kod är ändå en kort kod. En kod som är för kort är ett fel (`ogiltig-kod`) och aldrig "ingen kod": en länk som skulle vara skyddad blir aldrig öppen för att koden var för kort.
- **Gäller både fil och händelse** (CP:s tillägg 4).
- **Orsaker:** `kod-kravs` (ingen kod angiven) och `fel-kod` svarar utan att säga något annat om målet. Att länken finns går att se av `kod-kravs`; det går inte att undvika för en sida som ska be om koden.

### Hastighetsbegränsningen: appens räknare OCH en egen per länk

Appens räknare (lifehub.app `functions/delning.js`, `GRANS_PER_TOKEN` 60 och `GRANS_PER_IP` 300 per minut) finns redan. Den räknar uppslag, inte koder. Den täcker det den byggdes för, gissning av adresser och token, men räcker inte för en kod: 60 uppslag i minuten mot en sexsiffrig kod är en kod på drygt tre dygn, och räknaren ser inte vilka försök som var koder. Därför:

- **Gissning av adresser:** appens räknare, per IP och per adress, oförändrad. Ramverket ger `delningsNyckel(ref)`, som är samma id för ett token och för en adress och `null` för skräp, så att räknaren kan räkna på nyckeln i stället för på `TOKENFORM`-prövningen och så att en gissning på en adress som inte finns räknas lika som en som finns. Slumpslutet gör att en adress utan kod inte går att gissa med den takten.
- **Fel kod:** en egen räknare per länk i tjänsten, på raden (`felAntal`, `felFonster`). Högst fem felaktiga koder per 15 minuter och länk, sedan svarar länken `for-manga` även på rätt kod. Det är medvetet: annars kan gissningen fortsätta. Priset är att någon som vet adressen kan låsa en länk genom att gissa fel (en tjänstenekande attack mot en länk). Mildrat av att fönstret går ut, och att ägaren kan skapa en ny länk.
- **Försöket reserveras innan koden prövas** (`updateIf`, ett villkorat steg), och ges tillbaka när koden stämde. Räknades det efter prövningen kunde hundra parallella gissningar alla passera spärren medan räknaren stod på noll, och rätt kod bland dem hade släppts in. Provet `parallella gissningar` bevisar det (rött med en ovillkorad skrivning).
- **Tillbakagivandet:** en besökare som öppnar sidan igen och igen med rätt kod får inte låsa länken, så ett lyckat försök ges tillbaka.

## Giltighet

- **Händelse:** förvalt ingen gräns (`null`), och alltid möjlig att återkalla. 1, 7 och 30 dagar går att välja. `hamta` släpper bara in `giltigTill: null` för en rad med `slag: "handelse"`; en fillänk med `null` är en trasig rad och öppnas aldrig.
- **Fil:** oförändrat 1, 7 och 30 dagar, förval 7. "Ingen utgång" finns inte för en fil.

## Händelsens sida

Svaret är en lista fält och inget annat (`HANDELSESVARSFALT`): titel, beskrivning, plats, datum, slutdatum, tid, sluttid, heldag, filerna och hur många som inte fick plats. Gruppen, medlemmarna, svaren, chatten och kommentarerna finns inte i svaret och läses aldrig. Svaret byggs fält för fält ur händelsen, så ett fält som appen lägger till i sin händelse eller i svaret från `handelseSida` följer inte med av misstag.

- **Appens fält:** ramverket känner inte appens `rubrik`, `text` och `plats`. Appen skickar `handelseSida(handelse) => { titel, beskrivning?, plats? }`; tidsfälten läser ramverket själv ur `HANDELSEKONTRAKT`. En `handelseSida` utan titel kastar (en felkonfigurerad app ska synas, inte ge en sida som ser ut att fungera).
- **Arkiverad eller borttagen** händelse, en händelse som flyttats till en annan grupp än länkens, och en med en tid som inte går att läsa, svarar `handelse-saknas`.
- **Filerna** ligger på platsen `handelse~<grupp>~<händelse>`. Bara färdiga filer (typ fil, aldrig anteckningar eller länkar), och en fil som tagits bort finns inte i listan. Varje post läses om med `read` (och går därmed genom appens egen läsning, till exempel sökvägsprovet) innan den signeras. Högst 50 filer, och `ejVisade` säger hur många som inte fick plats.
- **En signerad adress per fil, `inline`.** Ett val: en bild, en PDF och ett ljud ska öppnas, och en `attachment`-adress gör att de sparas i stället. Webbläsaren sparar det den inte kan visa. Att sidan har två adresser per fil (en att öppna och en att ladda ned) hade dubblerat antalet signeringar, som med Admin SDK och IAM är ett nätverksanrop var.
- **Uppdatering:** sidan läses vid varje besök, så en ändring i händelsen syns direkt.

## Vem får

- **Dela:** en aktiv medlem i händelsens grupp (inte en agent), OCH det appen säger i `farDelaHandelse({ uid, groupId, medlemskap, handelse })`, om appen ger en. Prövas EFTER medlemskapet, aldrig i stället för det, och måste svara exakt `true`. Gruppen läses ur händelsens egen rad och aldrig ur anropet.
- **Återkalla:** den som skapade länken (alltid, också efter att hen lämnat gruppen), gruppens ägare och admin, och den som `farDelaHandelse` släpper in (kräver att hen fortfarande är aktiv medlem och att händelsen finns). **Utan appens regel** finns ingen "får ändra händelsen" att låna, och då stänger bara skaparen, admin och ägare. Ett prov bevisar att en vanlig medlem inte kan stänga andras länkar.
- **Lista:** en medlem ser sina egna länkar, admin och ägare och den appens regel släpper in ser alla länkar till händelsen.
- **Firestore-reglerna** är oförändrade: delningssamlingen är `allow read, write: if false` för klienten. Allt går genom Admin SDK.

## Språk och datum på den publika sidan

Sidan har ett eget huvud med appens logga till vänster (`huvud`) och SV/EN till höger. Förvalet är webbläsarens språk (svenska om det börjar på `sv`, annars engelska), valet sparas i `localStorage` (med `try/catch`: privat läge eller blockerad lagring stoppar inte sidan), och allt ramverket skriver följer valet. Händelsens titel och beskrivning översätts inte. Datumen skrivs ut av ramverket (`lör 26 dec 2026`, `Sat 26 Dec 2026`) och inte med `Intl`, vars format skiljer mellan ICU-versioner. En händelse över flera dagar står som "lör 26 dec 2026 till sön 10 jan 2027, 16 dagar", en heldag som "Heldag", ett klockslag med klockslaget. Plats på en egen rad med ikon.

## Gamla länkar lever kvar

Delningar från 0.119.0 till 0.124.0 har ett token (`/d/<token>`) och är oförändrade: `hamta(token)` öppnar dem, `lista` visar dem (med `sokvag: null`), och de går att stänga och ändra som förut. De har en giltighet på högst 30 dagar, så **alla går ut senast 30 dagar efter att appen går över**.

**Brytande:** `skapa` ger inget token längre och kräver en adress (`gruppdel` och `fildel` för en fil). En fil som delas efter 0.125.0 får den nya formen. Appen byter anrop i samma ompinning. `byggDelning` och `nyttDelningstoken` finns kvar för att bevisa att en gammal rad öppnas, och kan tas bort tillsammans med tokenvägen i `hamta` när alla gamla länkar har gått ut.

## Det som inte är löst

1. **Vem som helst i en grupp kan välja vilken gruppdel som helst.** `/g/<vad som helst>/event/...` är ledigt åt den som tar det först, så `/g/banken/event/logga-in` kan skapas av en medlem i en grupp som inte heter banken. Sidan visar bara en händelses text och filer och har inga formulär, men en länk som ser ut att komma från någon annan är en bluff. Ett försvar kunde vara att gruppdelen måste vara ledig åt en enda grupp (en egen samling) och inte bara en del av nyckeln; det är en andra sanning och byggs inte utan ett beslut.
2. **En länk med kod avslöjar att den finns** när den svarar `kod-kravs`. Samma sak gäller en tjänstenekande attack mot en länk (se ovan).
3. **En händelsefil kan vara stor.** Sidan visar inte filens storlek före öppning mer än som text, och 50 filer är taket.
4. **Åtta tecken** i slutet är ett golv (CP: minst åtta). Vill CP ha tolv blir adressen längre i ett sms.

## Skiva 2 (inte byggd)

En skrivlänk är samma rad med `rattighet: "skriv"`, och kräver alltid en kod (CP:s förslag). Det som saknas är vad en gäst får göra (kommentera och ladda upp filer, enligt förslaget), en egen vy och egna regler för vad en gäst får skriva. Ingenting i modellen ovan behöver ändras för det.

## Regel 12 och 13

Ärendet citerar ingen SessionStudio-skärmbild, så regel 12 utlöses inte. Det finns heller ingen förebild som skivan följer (regel 13): sidan är LifeHubs egen, och de tre listorna i PR-texten beskriver i stället vad som tas från delningen i 0.119.0, vad som görs annorlunda och vad som lämnas.
