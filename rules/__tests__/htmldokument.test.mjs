/**
 * Regelprov för HTML-dokument och deras versioner (0.156.0, cllp/ops-framework#472).
 *
 * ⛔ TRE SAKER PROVAS, OCH DE HÖR IHOP:
 *
 *   POSTEN       en filpost med MIME text/html byter aldrig fil, byte eller MIME utan att samma skrivning går vidare till nästa version OCH skriver versionsdokumentet för den ersatta. Fältet `version` finns aldrig
 *                när posten skapas, och bara på ett HTML-dokument.
 *   VERSIONERNA  `<samling>/{postId}|{nr}`: läses av platsens medlemmar, skrivs bara tillsammans med att posten går vidare, och är exakt posten som den var. Aldrig ändra, aldrig radera.
 *   LAGRINGEN    en HTML-fil laddas bara upp som `attachment`, och ett HTML-objekt skrivs aldrig över. En vanlig fil beter sig som förut.
 *
 * ⛔ KOSTNADEN ÄR MÄTT: de genererade reglerna får ett extra `exists()`-uttryck per N och största N som släpps in ger marginalen (som i platser.test.mjs), för både versionsdokumentets skapande och postens versionssteg.
 *
 * ⛔ GOLV: minst 20 utfall som släpptes igenom och minst 45 som nekades, och provet längst ned är rött annars (varje utfall är ett riktigt anrop mot emulatorn).
 *
 * Reglerna skrivs av `scripts/skriv-provregler.mjs` (`bibliotekregelfragment` med `versioner: "bibliotekversioner"` och `versionsregelfragment`).
 */

import { medlemskapsId } from "../../src/lib/grupp.js";
import { mittBibliotek } from "../../src/lib/bibliotek.js";
import { versionsnyckel } from "../../src/lib/htmldokument.js";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { getMetadata, ref, uploadBytes } from "firebase/storage";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const SKAPARE = "uidSkapareHtml";
const ADMIN = "uidAdminHtml";
const ANNAN = "uidAnnanHtml";
const UTOMSTAENDE = "uidUtomstaendeHtml";
const GRANNE = "uidGranneHtml";
const CPS = "cps-ab";
const ANDRA = "andra-ab";
const MIN = mittBibliotek(SKAPARE);

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
const html = (id, namn = "rapport.html") => ({ sokvag: `grupper/${CPS}/bibliotek/${id}/${namn}`, namn: "rapport.html", mime: "text/html", byte: 40, klar: true });
const htmlpost = (plats, uid, id, extra = {}) => {
  const nu = Date.now();
  return {
    groupId: plats,
    typ: "fil",
    rubrik: "Rapport",
    fil: { sokvag: `grupper/${plats}/bibliotek/${id}/rapport.html`, namn: "rapport.html", mime: "text/html", byte: 40, klar: true },
    skapadAv: skapare(uid),
    skapad: nu,
    andrad: nu,
    ...extra,
  };
};
const pdfpost = (plats, uid, id) => htmlpost(plats, uid, id, { fil: { sokvag: `grupper/${plats}/bibliotek/${id}/kvitto.pdf`, namn: "kvitto.pdf", mime: "application/pdf", byte: 4 } });

/** Postens nya tillstånd efter ett versionssteg: ny fil, version { nr, av, tid }, andrad. */
function steg(post, id, { nr, uid = SKAPARE, plats = post.groupId, fil, tid, andrad = Date.now() } = {}) {
  return {
    ...post,
    fil: fil ?? { ...post.fil, sokvag: `grupper/${plats}/bibliotek/${id}/v${nr}-rapport.html`, byte: 41 },
    version: { nr, av: skapare(uid), tid: tid ?? andrad },
    andrad,
  };
}
/** Versionsdokumentet för den ersatta versionen: exakt posten som den var. */
function versionsdok(post, id, nr, extra = {}) {
  return { groupId: post.groupId, postId: id, nr, fil: post.fil, av: post.version ? post.version.av : post.skapadAv, tid: post.version ? post.version.tid : post.skapad, ...extra };
}

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;
const som = (uid) => miljo.authenticatedContext(uid).firestore();
const lagringSom = (uid) => miljo.authenticatedContext(uid).storage();

