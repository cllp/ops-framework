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
export { OpsAppShell, useOppnaSkapa, useOppnaHandelse } from "./components/OpsAppShell.jsx";
export { OpsBottomNav } from "./components/OpsBottomNav.jsx";
// 0.57.0, cllp/lifehub.app#2: långtryck på plusset spelar in. Skalet kopplar in dem med `talk`, de är publika för den som bygger egen rad.
export { OpsTalk, useTalk, TALK_PRICKAR } from "./components/OpsTalk.jsx";
export { LANGTRYCK_MS, TALK_ORD, MAX_SEKUNDER, LJUDFORMAT, talkNasta, valjFormat, talkFeltext, webblasarensInspelare } from "./lib/talk.js";
export { OpsHub, OpsHubModul, OpsHubTillbaka, OpsGruppHubb } from "./components/OpsHub.jsx";
export { OpsModulSida } from "./components/OpsModulSida.jsx";
export { OpsBrand } from "./components/OpsBrand.jsx";

// ── Åtgärder och ytor ──────────────────────────────────────────────────────
export { OpsButton } from "./components/OpsButton.jsx";
export { OpsCard } from "./components/OpsCard.jsx";
export { OpsView, OpsViewHeader } from "./components/OpsView.jsx";
export { OpsModal } from "./components/OpsModal.jsx";
export { OpsDisclosure } from "./components/OpsDisclosure.jsx";
// #157: sektionsrubrik och chip, mätta ur SessionStudios ProfileView.
export { OpsSectionLabel } from "./components/OpsSectionLabel.jsx";
export { OpsChip } from "./components/OpsChip.jsx";

// ── Formulär ───────────────────────────────────────────────────────────────
export { OpsField, OpsInput, OpsTextarea } from "./components/OpsField.jsx";
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
// ⛔ `readAttachment` och `MAX_SIDE` exporteras MED FLIT inte. En app som läser filer
// själv har gått runt komponenten, och då finns två ställen som bestämmer vad som
// ryms. `isImage` och `sizeText` behövs för att VISA en sparad bilaga, alltså
// på andra sidan lagringen, där komponenten inte finns.
export { isImage, sizeText, attachmentSize } from "./lib/file.js";

// ── Data ───────────────────────────────────────────────────────────────────
export { OpsList, OpsListRow } from "./components/OpsList.jsx";
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
export { OpsControlRow } from "./components/OpsControlRow.jsx";
export { OpsBanner } from "./components/OpsBanner.jsx";
export { OpsToastProvider, useOpsToast } from "./components/OpsToast.jsx";
export { OpsTooltip } from "./components/OpsTooltip.jsx";
export { OpsThemeToggle } from "./components/OpsThemeToggle.jsx";
export { OpsFullscreenToggle } from "./components/OpsFullscreenToggle.jsx";
export { OpsIconLink } from "./components/OpsIconLink.jsx";

// ── Datalager ──────────────────────────────────────────────────────────────
export { createDataSource, applyQuery, OPERATIONS, FALT_BORT } from "./data/contract.js";
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
export { byggSkapare, laesSkapare, skaparensNamn, arGammalForm, SKAPARTYPER } from "./lib/skapare.js";

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
export { hubbForGrupp, valbaraModuler, hubbPoster, modulLage, byggOmdirigeringar, omdirigera, kontrolleraOmdirigeringar } from "./lib/hubb.js";
/*
 * Tilläggen (0.60.0, #251, beslut 0003): en app pluggar in i en plats ramverkets yta erbjuder, och ändrar aldrig ytan.
 * `tillagg` i `defineModule`, platserna, filtret på påslagna moduler och raden "Syns på".
 */
export { HANDELSE_PLATSER, PLATSER, PLATSYTOR, tillaggFor, synsPa, synsPaText } from "./lib/tillagg.js";

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
export { gruppmarkeProps, gruppikonKomponent, ARV_GRUPPIKON } from "./lib/gruppikoner.js";
export { GRUPPKULORFORSLAG, GRUPPKULOR_FORM, fargTillKulor, kulorTillFarg, gruppKulor, narmasteKulornamn } from "./lib/gruppfarg.js";
export { GRUPPIKON_SVENSKA, gruppikonEtikett } from "./lib/gruppikonnamn.js";
export { GRUPPIKONKATALOG } from "./lib/gruppikonkatalog.generated.js";
export { sokGruppikoner, forslagUrGruppnamn, VANLIGA_GRUPPIKONER } from "./lib/gruppikonsok.js";
export { medlemsinfo } from "./lib/gruppmedlemmar.js";
export { personnamn, NAMN_SAKNAS } from "./lib/personnamn.js";
export { OpsGruppSida } from "./components/OpsGruppSida.jsx";
export { regelfragment, gruppadSamling, generateRules, lagringsregelfragment, katalogregelfragment, konfigloggregelfragment, samtalsregelfragment, kalenderregelfragment, handelseregelfragment } from "./lib/regler.js";
/*
 * ⛔ KALENDRARNA (0.36.0, #179 F0): gruppens kalendrar (en katalog på typernas motor), mina kalendrar och posterna i
 * dem. Formerna och tidszonen är rena funktioner, och samlingsnamnen skickar appen in till `kalenderregelfragment`.
 */
