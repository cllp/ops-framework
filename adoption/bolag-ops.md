# Adoption: bolag-ops på ops-framework

**Mottagare:** den agent som arbetar i `cllp/bolag-ops`.
**Skriven:** 2026-09-15, av Claude i ops-framework.
**Status:** plan, inte påbörjad. Ingen rad i bolag-ops är ändrad.

---

## Utgångsläget, mätt 2026-09-15

Inte uppskattat. Siffrorna kommer ur `check-adoption.mjs` körd mot repot.

| | |
|---|---|
| HTML-sidor | **14** (11 riktiga, 3 är redirect-stubbar) |
| Vanilla-JS | **6807 rader**, varav `kostnader.js` ensam är 3169 |
| Egna CSS-klasser | **441** i `components.css`, `base.css`, `tokens.css`, `utilities.css` |
| Hårdkodade hexfärger | **49**, nästan alla i `tokens.css`. Bättre än väntat |
| Tankstreck i sidorna | **118**. Bryter regeln om em-dash och en-dash |
| Byggsteg | inget. `command = "echo 'static site - no build'"` |
| Värd | **oklart, och det spelar mindre roll än det låter.** Se rutan nedan |
| Data | GitHub-issues via serverlösa funktioner |

> ⛔ **Om värden: tre källor säger tre saker, så lita inte på någon av dem.**
> `netlify.toml` ligger kvar i repot, live-svaret bär GitHub Pages-huvuden
> (Fastly), och CP säger Google. Alla tre kan vara sanna samtidigt om filen är
> gammal och något flyttats sedan dess.
>
> **Slutsatsen är inte att utreda det, utan att planen inte får bero på det.**
> Målet är Firebase Hosting, eftersom bolag-ops redan har Firebase och `SETUP.md`
> tar dit. Fas 0 nedan är skriven så att den fungerar oavsett var sidan står i
> dag. Ta reda på värden när du behöver driftsätta, inte innan.

**Arkitekturen är redan vår.** `tokens.css`, `base.css`, `components.css`,
`utilities.css` är exakt ramverkets lagerindelning, framtagen oberoende. Det här
är alltså ingen omskrivning av hur sidan stylas. Det är en omdöpning plus ett
beslut om byggsteg.

---

## Tre principer, och den första är viktigast

### 1. Flytta aldrig skräpet

En sida som flyttas **skrivs om mot primitiver**, och dess gamla CSS raderas i
**samma commit**. Aldrig "flytta nu, städa sen". "Sen" är permanent.

Konkret: när `kontakter.html` blir en React-vy ska `.kontakt-*`-klasserna vara
borta ur `components.css` innan commiten går in. Går de inte att ta bort är
sidan inte flyttad, den är kopierad.

### 2. En migration i taget

**UI till ramverket är EN sak. Data till Firebase är en ANNAN.**

Görs de samtidigt landar ingetdera, och när något går sönder går det inte att
avgöra vilken av de två som orsakade det. Den här planen rör **bara** UI:t. Data
ligger kvar där den ligger tills UI:t är klart, och flyttas sedan som ett eget
arbete.

**Inloggningen är däremot en tredje sak, och den får komma tidigt.** Bolag-ops
har redan Google Auth och Firebase, så `OpsAuthProvider` och `OpsAuthGate` kan
kopplas in i fas 0 utan att en enda rad data flyttar. Auth svarar på vem du är,
datalagret på var sakerna bor, och de två behöver inte bytas samtidigt. Se
`SETUP.md` steg 5.

⛔ Läs steg 6 i `SETUP.md` innan du kopplar in grinden. `OpsAuthGate` styr vad
som RENDERAS. Finns inte reglerna publicerade är appen öppen oavsett hur grinden
ser ut, och en grind som ser ut att skydda något är värre än ingen.

### 3. Taket sjunker, det nollställs aldrig

