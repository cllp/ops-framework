# ops-framework

Det gemensamma fundamentet för Staigers ops-plattformar. Färg- och formsystem,
färdiga byggdelar, arbetsregler och vakter, så att `bolag.ops.staiger.se`,
`tam.ops.staiger.se` och det som kommer sedan ser likadana ut, fungerar likadant
och följer samma regler, utan att grovjobbet görs om varje gång.

## Hur det funkar, i tre meningar

**Varje ops-plattform installerar ramverket som ett beroende och bygger sina
sidor av färdiga delar, så att knapp, tabell, fält och färg kommer från ett enda
ställe i stället för att uppfinnas på nytt i varje app.**

**Ingen del går att färga om eller tänja på anropsstället, så när något saknas är
den enda vägen att lägga till det i ramverket, och då får alla plattformar det
samtidigt.**

**Att reglerna faktiskt följs är inte en fråga om disciplin utan om mekanik:
tjugonio vaktregler blir röda före push, och var och en av dem är bevisad genom att
den gått att göra röd med flit.**

---

## Vad problemet är

Tre plattformar som byggs var för sig blir tre produkter. Inte för att någon
slarvar, utan för att varje enskilt beslut är rimligt: en knapp här behöver vara
lite bredare, en färg där är nästan rätt, en lista behöver en variant till. Varje
avvikelse är liten och summan är att ingenting hänger ihop.

Det som stoppar det är inte dokumentation. **Det är att den enkla vägen också är
den rätta**, och att avvikelser blir röda i stället för att bara vara olämpliga.
Därför ligger tyngdpunkten här på ett stängt API och på vakter, inte på en
stilguide.

## De två halvorna

| Konsumeras, får inte divergera | Kopieras en gång, får divergera |
|---|---|
| tokens (`tokens/tokens.css`) | appskal, routes, vyer |
| primitiverna och deras stängda API | domänmodell, allt affärsnära |
| arbetsreglerna (`CLAUDE.md`) och skills | ESLint-konfig, CI, grinden |
| vakterna | konfiguration och env |

Regeln är enkel: **ska det se likadant ut i alla appar, konsumeras det. Får det
bli olika, kopieras det.**

---

## Arkitektur och strategi

### Vad det är för sorts sak

Ett **designsystem som paket**, inte en stilguide. Skillnaden är att en stilguide
beskriver hur något borde se ut, medan det här levererar koden som gör det, och
gör avvikelser omöjliga i stället för olämpliga.

Fem val bär arkitekturen, och vart och ett kan sammanfattas i en mening:

| Val | Vad det betyder | Varför |
|---|---|---|
| **Stängt komponent-API** | ingen primitiv tar `className`, `style` eller `...rest` | Rörig CSS orsakas av kryphål, inte av teknikval. Ett kryphål används alltid, av alla, under press |
| **Tema i CSS, inte i config** | `tokens/tokens.css` ÄR Tailwind-temat | I Tailwind 3 hade tema och tokens varit två filer som beskriver samma faktum. Två original glider isär, alltid |
| **Lånat beteende, ägt utseende** | Radix ger dialog, väljare och flikar. Vi ger klasser och tokens | Fokusfälla och tangentbordsnavigering är veckor att bygga och osynligt fel tills någon slutar använda musen |
| **Mekanism före dokumentation** | åtta vakter i grinden, 25 regler bevisade röda | En regel som bara står i ett dokument följs inte. Det är mätt, inte en åsikt |
| **Konsumera, inte kopiera** | tokens, primitiver, regler och vakter är ett beroende | En ändring i ramverket ska nå alla appar utan att någon rör deras kod |

### Lagren

```
tokens/tokens.css        värdena. En sanning, som också är Tailwinds tema
        ↓
src/components/          primitiverna. Stängt API, lånat beteende
        ↓
appens vyer              layout med Tailwind, delar från ramverket
        ↓
appens domänkod          data, affärslogik, behörighet. INTE ramverkets sak
```

