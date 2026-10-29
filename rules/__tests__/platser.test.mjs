/**
 * Regelprov för gruppens egna platser (0.155.0, cllp/ops-framework#469).
 *
 * ⛔ TVÅ SAKER PROVAS, OCH DE HÖR IHOP:
 *
 *   POSTERNA PÅ PLATSEN   `plats~<grupp>~<id>` i `groupId` på en bibliotekspost. Behörigheten är gruppens medlemskap, tolkat ur platsen. Platsen slås INTE upp: ingen samling
 *                         behöver ha ett dokument för platsen för att en medlem ska kunna läsa och skriva dit, och ingen utomstående kommer in genom att hitta på en plats.
 *                         Läsa, skapa (alla typer, en person), ändra, radera, och lagringen (Storage-regeln) med samma medlemskap.
 *   PLATSEN SOM DATA      dokumentet `<samling>/{grupp}|{id}` (här `bibliotekplatser`): namn, skapadAv, skapad, arkiverad. Medlem läser (också en agent), en person skapar, skaparen eller
 *                         ägare och admin byter namn och arkiverar, ingen raderar. Nyckeln måste börja med radens grupp.
 *
 * ⛔ KOSTNADEN ÄR MÄTT, INTE UPPSKATTAD. Firestores tak är tio dokumentanrop per regelutvärdering. `kostnad()` lägger N olika `exists()` till ETT riktigt regelanrop (funktionen som
 * regelfragmentet genererat, inte en kopia) och letar rätt på största N som släpps in: tio minus N är vad vägen kostar. Platsgrenen kostar medlemskapet (exists och get på samma dokument)
 * och inget mer. Taket nedan är 2; en ny uppslagning i grenen gör provet rött.
 *
 * ⛔ GOLV: minst 40 utfall som släpptes igenom och minst 60 som nekades, och provet nedan blir rött annars.
 *
 * Reglerna skrivs av `scripts/skriv-provregler.mjs`. PROJEKTET är `regelprov` för proven mot Storage (Storage slår upp medlemskapet i samma projekt); kostnadsmätningen har ett eget projekt med egna regler.
 */

import { medlemskapsId } from "../../src/lib/grupp.js";
import { platsBibliotek } from "../../src/lib/bibliotek.js";
import { platsnyckel } from "../../src/lib/platser.js";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const AGARE = "uidAgarePl";
const ADMIN = "uidAdminPl";
const MEDLEM1 = "uidMedlem1Pl";
const MEDLEM2 = "uidMedlem2Pl";
const AVSLUTAD = "uidAvslutadPl";
const AGENT = "uidAgentPl";
const GRANNE = "uidGrannePl";
const UTOMSTAENDE = "uidUtomstaendePl";
/** Har ett medlemskap vars grupp ÄR en plats (`plats~cps-ab~x`). Inget ramverkskod skapar ett, men ett skydd som vilar på det är inget skydd. */
const FALSK = "uidFalskPl";
const CPS = "cps-ab";
const ANDRA = "andra-ab";

const P1 = platsBibliotek(CPS, "demos");
const P2 = platsBibliotek(ANDRA, "live");
/** Samma plats-id i två grupper är två olika platser. */
const P3 = platsBibliotek(ANDRA, "demos");
/** Två delar i stället för tre, fyra i stället för tre, versaler i gruppen, versaler i id:t och 25 tecken: ingen kod bygger dem, och reglerna ska neka dem. */
const PTVA = "plats~cps-ab";
const PFYRA = `${P1}~extra`;
const PVERSAL = "plats~CPS-AB~demos";
const PIDVERSAL = "plats~cps-ab~Demos";
const PLANG = `plats~cps-ab~${"a".repeat(25)}`;
const PTOM = "plats~cps-ab~";
/** En plats för ett id ingen skapat ett dokument för: den ska fungera ändå (ingen uppslagning). */
const POUTAN = platsBibliotek(CPS, "utan-dokument");

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
    rubrik: "Demo",
    fil: { sokvag: `grupper/${plats}/bibliotek/${id}/demo.pdf`, namn: "demo.pdf", mime: "application/pdf", byte: 4 },
    skapadAv: skapare(uid),
    skapad: nu,
    andrad: nu,
    ...extra,
  };
};
const anteckning = (plats, uid, extra = {}) => {
  const nu = Date.now();
  return { groupId: plats, typ: "anteckning", rubrik: "Idé", text: "En rad.", skapadAv: skapare(uid), skapad: nu, andrad: nu, ...extra };
};
const lank = (plats, uid) => {
  const nu = Date.now();
  return { groupId: plats, typ: "lank", rubrik: "Länk", url: "https://example.com/demo", skapadAv: skapare(uid), skapad: nu, andrad: nu };
};
const BYTE = new Uint8Array([37, 80, 68, 70]);
const PDF = { contentType: "application/pdf" };

