# Överlämning: implementera ops-framework i en ops-plattform

**Till:** agenten som ska bygga plattformen.
**Från:** Claude, ops-framework.
**Skriven:** 2026-09-15.

Ramverket är klart och ligger på `github.com/cllp/ops-framework`. Din uppgift är
att bygga plattformen **på** det. Den här filen säger vad du ska göra, vad du
inte ska göra, och vad du ska fråga om i stället för att gissa.

---

## 1. Läs först, i den här ordningen

| Fil | Varför |
|---|---|
| `README.md` | vad ramverket är, vad det innehåller, hur det används |
| `SETUP.md` | uppsättning från tomt till inloggad app: Google-projekt, roller, regler |
| `CLAUDE.md` | arbetsreglerna. Varje regel bär händelsen som skapade den |
| `skills/css-and-components/SKILL.md` | hur utseende byggs |
| `skills/web-app/SKILL.md` | hur en app är strukturerad |
| `skills/ci-and-guards/SKILL.md` | hur vakter skrivs och vad CI kostar |
| `skills/testing/SKILL.md` | vad som testas och vad som inte gör det |

⛔ **Kopiera aldrig reglerna in i din app.** De läses från
`node_modules/@staiger/ops-framework/`. En kopia glider från originalet samma
vecka den skapas, och sedan finns två regeluppsättningar där ingen vet vilken som
gäller.

## 2. Skapa appen

```bash
node create-ops-app/bin/create-ops-app.mjs <namn> --framework "github:cllp/ops-framework#<sha>"
cd <namn> && npm install && npm run dev
```

⛔ **Pinna till en commit-SHA eller en tagg, aldrig till `main`.** Pekar du på
`main` ändras appens utseende den dag någon annan pushar, och du får reda på det
av en användare. En SHA är ett lika stabilt pin som en tagg.

⛔ **Det finns ingen tagg på remoten än.** Tagg-push gav HTTP 403 i sessionen som
byggde ramverket, mätt två gånger, medan branch-push fungerade. Det är sessionens
policy och inte repot. Tills CP skapar en release på GitHub är SHA:n det som
gäller, och den ska inte gissas: hämta den med `git ls-remote
https://github.com/cllp/ops-framework main`.

Öppna `/primitiver`. Där finns hela utseendet i en vy, i båda temalägena. Titta
på den innan du skriver en enda rad egen markup, annars kommer du att uppfinna
något som redan finns.

npm kör ramverkets `prepare` vid installation, alltså bygger `dist` och `.d.ts`
åt sig själv. Byggkedjan behöver läsrättighet till det privata repot.

## 3. Regler som inte är förhandlingsbara

1. **Tailwind för layout. Primitiver för komponenter.** `flex`, `grid`, `gap-4`
   är dina. Knapp, kort, fält, tabell, piller är ramverkets.
2. **Ingen primitiv tar emot `className`.** Behövs något som inte finns: **utöka
   ramverket**, lappa inte på anropsstället. Det är den enda regeln som håller
   ihop resten, och den är vaktad.
3. **Inga hårdkodade färger.** `bg-red-500` existerar inte efter bygget.
   `bg-[#abc123]` överlever men stoppas av vakten. Använd tokens.
4. **Inga egna tokens i appen.** Appen skriver om **värden**, aldrig struktur.
5. **Kör `npm run gate` före varje push.** Den lokala grinden är golvet, inte ett
   komplement till CI.

## 4. Så gör du när något saknas

Det kommer att hända, och det är förväntat. Fel svar är en lokal komponent. Rätt
svar:

1. Fråga först om en befintlig variant var fel val.
2. Om inte: lägg till i ramverket. Ny variant, nytt token, eller ny primitiv.
3. Följ checklistan i README under **Att lägga till i ramverket**: stängt API,
   kastar vid okänt värde, rad i `check-css-build`, beteendetest, rad i
   katalogvyn, och en mutation i `test-guards` om det är en ny vaktregel.
4. Ny tagg på ramverket. Din app bumpar när den vill ha ändringen.

⛔ **Ser du dig själv skriva markup som borde vara en primitiv: det är inte en
genväg, det är en lucka i ramverket.** Ramverkets eget exempel gjorde precis det
misstaget med en nyckeltalsruta, och det var så `OpsStat` upptäcktes.

## 5. Det som inte är ditt beslut

Fråga, gissa inte:

- **Datalagret.** Vad som ska in i Firestore, och vem som får se vad. En
  behörighetsmodell byggd på en gissning är hur man får ett permissions-träsk.
- **Deploymål och domän.**
- **Om en befintlig yta ska bevaras** eller byggas om från grunden.

## 6. Om du ska rensa upp i en befintlig plattform

Läs `adoption/bolag-ops.md`. Tre principer gäller oavsett vilken plattform det är:

1. **Flytta aldrig skräpet.** En sida som byggs om tar med sig sin gamla CSS i
   samma commit. Går den inte att ta bort är sidan inte ombyggd, den är kopierad.
2. **En migration i taget.** UI och datalager är två olika arbeten. Görs de
   samtidigt går det inte att avgöra vilket som orsakade ett fel.
3. **Taket sjunker, det nollställs aldrig.** Lägg `adoption.json` med dagens
   siffror och kör `check-adoption` i grinden. Sätter du taket till noll direkt
   blir allt rött, ingen hinner laga det, och vakten stängs av inom en vecka.

## 7. Vad som medvetet inte finns i ramverket

⛔ Den här listan sade tidigare att toast, tooltip, appskal, datalager och auth
saknades. **Det stämmer inte längre, allt det finns.** Låt det vara en påminnelse
om att en lista över vad som saknas åldras fortare än nästan allt annat i en
överlämning: läs README:s egen tabell, den är den som underhålls.

I dag saknas, med flit:

| Saknas | Varför |
|---|---|
| Firestore-regler och SQL-behörigheter | ramverket kan inte veta vem som får se vad. Det är ett produktbeslut, och det är där det riktiga skyddet ligger |
| Beroenden på `firebase` och `pg` | adaptrarna finns, men SDK:n skickas in av appen |
| Skelettladdning | `OpsEmpty busy` med snurra täcker det grova fallet |
| Diagram | datavisualisering är ett eget hantverk |
| i18n | ramverkets få egna strängar är svenska och går att skicka in som props |

Behöver din plattform något av det: **säg det, bygg det inte lokalt.** Det är
precis så två plattformar slutar se likadana ut.

## 8. Rapportera tillbaka

- När den första vyn är i mål, med en skärmbild i båda temalägena.
- Varje gång du behövde något ramverket saknade. Den listan är det mest värdefulla
  du kan lämna, för den säger vad nästa version ska innehålla.
- Om något i den här överlämningen visade sig vara fel. Skriv det rakt ut i
  stället för att bygga runt det.
