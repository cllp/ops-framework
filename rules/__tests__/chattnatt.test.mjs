/**
 * Regelprov för chattens nattskiva (#273 och chattanalysens avsnitt 3), mot Firestore-emulatorn.
 *
 * ══ ⛔ VAD SOM MÄTS ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * Varje ny undersamling och varje nytt fält är en nyckel till `samtalsregelfragment()`, utan förval. Provreglerna skrivs med
 * alla nycklar påslagna (`scripts/skriv-provregler.mjs`), och här mäts vad de släpper in och vad de nekar. Att en app som
 * INTE skickar nycklarna får samma regeltext som förut mäts byte för byte i `src/__tests__/chatt-status.test.jsx`.
 *
 * Rollerna: tre medlemmar (Anna, Bo, Cecilia), en borttagen (David), agenten (en medlem av typen agent), en främling (medlem i
 * en annan grupp) och den som inte är inloggad. Samtalen: gruppchatten, Annas och Bos privata samtal, och en annan grupps chatt.
 *
 * ⛔ RÖTT UTAN SITT SKYDD (regel 4). `CHATTPROV_MUTATION=<namn>` läser provreglerna med ett skydd bortplockat (tabellen
 * `MUTATIONER`). En mutation vars text inte finns exakt en gång är ett fel och inte en grön körning.
 *
 * Kör: npm run test:rules
 */

import { after, before, describe, it } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { medlemskapsId } from "../../src/lib/grupp.js";
import { samtalsnyckel } from "../../src/lib/samtal.js";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Ett skydd per rad: texten som tas bort eller byts, och vad den byts mot. Namnet går i `CHATTPROV_MUTATION`.
 * @type {Record<string, [string, string]>}
 */