const platsrad = (groupId, uid, extra = {}) => ({ groupId, namn: "Demos", skapadAv: skapare(uid), skapad: Date.now(), arkiverad: false, ...extra });

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
    await medlem(FALSK, PTVA);
    await medlem(FALSK, PFYRA);
    await medlem(FALSK, P1);
    // Posterna. P1 har ett platsdokument, POUTAN har inget.
    await setDoc(doc(db, "bibliotek/f1"), fil(P1, MEDLEM1, "f1"));
    await setDoc(doc(db, "bibliotek/f2"), fil(P1, MEDLEM2, "f2"));
    await setDoc(doc(db, "bibliotek/f3"), fil(P1, MEDLEM1, "f3"));
    await setDoc(doc(db, "bibliotek/f4"), fil(P1, MEDLEM1, "f4"));
    await setDoc(doc(db, "bibliotek/n1"), anteckning(P1, MEDLEM1));
    await setDoc(doc(db, "bibliotek/g1"), fil(P2, GRANNE, "g1"));
    await setDoc(doc(db, "bibliotek/g3"), fil(P3, GRANNE, "g3"));
    await setDoc(doc(db, "bibliotek/utan"), fil(POUTAN, MEDLEM1, "utan"));
    await setDoc(doc(db, "bibliotek/tva"), fil(PTVA, MEDLEM1, "tva"));
    await setDoc(doc(db, "bibliotek/fyra"), fil(PFYRA, MEDLEM1, "fyra"));
    await setDoc(doc(db, "bibliotek/gruppens"), fil(CPS, MEDLEM1, "gruppens"));
    // Platserna som data.
    await setDoc(doc(db, `bibliotekplatser/${platsnyckel(CPS, "demos")}`), platsrad(CPS, MEDLEM1));
    await setDoc(doc(db, `bibliotekplatser/${platsnyckel(CPS, "live")}`), platsrad(CPS, MEDLEM2, { namn: "Live" }));
    await setDoc(doc(db, `bibliotekplatser/${platsnyckel(ANDRA, "live")}`), platsrad(ANDRA, GRANNE, { namn: "Live" }));
  });
  // Objekten finns, med reglerna avstängda: ett nekat utfall som hade uteblivit ändå mäter ingenting.
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    for (const [plats, id] of [[PTVA, "tva"], [PFYRA, "fyra"], [P2, "g1"], [P1, "f1"], [P1, "f2"], [P1, "f3"], [P1, "f4"], [POUTAN, "utan"]]) {
      await uploadBytes(ref(ctx.storage(), `grupper/${plats}/bibliotek/${id}/demo.pdf`), BYTE, PDF);
    }
  });
});

after(async () => {
  await miljo?.cleanup();
});

