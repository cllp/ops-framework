/**
 * Regelprov för `via` på skaparen (0.135.0, cllp/lifehub.app#409, CP 2026-10-21 "Ja på alla").
 *
 * En personlig API-nyckel skriver SOM personen, och märket `via: { nyckelId, namn }` säger att det var nyckeln. Märket skrivs av servern (Admin SDK, som går förbi reglerna)
 * och ALDRIG av en klient: en klient som fick skriva det kunde skriva en rad som påstår att en nyckel skrev den, och en klient som fick TA BORT det kunde göra en rad från en nyckel
 * till personens egen.
 *
 * ⛔ VARJE VILLKOR HÄR SKA HA SETTS FALLA (regel 4): rött på reglerna som de var före 0.135.0, grönt på de nya. Utfallen står i PR-texten.
 *
 *   KLIENTEN SKRIVER ALDRIG via   bibliotek, beskrivna appars rader och beskrivningar, ändringsloggen (`av`), kommentarer, chattmeddelanden, minnet (`lyftAv`),
 *                                 modulinställningarna (`uppdateradAv`) och appens händelser (`opsHandelsefaltGiltiga`): med via nej, utan via ja
 *   EN RAD MED via ÄNDRAS         författaren och admin ändrar innehållet när stämpeln är OFÖRÄNDRAD (ja). Ta bort via, ändra via, lägga till via på en rad som saknar det: nej
 *                                 (`skapadAv` står stilla vid en ändring, och det gäller också märket)
 *   RADERA                        författaren raderar en rad hens nyckel skrev
 *
 * Reglerna skrivs av `scripts/skriv-provregler.mjs` ur ramverkets regelfragment.
 */

import { medlemskapsId } from "../../src/lib/grupp.js";
import { beskrivningsId } from "../../src/lib/beskrivenapp.js";
import { modulinstallningsId } from "../../src/lib/modulinstallningar.js";
import { byggKonfigandring } from "../../src/lib/konfiglogg.js";
import { samtalsnyckel } from "../../src/lib/samtal.js";
import { after, before, describe, it } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, setDoc, updateDoc } from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const MEDLEM = "uid-via-medlem";
const ANNAN = "uid-via-annan";
const ADMIN = "uid-via-admin";
const AGARE = "uid-via-agare";
const CPS = "cps-ab";
const VIA = { nyckelId: "0123456789abcdef", namn: "Byggagent" };
const ANNAN_VIA = { nyckelId: "fedcba9876543210", namn: "Kalenderagent" };
const EN_TIMME = 3_600_000;

const person = (uid, extra = {}) => ({ uid, namn: "Kim", typ: "manniska", kalla: "api", ...extra });
const medVia = (uid) => person(uid, { via: VIA });

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;
const medlemskap = (uid, groupId, roll) => [`memberships/${medlemskapsId(uid, groupId)}`, { userId: uid, groupId, roll, typ: "person", status: "aktiv" }];

const GRUPPCHATT = samtalsnyckel({ groupId: CPS, slag: "grupp" });

before(async () => {
  const regler = path.join(rot, "rules", "provregler.rules");
  if (!fs.existsSync(regler)) throw new Error("rules/provregler.rules saknas. Kör npm run regler:skriv först.");
  miljo = await initializeTestEnvironment({ projectId: "regelprov-via", firestore: { rules: fs.readFileSync(regler, "utf8"), host: "127.0.0.1", port: 8080 } });
  await miljo.clearFirestore();
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [vag, data] of [medlemskap(MEDLEM, CPS, "medlem"), medlemskap(ANNAN, CPS, "medlem"), medlemskap(ADMIN, CPS, "admin"), medlemskap(AGARE, CPS, "agare")]) await setDoc(doc(db, vag), data);
    await setDoc(doc(db, "handelser/h1"), { groupId: CPS, rubrik: "Höstfest" });
    await setDoc(doc(db, `samtal/${GRUPPCHATT}`), { groupId: CPS, slag: "grupp", skapad: Date.now(), skapadAv: MEDLEM });
  });
});

after(async () => {
  await miljo?.cleanup();
});

/** @param {string} uid */
const db = (uid) => miljo.authenticatedContext(uid).firestore();
let lopnr = 0;
const id = (/** @type {string} */ samling) => `${samling}/ny-${++lopnr}`;
/** Ett dokument skrivet av servern: förbi reglerna, med ett märke. */
const server = async (/** @type {string} */ samling, /** @type {Record<string, any>} */ data) => {
  const vag = id(samling);
  await miljo.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), vag), data));
  return vag;
};
const gammalt = () => ({ skapad: Date.now() - EN_TIMME, andrad: Date.now() - EN_TIMME });

