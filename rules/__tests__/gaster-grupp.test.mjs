/**
 * Regelprov för gästerna i hela gruppen (0.132.0, cllp/lifehub.app#389, skiva 2), mot Firestore-emulatorn.
 *
 * ══ ⛔ VAD SOM ÄNDRADES I REGLERNA: INGENTING, OCH DET ÄR DET HÄR PROVET BEVISAR ═══════════════════════════════════════════
 *
 * Gäster i hela gruppen behöver inget nytt i reglerna. Gästen når bara servern (Admin SDK), och servern prövar allt själv. Provet bevisar tre saker som skulle gå sönder om någon senare lade till en regel för gäster:
 *
 *   1. GRUPPINBJUDNINGEN LÄSES SOM SAKINBJUDNINGEN: en aktiv medlem i gruppen läser en rad med `omfang.slag == 'grupp'` och listar med groupId, ingen annan gör det.
 *      Rött utan `gastregelfragment` (catch-allen nekar medlemmen), grönt med det. Medlemmarna ser adressen (CP 2026-10-20), men aldrig nyckelns hash i klartext som något de kan göra något med.
 *   2. SERVERN ÄR ALDRIG LÖSARE ÄN REGLERNA FÖR ETT SVAR: tabellen `SVARFALL` (`svarfall.mjs`) körs här som MEDLEM mot de riktiga reglerna och i `gast-grupp-tjanst.test.js` som GÄST mot servern. En gäst får svara
 *      bara där en medlem får. Raden `arkiverad` är den enda där de skiljer sig (servern är strängare) och står utskriven.
 *   3. INGEN KLIENT SKRIVER EN GÄSTS SVAR: `handelser/<h>/svar/g_<hash>` skrivs bara av servern. En medlem som försöker skriva det (eller radera det) nekas, eftersom id:t inte är medlemmens uid, men medlemmar
 *      LÄSER det, som alla andra svar (summorna räknar gäster, och gruppen ska kunna se det).
 *
 *   4. INGEN KLIENT SKRIVER SOM EN GÄST I CHATTEN (0.132.0, "Gästen får skriva"): servern skriver gästens meddelande (`av` = `g_`-id, `avNamn`) med Admin SDK. Reglerna nekar en klient både ett `g_`-id som `av` och fältet
 *      `avNamn` (`hasOnly` och `av == request.auth.uid`), så ingen medlem kan skriva ett meddelande som ser ut som en gästs, och ingen kan lägga märket Gäst på ett eget. Medlemmen skriver sitt eget som förut (golv),
 *      och medlemmar LÄSER gästens meddelande som alla andra.
 *
 * Kör: npm run test:rules
 */

import { gastregelfragment } from "../../src/lib/regler.js";
import { SVARFALL } from "./svarfall.mjs";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ID_GRUPP = "a".repeat(64);
const ID_GRANNEN = "b".repeat(64);
const GAST = "g_" + "9".repeat(40);

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;

const rad = (groupId, epost, omfang) => ({
  groupId,
  epost,
  namn: "",
  omfang,
  skapadAv: { uid: "uid-agare", namn: "Ägare" },
  skapad: 1_800_000_000_000,
  skickad: 1_800_000_000_000,
  antalSkickade: 1,
  lankGiltigTill: 1_800_000_000_000 + 30 * 86_400_000,
  nyckelHash: "c".repeat(64),
  forstInloggad: null,
  aterkallad: null,
  felAntal: 0,
  felFonster: 0,
});

