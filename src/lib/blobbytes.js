/**
 * En fils byte ur en `Blob`: `arrayBuffer()` där den finns, annars `FileReader` (äldre webbläsare och jsdom).
 *
 * Utbruten i 0.193.0 (cllp/ops-framework#530): textförhandsvisningen och HTML-rutan hade var sin kopia, och PDF-vyn hade blivit den tredje (regel 2).
 *
 * @param {Blob} blob
 * @returns {Promise<ArrayBuffer>}
 */
export function blobBytes(blob) {
  if (typeof blob?.arrayBuffer === "function") return blob.arrayBuffer();
  return new Promise((los, fel) => {
    const l = new FileReader();
    l.onload = () => los(/** @type {ArrayBuffer} */ (l.result));
    l.onerror = () => fel(l.error ?? new Error("Filen gick inte att läsa."));
    l.readAsArrayBuffer(blob);
  });
}
