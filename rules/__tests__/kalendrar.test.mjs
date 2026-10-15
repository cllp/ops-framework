/**
 * Regelprov för kalendrarnas regelfragment (0.36.0, #179 F0), mot Firestore-emulatorn.
 *
 * ══ ⛔ VAD SOM MÄTS ═══════════════════════════════════════════════════════════
 *
 * Klarkriteriet i #179 F0: "varje regelblock har prov för tillåten och otillåten form, och otillåten läsning av annans
 * poster är röd". Matrisen, per block:
 *
 *   GRUPPKALENDRAR (katalogens block med kalenderns fält)
 *     medlem läser sin grupps kalender                      ja
 *     medlem i en annan grupp läser                         nej
 *     admin skapar en kalender i sin grupp                  ja
 *     medlem skapar                                         nej
 *     ett fält utanför KALENDERFALT (t.ex. fas)             nej
 *     nyckel som inte börjar på radens grupp                nej
 *     radering                                              nej
 *
 *   GRUPPKALENDERNS githubEtikett (0.108.0, cllp/lifehub.app#259), valfri: saknas, eller en sträng på 1 till 50 tecken
 *     admin skapar en kalender med en giltig etikett        ja       <- röd mot 0.107.1: fältet fanns inte i hasOnly
 *     samma, byggd av ramverkets egen byggare               ja
 *     utan etikett (som förut)                              ja
 *     50 tecken                                             ja
 *     51 tecken                                             nej      <- röd utan längdvillkoret
 *     tom sträng                                            nej      <- röd utan längdvillkoret
 *     inte en sträng (tal, null, lista, bool)               nej      <- röd utan `is string`
 *     lägga till, byta och ta bort etiketten på en rad      ja
 *     ändra till en för lång etikett på en befintlig rad    nej
 *     medlem sätter en etikett                              nej
 *
 *   MINA KALENDRAR (under användaren)
 *     ägaren skapar och läser                               ja
 *     en annan inloggad läser                               nej      <- hela poängen
 *     en annan inloggad skriver i ägarens samling           nej
 *     färg utanför de sex, tomt namn, okänt fält, ett id-fält   nej   (0.37.0: nyckeln står i sökvägen)
 *     radering                                              nej      <- arkiveras
 *
 *   POSTER I MINA KALENDRAR
 *     ägaren skapar en heldagspost och en med klockslag     ja
 *     en annan inloggad läser ägarens post                  nej      <- hela poängen
 *     en annan inloggad listar ägarens poster               nej
 *     en annan inloggad skriver i ägarens poster            nej
 *     en post i en kalender som inte finns                  nej
 *     en post i en ARKIVERAD kalender                       nej
 *     en post i en annans kalender (samma id finns där)     nej
 *     slut före start                                       nej
 *     heldag med klockslag, eller klockslag utan heldag     nej
 *     tom titel, okänt fält                                 nej
 *     ägaren raderar sin post                               ja
 *     en annan raderar ägarens post                         nej
 *
 * Kör: npm run test:rules
 */

import { medlemskapsId } from "../../src/lib/grupp.js";
import { byggGruppkalender, byggKalenderpost, byggMinKalender, gruppkalendernyckel } from "../../src/lib/kalendrar.js";
import { after, before, describe, it } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const AGARE = "uid-kal-agare";
const ADMIN = "uid-kal-admin";
const MEDLEM = "uid-kal-medlem";
const ANNAN = "uid-kal-annan";
const G = "kal-ab";
const H = "kal-hb";

