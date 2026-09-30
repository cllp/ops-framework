/**
 * Regelprov för hantera kalendrar och händelsemodellen (0.37.0, #179 F2 och F3), mot Firestore-emulatorn.
 *
 * ══ ⛔ VAD SOM MÄTS ═══════════════════════════════════════════════════════════
 *
 *   SKRIVNINGAR GENOM RAMVERKETS EGEN KÄLLA (createKalenderkalla över createFirestoreSource)
 *     ägaren skapar och läser mina kalendrar                ja       <- röd mot 0.36.0: regeln krävde id på raden,
 *     ägaren sparar en post                                 ja          och adaptern tar id ur datan
 *     en annan läser mina kalendrar genom källan            nej
 *     admin byter förvald i gruppen (två rader, en batch)   ja
 *     medlem gör detsamma                                   nej
 *
 *   SVAR (handelser/{hid}/svar/{uid})
 *     medlem svarar själv på en händelse som kräver svar    ja
 *     medlem ändrar sitt svar                               ja
 *     medlem svarar åt en annan                             nej      <- "bara personen själv"
 *     svar på en händelse som inte kräver svar              nej
 *     svar på en händelse som inte finns                    nej
 *     medlem i en annan grupp svarar eller läser            nej      <- "bara gruppens medlemmar"
 *     medlem listar alla svar på händelsen                  ja
 *     okänt svar, okänt fält                                nej
 *     radering                                              nej
 *
 *   opsHandelsefaltGiltiga (i appens eget block, samlingen kalhandelser)
 *     utan kalenderId (den förvalda gäller)                 ja
 *     kalenderId en av gruppens kalendrar                   ja
 *     kalender som inte finns, annan grupps, arkiverad      nej
 *     kravSvar som inte är bool                             nej
 *     slutDatum samma dag, före, fel form                   nej
 *     slutDatum efter datum                                 ja
 *     uppdatera en händelse i en SEDAN arkiverad kalender   ja       <- kalendern prövas bara när den ändras
 *     byta till en arkiverad kalender                       nej
 *
 * Kör: npm run test:rules
 */

import { medlemskapsId } from "../../src/lib/grupp.js";
import { byggGruppkalender, gruppkalendernyckel, valjForvald } from "../../src/lib/kalendrar.js";
import { createFirestoreSource } from "../../src/data/firestore.js";
import { createKalenderkalla, createSvarskalla } from "../../src/data/kalenderkalla.js";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import * as sdk from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } = sdk;
const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const AGARE = "uid-kh-agare";
const ADMIN = "uid-kh-admin";
const MEDLEM = "uid-kh-medlem";
const ANNAN = "uid-kh-annan";
const G = "kh-ab";
const H = "kh-hb";

const utanId = (/** @type {Record<string, any>} */ { id: _id, ...r }) => r;
const gk = (/** @type {string} */ id, extra = {}) => byggGruppkalender({ id, namn: { sv: id }, farg: 3, ikon: "kalender", groupId: G, ...extra });

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
    const m = (/** @type {string} */ uid, /** @type {string} */ gid, /** @type {string} */ roll) =>
      setDoc(doc(db, `memberships/${medlemskapsId(uid, gid)}`), { userId: uid, groupId: gid, roll, typ: "person", status: "aktiv" });
    await m(AGARE, G, "agare");
    await m(ADMIN, G, "admin");
    await m(MEDLEM, G, "medlem");
    await m(ANNAN, H, "agare");
    await setDoc(doc(db, `gruppkalendrar/${gruppkalendernyckel(G, "styrelse")}`), utanId(gk("styrelse", { forvald: true })));
    await setDoc(doc(db, `gruppkalendrar/${gruppkalendernyckel(G, "resor")}`), utanId(gk("resor", { ordning: 10 })));
    await setDoc(doc(db, `gruppkalendrar/${gruppkalendernyckel(G, "gammal")}`), utanId(gk("gammal", { arkiverad: true })));
    await setDoc(doc(db, `gruppkalendrar/${gruppkalendernyckel(H, "hkal")}`), utanId(gk("hkal", { groupId: H })));
    await setDoc(doc(db, "handelser/m1"), { groupId: G, rubrik: "Styrelsemöte", kravSvar: true });
    await setDoc(doc(db, "handelser/m2"), { groupId: G, rubrik: "Fika" });
    await setDoc(doc(db, "handelser/m3"), { groupId: H, rubrik: "Annan grupp", kravSvar: true });
    await setDoc(doc(db, `handelser/m1/svar/${ADMIN}`), { svar: "kommerInte" });
    await setDoc(doc(db, "kalhandelser/i-gammal"), { groupId: G, datum: "2026-10-01", rubrik: "Före arkiveringen", kalenderId: "gammal" });
  });
});

