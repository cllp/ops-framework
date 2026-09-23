import { createDataSource } from "./contract.js";

/**
 * Adapter mot Firestore.
 *
 * ⛔ RAMVERKET IMPORTERAR INTE FIREBASE. SDK:n skickas in.
 *
 * Det är inte en formalitet. Skulle ramverket importera `firebase/firestore`
 * skulle varje plattform som konsumerar det dra in hela SDK:n, även de som
 * aldrig rör Firestore, och ramverket skulle dessutom låsas vid en version av
 * ett bibliotek det inte äger.
 *
 * I stället äger ramverket **mappningen** (hur CRUD blir Firestore-anrop, hur
 * id hanteras, hur en fråga översätts) och appen äger **kopplingen**. Mappningen
 * är det som annars skrivs om från grunden i varje app och blir olika varje gång.
 *
 * Så här kopplar appen in den:
 *
 * ```js
 * import { initializeApp } from "firebase/app";
 * import * as firestore from "firebase/firestore";
 * import { createFirestoreSource } from "@staiger/ops-framework";
 *
 * const app = initializeApp(config);
 * const kalla = createFirestoreSource({ db: firestore.getFirestore(app), sdk: firestore });
 * ```
 *
 * ⛔ Den filen i appen är den ENDA som får importera `firebase/*`.
 * `check-data-layer` gör det till ett rött bygge om någon vy gör det.
 */

/** Funktionerna adaptern behöver ur SDK:n. */
const REQUIRED = [
  "collection",
  "doc",
  "getDoc",
  "getDocs",
  "addDoc",
  "setDoc",
  "updateDoc",
  "deleteDoc",
  "query",
  "where",
  "orderBy",
  "limit",
  // ⛔ `onSnapshot` står bland de OBLIGATORISKA trots att `subscribe` är en
  // frivillig del av kontraktet. Det är inte en motsägelse: frivilligheten
  // gäller ADAPTRAR, och den här adaptern har valt att kunna prenumerera.
  // Firestore-SDK:n exporterar alltid funktionen, så saknas den har appen
  // skickat in plock i stället för hela modulen, och då är det bättre att säga
  // det vid uppstart än att låta realtiden tyst utebli.
  "onSnapshot",
];

/**
 * @template {{ id: string }} T
 * @param {{ db: any, sdk: Record<string, any> }} config
 * @returns {import("./contract.js").DataSource<T>}
 */
