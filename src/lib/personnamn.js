/**
 * Namnet på en person i en vy, och aldrig hens id (0.40.1, #218).
 *
 * ══ ⛔ ETT ID VISAS ALDRIG FÖR EN MÄNNISKA ═══════════════════════════════════════════════════════════
 *
 * CP 2026-10-01, med en skärmbild från telefonen av "Nytt ärende": under "Till" stod den inloggade som
 * `eA2ILzNei5TQ2rcHy68aBZPpR1B3 (du)`. "Bra om användarnamnet inte är Guid." Raden kom ur `p.namn || p.userId`
 * i `OpsMottagare`, och samma form fanns på fem ställen till (`OpsMeddelanden`, `OpsGruppSida`, `OpsMedlemmar`,
 * `samtalsnotiser`, `skaparensNamn`): medlemskapet saknade `namn`, och reserven var uid:t, alltså en maskinnyckel
 * i en lista som människor läser. Ett uid är 28 tecken utan mening, och ett sådant i en rad ser ut som ett fel
 * i appen, inte som en rad som skrevs innan namnet fanns.
 *
 * ⛔ TRE UTFALL, I DEN HÄR ORDNINGEN:
 *
 *   1. Medlemskapets eget `namn` (#138, det denormaliserade).
 *   2. Är raden DEN INLOGGADES: namnet ur inloggningen (`useOpsAuth().user.namn`). Personen vet sitt eget namn,
 *      och det finns redan i handen, så en rad som säger "Namn saknas" om en själv vore ett fel i sig.
 *   3. Annars `NAMN_SAKNAS`, en neutral text som INTE ser ut som ett giltigt namn.
 *
 * ⛔ `saknas` ÄR SANT I UTFALL 3 OCH SKA BÄRAS TILL DOM:en (`data-namn-saknas`), så att ett prov, en
 * skärmbildsvakt eller en människa med utvecklarverktygen kan hitta raderna. En reserv som ser ut som ett namn
 * är tyst nedsläpp (arbetsreglernas punkt 5); en som syns och går att räkna är en mätning.
 *
 * ⛔ FILEN ÄR REN och ligger därför i båda ingångarna: en Cloud Function som bygger en notis ska inte dra in React.
 */

/** Texten som visas när namnet saknas. Ser medvetet inte ut som ett namn. */
export const NAMN_SAKNAS = "Namn saknas";

/**
 * @param {unknown} namn Medlemskapets (eller profilens) namn, om det finns.
 * @param {object} [alternativ]
 * @param {string} [alternativ.id] Personens uid. Används BARA för att avgöra om raden är den inloggades, aldrig som text.
 * @param {{ id?: string, namn?: string } | null} [alternativ.inloggad] Den inloggade, ur `useOpsAuth().user`.
 * @param {string} [alternativ.saknas] Texten när namnet saknas. Förval `NAMN_SAKNAS`.
 * @returns {{ text: string, saknas: boolean }}
 */
export function personnamn(namn, alternativ = {}) {
  const eget = typeof namn === "string" ? namn.trim() : "";
  if (eget) return { text: eget, saknas: false };
  const { id, inloggad, saknas = NAMN_SAKNAS } = alternativ;
  const loggadesNamn = typeof inloggad?.namn === "string" ? inloggad.namn.trim() : "";
  if (id && inloggad?.id === id && loggadesNamn) return { text: loggadesNamn, saknas: false };
  return { text: saknas, saknas: true };
}

/** @type {Set<string>} */
const varnade = new Set();

/**
 * En varning i konsolen, en gång per person, när en rad ritas utan namn.
 *
 * ⛔ EN GÅNG PER ID och inte per rendering: en lista med femtio rader utan namn ska ge en rad i konsolen per person.
 * ⛔ ALLTID, ÄVEN I PRODUKTION. Ramverket vet inte om bygget är ett utvecklingsbygge (ingen `process`, ingen `import.meta.env`
 * i kärnan), och en gissning hade gjort varningen tyst just där en människa med utvecklarverktygen letar. En rad i en konsol
 * kostar ingenting, och den som ser den får veta vad som ska köras. Id:t skrivs i konsolen (en utvecklare ska kunna slå upp
 * raden), aldrig i gränssnittet.
 *
 * @param {string} id
 */
export function varnaNamnSaknas(id) {
  if (!id || varnade.has(id)) return;
  varnade.add(id);
  console.warn(`ops-framework: medlemskapet för "${id}" saknar namn och ritas som "${NAMN_SAKNAS}". Kör bakfyllnaden (bakfyllMedlemsnamn) eller låt personen spara sitt namn i Profil.`);
}

/** Bara för prov: glömmer vilka som redan varnats om. */
export function glomVarnade() {
  varnade.clear();
}
