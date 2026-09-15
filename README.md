# ops-framework

Kunskapen om hur vi bygger webb och applikationer. Arbetsregler, skills,
tokenkontrakt, primitiver och vakter.

Gemensamt för Staigers ops-plattformar (`bolag-ops`, `tam`), och avsett att på
sikt även bära nya ytor i SessionStudio.

**Hantverk, inte domän.** Inget datalager och ingen auktorisationsmodell:
plattformarna divergerar där med flit. `bolag-ops` går mot Firebase, `tam` är
ett korpus där repot är datan.

## De två halvorna

Ramverket har två delar, och skillnaden mellan dem är hela arkitekturen:

| Kopieras en gång, får divergera | Konsumeras som beroende, får inte divergera |
|---|---|
| appskal, routes, vystruktur | tokens (`tokens/tokens.css`) |
| regler och CI som startpunkt | primitiverna och deras stängda API |
| domänmodell, allt affärsnära | arbetsreglerna (`CLAUDE.md`) och skills |
| konfiguration, env-mall | vakterna |

`create-ops-app` lägger ut vänsterspalten och skriver in högerspalten som en
dependency. Grovjobbet kopieras, utseendet och reglerna kan inte glida.

## Struktur

| | |
|---|---|
| `CLAUDE.md` | arbetsreglerna. Läses alltid. Varje regel bär händelsen som skapade den |
| `skills/<namn>/SKILL.md` | laddas vid behov. 40 till 90 rader, varje påstående förankrat |
| `tokens/tokens.css` | 169 tokens. ÄR Tailwind-temat, inte en kopia bredvid det |
| `src/components/` | nio primitiver med stängt API |
| `tokens/check-tokens.mjs` | sju regler plus golv |
| `scripts/check-closed-api.mjs` | tre regler plus golv |
| `scripts/check-css-build.mjs` | bygger CSS på riktigt och kontrollerar utdata |
| `scripts/check-token-overrides.mjs` | vakt för en konsumentapps stilrot |
| `scripts/test-guards.mjs` | bryter varje vaktregel och kräver rött |
| `scripts/check-scaffold.mjs` | skapar, installerar och kör en app på riktigt |
| `create-ops-app/` | startplatsen. Mallen som kopieras en gång |

## Varför skills och inte ett dokument

Ett dokument på 2000 rader läses inte. En skill på 150 laddas när den behövs.
Formen är hämtad ur SessionStudio, där den är den enda som visat sig hålla.

## Vakterna först

Det som gör utseendet enhetligt är inte dokumentationen, det är vakterna.
`design-patterns.md` i SessionStudio är 2003 rader, men det som faktiskt håller
ihop UI:t är fältvakten och knappvakten. Dokumentet beskriver, vakten
upprätthåller.

⛔ Och en vakt ingen sett faila är en förhoppning. `npm run check:guards` bryter
varje regel i en kopia och kräver både rött utfall och rätt felmeddelande. Det
andra villkoret fångar en vakt som blir röd av fel anledning.

```
npm run check      # bygg, alla vakter, mutationsprov och tester
npm run check:all  # samma, plus en app som skapas och installeras på riktigt
```

## Skapa en ny plattform

```
node create-ops-app/bin/create-ops-app.mjs min-app --framework file:../ops-framework
cd min-app && npm install && npm run dev
```

Appen kommer med vyskal, routing, tema i tre lägen, felgräns, ESLint-regler som
speglar doktrinen, lokal grind, CI, och en `/primitiver`-vy där hela utseendet
går att se i båda temalägena.

## Vad Tailwind faktiskt gör åt spretet, och vad den inte gör

Mätt i `scripts/check-css-build.mjs`, inte antaget:

- `--color-*: initial` i temat gör att **`bg-red-500` slutar existera** vid
  bygget. Inte "avråds från", inte "fångas i CI". Finns inte.
- `bg-[#ff0000]` **överlever** ändå. Den luckan stängs i källkoden av
  `check-closed-api.mjs` regel 3, inte i temat.

## Status

| Klart | Kvar |
|---|---|
| arbetsreglerna | auth, Firestore-regler och regeltester (väntar på vilken app som går först) |
| tokenkontraktet som Tailwind-tema, sju vaktregler | observability: logger, larm till issue, statusvy |
| nio primitiver med stängt API, 18 beteendetester | i18n med täckningsvakt |
| fyra vakter plus mutationsharnesset, 20 regler bevisade röda | resten av de portabla vakterna ur SessionStudio |
| `create-ops-app`, bevisad genom en riktig installation | skills: web-app, testing, firebase-data, auth-google-idp, observability, ci-and-guards, architecture-decisions |
| `css-and-components` som skill | adoptionsräknare med tak som bara får sjunka |
