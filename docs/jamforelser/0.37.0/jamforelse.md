# 0.37.0: kalendern på telefon, hantera kalendrar, Ny händelse och svaren mot SessionStudio

Två sorters förebild i den här mappen, och de ska inte blandas ihop:

1. **Kalendern på telefon** står bredvid **CP:s egna skärmbilder ur SS-appen** (2026-09-30), i `scratchpad/cp-kalender/` när
   montaget gjordes. Det är förebilden CP har i handen.
2. **Hantera kalendrar, Ny händelse, väljaren och svaren** står bredvid SS-sidor **renderade ur SS webbkälla** (markup och klasser
   ur SS-komponenterna, kompilerade med Tailwind och samma ljusa färgfixtur som 0.32.0 till 0.36.0). Det är SS klasser och inte
   SS-appen. SS-appen går inte att köra här (den kräver Firebase).

Ramverkets sida är Playwright mot den byggda `dist` i alla bilder (`check-skalyta --bilder` och en provkörning med samma scen,
`kalender`, där idag är onsdag 30 september 2026). Allt i tabellerna under "mätt" mäts i `check-skalyta` avsnitt 30 till 33.

## ⛔ Varför kalendern jämförs mot en annan förebild än i 0.36.0

0.36.0:s montage (`docs/jamforelser/0.36.0/`) ställde ramverket bredvid en sida renderad ur SS webbkälla (`CalView.jsx`,
`MonthGrid.jsx`). SS webb och SS-appen ritar olika rutnät: webben har siffran uppe till vänster, `rounded-xl` och band, appen har
siffran centrerad, prickar och streck, och en panel av bubblor. Montaget kunde alltså inte visa det CP såg på telefonen, och
det gjorde det inte heller: CP jämförde själv och fann rundningen, panelen, märkena, valet och verktygsraden fel. Det är samma
fel som regel 12 finns för, en nivå upp: en jämförelse mot fel förebild bevisar lika lite som ingen jämförelse.

## Bilderna

| Fil | Vad |
|---|---|
| `kalender-390-ramverk-ss.png` | tre kolumner: 0.36.0 på CP:s telefon, 0.37.0, SS-appen |
| `kalender-dag-390-ramverk-ss.png` | en vald dag (12 oktober) mot SS-appens `ss-dagpanel-en-dag-390-cp.png` |
| `kalender-dagar-390-ramverk-ss.png` | tre valda dagar (12 till 14 oktober) mot SS-appens `ss-dagpanel-scroll-390-cp.png` |
| `kalender-lager-390-ramverk-ss.png` | platsen för F6 (den 14 oktober med ton och två hörnmärken) mot `ss-lager-tillganglighet-390-cp.jpg` |
| `kalendrar-390`, `kalendrar-1280`, `kalendrar-ny-390` | Hantera kalendrar mot SS `PersonalCalendarsInlineSection.jsx` |
| `ny-handelse-390`, `ny-handelse-1280`, `min-kalender-390` | Ny händelse mot SS `EventModal` och `PersonalCalendarEntryModal` |
| `kalender-valjare-390`, `kalender-valjare-1280` | raden Kalender (Skapa i) mot SS `CalendarCreateDestinationSheet` |
| `svar-390`, `svar-1280` | inkorgens rad och `OpsSvar` mot SS `EventDetailAvailabilityListInline` |

## Kalendern på telefon: vad som nu matchar SS-appen (mätt vid 390 px)

