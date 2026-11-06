/**
 * pdf.js (Mozilla, `pdfjs-dist`), inläst först när en PDF visas (0.193.0, cllp/ops-framework#530).
 *
 * ══ ⛔ BARA I DEN LATA VYN ═════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Filen importeras bara av `OpsPdfVisning`, som `OpsPdfVisningLat` läser in när en PDF ska ritas. pdf.js själv hämtas med en dynamisk import här, så även om den här filen skulle hamna fel följer pdf.js inte med in i en
 * startfil. `check:delbarhet` mäter båda: varken `laddaPdfjs` eller `pdfjs-dist` får finnas i en startfil som importerar `OpsBibliotek`.
 *
 * ══ ⛔ WORKERN ═══════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * pdf.js tolkar filen i en egen worker, och behöver dess adress. Ramverket känner inga sökvägar i appen, så adressen räknas fram med `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)`: Vite känner igen
 * mönstret i appens bygge, löser paketet och lägger workern som en egen fil bredvid appens övriga (mätt i `check:delbarhet`). Har appen gett en adress (`sattPdfWorker`) vinner den. Se README för när det behövs.
 *
 * ══ ⛔ SÄKERHETEN ════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * `isEvalSupported: false`: pdf.js får aldrig bygga kod ur filen. I 6.4.299 finns den vägen inte alls (mätt: varken `new Function` eller `eval(` i `pdf.mjs` eller i workern, och flaggan är borttagen ur pdf.js 6), men
 * flaggan står kvar så att en äldre pdf.js i en app inte tyst öppnar den. `enableXfa: false`: inga XFA-formulär. Inget skript ur PDF:en körs: ingen `scripting`-sandlåda laddas, och vyn ritar bara sidorna på en
 * canvas (inga länkar, inga formulärfält, inget textlager).
 */
import { pdfWorkerAdress } from "./pdfvisning.js";
import { blobBytes } from "./blobbytes.js";

/** Det som skickas till `getDocument` utöver byten. Se filhuvudet. */
export const PDF_DOKUMENTVAL = Object.freeze({ isEvalSupported: false, enableXfa: false, stopAtErrors: false });

/** @type {Promise<any> | null} */
let pdfjsLaddas = null;

/**
 * pdf.js, med workern satt. Ett misslyckat försök glöms, så att Försök igen hämtar på nytt (ett minne av felet hade gjort knappen död).
 * @returns {Promise<any>}
 */
export function laddaPdfjs() {
  if (!pdfjsLaddas) {
    pdfjsLaddas = import("pdfjs-dist")
      .then((pdfjs) => {
        if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerAdress() || standardWorker();
        return pdfjs;
      })
      .catch((e) => {
        pdfjsLaddas = null;
        throw e;
      });
  }
  return pdfjsLaddas;
}

/** Workerns adress i appens bygge. Se filhuvudet. */
function standardWorker() {
  return new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).href;
}

/**
 * Öppnar en PDF ur dess byte. Svarar dokumentet och en funktion som stänger det (workern och minnet).
 *
 * ⛔ BYTEN KOPIERAS: pdf.js för över sin buffert till workern, och den som anropar behåller sin egen (för Ladda ned).
 *
 * @param {Blob | ArrayBuffer | Uint8Array} filen
 * @returns {Promise<{ dokument: any, stang: () => void }>}
 */
export async function oppnaPdf(filen) {
  const pdfjs = await laddaPdfjs();
  const data = new Uint8Array(filen instanceof Uint8Array ? filen : filen instanceof ArrayBuffer ? filen : await blobBytes(filen)).slice();
  const uppgift = pdfjs.getDocument({ data, ...PDF_DOKUMENTVAL });
  try {
    const dokument = await uppgift.promise;
    return { dokument, stang: () => void uppgift.destroy() };
  } catch (e) {
    void uppgift.destroy();
    throw e;
  }
}

/**
 * Felet som en mening, efter pdf.js sort: lösenord, en fil som inte är en PDF, eller något annat.
 * @param {unknown} e
 * @returns {"losenord" | "trasig" | "annat"}
 */
export function pdfFelsort(e) {
  const namn = e && typeof e === "object" && "name" in e ? String(/** @type {any} */ (e).name) : "";
  if (namn === "PasswordException") return "losenord";
  if (namn === "InvalidPDFException") return "trasig";
  return "annat";
}