/** En post som finns när proven börjar, skriven med reglerna avstängda. Returnerar den. */
async function sata(id, post) {
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `bibliotek/${id}`), post);
  });
  return post;
}
/** Ett versionssteg som en batch, som klienten skriver det. */
async function stegSom(uid, id, fore, efter, dok = versionsdok(fore, id, fore.version?.nr ?? 1)) {
  const db = som(uid);
  const b = writeBatch(db);
  b.update(doc(db, `bibliotek/${id}`), efter);
  b.set(doc(db, `bibliotekversioner/${dok.postId}|${dok.nr}`), dok);
  return b.commit();
}

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
    const medlem = (uid, gid, extra = {}) => setDoc(doc(db, `memberships/${medlemskapsId(uid, gid)}`), { userId: uid, groupId: gid, roll: "medlem", typ: "person", status: "aktiv", ...extra });
    await medlem(SKAPARE, CPS);
    await medlem(ADMIN, CPS, { roll: "admin" });
    await medlem(ANNAN, CPS);
    await medlem(GRANNE, ANDRA);
    // Skaparen är också medlem i en andra grupp: ett versionsdokument vars plats är den andra gruppen får inte släppas in av att hen får skriva där.
    await medlem(SKAPARE, ANDRA);
  });
});

after(async () => {
  await miljo?.cleanup();
});

describe("HTML-dokumentet: skapa och ändra utan att byta fil", () => {
  it("en medlem skapar ett HTML-dokument, och i Mitt bibliotek också", async () => {
    await lyckas(setDoc(doc(som(SKAPARE), "bibliotek/c1"), htmlpost(CPS, SKAPARE, "c1")));
    await lyckas(setDoc(doc(som(SKAPARE), "bibliotek/c2"), htmlpost(MIN, SKAPARE, "c2")));
  });
  it("en ny post har aldrig fältet version: numret räknas bara upp av ett steg", async () => {
    await nekas(setDoc(doc(som(SKAPARE), "bibliotek/c3"), htmlpost(CPS, SKAPARE, "c3", { version: { nr: 2, av: skapare(SKAPARE), tid: Date.now() } })));
    await nekas(setDoc(doc(som(SKAPARE), "bibliotek/c4"), { ...pdfpost(CPS, SKAPARE, "c4"), version: { nr: 2, av: skapare(SKAPARE), tid: Date.now() } }));
  });
  it("rubriken och taggarna går att ändra på ett HTML-dokument, och klar går från falskt till sant", async () => {
    await sata("m1", htmlpost(CPS, SKAPARE, "m1", { fil: { ...html("m1"), klar: false } }));
    await lyckas(updateDoc(doc(som(SKAPARE), "bibliotek/m1"), { rubrik: "Ny rubrik", taggar: ["rapport"], andrad: Date.now() }));
    await lyckas(updateDoc(doc(som(SKAPARE), "bibliotek/m1"), { "fil.klar": true, andrad: Date.now() }));
  });
  it("⛔ en fil byts inte utan version: sökväg, storlek och MIME står stilla, för skaparen och admin", async () => {
    const p = await sata("b1", htmlpost(CPS, SKAPARE, "b1"));
    await nekas(updateDoc(doc(som(SKAPARE), "bibliotek/b1"), { "fil.sokvag": `grupper/${CPS}/bibliotek/b1/ny.html`, andrad: Date.now() }));
    await nekas(updateDoc(doc(som(ADMIN), "bibliotek/b1"), { "fil.sokvag": `grupper/${CPS}/bibliotek/b1/ny.html`, andrad: Date.now() }));
    await nekas(updateDoc(doc(som(SKAPARE), "bibliotek/b1"), { "fil.byte": 99, andrad: Date.now() }));
    await nekas(updateDoc(doc(som(SKAPARE), "bibliotek/b1"), { "fil.mime": "text/plain", andrad: Date.now() }));
    await nekas(updateDoc(doc(som(SKAPARE), "bibliotek/b1"), { fil: { ...p.fil, sokvag: `grupper/${CPS}/bibliotek/b1/ny.html` }, andrad: Date.now() }));
  });
  it("⛔ ett fält version sätts inte utan att filen byts (ett påhittat nummer)", async () => {
    await sata("b2", htmlpost(CPS, SKAPARE, "b2"));
    await nekas(updateDoc(doc(som(SKAPARE), "bibliotek/b2"), { version: { nr: 2, av: skapare(SKAPARE), tid: Date.now() }, andrad: Date.now() }));
  });
  it("en vanlig fil byter fortfarande fil som förut", async () => {
    await sata("p1", pdfpost(CPS, SKAPARE, "p1"));
    await lyckas(updateDoc(doc(som(SKAPARE), "bibliotek/p1"), { "fil.sokvag": `grupper/${CPS}/bibliotek/p1/nytt.pdf`, "fil.byte": 9, andrad: Date.now() }));
  });
  it("en PDF blir inte ett HTML-dokument med version", async () => {
    await sata("p2", pdfpost(CPS, SKAPARE, "p2"));
    const efter = { ...pdfpost(CPS, SKAPARE, "p2"), fil: html("p2"), version: { nr: 2, av: skapare(SKAPARE), tid: Date.now() } };
    await nekas(updateDoc(doc(som(SKAPARE), "bibliotek/p2"), efter));
  });
});

