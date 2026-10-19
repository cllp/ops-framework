/**
 * Regelprov för delningslänkarna (0.119.0, lifehub.app#356).
 *
 * ⛔ CATCH-ALL NEKAR OCKSÅ, som för mejlkön. Ett prov som bara gör assertFails hade varit grönt utan fragmentet, eftersom provreglernas
 * sista block nekar allt som saknar ett eget. Därför läses den genererade filen först: blocket för `delningar` måste vara
 * `delningsregelfragment("delningar")`, inte frånvaron av en regel.
 *
 * Två nivåer av underlag: raden finns på riktigt (skriven med reglerna avstängda, som Admin SDK gör), och klienten försöker läsa den
 * på alla sätt som finns, som en medlem i gruppen, som ägare av posten, som en helt annan inloggad och utan inloggning.
 *
 *   medlem i gruppen läser en delning        nej
 *   den som delade läser sin egen            nej
 *   inloggad listar samlingen                nej
 *   inloggad frågar på postId                nej
 *   inloggad skapar en delning               nej  (ger sig själv en länk till en fil i en annan grupp)
 *   inloggad ändrar nedladdning              nej
 *   inloggad öppnar en stängd länk           nej
 *   inloggad raderar en delning              nej
 *   utan inloggning läser och skriver        nej
 *
 * Kör: npm run test:rules
 */

import { delningsregelfragment } from "../../src/lib/regler.js";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { assertFails, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ID = "a".repeat(64);

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;

before(async () => {
  const regler = path.join(rot, "rules", "provregler.rules");
  if (!fs.existsSync(regler)) {
    throw new Error("rules/provregler.rules saknas. Kör npm run regler:skriv först, eller npm run test:rules som gör det åt dig.");
  }
  const text = fs.readFileSync(regler, "utf8");
  assert.ok(text.length > 500, "provreglerna lästes tomma. Ett tomt underlag gör nekandet grönt av fel skäl.");
  const fragment = delningsregelfragment("delningar");
  assert.ok(
    text.includes(fragment),
    "provreglerna innehåller inte delningsregelfragment(\"delningar\"). Catch-all nekar också, så ett saknat fragment hade sett grönt ut.",
  );

  miljo = await initializeTestEnvironment({
    projectId: "regelprov",
    firestore: { rules: text, host: "127.0.0.1", port: 8080 },
  });
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // Gruppen och dess medlemmar, så att en regel som av misstag släppte in "medlemmar" hade något att släppa in.
    await setDoc(doc(db, "memberships/uid-medlem|kallan"), { userId: "uid-medlem", groupId: "kallan", roll: "medlem", typ: "person", status: "aktiv" });
    await setDoc(doc(db, "memberships/uid-agare|kallan"), { userId: "uid-agare", groupId: "kallan", roll: "agare", typ: "person", status: "aktiv" });
    await setDoc(doc(db, `delningar/${ID}`), {
      postId: "p1",
      groupId: "kallan",
      skapadAv: { uid: "uid-medlem", namn: "Medlem" },
      skapad: 1_800_000_000_000,
      giltigTill: 1_800_000_000_000 + 7 * 86_400_000,
      aterkallad: null,
      nedladdning: false,
    });
    await setDoc(doc(db, `delningar/${"b".repeat(64)}`), {
      postId: "p2",
      groupId: "kallan",
      skapadAv: { uid: "uid-medlem", namn: "Medlem" },
      skapad: 1_800_000_000_000,
      giltigTill: 1_800_000_000_000 + 86_400_000,
      aterkallad: 1_800_000_100_000,
      nedladdning: true,
    });
  });
});

after(async () => {
  if (miljo) await miljo.cleanup();
});

const som = (uid) => miljo.authenticatedContext(uid).firestore();
const utan = () => miljo.unauthenticatedContext().firestore();

describe("delningarna: ingen klient läser", () => {
  it("en medlem i gruppen läser inte en delning", async () => {
    await assertFails(getDoc(doc(som("uid-agare"), `delningar/${ID}`)));
  });

  it("den som delade läser inte sin egen delning", async () => {
    await assertFails(getDoc(doc(som("uid-medlem"), `delningar/${ID}`)));
  });

  it("en helt annan inloggad läser inte en delning", async () => {
    await assertFails(getDoc(doc(som("uid-annan"), `delningar/${ID}`)));
  });

  it("en inloggad listar inte samlingen", async () => {
    await assertFails(getDocs(collection(som("uid-medlem"), "delningar")));
  });

  it("en inloggad kan inte fråga efter delningar på en post", async () => {
    await assertFails(getDocs(query(collection(som("uid-medlem"), "delningar"), where("postId", "==", "p1"))));
  });

  it("utan inloggning läser ingen en delning", async () => {
    await assertFails(getDoc(doc(utan(), `delningar/${ID}`)));
    await assertFails(getDocs(collection(utan(), "delningar")));
  });
});

describe("delningarna: ingen klient skriver", () => {
  it("en inloggad skapar inte en delning, inte ens för sin egen grupp", async () => {
    await assertFails(
      setDoc(doc(som("uid-agare"), `delningar/${"c".repeat(64)}`), {
        postId: "p1",
        groupId: "kallan",
        skapadAv: { uid: "uid-agare", namn: "Ägare" },
        skapad: 1,
        giltigTill: 2,
        aterkallad: null,
        nedladdning: true,
      }),
    );
  });

  it("en inloggad ändrar inte nedladdning", async () => {
    await assertFails(updateDoc(doc(som("uid-medlem"), `delningar/${ID}`), { nedladdning: true }));
  });

  it("en inloggad öppnar inte en stängd länk", async () => {
    await assertFails(updateDoc(doc(som("uid-medlem"), `delningar/${"b".repeat(64)}`), { aterkallad: null }));
  });

  it("en inloggad raderar inte en delning", async () => {
    await assertFails(deleteDoc(doc(som("uid-medlem"), `delningar/${ID}`)));
  });

  it("utan inloggning skrivs ingenting", async () => {
    await assertFails(setDoc(doc(utan(), `delningar/${"d".repeat(64)}`), { postId: "p1" }));
    await assertFails(updateDoc(doc(utan(), `delningar/${ID}`), { aterkallad: 1 }));
  });
});
