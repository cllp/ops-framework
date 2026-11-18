#!/usr/bin/env bash
# Kör ett kommando som startar Firebase-emulatorn, efter att ha stängt en emulator som blivit kvar från ett avbrutet jobb.
#
# ⛔ KÖRS BARA INNANFÖR LÅSET /tmp/lifehub-firebase-emulator.lock (cllp/lifehub.app#880). Den som håller låset är ensam om
# emulatorn på boxen, så en emulator som redan lyssnar är per definition kvar från ett jobb som dog. Utanför låset kunde den
# stänga någon annans emulator, och därför anropas skriptet aldrig utan flock framför.
#
# Händelsen: boxen för de egna runnerna är en virtuell maskin som fryses och återupptas. Då dör jobbets session mot GitHub,
# men jobbets processer lever kvar. 2026-11-18 04.10 föll ramverkets regelprov på "Could not start Firestore Emulator, port
# taken" för att en emulator från ett fryst jobb fortfarande stod på 8080.
#
# Det som stängs skrivs ut, så att en städning aldrig sker i tysthet (arbetsreglernas punkt 5).
set -euo pipefail

monster='cloud-firestore-emulator|firebase[^ ]* emulators:(exec|start)'
kvar=$(pgrep -af -- "$monster" || true)
if [ -n "$kvar" ]; then
  echo "emulatorn-ensam: stänger emulator som blivit kvar från ett avbrutet jobb:"
  echo "$kvar"
  pkill -f -- "$monster" || true
  for _ in $(seq 1 30); do
    pgrep -f -- "$monster" > /dev/null || break
    sleep 1
  done
  if pgrep -f -- "$monster" > /dev/null; then
    echo "emulatorn-ensam: stängde inte på 30 sekunder, tvingar"
    pkill -9 -f -- "$monster" || true
    sleep 1
  fi
else
  echo "emulatorn-ensam: ingen kvarlämnad emulator"
fi
exec "$@"
