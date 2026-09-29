/**
 * Regelprov för regelfragmentet i `src/lib/regler.js`, mot Firestore-emulatorn.
 *
 * ══ ⛔ PROVEN KÖR MOT GENERERAD TEXT, INTE MOT EN KOPIA ════════════════
 *
 * `rules/provregler.rules` skrivs av `scripts/skriv-provregler.mjs` ur
 * `regelfragment()` strax innan emulatorn startar. Vore filen handskriven
 * bevisade proven att någon skrev rätt en gång, inte att generatorn gör det.
 *
 * ══ ⛔ VAD SOM MÄTS, OCH VARFÖR JUST DET ══════════════════════════════
 *
 * Varje rad i matrisen nedan motsvarar ett villkor i fragmentet. Villkoret ska
 * kunna slås ut ett i taget och göra minst ett prov rött. Svepet står i
 * PR-texten till #136.
 *
 *   medlem läser sin grupps rad              ja
 *   medlem läser en ANNAN grupps rad         nej      <- hela poängen
 *   avslutad medlem läser                    nej
 *   utan inloggning                          nej
 *   ägare skriver konfig                     ja
 *   medlem skriver konfig                    nej
 *   flytta en rad till en annan grupp        nej
 *   skapa en rad utan groupId                nej
 *   klienten skriver memberships             nej
 *   ägaren raderar sitt eget medlemskap      nej
 *   profilen, sin egen                       ja
 *   profilen, någon annans                   nej
 *   gruppen, medlem läser, ägare skriver     ja
 *   gruppen, medlem skriver                  nej
 *   gruppen, ägare raderar                   nej
 *   inbjudan, ägare                          ja
 *   inbjudan, medlem                         nej
 *   samling utan block                       nej
 *
 * Kör: npm run test:rules
 */

import { medlemskapsId } from "../../src/lib/grupp.js";
import { after, before, describe, it } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const AGARE = "uid-agare";
const MEDLEM = "uid-medlem";
const AVSLUTAD = "uid-avslutad";
const UTANFOR = "uid-utanfor";
const ADMIN = "uid-admin";

const VAR = "grupp-var";
const ANNAN = "grupp-annan";

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;

before(async () => {
  const regler = path.join(rot, "rules", "provregler.rules");
  if (!fs.existsSync(regler)) {
    throw new Error("rules/provregler.rules saknas. Kör npm run regler:skriv först, eller npm run test:rules som gör det åt dig.");
  }
  miljo = await initializeTestEnvironment({
    projectId: "regelprov",
    firestore: { rules: fs.readFileSync(regler, "utf8"), host: "127.0.0.1", port: 8080 },
  });

  /*
   * ⛔ UNDERLAGET SKRIVS MED REGLERNA AVSTÄNGDA. Skrevs det genom reglerna vore
   * proven beroende av att skrivreglerna redan är rätt, och då mäter läsproven
   * två saker på en gång.
   */
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `memberships/${medlemskapsId(AGARE, VAR)}`), { userId: AGARE, groupId: VAR, roll: "agare", typ: "person", status: "aktiv" });
    await setDoc(doc(db, `memberships/${medlemskapsId(MEDLEM, VAR)}`), { userId: MEDLEM, groupId: VAR, roll: "medlem", typ: "person", status: "aktiv" });
    await setDoc(doc(db, `memberships/${medlemskapsId(AVSLUTAD, VAR)}`), { userId: AVSLUTAD, groupId: VAR, roll: "medlem", typ: "person", status: "avslutad" });
    await setDoc(doc(db, `memberships/${medlemskapsId(UTANFOR, ANNAN)}`), { userId: UTANFOR, groupId: ANNAN, roll: "agare", typ: "person", status: "aktiv" });
    await setDoc(doc(db, `memberships/${medlemskapsId(ADMIN, VAR)}`), { userId: ADMIN, groupId: VAR, roll: "admin", typ: "person", status: "aktiv" });

    await setDoc(doc(db, `groups/${VAR}`), {
      id: VAR, namn: { sv: "Vår grupp" }, moduler: ["ekonomi"], arkiverad: false, skapadAv: { uid: AGARE, namn: "Ägaren" },
      farg: "", ikon: "", bild: "", beskrivning: "", ort: "", epostsprak: "sv",
    });
    await setDoc(doc(db, `groups/${ANNAN}`), { namn: { sv: "Annan grupp" }, moduler: [], arkiverad: false });

    await setDoc(doc(db, "handelser/var-rad"), { groupId: VAR, titel: "Vår" });
    await setDoc(doc(db, "handelser/annan-rad"), { groupId: ANNAN, titel: "Annan" });
    await setDoc(doc(db, "konfig/var-konfig"), { groupId: VAR, varde: 1 });
    await setDoc(doc(db, "invitations/inb-1"), { epost: "ny@example.com", groupId: VAR, roll: "medlem", status: "vantar", tokenHash: "", giltigTill: "2026-10-30T00:00:00.000Z", skickad: "", antalSkickade: 0 });
    await setDoc(doc(db, "invitations/inb-annan"), { epost: "ny@example.com", groupId: ANNAN, roll: "medlem", status: "vantar", tokenHash: "", giltigTill: "2026-10-30T00:00:00.000Z", skickad: "", antalSkickade: 0 });
    await setDoc(doc(db, `users/${MEDLEM}`), { namn: "Medlem", epost: "medlem@example.com" });
    await setDoc(doc(db, "hemligt/rad"), { x: 1 });
    await setDoc(doc(db, "vitlista/vitlistad@example.com"), { epost: "vitlistad@example.com", tillagdAv: {}, tid: "2026-09-28T00:00:00.000Z" });
  });
});

