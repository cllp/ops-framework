# Design: publik länk till alla fyra typer, en lista som levande spellista, och utskriftens läge på posten (lifehub.app#356 och #349)

Status: byggd i 0.133.0, granskas av Claude innan steget mergas. Ärenden: cllp/lifehub.app#356 (publik delning), #349 (utskrift). Bygger på beslut 0009 (delningsraden, adressen som nyckel) och på listorna i 0.128.0 (#378).

## Händelsen

CP 2026-10-18 (#356): "Vi skall ju ha en publik länk till varje artefakt med option på att den som ser kan ladda ner." 2026-10-20: "EN lista måste kunna delas ... det ser ut som en lista, men alla sakerna i listan delas. Som att jag vill dela en playlist för ett gig." Samma dag: "Ändras listan kan den ju bara ändras för alla som den delas med. Om en låt tas bort kan den bara tas bort precis som för den som skapade den." Och om utskriften: "Kan man göra så att man kan ta bort transkribering på en ljudupptagning och köra om den?", som ska gå i bakgrunden, fortsätta om man går därifrån, stå tydligt och ge besked när den är klar.

Mätt före (origin/main d76fe97): `menyFor` i `OpsBibliotek` gav "Dela länk" bara för `typ === "fil"` med färdig fil; en lista fick bara Byt namn och Radera; en anteckning och en fil hade olika menyer. `createDelningService` krävde en färdig fil (`arKlarFil`) i `skapa` och i `hamta`. Utskriftens "Skriver ut…" var ett lokalt tillstånd i `UtskriftKontroll`, och posten bar inget om att en utskrift pågick.

## Beslutet i en tabell

| Fråga | Svar | Varför |
|---|---|---|
| Behövs en ny delningsrad för en anteckning, en länk eller en lista? | Nej. Raden pekar på posten (`postId`) och typen läses ur posten. Adressen är fortfarande `<gruppdel>/lib/<del>`. | Typen finns redan på posten (regel 2). Inga rader skrivs om, och en gammal tokenlänk fungerar som förut. |
| Hur skiljer svaret typerna åt? | `typ` i `delning`: filens `ljud`/`bild`/`video`/`pdf`/`dokument` är oförändrade, och `anteckning`, `lank` och `lista` är nya. | Filens svar får inte ändras (appen läser det i dag), och `typ` används redan som diskriminator. |
| Vad får en anteckning och en länk visa? | Anteckning: `typ`, `rubrik`, `text`. Länk: `typ`, `rubrik`, `url`, bara http och https. | Samma princip som för filen: en öppen lista fält och inget annat. Källan, omslaget, taggarna och vem som skrev läcker inte. |
| Vad delas med en lista? | Hela listan, posterna i listans ordning. | CP: "alla sakerna i listan delas". Den som får dela listan (`farAndra`, prövas på listan) delar därmed också posterna i den, också andras. Dialogen säger det. |
| Är listan en kopia eller en spegel? | En levande spegel. Servern läser listan vid varje hämtning med `losLista`, samma funktion som medlemmens vy. Inget av listan lagras i delningen. | CP: "Ändras listan kan den ju bara ändras för alla som den delas med." En ögonblicksbild är en andra sanning (regel 2) som glider isär listan. |
| Vad ser mottagaren när en post tagits ur listan? | Ingenting: den finns inte i svaret. | CP: "Om en låt tas bort kan den bara tas bort precis som för den som skapade den." |
| Och när den raderats? | En rad `{ typ: "saknas" }`, "Finns inte längre", utan andra fält. | Det är vad medlemmens egen listvy visar (`LISTRADTEXT`). CP: "använd samma". En fil som inte blev klar har inget att visa och blir samma rad. |
| En lista i en lista? | Finns inte. Raden blir `{ typ: "lista-i-lista" }`. | Reglerna släpper inte igenom den, och `losLista` visar den som en rad som inte går att visa. Ingen rekursion. |
| Tak? | `MAX_DELADE_LISTPOSTER` = 100, och `ejVisade` säger hur många som kapats. | Varje fil får en egen signerad adress (en PDF med nedladdning två). En lista får vara 200 poster. |
| Hur vet spelaren vilken låt som spelas när listan hämtas om? | En ogenomskinlig nyckel per rad: SHA-256 av delningens id och postens id, 16 hextecken. | Postens eget id ska inte lämna servern, och nyckeln är densamma vid varje hämtning. |
| Hur startar nästa låt på en telefon? | EN `OpsLjudspelare` vars adress byts, med `autoSpela`. | En telefon låter ett skript starta ett ljudelement som en människa redan startat, inte ett nytt. En spelare per låt hade stannat efter den första. |
| Var ligger utskriftens läge? | Fältet `utskriftJobb` på ljudposten. Servern sätter det och tar bort det. | Ett lokalt tillstånd överlever inte att man går från sidan. Posten är sanningen. |
| Vad är en `pagar` som aldrig blev klar? | Efter 15 minuter tolkas den som ett fel ("Utskriften blev inte klar. Försök igen."). | Servern kan dö utan att hinna skriva `fel`. En rad som för alltid säger "pågår" är en rad ingen kommer ur. |
| Procentstapel? | Nej. | Modellen ger inget löpande förlopp. En påhittad procent är en gissning som ser ut som en mätning. |
| Uppskattningen av tiden? | 30 s plus en fjärdedel av ljudets längd, avrundat upp, märkt "(uppskattning)". | Ingen körning är mätt. Konstanterna ska bytas mot en median av riktiga körningar. |

## Vad som valdes bort, och vad det hade kostat

- **Lagra listan i delningen när länken skapas.** Hade gett en länk som är stabil och en lista som aldrig stämmer med medlemmens. CP sade motsatsen. Det hade dessutom varit en andra kopia av en lista som redan har en sanning.
- **En ny delningsrad per typ.** Hade krävt ett migrerat `slag` och en andra sorts adress. Typen finns på posten.
- **Visa en raderad post med sin rubrik.** Läcker innehållet i det som raderats. Medlemmens vy visar inte heller rubriken.
- **Pollning av listan på den publika sidan.** CP:s ord är "nästa hämtning eller en utgången adress". Adressen går ut efter 15 minuter och appen hämtar då om. Pollning hade lagt last på en publik funktion som redan har en uppslagsräknare.
- **Förnya adresserna i förväg (vid 14 minuter).** Hade gett en spellista som aldrig tystnar mitt i en låt, men är ett eget beslut om hur ofta en publik sida får hämta om. Se "Kvar" i PR-texten.

## Följder för appen

Se PR-texten, "Kvar för appen". I korthet: ompinna, `skrivUtInspelning` sätter `utskriftJobb` och gör jobbet i bakgrunden, en serverväg tar bort utskriften med `UTSKRIFT_FALT`, reglerna ska neka klienten `utskriftJobb` (fragmentet gör det), och webbens `/g/...` ritar `OpsDelad` som förut men får nu fler typer.
