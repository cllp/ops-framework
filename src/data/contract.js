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
 *
 * ⛔ 6. `batch` ÄR FRIVILLIG PÅ SAMMA SÄTT, OCH DEN ÄR ALLT ELLER INGET (0.32.0, #180).
 *
 * `skapaGrupp` skriver gruppen OCH ägarens medlemskap, och före 0.32.0 var det två anrop efter
 * varandra: föll det andra låg en grupp utan ägare kvar, en rad ingen kan läsa (`groups` läses av
 * medlemmar) och ingen kan städa (`delete: if false`). Kostnaden var känd och stod utskriven i
 * filhuvudet, "ska inte låtsas göra det". Nu finns operationen, och det är en ANNAN sak än fem nya
 * anrop: `batch(ops)` skriver alla eller ingen, och kastar utan att ha skrivit något om en av dem
 * inte går.
 *
 * Den står INTE i `OPERATIONS` av samma skäl som `subscribe`: en JSON-fil i repot kan inte skriva
 * alls, och att kräva metoden hade tvingat den adaptern att ljuga med en loop som ser atomär ut.
 * Den som behöver den frågar källan (`typeof kalla.batch === "function"`) och får ett ärligt nej.
 * Svaret är en lista i samma ordning som `ops`: den skapade eller uppdaterade posten, `null` för en
 * `remove`.
 *
 * ⛔ EN APPS ADMIN-ADAPTER HAR SAMMA SKYLDIGHET. Ramverket importerar aldrig Admin SDK, så adaptern
 * bor i appens functions, och med Admin SDK är `batch` en `db.batch()` med `set`/`update`/`delete`
 * och en `commit()`. Se README, avsnittet om `createGroupService`.
 *
 * ⛔ 7. `updateIf` ÄR FRIVILLIG, OCH DEN ÄR LÄS OCH SKRIV I ETT STEG (0.76.2, granskningen av PR 294).
 *
 * Mejlkön skickade samma mejl tre gånger i ett prov: `onDocumentCreated` levereras minst en gång, och
 * utskicket läste aldrig om någon annan redan tagit dokumentet. En `read` följd av en `update` löser det
 * inte, två körningar kan läsa `koad` samtidigt och båda skicka. Det är den läs-sedan-skriv-kontroll
 * regel 2 i CLAUDE.md förbjuder. `updateIf(samling, id, villkor, data)` skriver `data` bara om varje
 * likhetsvillkor i `villkor` stämmer mot posten SOM DEN ÄR NÄR SKRIVNINGEN GÖRS, och svarar
 * `{ updated, row }`: `updated` säger om skrivningen gjordes, `row` är posten efteråt (eller som den
 * stod, när villkoret inte stämde), `null` om den inte finns.
 *
 * ⛔ EN APPS ADMIN-ADAPTER HAR SAMMA SKYLDIGHET, och där är den en `db.runTransaction` som läser
 * dokumentet med `tx.get`, jämför och skriver med `tx.update`. Se README, avsnittet om mejl. Den står
 * inte i `OPERATIONS` av samma skäl som `batch`: en källa som inte kan göra steget atomärt ska säga
 * nej, inte låtsas med en läsning följd av en skrivning.
  */

/**
 * @template T
 * @typedef {object} DataSource
 * @property {(collectionName: string, id: string) => Promise<T | null>} read En post, eller null om den inte finns.
 * @property {(collectionName: string, query?: Query) => Promise<T[]>} list
 * @property {(collectionName: string, data: Partial<T>) => Promise<T>} create Returnerar posten med sitt id. ⛔ Med ett eget `id` ERSÄTTER den posten som redan har det id:t, utan att säga ifrån, precis som `setDoc`. Utan id skapas en ny med ett genererat. Båda adaptrarna måste svara likadant: en källa som lägger till där en annan ersätter gör provsviten till en mätning av en app som inte finns.
 * @property {(collectionName: string, id: string, data: Partial<T>) => Promise<T>} update
 * @property {(collectionName: string, id: string) => Promise<void>} remove
 * @property {(collectionName: string, query: Query | undefined, listener: Listener<T>) => Unsubscribe} [subscribe]
 *   ⛔ FRIVILLIG. Se regel 5 nedan.
 * @property {(ops: ReadonlyArray<BatchOp<T>>) => Promise<Array<T | null>>} [batch]
 * @property {(collectionName: string, query?: Query) => Promise<number>} [count] (0.68.0) FRIVILLIG: antalet poster som frågan
 *   matchar, utan att läsa dem (Firestores aggregatfråga, en läsning per tusen). Saknas den läser den som behöver ett antal
 *   raderna i stället, med ett tak. ⛔ Samma frivillighet som `batch`: en adapter som inte kan räkna utan att läsa allt ska
 *   inte låtsas att den kan.
 *   ⛔ FRIVILLIG, OCH ALLT ELLER INGET. Se regel 6 nedan.
 * @property {(collectionName: string, id: string, villkor: Record<string, unknown>, data: Partial<T>) => Promise<{ updated: boolean, row: T | null }>} [updateIf]
 *   (0.76.2) FRIVILLIG: skriver `data` bara om likhetsvillkoren stämmer, i samma atomära steg som läsningen. Se regel 7 nedan.
 */

/**
 * En skrivning i en `batch`. Samma betydelse som `create`, `update` och `remove` var för sig.
 * @template T
 * @typedef {{ op: "create", collection: string, data: Partial<T> }
 *   | { op: "update", collection: string, id: string, data: Partial<T> }
 *   | { op: "remove", collection: string, id: string }} BatchOp
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
 * @property {Record<string, unknown>} [innehaller] (0.34.0) Listfält som ska INNEHÅLLA värdet. `{ deltagare: uid }`.
 *   Högst ETT fält per fråga (Firestores `array-contains` tillåter ett). ⛔ En adapter som inte kan uttrycka villkoret
 *   KASTAR, den ignorerar det aldrig: ett villkor som tyst faller bort ger fler rader än frågan bad om, och för
 *   privata samtal är "fler rader" någon annans samtal.
 * @property {{ falt: string, varde: number | string }} [fore] (chattens nattskiva) Bara poster där `falt` är STRIKT MINDRE än `varde`.
 *   Det är "Visa äldre" i chatten: nästa sida bakåt från det äldsta som redan är läst. ⛔ En adapter som inte kan uttrycka
 *   villkoret KASTAR, samma skäl som `innehaller`: ett villkor som tyst faller bort ger den senaste sidan en gång till, och
 *   "äldre meddelanden" som är samma meddelanden igen ser ut som en chatt som upprepar sig.
 * @property {string} [sortBy] Fältnamn.
 * @property {"asc" | "desc"} [direction]
 * @property {number} [limit]
 */

/**
 * ══ ⛔ ATT TA BORT ETT FÄLT VID `update` (0.40.0, #214) ═══════════════════════════════════════════════════════════════
 *
 * CP 2026-10-01: "Kolla med sessionstudio också så att det går att editera en händelse." Att redigera en händelse betyder att man
 * kan tömma ett fält: ta bort beskrivningen, klockslaget, slutdagen. Kontraktets `update(samling, id, data)` slår samman `data` i
 * posten, och ett fält som utelämnas BLIR KVAR. Det fanns därför ingen väg att ta bort ett fält, och de två genvägarna är båda fel:
 * `""` är ett annat värde än "saknas" (appens kontrakt utelämnar tomma fält, och en regel som kräver ett datum avvisar `""`), och
 * `undefined` har Firestore ingen mening för (`updateDoc` kastar).
 *
 * `FALT_BORT` är ett värde som SÄGER "ta bort fältet": `update("handelser", id, { text: FALT_BORT })`. Varje adapter gör det på sitt
 * sätt: Firestore med `deleteField()`, minnet tar bort nyckeln, Postgres sätter kolumnen till `NULL`, HTTP skickar `null`.
 * ⛔ En adapter som inte kan uttrycka det KASTAR och ignorerar det aldrig: ett fält som tyst blir kvar säger "sparat" om något
 * som inte sparades. En symbol och inte en sträng, så att ingen text som en användare skriver kan råka bli en borttagning.
 */
export const FALT_BORT = Symbol.for("ops.faltBort");

/** Namnen på de fält i `data` som är `FALT_BORT`. @param {unknown} data @returns {string[]} */
export function faltAttTaBort(data) {
  if (!data || typeof data !== "object") return [];
  return Object.entries(data).filter(([, v]) => v === FALT_BORT).map(([k]) => k);
}

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
  const missing = OPERATIONS.filter((op) => typeof (/** @type {any} */ (adapter)[op]) !== "function");
  if (missing.length > 0) {
    throw new Error(
      `createDataSource: adaptern "${adapter.name ?? "namnlös"}" saknar ${missing.join(", ")}. ` +
        "En halv adapter kraschar först den dag någon anropar just den metoden, och felet pekar då mot anropsstället i stället för hit.",
    );
  }
  return /** @type {DataSource<T>} */ (adapter);
}

