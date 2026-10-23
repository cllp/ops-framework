# Anteckningar (agent, claude/vantan-progress)

Uppdrag: progress överallt där användaren väntar (CP 2026-10-23). Version 0.141.0.

## Läget (uppdateras löpande)
- Mätt: `OpsButton` har sedan 0.129.0 ett gemensamt väntläge (auto när onClick ger ett löfte, annars `busy`). Det som saknas:
  verb i pågående form, och en vakt som kräver väntläget där en knapp startar ett anrop.
- Plan: (1) `busyLabel` på OpsButton, (2) vakt `scripts/check-vantar.mjs` (babel-AST, golv, tak för undantag, bevisad i test-guards),
  (3) rätta de ställen vakten hittar, (4) skillen interaktionsdesign + CHANGELOG 0.141.0 + version, (5) inventering av lifehub.app i PR-texten.
- Skanningsprototyper ligger i scratchpad/vantan/ (inte committade).

## Gjort
(inget committat ännu)
