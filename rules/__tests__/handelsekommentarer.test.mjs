/**
 * Regelprov för kommentarer och läsmärken på en händelse (0.48.0, #232, beslut 0002), mot Firestore-emulatorn.
 *
 * ══ ⛔ VAD SOM MÄTS ═══════════════════════════════════════════════════════════
 *
 *   KOMMENTARER (handelser/{hid}/kommentarer/{kid}), genom ramverkets källa där det går
 *     medlem skriver i eget namn och läser tråden            ja
 *     medlem skriver i någon annans namn                     nej      <- "bara i eget namn"
 *     medlem i en annan grupp skriver eller läser            nej
 *     kommentar på en händelse som inte finns                nej
 *     tom text, text över taket, okänt fält, fält saknas     nej
 *     skapad som inte är en ISO-tid                          nej
 *     ändra en kommentar, också sin egen                     nej      <- "ingen ändring i efterhand"
 *     ta bort sin egen                                       ja       <- CP 2026-10-02: "Ja"
 *     ta bort någon annans, också som ägare                  nej
 *
 *   LÄSMÄRKEN (handelser/{hid}/lasmarken/{uid})
 *     personen själv skriver och läser sitt                  ja
 *     skriver eller läser någon annans                       nej
 *     medlem i en annan grupp skriver sitt                   nej
 *     okänt fält, lastTill som inte är ISO-tid               nej
 *     radering                                               nej
 *
 * Kör: npm run test:rules
 */

import { medlemskapsId } from "../../src/lib/grupp.js";
import { createFirestoreSource } from "../../src/data/firestore.js";
import { createKommentarkalla } from "../../src/data/kalenderkalla.js";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import * as sdk from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } = sdk;
const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const AGARE = "uid-hk-agare";
const MEDLEM = "uid-hk-medlem";
const ANNAN = "uid-hk-annan";
const G = "hk-ab";
const H = "hk-hb";
const NU = "2026-10-02T10:00:00.000Z";
const skapare = (/** @type {string} */ uid) => ({ uid, namn: uid, typ: "manniska", kalla: "prov" });
const rad = (/** @type {string} */ uid, extra = {}) => ({ text: "Hej", skapad: NU, skapadAv: skapare(uid), ...extra });

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
    const m = (/** @type {string} */ uid, /** @type {string} */ gid, /** @type {string} */ roll) =>
      setDoc(doc(db, `memberships/${medlemskapsId(uid, gid)}`), { userId: uid, groupId: gid, roll, typ: "person", status: "aktiv" });
    await m(AGARE, G, "agare");
    await m(MEDLEM, G, "medlem");
    await m(ANNAN, H, "agare");
    await setDoc(doc(db, "handelser/k1"), { groupId: G, rubrik: "Höstfest" });
    await setDoc(doc(db, "handelser/k2"), { groupId: H, rubrik: "Annan grupp" });
    await setDoc(doc(db, "handelser/k1/kommentarer/agarens"), rad(AGARE, { text: "Ägarens" }));
  });
});

after(async () => {
  if (miljo) await miljo.cleanup();
});

/** @param {string} uid */
const som = (uid) => miljo.authenticatedContext(uid).firestore();
/** @param {string} uid */
const kalla = (uid) => createKommentarkalla({ kalla: createFirestoreSource({ db: som(uid), sdk }) });