Gränsen mellan tredje och fjärde lagret är avsiktlig: **ramverket kan hantverk,
inte domän.** En tidrapportrad eller ett kvittokort hör hemma i sin app, för
frågan "skulle den här komponenten betyda något i den andra plattformen?" är nej.

### Teknikval

| | | Varför just den |
|---|---|---|
| React 18 | komponentmodell | samma som SessionStudio, ingen ny inlärning |
| Vite 6 | bygge | snabbt, och Tailwinds plugin är förstahandsstöd |
| Tailwind 4 | utseende | temat konfigureras i CSS, vilket är hela skälet |
| Radix | beteende | headless, bara det som är dyrt att bygga själv |
| JS + JSDoc + `tsc --checkJs` | typer | typad yta utan TypeScript-byggkedja, `.d.ts` följer med |
| esbuild | paketering | Vite transformerar inte JSX i `node_modules`, så vi bygger en gång |
| Vitest | tester | beteende, aldrig klassnamn |

⛔ **Inget ikonberoende.** Ramverket har tre egna SVG:er för sina egna behov.
Appen väljer sin uppsättning, och ett ramverk som drar in ett helt ikonbibliotek
för tre pilar tvingar på alla konsumenter en dependency de inte bad om.

### Hur en ändring sprider sig

1. Något saknas i en app.
2. Det läggs till i **ramverket**, aldrig lokalt.
3. Ny tagg.
4. Apparna bumpar när de vill ha den. Ingen tvingas, ingen hamnar efter i tysthet.

Versionen är en **git-tagg**, inte npm, eftersom repot är privat:

```json
"@staiger/ops-framework": "github:cllp/ops-framework#v0.1.0"
```

npm kör ramverkets `prepare` vid installation, alltså bygger bundle och typer åt
sig själv. Byggkedjan behöver läsrättighet till repot.

### Strategin för att rensa upp i något befintligt

**Ett tak som bara får sjunka.** Mät dagens siffror, lås dem, låt dem gå ner.

⛔ Sätt aldrig ett tak till noll direkt. Då blir all befintlig kod röd på en
gång, ingen hinner laga den, och inom en vecka är vakten avstängd eller
kringgången. Då är läget sämre än innan, för nu finns dessutom en avstängd vakt
som ser ut att skydda något.

---

## Vad du får

### Tokens

193 värden i `tokens/tokens.css`, som **är** Tailwind-temat och inte en kopia
bredvid det.

| Grupp | Vad den svarar på |
|---|---|
| `canvas`, `surface`, `raised`, `sunken`, `scrim` | vilken yta står detta på |
| `ink`, `ink-secondary`, `ink-muted`, `ink-inverse` | textnivå |
| `line`, `line-strong`, `divider` | var slutar en yta |
| `accent`, `accent-hover`, `accent-subtle`, `accent-faint` | produktens hand |
| `success`, `warning`, `danger`, `info` (+ `-bg`) | vad betyder detta för användaren |
| `identity-1` .. `identity-6` | vem hör detta till |
| `human`, `agent`, `auto` (+ `-bg`) | vem producerade det |
| `--spacing`, `radius-*`, `shadow-*`, `text-*`, `font-*` | rytm och form |
| `--z-*`, `--safe-*`, `--duration-*`, `ease-*` | lager, säkra ytor, rörelse |

Mörkt läge har tre tillstånd: valt ljust, valt mörkt, och inte valt. Paletten för
mörkt deklareras **en gång**; blocken som aktiverar den får bara peka.

### Komponenter

**34 komponenter.** Alla har ett stängt API: ingen tar emot `className`, `style`
eller `...rest`. Ett okänt värde kastar med läsbar text i stället för att rendera
något godtyckligt.

#### Åtgärder och ytor