Lägg `adoption.json` i repo-roten med **dagens** siffror som tak, och kör
`check-adoption.mjs` i grinden.

⛔ Sätt aldrig ett tak till noll direkt. Då blir allt rött på en gång, ingen
hinner laga det, och inom en vecka är vakten avstängd. Då är läget sämre än
innan, för nu finns dessutom en avstängd vakt som ser ut att skydda något.

```json
{
  "matningar": [
    { "namn": "gamla HTML-sidor", "katalog": "web", "andelser": [".html"], "tak": 14 },
    { "namn": "gammal vanilla-JS", "katalog": "web/assets/js", "andelser": [".js"], "monster": "^.*$", "tak": 6807 },
    { "namn": "egna CSS-klasser", "katalog": "web/assets/css", "andelser": [".css"], "monster": "^\\.[a-z][a-z0-9_-]*", "tak": 441 },
    { "namn": "hardkodade hexfarger", "katalog": "web/assets", "andelser": [".css", ".js"], "monster": "#[0-9a-fA-F]{3,8}\\b", "tak": 49 },
    { "namn": "tankstreck", "katalog": "web", "andelser": [".html"], "monster": "—|–", "tak": 118 }
  ]
}
```

Efter varje flyttad sida: `node .../check-adoption.mjs adoption.json --skarp`.

---

## Faserna

### Fas 0. Skalet bredvid det gamla

Sätt upp Vite, React och ramverket **utan att röra en enda befintlig sida**.

```
node create-ops-app/bin/create-ops-app.mjs bolag-ops-web --framework file:../ops-framework
```

Flytta in resultatet i repot. De gamla sidorna ska fortsätta fungera på sina
nuvarande adresser hela vägen genom migrationen, annars går länkar sönder för
den som använder verktyget medan det byggs om.

⛔ **Det här är det enda i planen som jag inte har provat.** Tanken är att peka
Vites `publicDir` mot `web/` så att de gamla filerna kopieras oförändrade till
`dist`, och låta värden publicera `dist`. Konflikten att lösa är `index.html`:
Vite äger rotens, och den gamla startsidan behöver byta namn eller ersättas av
React-vyn direkt.

Verifiera innan du bygger vidare på det:

```
npm run build && ls dist && test -f dist/kostnader.html && echo "gamla sidor kopierade"
```

Fungerar det inte: **säg det i stället för att bygga runt det.** Alternativet är
två siter under en övergångsperiod, vilket är fult men ärligt.

### Fas 1. `lankar.html` först, för att bevisa kedjan

65 rader, ingen JavaScript, ett rutnät av länkar. Den är vald för att den är
tråkig. Den första flytten ska bevisa att bygget, tokens, primitiverna, grinden
och Netlify hänger ihop, inte att du kan lösa ett svårt problem.

Klar när: sidan renderas med `OpsView`, `OpsCard` och `OpsList`, de gamla
`.links-*`-klasserna är borta ur `components.css`, och `check-adoption` visar
minst två siffror som sjunkit.

### Fas 2. De enkla sidorna

`kontakter.html`, `forsakringar.html`, `process.html`, `schema.html`,
`sok.html`. Här börjar primitiverna få arbeta på riktigt: `OpsTable`,
`OpsTag`, `OpsEmpty`, `OpsField`.

De tre redirect-stubbarna (`schema-viktiga-datum.html`,
`process-wint-fortnox.html`, `jamforelse-wint-fortnox.html`) blir `<Navigate>`
i routern och kan raderas.

### Fas 3. De tunga men avgränsade

`oversikt.html` (563 rader JS), `pension.html` (661), `jamforelse.html` (248).

`economy-model.js` (589 rader) är **beräkningslogik, inte UI**. Den ska följa med
i stort sett oförändrad. Frestelsen att skriva om den samtidigt är stark och ska
motstås: en omskriven beräkning och ett omskrivet UI i samma commit går inte att
felsöka.

### Fas 4. `kostnader` sist

