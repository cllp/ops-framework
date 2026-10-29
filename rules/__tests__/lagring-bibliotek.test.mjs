/**
 * Storage-regelprov för bibliotekets filer (granskningen av PR 365, 0.101.0).
 *
 * ⛔ FÖRSTA STORAGE-PROVET I RAMVERKET. `lagringsregelfragment({ bibliotek })` hade inget prov i något repo. Proven nedan kör mot
 * storage-emulatorn, med Firestore-emulatorn bredvid, eftersom regeln slår upp posten och medlemskapet där (`firestore.get`).
 *
 *   MITT      ägaren laddar upp och läser sin fil. En annan person läser och laddar inte upp. Ett planterat medlemskap vars grupp är
 *             platsen öppnar den inte. En uppladdning till en post som inte finns nekas.
 *   GRUPP     en medlem laddar upp till sin egen post och läser. En icke-medlem läser inte. En annan medlem läser men skriver inte
 *             över någon annans fil.
 *   RADERA    ingen klient raderar en fil, inte ens ägaren: servern gör det när posten tas bort.
 *
 * Reglerna skrivs av `scripts/skriv-provregler.mjs` (`rules/provlagring.rules`).
 */

import { medlemskapsId } from "../../src/lib/grupp.js";
import { mittBibliotek } from "../../src/lib/bibliotek.js";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const AGARE = "uidKimLagring";
const ANNAN = "uidAnnanLagring";
const INKRAKT = "uidInkraktLagring";
const MEDLEM = "uidMedlemLagring";
const CPS = "cps-ab";
const MIN = mittBibliotek(AGARE);
const BYTE = new Uint8Array([37, 80, 68, 70]);
const PDF = { contentType: "application/pdf" };

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;
const lagringSom = (uid) => miljo.authenticatedContext(uid).storage();
const post = (groupId, uid, id) => {
  const nu = Date.now();
  return {
    groupId,
    typ: "fil",
    rubrik: "Kvitto",
    fil: { sokvag: `grupper/${groupId}/bibliotek/${id}/kvitto.pdf`, namn: "kvitto.pdf", mime: "application/pdf", byte: 4 },
    skapadAv: { uid, namn: "Kim", typ: "manniska", kalla: "bibliotek" },
    skapad: nu,
    andrad: nu,
  };
};

before(async () => {
  const lagringsregler = path.join(rot, "rules", "provlagring.rules");
  const regler = path.join(rot, "rules", "provregler.rules");
  if (!fs.existsSync(lagringsregler) || !fs.existsSync(regler)) throw new Error("Provreglerna saknas. Kör npm run regler:skriv först.");
  miljo = await initializeTestEnvironment({
    projectId: "regelprov",
    firestore: { rules: fs.readFileSync(regler, "utf8"), host: "127.0.0.1", port: 8080 },
    storage: { rules: fs.readFileSync(lagringsregler, "utf8"), host: "127.0.0.1", port: 9199 },
  });
  await miljo.clearFirestore();
  await miljo.clearStorage();
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `memberships/${medlemskapsId(AGARE, CPS)}`), { userId: AGARE, groupId: CPS, roll: "medlem", typ: "person", status: "aktiv" });
    await setDoc(doc(db, `memberships/${medlemskapsId(MEDLEM, CPS)}`), { userId: MEDLEM, groupId: CPS, roll: "medlem", typ: "person", status: "aktiv" });
    await setDoc(doc(db, `memberships/${INKRAKT}|${MIN}`), { userId: INKRAKT, groupId: MIN, roll: "admin", typ: "person", status: "aktiv" });
    await setDoc(doc(db, "bibliotek/m1"), post(MIN, AGARE, "m1"));
    await setDoc(doc(db, "bibliotek/g1"), post(CPS, AGARE, "g1"));
  });
});

after(async () => {
  await miljo?.cleanup();
});

describe("Lagring: Mitt bibliotek", () => {
  it("ägaren laddar upp och läser sin fil", async () => {
    await assertSucceeds(uploadBytes(ref(lagringSom(AGARE), `grupper/${MIN}/bibliotek/m1/kvitto.pdf`), BYTE, PDF));
    await assertSucceeds(getBytes(ref(lagringSom(AGARE), `grupper/${MIN}/bibliotek/m1/kvitto.pdf`)));
  });
  it("en annan person läser inte och laddar inte upp", async () => {
    await assertFails(getBytes(ref(lagringSom(ANNAN), `grupper/${MIN}/bibliotek/m1/kvitto.pdf`)));
    await assertFails(uploadBytes(ref(lagringSom(ANNAN), `grupper/${MIN}/bibliotek/m1/kvitto.pdf`), BYTE, PDF));
  });
  it("ett planterat medlemskap vars grupp är platsen öppnar den inte", async () => {
    await assertFails(getBytes(ref(lagringSom(INKRAKT), `grupper/${MIN}/bibliotek/m1/kvitto.pdf`)));
    await assertFails(uploadBytes(ref(lagringSom(INKRAKT), `grupper/${MIN}/bibliotek/m1/kvitto.pdf`), BYTE, PDF));
  });
  it("en uppladdning till en post som inte finns nekas, också för ägaren", async () => {
    await assertFails(uploadBytes(ref(lagringSom(AGARE), `grupper/${MIN}/bibliotek/finns-inte/kvitto.pdf`), BYTE, PDF));
  });
  it("ingen klient raderar en fil, inte ens ägaren", async () => {
    await assertFails(deleteObject(ref(lagringSom(AGARE), `grupper/${MIN}/bibliotek/m1/kvitto.pdf`)));
  });
});

