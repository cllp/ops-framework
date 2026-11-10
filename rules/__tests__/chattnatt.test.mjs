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
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch } from "firebase/firestore";
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
  "tradreaktion-utan-giltig": ["allow create: if opsPersonIGruppchatten(sid)\n            && opsGiltigReaktion(rid, request.resource.data)\n", "allow create: if opsPersonIGruppchatten(sid)\n"],
  "tradreaktion-som-agent": ["match /reaktioner/{rid} {\n          allow read: if opsIGruppchatten(sid);\n          allow create: if opsPersonIGruppchatten(sid)", "match /reaktioner/{rid} {\n          allow read: if opsIGruppchatten(sid);\n          allow create: if opsIGruppchatten(sid)"],
  "reaktion-utan-nu": ["\n        && rid == d.mid + '|' + d.av + '|' + d.kod\n        && opsNu(d.tid);", "\n        && rid == d.mid + '|' + d.av + '|' + d.kod;"],
  "reaktion-radera-utan-samtal": ["allow delete: if opsISamtal(sid) && resource.data.av == request.auth.uid;", "allow delete: if request.auth != null && resource.data.av == request.auth.uid;"],
  "tradreaktion-radera-andras": ["allow delete: if opsIGruppchatten(sid) && resource.data.av == request.auth.uid;", "allow delete: if opsIGruppchatten(sid);"],
  "namner-fri-form": ["      return !('namner' in d) || (d.namner is list\n        && d.namner.size() > 0 && d.namner.size() <= 20\n        && d.namner.join(',').size() <= 2579\n        && d.namner.join(',').split(',') == d.namner\n        && !('' in d.namner)\n        && d.namner.toSet().size() == d.namner.size()\n        && (!('alla' in d.namner) || d.namner.size() == 1));", "      return true;"],
  "namner-utan-tak": ["d.namner.size() <= 20", "true"],
  "namner-utan-langd": ["\n        && d.namner.join(',').size() <= 2579", ""],
  "namner-utan-strangar": ["\n        && d.namner.join(',').split(',') == d.namner", ""],
  "namner-tom-strang": ["\n        && !('' in d.namner)", ""],
  "namner-dubbletter": ["\n        && d.namner.toSet().size() == d.namner.size()", ""],
  "namner-alla-med-andra": ["\n        && (!('alla' in d.namner) || d.namner.size() == 1)", ""],
  // ⛔ Samtalets meddelanden har också svarPa när citat är påslaget, och trådens har 12 blanksteg. Texten stod förut utan svarPa,
  // fanns då inte i provreglerna, och körningen dog i stället för att bli röd (granskningen av PR 286, MÅSTE 3).
  "namner-fria-falt": ["hasOnly([\"text\", \"av\", \"tid\", \"namner\", \"svarPa\", \"omrostning\", \"bilaga\"])\n          && opsGiltigaNamner(request.resource.data)", "size() > 0\n          && opsGiltigaNamner(request.resource.data)"],
  "tradmeddelande-fria-falt": ["hasOnly([\"text\", \"av\", \"tid\", \"namner\", \"bilaga\"])\n            && opsGiltigaNamner(request.resource.data)", "size() > 0\n            && opsGiltigaNamner(request.resource.data)"],
  "svarpa-i-gruppchatten": ["        && get(opsSamtalet(sid)).data.slag != 'grupp'\n", ""],
  "svarpa-utan-meddelande": ["\n        && exists(/databases/$(database)/documents/samtal/$(sid)/meddelanden/$(d.svarPa)));", ");"],
  "svarpa-fri-form": ["      return !('svarPa' in d) || (d.svarPa is string", "      return true || (d.svarPa is string"],
  "fast-las-alla": ["match /fasta/{mid} {\n        allow read: if opsISamtal(sid);", "match /fasta/{mid} {\n        allow read: if request.auth != null;"],
  "fast-som-annan": ["          && request.resource.data.av == request.auth.uid\n          && opsNu(request.resource.data.tid)\n          && exists(/databases/$(database)/documents/samtal/$(sid)/meddelanden/$(mid));", "          && opsNu(request.resource.data.tid)\n          && exists(/databases/$(database)/documents/samtal/$(sid)/meddelanden/$(mid));"],
  "fast-som-agent": ["        allow create: if opsISamtal(sid)\n          && opsArAktivTyp(request.auth.uid, get(opsSamtalet(sid)).data.groupId, 'person')\n          && request.resource.data.keys().hasOnly([\"av\", \"tid\"])", "        allow create: if opsISamtal(sid)\n          && request.resource.data.keys().hasOnly([\"av\", \"tid\"])"],
  "fast-utan-nu": ["\n          && opsNu(request.resource.data.tid)\n          && exists(/databases/$(database)/documents/samtal/$(sid)/meddelanden/$(mid));", "\n          && exists(/databases/$(database)/documents/samtal/$(sid)/meddelanden/$(mid));"],
  "fast-utan-meddelande": ["\n          && exists(/databases/$(database)/documents/samtal/$(sid)/meddelanden/$(mid));", ";"],
  "fast-fria-falt": ["          && request.resource.data.keys().hasOnly([\"av\", \"tid\"])\n", ""],
  "fast-lossa-alla": ["        allow delete: if opsISamtal(sid)\n          && opsArAktivTyp(request.auth.uid, get(opsSamtalet(sid)).data.groupId, 'person');\n        allow update: if false;\n      }", "        allow delete: if request.auth != null;\n        allow update: if false;\n      }"],
  "fast-uppdaterbar": ["          && opsArAktivTyp(request.auth.uid, get(opsSamtalet(sid)).data.groupId, 'person');\n        allow update: if false;\n      }", "          && opsArAktivTyp(request.auth.uid, get(opsSamtalet(sid)).data.groupId, 'person');\n        allow update: if opsISamtal(sid);\n      }"],
  // ⛔ Omröstningarna (cllp/lifehub.app#438 skiva 1). Varje skydd i opsGiltigOmrostning, alternativen och rösterna.
  "omrostning-utan-villkor": ["          && opsGiltigOmrostning(request.resource.data)\n", ""],
  "omrostning-fritt-varde": ["(d.omrostning == true\n", "(true\n"],
  "omrostning-fri-langd": ["&& d.text is string && d.text.size() <= 200\n", "&& d.text is string\n"],
  "omrostning-styrtecken": ["&& d.text.size() <= 200\n        && !d.text.matches('(?s).*[\\x00-\\x1f\\x7f].*')\n", "&& d.text.size() <= 200\n"],
  "omrostning-med-bilaga": ["\n        && !('bilaga' in d));", ");"],
  "val-las-alla": ["match /omrostningsval/{vid} {\n        allow read: if opsISamtal(sid);", "match /omrostningsval/{vid} {\n        allow read: if request.auth != null;"],
  "val-utan-persontyp": ["match /omrostningsval/{vid} {\n        allow read: if opsISamtal(sid);\n        allow create: if opsISamtal(sid)\n          && opsArAktivTyp(request.auth.uid, get(opsSamtalet(sid)).data.groupId, 'person')\n", "match /omrostningsval/{vid} {\n        allow read: if opsISamtal(sid);\n        allow create: if opsISamtal(sid)\n"],
  "val-som-annan": ["return d.keys().hasOnly([\"mid\", \"text\", \"av\", \"tid\"])\n        && d.av == request.auth.uid\n", "return d.keys().hasOnly([\"mid\", \"text\", \"av\", \"tid\"])\n"],
  "val-fria-falt": ["return d.keys().hasOnly([\"mid\", \"text\", \"av\", \"tid\"])\n        && d.av", "return d.av"],
  "val-fri-langd": [" && d.text.size() > 0 && d.text.size() <= 120", ""],
  "val-styrtecken": ["&& d.text.size() <= 120\n        && !d.text.matches('(?s).*[\\x00-\\x1f\\x7f].*')\n", "&& d.text.size() <= 120\n"],
  "val-fri-nyckel": ["        && vid.split('[|]').size() == 2 && vid.split('[|]')[0] == d.mid\n        && vid.split('[|]')[1].matches('[A-Za-z0-9_-]{1,40}')\n", ""],
  "val-utan-nu": ["&& vid.split('[|]')[1].matches('[A-Za-z0-9_-]{1,40}')\n        && opsNu(d.tid);", "&& vid.split('[|]')[1].matches('[A-Za-z0-9_-]{1,40}');"],
  "val-utan-omrostning": ["          && opsGiltigtOmrostningsval(vid, request.resource.data)\n          && opsArOmrostning(sid, request.resource.data.mid);", "          && opsGiltigtOmrostningsval(vid, request.resource.data);"],
  "val-andringsbar": ["          && opsArOmrostning(sid, request.resource.data.mid);\n        allow update, delete: if false;", "          && opsArOmrostning(sid, request.resource.data.mid);\n        allow update, delete: if opsISamtal(sid);"],
  "rost-las-alla": ["match /omrostningsroster/{rid} {\n        allow read: if opsISamtal(sid);", "match /omrostningsroster/{rid} {\n        allow read: if request.auth != null;"],
  "rost-utan-persontyp": ["match /omrostningsroster/{rid} {\n        allow read: if opsISamtal(sid);\n        allow create: if opsISamtal(sid)\n          && opsArAktivTyp(request.auth.uid, get(opsSamtalet(sid)).data.groupId, 'person')\n", "match /omrostningsroster/{rid} {\n        allow read: if opsISamtal(sid);\n        allow create: if opsISamtal(sid)\n"],
  "rost-som-annan": ["return d.keys().hasOnly([\"mid\", \"av\", \"val\", \"tid\"])\n        && d.av == request.auth.uid\n", "return d.keys().hasOnly([\"mid\", \"av\", \"val\", \"tid\"])\n"],
  "rost-fria-falt": ["return d.keys().hasOnly([\"mid\", \"av\", \"val\", \"tid\"])\n        && d.av", "return d.av"],
  "rost-fri-nyckel": ["        && rid == d.mid + '|' + d.av\n", ""],
  "rost-annan-omrostning": [" && d.val.split('[|]').size() == 2 && d.val.split('[|]')[0] == d.mid", ""],
  "rost-utan-alternativ": ["\n        && exists(/databases/$(database)/documents/samtal/$(sid)/omrostningsval/$(d.val))", ""],
  "rost-utan-nu": ["omrostningsval/$(d.val))\n        && opsNu(d.tid);", "omrostningsval/$(d.val));"],
  "rost-utan-omrostning": ["          && opsGiltigOmrostningsrost(sid, rid, request.resource.data)\n          && opsArOmrostning(sid, request.resource.data.mid);", "          && opsGiltigOmrostningsrost(sid, rid, request.resource.data);"],
  "rost-byt-utan-giltig": ["          && opsGiltigOmrostningsrost(sid, rid, request.resource.data);\n        allow delete: if opsISamtal(sid)", "          && true;\n        allow delete: if opsISamtal(sid)"],
  "rost-byt-utan-persontyp": ["        allow update: if opsISamtal(sid)\n          && opsArAktivTyp(request.auth.uid, get(opsSamtalet(sid)).data.groupId, 'person')\n          && opsGiltigOmrostningsrost", "        allow update: if opsISamtal(sid)\n          && opsGiltigOmrostningsrost"],
  "rost-radera-andras": ["        allow delete: if opsISamtal(sid)\n          && resource.data.av == request.auth.uid;", "        allow delete: if opsISamtal(sid);"],
  "rost-radera-utan-samtal": ["        allow delete: if opsISamtal(sid)\n          && resource.data.av == request.auth.uid;", "        allow delete: if request.auth != null\n          && resource.data.av == request.auth.uid;"],
};

