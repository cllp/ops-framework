import { createMemorySource } from "../data/adapters.js";

/**
 * Minnesadaptern med en prenumeration, för proven av chattens lyssnare (#273 och framåt).
 *
 * ⛔ MINNESADAPTERN KAN INTE PRENUMERERA, med avsikt (kontraktets regel 5). Proven av statusraden, reaktionerna och fästningarna
 * mäter vad vyn gör när någon ANNAN skriver, och det kräver en källa som säger till. Den här lyssnar på varje skrivning och läser
 * om frågan, med samma `applyQuery` som `list`, så att urvalet är detsamma som en läsning hade gett.
 *
 * @param {Record<string, any[]>} [seed]
 */
export function levandeKalla(seed = {}) {
  const bas = createMemorySource(seed);
  /** @type {Set<() => void>} */
  const lyssnare = new Set();
  const signal = () => {
    for (const l of [...lyssnare]) l();
  };
  /** @param {(...a: any[]) => Promise<any>} f */
  const medSignal = (f) => async (/** @type {any[]} */ ...a) => {
    const svar = await f(...a);
    signal();
    return svar;
  };
  return /** @type {any} */ ({
    ...bas,
    create: medSignal(bas.create),
    update: medSignal(bas.update),
    remove: medSignal(bas.remove),
    batch: medSignal(/** @type {any} */ (bas).batch),
    /** @param {string} c @param {any} q @param {{ onData: (r: any[]) => void, onError: (e: Error) => void }} l */
    subscribe(c, q, l) {
      let oppen = true;
      const las = () => {
        bas.list(c, q).then(
          (r) => oppen && l.onData(r),
          (e) => oppen && l.onError(e),
        );
      };
      lyssnare.add(las);
      las();
      return () => {
        oppen = false;
        lyssnare.delete(las);
      };
    },
  });
}
