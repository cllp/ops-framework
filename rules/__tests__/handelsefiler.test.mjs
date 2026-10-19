/**
 * Regelprov för en händelses filer (0.121.0, lifehub.app#366, docs/beslut/0006).
 *
 * ⛔ PLATSEN ÄR `handelse~<grupp>~<händelse>`, och behörigheten är gruppens medlemskap, tolkat ur platsen. Proven prövar varje villkor regeln fick,
 * var och ett så att det går att se falla (regel 4): grönt med regeln, rött när villkoret tas bort (mutationskörningen står i PR-texten).
 *
 *   LÄSA     aktiv medlem i gruppen ja, hela listan ja. Utomstående nej, medlem i en annan grupp nej, avslutad medlem nej. En påhittad plats
 *            (händelsen ligger i en annan grupp) nej, för båda gruppernas medlemmar. En plats vars händelse inte finns nej. En plats med fel form nej.
 *   SKAPA    aktiv medlem som person, som sig själv, en fil i platsens egen sökväg. Utomstående, en annan grupps medlem, avslutad medlem, agent,
 *            påhittad plats, saknad händelse, anteckning, länk, falskt namn och fel sökväg nej.
 *   ÄNDRA    författaren och admin ja, en annan medlem nej, att flytta posten till en annan plats nej.
 *   RADERA   författaren sin egen, admin och ägare alla. En annan medlem, utomstående och en annan grupps medlem nej.
 *   LAGRING  samma medlemskap, posten måste finnas med samma plats, ingen klient raderar.
 *
 * Reglerna skrivs av `scripts/skriv-provregler.mjs` ur `bibliotekregelfragment("bibliotek", { handelser: "handelser" })` och
 * `lagringsregelfragment({ bibliotek: { ..., handelsefiler: true } })`.
 *
 * ⛔ PROJEKTET ÄR `regelprov`, inte ett eget. Storage-emulatorn slår upp medlemskapet och posten i Firestore-emulatorns projekt, och ett prov med
 * ett annat projekt-id ser dem inte: alla uppladdningar nekas, också de som ska gå igenom. Samma id som `lagring-bibliotek.test.mjs`.
 *
 * ⛔ GOLV: minst 12 utfall som släpptes igenom och minst 30 som nekades mäts, och provet nedan blir rött annars. Ett prov som nekar allt
 * för att ingenting är utlagt är grönt av fel skäl.
 */

import { medlemskapsId } from "../../src/lib/grupp.js";
import { handelseBibliotek } from "../../src/lib/bibliotek.js";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, deleteDoc as raderaDok, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const AGARE = "uidAgareHf";
const ADMIN = "uidAdminHf";
const MEDLEM1 = "uidMedlem1Hf";
const MEDLEM2 = "uidMedlem2Hf";
const AVSLUTAD = "uidAvslutadHf";
const AGENT = "uidAgentHf";
const GRANNE = "uidGranneHf";
const UTOMSTAENDE = "uidUtomstaendeHf";
const CPS = "cps-ab";
const ANDRA = "andra-ab";

const P1 = handelseBibliotek(CPS, "h1");
const P2 = handelseBibliotek(ANDRA, "h2");
/** Händelse h2 ligger i ANDRA, men platsen säger CPS. Ingen klient kan skapa den, och ingen ska heller kunna läsa den. */
const PFEL = handelseBibliotek(CPS, "h2");
const PSAKNAS = handelseBibliotek(CPS, "borta");

const räknare = { ok: 0, nej: 0 };
const lyckas = (p) => {
  räknare.ok += 1;
  return assertSucceeds(p);
};
const nekas = (p) => {
  räknare.nej += 1;
  return assertFails(p);
};

