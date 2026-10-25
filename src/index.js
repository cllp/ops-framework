/**
 * Ramverkets publika yta.
 *
 * ⛔ Det som inte står här är inte publikt. `cx` exporteras medvetet inte:
 * finns den tillgänglig är nästa steg att en app sätter ihop sin egen knapp av
 * våra klasser, och då är API:et öppet igen fast via en omväg.
 *
 * Reglerna för hur de här används står i `CLAUDE.md` och i
 * `skills/css-and-components/`.
 */

// ── Skal ───────────────────────────────────────────────────────────────────
export { OpsAppShell, useOppnaSkapa, useOppnaHandelse, useOppnaInspelning } from "./components/OpsAppShell.jsx";
export { OpsBottomNav } from "./components/OpsBottomNav.jsx";
// 0.57.0, cllp/lifehub.app#2: långtryck på plusset spelar in. Skalet kopplar in dem med `talk`, de är publika för den som bygger egen rad.
export { OpsTalk, OpsInspelning, useTalk, TALK_PRICKAR } from "./components/OpsTalk.jsx";
export { OpsForslag } from "./components/OpsForslag.jsx";
export { FORSLAG_IKONER, MAX_FORSLAG, MAX_FORSLAG_ETIKETT, MAX_FORSLAG_TEXT, forslagUrData, forslagetsFel, kontrolleraForslag, forslagssvar } from "./lib/forslag.js";
export { LANGTRYCK_MS, TALK_ORD, MAX_SEKUNDER, LJUDFORMAT, MIKROFON_SPARRAD_AV_SIDAN, mikrofonenTillatenAvSidan, kanBeOmMikrofon, talkNasta, valjFormat, talkFeltext, webblasarensInspelare } from "./lib/talk.js";
export { OpsHub, OpsHubModul, OpsHubTillbaka, OpsGruppHubb } from "./components/OpsHub.jsx";
export { OpsVyAtgard } from "./components/OpsTillbaka.jsx";
export { OpsModulSida } from "./components/OpsModulSida.jsx";
export { OpsApparArk, ORD_OPSAPPARARK } from "./components/OpsApparArk.jsx";
export { OpsModulRam, ORD_OPSMODULRAM } from "./components/OpsModulRam.jsx";
export { LAGE_PARAM, INSTALLNINGSLAGE, arInstallningslage, medInstallningslage, utanInstallningslage } from "./lib/apparark.js";
/*
 * ⛔ AGENTER (0.90.0, inställningsvyn 0.90.2). Ytan är ramverkets. Dokumentet, modellen och nyckeln är appens.
 * Ingen samling här: en andra kopia hade glidit isär från den appen redan skriver.
 */
export { OpsAgenter, ORD_OPSAGENTER, agenterManifest } from "./components/OpsAgenter.jsx";
export { AGENTER_ID, AGENT_PARAM, agentIHref, medAgent, agentInstallningsHref, utanAgenterSomApp, modulerIAppar } from "./lib/agenter.js";
export { AGENTMODELLER, FORVALD_AGENTMODELL, modellUrId, modellKanValjas } from "./lib/agentmodeller.js";
export { OpsBrand } from "./components/OpsBrand.jsx";

// ── Åtgärder och ytor ──────────────────────────────────────────────────────
export { OpsButton } from "./components/OpsButton.jsx";
export { OpsCard } from "./components/OpsCard.jsx";
export { OpsView, OpsViewHeader } from "./components/OpsView.jsx";
export { OpsSidoyta } from "./components/OpsSidoyta.jsx";
// 0.94.0: byggstenarna och klasserna för publika sidor (hjälte, avsnitt, löptext, skal, block, uppmaning), se docs/brand.md och README "Publika sidor".
export { OpsPublikHjalte, OpsPublikAvsnitt, OpsPublikText } from "./components/OpsPublik.jsx";
export { OpsPublikSkal, OpsPublikHuvud, OpsPublikFot } from "./components/OpsPublikSkal.jsx";
export { OpsPublikBlock, OpsPublikUppmaning } from "./components/OpsPublikBlock.jsx";
export { PUBLIK_KLASS, PUBLIK_KNAPP, PUBLIK_TONER } from "./lib/publikKlass.js";
export { OpsVyValjare } from "./components/OpsVyValjare.jsx";
export { OpsHuvudmenyProvider, useIHuvudmenyn } from "./components/OpsHuvudmeny.jsx";
export { OpsModal } from "./components/OpsModal.jsx";
export { OpsDisclosure } from "./components/OpsDisclosure.jsx";
// #157: sektionsrubrik och chip, mätta ur SessionStudios ProfileView.
export { OpsSectionLabel } from "./components/OpsSectionLabel.jsx";
export { OpsChip } from "./components/OpsChip.jsx";

// ── Formulär ───────────────────────────────────────────────────────────────
export { OpsField, OpsInput, OpsTextarea, OpsTranskriberingProvider, ORD_OPSTEXTAREA_TAL } from "./components/OpsField.jsx";
export { OpsSelect } from "./components/OpsSelect.jsx";
export { OpsDatePicker } from "./components/OpsDatePicker.jsx";
export { OpsTimePicker } from "./components/OpsTimePicker.jsx";
export { OpsCheckbox, OpsSwitch } from "./components/OpsToggle.jsx";
export { OpsToggleRow } from "./components/OpsToggleRow.jsx";
export { OpsRadioGroup } from "./components/OpsRadioGroup.jsx";
export { OpsSlider } from "./components/OpsSlider.jsx";
export { OpsKnob } from "./components/OpsKnob.jsx";
export { OpsSimulatePopover } from "./components/OpsSimulatePopover.jsx";
export { OpsFloatingSummary } from "./components/OpsFloatingSummary.jsx";
export { OpsScrollArea } from "./components/OpsScrollArea.jsx";
export { OpsFilePicker } from "./components/OpsFilePicker.jsx";
export { OpsLjudspelare } from "./components/OpsLjudspelare.jsx";
export { OpsSpelareProvider, OpsSpelaKnapp, OpsSpelarKontroller, useSpelare, ORD_OPSSPELARE } from "./components/OpsSpelare.jsx";
// ⛔ `readAttachment` och `MAX_SIDE` exporteras MED FLIT inte. En app som läser filer
// själv har gått runt komponenten, och då finns två ställen som bestämmer vad som
// ryms. `isImage` och `sizeText` behövs för att VISA en sparad bilaga, alltså
// på andra sidan lagringen, där komponenten inte finns.
export { isImage, isAudio, sizeText, attachmentSize } from "./lib/file.js";

