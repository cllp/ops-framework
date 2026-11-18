import { Suspense, lazy } from "react";
import { LatGrans } from "./LatGrans.jsx";
import { OpsVantar } from "./OpsVantar.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { ordet } from "../lib/ord.js";
import { faltTriggerKlass } from "../lib/radKlass.js";

/**
 * Färgväljaren, inläst när den ritas (0.238.2, cllp/lifehub.app#883).
 *
 * ══ ⛔ HÄNDELSEN ═════════════════════════════════════════════════════════════
 *
 * 0.238.0 gav gruppens kulör ramverkets enda färgväljare (`OpsFargval slag="kulor"`, cllp/lifehub.app#882). `OpsGruppmarkeValjare` importerade den statiskt,
 * och den väljaren följer med `OpsGruppFormular` och `OpsProfil` in i appens startfil. Med den kom reglagen, paletten (`palett.js`), omfångsräkningen
 * (`palettomfang.js`) och kontrastparen (`kontrastpar.js`): mätt med källkartor i lifehub.app cirka 25 kB minifierat i startbiten, och appens `check:jsstorlek`
 * blev röd med 14 419 byte gzip över taket. Före 0.238.0 låg samma kod bara i Hubbens färger, som redan är en egen bit. Väljaren ritas först när någon
 * fäller ut "Färg och ikon" eller öppnar profilen, så den hör inte hemma före första vyn.
 *
 * Samma väg som `OpsSnabbmenyLat` (0.187.0): paketet skriver en fil per källmodul, och appens bundler gör den dynamiska importen till en egen bit.
 * `check:delbarhet` mäter att `OpsFargval` och `hallbarLjushet` inte följer med `OpsGruppmarkeValjare`.
 *
 * ══ ⛔ VÄNTAN SYNS, OCH FÄLTET HOPPAR INTE ════════════════════════════════════
 *
 * Medan biten hämtas står en ruta i fältets form med ramverkets väntan (`OpsVantar`) och orden "Hämtar färgväljaren" (`aria-busy`), inte ett tomrum som fylls en stund senare
 * (interaktionsdesignens avsnitt 7). Går biten inte att hämta står en mening i stället (`LatGrans`), aldrig ett tyst tomt fält.
 *
 * Samma props som `OpsFargval`.
 */
const Fargval = lazy(() => import("./OpsFargval.jsx").then((m) => ({ default: m.OpsFargval })));

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_OPSFARGVAL_LAT = {
  hamtar: { sv: "Hämtar färgväljaren", en: "Loading the colour picker" },
  lasfel: { sv: "Färgväljaren gick inte att läsa in. Ladda om sidan.", en: "The colour picker could not be loaded. Reload the page." },
};

/** @param {import("react").ComponentProps<typeof import("./OpsFargval.jsx").OpsFargval>} props */
export function OpsFargvalLat(props) {
  const sprak = useOpsSprak();
  const t = (/** @type {string} */ k) => ordet(ORD_OPSFARGVAL_LAT, k, sprak);
  return (
    <LatGrans
      fel={
        <p role="alert" data-fargval-lasfel="" className="m-0 text-etikett text-danger">
          {t("lasfel")}
        </p>
      }
    >
      <Suspense
        fallback={
          <div aria-busy="true" data-fargval-hamtar="" className={`${faltTriggerKlass()} flex items-center text-meta text-ink-secondary`}>
            <OpsVantar storlek="sm" text={t("hamtar")} />
          </div>
        }
      >
        <Fargval {...props} />
      </Suspense>
    </LatGrans>
  );
}
