# ops-framework

Det gemensamma fundamentet för Staigers ops-plattformar. Färg- och formsystem,
färdiga byggdelar, arbetsregler och vakter, så att varje plattform ser likadan ut,
fungerar likadant och följer samma regler, utan att grovjobbet görs om varje gång.

⛔ Vilka plattformarna är står i `adoption/`, inte här. Ramverket ska inte veta
vilka som använder det: gör det det, smyger domänen in i kontraktet.

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
| **Mekanism före dokumentation** | åtta vakter i grinden, 29 regler bevisade röda | En regel som bara står i ett dokument följs inte. Det är mätt, inte en åsikt |
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

#### Ikoner: Lucide, som peer dependency

⛔ **Den här raden sade tidigare motsatsen**, alltså att ramverket medvetet tog
noll ikonberoende och ritade tre egna SVG:er. Motiveringen var att ett ramverk
inte ska dra in ett helt ikonbibliotek för tre pilar. **Premissen var fel:**
`lucide-react` är träd-skakbart, så tolv importerade ikoner ger tolv ikoner, inte
biblioteket. Kostnaden är ett beroende, inte vikt.

Med premissen borta föll slutsatsen. Egna SVG:er i Lucides form är formspråket
utan uppsättningen: ramverket hade en egen chevron som Lucide redan har, och
varje app som ville ha en ikon till installerade Lucide ändå. Två källor för samma
streck är precis den drift ramverket finns för att stoppa.

`lucide-react` är därför en **peer dependency**, som React. Appen installerar den
en gång, och både ramverket och appen ritar ur samma uppsättning och samma
version. Ramverket importerar den bara i `src/components/icons.jsx`, så ett byte
av uppsättning är en fil.

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

239 värden i `tokens/tokens.css`, som **är** Tailwind-temat och inte en kopia
bredvid det.

| Grupp | Vad den svarar på |
|---|---|
| `canvas`, `surface`, `raised`, `sunken`, `contrast-panel`, `scrim` | vilken yta står detta på (`contrast-panel` = inverterad flytyta) |
| `ink`, `ink-secondary`, `ink-muted`, `ink-inverse` | textnivå |
| `line`, `line-strong`, `divider` | var slutar en yta |
| `accent`, `accent-hover`, `accent-subtle`, `accent-faint` | produktens hand |
| `success`, `warning`, `danger`, `info` (+ `-bg`) | vad betyder detta för användaren |
| `identity-1` .. `identity-6` | vem hör detta till |
| `human`, `agent`, `auto` (+ `-bg`) | vem producerade det |
| `--spacing`, `radius-*`, `shadow-*`, `text-*`, `font-*` | rytm och form |
| `--z-*`, `--safe-*`, `--duration-*`, `ease-*` | lager, säkra ytor, rörelse |
| `animate-spin`, `animate-spin-slow`, `animate-svep` | de tre rörelser ramverket har. ⛔ `animate-svep` är bubblornas entré (180 ms, trappa 40 ms per element sätts som `animationDelay`), avläst ur SessionStudios `popIn`. Under `prefers-reduced-motion` blir den `none`, till skillnad från snurren som bara saktar ner: snurren BÄR beskedet att något pågår, svepet bär ingenting |

Mörkt läge har tre tillstånd: valt ljust, valt mörkt, och inte valt. Paletten för
mörkt deklareras **en gång**; blocken som aktiverar den får bara peka.

### Komponenter

**67 komponenter.** Alla har ett stängt API: ingen tar emot `className`, `style`
eller `...rest`. Ett okänt värde kastar med läsbar text i stället för att rendera
något godtyckligt.

#### Åtgärder och ytor

| Komponent | Props |
|---|---|
| `OpsButton` | `variant` primary \| secondary \| ghost \| danger, `size` sm \| md, `type`, `disabled`, `busy`, `fullWidth`, `iconOnly`, `href`, `newTab`, `ariaLabel`, `title`, `id`, `onClick`, `children` |
| `OpsCard` | `rounding` (`"kort"` 8 px, förval, eller `"bubbla"` 24 px). ⛔ TVÅ RADIER OCH INTE EN SKALA: `kort` för allt som är en RUTA (en panel, en sektion, en tabell), `bubbla` för det som är ett OBJEKT i en ström (en händelse, ett kort man bläddrar förbi). Skillnaden ska gå att se utan att jämföra, och ett tredje steg emellan gör att ingen av dem längre betyder något. 24 px är MÄTT mot SessionStudios `--radius-card: 1.5rem` och inte valt på känsla; `--radius-3xl` råkade redan vara exakt det steget, så inget nytt token behövdes. Kastar på en okänd rundning, eftersom en tyst reserv gör `"bubla"` till ett kort som ser nästan rätt ut. `tone` raised \| sunken \| plain, `elevated`, `flush`, `edge` 1-6, `edgeLabel`, `id`, `children` |
| `OpsView` | `width` narrow \| normal \| wide \| full, `children` |
| `OpsViewHeader` | `title`, `description`, `actions` |
| `OpsModal` | `oppet`, `onOpenChange`, `title` (krävs), `description`, `size` sm \| md \| lg, `footer`, `closeLabel`, `children` |
| `OpsDisclosure` | `summary` (krävs), `defaultOpen`, `oppet`, `onOpenChange`, `storageKey`, `badge`, `id`, `children` |

#### Formulär

| Komponent | Props |
|---|---|
| `OpsField` | `label`, `hint`, `error`, `required`, `children` |
| `OpsInput` | `value`, `onChange`, `type` text \| email \| search \| tel \| url \| password \| number, `placeholder`, `name`, `autoComplete`, `disabled`, `readOnly`, `maxLength`, `ariaLabel` |
| `OpsTextarea` | `value`, `onChange`, `placeholder`, `name`, `rows`, `disabled`, `maxLength`, `ariaLabel` |
| `OpsSelect` | `options` [{value, label, disabled}], `value`, `onChange`, `placeholder`, `disabled`, `ariaLabel` |
| `OpsDatePicker` | `value` ISO-datum, `onChange`, `placeholder`, `disabled`, `ariaLabel`, `clearLabel` |
| `OpsCheckbox` | `label`, `checked`, `onChange`, `disabled`, `hint` |
| `OpsToggleRow` | `label`, `value`, `on`, `onChange`, `offLabel`, `control`, `trailing`. Rad som tonas ned i stället för att bockas ur. ⛔ Ett filter, inte ett påstående: kryssrutan frågar "är det sant?", den här frågar "ska det räknas?". ⛔ `control` lägger en kontroll UNDER knappen; `trailing` lägger en kompakt kontroll LÄNGST TILL HÖGER på samma rad (t.ex. `OpsSimulatePopover` eller `OpsKnob`). Båda ligger UTANFÖR knappen: ett reglage inuti en `<button>` är ogiltig HTML, och draget hade bubblat upp och tonat ned posten man just simulerade. Ramen bor därför på ett omslag. Utan båda ritas ingen extra behållare. |
| `OpsFilePicker` | `value`, `onChange`, `maxChars`, `accept`, `paste`, `ariaLabel`, `labels` {valj, byt, taBort, klistra}. Välj en fil att bifoga: bild, PDF, kalkylark, kontoutdrag. Ger `{dataUrl, name, kind, chars, width?, height?}`. ⛔ Heter inte OpsImagePicker: en bildväljare som får ett kontoutdrag tvingar fram en skärmbild av ett dokument man redan har. Bilder krymps i steg, andra filer ryms eller avvisas med besked om vad man ska göra. ⛔ Lyssnar på inklistring i DOKUMENTET, för man klistrar in där blicken är, inte där fokus råkar ligga; två monterade väljare tar därför emot samma inklistring, och det är vad `paste={false}` finns till för. |
| `OpsRadioGroup` | `options` [{value, label, hint?}], `value`, `onChange`, `ariaLabel`, `name`, `columns` 1 \| 2. Ett val bland flera, alla synliga. ⛔ Nativa `<input type="radio">` under ytan, aldrig `<button role="radio">`: piltangenter, gruppering och "3 av 4" uppläst kommer gratis och blir fel i något hörn när de byggs för hand. Använd den när `OpsSegmented` tagit slut (den kastar vid fyra) och `OpsSelect` skulle gömma alternativen bakom ett klick. |
| `OpsSlider` | `label`, `value`, `onChange`, `min`, `max`, `zero`, `formatValue`, `step`, `resetLabel`, `hiddenLabel`. Dragreglage för att SIMULERA ett tal, inte mata in det. ⛔ `zero` är läget som betyder "som det är idag", och det måste gå att träffa EXAKT: därför en `Återställ`-knapp som blir inaktiv i stället för att försvinna (en knapp som försvinner flyttar allt bredvid sig) plus ett märke på skenan. ⛔ `formatValue` är obligatorisk: ett reglage som läses upp som "minus femton" säger inte minus femton vadå. Nativt `input type=range` under ytan, så touch, piltangenter och hela aria-värdefamiljen kommer gratis; tumme och skena målas i `.ops-reglage` i tokens, eftersom pseudoelementen inte finns som klasser. ⛔ `hiddenLabel` döljer ordet visuellt men behåller `<label htmlFor>`, för ett reglage som sitter i en rad som redan säger sitt namn. Ett `aria-label` hade tagit bort kopplingen mellan ord och fält för den som använder förstoring. |
| `OpsKnob` | `label`, `value`, `onChange`, `min`, `max`, `zero`, `formatValue`, `step`, `hiddenLabel`. Kompakt simuleringsratt (~28 px) för samma jobb som `OpsSlider`, men inline längst till höger på en rad. ⛔ Dubbelklick återställer till `zero` (ingen Återställ-knapp: den hade krävt bredd raden inte har). ⛔ Varm `laborera`-accent, inte blå systemaccent. ⛔ `formatValue` syns under ratten och ska vara kort (t.ex. "0 %" / "+25 %"); belopp hör hemma i radens värdekolumn. Nativt `input type=range` under den målade ratten. |
| `OpsSimulatePopover` | `label`, `value`, `onChange`, `min`, `max`, `zero`, `formatValue`, `step`, `resetLabel`. Dial-ikon längst till höger som öppnar en popover med full `OpsSlider` + Återställ. ⛔ Ytan är `bg-contrast-panel` (inverterad mot sidan) så reglaget inte smälter in i mörkt läge. ⛔ För mobil: den alltid synliga 28 px-ratten var för liten att ta i; raden ska vara lugn och reglaget komma fram på begäran (CP: popover-varianten). ⛔ Triggern speglar läget (nål + varm amber + %-bricka när ≠ noll) men är inte själv ett range-input. ⛔ Escape och klick utanför stänger; slidern får fokus vid öppning. Samma simuleringskontrakt som `OpsSlider`/`OpsKnob`. |
| `OpsFloatingSummary` | `label`, `value`, `tone`, `hint`, `onDismiss`, `dismissLabel`. Talet man laborerar med, som håller sin plats i fönstret. ⛔ Ytan är `bg-contrast-panel` + `.ops-contrast-panel` (inverterad mot sidan), samma kontrastidé som FAB. ⛔ `fixed` och inte `sticky`, och första försöket var fel: `sticky` nyper fast bara inom sin förälders scrollsträcka, så på en sida som scrollar i DOKUMENTET blev det en rad i flödet som inte flöt. SessionStudios motsvarighet står stilla av ett tredje skäl, att deras kalender är ett skal med fast höjd vars kolumner scrollar var för sig, vilket inte går att låna till en dokumentscrollande sida. ⛔ Invändningen mot `fixed`, att den täcker sista raden för alltid, gäller inte här eftersom APPEN visar den bara medan något är justerat. Komponenten bär inget eget villkor. ⛔ Bottnar ovanför bottenraden (`--bottom-nav-h` + `--safe-bottom`) och ligger på `--z-sticky`, inte `--z-chrome`. ⛔ EN STORLEK, TVÅ RADER: nuläget litet överst, det simulerade stort och tonat under. De två lägena är borta, eftersom det utfällda inte fick plats (tre texter på en rad delar på 320 px, och `truncate` åt upp namnet och hinten) och växlingen var en gest utan nytta mitt under ett drag. Namnet målas inte men finns kvar som skärmläsartext, annars är bubblan två nakna tal för den som lyssnar. Krysset är den enda knappen och bär `label` i sitt namn. |
| `OpsScrollArea` | `children`. En yta som rullar i SIG SJÄLV hela vägen ner till skärmens underkant, så att det som står ovanför den står still. ⛔ CP 2026-09-22: "Filterraden är fast i kalendervyn men den scrollar i listvyn." Kalendern hade fått en egen rullyta av ett annat skäl, och skillnaden mot listan var därför en tillfällighet och inte ett beslut. ⛔ HÖJDEN MÄTS OCH RÄKNAS PÅ VAR SITT HÅLL: avståndet till sidans topp mäts en gång i JS (plus `scrollY`, annars ruttnar talet så fort sidan rullats) och läggs i `--fullhojd-topp`; själva höjden räknas i CSS ur variabeln. Det är enda sättet att få BÅDE en mätning och en brytpunkt, eftersom en inline-stil inte kan ha en media-fråga och en klass inte kan veta var elementet hamnade. Mäts om vid `resize`, alltså också när telefonen vrids. ⛔ Bottenraden dras bort bara under 768 px, eftersom `OpsBottomNav` är `md:hidden`; över den slutar ytan annars en bottenradshöjd för tidigt. ⛔ GOLV `min-h-60` för den dag ytan hamnar långt ner på en kort sida, annars kan uttrycket bli noll och innehållet försvinna helt. ⛔ INGEN RAM, INGEN RUNDNING, INGEN EGEN BAKGRUND: en yta som når skärmens underkant och har en ram läses som en ruta som blivit avhuggen. ⛔ Delar mätningen med `OpsCalendar` genom `src/lib/fullHeight.js` i stället för att kopiera den; en kopia glider isär första gången någon rättar den ena. |
| `OpsSwitch` | `label`, `checked`, `onChange`, `disabled`, `hint` |

