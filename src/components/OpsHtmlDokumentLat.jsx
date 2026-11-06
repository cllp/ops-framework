import { Suspense, lazy } from "react";
import { LatGrans } from "./LatGrans.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { ordet } from "../lib/ord.js";

/**
 * Rutan för ett HTML-dokument i Bibliotekets detalj, inläst när den behövs (0.192.0, cllp/ops-framework#529).
 *
 * ══ ⛔ HÄNDELSEN ═════════════════════════════════════════════════════════════
 *
 * Zoomen (verktygsraden, rutans skript och räkningen) växte en startfil som importerar `OpsBibliotek`, mätt med Vite mot det byggda paketet: från 296 084 till 300 860 byte, 95 548 till 97 216 gzip.
 * Rutan ritas bara i detaljen för ett HTML-dokument, och bara när appen gett `hamtaFil`. Samma väg som `BibliotekKommentarerLat` och `BibliotekHtmlVersionerLat`: paketet skriver en fil per källmodul, och
 * appens bundler gör den dynamiska importen till en egen bit. Zoomens skript ligger därför i `lib/htmlruta.js` och inte i `lib/htmldokument.js`, som Biblioteket läser för `htmlVyAdress`.
 *
 * ⛔ VÄNTAN SER UT SOM RUTANS EGEN VÄNTAN: raden "Hämtar dokumentet." (samma ord som `OpsHtmlDokumentHamtat` skriver medan filen hämtas). Rutan hämtar sin fil efter biten ändå, så det är samma väntan.
 *
 * ⛔ ETT FEL VID HÄMTNINGEN TYSTAS INTE: `LatGrans` ritar en mening med `role="alert"` där rutan skulle ha stått.
 */
const Ruta = lazy(() => import("./OpsHtmlDokument.jsx").then((m) => ({ default: m.OpsHtmlDokumentHamtat })));

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_HTMLDOKUMENT_LAT = {
  hamtar: { sv: "Hämtar dokumentet.", en: "Fetching the document." },
  lasfel: { sv: "Dokumentet gick inte att visa. Ladda om sidan.", en: "The document could not be shown. Reload the page." },
};

/**
 * @param {import("react").ComponentProps<typeof import("./OpsHtmlDokument.jsx").OpsHtmlDokumentHamtat>} props Samma props som `OpsHtmlDokumentHamtat`.
 */
export function OpsHtmlDokumentLat(props) {
  const sprak = useOpsSprak();
  return (
    <LatGrans fel={<p role="alert" data-html-dokument-lasfel="" className="m-0 text-etikett text-danger wrap-anywhere">{ordet(ORD_HTMLDOKUMENT_LAT, "lasfel", sprak)}</p>}>
      <Suspense fallback={<p role="status" data-html-dokument-lage="hamtar" className="m-0 text-etikett text-ink-muted">{ordet(ORD_HTMLDOKUMENT_LAT, "hamtar", sprak)}</p>}>
        <Ruta {...props} />
      </Suspense>
    </LatGrans>
  );
}
