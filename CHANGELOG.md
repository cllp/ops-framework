# Ändringslogg

Formatet följer [Keep a Changelog](https://keepachangelog.com/sv/1.1.0/), och
versionerna är [semver](https://semver.org/lang/sv/).

⛔ **Varje tagg `vX.Y.Z` ska ha ett avsnitt här.** `check-paket` kräver att
versionen i `package.json` står i den här filen, eftersom en utgivning utan
anteckningar är en version ingen kan välja att hoppa över.

---

## 0.32.1

⛔ **Idag och Kalender når bottenraden igen, också när Safaris verktygsfält fälls in och när något ovanför ytan försvinner. Händelsekortet och inkorgsraden som SS. Inte breaking.**
CP 2026-09-30, två skärmbilder från telefonen: *"Kalender och idag går inte ända ner utan huggs av i botten."* Innehållet slutade långt ovanför
bottenraden. Ett kort i Idag klipptes rakt av, och veckoraden i Kalender klipptes horisontellt.

### Rotorsaken
`useFullHeight` (`src/lib/fullHeight.js`), som både `OpsScrollArea` och `OpsCalendar` använder, räknade höjden som
`calc(100svh - var(--fullhojd-topp) - var(--bottom-nav-h) - var(--safe-bottom) - 1.5rem)`. Två antaganden i samma uttryck:
- **`svh` är den minsta vyhöjden, men bottenraden är `fixed bottom-0` och följer den verkliga kanten.** När Safaris verktygsfält fälls in växer den
  synliga ytan och raden flyttar ner, medan `100svh` står still. I hemskärmsläget kan `svh` dessutom skilja sig från den synliga höjden med de säkra zonerna.
- **Toppen mättes bara vid mount och vid `resize`.** Försvann en rad ovanför ytan (en banner, ett filter) låg talet kvar för högt och ytan slutade lika mycket för tidigt.

### Fixen
- Ingen viewport-enhet i höjden. Hooken mäter båda kanterna och lägger dem i `--fullhojd-topp` (ytans avstånd till dokumentets topp, som förut) och
  `--fullhojd-botten` (bottenradens övre kant om raden syns, annars fönstrets höjd minus den säkra ytan). Klassen är nu
  `h-[calc(var(--fullhojd-botten)_-_var(--fullhojd-topp)_-_1.5rem)]` plus `min-h-60` som golv. `md:`-varianten behövs inte längre: på en dator är
  bottenraden `md:hidden` och räknas som frånvarande, så botten blir fönstret minus den säkra ytan, samma sak som `md:`-raden räknade.
- Ommätning vid `resize`, `orientationchange`, `visualViewport` `resize` och `scroll`, och med en `ResizeObserver` på föräldern, `offsetParent`, `main`,
  dokumentets kropp och syskonen ovanför ytan. En mätning per bildruta (`requestAnimationFrame`), lyssnarna rensas vid unmount.
- `OpsBottomNav` bär `data-ops-bottenrad`, som hooken letar efter.
- SSR och jsdom: startvärdet är `innerHeight` (eller 800 utan fönster), och utan `ResizeObserver` eller `requestAnimationFrame` mäts det direkt.
- `FULL_HEIGHT_CLASSES` och `useFullHeight` har samma namn och signatur. Ingen av dem exporteras ur paketets `index.js`, så inget i appen berörs.

### Vakten
`check-skalyta` avsnitt 24 mäter `navTop - ytaBottom` för en Idag-lik `OpsScrollArea` och `OpsCalendar` vid 390x844, med `--safe-top: 47px` och
`--safe-bottom: 34px` satta före mount, i tre lägen: (a) verktygsfältet fälls in efter mount (fönstret 844 till 928, med `svh` modellerad som Safari:
fast vid höjden vid mount, eftersom Chromiums egen `100svh` följer med och alltså aldrig kan visa felet; skillnaden 84 px mäts), (b) hemskärmsläget
(`100svh` blir `calc(100dvh - 81px)`), (c) en rad på 170 px ovanför ytan tas bort efter mount. Krav 23 +- 2 px, golv 2 vyer och 3 lägen.
- **Rött mot 0.32.0 (`--dist` och `--tokens` ur origin/main):** 6 brott av 901. Idag och Kalender: (a) 107 px, (b) 104 px, (c) 209 px.
- **Grönt med fixen:** 901 kontroller, inga brott. Alla sex lägen 24 px.
- Avsnitt 21 och 21b var gröna genom hela felet: i en skrivbords-Chromium är `100svh` alltid fönstrets höjd, fönstret ändrades aldrig efter mount och
  ingenting ovanför ytan försvann, så uttrycket mättes bara i det enda läge där det råkar stämma. Skälet står nu i koden vid avsnitt 24.
- Enhetsprov (`scrollArea.test.jsx`): tre nya prov (bottenradens kant, ingen synlig rad, ommätning när något ovanför ändrar storlek) är röda mot 0.32.0:s hook och gröna nu.
- Före och efter vid 390: `docs/jamforelser/0.32.1/fullyta-c-fore-efter-390.png` och `fullyta-a-fore-efter-390.png`. Felet citerar ingen SessionStudio-bild, så det finns ingen förebild att ställa bredvid.

### Händelsekortet och inkorgsraden som SS
CP 2026-09-30 08:04: *"Kolla storleken och fint på texten i händelserna. Matchar inte det vi har i SessionStudio. Dubbelkolla även inkorgen."*
Titeln var redan 18/700 som SS. Felet låg i kompositionen:
- **Chevronen tar ingen kolumn längre.** Den låg i en egen kolumn på 44 px, så titeln fick 251 px mot kortets 299 och en rad extra. Nu är knappen
  absolut i kortets övre högra hörn (samma 44 px träffyta), och bara kortets första rad ger plats åt den. Titeln har hela innerbredden.
- **Datumraden står vänsterställd direkt ovanför titeln,** som SS (`TodayView.jsx:527`), 12 px (14 från `sm`) och dämpad. Förut var den en `ml-auto`-grupp i
  pillraden som blev högerställd på en egen rad vid 390 px.
- **Radien är 24 px som SS** (`--radius-card`, SS `index.css:228`): CP 2026-09-30 valde det. `OpsEventList` använder kortets förval i stället för `bubbla`
  (28 px). `bubbla` finns kvar i `OpsCard` och används fortfarande av `OpsInloggning`.
- **`OpsDisclosure`:** summary-behållaren har `text-etikett`, så innehåll utan egen klass är 14 px (SS `text-sm`) i stället för bodyns 16.
- **`OpsPill size="liten"`** (ny, valfri): rollen `liten` (10/500) med `px-1.5 py-0.5`, för typbadgar (SS `ChatInboxPanel.jsx:743`, 9/500). Standard är oförändrad.
- **`OpsRollmarke`** (ny, exporterad): rollpillret ("Du", "Förfaller", "Agent") med samma mått som "Försenat" (12/600, `px-2 py-0.5`), ur en konstant som
  `OpsEventList` också använder för brådskemärket.
- **Vakt:** `check-skalyta` avsnitt 25 vid 390 px, två kort: titeln minst 95 procent av innerbredden, datumradens vänsterkant lika med titelns (+-1), radien
  24 +- 0,5, rollmärket lika stort som "Försenat", summary utan klass 14 px, liten `OpsPill` 10 px. **Rött mot 0.32.0: 9 brott** (titeln 251 av 299 i båda
  korten, datumraden vid 101,5 och 152,9 mot titelns 40, radien 28 i båda, rollmärket saknas, summary 16 px, pillret 12/600). **Grönt nu.**
- Montage och en ärlig jämförelse (vad som matchar, vad som skiljer: kortets luft 24 mot 20, den färgade vänsterkanten, pillraden som SS saknar):
  `docs/jamforelser/0.32.1/idag-kort-fore-efter-ss-390.png` och `jamforelse.md`.

### Att göra i appen vid ompinning till 0.32.1
Pinna om. ⛔ Byt sedan appens tre handskrivna rollpiller (`Rolletikett` i `EventsView.jsx`, `Rolltegner` i `ProcessView.jsx` och
`ScheduleView.jsx`) mot `<OpsRollmarke kind={role} label={roleLabel(role)} />`, och inkorgens typbadge mot `<OpsPill size="liten">`. Inget av det
krävs för att bygga. ⛔ Har appen en egen bottenrad i stället för `OpsBottomNav` hittar hooken den inte, och då slutar ytan vid fönstret minus
den säkra ytan i stället för vid raden. Sätt i så fall `data-ops-bottenrad` på appens `<nav>`.

## 0.32.0

⛔ **Skapa grupp och bjud in, som i SessionStudio. Delvis breaking för appens skapa-grupp-callable och admin-adapter, se "Att göra i appen".**
CP 2026-09-29 23:30: *"Skapa grupp och bjuda in till grupp finns inte ännu. Skapa grupp i web skall ha samma funktion som i SessionStudio. Gruppkortet skall ha lite mer info i sig som i SessionStudio."*
Epiken är cllp/ops-framework#180. **Det här passet är G0 (modell och regler), G1 (skapa grupp) och G2 (gruppkortet, detaljsidan och redigering).** Inbjudans kod och utskick (G3) är INTE gjorda.

### Rättelse: textfälten är 16 px och vikt 400 på telefon
- `faltKlass` skrev `text-rubrik md:text-brod` i 0.31.2. Rollen `rubrik` bär vikt 700, så varje textfält under 768 px skrev fet text (CP 19:50: "Stor text"). Nu `text-brod` på alla bredder, som SS fält.
- Vakten: `check-skalyta` mäter varje textfält i Ny grupp vid 390 och 1280 px. Rött mot bygget utan fixen (`16px/700` i fyra fält), grönt med den (882 kontroller).

### G0. Modell och regler
- **Gruppen bär utseende och uppgifter:** `farg` (ett id ur `PROFILFARGER`, samma sex identitetstoner som profilen: ingen ny färgskala), `ikon` (`GRUPPIKONER`, tio generiska id, eller
  `initialer:AB`), `bild` (lagringssökväg), `beskrivning` (högst 280), `ort` (högst 80) och `epostsprak` (`sv` eller `en`). Tomma strängar och inte utelämnade fält, så en rad från före
  0.32.0 läses utan migrering. `byggGrupp` validerar och avvisar fortfarande okända fält.
- **Rollerna är `agare`, `admin`, `medlem`.** Regelfragmentet får `opsArAdmin(gid)` (ägare eller admin). **Admin** ändrar utseende och uppgifter (`ADMINGRUPPFALT`), **ägare** även `moduler` och
  `arkiverad` (`AGARGRUPPFALT`), `id` och `skapadAv` ändrar ingen, och ingen raderar. `hasOnly`-listorna är härledda ur samma två listor som modellen (`GRUPPFALT` också), inte handskrivna kopior.
- **`memberships`:** en aktiv medlem läser gruppens övriga medlemskap (medlemslistan), aldrig en annan grupps. Klienten skriver fortfarande inget.
- **`invitations`:** `tokenHash` (SHA-256 i hex, koden lagras aldrig), `giltigTill` (ISO, 30 dagar), `skickad` (ISO eller tom), `antalSkickade`. ⛔ **Klienten skapar aldrig en inbjudan**
  (`create: if false`): raden bär kodens hash och slutdatum, och med rollen admin hade en klientskriven inbjudan kunnat bära rollen `agare` och göra vem som helst till ägare via en accept.
  Ägare och admin läser, och en klient får bara ändra `status` (återkalla). `bjudIn` får bjudas av ägare eller admin, men bara en ägare bjuder in till rollen `agare`.
- **Rött utan ändringen (regelprov mot emulatorn):** 8 av 71 prov röda mot 0.31.2:s regler (admin ändrar utseendet, ingen ändrar `skapadAv`, en medlem läser en medkamrat, ingen klient skapar en inbjudan,
  ägaren läser/återkallar via admin, `tokenHash` och `giltigTill` går inte att skriva), **71 av 71 gröna nu.** De prov som skyddar mot för mycket (admin raderar inte, en medlem ändrar inte, en medlem läser inte en annan grupps
  medlemskap, klienten skriver inget medlemskap, admin ändrar inte `moduler`) är bevisade med mutationer: en regel i taget försvagad, varje gång rött (radering 4 prov, medlem som ägare 4, medlem som admin 1, medlemskapsläsning 3,
  medlemskapsskrivning 12, admins fältlista 2). Modellprov: 14 av 106 röda mot gamla `grupp.js`.

### G1. Skapa grupp
- **`skapaGrupp({ uid, epost, grupp, inbjudningar })`** (nodsidan) skriver gruppen OCH ägarens medlemskap i EN `kalla.batch`, allt eller inget. Före 0.32.0 var det två anrop, och ett fel mitt emellan lämnade en grupp utan ägare.
  **Spärren "en grupp per person" (#162) är borttagen.** Vitlistan kontrolleras först. Inbjudningar valideras före första skrivningen (en adress som inte är en adress kastar med "Inget har skrivits"), skickas efter commit via `bjudIn`
  (finns kontot blir det ett medlemskap, annars en väntande inbjudan) och är best effort. Svaret är `{ groupId, tillagda, inbjudna, fel }`, alltid alla tre listorna. Ägarens medlemskap bär nu PERSONENS namn och bild ur `users`, inte gruppens namn.
- **Datakontraktet får en frivillig `batch(ops)`** (regel 6 i `contract.js`): allt eller inget, svar i samma ordning. `createMemorySource` har den (återställer hela lagret), `createFirestoreSource` har den när SDK:n har `writeBatch`.
  `createGroupService` KRÄVER den och avvisar en källa utan när tjänsten byggs. Ramverket har ingen egen Admin-adapter (appen skriver den i sina functions), så den måste få `db.batch()`.
- **`OpsGruppFormular`** (ny, exporterad): Visuell identitet (märket som förhandsvisning, sex färgprickar, ikonrutor med "Aa" för initialer, egna initialer 1 till 3 tecken), Gruppnamn (krävs), Beskrivning, Ort, Medlemmar (e-post, roll Admin eller Medlem, listan före spara)
  och Mer inställningar (E-postspråk), i SS ordning. Bilden laddas upp först när gruppen finns, som i SS (`!isNew`). Faller en inbjudan visas adressen och skälet i panelen i stället för att den stängs.
- **Tre ingångar, en panel:** `skapa.grupp` ger raden "Ny grupp" i plusset (efter Ny händelse och Nytt ärende, som SS plusmeny), och gör "Skapa grupp" i gruppanelen (utfälld och infälld) och i växlarens ark till samma panel (`?skapa=grupp`).
  Panelen stängs utan `history.back()` när gruppen skapats, så appens navigering efter `onSkapad` inte ångras av ett sent back (`onKlar` stänger först, sedan `onSkapad`).
- **Märket ritas överallt:** `GruppanelGrupp` tar `farg` och `ikon`, `gruppmarkeProps(grupp)` ger `OpsIdentity` `tone`, `icon` och `initialer` (ny prop).
- **Vakter:** `check-skalyta` avsnitt 22 mäter panelen vid 390 och 1280 px (fältens ordning, ingen dialog, obligatoriskt namn, 14 px och 500 på etiketten, 12 px versaler på raden Visuell identitet, 44 px träffyta, märkets färg mot identitetstonen, Mer inställningar,
  tangentbord 500 px, Spara stänger och ger `onSkapad`, samt gruppanelens och växlarens ingång). **Rött mot 0.31.2:s `dist`: 4 brott** (ingen "Ny grupp"-rad, ingen panel), och mot mutationer av formuläret: färgprickar 36 px i stället för 44 (2 brott),
  märket utan vald färg (2 brott). Komponentprov (`gruppformular.test.jsx`, 31) och tjänsteprov (`grupp-skapa.test.js`, 32): mutationerna panelen stängs efter `onSkapad`, `history.back()` efter skapandet, kvarvarande adress ignoreras,
  gruppanelen inte kopplad och resultatvyns Spara skapar en till är röda var för sig, och skapandet utan `batch` (två anrop) lämnar en grupp utan ägare (röd).
- Före/efter mot SS och en ärlig lista över vad som skiljer: `docs/jamforelser/0.32.0/jamforelse.md`, montage `ny-grupp-390-ramverk-ss.png` och `ny-grupp-1280-ramverk-ss.png` (SS-sidan är renderad ur SS-källan, inte SS-appen).

### G2. Gruppkortet, detaljsidan och redigering
- **Skapa-panelens kolumn har SS bredd per formulär** (`OpsSkapaPanel kolumn`): 672 px för grupp (SS `GroupEditRouteView.jsx:40`, `max-w-2xl`) och 896 px för händelse, ärende och moduler (`EventEditRouteView.jsx:145`, `max-w-4xl`). Före var den 880 för alla. `check-skalyta` mäter bredden mot SS-värdet vid 1280: röd före (880), grön efter.
- **Kortet i `OpsGruppanel`:** (i) (`onInfo(id)`) för alla och penna (`onRedigera(id)`) bara för `roll` agare eller admin, 26 px med ikon 14 som SS; valt kort i gruppens `farg` (kant och ca 6 procents yta, SS `GroupCard.jsx:60-65`); märket i gruppens färg och ikon, också infällt. Medlemsantal och avatarrad (4 plus "+N") fanns redan som data.
- **`medlemsinfo(medlemskap, groupId?)`** härleder antal, avatarer och medlemslista ur en grupps rader i `memberships` (aktiva, ägare före admin före medlem): ingen spegelkolumn, appen listar bara medlemskapen. I båda ingångarna.
- **`OpsGruppSida`** (ny): detaljsidan som SS `GroupDetailView` (märke 56, namn, beskrivning, ort, Redigera för ägare och admin, appens snabbval, medlemslista med Ägare- och Admin-etikett, `children` för appens sektioner).
- **`OpsGruppFormular` i redigeringsläge** (`grupp`, `onSpara`, `bildUrl`, `onLaddaUppBild`, `onTaBortBild`): samma formulär, förifyllt, utan medlemssektion, med bilduppladdning nu när gruppen finns. `skapa.redigeraGrupp` gör pennan till samma panel (`?skapa=redigera-grupp&grupp=<id>`). Oförändrat namn skickas tillbaka orört, så en engelsk översättning inte tappas.
- **Vakt:** `check-skalyta` avsnitt 23 mäter kortets delar (26 px knapp, 12/600 namn, 10 px antal, 4 avatarer om 20, kantfärg och 6 procents yta, märkets ton och ikon) på dator och detaljsidan vid 390 och 1280 (kolumn 768, märke 56, 20/600, 14, 12, tre snabbval, p-3, 12/500, avatar 32, etikett 10 px). **Rött mot förra committen 05278f5: 9 brott** (880 mot 896, 880 mot 672, inga (i) och pennor, kant och yta i accent, ingen `OpsGruppSida`), **grönt nu: 880 kontroller.**
  Komponentprov (`gruppg2.test.jsx`, 29): pennan för alla, vald färg ignorerad, avslutade som medlemmar, Redigera för alla och namnet alltid omskrivet är röda var för sig. Före/efter mot SS: `docs/jamforelser/0.32.0/` (`gruppkort-ramverk-ss.png`, `gruppsida-*-ramverk-ss.png`, `jamforelse.md` med en ärlig lista på vad som skiljer).

### Att göra i appen (ompinningen)
1. **Regeldeployen FÖRE klienten.** Reglerna ändras (admin, medlemmars läsning, `invitations.create` nekas, `groups.update` begränsas till fältlistor): generera om fragmentet, granska diffen och deploya reglerna till produktion INNAN klienthalvan mergas. En regel i main är inte en regel i produktion.
2. **Callablen `skapaGrupp` får ny signatur:** `{ uid, epost, grupp: { namn, farg?, ikon?, beskrivning?, ort?, epostsprak? }, inbjudningar?: [{ epost, roll? }] }` och svarar `{ groupId, tillagda, inbjudna, fel }`. Den gamla `{ namn }` finns inte kvar; `OpsUtanMedlemskap props.onSkapaGrupp` anropar den med `grupp: { namn }`.
3. **Admin-adaptern i functions måste ha `batch(ops)`** (`db.batch()` med `set`/`update`/`delete` och `commit()`), annars kastar `createGroupService` när den byggs.
4. **`skapa.grupp`** i `OpsAppShell` ersätter `grupper.onSkapa`: `grupp: ({ formId, onKlar }) => <OpsGruppFormular formId={formId} onKlar={onKlar} onSkapa={...callable} onSkapad={(id) => navigate(...)} />`, och `skapa.sparaEtikett` ritar den fasta Spara.
5. **G2:** lista `memberships` per grupp (en medlem får läsa dem) och ge kortet `medlemsinfo(rader, gruppId)`: `medlemsantal` och `avatarer` (`{ id, namn, bild }`) på `GruppanelGrupp`, plus `roll`, `farg` och `ikon` ur gruppen. `grupper.onInfo(id)` öppnar appens sida med `OpsGruppSida` (`medlemmar` ur samma `medlemsinfo`, `snabbval` appens egna länkar). Pennan: `skapa.redigeraGrupp: ({ formId, groupId, onKlar }) => <OpsGruppFormular grupp={...} onSpara={...} onLaddaUppBild={...} />`, annars `grupper.onRedigera(id)`. Uppladdningen (sökväg med gruppens id) är appens, och storage-reglerna för gruppbilder likaså.
6. Ingen klient skapar längre en `invitations`-rad direkt: bjud in via `bjudIn`-callablen. Rollen `admin` finns nu i `ROLLER`.

---

## 0.31.2

⛔ **Valmenyernas rader är SS rader, och appens stilrot får inte omforma skalet. Inte breaking.**
CP 2026-09-29 19:50, med en skärmbild av filtrets "Slag"-dropdown (rader "Alla slag", "Fakta", "Påminnelser", "Uppgifter"):
"Typsnitten är inte syncade. Stor text och kanske inte rätt typsnitt? Har ni verkligen gått igenom allt? Kolla olika 'slag'".

### A. Valmenyerna
Mätt i Chromium mot 0.31.1: raderna i filtrets dropdown var **16 px och fetstil (600)** med en **2 px accentkontur** runt den valda raden; SS raden
(`ThemedDropdown.jsx:122`) är 12 px, vanlig vikt, vald = tonad yta och en bock. Typsnittet var rätt (Plus Jakarta Sans), storleken och ramen inte.
Orsaken var att samma rad skrevs i fyra filer (`OpsFilterPanel`, `OpsFilterChip`, `OpsThemeToggle`, `OpsSegmented`) med `text-base`, och två till i
`OpsSelect` och `OpsTimePicker`, medan menyns egen rad (`radKlass`) rättades i 0.30.0. Nu finns raden på ETT ställe: `radKlass` (`vald`), den interna
`ValRad`, `valjAlternativKlass` (formulärlistor, SS `optionSizeForm`: 14 px, bock sist) och `radRubrikKlass`. Sammanlagt 20 ytor genomgångna, 13 ändrade
(tabell med SS fil:rad, före och efter: `docs/jamforelser/0.31.2/menyer.md`). Också ändrat: datumväljarens text (16 till 12 px, SS `ThemedDatePicker`),
Aktivitets Mer-meny (14 till 12 px), grupplistan och "Skapa i" (vald rad = tonad yta och bock, ingen ram), rubriken över raderna står i radernas kolumn.
⛔ Den valda raden syntes inte i ljust tema: `raised` är samma färg som `surface` där, och behållarna var `bg-raised`. Nu `bg-surface` och valt `bg-accent-subtle`.
Raderna har SS höjd på dator (28 px för ThemedDropdown-raderna, 36 för AppHeader-raderna, 40 för statusmenyn som är `text-sm` som SS `TodayView.jsx:294`) och 44 px träffyta under `md`; vald rads text är `text-ink` som SS. Fokus på en menyrad är en yta (`bg-hover`), inte en ram. Vakt: check-skalyta avsnitt 18 öppnar 16 ytor i 1280 och 390 px (30 mätningar, golv 28) med
tangentbordet och mäter radens text, vikt, typsnitt, luft, höjd samt den valda radens kant, kontur, bock och yta. **Rött mot 0.31.1: 84 brott, och mot första 0.31.2-versionen 28 (radhöjden 44 mot SS 28)** (16 px, 600,
konturen 2 px, 32x8 i listorna), **grönt nu: 726 kontroller, inga brott.**

### B. Appens stilrot får inte omforma skalet (`check:tokens`)
bolag-ops hade i `web/src/index.css` (#240) regeln `header.sticky > div.max-w-7xl { max-width: 64rem; }`. Den smalnade toppen till 1024 px medan
grupppanelen låg kvar i `max-w-7xl`, så textmärket stod **120 till 128 px till höger om panelen vid 1280 och 1600 px** (mätt i bolag-ops av CP:s uppdrag,
inte ommätt här). Vakten gick grön, för den läste bara custom properties. `check-token-overrides` (regel 6) tillåter nu bara `@import`, `@source`,
`@font-face`, `@theme` och `:root`/`.dark`/`[data-theme]` med `--*`-rader; allt som stilar ett element eller en klass är rött med väljaren i meddelandet och
uppmaningen att be ramverket. Prov i `check:guards`: rött med exakt regeln ovan, en klassregel och en vanlig deklaration i `:root`; grönt utan dem (121 vaktregler, 30 grönkontroller).

### C. Hub, tillbaka-raden och menyhöjden (CP 2026-09-29 20:57, två bilder av bolag-ops på telefon)
CP: *"Hubbens kort måste få lite distans från headern. Ekonomi fäller inte ut submenyer. Navigeringen tillbaka ser inget bra ut. Gör samma som SessionStudio
och aktivitet. Se till att aktivitetspanelen blir lika hög som menyn så den inte hoppar. Kanske att meny skall vara en standardhöjd."**
**Inte breaking**, men Hub ändrar form: se "Att göra i appen".
- **Hubben äger sin ram.** Korten låg kant i kant under toppraden (0 px avstånd, 0 px marginal) eftersom `OpsHub` var ett bart rutnät och appen inte lindat det i `OpsView`;
  fixturens scen gjorde det åt den och dolde felet. `OpsHub` och `OpsHubModul` ritas nu i `OpsView` (24 px under toppraden och 16 px sidomarginal som Idag, mätt 390/768/1280), `ram={false}` för en app som redan lindat.
- **Ekonomi fälls ut på plats.** Ett kort med barn är en knapp (`aria-expanded`, chevron vrids) som visar "Visa Ekonomi" (modulens egen sida) och barnen som rader; kort utan barn är oförändrat länkar.
- **Tillbaka-raden är SS textlänk** (`OpsTillbaka`, ny fil): "‹ Tillbaka" (chevron 20 px, `gap-2`, 14 px) ett steg upp och rubriken under, inget band, ingen ram, inte `sticky` (`GroupDetailView.jsx:83-95`). Samma komponent i `OpsView tillbaka` och `OpsHubModul`; nya props `rubrik`, `tillbakaEtikett`, `tillbakaTillEtikett`. `OpsHubTillbaka` exporteras som förut.
- **Menyn har en standardhöjd.** Rullgardinen (1280) och arket (390) är lika höga i roten och i Aktivitet (512 / 512 px och 576 / 576 px, före 378,5 / 402,0 och 470,5 / 374,0), innehållet rullar inuti.
Mått: `check-skalyta` avsnitt 19. **Rött mot HEAD 37272d5: 38 brott** (avstånd 0 px mot 24, marginal 0 mot 16, inga utfällbara kort, band med ram och `sticky`, menyhöjd 378,5/402,0 och 470,5/374,0), **grönt nu**. Före/efter: `docs/jamforelser/0.31.2/hub-tillbaka-meny-text.md`.

### D. Textstorleken har EN skala (CP 2026-09-29 21:00, en bild av Idag med ett utfällt kort)
CP: *"Fortfarande jävla diffar i textstorlek på olika håll. Kan det bli enhetligt och läsa från samma klasser."* På bilden hade pillret, hjälptexten, kortets chips, meta, titel,
faktatabellen och bottenraden olika storlekar. Orsaken: komponenterna skrev `text-xs`, `text-sm`, `text-base`, `text-md`, `text-lg` och `text-xl` rakt av (**168 ställen i 61 filer**)
och det som saknade storlek ärvde 16 px från body. Nu finns tio roller i `tokens/sessionstudio-profil.json` med SS fil och rad (nya: `meta` 12 px, `brod` 16 px, `titel` 18 px, `sida` 20 px;
`etikett` fick SS radhöjd 1,25 rem) och **ingen ramverkskomponent skriver en Tailwind-storlek**: kortets titel är `titel`, metaraden och faktarader `etikett`, chips `meta`.
⛔ Ändrat värde: **sidrubrikerna (`text-xl`) går från 24 till 20 px**, som SS `GroupDetailView.jsx:95` (ramverkets `text-xl` var ett eget mellansteg). Kortets titel går från 16 till 18 px (20 från 640 px).
**SS per brytpunkt** (CP: "exakt SS"): kortets metarad är `text-meta sm:text-etikett` (12 px under 640 px, 14 från; SS `text-xs sm:text-sm`, `TodayView.jsx:83/86`) och korttiteln `text-titel sm:text-sida` (18 / 20 px; SS `text-lg sm:text-xl`, `TodayView.jsx:89`). Vakten mäter mot SS-värdet per bredd (390 och 1280); rött mot c896fb3 (4 brott), grönt efter.
`check-typografi` fäller nu `text-xs/sm/base/md/lg/xl` i `src/components` och `src/lib` (rött i `check:guards`, grönt för en roll; en app utan `--ramverksregler` berörs inte).
`check-skalyta` avsnitt 20 mäter varje synligt textelement på fem fixtursidor vid 390 och 1280 (296 i `main`, golv 60): roll finns, storleken ur rollmängden och lika med SS-värdet,
samma storlek på båda bredder, Idag-kortets element mot SS. **Rött mot HEAD: 300 avvikelser (278 textelement), grönt nu: 0.** Tokens `--text-sm/base/xs/md/lg/xl` finns kvar för appar som ännu inte flyttat.

### E. Hemskärmsapp (iOS standalone): headern täcker statusfältet och sidan rullar inte extra (CP 2026-09-29 22:33)
CP, bolag-ops på hemskärmen (`viewport-fit=cover`, `black-translucent`): *"Ser ut att scrollningen blir fel. Den scrollar liksom upp."* Emulerat i Chromium med `--safe-top: 47px` och `--safe-bottom: 34px` (390x844), mätt före: (1) headern var `sticky top-(--safe-top)` utan padding och satt 47 px ned, med en otäckt remsa ovanför där innehållet rullade förbi statusfältet; (2) `OpsView` räknade `--safe-bottom` en andra gång (`main` räknar den redan) och `OpsScrollArea` drog inte bort `OpsView`s `pb-6`, så en sida med listan i `OpsScrollArea` (Idag) blev 902 px hög i ett fönster på 844: dokumentet rullade 58 px OVANPÅ listans egen rullning, och en tom remsa stod mellan listan och bottenraden.
Nu: headern är `top-0 pt-(--safe-top)` (börjar vid y = 0, 104 px hög med zonerna), `OpsView` räknar säker yta i botten bara från `md`, och `FULL_HEIGHT_CLASSES` drar bort 1,5 rem: sidan är exakt fönstrets höjd (844 mot 844, scrollY 0), sista kortet ligger 23 px ovanför bottenraden. `check-skalyta` avsnitt 21: **rött mot c896fb3 (6 brott), grönt nu.** Ingen ändring krävs i appen (bolag-ops behöver inte lägga egen padding).

### Att göra i appen vid ompinning till 0.31.2
1. **Ta bort regeln `header.sticky > div.max-w-7xl { ... }` ur `web/src/index.css` (#240).** Toppen är då åter lika bred som panelen. Behövs en smalare topp är det
en fråga till ramverket.
2. **Ta bort appens egen ram runt `OpsHub` och `OpsHubModul`** (t.ex. `px-4 py-4`), annars dubbel marginal, eller ge `ram={false}`. Sidor under Hub ger `OpsView` propen `tillbaka` (`OpsHubTillbaka` ritar inte längre ett spår "Hub / Ekonomi").
3. **Egna textstorlekar i appen.** Ramverket skriver inga `text-xs/sm/base/lg/xl` längre, men appens egna gör det fortfarande och ser då annorlunda ut än ramverkets rader. Mätt i bolag-ops `web/src` (inget ändrat där):
   **170 förekomster i 22 filer**: CostsView 29, LivView 18, InboxView 16, InsuranceView 13, IncomeView 12, ScheduleView 10, PensionView 8, SubscriptionsView 7, ProcessView 7, ComparisonView 7,
   OverviewView 6, HelpView 6, AssetsView 6, PrimitivesView 4, EventsView 4, NewCaseModal 3, EconomyView 3, ContactsView 3, BusinessView 3, SearchView 2, `overview-view.test.jsx` 2, AskView 1, samt ett `text-[..]`.
   Byt dem mot rollerna (`text-etikett` 14, `text-meta` 12, `text-brod` 16, `text-titel` 18, `text-sida` 20, `text-rubrik`, `text-hjalp`, `text-liten`). Text utan storlek ärver 16 px: ge den en roll.

## 0.31.1

⛔ **Inloggningen tar appens bildlogga, mobilhuvudet har ingen text och gruppväxlaren tar loggans plats. Inte breaking: allt är nya valfria props.**
CP 2026-09-29 18:40: "INloggningen den nya loggan. Header i mobil skall vi ta bort texten helt. VI behöver en bra Grupp-väljare-ikon i mobil
istället för logga. I Web skall vi ha texten som jag angav 0.31.0."

### A. Inloggningen tar en bildlogga från appen
`OpsAuthGate` och `OpsInloggning` tar `ordmarke={{ ljus, mork }}` (två URL:er) och `ordmarkeHojd` (Tailwind-höjdklass, förval `h-56`).
Med `ordmarke` ritas bilden i stället för textmärket, `ljus` i ljust tema och `mork` i mörkt via temat (`data-theme` och systemet, samma
tre tillstånd som tokens: klasserna `.ops-ordmarke-*` i `tokens.css`), alt-text är appens namn (`etikett`) i BÅDA temana. Utan `ordmarke`
ritas textmärket från 0.31.0 som förut. **Headern (webb) påverkas inte, textmärket står kvar där.** Höjd och inte bredd, eftersom appens
mästerbilder är fyrkantiga (3750 px) med mycket luft: bilden beskärs med `-my-10`. Den ljusa bilden ritas med `mix-blend-multiply`
så att dess vita botten blir sidans papper. ⛔ `ordmarkeHojd` kom tillbaka på `OpsInloggning`, inte på `OpsBrand` (där den togs bort i 0.31.0).
⛔ Klassen måste finnas i appens Tailwind-skanning för att den ska få effekt; förvalet `h-56` finns i ramverket och behöver inget.
Mätt (check-skalyta, Chromium): 224 px hög, 27 procent av vyn vid 390 px och 28 procent vid 1280 px (gräns 40), centrerad inom 1 px, en bild
synlig per tema. Vakten hittade en riktig miss under bygget: den mörka bilden hade först `aria-hidden` och `alt=""`, så loggan hade
inget namn i mörkt tema.

### B. Mobilhuvudet utan text, gruppväxlaren som ikonknapp
Under `md` ritas märket inte alls när `grupper` finns (ordmärke, monogram och undertext). Längst till vänster står i stället gruppväxlaren
som en ikonknapp med 44x44 träffyta: den aktiva gruppens märke i samma 40 px ruta som remsan (`gruppRutaKlass`, `OpsIdentity rail`), och
i läget "Alla mina grupper" samma `PersonIkon` som panelens och remsans rad. Ingen text bredvid. `aria-label` är "Byt grupp, nu: <namn>"
(`grupper.nuEtikett` byter ordet "nu"). Från `md` är växlaren märke + namn som förut, och webbhuvudet är oförändrat. Utan `grupper` finns
ingen växlare att ersätta märket med, och monogrammet står kvar under `md`. Startsidan nås ur bottenraden.
⛔ SS har ingen gruppväxlare i mobilhuvudet (`AppHeader.jsx:173`: en 40 px loggeikon, `AppHeaderMobileToolbar.jsx`: tema, sök, plus,
avatar). Det här är CP:s beslut och inte SS-paritet, och montaget visar det ärligt.
Vakt: check-skalyta avsnitt 7 kräver nu inget märke och ingen "OPS HUB"-text i mobilhuvudet, gruppväxlaren först, 44x44 och gruppmärket
40x40. Rött mot 0.31.0 (märket ritades, växlaren 32x44, inget gruppmärke), grönt med ändringen.

### C. `skapa.arende` tar formulärets id
`skapa.arende` får vara en funktion `({ formId, mal }) => nod`, så appen sätter `id={formId}` på sitt `<form>` och kan använda panelens
gemensamma Spara (`skapa.sparaEtikett`). Funktionen ritas som en egen komponent, så hooks fungerar i den. En färdig nod fungerar som förut.
⛔ **Ändrat beteende, en död knapp borta:** för en färdig nod (`arende` eller `handelse` som nod) kan formuläret inte få `formId`, och
panelens Spara pekade då på ett id ingen känner. Den ritas nu inte för noder. Modulformulär och `HandelseSkapare` får `formId` som förut.

### Att göra i appen vid ompinning till 0.31.1
Inloggning: `<OpsAuthGate ordmarke={{ ljus: "/brand/ops-hub-wordmark-light-640.png", mork: "/brand/ops-hub-wordmark-dark-640.png" }} etikett="Bolag Ops">`
(640-varianterna räcker, 224 px högt). Ärende: byt `skapa.arende={<Formular />}` mot `skapa.arende={({ formId }) => <Formular formId={formId} />}`
och ta bort formulärets egen Spara till förmån för `sparaEtikett`. Inget annat krävs. ⛔ Appens PNG:er har opak bakgrund: den mörka
(`#202420`) är 8 nivåer ljusare än mörkt tema (`#181c18`) och syns som en svag ruta. Genomskinliga varianter, eller `#181c18` som botten, tar bort den.

## 0.31.0

⛔ **Märket är text, inte bilder. BREAKING: appar måste pinna om.** CP 2026-09-29:
"Viktigt. Logotyp. Vi gör såhär. Vi tar bort bilder, kör med text. Font: Glacial
Indifference Regular. Colors: Light Gray och Gray Orange. Ha detta både på
inloggning och inne i appen. Följ detta exakt." Och därefter, "kör allt, och bort
med loggorna".

### Märket (avsnitt 1 till 6 och 15)

**Bort, helt:** `varumarke/*.webp` (fyra bilder), `scripts/generate-varumarke.mjs`,
`src/lib/varumarke.js` med `OPS_HUB_VARUMARKE`, bildläget i `OpsBrand`
(`ordmarke`, `ikon`, `ordmarkeHojd`, `endastOrdmarke`, `title`, `subtitle`, `mark`),
PH.ST-märkets fyra bilder i `assets/` och tokens `--logo-phst*`, samt vakterna
och proven som stod över dem (test-guards "varumarke", `varumarke.test.js`,
PH.ST-kontrollen i `check-scaffold`). Ingen död fil kvar: `grep` efter `varumarke`,
`OPS_HUB_VARUMARKE` och `phst` ger noll träffar utanför den här texten.

**Nytt:** `OpsBrand` är två textrader och ett monogram.

| Prop | Betyder |
|---|---|
| `namn` | Rad 1. Förval `"OPS HUB"`. Första ordet ljusgrått (`ink`), resten gråorange (`marke-accent`). Eller `{ forsta, andra }`. |
| `undertext` | Rad 2, appens eller gruppens namn. Tom: bara rad 1, centrerad lodrätt. |
| `monogram` | Tecknen i rutan. Förval: första bokstaven i varje ord, "OH". |
| `storlek` | `"topp"` (förval) eller `"stor"` (inloggningen). |
| `panelInfalld` | Sätts av skalet. |

I `OpsAppShell` är `brand` (sträng) märkets `namn`, och **rad 2 är den aktiva
gruppens namn i versaler** när `grupper` finns och en grupp är vald (i läget
"Alla mina grupper" används appens `undertext`, annars ritas bara rad 1).
`OpsInloggning` får `namn` (nytt) och `etikett` (blir rad 2); `mark` och
`ordmarke` är borta.

**Typsnittet:** Glacial Indifference Regular (SIL OFL 1.1) ligger i
`fonts/glacial-indifference/` med `LICENSE.txt` bredvid, `@font-face` med
`font-display: swap` i `tokens/tokens.css`, token `--font-marke`. Bara märket
använder det. `check-fonts` godtar nu ett självvärdat typsnitt med licensfil och
fäller ett utan (fil som saknas, licens som saknas, ingen `@font-face` alls), och
`check-scaffold` mäter att filen faktiskt följer med genom ett konsumentbygge.

**Mätt i CP:s bild, inte gissat.** `cp-utfalld.webp` är 2000 px bred; panelens kort
är 411 bildpixlar och 180 CSS-pixlar, alltså skala 2,283. Bokstävernas startlägen
och versalhöjder är avlästa pixel för pixel mot bakgrunden #202521 och anpassade med
minsta kvadrat mot typsnittets egna breddtabell (typsnittets versalhöjd är 0,67 em):

| | Rad 1 "OPS HUB" | Rad 2 undertexten |
|---|---|---|
| Versalhöjd i bilden | 21 px (O med översvängning) | 15 px |
| Typsnittsstorlek | **13 px** (`--marke-storlek`) | **9,5 px** (`--marke-undertext`) |
| Spärrning | **0,23 em** = 2,99 px (`--marke-sparrning`), 0,34 av versalhöjden | **0,26 em** (`--marke-undertext-sparrning`), 0,39 av versalhöjden |
| Bredd i bilden / här | 157 / 156 bildpixlar | 360 / 362 bildpixlar |
| Baslinjeavstånd | 31 bildpixlar = 13,6 CSS-px (`--marke-radavstand` 3,5 px) | |

Monogrammet "OH": 14 px, spärrning 0,04 em. Inloggningen: rad 1 32 px, rad 2 12
px (23 px hade blivit bredare än kortet). Toppradens rutor ryms i 56 px: ordmärket
är 40 px högt.

**Färger, mätta:** ljusgrått är bokstävernas toppvärde (230, 235, 231) och
ramverkets mörka `ink` är (232, 236, 230): skillnad 2, 1, 1, alltså under gränsen 4,
och därför ingen ny färg, märket använder `ink`. Gråorange är H:ets toppvärde
(169, 146, 94) = **#a9925e** = `--color-marke-accent` (mörkt), i fixturen
`tokens/sessionstudio-profil.json` under `marke` med `_kalla` mot CP:s bilder.
**Ljust tema:** ljusgrått syns inte på ljus yta, så `ink` (#3C2F2F, 12,5:1) bär "OPS" och
monogrammets O. #a9925e klarar inte 3:1 mot ljus yta (**2,94:1** mot `surface`,
**2,85:1** mot `canvas`), så ljust läge har en mörkare ton av samma kulör (H 41,6, S 30 procent,
ljushet 51,6 till 49,2 procent): **#a38c57**, **3,18:1** mot `surface` och **3,08:1**
mot `canvas`. Mörkt: 5,22:1 mot `surface`. `check-kontrast` har fyra nya rader
(orange mot yta och canvas, båda teman; `ink` mot yta) och är grön.

**Placering och rörelse, som SessionStudio och som CP skärpte den.**

- Ordmärkets två rader står **över kortens bredd** i gruppanelen, inte över panelens
  ytterkant: mittlinjen mäts till 107,99 mot kortens 108,00 vid 1280 px och 260,49
  mot 260,50 vid 1600 (högst 1 px tillåtet, båda raderna). Spärrningen lägger ett
  tomt avstånd efter sista bokstaven, så varje rad bär lika mycket `padding-left`
  som den har spärrning: annars sitter texten en halv spärrning till vänster.
  Panelens sidopadding är nu ett token (`--panel-kant`, 2 px) som både panelen och
  märkesrutan läser. (`check-skalyta` mätte förut mot panelens ytterkant och
  godkände därför 2 px fel; det jämför nu mot innehållet.)
- **Infälld:** monogrammet står i **samma ruta som remsans grupper**: `gruppRutaKlass`
  (ny, `src/lib/radKlass.js`) är EN definition som remsan, chevronknappen och
  monogrammet använder. Mätt med `getComputedStyle`: bredd, höjd, rundning (12 px),
  kantfärg, kantbredd (1 px) och yta är lika med en icke-aktiv grupprutas, och
  mittlinjerna är lika (38,00 mot 38,00 vid 1280).
- Båda formerna är alltid monterade och växlar med en opacity-crossfade på 200 ms.
  Under `md`, eller i en app utan grupper: monogramrutan, vänsterställd på x 16.
- Namnet står en gång som `sr-only`; formerna är `aria-hidden`.

**Prov (alla röda mot origin/main 0.30.1, gröna här):** `check-skalyta` sektion 10
(1280 och 1600 utfälld och infälld, långt gruppnamn, läget Alla, 390 px, inloggning
390 och 1280: typsnittet laddat med `document.fonts.check`, färger beräknade lika med
tokens, inga `<img>`, `scrollWidth <= clientWidth`, höjd <= 56); `src/__tests__/marke.test.jsx`
(props, förval, monogram, undertext från gruppen); `test-guards` typsnitt 4 till 7.

**Appen måste:** pinna om till 0.31.0 och ta bort `title`, `subtitle`, `mark`, `ordmarke`,
`ikon`, `ordmarkeHojd`, `endastOrdmarke` ur varje `OpsBrand`/`OpsInloggning`-anrop;
`brand="Bolag Ops"` blir nu märket "BOLAG OPS", så utelämna `brand` (förval OPS HUB)
eller skicka `<OpsBrand undertext="Bolag Ops" />` för en rad 2 i läget Alla mina grupper.
`OPS_HUB_VARUMARKE` finns inte längre.

---

### Accenten är SessionStudios bruna (avsnitt 7)
CP 2026-09-29: "OPS HUB är grön i mörkt läge. Sessionstudio är brun, vilken färg är det?" Det är tonen **Brun** i
grön-profilen: webben väljer ton med attributet `data-hsl-preset` (`apps/web/src/constants/themes.js:105-109`
`applyHslPreset`, `main.jsx:73-75`, `localStorage sp_hsl_preset`, swatch "Brun" `packages/shared/designTokens.js:249`).
Värdena står i `index.css:690-704` (ljust) och `index.css:767-781` (mörkt). Mobilens `theme.js:100` hue -30 är en annan väg
och ger olivgrönt, alltså inte det CP ser.

| | accent | hover (`accent-light`) |
|---|---|---|
| mörkt | `#9e8a6e` (index.css:768) | `#ae9a7e` (index.css:769) |
| ljust | `#8E7A4E` (index.css:691) | `#9e8a5e` (index.css:692) |

CP:s bild visar ungefär `#a8987a`, det vill säga tonen efter komprimering. Märkets gråorange `#a9925e` ligger nära den mörka
accenten: skillnad 11, 8 och 16 i R, G och B. `accent-subtle` och `-faint` härleds nu ur accentens hex (`rgbaAv` i
generate-tokens) i stället för att vara egna rgba-tal, för de olivgröna literalerna hade blivit kvar. Kontrast mätt av
check-kontrast: mörk primärknapp 4,56:1 (hover 5,58:1). Ljus `accent-contrast` blev `#000000` (5,04:1), eftersom `#1a1a1a` gav
4,18:1 på SessionStudios ljusa brun. En vakt fäller en handskriven genomskinlig ton.

### Chevronen ligger inne i fliken (avsnitt 9)
CP: "Hub ⌄ står längre bort än Idag och Kalender." Länken hade `px-3` på båda sidor och chevronen `pr-2`, så ordet och
chevronen låg 18 px isär och flikens högra luft var 8 px (mätt 900/1280/1600 px, 0.30.1: 18,0 px ord till chevron, luft efter
chevron 20/24 mot en vanlig fliks 12/16). SS `AppHeader.jsx:217-230` är en flik med chevronen `ml-0.5`. Nu ligger luften
vänster på länken och höger på chevronen (`FLIK_LUFT`), 2 px mellan ordet och chevronen. Mätt efter: ord till chevron 6,0 px
(2 px marginal plus ikonens egen), luft före och efter 12 (900) respektive 16 px (1280, 1600) på alla tre flikarna, avstånd
Idag till Kalender och Kalender till Hub lika (28 respektive 36 px). check-skalyta avsnitt 11, rött mot 0.30.1.

### Tillbaka-raden hålls i innehållskolumnen (avsnitt 10, och roten till fynd 1 i #475)
CP: raden "‹ Hub / Ekonomi" ritades över den infällda gruppanelen. Raden hade `-mx-4 px-4`: en negativ marginal som drog
ut den 16 px åt vänster, in över panelens kolumn, och 16 px åt höger utanför kolumnen. Mätt på 0.30.1 (1280 px): raden
200..1265 mot kortens rutnät 216..1249, marginaler -16/-16, och panelen utan z-index. Det är också rotorsaken till den
horisontella överflödningen på modulsidan när appen inte lägger `px-4` runt. Nu: ingen negativ marginal, raden är exakt
rutnätets bredd (216..1249 vid 1280 utfälld, 76..1249 infälld, 368,5..1416,5 och 228,5..1416,5 vid 1600), panelens kolumn
har `--z-sticky-header` (110) över radens `--z-sticky` (100). check-skalyta avsnitt 12, rött mot 0.30.1.

### Menyn har en bredd, och raden utan ikon linjerar (avsnitt 13)
CP: "Aktivitet ... Modalen blir superbred. Skall vara samma som i dropdown så det inte känns hackigt." Rullgardinen var
`min-w-52` och växte med det bredaste som ritades. Mätt på 0.30.1 (1280 px, en undervy med en lång rad): 208 px före och
1256 px efter att Aktivitet öppnats, och ytan flyttade sig från x 1041 till 0. Nu `w-80` med `meny` (SS `AppHeader.jsx:514`),
undervyn i SAMMA ruta med tillbaka-pil: 320,0 px före och efter, samma position och rundning. Utan `meny` är den rena
överflödsmenyn fortfarande innehållsstyrd. Raden "Primitiver" utan ikon får en tom 16 px-plats när någon annan rad i
appens sektion har ikon (i stället för att kräva en ikon): mätt x 972,0 för båda, mot 1058 respektive 1084 på 0.30.1.
check-skalyta avsnitt 13, rött mot 0.30.1.

### Typ, datum och tid går att välja i en modal (avsnitt 11)
CP: "Ny händelse: datum går inte att välja, och det finns ingen tidsväljare", "Går heller inte att välja typ i dropdown".
Två rotorsaker, båda mätta i Chromium på 0.30.1 (390 och 1280 px): (1) listorna ritades på `--z-dropdown` (200) och
modalen på `--z-modal` (400), så typlistans val och kalenderns dag låg BAKOM modalen (`elementFromPoint` gav modalen, inte
valet, och klicket avbröts); (2) `OpsDatePicker` gav react-day-picker en STYRD månad (`month={chosen}`), så månadspilarna
gjorde ingenting så fort ett datum var valt. Rättat: `--z-dropdown` är 450, över modalen och under toasten (450 mot 400), och
`defaultMonth`. Ny `OpsTimePicker` (timme och minut i två listor med kolon emellan, `"HH:MM"`, 24 h) efter SS
`ThemedTimeSelect.jsx`. Trigger och yta delar nu `faltTriggerKlass`/`faltYtaKlass` (radKlass.js) i stället för tre
skrivna strängar. check-skalyta avsnitt 14 väljer typ, datum och tid inuti en `OpsModal` vid 390 och 1280 px (listan
överst och inom vyn, valet når värdet, Escape stänger bara listan, tangentbord), rött mot 0.30.1 (`--dist` och nya
`--tokens` mot origin/main). Vitest `tidval.test.jsx`: rött på 0.30.1 för månadsnavigeringen och lagrens ordning. README:
formulär får inte använda rå `input type=date/time`. **Appen:** `skapa.handelse` får datum- och tidsfält med
`OpsDatePicker` och `OpsTimePicker`, och `skapa.kataloger` måste innehålla `handelsetyper` för att typlistan ska ha val
(ramverket ritar typvalet ur den, `typerAttValja`).

### Skapa är en panel, "Skapa i" som SS, och tätare valkort (avsnitt 16 och 12)
CP: "Skapa nytt i ramverket. Låt det vara paneler istället för modaler precis som i sessionstudio", och om "Nytt ärende" på 390 px:
arket täckte hela huvudet, nästa fält klipptes utan knapprad, valkorten var höga. SS-förlagor: `GroupEditRouteView.jsx:36-47`
(rad "‹ Tillbaka"), `ManageGroupModal.jsx:454,479,640` (rubrikrad, kropp som rullar, knapprad med `border-t`) och
`CalendarCreateDestinationSheet.jsx:53-135` ("Skapa i"). Före 0.31.0 öppnade plusset en `OpsModal`. Nu öppnar det en panel
(`OpsSkapaPanel`): på dator en sida i innehållskolumnen (kolumn 880 px, centrerad, huvudet och gruppanelen kvar, fast knapprad
längst ned till höger med `Avbryt` som textknapp och `Spara` fylld; mätt vid 1280 px: panel 200..1265, knapprad 731..800 av 800), på
telefon helskärm med egen rubrikrad (mätt 390x844: 0,0 mot hela sidbredden, knapprad 775..844, alla fyra valkort och knappraden
samtidigt, valkort 58 px höga; med fönstret krympt till 500 px, som med tangentbord: panelen 500 px, knapprad 431..500, fältet
ovanför den). Ingen `role="dialog"` för formuläret. Appens vy hålls monterad men dold, så Tillbaka återställer den, och
`?skapa=handelse` ligger i adressen (`skapa.adress: false` stänger av). Ny exporterad `OpsSkapaI` (grupper med 34 px märke och
medlemsantal, vald rad med accentkant, appens egen sektion via `skapa.skapaISektioner`, `Avbryt`): med en vald grupp visar
panelen "Skapas i: <grupp> ⌄" som öppnar den, och i läget Alla mina grupper visas den FÖRST. Formuläret får `{ groupId, typ, mal,
formId, onKlar }`; med `skapa.sparaEtikett` ritas `Spara` som `type="submit" form={formId}` (`OpsButton` fick `form`).
`OpsRadioGroup` och `OpsSegmented` är tätare: `px-3 py-2` (var `px-4 py-3`), titel i rollen `etikett`, beskrivning i `hjalp`,
`min-h-11` kvar för tummen. Prov: Vitest `skapapanel.test.jsx` (rött på 0.30.1: 11 av 12 fäller) och check-skalyta avsnitt 15
(rött mot 0.30.1: panelen öppnas aldrig). **Appen (bolag-ops):** ge händelse- och ärendeformulären `id={formId}`, skicka
`skapa.sparaEtikett`, och ta bort formulärets egna Spara och Avbryt om det ska bo i den fasta raden; för "Mina kalendrar"
skicka `skapa.skapaISektioner`.

### Design-QA cllp/bolag-ops#475, ramverkets del (avsnitt 8)
Åtta fynd på live 0.30.1. Ramverkets, och klara: **1** horisontell överflödning på modulsidan (rotorsak: `-mx-4` på tillbaka-raden, mätt
med Hub utan appens `px-4`: scrollWidth 391 mot 390, 769 mot 768, 1281 mot 1280; nu ingen överflödning vid 390, 768 och 1280 för Hub och
modulsida, med och utan padding); **2** gruppmodellen är densamma överallt och nu mätt (panel från lg, annars en växlare med märke, och
från md gruppens namn; 390, 900, 1280 på Hub och modulsida); **3** `OpsHubTillbaka` exporteras och `OpsView` fick `tillbaka`, så varje sida
under Hub kan ha "‹ Hub / Ekonomi / Inkomster" (README: varje sida under Hub bär raden); **4** barnkorten är samma kort som Hubs (ikon,
namn, räknare, info: samma rundning, padding och yta, mätt); **5** Fråga står med namn i mobilmenyn (mätt) och ikonknapparna i huvudet har
`aria-label` och en synlig tooltip (`OpsIconLink` via `OpsTooltip`; på 0.30.1 kom ingen tooltip); **6** sidchrome är dokumenterat som tokens
i README; **7** `OpsAuthGate` ritar ett skelett av huvud och innehåll och efter 8 s en rad med "Försök igen" (`OpsLaddaSkelett`, Vitest
`laddar.test.jsx` med fördröjd auth); **8** info-raden i `ink-secondary` (7,65:1 ljust och 7,72:1 mörkt mot kortet, var `ink-muted` 3,76:1
ljust) och "Inget nytt" i en egen statusstil. Inget ärende stängs. **Appens del** (kvar i bolag-ops): ersätt den kopierade raden i
`UnderHub.jsx` med `OpsView tillbaka` eller `OpsHubTillbaka`, och ge varje modulsida raden.

### Primitiverna mot SessionStudio (avsnitt 14)
Alla 93 exporterade komponenter är genomgångna; tabellen med SS-förlaga (fil:rad), avvikelse och åtgärd står i
`docs/jamforelser/0.31.0/primitiver.md`. Rättat genom gemensamma klasser: fälten (`faltKlass`: 12 px, 1,5 px kant, `bg-surface`, kontur inåt,
hover; var 10 px, 1 px, `bg-canvas`, kontur utåt, skrivet på fem ställen), `OpsModal` (448/672/1024 px och 12 px, var 384/512/768 och 16),
liten knapp (12 px text), kryssruta (18 px), valkort och segmenterad (tätare). Kvar med skäl: pillformen på knappar (CP-beslut
2026-09-28), `OpsSwitch` (kontrast), `OpsCard` 24 px. Vakt: check-skalyta avsnitt 17 mäter ett galleri i ljust och mörkt läge (fjorton
primitiver, golv 14), rött mot 0.30.1 (fält 10 px, liten knapp 14 px). Montage i `docs/jamforelser/0.31.0/`.

### Att göra i appen vid ompinning till 0.31.0
Märket: ta bort `title`, `subtitle`, `mark`, `ikon`, `ordmarkeHojd`, `endastOrdmarke`, `OPS_HUB_VARUMARKE`; utelämna `brand` (eller `namn`/`undertext`).
Skapa: formulär med `id={formId}` och `skapa.sparaEtikett`, ta bort formulärets egna Spara/Avbryt, `skapa.skapaISektioner` för kalendrar,
`skapa.kataloger` med `handelsetyper`, datum/tid med `OpsDatePicker`/`OpsTimePicker`. Hub: ersätt `UnderHub.jsx`s kopierade rad med
`OpsView tillbaka`. `OpsAuthGate` `description` används inte längre. Ramverkets `--z-dropdown` är 450.

## 0.30.1

⛔ **Mobilhuvudet, gruppanelen och loggan, och Hub, som SessionStudio.** CP
2026-09-29 13:44, efter att ha provat 0.30.0 i telefonen och på datorn: "Kolla
UI problem, både i hub med ekonomi (ekonomi skall vara expanderbar). Vidare hur
headern inte får plats med ikoner. Sedan kolla hur gruppväljaren funkar i web.
Jag vill att det funkar exakt som i sessionstudio. Se hur header-logo följer
med." Tre punkter, och alla tre mäts nu i en riktig webbläsare (`check-skalyta`,
avsnitt 7 till 9b): varje mätning var röd på 0.30.0 (16 brott) och är grön här.

### A. Mobilhuvudet flödar aldrig över

**Händelsen:** CP:s skärmbild från telefonen visade märket, temaväljaren,
gruppväxlarens märke och namn ("Claes Philip St..." i klartext), inkorg, sök,
fråga och avataren ovanpå varandra i 390 px. Ramverket lät appen lägga så många
ikoner den ville i `actions`, och en topprad har en bredd.

SessionStudios mobilhuvud är ikonen (`AppHeader.jsx:173`, `w-10`), en flexibel
lucka (`AppHeader.jsx:299`) och en klunga om fyra saker: tema, sök, plus, avatar
(`AppHeaderMobileToolbar.jsx:34-90`, monterad `AppHeader.jsx:301`). Ingen
gruppväxlare med namn, ingen inkorg, inget fråga. Ramverket gör samma sak under `md`:

- **Märket är ikonen under `md`** (`OpsBrand`, med `panelInfalld` givet). Före
  0.30.1 var ordmärket 180 px brett även på en telefon, eftersom panelen är
  "utfälld" i state fast den inte ritas under 1024 px.
- **Gruppväxlaren visar bara märket under `md`.** Namnet står kvar i arket och i
  knappens innehåll, och syns från `md`.
- **De tre första åtgärderna i `actions` stannar, resten flyttar till menyn**
  (`ATGARDER_SMAL`). En `OpsIconLink` utöver de tre göms under `md` och blir en
  rad i bottenradens Meny (först i appens sektion). Bara med `meny`: utan den har
  en flyttad åtgärd inget hem, och en åtgärd som försvinner tyst är värre än en som
  ligger kvar. Siffran bor i skalet och inte i appen, så en åttonde ikon kan inte
  ge ett överlappande huvud igen.
- **Prov:** 390 px, appens verkliga uppsättning (tema, inkorg med räknare, sök,
  fråga, avatar, gruppväxlare med ett långt namn): inga av huvudets kontroller
  överlappar (`boundingBox`), ingen horisontell överflödning, inget utanför skärmen.

### B. Gruppanelen och loggan på dator

**Händelsen:** "Se hur header-logo följer med." Loggan följde inte panelen: märket
stod 4 px in från panelens vänsterkant (`px-1` på länken), och vid 1600 px stod
panelen vid fönstrets kant medan märket stod i den centrerade toppraden, 157 px
isär. Toppradens flikar låg mitt på sidan och rörde sig aldrig när panelen fälldes.

- **Samma behållare som toppraden.** Panelen och innehållet ligger i
  `mx-auto max-w-7xl` när `grupper` finns, som SS `App.jsx:1364`. Märkesrutans
  vänsterkant är panelens, båda lägena, båda bredderna.
- **Märkesrutan är lika bred som panelens innehåll**: 180 px mot panelens 184 minus
  dess `px-0.5`, 40 mot 44. SS gör samma sak (`AppHeader.jsx:173` `md:w-[180px]`,
  `AppSidebar.jsx:43` `md:w-[184px]`), så de fyra pixlarna är panelens padding.
- **Toppraden är en flexrad, inte ett grid** (`AppHeader.jsx:194`, `flex-1
  justify-center`): flikarna ligger mitt i det som är kvar efter loggan och följer
  med när loggan går från 180 till 40 px.
- Knappen överst i panelen (SS `AppSidebar.jsx:51-59`) var redan panelens första
  barn i full bredd. Det är nu ett prov, inte ett antagande.
- **Prov:** märkesrutans vänsterkant och bredd mot panelens, högst 1 px, vid 1280 och
  1600 px, utfälld och infälld; första barnet är knappen i full bredd; flikarna
  flyttar sig minst 20 px när panelen fälls in.

### C. Hub: modulkort och modulsida

**Händelsen:** "ekonomi skall vara expanderbar". Ekonomis sex undersidor stod
uppradade under namnet, och ett kort med sex rader stod bredvid kort med noll:
fyra kort, tre höjder. CP ändrade sedan lösningen samma dag från "kortet fälls ut
på plats" till modulkort med räknare och infolinje och en egen sida per modul med barn.

- **Varje modul är ett kort som är en länk** (`OpsHub`): ikon, namn, `badge`
  (bara när den är större än noll) och en ny `info`-rad. `info` utelämnad ritar
  ingenting; `info: null` skriver "Inget nytt" / "Nothing new" (tomhet är ett
  svar, punkt 5). `info` valideras i `validateNav`: en tom sträng kastar.
- **Ny `OpsHubModul`**: en modul med barn har en egen sida med en fast
  tillbaka-rad ("‹ Hub / Ekonomi", `sticky` under toppraden, 44 px hög) och barnen
  som mindre kort med samma `badge` och `info`. Varje steg har en egen `href`, så
  webbläsarens och telefonens bakåt fungerar.
- **Rullgardinen i toppraden**: Ekonomi är en rad med chevron (`aria-expanded`)
  som fäller ut barnen; de är infällda från början.
- **Kort i en rad är lika höga** (`h-full`), och ingen text flödar ut ur ett kort
  (mätt vid 390 och 1280 px).
- **Rättat vid genomgången:** de infällda korten stod på två höjder (76 mot 354 px)
  före ändringen; nu 98 mot 76 bara mellan kort med och utan `info`, aldrig inom en rad.

### Vad appen behöver ändra

Ingenting för A och B: allt gäller det skalet redan får (`actions`, `grupper`).
Appen kan skicka `info` och `badge` på sina `moduler` och rita `OpsHubModul` på
modulens `href` (se README, "Hub och modulkort"). Ompinning till 0.30.1 krävs för
att få något av detta.

---

## 0.30.0

⛔ **Navigationen, menyn, hover, loggan, typografin och händelsen som
SessionStudio.** CP 2026-09-29, efter att ha använt 0.29.x i telefonen:
sex saker som alla var "lite fel" och som tillsammans gjorde att appen inte
kändes som förebilden. Ärendet är
[#173](https://github.com/cllp/ops-framework/issues/173). Måtten är lästa ur
SessionStudios källa med fil och rad (i koden och i fixturen), och de som beror
på pixlar mäts nu i en riktig webbläsare (`check-skalyta`), eftersom fem av de
sex gick grönt genom hela provsviten: jsdom kör ingen CSS.

### A. Fasta poster och moduler i Hub

**Händelsen:** bolag-ops hade tretton poster i navigeringen (Händelser,
Översikt, Ekonomi med fem barn, och så vidare). De fick inte plats i toppraden,
hamnade under "Meny", och menyn blev en andra navigering bredvid den första.
Ordningen, namnen och ikonerna var appens, alltså olika i varje app. CP: menyn
ska bara ha ramverkets saker, appens moduler ska ligga i Hub.

`OpsAppShell` tar `fasta` (`{ idag, kalender, hub }`, var och en `{ href }`)
och `moduler` (samma form som `nav`). Ramverket äger ordning (Idag, Kalender,
Hub), namn (sv och en) och ikoner. Toppraden visar de tre, Hub som en post med
chevron-dropdown över modulerna; bottenraden på telefon är Idag, Kalender, ETT
STORT PLUS, Hub, Meny (ikon 20 px, etikett 10 px, raden 56 px, som
`MobileTabBar.jsx:73-87`). Plusset öppnar samma lista som plusset i huvudet,
och huvudets plus göms i mobil: ett plus per yta. Ny **`OpsHub`** är sidan Hub
leder till, ett kort per modul (`rounded-card`). `nav` och `fasta` får inte
ges ihop, `moduler` kräver `fasta`, och `primaryAction` får inte ges med `fasta`:
skalet kastar hellre än att gissa. Utan `fasta` är allt som förut.

### B. Menyn: appens länkar i en egen sektion, en avgränsare mellan sektioner

**Händelsen:** mätt i Chromium, 390 px: i mobilens meny låg två streck 5 px
från varandra under arkets rubrik. Arkets rubrik hade `border-b`, första
sektionen `border-t`, och nav-blocket ovanför sitt eget `mt-1 border-t pt-1`:
ingen ägde frågan var en linje går, alla svarade "ovanför mig".

`MenyAvdelningar` äger den nu och ritar EN avgränsare mellan varje par, ingen
före den första; tomma avdelningar filtreras bort FÖRE räkningen. Menyn har två
sorters innehåll: ramverkets (`meny.sektioner`: Aktivitet, Inställningar,
Hjälp, Notiser) och appens egna länkar, `meny.app`, med egen rubrik
(`meny.appRubrik`, förval Appen/App). Menyn innehåller aldrig moduler. Radstil
som `MobileHamburgerMenu.jsx:288/346`, sektionsrubrik i rollen `liten`.

### C. Hover och rundning som SessionStudio

**Händelsen:** CP: hover och rundning "ska vara som SS". Raderna hade
`rounded-sm` och `hover:bg-accent-faint`, ikonknapparna var 44 px rundade rutor
utom plusset som var en 32 px accentfylld cirkel: tre former och tre höjder i
samma rad, och avataren hade ingen ring.

`radKlass`, `radBehallare` och `huvudknappKlass` (`src/lib/radKlass.js`) är EN
definition för fyra ytor som förut ritade raden var för sig. Raden är 12 px
(`rounded-base`) med `hover:bg-raised`, aktiv `bg-raised text-accent`;
behållaren `bg-surface` (annars syns inte hovern), `rounded-base`, `border-line`,
`shadow-lg` (ramverkets skuggskala har tre steg, SS `shadow-xl` finns inte).
Ikonknapparna är 36 px cirklar med 44 px träffyta som osynlig `after:`-yta;
avataren en 28 px cirkel (`OpsIdentity size="avatar"`) i en 32 px knapp med
`hover:ring-2`, aktiv `ring-accent` (`OpsIconLink avatar`). Mätt: mittlinjerna
för plus, ikonlänk, avatar och hamburgare skiljer 0 px. **Observerat:** i ljust
tema är `--color-raised` och `--color-surface` samma tal (`#fefcf6`), så hovern
syns inte mot behållaren där; i mörkt tema gör den det. Fixturen är oförändrad.

### D. Typografin på ett ställe, och inställningsvyn

**Händelsen:** 0.29.1 hade tio `text-[Npx]` i fem komponenter (8, 9, 10 och 11
px, var och en med sin egen vikt). Bottenradens etikett var 12 px där
SessionStudios är 10, ingen av de tio hade ett namn att peka på, och CP såg det
som "allt är lite fel".

Fixturen får `typografi.roller` (rubrik, sektion, etikett, hjalp, liten, mikro,
var och en med `_kalla` fil:rad) och `typografi.radhojd`; `generate-tokens`
skriver dem som `--text-<roll>` med sammansatta radhöjd, vikt och spärrning, och
`--leading-tight/normal`. De tio literalerna är ersatta. **`check-typografi`**
fäller `text-[..px]`, `text-[..rem]`, `font-size:` och `font-family:` (golv 60
filer, planterat fel i `test-guards`) och kan köras av en app mot sin källkatalog.
`OpsKatalogInstallning`, `OpsModulKataloger` och `OpsField` följer
SessionStudios `SettingsView`: sektionsrubrik, etikett och hjälptext som roller,
kort `rounded-base border p-5`, `gap-3`, rader `flex items-center
justify-between gap-3` med vänsterdelen `min-w-0 flex-1`. **Mätt:** ett
kategorinamn på 49 tecken (svenska sammansatta ord) gav `scrollWidth` 397 mot
`clientWidth` 390 vid 390 px; nu bryts det. Räknemärkets 8 px och vikt är rollen
`mikro`, samma värde som förut.

### E. Loggan utan text under

**Händelsen:** CP: "loggan utan text under". Märket i toppraden ritade appens
namn som undertext under bilden, alltså en kolumn på 68 px i en topprad på 56
(mätt). `OpsBrand` ritar inte längre undertexten i bildläget; `title` är bildens
`alt` och därmed länkens namn. Inloggningen behåller undertexten via ny prop
`undertext`. Toppradens höjd är oförändrat `--topbar-height`.

### F. Skapa händelse med typ och vem som skapade

**Händelsen:** CP: "skapa händelse med typ och vem som skapade". `skapa.handelse`
var ett färdigt `ReactNode`, och ett färdigt nod kan varken få en `groupId` eller
en vald typ. Det kan nu vara `{ form, katalog? }` (katalogen `"handelsetyper"`,
`katalog: null` = ingen typ) och formuläret får `{ groupId, typ, onKlar }` som en
moduls registrering. Datumfälten är formulärets. `OpsEventList` ritar "Skapad av
Namn, 29 sep 09:12" under titeln när både `skapadAv` och `skapad` finns, i lokal
tid och med orden på valt språk (`formatDagOchKlockslag`); en agent och en
människa skrivs ut med orden via `OpsProvenance`; en halv rad ritas aldrig.

### Vakter och prov

`check-skalyta` (Chromium, fail-closed, körs i CI-jobbet som redan har en
webbläsare) och `check-typografi` är nya. `check-docs` kräver nu avsnitten
"Navigationen" och "Typografin". Varje nytt prov är visat rött mot 0.29.1 och
grönt mot 0.30.0, se pull-texten.


## 0.29.1

⛔ **Rättelse: en kategori utan grupp bär ingen `groupId`-nyckel alls.**
0.29.0 skrev `groupId: null` på varje kategori som byggts utan `grupp: true`,
alltså på varje rad i en app som ännu inte grupperat sina kataloger
(övergången i cllp/bolag-ops#447). Mätt i bolag-ops ompinning till 0.29.0:
regelproven föll 10 av 151 med `PERMISSION_DENIED` på varje kategoriskrivning,
eftersom appens `hasOnly`-regler för `kategorier`, `typer` och `status` inte
känner `groupId` och inte ska göra det förrän #447 är gjort. En rad utan grupp
är nu byte för byte samma rad som i 0.28.0, och `groupId` finns på raden bara
när `grupp: true` sattes. `standardvarden()`, `las()` i ogrupperat läge och
`OpsKatalogInstallning` utan `groupId`-prop följer med. Proven är röda på
0.29.0 (5 av 90 i katalogsviten) och gröna med rättelsen. Ingen ändring för
grupperade kataloger, ingen regeländring.


## 0.29.0

⛔ **Gruppanelen och gruppväxlaren som SessionStudio, katalogerna per grupp,
vitlistan och den första gruppen, märket rättat.** CP 2026-09-28: "OCH
GRUPPVÄLJARE? Var fins det?" och senare "Titta noga på uppdelningen av header
logo och hur grupppanelen vecklas ut. Kolla i SessionStudio. Det är inte så du
angett nu. Det skall vara exakt." Måtten i den här versionen är lästa ur
SessionStudios källa med fil och rad, inte ur minnet: första utkastet hade
288/72 px, förebilden har 184/44. Ärendena är
[#160](https://github.com/cllp/ops-framework/issues/160),
[#161](https://github.com/cllp/ops-framework/issues/161) och
[#162](https://github.com/cllp/ops-framework/issues/162).

### Gruppanelen och gruppväxlaren (#161)

**`OpsAppShell` tar `grupper`** (`{ lista, aktiv, onValj, onSkapa, infalld,
onInfalld, ... }`). Från `lg` ritas `OpsGruppanel` som en kolumn UNDER
toppraden, bredvid innehållet (SessionStudio `App.jsx:1364`): utfälld 184 px
med "Alla arbetsytor", ett kort per grupp (märke 20 px, glob/info/penna,
namn, medlemsantal, runda bibliotek- och chattknappar med badge, avatarer
20 px, max fyra och "+N") och "Skapa grupp" streckad; infälld 44 px med
40 px-knappar och gruppmärke, chevronen överst i panelen. Bredden byter
direkt, utan transition (`AppSidebar.jsx:13-16`). Under `lg` ersätts panelen
av `OpsGruppvaxlare` i toppraden, ett ark med samma rader. Bredderna är
tokens: `--panel-bredd` 184 px, `--panel-bredd-infalld` 44 px, `--logo-bredd`
180 px, `--logo-bredd-infalld` 40 px (4 px skillnad som i förebilden, asidets
`px-0.5`).

**Loggan följer panelen.** `OpsBrand` tar `panelInfalld`: ordmärket (40 px
högt) när panelen är utfälld, ikonen (32 px) när den är infälld, båda alltid
monterade och crossfadade med opacity på 200 ms (`AppHeader.jsx:174-193`).

**`--radius-base` 12 px** läggs till fixturen: SessionStudios `--radius`
(`index.css:215`), det steg kort, knappar och gruppmärke ritas med. Det
saknades i 0.28.0. `OpsIdentity` får `size="xs"` (20 px).

### Vitlistan och den första gruppen (#160, #161)

**`createGroupService({ kalla, samlingar, kataloger })` på nodsidan** ger
`skapaGrupp({ uid, epost, namn })`: kontrollerar vitlistan först, en grupp per
person, skriver gruppen, sedan ägarens medlemskap, sedan gruppens kataloger.
`byggVitlisterad` och `VITLISTEFALT` med regelfragment. `OpsUtanMedlemskap`
tar `onSkapaGrupp` och visar "Skapa din första grupp" för den vitlistade.

### Katalogerna per grupp (#162)

**En kategori bär `groupId`.** `createCatalogSource` kräver `groupId` och
lagrar nyckeln `groupId|id` så två gruppers "uppgift" inte krockar i samma
samling. `OpsKatalogInstallning` och `OpsModulKataloger` tar `groupId`.
`katalogregelfragment(namn)` ger regelblocket. `seedaKataloger({ kalla,
groupId, standardvarden })` seedar en ny grupps kataloger och anropas av
`skapaGrupp` när appen anger `kataloger`. `check-gruppnyckel` blir rött om
`KATEGORIFALT` saknar `groupId`. Befintliga kategorier utan `groupId` fylls på
av appen (README, punkt 5), inte av ramverket.

### Märket (CP 23:50: "Login alldeles för stor. Och bilden ser inte rätt ut")

**Genomskinligt utanför hårlinjeramen.** Alla fyra `varumarke/*.webp` var
opaka ända ut till kanten, 3 px utanför den rundade ramen: på canvas en vit
eller svart rektangel med fyrkantiga hörn, i 32 px en suddig kant. Området är
nu alfa 0, och `generate-varumarke` vägrar en fil utan alfakanal (bevisat rött
mot originalfilen). **Storleken sätts i höjd, inte bredd.** `ordmarkeMaxWidth`
heter nu `ordmarkeHojd`: `h-10` i toppraden (`AppHeader.jsx:191`), `h-20` i
inloggningen (SessionStudios 4:1-logga vid 330 px är 82 px hög,
`LoginScreen.jsx:224`). OPS Hub-ordmärket är 2,6:1, så samma bredd gav 128 px.

### `createCatalogSource({ groupId: null })`, det ogrupperade övergångsläget

Mätt i appens ompinning: functions i bolag-ops läser hela katalogsamlingen
tills serversidan har gruppmodellen (cllp/bolag-ops#447), och #162 gjorde
`groupId` obligatoriskt, så 11 av 101 functions-prov föll och appen kunde
varken pinna om functions eller köra bakfyllnadens första steg. Bokstavligt
`null` betyder nu "ogrupperad, hela samlingen, som före #162": läser utan
`where`, hoppar över rader med en grupps nyckel, lämnar id:n orörda, seedar
utan groupId. Ett utelämnat groupId är fortfarande rött.

### Menyns undervy är levande (mätt i appens ompinning till 0.28.0)

`OpsAppShell` sparade hela menyraden i state när en undervy öppnades, alltså
även `undervy`-noden som den såg ut vid klicket. Appens nästa render nådde
aldrig panelen: en `OpsSwitch` bunden till appens state såg ut att inte
reagera förrän menyn stängts och öppnats igen, och appen tog bort
aktivitetsfiltret hellre än att visa en knapp som ljuger. Nu lagras radens
`key` och raden slås upp ur `meny.sektioner` vid varje render. Prov: en
räknare i undervyn ökar vid tryck, rött med den gamla koden och grönt med
den nya.

### Deploy (appen)

Nya samlingar: `vitlista` och katalogerna med `groupId`. **Reglerna deployas
före klienthalvan** (bolag-ops CLAUDE.md), och funktionerna som anropar
`skapaGrupp` och `seedaKataloger` deployas före den vy som anropar dem.

## 0.28.0

⛔ **Utseendet som SessionStudio, den här gången mätt och inte tyckt.** CP
2026-09-28, efter 0.27.0: "Jag ber om samma sak massor av gånger men får
ingen skillnad." Tre orsaker, alla åtgärdade i den här versionen: fel profil
hade kopierats (SessionStudios förval är `green`, `main.jsx:65`, inte
grundprofilen), "klart" mättes med jsdom-prov i stället för skärmbilder, och
releaser publicerades utan att appen pinnade om. Ärendena är
[#166](https://github.com/cllp/ops-framework/issues/166),
[#167](https://github.com/cllp/ops-framework/issues/167) och
[#168](https://github.com/cllp/ops-framework/issues/168).

### SessionStudios profil som en fixtur, med generator och vakt (#167)

**`tokens/sessionstudio-profil.json` är hela green-profilen**, avläst ur
SessionStudios källa med fil och rad per grupp: färger ljust och mörkt,
skuggor, radier, typografiskala, ikonernas linjetjocklek, kortets kant och
padding, diagramfärger, rörelsetider och toppradens höjd.
`scripts/generate-tokens.mjs` skriver blocken i `tokens/tokens.css` mellan
markörer, och `check-tokens` blir rött om ett block redigerats för hand
(regel 8/9) eller om fixturen tömts (regel 11). Generatorn kör i `prebuild`,
`pretest` och `precheck:types`, så ett handskrivet tal överlever aldrig ett
bygge.

Det som ändrats i talen: accent oliv (`#6B8E4E` ljust, `#7a9e5e` mörkt),
`--text-sm` 14 px (var 13), `--word-spacing-normal` 0,06em, mörka ytor
`#181c18/#202420/#262d26` med två nya steg `--color-elevated` och
`--color-hover`, mörk sekundärtext `#b0b8ac`, skuggor ur green-profilen (alfa
0,2/0,25/0,3, inte grundprofilens 0,3/0,4/0,5), rörelsetider 150/200/300 ms,
topprad 56 px (`--topbar-height`). Ikonerna ritas med `strokeWidth` 1,5.
`OpsCard` har ingen kant (SessionStudio skiljer kort från sida med ton, inte
linje); `kant` finns som opt-in. `OpsStat`, `OpsTable` och `OpsField` sätter
etiketter på sekundär färg i `font-medium`, aldrig `font-semibold`.

**Diagramfärgerna byter namn** från `--color-series-*` till `--color-chart-*`.
SessionStudios åtta gruppfärgförval sparas i fixturen som referens men matas
INTE in som diagramfärger: mätta med `validate_palette.js` faller de på tre
av fyra kontroller (kromgolv, CVD-separation, delta E mellan grannar), så de
sex redan validerade tonerna behålls.

### Undervyer i menyn (#166)

**En menyrad kan öppna en undervy i samma panel**: `undervy` på raden byter
panelens huvud till en tillbakapil med radens etikett som rubrik, och
innehållet byts på plats. Chevronen sätts automatiskt av `undervy`; en
handskriven `chevron` utan `undervy` är ett tomt löfte och stoppas av
vakten. Aktivitetsflödet och inställningarna hör alltså hemma i menyn, som i
SessionStudio, inte i egna sidor.

### Plusset i toppraden, byggt ur modulerna (#168)

**`OpsAppShell` tar `skapa`**: `{ handelse, arende, registreringar, lage,
kataloger, onKlar }`. Plusset är en fylld rund accentknapp mellan `actions`
och avataren, och trycket öppnar en popover med en platt lista: ramverkets
rader "Ny händelse" och "Nytt ärende" först, sedan en rad per modul som
registrerat ett skapa-formulär. Måtten är SessionStudios (`AppHeader.jsx`
create-menyn): `w-56`, rader `px-4 py-2.5 gap-3`, ikon 18 px, `text-sm
font-medium`, ikon och ord i accentfärg. `OpsPanelRow` får `accent` för
exakt den raden; menyns vanliga rad är oförändrad. Valet öppnar formuläret i
en `OpsModal`. `OpsSkapa` är nu bara listan; popovern och modalen är skalets.

### Två nya regler i kanon

**Regel 11:** en ramverksrelease är klar först när appens ompinnings-PR är
öppnad med besked, i samma pass. **Regel 12:** ett ärende som citerar
SessionStudio är klart först när PR:en bär en skärmbild av samma flöde sida
vid sida med förebilden, tagen mot en byggd app, med en ärlig jämförelse.
Konsumentrepon kör `node scripts/check-kanon.mjs --skriv`.

### Övrigt

`package-lock.json` låg kvar på 0.26.0 medan `package.json` sade 0.27.0;
versionsbumpen skriver båda.

## 0.27.0

⛔ **Skalet nättare, som SessionStudio: rundningar, typografi, en meny, en
inloggning, OPS Hub som märke.** CP 2026-09-28, med bolag-ops (0.26.0) och
SessionStudio sida vid sida: "Man ser tydligt att rundningen på ikoner och
knappar och det som ligger i huvudmenyn inte är samma som sessionstudio. Allt
ser lite bulligare ut." Ärendet är
[#164](https://github.com/cllp/ops-framework/issues/164), och varje punkt
nedan är mätt mot SessionStudios källa, inte tyckt.

### Rundningsskalan och typografin (#164)

**`--radius-sm/md/lg/xl` är nu 8/10/16/20 px, plus `--radius-card` 24 px**,
alltså den skala SessionStudio faktiskt ritar med (`.rounded-app`), inte dess
bastal 4/6/8/12 som ramverket hade kopierat. `OpsCard` använder
`--radius-card`. Regel 9 i `check-tokens.mjs` håller talen som fixtur, regel
10 fäller ett radie-literal som dubblerar ett token (fyra `9999px` i
reglaget var det).

**Knapparna blir piller** (CP 18:20: "Ja, som SessionStudio"): `OpsButton`
textknappar är `rounded-full`, vikten `font-medium` (var `font-semibold`),
`size="md"` är `text-sm` (var `text-base`). Ikonknappar oförändrade.
`OpsPanelRow` är `text-xs` och en aktiv rad byter färg, inte vikt.

### En meny, en inloggning, ett märke (#164)

**Avataren har ingen meny.** Som i SessionStudio är den en länk till
profilen ("Min profil"). **Menyn är skalets hamburgare**, och det finns bara
en: `OpsAppShell` tar `meny` (`{ sektioner, onLoggaUt, appVersion, rubrik?,
loggaUtEtikett? }`) och ritar rubriken "Meny", appens sektioner (typiskt
Notiser och Aktivitet med chevron först), navigeringens överflöd,
`menuExtras`, Logga ut och sist två versionsrader: appens och ramverkets.
`OpsBottomNav` ritar samma innehåll i bottenradens Meny-ark. `OpsAnvandarmeny`
från 0.26.0 är borta; en första omskrivning (`OpsMeny` med egen knapp) gav
två hamburgare och togs bort igen innan utgivning.

**`OpsInloggning`** ritas av `OpsAuthGate` i utloggat läge: ordmärket, appens
namn som spärrad undertext, en viskning, ett kort med Swe/Eng-pill,
leverantörsrader som piller, "ELLER", "Fortsätt med e-post och lösenord",
"Skapa konto", "Logga in med e-postlänk", och en sidfot med appens länkar och
version. **Raderna styrs av adapterns förmågor:** `createAuth` normaliserar
`signInWithGoogle` (`signIn` fungerar fortfarande), `signInWithApple`,
`sendEmailLink`/`completeEmailLink`, `signInWithPassword`, `createAccount`
och `resetPassword`, och `createGoogleAuth` tänder dem som finns i det
`sdk`-objekt appen skickar in. En app med bara Google får en rad.
`useOpsAuth()` ger `auth` och `clearError` i stället för `signIn`;
`OpsAuthGate` tar `etikett` (appens namn), `viskning`, `lankar`,
`appVersion`, `sprak`, `onSprak` i stället för `signInText`.

**OPS Hub är ramverkets märke** (CP 19:00: "Loggorna ska vara default för
ramverket"; 19:10: appens namn som undertext under loggan). Fyra webp-filer
i `varumarke/` (44 KB) bäddas in som data-URL:er vid bygget
(`scripts/generate-varumarke.mjs`, git-ignorerad utfil), så bilden finns i
paketet oavsett hur konsumenten bundlar. Bevisat i ett riktigt Vite-bygge av
scaffold-mallen. `OpsBrand` ritar ordmärket i bred vy och ikonen i smal, i
rätt tema via `useResolvedTheme`, och `title` som undertext; `ordmarke` och
`ikon` som props är en apps överridning. Namnet "Operations Hub" är borta,
`check-docs` fäller det.

### Profil, inställningar, plus-meny (#164)

**`OpsProfil`** får SessionStudios huvud (avatar, namn, e-post, rollen som
pill via `roll`), och Profilbild-sektionen erbjuder standardikon och färg
(`users` växer med `ikon` och `farg` i `ANVANDARFALT`, hasOnly följer med;
konsumenten regenererar sina regler). Det kräver ingen Storage: bara "Byt"
är gömd utan `lagring`. Länksektionen ritas bara när appen skickar
plattformar, och Språk och Utseende har en egen rubrik, Inställningar.

**`OpsKatalogInstallning`**: Ändra, Arkivera och Ta fram har ikoner.
**`OpsModulKataloger`**: varje katalog står under sin moduls namn med raden
"Används i: ...", härledd ur manifestet, och en katalog utan modul säger det.
**`OpsSkapa`**: första nivån är en platt lista med ikon och ord (som
SessionStudios plus-meny), typval och formulär efter valet; `ikonRitare` och
`tillbakaEtikett` är nya props.

### Vakter och arkitektur

`check-fonts` är obligatorisk i konsumentens `check`-kedja (`check-adoption`
fäller en `package.json` utan den; det var luckan som lät bolag-ops ladda
Inter i en vecka). Ny `check-handritade-ikoner`: en `<svg>` utanför
`icons.jsx` är röd, med fyra dokumenterade undantag. Bottennavens eget
räknemärke och två handritade kryss är ersatta av `OpsCountBadge` och
`KryssIkon`. Alla nya vakter är inkopplade i `test-guards.mjs` med rött
utan sin fix.

---

## 0.26.0

⛔ **SessionStudios profil: typsnitt, användarmeny, versionsrad, och en
aktivitetspanel som ser ut som förebilden.** CP, efter att ha lagt bolag-ops
och SessionStudio sida vid sida: "sessionstudios typsnitt är bättre än ops
framework. Jag vill följa sessionstudios profil exakt." Två ärenden, samma
dag, samma spår: [#157](https://github.com/cllp/ops-framework/issues/157) och
[#158](https://github.com/cllp/ops-framework/issues/158).

### Typsnitt, användarmeny och versionsrad ([#157](https://github.com/cllp/ops-framework/issues/157))

**Plus Jakarta Sans i stället för Inter.** `--font-sans` byter till
SessionStudios typsnitt, med samma systemstack men UTAN Inter kvar som
reserv: två typsnitt är två sanningar. Hämtningen flyttar som förut i
`create-ops-app/template/index.html`, `check-fonts.mjs` vaktar det nya
namnet. `--font-mono` hade redan SessionStudios kedja.

**`OpsAnvandarmeny` får SessionStudios form:** en rubrik ("Meny"), sektioner
skilda med linjer, ikon per rad, en chevron på rader som öppnar en panel, en
extern-länk-ikon på rader som lämnar appen, Logga ut i sin egen sektion, och
en dämpad versionsrad sist. Vilka rader som finns bestämmer appen via en ny
`sektioner`-prop (en lista rader, samma primitiv, `OpsPanelRow`, som notis-
och aktivitetspanelerna redan ritar med); formen bestämmer ramverket.

**Versionsraden bär två versioner:** `bolag-ops v1.4.2 · ops-framework
v0.26.0`. Ramverkets tal kommer ur en konstant som skrivs vid bygget ur
`package.json` (`scripts/generate-framework-version.mjs`, git-ignorerad
utfil), aldrig en handskriven kopia. Appens version är en prop; saknas den
skrivs raden ändå, med ramverkets ensam.

**Två nya primitiver**, mätta ur SessionStudios `ProfileView.jsx`:
`OpsSectionLabel` (sektionsrubrik, liten versal, spärrad, accentfärg) och
`OpsChip` (ett val i pillform, med ikon och ett valt läge).

**Kortens luft blir ett token.** `--card-padding: 20px` ersätter `OpsCard`s
hårdkodade `p-4`, mätt mot SessionStudios `p-5`. Mörkrets skuggalfa
(0.35/0.45/0.55, plus ett eget offset på `shadow-lg`) rättas till
SessionStudios exakta tal (0.3/0.4/0.5, `0 4px 16px` överallt).

⛔ **`tokens/check-tokens.mjs` fick en åttonde regel:** röd om en palettfärg
glider från SessionStudios värden, med paletten inskriven som fixtur och
skälet utskrivet. Paletten visade sig redan vara densamma, tecken för
tecken; regeln håller den så framåt.

### Aktivitet och notiser som i SessionStudio ([#158](https://github.com/cllp/ops-framework/issues/158))

CP, mobilskärmbild: "I mobile ops står Aktivitet två gånger [...]. Filter
högerställt och fult. [...] med en chevron down (expand) för detalj eftersom
notisen inte leder någonstans om det inte är en länk."

- **Rubriken stod två gånger på mobil.** Rotorsaken satt i `OpsPanel.jsx`:
  roten ritade sin egen rubrik OVANPÅ sheetens egen `Dialog.Title`, med
  samma ord. Roten ritar nu ingen egen rubrik på smal skärm.
- **"Ny" var en pill, är nu en punkt**, med ordet kvar för skärmläsaren
  (`sr-only`).
- **Raden bytte förut vy. Nu fäller en chevron ut `OpsActivityDetail` PÅ
  PLATS**, under raden, och listan blir kvar. En länk-knapp ritas bara när
  händelsen bär en `lank`.
- **Filtren låg ovanför listan, högerställda. De ligger nu bakom en
  filterknapp** i huvudet, och "Rensa" flyttade till en trepunktsmeny
  bredvid den. Ingendera syns förrän man tryckt på sin knapp.
- **Grupperingens ord rättades**: "I går" → "Igår", "Senaste veckan" →
  "Denna vecka".

Datamodellen och läsmarkeringen (`lasning`, `onSeen`, `onRead`) är
oförändrade: det här ärendet är ytan, inte källan. `OpsActivityButton` fick
`open`/`onOpenChange`/`renderTrigger`, så panelen går att nå från en rad i
`OpsAnvandarmeny` i stället för bara från sin egen klocka.

⛔ **Mätt i en riktig webbläsare, inte i jsdom:** att öppna panelen från en
rad i en ANNAN, just stängd, Radix-yta gjorde att panelen stängde sig själv
igen inom 10-15 ms. Fokus, som satt på menyraden, hamnade på `<body>` när
menyn stängdes, och `OpsPanel`s `DismissableLayer` läste det som "fokus
utanför". `onOpenAutoFocus`/`onFocusOutside` avstyrs nu på panelens
rullgardin; ett riktigt klick utanför stänger fortfarande som förut.

**Granskningsrättelse:** `handelse.lank` ({ href, etikett }) skrevs och
lästes utan att formen någonsin kontrollerades. `createActivityLog` avvisar
nu en `lank` vars `href` inte är https eller en relativ sökväg, eller vars
`etikett` är tom. `ACTIVITY_SECTIONS` bar dessutom fyra hårdkodade svenska
ord trots epikens princip om tvåspråkigt från dag ett (#109); etiketterna är
nu `{ sv, en }` och `OpsActivityList`/`OpsActivityButton` tar emot en
`sprak`-prop, precis som `OpsProfil`.

### Profilen som i SessionStudio ([#156](https://github.com/cllp/ops-framework/issues/156))

CP: "vill ha profil precis som SessionStudio." Mätt mot SessionStudios
`ProfileView.jsx`: bild, namn, telefon, stad, presentation och länkar är
fält varje app med människor behöver, alltså ramverkets. Det kreativa
(discipliner, roller, instrument) är SessionStudios egna begrepp och hör
INTE hit, se `OpsProfil`s nya `children`-slot.

**`users` växer med fem fält** (`ANVANDARFALT`, `byggAnvandare` i
`src/lib/grupp.js`): `telefon` (E.164 eller tom sträng), `stad`,
`presentation` (max `MAX_PRESENTATION`, 500 tecken), `lankar` (lista av
`{ plattform, url }`, plattformen måste finnas i den lista appen skickar in,
url måste vara https) och `bildSokvag` (lagringssökvägen, så bilden går att
ta bort). Alla tomma strängar/listor när de saknas, aldrig utelämnade fält.

**Namn och bild blir redigerbara av personen själv.** `sparaInstallningar`
tar nu emot alla `PERSONFALT`, inte bara språk och tema. En namn- eller
bildändring når däremot inte automatiskt medlemslistorna:
`memberships` skrivs aldrig av en klient (#136), så en ny nodfunktion,
`uppdateraProfil({ kalla, uid, andring })` (`@staiger/ops-framework/node`),
skriver `users` OCH alla medlemskap för `uid` i samma steg. Appen anropar
den, via en server-callable, när `onSpara` ser namn eller bild i andringen.

**Ramverkets första Storage-yta**, bredvid `kalla`: `createStorageSource`
(kontraktet), `createMemoryStorage` (för prov), `createFirebaseStorageSource`
(mot Firebase Storage, ramverket importerar ingen Firebase-SDK) och
`lagringsregelfragment({ prefix })` (bara sin egen sökväg, bara bilder,
2 MB tak). `OpsProfil` fungerar utan en `lagring`-prop: Profilbild-sektionens
knappar döljs då helt, ramverket kräver inte Storage.

**`regelfragment()`s `users`-block fick en `keys().hasOnly`**, exakt
`ANVANDARFALT`, splittad i `allow read, delete` och `allow create, update`
(`request.resource` finns bara på det senare). `check-gruppnyckel.mjs`
vaktar att `ANVANDARFALT` och `hasOnly`-listan inte glider isär.

**`OpsProfil` får tre nya sektioner**, byggda med `OpsSectionLabel`,
`OpsChip` och `OpsCard`: Profilbild (ladda upp, ta bort, återställ från
inloggningen), Personuppgifter (namn, telefon, stad, presentation) och
Länkar (plattform ur appens lista + url). En `children`-slot sist, för
appens egna sektioner.

⛔ **Storage-emulatorprov finns inte ännu.** `lagringsregelfragment` provas
som text, inte mot en riktig Storage-emulator: `rules/__tests__/` kör bara
Firestore-emulatorn i dag.

### Felrapportering: felgräns, loggpunkt, Sentry som valfri mottagare ([#159](https://github.com/cllp/ops-framework/issues/159))

CP: "Skall Sentry vara default eller optional i framework?" Beslut, CP:s
svar "Allt perfekt": **valfritt, men färdigkopplat.**

**`OpsAppShell` har nu en felgräns som alltid är på**, ingen prop stänger
av den. Ett kastat fel ger en felyta med ett sexteckens id och en
Ladda om-knapp, aldrig en vit sida.

**En ny loggpunkt**, `rapporteraFel(fel, sammanhang, felmottagare)`
(`src/lib/felrapport.js`): skriver ALLTID till `console.error`, oavsett
mottagare eller miljö, och vidarebefordrar till `felmottagare.fanga` när en
sådan finns. Kastar aldrig, ett fel i mottagaren fångas och loggas separat.

**Ett kontrakt för mottagare**, `{ fanga, satt }`. `OpsAppShell` kallar
`fanga` från felgränsen. `OpsAuthProvider` (nu med en `felmottagare`-prop)
kallar `satt({ uid, groupId })` vid varje inloggningsbyte och `satt(null)`
vid utloggning, aldrig med e-post.

**En färdig Sentry-mottagare**, i en egen, obundlad ingång:
`@staiger/ops-framework/sentry`, `sentryMottagare({ dsn, miljo, version })`.
`@sentry/browser` bara laddas av den app som skriver raden;
`check-paket.mjs` bevisar att ramverkets `dist/index.js` aldrig nämner
Sentry. `@sentry/browser` är en `peerDependency`, `optional: true`, aldrig
en `dependency`.

**Scaffold-mallen** (`create-ops-app`): den handrullade
`src/lib/ErrorBoundary.jsx` togs bort, den dupplicerade nu exakt det
`OpsAppShell` gör åt alla. `App.jsx` har en utkommenterad rad för Sentry med
skälet till att den är av som förval.

---

## 0.25.0

⛔ **Fas 2.5 i sin helhet: ramverket vet nu vems rad en rad är.**

Fram till här svarade `members/{uid}` på "vem får använda appen". Det svarar inte
på "vems rad är det här", och utan det svaret kan två verksamheter inte dela en
app. Fem PR:ar samma dag, epiken [#92](https://github.com/cllp/ops-framework/issues/92).

### ⛔ Medlemskapets nyckel är entydig ([#152](https://github.com/cllp/ops-framework/issues/152))

Avgränsaren i `medlemskapsId` går från `_` till `|`, och den är nu **ett värde**
som både funktionen och regelfragmentet läser: `MEDLEMSKAPSAVGRANSARE`.

⛔ **Med understreck var nyckeln tvetydig.** `ID_FORM` tillåter understreck i
ett id, alltså var avgränsaren ett lagligt tecken i båda halvorna:

```
medlemskapsId("a_b", "c")  ->  "a_b_c"
medlemskapsId("a", "b_c")  ->  "a_b_c"
```

Två olika medlemskap pekade på samma dokument, och vilken roll som gällde
avgjordes av vem som skrev sist. Regeln slår upp exakt den nyckeln.

⛔ **Felet var av den tysta sorten.** Ingenting kraschar. En person får fel roll
i en grupp, eller ser en grupp hen inte är med i, och det syns inte i en logg.

⛔ **Och det ändras nu för att migreringen är TOM.** Noll skarpa medlemskap
finns. Om en månad hade varje nyckel i databasen behövt skrivas om, plus
reglerna, i samma andetag.

⛔ **`medlemskapsId` kastar ändå om någon halva innehåller avgränsaren.**
`ID_FORM` släpper inte igenom `|`, men `userId` är ett Firebase-uid och alltså
någon annans format: med en custom token är det fritt. Att lita på en annan
leverantörs format är ett antagande, i en kodrad som avgör behörighet.

⛔ **Tecknet stod förut på tre ställen**, en gång i `grupp.js` och två gånger i
regelfragmentet. Tre handskrivna kopior av samma faktum, och den dag en av dem
ändrades hade regeln nekat varje läsning utan att något prov var rött. Ett prov
mäter nu att regeltexten bär samma tecken som konstanten.

**Har du redan medlemskap i en databas** måste varje `memberships`-dokument
skrivas om till den nya nyckeln innan reglerna deployas. Inom bolag-ops finns
inga, så där är det en tom åtgärd.

### Grupper och medlemskap ([#136](https://github.com/cllp/ops-framework/issues/136))

Fyra samlingar ramverket äger: `users`, `groups`, `memberships`, `invitations`.
Appen skickar in namnen, som för katalogen, så en kund senare kan bli ett eget
Firebase-projekt utan att datamodellen ändras.

⛔ **Exakt en gruppnyckel per rad.** Varje rad bär `groupId`, ett värde, aldrig
en lista, och läsregeln blir ETT uppslag mot `memberships`. `check-gruppnyckel`
vaktar raden. SessionStudio bar `invitedGroupIds` och fick bära "eller någon av
de här" i varje regel, varje fråga och varje vy, och det gick inte att ta bort
efteråt eftersom datan redan hade formen.

⛔ **`memberships` skrivs aldrig av en klient.** Den som kan skriva sitt eget
medlemskap kan ge sig själv rollen ägare i vilken grupp som helst vars id hen
gissar. Reglerna säger `allow write: if false`, och serversidan skriver.

`regelfragment()` och `gruppadSamling()` genererar regeltexten appen limmar in.
Firestore-regler har ingen import, så alternativet är en textsnutt någon
klistrar in per samling, och den dagen villkoret ändras sitter den gamla kvar i
de samlingar ingen kom ihåg. Ramverket fick samtidigt sin första emulatorkedja.

### Profil, inställningar och utloggning ([#138](https://github.com/cllp/ops-framework/issues/138))

`OpsProfil`, `OpsAnvandarmeny` och en `anvandare`-plats i `OpsAppShell`, plus
`sakerstallAnvandare`, `sparaInstallningar` och `andringen` i `profil.js`.

⛔ **Beslutet ligger i en ren funktion, inte i komponenten.** En Radix-komponent
går inte att driva med `fireEvent` i jsdom, så två prov stod gröna på att
ingenting hände. `andringen()` flyttade beslutet dit ett prov når det.

### Inbjudan och vägen in ([#137](https://github.com/cllp/ops-framework/issues/137))

`createInvitationService` i `./node` med `bjudIn` och `accepteraInbjudningar`,
plus `OpsMedlemmar` och `OpsUtanMedlemskap`.

⛔ **Ägarskapet kontrolleras i funktionen, inte bara i reglerna.** En callable
med Admin SDK kör FÖRBI reglerna, så en ägarkontroll som bara finns i
`firestore.rules` gör funktionen till en väg runt dem.

⛔ **En inbjudans roll är oföränderlig.** En inbjudan är ett löfte någon redan
fått: höjs rollen i efterhand blir en accepterad inbjudan till medlem plötsligt
ett ägarskap, utan att den som accepterade såg det.

### Gruppväljare, gruppfilter och sammanslagning ([#139](https://github.com/cllp/ops-framework/issues/139))

`OpsGruppvaljare`, `OpsGruppfilter` och `OpsGruppmarke`, plus `grupplage.js` och
`gruppkalla.js`. Två lägen: en vald grupp, eller alla mina.

⛔ **Sammanslagning är inte delning.** I läget alla frågas varje grupp en gång,
`slaIhopSvar` märker varje rad med sin grupp, och ingen rad och ingen regel
ändras. En fråga per grupp, ingen optimering.

⛔ **`groupId` är ett krav i TYPEN**, och `check-gruppfraga` kör tsc mot en
fråga och ett skapande utan grupp och kräver ett typfel för var och en. En vakt
som letat efter raden i källan hade varit ett närvarogrep.

### Nytt i den publika ytan

`ROLLER`, `MEDLEMSTYPER`, `MEDLEMSSTATUS`, `INBJUDNINGSSTATUS`, `TEMAN`,
`byggAnvandare`, `byggGrupp`, `byggMedlemskap`, `byggInbjudan`, `medlemskapsId`,
`regelfragment`, `gruppadSamling`, `sakerstallAnvandare`, `sparaInstallningar`,
`andringen`, `ALLA_GRUPPER`, `minaGrupper`, `valtLage`, `grupperAttFraga`,
`navForLage`, `gruppenAttSkapaI`, `slaIhopSvar`, `grupplagetsNyckel`,
`lasAktivGrupp`, `sparaAktivGrupp`, `gruppLista`, `gruppSkapa`, `listaPerGrupp`,
`raderPerGrupp`, samt komponenterna `OpsProfil`, `OpsAnvandarmeny`,
`OpsMedlemmar`, `OpsUtanMedlemskap`, `OpsGruppvaljare`, `OpsGruppfilter` och
`OpsGruppmarke`. `createInvitationService` i `./node`.

⛔ **Ingenting togs bort och ingenting bytte form.** En app som inte använder
grupper märker inte den här versionen, vilket är skälet att den är minor och
inte major.

### Tre luckor stängda innan taggen

⛔ **Gruppens modullista valideras mot de registrerade.** `byggGrupp(rad,
kandaModuler)` avvisar ett påhittat modul-id, som annars sparades som en flik
ingen hittar. Argumentet är valfritt med flit: skrivvägen skickar in listan,
läsvägen måste tåla en avinstallerad modul och får sitt svar av `navForLage`.

⛔ **`memberships` bär `namn` och `bild`** (beslut A i #138). E-posten lämnar
aldrig `users`, och utan de två fälten hade medlemslistan varit en rad uid:n.
Serversidan skriver dem vid inbjudan och vid acceptans, och profilen läses en
gång även när tre inbjudningar accepteras samtidigt.

⛔ **`check-kontrast` och `check-gruppnyckel` går nu att göra röda.** Båda
saknade bevis i båda riktningarna, alltså var de förhoppningar och inte vakter.
Sökvägarna går att peka om, båda har golv mot tom indata, och nio nya fall i
`test-guards` planterar riktiga fel: brödtext i bakgrundens färg,
`invitedGroupIds` i en fältlista, `array-contains` i regeltexten och en regel
som slutat slå upp medlemskapet.

⛔ **Och kontrastvakten kraschade i stället för att mäta** när ett tokenblock
saknades. Ett oväntat undantag är visserligen rött, men säger fel sak, och det
är precis den "röd av fel anledning" som harnessets andra villkor finns för.

### Fas 3, första tre ärendena

⛔ **Källkontraktet** (#129). `skapaKallregister(moduler)` ger en funktion per
yta, och varje anrop bär exakt en grupp. Formen prövas när raden kommer, inte
vid uppstart: vad en funktion returnerar går inte att veta förrän den anropats,
och felet namnger modulen, ytan och radnumret. `OpsModulHandelser`,
`OpsModulHjalp` och `OpsModulKataloger` läser ur registret, medan primitiverna
fortsätter ta emot data. `useKallor` skiljer på laddar, fel, tomt och fyller.

⛔ **Regelgeneratorn** (#130). `generateRules(moduler, { extra })` ger hela
`firestore.rules` ur manifesten. Manifestets `samlingar` bär nu fält, eftersom
`keys().hasOnly` inte går att generera ur ett namn; strängformen från 0.25.0
tas fortfarande emot och läsaren får alltid den utskrivna formen.
`check-regelgenerator` jämför mot en gyllene fil.

⛔ **En modulsamling får `allow delete: if false`** (granskningsfynd på PR 151).
Generatorn skrev först att en medlem fick radera. #136:s beslut är arkivering
och aldrig radering, eftersom svaret på "varför försvann den" alltid
efterfrågas i efterhand, och ramverkets egna samlingar har redan `delete: if
false`. Generatorn hade alltså infört den enda raderingsvägen i hela modellen,
som ett förval ingen valt. Behöver en modul radera ska det bli ett beslut i
manifestet med sitt skäl. `test-guards` är rött om `delete` blir något annat
än `false`.

⛔ **Exempelmodulen** (#131) i `examples/paminnelser/`, som nu följer med
paketet. `check-exempelmodul` kräver att varje manifestfält, samlingsfält och
källtyp finns både i README-avsnittet och i exemplet.

⛔ **Exemplet importerar via paketnamnet, inte via `../../src/`**
(granskningsfynd på PR 151). Det importerade ramverkets innanmäte medan README
säger `import { defineModule } from "@staiger/ops-framework"`, alltså bröt det
mot det enda löfte mappen finns för: att gå att kopiera och bygga ur README
utan att öppna källkoden. En modulbyggare fick sökvägar som inte finns i en
installerad tarboll. Node tillåter självreferens via paketnamnet när `exports`
finns, så det fungerar även inne i repot. Vakten fäller nu varje import som
lämnar exempelmappen, och släpper igenom relativa vägar inom den: den gamla
vakten jämförde fältnamn, och importvägar är inte fältnamn.

⛔ **Manifestet importerar sin vy med `lazy`**, och exemplet visar varför:
regelgeneratorn körs i ett Node-skript, och Node kan inte läsa JSX.

### De tre ytorna som saknades

⛔ **Sök** (#140), **Notiser** (#141) och **Översikt** (#142). Alla tre läser ur
källregistret och äger sin egen tomhet, sitt fel och sin väntan.

Sök indexerar inte: ramverket frågar källorna och visar vad de ger. Fältet
frågar inte förrän något skrivits, eftersom en modul som får en tom söksträng
rimligen svarar med allt den har. Tomheten bär sökordet, så stavfelet syns.

Notisernas läsmärke är ramverkets data och skickas in av appen. Räknaren kan
inte nå en grupp jag inte är med i, och det följer av kontraktet i stället för
av en kontroll: källan frågas per grupp.

Översikten är alltid en grupps. En widget som saknas i gruppens ordning hamnar
sist, inte utanför: en ny modul ska dyka upp, inte vara osynlig tills någon
redigerat en lista de inte visste fanns.

### Skapa-kontraktet: plusset ([#150](https://github.com/cllp/ops-framework/issues/150))

⛔ **Manifestet får sin sjunde del, och den är spegelbilden av källorna.**
Källorna läser IN i ramverkets ytor, `skapar[]` skriver UT ur plusset. En
registrering bär `{ id, namn, ikon, katalog, form }`, och `OpsSkapa` ritar en
flik per registrering från den aktiva gruppens påslagna moduler.

⛔ **BRYTANDE: `skapar` krävs i varje manifest, även tomt.** Samma skäl som
`kallor: {}`: en modul som inte kan skapa något och en som glömt fältet ser
likadana ut om det är valfritt. Lägg till `skapar: []` i manifest som inte
registrerar något.

⛔ **Ramverket äger panelen, modulen äger formuläret.** Formuläret får
`{ groupId, typ, onKlar }` och ingenting mer. Skulle ramverket skriva raden
måste det känna till modulens samling, och då är uppdelningen bara en
uppdelning på papperet.

⛔ **Tre tomlägen, inte två.** `skapalaget` skiljer "välj en grupp först" från
"inget att skapa här", eftersom de kräver olika handlingar. Samma text för båda
lär användaren att plusset är trasigt, och den läxan sitter kvar efter att
texten rättats.

⛔ **Katalogkontrollen bor i `kontrolleraSkaparkataloger`, inte i
`defineModule`, och det är en avvikelse från ärendets ord "kastar vid
uppstart".** Kataloger kommer ur `kallor.kataloger`, alltså ur en funktion som
frågas per grupp, och ingen lista finns förrän den frågats. Kontrollen körs så
tidigt den kan: när gruppens kataloger är lästa.

### Kedjan kontrollerar nu varje PR

`check.yml` hade `branches: [main]` på `pull_request`, så en PR mot en annan
gren fick NOLL kontroller, tyst. Tre av fasens PR:ar stod så i timmar, varken
röda eller gröna. Filtret är borta och en knapp för att köra kedjan för hand är
tillagd.

---

## 0.24.0

⛔ **Primärknappens text var oläsbar i ljust läge, och blev sämre av att man
pekade på den.**

`--color-accent-contrast` var `#f8f7f4`, alltså sidans botten, avläst ur
förlagans enda accentfyllda knapp. Paritet var beslutet, och svagheten stod
utskriven vid tokenet som "medvetet ärvd". Tre fynd 2026-09-27, och bara det
första var känt:

| | på `accent` | på `accent-hover` |
|---|---|---|
| `#f8f7f4`, förut | **2,79:1** | **2,44:1** |
| `#1a1a1a`, nu | **5,83:1** | **6,66:1** |
| WCAG AA kräver | 4,5:1 | 4,5:1 |

⛔ **Noten hade fel siffra.** Den sade 2,99:1. Rätt svar är 2,79:1, och 2,99 är
vad `raised` ger på accent, alltså raden bredvid i tabellen i
`check-kontrast.mjs`. En felskriven siffra i en not om en MÄTT svaghet är precis
den sorts uppgift ingen kontrollerar igen: den ser redan verifierad ut.

⛔ **Hover-läget var aldrig mätt.** Det var sämre än viloläget. En vakt som bara
mäter vila godkänner en knapp som blir oläsbar när muspekaren når den.

### Ändrat

- Ljust `--color-accent-contrast` går från `#f8f7f4` till `#1a1a1a`. Värdet är
  inte påhittat: det är `--color-ink`, sidans egen text. En egen hex här hade
  varit en färg vid sidan av paletten.

### Lagt till

- Två par i `PAR` i `scripts/check-kontrast.mjs`: `primärknappens text` och
  `primärknappens text, hover`. Noten på platsen sade att hålet skulle stängas
  den dag beslutet togs, och **en kommentar fäller inget bygge.**

### Inte ändrat

**Mörkt läge.** Det gav redan 11,56:1 och 12,76:1, och värdet står orört.

**Reglagets på-läge.** Knoppen är då en yta och inte text, och inget befintligt
token klarar 3:1 mot accent i båda teman. Hålet står kvar i noten, med sitt skäl.

### ⛔ Vad som faktiskt ändras för den som uppgraderar

Tokenet bär mer än en knapp. Fyra komponenter ser annorlunda ut i ljust läge:

| Komponent | Vad som ändras |
|---|---|
| `OpsButton variant="primary"` | textens färg |
| `OpsBottomNav` | FAB:ens plustecken och räknemärkets siffra |
| `OpsDatePicker` | den valda dagens siffra |
| `OpsToggle` | kryssrutans bock |

⛔ **Bocken är det som gör det här till mer än kosmetik.** Den är en grafik på
accent och behövde 3:1, vilket 2,79:1 aldrig var. Ändringen stänger därmed också
en del av cllp/bolag-ops#417.

### Beviset i båda riktningarna

| | Utfall |
|---|---|
| `check-kontrast` **utan** fixen | `exit 1`, båda paren utskrivna med sina tal |
| `check-kontrast` **med** fixen | 19 par i 2 teman, alla över AA, `exit 0` |

---

## 0.23.1

⛔ **Katalogschemat hade elva kontroller och nio prov. Mätt, inte antaget.**

En granskning (cllp/bolag-ops#420) noterade att katalogproven saknade synligt
bevis på rött utan sin fix. Beviset togs genom att slå ut varje kontroll i
`byggKategori` och `validateKatalog`, en i taget, och köra de fyra
katalogprovfilerna mot den trasiga koden.

Nio kontroller gav rött. **Två gick att ta bort utan att något blev rött:**

| Kontroll | Utfall före | Varför den överlevde |
|---|---|---|
| `id` krävs | **grön** | En tom sträng föll ändå på ID-formen. Beteendet var rätt, meddelandet blev fel |
| `ikon` krävs | **grön** | En tom ikon föll ändå på tillåtelselistan, men bara när en lista skickas in |

⛔ **Den andra är den farliga.** Utan tillåtelselista fanns ingenting kvar:
`if (!ikon)` var det enda som stod mellan en kategori utan ikon och ett tyst
godkännande. Och det läget är inte hypotetiskt: `functions/katalog.js` i
bolag-ops bygger sin katalogkälla helt utan `ikoner`, med flit, eftersom en
ikon som appen känner men inte functions annars hade fällt hela katalogen till
reserven för något som bara rör en vy.

### Lagt till

- Två prov i `src/__tests__/katalog.test.js`: en kategori utan `id` avvisas med
  meddelandet "id krävs", och en kategori utan `ikon` avvisas **också när ingen
  tillåtelselista skickats**. Båda visade sig röda utan sin kontroll.
- Hela mutationssvepet skrivet i provfilens filhuvud, så nästa läsare ser vad
  som faktiskt är bevisat och vad som bara är skrivet.

### Inte ändrat

Ingen kod i `src/lib/katalog.js`. Kontrollerna fanns och gjorde rätt; det som
saknades var beviset.

---

## 0.23.0

⛔ **Reglaget gick inte att se, och det var inte bara i mörkt läge.**

CP 2026-09-26, med bild från mobilen: "Går ej att se kontrast på toggle".
Mätt mot tokens gällde det båda temana, och det var inte en knopp som var svår
att se utan en knopp som inte fanns:

| Par | Ljust | Mörkt |
|---|---|---|
| spår av (`sunken`) mot panelen (`raised`) | 1,17:1 | **1,00:1** |
| knopp (`canvas`) mot spår av (`sunken`) | 1,09:1 | 1,14:1 |

### Ändrat

- **`OpsToggle`s switch har kant på både spår och knopp.** Fyllningen kan inte
  bära kravet: `sunken` ligger per definition nära ytan den vilar på. Kanten
  (`ink-secondary`) ger 9,47:1 i ljust och 5,10:1 i mörkt.
- **Knoppen ligger på `raised` i stället för `canvas`.** Det är tokenet för det
  som ligger ovanpå något, och det enda som når 3:1 mot `accent` i mörkt läge.
- **`check-kontrast` bevakar två av reglagets par**, och ett prov bredvid
  kräver att komponenten faktiskt ritar de tokens vakten mäter. En vakt som
  mäter tokens är grön även när ingen ritar dem.

### Känt hål, utskrivet

Knoppen i **på**-läget når inte 3:1 mot `accent` i ljust läge, och det går inte
att lösa med befintliga tokens: ljust `accent` (#9a9588) ligger mitt i skalan,
för mörkt för en ljus knopp och för ljust för en mörk. Samma orsak som gör att
`accent-contrast` bara ger 2,79:1 på `accent` i ljust, vilket redan står
utskrivet vid tokenet.

Hålet stängs den dag ljust `--color-accent-contrast` blir mörkt (#1a1a1a ger
5,83:1), och det är ett produktbeslut om hur varje primärknapp ser ut.

I på-läget bär formen i stället: knoppen flyttar sig, och spårets kant mot
panelen står kvar. Läget avgörs alltså aldrig av färg ensam (WCAG 1.4.1).

---

## 0.22.0

⛔ **Två adaptrar av samma kontrakt svarade olika på samma anrop.**
`createFirestoreSource.create` med ett eget id gör `setDoc`, alltså ersätter
dokumentet. `createMemorySource.create` la till en andra rad med samma id.

Upptäckt i `cllp/bolag-ops` när inställningsvyn skulle provas: `list()` gav två
poster där Firestore hade gett en, och `find(r => r.id === x)` svarade med den
gamla. Provet var rött mot en app som var rätt.

Riktningen kan lika gärna bli den andra. En adapter som står in för en annan i
proven måste svara likadant på samma anrop, annars mäter provsviten en app som
inte finns.

### Ändrat

- **`createMemorySource.create` ersätter posten när anropet bär ett eget `id`**,
  precis som `setDoc`. Ersätter, slår inte ihop: en sammanslagning hade dolt en
  bugg där appen skickar en delmängd, alltså fungerat i provet och tappat fält i
  produktionen. Det är `update` som slår ihop. Utan id skapas fortfarande en ny
  post med ett genererat id, precis som `addDoc`.
- **Kontraktet säger nu vad ett eget `id` BETYDER vid `create`.** Det stod
  ingenstans, så båda adaptrarna hade rätt var för sig.

---

## 0.21.0

⛔ **Panelen följde sin egen regel på bred skärm och bröt den på smal.**
Filhuvudet i `OpsPanel` sade redan att panelen ska se ut som menyn, för att den
är samma sak. Men menyn är inte samma yta i båda bredderna: på bred skärm är
den en rullgardin i headern, på smal skärm en sheet i `OpsBottomNav`. Panelen
var en rullgardin i båda.

CP 2026-09-26: "Vill ha notisers funktion med inkorgs utseende. Alltså bara att
det är en egen panel och ingen ful dropdown. Den ser inte ut som i
SessionStudio och är inget nice i mobil."

### Ändrat

- **`OpsPanel` är en sheet under `md` och en rullgardin från `md` och upp.**
  Sheeten är samma yta som `OpsBottomNav`s Meny-sheet ned i detaljerna:
  `85dvh`, rundad överkant, `--safe-bottom`, egen stängknapp. Beteendet är
  oförändrat: samma stack, samma tillbakapil, samma nollställning vid
  stängning.
- **Tre lappar försvann med ytan.** `max-w-[calc(100vw-1.5rem)]`, taket på
  `70vh` och den egna dämpningen `data-ops-panel-scrim` fanns alla för att en
  22 rem bred rullgardin inte fick plats på en telefon. Sheeten har Radix egen
  `Dialog.Overlay` i stället.
- **Nytt fel: `closeLabel`** på `OpsPanel`, skärmläsarnamnet på sheetens
  stängknapp. Förval `"Stäng"`, samma som `OpsBottomNav`.

⛔ **Valet görs i JS och inte med CSS.** Att rendera båda och dölja den ena är
mönstret i `OpsAppShell`, och det duger för en nav. Panelen bär en fokusfälla
och en triggerknapp: två rötter hade gett två fokusfällor, två klockor i DOM:en
och dubbletter i varje `getByRole` hos appen. Utan `matchMedia`, alltså i jsdom
och vid serverrendering, blir det rullgardinen.

### Mätt under arbetet

- `role="dialog"` skiljer **inte** ytorna åt: Radix `Popover.Content` sätter den
  också. Ett prov på rollen var grönt på bred skärm, alltså bevakade det inget.
- `aria-modal` sätts **inte** av Radix `Dialog` här. Provet som utgick från det
  var rött mot en sheet som renderades rätt.
- Det som faktiskt skiljer är behållaren, vilket också är precis det som
  klagomålet handlade om. Proven kontrollerar därför ytans klasser.

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
- **`farger`, alltså om katalogen har färger alls** ([#121](https://github.com/cllp/ops-framework/issues/121)).
  Samma form och samma skäl som `faser`. Slagpaletten har **tre** platser, och
  det är en mätt gräns där en fjärde faller i mörkt läge. Inkorgens **sex**
  sorter kan alltså inte få var sin, och de skiljs redan i dag åt med ikon och
  aldrig med färg, varken i vyn eller i datan. Att kräva en palettplats hade
  tvingat fram dubbletter i ett schema som annars är strikt, och två kategorier
  med samma färg är en färg som slutat betyda något. ⛔ Ikonen krävs fortfarande:
  utan färg bär den hela igenkänningen.
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
- **`OpsKatalogInstallning` ritar varken fasväljare, färgväljare eller prick**
  när katalogen saknar dem, och ingen tom fas-etikett på raden. En rullgardin för något som inte sparas är
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
