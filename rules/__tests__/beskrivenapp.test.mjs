/**
 * Regelprov för beskrivna appar (0.99.0, beslut 0005, lifehub.app#213): raderna (`beskrivenappdataregelfragment`) och
 * beskrivningarna (`beskrivningsregelfragment`).
 *
 * ⛔ VARJE VILLKOR I FRAGMENTEN SKA HA SETTS FALLA (regel 4). Proven är skrivna mot en mutationskörning där varje villkor
 * tagits bort, ett i taget. Tabellen står i PR:en.
 *
 * ROWS (samlingen `appdata`)
 *   LÄSA     egen grupp ja, annan grupp nej, utan grupp nej, avslutat medlemskap nej, utloggad nej
 *   SKAPA    medlem ja. I en annan grupp, i någon annans namn, som agent, med avslutat medlemskap, med extra fält, utan fält, med
 *            ett id som inte är ett id, med varden som inte är en map eller har för många fält, med fel klocka: nej
 *   ÄNDRA    skaparen ja, admin ja, ägare ja. Annan medlem, admin i en annan grupp, avslutat medlemskap: nej. Gruppen, appen,
 *            listan, skaparen och skapad står stilla.
 *   RADERA   skaparen ja, admin och ägare ja. Annan medlem, avslutad skapare, agent, utloggad: nej
 *
 * ⛔ DET REGELN INTE PRÖVAR STÅR HÄR SOM PROV, med flit: ett värde av fel typ i `varden` släpps igenom, eftersom regeln inte känner
 * beskrivningen. Det prövas i `validateRad` (src/__tests__/beskrivenapp.test.js). Ett prov som visar gränsen hindrar att någon
 * tror att regeln skyddar mer än den gör.
 *
 * DESCRIPTIONS (samlingen `appbeskrivningar`)
 *   LÄSA     medlem ja, annan grupp nej
 *   SKAPA    ägare och admin ja. Medlem, admin i en annan grupp, avslutad admin, agent: nej. Id som inte stämmer med kroppen nej.
 *   ÄNDRA    ägare och admin ja. Medlem nej. Gruppen, appens id, skapare och skapad står stilla.
 *   RADERA   ägare och admin ja. Medlem, admin i en annan grupp, avslutad admin, agent: nej.
 *
 * Reglerna skrivs av `scripts/skriv-provregler.mjs` ur `beskrivenappdataregelfragment("appdata")` och
 * `beskrivningsregelfragment("appbeskrivningar")`.
 */

import { beskrivningsId, MAX_FALT } from "../../src/lib/beskrivenapp.js";
import { medlemskapsId } from "../../src/lib/grupp.js";
import { after, before, describe, it } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const MEDLEM = "uid-cps-medlem";
const ANNAN = "uid-cps-annan";
const ADMIN = "uid-cps-admin";
const AGARE = "uid-cps-agare";
const AVSLUTAD = "uid-cps-avslutad";
const AVSLUTAD_ADMIN = "uid-cps-avslutad-admin";
const AGENT = "uid-cps-agent";
const AGENT_ADMIN = "uid-cps-agent-admin";
const UTANFOR = "uid-miranda-medlem";
const MIRANDA_ADMIN = "uid-miranda-admin";
const CPS = "cps-ab";
const MIRANDA = "miranda-ab";

const person = (uid) => ({ uid, namn: "Kim", typ: "manniska", kalla: "appar" });

/** En rad som en medlem skapar, med serverns klocka nu. */
const rad = (extra = {}) => {
  const nu = Date.now();
  return { groupId: CPS, appId: "utlaning", lista: "saker", varden: { namn: "Borr", skick: "Bra" }, skapadAv: person(MEDLEM), skapad: nu, andrad: nu, ...extra };
};

