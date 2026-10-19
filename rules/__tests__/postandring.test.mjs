/**
 * Regelprov för att ändra och flytta en post i en egen kalender (0.123.0, cllp/lifehub.app#371), mot Firestore-emulatorn.
 *
 * ══ ⛔ VARFÖR PROVET FINNS, OCH VARFÖR REGLERNA INTE ÄNDRADES ═════════════════════════════════════════════════════
 *
 * CP 2026-10-19: "Det går dock inte att ändra en händelse." Pennan för en post är appens formulär, och formuläret sparar genom
 * `createKalenderkalla().sparaPost`, alltså `setDoc` på en post som redan finns, vilket Firestore räknar som `update`. Kalenderregelfragmentet
 * har sedan 0.36.0 `allow create, update` för ägaren med samma villkor som vid skapandet, så regeln behövde inte ändras. Men INGET prov
 * hade någonsin ändrat en post som fanns: `kalendrar.test.mjs` skapar nya poster och nekar en annans `updateDoc`, och det räcker inte för
 * att veta att ÄGAREN släpps in, att flytten till en annan egen kalender går, och att en ändring inte kan kringgå villkoren (tom titel, slut före
 * start, arkiverad eller annans kalender). Det här provet mäter det, genom ramverkets egen källa (samma väg som appen), och kalenderregelfragmentet
 * är byte för byte detsamma som 0.122.0.
 *
 *   ÄGAREN ÄNDRAR SIN POST (genom källan)
 *     titel, beskrivning, plats, tid och blockerar                       ja
 *     byter till en annan av sina kalendrar                              ja
 *     byter till en arkiverad kalender                                   nej
 *     byter till en kalender som inte finns                              nej
 *     byter till en annans kalender (samma id finns hos den andra)       nej
 *     tömmer titeln, eller sätter slut före start                        nej
 *     lägger till ett fält utanför KALENDERPOSTFALT                      nej
 *   EN ANNAN ÄNDRAR INTE (genom källan och direkt)
 *     en inloggad utan koppling                                          nej
 *     en medlem i en grupp ägaren också är med i                         nej
 *     posten är oförändrad efteråt                                       <- annars kan ett nekande bero på något annat
 *
 * Kör: npm run test:rules
 */

import { medlemskapsId } from "../../src/lib/grupp.js";
import { byggKalenderpost, byggMinKalender } from "../../src/lib/kalendrar.js";
import { createFirestoreSource } from "../../src/data/firestore.js";
import { createKalenderkalla } from "../../src/data/kalenderkalla.js";
import { after, before, describe, it } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import * as sdk from "firebase/firestore";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { doc, getDoc, setDoc, updateDoc } = sdk;
const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const AGARE = "uid-pa-agare";
const KOLLEGA = "uid-pa-kollega";
const ANNAN = "uid-pa-annan";
const G = "pa-ab";

const utanId = (/** @type {Record<string, any>} */ { id: _id, ...r }) => r;
const minKal = (/** @type {string} */ id, extra = {}) => utanId(byggMinKalender({ id, namn: id, farg: 2, ikon: "hjarta", ...extra }));
const PLANERAD = { id: "tand", kalenderId: "privat", titel: "Tandläkaren", beskrivning: "", plats: "", start: "2026-10-27T09:00", slut: "2026-10-27T10:00", heldag: false, blockerar: false };
const post = (extra = {}) => byggKalenderpost({ ...PLANERAD, ...extra });

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
    await setDoc(doc(db, `memberships/${medlemskapsId(AGARE, G)}`), { userId: AGARE, groupId: G, roll: "agare", typ: "person", status: "aktiv" });
    await setDoc(doc(db, `memberships/${medlemskapsId(KOLLEGA, G)}`), { userId: KOLLEGA, groupId: G, roll: "admin", typ: "person", status: "aktiv" });
    for (const [uid, id, extra] of /** @type {Array<[string, string, object]>} */ ([
      [AGARE, "privat", { forvald: true }],
      [AGARE, "jobb", { ordning: 10 }],
      [AGARE, "gammal", { ordning: 20, arkiverad: true }],
      [KOLLEGA, "kollegans", {}],
    ])) {
      await setDoc(doc(db, `users/${uid}/minaKalendrar/${id}`), minKal(id, extra));
    }
    await setDoc(doc(db, `users/${AGARE}/kalenderposter/tand`), utanId(post()));
  });
});

after(async () => {
  if (miljo) await miljo.cleanup();
});

/** @param {string} uid */
const som = (uid) => miljo.authenticatedContext(uid).firestore();
/** @param {string} uid */
const kalla = (uid) => createKalenderkalla({ kalla: createFirestoreSource({ db: som(uid), sdk }) });
const lasPost = async () => (await getDoc(doc(som(AGARE), `users/${AGARE}/kalenderposter/tand`))).data();
const minaAgare = () => kalla(AGARE).mina(AGARE);