| Komponent | Props |
|---|---|
| `OpsButton` | `variant` primary \| secondary \| ghost \| danger, `size` sm \| md, `type`, `disabled`, `busy`, `fullWidth`, `iconOnly`, `href`, `newTab`, `ariaLabel`, `title`, `id`, `onClick`, `children` |
| `OpsCard` | `tone` raised \| sunken \| plain, `elevated`, `flush`, `id`, `children` |
| `OpsView` | `width` narrow \| normal \| wide \| full, `children` |
| `OpsViewHeader` | `title`, `description`, `actions` |
| `OpsModal` | `open`, `onOpenChange`, `title` (krävs), `description`, `size` sm \| md \| lg, `footer`, `closeLabel`, `children` |

#### Formulär

| Komponent | Props |
|---|---|
| `OpsField` | `label`, `hint`, `error`, `required`, `children` |
| `OpsInput` | `value`, `onChange`, `type` text \| email \| search \| tel \| url \| password \| number, `placeholder`, `name`, `autoComplete`, `disabled`, `readOnly`, `maxLength`, `ariaLabel` |
| `OpsTextarea` | `value`, `onChange`, `placeholder`, `name`, `rows`, `disabled`, `maxLength`, `ariaLabel` |
| `OpsSelect` | `options` [{value, label, disabled}], `value`, `onChange`, `placeholder`, `disabled`, `ariaLabel` |
| `OpsDatePicker` | `value` ISO-datum, `onChange`, `placeholder`, `disabled`, `ariaLabel`, `clearLabel` |
| `OpsCheckbox` | `label`, `checked`, `onChange`, `disabled`, `hint` |
| `OpsSwitch` | `label`, `checked`, `onChange`, `disabled`, `hint` |

#### Data

| Komponent | Props |
|---|---|
| `OpsList` | `divided`, `ariaLabel`, `children` |
| `OpsListRow` | `interactive`, `selected`, `href`, `onClick`, `ariaLabel`, `children` |
| `OpsTable` | `columns` [{key, label, numeric, tight}], `rows`, `caption` (krävs), `hideCaption`, `stickyHeader`, `empty` |
| `OpsStat` | `label`, `value`, `hint`, `tone` neutral \| success \| warning \| danger, `badge` |
| `OpsEmpty` | `title`, `description`, `action`, `busy`, `busyLabel` |
| `OpsSpinner` | `size` sm \| md \| lg, `tone` current \| accent \| muted, `label`, `decorative` |

#### Märkning

| Komponent | Props |
|---|---|
| `OpsPill` | `tone` neutral \| success \| warning \| danger \| info, `children` |
| `OpsTag` | `label` (bestämmer också tonen), `tone` 1-6 (låser tonen), `onRemove`, `removeLabel` |
| `OpsIdentity` | `name`, `seed` (krävs, stabilt id), `imageUrl`, `size` sm \| md \| lg |
| `OpsProvenance` | `kind` human \| agent \| auto, `label` |

#### Navigering och meddelanden

| Komponent | Props |
|---|---|
| `OpsAppShell` | `brand` (sträng eller `OpsBrand`), `nav` [{href, label, icon?, badge?, children?}], `activeHref`, `onNavigate`, `actions`, `menuLabel`, `navLabel`, `children` |
| `OpsBottomNav` | `nav` [{href, label, icon?, badge?, children?}], `activeHref`, `onNavigate`, `menuLabel`, `navLabel`, `sheetLabel`, `closeLabel`, `badgeText`. Fast bottenrad under `md`, högst fem platser, Meny sist öppnar en sheet. Renderas av `OpsAppShell` men kan användas fristående |
| `OpsBrand` | `title` (krävs), `subtitle`, `mark` phst \| phst-estd \| none |
| `OpsTabs` | `tabs` [{id, label, disabled}], `value`, `onChange`, `ariaLabel` (krävs), `children` |
| `OpsTabPanel` | `id`, `children` |
| `OpsBanner` | `tone` info \| success \| warning \| danger, `title`, `action`, `onDismiss`, `dismissLabel`, `children` |
| `OpsToastProvider` | `children`, `closeLabel`. Läggs en gång, högst upp |
| `useOpsToast` | `visa({ title, description, tone })` |
| `OpsTooltip` | `content`, `side`, `children` |
| `OpsThemeToggle` | `ariaLabel`, `labels` {system, light, dark} |

