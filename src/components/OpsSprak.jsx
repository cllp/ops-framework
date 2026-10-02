import { createContext, useContext } from "react";
import { RESERVSPRAK, SPRAK } from "../lib/sprak.js";

/**
 * Språket appen ritas på, en gång för hela trädet (0.46.0, cllp/bolag-ops#528).
 *
 * ⛔ HÄNDELSEN: CP 2026-10-01, "byta språk i profil byter inte språk". Profilen sparade valet, men varje komponent hade `sprak = "sv"`
 * som förval och appen skickade aldrig något annat. Nu sätter appen språket här, ur personens profil, och varje ramverkskomponent som
 * inte fått ett `sprak` av appen läser det härifrån.
 *
 * ⛔ ETT OKÄNT SPRÅK BLIR SVENSKA OCH SÄGER DET I KONSOLEN. Ett språk som inte finns i `SPRAK` har ingen ordbok att läsa ur. Att kasta
 * hade tagit ned hela appen för ett fält i en profil; att tiga hade gjort valet osynligt fel.
 */
const SprakKontext = createContext(/** @type {string} */ (RESERVSPRAK));

/**
 * @param {{ sprak?: string | null, children: import("react").ReactNode }} props
 */
export function OpsSprakProvider({ sprak, children }) {
  let varde = RESERVSPRAK;
  if (typeof sprak === "string" && SPRAK.includes(/** @type {any} */ (sprak))) varde = sprak;
  else if (sprak) console.error(`OpsSprakProvider: språket ${JSON.stringify(sprak)} finns inte (giltiga: ${SPRAK.join(", ")}). Appen ritas på svenska.`);
  return <SprakKontext.Provider value={varde}>{children}</SprakKontext.Provider>;
}

/** Språket appen ritas på. Utan `OpsSprakProvider` är det svenska, som förut. */
export function useOpsSprak() {
  return useContext(SprakKontext);
}
