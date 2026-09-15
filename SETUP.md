# Uppsättning: från tomt till inloggad app

Den här filen tar en ny ops-plattform hela vägen: repo, ramverk, Google-projekt,
inloggning, roller och driftsättning.

> ⛔ **Vad jag har provat och vad jag inte har provat.**
>
> Delarna som rör repot och ramverket (steg 1, 2, 6, 7) är körda: `check-scaffold`
> skapar en app på riktigt, installerar den som ett riktigt paket och bygger den,
> och den körningen ingår i ramverkets grind.
>
> Delarna som rör Google (steg 3, 4, 5) är **skrivna men inte körda**. `gcloud`
> fanns inte i miljön där den här filen skrevs. Kommandona kommer ur
> dokumentationen, inte ur en lyckad körning. Läs dem innan du kör dem, och kör
> `setup-gcloud.sh` i torrkörning först.
>
> Hittar du ett fel: rätta här, i den här filen. Skriv inte en egen variant i
> ditt repo, för då finns det två.

---

## Behöver varje ny app ett eget Google-projekt?

**Nej, inte nödvändigtvis. Men det är det man ska göra ändå, och skälet är inte
teknik.**

Tekniskt kan flera appar dela projekt. De delar då Firestore, autentisering och
kvoter. Det låter som att spara arbete och kostar i stället:

- **Auth är gemensam per projekt.** Delar två appar projekt delar de
  användarbas. Vill du att TAM och bolag-ops ska ha olika behörigheter måste du
  börja koda runt det, och rollmodellen blir en if-sats i stället för en gräns.
- **En felaktig säkerhetsregel drabbar allt i projektet.** Isolering som kostar
  noll kronor är den billigaste försäkring som finns.
- **Kostnad och kvot går inte att särskilja i efterhand.** "Vilken app drog
  det här?" har inget svar om de delar projekt.
- **Ett Firebase-projekt kostar ingenting i sig.** Det är förbrukningen som
  kostar. Att spara projekt sparar alltså inga pengar.

**Regel: ett projekt per plattform per miljö.** `bolag-ops-prod`,
`bolag-ops-dev`. Projekt-id går inte att byta i efterhand, så välj namnet en
gång.

### Vad som går att scripta och vad som inte gör det

| Steg | gcloud | Varför |
|---|---|---|
| Skapa projekt | ✅ | `gcloud projects create` |
| Koppla fakturakonto | ✅ | `gcloud billing projects link` |
| Slå på API:er | ✅ | `gcloud services enable` |
| Lägga till Firebase | ✅ | `gcloud alpha firebase projects add` |
| Skapa Firestore | ✅ | `gcloud firestore databases create` |
| **Google som inloggningsleverantör** | ❌ | Bara i konsolen |
| **Samtyckesskärm (OAuth consent)** | ❌ | Bara i konsolen |
| **Tillåtna domäner** | ❌ | Bara i konsolen |
| **Webbapp-config** | ❌ | Bara i konsolen |
| Säkerhetsregler | ✅ | `firebase deploy --only firestore:rules` |
| Hosting | ✅ | `firebase deploy --only hosting` |

De fyra röda raderna är skälet till att uppsättningen inte är ett enda
kommando. Ett skript som låtsas göra dem är värre än ett som säger var det tar
slut.

---

## Steg 1. Skapa appen

```bash
node node_modules/@staiger/ops-framework/create-ops-app/bin/create-ops-app.mjs bolag-ops
cd bolag-ops
npm install
npm run dev
```

Du har nu en app som kör, med tema, navigering och primitiver. Data ligger i
minnet, alltså borta vid omladdning. Det är meningen: appen ska gå att starta
innan någon bestämt var datan bor.

## Steg 2. Peka på ramverket

I appens `package.json`:

```json
"@staiger/ops-framework": "github:cllp/ops-framework#21f0333"
```

⛔ **Pinna till en commit eller en tagg, aldrig till `main`.** Pekar du på
`main` ändras appens utseende den dag någon annan pushar, och du får reda på
det av en användare.

npm kör paketets `prepare` vid installation, så `dist` och typerna byggs hos
dig. Du behöver inte checka in något byggt.

## Steg 3. Google-projektet

```bash
gcloud auth login
gcloud billing accounts list          # ger id:t till --faktura

bash node_modules/@staiger/ops-framework/scripts/setup-gcloud.sh \
  --projekt bolag-ops-prod --namn "Bolag Ops" --faktura <id>
```

Det körs i **torrkörning** och skriver bara ut vad det skulle göra. Läs
utskriften. Kör sedan om med `--kor`.

## Steg 4. De fyra sakerna i konsolen

På `console.firebase.google.com` → ditt projekt:

1. **Authentication → Sign-in method → Google → aktivera.**
2. **Authentication → Settings → Authorized domains.** Lägg till `localhost`
   och appens riktiga domän. Saknas den får du `auth/unauthorized-domain` vid
   första inloggningen, och felet säger inte var inställningen finns.