#### Vad var och en gör som du annars fått bygga själv

| | |
|---|---|
| `OpsButton` | spärrad länk tappar sitt `href`, så den försvinner ur tabordningen |
| `OpsModal` | fokusfälla, Escape, scrollås, fokus tillbaka till öppnande knapp |
| `OpsField` | kopplar etikett, hjälptext och fel till fältet med genererade id |
| `OpsInput` | vägrar `type="date"` och `type="color"`, som inte går att tokenisera |
| `OpsSelect` | tangentbord, typeahead och positionering, via Radix |
| `OpsList`, `OpsTable` | rader utan fast höjd, tabell med egen scroll i sidled |
| `OpsTable` | `tabular-nums` i sifferkolumner så belopp linjerar |
| `OpsStat` | `tabular-nums` så ett tal som ändras inte hoppar i bredd |
| `OpsEmpty` | skiljer tomt från laddande, som ser likadant ut men betyder motsatsen |
| `OpsSpinner` | EN väntesymbol, som annonserar för skärmläsare utan att göra det två gånger |
| `OpsTag` | härleder tonen ur etiketten, så ny kategori kräver ingen kod |
| `OpsBrand` | byter märke med temat, inte med systemets inställning |
| `OpsThemeToggle` | tre lägen, så "följ systemet" inte försvinner |
| `OpsIdentity` | initialer som inte klipper mitt i ett tecken |
| `OpsBanner` | `role="alert"` bara för det som ska avbryta |
| `OpsTabs` | piltangenter, Home, End och koppling flik till panel |
| `OpsBottomNav` | fast bottenrad utan att sidan hoppar, säker yta i botten, Meny-sheet med fokusfälla och ur DOM när stängd |

### Datalager

Ett CRUD-kontrakt med utbytbara adaptrar. **Vyerna vet aldrig var datan kommer
ifrån**, så källan är ett byte av en rad vid uppstarten: JSON i repot i dag,
Firestore i morgon, SQL bakom ett API sedan.

| | |
|---|---|
| `skapaDatakalla(adapter)` | tar en adapter, vägrar en som saknar en operation |
| `skapaMinneskalla(start)` | allt i minnet. Tester, utveckling, och innan källan bestämts |
| `skapaJsonKalla({ bas })` | läser JSON-filer över HTTP. Läsbar, inte skrivbar |
| `tillampaFraga(rader, fraga)` | filtrering, sortering och gräns för adaptrar som håller allt i minnet |
| `OPERATIONER` | `las`, `lista`, `skapa`, `uppdatera`, `taBort` |
| `skapaFirestoreKalla({ db, sdk })` | Firestore. SDK:n skickas in, ramverket importerar den aldrig |
| `skapaPostgresKalla({ fraga })` | Postgres, till exempel Cloud SQL. Appen skickar in en funktion som kör frågan |
| `OpsDataProvider` | ger appen sin källa |
| `useDatakalla`, `useSamling`, `useDokument` | React-sidan, med `laddar`, `fel` och `data` åtskilda |

Fyra regler gör kontraktet värt något:

1. **Allt är asynkront**, även minnesadaptern. Kontraktet får inte avslöja hur
   snabb källan råkar vara, för då skrivs anropsställen som går sönder vid byte.
2. **Fel kastas, de returneras aldrig som tomhet.** `fetch` kastar inte på 500,
   så utan den regeln visar appen "inga träffar" när den inte kunde fråga.
3. **`las` ger `null` för "finns inte", vilket inte är ett fel.** Skillnaden mot
   "kunde inte fråga" måste gå att hantera olika.
