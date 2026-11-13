import { cloneElement, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { webblasarensIgenkanning } from "../lib/talk.js";
import { OpsSprakProvider, useOpsSprak } from "./OpsSprak.jsx";
import { forvalda, ordet } from "../lib/ord.js";
import { cx } from "../lib/cx.js";
import { formatDateTime, formatTime, formatRelativeDate } from "../lib/format.js";
import { KOMMENTARBILAGA_TYPER, MAX_KOMMENTARBILAGA, bilagaUrDokument, kommentarbilagaFel } from "../lib/handelsemodell.js";
import { readAttachment } from "../lib/file.js";
import { arGastId } from "../lib/gast.js";
import { AGENTSTATUS_MAX_ALDER, MAX_ALTERNATIV, MAX_ALTERNATIVTEXT, MAX_ALTERNATIV_VID_START, MAX_FRAGA, MAX_MEDDELANDE, MAX_TRADNAMN, MIN_ALTERNATIV_VID_START, RAKNARE_FRAN, REAKTIONSKODER, agentstatus, arDelatSamtal, projekttaggUr, jamforbar, summeraOmrostning, amnesrubrik, bilagenyckel, delaSamtalsnyckel, samtalsdeltagare, samtalsnyckel, summeraReaktioner, synligText, tradensNamn } from "../lib/samtal.js";
import { useSamtal } from "../data/useSamtal.jsx";
import { harAmnen, harBilagor, harCitat, harFasta, harOmnamnanden, harOmrostningar, harProjekt, harReaktioner, harStatus, harTradar, harTyst } from "../data/samtalskalla.js";
import { BilagaVisning } from "./BilagaVisning.jsx";
import { KopieraBilagaKnapp } from "./BilageKopiering.jsx";
import { CHATTINFO_TEXTER, ORD_CHATTINFO, OpsChattinfo } from "./OpsChattinfo.jsx";
import { OpsTooltip } from "./OpsTooltip.jsx";
import { OpsMarkdown } from "./OpsMarkdown.jsx";
import { splitInline, utanLankar } from "../lib/markdown.js";
import { OpsBanner } from "./OpsBanner.jsx";
import { OpsIdentity } from "./OpsIdentity.jsx";
import { NAMN_SAKNAS } from "../lib/personnamn.js";
import { namnMedVia } from "../lib/skapare.js";
import { usePersonnamn } from "./usePersonnamn.js";
import { OpsIconLink } from "./OpsIconLink.jsx";
import { OpsSpinner } from "./OpsSpinner.jsx";
import { arInstallningslage } from "../lib/apparark.js";
import { ModulLageKnapp, OpsModulRam, kravRam } from "./OpsModulRam.jsx";
import { OpsHubTillbaka, OpsVyAtgard, VYHUVUD_KLASS, VYIKON_KLASS, VYRUBRIK_KLASS } from "./OpsTillbaka.jsx";
import { OpsMottagare } from "./OpsMottagare.jsx";
import { OpsSkapaRubrik } from "./OpsSkapaRubrik.jsx";
import { OpsCountBadge } from "./counter.jsx";
import { Mikrofonknapp, Rostyta, useRostfokus, useRostinmatning } from "./OpsRostinmatning.jsx";
import { REAKTIONSVY, reaktionsnamnPa } from "./reaktionsvy.js";
import { OpsForslag } from "./OpsForslag.jsx";
import { forslagUrData } from "../lib/forslag.js";
import { rapporteraFel } from "../lib/felrapport.js";
import { useTangentbordTackt } from "../lib/tangentbord.js";
import { OpsAtgardsblad } from "./OpsAtgardsblad.jsx";
import { LANGTRYCK_KLASS, useLangtryck } from "./useLangtryck.js";
import { AgentIkon, AndraIkon, BockIkon, KopieraIkon, OmrostningIkon, ArkiveraIkon, TaFramIkon, BildIkon, FastIkon, FilIkon, KameraIkon, MappIkon, MejlIkon, NotisIkon, PanelIkon, StoppIkon, TystIkon, ChevronHogerIkon, ChevronNedIkon, CiteraIkon, ChevronVansterIkon, GruppIkon, KryssIkon, LasIkon, LeendeIkon, MeddelandeIkon, PlusIkon, SkickaIkon, SokIkon, TradIkon } from "./icons.jsx";

/**
 * Meddelanden: inkorgen med gruppchatten och de privata samtalen, och samtalet bredvid (0.34.0, #182, #185).
 *
 * ══ ⛔ SS ChatInboxPanel ÄR FÖREBILDEN (regel 12) ══════════════════════════════════════════════════
 *
 * `cllp/sessions-platform` `apps/web/src/components/ChatInboxPanel.jsx`: på dator en lista till vänster (35 procent,
 * minst 220 px, högst 40, `:959`) och samtalet till höger (`:1194`), båda som kort med rundade hörn på sidans bakgrund
 * (`sm:gap-2 sm:p-2`, `:957`). På telefon är listan hela sidan, och ett valt samtal ersätter den med en rad
 * "‹ Tillbaka" överst (`:880-892`). Överst i listan: filtret Alla / Olästa (`:968-1000`) och sökningen (`:1065-1085`).
 * En rad (`:698-760`): en ruta på 40 px med samtalets ikon, räknaren i dess hörn, namnet (fetare när det finns
 * olästa), tiden, en etikett för slaget och det senaste meddelandet med avsändaren först.
 *
 * ⛔ STORLEKARNA ÄR RAMVERKETS ROLLER, INTE SS PIXLAR (check-typografi). SS 9 px (tid, etikett) blir 10 (`text-liten`),
 * 11 px (sökningen) blir `text-hjalp`, bubblans 13 px blir 14 (`text-etikett`). Jämförelsen står i
 * `docs/jamforelser/0.34.0/jamforelse.md`.
 *
 * ⛔ ANDRAS BUBBLOR, DEN VALDA RADEN OCH ETIKETTEN GRUPP ÄR `bg-hover`, INTE `bg-raised`. I det ljusa temat är `raised` samma färg
 * som `surface` (tokens.css), så en bubbla i `raised` på samtalets yta hade varit text utan bubbla. Upptäckt i montaget mot SS,
 * där `--color-chat-bubble-other-bg` skiljer sig från ytan, och mätt i check-skalyta avsnitt 29.
 *
 * ⛔ DET PRIVATA SYNS. Ett privat samtal bär etiketten "Privat" i listan och raden "Bara ni två ser det här" i huvudet.
 *
 * ⛔ "NYTT MEDDELANDE" LÄMNAR ALDRIG MEDDELANDEN (0.63.0, #263). CP 2026-10-06 11:22, med en skärminspelning från LifeHub: "steget
 * med att öppna en liten chattfönster till är lite konstigt", och "Chatten dök upp långt senare...". Knappen öppnade skalets
 * skapa-panel, som dolde hela vyn, och tråden ritades bara när samtalet fanns bland raderna, som lästes om först vid nästa
 * `focus`. Förebilden är SS: man väljer en person i inkorgen (`ChatInboxPanel.jsx:1091-1124`), samtalet öppnas eller skapas
 * (`ensureDMConversation`, `:477-505`), och tråden ritas på det VALDA samtalet (`:186-191`, `DMPanel.jsx:95-97`). Här:
 *   - läget "nytt" i högerpanelen, med Till överst och trådens skrivfält längst ned, och listan kvar till vänster;
 *   - valet i Till öppnar samtalet direkt med `oppnaPrivat`. Finns det redan öppnas det, med sin historik;
 *   - tråden ritas på `valdId`. Saknas raden läses gruppen och paret ur nyckeln (`delaSamtalsnyckel`), och rubriken ur
 *     medlemmarna;
 *   - raden läggs in i listan lokalt (`laggIn`) efter öppnandet och efter Skicka, och listan läses sedan om.
 *
 * ⛔ TRÅDAR I GRUPPCHATTEN (0.68.0, cllp/lifehub.app#60). CP 2026-10-06: "Vore ju snyggt om gruppen i gruppchatt kan starta en
 * tråd och när som helst blanda in en agent som är med i tråden för alla." Under varje meddelande i gruppchatten står "Svara i
 * tråd", eller, när tråden finns, ett märke med antal svar och trådens namn. Tråden öppnas i högerpanelen i stället för chatten,
 * med en rad tillbaka till gruppchatten överst, rotmeddelandet först, svaren och samma skrivfält. Listan står kvar till vänster
 * på dator. Namnet härleds ur rotmeddelandet (`tradensNamn`) och går att döpa om. Tråden skapas först med det första svaret, så
 * ett "Svara i tråd" som ångras lämnar ingen tom tråd. Inget läsmärke och ingen notis per tråd i första skivan (regel 13).
 *
 * ⛔ ETT SAMTAL ÄR EN MODELL (CP:s beslut 4). Gruppchatten, ett privat samtal och ett agentsamtal ritas av samma vy;
 * skillnaden är huvudets rad och vilka namn som skrivs ut.
 */

/**
 * @typedef {object} Medlemsrad
 * @property {string} userId
 * @property {string} [namn]
 * @property {string} [bild]
 * @property {string} [typ]
 * @property {string} [status]
 */

/**
 * Appens väg till ett meddelande (lifehub.app#712). Ramverket känner aldrig appens rutter: appen bygger adressen. Ger den en sträng har meddelandets meny
 * "Kopiera länk" (en relativ adress görs absolut mot sidans adress); ger den `null` eller inget, eller saknas funktionen, finns inte raden.
 * `samtalId` saknas i gästens chatt (en chatt, inget val), `tradId` finns när meddelandet står i en tråd.
 *
 * @typedef {(arg: { meddelandeId: string, samtalId?: string, tradId?: string }) => (string | null | undefined)} MeddelandeHref
 */

/**
 * @typedef {object} Meddelandetexter
 * @property {string} [rubrik] Förval "Meddelanden".
 * @property {string} [nytt] Förval "Nytt meddelande".
 * @property {string} [alla] Förval "Alla".
 * @property {string} [olasta] Förval "Olästa".
 * @property {string} [sok] Förval "Sök i meddelanden".
 * @property {string} [rensaSok] Förval "Rensa sökningen".
 * @property {string} [tomt] Förval "Inga samtal än".
 * @property {string} [tomtOlasta] Förval "Inget oläst".
 * @property {string} [ingenTraff] Förval "Ingen träff".
 * @property {string} [valjSamtal] Förval "Välj ett samtal".
 * @property {string} [tillbaka] Förval "Tillbaka".
 * @property {string} [grupp] Etiketten för gruppchatten. Förval "Grupp".
 * @property {string} [privat] Förval "Privat".
 * @property {string} [agent] Förval "Agent".
 * @property {string} [privatRad] Förval "Bara ni två ser det här".
 * @property {string} [gruppRad] Förval "Alla i gruppen ser det här".
 * @property {string} [agentRad] Förval "Bara du och agenten ser det här".
 * @property {string} [oppnaInstallningar] (0.90.0) Efterled i knappens namn. Förval "öppna inställningar".
 * @property {string} [inga] Förval "Inga meddelanden än".
 * @property {string} [skriv] Förval "Skriv ett meddelande".
 * @property {string} [skicka] Förval "Skicka".
 * @property {string} [du] Förval "Du".
 * @property {string} [olastaText] Substantivet efter räknarens siffra. Förval "olästa".
 * @property {string} [fel] Förval "Meddelandena kunde inte hämtas".
 * @property {string} [skickaFel] (0.107.0) Rubriken när ett meddelande inte gick att skicka. Förval "Meddelandet kunde inte skickas".
 * @property {string} [till] Mottagarväljarens etikett i läget "nytt". Förval "Till".
 * @property {string} [valjMottagare] Felet när man skickar i läget "nytt" utan att ha valt någon. Förval "Välj vem meddelandet ska till.".
 * @property {string} [oppnaFel] Rubriken när samtalet inte kunde öppnas. Förval "Samtalet kunde inte öppnas".
 * @property {string} [ingenAnnan] När det inte finns någon att skriva till. Förval "Det finns ingen annan i gruppen att skriva till.".
 * @property {string} [helaGruppen] (0.68.0) Raden under Till som öppnar gruppchatten. Förval "Hela gruppen".
 * @property {string} [gruppTom] (0.68.0) Gruppchattens tomma läge. Förval "Alla i gruppen ser det som skrivs här.".
 * @property {string} [projekt] (0.215.0, lifehub.app#760) Etiketten för ett projekts chatt. Förval "Projekt".
 * @property {string} [projektRad] (0.215.0) Förval "Gruppen och projektets gäster ser det här".
 * @property {string} [projektTom] (0.215.0) Projektchattens tomma läge. Förval "Gruppen och projektets gäster ser det som skrivs här.".
 * @property {string} [skrivProjekt] (0.215.0) Platstexten i projektets chatt. Förval "Skriv till projektet".
 * @property {string} [oppnarProjekt] (0.215.0) Medan projektets chatt öppnas första gången. Förval "Öppnar projektets chatt…".
 * @property {string} [oppnarGrupp] (0.68.0) Medan gruppchatten öppnas första gången. Förval "Öppnar gruppchatten…".
 * @property {string} [svaraITrad] (0.68.0) Förval "Svara i tråd".
 * @property {string} [lyftTillMinnet] (0.86.0) Förval "Lyft till minnet". Knappen ritas bara när `onLyftTillMinnet` skickas in.
 * @property {string} [minnet] (0.86.0) Länken till minnesvyn. Förval "Minnet". Ritas bara när `minneHref` skickas in.
 * @property {string} [lyftMisslyckades] (0.86.0) Rubriken när lyftet nekas. Förval "Raden lyftes inte".
 * @property {string} [svar] (0.68.0) Substantivet efter antalet i trådens märke. Förval "svar".
 * @property {string} [tradRad] (0.68.0) Förval "Alla i gruppen ser tråden".
 * @property {string} [tradFel] (0.68.0) Förval "Tråden kunde inte hämtas".
 * @property {string} [ingaSvar] (0.68.0) Förval "Inga svar än. Skriv det första.".
 * @property {string} [dopOm] (0.68.0) Förval "Döp om".
 * @property {string} [tradnamn] (0.68.0) Namnfältets etikett. Förval "Trådens namn".
 * @property {string} [spara] (0.68.0) Förval "Spara".
 * @property {string} [avbryt] (0.68.0) Förval "Avbryt".
 * @property {string} [automatisktNamn] (0.68.0) Förval "Använd det automatiska namnet".
 * @property {string} [rotSaknas] (0.68.0) När meddelandet tråden startades ur inte går att läsa. Förval "Meddelandet tråden startades ur går inte att läsa.".
 * @property {string} [tradarFel] (0.68.0) En diskret rad när trådarnas märken inte kunde läsas. Förval "Trådarna kunde inte hämtas.".
 * @property {string} [tradHamtas] (0.91.0, #282) Okänt trådläge, innan svaret kommit. Förval "Tråden hämtas".
 * @property {string} [svarPa] (0.68.0) Förled för skärmläsaren: vems meddelande "Svara i tråd" gäller. Förval "Meddelande från".
 * @property {string} [senasteSvar] (0.203.0) Förled för skärmläsaren före trådens senaste svar under märket. Förval "Senaste svaret från".
 * @property {string} [skickas] (0.203.0) Under ett eget svar i tråden tills det kommit tillbaka ur källan. Förval "Skickas…".
 * @property {string} [visaAldre] (chattens nattskiva) Knappen överst i loggen. Förval "Visa äldre".
 * @property {string} [hamtarAldre] Förval "Hämtar äldre…".
 * @property {string} [ingaAldre] När samtalets början är nådd. Förval "Inga äldre meddelanden".
 * @property {string} [aldreFel] Förval "Äldre meddelanden kunde inte hämtas.".
 * @property {string} [reagera] (chattens nattskiva) Knappen som öppnar reaktionerna. Förval "Reagera".
 * @property {string} [valjReaktion] Gruppens namn för skärmläsaren. Förval "Välj en reaktion".
 * @property {string} [duHarReagerat] Läggs till i en reaktions namn när den är din. Förval "du har reagerat".
 * @property {string} [kopiera] (0.106.0, #386) Posten i meddelandets meny på telefon. Förval "Kopiera".
 * @property {string} [kopierat] Raden efter en lyckad kopiering. Förval "Kopierat".
 * @property {string} [kopieraFel] När webbläsaren inte släpper in urklippet. Förval "Texten kunde inte kopieras.".
 * @property {string} [kopieraLank] (lifehub.app#712) Posten "Kopiera länk" i meddelandets meny. Ritas bara när appen skickar in `meddelandeHref`. Förval "Kopiera länk".
 * @property {string} [lankKopierad] Raden efter en lyckad "Kopiera länk". Förval "Länken är kopierad".
 * @property {string} [kopieraLankFel] När länken inte kunde kopieras. Förval "Länken kunde inte kopieras.".
 * @property {string} [dittMeddelande] Menyns namn för ett eget meddelande. Förval "Ditt meddelande".
 * @property {string} [reaktionFel] Förval "Reaktionen kunde inte sparas.".
 * @property {string} [reaktionerFel] Förval "Reaktionerna kunde inte hämtas.".
 * @property {string} [reaktionerFler] När läsningen nådde sitt tak. Förval "Äldre reaktioner visas inte.".
 * @property {string} [omrostning] (cllp/lifehub.app#438) Raden i pluset som öppnar formuläret. Förval "Omröstning".
 * @property {string} [nyOmrostning] Formulärets rubrik. Förval "Ny omröstning".
 * @property {string} [omrostningFraga] Fältet för frågan. Förval "Fråga".
 * @property {string} [omrostningFragaPlats] Platstexten i frågans fält. Förval "Ställ en fråga".
 * @property {string} [omrostningAlternativ] Ett alternativs fält i formuläret, med numret. Förval "Alternativ {n}".
 * @property {string} [laggTillAlternativ] Knappen i formuläret och sista raden i kortet. Förval "Lägg till alternativ".
 * @property {string} [nyttAlternativ] Fältet för ett alternativ som läggs till i kortet. Förval "Nytt alternativ".
 * @property {string} [omrostningRostat] Raden under kortets alternativ. Förval "{n} har röstat".
 * @property {string} [omrostningRost] Antalet för ett alternativ, en röst. Förval "{n} röst".
 * @property {string} [omrostningRoster] Antalet för ett alternativ, noll eller flera röster. Förval "{n} röster".
 * @property {string} [duHarRostat] Läggs till i alternativets namn när det är ditt val. Förval "du har röstat".
 * @property {string} [omrostningUtanAlternativ] Ett kort utan alternativ: tomt sägs, det utelämnas inte. Förval "Inga alternativ än.".
 * @property {string} [omrostningBehoverFraga] Formuläret utan fråga. Förval "Skriv en fråga.".
 * @property {string} [omrostningBehoverTva] Formuläret med färre än två alternativ. Förval "Skriv minst två alternativ.".
 * @property {string} [alternativFinns] Formuläret med en dubblett. Förval "Två alternativ har samma text.".
 * @property {string} [alternativFinnsRedan] Kortet, när ett nytt alternativ redan finns. Förval "Alternativet finns redan.".
 * @property {string} [omrostningForLang] En fråga eller ett alternativ över taket. Förval "Högst {max} tecken.".
 * @property {string} [omrostningSkickaFel] När källan nekade omröstningen. Förval "Omröstningen kunde inte skickas.".
 * @property {string} [omrostningFel] När en röst nekades. Förval "Rösten kunde inte sparas.".
 * @property {string} [alternativFel] När ett nytt alternativ nekades. Förval "Alternativet kunde inte läggas till.".
 * @property {string} [omrostningarFel] I kortet, när läsningen av dess alternativ eller röster föll (#742). Förval "Omröstningen kunde inte hämtas.".
 * @property {string} [omrostningarFler] I kortet, när omröstningen har fler alternativ eller röster än dess tak (#742). Förval "Alla röster och alternativ i omröstningen visas inte.".
 * @property {Partial<Record<(typeof REAKTIONSKODER)[number], string>>} [reaktionsnamn] Reaktionernas namn för skärmläsaren. Förval: svenska, eller engelska när `sprak` är "en" (`reaktionsvy.js`).
 * @property {string} [allaNamn] (chattens nattskiva) Förslaget som nämner hela gruppen. Förval "alla".
 * @property {string} [namnForslag] @-listans namn för skärmläsaren. Förval "Nämn någon".
 * @property {string} [citera] (chattens nattskiva) Förval "Svara med citat".
 * @property {string} [svararPa] Raden ovanför skrivfältet. Förval "Svarar på".
 * @property {string} [avbrytCitat] Förval "Avbryt citatet".
 * @property {string} [citatSaknas] När det citerade meddelandet inte går att läsa. Förval "Meddelandet går inte att läsa.".
 * @property {string} [sokISamtalet] Förval "Sök i samtalet".
 * @property {string} [stangSok] Förval "Stäng sökningen".
 * @property {string} [nastaTraff] Förval "Nästa träff".
 * @property {string} [forraTraff] Förval "Föregående träff".
 * @property {string} [ingenTraffLaddade] Förval "Ingen träff bland de laddade meddelandena.".
 * @property {string} [sokOmfang] Hur långt sökningen når. `{n}` byts mot antalet. Förval "Söker bland de {n} laddade meddelandena. Visa äldre för att söka längre bak.".
 * @property {string} [fast] (chattens nattskiva) Förval "Fäst".
 * @property {string} [lossa] Förval "Lossa".
 * @property {string} [fastaRubrik] `{n}` byts mot antalet. Förval "{n} fästa".
 * @property {string} [fastaFel] Förval "Fästa meddelanden kunde inte hämtas.".
 * @property {string} [fastFel] Förval "Fästningen kunde inte sparas.".
 * @property {string} [fastaFler] Förval "Äldre fästningar visas inte.".
 * @property {string} [skrivGrupp] (chattens nattskiva) Platstexten i gruppchatten. Förval "Skriv till gruppen".
 * @property {string} [skrivAgent] Platstexten i agentsamtalet. Förval "Fråga agenten".
 * @property {string} [skrivTrad] Platstexten i en tråd. Förval "Svara i tråden".
 * @property {string} [bifoga] Plusknappen. Förval "Bifoga".
 * @property {string} [bifogaBild] Förval "Bifoga bild".
 * @property {string} [taFoto] Förval "Ta foto".
 * @property {string} [valjFil] Förval "Välj fil".
 * @property {string} [franBiblioteket] (0.164.0, lifehub.app#226) Plusmenyns rad mot Biblioteket. Förval "Lägg till från Biblioteket".
 * @property {string} [sokBiblioteket] Förval "Sök i Biblioteket".
 * @property {string} [bibliotekTomt] Förval "Inget i Biblioteket matchar.".
 * @property {string} [bibliotekLaddar] Förval "Hämtar Biblioteket …".
 * @property {string} [gast] (0.132.0) Märket vid en gästs meddelande, och namnet på en gäst som saknar namn. Förval "Gäst".
 * @property {string} [bilagaText] (0.77.0, #292) Förled i bildens alt-text. Förval "Bilaga från".
 * @property {string} [taBortBilaga] Förval "Ta bort bilagan".
 * @property {string} [enBilaga] När flera filer valdes. Förval "Ett meddelande bär en bilaga. Välj en fil.".
 * @property {string} [bilagaGarInteAttSkicka] (0.213.0) När den valda filen inte klarar prövningen. `{skal}` byts mot skälet. Förval "Bilagan går inte att skicka: {skal}".
 * @property {string} [enBilagaRedan] (0.213.0, lifehub.app#751) När en bilaga redan väntar och en till väljs. Förval "Ett meddelande bär en bilaga. Skicka den här först, eller ta bort den och välj en annan.".
 * @property {string} [bilagaTrasig] När en lagrad bilaga inte klarar prövningen. Förval "Bilagan går inte att visa.".
 * @property {string} [bilagaKundeInteHamtas] (0.213.0, lifehub.app#751) När bilagan inte gick att läsa, efter omförsöken. Förval "Bilagan kunde inte hämtas.".
 * @property {string} [forsokIgen] (0.213.0) Knappen bredvid den raden. Förval "Försök igen".
 * @property {string} [prataIn] Mikrofonen i vila. Förval "Prata in".
 * @property {string} [stoppaAgenten] Förval "Stoppa agenten".
 * @property {string} [talKlar] (0.103.0) Namnet Klar läses upp med i inspelningsytan. Förval "Klar, skicka det du sagt".
 * @property {string} [talSkickar] (0.103.0) Ytans statusrad medan det sagda skickas. Förval "Skickar…".
 * @property {string} [skriverUt] Ytans statusrad medan appens `onTranscribe` skriver ut ljudet. Förval "Skriver ut det inspelade…".
 * @property {string} [transkriptionFel] Förval "Det inspelade kunde inte skrivas ut.".
 * @property {string} [talSkickaFel] (0.103.0) När det sagda inte gick att skicka. Förval "Det du sa kunde inte skickas.".
 * @property {string} [talTextFel] (0.103.0) När taligenkänningen föll medan man pratar. Förval "Texten kan inte visas just nu. Det du säger spelas in ändå och skrivs ut när du trycker Klar.".
 * @property {string} [talIngenUtskrift] (0.104.0) Tillägg till `transkriptionFel` när appen inte gav `onTranscribe`. Förval "Ingen utskrift finns.".
 * @property {string} [talIngetHordes] (0.104.0) Tillägg till `transkriptionFel` när utskriften blev tom. Förval "Inget hördes i det inspelade.".
 * @property {string} [postkortFel] (chattens nattskiva) När appens uppslag av en länk föll. Förval "Länken kunde inte slås upp.".
 * @property {string} [agentTanker] (#273) Förval "Agenten tänker".
 * @property {string} [agentSkriver] (#273) Förval "Agenten skriver".
 * @property {string} [agentFastnat] (#273) När statusen är äldre än två minuter. Förval "Agenten har inte svarat på två minuter. Skriv igen om du fortfarande väntar.".
 * @property {string} [agentstatusFel] (#273) När statusen inte kunde läsas, eller inte har statusens form. Förval "Agentens status kunde inte läsas.".
 * @property {string} [mejl] (0.80.0, #301) Förval "Mejl".
 * @property {string} [tystaNotiser] Förval "Tysta notiser".
 * @property {string} [notiserTysta] Förval "Notiser är tysta".
 * @property {string} [chattinfo] Förval "Chattinfo".
 * @property {string} [stangChattinfo] Förval "Stäng chattinfo".
 * @property {string} [medlemmar] Förval "Medlemmar".
 * @property {string} [bilder] Förval "Bilder".
 * @property {string} [dokument] Förval "Dokument".
 * @property {string} [lankar] Förval "Länkar".
 * @property {string} [ingaMedlemmar]
 * @property {string} [ingaBilder]
 * @property {string} [ingaDokument]
 * @property {string} [ingaLankar]
 * @property {string} [hamtarBilaga]
 * @property {string} [hamtarBilagor]
 * @property {string} [bilagorFler]
 * @property {string} [bilagorFel]
 * @property {string} [lankarUrLaddade]
 * @property {string} [aldreLankar]
 * @property {string} [nyttSamtal] (0.106.0, #386) Knappen och det nya ämnets rubrik innan något skickats. Förval "Nytt samtal".
 * @property {string} [gruppensAgent] Raden under agentens namn. Förval "gruppens agent".
 * @property {string} [antalSamtal] `{n}` byts mot antalet. Förval "{n} samtal".
 * @property {string} [senast] Förled till tiden. Förval "senast".
 * @property {string} [ingaSamtalAgent] Förval "Inga samtal än. Börja ett nytt.".
 * @property {string} [samtalUtanText] Ett ämnes rubrik när ingen text finns att härleda den ur. Förval "Samtal utan text".
 * @property {string} [samtalMed] Agentlistans namn för skärmläsaren. `{namn}` byts mot agentens namn. Förval "Samtal med {namn}".
 * @property {string} [arkivera] Förval "Arkivera".
 * @property {string} [taFram] Förval "Ta fram".
 * @property {string} [visaArkiverade] Förval "Visa arkiverade".
 * @property {string} [doljArkiverade] Förval "Dölj arkiverade".
 * @property {string} [ingaArkiverade] Förval "Inga arkiverade samtal.".
 * @property {string} [arkivFel] Förval "Samtalet kunde inte arkiveras.".
 * @property {string} [langd] (0.106.0, #386 skiva 5) Räknaren nära taket. `{n}` och `{max}` byts. Förval "{n} av {max} tecken".
 * @property {string} [forLang] (0.106.0) Raden när texten är över taket. `{over}` byts. Förval "Texten är {over} tecken för lång. Korta den för att skicka.".
 * @property {string} [tillSenaste] (0.106.0, #386 skiva 4) Knappen när man läser bakåt. Förval "Till senaste".
 * @property {string} [nyaMeddelanden] `{n}` byts mot antalet nya sedan man lämnade slutet. Förval "{n} nya".
 * @property {string} [nyttSedanSist] Avdelaren i loggen, härledd ur läsmärket. Förval "Nytt sedan sist".
 * @property {string} [annatSkickas] (0.106.0, #385) Felet i röstytan när ett annat meddelande skickas. Förval "Ett annat meddelande skickas just nu.".
 * @property {string} [ingenText] (0.106.0, #385) Felet i röstytan när inget hördes att skicka. Förval "Det finns ingen text att skicka.".
 * @property {string} [sokPlats] (0.106.0, #385) Platsen i sökningen. `{i}` och `{n}` byts. Förval "{i} av {n}".
 * @property {string} [arkiveratRad] Raden i ett arkiverat ämne. Förval "Arkiverat. Det syns inte i listan förrän du tar fram det.".
 */

/**
 * ⛔ CHATTENS RÖST-ORD PÅ BÅDA SPRÅKEN (0.104.0, granskningen av PR 384, MÅSTE 1). När TALK:s yta fick engelska ord blev det synliga
 * ordet på Klar "Done" i en engelsk chatt, medan namnet som lästes upp var det svenska "Klar, skicka det du sagt". Det synliga
 * ordet och namnet ska stämma, så chattens röst-ord står här på båda språken, och `texterPa` väljer dem på chattens språk. Den
 * svenska formen står bara här: `TEXTER` läser den härifrån (regel 2). Appens egna `texter` vinner som förut.
 *
 * Resten av chattens texter står i `ORD_MEDDELANDEN` nedan, på båda språken sedan 0.106.0 (#385, provet `chatt-sprak.test.jsx`).
 * @type {import("../lib/ord.js").Ordbok}
 */
const ORD_MEDDELANDEN_TAL = {
  prataIn: { sv: "Prata in", en: "Dictate" },
  stoppaAgenten: { sv: "Stoppa agenten", en: "Stop the agent" },
  talKlar: { sv: "Klar, skicka det du sagt", en: "Done, send what you said" },
  talSkickar: { sv: "Skickar…", en: "Sending…" },
  skriverUt: { sv: "Skriver ut det inspelade…", en: "Transcribing the recording…" },
  transkriptionFel: { sv: "Det inspelade kunde inte skrivas ut.", en: "The recording could not be transcribed." },
  talIngenUtskrift: { sv: "Ingen utskrift finns.", en: "No transcription is available." },
  talIngetHordes: { sv: "Inget hördes i det inspelade.", en: "Nothing was heard in the recording." },
  talSkickaFel: { sv: "Det du sa kunde inte skickas.", en: "What you said could not be sent." },
  talTextFel: { sv: "Texten kan inte visas just nu. Det du säger spelas in ändå och skrivs ut när du trycker Klar.", en: "The text can't be shown right now. What you say is still recorded and transcribed when you press Done." },
};

/**
 * Röst-orden på ett språk. Ett språk utan text ger svenska, som `ordet`.
 * @param {string} sprak
 * @returns {Pick<Required<Meddelandetexter>, "prataIn" | "stoppaAgenten" | "talKlar" | "talSkickar" | "skriverUt" | "transkriptionFel" | "talIngenUtskrift" | "talIngetHordes" | "talSkickaFel" | "talTextFel">}
 */
function talordPa(sprak) {
  return /** @type {any} */ (Object.fromEntries(Object.keys(ORD_MEDDELANDEN_TAL).map((k) => [k, ordet(ORD_MEDDELANDEN_TAL, k, sprak)])));
}

/**
 * ══ ⛔ CHATTENS ORD PÅ BÅDA SPRÅKEN (0.106.0, #385) ════════════════════════════════════════════════════════════════════════════
 *
 * Granskningen av PR 384, MÅSTE 1: i en chatt med `sprak="en"` stod "Skicka", "Skriv till gruppen", "Fäst", "Svara med citat" och
 * "Sök i samtalet" kvar på svenska, eftersom bara röst-orden (`ORD_MEDDELANDEN_TAL`) och reaktionernas namn hade en engelsk form.
 * Nu har varje nyckel i `Meddelandetexter` sin engelska form här, i samma form som röst-orden, och `texterPa` väljer språket före
 * appens egna `texter`. Den svenska formen står bara här: `TEXTER` läser den härifrån (regel 2).
 * @type {import("../lib/ord.js").Ordbok}
 */
const ORD_MEDDELANDEN = {
  rubrik: { sv: "Meddelanden", en: "Messages" },
  nytt: { sv: "Nytt meddelande", en: "New message" },
  alla: { sv: "Alla", en: "All" },
  olasta: { sv: "Olästa", en: "Unread" },
  sok: { sv: "Sök i meddelanden", en: "Search messages" },
  rensaSok: { sv: "Rensa sökningen", en: "Clear the search" },
  tomt: { sv: "Inga samtal än", en: "No conversations yet" },
  tomtOlasta: { sv: "Inget oläst", en: "Nothing unread" },
  ingenTraff: { sv: "Ingen träff", en: "No match" },
  valjSamtal: { sv: "Välj ett samtal", en: "Choose a conversation" },
  tillbaka: { sv: "Tillbaka", en: "Back" },
  grupp: { sv: "Grupp", en: "Group" },
  privat: { sv: "Privat", en: "Private" },
  agent: { sv: "Agent", en: "Agent" },
  oppnaInstallningar: { sv: "öppna inställningar", en: "open settings" },
  privatRad: { sv: "Bara ni två ser det här", en: "Only the two of you see this" },
  gruppRad: { sv: "Alla i gruppen ser det här", en: "Everyone in the group sees this" },
  agentRad: { sv: "Bara du och agenten ser det här", en: "Only you and the agent see this" },
  inga: { sv: "Inga meddelanden än", en: "No messages yet" },
  skriv: { sv: "Skriv ett meddelande", en: "Write a message" },
  skicka: { sv: "Skicka", en: "Send" },
  du: { sv: "Du", en: "You" },
  olastaText: { sv: "olästa", en: "unread" },
  fel: { sv: "Meddelandena kunde inte hämtas", en: "The messages could not be loaded" },
  skickaFel: { sv: "Meddelandet kunde inte skickas", en: "The message could not be sent" },
  till: { sv: "Till", en: "To" },
  valjMottagare: { sv: "Välj vem meddelandet ska till.", en: "Choose who the message is for." },
  oppnaFel: { sv: "Samtalet kunde inte öppnas", en: "The conversation could not be opened" },
  ingenAnnan: { sv: "Det finns ingen annan i gruppen att skriva till.", en: "There is no one else in the group to write to." },
  helaGruppen: { sv: "Hela gruppen", en: "The whole group" },
  gruppTom: { sv: "Alla i gruppen ser det som skrivs här.", en: "Everyone in the group sees what is written here." },
  oppnarGrupp: { sv: "Öppnar gruppchatten…", en: "Opening the group chat…" },
  projekt: { sv: "Projekt", en: "Project" },
  projektRad: { sv: "Gruppen och projektets gäster ser det här", en: "The group and the project's guests see this" },
  projektTom: { sv: "Gruppen och projektets gäster ser det som skrivs här.", en: "The group and the project's guests see what is written here." },
  skrivProjekt: { sv: "Skriv till projektet", en: "Write to the project" },
  oppnarProjekt: { sv: "Öppnar projektets chatt…", en: "Opening the project chat…" },
  svaraITrad: { sv: "Svara i tråd", en: "Reply in thread" },
  lyftTillMinnet: { sv: "Lyft till minnet", en: "Save to memory" },
  minnet: { sv: "Minnet", en: "Memory" },
  lyftMisslyckades: { sv: "Raden lyftes inte", en: "The line was not saved" },
  svar: { sv: "svar", en: "replies" },
  tradRad: { sv: "Alla i gruppen ser tråden", en: "Everyone in the group sees the thread" },
  tradFel: { sv: "Tråden kunde inte hämtas", en: "The thread could not be loaded" },
  ingaSvar: { sv: "Inga svar än. Skriv det första.", en: "No replies yet. Write the first." },
  dopOm: { sv: "Döp om", en: "Rename" },
  tradnamn: { sv: "Trådens namn", en: "Thread name" },
  spara: { sv: "Spara", en: "Save" },
  avbryt: { sv: "Avbryt", en: "Cancel" },
  automatisktNamn: { sv: "Använd det automatiska namnet", en: "Use the automatic name" },
  rotSaknas: { sv: "Meddelandet tråden startades ur går inte att läsa.", en: "The message the thread was started from cannot be read." },
  tradarFel: { sv: "Trådarna kunde inte hämtas.", en: "The threads could not be loaded." },
  tradHamtas: { sv: "Tråden hämtas", en: "Loading the thread" },
  svarPa: { sv: "Meddelande från", en: "Message from" },
  senasteSvar: { sv: "Senaste svaret från", en: "Latest reply from" },
  skickas: { sv: "Skickas…", en: "Sending…" },
  visaAldre: { sv: "Visa äldre", en: "Show older" },
  hamtarAldre: { sv: "Hämtar äldre…", en: "Loading older…" },
  ingaAldre: { sv: "Inga äldre meddelanden", en: "No older messages" },
  aldreFel: { sv: "Äldre meddelanden kunde inte hämtas.", en: "Older messages could not be loaded." },
  reagera: { sv: "Reagera", en: "React" },
  valjReaktion: { sv: "Välj en reaktion", en: "Choose a reaction" },
  duHarReagerat: { sv: "du har reagerat", en: "you reacted" },
  kopiera: { sv: "Kopiera", en: "Copy" },
  kopierat: { sv: "Kopierat", en: "Copied" },
  kopieraFel: { sv: "Texten kunde inte kopieras.", en: "The text could not be copied." },
  kopieraLank: { sv: "Kopiera länk", en: "Copy link" },
  lankKopierad: { sv: "Länken är kopierad", en: "The link is copied" },
  kopieraLankFel: { sv: "Länken kunde inte kopieras.", en: "The link could not be copied." },
  dittMeddelande: { sv: "Ditt meddelande", en: "Your message" },
  reaktionFel: { sv: "Reaktionen kunde inte sparas.", en: "The reaction could not be saved." },
  reaktionerFel: { sv: "Reaktionerna kunde inte hämtas.", en: "The reactions could not be loaded." },
  reaktionerFler: { sv: "Äldre reaktioner visas inte.", en: "Older reactions are not shown." },
  omrostning: { sv: "Omröstning", en: "Poll" },
  nyOmrostning: { sv: "Ny omröstning", en: "New poll" },
  omrostningFraga: { sv: "Fråga", en: "Question" },
  omrostningFragaPlats: { sv: "Ställ en fråga", en: "Ask a question" },
  omrostningAlternativ: { sv: "Alternativ {n}", en: "Option {n}" },
  laggTillAlternativ: { sv: "Lägg till alternativ", en: "Add option" },
  nyttAlternativ: { sv: "Nytt alternativ", en: "New option" },
  omrostningRostat: { sv: "{n} har röstat", en: "{n} voted" },
  omrostningRost: { sv: "{n} röst", en: "{n} vote" },
  omrostningRoster: { sv: "{n} röster", en: "{n} votes" },
  duHarRostat: { sv: "du har röstat", en: "you voted" },
  omrostningUtanAlternativ: { sv: "Inga alternativ än.", en: "No options yet." },
  omrostningBehoverFraga: { sv: "Skriv en fråga.", en: "Write a question." },
  omrostningBehoverTva: { sv: "Skriv minst två alternativ.", en: "Write at least two options." },
  alternativFinns: { sv: "Två alternativ har samma text.", en: "Two options have the same text." },
  alternativFinnsRedan: { sv: "Alternativet finns redan.", en: "The option already exists." },
  omrostningForLang: { sv: "Högst {max} tecken.", en: "At most {max} characters." },
  omrostningSkickaFel: { sv: "Omröstningen kunde inte skickas.", en: "The poll could not be sent." },
  omrostningFel: { sv: "Rösten kunde inte sparas.", en: "The vote could not be saved." },
  alternativFel: { sv: "Alternativet kunde inte läggas till.", en: "The option could not be added." },
  omrostningarFel: { sv: "Omröstningen kunde inte hämtas.", en: "The poll could not be loaded." },
  omrostningarFler: { sv: "Alla röster och alternativ i omröstningen visas inte.", en: "Not all votes and options in the poll are shown." },
  skrivGrupp: { sv: "Skriv till gruppen", en: "Write to the group" },
  skrivAgent: { sv: "Fråga agenten", en: "Ask the agent" },
  skrivTrad: { sv: "Svara i tråden", en: "Reply in the thread" },
  bifoga: { sv: "Bifoga", en: "Attach" },
  bifogaBild: { sv: "Bifoga bild", en: "Attach image" },
  taFoto: { sv: "Ta foto", en: "Take photo" },
  valjFil: { sv: "Välj fil", en: "Choose file" },
  franBiblioteket: { sv: "Lägg till från Biblioteket", en: "Add from the Library" },
  sokBiblioteket: { sv: "Sök i Biblioteket", en: "Search the Library" },
  bibliotekTomt: { sv: "Inget i Biblioteket matchar.", en: "Nothing in the Library matches." },
  bibliotekLaddar: { sv: "Hämtar Biblioteket …", en: "Loading the Library …" },
  gast: { sv: "Gäst", en: "Guest" },
  bilagaText: { sv: "Bilaga från", en: "Attachment from" },
  taBortBilaga: { sv: "Ta bort bilagan", en: "Remove the attachment" },
  enBilaga: { sv: "Ett meddelande bär en bilaga. Välj en fil.", en: "A message carries one attachment. Choose one file." },
  bilagaGarInteAttSkicka: { sv: "Bilagan går inte att skicka: {skal}", en: "The attachment cannot be sent: {skal}" },
  enBilagaRedan: { sv: "Ett meddelande bär en bilaga. Skicka den här först, eller ta bort den och välj en annan.", en: "A message carries one attachment. Send this one first, or remove it and choose another." },
  bilagaTrasig: { sv: "Bilagan går inte att visa.", en: "The attachment cannot be shown." },
  bilagaKundeInteHamtas: { sv: "Bilagan kunde inte hämtas.", en: "The attachment could not be loaded." },
  forsokIgen: { sv: "Försök igen", en: "Try again" },
  postkortFel: { sv: "Länken kunde inte slås upp.", en: "The link could not be looked up." },
  fast: { sv: "Fäst", en: "Pin" },
  lossa: { sv: "Lossa", en: "Unpin" },
  fastaRubrik: { sv: "{n} fästa", en: "{n} pinned" },
  fastaFel: { sv: "Fästa meddelanden kunde inte hämtas.", en: "Pinned messages could not be loaded." },
  fastFel: { sv: "Fästningen kunde inte sparas.", en: "The pin could not be saved." },
  fastaFler: { sv: "Äldre fästningar visas inte.", en: "Older pins are not shown." },
  citera: { sv: "Svara med citat", en: "Reply with quote" },
  svararPa: { sv: "Svarar på", en: "Replying to" },
  avbrytCitat: { sv: "Avbryt citatet", en: "Cancel the quote" },
  citatSaknas: { sv: "Meddelandet går inte att läsa.", en: "The message cannot be read." },
  sokISamtalet: { sv: "Sök i samtalet", en: "Search the conversation" },
  stangSok: { sv: "Stäng sökningen", en: "Close the search" },
  nastaTraff: { sv: "Nästa träff", en: "Next match" },
  forraTraff: { sv: "Föregående träff", en: "Previous match" },
  ingenTraffLaddade: { sv: "Ingen träff bland de laddade meddelandena.", en: "No match among the loaded messages." },
  sokOmfang: { sv: "Söker bland de {n} laddade meddelandena. Visa äldre för att söka längre bak.", en: "Searching the {n} loaded messages. Show older to search further back." },
  allaNamn: { sv: "alla", en: "everyone" },
  namnForslag: { sv: "Nämn någon", en: "Mention someone" },
  agentTanker: { sv: "Agenten tänker", en: "The agent is thinking" },
  agentSkriver: { sv: "Agenten skriver", en: "The agent is writing" },
  agentFastnat: { sv: "Agenten har inte svarat på två minuter. Skriv igen om du fortfarande väntar.", en: "The agent has not answered for two minutes. Write again if you are still waiting." },
  agentstatusFel: { sv: "Agentens status kunde inte läsas.", en: "The agent's status could not be read." },
  nyttSamtal: { sv: "Nytt samtal", en: "New conversation" },
  gruppensAgent: { sv: "gruppens agent", en: "the group's agent" },
  antalSamtal: { sv: "{n} samtal", en: "{n} conversations" },
  senast: { sv: "senast", en: "latest" },
  ingaSamtalAgent: { sv: "Inga samtal än. Börja ett nytt.", en: "No conversations yet. Start a new one." },
  samtalUtanText: { sv: "Samtal utan text", en: "Conversation without text" },
  samtalMed: { sv: "Samtal med {namn}", en: "Conversations with {namn}" },
  arkivera: { sv: "Arkivera", en: "Archive" },
  taFram: { sv: "Ta fram", en: "Restore" },
  visaArkiverade: { sv: "Visa arkiverade", en: "Show archived" },
  doljArkiverade: { sv: "Dölj arkiverade", en: "Hide archived" },
  ingaArkiverade: { sv: "Inga arkiverade samtal.", en: "No archived conversations." },
  arkivFel: { sv: "Samtalet kunde inte arkiveras.", en: "The conversation could not be archived." },
  arkiveratRad: { sv: "Arkiverat. Det syns inte i listan förrän du tar fram det.", en: "Archived. It is not in the list until you restore it." },
  tillSenaste: { sv: "Till senaste", en: "Jump to latest" },
  langd: { sv: "{n} av {max} tecken", en: "{n} of {max} characters" },
  forLang: { sv: "Texten är {over} tecken för lång. Korta den för att skicka.", en: "The text is {over} characters too long. Shorten it to send." },
  nyaMeddelanden: { sv: "{n} nya", en: "{n} new" },
  nyttSedanSist: { sv: "Nytt sedan sist", en: "New since last time" },
  annatSkickas: { sv: "Ett annat meddelande skickas just nu.", en: "Another message is being sent right now." },
  ingenText: { sv: "Det finns ingen text att skicka.", en: "There is no text to send." },
  sokPlats: { sv: "{i} av {n}", en: "{i} of {n}" },
};

/** @type {Required<Meddelandetexter>} */
const TEXTER = /** @type {any} */ ({
  ...CHATTINFO_TEXTER,
  ...forvalda(ORD_MEDDELANDEN, "sv"),
  reaktionsnamn: {},
  ...talordPa("sv"),
});

/**
 * Tiden på en rad: klockslag i dag, annars tidsstämpeln (0.194.0, `formatDateTime`). Förut bara datum för en äldre dag.
 * @param {number} tid @param {number} nu @param {string} locale
 */
function radtid(tid, nu, locale) {
  const d = new Date(tid);
  const n = new Date(nu);
  return d.toDateString() === n.toDateString() ? formatTime(tid, { locale }) : formatDateTime(tid, { locale });
}

/** "i dag" blir "I dag" i avdelaren, som SS (`ChatDateDivider.jsx`). @param {string} t */
const forstaVersal = (t) => (t ? t.charAt(0).toLocaleUpperCase("sv") + t.slice(1) : t);

/**
 * Väntetiderna mellan försöken när en meddelandebilaga inte gick att läsa (0.213.0, cllp/lifehub.app#751). Tre försök på ungefär fyra sekunder, sedan står felet med
 * "Försök igen". ⛔ BEDÖMNING: ett nätavbrott eller en lyssnare som kopplar upp sig igen är över på några sekunder; ett fel som står kvar efter det är inte ett glapp.
 */
const BILAGA_OMFORSOK_MS = [1000, 3000];

/**
 * Bilagorna som redan rapporterats som oläsbara eller ogiltiga, en gång per meddelande och sidladdning (granskningen av 0.213.0). Bubblan monteras om när man
 * rullar, byter samtal eller öppnar Chattinfo, och en rad per montering hade dränkt felrapporterna i samma fel.
 * @type {Set<string>}
 */
const RAPPORTERADE_BILAGOR = new Set();

/** @param {unknown} fel @param {{ sid: string, mid: string, trad?: string } & Record<string, unknown>} sammanhang */
function rapporteraBilagaEnGang(fel, sammanhang) {
  const nyckel = `${sammanhang.sid}|${sammanhang.trad ?? ""}|${sammanhang.mid}`;
  if (RAPPORTERADE_BILAGOR.has(nyckel)) return;
  RAPPORTERADE_BILAGOR.add(nyckel);
  rapporteraFel(fel, sammanhang);
}

/**
 * En meddelandebilaga. Märket utan `dataUrl` är det vanliga efter #300: filen hämtas då.
 *
 * ══ ⛔ ETT GLAPP ÄR INTE EN TRASIG FIL (0.213.0, cllp/lifehub.app#751) ═══════════════════════════════════════════════════════════════
 *
 * QA 2026-11-10 09.36, live v1.0.1159 på en dator: en PNG (en skärmbild på 1280 x 800, samma sort som andra som visas fint) laddades upp utan fel, och i tråden
 * stod "Bilagan går inte att visa." Mätt i koden: texten stod för TRE olika saker, och alla tre var för alltid.
 *
 *   1. Läsningen föll (`lasBilaga` kastade: nätet, "client is offline", en lyssnare som kopplade upp sig igen).
 *   2. Filen fanns inte i svaret (`null`).
 *   3. Filen fanns men klarade inte `kommentarbilagaFel`.
 *
 * Bubblan läste en gång, och effekten berodde bara på meddelandets id, så ett glapp i (1) eller (2) gjorde en giltig bild "trasig" tills sidan laddades om, utan
 * att något felet nådde felrapporterna. Källan sparar inte ett misslyckat svar (`lasBilaga`), så nästa läsning hade gått, men ingen läste igen.
 *
 * ⛔ (2) KAN INTE VARA SLUTGILTIGT FÖR ETT SKRIVET MEDDELANDE. Regeln släpper bara in märket när filen finns efter samma batch (`opsMarketHarFil`), och filen
 * raderas aldrig. Ett `null` betyder alltså att filen inte syns ÄN, och då är svaret att läsa igen.
 *
 * Nu: (1) och (2) läses om efter `BILAGA_OMFORSOK_MS`, och står felet kvar säger raden "Bilagan kunde inte hämtas." med "Försök igen", läser om när webbläsaren
 * säger att nätet är tillbaka (`online`), och felet går till felrapporterna (`rapporteraFel`). Bara (3) säger "Bilagan går inte att visa.", och det felet går
 * också till felrapporterna, med skälet.
 *
 * ⛔ HYPOTES, INTE MÄTT: att QA:s bild föll på (1) eller (2). Bilden finns hos QA och inte hos oss, och felet lämnade ingen rad i felrapporterna, eftersom
 * bubblan inte rapporterade. Den som ser raden nu ser också felet i felrapporterna, med meddelandets id och vilket av de tre det var.
 *
 * @param {{ m: { id: string, bilaga?: { namn?: string, typ?: string, dataUrl?: string } | null }, kalla: any, sid: string, trad?: string, alt: string, texter: { hamtarBilaga: string, bilagaTrasig: string, bilagaKundeInteHamtas: string, forsokIgen: string } }} props
 */
function VisadBilaga({ m, kalla, sid, trad, alt, texter }) {
  // ⛔ INLINE-VÄGEN (0.77.0). Ett meddelande skrivet före 0.80.0 bär hela filen. Den ritas som den är, utan en läsning, och
  // Chattinfo härleder den ur samma meddelande. Utan vägen blev varje gammal bild "Bilagan går inte att visa".
  const inline = m.bilaga && m.bilaga.dataUrl ? m.bilaga : null;
  const harMarke = Boolean(m.bilaga);
  const harInline = Boolean(inline);
  const [tillstand, setTillstand] = useState(/** @type {"hamtar" | "visad" | "trasig" | "fel"} */ ("hamtar"));
  const [bilaga, setBilaga] = useState(/** @type {any} */ (null));
  const [omgang, setOmgang] = useState(0);
  // ⛔ Beroendena är id:t och om det finns ett märke, inte märkets objekt: varje ögonblicksbild av meddelandena ger ett nytt
  // objekt, och då hade bubblan läst filen igen för varje nytt meddelande i samtalet. `omgang` är Försök igen och nätet tillbaka.
  useEffect(() => {
    if (!harMarke || harInline) return undefined;
    if (!kalla || typeof kalla.lasBilaga !== "function") {
      setTillstand("trasig");
      return undefined;
    }
    let kvar = true;
    /** @type {ReturnType<typeof setTimeout> | null} */
    let vantan = null;
    setTillstand("hamtar");
    const sammanhang = { yta: "OpsMeddelanden", steg: "bilaga", sid, mid: m.id, ...(trad ? { trad } : {}) };
    /** @param {number} varv @param {unknown} fel @param {string} vad */
    const igen = (varv, fel, vad) => {
      if (varv < BILAGA_OMFORSOK_MS.length) {
        vantan = setTimeout(() => las(varv + 1), BILAGA_OMFORSOK_MS[varv]);
        return;
      }
      rapporteraBilagaEnGang(fel instanceof Error ? fel : new Error(`VisadBilaga: ${vad}`), { ...sammanhang, vad, forsok: varv + 1 });
      setTillstand("fel");
    };
    /** @param {number} varv */
    const las = (varv) => {
      kalla.lasBilaga(sid, m.id, trad ? { trad } : undefined).then(
        (/** @type {any} */ rad) => {
          if (!kvar) return;
          const b = bilagaUrDokument(rad);
          if (!b) {
            igen(varv, null, "filen saknas i svaret");
            return;
          }
          const ogiltig = kommentarbilagaFel(b);
          if (ogiltig) {
            rapporteraBilagaEnGang(new Error(`VisadBilaga: ${ogiltig}`), { ...sammanhang, vad: "ogiltig" });
            setTillstand("trasig");
            return;
          }
          setBilaga(b);
          setTillstand("visad");
        },
        (/** @type {unknown} */ e) => {
          if (kvar) igen(varv, e, "läsningen föll");
        },
      );
    };
    las(0);
    return () => {
      kvar = false;
      if (vantan) clearTimeout(vantan);
    };
  }, [m.id, harMarke, harInline, kalla, sid, trad, omgang]);
  // Nätet tillbaka: läs igen, bara när läsningen har fallit.
  useEffect(() => {
    if (tillstand !== "fel" || typeof window === "undefined") return undefined;
    const tillbaka = () => setOmgang((n) => n + 1);
    window.addEventListener("online", tillbaka);
    return () => window.removeEventListener("online", tillbaka);
  }, [tillstand]);
  if (!m.bilaga) return null;
  if (inline) {
    return (
      <span className="mt-1 block max-w-full">
        <BilagaVisning bilaga={/** @type {any} */ (inline)} alt={alt} marke="data-meddelande-bilaga" />
        <KopieraBilagaKnapp bilaga={inline} />
      </span>
    );
  }
  if (tillstand === "hamtar") {
    return <p data-meddelande-bilaga="hamtar" className="m-0 mt-1 text-meta text-ink-muted">{texter.hamtarBilaga}</p>;
  }
  if (tillstand === "fel") {
    return (
      <span data-meddelande-bilaga="fel" className="mt-1 flex flex-wrap items-center gap-2">
        <span role="alert" className="text-meta text-danger">{texter.bilagaKundeInteHamtas}</span>
        <button
          type="button"
          data-bilaga-forsok-igen=""
          onClick={() => setOmgang((n) => n + 1)}
          className="inline-flex min-h-11 cursor-pointer items-center rounded-md px-2 text-meta font-medium text-accent hover:bg-accent-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {texter.forsokIgen}
        </button>
      </span>
    );
  }
  if (tillstand !== "visad" || !bilaga) {
    return (
      <p role="alert" data-meddelande-bilaga="trasig" className="m-0 mt-1 text-meta text-danger">
        {texter.bilagaTrasig}
      </p>
    );
  }
  return (
    <span className="mt-1 block max-w-full">
      <BilagaVisning bilaga={/** @type {any} */ (bilaga)} alt={alt} marke="data-meddelande-bilaga" />
      <KopieraBilagaKnapp bilaga={bilaga} />
    </span>
  );
}

/**
 * Filerna i Chattinfo (0.80.0, granskningen av PR 307).
 *
 * ⛔ EN LÄSNING NÄR PANELEN ÖPPNAS, SEDAN BARA DET NYA. Förut lästes alla filer om för varje nytt meddelande, också för ett
 * textmeddelande. Mätt: tre meddelanden gav sex omläsningar på upp till 35 MB var. Nu läses listan när panelen öppnas, och
 * därefter bara filen bakom ett nytt meddelande som bär ett märke och inte redan finns i listan. Källan cachar filerna per
 * nyckel, så bubblan och panelen läser samma fil en gång.
 *
 * ⛔ DE GAMLA BILAGORNA RÄKNAS OCKSÅ. Ett meddelande ur 0.77.0 bär filen själv (`bilaga.dataUrl`) och har inget eget
 * dokument. Panelen härleder dem ur de meddelanden som redan är laddade, så att Bilder inte säger 0 när bubblan visar en
 * bild. Samma nyckel en gång: en fil som finns på båda ställena räknas inte två gånger.
 *
 * @param {{ kalla: any, sid: string, oppen: boolean, poster: ReadonlyArray<{ m: any, trad?: string }>, felText: string }} props
 * @returns {{ bilagor: any[] | null, fler: boolean, fel: string | null }}
 */
function useChattinfoFiler({ kalla, sid, oppen, poster, felText }) {
  const kan = harBilagor(kalla) && typeof kalla.lasBilagor === "function";
  const [lista, setLista] = useState(/** @type {{ rader: any[], fler: boolean } | null} */ (null));
  const [fel, setFelText] = useState(/** @type {string | null} */ (null));
  const [enstaka, setEnstaka] = useState(/** @type {Map<string, any>} */ (new Map()));
  const begarda = useRef(/** @type {Set<string>} */ (new Set()));
  const varv = useRef(0);
  useEffect(() => {
    if (!oppen || !kan) return undefined;
    varv.current += 1;
    const detta = varv.current;
    setLista(null);
    setFelText(null);
    setEnstaka(new Map());
    begarda.current = new Set();
    kalla.lasBilagor(sid).then(
      (/** @type {{ rader: any[], fler: boolean }} */ svar) => {
        if (varv.current === detta) setLista(svar);
      },
      (/** @type {any} */ e) => {
        if (varv.current === detta) setFelText(e instanceof Error ? e.message : felText);
      },
    );
    return () => {
      varv.current += 1;
    };
  }, [oppen, kan, kalla, sid, felText]);
  useEffect(() => {
    if (!oppen || !kan || !lista) return;
    const detta = varv.current;
    const kanda = new Set(lista.rader.map((r) => r && r.id));
    for (const { m, trad } of poster) {
      if (!m || !m.bilaga || m.bilaga.dataUrl) continue;
      const nyckel = bilagenyckel(m.id, trad);
      if (kanda.has(nyckel) || begarda.current.has(nyckel)) continue;
      begarda.current.add(nyckel);
      kalla.lasBilaga(sid, m.id, trad ? { trad } : undefined).then(
        (/** @type {any} */ rad) => {
          if (varv.current === detta && rad) setEnstaka((f) => new Map(f).set(nyckel, rad));
        },
        () => {
          // Bubblan säger redan att just den filen inte gick att visa. Nästa öppning försöker igen.
        },
      );
    }
  }, [oppen, kan, lista, poster, kalla, sid]);
  const bilagor = useMemo(() => {
    /** @type {Map<string, any>} */
    const per = new Map();
    for (const { m, trad } of poster) {
      if (m && m.bilaga && m.bilaga.dataUrl) per.set(bilagenyckel(m.id, trad), { ...m.bilaga, id: bilagenyckel(m.id, trad), tid: m.tid });
    }
    if (kan && !lista) return null;
    for (const r of lista ? lista.rader : []) if (r && typeof r.id === "string") per.set(r.id, r);
    for (const [k, r] of enstaka) per.set(k, r);
    return [...per.values()].sort((a, b) => (typeof b.tid === "number" ? b.tid : 0) - (typeof a.tid === "number" ? a.tid : 0));
  }, [poster, kan, lista, enstaka]);
  return { bilagor: fel ? null : bilagor, fler: Boolean(lista && lista.fler), fel };
}

/**
 * Tystnaden för den inloggade i ett samtal (0.80.0, #301). Ett hem för `OpsSamtal` och `OpsTrad`.
 * @param {any} kalla @param {string} sid @param {string} uid @param {(e: Error) => void} onFel
 */
function useTystnad(kalla, sid, uid, onFel) {
  const [tyst, setTyst] = useState(false);
  useEffect(() => {
    if (!harTyst(kalla)) return undefined;
    let kvar = true;
    kalla.tystFor(sid, uid).then(
      (/** @type {boolean} */ v) => {
        if (kvar) setTyst(v);
      },
      (/** @type {any} */ e) => {
        if (kvar) onFel(e instanceof Error ? e : new Error(String(e)));
      },
    );
    return () => {
      kvar = false;
    };
    // `onFel` är en setState och byts inte, så den står inte bland beroendena.
  }, [kalla, sid, uid]);
  const vaxla = () => {
    if (!harTyst(kalla)) return;
    const nasta = !tyst;
    kalla.sattTyst(sid, uid, nasta).then(
      () => setTyst(nasta),
      (/** @type {any} */ e) => onFel(e instanceof Error ? e : new Error(String(e))),
    );
  };
  return { tyst, vaxla };
}

/**
 * Knapp i chattens huvud. Namnet är `aria-label`. Tooltipen är samma ord, i den mörka bubblan, så att ikonen går att läsa
 * med pekaren och med tangentbordet. Träffytan är 44 px.
 * @param {{ etikett: string, dataAttr: string, children: import("react").ReactNode, href?: string, pressed?: boolean, expanded?: boolean, onClick?: () => void }} props
 */
function Verktygsknapp({ etikett, dataAttr, children, href, pressed, expanded, onClick }) {
  const klass = "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-base text-ink-muted hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent";
  const gem = {
    "aria-label": etikett,
    "data-chattverktyg": dataAttr,
    ...(dataAttr === "sok" ? { "data-sok-samtal": "" } : {}),
    ...(pressed === undefined ? {} : { "aria-pressed": pressed }),
    ...(expanded === undefined ? {} : { "aria-expanded": expanded }),
    className: klass,
  };
  const inre = href ? (
    <a href={href} {...gem}>{children}</a>
  ) : (
    <button type="button" onClick={onClick} {...gem}>{children}</button>
  );
  return (
    <OpsTooltip content={etikett} side="bottom" tone="mork">
      {inre}
    </OpsTooltip>
  );
}

/** @param {unknown} mejl */
function mejlHref(mejl) {
  if (typeof mejl !== "string") return null;
  const t = mejl.trim();
  if (!t || /[\s<>]/.test(t)) return null;
  return `mailto:${t}`;
}

/**
 * Ingången till meddelandena, med antalet olästa (0.34.0). En `OpsIconLink` med ramverkets ikon, för appens `actions`.
 *
 * @param {{ href: string, olasta: number, olastaFler?: boolean, etikett?: string, olastaText?: string, onNavigate?: (href: string, e: any) => void, active?: boolean }} props
 *   `olastaFler` (chattens nattskiva): antalet är ett golv, märket visar "50+". Ges av `onOlasta`:s andra argument.
 */
export function OpsMeddelandeLank({ href, olasta, olastaFler = false, etikett = "Meddelanden", olastaText = "olästa", onNavigate, active }) {
  return <OpsIconLink href={href} icon={<MeddelandeIkon size={20} />} label={etikett} badge={olasta} badgeFler={olastaFler} badgeText={olastaText} onNavigate={onNavigate} active={active} />;
}

/**
 * Komponentens texter på ett språk: förvalen, appens egna och reaktionernas namn på `sprak`.
 *
 * ⛔ EN KÄLLA FÖR ALLA TRE (0.75.0, granskningen av PR 290). OpsSamtal och OpsTrad är egna exporter och används också utan
 * OpsMeddelanden runt sig. När de byggde `t` själva utan reaktionsnamnen blev namnen svenska med sprak="en".
 * @param {string} sprak
 * @param {Partial<typeof TEXTER> & { reaktionsnamn?: Record<string, string> }} texter
 */
export function texterPa(sprak, texter) {
  return { ...TEXTER, ...forvalda(ORD_CHATTINFO, sprak), ...forvalda(ORD_MEDDELANDEN, sprak), ...talordPa(sprak), ...texter, reaktionsnamn: { ...reaktionsnamnPa(sprak), ...texter.reaktionsnamn } };
}

/**
 * @param {object} props
 * @param {ReturnType<typeof import("../data/samtalskalla.js").createSamtalskalla>} props.kalla
 * @param {string} props.uid
 * @param {string | null} props.groupId
 * @param {string} props.gruppNamn Gruppchattens namn i listan.
 * @param {(tagg: string) => string | null} [props.projektnamn] (0.215.0, lifehub.app#760) Projektets namn för en projektchatt i listan, ur appens projekt. `null` eller utelämnad: taggen står som namn.
 *   ⛔ EN PROJEKTCHATT STÅR I LISTAN FÖRST NÄR DEN HAR ETT MEDDELANDE (källans `oversikt`): ett projekt utan samtal ska inte fylla inkorgen med tomma rader.
 * @param {ReadonlyArray<Medlemsrad>} props.medlemmar Gruppens medlemskap, för namn och bilder.
 * @param {string | null} [props.valt] Valt samtal, när appen styr det (t.ex. ur adressen). Tråden ritas på id:t också när
 *   samtalet ännu inte finns bland raderna (0.63.0, #263).
 * @param {boolean | "agent"} [props.nytt] (0.63.0, #263) Läget "nytt" i högerpanelen, när appen styr det (t.ex. ur adressen, `?nytt=1`).
 *   Utelämnad: komponenten håller läget själv. (0.106.0, #386) `"agent"` öppnar ett nytt ämne med agenten (`valtAgent`, annars gruppens
 *   första agent), med `nyttUtkast` i skrivfältet. Ämnet skapas först när personen skickar. Utan `amnen` på källan är `"agent"` samma
 *   som `true`.
 * @param {string | null} [props.valtAgent] (0.106.0, #386) Agenten vars samtal visas i högerpanelen, när appen styr det. Utelämnad:
 *   komponenten håller valet själv. Gäller bara med `amnen` på källan.
 * @param {(samtalId: string | null, val?: { nytt?: true | "agent", agent?: string }) => void} [props.onValj] Anropas med det valda samtalet, eller med
 *   `(null, { nytt: true })` när läget "nytt" öppnas. Ett anrop utan `val` betyder att läget "nytt" är stängt. EN signal för
 *   båda, så att en app som har dem i adressen skriver adressen en gång. (0.106.0) `(null, { agent })` när agentens samtal visas,
 *   och `(null, { nytt: "agent", agent })` när ett nytt ämne öppnas.
 * @param {(antal: number, val: { fler: boolean }) => void} [props.onOlasta] Anropas med antalet olästa när det ändras, för ingångens räknare.
 *   `val.fler` (chattens nattskiva): antalet är ett golv, eftersom en räkning nådde sidans storlek. Skicka det till `OpsMeddelandeLank olastaFler`.
 * @param {string | null} [props.valtTrad] (0.68.0) Vald tråd i gruppchatten, rotmeddelandets id, när appen styr det (t.ex. ur
 *   adressen, `?trad=`). Gäller bara när det valda samtalet är gruppchatten. Utelämnad: komponenten håller valet själv.
 * @param {(tid: string | null) => void} [props.onValjTrad] (0.68.0) Anropas med tråden som öppnas, eller `null` när man går
 *   tillbaka till gruppchatten. Ett nytt val av samtal stänger tråden, och då anropas den inte: det är `onValj` som säger det.
 * @param {string} [props.sprak] "sv" eller "en", för tiderna. Förval "sv".
 * @param {Meddelandetexter} [props.texter]
 * @param {Postkort} [props.postkort] (chattens nattskiva) Länkar till appens poster som kort under bubblan, se `Postkort`.
 * @param {(blob: Blob) => Promise<string>} [props.onTranscribe] (chattens nattskiva) Appens transkribering. Med den ritas ljudvågen i
 *   skrivfältet. ⛔ (0.103.0) Det sagda skickas som ett meddelande när man trycker Klar, och `onTranscribe` används bara när inget av det
 *   hördes (se `useRostinmatning`). Utan den ingen ljudvåg.
 * @param {(sid: string, tid?: string) => void} [props.onStoppaAgent] Appens sätt att stoppa agenten. Med den står stopp i fältet medan
 *   agenten arbetar. Utan den ingen sådan knapp.
 * @param {import("../lib/talk.js").Inspelare} [props.inspelare] Bara för prov. Förval: webbläsarens inspelning, TALK:s.
 * @param {import("../lib/talk.js").Igenkanning | boolean} [props.igenkanning] (0.98.0) Text medan man pratar, som TALK:s `igenkanning`. (0.103.0)
 *   Texten står i inspelningsytan, inte i skrivfältet. ⛔ AV SOM FÖRVAL, av samma skäl som i TALK: webbläsaren skickar talet till Googles
 *   eller Apples taltjänst, och det är appens val. `true` slår på webbläsarens taligenkänning när den finns. Utan den, eller när inget
 *   hördes, skriver `onTranscribe` ut ljudet.
 * @param {(filer: File[], slag: "bild" | "foto" | "fil") => void} [props.onBifoga] (0.77.0, #292) Skickas till `OpsSamtal` och `OpsTrad`.
 *   Med `bilagor` på källan ritas pluset ändå, och filen läses av ramverket. `onBifoga` anropas då inte.
 * @param {Franbiblioteket} [props.franBiblioteket] (0.164.0, lifehub.app#226) Raden "Lägg till från Biblioteket" i pluset. Posten blir en fil och går samma väg som "Välj fil".
 * @param {string} [props.mejl] (0.80.0, #301) Adressen appen skickar in. Utan den ritas ingen mejlknapp. Ramverket känner inga adresser.
 * @param {(rad: { samtal: string, trad: string, meddelande: string, text: string, av: string }) => void | Promise<void>} [props.onLyftTillMinnet]
 *   (0.86.0, lifehub.app#66) Uttryckligt lyft av ett meddelande i en tråd. Utan den ritas ingen knapp, och inget lyfts av sig självt.
 * @param {import("react").ComponentProps<typeof OpsHubTillbaka>} [props.tillbaka] (0.88.1) Tillbaka-raden överst i listan, samma som modulernas (`modulTillbaka` med `modulId`).
 *   Står modulen i huvudmenyn ritas ingen rad: en fäst modul är inbyggd. Samtalets egen rad tillbaka till listan på telefon berörs inte.
 * @param {string} [props.minneHref] (0.86.0) Adressen till gruppens minnesvy. Utan den ritas ingen länk. Ramverket känner inte appens rutter.
 * @param {import("./OpsModulRam.jsx").ModulRam | null} [props.ram] (0.89.0) Inställningsläget. Utelämnad: chatten som förut, utan kugghjul.
 * @param {string} [props.activeHref] (0.89.0) Krävs med `ram`. `?lage=installningar` ersätter chatten med inställningarna.
 * @param {import("../lib/modul.js").Modul | null} [props.modul] (0.89.0) Manifestet inställningarna läser. Krävs med `ram`, tillsammans med `tillbaka.hubHref`.
 * @param {(agent: { id: string, namn: string }) => void} [props.onVisaAgent] (0.90.0) Tryck på agentens namn och ikon i samtalets huvud, och på agentens avatar i en tråd, öppnar den agentens inställningar. Utan den är huvudet text.
 * @param {MeddelandeHref} [props.meddelandeHref] (lifehub.app#712) Appens väg till ett meddelande, för "Kopiera länk" i menyn. Ramverket känner aldrig appens rutter. Utan den finns inte raden.
 * @param {ReadonlyArray<Omnamnbar>} [props.flerOmnamnbara] (lifehub.app#723) Fler som går att nämna med @, utöver de aktiva medlemmarna: appens API-agenter, vars medlemskap står som "avslutad". De läggs bara till @-listan och påverkar aldrig agentval, mottagare eller medlemslistor. Nämnandet skrivs som vanligt i `namner` (id). Utan den är listan exakt som förut.
 * @param {(f: { sid: string, mid: string, id: string }) => Promise<import("../lib/forslag.js").Forslagssvar>} [props.onForslag] (0.105.0) Agentens
 *   förslag som knappar under hens svar (`OpsForslag`). Ett meddelande från en medlem av typen agent som bär `forslag` (`{ id, etikett,
 *   ikon?, text? }`, skrivet av appens server) får knapparna, och ett tryck anropar den här med samtalet, meddelandet och förslagets id.
 *   Utan den ritas inga knappar. ⛔ Ramverket vet inte vad ett förslag gör: det avgör appens server, och trycket är personens begäran.
 *   ⛔ Servern ska pröva `{ sid, mid, id }` mot det LAGRADE meddelandet (skrivet av en agent, med förslaget `id`) och mot att den som
 *   trycker är deltagare i samtalet, och utföra det lagrade förslaget, aldrig något klienten skickat (se `lib/forslag.js`). ⛔ I en tråd
 *   ritas inga förslag, varken under roten eller under ett svar.
 * @param {string} [props.nyttUtkast] (0.105.0) Texten som står i skrivfältet när läget "nytt" öppnas, till exempel det man sade i TALK och
 *   valde Meddelande för. Ingenting skickas: personen väljer mottagare och trycker Skicka.
 */
export function OpsMeddelanden({ kalla, uid, groupId, gruppNamn, projektnamn, medlemmar, valt, nytt, valtAgent, onValj, onOlasta, valtTrad, onValjTrad, sprak: sprakProp, texter = {}, postkort, onTranscribe, onStoppaAgent, inspelare, igenkanning, onBifoga, franBiblioteket, mejl, onLyftTillMinnet, minneHref, tillbaka, ram = null, activeHref, modul = null, onVisaAgent, onForslag, nyttUtkast, meddelandeHref, flerOmnamnbara }) {
  kravRam(ram, "OpsMeddelanden");
  if (onForslag !== undefined && typeof onForslag !== "function") throw new Error(`OpsMeddelanden: onForslag ska vara en funktion, fick ${typeof onForslag}.`);
  if (nyttUtkast !== undefined && typeof nyttUtkast !== "string") throw new Error(`OpsMeddelanden: nyttUtkast ska vara en sträng, fick ${typeof nyttUtkast}.`);
  if (ram && (typeof activeHref !== "string" || activeHref === "" || !modul || typeof tillbaka?.hubHref !== "string")) {
    throw new Error("OpsMeddelanden: ram kräver activeHref, modul och tillbaka.hubHref. Inställningsläget använder samma tillbaka-rad som listan.");
  }
  // ⛔ Språket ur appens `OpsSprakProvider` när appen inte gav ett (0.46.0, cllp/bolag-ops#528).
  const sprakKontext = useOpsSprak();
  const sprak = sprakProp ?? sprakKontext;
  const t = texterPa(sprak, texter);
  const locale = sprak === "en" ? "en-GB" : "sv-SE";
  const [egetVal, setEgetVal] = useState(/** @type {string | null} */ (null));
  const [egetNytt, setEgetNytt] = useState(/** @type {boolean | "agent"} */ (false));
  const [egenAgent, setEgenAgent] = useState(/** @type {string | null} */ (null));
  // ⛔ SAMTAL PER ÄMNE BARA NÄR KÄLLAN HAR DEM (0.106.0, #386). Utan `amnen` är inkorgen, valen och vyerna exakt som förut.
  const medAmnen = harAmnen(kalla);
  const nyttVarde = groupId ? (nytt !== undefined ? nytt : egetNytt) : false;
  // ⛔ Läget "nytt" vinner över ett valt samtal: det är det man senast bad om.
  const nyttAmneLage = medAmnen && nyttVarde === "agent";
  const nyttLage = Boolean(nyttVarde) && !nyttAmneLage;
  const valdId = nyttLage || nyttAmneLage ? null : valt !== undefined ? valt : egetVal;
  // ⛔ `oppet`: det öppna samtalet räknas inte lokalt av inkorgen (omgranskningen av PR 390), se `useSamtal`.
  const { rader, laddar, fel, olasta, olastaFler, lasOm, laggIn } = useSamtal({ kalla, groupId, uid, oppet: valdId });
  /** @param {string | null} id @param {{ nytt?: true | "agent", agent?: string }} [val] */
  const valj = (id, val) => {
    if (valt === undefined) setEgetVal(id);
    if (nytt === undefined) setEgetNytt(val?.nytt ?? false);
    if (valtAgent === undefined) setEgenAgent(val?.agent ?? null);
    onValj?.(id, val);
  };
  /** Gruppens aktiva agenter, i medlemslistans ordning (0.106.0). */
  const agenter = useMemo(() => (medlemmar ?? []).filter((m) => m && m.typ === "agent" && (m.status ?? "aktiv") === "aktiv").map((m) => m.userId), [medlemmar]);
  const agentVal = valtAgent !== undefined ? valtAgent : egenAgent;
  // Agenten vars samtal visas, och agenten ett nytt ämne skrivs till: den valda, annars gruppens första.
  const listadAgent = medAmnen && !nyttLage && !nyttAmneLage && !valdId ? agentVal : null;
  const nyAgent = nyttAmneLage ? agentVal ?? agenter[0] ?? null : null;
  // Det man skrev i läget "nytt" innan man valt någon följer med in i tråden.
  const utkast = useRef(/** @type {{ id: string, text: string } | null} */ (null));
  const [filter, setFilter] = useState(/** @type {"alla" | "olasta"} */ ("alla"));
  const [sok, setSok] = useState("");
  const tangentbord = useTangentbord();

  useEffect(() => {
    onOlasta?.(olasta, { fler: olastaFler });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [olasta, olastaFler]);

  // Ett nytt val nollar sökningen i samtalet, inte i listan. Byts gruppen stängs samtalet: det hör till den förra gruppen.
  useEffect(() => {
    if (valt === undefined) setEgetVal(null);
  }, [groupId, valt]);
  useEffect(() => {
    if (nytt === undefined) setEgetNytt(false);
  }, [groupId, nytt]);
  useEffect(() => {
    if (valtAgent === undefined) setEgenAgent(null);
  }, [groupId, valtAgent]);

  const namn = useMemo(() => {
    /** @type {Map<string, Medlemsrad>} */
    const m = new Map();
    for (const r of medlemmar ?? []) if (r?.userId) m.set(r.userId, r);
    return m;
  }, [medlemmar]);
  // ⛔ ALDRIG ETT ID SOM NAMN (#218): medlemskapets namn, den inloggades eget namn, annars "Namn saknas".
  const personnamn = usePersonnamn();
  // En gäst (`av` är ett `g_`-id) är ingen medlem och saknar namn i medlemslistan: i översikten står "Gäst", och i själva chatten gästens eget namn (`Meddelanderader`, ur meddelandet).
  const namnFor = (/** @type {string} */ id) => (arGastId(id) ? t.gast : personnamn(namn.get(id)?.namn, id).text);

  /*
   * ⛔ GRUPPCHATTEN FINNS ALLTID I LISTAN, ÖVERST (0.68.0). CP 2026-10-06, i en grupp med en medlem: "Hur skriver jag ett
   * meddelande till hela gruppen?" Det gick inte. Listan visade bara agentsamtalet, och Till i "Nytt meddelande" bara Agent:
   * `oppnaGrupp` anropades aldrig från vyn, så gruppchatten fanns bara där någon redan hade skapat den (i mätdatan var den sådd).
   * Raden härleds här ur gruppen, den lagras inte: ett tomt samtalsdokument per grupp hade varit en rad i databasen som
   * bara finns för att vyn ska ha något att rita. Samtalet skapas med `oppnaGrupp` när någon öppnar raden (`ej: true`).
   */
  const gruppSid = groupId ? samtalsnyckel({ groupId, slag: "grupp" }) : null;
  /** @type {Array<typeof rader[number] & { ej?: true }>} */
  const allaRader = useMemo(() => {
    if (!gruppSid || !groupId) return rader;
    const finns = rader.find((r) => r.samtal.id === gruppSid);
    const ovriga = rader.filter((r) => r.samtal.id !== gruppSid);
    if (finns) return [finns, ...ovriga];
    if (laddar || fel) return rader;
    return [{ samtal: { id: gruppSid, groupId, slag: "grupp", skapad: 0, skapadAv: "" }, senaste: null, olasta: 0, lastTill: 0, motpart: null, ej: true }, ...ovriga];
  }, [rader, gruppSid, groupId, laddar, fel]);

  /**
   * (0.215.0) Radens namn: gruppen, projektet (appens namn, annars taggen) eller den andra personen.
   * @param {typeof rader[number]} r
   */
  const rubrikFor = (r) => {
    if (r.samtal.slag === "grupp") return gruppNamn;
    if (r.samtal.slag === "projekt") {
      const tagg = projekttaggUr(r.samtal.id, r.samtal.groupId) ?? "";
      return (projektnamn ? projektnamn(tagg) : null) || tagg;
    }
    return namnFor(r.motpart ?? "");
  };
  const nu = Date.now();
  const q = sok.trim().toLocaleLowerCase("sv");
  const visade = allaRader
    .filter((r) => (filter === "olasta" ? r.olasta > 0 : true))
    .filter((r) => {
      if (!q) return true;
      const rubrik = rubrikFor(r);
      return rubrik.toLocaleLowerCase("sv").includes(q) || (r.senaste?.text ?? "").toLocaleLowerCase("sv").includes(q);
    });
  /*
   * ══ ⛔ AGENTEN SOM EN RAD (0.106.0, #386 skiva 2, skissen CP godkände) ═══════════════════════════════════════════════════
   *
   * Grupperna överst, sedan en rad per agent ("Hugo, gruppens agent", "3 samtal, senast 14:32"), sedan personerna. Agentens ämnen
   * listas inte i inkorgen: raden leder till agentens samtal, och räknaren är summan av ämnenas olästa. En agent utan samtal har ändå
   * sin rad, eftersom raden är vägen till ett nytt. Utan `amnen` på källan är listan som förut.
   */
  /** @typedef {{ typ: "agent", agent: string, rader: typeof allaRader, olasta: number, olastaFler: boolean, senaste: (typeof allaRader)[number]["senaste"] }} Agentpost */
  /** @type {Agentpost[]} */
  const agentposter = useMemo(() => {
    if (!medAmnen) return [];
    const ids = [...agenter];
    for (const r of rader) if (r.samtal.slag === "agent" && r.motpart && !ids.includes(r.motpart)) ids.push(r.motpart);
    return ids.map((agent) => {
      const egna = rader.filter((r) => r.samtal.slag === "agent" && r.motpart === agent);
      const senaste = egna.reduce((b, r) => (r.senaste && (!b || r.senaste.tid > b.tid) ? r.senaste : b), /** @type {(typeof allaRader)[number]["senaste"]} */ (null));
      return { typ: /** @type {const} */ ("agent"), agent, rader: egna, olasta: egna.reduce((n, r) => n + r.olasta, 0), olastaFler: egna.some((r) => r.olastaFler === true), senaste };
    });
  }, [medAmnen, agenter, rader]);
  const visadeAgentposter = agentposter
    .filter((a) => (filter === "olasta" ? a.olasta > 0 : true))
    .filter((a) => !q || namnFor(a.agent).toLocaleLowerCase("sv").includes(q) || a.rader.some((r) => (r.senaste?.text ?? "").toLocaleLowerCase("sv").includes(q) || String(r.samtal.rubrik ?? "").toLocaleLowerCase("sv").includes(q)));
  /** @type {Array<{ typ: "rad", r: (typeof allaRader)[number] } | Agentpost>} */
  const poster = medAmnen
    ? [
        ...visade.filter((r) => r.samtal.slag === "grupp").map((r) => ({ typ: /** @type {const} */ ("rad"), r })),
        // (0.215.0) Projektens chattar efter gruppens: rum för flera, som gruppchatten.
        ...visade.filter((r) => r.samtal.slag === "projekt").map((r) => ({ typ: /** @type {const} */ ("rad"), r })),
        ...visadeAgentposter,
        ...visade.filter((r) => r.samtal.slag === "personer").map((r) => ({ typ: /** @type {const} */ ("rad"), r })),
      ]
    : visade.map((r) => ({ typ: /** @type {const} */ ("rad"), r }));
  /*
   * ⛔ TRÅDEN RITAS PÅ DET VALDA ID:T, INTE PÅ LISTAN (#263, SS `ChatInboxPanel.jsx:186-191`). Raden ur listan när den finns.
   * Annars läses gruppen och paret ur nyckeln: ett id i en annan grupp, eller ett par jag inte är med i, ritar ingen tråd.
   * Slaget avgörs av vem den andra är, ur medlemmarna, på samma sätt som regeln skiljer `personer` från `agent`.
   */
  /** @type {(typeof rader[number] & { ej?: true }) | null} */
  const vald = useMemo(() => {
    if (!valdId) return null;
    const rad = allaRader.find((r) => r.samtal.id === valdId);
    if (rad) return rad;
    const d = delaSamtalsnyckel(valdId, groupId);
    if (!d || d.groupId !== groupId || !uid) return null;
    // Gruppchatten ur adressen innan listan svarat: `oppnaGrupp` ger den som finns, eller skapar den (0.68.0).
    if ("slag" in d && d.slag === "grupp") return { samtal: { id: valdId, groupId: d.groupId, slag: "grupp", skapad: 0, skapadAv: "" }, senaste: null, olasta: 0, lastTill: 0, motpart: null, ej: true };
    // (0.215.0) Ett projekts chatt ur adressen: `oppnaProjekt` ger den som finns, eller skapar den, som gruppchatten.
    if ("slag" in d && d.slag === "projekt") return { samtal: { id: valdId, groupId: d.groupId, slag: "projekt", skapad: 0, skapadAv: "" }, senaste: null, olasta: 0, lastTill: 0, motpart: null, ej: true };
    if (!("deltagare" in d)) return null;
    if (!d.deltagare.includes(uid)) return null;
    const annan = d.deltagare[0] === uid ? d.deltagare[1] : d.deltagare[0];
    // ⛔ (0.106.0) Ett ämne har bara agenten som slag: nyckelns fjärde del finns inte på ett personsamtal.
    const slag = "amne" in d || namn.get(annan)?.typ === "agent" ? "agent" : "personer";
    return { samtal: { id: valdId, groupId: d.groupId, slag, deltagare: d.deltagare, skapad: 0, skapadAv: "" }, senaste: null, olasta: 0, lastTill: 0, motpart: annan };
  }, [valdId, allaRader, groupId, uid, namn]);
  const hoger = nyttLage || nyttAmneLage || Boolean(vald) || Boolean(listadAgent);
  // ⛔ (0.106.0) Ett ämne med agenten har sin egen rad tillbaka till agentens samtal, som tråden har sin till gruppchatten.
  const iAmne = medAmnen && (nyttAmneLage || vald?.samtal.slag === "agent");
  const amnesAgent = nyttAmneLage ? nyAgent : vald?.samtal.slag === "agent" ? vald.motpart : null;
  // ⛔ TRÅDEN GÄLLER BARA GRUPPCHATTEN, och ett nytt samtalsval stänger den (0.68.0). Ett trådid kvar från förra samtalet hade
  // öppnat en tråd under fel samtal.
  const [egenTrad, setEgenTrad] = useState(/** @type {string | null} */ (null));
  useEffect(() => {
    if (valtTrad === undefined) setEgenTrad(null);
  }, [valdId, valtTrad]);
  // ⛔ TRÅDAR BARA NÄR KÄLLAN HAR DEM (BÖR 2): en app som inte skickat `tradar` får varken knapp, märke eller trådvy.
  const medTradar = harTradar(kalla);
  const tradId = medTradar && vald?.samtal.slag === "grupp" ? (valtTrad !== undefined ? valtTrad : egenTrad) : null;
  /*
   * ⛔ MÄRKENA LIGGER KVAR NÄR TRÅDEN ÖPPNAS OCH STÄNGS (BÖR 4). Chatten monteras om när man går tillbaka från en tråd, och utan
   * ett minne utanför den hade varje återkomst läst alla rötter igen. Minnet är per samtal; ett svar eller en omdöpning i tråden
   * ändrar bara sin egen rad.
   */
  const tradminne = useRef(/** @type {Map<string, Map<string, Tradrad>>} */ (new Map()));
  // Fokus tillbaka till märket när tråden stängs (KAN 6).
  const [fokusRot, setFokusRot] = useState(/** @type {string | null} */ (null));
  /** @param {string | null} tid */
  const valjTrad = (tid) => {
    if (tid === null && tradId) setFokusRot(tradId);
    if (valtTrad === undefined) setEgenTrad(tid);
    onValjTrad?.(tid);
  };
  /** @param {string} sid @param {string} tid @param {Partial<Tradrad>} andring */
  const andraTradrad = (sid, tid, andring) => {
    const m = tradminne.current.get(sid) ?? new Map();
    m.set(tid, { ...(m.get(tid) ?? { finns: false }), ...andring });
    tradminne.current.set(sid, m);
  };
  // Utkastet hör till den tråd som just öppnades ur läget "nytt". Den har läst det när den monterades; sedan glöms det.
  useEffect(() => {
    utkast.current = null;
  }, [valdId]);

  /** @param {typeof rader[number]} r @param {"md" | "sm"} storlek */
  const markeFor = (r, storlek) => {
    if (r.samtal.slag === "grupp") return <OpsIdentity name={gruppNamn} seed={groupId ?? "grupp"} size={storlek} icon={GruppIkon} />;
    if (r.samtal.slag === "projekt") return <OpsIdentity name={rubrikFor(r)} seed={r.samtal.id} size={storlek} icon={MappIkon} />;
    const m = namn.get(r.motpart ?? "");
    if (r.samtal.slag === "agent") return <OpsIdentity name={m?.namn || t.agent} seed={r.motpart ?? "agent"} size={storlek} icon={AgentIkon} rund />;
    return <OpsIdentity name={namnFor(r.motpart ?? "")} seed={r.motpart ?? ""} imageUrl={m?.bild || undefined} size={storlek} rund />;
  };
  /** @param {typeof rader[number]} r */
  const slagetFor = (r) => (r.samtal.slag === "grupp" ? t.grupp : r.samtal.slag === "projekt" ? t.projekt : r.samtal.slag === "agent" ? t.agent : t.privat);
  const installningar = Boolean(ram && modul && tillbaka && arInstallningslage(/** @type {string} */ (activeHref)));
  if (installningar && modul && tillbaka) {
    return (
      <OpsModulRam modul={modul} activeHref={/** @type {string} */ (activeHref)} hubHref={tillbaka.hubHref} hubEtikett={tillbaka.hubEtikett} onNavigate={tillbaka.onNavigate} sprak={sprak} ram={ram}>
        {null}
      </OpsModulRam>
    );
  }

  return (
    <OpsSprakProvider sprak={sprak}>
    {/* ⛔ HÖJDEN ÄR FÖNSTRET MINUS SKALETS RAMAR (huvudet med sin kant på 1 px, och bottenraden under md), så att listan och
       samtalet rullar var för sig och skrivfältet står kvar längst ned, som SS (`h-full`, `:957`). Mätt i check-skalyta
       avsnitt 29: utan den enda pixeln för huvudets kant rullade hela sidan en pixel, och skrivfältet hamnade under bottenraden. */}
    <div
      data-ops-meddelanden=""
      data-tangentbord={tangentbord > 0 ? tangentbord : undefined}
      style={tangentbord > 0 ? /** @type {any} */ ({ "--tangentbord": `${tangentbord}px` }) : undefined}
      className="flex h-[calc(100dvh-var(--safe-top)-var(--topbar-height)-1px-max(var(--bottom-nav-h)+var(--safe-bottom),var(--tangentbord,0px))-var(--spelrad-h,0px))] min-h-0 flex-col bg-canvas md:h-[calc(100dvh-var(--safe-top)-var(--topbar-height)-1px-var(--spelrad-h,0px))] md:flex-row md:gap-2 md:p-2"
    >
      {/* ── Listan ─────────────────────────────────────────────────────────────────────────── */}
      <section
        aria-label={t.rubrik}
        data-samtalslista=""
        className={cx(
          "min-h-0 w-full flex-1 flex-col overflow-hidden bg-surface md:flex md:w-[35%] md:min-w-[220px] md:max-w-[40%] md:flex-none md:shrink-0 md:rounded-xl",
          hoger ? "hidden" : "flex",
        )}
      >
        {tillbaka ? (
          <div data-meddelanden-tillbaka="" className="shrink-0 px-3 empty:hidden">
            <OpsHubTillbaka {...tillbaka} rubrik={false} />
          </div>
        ) : null}
        {/* ⛔ FÖREBILDEN FÖR VARJE VYS HUVUD (0.102.0): klasserna bor i `OpsTillbaka.jsx` och delas med `OpsHubTillbaka` och
            `OpsViewHeader`. */}
        <div data-meddelanden-huvud="" data-vyhuvud="" className={`shrink-0 px-3 pt-3 pb-1 ${VYHUVUD_KLASS}`}>
          <span aria-hidden="true" className={VYIKON_KLASS}>
            <MeddelandeIkon size={18} />
          </span>
          <h2 className={VYRUBRIK_KLASS}>{t.rubrik}</h2>
          {groupId ? (
            <OpsVyAtgard pressed={nyttLage} onClick={() => valj(null, { nytt: true })}>
              {t.nytt}
            </OpsVyAtgard>
          ) : null}
          <ModulLageKnapp ram={ram} activeHref={activeHref ?? ""} onNavigate={tillbaka?.onNavigate} sprak={sprak} installningar={false} />
        </div>
        <div className="flex shrink-0 items-center gap-1.5 px-3 py-1">
          <div role="group" aria-label={t.rubrik} className="flex items-center rounded-base border border-line bg-canvas p-0.5">
            {/** @type {const} */ (["alla", "olasta"]).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cx(
                  "relative min-h-8 cursor-pointer rounded-sm px-2.5 text-liten transition-colors duration-(--duration-fast) ease-standard focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                  filter === f ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink",
                )}
              >
                {f === "alla" ? t.alla : t.olasta}
                {f === "olasta" ? <OpsCountBadge count={olasta} fler={olastaFler} text={t.olastaText} placement="corner" /> : null}
              </button>
            ))}
          </div>
        </div>
        <div className="shrink-0 px-3 py-1.5">
          <label className="flex min-h-9 items-center gap-1.5 rounded-base border border-line bg-surface px-2.5 text-ink-muted focus-within:outline-2 focus-within:outline-accent">
            <SokIkon size={14} />
            <input
              type="search"
              value={sok}
              onChange={(e) => setSok(e.target.value)}
              placeholder={t.sok}
              aria-label={t.sok}
              className="min-w-0 flex-1 bg-transparent text-hjalp text-ink outline-none placeholder:text-ink-muted"
            />
            {sok ? (
              <button type="button" onClick={() => setSok("")} aria-label={t.rensaSok} className="inline-flex cursor-pointer text-ink-muted hover:text-ink">
                <KryssIkon size={14} />
              </button>
            ) : null}
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {fel ? (
            <OpsBanner tone="danger" title={t.fel}>
              {fel.message}
            </OpsBanner>
          ) : laddar ? (
            <p className="m-0 px-2 py-6 text-center text-meta text-ink-muted" role="status">
              …
            </p>
          ) : poster.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-10 text-center">
              <span className="text-ink-muted">
                <MeddelandeIkon size={40} />
              </span>
              <p className="m-0 mt-3 text-etikett text-ink-muted">{sok.trim() ? t.ingenTraff : filter === "olasta" ? t.tomtOlasta : t.tomt}</p>
            </div>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {poster.map((post) => {
                if (post.typ === "agent") {
                  const aktivAgent = listadAgent === post.agent || amnesAgent === post.agent;
                  const m = namn.get(post.agent);
                  return (
                    <li key={`agent-${post.agent}`}>
                      <button
                        type="button"
                        data-agentrad={post.agent}
                        aria-current={aktivAgent || undefined}
                        onClick={() => valj(null, { agent: post.agent })}
                        className={cx(
                          "flex w-full cursor-pointer items-center gap-3 rounded-card px-3 py-1.5 text-left transition-colors duration-(--duration-fast) ease-standard focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                          aktivAgent ? "bg-hover" : "hover:bg-hover",
                        )}
                      >
                        <span className="relative shrink-0">
                          <span aria-hidden="true" className="inline-flex">
                            <OpsIdentity name={m?.namn || t.agent} seed={post.agent} size="md" icon={AgentIkon} rund />
                          </span>
                          <OpsCountBadge count={post.olasta} fler={post.olastaFler} text={t.olastaText} placement="corner" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className={cx("min-w-0 flex-1 truncate text-etikett font-medium", post.olasta > 0 ? "text-ink" : "text-ink-secondary")}>
                              {namnFor(post.agent)}
                              <span className="font-normal text-ink-muted">, {t.gruppensAgent}</span>
                            </span>
                            {post.senaste ? <span data-tid="" className="shrink-0 text-liten tabular-nums text-ink-muted">{radtid(post.senaste.tid, nu, locale)}</span> : null}
                          </span>
                          <span data-agentrad-antal="" className="mt-0.5 block truncate text-meta text-ink-muted">
                            {post.rader.length === 0 ? t.ingaSamtalAgent : `${t.antalSamtal.replace("{n}", String(post.rader.length))}${post.senaste ? `, ${t.senast} ${radtid(post.senaste.tid, nu, locale)}` : ""}`}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                }
                const r = post.r;
                const aktiv = r.samtal.id === valdId;
                const s = r.senaste;
                return (
                  <li key={r.samtal.id}>
                    <button
                      type="button"
                      data-samtalsrad={r.samtal.slag}
                      aria-current={aktiv || undefined}
                      onClick={() => valj(r.samtal.id)}
                      className={cx(
                        "flex w-full cursor-pointer items-center gap-3 rounded-card px-3 py-1.5 text-left transition-colors duration-(--duration-fast) ease-standard focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                        aktiv ? "bg-hover" : "hover:bg-hover",
                      )}
                    >
                      <span className="relative shrink-0">
                        <span aria-hidden="true" className="inline-flex">
                          {markeFor(r, "md")}
                        </span>
                        <OpsCountBadge count={r.olasta} fler={r.olastaFler === true} text={t.olastaText} placement="corner" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={cx("min-w-0 flex-1 truncate text-etikett font-medium", r.olasta > 0 ? "text-ink" : "text-ink-secondary")}>{rubrikFor(r)}</span>
                          {s ? <span data-tid="" className="shrink-0 text-liten tabular-nums text-ink-muted">{radtid(s.tid, nu, locale)}</span> : null}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1">
                          <span data-slag="" className={cx("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-liten", arDelatSamtal(r.samtal.slag) ? "bg-hover text-ink-secondary" : "bg-accent-faint text-accent")}>
                            {!arDelatSamtal(r.samtal.slag) ? <LasIkon size={10} /> : null}
                            {slagetFor(r)}
                          </span>
                        </span>
                        {s ? (
                          <span className={cx("mt-0.5 block truncate text-meta", r.olasta > 0 ? "text-ink-secondary" : "text-ink-muted")}>
                            <span className="text-ink-muted" data-namn-saknas={s.av !== uid && namnFor(s.av) === NAMN_SAKNAS ? "" : undefined}>{avNamnFor(namnFor, s, uid, t.du, sprak)}: </span>
                            {synligText(s)}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* ── Samtalet, eller läget "nytt" ─────────────────────────────────────────────────────── */}
      <section
        aria-label={nyttLage ? t.nytt : vald ? rubrikFor(vald) : t.valjSamtal}
        className={cx("min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden bg-surface md:flex md:rounded-xl", hoger ? "flex" : "hidden")}
      >
        {hoger && !(vald && tradId) && !iAmne ? (
          /* Telefon: en rad "‹ Tillbaka" överst, som SS (`ChatInboxPanel.jsx:880-892`). Läget "nytt" har samma rad.
             ⛔ INTE I EN TRÅD (0.68.0): tråden har sin egen rad tillbaka till gruppchatten, och två rader tillbaka ovanför
             varandra, till två olika ställen, är samma sorts dubblering som den dubblerade hamburgaren i #164. */
          <button
            type="button"
            onClick={() => valj(null)}
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 border-b border-line px-3 text-meta text-ink-secondary hover:text-ink md:hidden"
          >
            <ChevronVansterIkon size={14} />
            <span>{t.tillbaka}</span>
          </button>
        ) : null}
        {nyttLage && groupId ? (
          /*
           * ⛔ EN NY `NyttSamtal` PER GRUPP. Annars stod mottagaren och ett fel från `oppnaPrivat` i g kvar i h när appen
           * styr läget och det överlever bytet. Utkastet följer med ut: det är avsett. Det skrevs till någon i g, och
           * mottagarna i h är andra människor. Ett utkast som bytte grupp med en är ett meddelande till fel personer.
           */
          <NyttSamtal
            key={groupId}
            utkast={nyttUtkast}
            gruppMarke={<OpsIdentity name={gruppNamn} seed={groupId} size="sm" icon={GruppIkon} />}
            kalla={kalla}
            uid={uid}
            groupId={groupId}
            medlemmar={medlemmar}
            texter={t}
            sprak={sprak}
            onOppnat={(s, text) => {
              // Ett samtal i en grupp som inte längre visas når aldrig hit: `NyttSamtal` monteras om per grupp (`key`), och en
              // avmonterad gör ingenting med svaret (`monterad`). En egen gruppkontroll här var grön utan sig själv i varje prov
              // och togs bort i fjärde varvet av granskningen av PR 264 (regel 4).
              utkast.current = { id: s.id, text };
              // ⛔ Som SS (`ChatInboxPanel.jsx:484-487`): filtret och sökningen nollas, annars döljer "Olästa" det nya samtalet.
              setFilter("alla");
              setSok("");
              laggIn(s);
              valj(s.id);
            }}
          />
        ) : nyttAmneLage && groupId && nyAgent ? (
          /* ⛔ ETT NYTT ÄMNE ÄR INTE SKRIVET (0.106.0): `nyttAmne` ger id:t, och första Skicka skapar samtalet och meddelandet. */
          <NyttAmne
            key={`${groupId}|${nyAgent}`}
            kalla={/** @type {any} */ (kalla)}
            uid={uid}
            groupId={groupId}
            agent={nyAgent}
            utkast={nyttUtkast}
            samtalsprops={{ postkort, onTranscribe, onStoppaAgent, inspelare, igenkanning, namnFor, medlemmar, sprak, texter: t, onBifoga, franBiblioteket, mejl, onVisaAgent, onForslag, meddelandeHref, flerOmnamnbara }}
            marke={<OpsIdentity name={namn.get(nyAgent)?.namn || t.agent} seed={nyAgent} size="md" icon={AgentIkon} rund />}
            onTillbaka={() => valj(null, { agent: nyAgent })}
            onSkapat={(s, m) => {
              laggIn(s, m);
              valj(s.id);
            }}
          />
        ) : listadAgent && groupId ? (
          <AgentensSamtal
            key={`${groupId}|${listadAgent}`}
            kalla={/** @type {any} */ (kalla)}
            uid={uid}
            groupId={groupId}
            agent={listadAgent}
            agentnamn={namnFor(listadAgent)}
            marke={<OpsIdentity name={namn.get(listadAgent)?.namn || t.agent} seed={listadAgent} size="md" icon={AgentIkon} rund />}
            rader={rader.filter((r) => r.samtal.slag === "agent" && r.motpart === listadAgent)}
            texter={t}
            locale={locale}
            onValj={(sid) => valj(sid)}
            onNytt={() => valj(null, { nytt: "agent", agent: listadAgent })}
            onAndrat={lasOm}
          />
        ) : vald && tradId ? (
          <OpsTrad
            key={`${vald.samtal.id}|${tradId}`}
            postkort={postkort}
            onTranscribe={onTranscribe}
            onStoppaAgent={onStoppaAgent}
            inspelare={inspelare}
            igenkanning={igenkanning}
            kalla={kalla}
            uid={uid}
            samtal={vald.samtal}
            tid={tradId}
            gruppNamn={gruppNamn}
            namnFor={namnFor}
            medlemmar={medlemmar}
            onStang={() => valjTrad(null)}
            // ⛔ (0.203.0) Ett eget svar syns i märket direkt, ett mer och som det senaste, och raden räknas ändå om när den visas igen
            // (`efterEgetSvar`). Förut blev antalet okänt, och märket stod "… svar" tills det räknats.
            onSvarat={(/** @type {any} */ m) =>
              andraTradrad(vald.samtal.id, tradId, efterEgetSvar(tradminne.current.get(vald.samtal.id)?.get(tradId), m, typeof (/** @type {any} */ (kalla)).senasteSvar === "function"))
            }
            onDopt={(/** @type {string | null} */ n) => andraTradrad(vald.samtal.id, tradId, { finns: true, namn: n ?? undefined })}
            sprak={sprak}
            texter={t}
            onBifoga={onBifoga}
            franBiblioteket={franBiblioteket}
            mejl={mejl}
            onLyftTillMinnet={onLyftTillMinnet}
            minneHref={minneHref}
            onVisaAgent={onVisaAgent}
            meddelandeHref={meddelandeHref}
            flerOmnamnbara={flerOmnamnbara}
          />
        ) : vald?.ej && groupId ? (
          <OppnaGruppchatt key={vald.samtal.id} kalla={kalla} uid={uid} groupId={groupId} tagg={vald.samtal.slag === "projekt" ? projekttaggUr(vald.samtal.id, groupId) : null} texter={t} onOppnad={(s) => laggIn(s)} />
        ) : vald ? (
          <OpsSamtal
            key={vald.samtal.id}
            postkort={postkort}
            onTranscribe={onTranscribe}
            onStoppaAgent={onStoppaAgent}
            inspelare={inspelare}
            igenkanning={igenkanning}
            // ⛔ Om källan har trådar avgör OpsSamtal själv (`harTradar`), en vakt och inte två (regel 4).
            onOppnaTrad={valjTrad}
            tradminne={tradminne.current}
            fokusRot={fokusRot}
            onFokuserad={() => setFokusRot(null)}
            kalla={kalla}
            uid={uid}
            samtal={vald.samtal}
            rubrik={rubrikFor(vald)}
            marke={markeFor(vald, "md")}
            // ⛔ (0.106.0) Läsmärket bara när inkorgen har raden: ett samtal öppnat ur adressen har inget känt märke än.
            lastTill={allaRader.some((r) => r.samtal.id === vald.samtal.id && !r.ej) ? vald.lastTill : undefined}
            namnFor={namnFor}
            medlemmar={medlemmar}
            onLast={lasOm}
            onSkickat={(m) => laggIn(vald.samtal, m)}
            utkast={utkast.current?.id === vald.samtal.id ? utkast.current.text : undefined}
            sprak={sprak}
            texter={t}
            onBifoga={onBifoga}
            franBiblioteket={franBiblioteket}
            mejl={mejl}
            onVisaAgent={onVisaAgent}
            onForslag={onForslag}
            meddelandeHref={meddelandeHref}
            flerOmnamnbara={flerOmnamnbara}
            {...(iAmne && amnesAgent ? { amne: { agentnamn: namnFor(amnesAgent), onTillbaka: () => valj(null, { agent: amnesAgent }), onAndrat: lasOm } } : {})}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <span className="text-ink-muted opacity-50">
              <MeddelandeIkon size={48} />
            </span>
            <p className="m-0 mt-3 text-etikett font-medium text-ink-muted">{t.valjSamtal}</p>
          </div>
        )}
      </section>
    </div>
    </OpsSprakProvider>
  );
}

/**
 * Hur mycket av fönstret tangentbordet täcker, i pixlar, ur `visualViewport` (0.106.0, #386 skiva 5). 0 utan tangentbord, och 0 där
 * API:t saknas. Sedan 0.195.0 är det `useTangentbordTackt` i `lib/tangentbord.js`, delad med gästens chatt (regel 2).
 *
 * ⛔ VARFÖR. Höjden var `100dvh` minus skalets ramar, och `dvh` följer inte iOS-tangentbordet: fönstret som layouten räknar med står
 * kvar, och tangentbordet läggs över dess nedre del. Skrivfältet kunde då hamna under tangentbordet. Ramverket visste det redan
 * (`OpsSkapaPanel.jsx`, samma `visualViewport`), men chatten gjorde det inte. Här dras det tangentbordet täcker av från chattens höjd,
 * i stället för bottenraden som det ändå ligger över (`max()` i klassen), så att skrivfältet står ovanför tangentbordet.
 *
 * ⛔ (hypotes, inte mätt på en riktig iPhone) Chromium har inget virtuellt tangentbord. Skalytan prövar med ett `visualViewport` som
 * krymper, check-skalyta 47 (5), och en riktig iPhone är inte mätt.
 */
const useTangentbord = useTangentbordTackt;

/**
 * Gruppchatten som ingen har öppnat än (0.68.0): skapas med `oppnaGrupp` när någon öppnar raden, och läggs sedan in i listan
 * (`onOppnad`), så att vyn ritar det riktiga samtalet. Fel står kvar som en banderoll, aldrig tyst.
 * (0.215.0) Med `tagg`: ett projekts chatt, med `oppnaProjekt`. Källan utan projekt kastar, och felet står som banderollen.
 *
 * @param {{ kalla: ReturnType<typeof import("../data/samtalskalla.js").createSamtalskalla>, uid: string, groupId: string, tagg?: string | null, texter: Required<Meddelandetexter>, onOppnad: (s: import("../lib/samtal.js").Samtal) => void }} props
 */
function OppnaGruppchatt({ kalla, uid, groupId, tagg = null, texter: t, onOppnad }) {
  const [fel, setFel] = useState(/** @type {string | null} */ (null));
  useEffect(() => {
    let levande = true;
    const oppnad =
      tagg === null
        ? kalla.oppnaGrupp({ groupId, uid })
        : harProjekt(kalla)
          ? kalla.oppnaProjekt({ groupId, uid, tagg })
          : Promise.reject(new Error("Samtalskällan saknar projektens chattar (createSamtalskalla({ projekt: true })), och projektets chatt går inte att öppna."));
    oppnad.then(
      (s) => levande && onOppnad(s),
      (e) => levande && setFel(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      levande = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kalla, groupId, uid, tagg]);
  return (
    <div data-ops-oppnar-grupp="" aria-busy={!fel || undefined} className="flex min-h-0 flex-1 flex-col px-3 py-3">
      {fel ? (
        <OpsBanner tone="danger" title={t.oppnaFel}>
          {fel}
        </OpsBanner>
      ) : (
        <p role="status" className="m-0 py-6 text-center text-meta text-ink-muted">
          {tagg !== null ? t.oppnarProjekt : t.oppnarGrupp}
        </p>
      )}
    </div>
  );
}

/**
 * Ett nytt ämne med agenten (0.106.0, #386 skiva 2): samtalsvyn med ett ämne som inte är skrivet än. Id:t tas en gång när vyn
 * öppnas (`nyttAmne`), och första Skicka skapar samtalet och meddelandet (`skickaIAmne`). Ett Nytt samtal som ångras lämnar
 * ingenting efter sig.
 *
 * @param {{ kalla: any, uid: string, groupId: string, agent: string, utkast?: string, marke: import("react").ReactNode, samtalsprops: Record<string, any>, onTillbaka: () => void, onSkapat: (s: import("../lib/samtal.js").Samtal, m: any) => void }} props
 */
function NyttAmne({ kalla, uid, groupId, agent, utkast, marke, samtalsprops, onTillbaka, onSkapat }) {
  const [samtal] = useState(() => kalla.nyttAmne({ groupId, uid, agent }));
  const p = /** @type {any} */ (samtalsprops);
  return (
    <OpsSamtal
      {...p}
      kalla={kalla}
      uid={uid}
      samtal={samtal}
      rubrik=""
      marke={marke}
      utkast={utkast ?? ""}
      ny
      amne={{ agentnamn: p.namnFor(agent), onTillbaka }}
      onSkapat={onSkapat}
    />
  );
}

/**
 * Agentens samtal (0.106.0, #386 skiva 2, skissen CP godkände): "Nytt samtal" överst, och under den ett samtal per ämne med
 * rubriken, senaste raden och tiden. Arkiverade ämnen läses först när "Visa arkiverade" trycks, och då en gång.
 *
 * ⛔ RADERNA KOMMER UR INKORGENS ÖVERSIKT, de läses inte en gång till. Inkorgen har redan läst varje ämnes senaste meddelanden och
 * läsmärke, och en andra läsning hade gett två sanningar om samma oläst.
 *
 * @param {{ kalla: any, uid: string, groupId: string, agent: string, agentnamn: string, marke: import("react").ReactNode, rader: ReadonlyArray<any>, texter: Required<Meddelandetexter>, locale: string, onValj: (sid: string) => void, onNytt: () => void, onAndrat?: () => void }} props
 */
function AgentensSamtal({ kalla, uid, groupId, agent, agentnamn, marke, rader, texter: t, locale, onValj, onNytt, onAndrat }) {
  const [arkiv, setArkiv] = useState(/** @type {{ oppen: boolean, rader: any[] | null, fel: string | null }} */ ({ oppen: false, rader: null, fel: null }));
  const nu = Date.now();
  // ⛔ 0.141.0: "Ta fram" väntar på servern innan raden flyttar sig. Knappen visar det (snurra, aria-busy) och låser alla "Ta fram" så ett andra tryck inte startar ett till.
  const [framtar, setFramtar] = useState(/** @type {string | null} */ (null));
  const lasArkiv = () => {
    setArkiv({ oppen: true, rader: null, fel: null });
    kalla.oversikt({ groupId, uid, arkiverade: true }).then(
      (/** @type {any[]} */ r) => setArkiv({ oppen: true, rader: r.filter((x) => x.motpart === agent), fel: null }),
      (/** @type {any} */ e) => setArkiv({ oppen: true, rader: null, fel: e instanceof Error ? e.message : String(e) }),
    );
  };
  const taFram = async (/** @type {string} */ sid) => {
    if (framtar !== null) return;
    setFramtar(sid);
    try {
      await kalla.arkivera(sid, false);
      onAndrat?.();
      lasArkiv();
    } catch (e) {
      setArkiv((a) => ({ ...a, fel: `${t.arkivFel} ${e instanceof Error ? e.message : String(e)}` }));
    } finally {
      setFramtar(null);
    }
  };
  /** @param {any} r @param {boolean} arkiverad */
  const rad = (r, arkiverad) => {
    const s = r.senaste;
    const rubrik = amnesrubrik(r.samtal, r.forsta ?? (s ? [s] : []), t.samtalUtanText);
    return (
      <li key={r.samtal.id} className="flex items-center gap-1">
        <button
          type="button"
          data-amnesrad={r.samtal.id}
          onClick={() => onValj(r.samtal.id)}
          className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-card px-3 py-2 text-left transition-colors duration-(--duration-fast) ease-standard hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-2">
              <span className={cx("min-w-0 flex-1 truncate text-etikett font-medium", r.olasta > 0 ? "text-ink" : "text-ink-secondary")}>{rubrik}</span>
              {s ? <span data-tid="" className="shrink-0 text-liten tabular-nums text-ink-muted">{radtid(s.tid, nu, locale)}</span> : null}
            </span>
            {s ? (
              <span className={cx("mt-0.5 block truncate text-meta", r.olasta > 0 ? "text-ink-secondary" : "text-ink-muted")}>
                <span className="text-ink-muted">{s.av === uid ? t.du : agentnamn}: </span>
                {synligText(s)}
              </span>
            ) : null}
          </span>
          <OpsCountBadge count={r.olasta} fler={r.olastaFler === true} text={t.olastaText} />
        </button>
        {arkiverad ? (
          <button
            type="button"
            data-ta-fram={r.samtal.id}
            disabled={framtar !== null}
            aria-busy={framtar === r.samtal.id || undefined}
            onClick={() => taFram(r.samtal.id)}
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1 rounded-base px-2 text-meta text-accent hover:bg-accent-faint focus-visible:outline-2 focus-visible:outline-accent"
          >
            {framtar === r.samtal.id ? <OpsSpinner size="sm" tone="current" decorative /> : <TaFramIkon size={14} />}
            {t.taFram}
          </button>
        ) : null}
      </li>
    );
  };
  return (
    <div data-agentens-samtal={agent} className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-3 py-2.5">
        {marke}
        <div className="min-w-0 flex-1">
          <h3 className="m-0 truncate text-etikett font-semibold text-ink">{agentnamn}</h3>
          <p className="m-0 flex items-center gap-1 text-liten text-ink-muted">
            <LasIkon size={10} />
            <span className="truncate">{t.gruppensAgent}</span>
          </p>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <button
          type="button"
          data-nytt-amne=""
          onClick={onNytt}
          className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-card border border-dashed border-line px-3 py-2 text-left text-etikett font-medium text-accent transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
          <PlusIkon size={16} />
          {t.nyttSamtal}
        </button>
        {rader.length === 0 ? (
          <p data-amnen-tomt="" className="m-0 px-3 py-4 text-meta text-ink-muted">
            {t.ingaSamtalAgent}
          </p>
        ) : (
          <ul aria-label={t.samtalMed.replace("{namn}", agentnamn)} className="m-0 mt-1 flex list-none flex-col gap-0.5 p-0">
            {[...rader].sort((a, b) => (b.senaste?.tid ?? b.samtal.skapad ?? 0) - (a.senaste?.tid ?? a.samtal.skapad ?? 0)).map((r) => rad(r, false))}
          </ul>
        )}
        <div className="mt-2 border-t border-line pt-1">
          {/* vantar-ej: raden öppnas direkt och visar en snurra under knappen medan arkivet hämtas (OpsSpinner med status) */}
          <button
            type="button"
            data-visa-arkiverade=""
            aria-expanded={arkiv.oppen}
            onClick={() => (arkiv.oppen ? setArkiv({ oppen: false, rader: null, fel: null }) : lasArkiv())}
            className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-base px-3 text-meta text-ink-secondary hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            <ArkiveraIkon size={14} />
            {arkiv.oppen ? t.doljArkiverade : t.visaArkiverade}
          </button>
          {arkiv.oppen ? (
            arkiv.fel ? (
              <p role="alert" data-arkiv-fel="" className="m-0 px-3 py-2 text-meta text-danger">
                {arkiv.fel}
              </p>
            ) : arkiv.rader === null ? (
              <p className="m-0 px-3 py-2 text-meta text-ink-muted">
                <OpsSpinner size="sm" tone="muted" label="Hämtar" />
              </p>
            ) : arkiv.rader.length === 0 ? (
              <p data-arkiv-tomt="" className="m-0 px-3 py-2 text-meta text-ink-muted">
                {t.ingaArkiverade}
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0">{arkiv.rader.map((r) => rad(r, true))}</ul>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Läget "nytt" i högerpanelen (0.63.0, #263): Till överst, med raden om vem som ser samtalet, och trådens skrivfält längst ned.
 *
 * ⛔ VALET ÖPPNAR SAMTALET DIREKT, innan något är skrivet, som SS "Starta chatt" (`ChatInboxPanel.jsx:1091-1124`, `:477-505`).
 * `oppnaPrivat` ger samma samtal som förra gången (nyckeln är härledd), så ett befintligt samtal öppnas med sin historik och
 * inget nytt skapas. Det första meddelandet skrivs sedan i trådens eget skrivfält, och man står kvar i tråden.
 *
 * ⛔ DET MAN SKRIVIT INNAN VALET FÖLJER MED, och ett Skicka utan mottagare säger vad som saknas i stället för att inte göra något.
 *
 * @param {{ kalla: ReturnType<typeof import("../data/samtalskalla.js").createSamtalskalla>, uid: string, groupId: string, medlemmar: ReadonlyArray<Medlemsrad>, texter: Required<Meddelandetexter>, sprak: string, gruppMarke: import("react").ReactNode, onOppnat: (samtal: import("../lib/samtal.js").Samtal, text: string) => void, utkast?: string }} props
 */
function NyttSamtal({ kalla, uid, groupId, medlemmar, texter: t, sprak, gruppMarke, onOppnat, utkast = "" }) {
  const [mottagare, setMottagare] = useState(/** @type {import("../lib/samtal.js").Mottagare | null} */ (null));
  const [text, setTextState] = useState(utkast);
  // ⛔ Texten läses ur en ref när samtalet öppnats, inte ur stängningen: det man skrev MEDAN `oppnaPrivat` pågick följer med.
  const textNu = useRef(utkast);
  const setText = (/** @type {string} */ v) => {
    textNu.current = v;
    setTextState(v);
  };
  const [fel, setFel] = useState(/** @type {{ falt?: "till", text: string } | null} */ (null));
  const [oppnar, setOppnar] = useState(false);
  const tillId = useId();
  const monterad = useRef(true);
  useEffect(() => {
    monterad.current = true;
    return () => {
      monterad.current = false;
    };
  }, []);

  /** @param {import("../lib/samtal.js").Mottagare} m */
  const oppna = async (m) => {
    // Spärren först: ett andra val medan det första öppnas byter inte mottagare under ett samtal som redan är på väg.
    if (oppnar) return;
    setMottagare(m);
    if (m.slag !== "grupp" && ((m.slag !== "person" && m.slag !== "agent") || !m.uid)) return;
    setFel(null);
    setOppnar(true);
    try {
      // ⛔ "Hela gruppen" (0.68.0) öppnar gruppchatten, och skapar den om ingen har skrivit i den än.
      const s =
        m.slag === "grupp"
          ? await kalla.oppnaGrupp({ groupId, uid })
          : await kalla.oppnaPrivat(m.slag === "agent" ? { groupId, uid, annan: m.uid ?? "", slag: "agent" } : { groupId, uid, annan: m.uid });
      // ⛔ Avmonterad under öppnandet, t.ex. för att man tryckte Tillbaka: tråden öppnas inte bakom ryggen på en som ångrade sig.
      if (!monterad.current) return;
      onOppnat(s, textNu.current);
    } catch (e) {
      // Ingen kontroll av `monterad` här: en setState på en avmonterad komponent gör ingenting i React 18, så en kontroll
      // hade inte gått att se falla (samma skäl som gruppkontrollen i `onOppnat`, fjärde varvet av granskningen av PR 264).
      setFel({ text: e instanceof Error ? e.message : String(e) });
      setOppnar(false);
    }
  };

  return (
    <div data-ops-nytt="" aria-busy={oppnar || undefined} className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center border-b border-line px-3 py-2.5">
        <OpsSkapaRubrik variant="chatt">{t.nytt}</OpsSkapaRubrik>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
        {fel && !fel.falt ? (
          <OpsBanner tone="danger" title={t.oppnaFel}>
            {fel.text}
          </OpsBanner>
        ) : null}
        <span id={tillId} className="text-meta font-medium text-ink-secondary">
          {t.till}
        </span>
        <OpsMottagare lage="person" helaGruppen={t.helaGruppen} gruppMarke={gruppMarke} medlemmar={medlemmar} uid={uid} value={mottagare} onChange={/** @type {(m: import("../lib/samtal.js").Arendemottagare) => void} */ (/** @type {unknown} */ (oppna))} ariaLabel={t.till} tomText={t.ingenAnnan} />
        {/*
          ⛔ RADEN FÖLJER VALET, OCH FINNS INTE INNAN NÅGOT ÄR VALT (0.68.0, omgranskningen av PR 268, A6). Förut stod "Bara ni två
          ser det här" redan innan valet, med "Hela gruppen" först under Till var det fel om det som låg närmast till hands.
          Valet öppnar samtalet direkt, och samtalets huvud säger sedan samma sak.
        */}
        {mottagare ? (
          <p data-privat="" className="m-0 flex items-center gap-1.5 text-meta text-ink-secondary">
            {mottagare.slag !== "grupp" ? <LasIkon size={14} /> : null}
            <span>{mottagare.slag === "grupp" ? t.gruppRad : mottagare.slag === "agent" ? t.agentRad : t.privatRad}</span>
          </p>
        ) : null}
        {fel?.falt === "till" ? (
          <p role="alert" className="m-0 text-meta text-danger">
            {fel.text}
          </p>
        ) : null}
      </div>
      <Skrivfalt
        text={text}
        setText={setText}
        skickar={oppnar}
        texter={t}
        sprak={sprak}
        onSkicka={() => {
          if (!mottagare) setFel({ falt: "till", text: t.valjMottagare });
        }}
      />
    </div>
  );
}

/**
 * @typedef {object} Omnamnande (chattens nattskiva) Vilka som går att nämna i skrivfältet.
 * @property {ReadonlyArray<{ uid: string, namn: string, typ: string }>} kandidater Aktiva medlemmar utom en själv: personer och agenten.
 * @property {boolean} alla Om "@alla" erbjuds (gruppchatten och trådar).
 */

/** Hur många förslag @-listan visar. */
const MAX_FORSLAG = 6;

/**
 * Skrivfältets tak i höjd, i pixlar (0.106.0, #386 skiva 5). Ungefär sex rader i 16 px. Över det rullar fältet inuti sig självt.
 * (bedömning) SS har 120 px; sex rader ryms på en telefon med tangentbordet uppe och lämnar ändå loggen synlig.
 */
export const SKRIVFALT_TAK = 160;

/** Så nära taket visas räknaren, i tecken: `RAKNARE_FRAN` ur `lib/samtal.js` (0.153.0, delad med `OpsKommentarer`). Återexporterad för proven. */
export { RAKNARE_FRAN };

/** Tecknen som inte ska ha ett mellanslag före sig efter ett valt namn (0.213.0, lifehub.app#751). */
const SKILJETECKEN = /^[.,:;!?)\]}…]$/u;

/**
 * Trådens skrivfält: en textruta och knappen Skicka. Samma i ett samtal och i läget "nytt", så att det första meddelandet
 * skrivs på samma ställe som alla andra (SS: trådens `ComposerBar`).
 *
 * ⛔ OMNÄMNANDEN (chattens nattskiva, med `omnamnande`): "@" följt av bokstäver öppnar en lista ur gruppens medlemmar och agenten.
 * Valet skriver `@Namn` i texten och minns UID:t. Vid Skicka går `namner` med de uid vars `@Namn` fortfarande står i texten, så att
 * ett omnämnande man raderat ur texten inte skickas. "@alla" blir `["alla"]`. Listan nås med tangentbordet: pilarna väljer, Enter
 * eller Tab tar valet, Escape stänger.
 *
 * `fokusNyckel`: när den ändras (ett citat valdes) får fältet fokus. `onEscape`: Escape utan öppen lista (avbryter citatet).
 *
 * ══ ⛔ UTSEENDET (CP 2026-10-06, två skärmbilder från en annan app som förebild) ═══════════════════════════════════════════════
 *
 * Till vänster en rund plusknapp; till höger ett avlångt, rundat fält med platstexten ("Skriv till gruppen", "Fråga agenten"). Inne
 * i fältets högra del en grå stoppknapp, bara när något pågår, och en framträdande ljudvåg för röstinmatning. Med text i fältet står
 * Skicka där ljudvågen stod.
 *
 * ⛔ EN KNAPP FINNS BARA NÄR DEN GÖR NÅGOT (samma regel som TALK:s kugghjul):
 *   - plus och dess meny bara med `onBifoga`. "Ta foto" ritas bara när en kamera räknats upp. Med `bilagor: true` på källan
 *     läser `OpsSamtal` och `OpsTrad` filen (`readAttachment`, kommentarernas typer och tak) och skickar den som `bilaga`.
 *     Utan den nyckeln lämnas filerna till appens `onBifoga`, och plus ritas bara om den skickats;
 *   - ljudvågen bara med `onTranscribe(blob) => Promise<text>`. Transkriberingen är appens: ramverket känner ingen tjänst;
 *   - stopp när agenten arbetar, bara med `onStoppaAgent`. Under en inspelning står TALK:s yta i fältets plats, med sitt eget Avbryt.
 *
 * ⛔ RÖSTEN SKICKAS SOM ETT MEDDELANDE, SOM I TALK (0.103.0). Se `useRostinmatning`. Inspelningen är TALK:s (`useTalk`) och ytan är
 * TALK:s (`OpsInspelning`): en inspelningsväg och en inspelningsyta i ramverket, inte två. ⛔ DET SAGDA FÖRSVINNER ALDRIG TYST: faller
 * utskriften eller sändningen står felet i ytan med Försök igen, och ljudet och texten finns kvar tills personen trycker på krysset.
 *
 * `onSkicka` får `{ text }` när det är det sagda som skickas. Den ska då lösa när meddelandet är skickat och avvisa när det inte gick,
 * så att ytan kan säga det; utan `text` skickar den fältets text som förut.
 *
 * @param {{ text: string, setText: (t: string) => void, skickar: boolean, onSkicka: (extra?: { namner?: string[], text?: string }) => void | Promise<void>, texter: Required<Meddelandetexter>, sprak: string, fokus?: boolean, omnamnande?: Omnamnande | null, fokusNyckel?: string, onEscape?: () => void, platstext?: string, onTranscribe?: (blob: Blob) => Promise<string>, inspelare?: import("../lib/talk.js").Inspelare, igenkanning?: import("../lib/talk.js").Igenkanning | boolean, onBifoga?: (filer: File[], slag: "bild" | "foto" | "fil") => void, onOmrostning?: () => void, franBiblioteket?: Franbiblioteket, harBilaga?: boolean, kamera?: "okand" | "ja" | "nej", agentArbetar?: boolean, onStoppaAgent?: () => void, maxTecken?: number, ram?: boolean }} props
 *   `onOmrostning` (cllp/lifehub.app#438): raden "Omröstning" i pluset. Med den ritas pluset också utan `onBifoga`.
 *   `maxTecken` (0.132.0): taket i tecken. Förval `MAX_MEDDELANDE`; en gäst har ett lägre (`GASTSKRIV_MAX_TECKEN`). Räknaren och spärren på Skicka följer det.
 *   ⛔ EXPORTERAD FRÅN FILEN FÖR `OpsGastChatt`, INTE UR RAMVERKET (`src/index.js`): gästens skrivfält är chattens utan bilagor, mikrofon, omnämnanden och agent.
 *   `ram` (0.195.0): fältet står i en panel, med ett streck över sig (`border-t`) och panelens indrag (`px-3`). Förval sant, som i appens chatt, där strecket skiljer fältet från
 *   loggen i samma panel. Gästens chatt sätter `false`: inget streck och inget eget indrag, så att fältet har samma vänster- och högerkant som meddelandena. CP 2026-11-06, med
 *   skärmbilder av gästens chatt: "Du kan ta bort ett streck mellan här också vid chatten. avdelaren." och från telefonen: "Även i telefon finns det extra horisontella strecket som
 *   inte behövs. Sedan kanske skrivfältet kan vara lika brett som chattramen?"
 */
export function Skrivfalt({ text, setText, skickar, onSkicka, texter: t, sprak, fokus = false, omnamnande = null, fokusNyckel, onEscape, platstext, onTranscribe, inspelare, igenkanning, onBifoga, onOmrostning, franBiblioteket, harBilaga = false, kamera = "nej", agentArbetar = false, onStoppaAgent, maxTecken = MAX_MEDDELANDE, ram = true }) {
  const ruta = useRef(/** @type {HTMLTextAreaElement | null} */ (null));
  const listId = useId();
  const raknarId = useId();
  const valda = useRef(/** @type {Map<string, string>} */ (new Map()));
  const [fraga, setFraga] = useState(/** @type {{ start: number, q: string } | null} */ (null));
  const [aktiv, setAktiv] = useState(0);
  useEffect(() => {
    if (fokus) ruta.current?.focus({ preventScroll: true });
    // Bara när fältet monteras: tråden som just öppnades ur läget "nytt" tar emot skrivandet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const forslag = useMemo(() => {
    if (!omnamnande || !fraga) return [];
    const q = fraga.q.toLocaleLowerCase("sv");
    const personer = omnamnande.kandidater.filter((k) => k.namn.toLocaleLowerCase("sv").split(/\s+/).some((d) => d.startsWith(q)) || k.namn.toLocaleLowerCase("sv").startsWith(q));
    const alla = omnamnande.alla && t.allaNamn.toLocaleLowerCase("sv").startsWith(q) ? [{ uid: "alla", namn: t.allaNamn, typ: "alla" }] : [];
    return [...personer, ...alla].slice(0, MAX_FORSLAG);
  }, [omnamnande, fraga, t.allaNamn]);
  const oppen = forslag.length > 0;
  useEffect(() => {
    if (fokusNyckel) ruta.current?.focus({ preventScroll: true });
  }, [fokusNyckel]);
  /**
   * ⛔ OMNÄMNANDENA RÄKNAS PÅ SAMMA SÄTT FÖR DET SKRIVNA OCH DET SAGDA (0.103.0): de uid vars `@Namn` står i texten som skickas.
   * @param {string} ut
   */
  const namnerI = (ut) => {
    const namner = [...valda.current].filter(([, namn]) => ut.includes(`@${namn}`)).map(([uid]) => uid);
    // ⛔ "@alla" står ensamt (modellen): hela gruppen är redan alla.
    return namner.length ? { namner: namner.includes("alla") ? ["alla"] : namner } : undefined;
  };
  /*
   * ══ ⛔ RÖSTEN SOM I TALK, INTE VIA FÄLTET (0.103.0). Logiken är ramverkets gemensamma sedan 0.104.0 (`useRostinmatning`). ══
   *
   * CP 2026-10-14: "Sedan funkar inte tal i meddelanden på samma sätt som TALK, det skall skrivas ut text i realtid och inte gå en
   * omväg via textfältet." Före 0.103.0 skrevs orden in i skrivfältet medan man pratade (0.98.0), och den som stoppade fick rätta och
   * trycka Skicka. Nu står texten i TALK:s yta medan man pratar, och Klar skickar den direkt i den öppna tråden, samma väg som Skicka
   * (`onSkicka({ text })`). Vilken text som skickas står i `useRostinmatning`.
   *
   * ⛔ DET SOM STOD I FÄLTET LIGGER KVAR, OCH BARA DET SAGDA SKICKAS. Mikrofonen står bara i ett fält utan text och utan bilaga (samma
   * villkor som Skickas `disabled`, 0.84.0), och ytan täcker fältet medan den arbetar, så det som kan stå där är blanksteg. Valet gäller
   * ändå för det fall någon ändrar villkoret: ett utkast är personens eget och skickas när hen trycker Skicka. Ett meddelande som
   * skickats går inte att ta tillbaka, medan ett utkast som står kvar syns och går att skicka eller sudda. Att skicka det med det sagda
   * hade gjort ett misstag som inte går att ångra av ett som syns. Ett citat som väntar (Svarar på) går med, som med Skicka.
   * (`OpsTextarea` gör tvärtom och skriver in det sagda i fältet, eftersom ett fält i ett formulär inte skickar något.)
   */
  const rost = useRostinmatning({ onTranscribe, inspelare, igenkanning, texter: rosttexter(t), onTal: (ut) => Promise.resolve(onSkicka({ ...namnerI(ut), text: ut })) });
  const rostyta = useRef(/** @type {HTMLDivElement | null} */ (null));
  // ⛔ FOKUS FÖLJER YTAN (`useRostfokus`). När ytan går tillbaka till fältet får textrutan fokus, som efter Skicka.
  useRostfokus(rost, rostyta, () => ruta.current?.focus({ preventScroll: true }));
  /** @param {string} v @param {number} markor */
  const las = (v, markor) => {
    if (!omnamnande) return setFraga(null);
    const m = v.slice(0, markor).match(/(^|\s)@([\p{L}\p{N}_.-]*)$/u);
    setFraga(m ? { start: markor - m[2].length - 1, q: m[2] } : null);
    setAktiv(0);
  };
  /*
   * ⛔ MELLANSLAGET EFTER ETT VALT NAMN VIKER FÖR ETT SKILJETECKEN (0.213.0, cllp/lifehub.app#751). QA 2026-11-10: väljaren skrev "@claude-dev-ops-architect " och
   * kolonet hamnade efter mellanslaget ("@namn :"). Mellanslaget står där för att man oftast skriver vidare med ett ord. Är nästa tecken i stället ett
   * skiljetecken, och står det direkt efter just det mellanslaget, tas mellanslaget bort: "@namn:". Bara det mellanslag väljaren själv lade dit, och bara
   * för nästa tecken; allt annat man skriver lämnas som det är.
   */
  const autoMellanslag = useRef(/** @type {number | null} */ (null));
  /** @param {{ uid: string, namn: string }} k */
  const valj = (k) => {
    if (!fraga) return;
    const fore = text.slice(0, fraga.start);
    const efter = text.slice(fraga.start + 1 + fraga.q.length);
    const insatt = `@${k.namn} `;
    valda.current.set(k.uid, k.namn);
    setText(`${fore}${insatt}${efter.replace(/^ /, "")}`);
    setFraga(null);
    const pos = fore.length + insatt.length;
    autoMellanslag.current = pos - 1;
    requestAnimationFrame(() => ruta.current?.setSelectionRange(pos, pos));
  };
  /** @param {string} v @param {number} markor @returns {{ v: string, markor: number }} */
  const utanMellanslagForeSkiljetecken = (v, markor) => {
    const plats = autoMellanslag.current;
    autoMellanslag.current = null;
    if (plats === null || v.length !== text.length + 1 || markor !== plats + 2) return { v, markor };
    const tecken = v[plats + 1];
    if (text[plats] !== " " || !SKILJETECKEN.test(tecken) || v !== `${text.slice(0, plats + 1)}${tecken}${text.slice(plats + 1)}`) return { v, markor };
    return { v: `${text.slice(0, plats)}${tecken}${text.slice(plats + 1)}`, markor: plats + 1 };
  };
  const skicka = () => {
    const extra = namnerI(text);
    valda.current = new Map();
    setFraga(null);
    onSkicka(extra);
  };
  /*
   * ══ ⛔ FÄLTET VÄXER MED TEXTEN, TILL ETT TAK (0.106.0, #386 skiva 5) ═════════════════════════════════════════════════════
   *
   * Förut var fältet en rad (`rows={1}`) som rullade inuti sig själv, så den som skrev ett längre svar såg en rad åt gången. Nu följer
   * höjden texten upp till `SKRIVFALT_TAK`. Höjden mäts ur `scrollHeight` efter att den nollställts, i en layouteffekt så att ingen ram
   * ritas med fel höjd. jsdom har ingen layout (`scrollHeight` 0), och då rörs inte höjden.
   */
  useLayoutEffect(() => {
    const el = ruta.current;
    if (!el) return;
    el.style.height = "auto";
    const h = el.scrollHeight;
    if (h <= 0) {
      el.style.height = "";
      return;
    }
    el.style.height = `${Math.min(h, SKRIVFALT_TAK)}px`;
    el.style.overflowY = h > SKRIVFALT_TAK ? "auto" : "hidden";
  }, [text]);
  /*
   * ⛔ INGEN TYST KAPNING (regel 5). Förut stod taket som `maxLength`, och en inklistrad text över 4000 tecken kapades utan ett ord.
   * Nu står hela texten kvar, räknaren syns de sista `RAKNARE_FRAN` tecknen, och över taket säger en rad hur mycket för lång den är
   * och Skicka är avstängd. Samma tak som modellen (`MAX_MEDDELANDE`), som regeln också har.
   */
  const langd = text.trim().length;
  const forLang = langd > maxTecken;
  const visaRaknare = text.length >= maxTecken - RAKNARE_FRAN;
  const visaStopp = agentArbetar && Boolean(onStoppaAgent);
  /*
   * ⛔ EN VALD BILAGA ÄR INNEHÅLL (0.84.0, #315). Ljudvågen står bara där Skicka annars står när fältet verkligen är tomt:
   * ingen text OCH ingen bilaga. Mätt med Playwright vid ompinningen till 0.80.1 (cllp/lifehub.app#134): med en bild vald och
   * tomt fält stod "Prata in" där Skicka skulle stå, så på en pekskärm fanns ingen synlig väg att skicka bilden. Samma villkor
   * som Skicka-knappens `disabled`, så de två kan inte säga olika saker om vad som är tomt (regel 2).
   */
  const tomt = !text.trim() && !harBilaga;
  // ⛔ (0.190.0, CP 2026-11-05: gästen får mikrofon) Webbläsarens taligenkänning räcker som väg, utan appens utskrift: gästen har ingen server som skriver ut ljud.
  // `igenkanning: true` ger ljudvågen bara där webbläsaren har igenkänningen (`webblasarensIgenkanning`), annars hade knappen bara kunnat ge ett fel.
  const harIgenkanning = igenkanning === true ? webblasarensIgenkanning() !== null : Boolean(igenkanning && typeof igenkanning === "object");
  const visaMik = (Boolean(onTranscribe) || harIgenkanning) && tomt;
  /*
   * ⛔ YTAN STÅR I FÄLTETS PLATS MEDAN RÖSTEN ARBETAR (0.103.0). CP 2026-10-14, med en skärmbild av agentchatten där "Skriver ut det
   * inspelade…" stod under skrivfältet: "Sedan funkar inte tal i meddelanden på samma sätt som TALK, det skall skrivas ut text i realtid
   * och inte gå en omväg via textfältet." Därför är det TALK:s egen yta (`OpsInspelning`) som står här: prickarna, tiden, texten som hörs,
   * Avbryt och Klar. Fältet ligger kvar orört under tiden och kommer tillbaka när ytan är klar.
   *
   * `data-rostlage` säger läget för proven och skalytan: "spelar", "skickar", "skriver" (appens utskrift) och "fel".
   */
  if (rost.yta) {
    // ⛔ Ytan ritas på chattens språk, inte bara appens: annars blir det synliga ordet och namnet olika när appen ger `sprak` (0.104.0).
    return (
      <OpsSprakProvider sprak={sprak}>
        <Rostyta rost={rost} klarEtikett={t.talKlar} ytaRef={rostyta} ram="chatt" />
      </OpsSprakProvider>
    );
  }
  return (
    <>
    <form
      data-skrivfalt=""
      className={cx("relative flex shrink-0 items-end gap-2 py-2", ram && "border-t border-line px-3")}
      onSubmit={(e) => {
        e.preventDefault();
        skicka();
      }}
    >
      {onBifoga || onOmrostning ? <Plusmeny onBifoga={onBifoga} onOmrostning={onOmrostning} franBiblioteket={franBiblioteket} texter={t} kamera={kamera === "ja"} kameraKand={kamera !== "okand"} /> : null}
      {/* ⛔ INGEN KANTLINJE RUNT PILLRET (0.196.0, CP 2026-11-06 med en skärmbild av gästens chatt: "Ta bort borders runt chatten och överallt."). En fylld yta, som Signal: det syns ändå var man
          skriver, och platstexten säger vad. Fokus syns med fokusringen (`focus-within:outline`), inte med en kant som byter färg. Samma pill i appens chatt och i gästens. */}
      <div data-skrivruta="" className="flex min-h-11 min-w-0 flex-1 items-end rounded-3xl bg-hover focus-within:outline-2 focus-within:outline-offset-0 focus-within:outline-accent">
      {oppen ? (
        <ul id={listId} role="listbox" aria-label={t.namnForslag} data-omnamnande="" className="absolute bottom-full left-3 z-10 mb-1 max-w-[calc(100%-1.5rem)] min-w-56 list-none overflow-hidden rounded-card border border-line bg-surface p-1 shadow-md">
          {forslag.map((k, i) => (
            <li
              key={k.uid}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === aktiv}
              data-forslag={k.uid}
              onMouseDown={(e) => {
                e.preventDefault();
                valj(k);
              }}
              className={cx("flex min-h-11 cursor-pointer items-center gap-2 rounded-base px-2 text-etikett text-ink", i === aktiv ? "bg-hover" : "")}
            >
              <span className="text-ink-muted">{k.typ === "agent" ? <AgentIkon size={14} /> : k.typ === "alla" ? <GruppIkon size={14} /> : "@"}</span>
              <span className="min-w-0 truncate">{k.namn}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <textarea
        ref={ruta}
        value={text}
        onChange={(e) => {
          const { v, markor } = utanMellanslagForeSkiljetecken(e.target.value, e.target.selectionStart ?? e.target.value.length);
          setText(v);
          las(v, markor);
          if (v !== e.target.value) requestAnimationFrame(() => ruta.current?.setSelectionRange(markor, markor));
        }}
        // ⛔ KLISTRA IN EN BILD (CP 2026-11-09 i Dev: "jag kan inte klippa in en bild i chatten. Det behöver vi kunna"). En inklistring som bär FILER går samma väg som plusmenyn
        // (`onBifoga`): bilder som "bild", annat som "fil". En inklistring med bara text lämnas orörd till fältet, så att vanligt klistrande inte stjäls (samma regel som `OpsFilePicker`).
        // Utan `onBifoga` (en chatt utan bilagor) händer ingenting extra.
        onPaste={
          onBifoga
            ? (e) => {
                const filer = [...(e.clipboardData?.files ?? [])];
                if (!filer.length) return;
                // ⛔ TEXTEN VINNER. Excel, Numbers och Word lägger både texten och en bild av den i urklippet, och den som klistrar in därifrån
                // vill ha texten. Bara ett urklipp utan text (en skärmbild, en kopierad bild) blir en bilaga.
                if (e.clipboardData?.getData("text/plain")) return;
                e.preventDefault();
                // ⛔ ETT ANROP MED ALLA FILERNA, som plusmenyns filval: fler än en ger utkastets synliga fel (`enBilaga`), i stället för att två
                // anrop skriver över varandra och den ena bilagan försvinner tyst.
                onBifoga(filer, filer.every((f) => f.type.startsWith("image/")) ? "bild" : "fil");
              }
            : undefined
        }
        onKeyDown={(e) => {
          if (oppen) {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setAktiv((a) => (a + (e.key === "ArrowDown" ? 1 : forslag.length - 1)) % forslag.length);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              valj(forslag[aktiv] ?? forslag[0]);
              return;
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setFraga(null);
              return;
            }
          }
          if (e.key === "Escape" && onEscape) {
            e.preventDefault();
            onEscape();
            return;
          }
          // ⛔ Enter skickar, Skift plus Enter bryter raden, som SS skrivfält (`ComposerBar.jsx`).
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (!forLang) skicka();
          }
        }}
        rows={1}
        enterKeyHint="send"
        placeholder={platstext ?? t.skriv}
        aria-label={t.skriv}
        aria-invalid={forLang || undefined}
        aria-describedby={visaRaknare ? raknarId : undefined}
        aria-controls={oppen ? listId : undefined}
        aria-activedescendant={oppen ? `${listId}-${aktiv}` : undefined}
        aria-autocomplete={omnamnande ? "list" : undefined}
        // ⛔ 16 PX PÅ TELEFON (0.106.0, #386 skiva 5): iOS Safari zoomar in på ett fält med mindre text när det får fokus, och sidan står
        // sedan inzoomad. `text-brod` är 16 px, `md:text-etikett` behåller 14 px på dator, som bubblorna.
        className="min-h-11 min-w-0 flex-1 resize-none overflow-hidden rounded-3xl bg-transparent px-3.5 py-2.5 text-brod text-ink outline-none placeholder:text-ink-muted md:text-etikett"
      />
      {visaStopp ? (
        <button
          type="button"
          data-stopp="agent"
          aria-label={t.stoppaAgenten}
          onClick={() => onStoppaAgent?.()}
          className="group/knapp inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none"
        >
          {/* ⛔ Träffytan är knappen, 44 px; cirkeln inuti är det man ser. */}
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-surface text-ink-secondary transition-colors duration-(--duration-fast) ease-standard group-hover/knapp:text-ink group-focus-visible/knapp:outline-2 group-focus-visible/knapp:outline-offset-1 group-focus-visible/knapp:outline-accent">
            <StoppIkon size={12} />
          </span>
        </button>
      ) : null}
      {visaMik ? (
        <Mikrofonknapp lage={rost.lage} etikett={t.prataIn} onClick={() => rost.starta()} />
      ) : (
        <button
          type="submit"
          aria-label={t.skicka}
          aria-busy={skickar || undefined}
          disabled={skickar || tomt || forLang}
          className="group/knapp inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none disabled:cursor-default disabled:opacity-40"
        >
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-accent text-accent-contrast transition-colors duration-(--duration-fast) ease-standard group-hover/knapp:bg-accent-hover group-focus-visible/knapp:outline-2 group-focus-visible/knapp:outline-offset-1 group-focus-visible/knapp:outline-accent">
            {skickar ? <OpsSpinner size="sm" tone="current" decorative /> : <SkickaIkon size={16} />}
          </span>
        </button>
      )}
      </div>
    </form>
    {visaRaknare ? (
      <p
        id={raknarId}
        data-langdraknare={forLang ? "over" : "nara"}
        role={forLang ? "alert" : "status"}
        className={cx("m-0 shrink-0 px-4 pb-1.5 text-right text-liten tabular-nums", forLang ? "text-danger" : "text-ink-muted")}
      >
        {forLang ? t.forLang.replace("{over}", String(langd - maxTecken)) : t.langd.replace("{n}", String(text.length)).replace("{max}", String(maxTecken))}
      </p>
    ) : null}
    </>
  );
}

/**
 * ⛔ EXPORTERAD FRÅN FILEN FÖR PROVEN, INTE UR RAMVERKET (`src/index.js`), liksom `texterPa`. `ingenUtskrift` går inte att nå genom
 * chattens yta, eftersom mikrofonen bara ritas med `onTranscribe` (andra granskningsvarvet av PR 384, KAN 2), så språket prövas här.
 *
 * Chattens texter i röstinmatningens form (`useRostinmatning`, 0.104.0). Chatten SKICKAR det sagda, så det är chattens ord som står
 * i ytan, på chattens språk (`ORD_MEDDELANDEN_TAL`).
 * @param {Required<Meddelandetexter>} t
 * @returns {import("./OpsRostinmatning.jsx").Rosttexter}
 */
export function rosttexter(t) {
  return {
    transkriptionFel: t.transkriptionFel,
    ingenUtskrift: t.talIngenUtskrift,
    ingetHordes: t.talIngetHordes,
    lamnaFel: t.talSkickaFel,
    textFel: t.talTextFel,
    skriverUt: t.skriverUt,
    lamnar: t.talSkickar,
  };
}

/**
 * Plusknappen och menyn. ⛔ Raderna lämnar FILERNA till `onBifoga`. Bilagan, i kommentarernas form, byggs av den som äger
 * skrivfältet när källan har `bilagor`. "Ta foto" har `capture` och ritas bara när `kamera` är sann: en enhet utan kamera
 * ska inte erbjuda ett val som inte finns. Menyn stängs med Escape, med fokus tillbaka på plus, och pilarna flyttar mellan raderna.
 *
 * ⛔ EXPORTERAD FRÅN FILEN FÖR PROVEN, INTE UR RAMVERKET (`src/index.js`). Appen kopplar inte in den själv.
 *
 * ⛔ "LÄGG TILL FRÅN BIBLIOTEKET" (0.164.0, lifehub.app#226) ritas bara med `franBiblioteket`. Raden öppnar en väljare med sök i samma ruta som menyn. En vald post hämtas som fil
 * (`franBiblioteket.fil`) och lämnas till `onBifoga` som "fil", samma väg som "Välj fil": ett meddelande bär en bilaga, och kopian i samtalet finns kvar om posten senare tas bort ur Biblioteket.
 * Ett fel skrivs ut i väljaren, aldrig tyst.
 *
 * ⛔ "OMRÖSTNING" (cllp/lifehub.app#438 skiva 1) ritas bara med `onOmrostning`, alltså bara när källan har omröstningar (`harOmrostningar`). Raden öppnar
 * formuläret ovanför skrivfältet. Utan `onBifoga` (en chatt med omröstningar men utan bilagor) står bara den raden i menyn.
 *
 * @param {{ onBifoga?: (filer: File[], slag: "bild" | "foto" | "fil") => void, onOmrostning?: () => void, franBiblioteket?: Franbiblioteket, texter: Required<Meddelandetexter>, kamera?: boolean, kameraKand?: boolean }} props
 *   `kameraKand` (förval sann, proven): när den är falsk står `data-kamera="okand"` tills uppräkningen är klar.
 */
export function Plusmeny({ onBifoga, onOmrostning, franBiblioteket, texter: t, kamera = true, kameraKand = true }) {
  const [oppen, setOppen] = useState(false);
  const [valjer, setValjer] = useState(false);
  const knapp = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const meny = useRef(/** @type {HTMLDivElement | null} */ (null));
  const menyId = useId();
  /** @type {Record<"bild" | "foto" | "fil", { current: HTMLInputElement | null }>} */
  const val = { bild: useRef(null), foto: useRef(null), fil: useRef(null) };
  useEffect(() => {
    if (oppen) /** @type {HTMLElement | null} */ (meny.current?.querySelector("[role=menuitem]") ?? null)?.focus();
  }, [oppen]);
  const stang = () => {
    setOppen(false);
    setValjer(false);
    knapp.current?.focus();
  };
  const rader = /** @type {const} */ ([
    ["bild", t.bifogaBild, <BildIkon key="b" />],
    ["foto", t.taFoto, <KameraIkon key="k" />],
    ["fil", t.valjFil, <MappIkon key="m" />],
  ]).filter(([slag]) => Boolean(onBifoga) && (kamera || slag !== "foto"));
  return (
    <div className="relative shrink-0">
      <button
        ref={knapp}
        type="button"
        data-plus=""
        data-kamera={kameraKand ? (kamera ? "ja" : "nej") : "okand"}
        aria-label={t.bifoga}
        aria-haspopup="menu"
        aria-expanded={oppen}
        aria-controls={oppen ? menyId : undefined}
        onClick={() => setOppen((o) => !o)}
        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-ink transition-colors duration-(--duration-fast) ease-standard hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <PlusIkon size={18} />
      </button>
      {oppen ? (
        <div
          ref={meny}
          id={menyId}
          role="menu"
          aria-label={t.bifoga}
          data-plusmeny=""
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              stang();
            }
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const r = /** @type {HTMLElement[]} */ ([...(meny.current?.querySelectorAll("[role=menuitem]") ?? [])]);
              const i = r.indexOf(/** @type {HTMLElement} */ (document.activeElement));
              r[(i + (e.key === "ArrowDown" ? 1 : r.length - 1)) % r.length]?.focus();
            }
          }}
          className="absolute bottom-full left-0 z-10 mb-2 flex min-w-52 flex-col rounded-card border border-line bg-surface p-1 shadow-md"
        >
          {rader.map(([slag, etikett, ikon]) => (
            <button
              key={slag}
              type="button"
              role="menuitem"
              data-plusrad={slag}
              onClick={() => val[slag].current?.click()}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-base px-3 text-left text-etikett text-ink hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
            >
              <span aria-hidden="true" className="inline-flex text-ink-secondary">{ikon}</span>
              {etikett}
            </button>
          ))}
          {onOmrostning ? (
            <button
              type="button"
              role="menuitem"
              data-plusrad="omrostning"
              onClick={() => {
                setOppen(false);
                onOmrostning();
              }}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-base px-3 text-left text-etikett text-ink hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
            >
              <span aria-hidden="true" className="inline-flex text-ink-secondary"><OmrostningIkon /></span>
              {t.omrostning}
            </button>
          ) : null}
          {franBiblioteket && onBifoga ? (
            <button
              type="button"
              role="menuitem"
              data-plusrad="bibliotek"
              onClick={() => {
                setOppen(false);
                setValjer(true);
              }}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-base px-3 text-left text-etikett text-ink hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
            >
              <span aria-hidden="true" className="inline-flex text-ink-secondary"><MappIkon /></span>
              {t.franBiblioteket}
            </button>
          ) : null}
        </div>
      ) : null}
      {valjer && franBiblioteket && onBifoga ? (
        <Bibliotekvaljare
          kalla={franBiblioteket}
          texter={t}
          onStang={stang}
          onValt={(fil) => {
            onBifoga([fil], "fil");
            stang();
          }}
        />
      ) : null}
      {rader.map(([slag]) => (
        <input
          key={slag}
          ref={val[slag]}
          type="file"
          hidden
          data-plusval={slag}
          tabIndex={-1}
          aria-hidden="true"
          {...(slag === "fil" ? {} : { accept: "image/*" })}
          {...(slag === "foto" ? { capture: "environment" } : {})}
          {...(slag === "fil" ? { multiple: true } : {})}
          onChange={(e) => {
            const filer = [...(e.target.files ?? [])];
            e.target.value = "";
            if (filer.length) onBifoga?.(filer, slag);
            stang();
          }}
        />
      ))}
    </div>
  );
}

/**
 * @typedef {object} Franbiblioteket (0.164.0, lifehub.app#226) Appens väg till sitt bibliotek, för plusmenyns väljare.
 * @property {() => Promise<ReadonlyArray<{ id: string, namn: string }>>} poster Posterna som går att lägga till (filer), i den ordning de ska visas.
 * @property {(id: string) => Promise<File>} fil Hämtar postens innehåll som en fil.
 */

/**
 * Väljaren bakom "Lägg till från Biblioteket": sök och en lista, i samma ruta som plusmenyn. Escape stänger.
 * @param {{ kalla: Franbiblioteket, texter: Required<Meddelandetexter>, onStang: () => void, onValt: (fil: File) => void }} props
 */
function Bibliotekvaljare({ kalla, texter: t, onStang, onValt }) {
  const [poster, setPoster] = useState(/** @type {ReadonlyArray<{ id: string, namn: string }> | null} */ (null));
  const [fel, setFel] = useState(/** @type {string | null} */ (null));
  const [sok, setSok] = useState("");
  const [hamtar, setHamtar] = useState(/** @type {string | null} */ (null));
  useEffect(() => {
    let levande = true;
    kalla.poster().then(
      (lista) => {
        if (levande) setPoster(lista);
      },
      (e) => {
        if (levande) setFel(e instanceof Error ? e.message : String(e));
      },
    );
    return () => {
      levande = false;
    };
  }, [kalla]);
  const q = sok.trim().toLocaleLowerCase();
  const synliga = (poster ?? []).filter((p) => !q || p.namn.toLocaleLowerCase().includes(q));
  const hamtaPost = async (/** @type {string} */ id) => {
    if (hamtar) return;
    setHamtar(id);
    setFel(null);
    try {
      onValt(await kalla.fil(id));
    } catch (e) {
      setFel(e instanceof Error ? e.message : String(e));
      setHamtar(null);
    }
  };
  return (
    <div
      role="dialog"
      aria-label={t.franBiblioteket}
      data-bibliotekvaljare=""
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onStang();
        }
      }}
      className="absolute bottom-full left-0 z-10 mb-2 flex max-h-80 w-72 max-w-[calc(100vw-1.5rem)] flex-col gap-1 rounded-card border border-line bg-surface p-2 shadow-md"
    >
      <input
        type="search"
        // eslint-disable-next-line jsx-a11y/no-autofocus -- väljaren öppnas av ett tryck för att söka, och fokus ska följa med
        autoFocus
        value={sok}
        onChange={(e) => setSok(e.target.value)}
        placeholder={t.sokBiblioteket}
        aria-label={t.sokBiblioteket}
        className="min-h-11 rounded-base border border-line bg-canvas px-3 text-etikett text-ink focus-visible:outline-2 focus-visible:outline-accent"
      />
      {fel ? <p role="alert" className="m-0 px-1 text-etikett text-danger">{fel}</p> : null}
      {poster === null && !fel ? <p className="m-0 px-1 text-etikett text-ink-secondary">{t.bibliotekLaddar}</p> : null}
      {poster !== null && !synliga.length ? <p className="m-0 px-1 text-etikett text-ink-secondary">{t.bibliotekTomt}</p> : null}
      <ul className="m-0 flex list-none flex-col overflow-y-auto p-0">
        {synliga.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              data-bibliotekpost={p.id}
              disabled={Boolean(hamtar)}
              aria-busy={hamtar === p.id || undefined}
              onClick={() => hamtaPost(p.id)}
              className="flex min-h-11 w-full cursor-pointer items-center rounded-base px-3 text-left text-etikett text-ink hover:bg-hover disabled:cursor-default disabled:opacity-60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
            >
              <span className="truncate">{p.namn}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Någon som går att nämna med @ men som inte är en medlem att prata med (lifehub.app#723): en API-nyckels agent. Appen lägger nyckelns medlemskap med status
 * "avslutad", bara för att namnge vad nyckeln skrev, eftersom chatten tar "första aktiva agenten" ur medlemslistan och en nyckel inte får bli något man pratar med.
 *
 * @typedef {object} Omnamnbar
 * @property {string} userId Det som skrivs i `namner` när personen nämns, samma sort id som en medlems.
 * @property {string} [namn] Namnet i listan. Utan det slås id:t upp som för en medlem (`namnFor`).
 * @property {string} [typ] Förval "agent".
 */

/**
 * Vilka som går att nämna: aktiva medlemmar utom en själv, och "@alla" i gruppchatten och trådar, samt de appen ber om (`flerOmnamnbara`). `null` när källan saknar
 * omnämnanden eller samtalet är privat (där finns ingen att nämna som inte redan läser).
 *
 * ⛔ `flerOmnamnbara` LÄGGS BARA TILL KANDIDATERNA (lifehub.app#723). Den är inte medlemmar: agentvalet, mottagarna och medlemslistorna läser `medlemmar` och ser den aldrig.
 * Den som redan är kandidat (en aktiv medlem) och en själv läggs inte till en gång till.
 *
 * @param {unknown} kalla @param {string} slag @param {ReadonlyArray<Medlemsrad> | undefined} medlemmar @param {string} uid
 * @param {(uid: string) => string} namnFor
 * @param {ReadonlyArray<Omnamnbar>} [fler]
 * @returns {Omnamnande | null}
 */
function omnamnandeFor(kalla, slag, medlemmar, uid, namnFor, fler) {
  // (0.215.0) Omnämnanden i gruppchatten och i ett projekts chatt: rum för flera. Kandidaterna är gruppens medlemmar, aldrig projektets gäster (en gäst har inget uid att nämna).
  if (!harOmnamnanden(kalla) || !arDelatSamtal(slag)) return null;
  const kandidater = (medlemmar ?? [])
    .filter((m) => m && m.userId !== uid && (m.status ?? "aktiv") === "aktiv")
    .map((m) => ({ uid: m.userId, namn: namnFor(m.userId), typ: m.typ ?? "person" }));
  const finns = new Set([uid, ...kandidater.map((k) => k.uid)]);
  for (const o of fler ?? []) {
    if (!o || typeof o.userId !== "string" || o.userId === "" || finns.has(o.userId)) continue;
    finns.add(o.userId);
    kandidater.push({ uid: o.userId, namn: o.namn?.trim() || namnFor(o.userId), typ: o.typ ?? "agent" });
  }
  return { kandidater, alla: true };
}

/**
 * "okand" tills enheterna räknats, sedan "ja" eller "nej". Utan API:t är svaret "nej": ingen kamera att erbjuda.
 * @returns {"okand" | "ja" | "nej"}
 */
function useHarKamera() {
  const [lage, setLage] = useState(/** @type {"okand" | "ja" | "nej"} */ ("okand"));
  useEffect(() => {
    let levande = true;
    const md = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (!md || typeof md.enumerateDevices !== "function") {
      setLage("nej");
      return undefined;
    }
    md.enumerateDevices().then(
      (lista) => {
        if (levande) setLage(lista.some((d) => d && d.kind === "videoinput") ? "ja" : "nej");
      },
      () => {
        if (levande) setLage("nej");
      },
    );
    return () => {
      levande = false;
    };
  }, []);
  return lage;
}

/**
 * Bilagan som väntar i skrivfältet.
 *
 * ⛔ MED `bilagor` PÅ KÄLLAN LÄSER RAMVERKET FILEN. En sökväg appen skickar in hade varit ett andra ställe som bestämmer vad
 * en bilaga är, och en fil som blir föräldralös när meddelandet inte går att skriva. Utan nyckeln är `onBifoga` appens: pluset
 * ritas, och filerna lämnas dit. Skickas båda vinner källan, eftersom det är den regeln släpper in.
 *
 * @param {unknown} kalla
 * @param {((filer: File[], slag: "bild" | "foto" | "fil") => void) | undefined} onBifogaProp
 * @param {Required<Meddelandetexter>} texter
 */
function useBilageutkast(kalla, onBifogaProp, texter) {
  const [bilaga, setBilaga] = useState(/** @type {import("../lib/file.js").Bilaga | null} */ (null));
  const [fel, setFel] = useState(/** @type {string | null} */ (null));
  // ⛔ En fil som läses räknas som vald redan medan den läses: två snabba val hade annars båda kommit fram och den sista vunnit.
  const vantar = useRef(false);
  const kamera = useHarKamera();
  const med = harBilagor(kalla);
  /*
   * ⛔ EN BILAGA PER MEDDELANDE, OCH DET SÄGS (0.213.0, cllp/lifehub.app#751). QA 2026-11-10 på en dator: Bifoga bild en andra gång ersatte den första utan ett ord.
   * Mätt i modellen: ett meddelande bär ETT märke `bilaga: { namn, typ }` (`byggMeddelande`, `MEDDELANDEFALT` och regelns `hasOnly`), och filen ligger i ETT
   * dokument med meddelandets id som nyckel (`bilagenyckel`). Flera bilagor är alltså en ny datamodell: en lista på märket, en nyckel per fil, regler som binder
   * varje fil till sitt märke, och Chattinfo som räknar dem. Det är ett eget beslut och inte en rättning. Tills dess ersätts inget tyst: ett andra val står kvar
   * som ett besked (`enBilagaRedan`), och den första bilagan ligger kvar tills den skickas eller tas bort.
   *
   * ⛔ OCH DET SOM INTE KAN VISAS SÄGS VID VALET, INTE EFTER SKICKA. Filen prövas med `kommentarbilagaFel`, samma prövning som bubblan gör när den läser filen.
   * `readAttachment` prövar typen och storleken; namnets längd och resten prövades förut först när meddelandet byggdes.
   */
  /** @param {File[]} filer @param {"bild" | "foto" | "fil"} _slag */
  const las = async (filer, _slag) => {
    setFel(null);
    if (bilaga || vantar.current) {
      setFel(texter.enBilagaRedan);
      return;
    }
    if (filer.length !== 1) {
      setFel(texter.enBilaga);
      return;
    }
    vantar.current = true;
    try {
      const b = await readAttachment(filer[0], { maxChars: MAX_KOMMENTARBILAGA, typer: KOMMENTARBILAGA_TYPER });
      const ogiltig = kommentarbilagaFel(b);
      if (ogiltig) throw new Error(texter.bilagaGarInteAttSkicka.replace("{skal}", ogiltig));
      setBilaga(b);
    } catch (e) {
      setBilaga(null);
      setFel(e instanceof Error ? e.message : String(e));
    } finally {
      vantar.current = false;
    }
  };
  return {
    bilaga,
    fel,
    tom: () => {
      setBilaga(null);
      setFel(null);
    },
    onBifoga: med ? las : onBifogaProp,
    kamera,
  };
}

/**
 * Förhandsvisningen ovanför skrivfältet, och felet när filen inte gick att bifoga. Inget av det är tyst.
 * @param {{ bilaga: import("../lib/file.js").Bilaga | null, fel: string | null, onTaBort: () => void, texter: Required<Meddelandetexter> }} props
 */
function Bilageutkast({ bilaga, fel, onTaBort, texter: t }) {
  if (!bilaga && !fel) return null;
  return (
    <div data-bilageutkast="" className="flex shrink-0 flex-col gap-1 border-t border-line px-3 pt-2">
      {fel ? (
        <p role="alert" data-bilagefel="" className="m-0 text-meta text-danger">
          {fel}
        </p>
      ) : null}
      {bilaga ? (
        <div className="flex items-start gap-2">
          <BilagaVisning bilaga={bilaga} alt={`${t.bilagaText}: ${bilaga.namn}`} marke="data-meddelande-bilaga" />
          <button
            type="button"
            aria-label={t.taBortBilaga}
            onClick={onTaBort}
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-base px-2 text-meta text-ink-secondary hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            {t.taBortBilaga}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Deltagaren som är agent i ett agentsamtal. Tom sträng när det inte går att veta vem.
 *
 * @param {{ slag?: string, deltagare?: ReadonlyArray<string> }} samtal
 * @param {string} uid
 * @param {ReadonlyArray<{ userId?: string, typ?: string }> | null | undefined} medlemmar
 */
function agentDeltagare(samtal, uid, medlemmar) {
  const deltagare = Array.isArray(samtal.deltagare) ? samtal.deltagare : [];
  const annan = deltagare.find((id) => typeof id === "string" && id && id !== uid);
  if (annan) return annan;
  const m = (medlemmar ?? []).find((x) => x?.typ === "agent" && typeof x.userId === "string" && x.userId);
  return m?.userId ?? "";
}

/**
 * Ett samtal: huvudet, meddelandena och skrivfältet. Samma vy för gruppchatten, ett privat samtal och ett agentsamtal.
 *
 * ⛔ LÄSMÄRKET FLYTTAS NÄR SAMTALET ÄR ÖPPET OCH NÅGOT NYTT FINNS, och bara framåt. Den som har samtalet öppet har sett
 * det som står där.
 *
 * @param {object} props
 * @param {ReturnType<typeof import("../data/samtalskalla.js").createSamtalskalla>} props.kalla
 * @param {string} props.uid
 * @param {import("../lib/samtal.js").Samtal} props.samtal
 * @param {string} props.rubrik
 * @param {import("react").ReactNode} [props.marke]
 * @param {number} [props.lastTill]
 * @param {(uid: string) => string} props.namnFor
 * @param {ReadonlyArray<Medlemsrad>} [props.medlemmar]
 * @param {() => void} [props.onLast] Anropas när läsmärket flyttats, så att inkorgens räknare kan läsas om.
 * @param {(meddelande: import("../lib/samtal.js").Meddelande & { id: string }) => void} [props.onSkickat] (0.63.0, #263) Anropas med
 *   det skickade meddelandet, så att inkorgen kan lägga in raden direkt i stället för vid nästa omläsning.
 * @param {string} [props.utkast] (0.63.0) Text som redan står i skrivfältet när samtalet öppnas, och fältet får fokus.
 * @param {(tid: string) => void} [props.onOppnaTrad] (0.68.0) Öppnar tråden ur ett meddelande. Utelämnad, eller en källa utan
 *   trådar (`harTradar`): inga trådar visas.
 * @param {Map<string, Map<string, Tradrad>>} [props.tradminne] (0.68.0) Märkenas minne per samtal, så att en återkomst från en tråd
 *   inte läser alla rötter igen. Utelämnat: ett eget minne som lever så länge vyn.
 * @param {string | null} [props.fokusRot] (0.68.0) Märket som ska få fokus när det ritats, efter att tråden stängts.
 * @param {() => void} [props.onFokuserad] (0.68.0) Anropas när fokus har flyttats dit.
 *   ⛔ GÄLLER BARA GRUPPCHATTEN, och det avgörs här och inte av den som skickar in funktionen: ett privat samtal ritas utan
 *   trådar också när en app skickar den.
 * @param {string} [props.sprak]
 * @param {Meddelandetexter} [props.texter]
 * @param {Postkort} [props.postkort] (chattens nattskiva) Länkar till appens poster som kort.
 * @param {(f: { sid: string, mid: string, id: string }) => Promise<import("../lib/forslag.js").Forslagssvar>} [props.onForslag] (0.105.0) Förslagen under agentens svar, se `OpsMeddelanden`.
 * @param {(blob: Blob) => Promise<string>} [props.onTranscribe] (chattens nattskiva) Appens transkribering. Med den ritas ljudvågen i
 *   skrivfältet. ⛔ (0.103.0) Det sagda skickas som ett meddelande när man trycker Klar, och `onTranscribe` används bara när inget av det
 *   hördes (se `useRostinmatning`). Utan den ingen ljudvåg.
 * @param {(sid: string, tid?: string) => void} [props.onStoppaAgent] Appens sätt att stoppa agenten. Med den står stopp i fältet medan
 *   agenten arbetar. Utan den ingen sådan knapp.
 * @param {import("../lib/talk.js").Inspelare} [props.inspelare] Bara för prov. Förval: webbläsarens inspelning, TALK:s.
 * @param {import("../lib/talk.js").Igenkanning | boolean} [props.igenkanning] (0.98.0) Text medan man pratar, som TALK:s `igenkanning`. (0.103.0)
 *   Texten står i inspelningsytan, inte i skrivfältet. ⛔ AV SOM FÖRVAL, av samma skäl som i TALK: webbläsaren skickar talet till Googles
 *   eller Apples taltjänst, och det är appens val. `true` slår på webbläsarens taligenkänning när den finns. Utan den, eller när inget
 *   hördes, skriver `onTranscribe` ut ljudet.
 * @param {Franbiblioteket} [props.franBiblioteket] (0.164.0, lifehub.app#226) Raden "Lägg till från Biblioteket" i pluset.
 * @param {(filer: File[], slag: "bild" | "foto" | "fil") => void} [props.onBifoga] (0.77.0, #292) Ritar pluset. Med `bilagor` på
 *   källan läser ramverket filen själv och den här anropas inte. Utan `bilagor` lämnas filerna hit, och utan den ritas inget plus.
 * @param {string} [props.mejl] (0.80.0, #301) Adressen appen skickar in. Utan den ritas ingen mejlknapp.
 * @param {(agent: { id: string, namn: string }) => void} [props.onVisaAgent] (0.90.0) Gör namn och ikon i ett agentsamtal till en knapp.
 * @param {MeddelandeHref} [props.meddelandeHref] (lifehub.app#712) Appens väg till ett meddelande, för "Kopiera länk" i menyn. Ramverket känner aldrig appens rutter. Utan den finns inte raden.
 * @param {ReadonlyArray<Omnamnbar>} [props.flerOmnamnbara] (lifehub.app#723) Fler som går att nämna med @, utöver de aktiva medlemmarna: appens API-agenter, vars medlemskap står som "avslutad". De läggs bara till @-listan och påverkar aldrig agentval, mottagare eller medlemslistor. Nämnandet skrivs som vanligt i `namner` (id). Utan den är listan exakt som förut.
 * @param {{ agentnamn: string, onTillbaka: () => void, onAndrat?: () => void }} [props.amne] (0.106.0, #386) Samtalet är ett ämne med
 *   agenten: huvudet visar ämnets rubrik och Arkivera, och en rad överst leder tillbaka till agentens samtal. Kräver `amnen` på källan.
 * @param {boolean} [props.ny] (0.106.0) Ämnet är inte skrivet än (`nyttAmne`). Ingenting läses, och första Skicka skapar samtalet och
 *   meddelandet med `skickaIAmne`. Kräver `amne`.
 * @param {(samtal: import("../lib/samtal.js").Samtal, meddelande: any) => void} [props.onSkapat] (0.106.0) Anropas när ett nytt ämne skapats.
 */
export function OpsSamtal({ kalla, uid, samtal, rubrik: rubrikProp, marke, lastTill: lastTillProp, namnFor, medlemmar, onLast, onSkickat, utkast, onOppnaTrad, tradminne, fokusRot, onFokuserad, sprak: sprakProp, texter = {}, postkort, onTranscribe, onStoppaAgent, inspelare, igenkanning, onBifoga: onBifogaProp, franBiblioteket, mejl, onVisaAgent, onForslag, meddelandeHref, flerOmnamnbara, amne: amneProp, ny = false, onSkapat }) {
  // ⛔ Språket ur appens `OpsSprakProvider` när appen inte gav ett (0.46.0, cllp/bolag-ops#528).
  const sprakKontext = useOpsSprak();
  const sprak = sprakProp ?? sprakKontext;
  const t = texterPa(sprak, texter);
  const bilage = useBilageutkast(kalla, onBifogaProp, t);
  const locale = sprak === "en" ? "en-GB" : "sv-SE";
  // ⛔ ETT ÄMNE BARA MED KÄLLANS ÄMNEN OCH ETT AGENTSAMTAL (0.106.0). Ett nytt ämne läser ingenting: samtalet finns inte, och regeln
  // hade nekat varje läsning under det. Därför får varje lyssnare `null` som källa tills första Skicka skapat det.
  const amne = amneProp && harAmnen(kalla) && samtal.slag === "agent" ? amneProp : null;
  const arNy = Boolean(amne && ny);
  const las = arNy ? null : kalla;
  const [meddelanden, setMeddelanden] = useState(/** @type {Array<import("../lib/samtal.js").Meddelande & { id: string }> | null} */ (arNy ? [] : null));
  const [fel, setFel] = useState(/** @type {Error | null} */ (null));
  /** (0.107.0) Ett meddelande som inte gick att skicka. Egen rubrik: förut stod "Meddelandena kunde inte hämtas" över ett nekat skick. */
  const [skickaFel, setSkickaFel] = useState(/** @type {Error | null} */ (null));
  const [text, setText] = useState(utkast ?? "");
  const [skickar, setSkickar] = useState(false);
  const markt = useRef(lastTillProp ?? 0);
  const lyssnar = useRef(false);
  const medTradar = Boolean(onOppnaTrad) && samtal.slag === "grupp" && harTradar(kalla);
  const loggRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const historik = useHistorik({ kalla, sid: samtal.id, live: meddelanden, logg: loggRef });
  const alla = historik.alla;
  const lasposition = useLasposition({ logg: loggRef, alla, uid, laddat: meddelanden !== null });
  /*
   * ⛔ "NYTT SEDAN SIST" HÄRLEDS UR LÄSMÄRKET SOM DET VAR NÄR SAMTALET ÖPPNADES (0.106.0, #386 skiva 4). Inget sparas och ingenting
   * läses till: märket kommer med inkorgens rad. Avdelaren står före det första meddelandet från någon annan efter märket, och bara när
   * något före märket också är laddat: står allt efter märket är hela samtalet nytt, och en avdelare överst avdelar ingenting. Utan
   * läsmärke (samtalet öppnat ur adressen innan inkorgen svarat) ritas ingen avdelare, eftersom märket inte är känt.
   */
  const [markeVidOppning] = useState(lastTillProp);
  /*
   * ⛔ BARA DET SOM FANNS NÄR SAMTALET ÖPPNADES KAN VARA "NYTT SEDAN SIST" (0.153.0, cllp/ops-framework#460 punkt 6, lifehub.app QA-fynd 13c). Avdelaren jämförde bara mot läsmärket, så ett svar som kom MEDAN
   * samtalet var öppet räknades som nytt sedan sist: i en helt nystartad tråd (märket stod på ens egen första rad) hamnade avdelaren före agentens första svar, och likadant före ett svar som kom
   * medan man läste. Det är inte nytt sedan sist, det är nytt nu, och det ser man redan. Tiden på det senaste meddelandet i FÖRSTA laddningen är gränsen (en ref, satt en gång): det som kommer
   * efter den räknas inte. En tom första laddning ger gränsen 0, så en ny tråd får aldrig någon avdelare.
   * Felriktningen är den säkra: levererar en prenumeration en första ofullständig omgång (en cache) räknas det som kom i andra omgången som nytt nu, och avdelaren uteblir. Den hamnar aldrig fel.
   */
  const oppnadTid = useRef(/** @type {number | null} */ (null));
  const nyttFran = useMemo(() => {
    if (typeof markeVidOppning !== "number" || ny) return null;
    if (oppnadTid.current === null && meddelanden !== null) oppnadTid.current = meddelanden.reduce((hogst, m) => Math.max(hogst, m.tid), 0);
    const oppnad = oppnadTid.current;
    if (oppnad === null) return null;
    if (!alla.some((m) => m.tid <= markeVidOppning)) return null;
    return alla.find((m) => m.av !== uid && m.tid > markeVidOppning && m.tid <= oppnad)?.id ?? null;
  }, [alla, meddelanden, markeVidOppning, uid, ny]);
  const reakt = useReaktioner(harReaktioner(las) ? las : null, samtal.id, undefined, uid);
  // ⛔ (cllp/lifehub.app#438) Omröstningar bara i samtalet, inte i en tråd: reglerna har ingen väg dit i skiva 1.
  const omr = useOmrostningar(harOmrostningar(las) ? las : null, samtal.id, uid);
  const [nyOmrostning, setNyOmrostning] = useState(false);
  // ⛔ Citat bara utanför gruppchatten (regeln kräver det): där är tråden svaret.
  const medCitat = harCitat(kalla) && samtal.slag !== "grupp";
  const [svarPa, setSvarPa] = useState(/** @type {(import("../lib/samtal.js").Meddelande & { id: string }) | null} */ (null));
  const citatuppslag = useCitatuppslag(las && (medCitat || alla.some((m) => m.svarPa)) ? kalla : null, samtal.id, alla);
  const sok = useSokISamtal(alla, loggRef);
  const fasta = useFasta(harFasta(las) ? las : null, samtal.id, uid);
  const agentlage = useAgentstatusdok(harStatus(las) ? las : null, samtal.id, undefined);
  const { rader: tradar, fel: tradfel } = useTradmarken({ kalla: medTradar ? kalla : null, sid: samtal.id, meddelanden: meddelanden ? alla : null, minne: tradminne });
  const [info, setInfo] = useState(false);
  const { tyst, vaxla: vaxlaTyst } = useTystnad(las, samtal.id, uid, setFel);
  const infoposter = useMemo(() => alla.map((m) => ({ m })), [alla]);
  const [arkiv, setArkiv] = useState(samtal.arkiverad === true);
  const rubrik = amne ? amnesrubrik(samtal, alla.slice(0, 3), arNy ? t.nyttSamtal : t.samtalUtanText) : rubrikProp;
  const vaxlaArkiv = async () => {
    if (!amne || !harAmnen(kalla)) return;
    try {
      await kalla.arkivera(samtal.id, !arkiv);
      setArkiv(!arkiv);
      amne.onAndrat?.();
      // Ett arkiverat ämne lämnas: det syns inte längre i listan man kom från.
      if (!arkiv) amne.onTillbaka();
    } catch (e) {
      setFel(new Error(`${t.arkivFel} ${e instanceof Error ? e.message : String(e)}`));
    }
  };
  const filer = useChattinfoFiler({ kalla, sid: samtal.id, oppen: info, poster: infoposter, felText: t.bilagorFel });
  const post = mejlHref(mejl);

  const lasIn = async () => {
    try {
      setMeddelanden(await kalla.meddelanden(samtal.id));
      setFel(null);
    } catch (e) {
      setFel(e instanceof Error ? e : new Error(String(e)));
    }
  };

  useEffect(() => {
    if (arNy) return undefined;
    const stang = kalla.prenumerera(samtal.id, {
      onData: (rader) => {
        setMeddelanden(rader);
        setFel(null);
      },
      onError: (e) => setFel(e),
    });
    lyssnar.current = Boolean(stang);
    if (!stang) lasIn();
    return () => stang?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kalla, samtal.id, arNy]);

  // Läsmärket: den senaste tiden i samtalet, om den är senare än det förra märket.
  useEffect(() => {
    if (!meddelanden || meddelanden.length === 0) return;
    const senast = meddelanden[meddelanden.length - 1].tid;
    if (senast > markt.current) {
      markt.current = senast;
      /*
       * ⛔ `onLast` BARA OM INGET NYARE MÄRKE ÄR PÅ VÄG (omgranskningens andra varv). Kommer ett meddelande medan det förra märket
       * skrivs läser inkorgen om vid det förra märkets svar, och räknar det nya som oläst (mätt: [1] med ett märke på 40 ms). Det
       * nyare märket anropar `onLast` själv när det är skrivet.
       */
      kalla.markeraLast(samtal.id, uid, senast).then(() => (markt.current === senast ? onLast?.() : undefined), () => {});
    }
    // ⛔ (0.106.0) Rullningen sköts av `useLasposition`: den som läser bakåt rycks inte ned.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meddelanden]);

  // Fokus tillbaka till märket när tråden stängts (KAN 6). Efter rullningen till slutet, så att märket rullas fram.
  useEffect(() => {
    if (!fokusRot || !meddelanden) return;
    const knapp = /** @type {HTMLElement | null} */ (loggRef.current?.querySelector(`[data-tradrot="${CSS.escape(fokusRot)}"]`) ?? null);
    if (!knapp) return;
    knapp.focus();
    onFokuserad?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fokusRot, meddelanden, alla, tradar]);

  /**
   * Skicka. Med `extra.text` är det det sagda (0.103.0, `useRostinmatning`): det skickas i stället för fältets text, och fältet och
   * bilagan rörs inte. ⛔ Då kastar den i stället för att lägga felet i loggen, så att inspelningsytan kan säga det med Försök igen och
   * texten finns kvar (regel 5). Ett tyst `return` hade sett ut som ett skickat meddelande.
   * @param {{ namner?: string[], text?: string }} [extra]
   */
  const skicka = async (extra) => {
    const tal = typeof extra?.text === "string";
    const ut = tal ? /** @type {string} */ (extra?.text) : text;
    if (tal && skickar) throw new Error(t.annatSkickas);
    if (tal && !ut.trim()) throw new Error(t.ingenText);
    if (skickar || (!ut.trim() && !bilage.bilaga)) return;
    setSkickar(true);
    setSkickaFel(null);
    let skickat = false;
    try {
      const d = { text: ut, av: uid, ...(extra?.namner ? { namner: extra.namner } : {}), ...(svarPa ? { svarPa: svarPa.id } : {}), ...(!tal && bilage.bilaga ? { bilaga: bilage.bilaga } : {}) };
      // ⛔ Ett nytt ämne skapas här, med sitt första meddelande (0.106.0).
      const ny = arNy && harAmnen(kalla) ? await kalla.skickaIAmne(samtal, d) : await kalla.skicka(samtal.id, d);
      skickat = true;
      if (arNy) onSkapat?.(samtal, ny);
      if (!tal) {
        setText("");
        bilage.tom();
      }
      setSvarPa(null);
      if (ny && typeof ny.tid === "number") onSkickat?.(/** @type {any} */ (ny));
      // Med en prenumeration kommer meddelandet av sig självt. Utan den läses samtalet om.
      if (!lyssnar.current && !arNy) await lasIn();
    } catch (e) {
      // ⛔ Bara sändningen kastar. Föll läsningen efteråt är meddelandet redan skickat, och ett Försök igen hade skickat det två gånger.
      if (tal && !skickat) throw e;
      const f = e instanceof Error ? e : new Error(String(e));
      if (skickat) setFel(f);
      else setSkickaFel(f);
    } finally {
      setSkickar(false);
    }
  };

  const agent = samtal.slag === "agent";
  const privatRad = samtal.slag === "grupp" ? t.gruppRad : samtal.slag === "projekt" ? t.projektRad : agent ? t.agentRad : t.privatRad;
  const agentId = agent && onVisaAgent ? agentDeltagare(samtal, uid, medlemmar) : "";

  return (
    <OpsSprakProvider sprak={sprak}>
    <div data-ops-samtal={samtal.slag} data-amne={amne ? (arNy ? "ny" : samtal.id) : undefined} className={cx("relative flex min-h-0 flex-1", info ? "flex-col md:flex-row" : "flex-col")}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {amne ? (
        /* ⛔ TILLBAKA TILL AGENTENS SAMTAL (0.106.0), på telefon och dator, som tråden har sin rad till gruppchatten. */
        <button
          type="button"
          data-tillbaka-agent=""
          onClick={amne.onTillbaka}
          className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 border-b border-line px-3 text-meta text-ink-secondary hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
          <ChevronVansterIkon size={14} />
          <span className="min-w-0 truncate">{amne.agentnamn}</span>
        </button>
      ) : null}
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-3 py-2.5">
        {amne ? (
          <>
            {marke}
            <div className="min-w-0 flex-1">
              <h3 data-amnesrubrik="" className="m-0 truncate text-etikett font-semibold text-ink">{rubrik}</h3>
              <p data-privat-rad="" className="m-0 flex items-center gap-1 text-liten text-ink-muted">
                <LasIkon size={10} />
                <span className="truncate">{arkiv ? t.arkiveratRad : `${amne.agentnamn}, ${t.agentRad}`}</span>
              </p>
            </div>
          </>
        ) : agentId ? (
          <button
            type="button"
            data-visa-agent={agentId}
            aria-label={`${rubrik}, ${t.oppnaInstallningar}`}
            onClick={() => onVisaAgent?.({ id: agentId, namn: rubrik })}
            className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-base text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {marke}
            <span className="min-w-0 flex-1">
              <h3 className="m-0 truncate text-etikett font-semibold text-ink">{rubrik}</h3>
              <p data-privat-rad="" className="m-0 flex items-center gap-1 text-liten text-ink-muted">
                <LasIkon size={10} />
                <span>{privatRad}</span>
              </p>
            </span>
          </button>
        ) : (
          <>
            {marke}
            <div className="min-w-0 flex-1">
              <h3 className="m-0 truncate text-etikett font-semibold text-ink">{rubrik}</h3>
              <p data-privat-rad="" className="m-0 flex items-center gap-1 text-liten text-ink-muted">
                {!arDelatSamtal(samtal.slag) ? <LasIkon size={10} /> : null}
                <span>{privatRad}</span>
              </p>
            </div>
          </>
        )}
        <div className="flex shrink-0 items-center">
          {amne && !arNy ? (
            <Verktygsknapp etikett={arkiv ? t.taFram : t.arkivera} dataAttr="arkiv" pressed={arkiv} onClick={vaxlaArkiv}>
              {arkiv ? <TaFramIkon size={16} /> : <ArkiveraIkon size={16} />}
            </Verktygsknapp>
          ) : null}
          {post ? (
            <Verktygsknapp etikett={t.mejl} dataAttr="mejl" href={post}>
              <MejlIkon size={16} />
            </Verktygsknapp>
          ) : null}
          {harTyst(las) ? (
            <Verktygsknapp etikett={tyst ? t.notiserTysta : t.tystaNotiser} dataAttr="tyst" pressed={tyst} onClick={vaxlaTyst}>
              {tyst ? <TystIkon size={16} /> : <NotisIkon size={16} />}
            </Verktygsknapp>
          ) : null}
          <Verktygsknapp etikett={t.sokISamtalet} dataAttr="sok" expanded={sok.oppen} onClick={() => (sok.oppen ? sok.stang() : sok.oppna())}>
            <SokIkon size={16} />
          </Verktygsknapp>
          <Verktygsknapp etikett={t.chattinfo} dataAttr="info" expanded={info} onClick={() => setInfo((v) => !v)}>
            <PanelIkon size={16} />
          </Verktygsknapp>
        </div>
      </header>
      {sok.oppen ? <Sokrad sok={sok} antal={alla.length} kanFinnasAldre={historik.kanFinnasAldre} texter={t} /> : null}
      <Fastarad fasta={fasta} kalla={kalla} sid={samtal.id} laddade={alla} uid={uid} namnFor={namnFor} texter={t} />

      {/*
       * ⛔ FELRADERNA STÅR OVANFÖR LOGGEN, INTE I DEN (P0 2026-10-15). CP i Safari på Mac: efter ett nekat Skicka i ett Nytt samtal syntes
       * under huvudet en röd ram utan text. Felet stod först i loggen, och i ett nytt ämne fyller den tomma vyn (`h-full`) hela loggen
       * under det, så loggen blev högre än sin ruta och följde slutet: felet rullades upp ur sikte och bara dess nedre kant syntes.
       * Hypotes för just WebKit, inte mätt där (ingen WebKit i provmiljön); att felet låg i den rullande loggen är mätt i koden.
       * `shrink-0`, så att raden aldrig trycks ihop av en kolumn med `min-h-0`.
       */}
      {fel || skickaFel ? (
        <div data-samtalsfel="" className="flex shrink-0 flex-col gap-2 px-3 pt-2">
          {skickaFel ? (
            <OpsBanner tone="danger" title={t.skickaFel}>
              {skickaFel.message}
            </OpsBanner>
          ) : null}
          {fel ? (
            <OpsBanner tone="danger" title={t.fel}>
              {fel.message}
            </OpsBanner>
          ) : null}
        </div>
      ) : null}
      <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={loggRef} role="log" aria-label={rubrik} className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {tradfel ? (
          /* ⛔ KAN 5: aldrig tyst. Meddelandena står kvar och "Svara i tråd" öppnar tråden, men raden säger att märkena kan saknas. */
          <p data-tradarfel="" role="status" className="m-0 py-1 text-center text-liten text-ink-muted">
            {t.tradarFel}
          </p>
        ) : null}
        <VisaAldre historik={historik} texter={t} />
        <Reaktionslage reakt={reakt} texter={t} />
        <Omrostningslage omr={omr} texter={t} />
        {meddelanden && meddelanden.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-16 text-center">
            <span className="text-ink-muted opacity-40">
              <MeddelandeIkon size={28} />
            </span>
            <p className="m-0 mt-3 text-etikett text-ink-muted">{t.inga}</p>
            <p data-tomrad="" className="m-0 mt-1 text-liten text-ink-muted">{samtal.slag === "grupp" ? t.gruppTom : samtal.slag === "projekt" ? t.projektTom : privatRad}</p>
          </div>
        ) : null}
        <Meddelanderader
          meddelanden={alla}
          nyttFran={nyttFran}
          reakt={reakt}
          omrostning={omr.pa ? omr : undefined}
          texter={t}
          kalla={kalla}
          sid={samtal.id}
          citat={{ pa: medCitat, onCitera: (m) => setSvarPa(m), uppslag: citatuppslag }}
          traffar={sok.oppen ? { ids: sok.traffar, aktuell: sok.aktuell } : null}
          fasta={fasta.pa ? fasta : null}
          postkort={postkort}
          onForslag={onForslag}
          meddelandeHref={meddelandeHref}
          flerOmnamnbara={flerOmnamnbara}
          uid={uid}
          namnFor={namnFor}
          medlemmar={medlemmar}
          locale={locale}
          visaNamn={arDelatSamtal(samtal.slag)}
          efter={
            medTradar
              ? (m) => {
                  const tr = tradar.get(m.id);
                  /*
                   * ⛔ OKÄNT ÄR INTE "INGEN TRÅD" (#282, regel 5). Innan `tradarFor` svarat saknas nyckeln,
                   * och `finns` blev då falskt: varje rot ritades som "Svara i tråd". Det är ett påstående
                   * om att tråden inte finns, och det är osant tills svaret kommit. Under tiden står en
                   * neutral rad, inte knappen. När läsningen faller (`tradfel`) står knappen kvar, eftersom
                   * märkena kan saknas och tråden ändå ska gå att öppna (KAN 5).
                   */
                  if (tr === undefined && !tradfel) {
                    return (
                      <span data-tradmarke="okand" className="inline-flex min-h-11 items-center px-2 text-liten text-ink-muted">
                        <span className="sr-only">{t.tradHamtas}</span>
                        <span aria-hidden="true">…</span>
                      </span>
                    );
                  }
                  const finns = Boolean(tr?.finns);
                  const beskrivning = `tradrot-${m.id}`;
                  const antalText = `${tr?.antal === undefined ? "…" : tr.fler ? `${tr.antal}+` : tr.antal} ${t.svar}`;
                  const sen = finns ? senasteForhand(tr?.senaste, { namnFor, uid, du: t.du, sprak, locale }) : null;
                  const rot = `${t.svarPa} ${avNamnFor(namnFor, m, uid, t.du, sprak)}: ${synligText(m, 60)}`;
                  return (
                    <>
                      <span id={beskrivning} className="sr-only">
                        {/* (0.203.0) Det senaste svaret står i beskrivningen, inte i namnet: namnet är "3 svar", som förut, och läses inte två gånger. */}
                        {sen ? `${rot}${/[.!?…]$/.test(rot) ? "" : "."} ${t.senasteSvar} ${sen.fran}, ${sen.nar}: ${sen.utdrag}` : rot}
                      </span>
                      <button
                        type="button"
                        data-tradmarke={finns ? "finns" : "ny"}
                        data-tradrot={m.id}
                        aria-describedby={beskrivning}
                        aria-label={finns ? `${antalText}${tr?.namn ? ` · ${tr.namn}` : ""}` : undefined}
                        onClick={() => onOppnaTrad?.(m.id)}
                        className={tradknappKlass(finns)}
                      >
                        <TradIkon size={12} />
                        {finns ? (
                          /*
                           * ⛔ (0.203.0, CP 2026-11-08) DET SENASTE SVARET PÅ SAMMA RAD: "1 svar · Collan: "Starkaste öppningen…" · 16.07". En rad som kortas
                           * (`truncate`), aldrig två, så att märket inte trycker isär chatten. ⛔ INGET NYTT ELEMENT PER MEDDELANDE (`check:skalyta` 47 (6),
                           * taket 26 på dator): antalet står i sitt eget span som förut, och namnet och utdraget är text i den dämpade raden runt det.
                           * ⛔ KAN 9: trådens namn bara när en person döpt om tråden, annars upprepar det roten som står precis ovanför.
                           */
                          <span className="min-w-0 truncate text-ink-secondary">
                            <span className="tabular-nums text-accent">{antalText}</span>
                            {tr?.namn ? ` · ${tr.namn}` : ""}
                            {sen ? ` · ${sen.fran}: "${sen.utdrag}" · ${sen.nar}` : ""}
                          </span>
                        ) : (
                          <span>{t.svaraITrad}</span>
                        )}
                      </button>
                    </>
                  );
                }
              : undefined
          }
          merFor={
            medTradar
              ? (m) => (tradar.get(m.id)?.finns ? [] : [{ id: "trad", etikett: t.svaraITrad, ikon: <TradIkon size={16} />, onValj: () => onOppnaTrad?.(m.id) }])
              : undefined
          }
        />
        <Agentrad lage={agentlage} texter={t} />
      </div>
      <TillSenaste lage={lasposition} arbetar={arbetsord(agentlage)} texter={t} />
      </div>

      {svarPa ? <SvararPaRad m={svarPa} namn={avNamnFor(namnFor, svarPa, uid, t.du, sprak)} onAvbryt={() => setSvarPa(null)} texter={t} /> : null}
      <Bilageutkast bilaga={bilage.bilaga} fel={bilage.fel} onTaBort={bilage.tom} texter={t} />
      {nyOmrostning && omr.pa ? (
        <Omrostningsformular
          texter={t}
          onAvbryt={() => setNyOmrostning(false)}
          onSkicka={async (d) => {
            const ny = await omr.skapa(d);
            setNyOmrostning(false);
            // ⛔ Samma som Skicka: inkorgens rad får frågan direkt, utan att vänta på en läsning.
            if (ny && typeof ny.tid === "number") onSkickat?.(/** @type {any} */ (ny));
          }}
        />
      ) : null}
      <Skrivfalt
        text={text}
        setText={setText}
        skickar={skickar}
        onSkicka={skicka}
        texter={t}
        sprak={sprak}
        fokus={utkast !== undefined}
        omnamnande={omnamnandeFor(kalla, samtal.slag, medlemmar, uid, namnFor, flerOmnamnbara)}
        fokusNyckel={svarPa?.id}
        onEscape={svarPa ? () => setSvarPa(null) : undefined}
        platstext={samtal.slag === "grupp" ? t.skrivGrupp : samtal.slag === "projekt" ? t.skrivProjekt : samtal.slag === "agent" ? t.skrivAgent : t.skriv}
        onTranscribe={onTranscribe}
        inspelare={inspelare}
        igenkanning={igenkanning}
        onBifoga={bilage.onBifoga}
        onOmrostning={omr.pa && !arNy ? () => setNyOmrostning(true) : undefined}
        franBiblioteket={franBiblioteket}
        harBilaga={Boolean(bilage.bilaga)}
        kamera={bilage.kamera}
        agentArbetar={agentArbetar(agentlage)}
        onStoppaAgent={onStoppaAgent ? () => onStoppaAgent(samtal.id) : undefined}
      />
      </div>
      {info ? (
        <div className="absolute inset-0 z-(--z-modal) flex min-h-0 flex-col bg-canvas md:static md:z-auto md:w-80 md:shrink-0 md:border-l md:border-line">
          <OpsChattinfo
            medlemmar={samtalsdeltagare(samtal, medlemmar)}
            bilagor={filer.bilagor}
            bilagorFler={filer.fler}
            bilagorFel={filer.fel}
            meddelanden={alla}
            aldreFinns={historik.kanFinnasAldre}
            namnFor={namnFor}
            onStang={() => setInfo(false)}
            texter={t}
          />
        </div>
      ) : null}
    </div>
    </OpsSprakProvider>
  );
}

/**
 * @typedef {object} Tradrad (0.68.0) Vad chatten vet om tråden ur ett meddelande.
 * @property {boolean} finns
 * @property {string} [namn] Bara när en person döpt om tråden.
 * @property {number} [antal] Okänt (`undefined`) tills det räknats.
 * @property {boolean} [fler]
 * @property {(import("../lib/samtal.js").Meddelande & { id: string }) | null} [senaste] (0.203.0) Det nyaste svaret, läst med antalet
 *   (`senasteSvar`). `null`: tråden har inget. Saknas fältet har källan ingen `senasteSvar`, och märket visar bara antalet.
 * @property {boolean} [raknaOm] (0.203.0) Ett eget svar har ändrat tråden: antalet och det senaste svaret visar det redan, och räknas om
 *   från källan nästa gång raden visas. Det som står är vyns minne, inte källans sanning.
 */

/**
 * Märkets rad om det senaste svaret, eller `null` när det inte finns något att visa: källan saknar `senasteSvar`, tråden har inget
 * svar, eller svaret har ingen synlig text (0.203.0). Avsändaren som i bubblorna (`avNamnFor`, "Du" för det egna, märket via en
 * nyckel), utdraget som i citaten (`synligText`, 60 tecken), och tiden som i inkorgen (`radtid`: klockslaget i dag, annars datum och tid).
 *
 * @param {(import("../lib/samtal.js").Meddelande & { id: string }) | null | undefined} m
 * @param {{ namnFor: (uid: string) => string, uid: string, du: string, sprak: string, locale: string }} k
 * @returns {{ fran: string, utdrag: string, nar: string } | null}
 */
function senasteForhand(m, { namnFor, uid, du, sprak, locale }) {
  if (!m) return null;
  const utdrag = synligText(m, 60);
  if (!utdrag) return null;
  return { fran: avNamnFor(namnFor, m, uid, du, sprak), utdrag, nar: radtid(m.tid, Date.now(), locale) };
}

/**
 * Märkets rad efter ett eget svar i tråden (0.203.0, CP 2026-11-08). Förut blev antalet okänt ("… svar") tills raden räknades om.
 * Nu står det egna svaret direkt: ett mer än det kända antalet (1 när tråden inte fanns), och svaret som det senaste, och raden räknas
 * ändå om från källan (`raknaOm`), eftersom någon annan kan ha svarat under tiden.
 *
 * @param {Tradrad | undefined} forra @param {(import("../lib/samtal.js").Meddelande & { id: string }) | undefined} m Svaret som skrevs.
 * @param {boolean} medSenaste Har källan `senasteSvar`? Utan den visar märket bara antalet, och ett utdrag som aldrig räknas om hade stått kvar.
 * @returns {Partial<Tradrad>}
 */
function efterEgetSvar(forra, m, medSenaste) {
  const kant = forra?.finns === false ? { antal: 0, fler: false } : forra?.antal !== undefined ? { antal: forra.antal, fler: Boolean(forra.fler) } : null;
  return { finns: true, antal: kant ? kant.antal + 1 : undefined, fler: kant ? kant.fler : undefined, raknaOm: true, ...(medSenaste && m ? { senaste: m } : {}) };
}

/** Hur många av de senaste meddelandena utan tråd som prövas igen när fönstret får fokus. */
const NYA_ROTTER_VID_FOKUS = 10;

/**
 * Märkena under gruppchattens meddelanden (0.68.0, granskningen av PR 268, BÖR 4).
 *
 * ⛔ LÄSNINGARNA, OCH VARFÖR DE ÄR SÅ FÅ:
 *   - en tråd läses per rot, och bara för rötter som inte redan finns i minnet: ett nytt meddelande i chatten är EN läsning;
 *   - antalet svar är en aggregatfråga där källan kan (`count`), och räknas bara för trådar vars antal är okänt;
 *   - (0.203.0) det senaste svaret läses med antalet, en fråga med `limit: 1` per räknad tråd, och aldrig annars. Ett fält "senaste" på
 *     tråden hade sparat läsningen och varit en andra sanning om meddelandena, samma skäl som för räknaren nedan;
 *   - märkets namn läser inga meddelanden: det är trådens `namn`, eller inget (roten står redan ovanför).
 *
 * ⛔ ETT SVAR FRÅN NÅGON ANNAN NÅR MÄRKET NÄR FÖNSTRET FÅR FOKUS. Det är den billigaste vägen som håller: en lyssnare per tråd
 * hade varit en öppen läsning per synlig tråd så länge chatten är öppen, och en räknare på tråden hade varit en andra sanning om
 * meddelandena och en skrivning per svar som kan misslyckas för sig. Fokus är samma signal som inkorgen läser om på
 * (`useSamtal`). Vid fokus räknas de kända trådarna om, och de senaste `NYA_ROTTER_VID_FOKUS` rötterna utan tråd prövas igen,
 * eftersom en ny tråd nästan alltid startas ur något som nyss sades. Egna svar och omdöpningar ändrar minnet direkt.
 *
 * @param {{ kalla: (ReturnType<typeof import("../data/samtalskalla.js").createSamtalskalla> & import("../data/samtalskalla.js").Tradfunktioner) | null, sid: string, meddelanden: ReadonlyArray<{ id: string }> | null, minne?: Map<string, Map<string, Tradrad>> }} p
 * @returns {{ rader: Map<string, Tradrad>, fel: Error | null }}
 */
function useTradmarken({ kalla, sid, meddelanden, minne }) {
  const eget = useRef(/** @type {Map<string, Map<string, Tradrad>>} */ (new Map()));
  const alla = minne ?? eget.current;
  if (!alla.has(sid)) alla.set(sid, new Map());
  const rader = /** @type {Map<string, Tradrad>} */ (alla.get(sid));
  const [, setVersion] = useState(0);
  const [fel, setFel] = useState(/** @type {Error | null} */ (null));

  /** @param {ReadonlyArray<string>} rotter @param {boolean} raknaKanda */
  const las = async (rotter, raknaKanda) => {
    if (!kalla) return;
    try {
      if (rotter.length) {
        const funna = await kalla.tradarFor(sid, rotter);
        const efterId = new Map(funna.map((t) => [t.id, t]));
        for (const r of rotter) {
          const t = efterId.get(r);
          rader.set(r, t ? { ...(rader.get(r) ?? {}), finns: true, namn: t.namn } : { finns: false });
        }
      }
      const raknas = [...rader.entries()].filter(([, v]) => v.finns && (raknaKanda || v.antal === undefined || v.raknaOm)).map(([k]) => k);
      // ⛔ (0.203.0) Det senaste svaret läses i samma stund som antalet, och bara då: en läsning till per räknad tråd. Utan
      // `senasteSvar` i källan läses det inte, och märket är som före 0.203.0.
      const harSenaste = typeof kalla.senasteSvar === "function";
      await Promise.all(
        raknas.map(async (tid) => {
          const [{ antal, fler }, senaste] = await Promise.all([kalla.antalSvar(sid, tid), harSenaste ? kalla.senasteSvar?.(sid, tid) : undefined]);
          const { raknaOm: _raknat, ...forra } = /** @type {Tradrad} */ (rader.get(tid));
          rader.set(tid, { ...forra, antal, fler, ...(harSenaste ? { senaste: senaste ?? null } : {}) });
        }),
      );
      setFel(null);
    } catch (e) {
      setFel(e instanceof Error ? e : new Error(String(e)));
    }
    setVersion((v) => v + 1);
  };

  // Nya rötter, och trådar vars antal blivit okänt (ett eget svar i tråden).
  useEffect(() => {
    if (!kalla || !meddelanden) return;
    las(meddelanden.map((m) => m.id).filter((id) => !rader.has(id)), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kalla, sid, meddelanden]);

  useEffect(() => {
    if (!kalla || typeof window === "undefined") return undefined;
    const fokus = () => {
      const senaste = (meddelanden ?? []).slice(-NYA_ROTTER_VID_FOKUS).map((m) => m.id).filter((id) => rader.get(id)?.finns === false);
      las(senaste, true);
    };
    window.addEventListener("focus", fokus);
    return () => window.removeEventListener("focus", fokus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kalla, sid, meddelanden]);

  return { rader, fel };
}

/**
 * Namnet på den som skrev ett meddelande, och nyckeln om en personlig API-nyckel skrev det: "Miranda via Byggagent" (0.135.0, lifehub.app#409).
 *
 * ⛔ DEN ENDA VÄGEN FÖR EN AVSÄNDARE SOM LÄSES SOM TEXT. `via` ligger på meddelandet (servern skriver det, reglerna nekar en klient), och en rad som ritar
 * `namnFor(m.av)` rakt av visar nyckelns meddelande som personens eget. `check:skaparnamn` håller ett tak på de ställen som ritar utan märke (avatarer).
 * Det egna meddelandet heter "Du via Byggagent": märket är till för att det inte ska gå att ta för något man skrev för hand, också för den som äger nyckeln.
 *
 * @param {(uid: string) => string} namnFor
 * @param {{ av: string, via?: unknown }} meddelande
 * @param {string} uid Den inloggade.
 * @param {string} du Ordet för den inloggade ("Du").
 * @param {string} sprak
 * @returns {string}
 */
function avNamnFor(namnFor, { av, via }, uid, du, sprak) {
  return namnMedVia(av === uid ? du : namnFor(av), via, sprak);
}

/**
 * Är två meddelanden skrivna på samma sätt: båda för hand, eller båda av samma nyckel? Avgör om det andra får stå utan namnrad under det första.
 *
 * @param {{ via?: any }} a
 * @param {{ via?: any }} b
 */
function sammaVia(a, b) {
  return (a.via?.nyckelId ?? "") === (b.via?.nyckelId ?? "") && (a.via?.namn ?? "") === (b.via?.namn ?? "");
}

/**
 * Meddelandena i en logg: dagens avdelare, bubblorna och tiden. Samma i ett samtal och i en tråd (0.68.0), så att en tråd ser ut
 * som det samtal den hör till.
 *
 * @param {object} props
 * @param {ReadonlyArray<import("../lib/samtal.js").Meddelande & { id: string }>} props.meddelanden
 * @param {string} props.uid
 * @param {(uid: string) => string} props.namnFor
 * @param {ReadonlyArray<Medlemsrad>} [props.medlemmar]
 * @param {string} props.locale
 * @param {boolean} props.visaNamn Avsändarens namn över en annans bubbla (gruppchatten och tråden).
 * @param {(m: import("../lib/samtal.js").Meddelande & { id: string }) => import("react").ReactNode} [props.efter] Det som står efter
 *   tiden under bubblan: trådens märke i gruppchatten.
 * @param {(m: import("../lib/samtal.js").Meddelande & { id: string }) => import("./OpsAtgardsblad.jsx").Atgard[]} [props.merFor] (0.106.0,
 *   #386) Vyns egna åtgärder för meddelandet i telefonens meny: "Svara i tråd" i gruppchatten, "Lyft till minnet" i tråden.
 * @param {number} [props.forraTid] Tiden på meddelandet före det första, när listan fortsätter en annan (trådens svar efter
 *   roten). Samma dag ger då ingen ny avdelare: två "I dag" på rad är en avdelare som inte avdelar något.
 * @param {ReturnType<typeof useReaktioner>} [props.reakt] (chattens nattskiva) Reaktionerna, när källan har dem.
 * @param {ReturnType<typeof useOmrostningar>} [props.omrostning] (cllp/lifehub.app#438 skiva 1) Omröstningarna, när källan har dem. Med dem ritas ett meddelande som
 *   bär `omrostning` som kortet. Utan dem (en tråd, gästens chatt, en app utan omröstningar) står frågan som en vanlig bubbla: texten ÄR frågan.
 * @param {Required<Meddelandetexter>} [props.texter]
 * @param {{ pa: boolean, onCitera: (m: import("../lib/samtal.js").Meddelande & { id: string }) => void, uppslag: Map<string, (import("../lib/samtal.js").Meddelande & { id: string }) | null> }} [props.citat]
 *   (chattens nattskiva) Citaten: knappen när `pa`, och det citerade meddelandet ur `uppslag` (`null`: går inte att läsa).
 * @param {{ ids: ReadonlySet<string>, aktuell: string | null } | null} [props.traffar] Sökningens träffar i samtalet.
 * @param {ReturnType<typeof useFasta> | null} [props.fasta] Fästningarna, i samtalet (inte i en tråd).
 * @param {Postkort} [props.postkort]
 * @param {any} [props.kalla] Så att en bilaga utan innehåll kan hämtas när meddelandet visas.
 * @param {string} [props.sid]
 * @param {string} [props.trad] Trådens id, när raderna är svar i en tråd. Det står i filens nyckel (`bilagenyckel`).
 * @param {(agent: { id: string, namn: string }) => void} [props.onVisaAgent] (0.90.0) Agentens avatar i en tråd öppnar inställningarna.
 * @param {(f: { sid: string, mid: string, id: string }) => Promise<import("../lib/forslag.js").Forslagssvar>} [props.onForslag] (0.105.0) Förslagen under agentens svar.
 * @param {string | null} [props.nyttFran] (0.106.0) Meddelandet som avdelaren "Nytt sedan sist" står före.
 * @param {MeddelandeHref} [props.meddelandeHref] (lifehub.app#712) Adressen till ett meddelande. Med den har menyn "Kopiera länk"; utan den finns inte raden.
 * @param {ReadonlyArray<Omnamnbar>} [props.flerOmnamnbara] (lifehub.app#723) Fler som går att nämna med @, utöver de aktiva medlemmarna: appens API-agenter, vars medlemskap står som "avslutad". De läggs bara till @-listan och påverkar aldrig agentval, mottagare eller medlemslistor. Nämnandet skrivs som vanligt i `namner` (id). Utan den är listan exakt som förut.
 */
export function Meddelanderader({ meddelanden, uid, namnFor: namnForProp, medlemmar, locale, visaNamn, efter, merFor, forraTid, reakt, omrostning, texter = TEXTER, citat, traffar, fasta, postkort, kalla, sid, trad, onVisaAgent, onForslag, nyttFran = null, meddelandeHref, flerOmnamnbara }) {
  const bredd = useBredd();
  // ⛔ EN GÄSTS NAMN STÅR PÅ MEDDELANDET (`avNamn`, satt av servern när gästen skriver), för gästen är ingen medlem och har ingen rad i medlemslistan. Märket "Gäst" härleds ur `av` (`arGastId`),
  // eller ur `gast: true` i gästens egen vy (där `av` är ett namn): inget annat fält, så märket kan inte saknas på ett meddelande en gäst skrev och inte sitta på en medlems.
  const gastnamn = new Map(meddelanden.filter((m) => arGastId(m.av)).map((m) => [m.av, String(/** @type {any} */ (m).avNamn ?? "").trim() || texter.gast]));
  const arGast = (/** @type {any} */ m) => arGastId(m.av) || m.gast === true;
  const namnFor = (/** @type {string} */ id) => gastnamn.get(id) ?? namnForProp(id);
  /*
   * ⛔ ETT OMNÄMNANDE SYNS SOM ETT OMNÄMNANDE (0.213.0, cllp/lifehub.app#751). QA 2026-11-10: "@claude-dev-ops-architect" valdes ur listan och stod sedan som
   * ren text i bubblan, så det gick inte att se om nämningen registrerades. Mätt i koden: väljaren skrev `namner` som den skulle, men ingen vy ritade fältet.
   * Nu får bubblans text namnen meddelandet faktiskt nämner (`namner`, som de heter nu, och appens fler att nämna), och `OpsMarkdown` markerar `@Namn` i texten.
   * "alla" är ordet för hela gruppen. I gästens chatt är `namner` redan namn, och `namnFor` är då namnet självt.
   */
  const omnamnadeNamn = (/** @type {any} */ m) => {
    const lista = Array.isArray(m?.namner) ? m.namner.filter((/** @type {unknown} */ x) => typeof x === "string" && x) : [];
    if (lista.length === 0) return undefined;
    // ⛔ "@alla" OCH "@everyone" OAVSETT VISNINGSSPRÅK (granskningen av 0.213.0): texten skrevs på avsändarens språk, och den som läser kan ha ett annat.
    if (lista.includes("alla")) return [texter.allaNamn, ORD_MEDDELANDEN.allaNamn.sv, ORD_MEDDELANDEN.allaNamn.en];
    /** @type {string[]} */
    const ut = [];
    for (const u of lista) {
      const n = namnFor(u);
      if (n && n !== NAMN_SAKNAS) ut.push(n);
      const fler = (flerOmnamnbara ?? []).find((o) => o && o.userId === u)?.namn?.trim();
      if (fler) ut.push(fler);
    }
    return ut.length ? ut : undefined;
  };
  // ⛔ ORDET "via" FÖLJER SPRÅKET (0.135.0, lifehub.app#409): `locale` är "sv-SE" eller "en-GB", och textlagret vill ha "sv" eller "en".
  const kontextsprak = useOpsSprak();
  const sprak = typeof locale === "string" && locale ? (locale.startsWith("en") ? "en" : "sv") : kontextsprak;
  const medlemsbild = (/** @type {string} */ id) => (medlemmar ?? []).find((m) => m.userId === id)?.bild || undefined;
  const medlemstyp = (/** @type {string} */ id) => (medlemmar ?? []).find((m) => m.userId === id)?.typ;
  // ⛔ MENYN ÖPPNAS MED ETT LÅNGT TRYCK PÅ BUBBLAN PÅ PEKSKÄRM (0.190.0, CP 2026-11-05 i cllp/lifehub.app#658: "långt tryck", prickarna bara vid hover på dator). Ett meddelande åt gången:
  // punkten är där fingret höll in, och menyn (`Meddelandemeta`) förankras där.
  const pekskarm = usePekskarm();
  const [meny, setMeny] = useState(/** @type {{ id: string, punkt: { x: number, y: number } } | null} */ (null));
  const menyPa = bredd !== "bred" || pekskarm;
  /*
   * ⛔ DATORNS ⋮ MED KOPIORNA RITAS BARA PÅ DET MEDDELANDE PEKAREN ELLER FOKUSET STÅR PÅ (lifehub.app#712, CI 2026-11-09). Med en ⋮ i DOM:en på varje meddelande
   * blev det 33 element per meddelande mot taket 26 (regel 13, `check:skalyta` avsnitt 47 (6)), och chatten ritas långsammare ju fler meddelanden den har.
   * Pekaren eller fokuset (som bubblar upp från meddelandets knappar) avgör vilket meddelande som har den. På telefon och pekskärm gäller menyn som förut.
   */
  const [aktivRad, setAktivRad] = useState(/** @type {string | null} */ (null));
  return (
    <>
      {meddelanden.map((m, i, alla) => {
        const egen = m.av === uid;
        const forra = alla[i - 1];
        const fore = forra ? forra.tid : forraTid;
        const nyDag = fore === undefined || new Date(fore).toDateString() !== new Date(m.tid).toDateString();
        // ⛔ EN NYCKELS MEDDELANDE FORTSÄTTER ALDRIG PERSONENS EGET (0.135.0, lifehub.app#409): samma avsändare inom fem minuter slås ihop under ett namn, och
        // då hade "Miranda via Byggagent" fått stå namnlöst under Mirandas eget meddelande, alltså utan märket. Märket följer meddelandet.
        const fortsattning = !nyDag && forra && forra.av === m.av && sammaVia(forra, m) && m.tid - forra.tid < 5 * 60000;
        // Personen utan märket: avataren och initialerna. Texten som läses går genom `avNamnFor`.
        const person = namnFor(m.av);
        const extra = efter?.(m);
        // ⛔ (0.203.0) Ett eget svar som ännu inte är skrivet (`OpsTrad`) har inga åtgärder: en reaktion, en fästning eller ett citat hade pekat på ett meddelande
        // som inte finns i källan än. Kopiera står kvar, den läser bara texten.
        const vantar = /** @type {any} */ (m).vantar === true;
        return (
          <div key={m.id}>
            {nyDag ? (
              <div className="flex justify-center py-3">
                <span className="rounded-full bg-canvas px-3 py-1 text-liten text-ink-muted">{forstaVersal(formatRelativeDate(m.tid, { locale }))}</span>
              </div>
            ) : null}
            {m.id === nyttFran ? (
              <div data-nytt-sedan-sist="" role="separator" aria-label={texter.nyttSedanSist} className="my-2 flex items-center gap-2 text-liten text-accent">
                <span aria-hidden="true" className="h-px flex-1 bg-accent" />
                <span>{texter.nyttSedanSist}</span>
                <span aria-hidden="true" className="h-px flex-1 bg-accent" />
              </div>
            ) : null}
            <div data-meddelande={egen ? "eget" : "annans"} data-vantar={vantar ? "" : undefined} onMouseEnter={menyPa ? undefined : () => setAktivRad(m.id)} onMouseLeave={menyPa ? undefined : (e) => { const rad = e.currentTarget; setAktivRad((a) => (a === m.id && meny?.id !== m.id && !rad.contains(document.activeElement) ? null : a)); }} onFocus={menyPa ? undefined : () => setAktivRad(m.id)} onBlur={menyPa ? undefined : (e) => { const rad = e.currentTarget; const till = e.relatedTarget; if (till instanceof Node && rad.contains(till)) return; if (rad.matches(":hover")) return; setAktivRad((a) => (a === m.id && meny?.id !== m.id ? null : a)); }} className={cx("group flex gap-2", fortsattning ? "mt-px" : "mt-2", egen ? "flex-row-reverse" : "", vantar && "opacity-70")}>
              {!egen ? (
                <span className="w-8 shrink-0">
                  {!fortsattning ? (
                    /* ⛔ KAN 9: agentens svar bär agentens ikon, som agentsamtalets rad i listan, så att ett svar från agenten
                       aldrig ser ut som en persons. */
                    medlemstyp(m.av) === "agent" ? (
                      onVisaAgent ? (
                        <button
                          type="button"
                          data-visa-agent={m.av}
                          aria-label={`${person}, ${texter.oppnaInstallningar}`}
                          onClick={() => onVisaAgent({ id: m.av, namn: person })}
                          className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                          <OpsIdentity name={person} seed={m.av} size="sm" icon={AgentIkon} rund />
                        </button>
                      ) : (
                        <OpsIdentity name={person} seed={m.av} size="sm" icon={AgentIkon} rund />
                      )
                    ) : (
                      <OpsIdentity name={person} seed={m.av} imageUrl={medlemsbild(m.av)} size="sm" rund />
                    )
                  ) : null}
                </span>
              ) : null}
              {/*
               * ⛔ RADEN RULLAR ALDRIG I SIDLED (0.212.1, cllp/lifehub.app#734). CP 2026-11-09 från sin iPhone: "Den bussar och scrollar i sidled." Mätt i
               * `check:skalyta` avsnitt 63 vid 390 px: loggen (`overflow-y-auto`, alltså också `overflow-x: auto`) var 703 px bred i en ruta på 380, och gick att rulla
               * 200 px åt sidan. Orsaken var `break-words` (`overflow-wrap: break-word`): det bryter en lång adress eller ett långt ord först när raden redan är full,
               * men räknar inte med brytningen i elementets MINSTA bredd. Kolumnen och bubblan är `fit-content` i en flexrad, så deras bredd blev det längsta ordet
               * (en länk på 526 px, en kodrad på 623), och 70-procentskolumnen svämmade över. `wrap-anywhere` (`overflow-wrap: anywhere`) räknar brytningen också i
               * minsta bredden. Den sitter här och ärvs av allt i kolumnen: bubblan, namnraden, citatet, omröstningen, bilagans namn och trådens rad.
               * ⛔ Det som aldrig ska brytas står `shrink-0` och `whitespace-nowrap`: tiden och märket "Gäst" på namnraden (märket bröts i tre rader bredvid ett långt
               * gästnamn, granskningen av PR 567). Det är namnet som bryts.
               */}
              <div className={cx("flex min-w-0 max-w-[70%] flex-col wrap-anywhere", egen ? "items-end" : "items-start")}>
                {/* ⛔ ETT MEDDELANDE FRÅN EN NYCKEL BÄR ALLTID SITT MÄRKE (0.135.0): namnraden ritas även i ett privat samtal, och på ens eget meddelande. */}
                {/* ⛔ TIDEN STÅR PÅ NAMNRADEN (0.190.0, CP 2026-11-05 i cllp/lifehub.app#658): efter namnet och märket Gäst, inte på en egen rad under bubblan. Det
                    första meddelandet i en följd bär raden; ett som följer inom fem minuter från samma avsändare står utan, som namnet. */}
                {/* ⛔ INGET EXTRA ELEMENT FÖR NAMNRADEN (granskningen av PR 524, skalyta 47 (6): 27 element per meddelande mot taket 26). Raden är samma span som namnet
                    stod i förut, och tiden flyttade in i den från raden under bubblan: lika många element som i 0.189.0. Utan namn är tiden själv raden. */}
                {egen && !fortsattning ? (
                  m.via ? (
                    <span data-namnrad="eget" data-via-eget="" className="mr-1 mb-0.5 flex items-center gap-1.5 text-liten text-ink-muted">
                      {avNamnFor(namnFor, m, uid, texter.du, sprak)}
                      <span data-meddelande-tid="" className="shrink-0 tabular-nums">{formatTime(m.tid, { locale })}</span>
                    </span>
                  ) : (
                    <span data-namnrad="eget" data-meddelande-tid="" className="mr-1 mb-0.5 text-liten tabular-nums text-ink-muted">{formatTime(m.tid, { locale })}</span>
                  )
                ) : null}
                {!egen && !fortsattning ? (
                  visaNamn || m.via ? (
                    <span data-namnrad="annans" data-avsandare="" className="mb-0.5 ml-1 flex items-center gap-1.5 text-liten text-ink-muted" data-namn-saknas={person === NAMN_SAKNAS ? "" : undefined}>
                      {avNamnFor(namnFor, m, uid, texter.du, sprak)}
                      {arGast(m) ? <span data-gast-markning="" className="shrink-0 whitespace-nowrap rounded-full bg-sunken px-1.5 py-px text-mikro font-medium text-ink-secondary">{texter.gast}</span> : null}
                      <span data-meddelande-tid="" className="shrink-0 tabular-nums">{formatTime(m.tid, { locale })}</span>
                    </span>
                  ) : (
                    <span data-namnrad="annans" data-meddelande-tid="" className="mb-0.5 ml-1 text-liten tabular-nums text-ink-muted">{formatTime(m.tid, { locale })}</span>
                  )
                ) : null}
                {m.svarPa && citat ? <Citat mid={m.svarPa} uppslag={citat.uppslag} egen={egen} uid={uid} namnFor={namnFor} texter={texter} /> : null}
                {/* ⛔ EN LÄNK SOM BLEV ETT KORT STÅR INTE OCKSÅ I BUBBLAN (0.196.0, cllp/ops-framework#527): `visad` är texten utan de länkar som slogs upp till ett kort. Var länken allt som stod blir
                    det ingen bubbla, bara kortet. Ett uppslag som gav `null` eller föll lämnar länken kvar (regel 5). Den lagrade texten är orörd. */}
                {m.omrostning && omrostning?.pa ? (
                  <Omrostningskort m={m} omr={omrostning} namnFor={namnFor} bildFor={medlemsbild} texter={texter} />
                ) : (
                <MedPostkort text={m.text} postkort={postkort} egen={egen} texter={texter}>
                  {(visad, kort) => (
                    <>
                      {visad ? (
                        <Langtryckbubbla pa={menyPa} onMeny={(punkt) => setMeny({ id: m.id, punkt })}>
                        <div
                          data-bubbla=""
                          data-traff={traffar?.ids.has(m.id) ? (traffar.aktuell === m.id ? "aktuell" : "traff") : undefined}
                          className={cx(
                            "min-w-0 rounded-2xl px-3.5 py-2 text-etikett leading-relaxed wrap-anywhere",
                            traffar?.ids.has(m.id) ? (traffar.aktuell === m.id ? "outline-2 outline-offset-2 outline-accent" : "outline-1 outline-offset-2 outline-line-strong") : "",
                            egen ? "bg-accent text-accent-contrast" : "bg-hover text-ink",
                            fortsattning && egen ? "rounded-tr-lg" : "",
                            fortsattning && !egen ? "rounded-tl-lg" : "",
                          )}
                        >
                          {/* ⛔ #273: chattens delmängd av markdown, med klickbara http- och https-länkar och ingen HTML. Färgen ärvs från
                              bubblan: den egna är accentfärgad. */}
                          <OpsMarkdown text={visad} chatt omnamnanden={omnamnadeNamn(m)} />
                        </div>
                        </Langtryckbubbla>
                      ) : null}
                      {m.bilaga ? (
                        <VisadBilaga
                          m={m}
                          kalla={kalla}
                          sid={sid ?? ""}
                          trad={trad}
                          alt={`${texter.bilagaText} ${avNamnFor(namnFor, m, uid, texter.du, sprak)}: ${m.bilaga.namn}`}
                          texter={texter}
                        />
                      ) : null}
                      {kort}
                    </>
                  )}
                </MedPostkort>
                )}
                {/* ⛔ BARA UNDER EN AGENTS SVAR (0.105.0). Ett meddelande från en person som bär `forslag` (en klient skrev förbi
                    reglerna, eller ett fält med samma namn) får inga knappar: ett förslag är något agenten lägger fram. */}
                {onForslag && !egen && sid && medlemstyp(m.av) === "agent" && /** @type {any} */ (m).forslag !== undefined ? (
                  <AgentensForslag varde={/** @type {any} */ (m).forslag} sid={sid} mid={m.id} onForslag={onForslag} />
                ) : null}
                {reakt?.pa && !vantar ? <Reaktionschips m={m} egen={egen} reakt={reakt} texter={texter} /> : null}
                <Meddelandemeta m={m} egen={egen} bredd={bredd} menyPa={menyPa} pekskarm={pekskarm} oppnadVid={meny?.id === m.id ? meny.punkt : null} onOppnadVid={(v) => { if (!v) setMeny(null); }} extra={extra} mer={vantar ? [] : merFor?.(m) ?? []} namn={egen ? texter.dittMeddelande : `${texter.svarPa} ${avNamnFor(namnFor, m, uid, texter.du, sprak)}`} reakt={vantar ? undefined : reakt} fasta={vantar ? null : fasta} citat={vantar ? null : citat} texter={texter} visaKopior={aktivRad === m.id} lank={meddelandeHref && !vantar ? meddelandeHref({ meddelandeId: m.id, ...(sid ? { samtalId: sid } : {}), ...(trad ? { tradId: trad } : {}) }) : null} />
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

/**
 * En tråd i gruppchatten (0.68.0, cllp/lifehub.app#60): raden tillbaka till gruppchatten, trådens namn med Döp om,
 * rotmeddelandet, svaren och skrivfältet.
 *
 * ⛔ TRÅDEN SKAPAS MED DET FÖRSTA SVARET (`skickaITrad`), inte när vyn öppnas. Döp om finns därför först när tråden finns.
 *
 * ⛔ NAMNET HÄRLEDS UR ROTMEDDELANDET OCH DE FÖRSTA SVAREN (`tradensNamn`), samma regel som appens agent använder, så att
 * agenten och personerna kallar tråden samma sak.
 *
 * @param {object} props
 * @param {ReturnType<typeof import("../data/samtalskalla.js").createSamtalskalla>} props.kalla
 * @param {string} props.uid
 * @param {import("../lib/samtal.js").Samtal} props.samtal Gruppchatten.
 * @param {string} props.tid Rotmeddelandets id.
 * @param {string} props.gruppNamn
 * @param {(uid: string) => string} props.namnFor
 * @param {ReadonlyArray<Medlemsrad>} [props.medlemmar]
 * @param {() => void} props.onStang Tillbaka till gruppchatten.
 * @param {(m?: import("../lib/samtal.js").Meddelande & { id: string }) => void} [props.onSvarat] Anropas efter ett skickat svar, så att chattens märke kan räknas om.
 *   (0.203.0) Med svaret som skrevs, så att märket kan visa det direkt.
 * @param {(namn: string | null) => void} [props.onDopt] Anropas efter en omdöpning, med namnet eller `null` för det härledda.
 * @param {Postkort} [props.postkort] (chattens nattskiva) Länkar till appens poster som kort.
 * @param {(blob: Blob) => Promise<string>} [props.onTranscribe] (chattens nattskiva) Appens transkribering. Med den ritas ljudvågen i
 *   skrivfältet. ⛔ (0.103.0) Det sagda skickas som ett meddelande när man trycker Klar, och `onTranscribe` används bara när inget av det
 *   hördes (se `useRostinmatning`). Utan den ingen ljudvåg.
 * @param {(sid: string, tid?: string) => void} [props.onStoppaAgent] Appens sätt att stoppa agenten. Med den står stopp i fältet medan
 *   agenten arbetar. Utan den ingen sådan knapp.
 * @param {import("../lib/talk.js").Inspelare} [props.inspelare] Bara för prov. Förval: webbläsarens inspelning, TALK:s.
 * @param {import("../lib/talk.js").Igenkanning | boolean} [props.igenkanning] (0.98.0) Text medan man pratar, som TALK:s `igenkanning`. (0.103.0)
 *   Texten står i inspelningsytan, inte i skrivfältet. ⛔ AV SOM FÖRVAL, av samma skäl som i TALK: webbläsaren skickar talet till Googles
 *   eller Apples taltjänst, och det är appens val. `true` slår på webbläsarens taligenkänning när den finns. Utan den, eller när inget
 *   hördes, skriver `onTranscribe` ut ljudet.
 * @param {Franbiblioteket} [props.franBiblioteket] (0.164.0, lifehub.app#226) Raden "Lägg till från Biblioteket" i pluset.
 * @param {(filer: File[], slag: "bild" | "foto" | "fil") => void} [props.onBifoga] (0.77.0, #292) Samma som på `OpsSamtal`.
 * @param {string} [props.sprak]
 * @param {Meddelandetexter} [props.texter]
 * @param {string} [props.mejl] (0.80.0, #301) Adressen appen skickar in. Utan den ritas ingen mejlknapp.
 * @param {(rad: { samtal: string, trad: string, meddelande: string, text: string, av: string }) => void | Promise<void>} [props.onLyftTillMinnet]
 *   (0.86.0) Knappen "Lyft till minnet" på rotmeddelandet och på svaren. Utan den ingen knapp.
 * @param {string} [props.minneHref] (0.86.0) Länk till minnesvyn i trådens huvud. Utan den ingen länk.
 * @param {(agent: { id: string, namn: string }) => void} [props.onVisaAgent] (0.90.0) Agentens avatar i tråden öppnar inställningarna.
 * @param {MeddelandeHref} [props.meddelandeHref] (lifehub.app#712) Appens väg till ett meddelande, för "Kopiera länk" i menyn. Ramverket känner aldrig appens rutter. Utan den finns inte raden.
 * @param {ReadonlyArray<Omnamnbar>} [props.flerOmnamnbara] (lifehub.app#723) Fler som går att nämna med @, utöver de aktiva medlemmarna: appens API-agenter, vars medlemskap står som "avslutad". De läggs bara till @-listan och påverkar aldrig agentval, mottagare eller medlemslistor. Nämnandet skrivs som vanligt i `namner` (id). Utan den är listan exakt som förut.
 */
export function OpsTrad({ kalla: kallan, uid, samtal, tid, gruppNamn, namnFor, medlemmar, onStang, onSvarat, onDopt, sprak: sprakProp, texter = {}, postkort, onTranscribe, onStoppaAgent, inspelare, igenkanning, onBifoga: onBifogaProp, franBiblioteket, mejl, onLyftTillMinnet, minneHref, onVisaAgent, meddelandeHref, flerOmnamnbara }) {
  if (!harTradar(kallan)) throw new Error("OpsTrad: källan har inga trådar. Skicka `tradar` till createSamtalskalla, med samma namn som till samtalsregelfragment.");
  const kalla = kallan;
  const sprakKontext = useOpsSprak();
  const sprak = sprakProp ?? sprakKontext;
  const t = texterPa(sprak, texter);
  const bilage = useBilageutkast(kalla, onBifogaProp, t);
  const locale = sprak === "en" ? "en-GB" : "sv-SE";
  const [rot, setRot] = useState(/** @type {(import("../lib/samtal.js").Meddelande & { id: string }) | null | undefined} */ (undefined));
  const [trad, setTrad] = useState(/** @type {import("../lib/samtal.js").Trad | null} */ (null));
  const [svar, setSvar] = useState(/** @type {Array<import("../lib/samtal.js").Meddelande & { id: string }> | null} */ (null));
  const [fel, setFel] = useState(/** @type {Error | null} */ (null));
  const [lyftFel, setLyftFel] = useState(/** @type {Error | null} */ (null));
  // ⛔ 0.141.0: "Lyft till minnet" väntar på appen. Id:t på meddelandet som lyfts, så knappen på just det meddelandet visar det.
  const [lyfter, setLyfter] = useState(/** @type {string | null} */ (null));
  const [text, setText] = useState("");
  const [skickar, setSkickar] = useState(false);
  const [redigerar, setRedigerar] = useState(false);
  const [utkastNamn, setUtkastNamn] = useState("");
  // ⛔ 0.141.0: Spara och "Automatiskt namn" väntar på servern. Knappen visar det, och ett andra tryck startar inget.
  const [sparar, setSparar] = useState(/** @type {null | "namn" | "auto"} */ (null));
  const lyssnar = useRef(false);
  const tradlogg = useRef(/** @type {HTMLDivElement | null} */ (null));
  const historik = useHistorik({ kalla, sid: samtal.id, trad: tid, live: svar, logg: tradlogg });
  /*
   * ⛔ DET EGNA SVARET STÅR DIREKT (0.203.0). CP 2026-11-08: "Det var också en fördröjning på svar i tråden. Så jag fattade först inte var mitt
   * trådsvar blev av." Läst ur koden, inte mätt i produktion: gruppchatten skriver meddelandet direkt, och källans egen lyssnare (Firestores
   * lokala skrivning) visar det innan servern svarat. Tråden läste först tråden och, för det första svaret, skrev den, och först sedan
   * meddelandet; under tiden stod ingenting i tråden. Gruppchatten har alltså inget eget eko, den har ingen väntan före skrivningen.
   * Källan väntar nu bara när tråden är okänd (`kandaTradar`), och väntan som återstår (det första svaret i en ny tråd, eller en källa
   * utan lyssnare) täcks av svaret självt: `skickaITrad` ger det med sitt id (`onLokal`) innan källan rörs, det står med "Skickas…" tills
   * det är skrivet, och sedan som ett vanligt svar tills källan har det. Samma id: när källans rad kommer står svaret en gång.
   * Det lokala är aldrig en andra sanning: det är det meddelande som skrivs, och det försvinner så snart källan visar det, eller om skrivningen föll.
   */
  const [lokala, setLokala] = useState(/** @type {Array<import("../lib/samtal.js").Meddelande & { id: string, vantar?: boolean }>} */ ([]));
  const visade = useMemo(() => {
    if (lokala.length === 0) return historik.alla;
    const kanda = new Set(historik.alla.map((m) => m.id));
    const egna = lokala.filter((m) => !kanda.has(m.id));
    return egna.length === 0 ? historik.alla : [...historik.alla, ...egna].sort((a, b) => a.tid - b.tid);
  }, [historik.alla, lokala]);
  useEffect(() => {
    if (lokala.length === 0) return;
    const kanda = new Set(historik.alla.map((m) => m.id));
    if (lokala.some((m) => kanda.has(m.id))) setLokala((l) => l.filter((m) => !kanda.has(m.id)));
  }, [historik.alla, lokala]);
  const sok = useSokISamtal(historik.alla, tradlogg);
  const [info, setInfo] = useState(false);
  const { tyst, vaxla: vaxlaTyst } = useTystnad(kalla, samtal.id, uid, setFel);
  const post = mejlHref(mejl);
  // ⛔ Trådens reaktioner bor under tråden (regeln följer tråden). Rotmeddelandets reaktioner står i gruppchatten.
  const reakt = useReaktioner(harReaktioner(kalla) ? kalla : null, samtal.id, tid, uid);
  const agentlage = useAgentstatusdok(harStatus(kalla) ? kalla : null, samtal.id, tid);
  const namnId = useId();
  const dopKnapp = useRef(/** @type {HTMLButtonElement | null} */ (null));
  // ⛔ KAN 6: fokus stannar i rubriken när Döp om stängs (Spara, Avbryt eller Escape), i stället för att falla till dokumentet.
  const stangDop = () => {
    setRedigerar(false);
    requestAnimationFrame(() => dopKnapp.current?.focus());
  };
  const somFel = (/** @type {unknown} */ e) => (e instanceof Error ? e : new Error(String(e)));

  const lasTraden = async () => {
    try {
      setTrad(await kalla.trad(samtal.id, tid));
    } catch (e) {
      setFel(somFel(e));
    }
  };
  const lasSvar = async () => {
    try {
      setSvar(await kalla.tradmeddelanden(samtal.id, tid));
    } catch (e) {
      setFel(somFel(e));
    }
  };

  useEffect(() => {
    kalla.rotmeddelande(samtal.id, tid).then(
      (r) => setRot(r ? { ...r, id: tid } : null),
      (e) => setFel(somFel(e)),
    );
    lasTraden();
    const stang = kalla.prenumereraTrad(samtal.id, tid, {
      onData: (rader) => setSvar(rader),
      onError: (e) => setFel(e),
    });
    lyssnar.current = Boolean(stang);
    if (!stang) lasSvar();
    return () => stang?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kalla, samtal.id, tid]);

  // ⛔ (0.106.0) Rullningen sköts av `useLasposition`, som i samtalet: den som läser bakåt i tråden rycks inte ned.
  const lasposition = useLasposition({ logg: tradlogg, alla: visade, uid, laddat: svar !== null });

  const namn = tradensNamn(trad, [...(rot ? [rot] : []), ...historik.alla]);
  /** @param {import("../lib/samtal.js").Meddelande & { id: string }} m */
  const lyft = async (m) => {
    if (!onLyftTillMinnet || lyfter !== null) return;
    setLyftFel(null);
    setLyfter(m.id);
    try {
      await onLyftTillMinnet({
        samtal: samtal.id,
        trad: tid,
        meddelande: m.id,
        text: typeof m.text === "string" ? m.text : "",
        av: m.av,
      });
    } catch (e) {
      setLyftFel(somFel(e));
    } finally {
      setLyfter(null);
    }
  };
  const lyftEfter = onLyftTillMinnet
    ? (/** @type {import("../lib/samtal.js").Meddelande & { id: string }} */ m) => {
        const synlig = typeof m.text === "string" ? m.text.trim() : "";
        if (!synlig) return null;
        return (
          <button
            type="button"
            data-lyft-minne={m.id}
            disabled={lyfter !== null}
            aria-busy={lyfter === m.id || undefined}
            onClick={() => lyft(m)}
            className="-my-2 hidden min-h-11 max-w-full cursor-pointer items-center rounded-full px-2 text-liten text-accent transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent md:inline-flex"
          >
            {lyfter === m.id ? <OpsSpinner size="sm" tone="current" decorative /> : null}
            {t.lyftTillMinnet}
          </button>
        );
      }
    : undefined;
  // (0.203.0) Under ett eget svar som ännu inte är skrivet står "Skickas…" i stället för vyns knappar: det finns inget att lyfta än.
  const skickasEfter = (/** @type {import("../lib/samtal.js").Meddelande & { id: string, vantar?: boolean }} */ m) =>
    m.vantar ? (
      <span role="status" data-skickas={m.id} className="text-liten text-ink-muted">
        {t.skickas}
      </span>
    ) : (
      lyftEfter?.(m) ?? null
    );
  // På telefon bor "Lyft till minnet" i meddelandets meny (0.106.0, #386 skiva 6), med samma villkor: bara när det finns text.
  const lyftMer = onLyftTillMinnet
    ? (/** @type {import("../lib/samtal.js").Meddelande & { id: string }} */ m) =>
        typeof m.text === "string" && m.text.trim() ? [{ id: "minne", etikett: t.lyftTillMinnet, onValj: () => lyft(m) }] : []
    : undefined;
  // Roten står i gruppchatten, svaren i tråden: trådens id hör till svarens filnycklar, inte rotens.
  const infoposter = useMemo(() => [...(rot ? [{ m: rot }] : []), ...historik.alla.map((m) => ({ m, trad: tid }))], [rot, historik.alla, tid]);
  const filer = useChattinfoFiler({ kalla, sid: samtal.id, oppen: info, poster: infoposter, felText: t.bilagorFel });

  /**
   * Skicka i tråden. `extra.text` är det sagda (0.103.0), som i `OpsSamtal`: fältet och bilagan rörs inte, och ett fel kastas till
   * inspelningsytan i stället för att läggas i tråden.
   * @param {{ namner?: string[], text?: string }} [extra]
   */
  const skicka = async (extra) => {
    const tal = typeof extra?.text === "string";
    const ut = tal ? /** @type {string} */ (extra?.text) : text;
    if (tal && skickar) throw new Error(t.annatSkickas);
    if (tal && !ut.trim()) throw new Error(t.ingenText);
    if (skickar || (!ut.trim() && !bilage.bilaga)) return;
    setSkickar(true);
    let skickat = false;
    // Id:t på det egna svaret, satt av `onLokal`. Ett objekt och inte en `let`: typkontrollen följer inte en tilldelning i en återkoppling.
    const lokalt = { id: /** @type {string | null} */ (null) };
    try {
      const ny = await kalla.skickaITrad(
        samtal.id,
        tid,
        { text: ut, av: uid, ...(extra?.namner ? { namner: extra.namner } : {}), ...(!tal && bilage.bilaga ? { bilaga: bilage.bilaga } : {}) },
        {
          onLokal: (m) => {
            lokalt.id = m.id;
            setLokala((l) => [...l, { ...m, vantar: true }]);
          },
        },
      );
      skickat = true;
      // Skrivet: "Skickas…" går bort, och svaret står kvar som ett vanligt svar tills källan visar det (samma id).
      setLokala((l) => l.map((m) => (m.id === lokalt.id ? { ...m, vantar: false } : m)));
      if (!tal) {
        setText("");
        bilage.tom();
      }
      onSvarat?.(ny);
      if (!trad) await lasTraden();
      if (!lyssnar.current) await lasSvar();
    } catch (e) {
      // ⛔ Föll skrivningen står svaret inte kvar som om det skickats. Föll läsningen efteråt är det skrivet, och källan visar det.
      if (lokalt.id && !skickat) setLokala((l) => l.filter((m) => m.id !== lokalt.id));
      // ⛔ Bara sändningen kastar, som i `OpsSamtal`.
      if (tal && !skickat) throw e;
      setFel(somFel(e));
    } finally {
      setSkickar(false);
    }
  };

  /** @param {string | null} nytt */
  const spara = async (nytt) => {
    if (sparar !== null) return;
    setSparar(nytt === null ? "auto" : "namn");
    try {
      await kalla.dopOm(samtal.id, tid, nytt);
      onDopt?.(nytt && nytt.trim() ? nytt.trim() : null);
      await lasTraden();
      stangDop();
    } catch (e) {
      setFel(somFel(e));
    } finally {
      setSparar(null);
    }
  };

  return (
    <OpsSprakProvider sprak={sprak}>
    <div data-ops-trad="" className="relative flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        data-tillbaka-chatten=""
        onClick={onStang}
        className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 border-b border-line px-3 text-meta text-ink-secondary hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        <ChevronVansterIkon size={14} />
        <span className="min-w-0 truncate">{gruppNamn}</span>
      </button>
      <div className={cx("flex min-h-0 flex-1", info ? "flex-col md:flex-row" : "flex-col")}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-3 py-2.5">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-faint text-accent">
          <TradIkon size={18} />
        </span>
        {redigerar ? (
          <form
            className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                stangDop();
              }
            }}
            onSubmit={(e) => {
              e.preventDefault();
              spara(utkastNamn);
            }}
          >
            <label htmlFor={namnId} className="sr-only">
              {t.tradnamn}
            </label>
            <input
              id={namnId}
              value={utkastNamn}
              onChange={(e) => setUtkastNamn(e.target.value)}
              maxLength={MAX_TRADNAMN}
              autoFocus
              className="min-h-9 min-w-0 flex-1 rounded-base border border-line bg-canvas px-2.5 text-etikett text-ink outline-none focus-visible:border-accent"
            />
            <button
              type="submit"
              disabled={sparar !== null}
              aria-busy={sparar === "namn" || undefined}
              className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-base bg-accent px-3 text-meta font-medium text-accent-contrast hover:bg-accent-hover disabled:cursor-default disabled:opacity-70"
            >
              {sparar === "namn" ? <OpsSpinner size="sm" tone="current" decorative /> : null}
              {t.spara}
            </button>
            <button type="button" onClick={stangDop} className="inline-flex min-h-9 cursor-pointer items-center rounded-base px-2 text-meta text-ink-secondary hover:bg-hover">
              {t.avbryt}
            </button>
            {trad?.namn ? (
              <button
                type="button"
                disabled={sparar !== null}
                aria-busy={sparar === "auto" || undefined}
                onClick={() => spara(null)}
                className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-base px-2 text-meta text-accent hover:bg-accent-faint disabled:cursor-default disabled:opacity-70"
              >
                {sparar === "auto" ? <OpsSpinner size="sm" tone="current" decorative /> : null}
                {t.automatisktNamn}
              </button>
            ) : null}
          </form>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <h3 data-tradnamn="" className="m-0 truncate text-etikett font-semibold text-ink">
                {namn}
              </h3>
              <p data-privat-rad="" className="m-0 flex items-center gap-1 text-liten text-ink-muted">
                <GruppIkon size={10} />
                <span>{t.tradRad}</span>
              </p>
            </div>
            {trad ? (
              <button
                ref={dopKnapp}
                type="button"
                aria-label={t.dopOm}
                onClick={() => {
                  setUtkastNamn(namn);
                  setRedigerar(true);
                }}
                className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-base text-ink-muted hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
              >
                <AndraIkon size={16} />
              </button>
            ) : null}
            <div className="flex shrink-0 items-center">
              {minneHref ? (
                <a
                  href={minneHref}
                  data-minne-lank=""
                  className="inline-flex min-h-11 items-center rounded-full px-2 text-liten text-accent hover:bg-accent-faint focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {t.minnet}
                </a>
              ) : null}
              {post ? (
                <Verktygsknapp etikett={t.mejl} dataAttr="mejl" href={post}>
                  <MejlIkon size={16} />
                </Verktygsknapp>
              ) : null}
              {harTyst(kalla) ? (
                <Verktygsknapp etikett={tyst ? t.notiserTysta : t.tystaNotiser} dataAttr="tyst" pressed={tyst} onClick={vaxlaTyst}>
                  {tyst ? <TystIkon size={16} /> : <NotisIkon size={16} />}
                </Verktygsknapp>
              ) : null}
              <Verktygsknapp etikett={t.sokISamtalet} dataAttr="sok" expanded={sok.oppen} onClick={() => (sok.oppen ? sok.stang() : sok.oppna())}>
                <SokIkon size={16} />
              </Verktygsknapp>
              <Verktygsknapp etikett={t.chattinfo} dataAttr="info" expanded={info} onClick={() => setInfo((v) => !v)}>
                <PanelIkon size={16} />
              </Verktygsknapp>
            </div>
          </>
        )}
      </header>
      {sok.oppen ? <Sokrad sok={sok} antal={historik.alla.length} kanFinnasAldre={historik.kanFinnasAldre} texter={t} /> : null}

      <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={tradlogg} role="log" aria-label={namn} className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {fel ? (
          <OpsBanner tone="danger" title={t.tradFel}>
            {fel.message}
          </OpsBanner>
        ) : null}
        {lyftFel ? (
          <p role="alert" data-lyft-fel="" className="m-0 py-1 text-meta text-danger">
            {t.lyftMisslyckades}: {lyftFel.message}
          </p>
        ) : null}
        <div data-rotmeddelande="" className="border-b border-line pb-2">
          {rot ? (
            <Meddelanderader meddelanden={[rot]} efter={lyftEfter} merFor={lyftMer} kalla={kalla} sid={samtal.id} uid={uid} namnFor={namnFor} medlemmar={medlemmar} locale={locale} visaNamn texter={t} onVisaAgent={onVisaAgent} meddelandeHref={meddelandeHref} flerOmnamnbara={flerOmnamnbara} />
          ) : rot === null ? (
            <p className="m-0 py-3 text-meta text-ink-muted">{t.rotSaknas}</p>
          ) : null}
        </div>
        <p data-antal-svar="" className="m-0 py-2 text-liten text-ink-muted">
          {visade.length > 0 ? `${visade.length}${historik.kanFinnasAldre ? "+" : ""} ${t.svar}` : t.ingaSvar}
        </p>
        <VisaAldre historik={historik} texter={t} />
        <Reaktionslage reakt={reakt} texter={t} />
        <Meddelanderader meddelanden={visade} efter={skickasEfter} merFor={lyftMer} reakt={reakt} texter={t} postkort={postkort} kalla={kalla} sid={samtal.id} trad={tid} traffar={sok.oppen ? { ids: sok.traffar, aktuell: sok.aktuell } : null} uid={uid} namnFor={namnFor} medlemmar={medlemmar} locale={locale} visaNamn forraTid={rot?.tid} onVisaAgent={onVisaAgent} meddelandeHref={meddelandeHref} flerOmnamnbara={flerOmnamnbara} />
        <Agentrad lage={agentlage} texter={t} />
      </div>
      <TillSenaste lage={lasposition} arbetar={arbetsord(agentlage)} texter={t} />
      </div>

      <Bilageutkast bilaga={bilage.bilaga} fel={bilage.fel} onTaBort={bilage.tom} texter={t} />
      <Skrivfalt
        text={text}
        setText={setText}
        skickar={skickar}
        onSkicka={skicka}
        texter={t}
        sprak={sprak}
        fokus
        omnamnande={omnamnandeFor(kalla, samtal.slag, medlemmar, uid, namnFor, flerOmnamnbara)}
        platstext={t.skrivTrad}
        onTranscribe={onTranscribe}
        inspelare={inspelare}
        igenkanning={igenkanning}
        onBifoga={bilage.onBifoga}
        franBiblioteket={franBiblioteket}
        harBilaga={Boolean(bilage.bilaga)}
        kamera={bilage.kamera}
        agentArbetar={agentArbetar(agentlage)}
        onStoppaAgent={onStoppaAgent ? () => onStoppaAgent(samtal.id, tid) : undefined}
      />
      </div>
      {info ? (
        <div className="absolute inset-0 z-(--z-modal) flex min-h-0 flex-col bg-canvas md:static md:z-auto md:w-80 md:shrink-0 md:border-l md:border-line">
          <OpsChattinfo
            medlemmar={samtalsdeltagare(samtal, medlemmar)}
            bilagor={filer.bilagor}
            bilagorFler={filer.fler}
            bilagorFel={filer.fel}
            meddelanden={[...(rot ? [rot] : []), ...historik.alla]}
            aldreFinns={historik.kanFinnasAldre}
            namnFor={namnFor}
            onStang={() => setInfo(false)}
            texter={t}
          />
        </div>
      ) : null}
      </div>
    </div>
    </OpsSprakProvider>
  );
}

/**
 * Agentens status som en rad där svaret kommer (#273): "Agenten tänker" eller "Agenten skriver", eller en felrad.
 *
 * ⛔ BARA NÄR KÄLLAN HAR STATUS (`harStatus`). En app som inte skickat `status` får ingen rad och ingen läsning.
 *
 * ⛔ EN STATUS ÄLDRE ÄN TVÅ MINUTER VISAS INTE, OCH DÅ STÅR EN FELRAD I STÄLLET (ärendets krav, regel 5). En agent som kraschade
 * tar aldrig bort sin status, och "tänker" för alltid hade varit en tyst nedsläppsväg som ser ut som arbete. Vyn räknar om när
 * gränsen passeras, med en timer till exakt den tidpunkten, så att raden byts också när ingenting annat händer i samtalet.
 *
 * ⛔ EN LUGN ANIMATION, OCH INGEN ALLS FÖR DEN SOM BETT OM DET (`motion-safe:`). Raden är en `status` och läses upp en gång när
 * den kommer, inte vid varje punkt som tänds.
 *
 * @param {{ lage: ReturnType<typeof useAgentstatusdok>, texter: Required<Meddelandetexter> }} props `lage` ur `useAgentstatusdok`, som
 *   samtalet också läser för skrivfältets stoppknapp: en lyssnare, två läsare.
 */
function Agentrad({ lage, texter: t }) {
  const { dok, fel } = lage;
  const [nu, setNu] = useState(() => Date.now());
  const visning = agentstatus(dok, nu);
  // Räkna om när statusen passerar sitt tak, också om inget nytt kommer.
  // ⛔ `nu` ÄR ETT BEROENDE, OCH VARJE VÄCKNING GER ETT NYTT `nu` (0.73.1). En timer kan vakna innan väggklockan passerat gränsen:
  // timern mäts mot en monoton klocka, `Date.now()` är väggklockan, och gränsen är strikt. Gav väckningen samma tal som förra gången
  // (klockan stod still på gränsen) ritade React inte om, effekten kördes inte, och ingen ny timer sattes: "Agenten tänker" stod kvar
  // för alltid. Med `Math.max(Date.now(), f + 1)` blir `nu` alltid större än förut, så varje väckning ritar om och sätter en ny timer,
  // och senast en millisekund efter gränsen enligt vyns egen räkning byts raden mot felraden, vad väggklockan än säger.
  useEffect(() => {
    if (!visning || "fel" in visning) return undefined;
    const kvar = visning.sedan + AGENTSTATUS_MAX_ALDER - Date.now() + 1;
    const h = setTimeout(() => setNu((f) => Math.max(Date.now(), f + 1)), Math.max(0, kvar));
    return () => clearTimeout(h);
  }, [visning && "sedan" in visning ? visning.sedan : null, visning && "lage" in visning ? visning.lage : null, nu]);
  useEffect(() => {
    setNu(Date.now());
  }, [dok]);
  if (fel || (visning && "fel" in visning)) {
    const text = visning && "fel" in visning && visning.fel === "gammal" ? t.agentFastnat : t.agentstatusFel;
    return (
      <p data-agentstatus="fel" role="alert" className="m-0 mt-2 flex items-center gap-1.5 text-meta text-danger">
        <AgentIkon size={14} />
        <span>{text}</span>
      </p>
    );
  }
  if (!visning) return null;
  return (
    <p data-agentstatus={visning.lage} role="status" className="m-0 mt-2 flex items-center gap-2 text-meta text-ink-muted">
      <span className="inline-flex size-8 shrink-0 items-center justify-center text-accent">
        <AgentIkon size={16} />
      </span>
      <span>{visning.lage === "tanker" ? t.agentTanker : t.agentSkriver}</span>
      <span aria-hidden="true" className="inline-flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1 rounded-full bg-current motion-safe:animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
        ))}
      </span>
    </p>
  );
}

/**
 * Statusdokumentet, med en lyssnare där källan kan, annars en läsning.
 * @param {(ReturnType<typeof import("../data/samtalskalla.js").createSamtalskalla> & import("../data/samtalskalla.js").Statusfunktioner) | null} kalla
 * @param {string} sid @param {string | undefined} tid
 * @returns {{ dok: any, fel: Error | null }}
 */
function useAgentstatusdok(kalla, sid, tid) {
  const [lage, setLage] = useState(/** @type {{ dok: any, fel: Error | null }} */ ({ dok: null, fel: null }));
  useEffect(() => {
    if (!kalla) return undefined;
    let levande = true;
    const val = tid === undefined ? {} : { tid };
    const stang = kalla.prenumereraStatus(sid, { onData: (dok) => levande && setLage({ dok, fel: null }), onError: (e) => levande && setLage({ dok: null, fel: e }) }, val);
    if (!stang) {
      kalla.lasStatus(sid, val).then(
        (dok) => levande && setLage({ dok, fel: null }),
        (e) => levande && setLage({ dok: null, fel: e instanceof Error ? e : new Error(String(e)) }),
      );
    }
    return () => {
      levande = false;
      stang?.();
    };
  }, [kalla, sid, tid]);
  return lage;
}

/** Närmare slutet än så räknas som att stå vid slutet, i pixlar (0.106.0, #386 skiva 4). Ungefär en bubbla. */
export const SLUTTROSKEL = 96;

/**
 * Läspositionen i en logg (0.106.0, #386 skiva 4): följ slutet för den som står där, och låt den som läser bakåt vara.
 *
 * ══ ⛔ VARFÖR ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Före 0.106.0 rullade loggen till slutet vid VARJE ögonblicksbild (`slut.scrollIntoView`), också när man läste äldre meddelanden:
 * den som läste bakåt rycktes ned när någon skrev. Och tvärtom: CP 2026-10-14, med en skärmbild från telefonen, raden "Agenten
 * tänker •••" kom in under sista meddelandet men sidan rullade inte, så den hamnade under skrivfältet och syntes inte. Statusraden,
 * ett förslagskort och ett skrivfält som växer ändrar höjden utan att något nytt meddelande kommer, och då rullade ingenting.
 *
 * ⛔ ETT TILLSTÅND OCH TRE SIGNALER. `vidSlutet` sätts av rullningen: inom `SLUTTROSKEL` från slutet. Står man där följer vyn med
 * när innehållet ändras (MutationObserver i loggen), när loggen själv byter storlek (ResizeObserver, skrivfältet växer eller
 * tangentbordet kommer) och när en bild laddas. Har man rullat upp händer ingenting med rullningen, och nya meddelanden från andra
 * räknas till "Till senaste". Ett eget meddelande rullar alltid till slutet: den som skickar vill se det.
 *
 * ⛔ EN SIDA BAKÅT ÄR INTE NYTT. Bara meddelanden med en tid efter den senaste som redan setts räknas.
 *
 * @param {{ logg: { current: HTMLElement | null }, alla: ReadonlyArray<{ id: string, av: string, tid: number }>, uid: string, laddat: boolean }} p
 */
function useLasposition({ logg, alla, uid, laddat }) {
  const vidSlutet = useRef(true);
  const [uppe, setUppe] = useState(false);
  const [nya, setNya] = useState(0);
  const sett = useRef(/** @type {Set<string>} */ (new Set()));
  const senastTid = useRef(-Infinity);
  const forsta = useRef(true);
  const tillSlutet = useCallback(() => {
    const el = logg.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    vidSlutet.current = true;
    setUppe(false);
    setNya(0);
  }, [logg]);
  useEffect(() => {
    const el = logg.current;
    if (!el) return undefined;
    // ⛔ Måtten vid senaste läsningen. Ett scroll-event köas i webbläsaren och körs i nästa bildruta, mot den geometri som gäller DÅ.
    // Mätt i check-skalyta 47 (5), Chromium 390 px: skrivfältet krympte (loggen växte och webbläsaren drog ned scrollTop), och innan
    // eventet hann köras öppnades tangentbordet och loggen krympte 232 px. Eventet läste då "långt från slutet", vyn slutade följa och
    // Till senaste kom fram fast personen aldrig rört skärmen. En rullning personen gör ändrar inte måtten; en layoutändring gör det.
    // Har måtten ändrats sedan sist, och vyn stod vid slutet, är eventet layoutens och inte personens: vyn följer med i stället.
    // En logg som aldrig ritats (dold flik, ingen layout) har inga mått att jämföra med: då avgör rullningen själv.
    /** @type {null | { sh: number, ch: number }} */
    let matt = null;
    const spara = () => {
      matt = el.scrollHeight || el.clientHeight ? { sh: el.scrollHeight, ch: el.clientHeight } : null;
    };
    spara();
    const rulla = () => {
      if (vidSlutet.current && matt && (el.scrollHeight !== matt.sh || el.clientHeight !== matt.ch)) {
        el.scrollTop = el.scrollHeight;
        spara();
        return;
      }
      spara();
      const vid = el.scrollHeight - el.scrollTop - el.clientHeight <= SLUTTROSKEL;
      vidSlutet.current = vid;
      setUppe(!vid);
      if (vid) setNya(0);
    };
    const folj = () => {
      if (vidSlutet.current) el.scrollTop = el.scrollHeight;
      spara();
    };
    el.addEventListener("scroll", rulla, { passive: true });
    el.addEventListener("load", folj, true);
    const mo = typeof MutationObserver === "function" ? new MutationObserver(folj) : null;
    mo?.observe(el, { childList: true, subtree: true, characterData: true });
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(folj) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", rulla);
      el.removeEventListener("load", folj, true);
      mo?.disconnect();
      ro?.disconnect();
    };
  }, [logg]);
  useLayoutEffect(() => {
    if (!laddat) return;
    const nyaEfter = alla.filter((m) => !sett.current.has(m.id) && m.tid > senastTid.current);
    for (const m of alla) {
      sett.current.add(m.id);
      if (m.tid > senastTid.current) senastTid.current = m.tid;
    }
    if (forsta.current) {
      forsta.current = false;
      tillSlutet();
      return;
    }
    if (nyaEfter.length === 0) return;
    if (vidSlutet.current || nyaEfter.some((m) => m.av === uid)) tillSlutet();
    else setNya((n) => n + nyaEfter.filter((m) => m.av !== uid).length);
  }, [alla, laddat, uid, tillSlutet]);
  return { uppe, nya, tillSlutet };
}

/**
 * "Till senaste" över skrivfältet, när man läst bakåt (0.106.0, #386 skiva 4). Visar antalet nya sedan man lämnade slutet, och att
 * agenten arbetar: den som läser bakåt ska se att ett svar är på väg utan att ryckas ned till det.
 * @param {{ lage: ReturnType<typeof useLasposition>, arbetar: null | "tanker" | "skriver", texter: Required<Meddelandetexter> }} props
 */
function TillSenaste({ lage, arbetar, texter: t }) {
  if (!lage.uppe) return null;
  const antal = lage.nya > 0 ? t.nyaMeddelanden.replace("{n}", String(lage.nya)) : "";
  const agent = arbetar === "tanker" ? t.agentTanker : arbetar === "skriver" ? t.agentSkriver : "";
  return (
    <button
      type="button"
      data-till-senaste={lage.nya}
      data-agent-arbetar={arbetar ?? undefined}
      aria-label={[t.tillSenaste, antal, agent].filter(Boolean).join(", ")}
      onClick={lage.tillSlutet}
      className="absolute right-3 bottom-2 z-10 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-meta font-medium text-ink shadow-md transition-colors duration-(--duration-fast) ease-standard hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {arbetar ? (
        <span aria-hidden="true" className="inline-flex text-accent motion-safe:animate-pulse">
          <AgentIkon size={14} />
        </span>
      ) : null}
      <span aria-hidden="true">{antal || t.tillSenaste}</span>
      <ChevronNedIkon size={14} />
    </button>
  );
}

/** Agentens läge som ett ord för "Till senaste", eller `null` när den inte arbetar. @param {ReturnType<typeof useAgentstatusdok>} lage */
function arbetsord(lage) {
  const v = agentstatus(lage.dok, Date.now());
  return v && !("fel" in v) ? v.lage : null;
}

/**
 * Loggens meddelanden: det senaste urvalet (`live`) plus allt som redan setts, och "Visa äldre" (chattens nattskiva).
 *
 * ⛔ DET SOM SETTS STANNAR. Prenumerationen ger de senaste `sida` meddelandena, och när ett nytt kommer faller det äldsta ur urvalet.
 * Hade loggen ritat bara urvalet hade en sida som hämtats bakåt fått ett hål mot urvalet så snart någon skrev. Meddelanden ändras
 * och raderas aldrig (regeln), så att samla det som setts är aldrig fel.
 *
 * ⛔ RULLNINGEN STÅR KVAR NÄR EN SIDA LÄGGS IN ÖVERST. Den som läser bakåt ska se samma meddelande efter klicket, inte hamna högst
 * upp i en sida hen aldrig bad om.
 *
 * @param {{ kalla: ReturnType<typeof import("../data/samtalskalla.js").createSamtalskalla>, sid: string, trad?: string, live: ReadonlyArray<import("../lib/samtal.js").Meddelande & { id: string }> | null, logg: { current: HTMLElement | null } }} p
 */
function useHistorik({ kalla, sid, trad, live, logg }) {
  const [sedda, setSedda] = useState(/** @type {Map<string, import("../lib/samtal.js").Meddelande & { id: string }>} */ (new Map()));
  const [lage, setLage] = useState(/** @type {{ laddar: boolean, fel: Error | null, bladdrat: boolean, fler: boolean | null }} */ ({ laddar: false, fel: null, bladdrat: false, fler: null }));
  const fore = useRef(/** @type {{ hojd: number, topp: number } | null} */ (null));
  useEffect(() => {
    if (!live) return;
    setSedda((m) => {
      const ny = new Map(m);
      for (const r of live) ny.set(r.id, r);
      return ny;
    });
  }, [live]);
  // ⛔ Det senaste urvalet slås in direkt, i samma rendering, och inte först när effekten ovan sparat det: annars hade varje nytt
  // meddelande ritats en rendering senare, och allt som läser loggen (trådmärkena, citaten) väntat ett varv till.
  const alla = useMemo(() => {
    const m = new Map(sedda);
    for (const r of live ?? []) m.set(r.id, r);
    return [...m.values()].sort((a, b) => a.tid - b.tid || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }, [sedda, live]);
  // Innan någon bläddrat: en full första sida betyder att det kan finnas mer. Efter: det senaste svaret avgör.
  const kanFinnasAldre = lage.bladdrat ? lage.fler === true : Boolean(live && live.length >= kalla.sida);
  useLayoutEffect(() => {
    const f = fore.current;
    const el = logg.current;
    if (!f || !el) return;
    fore.current = null;
    el.scrollTop = el.scrollHeight - f.hojd + f.topp;
  }, [alla, logg]);
  const hamta = async () => {
    if (lage.laddar || alla.length === 0) return;
    setLage((l) => ({ ...l, laddar: true, fel: null }));
    try {
      const svar = await kalla.aldreMeddelanden(sid, { tid: alla[0].tid, kanda: alla.map((m) => m.id), ...(trad === undefined ? {} : { trad }) });
      const el = logg.current;
      if (el) fore.current = { hojd: el.scrollHeight, topp: el.scrollTop };
      setSedda((m) => {
        const ny = new Map(m);
        for (const r of svar.rader) ny.set(r.id, r);
        return ny;
      });
      setLage({ laddar: false, fel: null, bladdrat: true, fler: svar.fler });
    } catch (e) {
      setLage((l) => ({ ...l, laddar: false, fel: e instanceof Error ? e : new Error(String(e)) }));
    }
  };
  return { alla, kanFinnasAldre, laddar: lage.laddar, fel: lage.fel, slut: lage.bladdrat && lage.fler === false, hamta };
}

/**
 * "Visa äldre" överst i loggen, och vad som hände (chattens nattskiva). ⛔ Varje utfall står utskrivet: hämtar, fel (med knappen kvar
 * för ett nytt försök) och "Inga äldre meddelanden" när början är nådd. En knapp som försvann utan ett ord hade inte sagt om
 * historiken tog slut eller om hämtningen föll (regel 5).
 *
 * @param {{ historik: ReturnType<typeof useHistorik>, texter: Required<Meddelandetexter> }} props
 */
function VisaAldre({ historik, texter: t }) {
  if (historik.slut) {
    return (
      <p data-aldre-slut="" className="m-0 py-2 text-center text-liten text-ink-muted">
        {t.ingaAldre}
      </p>
    );
  }
  if (!historik.kanFinnasAldre) return null;
  return (
    <div className="flex flex-col items-center gap-1 py-2">
      {historik.fel ? (
        <p data-aldre-fel="" role="alert" className="m-0 text-liten text-danger">
          {t.aldreFel}
        </p>
      ) : null}
      <button
        type="button"
        data-visa-aldre=""
        aria-busy={historik.laddar || undefined}
        disabled={historik.laddar}
        onClick={historik.hamta}
        className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-meta font-medium text-accent transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint disabled:cursor-default disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {historik.laddar ? t.hamtarAldre : t.visaAldre}
      </button>
    </div>
  );
}

/**
 * Reaktionerna i ett samtal eller en tråd: en lyssnare (eller en läsning), räknade per meddelande, och växlingen av den egna.
 *
 * ⛔ FEL SÄGS (regel 5): en läsning som föll och en växling som nekades blir var sin rad, aldrig en tyst knapp som inte gör något.
 *
 * @param {(ReturnType<typeof import("../data/samtalskalla.js").createSamtalskalla> & import("../data/samtalskalla.js").Reaktionsfunktioner) | null} kalla
 * @param {string} sid @param {string | undefined} trad @param {string} uid
 */
function useReaktioner(kalla, sid, trad, uid) {
  const [lage, setLage] = useState(/** @type {{ rader: any[], fler: boolean, fel: Error | null, skrivfel: Error | null }} */ ({ rader: [], fler: false, fel: null, skrivfel: null }));
  const lyssnar = useRef(false);
  const val = trad === undefined ? {} : { trad };
  const lasIn = async () => {
    if (!kalla) return;
    try {
      const svar = await kalla.lasReaktioner(sid, val);
      setLage((l) => ({ ...l, rader: svar.rader, fler: svar.fler, fel: null }));
    } catch (e) {
      setLage((l) => ({ ...l, fel: e instanceof Error ? e : new Error(String(e)) }));
    }
  };
  useEffect(() => {
    if (!kalla) return undefined;
    let levande = true;
    const stang = kalla.prenumereraReaktioner(
      sid,
      { onData: (svar) => levande && setLage((l) => ({ ...l, rader: svar.rader, fler: svar.fler, fel: null })), onError: (e) => levande && setLage((l) => ({ ...l, fel: e })) },
      val,
    );
    lyssnar.current = Boolean(stang);
    if (!stang) lasIn();
    return () => {
      levande = false;
      stang?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kalla, sid, trad]);
  const sammanfattning = useMemo(() => summeraReaktioner(lage.rader, uid), [lage.rader, uid]);
  /** @param {string} mid @param {(typeof REAKTIONSKODER)[number]} kod */
  const vaxla = async (mid, kod) => {
    if (!kalla) return;
    const har = lage.rader.some((r) => r.mid === mid && r.kod === kod && r.av === uid);
    try {
      if (har) await kalla.taBortReaktion(sid, { mid, kod, av: uid }, val);
      else await kalla.reagera(sid, { mid, kod, av: uid }, val);
      setLage((l) => ({ ...l, skrivfel: null }));
      if (!lyssnar.current) await lasIn();
    } catch (e) {
      setLage((l) => ({ ...l, skrivfel: e instanceof Error ? e : new Error(String(e)) }));
    }
  };
  return { pa: Boolean(kalla), sammanfattning, vaxla, fler: lage.fler, fel: lage.fel, skrivfel: lage.skrivfel };
}

/**
 * Raderna om reaktionerna som gäller hela loggen: läsningen föll, en växling nekades, eller taket nåddes.
 * @param {{ reakt: ReturnType<typeof useReaktioner>, texter: Required<Meddelandetexter> }} props
 */
function Reaktionslage({ reakt, texter: t }) {
  if (!reakt.pa) return null;
  return (
    <>
      {reakt.fel ? (
        <p data-reaktionsfel="lasa" role="alert" className="m-0 py-1 text-center text-liten text-danger">
          {t.reaktionerFel}
        </p>
      ) : null}
      {reakt.skrivfel ? (
        <p data-reaktionsfel="skriva" role="alert" className="m-0 py-1 text-center text-liten text-danger">
          {t.reaktionFel}
        </p>
      ) : null}
      {reakt.fler ? (
        <p data-reaktioner-fler="" role="status" className="m-0 py-1 text-center text-liten text-ink-muted">
          {t.reaktionerFler}
        </p>
      ) : null}
    </>
  );
}

/** @param {(typeof REAKTIONSKODER)[number]} kod @param {Required<Meddelandetexter>} t */
const reaktionsnamn = (kod, t) => t.reaktionsnamn?.[kod] ?? REAKTIONSVY[kod].namn.sv;

/**
 * En reaktions ikon. ⛔ Ovald: linje i textfärgen. Vald (den egna): accentfärgen, samma token som chatten och resten av ramverkets
 * valda lägen. Ingen hårdkodad färg.
 * @param {{ kod: (typeof REAKTIONSKODER)[number], vald: boolean, size: number }} props
 */
function Reaktionsikon({ kod, vald, size }) {
  const { Ikon } = REAKTIONSVY[kod];
  return (
    <span aria-hidden="true" data-reaktionsikon={kod} className={cx("inline-flex", vald ? "text-accent" : "text-ink")}>
      <Ikon size={size} />
    </span>
  );
}

/**
 * Reaktionerna under en bubbla: en knapp per kod med antalet. ⛔ En tryckning växlar den EGNA reaktionen, och knappen säger om den
 * är din (`aria-pressed`). Träffytan är 44 px utan att raden växer (negativa marginaler, samma grepp som trådens märke).
 *
 * @param {{ m: { id: string }, egen: boolean, reakt: ReturnType<typeof useReaktioner>, texter: Required<Meddelandetexter> }} props
 */
function Reaktionschips({ m, egen, reakt, texter: t }) {
  const lista = reakt.sammanfattning.get(m.id);
  if (!lista || lista.length === 0) return null;
  return (
    <div data-reaktioner={m.id} className={cx("mt-1 flex max-w-full flex-wrap gap-1", egen ? "justify-end" : "justify-start")}>
      {lista.map((r) => (
        <button
          key={r.kod}
          type="button"
          data-reaktion={r.kod}
          aria-pressed={r.egen}
          aria-label={`${reaktionsnamn(r.kod, t)}, ${r.antal}${r.egen ? `, ${t.duHarReagerat}` : ""}`}
          onClick={() => reakt.vaxla(m.id, r.kod)}
          className="group/chip -my-1.5 inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center focus-visible:outline-none"
        >
          <span
            aria-hidden="true"
            className={cx(
              "inline-flex h-7 items-center gap-1 rounded-full border px-2 text-meta tabular-nums transition-colors duration-(--duration-fast) ease-standard group-focus-visible/chip:outline-2 group-focus-visible/chip:outline-offset-1 group-focus-visible/chip:outline-accent",
              r.egen ? "border-accent bg-accent-faint text-ink" : "border-line bg-surface text-ink-secondary group-hover/chip:bg-hover",
            )}
          >
            <Reaktionsikon kod={r.kod} vald={r.egen} size={16} />
            <span>{r.antal}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/*
 * ══ ⛔ OMRÖSTNINGEN I CHATTEN (cllp/lifehub.app#438 skiva 1) ═════════════════════════════════════════════════════════════════
 *
 * CP 2026-10-23: "som Facebooks omröstning, inte Apples", och han vill SE kortet innan resten bestäms. Kortet: frågan i fetstil, varje
 * alternativ en rad över hela bredden med en stapel för andelen, texten, upp till tre ansikten och "+N", och antalet. Det egna valet är
 * markerat. En tryckning röstar, samma rad igen tar tillbaka rösten, en annan rad byter den. Sista raden "Lägg till alternativ" öppnar
 * ett fält i kortet. Under alternativen: hur många som röstat. Modellen och skälen står i `lib/samtal.js`.
 *
 * ⛔ ETT ELEMENT PER RAD FÖR ANSIKTENA, INGET OMSLAG PER ANSIKTE. Ringen och överlappet sätts på behållarens barn (`[&>*]:`), så att
 * kortet inte växer med ett element per röstande utöver `OpsIdentity` själv. Kortet ritas bara för ett meddelande som ÄR en omröstning:
 * ett vanligt meddelande får inte ett enda element till (`check:skalyta` 47 (6), taket 26 per meddelande).
 */

/** Så många ansikten per alternativ, sedan "+N". CP 2026-10-22: "som ansikten och +N när de inte får plats". */
const OMROSTNING_ANSIKTEN = 3;

/**
 * Omröstningarna i ett samtal: de egna skrivningarna, och vad varje kort behöver för att läsa sin egen omröstning (`useOmrostning`).
 *
 * ⛔ (cllp/lifehub.app#742, skiva 2) HÄR LÄSES INGENTING. Skiva 1 läste alternativ och röster för hela samtalet här, de 500 senaste per samling,
 * och de äldsta omröstningarna föll ur fönstret. Nu läser varje kort sin omröstning. ⛔ FEL SÄGS (regel 5): en skrivning som nekades blir en rad
 * i loggen, en läsning som föll en rad i kortet. ⛔ RÖSTEN VÄLJER SJÄLV RÄTT SKRIVNING ur det kortet läst: första rösten skapas, en annan rad
 * byter, samma rad tar tillbaka. Ingen läsning före.
 *
 * @param {(ReturnType<typeof import("../data/samtalskalla.js").createSamtalskalla> & import("../data/samtalskalla.js").Omrostningsfunktioner) | null} kalla
 * @param {string} sid @param {string} uid
 */
function useOmrostningar(kalla, sid, uid) {
  const [skrivfel, setSkrivfel] = useState(/** @type {Error | null} */ (null));
  // Räknas upp efter varje egen skrivning. Ett kort vars källa inte kan prenumerera läser om då; ett som lyssnar bryr sig inte.
  const [skrivningar, setSkrivningar] = useState(0);
  const somFel = (/** @type {unknown} */ e) => (e instanceof Error ? e : new Error(String(e)));
  const efterSkrivning = () => {
    setSkrivfel(null);
    setSkrivningar((n) => n + 1);
  };
  // ⛔ EN RÖST I TAGET PER OMRÖSTNING (granskningen av PR 566). Ett andra tryck innan svaret kommit läste ett gammalt eget val, så
  // "samma rad igen tar tillbaka rösten" blev en ny röst på samma rad. Trycket under väntan släpps.
  const rostarNu = useRef(/** @type {Set<string>} */ (new Set()));
  /**
   * @param {string} mid @param {string} valId
   * @param {string | null} eget Det egna valet i omröstningen, som kortet läst det.
   */
  const rosta = async (mid, valId, eget) => {
    if (!kalla || rostarNu.current.has(mid)) return;
    rostarNu.current.add(mid);
    try {
      if (eget === valId) await kalla.taBortRost(sid, { mid, av: uid });
      else if (eget) await kalla.andraRost(sid, { mid, val: valId, av: uid });
      else await kalla.rosta(sid, { mid, val: valId, av: uid });
      efterSkrivning();
    } catch (e) {
      setSkrivfel(somFel(e));
    } finally {
      rostarNu.current.delete(mid);
    }
  };
  /**
   * Lägger till ett alternativ. Kastar till kortet, som säger felet vid fältet.
   * @param {string} mid @param {string} text
   * @param {ReadonlyArray<string>} befintliga Omröstningens alternativ, som kortet läst dem. Hela listan: kortet erbjuder inget fält när den inte är hel.
   */
  const laggTill = async (mid, text, befintliga) => {
    if (!kalla) return;
    await kalla.laggTillAlternativ(sid, { mid, text, av: uid, befintliga });
    efterSkrivning();
  };
  /** @param {{ fraga: string, alternativ: ReadonlyArray<string> }} d @returns {Promise<any>} Meddelandet. */
  const skapa = async ({ fraga, alternativ }) => {
    if (!kalla) return null;
    const ny = await kalla.skickaOmrostning(sid, { fraga, alternativ, av: uid });
    efterSkrivning();
    return ny;
  };
  return { pa: Boolean(kalla), kalla, sid, uid, rosta, laggTill, skapa, skrivfel, skrivningar };
}

/**
 * En omröstning, läst för sig (cllp/lifehub.app#742): alternativen och rösterna med `mid`, var sin lyssnare, och räknad.
 *
 * ⛔ `laddad` SKILJER "INGA ALTERNATIV" FRÅN "INTE LÄST ÄN". Före första svaret säger kortet ingenting om alternativen; "Inga alternativ än."
 * står bara när läsningen svarat tomt. ⛔ `fler` är per omröstning och står i kortet, inte överst i loggen långt från det.
 *
 * @param {ReturnType<typeof useOmrostningar>} omr @param {string} mid
 */
function useOmrostning(omr, mid) {
  const { kalla, sid, uid, skrivningar } = omr;
  const tomt = /** @type {{ rader: any[], fler: boolean, fel: Error | null, laddad: boolean }} */ ({ rader: [], fler: false, fel: null, laddad: false });
  const [val, setVal] = useState(tomt);
  const [roster, setRoster] = useState(tomt);
  const lyssnar = useRef(false);
  const levande = useRef(true);
  const somFel = (/** @type {unknown} */ e) => (e instanceof Error ? e : new Error(String(e)));
  const lasIn = async () => {
    if (!kalla) return;
    try {
      const [v, r] = await Promise.all([kalla.lasOmrostningsval(sid, mid), kalla.lasOmrostningsroster(sid, mid)]);
      if (!levande.current) return;
      setVal({ rader: v.rader, fler: v.fler, fel: null, laddad: true });
      setRoster({ rader: r.rader, fler: r.fler, fel: null, laddad: true });
    } catch (e) {
      if (levande.current) setVal((l) => ({ ...l, fel: somFel(e) }));
    }
  };
  useEffect(() => {
    if (!kalla) return undefined;
    levande.current = true;
    const pa = { v: true };
    const stangVal = kalla.prenumereraOmrostningsval(sid, mid, { onData: (s) => pa.v && setVal({ rader: s.rader, fler: s.fler, fel: null, laddad: true }), onError: (e) => pa.v && setVal((l) => ({ ...l, fel: e })) });
    const stangRoster = kalla.prenumereraOmrostningsroster(sid, mid, { onData: (s) => pa.v && setRoster({ rader: s.rader, fler: s.fler, fel: null, laddad: true }), onError: (e) => pa.v && setRoster((l) => ({ ...l, fel: e })) });
    lyssnar.current = Boolean(stangVal && stangRoster);
    if (!lyssnar.current) lasIn();
    return () => {
      pa.v = false;
      levande.current = false;
      stangVal?.();
      stangRoster?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kalla, sid, mid]);
  // En källa som inte kan prenumerera läser om efter varje egen skrivning i samtalet.
  useEffect(() => {
    if (skrivningar > 0 && kalla && !lyssnar.current) lasIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skrivningar]);
  const summa = useMemo(() => summeraOmrostning(val.rader.filter((v) => v?.mid === mid), roster.rader.filter((r) => r?.mid === mid), uid), [val.rader, roster.rader, mid, uid]);
  return { summa, laddad: val.laddad, fler: val.fler || roster.fler, fel: val.fel ?? roster.fel, valFler: val.fler };
}

/**
 * Raden om omröstningarna som gäller hela loggen: en röst som nekades. (#742) Läsfel och tak står i kortet de gäller.
 * @param {{ omr: ReturnType<typeof useOmrostningar>, texter: Required<Meddelandetexter> }} props
 */
function Omrostningslage({ omr, texter: t }) {
  if (!omr.pa || !omr.skrivfel) return null;
  return (
    <p data-omrostningsfel="skriva" role="alert" className="m-0 py-1 text-center text-liten text-danger">
      {t.omrostningFel}
    </p>
  );
}

/** @param {number} n @param {Required<Meddelandetexter>} t */
const rostantal = (n, t) => (n === 1 ? t.omrostningRost : t.omrostningRoster).replace("{n}", String(n));

/**
 * En text för formuläret eller kortet: trimmad, och felet med användarens ord, eller `null` när den går att skicka.
 * ⛔ SAMMA TAK SOM MODELLEN (`MAX_FRAGA`, `MAX_ALTERNATIVTEXT`), och ingen tyst kapning: fältet har inget `maxLength`, och för lång
 * text säger det i stället för att skäras av (regel 5, samma skäl som skrivfältet).
 * @param {string} text @param {number} max @param {Required<Meddelandetexter>} t
 */
const omrostningstextFel = (text, max, t) => (text.trim().length > max ? t.omrostningForLang.replace("{max}", String(max)) : null);

/**
 * Kortet i flödet (cllp/lifehub.app#438 skiva 1). Frågan är meddelandets text.
 *
 * ⛔ VARJE ALTERNATIV ÄR EN KNAPP med `aria-pressed` och ett namn som säger texten, antalet och om det är ditt val ("Fredag, 3 röster,
 * du har röstat"). Knappen är minst 44 px hög. Stapeln, ansiktena och siffran är `aria-hidden`: namnet säger redan samma sak.
 *
 * @param {{ m: { id: string, text: string }, omr: ReturnType<typeof useOmrostningar>, namnFor: (uid: string) => string, bildFor: (uid: string) => string | undefined, texter: Required<Meddelandetexter> }} props
 */
function Omrostningskort({ m, omr, namnFor, bildFor, texter: t }) {
  const rubrikId = useId();
  const faltId = useId();
  const felId = useId();
  const las = useOmrostning(omr, m.id);
  const s = las.summa;
  const [laggerTill, setLaggerTill] = useState(false);
  const [nytt, setNytt] = useState("");
  const [fel, setFel] = useState(/** @type {string | null} */ (null));
  const [arbetar, setArbetar] = useState(false);
  // ⛔ (#742) Bara när listan är läst och hel: taket och dubbletten prövas mot den, och en ofullständig lista är fel underlag.
  const kanLaggaTill = las.laddad && !las.valFler && s.alternativ.length < MAX_ALTERNATIV;
  const langdFel = omrostningstextFel(nytt, MAX_ALTERNATIVTEXT, t);
  const stangFalt = () => {
    setLaggerTill(false);
    setNytt("");
    setFel(null);
  };
  const spara = async () => {
    const text = nytt.trim();
    if (!text || langdFel || arbetar) return;
    if (s.alternativ.some((a) => jamforbar(a.text) === jamforbar(text))) {
      setFel(t.alternativFinnsRedan);
      return;
    }
    setArbetar(true);
    try {
      await omr.laggTill(m.id, text, s.alternativ.map((a) => a.text));
      stangFalt();
    } catch {
      setFel(t.alternativFel);
    } finally {
      setArbetar(false);
    }
  };
  return (
    <div data-omrostning={m.id} className="flex w-72 max-w-full flex-col gap-2 rounded-2xl bg-hover p-3 text-ink">
      {/* Frågan är kortets rubrik: en h3, så att den som läser med skärmläsare hoppar mellan omröstningarna som mellan rubriker. */}
      <h3 id={rubrikId} data-omrostning-fraga="" className="m-0 text-etikett font-semibold wrap-anywhere">
        {m.text}
      </h3>
      <div role="group" aria-labelledby={rubrikId} className="flex flex-col gap-1.5">
        {las.laddad && s.alternativ.length === 0 ? <p data-omrostning-tom="" className="m-0 text-liten text-ink-muted">{t.omrostningUtanAlternativ}</p> : null}
        {s.alternativ.map((a) => (
          <button
            key={a.id}
            type="button"
            data-omrostningsval={a.id}
            aria-pressed={a.egen}
            aria-label={`${a.text}, ${rostantal(a.antal, t)}${a.egen ? `, ${t.duHarRostat}` : ""}`}
            onClick={() => omr.rosta(m.id, a.id, s.egetVal)}
            className={cx(
              "relative flex min-h-11 w-full cursor-pointer items-center gap-2 overflow-hidden rounded-xl border bg-surface px-3 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              a.egen ? "border-accent" : "border-transparent hover:bg-canvas",
            )}
          >
            {/* Stapeln: andelen av dem som röstat, som Facebooks. En röst per person, så staplarna blir tillsammans hela. Bredden är ett mått, ingen färg (closed-api). */}
            <span aria-hidden="true" data-stapel="" className="absolute inset-y-0 left-0 bg-accent-faint" style={{ width: `${s.antalRostande ? Math.round((a.antal / s.antalRostande) * 100) : 0}%` }} />
            <span aria-hidden="true" className={cx("relative inline-flex size-4 shrink-0 items-center justify-center rounded-full border", a.egen ? "border-accent bg-accent text-accent-contrast" : "border-line-strong")}>
              {a.egen ? <BockIkon size={12} /> : null}
            </span>
            <span aria-hidden="true" className="relative min-w-0 flex-1 text-etikett wrap-anywhere">{a.text}</span>
            {a.roster.length ? (
              <span aria-hidden="true" data-ansikten="" className="relative flex shrink-0 items-center -space-x-1.5 [&>*]:rounded-full [&>*]:ring-2 [&>*]:ring-surface">
                {a.roster.slice(0, OMROSTNING_ANSIKTEN).map((u) => (
                  <OpsIdentity key={u} name={namnFor(u)} seed={u} imageUrl={bildFor(u)} size="xs" rund />
                ))}
                {a.roster.length > OMROSTNING_ANSIKTEN ? <span data-fler-ansikten="" className="inline-flex size-5 items-center justify-center bg-sunken text-mikro font-medium text-ink-secondary">+{a.roster.length - OMROSTNING_ANSIKTEN}</span> : null}
              </span>
            ) : null}
            <span aria-hidden="true" data-antal="" className="relative shrink-0 text-meta tabular-nums text-ink-secondary">{a.antal}</span>
          </button>
        ))}
        {kanLaggaTill && !laggerTill ? (
          <button
            type="button"
            data-lagg-till-alternativ=""
            onClick={() => setLaggerTill(true)}
            className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl px-3 text-left text-etikett text-accent hover:bg-accent-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <PlusIkon size={16} />
            {t.laggTillAlternativ}
          </button>
        ) : null}
        {/* ⛔ FÄLTET TAR RADEN, KNAPPARNA STÅR UNDER (cllp/lifehub.app#742, QA 2026-11-10 v1.0.1160). Fältet, "Lägg till alternativ" och krysset stod på en
            rad i kortets 264 px, och fältet fick det som blev över: 52 px vid 390 px, mot de cirka 178 px platshållaren behöver. Nu bryts formuläret, fältet
            får hela raden (`basis-full`) och knapparna nästa rad. Mätt i `check:skalyta` avsnitt 64. */}
        {laggerTill ? (
          <form
            data-nytt-alternativ=""
            className="flex flex-wrap items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              spara();
            }}
          >
            <label htmlFor={faltId} className="sr-only">{t.nyttAlternativ}</label>
            <input
              id={faltId}
              value={nytt}
              autoFocus
              aria-invalid={Boolean(fel || langdFel) || undefined}
              aria-describedby={fel || langdFel ? felId : undefined}
              placeholder={t.nyttAlternativ}
              onChange={(e) => {
                setNytt(e.target.value);
                setFel(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  stangFalt();
                }
              }}
              className="min-h-11 min-w-0 basis-full rounded-xl border border-line bg-surface px-3 text-etikett text-ink outline-none focus-visible:border-accent"
            />
            <button type="submit" disabled={!nytt.trim() || Boolean(langdFel) || arbetar} aria-busy={arbetar || undefined} className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-xl bg-accent px-3 text-meta font-medium text-accent-contrast hover:bg-accent-hover disabled:cursor-default disabled:opacity-60">
              {t.laggTillAlternativ}
            </button>
            <button type="button" onClick={stangFalt} aria-label={t.avbryt} className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-ink-secondary hover:bg-canvas">
              <KryssIkon size={16} />
            </button>
          </form>
        ) : null}
        {laggerTill && (fel || langdFel) ? (
          <p id={felId} role="alert" data-alternativfel="" className="m-0 text-liten text-danger">{fel ?? langdFel}</p>
        ) : null}
      </div>
      <p data-omrostning-antal="" className="m-0 text-liten text-ink-muted">{t.omrostningRostat.replace("{n}", String(s.antalRostande))}</p>
      {/* ⛔ (#742) Läsfelet och taket står i kortet de gäller, inte överst i loggen. Tomt sägs, det utelämnas inte (regel 5). */}
      {las.fel ? (
        <p data-omrostningsfel="lasa" role="alert" className="m-0 text-liten text-danger">
          {t.omrostningarFel}
        </p>
      ) : null}
      {las.fler ? (
        <p data-omrostning-fler="" role="status" className="m-0 text-liten text-ink-muted">
          {t.omrostningarFler}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Formuläret bakom pluset (cllp/lifehub.app#438 skiva 1): frågan, alternativen (två rader att börja med, upp till
 * `MAX_ALTERNATIV_VID_START`), Lägg till alternativ, Avbryt och Skicka.
 *
 * ⛔ TOMMA RADER RÄKNAS INTE, och felet sägs innan något skickas: en fråga, minst två alternativ, inga två lika, inget över taket.
 * Det som källan ändå nekar (en regel, ett nätfel) står som en rad i formuläret, och texten ligger kvar så att inget skrivet försvinner.
 *
 * @param {{ onSkicka: (d: { fraga: string, alternativ: string[] }) => Promise<void>, onAvbryt: () => void, texter: Required<Meddelandetexter> }} props
 */
function Omrostningsformular({ onSkicka, onAvbryt, texter: t }) {
  const rubrikId = useId();
  const fragaId = useId();
  const felId = useId();
  const [fraga, setFraga] = useState("");
  const [alternativ, setAlternativ] = useState(["", ""]);
  const [fel, setFel] = useState(/** @type {string | null} */ (null));
  const [iVag, setIVag] = useState(false);
  const formular = useRef(/** @type {HTMLFormElement | null} */ (null));
  const skicka = async () => {
    if (iVag) return;
    const f = fraga.trim();
    const alt = alternativ.map((a) => a.trim()).filter(Boolean);
    const lika = new Set(alt.map(jamforbar)).size !== alt.length;
    const ut = !f
      ? t.omrostningBehoverFraga
      : omrostningstextFel(f, MAX_FRAGA, t) ?? (alt.length < MIN_ALTERNATIV_VID_START ? t.omrostningBehoverTva : lika ? t.alternativFinns : alt.map((a) => omrostningstextFel(a, MAX_ALTERNATIVTEXT, t)).find(Boolean) ?? null);
    if (ut) {
      setFel(ut);
      return;
    }
    setIVag(true);
    setFel(null);
    try {
      await onSkicka({ fraga: f, alternativ: alt });
    } catch {
      setFel(t.omrostningSkickaFel);
      setIVag(false);
    }
  };
  const faltKlass = "min-h-11 w-full min-w-0 rounded-xl border border-line bg-canvas px-3 text-etikett text-ink outline-none focus-visible:border-accent";
  return (
    <form
      ref={formular}
      data-omrostningsformular=""
      aria-labelledby={rubrikId}
      aria-busy={iVag || undefined}
      onSubmit={(e) => {
        e.preventDefault();
        skicka();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onAvbryt();
        }
      }}
      className="mx-3 mb-2 flex shrink-0 flex-col gap-2 rounded-card bg-hover p-3"
    >
      <h3 id={rubrikId} className="m-0 flex items-center gap-2 text-etikett font-semibold text-ink">
        <span aria-hidden="true" className="inline-flex text-ink-secondary"><OmrostningIkon size={16} /></span>
        {t.nyOmrostning}
      </h3>
      <label htmlFor={fragaId} className="sr-only">{t.omrostningFraga}</label>
      <input id={fragaId} value={fraga} autoFocus placeholder={t.omrostningFragaPlats} onChange={(e) => setFraga(e.target.value)} className={faltKlass} />
      {/* ⛔ Raderna tas aldrig bort i formuläret, så platsen är ett stabilt id. */}
      {alternativ.map((a, i) => (
        <input
          key={i}
          data-alternativfalt={i}
          value={a}
          aria-label={t.omrostningAlternativ.replace("{n}", String(i + 1))}
          placeholder={t.omrostningAlternativ.replace("{n}", String(i + 1))}
          onChange={(e) => setAlternativ((l) => l.map((x, j) => (j === i ? e.target.value : x)))}
          className={faltKlass}
        />
      ))}
      {alternativ.length < MAX_ALTERNATIV_VID_START ? (
        <button
          type="button"
          data-formular-lagg-till=""
          onClick={() => {
            setAlternativ((l) => [...l, ""]);
            requestAnimationFrame(() => /** @type {HTMLInputElement | null} */ (formular.current?.querySelector(`[data-alternativfalt="${alternativ.length}"]`) ?? null)?.focus());
          }}
          className="flex min-h-11 cursor-pointer items-center gap-2 self-start rounded-xl px-3 text-etikett text-accent hover:bg-accent-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <PlusIkon size={16} />
          {t.laggTillAlternativ}
        </button>
      ) : null}
      {fel ? (
        <p id={felId} role="alert" data-omrostningsformular-fel="" className="m-0 text-liten text-danger">{fel}</p>
      ) : null}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onAvbryt} className="inline-flex min-h-11 cursor-pointer items-center rounded-xl px-3 text-meta text-ink-secondary hover:bg-canvas">
          {t.avbryt}
        </button>
        <button type="submit" disabled={iVag} aria-busy={iVag || undefined} className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl bg-accent px-4 text-meta font-medium text-accent-contrast hover:bg-accent-hover disabled:cursor-default disabled:opacity-70">
          {iVag ? <OpsSpinner size="sm" tone="current" decorative /> : null}
          {t.skicka}
        </button>
      </div>
    </form>
  );
}

/** Tailwinds `md`, samma tal som `OpsPanel`: under 48rem är skärmen smal. */
const SMAL_SKARM = "(max-width: 47.99rem)";

/**
 * Smal eller bred skärm, för meddelandenas åtgärder (0.106.0, #386 skiva 6). ⛔ EN LYSSNARE PER LISTA, inte per meddelande.
 *
 * ⛔ MÄTT, REGEL 13: med Mer-knappen OCH de lösa knapparna i DOM:en för varje meddelande (CSS väljer vilka som syns) tog ett samtal
 * nästan dubbelt så lång tid att rita i jsdom. Med bredden känd ritas bara den ena uppsättningen, och telefonen får färre element per
 * meddelande än i 0.105.0 (mätt i check-skalyta 47 (6)). `null` när `matchMedia` saknas (jsdom, serverrendering): då ritas båda och
 * CSS väljer, som förut.
 * @returns {"smal" | "bred" | null}
 */
function useBredd() {
  /** @returns {"smal" | "bred" | null} */
  const las = () => (typeof window === "undefined" || typeof window.matchMedia !== "function" ? null : window.matchMedia(SMAL_SKARM).matches ? "smal" : "bred");
  const [bredd, setBredd] = useState(las);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const fraga = window.matchMedia(SMAL_SKARM);
    const lyssna = () => setBredd(fraga.matches ? "smal" : "bred");
    lyssna();
    if (typeof fraga.addEventListener === "function") {
      fraga.addEventListener("change", lyssna);
      return () => fraga.removeEventListener("change", lyssna);
    }
    fraga.addListener?.(lyssna);
    return () => fraga.removeListener?.(lyssna);
  }, []);
  return bredd;
}

/** En pekskärm utan mus: menyn öppnas med ett långt tryck och ⋮ ritas inte (0.190.0). */
const PEKSKARM = "(pointer: coarse)";

/** Är pekaren ett finger? `false` där webbläsaren inte kan svara (jsdom utan `matchMedia`). @returns {boolean} */
function usePekskarm() {
  const las = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(PEKSKARM).matches;
  const [pa, setPa] = useState(las);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const fraga = window.matchMedia(PEKSKARM);
    const lyssna = () => setPa(fraga.matches);
    lyssna();
    if (typeof fraga.addEventListener === "function") {
      fraga.addEventListener("change", lyssna);
      return () => fraga.removeEventListener("change", lyssna);
    }
    fraga.addListener?.(lyssna);
    return () => fraga.removeListener?.(lyssna);
  }, []);
  return pa;
}

/**
 * Bubblan som tar långtrycket (0.190.0). Ett finger som håller still i `LANGTRYCK_MS` (500 ms) öppnar meddelandets meny vid punkten, ett finger som rör sig
 * mer än några pixlar avbryter (det rullar), och `contextmenu` (högerklick, Android mitt i ett tryck) öppnar samma meny. Logiken är `useLangtryck`, samma som
 * Bibliotekets rader: en mus startar ingen timer (`utanMus`), den har ⋮ och högerklick.
 *
 * @param {{ pa: boolean, onMeny: (punkt: { x: number, y: number }) => void, children: import("react").ReactNode }} props
 */
function Langtryckbubbla({ pa, onMeny, children }) {
  const punkt = useRef({ x: 0, y: 0 });
  const { handelser, aktiv } = useLangtryck({ onLangtryck: pa ? () => onMeny(punkt.current) : null, hogerklick: true, utanMus: true });
  if (!aktiv || !isValidElement(children)) return <>{children}</>;
  /** @param {{ clientX: number, clientY: number }} e */
  const spara = (e) => {
    punkt.current = { x: e.clientX, y: e.clientY };
  };
  // ⛔ HÄNDELSERNA SÄTTS PÅ BUBBLAN SJÄLV, INTE PÅ ETT OMSLAG (granskningen av PR 524): ett omslag per meddelande var ett element till per rad, och skalytans tak räknar dem.
  const barn = /** @type {import("react").ReactElement<any>} */ (children);
  return cloneElement(barn, { ...handelser, "data-langtryck-bubbla": "", onPointerDownCapture: spara, onContextMenuCapture: spara, className: cx(barn.props.className, LANGTRYCK_KLASS) });
}

/**
 * Appens adress till ett meddelande som den skrivs till urklipp: en relativ adress (`/chatt?m=1`) görs absolut mot sidan, så att den fungerar när den klistras in någon annanstans.
 * @param {string} href
 */
function absolutAdress(href) {
  try {
    return typeof location === "undefined" ? href : new URL(href, location.href).href;
  } catch {
    return href;
  }
}

/**
 * Raden under bubblan: tiden, vyns innehåll (trådens märke), och meddelandets åtgärder.
 *
 * ⛔ EN MER-KNAPP PER MEDDELANDE PÅ TELEFON (0.106.0, #386 skiva 6). Under 768 px stod Reagera, Fäst och Svara med citat som tre lösa
 * ikoner under varje bubbla, och "Svara i tråd" som en fjärde rad text, eftersom en telefon inte har hover. En lång chatt blev en
 * rad knappar per meddelande, och de 44 px breda ytorna låg tätt nog att träffa fel. På telefon står nu en ⋮ (`OpsAtgardsblad`, samma
 * meny som Biblioteket) med reaktionerna överst och sedan alla åtgärder, plus Kopiera, som inte fanns alls: på en telefon går en
 * bubblas text inte att markera utan att sidan förstorar. På dator är raden oförändrad: ikonerna syns vid hover och fokus.
 * Det som är INNEHÅLL står kvar på båda: trådens märke "3 svar" och nålen på ett fäst meddelande.
 *
 * ⛔ TIDEN STÅR INTE HÄR LÄNGRE (0.190.0): den står på namnraden ovanför bubblan, se `Meddelanderader`. ⋮ ritas där en meny behövs (`menyPa`: smal skärm eller
 * pekskärm) och öppnas också utifrån, av ett långtryck på bubblan (`oppnadVid`).
 *
 * @param {{ m: import("../lib/samtal.js").Meddelande & { id: string }, egen: boolean, bredd: "smal" | "bred" | null, menyPa: boolean, pekskarm: boolean, oppnadVid: { x: number, y: number } | null,
 *   onOppnadVid: (oppen: boolean) => void, extra: import("react").ReactNode,
 *   mer: import("./OpsAtgardsblad.jsx").Atgard[], namn: string, reakt?: ReturnType<typeof useReaktioner>,
 *   fasta?: { pa?: boolean, ids: Set<string>, vaxla: (mid: string) => void } | null,
 *   citat?: { pa: boolean, onCitera: (m: import("../lib/samtal.js").Meddelande & { id: string }) => void } | null,
 *   lank?: string | null, visaKopior?: boolean,
 *   texter: Required<Meddelandetexter> }} props
 */
function Meddelandemeta({ m, egen, bredd, menyPa, pekskarm, oppnadVid, onOppnadVid, extra, mer, namn, reakt, fasta, citat, lank = null, visaKopior = false, texter: t }) {
  const losa = bredd !== "smal";
  const [kopia, setKopia] = useState(/** @type {null | "ok" | "fel" | "lank" | "lankfel"} */ (null));
  useEffect(() => {
    if (!kopia) return undefined;
    const tid = setTimeout(() => setKopia(null), 2500);
    return () => clearTimeout(tid);
  }, [kopia]);
  const fast = Boolean(fasta?.ids.has(m.id));
  const text = typeof m.text === "string" ? m.text.trim() : "";
  /**
   * ⛔ Urklippet skrivs inne i klickhanteraren (webbläsaren kräver ett användartryck) och ett nekat urklipp sägs (regel 5): utan raden hade knappen sett ut att fungera.
   * @param {string} innehall @param {"ok" | "lank"} lyckat @param {"fel" | "lankfel"} miss
   */
  const tillUrklipp = (innehall, lyckat, miss) => {
    try {
      const urklipp = typeof navigator === "undefined" ? undefined : navigator.clipboard;
      if (!urklipp?.writeText) {
        setKopia(miss);
        return;
      }
      Promise.resolve(urklipp.writeText(innehall)).then(
        () => setKopia(lyckat),
        () => setKopia(miss),
      );
    } catch {
      setKopia(miss);
    }
  };
  /** @type {import("./OpsAtgardsblad.jsx").Atgard[]} */
  const kopior = [];
  if (text) kopior.push({ id: "kopiera", etikett: t.kopiera, ikon: <KopieraIkon size={16} />, onValj: () => tillUrklipp(text, "ok", "fel") });
  if (typeof lank === "string" && lank.trim() !== "") {
    const adress = absolutAdress(lank.trim());
    kopior.push({ id: "kopiera-lank", etikett: t.kopieraLank, ikon: <KopieraIkon size={16} />, onValj: () => tillUrklipp(adress, "lank", "lankfel") });
  }
  // ⛔ (lifehub.app#712) På dator står Reagera, Fäst, Svara med citat och Svara i tråd som egna knappar vid hovring; menyn har där bara det som saknas som knapp: Kopiera och Kopiera länk.
  // QA 2026-11-09: som medlem visade hovringen bara de tre, och som gäst fanns ingen meny alls. På telefon och pekskärm är menyn oförändrad: alla åtgärder.
  /** @type {import("./OpsAtgardsblad.jsx").Atgard[]} */
  const poster = menyPa ? [...mer] : [];
  if (menyPa && citat?.pa) poster.push({ id: "citera", etikett: t.citera, ikon: <CiteraIkon size={16} />, onValj: () => citat.onCitera(m) });
  if (menyPa && fasta) poster.push({ id: "fast", etikett: fast ? t.lossa : t.fast, ikon: <FastIkon size={16} />, onValj: () => fasta.vaxla(m.id) });
  poster.push(...kopior);
  // ⛔ På dator bara på meddelandet pekaren eller fokuset står på (`visaKopior`, se `Meddelanderader`), och kvar medan kvittot visas.
  const merKnapp = menyPa || (kopior.length > 0 && (visaKopior || kopia !== null));
  const reaktioner = menyPa && reakt?.pa
    ? (/** @type {() => void} */ stang) => {
        const egna = new Set((reakt.sammanfattning.get(m.id) ?? []).filter((r) => r.egen).map((r) => r.kod));
        return (
          <div role="group" aria-label={t.valjReaktion} data-mer-reaktioner={m.id} className="flex justify-between gap-0.5 px-1 pb-1">
            {REAKTIONSKODER.map((kod) => (
              <button
                key={kod}
                type="button"
                data-valj-reaktion={kod}
                aria-label={reaktionsnamn(kod, t)}
                aria-pressed={egna.has(kod)}
                onClick={() => {
                  reakt.vaxla(m.id, kod);
                  stang();
                }}
                className={cx(
                  "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-(--duration-fast) ease-standard hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                  egna.has(kod) && "bg-accent-faint",
                )}
              >
                <Reaktionsikon kod={kod} vald={egna.has(kod)} size={20} />
              </button>
            ))}
          </div>
        );
      }
    : undefined;
  return (
    <span className={cx("relative mt-0.5 flex max-w-full items-center gap-1.5", egen ? "mr-1 flex-row-reverse" : "ml-1")}>
      {extra}
      {reakt?.pa && losa ? <ReageraKnapp m={m} egen={egen} reakt={reakt} texter={t} /> : null}
      {fasta && (losa || fast) ? (
        <button
          type="button"
          data-fast={m.id}
          aria-label={fast ? t.lossa : t.fast}
          aria-pressed={fast}
          onClick={() => fasta.vaxla(m.id)}
          className={cx(
            "-my-2 size-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-[color,background-color,opacity] duration-(--duration-fast) ease-standard hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
            // Nålen på ett fäst meddelande är innehåll och står kvar på telefon; Fäst på ett annat är en åtgärd och bor i menyn.
            fast ? "inline-flex text-accent" : "hidden text-ink-muted hover:text-ink md:inline-flex md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 md:focus-visible:opacity-100",
          )}
        >
          <FastIkon size={16} />
        </button>
      ) : null}
      {citat?.pa && losa ? (
        /*
         * ⛔ (0.203.0) SAMMA HOVRING SOM TRÅDENS MÄRKE BREDVID. CP 2026-11-08: "Hover på pilen i svar i chatten är inte samma som svar." Pilen fyllde en
         * cirkel på 44 px (`hover:bg-hover`) mellan bubblorna, medan "N svar" och "Svara i tråd" bara byter textfärg sedan 0.200.1 (`tradknappKlass`).
         * Nu byter pilen bara färg, med samma rundning, samma övergång och samma fokusram. Träffytan står kvar: 44 px, och knappen finns bara på dator.
         */
        <button
          type="button"
          data-citera={m.id}
          aria-label={t.citera}
          onClick={() => citat.onCitera(m)}
          className="-my-2 hidden size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-muted transition-[color,opacity] duration-(--duration-fast) ease-standard hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent md:inline-flex md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 md:focus-visible:opacity-100"
        >
          <CiteraIkon size={16} />
        </button>
      ) : null}
      {merKnapp && (poster.length > 0 || reaktioner) ? (
        // ⛔ PRICKARNA SYNS BARA DÄR DE BEHÖVS (0.190.0, CP 2026-11-05): på en pekskärm öppnar ett långt tryck på bubblan menyn och ⋮ ritas inte alls (`utanKnapp`: bara
        // menyn, inget element i raden); med mus syns ⋮ när pekaren är över raden eller raden har fokus, så tangentbordet når den som förut (Tab till ⋮ gör den synlig).
        pekskarm ? (
          <OpsAtgardsblad baraKnapp utanKnapp namn={namn} poster={poster} overst={reaktioner} oppnadVid={oppnadVid} onOppnadVid={onOppnadVid} />
        ) : (
          <span data-mer={m.id} data-mer-kopior={menyPa ? undefined : ""} className="-my-2 inline-flex opacity-0 transition-opacity duration-(--duration-fast) ease-standard group-hover:opacity-100 group-focus-within:opacity-100">
            <OpsAtgardsblad baraKnapp namn={namn} poster={poster} overst={reaktioner} oppnadVid={oppnadVid} onOppnadVid={onOppnadVid} />
          </span>
        )
      ) : null}
      {kopia ? (
        <span role="status" data-kopierat={kopia} className={cx("text-liten", kopia === "fel" || kopia === "lankfel" ? "text-danger" : "text-ink-muted")}>
          {kopia === "ok" ? t.kopierat : kopia === "lank" ? t.lankKopierad : kopia === "lankfel" ? t.kopieraLankFel : t.kopieraFel}
        </span>
      ) : null}
    </span>
  );
}

/**
 * "Reagera" och väljaren med de sex reaktionerna.
 *
 * ⛔ TANGENTBORDET FÅR SAMMA VÄG SOM PEKAREN (SS #1701: en verktygsrad som bara syns vid hovring finns inte för tangentbordet).
 * Knappen syns på dator vid hover och fokus, på telefon alltid. Väljaren tar fokus när den öppnas, pilarna flyttar mellan
 * reaktionerna, Escape stänger och lämnar fokus på Reagera, och fokus som lämnar väljaren stänger den.
 *
 * @param {{ m: { id: string }, egen: boolean, reakt: ReturnType<typeof useReaktioner>, texter: Required<Meddelandetexter> }} props
 */
function ReageraKnapp({ m, egen, reakt, texter: t }) {
  const [oppen, setOppen] = useState(false);
  const knapp = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const panel = useRef(/** @type {HTMLDivElement | null} */ (null));
  const panelId = useId();
  const egna = new Set((reakt.sammanfattning.get(m.id) ?? []).filter((r) => r.egen).map((r) => r.kod));
  useEffect(() => {
    if (oppen) /** @type {HTMLElement | null} */ (panel.current?.querySelector("button") ?? null)?.focus();
  }, [oppen]);
  const stang = () => {
    setOppen(false);
    knapp.current?.focus();
  };
  return (
    <>
      <button
        ref={knapp}
        type="button"
        data-reagera={m.id}
        aria-label={t.reagera}
        aria-expanded={oppen}
        aria-controls={oppen ? panelId : undefined}
        onClick={() => setOppen((o) => !o)}
        className={cx(
          // Under 768 px bor Reagera i meddelandets meny (0.106.0, #386 skiva 6), med reaktionerna överst.
          "-my-2 hidden size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-muted transition-[color,background-color,opacity] duration-(--duration-fast) ease-standard hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent md:inline-flex",
          oppen ? "text-ink" : "md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 md:focus-visible:opacity-100",
        )}
      >
        <LeendeIkon size={16} />
      </button>
      {oppen ? (
        <div
          ref={panel}
          id={panelId}
          role="group"
          aria-label={t.valjReaktion}
          data-reaktionsvaljare={m.id}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              stang();
              return;
            }
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              e.preventDefault();
              const knappar = /** @type {HTMLElement[]} */ ([...(panel.current?.querySelectorAll("button") ?? [])]);
              const i = knappar.indexOf(/** @type {HTMLElement} */ (document.activeElement));
              const n = knappar.length;
              knappar[(i + (e.key === "ArrowRight" ? 1 : n - 1)) % n]?.focus();
            }
          }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(/** @type {Node | null} */ (e.relatedTarget)) && e.relatedTarget !== knapp.current) setOppen(false);
          }}
          className={cx(
            "absolute bottom-full z-10 mb-1 flex gap-0.5 rounded-full border border-line bg-surface p-0.5 shadow-md",
            egen ? "right-0" : "left-0",
          )}
        >
          {REAKTIONSKODER.map((kod) => {
            const min = egna.has(kod);
            return (
              <button
                key={kod}
                type="button"
                data-valj-reaktion={kod}
                aria-label={reaktionsnamn(kod, t)}
                aria-pressed={min}
                onClick={() => {
                  reakt.vaxla(m.id, kod);
                  stang();
                }}
                className={cx(
                  "inline-flex size-11 cursor-pointer items-center justify-center rounded-full transition-colors duration-(--duration-fast) ease-standard hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                  min && "bg-accent-faint",
                )}
              >
                <Reaktionsikon kod={kod} vald={min} size={20} />
              </button>
            );
          })}
        </div>
      ) : null}
    </>
  );
}

/**
 * Citatet ovanför ett svar (chattens nattskiva): namnet och ett utdrag, HÄRLETT ur det citerade meddelandet. ⛔ Ingen kopia av
 * texten i svaret (SS kopierade den, och fick städa citaten när ett konto raderades). Går meddelandet inte att läsa sägs det.
 *
 * @param {{ mid: string, uppslag: Map<string, (import("../lib/samtal.js").Meddelande & { id: string }) | null>, egen: boolean, uid: string, namnFor: (uid: string) => string, texter: Required<Meddelandetexter> }} props
 */
function Citat({ mid, uppslag, egen, uid, namnFor, texter: t }) {
  const sprak = useOpsSprak();
  const m = uppslag.get(mid);
  return (
    <div data-citat={mid} className={cx("mb-0.5 max-w-full rounded-lg border-l-2 border-line-strong bg-canvas px-2.5 py-1 text-meta text-ink-secondary", egen ? "self-end" : "self-start")}>
      {m === undefined ? (
        <span aria-busy="true">…</span>
      ) : m === null ? (
        <span data-citat-saknas="">{t.citatSaknas}</span>
      ) : (
        <>
          <span className="font-medium text-ink">{avNamnFor(namnFor, m, uid, t.du, sprak)}</span>
          <span>: {synligText(m, 80)}</span>
        </>
      )}
    </div>
  );
}

/**
 * Meddelanden som ska ritas på annat ställe än i loggen (citat, fästa): de som redan är laddade, och de andra lästa en gång var
 * (`kalla.meddelande`). `null`: finns inte, eller kunde inte läsas. Utan källa: bara de laddade.
 * @param {ReturnType<typeof import("../data/samtalskalla.js").createSamtalskalla> | null} kalla
 * @param {string} sid @param {ReadonlyArray<import("../lib/samtal.js").Meddelande & { id: string }>} alla
 * @param {ReadonlyArray<string>} onskade
 */
function useMeddelandeuppslag(kalla, sid, alla, onskade) {
  const [lasta, setLasta] = useState(/** @type {Map<string, (import("../lib/samtal.js").Meddelande & { id: string }) | null>} */ (new Map()));
  const begarda = useRef(/** @type {Set<string>} */ (new Set()));
  const laddade = useMemo(() => new Map(alla.map((m) => [m.id, m])), [alla]);
  const nyckel = [...new Set(onskade)].sort().join("|");
  useEffect(() => {
    if (!kalla || !nyckel) return;
    for (const mid of nyckel.split("|")) {
      if (laddade.has(mid) || begarda.current.has(mid)) continue;
      begarda.current.add(mid);
      kalla.meddelande(sid, mid).then(
        (m) => setLasta((f) => new Map(f).set(mid, m ? { ...m, id: mid } : null)),
        () => setLasta((f) => new Map(f).set(mid, null)),
      );
    }
  }, [kalla, sid, nyckel, laddade]);
  return useMemo(() => new Map([...lasta, ...laddade]), [lasta, laddade]);
}

/**
 * De citerade meddelandena i loggen.
 * @param {ReturnType<typeof import("../data/samtalskalla.js").createSamtalskalla> | null} kalla
 * @param {string} sid @param {ReadonlyArray<import("../lib/samtal.js").Meddelande & { id: string }>} alla
 */
function useCitatuppslag(kalla, sid, alla) {
  return useMeddelandeuppslag(kalla, sid, alla, /** @type {string[]} */ (alla.map((m) => m.svarPa).filter((x) => typeof x === "string")));
}

/**
 * Sökningen i det öppna samtalet (chattens nattskiva): träffarna bland de laddade meddelandena, och den aktuella rullad fram.
 * @param {ReadonlyArray<import("../lib/samtal.js").Meddelande & { id: string }>} alla @param {{ current: HTMLElement | null }} logg
 */
function useSokISamtal(alla, logg) {
  const [oppen, setOppen] = useState(false);
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  const lista = useMemo(() => {
    const n = q.trim().toLocaleLowerCase("sv");
    return n ? alla.filter((m) => m.text.toLocaleLowerCase("sv").includes(n)).map((m) => m.id) : [];
  }, [alla, q]);
  // Den senaste träffen först, som SS: det man letar efter har oftast nyss sagts.
  const aktuell = lista.length ? lista[Math.max(0, lista.length - 1 - (index % lista.length))] : null;
  useEffect(() => {
    if (!aktuell) return;
    const el = logg.current?.querySelector(`[data-traff="aktuell"]`);
    /** @type {any} */ (el)?.scrollIntoView?.({ block: "center" });
  }, [aktuell, logg]);
  return {
    oppen,
    q,
    setQ: (/** @type {string} */ v) => {
      setQ(v);
      setIndex(0);
    },
    traffar: new Set(lista),
    antal: lista.length,
    plats: lista.length ? (index % lista.length) + 1 : 0,
    aktuell,
    // "Föregående" är äldre (uppåt i loggen), "nästa" nyare (nedåt). Båda varvar runt.
    forra: () => setIndex((i) => (i + 1) % Math.max(1, lista.length)),
    nasta: () => setIndex((i) => (i + Math.max(1, lista.length) - 1) % Math.max(1, lista.length)),
    oppna: () => setOppen(true),
    stang: () => {
      setOppen(false);
      setQ("");
      setIndex(0);
    },
  };
}

/**
 * Sökraden under samtalets huvud. ⛔ Den säger hur långt den når: bara de laddade meddelandena, och "Visa äldre" för att nå längre.
 * Noll träffar sägs ut, med samma förbehåll (regel 5).
 * @param {{ sok: ReturnType<typeof useSokISamtal>, antal: number, kanFinnasAldre: boolean, texter: Required<Meddelandetexter> }} props
 */
function Sokrad({ sok, antal, kanFinnasAldre, texter: t }) {
  const falt = useRef(/** @type {HTMLInputElement | null} */ (null));
  useEffect(() => {
    falt.current?.focus();
  }, []);
  return (
    <div data-sokrad="" className="flex shrink-0 flex-col gap-1 border-b border-line px-3 py-2">
      <div className="flex items-center gap-1">
        <label className="flex min-h-11 min-w-0 flex-1 items-center gap-1.5 rounded-base border border-line bg-surface px-2.5 text-ink-muted focus-within:outline-2 focus-within:outline-accent">
          <SokIkon size={14} />
          <input
            ref={falt}
            type="search"
            value={sok.q}
            onChange={(e) => sok.setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                // Enter letar bakåt i samtalet, Skift plus Enter framåt.
                if (e.shiftKey) sok.nasta();
                else sok.forra();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                sok.stang();
              }
            }}
            aria-label={t.sokISamtalet}
            placeholder={t.sokISamtalet}
            className="min-w-0 flex-1 bg-transparent text-hjalp text-ink outline-none placeholder:text-ink-muted"
          />
        </label>
        <span data-sok-plats="" role="status" className="min-w-12 text-center text-liten tabular-nums text-ink-muted">
          {sok.q.trim() ? t.sokPlats.replace("{i}", String(sok.plats)).replace("{n}", String(sok.antal)) : ""}
        </span>
        <button type="button" aria-label={t.forraTraff} disabled={sok.antal < 2} onClick={sok.forra} className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-base text-ink-muted hover:bg-hover disabled:cursor-default disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent">
          <span className="inline-flex -rotate-90"><ChevronHogerIkon size={16} /></span>
        </button>
        <button type="button" aria-label={t.nastaTraff} disabled={sok.antal < 2} onClick={sok.nasta} className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-base text-ink-muted hover:bg-hover disabled:cursor-default disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent">
          <ChevronNedIkon size={16} />
        </button>
        <button type="button" aria-label={t.stangSok} onClick={sok.stang} className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-base text-ink-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent">
          <KryssIkon size={14} />
        </button>
      </div>
      {sok.q.trim() && sok.antal === 0 ? (
        <p data-sok-ingen="" className="m-0 text-liten text-ink-muted">
          {t.ingenTraffLaddade}
        </p>
      ) : null}
      {kanFinnasAldre ? (
        <p data-sok-omfang="" className="m-0 text-liten text-ink-muted">
          {t.sokOmfang.replace("{n}", String(antal))}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Fästningarna i ett samtal (chattens nattskiva): en lyssnare eller en läsning, och växlingen.
 * @param {(ReturnType<typeof import("../data/samtalskalla.js").createSamtalskalla> & import("../data/samtalskalla.js").Fastfunktioner) | null} kalla
 * @param {string} sid @param {string} uid
 */
function useFasta(kalla, sid, uid) {
  const [lage, setLage] = useState(/** @type {{ rader: any[], fler: boolean, fel: Error | null, skrivfel: Error | null }} */ ({ rader: [], fler: false, fel: null, skrivfel: null }));
  const lyssnar = useRef(false);
  const lasIn = async () => {
    if (!kalla) return;
    try {
      const svar = await kalla.lasFasta(sid);
      setLage((l) => ({ ...l, rader: svar.rader, fler: svar.fler, fel: null }));
    } catch (e) {
      setLage((l) => ({ ...l, fel: e instanceof Error ? e : new Error(String(e)) }));
    }
  };
  useEffect(() => {
    if (!kalla) return undefined;
    let levande = true;
    const stang = kalla.prenumereraFasta(sid, { onData: (svar) => levande && setLage((l) => ({ ...l, rader: svar.rader, fler: svar.fler, fel: null })), onError: (e) => levande && setLage((l) => ({ ...l, fel: e })) });
    lyssnar.current = Boolean(stang);
    if (!stang) lasIn();
    return () => {
      levande = false;
      stang?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kalla, sid]);
  const ids = useMemo(() => new Set(lage.rader.map((r) => r.id)), [lage.rader]);
  /** @param {string} mid */
  const vaxla = async (mid) => {
    if (!kalla) return;
    try {
      if (ids.has(mid)) await kalla.lossa(sid, mid);
      else await kalla.fast(sid, { mid, av: uid });
      setLage((l) => ({ ...l, skrivfel: null }));
      if (!lyssnar.current) await lasIn();
    } catch (e) {
      setLage((l) => ({ ...l, skrivfel: e instanceof Error ? e : new Error(String(e)) }));
    }
  };
  return { pa: Boolean(kalla), rader: lage.rader, ids, fler: lage.fler, fel: lage.fel, skrivfel: lage.skrivfel, vaxla };
}

/**
 * Raden med fästa meddelanden under samtalets huvud: "2 fästa", som fälls ut till en lista med namn, utdrag och Lossa.
 *
 * ⛔ DET FÄSTA MEDDELANDET HÄRLEDS, DET KOPIERAS INTE: ur de laddade, annars läst en gång (`kalla.meddelande`). Ett som inte går att
 * läsa sägs ut. Fel och tak står utskrivna (regel 5). Finns inga fästa och inget fel ritas ingen rad: tomheten är då inte en rubrik
 * utan ett samtal utan fästningar, och knappen vid varje meddelande säger hur man fäster.
 *
 * @param {{ fasta: ReturnType<typeof useFasta>, kalla: ReturnType<typeof import("../data/samtalskalla.js").createSamtalskalla>, sid: string, laddade: ReadonlyArray<import("../lib/samtal.js").Meddelande & { id: string }>, uid: string, namnFor: (uid: string) => string, texter: Required<Meddelandetexter> }} props
 */
function Fastarad({ fasta, kalla, sid, laddade, uid, namnFor, texter: t }) {
  const sprak = useOpsSprak();
  const [oppen, setOppen] = useState(false);
  const listId = useId();
  const uppslag = useMeddelandeuppslag(fasta.pa ? kalla : null, sid, laddade, fasta.rader.map((r) => r.id));
  if (!fasta.pa || (fasta.rader.length === 0 && !fasta.fel && !fasta.skrivfel)) return null;
  return (
    <div data-fastarad="" className="shrink-0 border-b border-line px-3 py-1">
      {fasta.fel ? <p role="alert" data-fastafel="lasa" className="m-0 py-1 text-liten text-danger">{t.fastaFel}</p> : null}
      {fasta.skrivfel ? <p role="alert" data-fastafel="skriva" className="m-0 py-1 text-liten text-danger">{t.fastFel}</p> : null}
      {fasta.rader.length > 0 ? (
        <button
          type="button"
          data-fasta-knapp=""
          aria-expanded={oppen}
          aria-controls={oppen ? listId : undefined}
          onClick={() => setOppen((o) => !o)}
          className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-base px-1 text-meta font-medium text-accent hover:bg-accent-faint focus-visible:outline-2 focus-visible:outline-accent"
        >
          <FastIkon size={14} />
          <span>{t.fastaRubrik.replace("{n}", String(fasta.rader.length))}</span>
          <span className={cx("inline-flex transition-transform", oppen ? "rotate-180" : "")}>
            <ChevronNedIkon size={14} />
          </span>
        </button>
      ) : null}
      {oppen ? (
        <ul id={listId} className="m-0 flex max-h-48 list-none flex-col overflow-y-auto p-0">
          {fasta.rader.map((r) => {
            const m = uppslag.get(r.id);
            return (
              <li key={r.id} data-fastad={r.id} className="flex items-center gap-2 border-t border-line first:border-t-0">
                <span className="min-w-0 flex-1 truncate py-2 text-meta text-ink-secondary">
                  {m === undefined ? "…" : m === null ? t.citatSaknas : (
                    <>
                      <span className="font-medium text-ink">{avNamnFor(namnFor, m, uid, t.du, sprak)}</span>: {synligText(m, 80)}
                    </>
                  )}
                </span>
                <button
                  type="button"
                  aria-label={`${t.lossa}: ${m ? synligText(m, 40) : r.id}`}
                  onClick={() => fasta.vaxla(r.id)}
                  className="inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-base px-2 text-meta text-ink-secondary hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {t.lossa}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {fasta.fler ? <p role="status" className="m-0 py-1 text-liten text-ink-muted">{t.fastaFler}</p> : null}
    </div>
  );
}

/**
 * Klasserna för trådens knapp under ett meddelande: märket "3 svar" när tråden finns, och "Svara i tråd" när den inte gör det. EN form för appens chatt och gästens (0.196.0, regel 2).
 *
 * ⛔ KAN 6: träffytan är 44 px, men raden växer inte: de negativa marginalerna lägger ytan i luften mellan meddelandena. KAN 9: på dator syns "Svara i tråd" först när pekaren eller fokus är på
 * meddelandet, så att en lång chatt inte blir en rad knappar. Märket syns alltid, det är innehåll. ⛔ 0.106.0 (#386 skiva 6): på telefon stod "Svara i tråd" här under varje meddelande, med skälet
 * att en meny vore ett steg till. Med tre ikoner bredvid blev det fyra lösa åtgärder per bubbla, och CP bad om en Mer-knapp. Där bor den nu, som första post (`merFor`).
 *
 * @param {boolean} finns
 */
export function tradknappKlass(finns) {
  return cx(
    // ⛔ (0.200.1) INGEN FYLLD BAKGRUND VID HOVRING. Knappen står mellan två bubblor och går in i raderna (`-my-2`, så att träffytan är 44 px utan att raden växer). Med `hover:bg-hover`
    // fick den bubblornas ton och såg ut som en tredje bubbla (CP 2026-11-07: "samma färg och ingen ram, så den smälter ihop"). Bara texten ändras; fokusramen står kvar.
    "-my-2 min-h-11 max-w-full cursor-pointer items-center gap-1 rounded-full px-2 text-liten underline-offset-4 transition-[color,opacity] duration-(--duration-fast) ease-standard hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
    finns
      ? "inline-flex text-accent"
      : "hidden text-ink-muted hover:text-ink md:inline-flex md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 md:focus-visible:opacity-100",
  );
}

/**
 * Raden ovanför skrivfältet när man svarar med citat: "Svarar på {namn}: {utdrag}" och ett kryss som ångrar. EN rad för appens chatt och gästens (0.196.0, regel 2).
 * `ram`: strecket ovanför, som skrivfältets (`Skrivfalt`). Gästens chatt har inget (0.195.0).
 *
 * @param {{ m: import("../lib/samtal.js").Meddelande & { id: string }, namn: string, onAvbryt: () => void, texter: Required<Meddelandetexter>, ram?: boolean }} props
 */
export function SvararPaRad({ m, namn, onAvbryt, texter: t, ram = true }) {
  return (
    <div data-svarar-pa={m.id} className={cx("flex shrink-0 items-center gap-2 pt-2 text-meta text-ink-secondary", ram && "border-t border-line px-3")}>
      <CiteraIkon size={14} />
      <span className="min-w-0 flex-1 truncate">
        {t.svararPa} <span className="font-medium text-ink">{namn}</span>: {synligText(m, 60)}
      </span>
      <button
        type="button"
        aria-label={t.avbrytCitat}
        onClick={onAvbryt}
        className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-muted hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
      >
        <KryssIkon size={14} />
      </button>
    </div>
  );
}

/**
 * @typedef {object} Postkort (chattens nattskiva) Länkar till appens egna poster, ritade som kort under bubblan.
 * @property {(url: string) => ({ titel: string, undertitel?: string, ikon?: import("react").ReactNode } | null) | Promise<{ titel: string, undertitel?: string, ikon?: import("react").ReactNode } | null>} slaUpp
 *   Appens uppslag: en adress i texten ger postens titel (och gärna typ som `undertitel` och en ikon), eller `null` när adressen inte är
 *   en av appens poster. ⛔ RAMVERKET KÄNNER INGA POSTTYPER: det vet inte vad ett ärende eller en faktura är, bara att appen svarade.
 * @property {(url: string, e: import("react").MouseEvent) => void} [onOppna] Appens navigering. Utelämnad: en vanlig länk.
 */

/** Högst så många kort under en bubbla. Fler länkar står kvar som länkar i texten. */
const MAX_POSTKORT = 2;

/**
 * Uppslagen, per appens funktion och adress. ⛔ Titel och typ LAGRAS INTE i meddelandet (SS kopierade `linkedArtifact` med titel och
 * meta, som blev inaktuella när posten bytte namn): de slås upp när kortet ritas, och minns så länge sidan lever.
 * @type {WeakMap<Function, Map<string, Promise<any>>>}
 */
const POSTKORTMINNE = new WeakMap();

/** @param {Postkort["slaUpp"]} sla @param {string} url */
function slaUppPostkort(sla, url) {
  const minne = POSTKORTMINNE.get(sla) ?? new Map();
  POSTKORTMINNE.set(sla, minne);
  if (!minne.has(url)) minne.set(url, Promise.resolve().then(() => sla(url)));
  return /** @type {Promise<any>} */ (minne.get(url));
}

/**
 * Korten för länkarna i ett meddelande: bara de http- och https-adresser texten redan gör klickbara (samma parser som bubblan),
 * högst `MAX_POSTKORT`, och bara de appen känner igen. ⛔ Ett uppslag som föll sägs ut, aldrig tyst.
 *
 * ⛔ (0.196.0, cllp/ops-framework#527) KOMPONENTEN GER OCKSÅ TEXTEN SOM SKA STÅ I BUBBLAN (`children(visad, kort)`): texten utan de länkar som blev ett kort (`utanLankar`). Förut stod länken både som en lång,
 * radbruten adress i bubblan och som kortet under den, samma sak två gånger. En länk vars uppslag inte svarat än, gav `null` eller föll står kvar, så att ingenting försvinner tyst (regel 5).
 * Utan `postkort` är texten orörd och inga uppslag görs.
 *
 * ⛔ KORTET HAR INGEN KANTLINJE (0.196.0, CP 2026-11-06: "Ta bort borders runt chatten och överallt."): det skiljs ut av samma svaga yta som bubblorna (`bg-hover`), och fokus syns med fokusringen.
 *
 * @param {{ text: string, postkort?: Postkort, egen: boolean, texter: Required<Meddelandetexter>, children: (visad: string, kort: import("react").ReactNode) => import("react").ReactNode }} props
 */
function MedPostkort({ text, postkort, egen, texter: t, children }) {
  const adresser = useMemo(() => {
    if (!postkort) return [];
    /** @type {string[]} */
    const ut = [];
    for (const rad of String(text ?? "").split(/\r?\n/)) for (const b of splitInline(rad)) if (b.kind === "link" && b.url && !ut.includes(b.url)) ut.push(b.url);
    return ut.slice(0, MAX_POSTKORT);
  }, [text, postkort]);
  const sla = postkort?.slaUpp;
  const [svar, setSvar] = useState(/** @type {Record<string, any>} */ ({}));
  useEffect(() => {
    if (!sla) return undefined;
    let levande = true;
    for (const url of adresser) {
      slaUppPostkort(sla, url).then(
        (r) => levande && setSvar((f) => ({ ...f, [url]: r ?? null })),
        () => levande && setSvar((f) => ({ ...f, [url]: { fel: true } })),
      );
    }
    return () => {
      levande = false;
    };
  }, [adresser, sla]);
  const kort = adresser.filter((u) => svar[u]);
  const somKort = kort.filter((u) => !svar[u].fel);
  if (!postkort || kort.length === 0) return children(text, null);
  return children(
    somKort.length ? utanLankar(text, somKort) : text,
    <div data-postkortrad="" className={cx("mt-1 flex w-full max-w-72 flex-col gap-1", egen ? "items-end" : "items-start")}>
      {kort.map((url) =>
        svar[url].fel ? (
          <p key={url} data-postkort-fel={url} role="alert" className="m-0 text-liten text-danger">
            {t.postkortFel}
          </p>
        ) : (
          <a
            key={url}
            href={url}
            data-postkort={url}
            onClick={postkort.onOppna ? (e) => postkort.onOppna?.(url, e) : undefined}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-card bg-hover px-3 py-2 text-left no-underline transition-colors duration-(--duration-fast) ease-standard hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span aria-hidden="true" className="inline-flex shrink-0 text-accent">
              {svar[url].ikon ?? <FilIkon size={18} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-etikett font-medium text-ink">{svar[url].titel}</span>
              {svar[url].undertitel ? <span className="block truncate text-liten text-ink-muted">{svar[url].undertitel}</span> : null}
            </span>
          </a>
        ),
      )}
    </div>,
  );
}

/**
 * Arbetar agenten just nu, enligt statusen? Samma prövning som raden (`agentstatus`): en status äldre än taket arbetar inte.
 * @param {ReturnType<typeof useAgentstatusdok>} lage
 */
function agentArbetar(lage) {
  const v = agentstatus(lage.dok, Date.now());
  return Boolean(v && !("fel" in v));
}

/**
 * Förslagen ur ett agentsvar som det kom ur databasen (0.105.0). ⛔ ETT FELFORMAT FÖRSLAG FÄLLER INTE CHATTEN: det hoppas över och
 * rapporteras, en gång per meddelande (regel 5). Knapparna ritas av `OpsForslag`, samma som en app kan rita var som helst.
 * @param {{ varde: unknown, sid: string, mid: string, onForslag: (f: { sid: string, mid: string, id: string }) => Promise<import("../lib/forslag.js").Forslagssvar> }} props
 */
function AgentensForslag({ varde, sid, mid, onForslag }) {
  const { forslag, fel } = useMemo(() => forslagUrData(varde), [varde]);
  const feltext = fel.join(" | ");
  useEffect(() => {
    if (feltext) rapporteraFel(new Error(`OpsMeddelanden: förslag i meddelandet hoppades över: ${feltext}`), { yta: "OpsMeddelanden", steg: "forslag", sid, mid });
  }, [feltext, sid, mid]);
  if (forslag.length === 0) return null;
  return (
    <div className="mt-1.5 w-full min-w-0">
      <OpsForslag forslag={forslag} onForslag={(id) => onForslag({ sid, mid, id })} />
    </div>
  );
}