#### Data

| Komponent | Props |
|---|---|
| `OpsList` | `divided`, `ariaLabel`, `children` |
| `OpsBreakdown` | `groups` [{id, label, value, count, on, poster, note}], `onToggle`, `total`, `empty`, `offLabel`, `expandLabel`. En summa uppdelad i grupper som går att fälla ut och tona ned. ⛔ Den summerar ingenting själv: bara appen vet om ett intervall eller ett okänt belopp får räknas. |
| `OpsAttributes` | `rows` [{label, value}], `ariaLabel`. Vad vi vet om EN sak, fält för fält. ⛔ Tomma fält ritas inte och allt tomt ger `null`: ett bindestreck ser ut som ett mätt värde. Dubbel etikett kastar. Flera saker jämförda på samma fält är `OpsTable`, inte den här. |
| `OpsShareChart` | `segments` [{id, label, value, text, detaljer}], `ariaLabel`, `empty`. Hur en helhet är fördelad. ⛔ Duger inte för att jämföra närliggande värden: 18 mot 21 procent går inte att skilja som vinklar, då är det `OpsRankChart`. Högst sex bitar, sedan kastar den: en sjunde färg vore genererad, alltså omätt. Listan bredvid är inte en legend utan datan, och den är ett KRAV: tre av sex färger klarar inte 3:1 mot ljus yta och är tillåtna bara med synliga etiketter. ⛔ Ingen total i hålet: 130 px rymmer inte ett valutabelopp, totalen hör hemma i kortets rubrikrad. En bit med `details` fälls ut, och då är HELA raden knappen: en 44 px pil bredvid en 28 px rad gör listan halvannan gång högre utan att säga något nytt.
| `OpsRankChart` | `rows` [{id, label, value, text, niva, note}], `ariaLabel`, `max`, `empty`. Vad som är stort och vad som är smått, i ordning. ⛔ `level` (1 låg, 2 medel, 3 hög) är APPENS bedömning: var gränsen går är domän. Skalan är en nyans som mörknar, aldrig en regnbåge. Taket är största värdet, aldrig summan: mot summan blir varje stapel en strimma.
| `OpsEventList` | `events` [{id, titel, dagarKvar, pagar, nar, deadline, roll, slag, detaljer, url, atgard}], `onNavigate`, `ariaLabel`, `labels`, `empty`, `expandLabel`. Brådskan är härledd ur datumet, aldrig lagrad, och färgen bär den aldrig ensam. ⛔ `role` säger VEM, `kind` säger VAD FÖR SORTS sak, `when` hur långt bort och `deadline` vilken dag; skriv inte datumet i både `when` och `deadline`. Titeln äger sin egen rad så löptext aldrig får en halv skärmbredd. En rad med `details` får en chevron, och kolumnen för den reserveras bara när någon rad i listan har dem. ⛔ `atgard` är appens egen kontroll på raden; har någon rad en och någon annan inte det måste listan säga vilka som går att göra något åt i `actionHint`, annars kastar den. En lista där vissa rader går att göra något åt och andra ser likadana ut lär läsaren att trycka på måfå. Förklaringen står EN gång över listan: mätt i bolag-ops blev en mening per rad tre identiska rader i följd och en tredjedel längre lista.. ⛔ VARJE HÄNDELSE ÄR EN BUBBLA (`rounding="bubbla"`), inte en panel: CP 2026-09-22, "samma mjuka SS-rundning på alla händelsebubblor". ⛔ `edge` (1-6) och `edgeLabel` PÅ HÄNDELSEN släpps igenom till kortets `edge`, så slaget kan synas som en matt vänsterkant à la SessionStudio. Kanten BYGGS INTE här: `OpsCard` har haft den hela tiden med kravet på ett ord inbyggt, listan gjorde den bara inte nåbar, och då hade varje yta som ville visa slaget fått rita sin egen. Vilket slag som är grönt är APPENS beslut: ramverket ritar kanten och tolkar den aldrig. |
| `OpsListRow` | `interactive`, `selected`, `href`, `onClick`, `ariaLabel`, `children` |
| `OpsTable` | `columns` [{key, label, numeric, tight}], `rows`, `caption` (krävs), `hideCaption`, `stickyHeader`, `empty` |
| `OpsStat` | `label`, `value`, `hint`, `tone` neutral \| success \| warning \| danger, `badge`, `fact`, `factLabel`, `source`, `updatedAt`, `onDrillDown`, `drillDownLabel` |
| `OpsEmpty` | `title`, `description`, `action`, `busy`, `busyLabel` |
| `OpsSpinner` | `size` sm \| md \| lg, `tone` current \| accent \| muted, `label`, `decorative` |
| `OpsDataView` | `loading`, `error`, `data`, `header`, `errorTitle` (krävs), `loadingLabel` (krävs), `missingTitle`, `children` **som funktion** | En vys tre datatillstånd, mätta i bolag-ops som **sex** vyer som skrev samma tre grenar för hand (fem rakt av, Översikt i en ternär). ⛔ Siffran stod först som nio, vilket var antalet vyer som skriver felbanderollen och inte antalet med hela formen. ⛔ Fel vinner över laddning: med flera läsningar kan felet komma medan en annan hämtar, och låter man laddningen vinna göms felet bakom en snurra som aldrig slutar snurra. ⛔ `loadingLabel` krävs och gissas inte fram, för "Hämtar" utan objekt är samma text i tolv vyer och då går det inte att se vilken av fem läsningar som hänger. ⛔ **Hämtat men tomt är inte hämtning som pågår**, och det är felet den handskrivna varianten faktiskt hade: `loading \|\| !data` ritar "Hämtar ..." för alltid när en läsning gick igenom men gav `null`, alltså påstår sidan att den arbetar när den gett upp. Det tillståndet får OpsEmpty med egna ord och `role="status"`, inte en röd banderoll: kontraktets regel 3 säger att `null` betyder "finns inte" och inte att något gick sönder. ⛔ **Utelämnas `data` görs ingen tomhetskontroll**, för `"data" in props` skiljer utelämnad från null; annars hade varje vy som läser fem listor fått tomhetsrutan fast allt gick bra. ⛔ Barnen är en FUNKTION: som nod hade React byggt dem innan grenen valdes, alltså hade `data.totals` kastat i precis det läge komponenten finns för |

