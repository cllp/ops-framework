---
name: css-and-components
description: Hur vi bygger utseende. Tokens som Tailwind-tema, primitiver med stängt API, och varför ingen av dem tar emot className. Ladda före varje ändring som rör hur något ser ut.
---

# CSS och komponenter

`tokens/tokens.css` ÄR Tailwind-temat. Primitiverna ger API:et. Ingen app skriver
egen CSS för något av det.

**Djupare referens:** [`TOKENS.md`](./TOKENS.md) (kontraktet och skälen),
[`COMPONENTS.md`](./COMPONENTS.md) (listor, kort, piller, vyer och spridningen
varje beslut svalde).

## När den används

Varje ändring som rör hur något ser ut. Ny vy, ny knapp, en färg, ett avstånd,
ett piller. Även "jag lägger bara till en marginal".

## Arbetsdelningen, och den är hela poängen

**Tailwind för layout. Primitiver för komponenter.**

Layout är per skärm och ska vara fri: `flex`, `grid`, `gap-4`, `md:grid-cols-2`.
Där hjälper ingen abstraktion, och en "layoutkomponent" för varje sidform blir
bara ett sämre CSS med fler namn.

Komponenter bär identitet och ska vara stängda: knapp, kort, fält, väljare,
piller, listrad, vyskal, modal, identitetsmärke. Där kostar varje avvikelse
något, för det är dem användaren känner igen som "produkten".

## ⛔ Det som skiljer ett ramverk från en rekommendation

**Primitiverna tar inte emot `className`.** Inte som prop, inte som spread, inte
"bara den här gången".

Rörig CSS orsakas inte av teknikvalet. Den orsakas av **kryphål**. Så fort en
komponent tar emot godtyckliga klasser lägger varje anropsställe på tre
utilities, och efter tre månader beskriver ramverket inte längre vad som
faktiskt renderas. Då är det en rekommendation, och rekommendationer förlorar
mot deadline varje gång.

Behöver du något som inte finns: **utöka primitiven**, lappa inte på
anropsstället. Vaktad av `scripts/check-closed-api.mjs` regel 1 och 2.

## Hur vi gör

- **Värden kommer ur tokens, alltid.** `text-ink-secondary`, aldrig en hex.
  Tailwinds egen palett finns inte: `--color-*: initial` i temat tar bort
  `bg-red-500` vid bygget. Det är inte en rekommendation som CI kontrollerar,
  det är en klass som slutar existera. Bevisat i `scripts/check-css-build.mjs`,
  inte påstått.
- **Godtyckliga färgvärden överlever ändå bygget.** `bg-[#abc123]` fungerar
  fortfarande, vilket också är mätt. Därför stoppas den i källkoden
  (`check-closed-api.mjs` regel 3), inte i temat.
- **Namn beskriver roll, aldrig färg.** Skälet är mätt: SessionStudio har 148
  tokens som heter `--color-gold-*` och som är varm grädde, samtidigt som repots
  toppregel säger att guld är permanent borttaget. Se `TOKENS.md` regel 1.
- **Aldrig fallback i `var()`.** `var(--z-modal, 400)` betyder att någon gissade,
  och två gissningar i olika komponenter blir en modal bakom en dropdown.
- **Varianter är en sluten mängd.** `variant`, `tone`, `size`. Ett okänt värde
  kastar med en läsbar text i stället för att rendera något godtyckligt. Behövs
  en femte variant är frågan först om en av de fyra var fel.
- **Formulärkontroller är designade, aldrig råa.** `OpsInput` vägrar
  `type="date"`. Webbläsarens egen väljare ser olika ut i varje webbläsare, går
  inte att tokenisera och kan inte översättas. Ett förbud utan ersättare är bara
  gnäll, så ramverket levererar `OpsSelect`, och en datumväljare är nästa steg.
- **Identitet bärs aldrig av en färgad prick.** `OpsIdentity` visar bild, ikon
  eller initialer med tonen som bakgrund. Tonen väljs ur ett **stabilt id**,
  aldrig ur namnet: härleds den ur namnet byter gruppen färg den dag någon
  rättar en stavning.
- **Aldrig interpolerade klassnamn.** `bg-identity-${n}` genererar ingen CSS.
  Tailwind läser källkoden som text. Skriv ut varianterna i en uppslagstabell.
- **Mörkt läge är tre tillstånd:** valt ljust, valt mörkt, inte valt. Mörkerpaletten
  deklareras en gång som `--dark-*`; blocken som aktiverar den får bara peka.

## Beteende är dyrare än utseende

Fokusfälla i modaler, tangentbordsnavigering i väljare, ARIA-kopplingar. Att
bygga det själv är veckor och att göra det fel är osynligt tills någon använder
tangentbord.

**Vi tar hjälp för beteendet och äger utseendet.** Radix ger dialog och väljare,
vi ger klasserna och tokens. Ramverket tar däremot inget ikonberoende: tre SVG:er
för sina egna behov, och appen väljer sin egen uppsättning (vi kör Lucide).

## Vakter

| Vakt | Vad den stoppar |
|---|---|
| `tokens/check-tokens.mjs` | färgord i namn, fallback i `var()`, `@theme inline`, mörkerblock som glidit isär, föräldralösa toner, tomt underlag |
| `scripts/check-closed-api.mjs` | `className` eller `...rest` på en primitiv, lappning på anropsstället, ad-hoc-färg |
| `scripts/check-css-build.mjs` | bygger CSS på riktigt och kontrollerar vad som kom ut |
| `scripts/test-guards.mjs` | bryter varje regel ovan och kräver rött |
| adoptionsräknaren | avvikelser per app som ett **tak som bara får sjunka** |

⛔ `test-guards.mjs` är inte en extra finess. **En vakt ingen sett faila är en
förhoppning.** Vi har haft vakter som var gröna i månader för att de läste fel
fil, jämförde en lista mot en kopia av sig själv, eller blev gröna av tom indata.
Alla tre såg ut precis som fungerande vakter.

⛔ Sätt aldrig adoptionstaket till noll direkt. Befintliga fall blir då röda utan
att någon lagar dem, och då stängs vakten av eller kringgås. Ett tak som sjunker
gör adoptionen synlig fil för fil.

## Vad som inte hör hemma här

Komponenter som kan sina data. En tidrapportrad, ett kvittokort. Gränsen går vid
frågan: **skulle den här komponenten betyda något i den andra plattformen?**
