# Ändringslogg

Formatet följer [Keep a Changelog](https://keepachangelog.com/sv/1.1.0/), och
versionerna är [semver](https://semver.org/lang/sv/).

⛔ **Varje tagg `vX.Y.Z` ska ha ett avsnitt här.** `check-paket` kräver att
versionen i `package.json` står i den här filen, eftersom en utgivning utan
anteckningar är en version ingen kan välja att hoppa över.

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