#### Märkning

| Komponent | Props |
|---|---|
| `OpsPill` | `tone` neutral \| success \| warning \| danger \| info, `children` |
| `OpsStatusDot` | `status` oppet \| pagar \| vantar \| klart \| akut, `label` (krävs). Färgprick för var ett ärende står, tänkt för en kortrubrik. ⛔ Ordet krävs och renderas alltid, som `sr-only` utom för `akut` som skriver ut det synligt: en färg går inte att läsa upp och är osynlig för var tjugonde man. Vyn måste visa ordet någonstans synligt, till exempel i utfällningen |
| `OpsMarkdown` | `text`. Renderar rubriker, stycken, listor, kryssrutor, citat, kod, tabeller och länkar som riktiga element. ⛔ Ingen HTML passerar en sträng: `dangerouslySetInnerHTML` finns inte, och bara `http`/`https` blir länkar. Kapar aldrig texten, det är datalagrets beslut |
| `OpsPrompt` | `source` (från `createPromptSource`), `label` (krävs), `hint`, `placeholder`, `context`, `sendLabel`, `waitingLabel`, `suggestions` [sträng], `onAnswer`. En fråga in, ett svar ut, renderat som markdown. ⛔ Vet inte vilken leverantör som svarar: modell, nyckel och tak är appens. ⛔ Förra svaret ligger kvar tills ett nytt kommit, även efter ett fel |
| `OpsActivityButton` | `entries` (nyast först), `kindLabel`, `title`, `label`, `lasning` {sedd, lasta, rensatTill}, `onSeen`, `onRead`, `onClear`, `dagar`, `sida`, `storageKey`, `icon`, `empty`, `now`. Klockikon med ett märke, listan bakom den och DETALJEN bakom listan. ⛔ Ett tryck på raden öppnar detaljen och markerar raden läst: en egen kryssruta bredvid varje rad är ett andra klick för något man just gjort, och listor med den knappen lär folk att bocka av utan att läsa. ⛔ Antalet står i knappens NAMN och inte bara som en prick. ⛔ TVÅ SÄTT ATT SKÖTA LÄSNINGEN: `lasning` + `onSeen`/`onRead` lägger den där APPEN vill, till exempel i databasen, så den följer med mellan telefon och dator; `storageKey` lägger den i EN webbläsare. Ramverket väljer inte, eftersom bara appen vet om den har en plats. ⛔ `dagar` är fönstret bakåt, `sida` hur många som ritas åt gången, `rensatTill` läsarens egen städning. Olästa rader slipper alla tre: en rad som aldrig lästs får inte försvinna för att den blev gammal medan man var borta, och märket hade då räknat något som inte gick att hitta |
| `OpsActivityList` | `entries`, `kindLabel`, `empty`, `lasning`, `onOpen`, `fler`, `onMore`, `now`. Listan utan knapp, för en app som vill ha aktiviteten på en egen sida. ⛔ Delas i Idag, I går, Senaste veckan och Äldre: ett nattligt jobb skriver en rad om dagen, och efter en månad kräver frågan "kördes det i dag" att man läser tidsstämplar i en platt lista. ⛔ Raden är kort med flit: rubrik, detalj och när. Källan, det exakta klockslaget och hela feltexten står i `OpsActivityDetail`, eftersom de är vad man behöver den dag något gick sönder och brus resten av tiden. ⛔ HELA raden är knappen, inte en pil i kanten: ett 12 px mål i högerkanten är det säkraste sättet att göra en lista som inte går att använda med tummen. ⛔ Antalet står på "Hämta fler": ensamt säger det inte om det är tre rader eller trehundra kvar, och den skillnaden avgör om man orkar trycka |
| `OpsPanel` | `trigger`, `label`, `title`, `action`, `children` (en funktion som får `nav`), `open`, `onOpenChange`, `align`, `backLabel`. En panel med vyer i en STACK: rot, undervy, detalj. `nav.push({ key, title, action, content })` byter innehåll PÅ PLATS, `nav.pop()` går tillbaka. ⛔ Samma yta som hamburgermenyn och samma Radix-primitiv, eftersom panelen ska VARA menyn och inte likna den. ⛔ En panel och inte en modal: en modal mörklägger sidan, flyttar fokus och döljer bakgrunden för skärmläsare, och att göra det för att visa att ett jobb kört i natt är att avbryta någon för något som inte kräver ett svar. ⛔ Stacken nollställs vid stängning: öppnar man igen vill man se roten, inte den detalj man råkade läsa sist. ⛔ Ingen tillbakapil på roten, eftersom en pil som inte går någonstans är ett löfte som bryts vid första trycket |
| `OpsPanelRow` | `icon`, `label`, `badge`, `badgeText`, `chevron`, `onClick`, `href`, `active`. Menyraden. ⛔ Chevron BARA när raden leder vidare: en pil på en rad som bara växlar något lovar en vy som inte finns. ⛔ Hela raden är målet, inte chevronen: ett 16 px mål i högerkanten är det säkraste sättet att göra en lista som inte går att använda med tummen. ⛔ `badgeText` krävs för att antalet ska betyda något uppläst: en trea utan ord är en trea |
| `OpsPanelHeader` | `title`, `onBack`, `backLabel`, `action`. Huvudet i en undervy. ⛔ Utan `onBack` ritas ingen pil, alltså roten. ⛔ En pil och inte ett kryss: krysset stänger allt, pilen går ett steg |
| `OpsActivityDetail` | `handelse`, `slagord`, `now`. En rad i sin helhet, utan kapning. ⛔ Feltexten står hel i en kodruta: den kommer ordagrant från ett API och den som ska söka på den behöver den oförvanskad. ⛔ "Utfall" står bara när det gick bra, eftersom ett misslyckande redan sagts med ord överst och i rutan |
| `OpsTag` | `label` (bestämmer också tonen), `tone` 1-6 (låser tonen), `onRemove`, `removeLabel` |
| `OpsIdentity` | `name`, `seed` (krävs, stabilt id), `imageUrl`, `size` sm \| md \| lg |
| `OpsProvenance` | `kind` human \| agent \| auto, `label` |
| `OpsFact` | `kind` uppmatt \| uppskattat \| okant \| scenario, `label`, `value` |

#### Navigering och meddelanden

