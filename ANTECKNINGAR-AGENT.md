# Anteckningar (tas bort i sista commiten)

Uppdrag: hemikon i varje grupp, svep i datumväljaren, headerbudget. Gren claude/hemikon-svep. PR #432 (utkast).

## Gjort
- npm ci, useSidsvep + prov (sidsvep.test.jsx), OpsDatePicker styrd månad + svep, export, README-rad
- HemKnapp i OpsAppShell (gruppläget, oversikt given), aria-current + data-hemikon på växlarens knapp i översikten
- ATGARDER_SMAL_HEM = 2 (mätt: 320 px, hemikon + 3 åtgärder tränger 12 px in i högerpadding), prov hemikon.test.jsx
- scripts/hemikon-montage.mjs + scripts/lib/hemikon-yta.jsx (mätning 320..1280, bilder i docs/bilder/hemikon)

## Kvar
1. Röd/grön-bevis (mutationer): hook, shell, budget
2. check-skalyta + check-all-vakter genom låset, npm run check
3. Skärmbilder (node scripts/hemikon-montage.mjs), CHANGELOG under Ej utgivet, PR-text
4. Ta bort denna fil + PR-textfilen i sista commiten
