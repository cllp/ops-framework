# Branda en instans, och lägga på egen CSS

0.94.0. CP 2026-10-12: "Tänk på vårt koncept att det ska vara enkelt att branda en instans och overrida om man så vill med egen css."

En **instans** är en hubb, Identity eller en kunds egen kopia: en app som delar ramverkets komponenter men ska se ut som sig själv. Den här sidan säger vad en instans får ändra, i vilken fil, och varför egen CSS vinner utan `!important`.

## Kortversionen

1. En **brandfil** (`brand.css`) sätter variabler, bara variabler: typsnitt för rubriker, publika rubriker och märket, accenten i ljust och mörkt läge, och märkets mått. Ingen komponent rörs.
2. Valfritt en fil med **egen CSS** (`egen.css`) för det en variabel inte kan uttrycka: en regel som stilar ett element eller en klass. Den vinner över ramverket utan `!important`.
3. Båda importeras i appens stilrot **efter** ramverkets tokens, olagrade.

```css
/* src/index.css */
@import "tailwindcss";
@import "ops-framework/tokens.css";
@import "./brand.css";
@import "./egen.css";
@source "../node_modules/ops-framework/dist";
```

Ett körbart exempel ligger i `examples/brand/` (`brand.css` och `egen.css`) och mäts av `npm run check:brand`.

## Brandkontraktet: de variabler en instans får sätta

Det här är det **stabila gränssnittet**. Allt annat i `tokens/tokens.css` är ramverkets egna och kan byta namn i en minor-version. Listan bor i `tokens/brand-kontrakt.json`; `check:brand` kräver att varje namn nedan finns i `tokens.css` och i den här sidan.

Ljust läge och allt utan mörkt värde sätts i `@theme static { ... }`. Mörkt läge sätts som `--dark-*` i `:root { ... }`. Skriv aldrig ett eget `prefers-color-scheme`-block: ramverkets mörkerblock pekar redan på `--dark-*`.

### Typsnitt

| Variabel | Vad den styr | Förval |
|---|---|---|
| `--font-display` | rubrikerna i appens vyer (`font-display`: sidrubrik, panelrubrik, inställningsvyn) | `var(--font-sans)` |
| `--font-display-publik` | rubrikerna på publika sidor (`font-display-publik`, 0.94.0) | `Georgia, 'Times New Roman', serif` |
| `--font-marke` | märket (`OpsBrand`, `font-marke`) | `'Glacial Indifference', var(--font-sans)` |