/**
 * Det enda `innehaller`-villkoret i en fråga, eller `null` om det saknas. Kastar vid fler än ett (0.34.0).
 *
 * ⛔ EN DEFINITION FÖR ALLA ADAPTRAR. Firestore tillåter ett `array-contains` per fråga, och en minnesadapter som
 * tålde två hade låtit ett prov gå grönt på en fråga som kraschar mot den riktiga databasen.
 *
 * @param {Record<string, unknown> | undefined} innehaller
 * @returns {[string, unknown] | null}
 */
export function innehallerVillkor(innehaller) {
  if (!innehaller) return null;
  const par = Object.entries(innehaller);
  if (par.length === 0) return null;
  if (par.length > 1) {
    throw new Error(`innehaller: högst ett fält per fråga, fick ${par.map(([f]) => f).join(", ")}. Firestore tillåter ett array-contains per fråga.`);
  }
  return /** @type {[string, unknown]} */ (par[0]);
}

/**
 * `fore`-villkoret i en fråga som `[falt, varde]`, eller `null` om det saknas. Kastar när formen är fel.
 *
 * ⛔ EN DEFINITION FÖR ALLA ADAPTRAR, samma skäl som `innehallerVillkor`. Ett värde som inte är ett tal eller en sträng har ingen
 * ordning som varje källa jämför likadant, och en jämförelse som Firestore gör på ett sätt och minnet på ett annat hade låtit
 * ett prov gå grönt på en sida som ser annorlunda ut i appen.
 *
 * @param {unknown} fore
 * @returns {[string, number | string] | null}
 */