const beskrivning = (id = "utlaning", extra = {}) => ({
  format: 1,
  id,
  namn: "Utlåning",
  ikon: "book",
  beskrivning: "",
  listor: [{ id: "saker", namn: "Saker", falt: [{ id: "namn", namn: "Sak", typ: "text", krav: true }], rubrikfalt: "namn", visning: "lista" }],
  ...extra,
});
const dok = (id = "utlaning", extra = {}) => {
  const nu = Date.now();
  return { groupId: CPS, beskrivning: beskrivning(id), skapadAv: person(ADMIN), skapad: nu, andrad: nu, ...extra };
};
const bid = (groupId, appId) => `appbeskrivningar/${beskrivningsId(groupId, appId)}`;

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;

const medlemskap = (uid, groupId, roll, typ = "person", status = "aktiv") =>
  [`memberships/${medlemskapsId(uid, groupId)}`, { userId: uid, groupId, roll, typ, status }];

before(async () => {
  const regler = path.join(rot, "rules", "provregler.rules");
  if (!fs.existsSync(regler)) throw new Error("rules/provregler.rules saknas. Kör npm run regler:skriv först.");
  miljo = await initializeTestEnvironment({
    projectId: "regelprov",
    firestore: { rules: fs.readFileSync(regler, "utf8"), host: "127.0.0.1", port: 8080 },
  });
  await miljo.clearFirestore();
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [vag, r] of [
      medlemskap(MEDLEM, CPS, "medlem"),
      medlemskap(ANNAN, CPS, "medlem"),
      medlemskap(ADMIN, CPS, "admin"),
      medlemskap(AGARE, CPS, "agare"),
      medlemskap(AVSLUTAD, CPS, "medlem", "person", "avslutad"),
      medlemskap(AVSLUTAD_ADMIN, CPS, "admin", "person", "avslutad"),
      medlemskap(AGENT, CPS, "medlem", "agent"),
      medlemskap(AGENT_ADMIN, CPS, "admin", "agent"),
      medlemskap(UTANFOR, MIRANDA, "medlem"),
      medlemskap(MIRANDA_ADMIN, MIRANDA, "admin"),
    ]) {
      await setDoc(doc(db, vag), r);
    }
  });
});

after(async () => {
  await miljo?.cleanup();
});

/** @param {string} uid */
const db = (uid) => miljo.authenticatedContext(uid).firestore();
const utloggad = () => miljo.unauthenticatedContext().firestore();
let lopnr = 0;
/** Ett nytt dokument per prov, lagt förbi reglerna, så att proven inte ändrar varandras underlag. */
const lagg = async (samling, data, id = `rad-${++lopnr}`) => {
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `${samling}/${id}`), data);
  });
  return `${samling}/${id}`;
};
const nyRadId = () => `appdata/ny-${++lopnr}`;
/** Ett dokument som lades in för en timme sedan: klockan är ur fönstret, så ett oförändrat `andrad` går inte som "nu". */
const EN_TIMME = 3_600_000;
const gammalRad = () => rad({ skapad: Date.now() - EN_TIMME, andrad: Date.now() - EN_TIMME });
const gammalDok = (id) => dok(id, { skapad: Date.now() - EN_TIMME, andrad: Date.now() - EN_TIMME });

describe("radernas regler: läsa", () => {
  it("en medlem läser sin grupp och inte den andra, och inte hela samlingen", async () => {
    const egen = await lagg("appdata", rad());
    const deras = await lagg("appdata", rad({ groupId: MIRANDA, skapadAv: person(UTANFOR) }));
    await assertSucceeds(getDoc(doc(db(MEDLEM), egen)));
    await assertFails(getDoc(doc(db(MEDLEM), deras)));
    await assertFails(getDocs(query(collection(db(MEDLEM), "appdata"))));
    await assertSucceeds(getDocs(query(collection(db(MEDLEM), "appdata"), where("groupId", "==", CPS), where("appId", "==", "utlaning"))));
    await assertFails(getDocs(query(collection(db(MEDLEM), "appdata"), where("groupId", "==", MIRANDA))));
  });

  it("avslutat medlemskap, utanför gruppen och utloggad läser inte", async () => {
    const egen = await lagg("appdata", rad());
    await assertFails(getDoc(doc(db(AVSLUTAD), egen)));
    await assertFails(getDoc(doc(db(AVSLUTAD_ADMIN), egen)));
    await assertFails(getDoc(doc(db(UTANFOR), egen)));
    await assertFails(getDoc(doc(utloggad(), egen)));
  });
});

