import { skapaDatakalla, tillampaFraga } from "./kontrakt.js";

/**
 * Två adaptrar som följer med ramverket.
 *
 * ⛔ Den viktigaste raden i hela datalagret står inte här utan i
 * `scripts/check-data-layer.mjs`: en databas-SDK får bara importeras i en
 * adapter, aldrig i en vy.
 *
 * Skälet är att alla bygger ett datalager, och nästan alla får det förstört på
 * samma sätt: en enda vy anropar något källspecifikt "bara den här gången",
 * ingen märker det, och ett år senare går källan inte att byta. Det är exakt
 * samma mekanik som `className` på en primitiv, och den behöver samma medicin:
 * en vakt, inte en överenskommelse.
 */

/**
 * Allt i minnet. För tester, för utveckling, och för att komma igång innan
 * någon bestämt var datan ska bo.
 *
 * @template {{ id: string }} T
 * @param {Record<string, T[]>} [start] Förifyllda samlingar.
 * @returns {import("./kontrakt.js").Datakalla<T>}
 */
export function skapaMinneskalla(start = {}) {
  /** @type {Record<string, T[]>} */
  const lagring = {};
  for (const [namn, rader] of Object.entries(start)) lagring[namn] = rader.map((r) => ({ ...r }));

  let raknare = 0;
  const nyttId = () => `m_${Date.now().toString(36)}_${(raknare += 1)}`;

  /** @param {string} samling */
  const hamta = (samling) => (lagring[samling] ??= []);

  return skapaDatakalla({
    namn: "minne",

    // ⛔ `async` trots att inget väntar. Kontraktet får inte avslöja att just
    // den här källan är snabb, för då skrivs anropsställen som går sönder den
    // dag källan blir ett nätverksanrop.
    async las(samling, id) {
      return hamta(samling).find((r) => r.id === id) ?? null;
    },

    async lista(samling, fraga) {
      return tillampaFraga(hamta(samling), fraga).map((r) => ({ ...r }));
    },

    async skapa(samling, data) {
      const post = /** @type {T} */ ({ ...data, id: /** @type {any} */ (data).id ?? nyttId() });
      hamta(samling).push(post);
      return { ...post };
    },

    async uppdatera(samling, id, data) {
      const rader = hamta(samling);
      const i = rader.findIndex((r) => r.id === id);
      if (i === -1) throw new Error(`minne: ${samling}/${id} finns inte. En uppdatering av något som saknas är ett fel, inte en tyst skapelse.`);
      rader[i] = { ...rader[i], ...data, id };
      return { ...rader[i] };
    },

    async taBort(samling, id) {
      const rader = hamta(samling);
      const i = rader.findIndex((r) => r.id === id);
      if (i === -1) throw new Error(`minne: ${samling}/${id} finns inte.`);
      rader.splice(i, 1);
    },
  });
}

/**
 * Läser JSON-filer över HTTP. En fil per samling.
 *
 * Matchar hur en statisk plattform ser ut innan datan flyttat någonstans:
 * `/assets/data/kostnader.json` blir samlingen `kostnader`.
 *
 * ⛔ Den är LÄSBAR MEN INTE SKRIVBAR, och skrivningarna kastar med en text som
 * säger varför. Att låta dem lyckas tyst i minnet hade varit värre än att neka:
 * användaren ser "Sparat", laddar om, och arbetet är borta.
 *
 * @template {{ id: string }} T
 * @param {{ bas: string, hamta?: typeof fetch }} val
 * @returns {import("./kontrakt.js").Datakalla<T>}
 */
export function skapaJsonKalla({ bas, hamta = fetch }) {
  if (!bas) throw new Error("skapaJsonKalla: bas krävs, till exempel \"/assets/data\".");

  /** @param {string} samling @returns {Promise<T[]>} */
  async function las(samling) {
    const svar = await hamta(`${bas}/${samling}.json`);

    // ⛔ `fetch` kastar INTE på 404 eller 500. Utan den här kontrollen blir ett
    // serverfel en tom lista, och appen visar "inga träffar" när sanningen är
    // att den inte kunde fråga.
    if (!svar.ok) {
      throw new Error(`jsonkalla: ${bas}/${samling}.json svarade ${svar.status}. Det är ett fel, inte en tom samling.`);
    }
    const data = await svar.json();
    if (!Array.isArray(data)) {
      throw new Error(`jsonkalla: ${bas}/${samling}.json innehåller inte en lista. Varje samling är en JSON-array av poster med id.`);
    }
    return data;
  }

  const nekad = (/** @type {string} */ op) => {
    throw new Error(
      `jsonkalla: ${op} går inte mot statiska filer. Byt datakälla i stället för att bygga runt det: en skrivning som ser ut att lyckas men försvinner vid omladdning är värre än ett tydligt nej.`,
    );
  };

  return skapaDatakalla({
    namn: "json",
    async las(samling, id) {
      return (await las(samling)).find((r) => r.id === id) ?? null;
    },
    async lista(samling, fraga) {
      return tillampaFraga(await las(samling), fraga);
    },
    async skapa() {
      return nekad("skapa");
    },
    async uppdatera() {
      return nekad("uppdatera");
    },
    async taBort() {
      return nekad("taBort");
    },
  });
}