const skapare = (uid) => ({ uid, namn: "Kim", typ: "manniska", kalla: "bibliotek" });
const fil = (plats, uid, id, extra = {}) => {
  const nu = Date.now();
  return {
    groupId: plats,
    typ: "fil",
    rubrik: "Biljett",
    fil: { sokvag: `grupper/${plats}/bibliotek/${id}/biljett.pdf`, namn: "biljett.pdf", mime: "application/pdf", byte: 4 },
    skapadAv: skapare(uid),
    skapad: nu,
    andrad: nu,
    ...extra,
  };
};
const BYTE = new Uint8Array([37, 80, 68, 70]);
const PDF = { contentType: "application/pdf" };

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;
const som = (uid) => miljo.authenticatedContext(uid).firestore();
const lagringSom = (uid) => miljo.authenticatedContext(uid).storage();

before(async () => {
  const regler = path.join(rot, "rules", "provregler.rules");
  const lagringsregler = path.join(rot, "rules", "provlagring.rules");
  if (!fs.existsSync(regler) || !fs.existsSync(lagringsregler)) throw new Error("Provreglerna saknas. Kör npm run regler:skriv först.");
  miljo = await initializeTestEnvironment({
    projectId: "regelprov",
    firestore: { rules: fs.readFileSync(regler, "utf8"), host: "127.0.0.1", port: 8080 },
    storage: { rules: fs.readFileSync(lagringsregler, "utf8"), host: "127.0.0.1", port: 9199 },
  });
  await miljo.clearFirestore();
  await miljo.clearStorage();
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const medlem = (uid, gid, extra = {}) =>
      setDoc(doc(db, `memberships/${medlemskapsId(uid, gid)}`), { userId: uid, groupId: gid, roll: "medlem", typ: "person", status: "aktiv", ...extra });
    await medlem(AGARE, CPS, { roll: "agare" });
    await medlem(ADMIN, CPS, { roll: "admin" });
    await medlem(MEDLEM1, CPS);
    await medlem(MEDLEM2, CPS);
    await medlem(AVSLUTAD, CPS, { status: "avslutad" });
    await medlem(AGENT, CPS, { typ: "agent" });
    await medlem(GRANNE, ANDRA);
    await setDoc(doc(db, "handelser/h1"), { groupId: CPS, rubrik: "Bio med Selma", datum: "2026-10-24" });
    await setDoc(doc(db, "handelser/h2"), { groupId: ANDRA, rubrik: "Andras möte", datum: "2026-10-25" });
    await setDoc(doc(db, "handelser/h3"), { groupId: CPS, rubrik: "Tas bort", datum: "2026-10-26" });
    await setDoc(doc(db, "bibliotek/f1"), fil(P1, MEDLEM1, "f1"));
    await setDoc(doc(db, "bibliotek/f2"), fil(P1, MEDLEM2, "f2"));
    await setDoc(doc(db, "bibliotek/f3"), fil(P1, MEDLEM1, "f3"));
    await setDoc(doc(db, "bibliotek/f4"), fil(P1, MEDLEM1, "f4"));
    await setDoc(doc(db, "bibliotek/g1"), fil(P2, GRANNE, "g1"));
    await setDoc(doc(db, "bibliotek/forfalskad"), fil(PFEL, MEDLEM1, "forfalskad"));
    await setDoc(doc(db, "bibliotek/foralder"), fil(PSAKNAS, MEDLEM1, "foralder"));
    await setDoc(doc(db, "bibliotek/trasig"), fil("handelse~cps-ab", MEDLEM1, "trasig"));
    await setDoc(doc(db, "bibliotek/h3fil"), fil(handelseBibliotek(CPS, "h3"), MEDLEM1, "h3fil"));
    // Gruppens egen plats ska vara orörd av grenen: samma post som förut, i gruppen.
    await setDoc(doc(db, "bibliotek/gruppens"), fil(CPS, MEDLEM1, "gruppens"));
  });
});

after(async () => {
  await miljo?.cleanup();
});

