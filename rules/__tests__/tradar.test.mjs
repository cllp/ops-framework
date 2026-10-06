/**
 * Regelprov för trådarna i gruppchatten (0.68.0, cllp/lifehub.app#60), mot Firestore-emulatorn.
 *
 * ══ ⛔ VAD SOM MÄTS ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-10-06: tråden är GRUPPENS. Bara gruppens aktiva personer läser och skriver, tråden finns bara i gruppchatten,
 * och ingen klient skriver i agentens namn. Rollerna: en medlem, en främling (medlem i en ANNAN grupp), en borttagen
 * medlem, en klient inloggad som agenten, och deltagarna i ett privat samtal.
 *
 * Proven skrevs först i lifehub.app (PR 65) mot appens block och flyttades hit som kontrakt när reglerna flyttade in i
 * `samtalsregelfragment()`: samtalen är ramverkets, och två hem för samma regel hade glidit isär (regel 2).
 *
 * ⛔ RÖTT UTAN SITT SKYDD (regel 4). `TRADPROV_MUTATION=<namn>` läser provreglerna med ett av skydden bortplockat (tabellen
 * `MUTATIONER`). En mutation vars text inte finns i reglerna är ett fel och inte en grön körning: annars hade ett omdöpt
 * villkor gjort beviset tomt.
 *
 * Kör: npm run test:rules
 */

import { after, before, describe, it } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { medlemskapsId } from "../../src/lib/grupp.js";
import { samtalsnyckel } from "../../src/lib/samtal.js";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Ett skydd per rad: texten som tas bort eller byts, och vad den byts mot. Namnet går i `TRADPROV_MUTATION`.
 * @type {Record<string, [string, string]>}
 */
export const MUTATIONER = {
  "las-utan-medlemskap": ["match /tradar/{tid} {\n        allow read: if opsIGruppchatten(sid);", "match /tradar/{tid} {\n        allow read: if request.auth != null;"],
  "utan-gruppchatt": ["return opsISamtal(sid) && get(opsSamtalet(sid)).data.slag == 'grupp';", "return opsISamtal(sid);"],
  "utan-persontyp": ["return opsIGruppchatten(sid) && opsArAktivTyp(request.auth.uid, get(opsSamtalet(sid)).data.groupId, 'person');", "return opsIGruppchatten(sid);"],
  "utan-rotmeddelande": ["&& exists(/databases/$(database)/documents/samtal/$(sid)/meddelanden/$(tid))\n", ""],
  "skapad-av-vem-som-helst": ["&& request.resource.data.skapadAv == request.auth.uid\n", ""],
  "uppdatera-allt": ["&& request.resource.data.diff(resource.data).affectedKeys().hasOnly([\"namn\"])\n", ""],
  "namn-utan-tak": ["d.namn.size() <= 80", "true"],
  "meddelande-utan-trad": ["&& exists(/databases/$(database)/documents/samtal/$(sid)/tradar/$(tid))\n", ""],
  "meddelande-av-vem-som-helst": ["&& request.resource.data.av == request.auth.uid\n            && request.resource.data.text is string", "&& request.resource.data.text is string"],
  "meddelande-fria-falt": ["/tradar/$(tid))\n            && request.resource.data.keys().hasOnly([\"text\", \"av\", \"tid\"])\n", "/tradar/$(tid))\n"],
};

