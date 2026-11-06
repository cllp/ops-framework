/**
 * Regelprov för kommentarer på en bibliotekspost (0.191.0, cllp/lifehub.app#663), mot Firestore-emulatorn, med samtalsfragmentet som det står i provreglerna:
 * `tradar` och `bilagor` påslagna (`scripts/skriv-provregler.mjs`).
 *
 * ⛔ VARFÖR PROVET FINNS. Den första versionen av 0.191.0 gav roten id:t `post~<postid>`. Samtalsfragmentet nekar med `bilagor` varje meddelande vars id bär
 * trådskiljetecknet (`!mid.matches('.*[~].*')`, eftersom en bilagas nyckel i en tråd är `<tråd>~<meddelande>`), och appens regelprov fick PERMISSION_DENIED för en
 * medlem, både på roten och på svaren. Ramverkets egna prov hade kört kommentarerna mot minneskällan, som inte har några regler. Här går samma väg som appen: ramverkets
 * källa (`createFirestoreSource`, `createSamtalskalla`, `createPostkommentarer`) mot reglerna, som en inloggad medlem.
 *
 * ⛔ REGELN ÄNDRAS INTE AV DET HÄR. Provet mäter att kommentarsrotens id är ett id regeln släpper igenom, och att regeln fortfarande säger nej där den ska (golv): ett id
 * med `~`, och en andra skapelse av samma rot (det är den som gör att den som kommer sist skriver som svar, `skickaPaRot` utan `createNew`).
 *
 * Kör: npm run test:rules
 */

import { medlemskapsId } from "../../src/lib/grupp.js";
import { samtalsnyckel } from "../../src/lib/samtal.js";
import { kommentarRotId } from "../../src/lib/postkommentar.js";
import { createFirestoreSource } from "../../src/data/firestore.js";
import { createSamtalskalla } from "../../src/data/samtalskalla.js";
import { createPostkommentarer } from "../../src/data/postkommentarer.js";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import * as sdk from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const G = "kommentar-ab";
const ANNA = "uid-kommentar-anna";
const BO = "uid-kommentar-bo";
const BAS = "https://app.exempel.se/bibliotek";
const grupp = samtalsnyckel({ groupId: G, slag: "grupp" });
const POST = { id: "p-not", groupId: G, typ: "anteckning", rubrik: "Protokoll" };

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;

before(async () => {
  const fil = path.join(rot, "rules", "provregler.rules");
  if (!fs.existsSync(fil)) throw new Error("rules/provregler.rules saknas. Kör npm run test:rules.");
  const regler = fs.readFileSync(fil, "utf8");
  // ⛔ GOLV: provet mäter samtalsfragmentet MED trådar och bilagor. Utan dem hade tilde-villkoret inte funnits, och provet hade varit grönt för fel id.
  if (!/match \/tradar\/\{tid\} \{/.test(regler) || !/!mid\.matches\('\.\*\[~\]\.\*'\)/.test(regler)) {
    throw new Error("provreglerna saknar trådar eller bilagornas prövning av id:t, och provet mäter då inte det det ska.");
  }
  miljo = await initializeTestEnvironment({
    projectId: "regelprov-postkommentarer",
    firestore: { rules: regler, host: "127.0.0.1", port: 8080 },
  });
  await miljo.clearFirestore();
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const uid of [ANNA, BO]) {
      await sdk.setDoc(sdk.doc(db, `memberships/${medlemskapsId(uid, G)}`), { userId: uid, groupId: G, roll: "medlem", typ: "person", status: "aktiv" });
    }
    await sdk.setDoc(sdk.doc(db, `samtal/${grupp}`), { groupId: G, slag: "grupp", skapad: Date.now() - 60_000, skapadAv: ANNA });
  });
});

after(async () => {
  if (miljo) await miljo.cleanup();
});

/** En medlems källa, som appen bygger den. @param {string} uid */
const kommentarerFor = (uid) => {
  const samtal = /** @type {any} */ (createSamtalskalla({ kalla: createFirestoreSource({ db: miljo.authenticatedContext(uid).firestore(), sdk }), tradar: "tradar", bilagor: true, bilagaSamling: "bilagor" }));
  return createPostkommentarer({ samtal, groupId: G, uid, bas: BAS });
};

/** Det som står i emulatorn, utan regler. @param {string} vag */
const las = async (vag) => {
  let ut = /** @type {any} */ (null);
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const snap = await sdk.getDoc(sdk.doc(ctx.firestore(), vag));
    ut = snap.exists() ? snap.data() : null;
  });
  return ut;
};

describe("kommentarsroten mot samtalsfragmentet med trådar och bilagor", () => {
  it("⛔ en aktiv medlem skapar roten kommentarRotId(x) i samtalets meddelanden, med ramverkets källa", async () => {
    const svar = /** @type {any} */ (await kommentarerFor(ANNA).kommentera(POST, "Bra protokoll"));
    assert.equal(svar.rot, true);
    const r = await las(`samtal/${grupp}/meddelanden/${kommentarRotId(POST.id)}`);
    assert.equal(r?.av, ANNA);
    assert.match(String(r?.text), /^Bra protokoll\n/);
  });

  it("⛔ en annan medlem svarar i rotens tråd: tråden öppnas och svaret skrivs, med ramverkets källa", async () => {
    const svar = /** @type {any} */ (await kommentarerFor(BO).kommentera(POST, "Instämmer"));
    assert.equal(svar.rot, false);
    const rid = kommentarRotId(POST.id);
    assert.equal((await las(`samtal/${grupp}/tradar/${rid}`))?.skapadAv, BO);
    const rader = (await kommentarerFor(ANNA).las(POST)).rader;
    assert.deepEqual(rader.map((x) => x.text), ["Bra protokoll", "Instämmer"]);
  });

  it("⛔ samma sak direkt mot reglerna: roten och svaret på en ny post går igenom för en medlem", async () => {
    const rid = kommentarRotId("p-direkt");
    const db = miljo.authenticatedContext(ANNA).firestore();
    await assertSucceeds(sdk.setDoc(sdk.doc(db, `samtal/${grupp}/meddelanden/${rid}`), { text: "Roten", av: ANNA, tid: Date.now() }));
    await assertSucceeds(sdk.setDoc(sdk.doc(db, `samtal/${grupp}/tradar/${rid}`), { skapad: Date.now(), skapadAv: ANNA }));
    await assertSucceeds(sdk.setDoc(sdk.doc(db, `samtal/${grupp}/tradar/${rid}/meddelanden/svar1`), { text: "Svaret", av: ANNA, tid: Date.now() }));
  });

  it("golv: regeln säger fortfarande nej till ett id med ~, och till en andra skapelse av samma rot", async () => {
    const db = miljo.authenticatedContext(BO).firestore();
    await assertFails(sdk.setDoc(sdk.doc(db, `samtal/${grupp}/meddelanden/post~p-tilde`), { text: "Nej", av: BO, tid: Date.now() }));
    await assertFails(sdk.setDoc(sdk.doc(db, `samtal/${grupp}/meddelanden/${kommentarRotId(POST.id)}`), { text: "Skriver över", av: BO, tid: Date.now() }));
  });
});