export { KALENDERFARGER, KALENDERIKONER, KALENDERFALT, MINKALENDERFALT, KALENDERPOSTFALT, MAX_KALENDERNAMN, MAX_POSTTITEL, MAX_POSTBESKRIVNING, MAX_POSTPLATS, STANDARD_TIDSZON, byggGruppkalender, validateGruppkalendrar, forvaldKalender, gruppkalendernyckel, byggMinKalender, validateMinaKalendrar, byggKalenderpost, postTillRad, kontrolleraTidszon, idagI, ORDNINGSSTEG, kalenderIdUrNamn, nastaOrdning, flyttaKalender, valjForvald, arkiveraKalender, kalenderval } from "./lib/kalendrar.js";
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
export { OpsSvar, OpsSvarsknappar, OpsSvarsrad } from "./components/OpsSvar.jsx";
export { OpsKommentarer, OpsKommentarsrad, ORD_OPSKOMMENTARER, ORD_OPSKOMMENTARSRAD } from "./components/OpsKommentarer.jsx";
/*
 * ⛔ HÄNDELSEPANELEN (0.40.0, #214): en händelse på en egen sida med Tillbaka, öppnad av en rad i Idag (`OpsEventList`) eller en post i kalenderns
 * dagpanel (`OpsCalendar`) som bär `handelseId`. Skalet äger adressen (`?handelse=<id>`) och Tillbaka (`OpsAppShell` `handelsepanel`), appen ritar
 * panelen ur sin egen källa med `OpsHandelsePanel` och sätter `svar` till sitt `OpsSvar`.
 */
export { OpsHandelsePanel } from "./components/OpsHandelsePanel.jsx";
export { HANDELSEPARAM, handelseHref } from "./lib/handelsepanel.js";
export { createKalenderkalla, createSvarskalla, createKommentarkalla } from "./data/kalenderkalla.js";
export { HANDELSEKONTRAKT, SVARSVAL, SVARSFALT, handelsefel, handelsensKalenderId, handelsensDagar, byggSvar, sammanstallSvar, harPasserat, svarsrader, KOMMENTARFALT, MAX_HANDELSEKOMMENTAR, KOMMENTARBILAGA_TYPER, MAX_KOMMENTARBILAGA, MAX_BILAGENAMN, KOMMENTARBILAGAFALT, kommentarbilagaFel, LASMARKESFALT, byggKommentar, kommentarsrader } from "./lib/handelsemodell.js";

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
export { OpsGruppanel, OpsGruppvaxlare } from "./components/OpsGruppanel.jsx";
export { OpsHubblista } from "./components/OpsHubbar.jsx";
export { OpsGruppFormular } from "./components/OpsGruppFormular.jsx";
export { sakerstallAnvandare, sparaInstallningar, andringen } from "./lib/profil.js";
export { createCatalogSource } from "./data/katalogkalla.js";
export { OpsKatalogInstallning } from "./components/OpsKatalogInstallning.jsx";
export { OpsModulTyper } from "./components/OpsModulTyper.jsx";
/*
 * ⛔ SAMTALEN (0.34.0, #182, #185): gruppchatt, privata meddelanden och Assistent-tråden som EN modell. Formerna och
 * nyckeln är rena funktioner, källan går genom en datakälla, och Firebase importeras aldrig här.
 */
export { SAMTALSSLAG, SAMTALSFALT, MEDDELANDEFALT, LASTFALT, MAX_MEDDELANDE, MOTTAGARSLAG, samtalsnyckel, byggSamtal, byggMeddelande, byggMottagare, olastaI, motpart, utdrag, TRADFALT, MAX_TRADNAMN, AUTONAMN_LANGD, AUTONAMN_MINST, NAMNLOS_TRAD, rensaForNamn, autonamn, tradensNamn, byggTrad, kravTradnamn } from "./lib/samtal.js";
export { createSamtalskalla, samtalsnotiser, harTradar } from "./data/samtalskalla.js";
export { useSamtal } from "./data/useSamtal.jsx";
export { OpsMottagare } from "./components/OpsMottagare.jsx";
export { OpsMeddelanden, OpsSamtal, OpsMeddelandeLank, OpsTrad } from "./components/OpsMeddelanden.jsx";
export { STATUS_TONES, statusTone } from "./lib/statusTone.js";
export { createActivityLog, unreadCount, isUnread, unread, unreadRows, activityId, activityWindow, groupByDay, ACTIVITY_RESULTS, ACTIVITY_SECTIONS } from "./lib/aktivitet.js";
export { formatCurrency, formatNumber, formatPercent, formatDate, formatDateTime, formatRelativeDate, NUMBER_SPACE, MISSING } from "./lib/format.js";

/*
 * ⛔ #159: FELGRÄNSEN, LOGGPUNKTEN OCH KONTRAKTET. `rapporteraFel` är
 * loggpunkten alla ytor kan använda (felgränsen i `OpsAppShell` gör det
 * automatiskt). `Felmottagare`-kontraktet är bara en JSDoc-typedef och
 * exporteras inte som ett värde, det finns ingenting att köra. En färdig
 * mottagare (Sentry) ligger i en EGEN ingång, `ops-framework/sentry`,
 * så beroendet bara laddas av den app som väljer det. Se `src/sentry.js`.
 */
export { rapporteraFel } from "./lib/felrapport.js";