/** Provreglerna, eller (bara för bevisets röda riktning) provreglerna med ett skydd bortplockat. */
function regeltext() {
  const fil = path.join(rot, "rules", "provregler.rules");
  if (!fs.existsSync(fil)) throw new Error("rules/provregler.rules saknas. Kör npm run test:rules.");
  const text = fs.readFileSync(fil, "utf8");
  // ⛔ GOLV: trådblocket måste finnas med båda nivåerna, annars mäter provet regler utan trådar.
  if (!text.includes("match /tradar/{tid} {") || !/match \/tradar\/\{tid\} \{[\s\S]*match \/meddelanden\/\{mid\} \{/.test(text)) {
    throw new Error("trådreglerna saknas i provreglerna");
  }
  const namn = process.env.TRADPROV_MUTATION;
  if (!namn) return text;
  const m = MUTATIONER[namn];
  if (!m) throw new Error(`okänd mutation "${namn}". Giltiga: ${Object.keys(MUTATIONER).join(", ")}`);
  if (text.split(m[0]).length !== 2) throw new Error(`mutationen "${namn}" hittar inte sin text exakt en gång`);
  return text.replace(m[0], m[1]);
}

const G = "cps-ab";
const ANNAN_G = "miranda-ab";
const ANNA = "uid-anna";
const BO = "uid-bo";
const CECILIA = "uid-cecilia";
const DAVID = "uid-david"; // borttagen
const AGENT = "uid-agent"; // medlem av typen agent
const FRAMLING = "uid-framling"; // medlem i en annan grupp

const nu = () => Date.now();
const grupp = samtalsnyckel({ groupId: G, slag: "grupp" });
const annaBo = samtalsnyckel({ groupId: G, slag: "personer", deltagare: [ANNA, BO] });
const annanGrupp = samtalsnyckel({ groupId: ANNAN_G, slag: "grupp" });

const ROT = "m-rot"; // meddelandet tråden startades ur, med en tråd
const ROT2 = "m-rot2"; // ett meddelande utan tråd
const tradVag = (sid = grupp, tid = ROT) => `samtal/${sid}/tradar/${tid}`;
const tradMsgVag = (sid = grupp, tid = ROT) => `${tradVag(sid, tid)}/meddelanden`;

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;

before(async () => {
  const mutation = process.env.TRADPROV_MUTATION;
  miljo = await initializeTestEnvironment({
    // ⛔ Ett eget projekt per mutation, så att en körning aldrig läser en annan körnings regler.
    projectId: mutation ? `regelprov-tradar-${mutation}` : "regelprov-tradar",
    firestore: { rules: regeltext(), host: "127.0.0.1", port: 8080 },
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
    await setDoc(doc(db, `samtal/${grupp}`), { groupId: G, slag: "grupp", skapad: nu(), skapadAv: ANNA });
    await setDoc(doc(db, `samtal/${annaBo}`), { groupId: G, slag: "personer", deltagare: [ANNA, BO].sort(), skapad: nu(), skapadAv: ANNA });
    await setDoc(doc(db, `samtal/${annanGrupp}`), { groupId: ANNAN_G, slag: "grupp", skapad: nu(), skapadAv: FRAMLING });
    for (const id of [ROT, ROT2]) await setDoc(doc(db, `samtal/${grupp}/meddelanden/${id}`), { text: "Budgeten för Q3?", av: ANNA, tid: nu() });
    await setDoc(doc(db, `samtal/${annaBo}/meddelanden/p1`), { text: "Bara till dig", av: ANNA, tid: nu() });
    await setDoc(doc(db, `samtal/${annanGrupp}/meddelanden/x1`), { text: "Annan grupp", av: FRAMLING, tid: nu() });
    await setDoc(doc(db, tradVag()), { skapad: nu(), skapadAv: ANNA });
    await setDoc(doc(db, `${tradMsgVag()}/t1`), { text: "Ser tight ut", av: BO, tid: nu() });
    // En tråd skriven förbi reglerna i ett privat samtal, för att mäta att den inte går att läsa för en tredje person.
    await setDoc(doc(db, tradVag(annaBo, "p1")), { skapad: nu(), skapadAv: ANNA });
  });
});

after(async () => {
  if (miljo) await miljo.cleanup();
});

/** @param {string} uid */
const som = (uid) => miljo.authenticatedContext(uid).firestore();
const utan = () => miljo.unauthenticatedContext().firestore();
const msg = (/** @type {string} */ av, extra = {}) => ({ text: "Hej i tråden", av, tid: nu(), ...extra });

describe("⛔ läsa: gruppens aktiva medlemmar, ingen annan", () => {
  it("en medlem läser tråden och dess meddelanden", async () => {
    await assertSucceeds(getDoc(doc(som(CECILIA), tradVag())));
    await assertSucceeds(getDocs(collection(som(CECILIA), tradMsgVag())));
    await assertSucceeds(getDocs(collection(som(CECILIA), `samtal/${grupp}/tradar`)));
  });
  it("⛔ en främling läser varken tråden eller meddelandena", async () => {
    await assertFails(getDoc(doc(som(FRAMLING), tradVag())));
    await assertFails(getDocs(collection(som(FRAMLING), tradMsgVag())));
  });
  it("⛔ en borttagen medlem läser inte", async () => {
    await assertFails(getDoc(doc(som(DAVID), tradVag())));
    await assertFails(getDocs(collection(som(DAVID), tradMsgVag())));
  });
  it("⛔ utan inloggning läser ingen", async () => {
    await assertFails(getDoc(doc(utan(), tradVag())));
    await assertFails(getDocs(collection(utan(), tradMsgVag())));
  });
  it("⛔ en tråd i ett privat samtal går inte att läsa ens för deltagaren: trådar finns bara i gruppchatten", async () => {
    await assertFails(getDoc(doc(som(ANNA), tradVag(annaBo, "p1"))));
  });
});

describe("⛔ starta en tråd: en person i gruppen, ur ett meddelande som finns, i gruppchatten", () => {
  it("en medlem startar en tråd ur ett meddelande, med och utan eget namn", async () => {
    await assertSucceeds(setDoc(doc(som(CECILIA), tradVag(grupp, ROT2)), { skapad: nu(), skapadAv: CECILIA }));
    await miljo.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), tradVag(grupp, ROT2))));
    await assertSucceeds(setDoc(doc(som(CECILIA), tradVag(grupp, ROT2)), { skapad: nu(), skapadAv: CECILIA, namn: "Q3" }));
    await miljo.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), tradVag(grupp, ROT2))));
  });
  it("⛔ inte ur ett meddelande som inte finns", async () => {
    await assertFails(setDoc(doc(som(CECILIA), tradVag(grupp, "finns-inte")), { skapad: nu(), skapadAv: CECILIA }));
  });
  it("⛔ inte i ett privat samtal, ens för en deltagare", async () => {
    await assertFails(setDoc(doc(som(ANNA), tradVag(annaBo, "p1-ny")), { skapad: nu(), skapadAv: ANNA }));
    await miljo.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), `samtal/${annaBo}/meddelanden/p2`), { text: "x", av: ANNA, tid: nu() }));
    await assertFails(setDoc(doc(som(ANNA), tradVag(annaBo, "p2")), { skapad: nu(), skapadAv: ANNA }));
  });
  it("⛔ inte i en annan grupps chatt", async () => {
    await assertFails(setDoc(doc(som(ANNA), tradVag(annanGrupp, "x1")), { skapad: nu(), skapadAv: ANNA }));
  });
  it("⛔ inte som någon annan", async () => {
    await assertFails(setDoc(doc(som(CECILIA), tradVag(grupp, ROT2)), { skapad: nu(), skapadAv: ANNA }));
  });
  it("⛔ ingen klient startar en tråd som agenten", async () => {
    await assertFails(setDoc(doc(som(AGENT), tradVag(grupp, ROT2)), { skapad: nu(), skapadAv: AGENT }));
  });
  it("⛔ inte med fält utöver skapad, skapadAv och namn (inget groupId, inget rot)", async () => {
    await assertFails(setDoc(doc(som(CECILIA), tradVag(grupp, ROT2)), { skapad: nu(), skapadAv: CECILIA, groupId: G }));
    await assertFails(setDoc(doc(som(CECILIA), tradVag(grupp, ROT2)), { skapad: nu(), skapadAv: CECILIA, rot: ROT2 }));
  });
  it("⛔ inte med ett namn över 80 tecken eller ett tomt namn", async () => {
    await assertFails(setDoc(doc(som(CECILIA), tradVag(grupp, ROT2)), { skapad: nu(), skapadAv: CECILIA, namn: "x".repeat(81) }));
    await assertFails(setDoc(doc(som(CECILIA), tradVag(grupp, ROT2)), { skapad: nu(), skapadAv: CECILIA, namn: "" }));
  });
  it("⛔ högst en tråd per meddelande: en andra skapelse är en uppdatering av skaparen, och den nekas", async () => {
    await assertFails(setDoc(doc(som(BO), tradVag()), { skapad: nu(), skapadAv: BO }));
  });
});

