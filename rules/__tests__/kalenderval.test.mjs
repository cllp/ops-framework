/**
 * Regelprov för personens kalenderval (0.151.0, CP 2026-10-28): `users/{uid}/kalenderval/{gruppId}`.
 *
 * Bara personen själv läser och skriver sitt dokument. Ingen annan, inte heller en gruppadmin eller en ägare. Formen är exakt (`v`, `syns`, `visning`, `fore`), antalet poster
 * har ett tak, värdena är sanningsvärden respektive de tre visningarna, och dokumentet raderas aldrig. Reglerna skrivs av `scripts/skriv-provregler.mjs` ur
 * `kalendervalsregelfragment("kalenderval")`.
 *
 * ⛔ RÖTT UTAN REGEL: varje nekat fall är grönt för att en regel nekar det, och provet "utan regeln" (`--bevisa`-motsvarigheten för regelprov) är att samma skrivningar
 * mot catch-allen, som gäller för en samling utan block, nekas lika. Den sista beskrivningen (en annan samling) mäter att fragmentet inte öppnar något utanför sig.
 */

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, deleteDoc, getDocs, collection } from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_KALENDERVAL } from "../../src/lib/kalendersynlighet.js";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const PERSON = "uid-kim";
const ANNAN = "uid-annan";
const GRUPP = "cps-ab";
const MIN = `users/${PERSON}/kalenderval/${GRUPP}`;
const gilltigt = (extra = {}) => ({ v: 1, syns: { apple: false, arenden: true }, visning: { mina: "ram", apple: "bada" }, ...extra });

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;

before(async () => {
  const regler = path.join(rot, "rules", "provregler.rules");
  if (!fs.existsSync(regler)) throw new Error("rules/provregler.rules saknas. Kör npm run regler:skriv först.");
  miljo = await initializeTestEnvironment({
    projectId: "regelprov-kalenderval",
    firestore: { rules: fs.readFileSync(regler, "utf8"), host: "127.0.0.1", port: 8080 },
  });
  await miljo.clearFirestore();
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), MIN), gilltigt());
  });
});

after(async () => {
  await miljo?.cleanup();
});

const db = (uid) => miljo.authenticatedContext(uid).firestore();
const anonym = () => miljo.unauthenticatedContext().firestore();
const mina = (data, grupp = GRUPP) => setDoc(doc(db(PERSON), `users/${PERSON}/kalenderval/${grupp}`), data);

describe("kalendervalens regler: vem som läser och skriver", () => {
  it("personen läser och skriver sitt eget dokument", async () => {
    await assertSucceeds(getDoc(doc(db(PERSON), MIN)));
    await assertSucceeds(mina(gilltigt()));
    await assertSucceeds(mina({ v: 1, syns: {}, visning: {} }));
  });

  it("⛔ ingen annan läser eller skriver det: inte en annan person, inte en utloggad", async () => {
    await assertFails(getDoc(doc(db(ANNAN), MIN)));
    await assertFails(setDoc(doc(db(ANNAN), MIN), gilltigt()));
    await assertFails(getDoc(doc(anonym(), MIN)));
    await assertFails(setDoc(doc(anonym(), MIN), gilltigt()));
    // Och inte hela samlingen heller.
    await assertFails(getDocs(collection(db(ANNAN), `users/${PERSON}/kalenderval`)));
    await assertSucceeds(getDocs(collection(db(PERSON), `users/${PERSON}/kalenderval`)));
  });

  it("raderas aldrig, inte av personen själv", async () => {
    await assertFails(deleteDoc(doc(db(PERSON), MIN)));
  });
});

describe("kalendervalens regler: formen", () => {
  it("fore är frivilligt, och en tom fore är ett riktigt värde", async () => {
    await assertSucceeds(mina(gilltigt({ fore: { apple: true } })));
    await assertSucceeds(mina(gilltigt({ fore: {} })));
  });

  it("fel version, saknade fält och främmande fält nekas", async () => {
    await assertFails(mina(gilltigt({ v: 2 })));
    await assertFails(mina({ syns: {}, visning: {} }));
    await assertFails(mina({ v: 1, visning: {} }));
    await assertFails(mina({ v: 1, syns: {} }));
    await assertFails(mina(gilltigt({ extra: 1 })));
    await assertFails(mina(gilltigt({ uppdaterad: 1 })));
  });

  it("kartorna är kartor med rätt värden", async () => {
    await assertFails(mina(gilltigt({ syns: [true] })));
    await assertFails(mina(gilltigt({ syns: { apple: "nej" } })));
    await assertFails(mina(gilltigt({ syns: { apple: 1 } })));
    await assertFails(mina(gilltigt({ visning: { apple: "stor" } })));
    await assertFails(mina(gilltigt({ visning: { apple: true } })));
    await assertFails(mina(gilltigt({ fore: { apple: "ja" } })));
    await assertFails(mina(gilltigt({ fore: [] })));
  });

  it("taket: MAX_KALENDERVAL poster går, en till nekas", async () => {
    const poster = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, true]));
    await assertSucceeds(mina(gilltigt({ syns: poster(MAX_KALENDERVAL) })));
    await assertFails(mina(gilltigt({ syns: poster(MAX_KALENDERVAL + 1) })));
    await assertFails(mina(gilltigt({ fore: poster(MAX_KALENDERVAL + 1) })));
  });

  it("dokumentets id är ett grupp-id: versaler, snedstreck och för långa id nekas", async () => {
    await assertSucceeds(mina(gilltigt(), "annan-grupp"));
    await assertFails(mina(gilltigt(), "Stora"));
    await assertFails(mina(gilltigt(), "a".repeat(81)));
    await assertSucceeds(mina(gilltigt(), "a".repeat(80)));
  });
});

describe("kalendervalens regler: fragmentet öppnar inget utanför sig", () => {
  it("en annan samling under användaren nekas av catch-allen", async () => {
    await assertFails(setDoc(doc(db(PERSON), `users/${PERSON}/andrasaker/${GRUPP}`), gilltigt()));
    await assertFails(getDoc(doc(db(PERSON), `users/${PERSON}/andrasaker/${GRUPP}`)));
  });

  it("golv: dokumentet provet läste finns och har rätt innehåll", async () => {
    const d = await getDoc(doc(db(PERSON), MIN));
    assert.equal(d.exists(), true);
    assert.equal(d.data().v, 1);
  });
});