describe("HTML-dokumentet: ett versionssteg", () => {
  it("⛔ skaparen går från version 1 till 2: posten och versionsdokumentet i samma skrivning", async () => {
    const fore = await sata("s1", htmlpost(CPS, SKAPARE, "s1"));
    await lyckas(stegSom(SKAPARE, "s1", fore, steg(fore, "s1", { nr: 2 })));
    const rad = (await getDoc(doc(som(SKAPARE), "bibliotek/s1"))).data();
    assert.equal(rad.version.nr, 2);
    const v1 = (await getDoc(doc(som(SKAPARE), "bibliotekversioner/s1|1"))).data();
    assert.equal(v1.fil.sokvag, fore.fil.sokvag);
  });
  it("en andra uppdatering går från 2 till 3, och version 2:s dokument bär 2:s skrivare och tid", async () => {
    const fore = await sata("s2", htmlpost(CPS, SKAPARE, "s2"));
    const v2 = steg(fore, "s2", { nr: 2 });
    await lyckas(stegSom(SKAPARE, "s2", fore, v2));
    const hamtad = (await getDoc(doc(som(SKAPARE), "bibliotek/s2"))).data();
    await lyckas(stegSom(SKAPARE, "s2", hamtad, steg(hamtad, "s2", { nr: 3, fil: { ...hamtad.fil, sokvag: `grupper/${CPS}/bibliotek/s2/v3-rapport.html` } })));
    const doc2 = (await getDoc(doc(som(SKAPARE), "bibliotekversioner/s2|2"))).data();
    assert.equal(doc2.fil.sokvag, `grupper/${CPS}/bibliotek/s2/v2-rapport.html`);
    assert.equal(doc2.av.uid, SKAPARE);
    assert.equal(doc2.tid, v2.version.tid);
  });
  it("admin uppdaterar någon annans dokument, en annan medlem och en utomstående gör det inte", async () => {
    const fore = await sata("s3", htmlpost(CPS, SKAPARE, "s3"));
    await nekas(stegSom(ANNAN, "s3", fore, steg(fore, "s3", { nr: 2, uid: ANNAN })));
    await nekas(stegSom(UTOMSTAENDE, "s3", fore, steg(fore, "s3", { nr: 2, uid: UTOMSTAENDE })));
    await nekas(stegSom(GRANNE, "s3", fore, steg(fore, "s3", { nr: 2, uid: GRANNE })));
    await lyckas(stegSom(ADMIN, "s3", fore, steg(fore, "s3", { nr: 2, uid: ADMIN })));
  });
  it("⛔ utan versionsdokumentet nekas steget (historiken kan inte lämnas efter sig)", async () => {
    const fore = await sata("s4", htmlpost(CPS, SKAPARE, "s4"));
    await nekas(updateDoc(doc(som(SKAPARE), "bibliotek/s4"), steg(fore, "s4", { nr: 2 })));
  });
  it("⛔ ett versionsdokument som inte är exakt posten som den var nekas", async () => {
    const fore = await sata("s5", htmlpost(CPS, SKAPARE, "s5"));
    const efter = steg(fore, "s5", { nr: 2 });
    await nekas(stegSom(SKAPARE, "s5", fore, efter, versionsdok(fore, "s5", 1, { fil: { ...fore.fil, byte: 1 } })));
    await nekas(stegSom(SKAPARE, "s5", fore, efter, versionsdok(fore, "s5", 1, { fil: { ...fore.fil, sokvag: `grupper/${CPS}/bibliotek/s5/annan.html` } })));
    await nekas(stegSom(SKAPARE, "s5", fore, efter, versionsdok(fore, "s5", 1, { av: skapare(ANNAN) })));
    await nekas(stegSom(SKAPARE, "s5", fore, efter, versionsdok(fore, "s5", 1, { tid: fore.skapad + 1 })));
    await nekas(stegSom(SKAPARE, "s5", fore, efter, versionsdok(fore, "s5", 1, { groupId: ANDRA })));
    await nekas(stegSom(SKAPARE, "s5", fore, efter, versionsdok(fore, "s5", 1, { extra: 1 })));
    await nekas(stegSom(SKAPARE, "s5", fore, efter, versionsdok(fore, "s5", 2)));
    await nekas(stegSom(SKAPARE, "s5", fore, efter, versionsdok(fore, "s5", 1, { postId: "annan" })));
  });
  it("⛔ ett versionsdokument för en annan plats än postens nekas, också för den som är medlem i båda", async () => {
    const fore = await sata("s5b", htmlpost(CPS, SKAPARE, "s5b"));
    await nekas(stegSom(SKAPARE, "s5b", fore, steg(fore, "s5b", { nr: 2 }), versionsdok(fore, "s5b", 1, { groupId: ANDRA })));
  });
  it("⛔ inga löst hängande dokument i samma skrivning: fel nyckel eller fel nummer nekas även när allt annat stämmer", async () => {
    const fore = await sata("s5c", htmlpost(CPS, SKAPARE, "s5c"));
    const efter = steg(fore, "s5c", { nr: 2 });
    for (const [namn, extra] of [["s5c-lös", versionsdok(fore, "s5c", 1)], ["s5c|7", versionsdok(fore, "s5c", 7)]]) {
      const db = som(SKAPARE);
      const b = writeBatch(db);
      b.update(doc(db, "bibliotek/s5c"), efter);
      b.set(doc(db, "bibliotekversioner/s5c|1"), versionsdok(fore, "s5c", 1));
      b.set(doc(db, `bibliotekversioner/${namn}`), extra);
      await nekas(b.commit());
    }
    // Och bara det riktiga dokumentet går in.
    await lyckas(stegSom(SKAPARE, "s5c", fore, efter));
  });
  it("⛔ ett versionsdokument skrivs inte i förväg, inte ens för en post som redan har en version", async () => {
    const fore = await sata("s5d", htmlpost(CPS, SKAPARE, "s5d"));
    const v2 = steg(fore, "s5d", { nr: 2 });
    await lyckas(stegSom(SKAPARE, "s5d", fore, v2));
    const nu = (await getDoc(doc(som(SKAPARE), "bibliotek/s5d"))).data();
    const db = som(SKAPARE);
    const b = writeBatch(db);
    b.update(doc(db, "bibliotek/s5d"), { rubrik: "Bara en rubrik", andrad: Date.now() });
    b.set(doc(db, "bibliotekversioner/s5d|2"), versionsdok(nu, "s5d", 2));
    await nekas(b.commit());
  });
  it("⛔ en vanlig fil får inget versionsdokument, inte ens när dess fil byts i samma skrivning", async () => {
    const fore = await sata("s5e", pdfpost(CPS, SKAPARE, "s5e"));
    const db = som(SKAPARE);
    const b = writeBatch(db);
    b.update(doc(db, "bibliotek/s5e"), { "fil.sokvag": `grupper/${CPS}/bibliotek/s5e/nytt.pdf`, andrad: Date.now() });
    b.set(doc(db, "bibliotekversioner/s5e|1"), versionsdok(fore, "s5e", 1));
    await nekas(b.commit());
    // Utan dokumentet går bytet som förut.
    await lyckas(updateDoc(doc(som(SKAPARE), "bibliotek/s5e"), { "fil.sokvag": `grupper/${CPS}/bibliotek/s5e/nytt.pdf`, andrad: Date.now() }));
  });
  it("⛔ rätt nummer, rätt skrivare, rätt tid och en ny fil krävs på posten", async () => {
    const fore = await sata("s6", htmlpost(CPS, SKAPARE, "s6"));
    await nekas(stegSom(SKAPARE, "s6", fore, steg(fore, "s6", { nr: 3 })));
    await nekas(stegSom(SKAPARE, "s6", fore, steg(fore, "s6", { nr: 1 })));
    await nekas(stegSom(SKAPARE, "s6", fore, steg(fore, "s6", { nr: 2, uid: ANNAN })));
    await nekas(stegSom(SKAPARE, "s6", fore, steg(fore, "s6", { nr: 2, tid: Date.now() - 1000 })));
    await nekas(stegSom(SKAPARE, "s6", fore, { ...steg(fore, "s6", { nr: 2 }), fil: fore.fil }));
    await nekas(stegSom(SKAPARE, "s6", fore, { ...steg(fore, "s6", { nr: 2 }), fil: { ...steg(fore, "s6", { nr: 2 }).fil, mime: "application/pdf" } }));
  });
  it("⛔ ett versionsdokument skrivs inte utan att posten går vidare", async () => {
    const fore = await sata("s7", htmlpost(CPS, SKAPARE, "s7"));
    await nekas(setDoc(doc(som(SKAPARE), "bibliotekversioner/s7|1"), versionsdok(fore, "s7", 1)));
    const db = som(SKAPARE);
    const b = writeBatch(db);
    b.update(doc(db, "bibliotek/s7"), { rubrik: "Bara en rubrik", andrad: Date.now() });
    b.set(doc(db, "bibliotekversioner/s7|1"), versionsdok(fore, "s7", 1));
    await nekas(b.commit());
  });
  it("⛔ två som uppdaterar ur samma version: den andra får en konflikt, aldrig en tyst överskrivning", async () => {
    const fore = await sata("s8", htmlpost(CPS, SKAPARE, "s8"));
    await lyckas(stegSom(SKAPARE, "s8", fore, steg(fore, "s8", { nr: 2 })));
    // Den andra utgick också från version 1 och vill skriva samma nummer med en annan fil.
    await nekas(stegSom(ADMIN, "s8", fore, steg(fore, "s8", { nr: 2, uid: ADMIN, fil: { ...fore.fil, sokvag: `grupper/${CPS}/bibliotek/s8/admin.html` } })));
    const rad = (await getDoc(doc(som(SKAPARE), "bibliotek/s8"))).data();
    assert.equal(rad.version.nr, 2);
    assert.ok(rad.fil.sokvag.endsWith("v2-rapport.html"));
  });
  it("Mitt bibliotek: ägaren uppdaterar sitt eget, en annan inte", async () => {
    const fore = await sata("s9", htmlpost(MIN, SKAPARE, "s9"));
    await nekas(stegSom(ANNAN, "s9", fore, steg(fore, "s9", { nr: 2, uid: ANNAN })));
    await lyckas(stegSom(SKAPARE, "s9", fore, steg(fore, "s9", { nr: 2 })));
  });
  it("fältet version är en person, nr 2 eller högre, och inga andra fält", async () => {
    const fore = await sata("s10", htmlpost(CPS, SKAPARE, "s10"));
    const bas = steg(fore, "s10", { nr: 2 });
    await nekas(stegSom(SKAPARE, "s10", fore, { ...bas, version: { ...bas.version, extra: 1 } }));
    await nekas(stegSom(SKAPARE, "s10", fore, { ...bas, version: { ...bas.version, av: { ...bas.version.av, typ: "agent" } } }));
    await nekas(stegSom(SKAPARE, "s10", fore, { ...bas, version: { ...bas.version, tid: "nu" } }));
  });
});