/** Provreglerna, eller (bara för bevisets röda riktning) provreglerna med ett skydd bortplockat. */
function regeltext() {
  const fil = path.join(rot, "rules", "provregler.rules");
  if (!fs.existsSync(fil)) throw new Error("rules/provregler.rules saknas. Kör npm run test:rules.");
  const text = fs.readFileSync(fil, "utf8");
  // ⛔ GOLV: varje nytt block måste finnas, annars mäter provet regler utan det som ska provas.
  for (const block of ["match /status/{dok} {", "match /reaktioner/{rid} {", "function opsGiltigReaktion(", "function opsGiltigaNamner(", "function opsGiltigtSvarPa(", "match /fasta/{mid} {", "function opsGiltigOmrostning(", "match /omrostningsval/{vid} {", "match /omrostningsroster/{rid} {"]) {
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
const O1 = "o1"; // en omröstning av Cecilia i gruppchatten (#438)
const O2 = "o2"; // en annan omröstning i samma chatt
const OP = "op"; // en omröstning i Annas och Bos privata samtal

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
    // Davids reaktioner från när han var medlem: han är borttagen nu.
    await setDoc(doc(db, `samtal/${grupp}/reaktioner/${M1}|${DAVID}|bock`), { mid: M1, av: DAVID, kod: "bock", tid: nu() });
    await setDoc(doc(db, `samtal/${grupp}/tradar/${T}/reaktioner/${TM}|${DAVID}|bock`), { mid: TM, av: DAVID, kod: "bock", tid: nu() });
    // Omröstningar (#438), skrivna förbi reglerna: två i gruppchatten och en i det privata samtalet, med alternativ och röster.
    await setDoc(doc(db, `samtal/${grupp}/meddelanden/${O1}`), { text: "Vilken dag?", av: CECILIA, tid: nu(), omrostning: true });
    await setDoc(doc(db, `samtal/${grupp}/meddelanden/${O2}`), { text: "Vilken tid?", av: CECILIA, tid: nu(), omrostning: true });
    await setDoc(doc(db, `samtal/${annaBo}/meddelanden/${OP}`), { text: "Middag?", av: ANNA, tid: nu(), omrostning: true });
    for (const [sid, mid, stycke, text] of [[grupp, O1, "a", "Fredag"], [grupp, O1, "b", "Lördag"], [grupp, O2, "a", "Kväll"], [annaBo, OP, "a", "Ja"]]) {
      await setDoc(doc(db, `samtal/${sid}/omrostningsval/${mid}|${stycke}`), { mid, text, av: CECILIA, tid: nu() });
    }
    // Ett alternativ på ett meddelande som INTE är en omröstning, förbi reglerna: en röst på det ska ändå nekas.
    await setDoc(doc(db, `samtal/${grupp}/omrostningsval/${M1}|a`), { mid: M1, text: "Ja", av: CECILIA, tid: nu() });
    // Bos röst, agentens (en klient som agenten ska ändå inte kunna byta den) och Davids från när han var medlem.
    for (const u of [BO, AGENT, DAVID]) await setDoc(doc(db, `samtal/${grupp}/omrostningsroster/${O1}|${u}`), { mid: O1, av: u, val: `${O1}|a`, tid: nu() });
  });
});

