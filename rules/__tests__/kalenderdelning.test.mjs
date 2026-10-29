/**
 * Regelprov för delning av en egen kalender, bara läsning (0.154.0, cllp/lifehub.app#485), mot Firestore-emulatorn.
 *
 * ══ ⛔ VAD SOM MÄTS ═══════════════════════════════════════════════════════════
 *
 * CP:s beslut 2026-10-28: en delad kalender kan bara LÄSAS av den som fått den. Matrisen:
 *
 *   DELNINGEN, SKAPA
 *     ägaren delar med en person och med en grupp hon är med i             ja
 *     ägaren byter gruppen (en kalender delas med högst en grupp)            ja
 *     en annan skapar en delning av ägarens kalender                         nej
 *     en delning av en kalender som inte finns, eller är arkiverad           nej
 *     med sig själv, med en grupp man inte är med i, som agent i gruppen     nej
 *     fel nyckel, både person och grupp, ett fält till                       nej
 *
 *   KALENDERN OCH POSTERNA, LÄSA
 *     personen som fått delningen läser kalendern och frågar efter posterna  ja
 *     en aktiv medlem i gruppen som fått den                                 ja
 *     en fråga efter posterna utan kalenderId, eller med en annan kalender   nej   <- ingen sveper en annans poster
 *     en post eller kalender som inte delats                                 nej
 *     en medlem i en annan grupp, en avslutad medlem, en utloggad            nej   <- ingen läcka
 *
 *   KALENDERN OCH POSTERNA, SKRIVA (den som fått delningen)
 *     ändra, skapa, ta bort en post, ändra kalendern, ta bort delningen      nej
 *
 *   DELNINGARNA, LÄSA
 *     ägaren (agare), personen (person), gruppens medlem (groupId)           ja
 *     en annan grupp, en annan person, en fråga utan villkor                 nej
 *
 *   SLUTA DELA
 *     ägaren tar bort delningen, och läsningen stängs i samma stund          ja / nej efteråt
 *
 * ⛔ RÖTT UTAN ÄNDRINGEN: mot 0.153.0:s regler (inget block för delningarna) är varje "ja" ovan rött, och varje "nej" har setts falla mot en mutation
 * av regeln (PR-texten listar mutationerna och utfallen).
 *
 * Kör: npm run test:rules
 */

import { medlemskapsId } from "../../src/lib/grupp.js";
import { byggKalenderpost, byggMinKalender } from "../../src/lib/kalendrar.js";
import { byggKalenderdelning, deladeKalendrar, kalenderdelningId } from "../../src/lib/kalenderdelning.js";
import { createFirestoreSource } from "../../src/data/firestore.js";
import { createKalenderkalla } from "../../src/data/kalenderkalla.js";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import * as sdk from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } = sdk;
const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const AGARE = "uid-dl-agare";
const PERSON = "uid-dl-person";
const MEDLEM = "uid-dl-medlem";
const UTANFOR = "uid-dl-utanfor";
const AVSLUTAD = "uid-dl-avslutad";
const AGENT = "uid-dl-agent";
const LAMNAR = "uid-dl-lamnar";
const G = "dl-familj";
const K = "dl-bolag";
const H = "dl-annan";
const SAMLING = "kalenderdelningar";

const utanId = (/** @type {Record<string, any>} */ { id: _id, ...r }) => r;
const kal = (/** @type {Record<string, any>} */ extra) => utanId(byggMinKalender({ namn: "Kalender", farg: 2, ikon: "kalender", ...extra }));
const post = (/** @type {Record<string, any>} */ extra) => utanId(byggKalenderpost({ titel: "Post", start: "2026-11-02", slut: "2026-11-02", heldag: true, ...extra }));
const rad = (/** @type {Record<string, any>} */ d) => utanId(byggKalenderdelning(d));

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;