describe("Versionsdokumenten: läsa, ändra, radera", () => {
  let fore;
  before(async () => {
    fore = await sata("v1", htmlpost(CPS, SKAPARE, "v1"));
    await stegSom(SKAPARE, "v1", fore, steg(fore, "v1", { nr: 2 }));
  });
  it("platsens medlemmar läser, en utomstående och en annan grupps medlem inte", async () => {
    await lyckas(getDoc(doc(som(SKAPARE), "bibliotekversioner/v1|1")));
    await lyckas(getDoc(doc(som(ANNAN), "bibliotekversioner/v1|1")));
    await lyckas(getDoc(doc(som(ADMIN), "bibliotekversioner/v1|1")));
    await nekas(getDoc(doc(som(UTOMSTAENDE), "bibliotekversioner/v1|1")));
    await nekas(getDoc(doc(som(GRANNE), "bibliotekversioner/v1|1")));
    await nekas(getDoc(doc(miljo.unauthenticatedContext().firestore(), "bibliotekversioner/v1|1")));
  });
  it("⛔ aldrig ändra och aldrig radera, inte heller admin eller den som skrev det", async () => {
    for (const uid of [SKAPARE, ADMIN, ANNAN]) {
      await nekas(updateDoc(doc(som(uid), "bibliotekversioner/v1|1"), { tid: 1 }));
      await nekas(setDoc(doc(som(uid), "bibliotekversioner/v1|1"), versionsdok(fore, "v1", 1)));
      await nekas(deleteDoc(doc(som(uid), "bibliotekversioner/v1|1")));
    }
  });
  it("nyckeln är postId och nr: ett dokument med fel nyckel skrivs inte", async () => {
    const f2 = await sata("v2", htmlpost(CPS, SKAPARE, "v2"));
    const db = som(SKAPARE);
    const b = writeBatch(db);
    b.update(doc(db, "bibliotek/v2"), steg(f2, "v2", { nr: 2 }));
    b.set(doc(db, "bibliotekversioner/v2-1"), versionsdok(f2, "v2", 1));
    await nekas(b.commit());
    assert.equal(versionsnyckel("v2", 1), "v2|1");
  });
});

