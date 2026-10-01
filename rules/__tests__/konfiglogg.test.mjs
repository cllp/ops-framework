/**
 * Regelprov för ändringsloggens regelfragment (0.39.0, #188), mot Firestore-emulatorn.
 *
 * ══ ⛔ HÄNDELSEN, OCH VAD SOM MÄTS ═══════════════════════════════════════
 *
 * cllp/bolag-ops steg 4, 2026-09-30: en admin i en ANNAN grupp än appens sparade en kategori. Katalograden skrevs
 * (katalogens regel slår upp radens grupp), men loggraden nekades: loggraden bar ingen grupp, så appens handskrivna
 * regel kunde bara fråga efter appens grupp. Katalogen ändrad, spåret utebliven, och inget visade det.
 *
 * Matrisen, med två grupper (cps-ab och miranda-ab) som i kataloger.test.mjs:
 *
 *   admin i B sparar en kategori i B OCH loggraden skrivs      ja       <- #188, genom den riktiga skrivaren
 *   ägare i B skriver loggraden                                 ja
 *   admin i A skriver en loggrad som tillhör B                  nej
 *   medlem (inte admin) skriver                                 nej
 *   avslutad admin skriver                                      nej
 *   utan medlemskap eller inloggning skriver                    nej
 *   rad utan groupId                                            nej
 *   fält utanför KONFIGLOGGFALT / okänd händelse                nej
 *   medlem i B läser B:s logg                                   ja
 *   medlem i A läser B:s logg (rad och fråga)                   nej      <- gruppgränsen
 *   fråga utan groupId                                          nej
 *   ändra eller radera en skriven rad, också som admin          nej
 *
 * `rules/provregler.rules` skrivs av `scripts/skriv-provregler.mjs` ur `konfigloggregelfragment("konfiglogg")`.
 *
 * Kör: npm run test:rules
 */

import { medlemskapsId } from "../../src/lib/grupp.js";
import { createFirestoreSource } from "../../src/data/firestore.js";
import { byggKonfigandring, createConfigLog } from "../../src/lib/konfiglogg.js";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import * as firestoreSdk from "firebase/firestore";
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, deleteDoc, where } from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const A_ADMIN = "uid-a-admin";
const A_MEDLEM = "uid-a-medlem";
const B_ADMIN = "uid-b-admin";
const B_AGARE = "uid-b-agare";
const B_MEDLEM = "uid-b-medlem";
const B_AVSLUTAD_ADMIN = "uid-b-avslutad-admin";
const UTANFOR = "uid-utan-medlemskap";

const A = "cps-ab";
const B = "miranda-ab";

const NU = () => "2026-09-30T10:00:00.000Z";
const KATEGORI = (groupId, extra = {}) => ({
  id: "uppgift",
  namn: { sv: "Uppgifter" },
  farg: 1,
  ikon: "check",
  fas: "aktiv",
  ordning: 0,
  arkiverad: false,
  texter: {},
  groupId,
  ...extra,
});

/** En giltig loggrad, byggd av den riktiga byggaren så provet följer modellen och inte en kopia av den. */
const egen = (uid) => ({ uid, namn: "Provet", typ: "manniska", kalla: "SettingsView" });
const loggrad = (groupId, extra = {}) =>
  byggKonfigandring({ handelse: "tillagd", groupId, id: "uppgift", efter: { id: "uppgift", namn: { sv: "Uppgifter" } }, av: { uid: "u", namn: "T" }, nu: NU, ...extra });

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;

before(async () => {
  const regler = path.join(rot, "rules", "provregler.rules");
  if (!fs.existsSync(regler)) {
    throw new Error("rules/provregler.rules saknas. Kör npm run regler:skriv först, eller npm run test:rules som gör det åt dig.");
  }
  miljo = await initializeTestEnvironment({
    projectId: "regelprov",
    firestore: { rules: fs.readFileSync(regler, "utf8"), host: "127.0.0.1", port: 8080 },
  });

  // ⛔ UNDERLAGET SKRIVS MED REGLERNA AVSTÄNGDA: proven ska inte bero på att skrivreglerna redan är rätt.
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const medlem = (uid, gid, roll, status = "aktiv") =>
      setDoc(doc(db, `memberships/${medlemskapsId(uid, gid)}`), { userId: uid, groupId: gid, roll, typ: "person", status });
    await medlem(A_ADMIN, A, "admin");
    await medlem(A_MEDLEM, A, "medlem");
    await medlem(B_ADMIN, B, "admin");
    await medlem(B_AGARE, B, "agare");
    await medlem(B_MEDLEM, B, "medlem");
    await medlem(B_AVSLUTAD_ADMIN, B, "admin", "avslutad");

    // Två grupper, en loggrad var, för läsproven.
    await setDoc(doc(db, "konfiglogg/rad-a"), loggrad(A));
    await setDoc(doc(db, "konfiglogg/rad-b"), loggrad(B));
  });
});

