/**
 * En fils byte bakom en adress som Biblioteket redan har löst (0.193.0, cllp/ops-framework#530).
 *
 * ⛔ FETCH HÖR HEMMA HÄR, INTE I VYN (check-data-layer), som `ljudbytes.js`. PDF-vyn ritar filen ur dess byte, och när appen inte ger `hamtaFil` (gästens bibliotek, där servern svarar med en signerad
 * adress för en fil som visas) hämtas byten ur den adressen. Det är inte en ny källa: adressen kom från appens `hamtaAdress` eller `filUrl`.
 *
 * ⛔ ADRESSEN RITAS ALDRIG. Den hämtas hit och lämnar inte funktionen, så lagringens adress syns varken i vyn eller i ett adressfält.
 *
 * @param {string} adress
 * @returns {Promise<Blob>}
 */
export async function lasFilbytes(adress) {
  if (typeof adress !== "string" || adress === "") throw new Error("Filen har ingen adress.");
  const svar = await fetch(adress);
  if (!svar.ok) throw new Error(`Filen gick inte att hämta (${svar.status}). Försök igen om en stund.`);
  return svar.blob();
}