describe("radernas regler: skapa", () => {
  it("en medlem skapar som sig själv, även med tom varden", async () => {
    await assertSucceeds(setDoc(doc(db(MEDLEM), nyRadId()), rad()));
    await assertSucceeds(setDoc(doc(db(MEDLEM), nyRadId()), rad({ varden: {} })));
    await assertSucceeds(setDoc(doc(db(ADMIN), nyRadId()), rad({ skapadAv: person(ADMIN) })));
  });

  it("i en annan grupp, i någon annans namn, som agent, med avslutat medlemskap eller utloggad: nej", async () => {
    await assertFails(setDoc(doc(db(UTANFOR), nyRadId()), rad({ skapadAv: person(UTANFOR) })));
    await assertFails(setDoc(doc(db(MEDLEM), nyRadId()), rad({ groupId: MIRANDA })));
    await assertFails(setDoc(doc(db(MEDLEM), nyRadId()), rad({ skapadAv: person(ANNAN) })));
    await assertFails(setDoc(doc(db(AGENT), nyRadId()), rad({ skapadAv: person(AGENT) })));
    await assertFails(setDoc(doc(db(MEDLEM), nyRadId()), rad({ skapadAv: { ...person(MEDLEM), typ: "agent" } })));
    await assertFails(setDoc(doc(db(AVSLUTAD), nyRadId()), rad({ skapadAv: person(AVSLUTAD) })));
    await assertFails(setDoc(doc(utloggad(), nyRadId()), rad()));
  });

  it("extra fält, saknade fält och en skapare med extra fält: nej", async () => {
    await assertFails(setDoc(doc(db(MEDLEM), nyRadId()), rad({ extra: true })));
    for (const falt of ["groupId", "appId", "lista", "varden", "skapadAv", "skapad", "andrad"]) {
      const r = rad();
      delete r[falt];
      await assertFails(setDoc(doc(db(MEDLEM), nyRadId()), r));
    }
    await assertFails(setDoc(doc(db(MEDLEM), nyRadId()), rad({ skapadAv: { ...person(MEDLEM), extra: 1 } })));
    await assertFails(setDoc(doc(db(MEDLEM), nyRadId()), rad({ skapadAv: { uid: MEDLEM, namn: "Kim", typ: "manniska" } })));
  });

  it("appId och lista ska vara id: små bokstäver, siffror, bindestreck, 2 till 40 tecken", async () => {
    for (const id of ["Utlaning", "utlan_ing", "u", "x".repeat(41), "1saker", "med mellanslag", "", "a/b", 7, null]) {
      await assertFails(setDoc(doc(db(MEDLEM), nyRadId()), rad({ appId: id })));
      await assertFails(setDoc(doc(db(MEDLEM), nyRadId()), rad({ lista: id })));
    }
    await assertSucceeds(setDoc(doc(db(MEDLEM), nyRadId()), rad({ appId: "ab", lista: "x".repeat(40) })));
  });

  it("varden ska vara en map med högst så många fält som en lista får ha", async () => {
    const fulla = Object.fromEntries(Array.from({ length: MAX_FALT }, (_, i) => [`f-${i}`, "v"]));
    await assertSucceeds(setDoc(doc(db(MEDLEM), nyRadId()), rad({ varden: fulla })));
    await assertFails(setDoc(doc(db(MEDLEM), nyRadId()), rad({ varden: { ...fulla, extra: "v" } })));
    for (const v of ["text", ["a"], 5, null, true]) {
      await assertFails(setDoc(doc(db(MEDLEM), nyRadId()), rad({ varden: v })));
    }
  });

  it("klockan är serverns: en tid långt fram, långt bak eller en andrad före skapad: nej", async () => {
    const nu = Date.now();
    const ar = 365 * 24 * 3_600_000;
    await assertFails(setDoc(doc(db(MEDLEM), nyRadId()), rad({ skapad: nu + 10 * ar, andrad: nu + 10 * ar })));
    await assertFails(setDoc(doc(db(MEDLEM), nyRadId()), rad({ skapad: nu - ar, andrad: nu - ar })));
    await assertFails(setDoc(doc(db(MEDLEM), nyRadId()), rad({ andrad: nu + ar })));
    await assertFails(setDoc(doc(db(MEDLEM), nyRadId()), rad({ skapad: nu + 60_000, andrad: nu })));
    await assertFails(setDoc(doc(db(MEDLEM), nyRadId()), rad({ skapad: "nu", andrad: "nu" })));
  });

  it("GRÄNSEN: regeln känner inte beskrivningen, så ett värde av fel typ släpps in. validateRad är den som prövar det", async () => {
    await assertSucceeds(setDoc(doc(db(MEDLEM), nyRadId()), rad({ varden: { namn: 123, skick: { x: 1 }, vad: ["a"] } })));
  });
});