after(async () => {
  if (miljo) await miljo.cleanup();
});

/** @param {string} uid */
const som = (uid) => miljo.authenticatedContext(uid).firestore();
const utanInloggning = () => miljo.unauthenticatedContext().firestore();

describe("⛔ appens rader: medlemskap i radens grupp avgör", () => {
  it("medlem läser sin grupps rad", async () => {
    await assertSucceeds(getDoc(doc(som(MEDLEM), "handelser/var-rad")));
  });

  it("⛔ medlem läser INTE en annan grupps rad", async () => {
    await assertFails(getDoc(doc(som(MEDLEM), "handelser/annan-rad")));
  });

  it("en avslutad medlem läser inte, trots att raden finns", async () => {
    await assertFails(getDoc(doc(som(AVSLUTAD), "handelser/var-rad")));
  });

  it("utan inloggning läser ingen", async () => {
    await assertFails(getDoc(doc(utanInloggning(), "handelser/var-rad")));
  });

  it("medlem skriver i sin grupp", async () => {
    await assertSucceeds(setDoc(doc(som(MEDLEM), "handelser/ny"), { groupId: VAR, titel: "Ny" }));
  });

  it("⛔ en rad kan inte skapas utan groupId", async () => {
    await assertFails(setDoc(doc(som(MEDLEM), "handelser/utan-grupp"), { titel: "Hemlös" }));
  });

  it("⛔ en rad kan inte FLYTTAS till en annan grupp", async () => {
    await assertFails(updateDoc(doc(som(MEDLEM), "handelser/var-rad"), { groupId: ANNAN }));
  });

  it("en utomstående skriver inte i vår grupp", async () => {
    await assertFails(setDoc(doc(som(UTANFOR), "handelser/kapad"), { groupId: VAR, titel: "Kapad" }));
  });
});

describe("⛔ ägare mot medlem: konfig kräver ägare", () => {
  it("ägaren skriver konfig", async () => {
    await assertSucceeds(setDoc(doc(som(AGARE), "konfig/ny"), { groupId: VAR, varde: 2 }));
  });

  it("medlemmen skriver inte konfig", async () => {
    await assertFails(setDoc(doc(som(MEDLEM), "konfig/medlemmens"), { groupId: VAR, varde: 3 }));
  });

  it("medlemmen läser konfig", async () => {
    await assertSucceeds(getDoc(doc(som(MEDLEM), "konfig/var-konfig")));
  });
});

describe("⛔ memberships skrivs aldrig av en klient", () => {
  it("ingen skapar sitt eget medlemskap", async () => {
    await assertFails(setDoc(doc(som(UTANFOR), `memberships/${medlemskapsId(UTANFOR, VAR)}`), { userId: UTANFOR, groupId: VAR, roll: "agare", typ: "person", status: "aktiv" }));
  });

  it("⛔ inte ens ägaren höjer någons roll", async () => {
    await assertFails(updateDoc(doc(som(AGARE), `memberships/${medlemskapsId(MEDLEM, VAR)}`), { roll: "agare" }));
  });

  it("⛔ ägaren raderar inte sitt eget medlemskap", async () => {
    await assertFails(deleteDoc(doc(som(AGARE), `memberships/${medlemskapsId(AGARE, VAR)}`)));
  });

  it("jag läser mitt eget medlemskap", async () => {
    await assertSucceeds(getDoc(doc(som(MEDLEM), `memberships/${medlemskapsId(MEDLEM, VAR)}`)));
  });

  it("ägaren läser gruppens medlemskap", async () => {
    await assertSucceeds(getDoc(doc(som(AGARE), `memberships/${medlemskapsId(MEDLEM, VAR)}`)));
  });

  it("en utomstående läser inte vårt medlemskap", async () => {
    await assertFails(getDoc(doc(som(UTANFOR), `memberships/${medlemskapsId(MEDLEM, VAR)}`)));
  });
});