| Komponent | Props |
|---|---|
| `OpsAppShell` | `brand` (sträng eller `OpsBrand`), `nav` [{href, label, icon?, badge?, children?}] — ⛔ EN POST MED `children` ÄR EN RIKTIG MENY I TOPPRADEN sedan 2026-09-22, inte en länk med en pil. CP: "Ekonomi är ingen dropdown. Sublänkar saknas." Raden ritade en chevron så fort posten hade barn, men posten var en naken `<a href>`: ett tryck gick till föräldersidan och menyn fanns inte. Barnen ritades bara i MOBILENS Mer-ark, så på en dator gick de bara att nå genom att först besöka föräldersidan. Det är samma regel som kalenderkortets chevron fick, tillämpad på navet: en pil som öppnar ingenting är värre än ingen pil, för den lär den som ser den att pilar i appen inte betyder något. ⛔ ETIKETTEN ÄR LÄNKEN OCH CHEVRONEN ÄR KNAPPEN, alltså två kontroller som gör var sin sak. Första versionen lade föräldern som första RAD i menyn så att sidan skulle gå att nå, och CP såg genast varför det var fel: "Men varför står Ekonomi två gånger?" Knappen sa Ekonomi och menyns första rad sa Ekonomi, tjugo pixlar isär. ⛔ Att posten inte får vara EN länk som också öppnar står kvar och är ett annat skäl: då är trycket tvetydigt, navigerade jag eller öppnade jag. Här ger platsen svaret. ⛔ `submenuLabel` namnger chevronen ("Visa sidorna under Ekonomi"), för en pil utan ord är en knapp som inte går att höra. ⛔ Raden finns bara från 768 px; chevronens träffyta är ändå 44 px, för en surfplatta är en tumme, `activeHref`, `onNavigate`, `actions`, `primaryAction` {label, onClick, icon?}, `menuExtras`, `menuLabel`, `navLabel`, `maxTopNav`, `maxTopNavSmal`, `children`. ⛔ `primaryAction` blir den runda knappen i bottenraden på telefon. På bred skärm finns ingen bottenrad, så appen sätter samma åtgärd i `actions` själv: skalet gissar inte var en knapp hör hemma i en topprad det inte äger. ⛔ `menuExtras` (tema/helskärm m.m.) landar i Mer-menyn, inte i åtgärdsklustret |
| `OpsBottomNav` | `nav` [{href, label, icon?, badge?, children?}], `moreNav`, `activeHref`, `onNavigate`, `primaryAction` {label, onClick, icon?}, `menuExtras`, `menuLabel`, `navLabel`, `sheetLabel`, `closeLabel`, `badgeText`. Fast bottenrad under `md`, högst fem platser, Meny sist öppnar en sheet. ⛔ Med `primaryAction` ritas en rund knapp MITT i raden och en flik flyttas till menyn: mätt ryms inte fyra flikar plus Meny plus en knapp på 56 px i 390 px. Knappen är en åtgärd och hamnar aldrig i menyn. Renderas av `OpsAppShell` men kan användas fristående |
| `OpsBrand` | `title` (krävs), `subtitle`, `mark` phst \| phst-estd \| none |
| `OpsTabs` | `tabs` [{id, label, disabled}], `value`, `onChange`, `ariaLabel` (krävs), `children` |
| `OpsSegmented` | `options` [{value, label, badge}] (två eller tre), `value`, `onChange`, `ariaLabel` (krävs). Byter URVAL i samma lista, till skillnad från `OpsTabs` som byter innehåll.  ⛔ `icon` på ett läge ritar ikonen I STÄLLET för ordet, med ordet kvar som `sr-only`: en ikon utan namn är en knapp som inte går att höra. ANTINGEN ALLA LÄGEN ELLER INGET, annars kastar den — en ikon bredvid ett ord ser ut som ett fel |
| `OpsFilterChip` | `options` [{value, label}], `value`, `onChange`, `ariaLabel` (krävs), `allLabel`. Pillerformat filter bredvid en lista. ⛔ Valt värde står i pillret, annars läser man en beskuren lista i tron att den är komplett. |
| `OpsCalendar` | `entries` [{id, datum `YYYY-MM-DD`, titel, status?, url?, not?}], `ariaLabel` (krävs), `statusWords` {läge: ord}, `monthsBack` (1), `monthsForward` (3), `emptyText`. Månadsrutnät i en rulle: öppnar på idag, klistrad veckodagsrad, flytande Idag-knapp när månaden rullat ur bild. ⛔ Ritar bara DATERADE poster; odaterat hör hemma i en lista. ⛔ Rutans prickar säger «något finns», inte vilken status: status med sitt ord bor i dagsbubblan ett tryck bort, eftersom tre färger i en 44 px-ruta är brus och en färg utan ord inget besked. ⛔ RULLAR I SIN EGEN BEHÅLLARE (tak i `svh`, `overscroll-contain`): i dokumentets flöde rullade sidan i stället, veckodagsraden nöp under appens toppmeny och vägen tillbaka till idag gick genom hela vyn. ⛔ Dagens poster ligger i en DAGSPANEL byggd som SessionStudios: en rad inverterade datumpiller överst (kryss per piller när flera dagar är valda) och därunder ETT KORT PER POST, med luft i stället för avdelare och datumet i kortets metarad. ⛔ RULLYTAN GÅR HELA VÄGEN NER: inget påhittat `max-h`, ingen ram. Avståndet till fönstrets överkant MÄTS en gång (plus `scrollY`, så talet inte ruttnar när sidan rullas) och läggs i `--fullhojd-topp`; höjden räknas i CSS ur den, med bottenraden bortdragen under 768 px. Mätning i en variabel och räkning i klassen är enda sättet att få både en mätning och en brytpunkt. ⛔ PLACERINGEN FÖLJER FÖREBILDENS `showSidePanel = !isPhone`: egen kolumn bredvid rutnätet från 1024 px (300 px, 360 px från 1280 px) — vid 768 px blir dagsrutorna 62 px breda, alltså smalare än sin träffyta, och förebildens regel är `!isPhone && isLandscape`, alltid reserverad så rutnätet inte krymper under fingret; på telefon en flytande remsa som bottnar på bottenraden. ⛔ VARJE KORT ÄR FÄLLBART: chevron när posten har status, url eller `details`, och aldrig annars (en pil som öppnar en tom ruta är ett löfte som inte infrias). Utfällningen bär STATUS SOM ORD (pricken i raden är samma faktum för den som ser den) och länken med `urlLabel`. ⛔ Titeln är text och inte längre en länk: samma adress på både titel och utfällning vore dubbletten två gånger på samma kort. ⛔ Rullriktningen för Idag-knappen räknas i `rullriktning` |
| `OpsFilterPanel` | `groups` [{id, label, options, allaLabel?}], `value` {grupp: valt \ ⛔ `layout="ikoner"` ger EN IKON PER GRUPP bredvid varandra i stället för en knapp för allt, var och en med sin egen meny och tänd när just den gruppen är satt: med fem dimensioner blev den samlade panelen tjugo rader som täckte halva skärmen. Gruppens `icon` är appens (vilken bild som betyder «roll» beror på vad rollerna är), och saknas den faller den tillbaka på reglageikonen. Sorteringen tänds när den lämnat `sorting.standard`, men räknas fortfarande aldrig som ett filter. ⛔ `sorting.standard` KRÄVS i ikonläget och gissas inte: reserven var «första alternativet», vilket är rätt precis tills någon sorterar om `options`, och då lyser ikonen från start utan att någon rört den. Ingenting går sönder, sidan ljuger bara om sitt eget tillstånd, och det är den sortens fel ingen app upptäcker i sina egna prov. Den samlade panelen kräver den inte, eftersom den inte tänder något. ⛔ SORTERINGENS BILD ÄR RAMVERKETS och inte appens, till skillnad från gruppernas: vilken bild som betyder «roll» beror på vad rollerna är, medan «i vilken ordning ligger raderna» är samma fråga i varje app. `sorting.icon` finns kvar som övertramp. Reserven var förut reglageikonen, alltså SAMMA bild som en grupp utan egen ikon får, och två kontroller med samma bild bredvid varandra går inte att skilja på. ⛔ RENSA ÄR ETT KRYSS I DET LÄGET och inte ordet (CP 2026-09-22: "Går det att ersätta rensa med ett kryss eller nåt annat grepp som gör att allt får plats i en liten skärm?"). Krysset står aldrig ensamt, eftersom knappen bara finns när minst en ikon till vänster om den LYSER, och ett kryss sist i en rad tända ikoner läses som «släck dem». `clearLabel` är kvar som knappens namn, så den som lyssnar hör «Rensa» och inte «kryss». ⛔ KRYSSET SPARAR INGEN BREDD: mätt på komponenten i Chromium är raden 286 px med ordet och 284 med krysset. En ikonknapp som behåller sin träffyta är `min-w-11`, alltså 44 px, och ordet «Rensa» med `px-3` är 46. Bilden är smalare än ordet, knappen är det inte, och den som byter ord mot ikon för att vinna plats räknar fel. Krysset är ett utseendeval och inte en passformsfix | null}, `onChange` (hela kartan), `ariaLabel` (krävs), `sorting` {label, value, options, onChange}, `clearLabel`, `moreLabel`. Flera filterdimensioner plus sortering bakom en knapp. ⛔ Knappen byter form med valet: ikon utan text när inget är valt, piller med den VALDA etiketten när något är, räknare först vid två. ⛔ Sortering räknas aldrig som filter, en sorterad lista är fortfarande komplett. Ersätter inte `OpsFilterChip`: en dimension ska vara ett piller |
| `OpsHelp` | `title` (ett rubrikelement), `children` (förklaringen), `label`. En rubrik med sin förklaring bakom ett FRÅGETECKEN. ⛔ CP 2026-09-22: "Låt texter komma fram med hjälp av att man trycker på ett frågetecken, så blir appen lite renare." Meningen under rubriken är sann och värd att ha, men den läses en gång och står kvar för alltid, och på en telefon trycker den ner det man kom för. ⛔ BYGGD PÅ `<details>` OCH INTE EN KNAPP MED STATE, samma skäl som `OpsDisclosure` och värt att upprepa eftersom frestelsen är större här: en liten knapp ser ut som fem rader kod, men en egen hopfällning tappar tangentbord, fokusordning och skärmläsarens «expanderad» gratis. ⛔ HELA RUBRIKRADEN ÄR TRÄFFYTAN och inte bara tecknet: `<summary>` är ETT element, så ska tecknet vara enda klickytan måste texten ut ur det, och då är man tillbaka i egen state. Bytet gynnar dessutom tummen, ett 20 px tecken är en dålig träff. Tecknet är det man SER och siktar på, raden tar emot. Innehållsmodellen tillåter uttryckligen ett rubrikelement i ett `<summary>`, så rubriken förblir en rubrik. ⛔ INGET FRÅGETECKEN UTAN TEXT: saknas `children` ritas rubriken naken, för en knapp som öppnar ingenting är ett löfte som inte infrias. ⛔ STÄNGD FRÅN START, ALLTID. Ett `storageKey` som `OpsDisclosure` har vore lätt och fel: mindes texten sig öppen vore vi tillbaka i en mening som står kvar för alltid. ⛔ `OpsViewHeader` ANVÄNDER DEN FÖR SIN `description`, alltså får varje vy frågetecknet utan att göra något; arton vyer i bolag-ops hade annars fått arton varianter av samma gest. |
| `OpsControlRow` | `children`, `align` (`"mitten"` eller `"start"`). En rad kontroller ovanför det de styr. ⛔ TUNN MED FLIT, och skälet är inte att spara tecken: vyerna skrev raden själva och skrev den olika, en med `gap-2` och en utan, en som bröts vid smal skärm och en som sköt ut. Ingen av de skillnaderna var beslutad, och de upptäcktes först när CP höll telefonen bredvid datorn. ⛔ REGELN SOM BOR HÄR ÄR VAD SOM HÄNDER NÄR RADEN INTE RYMS: den bryts, den krymper inte och den skjuter inte ut. En kontroll som krympt under sin egen träffyta är värre än en som flyttat ner en rad, eftersom den fortfarande ser ut att gå att trycka på. ⛔ `mitten` som förval, för en ensam kontroll över en lista hör hemma över listans mitt; `start` när raden bär FLERA kontroller, eftersom vänsterkanten då är den enda punkt som ligger still när en av dem byter bredd. ⛔ Kastar på en okänd justering: en tyst reserv gör `align="vanster"` till en rad som ser nästan rätt ut, och nästan rätt upptäcks aldrig. ⛔ DEN HINDRAR INTE en vy från att lägga sex saker i en rad som rymmer fyra. Det är fortfarande vyns ansvar, och det är fortfarande något som ska MÄTAS och inte antas. |
| `OpsTabPanel` | `id`, `children` |
| `OpsBanner` | `tone` info \| success \| warning \| danger, `title`, `action`, `onDismiss`, `dismissLabel`, `children` |
| `OpsToastProvider` | `children`, `closeLabel`. Läggs en gång, högst upp |
| `useOpsToast` | `visa({ title, description, tone })` |
| `OpsTooltip` | `content`, `side`, `children` |
| `OpsThemeToggle` | `ariaLabel`, `labels` {system, light, dark}. Ikonknapp med Sol/Måne, meny med tre lägen |
| `OpsFullscreenToggle` | `enterLabel`, `exitLabel`. ⛔ Läser tillståndet ur `document.fullscreenElement` och `fullscreenchange`, aldrig ur egen state: Escape och F11 lämnar helskärm utan att någon knapp tryckts. ⛔ Ritar INGENTING när webbläsaren saknar Fullscreen-API:et (Safari på iPhone), i stället för att sitta i sidhuvudet och inte göra något. Villkoret är webbläsarens eget svar, aldrig en brytpunkt på skärmbredd. |
| `OpsIconLink` | `href`, `icon`, `label`, `onNavigate`, `badge`, `badgeText`, `active`. En destination som en ikon i åtgärdsklustret, för en yta man återvänder till och som har ett antal värt att se utan att gå in. ⛔ En länk och inte en knapp: högerklick och ny flik ska fungera. `label` krävs, annars läses adressen upp som namn. `badge` 0 ritar ingen räknare, för en nolla i en cirkel är en notis om att det inte finns någon notis. |