before(async () => {
  const regler = path.join(rot, "rules", "provregler.rules");
  if (!fs.existsSync(regler)) throw new Error("rules/provregler.rules saknas. Kör npm run regler:skriv först.");
  miljo = await initializeTestEnvironment({ projectId: "regelprov", firestore: { rules: fs.readFileSync(regler, "utf8"), host: "127.0.0.1", port: 8080 } });
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const medlem = (/** @type {string} */ uid, /** @type {string} */ gid, /** @type {Record<string, any>} */ extra = {}) =>
      setDoc(doc(db, `memberships/${medlemskapsId(uid, gid)}`), { userId: uid, groupId: gid, roll: "medlem", typ: "person", status: "aktiv", ...extra });
    await medlem(AGARE, G, { roll: "agare" });
    await medlem(AGARE, K);
    await medlem(MEDLEM, G);
    await medlem(AVSLUTAD, G, { status: "avslutad" });
    await medlem(UTANFOR, H);
    await medlem(AGENT, G, { typ: "agent" });
    await medlem(AGENT, H, { typ: "agent" });
    for (const id of ["barnveckor", "resor", "privat", "kallan"]) await setDoc(doc(db, `users/${AGARE}/minaKalendrar/${id}`), kal({ id, namn: id }));
    await setDoc(doc(db, `users/${AGARE}/minaKalendrar/gammal`), kal({ id: "gammal", namn: "Gammal", arkiverad: true }));
    await setDoc(doc(db, `users/${AGARE}/kalenderposter/vecka-45`), post({ id: "vecka-45", kalenderId: "barnveckor", titel: "Barnen hos mig", plats: "Hemma", beskrivning: "Hämtas fredag" }));
    await setDoc(doc(db, `users/${AGARE}/kalenderposter/resa`), post({ id: "resa", kalenderId: "resor", titel: "Visby" }));
    await setDoc(doc(db, `users/${AGARE}/kalenderposter/lakare`), post({ id: "lakare", kalenderId: "privat", titel: "Läkaren" }));
    await setDoc(doc(db, `users/${AGARE}/kalenderposter/kalla-post`), post({ id: "kalla-post", kalenderId: "kallan", titel: "Genom källan" }));
    // Granskningen av PR 468: en kalender som arkiveras efter att den delats, och en ägare som lämnar gruppen hon delat med.
    await setDoc(doc(db, `users/${AGARE}/minaKalendrar/arkivkal`), kal({ id: "arkivkal", namn: "Arkiveras" }));
    await setDoc(doc(db, `users/${AGARE}/kalenderposter/arkiv-post`), post({ id: "arkiv-post", kalenderId: "arkivkal", titel: "I en kalender som arkiveras" }));
    await medlem(LAMNAR, G);
    await setDoc(doc(db, `users/${LAMNAR}/minaKalendrar/semester`), kal({ id: "semester", namn: "Semester" }));
    await setDoc(doc(db, `users/${LAMNAR}/kalenderposter/sommar`), post({ id: "sommar", kalenderId: "semester", titel: "Sommarstugan" }));
  });
});

after(async () => {
  if (miljo) await miljo.cleanup();
});

/** @param {string} uid */
const som = (uid) => miljo.authenticatedContext(uid).firestore();
/** @param {string} uid */
const kalla = (uid) => createKalenderkalla({ kalla: createFirestoreSource({ db: som(uid), sdk }), kalenderdelningar: SAMLING });
const nyckel = (/** @type {string} */ k, /** @type {{ person: string } | { grupp: string }} */ m) => `${SAMLING}/${kalenderdelningId(AGARE, k, m)}`;
const poster = (/** @type {string} */ uid, /** @type {string} */ k) => getDocs(query(collection(som(uid), `users/${AGARE}/kalenderposter`), where("kalenderId", "==", k)));

