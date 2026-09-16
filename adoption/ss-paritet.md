# SessionStudio-paritet: vad ramverket redan gör åt dig (v0.4.0)

Målet är att appar byggda på ramverket ska kännas som SessionStudio utan att
varje app bygger känslan själv. Det mesta av det är **default**, alltså något du
får utan att göra något. Det här dokumentet säger vad som är gjort, vad du ändå
måste skicka in, och vad som med flit inte finns.

⛔ **Läs "redan gjort" innan du bygger något.** Fyra av de fem delarna nedan var
redan på plats när epiken skrevs, och den dyraste sortens arbete är att bygga om
något som fungerar för att ingen kontrollerade först.

---

## 1. Ikoner: gjort, och utan beroende

Ramverket ritar de ikoner primitiverna själva behöver som inlagd SVG i
`src/components/icons.jsx`: chevron, kryss, meny och bock. De är ritade med
**Lucides** streckform (2 px stroke, runda ändar, 24-rutnät), alltså samma
ikonspråk som SessionStudio.

⛔ Ramverket tar medvetet **inget ikonberoende**. Fyra SVG:er är billigare än att
tvinga varje app som installerar paketet att dra in ett helt ikonbibliotek den
inte bad om.

**Appen väljer själv sitt ikonpaket** och skickar in ikoner där ramverket tar
emot dem, framför allt `nav[].icon` till skalet. Kör Lucide, så matchar de
inbyggda.

## 2. Fäll ut och fäll ihop: `OpsDisclosure`

Hopfällbart kort: en alltid synlig rubrik som fäller ut sitt innehåll.

```jsx
<OpsDisclosure summary={<PolicyRubrik namn="Sjukförsäkring" belopp="1 000 kr/mån" />} storageKey="forsakring-p1" badge={2}>
  …detaljerna…
</OpsDisclosure>
```

- `summary` är vad som helst: en rubrik med etiketter och ett belopp till höger, inte bara text.
- `open` + `onOpenChange` ger appen kontrollen när den vill äga läget.
- `storageKey` minns öppet eller stängt per webbläsare, i ostyrt läge.
- `badge` visas bara när den är över noll.

⛔ **Byggd på native `<details>`/`<summary>`, inte på en egen knapp med state.**
En hopfällning gjord av `<div onClick>` tappar tangentbord, fokusordning och
skärmläsarens expanderat-läge, och någon måste återuppfinna dem, oftast fel.

Det betyder också att hopfälld panel **aldrig** går att tabba in i. En
handskriven variant med noll höjd och `overflow: hidden` har kvar innehållet i
tabbordningen, och den som tabbar ser fokusringen lämna skärmen medan Tab verkar
sluta fungera. Plattformen har inte det problemet.

Priset är att höjden inte går att animera. Medvetet byte: en utfällning som
hoppar fram är en kosmetisk brist, en hopfällning man kan tabba in i är en
trasig sida.

## 3. Temaväxlaren: gjort, inkl. ingen ljus blinkning

`OpsThemeToggle` ligger i mallens `actions`-plats i skalet, alltså uppe till
höger, och är därmed default i varje ny app. Den har **tre** lägen: ljust, mörkt
och följ systemet.

⛔ Aldrig en boolean. Med två lägen försvinner "följ systemet", och den som aldrig
valt något fastnar i ljust läge med telefonen i mörkt. Det ser ut som att
inställningen är trasig.

Blinkningen är redan löst, på det enda ställe den går att lösa: ett litet skript
i `index.html` skriver `data-theme` **innan** React monterar. Görs det i en effekt
hinner sidan rendera ljust i en bildruta, och det syns tydligt på en telefon i ett
mörkt rum.

## 4. Färger: appen sätter sin accent, resten kommer med

Basen är ramverkets tokenkontrakt. En app sätter sin egen accent och sina egna
identitetstoner i sin stilrot; allt annat, ytor, kanter, text, status, ärvs.

⛔ Ingen app skriver en egen färg i en komponent. `check-closed-api` och
`check-token-overrides` blir röda på det. Skälet är att en ad-hoc-färg saknar
motsvarighet i mörkt läge, och felet upptäcks av en användare, inte av oss.

## 5. Mobil: 44 px och en mätning i stället för ett löfte

**Träffytan är 44 px under `md`, och det är raden, inte symbolen.** En kryssruta
är 20 px och ett reglage 24; klickytan är hela `<label>`, med höjdgolv på telefon
och utan golv från `md`, så ett formulär med tio kryssrutor inte blir en halv
skärm luft på skrivbordet. Samma uppdelning gäller stängknappar i banderoller och
toaster, och rubrikraden i `OpsDisclosure`.

