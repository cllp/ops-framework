# ops-framework

Det gemensamma fundamentet för Staigers ops-plattformar. Färg- och formsystem,
färdiga byggdelar, arbetsregler och vakter, så att `bolag.ops.staiger.se`,
`tam.ops.staiger.se` och det som kommer sedan ser likadana ut, fungerar likadant
och följer samma regler, utan att grovjobbet görs om varje gång.

---

## Vad problemet är

Tre plattformar som byggs var för sig blir tre produkter. Inte för att någon
slarvar, utan för att varje enskilt beslut är rimligt: en knapp här behöver vara
lite bredare, en färg där är nästan rätt, en lista behöver en variant till. Varje
avvikelse är liten och summan är att ingenting hänger ihop.

Det som stoppar det är inte dokumentation. **Det är att den enkla vägen också är
den rätta**, och att avvikelser blir röda i stället för att bara vara olämpliga.
Därför ligger tyngdpunkten här på ett stängt API och på vakter, inte på en
stilguide.

## De två halvorna

| Konsumeras, får inte divergera | Kopieras en gång, får divergera |
|---|---|
| tokens (`tokens/tokens.css`) | appskal, routes, vyer |
| primitiverna och deras stängda API | domänmodell, allt affärsnära |
| arbetsreglerna (`CLAUDE.md`) och skills | ESLint-konfig, CI, grinden |
| vakterna | konfiguration och env |

Regeln är enkel: **ska det se likadant ut i alla appar, konsumeras det. Får det
bli olika, kopieras det.**

---

## Vad du får

### Tokens

193 värden i `tokens/tokens.css`, som **är** Tailwind-temat och inte en kopia
bredvid det.

| Grupp | Vad den svarar på |
|---|---|
| `canvas`, `surface`, `raised`, `sunken`, `scrim` | vilken yta står detta på |
| `ink`, `ink-secondary`, `ink-muted`, `ink-inverse` | textnivå |
| `line`, `line-strong`, `divider` | var slutar en yta |
| `accent`, `accent-hover`, `accent-subtle`, `accent-faint` | produktens hand |
| `success`, `warning`, `danger`, `info` (+ `-bg`) | vad betyder detta för användaren |
| `identity-1` .. `identity-6` | vem hör detta till |
| `human`, `agent`, `auto` (+ `-bg`) | vem producerade det |
| `--spacing`, `radius-*`, `shadow-*`, `text-*`, `font-*` | rytm och form |
| `--z-*`, `--safe-*`, `--duration-*`, `ease-*` | lager, säkra ytor, rörelse |

Mörkt läge har tre tillstånd: valt ljust, valt mörkt, och inte valt. Paletten för
mörkt deklareras **en gång**; blocken som aktiverar den får bara peka.

### Primitiver

Femton komponenter, alla med stängt API. Ingen tar emot `className` eller
`style`.

| Åtgärder och ytor | |
|---|---|
| `OpsButton` | `variant` primary, secondary, ghost, danger. `size`, `busy`, `iconOnly`, `href` |
| `OpsCard` | `tone` raised, sunken, plain. `elevated`, `flush` |
| `OpsView`, `OpsViewHeader` | vyskal med fyra bredder, säker botten, rubrik med åtgärder |
| `OpsModal` | dialog med fokusfälla, Escape, scrollås. Kräver titel |

| Formulär | |
|---|---|
| `OpsField` | etikett, hjälptext och fel, kopplade med id åt dig |
| `OpsInput`, `OpsTextarea` | vägrar webbläsarens egna datum- och färgväljare |
| `OpsSelect` | designad väljare med tangentbord och typeahead |
| `OpsCheckbox`, `OpsSwitch` | riktiga fält, inte div med roll |

| Data | |
|---|---|
| `OpsList`, `OpsListRow` | rader utan fast höjd, riktig knapp eller länk när de är klickbara |
| `OpsTable` | egen scroll i sidled, `tabular-nums` i sifferkolumner, kräver caption |
| `OpsStat` | nyckeltal med etikett, värde, jämförelse och ton |
| `OpsEmpty` | tomt tillstånd OCH laddning, som är olika saker |

