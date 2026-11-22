/**
 * En fil till en signerad PUT-adress (0.254.0, cllp/lifehub.app#928 del 2): projektgästens uppladdning, steg två av tre (`laddaUpp` gav adressen och huvudena, `laddaUppKlar` gör filen till en post).
 *
 * ⛔ FETCH HÖR HEMMA HÄR, INTE I VYN (check-data-layer), som `filbytes.js`. Adressen och huvudena kom från gästens tjänst, och de skickas exakt som de kom: en signerad PUT som bär ett annat
 * huvud än det som signerades nekas av lagringen.
 *
 * ⛔ ETT SVAR SOM INTE ÄR OK KASTAR. `fetch` kastar bara när anropet aldrig kom fram, och en uppladdning som lagringen nekade (403 efter en utgången signering) hade annars gått vidare till
 * `laddaUppKlar` och gjort en post av en fil som inte finns.
 *
 * @param {string} url
 * @param {Record<string, string>} huvuden
 * @param {Blob} fil
 * @returns {Promise<void>}
 */
export async function laddaUppTillAdress(url, huvuden, fil) {
  if (typeof url !== "string" || !url.startsWith("https://")) throw new Error("Uppladdningen har ingen https-adress.");
  const svar = await fetch(url, { method: "PUT", headers: huvuden, body: fil });
  if (!svar.ok) throw new Error(`Filen gick inte att ladda upp (${svar.status}).`);
}
