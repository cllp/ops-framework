/**
 * En datakälla (read, list, update) över Firebase Admin SDK, för skript som körs av en människa med egna inloggningsuppgifter.
 *
 * ⛔ SKILD FRÅN SKRIPTEN SOM ANVÄNDER DEN, så att skripten går att importera i prov utan att dra in `firebase-admin`.
 * ⛔ `firebase-admin` HÄMTAS UR APPENS `functions/`, inte ur ramverkets paket: ramverket har inget beroende av Firebase i
 * kärnan (arbetsreglernas "Firebase är en egen ingång"). Skriptet ska köras från appens rot.
 * ⛔ PROJEKTET SKICKAS IN. Ramverket känner aldrig projekt-id.
 */

import process from "node:process";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * @param {string} projekt
 */
export async function adminKalla(projekt) {
  const kravFran = createRequire(join(process.cwd(), "functions", "package.json"));
  const { initializeApp, applicationDefault } = await import(pathToFileURL(kravFran.resolve("firebase-admin/app")).href);
  const { getFirestore } = await import(pathToFileURL(kravFran.resolve("firebase-admin/firestore")).href);
  initializeApp({ credential: applicationDefault(), projectId: projekt });
  const db = getFirestore();
  return {
    /** @param {string} samling @param {string} id */
    async read(samling, id) {
      const d = await db.collection(samling).doc(id).get();
      return d.exists ? { id: d.id, ...d.data() } : null;
    },
    /** @param {string} samling */
    async list(samling) {
      return (await db.collection(samling).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    /** @param {string} samling @param {string} id @param {Record<string, unknown>} falt */
    async update(samling, id, falt) {
      await db.collection(samling).doc(id).update(falt);
      return { id, ...falt };
    },
  };
}
