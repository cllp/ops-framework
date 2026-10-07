/**
 * Regelprov för bilaga på ett meddelande (0.77.0, #292), mot Firestore-emulatorn.
 *
 * Reglerna skrivs av `scripts/skriv-provregler.mjs` med `bilagor: true`. Utan nyckeln är fältet inte tillåtet alls, och det
 * mäts byte för byte i `src/__tests__/chatt-bilagor.test.jsx` mot fixturen. Här mäts att regeln, när den är på, nekar för
 * stor fil och fel typ och släpper in en giltig bilaga, också utan text.
 *
 * Kör: npm run test:rules
 */

import { medlemskapsId } from "../../src/lib/grupp.js";
import { MAX_KOMMENTARBILAGA } from "../../src/lib/handelsemodell.js";
import { samtalsnyckel } from "../../src/lib/samtal.js";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, deleteDoc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const G = "bilaga-ab";
const ANNAN = "bilaga-annan";
const ANNA = "uid-bilaga-anna";
const BO = "uid-bilaga-bo";
const FRAMLING = "uid-bilaga-framling";
const nu = () => Date.now();
const sid = samtalsnyckel({ groupId: G, slag: "personer", deltagare: [ANNA, BO] });
const grupp = samtalsnyckel({ groupId: G, slag: "grupp" });

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;

before(async () => {
  const regler = path.join(rot, "rules", "provregler.rules");
  if (!fs.existsSync(regler)) throw new Error("rules/provregler.rules saknas. Kör npm run test:rules.");
  miljo = await initializeTestEnvironment({
    projectId: "regelprov-chattbilaga",
    firestore: { rules: fs.readFileSync(regler, "utf8"), host: "127.0.0.1", port: 8080 },
  });
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const medlem = (/** @type {string} */ uid, /** @type {string} */ gid) =>
      setDoc(doc(db, `memberships/${medlemskapsId(uid, gid)}`), { userId: uid, groupId: gid, roll: "medlem", typ: "person", status: "aktiv" });
    await medlem(ANNA, G);
    await medlem(BO, G);
    await medlem(FRAMLING, ANNAN);
    await setDoc(doc(db, `samtal/${sid}`), { groupId: G, slag: "personer", deltagare: [ANNA, BO].sort(), skapad: nu(), skapadAv: ANNA });
    await setDoc(doc(db, `samtal/${grupp}`), { groupId: G, slag: "grupp", skapad: nu(), skapadAv: ANNA });
    await setDoc(doc(db, `samtal/${grupp}/meddelanden/rot`), { text: "Roten", av: ANNA, tid: nu() });
    await setDoc(doc(db, `samtal/${grupp}/tradar/rot`), { skapad: nu(), skapadAv: ANNA });
  });
});

after(async () => {
  if (miljo) await miljo.cleanup();
});

/** @param {string} uid */
const som = (uid) => miljo.authenticatedContext(uid).firestore();
const PNG = "data:image/png;base64,iVBORw0KGgo=";
const bild = (extra = {}) => ({ dataUrl: PNG, namn: "kvitto.png", typ: "image/png", tecken: PNG.length, ...extra });
/** @param {string} typ @param {number} n */
const pa = (typ, n) => {
  const huvud = `data:${typ};base64,`;
  return huvud + "A".repeat(n - huvud.length);
};
const meddelande = (/** @type {string} */ av, extra = {}) => ({ text: "Hej", av, tid: nu(), ...extra });
const marke = (namn, typ) => ({ namn, typ });

describe("bilaga på ett meddelande", () => {
  it("meddelandet bär märket och filen ligger i sitt dokument, också utan text", async () => {
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${sid}/meddelanden/bild`), meddelande(ANNA, { text: "", bilaga: marke("kvitto.png", "image/png") })));
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${sid}/bilagor/bild`), bild()));
    const las = await assertSucceeds(getDoc(doc(som(BO), `samtal/${sid}/meddelanden/bild`)));
    assert.equal(las.data()?.bilaga?.namn, "kvitto.png");
    assert.equal(las.data()?.bilaga?.dataUrl, undefined);
    const fil = await assertSucceeds(getDoc(doc(som(BO), `samtal/${sid}/bilagor/bild`)));
    assert.equal(fil.data()?.dataUrl, PNG);
    await assertSucceeds(setDoc(doc(som(BO), `samtal/${grupp}/tradar/rot/meddelanden/svar`), meddelande(BO, { text: "Se filen", bilaga: marke("svar.png", "image/png") })));
    await assertSucceeds(setDoc(doc(som(BO), `samtal/${grupp}/bilagor/svar`), bild({ namn: "svar.png" })));
  });

  it("⛔ en främling läser varken meddelandet eller filen", async () => {
    await assertFails(getDoc(doc(som(FRAMLING), `samtal/${sid}/meddelanden/bild`)));
    await assertFails(getDoc(doc(som(FRAMLING), `samtal/${sid}/bilagor/bild`)));
  });

  it("⛔ filen kan inte ändras eller raderas", async () => {
    await assertFails(updateDoc(doc(som(ANNA), `samtal/${sid}/bilagor/bild`), { namn: "annat.png" }));
    await assertFails(deleteDoc(doc(som(ANNA), `samtal/${sid}/bilagor/bild`)));
    await assertFails(deleteDoc(doc(som(BO), `samtal/${sid}/bilagor/bild`)));
  });

  it("⛔ dataUrl på meddelandet nekas", async () => {
    await assertFails(setDoc(doc(som(ANNA), `samtal/${sid}/meddelanden/hel`), meddelande(ANNA, { bilaga: bild() })));
  });

  it("⛔ för stor fil nekas, exakt taket släpps in", async () => {
    const exakt = pa("application/pdf", MAX_KOMMENTARBILAGA);
    assert.equal(exakt.length, MAX_KOMMENTARBILAGA);
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${sid}/bilagor/tak`), { dataUrl: exakt, namn: "a.pdf", typ: "application/pdf", tecken: exakt.length }));
    const over = pa("application/pdf", MAX_KOMMENTARBILAGA + 1);
    await assertFails(setDoc(doc(som(ANNA), `samtal/${sid}/bilagor/over`), { dataUrl: over, namn: "a.pdf", typ: "application/pdf", tecken: over.length }));
  });

  it("⛔ fel typ och innehåll som inte är typen nekas", async () => {
    const svg = pa("image/svg+xml", 40);
    await assertFails(setDoc(doc(som(ANNA), `samtal/${sid}/bilagor/svg`), { dataUrl: svg, namn: "a.svg", typ: "image/svg+xml", tecken: svg.length }));
    const exe = pa("application/x-msdownload", 40);
    await assertFails(setDoc(doc(som(ANNA), `samtal/${sid}/bilagor/exe`), { dataUrl: exe, namn: "a.exe", typ: "application/x-msdownload", tecken: exe.length }));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${sid}/bilagor/lur`), bild({ typ: "application/pdf" })));
  });

  it("⛔ tom text utan bilaga nekas som förut", async () => {
    await assertFails(setDoc(doc(som(ANNA), `samtal/${sid}/meddelanden/tom`), meddelande(ANNA, { text: "" })));
  });

  it("tystning är personens egen rad", async () => {
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${sid}/tyst/${ANNA}`), { tyst: true }));
    await assertFails(getDoc(doc(som(BO), `samtal/${sid}/tyst/${ANNA}`)));
    await assertFails(deleteDoc(doc(som(ANNA), `samtal/${sid}/tyst/${ANNA}`)));
  });
});