export const MUTATIONER = {
  "status-skrivbar": ["match /status/{dok} {\n        allow read: if opsISamtal(sid);\n        allow write: if false;", "match /status/{dok} {\n        allow read: if opsISamtal(sid);\n        allow write: if request.auth != null;"],
  "status-las-alla": ["match /status/{dok} {\n        allow read: if opsISamtal(sid);", "match /status/{dok} {\n        allow read: if request.auth != null;"],
  "tradstatus-skrivbar": ["match /status/{dok} {\n          allow read: if opsIGruppchatten(sid);\n          allow write: if false;", "match /status/{dok} {\n          allow read: if opsIGruppchatten(sid);\n          allow write: if request.auth != null;"],
  "reaktion-las-alla": ["match /reaktioner/{rid} {\n        allow read: if opsISamtal(sid);", "match /reaktioner/{rid} {\n        allow read: if request.auth != null;"],
  "reaktion-utan-persontyp": ["        allow create: if opsISamtal(sid)\n          && opsArAktivTyp(request.auth.uid, get(opsSamtalet(sid)).data.groupId, 'person')\n          && opsGiltigReaktion", "        allow create: if opsISamtal(sid)\n          && opsGiltigReaktion"],
  "reaktion-som-annan": ["&& d.mid is string && d.av == request.auth.uid\n", "&& d.mid is string\n"],
  "reaktion-fri-kod": ["&& d.kod in [\"tumme\", \"hjarta\", \"skratt\", \"eld\", \"klapp\", \"bock\"]\n", ""],
  "reaktion-fri-nyckel": ["&& rid == d.mid + '|' + d.av + '|' + d.kod\n", ""],
  "reaktion-fria-falt": ["return d.keys().hasOnly([\"mid\", \"av\", \"kod\", \"tid\"])\n        && d.mid", "return d.mid"],
  "reaktion-utan-meddelande": ["&& exists(/databases/$(database)/documents/samtal/$(sid)/meddelanden/$(request.resource.data.mid));", ";"],
  "reaktion-radera-andras": ["allow delete: if opsISamtal(sid) && resource.data.av == request.auth.uid;", "allow delete: if opsISamtal(sid);"],
  "reaktion-uppdaterbar": ["        allow delete: if opsISamtal(sid) && resource.data.av == request.auth.uid;\n        allow update: if false;", "        allow delete: if opsISamtal(sid) && resource.data.av == request.auth.uid;\n        allow update: if opsISamtal(sid);"],
  "tradreaktion-utan-meddelande": ["&& exists(/databases/$(database)/documents/samtal/$(sid)/tradar/$(tid)/meddelanden/$(request.resource.data.mid));", ";"],
  "tradreaktion-radera-andras": ["allow delete: if opsIGruppchatten(sid) && resource.data.av == request.auth.uid;", "allow delete: if opsIGruppchatten(sid);"],
  "namner-fri-form": ["      return !('namner' in d) || (d.namner is list\n        && d.namner.size() > 0 && d.namner.size() <= 20\n        && d.namner.toSet().size() == d.namner.size()\n        && (!('alla' in d.namner) || d.namner.size() == 1));", "      return true;"],
  "namner-utan-tak": ["d.namner.size() <= 20", "true"],
  "namner-dubbletter": ["\n        && d.namner.toSet().size() == d.namner.size()", ""],
  "namner-alla-med-andra": ["\n        && (!('alla' in d.namner) || d.namner.size() == 1)", ""],
  "namner-fria-falt": ["hasOnly([\"text\", \"av\", \"tid\", \"namner\"])\n          && opsGiltigaNamner(request.resource.data)", "size() > 0\n          && opsGiltigaNamner(request.resource.data)"],
  "svarpa-i-gruppchatten": ["        && get(opsSamtalet(sid)).data.slag != 'grupp'\n", ""],
  "svarpa-utan-meddelande": ["\n        && exists(/databases/$(database)/documents/samtal/$(sid)/meddelanden/$(d.svarPa)));", ");"],
  "svarpa-fri-form": ["      return !('svarPa' in d) || (d.svarPa is string", "      return true || (d.svarPa is string"],
  "fast-las-alla": ["match /fasta/{mid} {\n        allow read: if opsISamtal(sid);", "match /fasta/{mid} {\n        allow read: if request.auth != null;"],
  "fast-som-annan": ["          && request.resource.data.av == request.auth.uid\n          && opsNu(request.resource.data.tid)\n          && exists(/databases/$(database)/documents/samtal/$(sid)/meddelanden/$(mid));", "          && opsNu(request.resource.data.tid)\n          && exists(/databases/$(database)/documents/samtal/$(sid)/meddelanden/$(mid));"],
  "fast-utan-meddelande": ["\n          && exists(/databases/$(database)/documents/samtal/$(sid)/meddelanden/$(mid));", ";"],
  "fast-fria-falt": ["          && request.resource.data.keys().hasOnly([\"av\", \"tid\"])\n", ""],
  "fast-lossa-alla": ["        allow delete: if opsISamtal(sid)\n          && opsArAktivTyp(request.auth.uid, get(opsSamtalet(sid)).data.groupId, 'person');\n        allow update: if false;\n      }", "        allow delete: if request.auth != null;\n        allow update: if false;\n      }"],
  "fast-uppdaterbar": ["          && opsArAktivTyp(request.auth.uid, get(opsSamtalet(sid)).data.groupId, 'person');\n        allow update: if false;\n      }", "          && opsArAktivTyp(request.auth.uid, get(opsSamtalet(sid)).data.groupId, 'person');\n        allow update: if opsISamtal(sid);\n      }"],
};