// ⛔ Raderna byggs med ramverkets egna byggare, så att provet mäter det en app faktiskt skriver och inte en handskriven form.
const gruppkal = (extra = {}) => byggGruppkalender({ id: "styrelse", namn: { sv: "Styrelsen" }, farg: 4, ikon: "kalender", ordning: 0, groupId: G, forvald: true, ...extra });
// ⛔ 0.37.0: `id` lagras inte på raden. Nyckeln står i sökvägen, och adaptern (`create` i src/data/firestore.js) tar `id` ur
// datan. Raderna här har alltså den form adaptern skriver, se `kalenderregelfragment`.
const utanId = (/** @type {Record<string, any>} */ { id: _id, ...r }) => r;
const minKal = (extra = {}) => utanId(byggMinKalender({ id: "privat", namn: "Privat", farg: 2, ikon: "hjarta", ...extra }));
const post = (extra = {}) => utanId(byggKalenderpost({ id: "tandlakare", kalenderId: "privat", titel: "Tandläkaren", start: "2026-10-05T09:00", slut: "2026-10-05T10:00", ...extra }));

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
    await setDoc(doc(db, `memberships/${medlemskapsId(ADMIN, G)}`), { userId: ADMIN, groupId: G, roll: "admin", typ: "person", status: "aktiv" });
    await setDoc(doc(db, `memberships/${medlemskapsId(MEDLEM, G)}`), { userId: MEDLEM, groupId: G, roll: "medlem", typ: "person", status: "aktiv" });
    await setDoc(doc(db, `memberships/${medlemskapsId(ANNAN, H)}`), { userId: ANNAN, groupId: H, roll: "agare", typ: "person", status: "aktiv" });
    await setDoc(doc(db, `gruppkalendrar/${gruppkalendernyckel(G, "styrelse")}`), gruppkal());
    await setDoc(doc(db, `users/${AGARE}/minaKalendrar/privat`), minKal());
    await setDoc(doc(db, `users/${AGARE}/minaKalendrar/gammal`), minKal({ id: "gammal", namn: "Gammal", arkiverad: true }));
    await setDoc(doc(db, `users/${ANNAN}/minaKalendrar/annans`), minKal({ id: "annans", namn: "Den andras" }));
    await setDoc(doc(db, `users/${AGARE}/kalenderposter/befintlig`), post({ id: "befintlig" }));
  });
});

after(async () => {
  if (miljo) await miljo.cleanup();
});

/** @param {string} uid */
const som = (uid) => miljo.authenticatedContext(uid).firestore();

describe("gruppens kalendrar: katalogens regel med kalenderns fält", () => {
  it("en medlem läser sin grupps kalender", async () => {
    await assertSucceeds(getDoc(doc(som(MEDLEM), `gruppkalendrar/${gruppkalendernyckel(G, "styrelse")}`)));
  });
  it("⛔ en medlem i en annan grupp läser inte", async () => {
    await assertFails(getDoc(doc(som(ANNAN), `gruppkalendrar/${gruppkalendernyckel(G, "styrelse")}`)));
  });
  it("admin skapar en kalender i sin grupp", async () => {
    await assertSucceeds(setDoc(doc(som(ADMIN), `gruppkalendrar/${gruppkalendernyckel(G, "resor")}`), gruppkal({ id: "resor", namn: { sv: "Resor" }, forvald: false })));
  });
  it("⛔ en medlem skapar ingen kalender, den är gruppens konfiguration", async () => {
    await assertFails(setDoc(doc(som(MEDLEM), `gruppkalendrar/${gruppkalendernyckel(G, "medlemmens")}`), gruppkal({ id: "medlemmens", forvald: false })));
  });
  it("⛔ ett fält utanför KALENDERFALT avvisas (fas finns inte på en kalender)", async () => {
    await assertFails(setDoc(doc(som(ADMIN), `gruppkalendrar/${gruppkalendernyckel(G, "med-fas")}`), { ...gruppkal({ id: "med-fas", forvald: false }), fas: "aktiv" }));
  });
  it("⛔ nyckeln måste börja på radens grupp", async () => {
    await assertFails(setDoc(doc(som(ADMIN), `gruppkalendrar/${gruppkalendernyckel(H, "kapad")}`), gruppkal({ id: "kapad", forvald: false })));
  });
  it("⛔ en kalender raderas inte, den arkiveras", async () => {
    await assertFails(deleteDoc(doc(som(AGARE), `gruppkalendrar/${gruppkalendernyckel(G, "styrelse")}`)));
    await assertSucceeds(updateDoc(doc(som(AGARE), `gruppkalendrar/${gruppkalendernyckel(G, "styrelse")}`), { arkiverad: true, forvald: false }));
  });
});

