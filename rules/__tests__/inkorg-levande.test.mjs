/**
 * Kostnaden för en inkorg som lever (0.106.0, #386 skiva 7), MÄTT i Firestore-emulatorn mot reglerna, inte bedömd.
 *
 * ══ ⛔ VAD SOM MÄTS ══════════════════════════════════════════════════════
 *
 * Gapanalysen i #386, prioritet 5: "Mät läsningarna i emulatorn innan det byggs." Här räknas dokumenten Firestore lämnar ut, genom
 * en SDK som räknar: `getDocs` (dokument i svaret), `getDoc` (ett per uppslag, också när dokumentet saknas, som Firestore tar betalt)
 * och lyssnarnas ögonblicksbilder (dokument som läggs till eller ändras, det Firestore tar betalt för efter den första bilden).
 *
 * Underlaget: gruppchatten och två privata samtal med 60 meddelanden var, så att en rad läser en hel sida (50). Siffrorna skrivs ut.
 * Proven säger vad som MÅSTE gälla: lyssnarna läser ett dokument per samtal och ett per nytt meddelande, och en radläsning är en rad
 * ur översikten, aldrig hela inkorgen. Och reglerna släpper in lyssnarens fråga utan att något ändrats i dem.
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

const G = "inkorg-levande";
const ANNA = "uid-anna";
const BO = "uid-bo";
const CIA = "uid-cia";
const N = 60;
const sorterat = (/** @type {string[]} */ d) => [...d].sort();
const grupp = samtalsnyckel({ groupId: G, slag: "grupp" });
const medBo = samtalsnyckel({ groupId: G, slag: "personer", deltagare: [ANNA, BO] });
const medCia = samtalsnyckel({ groupId: G, slag: "personer", deltagare: [ANNA, CIA] });

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;

before(async () => {
  const regler = path.join(rot, "rules", "provregler.rules");
  if (!fs.existsSync(regler)) throw new Error("rules/provregler.rules saknas. Kör npm run test:rules.");
  miljo = await initializeTestEnvironment({
    projectId: "regelprov-inkorg-levande",
    firestore: { rules: fs.readFileSync(regler, "utf8"), host: "127.0.0.1", port: 8080 },
  });
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const uid of [ANNA, BO, CIA]) {
      await sdk.setDoc(sdk.doc(db, `memberships/${medlemskapsId(uid, G)}`), { userId: uid, groupId: G, roll: "medlem", typ: "person", status: "aktiv" });
    }
    const t0 = Date.now() - 1000 * 60 * 60;
    await sdk.setDoc(sdk.doc(db, `samtal/${grupp}`), { groupId: G, slag: "grupp", skapad: t0, skapadAv: ANNA });
    for (const [sid, annan] of [[medBo, BO], [medCia, CIA]]) {
      await sdk.setDoc(sdk.doc(db, `samtal/${sid}`), { groupId: G, slag: "personer", deltagare: sorterat([ANNA, annan]), skapad: t0, skapadAv: ANNA });
    }
    for (const sid of [grupp, medBo, medCia]) {
      for (let i = 0; i < N; i += 1) await sdk.setDoc(sdk.doc(db, `samtal/${sid}/meddelanden/m${String(i).padStart(3, "0")}`), { text: `Rad ${i}`, av: i % 2 ? ANNA : sid === medCia ? CIA : BO, tid: t0 + i * 1000 });
      await sdk.setDoc(sdk.doc(db, `samtal/${sid}/last/${ANNA}`), { lastTill: t0 + (N - 1) * 1000 });
    }
  });
});

after(async () => {
  if (miljo) await miljo.cleanup();
});

/** En SDK som räknar dokumenten Firestore lämnar ut. */
function raknandeSdk() {
  const r = { dokument: 0, fragor: 0, lyssnardokument: 0 };
  const s = {
    ...sdk,
    getDocs: async (/** @type {any} */ q) => {
      const snap = await sdk.getDocs(q);
      r.fragor += 1;
      r.dokument += snap.size;
      return snap;
    },
    getDoc: async (/** @type {any} */ ref) => {
      r.fragor += 1;
      r.dokument += 1;
      return sdk.getDoc(ref);
    },
    onSnapshot: (/** @type {any} */ q, /** @type {any} */ nasta, /** @type {any} */ fel) =>
      sdk.onSnapshot(
        q,
        (/** @type {any} */ snap) => {
          r.lyssnardokument += snap.docChanges().filter((/** @type {any} */ c) => c.type !== "removed").length;
          nasta(snap);
        },
        fel,
      ),
  };
  return { sdk: s, r };
}