export function createFirestoreSource(config) {
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
  const { db, sdk } = config ?? /** @type {any} */ ({});
  if (!db) throw new Error("createFirestoreSource: db krävs. Skicka in resultatet av getFirestore(app).");
  if (!sdk) throw new Error('createFirestoreSource: sdk krävs. Skicka in modulen: import * as firestore from "firebase/firestore".');

  // ⛔ Kontrollen sker vid uppstart, inte vid första anropet. En saknad funktion
  // ger annars "undefined is not a function" först den dag någon råkar ta bort
  // något, och felet pekar då mot vyn i stället för mot uppkopplingen.
  const missing = REQUIRED.filter((f) => typeof sdk[f] !== "function");
  if (missing.length > 0) {
    throw new Error(
      `createFirestoreSource: sdk saknar ${missing.join(", ")}. Skicka in hela modulen "firebase/firestore", inte enskilda funktioner.`,
    );
  }

  const { collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot } = sdk;

  /** @param {any} snap @returns {any} */
  const toEntry = (snap) => ({ id: snap.id, ...snap.data() });

  /**
   * Bygger frågan. Delas av `list` och `subscribe`.
   *
   * ⛔ EN ÖVERSÄTTNING, INTE TVÅ. Stod villkoren på två ställen skulle en
   * hämtning och en prenumeration på samma samling kunna ge olika urval, och
   * den skillnaden syns inte: båda returnerar rader, bara inte samma.
   *
   * ⛔ PARAMETERN HETER `q` OCH INTE `query`, och det är inte slarv. Firestores
   * SDK exporterar en funktion som heter `query`, och den destruktureras en rad
   * ovanför. En parameter med samma namn skuggar den inne i funktionen, alltså
   * hade sista raden anropat vårt eget frågeobjekt som om det vore en funktion.
   * Typkontrollen sade "Type 'Query' has no call signatures", men bara för att
   * SDK:n är typad; i en otypad adapter hade det blivit ett krasch-vid-körning
   * som inget prov mot minnesadaptern kan se.
   *
   * @param {string} collectionName @param {import("./contract.js").Query} [q]
   */
  function build(collectionName, q) {
    const conditions = [];
    if (q?.where) for (const [field, value] of Object.entries(q.where)) conditions.push(where(field, "==", value));
    if (q?.sortBy) conditions.push(orderBy(q.sortBy, q.direction === "desc" ? "desc" : "asc"));
    if (typeof q?.limit === "number") conditions.push(limit(q.limit));
    return query(collection(db, collectionName), ...conditions);
  }

  return createDataSource({
    name: "firestore",

    async read(collectionName, id) {
      const snap = await getDoc(doc(db, collectionName, id));
      // ⛔ `exists()` och inte en sanningsprövning av datan. Ett dokument som
      // finns men är tomt är inte samma sak som ett som saknas.
      return snap.exists() ? toEntry(snap) : null;
    },

    async list(collectionName, query) {
      const snap = await getDocs(build(collectionName, query));
      return snap.docs.map(toEntry);
    },

    /**
     * Lyssnar på ett urval. Returnerar funktionen som stänger lyssnandet.
     *
     * ⛔ FELET GÅR TILL `onError`, ALDRIG TILL EN TOM LISTA. Firestore anropar
     * felkanalen bland annat vid `permission-denied`, alltså exakt det som
     * händer när reglerna för samlingen saknas. Skickades det vidare som noll
     * rader hade appen sagt "inkorgen är tom" till någon vars inkorg är full,
     * och det är ett värre besked än ett felmeddelande.
     *
     * ⛔ Efter ett fel är prenumerationen DÖD. Firestore återansluter inte
     * själv efter en avvisning, så den som vill försöka igen måste starta en ny.
     * `useLiveCollection` gör det via `update()`.
     *
     * @param {string} collectionName
     * @param {import("./contract.js").Query | undefined} query
     * @param {import("./contract.js").Listener<any>} listener
     * @returns {import("./contract.js").Unsubscribe}
     */
    subscribe(collectionName, query, listener) {
      return onSnapshot(
        build(collectionName, query),
        /** @param {any} snap */ (snap) => listener.onData(snap.docs.map(toEntry)),
        /** @param {any} e */ (e) => listener.onError(e instanceof Error ? e : new Error(String(e))),
      );
    },

    async create(collectionName, data) {
      const { id, ...field } = /** @type {any} */ (data);

      // Eget id: setDoc. Inget id: addDoc. Skillnaden spelar roll, för setDoc
      // skriver över ett befintligt dokument utan att säga ifrån.
      if (id) {
        await setDoc(doc(db, collectionName, id), field);
        return /** @type {any} */ ({ id, ...field });
      }
      const ref = await addDoc(collection(db, collectionName), field);
      return /** @type {any} */ ({ id: ref.id, ...field });
    },

    async update(collectionName, id, data) {
      const { id: _ignored, ...field } = /** @type {any} */ (data);
      const ref = doc(db, collectionName, id);
      await updateDoc(ref, field);

      // ⛔ Läser tillbaka i stället för att gissa resultatet. En serverside-
      // timestamp eller en regel som ändrar värdet skulle annars ge appen ett
      // objekt som inte stämmer med vad som faktiskt står i databasen.
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error(`firestore: ${collectionName}/${id} finns inte efter uppdatering.`);
      return toEntry(snap);
    },

    async remove(collectionName, id) {
      await deleteDoc(doc(db, collectionName, id));
    },
  });
}
