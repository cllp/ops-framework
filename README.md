# ops-framework

Kunskapen om hur vi bygger webb och applikationer. Arbetsregler, skills,
tokenkontrakt, stilskikt och vakter.

Gemensamt för Staigers ops-plattformar (`bolag-ops`, `tam`), och avsett att på
sikt även bära nya ytor i SessionStudio.

**Hantverk, inte domän.** Inget datalager och ingen auktorisationsmodell:
plattformarna divergerar där med flit. `bolag-ops` går mot Firebase, `tam` är
ett korpus där repot är datan.

## Struktur

| | |
|---|---|
| `CLAUDE.md` | arbetsreglerna. Läses alltid. Varje regel bär händelsen som skapade den |
| `skills/<namn>/SKILL.md` | laddas vid behov. 40 till 70 rader, varje påstående förankrat |
| `tokens/tokens.css` | 116 tokens, tolv grupper, tre lägen för mörkt tema |
| `css/ops.css` | stilskiktet. Namngivna klasser, ren CSS, inget byggberoende |
| `tokens/check-tokens.mjs` | fyra regler, alla bevisade röda |
| `css/check-closed-api.mjs` | tre regler plus golv, bevisade i båda riktningarna |

## Varför skills och inte ett dokument

Ett dokument på 2000 rader läses inte. En skill på 150 laddas när den behövs.
Formen är hämtad ur SessionStudio, där den är den enda som visat sig hålla.

## Vakterna först

Det som gör utseendet enhetligt är inte dokumentationen, det är vakterna.
`design-patterns.md` i SessionStudio är 2003 rader, men det som faktiskt håller
ihop UI:t är fältvakten och knappvakten. Dokumentet beskriver, vakten
upprätthåller.

```
node tokens/check-tokens.mjs tokens/tokens.css
node css/check-closed-api.mjs src
```

## Status

| Klart | Kvar |
|---|---|
| arbetsreglerna | primitiverna som React-komponenter |
| tokenkontraktet och dess vakt | de portabla vakterna ur SessionStudio (cirka 15 av 49) |
| stilskiktet, sex primitivklasser | skills: web-app, testing, firebase-data, auth-google-idp, observability, ci-and-guards, architecture-decisions |
| css-and-components som skill | genererad regelkopia med driftvakt för konsumentrepon |
| vakten för stängt API | adoptionsräknare med tak som bara får sjunka |
