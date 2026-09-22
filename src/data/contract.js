/**
 * Datalagrets kontrakt.
 *
 * ⛔ Poängen är att appens vyer ALDRIG vet var datan kommer ifrån.
 *
 * En vy som anropar `firestore.collection(...)` är låst vid Firestore för all
 * framtid, och den låsningen syns inte förrän någon vill byta. Med ett kontrakt
 * emellan är källan ett byte av en rad vid uppstarten: JSON i repot i dag,
 * Firestore i morgon, SQL bakom ett API sedan.
 *
 * Fyra regler gör kontraktet värt något. Utan dem läcker källans egenheter
 * igenom och abstraktionen blir en lögn.
 *
 * ⛔ 1. ALLT ÄR ASYNKRONT, även minnesadaptern.
 *
 * En synkron läsning från minnet hade sett bekväm ut och tvingat fram en
 * omskrivning av varje anropsställe den dag källan blev ett nätverksanrop.
 * Kontraktet får inte avslöja hur snabb källan råkar vara.
 *
 * ⛔ 2. FEL KASTAS, de returneras aldrig som tomhet.
 *
 * En läsning som misslyckas får aldrig se ut som "det fanns inget". Det är
 * samma falska grönhet som en vakt som blir grön av tom indata: appen visar
 * "Inga kostnader" när sanningen är att servern svarade 500, och användaren
 * drar en slutsats om sin data som inte stämmer.
 *
 * ⛔ 3. `read` returnerar `null` för "finns inte", och det är INTE ett fel.
 *
 * Skillnaden mellan "dokumentet saknas" och "jag kunde inte fråga" måste gå att
 * se, annars går den inte att hantera olika.
 *
 * ⛔ 4. Varje post har ett `id`. Adaptern sätter det vid `create`.
 *
 * Utan en gemensam nyckelkonvention kan ingen delad kod, som listor eller
 * tabeller, veta vad som identifierar en rad.
 *
 * ⛔ 5. `subscribe` ÄR FRIVILLIG, och de fem obligatoriska är fortfarande fem.
 *
 * Realtid är inte en egenskap hos kontraktet utan hos källan. En JSON-fil i
 * repot kan inte pusha, och att kräva metoden hade tvingat varje adapter att
 * ljuga: antingen med en pollingloop som låtsas vara en ström, eller med en
 * metod som kastar och därmed inte går att anropa. Båda är sämre än ett ärligt
 * "den här källan kan det inte".
 *
 * Därför står den INTE i `OPERATIONS`, och `createDataSource` kräver den inte.
 * Den som vill ha realtid frågar källan (`typeof source.subscribe === "function"`)
 * och får ett svar den kan handla på. `useLiveCollection` gör precis det och
 * rapporterar utfallet i `realtime`, i stället för att falla tillbaka i tysthet.
 *
 * ⛔ EN TYST TILLBAKAFALLNING VORE DET FARLIGA HÄR. En app som tror sig ha
 * realtid och inte har det ser exakt likadan ut som en som har det, ända tills
 * någon undrar varför en post inte dök upp. Det felet går inte att se, bara att
 * misstänka.
 */

/**
 * @template T
 * @typedef {object} DataSource
 * @property {(collectionName: string, id: string) => Promise<T | null>} read En post, eller null om den inte finns.
 * @property {(collectionName: string, query?: Query) => Promise<T[]>} list
 * @property {(collectionName: string, data: Partial<T>) => Promise<T>} create Returnerar posten med sitt id.
 * @property {(collectionName: string, id: string, data: Partial<T>) => Promise<T>} update
 * @property {(collectionName: string, id: string) => Promise<void>} remove
 * @property {(collectionName: string, query: Query | undefined, lyssnare: Listener<T>) => Unsubscribe} [subscribe]
 *   ⛔ FRIVILLIG. Se regel 5 nedan.
 */

/**
 * @template T
 * @typedef {object} Listener
 * @property {(rows: T[]) => void} onData Varje gång urvalet ändras, inklusive första gången.
 * @property {(error: Error) => void} onError
 */

/** @typedef {() => void} Unsubscribe Stänger prenumerationen. Måste tåla att anropas flera gånger. */

/**
 * @typedef {object} Query
 * @property {Record<string, unknown>} [where] Likhetsvillkor. `{ status: "oppen" }`.
 * @property {string} [sortBy] Fältnamn.
 * @property {"asc" | "desc"} [direction]
 * @property {number} [limit]
 */

/** De operationer varje adapter måste ha. */
export const OPERATIONS = ["read", "list", "create", "update", "remove"];

/**
 * Tar emot en adapter och ger tillbaka en datakälla.
 *
 * ⛔ Kontrollen är inte ceremoni. En adapter som saknar en metod ger annars
 * `undefined is not a function` först den dag någon råkar anropa just den, och
 * det felet pekar mot anropsstället i stället för mot adaptern. Att säga ifrån
 * vid uppstart flyttar felet dit det hör hemma.
 *
 * @template T
 * @param {Partial<DataSource<T>> & { name?: string }} adapter
 * @returns {DataSource<T>}
 */
export function createDataSource(adapter) {
  if (!adapter || typeof adapter !== "object") {
    throw new Error("createDataSource: en adapter krävs. Se createMemorySource eller createJsonSource för exempel.");
  }
  const saknas = OPERATIONS.filter((op) => typeof (/** @type {any} */ (adapter)[op]) !== "function");
  if (saknas.length > 0) {
    throw new Error(
      `createDataSource: adaptern "${adapter.name ?? "namnlös"}" saknar ${saknas.join(", ")}. ` +
        "En halv adapter kraschar först den dag någon anropar just den metoden, och felet pekar då mot anropsstället i stället för hit.",
    );
  }
  return /** @type {DataSource<T>} */ (adapter);
}

/**
 * Filtrerar och sorterar en lista enligt en fråga.
 *
 * Delas av de adaptrar som håller allt i minnet (minne, JSON). En riktig databas
 * gör det här i sin egen frågemotor och använder alltså inte den här.
 *
 * @template {{ id: string }} T
 * @param {T[]} rows @param {Query} [query] @returns {T[]}
 */
export function applyQuery(rows, query) {
  if (!query) return rows;
  let ut = rows;

  if (query.where) {
    const conditions = Object.entries(query.where);
    ut = ut.filter((r) => conditions.every(([f, v]) => /** @type {any} */ (r)[f] === v));
  }

  if (query.sortBy) {
    const field = query.sortBy;
    const chars = query.direction === "desc" ? -1 : 1;
    // Kopia före sort: `Array.sort` muterar, och en adapter som sorterar om
    // sin egen lagring ändrar tyst ordningen för nästa läsare.
    ut = [...ut].sort((a, b) => {
      const x = /** @type {any} */ (a)[field];
      const y = /** @type {any} */ (b)[field];
      if (x === y) return 0;
      return (x > y ? 1 : -1) * chars;
    });
  }

  return typeof query.limit === "number" ? ut.slice(0, query.limit) : ut;
}
