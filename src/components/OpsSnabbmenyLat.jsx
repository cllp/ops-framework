import { Suspense, lazy, useEffect, useState } from "react";
import { LatGrans } from "./LatGrans.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { ordet } from "../lib/ord.js";

/**
 * Snabbmenyn, inläst när den behövs (0.187.0, cllp/ops-framework#518).
 *
 * ══ ⛔ HÄNDELSEN ═════════════════════════════════════════════════════════════
 *
 * `OpsAppShell` importerade `OpsSnabbmeny` statiskt (0.184.0), och därmed låg menyns kod i varje apps startfil: cirka 1,7 kB gzip före första vyn i lifehub.app (mätt av appens
 * `check:jsstorlek`, OpsSnabbmeny 4,3 kB minifierad), för en meny som ritas först när någon trycker på plus eller Appar. Samma väg som `GithubDokumentVisningLat` (0.186.0)
 * och `BibliotekHtmlVersionerLat` (0.159.0): paketet skriver en fil per källmodul, och appens bundler gör den dynamiska importen till en egen bit.
 *
 * ══ ⛔ ATT FÖRSTA TRYCKET FORTFARANDE ÖPPNAR MENYN ═════════════════════════════════════
 *
 * Två saker, båda med skäl:
 *
 * 1. FÖRLADDNING. När skalet monterats och webbläsaren har tid över (`requestIdleCallback`, annars en kort timer) hämtas modulen i bakgrunden. Den ligger då i cachen när någon trycker,
 *    och menyn ritas i samma varv som förut. Startfilen är lika liten som utan förladdning: bitarna hämtas efter första vyn, inte före. Valet att förladda och inte vänta på trycket är för att
 *    ett tryck på plus på en dålig linje annars gav en meny som dök upp en sekund efter krysset.
 * 2. VÄNTAN SOM INTE BLINKAR. Hinner trycket före förladdningen väntar ingenting synligt (`fallback={null}`): plusknappen är redan ett kryss (skalet äger den), och menyn glider in när biten kommit.
 *    En snurra i stället hade blinkat till och försvunnit i det vanliga fallet där biten finns i cachen men React ändå måste hämta löftet en gång.
 *
 * Menyn monteras först när den öppnats en gång, och stannar sedan monterad: `OpsSnabbmeny` bär sin egen historikpost och orsak mellan öppningarna (0.185.1), och ett montera-av-när-den-stängs hade
 * gjort varje öppning till den första.
 *
 * Går biten inte att hämta (nätet föll, eller en ny version har lagts ut och den gamla biten finns inte längre) står en mening där menyn skulle ha varit (`LatGrans`). Aldrig en tyst meny som inte öppnas.
 *
 * Samma props som `OpsSnabbmeny`.
 */
const laddaMeny = () => import("./OpsSnabbmeny.jsx");
const Meny = lazy(() => laddaMeny().then((m) => ({ default: m.OpsSnabbmeny })));

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_SNABBMENY_LAT = {
  lasfel: { sv: "Menyn gick inte att läsa in. Ladda om sidan.", en: "The menu could not be loaded. Reload the page." },
};

/**
 * Hämtar modulen i bakgrunden när webbläsaren har tid över. Anropas en gång per montering, och en andra hämtning av samma modul kostar ingenting.
 * Ett fel här är inte menyns fel: tryckar någon på plus försöker `lazy` på nytt och `LatGrans` visar meningen om det faller även då.
 *
 * @returns {() => void} Avbryter väntan om skalet avmonteras innan webbläsaren fått tid över.
 */
function forladda() {
  /** @type {any} */
  const f = typeof window === "undefined" ? null : window;
  if (!f) return () => {};
  const start = () => {
    laddaMeny().catch(() => {});
  };
  if (typeof f.requestIdleCallback === "function") {
    const id = f.requestIdleCallback(start, { timeout: 4000 });
    return () => f.cancelIdleCallback?.(id);
  }
  const id = f.setTimeout(start, 1500);
  return () => f.clearTimeout(id);
}

/**
 * @param {import("react").ComponentProps<typeof import("./OpsSnabbmeny.jsx").OpsSnabbmeny>} props Samma props som `OpsSnabbmeny`.
 */
export function OpsSnabbmenyLat(props) {
  const sprak = useOpsSprak();
  // ⛔ Monteras först när den öppnats en gång (härlett under renderingen, som Reacts råd för tillstånd som följer en prop), och stannar sedan.
  const [oppnad, setOppnad] = useState(Boolean(props.oppen));
  if (props.oppen && !oppnad) setOppnad(true);
  useEffect(() => forladda(), []);
  if (!oppnad) return null;
  return (
    <LatGrans
      fel={props.oppen ? (
        <p role="alert" data-snabbmeny-lasfel="" className="fixed inset-x-4 bottom-24 z-(--z-dropdown) m-0 rounded-lg border border-line bg-raised p-3 text-etikett text-danger wrap-anywhere">
          {ordet(ORD_SNABBMENY_LAT, "lasfel", sprak)}
        </p>
      ) : null}
    >
      <Suspense fallback={null}>
        <Meny {...props} />
      </Suspense>
    </LatGrans>
  );
}
