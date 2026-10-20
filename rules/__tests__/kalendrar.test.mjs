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
 *   GRUPPKALENDERNS githubEtikett, AVVECKLAD (0.129.0, cllp/lifehub.app#303 och #307): en ny rad får den inte, en gammal får behålla den
 *     admin skapar en kalender utan etikett                 ja
 *     admin skapar en kalender MED etikett                  nej     <- röd mot 0.128.0: fältet var tillåtet
 *     admin lägger till en etikett på en rad som saknar den nej     <- röd mot 0.128.0
 *     en GAMMAL rad uppdateras i ett annat fält (fältet följer med)   ja   <- röd mot en regel som bara strök fältet ur hasOnly
 *     en gammal rad skrivs om med samma etikett (en äldre klient)     ja   <- röd mot samma regel
 *     en gammal rad skrivs om UTAN etikett, eller etiketten tas bort  ja   (fältet försvinner)
 *     en gammal rad byter etikett, till vad som helst       nej     <- röd mot 0.128.0
 *     en medlem uppdaterar en gammal rad                    nej     (rollen gäller som förut)
 *     läsning, sparning och omläsning genom ramverkets källa   ja   (en gammal rad går att öppna och ändra)
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
import { createFirestoreSource } from "../../src/data/firestore.js";
import { createKalenderkalla } from "../../src/data/kalenderkalla.js";
import { after, before, describe, it } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import * as sdk from "firebase/firestore";
import assert from "node:assert/strict";
const { collection, deleteDoc, deleteField, doc, getDoc, getDocs, setDoc, updateDoc } = sdk;
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
/** En grupp vars kalendrar bär `githubEtikett` sedan före 0.129.0, för provet genom ramverkets källa. */
const L = "kal-lg";

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
    // ⛔ GAMLA RADER: sparade under 0.108.0 till 0.128.0, med `githubEtikett`. Skrivs rakt i emulatorn (reglerna av), förbi byggaren som vägrar fältet nu.
    for (const id of ["leg-andra-falt", "leg-samma", "leg-utan", "leg-byt", "leg-ta-bort", "leg-medlem"]) {
      await setDoc(doc(db, `gruppkalendrar/${gruppkalendernyckel(G, id)}`), { ...utanId(gruppkal({ id, namn: { sv: id }, forvald: false })), githubEtikett: "styrelsen" });
    }
    await setDoc(doc(db, `memberships/${medlemskapsId(ADMIN, L)}`), { userId: ADMIN, groupId: L, roll: "admin", typ: "person", status: "aktiv" });
    await setDoc(doc(db, `memberships/${medlemskapsId(MEDLEM, L)}`), { userId: MEDLEM, groupId: L, roll: "medlem", typ: "person", status: "aktiv" });
    await setDoc(doc(db, `gruppkalendrar/${gruppkalendernyckel(L, "styrelse")}`), { ...utanId(gruppkal({ id: "styrelse", groupId: L, forvald: true })), githubEtikett: "styrelsen" });
    await setDoc(doc(db, `gruppkalendrar/${gruppkalendernyckel(L, "resor")}`), { ...utanId(gruppkal({ id: "resor", groupId: L, namn: { sv: "Resor" }, ordning: 10, forvald: false })), githubEtikett: "pengar" });
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

describe("⛔ gruppkalenderns githubEtikett är avvecklad (0.129.0): en ny rad får den inte, en gammal får behålla den", () => {
  const nyckel = (/** @type {string} */ id) => `gruppkalendrar/${gruppkalendernyckel(G, id)}`;
  // ⛔ Raden byggs UTAN etiketten och får den spridd efteråt: provet mäter REGELN, och byggaren vägrar fältet nu.
  const rad = (/** @type {string} */ id, /** @type {Record<string, any>} */ extra = {}) => ({ ...gruppkal({ id, namn: { sv: id }, forvald: false }), ...extra });

  it("admin skapar en kalender utan etikett, som förut", async () => {
    await assertSucceeds(setDoc(doc(som(ADMIN), nyckel("et-utan")), rad("et-utan")));
  });
  it("⛔ admin skapar INTE en kalender med etikett: giltig, 50 tecken eller vad som helst", async () => {
    for (const [namn, varde] of [["giltig", "styrelsen"], ["femtio", "a".repeat(50)], ["tom", ""], ["tal", 5], ["null", null]]) {
      await assertFails(setDoc(doc(som(ADMIN), nyckel(`et-ny-${namn}`)), rad(`et-ny-${namn}`, { githubEtikett: varde })));
    }
  });
  it("⛔ en etikett läggs inte till på en rad som saknar den, vare sig med update eller med set", async () => {
    await assertFails(updateDoc(doc(som(ADMIN), nyckel("et-utan")), { githubEtikett: "forsta" }));
    await assertFails(setDoc(doc(som(ADMIN), nyckel("et-utan")), rad("et-utan", { githubEtikett: "forsta" })));
    assert.equal("githubEtikett" in (await getDoc(doc(som(MEDLEM), nyckel("et-utan")))).data(), false);
  });

  it("⛔ en GAMMAL rad uppdateras i ett annat fält: fältet följer med i det som skrivs, och det nekas inte", async () => {
    const ref = doc(som(ADMIN), nyckel("leg-andra-falt"));
    await assertSucceeds(updateDoc(ref, { ordning: 7 }));
    const efter = (await getDoc(ref)).data();
    assert.equal(efter?.ordning, 7);
    assert.equal(efter?.githubEtikett, "styrelsen");
  });
  it("⛔ en gammal rad skrivs om med SAMMA etikett (en äldre klient som skickar tillbaka raden som den läste den)", async () => {
    await assertSucceeds(setDoc(doc(som(ADMIN), nyckel("leg-samma")), rad("leg-samma", { githubEtikett: "styrelsen", ordning: 3 })));
  });
  it("en gammal rad skrivs om utan etikett, och då försvinner fältet (det en ny klient gör)", async () => {
    const ref = doc(som(ADMIN), nyckel("leg-utan"));
    await assertSucceeds(setDoc(ref, rad("leg-utan", { ordning: 4 })));
    assert.equal("githubEtikett" in (await getDoc(ref)).data(), false);
  });
  it("etiketten på en gammal rad tas bort med deleteField", async () => {
    const ref = doc(som(ADMIN), nyckel("leg-ta-bort"));
    await assertSucceeds(updateDoc(ref, { githubEtikett: deleteField() }));
    assert.equal("githubEtikett" in (await getDoc(ref)).data(), false);
  });
  it("⛔ en gammal rad byter inte etikett: till en annan giltig, en tom eller något som inte är en sträng", async () => {
    const ref = doc(som(ADMIN), nyckel("leg-byt"));
    for (const varde of ["annan", "", "a".repeat(51), 7, null]) await assertFails(updateDoc(ref, { githubEtikett: varde }));
    assert.equal((await getDoc(ref)).data()?.githubEtikett, "styrelsen");
  });
  it("⛔ rollen gäller som förut: en medlem uppdaterar inte en gammal rad, med eller utan fältet", async () => {
    const ref = doc(som(MEDLEM), nyckel("leg-medlem"));
    await assertFails(updateDoc(ref, { ordning: 9 }));
    await assertFails(setDoc(ref, rad("leg-medlem", { githubEtikett: "styrelsen" })));
    await assertFails(updateDoc(ref, { githubEtikett: deleteField() }));
  });

  it("⛔ GENOM RAMVERKETS KÄLLA: en grupp vars kalendrar bär fältet går att läsa, och att spara en ändrad rad tar bort fältet", async () => {
    const kalla = createKalenderkalla({ kalla: createFirestoreSource({ db: som(ADMIN), sdk }) });
    const lista = await assertSucceeds(kalla.gruppens(L));
    assert.deepEqual(lista.map((k) => k.id), ["styrelse", "resor"]);
    assert.ok(lista.every((k) => !("githubEtikett" in k)));
    await assertSucceeds(kalla.sparaGruppens(L, [{ ...lista[1], ordning: 5 }]));
    const dok = (await getDoc(doc(som(MEDLEM), `gruppkalendrar/${gruppkalendernyckel(L, "resor")}`))).data();
    assert.equal(dok?.ordning, 5);
    assert.equal("githubEtikett" in dok, false);
    // Den andra raden rördes inte och bär sitt fält kvar tills någon sparar den.
    assert.equal((await getDoc(doc(som(MEDLEM), `gruppkalendrar/${gruppkalendernyckel(L, "styrelse")}`))).data()?.githubEtikett, "styrelsen");
    // En medlem läser den också.
    assert.equal((await createKalenderkalla({ kalla: createFirestoreSource({ db: som(MEDLEM), sdk }) }).gruppens(L)).length, 2);
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