describe("Händelsefiler: läsa", () => {
  it("en aktiv medlem läser en post och hela listan, och listan är inte tom (golv)", async () => {
    await lyckas(getDoc(doc(som(MEDLEM1), "bibliotek/f1")));
    await lyckas(getDoc(doc(som(MEDLEM2), "bibliotek/f1")));
    await lyckas(getDoc(doc(som(AGARE), "bibliotek/f1")));
    const lista = await lyckas(getDocs(query(collection(som(MEDLEM2), "bibliotek"), where("groupId", "==", P1))));
    assert.ok(lista.size >= 4, `listan hade ${lista.size} poster, golvet är 4`);
  });
  it("en utomstående läser inte posten eller listan", async () => {
    await nekas(getDoc(doc(som(UTOMSTAENDE), "bibliotek/f1")));
    await nekas(getDocs(query(collection(som(UTOMSTAENDE), "bibliotek"), where("groupId", "==", P1))));
    await nekas(getDoc(doc(miljo.unauthenticatedContext().firestore(), "bibliotek/f1")));
  });
  it("en medlem i en annan grupp läser inte, och en avslutad medlem inte heller", async () => {
    await nekas(getDoc(doc(som(GRANNE), "bibliotek/f1")));
    await nekas(getDocs(query(collection(som(GRANNE), "bibliotek"), where("groupId", "==", P1))));
    await nekas(getDoc(doc(som(AVSLUTAD), "bibliotek/f1")));
  });
  it("en grupps medlem läser inte en annan grupps händelsefiler, och den andra gruppen läser sina", async () => {
    await nekas(getDoc(doc(som(MEDLEM1), "bibliotek/g1")));
    await lyckas(getDoc(doc(som(GRANNE), "bibliotek/g1")));
  });
  it("en påhittad plats öppnar ingenting: händelsen ligger i en annan grupp än platsen säger", async () => {
    // MEDLEM1 är med i CPS (platsens grupp) och GRANNE i ANDRA (händelsens grupp). Ingen av dem läser.
    await nekas(getDoc(doc(som(MEDLEM1), "bibliotek/forfalskad")));
    await nekas(getDoc(doc(som(GRANNE), "bibliotek/forfalskad")));
    await nekas(getDocs(query(collection(som(MEDLEM1), "bibliotek"), where("groupId", "==", PFEL))));
  });
  it("en plats vars händelse inte finns läses inte, och en plats med fel form inte heller", async () => {
    await nekas(getDoc(doc(som(MEDLEM1), "bibliotek/foralder")));
    await nekas(getDoc(doc(som(MEDLEM1), "bibliotek/trasig")));
  });
  it("när händelsen tas bort med Admin SDK blir filerna osynliga för klienten direkt", async () => {
    await lyckas(getDoc(doc(som(MEDLEM1), "bibliotek/h3fil")));
    await miljo.withSecurityRulesDisabled((ctx) => raderaDok(doc(ctx.firestore(), "handelser/h3")));
    await nekas(getDoc(doc(som(MEDLEM1), "bibliotek/h3fil")));
  });
  it("gruppens egen plats läses som förut", async () => {
    await lyckas(getDoc(doc(som(MEDLEM2), "bibliotek/gruppens")));
    await nekas(getDoc(doc(som(UTOMSTAENDE), "bibliotek/gruppens")));
  });
});