4. **Varje post har ett `id`.** Utan en gemensam nyckel kan delad kod inte veta
   vad som identifierar en rad.

⛔ **Ingen cache och ingen realtid, med avsikt.** Ett arbetsverktyg behöver färsk
data när man tittar på det, inte data som strömmar in medan man läser.

⛔ Den regel som avgör om datalagret är värt något är inte kontraktet utan
`check-data-layer`: **en databas-SDK får bara importeras i en adapter.** Alla
bygger ett datalager, och nästan alla får det förstört på samma sätt, nämligen
att en enda vy anropar något källspecifikt "bara den här gången".

### Inloggning och roller

Google Auth via Firebase, med samma mönster som datalagret: **ramverket
importerar ingen auth-SDK**, appen skickar in den.

| | |
|---|---|
| `skapaGoogleAuth({ auth, sdk, hamtaProfil })` | Google-inloggning. `hamtaProfil` läser appens egen användarlista och ger `roll` |
| `skapaAutentisering(adapter)` | för en egen inloggning |
| `OpsAuthProvider`, `useOpsAuth` | inloggat konto, `laddar`, `fel`, `loggaIn`, `loggaUt` |
| `OpsAuthGate` | visar sitt innehåll för den som är inloggad och har rätt roll |

Rollen kommer **aldrig** från Google. Google svarar på vem någon är, inte på vad
hen får göra. Rollen läses ur appens egen användarlista, alltså ett dokument per
användare via datalagret.

⛔ **`OpsAuthGate` är inte säkerhet.** Den bestämmer vad som RENDERAS, ingenting
om vad som går att läsa eller skriva. Vem som helst kan öppna utvecklarverktygen
och fråga databasen direkt. Skyddet måste ligga där datan bor: i
Firestore-reglerna eller i API:et framför Postgres. Att tro något annat är exakt
så läckor uppstår.

⛔ Misslyckas profiluppslagningen loggas användaren in **utan** roll, inte in med
en gissad. Ett fel i en uppslagning får aldrig ge mer behörighet än en som
lyckades.

### Typer

Ramverket är JavaScript med JSDoc, inte TypeScript, men typerna **kontrolleras**
med `tsc --checkJs` och skickas med som `.d.ts`.

Följden för den som bygger en app: `variant="primary"` autocompletar, och
`variant="fancy"` blir rött **i editorn**, innan någon vakt hinner säga något.
Det stängda API:et blir alltså synligt där koden skrivs.

⛔ Otypkontrollerade JSDoc-typer är kommentarer, och kommentarer glider från
koden. När kontrollen slogs på hittade den fem fel på en gång, varav två var
riktiga latenta buggar: ett uppslag som kunde ge `undefined` och tyst rendera ett
element utan bakgrundsfärg, och ett formateringsval som inte längre
typkontrollerades.

### Hjälpare

| | |
|---|---|
| `formatCurrency`, `formatNumber`, `formatPercent` | svensk formatering via `Intl` |
| `formatDate`, `formatDateTime` | rena datum visas som rätt dag, inte dagen innan |
| `getTheme`, `setTheme`, `initTheme` | ljust, mörkt, följ systemet |
| `identityTone`, `initials`, `ANTAL_IDENTITETSTONER` | deterministisk ton och initialer som inte klipper tecken |
| `SAKNAS` | vad som visas när ett värde saknas. Aldrig `0`, som är ett påstående om datan |
| `TALMELLANSLAG` | strippar det mellanslag `Intl` stoppar i tal. Vilket tecken det är beror på Node-versionen, så det får aldrig hårdkodas |

### Vakter

