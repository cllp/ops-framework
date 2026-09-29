# Hub, tillbaka-raden, menyhöjd och textskala 0.31.2: före och efter, mätt

CP 2026-09-29 20:57 (två skärmbilder, bolag-ops, mörkt, 390 px) och 21:00 (Idag med ett utfällt kort). Alla siffror är mätta i Chromium mot den
byggda `dist` (check-skalyta avsnitt 19 och 20, mörkt tema, `--tema dark`), aldrig jsdom. "Före" är HEAD 37272d5 (0.31.2 utan detta arbete), "efter" är
arbetsträdet. Bilderna är tagna med `check-skalyta --bilder`.

⛔ **Ärlig anmärkning om förebilden.** SessionStudio-appen går inte att köra här (den kräver Firebase). SS-blocken i montagen är därför
**renderade ur SS-källan**: klasserna i `GroupDetailView.jsx:83-95` och `TodayView.jsx:83-95, 438` översatta till CSS (`text-sm` 14 px/20, `text-xs` 12 px/16,
`text-lg font-bold` 18 px/28, `text-xl font-semibold` 20 px/28, `gap-2`, `w-5 h-5`) med ramverkets mörka färgtokens och reservtypsnittet
(Plus Jakarta Sans finns inte installerad, samma reservtypsnitt på båda sidor). De är alltså SS klasser, inte en skärmbild av SS-appen.

## 1. Hubben: avstånd och sidomarginal (`hub-390-fore-efter.png`)

Orsaken var att `OpsHub` var ett bart rutnät utan ram: sidans marginal och avståndet under toppraden kommer ur `OpsView`, som appen inte lindat Hub i
(fixturens scen lindade den i `px-4 py-4` och dolde felet). Rotorsaken är åtgärdad i ramverket: `OpsHub` och `OpsHubModul` ritas nu i `OpsView`.

| Mått (px) | Före 390 | Efter 390 | Idag (referens) |
|---|---|---|---|
| Rutnätets överkant under toppraden | 0,0 | 24,0 | 24,0 |
| Vänsterkant | 0,0 | 16,0 | 16,0 |
| Högerkant (av 390) | 375,0 (mot skrollistens kant) | 359,0 | 359,0 |

768 px: 0,0 / 0,0 före, 24,0 / 16,0 efter. 1280 px: 0,0 / 200,0 före, 24,0 / 236,5 efter (Idags 236,5). Ingen horisontell överflödning i något fall.

## 2. Ekonomi fälls ut på plats

Kortet med barn är nu en knapp (`aria-expanded`, `aria-controls`, chevron som vrids 180 grader) och under den rader: "Visa Ekonomi" (modulens egen sida)
och barnen med ikon, namn, `info` och räknare. Mönstret är ramverkets eget (`HubModulRad` i rullgardinen) och SS `MoreSettingsDisclosure.jsx:66-80`
(`button aria-expanded aria-controls`, chevron 180 grader); SS har ingen utfällbar korthög, så det finns ingen närmare förebild att kopiera.
Mätt vid 390 och 1280: hopfällt från början, Enter fäller ut (barnen syns, chevron `rotate 180deg`), Space fäller ihop, "Visa Ekonomi" navigerar till `/ekonomi`.

## 3. Tillbaka-raden (`tillbaka-ss-fore-efter.png`)

| | SS (`GroupDetailView.jsx:83-95`) | Före | Efter |
|---|---|---|---|
| Form | textlänk, chevron + "Tillbaka", rubrik under | "‹ Hub / Ekonomi" i ett band | textlänk, chevron + "Tillbaka", rubrik under |
| Ram | ingen | 1 px linje under | 0 px |
| Bakgrund | ingen | `canvas`-band | ingen |
| Position | i flödet | `sticky` under toppraden | i flödet |
| Chevron / gap / text | 20 px / 8 px / 14 px | 16 px / 4 px / 0 (bara bredden) | 20 px / 8 px / 14 px |
| Rubrik | `text-xl` 20 px semibold | ingen | `sida` 20 px fet |

Länken är 44 px hög (tumme) och leder ETT steg upp (senaste `steg`, annars Hub). Samma komponent (`OpsTillbaka`) används av `OpsView tillbaka`
och `OpsHubModul`. ⛔ Avvikelse mot SS: rubrikens vikt är 700 (ramverkets `rubrik`-vikt), SS 600.

## 4. Menyns höjd (`meny-hojd-fore-efter.png`)

| Yta | Före: rot / Aktivitet | Efter: rot / Aktivitet |
|---|---|---|
| Rullgardin 1280 px | 378,5 / 402,0 px (hoppar 23,5) | 512,0 / 512,0 px |
| Ark 390 px | 470,5 / 374,0 px (hoppar 96,5) | 576,0 / 576,0 px |

Höjden är `min(32rem, fönstret minus toppraden minus säker yta minus 1,5 rem)` på dator och `min(85dvh, 36rem)` i arket, innehållet rullar inuti.
⛔ Priset, som är CP:s eget val ("Kanske att meny skall vara en standardhöjd"): roten, som har färre rader än höjden, får tom yta under sig.

## 5. Textskalan (`idag-kort-ss-fore-efter.png`)

Ett Idag-kort byggt av ramverkets komponenter (`OpsSegmented`, `OpsEventList` med utfällt kort och `OpsAttributes`), 390 px, elementen i `main`:

| Element | Före | Efter | SS |
|---|---|---|---|
| Kortets titel | 16 px / 400 (ärvd från body) | 18 px / 700 (`titel`) | `text-lg font-bold`, 18 px (20 från sm) |
| Rollen ("Du", "Agent") | 16 px (ärvd) | 14 px (`etikett`) | `text-sm` |
| Kortets meta, kind, when | 14 px (`text-sm` rakt av) | 14 px (`etikett`) | `text-xs sm:text-sm`: 12 px på telefon, 14 från sm |
| Faktarader: etikett och värde | 14 px | 14 px (`etikett`) | `text-sm` |
| Chips, märken | 12 px (`text-xs`) | 12 px (`meta`) | `text-xs` |
| Hjälptext ("Bara påminnelser ...") | 14 px | 14 px (`etikett`) | `text-sm` (`TodayView.jsx:438`) |
| Pillret Idag/Kommande | 14 px | 14 px (`etikett`) | `text-sm` (`TodayView.jsx:258`) |
| Bottenraden | 10 px | 10 px (`liten`) | `text-[10px]` |

Distinkta storlekar i ramverkets Idag-kort: före 12/14/16, efter 12/14/18. I alla fem fixtursidor: 296 textelement i `main`, alla har en roll, alla
storlekar ur rollmängden 8/10/11/12/14/16/18/20, ingen skillnad mellan 390 och 1280. Före: **300 avvikelser** (278 textelement), efter: **0**.
Största bytet i ramverket: `text-xs/sm/base/md/lg/xl` skrivna rakt av på **168 ställen i 61 filer** är nu roller, och rollerna `meta`, `brod`, `titel`
och `sida` är nya (`etikett` fick SS radhöjd 1,25 rem i stället för 1,5).
⛔ Kvarvarande skillnader mot SS: metaraden är 14 px överallt (SS 12 px på telefon), korttiteln 18 px överallt (SS 20 px från sm).
