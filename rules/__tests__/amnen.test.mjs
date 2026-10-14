/**
 * Regelprov för samtal per ämne med agenten (0.106.0, #386 skiva 2), mot Firestore-emulatorn.
 *
 * ══ ⛔ VAD SOM MÄTS ══════════════════════════════════════════════════════
 *
 * CP 2026-10-14: "en konversation med agenten inte kluddar ner en annan." Ett ämne är ett eget agentsamtal med en fjärde del i
 * nyckeln. Proven i båda riktningar: personen skapar ett ämne med den härledda nyckeln, med och utan rubrik, och ändrar rubrik och
 * arkiv. Ingen annan gör det, ett personsamtal får inga ämnen, en nyckel som inte är härledd nekas, och inga andra fält ändras.
 * Läsregeln är oförändrad: en annan medlem läser inte någon annans ämne.
 *
 * Reglerna skrivs av `scripts/skriv-provregler.mjs` ur `samtalsregelfragment({ amnen: true, ... })` precis innan emulatorn startar.
 *
 * Kör: npm run test:rules
 */

import { medlemskapsId } from "../../src/lib/grupp.js";
import { samtalsnyckel } from "../../src/lib/samtal.js";
import { after, before, describe, it } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const G = "amnes-ab";
const ANNA = "uid-anna";
const BO = "uid-bo";
const AGENT = "uid-agent";
const FRAMLING = "uid-framling";
const nu = () => Date.now();
const sorterat = (/** @type {string[]} */ d) => [...d].sort();
const bas = samtalsnyckel({ groupId: G, slag: "agent", deltagare: [ANNA, AGENT] });
const amne = (/** @type {string} */ a) => samtalsnyckel({ groupId: G, slag: "agent", deltagare: [ANNA, AGENT], amne: a });
const finnsAmne = amne("a_finns_1");
const nytt = (extra = {}) => ({ groupId: G, slag: "agent", deltagare: sorterat([ANNA, AGENT]), skapad: nu(), skapadAv: ANNA, ...extra });

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;

before(async () => {
  const regler = path.join(rot, "rules", "provregler.rules");
  if (!fs.existsSync(regler)) throw new Error("rules/provregler.rules saknas. Kör npm run test:rules.");
  miljo = await initializeTestEnvironment({
    projectId: "regelprov-amnen",
    firestore: { rules: fs.readFileSync(regler, "utf8"), host: "127.0.0.1", port: 8080 },
  });
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const medlem = (/** @type {string} */ uid, /** @type {string} */ gid, typ = "person") =>
      setDoc(doc(db, `memberships/${medlemskapsId(uid, gid)}`), { userId: uid, groupId: gid, roll: "medlem", typ, status: "aktiv" });
    await medlem(ANNA, G);
    await medlem(BO, G);
    await medlem(AGENT, G, "agent");
    await medlem(FRAMLING, "annan-grupp");
    await setDoc(doc(db, `samtal/${bas}`), nytt());
    await setDoc(doc(db, `samtal/${finnsAmne}`), nytt({ rubrik: "Momsen" }));
    await setDoc(doc(db, `samtal/${finnsAmne}/meddelanden/m1`), { text: "Hur ligger momsen till?", av: ANNA, tid: nu() });
  });
});

after(async () => {
  if (miljo) await miljo.cleanup();
});

/** @param {string} uid */
const som = (uid) => miljo.authenticatedContext(uid).firestore();

describe("⛔ skapa ett ämne", () => {
  it("personen skapar ett ämne med den härledda nyckeln, utan rubrik och med", async () => {
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${amne("a_lq8k2m_4f9x1z")}`), nytt()));
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${amne("a_lq8k2m_rubrik")}`), nytt({ rubrik: "Resan till Visby" })));
  });
  it("och skriver sitt första meddelande i det", async () => {
    const sid = amne("a_med_meddelande");
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${sid}`), nytt()));
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${sid}/meddelanden/m1`), { text: "Hej", av: ANNA, tid: nu() }));
  });
  it("⛔ ett ämnesid utanför formen nekas: versaler, bindestreck, för långt, tomt", async () => {
    for (const fel of [`${bas}|A_stor`, `${bas}|a-b`, `${bas}|${"a".repeat(41)}`, `${bas}|`]) {
      await assertFails(setDoc(doc(som(ANNA), `samtal/${fel}`), nytt()));
    }
  });
  it("⛔ fem delar, eller ett annat par i nyckeln, nekas", async () => {
    await assertFails(setDoc(doc(som(ANNA), `samtal/${bas}|a_x|a_y`), nytt()));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${G}|${BO}|${AGENT}|a_x`), nytt()));
  });
  it("⛔ ett personsamtal får inga ämnen och ingen rubrik", async () => {
    const par = sorterat([ANNA, BO]);
    const ny = { groupId: G, slag: "personer", deltagare: par, skapad: nu(), skapadAv: ANNA };
    await assertFails(setDoc(doc(som(ANNA), `samtal/${G}|${par[0]}|${par[1]}|a_x`), ny));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${G}|${par[0]}|${par[1]}`), { ...ny, rubrik: "x" }));
  });
  it("⛔ det första agentsamtalet bär ingen rubrik vid skapelsen, och en för lång rubrik nekas", async () => {
    await assertFails(setDoc(doc(som(BO), `samtal/${samtalsnyckel({ groupId: G, slag: "agent", deltagare: [BO, AGENT] })}`), { ...nytt({ skapadAv: BO }), deltagare: sorterat([BO, AGENT]), rubrik: "x" }));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${amne("a_lang")}`), nytt({ rubrik: "x".repeat(81) })));
  });
  it("⛔ någon annan skapar inget ämne i Annas namn, och ett okänt fält nekas", async () => {
    await assertFails(setDoc(doc(som(BO), `samtal/${amne("a_bo")}`), nytt({ skapadAv: BO })));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${amne("a_okant")}`), nytt({ amne: "a_okant" })));
  });
  it("⛔ att skapa ett ämne som finns är en uppdatering, och den nekas", async () => {
    await assertFails(setDoc(doc(som(ANNA), `samtal/${finnsAmne}`), nytt()));
  });
});

