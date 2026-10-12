/**
 * Regelprov för modulens egna inställningar (0.88.0).
 *
 * Ägaren som är en person skriver. En medlem läser. Admin, agent och en annan
 * grupp skriver inte. Radering nekas. Pinnen `visaIHuvudmenyn` hör inte hemma
 * i listan. Reglerna skrivs av `scripts/skriv-provregler.mjs` ur
 * `modulinstallningsregelfragment("modulinstallningar")`.
 *
 * ⛔ ID:N ÄR DE RIKTIGA, UR `modulinstallningsId` (0.93.0). Provet använde förut
 * `ny-1`, `ny-2` och så vidare, alltså id som ingen klient någonsin skriver, och
 * då kunde ingen regel om vad id:t betyder fångas. Ägaren av grupp A kunde skriva
 * en rad på grupp B:s id och prövades aldrig.
 */

import { medlemskapsId } from "../../src/lib/grupp.js";
import { modulinstallningsId } from "../../src/lib/modulinstallningar.js";
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
const CPS_BIBLIOTEK = `modulinstallningar/${modulinstallningsId(CPS, "bibliotek")}`;
const MIRANDA_BIBLIOTEK = `modulinstallningar/${modulinstallningsId(MIRANDA, "bibliotek")}`;
const sokvag = (groupId, modulId) => `modulinstallningar/${modulinstallningsId(groupId, modulId)}`;

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
    await setDoc(doc(db, CPS_BIBLIOTEK), rad({ uppdaterad: 1 }));
    await setDoc(doc(db, MIRANDA_BIBLIOTEK), rad({ groupId: MIRANDA, uppdaterad: 1 }));
    // En rad med ett id som inte är gruppens och modulens egna, skapad förbi reglerna: en gammal eller skadad rad.
    await setDoc(doc(db, "modulinstallningar/gammalt-id"), rad({ uppdaterad: 1 }));
  });
});

after(async () => {
  await miljo?.cleanup();
});

const db = (uid) => miljo.authenticatedContext(uid).firestore();
// Varje skapande får en egen modul, så att id:t är det riktiga (grupp + modul) och ändå nytt. Raden bär samma modulId.
let lopnr = 0;
const nyModul = () => `modul-${++lopnr}`;

describe("modulinställningarnas regler: läsa", () => {
  it("en medlem läser sin grupp och inte den andra", async () => {
    await assertSucceeds(getDoc(doc(db(MEDLEM), CPS_BIBLIOTEK)));
    await assertFails(getDoc(doc(db(MEDLEM), MIRANDA_BIBLIOTEK)));
    await assertFails(getDocs(query(collection(db(MEDLEM), "modulinstallningar"))));
    await assertSucceeds(getDocs(query(collection(db(MEDLEM), "modulinstallningar"), where("groupId", "==", CPS))));
  });
});

describe("modulinställningarnas regler: skriva", () => {
  it("ägaren skapar som sig själv, på det riktiga id:t", async () => {
    const modulId = nyModul();
    await assertSucceeds(setDoc(doc(db(AGARE), sokvag(CPS, modulId)), rad({ modulId })));
  });

  it("medlem, admin och agent skriver inte, och inte i någon annans namn", async () => {
    const skriv = (uid, extra) => {
      const modulId = nyModul();
      return setDoc(doc(db(uid), sokvag(CPS, modulId)), rad({ modulId, ...extra }));
    };
    await assertFails(skriv(MEDLEM, { uppdateradAv: person(MEDLEM) }));
    await assertFails(skriv(ADMIN, { uppdateradAv: person(ADMIN) }));
    await assertFails(skriv(AGENT, { uppdateradAv: { ...person(AGENT), typ: "manniska" } }));
    await assertFails(skriv(AGARE, { uppdateradAv: { ...person(AGARE), typ: "agent" } }));
    await assertFails(skriv(AGARE, { uppdateradAv: person(MEDLEM) }));
  });

  it("pinnen, ett extra fält och en text som inte hör ihop med typen är ett nej", async () => {
    const skriv = (extra) => {
      const modulId = nyModul();
      return setDoc(doc(db(AGARE), sokvag(CPS, modulId)), rad({ modulId, ...extra }));
    };
    await assertFails(skriv({ varden: [boolPost("visaIHuvudmenyn", true)] }));
    await assertFails(skriv({ extra: true }));
    await assertFails(skriv({ varden: [{ id: "anteckning", typ: "text", bool: true, text: "hej" }] }));
  });

  it("ägaren ändrar värdet, gruppen och modulen står stilla, och ingen tar bort", async () => {
    const nu = Date.now();
    await assertSucceeds(updateDoc(doc(db(AGARE), CPS_BIBLIOTEK), { varden: [boolPost("visaklara", true)], uppdaterad: nu, uppdateradAv: person(AGARE) }));
    await assertFails(updateDoc(doc(db(AGARE), CPS_BIBLIOTEK), { groupId: MIRANDA, uppdaterad: Date.now(), uppdateradAv: person(AGARE) }));
    await assertFails(updateDoc(doc(db(AGARE), CPS_BIBLIOTEK), { modulId: "ekonomi", uppdaterad: Date.now(), uppdateradAv: person(AGARE) }));
    await assertFails(updateDoc(doc(db(ADMIN), CPS_BIBLIOTEK), { varden: [boolPost("visaklara", false)], uppdaterad: Date.now(), uppdateradAv: person(ADMIN) }));
    await assertFails(deleteDoc(doc(db(AGARE), CPS_BIBLIOTEK)));
  });
});