after(async () => {
  if (miljo) await miljo.cleanup();
});

/** @param {string} uid */
const som = (uid) => miljo.authenticatedContext(uid).firestore();
/** @param {string} uid */
const kalla = (uid) => createKalenderkalla({ kalla: createFirestoreSource({ db: som(uid), sdk }) });
/** @param {string} uid */
const svarskalla = (uid) => createSvarskalla({ kalla: createFirestoreSource({ db: som(uid), sdk }) });

describe("⛔ skrivningar genom ramverkets egen källa (0.37.0: id på raden var en andra sanning)", () => {
  it("ägaren skapar och läser sina kalendrar genom källan", async () => {
    await assertSucceeds(kalla(AGARE).sparaMina(AGARE, [{ id: "privat", namn: "Privat", farg: 2, ikon: "hjarta", forvald: true }, { id: "resor", namn: "Resor", farg: 4, ikon: "kalender", ordning: 10 }]));
    const mina = await kalla(AGARE).mina(AGARE);
    assert.deepEqual(mina.map((k) => k.id), ["privat", "resor"]);
  });
  it("ägaren sparar en post genom källan", async () => {
    const mina = await kalla(AGARE).mina(AGARE);
    await assertSucceeds(kalla(AGARE).sparaPost(AGARE, { id: "tand", kalenderId: "privat", titel: "Tandläkaren", start: "2026-10-20T09:00", slut: "2026-10-20T10:00", blockerar: true }, mina));
  });
  it("⛔ en annan läser inte mina kalendrar genom källan", async () => {
    await assertFails(kalla(ANNAN).mina(AGARE));
  });
  it("admin byter förvald: två rader i en batch", async () => {
    const lista = await kalla(ADMIN).gruppens(G);
    await assertSucceeds(kalla(ADMIN).sparaGruppens(G, valjForvald(lista, "resor")));
    const efter = await kalla(MEDLEM).gruppens(G);
    assert.equal(efter.find((k) => k.forvald)?.id, "resor");
  });
  it("⛔ en medlem byter inte förvald", async () => {
    const lista = await kalla(MEDLEM).gruppens(G);
    await assertFails(kalla(MEDLEM).sparaGruppens(G, valjForvald(lista, "styrelse")));
  });
});

