# Biblioteket 0.79.0: lista och detalj mot SessionStudio

Ärende [#192](https://github.com/cllp/ops-framework/issues/192) citerar SessionStudios bibliotek som källa. Regel 12 kräver därför ett montage. Analysen står i `docs/beslut/0004-bibliotek-ss-analys.md`.

Bilderna:

| Fil | Vad |
|---|---|
| `bibliotek-lista-390-ramverk-ss.png` | vänster ramverket i 390 px, höger SessionStudios butiksbild av biblioteket |
| `bibliotek-lista-390.png` | listan, telefon |
| `bibliotek-lista-1024.png` | listan, dator |
| `bibliotek-detalj-390.png` | anteckningen Protokoll öppen |
| `bibliotek-ny-1024.png` | formuläret för en ny länk |
| `ss-bibliotek-butik.png` | förebilden, oförändrad |

Ramverkets sida är Playwright mot den byggda `dist` (`node scripts/bibliotek-montage.mjs`, ljust tema). Webbläsaren var `/opt/google/chrome/chrome`. `/opt/pw-browsers` fanns inte, och ingen webbläsare installerades.

Förebilden är `apps/mobile/store-assets/android/phone-5-bibliotek.png` i cllp/sessions-platform. Det är butiksbilden av det mobila biblioteket, inte en skärmbild av `GroupResourcesPanel` och inte en bild CP bifogat ärendet. Ärendet har ingen skärmbild. Butiksbilden är den bild i källan som heter bibliotek.

## Vad som matchar

- Rubriken är Bibliotek.
- En rad har en ikon, en titel och en rad under med vad posten är.
- Listan är gruppens material, inte en personlig hög.

## Vad som skiljer sig

- Butiksbilden visar setlist, rider och inspelning, plus en dekorativ kurva och en bottenknapp. De tre typerna är musik och ingår inte i skiva 1. Ramverket visar anteckning och länk, med sök, antal och knappar för att lägga till.
- Butiksbildens underrad är en reklamtext ("Delad med gruppen", "Uppdaterad idag"). Ramverkets underrad är texten eller adressen.
- Beskrivningen under rubriken ligger bakom frågetecknet, som i ramverkets övriga vyer. Butiksbilden har underrubriken "Material nära arbetet" synlig.
- Detaljen är ett formulär med rubrik och text eller adress, inte låtens sex flikar.

## Tre listor (regel 13)

### Tas som det är

- En lista med ikon, titel och en rad under.
- En post öppnas till en egen vy med väg tillbaka.
- Typen är ett fält på dokumentet, inte en egen samling per typ.

### Görs bättre, och skälet

- Synligheten är medlemskap i radens grupp, i regeln. SessionStudio läser `artifacts` med `allow read: if isAuth()` (ADR-020) och filtrerar i klienten. Den regeln gör varje inloggad till läsare av varje dokument.
- Tre lägen visar antalet också när det är noll. En flik som försvinner när typen är tom går inte att skilja från en typ som inte finns.
- Sökningen läser listan som redan hämtats. Ingen andra kopia av rubriken.
- Radens höjd kommer ur innehållet. `OpsList` bär redan felet med fast radhöjd i SessionStudios bibliotek.

### Stryks, och kostnaden

- Låt, spellista, inspelning och rider. Noter, ackord, tonart, spellistans låtreferenser och ljudfil i varje ops-app.
- Träd, delning via `linkedGroupIds` och egna mallar. En molnfunktion, en klientfiltrering och en andra konfiguration bredvid katalogen.
- Personligt bibliotek, publik sida och sessionsbibliotek. Fyra omfång. Ramverket har den aktiva gruppen.
- Fil och bild i den här skivan. De kräver en lagringssökväg appen namnger, annars följer filens byte med i listläsningen.