#### Vad var och en gör som du annars fått bygga själv

| | |
|---|---|
| `OpsButton` | spärrad länk tappar sitt `href`, så den försvinner ur tabordningen |
| `OpsModal` | fokusfälla, Escape, scrollås, fokus tillbaka till öppnande knapp |
| `OpsDisclosure` | native `<details>`, så tangentbord, fokusordning och expanderat-läge kommer ur plattformen i stället för att återuppfinnas |
| `OpsField` | kopplar etikett, hjälptext och fel till fältet med genererade id |
| `OpsInput` | vägrar `type="date"` och `type="color"`, som inte går att tokenisera |
| `OpsSelect` | tangentbord, typeahead och positionering, via Radix |
| `OpsList`, `OpsTable` | rader utan fast höjd, tabell med egen scroll i sidled |
| `OpsTable` | `tabular-nums` i sifferkolumner så belopp linjerar |
| `OpsStat` | `tabular-nums` så ett tal som ändras inte hoppar i bredd; blir en knapp bara när den leder någonstans |
| `OpsFact` | vägrar visa ett belopp i läget `okant`, så noll och okänt aldrig ser likadana ut |
| `OpsEmpty` | skiljer tomt från laddande, som ser likadant ut men betyder motsatsen |
| `OpsSpinner` | EN väntesymbol, som annonserar för skärmläsare utan att göra det två gånger |
| `OpsDataView` | de tre datatillstånden som kod i stället för som kommentar, så en vakt kan se skillnad på en vy som följer regeln och en som glömde den |
| `OpsTag` | härleder tonen ur etiketten, så ny kategori kräver ingen kod |
| `OpsBrand` | byter märke med temat, inte med systemets inställning |
| `OpsThemeToggle` | tre lägen, så "följ systemet" inte försvinner, i en 44 px ikonknapp i stället för en 140 px textdropdown |
| `OpsCard` | vägrar rita en färgad kant utan ett ord som säger vad färgen betyder |
| `OpsIdentity` | initialer som inte klipper mitt i ett tecken |
| `OpsBanner` | `role="alert"` bara för det som ska avbryta |
| `OpsTabs` | piltangenter, Home, End och koppling flik till panel |
| `OpsBottomNav` | fast bottenrad utan att sidan hoppar, säker yta i botten, Meny-sheet med fokusfälla och ur DOM när stängd |

#### Tillförlitlighet är inte proveniens

Två frågor som är lätta att slå ihop och som inte går att härleda ur varandra:

| | Frågan | Komponent |
|---|---|---|
| **Proveniens** | Vem producerade det här? | `OpsProvenance`: människa, agent, automatik |
| **Tillförlitlighet** | Går det att lita på? | `OpsFact`: uppmätt, uppskattat, okänt, scenario |

En agent kan skriva en uppmätt siffra och en människa kan gissa. Slås de ihop
försvinner den ena.

⛔ Utan tillförlitlighet ser fyra olika saker likadana ut. En pensionsprognos
ligger visuellt bredvid faktiskt kassaflöde, ett tolvmånaderssnitt ser ut som ett
bokfört belopp, och **"0 kr" går inte att skilja från "vi vet inte"**. Det sista
är det farliga: noll och okänt är motsatser, och den som läser har ingen
anledning att misstro siffran. Därför kastar `OpsFact` om någon försöker ge läget
`okant` ett värde.

⛔ **Märk där blandningen sker, inte överallt.** Är allt på en sida märkt är
inget märkt, och märkningen blir mönstrad tapet som ögat slutar se. Är en hel
tabell uppmätt hör märket på tabellen, en gång. Därav att `uppmatt` har den
tystaste tonen av de fyra: den är normalfallet.

Nyckeltal bär samma sak: `OpsStat` tar `fact`, plus `source` och `updatedAt`.
⛔ **En siffra utan ålder läses som färsk**, alltid, och det är den vanligaste
tysta lögnen i en översiktsvy.

### Ärenden

`createActivityLog(config)` äger **formen** på en rad i aktivitetsloggen: när
det hände, vilket slag, vad som ändrades och om det gick igenom. Appen skickar
`kinds`, alltså vilka jobb som finns, eftersom ramverket inte vet det.
`buildEntry` **kastar** på ett okänt slag eller en rad utan rubrik, medan
`missing(utkast)` svarar med skälen: den första anropas av ett skript som inte
har någon att visa dem för, den andra av en yta som har det. `ACTIVITY_RESULTS`
är de två utfallen, `ok` och `fel`, och de är två med flit: en "varning"
däremellan glider tills varken varningen eller felet betyder något.

`unreadCount(rader, sedd)` räknar det som är nyare än en tidpunkt, och
`isUnread(rad, sedd)` svarar för en enskild rad. ⛔ Rena funktioner och inte ett
fält på raden: "oläst" är läsarens egenskap, inte händelsens, och de jämför på
tid och inte på antal eftersom ett antal glider så fort en gammal rad städas
bort. ⛔ **Samma jämförelse i båda**, eftersom knappens siffra och radens märke
måste stämma överens: säger knappen tre och tre rader inte är märkta blir
siffran något man slutar tro på.

`activityWindow(rader, { dagar, sida, rensatTill, sedd, lasta, nu })` avgör vad
listan ska visa. ⛔ **Tre gränser som gör olika saker**, och blandas de ihop blir
beteendet omöjligt att förutsäga: `dagar` är fönstret bakåt (en driftslogg svarar
på "kördes det nyligen", och en rad från i våras svarar inte på någon fråga man
ställer), `rensatTill` är läsarens egen städning, och `sida` är hur många som
ritas åt gången. ⛔ **Rensningen DÖLJER, den raderar inte**: raden finns kvar i
databasen, så den som undersöker något i efterhand ser hela historiken. En logg
man kan radera ur en flik är ingen logg. ⛔ **Olästa rader slipper alla tre.**

`unread(rad, { sedd, lasta })` och `unreadRows` väger in BÅDE tidpunkten och de
rader läsaren öppnat en och en. ⛔ **Två källor, eftersom det är två handlingar:**
"jag har sett listan" är en tidpunkt, "jag har läst DEN HÄR raden" är ett id.
Slås de ihop kan man inte läsa en gammal rad utan att också påstå sig ha läst
allt nyare än den. `activityId(rad)` är `id` när det finns och tidpunkten annars.

`groupByDay(rader, { nu })` delar listan i `ACTIVITY_SECTIONS`, alltså Idag,
I går, Senaste veckan och Äldre. ⛔ Räknar **kalenderdagar** och inte dygn om 24
timmar, samma sätt som `formatRelativeDate`: något som kördes 23:50 i går ligger
under "I går" klockan 00:10, eftersom det är vad läsaren själv kallar det. ⛔ En
rad med trasig tid faller till Äldre och **kastas aldrig**: att sortera bort det
man inte förstår är hur en logg tyst blir ofullständig. ⛔ En rad från framtiden
ligger under Idag, där den syns, eftersom den betyder att en klocka går fel.

`createCaseModel(config)` äger **formen** på ett inskickat ärende: att det har
en sort och en prioritet, bär vem som skickade in det och när, att `status` och
`resultat` tillhör servern och aldrig klienten, att etiketterna är basen plus
sorten plus prion, och att validering svarar med **skälen** i stället för ett ja
eller nej.

Appen äger **värdena**: vilka sorter som finns, vad de heter, vilken etikett de
får, vilka extra villkor just den sorten har (`requirements`) och vilka extra fält den
skriver (`extraFields`).