describe("delningen: bara ägaren delar, och bara en egen kalender", () => {
  it("ägaren delar Barnveckor med en person och med sin grupp", async () => {
    await assertSucceeds(setDoc(doc(som(AGARE), nyckel("barnveckor", { person: PERSON })), rad({ agare: AGARE, kalenderId: "barnveckor", person: PERSON })));
    await assertSucceeds(setDoc(doc(som(AGARE), nyckel("barnveckor", { grupp: G })), rad({ agare: AGARE, kalenderId: "barnveckor", groupId: G })));
  });
  it("ägaren byter gruppen på en delning (en kalender delas med högst en grupp)", async () => {
    await assertSucceeds(setDoc(doc(som(AGARE), nyckel("resor", { grupp: K })), rad({ agare: AGARE, kalenderId: "resor", groupId: K })));
    await assertSucceeds(setDoc(doc(som(AGARE), nyckel("resor", { grupp: G })), rad({ agare: AGARE, kalenderId: "resor", groupId: G })));
    await assertFails(setDoc(doc(som(AGARE), nyckel("resor", { grupp: H })), rad({ agare: AGARE, kalenderId: "resor", groupId: H })));
  });
  it("⛔ en annan skapar ingen delning av ägarens kalender, varken i ägarens namn eller sitt eget", async () => {
    await assertFails(setDoc(doc(som(PERSON), nyckel("privat", { person: PERSON })), rad({ agare: AGARE, kalenderId: "privat", person: PERSON })));
    await assertFails(setDoc(doc(som(MEDLEM), nyckel("privat", { grupp: G })), rad({ agare: AGARE, kalenderId: "privat", groupId: G })));
    const egen = `${SAMLING}/${MEDLEM}|privat|person~${PERSON}`;
    await assertFails(setDoc(doc(som(MEDLEM), egen), { agare: MEDLEM, kalenderId: "privat", person: PERSON }));
  });
  it("⛔ en kalender som inte finns, eller som är arkiverad, delas inte", async () => {
    await assertFails(setDoc(doc(som(AGARE), nyckel("finns-inte", { person: PERSON })), rad({ agare: AGARE, kalenderId: "finns-inte", person: PERSON })));
    await assertFails(setDoc(doc(som(AGARE), nyckel("gammal", { person: PERSON })), rad({ agare: AGARE, kalenderId: "gammal", person: PERSON })));
  });
  it("⛔ inte med sig själv, inte med en grupp man inte är med i, och inte som agent i gruppen", async () => {
    await assertFails(setDoc(doc(som(AGARE), `${SAMLING}/${AGARE}|privat|person~${AGARE}`), { agare: AGARE, kalenderId: "privat", person: AGARE }));
    await assertFails(setDoc(doc(som(AGARE), nyckel("privat", { grupp: H })), rad({ agare: AGARE, kalenderId: "privat", groupId: H })));
    await miljo.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), `users/${AGENT}/minaKalendrar/agentens`), kal({ id: "agentens" })));
    await assertFails(setDoc(doc(som(AGENT), `${SAMLING}/${AGENT}|agentens|grupp`), { agare: AGENT, kalenderId: "agentens", groupId: G }));
  });
  it("⛔ nyckeln måste vara den fälten ger, och raden har exakt en mottagare och inga andra fält", async () => {
    await assertFails(setDoc(doc(som(AGARE), `${SAMLING}/${AGARE}|privat|person~${MEDLEM}`), { agare: AGARE, kalenderId: "privat", person: PERSON }));
    await assertFails(setDoc(doc(som(AGARE), `${SAMLING}/${AGARE}|privat|grupp`), { agare: AGARE, kalenderId: "privat", person: PERSON }));
    await assertFails(setDoc(doc(som(AGARE), `${SAMLING}/${AGARE}|barnveckor|person~${PERSON}`), { agare: AGARE, kalenderId: "privat", person: PERSON }));
    await assertFails(setDoc(doc(som(AGARE), nyckel("privat", { person: PERSON })), { agare: AGARE, kalenderId: "privat", person: PERSON, groupId: G }));
    await assertFails(setDoc(doc(som(AGARE), nyckel("privat", { person: PERSON })), { agare: AGARE, kalenderId: "privat", person: PERSON, skrivbar: true }));
    // Avgränsaren i ett uid hade gjort nyckeln tvetydig: formen släpper inte in den.
    await assertFails(setDoc(doc(som(AGARE), `${SAMLING}/${AGARE}|privat|person~a|b`), { agare: AGARE, kalenderId: "privat", person: "a|b" }));
  });
});

