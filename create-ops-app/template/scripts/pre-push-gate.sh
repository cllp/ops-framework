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

# ⛔ Layouten mäts EFTER bygget, på det som faktiskt ska ut, och i en riktig
# webbläsare. Alla steg ovan kör i Node eller jsdom, och jsdom lägger ingen CSS
# alls: där är `hidden md:flex` osynligt, och "ingen horisontell scroll vid 390
# px" går inte att kontrollera, bara att lova.
#
# ⛔ Lägg till appens EGNA rutter i listan. Mäts bara startsidan är grinden grön
# för en sida av tio, och det är precis så horisontell scroll hann ligga kvar i
# bolag-ops tills någon klickade igenom appen för hand.
#
# Playwright ligger redan i devDependencies. Webbläsaren gör den inte:
# kör `npx playwright install chromium` en gång per maskin, eller peka ut en
# du redan har med OPS_CHROMIUM.
steg "Layout vid 390 och 768 px"
npm run check:viewport

printf '\n\033[32mGrinden är grön. Push är okej.\033[0m\n'
