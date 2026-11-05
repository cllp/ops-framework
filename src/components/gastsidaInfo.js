import { createContext, useContext } from "react";

/**
 * Det gästsidan lägger i gruppens (i)-panel (0.190.0, CP 2026-11-05 i cllp/lifehub.app#658, del A): integriteten med Radera mina uppgifter och
 * "Skriv in adressen igen". De bor i `OpsGastSida`, som äger sessionen och raderingen, men ritas i `OpsGastGrupp`s huvud, under gruppens namn.
 *
 * ⛔ ETT SAMMANHANG OCH INTE EN PROP GENOM APPEN: appens `renderGrupp` ritar `OpsGastGrupp`, och en prop hade krävt att varje app förde den vidare.
 * Glömde en app det hade integriteten och raderingen försvunnit ur gruppens vy utan att någon såg det. Utan `OpsGastSida` (gruppvyn ensam, i prov)
 * är värdet `null`, och panelen visar bara gruppens egna rader.
 */
export const GastsidaInfo = createContext(/** @type {import("react").ReactNode} */ (null));

/** Det gästsidan lagt i gruppens (i)-panel, eller `null`. */
export function useGastsidaInfo() {
  return useContext(GastsidaInfo);
}
