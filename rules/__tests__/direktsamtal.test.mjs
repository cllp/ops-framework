/**
 * Regelprov för direktsamtalen (cllp/lifehub.app#946 skiva 1): två personer i samma hubb utan gemensam grupp, nyckeln `~direkt|<a>|<b>`.
 *
 * Reglerna är provreglerna med samtalens fragment byggt med `direkt: true` (`rules/provregler-direkt.rules`, skriven av `scripts/skriv-provregler.mjs`). Ett golv kräver att filen
 * bär direktsamtalens hjälpfunktioner, så att proven inte blir gröna mot reglerna utan dem.
 *
 * ⛔ RÖTT UTAN SITT SKYDD (regel 4): `DIREKTPROV_UTAN=1` läser i stället provreglerna utan direktsamtal. Då är proven som väntar ett ja röda (ingen läser eller skriver i ett direktsamtal),
 * och proven som väntar ett nej gröna i båda lägena. `DIREKTPROV_UTAN=sparr` tar bort spärren mot en grupp som börjar med `~`, och då är det provet rött.
 */

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { medlemskapsId } from "../../src/lib/grupp.js";
import { byggDirektsamtal, direktnyckel } from "../../src/lib/samtal.js";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ANNA = "uid-d-anna";
const BO = "uid-d-bo";
const CECILIA = "uid-d-cecilia";
const DAVID = "uid-d-david"; // medlem i gruppen ~direkt, inte i något direktsamtal
const G = "d-grupp";
const nu = () => Date.now();
const UTAN = process.env.DIREKTPROV_UTAN;

const direkt = direktnyckel([BO, ANNA]);
const saknas = direktnyckel([ANNA, CECILIA]);

function regler() {
  const fil = path.join(rot, "rules", UTAN === "1" ? "provregler.rules" : "provregler-direkt.rules");
  if (!fs.existsSync(fil)) throw new Error(`${path.relative(rot, fil)} saknas. Kör npm run test:rules.`);
  let text = fs.readFileSync(fil, "utf8");
  if (UTAN === "sparr") text = text.replace("\n        && !d.groupId.matches('~.*')", "");
  return text;
}

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;

before(async () => {
  miljo = await initializeTestEnvironment({ projectId: "regelprov-direktsamtal", firestore: { rules: regler(), host: "127.0.0.1", port: 8080 } });
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const s = byggDirektsamtal({ deltagare: [ANNA, BO], skapadAv: ANNA, skapad: nu() });
    const { id, ...data } = s;
    await setDoc(doc(db, `samtal/${id}`), { ...data, deltagare: [...data.deltagare] });
    await setDoc(doc(db, `samtal/${direkt}/meddelanden/m1`), { text: "Hej Bo, vi sågs på marknaden", av: ANNA, tid: nu() });
    // Gruppen `~direkt` finns bara här, för att visa att ingen kan lägga ett personsamtal med ett direktsamtals nyckel.
    for (const uid of [ANNA, BO, DAVID]) {
      await setDoc(doc(db, `memberships/${medlemskapsId(uid, "~direkt")}`), { userId: uid, groupId: "~direkt", roll: "medlem", typ: "person", status: "aktiv" });
      await setDoc(doc(db, `memberships/${medlemskapsId(uid, G)}`), { userId: uid, groupId: G, roll: "medlem", typ: "person", status: "aktiv" });
    }
  });
});

after(async () => {
  if (miljo) await miljo.cleanup();
});

const som = (/** @type {string} */ uid) => miljo.authenticatedContext(uid).firestore();

describe("golv", () => {
  it("reglerna bär direktsamtalen, och nyckeln är ~direkt med de två sorterade", () => {
    assert.equal(direkt, `~direkt|${ANNA}|${BO}`);
    if (UTAN !== "1") assert.ok(regler().includes("function opsSomPersonISamtalet(sid)"), "provregler-direkt.rules bär hjälpfunktionen");
  });
});