| SS-appen | Ramverket 0.37.0 | Mätt |
|---|---|---|
| Rutan `radius.md` 12, mjuk yta, tunn kant | `rounded-base` (`--radius-base`) | rundning 12, kant 1 (0.36.0: 20) |
| Vald: mörk fylld ruta, ljus text, `radius.lg`, lite förstorad | inverterad yta, `rounded-lg`, `scale-[1.05]` | rundning 16, yta mörk, siffran ljus |
| Idag: mörk cirkel runt siffran i en ruta med kant | samma | 28 x 28 px, mörk |
| Siffran centrerad | samma | 0,0 px från rutans mitt |
| Prickar för endagsposter, streck för flerdagsposter i varje ruta, två rader, "+N" | `markorlayout` porterad ur `calendarDayMarkerLayout.js` | prickar 6 x 6, streck 10 x 4; konferensens streck den 5, 6 och 7 oktober och inte den 4:e eller 8:e; semesterns 9 till 13 oktober över veckogränsen; inga band vid 390 |
| Inga ikoner i rutan | samma (hörnmärkena är F6:s plats, inte postens ikon) | 0 ikoner i dagsrutorna |
| Verktygsraden: rena ikoner till vänster, kalenderpillret till höger | samma, 44 px träffyta | Sök, Veckonummer, Typ och status utan kant och yta, ikoner 22 px; pillret sist, en kapsel med text |
| Den valda veckan rullas upp ovanför panelen | samma: rutans underkant mäts mot panelens topp och det som saknas rullas (bara under 1024 px) | vald ruta 12 oktober: underkant 484,9, panelens topp 493 (röd utan rättelsen: 556,9) |
| Dagpanelen flyter över rutnätet | samma, utan egen yta | panelen börjar 294 px över rullytans underkant, rullytan lika hög med panelen öppen (654 px) |
| Datumpiller med var sitt kryss, stäng-krysset till höger | samma | tre piller, tre kryss |
| En bubbla med posterna, GRUPP och MINA som rubriker, tak 140 px | samma | rullytan 140 px med 312 px innehåll, rubrikerna Grupp och Mina |
| Antalet och Skapa till höger | samma | båda finns, Skapa ger de valda dagarna |
| Lagrens egen bubbla under | platsen finns (`daglager`), ritas bara med innehåll | ingen bubbla i scenen utan lager |
| Lagrets ton och runda hörnmärken, `top: -6, right: -6` | platsen finns (`dagdekor`) | ton synlig, två märken, 5 px utanför hörnet |

## Kalendern på telefon: vad som fortfarande skiljer sig

- ⛔ **Märkenas färg är CP:s tillägg, inte SS.** SS-appen ritar alla prickar och streck i samma grå. CP bad om "rätt färg för
  kategori", så ramverket färgar dem efter slag, annars kalender. Formatet är SS rakt av, färgen är vår.
- **Postraden.** SS har en högerpil (öppnar sessionen) och en rad med tid och grupp; ramverket har en chevron som fäller ut
  raden och dagen under titeln, eftersom posten öppnas i panelen och inte i en egen sida.
- **Kalenderpillrets ikon.** SS har filterikonen (reglage) i pillret och gruppens namn som text; ramverket har kalenderikonen,
  "Alla kalendrar" och en chevron. Typ och status är en egen ikon hos oss; hos SS sitter filtret i pillret.
- **SS-appens verktygsrad har fler knappar** (medlemmar, lager) och i en av bilderna ett "+" längst till höger. Ramverket har
  inga lager än (F6) och har Skapa i bottenradens plus på telefon, inte i verktygsraden.
- **Ordningen i verktygsraden är CSS-ordning.** På telefon flyttas Sök först och pillret sist med `order`; i DOM står de som
  på dator (Kalendrar, Veckonummer, Typ och status, Sök). En skärmläsare läser alltså i datorns ordning. Det är medvetet (en
  DOM, två lägen) men det är en skillnad mot hur raden ser ut.
- **Månadsrubriken.** SS-appen visar ingen rubrik för den första synliga månaden i bilden; ramverket har rubrik på varje månad.
- **Idag-cirkeln är svart hos oss och mörkgrå hos SS**; båda använder sin egen mörka yta. Tonen i idag-rutan är något varmare hos oss.
- **Skalets huvud.** Ramverkets bild har appens huvudrad (logga, inkorg, sök, avatar) ovanför kalendern; SS-appen har
  statusraden och verktygsraden direkt. Det är skalet, inte kalendern.