⛔ **Ett ord som "kvitto" får aldrig stå i modulen.** Ett kvitto är ett
bokföringsbegrepp i en viss verksamhet, inte en egenskap hos ärenden. Står det i
ramverket har ramverket tagit ställning till vad plattformen handlar om, och
nästa app måste antingen leva med vår vokabulär eller bygga sin egen modell vid
sidan av. Proven använder därför en påhittad taxonomi: skulle modellen råka bero
på appens ord hade den fungerat i proven och gått sönder i nästa app.

Konfigurationen kontrolleras vid uppstart, inte vid första användningen. En sort
utan `label` ger annars ett ärende som saknar sin märkning, och det felet syns
först i ärendesystemet: posten skapades, den hamnade bara aldrig där någon letar.

### Datalager

Ett CRUD-kontrakt med utbytbara adaptrar. **Vyerna vet aldrig var datan kommer
ifrån**, så källan är ett byte av en rad vid uppstarten: JSON i repot i dag,
Firestore i morgon, SQL bakom ett API sedan.

| | |
|---|---|
| `createDataSource(adapter)` | tar en adapter, vägrar en som saknar en operation |
| `createMemorySource(start)` | allt i minnet. Tester, utveckling, och innan källan bestämts |
| `createJsonSource({ bas })` | läser JSON-filer över HTTP. Läsbar, inte skrivbar |
| `applyQuery(rows, query)` | filtrering, sortering och gräns för adaptrar som håller allt i minnet |
| `OPERATIONS` | `read`, `list`, `create`, `update`, `remove`. `subscribe` är frivillig och står inte här |
| `createFirestoreSource({ db, sdk })` | Firestore. SDK:n skickas in, ramverket importerar den aldrig |
| `createPostgresSource({ query })` | Postgres, till exempel Cloud SQL. Appen skickar in en funktion som kör frågan |
| `createHttpSource({ basUrl, getToken?, load?, headers? })` | **ett eget API över HTTP, alltså REST.** Kontraktets fem operationer ÄR CRUD, så översättningen är en rad var, och vilken databas som står bakom API:et syns inte här. ⛔ `fetch` **kastar inte på 404 eller 500**, bara när anropet aldrig kom fram: den som skriver `await (await fetch(u)).json()` får serverns felsida parsad som data. Därför kontrolleras `res.ok` på varje operation, så kontraktets regel 2 håller. ⛔ **404 betyder olika saker för olika operationer**: på `read` är det `null` ("finns inte", regel 3), på `update` och `remove` är det ett fel, eftersom någon bad om en ändring av något som inte finns. ⛔ Felet bär `status`, så appen kan skilja 401 (logga in igen) från 500 (försök senare) utan att matcha på text. ⛔ Ett 200-svar som inte är JSON är ett fel, för en proxy eller ett inloggningsskal svarar 200 med HTML och en tyst `{}` hade blivit "inga poster". ⛔ Styrparametrarna heter `_sort`, `_order` och `_limit`: en samling med ett fält som heter `sortBy` hade annars krockat, och symptomet är inte ett fel utan en lista som ibland inte lyder. ⛔ Token hämtas **per anrop**, aldrig en gång vid uppstart, för en token som gick ut medan appen stod öppen ser ut som att allt slutade fungera av sig självt. ⛔ **Ingen `subscribe`**, med flit (CP 2026-09-22): ett REST-API kan inte pusha, och `useLiveCollection` rapporterar då `realtime: false` i stället för att en pollingloop låtsas. ⛔ GraphQL är en **annan adapter**, inte ett läge här: den har en endpoint och ett frågedokument, och vilka fält som hämtas är appens beslut |
| `createRoutingSource({ standard, routes })` | **väljer källa per samling.** Doktrinen är två databaser parallellt för olika ändamål, och den fördelningen går per samling, inte per app. Kräver en `standard`, så en glömd rutt blir "allt annat bor här" i stället för ett fel som dyker upp först den dag någon öppnar just den vyn. Kontrollerar varje rutt vid uppstart. ⛔ Realtid blir en fråga per samling: `canSubscribe(collectionName)` svarar, `subscribe` **kastar med samlingens namn** för en som inte kan, och `useLiveCollection` frågar först och rapporterar `realtime: false`. Att exponera realtid bara när alla källor kan hade släckt den överallt för en enda långsam källa; att exponera den alltid hade gett en lyssnare som aldrig levererar, alltså en vy som väntar för alltid |
| `OpsDataProvider` | ger appen sin källa |
| `useDataSource`, `useCollection`, `useDocument` | React-sidan, med `loading`, `error` och `data` åtskilda |
| `useLiveCollection` | samma som `useCollection`, men strömmande när källan kan. Se realtidsstycket nedan |

Fem regler gör kontraktet värt något:

1. **Allt är asynkront**, även minnesadaptern. Kontraktet får inte avslöja hur
   snabb källan råkar vara, för då skrivs anropsställen som går sönder vid byte.
2. **Fel kastas, de returneras aldrig som tomhet.** `fetch` kastar inte på 500,
   så utan den regeln visar appen "inga träffar" när den inte kunde fråga.
3. **`read` ger `null` för "finns inte", vilket inte är ett fel.** Skillnaden mot
   "kunde inte fråga" måste gå att hantera olika.
4. **Varje post har ett `id`.** Utan en gemensam nyckel kan delad kod inte veta
   vad som identifierar en rad.
5. **`subscribe` är frivillig.** Realtid är en egenskap hos källan, inte hos
   kontraktet. En JSON-fil i repot kan inte pusha, och att kräva metoden hade
   tvingat varje adapter att ljuga: antingen med en pollingloop som låtsas vara
   en ström, eller med en metod som kastar och därmed inte går att anropa.

⛔ **Ingen cache och ingen realtid som default, med avsikt.** Ett arbetsverktyg
behöver färsk data när man tittar på det, inte data som strömmar in medan man
läser. `useCollection` hämtar en gång och om på `update()`.

⛔ **`useLiveCollection` är undantaget, och det är en egen hook och inte en flagga.**
En inkorg är motsatsen till en rapport: den finns för att något ska dyka upp i
den medan man tittar. Men en flagga i ett optionsobjekt kan komma från en spread,
en konstant eller en prop, och då står valet inte längre i vyn som läser datan.
Ett eget namn måste skrivas ut på anropsstället, syns i en diff, och går att
räkna: `grep useLiveCollection` svarar exakt vilka ytor som strömmar.

Hooken returnerar `realtime: boolean`. Källor som inte kan prenumerera hämtar en
gång och säger det, i stället för att falla tillbaka i tysthet. **Den tysta
tillbakafallningen vore det farliga:** en app som tror sig ha realtid och inte har
det ser exakt likadan ut som en som har det, ända tills någon undrar varför en
post aldrig dök upp. Ett fel man bara kan misstänka, aldrig se.

`update()` startar om prenumerationen i stället för att hämta vid sidan av,
eftersom Firestore inte återansluter av sig själv efter ett avvisat lyssnande.

⛔ Den regel som avgör om datalagret är värt något är inte kontraktet utan
`check-data-layer`: **en databas-SDK får bara importeras i en adapter.** Alla
bygger ett datalager, och nästan alla får det förstört på samma sätt, nämligen
att en enda vy anropar något källspecifikt "bara den här gången".

### Inloggning och roller

Google Auth via Firebase, med samma mönster som datalagret: **ramverket
importerar ingen auth-SDK**, appen skickar in den.

| | |
|---|---|
| `createGoogleAuth({ auth, sdk, hamtaProfil })` | Google-inloggning. `hamtaProfil` läser appens egen användarlista och ger `role` |
| `createAuth(adapter)` | för en egen inloggning |
| `OpsAuthProvider`, `useOpsAuth` | inloggat konto, `loading`, `error`, `loggaIn`, `loggaUt` |
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
| `formatRelativeDate` | ålder i ord, räknad i kalenderdagar: 23:50 i går är "i går" klockan 00:10, inte "i dag" |
| `getTheme`, `setTheme`, `initTheme` | ljust, mörkt, följ systemet |
| `identityTone`, `initials`, `IDENTITY_TONE_COUNT` | deterministisk ton och initialer som inte klipper tecken |
| `urgency`, `splitTodayUpcoming` | härleder hur bråttom en händelse är ur dagar kvar, och delar en lista i Idag och Kommande. Försenat ligger i Idag, odaterat i Kommande. |
| `daysBetween`, `daysUntil` | kalenderdagar, inte dygn: 23.59 i kväll och 00.01 i morgon är en dag isär, och sommartidsskiftet finns inte att drabbas av. `daysUntil` svarar `null` på ett oläsligt datum och aldrig `0`, eftersom `0` betyder "idag" i hela kedjan och ett trasigt fält annars hamnar överst med full brådska |
| `dateKey`, `todayKey` | `YYYY-MM-DD` ur år/månad/dag respektive ur en `Date`, i LOKAL tid. ⛔ Inte `toISOString()`: den går via UTC, så 01.30 den 5:e blir "den 4:e" i svensk sommartid, och kalendern ramar in fel dag som idag mellan midnatt och två på natten |
| `rullriktning` | åt vilket håll man ska rulla för att nå ett element som lämnat rutan, som `"upp"` eller `"ner"`. ⛔ Jämför ÖVERKANT mot överkant: `IntersectionObserver` svarar i samma ögonblick som tröskeln korsas, så en jämförelse mot elementets nederkant är hårfin på just den pixeln och svarade «ner» nästan alltid |
| `monthGrid`, `months`, `perDay` | månadens rutor radvis med `null` före den 1:a (måndag är kolumn noll), månaderna kring en utgångspunkt, och posterna grupperade per datum. ⛔ Ren räkning utan JSX: att den 1 oktober 2026 är en torsdag är ett faktum om kalendern och inte om en komponent |
| `collectEvents` | slår ihop flera källors färdiga `OpsEvent`-listor till en läsordning: närmast först, odaterat sist, och inom samma dag det appens `ordning` sätter först. Mappningarna äger appen, sorteringen ramverket. ⛔ Odaterat sist är ett påstående: `null` är mindre än varje tal, så en naiv sortering lägger allt utan dag överst, precis framför det som brinner, och listan ser fortfarande sorterad ut |
| `readCaseFlow` | läser en ärende-ögonblicksbild och svarar med **tre** utfall, inte två: inget flöde ännu (inte ett fel, källan har inte svarat), flöde med noll poster (ett giltigt svar), och oläsligt flöde (ett fel med en orsak). ⛔ Den vanliga raden `(f && Array.isArray(f.items) && f.items) \|\| []` gör det tredje till det andra: ett trasigt flöde blir en tom lista, och vyn säger "allt klart" när sanningen är "det gick inte att läsa" |
| `splitMarkdown`, `splitInline` | delar markdown i block respektive en rad i text, fet text, kod och länkar. Rena funktioner, så de går att prova utan att rendera. ⛔ Gissar aldrig en länk ur "#183" och släpper aldrig igenom `javascript:`: en gissad länk ser likadan ut som en riktig ända tills någon klickar |
| `createPromptSource` | appens väg ut till en modell, som `createDataSource` är till en databas. Kontraktet är `{ prompt, context }` in och `{ text, tokens }` ut, utan ett enda leverantörsord. ⛔ Ett tomt svar KASTAR i stället för att rita en tom yta: skillnaden mot "anropet gick sönder" är skillnaden mellan att fråga igen och att ge upp |
| `isImage`, `sizeText`, `attachmentSize` | för att VISA en sparad bilaga. `attachmentSize` räknar tillbaka från lagrade tecken till en ungefärlig filstorlek, så base64-faktorn inte hamnar som en magisk 1,4 i varje app som visar en bilaga. `isImage` tar MIME-typen och inte filen, så samma fråga går att ställa om en fil man just valt och om en bilaga man läst ur en databas. ⛔ Själva inläsningen exporteras inte: en app som läser filer förbi `OpsFilePicker` har skaffat ett andra ställe som bestämmer vad som ryms |
| `MISSING` | vad som visas när ett värde saknas. Aldrig `0`, som är ett påstående om datan |
| `NUMBER_SPACE` | strippar det mellanslag `Intl` stoppar i tal. Vilket tecken det är beror på Node-versionen, så det får aldrig hårdkodas |