before(async () => {
  const regler = path.join(rot, "rules", "provregler.rules");
  if (!fs.existsSync(regler)) throw new Error("rules/provregler.rules saknas. Kör npm run regler:skriv först, eller npm run test:rules som gör det åt dig.");
  const regeltext = fs.readFileSync(regler, "utf8");
  assert.ok(regeltext.length > 500, "provreglerna lästes tomma. Ett tomt underlag gör nekandet grönt av fel skäl.");
  assert.ok(regeltext.includes(gastregelfragment("gastinbjudningar")), "provreglerna innehåller inte gastregelfragment(\"gastinbjudningar\"). Utan det nekar catch-allen också medlemmens läsning.");
  assert.ok(SVARFALL.length >= 12, `svarfall.mjs har ${SVARFALL.length} fall, väntat minst 12. Ett tomt underlag gör provet grönt av att ingenting prövades.`);
  assert.ok(SVARFALL.some((f) => f.medlem) && SVARFALL.some((f) => !f.medlem), "svarfall.mjs saknar antingen tillåtna eller nekade fall. Ett prov i bara en riktning är ingen vakt.");

  miljo = await initializeTestEnvironment({ projectId: "regelprov", firestore: { rules: regeltext, host: "127.0.0.1", port: 8080 } });
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "memberships/uid-medlem|kallan"), { userId: "uid-medlem", groupId: "kallan", roll: "medlem", typ: "person", status: "aktiv" });
    await setDoc(doc(db, "memberships/uid-granne|grannen"), { userId: "uid-granne", groupId: "grannen", roll: "agare", typ: "person", status: "aktiv" });
    await setDoc(doc(db, "memberships/uid-agent|kallan"), { userId: "uid-agent", groupId: "kallan", roll: "admin", typ: "agent", status: "aktiv" });
    await setDoc(doc(db, `gastinbjudningar/${ID_GRUPP}`), rad("kallan", "anna@foretag.se", { slag: "grupp" }));
    await setDoc(doc(db, `gastinbjudningar/${ID_GRANNEN}`), rad("grannen", "bo@foretag.se", { slag: "grupp" }));
    // Händelserna ur svarfall.mjs.
    await setDoc(doc(db, "handelser/f-ja"), { groupId: "kallan", kravSvar: true, titel: "Ja" });
    await setDoc(doc(db, "handelser/f-nej"), { groupId: "kallan", kravSvar: false, titel: "Nej" });
    await setDoc(doc(db, "handelser/f-utan"), { groupId: "kallan", titel: "Utan" });
    await setDoc(doc(db, "handelser/f-arkiv"), { groupId: "kallan", kravSvar: true, arkiverad: true, titel: "Arkiv" });
    await setDoc(doc(db, "handelser/f-annan"), { groupId: "grannen", kravSvar: true, titel: "Annan" });
    await setDoc(doc(db, `handelser/f-ja/svar/${GAST}`), { svar: "kommer" });
    await setDoc(doc(db, "samtal/kallan|grupp"), { groupId: "kallan", slag: "grupp", skapad: Date.now(), skapadAv: "uid-medlem" });
    await setDoc(doc(db, "samtal/kallan|grupp/meddelanden/gast1"), { text: "Hej från gästen", av: GAST, avNamn: "Anna Gäst", tid: Date.now() });
  });
});

after(async () => {
  if (miljo) await miljo.cleanup();
});

const som = (uid) => miljo.authenticatedContext(uid).firestore();

describe("gruppinbjudan: läses av gruppens medlemmar och av ingen annan", () => {
  it("en medlem läser en gruppinbjudan och listar gruppens med groupId, och listan innehåller den (golv)", async () => {
    const snap = await assertSucceeds(getDoc(doc(som("uid-medlem"), `gastinbjudningar/${ID_GRUPP}`)));
    assert.deepEqual(snap.data().omfang, { slag: "grupp" });
    const lista = await assertSucceeds(getDocs(query(collection(som("uid-medlem"), "gastinbjudningar"), where("groupId", "==", "kallan"))));
    assert.equal(lista.size, 1);
    assert.equal(lista.docs[0].id, ID_GRUPP);
  });

  it("en medlem i en annan grupp och en agent läser inte, varken raden eller listan", async () => {
    for (const uid of ["uid-granne", "uid-agent"]) {
      await assertFails(getDoc(doc(som(uid), `gastinbjudningar/${ID_GRUPP}`)));
      await assertFails(getDocs(query(collection(som(uid), "gastinbjudningar"), where("groupId", "==", "kallan"))));
    }
  });

  it("ingen klient skriver en gruppinbjudan, inte ens en medlem i gruppen", async () => {
    await assertFails(setDoc(doc(som("uid-medlem"), `gastinbjudningar/${"d".repeat(64)}`), rad("kallan", "ny@foretag.se", { slag: "grupp" })));
    await assertFails(updateDoc(doc(som("uid-medlem"), `gastinbjudningar/${ID_GRUPP}`), { aterkallad: 1 }));
    await assertFails(deleteDoc(doc(som("uid-medlem"), `gastinbjudningar/${ID_GRUPP}`)));
  });
});

