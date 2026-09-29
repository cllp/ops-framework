# Tokenkontraktet

> Strukturen i `tokens/tokens.css` är kanon. Värdena är din profil.
> Filen ÄR Tailwind-temat, inte en parallell sanning bredvid det.
> Vakten är `tokens/check-tokens.mjs`. Reglerna nedan är de elva den kontrollerar,
> plus tre den inte kan kontrollera och som därför är på ditt ansvar.
>
> ⛔ **#167: en del av `tokens.css` är inte längre handskriven.** SessionStudios
> utseende (färger, radier, typografiskala, ikonlinjebredd, kortets kant,
> diagramfärger, rörelsetider, topprad) ligger som EN fixtur,
> `tokens/sessionstudio-profil.json`, mätt ur `/home/user/sessions-platform`
> med fil och rad för varje värde. `scripts/generate-tokens.mjs` skriver ur den
> in i `tokens.css` mellan `/* ── GENERERAT UR sessionstudio-profil.json,
> RÖR INTE ── */` … `/* ── SLUT GENERERAT ── */`. Se Regel 8/9 nedan.

---

## Varför tokenfilen och temat är samma fil

Tailwind 4 konfigureras i CSS med `@theme`. Det betyder att tokenkontraktet och
temat kan vara ett och samma original.

I Tailwind 3 hade `tailwind.config.js` och `tokens.css` varit två filer som
beskriver samma faktum, och "en sanning per faktum" hade varit en ambition i
stället för en mekanism. Två original glider isär. Det är inte ett omdöme om
disciplin, det är vad som händer.

---

## Regel 1. Namnge efter roll, aldrig efter färg

`--color-danger`, inte `--color-red`. `--color-accent-subtle`, inte
`--color-gold-overlay-light`.

**Skälet är mätt, inte principiellt.** SessionStudio har **148 tokens** som heter
`--color-gold-*` och som är satta till `rgba(232,224,208,...)`, alltså varm
grädde. Samtidigt säger repots toppregel att guld är **permanent borttaget**, och
den förbjudna hexen finns noll gånger. Färgen är alltså rätt. Namnen ljuger.

Följden är inte kosmetisk: en ny utvecklare eller agent som läser tokenlistan
drar slutsatsen att guld lever, och den slutsatsen är omöjlig att motbevisa utan
att slå upp värdena ett och ett.

En roll överlever en omfärgning. En färg gör det inte.

**Namnen är dessutom valda för hur de läses i JSX.** `--color-canvas` ger
`bg-canvas`. Ett token som hetat `--color-bg-primary` hade gett `bg-bg-primary`,
och en liten skavank som skrivs tusen gånger är inte längre liten.

## Regel 2. Ingen fallback i `var()`

`var(--z-modal)`, aldrig `var(--z-modal, 400)`.

En fallback gör ett saknat token **osynligt**. Sidan ser rimlig ut, ingenting
larmar, och kontraktet är brutet utan att någon får veta. Samma felform som en
`try/catch` som tystar: problemet finns kvar, bara utan spår.

## Regel 3. Mörkerblocken är omdirigeringar, inte andra original

Mörkt läge har tre tillstånd: valt ljust, valt mörkt, inte valt. Systemvalet
hanteras av `@media (prefers-color-scheme: dark)` med
`:root:not([data-theme="light"])`, det uttryckliga valet av
`:root[data-theme="dark"]`. Båda behövs, annars vinner inte ett uttryckligt val i
båda riktningarna.

**⛔ Den här regeln skrevs för att författaren bröt den i samma timme som filen
skapades.** De två blocken fick olika värde på samma token. Ett mörkt läge som
ser olika ut beroende på *hur* du valde det är nästan omöjligt att felsöka:
buggen försvinner så fort någon ändrar sin systeminställning.

Därför deklareras mörkerpaletten **en gång** som `--dark-*`, och blocken som
aktiverar den får bara peka:

```css
:root { --dark-canvas: #16171a; }
:root[data-theme="dark"] { --color-canvas: var(--dark-canvas); }
```

Ett råvärde i ett aliasblock är början på det andra originalet, och vakten
vägrar det. Drift är därmed inte längre något en vakt upptäcker, utan något som
inte kan hända.

## Regel 4. Vakten har ett golv

`check-tokens.mjs` blir röd om den läser färre än 60 tokens. En vakt som blir
grön av att ingenting lästes är den vanligaste falska grönheten vi har haft, och
den ser exakt ut som framgång.

## Regel 5. Aldrig `@theme inline`

`inline` bakar in värdet i varje utility i stället för att låta den gå via
variabeln. Allt ser rätt ut tills någon växlar till mörkt läge, och då är felet
**stumt**: inga röda vakter, ingen konsolrad, bara fel färger.

Vi använder `@theme static`. `static` skriver dessutom ut alla variabler även om
ingen utility råkar använda dem, vilket behövs eftersom mörkerblocken skriver
över dem via namn och en namnreferens inte räknas som användning.

## Regel 6. Inga föräldralösa i någon riktning

Varje `--dark-*` ska ha minst en alias som pekar på den, och varje alias ska peka
på en `--dark-*` som finns.

En oanvänd `--dark-*` är en färg som aldrig syns. En alias mot ett saknat token
ger tom sträng, alltså ärvd färg. Båda är tysta, och båda upptäcks annars först
av någon som råkar titta i mörkt läge.

## Regel 7. Mörkret får bara skriva över något som finns

Sätter mörkerblocken ett token som inte står i `@theme` saknar ljust läge sitt
grundvärde, och Tailwind genererar ingen utility alls för det.

