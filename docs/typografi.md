# Typografi: ett ställe, tre lager

lifehub.app#165 (CP 2026-10-10). Beslut: 1a, 2a+c, 3a, 4a, 5b, 6b, 7a.
Identity migreras i ett senare pass (6b).

## Var man ändrar vad

| Vad | Fil | Vem |
|---|---|---|
| Familj (`--font-sans`, `--font-marke`, `--font-display`) | `tokens/tokens.css` (handskrivet) + `tokens/sessionstudio-profil.json` för roller | Bara ramverket. Hubb brandar **inte** typsnitt (beslut 4a). |
| Storlek, vikt, radhöjd, spärrning per roll | `tokens/sessionstudio-profil.json` → `typografi.roller` | Bara ramverket. Kör `npm run generate:tokens`. |
| Semantiska klasser i UI | `text-mikro` … `text-sida` | Komponenter, appar, moduler: bara rollerna. Aldrig `text-[12px]`, `text-sm`, `font-size:`. |
| Fältets storlek | `faltKlass` i `src/lib/radKlass.js` | `text-brod` under `md` (16 px, iOS), `md:text-etikett` (14 px) från desktop (beslut 2a+c). |
| Märkesstorlekar | `--marke-*` i tokens | Bara `OpsBrand`. Glacial Indifference bara via `--font-marke` (beslut 1a). |

Nya storlekar = ny rad i `typografi.roller` + `generate:tokens`, aldrig en lokal klass.

## Lagren (samma modell som ops-framework#325)

```
3. Gruppton     → accent (och ev. tunn header-ton). ALDRIG typsnitt, ALDRIG textstorlek.
2. Hubbens brand → färger, logga. Inte typsnitt (beslut 4a). Logga också i appens hubbväljare när hubbtema byggs (5b, eget pass).
1. Ramverkets grund → --font-sans, roller, viktpolicy, basregler, vakter.
```

Grundfärger med betydelse (fel, inkomst/kostnad, kalender) rörs aldrig av hubb eller grupp.

## Viktpolicy (beslut 3a)

Tre synliga vikter i vanlig UI: **400 / 500 / 600**.
**700** bara på `text-mikro`, `text-raknare` och verkliga sid-/kortrubriker (`text-sida`, `text-titel`).

Rollens inbyggda vikt är sanningen. Lägg aldrig `font-bold` eller `font-semibold`
ovanpå en roll som redan är >= 600. Emfas på listtext: `text-etikett` + `font-medium`.

Vakten `check-typografi` fäller dubbel vikt.

## Vad app och modul får

| Får | Får inte |
|---|---|
| Ramverkets primitiver och `text-*`-roller | Egen `font-family`, `font-size`, `text-[Npx]`, `text-xs/sm/…` |
| `font-medium` på etikett/bröd/meta för emfas | `font-bold` / bare `font-semibold` utan storleksroll |
| Hubbtema: färg + logga (när det byggs) | Egen typografiskala per hubb eller grupp |

## Arkitekturverifiering: ett byte slår igenom

Prov 2026-10-10 på grenen `typo-165`:

1. Ändra `typografi.roller.etikett.storlek` i `tokens/sessionstudio-profil.json`
   (tillfälligt, t.ex. `0.875rem` → `1rem`).
2. Kör `npm run generate:tokens`.
3. Bygg ramverket och lifehub.app mot den lokala grenen.
4. Öppna `/stil` och Ekonomi: varje `text-etikett` (listtitlar, fält från `md`)
   växer tillsammans. Menyer på `text-meta` / `text-liten` står kvar.
5. Återställ värdet och kör `generate:tokens` igen.

Samma kedja gäller familj: byt `--font-sans` i `tokens.css` på ett ställe, ladda
om, hela UI byter familj. Märket (`OpsBrand`) står kvar på `--font-marke`.

Beviset är att det **inte** finns en andra sanning i appen eller i en modul:
`lifehub.app/web/src/index.css` importerar bara ramverkets tokens, och
`check-typografi` / `check-vytypografi` faller rött på en literal.

## Exempelsida

lifehub.app: route `/stil` visar alla roller, vikter, listor, menyer, fält och
knappar mot samma tokens. `/primitiver` är den bredare katalogen över komponenter.
