import { createContext, useContext } from "react";

/**
 * Det gästsidan lägger på gruppens översikt (0.190.0 integritet, 0.192.0 också namnet och minnet av fliken).
 * Integriteten och namnrutan bor i `OpsGastSida`, som äger sessionen, och ritas av `OpsGastGrupp` på översikten.
 * Chatten, kalendern och biblioteket ritar dem inte.
 *
 * ⛔ ETT SAMMANHANG OCH INTE EN PROP GENOM APPEN: appens `renderGrupp` ritar `OpsGastGrupp`. Utan `OpsGastSida`
 * (gruppvyn ensam, i prov) är värdet `null`, och översikten visar bara gruppens egna rader.
 *
 * `minne` och `inbjudan` är till för senast valda flik. Inbjudan är id:t, 64 hextecken. Minnet får bara flikens namn.
 * `omAppen` (0.195.0) är raden om appen sist i översikten, eller `null` när appen inte gett `omAppen` till `OpsGastSida`.
 * `vaxlare` (0.215.0) är växlaren och Mina inbjudningar, sist i översikten före raden om appen. ⛔ Bara där: ovanför varje flik tog den 68 px av chattens logg
 * på en telefon, och överst i översikten sköt den namnrutans Spara under tangentbordet (`check:skalyta`, gäster hela gruppen 390, båda mätta).
 *
 * @typedef {{
 *   integritet: import("react").ReactNode,
 *   namn: import("react").ReactNode,
 *   minne: import("../lib/gastminne.js").Gastminne | null,
 *   inbjudan: string | null,
 *   omAppen?: import("react").ReactNode,
 *   vaxlare?: import("react").ReactNode,
 * }} GastsidaOversikt
 */

export const GastsidaInfo = createContext(/** @type {GastsidaOversikt | null} */ (null));

/** Det gästsidan lagt på översikten, eller `null`. */
export function useGastsidaInfo() {
  return useContext(GastsidaInfo);
}
