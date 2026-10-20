/**
 * Regelprov för gästinbjudningarna (0.131.0, cllp/lifehub.app#389).
 *
 * ⛔ CATCH-ALL NEKAR OCKSÅ, som för delningarna. Ett prov som bara gör assertFails på inbjudningarna hade varit grönt utan fragmentet, eftersom provreglernas sista block nekar allt som
 * saknar ett eget. Därför har provet BÅDA riktningarna: en aktiv medlem i gruppen MÅSTE kunna läsa (assertSucceeds), och det kan hon bara om `gastregelfragment` finns i reglerna. Rött
 * utan fragmentet, grönt med det. Sessionerna, platserna och räknarna har ingen match med flit: provet läser att så är fallet, och att en medlem ändå nekas.
 *
 *   medlem i gruppen läser en inbjudan, och listar med groupId     ja
 *   medlem listar utan att begränsa groupId                        nej  (regeln kan inte pröva en fråga som inte säger vilken grupp)
 *   medlem i en annan grupp läser eller listar                     nej
 *   avslutad medlem, agent, inloggad utan medlemskap, utloggad     nej
 *   vem som helst skriver, ändrar eller raderar (också ägaren)     nej
 *   sessioner, platser och räknare: läs och skriv, också som ägare nej  (ingen match: catch-allen)
 *
 * Kör: npm run test:rules
 */

import { gastregelfragment } from "../../src/lib/regler.js";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ID = "a".repeat(64);
const ID_GRANNEN = "b".repeat(64);

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;
/** @type {string} */
let regeltext = "";

const rad = (groupId, epost) => ({
  groupId,
  epost,
  namn: "",
  omfang: { slag: "sak", funktion: "rosta", handelseId: "h1" },
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
  if (!fs.existsSync(regler)) {
    throw new Error("rules/provregler.rules saknas. Kör npm run regler:skriv först, eller npm run test:rules som gör det åt dig.");
  }
  regeltext = fs.readFileSync(regler, "utf8");
  assert.ok(regeltext.length > 500, "provreglerna lästes tomma. Ett tomt underlag gör nekandet grönt av fel skäl.");
  assert.ok(
    regeltext.includes(gastregelfragment("gastinbjudningar")),
    "provreglerna innehåller inte gastregelfragment(\"gastinbjudningar\"). Catch-all nekar också, så ett saknat fragment hade sett grönt ut för nekandena (men inte för läsningen).",
  );
  // Sessionerna, platserna och räknarna har ingen match: nekandet kommer av catch-allen, och den måste finnas.
  for (const samling of ["gastsessioner", "gastplatser", "gastraknare"]) {
    assert.ok(!regeltext.includes(`match /${samling}/`), `${samling} har fått en match. Den ska sakna en, så att catch-allen nekar den.`);
  }
  assert.ok(/match \/\{document=\*\*\} \{\s*allow read, write: if false;/.test(regeltext), "provreglerna saknar en catch-all som nekar. Utan den är 'ingen match' inte detsamma som 'nekad'.");

  miljo = await initializeTestEnvironment({
    projectId: "regelprov",
    firestore: { rules: regeltext, host: "127.0.0.1", port: 8080 },
  });
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "memberships/uid-medlem|kallan"), { userId: "uid-medlem", groupId: "kallan", roll: "medlem", typ: "person", status: "aktiv" });
    await setDoc(doc(db, "memberships/uid-agare|kallan"), { userId: "uid-agare", groupId: "kallan", roll: "agare", typ: "person", status: "aktiv" });
    await setDoc(doc(db, "memberships/uid-slutad|kallan"), { userId: "uid-slutad", groupId: "kallan", roll: "medlem", typ: "person", status: "avslutad" });
    await setDoc(doc(db, "memberships/uid-agent|kallan"), { userId: "uid-agent", groupId: "kallan", roll: "admin", typ: "agent", status: "aktiv" });
    await setDoc(doc(db, "memberships/uid-granne|grannen"), { userId: "uid-granne", groupId: "grannen", roll: "agare", typ: "person", status: "aktiv" });
    await setDoc(doc(db, `gastinbjudningar/${ID}`), rad("kallan", "anna@foretag.se"));
    await setDoc(doc(db, `gastinbjudningar/${ID_GRANNEN}`), rad("grannen", "bo@foretag.se"));
    await setDoc(doc(db, "gastsessioner/s1"), { inbjudningId: ID, skapad: 1, senast: 1 });
    await setDoc(doc(db, "gastplatser/kallan|1"), { gastId: "g_x", skapad: 1 });
    await setDoc(doc(db, "gastraknare/r1"), { antal: 1, fonster: 1 });
  });
});

