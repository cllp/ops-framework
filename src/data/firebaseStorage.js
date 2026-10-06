import { createStorageSource } from "./storage.js";

/**
 * Adapter mot Firebase Storage. Bredvid `firestore.js`, av samma skäl som den
 * filen: ramverket äger MAPPNINGEN, appen äger KOPPLINGEN.
 *
 * ══ ⛔ RAMVERKET IMPORTERAR INTE FIREBASE (#156) ═════════════════════════
 *
 * Samma beslut som `createFirestoreSource`. SDK:n skickas in, så ramverket
 * inte drar in `firebase/storage` för varje app, inklusive de som aldrig
 * laddar upp en bild, och inte låses vid en version av ett bibliotek det inte
 * äger.
 *
 * Så här kopplar appen in den:
 *
 * ```js
 * import { initializeApp } from "firebase/app";
 * import * as storage from "firebase/storage";
 * import { createFirebaseStorageSource } from "ops-framework";
 *
 * const app = initializeApp(config);
 * const lagring = createFirebaseStorageSource({ storage: storage.getStorage(app), sdk: storage });
 * ```
 *
 * ⛔ Den filen i appen är den ENDA som får importera `firebase/*`, precis som
 * för Firestore-adaptern. `check-data-layer` gör det till ett rött bygge om
 * någon vy gör det.
 */

/** Funktionerna adaptern behöver ur SDK:n. */
const REQUIRED = ["ref", "uploadBytes", "getDownloadURL", "deleteObject"];

/**
 * @param {{ storage: any, sdk: Record<string, any> }} config
 * @returns {import("./storage.js").StorageSource}
 */
export function createFirebaseStorageSource(config) {
  // ⛔ DESTRUKTURERINGEN LIGGER I KROPPEN, SAMMA SKÄL SOM `createFirestoreSource`
  // (#129 punkt 5): `({ storage })` i signaturen kraschar på destrukturen
  // innan valideringen hinner tala, med ett fel som nämner en variabel inne i
  // ramverket och inte vad appen glömde.
  const { storage, sdk } = config ?? /** @type {any} */ ({});
  if (!storage) throw new Error("createFirebaseStorageSource: storage krävs. Skicka in resultatet av getStorage(app).");
  if (!sdk) throw new Error('createFirebaseStorageSource: sdk krävs. Skicka in hela modulen: import * as storage from "firebase/storage".');

  const missing = REQUIRED.filter((f) => typeof sdk[f] !== "function");
  if (missing.length > 0) {
    throw new Error(`createFirebaseStorageSource: sdk saknar ${missing.join(", ")}. Skicka in hela modulen "firebase/storage", inte enskilda funktioner.`);
  }

  const { ref, uploadBytes, getDownloadURL, deleteObject } = sdk;

  return createStorageSource({
    name: "firebase-storage",

    async laddaUpp({ sokvag, fil }) {
      const s = typeof sokvag === "string" ? sokvag.trim() : "";
      if (!s) throw new Error("createFirebaseStorageSource.laddaUpp: sokvag krävs.");
      if (fil === undefined || fil === null) throw new Error("createFirebaseStorageSource.laddaUpp: fil krävs.");
      const referens = ref(storage, s);
      await uploadBytes(referens, /** @type {any} */ (fil));
      const url = await getDownloadURL(referens);
      return { url, sokvag: s };
    },

    async taBort(sokvag) {
      const s = typeof sokvag === "string" ? sokvag.trim() : "";
      if (!s) throw new Error("createFirebaseStorageSource.taBort: sokvag krävs.");
      /*
       * ⛔ "OBJEKTET FINNS INTE" ÄR INTE ETT FEL HÄR, TILL SKILLNAD FRÅN
       * KONTRAKTETS ALLMÄNNA REGEL 2. En borttagning ska gå att köra två
       * gånger utan att andra gången kasta: appen vet inte (och ska inte
       * behöva veta) om filen redan är borta, t.ex. för att ett tidigare
       * försök lyckades men svaret tappades på vägen. Alla ANDRA fel
       * (behörighet, nätverk) kastas som vanligt.
       */
      try {
        await deleteObject(ref(storage, s));
      } catch (e) {
        const kod = /** @type {any} */ (e)?.code;
        if (kod === "storage/object-not-found") return;
        throw e;
      }
    },
  });
}