describe("⛔ profilen: bara sin egen", () => {
  it("jag skriver min egen profil", async () => {
    await assertSucceeds(setDoc(doc(som(MEDLEM), `users/${MEDLEM}`), { namn: "Medlem", epost: "medlem@example.com", tema: "morkt" }));
  });

  it("jag läser inte någon annans profil", async () => {
    await assertFails(getDoc(doc(som(UTANFOR), `users/${MEDLEM}`)));
  });

  it("jag skriver inte någon annans profil", async () => {
    await assertFails(setDoc(doc(som(UTANFOR), `users/${MEDLEM}`), { namn: "Kapad" }));
  });
});

describe("⛔ gruppen: medlem läser, ägare skriver, ingen raderar", () => {
  it("medlemmen läser gruppen", async () => {
    await assertSucceeds(getDoc(doc(som(MEDLEM), `groups/${VAR}`)));
  });

  it("medlemmen skriver inte gruppen", async () => {
    await assertFails(updateDoc(doc(som(MEDLEM), `groups/${VAR}`), { moduler: ["allt"] }));
  });

  it("ägaren skriver gruppen", async () => {
    await assertSucceeds(updateDoc(doc(som(AGARE), `groups/${VAR}`), { moduler: ["ekonomi", "inkorg"] }));
  });

  it("⛔ ägaren raderar inte gruppen, den arkiveras", async () => {
    await assertFails(deleteDoc(doc(som(AGARE), `groups/${VAR}`)));
  });

  it("en utomstående läser inte gruppen", async () => {
    await assertFails(getDoc(doc(som(UTANFOR), `groups/${VAR}`)));
  });
});

describe("⛔ gruppen: admin ändrar utseende och uppgifter men inte mer (0.32.0, #180)", () => {
  it("⛔ en admin ändrar gruppens namn, färg, ikon och beskrivning", async () => {
    await assertSucceeds(
      updateDoc(doc(som(ADMIN), `groups/${VAR}`), { namn: { sv: "Nytt namn" }, farg: "3", ikon: "portfolj", beskrivning: "Kort text", ort: "Visby", epostsprak: "en" }),
    );
  });

  it("⛔ en admin raderar inte gruppen", async () => {
    await assertFails(deleteDoc(doc(som(ADMIN), `groups/${VAR}`)));
  });

  it("⛔ en admin ändrar inte modulerna, det är ägarens", async () => {
    await assertFails(updateDoc(doc(som(ADMIN), `groups/${VAR}`), { moduler: ["allt"] }));
  });

  it("⛔ en admin arkiverar inte gruppen, det är ägarens", async () => {
    await assertFails(updateDoc(doc(som(ADMIN), `groups/${VAR}`), { arkiverad: true }));
  });

  it("⛔ ingen ändrar vem som skapade gruppen, inte ens ägaren", async () => {
    await assertFails(updateDoc(doc(som(AGARE), `groups/${VAR}`), { skapadAv: { uid: AGARE, namn: "Någon annan" } }));
  });

  it("⛔ en medlem ändrar inte ens utseendet", async () => {
    await assertFails(updateDoc(doc(som(MEDLEM), `groups/${VAR}`), { farg: "2" }));
  });

  it("⛔ en admin i en ANNAN grupp ändrar inte den här", async () => {
    await assertFails(updateDoc(doc(som(UTANFOR), `groups/${VAR}`), { farg: "2" }));
  });

  it("ägaren ändrar utseendet OCH arkiverar", async () => {
    await assertSucceeds(updateDoc(doc(som(AGARE), `groups/${VAR}`), { farg: "4", arkiverad: true }));
  });
});

describe("⛔ medlemmarna: en medlem ser sina medkamrater, inte en annan grupps (0.32.0, #180)", () => {
  it("⛔ en medlem läser en medkamrats medlemskap i samma grupp", async () => {
    await assertSucceeds(getDoc(doc(som(MEDLEM), `memberships/${medlemskapsId(ADMIN, VAR)}`)));
  });

  it("⛔ en medlem läser INTE en annan grupps medlemskap", async () => {
    await assertFails(getDoc(doc(som(MEDLEM), `memberships/${medlemskapsId(UTANFOR, ANNAN)}`)));
  });

  it("en avslutad medlem läser inte medkamraternas medlemskap", async () => {
    await assertFails(getDoc(doc(som(AVSLUTAD), `memberships/${medlemskapsId(AGARE, VAR)}`)));
  });

  it("⛔ en admin skriver inget medlemskap från klienten, inte ens en medlem i sin egen grupp", async () => {
    await assertFails(setDoc(doc(som(ADMIN), `memberships/${medlemskapsId("uid-ny", VAR)}`), { userId: "uid-ny", groupId: VAR, roll: "medlem", typ: "person", status: "aktiv" }));
    await assertFails(updateDoc(doc(som(ADMIN), `memberships/${medlemskapsId(MEDLEM, VAR)}`), { roll: "admin" }));
  });
});