describe("⛔ gruppkalenderns githubEtikett (0.108.0): valfri, en sträng på 1 till 50 tecken", () => {
  const nyckel = (/** @type {string} */ id) => `gruppkalendrar/${gruppkalendernyckel(G, id)}`;
  // ⛔ Raden byggs UTAN etiketten och får den spridd efteråt: provet mäter REGELN, så den får inte bero på att byggaren släpper in eller stoppar värdet.
  const rad = (/** @type {string} */ id, /** @type {Record<string, any>} */ extra = {}) => ({ ...gruppkal({ id, namn: { sv: id }, forvald: false }), ...extra });

  it("admin skapar en kalender med en giltig etikett", async () => {
    await assertSucceeds(setDoc(doc(som(ADMIN), nyckel("et-giltig")), rad("et-giltig", { githubEtikett: "styrelsen" })));
    assert.equal((await getDoc(doc(som(MEDLEM), nyckel("et-giltig")))).data()?.githubEtikett, "styrelsen");
  });
  it("en rad byggd av ramverkets egen byggare med etikett släpps in (det en app faktiskt skriver)", async () => {
    await assertSucceeds(setDoc(doc(som(ADMIN), nyckel("et-byggd")), gruppkal({ id: "et-byggd", forvald: false, githubEtikett: "  Resor " })));
    assert.equal((await getDoc(doc(som(MEDLEM), nyckel("et-byggd")))).data()?.githubEtikett, "Resor");
  });
  it("en kalender utan etikett skapas som förut", async () => {
    await assertSucceeds(setDoc(doc(som(ADMIN), nyckel("et-utan")), rad("et-utan")));
  });
  it("⛔ gränserna: 50 tecken släpps in, 51 nekas, och en tom sträng nekas", async () => {
    await assertSucceeds(setDoc(doc(som(ADMIN), nyckel("et-femtio")), rad("et-femtio", { githubEtikett: "a".repeat(50) })));
    await assertFails(setDoc(doc(som(ADMIN), nyckel("et-femtioett")), rad("et-femtioett", { githubEtikett: "a".repeat(51) })));
    await assertFails(setDoc(doc(som(ADMIN), nyckel("et-tom")), rad("et-tom", { githubEtikett: "" })));
  });
  it("⛔ en etikett som inte är en sträng nekas: tal, null, lista och bool", async () => {
    for (const [namn, varde] of [["tal", 5], ["null", null], ["lista", ["a"]], ["bool", true]]) {
      await assertFails(setDoc(doc(som(ADMIN), nyckel(`et-${namn}`)), rad(`et-${namn}`, { githubEtikett: varde })));
    }
  });
  it("⛔ en medlem sätter ingen etikett, den är gruppens konfiguration", async () => {
    await assertFails(setDoc(doc(som(MEDLEM), nyckel("et-medlem")), rad("et-medlem", { githubEtikett: "medlemmens" })));
    await assertFails(updateDoc(doc(som(MEDLEM), nyckel("et-giltig")), { githubEtikett: "kapad" }));
  });
  it("admin lägger till, byter och tar bort etiketten på en befintlig rad", async () => {
    const ref = doc(som(ADMIN), nyckel("et-utan"));
    await assertSucceeds(updateDoc(ref, { githubEtikett: "forsta" }));
    await assertSucceeds(updateDoc(ref, { githubEtikett: "andra" }));
    assert.equal((await getDoc(ref)).data()?.githubEtikett, "andra");
    await assertSucceeds(updateDoc(ref, { githubEtikett: deleteField() }));
    assert.equal("githubEtikett" in (await getDoc(ref)).data(), false);
  });
  it("⛔ en ändring till en för lång eller tom etikett på en befintlig rad nekas", async () => {
    const ref = doc(som(ADMIN), nyckel("et-giltig"));
    await assertFails(updateDoc(ref, { githubEtikett: "a".repeat(51) }));
    await assertFails(updateDoc(ref, { githubEtikett: "" }));
    await assertFails(updateDoc(ref, { githubEtikett: 7 }));
    assert.equal((await getDoc(ref)).data()?.githubEtikett, "styrelsen");
  });
  it("å är en enhet, inte två byte: 50 släpps in, 51 nekas", async () => {
    await assertSucceeds(setDoc(doc(som(ADMIN), nyckel("et-a-ring")), rad("et-a-ring", { githubEtikett: "å".repeat(50) })));
    await assertFails(setDoc(doc(som(ADMIN), nyckel("et-a-ring-ett")), rad("et-a-ring-ett", { githubEtikett: "å".repeat(51) })));
  });
  it("⛔ en emoji är två UTF-16-enheter och regelns size() räknar enheter: 25 släpps in, 26 nekas (klienten räknar likadant, `.length`)", async () => {
    await assertSucceeds(setDoc(doc(som(ADMIN), nyckel("et-emoji")), rad("et-emoji", { githubEtikett: "\u{1F4C5}".repeat(25) })));
    await assertFails(setDoc(doc(som(ADMIN), nyckel("et-emoji-ett")), rad("et-emoji-ett", { githubEtikett: "\u{1F4C5}".repeat(26) })));
  });
});

