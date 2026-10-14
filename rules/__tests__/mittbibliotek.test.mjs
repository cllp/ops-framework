/**
 * Regelprov för Mitt bibliotek (0.101.0, lifehub.app#226).
 *
 * ⛔ PLATSEN ÄR `mitt~<uid>`, OCH BARA DEN INLOGGADE MED DET UID:T KOMMER IN. Proven nedan prövar varje gren regeln fick:
 *
 *   LÄSA     ägaren ja, hens lista ja. En annan person nej, en admin i en grupp nej, utloggad nej, en lista över någon
 *            annans plats nej.
 *   SKAPA    ägaren ja, med fil i sin egen sökväg ja. I någon annans plats nej, i sin plats men i någon annans namn nej,
 *            med en sökväg till en annan plats nej.
 *   ÄNDRA    ägaren ja. En annan person nej, flytta posten till en grupp nej, flytta en grupps post hit nej.
 *   RADERA   ägaren ja. En annan person nej, en admin i en grupp nej.
 *
 * Reglerna skrivs av `scripts/skriv-provregler.mjs` ur `bibliotekregelfragment("bibliotek")`.
 */

import { medlemskapsId } from "../../src/lib/grupp.js";
import { mittBibliotek } from "../../src/lib/bibliotek.js";
import { after, before, describe, it } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const AGARE = "uidKimMitt";
const ANNAN = "uidAnnanMitt";
const ADMIN = "uidAdminMitt";
/** Har en planterad medlemsrad vars groupId är Kims plats. Ingen kod skapar en sådan, men regeln får inte vila på det. */
const INKRAKT = "uidInkraktMitt";
const CPS = "cps-ab";
const MIN = mittBibliotek(AGARE);
const ANNANS = mittBibliotek(ANNAN);

const skapare = (uid) => ({ uid, namn: "Kim", typ: "manniska", kalla: "bibliotek" });
const ny = (extra = {}) => {
  const nu = Date.now();
  return { groupId: MIN, typ: "anteckning", rubrik: "Utkast", text: "Bara mitt.", skapadAv: skapare(AGARE), skapad: nu, andrad: nu, ...extra };
};
const nyFil = (postId, extra = {}) => {
  const { text: _t, ...utan } = ny();
  return { ...utan, typ: "fil", rubrik: "Kvitto", fil: { sokvag: `grupper/${MIN}/bibliotek/${postId}/kvitto.pdf`, namn: "kvitto.pdf", mime: "application/pdf", byte: 2000 }, ...extra };
};

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;

const som = (uid) => miljo.authenticatedContext(uid).firestore();

before(async () => {
  const regler = path.join(rot, "rules", "provregler.rules");
  if (!fs.existsSync(regler)) throw new Error("rules/provregler.rules saknas. Kör npm run regler:skriv först.");
  miljo = await initializeTestEnvironment({
    projectId: "regelprov-mitt",
    firestore: { rules: fs.readFileSync(regler, "utf8"), host: "127.0.0.1", port: 8080 },
  });
  await miljo.clearFirestore();
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `memberships/${medlemskapsId(ADMIN, CPS)}`), { userId: ADMIN, groupId: CPS, roll: "admin", typ: "person", status: "aktiv" });
    await setDoc(doc(db, `memberships/${medlemskapsId(AGARE, CPS)}`), { userId: AGARE, groupId: CPS, roll: "medlem", typ: "person", status: "aktiv" });
    await setDoc(doc(db, `memberships/${INKRAKT}|${MIN}`), { userId: INKRAKT, groupId: MIN, roll: "admin", typ: "person", status: "aktiv" });
    await setDoc(doc(db, "bibliotek/min-post"), ny());
    await setDoc(doc(db, "bibliotek/min-andra"), ny({ rubrik: "Andra" }));
    await setDoc(doc(db, "bibliotek/annans-post"), ny({ groupId: ANNANS, skapadAv: skapare(ANNAN) }));
    await setDoc(doc(db, "bibliotek/gruppens"), ny({ groupId: CPS }));
  });
});

after(async () => {
  await miljo?.cleanup();
});

