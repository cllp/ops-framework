/**
 * Regelprov för projektens chattar (0.215.0, cllp/lifehub.app#760 skiva 2), mot Firestore-emulatorn.
 *
 * ══ ⛔ VAD SOM MÄTS ══════════════════════════════════════════════════════
 *
 * CP sa kör på förslaget i lifehub.app#760: "Varje projekt får en egen chatt ... Gruppens medlemmar och projektets gäster är med. En gäst i projektet når bara den chatten och aldrig gruppens."
 * Gruppens aktiva medlemmar läser, skapar och skriver i en projektchatt med den härledda nyckeln `<grupp>|projekt|<tagg>`. Ingen annan gör det: en medlem i en annan grupp, en
 * inloggning utan medlemskap (en gäst har inget konto i Firestore, och ett `g_`-id i `av` nekas), en nyckel med fel form, deltagare på samtalet och ett annat slag i en
 * projektnyckel nekas. Trådar finns bara i gruppchatten, och samtalet ändras och raderas aldrig.
 *
 * Projektets GÄSTER läser chatten genom servern, aldrig här. Det provas i `src/__tests__/gast-projekt-chatt.test.js` (tjänsten).
 *
 * Reglerna skrivs av `scripts/skriv-provregler.mjs` ur `samtalsregelfragment({ projekt: true, ... })` precis innan emulatorn startar.
 *
 * Kör: npm run test:rules
 */

import { medlemskapsId } from "../../src/lib/grupp.js";
import { samtalsnyckel } from "../../src/lib/samtal.js";
import { after, before, describe, it } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const G = "projekt-ab";
const ANNAN_GRUPP = "projekt-cd";
const ANNA = "uid-anna";
const BO = "uid-bo";
const LAMNAT = "uid-lamnat";
const FRAMLING = "uid-framling";
const UTAN = "uid-utan-medlemskap";
const nu = () => Date.now();
const koket = samtalsnyckel({ groupId: G, slag: "projekt", tagg: "koket" });
const badrum = samtalsnyckel({ groupId: G, slag: "projekt", tagg: "badrum" });
const andrasKok = samtalsnyckel({ groupId: ANNAN_GRUPP, slag: "projekt", tagg: "koket" });
const nytt = (extra = {}) => ({ groupId: G, slag: "projekt", skapad: nu(), skapadAv: ANNA, ...extra });

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;

before(async () => {
  const regler = path.join(rot, "rules", "provregler.rules");
  if (!fs.existsSync(regler)) throw new Error("rules/provregler.rules saknas. Kör npm run test:rules.");
  miljo = await initializeTestEnvironment({
    projectId: "regelprov-projektchatt",
    firestore: { rules: fs.readFileSync(regler, "utf8"), host: "127.0.0.1", port: 8080 },
  });
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const medlem = (/** @type {string} */ uid, /** @type {string} */ gid, status = "aktiv") =>
      setDoc(doc(db, `memberships/${medlemskapsId(uid, gid)}`), { userId: uid, groupId: gid, roll: "medlem", typ: "person", status });
    await medlem(ANNA, G);
    await medlem(BO, G);
    await medlem(LAMNAT, G, "lamnat");
    await medlem(FRAMLING, ANNAN_GRUPP);
    await setDoc(doc(db, `samtal/${koket}`), nytt());
    await setDoc(doc(db, `samtal/${koket}/meddelanden/m1`), { text: "Kakel på onsdag?", av: ANNA, tid: nu() });
    await setDoc(doc(db, `samtal/${andrasKok}`), { ...nytt(), groupId: ANNAN_GRUPP, skapadAv: FRAMLING });
    await setDoc(doc(db, `samtal/${andrasKok}/meddelanden/m1`), { text: "Deras kök", av: FRAMLING, tid: nu() });
  });
});

after(async () => {
  if (miljo) await miljo.cleanup();
});

/** @param {string} uid */
const som = (uid) => miljo.authenticatedContext(uid).firestore();

