import { Suspense, lazy } from "react";
import { LatGrans } from "./LatGrans.jsx";
import { OpsVantar } from "./OpsVantar.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { ordet } from "../lib/ord.js";

/**
 * (i)-panelerna på sidan Verktyg, inlästa när de ritas (0.242.0, ops-framework#624).
 *
 * ══ ⛔ HÄNDELSEN ═════════════════════════════════════════════════════════════
 *
 * 0.240.0 lade panelerna under en ruta i `OpsHub` (lifehub.app#864). Mätt i lifehub.app vid ompinningen: `components/OpsHub.js` växte med 5 303 byte
 * minifierat, startfilerna med 1 961 byte gzip, och appens `check:jsstorlek` blev röd. Taket höjdes temporärt (regel 1). Panelerna ritas först efter
 * ett tryck på (i), så de hör inte hemma före första vyn.
 *
 * Samma väg som `OpsFargvalLat` (0.238.2): paketet skriver en fil per källmodul, och appens bundler gör den dynamiska importen till en egen bit.
 * `check:delbarhet` mäter att `VerktygPanel` och `ValbarPanel` inte följer med `OpsHub`.
 *
 * ══ ⛔ VÄNTAN SYNS, OCH ETT FEL ÄR EN MENING ═══════════════════════════════════
 *
 * Medan biten hämtas står en rad på panelens plats med ramverkets väntan och orden "Hämtar beskrivningen" (`aria-busy`), inte ett tomrum som fylls
 * en stund senare (interaktionsdesignens avsnitt 7). Går biten inte att hämta står en mening i stället (`LatGrans`), aldrig en tyst tom rad.
 */
const Verktyg = lazy(() => import("./VerktygPaneler.jsx").then((m) => ({ default: m.VerktygPanel })));
const Valbar = lazy(() => import("./VerktygPaneler.jsx").then((m) => ({ default: m.ValbarPanel })));

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_VERKTYGPANEL_LAT = {
  hamtar: { sv: "Hämtar beskrivningen", en: "Loading the description" },
  lasfel: { sv: "Beskrivningen gick inte att läsa in. Ladda om sidan.", en: "The description could not be loaded. Reload the page." },
};

/** Ramen kring en lat panel: samma rad i rutnätet som panelen, med väntan och fel. @param {{ children: import("react").ReactNode }} props */
function LatPanel({ children }) {
  const sprak = useOpsSprak();
  const t = (/** @type {string} */ k) => ordet(ORD_VERKTYGPANEL_LAT, k, sprak);
  return (
    <LatGrans
      fel={
        <li className="col-span-full min-w-0">
          <p role="alert" data-verktygpanel-lasfel="" className="m-0 text-etikett text-danger">
            {t("lasfel")}
          </p>
        </li>
      }
    >
      <Suspense
        fallback={
          <li className="col-span-full min-w-0" aria-busy="true" data-verktygpanel-hamtar="">
            <div className="flex min-h-11 items-center rounded-card border border-line bg-surface p-4 text-meta text-ink-secondary">
              <OpsVantar storlek="sm" text={t("hamtar")} />
            </div>
          </li>
        }
      >
        {children}
      </Suspense>
    </LatGrans>
  );
}

/** @param {import("react").ComponentProps<typeof import("./VerktygPaneler.jsx").VerktygPanel>} props */
export function VerktygPanelLat(props) {
  return (
    <LatPanel>
      <Verktyg {...props} />
    </LatPanel>
  );
}

/** @param {import("react").ComponentProps<typeof import("./VerktygPaneler.jsx").ValbarPanel>} props */
export function ValbarPanelLat(props) {
  return (
    <LatPanel>
      <Valbar {...props} />
    </LatPanel>
  );
}
