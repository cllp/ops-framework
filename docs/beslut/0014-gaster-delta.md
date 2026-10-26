# Design: en gäst för en sak svarar på en händelse och får en kalenderpost (cllp/ops-framework#445, skiva 1, ramverkets del)

Status: byggd i 0.146.0, granskas av Claude innan steget mergas. Ärende: cllp/ops-framework#445 (epiken: öppet utåt överallt, steg 2 i trappan "gäst för en sak"). CP sade kör på skiva 1.
Bygger på beslut 0011 (en gäst är en inbjudan och aldrig ett konto) och 0012 (hela gruppen) och ändrar inget av det: modellen, sessionen, platserna, felräknarna och återkallelsen är desamma, med en andra funktion för en sak.

## Händelsen

CP 2026-10-25: "Hur är det att skapa en händelse med en extern. Måste de vara med i gruppen då? ... Vill inte att det skall kännas inlåst." Och: "Detta är överallt, alla ytor/funktioner. Gäster, externa, publik delning." Måttstocken i epiken är visionen i kanon: den som är extern ska kunna vara med **från sin egen mejl och sin egen kalender**, utan konto och utan vår app, för det är den kortaste vägen till mindre skärmtid, för den externa och för gruppen som slipper förmedla.

Mätt före (origin/main f6c97f7): `Gastomfang` hade en funktion för en sak, `rosta`, och den var omröstningens: en gäst för en sak kunde bara rösta på ett datum. Det fanns ingen väg för en extern att svara "Jag kommer" på en händelse som redan har ett datum, och inget sätt att få den in i sin kalender.

## Frågan till ärendet (visionens fråga, besvarad)

**Gör det här att någon tittar mindre på skärmen, eller mer?** Mindre. Den externa svarar med ett tryck i mejlet och har posten i sin egen kalender, som uppdateras av sig själv när tiden ändras. Gruppen slipper fråga, och slipper skicka om. Det som ökar skärmtiden är en ny sida för gästen att titta på, och den är motiverad: den är det enda ställe svaret kan göras utan konto. Den har tre knappar och en rad, och ingenting annat.

## Beslutet i en tabell

| Fråga | Svar | Varför |
|---|---|---|
| Ny samling, nya regler? | Nej. Funktionen `delta` är en rad i `GASTFUNKTIONER`, och svaret är ett fält på inbjudan (`deltasvar`). | Regel 13 och epikens "i stället för nya samlingar per yta". `gastregelfragment` nekar redan varje klientskrivning, och raderingen av gästen tar svaret med sig utan att något nytt ställe behöver minnas att rensa. |
| Var lagras svaret? | På gästens inbjudan, och inte bland medlemmarnas svarsrader (`<händelse>/svar/<g_-id>`). | Mönstret från omröstningen är "sakens svar hör till saken, skrivet av servern". Här är saken inbjudan: en inbjudan, en händelse, ett svar. Skrivningen har villkoret `aterkallad: null`, så en återkallelse och ett svar kan inte korsa varandra (`sattNamn` gör likadant). Och medlemmens `sammanstallSvar` kan inte räkna fel på ett värde den inte känner. |
| Vad ser en delta-gäst? | Rubrik, dag, klockslag och plats (`GASTDELTAHANDELSEFALT`), och sitt eget svar. | Epiken: "en gäst för en sak ser aldrig resten av gruppen". Ingen beskrivning, inga filer, inga kommentarer, inga andra gäster. |
| Hur hindras en delta-gäst från resten? | `gastOmfangGer`: ett omfång ger EN funktion. Varje gruppåtgärd, appens `rosta`-väg och `hamta`:s `sak.bygg` är stängda för en delta-session. | Samma mekanism som skyddar en omröstningsgäst, ett hem (regel 2). Provat med elva gruppåtgärder mot en positiv kontroll. |
| Vem får bjuda in? | Appens regel `farBjuda`, som nu får `funktion`. | Omröstningens regel ("bara medan datumet inte är valt") är fel för delta, som kräver ett datum. Appen svarar per funktion. Medlemskapet prövas först, som förut. |
| Vilka händelser går att bjuda in till? | Bara de med datum. | Utan dag finns ingen kalenderpost och inget att komma till. Omröstningen om dagen är `rosta`. |
| Hur många svar? | Tre för gästen (`GASTDELTASVAR`: kommer, kommerInte, kanske), två för medlemmen. | Gästens egen kalender har Ja, Kanske och Nej. Medlemmens `SVARSVAL` är orörd. Se "Avvikelser" nedan. |
| Hur kommer posten till gästen? | `byggIcs`, en ren funktion. Brevet är appens. | Epiken: "Den skickar ingenting själv." Funktionen läser ingen databas och ingen klocka. |
| Hur ersätter en ändring den gamla posten? | UID är `<händelse>@<domän>` och SEQUENCE stiger när tid eller plats ändrats (`andringsnyckel`, `nastaSekvens`), sparat på inbjudan. | Ett kalenderprogram ersätter bara en post med samma UID och högre SEQUENCE. Sparat på inbjudan och inte hos appen, så att appen inte behöver en egen samling för det. |
| Hur skickas ett nytt brev vid ändrad tid? | `tidAndrad({ handelseId })`, som appens serverkod anropar efter en ändring. Den skickar bara till dem vars senaste brev sade något annat, och sparar SEQUENCE först när brevet gått iväg. | Idempotent: appen behöver inte veta om just tid eller plats rörts. Ett brev som inte gick är ett fel med kod, och ändringen glöms inte. |
| Tidszon? | En indata (`tidszon`), och posten skrivs som UTC. | Ramverket vet inte var gruppen är. En tid utan zon hamnar på samma klockslag hos mottagaren, vilken zon hen än sitter i. |