| Märkning | |
|---|---|
| `OpsPill` | status. `tone` neutral, success, warning, danger, info |
| `OpsTag` | kategori. Tonen härleds ur etiketten, ingen kod per värde |
| `OpsIdentity` | bild, ikon eller initialer i egen ton. Aldrig en färgad prick |
| `OpsProvenance` | människa, agent eller automatik, alltid med ordet utskrivet |

| Navigering och meddelanden | |
|---|---|
| `OpsTabs`, `OpsTabPanel` | flikar med piltangenter och korrekt koppling |
| `OpsBanner` | `info` och `success` avbryter inte, `warning` och `danger` gör det |

### Hjälpare

| | |
|---|---|
| `formatCurrency`, `formatNumber`, `formatPercent` | svensk formatering via `Intl` |
| `formatDate`, `formatDateTime` | rena datum visas som rätt dag, inte dagen innan |
| `getTheme`, `setTheme`, `initTheme` | ljust, mörkt, följ systemet |
| `identityTone`, `initials` | deterministisk ton och initialer som inte klipper tecken |

### Vakter

| Vakt | Vad den bevisar |
|---|---|
| `check-tokens` | sju regler i tokenkontraktet, plus golv mot fel fil |
| `check-exports` | den publika ytan stämmer med modulerna, inget internt läcker |
| `check-closed-api` | ingen primitiv tar `className`, ingen app lappar, ingen ad-hoc-färg |
| `check-css-build` | bygger CSS på riktigt och läser i resultatet |
| `check-token-overrides` | en konsumentapps stilrot följer kontraktet |
| `check-scaffold` | en app skapas, installeras och kör sin egen grind |
| `check-adoption` | en pågående upprensning går framåt, aldrig bakåt |
| `test-guards` | **bryter varje regel ovan och kräver rött** |

⛔ Den sista är inte en extra finess. **En vakt ingen sett faila är en
förhoppning.** Vi har haft vakter som var gröna i månader för att de läste fel
fil, jämförde en lista mot en kopia av sig själv, eller blev gröna av tom indata.

---

## Så kommer ett projekt igång

```bash
node create-ops-app/bin/create-ops-app.mjs min-app --framework file:../ops-framework
cd min-app
npm install
npm run dev
```

Öppna `/primitiver`. Där ligger hela utseendet i en enda vy, och växlaren uppe
till höger visar båda temalägena.

### De fyra filer som är dina

| | |
|---|---|
| `src/index.css` | appens profil. Bara **värden**, aldrig struktur |
| `src/app/views/` | vyerna |
| `src/lib/` | appens egna hjälpare |
| `src/app/App.jsx` | routes och skal |

### Sätt appens färg

```css
/* src/index.css */
@theme static {
  --color-accent: #2f5d8a;
}
:root {
  --dark-accent: #7fb0d9;
}
```

⛔ Skriv **aldrig** ett eget `:root[data-theme="dark"]`-block i appen. Ramverkets
block pekar redan på `--dark-*`, och ett eget block blir det andra originalet som
glider isär. Vakten stoppar det.

### Före varje push

```bash
npm run gate
```

Den lokala grinden är **golvet**, inte ett komplement till CI.

---

## Så används ramverket

### Tailwind för layout, primitiver för komponenter

Layout är per skärm och ska vara fri: `flex`, `grid`, `gap-4`, `md:grid-cols-2`.
En layoutkomponent per sidform blir bara ett sämre CSS med fler namn.

Komponenter bär identitet och är stängda. Det är dem användaren känner igen som
produkten, så varje avvikelse där kostar något.

```jsx
<div className="grid gap-4 md:grid-cols-3">   {/* layout: Tailwind */}
  <OpsStat label="Omsättning" value={formatCurrency(1284000)} />
  <OpsStat label="Marginal" value="18 %" tone="success" />
</div>
```

### Ingen primitiv tar emot className

Inte som prop, inte som spread, inte "bara den här gången". Behöver du något som
inte finns: **utöka primitiven**, lappa inte på anropsstället.

Det är den enda regeln som håller ihop resten. Så fort en komponent tar emot
godtyckliga klasser lägger varje anropsställe på tre utilities, och efter tre
månader beskriver ramverket inte längre vad som faktiskt renderas.

### Värden kommer ur tokens

