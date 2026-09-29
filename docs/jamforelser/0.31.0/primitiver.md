# Primitiverna mot SessionStudio (0.31.0)

CP 2026-09-29: "Dubbelkolla alla primitiver så att det blir enhetligt med sessionstudio nu." Varje exporterad komponent i `src/index.js`
(93 stycken) är genomgången. Tabellen anger SS-förlagan (fil:rad i `sessions-platform/apps/web/src`), avvikelsen och åtgärden. Där SS saknar
motsvarighet står det, och komponenten ritas då genom de gemensamma klasserna (`radKlass`, `radBehallare`, `huvudknappKlass`, `faltKlass`,
`gruppRutaKlass`) och typografirollerna, aldrig med egna tal. Mätningen (vakten) står i `scripts/check-skalyta.mjs` avsnitt 17.

**SS radier** (`index.css:215-221`, `.rounded-app`): `rounded` = `--radius` 12 px, `rounded-md` 10, `rounded-lg` 16, `rounded-xl` 20, `rounded-2xl` 24. Ramverkets
tokens: `--radius-base` 12, `--radius-md` 10, `--radius-lg` 16, `--radius-xl` 20, `--radius-card` 24.

## Rättat i 0.31.0

| Komponent | SS-förlaga | Avvikelse före | Åtgärd |
|---|---|---|---|
| `OpsInput`, `OpsTextarea` | `forms/TextInput.jsx:102` (`rounded border-[1.5px] bg-surface py-2 px-3`), fokus `index.css:1424-1428` | `rounded-md` (10 px), kant 1 px, `bg-canvas`, konturen UTANFÖR kanten | `faltKlass`: 12 px, 1,5 px, `bg-surface`, kontur `-outline-offset-2` och accentkant, `hover:border-line-strong`, `min-h-11` |
| `OpsSelect`, `OpsDatePicker`, `OpsTimePicker` (trigger) | `dropdown/themedSelectShared.js:71-75` (`rounded-[var(--radius)] border`, `hover:border-hover`, fokusring accent) | `rounded-md`, `bg-canvas`, skriven tre gånger | `faltTriggerKlass` (12 px, 1 px kant som SS väljare), en definition |
| `OpsSelect` (lista) | `themedSelectShared.js:76-87` (`--radius`, kant, skugga; valt val `gold-overlay-subtle`) | `rounded-md`, ingen markering av valt val | `faltYtaKlass` (12 px), valt val `bg-accent-subtle` |
| `OpsModal` | `ui/ModalShell.jsx:13-15,40` (`sm` max-w-md, `md` max-w-2xl, `lg` max-w-5xl, `rounded-[var(--radius)]`) | 384, 512 och 768 px, rundning 16 px | 448, 672 och 1024 px, rundning 12 px från `md` |
| `OpsSkapaI` (ny) | `CalendarCreateDestinationSheet.jsx:53-135` (`rounded-t-2xl`/`sm:rounded-2xl`, rad `rounded-xl`) | fanns inte | 24 px, rad 20 px, märke 34 px |
| `OpsButton` `sm` | `ui/PrimaryButton.jsx:44-47` (`sm`: `px-3 py-1.5 text-xs`) | `py-1 text-sm` | `py-1.5 text-xs` |
| `OpsCheckbox` | `forms/Checkbox.jsx:47` (`w-[18px] h-[18px] border-[1.5px]`) | 20 px, kant 1 px | 18 px, 1,5 px kant, `bg-surface` |
| `OpsRadioGroup` | `forms/Radio.jsx:35-48` (`min-h-[24px]`, `text-sm`) | `px-4 py-3`, fet titel, `text-sm` hjälptext | `px-3 py-2`, `etikett`/`hjalp`, `min-h-11` (tumme) kvar |
| `OpsSegmented` | ingen direkt SS-förlaga; rollen `etikett` är `SettingsView.jsx:228` (`text-sm`) | `py-2 px-5` | `py-1.5 px-4`, rollen `etikett` (14 px, `font-medium`) |
| `OpsHub` (info-rad) | SS metadata i `ink-secondary` | `ink-muted`, 3,76:1 mot kortet i ljust läge | `ink-secondary`, 7,65:1; "Inget nytt" egen statusstil |
| `OpsIconLink` | SS `AppHeader.jsx` (`title` på varje ikonknapp) | ingen synlig tooltip | `OpsTooltip` med etiketten, `aria-label` kvar |
| Toppradens flik med undermeny | `AppHeader.jsx:217-230` (chevron `ml-0.5` inne i fliken) | chevronen som egen knapp med egen luft | luften delas (`FLIK_LUFT`), 2 px till chevronen |
| `OpsHubModul` tillbaka-raden | (ingen SS-förlaga, ramverkets egen) | negativ marginal, ritades över panelen | `OpsHubTillbaka`, hålls i kolumnen |
| Menyn (rullgardin) | `AppHeader.jsx:514` (`w-80`) | innehållsbredd (208 till 1256 px) | `w-80`, samma ruta för undervyer |
| Skapa | `GroupEditRouteView.jsx:36-47`, `ManageGroupModal.jsx:454,479,640` | modal | `OpsSkapaPanel` (se CHANGELOG) |
| Accent | `index.css:690-704,767-781` (tonen Brun) | grön | `#9e8a6e`/`#8E7A4E` |

## Avvikelser som står kvar, med skäl

