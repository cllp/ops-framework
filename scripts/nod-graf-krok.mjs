/**
 * Modulhook som skriver upp VARJE import som Node löser upp: ett JSON-objekt per rad med `spec` (det som stod i importen), `url` (vad den löstes till, saknas om
 * den inte gick att lösa) och `foralder`. Raden skrivs också när uppslaget misslyckas, så att en import av ett paket som inte finns installerat ändå syns.
 *
 * ⛔ Det här är en MÄTNING av modulgrafen i en körande process, till skillnad från `scripts/check-node-side.mjs` som läser källtexten. Den fångar det en regex inte ser:
 * en dynamisk import med en sammansatt sökväg, en re-export, en fil som drar in React genom ett paket.
 */
import { appendFileSync } from "node:fs";

/** @type {string | undefined} */
let logg;

/** @param {{ logg?: string }} data */
export function initialize(data) {
  logg = data?.logg;
}

/**
 * @param {string} spec
 * @param {{ parentURL?: string }} context
 * @param {(spec: string, context: unknown) => Promise<{ url: string }>} nasta
 */
export async function resolve(spec, context, nasta) {
  /** @type {string | undefined} */
  let url;
  try {
    const svar = await nasta(spec, context);
    url = svar.url;
    return svar;
  } finally {
    if (logg) appendFileSync(logg, `${JSON.stringify({ spec, url, foralder: context.parentURL })}\n`);
  }
}
