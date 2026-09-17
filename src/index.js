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
export { OpsFilePicker } from "./components/OpsFilePicker.jsx";
// ⛔ `lasBilaga` och `MAX_SIDA` exporteras MED FLIT inte. En app som läser filer
// själv har gått runt komponenten, och då finns två ställen som bestämmer vad som
// ryms. `arBild` och `storlekstext` behövs för att VISA en sparad bilaga, alltså
// på andra sidan lagringen, där komponenten inte finns.
export { arBild, storlekstext, bilagestorlek } from "./lib/fil.js";

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

// ── Märkning ───────────────────────────────────────────────────────────────
export { OpsPill } from "./components/OpsPill.jsx";
export { OpsTag } from "./components/OpsTag.jsx";
export { OpsIdentity } from "./components/OpsIdentity.jsx";
export { OpsProvenance } from "./components/OpsProvenance.jsx";
export { OpsFact } from "./components/OpsFact.jsx";

// ── Navigering och meddelanden ─────────────────────────────────────────────
export { OpsTabs, OpsTabPanel } from "./components/OpsTabs.jsx";
export { OpsSegmented } from "./components/OpsSegmented.jsx";
export { OpsFilterChip } from "./components/OpsFilterChip.jsx";
export { OpsBanner } from "./components/OpsBanner.jsx";
export { OpsToastProvider, useOpsToast } from "./components/OpsToast.jsx";
export { OpsTooltip } from "./components/OpsTooltip.jsx";
export { OpsThemeToggle } from "./components/OpsThemeToggle.jsx";
export { OpsFullscreenToggle } from "./components/OpsFullscreenToggle.jsx";
export { OpsIconLink } from "./components/OpsIconLink.jsx";

// ── Datalager ──────────────────────────────────────────────────────────────
export { skapaDatakalla, tillampaFraga, OPERATIONER } from "./data/kontrakt.js";
export { skapaMinneskalla, skapaJsonKalla } from "./data/adaptrar.js";
export { OpsDataProvider, useDatakalla, useSamling, useSamlingLive, useDokument } from "./data/useData.jsx";
export { skapaFirestoreKalla } from "./data/firestore.js";
export { skapaPostgresKalla } from "./data/postgres.js";

// ── Inloggning ─────────────────────────────────────────────────────────────
export { skapaAutentisering, skapaGoogleAuth, OpsAuthProvider, useOpsAuth, OpsAuthGate } from "./auth/auth.jsx";

// ── Hjälpare ───────────────────────────────────────────────────────────────
export { getTheme, setTheme, initTheme } from "./lib/theme.js";
export { identityTone, initials, ANTAL_IDENTITETSTONER } from "./lib/identity.js";
export { bradska, delaIdagKommande } from "./lib/handelser.js";
export { skapaArendemodell } from "./lib/arende.js";
export { formatCurrency, formatNumber, formatPercent, formatDate, formatDateTime, formatRelativeDate, TALMELLANSLAG, SAKNAS } from "./lib/format.js";