**Layouten mäts i Chromium vid 390 och 768 px** av `check-scaffold`, på en app som
faktiskt är byggd och serverad. Den kontrollerar att sidan inte är bredare än
fönstret, att exakt en navigering syns per bredd, och att `main` har botteninset
minst lika stort som bottenraden.

⛔ Det är den enda plats i huset där CSS körs. Alla andra tester lever i jsdom,
som inte har någon layoutmotor och därför inte kan se skillnad på `hidden md:flex`
och ingenting alls. Ett löfte om mobilanpassning utan en layoutmotor är precis den
sortens regel som ser ut som ett skydd utan att vara det.

---

## Vad appen fortfarande äger

- **Vilka destinationer navigeringen har**, och i vilken ordning. Ramverket ska
  aldrig veta vilka sidor en plattform består av.
- **Ikonpaketet** och vilken ikon varje destination får.
- **Accentfärgen** och identitetstonerna.
- **Innehållet.** Ramverket levererar inga siffror, inga rubriker och inga texter
  som hör till en verksamhet.

## Vad som med flit inte finns

- **Desktop-menyer för `children`.** Toppraden på `md+` markerar ett avsnitt när
  en av dess undersidor är aktiv, men listar inte undersidorna i en utfällbar
  meny. Bottenradens sheet gör det. Behövs det på skrivbord är det ett eget
  beslut, inte en glömska.
- **Pixeljämförelse av skärmbilder.** Den blir röd av varje typsnittsuppdatering
  och varje avsiktlig designändring, alltså varje vecka, och en vakt som är röd
  varje vecka stängs av inom en månad. Vi mäter påståenden i stället.

---

## 6. Tillförlitlighet: `OpsFact` (från v0.4.0)

Ramverket kunde säga **vem** som skrev en siffra (`OpsProvenance`). Det kunde
inte säga **hur sann** den är. Det är en annan fråga: en agent kan skriva ett
uppmätt tal och en människa kan gissa.

```jsx
<OpsFact kind="uppmatt" />
<OpsFact kind="uppskattat" label="Snitt 12 mån" />
<OpsFact kind="okant" />
<OpsFact kind="scenario" value="5 290 000 kr" label="Vid 3 % avkastning" />
```

⛔ **`okant` kan inte bära ett värde.** Komponenten kastar. Skälet är att
"0 kr" och "vi vet inte" är motsatser som ser likadana ut på skärmen, och ett
märke som samtidigt säger okänt och visar ett belopp gör saken värre: nu står
det uttryckligen att vi inte vet, bredvid en siffra som ser mätt ut.

⛔ **Märk där blandningen sker, inte överallt.** Är allt märkt är inget märkt.
Är en hel tabell uppmätt hör märket på tabellen, en gång, inte på varje rad.
`uppmatt` har därför den tystaste tonen: den är normalfallet.

Förlagan är `/marknad` på sessionstudio.se, där varje påstående bär **i drift**,
**byggs nu** eller **förslag**. Det som gör den sidan trovärdig är inte texten
utan att lägena går att se utan att läsa.

## 7. Nyckeltal med väg vidare (från v0.4.0)

`OpsStat` var en ruta man inte kunde göra något med. Nu:

```jsx
<OpsStat
  label="Kostnader"
  value={formatCurrency(67650)}
  fact="uppmatt"
  source="Bokföringen"
  updatedAt="2026-09-15T09:00:00Z"
  onDrillDown={() => navigera("/kostnader")}
  drillDownLabel="Kostnader: visa de rader som ingår"
/>
```

- `source` och `updatedAt` besvarar samma fråga, "kan jag lita på det här", och
  står därför på samma rad i samma ton. ⛔ **En siffra utan ålder läses som
  färsk**, alltid.
- `onDrillDown` gör rutan till en riktig knapp. ⛔ Utan propen renderas **ingen**
  knapp och inget fokusbart element: en klickbar yta som inte leder någonstans
  är värre än en död ruta, för användaren trycker igen och tror att appen hängt
  sig.
- `updatedAt` visas i ord (`formatRelativeDate`, räknat i kalenderdagar) med
  exakt tid kvar i `title`. Åldern i ord är det man vill veta i förbifarten;
  datumet är det man vill veta i det ögonblick man börjar misstro talet.

## 8. Mät appens egna sidor, inte bara mallens

```bash
npx ops-viewport dist --rutter /,/kostnader,/tillgangar,/schema
```

Ligger redan i mallens `check` och `gate` med bara `/` i listan. ⛔ **Fyll på
den.** Mäts bara startsidan är grinden grön för en sida av tio, och det är exakt
så horisontell scroll hann ligga kvar i en app tills någon klickade igenom den
för hand.

`playwright` är en valfri peer. Webbläsaren hämtas en gång per maskin med
`npx playwright install chromium`, eller pekas ut med `OPS_CHROMIUM`.