describe("Platsens poster: läsa", () => {
  it("en aktiv medlem läser en post och hela listan, och listan är inte tom (golv)", async () => {
    await lyckas(getDoc(doc(som(MEDLEM1), "bibliotek/f1")));
    await lyckas(getDoc(doc(som(MEDLEM2), "bibliotek/f1")));
    await lyckas(getDoc(doc(som(AGARE), "bibliotek/f1")));
    await lyckas(getDoc(doc(som(MEDLEM2), "bibliotek/n1")));
    const lista = await lyckas(getDocs(query(collection(som(MEDLEM2), "bibliotek"), where("groupId", "==", P1))));
    assert.ok(lista.size >= 5, `listan hade ${lista.size} poster, golvet är 5`);
  });
  it("en agent läser: platsen är sortering, och agenten läser gruppens bibliotek redan", async () => {
    await lyckas(getDoc(doc(som(AGENT), "bibliotek/f1")));
    await lyckas(getDocs(query(collection(som(AGENT), "bibliotek"), where("groupId", "==", P1))));
  });
  it("en utomstående, en utloggad och en avslutad medlem läser inte", async () => {
    await nekas(getDoc(doc(som(UTOMSTAENDE), "bibliotek/f1")));
    await nekas(getDocs(query(collection(som(UTOMSTAENDE), "bibliotek"), where("groupId", "==", P1))));
    await nekas(getDoc(doc(miljo.unauthenticatedContext().firestore(), "bibliotek/f1")));
    await nekas(getDoc(doc(som(AVSLUTAD), "bibliotek/f1")));
  });
  it("en medlem i en annan grupp läser inte, och samma plats-id i en annan grupp är en annan plats", async () => {
    await nekas(getDoc(doc(som(GRANNE), "bibliotek/f1")));
    await nekas(getDocs(query(collection(som(GRANNE), "bibliotek"), where("groupId", "==", P1))));
    await nekas(getDoc(doc(som(MEDLEM1), "bibliotek/g3")));
    await nekas(getDoc(doc(som(MEDLEM1), "bibliotek/g1")));
    await lyckas(getDoc(doc(som(GRANNE), "bibliotek/g3")));
    await lyckas(getDoc(doc(som(GRANNE), "bibliotek/g1")));
  });
  it("platsen slås inte upp: en post på en plats utan dokument läses av gruppens medlem", async () => {
    await lyckas(getDoc(doc(som(MEDLEM2), "bibliotek/utan")));
    await nekas(getDoc(doc(som(UTOMSTAENDE), "bibliotek/utan")));
  });
  it("en plats med fel form läses inte av någon, och en fråga utan platsen nekas", async () => {
    await nekas(getDoc(doc(som(MEDLEM1), "bibliotek/tva")));
    await nekas(getDoc(doc(som(MEDLEM1), "bibliotek/fyra")));
    await nekas(getDocs(query(collection(som(MEDLEM1), "bibliotek"), where("groupId", "==", PVERSAL))));
    await nekas(getDocs(collection(som(MEDLEM1), "bibliotek")));
  });
  it("ett medlemskap vars grupp är själva platsen öppnar ingenting: grenarna utesluter varandra", async () => {
    // FALSK är "aktiv medlem" i grupperna `plats~cps-ab`, `plats~cps-ab~demos~extra` och `plats~cps-ab~demos`. Prövades platsen också som en grupp släpptes hen in.
    await nekas(getDoc(doc(som(FALSK), "bibliotek/tva")));
    await nekas(getDoc(doc(som(FALSK), "bibliotek/fyra")));
    await nekas(getDoc(doc(som(FALSK), "bibliotek/f1")));
    await nekas(setDoc(doc(som(FALSK), "bibliotek/x40"), fil(P1, FALSK, "x40")));
    await nekas(getBytes(ref(lagringSom(FALSK), `grupper/${P1}/bibliotek/f1/demo.pdf`)));
  });
  it("gruppens egen plats läses som förut", async () => {
    await lyckas(getDoc(doc(som(MEDLEM2), "bibliotek/gruppens")));
    await nekas(getDoc(doc(som(UTOMSTAENDE), "bibliotek/gruppens")));
  });
});

describe("Platsens poster: skapa", () => {
  it("en aktiv medlem skapar en fil, en anteckning och en länk på platsen, och ägaren och admin också", async () => {
    await lyckas(setDoc(doc(som(MEDLEM1), "bibliotek/ny1"), fil(P1, MEDLEM1, "ny1")));
    await lyckas(setDoc(doc(som(MEDLEM1), "bibliotek/ny2"), anteckning(P1, MEDLEM1)));
    await lyckas(setDoc(doc(som(MEDLEM2), "bibliotek/ny3"), lank(P1, MEDLEM2)));
    await lyckas(setDoc(doc(som(AGARE), "bibliotek/ny4"), fil(P1, AGARE, "ny4")));
    await lyckas(setDoc(doc(som(ADMIN), "bibliotek/ny5"), anteckning(P1, ADMIN)));
  });
  it("platsen behöver inget dokument för att ta emot en post", async () => {
    await lyckas(setDoc(doc(som(MEDLEM1), "bibliotek/ny6"), fil(POUTAN, MEDLEM1, "ny6")));
  });
  it("en utomstående, en annan grupps medlem och en avslutad medlem skapar inte", async () => {
    await nekas(setDoc(doc(som(UTOMSTAENDE), "bibliotek/x1"), fil(P1, UTOMSTAENDE, "x1")));
    await nekas(setDoc(doc(som(GRANNE), "bibliotek/x2"), fil(P1, GRANNE, "x2")));
    await nekas(setDoc(doc(som(AVSLUTAD), "bibliotek/x3"), fil(P1, AVSLUTAD, "x3")));
    await nekas(setDoc(doc(som(MEDLEM1), "bibliotek/x3b"), fil(P2, MEDLEM1, "x3b")));
  });
  it("en agent skapar inte, fast agenten är medlem", async () => {
    await nekas(setDoc(doc(som(AGENT), "bibliotek/x4"), fil(P1, AGENT, "x4", { skapadAv: { uid: AGENT, namn: "Agenten", typ: "agent", kalla: "bibliotek" } })));
    await nekas(setDoc(doc(som(AGENT), "bibliotek/x4b"), fil(P1, AGENT, "x4b")));
    await nekas(setDoc(doc(som(AGENT), "bibliotek/x4c"), anteckning(P1, AGENT)));
  });
  it("ingen skapar på en plats med fel form", async () => {
    for (const [i, p] of [PTVA, PFYRA, PVERSAL, PIDVERSAL, PLANG, PTOM].entries()) {
      await nekas(setDoc(doc(som(MEDLEM1), `bibliotek/fel${i}`), fil(p, MEDLEM1, `fel${i}`)));
    }
  });
  it("ingen skapar i någon annans namn, eller med en sökväg till en annan plats", async () => {
    await nekas(setDoc(doc(som(MEDLEM1), "bibliotek/x10"), fil(P1, MEDLEM2, "x10")));
    const fel = fil(P1, MEDLEM1, "x11", { fil: { sokvag: `grupper/${P3}/bibliotek/x11/demo.pdf`, namn: "demo.pdf", mime: "application/pdf", byte: 4 } });
    await nekas(setDoc(doc(som(MEDLEM1), "bibliotek/x11"), fel));
  });
});

