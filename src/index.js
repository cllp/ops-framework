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
export { OpsAppShell } from "./components/OpsAppShell.jsx";
export { OpsBottomNav } from "./components/OpsBottomNav.jsx";
export { OpsBrand } from "./components/OpsBrand.jsx";

// ── Åtgärder och ytor ──────────────────────────────────────────────────────
export { OpsButton } from "./components/OpsButton.jsx";
export { OpsCard } from "./components/OpsCard.jsx";
export { OpsView, OpsViewHeader } from "./components/OpsView.jsx";
export { OpsModal } from "./components/OpsModal.jsx";
export { OpsDisclosure } from "./components/OpsDisclosure.jsx";

// ── Formulär ───────────────────────────────────────────────────────────────
export { OpsField, OpsInput, OpsTextarea } from "./components/OpsField.jsx";
export { OpsSelect } from "./components/OpsSelect.jsx";
export { OpsDatePicker } from "./components/OpsDatePicker.jsx";
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
export { OpsCountBadge } from "./components/counter.jsx";
export { OpsCalendar } from "./components/OpsCalendar.jsx";
export { OpsStatusDot } from "./components/OpsStatusDot.jsx";
export { OpsMarkdown } from "./components/OpsMarkdown.jsx";
export { OpsPrompt } from "./components/OpsPrompt.jsx";
export { OpsActivityButton, OpsActivityDetail, OpsActivityList } from "./components/OpsActivity.jsx";
export { OpsPanel, OpsPanelHeader, OpsPanelRow } from "./components/OpsPanel.jsx";
export { OpsTag } from "./components/OpsTag.jsx";
export { OpsIdentity } from "./components/OpsIdentity.jsx";
export { OpsProvenance } from "./components/OpsProvenance.jsx";
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
export { createDataSource, applyQuery, OPERATIONS } from "./data/contract.js";
export { createMemorySource, createJsonSource } from "./data/adapters.js";
export { createRoutingSource } from "./data/routing.js";
export { OpsDataProvider, useDataSource, useCollection, useLiveCollection, useDocument } from "./data/useData.jsx";
export { createFirestoreSource } from "./data/firestore.js";
export { createPostgresSource } from "./data/postgres.js";
export { createHttpSource } from "./data/http.js";

// ── Inloggning ─────────────────────────────────────────────────────────────
export { createAuth, createGoogleAuth, OpsAuthProvider, useOpsAuth, OpsAuthGate } from "./auth/auth.jsx";
export { OpsProfil } from "./components/OpsProfil.jsx";
export { OpsAnvandarmeny } from "./components/OpsAnvandarmeny.jsx";
export { OpsMedlemmar } from "./components/OpsMedlemmar.jsx";
export { OpsUtanMedlemskap } from "./components/OpsUtanMedlemskap.jsx";

// ── Hjälpare ───────────────────────────────────────────────────────────────
export { getTheme, setTheme, initTheme } from "./lib/theme.js";
export { identityTone, initials, IDENTITY_TONE_COUNT } from "./lib/identity.js";
export { urgency, splitTodayUpcoming, daysBetween, daysUntil, collectEvents } from "./lib/events.js";
export { dateKey, todayKey, months, monthGrid, perDay } from "./lib/calendar.js";
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
export { FASER, AVSLUTADE_FASER, byggKategori, validateKatalog, valjbara, kategorin, arAvslutad, texten } from "./lib/katalog.js";
export { SPRAK, RESERVSPRAK, byggNamn, text, arGammalNamn, saknadeSprak } from "./lib/sprak.js";
export { KONFIGHANDELSER, byggKonfigandring, beskrivKonfigandring, createConfigLog } from "./lib/konfiglogg.js";
export { kopplaBeteenden, beteendet } from "./lib/beteenden.js";

/*
 * ⛔ MODULKONTRAKTET (#128). `defineModule` är data in och data ut, alltså
 * ingen React, så den ligger här av samma skäl som katalogen: ett manifest ska
 * gå att validera av det som körs utan skärm.
 */
export { defineModule, validateModuler, KALLTYPER } from "./lib/modul.js";

/*
 * ⛔ GRUPPER OCH MEDLEMSKAP (#136). Formerna är data in och data ut, och
 * regelfragmentet är text in och text ut, alltså ingen React. De ligger här av
 * samma skäl som katalogen: en grupp måste gå att bygga och validera av det som
 * körs utan skärm, och reglerna genereras av ett skript.
 */
export { ROLLER, MEDLEMSTYPER, MEDLEMSSTATUS, INBJUDNINGSSTATUS, TEMAN, MEDLEMSKAPSAVGRANSARE, byggAnvandare, byggGrupp, byggMedlemskap, byggInbjudan, medlemskapsId } from "./lib/grupp.js";
export { regelfragment, gruppadSamling } from "./lib/regler.js";

/*
 * ⛔ GRUPPLÄGET OCH SAMMANSLAGNINGEN (#139). Besluten är rena funktioner och
 * ligger därför här: vilka grupper som frågas och hur svaren läggs ihop måste
 * gå att prova utan en skärm, och det är samma skäl som för katalogen.
 *
 * ⛔ `gruppLista` OCH `gruppSkapa` ÄR DEN ENDA VÄGEN IN till en grupps rader,
 * och att `groupId` krävs är ett typkrav som `check-gruppfraga` bevisar genom
 * att köra tsc mot en fråga utan grupp.
 */
export { ALLA_GRUPPER, minaGrupper, valtLage, grupperAttFraga, navForLage, gruppenAttSkapaI, slaIhopSvar, grupplagetsNyckel, lasAktivGrupp, sparaAktivGrupp } from "./lib/grupplage.js";
export { gruppLista, gruppSkapa, listaPerGrupp, raderPerGrupp } from "./data/gruppkalla.js";
export { OpsGruppvaljare } from "./components/OpsGruppvaljare.jsx";
export { OpsGruppfilter } from "./components/OpsGruppfilter.jsx";
export { OpsGruppmarke } from "./components/OpsGruppmarke.jsx";
export { sakerstallAnvandare, sparaInstallningar, andringen } from "./lib/profil.js";
export { createCatalogSource } from "./data/katalogkalla.js";
export { OpsKatalogInstallning } from "./components/OpsKatalogInstallning.jsx";
export { STATUS_TONES, statusTone } from "./lib/statusTone.js";
export { createActivityLog, unreadCount, isUnread, unread, unreadRows, activityId, activityWindow, groupByDay, ACTIVITY_RESULTS, ACTIVITY_SECTIONS } from "./lib/aktivitet.js";
export { formatCurrency, formatNumber, formatPercent, formatDate, formatDateTime, formatRelativeDate, NUMBER_SPACE, MISSING } from "./lib/format.js";
