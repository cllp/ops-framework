import { Suspense, lazy } from "react";
import { IKON_FOR } from "./ikonlexikon.js";
import { LatGrans } from "./LatGrans.jsx";
import { OpsDisclosure } from "./OpsDisclosure.jsx";
import { OpsSpinner } from "./OpsSpinner.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { ordet } from "../lib/ord.js";

/**
 * Orden som delen behöver innan sin modul är hämtad (0.205.0). Resten står i `ORD_BIBLIOTEK_REPO` (`BibliotekRepo.jsx`), som hämtas med delen och inte väger i startfilerna.
 * (0.209.0) Rubriken står här, eftersom raden "I repot" ritas infälld innan modulen hämtas.
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_BIBLIOTEK_REPO_LAT = {
  rubrik: { sv: "I repot", en: "In the repo" },
  hamtar: { sv: "Hämtar mappen från GitHub.", en: "Fetching the folder from GitHub." },
  lasfel: { sv: "Delen I repot gick inte att läsa in. Ladda om sidan.", en: "The In the repo part could not be loaded. Reload the page." },
};

/**
 * Nyckeln i `localStorage` för om "I repot" är utfälld på en plats (0.209.0). En bekvämlighet per webbläsare, aldrig data: `OpsDisclosure` läser och skriver den inom try/catch, och utan lagring
 * (privat fönster, blockerad webbplatsdata) ritas raden infälld.
 * @param {string} plats
 */
export const repoMinnesnyckel = (plats) => `bibliotek-repo:${plats}`;

/**
 * "I repot", inläst när det behövs (0.205.0). ⛔ Bakom en dynamisk import av samma skäl som läsläget (`GithubDokumentVisningLat`, 0.186.0): delen ritas bara på ett projekts plats, och statiskt hade den vägt in i appens startfiler (`check:jsstorlek`).
 * Medan modulen hämtas ritas samma väntan som när mappen hämtas, och går modulen inte att hämta ritas en mening (`LatGrans`).
 */
const Repo = lazy(() => import("./BibliotekRepo.jsx").then((m) => ({ default: m.BibliotekRepo })));

/**
 * ⛔ INFÄLLD FRÅN BÖRJAN (0.209.0, cllp/lifehub.app#706). Raden "I repot" med en pil står under listan, och repot läses först när den fälls ut: förut lästes projektets mapp varje gång platsen
 * ritades, också för den som aldrig tittade dit, och sektionen tog plats under listan. Utfällningen minns per plats (`repoMinnesnyckel`). Raden är `OpsDisclosure` med `lat`, samma rad som
 * versionerna för ett HTML-dokument, och innehållet (och modulen) hämtas först när den är utfälld.
 *
 * @param {import("react").ComponentProps<typeof Repo>} props Samma props som `BibliotekRepo`.
 */
export function BibliotekRepoLat(props) {
  const sprak = useOpsSprak();
  return (
    <section data-bibliotek-repo="" className="min-w-0">
      <OpsDisclosure
        lat
        storageKey={repoMinnesnyckel(props.plats)}
        summary={
          <h2 className="m-0 inline-flex items-center gap-2 text-etikett font-medium text-ink">
            <IKON_FOR.repoDokument size={16} aria-hidden="true" className="shrink-0" />
            {ordet(ORD_BIBLIOTEK_REPO_LAT, "rubrik", sprak)}
          </h2>
        }
      >
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
      </OpsDisclosure>
    </section>
  );
}