describe("Platsens poster: ändra och radera", () => {
  it("författaren och admin ändrar, en annan medlem inte", async () => {
    await lyckas(updateDoc(doc(som(MEDLEM1), "bibliotek/f1"), { rubrik: "Demo ny", andrad: Date.now() }));
    await lyckas(updateDoc(doc(som(ADMIN), "bibliotek/f1"), { rubrik: "Demo admin", andrad: Date.now() }));
    await nekas(updateDoc(doc(som(MEDLEM2), "bibliotek/f1"), { rubrik: "Kapat", andrad: Date.now() }));
    await nekas(updateDoc(doc(som(UTOMSTAENDE), "bibliotek/f1"), { rubrik: "Kapat", andrad: Date.now() }));
    await nekas(updateDoc(doc(som(AGENT), "bibliotek/f1"), { rubrik: "Kapat", andrad: Date.now() }));
  });
  it("posten flyttas inte till en annan plats genom en ändring", async () => {
    await nekas(updateDoc(doc(som(MEDLEM1), "bibliotek/f1"), { groupId: P2, andrad: Date.now() }));
    await nekas(updateDoc(doc(som(MEDLEM1), "bibliotek/f1"), { groupId: CPS, andrad: Date.now() }));
    await nekas(updateDoc(doc(som(MEDLEM1), "bibliotek/f1"), { groupId: PTVA, andrad: Date.now() }));
  });
  it("författaren raderar sin egen post, men inte någon annans", async () => {
    await nekas(deleteDoc(doc(som(MEDLEM1), "bibliotek/f2")));
    await lyckas(deleteDoc(doc(som(MEDLEM1), "bibliotek/f3")));
  });
  it("admin och ägare raderar allas", async () => {
    await lyckas(deleteDoc(doc(som(ADMIN), "bibliotek/f2")));
    await lyckas(deleteDoc(doc(som(AGARE), "bibliotek/f4")));
  });
  it("en utomstående, en annan grupps medlem, en avslutad medlem och en agent raderar inte", async () => {
    await nekas(deleteDoc(doc(som(UTOMSTAENDE), "bibliotek/ny1")));
    await nekas(deleteDoc(doc(som(GRANNE), "bibliotek/ny1")));
    await nekas(deleteDoc(doc(som(AVSLUTAD), "bibliotek/ny1")));
    await nekas(deleteDoc(doc(som(AGENT), "bibliotek/ny1")));
  });
});

