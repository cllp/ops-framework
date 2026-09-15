import { skapaDatakalla } from "./kontrakt.js";

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
 * import { skapaFirestoreKalla } from "@staiger/ops-framework";
 *
 * const app = initializeApp(config);
 * const kalla = skapaFirestoreKalla({ db: firestore.getFirestore(app), sdk: firestore });
 * ```
 *
 * ⛔ Den filen i appen är den ENDA som får importera `firebase/*`.
 * `check-data-layer` gör det till ett rött bygge om någon vy gör det.
 */

/** Funktionerna adaptern behöver ur SDK:n. */
const KRAVS = ["collection", "doc", "getDoc", "getDocs", "addDoc", "setDoc", "updateDoc", "deleteDoc", "query", "where", "orderBy", "limit"];

/**
 * @template {{ id: string }} T
 * @param {{ db: any, sdk: Record<string, any> }} val
 * @returns {import("./kontrakt.js").Datakalla<T>}
 */
export function skapaFirestoreKalla({ db, sdk }) {
  if (!db) throw new Error("skapaFirestoreKalla: db krävs. Skicka in resultatet av getFirestore(app).");
  if (!sdk) throw new Error('skapaFirestoreKalla: sdk krävs. Skicka in modulen: import * as firestore from "firebase/firestore".');

  // ⛔ Kontrollen sker vid uppstart, inte vid första anropet. En saknad funktion
  // ger annars "undefined is not a function" först den dag någon råkar ta bort
  // något, och felet pekar då mot vyn i stället för mot uppkopplingen.
  const saknas = KRAVS.filter((f) => typeof sdk[f] !== "function");
  if (saknas.length > 0) {
    throw new Error(
      `skapaFirestoreKalla: sdk saknar ${saknas.join(", ")}. Skicka in hela modulen "firebase/firestore", inte enskilda funktioner.`,
    );
  }

  const { collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit } = sdk;

  /** @param {any} snap @returns {any} */
  const tillPost = (snap) => ({ id: snap.id, ...snap.data() });

  return skapaDatakalla({
    namn: "firestore",

    async las(samling, id) {
      const snap = await getDoc(doc(db, samling, id));
      // ⛔ `exists()` och inte en sanningsprövning av datan. Ett dokument som
      // finns men är tomt är inte samma sak som ett som saknas.
      return snap.exists() ? tillPost(snap) : null;
    },

    async lista(samling, fraga) {
      const villkor = [];
      if (fraga?.dar) for (const [falt, varde] of Object.entries(fraga.dar)) villkor.push(where(falt, "==", varde));
      if (fraga?.sortera) villkor.push(orderBy(fraga.sortera, fraga.riktning === "ner" ? "desc" : "asc"));
      if (typeof fraga?.antal === "number") villkor.push(limit(fraga.antal));

      const snap = await getDocs(query(collection(db, samling), ...villkor));
      return snap.docs.map(tillPost);
    },

    async skapa(samling, data) {
      const { id, ...falt } = /** @type {any} */ (data);

      // Eget id: setDoc. Inget id: addDoc. Skillnaden spelar roll, för setDoc
      // skriver över ett befintligt dokument utan att säga ifrån.
      if (id) {
        await setDoc(doc(db, samling, id), falt);
        return /** @type {any} */ ({ id, ...falt });
      }
      const ref = await addDoc(collection(db, samling), falt);
      return /** @type {any} */ ({ id: ref.id, ...falt });
    },

    async uppdatera(samling, id, data) {
      const { id: _ignorerat, ...falt } = /** @type {any} */ (data);
      const ref = doc(db, samling, id);
      await updateDoc(ref, falt);

      // ⛔ Läser tillbaka i stället för att gissa resultatet. En serverside-
      // timestamp eller en regel som ändrar värdet skulle annars ge appen ett
      // objekt som inte stämmer med vad som faktiskt står i databasen.
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error(`firestore: ${samling}/${id} finns inte efter uppdatering.`);
      return tillPost(snap);
    },

    async taBort(samling, id) {
      await deleteDoc(doc(db, samling, id));
    },
  });
}