/** Provreglerna, eller (bara för bevisets röda riktning) provreglerna med ett skydd bortplockat. */
function regeltext() {
  const fil = path.join(rot, "rules", "provregler.rules");
  if (!fs.existsSync(fil)) throw new Error("rules/provregler.rules saknas. Kör npm run test:rules.");
  const text = fs.readFileSync(fil, "utf8");
  // ⛔ GOLV: varje nytt block måste finnas, annars mäter provet regler utan det som ska provas.
  for (const block of ["match /status/{dok} {", "match /reaktioner/{rid} {", "function opsGiltigReaktion(", "function opsGiltigaNamner(", "function opsGiltigtSvarPa(", "match /fasta/{mid} {"]) {
    if (!text.includes(block)) throw new Error(`"${block}" saknas i provreglerna`);
  }
  const namn = process.env.CHATTPROV_MUTATION;
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
const M1 = "m1"; // ett meddelande av Cecilia i gruppchatten
const P1 = "p1"; // ett meddelande av Anna i det privata samtalet
const T = "m-trad"; // ett meddelande med en tråd
const TM = "t1"; // ett meddelande i tråden

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;

before(async () => {
  const mutation = process.env.CHATTPROV_MUTATION;
  miljo = await initializeTestEnvironment({
    // ⛔ Ett eget projekt per mutation, så att en körning aldrig läser en annan körnings regler.
    projectId: mutation ? `regelprov-chatt-${mutation}` : "regelprov-chatt",
    firestore: { rules: regeltext(), host: "127.0.0.1", port: Number(process.env.FIRESTORE_PORT ?? 8080) },
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
    await setDoc(doc(db, `samtal/${grupp}/meddelanden/${M1}`), { text: "Styrelsemötet flyttas", av: CECILIA, tid: nu() });
    await setDoc(doc(db, `samtal/${grupp}/meddelanden/${T}`), { text: "Budgeten?", av: BO, tid: nu() });
    await setDoc(doc(db, `samtal/${grupp}/tradar/${T}`), { skapad: nu(), skapadAv: BO });
    await setDoc(doc(db, `samtal/${grupp}/tradar/${T}/meddelanden/${TM}`), { text: "Tight", av: CECILIA, tid: nu() });
    await setDoc(doc(db, `samtal/${annaBo}/meddelanden/${P1}`), { text: "Bara till dig", av: ANNA, tid: nu() });
    await setDoc(doc(db, `samtal/${annanGrupp}/meddelanden/x1`), { text: "Annan grupp", av: FRAMLING, tid: nu() });
    // Statusen skrivs av servern, förbi reglerna.
    await setDoc(doc(db, `samtal/${grupp}/status/agent`), { lage: "tanker", sedan: nu() });
    await setDoc(doc(db, `samtal/${grupp}/tradar/${T}/status/agent`), { lage: "skriver", sedan: nu() });
    await setDoc(doc(db, `samtal/${annaBo}/status/agent`), { lage: "tanker", sedan: nu() });
    await setDoc(doc(db, `samtal/${grupp}/fasta/${T}`), { av: BO, tid: nu() });
    // Reaktioner, skrivna förbi reglerna: Bos på M1, och Bos i tråden.
    await setDoc(doc(db, `samtal/${grupp}/reaktioner/${M1}|${BO}|tumme`), { mid: M1, av: BO, kod: "tumme", tid: nu() });
    await setDoc(doc(db, `samtal/${grupp}/tradar/${T}/reaktioner/${TM}|${BO}|eld`), { mid: TM, av: BO, kod: "eld", tid: nu() });
  });
});

after(async () => {
  if (miljo) await miljo.cleanup();
});

/** @param {string} uid */
const som = (uid) => miljo.authenticatedContext(uid).firestore();
const utan = () => miljo.unauthenticatedContext().firestore();

describe("⛔ agentens status (#273): medlemmar läser, ingen klient skriver", () => {
  it("en medlem läser gruppchattens och trådens status, en deltagare det privata samtalets", async () => {
    await assertSucceeds(getDoc(doc(som(CECILIA), `samtal/${grupp}/status/agent`)));
    await assertSucceeds(getDocs(collection(som(CECILIA), `samtal/${grupp}/status`)));
    await assertSucceeds(getDoc(doc(som(CECILIA), `samtal/${grupp}/tradar/${T}/status/agent`)));
    await assertSucceeds(getDoc(doc(som(BO), `samtal/${annaBo}/status/agent`)));
  });
  it("⛔ en främling, en borttagen medlem, en tredje person och den som inte är inloggad läser inte", async () => {
    for (const u of [FRAMLING, DAVID]) await assertFails(getDoc(doc(som(u), `samtal/${grupp}/status/agent`)));
    await assertFails(getDoc(doc(som(CECILIA), `samtal/${annaBo}/status/agent`)));
    await assertFails(getDoc(doc(utan(), `samtal/${grupp}/status/agent`)));
    await assertFails(getDoc(doc(som(FRAMLING), `samtal/${grupp}/tradar/${T}/status/agent`)));
  });
  it("⛔ ingen klient skriver statusen: inte en medlem, inte en klient inloggad som agenten", async () => {
    for (const u of [ANNA, AGENT]) {
      await assertFails(setDoc(doc(som(u), `samtal/${grupp}/status/agent`), { lage: "skriver", sedan: nu() }));
      await assertFails(updateDoc(doc(som(u), `samtal/${grupp}/status/agent`), { lage: "skriver" }));
      await assertFails(deleteDoc(doc(som(u), `samtal/${grupp}/status/agent`)));
      await assertFails(setDoc(doc(som(u), `samtal/${grupp}/tradar/${T}/status/agent`), { lage: "tanker", sedan: nu() }));
    }
  });
});

const reaktion = (/** @type {string} */ mid, /** @type {string} */ av, /** @type {string} */ kod, extra = {}) => ({ mid, av, kod, tid: nu(), ...extra });
const rvag = (/** @type {string} */ sid, /** @type {string} */ mid, /** @type {string} */ av, /** @type {string} */ kod) => `samtal/${sid}/reaktioner/${mid}|${av}|${kod}`;

describe("⛔ reaktioner: en per person, meddelande och kod, bara sin egen", () => {
  it("en medlem reagerar och tar bort sin reaktion; en deltagare i ett privat samtal också", async () => {
    await assertSucceeds(setDoc(doc(som(ANNA), rvag(grupp, M1, ANNA, "hjarta")), reaktion(M1, ANNA, "hjarta")));
    await assertSucceeds(getDocs(collection(som(CECILIA), `samtal/${grupp}/reaktioner`)));
    await assertSucceeds(deleteDoc(doc(som(ANNA), rvag(grupp, M1, ANNA, "hjarta"))));
    await assertSucceeds(setDoc(doc(som(BO), rvag(annaBo, P1, BO, "bock")), reaktion(P1, BO, "bock")));
  });
  it("⛔ en främling, en borttagen, en tredje person och den som inte är inloggad läser inte", async () => {
    for (const u of [FRAMLING, DAVID]) await assertFails(getDocs(collection(som(u), `samtal/${grupp}/reaktioner`)));
    await assertFails(getDocs(collection(som(CECILIA), `samtal/${annaBo}/reaktioner`)));
    await assertFails(getDocs(collection(utan(), `samtal/${grupp}/reaktioner`)));
  });
  it("⛔ inte som någon annan, och ingen klient som agenten", async () => {
    await assertFails(setDoc(doc(som(ANNA), rvag(grupp, M1, BO, "eld")), reaktion(M1, BO, "eld")));
    await assertFails(setDoc(doc(som(AGENT), rvag(grupp, M1, AGENT, "eld")), reaktion(M1, AGENT, "eld")));
    await assertFails(setDoc(doc(som(DAVID), rvag(grupp, M1, DAVID, "eld")), reaktion(M1, DAVID, "eld")));
  });
  it("⛔ bara de sex koderna, nyckeln ur fälten, inga andra fält, och meddelandet finns i samma samtal", async () => {
    await assertFails(setDoc(doc(som(ANNA), rvag(grupp, M1, ANNA, "👍")), reaktion(M1, ANNA, "👍")));
    await assertFails(setDoc(doc(som(ANNA), rvag(grupp, M1, ANNA, "skratt")), reaktion(M1, ANNA, "eld")));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/reaktioner/egen-nyckel`), reaktion(M1, ANNA, "eld")));
    await assertFails(setDoc(doc(som(ANNA), rvag(grupp, M1, ANNA, "klapp")), reaktion(M1, ANNA, "klapp", { emoji: "👏" })));
    await assertFails(setDoc(doc(som(ANNA), rvag(grupp, "finns-inte", ANNA, "eld")), reaktion("finns-inte", ANNA, "eld")));
    await assertFails(setDoc(doc(som(ANNA), rvag(grupp, P1, ANNA, "eld")), reaktion(P1, ANNA, "eld")));
  });
  it("⛔ ingen tar bort någon annans reaktion, och ingen reaktion uppdateras", async () => {
    await assertFails(deleteDoc(doc(som(ANNA), rvag(grupp, M1, BO, "tumme"))));
    await assertFails(updateDoc(doc(som(BO), rvag(grupp, M1, BO, "tumme")), { tid: nu() }));
  });
  it("⛔ i tråden: på trådens meddelanden, och bara sin egen tas bort", async () => {
    const tv = (/** @type {string} */ mid, /** @type {string} */ av, /** @type {string} */ kod) => `samtal/${grupp}/tradar/${T}/reaktioner/${mid}|${av}|${kod}`;
    await assertSucceeds(setDoc(doc(som(ANNA), tv(TM, ANNA, "klapp")), reaktion(TM, ANNA, "klapp")));
    await assertFails(setDoc(doc(som(ANNA), tv(M1, ANNA, "klapp")), reaktion(M1, ANNA, "klapp")));
    await assertFails(deleteDoc(doc(som(ANNA), tv(TM, BO, "eld"))));
    await assertFails(getDocs(collection(som(FRAMLING), `samtal/${grupp}/tradar/${T}/reaktioner`)));
  });
});

const mmsg = (/** @type {string} */ av, extra = {}) => ({ text: "Hej @Bo", av, tid: nu(), ...extra });

describe("⛔ omnämnanden: formen prövas i regeln, i samtalet och i tråden", () => {
  it("ett meddelande med en eller flera uid, eller med alla ensamt, skrivs", async () => {
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${grupp}/meddelanden/n1`), mmsg(ANNA, { namner: [BO] })));
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${grupp}/meddelanden/n2`), mmsg(ANNA, { namner: [BO, AGENT] })));
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${grupp}/meddelanden/n3`), mmsg(ANNA, { namner: ["alla"] })));
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${grupp}/tradar/${T}/meddelanden/n4`), mmsg(ANNA, { namner: [AGENT] })));
  });
  it("⛔ inte en tom lista, inte över 20, inga dubbletter, och alla inte tillsammans med andra", async () => {
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/meddelanden/x1`), mmsg(ANNA, { namner: [] })));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/meddelanden/x2`), mmsg(ANNA, { namner: Array.from({ length: 21 }, (_, i) => `u${i}`) })));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/meddelanden/x3`), mmsg(ANNA, { namner: [BO, BO] })));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/meddelanden/x4`), mmsg(ANNA, { namner: ["alla", BO] })));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/meddelanden/x5`), mmsg(ANNA, { namner: BO })));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/tradar/${T}/meddelanden/x6`), mmsg(ANNA, { namner: ["alla", BO] })));
  });
  it("⛔ inga andra nya fält på meddelandet", async () => {
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/meddelanden/x7`), mmsg(ANNA, { mentions: [BO] })));
  });
});