// ── Bibliotek ───────────────────────────────────────────────────────────────────────────────
const post = (extra = {}) => {
  const nu = Date.now();
  return { groupId: CPS, typ: "anteckning", rubrik: "Protokoll", text: "Vi beslutade.", skapadAv: person(MEDLEM), skapad: nu, andrad: nu, ...extra };
};

describe("via i biblioteket", () => {
  it("⛔ en klient skapar inte en post med via, och skapar samma post utan via", async () => {
    await assertFails(setDoc(doc(db(MEDLEM), id("bibliotek")), post({ skapadAv: medVia(MEDLEM) })));
    await assertSucceeds(setDoc(doc(db(MEDLEM), id("bibliotek")), post()));
  });

  it("⛔ en tom via-nyckel, via som null och via som sträng skrivs inte heller", async () => {
    for (const v of [null, "Byggagent", {}, []]) await assertFails(setDoc(doc(db(MEDLEM), id("bibliotek")), post({ skapadAv: person(MEDLEM, { via: v }) })));
  });

  it("⛔ författaren och admin ändrar innehållet på en post hens nyckel skrev, när stämpeln är oförändrad", async () => {
    const vag = await server("bibliotek", post({ skapadAv: medVia(MEDLEM), ...gammalt() }));
    await assertSucceeds(updateDoc(doc(db(MEDLEM), vag), { text: "Ändrad av personen.", andrad: Date.now() }));
    const vag2 = await server("bibliotek", post({ skapadAv: medVia(MEDLEM), ...gammalt() }));
    await assertSucceeds(updateDoc(doc(db(ADMIN), vag2), { text: "Ändrad av admin.", andrad: Date.now() }));
  });

  it("⛔ ingen klient tar bort, byter eller lägger till via på en befintlig post", async () => {
    const vag = await server("bibliotek", post({ skapadAv: medVia(MEDLEM), ...gammalt() }));
    await assertFails(updateDoc(doc(db(MEDLEM), vag), { skapadAv: person(MEDLEM), andrad: Date.now() }));
    await assertFails(updateDoc(doc(db(ADMIN), vag), { skapadAv: person(MEDLEM), andrad: Date.now() }));
    await assertFails(updateDoc(doc(db(MEDLEM), vag), { skapadAv: person(MEDLEM, { via: ANNAN_VIA }), andrad: Date.now() }));
    await assertFails(updateDoc(doc(db(MEDLEM), vag), { "skapadAv.via.namn": "Annat namn", andrad: Date.now() }));
    const utan = await server("bibliotek", post({ ...gammalt() }));
    await assertFails(updateDoc(doc(db(MEDLEM), utan), { skapadAv: medVia(MEDLEM), andrad: Date.now() }));
    await assertFails(updateDoc(doc(db(ADMIN), utan), { skapadAv: medVia(MEDLEM), andrad: Date.now() }));
  });

  it("en annan medlem ändrar inte en post hens nyckel skrev, och författaren raderar den", async () => {
    const vag = await server("bibliotek", post({ skapadAv: medVia(MEDLEM), ...gammalt() }));
    await assertFails(updateDoc(doc(db(ANNAN), vag), { text: "Stulet.", andrad: Date.now() }));
    await assertSucceeds(deleteDoc(doc(db(MEDLEM), vag)));
  });
});

// ── Beskrivna apparnas rader och beskrivningar ───────────────────────────────────────────────
const rad = (extra = {}) => {
  const nu = Date.now();
  return { groupId: CPS, appId: "utlaning", lista: "saker", varden: { namn: "Borr" }, skapadAv: person(MEDLEM), skapad: nu, andrad: nu, ...extra };
};

describe("via i en beskriven apps rader", () => {
  it("⛔ en klient skapar inte en rad med via, och skapar samma rad utan via", async () => {
    await assertFails(setDoc(doc(db(MEDLEM), id("appdata")), rad({ skapadAv: medVia(MEDLEM) })));
    await assertSucceeds(setDoc(doc(db(MEDLEM), id("appdata")), rad()));
  });

  it("⛔ författaren och admin ändrar värdena på en rad hens nyckel skrev, men märket rörs inte", async () => {
    const vag = await server("appdata", rad({ skapadAv: medVia(MEDLEM), ...gammalt() }));
    await assertSucceeds(updateDoc(doc(db(MEDLEM), vag), { varden: { namn: "Borrmaskin" }, andrad: Date.now() }));
    await assertSucceeds(updateDoc(doc(db(ADMIN), vag), { varden: { namn: "Adminens" }, andrad: Date.now() }));
    await assertFails(updateDoc(doc(db(MEDLEM), vag), { skapadAv: person(MEDLEM), andrad: Date.now() }));
    await assertFails(updateDoc(doc(db(MEDLEM), vag), { skapadAv: person(MEDLEM, { via: ANNAN_VIA }), andrad: Date.now() }));
    const utan = await server("appdata", rad({ ...gammalt() }));
    await assertFails(updateDoc(doc(db(MEDLEM), utan), { skapadAv: medVia(MEDLEM), andrad: Date.now() }));
  });
});

