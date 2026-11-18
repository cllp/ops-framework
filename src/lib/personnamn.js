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
 * ⛔ FYRA UTFALL, I DEN HÄR ORDNINGEN:
 *
 *   1. Medlemskapets eget `namn` (#138, det denormaliserade). Ett namn som är samma sträng som uid:t räknas inte.
 *      Roten är att en app skickar `namn || userId` (lifehub.app#714, rättas i lifehub.app PR 729). Skyddet står kvar
 *      här så att ett uid som ändå kommer in aldrig ritas. QA 2026-11-09: den egna svarsraden stod
 *      `RtciJvze03MRhUGvaJFH1FjzPqM2 (du)`.
 *   2. Är raden DEN INLOGGADES: namnet ur inloggningen (`useOpsAuth().user.namn`). Saknas det: e-postadressen
 *      (`user.email`). Personen vet sitt eget namn, och adressen när namnet saknas, så en rad som säger "Namn saknas"
 *      om en själv vore ett fel i sig.
 *   3. Radens egen e-postadress (`alternativ.epost`, medlemskapets `epost` sedan 0.234.0). Se HÄNDELSEN nedan.
 *   4. Annars, MEDAN NAMNEN HÄMTAS (`laddar`): `NAMN_LADDAS`, "Hämtar namn …". Se HÄNDELSEN 0.240.0 nedan.
 *   5. Annars `NAMN_SAKNAS`, "Okänd person". Bara för den som varken har namn eller adress när allt är hämtat, alltså en
 *      raderad eller okänd person.
 *
 * ══ ⛔ HÄNDELSEN: "NAMN SAKNAS SKALL ALDRIG FINNAS INTE ENS UNDER PROGRESS" (0.240.0) ════════════════════════════
 *
 * CP 2026-11-18, med en skärmbild av gruppens Medlemmar: "Medans medlemmar listas och hämtas kan det står Namn Saknas
 * innan den har satt namnet ... Namn Saknas skall aldrig finnas inte ens under progress. Då får det hellre står hämtar
 * användarinfo eller nåt annat." Mätt i appen samma dag: adressen till en medlem utan namn kommer ur ett eget anrop
 * till servern (`useMedlemsadresser`) efter att listan ritats, och fram till svaret föll raden till utfall 5. Ett fel som
 * syns i varje sidladdning läses som att appen inte vet vem personen är.
 *
 * Därför två ändringar. Vyn som vet att namnen hämtas skickar `laddar`, och raden säger då "Hämtar namn …". Och den
 * sista reserven är inte längre "Namn saknas" utan "Okänd person" (inte "Medlem", som är rollens namn i samma rad): en neutral text som inte låter som ett fel. Den är fortsatt
 * märkt med `saknas` (och `data-namn-saknas` i DOM:en), så den går att hitta och räkna.
 *
 * ══ ⛔ HÄNDELSEN: "DET FÅR ALDRIG STÅ NAMN SAKNAS" (0.234.0, cllp/lifehub.app#861) ═════════════════════════════════
 *
 * CP 2026-11-16: "När Collan hade loggat in stod hans namn som Namn Saknas innan han gick ut och sparade om sin
 * profil." Rotorsaken låg i Identity: tokenen som lämnades till hubben utfärdades innan namnet sattes, så medlemskapet
 * skrevs utan namn och alla andra i gruppen såg "Namn saknas" tills han själv sparade sin profil. Utfall 2 hjälpte
 * bara honom själv. CP samma kväll: "Det får ALDRIG stå namn saknas. Det måste alltid finnas en fallback på eposten."
 * Därför bär medlemskapet adressen, och utfall 3 visar den för alla andra. Ett namn som saknas av vilken orsak som
 * helst (en gammal token, ett konto utan namn, en väg in vi inte känner till än) ger då en adress som går att känna
 * igen, aldrig en rad som ser ut som ett fel.
 *
 * ⛔ `saknas` ÄR SANT I UTFALL 4 OCH SKA BÄRAS TILL DOM:en (`data-namn-saknas`), så att ett prov, en
 * skärmbildsvakt eller en människa med utvecklarverktygen kan hitta raderna. En reserv som ser ut som ett namn
 * är tyst nedsläpp (arbetsreglernas punkt 5); en som syns och går att räkna är en mätning.
 *
 * ⛔ FILEN ÄR REN och ligger därför i båda ingångarna: en Cloud Function som bygger en notis ska inte dra in React.
 */

/** Texten när varken namn eller adress finns och inget hämtas (0.240.0: "Okänd person", förut "Namn saknas"). */
export const NAMN_SAKNAS = "Okänd person";

/** Texten medan namnen hämtas (0.240.0). Se HÄNDELSEN ovan. */
export const NAMN_LADDAS = "Hämtar namn …";

/** Samma två texter per språk, för vyer som ritar på engelska. */
export const NAMN_RESERV = Object.freeze({
  sv: Object.freeze({ saknas: NAMN_SAKNAS, laddar: NAMN_LADDAS }),
  en: Object.freeze({ saknas: "Unknown person", laddar: "Loading name …" }),
});

/**
 * @param {unknown} namn Medlemskapets (eller profilens) namn, om det finns.
 * @param {object} [alternativ]
 * @param {string} [alternativ.id] Personens uid. Används BARA för att avgöra om raden är den inloggades, aldrig som text.
 * @param {{ id?: string, namn?: string, email?: string } | null} [alternativ.inloggad] Den inloggade, ur `useOpsAuth().user`.
 * @param {unknown} [alternativ.epost] Radens e-postadress, medlemskapets `epost` (0.234.0). Visas när namnet saknas.
 * @param {string} [alternativ.saknas] Texten när varken namn eller adress finns. Förval `NAMN_SAKNAS`.
 * @param {boolean} [alternativ.laddar] Sant medan vyn hämtar namn eller adresser: då blir reserven `alternativ.laddas` (0.240.0).
 * @param {string} [alternativ.laddas] Texten medan namnen hämtas. Förval `NAMN_LADDAS`.
 * @returns {{ text: string, saknas: boolean, laddar?: boolean }}
 */
export function personnamn(namn, alternativ = {}) {
  const { id, inloggad, epost: radensEpost, saknas = NAMN_SAKNAS, laddar = false, laddas = NAMN_LADDAS } = alternativ;
  const text = (/** @type {unknown} */ v) => (typeof v === "string" ? v.trim() : "");
  const eget = text(namn);
  // ⛔ UID SOM NAMN ÄR INGET NAMN (lifehub.app#714). Appen skickade `namn || userId`. Roten rättas där (PR 729). Här vinner ett ifyllt namn bara när det inte är uid:t.
  if (eget && eget !== id) return { text: eget, saknas: false };
  if (id && inloggad?.id === id) {
    const loggadesNamn = text(inloggad.namn);
    if (loggadesNamn && loggadesNamn !== id) return { text: loggadesNamn, saknas: false };
    const epost = text(inloggad.email);
    if (epost) return { text: epost, saknas: false };
  }
  // ⛔ ADRESSEN FÖRE "NAMN SAKNAS", OCKSÅ FÖR ALLA ANDRA (cllp/lifehub.app#861, CP 2026-11-16: "Det måste alltid finnas en fallback på eposten").
  const adress = text(radensEpost);
  if (adress && adress !== id) return { text: adress, saknas: false };
  // ⛔ MEDAN NAMNEN HÄMTAS STÅR "Hämtar namn …", ALDRIG RESERVEN (0.240.0, CP 2026-11-18: "inte ens under progress").
  if (laddar) return { text: laddas, saknas: true, laddar: true };
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
  console.warn(`ops-framework: medlemskapet för "${id}" saknar både namn och e-post och ritas som "${NAMN_SAKNAS}". Kör bakfyllnaden (bakfyllMedlemsnamn) eller låt personen spara sitt namn i Profil.`);
}

/** Bara för prov: glömmer vilka som redan varnats om. */
export function glomVarnade() {
  varnade.clear();
}