## Regel 8/9. Det genererade blocket matchar fixturen, byte för byte

**#157/#164 skrev SessionStudios palett och rundningsskala som två listor
INUTI vakten** (`SESSIONSTUDIO_LJUST`/`_MORKT`/`_RUNDNING`). Det höll tekniskt,
men det var ett andra original: samma tal stod en gång i `tokens.css` och en
gång i vaktens egna objekt.

**#167 gör SessionStudios utseende till EN fixtur**,
`tokens/sessionstudio-profil.json`. `scripts/generate-tokens.mjs` läser den och
skriver ur den in i de markerade blocken i `tokens.css`. Regel 8/9 kör
generatorns EGNA funktion mot fixturen just nu och jämför byte för byte med vad
som faktiskt står i filen. Skiljer de sig: antingen har någon redigerat det
genererade blocket för hand (förbjudet), eller så har fixturen ändrats utan att
`node scripts/generate-tokens.mjs` körts om.

`npm run build` (och därmed `npm run check`) kör `generate:tokens` i
`prebuild`, precis som versionskonstanten. Vakten biter alltså skarpast
FRISTÅENDE (`node tokens/check-tokens.mjs`), eftersom ett fullt bygge redan
normaliserat filen innan vakten hinner se den.

## Regel 10. Ett radie-literal som matchar ett token är ett andra original

Ett handskrivet `border-radius: 999px` utanför `@theme static`, när
`--radius-full` redan är `999px`, är Regel 2 ("en sanning per faktum") i sin
renaste form. Ändras skalan glider literalet isär utan att något blir rött.

## Regel 11. Fixturens golv

Samma skäl som Regel 4, applicerat på fixturen: `tokens/sessionstudio-profil.json`
har ett minsta antal poster per grupp (färger, radier, diagramfärger). En tömd
eller halvskriven fixtur ska fälla, inte tigas ihjäl.

---

## Tre regler vakten inte kan kontrollera

**En hex i en komponent är ett fel.** Vakten läser tokenfilen, inte appen.
`--color-*: initial` tar bort Tailwinds namngivna palett vid bygget, men
`bg-[#abc123]` överlever. Den luckan är mätt i `check-css-build.mjs` och stängs i
källkoden av `check-closed-api.mjs` regel 3 plus konsumentens ESLint.

**En skala växer inte utan skäl.** Tre skuggor, fem radier, sex textstorlekar.
Behöver du en fjärde skugga: fråga först om den befintliga var fel. Skalor som
växer fritt slutar vara skalor och blir en lista över tillfällen.

**En accent, inte två.** Två accentfärger blir aldrig två. De blir fem, för varje
gång någon behöver något "mittemellan".

---

## Grupperna, och varför de är just dessa

| Grupp | Vad den svarar på |
|---|---|
| `canvas`, `surface`, `raised`, `elevated`, `hover`, `sunken`, `scrim` | vilken yta står detta på. `elevated` är det som ligger ÖVER ett kort (popover, meny), `hover` ett radhover-tillstånd. Båda nya i #167, fixturägda |
| `ink-*` | fyra nivåer. En femte blir alltid "ungefär som muted" |
| `line`, `line-strong`, `divider` | var slutar en yta |
| `accent-*` | vad är produktens hand. #167: SessionStudios green-profil (olivgrönt), se `sessionstudio-profil.json` |
| `success`, `warning`, `danger`, `info` (+ `-bg`) | vad betyder det här för användaren |
| `identity-1..6` | vem hör detta till |
| `chart-1..6` | en kategorisk diagramfärg (hette `series-1..6` före #167) |
| `scale-1..3` | en ordnad diagramskala, låg till hög. Egen validator, egna toner: byts INTE ut mot `chart-*` |
| `--spacing` | rytmen, som Tailwind multiplicerar |
| `radius-*` | hur mjuk är formen |
| `shadow-*` | hur högt ligger den |
| `font-*`, `text-*` | hur läses texten |
| `ease-*`, `--duration-*` | hur snabbt sker det. #167: 150/200/300 ms, SessionStudios tal |
| `--icon-stroke-width` | linjebredden på en lucide-ikon (1.5, `.lucide` i `@layer base`) |
| `--card-padding`, `--topbar-height` | mått ur SessionStudio, fixturägda |
| `--z-*` | vad ligger över vad |
| `--safe-*` | var får innehåll inte hamna |

**Lägg aldrig till en grupp i en app.** Lägg den här först, annars är kontraktet
bara en rekommendation och plattformarna börjar glida isär i tysthet.

---

## Så konsumerar en app kontraktet

```css
/* app/src/index.css */
@import "tailwindcss";
@import "@staiger/ops-framework/tokens.css";

/* ⛔ Tailwind läser inte node_modules av sig själv. Utan den här raden hittas
   inga klassnamn i ramverkets primitiver, och appen blir helt ostylad UTAN ett
   enda felmeddelande. Det är den dyraste fällan i hela uppsättningen, och
   därför skriver create-ops-app in raden åt dig. */
@source "../node_modules/@staiger/ops-framework/dist";

/* Därefter appens egna värden. Bara VÄRDEN, aldrig struktur. */
@theme static {
  --color-accent: #2f5d8a;
}
:root {
  --dark-accent: #7fb0d9;
}
```

Behöver appen ett token som inte finns är svaret att lägga till det i ramverket,
inte att hitta på ett lokalt.

I CI, som en del av appens egen grind:

```
node node_modules/@staiger/ops-framework/tokens/check-tokens.mjs src/index.css
```