const dok = (extra = {}) => {
  const nu = Date.now();
  return {
    groupId: CPS,
    beskrivning: { format: 1, id: "utlaning", namn: "Utlåning", ikon: "book", beskrivning: "", listor: [{ id: "saker", namn: "Saker", falt: [{ id: "namn", namn: "Sak", typ: "text", krav: true }], rubrikfalt: "namn", visning: "lista" }] },
    skapadAv: person(ADMIN),
    skapad: nu,
    andrad: nu,
    ...extra,
  };
};
const dokId = (/** @type {string} */ app) => `appbeskrivningar/${beskrivningsId(CPS, app)}`;

describe("via i en beskriven apps beskrivning", () => {
  it("⛔ en admin skapar inte en beskrivning med via, och skapar samma beskrivning utan via", async () => {
    await assertFails(setDoc(doc(db(ADMIN), dokId("via-nej")), dok({ beskrivning: { ...dok().beskrivning, id: "via-nej" }, skapadAv: medVia(ADMIN) })));
    await assertSucceeds(setDoc(doc(db(ADMIN), dokId("via-ja")), dok({ beskrivning: { ...dok().beskrivning, id: "via-ja" } })));
  });

  it("⛔ admin ändrar en beskrivning hens nyckel skrev, med stämpeln oförändrad, men lägger inte till eller byter märket", async () => {
    const app = "via-andra";
    const vag = dokId(app);
    await miljo.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), vag), dok({ beskrivning: { ...dok().beskrivning, id: app }, skapadAv: medVia(ADMIN), ...gammalt() })));
    await assertSucceeds(updateDoc(doc(db(ADMIN), vag), { "beskrivning.namn": "Utlåning 2", andrad: Date.now() }));
    await assertFails(updateDoc(doc(db(ADMIN), vag), { skapadAv: person(ADMIN), andrad: Date.now() }));
    await assertFails(updateDoc(doc(db(ADMIN), vag), { skapadAv: person(ADMIN, { via: ANNAN_VIA }), andrad: Date.now() }));
    const app2 = "via-lagg";
    await miljo.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), dokId(app2)), dok({ beskrivning: { ...dok().beskrivning, id: app2 }, ...gammalt() })));
    await assertFails(updateDoc(doc(db(ADMIN), dokId(app2)), { skapadAv: medVia(ADMIN), andrad: Date.now() }));
  });
});

// ── Ändringsloggen ───────────────────────────────────────────────────────────────────────────
describe("via i ändringsloggen", () => {
  const logg = (av) => byggKonfigandring({ handelse: "tillagd", groupId: CPS, id: "uppgift", efter: { id: "uppgift", namn: { sv: "Uppgifter" } }, av, nu: () => "2026-10-21T10:00:00.000Z" });

  it("⛔ en admin skriver inte en loggrad med via i av, och skriver samma rad utan via", async () => {
    await assertFails(setDoc(doc(db(ADMIN), id("konfiglogg")), logg(medVia(ADMIN))));
    await assertSucceeds(setDoc(doc(db(ADMIN), id("konfiglogg")), logg(person(ADMIN))));
  });
});

// ── Kommentarer på en händelse ───────────────────────────────────────────────────────────────
describe("via i en kommentar", () => {
  const kommentar = (skapadAv) => ({ text: "Hej", skapad: "2026-10-21T10:00:00.000Z", skapadAv });

  it("⛔ en medlem skriver inte en kommentar med via, och skriver samma kommentar utan via", async () => {
    await assertFails(setDoc(doc(db(MEDLEM), `handelser/h1/kommentarer/via-${++lopnr}`), kommentar(medVia(MEDLEM))));
    await assertSucceeds(setDoc(doc(db(MEDLEM), `handelser/h1/kommentarer/utan-${++lopnr}`), kommentar(person(MEDLEM))));
  });

  it("författaren raderar en kommentar hens nyckel skrev", async () => {
    const vag = `handelser/h1/kommentarer/server-${++lopnr}`;
    await miljo.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), vag), kommentar(medVia(MEDLEM))));
    await assertSucceeds(deleteDoc(doc(db(MEDLEM), vag)));
  });
});

