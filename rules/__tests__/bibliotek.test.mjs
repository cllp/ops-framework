/**
 * Regelprov för biblioteket (analys 0004, #192).
 *
 *   medlem läser sin grupps post            ja
 *   medlem läser en annan grupps post        nej
 *   fråga utan grupp                         nej
 *   medlem skapar som sig själv              ja
 *   medlem skapar i någon annans namn        nej
 *   javascript-adress                        nej
 *   medlem ändrar sin post                   ja
 *   medlem ändrar någon annans post          nej
 *   admin ändrar någon annans post           ja
 *   radering                                 nej
 *
 * Reglerna skrivs av `scripts/skriv-provregler.mjs` ur `bibliotekregelfragment("bibliotek")`.
 */

import { medlemskapsId } from "../../src/lib/grupp.js";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, collection } from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const MEDLEM = "uid-cps-medlem";
const ANNAN = "uid-cps-annan";
const ADMIN = "uid-cps-admin";
const CPS = "cps-ab";
const MIRANDA = "miranda-ab";

const skapare = (uid) => ({ uid, namn: "Kim", typ: "manniska", kalla: "bibliotek" });
const anteckning = (extra = {}) => ({
  groupId: CPS,
  typ: "anteckning",
  rubrik: "Protokoll",
  text: "Vi beslutade.",
  skapadAv: skapare(MEDLEM),
  skapad: 1700000000000,
  andrad: 1700000000000,
  ...extra,
});

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;

before(async () => {
  const regler = path.join(rot, "rules", "provregler.rules");
  if (!fs.existsSync(regler)) throw new Error("rules/provregler.rules saknas. Kör npm run regler:skriv först.");
  miljo = await initializeTestEnvironment({
    projectId: "regelprov",
    firestore: { rules: fs.readFileSync(regler, "utf8"), host: "127.0.0.1", port: 8080 },
  });
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `memberships/${medlemskapsId(MEDLEM, CPS)}`), { userId: MEDLEM, groupId: CPS, roll: "medlem", typ: "person", status: "aktiv" });
    await setDoc(doc(db, `memberships/${medlemskapsId(ANNAN, CPS)}`), { userId: ANNAN, groupId: CPS, roll: "medlem", typ: "person", status: "aktiv" });
    await setDoc(doc(db, `memberships/${medlemskapsId(ADMIN, CPS)}`), { userId: ADMIN, groupId: CPS, roll: "admin", typ: "person", status: "aktiv" });
    await setDoc(doc(db, "bibliotek/cps-protokoll"), anteckning());
    await setDoc(doc(db, "bibliotek/miranda-hemlig"), anteckning({ groupId: MIRANDA, rubrik: "Miranda", text: "Bara miranda." }));
    await setDoc(doc(db, "bibliotek/cps-annans"), anteckning({ skapadAv: skapare(ANNAN), rubrik: "Annans" }));
  });
});

after(async () => {
  await miljo?.cleanup();
});

/** @param {string} uid */
const db = (uid) => miljo.authenticatedContext(uid).firestore();

describe("bibliotekets regler", () => {
  it("en medlem läser sin grupp och inte den andra, och inte hela samlingen", async () => {
    await assertSucceeds(getDoc(doc(db(MEDLEM), "bibliotek/cps-protokoll")));
    await assertFails(getDoc(doc(db(MEDLEM), "bibliotek/miranda-hemlig")));
    await assertFails(getDocs(query(collection(db(MEDLEM), "bibliotek"))));
    await assertSucceeds(getDocs(query(collection(db(MEDLEM), "bibliotek"), where("groupId", "==", CPS))));
    await assertFails(getDocs(query(collection(db(MEDLEM), "bibliotek"), where("groupId", "==", MIRANDA))));
  });

  it("en medlem skapar som sig själv, och inte med en javascript-adress eller någon annans namn", async () => {
    await assertSucceeds(setDoc(doc(db(MEDLEM), "bibliotek/ny-lank"), {
      groupId: CPS,
      typ: "lank",
      rubrik: "Verket",
      url: "https://bolagsverket.se/",
      skapadAv: skapare(MEDLEM),
      skapad: 1700000000000,
      andrad: 1700000000000,
    }));
    await assertFails(setDoc(doc(db(MEDLEM), "bibliotek/ond-lank"), {
      groupId: CPS,
      typ: "lank",
      rubrik: "Ond",
      url: "javascript:alert(1)",
      skapadAv: skapare(MEDLEM),
      skapad: 1700000000000,
      andrad: 1700000000000,
    }));
    await assertFails(setDoc(doc(db(MEDLEM), "bibliotek/fejknamn"), anteckning({ skapadAv: skapare(ANNAN), rubrik: "Fejk" })));
  });

  it("författaren ändrar sin rad, en annan medlem gör det inte, admin gör det, och ingen raderar", async () => {
    await assertSucceeds(updateDoc(doc(db(MEDLEM), "bibliotek/cps-protokoll"), { text: "Vi beslutade om bokslutet.", andrad: 1700000001000 }));
    await assertFails(updateDoc(doc(db(MEDLEM), "bibliotek/cps-annans"), { text: "Överskrivet.", andrad: 1700000001000 }));
    await assertSucceeds(updateDoc(doc(db(ADMIN), "bibliotek/cps-annans"), { text: "Admin rättade.", andrad: 1700000002000 }));
    await assertFails(deleteDoc(doc(db(ADMIN), "bibliotek/cps-protokoll")));
  });
});
