---
name: ci-and-guards
description: Hur vi skriver vakter och vad CI faktiskt kostar. Ladda innan du lägger till en kontroll, en workflow eller en regel som någon ska följa.
---

# Vakter och CI

En regel som bara står i ett dokument följs inte. Det är inte ett omdöme om
disciplin, det är mätt: i SessionStudio stod kravet på bot-review i minnet i
månader, och av de 16 senast mergade PR:erna hade **en** faktisk review före
merge. Regeln fanns. Den var bara inte en mekanism.

## ⛔ Tre satser, i den här ordningen

**1. En vakt ingen sett faila är en förhoppning.**

Vi har haft vakter som var gröna i månader för att de läste fel fil, jämförde en
lista mot en kopia av sig själv, eller blev gröna av tom indata. Alla tre såg ut
precis som fungerande vakter. Falsk grönhet är **värre** än ingen vakt alls,
eftersom den flyttar uppmärksamheten bort från risken.

Därför har ramverket `scripts/test-guards.mjs`: det bryter varje regel i en kopia
och kräver både rött utfall **och** rätt felmeddelande. Det andra villkoret är
det som fångar en vakt som blir röd av fel anledning.

**2. En regel som utlovar ett skydd den inte har är farligare än ingen regel.**

SessionStudios regelbok sade att fem statuskontroller krävdes för merge. Den
raden slutade vara sann en kväll, och ingen märkte det på sex dagar. Agenter som
läst den trodde sig skyddade och slutade kontrollera för hand. Skriv därför
aldrig att något är skyddat utan att ha mätt att det är det.

**3. Ett tak som sjunker slår ett golv som är noll.**

Sätter du en ny vakt till noll avvikelser direkt blir all befintlig kod röd utan
att någon lagar den, och då stängs vakten av eller kringgås. Sätt taket vid
dagens antal och låt det bara få sjunka. Då blir adoptionen synlig fil för fil.

## Så skriver du en vakt

Varje vakt i ramverket följer samma form, och varje del har ett skäl:

- **Ett golv.** Blir vakten grön av att noll filer lästes ska den säga ifrån.
  `check-closed-api.mjs` avslutar med exit 1 på tom indata.
- **Kommentarer bort innan reglerna körs.** Både tokenvakten och API-vakten
  flaggade sina egna varningstexter i sin första version. En vakt med falska
  positiva blir avstängd oavsett hur rätt den har i sak.
- **Radnummer som stämmer.** Ta bort kommentarer genom att ersätta dem med lika
  många radbrytningar, inte genom att klippa bort dem.
- **Räkna klamrar, inte regex, över nästlade block.** Regex över nästling läser
  tyst fel halva och rapporterar grönt.
- **Felmeddelandet säger VARFÖR, inte bara VAD.** Den som möter vakten ska förstå
  kostnaden utan att leta upp ett dokument. "bg-red-500 genererades trots att
  tokenkontraktet nollar Tailwinds palett" säger mer än "otillåten klass".
- **En mutation i test-guards.** Utan den är vakten oprövad.

## Bygget är en starkare vakt än CI

Bäst av allt är en regel som byggkedjan själv upprätthåller. `--color-*: initial`
i temat gör att `bg-red-500` **slutar existera**, inte att den fångas senare. En
sådan regel kan ingen deadline förhandla bort.

Det finns förstås gränser: `bg-[#ff0000]` överlever ändå, vilket är mätt i
`check-css-build.mjs`. Det är just därför luckan är **uttalad** där och stängs på
rätt ställe i stället för att antas vara täckt.

## Vad CI kostar, i kronor

Mätt i SessionStudio, inte gissat:

- Privat repo, Linux 2-core: cirka **0,008 USD per minut**. 400 minuter per dygn
  är cirka **100 USD i månaden**.
- **87 procent** av minuterna låg i PR-triggad CI, alltså i takten, inte i
  konfigurationen. **46 procent** var ompushar av samma gren.

Följden för hur vi arbetar:

- **Committa ofta lokalt, pusha sällan.** En commit startar ingenting. En push
  startar varje workflow som lyssnar på grenen.
- **En gren per arbetspass, inte per fix.** En bugg per *commit* är rätt; en bugg
  per *PR* är en volymregel som kostar pengar utan att ge kvalitet.
- **Den lokala grinden är golvet**, inte ett komplement. `npm run gate`.
- **Mät, skär, mät igen.** Vi stängde av ett nattligt jobb, sparade 229 minuter
  per dygn och bokförde saken som löst. Fyra dagar senare låg vi högre än före,
  eftersom PR-volymen ätit upp besparingen och ingen mätte om.

## Tre fällor när du mäter

- **"Active" betyder inte "kör".** GitHub visar `active` för allt som inte är
  manuellt avstängt, inklusive workflows som bara har `workflow_dispatch`. Räkna
  körningar, inte rader i en lista.
- **En workflow vars fil är borta ur default-branchen står kvar som `active` för
  alltid.** Den kan inte köra men ser levande ut.
- **Path-filter kan vara satt ur spel av era egna rutiner.** SessionStudios
  emulator-filter fångade `packages/shared/*`, som inkluderade en genererad fil
  varje användarnära PR rörde. Grinden var öppen i praktiken. Läs vad ett filter
  faktiskt matchar mot en riktig diff innan du litar på det.