describe("läsningen: den som fått delningen ser hela posten, ingen annan ser något", () => {
  it("personen läser kalendern och frågar efter dess poster, med rubrik, plats och text", async () => {
    await assertSucceeds(getDoc(doc(som(PERSON), `users/${AGARE}/minaKalendrar/barnveckor`)));
    const svar = await assertSucceeds(poster(PERSON, "barnveckor"));
    assert.deepEqual(svar.docs.map((d) => d.id), ["vecka-45"]);
    assert.equal(svar.docs[0].data().titel, "Barnen hos mig");
    assert.equal(svar.docs[0].data().plats, "Hemma");
    await assertSucceeds(getDoc(doc(som(PERSON), `users/${AGARE}/kalenderposter/vecka-45`)));
  });
  it("en aktiv medlem i gruppen läser kalendern och posterna", async () => {
    await assertSucceeds(getDoc(doc(som(MEDLEM), `users/${AGARE}/minaKalendrar/barnveckor`)));
    assert.deepEqual((await assertSucceeds(poster(MEDLEM, "barnveckor"))).docs.map((d) => d.id), ["vecka-45"]);
    // Resor delas med gruppen sedan bytet ovan.
    assert.deepEqual((await assertSucceeds(poster(MEDLEM, "resor"))).docs.map((d) => d.id), ["resa"]);
  });
  it("⛔ en fråga utan kalenderId, eller med en kalender som inte delats, nekas", async () => {
    await assertFails(getDocs(collection(som(PERSON), `users/${AGARE}/kalenderposter`)));
    await assertFails(poster(PERSON, "privat"));
    await assertFails(poster(PERSON, "resor"));
    await assertFails(getDocs(collection(som(PERSON), `users/${AGARE}/minaKalendrar`)));
  });
  it("⛔ en post eller kalender som inte delats läses inte, inte ens med rätt id", async () => {
    await assertFails(getDoc(doc(som(PERSON), `users/${AGARE}/kalenderposter/lakare`)));
    await assertFails(getDoc(doc(som(PERSON), `users/${AGARE}/minaKalendrar/privat`)));
    await assertFails(getDoc(doc(som(MEDLEM), `users/${AGARE}/kalenderposter/lakare`)));
  });
  it("⛔ en medlem i en annan grupp, en avslutad medlem och en utloggad läser ingenting", async () => {
    for (const uid of [UTANFOR, AVSLUTAD]) {
      await assertFails(getDoc(doc(som(uid), `users/${AGARE}/minaKalendrar/barnveckor`)));
      await assertFails(poster(uid, "barnveckor"));
      await assertFails(getDoc(doc(som(uid), `users/${AGARE}/kalenderposter/vecka-45`)));
    }
    const utloggad = miljo.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(utloggad, `users/${AGARE}/kalenderposter/vecka-45`)));
    await assertFails(getDocs(query(collection(utloggad, `users/${AGARE}/kalenderposter`), where("kalenderId", "==", "barnveckor"))));
  });
});

describe("⛔ bara läsning: den som fått delningen skriver ingenting", () => {
  for (const uid of [PERSON, MEDLEM]) {
    it(`${uid} ändrar, skapar och tar inte bort poster, och ändrar inte kalendern`, async () => {
      await assertFails(updateDoc(doc(som(uid), `users/${AGARE}/kalenderposter/vecka-45`), { titel: "Ändrad" }));
      await assertFails(setDoc(doc(som(uid), `users/${AGARE}/kalenderposter/ny-${uid}`), post({ id: `ny-${uid}`, kalenderId: "barnveckor" })));
      await assertFails(deleteDoc(doc(som(uid), `users/${AGARE}/kalenderposter/vecka-45`)));
      await assertFails(updateDoc(doc(som(uid), `users/${AGARE}/minaKalendrar/barnveckor`), { namn: "Min nu" }));
      await assertFails(setDoc(doc(som(uid), `users/${AGARE}/minaKalendrar/barnveckor`), kal({ id: "barnveckor", namn: "Min nu" })));
    });
  }
  it("⛔ mottagaren tar inte bort delningen och ändrar den inte", async () => {
    await assertFails(deleteDoc(doc(som(PERSON), nyckel("barnveckor", { person: PERSON }))));
    await assertFails(deleteDoc(doc(som(MEDLEM), nyckel("barnveckor", { grupp: G }))));
    await assertFails(setDoc(doc(som(MEDLEM), nyckel("barnveckor", { grupp: G })), rad({ agare: AGARE, kalenderId: "barnveckor", groupId: K })));
  });
});