describe("⛔ mina kalendrar: bara ägaren", () => {
  it("ägaren skapar och läser sin kalender", async () => {
    await assertSucceeds(setDoc(doc(som(AGARE), `users/${AGARE}/minaKalendrar/resor`), minKal({ id: "resor", namn: "Resor" })));
    await assertSucceeds(getDoc(doc(som(AGARE), `users/${AGARE}/minaKalendrar/resor`)));
  });
  it("⛔ en annan inloggad läser inte ägarens kalender", async () => {
    await assertFails(getDoc(doc(som(ANNAN), `users/${AGARE}/minaKalendrar/privat`)));
  });
  it("⛔ en gruppmedlem, till och med ägarens egen admin, listar inte ägarens kalendrar", async () => {
    await assertFails(getDocs(collection(som(ADMIN), `users/${AGARE}/minaKalendrar`)));
  });
  it("⛔ en annan skriver inte i ägarens samling", async () => {
    await assertFails(setDoc(doc(som(ANNAN), `users/${AGARE}/minaKalendrar/planterad`), minKal({ id: "planterad" })));
  });
  it("⛔ färg utanför de sex, tomt namn, okänt fält och ett id-fält på raden avvisas", async () => {
    await assertFails(setDoc(doc(som(AGARE), `users/${AGARE}/minaKalendrar/f`), { ...minKal({ id: "f" }), farg: 7 }));
    await assertFails(setDoc(doc(som(AGARE), `users/${AGARE}/minaKalendrar/t`), { ...minKal({ id: "t" }), namn: "" }));
    await assertFails(setDoc(doc(som(AGARE), `users/${AGARE}/minaKalendrar/o`), { ...minKal({ id: "o" }), groupId: G }));
    // ⛔ 0.37.0: ett `id` på raden är nyckeln en gång till, och en kopia som kan säga något annat än nyckeln (här "y" i "x").
    await assertFails(setDoc(doc(som(AGARE), `users/${AGARE}/minaKalendrar/x`), { ...minKal({ id: "x" }), id: "y" }));
    await assertFails(setDoc(doc(som(AGARE), `users/${AGARE}/minaKalendrar/x`), { ...minKal({ id: "x" }), id: "x" }));
  });
  it("⛔ ägaren raderar inte en kalender, den arkiveras", async () => {
    await assertFails(deleteDoc(doc(som(AGARE), `users/${AGARE}/minaKalendrar/privat`)));
    await assertSucceeds(updateDoc(doc(som(AGARE), `users/${AGARE}/minaKalendrar/resor`), { arkiverad: true }));
  });
});

