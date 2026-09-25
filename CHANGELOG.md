# Ändringslogg

Formatet följer [Keep a Changelog](https://keepachangelog.com/sv/1.1.0/), och
versionerna är [semver](https://semver.org/lang/sv/).

⛔ **Varje tagg `vX.Y.Z` ska ha ett avsnitt här.** `check-paket` kräver att
versionen i `package.json` står i den här filen, eftersom en utgivning utan
anteckningar är en version ingen kan välja att hoppa över.

---

## Ej utgivet

### Ändrat

- **Räknemärket ser ut som inkorgens gamla** (CP 18:10, #97): `h-4 min-w-4
  px-0.5`, `text-[8px] font-bold`, hörnet `-top-0.5 -right-0.5`, ingen ring,
  på alla placeringar. Versionen nedan (`text-xs`, ring, flyttad placering) var
  fel förlaga.
- **Ett räknemärke, `OpsCountBadge`**, för inkorgen, klockan, toppradens flikar
  och panelens rader ([#97](https://github.com/cllp/ops-framework/issues/97)).
  16 px högt, `text-xs` med `tabular-nums`, `badge`/`badge-contrast` i båda
  teman, kapas vid "99+" (tidigare "9+" på inkorgen och flikarna).
- **"Ny" har en ton**, `STATUS_TONES.ny` (info), i Aktivitet och i appens lista
  (bolag-ops #363). Aktivitetens eget röda chip är borta.
- **Panelen på telefon** får en dämpning bakom sig (`--z-scrim`, under kromet),
  egen staplingskontext och `shadow-lg`.
- `check-kontrast` mäter genomskinliga ytor sammansatta över sin bas och vaktar
  "Ny" och märket mot headern.

---

## 0.17.1

Följdrättning till [#93](https://github.com/cllp/ops-framework/issues/93): utan
den här kostar det som ärendet ville uppnå nästan två sekunder per kallstart.

### Tillagt

- `createActivityLog` återexporteras ur `@staiger/ops-framework/node`. Den låg
  bara i huvudingången, så ett Cloud Function som ville skriva en rad i loggen
  tvingades importera hela webbuntlen. Mätt, Node 20, ur den utgivna tarbollen:

  | import | tid |
  |---|---|
  | `@staiger/ops-framework/node` | **8 ms** |
  | `@staiger/ops-framework` | **1946 ms** |

- `check-node-side` kräver att nodsidan inte når React eller en komponent,
  varken direkt eller genom en mellanfil.

### Rättat

- ⛔ **`check-node-side` såg inte sidoeffektimporter.** Mönstret matchade
  `from "x"` och `import("x")` men inte `import "x";`, alltså den form man
  skriver när man vill åt en bieffekt. Mätt: en planterad `import "react";` i
  `src/node/index.js` lämnade vakten grön. Gäller båda halvorna av vakten, så
  en webbfil hade kunnat sidoeffektimportera nodsidan utan att bygget föll.
- Filhuvudena sade `@staiger/ops-framework/nod`. Ingången heter `/node`.

---

## 0.17.0

Fas 0 i epiken [#92](https://github.com/cllp/ops-framework/issues/92). Första
taggade versionen: fram till nu har konsumentapparna pinnat en SHA.

### Tillagt

- **Paketet ges ut som en packad tarboll på en GitHub-release** vid varje tagg
  `vX.Y.Z` ([#93](https://github.com/cllp/ops-framework/issues/93)). Färdigbyggd,
  så ingen `prepare` behövs hos den som installerar, och publik HTTPS, så ingen
  inloggning behövs. Det är det som gör att `bolag-ops/functions` kan sluta bära
  en kopia av aktivitetsloggen.
- `OpsCalendar` och `OpsDatePicker` tar `locale`
  ([#95](https://github.com/cllp/ops-framework/issues/95)). Månads- och
  veckodagsnamn kommer ur `Intl` i stället för ur handskrivna listor.
- `monthNames(locale)`, `weekdayNames(locale)` och `DEFAULT_LOCALE` i
  `src/lib/calendar.js`. `dateText` tar locale som andra argument.
- `createCaseModel` ger `STATUS` ([#94](https://github.com/cllp/ops-framework/issues/94)).
- Tre vakter: `check-statusord`, `check-datumnamn`, `check-paket`.

### Ändrat

- **Taxonomin heter Status, inte Läge** ([#94](https://github.com/cllp/ops-framework/issues/94)).
  Värdena `ny`, `hanterad` och `avskriven` är orörda: de står i Firestore.
- Veckodagen i kalendern skrivs `Tors` i stället för `Tor`, vilket är den
  korrekta svenska förkortningen och det `Intl` svarar.
- `CLAUDE.md` och README: ramverket äger datamodell och regler för sina **egna**
  samlingar ([#96](https://github.com/cllp/ops-framework/issues/96)).

### Utfasat

- `createCaseModel().STATES` heter `STATUS`. Aliaset är samma frysta objekt och
  står kvar tills bolag-ops pekar på en tagg som bytt.

### Borttaget

- `MONTH_NAMES` ur `src/lib/calendar.js`. Den var intern, aldrig exporterad ur
  `src/index.js`, och hade inga användare kvar efter #95.

---

## 0.16.2

Sista versionen före taggarna. Historiken före den här punkten står i
commit-loggen och i ärendena, inte här.
