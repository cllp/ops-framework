/**
 * Bytena bakom en ljudadress som spelaren redan har.
 *
 * ⛔ FETCH HÖR HEMMA HÄR, INTE I VYN (check-data-layer). Vågen behöver samplen.
 * Adressen är redan löst: en data-URL, eller en http(s)-adress appen fått från
 * `getDownloadURL`. Det här är inte en databas och inte en ny källa.
 *
 * En data-URL läses utan nät. Allt annat hämtas. Ett fel kastas, och spelaren
 * ritar då en platt våg i stället för att säga att ljudet inte går att spela.
 *
 * @param {string} src
 * @param {AbortSignal} [signal]
 * @returns {Promise<ArrayBuffer>}
 */
export async function lasLjudbytes(src, signal) {
  if (src.startsWith("data:")) return bytesUrDataUrl(src);
  const svar = await fetch(src, { signal });
  if (!svar.ok) throw new Error(`Ljudet gick inte att läsa (${svar.status}).`);
  return svar.arrayBuffer();
}

/**
 * @param {string} src
 * @returns {ArrayBuffer}
 */
function bytesUrDataUrl(src) {
  const komma = src.indexOf(",");
  if (komma < 0) throw new Error("Data-URL:en saknar innehåll.");
  const meta = src.slice(0, komma);
  const kropp = src.slice(komma + 1);
  if (!/;base64/i.test(meta)) {
    return new TextEncoder().encode(decodeURIComponent(kropp)).buffer;
  }
  const bin = atob(kropp);
  const ut = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) ut[i] = bin.charCodeAt(i);
  return ut.buffer;
}
