import { useEffect, useState } from "react";
import { OpsGastFelrad } from "./OpsGastFelrad.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { ordet } from "../lib/ord.js";
import { OpsVantar } from "./OpsVantar.jsx";

/**
 * PDF-vyn, inläst när en PDF ska visas (0.193.0, cllp/ops-framework#530).
 *
 * ══ ⛔ VARFÖR LAT ════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Vyn (`OpsPdfVisning`) och pdf.js ritas bara när en PDF öppnas. Samma väg som `OpsHtmlDokumentLat`: paketet skriver en fil per källmodul, och appens bundler gör den dynamiska importen till en egen bit.
 * `check:delbarhet` mäter att varken `OpsPdfVisning`, `laddaPdfjs` eller `pdfjs-dist` finns i en startfil som importerar `OpsBibliotek`.
 *
 * ⛔ INTE `React.lazy`: den minns ett misslyckande, och då hade Försök igen varit en död knapp tills sidan laddades om. Här glöms ett misslyckat försök, och knappen hämtar på nytt.
 * ⛔ FELET SYNS (regel 5), med Försök igen, på samma rad som gästflikarna (#675).
 *
 * @param {import("react").ComponentProps<typeof import("./OpsPdfVisning.jsx").OpsPdfVisning>} props Samma props som `OpsPdfVisning`.
 */
export function OpsPdfVisningLat(props) {
  const sprak = useOpsSprak();
  const [vy, setVy] = useState(/** @type {{ Komponent: typeof import("./OpsPdfVisning.jsx").OpsPdfVisning } | null} */ (null));
  const [fel, setFel] = useState(false);
  const [forsok, setForsok] = useState(0);
  useEffect(() => {
    let kvar = true;
    setFel(false);
    laddaVyn().then(
      (m) => {
        if (kvar) setVy({ Komponent: m.OpsPdfVisning });
      },
      () => {
        if (kvar) setFel(true);
      },
    );
    return () => {
      kvar = false;
    };
  }, [forsok]);
  if (fel) {
    return (
      <div data-pdf-lasfel="" className={props.helfonster ? "px-4 py-4" : undefined}>
        <OpsGastFelrad data="pdf-fel" text={ordet(ORD_PDFVISNING_LAT, "lasfel", sprak)} forsokIgen={ordet(ORD_PDFVISNING_LAT, "forsokIgen", sprak)} onForsokIgen={() => setForsok((n) => n + 1)} />
      </div>
    );
  }
  if (!vy) return <div data-pdf-lage="hamtar" className={props.helfonster ? "m-0 px-4 py-4 text-etikett text-ink-muted" : "m-0 text-etikett text-ink-muted"}><OpsVantar text={ordet(ORD_PDFVISNING_LAT, "hamtar", sprak)} /></div>;
  const { Komponent } = vy;
  return <Komponent {...props} />;
}

/** @type {Promise<typeof import("./OpsPdfVisning.jsx")> | null} */
let vynLaddas = null;

/** Vyns modul. Ett misslyckat försök glöms, så att nästa försök hämtar på nytt. */
function laddaVyn() {
  if (!vynLaddas) {
    vynLaddas = import("./OpsPdfVisning.jsx").catch((e) => {
      vynLaddas = null;
      throw e;
    });
  }
  return vynLaddas;
}

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_PDFVISNING_LAT = {
  hamtar: { sv: "Hämtar dokumentet.", en: "Fetching the document." },
  lasfel: { sv: "Visningen för PDF gick inte att hämta. Kontrollera nätet och försök igen.", en: "The PDF viewer could not be loaded. Check the network and try again." },
  forsokIgen: { sv: "Försök igen", en: "Try again" },
};
