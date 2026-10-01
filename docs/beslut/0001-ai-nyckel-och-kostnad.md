# Beslut 0001: vems AI, vems nyckel, vems räkning

Status: **föreslaget** (2026-10-01). Ärende: cllp/ops-framework#185, bakgrund #99 och cllp/bolag-ops#253.
Det här är ett designbeslut. Ingen kod i den här leveransen bygger det; följdärendena längst ned gör det.

## Händelsen

CP 2026-09-30, workshop med Chief of Staff: ramverket ska få en AI-assistent som går att slå på per app
och per grupp, "med policy så andras grupper inte rider på appägarens AI-kostnad".

Två saker gör frågan skarp nu och inte sedan:

1. **Grupper är inte längre bara appägarens egna.** Medlemsregistret och gruppväljaren (0.3x) gör att
   en app kan ha grupper som någon annan äger. Ett AI-anrop som går på appens konto från en sådan grupp är
   en räkning som hamnar hos fel person, och den syns först på fakturan.
2. **Det finns redan en väg utan nyckel.** cllp/bolag-ops#253 valde Gemini via Vertex i samma Google-projekt
   som Firebase: funktionen autentiserar sig med sitt eget tjänstekonto, och då finns ingen API-nyckel att
   läcka. Den vägen är billig och säker, och den är just därför farlig att dela ut: den kostar appägaren,
   oavsett vem som frågar.

## Beslutet

### 1. Fem lägen, och "av" är förvalet

| Läge | Vad | Vem betalar |
|---|---|---|
| `av` | Ingen modell. Chatt och formulär fungerar som förut. | Ingen |
| `mock` | Skriptade svar, märkta **Mock** i gränssnittet. För att kunna klicka igenom ett flöde innan något kopplas in. | Ingen |
| `plattform` | Appens egen väg (bolag-ops: Vertex med funktionens tjänstekonto, #253). Ingen nyckel finns. | Appägaren |
| `byok` | Gruppens eller appens egen nyckel hos en leverantör. | Den som lagt in nyckeln |
| `agent` | En webhook till någons egen agent. | Agentens ägare |

⛔ **Förvalet är `av`, inte `mock`.** Ett mockläge som är påslaget av sig självt är en assistent som svarar
påhittat i en app där ingen bett om den.

### 2. Upplösningen: gruppen först, sedan appen enligt policy, annars av

```
grupp.ai satt (override)  ->  gruppens läge
annars, app.ai.groupPolicy:
  "inherit_ok"            ->  appens läge
  "own_only"              ->  av (gruppen måste lägga in egen)
  "off"                   ->  av
```

⛔ **Förvalt `groupPolicy` är `own_only`.** Det är den raden som gör att "andras grupper rider inte" är sant
utan att någon behöver komma ihåg att slå på det. En app som vill bjuda sina grupper på AI gör det med ett
aktivt val (`inherit_ok`), och då är det ett beslut och inte ett förbiseende.

⛔ **Appägarens egna grupper ärver inte automatiskt.** Det låter bekvämt men gör policyn till två policyer: en
för ägaren och en för alla andra, och den ena testas aldrig. Ägaren sätter `inherit_ok` eller lägger in läget
på gruppen, som alla andra.

Upplösningen blir en **ren funktion i ramverket** (`losAiKalla(app, grupp)` -> `{ lage, kalla, skal }`), med
`skal` utskrivet också när svaret är `av` (arbetsreglernas punkt 5: "av för att policyn säger own_only" och
"av för att ingen satt något" är olika svar och ska gå att skilja på).

### 3. Nyckeln bor aldrig i Firestore och aldrig i klienten

- Firestore bär bara en **hänvisning**: `apiKeySecretId` (ett Secret Manager-namn) eller `webhookSecretId`.
- En nyckel skrivs via en **callable** som lägger den i Secret Manager och svarar med hänvisningen. Klienten
  skickar nyckeln en gång och får aldrig tillbaka den; inställningsvyn visar "nyckel satt", av vem och när.
- Samma princip som `externDatakallor.credentialSecretId` (#216). Två sätt att förvara en hemlighet i samma
  ramverk hade blivit två granskningar, och den ena hade blivit gjord.

⛔ Skälet är inte teoretiskt: appen är statiska filer på Firebase Hosting, och allt som når klienten kan läsas
av den som öppnar utvecklarverktygen. En nyckel i ett dokument som klienten läser är en publicerad nyckel.

### 4. Ramverket känner aldrig leverantören

Kontraktet från #253 står kvar: `{ prompt, sammanhang }` in, `{ text, tokens }` ut. `OpsPrompt` och
`skapaPromptkalla` (ramverkets PR 58) rördes inte när Claude byttes mot Gemini, och det är beviset att gränsen
ligger rätt. Leverantörsadaptrarna bor på serversidan (`src/node`), en i taget: en adapter som aldrig haft två
implementationer är en gissning om vad som skiljer dem.

### 5. Kvot och förbrukning är serverns, och ett stopp säger att det är ett stopp

- `monthlyBudgetSek` sätts av den som betalar (appen för `plattform`, gruppen för `byok`).
- Förbrukningen skrivs bara av funktionen, i en samling klienten kan läsa men inte skriva.
- När taket nås svarar funktionen med ett fel som säger det ("Månadens AI-budget för gruppen är slut"),
  aldrig med ett tomt svar. En assistent som tystnar ser ut som en assistent som inte förstod frågan.

### 6. Vem får ändra

- `ai` på gruppen: **gruppens ägare**, inte admin. Samma gräns som `externDatakallor` i 0.41.0, av samma skäl:
  det är den som betalar som avgör.
- `ai` på appen: appens ägare, i ramverkets konfigurationssamling.
- Reglerna genereras av regelgeneratorn som resten av ramverkets fält, så appen får dem med regelfragmentet.

## Vad som inte ingår

- **Chatten** (#99): en egen leverans. Assistenten ska kunna bo i en chatt senare, men behöver den inte.
- Nyckel per användare. Grupp och app räcker, och en tredje nivå tredubblar upplösningen.
- Att något körs utan att en människa bekräftat. Assistenten föreslår, en människa trycker (#253).
- Notion och andra externa källor.

## Minsta API-yta, i den ordning den byggs

1. **Kontraktet och upplösaren** (ramverket): typdefinition för `ai` på app och grupp, `losAiKalla`,
   regelfragment för fältet (ägaren skriver, `apiKeySecretId` måste ha Secret Manager-form). Ren kod, prov
   åt båda hållen, ingen leverantör.
2. **Hemligheten** (ramverket, `src/node`): en byggare för callablen som tar emot en nyckel, skriver den i
   Secret Manager och svarar med hänvisningen. Appen ger projekt-id och samlingsnamn (ramverket känner dem
   aldrig).
3. **Inställningen** (ramverket): en ruta i gruppinställningarna, bara för ägaren, med läge, leverantör,
   "nyckel satt" och budget. Mockläget märkt.
4. **Förbrukningen** (appen först, ramverket när två appar behöver den): räkning per månad och stopp vid tak.

Steg 1 och 3 kan byggas och provas helt i mockläge.