describe("Platsens filer: lagring", () => {
  const vag = (plats, id) => `grupper/${plats}/bibliotek/${id}/demo.pdf`;
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
  it("en utomstående, en annan grupps medlem och en avslutad medlem varken läser eller laddar upp", async () => {
    await nekas(getBytes(ref(lagringSom(UTOMSTAENDE), vag(P1, "ny1"))));
    await nekas(getBytes(ref(lagringSom(GRANNE), vag(P1, "ny1"))));
    await nekas(uploadBytes(ref(lagringSom(UTOMSTAENDE), vag(P1, "ny1")), BYTE, PDF));
    await nekas(uploadBytes(ref(lagringSom(GRANNE), vag(P1, "ny1")), BYTE, PDF));
    await nekas(getBytes(ref(lagringSom(AVSLUTAD), vag(P1, "ny1"))));
  });
  it("en uppladdning till en post som inte finns nekas, och en plats med fel form öppnar ingenting", async () => {
    await nekas(uploadBytes(ref(lagringSom(MEDLEM1), vag(P1, "finns-inte")), BYTE, PDF));
    await nekas(getBytes(ref(lagringSom(MEDLEM1), vag(PTVA, "tva"))));
    await nekas(getBytes(ref(lagringSom(MEDLEM1), vag(PFYRA, "fyra"))));
    await nekas(uploadBytes(ref(lagringSom(MEDLEM1), vag(PTVA, "tva")), BYTE, PDF));
    await nekas(uploadBytes(ref(lagringSom(MEDLEM1), vag(PFYRA, "fyra")), BYTE, PDF));
  });
  it("en plats utan dokument tar emot en uppladdning till en post som finns", async () => {
    await lyckas(uploadBytes(ref(lagringSom(MEDLEM1), vag(POUTAN, "ny6")), BYTE, PDF));
    await lyckas(getBytes(ref(lagringSom(MEDLEM2), vag(POUTAN, "ny6"))));
  });
  it("ingen klient raderar en fil, inte ens författaren", async () => {
    await nekas(deleteObject(ref(lagringSom(MEDLEM1), vag(P1, "ny1"))));
    await nekas(deleteObject(ref(lagringSom(ADMIN), vag(P1, "ny1"))));
  });
});

describe("Platsen som data: läsa", () => {
  const P = `bibliotekplatser/${platsnyckel(CPS, "demos")}`;
  it("en medlem läser en plats och gruppens lista, och en agent också", async () => {
    await lyckas(getDoc(doc(som(MEDLEM2), P)));
    await lyckas(getDoc(doc(som(AGENT), P)));
    const lista = await lyckas(getDocs(query(collection(som(MEDLEM2), "bibliotekplatser"), where("groupId", "==", CPS))));
    assert.ok(lista.size >= 2, `listan hade ${lista.size} platser, golvet är 2`);
    await lyckas(getDocs(query(collection(som(AGENT), "bibliotekplatser"), where("groupId", "==", CPS))));
  });
  it("en utomstående, en annan grupps medlem, en avslutad medlem och en utloggad läser inte", async () => {
    await nekas(getDoc(doc(som(UTOMSTAENDE), P)));
    await nekas(getDoc(doc(som(GRANNE), P)));
    await nekas(getDoc(doc(som(AVSLUTAD), P)));
    await nekas(getDoc(doc(miljo.unauthenticatedContext().firestore(), P)));
    await nekas(getDocs(query(collection(som(GRANNE), "bibliotekplatser"), where("groupId", "==", CPS))));
  });
  it("en fråga utan gruppen går inte att bevisa och nekas", async () => {
    await nekas(getDocs(collection(som(MEDLEM1), "bibliotekplatser")));
  });
});