// ── Data ───────────────────────────────────────────────────────────────────
export { OpsList, OpsListRow } from "./components/OpsList.jsx";
export { OpsSvepRad, ANGRA_MS } from "./components/OpsSvepRad.jsx";
// 0.138.0: vågrätt svep på en yta (datumväljaren bläddrar månad, Dagen i appen byter dag), se README "useSidsvep".
export { useSidsvep } from "./components/useSidsvep.js";
export { OpsAtgardsblad } from "./components/OpsAtgardsblad.jsx";
export { OpsDokument } from "./components/OpsDokument.jsx";
export { OpsEventList } from "./components/OpsEventList.jsx";
export { OpsBreakdown } from "./components/OpsBreakdown.jsx";
export { OpsAttributes } from "./components/OpsAttributes.jsx";
export { OpsShareChart } from "./components/OpsShareChart.jsx";
export { OpsRankChart } from "./components/OpsRankChart.jsx";
export { OpsTable } from "./components/OpsTable.jsx";
export { OpsStat } from "./components/OpsStat.jsx";
export { OpsEmpty } from "./components/OpsEmpty.jsx";
export { OpsSpinner } from "./components/OpsSpinner.jsx";
export { OpsDataView } from "./components/OpsDataView.jsx";

// ── Märkning ───────────────────────────────────────────────────────────────
export { OpsPill } from "./components/OpsPill.jsx";
export { OpsCountBadge, OpsFelBadge } from "./components/counter.jsx";
export { OpsSprakProvider, useOpsSprak } from "./components/OpsSprak.jsx";
export { ordet } from "./lib/ord.js";
export { OpsCalendar } from "./components/OpsCalendar.jsx";
export { OpsStatusDot } from "./components/OpsStatusDot.jsx";
export { OpsMarkdown } from "./components/OpsMarkdown.jsx";
export { OpsPrompt } from "./components/OpsPrompt.jsx";
export { OpsActivityButton, OpsActivityDetail, OpsActivityList, OpsActivityListActions } from "./components/OpsActivity.jsx";
export { OpsPanel, OpsPanelHeader, OpsPanelRow } from "./components/OpsPanel.jsx";
export { OpsTag } from "./components/OpsTag.jsx";
export { OpsIdentity } from "./components/OpsIdentity.jsx";
export { OpsProvenance } from "./components/OpsProvenance.jsx";
export { OpsRollmarke } from "./components/OpsRollmarke.jsx";
export { OpsFact } from "./components/OpsFact.jsx";

// ── Navigering och meddelanden ─────────────────────────────────────────────
export { OpsTabs, OpsTabPanel } from "./components/OpsTabs.jsx";
export { OpsSegmented } from "./components/OpsSegmented.jsx";
export { OpsFilterChip } from "./components/OpsFilterChip.jsx";
export { OpsFilterPanel } from "./components/OpsFilterPanel.jsx";
export { OpsHelp } from "./components/OpsHelp.jsx";
export { OpsHjalpSida } from "./components/OpsHjalpSida.jsx";
export { GENERELL_HJALP, GENERELL_OMRADEN, GRUND_ID } from "./hjalp/generell.js";
export { hjalpSektioner, sokHjalp, sokAvsnitt, utdrag as hjalpUtdrag, aktivHjalpSektion } from "./hjalp/sok.js";
export { byggModulHjalp, hjalpAnkare, hjalpAdress, lasHjalpAnkare, MAX_HJALP_AVSNITT } from "./lib/modilhjalp.js";
export { OpsControlRow } from "./components/OpsControlRow.jsx";
export { OpsBanner } from "./components/OpsBanner.jsx";
export { OpsToastProvider, useOpsToast } from "./components/OpsToast.jsx";
export { OpsTooltip } from "./components/OpsTooltip.jsx";
export { OpsThemeToggle } from "./components/OpsThemeToggle.jsx";
export { OpsFullscreenToggle } from "./components/OpsFullscreenToggle.jsx";
export { OpsIconLink } from "./components/OpsIconLink.jsx";

// ── Datalager ──────────────────────────────────────────────────────────────
export { createDataSource, applyQuery, OPERATIONS, FALT_BORT, foreVillkor } from "./data/contract.js";
export { createMemorySource, createJsonSource, createMemoryStorage } from "./data/adapters.js";
export { createStorageSource, STORAGE_OPERATIONS } from "./data/storage.js";
export { createRoutingSource } from "./data/routing.js";
export { OpsDataProvider, useDataSource, useCollection, useLiveCollection, useDocument } from "./data/useData.jsx";
export { createFirestoreSource } from "./data/firestore.js";
export { createFirebaseStorageSource } from "./data/firebaseStorage.js";
export { createPostgresSource } from "./data/postgres.js";
export { createHttpSource } from "./data/http.js";