describe("⛔ inbjudan: bara gruppens ägare, den bär en adress", () => {
  it("ägaren läser inbjudan", async () => {
    await assertSucceeds(getDoc(doc(som(AGARE), "invitations/inb-1")));
  });

  it("medlemmen läser inte inbjudan", async () => {
    await assertFails(getDoc(doc(som(MEDLEM), "invitations/inb-1")));
  });

  /*
   * ⛔ INGEN KLIENT SKAPAR EN INBJUDAN (0.32.0, #180). Raden bär tokenHash och giltigTill, och de sätts av
   * `bjudIn` på serversidan. Före 0.32.0 fick ägaren skriva raden själv, och med rollen admin hade en
   * klientskriven inbjudan kunnat bära rollen agare.
   */
  it("⛔ inte ens ägaren skapar en inbjudan från klienten, det gör bjudIn", async () => {
    await assertFails(setDoc(doc(som(AGARE), "invitations/inb-2"), { epost: "ny2@example.com", groupId: VAR, roll: "medlem", status: "vantar" }));
  });

  it("⛔ en admin skapar inte en inbjudan med rollen agare från klienten", async () => {
    await assertFails(setDoc(doc(som(ADMIN), "invitations/inb-2"), { epost: "ny2@example.com", groupId: VAR, roll: "agare", status: "vantar" }));
  });

  it("medlemmen skapar inte en inbjudan", async () => {
    await assertFails(setDoc(doc(som(MEDLEM), "invitations/inb-3"), { epost: "ny3@example.com", groupId: VAR, roll: "medlem", status: "vantar" }));
  });

  it("en admin läser inbjudan", async () => {
    await assertSucceeds(getDoc(doc(som(ADMIN), "invitations/inb-1")));
  });

  it("en admin läser INTE en annan grupps inbjudan", async () => {
    await assertFails(getDoc(doc(som(ADMIN), "invitations/inb-annan")));
  });

  it("en admin får återkalla en inbjudan", async () => {
    await assertSucceeds(updateDoc(doc(som(ADMIN), "invitations/inb-1"), { status: "aterkallad" }));
  });

  it("⛔ tokenHash går inte att skriva från en klient, inte ens av ägaren", async () => {
    await assertFails(updateDoc(doc(som(AGARE), "invitations/inb-1"), { tokenHash: "a".repeat(64) }));
  });

  it("⛔ giltigTill går inte att förlänga från en klient, inte ens av ägaren", async () => {
    await assertFails(updateDoc(doc(som(AGARE), "invitations/inb-1"), { giltigTill: "2099-01-01T00:00:00.000Z" }));
  });

  it("⛔ en inbjudan kan inte flyttas till en annan grupp", async () => {
    await assertFails(updateDoc(doc(som(AGARE), "invitations/inb-1"), { groupId: ANNAN }));
  });

  /*
   * ⛔ ROLLEN ÄR OCKSÅ OFÖRÄNDERLIG (#137). En inbjudan är ett löfte som någon
   * redan fått. Höjs rollen i efterhand blir en accepterad inbjudan till medlem
   * plötsligt ett ägarskap, utan att den som accepterade såg det.
   */
  it("⛔ en inbjudans roll kan inte höjas i efterhand", async () => {
    await assertFails(updateDoc(doc(som(AGARE), "invitations/inb-1"), { roll: "agare" }));
  });

  it("ägaren får ändra statusen, alltså återkalla", async () => {
    await assertSucceeds(updateDoc(doc(som(AGARE), "invitations/inb-1"), { status: "aterkallad" }));
  });
});

describe("⛔ vitlistan: ingen klient läser eller skriver den, inte ens ägaren (#161)", () => {
  it("en inloggad ägare läser inte vitlistan", async () => {
    await assertFails(getDoc(doc(som(AGARE), "vitlista/vitlistad@example.com")));
  });

  it("en person kan inte skriva in sin egen adress", async () => {
    await assertFails(setDoc(doc(som(UTANFOR), "vitlista/utanfor@example.com"), { epost: "utanfor@example.com", tillagdAv: {}, tid: "x" }));
  });

  it("utan inloggning läser ingen vitlistan", async () => {
    await assertFails(getDoc(doc(utanInloggning(), "vitlista/vitlistad@example.com")));
  });
});

describe("⛔ catch-allen nekar", () => {
  it("en samling utan block går inte att läsa", async () => {
    await assertFails(getDoc(doc(som(AGARE), "hemligt/rad")));
  });
});