describe("⛔ ändra ett ämne: rubrik och arkiv, av personen, inget annat", () => {
  it("personen sätter och tar bort rubriken, och arkiverar och tar fram", async () => {
    await assertSucceeds(updateDoc(doc(som(ANNA), `samtal/${finnsAmne}`), { rubrik: "Momsen för augusti" }));
    await assertSucceeds(updateDoc(doc(som(ANNA), `samtal/${finnsAmne}`), { rubrik: deleteField() }));
    await assertSucceeds(updateDoc(doc(som(ANNA), `samtal/${finnsAmne}`), { arkiverad: true }));
    await assertSucceeds(updateDoc(doc(som(ANNA), `samtal/${finnsAmne}`), { arkiverad: deleteField() }));
    // Det första agentsamtalet är det första ämnet, och får samma två ändringar.
    await assertSucceeds(updateDoc(doc(som(ANNA), `samtal/${bas}`), { rubrik: "Allmänt" }));
  });
  it("⛔ en annan medlem ändrar inte Annas ämne, och en främling inte heller", async () => {
    await assertFails(updateDoc(doc(som(BO), `samtal/${finnsAmne}`), { rubrik: "Bo var här" }));
    await assertFails(updateDoc(doc(som(FRAMLING), `samtal/${finnsAmne}`), { arkiverad: true }));
  });
  it("⛔ andra fält ändras inte, fel typer nekas, och ingenting raderas", async () => {
    await assertFails(updateDoc(doc(som(ANNA), `samtal/${finnsAmne}`), { deltagare: sorterat([ANNA, BO]) }));
    await assertFails(updateDoc(doc(som(ANNA), `samtal/${finnsAmne}`), { skapad: nu() }));
    await assertFails(updateDoc(doc(som(ANNA), `samtal/${finnsAmne}`), { arkiverad: "ja" }));
    await assertFails(updateDoc(doc(som(ANNA), `samtal/${finnsAmne}`), { rubrik: "" }));
    await assertFails(updateDoc(doc(som(ANNA), `samtal/${finnsAmne}`), { rubrik: 7 }));
    await assertFails(deleteDoc(doc(som(ANNA), `samtal/${finnsAmne}`)));
  });
  it("⛔ gruppchatten och personsamtalen ändras aldrig", async () => {
    await miljo.withSecurityRulesDisabled(async (ctx) => {
      const par = sorterat([ANNA, BO]);
      await setDoc(doc(ctx.firestore(), `samtal/${G}|grupp`), { groupId: G, slag: "grupp", skapad: nu(), skapadAv: ANNA });
      await setDoc(doc(ctx.firestore(), `samtal/${G}|${par[0]}|${par[1]}`), { groupId: G, slag: "personer", deltagare: par, skapad: nu(), skapadAv: ANNA });
    });
    const par = sorterat([ANNA, BO]);
    await assertFails(updateDoc(doc(som(ANNA), `samtal/${G}|grupp`), { rubrik: "Gruppen" }));
    await assertFails(updateDoc(doc(som(ANNA), `samtal/${G}|${par[0]}|${par[1]}`), { arkiverad: true }));
  });
});

describe("⛔ läsningen är oförändrad", () => {
  it("personen läser sina ämnen med inkorgens fråga, en annan medlem läser dem inte", async () => {
    await assertSucceeds(getDocs(query(collection(som(ANNA), "samtal"), where("groupId", "==", G), where("deltagare", "array-contains", ANNA))));
    await assertSucceeds(getDoc(doc(som(ANNA), `samtal/${finnsAmne}`)));
    await assertSucceeds(getDocs(collection(som(ANNA), `samtal/${finnsAmne}/meddelanden`)));
    await assertFails(getDoc(doc(som(BO), `samtal/${finnsAmne}`)));
    await assertFails(getDocs(collection(som(BO), `samtal/${finnsAmne}/meddelanden`)));
  });
});