after(async () => {
  if (miljo) await miljo.cleanup();
});

/** @param {string} uid */
const som = (uid) => miljo.authenticatedContext(uid).firestore();
const utan = () => miljo.unauthenticatedContext().firestore();

describe("⛔ mutationstabellen: varje skydd går att plocka bort", () => {
  // Granskningen av PR 286, MÅSTE 3: en mutation vars text inte fanns i provreglerna fick körningen att dö, och det räknades som
  // rött. Här prövas tabellen i varje vanlig körning, så att en mutation som slutat passa är ett rött prov och inte en tyst lucka.
  it("varje mutation hittar sin text exakt en gång i provreglerna, och tabellen har minst 38 rader", () => {
    const text = fs.readFileSync(path.join(rot, "rules", "provregler.rules"), "utf8");
    const fel = Object.entries(MUTATIONER).filter(([, [fran]]) => text.split(fran).length !== 2).map(([n]) => n);
    if (fel.length) throw new Error(`mutationer som inte hittar sin text exakt en gång: ${fel.join(", ")}`);
    if (Object.keys(MUTATIONER).length < 38) throw new Error(`bara ${Object.keys(MUTATIONER).length} mutationer`);
  });
});

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
  it("⛔ tiden är nu: inte för gammal, inte i framtiden, och ett tal", async () => {
    const gammal = nu() - 10 * 60 * 1000;
    await assertFails(setDoc(doc(som(ANNA), rvag(grupp, M1, ANNA, "skratt")), reaktion(M1, ANNA, "skratt", { tid: gammal })));
    await assertFails(setDoc(doc(som(ANNA), rvag(grupp, M1, ANNA, "skratt")), reaktion(M1, ANNA, "skratt", { tid: nu() + 10 * 60 * 1000 })));
    await assertFails(setDoc(doc(som(ANNA), rvag(grupp, M1, ANNA, "skratt")), reaktion(M1, ANNA, "skratt", { tid: String(nu()) })));
  });
  it("⛔ den som lämnat gruppen tar inte bort sin gamla reaktion, varken i samtalet eller i tråden", async () => {
    await assertFails(deleteDoc(doc(som(DAVID), rvag(grupp, M1, DAVID, "bock"))));
    await assertFails(deleteDoc(doc(som(DAVID), `samtal/${grupp}/tradar/${T}/reaktioner/${TM}|${DAVID}|bock`)));
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
  it("⛔ i tråden: inte som någon annan, bara de sex koderna, nyckeln ur fälten, inga andra fält och tiden nu", async () => {
    const tv = (/** @type {string} */ mid, /** @type {string} */ av, /** @type {string} */ kod) => `samtal/${grupp}/tradar/${T}/reaktioner/${mid}|${av}|${kod}`;
    await assertFails(setDoc(doc(som(ANNA), tv(TM, BO, "hjarta")), reaktion(TM, BO, "hjarta")));
    await assertFails(setDoc(doc(som(ANNA), tv(TM, ANNA, "👍")), reaktion(TM, ANNA, "👍")));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/tradar/${T}/reaktioner/egen-nyckel`), reaktion(TM, ANNA, "hjarta")));
    await assertFails(setDoc(doc(som(ANNA), tv(TM, ANNA, "hjarta")), reaktion(TM, ANNA, "hjarta", { emoji: "❤️" })));
    await assertFails(setDoc(doc(som(ANNA), tv(TM, ANNA, "hjarta")), reaktion(TM, ANNA, "hjarta", { tid: nu() - 10 * 60 * 1000 })));
  });
  it("⛔ i tråden: ingen klient som agenten", async () => {
    const tv = (/** @type {string} */ mid, /** @type {string} */ av, /** @type {string} */ kod) => `samtal/${grupp}/tradar/${T}/reaktioner/${mid}|${av}|${kod}`;
    await assertFails(setDoc(doc(som(AGENT), tv(TM, AGENT, "tumme")), reaktion(TM, AGENT, "tumme")));
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
  it("⛔ bara strängar, och inte längre än 20 uid om 128 tecken: varken i samtalet eller i tråden", async () => {
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/meddelanden/x8`), mmsg(ANNA, { namner: [{ a: 1 }, 7] })));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/meddelanden/x9`), mmsg(ANNA, { namner: ["x".repeat(200000)] })));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/tradar/${T}/meddelanden/x10`), mmsg(ANNA, { namner: [7] })));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/tradar/${T}/meddelanden/x11`), mmsg(ANNA, { namner: ["x".repeat(3000)] })));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/meddelanden/x13`), mmsg(ANNA, { namner: [BO, true] })));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/meddelanden/x14`), mmsg(ANNA, { namner: [""] })));
    // Golvet: 20 uid om 128 tecken går in.
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${grupp}/meddelanden/n5`), mmsg(ANNA, { namner: Array.from({ length: 20 }, (_, i) => String(i).padStart(128, "u")) })));
  });
  it("⛔ inga andra nya fält på meddelandet, i samtalet och i tråden", async () => {
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/meddelanden/x7`), mmsg(ANNA, { mentions: [BO] })));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/tradar/${T}/meddelanden/x12`), mmsg(ANNA, { mentions: [BO] })));
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
  it("⛔ ingen klient som agenten fäster, och tiden är nu", async () => {
    await assertFails(setDoc(doc(som(AGENT), `samtal/${grupp}/fasta/${M1}`), { av: AGENT, tid: nu() }));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/fasta/${M1}`), { av: ANNA, tid: nu() - 10 * 60 * 1000 }));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/fasta/${M1}`), { av: ANNA, tid: String(nu()) }));
  });
});

