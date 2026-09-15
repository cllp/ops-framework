#!/usr/bin/env bash
#
# Sätter upp ett Google Cloud-projekt för en ny ops-plattform.
#
# ⛔ LÄS DET HÄR INNAN DU KÖR. Skriptet är skrivet men ALDRIG KÖRT av den som
# skrev det: `gcloud` fanns inte i den miljön. Kommandona är hämtade ur
# gcloud- och Firebase-dokumentationen, inte ur en lyckad körning. Behandla det
# som ett underlag du läser rad för rad första gången, inte som en knapp.
#
# Därför är `--dry-run` standard. Det skriver ut exakt vad som skulle köras och
# rör ingenting. Kör det först, läs utskriften, och kör sedan med `--kor`.
#
# ⛔ Det finns saker som INTE går att scripta. Google-inloggning som
# leverantör, samtyckesskärmen och tillåtna domäner sätts i konsolen, och de
# stegen står i SETUP.md. Ett skript som låtsas göra allt är farligare än ett
# som säger var det slutar.
#
# Kör:
#   bash scripts/setup-gcloud.sh --projekt bolag-ops-prod --namn "Bolag Ops"
#   bash scripts/setup-gcloud.sh --projekt bolag-ops-prod --namn "Bolag Ops" --kor

set -euo pipefail

PROJEKT=""
NAMN=""
REGION="europe-north1"
FAKTURA=""
KOR=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --projekt) PROJEKT="$2"; shift 2 ;;
    --namn) NAMN="$2"; shift 2 ;;
    --region) REGION="$2"; shift 2 ;;
    --faktura) FAKTURA="$2"; shift 2 ;;
    --kor) KOR=1; shift ;;
    --dry-run) KOR=0; shift ;;
    *) echo "Okänd flagga: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$PROJEKT" ]]; then
  echo "Ange --projekt <projekt-id>. Id:t är globalt unikt och går inte att byta sedan." >&2
  exit 1
fi
NAMN="${NAMN:-$PROJEKT}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud saknas. Installera Google Cloud CLI och kör 'gcloud auth login' först." >&2
  echo "https://cloud.google.com/sdk/docs/install" >&2
  exit 1
fi

steg() {
  local vad="$1"; shift
  echo
  echo "── $vad"
  echo "   \$ $*"
  if [[ "$KOR" == "1" ]]; then
    "$@"
  fi
}

echo "Projekt: $PROJEKT ($NAMN)   Region: $REGION"
if [[ "$KOR" != "1" ]]; then
  echo "LÄGE: torrkörning. Ingenting ändras. Lägg till --kor när utskriften ser rätt ut."
fi

steg "Skapar projektet" \
  gcloud projects create "$PROJEKT" --name="$NAMN"

# ⛔ Utan fakturakonto kan API:er inte slås på, och felet som kommer då pekar
# på API:et och inte på fakturan. Det är därför det här steget står före.
if [[ -n "$FAKTURA" ]]; then
  steg "Kopplar fakturakonto" \
    gcloud billing projects link "$PROJEKT" --billing-account="$FAKTURA"
else
  echo
  echo "── Fakturakonto"
  echo "   Hoppas över. Kör 'gcloud billing accounts list' och skicka in --faktura <id>."
  echo "   Utan fakturakonto misslyckas API-aktiveringen nedan, med ett felmeddelande"
  echo "   som handlar om API:et och inte om fakturan."
fi

steg "Slår på de API:er en ops-plattform behöver" \
  gcloud services enable \
    firebase.googleapis.com \
    identitytoolkit.googleapis.com \
    firestore.googleapis.com \
    firebasehosting.googleapis.com \
    --project="$PROJEKT"

steg "Lägger till Firebase på projektet" \
  gcloud alpha firebase projects add "$PROJEKT"

steg "Skapar Firestore-databasen" \
  gcloud firestore databases create --location="$REGION" --project="$PROJEKT"

cat <<SLUT

──────────────────────────────────────────────────────────────────────────────
Klart så långt ett skript kommer.

Det som återstår görs i konsolen och går INTE att scripta med gcloud:

  1. Slå på Google som inloggningsleverantör
     console.firebase.google.com → $PROJEKT → Authentication → Sign-in method

  2. Lägg till appens domäner under Authorized domains
     Utan den får du "auth/unauthorized-domain" vid första inloggningsförsöket,
     och felet nämner inte var inställningen finns.

  3. Skapa en webbapp och kopiera dess config
     Project settings → Your apps → Web. Värdena är PUBLIKA och ska ligga i
     appens .env, inte i en hemlighet.

  4. Lägg in dig själv i users-samlingen med en roll
     Se SETUP.md. Utan en rad där kommer du in men utan roll, vilket är avsiktligt.

  5. Publicera säkerhetsreglerna
     ⛔ Viktigast av allt. OpsAuthGate styr vad som RENDERAS. Skyddet ligger i
     reglerna. En app utan publicerade regler är öppen oavsett hur grinden ser ut.
──────────────────────────────────────────────────────────────────────────────
SLUT
