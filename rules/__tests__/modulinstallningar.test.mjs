/**
 * Regelprov för modulens egna inställningar (0.88.0).
 *
 * Ägaren som är en person skriver. En medlem läser. Admin, agent och en annan
 * grupp skriver inte. Radering nekas. Pinnen `visaIHuvudmenyn` hör inte hemma
 * i listan. Reglerna skrivs av `scripts/skriv-provregler.mjs` ur
 * `modulinstallningsregelfragment("modulinstallningar")`.
 */

import { medlemskapsId } from "../../src/lib/grupp.js";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const MEDLEM = "uid-cps-medlem";
const ADMIN = "uid-cps-admin";
const AGARE = "uid-cps-agare";
const AGENT = "uid-cps-agent";
const CPS = "cps-ab";
const MIRANDA = "miranda-ab";

const person = (uid) => ({ uid, namn: "Kim", typ: "manniska", kalla: "installningar" });
const boolPost = (id, bool) => ({ id, typ: "boolean", bool, text: "" });
const rad = (extra = {}) => ({
  groupId: CPS,
  modulId: "bibliotek",
  varden: [boolPost("visaklara", false)],
  uppdateradAv: person(AGARE),
  uppdaterad: Date.now(),
  ...extra,
});

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;

const medlemskap = (uid, groupId, roll, typ = "person", status = "aktiv") =>
  [`memberships/${medlemskapsId(uid, groupId)}`, { userId: uid, groupId, roll, typ, status }];

before(async () => {
  const regler = path.join(rot, "rules", "provregler.rules");
  if (!fs.existsSync(regler)) throw new Error("rules/provregler.rules saknas. Kör npm run regler:skriv först.");
  miljo = await initializeTestEnvironment({
    projectId: "regelprov-modulinstallningar",
    firestore: { rules: fs.readFileSync(regler, "utf8"), host: "127.0.0.1", port: 8080 },
  });
  await miljo.clearFirestore();
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [vag, data] of [
      medlemskap(MEDLEM, CPS, "medlem"),
      medlemskap(ADMIN, CPS, "admin"),
      medlemskap(AGARE, CPS, "agare"),
      medlemskap(AGENT, CPS, "agare", "agent"),
    ]) {
      await setDoc(doc(db, vag), data);
    }
    await setDoc(doc(db, "modulinstallningar/cps-bibliotek"), rad({ uppdaterad: 1 }));
    await setDoc(doc(db, "modulinstallningar/miranda"), rad({ groupId: MIRANDA, uppdaterad: 1 }));
  });
});

after(async () => {
  await miljo?.cleanup();
});

const db = (uid) => miljo.authenticatedContext(uid).firestore();
let lopnr = 0;
const nyttId = () => `modulinstallningar/ny-${++lopnr}`;

describe("modulinställningarnas regler: läsa", () => {
  it("en medlem läser sin grupp och inte den andra", async () => {
    await assertSucceeds(getDoc(doc(db(MEDLEM), "modulinstallningar/cps-bibliotek")));
    await assertFails(getDoc(doc(db(MEDLEM), "modulinstallningar/miranda")));
    await assertFails(getDocs(query(collection(db(MEDLEM), "modulinstallningar"))));
    await assertSucceeds(getDocs(query(collection(db(MEDLEM), "modulinstallningar"), where("groupId", "==", CPS))));
  });
});

describe("modulinställningarnas regler: skriva", () => {
  it("ägaren skapar som sig själv", async () => {
    await assertSucceeds(setDoc(doc(db(AGARE), nyttId()), rad()));
  });

  it("medlem, admin och agent skriver inte, och inte i någon annans namn", async () => {
    await assertFails(setDoc(doc(db(MEDLEM), nyttId()), rad({ uppdateradAv: person(MEDLEM) })));
    await assertFails(setDoc(doc(db(ADMIN), nyttId()), rad({ uppdateradAv: person(ADMIN) })));
    await assertFails(setDoc(doc(db(AGENT), nyttId()), rad({ uppdateradAv: { ...person(AGENT), typ: "manniska" } })));
    await assertFails(setDoc(doc(db(AGARE), nyttId()), rad({ uppdateradAv: { ...person(AGARE), typ: "agent" } })));
    await assertFails(setDoc(doc(db(AGARE), nyttId()), rad({ uppdateradAv: person(MEDLEM) })));
  });

  it("pinnen, ett extra fält och en text som inte hör ihop med typen är ett nej", async () => {
    await assertFails(setDoc(doc(db(AGARE), nyttId()), rad({ varden: [boolPost("visaIHuvudmenyn", true)] })));
    await assertFails(setDoc(doc(db(AGARE), nyttId()), rad({ extra: true })));
    await assertFails(setDoc(doc(db(AGARE), nyttId()), rad({ varden: [{ id: "anteckning", typ: "text", bool: true, text: "hej" }] })));
  });

  it("ägaren ändrar värdet, gruppen och modulen står stilla, och ingen tar bort", async () => {
    const nu = Date.now();
    await assertSucceeds(updateDoc(doc(db(AGARE), "modulinstallningar/cps-bibliotek"), { varden: [boolPost("visaklara", true)], uppdaterad: nu, uppdateradAv: person(AGARE) }));
    await assertFails(updateDoc(doc(db(AGARE), "modulinstallningar/cps-bibliotek"), { groupId: MIRANDA, uppdaterad: Date.now(), uppdateradAv: person(AGARE) }));
    await assertFails(updateDoc(doc(db(AGARE), "modulinstallningar/cps-bibliotek"), { modulId: "ekonomi", uppdaterad: Date.now(), uppdateradAv: person(AGARE) }));
    await assertFails(updateDoc(doc(db(ADMIN), "modulinstallningar/cps-bibliotek"), { varden: [boolPost("visaklara", false)], uppdaterad: Date.now(), uppdateradAv: person(ADMIN) }));
    await assertFails(deleteDoc(doc(db(AGARE), "modulinstallningar/cps-bibliotek")));
  });
});
