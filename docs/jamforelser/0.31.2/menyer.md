# Valmenyer 0.31.2: varje yta med rader, mätt före och efter, mot SessionStudio

CP 2026-09-29 19:50, med en skärmbild av filtrets "Slag"-dropdown: "Typsnitten är inte syncade. Stor text och kanske inte rätt typsnitt?
Har ni verkligen gått igenom allt? Kolla olika 'slag'". Alla siffror är mätta i Chromium mot den byggda `dist` (check-skalyta avsnitt 18,
1280 px, ljust tema, ytan öppnad med tangentbordet), aldrig jsdom. "Före" är 0.31.1 (origin/main), "efter" är 0.31.2.
Typsnittet är `Plus Jakarta Sans` (tokenets `--font-sans`, SS `index.css:397`) före och efter i samtliga ytor: typsnittet var aldrig fel, storleken var det.

Raden bor på ETT ställe: `radKlass` (menyer, dropdowns), `ValRad` (valbar rad, intern), `valjAlternativKlass` (Radix Select-alternativ) och `radRubrikKlass` i `src/lib/radKlass.js`.

| # | Yta (komponent) | SS-motsvarighet (fil:rad, klasser) | Före: text / vikt / luft / vald | Efter: text / vikt / luft / höjd / vald | Ändrad |
|---|---|---|---|---|---|
| 1 | Filter, en ikon per grupp, "Slag" (`OpsFilterPanel` ikoner) | `ThemedDropdown.jsx:122` `px-3 py-1.5 text-xs font-medium`, vald `gold-overlay-subtle` + `Check` 12 px | 16 px / 600 / 12x0 / 2 px accentkontur | 12 px / 400 / 12x10 / 44 px / tonad yta + bock, ingen ram | ja |
| 2 | Filter, sorteringsikonen | samma | 16 px / 600 / 12x0 / 2 px kontur | 12 px / 400 / 12x10 / 44 px | ja |
| 3 | Filter, samlad panel (`OpsFilterPanel`) | samma | 16 px / 600 / 12x0 / 2 px kontur | 12 px / 400 / 12x10 / 44 px | ja |
| 4 | `OpsFilterChip` (ikon och textpiller) | samma | 16 px / 600 / 12x0 / 2 px kontur | 12 px / 400 / 12x10 / 44 px | ja |
| 5 | Temaväljaren (`OpsThemeToggle`) | `AppHeader.jsx` temaknappen, raderna som ovan | 16 px / 600 / 12x0 / 2 px kontur | 12 px / 400 / 12x10 / 44 px | ja |
| 6 | Idag/Kommande, statusmenyn (`OpsSegmented` menu) | `TodayView.jsx:294,357` `px-3 py-2.5 text-sm`, vald `bg-hover font-semibold` + `Check` 14 px | 14 px / 600 / 12x0 | 12 px / 400 / 12x10 / 44 px | ja (SS är 14: se not 2) |
| 7 | `OpsSelect` | `themedSelectShared.js:81-86` `optionSizeForm px-3 py-2 text-sm`, bock sist | 16 px / 400 / 32x8 (bock först, `pl-8`) / 40 px | 14 px / 400 / 12x8 / 44 px / bock sist | ja |
| 8 | `OpsTimePicker` | samma | 16 px / 400 / 32x8 / 40 px | 14 px / 400 / 12x8 / 44 px | ja |
| 9 | `OpsDatePicker` (dagarna, rubrik, Rensa) | `ThemedDatePicker.jsx:300,351` `text-xs`, dagar `h-7`, veckodag 10 px | dagar 16 px | dagar 12 px, rubrik 12 px, veckodag 10 px, ruta 36 px (44 på telefon) | ja |
| 10 | Aktivitet, Mer-menyn (`OpsActivityListActions`) | `AppHeader.jsx:514` menyraderna `text-xs px-3 py-2.5` | 14 px / 400 / 12x0 / 36 px | 12 px / 400 / 12x10 / 44 px | ja |
| 11 | Aktivitet, filterplats (`filter`) | appens innehåll | (appens) | behållaren är nu `radBehallare` | ytan |
| 12 | Grupplistan i meny (`OpsGruppvaljare`) | `MenuPanelGroupFilter.jsx:64-106` `px-2.5 py-2 text-[11px]`, vald tonad + `Check` | 14 px / 400 / 8x0 / vald `bg-sunken font-semibold` | 12 px / 400 / 12x10 / 44 px / tonad + bock | ja |
| 13 | Skapa i, dialogen (`OpsSkapaI`) | `InviteGroupPickerDialog.jsx:33-36` `gap-3 p-3 text-sm`, ram | 16 px (knappen) / 12x8 / vald = 1 px accentram | 14 px / 12x10 / 44-54 px / vald tonad + bock, ingen ram | ja |
| 14 | Huvudets meny (`OpsAppShell` + `OpsPanelRow`) | `MobileHamburgerMenu.jsx:288` `px-3 py-2.5 text-xs` | 12 px / 400 / 12x10 (0.30.0) | oförändrad (fokus se not 1) | nej |
| 15 | Skapa-menyn, plus (`OpsPanelRow accent`) | `AppHeader.jsx:384` `px-4 py-2.5 text-sm font-medium` accent | 14 px / 500 / 16x10 | oförändrad | nej |
| 16 | Hub-rullgardinen och bottenraden (`radKlass`) | som 14 | 12 px / 400 / 12x10 | oförändrad | nej |
| 17 | Menyarket (`OpsMeny`, `OpsBottomNav`) | `MobileHamburgerMenu.jsx:288` | 12 px | oförändrad | nej |
| 18 | Gruppanelen (`OpsGruppanel`) | `AppSidebar.jsx` (0.30.1, avsnitt 8, redan SS-exakt) | mätt i avsnitt 8 | oförändrad | nej |
| 19 | `OpsGruppfilter` | pillerknappar, inte rader (`text-sm`, SS `CalendarSourceFilter`) | 14 px | oförändrad | nej |
| 20 | `OpsSimulatePopover` | inga rader, en skjutreglage-yta | | oförändrad | nej |