describe("⛔ döpa om: vem som helst i gruppen, bara namnet", () => {
  it("en annan medlem än skaparen döper om tråden och tar bort namnet igen", async () => {
    await assertSucceeds(updateDoc(doc(som(BO), tradVag()), { namn: "Budget Q3" }));
    await assertSucceeds(updateDoc(doc(som(CECILIA), tradVag()), { namn: deleteField() }));
  });
  it("⛔ inte skaparen eller tiden", async () => {
    await assertFails(updateDoc(doc(som(BO), tradVag()), { skapadAv: BO }));
    await assertFails(updateDoc(doc(som(BO), tradVag()), { namn: "x", skapad: nu() }));
  });
  it("⛔ inte för en främling, en borttagen medlem eller en klient som agenten", async () => {
    for (const u of [FRAMLING, DAVID, AGENT]) await assertFails(updateDoc(doc(som(u), tradVag()), { namn: "Kapad" }));
  });
  it("⛔ inte ett namn över taket", async () => {
    await assertFails(updateDoc(doc(som(BO), tradVag()), { namn: "x".repeat(81) }));
  });
  it("⛔ ingen tar bort en tråd", async () => {
    await assertFails(deleteDoc(doc(som(ANNA), tradVag())));
  });
});

describe("⛔ skriva i tråden: en person i gruppen, som sig själv, i en tråd som finns", () => {
  it("en medlem skriver i tråden", async () => {
    await assertSucceeds(setDoc(doc(som(CECILIA), `${tradMsgVag()}/c1`), msg(CECILIA)));
  });
  it("⛔ ingen klient skriver i agentens namn, varken som agenten eller med agentens av", async () => {
    await assertFails(setDoc(doc(som(AGENT), `${tradMsgVag()}/a1`), msg(AGENT)));
    await assertFails(setDoc(doc(som(CECILIA), `${tradMsgVag()}/a2`), msg(AGENT)));
  });
  it("⛔ inte som en annan person", async () => {
    await assertFails(setDoc(doc(som(CECILIA), `${tradMsgVag()}/c2`), msg(ANNA)));
  });
  it("⛔ inte för en främling eller en borttagen medlem", async () => {
    await assertFails(setDoc(doc(som(FRAMLING), `${tradMsgVag()}/f1`), msg(FRAMLING)));
    await assertFails(setDoc(doc(som(DAVID), `${tradMsgVag()}/d1`), msg(DAVID)));
  });
  it("⛔ inte i en tråd som inte finns", async () => {
    // Ett id ingen annan provrad skapar en tråd på, så att utfallet inte beror på ordningen när ett skydd är bortplockat.
    await assertFails(setDoc(doc(som(CECILIA), `${tradMsgVag(grupp, "ingen-trad")}/c3`), msg(CECILIA)));
  });
  it("⛔ inte med fält utöver text, av och tid, inte tomt och inte över taket", async () => {
    await assertFails(setDoc(doc(som(CECILIA), `${tradMsgVag()}/c4`), msg(CECILIA, { groupId: G })));
    await assertFails(setDoc(doc(som(CECILIA), `${tradMsgVag()}/c5`), msg(CECILIA, { text: "" })));
    await assertFails(setDoc(doc(som(CECILIA), `${tradMsgVag()}/c6`), msg(CECILIA, { text: "x".repeat(4001) })));
  });
  it("⛔ ett meddelande ändras eller tas inte bort", async () => {
    await assertFails(updateDoc(doc(som(BO), `${tradMsgVag()}/t1`), { text: "ändrat" }));
    await assertFails(deleteDoc(doc(som(BO), `${tradMsgVag()}/t1`)));
  });
});