describe("delningarna: var och en ser sina, ingen ser andras", () => {
  it("ägaren, personen och gruppens medlem frågar efter sina", async () => {
    const egna = await assertSucceeds(getDocs(query(collection(som(AGARE), SAMLING), where("agare", "==", AGARE))));
    assert.ok(egna.size >= 3);
    const mina = await assertSucceeds(getDocs(query(collection(som(PERSON), SAMLING), where("person", "==", PERSON))));
    assert.deepEqual(mina.docs.map((d) => d.id), [kalenderdelningId(AGARE, "barnveckor", { person: PERSON })]);
    const gruppens = await assertSucceeds(getDocs(query(collection(som(MEDLEM), SAMLING), where("groupId", "==", G))));
    assert.deepEqual(gruppens.docs.map((d) => d.id).sort(), [kalenderdelningId(AGARE, "barnveckor", { grupp: G }), kalenderdelningId(AGARE, "resor", { grupp: G })].sort());
  });
  it("⛔ en annan grupp, en annan person och en fråga utan villkor nekas", async () => {
    await assertFails(getDocs(query(collection(som(UTANFOR), SAMLING), where("groupId", "==", G))));
    await assertFails(getDocs(query(collection(som(UTANFOR), SAMLING), where("person", "==", PERSON))));
    await assertFails(getDocs(query(collection(som(MEDLEM), SAMLING), where("agare", "==", AGARE))));
    await assertFails(getDocs(collection(som(PERSON), SAMLING)));
    await assertFails(getDoc(doc(som(UTANFOR), nyckel("barnveckor", { person: PERSON }))));
  });
  it("ägaren frågar efter och tar bort en egen rad som inte finns (två flikar), en annan gör det inte", async () => {
    const borta = nyckel("privat", { person: MEDLEM });
    await assertSucceeds(getDoc(doc(som(AGARE), borta)));
    await assertSucceeds(deleteDoc(doc(som(AGARE), borta)));
    await assertFails(getDoc(doc(som(MEDLEM), borta)));
    await assertFails(deleteDoc(doc(som(MEDLEM), borta)));
  });
});

describe("⛔ delningen stängs av sig själv (granskningen av PR 468): arkiverad kalender, ägaren lämnar gruppen, en agent", () => {
  const lamnarPoster = (/** @type {string} */ uid) => getDocs(query(collection(som(uid), `users/${LAMNAR}/kalenderposter`), where("kalenderId", "==", "semester")));
  const lamnarNyckel = (/** @type {{ person: string } | { grupp: string }} */ m) => `${SAMLING}/${kalenderdelningId(LAMNAR, "semester", m)}`;

  it("en arkiverad kalender: posterna läses inte längre, kalenderns dokument går att läsa och säger att den är arkiverad", async () => {
    await assertSucceeds(setDoc(doc(som(AGARE), nyckel("arkivkal", { person: PERSON })), rad({ agare: AGARE, kalenderId: "arkivkal", person: PERSON })));
    await assertSucceeds(setDoc(doc(som(AGARE), nyckel("arkivkal", { grupp: G })), rad({ agare: AGARE, kalenderId: "arkivkal", groupId: G })));
    await assertSucceeds(poster(PERSON, "arkivkal"));
    await assertSucceeds(poster(MEDLEM, "arkivkal"));
    await assertSucceeds(updateDoc(doc(som(AGARE), `users/${AGARE}/minaKalendrar/arkivkal`), { arkiverad: true }));
    for (const uid of [PERSON, MEDLEM]) {
      await assertFails(poster(uid, "arkivkal"));
      await assertFails(getDoc(doc(som(uid), `users/${AGARE}/kalenderposter/arkiv-post`)));
      const kalendern = await assertSucceeds(getDoc(doc(som(uid), `users/${AGARE}/minaKalendrar/arkivkal`)));
      assert.equal(kalendern.data()?.arkiverad, true);
    }
    // Ägaren läser som förut, och tar fram den: då delas den igen.
    await assertSucceeds(poster(AGARE, "arkivkal"));
    await assertSucceeds(updateDoc(doc(som(AGARE), `users/${AGARE}/minaKalendrar/arkivkal`), { arkiverad: false }));
    await assertSucceeds(poster(PERSON, "arkivkal"));
    for (const m of [{ person: PERSON }, { grupp: G }]) await assertSucceeds(deleteDoc(doc(som(AGARE), nyckel("arkivkal", m))));
  });

  it("ägaren lämnar gruppen: gruppens delning läses inte längre, en delning med en person står kvar", async () => {
    await assertSucceeds(setDoc(doc(som(LAMNAR), lamnarNyckel({ grupp: G })), rad({ agare: LAMNAR, kalenderId: "semester", groupId: G })));
    await assertSucceeds(setDoc(doc(som(LAMNAR), lamnarNyckel({ person: PERSON })), rad({ agare: LAMNAR, kalenderId: "semester", person: PERSON })));
    await assertSucceeds(lamnarPoster(MEDLEM));
    await assertSucceeds(getDoc(doc(som(MEDLEM), `users/${LAMNAR}/minaKalendrar/semester`)));
    await miljo.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), `memberships/${medlemskapsId(LAMNAR, G)}`), { status: "avslutad" }));
    await assertFails(lamnarPoster(MEDLEM));
    await assertFails(getDoc(doc(som(MEDLEM), `users/${LAMNAR}/minaKalendrar/semester`)));
    await assertFails(getDoc(doc(som(MEDLEM), `users/${LAMNAR}/kalenderposter/sommar`)));
    await assertSucceeds(lamnarPoster(PERSON));
    // Den som lämnat slutar dela, och raderna går att ta bort också efteråt (nyckeln är hennes).
    for (const m of [{ person: PERSON }, { grupp: G }]) await assertSucceeds(deleteDoc(doc(som(LAMNAR), lamnarNyckel(m))));
  });

  it("ett medlemskap med typen agent läser varken delade kalendrar eller gruppens delningar", async () => {
    await assertSucceeds(poster(MEDLEM, "resor"));
    await assertFails(poster(AGENT, "resor"));
    await assertFails(getDoc(doc(som(AGENT), `users/${AGARE}/minaKalendrar/resor`)));
    await assertFails(getDocs(query(collection(som(AGENT), SAMLING), where("groupId", "==", G))));
  });
});

