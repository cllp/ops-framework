# Ny grupp 0.32.0: ramverkets panel mot SessionStudios ManageGroupModal

CP 2026-09-29 23:30: "Skapa grupp och bjuda in till grupp finns inte ännu. Skapa grupp i web skall ha samma funktion som i SessionStudio."
Bilderna `ny-grupp-390-ramverk-ss.png` och `ny-grupp-1280-ramverk-ss.png` ställer ramverkets panel (Playwright mot den byggda `dist`, `check-skalyta --bilder`,
ljust tema, Visuell identitet utfälld, en inbjuden, Mer inställningar utfälld) bredvid SS formulär.

⛔ **Ärlig anmärkning om förebilden.** SessionStudio-appen går inte att köra här (den kräver Firebase). SS-sidan är **renderad ur SS-källan**: markup och
klasser ur `ManageGroupModal.jsx:454-640` och `ManageGroupModalGroupImages.jsx:34-140`, kompilerade med Tailwind och ramverkets ljusa färgtokens, reservtypsnitt
på båda sidor. Det är SS klasser, inte en skärmbild av SS-appen, och Tailwind 4 (här) har andra förval än SS Tailwind 3.

## Vad som nu matchar (mätt i check-skalyta avsnitt 22, 390 och 1280 px)

| SS | Ramverket | Mått |
|---|---|---|
| Ordningen Visuell identitet, Namn, Beskrivning, Ort, Medlemmar, Mer inställningar (`ManageGroupModal.jsx:479-640`) | samma ordning | fältens topp i stigande ordning, mätt |
| En panel i innehållskolumnen, inte en dialog (`GroupEditRouteView`) | `OpsSkapaPanel`, `role="region"` | 0 dialoger, huvudet och gruppanelen kvar på dator |
| Etikett `text-sm font-medium` (`:590`) | 14 px / 500 | mätt |
| Raden "Visuell identitet" `text-xs uppercase` (`GroupImages:32`) | 12 px versaler | mätt |
| Märket i en cirkel med "Färg och ikon", ett tryck fäller ut färgprickar, ikonrutor och en "Aa"-ruta för initialer, fält för egna initialer (max 3) | samma delar, märket i vald färg | märkets bakgrund är identitetston 3 efter "Färg 3" |
| Namnet krävs | `required` och stjärna, Spara utan namn stannar och säger det | mätt |
| Inbjudningar samlas före spara, roll Admin eller Medlem | samma, Ägare finns inte | testat (`gruppformular.test.jsx`) |
| "Mer inställningar" hopfälld (`MoreSettingsDisclosure`) | samma, med E-postspråk | mätt |
| Plusmenyn: kalender, session, grupp (`AppHeader.jsx:398-425`) | "Ny grupp" efter Ny händelse och Nytt ärende | tre ingångar (plus, gruppanel, växlarens ark) öppnar samma panel, mätt |

## Vad som fortfarande skiljer sig

- **Kolumnbredden matchar nu** (skapa-panelen är 672 px för grupp, SS `GroupEditRouteView.jsx:40`, och 896 px för händelse, `EventEditRouteView.jsx:145`; före var den 880 för alla). Bilden är tagen efter ändringen.
- **Fälthöjd och rundning.** Ramverkets fält har 44 px höjd och 1,5 px kant (0.31.0, SS `TextInput`); SS `ManageGroupModal` använder `py-2` utan min-höjd (ca 38 px) och 1 px kant.
- **Träffytor i identiteten.** Färgprickar och ikonrutor har 44 px träffyta (prickens synliga rund är 36 px som SS, ikonrutan bär sin 44 px), SS ikonrutor är 32 px.
- **Ikonerna.** SS har elva musikikoner (`groupDefaults.js`: gitarr, mikrofon, piano). Ramverket har tio generiska (grupp, portfölj, byggnad, hus, bok, jordglob, stjärna, hjärta, blixt, krona). Musik är SS domän.
- **Färgerna.** SS har sexton färger (`colorOptions`), ramverket sex identitetstoner (`PROFILFARGER`). En fri hex följer inte med när mörkt läge kommer.
- **Medlemsraden på telefon.** SS lägger e-post, roll och Lägg till på EN rad (trång vid 390 px, se bilden); ramverket staplar dem under 768 px och lägger dem på en rad från `md`.
- **Dubbel rubrik.** SS ritar "Visuell identitet" två gånger (en etikett och en versalrad, `GroupImages:32-34`). Ramverket ritar den en gång.
- **Saknas.** "Välj från kontakter" i medlemsraden (ramverket har inga kontakter), discipliner, och bilduppladdning: den finns i SS först när gruppen finns (`!isNew && form.id`), och ramverket
  säger det med en rad text i stället för en uppladdning som inte kan fungera. Avatar i medlemsraderna saknas (adresserna har inget konto än).

# G2: gruppkortet och gruppens detaljsida (`gruppkort-ramverk-ss.png`, `gruppsida-390-ramverk-ss.png`, `gruppsida-1280-ramverk-ss.png`)

CP: "Gruppkortet skall ha lite mer info i sig som i SessionStudio." Mätt i check-skalyta avsnitt 23 (kortet på dator, där gruppanelen finns; detaljsidan vid 390 och 1280). Samma ärliga anmärkning som ovan:
SS-sidan är SS markup och klasser ur `GroupCard.jsx` och `GroupDetailView.jsx`, inte SS-appen.

| SS | Ramverket | Mått |
|---|---|---|
| (i) och penna uppe till höger, `p-1.5` med ikon 14 (`GroupCard.jsx:88-113`) | samma, 26x26 px, ikon 14 | mätt |
| Pennan bara för admin och ägare (`canEditGroup`, #2705) | bara `roll` agare eller admin, aldrig en roll som saknas | mätt och testat |
| Namn `text-xs font-semibold`, antal `text-[10px]`, fyra avatarer 20 px plus "+N" | 12 px/600, 10 px, 4 x 20 px, "+2" | mätt |
| Valt kort: `borderColor: group.color`, `backgroundColor: ${color}10` (`:60-65`) | gruppens identitetston som kant och ca 6 procents yta | kant lika med tonen, alfa 0,06, mätt |
| Märket i gruppens färg och ikon | 20 px, tonens bakgrund, ikon | mätt |
| Detaljsidan: kolumn `max-w-3xl`, märke 56, rubrik `text-xl font-semibold`, beskrivning `text-sm`, ort `text-xs`, snabbval `grid-cols-3 p-3`, medlemsrubrik `text-xs uppercase`, avatar 32, etikett `text-[10px] uppercase` | samma värden | alla mätta vid 390 och 1280 |

**Skiljer sig fortfarande:**
- Ramverkets kort har en rollpill (Ägare, Admin, Medlem) under namnet; SS-kortet har ingen (0.29-arvet, `OpsPill`). Pillret är kvar tills CP säger annat.
- "+N" är 10 px hos ramverket och 9 px hos SS (`text-[9px]`).
- SS-detaljsidan har också discipliner, publik sida, arrangörspanel, affilieringar och kommande sessioner: SS domän eller appens, inte ramverkets (`children` på `OpsGruppSida` är appens plats).
- Snabbvalens bakgrund är `raised` (tokenet) och SS `--color-bg-card`; i det ljusa temat är de nästan samma färg, i mörkt syns skillnaden inte mätt här.
- Redigera på sidan öppnar appens `onRedigera`; skalets panel öppnas av pennan på kortet (`skapa.redigeraGrupp`), inte av sidan.
