/**
 * Regelprov för mejlkö (0.74.0, ops-framework#101).
 *
 * ⛔ CATCH-ALL NEKAR OCKSÅ. Ett prov som bara gör assertFails hade varit grönt
 * utan fragmentet, eftersom provreglernas sista block nekar allt som saknar
 * ett eget. Därför läses den genererade filen först: blocket för `mejlko`
 * måste vara `mejlregelfragment("mejlko")`, inte frånvaron av en regel.
 *
 *   inloggad läser ett köat dokument     nej
 *   inloggad listar kön                  nej
 *   inloggad skapar ett köat dokument    nej
 *   inloggad ändrar ett köat dokument    nej
 *   utan inloggning läser                nej
 *
 * Kör: npm run test:rules
 */

import { mejlregelfragment } from "../../src/lib/mejl.js";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { assertFails, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;

before(async () => {
  const regler = path.join(rot, "rules", "provregler.rules");
  if (!fs.existsSync(regler)) {
    throw new Error("rules/provregler.rules saknas. Kör npm run regler:skriv först, eller npm run test:rules som gör det åt dig.");
  }
  const text = fs.readFileSync(regler, "utf8");
  assert.ok(text.length > 500, "provreglerna lästes tomma. Ett tomt underlag gör nekandet grönt av fel skäl.");
  const fragment = mejlregelfragment("mejlko");
  assert.ok(
    text.includes(fragment),
    "provreglerna innehåller inte mejlregelfragment(\"mejlko\"). Catch-all nekar också, så ett saknat fragment hade sett grönt ut.",
  );

  miljo = await initializeTestEnvironment({
    projectId: "regelprov",
    firestore: { rules: text, host: "127.0.0.1", port: 8080 },
  });
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "mejlko/finns"), {
      till: "a@unik-doman.test",
      amne: "Hej",
      text: "Hej",
      html: "",
      sprak: "sv",
      kategori: "inbjudan",
      groupId: null,
      status: "koad",
    });
  });
});

after(async () => {
  if (miljo) await miljo.cleanup();
});

const som = (uid) => miljo.authenticatedContext(uid).firestore();
const utan = () => miljo.unauthenticatedContext().firestore();

describe("mejlkön: ingen klient läser eller skriver", () => {
  it("en inloggad klient läser inte ett köat dokument", async () => {
    await assertFails(getDoc(doc(som("uid-1"), "mejlko/finns")));
  });

  it("en inloggad klient listar inte kön", async () => {
    await assertFails(getDocs(collection(som("uid-1"), "mejlko")));
  });

  it("en inloggad klient skriver inte i kön", async () => {
    await assertFails(setDoc(doc(som("uid-1"), "mejlko/ny"), { till: "x@y.se", status: "koad" }));
  });

  it("en inloggad klient ändrar inte ett köat dokument", async () => {
    await assertFails(updateDoc(doc(som("uid-1"), "mejlko/finns"), { status: "skickad" }));
  });

  it("utan inloggning läser ingen kön", async () => {
    await assertFails(getDoc(doc(utan(), "mejlko/finns")));
  });
});