describe("⛔ posterna i mina kalendrar: bara ägaren, och bara i en av ägarens egna kalendrar", () => {
  it("ägaren skapar en post med klockslag och en heldagspost över tre dagar", async () => {
    await assertSucceeds(setDoc(doc(som(AGARE), `users/${AGARE}/kalenderposter/tandlakare`), post()));
    await assertSucceeds(setDoc(doc(som(AGARE), `users/${AGARE}/kalenderposter/semester`), post({ id: "semester", titel: "Semester", heldag: true, start: "2026-10-12", slut: "2026-10-14", blockerar: true })));
  });
  it("⛔ en annan inloggad läser inte ägarens post", async () => {
    await assertFails(getDoc(doc(som(ANNAN), `users/${AGARE}/kalenderposter/befintlig`)));
  });
  it("⛔ en annan inloggad listar inte ägarens poster", async () => {
    await assertFails(getDocs(collection(som(ANNAN), `users/${AGARE}/kalenderposter`)));
  });
  it("ägaren läser och listar sina poster", async () => {
    await assertSucceeds(getDoc(doc(som(AGARE), `users/${AGARE}/kalenderposter/befintlig`)));
    await assertSucceeds(getDocs(collection(som(AGARE), `users/${AGARE}/kalenderposter`)));
  });
  it("⛔ en annan inloggad skriver ingen post i ägarens samling, också när kalendern finns där", async () => {
    // Mutationen "posterna skrivs av alla inloggade" var grön innan det här provet fanns: kalenderns uppslag görs under
    // ägarens sökväg, alltså finns kalendern, och bara uid-kravet stoppar en planterad post.
    await assertFails(setDoc(doc(som(ANNAN), `users/${AGARE}/kalenderposter/planterad`), post({ id: "planterad" })));
    await assertFails(updateDoc(doc(som(ANNAN), `users/${AGARE}/kalenderposter/tandlakare`), { titel: "Ändrad av någon annan" }));
  });
  it("⛔ en post i en kalender som inte finns avvisas", async () => {
    await assertFails(setDoc(doc(som(AGARE), `users/${AGARE}/kalenderposter/p1`), { ...post({ id: "p1" }), kalenderId: "saknas" }));
  });
  it("⛔ en post i en ARKIVERAD kalender avvisas", async () => {
    await assertFails(setDoc(doc(som(AGARE), `users/${AGARE}/kalenderposter/p2`), { ...post({ id: "p2" }), kalenderId: "gammal" }));
  });
  it("⛔ en post i en annans kalender avvisas, också när id:t finns där", async () => {
    await assertFails(setDoc(doc(som(AGARE), `users/${AGARE}/kalenderposter/p3`), { ...post({ id: "p3" }), kalenderId: "annans" }));
  });
  it("⛔ slut före start avvisas", async () => {
    await assertFails(setDoc(doc(som(AGARE), `users/${AGARE}/kalenderposter/p4`), { ...post({ id: "p4" }), slut: "2026-10-05T08:00" }));
  });
  it("⛔ heldag med klockslag, och klockslag utan heldag som bara är datum, avvisas", async () => {
    await assertFails(setDoc(doc(som(AGARE), `users/${AGARE}/kalenderposter/p5`), { ...post({ id: "p5" }), heldag: true }));
    await assertFails(setDoc(doc(som(AGARE), `users/${AGARE}/kalenderposter/p6`), { ...post({ id: "p6" }), start: "2026-10-05", slut: "2026-10-05" }));
  });
  it("⛔ tom titel och okänt fält avvisas", async () => {
    await assertFails(setDoc(doc(som(AGARE), `users/${AGARE}/kalenderposter/p7`), { ...post({ id: "p7" }), titel: "" }));
    await assertFails(setDoc(doc(som(AGARE), `users/${AGARE}/kalenderposter/p8`), { ...post({ id: "p8" }), groupId: G }));
  });
  it("⛔ en annan raderar inte ägarens post, ägaren gör det", async () => {
    await assertFails(deleteDoc(doc(som(ANNAN), `users/${AGARE}/kalenderposter/befintlig`)));
    await assertSucceeds(deleteDoc(doc(som(AGARE), `users/${AGARE}/kalenderposter/befintlig`)));
  });
});