3. **Project settings → Your apps → Web.** Skapa appen, kopiera configen.
4. **Firestore → Rules.** Se steg 6. Hoppa inte över det.

Configen i appens `.env`:

```
VITE_FB_API_KEY=...
VITE_FB_AUTH_DOMAIN=bolag-ops-prod.firebaseapp.com
VITE_FB_PROJECT_ID=bolag-ops-prod
VITE_FB_APP_ID=...
```

⛔ De här värdena är **publika**. De ligger i varje byggd JS-fil och är inte
hemligheter. Att behandla dem som hemligheter är inte ofarligt: det får folk
att tro att skyddet sitter i dem, och då slarvar man med det som faktiskt
skyddar, nämligen reglerna.

## Steg 5. Koppla in inloggning och data

En fil i appen, till exempel `src/lib/firebase.js`:

```js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import * as fs from "firebase/firestore";
import { skapaFirestoreKalla, skapaGoogleAuth } from "@staiger/ops-framework";

const app = initializeApp({
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
});

export const kalla = skapaFirestoreKalla({ db: fs.getFirestore(app), sdk: fs });

export const autentisering = skapaGoogleAuth({
  auth: getAuth(app),
  sdk: { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged },
  // Rollen kommer ur appens EGEN data, inte ur Google. Google svarar på vem
  // du är, aldrig på vad du får göra.
  hamtaProfil: (a) => kalla.las("users", a.id),
});
```

⛔ **Ramverket importerar ingen Firebase-SDK.** Du skickar in den. Det är inte
krångel för sakens skull: det gör att ramverket kan bytas mot Postgres utan att
en enda komponent ändras, och det gör adaptrarna testbara utan en riktig
databas. Vaktat av `check-data-layer.mjs`.

I `App.jsx`:

```jsx
<OpsAuthProvider autentisering={autentisering}>
  <OpsDataProvider kalla={kalla}>
    <OpsAuthGate tillatnaRoller={["admin"]}>
      {/* appen */}
    </OpsAuthGate>
  </OpsDataProvider>
</OpsAuthProvider>
```

### Roller

Ett dokument per person i `users`, med Google-UID som id:

```
users/AbC123...   { epost: "claes-philip@staiger.se", roll: "admin", namn: "CP" }
```

Den som loggar in utan rad där kommer in **utan roll** och möts av
"du har inte tillgång". Det är avsiktligt: ett fel i profiluppslagningen får
aldrig ge mer behörighet än en lyckad.

Ditt eget UID ser du i Authentication → Users efter ditt första
inloggningsförsök. Lägg till raden, ladda om.

## Steg 6. Reglerna, och varför de är steg 6 och inte steg 12

⛔ **`OpsAuthGate` är INTE säkerhet.** Den bestämmer vad som renderas. Den som
öppnar nätverksfliken pratar direkt med Firestore och bryr sig inte om vad
React visade. Skyddet måste ligga där datan bor.

`firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function roll() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.roll;
    }

    // Var och en får läsa sin egen rad. Ingen får skriva den: kunde man skriva
    // sin egen roll vore rollen ett önskemål och inte en behörighet.
    match /users/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false;
    }

    match /{samling}/{dok} {
      allow read: if request.auth != null && roll() in ["admin", "lasare"];
      allow write: if request.auth != null && roll() == "admin";
    }
  }
}
```

```bash
firebase deploy --only firestore:rules --project bolag-ops-prod
```

Rollistan finns då på **två** ställen, i `OpsAuthGate` och i reglerna. Det är
inte dubbellagring utan två olika frågor: gränssnittet frågar "ska jag rita
det här", reglerna frågar "får det här hända". Svaret ska vara detsamma, men
det som gäller när de går isär är alltid reglerna.

## Steg 7. Grind och driftsättning

Appen har redan `scripts/pre-push-gate.sh` och ett CI-flöde. Lägg till
ramverkets vakter i `npm run check`:

```bash
node node_modules/@staiger/ops-framework/scripts/check-token-overrides.mjs src/index.css
node node_modules/@staiger/ops-framework/scripts/check-closed-api.mjs src
```

```bash
npm run build
firebase deploy --only hosting --project bolag-ops-prod
```

---

## Checklista

- [ ] Projektet skapat, faktura kopplad, API:er på
- [ ] Google aktiverad som inloggningsleverantör
- [ ] `localhost` och riktig domän i Authorized domains
- [ ] `.env` ifylld
- [ ] Din egen rad i `users` med roll
- [ ] **Regler publicerade**, inte bara skrivna
- [ ] Ramverket pinnat till commit eller tagg, inte `main`
- [ ] Vakterna i appens grind
- [ ] Inloggning provad i inkognitoläge, alltså utan din inloggade session

⛔ Sista raden är inte överdrift. Den som bygger är alltid redan inloggad, och
en trasig inloggning syns därför aldrig för den som byggde den.