describe("⛔ en inkorg som lever: kostnaden, mätt", () => {
  it("lyssnarna läser ett dokument per samtal och ett per nytt meddelande; en radläsning är en rad, inte inkorgen", async () => {
    const { sdk: rsdk, r } = raknandeSdk();
    const kalla = createFirestoreSource({ db: miljo.authenticatedContext(ANNA).firestore(), sdk: rsdk });
    const s = /** @type {any} */ (createSamtalskalla({ kalla, levandeInkorg: true }));

    // 1. Hela översikten, det som 0.105.0 gjorde vid varje fokus.
    const rader = await s.oversikt({ groupId: G, uid: ANNA });
    const oversikt = { ...r };
    assert.equal(rader.length, 3, "Golv: tre samtal i inkorgen.");

    // 2. Lyssnarna: en per samtal, den första bilden.
    Object.assign(r, { dokument: 0, fragor: 0, lyssnardokument: 0 });
    /** @type {Array<[string, any]>} */
    const sedda = [];
    let fel = /** @type {Error | null} */ (null);
    const stang = s.bevakaInkorg(rader.map((x) => x.samtal.id), { onSenaste: (sid, m) => sedda.push([sid, m]), onError: (e) => (fel = e) });
    for (let i = 0; i < 50 && sedda.length < 3; i += 1) await new Promise((v) => setTimeout(v, 50));
    assert.equal(fel, null, `En lyssnare nekades av reglerna: ${fel}`);
    assert.equal(sedda.length, 3);
    const forstaBild = r.lyssnardokument;

    // 3. Bo skriver. Lyssnaren på hans samtal får ETT dokument.
    Object.assign(r, { dokument: 0, fragor: 0, lyssnardokument: 0 });
    await sdk.setDoc(sdk.doc(miljo.authenticatedContext(BO).firestore(), `samtal/${medBo}/meddelanden/ny`), { text: "Har du sett protokollet?", av: BO, tid: Date.now() });
    for (let i = 0; i < 50 && !sedda.some(([sid, m]) => sid === medBo && m?.id === "ny"); i += 1) await new Promise((v) => setTimeout(v, 50));
    assert.ok(sedda.some(([sid, m]) => sid === medBo && m?.id === "ny"), "Lyssnaren fick aldrig Bos meddelande.");
    const nyttMeddelande = r.lyssnardokument;

    // 4. Raden läses om, bara Bos.
    Object.assign(r, { dokument: 0, fragor: 0, lyssnardokument: 0 });
    const ny = await s.inkorgsrad(rader.find((x) => x.samtal.id === medBo).samtal, ANNA);
    const radlasning = { ...r };
    stang();

    console.log(
      [
        "inkorg-levande, mätt i emulatorn (3 samtal, 60 meddelanden vardera, sida 50):",
        `  hel översikt (0.105.0 vid varje fokus): ${oversikt.dokument} dokument i ${oversikt.fragor} frågor`,
        `  lyssnarnas första bild: ${forstaBild} dokument, ${rader.length} lyssnare`,
        `  ett nytt meddelande, till lyssnaren: ${nyttMeddelande} dokument`,
        `  radläsningen efter det: ${radlasning.dokument} dokument i ${radlasning.fragor} frågor`,
      ].join("\n"),
    );
    assert.equal(ny.olasta, 1);
    assert.equal(ny.senaste.text, "Har du sett protokollet?");
    assert.equal(forstaBild, 3, "Den första bilden är ett dokument per samtal (limit 1).");
    assert.equal(nyttMeddelande, 1, "Ett nytt meddelande är ett dokument till lyssnaren.");
    // En rad: en sida meddelanden och läsmärket. Översikten: samtalslistan plus en sådan per samtal.
    assert.equal(radlasning.dokument, 50 + 1);
    assert.equal(radlasning.fragor, 2);
    assert.ok(oversikt.dokument >= 3 * radlasning.dokument, `översikten (${oversikt.dokument}) ska vara minst tre rader (${3 * radlasning.dokument}).`);
  });
});
