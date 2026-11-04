/**
 * Vad snabbmenyerna visar. Rent, så att ordningen går att pröva utan att rita.
 *
 * ══ ⛔ SKAPA ÄR TRE RADER, I ARKETS ORDNING ═══════════════════════════════════
 *
 * Plusets ark ritar Ny händelse, Nytt ärende, Nytt meddelande och Ny grupp i den ordningen (OpsAppShell, renderSkapaLista),
 * och bara när appen gett mottagaren. Snabbmenyn läser samma fyra frågor. Ny grupp är med för att telefonen annars
 * saknar väg att skapa en grupp (CP 2026-11-04). Modulernas `skapa.rad` (Nytt projekt) och registreringar (Skapa app)
 * ingår inte: ett projekt skapas i Projekt, och Skapa app står i Appars huvud.
 *
 * ══ ⛔ APPAR ÄR VYNS KORT, INTE HUBBEN ═══════════════════════════════════════
 *
 * Hubb är instansen. Appar är gruppens installerade kort. Listan kommer ur `arkRader`, samma urval som Appar-vyns kort
 * (`hubbForGrupp`): gruppens `moduler`, i den ordningen, bara de som har ett kort. En app som vyn inte ritar som kort
 * (en ren tilläggsmodul) står inte här heller.
 */

/** @type {readonly ["handelse", "arende", "meddelande", "grupp"]} */
export const SKAPA_SNABB_ORDNING = Object.freeze(["handelse", "arende", "meddelande", "grupp"]);

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
 * @param {{ handelse?: boolean, arende?: boolean, meddelande?: boolean, grupp?: boolean, etiketter: { handelse: string, arende: string, meddelande: string, grupp: string } }} val
 * @returns {Array<{ id: "handelse" | "arende" | "meddelande" | "grupp", etikett: string, ikon: "nyHandelse" | "nyttArende" | "meddelande" | "grupp" }>}
 */
export function skapaSnabbPoster({ handelse = false, arende = false, meddelande = false, grupp = false, etiketter }) {
  const finns = { handelse: handelse === true, arende: arende === true, meddelande: meddelande === true, grupp: grupp === true };
  return SKAPA_SNABB_ORDNING.filter((id) => finns[id]).map((id) => ({ id, etikett: etiketter[id], ikon: SKAPA_IKON[id] }));
}

/**
 * Ikonnyckeln för varje skapa-val (0.185.0): de bilder som betyder att något NYTT skapas, samma som knapparna Nytt ärende och Ny händelse
 * (`nyttArende`, `nyHandelse`, 0.184.0). `arende` i lexikonet är ärendet som redan finns, och en nyckel som inte finns hade ritat Appars bild.
 * @type {Readonly<Record<"handelse" | "arende" | "meddelande" | "grupp", "nyHandelse" | "nyttArende" | "meddelande" | "grupp">>}
 */
export const SKAPA_IKON = Object.freeze({ handelse: "nyHandelse", arende: "nyttArende", meddelande: "meddelande", grupp: "grupp" });

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
