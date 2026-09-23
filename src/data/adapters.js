import { createDataSource, applyQuery } from "./contract.js";

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
 * @param {Record<string, T[]>} [seed] Förifyllda samlingar.
 * @returns {import("./contract.js").DataSource<T>}
 */
export function createMemorySource(seed = {}) {
  /** @type {Record<string, T[]>} */
  const store = {};
  for (const [name, rows] of Object.entries(seed)) store[name] = rows.map((r) => ({ ...r }));

  let counter = 0;
  const newId = () => `m_${Date.now().toString(36)}_${(counter += 1)}`;

  /** @param {string} collectionName */
  const load = (collectionName) => (store[collectionName] ??= []);

  return createDataSource({
    name: "minne",

    // ⛔ `async` trots att inget väntar. Kontraktet får inte avslöja att just
    // den här källan är snabb, för då skrivs anropsställen som går sönder den
    // dag källan blir ett nätverksanrop.
    async read(collectionName, id) {
      return load(collectionName).find((r) => r.id === id) ?? null;
    },

    async list(collectionName, query) {
      return applyQuery(load(collectionName), query).map((r) => ({ ...r }));
    },

    async create(collectionName, data) {
      const entry = /** @type {T} */ ({ ...data, id: /** @type {any} */ (data).id ?? newId() });
      load(collectionName).push(entry);
      return { ...entry };
    },

    async update(collectionName, id, data) {
      const rows = load(collectionName);
      const i = rows.findIndex((r) => r.id === id);
      if (i === -1) throw new Error(`minne: ${collectionName}/${id} finns inte. En uppdatering av något som saknas är ett fel, inte en tyst skapelse.`);
      rows[i] = { ...rows[i], ...data, id };
      return { ...rows[i] };
    },

    async remove(collectionName, id) {
      const rows = load(collectionName);
      const i = rows.findIndex((r) => r.id === id);
      if (i === -1) throw new Error(`minne: ${collectionName}/${id} finns inte.`);
      rows.splice(i, 1);
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
 * @param {{ base: string, load?: typeof fetch }} config
 * @returns {import("./contract.js").DataSource<T>}
 */
export function createJsonSource(config) {
  /*
   * ⛔ DESTRUKTURERINGEN LIGGER I KROPPEN OCH INTE I PARAMETERLISTAN (#129 punkt 5).
   *
   * Med `({ x })` i signaturen kraschar ett anrop UTAN argument på destrukturen,
   * med "Cannot destructure property 'x' of 'undefined'". Det felet nämner en
   * variabel inne i ramverket och inte vad appen glömde, och det pekar mot en fil
   * anroparen aldrig öppnat.
   *
   * ⛔ `= {}` I SIGNATUREN VAR FEL SVAR: typkontrollen avvisade det, och med rätta.
   * Typen säger att fälten krävs, och det ska den fortsätta göra, annars tappar en
   * typad anropare sitt kompileringsfel. Nu får båda vad de behöver: typen är
   * strikt, och kroppen tål ingenting så att valideringen nedan hinner tala.
   */
  const { base, load = fetch } = config ?? /** @type {any} */ ({});
  if (!base) throw new Error("createJsonSource: bas krävs, till exempel \"/assets/data\".");

  /** @param {string} collectionName @returns {Promise<T[]>} */
  async function read(collectionName) {
    const answer = await load(`${base}/${collectionName}.json`);

    // ⛔ `fetch` kastar INTE på 404 eller 500. Utan den här kontrollen blir ett
    // serverfel en tom lista, och appen visar "inga träffar" när sanningen är
    // att den inte kunde fråga.
    if (!answer.ok) {
      throw new Error(`jsonkalla: ${base}/${collectionName}.json svarade ${answer.status}. Det är ett fel, inte en tom samling.`);
    }
    const data = await answer.json();
    if (!Array.isArray(data)) {
      throw new Error(`jsonkalla: ${base}/${collectionName}.json innehåller inte en lista. Varje samling är en JSON-array av poster med id.`);
    }
    return data;
  }

  const denied = (/** @type {string} */ op) => {
    throw new Error(
      `jsonkalla: ${op} går inte mot statiska filer. Byt datakälla i stället för att bygga runt det: en skrivning som ser ut att lyckas men försvinner vid omladdning är värre än ett tydligt nej.`,
    );
  };

  return createDataSource({
    name: "json",
    async read(collectionName, id) {
      return (await read(collectionName)).find((r) => r.id === id) ?? null;
    },
    async list(collectionName, query) {
      return applyQuery(await read(collectionName), query);
    },
    async create() {
      return denied("skapa");
    },
    async update() {
      return denied("uppdatera");
    },
    async remove() {
      return denied("taBort");
    },
  });
}
