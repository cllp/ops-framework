/**
 * Regelprov för ett ärendes filer (0.122.0, lifehub.app#366 punkt 3, docs/beslut/0007).
 *
 * ⛔ PLATSEN ÄR `arende~<grupp>~<inkorgspostens id>`, och behörigheten är gruppens medlemskap, tolkat ur platsen. Ärendet är posten i appens ärendesamling
 * (här `inkorg`), och regeln kräver att posten finns och hör till platsens grupp, precis som händelsen. Proven prövar varje villkor regeln fick, var och ett så
 * att det går att se falla (regel 4): grönt med regeln, rött när villkoret tas bort (mutationskörningen står i PR-texten).
 *
 *   LÄSA     aktiv medlem i gruppen ja, hela listan ja. Utomstående nej, medlem i en annan grupp nej, avslutad medlem nej. En påhittad plats
 *            (ärendet ligger i en annan grupp) nej, för båda gruppernas medlemmar. En plats vars post inte finns nej. En plats med fel form nej.
 *            En plats som pekar på rätt id i FEL samling (en händelse, eller ett ärende under händelseprefixet) nej.
 *   SKAPA    aktiv medlem som person, som sig själv, en fil i platsens egen sökväg. Utomstående, en annan grupps medlem, avslutad medlem, agent,
 *            påhittad plats, saknad post, anteckning, länk, falskt namn och fel sökväg nej.
 *   ÄNDRA    författaren och admin ja, en annan medlem nej, att flytta posten till en annan plats nej.
 *   RADERA   författaren sin egen, admin och ägare alla. En annan medlem, utomstående och en annan grupps medlem nej.
 *   LAGRING  samma medlemskap, posten måste finnas med samma plats, ingen klient raderar.
 *   GRENARNA  ett medlemskap vars grupp är en plats (`arende~cps-ab~borta`) öppnar ingenting: platsen prövas som ärendeplats och aldrig som en grupp.
 *   HÄNDELSEN RUBBAS INTE  händelsens egna filer läses och skrivs som förut när ärendets gren finns bredvid.
 *
 * Reglerna skrivs av `scripts/skriv-provregler.mjs` ur `bibliotekregelfragment("bibliotek", { handelser: "handelser", arenden: "inkorg" })` och
 * `lagringsregelfragment({ bibliotek: { ..., handelsefiler: true, arendefiler: true } })`.
 *
 * ⛔ PROJEKTET ÄR `regelprov`, inte ett eget. Storage-emulatorn slår upp medlemskapet och posten i Firestore-emulatorns projekt, och ett prov med
 * ett annat projekt-id ser dem inte: alla uppladdningar nekas, också de som ska gå igenom. Samma id som `lagring-bibliotek.test.mjs`.
 *
 * ⛔ GOLV: minst 12 utfall som släpptes igenom och minst 30 som nekades mäts, och provet nedan blir rött annars. Ett prov som nekar allt
 * för att ingenting är utlagt är grönt av fel skäl.
 */

import { medlemskapsId } from "../../src/lib/grupp.js";
import { arendeBibliotek, handelseBibliotek } from "../../src/lib/bibliotek.js";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, deleteDoc as raderaDok, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const AGARE = "uidAgareAf";
const ADMIN = "uidAdminAf";
const MEDLEM1 = "uidMedlem1Af";
const MEDLEM2 = "uidMedlem2Af";
const AVSLUTAD = "uidAvslutadAf";
const AGENT = "uidAgentAf";
const GRANNE = "uidGranneAf";
const UTOMSTAENDE = "uidUtomstaendeAf";
/** Har ett medlemskap vars grupp är en PLATS (`arende~cps-ab~borta`). Inget ramverkskod skapar ett, men ett skydd som vilar på det är inget skydd. */
const FALSK = "uidFalskAf";
const CPS = "cps-ab";
const ANDRA = "andra-ab";

