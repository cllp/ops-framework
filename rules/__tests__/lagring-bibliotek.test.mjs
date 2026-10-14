/**
 * Storage-regelprov för bibliotekets filer (granskningen av PR 365, 0.101.0).
 *
 * ⛔ FÖRSTA STORAGE-PROVET I RAMVERKET. `lagringsregelfragment({ bibliotek })` hade inget prov i något repo. Proven nedan kör mot
 * storage-emulatorn, med Firestore-emulatorn bredvid, eftersom regeln slår upp posten och medlemskapet där (`firestore.get`).
 *
 *   MITT      ägaren laddar upp och läser sin fil. En annan person läser och laddar inte upp. Ett planterat medlemskap vars grupp är
 *             platsen öppnar den inte. En uppladdning till en post som inte finns nekas.
 *   GRUPP     en medlem laddar upp till sin egen post och läser. En icke-medlem läser inte.
 *   RADERA    ingen klient raderar en fil, inte ens ägaren: servern gör det när posten tas bort.
 *
 * Reglerna skrivs av `scripts/skriv-provregler.mjs` (`rules/provlagring.rules`).
 */

import { medlemskapsId } from "../../src/lib/grupp.js";
import { mittBibliotek } from "../../src/lib/bibliotek.js";
import { after, before, describe, it } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const AGARE = "uidKimLagring";
const ANNAN = "uidAnnanLagring";
const INKRAKT = "uidInkraktLagring";
const CPS = "cps-ab";
const MIN = mittBibliotek(AGARE);
const BYTE = new Uint8Array([37, 80, 68, 70]);
const PDF = { contentType: "application/pdf" };

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;
const lagringSom = (uid) => miljo.authenticatedContext(uid).storage();
const post = (groupId, uid, id) => {
  const nu = Date.now();
  return {
    groupId,
    typ: "fil",
    rubrik: "Kvitto",
    fil: { sokvag: `grupper/${groupId}/bibliotek/${id}/kvitto.pdf`, namn: "kvitto.pdf", mime: "application/pdf", byte: 4 },
    skapadAv: { uid, namn: "Kim", typ: "manniska", kalla: "bibliotek" },
    skapad: nu,
    andrad: nu,
  };
};

before(async () => {
  const lagringsregler = path.join(rot, "rules", "provlagring.rules");
  const regler = path.join(rot, "rules", "provregler.rules");
  if (!fs.existsSync(lagringsregler) || !fs.existsSync(regler)) throw new Error("Provreglerna saknas. Kör npm run regler:skriv först.");
  miljo = await initializeTestEnvironment({
    projectId: "regelprov",
    firestore: { rules: fs.readFileSync(regler, "utf8"), host: "127.0.0.1", port: 8080 },
    storage: { rules: fs.readFileSync(lagringsregler, "utf8"), host: "127.0.0.1", port: 9199 },
  });
  await miljo.clearFirestore();
  await miljo.clearStorage();
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `memberships/${medlemskapsId(AGARE, CPS)}`), { userId: AGARE, groupId: CPS, roll: "medlem", typ: "person", status: "aktiv" });
    await setDoc(doc(db, `memberships/${INKRAKT}|${MIN}`), { userId: INKRAKT, groupId: MIN, roll: "admin", typ: "person", status: "aktiv" });
    await setDoc(doc(db, "bibliotek/m1"), post(MIN, AGARE, "m1"));
    await setDoc(doc(db, "bibliotek/g1"), post(CPS, AGARE, "g1"));
  });
});

after(async () => {
  await miljo?.cleanup();
});

describe("Lagring: Mitt bibliotek", () => {
  it("ägaren laddar upp och läser sin fil", async () => {
    await assertSucceeds(uploadBytes(ref(lagringSom(AGARE), `grupper/${MIN}/bibliotek/m1/kvitto.pdf`), BYTE, PDF));
    await assertSucceeds(getBytes(ref(lagringSom(AGARE), `grupper/${MIN}/bibliotek/m1/kvitto.pdf`)));
  });
  it("en annan person läser inte och laddar inte upp", async () => {
    await assertFails(getBytes(ref(lagringSom(ANNAN), `grupper/${MIN}/bibliotek/m1/kvitto.pdf`)));
    await assertFails(uploadBytes(ref(lagringSom(ANNAN), `grupper/${MIN}/bibliotek/m1/kvitto.pdf`), BYTE, PDF));
  });
  it("ett planterat medlemskap vars grupp är platsen öppnar den inte", async () => {
    await assertFails(getBytes(ref(lagringSom(INKRAKT), `grupper/${MIN}/bibliotek/m1/kvitto.pdf`)));
    await assertFails(uploadBytes(ref(lagringSom(INKRAKT), `grupper/${MIN}/bibliotek/m1/kvitto.pdf`), BYTE, PDF));
  });
  it("en uppladdning till en post som inte finns nekas, också för ägaren", async () => {
    await assertFails(uploadBytes(ref(lagringSom(AGARE), `grupper/${MIN}/bibliotek/finns-inte/kvitto.pdf`), BYTE, PDF));
  });
  it("ingen klient raderar en fil, inte ens ägaren", async () => {
    await assertFails(deleteObject(ref(lagringSom(AGARE), `grupper/${MIN}/bibliotek/m1/kvitto.pdf`)));
  });
});

describe("Lagring: gruppens bibliotek", () => {
  it("en medlem laddar upp till sin post och läser, en annan läser inte", async () => {
    await assertSucceeds(uploadBytes(ref(lagringSom(AGARE), `grupper/${CPS}/bibliotek/g1/kvitto.pdf`), BYTE, PDF));
    await assertSucceeds(getBytes(ref(lagringSom(AGARE), `grupper/${CPS}/bibliotek/g1/kvitto.pdf`)));
    await assertFails(getBytes(ref(lagringSom(ANNAN), `grupper/${CPS}/bibliotek/g1/kvitto.pdf`)));
  });
});
