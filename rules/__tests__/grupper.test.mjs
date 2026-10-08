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
 *   profilen, en annans adress               nej      (0.82.0, #313)
 *   profilen, egen overifierad adress        nej      (0.82.0, #313)
 *   profilen, egen verifierad adress         ja       (0.82.0, #313)
 *   profilen utan epost                      ja       (0.82.0, #313)
 *   gruppen, medlem läser, ägare skriver     ja
 *   gruppen, medlem skriver                  nej
 *   gruppen, ägare raderar                   nej
 *   inbjudan, ägare                          ja
 *   inbjudan, medlem                         nej
 *   inbjudan, vantar till aterkallad, admin  ja       (0.80.1)
 *   inbjudan, alla andra övergångar          nej      (0.80.1)
 *   samling utan block                       nej
 *   hubben: medlem/admin läser modulerna     ja       (0.38.0, #184)
 *   hubben: avslutad, utomstående, utan      nej
 *   hubben: fråga alla grupper med en modul  nej
 *   huvudmenyn: ägaren ändrar                ja       (0.83.0)
 *   huvudmenyn: admin ändrar                 nej      (0.83.0)
 *
 * Kör: npm run test:rules
 */

import { EXTERNTYPER, MAX_EXTERNA, MAX_EXTERNHEMLIGHET, MAX_EXTERNLABEL, MAX_EXTERNREPO, medlemskapsId } from "../../src/lib/grupp.js";
import { MAX_TYPAVVIKELSER, MAX_TYPID, MAX_TYPNAMN } from "../../src/lib/modultyper.js";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, deleteDoc, where } from "firebase/firestore";
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
/** Create-proven skriver en NY rad varje gång: en setDoc på en rad som finns är en update, och då provas fel regel. */
const NYA = ["ny-1", "ny-2", "ny-3", "ny-4", "ny-5"];

/*
 * ⛔ INBJUDNINGARNAS RADER, EN PER PROV (0.80.1). Ett nekande prov som av misstag släpps in ändrar sin rad, och
 * delade de raden provade nästa prov en annan utgångsstatus än det säger: mätt i svepet, när listan över ändrade
 * fält slogs ut blev bara det första fältprovet rött och de andra gröna av att raden redan var återkallad.
 */
/** @type {ReadonlyArray<[string, string]>} */
const INB_OVERGANGAR = [
  ["inb-aterkalla-admin", "vantar"],
  ["inb-aterkalla-agare", "vantar"],
  ["inb-medlem", "vantar"],
  ["inb-till-accepterad", "vantar"],
  ["inb-aterkallad", "aterkallad"],
  ["inb-accepterad", "accepterad"],
];
/** @type {ReadonlyArray<[string, unknown]>} */
const INB_FALT = [["tokenHash", "a".repeat(64)], ["giltigTill", "2099-01-01T00:00:00.000Z"], ["groupId", ANNAN], ["roll", "agare"], ["epost", "annan@example.com"], ["antalSkickade", 5]];

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

    // Gruppen som create-proven (#216) skapar: ägaren har medlemskap men raden saknas tills provet skriver den.
    for (const nid of NYA) {
      await setDoc(doc(db, `memberships/${medlemskapsId(AGARE, nid)}`), { userId: AGARE, groupId: nid, roll: "agare", typ: "person", status: "aktiv" });
    }

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
    // ⛔ EN RAD PER ÖVERGÅNG (0.80.1). En återkallelse som lyckas ändrar raden, och ett prov efter den på samma rad
    // provar då en annan utgångsstatus än det säger. `inb-1` står kvar som `vantar` genom hela sviten.
    for (const [iid, status] of [...INB_OVERGANGAR, ...INB_FALT.map(([falt]) => /** @type {[string, string]} */ ([`inb-falt-${falt}`, "vantar"]))]) {
      await setDoc(doc(db, `invitations/${iid}`), { epost: `${iid}@example.com`, groupId: VAR, roll: "medlem", status, tokenHash: "", giltigTill: "2026-10-30T00:00:00.000Z", skickad: "", antalSkickade: 0 });
    }
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

/*
 * ⛔ ADRESSEN I PROFILEN ÄR INLOGGNINGENS, VERIFIERAD (0.82.0, #313). Före rättelsen prövade regeln bara vilka fält
 * raden hade, och en inloggad användare skrev in någon annans adress i sin egen rad, också overifierad. `bjudIn`
 * litade på fältet och gav bort medlemskap. Varje prov skapar en EGEN rad: en setDoc på en rad som finns är en
 * update, och då provas fel regel.
 */
describe("⛔ profilens adress: den egna, verifierad (0.82.0, #313)", () => {
  /** @param {string} uid @param {Record<string, unknown>} token */
  const med = (uid, token) => miljo.authenticatedContext(uid, token).firestore();

  it("⛔ en annans adress nekas, också med en verifierad egen inloggning", async () => {
    await assertFails(setDoc(doc(med("uid-p-annan", { email: "jag@example.com", email_verified: true }), "users/uid-p-annan"), { namn: "Jag", epost: "offret@example.com" }));
  });

  it("⛔ den egna adressen nekas när den inte är verifierad", async () => {
    await assertFails(setDoc(doc(med("uid-p-overifierad", { email: "jag@example.com", email_verified: false }), "users/uid-p-overifierad"), { namn: "Jag", epost: "jag@example.com" }));
  });

  it("⛔ den egna adressen nekas när token inte säger något om verifieringen", async () => {
    await assertFails(setDoc(doc(med("uid-p-utan-flagga", { email: "jag@example.com" }), "users/uid-p-utan-flagga"), { namn: "Jag", epost: "jag@example.com" }));
  });

  it("⛔ en tom epost med en token utan email nekas, också när token säger verifierad", async () => {
    await assertFails(setDoc(doc(med("uid-p-tom", { email_verified: true }), "users/uid-p-tom"), { namn: "Jag", epost: "" }));
  });

  it("den egna verifierade adressen släpps in, i gemener också när inloggningen har versaler", async () => {
    await assertSucceeds(setDoc(doc(med("uid-p-verifierad", { email: "Jag@Example.com", email_verified: true }), "users/uid-p-verifierad"), { namn: "Jag", epost: "jag@example.com" }));
  });

  it("en rad utan epost släpps in, också utan adress i inloggningen", async () => {
    await assertSucceeds(setDoc(doc(med("uid-p-utan-epost", {}), "users/uid-p-utan-epost"), { namn: "Jag", tema: "morkt" }));
  });

  it("⛔ en uppdatering som byter till en annans adress nekas", async () => {
    const db = med("uid-p-byter", { email: "jag@example.com", email_verified: true });
    await assertSucceeds(setDoc(doc(db, "users/uid-p-byter"), { namn: "Jag", epost: "jag@example.com" }));
    await assertFails(updateDoc(doc(db, "users/uid-p-byter"), { epost: "offret@example.com" }));
  });

  it("en uppdatering som inte rör adressen prövas inte mot den", async () => {
    await assertSucceeds(updateDoc(doc(med(MEDLEM, { email: "nyadress@example.com", email_verified: false }), `users/${MEDLEM}`), { tema: "ljust" }));
  });
});

/*
 * ⛔ HUBBENS LÄSNING (0.38.0, #184). Hubben ritar den aktiva gruppens `moduler`, och det enda den läser är gruppens egen
 * rad. Proven mäter att fältet faktiskt NÅR en medlem (inte bara att raden gör det: `moduler` står i raden, och ett
 * framtida fältfilter hade tömt hubben utan ett fel) och att ingen annan når det, inte heller genom en fråga över alla
 * grupper som har en viss modul. En sådan fråga hade varit den enkla vägen att bygga "vilka grupper har Ekonomi", och
 * den läser andras grupper.
 */
describe("⛔ hubbens läsning: gruppens moduler, bara för dess medlemmar (0.38.0, #184)", () => {
  it("⛔ en medlem läser gruppens moduler", async () => {
    const snap = await assertSucceeds(getDoc(doc(som(MEDLEM), `groups/${VAR}`)));
    if (!snap.data()?.moduler?.includes("ekonomi")) throw new Error(`moduler nådde inte medlemmen: ${JSON.stringify(snap.data()?.moduler)}`);
  });

  it("⛔ en admin läser gruppens moduler (fast hen inte får ändra dem)", async () => {
    const snap = await assertSucceeds(getDoc(doc(som(ADMIN), `groups/${VAR}`)));
    if (!Array.isArray(snap.data()?.moduler)) throw new Error("moduler nådde inte admin.");
  });

  it("⛔ en avslutad medlem läser inte modulerna", async () => {
    await assertFails(getDoc(doc(som(AVSLUTAD), `groups/${VAR}`)));
  });

  it("⛔ ägaren av en ANNAN grupp läser inte den här gruppens moduler", async () => {
    await assertFails(getDoc(doc(som(UTANFOR), `groups/${VAR}`)));
  });

  it("⛔ utan inloggning läses inga moduler", async () => {
    await assertFails(getDoc(doc(utanInloggning(), `groups/${VAR}`)));
  });

  it("⛔ en fråga över alla grupper som har en modul avvisas, även för en medlem", async () => {
    await assertFails(getDocs(query(collection(som(MEDLEM), "groups"), where("moduler", "array-contains", "ekonomi"))));
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

  /*
   * ⛔ 0.83.0: `huvudmeny` (vilka moduler som har sin ikon i huvudet) är ägarens, som `moduler`. Röda mot 0.82.0 i den
   * riktning som släpper in: utan fältet i AGARGRUPPFALT nekas också ägaren (affectedKeys().hasOnly). Står det i
   * ADMINGRUPPFALT i stället blir admin-provet rött.
   */
  it("⛔ ägaren väljer vilka moduler som står i huvudmenyn", async () => {
    await assertSucceeds(updateDoc(doc(som(AGARE), `groups/${VAR}`), { huvudmeny: ["ekonomi"] }));
  });

  it("⛔ en admin ändrar inte huvudmenyn, det är ägarens", async () => {
    // ⛔ ETT VÄRDE SOM INTE REDAN STÅR DÄR. Raden delas mellan proven, och ägarens prov ovan har skrivit ["ekonomi"]: samma
    // värde en gång till är ingen ändring (`affectedKeys()` tom), och då släpps vem som helst med skrivrätt igenom. Provet
    // var grönt av fel skäl i första körningen, och det är därför raden står här.
    await assertFails(updateDoc(doc(som(ADMIN), `groups/${VAR}`), { huvudmeny: ["ekonomi", "admins-forsok"] }));
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

describe("⛔ gruppen: externaDatakallor skriver bara ägaren, och bara giltiga poster (0.41.0, #216)", () => {
  const giltig = () => ({ type: "github", repo: "cllp/bolag-ops", enabled: true });
  const sattExterna = (/** @type {string} */ uid, /** @type {any} */ varde) => updateDoc(doc(som(uid), `groups/${VAR}`), { externaDatakallor: varde });

  it("⛔ ägaren sätter en github-datakälla", async () => {
    await assertSucceeds(sattExterna(AGARE, [giltig()]));
  });

  it("ägaren uppdaterar listan med en post med label och credentialSecretId, och med två poster", async () => {
    await assertSucceeds(sattExterna(AGARE, [{ ...giltig(), label: "Bolagets repo", credentialSecretId: "github-bolag" }, { type: "github", repo: "cllp/ops-framework", enabled: false }]));
  });

  it("ägaren tömmer listan med []", async () => {
    await assertSucceeds(sattExterna(AGARE, []));
  });

  it("⛔ en admin skriver inte fältet", async () => {
    await assertFails(sattExterna(ADMIN, [giltig()]));
  });

  it("⛔ en admin tömmer inte en befintlig lista (fältet är ägarens, inte bara värdet)", async () => {
    await assertSucceeds(sattExterna(AGARE, [giltig()]));
    await assertFails(sattExterna(ADMIN, []));
  });

  it("en medlem skriver inte fältet", async () => {
    await assertFails(sattExterna(MEDLEM, [giltig()]));
  });

  it("⛔ en admin ändrar fortfarande utseendet, och ägaren fortfarande moduler: oförändrat beteende", async () => {
    await assertSucceeds(updateDoc(doc(som(ADMIN), `groups/${VAR}`), { ort: "Visby" }));
    await assertSucceeds(updateDoc(doc(som(AGARE), `groups/${VAR}`), { moduler: ["ekonomi"] }));
  });

  it("⛔ ägaren ändrar andra fält på en grupp utan fältet (frånvarande fält är giltigt)", async () => {
    await assertSucceeds(updateDoc(doc(som(AGARE), `groups/${VAR}`), { beskrivning: "Utan externa" }));
  });

  describe("avvisade poster, en avvikelse åt gången mot en giltig post", () => {
    it("kontroll: den giltiga posten går igenom", async () => {
      await assertSucceeds(sattExterna(AGARE, [giltig()]));
    });
    it("fel type", async () => {
      await assertFails(sattExterna(AGARE, [{ ...giltig(), type: "notion" }]));
    });
    it("type saknas", async () => {
      const { type: _t, ...utan } = giltig();
      await assertFails(sattExterna(AGARE, [utan]));
    });
    it("repo saknas", async () => {
      const { repo: _r, ...utan } = giltig();
      await assertFails(sattExterna(AGARE, [utan]));
    });
    it("enabled saknas", async () => {
      const { enabled: _e, ...utan } = giltig();
      await assertFails(sattExterna(AGARE, [utan]));
    });
    for (const [namn, repo] of /** @type {[string, any][]} */ ([
      ["repo utan snedstreck", "bolag-ops"],
      ["repo med två snedstreck", "cllp/bolag/ops"],
      ["repo med mellanslag", "cllp/bolag ops"],
      ["repo med understreck i ägaren", "cl_lp/bolag-ops"],
      ["repo med tom ägare", "/bolag-ops"],
      ["repo med tomt namn", "cllp/"],
      ["repo med punktnamn ..", "cllp/.."],
      ["repo med punktnamn .", "cllp/."],
      ["repo som är ett tal", 5],
      ["repo som är en url", "https://github.com/cllp/bolag-ops"],
      ["repo för långt", `cllp/${"a".repeat(MAX_EXTERNREPO)}`],
    ])) {
      it(namn, async () => {
        await assertFails(sattExterna(AGARE, [{ ...giltig(), repo }]));
      });
    }
    it("enabled är en sträng", async () => {
      await assertFails(sattExterna(AGARE, [{ ...giltig(), enabled: "true" }]));
    });
    it("enabled är ett tal", async () => {
      await assertFails(sattExterna(AGARE, [{ ...giltig(), enabled: 1 }]));
    });
    it("ett extra nyckelord i posten", async () => {
      await assertFails(sattExterna(AGARE, [{ ...giltig(), token: "abc" }]));
    });
    it("label som inte är en sträng", async () => {
      await assertFails(sattExterna(AGARE, [{ ...giltig(), label: 5 }]));
    });
    it("label för lång", async () => {
      await assertFails(sattExterna(AGARE, [{ ...giltig(), label: "x".repeat(MAX_EXTERNLABEL + 1) }]));
    });
    it("label på precis taket går igenom", async () => {
      await assertSucceeds(sattExterna(AGARE, [{ ...giltig(), label: "x".repeat(MAX_EXTERNLABEL) }]));
    });
    it("credentialSecretId med mellanslag", async () => {
      await assertFails(sattExterna(AGARE, [{ ...giltig(), credentialSecretId: "mitt namn" }]));
    });
    it("credentialSecretId tomt", async () => {
      await assertFails(sattExterna(AGARE, [{ ...giltig(), credentialSecretId: "" }]));
    });
    it("credentialSecretId för långt", async () => {
      await assertFails(sattExterna(AGARE, [{ ...giltig(), credentialSecretId: "a".repeat(MAX_EXTERNHEMLIGHET + 1) }]));
    });
    for (const token of ["ghp_" + "a".repeat(36), "github_pat_" + "a".repeat(30), "gho_abc", "ghs_abc"]) {
      it(`⛔ credentialSecretId som är en GitHub-token (${token.slice(0, 7)}...) nekas`, async () => {
        await assertFails(sattExterna(AGARE, [{ ...giltig(), credentialSecretId: token }]));
      });
    }
    it("posten är inte en map", async () => {
      await assertFails(sattExterna(AGARE, ["cllp/bolag-ops"]));
    });
    it("fältet är en sträng och inte en lista", async () => {
      await assertFails(sattExterna(AGARE, "cllp/bolag-ops"));
    });
    it("⛔ fältet är en TOM sträng och inte en lista (size() 0 går annars igenom posterna)", async () => {
      await assertFails(sattExterna(AGARE, ""));
    });
    it("⛔ fältet är en TOM map och inte en lista", async () => {
      await assertFails(sattExterna(AGARE, {}));
    });
    it("fältet är ett objekt och inte en lista", async () => {
      await assertFails(sattExterna(AGARE, giltig()));
    });
    it(`för många poster (${MAX_EXTERNA + 1})`, async () => {
      await assertFails(sattExterna(AGARE, Array.from({ length: MAX_EXTERNA + 1 }, giltig)));
    });
    it(`precis ${MAX_EXTERNA} poster går igenom`, async () => {
      await assertSucceeds(sattExterna(AGARE, Array.from({ length: MAX_EXTERNA }, giltig)));
    });
    it("⛔ en ogiltig post SIST i en full lista nekas (varje index är validerat, inte bara de första)", async () => {
      const lista = Array.from({ length: MAX_EXTERNA }, giltig);
      lista[MAX_EXTERNA - 1] = { ...giltig(), type: "notion" };
      await assertFails(sattExterna(AGARE, lista));
    });
    it("⛔ en ogiltig post i mitten nekas", async () => {
      await assertFails(sattExterna(AGARE, [giltig(), { ...giltig(), enabled: "ja" }, giltig()]));
    });
    it("listan har bara de typer ramverket känner", () => {
      assert.deepEqual([...EXTERNTYPER], ["github"]);
    });
  });

  describe("create av gruppen (valideringen gäller också då)", () => {
    const bas = (/** @type {string} */ nid) => ({ id: nid, namn: { sv: "Ny" }, moduler: [], arkiverad: false, skapadAv: { uid: AGARE, namn: "Ägaren" } });
    it("⛔ create utan fältet går igenom (oförändrat)", async () => {
      await assertSucceeds(setDoc(doc(som(AGARE), `groups/${NYA[0]}`), bas(NYA[0])));
    });
    it("create med en giltig datakälla går igenom", async () => {
      await assertSucceeds(setDoc(doc(som(AGARE), `groups/${NYA[1]}`), { ...bas(NYA[1]), externaDatakallor: [giltig()] }));
    });
    it("create med [] går igenom", async () => {
      await assertSucceeds(setDoc(doc(som(AGARE), `groups/${NYA[2]}`), { ...bas(NYA[2]), externaDatakallor: [] }));
    });
    it("⛔ create med en ogiltig datakälla nekas", async () => {
      await assertFails(setDoc(doc(som(AGARE), `groups/${NYA[3]}`), { ...bas(NYA[3]), externaDatakallor: [{ ...giltig(), type: "notion" }] }));
    });
    it("⛔ create med för många poster nekas", async () => {
      await assertFails(setDoc(doc(som(AGARE), `groups/${NYA[4]}`), { ...bas(NYA[4]), externaDatakallor: Array.from({ length: MAX_EXTERNA + 1 }, giltig) }));
    });
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

  it("en admin får återkalla en väntande inbjudan", async () => {
    await assertSucceeds(updateDoc(doc(som(ADMIN), "invitations/inb-aterkalla-admin"), { status: "aterkallad" }));
  });

  it("ägaren får återkalla en väntande inbjudan", async () => {
    await assertSucceeds(updateDoc(doc(som(AGARE), "invitations/inb-aterkalla-agare"), { status: "aterkallad" }));
  });

  it("⛔ en vanlig medlem återkallar inte en väntande inbjudan", async () => {
    await assertFails(updateDoc(doc(som(MEDLEM), "invitations/inb-medlem"), { status: "aterkallad" }));
  });

  /*
   * ⛔ STATUSEN GÅR BARA FRÅN `vantar` TILL `aterkallad` (0.80.1, granskningen av lifehub.app PR 117, punkt 3).
   * Mätt där: en återkallad ägarinbjudan sattes tillbaka till `vantar` av en admin. Accepten och ett nytt utskick
   * sker på serversidan med Admin SDK, aldrig härifrån.
   */
  it("⛔ en återkallad inbjudan kan inte sättas tillbaka till vantar, inte ens av ägaren", async () => {
    await assertFails(updateDoc(doc(som(AGARE), "invitations/inb-aterkallad"), { status: "vantar" }));
    await assertFails(updateDoc(doc(som(ADMIN), "invitations/inb-aterkallad"), { status: "vantar" }));
  });

  it("⛔ en accepterad inbjudan kan inte sättas tillbaka till vantar", async () => {
    await assertFails(updateDoc(doc(som(AGARE), "invitations/inb-accepterad"), { status: "vantar" }));
  });

  it("⛔ en accepterad inbjudan kan inte återkallas i efterhand", async () => {
    await assertFails(updateDoc(doc(som(AGARE), "invitations/inb-accepterad"), { status: "aterkallad" }));
  });

  it("⛔ en väntande inbjudan kan inte markeras accepterad från klienten, det gör accepten på serversidan", async () => {
    await assertFails(updateDoc(doc(som(AGARE), "invitations/inb-till-accepterad"), { status: "accepterad" }));
    await assertFails(updateDoc(doc(som(ADMIN), "invitations/inb-till-accepterad"), { status: "accepterad" }));
  });

  /*
   * ⛔ ÅTERKALLELSEN BÄR INGET ANNAT FÄLT MED SIG. Proven nedanför ändrar ett fält utan att ändra statusen, och de
   * nekas redan av övergångsvillkoret. De här ändrar statusen RÄTT och ett fält till, så att det är listan över
   * ändrade fält som nekar och ingenting annat.
   */
  for (const [falt, varde] of INB_FALT) {
    it(`⛔ en återkallelse som också ändrar ${falt} nekas`, async () => {
      await assertFails(updateDoc(doc(som(AGARE), `invitations/inb-falt-${falt}`), { status: "aterkallad", [falt]: varde }));
    });
  }

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

  it("raderna som nekades står kvar med sin status, och de två som återkallades är återkallade", async () => {
    /** @type {Record<string, string>} */
    const status = {};
    await miljo.withSecurityRulesDisabled(async (ctx) => {
      for (const iid of ["inb-1", ...INB_OVERGANGAR.map(([i]) => i), ...INB_FALT.map(([f]) => `inb-falt-${f}`)]) {
        status[iid] = (await getDoc(doc(ctx.firestore(), `invitations/${iid}`))).data()?.status;
      }
    });
    // ⛔ Golvet: alla rader lästes, en tom läsning hade gjort jämförelsen nedan grön av ingenting.
    assert.equal(Object.keys(status).length, 1 + INB_OVERGANGAR.length + INB_FALT.length);
    assert.deepEqual(status, {
      "inb-1": "vantar",
      "inb-aterkalla-admin": "aterkallad",
      "inb-aterkalla-agare": "aterkallad",
      "inb-medlem": "vantar",
      "inb-till-accepterad": "vantar",
      "inb-aterkallad": "aterkallad",
      "inb-accepterad": "accepterad",
      ...Object.fromEntries(INB_FALT.map(([f]) => [`inb-falt-${f}`, "vantar"])),
    });
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

describe("⛔ gruppen: typavvikelser skriver bara ägaren, och bara giltiga poster (0.42.0, #217)", () => {
  const giltig = () => ({ yta: "inkorg", id: "ekonomi:kvitto", dold: true });
  const satt = (/** @type {string} */ uid, /** @type {any} */ varde) => updateDoc(doc(som(uid), `groups/${VAR}`), { typavvikelser: varde });
  /** En ny grupp vars ägare har medlemskap men raden saknas: create och inte update. */
  let nr = 0;
  const skapa = async (/** @type {any} */ varde, /** @type {Record<string, unknown>} */ ovrigt = {}) => {
    const gid = `typ-ny-${(nr += 1)}`;
    await miljo.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `memberships/${medlemskapsId(AGARE, gid)}`), { userId: AGARE, groupId: gid, roll: "agare", typ: "person", status: "aktiv" });
    });
    return setDoc(doc(som(AGARE), `groups/${gid}`), { id: gid, namn: { sv: "Ny" }, moduler: [], arkiverad: false, skapadAv: { uid: AGARE, namn: "Ägaren" }, ...ovrigt, ...(varde === undefined ? {} : { typavvikelser: varde }) });
  };

  it("⛔ ägaren döljer ett bidrag, och döper om ett annat", async () => {
    await assertSucceeds(satt(AGARE, [giltig()]));
    await assertSucceeds(satt(AGARE, [giltig(), { yta: "kalender", id: "ekonomi:bokslut", dold: false, namn: { sv: "Bokslutet", en: "Closing" } }]));
  });

  it("ägaren tömmer listan med []", async () => {
    await assertSucceeds(satt(AGARE, []));
  });

  it("⛔ ytan aktivitet (0.55.0, #244 beslut A) går att dölja som de andra, en okänd yta nekas", async () => {
    await assertSucceeds(satt(AGARE, [{ yta: "aktivitet", id: "ekonomi:synk", dold: true }]));
    await assertFails(satt(AGARE, [{ yta: "loggen", id: "ekonomi:synk", dold: true }]));
  });

  it("⛔ en admin skriver inte fältet, och tömmer inte en befintlig lista", async () => {
    await assertFails(satt(ADMIN, [giltig()]));
    await assertSucceeds(satt(AGARE, [giltig()]));
    await assertFails(satt(ADMIN, []));
  });

  it("en medlem skriver inte fältet", async () => {
    await assertFails(satt(MEDLEM, [giltig()]));
  });

  it("⛔ ägaren ändrar andra fält på en grupp utan fältet (frånvarande fält är giltigt)", async () => {
    await assertSucceeds(updateDoc(doc(som(AGARE), `groups/${VAR}`), { beskrivning: "Utan avvikelser" }));
  });

  describe("budgeten på 1000 uttryck delas med externaDatakallor (#216)", () => {
    const externa = () => Array.from({ length: MAX_EXTERNA }, (_, i) => ({ type: "github", repo: `cllp/repo-${i}`, enabled: true }));
    const avvikelser = () => Array.from({ length: MAX_TYPAVVIKELSER }, (_, i) => ({ yta: "inkorg", id: `ekonomi:t${i}`, dold: true, namn: { sv: "Eget namn", en: "Own name" } }));
    const grupp = () => doc(som(AGARE), `groups/${VAR}`);

    it("⛔ en full lista externaDatakallor stänger inte ute en skrivning av typavvikelser (före 0.42.0 nekades redan en skrivning av två poster)", async () => {
      await assertSucceeds(updateDoc(grupp(), { externaDatakallor: externa() }));
      await assertSucceeds(updateDoc(grupp(), { typavvikelser: [giltig()] }));
      await assertSucceeds(updateDoc(grupp(), { typavvikelser: avvikelser() }));
    });

    it("⛔ båda listorna kan ligga FULLA på gruppen, och en annan ändring av gruppen går då igenom (ingen av dem valideras om)", async () => {
      await assertSucceeds(updateDoc(grupp(), { externaDatakallor: externa() }));
      await assertSucceeds(updateDoc(grupp(), { typavvikelser: avvikelser() }));
      await assertSucceeds(updateDoc(grupp(), { beskrivning: "Båda listorna fulla" }));
    });

    it("⛔ en LISTA SOM ÄNDRAS valideras fortfarande, också när den andra är full", async () => {
      await assertSucceeds(updateDoc(grupp(), { externaDatakallor: externa() }));
      await assertFails(updateDoc(grupp(), { typavvikelser: [{ ...giltig(), id: "kvitto" }] }));
      await assertSucceeds(updateDoc(grupp(), { typavvikelser: [] }));
      await assertFails(updateDoc(grupp(), { externaDatakallor: [{ type: "github", repo: "ingen-snedstreck", enabled: true }] }));
    });

    /*
     * ⛔ #223 (0.42.1). Proven nedan skriver externaDatakallor i sin DYRASTE form, båda valfria fälten på varje post.
     * Före 0.42.1 provades taket bara med minimala poster, och då gick tio igenom medan sju fulla spräckte budgeten.
     * Här stod också ett prov som sade att båda listorna fulla i SAMMA uppdatering går igenom: det gällde bara
     * minimala poster, och kombinationen nekas nu med ett eget villkor (se regler.js vid opsHarPoster).
     */
    const dyr = () => Array.from({ length: MAX_EXTERNA }, (_, i) => ({
      type: "github", repo: `cllp/repo-${i}`, enabled: true, label: "L".repeat(MAX_EXTERNLABEL), credentialSecretId: "h".repeat(MAX_EXTERNHEMLIGHET),
    }));

    /** Tomma listor först, en i taget. Ett oförändrat värde räknas inte som en ändring, och då hade provet mätt ingenting. */
    const tomma = async () => {
      await assertSucceeds(updateDoc(grupp(), { externaDatakallor: [] }));
      await assertSucceeds(updateDoc(grupp(), { typavvikelser: [] }));
    };

    it(`⛔ taket (${MAX_EXTERNA}) i den dyraste formen går igenom, skrivet ensamt`, async () => {
      await tomma();
      await assertSucceeds(updateDoc(grupp(), { externaDatakallor: dyr() }));
    });

    it("⛔ #223: med fulla typavvikelser LAGRADE går en full lista externaDatakallor i dyraste formen igenom (före 0.42.1 nekades redan en post)", async () => {
      await tomma();
      await assertSucceeds(updateDoc(grupp(), { typavvikelser: avvikelser() }));
      await assertSucceeds(updateDoc(grupp(), { externaDatakallor: dyr() }));
    });

    it("⛔ med en full dyr lista externaDatakallor LAGRAD går fulla typavvikelser igenom", async () => {
      await tomma();
      await assertSucceeds(updateDoc(grupp(), { externaDatakallor: dyr() }));
      await assertSucceeds(updateDoc(grupp(), { typavvikelser: avvikelser() }));
    });

    it("⛔ #223: båda listorna i SAMMA uppdatering nekas, också när båda är små (ett villkor, inte budgeten)", async () => {
      await tomma();
      await assertFails(updateDoc(grupp(), { externaDatakallor: externa(), typavvikelser: avvikelser() }));
      await assertFails(updateDoc(grupp(), { externaDatakallor: [{ type: "github", repo: "cllp/a", enabled: true }], typavvikelser: [giltig()] }));
      await assertSucceeds(updateDoc(grupp(), { externaDatakallor: [{ type: "github", repo: "cllp/a", enabled: true }] }));
      await assertSucceeds(updateDoc(grupp(), { typavvikelser: [giltig()] }));
    });

    it("⛔ #223: en ny grupp bär högst en av listorna med poster, och var för sig går de igenom fulla", async () => {
      await assertFails(skapa(avvikelser(), { externaDatakallor: [{ type: "github", repo: "cllp/a", enabled: true }] }));
      await assertSucceeds(skapa(avvikelser(), { externaDatakallor: [] }));
      await assertSucceeds(skapa(undefined, { externaDatakallor: dyr() }));
      await assertSucceeds(skapa([], { externaDatakallor: dyr() }));
    });
  });

  describe("avvisade poster, en avvikelse åt gången mot en giltig post", () => {
    it("kontroll: den giltiga posten går igenom", async () => {
      await assertSucceeds(satt(AGARE, [giltig()]));
    });

    const avvisade = /** @type {Array<[string, any]>} */ ([
      ["ett okänt fält på posten", { ...giltig(), extra: 1 }],
      ["en yta som inte finns", { ...giltig(), yta: "sok" }],
      ["ytan med ä", { ...giltig(), yta: "händelser" }],
      ["ett id utan kolon (en egen kategori, inte ett bidrag)", { ...giltig(), id: "kvitto" }],
      ["ett id med versaler", { ...giltig(), id: "Ekonomi:kvitto" }],
      ["ett id med två kolon", { ...giltig(), id: "a:b:c" }],
      ["ett id som är längre än taket", { ...giltig(), id: `a:${"b".repeat(MAX_TYPID)}` }],
      ["ett id som inte är en sträng", { ...giltig(), id: 7 }],
      ["dold som inte är bool", { ...giltig(), dold: "ja" }],
      ["en post utan dold", { yta: "inkorg", id: "ekonomi:kvitto" }],
      ["en avvikelse som inte gör något", { yta: "inkorg", id: "ekonomi:kvitto", dold: false }],
      ["ett namn som inte är en map", { ...giltig(), namn: "Underlag" }],
      ["ett namn utan sv", { ...giltig(), namn: { en: "Receipt" } }],
      ["ett tomt sv", { ...giltig(), namn: { sv: "" } }],
      ["ett sv över taket", { ...giltig(), namn: { sv: "x".repeat(MAX_TYPNAMN + 1) } }],
      ["ett en över taket", { ...giltig(), namn: { sv: "x", en: "x".repeat(MAX_TYPNAMN + 1) } }],
      ["ett namn med ett tredje språk", { ...giltig(), namn: { sv: "x", fr: "x" } }],
    ]);
    for (const [namn, post] of avvisade) {
      it(`⛔ ${namn}`, async () => {
        await assertFails(satt(AGARE, [post]));
      });
    }

    it("⛔ en post som inte är en map", async () => {
      await assertFails(satt(AGARE, ["ekonomi:kvitto"]));
    });

    it("⛔ fältet är en sträng i stället för en lista, också en kort eller tom", async () => {
      await assertFails(satt(AGARE, "ekonomi:kvitto"));
      await assertFails(satt(AGARE, ""));
      await assertFails(satt(AGARE, "x"));
    });

    it("⛔ fältet är en tom map i stället för en lista (size() är 0, så bara typkontrollen fäller den)", async () => {
      await assertFails(satt(AGARE, {}));
    });

    it("⛔ en lista över taket nekas, en på taket går igenom", async () => {
      const lista = (/** @type {number} */ n) => Array.from({ length: n }, (_, i) => ({ yta: "inkorg", id: `ekonomi:t${i}`, dold: true }));
      await assertSucceeds(satt(AGARE, lista(MAX_TYPAVVIKELSER)));
      await assertFails(satt(AGARE, lista(MAX_TYPAVVIKELSER + 1)));
    });

    it("⛔ den SISTA posten i en full lista valideras också", async () => {
      const lista = Array.from({ length: MAX_TYPAVVIKELSER }, (_, i) => ({ yta: "inkorg", id: `ekonomi:t${i}`, dold: true }));
      lista[MAX_TYPAVVIKELSER - 1] = /** @type {any} */ ({ ...lista[MAX_TYPAVVIKELSER - 1], dold: "ja" });
      await assertFails(satt(AGARE, lista));
    });
  });

  describe("skapa en grupp (create) kontrolleras lika", () => {
    it("en grupp utan fältet och en med en giltig lista skapas", async () => {
      await assertSucceeds(skapa(undefined));
      await assertSucceeds(skapa([giltig()]));
    });

    it("⛔ en grupp med en ogiltig avvikelse skapas inte", async () => {
      await assertFails(skapa([{ ...giltig(), id: "kvitto" }]));
      await assertFails(skapa("x"));
    });
  });
});
