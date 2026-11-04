/**
 * Vad snabbmenyerna visar. Rent, så att ordningen går att pröva utan att rita.
 *
 * ══ ⛔ SKAPA ÄR TRE RADER, I ARKETS ORDNING ═══════════════════════════════════
 *
 * Plusets ark ritar Ny händelse, Nytt ärende och Nytt meddelande i den ordningen (OpsAppShell, renderSkapaLista),
 * och bara när appen gett mottagaren. Snabbmenyn läser samma tre frågor. Ny grupp, modulernas `skapa.rad` (Nytt projekt)
 * och registreringar (Skapa app) ingår inte: gruppen skapas där grupperna hanteras, ett projekt skapas i Projekt, och
 * Skapa app står i Appars huvud.
 *
 * ══ ⛔ APPAR ÄR VYNS KORT, INTE HUBBEN ═══════════════════════════════════════
 *
 * Hubb är instansen. Appar är gruppens installerade kort. Listan kommer ur `arkRader`, samma urval som Appar-vyns kort
 * (`hubbForGrupp`): gruppens `moduler`, i den ordningen, bara de som har ett kort. En app som vyn inte ritar som kort
 * (en ren tilläggsmodul) står inte här heller.
 */

/** @type {readonly ["handelse", "arende", "meddelande"]} */
export const SKAPA_SNABB_ORDNING = Object.freeze(["handelse", "arende", "meddelande"]);

/**
 * Ikonnyckel i `IKON_FOR` för en inbyggd app. En beskriven app har ingen nyckel: den ritas med sitt eget märke.
 * @type {Readonly<Record<string, "ekonomi" | "bibliotek" | "projekt" | "meddelande" | "bokning" | "omrostning">>}
 */
export const APP_IKON = Object.freeze({
  ekonomi: "ekonomi",
  bibliotek: "bibliotek",
  projekt: "projekt",
  meddelanden: "meddelande",
  bokning: "bokning",
  datumomrostning: "omrostning",
});

/**
 * @param {{ handelse?: boolean, arende?: boolean, meddelande?: boolean, etiketter: { handelse: string, arende: string, meddelande: string } }} val
 * @returns {Array<{ id: "handelse" | "arende" | "meddelande", etikett: string, ikon: "handelse" | "arende" | "meddelande" }>}
 */
export function skapaSnabbPoster({ handelse = false, arende = false, meddelande = false, etiketter }) {
  const finns = { handelse: handelse === true, arende: arende === true, meddelande: meddelande === true };
  return SKAPA_SNABB_ORDNING.filter((id) => finns[id]).map((id) => ({ id, etikett: etiketter[id], ikon: id }));
}

/**
 * @param {ReadonlyArray<{ id: string, etikett: string, href: string }>} rader Ur `arkRader`, med etiketten redan på användarens språk.
 * @returns {Array<{ id: string, etikett: string, href: string, ikon: string | null }>}
 */
export function apparSnabbPoster(rader) {
  return (rader ?? []).map((r) => ({
    id: r.id,
    etikett: r.etikett,
    href: r.href,
    ikon: /** @type {string | null} */ (APP_IKON[r.id] ?? null),
  }));
}
