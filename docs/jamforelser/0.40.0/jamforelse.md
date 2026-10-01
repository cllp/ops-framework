# 0.40.0: händelsepanelen mot SessionStudio EventDetail

CP 2026-10-01 (#214): "Vi behöver en händelsepanel. Så man navigerar dit från kalender och från idag. Händelsepanelen skall ha en tillbaka knapp. Kolla SessionStudio."

## Vad som jämförs, och vad som INTE är med i jämförelsen

Ramverkets sida är Playwright mot den byggda `dist` (`check-skalyta --bilder`, scenen `handelse`, samma händelse som SS-sidan). SS-sidan är **renderad ur SS webbkälla**: markup och klasser ur `EventDetailRouteView.jsx:97-104`, `EventDetailInlinePanel.jsx:54-83`, `EventStatusDropdown.jsx`, `EventDetailInfoTabInline.jsx:129-165`, `CollapsibleDescription.jsx` och `EventDetailAvailabilityListInline.jsx`, kompilerade med Tailwind och samma ljusa SS-fixtur som 0.32.0 till 0.37.0 (`ss0400/bygg.py`). Det är SS klasser och inte SS-appen: SS-appen kräver Firebase och går inte att starta här. Ingen SS-skärmbild fanns att ta från CP för just den här sidan.

⛔ **SS-sidan i montaget saknar appens krom** (toppraden, sidopanelen, bottenraden), vilket gör att ramverkets bild är högre och har mer runt sig. Den saknar också **flikraden under rubriken** (Info, Bibliotek, Chatt, Aktivitet) som den riktiga SS-sidan har, och "Pågående"-märket. De är inte ritade för att de är SS appdata och appens åtgärder, inte för att de skulle vara lika.

| Fil | Vad |
|---|---|
| `montage-panel-390.png` | ramverket och SS sida vid sida, 390 px |
| `montage-panel-1280.png` | samma vid 1280 px |
| `handelse-panel-390.png`, `handelse-panel-1280.png` | ramverkets panel ensam |
| `ss-panel-390.png`, `ss-panel-1280.png` | SS-sidan ensam |
| `handelse-idag-390.png`, `handelse-idag-1280.png` | Idag med händelsekorten som länkar |
| `handelse-kalender-dagpanel-390.png`, `-1280.png` | kalenderns dagpanel med raderna som länkar |
| `handelse-fran-kalender-390.png`, `-1280.png` | panelen öppnad ur dagpanelen |
| `handelse-kalender-efter-tillbaka-390.png`, `-1280.png` | kalendern efter Tillbaka: dagen vald, dagpanelen kvar |

## Vad som matchar (mätt eller läst av ur bilderna och koden)

- **Tillbaka-raden:** överst, en textlänk med `ChevronLeft` på 20 px och ordet "Tillbaka" i 14 px dämpad text, utan band eller ram (SS `EventDetailRouteView.jsx:97-104`). Ramverket har 44 px träffyta (SS-raden är 20 px hög); glappet mellan chevron och ord är 6 px mot SS 8.
- **Ordningen:** Tillbaka, titel med status på samma rad, rad under titeln, informationsruta, beskrivning, deltagare. Samma uppifrån och ned, mätt i avsnitt 35.
- **Titeln:** 18 px under 768 px, 20 från 768, fet, med statusen till höger på samma rad (SS `text-lg sm:text-xl`).
- **Informationsrutan:** en kantad ruta med 12 px rundning, datumet stort bredvid en kalenderikon på 20 px, tiden bredvid en klocka, platsen bredvid en nålikon; tiden i 18 px och halvfet (SS `text-lg font-semibold`).
- **Beskrivningen:** en egen ruta med kant och 16 px text (SS `text-base`, `leading-relaxed`).
- **Kolumnen:** `max-w-4xl`, 16 px sidomarginal.

## Vad som fortfarande skiljer sig

- **Statusen.** SS har en pill med ord och chevron som är en **redigerbar väljare** (`EventStatusDropdown`, rundad, kantad). Ramverket har en prick och ett ord, skrivskyddat, i samma språk som raderna i Idag. Att rita en pill som ser ut som en väljare utan att den väljer något hade varit en knapp som ljuger, så den ritas inte; en app som kan ändra status skickar sin kontroll som `atgarder`.
- **Typraden.** Ramverket har en rad med typens ikon och ord och kalenderns färg och namn under titeln. SS visar bara gruppen där (en liten färgad ruta med initialer och "Grupp: Namn"). Typen och kalendern är ramverkets händelsemodell (`typ`, `kalender`) och finns inte i SS panelhuvud. Gruppen visas som text, utan SS gruppmärke.
- **Datumets storlek.** SS är 20 px under 640 px och 24 px från 640 (`text-xl sm:text-2xl`). Ramverket är 20 px hela vägen: 24 px finns inte i typskalan (`check-typografi`), och att lägga till ett steg för en rubrik är ett beslut för CP.
- **Platsen.** SS gör platsen till en länk i accentfärg som öppnar en karta (`LocationMapsLink`). Ramverket visar platsen som text: kartlänken är appens.
- **Beskrivningen.** SS klipper efter tre rader med "Visa hela beskrivningen" och en tonad kant. Ramverket visar hela texten: panelen är sidan där man läser den. Bakgrunden är ramverkets `sunken` mot SS `border-default/45` (liknande ton, inte samma).
- **Deltagarna.** SS "Tillgänglighet" (rubrik, antal, "Kan: N", en rad per medlem med Ej svarat och en klocka) mot ramverkets `OpsSvar` ("Svar", antal, "0 kommer, 1 kommer inte, 2 har inte svarat", knapparna Kommer och Kommer inte direkt på den egna raden). Det är 0.37.0:s avvägning (#179 F3), mätt mot SS i avsnitt 33, och den ändras inte här.
- **Flikarna, redigera och exportknapparna, serien, datumomröstningen och bokade resurser** finns inte. De är appens data och appens åtgärder. `atgarder` är platsen för knapparna; flikar och ett bibliotek hör till en senare leverans och ritas inte som döda flikar i väntan på den.
- **Appens krom** (se ovan) saknas i SS-bilden: sidopanelen med grupperna syns vid 1280 i ramverkets bild, och bottenraden vid 390.
- **Ingångarna.** SS markerar inte att Idag-kortet eller dagpanelens rad går att öppna, och det gör ramverket inte heller: raden är tryckbar över hela ytan, med understrykning av titeln vid hover och fokusring. På en telefon utan hover är det bara raden själv som säger det, precis som i SS-appen. En pil på raden prövades i dagpanelen och togs bort (se CHANGELOG 0.40.0): bubblan är för smal.