describe("radernas regler: ändra", () => {
  const nu = () => Date.now();

  it("skaparen, admin och ägare ändrar värdena, och skaparen står kvar när admin ändrar", async () => {
    for (const uid of [MEDLEM, ADMIN, AGARE]) {
      const vag = await lagg("appdata", rad());
      await assertSucceeds(updateDoc(doc(db(uid), vag), { varden: { namn: "Borrmaskin" }, andrad: nu() }));
    }
  });

  it("en annan medlem, en admin i en annan grupp, ett avslutat medlemskap, en agent och en utloggad: nej", async () => {
    const vag = await lagg("appdata", rad());
    const avslutadSkapare = await lagg("appdata", rad({ skapadAv: person(AVSLUTAD) }));
    for (const uid of [ANNAN, MIRANDA_ADMIN, UTANFOR, AVSLUTAD_ADMIN, AGENT]) {
      await assertFails(updateDoc(doc(db(uid), vag), { varden: { namn: "Stulet" }, andrad: nu() }));
    }
    await assertFails(updateDoc(doc(db(AVSLUTAD), avslutadSkapare), { varden: { namn: "Stulet" }, andrad: nu() }));
    await assertFails(updateDoc(doc(utloggad(), vag), { varden: { namn: "Stulet" }, andrad: nu() }));
  });

  it("gruppen, appen, listan, skaparen och skapad står stilla", async () => {
    const vag = await lagg("appdata", rad());
    await assertFails(updateDoc(doc(db(MEDLEM), vag), { groupId: MIRANDA, andrad: nu() }));
    await assertFails(updateDoc(doc(db(MEDLEM), vag), { appId: "bibliotek", andrad: nu() }));
    await assertFails(updateDoc(doc(db(MEDLEM), vag), { lista: "personer", andrad: nu() }));
    await assertFails(updateDoc(doc(db(MEDLEM), vag), { skapad: nu() - 1000, andrad: nu() }));
    await assertFails(updateDoc(doc(db(MEDLEM), vag), { skapadAv: person(ANNAN), andrad: nu() }));
    // Inte heller en admin skriver sig själv som skapare.
    await assertFails(updateDoc(doc(db(ADMIN), vag), { skapadAv: person(ADMIN), andrad: nu() }));
  });

  it("andrad är serverns klocka, formen gäller även vid en ändring, och ett extra fält nekas", async () => {
    const vag = await lagg("appdata", gammalRad());
    const ar = 365 * 24 * 3_600_000;
    await assertFails(updateDoc(doc(db(MEDLEM), vag), { varden: { namn: "x" } }));
    await assertFails(updateDoc(doc(db(MEDLEM), vag), { varden: { namn: "x" }, andrad: nu() + 10 * ar }));
    await assertFails(updateDoc(doc(db(MEDLEM), vag), { varden: "text", andrad: nu() }));
    await assertFails(updateDoc(doc(db(MEDLEM), vag), { varden: Object.fromEntries(Array.from({ length: MAX_FALT + 1 }, (_, i) => [`f-${i}`, "v"])), andrad: nu() }));
    await assertFails(updateDoc(doc(db(MEDLEM), vag), { extra: true, andrad: nu() }));
  });
});