after(async () => {
  if (miljo) await miljo.cleanup();
});

/** @param {string} uid */
const som = (uid) => miljo.authenticatedContext(uid).firestore();
const utanInloggning = () => miljo.unauthenticatedContext().firestore();

describe("⛔ #188: en admin i en ANNAN grupp får både katalogen och loggraden skriven", () => {
  it("admin i B sparar en kategori i B och skriver loggraden genom den riktiga skrivaren", async () => {
    // Katalogens block i den här filen finns inte (det provas i kataloger.test.mjs), så sparningen här är loggradens
    // hälft: samma anrop som appen gör, createConfigLog.skriv, mot den inloggade adminens databas.
    const kalla = createFirestoreSource({ db: som(B_ADMIN), sdk: firestoreSdk });
    const logg = createConfigLog({ append: (rad) => kalla.create("konfiglogg", rad), nu: NU });

    const svar = await logg.skriv({ handelse: "tillagd", groupId: B, id: "ny", efter: KATEGORI(B, { id: "ny" }), av: { uid: B_ADMIN, namn: "B-admin" } });
    assert.equal(svar.ok, true, `skrivaren svarade ${svar.orsak}: ${svar.fel?.message}`);
    assert.equal(svar.orsak, null);
  });

  it("⛔ TVÅ ändringar av SAMMA kategori ger två rader, och samma kategori i två grupper ger en rad var", async () => {
    // Datakällan tolkar fältet `id` som dokumentets nyckel (setDoc) och tar bort det ur datan. Loggradens `id` är
    // KATEGORINS id, så utan ett eget dokument-id blir loggens andra rad för samma kategori en uppdatering av den
    // första, och uppdateringar är stängda: loggraden nekas tyst. Provet går genom den riktiga datakällan av just det skälet.
    const kallaB = createFirestoreSource({ db: som(B_ADMIN), sdk: firestoreSdk });
    const loggB = createConfigLog({ append: (rad) => kallaB.create("konfiglogg", rad), nu: NU });
    const kallaA = createFirestoreSource({ db: som(A_ADMIN), sdk: firestoreSdk });
    const loggA = createConfigLog({ append: (rad) => kallaA.create("konfiglogg", rad), nu: NU });

    const forsta = await loggB.skriv({ handelse: "tillagd", groupId: B, id: "dubbel", efter: KATEGORI(B, { id: "dubbel" }), av: egen(B_ADMIN) });
    const andra = await loggB.skriv({ handelse: "andrad", groupId: B, id: "dubbel", fore: KATEGORI(B, { id: "dubbel" }), efter: KATEGORI(B, { id: "dubbel", ordning: 1 }), av: egen(B_ADMIN) });
    const iA = await loggA.skriv({ handelse: "tillagd", groupId: A, id: "dubbel", efter: KATEGORI(A, { id: "dubbel" }), av: egen(A_ADMIN) });
    assert.equal(forsta.ok, true, `första: ${forsta.fel?.message}`);
    assert.equal(andra.ok, true, `andra: ${andra.fel?.message}`);
    assert.equal(iA.ok, true, `samma kategori-id i grupp A: ${iA.fel?.message}`);

    const rader = await assertSucceeds(getDocs(query(collection(som(B_ADMIN), "konfiglogg"), where("groupId", "==", B), where("kategori", "==", "dubbel"))));
    assert.equal(rader.size, 2, "golv: båda ändringarna finns som egna rader, och grupp A:s rad är inte med");
  });

  it("ägaren i B skriver också", async () => {
    await assertSucceeds(setDoc(doc(som(B_AGARE), "konfiglogg/agarens"), loggrad(B, { av: egen(B_AGARE) })));
  });

  it("⛔ skrivaren svarar `skrivning` och inte ok när regeln nekar, så ett nej syns i stället för att försvinna (regel 5)", async () => {
    const kalla = createFirestoreSource({ db: som(B_MEDLEM), sdk: firestoreSdk });
    const logg = createConfigLog({ append: (rad) => kalla.create("konfiglogg", rad), nu: NU });
    const svar = await logg.skriv({ handelse: "tillagd", groupId: B, id: "nej", efter: {}, av: egen(B_MEDLEM) });
    assert.equal(svar.ok, false);
    assert.equal(svar.orsak, "skrivning");
    assert.match(String(svar.fel?.message), /permission/i);
  });
});

