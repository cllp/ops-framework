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

- **Kolumnbredden.** Ramverkets skapa-panel är 880 px bred (0.31.0, `max-w-[55rem]`); SS `GroupEditRouteView.jsx:38` är `max-w-2xl` (672 px). Det är panelens
  mått för ALLA formulär, inte något nytt i det här arbetet, och jag har inte ändrat det utan att fråga: värt ett eget beslut.
- **Fälthöjd och rundning.** Ramverkets fält har 44 px höjd och 1,5 px kant (0.31.0, SS `TextInput`); SS `ManageGroupModal` använder `py-2` utan min-höjd (ca 38 px) och 1 px kant.
- **Träffytor i identiteten.** Färgprickar och ikonrutor har 44 px träffyta (prickens synliga rund är 36 px som SS, ikonrutan bär sin 44 px), SS ikonrutor är 32 px.
- **Ikonerna.** SS har elva musikikoner (`groupDefaults.js`: gitarr, mikrofon, piano). Ramverket har tio generiska (grupp, portfölj, byggnad, hus, bok, jordglob, stjärna, hjärta, blixt, krona). Musik är SS domän.
- **Färgerna.** SS har sexton färger (`colorOptions`), ramverket sex identitetstoner (`PROFILFARGER`). En fri hex följer inte med när mörkt läge kommer.
- **Medlemsraden på telefon.** SS lägger e-post, roll och Lägg till på EN rad (trång vid 390 px, se bilden); ramverket staplar dem under 768 px och lägger dem på en rad från `md`.
- **Dubbel rubrik.** SS ritar "Visuell identitet" två gånger (en etikett och en versalrad, `GroupImages:32-34`). Ramverket ritar den en gång.
- **Saknas.** "Välj från kontakter" i medlemsraden (ramverket har inga kontakter), discipliner, och bilduppladdning: den finns i SS först när gruppen finns (`!isNew && form.id`), och ramverket
  säger det med en rad text i stället för en uppladdning som inte kan fungera. Avatar i medlemsraderna saknas (adresserna har inget konto än).
