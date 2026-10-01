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

⛔ **#167: `strokeWidth={1.5}`, inte Lucides eget förval (2).** SessionStudio
ritar sina lucide-ikoner tunnare (`apps/web/src/index.css:437-445`), avläst
i `tokens/sessionstudio-profil.json` ("ikoner"). `tokens.css` sätter samma tal
på `--icon-stroke-width` och en `.lucide { stroke-width: var(--icon-stroke-width) }`
i `@layer base`, så en apps EGNA direkta lucide-importer följer med.

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

**105 komponenter.** Alla har ett stängt API: ingen tar emot `className`, `style`
eller `...rest`. Ett okänt värde kastar med läsbar text i stället för att rendera
något godtyckligt.

#### Åtgärder och ytor

| Komponent | Props |
|---|---|
| `OpsButton` | `variant` primary \| secondary \| ghost \| danger, `size` sm \| md, `type`, `disabled`, `busy`, `fullWidth`, `iconOnly`, `href`, `newTab`, `ariaLabel`, `title`, `id`, `onClick`, `children` |
| `OpsCard` | `rounding` (`"kort"` 24 px, förval, eller `"bubbla"` 28 px). ⛔ TVÅ RADIER OCH INTE EN SKALA: `kort` för allt som är en RUTA (en panel, en sektion, en tabell), `bubbla` för det som är ett OBJEKT i en ström (en händelse, ett kort man bläddrar förbi). Skillnaden ska gå att se utan att jämföra, och ett tredje steg emellan gör att ingen av dem längre betyder något. Båda talen är MÄTTA mot SessionStudios `.rounded-app` (ops-framework#164): `kort` är `--radius-card` (24 px, ett namngivet token), `bubbla` är `--radius-3xl` (28 px, SessionStudios `--radius-bubble`). Kastar på en okänd rundning, eftersom en tyst reserv gör `"bubla"` till ett kort som ser nästan rätt ut. `tone` raised \| sunken \| plain, `kant` (förval `false`, #167), `elevated`, `flush`, `edge` 1-6, `edgeLabel`, `id`, `children`. ⛔ Inre padding är `--card-padding` (20px, #157, mätt mot SessionStudios `p-5`), ett token och inte en klass: `p-4` satt förut hårdkodat i komponenten, så en justering hade krävt en ändring per primitiv i stället för en rad i `tokens/tokens.css`. ⛔ **#167: `kant` förvalt `false`.** Kortet satte tidigare `border` ovillkorligt; SessionStudio skiljer ett kort från sidan med `tone` (tonskillnad), aldrig med en synlig kant. Sätt `kant` när en yta ändå behöver en, t.ex. mot en likfärgad granne |
| `OpsView` | `width` narrow \| normal \| wide \| full, `tillbaka` (0.31.0: `OpsHubTillbaka`s props, raden "‹ Hub / Sida" överst), `children`. Se [Sidchrome och sidnavigering](#sidchrome-och-sidnavigering-0310). |
| `OpsViewHeader` | `title`, `description`, `actions` |
| `OpsModal` | `oppet`, `onOpenChange`, `title` (krävs), `description`, `size` sm \| md \| lg, `footer`, `closeLabel`, `children` |
| `OpsDisclosure` | `summary` (krävs), `defaultOpen`, `oppet`, `onOpenChange`, `storageKey`, `badge`, `id`, `children` |

#### Formulär

| Komponent | Props |
|---|---|
| `OpsField` | `label`, `hint`, `error`, `required`, `labelSize` standard \| liten, `children`. ⛔ `liten` (0.32.1) är SS profilens etikett (10/400, dämpad, `ProfileView.jsx:245`); standard (14/500) är SS formulärens. |
| `OpsInput` | `value`, `onChange`, `type` text \| email \| search \| tel \| url \| password \| number, `placeholder`, `name`, `autoComplete`, `disabled`, `readOnly`, `maxLength`, `ariaLabel` |
| `OpsTextarea` | `value`, `onChange`, `placeholder`, `name`, `rows`, `disabled`, `maxLength`, `ariaLabel` |
| `OpsSelect` | `options` [{value, label, disabled}], `value`, `onChange`, `placeholder`, `disabled`, `ariaLabel` |
| `OpsDatePicker` | `value` ISO-datum, `onChange`, `placeholder`, `disabled`, `ariaLabel`, `clearLabel`. Öppnar en kalender som går att bläddra i även med ett valt datum, och ritas ovanför en `OpsModal` (`--z-dropdown` ligger över `--z-modal` sedan 0.31.0). |
| `OpsTimePicker` | `value` `"HH:MM"` (24 h), `onChange`, `disabled`, `allowEmpty`, `timAriaLabel`, `minutAriaLabel`. Timme och minut i två listor med ett kolon emellan, som SessionStudios `ThemedTimeSelect.jsx`. ⛔ **Formulär får aldrig använda rå `<input type="date">` eller `type="time">`**: de ritas av operativsystemet, ser olika ut överallt och går inte att sätta tokens på. Datum är `OpsDatePicker`, tid är `OpsTimePicker`, båda med ett värde som är en sträng och inte ett `Date`. |
| `OpsCheckbox` | `label`, `checked`, `onChange`, `disabled`, `hint` |
| `OpsToggleRow` | `label`, `value`, `on`, `onChange`, `offLabel`, `control`, `trailing`. Rad som tonas ned i stället för att bockas ur. ⛔ Ett filter, inte ett påstående: kryssrutan frågar "är det sant?", den här frågar "ska det räknas?". ⛔ `control` lägger en kontroll UNDER knappen; `trailing` lägger en kompakt kontroll LÄNGST TILL HÖGER på samma rad (t.ex. `OpsSimulatePopover` eller `OpsKnob`). Båda ligger UTANFÖR knappen: ett reglage inuti en `<button>` är ogiltig HTML, och draget hade bubblat upp och tonat ned posten man just simulerade. Ramen bor därför på ett omslag. Utan båda ritas ingen extra behållare. |
| `OpsFilePicker` | `value`, `onChange`, `maxChars`, `accept`, `paste`, `ariaLabel`, `labels` {valj, byt, taBort, klistra}. Välj en fil att bifoga: bild, PDF, kalkylark, kontoutdrag. Ger `{dataUrl, name, kind, chars, width?, height?}`. ⛔ Heter inte OpsImagePicker: en bildväljare som får ett kontoutdrag tvingar fram en skärmbild av ett dokument man redan har. Bilder krymps i steg, andra filer ryms eller avvisas med besked om vad man ska göra. ⛔ Lyssnar på inklistring i DOKUMENTET, för man klistrar in där blicken är, inte där fokus råkar ligga; två monterade väljare tar därför emot samma inklistring, och det är vad `paste={false}` finns till för. |
| `OpsRadioGroup` | `options` [{value, label, hint?}], `value`, `onChange`, `ariaLabel`, `name`, `columns` 1 \| 2. Ett val bland flera, alla synliga. ⛔ Nativa `<input type="radio">` under ytan, aldrig `<button role="radio">`: piltangenter, gruppering och "3 av 4" uppläst kommer gratis och blir fel i något hörn när de byggs för hand. Använd den när `OpsSegmented` tagit slut (den kastar vid fyra) och `OpsSelect` skulle gömma alternativen bakom ett klick. |
| `OpsSlider` | `label`, `value`, `onChange`, `min`, `max`, `zero`, `formatValue`, `step`, `resetLabel`, `hiddenLabel`. Dragreglage för att SIMULERA ett tal, inte mata in det. ⛔ `zero` är läget som betyder "som det är idag", och det måste gå att träffa EXAKT: därför en `Återställ`-knapp som blir inaktiv i stället för att försvinna (en knapp som försvinner flyttar allt bredvid sig) plus ett märke på skenan. ⛔ `formatValue` är obligatorisk: ett reglage som läses upp som "minus femton" säger inte minus femton vadå. Nativt `input type=range` under ytan, så touch, piltangenter och hela aria-värdefamiljen kommer gratis; tumme och skena målas i `.ops-reglage` i tokens, eftersom pseudoelementen inte finns som klasser. ⛔ `hiddenLabel` döljer ordet visuellt men behåller `<label htmlFor>`, för ett reglage som sitter i en rad som redan säger sitt namn. Ett `aria-label` hade tagit bort kopplingen mellan ord och fält för den som använder förstoring. |
| `OpsKnob` | `label`, `value`, `onChange`, `min`, `max`, `zero`, `formatValue`, `step`, `hiddenLabel`. Kompakt simuleringsratt (~28 px) för samma jobb som `OpsSlider`, men inline längst till höger på en rad. ⛔ Dubbelklick återställer till `zero` (ingen Återställ-knapp: den hade krävt bredd raden inte har). ⛔ Varm `laborera`-accent, inte blå systemaccent. ⛔ `formatValue` syns under ratten och ska vara kort (t.ex. "0 %" / "+25 %"); belopp hör hemma i radens värdekolumn. Nativt `input type=range` under den målade ratten. |
| `OpsSimulatePopover` | `label`, `value`, `onChange`, `min`, `max`, `zero`, `formatValue`, `step`, `resetLabel`. Dial-ikon längst till höger som öppnar en popover med full `OpsSlider` + Återställ. ⛔ Ytan är `bg-contrast-panel` (inverterad mot sidan) så reglaget inte smälter in i mörkt läge. ⛔ För mobil: den alltid synliga 28 px-ratten var för liten att ta i; raden ska vara lugn och reglaget komma fram på begäran (CP: popover-varianten). ⛔ Triggern speglar läget (nål + varm amber + %-bricka när ≠ noll) men är inte själv ett range-input. ⛔ Escape och klick utanför stänger; slidern får fokus vid öppning. Samma simuleringskontrakt som `OpsSlider`/`OpsKnob`. |
| `OpsFloatingSummary` | `label`, `value`, `tone`, `hint`, `onDismiss`, `dismissLabel`. Talet man laborerar med, som håller sin plats i fönstret. ⛔ Ytan är `bg-contrast-panel` + `.ops-contrast-panel` (inverterad mot sidan), samma kontrastidé som FAB. ⛔ `fixed` och inte `sticky`, och första försöket var fel: `sticky` nyper fast bara inom sin förälders scrollsträcka, så på en sida som scrollar i DOKUMENTET blev det en rad i flödet som inte flöt. SessionStudios motsvarighet står stilla av ett tredje skäl, att deras kalender är ett skal med fast höjd vars kolumner scrollar var för sig, vilket inte går att låna till en dokumentscrollande sida. ⛔ Invändningen mot `fixed`, att den täcker sista raden för alltid, gäller inte här eftersom APPEN visar den bara medan något är justerat. Komponenten bär inget eget villkor. ⛔ Bottnar ovanför bottenraden (`--bottom-nav-h` + `--safe-bottom`) och ligger på `--z-sticky`, inte `--z-chrome`. ⛔ EN STORLEK, TVÅ RADER: nuläget litet överst, det simulerade stort och tonat under. De två lägena är borta, eftersom det utfällda inte fick plats (tre texter på en rad delar på 320 px, och `truncate` åt upp namnet och hinten) och växlingen var en gest utan nytta mitt under ett drag. Namnet målas inte men finns kvar som skärmläsartext, annars är bubblan två nakna tal för den som lyssnar. Krysset är den enda knappen och bär `label` i sitt namn. |
| `OpsScrollArea` | `children`. En yta som rullar i SIG SJÄLV hela vägen ner till skärmens underkant, så att det som står ovanför den står still. ⛔ CP 2026-09-22: "Filterraden är fast i kalendervyn men den scrollar i listvyn." Kalendern hade fått en egen rullyta av ett annat skäl, och skillnaden mot listan var därför en tillfällighet och inte ett beslut. ⛔ HÖJDEN MÄTS, INTE RÄKNAS UR EN VIEWPORT-ENHET (0.32.1, CP 2026-09-30: "Kalender och idag går inte ända ner utan huggs av i botten"): toppen (avståndet till sidans topp, plus `scrollY` så talet inte ruttnar) läggs i `--fullhojd-topp`, och botten (bottenradens övre kant om `OpsBottomNav` syns, annars fönstret minus den säkra ytan) i `--fullhojd-botten`; höjden räknas i CSS ur dem. `100svh` följde inte raden när Safaris verktygsfält fälldes in. Mäts om vid `resize`, `orientationchange`, `visualViewport` och när något ovanför ytan ändrar storlek (`ResizeObserver`), en gång per bildruta. ⛔ På en dator är bottenraden `md:hidden` och räknas som frånvarande; ytan slutar då vid fönstret. En app med egen bottenrad sätter `data-ops-bottenrad` på sin `<nav>`. ⛔ GOLV `min-h-60` för den dag ytan hamnar långt ner på en kort sida, annars kan uttrycket bli noll och innehållet försvinna helt. ⛔ INGEN RAM, INGEN RUNDNING, INGEN EGEN BAKGRUND: en yta som når skärmens underkant och har en ram läses som en ruta som blivit avhuggen. ⛔ Delar mätningen med `OpsCalendar` genom `src/lib/fullHeight.js` i stället för att kopiera den; en kopia glider isär första gången någon rättar den ena. |
| `OpsSwitch` | `label`, `checked`, `onChange`, `disabled`, `hint` |

#### Data

| Komponent | Props |
|---|---|
| `OpsList` | `divided`, `ariaLabel`, `children` |
| `OpsBreakdown` | `groups` [{id, label, value, count, on, poster, note}], `onToggle`, `total`, `empty`, `offLabel`, `expandLabel`. En summa uppdelad i grupper som går att fälla ut och tona ned. ⛔ Den summerar ingenting själv: bara appen vet om ett intervall eller ett okänt belopp får räknas. |
| `OpsAttributes` | `rows` [{label, value}], `ariaLabel`. Vad vi vet om EN sak, fält för fält. ⛔ Tomma fält ritas inte och allt tomt ger `null`: ett bindestreck ser ut som ett mätt värde. Dubbel etikett kastar. Flera saker jämförda på samma fält är `OpsTable`, inte den här. |
| `OpsShareChart` | `segments` [{id, label, value, text, detaljer}], `ariaLabel`, `empty`. Hur en helhet är fördelad. ⛔ Duger inte för att jämföra närliggande värden: 18 mot 21 procent går inte att skilja som vinklar, då är det `OpsRankChart`. Högst sex bitar, sedan kastar den: en sjunde färg vore genererad, alltså omätt. Listan bredvid är inte en legend utan datan, och den är ett KRAV: tre av sex färger klarar inte 3:1 mot ljus yta och är tillåtna bara med synliga etiketter. ⛔ Ingen total i hålet: 130 px rymmer inte ett valutabelopp, totalen hör hemma i kortets rubrikrad. En bit med `details` fälls ut, och då är HELA raden knappen: en 44 px pil bredvid en 28 px rad gör listan halvannan gång högre utan att säga något nytt.
| `OpsRankChart` | `rows` [{id, label, value, text, niva, note}], `ariaLabel`, `max`, `empty`. Vad som är stort och vad som är smått, i ordning. ⛔ `level` (1 låg, 2 medel, 3 hög) är APPENS bedömning: var gränsen går är domän. Skalan är en nyans som mörknar, aldrig en regnbåge. Taket är största värdet, aldrig summan: mot summan blir varje stapel en strimma.
| `OpsEventList` | `events` [{id, titel, dagarKvar, pagar, nar, deadline, roll, slag, detaljer, url, atgard, skapadAv, skapad}], `onNavigate`, `ariaLabel`, `labels`, `empty`, `expandLabel`. Brådskan är härledd ur datumet, aldrig lagrad, och färgen bär den aldrig ensam. ⛔ `role` säger VEM, `kind` säger VAD FÖR SORTS sak, `when` hur långt bort och `deadline` vilken dag; skriv inte datumet i både `when` och `deadline`. Titeln äger sin egen rad så löptext aldrig får en halv skärmbredd. En rad med `details` får en chevron i kortets övre högra hörn (0.32.1: absolut, 44 px träffyta, ingen kolumn: titeln har kortets hela innerbredd). ⛔ Datumraden (`when`, `deadline`, `updatedAt`, länken) står vänsterställd direkt ovanför titeln, som SS (`TodayView.jsx:527`), aldrig högerställd. ⛔ `atgard` är appens egen kontroll på raden; har någon rad en och någon annan inte det måste listan säga vilka som går att göra något åt i `actionHint`, annars kastar den. En lista där vissa rader går att göra något åt och andra ser likadana ut lär läsaren att trycka på måfå. Förklaringen står EN gång över listan: mätt i bolag-ops blev en mening per rad tre identiska rader i följd och en tredjedel längre lista.. ⛔ VARJE HÄNDELSE ÄR EN BUBBLA, inte en panel: CP 2026-09-22, "samma mjuka SS-rundning på alla händelsebubblor". CP 2026-09-30 valde 24 px som SS (`--radius-card`, kortets förval), inte längre `rounding="bubbla"` (28 px). ⛔ `edge` (1-6) och `edgeLabel` PÅ HÄNDELSEN släpps igenom till kortets `edge`, så slaget kan synas som en matt vänsterkant à la SessionStudio. Kanten BYGGS INTE här: `OpsCard` har haft den hela tiden med kravet på ett ord inbyggt, listan gjorde den bara inte nåbar, och då hade varje yta som ville visa slaget fått rita sin egen. Vilket slag som är grönt är APPENS beslut: ramverket ritar kanten och tolkar den aldrig. | ⛔ 0.30.0 (#173): `skapadAv` ({namn, typ?}) och `skapad` (ISO) ger raden "Skapad av Namn, 29 sep 09:12" under titeln, i lokal tid (`skapadAvEtikett`, `sprak`); bara när BÅDA finns. En agent och en människa skrivs ut med orden via `OpsProvenance`.
| `OpsListRow` | `interactive`, `selected`, `href`, `onClick`, `ariaLabel`, `children` |
| `OpsTable` | `columns` [{key, label, numeric, tight}], `rows`, `caption` (krävs), `hideCaption`, `stickyHeader`, `empty` |
| `OpsStat` | `label`, `value`, `hint`, `tone` neutral \| success \| warning \| danger, `badge`, `fact`, `factLabel`, `source`, `updatedAt`, `onDrillDown`, `drillDownLabel` |
| `OpsEmpty` | `title`, `description`, `action`, `busy`, `busyLabel` |
| `OpsSpinner` | `size` sm \| md \| lg, `tone` current \| accent \| muted, `label`, `decorative` |
| `OpsDataView` | `loading`, `error`, `data`, `header`, `errorTitle` (krävs), `loadingLabel` (krävs), `missingTitle`, `children` **som funktion** | En vys tre datatillstånd, mätta i bolag-ops som **sex** vyer som skrev samma tre grenar för hand (fem rakt av, Översikt i en ternär). ⛔ Siffran stod först som nio, vilket var antalet vyer som skriver felbanderollen och inte antalet med hela formen. ⛔ Fel vinner över laddning: med flera läsningar kan felet komma medan en annan hämtar, och låter man laddningen vinna göms felet bakom en snurra som aldrig slutar snurra. ⛔ `loadingLabel` krävs och gissas inte fram, för "Hämtar" utan objekt är samma text i tolv vyer och då går det inte att se vilken av fem läsningar som hänger. ⛔ **Hämtat men tomt är inte hämtning som pågår**, och det är felet den handskrivna varianten faktiskt hade: `loading \|\| !data` ritar "Hämtar ..." för alltid när en läsning gick igenom men gav `null`, alltså påstår sidan att den arbetar när den gett upp. Det tillståndet får OpsEmpty med egna ord och `role="status"`, inte en röd banderoll: kontraktets regel 3 säger att `null` betyder "finns inte" och inte att något gick sönder. ⛔ **Utelämnas `data` görs ingen tomhetskontroll**, för `"data" in props` skiljer utelämnad från null; annars hade varje vy som läser fem listor fått tomhetsrutan fast allt gick bra. ⛔ Barnen är en FUNKTION: som nod hade React byggt dem innan grenen valdes, alltså hade `data.totals` kastat i precis det läge komponenten finns för |

#### Märkning

| Komponent | Props |
|---|---|
| `OpsPill` | `tone` neutral \| success \| warning \| danger \| info, `size` standard \| liten, `children`. ⛔ `liten` (0.32.1) är typbadgen: rollen `liten` (10/500) med `px-1.5 py-0.5`, SS inkorgens typbadge (`ChatInboxPanel.jsx:743`, 9/500). Standard är oförändrad. |
| `OpsCountBadge` | `count`, `text` (substantivet i skärmläsartexten), `placement` (`icon` på en ikonknapp, `corner` i hörnet på en flik, `inline` i en rad), `max` (99). ETT räknemärke för inkorgen, klockan, flikarna och panelens rader, samma storlek och färg överallt (ops-framework #97). ⛔ Utseendet är inkorgens gamla märke ord för ord (CP 18:10): 16 px högt, `px-0.5`, 8 px fet siffra med `tabular-nums`, i knappens hörn `-top-0.5 -right-0.5`, ingen ring. Två siffror breddar pillen, texten växer inte. Kapas vid "99+" medan skärmläsartexten säger det riktiga talet. ⛔ Färgen är `badge` / `badge-contrast` i båda teman, vaktad i check-kontrast, aldrig `bg-accent` (kräm i mörkt tema). ⛔ `icon` och `corner` sitter i samma hörn |
| `STATUS_TONES`, `statusTone(status)` | Vilken `OpsPill`-ton ett ärendes läge får: `ny` info, `hanterad` success, `avskriven` neutral, okänt neutral. ⛔ EN källa, så "Ny" har samma färg i Aktivitet och i Inkorgen (bolag-ops #363) |
| `OpsStatusDot` | `status` oppet \| pagar \| vantar \| klart \| akut, `label` (krävs). Färgprick för var ett ärende står, tänkt för en kortrubrik. ⛔ Ordet krävs och renderas alltid, som `sr-only` utom för `akut` som skriver ut det synligt: en färg går inte att läsa upp och är osynlig för var tjugonde man. Vyn måste visa ordet någonstans synligt, till exempel i utfällningen |
| `OpsMarkdown` | `text`. Renderar rubriker, stycken, listor, kryssrutor, citat, kod, tabeller och länkar som riktiga element. ⛔ Ingen HTML passerar en sträng: `dangerouslySetInnerHTML` finns inte, och bara `http`/`https` blir länkar. Kapar aldrig texten, det är datalagrets beslut |
| `OpsPrompt` | `source` (från `createPromptSource`), `label` (krävs), `hint`, `placeholder`, `context`, `sendLabel`, `waitingLabel`, `suggestions` [sträng], `onAnswer`. En fråga in, ett svar ut, renderat som markdown. ⛔ Vet inte vilken leverantör som svarar: modell, nyckel och tak är appens. ⛔ Förra svaret ligger kvar tills ett nytt kommit, även efter ett fel |
| `OpsActivityButton` | `entries` (nyast först), `kindLabel`, `kindIcon`, `title`, `label`, `lasning` {sedd, lasta, rensatTill}, `onSeen`, `onRead`, `onClear`, `dagar`, `sida`, `storageKey`, `icon`, `empty`, `filter`, `filterLabel`, `open`, `onOpenChange`, `renderTrigger`, `now`. Klockikon med ett märke, listan bakom den, och detaljen numera PÅ PLATS i raden (#158, se `OpsActivityList`). ⛔ Att fälla ut en rad markerar den läst: en egen kryssruta bredvid varje rad är ett andra klick för något man just gjort, och listor med den knappen lär folk att bocka av utan att läsa. ⛔ Antalet står i knappens NAMN och inte bara som en prick. ⛔ TVÅ SÄTT ATT SKÖTA LÄSNINGEN: `lasning` + `onSeen`/`onRead` lägger den där APPEN vill, till exempel i databasen, så den följer med mellan telefon och dator; `storageKey` lägger den i EN webbläsare. Ramverket väljer inte, eftersom bara appen vet om den har en plats. ⛔ `dagar` är fönstret bakåt, `sida` hur många som ritas åt gången, `rensatTill` läsarens egen städning. Olästa rader slipper alla tre. ⛔ #158: `filter` RITAS BAKOM EN FILTERKNAPP i huvudet, inte längre ovanför listan; syns inte förrän man tryckt. `onClear` ("Rensa") flyttade till en trepunktsmeny bredvid filterknappen, av samma skäl. ⛔ `kindIcon(slag)` (#158) är ikonen i radens runda platta, `kindLabel`s syskon; saknas den för ett slag ritas ingen platta på just den raden. ⛔ `open`/`onOpenChange`/`renderTrigger` (#158) styr panelen UTIFRÅN, t.ex. från en rad i skalets meny (`OpsAppShell props.meny`): `renderTrigger={false}` döljer klockan och kräver då `open`+`onOpenChange` (kastar annars), utan styrning fungerar knappen som förut |
| `OpsActivityList` | `entries`, `kindLabel`, `kindIcon`, `empty`, `lasning`, `onOpen`, `fler`, `onMore`, `now`. Listan utan knapp, för en app som vill ha aktiviteten på en egen sida. Delas i **Idag, Igår, Denna vecka, Äldre** (#158, samma ord som SessionStudio; hette tidigare "I går" och "Senaste veckan"): ett nattligt jobb skriver en rad om dagen, och efter en månad kräver frågan "kördes det i dag" att man läser tidsstämplar i en platt lista. ⛔ Raden är kort med flit: rubrik, detalj och när, plus en metarad (grupp som `OpsIdentity`, aktör, tid). Källan, det exakta klockslaget och hela feltexten står i `OpsActivityDetail`. ⛔ #158: OLÄST ÄR EN PUNKT, INTE PILLEN "Ny", med ordet kvar för skärmläsaren (`sr-only` "Oläst."). ⛔ #158: EN CHEVRON FÄLLER UT `OpsActivityDetail` UNDER RADEN i stället för att byta vy: en notis leder ofta ingenstans (inget GitHub-ärende, ingen händelse), och en pil som lovar en sida man kan GÅ TILL är fel löfte då. ⛔ Antalet står på "Hämta fler": ensamt säger det inte om det är tre rader eller trehundra kvar |
| `OpsActivityListActions` | `filter`, `filterLabel`, `onClear`, `clearLabel`. Filter- och mer-knapparna ur `OpsActivityButton`s huvud, exporterade separat (#166): en app som öppnar `OpsActivityList` direkt som en `undervy`-rad i skalets meny (i stället för `OpsActivityButton`, som lägger en egen, lös popover) sätter samma knappar själv, som radens `undervyAction`, se `OpsAppShell props.meny` och exemplet nedan |
| `OpsPanel` | `trigger`, `label`, `title`, `action`, `children` (en funktion som får `nav`), `open`, `onOpenChange`, `align`, `backLabel`. En panel med vyer i en STACK: rot, undervy, detalj. `nav.push({ key, title, action, content })` byter innehåll PÅ PLATS, `nav.pop()` går tillbaka. ⛔ Samma yta som hamburgermenyn och samma Radix-primitiv, eftersom panelen ska VARA menyn och inte likna den. ⛔ En panel och inte en modal: en modal mörklägger sidan, flyttar fokus och döljer bakgrunden för skärmläsare, och att göra det för att visa att ett jobb kört i natt är att avbryta någon för något som inte kräver ett svar. ⛔ Stacken nollställs vid stängning: öppnar man igen vill man se roten, inte den detalj man råkade läsa sist. ⛔ Ingen tillbakapil på roten, eftersom en pil som inte går någonstans är ett löfte som bryts vid första trycket. ⛔ PÅ TELEFON (under md) ligger en lätt dämpning (`bg-scrim`, `--z-scrim`) mellan sidan och panelen, under kromet (bolag-ops #363: sidans kort syntes bredvid och under panelens nederkant och såg ut att höra till den). Det är INTE en modal: ingen fokusfälla, sidan göms inte för skärmläsare, och ett tryck på dämpningen stänger bara panelen. Panelen har egen staplingskontext (`isolate`), ogenomskinlig `bg-raised` och `shadow-lg`. ⛔ #158: ROTEN RITAR INGEN EGEN RUBRIK PÅ SMAL SKÄRM (sheet). Sheetens `Dialog.Title` visar redan `label`, och en `OpsPanelHeader` med SAMMA `title` bredvid den var precis den dubblerade rubriken CP skärmdumpade i `OpsActivityButton`. `action` flyttar då till sheetens egen rad bredvid stängknappen. Bred skärm (rullgardin) är oförändrad, den har ingen annan synlig rubrik. ⛔ #158: PANELEN KUNDE STÄNGA SIG SJÄLV OMEDELBART när den öppnades utifrån (t.ex. en menyrad) medan en ANNAN Radix-yta just stängde och tog fokus med sig: `DismissableLayer` läste fokus som hamnat på `<body>` som "fokus utanför" och stängde panelen 10-15 ms efter att den öppnats. Mätt i en riktig webbläsare (Playwright), aldrig synligt i jsdom. `onOpenAutoFocus` och `onFocusOutside` avstyrs därför på rullgardinens `Popover.Content`; ett riktigt klick utanför (`onPointerDownOutside`) stänger fortfarande som förut |
| `OpsPanelRow` | `icon`, `label`, `badge`, `badgeText`, `chevron`, `onClick`, `href`, `active`. Menyraden. ⛔ Chevron BARA när raden leder vidare: en pil på en rad som bara växlar något lovar en vy som inte finns. ⛔ Hela raden är målet, inte chevronen: ett 16 px mål i högerkanten är det säkraste sättet att göra en lista som inte går att använda med tummen. ⛔ `badgeText` krävs för att antalet ska betyda något uppläst: en trea utan ord är en trea. ⛔ `href` (#157, #158) ritar en extern-länk-ikon i stället för en chevron och öppnar i ny flik: en `href` lämnar panelen, en chevron öppnar nästa vy i SAMMA panel, och kombineras aldrig (kastar annars). ⛔ TEXTEN ÄR `text-xs` (#164): mätt mot SessionStudios `AppHeader.jsx`, både "Meny"-dropdownens rader och notis-/aktivitetspanelens rader är 12px, aldrig `text-base` (16px), som stod här och var en tredjedel för stor. Aktiv rad byter FÄRG, inte vikt: `font-semibold` fanns inte i förlagans aktiva rad |
| `OpsPanelHeader` | `title`, `onBack`, `backLabel`, `action`. Huvudet i en undervy. ⛔ Utan `onBack` ritas ingen pil, alltså roten. ⛔ En pil och inte ett kryss: krysset stänger allt, pilen går ett steg |
| `OpsActivityDetail` | `handelse`, `slagord`, `now`. En rad i sin helhet, utan kapning. ⛔ Feltexten står hel i en kodruta: den kommer ordagrant från ett API och den som ska söka på den behöver den oförvanskad. ⛔ "Utfall" står bara när det gick bra, eftersom ett misslyckande redan sagts med ord överst och i rutan. ⛔ #158: `handelse.lank` ({href, etikett}) ritar en länk-knapp, annars ingen: "notisen leder ofta ingenstans" (CP), och en rad utan länk säger det genom att inte lova en knapp |
| `OpsTag` | `label` (bestämmer också tonen), `tone` 1-6 (låser tonen), `onRemove`, `removeLabel` |
| `OpsIdentity` | `name`, `seed` (krävs, stabilt id), `imageUrl`, `size` xs \| sm \| md \| lg \| avatar (28 px, alltid rund, 0.30.0), `rund` |
| `OpsProvenance` | `kind` human \| agent \| auto, `label` |
| `OpsRollmarke` | `kind` human \| agent \| auto, `label` (krävs, appens ord: "Du", "Förfaller", "Agent"). Rollmärket på en händelse, med SAMMA mått som brådskans "Försenat" (12/600, `px-2 py-0.5`, ur en delad konstant). ⛔ 0.32.1, CP 2026-09-30: bolag-ops hade tre handskrivna kopior som glidit isär (`py-1` mot `py-0.5`). Inte `OpsPill`: en roll är ingen severitet. |
| `OpsFact` | `kind` uppmatt \| uppskattat \| okant \| scenario, `label`, `value` |

#### Navigering och meddelanden

| Komponent | Props |
|---|---|
| `OpsAppShell` | `brand` (sträng eller `OpsBrand`), `nav` [{href, label, icon?, badge?, children?}] (den GAMLA modellen), `fasta` { idag: {href}, kalender: {href}, hub: {href} } och `moduler` [samma form som `nav`] (den NYA, 0.30.0, #173: se [Navigationen](#navigationen)), `sprak`, `closeLabel`. ⛔ `nav` och `fasta` får inte ges ihop och `moduler` kräver `fasta` (skalet kastar). Med `fasta` är toppraden Idag, Kalender, Hub (Hub med chevron-dropdown över modulerna) och bottenraden Idag, Kalender, ETT STORT PLUS, Hub, Meny; `primaryAction` får då inte ges (plusset är skalets). ⛔ EN POST MED `children` ÄR EN RIKTIG MENY I TOPPRADEN sedan 2026-09-22, inte en länk med en pil. CP: "Ekonomi är ingen dropdown. Sublänkar saknas." Raden ritade en chevron så fort posten hade barn, men posten var en naken `<a href>`: ett tryck gick till föräldersidan och menyn fanns inte. Barnen ritades bara i MOBILENS Mer-ark, så på en dator gick de bara att nå genom att först besöka föräldersidan. Det är samma regel som kalenderkortets chevron fick, tillämpad på navet: en pil som öppnar ingenting är värre än ingen pil, för den lär den som ser den att pilar i appen inte betyder något. ⛔ ETIKETTEN ÄR LÄNKEN OCH CHEVRONEN ÄR KNAPPEN, alltså två kontroller som gör var sin sak. Första versionen lade föräldern som första RAD i menyn så att sidan skulle gå att nå, och CP såg genast varför det var fel: "Men varför står Ekonomi två gånger?" Knappen sa Ekonomi och menyns första rad sa Ekonomi, tjugo pixlar isär. ⛔ Att posten inte får vara EN länk som också öppnar står kvar och är ett annat skäl: då är trycket tvetydigt, navigerade jag eller öppnade jag. Här ger platsen svaret. ⛔ `submenuLabel` namnger chevronen ("Visa sidorna under Ekonomi"), för en pil utan ord är en knapp som inte går att höra. ⛔ Raden finns bara från 768 px; chevronens träffyta är ändå 44 px, för en surfplatta är en tumme, `activeHref`, `onNavigate`, `actions`, `anvandare`, `primaryAction` {label, onClick, icon?}, `menuExtras`, `meny`, `menuLabel`, `navLabel`, `maxTopNav`, `maxTopNavSmal`, `children`. ⛔ `primaryAction` blir den runda knappen i bottenraden på telefon. På bred skärm finns ingen bottenrad, så appen sätter samma åtgärd i `actions` själv: skalet gissar inte var en knapp hör hemma i en topprad det inte äger. ⛔ `menuExtras` (tema/helskärm m.m.) landar i Mer-menyn, inte i åtgärdsklustret. ⛔ **`meny`** (#164, ANDRA GRANSKNINGEN: EN hamburgare, inte två) `{ sektioner?, onLoggaUt, appVersion?, rubrik?, loggaUtEtikett? }`: appens EGEN meny, ritad i SKALETS EGEN hamburgare (samma knapp som navigeringens överflöd, inte en andra bredvid avataren i `anvandare`-facket). Med `meny` ritas hamburgaren ALLTID, inte bara vid överflöd. Ordningen i panelen: `meny.sektioner` (appens rader, `MenyRad[][]`: `key`, `etikett`, `ikon`, `onClick`, `href`, `chevron`, `badge`, `badgeText`, ritade med `OpsPanelRow`), sedan navigeringens överflödsrader i en egen sektion, sedan `menuExtras`, sedan Logga ut, sist TVÅ dämpade versionsrader (appens `appVersion` och ramverkets, var sin rad, aldrig hopslagna med en punkt). Botten-Meny-arket (`OpsBottomNav`) ritar samma `meny`-innehåll i samma ordning. Utan `meny`: skalet fungerar som förut, bara överflöd och `menuExtras`. ⛔ **`skapa`** (#168, plusset som i SessionStudio) `SkapaKonfiguration { handelse?, arende?, registreringar?, lage?, kataloger?, ikonRitare?, sprak?, onKlar? }`, plus `skapaLabel`, `nyHandelseEtikett`, `nyttArendeEtikett`, `skapaTypEtikett`: en plusknapp mellan `actions` och `anvandare` som öppnar en POPOVER med en platt lista, aldrig en yta i sidan. `handelse`/`arende` är RAMVERKETS egna rader (Idag/kalendern och Inkorgen är ramverkets vyer, inte moduler) och ritas FÖRST; modulernas `registreringar` (samma kontrakt som `OpsSkapa`, #150/#153) ritas därefter, med en avdelare mellan de två grupperna. Ett tryck på en rad öppnar en PANEL i innehållskolumnen (0.31.0: se [Skapa är en panel](#skapa-är-en-panel-0310)), aldrig en modal och aldrig en andra vy inuti popovern. Utan `skapa`, eller utan något den kan visa, ritas inget plus alls |
| `OpsBottomNav` | `nav` [{href, label, icon?, badge?, children?}], `moreNav`, `activeHref`, `onNavigate`, `primaryAction` {label, onClick, icon?}, `menuExtras`, `menuLabel`, `navLabel`, `sheetLabel`, `closeLabel`, `badgeText`. Fast bottenrad under `md`, högst fem platser, Meny sist öppnar en sheet. ⛔ Med `primaryAction` ritas en rund knapp MITT i raden och en flik flyttas till menyn: mätt ryms inte fyra flikar plus Meny plus en knapp på 56 px i 390 px. Knappen är en åtgärd och hamnar aldrig i menyn. Renderas av `OpsAppShell` men kan användas fristående |
| `OpsHub` | `moduler` [samma form som `nav`, en nivå barn, plus `info?`], `activeHref`, `onNavigate`, `ariaLabel`, `tomRubrik`, `tomText`, `badgeText`, `sprak`, `ingetNyttEtikett`, `visaEtikett`, `ram`. (0.30.0, #173; 0.30.1 modulkort; 0.31.2: ritas i `OpsView`, `ram={false}` om appen redan lindat den) Appens moduler som ett rutnät av kort (`rounded-card`), ett kort utan barn EN länk med ikon, namn, räknare (`badge`, bara när den är större än noll) och en `info`-rad; ett kort med barn FÄLLS UT PÅ PLATS (knapp med `aria-expanded`, chevron som vrids, raden "Visa Ekonomi" till modulens egen sida och barnen som rader). Sidan Hub leder till; skalet ritar Hub-posten och dropdownen. ⛔ Tom lista visar text och aldrig en tom yta. Se [Hub och modulkort](#hub-och-modulkort) |
| `OpsHubModul` | `modul` (med `children`), `hubHref` (krävs), `hubEtikett`, `activeHref`, `onNavigate`, `brodsmulaEtikett`, `tomRubrik`, `tomText`, `badgeText`, `sprak`, `ingetNyttEtikett`. (0.30.1) En moduls egen sida i Hub: en fast tillbaka-rad ("‹ Hub / Ekonomi") och modulens barn som kort. Ritas av appen på modulens `href`. ⛔ Kastar utan `hubHref`; en modul utan barn visar text. Se [Hub och modulkort](#hub-och-modulkort) |
| `OpsGruppHubb` | `grupp` (krävs, den aktiva), `moduler` (krävs, de registrerade), `activeHref`, `onNavigate`, `sprak`, `info`, `badge`, `badgeText`, `ram`. (0.37.0, #184) Hubben för den aktiva gruppen: ett kort per modul i `grupp.moduler`, i gruppens ordning. En modul som inte ritas får en rad som säger varför. Se [Hubben per grupp](#hubben-per-grupp-0380-184) |
| `OpsModulSida` | `modul` (krävs, med `hubb`), `activeHref`, `hubHref`, `onNavigate`, `sprak`, `navEtikett`, `hubEtikett`, `children`. (0.37.0, #184) En moduls insida: tillbaka till hubben, modulens namn och en rad länkar, en per del. ⛔ Kastar för en modul utan `hubb`. Se [Hubben per grupp](#hubben-per-grupp-0380-184) |
| `OpsHubTillbaka` | `hubHref` (krävs), `etikett` (krävs, nuvarande sida), `steg` [{href, label}] (mellanliggande länkar), `hubEtikett`, `onNavigate`, `brodsmulaEtikett`. Tillbaka-raden som EN komponent (0.31.0; 0.31.2: SS textlänk): en textlänk "‹ Tillbaka" (chevron 20 px, `gap-2`, 14 px, som SS `GroupDetailView.jsx:83`) ett steg upp, ingen ram, ingen bakgrund, inte sticky, med `rubrik` ritas sidans namn som `<h1>` under. `OpsHubModul` ritar den, och VARJE sida under Hub ska rita den, via `OpsView tillbaka` eller direkt. Nya props `rubrik`, `tillbakaEtikett`, `tillbakaTillEtikett`. ⛔ Kopiera aldrig markupen: bolag-ops gjorde det i `UnderHub.jsx`, och kopian glida isär. |
| `OpsBrand` | ⛔ **0.31.0: märket är TEXT, inga bilder** (CP 2026-09-29: "Vi tar bort bilder, kör med text. Font: Glacial Indifference Regular. Colors: Light Gray och Gray Orange"). `namn` (rad 1, förval "OPS HUB", första ordet ljusgrått = `ink`, resten gråorange = `marke-accent`; eller `{ forsta, andra }`), `undertext` (rad 2: appens eller gruppens namn; tom = bara rad 1, centrerad lodrätt), `monogram` (förval första bokstaven i varje ord, "OH"), `storlek` (`"topp"` | `"stor"`, den senare är inloggningens). Typsnittet ligger i ramverket (`fonts/glacial-indifference/`, SIL OFL med licensfil), storlekar och spärrning är tokens (`--marke-*`, mätta i CP:s bild). I `OpsAppShell` är `brand` (sträng) märkets `namn` och rad 2 den AKTIVA GRUPPENS namn i versaler. ⛔ 0.38.0 (#203): i INFÄLLD gruppanel på dator (från `lg`) står OH kvar i rutan och gruppens namn bredvid, `OH | TRAVEL` (`data-marke="gruppnamn"`, avkortat med CSS vid ungefär 20 tecken, hela namnet i `title` och skärmläsartexten); utfälld är namnet rad 2 som förut, och på telefon ritas bara gruppmärket (ingen extra rad). Utan aktiv grupp (personen är inte med i någon) används `undertext` på appens egen `<OpsBrand undertext="..." />`. Borta sedan 0.30: `title`, `subtitle`, `mark`, `ordmarke`, `ikon`, `ordmarkeHojd`, `endastOrdmarke`, `OPS_HUB_VARUMARKE` |
| `OpsTabs` | `tabs` [{id, label, disabled}], `value`, `onChange`, `ariaLabel` (krävs), `children` |
| `OpsSegmented` | `options` [{value, label, badge}] (två eller tre), `value`, `onChange`, `ariaLabel` (krävs). Byter URVAL i samma lista, till skillnad från `OpsTabs` som byter innehåll.  ⛔ `icon` på ett läge ritar ikonen I STÄLLET för ordet, med ordet kvar som `sr-only`: en ikon utan namn är en knapp som inte går att höra. ANTINGEN ALLA LÄGEN ELLER INGET, annars kastar den — en ikon bredvid ett ord ser ut som ett fel |
| `OpsFilterChip` | `options` [{value, label}], `value`, `onChange`, `ariaLabel` (krävs), `allLabel`. Pillerformat filter bredvid en lista. ⛔ Valt värde står i pillret, annars läser man en beskuren lista i tron att den är komplett. |
| `OpsSectionLabel` | `children`. Sektionsrubrik: liten versal, spärrad, accentfärg (rollen `text-sektion` plus `uppercase text-accent`, se [Typografin](#typografin)). Mätt ur SessionStudios `ProfileView.jsx` ("PROFILBILD", "PERSONUPPGIFTER"), inte uppskattat (#157). ⛔ `OpsGruppvaljare`, `OpsMedlemmar`, `OpsProfil` och `OpsFilterPanel` skrev innan dess var sin egen variant av samma rubrik (olika storlek, olika färg); den här primitiven är den gemensamma formen framåt, migreringen av de fyra är inte gjord i samma pass |
| `OpsChip` | `icon`, `children` (ordet), `selected`, `onClick` (krävs), `disabled`. Ett VAL i pillform, inte ett filter: flera chips står bredvid varandra och trycks direkt, utan att något fälls ut (#157). Skiljer sig från `OpsFilterChip`, som är en TRIGGER som öppnar en meny. Mätt ur SessionStudios `ProfileView.jsx` (disciplin- och rollvalet): `rounded-full`, ikon, `aria-pressed` så läget är hörbart och inte bara en färg. Ingen inbyggd lista: appen sätter en `flex flex-wrap gap-2` runt chipsen själv |
| `OpsCalendar` | `entries` [{id, `date` `YYYY-MM-DD`, `title`, status?, url?, not?, `endDate`?, `allDay`?, `kalender`? {id, namn, farg 1-6}, `typ`?}], `ariaLabel` (krävs), `statusWords` {status: ord}, `monthsBack` (12), `monthsForward` (12), `emptyText`, `tidszon` (`STANDARD_TIDSZON`), `kalendrar` [{id, namn, farg, grupp?, forvald?}], `typer` [{id, namn}], `onSkapa(datum[])`, `onHanteraKalendrar`, `lagring`, `dagdekor(dayKey)` (0.37.0, plats för F6: `{ ton?, hornmarken? }`), `daglager(dayKeys)` (0.37.0, innehållet i dagpanelens lagerbubbla). **Löpande månadsvy som SessionStudios `CalView` (0.36.0, #179 F1)**: tolv månader bakåt och tolv framåt, öppnar på idag, klistrad veckodagsrad, flytande Idag-knapp med pil åt det håll idag ligger, måndag först. Rutan är ett kort med tokens rundning 12 px (`--radius-base`, vald 16). ⛔ **På telefon som SS-appen (0.37.0)**: siffran centrerad, idag en mörk cirkel, vald en mörk fylld ruta med ljus text, och märkena **prickar för endagsposter och streck för flerdagsposter i varje ruta de täcker**, i kategorins färg (slag, annars kalender), "+N" när de inte ryms, och inga ikoner i rutan. Från 640 px datumet uppe till vänster (idag som fyllt piller) och piller med titel. Det som varit är nedtonat. ⛔ Verktygsraden (högerställd från 768 px, SS `CalendarViewToolbar`; på telefon rena ikoner till vänster och kalenderpillret till höger som SS-appen, 44 px träffyta): **Kalendrar** (alla, eller valda av gruppens och mina; en post utan `kalender` hör till den förvalda; knappen "Hantera kalendrar" finns med `onHanteraKalendrar`), **veckonummer** (sparas per enhet i `lagring`, ett tryck på numret väljer veckan), **typ och status** i en meny, **sök** som tonar ned dagar utan träff och skriver ut antalet, också noll, och **+** (bara med `onSkapa`). En kontroll som inte gör något ritas inte. ⛔ Urval: tryck lägger till eller tar bort en dag, **dra-markering** med 12 px tröskel lägger till intervallet, **långtryck (450 ms) eller högerklick** öppnar snabbtitten, där poster som filtret döljer står med, märkta "Dold". ⛔ **Flerdagsposter och heldag är band per vecka från 640 px**, staplade i filer när de överlappar, med titeln i varje vecka; på telefon streck. ⛔ **Dagpanelen** (SS `CalendarView` och SS-appens `DayDetailPanel`, 0.37.0): datumpiller överst med var sitt kryss, **en bubbla med posterna** (rubrikerna Grupp och Mina när båda finns, tak 140 px och egen rullning), till höger antalet och en skapa-ruta, och under dem en egen bubbla för lager när `daglager` ger något; en tom dag är tryckbar och panelen säger "Inga poster" (punkt 5). Från 1024 px en kolumn bredvid rutnätet (300 px, 360 från 1280, alltid reserverad så rutnätet inte krymper under fingret); under 1024 px **flyter bubblorna över rutnätets nedre del**, utan egen yta, högst 45 procent av ytan, och rullytan får lika mycket luft i botten (0.36.0 staplade panelen under rutnätet). ⛔ RULLAR I SIN EGEN BEHÅLLARE med uppmätt höjd (`src/lib/fullHeight.js`, delad med `OpsScrollArea`). ⛔ VARJE KORT ÄR FÄLLBART: chevron när posten har status, url eller `details`, och aldrig annars. ⛔ Lager, tillgänglighet och export finns inte än (F4, F6) |
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
| `OpsIconLink` | `href`, `icon`, `label`, `onNavigate`, `badge`, `badgeText`, `active`, `avatar` (0.30.0: identiteten som en 32 px rund knapp med en 28 px rund avatar, ring vid hover; en `OpsIdentity` som `icon` görs `size="avatar"` åt dig). Ikonlänken är en 36 px cirkel med 44 px träffyta som osynlig yta. En destination som en ikon i åtgärdsklustret, för en yta man återvänder till och som har ett antal värt att se utan att gå in. ⛔ En länk och inte en knapp: högerklick och ny flik ska fungera. `label` krävs, annars läses adressen upp som namn. `badge` 0 ritar ingen räknare, för en nolla i en cirkel är en notis om att det inte finns någon notis. |

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
| `OpsBrand` | märket är text i två färger som byter ton med temat (ljust tema: `ink` och en mörkare orange som klarar 3:1), i stället för en bild per tema |
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
| `applyQuery(rows, query)` | filtrering, sortering och gräns för adaptrar som håller allt i minnet. `where` är likhet, `innehaller` (0.34.0) är ett listfält som innehåller värdet, högst ett per fråga |
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

### Inloggning och profil

⛔ **Avsnittet hette "Inloggning och roller" till 2026-09-27.** Det bytte namn
när profilen kom (#138), eftersom rollen inte längre är det enda inloggningen
ger: den ger också en rad i `users/{uid}` som personen själv äger.


Google Auth via Firebase, med samma mönster som datalagret: **ramverket
importerar ingen auth-SDK**, appen skickar in den.

| | |
|---|---|
| `createGoogleAuth({ auth, sdk, fetchProfile, emailLinkRedirectUrl })` | Google, PLUS Apple/e-postlänk/lösenord som VALFRIA förmågor (#164, korrigering B), se nedan. `fetchProfile` läser appens egen användarlista och ger `role` |
| `createAuth(adapter)` | för en egen inloggning. Normaliserar en adapter till FÖRMÅGOR: `signOut`+`subscribe` krävs, resten (`signInWithGoogle`, där `signIn` fungerar fortfarande bakåtkompatibelt, `signInWithApple`, `sendEmailLink`, `completeEmailLink`, `signInWithPassword`, `createAccount`, `resetPassword`) är valfria funktioner |
| `OpsAuthProvider`, `useOpsAuth` | inloggat konto: `user`, `loading`, `error`, `auth` (den normaliserade förmågelistan), `signOut`, `clearError` |
| `OpsAuthGate` | ritar `OpsInloggning` (se nedan) i utloggat läge, sitt innehåll för den som är inloggad och har rätt roll |
| `OpsInloggning` | `auth` (krävs, från `createAuth`/`createGoogleAuth`), `namn` (0.31.0, märkets rad 1, förval "OPS HUB"), `rubrik`, `etikett`, `viskning`, `lankar` [{label, href}], `appVersion`, `sprak`, `onSprak`, `fel`, `onRensaFel`. ⛔ **#164, KORRIGERING B, EXAKT FORM UR EN SKÄRMBILD AV SESSIONSTUDIO**: helskärm, `OpsBrand storlek="stor"` (0.31.0: text, rad 1 32 px) med `etikett` som rad 2 och `viskning` under, ett kort (`--radius-card`) med en Swe/Eng-pill, EN leverantörsrad per förmåga `auth` faktiskt har (ingen gissning, ingen rad utan sin förmåga), en "ELLER"-avdelare bara när det finns fler än en väg in, en primär pill till lösenordsformuläret, en sekundär pill "Skapa konto" (bara med `createAccount`), en textlänk till e-postlänksflödet (bara med `sendEmailLink`), och en sidfot med `lankar` + `appVersion` på samma rad |

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


#### Profilen och utloggningen

| | |
|---|---|
| `sakerstallAnvandare({ kalla, inloggad })` | läser `users/{uid}` och skapar raden **bara om den saknas**. Svarar `{ anvandare, skapad }` |
| `sparaInstallningar({ kalla, anvandare, andring, tillatnaPlattformar })` | skriver **allt personen själv äger**: `sprak`, `tema`, `namn`, `telefon`, `stad`, `presentation`, `lankar`, `bild`, `bildSokvag` (#156, `PERSONFALT`). Avvisar allt annat: e-posten är identiteten och kommer ur inloggningen, `id` är nyckeln. `tillatnaPlattformar` vidarebefordras till `byggAnvandare` för `lankar` |
| `andringen(anvandare, utkast)` | vad som skiljer utkastet från den sparade raden, över ALLA `PERSONFALT`. Beslutet ligger utanför vyn, se noten nedan. `lankar` jämförs som värde (`JSON.stringify`), inte som referens |
| `MAX_PRESENTATION` | 500. Taket `byggAnvandare` avvisar en längre presentation mot |
| `OpsProfil` | vyn, byggd med `OpsSectionLabel`, `OpsChip` och `OpsCard` (#156, #164, mätt mot SessionStudios `ProfileView.jsx`): huvud med stor avatar, namn, e-post och en valfri `props.roll`-pill ("Studio Admin", appens ord). **Profilbild** (uppladdning/borttagning/återställning, se `props.lagring` nedan, PLUS "Välj standardikon" och "Färg", se nedan), **Personuppgifter** (namn, telefon, stad, presentation), **Länkar** (plattform ur `props.plattformar` + url), språk (inte utseende och inte Logga ut: temaknappen i headern och menyns Logga ut är de enda platserna, #202), och mina grupper med roll. `props.children` ritas SIST, efter Länkar och före Spara: appens EGNA sektioner (SessionStudios kreativa profil, disciplin/roll/instrument, hör dit och INTE hit, se filhuvudet). ⛔ **BILDUPPLADDNINGEN SPARAS DIREKT, INTE BAKOM "SPARA"**: en uppladdning är redan en färdig handling. Samma sak för ikon-, färg- och "Använd initialer"-valen. Utan `props.lagring` (en `StorageSource`, se Lagring nedan) döljs bara UPPLADDNINGEN ("Byt"): ikon, färg, Ta bort och Använd initialer skriver bara `users/{uid}` (`ikon`+`farg`, två strängar ur `PROFILIKONER`/`PROFILFARGER` i `grupp.js`) och kräver INGEN Storage, så profilbilden fungerar i en app utan Storage konfigurerad (#164) |
⛔ **DET FINNS INGEN EGEN `<OpsMeny>` LÄNGRE** (#164, ANDRA GRANSKNINGEN, rättat från "korrigering A"). Den hade sin EGEN hamburgare i `anvandare`-facket, bredvid `OpsAppShell`s egen, alltså TVÅ hamburgare i samma toppräcke: en som öppnade navigeringens överflöd och en som öppnade menyn. SessionStudio har EN. Menyn är nu `OpsAppShell props.meny` (se ovan) och `OpsBottomNav props.meny`, ritad i skalets EGEN hamburgare. `src/components/OpsMeny.jsx` finns kvar som DELADE byggstenar internt (radvalidering, `OpsPanelRow`-rendering, Logga ut + versionsraderna), men exporteras inte från `src/index.js`.

⛔ **RADEN SKAPAS VID FÖRSTA INLOGGNINGEN OCH BARA DÅ.** Språk och tema bor i
databasen för att följa personen mellan enheter. Skrevs raden vid varje
inloggning skulle inloggningens uppgifter skriva över dem: du byter till mörkt
läge på telefonen, loggar in på datorn, och telefonen är ljus igen nästa gång.
Det felet ser inte ut som ett fel, det ser ut som att appen inte minns.

⛔ **NAMN OCH BILD UPPDATERAS INTE AV INLOGGNINGEN**, men är sedan #156
redigerbara AV PERSONEN SJÄLV, via `sparaInstallningar`. Frestande att låta
inloggningen skriva över dem, eftersom de kommer därifrån: men då är raden
inte längre personens egen, och den som redigerar sitt namn i appen får det
överskrivet nästa inloggning utan att något säger till.

⛔ **EN NAMN- ELLER BILDÄNDRING NÅR INTE AUTOMATISKT MEDLEMSLISTORNA.**
`sparaInstallningar` skriver bara `users/{uid}`. `memberships` bär
denormaliserade kopior av namn och bild (#138) och skrivs aldrig av en klient
(#136, `allow write: if false`). Appen som vill hålla dem i takt anropar
EFTERÅT en server-callable byggd på `uppdateraProfil`
(`@staiger/ops-framework/node`, se Nodsidan), som skriver `users` OCH alla
medlemskap för uid i samma steg.

⛔ **IDENTITETEN HAR ETT EGET FACK I SKALET**, `OpsAppShell props.anvandare`,
sist i klustret efter `actions` och före hamburgaren. Inte en `action` bland
andra: klarkriteriet säger "samma plats i varje app", och en fri slot hamnar
till vänster i en app och i en hamburgare i nästa.

⛔ **#164, ANDRA GRANSKNINGEN: AVATAREN ÄR ENSAM I FACKET, MENYN LIGGER I
SKALETS EGEN HAMBURGARE.** Mätt mot en skärmbild av SessionStudio (CP
2026-09-28, 17:55): avataren i toppraden är en direktlänk till profilen med
skärmläsarnamnet "Min profil", utan meny. Menyn ("Meny") öppnas av SAMMA
hamburgare som navigeringens överflöd, aldrig av avataren och aldrig av en
andra hamburgare bredvid den. Ett tidigare försök (`<OpsMeny>` med sin EGEN
`Popover.Trigger` i `anvandare`-facket) gav SessionStudio en extra hamburgare
den inte har, och rättades. Facket bär bara identiteten:

```jsx
<OpsAppShell
  brand={<OpsBrand undertext="Bolag Ops" />}
  nav={nav}
  activeHref={activeHref}
  anvandare={
    <OpsIconLink
      href="/profil"
      icon={<OpsIdentity name={anvandare.namn} seed={anvandare.id} imageUrl={anvandare.bild} size="sm" />}
      label="Min profil"
    />
  }
  meny={{ onLoggaUt: loggaUt, sektioner, appVersion: "bolag-ops v1.4.2" }}
>
  {children}
</OpsAppShell>
```

⛔ **#166: EN SEKTIONSRAD KAN ÖPPNA EN `undervy`, I SAMMA PANEL.** Mätt mot en
skärmbild av SessionStudio (CP 2026-09-28, 22:32): tryck på "Aktivitet" byter
menyns innehåll PÅ PLATS, huvudet blir en tillbakapil + "Aktivitet" som ny
rubrik, listan ritas där menyn nyss var. En tidigare version av `OpsActivityButton`
(`renderTrigger={false}` bakom en menyrad) löste inte det: den lämnade en
osynlig ankarknapp i `actions` och öppnade sin EGEN, lösa popover mitt i
toppraden, avskuren från menyn. `undervy` löser det rätt, utan `OpsActivityButton`:

```jsx
meny={{
  onLoggaUt: loggaUt,
  sektioner: [
    [
      {
        key: "aktivitet",
        etikett: "Aktivitet",
        ikon: <KlockIkon />,
        badge: olasta,
        undervy: <OpsActivityList entries={aktivitet} lasning={lasning} onOpen={las} />,
        undervyAction: <OpsActivityListActions onClear={rensaAktivitet} />,
      },
    ],
  ],
}}
```

En rad med `undervy` ritas ALLTID med chevron (sätts automatiskt, skriv aldrig
`chevron` för hand: det kastar utan `undervy`, se `MenyRad` i `OpsMeny.jsx`).
`href` och `undervy` kan inte kombineras: en rad lämnar appen eller stannar i
panelen, aldrig båda. Stängs menyn nollställs undervyn, så nästa öppning visar
roten. `OpsActivityButton` finns kvar, för en app UTAN `meny`: har skalet en
meny är `undervy` vägen, inte en andra, egen panel bakom en dold knapp.

⛔ **BESLUTET OM VAD SOM ÄNDRATS LIGGER I `andringen`, INTE I VYN.** `OpsSelect`
är en Radix Select, alltså ingen `<select>`, och går inte att driva med
`fireEvent.change` i jsdom. Ett prov som försökte stod grönt på
`not.toHaveBeenCalled` medan ingenting alls hade hänt. Logiken flyttades dit ett
prov kan se den, i stället för att få ett prov som inte kan faila.

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
| `byggSkapare` | `{ uid, namn, typ, kalla }` | **vem som skapade en post**, som fyra fält i stället för en fri sträng. ⛔ Fältet bar tidigare en e-postadress, och en adress går inte att kontrollera i en Firestore-regel: regeln har bara `request.auth.uid` att jämföra med, så länge fältet är en sträng är det ett PÅSTÅENDE. ⛔ `typ` (`manniska`, `agent`, `okand`) härleds ALDRIG ur `uid`: en agent kan ha ett eget konto och en människa kan skrivas in av ett importskript, så ett fält som ibland gissar är sämre än ett som alltid frågar. ⛔ Kastar på en okänd typ, eftersom ett stavfel som `"människa"` annars ligger i databasen och matchar ingenting. ⛔ Tomt `uid` blir `null` och inte `""`, för en regel som råkar jämföra två tomma strängar svarar sant |
| `laesSkapare` | ett värde ur databasen | läser fältet **oavsett form** och svarar alltid med den nya. ⛔ Finns för migreringsordningen: läsaren måste tåla den gamla strängen INNAN skrivaren byter, annars visar varje vy tomt för varje omigrerat dokument i samma sekund. ⛔ En gammal sträng blir `okand` och inte `manniska`, eftersom `"ops-agent"` skrevs i samma fält som e-postadresserna. ⛔ Kastar ALDRIG: läsaren körs i en vy, och en vy som kastar på en trasig rad tar ned hela listan |
| `skaparensNamn` | ett värde ur databasen | det som ska stå i en vy. ⛔ Faller till uid:ts första åtta tecken och aldrig till hela: ett uid är 28 tecken utan mening för en människa. ⛔ Ger tom sträng och aldrig ordet "okänd": vad tomheten ska heta är vyns beslut |
| `arGammalForm` | ett värde ur databasen | om fältet fortfarande bär strängen. För bakfyllnaden, som ska vara omkörbar och kunna räknas till noll |
| `validateKatalog` | en lista kategorier | **katalogen valideras vid UPPSTART**, i samma form som `validateNav`. ⛔ Vid uppstart och inte vid användning: en trasig katalogpost som upptäcks när någon öppnar ett filter är ett fel i knäet på användaren, vid uppstart är det ett fel för den som ändrade. ⛔ Kastar på två kategorier med samma `id`, eftersom de ser ut som EN i varje vy och raderna som pekar på den andra ritas med den förstas namn och färg. ⛔ En tom katalog är tillåten: det är läget före seedningen, och ett fel där gör appen omöjlig att starta första gången |
| `byggKategori` | `{ id, namn, farg, ikon, fas, texter }` | en kategori. ⛔ `id` ändras ALDRIG och `namn` får ändras fritt, eftersom varje rad i databasen pekar på `id`: vore namnet nyckeln förlorar en omdöpning kopplingen till allt som skrivits. ⛔ `farg` är en PALETTPLATS ur `SLAGPLATSER`, aldrig hex: en hex i konfigurationen följer inte med när mörkt läge eller en ny identitet kommer. ⛔ `ikon` är ett namn ur en tillåtelselista appen skickar in, eftersom ett fritt namn blir en tom ruta i vyn den dag någon stavar fel. ⛔ `id` tillåter inte punkt, versal eller mellanslag: punkten blir en sökväg i en Firestore-regel. ⛔ **`farger: false` när kategorierna skiljs åt med IKON** (#121): paletten har tre platser, en mätt gräns, så en katalog med fler kategorier än så kan inte ge dem var sin, och en väljare som tvingar fram dubbletter är värre än ingen. ⛔ **`faser: false` gör den till en SORTKATALOG** (#119): `fas` avvisas då i stället för att krävas, och blir `null`. Fasen finns för att en vy ska kunna fråga om en RAD är klar, och i en sortkatalog (uppgift, påminnelse, kvitto) avgörs det av radens egen status och aldrig av dess sort. En fas som ändå skickas in avvisas, eftersom två kategorier i samma katalog som skiljer sig åt gör svaret omöjligt att lita på. ⛔ **Ett okänt fält AVVISAS, det slängs inte** (#117): före det byggde funktionen sju fält och kastade resten utan ett ljud, mätt på en kategori skriven med `lofte` och `titleHint` högst upp, och den som skrev fick en grön uppstart och en tom rad i vyn. ⛔ **`groupId` ÄR OBLIGATORISKT (0.33.0, #162)**: förvalet är `grupp: true`, och en kategori utan grupp kastar. Bara en MALL (appens standardvärden innan de seedats in i en grupp) och en MODULS kodkatalog säger `grupp: false`, och då avvisas `groupId` i stället. Före 0.33.0 var det tvärtom, och en ny väg som glömde flaggan var ogrupperad utan att något blev rött. `check-gruppnyckel` bygger en kategori utan grupp och kräver ett kast |
| `texten`, `texter`, `textnycklar` | kategorin, en nyckel | **kategorins fria texter, var och en ett `Namn`** (#117). En kategori behöver fler ord än ett namn: plural i filtret, singular på raden, en kort form i smala kontroller, och för inkorgens sorter nio hjälptexter var. ⛔ En påse och inte fasta fält, eftersom VILKA texter som behövs är appens fråga och inte ramverkets. ⛔ `textnycklar` till `validateKatalog` säger vilka katalogen KRÄVER, och utan det kravet är "texterna tappas inte i flytten" ett löfte utan vakt: en kategori som läggs till i inställningsvyn föds annars utan hjälptexter och ger ett formulär med tomma fält och inga exempel. ⛔ `texten` svarar tom sträng och kastar aldrig, eftersom den körs i en vy, samma val som `beteendet` |
| `FASER`, `AVSLUTADE_FASER`, `arAvslutad` | | **det fasta skelettet bakom det fria**: `ny`, `aktiv`, `vantar`, `klar`, `avskriven`. Faserna är ramverkets och går inte att lägga till, så en vy kan fråga "är den klar" utan att veta vad kategorin heter hos just den kunden. ⛔ `vantar` är inte `aktiv`: skillnaden är om det ligger på oss eller på någon annan, och det man väntar på ska inte skava som något man borde göra. ⛔ `avskriven` är inte `klar`: den ena betyder gjort, den andra att någon tagit ställning till att inget skulle göras |
| `valjbara`, `kategorin` | katalogen | att läsa den. ⛔ Arkiverade faller bort HÄR och inte i varje vy, annars glöms filtreringen i den fjärde vyn någon skriver. ⛔ Lika `ordning` sorteras på namnet, annars ligger raderna i den ordning databasen råkar svara och listan byter ordning mellan två laddningar. ⛔ `kategorin` svarar `null` och kastar aldrig: en rad kan peka på en kategori som arkiverats, och en vy som kastar där tar ned hela listan |
| `byggNamn`, `text` | `{ sv, en }` | **ett namn är två språk, aldrig en sträng**. ⛔ `byggNamn` kastar utan `sv`, eftersom svenskan är reserven för alla andra språk och ett namn utan den har ingenting att falla tillbaka på. ⛔ `text` tar emot en STRÄNG också, av exakt samma skäl som `laesSkapare` gör det: läsaren måste tåla båda formerna innan skrivarna byter. ⛔ `text` kastar aldrig, den svarar tom sträng, för en vy som kastar på ett trasigt namn tar ned hela listan |
### Grupper och medlemskap

Fas 2.5 i [#92](https://github.com/cllp/ops-framework/issues/92), beslutat av CP
2026-09-27. Ramverket äger fyra samlingar. Appen skickar in namnen, precis som
för katalogen, så en kund senare kan bli ett eget Firebase-projekt utan att
datamodellen ändras.

| Samling | Innehåll | Skrivs av |
|---|---|---|
| `users/{uid}` | `byggAnvandare`: namn, e-post, bild, `sprak` ur `SPRAK`, `tema` ur `TEMAN`, och sedan #156: `telefon` (E.164 eller tom), `stad`, `presentation` (max `MAX_PRESENTATION`), `lankar` (`{ plattform, url }[]`, url https, plattform ur appens lista), `bildSokvag` | personen själv, bara sin egen rad |
| `groups/{gid}` | `byggGrupp`: namn `{ sv, en }`, `moduler[]`, `arkiverad`, `skapadAv`, och sedan 0.32.0 (#180) `farg` (ur `PROFILFARGER`), `ikon` (ur `GRUPPIKONER` eller `initialer:AB`), `bild` (lagringssökväg), `beskrivning` (max `MAX_GRUPPBESKRIVNING`), `ort` (max `MAX_GRUPPORT`), `epostsprak` (`sv`\|`en`). Tomma strängar och inte utelämnade fält | ⛔ **admin** ändrar utseende och uppgifter (`ADMINGRUPPFALT`), **ägare** även `moduler` och `arkiverad` (`AGARGRUPPFALT`), `id` och `skapadAv` ändrar ingen. Aldrig radering, arkivering |
| `memberships/{uid}_{gid}` | `byggMedlemskap`: `userId`, `groupId`, `roll` ur `ROLLER` (`agare`, `admin`, `medlem`), `typ` ur `MEDLEMSTYPER`, `status` ur `MEDLEMSSTATUS`, plus `namn` och `bild` | ⛔ **bara serversidan**. Sedan 0.32.0 LÄSER en aktiv medlem gruppens övriga medlemskap (medlemslistan), aldrig en annan grupps |
| `invitations/{id}` | `byggInbjudan`: e-post, gruppen, rollen, `status` ur `INBJUDNINGSSTATUS`, `skapadAv`, och sedan 0.32.0 (#180) `tokenHash` (SHA-256 i hex av engångskoden, eller tom sträng: koden lagras aldrig), `giltigTill` (ISO, `INBJUDNING_GILTIGHET_DAGAR` = 30 dagar), `skickad` (ISO eller tom) och `antalSkickade` | ⛔ **skapas bara av serversidan** (`bjudIn`), ägare och admin läser och kan återkalla (bara `status`). Flödet tas i [#137](https://github.com/cllp/ops-framework/issues/137), koden och utskicket i #180 (G3) |

⛔ **EXAKT EN GRUPPNYCKEL PER RAD.** Varje rad bär `groupId`, ett värde, aldrig
en lista. Läsregeln blir ETT uppslag: finns `memberships/{uid}_{groupId}` med
status aktiv.

Skälet är mätt någon annanstans och dyrt: SessionStudio bar `invitedGroupIds` på
raderna, alltså delning inbakad i datamodellen, och varje regel, varje fråga och
varje vy fick bära "eller någon av de här". Det går inte att ta bort sedan,
eftersom datan redan har formen. **`check-gruppnyckel` vaktar raden**, och den
vakten är billig i dag och omöjlig att eftermontera.

⛔ **Sammanslagning är inte delning.** Att se flera gruppers rader i samma vy
([#139](https://github.com/cllp/ops-framework/issues/139)) görs med en fråga per
grupp och en hopslagning i ramverket. Ingen rad ändras, ingen regel ändras.

⛔ **`memberships` skrivs aldrig av klienten.** Den som kan skriva sitt eget
medlemskap kan ge sig själv rollen ägare i vilken grupp som helst vars id hen
gissar. Serversidan skriver, med Admin SDK, förbi reglerna. Samma beslut som
SessionStudio ADR-019, och det enda stället i modellen där en klient inte får
skriva sin egen rad.

⛔ **Nyckeln härleds med `medlemskapsId(userId, groupId)`, den skrivs inte för
hand.** Vore id fritt kunde samma person och grupp få två rader med olika roll,
och vilken som gäller avgörs då av vilken regeln råkar slå upp. Ett härlett id
gör unikheten till en egenskap hos nyckeln i stället för en kontroll någon måste
komma ihåg. Ett inskickat id som inte stämmer avvisas, det rättas inte.

⛔ **Avgränsaren är `MEDLEMSKAPSAVGRANSARE`, alltså `|`, och den är ETT värde
som både `medlemskapsId` och regelfragmentet läser.** Den var ett understreck
till [#152](https://github.com/cllp/ops-framework/issues/152), och `ID_FORM`
tillåter understreck i ett id. Avgränsaren var alltså ett lagligt tecken i båda
halvorna, och nyckeln var tvetydig: `"a_b" + "c"` och `"a" + "b_c"` gav båda
dokumentet `a_b_c`. Två medlemskap kollapsade till ett, och vilken roll som
gällde avgjordes av vem som skrev sist.

⛔ **Felet var av den tysta sorten.** Ingenting kraschar. En person får fel roll
i en grupp, eller ser en grupp hen inte är med i, och det syns inte i en logg.

⛔ **`medlemskapsId` kastar ändå om någon halva innehåller avgränsaren.**
`ID_FORM` släpper inte igenom `|` i ett grupp-id, men `userId` är ett
Firebase-uid och alltså någon annans format: med en custom token är det fritt.
Att lita på en annan leverantörs format är ett antagande, i en kodrad som avgör
behörighet.

#### Vägen in för en ny person

Två steg, båda på serversidan, ur `@staiger/ops-framework/node`:

```js
import { createInvitationService } from "@staiger/ops-framework/node";

const tjanst = createInvitationService({ kalla });
await tjanst.bjudIn({ avUid, groupId, epost, roll });          // ägaren bjuder in
await tjanst.accepteraInbjudningar({ uid, epost });            // vid inloggning
```

1. **Ägaren bjuder in med e-post.** Finns personen redan som användare skrivs medlemskapet **direkt**, annars skrivs en rad i `invitations`. En inbjudan som väntar på en inloggning som redan skett är en rad ingen accepterar, och den som bjöd in ser en person som aldrig dyker upp.
2. **Vid inloggning** anropar klienten en gång. Serversidan matchar den inloggades e-post mot väntande inbjudningar och skriver medlemskapen. Efter det är det uid som gäller, aldrig e-posten.

⛔ **BARA NODSIDAN.** `memberships` skrivs aldrig av en klient, alltså är en callable med Admin SDK det enda som kan skriva dem. Låg funktionen i huvudingången vore den en yta en vy kunde anropa, och då vore `allow write: if false` en dörr med ett fönster bredvid.

⛔ **ÄGARSKAPET KONTROLLERAS I FUNKTIONEN, INTE BARA I REGLERNA.** En callable kör förbi reglerna. Vore kontrollen bara i `firestore.rules` vore funktionen en väg runt dem, och det är den vanligaste luckan i ett callable-baserat system.

⛔ **STEG 2 ÄR IDEMPOTENT.** Klienten anropar vid varje inloggning, eftersom den inte kan veta om något väntar. Andra körningen gör ingenting och kastar inte: ett fel där hade blivit en röd ruta vid varje inloggning för den som redan är medlem.

⛔ **E-POSTEN JÄMFÖRS I GEMENER, ALLTID.** `CP@Staiger.se` och `cp@staiger.se` är samma brevlåda och två strängar. Matchas de inte loggar personen in och möter en tom app utan förklaring.

⛔ **EN INBJUDANS ROLL GÅR INTE ATT ÄNDRA I EFTERHAND**, och inte dess grupp. En inbjudan är ett löfte som någon redan fått: höjs rollen blir en accepterad inbjudan till medlem plötsligt ett ägarskap, utan att den som accepterade såg det. Ska den ändras återkallas inbjudan och en ny skrivs.

**Vyerna:**

| | |
|---|---|
| `OpsMedlemmar` | listan per grupp: bjud in, ändra roll, ta bort. ⛔ **Aldrig sig själv**: den som tar bort sitt eget ägarskap låser ut sig ur sin egen grupp, och `migUid` är obligatorisk just därför. Utan den vet vyn inte vilken rad som är ens egen, och skyddet blir en gissning |
| `OpsGruppSida` | 0.32.0, #180 G2: gruppens detaljsida (SS `GroupDetailView`), se [Gruppkortet, detaljsidan och redigering](#gruppkortet-detaljsidan-och-redigering-0320-180-g2). `grupp`, `medlemmar` (ur `medlemsinfo`), `snabbval`, `onTillbaka`, `onRedigera`, `onVisaMedlem`, `children` |
| `OpsGruppFormular` | 0.32.0, #180: formuläret "Ny grupp" i skapa-panelen (`skapa.grupp`), se [Ny grupp](#ny-grupp-0320-180). `onSkapa` är appens anrop av `skapaGrupp`, `onSkapad(groupId, svar)` ger id:t att navigera med |
| `OpsUtanMedlemskap` | sidan för den som är inloggad men inte med i någon grupp. ⛔ **Aldrig en tom app**: en tom vy läses som trasig, och den som möter den hör av sig om fel sak. Sidan säger också vem man frågar, och har en utloggning för den som loggat in med fel konto. Sedan #161: med `props.onSkapaGrupp` ritas i stället en "Skapa din första grupp"-form (ett namnfält, `skapaEtikett`), för den som ÄR vitlistad men bara saknar en grupp än. Utan `onSkapaGrupp` är sidan oförändrad: kontakt plus utloggning |

⛔ **`kanAndra` i `OpsMedlemmar` är en artighet, inte ett skydd.** Samma not som i `OpsKatalogInstallning`: den som vill skriva ändå öppnar konsolen. Det riktiga låset är att `memberships` inte går att skriva från en klient alls, och att callablen kontrollerar ägarskapet själv.

⛔ **INGEN MEJLUTSKICK HÄR.** Mailmodulen ([#101](https://github.com/cllp/ops-framework/issues/101)) tar det när den finns. Tills dess säger inställningsvyn "be personen logga in".

#### Vitlistan och den första gruppen

[#161](https://github.com/cllp/ops-framework/issues/161), CP-beslut 2026-09-28
i [#160](https://github.com/cllp/ops-framework/issues/160): en vitlista av
e-postadresser styr vem som får logga in, och den som är vitlistad får skapa
sin FÖRSTA grupp från ett namn.

| Samling | Innehåll | Skrivs av |
|---|---|---|
| `vitlista/{epost}` | `byggVitlisterad`: `epost` (samma som dokumentets id, gemener), `tillagdAv`, `tid` | ⛔ **bara serversidan**, och ALDRIG ens LÄST av en klient |

⛔ **VARFÖR EN VITLISTA OCH INTE EN REGELGREN PÅ `groups`.** Ett `allow create`
för en grupp kollar normalt ägarskap, men den FÖRSTA gruppen har per
definition ingen ägare än: `opsArAgare(gid)` slår upp ett medlemskap som inte
finns förrän gruppen gör det. Frågan "får den här personen skapa NÅGOT alls"
måste alltså besvaras innan frågan om en gruppspecifik roll ens går att
ställa, och det är precis vad vitlistan svarar på.

⛔ **DOKUMENTETS ID ÄR E-POSTEN, GEMENER.** Samma skäl som överallt annars i
den här modellen: `CP@Staiger.se` och `cp@staiger.se` är samma brevlåda och
två strängar, och ett härlett id gör unikheten till en egenskap hos nyckeln.

⛔ **`vitlista` GÅR INTE ENS ATT LÄSA FRÅN EN KLIENT** (`regelfragment()`:
`allow read, write: if false`), till skillnad från `groups` och `invitations`
som en medlem respektive en ägare FÅR läsa. Läste en klient listan såg den
varje adress som någonsin bjudits in att skapa en grupp, alltså en lista över
precis vilka adresser det är värt att gissa lösenord för.

```js
import { createGroupService } from "@staiger/ops-framework/node";

const tjanst = createGroupService({ kalla, kataloger: { handelsetyper: HANDELSETYPER, sorter: { standard: SORTER, faser: false, farger: false } } }); // kalla MÅSTE ha batch
const svar = await tjanst.skapaGrupp({
  uid,
  epost,
  grupp: { namn: "Mitt bolag", farg: "3", ikon: "portfolj", beskrivning: "", ort: "Visby", epostsprak: "sv" },
  inbjudningar: [{ epost: "kollega@exempel.se", roll: "admin" }, { epost: "ny@exempel.se" }],
});
// svar: { groupId, tillagda: [...], inbjudna: [...], fel: [{ epost, fel }] }
```

`skapaGrupp({ uid, epost, grupp, inbjudningar?, skapadAv? })` (0.32.0, #180: `namn` är ersatt av `grupp`, ett objekt med `namn` och de valfria `farg`, `ikon`, `bild`, `beskrivning`, `ort`, `epostsprak`):

1. Läser `vitlista/{epost}` (gemener). Finns raden inte kastas det, med skälet.
2. Validerar `inbjudningar` och `grupp` (`byggGrupp`) INNAN något skrivs. En adress som inte är en adress, eller rollen `agare`, kastar med "Inget har skrivits". Skaparens egen adress och dubbletter tas bort tyst.
3. Härleder ett grupp-id ur namnet (en slug plus en kort svans, så "Bolaget" och "Bolaget" inte krockar och den ena tyst ersätter den andra, se `DataSource.create`).
4. Skriver gruppen, ägarens medlemskap (roll `agare`, personens `namn` och `bild` ur `users`) OCH gruppens kataloger ur appens standardvärden (`kataloger`, om appen angav dem) i EN `kalla.batch`, allt eller inget (0.33.0). Varje kategori byggs med gruppens `groupId` och nyckeln `katalognyckel(groupId, id)` innan batchen, så en trasig standardkategori kastar innan något är skrivet. Den nya gruppen har alltså sina kategorier i databasen innan `skapaGrupp` svarar, och första vyn läser dem därifrån. ⛔ Ramverket ändrar aldrig en grupps kategorier i efterhand: standardvärdena är startpunkten, gruppen äger sin kopia. `kataloger` prövas redan när tjänsten byggs.
5. (Före 0.33.0 seedades katalogerna här, efter commit och en skrivning i taget: föll en fanns gruppen med en halv katalog.)
6. Bjuder in var och en via `bjudIn`, EFTER commit och best effort: en adress med konto blir ett medlemskap direkt (`tillagda`), annars en väntande inbjudan (`inbjudna`). En inbjudan som faller hamnar i `fel` med skälet och gör inte att gruppen faller. ⛔ **Tomhet är ett svar:** utan inbjudningar är alla tre listorna tomma, aldrig utelämnade.

⛔ **EN PERSON KAN SKAPA FLERA GRUPPER (0.32.0).** Spärren "en grupp per person, tills [#162](https://github.com/cllp/ops-framework/issues/162)" är borttagen: gruppanelen, växlaren och plusset har ytan för fler än en. Vitlistan är fortfarande grinden.

⛔ **`kalla.batch` KRÄVS, OCH DET ÄR EN BRYTANDE ÄNDRING FÖR APPENS ADMIN-ADAPTER.** Före 0.32.0 var "samma batch" två sekventiella anrop, och ett fel mitt emellan lämnade en grupp utan ägare: en rad ingen kan läsa och ingen kan ta bort (`delete: if false`). Datakontraktet har nu en FRIVILLIG `batch(ops)` (`src/data/contract.js`, regel 6) med `ops` som `{ op: "create", collection, data }`, `{ op: "update", collection, id, data }` eller `{ op: "remove", collection, id }`, och svaret är en lista i samma ordning (posten, `null` för en `remove`). `createGroupService` avvisar en källa utan `batch` när tjänsten byggs. `createMemorySource` har den (återställer hela lagret vid fel), `createFirestoreSource` har den när SDK:n har `writeBatch`. En Admin SDK-adapter (i appens functions, ramverket importerar aldrig Admin SDK) skriver den som `db.batch()` med `set`/`update`/`delete` och `commit()`.

⛔ **BARA NODSIDAN, SAMMA SKÄL SOM `createInvitationService`.** En callable
kör med Admin SDK, förbi reglerna, och kontrollen ligger i FUNKTIONEN och inte
bara i regeln: `vitlista` har ingen regelgren att kontrollera mot över huvud
taget.

`OpsUtanMedlemskap props.onSkapaGrupp` (namnet, se ovan) kopplas till den här
funktionen via appens egen callable (den anropar `skapaGrupp` med `grupp: { namn }`), precis som `OpsMedlemmar props.onBjudIn`
kopplas till `bjudIn`. `byggVitlisterad` och `medlemskapsId` är återexporterade
ur `@staiger/ops-framework/node` för den som skriver appens EGEN vitlista-yta
(en administratörssida läggs till i #162): att skriva raden är fortfarande
appens Admin SDK, inte ramverkets, precis som inbjudan.

#### ⛔ E-posten lämnar aldrig `users`, och medlemslistan visar namn och bild

Beslut A i [#138](https://github.com/cllp/ops-framework/issues/138), architect
2026-09-27. Klarkriteriet löd först "ingen läser en annans e-post utan att vara
medlem i en gemensam grupp", och **det går inte att skriva som Firestore-regel**:
villkoret kräver en iteration över mina medlemskap, och en läsregel på
`users/{uid}` får ingen grupp-parameter att bygga uppslaget av. Det enda som gick
utan iteration var "alla inloggade läser alla profiler", och då bär `users`
e-postadresser åt vem som helst som är inloggad någonstans.

| Vad | Var |
|---|---|
| e-post | `users/{uid}`, läses bara av sig själv |
| namn och bild i en medlemslista | `memberships`, denormaliserat av serversidan |

Kriteriet är omskrivet till det mätbara: **e-posten lämnar aldrig `users`, och
medlemslistan visar namn och bild ur `memberships`.** Regelprovet finns:
`rules/__tests__/grupper.test.mjs` kräver att en annan inloggad inte kan läsa
`users/{någon annan}`.

⛔ **Att namnet kan bli inaktuellt är redan modellens beteende.**
`sakerstallAnvandare` rör inte namnet efter första inloggningen, så ett namn som
släpar efter Google är ingen ny avvikelse. Priset är litet och synligt, till
skillnad mot ett nätverksanrop per vy (en callable som itererar) eller en
e-post som är läsbar för alla inloggade.

#### ⛔ Gruppens moduler valideras mot de registrerade, på skrivvägen

`byggGrupp(rad, kandaModuler)` avvisar ett modul-id som inte finns bland de
installerade. Utan den kontrollen sparas ett skrivfel som en flik ingen hittar.

⛔ **Argumentet är valfritt, och det är två olika frågor och inte en halvmesyr.**
Den som SKRIVER en grupp måste avvisa ett påhittat id. Den som LÄSER en gammal
rad måste tåla att en modul avinstallerats sedan raden skrevs, för annars ligger
appen nere för den gruppen utan väg till en som fungerar. Läsvägens svar är
`navForGrupp`, som skriver ut `saknade`. Står det `byggGrupp(rad)` i något som
sparar är det ett hål.

#### Reglerna genereras, de skrivs inte per samling

Firestore-regler har ingen import. Utan generering blir "du måste vara medlem i
radens grupp" en textsnutt någon klistrar in per samling, och den dagen villkoret
ändras sitter den gamla versionen kvar i de samlingar ingen kom ihåg.

```js
import { regelfragment, gruppadSamling } from "@staiger/ops-framework";

const text = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
${regelfragment()}
${gruppadSamling("handelser")}
${gruppadSamling("konfig", { agareKravsForSkrivning: true })}
    match /{document=**} { allow read, write: if false; }
  }
}`;
```

`regelfragment()` ger hjälpfunktionerna (`opsArMedlem`, `opsArAgare`) plus
blocken för de fyra samlingarna. `gruppadSamling(namn)` ger ett block för en av
**appens** samlingar.

⛔ **Funktionsnamnen är prefixade med `ops`**, eftersom appen har egna
hjälpfunktioner och en krock syns först när reglerna deployas, alltså i
produktion.

⛔ **`groupId` vaktas på båda sidor av en uppdatering.** Kontrolleras bara den
ena kan en rad flyttas till en grupp man inte är med i, eller ut ur en man är
med i, och det är samma hål från var sitt håll.

⛔ **Inga JWT-claims.** En claim ligger i en token som redan är utdelad, så en
borttagen medlem är kvar tills token förnyas.

⛔ **`users`-blocket bär sedan #156 en `keys().hasOnly([...])`, exakt
`ANVANDARFALT`** (`src/lib/grupp.js`), splittad i `allow read, delete`
(inget `request.resource` där) och `allow create, update` (där `hasOnly`
faktiskt går att utvärdera). `check-gruppnyckel.mjs` vaktar att de två
listorna inte glider isär.

#### Lagring: profilbilder, ramverkets första Storage-yta (#156)

Samma snitt som Firestore, bredvid `kalla`: ramverket äger MAPPNINGEN, appen
äger KOPPLINGEN och känner sin bucket och sitt sökvägsprefix.

| | |
|---|---|
| `createStorageSource(adapter)` | kontrollerar att en adapter har `laddaUpp` och `taBort`, precis som `createDataSource` |
| `STORAGE_OPERATIONS` | `["laddaUpp", "taBort"]` |
| `createMemoryStorage(seed)` | i minnet, för prov. `laddaUpp({ sokvag, fil })` ger `{ url, sokvag }`; `taBort(sokvag)` |
| `createFirebaseStorageSource({ storage, sdk })` | mot Firebase Storage. Ramverket importerar `firebase/storage` ALDRIG, appen skickar in `getStorage(app)` och hela SDK-modulen, precis som `createFirestoreSource`. `taBort` sväljer `storage/object-not-found` (en borttagning ska gå att köra två gånger), alla andra fel kastas |
| `lagringsregelfragment({ prefix })` | Storage-regelfragment som text, `prefix` förval `"profilbilder"`: bara sin egen sökväg (`request.auth.uid == uid`), bara bilder (`contentType.matches('image/.*')`), 2 MB tak (`request.resource.size`). Limmas in i appens `storage.rules`, precis som `gruppadSamling` limmas in i `firestore.rules` |

```js
import { createFirebaseStorageSource, lagringsregelfragment } from "@staiger/ops-framework";
import { getStorage } from "firebase/storage";
import * as storage from "firebase/storage";

const lagring = createFirebaseStorageSource({ storage: getStorage(app), sdk: storage });
// lagringsregelfragment() -> limmas in i storage.rules, appen deployar
```

⛔ **`OpsProfil` döljer Profilbild-sektionens knappar helt utan `props.lagring`.**
Ramverket fungerar fortfarande utan Storage, samma linje som resten av huset:
`tam` behöver inte Firebase för att använda en knapp den inte trycker på.

⛔ **STORAGE-EMULATORPROV FINNS INTE ÄNNU.** `lagringsregelfragment` provas som
text (`src/__tests__/grupp.test.js`), inte mot en riktig Storage-emulator.
`rules/__tests__/` kör bara Firestore-emulatorn i dag.

#### Hela regelfilen ur manifesten

[#130](https://github.com/cllp/ops-framework/issues/130). `generateRules(moduler, { namn, extra })`
ger hela `firestore.rules` ur modulernas manifest: ramverkets fragment, ett
block per modulsamling, appens egen text, och catch-allen sist.

```js
import { generateRules, validateModuler } from "@staiger/ops-framework";

const moduler = validateModuler([ekonomi, liv]);
fs.writeFileSync("firestore.rules", generateRules(moduler, { extra: appensEgnaBlock }));
```

En samling deklareras i manifestet, och det den får i regler är:

| Deklaration | Regeln som genereras |
|---|---|
| `"matningar"` | medlem läser, medlem skriver, radering låst. Ingen formvalidering |
| `{ namn, falt: ["id", "groupId", "vikt"] }` | samma, plus `keys().hasOnly([...])` på create och update |
| `{ namn, agareKravsForSkrivning: true }` | medlem läser, **ägare** skriver |

⛔ **En sträng betyder inte "inga fält", den betyder "ingen formvalidering".**
Strängformen är utgiven i 0.25.0 och tas fortfarande emot. Läsaren får ändå
alltid den utskrivna formen, så ingen konsument behöver två kodvägar. Det är
samma tolerans katalogen fick i [#109](https://github.com/cllp/ops-framework/issues/109),
och av samma skäl: en riktig migrering, inte bekvämlighet.

⛔ **En tom fältlista fälls.** `keys().hasOnly([])` avvisar varje rad, alltså en
regel som ser ut som en formvalidering och är en vägg.

⛔ **Generatorn ersätter mönstret, inte tänkandet.** Det appen behöver utöver
mönstret skrivs för hand och skickas in som `extra`. Grundarreserven i
`bolag-ops` är ett sådant undantag: den har ett slutdatum och ett skäl, och en
generator som bar appens undantag hade blivit en andra plats att leta på när en
regel beter sig oväntat.

⛔ **Noll samlingar utan `extra` fälls.** Resultatet hade blivit en regelfil där
catch-allen är allt, alltså en app där ingenting går att läsa, och den filen
ska inte gå att producera av misstag.

⛔ **Ramverket genererar, appen committar.** Ingen deploy härifrån. Därför bor
byte-för-byte-vakten mot appens `firestore.rules` i APPENS kedja, där båda
halvorna finns: en incheckad kopia av den filen här vore den andra handskrivna
sanningen punkt 2 förbjuder. `check-regelgenerator` bevisar i stället att
generatorn är stabil, genom att jämföra mot en **gyllene fil**, alltså förra
utfallet för en fast fixtur. Att mönstret är rätt bevisas av emulatorproven.

#### Proven kör mot genererad text

`npm run test:rules` skriver `rules/provregler.rules` ur fragmentet med
`skriv-provregler`, startar Firestore-emulatorn och kör
`rules/__tests__/grupper.test.mjs`. Filen är git-ignorerad: två sanningar om
samma regeltext glider isär i samma sekund som någon rättar den incheckade.

⛔ **`test:rules` ligger inte i `npm run check`**, utan i ett eget CI-jobb. Den
kräver en emulator och en Java-körning, alltså minuter i stället för sekunder,
och `check` ska svara medan man väntar. Samma uppdelning som `bolag-ops`.

#### En aktiv grupp, och varje läsväg gäller bara den

[#190](https://github.com/cllp/ops-framework/issues/190), 0.35.0. **Det finns
alltid exakt en aktiv grupp**, och list, subscribe och read ger bara den
gruppens rader. CP 2026-09-30: "Ja, frågan om alla grupper: Ta bort det." Läget
"Alla mina grupper" krävde en gruppväljare före varje skapa-flöde och två lägen i
varje yta, och regeln för läsning blev "aktiv grupp, utom när alla är valda".
Samma dag: "Det är ingen privat grupp. Jag har en grupp som heter bolaget, men
jag måste ha privatekonomi där för att få en total översikt. Det är bara en
grupp. Ekonomimodulen bor där." Privat, Företag och Samlat är alltså flikar över
data i EN grupp, och det finns ingen läsning över flera grupper.

```js
import { minaGrupper, aktivGrupp, navForGrupp, lasAktivGrupp, sparaAktivGrupp, medAktivGrupp, OpsDataProvider } from "@staiger/ops-framework";

const mina = minaGrupper(mittMedlemskap, grupper);
const aktiv = aktivGrupp(lasAktivGrupp(uid, localStorage), mina); // null bara när personen inte har någon grupp
const { nav, saknade } = navForGrupp({ groupId: aktiv, ramnav, moduler, mina });

// En NY källa per grupp: läscachen är nycklad på källan, och frågan bär inte groupId.
const source = useMemo(() => medAktivGrupp(kalla, { groupId: aktiv, gruppade: ["ledger_items", "inkorg", "data"] }), [kalla, aktiv]);
<OpsDataProvider source={source}>{/* appen */}</OpsDataProvider>
```

`minaGrupper` bygger listan ur mina medlemskap, inte ur grupplistan: en grupp jag
kan läsa men inte är medlem i hade gett en tom vy och en fråga reglerna avvisar.

**`medAktivGrupp` är regeln, och den gäller varje läsväg.** Bara samlingarna appen
pekar ut i `gruppade` berörs, och ramverket känner aldrig namnen (första ledet i
sökvägen avgör, så `inkorg/<id>/kommentarer` följer `inkorg`).

| Operation | Vad insvepningen gör |
|---|---|
| `list` | lägger på `where.groupId`. En annan grupp i frågan **kastar**. Varje rad i svaret prövas: saknat `groupId` kastar, en annan grupps rad kastar |
| `subscribe` | samma som `list`, och ett brott går till `onError`, aldrig till `onData` |
| `read` | en rad ur en annan grupp ger **`null`**, alltså "finns inte" i den aktiva gruppen (kontraktets regel 3). En rad **utan** `groupId` kastar |
| `create` | sätter den aktiva gruppen. En annan grupp i posten kastar |
| `update` | en ändring av `groupId` till en annan grupp kastar, i övrigt orörd |
| `remove` | orörd |
| `batch` | varje del som `create` och `update` |

⛔ **Händelsen.** Gruppen Travel valdes och Idag visade fortfarande CPS AB:s rader.
Appens egen insvepning filtrerade `list` och `subscribe`, men `read` av ett
dokument gick orörd igenom, och reglerna frågar bara om personen är MEDLEM i
radens grupp. För den som är med i båda grupperna kom grupp A:s dokument tillbaka
när B var aktiv. Den aktiva gruppen är ett val i klienten, inte ett faktum i
databasen, så reglerna kan inte ställa frågan: insvepningen måste.

⛔ **`null` för en annan grupps dokument, ett fel för en rad utan grupp.** Sett från
den aktiva gruppen finns dokumentet inte, och vyn ritar redan sitt tomma läge för
`null`. Ett kast hade gjort varje vy som läser ett känt dokument-id till en röd
banderoll i varje grupp utom en. En rad utan `groupId` är däremot en bakfyllnad
som inte gjorts, och den sorteras inte bort tyst.

⛔ **`update` och `remove` läser inte först.** En läsning före varje skrivning vore
en läs-sedan-skriv-kontroll (arbetsreglernas punkt 2). Skrivvägarna till en rad
går genom en rad som redan lästs genom källan, och reglerna vaktar resten:
`gruppenOandrad()` hindrar flytt, och gruppade samlingar har `delete: if false`.

⛔ **`groupId` är ett krav i TYPEN, inte en konvention.** `gruppLista` och
`gruppSkapa` kräver gruppen, och `check-gruppfraga` kör tsc mot en fråga och ett
skapande utan grupp och kräver ett typfel för var och en. Gruppen läggs dessutom
**sist** i `where`, så en anropare som skickar med ett eget `groupId` inte kan
skriva över den.

⛔ **Valet sparas per person, i `grupplagetsNyckel(uid)`, och inte i
`users`-raden.** Vilken grupp jag tittar i är en egenskap hos enheten: språk och
tema följer med till telefonen, medan "jag tittar just nu i den här gruppen"
inte gör det. `lasAktivGrupp` och `sparaAktivGrupp(uid, groupId, lagring)` tar
lagringen som argument och fångar inga fel: `localStorage` kastar i privat läge,
och en tyst nedsläppsväg hade sett ut som att appen glömt valet.

⛔ **Ett sparat val är ett tips och inte ett faktum.** Medlemskapet kan ha
avslutats, gruppen kan ha arkiverats, och strängen kan vara `"alla"` från en
version före 0.35.0. `aktivGrupp` ger då den **första** av mina grupper, aldrig
ett fel och aldrig ett tomt läge. `null` betyder en sak: personen har inga
grupper, och appen visar `OpsUtanMedlemskap`.

⛔ **`navForGrupp` skriver ut `saknade`.** En grupp som pekar på en modul appen
inte installerat är en halv utrullning, och den ser ut precis som en grupp med
färre flikar. Ett kast vore fel svar: då ligger appen nere för den gruppen utan
väg tillbaka till en som fungerar. Appen visar dem, som `KatalogLarm`.

⛔ **Källregistret följer samma regel.** En modul som svarar med en rad vars
`groupId` inte är frågans kastar, och felet namnger modulen.

| Komponent | Vad |
|---|---|
| `OpsGruppvaljare` | listan i en meny, med `aria-current` på den aktiva. Ingen rad "alla" |

⛔ **Den använder inte Radix**, och det är mätt: en popover går inte att driva med
`fireEvent` i jsdom, alltså blir ett beslut som bor i den ett beslut inget prov
kan mäta. Väljaren är vanliga knappar, och proven trycker på dem.

### Grupp-panelen och gruppväxlaren

[#161](https://github.com/cllp/ops-framework/issues/161), CP 2026-09-28, med
skärmbilder av SessionStudios `AppSidebar.jsx`: "OCH GRUPPVÄLJARE? Var finns
det?" `OpsGruppvaljare` (ovan) svarar på en annan fråga, menyraden i #139.
Sidopanelen är en egen, bredare yta.

`OpsAppShell props.grupper` (utelämnad: ingen kolumn, ingen växlare, skalet
oförändrat):

```js
<OpsAppShell
  grupper={{
    lista: minaGrupperMedRader, // { id, namn, medlemsantal?, roll?, bild?, atgarder?, knappar?, avatarer? }[]
    aktiv: aktivGrupp(lasAktivGrupp(uid, localStorage), mina),
    onValj: (id) => { sparaAktivGrupp(uid, id, localStorage); setAktiv(id); },
    onSkapa: () => setVisaSkapaGruppDialog(true),
    infalld: panelInfalld,
    onInfalld: setPanelInfalld,
  }}
  ...
/>
```

| Bredd | Vad |
|---|---|
| **1024 px och uppåt (`lg`)** | `OpsGruppanel`, en vänsterkolumn med ett kort per grupp och "Skapa grupp" sist. Ingen rad "Alla mina grupper" (0.35.0, #190). Kollapsbar till en smal remsa med bara märkena |
| **Under 1024 px** | Ingen kolumn. I stället en `OpsGruppvaxlare`-knapp i headern (märke plus den aktiva gruppens namn), som öppnar SAMMA lista i `OpsPanel`s ark/rullgardin, i en enklare form (namn, medlemsantal, rollpill, ingen åtgärd/knapp/avatarrad). ⛔ **Arket har ingen "Skapa grupp" (0.37.0, CP 2026-09-30)**: det är för att byta grupp, och en ny grupp skapas med plussets "Ny grupp". `OpsGruppvaxlare` tar inte längre `onSkapa` eller `skapaEtikett`; utan grupper säger arket det och pekar på plusset (`tomText`) |

**Varje grupp i `lista`** (`GruppanelGrupp`, samma form `OpsGruppanel` och
`OpsGruppvaxlare` tar direkt): `id`, `namn` (`{ sv, en }`), och sedan
UTELÄMNBARA fält appen härleder själv, ramverket räknar och känner till
INGET av dem:

| Fält | Utelämnad ritas | Ur CP:s bild |
|---|---|---|
| `medlemsantal` | ingen siffra (aldrig "0" som gissning, arbetsreglernas punkt 5) | personikon plus tal |
| `roll` (`"agare"`\|`"medlem"`) | ingen rollpill | (inte i bilden, samma fält som `OpsMedlemmar`) |
| `bild` | initialer/ikon ur `OpsIdentity` | gruppens märke, uppe till vänster |
| `atgarder` (`{ icon, label, onClick }[]`) | inga knappar | glob (publik sida), info, penna, uppe till höger |
| `knappar` (`{ icon, label, badge?, onClick }[]`) | ingen rad | biblioteksknappen med räknare, chattknappen |
| `avatarer` (`{ id, namn, bild? }[]`) | ingen rad | avatarstapeln, max fyra plus "+N" |

⛔ **RÄTTAD 2026-09-28: KORTET ÄR HANDBYGGT, INTE `OpsCard`, OCH MÅTTEN ÄR
MÄTTA UR SESSIONSTUDIO, INTE GISSADE.** En första version gissade panelens
bredd (288/72px), avatarerna (32px) och byggde kortet på `OpsCard`
(`rounding="bubbla"`, `--card-padding` ~20px). CP: "Det ska vara EXAKT som
SessionStudio", och en genomläsning av
`sessions-platform/apps/web/src/components/AppSidebar.jsx`/`GroupCard.jsx`/
`AppHeader.jsx` gav andra tal. `OpsCard` är ramverkets EGNA kortform
(`--card-padding`, ingen kant som förval), medan SessionStudios `GroupCard`
är `p-3` (12px) MED en 1px kant som förval och `rounded-[var(--radius)]`
(12px, sedan 0.29.0 ramverkets `--radius-base` ur fixturen, inte
`--radius-card` 24px): att pressa de talen genom `OpsCard`s
stängda API (`check-closed-api`) hade antingen krävt att öppna det för
padding/kant, eller gett ett kort som SER UT som `OpsCard` med fel siffror.
Kortet är därför handbyggt, med SessionStudios egna klasser.

⛔ **INGEN NÄSTLAD `<button>`, OCH DET ÄR DÄRFÖR KORTET ÄR EN `<li
role="button">`, INTE EN `<button>`.** SessionStudios `GroupCard.jsx`
(rad 59-66) är en `<div onClick>` som omsluter riktiga knappar (glob, info,
penna, bibliotek, chatt), var och en med `e.stopPropagation()` så ett tryck
på en ikon inte också väljer kortet. En `<button>` FÅR INTE innehålla en
`<button>` (webbläsaren bryter isär trädet), så "hela raden är en enda
knapp" är inte möjligt när raden också bär riktiga knappar. Ramverket lägger
till `role="button"`, `tabIndex={0}` och `onKeyDown` (Enter/Space) på raden,
något SessionStudios egen `<div>` INTE har: en förbättring över förlagan,
inte en genväg runt husets linje mot `<div role="button">`-attrapper (se
`OpsRadioGroup`s filhuvud) eftersom den här HAR fullt tangentbordsstöd.

⛔ **VALD GRUPP: ACCENTRAM PLUS EN SVAG ACCENT-TONAD BAKGRUND, PÅ KORTET
SJÄLVT, INTE GRUPPENS EGEN FÄRG.** CP, efter att ha mätt mot
`AppSidebar.jsx`/`GroupCard.jsx`: markeringen ska vara kraftigare än en
vanlig 1px-kant. SessionStudio målar med `group.color` (en fri hexsträng per
grupp, plus en alfa-suffix). `GruppanelGrupp` har inget färgfält: `OpsIdentity`
härleder sin ton ur `seed` genom en fast palett, aldrig en fri hexsträng
(samma arkitekturbeslut som `OpsIdentity`s eget filhuvud, "identitet bärs
aldrig av en färgad prick"). Vald grupp använder därför `border-accent` +
`bg-accent/10` direkt på kortet, inte gruppens egen färg. En app som vill ha
SessionStudios per-grupp-färgade markering bygger ett eget lager ovanpå
`onValj`, ramverket erbjuder inte hex-in.

⛔ **PANELENS BREDD ÄR TVÅ TOKEN, `--panel-bredd` (184px) OCH
`--panel-bredd-infalld` (44px), MÄTTA UR `AppSidebar.jsx` RAD 43-49
(`md:w-[184px]` / `w-11`), INTE 288/72 OCH INTE EN TAILWIND-LITERAL PER
FIL.** `OpsGruppanel` (kolumnens egen bredd) läser tokenet direkt.
Toppradens logoruta är en EGEN, mindre ruta (`--logo-bredd` 180px /
`--logo-bredd-infalld` 40px, mätt ur `AppHeader.jsx` rad 174, se
`OpsBrand` nedan): 180 mot 184 och 40 mot 44 är samma 4px-differens, av
samma skäl (asidet har `px-0.5`, logorutan har det inte), alltså TVÅ
tokenpar och inte ett gemensamt. Ett prov läser varje fil ur sitt eget par
(`gruppanel.test.jsx`): det extraherar VILKA `w-(--namn...)`-klasser filen
faktiskt använder, inte bara att ordet nämns någonstans (en bar textträff
hade även fångat en förklarande kommentar, och missat att en verklig
regression ändå gjorde provet grönt).

⛔ **KOLLAPS ÄGS AV APPEN, PRECIS SOM VALET.** `grupper.infalld`/`onInfalld`
styr BÅDE panelens läge OCH märkets monogram/ordmärke-val (se nedan). Utan dem
sköter `OpsGruppanel` kollapset själv (internt `useState`, samma styrd/ostyrd
mönster som `OpsPanel`s `open`), men brandet följer då bara skärmbredden som
förut: en fristående `OpsGruppanel` UTANFÖR skalet fungerar alltså fint utan
dem, det är bara kopplingen till logotypen som kräver den styrda formen.

#### ⛔ Märket är text och följer panelens läge (0.31.0)

CP 2026-09-29: "Vi tar bort bilder, kör med text." Före 0.31.0 var märket fyra
webp-bilder. Nu är det `OpsBrand`: två rader text (`OPS HUB` med "OPS" ljusgrått och
"HUB" gråorange, under den appens eller gruppens namn) i Glacial Indifference, versaler,
spärrade. Storlekar och spärrning är mätta i CP:s bild och bor som tokens (`--marke-*`
i `tokens/tokens.css`, med mätningen i CHANGELOG 0.31.0), aldrig som literaler i en
komponent.

**Placering (mätt, `check-skalyta` sektion 10):**

- **Utfälld:** de två raderna är centrerade över kortens bredd i gruppanelen, samma
  mittlinje som korten (högst 1 px). Rutan är 180 px (`--logo-bredd`) och börjar
  `--panel-kant` (2 px) in från panelens kant, eftersom panelens innehåll gör det.
- **Infälld:** monogrammet "OH" står i EXAKT samma ruta som gruppernas i remsan
  (`gruppRutaKlass`, en funktion som remsan, chevronknappen och monogrammet delar):
  40 px, samma rundning, kantfärg, kantbredd och yta, samma mittlinje.
- **Rörelsen** är SessionStudios (`AppHeader.jsx:174-193`): båda formerna är alltid
  monterade och växlar med en opacity-crossfade på 200 ms, aldrig mount/unmount.
- **Utan gruppanel** (mobil, eller en app utan `grupper`): monogramrutan under `md`,
  vänsterställd; ordmärket från `md`.

**Undertexten:** med `grupper` och en aktiv grupp är rad 2 gruppens namn i versaler.
Utan aktiv grupp (personen är inte med i någon, eller appen skickar inga `grupper`) används `undertext` på appens egen
`<OpsBrand undertext="Bolag Ops" />`; saknas den ritas bara rad 1, centrerad lodrätt.
Ett långt gruppnamn kapas med ellipsis, rutan växer aldrig.

`OpsAppShell` sätter `panelInfalld` (och undertexten) på märket när `grupper` är given:
en sträng-`brand` blir märkets `namn`, ett FÄRDIGT `<OpsBrand .../>`-element KLONAS med
`cloneElement`, och ett GODTYCKLIGT `brand`-nod (ren text, egen komponent) lämnas orört.
`brand` utelämnad ger förvalet "OPS HUB". **Använd inte `brand` för appens namn** (det var
den gamla betydelsen): märket är ramverkets, appens namn är `undertext`.

**Typsnittet** (`fonts/glacial-indifference/`) är SIL Open Font License 1.1 och paketeras
med sin licensfil; `check-fonts` fäller ett paketerat typsnitt utan licens. Bara märket
använder det (`font-marke`); resten är Plus Jakarta Sans.

#### ⛔ Under 1024 px är ett ark, inte alltid ETT ark (#161)

`OpsGruppvaxlare` ÅTERANVÄNDER `OpsPanel`, ramverkets befintliga ark/rullgardin
(samma yta som appens meny och notiser), i stället för att uppfinna en egen
brytpunktsmaskin. `OpsPanel` byter yta vid Tailwinds `md` (768 px), INTE vid
1024. Mellan 768 och 1024 blir växlaren alltså en rullgardin i headern, inte
en bottensheet, medan panelen ändå är dold (den tänder först vid `lg`).

Det är en MEDVETEN avvikelse och inte en glömd detalj: att duplicera
`OpsPanel`s brytpunktsmaskin (`matchMedia`, lyssnare, Safari-reserv `addListener`)
för EN till konsument hade brutit mot arbetsreglernas punkt 2, en sanning per
faktum. Två sätt att avgöra "är skärmen smal" i samma app glider isär den dag
bara det ena rättas.

### Felrapportering

[#159](https://github.com/cllp/ops-framework/issues/159). CP: "Skall Sentry
vara default eller optional i framework?" Beslut, CP:s svar "Allt perfekt":
**valfritt, men färdigkopplat.** Ramverket känner inga externa konton (ingen
DSN, precis som ingen Firebase-projekt-id), men ett fel ska ALDRIG försvinna
tyst, med eller utan ett sådant konto.

| | |
|---|---|
| `rapporteraFel(fel, sammanhang, felmottagare)` | loggpunkten. Skriver **alltid** till `console.error`, oavsett mottagare eller miljö: det är det garanterade golvet. Finns en `felmottagare` kallas även dess `fanga(fel, sammanhang)`. Kastar aldrig, även om mottagaren själv kastar (fångas och loggas separat) |
| `OpsAppShell props.felmottagare` | felgränsen (alltid på, ingen prop stänger av den) kallar `rapporteraFel` i `componentDidCatch` med `felmottagare` och ett sammanhang som bär felytans id |
| `OpsAppShell props.felRubrik`, `felBeskrivning`, `laddaOmEtikett` | texten på felytan |
| `OpsAuthProvider props.felmottagare` | kallar `felmottagare.satt({ uid, groupId })` vid varje inloggningsbyte, `satt(null)` vid utloggning. **Aldrig e-post**, även när den finns på `User`-objektet |
| `sentryMottagare({ dsn, miljo, version })` | en färdig `felmottagare`, i en EGEN ingång: `@staiger/ops-framework/sentry` |

```js
import { OpsAppShell } from "@staiger/ops-framework";
import { OpsAuthProvider } from "@staiger/ops-framework";
// Förvalet är AV. Kommentera in när appen vill ha Sentry:
// import { sentryMottagare } from "@staiger/ops-framework/sentry";
// const felmottagare = sentryMottagare({ dsn, miljo: import.meta.env.MODE, version });

<OpsAuthProvider authentication={auth} felmottagare={felmottagare}>
  <OpsAppShell nav={nav} activeHref={pathname} felmottagare={felmottagare}>
    {children}
  </OpsAppShell>
</OpsAuthProvider>;
```

⛔ **FELGRÄNSEN ÄR ALLTID PÅ, OCH DET SKILJER DEN FRÅN VARJE ANNAN KOMPONENT.**
Ett fält i en vy som kastar ger en felyta med ett id och en knapp för att ladda
om, aldrig en vit sida. En vit sida ser ut som att ingenting hände, och den som
möter den vet inte om appen laddar, hängt sig, eller är trasig.

⛔ **`console.error` KÖRS ÄVEN NÄR EN MOTTAGARE FINNS.** En loggpunkt som bara
pratar med mottagaren gör felsökning utan nätverk (offline, en trasig DSN, en
blockerad tredjepartsdomän) omöjlig: den enda platsen felet syns är i ett konto
ingen kan nå just då.

⛔ **`@staiger/ops-framework/sentry` ÄR EN EGEN, OBUNDLAD INGÅNG**, precis som
`/node`: `package.json` pekar den direkt mot källan, ingen esbuild-runda.
`@sentry/browser` bara laddas av den app som faktiskt skriver
`import ... from "@staiger/ops-framework/sentry"`, aldrig av en app som inte
gör det. `@sentry/browser` är en `peerDependency`, `optional: true`, ALDRIG en
`dependency`: en `dependency` installeras åt ALLA, oavsett om de importerar
filen. `check-paket.mjs` bevisar att ramverkets egen `dist/index.js` aldrig
nämner Sentry.

⛔ **KONTRAKTET, INTE EN SDK.** `Felmottagare` är formen `{ fanga, satt }`.
`sentryMottagare` är EN implementation; en app som vill använda en annan
tjänst skriver sin egen på samma form.

### Modulkontraktet

Fas 3 i [#92](https://github.com/cllp/ops-framework/issues/92). En **modul** lägger
till nav, vyer, egna samlingar och rader i ramverkets ytor, och den beskriver sig
med **ett** manifest. `defineModule` tar manifestet och kastar på allt som inte
stämmer, `validateModuler` tar listan och kastar dessutom på det som bara syns
mellan två moduler.

```js
import { defineModule } from "@staiger/ops-framework";

export const liv = defineModule({
  id: "liv",
  namn: { sv: "Liv", en: "Life" },
  nav: [{ href: "/liv", label: "Liv" }],
  routes: [{ path: "/liv", vy: LivVy }],
  samlingar: ["matningar"],
  kallor: { handelser: livetsHandelser },
  skapar: [{ id: "matning", namn: { sv: "Mätning", en: "Measurement" }, ikon: "hjarta", katalog: "sorter", form: MatningForm }],
  hubb: null, // eller { ikon, rutt, startsida, delar }, se Hubben per grupp
});
```

| Fält | Vad | Regeln, och varför |
|---|---|---|
| `id` | maskinnyckeln | Samma form som ett kategori-`id`, alltså små bokstäver, siffror, bindestreck och understreck. ⛔ Regexpen är **delad** med katalogen och inte kopierad: två uttryck med samma avsikt glider isär, och den dag det ena släpper in en punkt syns felet först i en Firestore-regel |
| `namn` | det som visas | `{ sv, en }`. ⛔ **En sträng kastar här**, till skillnad från i katalogerna. Katalogen tål en sträng för att appens listor var strängar och läsaren måste tåla båda formerna under migreringen (#109). Modulerna har ingen sådan historia, så en sträng är inte ett arv utan ett nyskrivet fel |
| `nav` | nav-poster | Valideras av **`validateNav`**, alltså exakt samma regler som skalet och bottenraden, inklusive EN nivå barn. ⛔ En egen kopia av de reglerna vore två sanningar om samma faktum |
| `routes` | `{ path, vy }` | `path` börjar med snedstreck och står en gång. ⛔ Två routes med samma `path` avgörs annars av registreringsordningen, alltså av en slump. ⛔ `vy` får vara ett **objekt**: `memo`, `forwardRef` och `lazy` ger objekt, så ett krav på funktion hade avvisat tre vanliga sätt att skriva en vy |
| `samlingar` | vad modulen äger | `"namn"` eller `{ namn, falt, agareKravsForSkrivning }`. `falt` blir `keys().hasOnly` i de genererade reglerna (#130), och utelämnas den genereras ingen formvalidering. `agareKravsForSkrivning: true` ger ägarkrav i stället för medlemskrav. Relativa namn, aldrig sökvägar. ⛔ Ett snedstreck avvisas: modulen namnger relativt och **appen skickar in roten**, och det är den raden som gör att en kund senare kan bli ett eget Firebase-projekt utan att datamodellen ändras |
| `kallor` | ytor modulen fyller | Nycklarna är `KALLTYPER`, alltså `handelser`, `sok`, `hjalp`, `notiser`, `widgets`, `kataloger`. Värdet är en funktion: ramverket anropar, modulen svarar |
| `skapar` | vad plusset erbjuder | En lista `{ id, namn, ikon, katalog, form }`. Spegelbilden av `kallor`: källorna läser IN i ramverkets ytor, registreringarna skriver UT ur plusset. ⛔ `katalog` krävs **även när den är `null`**: ett kvitto har ingen typ att välja, och en registrering som glömt sin katalog ser likadan ut som en som inte har någon om fältet är valfritt. ⛔ `id` är unikt över **hela** modullistan, inte bara inom modulen: plusset ritar en flik per registrering |
| `hubb` | modulens kort i hubben och dess insida (0.37.0) | `{ ikon, rutt, startsida, delar }` eller `null`. `ikon` är ett React-element, `rutt` modulens adress (kortet leder dit och den visar startsidan), `delar` en lista `{ id, namn, ikon, rutt }` i navigationens ordning, minst en, och `startsida` är id:t på en av dem. ⛔ Varje dels `rutt` ligger **under** modulens (`/ekonomi/inkomster`, aldrig `/inkomster`): en del som inte bär sin moduls adress går inte att härleda tillbaka till modulen. ⛔ Krävs **även när den är `null`**, av samma skäl som `katalog`. ⛔ `validateModuler` kastar på två moduler med samma adress och på en modul inuti en annan. Se [Hubben per grupp](#hubben-per-grupp-0380-184) |

⛔ **VARJE FÄLT KRÄVS, ÄVEN DE TOMMA.** En modul utan vyer skriver `routes: []`,
en modul som inte fyller någon yta skriver `kallor: {}`, en modul som inte
kan skapa något skriver `skapar: []`, och en modul utan kort i hubben skriver `hubb: null`. Skälet är
arbetsreglernas punkt 5: tomhet är ett svar och inte en utelämnad rubrik. Vore
fälten valfria såg en modul utan routes likadan ut som en modul som glömt sina,
och den andra är ett fel.

⛔ **MANIFESTET ÄR DATA, BETEENDET REFERERAS UR DET.** Komponenter och källornas
funktioner bor inte i manifestet, de pekas ut av det. Samma väg A som
katalogerna ([#111](https://github.com/cllp/ops-framework/issues/111)): data går
att läsa, jämföra och validera, medan en funktion bara går att köra.

⛔ **VALIDERINGEN KÖRS VID UPPSTART**, i samma form och av samma skäl som
`validateNav` och `validateKatalog`. En trasig modul som upptäcks vid första
klicket är ett fel i knäet på användaren.

⛔ **`validateModuler` FÅNGAR DET SOM INTE SYNS I ETT MANIFEST.** Två moduler med
samma `id`, samma route eller samma samling är var för sig giltiga och
tillsammans ett fel: den ena skriver över den andra, och vilken avgörs av
registreringsordningen. Det är den sortens fel som uppträder som "ibland".

⛔ **FORMEN PÅ VARJE KÄLLA HÖR TILL [#129](https://github.com/cllp/ops-framework/issues/129), INTE HIT.**
Manifestet vet vilka ytor som finns och att modulen pekat ut en funktion per yta
den fyller. Att låtsas validera radernas form redan nu vore en vakt som utlovar
ett skydd den inte har.


#### De tre ytorna: Sök, Notiser och Översikt

[#140](https://github.com/cllp/ops-framework/issues/140),
[#141](https://github.com/cllp/ops-framework/issues/141),
[#142](https://github.com/cllp/ops-framework/issues/142). Alla tre läser ur
registret och äger sin egen tomhet, sitt fel och sin väntan.

| Yta | Komponent | Vad modulen ska ge för att synas rätt |
|---|---|---|
| Sök | `OpsSok` | `{ id, titel }` minst. `text` blir radtexten under titeln, `href` gör träffen öppningsbar. Träffarna grupperas per modul, så skicka in `modulnamn` för läsbara rubriker |
| Notiser | `OpsNotiser` | `{ id, titel, prio }`. `prio` ur `NOTISPRIO` styr ordningen: brådskande först. `text` och `href` är frivilliga |
| Översikt | `OpsOversikt` | `{ id, titel: { sv, en }, vy }`. Vyn får hela widgetraden som props, så lägg det den behöver på raden |

⛔ **Ramverket indexerar inte.** Sök frågar källorna och visar vad de ger. Hur
en modul söker är modulens sak, och ett index här hade varit en andra kopia av
modulens data.

⛔ **Sök frågar inte på ett tomt fält.** En modul som får en tom söksträng
skulle rimligen svara med allt den har, och det är inte ett sökresultat utan en
lista som ser ut som ett. Tomheten bär dessutom sökordet: "Inga träffar för
fakura" visar stavfelet, som är den vanligaste orsaken till noll träffar.

⛔ **Läsmärket i Notiser är ramverkets data, inte modulens.** Appen skickar in
`lasta` och får `onLast`, precis som `lasmarken` redan fungerar i bolag-ops. En
modul som ägde läsmärket hade behövt känna till användarna.

⛔ **Räknaren kan inte nå en grupp jag inte är med i**, och det följer av
kontraktet i stället för av en kontroll: källan frågas per grupp, och en grupp
jag inte är medlem i frågas aldrig. `olasta(poster, lasta)` är en ren funktion,
så räkningen går att mäta utan att rita en panel.

⛔ **Översikten är alltid en grupps**, till skillnad mot Händelser. Ett kort som
blandar två verksamheters siffror är ett kort ingen kan handla på.

⛔ **En widget som saknas i gruppens ordning hamnar sist, inte utanför.** En ny
modul ska dyka upp, inte vara osynlig tills någon redigerat en lista de inte
visste fanns. `iOrdning(widgets, ordning)` är ren och provad.

⛔ **En tom översikt säger varför och vart.** Ett tomt rutnät läser man som att
det är trasigt.

#### Exempelmodulen: kopiera `examples/paminnelser/`

[#131](https://github.com/cllp/ops-framework/issues/131). En liten, fullständig
modul: en samling med fältlista, en nav-post, en route, alla sex källorna och
en egen katalog med två kategorier, på svenska och engelska.

⛔ **`check-exempelmodul` håller README och exemplet i takt.** Varje
manifestfält, varje samlingsfält och varje källtyp måste finnas både i det här
avsnittet och i exemplet. Ett fält koden har men README saknar är ett fält
ingen hittar; ett fält README lovar men exemplet inte visar är ett löfte utan
täckning. Fältlistorna läses ur `src/lib/modul.js`, så vakten är inte en tredje
sanning som själv kan glida isär.

⛔ **Manifestet importerar sin vy med `lazy`, och det är inte en
prestandafråga.** Regelgeneratorn körs i ett Node-skript i appens CI, och Node
kan inte läsa JSX. Med en direkt `import ... from "./Vy.jsx"` faller det
skriptet på "Unknown file extension .jsx", långt från sin orsak. Med `lazy` är
vyn ett löfte som bara webbläsaren infriar, och manifestet är ren JavaScript.

⛔ **Exemplet monteras inte i scaffold-mallen.** Mallen är vad varje ny app
startar från, och en app som föds med en Påminnelser-modul ingen bett om är kod
någon måste ta bort innan den kan börja. Beviset att modulen fungerar är dess
egna prov, som kör den genom registret och generatorn.

#### Källorna: hur en modul fyller ramverkets ytor

[#129](https://github.com/cllp/ops-framework/issues/129). Ramverket äger ytorna,
modulen fyller dem. **Ramverket anropar, modulen svarar**, aldrig tvärtom: en
modul som kunde skjuta in rader när den ville hade gjort ordningen på en yta
till en fråga om vem som hann först.

⛔ **Varje anrop bär exakt en grupp, den aktiva.** Frågan är `{ groupId }`, typen
kräver det, och körtiden upprepar kravet. Modulen ser aldrig fler än en grupp per
anrop, och en rad som bär ett annat `groupId` än frågans kastar med modulens namn
i felet (0.35.0, #190).

```js
import { defineModule, skapaKallregister } from "@staiger/ops-framework";

const liv = defineModule({
  id: "liv",
  namn: { sv: "Liv", en: "Life" },
  nav: [{ href: "/liv", label: "Liv" }],
  routes: [{ path: "/liv", vy: LivVy }],
  samlingar: ["matningar"],
  kallor: {
    // Händelser och kalendern. Formen är OpsEvent, samma som OpsEventList ritar.
    handelser: async ({ groupId }) => [{ id: "m1", title: "Mätning", daysLeft: 3 }],

    // Sök. En träff som går att välja mellan andra.
    sok: async ({ groupId, text }) => [{ id: "m1", titel: "Mätning 1", text: "72 kg", href: "/liv/m1" }],

    // Hjälp, per route. Modulen avgör vilka av sina sidor den svarar för.
    hjalp: async ({ groupId, route }) => (route === "/liv" ? [{ titel: { sv: "Om Liv" }, text: { sv: "Så funkar det." } }] : []),

    // Notiser, med brådska ur NOTISPRIO.
    notiser: async ({ groupId }) => [{ id: "n1", titel: "Dags att mäta", prio: "normal" }],

    // Ett kort på Översikt. Vyn pekas ut, den bakas inte in.
    widgets: async ({ groupId }) => [{ id: "w1", titel: { sv: "Senaste mätningen" }, vy: SenasteKort }],

    // En egen katalog i inställningsvyn. Kategorierna granskas av katalogmotorn.
    kataloger: async ({ groupId }) => [{ id: "sorter", namn: { sv: "Mätsorter" }, kategorier: [vikt, puls] }],
  },

  // Plusset. Ramverket ritar fliken och typväljaren, MatningForm ritar fälten.
  skapar: [{ id: "matning", namn: { sv: "Mätning" }, ikon: "hjarta", katalog: "sorter", form: MatningForm }],
});

const register = skapaKallregister([liv]);
```

| Källa | Raden | Ytan som ritar den |
|---|---|---|
| `handelser` | `OpsEvent`: `{ id, title, daysLeft }` plus det `OpsEventList` tar | `OpsModulHandelser` |
| `sok` | `{ id, titel, text?, href? }` | Sök, [#140](https://github.com/cllp/ops-framework/issues/140) |
| `hjalp` | `{ titel: { sv, en }, text: { sv, en } }` | `OpsModulHjalp` |
| `notiser` | `{ id, titel, text?, prio, href? }` | Notiser, [#141](https://github.com/cllp/ops-framework/issues/141) |
| `widgets` | `{ id, titel: { sv, en }, vy }` | Översikt, [#142](https://github.com/cllp/ops-framework/issues/142) |
| `kataloger` | `{ id, namn: { sv, en }, kategorier }` | `OpsModulKataloger` |

⛔ **`OpsModulKataloger` skriver en "Används i"-rad ovanför varje katalogsektion (#164), härledd ur registret och aldrig handskriven.** Modulens visningsnamn kommer ur den nya `register.modulNamn(modulId)`, och listan över vilka moduler som delar en katalog byggs av vilka rader ur `kataloger` som bär samma `id`, oavsett vilken modul som lämnade dem. Registrerar två moduler samma katalog-id visas båda namnen på raden, hos båda. Tomhet är ett svar (arbetsreglernas punkt 5): hittar registret ingen modul skrivs raden ut ändå, som "Används inte av någon modul just nu."

⛔ **`KALLTYPER` bär alla sex även innan ytorna finns.** En modul ska kunna
deklarera en sökkälla i dag och få den ritad den dag Sök byggs, utan att skriva
om sitt manifest.

⛔ **Formen prövas när raden kommer, inte när modulen registreras.** Vad en
funktion RETURNERAR går inte att veta förrän den anropats, och att låtsas annat
vore en vakt som utlovar ett skydd den inte har. Det som går att avgöra vid
uppstart gör `defineModule`: att ytan finns och att modulen pekat ut en
funktion. Felet vid anropet namnger **modulen, ytan och radnumret**, eftersom
ett formfel i en app med fem moduler annars är en halvtimmes letande.

⛔ **En utebliven retur är ett fel, inte tomhet.** Noll rader skrivs `[]`. En
källa som glömt sitt `return` ser annars ut som en källa utan rader, och då
letar man i datan efter något som aldrig lämnade koden.

⛔ **`modulId` stämplas av registret, det tas inte från raden.** En modul som
kunde sätta det själv kunde sätta någon annans, och ytans svar på "vem bidrog
med den här raden" vore då modulens påstående.

⛔ **Tre tomheter, tre texter.** `useKallor` skiljer på att ingen modul fyller
ytan (`fyller` är tom), att modulerna svarade utan rader (`tomt`) och att
hämtningen pågår (`laddar`). Slås de ihop står det "allt är gjort" medan
sanningen är att ingenting frågades.

#### Skapa-kontraktet: plusset

[#150](https://github.com/cllp/ops-framework/issues/150). Källorna läser in i
ramverkets ytor. `skapar` är samma kontrakt åt andra hållet: **vad modulen kan
skapa, och var typen väljs ur.**

```js
import { OpsAppShell, skaparFor, kontrolleraSkaparkataloger, typerAttValja, skapalaget } from "@staiger/ops-framework";

// Registreringarna för den aktiva gruppens PÅSLAGNA moduler, i registreringsordning.
const registreringar = skaparFor(moduler, grupp.moduler);

// Så tidigt det går: kastar när en registrering pekar på en katalog gruppen inte har.
kontrolleraSkaparkataloger(registreringar, kataloger.map((k) => k.id));

<OpsAppShell
  // ...
  skapa={{
    // Idag/kalendern och Inkorgen är RAMVERKETS egna vyer, inte moduler (#168):
    // deras "Ny …"-rader ritas FÖRST, före modulernas.
    handelse: appenAktiverarHandelser ? <NyHandelseForm /> : undefined,
    arende: appenAktiverarInkorg ? <NyttArendeForm sortAlternativ={SORT} /> : undefined,
    registreringar,
    lage,
    kataloger,
    ikonRitare,
    onKlar: (arg) => uppdateraNagot(arg),
  }}
/>
```

⛔ **#168, CP:S SKÄRMINSPELNING 2026-09-28: EN POPOVER UNDER PLUSSET, EN
RIKTIG MODAL PER RAD.** 0.27.0 (#164, korrigering D) gjorde plusset till en
platt lista, men listan LÅG KVAR i samma yta och bytte sitt eget innehåll till
typval+formulär+en "Tillbaka"-länk. Mätt mot SessionStudio (`ss-skapa-meny.png`)
är plusset en Radix-POPOVER precis som skalets meny, och ett tryck på en rad
öppnar en RIKTIG modal med sin egen stängknapp, aldrig en andra vy inuti
popovern. `OpsSkapa` ritar numera BARA listan (och de två tomlägena); popovern
och modalen hör hemma i `OpsAppShell props.skapa`, som är den yta som äger
plusknappen. Modulkontraktet är OFÖRÄNDRAT (#150/#153): modulen registrerar
fortfarande vad den kan skapa.

### Skapa är en panel, inte en modal (0.31.0)

CP 2026-09-29: "Skapa nytt i ramverket. Låt det vara paneler istället för modaler precis som i sessionstudio." Och, med en
skärmbild från telefonen (390 px, "Nytt ärende"): arket började direkt under statusraden och täckte hela appens huvud, nästa
fält klipptes utan synlig knapprad, och valkorten var höga med stor text och mycket luft. Före 0.31.0 öppnade en rad i plusset en
`OpsModal`; nu öppnar den `OpsSkapaPanel` (en intern komponent, ingen export), som SS "Ny grupp" (`GroupEditRouteView.jsx:36-47`,
`ManageGroupModal.jsx:454,479,640`).

| Del | Beteende |
|---|---|
| Dator (från `md`) | En sida i innehållskolumnen. Huvudet och gruppanelen står kvar. "‹ Tillbaka" överst, rubrik, formuläret i en kolumn (högst 880 px, centrerad) och en FAST knapprad längst ned till höger: `Avbryt` som textknapp, `Spara` som fylld accentknapp. |
| Telefon (under `md`) | Helskärm (`fixed`, 0,0 mot hela vyn) med en egen rubrikrad (Tillbaka och titel), en kropp som rullar och en knapprad som ligger kvar inom `--safe-bottom`. Bottenraden täcks. Höjden följer `visualViewport`, så med tangentbordet uppe ligger både det aktiva fältet och knappraden ovanför det. |
| Adress | `?skapa=<handelse\|arende\|registreringens id>` läggs i adressen vid öppning, så webbläsarens Tillbaka fungerar och panelen går att länka till. `skapa.adress: false` stänger av det för en app vars router inte tål att någon annan skriver i historiken. |
| Tillbaka | Appens vy är kvar i DOM:en, dold, medan panelen visas: Tillbaka återställer exakt den vy och rullposition man kom från. |
| Roll | Panelen är en region med rubrik, aldrig `role="dialog"`: den är en del av sidan, inte ett lager över den. |

⛔ **KNAPPRADEN ÄR SKALETS, FORMULÄRET ÄR APPENS.** Ett moduls- eller händelseformulär får `{ groupId, typ, mal, formId, onKlar }`. Ger
formuläret sitt `<form>` `id={formId}` och skickar appen `skapa.sparaEtikett`, ritar skalet `Spara` som `type="submit" form={formId}` i den
fasta knappraden. Utan `sparaEtikett` har formuläret en egen knapp och bara `Avbryt` är skalets. Övriga etiketter: `avbrytEtikett`,
`tillbakaEtikett`, `skapasIEtikett`, `skapaIRubrik`. `OpsButton` fick propen `form` för det här.

#### Ny grupp (0.32.0, #180)

CP 2026-09-29 23:30: "Skapa grupp och bjuda in till grupp finns inte ännu. Skapa grupp i web skall ha samma funktion som i SessionStudio."
`skapa.grupp` är en FUNKTION `({ formId, onKlar }) => nod` som ritar formuläret, normalt `OpsGruppFormular`:

```jsx
<OpsAppShell
  skapa={{
    grupp: ({ formId, onKlar }) => (
      <OpsGruppFormular
        formId={formId}
        onKlar={onKlar}
        onSkapa={({ grupp, inbjudningar }) => skapaGruppCallable({ grupp, inbjudningar })} // svarar { groupId, tillagda, inbjudna, fel }
        onSkapad={(groupId) => navigate(`/grupp/${groupId}`)}
      />
    ),
    sparaEtikett: "Spara",
  }}
/>
```

Med `skapa.grupp` får plusset raden "Ny grupp" (efter Ny händelse och Nytt ärende, som SS plusmeny), och "Skapa grupp" i gruppanelen (utfälld och infälld) öppnar SAMMA panel. ("Byt grupp"-arket på telefon hade samma knapp till 0.36.0; den är borttagen i 0.37.0.) `grupper.onSkapa` behövs då inte, och om båda finns vinner `skapa.grupp`: en väg att skapa en grupp är en sanning. Adressen är `?skapa=grupp`. `nyGruppEtikett` byter radens namn och panelens rubrik.

`OpsGruppFormular` (props `formId`, `onSkapa`, `onSkapad`, `onKlar`, `sprak`, `etiketter`) har SS `ManageGroupModal`s ordning: en hopfälld rad **Visuell identitet** (märket i vald färg som förhandsvisning, sex färgprickar, ikonrutor med en "Aa"-ruta för initialer och ett fält för egna initialer, 1 till 3 tecken), **Gruppnamn** (krävs), **Beskrivning**, **Ort**, **Medlemmar** (e-post, roll Admin eller Medlem, Lägg till, listan före spara) och **Mer inställningar** (hopfälld, med E-postspråk).

⛔ **BILDEN LADDAS UPP FÖRST NÄR GRUPPEN FINNS**, som i SS (`!isNew && form.id`): en lagringssökväg bär gruppens id. Formuläret säger det, och `onSkapad(groupId, svar)` ger appen id:t att navigera till gruppens sida med. ⛔ **Faller en inbjudan visas det:** panelen stängs inte utan visar vilka adresser som inte blev av och varför. ⛔ **Stängningen går inte bakåt i historiken** (`onKlar` gör `replaceState`, inte `history.back()`), så appens navigering efter `onSkapad` inte ångras av ett sent `back`.

⛔ **Färg och ikon i märket ritas överallt** (`OpsGruppanel`, `OpsGruppvaxlare`): `GruppanelGrupp` tar `farg` och `ikon`, `gruppmarkeProps(grupp)` gör dem till det `OpsIdentity` behöver (`tone`, `icon`, `initialer`). Färgen är en av de sex identitetstonerna (`PROFILFARGER`), inte en hex: en fri färg följer inte med när mörkt läge kommer. Ikonerna är `GRUPPIKONER` (grupp, portfölj, byggnad, hus, bok, jordglob, stjärna, hjärta, blixt, krona), ramverkets egna id och inte Lucide-namn. `GRUPPINITIALER_FORM` är formen `initialer:AB`.

#### Gruppkortet, detaljsidan och redigering (0.32.0, #180 G2)

Kolumnbredden är SS per formulär: `OpsSkapaPanel` tar `kolumn`, `"smal"` (672 px, SS `GroupEditRouteView`, gäller Ny grupp, Redigera grupp och Nytt meddelande) och `"bred"` (896 px, SS `EventEditRouteView`, gäller händelse, ärende och moduler). Skalet väljer.

- **Kortet i `OpsGruppanel`** har (i) (`onInfo(id)`, appen öppnar `OpsGruppSida`) och en penna (`onRedigera(id)`), båda uppe till höger efter appens egna `atgarder`. ⛔ **Pennan ritas bara för `roll` `agare` eller `admin`**, som SS `canEditGroup` (#2705): en roll som saknas ger ingen penna. Medlemsantal och avatarrad (fyra plus "+N") fanns redan som `medlemsantal` och `avatarer`. Det valda kortet har gruppens `farg` som kant och ljus bakgrund (SS `GroupCard.jsx:60-65`), märket bär `farg` och `ikon` (`GruppanelGrupp`), också i den infällda remsan. Med `skapa.redigeraGrupp` i skalet öppnar pennan samma panel som Ny grupp, i redigeringsläge (`?skapa=redigera-grupp&grupp=<id>`), annars anropas `grupper.onRedigera`.
- **`medlemsinfo(medlemskap, groupId?)`** härleder `{ medlemsantal, avatarer, medlemmar }` ur en grupps rader i `memberships` (aktiva, ägare före admin före medlem, sedan namn). ⛔ **Ingen spegelkolumn:** antalet lagras aldrig, appen listar medlemskapen (en medlem får läsa dem sedan 0.32.0) och ramverket räknar. Finns i båda ingångarna (ren fil).
- **`OpsGruppSida`** är detaljsidan (SS `GroupDetailView`): tillbaka-rad, stort märke (56 px), namn, beskrivning, ort, Redigera (bara `agare`/`admin` och bara med `onRedigera`), appens `snabbval` (`{ icon, label, onClick }`, en rad om tre), och medlemslistan med en Ägare- eller Admin-etikett. `children` är appens egna sektioner under listan. SS har också discipliner, publik sida, arrangörspanel och kommande sessioner: det är SS domän eller appens.
- **`OpsGruppFormular` i redigeringsläge:** `grupp={...}` (befintlig grupp), `onSpara({ grupp })`, och bilden: `onLaddaUppBild(fil) => { sokvag, url }`, `onTaBortBild()` och `bildUrl`. Uppladdningen är appens (sökvägen bär gruppens id). Ingen medlemssektion i redigeringsläget.

⛔ **"SKAPA I" (SS `CalendarCreateDestinationSheet.jsx`).** Allt som skapas hamnar i den AKTIVA gruppen, utan gruppväljare
(0.35.0, #190), och panelens översta rad visar "Skapas i: <grupp>". Har appen egna mål i `skapa.skapaISektioner` (t.ex. "Mina
kalendrar") är raden en knapp som öppnar väljaren (en centrerad dialog på dator, ett ark på telefon: rubrik, en sektion per mål, vald
rad med accentkant, `Avbryt` längst ned). Väljaren har ingen sektion Grupper och öppnas aldrig före panelen. Den är den exporterade
komponenten `OpsSkapaI`. Ett val når formuläret som `mal: { sektion, id }`, och `groupId` är fortfarande den aktiva gruppen.

⛔ **Formulär får aldrig använda rå `<input type="date">` eller `type="time">`**: `OpsDatePicker` och `OpsTimePicker`.

⛔ **RAMVERKETS EGNA RADER FÖRST, MODULERNAS SEDAN (#168, CP:s rättelse
23:35).** Idag/kalendern och Inkorgen är inte moduler, de är ramverkets egna
vyer, och deras "Ny händelse"/"Nytt ärende"-rader hör därför inte till
`OpsSkapa`s modul-lista. `skapa.handelse`/`skapa.arende` är FÄRDIGA `ReactNode`
skalet ritar överst i popovern, en tunn avdelare, sedan modulernas rader.
⛔ Skalet vet inget om deras fält och kan därför INTE stänga modalen åt dem när
de sparat, bara via modalens egna vägar (X, Escape, klick utanför). En moduls
formulär får `{ groupId, typ, onKlar }` som förut, och `onKlar` stänger modalen
åt den.

⛔ **`OpsSkapa` tar `onValj`, inte längre `onKlar` eller `kataloger`.** Ett
tryck på en rad är ett VAL, inte ett "klart": det är popoverns ägare (skalet)
som vet vad ett val ska göra. `OpsSkapa` ritar dessutom en tunn avdelare
MELLAN MODULER (inte mellan varje rad): en modul som registrerar flera rader
ska inte se ut som flera moduler.

⛔ **`ikonRitare(namn) => ReactNode`, samma mönster som `OpsKatalogInstallning
props.ikonRitare`.** `Skaparregistrering.ikon` är ett namn ur appens EGEN
tillåtelselista; ramverket vet inte hur man ritar det. Utan `ikonRitare` ritas
ingen ikon på raden, bara ordet.

⛔ **Plusset skapar alltid i den AKTIVA gruppen.** Det finns ingen gruppväljare
(0.35.0, #190), och bara den som inte är med i någon grupp har ingen grupp att
skriva i. `skapalaget` ger tre utfall: `ingenGrupp`, `tomt` och `redo`,
och modulernas rader ritas bara i popovern när läget är `redo`. Har appen
`handelse`/`arende` visas plusset ändå: de vet inget om grupplägen, de är
appens egna, färdiga formulär. Finns varken ramverksrader eller ett `redo`-läge
ritas inget plus alls (tomhet är ett svar, arbetsreglernas punkt 5).

⛔ **Katalogkontrollen kan inte bo i `defineModule`, och det är en avvikelse från
ärendets ord "kastar vid uppstart".** Kataloger kommer ur `kallor.kataloger`,
alltså ur en funktion som frågas per grupp, och ingen lista finns förrän den
frågats. `kontrolleraSkaparkataloger` körs därför så tidigt den kan: när gruppens
kataloger är lästa. Ett fel och inte en tom lista, eftersom en tom typväljare ser
ut som en katalog någon glömt fylla.

### Samtal och meddelanden (0.34.0, #182, #185)

**Öppna skapa-panelen från appen (0.34.1).** `useOppnaSkapa()` ger en funktion `oppna(nyckel, extra?)` med adressens nycklar
(`"meddelande"`, `"arende"`, `"handelse"`, `"grupp"`, `"redigera-grupp"` med `{ groupId }`, eller en registrerings id). Den använder
skalets `oppnaSkapa`, så `?skapa=` och Tillbaka fungerar som ur plusset. Använd den i stället för
`window.location.assign(...?skapa=meddelande)`. Saknas posten i `skapa`, eller anropas hooken utanför `OpsAppShell`, kastas ett fel.
Skalet öppnar också en `?skapa=` vars post kommer efter monteringen (t.ex. `skapa.meddelande` efter inloggning), så länkar och omladdning fungerar.

CP 2026-09-30: ett meddelande till en person är **privat** (bara avsändaren och mottagaren ser det) och en standardfunktion i
ramverket; ett ärende till en person syns för hela gruppen med mottagaren utskriven; mottagaren aviseras med en notis i appen
(mejl är inte beslutat); och **chatt, meddelanden och Assistent-tråden är EN modell** (beslut 4, arkitektens second opinion på
#185 punkt 1). Assistenten (AI) byggs inte, men modellen rymmer den.

**Modellen.** Ett samtal har ett `slag` ur `SAMTALSSLAG`: `grupp` (gruppens chatt, alla aktiva medlemmar), `personer` (privat,
exakt två deltagare) eller `agent` (en person och en medlem av typen `agent`, platsen för #185). Fälten är `SAMTALSFALT`
(`groupId`, `slag`, `deltagare`, `skapad`, `skapadAv`). Meddelanden (`MEDDELANDEFALT`: `text`, `av`, `tid`, högst `MAX_MEDDELANDE`
tecken) och läst-status (`LASTFALT`: `lastTill`) är **undersamlingar** till samtalet, så att ingen deltagarlista kopieras till varje
meddelande. Tider är millisekunder.

- ⛔ **Nyckeln härleds, `samtalsnyckel`**: `<groupId>|grupp`, eller `<groupId>|<uid>|<uid>` med uid:na sorterade. Högst ett
  samtal per par och grupp kommer ur nyckeln och regeln, aldrig ur en fråga före skrivningen. Två deltagare och inte N, eftersom
  regelspråket saknar `join` och en nyckel regeln inte kan kontrollera är en unikhet bara klienten lovar.
- ⛔ **Olästa räknas fram, `olastaI`**: andras meddelanden efter läsmärket. Ingen räknare lagras.
- ⛔ **Inget `senast` på samtalet.** Det senaste meddelandet finns redan, och inkorgen läser meddelandena ändå för att räkna olästa.
  Ett lagrat utdrag hade varit en andra sanning som vem som helst i gruppchatten kan skriva om. `utdrag` härleder det.
- `byggSamtal`, `byggMeddelande` bygger eller kastar med skälet. `motpart(samtal, uid)` är den andra deltagaren.

**Mottagaren på ett ärende**, `byggMottagare(m, medlemmar?)`: formen `{ slag, uid? }` med `slag` ur `MOTTAGARSLAG` (`grupp`,
`person`, `agent`). Appens ärenden ligger i appens samling och appen skriver deras regler; ramverket ger formen, valideringen (med
medlemmarna: personen är en aktiv `person`, agenten en aktiv `agent`) och väljaren. Ett ärende till en person syns för hela gruppen,
alltså ska appens läsregel för ärenden INTE bero på `mottagare`.

| | |
|---|---|
| `samtalsregelfragment({ samtal?, meddelanden?, last?, medlemskap? })` | **reglerna, ur modellens fältlistor.** Aktiv medlem läser gruppchatten, bara deltagarna läser ett privat samtal och dess meddelanden, en borttagen medlem läser inget. Ett samtal skapas med den härledda nyckeln, av en deltagare, och båda är aktiva medlemmar (`personer`: båda personer; `agent`: den andra är agent). Deltagarna ändras aldrig och samtalet raderas inte. Ett meddelande skrivs med `av == request.auth.uid` av en medlem av typen `person`, så **en klient skriver aldrig som agent** (agentens svar skrivs av servern med Admin SDK). Meddelanden ändras och raderas aldrig: ett meddelande är vad som sades. `tid` och `skapad` ligger inom fem minuter från serverns klocka. Läst-status är bara personens egen. Kräver `regelfragment()` (dess `opsArMedlem`), med samma `medlemskap`. Regelprov i `rules/__tests__/samtal.test.mjs` |
| `createSamtalskalla({ kalla, samtal?, meddelanden?, last?, sida? })` | **läser och skriver samtalen genom en datakälla.** `lista`, `oversikt` (varje samtal med senaste meddelandet, olästa och läsmärket, nyast först), `oppnaGrupp`, `oppnaPrivat` (samma samtal för A till B som för B till A), `meddelanden`, `prenumerera` (om källan kan), `skicka`, `lastTill`, `markeraLast`. ⛔ `lista` är TVÅ frågor, gruppchatten på `slag` och de privata med `innehaller: { deltagare: uid }`: en fråga över hela gruppen hade tagit med andras privata samtal, och regeln nekar den |
| `samtalsnotiser({ samtal, uid, namnFor, href? })` | **notiser för olästa privata meddelanden, som en källa för ytan `notiser`.** Inget nytt notissystem: notisen härleds ur samtalet och läsmärket när notiserna hämtas och försvinner när meddelandet läses. Id `<samtal>|<meddelande>`, titel "X skickade ett meddelande". Registreras som `kallor.notiser` i en av appens moduler |
| `useSamtal({ kalla, groupId, uid })` | inkorgens rader och antalet olästa. Tre tillstånd (`laddar`, `fel`, `rader`), och `olasta` räknas ur raderna, så ingången och listan kan inte visa olika tal |
| `OpsMeddelanden` | **inkorgen, som SS `ChatInboxPanel`.** Listan till vänster (35 procent, minst 220 px) och samtalet till höger på dator, listan som hela sidan och "‹ Tillbaka" på telefon. Filtret Alla / Olästa, sökning, räknare i samtalsrutans hörn, etiketten Grupp, Privat eller Agent. Props `kalla`, `uid`, `groupId`, `gruppNamn`, `medlemmar` (gruppens medlemskap), `onNytt`, `valt`/`onValj`, `onOlasta`, `sprak`, `texter` |
| `OpsSamtal` | ett samtal: huvudet med raden om vem som ser det ("Bara ni två ser det här"), bubblorna och skrivfältet (Enter skickar, Skift plus Enter bryter raden). Samma vy för alla tre slagen. Flyttar läsmärket när samtalet är öppet |
| `OpsNyttMeddelande` | **"Nytt meddelande"**: `OpsMottagare` i personläget och en text. Öppnar det privata samtalet och skickar i det, `onKlar(samtalId)`. Raden "Bara ni två ser det här." står under mottagaren. Ritas av skalets `skapa.meddelande` |
| `OpsMottagare` | **en väljare för ärenden och meddelanden.** `lage="arende"`: Gruppen (förval), varje aktiv person (en själv märkt "du") och Agenten när gruppen har en agent. `lage="person"`: bara andra aktiva personer. En radiogrupp med avatarer, 44 px per rad |
| `OpsMeddelandeLank` | ingången, en `OpsIconLink` med meddelandeikonen och antalet olästa, för appens `actions` |

**Skalet:** `skapa.meddelande` är en funktion `({ formId, groupId, onKlar }) => nod`, normalt `OpsNyttMeddelande`. Med den står
"Nytt meddelande" i plusset (efter Nytt ärende, före Ny grupp), panelen har den smala kolumnen och knappen **Skicka**
(`skickaEtikett`), och meddelandet skrivs i den aktiva gruppen utan gruppväljare. Etiketten är `nyttMeddelandeEtikett`.

**Datakontraktet** fick `innehaller` (0.34.0): `{ innehaller: { deltagare: uid } }` är Firestores `array-contains`, ett fält per
fråga. Minnesadaptern och Postgres (`= ANY`) stöder det; http-adaptern KASTAR hellre än att skicka frågan utan villkoret, eftersom
en fråga som tappat villkoret ger fler rader än den bad om.

**Avgränsat i 0.34.0:** ingen AI, inga mejl, inga bilagor, ingen realtidsnärvaro ("skriver nu"), inga reaktioner, trådar,
fästa meddelanden eller redigering. Samtal med fler än två personer finns inte (modellen tål dem, regeln gör det inte än).

### Kalendrar (0.36.0, #179 F0)

CP 2026-09-29, epiken cllp/ops-framework#179: flera namngivna **gruppkalendrar** per grupp och egna privata **mina kalendrar**. Ramverket äger datamodellen och reglerna, appen skickar in samlingsnamnen (CLAUDE.md, "Vad som inte är regler här").

| Namn | Vad |
|---|---|
| `byggGruppkalender`, `validateGruppkalendrar`, `KALENDERFALT` | En gruppkalender är en katalogpost på typernas motor (`byggKategori`, `faser: false`): namn, `farg`, ikon, ordning, arkiverad, `groupId`, plus `forvald` och `iFlodet`. `KALENDERFALT` är härledd ur `KATEGORIFALT` (utan `fas`), och regelfragmentet läser den. ⛔ Högst en förvald, aldrig en arkiverad förvald, och bara en grupp per lista |
| `forvaldKalender` | Den markerade förvalda, annars den första valbara, annars `null`. Härledd och inte lagrad när ingen valt |
| `gruppkalendernyckel` | Dokumentnyckeln `groupId|id`, ur samma funktion som katalogens (`katalognyckel`) |
| `byggMinKalender`, `validateMinaKalendrar`, `MINKALENDERFALT`, `MAX_KALENDERNAMN` | En av mina kalendrar: `id`, `namn` (sträng, högst 80), `farg`, `ikon`, `ordning`, `forvald`, `iFlodet`, `arkiverad`. Ingen grupp: den ligger under användaren |
| `byggKalenderpost`, `KALENDERPOSTFALT`, `MAX_POSTTITEL`, `MAX_POSTBESKRIVNING`, `MAX_POSTPLATS` | En post i mina kalendrar: `kalenderId`, `titel`, `beskrivning`, `plats`, `start`, `slut`, `heldag`, `blockerar`. Heldag: `YYYY-MM-DD` och `slut` är sista dagen; annars `YYYY-MM-DDTHH:MM`, väggklocka i tidszonen. ⛔ `slut` aldrig före `start`, och `beskrivning` och `plats` är tomma strängar när de saknas, aldrig utelämnade |
| `postTillRad` | En post som en rad i `OpsCalendar` (`date`, `endDate`, `allDay`, `not` med tid och plats, `kalender` med namn och färg) |
| `KALENDERFARGER`, `KALENDERIKONER` | Färgen är identitetspalettens sex toner (en kalender står alltid med sitt namn, så tre slagfärger hade tvingat fram dubbletter vid fjärde kalendern). Ikonerna är ramverkets egna id:n |
| `STANDARD_TIDSZON`, `kontrolleraTidszon`, `idagI` | Tidszonen är en inställning med `Europe/Stockholm` som förval, inte en konstant som i SS. `idagI(zon, nu)` är dagens datum i zonen; `kontrolleraTidszon` kastar vid uppstart på en zon som inte finns |
| `kalenderfonster` | `{ fran, till }` för de månader `OpsCalendar` ritar (förval 12 bakåt och 12 framåt). Appens läsväg för `/kalender` ska använda den, så att det som ritas och det som läses är samma fönster |
| `isoVecka`, `datumOmfang`, `bandIVecka` | ISO-veckonumret, alla dagar mellan två datum (i valfri ordning), och banden i en veckorad med fil per överlapp (SS `getSpanSegmentsForWeekRow`) |

⛔ **Inte i 0.36.0:** flödestoken och import (F4, F5), hantering av kalendrar (F2) och händelsernas `kalenderId` (F3). F2 och F3 kom i 0.37.0, se nästa avsnitt.

### Hantera kalendrar och händelsemodellen (0.37.0, #179 F2 och F3)

CP 2026-09-30 i #179: "man skall kunna välja att skapa en händelse i olika kalendrar [...] om det är i gruppens kalender så skall vi kunna välja att händelsen skall kräva medlemmars bekräftelse". Appens händelser är appens data; ramverket äger kontraktet för fälten det läser, svaren och deras regler.

| Namn | Vad |
|---|---|
| `OpsKalendrar` | **Hantera kalendrar**, som SS `PersonalCalendarsInlineSection`: ett kort för gruppens kalendrar och ett för mina, med skapa, byta namn, färg, ikon, ordning (upp och ned), förvald och arkivera (arkiverade under en egen rubrik med "Ta fram"). `{ gruppens, mina, groupId, kanAndraGruppens, onSparaGruppens(rader), onSparaMina(rader), gruppNamn?, sprak? }`. ⛔ Skickar bara de rader som ändrats; att byta förvald är två. Utan `kanAndraGruppens` ritas gruppens lista utan knappar och med raden "Bara gruppens ägare och admin ändrar gruppens kalendrar." "Tas med i flödet" visas inte förrän flödet (F4) finns |
| `kalenderIdUrNamn`, `nastaOrdning`, `ORDNINGSSTEG`, `flyttaKalender`, `valjForvald`, `arkiveraKalender` | De rena funktionerna bakom hanteringen. `flyttaKalender` numrerar om (två kalendrar med samma `ordning` byter annars inte plats), `valjForvald` svarar med den nya och den gamla förvalda, och en arkiverad kalender är aldrig förvald |
| `kalenderval` | Gruppens och mina kalendrar som val (`{ id, namn, farg, ikon, grupp, forvald }`), bara valbara, i ordning, med den härledda förvalda. Samma lista matar `OpsCalendar kalendrar` och "Skapa i" |
| `filtreraPoster`, `forvaldKalenderId` | Kalenderfiltret som ren funktion: en post i en bortvald kalender syns inte och syns igen när kalendern väljs; en post utan `kalender` hör till gruppens förvalda |
| `createKalenderkalla({ kalla, anvandare?, gruppkalendrar?, minaKalendrar?, kalenderposter? })` | Läser och skriver kalendrarna: `gruppens`, `sparaGruppens`, `mina`, `sparaMina`, `poster`, `sparaPost`, `taBortPost`. Flera rader skrivs i en batch när källan kan, annars säger svaret `atomar: false` |
| `HANDELSEKONTRAKT`, `handelsefel`, `handelsensKalenderId`, `handelsensDagar` | Fälten ramverket läser på appens händelse (`kalenderId`, `datum`, `slutDatum`, `tid`, `slutTid`, `heldag`, `kravSvar`), felen som meningar, kalendern (⛔ utan `kalenderId` gäller gruppens förvalda: ingen bakfyllnad) och datum, slutdatum och heldag som kalenderns fält |
| `SVARSVAL`, `SVARSFALT`, `byggSvar`, `sammanstallSvar` | Svaren Kommer och Kommer inte, en rad per person och händelse i `<handelser>/{händelse}/<svar>/{uid}` (nyckeln är personen, unikheten kommer ur sökvägen). `sammanstallSvar` skriver "3 kommer, 1 kommer inte, 2 har inte svarat", alltid alla tre delarna, och räknar bara medlemmarnas svar |
| `createSvarskalla({ kalla, handelser?, svar? })` | `lista(händelse)`, `mina(händelser, uid)` och `svara(händelse, uid, svar)` |
| `svarsrader`, `harPasserat` | Inkorgens rader, **härledda och inte skrivna**: händelser som kräver svar, som personen inte svarat på och som inte passerat. Raden försvinner när svaret skrivs, utan server och utan en post per medlem |
| `OpsSvar`, `OpsSvarsknappar`, `OpsSvarsrad` | Sammanställningen med en rad per medlem (bara min har knappar), knapparna Kommer / Kommer inte, och inkorgens rad |
| `handelseregelfragment` | `{ handelser, svar, gruppkalendrar }`. Svaren: bara personen själv skriver sitt, bara en aktiv medlem i händelsens grupp, bara när händelsen har `kravSvar == true`; medlemmar läser; ingen radering. Och `opsHandelsefaltGiltiga(ny, fore)`, som appen anropar i sitt eget händelseblock (`{}` vid create, `resource.data` vid update): `kalenderId` en av gruppens kalendrar och inte arkiverad (prövas bara när den ändras), `kravSvar` bool, `slutDatum` efter `datum`. Kräver `regelfragment()` ovanför |

**Ny händelse (`OpsAppShell skapa.handelse.kalendrar`):** med `{ gruppens, mina }` står **Kalender** överst i formuläret (raden öppnar "Skapa i" med gruppens kalendrar och "Mina kalendrar", den aktiva gruppens förvalda förvald). I en gruppkalender visar skalet **Kräv svar** (av från början), i en av mina **Blockerar tillgänglighet** och inget typval. Formuläret får `kalender: { id, slag }`, `kravSvar`, `blockerar` och `datum`. ⛔ "Skicka mejl" visas inte: avsändarbeslutet (#180 G3) saknas.

**Dagen till formuläret (#206):** `useOppnaSkapa()("handelse", { datum: "2026-10-12" })` öppnar "Ny händelse" med formulärets prop `datum`, och adressen bär `&datum=` så att en omladdning ger samma dag. Ett datum som inte finns kastar.

**Kalendern på telefon mot SS-appen (0.37.0):** CP jämförde 0.36.0 med en skärmbild ur SS-appen och fann rundningen, panelen, märkena, valet och verktygsraden fel. Förebilden är nu SS-appens `DayCell`, `DayDetailPanel` och `calendarDayMarkerLayout` (se `OpsCalendar` ovan). `dagdekor` och `daglager` är platserna för F6 (lager och tillgänglighet): en ton och hörnmärken i rutan, och en egen bubbla i dagpanelen. Vad som hamnar där avgör F6.

⛔ **Inte i 0.37.0:** upprepning av händelser (ej beslutat av CP), "Skicka mejl" (#180 G3), flödet och importen (F4, F5).

### ⛔ Vad som går att ändra utan en release, och vad som inte gör det

Det här är **produktlöftet**, och det står skrivet för att det annars blir ett
antagande. Beslut av CP 2026-09-26 (väg A i [#111](https://github.com/cllp/ops-framework/issues/111)).

| I inställningsvyn, utan release | Kräver en release |
|---|---|
| lägga till en kategori | en ny **sort med egna fält**, som ett kvittos belopp och moms |
| döpa om, på båda språken | ny **routing**, alltså vart en post tar vägen efteråt |
| skriva om **hjälptexterna**, på båda språken | ny **validering** utöver de fält som redan finns |
| byta palettplats och ikon | en ny **textnyckel**, alltså en text ingen vy ritar än |
| ändra ordning och fas | |
| arkivera och ta fram igen | |

Väg B, alltså deklarativa fältkrav i katalogen, är uppskjuten och inte
avfärdad. Den läggs till **additivt** som ett valfritt `falt` när ett andra
behov faktiskt finns. Skälet att vänta är mätt: en ny sort har tillkommit en
gång i år, och ett schemaspråk byggt för ett behov som inte uppstått kostar
varje gång något annat ska ändras.

| `kopplaBeteenden`, `beteendet` | katalogen, hanterarna | **gränsen för det dynamiska, väg A** (beslut CP 2026-09-26, #111): katalogen bär DATA, koden bär BETEENDE, och kopplingen vaktas åt BÅDA håll vid uppstart. ⛔ En kategori utan hanterare ritas, går att välja och gör sedan ingenting: exakt felet i cllp/bolag-ops#144, där sorten `bugg` aldrig blev ett ärende och ingenting blev rött. ⛔ En hanterare utan kategori är död kod som ser levande ut. ⛔ En ARKIVERAD kategori kräver också en hanterare: gamla rader ska ritas och räknas som förut. ⛔ Samlar alla fel i ett meddelande, till skillnad från `validateKatalog` som kastar på det första: här är felet en lista mot en annan lista. ⛔ `beteendet` svarar `null` och kastar aldrig, eftersom den körs i en vy |
| `createConfigLog`, `byggKonfigandring`, `beskrivKonfigandring`, `KONFIGHANDELSER` | `append` | **ändringsloggen för konfiguration.** ⛔ Egen logg och inte aktivitetsloggen: den senare säger vad ett JOBB gjorde, den här vad en MÄNNISKA gjorde i en vy, och de två frågorna ställs vid olika tillfällen. ⛔ `fore` KRÄVS för allt utom en nytillagd: en rad utan det svarar inte på vad som stod förut, och då är loggen en notis och inte ett spår. ⛔ `skriv` kastar aldrig, den svarar `{ ok, fel, orsak }`, och `orsak` skiljer `utkast` (programfel) från `skrivning` (drift). En logg som kan sänka det den loggar är värre än ingen logg. ⛔ `beskrivKonfigandring` bygger meningen ur RADEN och inte ur dagens katalog, annars skriver den om historien: "Ärenden döptes om till Ärenden" |
| `OpsKatalogInstallning` | `kategorier`, `ikoner`, `onSpara`, `onArkivera`, `groupId` | **inställningsvyn för en katalog.** ⛔ ARKIVERAR, RADERAR ALDRIG: en raderad kategori lämnar varje rad som pekar på den utan kategori, och de raderna blir omöjliga att filtrera och räkna långt efter att någon tryckt. Arkiverad går att ta fram igen, alltså är det det enda ångrbara alternativet. ⛔ `kanAndra` kommer ur rollerna, och vyn SÄGER att den inte är låset: den som vill skriva ändå öppnar konsolen, det riktiga låset är Firestore-reglerna. ⛔ Nyckeln går inte att ändra på en befintlig kategori, och formuläret säger att en omdöpning behåller kopplingen, annars vågar ingen döpa om något. ⛔ Färgen väljs som PLATS och det finns ingen ruta att skriva en hex i. ⛔ Vyn skriver inte själv: `onSpara` och `onArkivera` kommer utifrån, som datakällan. ⛔ `groupId` KRÄVS (0.33.0, #162): den aktiva gruppens id, och varje ny eller ändrad kategori byggs med det. Utan det vägrar vyn monteras, eftersom en kategori utan grupp delas av alla grupper i samlingen. ⛔ Byts `groupId` stängs ett öppet utkast i samma rendering: före 0.33.0 stod den förra gruppens kategori kvar i formuläret, och Spara skrev in den i den nya gruppens katalog (`check-skalyta` avsnitt 28). Ge `onSpara` till katalogkällans `spara`, som skriver med `katalognyckel` |
| `createCatalogSource` | `source`, `collection`, `groupId` | **Firestore är sanningen, repot bär standardvärdena.** ⛔ `collection` kommer utifrån: det är raden som gör en framtida kund till ett eget projekt utan att datamodellen ändras. ⛔ `groupId` KRÄVS (#162, väg C i [#160](https://github.com/cllp/ops-framework/issues/160)): katalogen är EN GRUPPS EGEN, samma mönster som `gruppkalla.js`, och varje fråga är `where: { groupId }`. ⛔ `groupId: null` (0.29.0, "ogrupperad, hela samlingen") FINNS INTE sedan 0.33.0: det läste allas rader och skrev rader utan grupp, utan slut inbyggt. ⛔ **`overgang: true`** ersätter det, TILLSAMMANS med appens groupId, för en app vars samling har rader från före #162: hela samlingen läses (en rad utan fält går inte att fråga efter), raderna utan grupp räknas som den här gruppens, andra gruppers rader faller bort, `spara` vägras och `seeda` gör ingenting. Det slutar fungera när katalogreglerna är ute, eftersom de nekar en fråga utan grupp, och det är avsiktligt: ordningen står i CHANGELOG 0.33.0. ⛔ `las()` KASTAR ALDRIG, den svarar `{ kategorier, kalla, fel, utanGrupp }`. `kalla` skiljer `databas` från `reserv`, så en banderoll går att visa, och reserven bär källans `groupId`. `utanGrupp` är antalet rader utan grupp i det som lästes, ALLTID med och 0 när övergången är klar. Utan `overgang` gör en rad utan grupp läsningen till reserven, med felet "groupId krävs", i stället för att tyst hamna i någon grupp. ⛔ En TOM samling är `databas` och inte `reserv`: läget före seedningen, FÖR DEN HÄR GRUPPEN. ⛔ `seeda()` rör aldrig en samling som har värden FÖR DEN HÄR GRUPPEN, och svarar med VAD som hände. ⛔ **`spara(kategori)` (0.33.0) är den enda skrivvägen**: bygger raden med källans `groupId` och skriver med `katalognyckel(groupId, id)`. Före 0.33.0 fanns ingen, och appen skrev `source.create(samling, kategori)` med kategorins `id` som nyckel, alltså samma dokument för två gruppers "uppgift". En kategori som bär en ANNAN grupps groupId kastar i stället för att flyttas tyst. ⛔ Standardvärdena (`standard`) HAR INGET groupId och valideras med `grupp: false`: de är mallen, gruppen äger sin kopia först efter seedning |
| `katalognyckel`, `gruppensRader` | `groupId`, `id` / råa rader, `{ groupId, overgang? }` | **nyckeln och tolkningen av en lagrad rad (0.33.0), i båda ingångarna.** `katalognyckel(groupId, id)` ger `groupId|id`, samma form som `medlemskapsId`, och kastar på en del som inte har id-formen. Katalogkällan, `skapaGrupp`, bakfyllnaden och en app som skriver själv använder samma funktion, och regelfragmentet låser formen. `gruppensRader(rader, { groupId, overgang })` är den ENDA platsen som tolkar en lagrad rad: den egna gruppens rader packas upp till rent `id`, en annan grupps faller bort, en rad utan grupp stämplas med gruppen under `overgang` och lämnas annars orörd så att valideringen säger "groupId krävs". Svarar `{ rader, utanGrupp, andraGrupper }`, räknarna alltid med. En app som prenumererar själv (bolag-ops läser med `useLiveCollection`) ska köra sina rader genom den, så att klienten och functions ser samma katalog |
| `katalogregelfragment` | ett eller flera samlingsnamn | **regelfragmentet för katalogens delade samling(ar) (#162).** Samma block som `gruppadSamling`, med `hasOnly` härledd ur `KATEGORIFALT` så fältlistan och regeln inte kan glida isär. Medlem läser, uppslag på radens `groupId`, ingen radering. ⛔ **Ägare och admin skriver (`opsArAdmin`, 0.33.0)**, enligt 0.32.0:s rollmodell: katalogen är samma sorts konfiguration som gruppens utseende, som admin redan ändrar, medan ägaren ensam behåller det strukturella (`moduler`, att arkivera gruppen). Före 0.33.0 stod `opsArAgare` här, skrivet innan rollen admin fanns. ⛔ **Nyckeln låses vid skapelse** till `<radens groupId>|<id>`: annars kunde en admin i grupp A skapa `B|uppgift` med sin egen grupp på raden, och grupp B kunde sedan aldrig spara "uppgift" (en uppdatering av en rad som tillhör A). ⛔ En fråga utan `where: { groupId }` nekas, så övergångsläget (`overgang`) måste vara borta ur klienten innan fragmentet deployas |
| `kalenderregelfragment` | `{ anvandare, gruppkalendrar, minaKalendrar, kalenderposter }` (förval `users`, `gruppkalendrar`, `minaKalendrar`, `kalenderposter`) | **regelfragmentet för kalendrarna (0.36.0, #179 F0).** Gruppens kalendrar får katalogens block med `KALENDERFALT` (medlem läser, ägare och admin skriver, nyckeln `groupId|id`, ingen radering). Mina kalendrar och posterna i dem ligger under användaren, och bara ägaren läser och skriver: en annan inloggad, också en admin i samma grupp, läser dem inte. En post måste ligga i en av ÄGARENS kalendrar som inte är arkiverad, titeln har tak, `heldag` avgör om `start` och `slut` är datum eller tidpunkt, och `slut` är aldrig före `start`; datumuttrycken härleds ur samma uttryck som `byggKalenderpost` prövar med. ⛔ En post får raderas av sin ägare (en privat post har ingen annan läsare som frågar varför den försvann), en kalender arkiveras. Kräver `regelfragment()` ovanför |
| `samtalsregelfragment` | `{ samtal, meddelanden, last, medlemskap }` | **samtalens regler (0.34.0, #182).** Se [Samtal och meddelanden](#samtal-och-meddelanden-0340-182-185) |

⛔ **Bakfyllnaden av en befintlig katalog (#162, 0.33.0): skriptet är APPENS,
modellen är RAMVERKETS.** Skriptet CP kör bor i appen, med appens standardvärden
och appens grupp. Vad en bakfylld rad ÄR (nyckeln `groupId|id`, formen
`byggKategori` kräver, att den gamla raden tas bort i samma batch) är ramverkets,
och därför anropar skriptet `bakfyllKatalogGrupp` på nodsidan i stället för att
skriva raderna själv. Fram till 0.32.1 stod här att skriptet skulle skriva
`groupId` med en `update` per rad och låta nyckeln vara. Det hade lämnat varje
bakfylld rad under kategorins `id` medan `spara` skriver under `groupId|id`, alltså
två dokument för samma kategori efter första ändringen i inställningsvyn.

```js
import { bakfyllKatalogGrupp } from "@staiger/ops-framework/node";

const svar = await bakfyllKatalogGrupp({
  kalla,                      // Admin-källa MED batch
  samlingar: KATALOGER,       // samma objekt som createGroupService({ kataloger })
  groupId: "cps-ab",          // appens grupp: raderna utan grupp är dess
  torr: !process.argv.includes("--skarpt"),
});
// { torr, flyttade: { handelsetyper: 9, ... }, seedade: { handelsetyper: { "privat-x1": 9 } },
//   kvarUtanGrupp: { handelsetyper: 0, ... }, fel: [], skrivningar: 58 }
```

⛔ **Torrkörning är förval**, och en skarp körning skriver ALLT i en batch eller
ingenting. En rad som inte går att bygga, en rad vars nyckel redan har en grupps
form utan fältet, eller en konflikt (nyckeln `groupId|id` finns redan) står i
`fel`, och då skrivs ingenting. ⛔ Den seedar också varje grupp i `groups` som
saknar en katalog, till exempel en grupp skapad med 0.32.x, där `skapaGrupp` inte
skrev katalogerna i samma batch. ⛔ Omkörbar: en andra skarp körning svarar med
nollor. `kvarUtanGrupp` ska vara 0 i varje samling innan katalogreglerna deployas.

| `saknadeSprak`, `arGammalNamn`, `SPRAK`, `RESERVSPRAK` | ett objekt med namn i | **toleransen får inte vara tyst.** `saknadeSprak` räknar upp varje namn som saknar `en`, som SÖKVÄGAR och inte som en siffra: "fyra namn saknar engelska" går inte att åtgärda utan att leta, `kategorier.1.namn` går det. ⛔ En sträng räknas som saknad, annars visar vakten noll så länge ingenting migrerats, alltså är den som grönast när läget är sämst. ⛔ Räknar också varje text i katalogens `texter` (#117): inkorgens sorter bär nio texter var, alltså vida fler ord än namnen, och en vakt som bara tittade på nyckeln `namn` hade visat noll medan merparten av ytorna var enspråkiga |
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
| `byggSkapare`, `laesSkapare`, `skaparensNamn`, `arGammalForm`, `SKAPARTYPER` | **samma fem som i huvudingången**, eftersom både klienten och det som körs utan skärm skriver `skapadAv`. Två former av samma fält är precis det modulen finns för att förhindra |
| `FASER`, `AVSLUTADE_FASER`, `byggKategori`, `validateKatalog`, `valjbara`, `kategorin`, `arAvslutad`, `texten`, `katalognyckel`, `gruppensRader`, `SPRAK`, `RESERVSPRAK`, `byggNamn`, `text`, `arGammalNamn`, `saknadeSprak` | **katalogen och språken finns i båda ingångarna**, av samma skäl som `createActivityLog`: konfigurationen läses både av klienten och av det som körs utan skärm. Ett Cloud Function ska kunna fråga vilka sorter som finns utan att ladda React, och skillnaden är mätt till 8 ms mot 1946 ms |
| `createActivityLog` | **samma funktion som i huvudingången, återexporterad här**, och det är en mätning och inte en bekvämlighet. `createActivityWriter` kräver en modell ur den, så ett Cloud Function som ville skriva en rad tvingades importera hela webbuntlen. Mätt (Node 20, ur den utgivna tarbollen): `@staiger/ops-framework/node` tar **8 ms**, `@staiger/ops-framework` tar **1946 ms**. Nästan två sekunder per kallstart för att en funktion som skriver ETT dokument skulle ladda React, Radix och en kalender. ⛔ `check-node-side` kräver att nodsidan inte når React eller en komponent, varken direkt eller genom en mellanfil, annars är mätningen osann inom en månad |
| `createCaseMirror` | speglar öppna ärenden med en etikett till en ögonblicksbild. Tar `{ owner, repo, label }` som konfiguration, plus `summary` och `extraFields` som **funktioner**: ett reguljärt uttryck i konfigurationen hade tvingat ramverket att veta att just den verksamheten skriver en rubrik som heter "Varför" i sina ärenden. ⛔ `load` kastar vid fel svar och svarar aldrig med en tom lista: ett 403 som blir `[]` ser exakt ut som "inga öppna ärenden". ⛔ Pull requests filtreras bort, eftersom GitHubs issues-API returnerar dem som ärenden och varje öppen PR annars hamnar i uppgiftslistan |
| `uppdateraProfil({ kalla, uid, andring })` | #156. Den ENDA platsen som skriver `namn`/`bild` i `users` OCH i ALLA medlemskap för `uid` i samma steg, byggda genom `byggMedlemskap` så en trasig rad i databasen upptäcks i stället för att tystas in i ett rått patch-objekt. Bara `namn` och `bild` tas emot: de är de enda fälten som är denormaliserade i `memberships` (#138). Klienten kan inte göra det här själv, `memberships` har `allow write: if false` |
| `bakfyllKatalogGrupp({ kalla, samlingar, groupId, torr?, grupper? })` | 0.33.0, #162. Ger katalograder utan grupp appens `groupId` och nyckeln `groupId|id`, tar bort den gamla raden, och seedar grupper som saknar kataloger, ALLT i en batch. Torrkörning förval. Se bakfyllnaden under katalogtabellen ovan och ordningen i CHANGELOG 0.33.0 |
| `seedaKataloger({ kalla, groupId, standardvarden })` | #161, #162. Seedar en befintlig grupps kataloger, en `createCatalogSource(...).seeda()` per katalog. ⛔ `skapaGrupp` anropar den inte längre (0.33.0): den skriver katalogerna i sin egen batch. `standardvarden` är ett objekt, en nyckel per katalog (samlingens namn): värdet är antingen en lista rader (genväg för `{ standard: rader }`) eller katalogens fulla `createCatalogSource`-konfiguration (`standard`, `ikoner`, `textnycklar`, `faser`, `farger`). Bygger EN `createCatalogSource` per katalog, med `groupId` inbakat, och kör dess `.seeda()`. Svarar `{ [namn]: { seedade, antal, orsak? } }`, en rad per katalog, aldrig en sammanslagen bool. Katalogerna seedas i turordning, inte parallellt |

⛔ **Varför en egen ingång och inte bara en modul till.** Allt som når
`src/index.js` buntas för webbläsaren, alltså hamnar i varje besökares JS-fil.
Speglingen kräver en token. Gränsen upprätthålls av `check-node-side` och inte av en
kommentar, eftersom ett löfte om att en hemlighet inte läcker är värt exakt vad den
som råkar bryta det råkar minnas.

### Sidchrome och sidnavigering (0.31.0)

Design-QA på live 0.30.1 (cllp/bolag-ops#475, ramverkets del):

- ⛔ **Varje sida under Hub har raden "‹ Hub / Sida".** `OpsHubModul` ritar den på modulsidan; sidorna modulens kort leder till ger
  `OpsView` propen `tillbaka={{ hubHref, etikett, steg }}` (eller ritar `OpsHubTillbaka` direkt). En sida två nivåer ned ger
  `steg={[{ href: "/ekonomi", label: "Ekonomi" }]}` och blir "‹ Hub / Ekonomi / Inkomster". Raden kopieras aldrig.
- **Sidchrome ligger i tokens, inte i sidan.** `OpsView` ger max-bredd (`narrow`, `normal`, `wide`, `full`), sidomarginal (16 px),
  vertikal rytm (`gap-4`) och `--safe-bottom`; `OpsViewHeader` ger rubriken (rollen `rubrik`, `OpsHelp` bakom frågetecknet); kort och
  paneler har rundningen `--radius-card` (24 px) och raderna `--radius-base` (12 px). En app som ritar sin egen sida ärver dem genom
  att ligga i en `OpsView`, och skriver aldrig egna `max-w-*`, `px-*` eller `rounded-*` runt innehållet.
- **Gruppmodellen är densamma överallt:** från `lg` gruppanelen (utfälld eller infälld), under `lg` en gruppväxlare i huvudet som visar den
  aktiva gruppens märke (och från `md` dess namn) och öppnar listan. Aldrig en ensam chevron utan grupp. Mäts vid 390, 900 och 1280 px på
  Hub och modulsidan.
- **Hub och modulsidan flödar aldrig över.** Raden hade `-mx-4` och gav horisontell överflödning i en kolumn utan egen padding; den hålls nu i
  innehållskolumnen. Barnkorten under en modul är samma kort som Hubs (ikon, namn, räknare, info).
- **Info-raden i ett Hubkort** är `ink-secondary` (7,65:1 mot kortet i ljust läge; `ink-muted` gav 3,76:1) och "Inget nytt" har en egen tyst
  statusstil (en punkt före texten). Paren står i check-kontrast.
- **Ikonknapparna i huvudet** har `aria-label` OCH en synlig tooltip med namnet vid hover och fokus. Åtgärder som flyttas till menyn under `md`
  (Fråga) står där med sitt namn.
- **Inloggningskontrollen är ett skelett**, inte en text: huvudet och innehållet som grå block, och efter `laddaLangsamMs` (8 s) en rad med
  "Försök igen" (`onForsokIgen`, förval: ladda om).

### Navigationen

[#173](https://github.com/cllp/ops-framework/issues/173), CP 2026-09-29. Skalet har
två modeller för sin navigering, och en app väljer EN.

**Den nya (0.30.0): fasta poster plus moduler i Hub.**

```jsx
<OpsAppShell
  brand={<OpsBrand undertext="Bolag Ops" />}
  fasta={{ idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } }}
  moduler={[{ href: "/ekonomi", label: "Ekonomi", icon: <Wallet />, children: [{ href: "/inkomster", label: "Inkomster" }] }]}
  activeHref={pathname}
  meny={{ sektioner, app: [{ href: "/installningar", label: "Bolaget" }], onLoggaUt }}
>
```

- **Ramverket äger Idag, Kalender och Hub**: ordning, namn (sv och en) och ikoner.
  Appen säger bara vart var och en leder. Toppraden visar de tre; Hub är en post med
  chevron-dropdown över modulerna (samma mekanik som en post med `children`).
  Bottenraden på telefon är Idag, Kalender, ETT STORT PLUS i mitten, Hub, Meny, med
  SessionStudios mått (ikon 20 px, etikett 10 px, raden 56 px). Plusset öppnar samma
  lista som plusset i huvudet (`skapa`), och huvudets plus göms då under `md`: ett plus per yta.
- **Modulerna bor i Hub, aldrig i menyn.** `OpsHub` är sidan Hub leder till, ett kort per
  modul med undersidorna som länkar under. Appen skickar samma `moduler` till skalet och till `OpsHub`.
- **Menyn har två sorters innehåll**: ramverkets (`meny.sektioner`: Aktivitet, Inställningar, Hjälp,
  Notiser) och appens egna länkar (`meny.app`, egen sektion med rubrik, `meny.appRubrik`, förval Appen/App).
  **En avgränsare mellan varje par sektioner, aldrig två**: `MenyAvdelningar` äger frågan var en linje går.
- ⛔ `nav` och `fasta` får inte ges ihop, och `moduler` kräver `fasta`. Skalet kastar
  hellre än att gissa vilken modell som gäller.

**Den gamla (`nav`)** fungerar som förut, oförändrad.

⛔ **Hover och rundning som SessionStudio.** Raden i en meny, dropdown, ark eller plusset är
`radKlass` (12 px `rounded-base`, `hover:bg-raised`, aktiv `bg-raised text-accent`), behållaren
`bg-surface`. Ikonknapparna i huvudet är 36 px cirklar med 44 px träffyta som osynlig yta;
avataren en 28 px cirkel i en 32 px knapp med ring. Mätt i `check-skalyta`, inte antaget.
Observerat vid mätningen: i ljust tema är `--color-raised` och `--color-surface` samma tal
(`#fefcf6`, SessionStudios `bg-card` och `bg-surface`), så hovern syns inte mot ytan där; i mörkt tema gör den det.

### Hub och modulkort

CP 2026-09-29 13:44 (0.30.1). Hub är sidan `fasta.hub.href` leder till, och
varje modul är ett kort på den. Ett kort är EN länk: ikon, namn, en räknare och en rad om vad som hänt.

Kontraktet är fält på modulens post i `moduler` (samma post som `OpsAppShell` får):

| Fält | Betydelse |
|---|---|
| `badge` | Räknare (vad som väntar). Ritas BARA när den är större än noll: "0" på varje kort är brus. |
| `info` | EN kort rad under namnet, dämpad och avkortad. Sträng eller `{ sv, en? }`. **Utelämnad: ingenting ritas** (appen har inget att säga). **`null`: ramverket skriver "Inget nytt" / "Nothing new"** (modulen har en källa och den är tom). Tomhet är ett svar (arbetsreglernas punkt 5), och en tom rad kan inte visa vilket av de två det är. En tom sträng kastar. |
| `children` | Undersidor (en nivå). En modul med barn har en egen sida, `OpsHubModul`. Barnen bär samma `badge` och `info`. |

```jsx
const moduler = [
  { href: "/oversikt", label: "Översikt", icon: <LayoutGrid />, info: "3 saker att göra" },
  {
    href: "/ekonomi", label: "Ekonomi", icon: <Wallet />, badge: unhandled,
    info: { sv: "Skatten förfaller 12 oktober", en: "Tax is due 12 October" },
    children: [
      { href: "/ekonomi/inkomster", label: "Inkomster", badge: 1, info: "Ny faktura i går" },
      { href: "/ekonomi/kostnader", label: "Kostnader", info: null }, // "Inget nytt"
    ],
  },
];

// /hub
<OpsHub moduler={moduler} activeHref={pathname} onNavigate={navigera} />

// /ekonomi: en egen sida, med "‹ Tillbaka" och rubriken "Ekonomi" överst (ingen fast rad)
<OpsHubModul modul={moduler[1]} hubHref="/hub" activeHref={pathname} onNavigate={navigera} />
```

Varje steg har en egen `href`, så webbläsarens och telefonens bakåt fungerar. I rullgardinen i toppraden är
en modul med barn en rad med chevron (`aria-expanded`) som fäller ut barnen, infällda från början. **På Hub-sidan är kortet själv den utfällbara**
(0.31.2): tryck på Ekonomi, barnen visas under kortet, tryck igen så fälls det ihop; "Visa Ekonomi" leder till modulens sida.
Menyns rullgardin och ark har **en standardhöjd** (`min(32rem, fönstret minus toppraden)` på dator, `min(85dvh, 36rem)` på telefon), så att Aktivitet inte hoppar.

#### Hubben per grupp (0.37.0, #184)

CP 2026-09-30: "Ekonomi är EN modul. Inte massa moduler med komponenter." Tre nivåer: **instansen** (appen), **gruppen**
(vilka som är med) och **modulen** (ett kort i hubben, inne i en grupp). Hubben visar den **aktiva gruppens** moduler, ett kort
per id i `groups.moduler`, i den ordning ägaren satt, och **inget annat**. Det finns alltid exakt en aktiv grupp (0.35.0, #190).
Kalendern, chatten och inkorgen är ramverkets grund och har alla grupper, utan att en modul väljs.

- **Registret är manifestet.** En modul med ett kort har `hubb: { ikon, rutt, startsida, delar }` i `defineModule` (se
  [Modulkontraktet](#modulkontraktet)). Ramverket vet aldrig vad Ekonomi är, bara att en modul med id `ekonomi` finns.
- **`OpsGruppHubb`** ritar hubben för en grupp (`grupp`, `moduler`, `activeHref`, `onNavigate`, `sprak`, `info` och `badge`
  per modul-id). ⛔ En modul som appen inte registrerat, eller en med `hubb: null`, ritas inte, och en rad under korten
  säger vilken och varför. En grupp utan moduler säger det med gruppens namn. Beslutet bor i **`hubbForGrupp`**, så det går
  att pröva utan att rita.
- **`hubbPoster(kort, { sprak, info, badge })`** ger samma kort som nav-poster, EN per modul och inga barn: det är vad appen
  skickar som `moduler` till `OpsAppShell`, så att toppradens rullgardin listar modulerna och bara dem.
- **`OpsModulSida`** är modulens insida (`modul`, `activeHref`, `hubHref`, `onNavigate`, `sprak`, `children`): "‹ Tillbaka"
  till hubben, modulens namn, och en rad **länkar**, en per del, med den öppna delen understruken. Raden rullar i sidled när
  den inte får plats. `children` är delens vy; appens router väljer den. Vilken del som är öppen avgör **`modulLage`**:
  modulens egen adress är startsidan, och en undersida till en del markerar delen.
- **`valbaraModuler(moduler)`** är det ägaren väljer bland i `OpsGruppFormular` (prop `moduler: { valbara, agare }`,
  bara redigeringsläge och bara ägaren; en admin ser inte fältet, och reglerna avvisar det ändå).

**Gamla adresser.** Bokmärken och länkar i Inkorgen pekar på adresser som fanns före flytten. Appen skriver en lista, och
**`byggOmdirigeringar`** validerar den vid uppstart:

```js
const OMDIRIGERINGAR = byggOmdirigeringar(
  [
    { fran: "/oversikt", till: { modul: "ekonomi", del: "oversikt" } },
    { fran: "/inkomster", till: { modul: "ekonomi", del: "inkomster" } },
    { fran: "/hub/ekonomi", till: { modul: "ekonomi", del: null } }, // null: modulens egen adress, alltså startsidan
  ],
  moduler,
);
omdirigera("/inkomster?ar=2026", OMDIRIGERINGAR); // "/ekonomi/inkomster?ar=2026"

// Appens prov: adresserna som fanns före flytten, ur routern, inte ur listan ovan.
kontrolleraOmdirigeringar({ gamla: ["/oversikt", "/inkomster", "/hub/ekonomi"], omdirigeringar: OMDIRIGERINGAR, moduler });
```

⛔ **Målet är ett id, inte en adress.** Adressen härleds ur manifestet, så en del som flyttar tar sina omdirigeringar med sig,
och ett id som inte finns kastar vid uppstart. ⛔ `del: null` skrivs ut, en utelämnad `del` kastar. ⛔ En gammal adress får
inte vara en adress som lever i en modul, och inte ligga ovanför en (undersidor följer med: `/kontakter/anna` blir
`/ekonomi/kontakter/anna`, och `?` och `#` följer också med). ⛔ **`kontrolleraOmdirigeringar` jämför mot vad som FANNS**, inte
mot omdirigeringarna själva: en lista jämförd med sin egen kopia kan inte bli röd (arbetsreglernas punkt 4). Golv: minst en adress.

`OpsHub` och `OpsHubModul` finns kvar för appar som inte flyttat än. De ritar appens egen lista och vet inget om grupper.

### Typografin

Storlek, radhöjd, vikt och spärrning bor på ETT ställe: `typografi.roller` i
`tokens/sessionstudio-profil.json`, som `scripts/generate-tokens.mjs` skriver till
`tokens.css`. Tio roller (0.31.2), avlästa ur SessionStudio med fil och rad. ⛔ **Ingen ramverkskomponent skriver
`text-xs/sm/base/md/lg/xl`, bara en roll** (`check-typografi` och `check-skalyta` avsnitt 20 mäter det):

| Roll | Storlek / radhöjd | Används till |
|---|---|---|
| `text-sida` | 1,25 rem / 1,75 rem, fet | sidans rubrik, SS `text-xl` (`GroupDetailView.jsx:95`) |
| `text-titel` | 1,125 rem / 1,75 rem, fet | händelsekortets titel, SS `text-lg` (`TodayView.jsx:89`) |
| `text-rubrik` | 1 rem, fet | dialog- och panelrubrik (`SettingsView.jsx:161`) |
| `text-brod` | 1 rem / 1,5 rem | brödtext större än etikett, SS `text-base` (`SearchView.jsx:157`) |
| `text-etikett` | 0,875 rem / 1,25 rem | radens etikett, kortets meta, faktarader, hjälptext på Idag, segmentpillret: SS `text-sm` (`:228`, `TodayView.jsx:91/258/438`) |
| `text-meta` | 0,75 rem / 1 rem | chips, märken, tidsstämplar: SS `text-xs` (`TodayView.jsx:650`) |
| `text-sektion` | 0,75 rem, 600, spärrad | sektionsrubrik, plus `uppercase text-accent` (`:174`) |
| `text-hjalp` | 0,6875 rem (11 px) | hjälptext under en rad i inställningar (`:276`) |
| `text-liten` | 0,625 rem (10 px) | bottenradens etikett, flikar, avataretikett (`MobileTabBar.jsx:87`) |
| `text-mikro` | 0,5 rem (8 px), fet | räknemärkets siffra (`AppHeader.jsx:222`) |

SS har två responsiva par och ramverket följer dem exakt: kortets metarad `text-meta sm:text-etikett` (12 px under 640 px, 14 från; SS `text-xs sm:text-sm`, `TodayView.jsx:83`) och korttiteln `text-titel sm:text-sida` (18 / 20 px; SS `text-lg sm:text-xl`, `:89`). Allt annat är en storlek på alla bredder. Text utan roll ärver 16 px från `body`, och det är det som gav "diffar
i textstorlek" på Idag (0.31.1): ge alltid elementet en roll.

Radhöjderna är `--leading-tight` (1,25) och `--leading-normal` (1,5). **`check-typografi`**
fäller en literal storlek (`text-[13px]`) och `font-size:`/`font-family:` i komponenter, och
kan köras av en app mot sin egen källkatalog. Inställningsvyn (`OpsKatalogInstallning`,
`OpsModulKataloger`, `OpsField`) använder rollerna: sektionsrubrik, etikett och hjälptext, kort
`rounded-base border p-5`, `gap-3`, och rader som bryter sin text i stället för att flöda ut.

### Vakter

| Vakt | Vad den bevisar |
|---|---|
| `check-closed-api` läser strängar som strängar | `scripts/lib/kallkod.mjs` stryker kommentarer utan att tro att `accept="image/*"` är en. Den gamla strykaren slukade allt från snedstreck-stjärnan i strängen till nästa kommentarslut: synligt som en falsk positiv, osynligt som ett hål där riktiga brott passerade oläsa |
| `check-types` (`tsc --checkJs`) | JSDoc-typerna kontrolleras, och `.d.ts` följer med paketet |
| `check-docs` | varje exporterat namn och varje vakt är omnämnd i README, och antalet komponenter stämmer |
| `check-tokens` | elva regler i tokenkontraktet, plus golv mot fel fil. ⛔ **#167:** SessionStudios utseende är en fristående fixtur, `tokens/sessionstudio-profil.json` (färger, radier, typografiskala, ikonlinjebredd, kort, diagramfärger, rörelsetider, topprad), mätt ur `/home/user/sessions-platform` med fil och rad. `scripts/generate-tokens.mjs` skriver ur den in i `tokens.css` mellan markörer. Regel 8/9 (tidigare två handskrivna listor med SessionStudios tal, #157/#164) är nu EN regel: kör generatorns egen funktion mot fixturen och kräv byte-för-byte-likhet med vad som faktiskt står i filen. Regel 11: fixturen har ett eget golv. `npm run generate:tokens` körs i `prebuild`/`pretest`/`precheck:types`, som versionskonstanten |
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
| `check-statusord` | ingen gränssnittssträng kallar en **status** för **läge**. Taxonomin heter Status sedan CP:s beslut 2026-09-25 (cllp/bolag-ops#359), och ett fält som heter `status` i koden men "Läge" på skärmen tvingar varje läsare att hålla två ord för en sak. ⛔ Ordet står på ett sextiotal rader i `src/`, och nästan alla är riktig svenska om något annat: "mörkt läge", "nolläget", "radläget". Vakten använder därför den regel svenskan själv har: är `läge` **efterled** är det ett tillstånd eller en position och går fritt, är det **förled** (`lägesfilter`, `lägesväljare`) eller fristående är det taxonomin och fälls. ⛔ Läser bara stränglitteraler utanför kommentarer, och inga prov: ett resonemang om varför en kontrast mättes i mörkt läge ska inte fälla ett bygge. ⛔ Undantagen bär ett skäl som säger vilken ANNAN betydelse ordet har, och ett undantag som slutat matcha är också rött. ⛔ Går att peka mot en katalog, så bolag-ops kör samma vakt mot sin egen `web/src` |
| `check-datumnamn` | inga **månads- eller veckodagsnamn skrivna för hand**. `Intl` kan dem i varje språk; en egen lista kan ett, och ramverket hade två (`MONTH_NAMES` och `WEEKDAYS`) som var hela skälet till att kalendern inte gick att visa på engelska. ⛔ Vakten hämtar namnen den letar efter ur `Intl` själv: en vakt mot handskrivna ordlistor som bär en handskriven ordlista missar just den stavning någon kopierade därifrån. ⛔ Fäller bara när HELA strängen är ett namn, så "17 september 2026 mättes" går fritt: ett datum i en text är ett exempel. ⛔ `maj`, `mars` och `March` är undantagna som enskilda ord, eftersom de också är vanliga ord och en planet |
| `check-handritade-ikoner` | ingen komponent utanför `icons.jsx` ritar sin egen `<svg>` eller `<path d=`. ops-framework#164: krysset stod handritat på tre ställen (`OpsCalendar`, `OpsBottomNav`, `OpsFloatingSummary`), var med sin egen storlek och sitt eget strokeWidth, exakt samma mönster som `counter.jsx` redan lärt oss kostar en bugg per ritning. ⛔ Tre dokumenterade undantag (`OpsActivity`, `OpsSpinner`, `OpsShareChart`) bär var sitt eget skäl i koden och i vakten: en ensam ikon, en ikon som kräver `animate-spin` på själva SVG:n, och en beräknad diagramgeometri, inte en ikon. Ett fjärde `<svg>` utan ett likadant undantag är ett fynd. ⛔ Golv på 30 lästa filer, så en trasig sökväg inte blir tyst grön |
| `check-typografi` | **inga egna storlekar eller typsnitt förbi tokens.** Fäller `text-[13px]`, `text-[0.7rem]`, `font-size:` och `font-family:` i `src/components` och i en konsuments källkatalog (`node .../scripts/check-typografi.mjs src`), efter att kommentarer räknats bort. ⛔ 0.29.1 hade tio `text-[Npx]` i fem komponenter, var och en med sin egen vikt: ingen hade ett namn att rätta. Golv 60 filer för ramverket, 5 för en app (`--golv=N`). Se [Typografin](#typografin) |
| `check-skalyta` | **skalets yta mätt i en riktig webbläsare** (Chromium, fail-closed): ingen avgränsare närmare en annan än 24 px i menyn (arket vid 390 och rullgardinen vid 1280), huvudets ikonknappar som 36 px cirklar med 44 px träffyta och mittlinjer inom 1 px, loggan utan text och inte högre än toppraden, radens 12 px och hover i `--color-raised`, inställningsvyn utan horisontell överflödning vid 390 px, bottenraden med `fasta`. ⛔ jsdom kör ingen CSS, så fem av CP:s sex punkter 2026-09-29 gick grönt genom hela provsviten. Körs i CI-jobbet som redan har en webbläsare (`scaffold`), inte i `check`. `--utan-fasta` provar samma vakt mot en äldre `dist`, `--bilder <mapp>` skriver skärmbilderna |
| `check-paket` | **paketet går att installera och använda av någon som inte har repot.** Packar precis som utgivningen gör, installerar tarbollen i ett TOMT projekt med `--omit=dev` och importerar nodsidan, alltså samma tre steg som Firebase byggcontainer. ⛔ Fångar utgivningens klassiska fel: `exports` pekar på en fil som finns i arbetskopian men inte i tarbollen, så allt är grönt i repot och paketet är tomt hos den som installerar. ⛔ `--omit=dev` är hela provet: en nodsida som råkat importera esbuild eller vitest fungerar i repot och faller vid första anropet i molnet. ⛔ Kräver också att versionen är semver och har ett avsnitt i `CHANGELOG.md`. ⛔ Den bevisar INTE att en Firebase-deploy fungerar, den containern går inte att köra i CI. ⛔ `--struktur` kör bara de billiga reglerna och ligger i `npm run check`; hela vakten är ett eget jobb i CI och ett steg i utgivningen |
| `check-adoption` | en pågående upprensning går framåt, aldrig bakåt. ⛔ Kollar också, om konsumentens `package.json` finns intill `adoption.json`, att `scripts.check` innehåller `check:fonts` (ops-framework#164): mallen lägger raden i `create-ops-app`, men en app som fanns innan uppdateringen ärver den inte automatiskt, och en check-kedja utan `check:fonts` är lika oskyddad som innan den vakten skrevs |
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

## Utgivning: taggar, inte SHA:er

Varje tagg `vX.Y.Z` ger en **GitHub-release med en packad tarboll**
(`.github/workflows/publish.yml`). En konsument installerar den direkt:

```bash
npm install https://github.com/cllp/ops-framework/releases/download/v0.17.0/staiger-ops-framework-0.17.0.tgz
```

⛔ **Varför inte ett registry.** Kravet i cllp/ops-framework#93 är att
`bolag-ops/functions` ska kunna installera paketet utan inloggning, eftersom
Firebase byggcontainer inte har någon. Mätt 2026-09-25:

| Väg | Utan auth | Varför den inte duger |
|---|---|---|
| GitHub Packages | **HTTP 401** mot det publika `@github/catalyst` | läsning kräver token även för publika paket |
| Artifact Registry | kräver Google-konto | byggcontainern har inget |
| `github:cllp/ops-framework#v0.17.0` | går, repot är publikt | `dist/` är git-ignorerad, så installationen kör `prepare`, alltså esbuild och tsc, inne i containern |
| npmjs.com | går | kräver en ny hemlighet (`NPM_TOKEN`) och lägger bolagets gränssnitt publikt |
| **Release-tillgång** | **HTTP 200** | färdigbyggd, publik, oföränderlig per tagg, och publiceras med `GITHUB_TOKEN` utan en enda ny hemlighet |

⛔ **Taggen sätts av en människa efter merge**, och jobbet vägrar ge ut något om
`package.json` säger en annan version än taggen. Hela grinden plus `check:paket`
körs före releasen skapas: en tagg är oföränderlig i praktiken, och en
tillbakadragen version är värre än en som aldrig fanns.

Anteckningarna hämtas ur `CHANGELOG.md`. Saknas avsnittet för versionen är
`check-paket` redan röd, långt innan taggen sätts.

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
| Firestore-regler för **appens** samlingar | ramverket kan inte veta vem som får se vad i en domän det inte känner. Det är ett produktbeslut, och det är där det riktiga skyddet ligger. ⛔ Reglerna för ramverkets EGNA samlingar (konfig, medlemmar, ändringslogg, aktivitet) är en annan sak och hör hit, sedan CP:s beslut 2026-09-25 i cllp/bolag-ops#359. Se epiken cllp/ops-framework#92 |
| Beroenden på `firebase` och `pg` | adaptrarna finns, men SDK:n skickas in av appen. Ett ramverk som drar in en databasdrivrutin tvingar på den varje plattform |
| Skelettladdning | `OpsEmpty busy` täcker det grova fallet. Skelett är polish |
| Diagram | datavisualisering är ett eget hantverk och hör inte hemma i en komponentlåda |
| i18n för ramverkets egna strängar | de få som finns är svenska och går att skicka in som props. ⛔ **Datum och tal är undantagna och alltid har varit det**: de kommer ur `Intl` och styrs av `locale`, eftersom en egen ordlista per språk är tolv ord någon ska stava rätt medan webbläsaren redan kan dem (cllp/ops-framework#95). ⛔ Riktig tvåspråkighet, alltså ett namn som är `{ sv, en }` i stället för en sträng, är beslutad och ligger i Fas 2 av cllp/ops-framework#92. Den här raden krymper då till det som återstår |

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
