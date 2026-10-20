# Design: gäster, en inbjudan och aldrig ett konto (cllp/lifehub.app#389, ramverkets del, skiva 1)

Status: byggd i 0.131.0, granskas av Claude innan steget mergas. Ärende: cllp/lifehub.app#389 (epiken). Designförslaget: https://github.com/cllp/lifehub.app/issues/389#issuecomment-6289083968. CP:s beslut 2026-10-20: https://github.com/cllp/lifehub.app/issues/389#issuecomment-6290267318 ("Kör på alla 3, men sätt max 5 gäster.").
Relaterat: beslut 0009 (publik delning, som felräknaren och nyckelhashen är lånade från), beslut 0010 (datumomröstningen, vars skiva 2 är den första användningen), lifehub.app#377 (skrivlänken stryks) och #383 (skiva 2 hänvisas hit).

## Händelsen

CP 2026-10-20: externa ska kunna vara med på riktigt, i en sak eller i ett helt projekt. Första användningen är att externa röstar Ja, Kanske eller Nej på ett datum (#383). Designförslaget mätte att Identity (där alla medlemmar loggar in) är fel ställe för det: ett Identity-konto ger en gäst en katalogpost, en kontomeny och en egen grupp att skapa, brevet blir två (appens och Firebases), Identity läser inte `returnTo` så målet tappas, och Identitys egen feltext säger att länken "fungerar bara en gång och kan ha öppnats av ditt e-postprogram". CP valde väg B: en gäst är en inbjudan, appen får en egen gästväg, Identity rörs inte. Det ersätter för gästerna beslutet 2026-10-02 att Identity är den enda inloggningen; för medlemmar gäller det fortfarande.

## Beslutet i en tabell

| Fråga | Svar | Varför |
|---|---|---|
| Vad är en gäst? | En rad i `gastinbjudningar`. Inget konto, ingen katalogpost, ingen Firebase-token, **ingen rad i `memberships`**. | Mätt i designförslaget (lifehub.app 7ffc669; inte mätt om i det här passet): 55 regelställen i appen och 25 i ramverkets fragment prövar ett aktivt medlemskap, 32 plus 15 `status`-prov på `aktiv` och 16 plus 3 `typ !== "agent"`. En gäst som en aktiv rad släpper in hen överallt där `aktiv` är hela provet, och varje missat ställe är ett hål. Beslut 7 i epiken (skydd per funktion) blir då fail-open. |
| Hur når gästen data? | Bara servern, `POST /api/gast`, med en sessionsnyckel i kroppen. Aldrig Firestore. | Då släpper ingen av appens regler eller 40 callables in en gäst, utan att en rad i dem ändras. |
| Vad är en inbjudan? | Id = SHA-256 av (grupp, normaliserad adress, omfång). Raden bär namn, omfång, vem som bjöd, utskick, giltighet för länken, hash av nyckeln, första inloggning, återkallelse och två räknare. | Unikhet är dokument-id, aldrig en kontroll. |
| Taket | 5 gratis gäster per grupp (CP ändrade 3 till 5). Fem platsdokument med fasta id (`<grupp>\|1` till `<grupp>\|5`). Att ta en plats är `createNew`. | Sju samtidiga inbjudningar till sju adresser vid taket ger exakt fem platser. En räkning med fråga har ett fönster mellan räkna och skriv. |
| Brevet | Ett. Länken `/gast#i=<id>&k=<nyckel>`: nyckeln i fragmentet. | Ett fragment skickas aldrig till en server: inte i Hostings logg, inte i `Referer`, och ett mejlprograms förhandshämtning förbrukar ingenting. |
| Inloggningen | Gästen skriver adressen en gång. Rätt nyckel och rätt adress ger en session (32 slumpbyte, bara hashen lagras) som sparas på enheten. | "Ett klick, utan lösenord, stannar inloggad" (epikens beslut 5). |
| Ny enhet | Gästen skriver adressen på `/gast` och får samma svar hur det än går; adressens aktiva inbjudningar får nya nycklar och ett brev (högst fem länkar, tre brev per adress och dygn). | Svaret får inte låta någon fråga vilka adresser som är gäster. |

## Valen i bygget, och vad som avviker från förslaget

Förslaget (kommentaren ovan) är grunden. Det här är det som bygget gjorde annorlunda eller preciserade, med skälet.

1. **Sessionen hör till en inbjudan, inte till en gäst.** Förslaget lät sessionen bära `gastId`. Det gäller en sak i skiva 1, och en session per inbjudan är exakt vad inbjudan ger: den kan aldrig ge mer än sin inbjudan, återkallelsen av en inbjudan rör bara dess sessioner, och sessionen kräver inget uppslag på `gastId` (som inte går att fråga på: det är härlett, inte lagrat). Priset: en gäst med tre inbjudningar loggar in tre gånger på en ny enhet. Skiva 2 (omfånget "grupp") kan lägga en session per gäst vid sidan om om det behövs.
2. **Platserna tas med `createNew` per dokument, inte i en transaktion.** Förslaget sade "tre get och en transaktion". Datakontraktet har ingen transaktion över flera dokument (regel 6 och 8), och den behövs inte: att ta platsen är att skapa det första lediga av fem dokument, och den som förlorar får `created: false` och raden som vann tillbaka. Sju samtidiga inbjudningar prövas av `gast-tjanst.test.js` (och en naiv räkning med fråga släpper in alla sju i samma harness, så provet kan se felet).
3. **Platsen tas FÖRE inbjudan och bekräftas EFTER.** En plats utan inbjudan kostar en plats (säkert håll), en aktiv inbjudan utan plats bryter taket (osäkert håll). Efter att inbjudan skrivits kontrolleras platsen en gång till, så att en återkallelse som hann tömma platsen mitt i ett nytt utskick av samma gäst inte lämnar en aktiv inbjudan utan plats; går den inte att ta på nytt dras inbjudan tillbaka. En plats vars inbjudan aldrig skrevs (processen dog) tas tillbaka när taket nås, om den är äldre än `PLATSFRIST_MS` (10 minuter) och gästen saknar aktiv inbjudan i gruppen.
4. **Felräknaren finns både per inbjudan och per IP i ramverket.** Förslaget lät IP-gränsen vara appens (som delningens uppslagsräknare). Den blev ramverkets, med en samling `raknare` (id = hash av IP:n, aldrig IP:n själv) och `ip` som KRÄVD text i `los` och `nyLank`: en tjänst som tyst slutade räkna per IP hade sett ut som en som gör det. Appens generella hastighetsgräns på `/api/gast` behövs ändå, för den räknar alla förfrågningar och inte bara felen.
5. **Ett brev som inte går är ett fel med kod, inte ett tyst lyckande.** `bjud` och `skickaOm` kastar `brev-misslyckades` och inbjudan ligger kvar aktiv, så Skicka igen löser det. `nyLank` rapporterar felet (`rapportera`) men syns inte i svaret.
6. **Nyckeln lämnar tjänsten bara genom den inskickade `skicka`.** Inget returvärde bär den. En handler som returnerar tjänstens svar rakt ut läcker alltså ingenting.
7. **`farBjuda` har inget förval.** Att bjuda in en utomstående är att skicka ett brev i gruppens namn. För omröstningen är regeln skaparen, en admin eller en ägare, och bara medan datumet inte är valt (CP:s punkt 3 på #383), och den ligger i appen.
8. **Återkallelsen raderar inte sessionerna.** Förslaget sade att de raderas. Då hade en öppen sida fått ett nej, som läses som ett fel på länken, i stället för "Inbjudan är återkallad" inom en minut. Varje anrop läser inbjudan på nytt, så sessionen kan inte användas ändå; den förnyas inte av att nekas och tas av `stadaSessioner` när den är 90 dagar gammal. En inbjudan som väcks igen öppnar samma session.
9. **Gästens svar är en öppen lista på två nivåer.** `GASTSVARSFALT` för tjänstens egna fält, och `sak.falt` för vad appen får släppa ut av saken. Allt annat appens `sak.bygg` råkar bygga tas bort innan svaret lämnar tjänsten. Ramverket kan inte veta att appens listade fält är säkra; det kan bara se till att listan är explicit och granskningsbar på ett ställe.
10. **Adressen kan inte läsas av en gäst.** Gästens svar innehåller inte hens egen adress heller. Medlemmarna ser den (CP:s beslut 2: "namn och mejladress"), via läsregeln eller `lista`.

## Det som inte är gjort, och varför

- **Radering av en gästs uppgifter på begäran och en rad i integritetstexten.** En gäst lagras med adress. Det är CP:s bedömning om det ska in före första riktiga gästen; det är inte byggt.
- **Omfånget "grupp", chatt, ärenden, sms (46elks).** Skiva 2 till 4. Modellen bär dem: `omfang.slag` är en lista, `omfangsnyckel` ingår i id:t, och sessionen kan få ett andra slag.
- **Att en gäst blir medlem.** Samma verifierade adress accepteras redan av växlingen i appen; att markera gästraden som ersatt är skiva 2.
- **Brevets text.** Appens (språk ur gruppens `epostsprak`). Medlemsbrevets mening "Inloggningen är ett Google-konto" (lifehub.app `functions/inbjudningsbrev.js:70-71`) är inaktuell redan för medlemmar och rättas inte här.
- **Röstprövningen.** Appens, mot samma regler som en medlems röst (`datumSaknas`, högst 20 nycklar, värdet ja, kanske eller nej). Den finns på två ställen (reglerna för medlemmar, servern för gäster), så appen ska ha en vakt som kör samma fall genom båda, som `farDelaHandelse`.
- **Städning av övergivna räknare.** `raknare` får en rad per IP och adress som någon använt. Raderna är små och fönstren går ut av sig själva, men samlingen växer. En TTL-policy på `fonster` (om appen lagrar det som tidsstämpel) eller ett städjobb är appens val; ramverket lägger inget jobb.

## Kvarvarande risker, utskrivna

- **En återkallelse som korsar ett nytt utskick av samma gäst inom millisekunder** lagas av bekräftelsen efter inbjudan (punkt 3), men fönstret mellan "bekräfta" och "klar" finns. Det kostar som mest en inbjudan som saknar plats tills nästa `skickaOm` (som tar platsen på nytt). Det är ett säkrare håll än alternativet, inte noll.
- **Två platser åt samma gäst** kan uppstå om en plats släpps mellan en läsning och ett `createNew`. Det kostar en plats (säkert håll) och släpps av `slappPlatsOmTom`, som tar bort alla gästens platser.
- **Medlemmar kan läsa `nyckelHash`** (läsregeln släpper hela raden). Det går inte att göra något med: nyckeln är 256 bitar slump. Vill man ändå dölja den, läser medlemmen via `lista` i stället och regeln stängs.

## Regel 13: förebilden är ett golv

Förebilden är SessionStudios e-postgäster (läst i den lokala kopian av `sessions-platform`, daterad 2026-09-28): `submitRsvp` med en token som dokument-id i klartext, ingen session, IP-gräns 120 per timme, och senare en enad modell där en mejl-medlem är en `users`-rad med `role: "guest"` plus ett vanligt medlemskap. Ärendet citerar ingen SessionStudio-skärmbild, så regel 12 utlöses inte. De tre listorna står i PR-texten.
