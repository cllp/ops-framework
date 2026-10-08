# Biblioteket 0.85.0: radering, filer, ljud och utskrift

Ärende [#192](https://github.com/cllp/ops-framework/issues/192) och [#311](https://github.com/cllp/ops-framework/issues/311). Förebilderna är CP:s telefon 2026-10-08 17:44 till 17:47, i `docs/jamforelser/forebild-ss-bibliotek/`.

Ramverkets bilder är Playwright mot byggd `dist` (`OPS_CHROMIUM=/usr/bin/google-chrome node scripts/bibliotek-montage.mjs skivor`). Webbläsaren var `/usr/bin/google-chrome`. Ingen webbläsare installerades. Bredderna är 390 och 1280 px. Montaget har förebilden till höger.

| Montage | Ramverket | Förebild |
|---|---|---|
| `montage-alla-390.png`, `montage-alla-1280.png` | `ramverk-alla-*.png` | `ss-alla.png` |
| `montage-inspelningar-390.png`, `montage-inspelningar-1280.png` | `ramverk-inspelningar-*.png` | `ss-inspelningar.png` |
| `montage-bilder-390.png`, `montage-bilder-1280.png` | `ramverk-bilder-*.png` | `ss-bilder.png` |
| `montage-dokument-390.png`, `montage-dokument-1280.png` | `ramverk-dokument-*.png` | `ss-dokument.png` |
| `montage-radera-390.png`, `montage-radera-1280.png` | `ramverk-radera-*.png` | `lifehub-fore.png` |
| `montage-utskrift-390.png`, `montage-utskrift-1280.png` | `ramverk-utskrift-*.png` | `ss-inspelningar.png` |
| `montage-plus-390.png`, `montage-plus-1280.png` | `ramverk-plus-*.png` | `ss-inspelningar.png` |
| `ramverk-ljus-390.png` | förhandsvisning av en bild | ingen egen förebild |

Bildlistan och dokumentlistan i montaget innehåller bara den sortens poster, så raden går att se. I appen är det en flik, Filer. Den syns på 1280 (`Filer 3` i `ramverk-alla-1280.png`). På 390 rullar flikraden, och Filer ligger till höger om Länkar.

## Vad som matchar

- Sök och Ny står på en rad. Spela in idé står på raden under, som Record idea i förebilden.
- En ljudrad har spela och tid i listan. En bildrad har en förhandsbild. En dokumentrad har ikon, namn och storlek.
- Rubriken går att ändra. En idé heter Idé plus datum och tid tills personen döper om den.
- Radering frågar, med Avbryt och Radera posten.
- Plusmenyn har raden Spela in idé.

## Vad som skiljer sig

- Förebilden är mörk och engelsk, med bottenraden Today, Calendar, Library, Chat, Menu. Ramverket är ljust och svenskt. Biblioteket har Tillbaka till hubben. `lifehub-fore.png` hade ingen Tillbaka och inga filer.
- Förebilden har låtar, setlistor, taggar, Private eller Group på varje rad, och Shared by me. De är strukna, se listorna nedan.
- Förebilden har egna flikar för inspelningar, bilder och dokument. Ramverket har en flik, Filer. MIME avgör om raden är spelare, förhandsbild eller dokument.
- Spela är en knapp med ordet Spela eller Pausa och tiden bredvid, inte bara en cirkel. På 390 kortas en lång titel av spelaren. Tiden syns.
- Utskriften ligger på ljudets detalj: texten, Skriv ut, och sedan Spara som anteckning och Skapa ärende. Förebildens inspelningsbild visar ingen utskrift.
- Delning är Flytta eller Kopiera till en vald grupp, inte en bricka med vem raden är delad med.
- Filväljaren är webbläsarens egen. I montaget står "Choose File", för webbläsaren var engelsk. Etiketten ovanför är Fil.
- Förhandsvisningen är en bild med Stäng, inte en egen flik.

## Tre listor (regel 13)

### Tas som det är

- Sök, Ny, och en egen rad för att spela in en idé.
- Uppspelning i listan.
- Förhandsbild på en bild, ikon och storlek på ett dokument.
- En fråga innan radering.
- En rubrik som går att döpa om.

### Görs bättre, och skälet

- En posttyp, fil. MIME styr vyn. Separata typer per filsort hade varit flera sanningar om samma sak.
- Privat är personens grupp, inte en flagga på posten. Delning är att flytta eller kopiera.
- Admin i gruppen kan radera, samma villkor som ändring. En trasig rad går att ta bort.
- Utskriften sparas på ljudet. Personen väljer anteckning eller ärende. Ingenting skapas av utskriften själv.
- 25 MB och 10 minuter är tak som syns. Ett fel, också ett dygnstak, syns.
- Tillbaka till hubben, som Ekonomi. Före-bilden i LifeHub hade ingen.

### Stryks, och vad det hade kostat

- Private och Group per post, och Shared by me. En synlighet per post är en läsregel per rad. SessionStudio föll på Firestores gräns för `exists()`, och ADR-020 säger att läsregler inte ska avgöra synlighet.
- Låtar, setlistor och taggar. De är musikens modell. De hade blivit egna fält, egna flikar och en taxonomi biblioteket inte behöver för anteckning, länk och fil.
