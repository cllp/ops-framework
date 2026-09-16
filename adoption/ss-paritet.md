# SessionStudio-paritet: vad ramverket redan gör åt dig (v0.3.0)

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

Det som i SessionStudio är `MoreSettingsDisclosure`. Rubrik med chevron som
roterar, innehåll som växer i höjd.

```jsx
<OpsDisclosure label="Mer inställningar" storageKey="kostnad-mer" badge={2}>
  …fälten som inte behövs varje gång…
</OpsDisclosure>
```

- `storageKey` minns öppet eller stängt per webbläsare. Utelämnad minns den inget.
- `badge` visas bara när den är över noll, som "Mer inställningar (2)".
- `divider` ritar en linje ovanför rubriken. Av som standard, eftersom ett kort
  redan har en kant.

⛔ **Hopfälld panel tas ur tabbordningen med `inert`.** Det är den bugg mönstret
annars bär: noll höjd med `overflow: hidden` betyder inte borttagen ur DOM:en, så
den som tabbar sig genom sidan försvinner in i osynliga fält och ser bara att Tab
verkar sluta fungera. `aria-hidden` löser det inte, det gör saken värre: dolt för
skärmläsaren men fortfarande fokuserbart.

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
toaster, och rubriken i `OpsDisclosure`.

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
