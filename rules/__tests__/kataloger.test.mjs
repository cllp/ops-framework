/**
 * Regelprov för katalogens regelfragment (#162), mot Firestore-emulatorn.
 *
 * ══ ⛔ VAD SOM MÄTS, OCH VARFÖR JUST DET ══════════════════════════════
 *
 * Klarkriteriet i #162, ordagrant: "Två grupper i emulatorn har olika
 * händelsetyper, och en medlem i den ena kan varken läsa eller skriva den
 * andras. Prov i båda riktningarna." Matrisen:
 *
 *   medlem läser sin grupps kategori           ja
 *   medlem läser en ANNAN grupps kategori      nej      <- hela poängen
 *   avslutad medlem läser                      nej
 *   utan inloggning                            nej
 *   ägare skriver en kategori i sin grupp      ja
 *   medlem skriver (lägger till/ändrar)        nej      <- katalogen är gruppens KONFIG
 *   ägare skriver i en ANNAN grupp             nej
 *   flytta en kategori till en annan grupp     nej
 *   skapa en kategori utan groupId             nej
 *   ägaren raderar en kategori                 nej      <- arkivering, aldrig radering
 *   ett fält utanför KATEGORIFALT              nej      <- hasOnly
 *
 * `rules/provregler.rules` skrivs av `scripts/skriv-provregler.mjs` ur
 * `katalogregelfragment("kataloger")`, precis innan emulatorn startar. Provas
 * en handskriven kopia bevisar det bara att någon skrev rätt en gång.
 *
 * Kör: npm run test:rules
 */

import { medlemskapsId } from "../../src/lib/grupp.js";
import { after, before, describe, it } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const CPS_AGARE = "uid-cps-agare";
const CPS_MEDLEM = "uid-cps-medlem";
const CPS_AVSLUTAD = "uid-cps-avslutad";
const MIRANDA_AGARE = "uid-miranda-agare";

const CPS_AB = "cps-ab";
const MIRANDA_AB = "miranda-ab";

/** En giltig katalograd, som alla mutationer nedan varieras ifrån. */
const kategori = (extra = {}) => ({
  id: "rep",
  namn: { sv: "Repetition" },
  farg: 1,
  ikon: "check",
  fas: "aktiv",
  ordning: 0,
  arkiverad: false,
  texter: {},
  groupId: CPS_AB,
  ...extra,
});

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

  // ⛔ UNDERLAGET SKRIVS MED REGLERNA AVSTÄNGDA, samma skäl som grupper.test.mjs:
  // proven ska inte bero på att skrivreglerna redan är rätt.
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `memberships/${medlemskapsId(CPS_AGARE, CPS_AB)}`), { userId: CPS_AGARE, groupId: CPS_AB, roll: "agare", typ: "person", status: "aktiv" });
    await setDoc(doc(db, `memberships/${medlemskapsId(CPS_MEDLEM, CPS_AB)}`), { userId: CPS_MEDLEM, groupId: CPS_AB, roll: "medlem", typ: "person", status: "aktiv" });
    await setDoc(doc(db, `memberships/${medlemskapsId(CPS_AVSLUTAD, CPS_AB)}`), { userId: CPS_AVSLUTAD, groupId: CPS_AB, roll: "medlem", typ: "person", status: "avslutad" });
    await setDoc(doc(db, `memberships/${medlemskapsId(MIRANDA_AGARE, MIRANDA_AB)}`), { userId: MIRANDA_AGARE, groupId: MIRANDA_AB, roll: "agare", typ: "person", status: "aktiv" });

    // ⛔ TVÅ GRUPPER, OLIKA "HÄNDELSETYPER" (kategorier), SAMMA MASKINNYCKEL
    // "rep". Det är precis det scenariot #162 ska stoppa: gemensam katalog =
    // miranda ab ser cps ab:s kategorier i sin rullgardin.
    await setDoc(doc(db, "kataloger/cps-rep"), kategori({ groupId: CPS_AB }));
    await setDoc(doc(db, "kataloger/miranda-rep"), kategori({ groupId: MIRANDA_AB, namn: { sv: "Répétition (miranda)" } }));
  });
});

