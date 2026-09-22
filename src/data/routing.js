/**
 * En datakälla som väljer källa per samling.
 *
 * ══ ⛔ VARFÖR SÖMMEN FINNS FÖRE DEN BEHÖVS ═══════════════════════════════
 *
 * Doktrinen är två databaser parallellt för olika ändamål, aldrig samma entitet i
 * två. Realtidskänsligt och identitet i en, relationsdata i en annan. Den
 * fördelningen går per SAMLING, inte per app, och kontraktet hade ingen plats att
 * uttrycka den på: `OpsDataProvider` tar en källa, och den gäller allt.
 *
 * Följden var att ett byte av lagring för EN samling krävde att alla flyttade
 * samtidigt. Sömmen gör flytten till en rad per samling.
 *
 * ══ ⛔ REALTID BLIR EN FRÅGA PER SAMLING, OCH DET ÄR DET SVÅRA ═══════════
 *
 * `subscribe` är frivillig i kontraktet (regel 5), och den som vill veta frågar
 * källan: `typeof source.subscribe === "function"`. Det svaret är sant om en
 * källa och blir en LÖGN om en routande källa: den kan strömma `chat` via
 * Firestore och inte `kostnader` via en JSON-fil, och frågan har alltså två svar.
 *
 * ⛔ TVÅ UTVÄGAR ÄR FEL, OCH BÅDA ÄR FRESTANDE:
 *
 *   exponera `subscribe` bara om ALLA kan     en enda långsam källa släcker
 *                                               realtiden överallt, tyst
 *   exponera den alltid och gör inget för de     lyssnaren sätts upp, data kommer
 *   samlingar som inte kan                       aldrig, och det ser ut som att
 *                                               ingenting händer i systemet
 *
 * Det andra är det farliga: en app som TROR sig ha realtid ser exakt likadan ut
 * som en som har det, ända tills någon undrar varför en post inte dök upp.
 *
 * Därför finns `canSubscribe(collectionName)`, som svarar per samling, och
 * `subscribe` KASTAR med samlingens namn för en samling som inte kan. Att kasta
 * är inte ett brott mot regel 5: regeln avvisar en metod som *aldrig* går att
 * anropa. Den här går att anropa, för den som frågar först, och `useLiveCollection`
 * frågar.
 */

import { OPERATIONS, createDataSource } from "./contract.js";

/**
 * @template T
 * @typedef {object} RoutingConfig
 * @property {import("./contract.js").DataSource<T>} standard Källan för allt som inte står i `routes`.
 * @property {Record<string, import("./contract.js").DataSource<T>>} [routes] Samling till källa.
 */

/**
 * Bygger den routande källan.
 *
 * ⛔ KRÄVER EN STANDARD, OCH DET ÄR INTE BEKVÄMLIGHET. Utan den skulle en samling
 * som glömts i `routes` behöva ett fel vid varje läsning, alltså ett fel som dyker
 * upp först den dag någon råkar öppna just den vyn. Med en standard är en glömd
 * rutt inte ett haveri utan ett medvetet "allt annat bor här", vilket också är det
 * som gör steg ett möjligt: allt pekar på en källa, och samlingar flyttar en åt
 * gången.
 *
 * ⛔ KONTROLLERAR VARJE RUTT VID UPPSTART. En rutt som pekar på något som inte är
 * en datakälla ger annars `undefined is not a function` först den dag samlingen
 * läses, och felet pekar mot vyn i stället för mot uppsättningen.
 *
 * @template T
 * @param {RoutingConfig<T>} config
 * @returns {import("./contract.js").DataSource<T> & { canSubscribe: (collectionName: string) => boolean, sourceFor: (collectionName: string) => import("./contract.js").DataSource<T> }}
 */
export function createRoutingSource(config) {
  if (!config || !config.standard) {
    throw new Error(
      "createRoutingSource: standard krävs. Utan den blir en glömd rutt ett fel som dyker upp först den dag någon öppnar just den vyn.",
    );
  }

  const routes = config.routes || {};

  for (const [collectionName, source] of Object.entries(routes)) {
    if (!source || typeof source !== "object") {
      throw new Error(`createRoutingSource: rutten "${collectionName}" pekar inte på en datakälla.`);
    }
    const saknas = OPERATIONS.filter((op) => typeof (/** @type {any} */ (source)[op]) !== "function");
    if (saknas.length > 0) {
      throw new Error(
        `createRoutingSource: källan för "${collectionName}" saknar ${saknas.join(", ")}. ` +
          "En halv adapter kraschar först den dag någon anropar just den metoden, och felet pekar då mot vyn i stället för hit.",
      );
    }
  }

  /** @param {string} collectionName */
  const pick = (collectionName) => routes[collectionName] || config.standard;

  /** @param {string} collectionName */
  const canSubscribe = (collectionName) => typeof pick(collectionName).subscribe === "function";

  /**
   * ⛔ EXPONERAS BARA OM NÅGON KÄLLA KAN. Annars hade den routande källan påstått
   * en förmåga ingen av dess källor har, och `useLiveCollection` hade tagit
   * strömvägen för att sedan kasta på första samlingen.
   */
  const anyCanStream =
    typeof config.standard.subscribe === "function" ||
    Object.values(routes).some((k) => typeof k.subscribe === "function");

  /** @type {Record<string, any>} */
  const source = {
    name: "routing",
    canSubscribe,

    /**
     * Vilken källa en samling faktiskt hamnar hos.
     *
     * ⛔ FINNS FÖR ATT KUNNA MÄTA UPPSÄTTNINGEN, inte för att kringgå sömmen. En
     * routing man inte kan inspektera är en routing man får gissa om, och den
     * gissningen står sedan i ett dokument som ruttnar.
     */
    sourceFor: pick,

    /** @param {string} collectionName @param {string} id */
    read: (collectionName, id) => pick(collectionName).read(collectionName, id),
    /** @param {string} collectionName @param {import("./contract.js").Query} [query] */
    list: (collectionName, query) => pick(collectionName).list(collectionName, query),
    /** @param {string} collectionName @param {any} data */
    create: (collectionName, data) => pick(collectionName).create(collectionName, data),
    /** @param {string} collectionName @param {string} id @param {any} data */
    update: (collectionName, id, data) => pick(collectionName).update(collectionName, id, data),
    /** @param {string} collectionName @param {string} id */
    remove: (collectionName, id) => pick(collectionName).remove(collectionName, id),
  };

  if (anyCanStream) {
    /**
     * @param {string} collectionName
     * @param {import("./contract.js").Query | undefined} query
     * @param {import("./contract.js").Listener<T>} lyssnare
     */
    source.subscribe = (collectionName, query, lyssnare) => {
      const mal = pick(collectionName);
      if (typeof mal.subscribe !== "function") {
        // ⛔ KASTAR MED SAMLINGENS NAMN. Alternativet vore att sätta upp en
        // lyssnare som aldrig levererar, alltså en vy som väntar för alltid och
        // ser ut som att ingenting händer i systemet. Frågan går att ställa i
        // förväg med `canSubscribe`, och `useLiveCollection` ställer den.
        throw new Error(
          `createRoutingSource: källan för "${collectionName}" kan inte prenumerera. ` +
            `Fråga canSubscribe("${collectionName}") först, eller läs med lista.`,
        );
      }
      return mal.subscribe(collectionName, query, lyssnare);
    };
  }

  return /** @type {any} */ (createDataSource(/** @type {any} */ (source)));
}