- **Datumpillren överlappar** varandra en aning när tre dagar i samma vecka är valda (texten "12 oktober" skärs av nästa
  pillers kryss). SS har samma täthet i sin bild, men här syns det mer eftersom våra piller är bredare.
- **Rullningen i bubblan och "sidan bakom".** Skalytan mäter att ingen annan rullyta rör sig när bubblan rullas. I
  Chromium finns ingen rullbar förälder ovanför bubblan (dokumentet är lika högt som fönstret), så mutationen som tar bort
  `overscroll-contain` förblev grön. Egenskapen står kvar för iOS, där studs och dra-för-att-ladda-om annars tar över;
  det har inte gått att mäta här.

## Hantera kalendrar, Ny händelse och svaren: vad som matchar

| SS | Ramverket | Mätt |
|---|---|---|
| Mina kalendrar i ett kort: märke, namn, "Standard", penna, Ny kalender (`PersonalCalendarsInlineSection.jsx`) | ett kort för gruppens och ett för mina, märke 24 px, namn, "Förvald", penna, Ny kalender | märket 24 px, knapparna 44 px på telefon och 32 från 768 |
| Redigeraren: namn, färg, ikon, Standard, Avbryt och Skapa lika breda | samma, sex färger och åtta ikoner | Avbryt och Skapa lika breda; Skapa går inte att trycka utan namn |
| "Skapa i": grupper och Mina kalendrar (`CalendarCreateDestinationSheet`) | raden Kalender öppnar samma sorts väljare, gruppens förvalda vald | ark nerifrån på telefon, centrerad ruta på dator |
| Personlig post: välj kalender, påverkar tillgänglighet (`PersonalCalendarEntryModal`) | i en av mina: Blockerar tillgänglighet, ingen typ, ingen Kräv svar | formuläret fick kalendern `{ slag: "mina" }` och ingen typ |
| Tillgänglighet: en rad per medlem, räknare, "Ej svarat" | `OpsSvar`: "0 kommer, 1 kommer inte, 2 har inte svarat", bara min rad har knappar; vid 390 ligger knapparna under namnet | alla tre delarna också vid noll; egna namnet "Anna Ek (du)" avkortat 0 px vid 390 (röd utan rättelsen: 37 px) |

## Hantera kalendrar, Ny händelse och svaren: vad som skiljer sig

- **Ta bort mot arkivera.** SS har en papperskorg; ramverket arkiverar (poster i kalendern finns kvar) och har "Arkiverade"
  under en egen rubrik. Ramverket har också upp och ned för ordningen, som SS inte visar i kortet.
- **SS kalenderhubb har flikarna Kalenderkällor, Kalenderlager och Tillgänglighet.** Ramverket har bara källorna; lager och
  tillgänglighet är F6.
- **Ny händelse:** SS har datum och tid som små kapslar och typen som knappar; ramverket har appens egna fält (typ som
  rullgardin, datum och tid som fält) och raden Kalender överst. Kräv svar finns inte i SS (SS har ett eget RSVP-flöde).
- **Svaren:** SS har tre svar (Ja, Nej, Kanske); ramverket två (Kommer, Kommer inte), som CP bad om. SS har en klocka för
  påminnelse på den som inte svarat; ramverket har ingen påminnelse.
- **Skicka mejl** visas inte (avsändarbeslutet #180 G3 saknas), och **upprepning** ingår inte (CP har inte beslutat).

## Gruppväxlaren

CP:s önskan gällde vår egen app (arket "Byt grupp" på telefonen), inte en SS-förebild, så det finns inget montage för den.
`check-skalyta` mäter att arket vid 390 px saknar "Skapa grupp" och att plussets "Ny grupp" finns, och att gruppanelen vid
1280 px behåller sin knapp.
