# Typografi: ett ställe, tre lager

lifehub.app#165 (CP 2026-10-10). Beslut 1a, 2a+c, 3a, 4a, 5b, 6b och 7a. **Ändrat av CP 2026-10-12:** beslut 4a ("ingen hubb brandar typsnitt") är ändrat, beslut 6b ("Identity inte nu") är hävt, och publika sidor har egen typografi. Se `docs/brand.md`.

## Var man ändrar vad

| Vad | Fil | Vem |
|---|---|---|
| Brödtextens familj, `--font-sans` | `tokens/tokens.css` (handskrivet) | Bara ramverket. Inte en brandvariabel. |
| Rubrikfamiljerna `--font-display`, `--font-display-publik` och märkets `--font-marke` | `tokens/tokens.css`; en instans skriver över dem i sin brandfil | Ramverket (förval) och instansen (brandfil) |
| Storlek, vikt, radhöjd och spärrning per roll, appens och de publika | `tokens/sessionstudio-profil.json`, `typografi.roller` och `typografi.publik` | Bara ramverket. Kör `npm run generate:tokens`. |
| Semantiska klasser i UI | `text-mikro` ... `text-sida`, `text-publik-*` | Komponenter, appar, moduler: bara rollerna. Aldrig `text-[12px]`, `text-sm` eller `font-size:`. |
| Fältets storlek | `faltKlass` i `src/lib/radKlass.js` | `text-brod` (16 px, iOS) och `md:pointer-fine:text-etikett` (14 px) från `md` med en exakt pekare |
| Märkets storlekar | `--marke-*` i tokens | `OpsBrand`. Glacial Indifference bara via `--font-marke` (beslut 1a) |

Nya storlekar är en ny rad i profilen och `generate:tokens`, aldrig en lokal klass.

## Lagren (ops-framework#325, typografi)

```
3. Gruppton        accent. Aldrig typsnitt, aldrig textstorlek.
2. Instansens brand  färger, toner, logga och rubrik- och märkesfamilj (brandfilen, docs/brand.md).
1. Ramverkets grund  --font-sans, rollerna, viktpolicyn, basreglerna och vakterna.
```

Grundfärger med betydelse (fel, inkomst och kostnad, kalender) rörs aldrig av en instans eller grupp.

## Viktpolicy (beslut 3a)

Tre vikter i vanlig yta: **400, 500 och 600**. **700 bara på räknemärkets siffror** (`text-mikro`, `text-raknare`).

| Roll | Vikt |
|---|---|
| `brod`, `etikett`, `meta`, `hjalp` | 400 |
| `liten` | 500 |
| `rubrik`, `titel`, `sida`, `sektion` | 600 |
| `mikro`, `raknare` | 700 |
| `text-publik-rubrik`, `-avsnitt`, `-block` | 500 (serif) |
| `text-publik-eyebrow` | 600 |

Rollens vikt är sanningen. `check-typografi` fäller `font-bold`, och en vikt som rollen i samma klasssträng redan bär (`text-rubrik font-semibold`). Emfas på en 400-roll är `font-medium`. En sänkning under rollens vikt (`text-mikro font-semibold`) är tillåten. En vikt är dubbel bara om den är lika med vikten hos VARJE roll som gäller på elementet, basrollen och de responsiva (`sm:text-hjalp`): `text-liten font-medium sm:text-hjalp` är inte dubbel, för `font-medium` håller 500 från `sm` där `text-hjalp` är 400 (Tailwind låter en uttrycklig vikt gå före rollens på alla bredder). `text-liten font-medium` är dubbel. `text-liten sm:font-medium` är en vikt bara på brytpunkten och inte dubbel.

⛔ **`text-sida` är 600 och inte 700.** Beslut 3a lät 700 stå kvar för sidrubriker, men SS sidrubrik är `font-semibold` (`GroupDetailView.jsx:95`) och 0.90.1 (lifehub.app#146) kom till eftersom 700 på den storleken såg ut som fel typsnitt. Rollen stod på 700 och `SIDRUBRIK_KLASS` lade `font-semibold` ovanpå; nu är vikten rollens och ingen klass korrigerar den.

## Arkitekturverifiering: ett byte slår igenom

1. Ändra `typografi.roller.etikett.storlek` i profilen (tillfälligt, `0.875rem` till `1rem`).
2. Kör `npm run generate:tokens`.
3. Varje `text-etikett` i ramverket och i en app som pekar på den lokala grenen växer tillsammans; menyer på `text-meta` och `text-liten` står kvar.
4. Återställ och kör `generate:tokens` igen.

Samma kedja gäller familj: byt `--font-display` i brandfilen och alla rubriker byter familj, utan att en komponent rörs (`npm run check:brand` mäter det).