Brödtextens familj, `--font-sans`, är **inte** en brandvariabel: en instans byter röst på rubrikerna och märket, och brödtexten är densamma överallt. (Beslut 4a, lifehub.app#165, 2026-10-10 sade att ingen hubb brandar typsnitt. CP ändrade det 2026-10-12: rubrikerna och märket får brandas, brödtexten inte.) En webbfont laddas med `<link>` i instansens `index.html`, som `create-ops-app` gör för Plus Jakarta Sans, och inte med `@import url()` i CSS: en `@import` som inte står först i filen ignoreras av webbläsaren (se kommentaren överst i `tokens.css`).

### Accent

Accenten är knappar, aktiv flik, fokusram, länkar och valda kort. `subtle` och `faint` är samma färg genomskinlig (12 och 6 procent). `contrast` är texten **på** en accentyta.

| Ljust läge | Mörkt läge |
|---|---|
| `--color-accent` | `--dark-accent` |
| `--color-accent-hover` | `--dark-accent-hover` |
| `--color-accent-subtle` | `--dark-accent-subtle` |
| `--color-accent-faint` | `--dark-accent-faint` |
| `--color-accent-contrast` | `--dark-accent-contrast` |
| `--color-marke-accent` | `--dark-marke-accent` |

`--color-marke-accent` är andra ordet i märket (förval gråorange).

⛔ **Kontrasten är instansens ansvar.** Texten på en accentyta ska klara 4,5:1 i båda lägena; `check:brand` mäter paret `contrast` mot `accent` i exempelfilen och i den brandfil du pekar den mot (`--brand <fil>`). Hubb × grupp × läge, där gruppens ton läggs ovanpå hubbens, är ops-framework#325 och byggs inte här. Semantiska färger (fel, framgång, kalenderns slag, inkomst och kostnad) rörs aldrig av en instans.

### Märket och loggan

Märket är **text** (CP 2026-09-29: "vi tar bort bilder, kör med text"), inte en bild. Orden, alltså namn, undertext och monogram, är skalets `brand`-prop (`<OpsBrand namn undertext monogram />`) och bor i instansens kod. Hur det ser ut styr variablerna:

| Variabel | Vad den styr |
|---|---|
| `--marke-storlek`, `--marke-undertext` | rad 1 och rad 2 i toppraden |
| `--marke-sparrning`, `--marke-undertext-sparrning` | spärrningen mellan bokstäverna |
| `--marke-radavstand` | avståndet mellan raderna |
| `--marke-monogram`, `--marke-monogram-sparrning` | monogramrutan när panelen är infälld |
| `--marke-storlek-stor`, `--marke-undertext-stor` | inloggningens större märke |
| `--logo-bredd`, `--logo-bredd-infalld` | märkesrutans bredd, utfälld och infälld |

### Publika sidor: tonerna, loggans höjd och rubrikfamiljen

Det publika skalet (nästa avsnitt) har **tre toner** efter SessionStudios `LandingFeatureBlock`: ett ljust band, ett band i accentfärgen och ett mörkt band. Varje ton är bakgrund, text och dämpad text, och alla är brandvariabler. Variationen på en publik sida kommer av att blocken växlar mellan tonerna, inte av fler sorters block.

| Variabel | Vad den styr | Förval (ramverkets egna tokens) |
|---|---|---|
| `--color-publik-ljus` | det ljusa bandet och sidans bakgrund | `var(--color-canvas)` |
| `--color-publik-ljus-text` | rubrik på ljust | `var(--color-ink)` |
| `--color-publik-ljus-dampad` | brödtext på ljust | `var(--color-ink-secondary)` |
| `--color-publik-markering` | överraden på ljust | `var(--color-accent)` |
| `--color-publik-accentband` | hela bandet i accentfärgen, och uppmaningen | `var(--color-accent)` |
| `--color-publik-accentband-text` | rubrik på accentbandet | `var(--color-accent-contrast)` |
| `--color-publik-accentband-dampad` | överrad och brödtext på accentbandet | `var(--color-accent-contrast)` |
| `--color-publik-mork` | det mörka bandet, toppraden och sidfoten | `var(--dark-surface)` (mörkt oavsett läge) |
| `--color-publik-mork-text` | rubrik och text på mörkt | `var(--dark-ink)` |
| `--color-publik-mork-dampad` | brödtext på mörkt | `var(--dark-ink-secondary)` |
| `--color-publik-mork-markering` | överraden på mörkt, hjältens överrad | `var(--color-accent)` |
| `--color-publik-toning` | färgen bilder och hjälten tonas med | `var(--dark-canvas)` |
| `--publik-logga-hojd` | loggans höjd i toppraden | `2rem` |

Överraden har en färg på det ljusa bandet och en på det mörka: SessionStudios orange duger inte som text på krämfärgat (2,4:1), och Life Hub vill ha guld på mörkt och mörk text på ljust. På accentbandet delar överrad och brödtext `accentband-dampad`, som kan vara samma färg som `accentband-text` när kontrasten kräver det (en genomskinlig 78 procent av en färg på en färg ger lägre kontrast än färgen själv). Förvalen följer appens tema; en instans som vill ha **fasta** band, som SessionStudio, sätter hex.

⛔ Namnen börjar med `--color-` för att Tailwind ska göra dem till klasser (`bg-publik-ljus`). Kontraktet föreslog först `--publik-ljus`; utan `--color-` finns ingen klass.

Två färdiga brandfiler visar det: `examples/brand/sessionstudio.css` sätter exakt SessionStudios värden (`landingPalette.css`, `LandingFeatureBlock.jsx`), och `examples/brand/lifehub.css` Life Hubs (mörkt `#202420`, ljust `#f4f1ea`, taupe `#7d6b5d` ur loggan som accentband, guld `#c99a3e`). `check:brand` räknar kontrasten för varje text mot sin bakgrund i båda.

## Det publika skalet

Ramverket har ett helt skal för publika sidor, byggt efter SessionStudios landningssidor (`LandingShell`, `LandingNav`, `LandingHero`, `LandingFeatureBlock`, `LandingCtaBlock`, `LandingFooter`) men utan adresser, text och bilder. **Länkar, knappar, logga, bilder och alla ord kommer in som props.**

| Komponent | Vad | Props |
|---|---|---|
| `OpsPublikSkal` | ramen: toppraden, `<main id="main-content">`, sidfoten | `huvud`, `fot`, `children` |
| `OpsPublikHuvud` | toppraden: liten logga till vänster, länkarna efter den, språkval, Logga in och accentknappen till höger; under `md` en meny | `logga {alt, src` eller `paMork` och `paLjus, href?}`, `lankar`, `mobilLankar?`, `sprak?`, `loggaIn?`, `kom?`, `transparent?`, `ton?` (`mork` eller `ljus`), `texter` |
| `OpsPublikHjalte` | hjälten; med `bild` fotot i full bredd under en mörk toning | `title`, `eyebrow?`, `ingress?`, `malgrupp?`, `bild?`, `primar?`, `sekundar?`, `centrerad?` |
| `OpsPublikBlock` | ett innehållsblock med en ton och en bild bredvid | `ton` (`ljus`, `accent`, `mork`), `title`, `eyebrow?`, `children`, `handling?`, `bild?`, `figur?`, `bildSida?` |
| `OpsPublikUppmaning` | bandet i accentfärgen med rubrik, text och två knappar | `title`, `children?`, `primar`, `sekundar?` |
| `OpsPublikFot` | sidfoten: tagline, målgrupp, länkgrupper, copyright | `tagline`, `malgrupp?`, `grupper?`, `copyright`, `navEtikett`, `ar?` |
| `OpsPublikAvsnitt`, `OpsPublikText` | ett avsnitt på en innehållssida (behållare `max-w-[1080px]`) med rubrik och löptext | se README |

⛔ **Rytmen mellan blocken ägs av ramverket.** SS startsida lägger 96 px före varje ljust block och före uppmaningen (`HomePage.jsx:31`, `:47`) men staplar tonade block kant mot kant (`FeaturesPage.jsx:31`). Ramverkets CSS (i `ops-ramverk`-lagret, syskonväljare på `data-ops-publik` och `data-ton`) ger därför 96 px mellan två block i samma ljusa ton, efter fotohjälten före ett ljust block och före uppmaningen, och 0 mellan olika toner. Innehållssidans avsnitt staplas med 80 px (96 från `sm`), som `HowItWorksPage`. Ingen prop, ingen instans-CSS; `check:brand` mäter avstånden.

⛔ **Toppraden är en rad på en plats.** Samma höjd (56 px), samma bredd (`max-w-7xl`) och samma sidomarginaler på varje publik sida, och loggans höjd kommer ur `--publik-logga-hojd` och inte ur sidan under. CP: "Loggan flyttar sig mellan sidor" och "Kompositionen med loggan i mitten är inget snyggt." `check:brand` mäter `getBoundingClientRect` på loggan på startsidan och en kort innehållssida, i 1280 och 390 px och efter scroll, och är röd när toppraden läggs i en smal centrerad kolumn.

⛔ **Loggan är ett par.** En logga i en ruta försvinner mot en botten i sin egen färg, så instansen skickar två: `paMork` (för en mörk topprad) och `paLjus` (för en ljus), och toppraden väljer efter sin `ton`, inte efter ett fast värde. Skickas bara `src` används den på båda. Ramverket känner inga filnamn och levererar ingen logga.

⛔ **`texter` är obligatoriska.** Ramverket vet inte vilket språk en sida har och gissar inga ord: `texter.huvudnavigering`, `oppnaMeny`, `stangMeny` och `mobilmeny`, och `navEtikett` i sidfoten. Saknas de kastar komponenten.

⛔ **`figur`.** Life Hub har figurer och inga foton: en SVG eller ett diagram skickas som `figur` i stället för `bild` och ritas på en lätt panel i tonens färg.

## Egen CSS vinner utan `!important`

Ramverket ligger i **cascade-lager**. Före 0.94.0 låg en del av det olagrat, och då avgjorde väljarens specificitet: ramverkets mörkerblock (`:root:not([data-theme="light"])`, 0,2,0) slog en instans `:root { --color-accent }` (0,1,0) i mörkt läge hur sist den än laddades. Nu gäller att **en olagrad regel slår varje lagrad regel, oavsett specificitet**.

Lagerordningen, sist vinner (deklareras överst i `tokens.css`):

| Lager | Innehåll |
|---|---|
| `theme` | Tailwinds temavariabler: ramverkets ljusa värden och instansens `@theme` |
| `base` | element utan klass (`body`, `:focus-visible`, `.lucide`) och de publika rollernas storlekar per brytpunkt |
| `components` | ramverkets klasser (`.ops-grupp-vald`, `.ops-contrast-panel`, ...) |
| `utilities` | Tailwinds verktygsklasser (`bg-accent`, `text-etikett`) |
| `ops-ramverk` | mörkeraliasen, `--z-*`, säkra ytor och `.ops-sidoyta`: det som måste vinna över temat och inte går att uttrycka som en klass |
| *(olagrat)* | **instansens brandfil och egna CSS** |

Två saker följer:

- `h1 { letter-spacing: 0.02em }` i `egen.css` slår verktygsklassen `tracking-tight` på sidrubriken.
- `:root { --color-accent: #123456 }` i `egen.css` gäller i **både** ljust och mörkt läge och slår ramverkets mörkeralias. Vill instansen ha olika accent per läge sätter den `--color-accent` och `--dark-accent` i brandfilen, som exemplet.

Lägger instansen sin egen CSS i ett lager i stället för olagrat ska lagret deklareras **efter** `ops-ramverk`: `@layer theme, base, components, utilities, ops-ramverk, instans;`.

⛔ **Egen CSS är en nödutgång och ingen genväg.** Behövs samma regel i två instanser hör den hemma i ramverket (ärende i cllp/ops-framework). `check-token-overrides` följer stilrotens relativa importer, kontrollerar `brand.css` som variabelfil (bara kontraktets namn) och **räknar** reglerna i övriga importer, och skriver antalet i varje körning även när det är noll. Egen CSS som växer ska synas.

## Publika sidor: typografin

Publika sidor är presentationssidor och inte appvyer. De har egna roller (`typografi.publik` i `tokens/sessionstudio-profil.json`, mätta ur SessionStudios landningssidor) och en egen rubrikfamilj. Appens vyer rörs inte.

| Klass | Storlek (under `sm`, från `sm`, från `lg`) | Radhöjd | Vikt | Används till |
|---|---|---|---|---|
| `text-publik-rubrik` | 2,25 / 3 / 3,5 rem | 1,05 | 500, spärrning -0,01em | fotohjältens rubrik, sidans `<h1>` |
| `text-publik-sida` | 2,25 / 3 rem | 1,25 | 500, spärrning -0,01em | innehållssidans rubrik, `<h1>` (SS `HowItWorksPage`) |
| `text-publik-block` | 1,875 / 2,25 rem | 1,25 | 500, spärrning -0,01em | rubriken i ett innehållsblock, ett avsnitt och uppmaningen, `<h2>` |
| `text-publik-ingress` | 1,125 / 1,25 / 1,25 rem | 1,75 rem | 400 | ingressen under en rubrik |
| `text-publik-brod` | 1 / 1,125 / 1,125 rem | 1,625 | 400 | löptext |
| `text-publik-eyebrow` | 0,75 rem | 1 rem | 600 | överraden, spärrad 0,24 em, `uppercase text-accent` |
| `max-w-las` | 65ch | | | läsbredden för texten i ett block. Ett avsnitt på en innehållssida är `max-w-3xl`, som SS `HowItWorksPage` |

Rubrikerna skrivs `font-display-publik text-publik-rubrik`. En roll är **en** klass som växer vid brytpunkterna (`sm` 40 rem, `lg` 64 rem, som Tailwind), inte tre klasser som en komponent måste minnas att para ihop. Storlekarna bor på ett ställe, i profilen, och genereras till `tokens.css`.

Komponenterna `OpsPublikHjalte`, `OpsPublikAvsnitt` och `OpsPublikText` och klasserna i `PUBLIK_KLASS` bär rollerna. **En idé per block:** en överrad, en rubrik, en ingress och högst en handling.

## Vad en konsument behöver göra för 0.94.0

- **Inget** om appen bara importerar tokens: lagren är bakåtkompatibla för allt utom en regel i appens egen CSS som av en slump *förlorade* mot ramverkets mörkerblock och nu vinner. Den regeln gjorde inte det författaren avsåg.
- Vikterna har ändrats (se `CHANGELOG.md`, 0.94.0): `text-rubrik`, `text-titel` och `text-sida` är 600 och inte 700. Appar som lade `font-semibold` eller `font-bold` ovanpå dem ska ta bort det; `npm run check:typografi` mot appens `src` pekar ut raderna.
- En app som vill branda flyttar sina `@theme`-rader med färg och typsnitt till `brand.css` enligt exemplet.