describe("radernas regler: radera", () => {
  it("skaparen, admin och ägare raderar", async () => {
    for (const uid of [MEDLEM, ADMIN, AGARE]) {
      const vag = await lagg("appdata", rad());
      await assertSucceeds(deleteDoc(doc(db(uid), vag)));
    }
  });

  it("en annan medlem, en admin i en annan grupp, en avslutad skapare, en avslutad admin, en agent och en utloggad: nej", async () => {
    const vag = await lagg("appdata", rad());
    for (const uid of [ANNAN, MIRANDA_ADMIN, UTANFOR, AVSLUTAD_ADMIN, AGENT]) {
      await assertFails(deleteDoc(doc(db(uid), vag)));
    }
    await assertFails(deleteDoc(doc(utloggad(), vag)));
    const avslutadSkapare = await lagg("appdata", rad({ skapadAv: person(AVSLUTAD) }));
    await assertFails(deleteDoc(doc(db(AVSLUTAD), avslutadSkapare)));
  });
});

describe("beskrivningarnas regler: läsa", () => {
  it("en medlem läser sin grupps appar och inte den andras", async () => {
    const egen = await lagg("appbeskrivningar", dok(), beskrivningsId(CPS, "las-egen"));
    const deras = await lagg("appbeskrivningar", dok("las-deras", { groupId: MIRANDA, skapadAv: person(MIRANDA_ADMIN) }), beskrivningsId(MIRANDA, "las-deras"));
    await assertSucceeds(getDoc(doc(db(MEDLEM), egen)));
    await assertFails(getDoc(doc(db(MEDLEM), deras)));
    await assertFails(getDocs(query(collection(db(MEDLEM), "appbeskrivningar"))));
    await assertSucceeds(getDocs(query(collection(db(MEDLEM), "appbeskrivningar"), where("groupId", "==", CPS))));
    await assertFails(getDoc(doc(db(AVSLUTAD), egen)));
    await assertFails(getDoc(doc(utloggad(), egen)));
  });
});