// ── Inloggning ─────────────────────────────────────────────────────────────
export { createAuth, createGoogleAuth, OpsAuthProvider, useOpsAuth, OpsAuthGate } from "./auth/auth.jsx";
export { OpsProfil } from "./components/OpsProfil.jsx";
export { OpsInloggning } from "./components/OpsInloggning.jsx";
// ⛔ #164, ANDRA GRANSKNINGEN: `OpsMeny` EXPORTERAS INTE LÄNGRE. Den hade sin
// EGEN hamburgare, vid sidan av `OpsAppShell`s. Menyn är nu en av
// `OpsAppShell`s inbyggda ytor (propen `meny`), ritad i skalets EGEN
// hamburgare (header-popovern på bred skärm, botten-Meny-arket på smal). Se
// `OpsAppShell.jsx` och `src/components/OpsMeny.jsx` (nu bara delade
// innehålls-byggstenar, inget publikt API).
export { OpsMedlemmar } from "./components/OpsMedlemmar.jsx";
export { OpsUtanMedlemskap } from "./components/OpsUtanMedlemskap.jsx";

// ── Hjälpare ───────────────────────────────────────────────────────────────
export { getTheme, setTheme, initTheme } from "./lib/theme.js";
export { identityTone, initials, IDENTITY_TONE_COUNT } from "./lib/identity.js";
export { urgency, splitTodayUpcoming, daysBetween, daysUntil, collectEvents } from "./lib/events.js";
export { dateKey, todayKey, months, monthGrid, perDay, kalenderfonster, isoVecka, datumOmfang, bandIVecka, filtreraPoster, forvaldKalenderId, EGNA_APPEN, appForTyp, apparFor } from "./lib/calendar.js";
export { readCaseFlow } from "./lib/caseFlow.js";
export { splitMarkdown, splitInline } from "./lib/markdown.js";
export { createPromptSource } from "./lib/prompt.js";
export { createCaseModel } from "./lib/caseModel.js";
export { uppgiftFel, byggUppgift, visaUppgifter } from "./lib/uppgift.js";
export { byggSkapare, laesSkapare, skaparensNamn, arGammalForm, SKAPARTYPER, namnMedVia, byggVia, viaFel, VIAFALT, MAX_NYCKELID, ORD_SKAPARE } from "./lib/skapare.js";

/*
 * ⛔ KATALOGEN OCH SPRÅKEN LIGGER I BÅDA INGÅNGARNA, av samma skäl som
 * `createActivityLog` ovan: konfigurationen läses både av klienten och av det
 * som körs utan skärm. Functions ska kunna fråga vilka sorter som finns utan
 * att dra in React (cllp/bolag-ops#385), och huvudingången kostar 1946 ms mot
 * nodsidans 8 ms, mätt i cllp/ops-framework#93.
 */
export { FASER, AVSLUTADE_FASER, byggKategori, validateKatalog, valjbara, kategorin, arAvslutad, texten, katalognyckel, gruppensRader } from "./lib/katalog.js";
export { SPRAK, RESERVSPRAK, byggNamn, text, arGammalNamn, saknadeSprak } from "./lib/sprak.js";
export { KONFIGHANDELSER, KONFIGLOGGFALT, byggKonfigandring, beskrivKonfigandring, createConfigLog } from "./lib/konfiglogg.js";
export { kopplaBeteenden, beteendet } from "./lib/beteenden.js";

/*
 * ⛔ MODULKONTRAKTET (#128). `defineModule` är data in och data ut, alltså
 * ingen React, så den ligger här av samma skäl som katalogen: ett manifest ska
 * gå att validera av det som körs utan skärm.
 */
export { defineModule, validateModuler, KALLTYPER } from "./lib/modul.js";
export { provaModul, provrapport, GRUPPDATAYTOR, PROV_FRAMMANDE_GRUPP } from "./lib/modulprov.js";
/*
 * Modulernas bidrag till typer (0.42.0, #217): `typer` i `defineModule`, sammanslagningen `bas ∪ bidrag(påslagna)`
 * vid render, ägarens avvikelse (`typavvikelser` på gruppen) och märket «från <modul>».
 */
export { TYPYTOR, MODULTYPAVGRANSARE, MAX_TYPAVVIKELSER, MAX_TYPNAMN, modultypId, delaModultypId, byggTypavvikelser, medAvvikelse, typerForGrupp, bidragForGrupp, typenForRad, typmarke, typensUrsprung, typerTillValg } from "./lib/modultyper.js";
export { arKarna, karnmoduler, medKarna } from "./lib/karna.js";
export { hubbForGrupp, valbaraModuler, hubbPoster, huvudmenyPoster, modulLage, byggOmdirigeringar, omdirigera, kontrolleraOmdirigeringar } from "./lib/hubb.js";
/*
 * Tilläggen (0.60.0, #251, beslut 0003): en app pluggar in i en plats ramverkets yta erbjuder, och ändrar aldrig ytan.
 * `tillagg` i `defineModule`, platserna, filtret på påslagna moduler och raden "Syns på".
 */
export { HANDELSE_PLATSER, INSPELNING_PLATSER, INSTALLNINGAR_PLATSER, PLATSER, PLATSYTOR, tillaggFor, malForInspelning, synsPa, synsPaText } from "./lib/tillagg.js";

/*
 * ⛔ KÄLLKONTRAKTET (#129). Registret och granskarna är data in och data ut,
 * alltså ingen React, och ligger här av samma skäl som manifestet: en modul
 * ska gå att validera av det som körs utan skärm.
 *
 * ⛔ YTORNA ÄR TRE KOMPONENTER OCH INTE TRE HOOKAR I VARJE APP. `OpsEventList`,
 * `OpsHelp` och `OpsKatalogInstallning` fortsätter ta emot data, och
 * kopplingen till registret bor i var sin liten komponent. En primitiv som
 * hämtar går inte att använda med data appen redan har.
 */
export { NOTISPRIO, skapaKallregister } from "./lib/kallor.js";
export { useKallor } from "./data/useKallor.jsx";
export { OpsModulHandelser } from "./components/OpsModulHandelser.jsx";
export { OpsModulHjalp } from "./components/OpsModulHjalp.jsx";
export { OpsModulKataloger } from "./components/OpsModulKataloger.jsx";

