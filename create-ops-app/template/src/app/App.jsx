import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { OpsAppShell, OpsDataProvider, OpsThemeToggle, OpsToastProvider, createMemorySource } from "@staiger/ops-framework";
// ⛔ #159: felgränsen är ramverkets, inte appens. `OpsAppShell` fångar och
// visar varje fel som når den, ALLTID, utan en prop som slår av den. Innan
// #159 löste varje app det här själv (se `lib/ErrorBoundary.jsx` i äldre
// scaffold, borttagen), och det gav samma yta uppfunnen på nytt i varje app.
import { DashboardView } from "./views/DashboardView.jsx";
import { PrimitivesView } from "./views/PrimitivesView.jsx";
import { NotFoundView } from "./views/NotFoundView.jsx";

/*
 * ⛔ SENTRY ÄR AV SOM FÖRVAL (#159, CP:s beslut: "valfritt, men färdigkopplat").
 * Vill appen ha Sentry: installera `@sentry/browser`, kommentera in raden
 * nedan, fyll i er DSN, och skicka `felmottagare` till `OpsAppShell` (och till
 * `OpsAuthProvider` om ni vill att `satt(anvandare)` kallas vid inloggning).
 * Utan en mottagare hamnar varje fel i konsolen ändå (`rapporteraFel`),
 * felgränsen fungerar likadant med eller utan den.
 *
 * import { sentryMottagare } from "@staiger/ops-framework/sentry";
 * const felmottagare = sentryMottagare({ dsn: "__ER_DSN__", miljo: import.meta.env.MODE, version: "__APP_VERSION__" });
 */

const SIDOR = [
  { href: "/", label: "Översikt" },
  { href: "/primitiver", label: "Primitiver" },
];

/**
 * ⛔ Byt ut minneskällan mot appens riktiga adapter. Den ligger här för att
 * appen ska gå att köra innan någon bestämt var datan bor, inte för att den är
 * ett rimligt slutläge: allt försvinner vid omladdning.
 */
const source = createMemorySource();

function Skal({ children }) {
  const { pathname } = useLocation();
  const navigera = useNavigate();

  return (
    <OpsAppShell
      brand="__APP_NAME__"
      nav={SIDOR}
      activeHref={pathname}
      // Riktiga länkar i markup, routern tar över klicket. Då fungerar
      // högerklick, ny flik och delning av länk ändå.
      onNavigate={(href, e) => {
        e.preventDefault();
        navigera(href);
      }}
      actions={<OpsThemeToggle />}
      // felmottagare={felmottagare}
    >
      {children}
    </OpsAppShell>
  );
}

export function App() {
  return (
    <OpsDataProvider source={source}>
      <OpsToastProvider>
        <BrowserRouter>
          <Skal>
            <Routes>
              <Route path="/" element={<DashboardView />} />
              <Route path="/primitiver" element={<PrimitivesView />} />
              <Route path="/hem" element={<Navigate to="/" replace />} />
              <Route path="*" element={<NotFoundView />} />
            </Routes>
          </Skal>
        </BrowserRouter>
      </OpsToastProvider>
    </OpsDataProvider>
  );
}
