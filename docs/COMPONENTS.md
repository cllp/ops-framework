# Komponentkontraktet: listor, kort, piller, vyer

> Det här är svaret på frågan "kan vi få med alla CSS-ramar för listor, pills,
> boxar och vyer". Svaret är ja, men **inte som CSS**, och skälet är värt att
> läsa innan du bygger något.

---

## Varför det inte finns någon stilmall att kopiera

Mätt i SessionStudio: hela `index.css` är 1450 rader och innehåller **13 egna
klasser** och 45 `@apply`. Ett klassbibliotek finns alltså inte. Det som gör
utseendet enhetligt är tre andra saker:

1. **Tokenlagret** (`docs/TOKENS.md`).
2. **En handfull kanoniska komponenter**, där var och en har svalt en spridning.
3. **Vakter** som stoppar ny spridning.

Kopierar du CSS får du en ögonblicksbild som ruttnar. Det som ska med är
**beslutet och spridningen det svalde**, för utan spridningen är beslutet bara en
preferens som nästa person gärna avviker från.

---

## Listor: EN komponent med tröskel, aldrig virtualisering per yta

**Beslutet:** en listkomponent. Under en tröskel renderas raderna som vanlig DOM
med naturlig höjd. Över tröskeln virtualiseras de.

**Spridningen den svalde, uppmätt i en audit:** sex listytor med **tre** olika
trösklar och **fem** olika radhöjdsberäkningar. Två buggar kom direkt ur den
spridningen: klippta kort, stora tomrum och döda klick, alla orsakade av fasta
platshöjder mot innehåll som varierar.

**Reglerna som följer, och de är inte valfria:**

- Under tröskeln finns **ingen** höjdheuristik. Det är hela poängen: naturlig
  höjd kan inte klippa.
- Över tröskeln är radhöjden ett **slot**, inte en mätning. Innehållet måste
  rymmas, eller så måste höjdfunktionen spegla radens faktiska läge.
- **Höjdstyrande state kräver remount.** Expanderar en rad och ändrar höjd måste
  listan få en ny `key`, annars behåller den sin gamla höjdkarta och du får
  klippta rader och klick som landar fel. Det här är den enskilt dyraste
  listbuggen vi har haft, och den ser inte ut som en listbugg.

## Kort och boxar: ETT omslag

**Beslutet:** en `SurfaceCard`-motsvarighet som äger yta, radie, kant och skugga.
En box i en app sätter inte sin egen `border-radius`.

**Varför:** radier och skuggor är skalor (`--radius-*`, `--shadow-*`). Sätts de
per komponent blir skalan en lista över tillfällen, och tre olika "kort" i samma
vy är det första någon lägger märke till utan att kunna säga varför.

## Piller och märken: form ur token, betydelse ur state

**Beslutet:** ett piller är `--radius-pill` plus ett `state`-tokenpar
(`--color-state-*` och `--color-state-*-bg`). Inget mer.

**Regeln:** pillrets färg kommer ur vad det **betyder**, aldrig ur vad det heter.
Ett piller som är grönt för att någon tyckte grönt passade är exakt det regel 1 i
tokenkontraktet finns för att stoppa.

**Och:** aldrig en färgad prick som enda bärare av identitet. Identitet får en
egen komponent (ikon, initialer eller bild i sin egen färgram), för en prick är
oläsbar för den som inte redan vet vad den betyder, och den går inte att
förklara i en skärmläsare.

## Formulärkontroller: designade, aldrig råa

**Beslutet:** inga råa `<select>`, `<input type="date">` eller
`<input type="time">` i produkt-UI. De ser olika ut i varje webbläsare och på
varje plattform, och de går inte att tokenisera.

**Vakten:** ESLint `no-restricted-syntax` mot `JSXOpeningElement[name.name='select']`.
Det är en av de vakter som bär mest, eftersom den fångar avvikelsen i samma
sekund den skrivs.

**Följden:** förbudet är meningslöst utan ersättaren. Ramverket måste leverera en
dropdown, annars bygger varje app sin egen och vi har spridningen tillbaka.

## Vyer och skal: ett panelskal, en modalyta

**Beslutet:** en vy-wrapper som äger maxbredd, ytterpadding och hur innehållet
beter sig vid smal skärm. En modal-yta som äger overlay, fokusfälla och Escape.

**Regeln om z-index:** lager kommer ur `--z-*` och **aldrig** med fallback.
`var(--z-modal, 400)` betyder att någon gissade, och två gissningar i olika
komponenter blir en modal bakom en dropdown.

---

## Så vet du att det håller: adoptionen är en siffra

Ramverket levererar en vakt som konsumenten kör **mot sig själv** och som räknar
avvikelserna: råa hex, råa `select`, färger utanför tokenlagret, egna radier.

Siffran är ett **tak som bara får sjunka**. Inte noll.

Skälet är mätt: sätter man noll direkt blir befintliga fall röda utan att någon
lagar dem, och då stängs vakten av eller kringgås. Ett tak som sjunker gör
adoptionen synlig fil för fil, vilket är hela argumentet för att adoptera i
stället för att porta: **en port är klar eller inte klar, och halvporterat är
osynligt.**

---

## Vad som INTE hör hemma i ramverket

Komponenter som kan sina data. En sessionsrad, ett kvittokort, en tidrapport:
de känner sin domän och hör hemma i sin app.

Gränsen går vid frågan: **skulle den här komponenten betyda något i den andra
plattformen?** Ett kort som visar "en sak med rubrik, status och åtgärder" gör
det. Ett kort som vet vad en faktura är gör det inte.
