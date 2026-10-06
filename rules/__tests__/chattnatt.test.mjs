/**
 * Regelprov för chattens nattskiva (#273 och chattanalysens avsnitt 3), mot Firestore-emulatorn.
 *
 * ══ ⛔ VAD SOM MÄTS ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * Varje ny undersamling och varje nytt fält är en nyckel till `samtalsregelfragment()`, utan förval. Provreglerna skrivs med
 * alla nycklar påslagna (`scripts/skriv-provregler.mjs`), och här mäts vad de släpper in och vad de nekar. Att en app som
 * INTE skickar nycklarna får samma regeltext som förut mäts byte för byte i `src/__tests__/chatt-status.test.jsx`.
 *
 * Rollerna: tre medlemmar (Anna, Bo, Cecilia), en borttagen (David), agenten (en medlem av typen agent), en främling (medlem i
 * en annan grupp) och den som inte är inloggad. Samtalen: gruppchatten, Annas och Bos privata samtal, och en annan grupps chatt.
 *
 * ⛔ RÖTT UTAN SITT SKYDD (regel 4). `CHATTPROV_MUTATION=<namn>` läser provreglerna med ett skydd bortplockat (tabellen
 * `MUTATIONER`). En mutation vars text inte finns exakt en gång är ett fel och inte en grön körning.
 *
 * Kör: npm run test:rules
 */

import { after, before, describe, it } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { medlemskapsId } from "../../src/lib/grupp.js";
import { samtalsnyckel } from "../../src/lib/samtal.js";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Ett skydd per rad: texten som tas bort eller byts, och vad den byts mot. Namnet går i `CHATTPROV_MUTATION`.
 * @type {Record<string, [string, string]>}
 */
export const MUTATIONER = {
  "status-skrivbar": ["match /status/{dok} {\n        allow read: if opsISamtal(sid);\n        allow write: if false;", "match /status/{dok} {\n        allow read: if opsISamtal(sid);\n        allow write: if request.auth != null;"],
  "status-las-alla": ["match /status/{dok} {\n        allow read: if opsISamtal(sid);", "match /status/{dok} {\n        allow read: if request.auth != null;"],
  "tradstatus-skrivbar": ["match /status/{dok} {\n          allow read: if opsIGruppchatten(sid);\n          allow write: if false;", "match /status/{dok} {\n          allow read: if opsIGruppchatten(sid);\n          allow write: if request.auth != null;"],
};

/** Provreglerna, eller (bara för bevisets röda riktning) provreglerna med ett skydd bortplockat. */
function regeltext() {
  const fil = path.join(rot, "rules", "provregler.rules");
  if (!fs.existsSync(fil)) throw new Error("rules/provregler.rules saknas. Kör npm run test:rules.");
  const text = fs.readFileSync(fil, "utf8");
  // ⛔ GOLV: varje nytt block måste finnas, annars mäter provet regler utan det som ska provas.
  for (const block of ["match /status/{dok} {"]) {
    if (!text.includes(block)) throw new Error(`"${block}" saknas i provreglerna`);
  }
  const namn = process.env.CHATTPROV_MUTATION;
  if (!namn) return text;
  const m = MUTATIONER[namn];
  if (!m) throw new Error(`okänd mutation "${namn}". Giltiga: ${Object.keys(MUTATIONER).join(", ")}`);
  if (text.split(m[0]).length !== 2) throw new Error(`mutationen "${namn}" hittar inte sin text exakt en gång`);
  return text.replace(m[0], m[1]);
}

const G = "cps-ab";
const ANNAN_G = "miranda-ab";
const ANNA = "uid-anna";
const BO = "uid-bo";
const CECILIA = "uid-cecilia";
const DAVID = "uid-david"; // borttagen
const AGENT = "uid-agent"; // medlem av typen agent
const FRAMLING = "uid-framling"; // medlem i en annan grupp

const nu = () => Date.now();
const grupp = samtalsnyckel({ groupId: G, slag: "grupp" });
const annaBo = samtalsnyckel({ groupId: G, slag: "personer", deltagare: [ANNA, BO] });
const annanGrupp = samtalsnyckel({ groupId: ANNAN_G, slag: "grupp" });
const M1 = "m1"; // ett meddelande av Cecilia i gruppchatten
const P1 = "p1"; // ett meddelande av Anna i det privata samtalet
const T = "m-trad"; // ett meddelande med en tråd
const TM = "t1"; // ett meddelande i tråden

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;