describe("Händelsefiler: skapa", () => {
  it("en aktiv medlem skapar en fil i platsens egen sökväg, och ägaren och admin också", async () => {
    await lyckas(setDoc(doc(som(MEDLEM1), "bibliotek/ny1"), fil(P1, MEDLEM1, "ny1")));
    await lyckas(setDoc(doc(som(AGARE), "bibliotek/ny2"), fil(P1, AGARE, "ny2")));
    await lyckas(setDoc(doc(som(ADMIN), "bibliotek/ny3"), fil(P1, ADMIN, "ny3")));
  });
  it("en utomstående, en annan grupps medlem och en avslutad medlem skapar inte", async () => {
    await nekas(setDoc(doc(som(UTOMSTAENDE), "bibliotek/x1"), fil(P1, UTOMSTAENDE, "x1")));
    await nekas(setDoc(doc(som(GRANNE), "bibliotek/x2"), fil(P1, GRANNE, "x2")));
    await nekas(setDoc(doc(som(AVSLUTAD), "bibliotek/x3"), fil(P1, AVSLUTAD, "x3")));
  });
  it("en agent skapar inte, fast agenten är medlem", async () => {
    await nekas(setDoc(doc(som(AGENT), "bibliotek/x4"), fil(P1, AGENT, "x4", { skapadAv: { uid: AGENT, namn: "Agenten", typ: "agent", kalla: "bibliotek" } })));
    await nekas(setDoc(doc(som(AGENT), "bibliotek/x4b"), fil(P1, AGENT, "x4b")));
  });
  it("ingen skapar under en påhittad plats eller under en händelse som inte finns", async () => {
    await nekas(setDoc(doc(som(MEDLEM1), "bibliotek/x5"), fil(PFEL, MEDLEM1, "x5")));
    await nekas(setDoc(doc(som(GRANNE), "bibliotek/x5b"), fil(PFEL, GRANNE, "x5b")));
    await nekas(setDoc(doc(som(MEDLEM1), "bibliotek/x6"), fil(PSAKNAS, MEDLEM1, "x6")));
  });
  it("en händelses bibliotek har bara filer: en anteckning eller en länk nekas", async () => {
    const nu = Date.now();
    const bas = { groupId: P1, rubrik: "Tanke", skapadAv: skapare(MEDLEM1), skapad: nu, andrad: nu };
    await nekas(setDoc(doc(som(MEDLEM1), "bibliotek/x7"), { ...bas, typ: "anteckning", text: "Kom ihåg biljetterna." }));
    await nekas(setDoc(doc(som(MEDLEM1), "bibliotek/x8"), { ...bas, typ: "lank", url: "https://example.com/biljett" }));
    // Samma anteckning i gruppens plats går igenom: det är platsen som begränsar, inte posten.
    await lyckas(setDoc(doc(som(MEDLEM1), "bibliotek/x9"), { ...bas, groupId: CPS, typ: "anteckning", text: "Kom ihåg biljetterna." }));
  });
  it("ingen skapar i någon annans namn, eller med en sökväg till en annan plats", async () => {
    await nekas(setDoc(doc(som(MEDLEM1), "bibliotek/x10"), fil(P1, MEDLEM2, "x10")));
    const fel = fil(P1, MEDLEM1, "x11", { fil: { sokvag: `grupper/${P2}/bibliotek/x11/biljett.pdf`, namn: "biljett.pdf", mime: "application/pdf", byte: 4 } });
    await nekas(setDoc(doc(som(MEDLEM1), "bibliotek/x11"), fel));
  });
});

describe("Händelsefiler: ändra och radera", () => {
  it("författaren och admin ändrar, en annan medlem inte", async () => {
    await lyckas(updateDoc(doc(som(MEDLEM1), "bibliotek/f1"), { rubrik: "Biljett ny", andrad: Date.now() }));
    await lyckas(updateDoc(doc(som(ADMIN), "bibliotek/f1"), { rubrik: "Biljett admin", andrad: Date.now() }));
    await nekas(updateDoc(doc(som(MEDLEM2), "bibliotek/f1"), { rubrik: "Kapat", andrad: Date.now() }));
    await nekas(updateDoc(doc(som(UTOMSTAENDE), "bibliotek/f1"), { rubrik: "Kapat", andrad: Date.now() }));
  });
  it("posten flyttas inte till en annan plats genom en ändring", async () => {
    await nekas(updateDoc(doc(som(MEDLEM1), "bibliotek/f1"), { groupId: P2, andrad: Date.now() }));
    await nekas(updateDoc(doc(som(MEDLEM1), "bibliotek/f1"), { groupId: CPS, andrad: Date.now() }));
  });
  it("författaren raderar sin egen fil, men inte någon annans", async () => {
    await nekas(deleteDoc(doc(som(MEDLEM1), "bibliotek/f2")));
    await lyckas(deleteDoc(doc(som(MEDLEM1), "bibliotek/f3")));
  });
  it("admin och ägare raderar allas", async () => {
    await lyckas(deleteDoc(doc(som(ADMIN), "bibliotek/f2")));
    await lyckas(deleteDoc(doc(som(AGARE), "bibliotek/f4")));
  });
  it("en utomstående, en annan grupps medlem och en avslutad medlem raderar inte", async () => {
    await nekas(deleteDoc(doc(som(UTOMSTAENDE), "bibliotek/ny1")));
    await nekas(deleteDoc(doc(som(GRANNE), "bibliotek/ny1")));
    await nekas(deleteDoc(doc(som(AVSLUTAD), "bibliotek/ny1")));
  });
});

