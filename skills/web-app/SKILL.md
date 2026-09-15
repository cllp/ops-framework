---
name: web-app
description: Hur en ops-app är byggd. Vyskal, routing, felgräns, tema, och var gränsen går mellan Tailwind och primitiver. Ladda innan du lägger till en vy eller ändrar appens struktur.
---

# Webbappens form

En app skapad med `create-ops-app` har redan formen. Den här skillen säger varför
den ser ut som den gör, så att nästa vy följer den i stället för att uppfinna en
egen.

## Arbetsdelningen

**Tailwind för layout. Primitiver för komponenter.**

Layout är per skärm och ska vara fri: `flex`, `grid`, `gap-4`, `md:grid-cols-2`.
En layoutkomponent per sidform blir bara ett sämre CSS med fler namn.

Komponenter bär identitet och är stängda: knapp, kort, fält, väljare, piller,
listrad, vyskal, modal, identitetsmärke. Det är dem användaren känner igen som
produkten, så varje avvikelse där kostar något.

## Varje vy ligger i ett vyskal

```jsx
<OpsView width="normal">
  <OpsViewHeader title="..." description="..." actions={<OpsButton />} />
  ...
</OpsView>
```

- **Bredden är en av fyra**, inte fri. "Lite bredare på den här sidan" upprepat
  tio gånger är exakt hur en produkt slutar kännas som en produkt.
- **Vyskalet räknar in `--safe-bottom`.** Utan det hamnar sista raden i en lista
  under hemknappsstapeln på en telefon, och det syns bara på riktig hårdvara. Att
  sidan ser rätt ut i en desktop-webbläsare bevisar ingenting om detta.
- **Rubrikraden wrappar.** Utan `flex-wrap` trycks åtgärdsknapparna ut ur skärmen
  på telefon och blir onåbara.

## Felgränsen ligger INNANFÖR routern

Ligger den utanför slår ett fel i en enda vy ut hela appen, och användaren har
ingen väg tillbaka utom att ladda om.

⛔ **En felgräns fångar och VISAR. Den sväljer inte.** En som bara renderar "något
gick fel" är samma sak som en `try/catch` utan logg: problemet finns kvar, bara
utan spår. Tre saker krävs: felet går ut till en loggkanal, texten säger vad som
gick fel, och användaren får en väg vidare.

## Temat skrivs före första renderingen

Ett litet skript i `index.html` sätter `data-theme` innan React monterar. Görs det
i en `useEffect` hinner sidan rendera ljust i en bildruta först, och den
blinkningen syns tydligt på en telefon i mörkt rum.

⛔ **Tema är tre tillstånd, inte en boolean.** En boolean har bara "mörkt av" och
"mörkt på", och då försvinner "följ systemet": den som aldrig valt något fastnar
i ljust läge även med telefonen i mörkt, och det ser ut som att inställningen är
trasig.

## React i exakt en kopia

`vite.config.js` har `resolve.dedupe: ["react", "react-dom"]`. Får appen och
ramverket var sin kopia kastar varje hook `invalid hook call`, och
felmeddelandet pekar inte mot orsaken. Det kostar en halv dag att felsöka och en
rad att undvika.

## `/primitiver` tas inte bort

Den vyn är enda stället där utseendet går att se i båda temalägena utan att bygga
en riktig funktion först. Vakterna kan bevisa att CSS genereras och att API:et är
stängt; ingen av dem kan se att något **ser** fel ut. Ett ramverk utan en sida där
man ser delarna leder till att varje ny vy uppfinner sitt eget utseende, eftersom
det är enklare än att leta.

Lägg till en rad där varje gång ramverket får en ny primitiv.

## Vad appen får ägna sig åt, och inte

| Appen äger | Ramverket äger |
|---|---|
| vyer, routes, domänmodell | tokens och primitiver |
| ESLint-konfig, CI, grinden | arbetsreglerna och skills |
| sin egen accent (värden i `src/index.css`) | strukturen i tokenkontraktet |

⛔ Behöver appen ett token eller en komponent som inte finns: **lägg till den i
ramverket**. Ett lokalt token eller en lokal knapp är början på två plattformar
som ser olika ut, och den skillnaden upptäcks först när någon jämför dem sida vid
sida.

## Aldrig interpolerade klassnamn

`bg-identity-${n}` genererar ingen CSS. Tailwind läser källkoden som text och
hittar bara klasser som faktiskt står där. Resultatet är ett element utan
bakgrundsfärg som fungerar i utvecklingsläge och försvinner i bygget. Skriv ut
varianterna i en uppslagstabell.
