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
const KRAVS = [
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
  // ⛔ `onSnapshot` står bland de OBLIGATORISKA trots att `prenumerera` är en
  // frivillig del av kontraktet. Det är inte en motsägelse: frivilligheten
  // gäller ADAPTRAR, och den här adaptern har valt att kunna prenumerera.
  // Firestore-SDK:n exporterar alltid funktionen, så saknas den har appen
  // skickat in plock i stället för hela modulen, och då är det bättre att säga
  // det vid uppstart än att låta realtiden tyst utebli.
  "onSnapshot",
];

/**
 * @template {{ id: string }} T
 * @param {{ db: any, sdk: Record<string, any> }} konfig
 * @returns {import("./kontrakt.js").Datakalla<T>}
 */
export function skapaFirestoreKalla(konfig) {
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
  const { db, sdk } = konfig ?? /** @type {any} */ ({});
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

  const { collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot } = sdk;

  /** @param {any} snap @returns {any} */
  const tillPost = (snap) => ({ id: snap.id, ...snap.data() });

  /**
   * Bygger frågan. Delas av `lista` och `prenumerera`.
   *
   * ⛔ EN ÖVERSÄTTNING, INTE TVÅ. Stod villkoren på två ställen skulle en
   * hämtning och en prenumeration på samma samling kunna ge olika urval, och
   * den skillnaden syns inte: båda returnerar rader, bara inte samma.
   *
   * @param {string} samling @param {import("./kontrakt.js").Fraga} [fraga]
   */
  function bygg(samling, fraga) {
    const villkor = [];
    if (fraga?.dar) for (const [falt, varde] of Object.entries(fraga.dar)) villkor.push(where(falt, "==", varde));
    if (fraga?.sortera) villkor.push(orderBy(fraga.sortera, fraga.riktning === "ner" ? "desc" : "asc"));
    if (typeof fraga?.antal === "number") villkor.push(limit(fraga.antal));
    return query(collection(db, samling), ...villkor);
  }

  return skapaDatakalla({
    namn: "firestore",

    async las(samling, id) {
      const snap = await getDoc(doc(db, samling, id));
      // ⛔ `exists()` och inte en sanningsprövning av datan. Ett dokument som
      // finns men är tomt är inte samma sak som ett som saknas.
      return snap.exists() ? tillPost(snap) : null;
    },

    async lista(samling, fraga) {
      const snap = await getDocs(bygg(samling, fraga));
      return snap.docs.map(tillPost);
    },

    /**
     * Lyssnar på ett urval. Returnerar funktionen som stänger lyssnandet.
     *
     * ⛔ FELET GÅR TILL `vidFel`, ALDRIG TILL EN TOM LISTA. Firestore anropar
     * felkanalen bland annat vid `permission-denied`, alltså exakt det som
     * händer när reglerna för samlingen saknas. Skickades det vidare som noll
     * rader hade appen sagt "inkorgen är tom" till någon vars inkorg är full,
     * och det är ett värre besked än ett felmeddelande.
     *
     * ⛔ Efter ett fel är prenumerationen DÖD. Firestore återansluter inte
     * själv efter en avvisning, så den som vill försöka igen måste starta en ny.
     * `useSamlingLive` gör det via `uppdatera()`.
     *
     * @param {string} samling
     * @param {import("./kontrakt.js").Fraga | undefined} fraga
     * @param {import("./kontrakt.js").Lyssnare<any>} lyssnare
     * @returns {import("./kontrakt.js").Avsluta}
     */
    prenumerera(samling, fraga, lyssnare) {
      return onSnapshot(
        bygg(samling, fraga),
        /** @param {any} snap */ (snap) => lyssnare.vidData(snap.docs.map(tillPost)),
        /** @param {any} e */ (e) => lyssnare.vidFel(e instanceof Error ? e : new Error(String(e))),
      );
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