| Vakt | Vad den bevisar |
|---|---|
| `check-types` (`tsc --checkJs`) | JSDoc-typerna kontrolleras, och `.d.ts` följer med paketet |
| `check-docs` | varje exporterat namn och varje vakt är omnämnd i README, och antalet komponenter stämmer |
| `check-tokens` | sju regler i tokenkontraktet, plus golv mot fel fil |
| `check-exports` | den publika ytan stämmer med modulerna, inget internt läcker |
| `check-closed-api` | ingen primitiv tar `className`, ingen app lappar, ingen ad-hoc-färg |
| `check-css-build` | bygger CSS på riktigt och läser i resultatet |
| `check-token-overrides` | en konsumentapps stilrot följer kontraktet |
| `check-scaffold` | en app skapas, installeras och kör sin egen grind |
| `check-data-layer` | en databas-SDK importeras bara i en adapter, aldrig i en vy |
| `check-adoption` | en pågående upprensning går framåt, aldrig bakåt |
| `test-guards` | **bryter varje regel ovan och kräver rött** |

⛔ Den sista är inte en extra finess. **En vakt ingen sett faila är en
förhoppning.** Vi har haft vakter som var gröna i månader för att de läste fel
fil, jämförde en lista mot en kopia av sig själv, eller blev gröna av tom indata.

---

## Så kommer ett projekt igång

```bash
node create-ops-app/bin/create-ops-app.mjs min-app --framework file:../ops-framework
cd min-app
npm install
npm run dev
```

Öppna `/primitiver`. Där ligger hela utseendet i en enda vy, och växlaren uppe
till höger visar båda temalägena.

Det ger dig en app som kör mot minnet. **Ska den ha riktig inloggning och riktig
data: följ [`SETUP.md`](SETUP.md)**, som tar dig hela vägen genom Google-projekt,
roller och säkerhetsregler, och som säger rakt ut vilka steg som går att scripta
och vilka fyra som bara går att klicka.

⛔ Pinna ramverket till en commit-SHA eller en tagg i appens `package.json`,
aldrig till `main`. Pekar du på `main` ändras appens utseende den dag någon annan
pushar, och du får reda på det av en användare.

### De fyra filer som är dina

| | |
|---|---|
| `src/index.css` | appens profil. Bara **värden**, aldrig struktur |
| `src/app/views/` | vyerna |
| `src/lib/` | appens egna hjälpare |
| `src/app/App.jsx` | routes och skal |

### Sätt appens färg

```css
/* src/index.css */
@theme static {
  --color-accent: #2f5d8a;
}
:root {
  --dark-accent: #7fb0d9;
}
```

⛔ Skriv **aldrig** ett eget `:root[data-theme="dark"]`-block i appen. Ramverkets
block pekar redan på `--dark-*`, och ett eget block blir det andra originalet som
glider isär. Vakten stoppar det.

### Före varje push

```bash
npm run gate
```

Den lokala grinden är **golvet**, inte ett komplement till CI.

---

## Så används ramverket

### Tailwind för layout, primitiver för komponenter

Layout är per skärm och ska vara fri: `flex`, `grid`, `gap-4`, `md:grid-cols-2`.
En layoutkomponent per sidform blir bara ett sämre CSS med fler namn.

Komponenter bär identitet och är stängda. Det är dem användaren känner igen som
produkten, så varje avvikelse där kostar något.

```jsx
<div className="grid gap-4 md:grid-cols-3">   {/* layout: Tailwind */}
  <OpsStat label="Omsättning" value={formatCurrency(1284000)} />
  <OpsStat label="Marginal" value="18 %" tone="success" />
</div>
```

### Ingen primitiv tar emot className

Inte som prop, inte som spread, inte "bara den här gången". Behöver du något som
inte finns: **utöka primitiven**, lappa inte på anropsstället.

Det är den enda regeln som håller ihop resten. Så fort en komponent tar emot
godtyckliga klasser lägger varje anropsställe på tre utilities, och efter tre
månader beskriver ramverket inte längre vad som faktiskt renderas.

### Värden kommer ur tokens

`text-ink-secondary`, aldrig en hex. Tailwinds egen palett **finns inte**:
`--color-*: initial` i temat gör att `bg-red-500` slutar existera vid bygget.