after(async () => {
  if (miljo) await miljo.cleanup();
});

/** @param {string} uid */
const som = (uid) => miljo.authenticatedContext(uid).firestore();
const utanInloggning = () => miljo.unauthenticatedContext().firestore();

describe("⛔ katalogen (#162): medlemskap i radens grupp avgör, båda riktningar", () => {
  it("en medlem läser sin grupps kategori", async () => {
    await assertSucceeds(getDoc(doc(som(CPS_MEDLEM), "kataloger/cps-rep")));
  });

  it("⛔ en medlem läser INTE en annan grupps kategori, trots samma maskinnyckel", async () => {
    // ⛔ Det här är hela poängen med #162: "rep" finns i BÅDA grupperna, som
    // olika dokument. En läcka här hade betytt att miranda ab:s kategori,
    // eller dess NAMN, syns för cps ab:s medlem.
    await assertFails(getDoc(doc(som(CPS_MEDLEM), "kataloger/miranda-rep")));
  });

  it("⛔ och tvärtom: miranda ab:s ägare läser inte cps ab:s kategori", async () => {
    await assertFails(getDoc(doc(som(MIRANDA_AGARE), "kataloger/cps-rep")));
  });

  it("en avslutad medlem läser inte, trots att raden finns", async () => {
    await assertFails(getDoc(doc(som(CPS_AVSLUTAD), "kataloger/cps-rep")));
  });

  it("utan inloggning läser ingen", async () => {
    await assertFails(getDoc(doc(utanInloggning(), "kataloger/cps-rep")));
  });
});

describe("⛔ katalogen är gruppens KONFIG: ägaren skriver, medlemmen inte", () => {
  it("ägaren lägger till en kategori i sin egen grupp", async () => {
    await assertSucceeds(setDoc(doc(som(CPS_AGARE), "kataloger/cps-ny"), kategori({ id: "ny", groupId: CPS_AB })));
  });

  it("⛔ en medlem lägger inte till en kategori, inställningsvyn är ägarens", async () => {
    await assertFails(setDoc(doc(som(CPS_MEDLEM), "kataloger/cps-medlemsforsok"), kategori({ id: "medlemsforsok", groupId: CPS_AB })));
  });

  it("⛔ en medlem ändrar inte heller en befintlig kategori (t.ex. arkiverar den)", async () => {
    await assertFails(updateDoc(doc(som(CPS_MEDLEM), "kataloger/cps-rep"), { arkiverad: true }));
  });

  it("⛔ en ägare skriver inte i en ANNAN grupps katalog", async () => {
    await assertFails(setDoc(doc(som(CPS_AGARE), "kataloger/kapad"), kategori({ id: "kapad", groupId: MIRANDA_AB })));
  });

  it("⛔ en kategori kan inte FLYTTAS till en annan grupp", async () => {
    await assertFails(updateDoc(doc(som(CPS_AGARE), "kataloger/cps-rep"), { groupId: MIRANDA_AB }));
  });

  it("⛔ en kategori kan inte skapas utan groupId", async () => {
    const utanGrupp = kategori({ id: "hemlos" });
    delete utanGrupp.groupId;
    await assertFails(setDoc(doc(som(CPS_AGARE), "kataloger/hemlos"), utanGrupp));
  });

  it("⛔ ägaren raderar inte en kategori, den arkiveras", async () => {
    await assertFails(deleteDoc(doc(som(CPS_AGARE), "kataloger/cps-rep")));
  });

  it("ägaren ARKIVERAR en kategori i sin egen grupp, det är den ångrbara vägen", async () => {
    await assertSucceeds(updateDoc(doc(som(CPS_AGARE), "kataloger/cps-rep"), { arkiverad: true }));
  });

  it("⛔ ett fält utanför KATEGORIFALT avvisas av hasOnly", async () => {
    await assertFails(setDoc(doc(som(CPS_AGARE), "kataloger/med-okant-falt"), kategori({ id: "med-okant-falt", lofte: "Ett fält som inte finns i schemat." })));
  });
});