describe("kommentarerna", () => {
  it("en medlem skriver i eget namn genom källan och läser tråden, äldst först", async () => {
    await assertSucceeds(kalla(MEDLEM).skriv("k1", "Jag tar med kaffe", { skapare: skapare(MEDLEM), nu: () => "2026-10-02T11:00:00.000Z" }));
    const trad = await assertSucceeds(kalla(MEDLEM).lista("k1"));
    assert.deepEqual(trad.map((k) => k.text), ["Ägarens", "Jag tar med kaffe"]);
  });
  it("⛔ ingen skriver i någon annans namn, inte heller ägaren", async () => {
    await assertFails(setDoc(doc(som(AGARE), "handelser/k1/kommentarer/x1"), rad(MEDLEM)));
  });
  it("⛔ en medlem i en annan grupp skriver inte och läser inte", async () => {
    await assertFails(setDoc(doc(som(ANNAN), "handelser/k1/kommentarer/x2"), rad(ANNAN)));
    await assertFails(getDocs(collection(som(ANNAN), "handelser/k1/kommentarer")));
    await assertFails(getDoc(doc(som(ANNAN), "handelser/k1/kommentarer/agarens")));
  });
  it("⛔ ingen kommentar på en händelse som inte finns", async () => {
    await assertFails(setDoc(doc(som(MEDLEM), "handelser/saknas/kommentarer/x3"), rad(MEDLEM)));
  });
  it("⛔ tom text, text över taket, okänt fält och saknat fält avvisas", async () => {
    await assertFails(setDoc(doc(som(MEDLEM), "handelser/k1/kommentarer/x4"), rad(MEDLEM, { text: "" })));
    await assertFails(setDoc(doc(som(MEDLEM), "handelser/k1/kommentarer/x5"), rad(MEDLEM, { text: "a".repeat(5001) })));
    await assertSucceeds(setDoc(doc(som(MEDLEM), "handelser/k1/kommentarer/x6"), rad(MEDLEM, { text: "a".repeat(5000) })));
    await assertFails(setDoc(doc(som(MEDLEM), "handelser/k1/kommentarer/x7"), rad(MEDLEM, { groupId: G })));
    const { skapad: _s, ...utanSkapad } = rad(MEDLEM);
    await assertFails(setDoc(doc(som(MEDLEM), "handelser/k1/kommentarer/x8"), utanSkapad));
  });
  it("⛔ skapad ska vara en ISO-tid", async () => {
    await assertFails(setDoc(doc(som(MEDLEM), "handelser/k1/kommentarer/x9"), rad(MEDLEM, { skapad: "igår" })));
  });
  it("⛔ en kommentar ändras inte, inte ens av den som skrev den", async () => {
    await assertFails(updateDoc(doc(som(AGARE), "handelser/k1/kommentarer/agarens"), { text: "Ändrad" }));
  });
  it("den som skrev en kommentar tar bort den genom källan", async () => {
    await miljo.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "handelser/k1/kommentarer/egen"), rad(MEDLEM, { text: "Fel" })));
    await assertSucceeds(kalla(MEDLEM).taBort("k1", "egen", MEDLEM));
  });
  it("⛔ ingen tar bort någon annans kommentar, inte heller ägaren", async () => {
    await miljo.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "handelser/k1/kommentarer/medlemmens"), rad(MEDLEM)));
    await assertFails(deleteDoc(doc(som(AGARE), "handelser/k1/kommentarer/medlemmens")));
  });
});

describe("läsmärkena", () => {
  it("personen själv flyttar och läser sitt märke genom källan", async () => {
    await assertSucceeds(kalla(MEDLEM).markeraLast("k1", MEDLEM, NU));
    const mark = await assertSucceeds(kalla(MEDLEM).lastTill(["k1"], MEDLEM));
    assert.equal(mark.get("k1"), NU);
  });
  it("⛔ ingen skriver eller läser någon annans märke", async () => {
    await assertFails(setDoc(doc(som(AGARE), `handelser/k1/lasmarken/${MEDLEM}`), { lastTill: NU }));
    await assertFails(getDoc(doc(som(AGARE), `handelser/k1/lasmarken/${MEDLEM}`)));
  });
  it("⛔ en medlem i en annan grupp skriver inte sitt märke på gruppens händelse", async () => {
    await assertFails(setDoc(doc(som(ANNAN), `handelser/k1/lasmarken/${ANNAN}`), { lastTill: NU }));
  });
  it("⛔ okänt fält och lastTill som inte är en ISO-tid avvisas", async () => {
    await assertFails(setDoc(doc(som(MEDLEM), `handelser/k1/lasmarken/${MEDLEM}`), { lastTill: NU, antal: 3 }));
    await assertFails(setDoc(doc(som(MEDLEM), `handelser/k1/lasmarken/${MEDLEM}`), { lastTill: "nyss" }));
  });
  it("⛔ ett läsmärke raderas inte", async () => {
    await assertFails(deleteDoc(doc(som(MEDLEM), `handelser/k1/lasmarken/${MEDLEM}`)));
  });
});