describe("Händelsefiler: lagring", () => {
  const vag = (plats, id) => `grupper/${plats}/bibliotek/${id}/biljett.pdf`;
  it("författaren laddar upp till sin post och en medlem läser", async () => {
    await lyckas(uploadBytes(ref(lagringSom(MEDLEM1), vag(P1, "ny1")), BYTE, PDF));
    await lyckas(getBytes(ref(lagringSom(MEDLEM2), vag(P1, "ny1"))));
    await lyckas(getBytes(ref(lagringSom(AGARE), vag(P1, "ny1"))));
  });
  it("admin och ägare laddar upp till någon annans post, en annan medlem inte", async () => {
    await lyckas(uploadBytes(ref(lagringSom(ADMIN), vag(P1, "ny1")), BYTE, PDF));
    await lyckas(uploadBytes(ref(lagringSom(AGARE), vag(P1, "ny1")), BYTE, PDF));
    await nekas(uploadBytes(ref(lagringSom(MEDLEM2), vag(P1, "ny1")), BYTE, PDF));
  });
  it("en utomstående och en annan grupps medlem varken läser eller laddar upp", async () => {
    await nekas(getBytes(ref(lagringSom(UTOMSTAENDE), vag(P1, "ny1"))));
    await nekas(getBytes(ref(lagringSom(GRANNE), vag(P1, "ny1"))));
    await nekas(uploadBytes(ref(lagringSom(UTOMSTAENDE), vag(P1, "ny1")), BYTE, PDF));
    await nekas(uploadBytes(ref(lagringSom(GRANNE), vag(P1, "ny1")), BYTE, PDF));
    await nekas(getBytes(ref(lagringSom(AVSLUTAD), vag(P1, "ny1"))));
  });
  it("en uppladdning till en post som inte finns nekas", async () => {
    await nekas(uploadBytes(ref(lagringSom(MEDLEM1), vag(P1, "finns-inte")), BYTE, PDF));
  });
  it("en plats med fel form öppnar ingenting i lagringen", async () => {
    await nekas(getBytes(ref(lagringSom(MEDLEM1), vag("handelse~cps-ab", "trasig"))));
    await nekas(uploadBytes(ref(lagringSom(MEDLEM1), vag("handelse~cps-ab", "trasig")), BYTE, PDF));
  });
  it("ingen klient raderar en fil, inte ens författaren", async () => {
    await nekas(deleteObject(ref(lagringSom(MEDLEM1), vag(P1, "ny1"))));
    await nekas(deleteObject(ref(lagringSom(ADMIN), vag(P1, "ny1"))));
  });
});

describe("Händelsefiler: golv", () => {
  it("minst 12 utfall släpptes igenom och minst 30 nekades", () => {
    assert.ok(räknare.ok >= 12, `bara ${räknare.ok} utfall släpptes igenom, golvet är 12`);
    assert.ok(räknare.nej >= 30, `bara ${räknare.nej} utfall nekades, golvet är 30`);
  });
});
