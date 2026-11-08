import { Suspense, lazy } from "react";
import { LatGrans } from "./LatGrans.jsx";
import { OpsSpinner } from "./OpsSpinner.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { ordet } from "../lib/ord.js";

/**
 * Orden som delen behöver innan sin modul är hämtad (0.205.0). Resten står i `ORD_BIBLIOTEK_REPO` (`BibliotekRepo.jsx`), som hämtas med delen och inte väger i startfilerna.
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_BIBLIOTEK_REPO_LAT = {
  hamtar: { sv: "Hämtar mappen från GitHub.", en: "Fetching the folder from GitHub." },
  lasfel: { sv: "Delen I repot gick inte att läsa in. Ladda om sidan.", en: "The In the repo part could not be loaded. Reload the page." },
};

/**
 * "I repot", inläst när det behövs (0.205.0). ⛔ Bakom en dynamisk import av samma skäl som läsläget (`GithubDokumentVisningLat`, 0.186.0): delen ritas bara på ett projekts plats, och statiskt hade den vägt in i appens startfiler (`check:jsstorlek`).
 * Medan modulen hämtas ritas samma väntan som när mappen hämtas, och går modulen inte att hämta ritas en mening (`LatGrans`).
 */
const Repo = lazy(() => import("./BibliotekRepo.jsx").then((m) => ({ default: m.BibliotekRepo })));

/** @param {import("react").ComponentProps<typeof Repo>} props Samma props som `BibliotekRepo`. */
export function BibliotekRepoLat(props) {
  const sprak = useOpsSprak();
  return (
    <LatGrans fel={<p role="alert" data-bibliotek-repo-lasfel="" className="m-0 text-etikett text-danger wrap-anywhere">{ordet(ORD_BIBLIOTEK_REPO_LAT, "lasfel", sprak)}</p>}>
      <Suspense
        fallback={
          <div role="status" aria-busy="true" data-bibliotek-repo-lage="hamtar" className="inline-flex items-center gap-2 text-etikett text-ink-muted">
            <OpsSpinner size="sm" decorative />
            {ordet(ORD_BIBLIOTEK_REPO_LAT, "hamtar", sprak)}
          </div>
        }
      >
        <Repo {...props} />
      </Suspense>
    </LatGrans>
  );
}