describe("Platsen som data: skapa", () => {
  const ny = (g, id, uid, extra = {}) => [doc(som(uid), `bibliotekplatser/${platsnyckel(g, id)}`), platsrad(g, uid, extra)];
  it("en medlem, ägaren och admin skapar en plats med nyckeln <grupp>|<id>", async () => {
    await lyckas(setDoc(...ny(CPS, "projekt-a", MEDLEM1)));
    await lyckas(setDoc(...ny(CPS, "projekt-b", AGARE)));
    await lyckas(setDoc(...ny(CPS, "projekt-c", ADMIN)));
    await lyckas(setDoc(...ny(CPS, "a", MEDLEM2)));
    await lyckas(setDoc(...ny(CPS, "a".repeat(24), MEDLEM2)));
  });
  it("samma plats-id i en annan grupp är en annan nyckel och går bra", async () => {
    await lyckas(setDoc(...ny(ANDRA, "demos", GRANNE)));
  });
  it("en utomstående, en annan grupps medlem, en avslutad medlem och en agent skapar inte", async () => {
    await nekas(setDoc(...ny(CPS, "x1", UTOMSTAENDE)));
    await nekas(setDoc(...ny(CPS, "x2", GRANNE)));
    await nekas(setDoc(...ny(CPS, "x3", AVSLUTAD)));
    await nekas(setDoc(...ny(CPS, "x4", AGENT)));
    await nekas(setDoc(...ny(CPS, "x4b", AGENT, { skapadAv: { uid: AGENT, namn: "Agenten", typ: "agent", kalla: "bibliotek" } })));
  });
  it("nyckeln måste börja med radens egen grupp: en admin kapar inte en annan grupps nyckel", async () => {
    // GRANNE är med i ANDRA och skriver nyckeln CPS|kapad med groupId ANDRA: nyckeln säger CPS.
    await nekas(setDoc(doc(som(GRANNE), `bibliotekplatser/${platsnyckel(CPS, "kapad")}`), platsrad(ANDRA, GRANNE)));
    // MEDLEM1 skriver nyckeln ANDRA|kapad med groupId CPS.
    await nekas(setDoc(doc(som(MEDLEM1), `bibliotekplatser/${platsnyckel(ANDRA, "kapad")}`), platsrad(CPS, MEDLEM1)));
    // Och en rad vars groupId är ANDRA av en medlem i CPS.
    await nekas(setDoc(doc(som(MEDLEM1), `bibliotekplatser/${platsnyckel(ANDRA, "kapad2")}`), platsrad(ANDRA, MEDLEM1)));
  });
  it("en nyckel med fel form nekas: bara plats-id, versaler, för långt, tomt, flera avgränsare", async () => {
    for (const id of ["Demos", "a b", "a".repeat(25), "-a", "a~b", "a.b", "a/b"]) {
      await nekas(setDoc(doc(som(MEDLEM1), `bibliotekplatser/${CPS}|${id.replace("/", "%2F")}`), platsrad(CPS, MEDLEM1)));
    }
    await nekas(setDoc(doc(som(MEDLEM1), `bibliotekplatser/${CPS}|`), platsrad(CPS, MEDLEM1)));
    await nekas(setDoc(doc(som(MEDLEM1), `bibliotekplatser/${CPS}|a|b`), platsrad(CPS, MEDLEM1)));
    await nekas(setDoc(doc(som(MEDLEM1), "bibliotekplatser/utan-grupp"), platsrad(CPS, MEDLEM1)));
  });
  it("ingen skapar i någon annans namn, med via, med typen agent eller med ett extra fält", async () => {
    await nekas(setDoc(doc(som(MEDLEM1), `bibliotekplatser/${platsnyckel(CPS, "x20")}`), platsrad(CPS, MEDLEM2)));
    await nekas(setDoc(...ny(CPS, "x21", MEDLEM1, { skapadAv: { ...skapare(MEDLEM1), via: { nyckelId: "abc", namn: "Nyckel" } } })));
    await nekas(setDoc(...ny(CPS, "x22", MEDLEM1, { skapadAv: { ...skapare(MEDLEM1), typ: "agent" } })));
    await nekas(setDoc(...ny(CPS, "x23", MEDLEM1, { ikon: "mapp" })));
    await nekas(setDoc(...ny(CPS, "x24", MEDLEM1, { skapadAv: { uid: MEDLEM1, namn: "Kim", typ: "manniska", kalla: "bibliotek", extra: 1 } })));
  });
  it("namnet har form: tomt, bara blanktecken, för långt och fel sort nekas, 60 tecken går", async () => {
    await nekas(setDoc(...ny(CPS, "x30", MEDLEM1, { namn: "" })));
    await nekas(setDoc(...ny(CPS, "x31", MEDLEM1, { namn: "   " })));
    await nekas(setDoc(...ny(CPS, "x32", MEDLEM1, { namn: "a".repeat(61) })));
    await nekas(setDoc(...ny(CPS, "x33", MEDLEM1, { namn: ["Demos"] })));
    await nekas(setDoc(...ny(CPS, "x34", MEDLEM1, { namn: 5 })));
    await lyckas(setDoc(...ny(CPS, "x35", MEDLEM1, { namn: "å".repeat(60) })));
  });
  it("platsen skapas oarkiverad, med serverns klocka", async () => {
    await nekas(setDoc(...ny(CPS, "x40", MEDLEM1, { arkiverad: true })));
    await nekas(setDoc(...ny(CPS, "x41", MEDLEM1, { arkiverad: "nej" })));
    await nekas(setDoc(...ny(CPS, "x42", MEDLEM1, { skapad: Date.now() - 3_600_000 })));
    await nekas(setDoc(...ny(CPS, "x43", MEDLEM1, { skapad: 4_000_000_000_000 })));
    await nekas(setDoc(...ny(CPS, "x44", MEDLEM1, { skapad: "nu" })));
    const utan = platsrad(CPS, MEDLEM1);
    delete utan.arkiverad;
    await nekas(setDoc(doc(som(MEDLEM1), `bibliotekplatser/${platsnyckel(CPS, "x45")}`), utan));
  });
});

