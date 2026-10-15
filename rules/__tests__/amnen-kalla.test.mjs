/**
 * P0 2026-10-15: ett Nytt samtal med agenten gick inte att skicka i produktion (appen på 0.106.0), mot Firestore-emulatorn med
 * Firestore-källan, inte minneskällan.
 *
 * ══ ⛔ VAD SOM MÄTS ══════════════════════════════════════════════════════
 *
 * CP i telefonen: texten stod kvar efter Skicka, och under trådens huvud syntes en röd ram utan text. `skickaIAmne` läste
 * samtalsdokumentet för ett ämne som ännu inte fanns (`kalla.read`). Läsregeln är `opsFarLasaSamtal(resource.data)`, och för ett
 * dokument som inte finns är `resource` null, så läsningen nekades och inget skrevs. Mätbygget och komponentproven kör minneskällan,
 * som inte har regler, så inget prov såg det. Här körs samma väg som appen: `createFirestoreSource` mot emulatorn med reglerna ur
 * `samtalsregelfragment({ amnen: true, ... })` (`scripts/skriv-provregler.mjs`).
 *
 * Kör: npm run test:rules
 */

import { medlemskapsId } from "../../src/lib/grupp.js";
import { samtalsnyckel } from "../../src/lib/samtal.js";
import { createFirestoreSource } from "../../src/data/firestore.js";
import { createSamtalskalla } from "../../src/data/samtalskalla.js";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import * as sdk from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const G = "amnen-kalla";
const ANNA = "uid-anna";
const AGENT = "uid-agent";
const sorterat = (/** @type {string[]} */ d) => [...d].sort();
const finns = samtalsnyckel({ groupId: G, slag: "agent", deltagare: [ANNA, AGENT], amne: "a_finns_1" });

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;

before(async () => {
  const regler = path.join(rot, "rules", "provregler.rules");
  if (!fs.existsSync(regler)) throw new Error("rules/provregler.rules saknas. Kör npm run test:rules.");
  miljo = await initializeTestEnvironment({
    projectId: "regelprov-amnen-kalla",
    firestore: { rules: fs.readFileSync(regler, "utf8"), host: "127.0.0.1", port: 8080 },
  });
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await sdk.setDoc(sdk.doc(db, `memberships/${medlemskapsId(ANNA, G)}`), { userId: ANNA, groupId: G, roll: "medlem", typ: "person", status: "aktiv" });
    await sdk.setDoc(sdk.doc(db, `memberships/${medlemskapsId(AGENT, G)}`), { userId: AGENT, groupId: G, roll: "medlem", typ: "agent", status: "aktiv" });
    await sdk.setDoc(sdk.doc(db, `samtal/${finns}`), { groupId: G, slag: "agent", deltagare: sorterat([ANNA, AGENT]), skapad: Date.now() - 60_000, skapadAv: ANNA, rubrik: "Momsen" });
    await sdk.setDoc(sdk.doc(db, `samtal/${finns}/meddelanden/m1`), { text: "Hur ligger momsen till?", av: ANNA, tid: Date.now() - 50_000 });
  });
});

after(async () => {
  if (miljo) await miljo.cleanup();
});

/** Annas källa, som appen bygger den. */
const annasKalla = () =>
  /** @type {any} */ (createSamtalskalla({ kalla: createFirestoreSource({ db: miljo.authenticatedContext(ANNA).firestore(), sdk }), amnen: true }));

/** Det som står i emulatorn, utan regler. @param {string} vag */
const las = async (vag) => {
  let ut = /** @type {any} */ (null);
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const snap = await sdk.getDoc(sdk.doc(ctx.firestore(), vag));
    ut = snap.exists() ? snap.data() : null;
  });
  return ut;
};

describe("⛔ P0: ett nytt ämne med agenten och dess första meddelande, genom Firestore-källan", () => {
  it("Nytt samtal: nyttAmne + skickaIAmne skapar ämnet och skriver meddelandet", async () => {
    const s = annasKalla();
    const amne = s.nyttAmne({ groupId: G, uid: ANNA, agent: AGENT });
    // Röd på 0.106.0: "Missing or insufficient permissions", läsningen av ett samtal som inte finns.
    const m = await s.skickaIAmne(amne, { text: "Hur ligger momsen till?", av: ANNA });
    assert.ok(m?.id, "Meddelandet fick inget id.");
    assert.equal((await las(`samtal/${amne.id}`))?.slag, "agent");
    assert.equal((await las(`samtal/${amne.id}/meddelanden/${m.id}`))?.text, "Hur ligger momsen till?");
    // Andra meddelandet i samma ämne: ingen ny skapelse, bara meddelandet.
    const m2 = await s.skickaIAmne(amne, { text: "Och för förra kvartalet?", av: ANNA });
    assert.equal((await las(`samtal/${amne.id}/meddelanden/${m2.id}`))?.text, "Och för förra kvartalet?");
  });

  it("TALK:s Agent: oppnaAmne skapar ämnet med det sagda som första rad", async () => {
    const s = annasKalla();
    // Röd på 0.106.0: samma läsning, via skickaIAmne.
    const { samtal, meddelande } = await s.oppnaAmne({ groupId: G, uid: ANNA, agent: AGENT, text: "påminn mig om repet" });
    assert.equal((await las(`samtal/${samtal.id}/meddelanden/${meddelande.id}`))?.text, "påminn mig om repet");
  });

  it("ett ämne som redan finns, i en ny källa (efter en omladdning): meddelandet skrivs, och ämnet skrivs inte över", async () => {
    const s = annasKalla();
    const rader = await s.oversikt({ groupId: G, uid: ANNA });
    const amne = rader.map((/** @type {any} */ r) => r.samtal).find((/** @type {any} */ x) => x.id === finns);
    assert.ok(amne, "Golv: det befintliga ämnet står i översikten.");
    const m = await s.skickaIAmne(amne, { text: "En fråga till", av: ANNA });
    assert.equal((await las(`samtal/${finns}/meddelanden/${m.id}`))?.text, "En fråga till");
    assert.equal((await las(`samtal/${finns}`))?.rubrik, "Momsen");
  });

  it("ett ämne som finns men inte setts i den här källan: skapelsen nekas, ämnet hämtas ur listan, och meddelandet skrivs", async () => {
    const s = annasKalla();
    const bygg = { id: finns, groupId: G, slag: "agent", deltagare: sorterat([ANNA, AGENT]), skapad: Date.now(), skapadAv: ANNA };
    const m = await s.skickaIAmne(bygg, { text: "Utan översikten först", av: ANNA });
    assert.equal((await las(`samtal/${finns}/meddelanden/${m.id}`))?.text, "Utan översikten först");
    assert.equal((await las(`samtal/${finns}`))?.rubrik, "Momsen", "Ämnet skrevs över.");
  });
});
