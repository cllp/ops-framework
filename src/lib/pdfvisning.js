/**
 * En PDF i appens egen vy (0.193.0, cllp/ops-framework#530). Det som Biblioteket behöver för att välja visningen: sorten, adressen till det egna fönstret och appens adress till workern.
 * Sidbytet, tangenterna, svepet och skalan i presentationen ligger i `lib/pdfpresentation.js`, som bara den lata vyn läser.
 *
 * ══ ⛔ HÄNDELSEN ═════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-11-06, med en skärmbild av en PDF som öppnats direkt från lagringen i Edge: "Det är inte så bra att det står firebase storage mm när man presenterar. Går det att köra PDF i ett eget fönster som döljer den
 * länkraden ungefär som html-filen och sedan att man kan visa pdf:en i presentationsläge, helskärm, så att inte LIFE-HUB syns heller?" Ett tryck på filnamnet öppnade lagringens signerade adress, och webbläsarens egen
 * visare ritade filen med adressen synlig.
 *
 * ══ ⛔ VARFÖR FILEN ÄR EGEN ══════════════════════════════════════════════════════════════════════════════════════════
 *
 * Biblioteket läser den här filen för `arPdfDokument` och `pdfVyAdress`, och hamnar i appens startfil. pdf.js (`pdfjs-dist`) och vyn läses in först när en PDF visas (`OpsPdfVisningLat`), och de får aldrig följa med
 * hit: `check:delbarhet` mäter att varken `OpsPdfVisning`, `laddaPdfjs` eller `pdfjs-dist` finns i en startfil som importerar `OpsBibliotek`.
 */
import { normaliseraMime } from "./bibliotek.js";
import { provadVyAdress } from "./htmldokument.js";

/** MIME för en PDF. */
export const PDF_MIME = "application/pdf";

/**
 * Är MIME en PDF?
 * @param {unknown} mime
 * @returns {boolean}
 */
export function arPdfMime(mime) {
  return normaliseraMime(mime) === PDF_MIME;
}

/**
 * Är posten en PDF? En fil med MIME `application/pdf`.
 * @param {{ typ?: unknown, fil?: { mime?: unknown } | null } | null | undefined} post
 * @returns {boolean}
 */
export function arPdfDokument(post) {
  return post?.typ === "fil" && arPdfMime(post.fil?.mime);
}

/**
 * Adressen till PDF:ens eget fönster, ur appens `oppnaPdf(post)`, eller `""` när posten inte ska öppnas så. Samma regel som `htmlVyAdress`: funktionen anropas bara för en PDF med en fil, och svaret ska vara en sida i
 * appen (`/…`) eller en `http(s)`-adress. En `blob:`-, `data:`- eller `javascript:`-adress kastar (`provadVyAdress`).
 *
 * ⛔ ADRESSEN ÄR APPENS SIDA, ALDRIG FILENS. Hela poängen med vyn är att lagringens adress aldrig syns i adressfältet.
 *
 * @param {unknown} oppnaPdf `(post) => string | null | undefined`, eller något annat (då `""`).
 * @param {{ typ?: unknown, fil?: { mime?: unknown, sokvag?: unknown } | null } | null | undefined} post
 * @returns {string}
 */
export function pdfVyAdress(oppnaPdf, post) {
  if (typeof oppnaPdf !== "function") return "";
  if (!arPdfDokument(post) || typeof post?.fil?.sokvag !== "string" || post.fil.sokvag === "") return "";
  return provadVyAdress(oppnaPdf(post), "oppnaPdf");
}

// ── Workern ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** @type {string} */
let workerAdress = "";

/**
 * Adressen till pdf.js-workern, när appen ger den själv (0.193.0). Utan den räknar vyn fram adressen med `new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url)`, som Vite gör till en egen fil i appens bygge.
 *
 * ⛔ ANROPAS FÖRE FÖRSTA PDF:EN. Ett anrop efter att pdf.js laddats ändrar inget för den sidan, eftersom pdf.js har startat sin worker då. Ett tomt värde tar bort appens adress.
 * Se README, avsnittet om PDF, för när appen behöver den (Vites utvecklingsläge med förbuntade beroenden, eller en annan bundler än Vite).
 *
 * @param {string} adress
 */
export function sattPdfWorker(adress) {
  if (typeof adress !== "string") throw new Error(`sattPdfWorker: adressen ska vara en text, fick ${typeof adress}.`);
  workerAdress = adress;
}

/** Appens adress till workern, eller `""`. Läses av `lib/pdfjs.js`. */
export function pdfWorkerAdress() {
  return workerAdress;
}