describe("Platsen som data: byta namn, arkivera, aldrig radera", () => {
  const P = (id) => `bibliotekplatser/${platsnyckel(CPS, id)}`;
  it("skaparen byter namn och arkiverar, och tar fram den igen", async () => {
    await lyckas(updateDoc(doc(som(MEDLEM1), P("demos")), { namn: "Demos 2026" }));
    await lyckas(updateDoc(doc(som(MEDLEM1), P("demos")), { arkiverad: true }));
    await lyckas(updateDoc(doc(som(MEDLEM1), P("demos")), { arkiverad: false, namn: "Demos" }));
  });
  it("ägaren och admin byter namn och arkiverar någon annans plats", async () => {
    await lyckas(updateDoc(doc(som(AGARE), P("live")), { namn: "Live 2026" }));
    await lyckas(updateDoc(doc(som(ADMIN), P("live")), { arkiverad: true }));
    await lyckas(updateDoc(doc(som(ADMIN), P("live")), { arkiverad: false }));
  });
  it("en annan medlem, en utomstående, en annan grupps medlem, en avslutad medlem och en agent ändrar inte", async () => {
    await nekas(updateDoc(doc(som(MEDLEM2), P("demos")), { namn: "Kapad" }));
    await nekas(updateDoc(doc(som(MEDLEM2), P("demos")), { arkiverad: true }));
    await nekas(updateDoc(doc(som(UTOMSTAENDE), P("demos")), { namn: "Kapad" }));
    await nekas(updateDoc(doc(som(GRANNE), P("demos")), { namn: "Kapad" }));
    await nekas(updateDoc(doc(som(AVSLUTAD), P("demos")), { namn: "Kapad" }));
    await nekas(updateDoc(doc(som(AGENT), P("demos")), { namn: "Kapad" }));
  });
  it("gruppen, skaparen, tiden och nya fält står stilla", async () => {
    await nekas(updateDoc(doc(som(MEDLEM1), P("demos")), { groupId: ANDRA }));
    await nekas(updateDoc(doc(som(AGARE), P("demos")), { groupId: ANDRA }));
    await nekas(updateDoc(doc(som(MEDLEM1), P("demos")), { skapadAv: skapare(MEDLEM2) }));
    await nekas(updateDoc(doc(som(AGARE), P("demos")), { skapadAv: skapare(AGARE) }));
    await nekas(updateDoc(doc(som(MEDLEM1), P("demos")), { skapad: Date.now() }));
    await nekas(updateDoc(doc(som(MEDLEM1), P("demos")), { ikon: "mapp" }));
  });
  it("namnet har samma form som vid skapandet", async () => {
    await nekas(updateDoc(doc(som(MEDLEM1), P("demos")), { namn: "" }));
    await nekas(updateDoc(doc(som(MEDLEM1), P("demos")), { namn: "   " }));
    await nekas(updateDoc(doc(som(MEDLEM1), P("demos")), { namn: "a".repeat(61) }));
    await nekas(updateDoc(doc(som(MEDLEM1), P("demos")), { arkiverad: "ja" }));
  });
  it("ingen raderar en plats, inte skaparen och inte ägaren", async () => {
    await nekas(deleteDoc(doc(som(MEDLEM1), P("demos"))));
    await nekas(deleteDoc(doc(som(AGARE), P("demos"))));
    await nekas(deleteDoc(doc(som(ADMIN), P("live"))));
  });
});

/**
 * KOSTNADEN. Ett eget projekt med egna regler: de genererade fragmenten plus ett sondblock som anropar RIKTIGA regelfunktioner och lägger N olika `exists()` efter. Största N som släpps in är
 * marginalen, och tio minus N är vad vägen kostar.
 */
