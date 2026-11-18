/**
 * Det rena i kortdragningen (0.241.0, cllp/lifehub.app#894): var ett släppt kort hamnar, och hur en ordning ändras. Ingen DOM, så att det går
 * att pröva utan layout. Kroken `useKortdragning` mäter rutorna och anropar de här.
 */

/**
 * Platsen i en kolumn där ett kort släpps: antalet kort vars mittlinje ligger ovanför pekaren. Kortet som dras räknas inte, så att
 * ett kort som släpps på sin egen plats står kvar.
 *
 * @param {ReadonlyArray<{ id: string, top: number, height: number }>} kort Kolumnens kort i visad ordning, med sina mått.
 * @param {number} y Pekarens läge, i samma koordinater som `top`.
 * @param {string} [dras] Id för kortet som dras.
 * @returns {number}
 */
export function slappIndex(kort, y, dras) {
  let index = 0;
  for (const k of kort) {
    if (k.id === dras) continue;
    if (y > k.top + k.height / 2) index += 1;
    else break;
  }
  return index;
}

/**
 * En ny ordning efter ett drag: kortet `id` läggs på plats `index` bland kolumnens kort, och kolumnens ordning står först i resultatet,
 * före de id som redan fanns i ordningen. Kolumnerna är skilda mängder, så de andra kolumnernas inbördes ordning ändras inte.
 *
 * ⛔ TAKET (`max`) KAPAR DE ÄLDSTA, INTE DE NYA. En ordning som växer utan tak är ett dokument som till slut inte går att skriva.
 *
 * @param {ReadonlyArray<string>} ordning Gruppens ordning före draget.
 * @param {ReadonlyArray<string>} kolumnen Målkolumnens kort i visad ordning, före draget (kortet själv får finnas med).
 * @param {string} id
 * @param {number} index
 * @param {number} [max]
 * @returns {string[]}
 */
export function flyttaIOrdning(ordning, kolumnen, id, index, max = 500) {
  const utan = kolumnen.filter((k) => k !== id);
  const plats = Math.max(0, Math.min(index, utan.length));
  const ny = [...utan.slice(0, plats), id, ...utan.slice(plats)];
  const satta = new Set(ny);
  return [...ny, ...ordning.filter((k) => !satta.has(k))].slice(0, max);
}

/**
 * Kolumnens kort i gruppens ordning: först de som har en plats i ordningen, i den ordningen, sedan resten i den ordning de kom.
 *
 * @template T
 * @param {ReadonlyArray<T>} kort
 * @param {ReadonlyArray<string>} ordning
 * @param {(k: T) => string} idFor
 * @returns {T[]}
 */
export function ordnaEfter(kort, ordning, idFor) {
  const plats = new Map(ordning.map((id, i) => [id, i]));
  const med = kort.filter((k) => plats.has(idFor(k))).sort((a, b) => /** @type {number} */ (plats.get(idFor(a))) - /** @type {number} */ (plats.get(idFor(b))));
  const utan = kort.filter((k) => !plats.has(idFor(k)));
  return [...med, ...utan];
}