export function foreVillkor(fore) {
  if (fore === undefined || fore === null) return null;
  const f = /** @type {Record<string, unknown>} */ (typeof fore === "object" ? fore : {});
  if (typeof f.falt !== "string" || !f.falt) throw new Error("fore: falt krävs, fältets namn. Formen är { falt, varde }.");
  const v = f.varde;
  if (!((typeof v === "number" && Number.isFinite(v)) || typeof v === "string")) {
    throw new Error(`fore: varde är ett tal eller en sträng, fick ${typeof v}. Formen är { falt, varde }.`);
  }
  const okanda = Object.keys(f).filter((k) => k !== "falt" && k !== "varde");
  if (okanda.length) throw new Error(`fore: okända fält ${okanda.join(", ")}. Formen är { falt, varde }.`);
  return [f.falt, /** @type {number | string} */ (v)];
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
  let out = rows;

  if (query.where) {
    const conditions = Object.entries(query.where);
    out = out.filter((r) => conditions.every(([f, v]) => /** @type {any} */ (r)[f] === v));
  }

  if (query.innehaller) {
    const villkor = innehallerVillkor(query.innehaller);
    if (villkor) {
      const [f, v] = villkor;
      out = out.filter((r) => Array.isArray(/** @type {any} */ (r)[f]) && /** @type {any} */ (r)[f].includes(v));
    }
  }

  const fore = foreVillkor(query.fore);
  if (fore) {
    const [f, v] = fore;
    // ⛔ Samma typ krävs för en jämförelse: en sträng och ett tal har ingen gemensam ordning i Firestore, och här hade `<` tvingat
    // fram en omvandling som ingen annan källa gör.
    out = out.filter((r) => typeof (/** @type {any} */ (r)[f]) === typeof v && /** @type {any} */ (r)[f] < v);
  }

  if (query.sortBy) {
    const field = query.sortBy;
    const chars = query.direction === "desc" ? -1 : 1;
    // Kopia före sort: `Array.sort` muterar, och en adapter som sorterar om
    // sin egen lagring ändrar tyst ordningen för nästa läsare.
    out = [...out].sort((a, b) => {
      const x = /** @type {any} */ (a)[field];
      const y = /** @type {any} */ (b)[field];
      if (x === y) return 0;
      return (x > y ? 1 : -1) * chars;
    });
  }

  return typeof query.limit === "number" ? out.slice(0, query.limit) : out;
}