### Vad appen måste mata in

Ramverket vet ingenting om verksamheten. Allt det behöver veta kommer in genom en
`create*`-fabrik vid uppstart, och det här är hela listan.

| Fabrik | Appen måste skicka | Appen kan skicka |
|---|---|---|
| `createCaseModel` | `kinds`, `priorities`, `baseLabel` | `maxTitle`. Per sort: `requirements`, `extraFields` |
| `createCaseMirror` (nodsidan) | `owner`, `repo`, `label` | `summary`, `extraFields`, `fetcher` |
| `createActivityLog` | `kinds` | |
| `createActivityWriter` (nodsidan) | `model`, `append` | `kalla`, `nu` |
| `createRoutingSource` | `standard` | `routes` |
| `createFirestoreSource` | `db`, `sdk` | |
| `createPostgresSource` | `query` | `idColumn` |
| `createHttpSource` | `basUrl` | `getToken`, `load`, `headers` |
| `createJsonSource` | `bas` | `load` |
| `createGoogleAuth` | `auth`, `sdk` | `hamtaProfil` |
| `createAuth` | en adapter med `loggaIn`, `loggaUt`, `lyssna` | |
| `createDataSource` | en adapter med `OPERATIONS` | `subscribe` |
| `createMemorySource` | ingenting | `start` |

⛔ **Allt som är ett VAL är en funktion och inte en flagga.** `requirements`, `extraFields`,
`summary`, `ordning`: en flagga (`kraverBelopp: true`) tvingar ramverket att
veta vad ett belopp är, och då står appens ord i ramverket igen. En funktion flyttar
ingenting.

⛔ **Varje fabrik kontrollerar sin konfiguration vid uppstart**, inte vid första
användningen. En halv konfiguration kraschar annars först den dag någon råkar anropa
just den metoden, och felet pekar mot anropsstället i stället för mot uppsättningen.
`check-config-requirements` mäter det genom att anropa varje fabrik utan argument.

### Nodsidan: `@staiger/ops-framework/node`

En andra ingång, för det som behöver en token. Buntas **inte** för webbläsaren.

| | |
|---|---|
| `createActivityWriter` | vägen in i aktivitetsloggen för det som körs utan skärm: importskript, synkjobb, utlösare. Tar `model` (ur `createActivityLog`) och `append`, en injicerad skrivning, så ramverket får inget beroende till en databas. ⛔ `skriv` KASTAR ALDRIG, den svarar `{ ok, fel, orsak }`: en logg som kan sänka jobbet den loggar är värre än ingen logg, och alternativet, att varje anropsställe lindar sitt anrop i try, fungerar tills någon glömmer en gång. ⛔ `orsak` skiljer `utkast` från `skrivning`, eftersom det första är ett programfel och det andra är drift. ⛔ `misslyckades(utkast, fel)` finns för att en glömd `resultat: "fel"` lägger ett misslyckande i listan som ett lyckat jobb |
| `createCaseMirror` | speglar öppna ärenden med en etikett till en ögonblicksbild. Tar `{ owner, repo, label }` som konfiguration, plus `summary` och `extraFields` som **funktioner**: ett reguljärt uttryck i konfigurationen hade tvingat ramverket att veta att just den verksamheten skriver en rubrik som heter "Varför" i sina ärenden. ⛔ `load` kastar vid fel svar och svarar aldrig med en tom lista: ett 403 som blir `[]` ser exakt ut som "inga öppna ärenden". ⛔ Pull requests filtreras bort, eftersom GitHubs issues-API returnerar dem som ärenden och varje öppen PR annars hamnar i uppgiftslistan |

⛔ **Varför en egen ingång och inte bara en modul till.** Allt som når
`src/index.js` buntas för webbläsaren, alltså hamnar i varje besökares JS-fil.
Speglingen kräver en token. Gränsen upprätthålls av `check-node-side` och inte av en
kommentar, eftersom ett löfte om att en hemlighet inte läcker är värt exakt vad den
som råkar bryta det råkar minnas.

### Vakter

| Vakt | Vad den bevisar |
|---|---|
| `check-closed-api` läser strängar som strängar | `scripts/lib/kallkod.mjs` stryker kommentarer utan att tro att `accept="image/*"` är en. Den gamla strykaren slukade allt från snedstreck-stjärnan i strängen till nästa kommentarslut: synligt som en falsk positiv, osynligt som ett hål där riktiga brott passerade oläsa |
| `check-types` (`tsc --checkJs`) | JSDoc-typerna kontrolleras, och `.d.ts` följer med paketet |
| `check-docs` | varje exporterat namn och varje vakt är omnämnd i README, och antalet komponenter stämmer |
| `check-tokens` | sju regler i tokenkontraktet, plus golv mot fel fil |
| `check-exports` | den publika ytan stämmer med modulerna, inget internt läcker |
| `check-closed-api` | ingen primitiv tar `className`, ingen app lappar, ingen ad-hoc-färg |
| `check-css-build` | bygger CSS på riktigt och läser i resultatet |
| `check-fonts` | typsnittet hämtas med `<link>` i mallen, aldrig med en `@import` som ignoreras |
| `check-chart-colors` | diagrampaletten **mäts**, i båda lägen och mot ramverkets egna ytor. Den enda regeln i repot som inte går att bedöma med ögat: identitetstonerna såg rimliga ut och föll på tre av fem kontroller |
| `check-token-overrides` | en konsumentapps stilrot följer kontraktet |
| `check-scaffold` | en app skapas, installeras, kör sin egen grind och **mäts i en riktig webbläsare vid 390, 768 och 1280 px**, plus ett temapass som bevisar att mörkt läge når den renderade sidan och att reglagets tumme är målad ur tokens. ⛔ Noll reglage på de mätta rutterna är ett **brott** och inte en tystnad: mallens primitivsida har ett, så noll betyder att mätningen inte ser appen |
| `test-viewport-guard` | **bryter mot alla sex påståenden i layoutmätningen och kräver rött.** ⛔ Skrevs efter att `check-scaffold` visat sig vara den enda vakten i huset som ingen sett faila: ordet "scaffold" förekom noll gånger i `test-guards.mjs`, samtidigt som den bär hela mobilgolvet. Provar mot en HTML-fixtur med samma form som en ops-app, eftersom en defekt per scaffold hade kostat tio minuter för att bevisa en if-sats. Kräver en webbläsare och ligger därför i CI:s scaffoldjobb, inte i `npm run check` |
| `check-data-layer` | en databas-SDK importeras bara i en adapter, aldrig i en vy |
| `check-config-requirements` | **anropar varje `create*`-fabrik utan argument och kräver att felet nämner fabrikens eget namn.** ⛔ Kravet är namnet och inte "kastar något": en destruktureringskrasch ÄR ett kast, den ser ut som en kontroll, och den säger `Cannot destructure property 'db' of 'undefined'` i stället för vad appen glömde. Varje fabrik måste dessutom vara klassificerad, så en ny fabrik ingen tagit ställning till blir röd i stället för tyst utanför. ⛔ Fångade fyra av nio fabriker som bröt mot en regel som stod som text i tre filer |
| `check-node-side` | webbsidan rör inte `src/nodee/`, och nodsidans exporter är dokumenterade. Skiljer på **körimport** (hamnar i bundlen, alltså ett läckage) och **JSDoc-typimport** (når aldrig bundlen, men vänder beroendet så nästa person lägger körkod intill typen). Proven är undantagna, eftersom de måste nå koden de provar, och **omvägen genom dem är stängd**: ingen annan fil får importera provkatalogen, annars når nodsidan bundlen i två hopp. ⛔ Fångade två fel i sin egen PR: kontraktet låg på nodsidan, och undantaget för proven var först ett hål |
| `check-page-frame` | basskiktets `html`-regel reserverar rullningslistens plats (`scrollbar-gutter: stable`). ⛔ En enda CSS-rad som **ingen provsvit kan se**: jsdom kör ingen CSS och ingen komponent importerar tokenfilen, så raden kan försvinna med hela sviten grön. Utan den hoppar varje ops-plattform cirka 15px i sidled när listen slås av och på, och symptomet rapporteras inte som en bugg utan som att appen känns ostadig. Läser `html`-regeln och inte hela filen, och räknar en bortkommenterad rad som borttagen |
| `check-slider` | `.ops-reglage` målar tumme och skena ur tokens i BÅDA motorerna. ⛔ Samma osynliga felklass som `check-page-frame`: jsdom ritar ingen tumme, så `reglage.test.jsx` vore grönt även om hela blocket försvann. Utan det blir reglaget inte ostylat utan **fel stylat**, ritat i systemets accentfärg, alltså en färg utanför tokenkontraktet som inte byter med mörkt läge och är olika på olika maskiner. Kräver `appearance: none` på elementet separat (annars ritas webbläsarens egen skena under vår) och avvisar hårdkodade färgvärden i blocket |
| `check-kontrast` | varje text-mot-yta-par komponenterna använder klarar WCAG AA i BÅDA teman, 4,5:1 för brödtext och 3:1 för grafik. ⛔ Finns för att ett FANTOMTOKEN tog sig hela vägen förbi grinden: notischippet skrev `text-on-accent`, och `--color-on-accent` har aldrig funnits. Tailwind skriver då `color: var(--color-on-accent)`, som resolvar till ingenting, så texten ärver föräldern. I ljust tema såg det rimligt ut; i mörkt blev ljus text på krämfärgad yta, och det upptäcktes av en människa med en telefon. `check-token-overrides` läser appens CSS, `check-closed-api` bryr sig om vem som får ta emot `className`, och ingen av dem tittar på om ett token finns. ⛔ Paren står utskrivna och härleds INTE ur klasserna: en parser som gissar vilken bakgrund en text ligger på blir fel i första kapslade fallet, och en vakt som har fel ibland stängs av. ⛔ `ink-muted` ger 3,65:1 mot `raised` och bär därför aldrig information, bara dekor och avstängda kontroller |
| `check-adoption` | en pågående upprensning går framåt, aldrig bakåt |
| `test-guards` | **bryter varje regel ovan och kräver rött** |

