# Design: ändra och flytta en post eller en händelse mellan kalendrar (cllp/lifehub.app#371)

Status: förslag, granskas av Claude innan steget mergas. Ärende: cllp/lifehub.app#371, CP:s beslut 2026-10-19 (https://github.com/cllp/lifehub.app/issues/371#issuecomment-6272062625: "kör, flyttreglerna är godkända som de står ovan"). Ramverkets del: cllp/ops-framework, gren `claude/371-andra-flytta`, version 0.123.0.
Relaterat: 0.120.0 (posten öppnas i detaljvyn, `post~`), 0.40.0 (redigeringsläget), 0.37.0 (kalendrarna och "Skapa i").

## Händelsen

CP 2026-10-19, med en skärmbild av GSEMS-händelsen i Barnveckor: detaljvyn öppnas (#367), men "det går dock inte att ändra en händelse. Vidare borde det gå att flytta en händelse till en annan kalender." Mätt mot 0.122.0: pennan finns i panelen (`onRedigera`) men skalets redigeringsläge kände bara händelser, och ingenting kunde byta kalender på en post eller en händelse.

## Fyra flytter, tre erbjuds (CP:s beslut)

| Från | Till | Vad som händer | Erbjuds |
|---|---|---|---|
| egen kalender | egen kalender | `kalenderId` byts på posten, direkt | ja |
| gruppkalender | gruppkalender, samma grupp | `kalenderId` byts på händelsen, för den som får redigera den | ja |
| egen kalender | gruppkalender | posten blir en gruppens händelse och tas bort, i ett serveranrop. Personen bekräftar först | ja |
| gruppkalender | egen kalender | (en gruppens händelse försvinner ur gruppen genom att en medlem flyttar den) | **nej** |

Grunden för sista raden: en händelse har svar och kommentarer och är gruppens, en post är personens. Att flytta ut den ur gruppen är att radera den för alla andra, och det ska ingen medlem kunna göra med ett val i en lista. Samma skäl stänger flytt till en annan grupps kalender.

## Valen i bygget

1. **Pennan för en post är den som redan fanns.** `OpsHandelsePanel.onRedigera` ritas när appen ger den, alltså för ägaren. Det som saknades var skalets redigeringsläge: `useOppnaSkapa()("handelse", { id: "post~<id>" })` tolkar prefixet på ett enda ställe (`postIdUrHandelseId`) och öppnar formuläret för en post i en av mina kalendrar. Väljaren visar bara mina kalendrar (att byta till en grupp är "Flytta till kalender", med bekräftelse), typen ritas inte, och "Blockerar tillgänglighet" fylls i ur `HandelseRedigering.blockerar`. Formuläret och sparandet är appens, som för en händelse.
2. **Listan är ett erbjudande och servern är behörigheten.** `flyttmal()` är en ren funktion som både panelen och appen använder. `createFlyttaService` läser allt den prövar ur databasen (posten under personens egen sökväg, medlemskapet, kalendrarna) och litar på klienten för vem, vad och vart, inget annat.
3. **Konverteringen är en batch.** Händelsen skapas och posten tas bort i `kalla.batch`. En källa utan batch nekas när tjänsten byggs, i stället för att falla tillbaka på två anrop som kan lämna en dubblett eller en förlorad post.
4. **Händelsen får postens id.** Unikhet är då en nyckel och inte en kontroll (arbetsreglernas punkt 2): två samtidiga anrop för samma post skriver samma dokument två gånger och tar bort samma post två gånger. Ett genererat id hade gett två händelser. Postens id följer `ID_FORM`, en delmängd av en händelses id-form, och `post~` finns bara i adressen. Finns det redan en händelse med id:t avbryts flytten, för `create` med eget id ersätter.
5. **Tiden är postens och inte appens.** `byggHandelse` ger appens fält (rubrik, text, typ, vem som skapade den). Datum, klockslag, heldag, grupp och kalender skrivs sedan ur posten och målet (`postensTidsfalt`), och raden går genom `handelsefel`. En app kan inte tappa en dag på vägen.
6. **Appens regel för "får redigera" och "får skapa" är snävare, aldrig vidare.** Medlemskapet (aktiv, inte en agent) prövas alltid först; `farRedigera` och `farSkapa` kan neka därefter. En tjänst vars callback släppte in en icke-medlem hade varit en dörr bredvid reglerna.

## Det som INTE ändrades

Kalenderregelfragmentet är byte för byte detsamma som 0.122.0. Ägaren har sedan 0.36.0 `allow create, update` på sina poster med samma villkor som vid skapandet, och en ändring av en post är en `update`. Det som saknades var ett prov som ändrade en post som fanns: `rules/__tests__/postandring.test.mjs`. Inga nya val, inga nya samlingar.

## Regel 13: förebilden är ett golv

Ärendet citerar ingen SessionStudio-skärmbild (skärmbilden är CP:s egen av GSEMS-händelsen), så regel 12 utlöses inte. De tre listorna står i PR-texten.