describe("⛔ vem som får SKRIVA en loggrad", () => {
  it("⛔ admin i A skriver inte en loggrad som tillhör B", async () => {
    await assertFails(setDoc(doc(som(A_ADMIN), "konfiglogg/kapad"), loggrad(B, { av: egen(A_ADMIN) })));
  });

  it("⛔ och tvärtom: admin i B skriver inte en rad som tillhör A", async () => {
    await assertFails(setDoc(doc(som(B_ADMIN), "konfiglogg/kapad2"), loggrad(A, { av: egen(B_ADMIN) })));
  });

  it("⛔ en medlem som inte är admin skriver inte, loggen följer katalogens skrivrätt", async () => {
    await assertFails(setDoc(doc(som(B_MEDLEM), "konfiglogg/medlemmens"), loggrad(B, { av: egen(B_MEDLEM) })));
  });

  it("⛔ en avslutad admin skriver inte", async () => {
    await assertFails(setDoc(doc(som(B_AVSLUTAD_ADMIN), "konfiglogg/avslutad"), loggrad(B, { av: egen(B_AVSLUTAD_ADMIN) })));
  });

  it("⛔ den utan medlemskap och den utan inloggning skriver inte", async () => {
    await assertFails(setDoc(doc(som(UTANFOR), "konfiglogg/utanfor"), loggrad(B, { av: egen(UTANFOR) })));
    await assertFails(setDoc(doc(utanInloggning(), "konfiglogg/anonym"), loggrad(B, { av: egen(B_ADMIN) })));
  });

  it("⛔ en rad utan groupId skapas inte, inte ens av en admin", async () => {
    const utanGrupp = loggrad(B, { av: egen(B_ADMIN) });
    delete utanGrupp.groupId;
    await assertFails(setDoc(doc(som(B_ADMIN), "konfiglogg/hemlos"), utanGrupp));
  });

  it("⛔ #211: en admin skriver inte en rad i någon annans namn", async () => {
    // Samma grupp, rätt roll, men `av.uid` är en annan person: raden skulle påstå att A_MEDLEM ändrade katalogen.
    await assertFails(setDoc(doc(som(B_ADMIN), "konfiglogg/falskt-namn"), loggrad(B, { av: { uid: B_MEDLEM, namn: "Någon annan", typ: "manniska", kalla: "SettingsView" } })));
    // Och ägaren i samma grupp som låtsas vara adminen.
    await assertFails(setDoc(doc(som(B_AGARE), "konfiglogg/falskt-namn-2"), loggrad(B, { av: { uid: B_ADMIN, namn: "B-admin" } })));
  });

  it("#211: en admin skriver i eget namn, med skaparens fulla form (uid, namn, typ, kalla)", async () => {
    await assertSucceeds(setDoc(doc(som(B_ADMIN), "konfiglogg/eget-namn"), loggrad(B, { av: { uid: B_ADMIN, namn: "B-admin", typ: "manniska", kalla: "SettingsView" } })));
  });

  it("⛔ #211: en rad utan `av`, med `av: null` eller med `av` utan uid skapas inte", async () => {
    // Beslutet: `av` är obligatoriskt i en rad som människor skriver. Loggen säger vem som ändrade, och en rad som inte
    // kan peka ut någon är en notis. byggKonfigandring skriver `av: null` när anroparen glömmer det, och det nekas nu.
    const utanAv = loggrad(B);
    delete utanAv.av;
    await assertFails(setDoc(doc(som(B_ADMIN), "konfiglogg/utan-av"), utanAv));
    await assertFails(setDoc(doc(som(B_ADMIN), "konfiglogg/av-null"), loggrad(B, { av: null })));
    await assertFails(setDoc(doc(som(B_ADMIN), "konfiglogg/av-utan-uid"), loggrad(B, { av: { namn: "B-admin", typ: "manniska" } })));
    await assertFails(setDoc(doc(som(B_ADMIN), "konfiglogg/av-text"), loggrad(B, { av: B_ADMIN })));
  });

  it("⛔ #211: genom den riktiga skrivaren: egen stämpel går, en annans stämpel nekas som `skrivning`", async () => {
    const kalla = createFirestoreSource({ db: som(B_ADMIN), sdk: firestoreSdk });
    const logg = createConfigLog({ append: (rad) => kalla.create("konfiglogg", rad), nu: NU });
    const egen = await logg.skriv({ handelse: "tillagd", groupId: B, id: "stampel", efter: {}, av: { uid: B_ADMIN, namn: "B-admin", typ: "manniska", kalla: "SettingsView" } });
    assert.equal(egen.ok, true, `egen stämpel: ${egen.fel?.message}`);
    const annans = await logg.skriv({ handelse: "tillagd", groupId: B, id: "stampel", efter: {}, av: { uid: B_MEDLEM, namn: "x", typ: "manniska", kalla: "SettingsView" } });
    assert.equal(annans.ok, false);
    assert.equal(annans.orsak, "skrivning");
  });

  it("⛔ ett fält utanför KONFIGLOGGFALT avvisas av hasOnly", async () => {
    await assertFails(setDoc(doc(som(B_ADMIN), "konfiglogg/okant"), { ...loggrad(B, { av: egen(B_ADMIN) }), lofte: "finns inte i schemat" }));
  });

  it("⛔ en okänd händelse avvisas", async () => {
    await assertFails(setDoc(doc(som(B_ADMIN), "konfiglogg/raderad"), { ...loggrad(B, { av: egen(B_ADMIN) }), handelse: "raderad" }));
  });
});

