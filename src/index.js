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

// ── Data ───────────────────────────────────────────────────────────────────
export { OpsList, OpsListRow } from "./components/OpsList.jsx";
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
export { OpsBanner } from "./components/OpsBanner.jsx";
export { OpsToastProvider, useOpsToast } from "./components/OpsToast.jsx";
export { OpsTooltip } from "./components/OpsTooltip.jsx";
export { OpsThemeToggle } from "./components/OpsThemeToggle.jsx";

// ── Datalager ──────────────────────────────────────────────────────────────
export { skapaDatakalla, tillampaFraga, OPERATIONER } from "./data/kontrakt.js";
export { skapaMinneskalla, skapaJsonKalla } from "./data/adaptrar.js";
export { OpsDataProvider, useDatakalla, useSamling, useDokument } from "./data/useData.jsx";
export { skapaFirestoreKalla } from "./data/firestore.js";
export { skapaPostgresKalla } from "./data/postgres.js";

// ── Inloggning ─────────────────────────────────────────────────────────────
export { skapaAutentisering, skapaGoogleAuth, OpsAuthProvider, useOpsAuth, OpsAuthGate } from "./auth/auth.jsx";

// ── Hjälpare ───────────────────────────────────────────────────────────────
export { getTheme, setTheme, initTheme } from "./lib/theme.js";
export { identityTone, initials, ANTAL_IDENTITETSTONER } from "./lib/identity.js";
export { formatCurrency, formatNumber, formatPercent, formatDate, formatDateTime, formatRelativeDate, TALMELLANSLAG, SAKNAS } from "./lib/format.js";
