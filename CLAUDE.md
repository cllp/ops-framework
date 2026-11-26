# ops-framework

<!-- wayofworking:borjan -->
> ⛔ **Alla agenter läser alltid https://github.com/cllp/wayofworking innan de börjar**, i varje session och i varje repo: samarbetet med
> CP, arbetsreglerna, hur vi ritar och, där vi bygger kod, utvecklingen. Startkroken i `.claude/settings.json` lägger in dem av sig själv.
> Saknas de, läs dem där innan du gör något. Det som står nedan gäller bara det här repot, och efter dem.
<!-- wayofworking:slut -->

## ⛔ ARBETSREGLERNA STÅR I WAYOFWORKING, OCH INTE LÄNGRE HÄR

CP 2026-11-26: "JA JAG VILL HA EN KÄLLA" och "Bygg nu så att alla andra repon läser way of working istället för att det skall dubliceras".
Här stod till 2026-11-26 ramverkets kanon: metaregeln, visionen, samarbetet S1 till S11 och arbetsreglerna 1 till 15, och `bolag-ops`,
`lifehub.app` och `tam` bar en genererad kopia av dem med en vakt. Samma natt mättes att 24 av 27 repon inte bar reglerna alls, eftersom
kanonen bara nådde de repon som råkade konsumera ramverket. Nu har reglerna ett hem för alla repon:

| Vad | Var |
|---|---|
| Samarbetet med CP, S1 till S11, och metaregeln | https://github.com/cllp/wayofworking/blob/main/samarbete.md |
| Arbetsreglerna 1 till 15 | https://github.com/cllp/wayofworking/blob/main/arbetsregler.md |
| Hur vi ritar | https://github.com/cllp/wayofworking/blob/main/rita.md |
| Visionen, och utvecklingen: tavlan, Dev, MERGA NU, rollerna, deploy | https://github.com/cllp/wayofworking/blob/main/utveckling.md |

⛔ **Skriv ingen regel här.** En regel ändras i wayofworking, i en PR, med CP. Kopiorna i konsumenterna och deras vakter (`check-kanon`)
togs bort samma natt (bolag-ops PR 655, TAM PR 115 och lifehub.app).

En kommentar i koden som hänvisar till "regel 2 i CLAUDE.md" eller liknande avser numret i `arbetsregler.md`, som är oförändrat.

Det som står kvar nedan gäller bara ramverket: var gränsen går mellan ramverkets data och appens.

---

## Vad som inte är regler här

> ⛔ **Det här avsnittet sade förut att datamodellen och auktorisationsmodellen
> inte hör till ramverket alls. Det är inte längre sant, och en regel som inte
> längre är sann ska ändras och inte kringgås** (metaregeln överst).
>
> **Händelsen:** CP 2026-09-25 i cllp/bolag-ops#359. Ramverket ska leverera hela
> ytan färdig, inklusive en inbyggd inställningsvy där kategorier, typer och
> status läggs till med färg och ikon, och en identitet som säger vem som skapade
> varje post. Konfigurationen, medlemmarna och ändringsloggen blir då ramverkets
> egen data, och data utan regler är data vem som helst får skriva. Epiken står i
> cllp/ops-framework#92.
>
> ⛔ **Skälet till att raden stod här överlever ändå, och det är därför det står
> kvar nedan i sin nya form:** ramverket ska inte veta vad `tam`:s kundmaterial
> är, och `tam` ska kunna köras helt utan Firebase. Det som ändrats är gränsen,
> inte principen.

**Appens domändata.** `bolag-ops` går mot Firebase, `tam` är ett korpus där repot
är datan. Ett ramverk som bestämmer var APPENS data bor passar den ena och
tvingar den andra.

⛔ **Sina egna samlingar äger ramverket däremot helt:** konfiguration, medlemmar,
ändringslogg och aktivitet, med sin datamodell och sina Firestore-regler. En
inställningsvy som skriver in en ny kategori skriver in den någonstans, och det
"någonstans" kan inte vara olika i varje app om vyn ska vara ramverkets.

⛔ **Ramverket känner aldrig projekt-id eller samlingsnamn.** Appen skickar in
dem. Det är den raden som gör att en kund senare kan bli ett eget
Firebase-projekt utan att datamodellen ändras, och den är billig nu och dyr sedan.

**Vem som får läsa appens data.** `tam` bär kundmaterial, och att eftermontera
behörigheter är den dyraste sortens ombyggnad. Ramverket ger inloggningsskalet,
route-vakten, medlemsregistret och reglerna för sina egna samlingar. Vad en viss
roll får se i APPENS samlingar är appens beslut.

**Firebase är en egen ingång.** Kärnan ska gå att använda utan den. `tam` har
inget Firebase och ska inte tvingas ha det för att kunna använda en knapp.

**Utgivningsdisciplin per app.** Versionsnummer, changelog-form och deploy-fönster
är per plattform.
