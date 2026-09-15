# Tokenkontraktet

> Strukturen i `tokens/tokens.css` är kanon. Värdena är din profil.
> Vakten är `tokens/check-tokens.mjs`. Reglerna nedan är de den kontrollerar,
> plus tre den inte kan kontrollera och som därför är på ditt ansvar.

---

## Regel 1. Namnge efter roll, aldrig efter färg

`--color-state-error`, inte `--color-red`. `--color-accent-subtle`, inte
`--color-gold-overlay-light`.

**Skälet är mätt, inte principiellt.** SessionStudio har **148 tokens** som heter
`--color-gold-*` och som är satta till `rgba(232,224,208,...)`, alltså varm
grädde. Samtidigt säger repots toppregel att guld är **permanent borttaget**, och
den förbjudna hexen finns noll gånger. Färgen är alltså rätt. Namnen ljuger.

Följden är inte kosmetisk: en ny utvecklare eller agent som läser tokenlistan
drar slutsatsen att guld lever, och den slutsatsen är omöjlig att motbevisa utan
att slå upp värdena en och en.

En roll överlever en omfärgning. En färg gör det inte.

## Regel 2. Ingen fallback i `var()`

`var(--z-modal)`, aldrig `var(--z-modal, 400)`.

En fallback gör ett saknat token **osynligt**. Sidan ser rimlig ut, ingenting
larmar, och kontraktet är brutet utan att någon får veta. Det är samma felform
som en `try/catch` som tystar: problemet finns kvar, bara utan spår.

Saknas ett token ska det synas.

## Regel 3. De två mörka blocken måste vara identiska

Mörkt läge har tre tillstånd: användaren har valt ljust, valt mörkt, eller inte
valt. Systemvalet hanteras av `@media (prefers-color-scheme: dark)` med
`:root:not([data-theme="light"])`, det explicita valet av
`:root[data-theme="dark"]`.

De två blocken deklarerar samma tokens och **måste** ha samma värden.

**⛔ Den här vakten skrevs för att författaren bröt regeln i samma timme som
filen skapades.** De två blocken fick olika värde på `--color-state-error-bg`.
Två handskrivna original glider isär, alltid, och ett mörkt läge som ser olika ut
beroende på *hur* du valde det är nästan omöjligt att felsöka: buggen försvinner
så fort någon ändrar sin systeminställning.

Definiera aldrig en färg enbart inuti ett media- eller attributblock. Då saknar
den sitt grundvärde, och ljust läge blir det som råkar ärvas.

## Regel 4. Vakten har ett golv

`check-tokens.mjs` blir röd om den läser färre än 40 tokens. En vakt som blir
grön av att ingenting lästes är den vanligaste falska grönheten vi har haft, och
den ser exakt ut som framgång.

---

## Tre regler vakten inte kan kontrollera

**En hex i en komponent är ett fel.** Vakten läser tokenfilen, inte appen. Den
regeln upprätthålls av konsumentens ESLint-konfig, som förbjuder hex-literaler i
JSX och CSS-i-JS. Utan den raden är tokenlagret en rekommendation.

**En skala växer inte utan skäl.** Tre skuggor, fem radier, tre varaktigheter.
Behöver du en fjärde skugga: fråga först om den befintliga var fel. Skalor som
växer fritt slutar vara skalor och blir en lista över tillfällen.

**En accent, inte två.** Två accentfärger blir aldrig två. De blir fem, för varje
gång någon behöver något "mittemellan".

---

## Grupperna, och varför de är just dessa

| Grupp | Vad den svarar på |
|---|---|
| `bg-*` | vilken yta står detta på |
| `text-*` | fyra nivåer. En femte blir alltid "ungefär som muted" |
| `border-*`, `divider` | var slutar en yta |
| `accent-*` | vad är produktens hand |
| `state-*` | vad betyder det här för användaren |
| `radius-*` | hur mjuk är formen |
| `shadow-*` | hur högt ligger den |
| `font-*`, `line-*`, `letter-*` | hur läses texten |
| `transition-*` | hur snabbt sker det |
| `z-*` | vad ligger över vad |
| `safe-*` | var får innehåll inte hamna |

**Lägg aldrig till en grupp i en app.** Lägg den här först, annars är kontraktet
bara en rekommendation och de två plattformarna börjar glida isär i tysthet.

---

## Så konsumerar en app kontraktet

```js
// app/src/index.css
@import "@staiger/ops-framework/tokens/tokens.css";

// därefter, i samma fil, appens egna värden:
:root { --color-accent: #2f5d8a; }
:root[data-theme="dark"] { --color-accent: #7fb0d9; }
```

Appen skriver alltså **om värden**, aldrig om struktur. Behöver den ett token som
inte finns är svaret att lägga till det i ramverket, inte att hitta på ett lokalt.

I CI, som en del av appens egen grind:

```
node node_modules/@staiger/ops-framework/tokens/check-tokens.mjs src/index.css
```
