import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { DashboardView } from "./views/DashboardView.jsx";
import { PrimitivesView } from "./views/PrimitivesView.jsx";
import { NotFoundView } from "./views/NotFoundView.jsx";
import { Felgrans } from "../lib/Felgrans.jsx";
import { Temavaxlare } from "../lib/Temavaxlare.jsx";

const SIDOR = [
  { till: "/", etikett: "Översikt" },
  { till: "/primitiver", etikett: "Primitiver" },
];

function Toppnav() {
  const { pathname } = useLocation();
  return (
    // `sticky top-0` plus safe-area: utan den senare hamnar raden under
    // statusfältet på en telefon, och det syns bara på riktig hårdvara.
    <nav className="sticky top-(--safe-top) z-(--z-sticky) border-b border-line bg-surface">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-2">
        {SIDOR.map((s) => (
          <Link
            key={s.till}
            to={s.till}
            aria-current={pathname === s.till ? "page" : undefined}
            className="rounded-md px-3 py-2 text-base font-semibold text-ink-secondary hover:bg-accent-faint hover:text-ink aria-[current=page]:bg-accent-subtle aria-[current=page]:text-ink"
          >
            {s.etikett}
          </Link>
        ))}
        <div className="ml-auto">
          <Temavaxlare />
        </div>
      </div>
    </nav>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Toppnav />
      {/* ⛔ Felgränsen ligger INNANFÖR routern, inte utanför. Ligger den utanför
          slås hela appen ut av ett fel i en enda vy, och användaren har ingen
          väg tillbaka utom att ladda om. */}
      <Felgrans>
        <Routes>
          <Route path="/" element={<DashboardView />} />
          <Route path="/primitiver" element={<PrimitivesView />} />
          <Route path="/hem" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFoundView />} />
        </Routes>
      </Felgrans>
    </BrowserRouter>
  );
}
