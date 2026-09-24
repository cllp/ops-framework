/**
 * Den färgade vänsterkanten, och kravet som följer med den.
 *
 * ⛔ DEN BOR HÄR FÖR ATT TVÅ YTOR RITAR DEN, INTE FÖR ATT DET ÄR SNYGGARE.
 *
 * `OpsCard` hade kanten först, och när kalenderns postkort skulle få samma sak
 * fanns två vägar: kopiera de sex klassnamnen och kastet, eller flytta dem hit.
 * En kopia hade börjat glida isär samma vecka den skrevs, och det som glider
 * först är just kravet på ett ord: den ena ytan hade fortsatt kasta och den
 * andra hade tyst ritat en färg utan betydelse.
 *
 * ⛔ KLASSNAMNEN STÅR UTSKRIVNA, INTE BYGGDA MED `border-l-identity-${n}`.
 *
 * Tailwind läser källkoden som text och hittar bara klasser som faktiskt står
 * där. En interpolerad sträng genererar ingen CSS, och resultatet är ett kort
 * utan kantfärg som fungerar i utvecklingsläge och tappar färgen i bygget.
 */
const KANTKLASSER = {
  1: "border-l-identity-1",
  2: "border-l-identity-2",
  3: "border-l-identity-3",
  4: "border-l-identity-4",
  5: "border-l-identity-5",
  6: "border-l-identity-6",
};

/**
 * Klassen för en kant, eller `null` när ingen kant begärts.
 *
 * ⛔ FÄRGEN ENSAM FÅR ALDRIG BÄRA BETYDELSEN, och det är samma regel som gäller
 * för identitet och proveniens. En kant i en färg säger ingenting till den som
 * inte redan lärt sig koden, går inte att läsa upp, och är osynlig för var
 * tjugonde man. Därför krävs ett ord, och ytan kastar hellre än att rita en
 * färg som låtsas betyda något.
 *
 * @param {1|2|3|4|5|6} [edge] Plats i identitetspaletten.
 * @param {string} [edgeLabel] Vad kanten betyder. ⛔ Krävs när `edge` finns.
 * @param {string} [avsandare] Komponentens namn, så felet pekar på rätt yta.
 * @returns {string | null}
 */
export function kantKlass(edge, edgeLabel, avsandare = "Kanten") {
  if (edge === undefined) return null;

  const klass = KANTKLASSER[edge];
  if (!klass) {
    throw new Error(`${avsandare}: okänd edge "${edge}". Giltiga: ${Object.keys(KANTKLASSER).join(", ")}.`);
  }
  if (!edgeLabel) {
    throw new Error(
      `${avsandare}: edge kräver edgeLabel. En färgad kant utan ord betyder ingenting för den som inte ser färgen eller inte lärt sig koden.`,
    );
  }
  return klass;
}

/** Platserna som finns. För prov och för den som bygger en egen yta. */
export const KANTPLATSER = Object.keys(KANTKLASSER).map(Number);