after(async () => {
  if (miljo) await miljo.cleanup();
});

const som = (uid) => miljo.authenticatedContext(uid).firestore();
const utan = () => miljo.unauthenticatedContext().firestore();

describe("gästinbjudningarna: en aktiv medlem i gruppen läser", () => {
  it("en medlem läser en inbjudan i sin grupp", async () => {
    const snap = await assertSucceeds(getDoc(doc(som("uid-medlem"), `gastinbjudningar/${ID}`)));
    assert.equal(snap.data().epost, "anna@foretag.se");
  });

  it("en ägare läser, och en fråga som begränsar groupId ger bara den gruppens inbjudningar", async () => {
    const snap = await assertSucceeds(getDocs(query(collection(som("uid-agare"), "gastinbjudningar"), where("groupId", "==", "kallan"))));
    // Golv: frågan hittar något, annars är "bara den gruppens" grönt av en tom lista.
    assert.equal(snap.size, 1);
    assert.equal(snap.docs[0].id, ID);
  });
});

describe("gästinbjudningarna: ingen annan läser", () => {
  it("en medlem i en annan grupp läser inte, varken en rad eller en lista för gruppen", async () => {
    await assertFails(getDoc(doc(som("uid-granne"), `gastinbjudningar/${ID}`)));
    await assertFails(getDocs(query(collection(som("uid-granne"), "gastinbjudningar"), where("groupId", "==", "kallan"))));
  });

  it("⛔ en lista som inte begränsar groupId nekas, också för en medlem: regeln kan inte pröva en fråga som inte säger vilken grupp den gäller", async () => {
    await assertFails(getDocs(collection(som("uid-medlem"), "gastinbjudningar")));
    await assertFails(getDocs(query(collection(som("uid-agare"), "gastinbjudningar"), where("epost", "==", "anna@foretag.se"))));
  });

  it("en avslutad medlem, en agent och en inloggad utan medlemskap läser inte", async () => {
    for (const uid of ["uid-slutad", "uid-agent", "uid-okand"]) {
      await assertFails(getDoc(doc(som(uid), `gastinbjudningar/${ID}`)));
      await assertFails(getDocs(query(collection(som(uid), "gastinbjudningar"), where("groupId", "==", "kallan"))));
    }
  });

  it("utan inloggning läser ingen", async () => {
    await assertFails(getDoc(doc(utan(), `gastinbjudningar/${ID}`)));
    await assertFails(getDocs(query(collection(utan(), "gastinbjudningar"), where("groupId", "==", "kallan"))));
  });
});

describe("gästinbjudningarna: ingen klient skriver", () => {
  it("varken en medlem eller en ägare skapar, ändrar eller raderar en inbjudan", async () => {
    for (const uid of ["uid-medlem", "uid-agare"]) {
      await assertFails(setDoc(doc(som(uid), `gastinbjudningar/${"d".repeat(64)}`), rad("kallan", "ny@foretag.se")));
      await assertFails(updateDoc(doc(som(uid), `gastinbjudningar/${ID}`), { aterkallad: 1 }));
      await assertFails(updateDoc(doc(som(uid), `gastinbjudningar/${ID}`), { nyckelHash: "e".repeat(64) }));
      await assertFails(deleteDoc(doc(som(uid), `gastinbjudningar/${ID}`)));
    }
  });

  it("utan inloggning skrivs ingenting", async () => {
    await assertFails(setDoc(doc(utan(), `gastinbjudningar/${"d".repeat(64)}`), rad("kallan", "ny@foretag.se")));
    await assertFails(updateDoc(doc(utan(), `gastinbjudningar/${ID}`), { aterkallad: 1 }));
  });
});

describe("sessionerna, platserna och räknarna: ingen match, catch-allen nekar", () => {
  for (const [samling, id] of [["gastsessioner", "s1"], ["gastplatser", "kallan|1"], ["gastraknare", "r1"]]) {
    it(`${samling}: en ägare läser, listar och skriver ingenting`, async () => {
      const db = som("uid-agare");
      await assertFails(getDoc(doc(db, `${samling}/${id}`)));
      await assertFails(getDocs(collection(db, samling)));
      await assertFails(setDoc(doc(db, `${samling}/ny`), { gastId: "g_y", skapad: 1 }));
      await assertFails(updateDoc(doc(db, `${samling}/${id}`), { skapad: 2 }));
      await assertFails(deleteDoc(doc(db, `${samling}/${id}`)));
      await assertFails(getDoc(doc(utan(), `${samling}/${id}`)));
    });
  }
});
