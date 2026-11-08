/**
 * 0.203.0 (CP 2026-11-08): trådens svar och märkets senaste svar genom Firestore-källan, mot Firestore-emulatorn med provreglerna.
 *
 * ══ ⛔ VAD SOM MÄTS ══════════════════════════════════════════════════════
 *
 * Komponentproven (`src/__tests__/trad-senaste-svar.test.jsx`) kör minneskällan, som inte har regler. Två saker i skivan rör vad reglerna
 * släpper in, och mäts därför här på samma väg som appen: `createFirestoreSource` mot emulatorn.
 *   - `skickaITrad` väljer svarets id själv (`m_<tid>_<följd>_<slump>`, samma form som ett meddelande med bilaga redan har), så att vyn kan
 *     visa svaret innan det är skrivet. Skrivningen blir då `setDoc` med eget id i stället för `addDoc`. Regeln ska släppa in det som en
 *     ny skapelse, för det första svaret (som skapar tråden) och för nästa (där källan inte läser tråden först, eftersom den sett den).
 *   - `senasteSvar` är en fråga på `tid` fallande med `limit: 1` under trådens meddelanden: samma läsregel som trådvyn.
 *
 * Kör: npm run test:rules
 */

import { medlemskapsId } from "../../src/lib/grupp.js";
import { createFirestoreSource } from "../../src/data/firestore.js";
import { createSamtalskalla } from "../../src/data/samtalskalla.js";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import * as sdk from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const G = "trad-kalla";
const ANNA = "uid-anna";
const BO = "uid-bo";

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;

before(async () => {
  const regler = path.join(rot, "rules", "provregler.rules");
  if (!fs.existsSync(regler)) throw new Error("rules/provregler.rules saknas. Kör npm run test:rules.");
  miljo = await initializeTestEnvironment({
    projectId: "regelprov-trad-kalla",
    firestore: { rules: fs.readFileSync(regler, "utf8"), host: "127.0.0.1", port: 8080 },
  });
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const uid of [ANNA, BO]) {
      await sdk.setDoc(sdk.doc(db, `memberships/${medlemskapsId(uid, G)}`), { userId: uid, groupId: G, roll: "medlem", typ: "person", status: "aktiv" });
    }
  });
});

after(async () => {
  if (miljo) await miljo.cleanup();
});

/** En persons källa, som appen bygger den. @param {string} uid */
const kallaFor = (uid) =>
  /** @type {any} */ (createSamtalskalla({ kalla: createFirestoreSource({ db: miljo.authenticatedContext(uid).firestore(), sdk }), tradar: "tradar" }));

/** Det som står i emulatorn, utan regler. @param {string} vag */
const lasLista = async (vag) => {
  /** @type {any[]} */
  let ut = [];
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const snap = await sdk.getDocs(sdk.collection(ctx.firestore(), vag));
    ut = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  });
  return ut;
};

describe("⛔ 0.203.0: svaret i tråden med eget id, och det senaste svaret, genom Firestore-källan", () => {
  it("första svaret skapar tråden, nästa skrivs direkt, båda under det id onLokal fick, och senasteSvar ger det nyaste", async () => {
    const anna = kallaFor(ANNA);
    const g = await anna.oppnaGrupp({ groupId: G, uid: ANNA });
    const rotm = await anna.skicka(g.id, { text: "Vem tar öppningen?", av: ANNA });
    /** @type {string[]} */
    const lokala = [];
    const forsta = await anna.skickaITrad(g.id, rotm.id, { text: "Jag kan", av: ANNA }, { onLokal: (/** @type {any} */ m) => lokala.push(m.id) });
    // Annas källa har nu sett tråden: nästa svar läser den inte först, och regeln ska ändå släppa in det (tråden finns).
    await new Promise((r) => setTimeout(r, 5));
    const andra = await anna.skickaITrad(g.id, rotm.id, { text: "Eller Bo?", av: ANNA }, { onLokal: (/** @type {any} */ m) => lokala.push(m.id) });
    assert.deepEqual(lokala, [forsta.id, andra.id]);
    assert.match(forsta.id, /^m_/);
    const lagrade = await lasLista(`samtal/${g.id}/tradar/${rotm.id}/meddelanden`);
    assert.deepEqual(lagrade.map((m) => m.id).sort(), [forsta.id, andra.id].sort());
    // Id:t är nyckeln, inte ett fält: regelns `hasOnly` hade nekat ett fält till.
    assert.ok(lagrade.every((m) => !("id" in m.data)), "id:t ska inte stå som fält i dokumentet");

    // Bo, en annan källa: tråden är okänd för den och läses först, som förut.
    await new Promise((r) => setTimeout(r, 5));
    const bo = kallaFor(BO);
    const tredje = await bo.skickaITrad(g.id, rotm.id, { text: "Jag tar den!", av: BO });
    assert.equal((await bo.antalSvar(g.id, rotm.id)).antal, 3);
    const senast = await anna.senasteSvar(g.id, rotm.id);
    assert.equal(senast?.id, tredje.id);
    assert.equal(senast?.text, "Jag tar den!");
    assert.equal(await anna.senasteSvar(g.id, "finns-inte"), null);
  });
});