before(async () => {
  const mutation = process.env.CHATTPROV_MUTATION;
  miljo = await initializeTestEnvironment({
    // ⛔ Ett eget projekt per mutation, så att en körning aldrig läser en annan körnings regler.
    projectId: mutation ? `regelprov-chatt-${mutation}` : "regelprov-chatt",
    firestore: { rules: regeltext(), host: "127.0.0.1", port: Number(process.env.FIRESTORE_PORT ?? 8080) },
  });
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const medlem = (/** @type {string} */ uid, /** @type {string} */ gid, typ = "person", status = "aktiv") =>
      setDoc(doc(db, `memberships/${medlemskapsId(uid, gid)}`), { userId: uid, groupId: gid, roll: "medlem", typ, status });
    await medlem(ANNA, G);
    await medlem(BO, G);
    await medlem(CECILIA, G);
    await medlem(DAVID, G, "person", "avslutad");
    await medlem(AGENT, G, "agent");
    await medlem(FRAMLING, ANNAN_G);
    await setDoc(doc(db, `samtal/${grupp}`), { groupId: G, slag: "grupp", skapad: nu(), skapadAv: ANNA });
    await setDoc(doc(db, `samtal/${annaBo}`), { groupId: G, slag: "personer", deltagare: [ANNA, BO].sort(), skapad: nu(), skapadAv: ANNA });
    await setDoc(doc(db, `samtal/${annanGrupp}`), { groupId: ANNAN_G, slag: "grupp", skapad: nu(), skapadAv: FRAMLING });
    await setDoc(doc(db, `samtal/${grupp}/meddelanden/${M1}`), { text: "Styrelsemötet flyttas", av: CECILIA, tid: nu() });
    await setDoc(doc(db, `samtal/${grupp}/meddelanden/${T}`), { text: "Budgeten?", av: BO, tid: nu() });
    await setDoc(doc(db, `samtal/${grupp}/tradar/${T}`), { skapad: nu(), skapadAv: BO });
    await setDoc(doc(db, `samtal/${grupp}/tradar/${T}/meddelanden/${TM}`), { text: "Tight", av: CECILIA, tid: nu() });
    await setDoc(doc(db, `samtal/${annaBo}/meddelanden/${P1}`), { text: "Bara till dig", av: ANNA, tid: nu() });
    await setDoc(doc(db, `samtal/${annanGrupp}/meddelanden/x1`), { text: "Annan grupp", av: FRAMLING, tid: nu() });
    // Statusen skrivs av servern, förbi reglerna.
    await setDoc(doc(db, `samtal/${grupp}/status/agent`), { lage: "tanker", sedan: nu() });
    await setDoc(doc(db, `samtal/${grupp}/tradar/${T}/status/agent`), { lage: "skriver", sedan: nu() });
    await setDoc(doc(db, `samtal/${annaBo}/status/agent`), { lage: "tanker", sedan: nu() });
  });
});

after(async () => {
  if (miljo) await miljo.cleanup();
});

/** @param {string} uid */
const som = (uid) => miljo.authenticatedContext(uid).firestore();
const utan = () => miljo.unauthenticatedContext().firestore();

describe("⛔ agentens status (#273): medlemmar läser, ingen klient skriver", () => {
  it("en medlem läser gruppchattens och trådens status, en deltagare det privata samtalets", async () => {
    await assertSucceeds(getDoc(doc(som(CECILIA), `samtal/${grupp}/status/agent`)));
    await assertSucceeds(getDocs(collection(som(CECILIA), `samtal/${grupp}/status`)));
    await assertSucceeds(getDoc(doc(som(CECILIA), `samtal/${grupp}/tradar/${T}/status/agent`)));
    await assertSucceeds(getDoc(doc(som(BO), `samtal/${annaBo}/status/agent`)));
  });
  it("⛔ en främling, en borttagen medlem, en tredje person och den som inte är inloggad läser inte", async () => {
    for (const u of [FRAMLING, DAVID]) await assertFails(getDoc(doc(som(u), `samtal/${grupp}/status/agent`)));
    await assertFails(getDoc(doc(som(CECILIA), `samtal/${annaBo}/status/agent`)));
    await assertFails(getDoc(doc(utan(), `samtal/${grupp}/status/agent`)));
    await assertFails(getDoc(doc(som(FRAMLING), `samtal/${grupp}/tradar/${T}/status/agent`)));
  });
  it("⛔ ingen klient skriver statusen: inte en medlem, inte en klient inloggad som agenten", async () => {
    for (const u of [ANNA, AGENT]) {
      await assertFails(setDoc(doc(som(u), `samtal/${grupp}/status/agent`), { lage: "skriver", sedan: nu() }));
      await assertFails(updateDoc(doc(som(u), `samtal/${grupp}/status/agent`), { lage: "skriver" }));
      await assertFails(deleteDoc(doc(som(u), `samtal/${grupp}/status/agent`)));
      await assertFails(setDoc(doc(som(u), `samtal/${grupp}/tradar/${T}/status/agent`), { lage: "tanker", sedan: nu() }));
    }
  });
});
