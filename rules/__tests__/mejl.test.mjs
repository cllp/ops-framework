/**
 * Regelprov för mejlkön (0.74.0, #101), mot Firestore-emulatorn.
 *
 * ══ ⛔ VARFÖR EN ÖPPEN SAMLING BREDVID ═══════════════════════════════════
 *
 * Firestore nekar när ingen regel tillåter. Ett prov som bara säger "klienten
 * skriver inte i kön" är då grönt också om fragmentet saknas, och grönt om
 * emulatorn nekar allt. Det är arbetsreglernas punkt 4: ett prov som blir
 * grönt av att ingenting lästes.
 *
 * Därför ligger en samling `oppna` i SAMMA regeltext, med `allow write: if
 * request.auth != null`. Samma inloggade klient skriver där, och skriver inte
 * i kön. Går `oppna` inte att skriva är emulatorn trasig. Går kön att skriva
 * har fragmentet släppt in en klient.
 *
 * Regeln byggs av `mejlregelfragment`, inte av en avskriven kopia.
 */

import { mejlregelfragment } from "../../src/lib/mejl.js";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

const fragment = mejlregelfragment("mejl");
const allows = [...fragment.matchAll(/allow\s+([^;]+);/g)];

const regler = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /oppna/{id} {
      allow read, write: if request.auth != null;
    }
${fragment}  }
}
`;

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;

before(async () => {
  if (allows.length === 0) {
    throw new Error("mejlregelfragment gav inga allow-rader. Ett tomt fragment nekas av Firestore ändå, och provet hade varit grönt av fel skäl.");
  }
  for (const rad of allows) {
    if (!/if\s+false\s*$/.test(rad[1].trim())) {
      throw new Error(`mejlregelfragment tillåter något: ${rad[0]}`);
    }
  }
  miljo = await initializeTestEnvironment({
    projectId: "regelprov",
    firestore: { rules: regler, host: "127.0.0.1", port: 8080 },
  });
});

after(async () => {
  if (miljo) await miljo.cleanup();
});

const som = (uid) => miljo.authenticatedContext(uid).firestore();
const utan = () => miljo.unauthenticatedContext().firestore();
const KLIENT = "uid-medlem";

describe("mejlkö: en klient skriver inte, och samma klient skriver där det är tillåtet", () => {
  it("en inloggad klient skriver i den öppna samlingen", async () => {
    await assertSucceeds(setDoc(doc(som(KLIENT), "oppna/rad"), { x: 1 }));
  });

  it("samma klient skriver inte i kön", async () => {
    await assertFails(setDoc(doc(som(KLIENT), "mejl/rad"), { till: "a@bolaget.se", amne: "Hej", text: "t", html: "<p>t</p>", sprak: "sv", kategori: "inbjudan", status: "koad" }));
  });

  it("samma klient läser inte kön", async () => {
    await assertFails(getDoc(doc(som(KLIENT), "mejl/rad")));
  });

  it("utan inloggning skriver ingen i kön", async () => {
    await assertFails(setDoc(doc(utan(), "mejl/annan"), { till: "a@bolaget.se" }));
  });

  it("utan inloggning skriver ingen i den öppna samlingen heller", async () => {
    await assertFails(setDoc(doc(utan(), "oppna/nej"), { x: 1 }));
  });
});