describe("Lagringen: HTML som bilaga och oföränderlig", () => {
  const sok = (id, namn) => ref(lagringSom(SKAPARE), `grupper/${CPS}/bibliotek/${id}/${namn}`);
  const BYTE = new TextEncoder().encode("<p>Hej</p>");
  const bilaga = { contentType: "text/html; charset=utf-8", contentDisposition: 'attachment; filename="rapport.html"; filename*=UTF-8\'\'rapport.html' };
  before(async () => {
    for (const id of ["h1", "h2", "h3", "h4", "h5", "h6"]) await sata(id, htmlpost(CPS, SKAPARE, id));
  });
  it("en HTML-fil med attachment går in, med och utan teckenkodning, och bär rubriken efteråt", async () => {
    await lyckas(uploadBytes(sok("h1", "rapport.html"), BYTE, bilaga));
    await lyckas(uploadBytes(sok("h2", "rapport.html"), BYTE, { contentType: "text/html", contentDisposition: "attachment" }));
    const meta = await getMetadata(sok("h1", "rapport.html"));
    assert.equal(meta.contentType, "text/html; charset=utf-8");
    assert.match(meta.contentDisposition, /^attachment/);
  });
  it("⛔ en HTML-fil utan attachment nekas: utan rubrik, med inline och med något annat", async () => {
    await nekas(uploadBytes(sok("h3", "a.html"), BYTE, { contentType: "text/html; charset=utf-8" }));
    await nekas(uploadBytes(sok("h3", "b.html"), BYTE, { contentType: "text/html", contentDisposition: "inline" }));
    await nekas(uploadBytes(sok("h3", "c.html"), BYTE, { contentType: "text/html", contentDisposition: 'inline; filename="x.html"' }));
    await nekas(uploadBytes(sok("h3", "d.html"), BYTE, { contentType: "text/html", contentDisposition: "xattachment" }));
  });
  it("⛔ ett HTML-objekt skrivs aldrig över, men en ny version får en ny sökväg", async () => {
    await lyckas(uploadBytes(sok("h4", "rapport.html"), BYTE, bilaga));
    await nekas(uploadBytes(sok("h4", "rapport.html"), new TextEncoder().encode("<p>Annat</p>"), bilaga));
    await lyckas(uploadBytes(sok("h4", "v2-rapport.html"), new TextEncoder().encode("<p>Annat</p>"), bilaga));
  });
  it("en annan medlem skriver inte HTML i någon annans post, och en utomstående inte alls", async () => {
    await nekas(uploadBytes(ref(lagringSom(ANNAN), `grupper/${CPS}/bibliotek/h5/rapport.html`), BYTE, bilaga));
    await nekas(uploadBytes(ref(lagringSom(UTOMSTAENDE), `grupper/${CPS}/bibliotek/h5/rapport.html`), BYTE, bilaga));
    await lyckas(uploadBytes(ref(lagringSom(ADMIN), `grupper/${CPS}/bibliotek/h5/rapport.html`), BYTE, bilaga));
  });
  it("en PDF och en textfil beter sig som förut: inget kräver attachment, och de går att skriva över", async () => {
    await sata("h6", pdfpost(CPS, SKAPARE, "h6"));
    const pdf = new Uint8Array([37, 80, 68, 70]);
    await lyckas(uploadBytes(sok("h6", "kvitto.pdf"), pdf, { contentType: "application/pdf" }));
    await lyckas(uploadBytes(sok("h6", "kvitto.pdf"), pdf, { contentType: "application/pdf" }));
    await lyckas(uploadBytes(sok("h6", "a.txt"), BYTE, { contentType: "text/plain; charset=utf-8" }));
    await lyckas(uploadBytes(sok("h6", "a.txt"), BYTE, { contentType: "text/plain" }));
  });
  it("en annan innehållstyp som liknar HTML släpps inte in", async () => {
    await nekas(uploadBytes(sok("h6", "x.xhtml"), BYTE, { contentType: "application/xhtml+xml", contentDisposition: "attachment" }));
    await nekas(uploadBytes(sok("h6", "y.html"), BYTE, { contentType: "text/html; charset=iso-8859-1", contentDisposition: "attachment" }));
  });
});