| Komponent | SS-förlaga | Avvikelse | Skäl |
|---|---|---|---|
| `OpsButton` (form) | `ui/PrimaryButton.jsx:49-50` är `rounded-[var(--radius)]` (12 px) | ramverket är pill (`rounded-full`) | CP-beslut 2026-09-28 18:20: "knapparna blir piller som SessionStudio" (`LoginScreen.jsx` `v7PrimaryButtonClass`). SS har båda; CP valde pillen |
| `OpsButton` `secondary` | `ui/SecondaryButton.jsx:42-46` (ingen kant, ingen yta, `hover:bg-hover`) | ramverket har kant och yta; SS motsvarighet är `ghost` | `secondary` är en tydlig sekundär åtgärd på en yta utan rader omkring; `ghost` är SS `SecondaryButton` |
| `OpsSwitch` | `forms/Toggle.jsx:56-70` (spår 40x24, kant 1,5 px, knopp 17 px) | kant 1 px, knopp 20 px | Kanten och knoppens storlek är mätta för kontrast (WCAG 1.4.11): fyllningen bär inte kravet, kanten gör det. Spåret är lika stort |
| `OpsCard` | `ui/SurfaceCard.jsx:16` (`--radius` 12, `hover:bg-hover`) | 24 px (`--radius-card`) | SS `rounded-2xl` på instrumentpanelens kort; `OpsCard` är det kortet. Raderna i det är `radKlass` (12 px) |
| `OpsPill`, `OpsTag`, `OpsChip` | SS `TogglePill.jsx` m.fl. | piller | Samma form som SS filterpiller; vald-läge `accent-subtle` (SS `gold-overlay-subtle`) |

## Övriga komponenter

Genomgångna och utan avvikelse mot en SS-förlaga, eller utan förlaga. De använder `radKlass`, `radBehallare`, `huvudknappKlass`, `faltKlass` eller
tokens direkt:
`OpsActivityButton`, `OpsActivityDetail`, `OpsActivityList`, `OpsActivityListActions` (SS `ActivityFeedPanel`: rader `radKlass`), `OpsAppShell`,
`OpsAttributes`, `OpsAuth`, `OpsAuthGate`, `OpsAuthProvider`, `OpsBanner` (ingen SS-förlaga; `rounded-md`), `OpsBottomNav` (SS `MobileTabBar.jsx:87`, 20 px ikon, 10 px etikett, 56 px),
`OpsBrand` (0.31.0), `OpsBreakdown`, `OpsCalendar` (SS `CalView`), `OpsCountBadge` (SS `AppHeader.jsx:222`, 16 px cirkel), `OpsDataProvider`, `OpsDataView`, `OpsDisclosure`,
`OpsEmpty`, `OpsEventList`, `OpsFact`, `OpsFilePicker`, `OpsFilterChip`, `OpsFilterPanel`, `OpsFloatingSummary`, `OpsFullscreenToggle`, `OpsGruppanel` (SS `AppSidebar.jsx`, `GroupCard.jsx`),
`OpsGruppfilter`, `OpsGruppmarke`, `OpsGruppvaljare`, `OpsGruppvaxlare`, `OpsHelp`, `OpsIdentity` (SS `GroupMark`, 34 px i remsan), `OpsInloggning` (SS `LoginScreen`),
`OpsKatalogInstallning`, `OpsKnob`, `OpsList`, `OpsListRow`, `OpsMarkdown`, `OpsMedlemmar`, `OpsModulHandelser`, `OpsModulHjalp`, `OpsModulKataloger`, `OpsNotiser`,
`OpsOversikt`, `OpsPanel`, `OpsPanelHeader`, `OpsPanelRow` (SS `MobileHamburgerMenu.jsx:288`, `radKlass`), `OpsProfil` (SS `ProfileView`), `OpsPrompt`, `OpsProvenance`, `OpsRankChart`,
`OpsScrollArea`, `OpsSectionLabel` (SS `MobileHamburgerMenu.jsx:314`), `OpsShareChart`, `OpsSimulatePopover`, `OpsSkapa`, `OpsSlider`, `OpsSok` (SS `SearchView`), `OpsSpinner`, `OpsStat`,
`OpsStatusDot`, `OpsTable`, `OpsTabs` (SS `AppHeader.jsx:217`), `OpsThemeToggle`, `OpsToast`, `OpsToastProvider`, `OpsToggleRow`, `OpsTooltip`, `OpsUtanMedlemskap`, `OpsView`, `OpsViewHeader`.

Ikoner: `strokeWidth={1.5}` överallt (SS grön profil, `--icon-stroke-width`), 16 px i rader, 18 px i plusset, 20 px i huvudet och bottenraden.

## Så mäts det

`check-skalyta` avsnitt 17 ritar ett galleri (`scripts/lib/skalyta-entry.jsx`, `Galleri`) i ljust OCH mörkt läge och mäter rundning, höjd, kantbredd,
yta och hover mot tokens för knapp (tre varianter och den lilla), textfält, väljare, datum, tid, segmenterad, kort, rad, pill, tagg och
chip. Modalens mått (672 px, 12 px) mäts i avsnitt 14 och "Skapa i"-arkets rundning (24 px) i avsnitt 15. ⛔ Chromium (headless) rundar en
1,5 px kant till 1 px i det BERÄKNADE värdet även vid skala 2, så textfältets kantbredd läses ur stilmallens regel för klassen.