describe("beskrivningarnas regler: skapa", () => {
  it("ägare och admin skapar som sig själva, på det riktiga id:t", async () => {
    await assertSucceeds(setDoc(doc(db(ADMIN), bid(CPS, "skapa-admin")), dok("skapa-admin")));
    await assertSucceeds(setDoc(doc(db(AGARE), bid(CPS, "skapa-agare")), dok("skapa-agare", { skapadAv: person(AGARE) })));
  });

  it("en vanlig medlem, en agent, en avslutad admin, en admin i en annan grupp och en utloggad skapar inte", async () => {
    await assertFails(setDoc(doc(db(MEDLEM), bid(CPS, "nej-medlem")), dok("nej-medlem", { skapadAv: person(MEDLEM) })));
    await assertFails(setDoc(doc(db(AGENT_ADMIN), bid(CPS, "nej-agent")), dok("nej-agent", { skapadAv: person(AGENT_ADMIN) })));
    await assertFails(setDoc(doc(db(AVSLUTAD_ADMIN), bid(CPS, "nej-avslutad")), dok("nej-avslutad", { skapadAv: person(AVSLUTAD_ADMIN) })));
    await assertFails(setDoc(doc(db(MIRANDA_ADMIN), bid(CPS, "nej-annan")), dok("nej-annan", { skapadAv: person(MIRANDA_ADMIN) })));
    await assertFails(setDoc(doc(utloggad(), bid(CPS, "nej-utloggad")), dok("nej-utloggad")));
  });

  it("i någon annans namn, eller som agent: nej", async () => {
    await assertFails(setDoc(doc(db(ADMIN), bid(CPS, "namn-1")), dok("namn-1", { skapadAv: person(AGARE) })));
    await assertFails(setDoc(doc(db(ADMIN), bid(CPS, "namn-2")), dok("namn-2", { skapadAv: { ...person(ADMIN), typ: "agent" } })));
  });

  it("id:t är bundet till kroppen: grupp och app måste stämma, och ägaren av A skriver inte på B:s plats", async () => {
    // Appens id i kroppen är inte det på dokumentet.
    await assertFails(setDoc(doc(db(ADMIN), bid(CPS, "bunden-1")), dok("bunden-2")));
    // Gruppen i id:t är en annan än kroppens: det var hålet i modulinställningarna (0.93.0).
    await assertFails(setDoc(doc(db(ADMIN), bid(MIRANDA, "bunden-3")), dok("bunden-3")));
    await assertFails(setDoc(doc(db(MIRANDA_ADMIN), bid(CPS, "bunden-4")), dok("bunden-4", { groupId: MIRANDA, skapadAv: person(MIRANDA_ADMIN) })));
    // Ett id utan tre delar.
    await assertFails(setDoc(doc(db(ADMIN), "appbeskrivningar/bunden-5"), dok("bunden-5")));
    await assertFails(setDoc(doc(db(ADMIN), `appbeskrivningar/6~${CPS}~bunden-6~extra`), dok("bunden-6")));
  });

  it("extra fält, saknade fält och en beskrivning med extra fält: nej", async () => {
    await assertFails(setDoc(doc(db(ADMIN), bid(CPS, "form-1")), dok("form-1", { extra: 1 })));
    for (const falt of ["groupId", "beskrivning", "skapadAv", "skapad", "andrad"]) {
      const d = dok("form-2");
      delete d[falt];
      await assertFails(setDoc(doc(db(ADMIN), bid(CPS, "form-2")), d));
    }
    await assertFails(setDoc(doc(db(ADMIN), bid(CPS, "form-3")), dok("form-3", { beskrivning: beskrivning("form-3", { farg: "röd" }) })));
  });

  it("beskrivningens yta: format 1, id på id-form, namn 1 till 60, text högst 500, 1 till 5 listor", async () => {
    const prova = (id, extra) => setDoc(doc(db(ADMIN), bid(CPS, id)), dok(id, { beskrivning: beskrivning(id, extra) }));
    await assertFails(prova("yta-1", { format: 2 }));
    await assertFails(prova("yta-2", { format: "1" }));
    await assertFails(prova("yta-3", { namn: "" }));
    await assertFails(prova("yta-4", { namn: "   " }));
    await assertFails(prova("yta-5", { namn: "n".repeat(61) }));
    await assertFails(prova("yta-6", { beskrivning: "b".repeat(501) }));
    await assertFails(prova("yta-7", { listor: [] }));
    await assertFails(prova("yta-8", { listor: Array.from({ length: 6 }, (_, i) => ({ id: `l-${i}` })) }));
    await assertFails(prova("yta-9", { listor: "saker" }));
    await assertSucceeds(prova("yta-10", { namn: "n".repeat(60), beskrivning: "b".repeat(500), listor: Array.from({ length: 5 }, (_, i) => ({ id: `l-${i}` })) }));
    for (const id of ["Utlaning", "utlan_ing", "u", "x".repeat(41), "1saker"]) {
      await assertFails(setDoc(doc(db(ADMIN), bid(CPS, id)), dok(id)));
    }
  });

  it("klockan är serverns", async () => {
    const nu = Date.now();
    const ar = 365 * 24 * 3_600_000;
    await assertFails(setDoc(doc(db(ADMIN), bid(CPS, "tid-1")), dok("tid-1", { skapad: nu + 10 * ar, andrad: nu + 10 * ar })));
    await assertFails(setDoc(doc(db(ADMIN), bid(CPS, "tid-2")), dok("tid-2", { skapad: nu + 60_000, andrad: nu })));
  });

  it("GRÄNSEN: regeln prövar inte fälttyperna, så en skev lista släpps in. validateBeskrivning prövar den, och läsaren släpper inte igenom den", async () => {
    const skev = beskrivning("skev", { listor: [{ id: "saker", namn: "Saker", falt: [{ id: "x", namn: "X", typ: "siffra" }], rubrikfalt: "x" }] });
    await assertSucceeds(setDoc(doc(db(ADMIN), bid(CPS, "skev")), dok("skev", { beskrivning: skev })));
  });
});