// ── Chattmeddelanden ─────────────────────────────────────────────────────────────────────────
describe("via i ett chattmeddelande", () => {
  it("⛔ en medlem skriver inte ett meddelande med via, och skriver samma meddelande utan via", async () => {
    const nu = Date.now();
    await assertFails(setDoc(doc(db(MEDLEM), `samtal/${GRUPPCHATT}/meddelanden/via-${++lopnr}`), { text: "Hej", av: MEDLEM, tid: nu, via: VIA }));
    await assertSucceeds(setDoc(doc(db(MEDLEM), `samtal/${GRUPPCHATT}/meddelanden/utan-${++lopnr}`), { text: "Hej", av: MEDLEM, tid: nu }));
  });

  it("⛔ ett meddelande ändras aldrig, så märket kan inte läggas till eller tas bort efteråt", async () => {
    const vag = `samtal/${GRUPPCHATT}/meddelanden/server-${++lopnr}`;
    await miljo.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), vag), { text: "Från nyckeln", av: MEDLEM, tid: Date.now(), via: VIA }));
    await assertFails(updateDoc(doc(db(MEDLEM), vag), { via: ANNAN_VIA }));
    await assertFails(updateDoc(doc(db(MEDLEM), vag), { text: "Ändrat" }));
  });
});

// ── Minnet ───────────────────────────────────────────────────────────────────────────────────
describe("via i minnet", () => {
  const minne = (lyftAv) => {
    const nu = Date.now();
    return { groupId: CPS, text: "Budgeten är klar.", kalla: { slag: "trad", samtal: `${CPS}|grupp`, trad: "rot1", meddelande: "svar1" }, lyftAv, lyft: nu, andrad: nu };
  };

  it("⛔ minnet lyfts av en person i appen och aldrig av en nyckel: via nekas, utan via går in", async () => {
    await assertFails(setDoc(doc(db(MEDLEM), id("gruppmine")), minne(medVia(MEDLEM))));
    await assertSucceeds(setDoc(doc(db(MEDLEM), id("gruppmine")), minne(person(MEDLEM))));
  });
});

// ── Modulinställningar ───────────────────────────────────────────────────────────────────────
describe("via i modulinställningarna", () => {
  const installning = (modulId, uppdateradAv) => ({ groupId: CPS, modulId, varden: [{ id: "visaklara", typ: "boolean", bool: false, text: "" }], uppdateradAv, uppdaterad: Date.now() });

  it("⛔ ägaren sparar inte en inställning med via i uppdateradAv, och sparar samma inställning utan via", async () => {
    await assertFails(setDoc(doc(db(AGARE), `modulinstallningar/${modulinstallningsId(CPS, "via-nej")}`), installning("via-nej", medVia(AGARE))));
    await assertSucceeds(setDoc(doc(db(AGARE), `modulinstallningar/${modulinstallningsId(CPS, "via-ja")}`), installning("via-ja", person(AGARE))));
  });
});

// ── Appens händelser (opsHandelsefaltGiltiga) ────────────────────────────────────────────────
describe("via på appens händelser", () => {
  it("⛔ en medlem skapar inte en händelse med via i skapadAv, och skapar samma händelse utan via, eller med en gammal sträng som skapare", async () => {
    await assertFails(setDoc(doc(db(MEDLEM), id("kalhandelser")), { groupId: CPS, rubrik: "Möte", skapadAv: medVia(MEDLEM) }));
    await assertSucceeds(setDoc(doc(db(MEDLEM), id("kalhandelser")), { groupId: CPS, rubrik: "Möte", skapadAv: person(MEDLEM) }));
    await assertSucceeds(setDoc(doc(db(MEDLEM), id("kalhandelser")), { groupId: CPS, rubrik: "Gammalt", skapadAv: "gammal@example.se" }));
  });

  it("⛔ en medlem ändrar en händelse hens nyckel skrev när stämpeln är oförändrad, men tar inte bort, byter eller lägger till via", async () => {
    const vag = await server("kalhandelser", { groupId: CPS, rubrik: "Från nyckeln", skapadAv: medVia(MEDLEM) });
    await assertSucceeds(updateDoc(doc(db(ANNAN), vag), { rubrik: "Ändrad av en annan medlem" }));
    await assertFails(updateDoc(doc(db(MEDLEM), vag), { skapadAv: person(MEDLEM) }));
    await assertFails(updateDoc(doc(db(MEDLEM), vag), { skapadAv: person(MEDLEM, { via: ANNAN_VIA }) }));
    const utan = await server("kalhandelser", { groupId: CPS, rubrik: "För hand", skapadAv: person(MEDLEM) });
    await assertFails(updateDoc(doc(db(MEDLEM), utan), { skapadAv: medVia(MEDLEM) }));
    await assertSucceeds(updateDoc(doc(db(MEDLEM), utan), { rubrik: "Ändrad" }));
  });
});