/*
 * ⛔ DE TRE YTORNA SOM SAKNADES (#140, #141, #142). Architectens avgränsning
 * av #129: kontraktet först, ytorna som egna ärenden. Alla tre läser ur
 * registret och äger sin egen tomhet, sitt fel och sin väntan.
 */
export { OpsSok } from "./components/OpsSok.jsx";
export { OpsNotiser, olasta } from "./components/OpsNotiser.jsx";
export { OpsOversikt, iOrdning } from "./components/OpsOversikt.jsx";

/*
 * ⛔ SKAPA-KONTRAKTET ÄR SPEGELBILDEN AV KÄLLORNA (#150). Källorna läser in i
 * ramverkets ytor, registreringarna skriver ut ur plusset. Den rena logiken
 * ligger för sig eftersom besluten, vilken grupp och vilka typer, måste gå att
 * mäta utan att en Radix-flikrad ritas i jsdom.
 */
export { OpsSkapa } from "./components/OpsSkapa.jsx";
export { OpsSkapaI } from "./components/OpsSkapaI.jsx";
export { skaparFor, kontrolleraSkaparkataloger, typerAttValja, skapalaget } from "./lib/skapa.js";

/*
 * ⛔ GRUPPER OCH MEDLEMSKAP (#136). Formerna är data in och data ut, och
 * regelfragmentet är text in och text ut, alltså ingen React. De ligger här av
 * samma skäl som katalogen: en grupp måste gå att bygga och validera av det som
 * körs utan skärm, och reglerna genereras av ett skript.
 */
export { ROLLER, MEDLEMSTYPER, MEDLEMSSTATUS, AGENT_NAMN, agentId, agentMedlemskap, INBJUDNINGSSTATUS, TEMAN, MEDLEMSKAPSAVGRANSARE, MAX_PRESENTATION, GRUPPIKONER, GRUPPINITIALER_FORM, MAX_GRUPPBESKRIVNING, MAX_GRUPPORT, EXTERNTYPER, MAX_EXTERNA, MAX_EXTERNREPO, MAX_EXTERNLABEL, MAX_EXTERNHEMLIGHET, INBJUDNING_GILTIGHET_DAGAR, byggAnvandare, byggGrupp, byggExternaDatakallor, byggMedlemskap, byggInbjudan, medlemskapsId } from "./lib/grupp.js";
export { gruppmarkeProps, gruppikonKomponent, ARV_GRUPPIKON, ARV_PROFILIKON, personmarkeProps } from "./lib/gruppikoner.js";
export { personmarke } from "./lib/personmarke.js";
export { gruppikonSvg } from "./lib/gruppikonsvg.js";
export { arGiltigProfilikon } from "./lib/markeformer.js";
export { GRUPPKULORFORSLAG, GRUPPKULOR_FORM, fargTillKulor, kulorTillFarg, gruppKulor, narmasteKulornamn } from "./lib/gruppfarg.js";
export { GRUPPIKON_SVENSKA, gruppikonEtikett } from "./lib/gruppikonnamn.js";
export { GRUPPIKONKATALOG } from "./lib/gruppikonkatalog.generated.js";
export { sokGruppikoner, forslagUrGruppnamn, VANLIGA_GRUPPIKONER } from "./lib/gruppikonsok.js";
export { medlemsinfo } from "./lib/gruppmedlemmar.js";
export { personnamn, NAMN_SAKNAS } from "./lib/personnamn.js";
export { OpsGruppSida } from "./components/OpsGruppSida.jsx";
export { regelfragment, gruppadSamling, generateRules, lagringsregelfragment, katalogregelfragment, konfigloggregelfragment, samtalsregelfragment, kalenderregelfragment, handelseregelfragment, bibliotekregelfragment, minnesregelfragment, modulinstallningsregelfragment, beskrivenappdataregelfragment, beskrivningsregelfragment, delningsregelfragment, gastregelfragment } from "./lib/regler.js";
/*
 * ⛔ MEJLKÖNS REGLER (0.76.0, #101). Text in och text ut, ingen React, och inget
 * beroende till transporten. Fragmentet står för sig: klienten läser inte kön
 * och skriver den inte. Själva kön och utskicket ligger på nodsidan.
 */
export { mejlregelfragment, EPOSTFORM, epostFel } from "./lib/mejl.js";
/*
 * ⛔ KALENDRARNA (0.36.0, #179 F0): gruppens kalendrar (en katalog på typernas motor), mina kalendrar och posterna i
 * dem. Formerna och tidszonen är rena funktioner, och samlingsnamnen skickar appen in till `kalenderregelfragment`.
 */
export { KALENDERFARGER, KALENDERIKONER, KALENDERFALT, MINKALENDERFALT, KALENDERPOSTFALT, MAX_KALENDERNAMN, MAX_POSTTITEL, MAX_POSTBESKRIVNING, MAX_POSTPLATS, STANDARD_TIDSZON, byggGruppkalender, STANDARDKALENDER_ID, STANDARDKALENDER_NAMN, standardGruppkalender, validateGruppkalendrar, forvaldKalender, gruppkalendernyckel, byggMinKalender, validateMinaKalendrar, byggKalenderpost, postTillRad, KALENDERPOST_HANDELSEPREFIX, postHandelseId, postIdUrHandelseId, postTillHandelse, kontrolleraTidszon, idagI, ORDNINGSSTEG, kalenderIdUrNamn, nastaOrdning, flyttaKalender, valjForvald, arkiveraKalender, kalenderval } from "./lib/kalendrar.js";
/*
 * ⛔ FLYTTA EN POST ELLER EN HÄNDELSE TILL EN ANNAN KALENDER (0.123.0, cllp/lifehub.app#371). `flyttmal` svarar på vart något får flyttas och
 * `postensTidsfalt` är postens tid som en händelses fält. Själva flytten är serverns (`createFlyttaService` i `ops-framework/node`).
 */