describe("läsa", () => {
  it("de två läser samtalet och dess meddelanden, en tredje och en utloggad gör det inte", async () => {
    for (const uid of [ANNA, BO]) {
      await assertSucceeds(getDoc(doc(som(uid), "samtal", direkt)));
      await assertSucceeds(getDoc(doc(som(uid), `samtal/${direkt}/meddelanden/m1`)));
    }
    await assertFails(getDoc(doc(som(CECILIA), "samtal", direkt)));
    await assertFails(getDoc(doc(som(CECILIA), `samtal/${direkt}/meddelanden/m1`)));
    await assertFails(getDoc(doc(miljo.unauthenticatedContext().firestore(), "samtal", direkt)));
  });
});

describe("skriva", () => {
  it("de två skriver meddelanden som sig själva, en tredje gör det inte, och ingen skriver som den andra", async () => {
    await assertSucceeds(setDoc(doc(som(BO), `samtal/${direkt}/meddelanden/b1`), { text: "Hej Anna!", av: BO, tid: nu() }));
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${direkt}/meddelanden/a2`), { text: "Ses i morgon?", av: ANNA, tid: nu() }));
    await assertFails(setDoc(doc(som(CECILIA), `samtal/${direkt}/meddelanden/c1`), { text: "Hej", av: CECILIA, tid: nu() }));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${direkt}/meddelanden/a3`), { text: "Från Bo", av: BO, tid: nu() }));
  });

  it("⛔ ett meddelande i ett direktsamtal som inte finns nekas, också för en av dem i nyckeln", async () => {
    await assertFails(setDoc(doc(som(ANNA), `samtal/${saknas}/meddelanden/a1`), { text: "Hej", av: ANNA, tid: nu() }));
  });

  it("de två reagerar och markerar läst, en tredje gör det inte", async () => {
    await assertSucceeds(setDoc(doc(som(BO), `samtal/${direkt}/reaktioner/m1|${BO}|tumme`), { mid: "m1", av: BO, kod: "tumme", tid: nu() }));
    await assertFails(setDoc(doc(som(CECILIA), `samtal/${direkt}/reaktioner/m1|${CECILIA}|tumme`), { mid: "m1", av: CECILIA, kod: "tumme", tid: nu() }));
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${direkt}/last/${ANNA}`), { lastTill: nu() }));
    await assertFails(setDoc(doc(som(CECILIA), `samtal/${direkt}/last/${CECILIA}`), { lastTill: nu() }));
  });
});

describe("⛔ bara servern skapar ett direktsamtal", () => {
  it("ingen klient skapar ett, inte ens en av de två med rätt form, och ingen ändrar eller raderar ett", async () => {
    const { id, ...data } = byggDirektsamtal({ deltagare: [ANNA, CECILIA], skapadAv: ANNA, skapad: nu() });
    await assertFails(setDoc(doc(som(ANNA), "samtal", id), { ...data, deltagare: [...data.deltagare] }));
    await assertFails(updateDoc(doc(som(ANNA), "samtal", direkt), { deltagare: [ANNA, CECILIA] }));
    await assertFails(deleteDoc(doc(som(ANNA), "samtal", direkt)));
  });

  it("⛔ ett personsamtal i en grupp som börjar med ~ nekas: det hade fått ett direktsamtals nyckel", async () => {
    const d = { groupId: "~direkt", slag: "personer", deltagare: [ANNA, DAVID].sort(), skapad: nu(), skapadAv: ANNA };
    await assertFails(setDoc(doc(som(ANNA), "samtal", `~direkt|${d.deltagare[0]}|${d.deltagare[1]}`), d));
    // Kontroll: samma personsamtal i en vanlig grupp går, så nejet ovan kommer av spärren och inte av något annat.
    const v = { groupId: G, slag: "personer", deltagare: [ANNA, BO].sort(), skapad: nu(), skapadAv: ANNA };
    await assertSucceeds(setDoc(doc(som(ANNA), "samtal", `${G}|${v.deltagare[0]}|${v.deltagare[1]}`), v));
  });
});
