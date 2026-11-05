import { Suspense, lazy } from "react";
import { LatGrans } from "./LatGrans.jsx";
import { OpsSpinner } from "./OpsSpinner.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { ordet } from "../lib/ord.js";

/**
 * Läsläget för en fil i gruppens GitHub-repo, inläst när det behövs (0.186.0, cllp/lifehub.app#653).
 *
 * ⛔ VARFÖR LÄSLÄGET LIGGER BAKOM EN DYNAMISK IMPORT: statiskt i `OpsBibliotek` lade `GithubDokumentVisning` 2 227 byte gzip på lifehub.app:s startfiler (mätt i appens
 * `check:jsstorlek` med 0.186.0 mot 0.185.0). Läsläget ritas bara när en sådan länk öppnas. Samma väg som `BibliotekHtmlVersionerLat` (0.159.0): paketet skriver en fil per
 * källmodul, och appens bundler gör den dynamiska importen till en egen bit.
 *
 * Medan modulen hämtas ritas samma väntan som läsläget själv visar medan filen hämtas från GitHub, så att det inte blinkar mellan två olika väntelägen.
 * Går modulen inte att hämta ritas en mening i stället (`LatGrans`).
 */
const Visning = lazy(() => import("./GithubDokumentVisning.jsx").then((m) => ({ default: m.GithubDokumentVisning })));

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_GITHUBDOKUMENT_LAT = {
  hamtar: { sv: "Hämtar filen från GitHub.", en: "Fetching the file from GitHub." },
  lasfel: { sv: "Läsläget gick inte att läsa in. Ladda om sidan.", en: "The reading view could not be loaded. Reload the page." },
};

/** Väntan medan filen eller läslägets kod hämtas. Delas med `GithubDokumentVisning`. */
export function GithubDokumentVantar() {
  const sprak = useOpsSprak();
  return (
    <span data-github-dokument-vantar="" className="inline-flex items-center gap-2 text-etikett text-ink-muted">
      <OpsSpinner size="sm" decorative />
      {ordet(ORD_GITHUBDOKUMENT_LAT, "hamtar", sprak)}
    </span>
  );
}

/**
 * @param {import("react").ComponentProps<typeof Visning>} props Samma props som `GithubDokumentVisning`.
 */
export function GithubDokumentVisningLat(props) {
  const sprak = useOpsSprak();
  return (
    <LatGrans fel={<p role="alert" data-github-lasfel="" className="m-0 text-etikett text-danger wrap-anywhere">{ordet(ORD_GITHUBDOKUMENT_LAT, "lasfel", sprak)}</p>}>
      <Suspense
        fallback={
          <div data-github-dokument="hamtar" role="status" aria-busy="true" className="flex min-w-0 flex-col gap-2">
            <GithubDokumentVantar />
          </div>
        }
      >
        <Visning {...props} />
      </Suspense>
    </LatGrans>
  );
}
