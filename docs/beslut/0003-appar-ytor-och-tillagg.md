# Beslut 0003: appar pluggar in i ytor via platser

Status: **beslutat** (2026-10-05, CP: "Bra lösning. Så vill vi ha det." och "Ok. Så gör vi."). Epik: cllp/ops-framework#251.
Relaterat: #92 (modulkontraktet), #244 (appar som moduler), #237 (modul- och ramverks-API), #20 (händelser som ops-primitiv),
#184 (modul per grupp).
Det här är ett designbeslut. Ingen kod i den här leveransen bygger platserna; skivorna i #251 gör det.

## Händelsen

CP 2026-10-05, i samtal: "Om jag skulle vilja i en grupp addera specifik funktionalitet för händelser, jag skulle vilja
kunna skapa en session där vi gör en poll om vilket datum som passar bäst. Jag vill kanske ha en ny yta som hör till en
app eller kunna förändra en yta. Var drar vi gränsen?"

Frågan hade inget svar i ramverket. Appar kunde ha egna ytor, men ingenting sade om en app fick ändra en yta som
ramverket äger, eller hur en funktion som bara gäller en del av en befintlig yta skulle komma in. Utan svar blir varje
sådan önskan en egen lösning, och efter några stycken finns lika många versioner av "händelse" som det finns appar.

## Beslutet

⛔ **En app ändrar aldrig en ramverksyta. Den pluggar bara in där ytan har lämnat en plats.** Saknas platsen öppnar
ramverket den, en gång, för alla appar.

### Skälet

- **Får appar skriva om ytor** får varje app sin egen version av ytan, och ramverket kan inte längre ändra den utan att
  något går sönder hos någon.
- **Måste allt in i ramverket** blir ramverket långsamt och fullt av sådant bara en grupp vill ha.
- **Platser löser båda.** Ramverket bestämmer var det går att plugga in, modulen bestämmer vad.

### Fyra nivåer. En önskan hamnar på den lägsta som räcker

| Nivå | Vad | Exempel | Ägare |
|---|---|---|---|
| 1. Konfiguration | Typer, status, fält, färg och ikon i inställningsvyn. Ingen kod | Händelsetypen "Rep" | Gruppen |
| 2. Tillägg | Beteende på en befintlig yta, i en plats ytan erbjuder: sektion, åtgärd, läge | Datumomröstning på en händelse | Modulen, i ramverkets plats |
| 3. Egen yta | Egen lista, eget livslopp, egen plats i menyn | Ekonomi | Modulen |
| 4. Ramverket | Platsen saknas, eller två appar vill ha samma sak | Platserna på händelseytan | Ramverket |

### Orden. Ett för användaren och ett för koden, aldrig blandade

| Ord | Vem ser det | Betyder |
|---|---|---|
| **App** | Användaren, i inställningarna | Det man slår på i en grupp. Har namn och ikon |
| **Yta** | Användaren, i menyn | En egen sida med egen lista. En app har noll, en eller flera |
| **Tillägg** | Användaren, där det syns | Det en app lägger in på en annan yta |
| **Modul** | Bara utvecklare | Kodpaketet som levererar en app. Ordet finns redan i koden (`provaModul`, `modul:slag`) |

Den som slår på något i en grupp tänker "app", oavsett hur det är byggt. Två ord för samma sak i gränssnittet hade
tvingat användaren att lära sig en skillnad som bara finns i koden.

### Menyn och inställningarna svarar på olika frågor

CP 2026-10-05: "Men den appen kommer inte synas under appar i menyn då den inte har egen yta ju?"

| Plats | Frågan | Vad som står där |
|---|---|---|
| **Menyn** | Vart kan jag gå? | Ytor. En app utan egen yta står inte där, och det är rätt |
| **Inställningar, Appar** | Vad har gruppen påslaget? | Alla appar, också de utan yta, med en rad "Syns på: Händelser" |

⛔ **Bygg aldrig en tom yta för att en app ska få en menyrad.** Den leder till en sida utan innehåll, och användaren
tror att något är trasigt.

⛔ **Menyavsnittet som heter "Appar" byter etikett.** Det listar ytor och inte längre alla appar, och en etikett som
lovar mer än listan innehåller är samma fel som en rapport som utelämnar en rad (regel 5). Förslaget är gruppens namn.

## Datumomröstningen: första appen utan egen yta

Den är ett **läge** på en händelse (datum ej bestämt, förslag, röster), inte en egen yta. När ett datum valts är det en
vanlig händelse igen. En egen yta hade gett två ställen för samma händelse, och det förbjuder regel 2.

Den levereras med ramverket och slås på per grupp, eftersom varje grupp som planerar vill ha den och SessionStudio har
den som kärna. Det placerar den på nivå 4 och inte i en enskild app.

⛔ **Tilläggets data ligger i en egen samling som appen namnger**, aldrig i ramverkets egna samlingar och aldrig som
lösa fält på händelsen. Ramverket känner aldrig samlingsnamn ("Vad som inte är regler här" i `CLAUDE.md`).

## Följdsteg

Skivorna står i #251:

1. Platserna på händelseytan: sektion i detaljvyn, åtgärd i plusmenyn, läget "datum ej bestämt". Prov som visar att en
   app utan plats inte kan rita på ytan.
2. Inställningar, Appar: alla appar med "Syns på", på och av per grupp.
3. Menyetiketten "Appar" byts.
4. Datumomröstningen som tillägg, med regler, regelprov och skärmbild sida vid sida med SessionStudio (regel 12).