const P1 = arendeBibliotek(CPS, "a1");
const P2 = arendeBibliotek(ANDRA, "a2");
/** Ärende a2 ligger i ANDRA, men platsen säger CPS. Ingen klient kan skapa den, och ingen ska heller kunna läsa den. */
const PFEL = arendeBibliotek(CPS, "a2");
const PSAKNAS = arendeBibliotek(CPS, "borta");
/** Fyra delar i stället för tre. Ärende a1 finns i CPS, så en regel som bara tittade på del 1 och 2 hade släppt in den. Ingen kod bygger en sådan plats. */
const PFYRA = `${P1}~extra`;
/** `h1` finns som HÄNDELSE i CPS men inte som ärende: ett ärendeprefix med ett händelse-id ska nekas. */
const PHANDELSEID = arendeBibliotek(CPS, "h1");
/** `a1` finns som ÄRENDE i CPS men inte som händelse: ett händelseprefix med ett ärende-id ska nekas. */
const PARENDEID = handelseBibliotek(CPS, "a1");
const PHANDELSE = handelseBibliotek(CPS, "h1");

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
    await medlem(FALSK, PSAKNAS);
    await medlem(FALSK, PFYRA);
    // Ärendena är inkorgsposter. Formen på dem är appens; regeln läser bara `groupId`.
    await setDoc(doc(db, "inkorg/a1"), { groupId: CPS, typ: "arende", rubrik: "Köpa biljetter före fredag", status: "ny" });
    await setDoc(doc(db, "inkorg/a2"), { groupId: ANDRA, typ: "arende", rubrik: "Andras ärende", status: "ny" });
    await setDoc(doc(db, "inkorg/a3"), { groupId: CPS, typ: "arende", rubrik: "Tas bort", status: "ny" });
    // En händelse bredvid, för att visa att samlingarna inte blandas ihop åt något håll.
    await setDoc(doc(db, "handelser/h1"), { groupId: CPS, rubrik: "Bio med Selma", datum: "2026-10-24" });
    await setDoc(doc(db, "bibliotek/f1"), fil(P1, MEDLEM1, "f1"));
    await setDoc(doc(db, "bibliotek/f2"), fil(P1, MEDLEM2, "f2"));
    await setDoc(doc(db, "bibliotek/f3"), fil(P1, MEDLEM1, "f3"));
    await setDoc(doc(db, "bibliotek/f4"), fil(P1, MEDLEM1, "f4"));
    await setDoc(doc(db, "bibliotek/g1"), fil(P2, GRANNE, "g1"));
    await setDoc(doc(db, "bibliotek/forfalskad"), fil(PFEL, MEDLEM1, "forfalskad"));
    await setDoc(doc(db, "bibliotek/foralder"), fil(PSAKNAS, MEDLEM1, "foralder"));
    await setDoc(doc(db, "bibliotek/trasig"), fil("arende~cps-ab", MEDLEM1, "trasig"));
    await setDoc(doc(db, "bibliotek/fyradelar"), fil(PFYRA, MEDLEM1, "fyradelar"));
    await setDoc(doc(db, "bibliotek/a3fil"), fil(arendeBibliotek(CPS, "a3"), MEDLEM1, "a3fil"));
    await setDoc(doc(db, "bibliotek/handelseid"), fil(PHANDELSEID, MEDLEM1, "handelseid"));
    await setDoc(doc(db, "bibliotek/arendeid"), fil(PARENDEID, MEDLEM1, "arendeid"));
    await setDoc(doc(db, "bibliotek/hfil"), fil(PHANDELSE, MEDLEM1, "hfil"));
    // Gruppens egen plats ska vara orörd av grenen: samma post som förut, i gruppen.
    await setDoc(doc(db, "bibliotek/gruppens"), fil(CPS, MEDLEM1, "gruppens"));
  });
  // ⛔ OBJEKTEN FINNS, med reglerna avstängda. Ett getBytes på ett objekt som inte finns misslyckas av sig själv, och ett nekat utfall som hade uteblivit
  // ändå mäter ingenting. Med objekten på plats är nekandet reglernas.
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    for (const [plats, id] of [[PSAKNAS, "foralder"], ["arende~cps-ab", "trasig"], [PFYRA, "fyradelar"]]) {
      await uploadBytes(ref(ctx.storage(), `grupper/${plats}/bibliotek/${id}/biljett.pdf`), BYTE, PDF);
    }
  });
});

after(async () => {
  await miljo?.cleanup();
});