export { flyttmal, postensTidsfalt } from "./lib/flytta.js";
/*
 * ⛔ KALENDERLAGER (0.90.7). Synligheten är personens, i webbläsarens minne. Färgen är identitetspaletten.
 * Ingen samling och ingen gruppton.
 */
export { lagerNyckel, lasDoldaLager, synligaLager, lagerFarg } from "./lib/kalenderlager.js";
/*
 * ⛔ KALENDRARNA SOM EN LISTA, ETT MINNE (0.134.0, cllp/lifehub.app#402). Vilka kalendrar som syns och hur de visas (Händelser, Ram eller Båda) är personens val per grupp, i ETT minne.
 * `OpsCalendar kalenderMinne` använder det själv; en vy som ska följa samma val (Idag) kallar `useKalenderSynlighet` med samma `minne` och samma `kalendrar`. Lagret ovan är föråldrat.
 */
export { KALENDERVISNINGAR, FORVALD_KALENDERVISNING, kalenderSynlighetNyckel, lasKalenderSynlighet, skrivKalenderSynlighet, arKalenderSynlig, kalenderVisning, vaxlaKalenderSynlighet, sattKalenderVisning, aterstallKalenderSynlighet, synligaKalenderRader, arForvaldSynlighet } from "./lib/kalendersynlighet.js";
export { useKalenderSynlighet } from "./lib/useKalenderSynlighet.js";
/*
 * ⛔ TILLGÄNGLIGHETEN (0.61.0, #259 skiva 1): vem i gruppen som är borta eller upptagen en dag, härledd ur posterna och aldrig
 * lagrad. En post med läget `dold` räknas inte alls. Hörnbrickan i `OpsCalendar` får `bortaAntal` via `dagdekor`.
 */
export { tillganglighetForDag, bortaAntal } from "./lib/tillganglighet.js";
/*
 * ⛔ HANTERA KALENDRAR OCH HÄNDELSEMODELLEN (0.37.0, #179 F2 och F3): hanteringen (`OpsKalendrar`), källan som läser och
 * skriver kalendrarna, kontraktet för en händelse i en kalender, och svaren Kommer / Kommer inte med inkorgens rader
 * härledda ur händelserna och svaren.
 */
export { OpsKalendrar } from "./components/OpsKalendrar.jsx";
export { OpsSvar, OpsSvarSummor, OpsSvarsknappar, OpsSvarsrad, ORD_OPSSVAR } from "./components/OpsSvar.jsx";
export { OpsKommentarer, OpsKommentarsrad, ORD_OPSKOMMENTARER, ORD_OPSKOMMENTARSRAD } from "./components/OpsKommentarer.jsx";
/*
 * ⛔ HÄNDELSEPANELEN (0.40.0, #214): en händelse på en egen sida med Tillbaka, öppnad av en rad i Idag (`OpsEventList`) eller en post i kalenderns
 * dagpanel (`OpsCalendar`) som bär `handelseId`. Skalet äger adressen (`?handelse=<id>`) och Tillbaka (`OpsAppShell` `handelsepanel`), appen ritar
 * panelen ur sin egen källa med `OpsHandelsePanel` och sätter `svar` till sitt `OpsSvar`.
 */
export { OpsHandelsePanel } from "./components/OpsHandelsePanel.jsx";
/* (0.121.0, cllp/lifehub.app#366) En händelses filer: sektionen "Filer", `OpsBibliotek` inbäddad för händelsens plats. Appen skickar den som `filer` till panelen. */
export { OpsHandelsefiler, ORD_OPSHANDELSEFILER } from "./components/OpsHandelsefiler.jsx";
export { OpsPlatsfiler, ORD_OPSPLATSFILER } from "./components/OpsPlatsfiler.jsx";
export { HANDELSEPARAM, handelseHref } from "./lib/handelsepanel.js";
/*
 * ⛔ EN RAD, EN PANEL (0.145.0, cllp/ops-framework#446): varje rad i kalendern och Idag öppnas i samma panel, med en knapprad som alltid står på samma ställe och Dela på alla rader.
 * Radens id har formen `<källa>:<id>` (`byggRadId`, `lasRadId`). Appen anger källorna som ett manifest (`radkallor` på `OpsAppShell`, eller på `OpsCalendar` och `OpsEventList`), ramverket äger id-formen,
 * panelen (`OpsRadPanel`) och knappradens plats, och vet aldrig vad Ekonomi eller GitHub är. Se `lib/radkallor.js`.
 */
export { byggRadId, lasRadId } from "./lib/radkallor.js";
export { OpsRadPanel } from "./components/OpsRadPanel.jsx";
export { createKalenderkalla, createSvarskalla, createKommentarkalla } from "./data/kalenderkalla.js";
export { HANDELSEKONTRAKT, DATUM_EJ_SATT, SVARSVAL, SVARSFALT, handelsefel, handelsensKalenderId, handelsensDagar, byggSvar, sammanstallSvar, harPasserat, svarsrader, KOMMENTARFALT, MAX_HANDELSEKOMMENTAR, KOMMENTARBILAGA_TYPER, MAX_KOMMENTARBILAGA, MAX_BILAGENAMN, KOMMENTARBILAGAFALT, kommentarbilagaFel, LASMARKESFALT, byggKommentar, kommentarsrader } from "./lib/handelsemodell.js";