describe("⛔ citat: bara i privata samtal, bara ett meddelande i samma samtal", () => {
  it("en deltagare svarar med citat på ett meddelande i samma privata samtal", async () => {
    await assertSucceeds(setDoc(doc(som(BO), `samtal/${annaBo}/meddelanden/c1`), { text: "Ja", av: BO, tid: nu(), svarPa: P1 }));
  });
  it("⛔ inte i gruppchatten, inte ett meddelande som inte finns, inte ett ur ett annat samtal, och inte som annat än en sträng", async () => {
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/meddelanden/c2`), { text: "Ja", av: ANNA, tid: nu(), svarPa: M1 }));
    await assertFails(setDoc(doc(som(BO), `samtal/${annaBo}/meddelanden/c3`), { text: "Ja", av: BO, tid: nu(), svarPa: "finns-inte" }));
    await assertFails(setDoc(doc(som(BO), `samtal/${annaBo}/meddelanden/c4`), { text: "Ja", av: BO, tid: nu(), svarPa: M1 }));
    await assertFails(setDoc(doc(som(BO), `samtal/${annaBo}/meddelanden/c5`), { text: "Ja", av: BO, tid: nu(), svarPa: 5 }));
  });
  it("⛔ inte i en tråd", async () => {
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/tradar/${T}/meddelanden/c6`), { text: "Ja", av: ANNA, tid: nu(), svarPa: TM }));
  });
});