describe("Ärendefiler: läsa", () => {
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
  it("en grupps medlem läser inte en annan grupps ärendefiler, och den andra gruppen läser sina", async () => {
    await nekas(getDoc(doc(som(MEDLEM1), "bibliotek/g1")));
    await lyckas(getDoc(doc(som(GRANNE), "bibliotek/g1")));
  });
  it("en påhittad plats öppnar ingenting: ärendet ligger i en annan grupp än platsen säger", async () => {
    // MEDLEM1 är med i CPS (platsens grupp) och GRANNE i ANDRA (ärendets grupp). Ingen av dem läser.
    await nekas(getDoc(doc(som(MEDLEM1), "bibliotek/forfalskad")));
    await nekas(getDoc(doc(som(GRANNE), "bibliotek/forfalskad")));
    await nekas(getDocs(query(collection(som(MEDLEM1), "bibliotek"), where("groupId", "==", PFEL))));
  });
  it("en plats vars ärende inte finns läses inte, och en plats med fel form inte heller", async () => {
    await nekas(getDoc(doc(som(MEDLEM1), "bibliotek/foralder")));
    await nekas(getDoc(doc(som(MEDLEM1), "bibliotek/trasig")));
    await nekas(getDoc(doc(som(MEDLEM1), "bibliotek/fyradelar")));
    await nekas(setDoc(doc(som(MEDLEM1), "bibliotek/fyra-ny"), fil(PFYRA, MEDLEM1, "fyra-ny")));
  });
  it("ärendet slås upp i ärendesamlingen och händelsen i händelsesamlingen, inte tvärtom", async () => {
    // h1 är en händelse i CPS men inget ärende, a1 är ett ärende i CPS men ingen händelse. Fel samling för id:t är ingen post.
    await nekas(getDoc(doc(som(MEDLEM1), "bibliotek/handelseid")));
    await nekas(getDoc(doc(som(MEDLEM1), "bibliotek/arendeid")));
    await nekas(setDoc(doc(som(MEDLEM1), "bibliotek/x20"), fil(PHANDELSEID, MEDLEM1, "x20")));
    await nekas(setDoc(doc(som(MEDLEM1), "bibliotek/x21"), fil(PARENDEID, MEDLEM1, "x21")));
  });
  it("ett medlemskap vars grupp är själva platsen öppnar ingenting: grenarna utesluter varandra", async () => {
    // FALSK är "aktiv medlem" i grupperna `arende~cps-ab~borta` och `arende~cps-ab~a1~extra`. Prövades platsen också som en grupp släpptes hen in; ärendegrenen nekar.
    await nekas(getDoc(doc(som(FALSK), "bibliotek/foralder")));
    await nekas(getDoc(doc(som(FALSK), "bibliotek/fyradelar")));
    await nekas(setDoc(doc(som(FALSK), "bibliotek/x30"), fil(PSAKNAS, FALSK, "x30")));
    await nekas(getBytes(ref(lagringSom(FALSK), `grupper/${PSAKNAS}/bibliotek/foralder/biljett.pdf`)));
    await nekas(getBytes(ref(lagringSom(FALSK), `grupper/${PFYRA}/bibliotek/fyradelar/biljett.pdf`)));
  });
  it("när ärendet tas bort med Admin SDK blir filerna osynliga för klienten direkt", async () => {
    await lyckas(getDoc(doc(som(MEDLEM1), "bibliotek/a3fil")));
    await miljo.withSecurityRulesDisabled((ctx) => raderaDok(doc(ctx.firestore(), "inkorg/a3")));
    await nekas(getDoc(doc(som(MEDLEM1), "bibliotek/a3fil")));
  });
  it("gruppens egen plats och en händelses plats läses som förut", async () => {
    await lyckas(getDoc(doc(som(MEDLEM2), "bibliotek/gruppens")));
    await nekas(getDoc(doc(som(UTOMSTAENDE), "bibliotek/gruppens")));
    await lyckas(getDoc(doc(som(MEDLEM2), "bibliotek/hfil")));
    await nekas(getDoc(doc(som(UTOMSTAENDE), "bibliotek/hfil")));
  });
});

describe("Ärendefiler: skapa", () => {
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
  it("ingen skapar under en påhittad plats eller under ett ärende som inte finns", async () => {
    await nekas(setDoc(doc(som(MEDLEM1), "bibliotek/x5"), fil(PFEL, MEDLEM1, "x5")));
    await nekas(setDoc(doc(som(GRANNE), "bibliotek/x5b"), fil(PFEL, GRANNE, "x5b")));
    await nekas(setDoc(doc(som(MEDLEM1), "bibliotek/x6"), fil(PSAKNAS, MEDLEM1, "x6")));
  });
  it("ett ärendes bibliotek har bara filer: en anteckning eller en länk nekas", async () => {
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
  it("en händelses plats tar fortfarande emot sin fil, bredvid ärendets gren", async () => {
    await lyckas(setDoc(doc(som(MEDLEM1), "bibliotek/hny"), fil(PHANDELSE, MEDLEM1, "hny")));
    await nekas(setDoc(doc(som(UTOMSTAENDE), "bibliotek/hx"), fil(PHANDELSE, UTOMSTAENDE, "hx")));
  });
});

describe("Ärendefiler: ändra och radera", () => {
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

describe("Ärendefiler: lagring", () => {
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
    await nekas(getBytes(ref(lagringSom(MEDLEM1), vag("arende~cps-ab", "trasig"))));
    await nekas(getBytes(ref(lagringSom(MEDLEM1), vag(PFYRA, "fyradelar"))));
    await nekas(uploadBytes(ref(lagringSom(MEDLEM1), vag(PFYRA, "fyradelar")), BYTE, PDF));
    await nekas(uploadBytes(ref(lagringSom(MEDLEM1), vag("arende~cps-ab", "trasig")), BYTE, PDF));
  });
  it("ingen klient raderar en fil, inte ens författaren", async () => {
    await nekas(deleteObject(ref(lagringSom(MEDLEM1), vag(P1, "ny1"))));
    await nekas(deleteObject(ref(lagringSom(ADMIN), vag(P1, "ny1"))));
  });
  it("en händelses plats laddar upp och läser som förut", async () => {
    await lyckas(uploadBytes(ref(lagringSom(MEDLEM1), vag(PHANDELSE, "hfil")), BYTE, PDF));
    await lyckas(getBytes(ref(lagringSom(MEDLEM2), vag(PHANDELSE, "hfil"))));
    await nekas(getBytes(ref(lagringSom(UTOMSTAENDE), vag(PHANDELSE, "hfil"))));
  });
});

describe("Ärendefiler: golv", () => {
  it("minst 12 utfall släpptes igenom och minst 30 nekades", () => {
    assert.ok(räknare.ok >= 12, `bara ${räknare.ok} utfall släpptes igenom, golvet är 12`);
    assert.ok(räknare.nej >= 30, `bara ${räknare.nej} utfall nekades, golvet är 30`);
  });
});