const alt = (/** @type {string} */ mid, /** @type {string} */ av, /** @type {string} */ text, extra = {}) => ({ mid, av, text, tid: nu(), ...extra });
const altvag = (/** @type {string} */ sid, /** @type {string} */ mid, /** @type {string} */ stycke) => `samtal/${sid}/omrostningsval/${mid}|${stycke}`;
const rost = (/** @type {string} */ mid, /** @type {string} */ av, /** @type {string} */ val, extra = {}) => ({ mid, av, val, tid: nu(), ...extra });
const rostvag = (/** @type {string} */ sid, /** @type {string} */ mid, /** @type {string} */ av) => `samtal/${sid}/omrostningsroster/${mid}|${av}`;

describe("⛔ omröstningar (#438): frågan är texten, alternativ av alla i samtalet, en röst per person", () => {
  it("en medlem ställer en omröstning med tio alternativ i samma batch som frågan", async () => {
    const db = som(ANNA);
    const b = writeBatch(db);
    b.set(doc(db, `samtal/${grupp}/meddelanden/ny1`), { text: "Vart åker vi?", av: ANNA, tid: nu(), omrostning: true });
    for (let i = 0; i < 10; i += 1) b.set(doc(db, altvag(grupp, "ny1", `v${i}`)), alt("ny1", ANNA, `Plats ${i}`));
    await assertSucceeds(b.commit());
    // Och i ett privat samtal.
    const bo = som(BO);
    const p = writeBatch(bo);
    p.set(doc(bo, `samtal/${annaBo}/meddelanden/ny2`), { text: "Bio?", av: BO, tid: nu(), omrostning: true });
    p.set(doc(bo, altvag(annaBo, "ny2", "a")), alt("ny2", BO, "Ja"));
    p.set(doc(bo, altvag(annaBo, "ny2", "b")), alt("ny2", BO, "Nej"));
    await assertSucceeds(p.commit());
  });
  it("⛔ frågan: inte över 200 tecken, ingen radbrytning eller tabb, ingen bilaga, och omrostning är true och inget annat", async () => {
    const fraga = (/** @type {Record<string, unknown>} */ extra) => ({ text: "Vilken dag?", av: ANNA, tid: nu(), omrostning: true, ...extra });
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${grupp}/meddelanden/f0`), fraga({ text: "x".repeat(200) })));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/meddelanden/f1`), fraga({ text: "x".repeat(201) })));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/meddelanden/f2`), fraga({ text: "Vilken\ndag?" })));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/meddelanden/f3`), fraga({ text: "Vilken\tdag?" })));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/meddelanden/f4`), fraga({ omrostning: "ja" })));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/meddelanden/f5`), fraga({ omrostning: false })));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/meddelanden/f6`), fraga({ bilaga: { namn: "a.png", typ: "image/png" } })));
    // Ett vanligt meddelande får fortfarande radbrytningar och 4000 tecken.
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${grupp}/meddelanden/f7`), { text: `Rad ett\nrad två ${"x".repeat(300)}`, av: ANNA, tid: nu() }));
  });
  it("⛔ en omröstning bär ingen bilaga, också när filen skrivs i samma batch", async () => {
    const PNG = "data:image/png;base64,iVBORw0KGgo=";
    const medFil = (/** @type {string} */ mid, /** @type {Record<string, unknown>} */ extra) => {
      const db = som(ANNA);
      const tid = nu();
      const b = writeBatch(db);
      b.set(doc(db, `samtal/${grupp}/meddelanden/${mid}`), { text: "Vilken bild?", av: ANNA, tid, bilaga: { namn: "a.png", typ: "image/png" }, ...extra });
      b.set(doc(db, `samtal/${grupp}/bilagor/${mid}`), { dataUrl: PNG, namn: "a.png", typ: "image/png", tecken: PNG.length, tid });
      return b.commit();
    };
    // Golvet: samma batch utan omröstningen går in, så det är omröstningen som nekas och inte filen.
    await assertSucceeds(medFil("fb1", {}));
    await assertFails(medFil("fb2", { omrostning: true }));
  });
  it("⛔ ingen omröstning i en tråd i skiva 1", async () => {
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/tradar/${T}/meddelanden/f8`), { text: "Vilken dag?", av: ANNA, tid: nu(), omrostning: true }));
  });
  it("vem som helst av samtalets personer lägger till ett alternativ, och samtalet läser dem", async () => {
    await assertSucceeds(setDoc(doc(som(ANNA), altvag(grupp, O1, "c")), alt(O1, ANNA, "Söndag")));
    await assertSucceeds(getDocs(collection(som(BO), `samtal/${grupp}/omrostningsval`)));
    await assertSucceeds(setDoc(doc(som(BO), altvag(annaBo, OP, "b")), alt(OP, BO, "Nej")));
  });
  it("⛔ alternativ: inte på ett meddelande som inte är en omröstning eller inte finns, och inte på en annan omrostnings nyckel", async () => {
    await assertFails(setDoc(doc(som(ANNA), altvag(grupp, M1, "q")), alt(M1, ANNA, "Ja")));
    await assertFails(setDoc(doc(som(ANNA), altvag(grupp, "finns-inte", "a")), alt("finns-inte", ANNA, "Ja")));
    await assertFails(setDoc(doc(som(ANNA), altvag(grupp, O2, "x")), alt(O1, ANNA, "Ja")));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/omrostningsval/egen-nyckel`), alt(O1, ANNA, "Ja")));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/omrostningsval/${O1}|a b`), alt(O1, ANNA, "Ja")));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/omrostningsval/${O1}|x|y`), alt(O1, ANNA, "Ja")));
    // Ett alternativ i det privata samtalet pekar inte på gruppchattens omröstning.
    await assertFails(setDoc(doc(som(ANNA), altvag(annaBo, O1, "z")), alt(O1, ANNA, "Ja")));
  });
  it("⛔ alternativ: som sig själv, inom taket, utan radbrytning, inga andra fält, och nu", async () => {
    await assertFails(setDoc(doc(som(ANNA), altvag(grupp, O1, "d")), alt(O1, BO, "Måndag")));
    await assertSucceeds(setDoc(doc(som(ANNA), altvag(grupp, O1, "e")), alt(O1, ANNA, "x".repeat(120))));
    await assertFails(setDoc(doc(som(ANNA), altvag(grupp, O1, "f")), alt(O1, ANNA, "x".repeat(121))));
    await assertFails(setDoc(doc(som(ANNA), altvag(grupp, O1, "g")), alt(O1, ANNA, "")));
    await assertFails(setDoc(doc(som(ANNA), altvag(grupp, O1, "h")), alt(O1, ANNA, "Två\nrader")));
    await assertFails(setDoc(doc(som(ANNA), altvag(grupp, O1, "i")), alt(O1, ANNA, "Tisdag", { antal: 9 })));
    await assertFails(setDoc(doc(som(ANNA), altvag(grupp, O1, "j")), alt(O1, ANNA, "Tisdag", { tid: nu() - 10 * 60 * 1000 })));
    await assertFails(setDoc(doc(som(ANNA), altvag(grupp, O1, "k")), alt(O1, ANNA, "Tisdag", { tid: String(nu()) })));
  });
  it("⛔ alternativ: ingen klient som agenten, ingen borttagen, ingen främling, ingen tredje person, och aldrig ändring eller radering", async () => {
    await assertFails(setDoc(doc(som(AGENT), altvag(grupp, O1, "l")), alt(O1, AGENT, "Onsdag")));
    await assertFails(setDoc(doc(som(DAVID), altvag(grupp, O1, "m")), alt(O1, DAVID, "Onsdag")));
    await assertFails(setDoc(doc(som(FRAMLING), altvag(grupp, O1, "n")), alt(O1, FRAMLING, "Onsdag")));
    await assertFails(setDoc(doc(som(CECILIA), altvag(annaBo, OP, "o")), alt(OP, CECILIA, "Kanske")));
    await assertFails(updateDoc(doc(som(CECILIA), altvag(grupp, O1, "a")), { text: "Fredag kväll" }));
    await assertFails(deleteDoc(doc(som(CECILIA), altvag(grupp, O1, "b"))));
  });
  it("⛔ alternativ och röster läses bara av den som får läsa samtalet", async () => {
    for (const u of [FRAMLING, DAVID]) {
      await assertFails(getDocs(collection(som(u), `samtal/${grupp}/omrostningsval`)));
      await assertFails(getDocs(collection(som(u), `samtal/${grupp}/omrostningsroster`)));
    }
    await assertFails(getDocs(collection(som(CECILIA), `samtal/${annaBo}/omrostningsval`)));
    await assertFails(getDocs(collection(som(CECILIA), `samtal/${annaBo}/omrostningsroster`)));
    await assertFails(getDocs(collection(utan(), `samtal/${grupp}/omrostningsroster`)));
    await assertSucceeds(getDocs(collection(som(CECILIA), `samtal/${grupp}/omrostningsroster`)));
  });
  it("en medlem röstar, byter röst och tar tillbaka den", async () => {
    await assertSucceeds(setDoc(doc(som(ANNA), rostvag(grupp, O1, ANNA)), rost(O1, ANNA, `${O1}|a`)));
    await assertSucceeds(updateDoc(doc(som(ANNA), rostvag(grupp, O1, ANNA)), { val: `${O1}|b`, tid: nu() }));
    await assertSucceeds(deleteDoc(doc(som(ANNA), rostvag(grupp, O1, ANNA))));
    await assertSucceeds(setDoc(doc(som(BO), rostvag(annaBo, OP, BO)), rost(OP, BO, `${OP}|a`)));
  });
  it("⛔ röst: som sig själv, nyckeln mid|uid, inga andra fält, och nu", async () => {
    await assertFails(setDoc(doc(som(ANNA), rostvag(grupp, O1, BO)), rost(O1, BO, `${O1}|b`)));
    await assertFails(setDoc(doc(som(ANNA), rostvag(grupp, O1, CECILIA)), rost(O1, ANNA, `${O1}|b`)));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/omrostningsroster/egen-nyckel`), rost(O1, ANNA, `${O1}|b`)));
    await assertFails(setDoc(doc(som(ANNA), rostvag(grupp, O1, ANNA)), rost(O1, ANNA, `${O1}|b`, { vikt: 2 })));
    await assertFails(setDoc(doc(som(ANNA), rostvag(grupp, O1, ANNA)), rost(O1, ANNA, `${O1}|b`, { tid: nu() - 10 * 60 * 1000 })));
  });
  it("⛔ röst: valet är ett alternativ som finns, i samma omröstning, och omröstningen finns", async () => {
    await assertFails(setDoc(doc(som(ANNA), rostvag(grupp, O1, ANNA)), rost(O1, ANNA, `${O1}|finns-inte`)));
    await assertFails(setDoc(doc(som(ANNA), rostvag(grupp, O1, ANNA)), rost(O1, ANNA, `${O2}|a`)));
    await assertFails(setDoc(doc(som(ANNA), rostvag(grupp, O1, ANNA)), rost(O1, ANNA, "a")));
    // Alternativet M1|a finns (skrivet förbi reglerna), men M1 är ingen omröstning.
    await assertFails(setDoc(doc(som(ANNA), rostvag(grupp, M1, ANNA)), rost(M1, ANNA, `${M1}|a`)));
  });
  it("⛔ röst: ett byte rör bara den egna, bara till ett alternativ i samma omröstning, och inga nya fält", async () => {
    await assertFails(updateDoc(doc(som(ANNA), rostvag(grupp, O1, BO)), { val: `${O1}|b`, tid: nu() }));
    await assertFails(updateDoc(doc(som(BO), rostvag(grupp, O1, BO)), { val: `${O2}|a`, tid: nu() }));
    await assertFails(updateDoc(doc(som(BO), rostvag(grupp, O1, BO)), { val: `${O1}|finns-inte`, tid: nu() }));
    await assertFails(updateDoc(doc(som(BO), rostvag(grupp, O1, BO)), { val: `${O1}|b`, tid: nu(), vikt: 2 }));
    await assertFails(updateDoc(doc(som(BO), rostvag(grupp, O1, BO)), { av: ANNA, tid: nu() }));
    await assertFails(updateDoc(doc(som(BO), rostvag(grupp, O1, BO)), { val: `${O1}|b`, tid: nu() - 10 * 60 * 1000 }));
    await assertSucceeds(updateDoc(doc(som(BO), rostvag(grupp, O1, BO)), { val: `${O1}|b`, tid: nu() }));
  });
  it("⛔ röst: ingen klient som agenten röstar eller byter, ingen tar bort någon annans, och den som lämnat tar inte bort sin gamla", async () => {
    await assertFails(setDoc(doc(som(AGENT), rostvag(grupp, O2, AGENT)), rost(O2, AGENT, `${O2}|a`)));
    await assertFails(updateDoc(doc(som(AGENT), rostvag(grupp, O1, AGENT)), { val: `${O1}|b`, tid: nu() }));
    await assertFails(deleteDoc(doc(som(ANNA), rostvag(grupp, O1, BO))));
    await assertFails(deleteDoc(doc(som(DAVID), rostvag(grupp, O1, DAVID))));
    await assertFails(setDoc(doc(som(FRAMLING), rostvag(grupp, O1, FRAMLING)), rost(O1, FRAMLING, `${O1}|a`)));
    await assertFails(setDoc(doc(som(CECILIA), rostvag(annaBo, OP, CECILIA)), rost(OP, CECILIA, `${OP}|a`)));
  });
});