3169 rader JS och den mest använda sidan. Den ska flyttas när allt annat är
flyttat och du vet exakt vad ramverket klarar. Dyker det upp något den behöver
som inte finns: **lägg till det i ramverket**, hitta inte på en lokal lösning på
mållinjen.

### Fas 5. Ta bort resten

`components.css` ska vara nära tom. Är den inte det betyder det att någon fas
kopierade i stället för att flytta, och då är det den fasen som ska göras om.

---

## Vad som är skräp, och varför

Det här är inte kritik av den som byggde sidan. Det är sådant som bara går att se
när man har något att jämföra med.

| Finns i dag | Ska bli | Varför |
|---|---|---|
| 25 klasser `.tag-pill--mat`, `--bil`, `--ica`, `--systembolaget` | `<OpsTag label="Mat" />` | En klass per datavärde betyder kodändring för varje ny kategori, och tjugofem färger valda en och en utan att någon såg dem tillsammans |
| `--gold`, `--limestone`, `--slate`, `--bright` | roller: `accent`, `ink`, `ink-secondary` | Ett namn som beskriver färg ljuger så fort färgen byts. SessionStudio har 148 tokens som heter `gold` och är gräddvita |
| `.role-dot` | `<OpsProvenance kind="human" />` | En färgad prick går inte att läsa upp och säger inget till den som inte lärt sig koden |
| `.kpi-*`, `.oversikt-kpi-grid` | `<OpsStat />` + `grid` i Tailwind | Rutnätet är layout, rutan är en komponent |
| `.table-wrap`, `.cost-table-block` | `<OpsTable />` | Egen scroll i sidled, `tabular-nums` i beloppskolumner |
| `.banner`, `.banner-warn`, `.overlap-banner` | `<OpsBanner />` | Rollen ska växla med tonen, annars slutar användaren lita på avbrotten |
| `.search-empty`, `.cost-history-empty` | `<OpsEmpty />` | Tomt och laddande är olika saker och ser likadana ut |
| 118 tankstreck | bindestreck, komma eller punkt | Regel #-3 |

---

## Vad som INTE ingår

- **Att flytta datan till Firestore.** Se princip 2. Inloggningen är undantaget
  och får komma tidigt, eftersom den inte rör var datan bor.
- **Att bygga om `economy-model.js`.** Beräkningen är inte UI.
- **Att ändra vad sidorna visar.** Den här migrationen får inte smyga in
  produktändringar, för då går det inte att se om något gått sönder.

---

## Identiteten behålls. Den är en konfiguration, inte en gaffel

**CP har svarat:** bolag-ops ska behålla sitt utseende. Mörk botten,
antikvarubriker, guld accent, och igenkänningen mellan AB och PRIVAT. Det var
tidigare ett öppet beslut i den här filen. Det är det inte längre.

Det betyder **inte** att du får skriva egen CSS. Hela poängen med ramverket är
att en plattform ska kunna låta som sig själv utan att gaffla en enda komponent.
Fyra hävstänger räcker, och alla fyra är rader i `src/index.css` eller props.

### 1. Antikvan i rubrikerna

```css
/* src/index.css */
@theme static {
  --font-display: Georgia, "Iowan Old Style", "Times New Roman", serif;
}
```

Det är allt. `OpsViewHeader` och `OpsBrand` använder `font-display`, brödtexten
använder `font-sans` och ändras inte. ⛔ Rör INTE `--font-sans`: gör du det
byter tabeller, fält och knappar typsnitt också, och en antikva i en tät
sifferkolumn blir svårläst.

### 2. Guldet

```css
@theme static {
  --color-accent: <guld för ljus botten>;
  --color-accent-hover: ...;
  --color-accent-contrast: ...;
  --color-accent-subtle: ...;
  --color-accent-faint: ...;
}
:root {
  --dark-accent: <guld för mörk botten>;
  --dark-accent-hover: ...;
  --dark-accent-contrast: ...;
  --dark-accent-subtle: ...;
  --dark-accent-faint: ...;
}
```