describe("Lagring: gruppens bibliotek", () => {
  it("en medlem laddar upp till sin post och läser, en annan läser inte", async () => {
    await assertSucceeds(uploadBytes(ref(lagringSom(AGARE), `grupper/${CPS}/bibliotek/g1/kvitto.pdf`), BYTE, PDF));
    await assertSucceeds(getBytes(ref(lagringSom(AGARE), `grupper/${CPS}/bibliotek/g1/kvitto.pdf`)));
    await assertFails(getBytes(ref(lagringSom(ANNAN), `grupper/${CPS}/bibliotek/g1/kvitto.pdf`)));
  });
  it("en annan medlem i gruppen läser men skriver inte över någon annans fil", async () => {
    await assertSucceeds(getBytes(ref(lagringSom(MEDLEM), `grupper/${CPS}/bibliotek/g1/kvitto.pdf`)));
    await assertFails(uploadBytes(ref(lagringSom(MEDLEM), `grupper/${CPS}/bibliotek/g1/kvitto.pdf`), BYTE, PDF));
  });
});

describe("Lagring: ljud har ett eget tak (CP 2026-10-18, WAV)", () => {
  it("⛔ en WAV över 25 MB går in, en bild av samma storlek gör det inte", async () => {
    const stor = new Uint8Array(25 * 1024 * 1024 + 1);
    await assertSucceeds(uploadBytes(ref(lagringSom(AGARE), `grupper/${CPS}/bibliotek/g1/lat.wav`), stor, { contentType: "audio/wav" }));
    await assertFails(uploadBytes(ref(lagringSom(AGARE), `grupper/${CPS}/bibliotek/g1/bild.jpg`), stor, { contentType: "image/jpeg" }));
  });
});

describe("Lagring: video har ett eget tak på 100 MB (CP 2026-10-19, cllp/lifehub.app#358)", () => {
  const mp4 = { contentType: "video/mp4" };
  it("⛔ en mp4 över 25 MB går in, en PDF av samma storlek gör det inte", async () => {
    const stor = new Uint8Array(26 * 1024 * 1024);
    await assertSucceeds(uploadBytes(ref(lagringSom(AGARE), `grupper/${CPS}/bibliotek/g1/rep.mp4`), stor, mp4));
    await assertFails(uploadBytes(ref(lagringSom(AGARE), `grupper/${CPS}/bibliotek/g1/rep.pdf`), stor, PDF));
  });
  it("⛔ 100 MB går in och 100 MB + 1 gör det inte, och quicktime (iPhones .mov) gäller som mp4", async () => {
    await assertSucceeds(uploadBytes(ref(lagringSom(AGARE), `grupper/${CPS}/bibliotek/g1/rep.mp4`), new Uint8Array(100 * 1024 * 1024), mp4));
    await assertFails(uploadBytes(ref(lagringSom(AGARE), `grupper/${CPS}/bibliotek/g1/rep2.mp4`), new Uint8Array(100 * 1024 * 1024 + 1), mp4));
    await assertSucceeds(uploadBytes(ref(lagringSom(AGARE), `grupper/${CPS}/bibliotek/g1/rep.mov`), new Uint8Array(30 * 1024 * 1024), { contentType: "video/quicktime" }));
  });
  it("⛔ ett videoformat som inte står i FILMIME nekas, hur litet det än är", async () => {
    await assertFails(uploadBytes(ref(lagringSom(AGARE), `grupper/${CPS}/bibliotek/g1/rep.webm`), new Uint8Array(1024), { contentType: "video/webm" }));
  });
  it("ljudets tak är oförändrat: en WAV över 100 MB går in", async () => {
    await assertSucceeds(uploadBytes(ref(lagringSom(AGARE), `grupper/${CPS}/bibliotek/g1/lat.wav`), new Uint8Array(100 * 1024 * 1024 + 1), { contentType: "audio/wav" }));
  });
});

describe("Lagring: en textfil får sin teckenkodning (0.153.0, cllp/ops-framework#460 punkt 3, lifehub.app QA-fynd 5)", () => {
  const text = new TextEncoder().encode("Hej, för vår skull.");
  const sok = (/** @type {string} */ namn) => ref(lagringSom(AGARE), `grupper/${CPS}/bibliotek/g1/${namn}`);

  it("⛔ text/plain; charset=utf-8 går in (röd mot 0.152.0: regeln jämförde hela strängen och nekade den)", async () => {
    await assertSucceeds(uploadBytes(sok("anteckning.txt"), text, { contentType: "text/plain; charset=utf-8" }));
  });
  it("text/plain utan kodning går fortfarande in: en äldre klient mot de nya reglerna fungerar som förut", async () => {
    await assertSucceeds(uploadBytes(sok("gammal.txt"), text, { contentType: "text/plain" }));
  });
  it("⛔ en annan kodning, en kodning på en bild och andra textformat nekas", async () => {
    await assertFails(uploadBytes(sok("latin.txt"), text, { contentType: "text/plain; charset=iso-8859-1" }));
    await assertFails(uploadBytes(sok("bild.png"), text, { contentType: "image/png; charset=utf-8" }));
    await assertFails(uploadBytes(sok("sida.html"), text, { contentType: "text/html; charset=utf-8" }));
    await assertFails(uploadBytes(sok("extra.txt"), text, { contentType: "text/plain; charset=utf-8; boundary=x" }));
  });
  it("⛔ en text som bär kodningen läses tillbaka med den (objektets innehållstyp är den som laddades upp)", async () => {
    await assertSucceeds(uploadBytes(sok("las.txt"), text, { contentType: "text/plain; charset=utf-8" }));
    const bytes = await getBytes(sok("las.txt"));
    assert.equal(new TextDecoder("utf-8").decode(bytes), "Hej, för vår skull.");
  });
});
