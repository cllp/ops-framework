import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { OpsAppShell, OpsDataProvider, OpsThemeToggle, OpsToastProvider, createMemorySource } from "@staiger/ops-framework";
import { DashboardView } from "./views/DashboardView.jsx";
import { PrimitivesView } from "./views/PrimitivesView.jsx";
import { NotFoundView } from "./views/NotFoundView.jsx";
import { ErrorBoundary } from "../lib/ErrorBoundary.jsx";

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
            {/* ⛔ Felgränsen ligger INNANFÖR routern. Utanför slår ett fel i en
                enda vy ut hela appen, och användaren har ingen väg tillbaka
                utom att ladda om. */}
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<DashboardView />} />
                <Route path="/primitiver" element={<PrimitivesView />} />
                <Route path="/hem" element={<Navigate to="/" replace />} />
                <Route path="*" element={<NotFoundView />} />
              </Routes>
            </ErrorBoundary>
          </Skal>
        </BrowserRouter>
      </OpsToastProvider>
    </OpsDataProvider>
  );
}