describe("Kostnaden per regelväg, mätt", () => {
  /** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
  let sond;
  /** @type {Record<string, number>} */
  const mat = {};

  before(async () => {
    const regler = fs.readFileSync(path.join(rot, "rules", "provregler.rules"), "utf8");
    const extra = (n) => Array.from({ length: n }, (_, i) => `exists(/databases/$(database)/documents/dummy/d${i})`).join(" && ") || "true";
    const block = [];
    // Varje väg får ett block per N, så att ett anrop mäter exakt N extra uppslag. Samma regelfunktion som den riktiga vägen använder.
    const vagar = {
      plats_las: "opsBibliotekPlatsMedlem(resource.data.groupId)",
      plats_skapa: "opsBibliotekEgenPlatsPerson(resource.data.groupId)",
      plats_admin: "opsBibliotekPlatsAdmin(resource.data.groupId)",
      plats_dok_las: "opsArMedlem(resource.data.groupId)",
      plats_dok_andra: "opsFarAndraPlatsen(resource.data.groupId, resource.data.skapare)",
      plats_dok_skapa: "opsArMedlem(resource.data.groupId) && opsMedlemskapet(resource.data.groupId).data.typ == 'person'",
    };
    for (const [namn, uttryck] of Object.entries(vagar)) {
      for (let n = 0; n <= 10; n += 1) {
        block.push(`    match /sond_${namn}_${n}/{id} { allow read: if ${uttryck} && ${extra(n)}; }`);
      }
    }
    const text = regler.replace("    // ⛔ Catch-all sist", `${block.join("\n")}\n    // ⛔ Catch-all sist`);
    assert.notEqual(text, regler, "sondblocken kom inte med: catch-allen hittades inte i provreglerna");
    sond = await initializeTestEnvironment({
      projectId: "regelprov-kostnad",
      firestore: { rules: text, host: "127.0.0.1", port: 8080 },
    });
    await sond.clearFirestore();
    await sond.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, `memberships/${medlemskapsId(MEDLEM1, CPS)}`), { userId: MEDLEM1, groupId: CPS, roll: "medlem", typ: "person", status: "aktiv" });
      await setDoc(doc(db, `memberships/${medlemskapsId(ADMIN, CPS)}`), { userId: ADMIN, groupId: CPS, roll: "admin", typ: "person", status: "aktiv" });
      // Uppslagen träffar dokument som finns (en `||` mot sant hade inte räknats av emulatorn, mätt).
      for (let i = 0; i < 10; i += 1) await setDoc(doc(db, `dummy/d${i}`), { i });
      for (const namn of Object.keys(vagar)) {
        for (let n = 0; n <= 10; n += 1) {
          await setDoc(doc(db, `sond_${namn}_${n}/r`), { groupId: namn.startsWith("plats_dok") ? CPS : P1, skapare: MEDLEM1 });
        }
      }
    });
  });
  after(async () => {
    await sond?.cleanup();
  });

  /** Största antalet extra uppslag som släpps in, för en väg och en användare. -1 om vägen nekas redan utan extra. */
  async function marginal(namn, uid) {
    let basta = -1;
    for (let n = 0; n <= 10; n += 1) {
      try {
        await assertSucceeds(getDoc(doc(sond.authenticatedContext(uid).firestore(), `sond_${namn}_${n}/r`)));
        basta = n;
      } catch {
        break;
      }
    }
    return basta;
  }

  it("taket är tio: en väg med tio extra uppslag utöver sitt eget nekas (mätningen mäter något)", async () => {
    const m = await marginal("plats_las", MEDLEM1);
    assert.ok(m >= 0 && m < 10, `marginalen ${m} borde vara mellan 0 och 9, annars mäter proven inget`);
  });
  it("en läsning av en post på en egen plats kostar medlemskapet och inget mer", async () => {
    mat.plats_las = 10 - (await marginal("plats_las", MEDLEM1));
    assert.ok(mat.plats_las <= 2, `läsningen kostar ${mat.plats_las} av 10, taket i provet är 2`);
  });
  it("att skapa en post (en person) kostar medlemskapet och inget mer", async () => {
    mat.plats_skapa = 10 - (await marginal("plats_skapa", MEDLEM1));
    assert.ok(mat.plats_skapa <= 2, `skapandet kostar ${mat.plats_skapa} av 10, taket i provet är 2`);
  });
  it("att ändra eller radera som admin kostar medlemskapet och inget mer", async () => {
    mat.plats_admin = 10 - (await marginal("plats_admin", ADMIN));
    assert.ok(mat.plats_admin <= 2, `adminvägen kostar ${mat.plats_admin} av 10, taket i provet är 2`);
  });
  it("platsens dokument: att läsa, skapa och byta namn kostar medlemskapet och inget mer", async () => {
    mat.plats_dok_las = 10 - (await marginal("plats_dok_las", MEDLEM1));
    mat.plats_dok_skapa = 10 - (await marginal("plats_dok_skapa", MEDLEM1));
    mat.plats_dok_andra = 10 - (await marginal("plats_dok_andra", MEDLEM1));
    for (const [v, k] of Object.entries(mat)) assert.ok(k <= 2, `${v} kostar ${k} av 10, taket i provet är 2`);
    console.log(`# kostnad per regelväg (av tio): ${JSON.stringify(mat)}`);
  });
});

describe("Platser: golv", () => {
  it("minst 40 utfall släpptes igenom och minst 60 nekades", () => {
    assert.ok(räknare.ok >= 40, `bara ${räknare.ok} utfall släpptes igenom, golvet är 40`);
    assert.ok(räknare.nej >= 60, `bara ${räknare.nej} utfall nekades, golvet är 60`);
  });
});