⛔ Den sista är inte en extra finess. **En vakt ingen sett faila är en
förhoppning.** Vi har haft vakter som var gröna i månader för att de läste fel
fil, jämförde en lista mot en kopia av sig själv, eller blev gröna av tom indata.

#### Mobilgolvet mäts, det lovas inte

Alla tester utom ett kör i jsdom, och **jsdom lägger ingen CSS alls**. Där är
`hidden md:flex` osynligt: båda navigeringarna finns i DOM:en och testet kan
inte se vilken en användare faktiskt möter. Det hålet lät två navigeringar bära
samma namn i veckor utan att något blev rött.

Därför öppnar `check-scaffold` den byggda appen i Chromium vid **390 px** och
**768 px** och mäter tre saker som antingen är sanna eller falska:

1. **Sidan är inte bredare än fönstret.** Blir den det namnges elementet som
   sticker ut, med sina koordinater. Något som medvetet scrollar i sidled, som
   en tabell inuti ett kort, räknas inte.
2. **Exakt en navigering syns per bredd.** Bottenraden under `md`, toppraden
   från `md`. Två synliga samtidigt är två sanningar om var man klickar.
3. **`main` har botteninset minst lika stort som bottenraden.** Utan det ligger
   sista raden i innehållet bakom baren, och det upptäcks först när någon undrar
   var deras sista post tog vägen.

Och i ett andra pass vid 390 px, i **både ljust och mörkt läge**:

4. **Sidans bakgrund är en annan färg i mörkt läge än i ljust.** ⛔ Ingenting
   mätte det förut. `check-chart-colors` läser färgvärden ur tokenfilen, men att
   temaväxlingen faktiskt NÅR en renderad sida stod bara som ett löfte. Ett
   `@media (prefers-color-scheme: dark)`-block med ett stavfel i selektorn är helt
   tyst: filen ser komplett ut, sviten är grön, och appen är ljus i mörkt läge hos
   användaren.
5. **Varje reglage är minst 44px högt i den renderade rutan.** En klass som lovar
   `h-11` bevisar ingenting i jsdom, där `h-11` och ingenting alls ser identiska ut.
6. **Accentfärgen finns i varje reglages bild, i båda lägen.** Alltså att tumman
   är vår och inte webbläsarens egen i systemets accentfärg.

⛔ **Punkt 6 behövde en bild, och det är inte en pixeljämförelse.** Tumman finns
bara som ett leverantörsspecifikt pseudoelement och går inte att läsa: mätt,
`getComputedStyle(el, "::-webkit-slider-thumb")` svarar `rgba(0, 0, 0, 0)` för
bakgrunden och `129px` för bredden, alltså elementets egen ruta. Den vägen ser ut
att fungera och svarar med skräp. Mätningen fotograferar därför elementet och
räknar bildpunkter i accentfärgen: en 20px tumme ger 268 träffar, samma sida utan
tumregeln ger 0. Det är **en räkning av en färg**, inte en jämförelse mot en
referensbild, så den bryr sig inte om typsnitt, form eller kantutjämning och blir
inte röd av en avsiktlig designändring.

⛔ Går Chromium inte att starta blir vakten **röd**, inte överhoppad. Frestelsen
är att hoppa över tyst så att grinden går igenom på en maskin utan webbläsare,
men då är den grön av att inte ha tittat. Sätt `OPS_CHROMIUM` till en körbar
Chromium om den ligger på en egen plats.

**Appen kör samma mätning på sina egna sidor.** Mallappen har två rutter och
nästan inget innehåll, alltså låg mätningen först precis där problemet inte var.
Därför följer den med som ett kommando:

```bash
npx ops-viewport dist --routes /,/kostnader,/tillgangar,/schema
```

Rutterna är appens beslut; ramverket vet aldrig vilka sidor en plattform har.
Mätningen ligger redan i mallens `check` och `gate`, med bara `/` i listan, och
⛔ **den listan ska fyllas på**. Mäts bara startsidan är grinden grön för en sida
av tio, och det är exakt så horisontell scroll hann ligga kvar i en app tills
någon klickade igenom den för hand. `playwright` är en valfri peer: den finns i
mallens devDependencies, men webbläsaren hämtas en gång per maskin med
`npx playwright install chromium`.

#### Träffytan är 44 px på telefon

Klickbara ytor har `min-h-11` under `md`. På `md` och uppåt släpps golvet där det
gör layouten onödigt luftig, eftersom en muspekare är exakt och en tumme inte är
det. Det gäller även ytor som inte ser ut som knappar: en kryssrutas träffyta är
**hela raden**, inte rutan, och en utfällbar rubrik är 44 px hög även när texten
är mindre.

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
npm run check       # build, alla vakter, mutationsprov och tester
npm run check:all   # samma, plus en app som skapas och installeras på riktigt
```

---

## Struktur

| | |
|---|---|
| `CLAUDE.md` | arbetsreglerna. Läses alltid. Varje regel bär händelsen som skapade den |
| `skills/<name>/SKILL.md` | laddas vid behov, inte allt på en gång |
| `tokens/tokens.css` | tokenkontraktet, som är Tailwind-temat |
| `src/components/` | primitiverna |
| `src/lib/` | tema, identitet, formatering |
| `src/nodee/` | **nodsidan**, importeras som `@staiger/ops-framework/node`. Hit hör det som behöver en token, en filsökväg eller ett autentiserat nätanrop. ⛔ Ligger utanför webbundeln med flit: en token i bundlen är en token i varje besökares JS-fil. `check-node-side` gör det till rött bygge om webbsidan importerar härifrån |
| `scripts/` | vakterna |
| `create-ops-app/` | mallen som kopieras en gång |
| `adoption/` | **det enda stället som får veta vilka som använder ramverket.** Här beskrivs hur en namngiven plattform tar ramverket i bruk och vad som återstår i dess upprensning (`mobil-nav.md`, `ss-paritet.md`) |

### Varför skills och inte ett dokument

Ett dokument på 2000 rader läses inte. En skill på 150 laddas när den behövs.
Formen är hämtad ur SessionStudio, där den är den enda som visat sig hålla.

---

## Status

| Klart | Kvar |
|---|---|
| tokenkontraktet som Tailwind-tema, 205 tokens | auth, Firestore-regler och regeltester |
| 35 primitiver med stängt API, 111 beteendetester | observability: logger, larm till issue |
| åtta vakter plus mutationsharnesset, 29 regler bevisade röda | desktop-menyer för undersidor, om vi vill ha dem |
| `create-ops-app`, bevisad genom en riktig installation, mätt i Chromium vid 390 och 768 px | riktig telefon: mätningen ser layout, inte hur det känns i handen |
| adoptionsplan för den första plattformen, mätt mot dess repo | själva adoptionen, som väntar på profilbeslutet |
| skills: `css-and-components`, `web-app`, `testing`, `ci-and-guards` | skills: `firebase-data`, `auth-google-idp`, `observability`, `architecture-decisions` |