⛔ **Sätt hela femman, inte bara `--color-accent`.** Ett ensamt accentbyte ger
en guldknapp med ramverkets gröna hovring, och det ser ut som en bugg för att
det är en.

⛔ **Två värden, inte ett.** `#c9a84c` på vit botten klarar knappt läsbarhet som
text. Mät kontrasten mot både `--color-canvas` och `--dark-canvas` innan du
låser dem. Bolag-ops är mörk-först i dag, och det är precis därför det ljusa
värdet är det som blir fel utan att någon märker det.

> **Om guldförbudet.** SessionStudios regelbok säger att `#c9a84c` är permanent
> borttagen. Den regeln gäller **SessionStudio**, inte bolag-ops. Guldet ÄR
> bolag-ops identitet, och två produkter får se olika ut. Det som inte får
> skilja sig är arkitekturen. Att båda kan få sin färg genom att sätta samma
> fem tokens är beviset för att ramverket fungerar, inte ett undantag från det.

### 3. Mörk botten som standard

Ramverket har tre lägen: ljust, mörkt och följ systemet. Vill bolag-ops att den
som aldrig valt något ska få mörkt, sätt `data-theme="dark"` i `index.html`.
Användarens eget val via `OpsThemeToggle` vinner ändå.

⛔ Ta inte bort ljust läge för att appen "alltid är mörk". Ljust läge kostar
ingenting när tokens är på plats, och den dag någon sitter i solen med en
telefon är det enda som fungerar.

### 4. AB mot PRIVAT

```jsx
const SPARTON = { AB: 4, PRIVAT: 2 };   // 4 = blå, 2 = guld
<OpsTag label={rad.spar} tone={SPARTON[rad.spar]} />
```

Den låsta tonen finns just för det här fallet. Skillnaden avgör **vems pengar en
rad gäller**, och det är precis det fel plattformen finns för att förhindra. En
sådan färg får inte falla ut ur en hash, där två livsviktigt olika kategorier kan
landa på samma ton, och den får inte flytta sig den dag någon skriver "Privat" i
stället för "PRIVAT".

⛔ Kartan ska vara en handfull rader. Växer den förbi det har appen börjat bygga
en egen palett igen, och då är vi tillbaka i de tjugofem `.tag-pill--*`-klasserna.

### 5. Toppraden

```jsx
<OpsAppShell brand={<OpsBrand title="Operations Hub" subtitle="CPS AB" />} ... />
```

Märket, produktnamnet och ägarraden finns i ramverket och byter automatiskt
mellan mörkt och ljust utförande. ⛔ Kopiera inte in en egen logotypfil i
bolag-ops. Det är så två original uppstår, och SessionStudio har redan en
handritad `phst-logo.svg` som föreställer fel märke som bevis på hur det slutar.

### Vad som INTE får göras för att behålla utseendet

- Egen CSS-fil med `.bolag-*`-klasser
- `className` in i en primitiv. Går inte, vaktat, och det är meningen
- En lokal kopia av `OpsViewHeader` eller `OpsCard`

Saknas något för att träffa utseendet: **lägg till det i ramverket** och pinna
om. Det tar en timme och ger alla plattformar samma sak. En lokal gaffel tar tio
minuter och kostar för alltid.

---

## Grinden

Lägg till i appens `npm run gate`:

```
node node_modules/@staiger/ops-framework/scripts/check-token-overrides.mjs src/index.css
node node_modules/@staiger/ops-framework/scripts/check-closed-api.mjs src
node node_modules/@staiger/ops-framework/scripts/check-adoption.mjs adoption.json
```

Och läs ramverkets regler där de bor, kopiera dem aldrig hit:

```
node_modules/@staiger/ops-framework/CLAUDE.md
node_modules/@staiger/ops-framework/skills/
```