describe("⛔ vem som får LÄSA, och att gruppgränsen håller", () => {
  it("en medlem i B läser B:s logg, rad och fråga, och golv: minst en rad lästes", async () => {
    await assertSucceeds(getDoc(doc(som(B_MEDLEM), "konfiglogg/rad-b")));
    const svar = await assertSucceeds(getDocs(query(collection(som(B_MEDLEM), "konfiglogg"), where("groupId", "==", B))));
    assert.ok(svar.docs.length >= 1, "golv: minst en loggrad lästes");
    assert.ok(svar.docs.every((d) => d.data().groupId === B));
  });

  it("⛔ en medlem i A läser INTE B:s logg, varken som rad eller som fråga", async () => {
    await assertFails(getDoc(doc(som(A_MEDLEM), "konfiglogg/rad-b")));
    await assertFails(getDocs(query(collection(som(A_MEDLEM), "konfiglogg"), where("groupId", "==", B))));
  });

  it("⛔ och en admin i A läser inte heller B:s logg", async () => {
    await assertFails(getDoc(doc(som(A_ADMIN), "konfiglogg/rad-b")));
  });

  it("⛔ en fråga utan groupId, alltså hela samlingen, nekas också den som är medlem", async () => {
    // Därför måste appens läsning filtrera på den aktiva gruppen innan reglerna deployas.
    await assertFails(getDocs(collection(som(B_ADMIN), "konfiglogg")));
  });

  it("⛔ utan inloggning och utan medlemskap läser ingen", async () => {
    await assertFails(getDoc(doc(utanInloggning(), "konfiglogg/rad-b")));
    await assertFails(getDoc(doc(som(UTANFOR), "konfiglogg/rad-b")));
  });
});

describe("⛔ en skriven rad går inte att ändra eller radera", () => {
  it("admin i raden grupp ändrar inte en rad", async () => {
    await assertFails(updateDoc(doc(som(B_ADMIN), "konfiglogg/rad-b"), { id: "omskriven" }));
  });

  it("ägaren raderar inte en rad", async () => {
    await assertFails(deleteDoc(doc(som(B_AGARE), "konfiglogg/rad-b")));
  });
});