describe("genom ramverkets källa: dela, läsa, sluta dela", () => {
  it("ägaren delar, mottagaren hittar kalendern och läser posterna, ägaren slutar dela och läsningen stängs", async () => {
    const delning = await kalla(AGARE).dela(AGARE, "kallan", { person: PERSON });
    assert.equal(delning.id, kalenderdelningId(AGARE, "kallan", { person: PERSON }));
    const tillMig = await kalla(PERSON).deladeMedMig(PERSON);
    const rader = deladeKalendrar(tillMig, { uid: PERSON });
    assert.ok(rader.some((r) => r.kalenderId === "kallan" && r.via.includes("person")));
    // Gruppens medlem frågar med den aktiva gruppen och får gruppens delningar; en grupp man inte är med i nekas (frågan går inte att bevisa).
    const gruppens = deladeKalendrar(await kalla(MEDLEM).deladeMedMig(MEDLEM, { groupId: G }), { uid: MEDLEM, groupId: G });
    assert.deepEqual(gruppens.map((r) => r.kalenderId).sort(), ["barnveckor", "resor"]);
    await assertFails(kalla(PERSON).deladeMedMig(PERSON, { groupId: G }));
    const kalendern = await kalla(PERSON).deladKalender(AGARE, "kallan");
    assert.equal(kalendern?.namn, "kallan");
    assert.deepEqual((await kalla(PERSON).deladePoster(AGARE, "kallan")).map((p) => p.titel), ["Genom källan"]);
    assert.ok((await kalla(AGARE).delningar(AGARE)).some((d) => d.id === delning.id));

    await assert.rejects(kalla(PERSON).slutaDela(PERSON, delning.id), /någon annans/);
    assert.deepEqual(await kalla(AGARE).slutaDela(AGARE, delning.id), { borttagen: true });
    assert.deepEqual(await kalla(AGARE).slutaDela(AGARE, delning.id), { borttagen: false });
    await assertFails(kalla(PERSON).deladePoster(AGARE, "kallan"));
    await assertFails(kalla(PERSON).deladKalender(AGARE, "kallan"));
    assert.equal((await kalla(PERSON).deladeMedMig(PERSON)).some((d) => d.kalenderId === "kallan"), false);
  });
  it("⛔ att sluta dela med gruppen stänger gruppens läsning i samma stund, och personens delning står kvar", async () => {
    await assertSucceeds(poster(MEDLEM, "barnveckor"));
    await assertSucceeds(deleteDoc(doc(som(AGARE), nyckel("barnveckor", { grupp: G }))));
    await assertFails(poster(MEDLEM, "barnveckor"));
    await assertFails(getDoc(doc(som(MEDLEM), `users/${AGARE}/minaKalendrar/barnveckor`)));
    await assertSucceeds(poster(PERSON, "barnveckor"));
    await assertSucceeds(deleteDoc(doc(som(AGARE), nyckel("barnveckor", { person: PERSON }))));
    await assertFails(poster(PERSON, "barnveckor"));
    await assertFails(getDoc(doc(som(PERSON), `users/${AGARE}/kalenderposter/vecka-45`)));
  });
});