describe("läsa en projektchatt", () => {
  it("en aktiv medlem i gruppen läser samtalet och meddelandena, och frågan på slag ger projektens chattar", async () => {
    await assertSucceeds(getDoc(doc(som(BO), `samtal/${koket}`)));
    await assertSucceeds(getDocs(collection(som(BO), `samtal/${koket}/meddelanden`)));
    const svar = await assertSucceeds(getDocs(query(collection(som(BO), "samtal"), where("groupId", "==", G), where("slag", "==", "projekt"))));
    // Golv: frågan läste minst det sådda samtalet.
    if (svar.size < 1) throw new Error(`frågan på slag projekt gav ${svar.size} samtal, väntat minst 1`);
  });
  it("⛔ en medlem i en annan grupp, ett avslutat medlemskap och en inloggning utan medlemskap läser inte", async () => {
    for (const uid of [FRAMLING, LAMNAT, UTAN]) {
      await assertFails(getDoc(doc(som(uid), `samtal/${koket}`)));
      await assertFails(getDocs(collection(som(uid), `samtal/${koket}/meddelanden`)));
    }
    await assertFails(getDocs(query(collection(som(FRAMLING), "samtal"), where("groupId", "==", G), where("slag", "==", "projekt"))));
  });
  it("⛔ en medlem läser inte en annan grupps projektchatt med samma tagg", async () => {
    await assertFails(getDoc(doc(som(ANNA), `samtal/${andrasKok}`)));
    await assertFails(getDocs(collection(som(ANNA), `samtal/${andrasKok}/meddelanden`)));
  });
});

describe("skapa och skriva", () => {
  it("en medlem skapar ett annat projekts chatt med den härledda nyckeln och skriver i den", async () => {
    await assertSucceeds(setDoc(doc(som(BO), `samtal/${badrum}`), nytt({ skapadAv: BO })));
    await assertSucceeds(setDoc(doc(som(BO), `samtal/${badrum}/meddelanden/m1`), { text: "Kakel i badrummet", av: BO, tid: nu() }));
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${koket}/meddelanden/m2`), { text: "Ja, onsdag", av: ANNA, tid: nu() }));
  });
  it("⛔ en medlem i en annan grupp eller utan medlemskap skapar inte och skriver inte", async () => {
    const sid = samtalsnyckel({ groupId: G, slag: "projekt", tagg: "garaget" });
    for (const uid of [FRAMLING, UTAN, LAMNAT]) {
      await assertFails(setDoc(doc(som(uid), `samtal/${sid}`), nytt({ skapadAv: uid })));
      await assertFails(setDoc(doc(som(uid), `samtal/${koket}/meddelanden/x-${uid}`), { text: "In", av: uid, tid: nu() }));
    }
  });
  it("⛔ ett gästid i `av` nekas: bara servern skriver en gästs meddelande", async () => {
    await assertFails(setDoc(doc(som(ANNA), `samtal/${koket}/meddelanden/g1`), { text: "Som gäst", av: "g_abc", tid: nu() }));
  });
  it("⛔ en nyckel med fel form nekas: versaler, för lång, en fjärde del, fel grupp, och slaget måste vara projekt", async () => {
    for (const sid of [`${G}|projekt|Koket`, `${G}|projekt|${"a".repeat(25)}`, `${G}|projekt|-koket`, `${G}|projekt|koket|x`, `${ANNAN_GRUPP}|projekt|koket`, `${G}|projekt|`]) {
      await assertFails(setDoc(doc(som(ANNA), `samtal/${sid}`), nytt()));
    }
    await assertFails(setDoc(doc(som(ANNA), `samtal/${samtalsnyckel({ groupId: G, slag: "projekt", tagg: "vinden" })}`), nytt({ slag: "grupp" })));
  });
  it("⛔ en projektchatt bär inga deltagare och inga andra fält", async () => {
    const sid = samtalsnyckel({ groupId: G, slag: "projekt", tagg: "kallaren" });
    await assertFails(setDoc(doc(som(ANNA), `samtal/${sid}`), nytt({ deltagare: [ANNA, BO] })));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${sid}`), nytt({ rubrik: "Källaren" })));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${sid}`), nytt({ skapadAv: BO })));
  });
  it("⛔ samtalet ändras och raderas aldrig, och trådar finns bara i gruppchatten", async () => {
    await assertFails(updateDoc(doc(som(ANNA), `samtal/${koket}`), { skapad: nu() }));
    await assertFails(deleteDoc(doc(som(ANNA), `samtal/${koket}`)));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${koket}/tradar/m1`), { skapad: nu(), skapadAv: ANNA }));
  });
});
