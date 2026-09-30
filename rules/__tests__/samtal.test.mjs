/**
 * Regelprov för samtalens regelfragment (0.34.0, #182, #185), mot Firestore-emulatorn.
 *
 * ══ ⛔ VAD SOM MÄTS ══════════════════════════════════════════════════════
 *
 * CP:s beslut 2026-09-30: ett meddelande till en person är PRIVAT, bara avsändaren och mottagaren ser det.
 * Beslut 4: chatt, meddelanden och Assistent-tråden är EN modell, där en klient aldrig skriver som agent.
 * Proven har de fyra rollerna ur uppdraget i båda riktningar: en främling (medlem i en ANNAN grupp), en annan
 * medlem (i gruppen men inte i samtalet), båda deltagarna, och en borttagen medlem (`status: avslutad`).
 *
 * Reglerna skrivs av `scripts/skriv-provregler.mjs` ur `samtalsregelfragment()` precis innan emulatorn startar.
 *
 * Kör: npm run test:rules
 */

import { medlemskapsId } from "../../src/lib/grupp.js";
import { samtalsnyckel } from "../../src/lib/samtal.js";
import { after, before, describe, it } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const G = "cps-ab";
const TOM = "tom-grupp";
const ANNAN_G = "miranda-ab";
const ANNA = "uid-anna";
const BO = "uid-bo";
const CECILIA = "uid-cecilia"; // en annan medlem, inte i de privata samtalen
const DAVID = "uid-david"; // borttagen medlem (avslutad)
const AGENT = "uid-agent"; // medlem av typen agent
const FRAMLING = "uid-framling"; // medlem i en ANNAN grupp
const ERIK = "uid-erik"; // ytterligare en person i gruppen
const AGENTGRUPP = "agent-grupp"; // en grupp där agenten är medlem och ingen chatt finns än

const nu = () => Date.now();
const grupp = samtalsnyckel({ groupId: G, slag: "grupp" });
const annaBo = samtalsnyckel({ groupId: G, slag: "personer", deltagare: [ANNA, BO] });
const annaDavid = samtalsnyckel({ groupId: G, slag: "personer", deltagare: [ANNA, DAVID] });
const annaAgent = samtalsnyckel({ groupId: G, slag: "agent", deltagare: [ANNA, AGENT] });
const sorterat = (/** @type {string[]} */ d) => [...d].sort();

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;

before(async () => {
  const regler = path.join(rot, "rules", "provregler.rules");
  if (!fs.existsSync(regler)) throw new Error("rules/provregler.rules saknas. Kör npm run test:rules.");
  miljo = await initializeTestEnvironment({
    projectId: "regelprov-samtal",
    firestore: { rules: fs.readFileSync(regler, "utf8"), host: "127.0.0.1", port: 8080 },
  });
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const medlem = (/** @type {string} */ uid, /** @type {string} */ gid, typ = "person", status = "aktiv") =>
      setDoc(doc(db, `memberships/${medlemskapsId(uid, gid)}`), { userId: uid, groupId: gid, roll: "medlem", typ, status });
    await medlem(ANNA, G);
    await medlem(BO, G);
    await medlem(CECILIA, G);
    await medlem(DAVID, G, "person", "avslutad");
    await medlem(AGENT, G, "agent");
    await medlem(FRAMLING, ANNAN_G);
    await medlem(ANNA, TOM);
    await medlem(ERIK, G);
    await medlem(AGENT, AGENTGRUPP, "agent");
    await setDoc(doc(db, `samtal/${grupp}`), { groupId: G, slag: "grupp", skapad: nu(), skapadAv: ANNA });
    await setDoc(doc(db, `samtal/${annaBo}`), { groupId: G, slag: "personer", deltagare: sorterat([ANNA, BO]), skapad: nu(), skapadAv: ANNA });
    await setDoc(doc(db, `samtal/${annaDavid}`), { groupId: G, slag: "personer", deltagare: sorterat([ANNA, DAVID]), skapad: nu(), skapadAv: ANNA });
    await setDoc(doc(db, `samtal/${annaAgent}`), { groupId: G, slag: "agent", deltagare: sorterat([ANNA, AGENT]), skapad: nu(), skapadAv: ANNA });
    await setDoc(doc(db, `samtal/${grupp}/meddelanden/m1`), { text: "Hej alla", av: ANNA, tid: nu() });
    await setDoc(doc(db, `samtal/${annaBo}/meddelanden/m1`), { text: "Bara till dig", av: ANNA, tid: nu() });
    await setDoc(doc(db, `samtal/${annaDavid}/meddelanden/m1`), { text: "Gammalt", av: DAVID, tid: nu() });
    await setDoc(doc(db, `samtal/${annaAgent}/meddelanden/m1`), { text: "Svar från agenten", av: AGENT, tid: nu() });
    await setDoc(doc(db, `samtal/${annaBo}/last/${ANNA}`), { lastTill: nu() });
  });
});