describe("Mitt bibliotek: läsa", () => {
  it("ägaren läser sin post och sin lista", async () => {
    await assertSucceeds(getDoc(doc(som(AGARE), "bibliotek/min-post")));
    await assertSucceeds(getDocs(query(collection(som(AGARE), "bibliotek"), where("groupId", "==", MIN))));
  });
  it("en annan person läser inte, och inte listan", async () => {
    await assertFails(getDoc(doc(som(ANNAN), "bibliotek/min-post")));
    await assertFails(getDocs(query(collection(som(ANNAN), "bibliotek"), where("groupId", "==", MIN))));
  });
  it("en admin i en grupp läser inte", async () => {
    await assertFails(getDoc(doc(som(ADMIN), "bibliotek/min-post")));
  });
  it("ett medlemskap vars grupp är platsen öppnar den inte, varken för läsning, ändring eller radering", async () => {
    await assertFails(getDoc(doc(som(INKRAKT), "bibliotek/min-post")));
    await assertFails(updateDoc(doc(som(INKRAKT), "bibliotek/min-post"), { rubrik: "Kapat", andrad: Date.now() }));
    await assertFails(deleteDoc(doc(som(INKRAKT), "bibliotek/min-post")));
    await assertFails(setDoc(doc(som(INKRAKT), "bibliotek/planterad"), ny({ skapadAv: skapare(INKRAKT) })));
  });
  it("utloggad läser inte", async () => {
    await assertFails(getDoc(doc(miljo.unauthenticatedContext().firestore(), "bibliotek/min-post")));
  });
});

describe("Mitt bibliotek: skapa", () => {
  it("ägaren skapar en anteckning och en fil i sin egen sökväg", async () => {
    await assertSucceeds(setDoc(doc(som(AGARE), "bibliotek/ny-anteckning"), ny()));
    await assertSucceeds(setDoc(doc(som(AGARE), "bibliotek/ny-fil"), nyFil("ny-fil")));
  });
  it("ingen skapar i någon annans plats", async () => {
    await assertFails(setDoc(doc(som(AGARE), "bibliotek/intrang"), ny({ groupId: ANNANS })));
    await assertFails(setDoc(doc(som(ADMIN), "bibliotek/intrang2"), ny({ groupId: MIN, skapadAv: skapare(ADMIN) })));
  });
  it("ägaren skapar inte i någon annans namn i sin plats", async () => {
    await assertFails(setDoc(doc(som(AGARE), "bibliotek/falsk"), ny({ skapadAv: skapare(ANNAN) })));
  });
  it("en fil vars sökväg pekar på en annan plats nekas", async () => {
    const fel = nyFil("fel-vag", { fil: { sokvag: `grupper/${ANNANS}/bibliotek/fel-vag/kvitto.pdf`, namn: "kvitto.pdf", mime: "application/pdf", byte: 2000 } });
    await assertFails(setDoc(doc(som(AGARE), "bibliotek/fel-vag"), fel));
  });
});

describe("Mitt bibliotek: ändra", () => {
  it("ägaren ändrar sin post", async () => {
    await assertSucceeds(updateDoc(doc(som(AGARE), "bibliotek/min-post"), { rubrik: "Nytt namn", andrad: Date.now() }));
  });
  it("en annan person ändrar inte", async () => {
    await assertFails(updateDoc(doc(som(ANNAN), "bibliotek/min-post"), { rubrik: "Kapat", andrad: Date.now() }));
  });
  it("posten flyttas inte till en grupp genom en ändring", async () => {
    await assertFails(updateDoc(doc(som(AGARE), "bibliotek/min-post"), { groupId: CPS, andrad: Date.now() }));
  });
  it("en grupps post flyttas inte hit genom en ändring, inte ens av en admin", async () => {
    await assertFails(updateDoc(doc(som(ADMIN), "bibliotek/gruppens"), { groupId: mittBibliotek(ADMIN), andrad: Date.now() }));
  });
});

describe("Mitt bibliotek: radera", () => {
  it("en annan person och en admin i en grupp raderar inte", async () => {
    await assertFails(deleteDoc(doc(som(ANNAN), "bibliotek/min-andra")));
    await assertFails(deleteDoc(doc(som(ADMIN), "bibliotek/min-andra")));
  });
  it("ägaren raderar", async () => {
    await assertSucceeds(deleteDoc(doc(som(AGARE), "bibliotek/min-andra")));
  });
});
