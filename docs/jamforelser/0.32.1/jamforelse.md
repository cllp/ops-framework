# 0.32.1: Idag-kortet och inkorgsraden mot SessionStudio

CP 2026-09-30 08:04: "Kolla storleken och fint på texten i händelserna. Matchar inte det vi har i SessionStudio. Dubbelkolla även inkorgen."

Montage: `idag-kort-fore-efter-ss-390.png`. Tre kolumner vid 390 px: ramverket 0.32.0 (före), ramverket 0.32.1 (efter), båda tagna med
Playwright mot en byggd `dist` (check-skalyta, scenen `handelsekort`), och SessionStudios Idag-kort.

⛔ SS-kolumnen är SS markup och klasser ur `TodayView.jsx:520-560` (cllp/sessions-platform `f305de6`), renderade ur koden med SS ljusa
tema (`index.css:294-356`) och kortsteget (`index.css:220, 228`). Det är INTE en skärmbild av SS-appen. Typsnittet Plus Jakarta Sans finns inte
i miljön, så SS-kolumnen ritas i reservtypsnittet. Datumen i SS-kolumnen är påhittade i SS eget format (en rad, "tis 10 sep").

## Mätt (check-skalyta avsnitt 25, 390 px)

| | 0.32.0 | 0.32.1 | SS (renderad ur koden) |
|---|---|---|---|
| Titelns bredd | 251 px av 299 (84 procent) | 299 av 299 | 316 |
| Titelns storlek | 18/700 | 18/700 | 18/700 |
| Datumradens vänsterkant mot titelns | 101,5 och 152,9 mot 40 (högerställd) | 40 mot 40 | lika, ovanför titeln |
| Radie | 28 px (`bubbla`, `rounded-3xl`) | 24 px (`--radius-card`) | 24 px (`--radius-card`) |
| Rollmärket "Du" mot "Försenat" | appens egen form | 12/600, `px-2 py-0.5`, 20 px höga båda | saknas i SS |
| Summary utan egen klass (inkorgen) | 16 px | 14 px | `text-sm`, 14 px |
| Typbadge (`OpsPill size="liten"`) | 12/600 (fanns inte) | 10/500, `px-1.5 py-0.5` | 9/500, `px-1.5 py-0.5` |

## Vad som nu matchar
- Titeln har kortets hela innerbredd. Chevronen ligger i kortets övre högra hörn och tar ingen kolumn.
- Datumraden står vänsterställd direkt ovanför titeln, 12 px och dämpad, som SS `text-xs text-[var(--color-text-muted)]`.
- Titeln är 18/700 som förut, och som SS `text-lg font-bold`.
- Radien är 24 px, SS `--radius-card` (CP 2026-09-30).
- En inkorgsrad utan egen klass är 14 px, som SS `text-sm`.

## Vad som fortfarande skiljer sig
- **Titelns bredd 299 mot 316.** Ramverkets kort har `--card-padding` (24 px) och en vänsterkant på 4 px; SS har `p-5` (20 px) och en ram på 1 px.
  Därför bryter den långa titeln på samma ställe i tre rader i båda, men ramverket har 17 px mindre att arbeta med. Inte ändrat här.
- **Den färgade vänsterkanten** (slagets ton) finns inte i SS. Den är CP:s beslut från 2026-09-22 ("Matt vänsterkant per slag som SS left accent").
- **Pillraden** (roll, brådska, slag) finns inte i SS Idag-kort, som i stället har gruppens rad under titeln. Ramverket har ingen grupprad på händelsen.
- **Datumraden bär mer** än SS: "För 20 dagar sedan" och "Senast 10 sep" i stället för ett datum. Innehållet är appens.
- **SS kort har skugga och ram**; ramverkets kort har tonskillnad och ingen ram (`OpsCard`, #167). Inte ändrat här.
- **Typbadgen är 10 px mot SS 9 px.** 9 px finns inte i ramverkets skala och uppfinns inte för ett märke; `liten` är närmaste roll.

# 0.32.1: Profilen mot SessionStudio

CP 2026-09-30, med en skärmbild av Profil på dator: "Typsnitten på profil är också fel. Storlek / typsnitt".

Montage: `profil-fore-efter-ss-390.png` och `profil-fore-efter-ss-1280.png`. Ramverkets kolumner är `OpsProfil` i skalet, tagna med Playwright mot en
byggd `dist` (check-skalyta, scenen `profil`). SS-kolumnen är `ProfileView.jsx:106-297` (cllp/sessions-platform `f305de6`), markup och klasser
renderade ur koden med SS förval (green ljust, tonen Brun, `.rounded-app`), INTE en skärmbild av SS-appen. Reservtypsnitt, och ikonerna är tomma rutor.

Komponenten: `src/components/OpsProfil.jsx` (ramverket). Appen ritar den i `web/src/app/views/ProfileView.jsx:132-167`.

## Mätt (check-skalyta avsnitt 27)

| | 0.32.0 | 0.32.1 | SS (renderad ur koden) |
|---|---|---|---|
| Kolumn vid 1280 | 1024 px (`OpsView` normal) | 672 (korten 640) | 672 (`max-w-2xl`) |
| Sektionsrubrik | 12/600 versaler accent, OVANFÖR kortet | 12/700 versaler accent, INUTI kortet | 12/700 versaler accent (`tracking-wider`), inuti kortet |
| Fältetikett | 14/500, sekundär | 10/400, dämpad | 10/400, dämpad |
| Fälttext | 16 px | 16 px | 14 px (`text-sm`) |
| Personuppgifter | fyra fält under varandra, inget kort | kort, Namn/Telefon/Stad i tre kolumner från `sm` | kort, tre kolumner från `sm` |
| Kortets radie och luft | 24 px, 20 px | 24 px, 20 px, 1 px kant | 12 px (`--radius`), 20 px (`p-5`), 1 px kant |
| Knapparna Ta bort, Använd initialer | 12/500, ghost | 12/500, ghost (oförändrat) | 11 px, Ta bort i röd ton, Byt bild med guldton |
| Horisontellt överflöde | inget (390 och 1280) | inget | inget |

Kortet som "gick ut till höger kant" på CP:s bild är inte ett överflöde: vid 1280 slutade kolumnen 1024 px bred, och bilden var beskuren. Nu är den 672.

## Vad som nu matchar
- Kolumnens bredd, rubrikernas storlek, vikt och färg och deras plats inuti korten, fältetiketterna, tre kolumner för namn, telefon och stad.

## Vad som fortfarande skiljer sig
- **Kortens radie 24 mot SS 12.** `OpsCard` har två radier (24 och 28) och ingen på 12; en tredje är ett eget beslut. Inte ändrat.
- **Fälttexten 16 mot SS 14.** Ramverkets fält är 16 px överallt sedan 0.32.0 (under 16 zoomar iOS Safari in vid fokus). SS profil har 14. Inte ändrat.
- **Korten är 640 px mot 672**: `OpsView narrow` räknar sin sidomarginal inuti `max-w-2xl`, SS utanför.
- **SS huvud** (bild 64 px, namn 20/700, e-post 12, rollbadge 9 px) står OVANFÖR korten; ramverket har rubriken "Profil" och namnet i profilbildskortet.
- **Knapparna** är ramverkets `OpsButton` sm (12/500); SS har egna 11 px-knappar med guldton och röd "Ta bort". Inte ändrat.
- **Språk och Utseende** finns i ramverkets profil; i SS ligger de i inställningarna.
