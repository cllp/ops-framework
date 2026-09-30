# Kalendern 0.36.0: ramverkets månadsvy mot SessionStudio

CP 2026-09-29 21:10 i [#179](https://github.com/cllp/ops-framework/issues/179): "Kolla alla kalender inställningar och
funktioner i SessionStudio. Grundlig analys. Samma vill jag ha i ramverket." Fas F1 hänvisar till SS `CalView`, alltså gäller
regel 12.

Bilderna (vänster ramverket, höger SS):

| Fil | Vad |
|---|---|
| `kalender-390-ramverk-ss.png` | oktober 2026 på telefon, ingen dag vald |
| `kalender-dag-390-ramverk-ss.png` | den 12 oktober vald på telefon: dagpanelen under rutnätet |
| `kalender-1280-ramverk-ss.png` | oktober 2026 på dator |
| `kalender-dag-1280-ramverk-ss.png` | den 12 oktober vald på dator: dagpanelen i kolumnen till höger |

Ramverkets sida är Playwright mot den byggda `dist` (`check-skalyta --bilder`, scenen `kalender`, ljust tema, samma exempeldata
som avsnitt 30 mäter). Idag är onsdag 30 september 2026, och oktober är rullad upp under veckodagsraden.

⛔ **Ärlig anmärkning om förebilden.** SessionStudio-appen går inte att köra här (den kräver Firebase). SS-sidan är **renderad
ur SS-källan**: markup och klasser ur `views/CalendarView.jsx:124-470`, `views/CalendarViewToolbar.jsx:180-300`,
`components/CalendarSourceFilter.jsx:186-213`, `components/CalView.jsx:120-160`, `components/calView/MonthGrid.jsx:155-720` och
`components/CalendarDayPanelEvents.jsx:119-260`, med samma poster, kompilerade med Tailwind och samma ljusa färgfixtur som montagen
0.32.0 och 0.34.0. Det är SS klasser och inte en skärmbild av SS-appen: SS skal (huvud, gruppanel, bottenrad) finns inte på
SS-sidan, Tailwind 4 här har andra förval än SS Tailwind 3, gruppmärket är en cirkel med initialer och ikonerna är ritade för
hand efter Lucide. Posterna är översatta till SS modell: gruppens händelser är sessioner (Styrelsemöte, Löneutbetalning,
Deklarationsdag), och Resor och Privat är personliga kalendrar.

## Vad som nu matchar (mätt i `check-skalyta` avsnitt 30, 390 och 1280 px)

| SS | Ramverket | Mått |
|---|---|---|
| Tolv månader bakåt, tolv framåt, rullad till innevarande (`CalView.jsx:88-104`, `CalendarView.jsx` `monthsToShow={12}`) | samma | 25 månader, september 2025 till september 2027, september 2026 7,7 px under veckodagsraden |
| Klistrad veckodagsrad, måndag först (`CalView.jsx:124-138`) | samma | sju dagar, Mån först |
| Flytande "Idag" med pil mot idag (`CalView.jsx:176-194`) | samma, och pilen räknas nu om vid rullning | "↓Idag" rullad överst, "↑Idag" rullad nederst |
| Rutan är ett kort, `rounded-xl border`, datumet uppe till vänster, idag som fyllt piller (`MonthGrid.jsx:381-460`) | samma | rundning 20 (ramverkets `rounded-xl`), kant 1, idags siffra fylld i accent |
| Det som varit är nedtonat (`MonthGrid.jsx:413`) | samma | den 14 september nedtonad, idag inte |
| Prickar på telefon, piller med titel och vänsterkant från 640 px, två och sedan "+N" (`MonthGrid.jsx:552-705`) | samma | prickar och inga piller vid 390, piller "Styrelsemöte", "Löneutbetalning", "+1" vid 1280 |
| Flerdagsposter som band per vecka, staplade i filer, under siffrorna (`MonthGrid.jsx:186-294`, `calendarSpanLayout.js`) | samma, `bandIVecka` | konferensen 5-7 oktober ett band över tre kolumner, semestern 9-13 oktober två bitar, bandet under siffran |
| Veckonummer av och på, per enhet, ett tryck väljer veckan (`MonthGrid.jsx:306-314`) | samma | 129 veckoknappar, sparat "1", vecka 41 ger sju datumpiller |
| Dra-markering med 12 px tröskel, flerdagsval med piller som har kryss (`MonthGrid.jsx:81-145`, `useCalendarDaySelection.js`) | samma | ett drag 14 till 16 oktober gav tre dagar och tre kryss |
| Dagpanelen under rutnätet på pekskärm, `max-h-[45%]` (`CalendarView.jsx:208`), vid sidan på dator | samma | vid 390 under rullytan, taket 294 av 654 px, rutnät plus panel slutar vid bottenraden; vid 1280 en kolumn på 360 px |
| Antal och skapa-ruta till höger i panelen (`CalendarView.jsx:302-321`) | samma | skapa ger de valda dagarna |
| Snabbtitt med dolda poster märkta "Dold" (`CalendarDayPeekPopover.jsx`, #94) | samma, långtryck (450 ms) eller högerklick | fyra rader, två "Dold", inom fönstret, urvalet orört |
| Verktygsraden högerställd: Kalendrar, veckonummer, typ och status, sök, "+" (`CalendarViewToolbar.jsx`) | samma ordning | fem verktyg, 32 px från 768 px |
| Sök tonar ned dagar utan träff (`MonthGrid.jsx:413`) | samma, och antalet står utskrivet | "visby" ger tre dagar utan nedtoning och "3 dagar" |

## Vad som fortfarande skiljer sig

- **Verktygsraden saknar Tillgänglighet och Lager.** De hör till fas F6 i #179. En knapp för något som inte finns vore ett löfte
  som inte infrias (arbetsreglernas punkt 5).
- **Kalenderväljaren har en etikett också på telefon** ("Alla kalendrar"). SS visar bara ikonen på telefon
  (`CalendarSourceFilter.jsx:113`). Ramverkets väljare är dessutom flerval bland gruppens och mina kalendrar, SS är enkelval
  (Alla, Mina, Grupp eller en grupp). Det är #179:s beslut: gruppen är alltid den aktiva, och filtret väljer kalendrar.
- **"Hantera kalendrar"** står i menyn som en rad som säger att den kommer i F2, inte som en länk.
- **Verktygen är 44 px på telefon**, SS 32 px. Ramverkets träffyta under 768 px.
- **Rutan växer med banden på telefon.** SS har `min-h-[52px]` och låter innehållet flöda ut ur rutan; mätt i montaget: den 12
  oktober har tre poster och **inga synliga prickar** hos SS, eftersom prickarna hamnar under bandets platshållare och bakom nästa
  rad. Ramverket har ingen minsta höjd på telefon (den skapade en vågrät rullning vid 390 px, se `DagRuta`), så en rad med band
  blir högre och prickarna syns.
- **Heldag är ett band även för en enda dag** ("Deklarationsdag" den 1 oktober). SS ritar en heldagssession som ett piller och
  bara datumspann som band.
- **Pillren bär ingen ikon eller gruppmärke.** SS pill har gruppens märke och avatarer (`buildDayEventPillModel`). Ramverket har
  varken avatarer eller flera grupper per post, och märket i ikonform finns på telefonens prickar (`kindIcon`).
- **Dagpanelens kort är ramverkets egna** (0.28.0): större titel (16 px mot SS 11 px i kompakt läge), chevron som fäller ut
  status och länk i stället för att öppna posten, och ingen uppdelning i "Grupp" och "Mina". Kalenderns namn står på kortet
  bredvid dess färg.
- **Datumpillret** säger "12 oktober", SS "12 okt.". På dator har SS kryss även på ett ensamt piller och stängknappen på en egen
  rad; ramverket har krysset bara när flera dagar är valda (samma verkan som stängknappen annars).
- **Veckodagarna** kommer ur `Intl` ("Tors"), SS har egna ord ("Tor").
- **Snabbtitten öppnas också med högerklick**, SS bara med långtryck (`MonthGrid.jsx:398-405`).
- **Tidszonen är en inställning** (`tidszon`, förval Europe/Stockholm). SS har den som konstant.
