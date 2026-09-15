#!/usr/bin/env bash
#
# Lokal grind. Körs före push, på en maskin vi äger.
#
# ⛔ DEN HÄR GRINDEN ÄR GOLVET, INTE ETT KOMPLEMENT TILL CI.
#
# Skälet är både kostnad och en mycket dyrare lärdom. Kostnaden: varje push
# startar varje workflow som lyssnar på grenen, och en commit lokalt startar
# ingenting. Lärdomen: i SessionStudio stod det i reglerna att fem kontroller
# krävdes för merge, och den raden slutade vara sann en kväll utan att någon
# märkte det. Agenter som läst regeln trodde sig skyddade och slutade
# kontrollera för hand. En regel som utlovar ett skydd den inte har är farligare
# än ingen regel alls, eftersom den flyttar uppmärksamheten bort från risken.
#
# Därför: kör det här lokalt, och lita aldrig på att något annat fångade det.
#
# Installera som git-hook:
#   printf '#!/bin/sh\nnpm run gate\n' > .git/hooks/pre-push && chmod +x .git/hooks/pre-push

set -euo pipefail

cd "$(dirname "$0")/.."

steg() {
  printf '\n\033[1m==> %s\033[0m\n' "$1"
}

steg "Lint"
npm run lint

steg "Tokenkontraktet"
node node_modules/@staiger/ops-framework/scripts/check-token-overrides.mjs src/index.css

steg "Stängt API"
node node_modules/@staiger/ops-framework/scripts/check-closed-api.mjs src

steg "Tester"
npm run test

steg "Bygge"
npm run build

printf '\n\033[32mGrinden är grön. Push är okej.\033[0m\n'