after(async () => {
  if (miljo) await miljo.cleanup();
});

/** @param {string} uid */
const som = (uid) => miljo.authenticatedContext(uid).firestore();
const utanInloggning = () => miljo.unauthenticatedContext().firestore();
const msg = (/** @type {string} */ av, extra = {}) => ({ text: "Hej", av, tid: nu(), ...extra });

describe("⛔ gruppchatten: aktiv medlem i gruppen läser, ingen annan", () => {
  it("en medlem läser gruppchatten och dess meddelanden", async () => {
    await assertSucceeds(getDoc(doc(som(CECILIA), `samtal/${grupp}`)));
    await assertSucceeds(getDocs(collection(som(CECILIA), `samtal/${grupp}/meddelanden`)));
  });
  it("⛔ en främling läser inte gruppchatten", async () => {
    await assertFails(getDoc(doc(som(FRAMLING), `samtal/${grupp}`)));
    await assertFails(getDocs(collection(som(FRAMLING), `samtal/${grupp}/meddelanden`)));
  });
  it("⛔ en borttagen medlem läser inte gruppchatten", async () => {
    await assertFails(getDoc(doc(som(DAVID), `samtal/${grupp}`)));
    await assertFails(getDocs(collection(som(DAVID), `samtal/${grupp}/meddelanden`)));
  });
  it("⛔ utan inloggning läser ingen", async () => {
    await assertFails(getDoc(doc(utanInloggning(), `samtal/${grupp}`)));
  });
  it("frågan inkorgen ställer för gruppchatten (groupId och slag) går igenom för en medlem, inte för en främling", async () => {
    await assertSucceeds(getDocs(query(collection(som(CECILIA), "samtal"), where("groupId", "==", G), where("slag", "==", "grupp"))));
    await assertFails(getDocs(query(collection(som(FRAMLING), "samtal"), where("groupId", "==", G), where("slag", "==", "grupp"))));
  });
});

describe("⛔ ett privat samtal: bara de två deltagarna läser (CP:s beslut 1)", () => {
  it("båda deltagarna läser samtalet och meddelandena", async () => {
    for (const u of [ANNA, BO]) {
      await assertSucceeds(getDoc(doc(som(u), `samtal/${annaBo}`)));
      await assertSucceeds(getDocs(collection(som(u), `samtal/${annaBo}/meddelanden`)));
    }
  });
  it("⛔ en annan medlem i samma grupp läser varken samtalet eller meddelandena", async () => {
    await assertFails(getDoc(doc(som(CECILIA), `samtal/${annaBo}`)));
    await assertFails(getDocs(collection(som(CECILIA), `samtal/${annaBo}/meddelanden`)));
    await assertFails(getDoc(doc(som(CECILIA), `samtal/${annaBo}/meddelanden/m1`)));
  });
  it("⛔ en främling läser inte", async () => {
    await assertFails(getDoc(doc(som(FRAMLING), `samtal/${annaBo}`)));
    await assertFails(getDocs(collection(som(FRAMLING), `samtal/${annaBo}/meddelanden`)));
  });
  it("⛔ en borttagen medlem läser inte ens sitt eget privata samtal, den andra deltagaren läser vidare", async () => {
    await assertFails(getDoc(doc(som(DAVID), `samtal/${annaDavid}`)));
    await assertFails(getDocs(collection(som(DAVID), `samtal/${annaDavid}/meddelanden`)));
    await assertSucceeds(getDocs(collection(som(ANNA), `samtal/${annaDavid}/meddelanden`)));
  });
  it("inkorgens fråga (groupId och deltagare innehåller mig) går igenom", async () => {
    await assertSucceeds(getDocs(query(collection(som(ANNA), "samtal"), where("groupId", "==", G), where("deltagare", "array-contains", ANNA))));
  });
  it("⛔ en fråga efter någon annans privata samtal nekas", async () => {
    await assertFails(getDocs(query(collection(som(CECILIA), "samtal"), where("groupId", "==", G), where("deltagare", "array-contains", ANNA))));
  });
  it("⛔ en fråga över hela gruppens samtal utan deltagarvillkor nekas, den hade tagit med de privata", async () => {
    await assertFails(getDocs(query(collection(som(CECILIA), "samtal"), where("groupId", "==", G))));
  });
});