describe("svar på en händelse: medlemmens utfall är exakt tabellen i svarfall.mjs, och servern får aldrig vara löslare", () => {
  for (const f of SVARFALL) {
    it(`${f.namn}: ${f.medlem ? "medlemmen får" : "medlemmen nekas"}`, async () => {
      // Servern (gäst) får bara svara där en medlem får.
      assert.ok(!f.gast || f.medlem, `fallet "${f.namn}" tillåter en gäst men inte en medlem. Servern får inte vara löslare än reglerna.`);
      const mitt = doc(som("uid-medlem"), `handelser/${f.handelse}/svar/uid-medlem`);
      const skrivning = f.val === undefined ? setDoc(mitt, {}) : setDoc(mitt, { svar: f.val });
      if (f.medlem) await assertSucceeds(skrivning);
      else await assertFails(skrivning);
    });
  }
});

describe("en gästs svar: bara servern skriver det, medlemmar läser det", () => {
  it("en medlem skriver inte ett svar under en gästs id, varken skapar, ändrar eller raderar", async () => {
    const gastens = doc(som("uid-medlem"), `handelser/f-ja/svar/${GAST}`);
    await assertFails(setDoc(gastens, { svar: "kommerInte" }));
    await assertFails(updateDoc(gastens, { svar: "kommerInte" }));
    await assertFails(deleteDoc(gastens));
    // Gästens svar är oförändrat.
    const snap = await assertSucceeds(getDoc(gastens));
    assert.equal(snap.data().svar, "kommer");
  });

  it("en medlem i en annan grupp läser inte gästens svar, och listan över svaren hör till gruppen", async () => {
    await assertFails(getDoc(doc(som("uid-granne"), `handelser/f-ja/svar/${GAST}`)));
    const lista = await assertSucceeds(getDocs(collection(som("uid-medlem"), "handelser/f-ja/svar")));
    assert.ok(lista.docs.some((d) => d.id === GAST), "gästens svar syns inte i listan över svaren (golv)");
  });
});

describe("gästens meddelande i gruppchatten: bara servern skriver det, medlemmar läser det", () => {
  const meddelande = (extra = {}) => ({ text: "Hej", av: "uid-medlem", tid: Date.now(), ...extra });

  it("golv: en medlem skriver sitt eget meddelande i gruppchatten", async () => {
    await assertSucceeds(setDoc(doc(som("uid-medlem"), "samtal/kallan|grupp/meddelanden/eget1"), meddelande()));
  });

  it("⛔ en medlem skriver inte ett meddelande som en gäst: varken med gästens id som avsändare eller med ett avNamn", async () => {
    await assertFails(setDoc(doc(som("uid-medlem"), "samtal/kallan|grupp/meddelanden/falsk1"), meddelande({ av: GAST })));
    await assertFails(setDoc(doc(som("uid-medlem"), "samtal/kallan|grupp/meddelanden/falsk2"), meddelande({ avNamn: "Falsk Gäst" })));
    await assertFails(setDoc(doc(som("uid-medlem"), "samtal/kallan|grupp/meddelanden/falsk3"), meddelande({ av: GAST, avNamn: "Falsk Gäst" })));
  });

  it("ingen klient ändrar eller raderar gästens meddelande, och en medlem i en annan grupp läser det inte", async () => {
    await assertFails(updateDoc(doc(som("uid-medlem"), "samtal/kallan|grupp/meddelanden/gast1"), { text: "Ändrat" }));
    await assertFails(deleteDoc(doc(som("uid-medlem"), "samtal/kallan|grupp/meddelanden/gast1")));
    await assertFails(getDoc(doc(som("uid-granne"), "samtal/kallan|grupp/meddelanden/gast1")));
    const snap = await assertSucceeds(getDoc(doc(som("uid-medlem"), "samtal/kallan|grupp/meddelanden/gast1")));
    assert.equal(snap.data().avNamn, "Anna Gäst");
  });
});
