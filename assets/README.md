# Märken

PH.ST-märket i de två utföranden som faktiskt används.

| Fil | Bläck | Botten |
|---|---|---|
| `phst-light.png` | mörkt (#2b2b2b) | ljus |
| `phst-dark.png` | gräddvitt (#f6f4f1) | mörk |
| `phst-estd-light.png` | mörkt, med ESTD 1977 | ljus |
| `phst-estd-dark.png` | gräddvitt, med ESTD 1977 | mörk |

⛔ **`light` och `dark` beskriver BOTTNEN, inte bläcket.** `phst-light.png` är
alltså det mörka märket. Namnkonventionen är ärvd från originalfilerna och är
lätt att läsa baklänges, vilket redan hänt: SessionStudios publika sidfot lägger
`phst_logo_light_estd.png`, alltså mörkt bläck, på sin mörka botten.

## Var originalen kommer ifrån

`apps/web/public/phst_logo_{light,dark}_{estd,no_estd}.png` i
`cllp/sessions-platform`, 4000x4000 med generös transparent marginal.

Filerna här är beskurna till bläckets alfa-låda och nedskalade med boxfilter i
premultiplicerad alfa, till drygt 440 px höjd. Det tar dem från cirka 160 kB
till cirka 6 kB. En logotyp som visas 32 px hög ska inte ligga först i
laddningskön med 160 kB.

⛔ Redigera inte filerna här för hand. Ändras märket: byt originalen i
SessionStudio och kör om beskärningen, annars glider de isär.

## Använd dem aldrig direkt

De läses via tokens (`--logo-phst`, `--logo-phst-estd`), som byts av
temablocken i `tokens/tokens.css`. `OpsBrand` gör resten. En app som pekar på
en fil här har kringgått temaväxlingen, och märket blir osynligt i ett av
lägena.
