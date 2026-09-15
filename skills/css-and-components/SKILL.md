---
name: css-and-components
description: Hur vi bygger utseende. Tokens, namngivna klasser, primitiver med stängt API, och varför ingen av dem tar emot className. Ladda före varje ändring som rör hur något ser ut.
---

# CSS och komponenter

Tokens ger värdena, `css/ops.css` ger klasserna, primitiverna ger API:et. Ingen
app skriver egen CSS för något av det.

**Djupare referens:** [`TOKENS.md`](./TOKENS.md) (kontraktet och skälen),
[`COMPONENTS.md`](./COMPONENTS.md) (listor, kort, piller, vyer och spridningen
varje beslut svalde).

## När den används

Varje ändring som rör hur något ser ut. Ny vy, ny knapp, en färg, ett avstånd,
ett piller. Även "jag lägger bara till en marginal".

## ⛔ Det som gör skillnad mellan ett ramverk och en rekommendation

**Primitiverna tar inte emot `className`.** Inte som prop, inte som spread, inte
"bara den här gången".

Skälet är att rörig CSS inte orsakas av teknikvalet. Den orsakas av **kryphål**.
Så fort en komponent tar emot godtyckliga klasser lägger varje anropsställe på
tre utilities, och efter tre månader beskriver ramverket inte längre vad som
faktiskt renderas. Då är det en rekommendation, och rekommendationer förlorar mot
deadline varje gång.

Behöver du något som inte finns: **utöka ramverket**, lappa inte på
anropsstället. Det är den enda regeln som håller ihop resten, och den är vaktad
(`css/check-closed-api.mjs`).

## Hur vi gör

- **Värden kommer ur tokens, alltid.** `var(--color-text-secondary)`, aldrig en
  hex, aldrig `#fff`. Regeln har ett mätt skäl: SessionStudio har 148 tokens som
  heter `--color-gold-*` och som är varm grädde. Namn som beskriver färg i
  stället för roll ljuger så fort någon byter färg. Se `TOKENS.md` regel 1.
- **Aldrig fallback i `var()`.** `var(--z-modal, 400)` betyder att någon gissade,
  och två gissningar i olika komponenter blir en modal bakom en dropdown.
- **Klasser är namngivna och prefixade:** `ops-btn`, `ops-btn--primary`,
  `ops-card`, `ops-field`. Ren CSS, inget byggberoende. Ramverket tvingar inte
  på konsumenten en verktygskedja, och SessionStudio kan adoptera utan att
  skriva om sin Tailwind.
- **Varianter är en sluten mängd.** `variant="primary" | "secondary" | "ghost"`,
  `tone="neutral" | "success" | "warning" | "error"`, `size="sm" | "md"`. Behövs
  en femte variant är frågan först om en av de fyra var fel.
- **Avstånd kommer ur rytmskalan**, inte ur fria pixlar. Layout som spretar
  spretar nästan alltid i avstånd, inte i färg.
- **Formulärkontroller är designade, aldrig råa.** Ingen `<select>`, ingen
  `<input type="date">`. De ser olika ut i varje webbläsare och går inte att
  tokenisera. Förbudet är meningslöst utan ersättaren, så ramverket levererar
  dropdown och datumväljare.
- **Identitet får aldrig bäras av en färgad prick.** Ikon, initialer eller bild i
  egen färgram. En prick är oläsbar för den som inte redan vet vad den betyder,
  och den går inte att förklara för en skärmläsare.
- **Mörkt läge är tre tillstånd:** valt ljust, valt mörkt, inte valt. Definiera
  aldrig en färg enbart i ett media- eller attributblock, då saknar den sitt
  grundvärde.

## Beteende är dyrare än utseende

Fokusfälla i modaler, tangentbordsnavigering i dropdowns, ARIA-kopplingar. Att
bygga det själv är veckor och att göra det fel är osynligt tills någon använder
tangentbord.

**Vi tar hjälp för beteendet och äger utseendet.** Ett headless-bibliotek ger
dropdown och dialog, vi ger klasserna och tokens. Resten skriver vi själva.

## Vakter

| Vakt | Vad den stoppar |
|---|---|
| `tokens/check-tokens.mjs` | färgord i tokennamn, fallback i `var()`, mörka block som glidit isär, tomt underlag |
| `css/check-closed-api.mjs` | `className` som når en primitiv |
| konsumentens ESLint | hex i JSX, rå `<select>`, egna radier |
| adoptionsräknaren | avvikelser per app som ett **tak som bara får sjunka** |

⛔ Sätt aldrig adoptionstaket till noll direkt. Befintliga fall blir då röda utan
att någon lagar dem, och då stängs vakten av eller kringgås. Ett tak som sjunker
gör adoptionen synlig fil för fil.

## Vad som inte hör hemma här

Komponenter som kan sina data. En tidrapportrad, ett kvittokort. Gränsen går vid
frågan: **skulle den här komponenten betyda något i den andra plattformen?**