describe("⛔ skapa ett privat samtal: härledd nyckel, skaparen deltar, båda är aktiva personer i gruppen", () => {
  const ny = (/** @type {string[]} */ d, extra = {}) => ({ groupId: G, slag: "personer", deltagare: sorterat(d), skapad: nu(), skapadAv: ANNA, ...extra });
  const nyckel = (/** @type {string[]} */ d) => samtalsnyckel({ groupId: G, slag: "personer", deltagare: d });

  it("Anna öppnar ett samtal med Cecilia", async () => {
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${nyckel([ANNA, CECILIA])}`), ny([ANNA, CECILIA])));
  });
  it("⛔ Bo skapar inte ett samtal mellan två andra", async () => {
    await assertFails(setDoc(doc(som(BO), `samtal/${nyckel([CECILIA, ERIK])}`), ny([CECILIA, ERIK], { skapadAv: BO })));
  });
  it("⛔ skapadAv måste vara den inloggade", async () => {
    await assertFails(setDoc(doc(som(ANNA), `samtal/${G}|uid-bo|uid-cecilia`), ny([BO, CECILIA], { skapadAv: BO })));
  });
  it("⛔ en nyckel som inte är den härledda nekas (osorterad, eller ett eget id)", async () => {
    await assertFails(setDoc(doc(som(BO), `samtal/${G}|${CECILIA}|${BO}`), ny([BO, CECILIA], { skapadAv: BO })));
    await assertFails(setDoc(doc(som(BO), "samtal/eget-id"), ny([BO, CECILIA], { skapadAv: BO })));
  });
  it("⛔ en osorterad deltagarlista nekas, annars finns två nycklar för samma par", async () => {
    await assertFails(setDoc(doc(som(BO), `samtal/${nyckel([BO, CECILIA])}`), ny([BO, CECILIA], { skapadAv: BO, deltagare: [CECILIA, BO] })));
    // ⛔ Även när nyckeln följer samma osorterade ordning: då hade paret fått en andra nyckel, och två samtal.
    await assertFails(setDoc(doc(som(BO), `samtal/${G}|${CECILIA}|${BO}`), ny([BO, CECILIA], { skapadAv: BO, deltagare: [CECILIA, BO] })));
  });
  it("⛔ en deltagare som är främling i gruppen nekas", async () => {
    await assertFails(setDoc(doc(som(ANNA), `samtal/${nyckel([ANNA, FRAMLING])}`), ny([ANNA, FRAMLING])));
  });
  it("⛔ en borttagen medlem som deltagare nekas, och en borttagen medlem skapar inget", async () => {
    await assertFails(setDoc(doc(som(BO), `samtal/${nyckel([BO, DAVID])}`), ny([BO, DAVID], { skapadAv: BO })));
    await assertFails(setDoc(doc(som(DAVID), `samtal/${nyckel([CECILIA, DAVID])}`), ny([CECILIA, DAVID], { skapadAv: DAVID })));
  });
  it("⛔ tre deltagare nekas (nyckeln för ett par är den enda regeln kan kontrollera)", async () => {
    await assertFails(setDoc(doc(som(BO), `samtal/${G}|${BO}|${CECILIA}`), ny([BO, CECILIA, ANNA], { skapadAv: BO })));
  });
  it("⛔ ett okänt fält nekas", async () => {
    await assertFails(setDoc(doc(som(BO), `samtal/${nyckel([BO, CECILIA])}`), ny([BO, CECILIA], { skapadAv: BO, rubrik: "x" })));
  });
  it("⛔ en skapad-tid långt från serverns klocka nekas", async () => {
    await assertFails(setDoc(doc(som(BO), `samtal/${nyckel([BO, CECILIA])}`), ny([BO, CECILIA], { skapadAv: BO, skapad: nu() - 86400000 })));
  });
  it("⛔ att skapa samma par igen är en uppdatering, och den nekas: högst ett samtal per par", async () => {
    await assertFails(setDoc(doc(som(ANNA), `samtal/${annaBo}`), ny([ANNA, BO])));
  });
  it("⛔ deltagarna kan inte ändras i efterhand, och samtalet raderas inte", async () => {
    await assertFails(updateDoc(doc(som(ANNA), `samtal/${annaBo}`), { deltagare: sorterat([ANNA, CECILIA]) }));
    await assertFails(deleteDoc(doc(som(ANNA), `samtal/${annaBo}`)));
  });
  it("⛔ ett personsamtal med en agent nekas: det är slaget agent", async () => {
    await assertFails(setDoc(doc(som(BO), `samtal/${nyckel([BO, AGENT])}`), ny([BO, AGENT], { skapadAv: BO })));
  });
});

describe("gruppchatten skapas en gång per grupp", () => {
  it("en medlem skapar gruppens chatt med den härledda nyckeln", async () => {
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${TOM}|grupp`), { groupId: TOM, slag: "grupp", skapad: nu(), skapadAv: ANNA }));
  });
  it("⛔ inte i en annan grupp, inte med fel nyckel, inte med deltagare, inte två gånger", async () => {
    await assertFails(setDoc(doc(som(ANNA), `samtal/${ANNAN_G}|grupp`), { groupId: ANNAN_G, slag: "grupp", skapad: nu(), skapadAv: ANNA }));
    await assertFails(setDoc(doc(som(BO), `samtal/${G}|chatt`), { groupId: G, slag: "grupp", skapad: nu(), skapadAv: BO }));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${TOM}|grupp`), { groupId: TOM, slag: "grupp", skapad: nu(), skapadAv: ANNA }));
    await assertFails(setDoc(doc(som(BO), `samtal/${G}|grupp`), { groupId: G, slag: "grupp", skapad: nu(), skapadAv: BO }));
  });
  it("⛔ en klient som agent skapar ingen gruppchatt", async () => {
    await assertFails(setDoc(doc(som(AGENT), `samtal/${AGENTGRUPP}|grupp`), { groupId: AGENTGRUPP, slag: "grupp", skapad: nu(), skapadAv: AGENT }));
  });
});

describe("⛔ meddelanden: den som får läsa skriver som sig själv, ingen ändrar eller raderar", () => {
  it("båda deltagarna skriver i sitt privata samtal", async () => {
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${annaBo}/meddelanden/a2`), msg(ANNA)));
    await assertSucceeds(setDoc(doc(som(BO), `samtal/${annaBo}/meddelanden/b2`), msg(BO)));
  });
  it("⛔ en annan medlem skriver inte i ett privat samtal, en främling inte heller", async () => {
    await assertFails(setDoc(doc(som(CECILIA), `samtal/${annaBo}/meddelanden/c1`), msg(CECILIA)));
    await assertFails(setDoc(doc(som(FRAMLING), `samtal/${annaBo}/meddelanden/f1`), msg(FRAMLING)));
  });
  it("⛔ en borttagen medlem skriver inte i sitt gamla samtal", async () => {
    await assertFails(setDoc(doc(som(DAVID), `samtal/${annaDavid}/meddelanden/d2`), msg(DAVID)));
  });
  it("en medlem skriver i gruppchatten, en främling och en borttagen inte", async () => {
    await assertSucceeds(setDoc(doc(som(CECILIA), `samtal/${grupp}/meddelanden/c1`), msg(CECILIA)));
    await assertFails(setDoc(doc(som(FRAMLING), `samtal/${grupp}/meddelanden/f1`), msg(FRAMLING)));
    await assertFails(setDoc(doc(som(DAVID), `samtal/${grupp}/meddelanden/d1`), msg(DAVID)));
  });
  it("⛔ ingen skriver i någon annans namn", async () => {
    await assertFails(setDoc(doc(som(ANNA), `samtal/${annaBo}/meddelanden/a3`), msg(BO)));
  });
  it("⛔ tom text, för lång text, okänt fält och en tid långt bort nekas", async () => {
    await assertFails(setDoc(doc(som(ANNA), `samtal/${annaBo}/meddelanden/a4`), msg(ANNA, { text: "" })));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${annaBo}/meddelanden/a5`), msg(ANNA, { text: "x".repeat(4001) })));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${annaBo}/meddelanden/a6`), msg(ANNA, { rubrik: "x" })));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${annaBo}/meddelanden/a7`), msg(ANNA, { tid: nu() + 86400000 })));
  });
  it("⛔ ett meddelande ändras inte och raderas inte, inte ens av avsändaren", async () => {
    await assertFails(updateDoc(doc(som(ANNA), `samtal/${annaBo}/meddelanden/m1`), { text: "Något annat" }));
    await assertFails(deleteDoc(doc(som(ANNA), `samtal/${annaBo}/meddelanden/m1`)));
  });
});

describe("⛔ agentsamtalet (#185): personen läser och skriver, en klient skriver aldrig som agent", () => {
  it("personen läser agentsamtalet och skriver i det", async () => {
    await assertSucceeds(getDoc(doc(som(ANNA), `samtal/${annaAgent}`)));
    await assertSucceeds(getDocs(collection(som(ANNA), `samtal/${annaAgent}/meddelanden`)));
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${annaAgent}/meddelanden/a1`), msg(ANNA)));
  });
  it("⛔ en annan medlem läser inte någon annans agentsamtal", async () => {
    await assertFails(getDoc(doc(som(CECILIA), `samtal/${annaAgent}`)));
  });
  it("⛔ en klient inloggad som agenten skriver inte, varken i sitt eget samtal eller i gruppchatten", async () => {
    await assertFails(setDoc(doc(som(AGENT), `samtal/${annaAgent}/meddelanden/x1`), msg(AGENT)));
    await assertFails(setDoc(doc(som(AGENT), `samtal/${grupp}/meddelanden/x2`), msg(AGENT)));
  });
  it("Bo öppnar ett agentsamtal, men inte med en person som om den vore agent", async () => {
    const ok = samtalsnyckel({ groupId: G, slag: "agent", deltagare: [BO, AGENT] });
    await assertSucceeds(setDoc(doc(som(BO), `samtal/${ok}`), { groupId: G, slag: "agent", deltagare: sorterat([BO, AGENT]), skapad: nu(), skapadAv: BO }));
    const fel = samtalsnyckel({ groupId: G, slag: "agent", deltagare: [BO, CECILIA] });
    await assertFails(setDoc(doc(som(BO), `samtal/${fel}`), { groupId: G, slag: "agent", deltagare: sorterat([BO, CECILIA]), skapad: nu(), skapadAv: BO }));
  });
  it("⛔ agenten skapar inget agentsamtal som klient", async () => {
    const k = samtalsnyckel({ groupId: G, slag: "agent", deltagare: [CECILIA, AGENT] });
    await assertFails(setDoc(doc(som(AGENT), `samtal/${k}`), { groupId: G, slag: "agent", deltagare: sorterat([CECILIA, AGENT]), skapad: nu(), skapadAv: AGENT }));
  });
});

