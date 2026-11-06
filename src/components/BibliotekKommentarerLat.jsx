import { Suspense, lazy } from "react";
import { LatGrans } from "./LatGrans.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { ordet } from "../lib/ord.js";

/**
 * Tråden på en post, inläst när den behövs (0.191.0, granskningen av PR 526).
 *
 * ══ ⛔ HÄNDELSEN ═════════════════════════════════════════════════════════════
 *
 * Den första versionen av 0.191.0 importerade `BibliotekKommentarer` statiskt i `OpsBibliotek`, och appens `check:jsstorlek` växte med 1 318 byte från ramverket ensamt, nästan allt i
 * bibliotekets fil. Mätt i ramverket (Vite mot det byggda paketet, en app vars startfil importerar `OpsBibliotek`, minifierad): 3 813 byte mer än 0.190.0, 1 161 gzip. Tråden ritas bara i en
 * posts detalj, och bara när appen gett `kommentarer`. Samma väg som `OpsSnabbmenyLat` (0.187.0), `GithubDokumentVisningLat` (0.186.0) och `BibliotekHtmlVersionerLat` (0.159.0):
 * paketet skriver en fil per källmodul, och appens bundler gör den dynamiska importen till en egen bit.
 *
 * ══ ⛔ ATT TRÅDEN ÄNDÅ FINNS NÄR POSTEN ÖPPNAS ═══════════════════════════════════
 *
 * 1. FÖRLADDNING. `OpsBibliotek` anropar `forladdaBibliotekKommentarer` när den har en källa (`kommentarer`), när webbläsaren har tid över (`requestIdleCallback`, annars en kort timer).
 *    Biten ligger då i cachen när en post öppnas, och startfilen är lika liten: biten hämtas efter första vyn, inte före.
 * 2. VÄNTAN SOM INTE HOPPAR. Medan biten hämtas ritas ingenting (`fallback={null}`): ingen tråd och ingen snurra. Tråden står sist i detaljen, under innehållet, så ingenting under den
 *    flyttar sig när den kommer. En snurra hade blinkat till och försvunnit i det vanliga fallet där biten redan finns.
 *
 * ⛔ ETT FEL VID HÄMTNINGEN TYSTAS INTE. Går biten inte att hämta (nätet föll, eller en ny version har lagts ut och den gamla biten finns inte längre) kastar `lazy`, och `LatGrans` ritar en
 * mening med `role="alert"` där tråden skulle ha stått. Aldrig en post som bara saknar sin tråd utan att någon får veta varför. Ett nytt försök kräver att sidan laddas om (`lazy` minns felet).
 */
const laddaKommentarer = () => import("./BibliotekKommentarer.jsx");
const Kommentarer = lazy(() => laddaKommentarer().then((m) => ({ default: m.BibliotekKommentarer })));

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_BIBLIOTEKKOMMENTARER_LAT = {
  lasfel: { sv: "Kommentarerna gick inte att läsa in. Ladda om sidan.", en: "The comments could not be loaded. Reload the page." },
};

/**
 * Hämtar trådens bit i bakgrunden när webbläsaren har tid över. En andra hämtning av samma modul kostar ingenting. Ett fel här är inte trådens: öppnas en post försöker `lazy` igen,
 * och `LatGrans` visar meningen om det faller även då.
 *
 * @returns {() => void} Avbryter väntan om biblioteket avmonteras innan webbläsaren fått tid över.
 */
export function forladdaBibliotekKommentarer() {
  /** @type {any} */
  const f = typeof window === "undefined" ? null : window;
  if (!f) return () => {};
  const start = () => {
    laddaKommentarer().catch(() => {});
  };
  if (typeof f.requestIdleCallback === "function") {
    const id = f.requestIdleCallback(start, { timeout: 4000 });
    return () => f.cancelIdleCallback?.(id);
  }
  const id = f.setTimeout(start, 1500);
  return () => f.clearTimeout(id);
}

/**
 * @param {import("react").ComponentProps<typeof import("./BibliotekKommentarer.jsx").BibliotekKommentarer>} props Samma props som `BibliotekKommentarer`.
 */
export function BibliotekKommentarerLat(props) {
  const sprak = useOpsSprak();
  return (
    <LatGrans fel={<p role="alert" data-bibliotek-kommentarer-lasfel="" className="m-0 text-etikett text-danger wrap-anywhere">{ordet(ORD_BIBLIOTEKKOMMENTARER_LAT, "lasfel", sprak)}</p>}>
      <Suspense fallback={null}>
        <Kommentarer {...props} />
      </Suspense>
    </LatGrans>
  );
}
