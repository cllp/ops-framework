import { createContext, useContext } from "react";

/**
 * Vilka moduler som står i appens huvud (0.88.1, CP 2026-10-09).
 *
 * ⛔ EN FÄST MODUL ÄR INBYGGD. CP: en modul som har sin ikon i huvudmenyn ska bete sig som en del av appen, inte som en app
 * man öppnat från hubben. Dess förstasida har därför ingen "‹ Tillbaka" till hubben. En modul som inte är fäst har kvar
 * raden. Insidor (detalj, redigering, ett samtal) har sin egen väg tillbaka till modulens lista och berörs inte.
 *
 * ⛔ APPEN GER LISTAN, RAMVERKET BESLUTAR. Listan är gruppens `huvudmeny` (samma som `huvudmenyPoster` läser). Utan
 * provider är listan tom, och varje sida har sin tillbaka-rad som förut.
 */
const HuvudmenyKontext = createContext(/** @type {ReadonlyArray<string>} */ ([]));

/**
 * @param {{ moduler?: ReadonlyArray<string> | null, children: import("react").ReactNode }} props
 * `moduler` är modul-id som står i huvudet för den aktiva gruppen.
 */
export function OpsHuvudmenyProvider({ moduler, children }) {
  return <HuvudmenyKontext.Provider value={Array.isArray(moduler) ? moduler : []}>{children}</HuvudmenyKontext.Provider>;
}

/**
 * Sant när modulen står i huvudet, och dess förstasida därför inte har någon tillbaka-rad.
 *
 * @param {string | null | undefined} modulId
 * @returns {boolean}
 */
export function useIHuvudmenyn(modulId) {
  const lista = useContext(HuvudmenyKontext);
  return typeof modulId === "string" && modulId !== "" && lista.includes(modulId);
}