describe("⛔ läst-status: bara personen själv, bara i ett samtal hen får läsa", () => {
  it("Anna läser och flyttar sitt eget läsmärke", async () => {
    await assertSucceeds(getDoc(doc(som(ANNA), `samtal/${annaBo}/last/${ANNA}`)));
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${annaBo}/last/${ANNA}`), { lastTill: nu() }));
  });
  it("Bo sätter sitt första läsmärke", async () => {
    await assertSucceeds(setDoc(doc(som(BO), `samtal/${annaBo}/last/${BO}`), { lastTill: nu() }));
  });
  it("⛔ Bo läser inte och skriver inte Annas läsmärke", async () => {
    await assertFails(getDoc(doc(som(BO), `samtal/${annaBo}/last/${ANNA}`)));
    await assertFails(setDoc(doc(som(BO), `samtal/${annaBo}/last/${ANNA}`), { lastTill: 0 }));
  });
  it("⛔ en annan medlem sätter inget läsmärke i ett samtal hen inte deltar i", async () => {
    await assertFails(setDoc(doc(som(CECILIA), `samtal/${annaBo}/last/${CECILIA}`), { lastTill: nu() }));
  });
  it("⛔ ett okänt fält eller en tid som inte är ett heltal nekas, och märket raderas inte", async () => {
    await assertFails(setDoc(doc(som(ANNA), `samtal/${annaBo}/last/${ANNA}`), { lastTill: nu(), olasta: 3 }));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${annaBo}/last/${ANNA}`), { lastTill: "i går" }));
    await assertFails(deleteDoc(doc(som(ANNA), `samtal/${annaBo}/last/${ANNA}`)));
  });
});