describe("⛔ ägaren ändrar sin egen post, genom ramverkets källa", () => {
  it("titel, beskrivning, plats, tid och blockerar ändras, och posten läses tillbaka ändrad", async () => {
    await assertSucceeds(
      kalla(AGARE).sparaPost(AGARE, { ...PLANERAD, titel: "Tandläkaren, ny tid", beskrivning: "Ta med kortet", plats: "Storgatan 1", start: "2026-10-28T13:00", slut: "2026-10-28T14:30", blockerar: true }, await minaAgare()),
    );
    const efter = await lasPost();
    assert.equal(efter?.titel, "Tandläkaren, ny tid");
    assert.equal(efter?.start, "2026-10-28T13:00");
    assert.equal(efter?.slut, "2026-10-28T14:30");
    assert.equal(efter?.blockerar, true);
    assert.equal(efter?.beskrivning, "Ta med kortet");
  });

  it("flytten till en annan av sina kalendrar går, och bara kalenderId skiljer", async () => {
    const fore = await lasPost();
    await assertSucceeds(kalla(AGARE).sparaPost(AGARE, { ...PLANERAD, ...fore, id: "tand", kalenderId: "jobb" }, await minaAgare()));
    const efter = await lasPost();
    assert.equal(efter?.kalenderId, "jobb");
    assert.deepEqual({ ...efter, kalenderId: "x" }, { ...fore, kalenderId: "x" });
  });

  it("⛔ en flytt till en arkiverad kalender nekas, och posten ligger kvar", async () => {
    const fore = await lasPost();
    await assertFails(setDoc(doc(som(AGARE), `users/${AGARE}/kalenderposter/tand`), { ...fore, kalenderId: "gammal" }));
    assert.deepEqual(await lasPost(), fore);
  });

  it("⛔ en flytt till en kalender som inte finns, eller en annans, nekas", async () => {
    const fore = await lasPost();
    await assertFails(setDoc(doc(som(AGARE), `users/${AGARE}/kalenderposter/tand`), { ...fore, kalenderId: "saknas" }));
    // "kollegans" finns hos kollegan men inte hos ägaren: uppslaget görs under ÄGARENS sökväg.
    await assertFails(setDoc(doc(som(AGARE), `users/${AGARE}/kalenderposter/tand`), { ...fore, kalenderId: "kollegans" }));
    assert.deepEqual(await lasPost(), fore);
  });

  it("⛔ en ändring kan inte kringgå villkoren: tom titel, slut före start, ett fält som inte finns", async () => {
    const fore = await lasPost();
    await assertFails(setDoc(doc(som(AGARE), `users/${AGARE}/kalenderposter/tand`), { ...fore, titel: "" }));
    await assertFails(setDoc(doc(som(AGARE), `users/${AGARE}/kalenderposter/tand`), { ...fore, slut: "2026-10-01T08:00" }));
    await assertFails(setDoc(doc(som(AGARE), `users/${AGARE}/kalenderposter/tand`), { ...fore, groupId: G }));
    assert.deepEqual(await lasPost(), fore);
  });
});

describe("⛔ en annan ändrar inte ägarens post", () => {
  it("en inloggad utan koppling nekas genom källan och direkt, och posten är oförändrad", async () => {
    const fore = await lasPost();
    await assertFails(kalla(ANNAN).sparaPost(AGARE, { ...PLANERAD, titel: "Övertagen" }, [{ id: "privat" }]));
    await assertFails(updateDoc(doc(som(ANNAN), `users/${AGARE}/kalenderposter/tand`), { titel: "Övertagen" }));
    assert.deepEqual(await lasPost(), fore);
  });

  it("en medlem i en grupp ägaren är med i nekas också, också en admin", async () => {
    const fore = await lasPost();
    await assertFails(kalla(KOLLEGA).sparaPost(AGARE, { ...PLANERAD, titel: "Kollegans" }, [{ id: "privat" }]));
    await assertFails(updateDoc(doc(som(KOLLEGA), `users/${AGARE}/kalenderposter/tand`), { kalenderId: "jobb" }));
    assert.deepEqual(await lasPost(), fore);
  });

  it("och ägaren ändrar den fortfarande efteråt: nekandena berodde inte på att posten blivit låst", async () => {
    await assertSucceeds(updateDoc(doc(som(AGARE), `users/${AGARE}/kalenderposter/tand`), { titel: "Ägarens" }));
    assert.equal((await lasPost())?.titel, "Ägarens");
  });
});