describe("beskrivningarnas regler: ändra", () => {
  const nu = () => Date.now();

  it("ägare och admin ändrar beskrivningen", async () => {
    for (const uid of [ADMIN, AGARE]) {
      const id = `andra-${uid}`.replace(/[^a-z-]/g, "");
      const vag = await lagg("appbeskrivningar", dok(id), beskrivningsId(CPS, id));
      await assertSucceeds(updateDoc(doc(db(uid), vag), { beskrivning: beskrivning(id, { namn: "Nytt namn" }), andrad: nu() }));
    }
  });

  it("en vanlig medlem, en admin i en annan grupp, en avslutad admin, en agent och en utloggad: nej", async () => {
    const vag = await lagg("appbeskrivningar", dok("andra-nej"), beskrivningsId(CPS, "andra-nej"));
    for (const uid of [MEDLEM, MIRANDA_ADMIN, AVSLUTAD_ADMIN, AGENT_ADMIN]) {
      await assertFails(updateDoc(doc(db(uid), vag), { beskrivning: beskrivning("andra-nej", { namn: "Stulet" }), andrad: nu() }));
    }
    await assertFails(updateDoc(doc(utloggad(), vag), { beskrivning: beskrivning("andra-nej", { namn: "Stulet" }), andrad: nu() }));
  });

  it("gruppen, appens id, skaparen och skapad står stilla, och klockan är serverns", async () => {
    const vag = await lagg("appbeskrivningar", gammalDok("stilla"), beskrivningsId(CPS, "stilla"));
    await assertFails(updateDoc(doc(db(ADMIN), vag), { groupId: MIRANDA, andrad: nu() }));
    await assertFails(updateDoc(doc(db(ADMIN), vag), { beskrivning: beskrivning("annat-id"), andrad: nu() }));
    await assertFails(updateDoc(doc(db(ADMIN), vag), { skapadAv: person(AGARE), andrad: nu() }));
    await assertFails(updateDoc(doc(db(ADMIN), vag), { skapad: nu() - 1000, andrad: nu() }));
    await assertFails(updateDoc(doc(db(ADMIN), vag), { beskrivning: beskrivning("stilla", { namn: "x" }) }));
    await assertFails(updateDoc(doc(db(ADMIN), vag), { beskrivning: beskrivning("stilla", { format: 2 }), andrad: nu() }));
    await assertFails(updateDoc(doc(db(ADMIN), vag), { extra: 1, andrad: nu() }));
  });
});

describe("beskrivningarnas regler: radera", () => {
  it("ägare och admin raderar", async () => {
    for (const uid of [ADMIN, AGARE]) {
      const id = `radera-${uid}`.replace(/[^a-z-]/g, "");
      const vag = await lagg("appbeskrivningar", dok(id), beskrivningsId(CPS, id));
      await assertSucceeds(deleteDoc(doc(db(uid), vag)));
    }
  });

  it("en vanlig medlem, en admin i en annan grupp, en avslutad admin, en agent och en utloggad: nej", async () => {
    const vag = await lagg("appbeskrivningar", dok("radera-nej"), beskrivningsId(CPS, "radera-nej"));
    for (const uid of [MEDLEM, ANNAN, MIRANDA_ADMIN, AVSLUTAD_ADMIN, AGENT_ADMIN]) {
      await assertFails(deleteDoc(doc(db(uid), vag)));
    }
    await assertFails(deleteDoc(doc(utloggad(), vag)));
  });
});