## Valen i bygget, och vad som avviker från ärendet

1. **Tre svar, trots att epikens matris säger två.** Matrisen: "svara 'Jag kommer' eller 'Kan inte'". Uppdraget till bygget: Jag kommer, Kan inte eller Kanske. Medlemmens modell säger uttryckligen två ("kanske är inget svar på kommer du?", `SVARSVAL`), och det är kvar. `kanske` finns bara hos gästen, i en egen konstant som härleds ur `SVARSVAL` och inte skrivs om. Priset, utskrivet: `kanske` räknas inte i någon sammanställning och står som ett ord vid gästens rad. **Det här är ett beslut för CP att bekräfta eller dra tillbaka;** att dra tillbaka det är att ta bort ett ord ur en lista och en knapp ur sidan.
2. **Plats ingår i vad som ger ny SEQUENCE.** Uppdraget nämnde bara tid. En LOCATION som ändrats utan att SEQUENCE stigit ligger kvar hos gästen som den var. Det kostar ett ord i nyckeln.
3. **Gruppens svarssammanställning räknar bara gruppens gäster** (`handelse` i tjänsten). Före 0.146.0 räknades också en gäst för en sak som "har inte svarat" på varje händelse, vilket hen aldrig kunde ändra och medlemmens `OpsSvar` inte räknade. Med delta hade felet blivit vanligt. Provat rött utan rättelsen.
4. **Adressfrågan före inloggningen är neutral.** Sidan vet inte vad en inbjudan gäller förrän gästen loggat in, och "Du är inbjuden att rösta" var fel åt den som bjudits in till en händelse. Nyckelnamnen i ordboken är kvar.
5. **Rubriken, dagen och platsen är den delade händelsesidans.** Markeringen bröts ut ur `OpsDeladHandelse` (`DeladRubrik`) i stället för att skrivas en gång till; proven för den delade sidan är oförändrade.
6. **En delta-gäst får aldrig appens `sak.bygg`.** `hamta` grenar på funktionen. Utan det hade omröstningens kort, med förslag och röster, byggts åt en gäst som bara skulle svara på en händelse. Provat rött utan grenen.

## Det som inte är gjort, och varför

- **Appens del:** raden "Bjud in med e-post" i deltagarlistan, brevets text och bilagan, att anropa `tidAndrad` när en händelse ändras, och gästens svar i `OpsSvar`. Appen äger mejlet, språket och utseendet.
- **`METHOD:REQUEST` med ORGANIZER och ATTENDEE.** Då visar mejlklienten Ja och Nej och svaret kommer som mejl (iTIP REPLY), vilket är en andra väg att svara på och kräver att appen kan ta emot och tolka brevet. Sidan är vägen nu.
- **Brev när en händelse tas bort eller en inbjudan dras tillbaka** (`STATUS:CANCELLED`). En återkallelse nekar nästa anrop och släpper platsen; gästens kalender rörs inte.
- **Att dölja gästernas adresser för vanliga medlemmar.** Epikens säkerhetsrad säger att adresser "bara visas för den som bjöd in, ägare och admin". Läsregeln släpper in alla aktiva medlemmar (CP 2026-10-20: "Gäster visas med namn och mejladress"). Det är en ändring av `gastregelfragment` för alla funktioner, och ett eget beslut.

## Kvarvarande risker, utskrivna

- **Två samtidiga `tidAndrad` för två olika ändringar** (A till B och sedan B till C inom millisekunder) kan skicka två brev med samma SEQUENCE och olika innehåll. Sparningen har ett villkor, så bara den ena sparar, och i ena ordningen sparas nyckeln för B medan händelsen står på C: nästa anrop skickar då om (det läker), i den andra ordningen stämmer nyckeln och gästens kalender kan stå kvar på B. Ramverket serialiserar inte (datakontraktet har inget lås över flera dokument), så appen bör köra `tidAndrad` en i taget per händelse. Valet att spara efter brevet och inte före betyder att en ändring kan ge ett brev för mycket men aldrig ett för lite.
- **En gäst som redan har ett öppet mejl** med en gammal länk efter en ändring kan inte använda den: `tidAndrad` roterar nyckeln, som varje nytt utskick. Sessionen på enheten gäller fortfarande, och den nya länken ligger i det nya brevet.

## Regel 13: förebilden är ett golv

Förebilden är SessionStudios e-postgäster (`submitRsvp`, beslut 0011). Tre listor står i PR-texten.