describe("svaren", () => {
  it("en medlem svarar själv, och ändrar sig", async () => {
    await assertSucceeds(svarskalla(MEDLEM).svara("m1", MEDLEM, "kommer"));
    await assertSucceeds(svarskalla(MEDLEM).svara("m1", MEDLEM, "kommerInte"));
  });
  it("⛔ ingen svarar åt en annan, inte heller ägaren", async () => {
    await assertFails(setDoc(doc(som(AGARE), `handelser/m1/svar/${MEDLEM}`), { svar: "kommer" }));
  });
  it("⛔ inget svar på en händelse som inte kräver svar, eller som inte finns", async () => {
    await assertFails(setDoc(doc(som(MEDLEM), `handelser/m2/svar/${MEDLEM}`), { svar: "kommer" }));
    await assertFails(setDoc(doc(som(MEDLEM), `handelser/saknas/svar/${MEDLEM}`), { svar: "kommer" }));
  });
  it("⛔ en medlem i en annan grupp svarar inte och läser inte", async () => {
    await assertFails(setDoc(doc(som(ANNAN), `handelser/m1/svar/${ANNAN}`), { svar: "kommer" }));
    await assertFails(getDocs(collection(som(ANNAN), "handelser/m1/svar")));
    await assertFails(getDoc(doc(som(ANNAN), `handelser/m1/svar/${ADMIN}`)));
  });
  it("en medlem läser alla svar på händelsen, och sammanställningen går att räkna", async () => {
    const rader = await assertSucceeds(svarskalla(MEDLEM).lista("m1"));
    assert.deepEqual(rader.map((r) => [r.id, r.svar]).sort(), [[ADMIN, "kommerInte"], [MEDLEM, "kommerInte"]]);
  });
  it("⛔ okänt svar och okänt fält avvisas", async () => {
    await assertFails(setDoc(doc(som(AGARE), `handelser/m1/svar/${AGARE}`), { svar: "kanske" }));
    await assertFails(setDoc(doc(som(AGARE), `handelser/m1/svar/${AGARE}`), { svar: "kommer", uid: AGARE }));
  });
  it("⛔ ett svar raderas aldrig", async () => {
    await assertFails(deleteDoc(doc(som(ADMIN), `handelser/m1/svar/${ADMIN}`)));
  });
});

describe("opsHandelsefaltGiltiga i appens block", () => {
  const h = (/** @type {Record<string, unknown>} */ extra = {}) => ({ groupId: G, datum: "2026-10-12", rubrik: "Möte", ...extra });
  it("utan kalenderId (den förvalda gäller) och med en av gruppens kalendrar", async () => {
    await assertSucceeds(setDoc(doc(som(MEDLEM), "kalhandelser/a"), h()));
    await assertSucceeds(setDoc(doc(som(MEDLEM), "kalhandelser/b"), h({ kalenderId: "resor", kravSvar: true })));
  });
  it("⛔ en kalender som inte finns, en annan grupps, eller en arkiverad avvisas", async () => {
    await assertFails(setDoc(doc(som(MEDLEM), "kalhandelser/c"), h({ kalenderId: "saknas" })));
    await assertFails(setDoc(doc(som(MEDLEM), "kalhandelser/d"), h({ kalenderId: "hkal" })));
    await assertFails(setDoc(doc(som(MEDLEM), "kalhandelser/e"), h({ kalenderId: "gammal" })));
  });
  it("⛔ kravSvar som inte är bool avvisas", async () => {
    await assertFails(setDoc(doc(som(MEDLEM), "kalhandelser/f"), h({ kravSvar: "ja" })));
  });
  it("⛔ slutDatum samma dag, före eller i fel form avvisas, och efter datum släpps in", async () => {
    await assertFails(setDoc(doc(som(MEDLEM), "kalhandelser/g"), h({ slutDatum: "2026-10-12" })));
    await assertFails(setDoc(doc(som(MEDLEM), "kalhandelser/g"), h({ slutDatum: "2026-10-11" })));
    await assertFails(setDoc(doc(som(MEDLEM), "kalhandelser/g"), h({ slutDatum: "12 okt" })));
    // ⛔ Mutationsfynd: "12 okt" sorterar FÖRE datumet och faller redan på jämförelsen, så formen mättes inte. Månad 13
    // sorterar efter och har fel form.
    await assertFails(setDoc(doc(som(MEDLEM), "kalhandelser/g"), h({ slutDatum: "2026-13-01" })));
    await assertSucceeds(setDoc(doc(som(MEDLEM), "kalhandelser/g"), h({ slutDatum: "2026-10-14" })));
  });
  it("⛔ en händelse i en kalender som arkiverats efteråt går att uppdatera, men man byter inte till en arkiverad", async () => {
    await assertSucceeds(updateDoc(doc(som(MEDLEM), "kalhandelser/i-gammal"), { rubrik: "Rättad rubrik" }));
    await assertFails(updateDoc(doc(som(MEDLEM), "kalhandelser/a"), { kalenderId: "gammal" }));
  });
});
