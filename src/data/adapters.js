import { createDataSource, applyQuery, faltAttTaBort } from "./contract.js";
import { createStorageSource } from "./storage.js";

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

  /*
   * ⛔ TRE SYNKRONA KÄRNOR, EN FÖR VARJE SKRIVNING, SOM BÅDE DE ENSKILDA ANROPEN OCH `batch` ANVÄNDER.
   * Skrev `batch` sin egen kopia av "ett eget id ersätter" och "update av något som saknas är ett fel"
   * kunde de två gå isär, och provsviten hade mätt en `batch` som inte är den enskilda skrivningen.
   */
  /** @param {string} collectionName @param {Partial<T>} data @returns {T} */
  const skapa = (collectionName, data) => {
    const entry = /** @type {T} */ ({ ...data, id: /** @type {any} */ (data).id ?? newId() });
    const rows = load(collectionName);
    const i = rows.findIndex((r) => r.id === entry.id);
    if (i === -1) rows.push(entry);
    else rows[i] = entry;
    return { ...entry };
  };
  /** @param {string} collectionName @param {string} id @param {Partial<T>} data @returns {T} */
  const uppdatera = (collectionName, id, data) => {
    const rows = load(collectionName);
    const i = rows.findIndex((r) => r.id === id);
    if (i === -1) throw new Error(`minne: ${collectionName}/${id} finns inte. En uppdatering av något som saknas är ett fel, inte en tyst skapelse.`);
    // ⛔ `FALT_BORT` tar bort nyckeln (0.40.0), samma sak som Firestores `deleteField()`. Utan det hade ett tömt fält i minnet blivit kvar.
    const nu = { ...rows[i], ...data, id };
    for (const k of faltAttTaBort(data)) delete /** @type {any} */ (nu)[k];
    rows[i] = nu;
    return { ...rows[i] };
  };
  /** @param {string} collectionName @param {string} id */
  const tabort = (collectionName, id) => {
    const rows = load(collectionName);
    const i = rows.findIndex((r) => r.id === id);
    if (i === -1) throw new Error(`minne: ${collectionName}/${id} finns inte.`);
    rows.splice(i, 1);
  };

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

    /**
     * ⛔ ETT EGET ID ERSÄTTER, DET LÄGGER INTE TILL. Samma betydelse som
     * `createFirestoreSource.create`, där ett id ger `setDoc` och alltså skriver
     * över dokumentet.
     *
     * Mätt i cllp/bolag-ops 2026-09-27, när inställningsvyn skulle provas: den
     * här källan la en ANDRA rad med samma id, så `list()` gav två poster där
     * Firestore hade gett en, och `find(r => r.id === x)` svarade med den
     * GAMLA. Provet var rött mot en app som var rätt.
     *
     * ⛔ OCH DET ÄR DEN FARLIGA RIKTNINGEN SOM ÄR SKÄLET, inte den här gången.
     * Ett prov som är rött mot rätt kod kostar en kväll. Nästa gång kan det
     * lika gärna vara grönt mot fel kod: en adapter som står in för en annan i
     * proven måste svara likadant på samma anrop, annars mäter provsviten en
     * app som inte finns.
     *
     * ⛔ INGET ID GER FORTFARANDE EN NY POST med ett genererat id, precis som
     * `addDoc`. Det är den andra halvan av samma kontrakt.
     */
    async create(collectionName, data) {
      return skapa(collectionName, data);
    },

    async update(collectionName, id, data) {
      return uppdatera(collectionName, id, data);
    },

    async remove(collectionName, id) {
      tabort(collectionName, id);
    },

    /**
     * Läs och skriv i ett steg (kontraktets regel 7). Kroppen väntar inte på något mellan jämförelsen och
     * skrivningen, så två samtidiga anrop kan inte båda se villkoret stämma: det ena hinner skriva först.
     *
     * ⛔ JÄMFÖRELSEN ÄR LIKHET, SOM `where`. Ett villkor på ett fält som saknas stämmer inte.
     */
    async updateIf(collectionName, id, villkor, data) {
      if (!villkor || typeof villkor !== "object" || Object.keys(villkor).length === 0) {
        throw new Error("minne.updateIf: minst ett villkor krävs. Utan villkor är det en vanlig update.");
      }
      const rad = load(collectionName).find((r) => r.id === id);
      if (!rad) return { updated: false, row: null };
      const stammer = Object.entries(villkor).every(([k, v]) => /** @type {any} */ (rad)[k] === v);
      if (!stammer) return { updated: false, row: { ...rad } };
      return { updated: true, row: uppdatera(collectionName, id, data) };
    },

    /**
     * Allt eller inget (kontraktets regel 6). Skrivningarna görs mot minnet i tur och ordning, och kastar
     * en av dem sätts HELA lagret tillbaka till hur det var före anropet innan felet går vidare.
     *
     * ⛔ ÅTERSTÄLLNINGEN ÄR EN KOPIA TAGEN FÖRE, INTE EN ÅNGRING EFTER. En ångring per skrivning hade
     * behövt veta vad varje `create` ersatte, och en `remove` vilken rad den tog bort: den kopian är
     * exakt det en databas gör, fast här i ett par rader.
     */
    async batch(ops) {
      if (!Array.isArray(ops) || ops.length === 0) {
        throw new Error("minne.batch: en lista med minst en skrivning krävs. En tom batch är en batch som ser ut att ha lyckats.");
      }
      /** @type {Record<string, T[]>} */
      const fore = {};
      for (const [k, v] of Object.entries(store)) fore[k] = v.map((r) => ({ ...r }));
      try {
        return ops.map((o) => {
          if (o.op === "create") return skapa(o.collection, o.data);
          if (o.op === "update") return uppdatera(o.collection, o.id, o.data);
          if (o.op === "remove") {
            tabort(o.collection, o.id);
            return null;
          }
          throw new Error(`minne.batch: okänd skrivning "${/** @type {any} */ (o).op}". Giltiga: create, update, remove.`);
        });
      } catch (fel) {
        for (const k of Object.keys(store)) delete store[k];
        Object.assign(store, fore);
        throw fel;
      }
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
  if (!base) throw new Error("createJsonSource: base krävs, till exempel \"/assets/data\".");

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

/**
 * Lagring i minnet. För tester, och för att komma igång innan appen kopplat
 * in en riktig fillagring. Se `src/data/storage.js` för kontraktet.
 *
 * @param {Record<string, { url: string, fil: unknown }>} [seed]
 * @returns {import("./storage.js").StorageSource}
 */
export function createMemoryStorage(seed = {}) {
  /** @type {Record<string, { url: string, fil: unknown }>} */
  const store = { ...seed };
  let counter = 0;

  return createStorageSource({
    name: "minne",

    // ⛔ `async` trots att inget väntar, samma skäl som createMemorySource:
    // kontraktet får inte avslöja att just den här källan är snabb.
    async laddaUpp({ sokvag, fil }) {
      const s = typeof sokvag === "string" ? sokvag.trim() : "";
      if (!s) throw new Error("createMemoryStorage.laddaUpp: sokvag krävs. Utan den vet ingen adapter var filen ska ligga eller hur den tas bort igen.");
      if (fil === undefined || fil === null) throw new Error("createMemoryStorage.laddaUpp: fil krävs.");
      counter += 1;
      // ⛔ EN URL SOM BÄR SÖKVÄGEN, MED FLIT. Minneskällan har ingen riktig
      // adress att ge tillbaka, och en URL som inte går att spåra till sin
      // sökväg vore ett prov som inte mäter vad taBort faktiskt tar bort.
      const url = `minne://${s}?v=${counter}`;
      store[s] = { url, fil };
      return { url, sokvag: s };
    },

    async taBort(sokvag) {
      const s = typeof sokvag === "string" ? sokvag.trim() : "";
      if (!s) throw new Error("createMemoryStorage.taBort: sokvag krävs.");
      delete store[s];
    },
  });
}
