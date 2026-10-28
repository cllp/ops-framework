/**
 * Regelprov för personens kalenderval (0.151.0, CP 2026-10-28): `users/{uid}/kalenderval/{gruppId}`.
 *
 * Bara personen själv läser och skriver sitt dokument. Ingen annan, inte heller en gruppadmin eller en ägare. Skrivningen kräver ett AKTIVT MEDLEMSKAP i gruppen (0.152.0, #459).
 * Formen är exakt (`v`, `syns`, `visning`, `fore`), antalet poster har ett tak, varje NYCKEL är en kalenderrads id på högst `MAX_KALENDERVALNYCKEL` tecken (0.152.0, #459),
 * värdena är sanningsvärden respektive de tre visningarna, och dokumentet raderas aldrig. Reglerna skrivs av `scripts/skriv-provregler.mjs` ur
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
import { KALENDERVALNYCKEL_FORM, MAX_KALENDERVAL, MAX_KALENDERVALNYCKEL } from "../../src/lib/kalendersynlighet.js";
import { medlemskapsId } from "../../src/lib/grupp.js";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const PERSON = "uid-kim";
const ANNAN = "uid-annan";
const GRUPP = "cps-ab";
const FRAMMANDE = "grupp-utan-medlemskap";
const AVSLUTAD_GRUPP = "grupp-avslutad";
const medlemskap = (uid, groupId, status = "aktiv") => [`memberships/${medlemskapsId(uid, groupId)}`, { userId: uid, groupId, roll: "medlem", typ: "person", status }];
const MIN = `users/${PERSON}/kalenderval/${GRUPP}`;
const poster = (n, varde = true) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, varde]));
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
    const f = ctx.firestore();
    await setDoc(doc(f, MIN), gilltigt());
    const satt = ([sokvag, data]) => setDoc(doc(f, sokvag), data);
    for (const grupp of [GRUPP, "annan-grupp", "a".repeat(80)]) await satt(medlemskap(PERSON, grupp));
    // Medlem i en annan grupp än den provet skriver för, och en som lämnat sin.
    await satt(medlemskap(ANNAN, GRUPP));
    await satt(medlemskap(PERSON, AVSLUTAD_GRUPP, "avslutad"));
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

describe("kalendervalens regler: ett aktivt medlemskap i gruppen (#459)", () => {
  it("⛔ en grupp personen inte är med i nekas: varken skapa eller ändra", async () => {
    // Golv: raden som saknas saknas på riktigt, så nekandet beror inte på något annat än medlemskapet.
    await miljo.withSecurityRulesDisabled(async (ctx) => {
      assert.equal((await getDoc(doc(ctx.firestore(), `memberships/${medlemskapsId(PERSON, FRAMMANDE)}`))).exists(), false);
    });
    await assertFails(mina(gilltigt(), FRAMMANDE));
    await assertFails(mina({ v: 1, syns: {}, visning: {} }, FRAMMANDE));
    // Och inte heller ett dokument som redan ligger där (skrivet innan regeln fanns) går att ändra.
    await miljo.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), `users/${PERSON}/kalenderval/${FRAMMANDE}`), gilltigt()));
    await assertFails(mina(gilltigt({ fore: {} }), FRAMMANDE));
  });

  it("⛔ en annan persons medlemskap räcker inte: medlemskapet prövas för den som skriver", async () => {
    await miljo.withSecurityRulesDisabled(async (ctx) => {
      assert.equal((await getDoc(doc(ctx.firestore(), `memberships/${medlemskapsId(ANNAN, "annan-grupp")}`))).exists(), false);
    });
    // ANNAN är med i GRUPP men inte i annan-grupp; PERSON är med i annan-grupp.
    await assertFails(setDoc(doc(db(ANNAN), `users/${ANNAN}/kalenderval/annan-grupp`), gilltigt()));
    await assertSucceeds(setDoc(doc(db(ANNAN), `users/${ANNAN}/kalenderval/${GRUPP}`), gilltigt()));
    // Och ANNAN skriver aldrig under PERSONS sökväg, hur medlem hen än är.
    await assertFails(setDoc(doc(db(ANNAN), `users/${PERSON}/kalenderval/${GRUPP}`), gilltigt()));
  });

  it("ett medlemskap som inte är aktivt räcker inte", async () => {
    await assertFails(mina(gilltigt(), AVSLUTAD_GRUPP));
  });

  it("med ett aktivt medlemskap går samma skrivning in (grönt åt andra hållet)", async () => {
    await assertSucceeds(mina(gilltigt(), "annan-grupp"));
    await assertSucceeds(mina(gilltigt(), GRUPP));
  });

  it("läsningen kräver inget medlemskap: en person läser sitt eget dokument och listar sin samling också efter att ha lämnat", async () => {
    await miljo.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), `users/${PERSON}/kalenderval/${AVSLUTAD_GRUPP}`), gilltigt()));
    await assertSucceeds(getDoc(doc(db(PERSON), `users/${PERSON}/kalenderval/${AVSLUTAD_GRUPP}`)));
    await assertSucceeds(getDocs(collection(db(PERSON), `users/${PERSON}/kalenderval`)));
  });

  it("en utloggad skriver inte, hur medlem uid:t än är", async () => {
    await assertFails(setDoc(doc(anonym(), MIN), gilltigt()));
  });
});

describe("kalendervalens regler: varje nyckel är en kalenderrads id (#459)", () => {
  const med = (nyckel, varde = true) => gilltigt({ syns: { [nyckel]: varde } });

  it("golv: formen och taket provet bygger på är de klientens egna konstanter", () => {
    assert.equal(MAX_KALENDERVALNYCKEL, 80);
    assert.equal(KALENDERVALNYCKEL_FORM.test("a".repeat(80)), true);
    assert.equal(KALENDERVALNYCKEL_FORM.test("a".repeat(81)), false);
  });

  it("⛔ en nyckel över taket nekas i alla tre kartorna, och exakt taket går", async () => {
    const lang = "k".repeat(MAX_KALENDERVALNYCKEL + 1);
    const exakt = "k".repeat(MAX_KALENDERVALNYCKEL);
    await assertSucceeds(mina(med(exakt)));
    await assertFails(mina(med(lang)));
    await assertSucceeds(mina(gilltigt({ visning: { [exakt]: "ram" } })));
    await assertFails(mina(gilltigt({ visning: { [lang]: "ram" } })));
    await assertSucceeds(mina(gilltigt({ fore: { [exakt]: true } })));
    await assertFails(mina(gilltigt({ fore: { [lang]: true } })));
  });

  it("⛔ kostnadshålet: 200 nycklar på 1 400 tecken (ungefär 280 kB) nekas, 200 vanliga går", async () => {
    const stora = Object.fromEntries(Array.from({ length: MAX_KALENDERVAL }, (_, i) => [`${i}`.padStart(4, "k").padEnd(1400, "k"), true]));
    assert.equal(Object.keys(stora).length, MAX_KALENDERVAL);
    await assertFails(mina(gilltigt({ syns: stora })));
    await assertFails(mina(gilltigt({ visning: Object.fromEntries(Object.keys(stora).map((k) => [k, "ram"])) })));
    await assertSucceeds(mina(gilltigt({ syns: poster(MAX_KALENDERVAL) })));
  });

  it("appens riktiga id:n går in: prefix med kolon, versaler och punkt", async () => {
    for (const nyckel of ["ical:abc123", "mina:privat", "app:arenden", "cps-ab", "ical:Abc.DEF_1-2", "ical:" + "x".repeat(75)]) {
      assert.equal(KALENDERVALNYCKEL_FORM.test(nyckel), true, nyckel);
      await assertSucceeds(mina(med(nyckel)));
    }
  });

  it("det som inte är ett id nekas: tom nyckel (formen), blanksteg, komma, snedstreck, Unicode och en nyckel som börjar på ett skiljetecken", async () => {
    // Den tomma nyckeln prövas bara mot formen: Firestores klient vägrar skriva ett tomt fältnamn innan reglerna hinner pröva det.
    assert.equal(KALENDERVALNYCKEL_FORM.test(""), false);
    for (const nyckel of [" ", "a b", "a,b", "a/b", "åäö", "a\nb", ":ical", "-x", ".x", "_x"]) {
      assert.equal(KALENDERVALNYCKEL_FORM.test(nyckel), false, JSON.stringify(nyckel));
      await assertFails(mina(med(nyckel)));
    }
  });

  it("⛔ skiljetecknet går inte att smuggla förbi: en nyckel med kommatecken är EN nyckel, inte flera korta", async () => {
    // Mätt först med bara matches(): "a,b" släpptes in, och "a,b,c,..." på 1 400 tecken med det, eftersom varje del är ett giltigt id.
    await assertFails(mina(med("a,b")));
    await assertFails(mina(med(Array.from({ length: 700 }, () => "k").join(","))));
    await assertFails(mina(gilltigt({ visning: { "a,b": "ram" } })));
    await assertFails(mina(gilltigt({ fore: { "a,b": true } })));
    await assertFails(mina(gilltigt({ syns: { a: true, "b,c": false } })));
    await assertSucceeds(mina(gilltigt({ syns: { a: true, b: false } })));
  });

  it("en tom karta går, och en karta med bara en nyckel", async () => {
    await assertSucceeds(mina({ v: 1, syns: {}, visning: {}, fore: {} }));
    await assertSucceeds(mina(med("a")));
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