describe("modulinställningarnas regler: id:t är bundet till kroppen (0.93.0)", () => {
  // Ägaren av CPS är också ägare i sin egen grupp. Miranda är en annan grupp, vars ägare inte finns i provet:
  // det som mäts är att CPS:s ägare inte kan SKRIVA PÅ MIRANDAS ID, vilket skulle låsa Mirandas egen ägare ute.
  it("ägaren av A skapar inte en rad på B:s id, hur kroppen än ser ut", async () => {
    const mirandasId = sokvag(MIRANDA, "ekonomi");
    // Kroppen säger A (ägarens egen grupp) men id:t är B:s: det var hålet.
    await assertFails(setDoc(doc(db(AGARE), mirandasId), rad({ groupId: CPS, modulId: "ekonomi" })));
    // Kroppen säger B: ägarskapet mot B fäller den.
    await assertFails(setDoc(doc(db(AGARE), mirandasId), rad({ groupId: MIRANDA, modulId: "ekonomi" })));
  });

  it("rätt id godkänns, och ett id med fel modul eller fel grupp nekas", async () => {
    await assertSucceeds(setDoc(doc(db(AGARE), sokvag(CPS, "ekonomi")), rad({ modulId: "ekonomi" })));
    await assertFails(setDoc(doc(db(AGARE), sokvag(CPS, "kalender")), rad({ modulId: "ekonomi" })));
    await assertFails(setDoc(doc(db(AGARE), sokvag(MIRANDA, "kalender")), rad({ modulId: "kalender" })));
  });

  it("ett id som inte har tre delar nekas", async () => {
    await assertFails(setDoc(doc(db(AGARE), "modulinstallningar/fritt-id"), rad({ modulId: "arkiv" })));
    await assertFails(setDoc(doc(db(AGARE), `modulinstallningar/${modulinstallningsId(CPS, "arkiv")}~extra`), rad({ modulId: "arkiv" })));
    await assertFails(setDoc(doc(db(AGARE), `modulinstallningar/${CPS.length.toString(36)}~${CPS}`), rad({ modulId: "arkiv" })));
  });

  it("en ändring prövas mot id:t också: en rad på ett fel id går inte att ändra", async () => {
    await assertFails(updateDoc(doc(db(AGARE), "modulinstallningar/gammalt-id"), { varden: [boolPost("visaklara", true)], uppdaterad: Date.now(), uppdateradAv: person(AGARE) }));
  });
});

describe("modulinställningarnas regler: antal poster", () => {
  const poster = (n) => Array.from({ length: n }, (_, i) => boolPost(`falt${i + 1}`, false));

  it("åtta poster godkänns och nio nekas", async () => {
    await assertSucceeds(setDoc(doc(db(AGARE), sokvag(CPS, "atta")), rad({ modulId: "atta", varden: poster(8) })));
    await assertFails(setDoc(doc(db(AGARE), sokvag(CPS, "nio")), rad({ modulId: "nio", varden: poster(9) })));
  });
});