describe("⛔ fästa: samtalets personer fäster och lossar, ingen annan", () => {
  it("en medlem fäster ett meddelande och en annan lossar det", async () => {
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${grupp}/fasta/${M1}`), { av: ANNA, tid: nu() }));
    await assertSucceeds(getDocs(collection(som(CECILIA), `samtal/${grupp}/fasta`)));
    await assertSucceeds(deleteDoc(doc(som(CECILIA), `samtal/${grupp}/fasta/${M1}`)));
  });
  it("⛔ en främling, en borttagen och den som inte är inloggad varken läser, fäster eller lossar", async () => {
    for (const u of [FRAMLING, DAVID]) {
      await assertFails(getDocs(collection(som(u), `samtal/${grupp}/fasta`)));
      await assertFails(setDoc(doc(som(u), `samtal/${grupp}/fasta/${M1}`), { av: u, tid: nu() }));
      await assertFails(deleteDoc(doc(som(u), `samtal/${grupp}/fasta/${T}`)));
    }
    await assertFails(getDocs(collection(utan(), `samtal/${grupp}/fasta`)));
    await assertFails(deleteDoc(doc(som(AGENT), `samtal/${grupp}/fasta/${T}`)));
  });
  it("⛔ inte som någon annan, inte ett meddelande som inte finns, inga andra fält, och ingen uppdatering", async () => {
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/fasta/${M1}`), { av: BO, tid: nu() }));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/fasta/finns-inte`), { av: ANNA, tid: nu() }));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/fasta/${M1}`), { av: ANNA, tid: nu(), text: "kopia" }));
    await assertFails(updateDoc(doc(som(BO), `samtal/${grupp}/fasta/${T}`), { tid: nu() }));
  });
});