Godtyckliga värden som `bg-[#abc123]` överlever ändå bygget. Det är mätt, inte
antaget, och därför stoppas de i källkoden av `check-closed-api` i stället.

### Aldrig interpolerade klassnamn

`bg-identity-${n}` genererar ingen CSS. Tailwind läser källkoden som text. Skriv
ut varianterna i en uppslagstabell.

---

## Vad som INTE finns, med flit

| Saknas | Varför |
|---|---|
| Firestore-regler och SQL-behörigheter | ramverket kan inte veta vem som får se vad. Det är ett produktbeslut, och det är där det riktiga skyddet ligger |
| Beroenden på `firebase` och `pg` | adaptrarna finns, men SDK:n skickas in av appen. Ett ramverk som drar in en databasdrivrutin tvingar på den varje plattform |
| Skelettladdning | `OpsEmpty busy` täcker det grova fallet. Skelett är polish |
| Diagram | datavisualisering är ett eget hantverk och hör inte hemma i en komponentlåda |
| i18n | ramverkets få egna strängar är svenska och går att skicka in som props. Blir det fler språk är det en riktig fråga, inte en parameter |

Listan är lika viktig som innehållsförteckningen. **Ett ramverk som låtsas täcka
allt får folk att böja det i stället för att utöka det.**

---

## Att lägga till i ramverket

Ser du dig själv skriva markup i en app som borde vara en primitiv: det är inte
en genväg, det är en lucka som ska lagas här.

1. **Ny variant före ny komponent.** Behövs en femte knappvariant är frågan först
   om en av de fyra var fel.
2. **Ny token läggs i `tokens/tokens.css`**, med både ljust värde och `--dark-*`.
   Namnge efter roll, aldrig efter färg.
3. **Ny primitiv** får ett stängt API, kastar med läsbar text vid okänt värde,
   och en rad i `check-css-build`:s lista över klasser som måste genereras.
4. **Test på beteende, inte på klassnamn.** Ett test som påstår att knappen har
   `bg-accent` går sönder vid varje omstyling och säger inget om funktionen.
5. **En rad i katalogvyn** (`/primitiver`), annars hittar ingen den.
6. **Ny vaktregel får en mutation** i `test-guards.mjs`. Utan den är den oprövad.

```bash
npm run check       # bygg, alla vakter, mutationsprov och tester
npm run check:all   # samma, plus en app som skapas och installeras på riktigt
```

---

## Struktur

| | |
|---|---|
| `CLAUDE.md` | arbetsreglerna. Läses alltid. Varje regel bär händelsen som skapade den |
| `skills/<namn>/SKILL.md` | laddas vid behov, inte allt på en gång |
| `tokens/tokens.css` | tokenkontraktet, som är Tailwind-temat |
| `src/components/` | primitiverna |
| `src/lib/` | tema, identitet, formatering |
| `scripts/` | vakterna |
| `create-ops-app/` | mallen som kopieras en gång |
| `adoption/` | planer för att flytta en befintlig plattform hit |

### Varför skills och inte ett dokument

Ett dokument på 2000 rader läses inte. En skill på 150 laddas när den behövs.
Formen är hämtad ur SessionStudio, där den är den enda som visat sig hålla.

---

## Status

| Klart | Kvar |
|---|---|
| tokenkontraktet som Tailwind-tema, 193 tokens | auth, Firestore-regler och regeltester |
| femton primitiver med stängt API, 43 beteendetester | observability: logger, larm till issue |
| tio vakter plus mutationsharnesset, 29 regler bevisade röda, 72 tester | toast, tooltip, appskal |
| `create-ops-app`, bevisad genom en riktig installation | appskal och navigering in i ramverket |
| adoptionsplan för bolag-ops, mätt mot repot | själva adoptionen, som väntar på profilbeslutet |
| skills: `css-and-components`, `web-app`, `testing`, `ci-and-guards` | skills: `firebase-data`, `auth-google-idp`, `observability`, `architecture-decisions` |