/*
 * ⛔ GRUPPLÄGET (#139, #190). Besluten är rena funktioner och ligger därför här:
 * vilken grupp som är aktiv och vad navet visar måste gå att prova utan en skärm.
 *
 * ⛔ 0.35.0: DET FINNS ALLTID EXAKT EN AKTIV GRUPP, OCH VARJE LÄSVÄG GÄLLER BARA
 * DEN. Läget "Alla mina grupper" och läsningen över flera grupper är borttagna
 * (`ALLA_GRUPPER`, `valtLage`, `navForLage`, `gruppenAttSkapaI`, `grupperAttFraga`,
 * `slaIhopSvar`, `listaPerGrupp`, `raderPerGrupp`, `OpsGruppfilter`,
 * `OpsGruppmarke`). `medAktivGrupp` lägger den aktiva gruppen på list, subscribe
 * och read.
 *
 * ⛔ `gruppLista` OCH `gruppSkapa` KRÄVER `groupId`, och det är ett typkrav som
 * `check-gruppfraga` bevisar genom att köra tsc mot en fråga utan grupp.
 */
export { minaGrupper, aktivGrupp, navForGrupp, grupplagetsNyckel, lasAktivGrupp, sparaAktivGrupp } from "./lib/grupplage.js";
export { gruppLista, gruppSkapa } from "./data/gruppkalla.js";
export { medAktivGrupp } from "./data/aktivgrupp.js";
export { OpsGruppvaljare } from "./components/OpsGruppvaljare.jsx";
export { OpsGruppanel, OpsGruppvaxlare, ORD_OPSOVERSIKT } from "./components/OpsGruppanel.jsx";
export { OpsHubblista } from "./components/OpsHubbar.jsx";
export { OpsGruppFormular } from "./components/OpsGruppFormular.jsx";
export { sakerstallAnvandare, sparaInstallningar, andringen } from "./lib/profil.js";
export { createCatalogSource } from "./data/katalogkalla.js";
export { BIBLIOTEKTYPER, anteckningsrubrikNu, BIBLIOTEKFLIKAR, BIBLIOTEKFALT, FILFALT, FILMIME, MAX_BIBLIOTEKRUBRIK, MAX_BIBLIOTEKTEXT, MAX_BIBLIOTEKURL, MAX_BIBLIOTEKFIL, MAX_BIBLIOTEKLJUD, filTak, mimeUrFilnamn, MAX_BIBLIOTEKFILNAMN, MAX_BIBLIOTEKSOKVAG, MAX_BIBLIOTEKUTSKRIFT, IDE_MAX_SEKUNDER, LJUD_STOLPAR, MAX_LJUD_MS, ADRESSFORM, inmatningsfel, filInmatningsfel, filFel, filSort, LJUDFIL_ACCEPT, ljudfilFel, arLjudpost, arDelbar, filMimeMonster, normaliseraMime, utskriftFel, ideRubrik, ljudRubrik, ljudDatum, peaksGiltiga, kodaToppar, avkodaToppar, ljudMetaFel, postFel, byggPost, filtreraBibliotek, normaliseraAdress, farAndra, MAX_TAGGAR, MAX_TAGGLANGD, TAGGFORM, normaliseraTagg, normaliseraTaggar, taggarFel, allaTaggar, taggfarg, TAGGFARGER, MITT_PREFIX, MITTFORM, mittBibliotek, arMittBibliotek, mittJag, HANDELSE_PREFIX, HANDELSEIDFORM, HANDELSEFORM, handelseBibliotek, arHandelseBibliotek, handelsedelar, ARENDE_PREFIX, ARENDEIDFORM, ARENDEFORM, arendeBibliotek, arArendeBibliotek, arendedelar, arObjektbibliotek, gruppForPlats, MAX_LISTPOSTER, POSTIDFORM, BILDFORM, listaFel } from "./lib/bibliotek.js";
/* (0.128.0, cllp/lifehub.app#378) Smart länk och listor i Biblioteket: källan ur adressen, rubriken ur titel och artist, och en listas rader mot platsens poster. */
export { LANKKALLOR, KALLOR, lankKalla, lankKallnamn, lankRubrik, lankkallaForm } from "./lib/lankkalla.js";
export { LISTRADTEXT, LISTA_I_LISTA_TEXT, LISTA_FLYTT_TEXT, losLista, listorAttLaggaI, kandidaterForLista, laggTillPost, taBortPost } from "./lib/biblioteklista.js";
export { createBibliotekskalla, flyttaBibliotekspost } from "./data/bibliotekkalla.js";
export { OpsBibliotek } from "./components/OpsBibliotek.jsx";
export { OpsTaggPiller, OpsTaggRad, OpsTaggFilter } from "./components/OpsTaggar.jsx";
// 0.119.0 (lifehub.app#356): publik delning av en biblioteksfil. Vyn och det den delar med servern. Tokenet och tjänsten ligger i `ops-framework/node`.
export { OpsDelad } from "./components/OpsDelad.jsx";
// 0.125.0 (lifehub.app#377): samma delning för en händelse, med en läsbar adress (`/g/<grupp>/event/<händelse>` och `/g/<grupp>/lib/<fil>`), en valfri kod och en publik sida med eget huvud och språkval.
export { OpsDeladHandelse, ORD_OPSDELADHANDELSE } from "./components/OpsDeladHandelse.jsx";
export { ORD_DELADKOD } from "./components/DeladKod.jsx";
export { ORD_DELALANK } from "./components/DelaLankFalt.jsx";
export { ORD_LANKRAD } from "./components/LankRad.jsx";
export { ORD_HANDELSEDELNING } from "./components/HandelseDelning.jsx";
export { ORD_MEJLALANK } from "./components/MejlaLank.jsx";
export { DELAD_SPRAKNYCKEL, webblasarSprak, valdSprak, lasSparatSprak, sparaSprak, kortDatum, antalDagar, deladTid } from "./lib/deladdatum.js";
export { DELNINGSDAGAR, FORVAL_DELNINGSDAGAR, HANDELSEDAGAR, FORVAL_HANDELSEDAGAR, SIGNERAD_SEKUNDER, TOKENFORM, DELNINGSSLAG, DELNINGSRATTIGHETER, DELNINGSFALT, ADRESSPREFIX, ADRESSSEGMENT, ADRESSDELFORM, MAX_ADRESSDEL, MAX_ADRESSDEL_TOTALT, SLUMPSLUT_TECKEN, SLUMPSLUTFORM, KODLANGD, FELKOD_MAX, FELKOD_FONSTER_MS, adressdel, arAdressdel, nastaAdressdel, foreslaAdress, byggAdress, tolkaAdress, delningsSokvag, delningsUrl, adressUrUppslag, kodFel, normaliseraKod, DELNINGSORSAKER, DELNINGSFEL, DELNINGSFELKODER, DELNINGSSVARSFALT, HANDELSESVARSFALT, HANDELSEFILFALT, MAX_HANDELSEFILER, ANTECKNINGSSVARSFALT, LANKSVARSFALT, LISTSVARSFALT, LISTRADSNYCKEL, LISTRADSKAL, MAX_DELADE_LISTPOSTER, delningsTyp, delningsfel } from "./lib/delning.js";
/*
 * 0.131.0 (cllp/lifehub.app#389): gäster. En gäst är en inbjudan och aldrig ett konto eller ett medlemskap. Konstanterna, formerna, texterna och `gastId` ligger här (vyn och reglerna läser dem),
 * nyckeln, sessionen och tjänsten i `ops-framework/node`. Vyerna: medlemmens lista och gästens egen sida.
 */