`text-ink-secondary`, aldrig en hex. Tailwinds egen palett **finns inte**:
`--color-*: initial` i temat gör att `bg-red-500` slutar existera vid bygget.

Godtyckliga värden som `bg-[#abc123]` överlever ändå bygget. Det är mätt, inte
antaget, och därför stoppas de i källkoden av `check-closed-api` i stället.

### Aldrig interpolerade klassnamn

`bg-identity-${n}` genererar ingen CSS. Tailwind läser källkoden som text. Skriv
ut varianterna i en uppslagstabell.

---

## Vad som INTE finns, med flit

| Saknas | Varför |
|---|---|
| Datalager, auth, behörighetsmodell | ser olika ut per plattform. Att gissa modellen i förväg är hur man får en behörighetsmodell ingen litar på |
| Toast och notiser | `--z-toast` finns i skalan, men ingen primitiv använder den än. Läggs till när första appen behöver spara något |
| Tooltip, skelettladdning | inte efterfrågade av någon riktig vy än |
| Diagram | datavisualisering är ett eget hantverk och hör inte hemma i en komponentlåda |
| Appskal och toppnavigering | ligger i mallen i dag. Bör flytta hit, men det hänger på ett beslut om `create-ops-app` |
| i18n | ramverkets få egna strängar är svenska och går att skicka in som props. Blir det fler språk är det en riktig fråga, inte en parameter |

Listan är lika viktig som innehållsförteckningen. **Ett ramverk som låtsas täcka
allt får folk att böja det i stället för att utöka det.**

---

## Att lägga till i ramverket

Ser du dig själv skriva markup i en app som borde vara en primitiv: det är inte
en genväg, det är en lucka som ska lagas här.

1. **Ny variant före ny komponent.** Behövs en femte knappvariant är frågan först
   om en av de fyra var fel.
2. **Ny token läggs i `tokens/tokens.css`**, med både ljust värde och `--dark-*`.
   Namnge efter roll, aldrig efter färg.
3. **Ny primitiv** får ett stängt API, kastar med läsbar text vid okänt värde,
   och en rad i `check-css-build`:s lista över klasser som måste genereras.
4. **Test på beteende, inte på klassnamn.** Ett test som påstår att knappen har
   `bg-accent` går sönder vid varje omstyling och säger inget om funktionen.
5. **En rad i katalogvyn** (`/primitiver`), annars hittar ingen den.
6. **Ny vaktregel får en mutation** i `test-guards.mjs`. Utan den är den oprövad.

```bash
npm run check       # bygg, alla vakter, mutationsprov och tester
npm run check:all   # samma, plus en app som skapas och installeras på riktigt
```

---

## Struktur

| | |
|---|---|
| `CLAUDE.md` | arbetsreglerna. Läses alltid. Varje regel bär händelsen som skapade den |
| `skills/<namn>/SKILL.md` | laddas vid behov, inte allt på en gång |
| `tokens/tokens.css` | tokenkontraktet, som är Tailwind-temat |
| `src/components/` | primitiverna |
| `src/lib/` | tema, identitet, formatering |
| `scripts/` | vakterna |
| `create-ops-app/` | mallen som kopieras en gång |
| `adoption/` | planer för att flytta en befintlig plattform hit |

### Varför skills och inte ett dokument

Ett dokument på 2000 rader läses inte. En skill på 150 laddas när den behövs.
Formen är hämtad ur SessionStudio, där den är den enda som visat sig hålla.

---

## Status

| Klart | Kvar |
|---|---|
| tokenkontraktet som Tailwind-tema, 193 tokens | auth, Firestore-regler och regeltester |
| femton primitiver med stängt API, 43 beteendetester | observability: logger, larm till issue |
| sju vakter plus mutationsharnesset, 24 regler bevisade röda | toast, tooltip, appskal |
| `create-ops-app`, bevisad genom en riktig installation | appskal och navigering in i ramverket |
| adoptionsplan för bolag-ops, mätt mot repot | själva adoptionen, som väntar på profilbeslutet |
| skills: `css-and-components`, `web-app`, `testing`, `ci-and-guards` | skills: `firebase-data`, `auth-google-idp`, `observability`, `architecture-decisions` |
