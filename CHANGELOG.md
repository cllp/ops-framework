# Ändringslogg

Formatet följer [Keep a Changelog](https://keepachangelog.com/sv/1.1.0/), och
versionerna är [semver](https://semver.org/lang/sv/).

⛔ **Varje tagg `vX.Y.Z` ska ha ett avsnitt här.** `check-paket` kräver att
versionen i `package.json` står i den här filen, eftersom en utgivning utan
anteckningar är en version ingen kan välja att hoppa över.

---

## 0.20.0

Fas 2 fortsätter. Båda luckorna nedan hittades när appens halva
([cllp/bolag-ops#384](https://github.com/cllp/bolag-ops/issues/384)) skulle
börja, alltså precis i den ordning som skulle hitta dem: ramverket först, appen
sedan.

⛔ **`0.19.0` och den första `0.20.0` hann aldrig taggas.** Därför står #119 i
det här avsnittet i stället för i ett eget: en version ingen någonsin kan
installera är en rad i loggen som bara går att snubbla på.

### Tillagt

- **`texter` på kategorin** ([#117](https://github.com/cllp/ops-framework/issues/117)).
  En påse namngivna texter, var och en ett `Namn` och alltså tvåspråkig. Skälet
  är mätt i appens listor: en kategori behöver plural i filtret ("Uppgifter"),
  singular på raden ("Uppgift"), en kort form i smala kontroller ("Ekonomi"),
  och inkorgens sorter dessutom nio hjälptexter var. ⛔ En påse och inte fasta
  fält, eftersom vilka texter som behövs är appens fråga och inte ramverkets.
  Ramverket vet inte vad en rubrikhjälp är; det det kan veta är att varje text
  har svenska.
- **`textnycklar`, alltså vilka texter katalogen kräver**. Skickas till
  `validateKatalog`, `byggKategori` och `createCatalogSource`. En kategori som
  saknar en deklarerad nyckel är rött vid uppstart. ⛔ Utan det kravet är
  "texterna tappas inte i flytten" ett löfte utan vakt: en kategori som läggs
  till i inställningsvyn föds då utan hjälptexter, och resultatet är ett
  formulär med tomma fält och inga exempel, alltså sämre än listan det ersatte.
- **`faser`, alltså om katalogen har faser alls** ([#119](https://github.com/cllp/ops-framework/issues/119)).
  Skickas till `byggKategori`, `validateKatalog` och `createCatalogSource`.
  Förvalet är `true`, alltså oförändrat. En **sortkatalog** deklareras med
  `faser: false` och får `fas: null`. Skälet är mätt i cllp/bolag-ops#384: av
  appens åtta listor är varenda en som flyttar en sortlista (uppgift,
  påminnelse, faktum, kvitto, ärende), och `arAvslutad` och `AVSLUTADE_FASER`
  används ingenstans i appen. Fasen finns för att en vy ska kunna fråga om en
  RAD är klar, och i en sortkatalog avgörs det av radens egen status och aldrig
  av dess sort. ⛔ En fas som ändå skickas in **avvisas**, den ignoreras inte:
  vore fältet bara valfritt kunde två kategorier i samma katalog skilja sig åt,
  och då kan ingen vy lita på svaret. ⛔ `null` och inte tom sträng, eftersom
  `null` säger "den här katalogen har inga faser" medan en tom sträng ser ut som
  något någon glömt fylla i.
- **`texten(kategori, nyckel, sprak)`**. Svarar tom sträng och kastar aldrig,
  samma val som `beteendet()`: den körs i en vy, på en rad som kan peka på en
  kategori som hunnit arkiveras, och en vy som kastar där tar ned hela listan i
  stället för en rad.

### Ändrat

- ⛔ **`byggKategori` AVVISAR OKÄNDA FÄLT i stället för att slänga dem.** Mätt
  före ändringen: en kategori skriven med `lofte` och `titleHint` högst upp kom
  ut utan båda, och ingenting kastades. Den som skrev fick en grön uppstart och
  en tom rad i vyn, alltså letade i vyn efter ett fel som låg i katalogen. Felet
  säger nu vart texten hör hemma i stället. Det här är den enda ändringen som
  gör resten omöjlig att göra fel, och det är skälet till att den finns.
- **`saknadeSprak` räknar också texterna i påsen.** Inkorgens sorter bär nio
  texter var, alltså vida fler ord än namnen. En vakt som bara tittade på
  nyckeln `namn` hade visat noll medan merparten av appens ytor fortfarande var
  enspråkiga, vilket är exakt det den finns för att förhindra.
- **`OpsKatalogInstallning` ritar ingen fasväljare i en sortkatalog**, och
  ingen tom fas-etikett på raden. En rullgardin för något som inte sparas är
  värre än ingen: den som väljer i den tror att valet betyder något, och det
  hade dessutom stått i den enda vy som byggts för den som äger verksamheten.
- **`OpsKatalogInstallning` både bär och visar texterna.** Vyn byggde förut en
  ny kategori av formulärets fält och bara dem, så en redigering av en befintlig
  kategori hade RADERAT dess texter: samma tysta förlust en gång till, men
  utlöst av en knapp och därmed värre. ⛔ Den ritar också de texter kategorin
  bär utan att de är deklarerade, eftersom en text som bärs vidare utan att
  synas är ett läge där vyn ljuger med utelämnande.

⛔ **Bakåtkompatibelt.** `texter` är en tom påse när inget skickas in, och
`textnycklar` utan värde kräver ingenting. Det som inte är bakåtkompatibelt är
avvisningen av okända fält, och den är avsiktlig: ett fält som försvann tyst
förut gör det inte längre.

---

## 0.19.0

Fas 2 i epiken [#92](https://github.com/cllp/ops-framework/issues/92), ramverkets
del: konfigurationen blir data, och orden blir två.

### Tillagt

- **Katalogschemat, med validering vid uppstart** ([#108](https://github.com/cllp/ops-framework/issues/108)).
  En kategori är `{ id, namn, farg, ikon, fas, ordning, arkiverad }`.
  `validateKatalog` körs vid uppstart i samma form som `validateNav` och kastar
  med katalogens namn och fältet. ⛔ `id` ändras aldrig och `namn` får ändras
  fritt, eftersom varje rad i databasen pekar på `id`: vore namnet nyckeln
  förlorar en omdöpning kopplingen till allt som redan skrivits. ⛔ `farg` är en
  palettplats och aldrig hex, för en hex i konfigurationen följer inte med när
  temat byter. ⛔ Två kategorier med samma `id` är ett eget fel: de ser ut som
  EN i varje vy.
- **Två språk** ([#109](https://github.com/cllp/ops-framework/issues/109)). Ett
  namn är `{ sv, en }`. `text()` tar emot en sträng också, samma
  migreringsordning som `skapadAv` fick i Fas 1: läsaren måste tåla båda
  formerna innan skrivarna byter. ⛔ Toleransen är inte tyst: `saknadeSprak`
  räknar upp varje namn som saknar `en`, som sökvägar och inte som en siffra,
  och en sträng räknas som saknad.
- **Katalogkällan** ([#110](https://github.com/cllp/ops-framework/issues/110)).
  `createCatalogSource` ovanpå datakontraktet. ⛔ Seedar aldrig ovanpå
  befintliga värden, annars kommer en arkiverad kategori tillbaka vid nästa
  driftsättning. ⛔ `las()` kastar aldrig och skiljer `databas` från `reserv`, så
  ett läsfel kan visas i stället för att se ut som en tom katalog. ⛔ Samlingens
  namn kommer utifrån: ramverket känner aldrig projekt-id eller samlingsnamn.
- **Inställningsvyn** ([#112](https://github.com/cllp/ops-framework/issues/112)).
  `OpsKatalogInstallning` lägger till, döper om och arkiverar. ⛔ Raderar aldrig:
  en raderad kategori lämnar varje rad som pekar på den utan kategori. ⛔ Ägaren
  ändrar, medlemmen läser, och vyn säger själv att den inte är låset.
- **Ändringsloggen för konfig** ([#113](https://github.com/cllp/ops-framework/issues/113)).
  `createConfigLog`. ⛔ `fore` krävs för allt utom en nytillagd: en rad utan det
  svarar inte på vad som stod förut, och då är loggen en notis och inte ett
  spår. ⛔ `skriv` kastar aldrig, och `orsak` skiljer ett trasigt utkast från en
  trasig skrivning.

- **Gränsen för det dynamiska, väg A** ([#111](https://github.com/cllp/ops-framework/issues/111),
  beslut CP 2026-09-26). Katalogen bär data, koden bär beteende, och
  `kopplaBeteenden` vaktar kopplingen åt BÅDA håll vid uppstart. ⛔ En kategori
  utan hanterare ritas, går att välja och gör sedan ingenting: exakt felet i
  cllp/bolag-ops#144, där sorten `bugg` aldrig blev ett ärende och ingenting
  blev rött. ⛔ En hanterare utan kategori är död kod som ser levande ut.
  ⛔ Arkiverade kategorier kräver också en hanterare, eftersom gamla rader ska
  ritas och räknas som förut. Vad som går att ändra utan en release står som en
  tabell i README: det är produktlöftet, och oskrivet blir det ett antagande.

### Noteringar

- Allt ovan ligger i **båda ingångarna**, huvudingången och nodsidan, av samma
  skäl som `createActivityLog`: konfigurationen läses också av det som körs utan
  skärm, och nodsidan tar 8 ms mot huvudingångens 1946 ms.
- Ingen konsument läser katalogen ännu. Utgivningen finns för att appens halva
  ska kunna pinna mot en tagg där allt är grönt.

---

## 0.18.0

Fas 1 i epiken [#92](https://github.com/cllp/ops-framework/issues/92), ramverkets
del: identiteten får en form.

### Tillagt

- **`skapadAv` blir `{ uid, namn, typ, kalla }`** ([#106](https://github.com/cllp/ops-framework/issues/106)).
  Fältet bar en fri sträng, och tre sorters värde hamnade i det: en e-postadress
  från klienten, `"ops-agent"` från agenten, och en påhittad adress från
  mätbygget.

  ⛔ En adress går inte att kontrollera i en Firestore-regel. Regeln har bara
  `request.auth.uid` att jämföra med, så länge fältet är en sträng är det ett
  **påstående** och inte ett bevis.

- `byggSkapare`, `laesSkapare`, `skaparensNamn`, `arGammalForm` och
  `SKAPARTYPER`, ur **båda** ingångarna: klienten och nodsidan skriver samma
  fält.

  ⛔ `laesSkapare` tål den gamla strängen, och det är inte snällhet.
  Migreringsordningen är tvingande: läsaren måste tåla båda formerna **innan**
  skrivaren byter, annars visar varje vy tomt för varje omigrerat dokument i
  samma sekund.

- `createCaseModel().buildEntry` tar `skapare`. `email` fungerar kvar, av samma
  skäl: en konsument som inte bytt ska inte gå sönder av en uppgradering.

---

## 0.17.1

Släpps för **räknemärkesfixen** (CP 2026-09-25): `v0.17.0` saknar den, så en app
som pinnar den versionen backar märket på live-sidan.

### Ändrat

- **Räknemärket ser ut som inkorgens gamla** (CP 18:10, #97): `h-4 min-w-4
  px-0.5`, `text-[8px] font-bold`, hörnet `-top-0.5 -right-0.5`, ingen ring,
  på alla placeringar. Versionen nedan (`text-xs`, ring, flyttad placering) var
  fel förlaga.
- **Ett räknemärke, `OpsCountBadge`**, för inkorgen, klockan, toppradens flikar
  och panelens rader ([#97](https://github.com/cllp/ops-framework/issues/97)).
  16 px högt, `text-xs` med `tabular-nums`, `badge`/`badge-contrast` i båda
  teman, kapas vid "99+" (tidigare "9+" på inkorgen och flikarna).
- **"Ny" har en ton**, `STATUS_TONES.ny` (info), i Aktivitet och i appens lista
  (bolag-ops #363). Aktivitetens eget röda chip är borta.
- **Panelen på telefon** får en dämpning bakom sig (`--z-scrim`, under kromet),
  egen staplingskontext och `shadow-lg`.
- `check-kontrast` mäter genomskinliga ytor sammansatta över sin bas och vaktar
  "Ny" och märket mot headern.

### Tillagt

Följdrättningen till [#93](https://github.com/cllp/ops-framework/issues/93) åker
med: utan den kostar det ärendet ville uppnå nästan två sekunder per kallstart.

- `createActivityLog` återexporteras ur `@staiger/ops-framework/node`. Den låg
  bara i huvudingången, så ett Cloud Function som ville skriva en rad i loggen
  tvingades importera hela webbuntlen. Mätt, Node 20, ur den utgivna tarbollen:

  | import | tid |
  |---|---|
  | `@staiger/ops-framework/node` | **8 ms** |
  | `@staiger/ops-framework` | **1946 ms** |

- `check-node-side` kräver att nodsidan inte når React eller en komponent,
  varken direkt eller genom en mellanfil.

### Rättat

- ⛔ **`check-node-side` såg inte sidoeffektimporter.** Mönstret matchade
  `from "x"` och `import("x")` men inte `import "x";`, alltså den form man
  skriver när man vill åt en bieffekt. Mätt: en planterad `import "react";` i
  `src/node/index.js` lämnade vakten grön. Gäller båda halvorna av vakten, så
  en webbfil hade kunnat sidoeffektimportera nodsidan utan att bygget föll.
- Filhuvudena sade `@staiger/ops-framework/nod`. Ingången heter `/node`.

---

## 0.17.0

Fas 0 i epiken [#92](https://github.com/cllp/ops-framework/issues/92). Första
taggade versionen: fram till nu har konsumentapparna pinnat en SHA.

### Tillagt

- **Paketet ges ut som en packad tarboll på en GitHub-release** vid varje tagg
  `vX.Y.Z` ([#93](https://github.com/cllp/ops-framework/issues/93)). Färdigbyggd,
  så ingen `prepare` behövs hos den som installerar, och publik HTTPS, så ingen
  inloggning behövs. Det är det som gör att `bolag-ops/functions` kan sluta bära
  en kopia av aktivitetsloggen.
- `OpsCalendar` och `OpsDatePicker` tar `locale`
  ([#95](https://github.com/cllp/ops-framework/issues/95)). Månads- och
  veckodagsnamn kommer ur `Intl` i stället för ur handskrivna listor.
- `monthNames(locale)`, `weekdayNames(locale)` och `DEFAULT_LOCALE` i
  `src/lib/calendar.js`. `dateText` tar locale som andra argument.
- `createCaseModel` ger `STATUS` ([#94](https://github.com/cllp/ops-framework/issues/94)).
- Tre vakter: `check-statusord`, `check-datumnamn`, `check-paket`.

### Ändrat

- **Taxonomin heter Status, inte Läge** ([#94](https://github.com/cllp/ops-framework/issues/94)).
  Värdena `ny`, `hanterad` och `avskriven` är orörda: de står i Firestore.
- Veckodagen i kalendern skrivs `Tors` i stället för `Tor`, vilket är den
  korrekta svenska förkortningen och det `Intl` svarar.
- `CLAUDE.md` och README: ramverket äger datamodell och regler för sina **egna**
  samlingar ([#96](https://github.com/cllp/ops-framework/issues/96)).

### Utfasat

- `createCaseModel().STATES` heter `STATUS`. Aliaset är samma frysta objekt och
  står kvar tills bolag-ops pekar på en tagg som bytt.

### Borttaget

- `MONTH_NAMES` ur `src/lib/calendar.js`. Den var intern, aldrig exporterad ur
  `src/index.js`, och hade inga användare kvar efter #95.

---

## 0.16.2

Sista versionen före taggarna. Historiken före den här punkten står i
commit-loggen och i ärendena, inte här.