export {
  GAST_PLATSER_GRATIS, GASTSLAG, GASTFUNKTIONER, GASTLANKDAGAR, GASTSESSIONSDAGAR, GASTFEL_MAX, GASTFEL_FONSTER_MS, GASTIP_MAX, GASTIP_FONSTER_MS, GASTNYLANKIP_MAX, GASTNYLANKIP_FONSTER_MS,
  GASTNYLANK_BREV_PER_DYGN, GASTNYLANK_MAX_LANKAR, MAX_GASTNAMN, MAX_GASTEPOST, GASTNYCKELFORM, GASTINBJUDNINGSIDFORM, GASTIDFORM, GASTSOKVAG, GASTFALT, GASTLISTFALT, GASTSVARSFALT,
  GASTORSAKER, GASTFEL, GASTFELKODER, GASTNYLANK_SVAR, GASTSTATUSAR, GASTPLATSNUMMER, normaliseraGastepost, gastId, gastomfangsnyckel, gastplatsId, gastLank, tolkaGastLank, gastStatus,
  GASTGRUPPFUNKTIONER, GASTARENDE_MAX, GASTARENDE_SKANNA_MAX, GASTARENDEKOMMENTARER_MAX, GASTARENDEFALT, GASTARENDEKOMMENTARFALT, byggGastMottagare, gastDelegerad, tolkaGastMottagare, GASTCHATT_SIDA, GASTKALENDER_MAX, GASTBIBLIOTEK_MAX, GASTANROP_PER_MINUT, GASTFIL_PER_DYGN, GASTGRUPPSVARSFALT, GASTCHATTFALT, GASTHANDELSEFALT, GASTKALENDERFALT, GASTFILFALT, GASTBIBLIOTEKFALT, GASTPERSONFALT, GASTPERSONINBJUDANFALT, GASTTIDIGAREMEDLEM, arGastId, GASTNAMNLOS, GASTSKRIV_MAX_TECKEN, GASTSKRIV_PER_MINUT, GASTGRUPPATGARDER, gastOmfangGer, gastGruppApi,
} from "./lib/gast.js";
export { OpsGastLista, ORD_OPSGASTLISTA } from "./components/OpsGastLista.jsx";
export { OpsGastSida, ORD_OPSGASTSIDA } from "./components/OpsGastSida.jsx";
/*
 * 0.132.0 (cllp/lifehub.app#389, skiva 2): hela gruppen. Gästens bantade gränssnitt (`OpsGastGrupp`: chatt, kalender, ärenden, bibliotek) och dess delar. `OpsSvarSummor` är svaren som summor, för den som
 * inte får se vem som svarat.
 */
export { OpsGastGrupp, ORD_OPSGASTGRUPP } from "./components/OpsGastGrupp.jsx";
export { OpsGastChatt, ORD_OPSGASTCHATT } from "./components/OpsGastChatt.jsx";
export { OpsGastArenden, ORD_OPSGASTARENDEN } from "./components/OpsGastArenden.jsx";
export { OpsGastMottagare, ORD_OPSGASTMOTTAGARE } from "./components/OpsGastMottagare.jsx";
export { MINNESKALLOR, MINNESFALT, MINNESKALLAFALT, MAX_MINNESTEXT, MAX_MINNESID, farAndraMinne, minnesradFel, byggMinnesrad } from "./lib/minne.js";
export { createMinneskalla } from "./data/minneskalla.js";
export { OpsMinne } from "./components/OpsMinne.jsx";
export { OpsKatalogInstallning } from "./components/OpsKatalogInstallning.jsx";
export { OpsModulTyper } from "./components/OpsModulTyper.jsx";
export { OpsInstallningar, ORD_OPSINSTALLNINGAR, useInstallningspanel } from "./components/OpsInstallningar.jsx";
export { installningsSektioner } from "./components/installningsSektioner.jsx";
/*
 * ⛔ MODULENS INSTÄLLNINGAR (0.88.0, en plats 0.89.0). Pinnen "Visa i huvudmenyn" skrivs på gruppen.
 * Modulens egna fält skrivs i en samling appen namnger. Reglagen ritas i modulramen, inte i gruppvyn.
 */
