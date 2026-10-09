/**
 * Adressen till en agents inställningar (0.90.0).
 *
 * Rent data in och data ut. Ingen samling och ingen nyckel: agentens dokument
 * bor där appen redan skriver det, och den här filen väljer bara vilken agent
 * modulramen visar.
 *
 * ⛔ SAMMA DELNING SOM `apparark.js`. Inställningsläget är `lage=installningar`.
 * Agenten är en egen parameter, `agent`, så att ett tryck i chatten kan öppna
 * just den agenten utan att modulens övriga parametrar tappas.
 */

import { medInstallningslage } from "./apparark.js";

/**
 * Modulens id. Samma sträng i manifestet.
 *
 * ⛔ INTE EN APP (0.90.6). Id:t får ligga kvar i en gammal `groups.moduler`, och
 * `utanAgenterSomApp` tar bort det ur apparna. Medlemskapet och agentens dokument
 * rörs inte: agenten hör till gruppen, appen gör det inte.
 */
export const AGENTER_ID = "agenter";

/** Frågeparametern som pekar ut agenten inställningarna gäller. */
export const AGENT_PARAM = "agent";

/**
 * @param {string} href
 * @returns {{ sokvag: string, qs: string, hash: string }}
 */
function delaHref(href) {
  const h = typeof href === "string" ? href : "";
  const hashI = h.indexOf("#");
  const hash = hashI < 0 ? "" : h.slice(hashI);
  const utan = hashI < 0 ? h : h.slice(0, hashI);
  const q = utan.indexOf("?");
  return { sokvag: q < 0 ? utan : utan.slice(0, q), qs: q < 0 ? "" : utan.slice(q + 1), hash };
}

/**
 * Agentens id ur adressen. Tom sträng när parametern saknas: det är ett svar,
 * inte en utelämnad rad.
 *
 * @param {string} href
 */
export function agentIHref(href) {
  return new URLSearchParams(delaHref(href).qs).get(AGENT_PARAM) ?? "";
}

/**
 * Samma adress, med agenten satt. Övriga parametrar och ankaret står kvar.
 *
 * @param {string} href
 * @param {string} agentId
 */
export function medAgent(href, agentId) {
  if (typeof agentId !== "string" || !agentId.trim()) {
    throw new Error("medAgent: agentId krävs. En tom agent är inte ett val, och en tyst adress hade öppnat listan i stället för inställningarna.");
  }
  const { sokvag, qs, hash } = delaHref(href);
  const p = new URLSearchParams(qs);
  p.set(AGENT_PARAM, agentId.trim());
  const q = p.toString();
  return `${sokvag}?${q}${hash}`;
}

/**
 * Adressen som öppnar just den agentens inställningar.
 *
 * @param {string} href Modulens adress, med eller utan frågesträng.
 * @param {string} agentId
 */
export function agentInstallningsHref(href, agentId) {
  return medInstallningslage(medAgent(href, agentId));
}

/**
 * Tar bort Agenter ur gruppens appar och ur huvudmenyn.
 *
 * Ett gammalt id ignoreras: listan utan det är svaret, och ett id som inte fanns
 * lämnar listan oförändrad. `huvudmeny` som saknas eller är `null` skrivs tillbaka
 * som den kom, för en tom lista är ett val och en saknad lista är det inte.
 *
 * @param {{ moduler?: ReadonlyArray<string> | null, huvudmeny?: ReadonlyArray<string> | null } | null | undefined} grupp
 * @returns {{ moduler: string[], huvudmeny: string[] | null }}
 */
export function utanAgenterSomApp(grupp) {
  const moduler = Array.isArray(grupp?.moduler) ? grupp.moduler.filter((id) => id !== AGENTER_ID) : [];
  const meny = grupp?.huvudmeny;
  const huvudmeny = Array.isArray(meny) ? meny.filter((id) => id !== AGENTER_ID) : null;
  return { moduler, huvudmeny };
}

/**
 * Modulerna som får synas som appar. Agenter hör till gruppens inställningar.
 *
 * @param {ReadonlyArray<{ id: string }> | null | undefined} moduler
 */
export function modulerIAppar(moduler) {
  return (moduler ?? []).filter((m) => m?.id !== AGENTER_ID);
}
