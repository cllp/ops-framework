/**
 * Regelprov för gruppens minne (lifehub.app#66).
 *
 * ⛔ BARA MEDLEMMAR LÄSER, BARA MEDLEMMAR LYFTER, OCH INGEN KLIENT SKRIVER I AGENTENS NAMN.
 * Ändra och ta bort får den som lyfte raden och gruppens ägare, inte en admin.
 *
 * Reglerna skrivs av `scripts/skriv-provregler.mjs` ur `minnesregelfragment("gruppmine")`.
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
const ANNAN = "uid-cps-annan";
const ADMIN = "uid-cps-admin";
const AGARE = "uid-cps-agare";
const AVSLUTAD = "uid-cps-avslutad";
const AGENT = "uid-cps-agent";
const CPS = "cps-ab";
const MIRANDA = "miranda-ab";
const T0 = Date.now();

const person = (uid) => ({ uid, namn: "Kim", typ: "manniska", kalla: "minne" });
const rad = (extra = {}) => ({
  groupId: CPS,
  text: "Budgeten är klar.",
  kalla: { slag: "trad", samtal: `${CPS}|grupp`, trad: "rot1", meddelande: "svar1" },
  lyftAv: person(MEDLEM),
  lyft: T0,
  andrad: T0,
  ...extra,
});
const ny = (extra = {}) => {
  const nu = Date.now();
  return rad({ lyft: nu, andrad: nu, ...extra });
};

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;

const medlemskap = (uid, groupId, roll, typ = "person", status = "aktiv") =>
  [`memberships/${medlemskapsId(uid, groupId)}`, { userId: uid, groupId, roll, typ, status }];

before(async () => {
  const regler = path.join(rot, "rules", "provregler.rules");
  if (!fs.existsSync(regler)) throw new Error("rules/provregler.rules saknas. Kör npm run regler:skriv först.");
  miljo = await initializeTestEnvironment({
    projectId: "regelprov-minne",
    firestore: { rules: fs.readFileSync(regler, "utf8"), host: "127.0.0.1", port: 8080 },
  });
  await miljo.clearFirestore();
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [vag, data] of [
      medlemskap(MEDLEM, CPS, "medlem"),
      medlemskap(ANNAN, CPS, "medlem"),
      medlemskap(ADMIN, CPS, "admin"),
      medlemskap(AGARE, CPS, "agare"),
      medlemskap(AVSLUTAD, CPS, "medlem", "person", "avslutad"),
      medlemskap(AGENT, CPS, "medlem", "agent"),
    ]) {
      await setDoc(doc(db, vag), data);
    }
    await setDoc(doc(db, "gruppmine/cps-budget"), rad());
    await setDoc(doc(db, "gruppmine/miranda-hemlig"), rad({ groupId: MIRANDA, text: "Bara Miranda." }));
  });
});

after(async () => {
  await miljo?.cleanup();
});

const db = (uid) => miljo.authenticatedContext(uid).firestore();
let lopnr = 0;
const nyttId = () => `gruppmine/ny-${++lopnr}`;
const skapa = (uid, data) => setDoc(doc(db(uid), nyttId()), data);

describe("minnets regler: läsa", () => {
  it("en medlem läser sin grupp och inte den andra, och inte hela samlingen", async () => {
    await assertSucceeds(getDoc(doc(db(MEDLEM), "gruppmine/cps-budget")));
    await assertFails(getDoc(doc(db(MEDLEM), "gruppmine/miranda-hemlig")));
    await assertFails(getDocs(query(collection(db(MEDLEM), "gruppmine"))));
    await assertSucceeds(getDocs(query(collection(db(MEDLEM), "gruppmine"), where("groupId", "==", CPS))));
    await assertFails(getDocs(query(collection(db(MEDLEM), "gruppmine"), where("groupId", "==", MIRANDA))));
  });

  it("ett medlemskap som inte är aktivt läser ingenting", async () => {
    await assertFails(getDoc(doc(db(AVSLUTAD), "gruppmine/cps-budget")));
  });
});

describe("minnets regler: lyfta", () => {
  it("en medlem lyfter som sig själv", async () => {
    await assertSucceeds(skapa(MEDLEM, ny()));
  });

  it("inte i en annan grupp, och inte i någon annans namn", async () => {
    await assertFails(skapa(MEDLEM, ny({ groupId: MIRANDA })));
    await assertFails(skapa(MEDLEM, ny({ lyftAv: person(ANNAN) })));
  });

  it("ingen klient skriver i agentens namn, och en agent lyfter inte", async () => {
    await assertFails(skapa(AGENT, ny({ lyftAv: person(AGENT) })));
    await assertFails(skapa(MEDLEM, ny({ lyftAv: { ...person(MEDLEM), typ: "agent" } })));
    await assertFails(skapa(AVSLUTAD, ny({ lyftAv: person(AVSLUTAD) })));
  });

  it("tom text och ett extra fält är ett nej", async () => {
    await assertFails(skapa(MEDLEM, ny({ text: "   " })));
    await assertFails(skapa(MEDLEM, ny({ artist: "Någon" })));
  });
});

describe("minnets regler: ändra och ta bort", () => {
  it("den som lyfte skriver om texten, och ägaren också", async () => {
    const nu = Date.now();
    await assertSucceeds(updateDoc(doc(db(MEDLEM), "gruppmine/cps-budget"), { text: "Budgeten är omprövad.", andrad: nu }));
    await assertSucceeds(updateDoc(doc(db(AGARE), "gruppmine/cps-budget"), { text: "Ägaren skrev om.", andrad: Date.now() }));
  });

  it("en admin och en annan medlem skriver inte om och tar inte bort", async () => {
    const nu = Date.now();
    await assertFails(updateDoc(doc(db(ADMIN), "gruppmine/cps-budget"), { text: "Admin.", andrad: nu }));
    await assertFails(updateDoc(doc(db(ANNAN), "gruppmine/cps-budget"), { text: "Annan.", andrad: nu }));
    await assertFails(deleteDoc(doc(db(ADMIN), "gruppmine/cps-budget")));
    await assertFails(deleteDoc(doc(db(ANNAN), "gruppmine/cps-budget")));
  });

  it("gruppen, källan och vem står stilla", async () => {
    const nu = Date.now();
    await assertFails(updateDoc(doc(db(MEDLEM), "gruppmine/cps-budget"), { groupId: MIRANDA, andrad: nu }));
    await assertFails(updateDoc(doc(db(AGARE), "gruppmine/cps-budget"), { lyftAv: person(AGARE), andrad: nu }));
  });

  it("den som lyfte och ägaren tar bort", async () => {
    await assertSucceeds(skapa(MEDLEM, ny()));
    const id = `gruppmine/ny-${lopnr}`;
    await assertSucceeds(deleteDoc(doc(db(MEDLEM), id)));
    await assertSucceeds(skapa(MEDLEM, ny({ text: "Ägaren tar bort." })));
    await assertSucceeds(deleteDoc(doc(db(AGARE), `gruppmine/ny-${lopnr}`)));
  });
});

describe("minnets modell och regeln säger samma sak om agenten", () => {
  it("modellen nekar typen agent, samma nej som regeln", async () => {
    const { minnesradFel } = await import("../../src/lib/minne.js");
    const data = ny({ lyftAv: { ...person(MEDLEM), typ: "agent" } });
    assert.match(String(minnesradFel(data)), /Agenten skriver inte/);
    await assertFails(skapa(MEDLEM, data));
  });
});