export { VISA_I_HUVUDMENYN, sattHuvudmeny, huvudmenyInom, installningarFor, installningsVarden } from "./lib/modulinstallningar.js";
export { createModulinstallningskalla } from "./data/modulinstallningskalla.js";
export { OpsModulInstallningar, ORD_OPSMODULINSTALLNINGAR } from "./components/OpsModulInstallningar.jsx";
/*
 * ⛔ BESKRIVNA APPAR, BYGGSÄTT A (0.99.0, beslut 0005, lifehub.app#213). En app är en beskrivning, motorn ritar och sparar den. Modellen
 * (`validateBeskrivning`, `validateRad` och taken) ligger OCKSÅ i `ops-framework/node`, så appens Cloud Functions validerar med samma funktion.
 */
export {
  BESKRIVNINGSFORMAT, FALTTYPER, VISNINGAR, BESKRIVNINGSIDFORM, MAX_BESKRIVNINGSNAMN, MAX_APPBESKRIVNING, MIN_LISTOR, MAX_LISTOR, MIN_FALT, MAX_FALT, MIN_VAL, MAX_VAL, MAX_VALTEXT,
  MAX_TEXTVARDE, MAX_LANGTEXTVARDE, MAX_LANKVARDE, BESKRIVNINGSFALT, LISTFALT, FALTFALT, BESKRIVENAPPDATAFALT, BESKRIVNINGSDOKUMENTFALT,
  validateBeskrivning, validateRad, beskrivningsId, byggBeskrivningsdokument,
} from "./lib/beskrivenapp.js";
export { createBeskrivenAppKalla, createBeskrivningskalla } from "./data/beskrivenappkalla.js";
export { OpsBeskrivenApp, ORD_OPSBESKRIVENAPP } from "./components/OpsBeskrivenApp.jsx";
/*
 * ⛔ SAMTALEN (0.34.0, #182, #185): gruppchatt, privata meddelanden och Assistent-tråden som EN modell. Formerna och
 * nyckeln är rena funktioner, källan går genom en datakälla, och Firebase importeras aldrig här.
 */
export { SAMTALSSLAG, SAMTALSFALT, MEDDELANDEFALT, LASTFALT, MAX_MEDDELANDE, MOTTAGARSLAG, ARENDEMOTTAGARSLAG, samtalsnyckel, byggSamtal, byggMeddelande, byggMottagare, byggArendemottagare, olastaI, motpart, utdrag, TRADFALT, MAX_TRADNAMN, AUTONAMN_LANGD, AUTONAMN_MINST, NAMNLOS_TRAD, rensaForNamn, autonamn, tradensNamn, byggTrad, kravTradnamn, undersamlingskrock, AGENTSTATUS_ID, AGENTLAGEN, AGENTSTATUSFALT, AGENTSTATUS_MAX_ALDER, byggAgentstatus, agentstatus, REAKTIONSKODER, REAKTIONSFALT, REAKTIONSTAK, reaktionsnyckel, byggReaktion, summeraReaktioner, NAMNERFALT, NAMNER_ALLA, MAX_NAMNER, MAX_UIDLANGD, kravNamner, namnda, arNamnd, agentenNamnd, SVARPAFALT, FASTFALT, FASTA_TAK, byggFastning, AMNESFALT, AMNES_FORM, MAX_AMNESRUBRIK, NAMNLOST_AMNE, kravAmne, nyttAmnesId, amnesId, parnyckel, kravAmnesrubrik, amnesrubrik } from "./lib/samtal.js";
export { createSamtalskalla, samtalsnotiser, harTradar, harStatus, harReaktioner, harOmnamnanden, harCitat, harFasta, harBilagor, harTyst, harAmnen, harLevandeInkorg } from "./data/samtalskalla.js";
export { useSamtal } from "./data/useSamtal.jsx";
export { OpsMottagare } from "./components/OpsMottagare.jsx";
export { OpsMeddelanden, OpsSamtal, OpsMeddelandeLank, OpsTrad } from "./components/OpsMeddelanden.jsx";
export { OpsChattinfo } from "./components/OpsChattinfo.jsx";
export { STATUS_TONES, statusTone } from "./lib/statusTone.js";
export { createActivityLog, unreadCount, isUnread, unread, unreadRows, activityId, activityWindow, groupByDay, ACTIVITY_RESULTS, ACTIVITY_SECTIONS } from "./lib/aktivitet.js";
export { formatCurrency, formatNumber, formatPercent, formatDate, formatDateTime, formatDagOchKlockslag, formatRelativeDate, NUMBER_SPACE, MISSING } from "./lib/format.js";

/*
 * ⛔ #159: FELGRÄNSEN, LOGGPUNKTEN OCH KONTRAKTET. `rapporteraFel` är
 * loggpunkten alla ytor kan använda (felgränsen i `OpsAppShell` gör det
 * automatiskt). `Felmottagare`-kontraktet är bara en JSDoc-typedef och
 * exporteras inte som ett värde, det finns ingenting att köra. En färdig
 * mottagare (Sentry) ligger i en EGEN ingång, `ops-framework/sentry`,
 * så beroendet bara laddas av den app som väljer det. Se `src/sentry.js`.
 */
/*
 * ⛔ (0.107.0, lifehub.app#253) `registreraFelmottagare` gör appens mottagare förvald för varje `rapporteraFel` utan eget
 * tredje argument. `OpsAuthProvider` och `OpsAppShell` med `felmottagare` gör det själva; funktionen är för en app som inte
 * använder någon av dem.
 */
export { rapporteraFel, registreraFelmottagare } from "./lib/felrapport.js";

// ⛔ UTSKRIFTENS LÄGE PÅ POSTEN (0.133.0, lifehub.app#349). Rena filen delas med servern (`ops-framework/node`), så att fälten som rensas och tiden ett jobb får leva har ETT hem.
export { UTSKRIFT_FALT, UTSKRIFT_TAK_MS, UTSKRIFT_TIMEOUT_TEXT, UTSKRIFTJOBB_STATUS, UTSKRIFT_VANTETID_MS, UTSKRIFT_UPPSKATTNING, utskriftLage, uppskattadUtskriftstid, utskriftPagatText, utanUtskrift } from "./lib/utskrift.js";
