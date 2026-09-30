# Meddelanden 0.34.0: ramverkets inkorg, samtal och Nytt meddelande mot SessionStudio

CP 2026-09-30 08:12 i #182, och beslut 1 till 4 samma dag: ett meddelande till en person är privat och en standardfunktion i
ramverket, och chatt, meddelanden och Assistent-tråden är EN modell. #182 hänvisar till SessionStudio (ChatInboxPanel och
NewMessage/DM-flödet i `cllp/sessions-platform`), alltså gäller regel 12.

Bilderna (vänster ramverket, höger SS):

| Fil | Vad |
|---|---|
| `inkorg-390-ramverk-ss.png` | listan på telefon |
| `samtal-390-ramverk-ss.png` | ett privat samtal på telefon, efter ett tryck på raden |
| `inkorg-1280-ramverk-ss.png` | listan och samtalet bredvid varandra på dator |
| `nytt-meddelande-390-ramverk-ss.png` | Nytt meddelande på telefon |
| `nytt-meddelande-1280-ramverk-ss.png` | Nytt meddelande på dator |

Ramverkets sida är Playwright mot den byggda `dist` (`check-skalyta --bilder`, scenen `meddelanden`, ljust tema, samma
exempeldata som avsnitt 29 mäter).

⛔ **Ärlig anmärkning om förebilden.** SessionStudio-appen går inte att köra här (den kräver Firebase). SS-sidan är **renderad ur
SS-källan**: markup och klasser ur `ChatInboxPanel.jsx:698-760` och `:957-1150`, `chatPanel/ChatPanelHeader.jsx`,
`chatPanel/MessageBubble.jsx:126-205`, `chatPanel/ComposerBar.jsx` och `DMPanel.jsx:230-285`, kompilerade med Tailwind och samma
ljusa färgfixtur som montagen 0.32.0 (plus SS bubbelfärger). Det är SS klasser och inte en skärmbild av SS-appen, SS skal
(huvud, gruppanel, bottenrad) finns inte på SS-sidan, och Tailwind 4 här har andra förval än SS Tailwind 3. Ikonerna på SS-sidan
är ritade för hand efter Lucide.

## Vad som nu matchar (mätt i `check-skalyta` avsnitt 29, 390 och 1280 px)

| SS | Ramverket | Mått |
|---|---|---|
| Listan till vänster `sm:w-[35%] sm:min-w-[220px] sm:max-w-[40%]`, samtalet `flex-1` till höger (`:959`, `:1194`) | samma, från `md` | 34,5 procent av ytan (35 av innehållet innanför `p-2`), 367 px vid 1280 |
| Två kort på sidans bakgrund med `sm:gap-2 sm:p-2` (`:957`) | samma | 8 px mellan listan och samtalet |
| Telefon: listan är hela sidan, ett valt samtal ersätter den med "‹ Tillbaka" överst (`:880-892`) | samma | listan hela bredden och samtalet dolt, sedan tvärtom |
| Filtret Alla / Olästa som ett litet segment med antalet olästa i hörnet (`:968-1000`) | samma, med `OpsCountBadge` | etikett 10 px |
| Sökfältet med förstoringsglas, 11 px (`:1065-1085`) | samma, `text-hjalp` (11 px) | |
| Raden: märke, namn 14 px/500, tid, etikett för slaget, utdrag 12 px med avsändaren först, räknaren i märkets hörn (`:698-760`) | samma ordning och storlekar | namn 14/500, utdrag 12, räknaren inom 6 px från märkets hörn |
| Namnet mörkare när det finns olästa (`:735`) | samma | |
| Samtalets huvud: märke, namn, en rad under (`ChatPanelHeader.jsx:32-38`) | samma | |
| Bubblor `rounded-2xl px-3.5 py-2`, egna till höger i accentfärg, andras till vänster med avatar 32 px på första i en följd, `max-w-[70%]`, tid under (`MessageBubble.jsx:126-205`) | samma | rundning 24 (16 vid fortsättning), egna mot högerkanten, andras mot vänster |
| Andras bubblor har en egen yta (`--color-chat-bubble-other-bg`) | `bg-hover` | ytan skiljer sig från samtalets bakgrund, mätt |
| Datumavdelaren som ett litet piller (`ChatDateDivider.jsx`) | samma, "I dag" | |
| Skrivfältet längst ned med en rund Skicka-knapp (`ComposerBar.jsx`) | samma | längst ned i samtalsytan; på telefon ovanför bottenraden |
| Enter skickar, Skift plus Enter bryter raden | samma | provat i `meddelanden.test.jsx` |

## Vad som fortfarande skiljer sig

- **"Nytt meddelande" är en panel, inte en dialog.** SS öppnar en `w-80`-dialog "Ny konversation" över direktmeddelandepanelen,
  väljer en person, och skriver sedan i samtalet (`DMPanel.jsx:230-285`). Ramverket har skapa-panelen (0.31.0: "paneler i stället
  för modaler precis som i sessionstudio") med Till och texten i samma formulär, och raden "Bara ni två ser det här." mellan dem.
  Det är CP:s egen formulering från #182 F2 ("mottagare (en person, krävs) och text"), inte SS flöde.
- **SS väljare har sökning och e-post under namnet.** Ramverkets `OpsMottagare` listar alla aktiva personer utan sökfält och utan
  e-post (e-posten lämnar aldrig `users`, se README). Med fler än ett tjugotal i en grupp behövs sökningen.
- **Märket i listan.** SS har en 40 px rundad ruta i samtalets färg med en ikon (person, grupp) för alla slag. Ramverket har 36 px
  (`OpsIdentity size="md"`): personens avatar med initialer i en cirkel för ett privat samtal, gruppens märke för gruppchatten.
- **Etiketten.** SS skriver "Direktmeddelande" i samtalets färg. Ramverket skriver "Privat" med ett hänglås, eftersom det är det
  CP bad om att se (beslut 1), och "Grupp" för gruppchatten.
- **Huvudets rad.** SS visar "Senast aktiv i dag". Ramverket har ingen närvaro (avgränsat i 0.34.0) och visar i stället vem som ser
  samtalet: "Bara ni två ser det här", "Alla i gruppen ser det här" eller "Bara du och agenten ser det här".
- **Storlekar.** Ramverkets roller, inte SS pixlar (`check-typografi`): tiden och etiketten 10 px i stället för 9, bubblans text
  14 px i stället för 13. Rundningen är ramverkets `rounded-xl` (20 px) på korten, SS 12.
- **Träffytor.** Knappen Skicka och skrivfältet är 44 px (SS 36 px knapp). Filtersegmentet är 32 px högt, som SS lilla segment och
  under ramverkets 44: det är den enda ytan i vyn under 44, och den står i listan för en senare rättelse.
- **Saknas i ramverket:** favoriter, arkiv, tidigare sessioner, tystade samtal, grupptillhörighet på sessionschattar, reaktioner,
  svar i tråd, fästa meddelanden, redigering, bilagor, e-post och SMS i samtalet, läskvitton, "skriver nu" och sidopanelen med
  samtalets info. Alla är SS domän eller avgränsade i 0.34.0 (CHANGELOG).
- **Gruppanelen och huvudet** runt inkorgen är ramverkets skal (på SS-sidan finns inget skal), och på dator är samtalsytan därför
  smalare än SS: gruppanelen tar sin kolumn till vänster.