/**
 * KOSTNADEN. Eget projekt med egna regler: de genererade fragmenten där ETT uttryck med N extra `exists()` läggs till i versionsdokumentets create-regel eller i postens versionssteg. Största N som släpps in är marginalen,
 * och tio minus N är vad vägen kostar. Varje mätning är ett riktigt versionssteg (en batch) mot en färsk post.
 */
describe("Kostnaden per regelväg, mätt", () => {
  const regler = () => fs.readFileSync(path.join(rot, "rules", "provregler.rules"), "utf8");
  const extra = (n) => Array.from({ length: n }, (_, i) => `exists(/databases/$(database)/documents/dummy/d${i})`).join(" && ");
  const mat = {};

  /** Ett versionssteg mot regler där `ersatt` fått n extra uppslag. Sant om det släpps in. */
  async function steget(ersatt, n, id) {
    const text = regler();
    const ny = text.replace(ersatt.fran, ersatt.till(n));
    assert.ok(text.includes(ersatt.fran), `ersättningen hittades inte: ${ersatt.fran}`);
    if (n > 0) assert.notEqual(ny, text, "ersättningen ändrade inget");
    const sond = await initializeTestEnvironment({ projectId: `regelprov-kostnad-${id}`, firestore: { rules: ny, host: "127.0.0.1", port: 8080 } });
    try {
      await sond.clearFirestore();
      const fore = htmlpost(CPS, SKAPARE, "k");
      await sond.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, `memberships/${medlemskapsId(SKAPARE, CPS)}`), { userId: SKAPARE, groupId: CPS, roll: "medlem", typ: "person", status: "aktiv" });
        for (let i = 0; i < 10; i += 1) await setDoc(doc(db, `dummy/d${i}`), { i });
        await setDoc(doc(db, "bibliotek/k"), fore);
      });
      const db = sond.authenticatedContext(SKAPARE).firestore();
      const b = writeBatch(db);
      b.update(doc(db, "bibliotek/k"), steg(fore, "k", { nr: 2 }));
      b.set(doc(db, "bibliotekversioner/k|1"), versionsdok(fore, "k", 1));
      try {
        await assertSucceeds(b.commit());
        return true;
      } catch {
        return false;
      }
    } finally {
      await sond.cleanup();
    }
  }
  async function marginal(ersatt, namn) {
    let basta = -1;
    for (let n = 0; n <= 10; n += 1) {
      if (await steget(ersatt, n, `${namn}${n}`)) basta = n;
      else break;
    }
    return basta;
  }

  const VERSIONSDOK = { fran: "allow create: if opsBibliotekVersionsdokGiltig(request.resource.data, id);", till: (n) => `allow create: if opsBibliotekVersionsdokGiltig(request.resource.data, id)${n ? ` && ${extra(n)}` : ""};` };
  const POSTSTEG = { fran: "&& opsBibliotekHtmlSteg(resource.data, request.resource.data, id)", till: (n) => `&& opsBibliotekHtmlSteg(resource.data, request.resource.data, id)${n ? ` && ${extra(n)}` : ""}` };

  it("taket är tio: mätningen mäter något (marginalen är mellan 0 och 9)", async () => {
    const m = await marginal(VERSIONSDOK, "t");
    assert.ok(m >= 0 && m < 10, `marginalen ${m} borde vara mellan 0 och 9`);
  });
  it("versionsdokumentets skapande och postens versionssteg kostar högst fem av tio vardera", async () => {
    mat.versionsdokument = 10 - (await marginal(VERSIONSDOK, "d"));
    mat.versionssteg_pa_posten = 10 - (await marginal(POSTSTEG, "p"));
    for (const [v, k] of Object.entries(mat)) assert.ok(k <= 5, `${v} kostar ${k} av 10, taket i provet är 5`);
    console.log(`# kostnad per regelväg (av tio): ${JSON.stringify(mat)}`);
  });
});

describe("HTML: golv", () => {
  it("minst 20 utfall släpptes igenom och minst 45 nekades", () => {
    console.log(`# utfall: ${räknare.ok} släpptes igenom, ${räknare.nej} nekades`);
    assert.ok(räknare.ok >= 20, `bara ${räknare.ok} utfall släpptes igenom, golvet är 20`);
    assert.ok(räknare.nej >= 45, `bara ${räknare.nej} utfall nekades, golvet är 45`);
  });
});
