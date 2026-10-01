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
- **Flikarna, exportknapparna, serien, datumomröstningen och bokade resurser** finns inte. (Redigera finns sedan den senare leveransen i 0.40.0, se nedan.) De är appens data och appens åtgärder. `atgarder` är platsen för knapparna; flikar och ett bibliotek hör till en senare leverans och ritas inte som döda flikar i väntan på den.
- **Appens krom** (se ovan) saknas i SS-bilden: sidopanelen med grupperna syns vid 1280 i ramverkets bild, och bottenraden vid 390.
- **Ingångarna.** SS markerar inte att Idag-kortet eller dagpanelens rad går att öppna, och det gör ramverket inte heller: raden är tryckbar över hela ytan, med understrykning av titeln vid hover och fokusring. På en telefon utan hover är det bara raden själv som säger det, precis som i SS-appen. En pil på raden prövades i dagpanelen och togs bort (se CHANGELOG 0.40.0): bubblan är för smal.


---

# Att ändra en händelse: pennan och redigeringspanelen mot SS EventDetail och EventEditRouteView

CP 2026-10-01 (#214, efter att händelsepanelen visats): "Kolla med sessionstudio också så att det går att editera en händelse."

Samma metod som ovan: ramverkets sida är Playwright mot den byggda `dist` (`check-skalyta --bilder`, scenen `handelse-redigera`, avsnitt 36), SS-sidan är renderad ur SS webbkälla (`ss0400/bygg-redigera.py`, markup och klasser ur `EventEditRouteView.jsx`, `EventModal.jsx` och `EventModalBody.jsx`; pennan finns redan i `ss-panel-*.png`, ur `EventDetailInlinePanel.jsx:84-86`). SS-appen går inte att starta här (kräver Firebase). **SS-formuläret i montaget är en delmängd** (titel, grupper, datum, tider, plats, beskrivning, aktivitetstyp, knapprad): flera datum, upprepning, deltagare, resurser och "Mer inställningar" är SS egna ytor och ritas inte.

| Fil | Vad |
|---|---|
| `montage-redigera-panel-390.png`, `montage-redigera-panel-1280.png` | pennan i titelraden: ramverket och SS sida vid sida |
| `montage-redigera-formular-390.png`, `montage-redigera-formular-1280.png` | redigeringsformuläret: ramverket och SS sida vid sida |
| `handelse-redigera-penna-390.png`, `-1280.png` | ramverkets händelsepanel med pennan, ensam |
| `handelse-redigera-formular-390.png`, `-1280.png` | ramverkets "Redigera händelse", ensam |
| `handelse-redigera-efter-390.png`, `-1280.png` | händelsepanelen efter Spara, med den ändrade rubriken |
| `ss-redigera-formular-390.png`, `-1280.png` | SS-redigeringen ensam |

## Vad som matchar
- **Pennan:** en ikon (`Pencil` i ramverket, `Edit` i SS, samma form) på 20 px i titelraden, till höger om titeln och statusen, med `title` och `aria-label` "Redigera", och bara när appen ger en åtgärd (SS: `onEdit` finns bara för den som får ändra). Mätt i avsnitt 36: 44x44 vid 390 och 36x36 vid 1280 (SS `p-2` ger 36).
- **Samma formulär som skapar, förifyllt:** SS öppnar `EventModal` inline med händelsen; ramverket öppnar skapa-panelen i redigeringsläge och appens egna formulär, förifyllt, med skalets Kalender och Kräv svar som händelsen har dem. Mätt: formuläret får `redigera`, typ, kalender och Kräv svar, och fälten är ifyllda.
- **Tillbaka går till händelsen:** raden "‹ Tillbaka" överst (SS `EventEditRouteView.jsx:145-170`), och Tillbaka och webbläsarens bakåt visar händelsen oförändrad utan att något sparats. Efter Spara visar panelen den ändrade händelsen.
- **Knappraden:** Avbryt som textknapp och Spara som fylld accentknapp längst ned till höger (SS `EventModalBody.jsx:1109-1130`).
- **Kolumnen:** `max-w-4xl` (896 px) för formuläret, som SS `EventEditRouteView.jsx:145`.

## Vad som fortfarande skiljer sig
- **Rubriken under 768 px.** SS ritar rubriken ("Redigera session", `text-xl font-bold`) UNDER raden Tillbaka. Ramverkets skapa-panel är helskärm under `md` med rubriken i samma rad som Tillbaka (centrerad, 0.31.0, bestämt för skapa-panelerna efter CP 2026-09-29), och redigeringsläget ärver det. Från 768 ligger rubriken under Tillbaka, som SS. Att ändra redigeringsläget ensamt vore att ge skapa och ändra två olika utseenden.
- **Rubrikens ord.** SS säger "Redigera session" (SS ord för en händelse är session); ramverket "Redigera händelse" (`redigeraHandelseEtikett`, appens att byta).
- **Kalender och Kräv svar** är ramverkets händelsemodell (#179) och finns inte i SS formulär. De står överst (Kalender) och sist (Kräv svar), utanför appens fält.
- **Fältens utseende.** SS har kantade fält med `!px-5 !py-2.5` och egna väljare för datum och tid; ramverket har sina `OpsDatePicker` och `OpsTimePicker` (två listor för klockslaget, datumet som text) och 44 px höga fält. Samma ordning, inte samma pixlar.
- **Aktivitetstyp** är ett sök- och rutnätsval i SS; ramverkets typ är en rullist ur katalogen (`handelsetyper`).
- **Ta bort** finns i SS knapprad. Ramverket och appen tar inte bort en händelse (reglerna: `delete: if false`, en händelse arkiveras), och en knapp utan åtgärd ritas inte.
- **Mina kalendrar** erbjuds inte som mål i redigeringsläget (se ändringsloggen): en händelse blir inte en egen post.
- **Statusväljaren** (Bekräftad) i SS rubrikrad är fortfarande skrivskyddad i ramverket, som ovan.