Sammanlagt 20 ytor genomgångna; 13 ändrade (1-10, 11, 12, 13), 7 oförändrade eftersom de redan var `radKlass` eller inte är rader.
Vakten mäter 16 av dem i 1280 och 390 px (30 mätningar), resten är ren läsning i tabellen.

## Vad som ändrades

- **Storleken:** valraderna var `text-base` (16 px), skrivna i fyra kopior (`OpsFilterPanel`, `OpsFilterChip`, `OpsThemeToggle`, `OpsSegmented`), en femte och sjätte i `OpsSelect`/`OpsTimePicker`. Nu `ValRad` (12 px) respektive `valjAlternativKlass` (14 px, SS formulärlista).
- **Den tjocka ramen:** var Radix fokus in i menyn, ritad som `outline-2 accent` av radens fokusstil på den första (och valda) raden. Fokus är nu en yta (`bg-hover`), aldrig en ram, och den valda raden är en tonad yta med bock. Mätt: konturen är 2 px före och 0 efter.
- **Den valda raden syntes inte i ljust läge:** `raised` är samma färg som `surface` i ljust tema, och behållarna var `bg-raised`. Valt är nu `bg-accent-subtle` (SS `gold-overlay-subtle`), behållarna `bg-surface`.
- **Rubriken** ("SLAG") stod 4 px till vänster om sina rader (`px-2` mot radens `px-3`): `radRubrikKlass`.

## Noter (avvikelser som är avsiktliga)

1. Fokus på en rad ritas som `bg-hover` och inte som ram. SS har ingen egen fokusram i sina menyer.
2. Statusmenyn (rad 6) är `text-sm` i SS (`TodayView.jsx:294`) men `text-xs` i alla andra SS-menyer; den följer menystandarden (12 px). Byte till 14 är en rad i `radKlass` om CP vill ha SS-siffran där.
3. Höjden är minst 44 px (tumkravet), SS är 28 till 38 px. Bredd, text och luft är SS.
4. Hover på menyns navigeringsrader är `bg-raised` (SS `hover:bg-card`) och syns inte i ljust läge, eftersom `raised` = `surface` där. SS har samma egenskap i den profilen. Ej ändrat, men värt ett beslut.
