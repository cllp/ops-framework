# Design: "Datum ej satt" och en tilläggsplats i formuläret för en ny händelse (cllp/lifehub.app#383, ramverkets del)

Status: byggd i 0.127.0, granskas av Claude innan steget mergas. Ärende: cllp/lifehub.app#383, CP:s beslut 2026-10-19 (https://github.com/cllp/lifehub.app/issues/383#issuecomment-6277729266: "Ja, kör på de förslagen om röstning.") och planen (https://github.com/cllp/lifehub.app/issues/383#issuecomment-6277939183).
Relaterat: beslut 0003 (tillägg på ramverkets ytor), 0.60.0 (`handelse.sektion`, `handelse.atgard`), 0.37.0 (`HANDELSEKONTRAKT`).

## Händelsen

CP 2026-10-19, efter att ha installerat Datumomröstning i Music och skapat "Rösta för rep": formuläret Ny händelse kräver ett datum, och omröstningen finns först i händelsens panel när händelsen redan har ett. CP: "ja det är bättre att röstningen går till så", svar på förslaget att välja omröstningen redan i formuläret. Beslutet: händelsen innan datumet är satt "syns streckad på varje föreslagen dag i kalendern och flyttar till sin dag när ett datum väljs. Ingen falsk dag."

## Tre ändringar, och vad var och en inte är

| Ändring | Vad den är | Vad den inte är |
|---|---|---|
| `handelse.skapa` | En PLATS i formuläret för en ny händelse, efter "Kräv svar". Ett tillägg ritar en komponent där och bär `skapa: { datumEjSatt, fel, efterSkapa }`. | Ingen känner Datumomröstning. Platsen vet bara "ett tillägg vill att datum inte sätts nu", skälen att inte spara än, och "anropa efterSkapa med id:t". |
| `datum` valfritt | Läget "Datum ej satt" är att `datum` SAKNAS på händelsen. `handelsefel(h, { datumEjSatt: true })` släpper igenom det, och kräver då att `slutDatum`, `tid`, `slutTid` och `heldag` också saknas. | Ingen flagga (`datumSatt: false`) och inget första förslag i `datum`. En flagga kan säga "ej satt" medan ett datum finns, eller tvärtom (regel 2). Listan `HANDELSEKONTRAKT` är oförändrad. |
| `CalendarEntry.preliminar` | Appen skickar en post per föreslagen dag, med samma `handelseId`. Ramverket ritar pillret och dagpanelens kort streckade, pricken ihålig, och säger "Datum ej satt" på kortet och i snabbtitten. | Aldrig ett band: ett förslag är en dag. `endDate` och `allDay` på en preliminär post kastar. |

## Valen i bygget

1. **Platsen ritas bara vid skapande och bara i en gruppkalender.** Som "Kräv svar": i Mina kalendrar finns inga svar och ingen omröstning, och när en händelse ändras har den redan sitt datum eller sin omröstning.
2. **Formuläret får `tillagg` bara när något ritas.** En app utan tillägg på platsen får exakt de props den fick före 0.127.0 (mätt i `tillagg-skapa.test.jsx`: nyckellistan).
3. **`efterSkapa` är inte atomär mot skrivningen av händelsen.** En skrivning efter en skrivning kan inte vara atomär i Firestore-reglerna (`exists()` ser inte en samtidig skrivning i samma batch), så händelsen ligger kvar om förslagen inte skrevs, och formuläret skriver ut felet. Det är ett pris, inte ett förbiseende.
4. **Alla tilläggs `efterSkapa` körs även om ett faller.** De är oberoende av varandra. Felet kastas efteråt: ett fel som det är, flera som ett fel med alla orden.
5. **`handelsensDagar` ger `null` utan datum.** Ett objekt utan `date` hade tappats tyst av kalendern. `null` kan spridas (`...null`) men inte destruktureras utan att den som skriver ser det.
6. **`harPasserat` svarar falskt och `svarsrader` ger ingen rad.** "Kommer du?" utan dag är ingen fråga: det är omröstningen om dagen som gäller, och den är appens.
7. **Orden bor på ett ställe** (`DATUM_EJ_SATT`, sv och en). Panelen och kalendern läser därifrån, så appen skriver aldrig ordet i `not` och det kan inte stå två gånger.
8. **Den publika sidan (0009) är orörd.** `handelsefel(h)` utan valet ger "Välj ett datum", alltså svarar en länk till en datumlös händelse `handelse-saknas`. Gästens röstlänk (skiva 2) är en egen sak.

## Det som INTE ändrades

Regelfragmentet för händelser (`handelseregelfragment`, `opsHandelsefaltGiltiga`) är byte för byte detsamma. Det kräver inte `datum`, och `slutDatum` utan `datum` nekas redan. Att `datum` blir valfritt i APPENS regel, att bara skaparen eller en admin får sätta det, och att rösterna låses när det är satt, är appens (se CHANGELOG 0.127.0, "Vad appen måste göra").

## Regel 13: förebilden är ett golv

Ärendet citerar ingen SessionStudio-skärmbild, så regel 12 utlöses inte. De tre listorna står i PR-texten.
