/**
 * Regelprov för biblioteket (analys 0004, #192).
 *
 * ⛔ VARJE VILLKOR I FRAGMENTET SKA HA SETTS FALLA (regel 4, granskningen av #304).
 * Den första versionen av de här proven fångade 7 av 20 mutationer, och två av dem
 * som överlevde var kärnan: att skapa i en annan grupp och att flytta en post dit.
 * Proven nedan är skrivna mot en mutationskörning där varje villkor tagits bort,
 * ett i taget. Tabellen står i PR:en.
 *
 *   LÄSA     egen grupp ja, annan grupp nej, utan grupp nej, avslutat medlemskap nej
 *   SKAPA    i en annan grupp, i någon annans namn, som agent, med avslutat
 *            medlemskap, med extra fält, utan klocka, med taken: nej
 *   ÄNDRA    författaren ja, admin ja, annan medlem nej, admin i en annan grupp nej,
 *            flytta gruppen nej, byta typ nej, skriva om skapad eller skapadAv nej
 *   RADERA   författaren ja, admin och ägare i gruppen ja. Annan medlem, admin i
 *            en annan grupp, avslutat medlemskap, agent och utloggad: nej (#311)
 *
 * Reglerna skrivs av `scripts/skriv-provregler.mjs` ur `bibliotekregelfragment("bibliotek")`.
 */

import { medlemskapsId } from "../../src/lib/grupp.js";
import { MAX_BIBLIOTEKRUBRIK, MAX_BIBLIOTEKTEXT, MAX_BIBLIOTEKURL, byggPost, inmatningsfel, postFel } from "../../src/lib/bibliotek.js";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const MEDLEM = "uid-cps-medlem";
const ANNAN = "uid-cps-annan";
const ADMIN = "uid-cps-admin";
const AVSLUTAD = "uid-cps-avslutad";
const AGENT = "uid-cps-agent";
const BADA = "uid-bada";
const MIRANDA_ADMIN = "uid-miranda-admin";
const CPS = "cps-ab";
const MIRANDA = "miranda-ab";

/** Klockslaget när posterna lades in. Serverns klocka är nära, så `opsBiblioteketNu` släpper igenom det. */
const T0 = Date.now();

const skapare = (uid) => ({ uid, namn: "Kim", typ: "manniska", kalla: "bibliotek" });
const anteckning = (extra = {}) => ({
  groupId: CPS,
  typ: "anteckning",
  rubrik: "Protokoll",
  text: "Vi beslutade.",
  skapadAv: skapare(MEDLEM),
  skapad: T0,
  andrad: T0,
  ...extra,
});
/** En ny post, med serverns klocka nu. */
const ny = (extra = {}) => {
  const nu = Date.now();
  return anteckning({ skapad: nu, andrad: nu, ...extra });
};
const nyLank = (extra = {}) => {
  const { text: _text, ...utanText } = ny();
  return { ...utanText, typ: "lank", rubrik: "Verket", url: "https://bolagsverket.se/", ...extra };
};

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
    for (const [vag, rad] of [
      medlemskap(MEDLEM, CPS, "medlem"),
      medlemskap(ANNAN, CPS, "medlem"),
      medlemskap(ADMIN, CPS, "admin"),
      medlemskap(AVSLUTAD, CPS, "medlem", "person", "avslutad"),
      medlemskap(AGENT, CPS, "medlem", "agent"),
      medlemskap(BADA, CPS, "medlem"),
      medlemskap(BADA, MIRANDA, "medlem"),
      medlemskap(MIRANDA_ADMIN, MIRANDA, "admin"),
    ]) {
      await setDoc(doc(db, vag), rad);
    }
    await setDoc(doc(db, "bibliotek/cps-protokoll"), anteckning());
    await setDoc(doc(db, "bibliotek/miranda-hemlig"), anteckning({ groupId: MIRANDA, rubrik: "Miranda", text: "Bara miranda." }));
    await setDoc(doc(db, "bibliotek/cps-annans"), anteckning({ skapadAv: skapare(ANNAN), rubrik: "Annans" }));
    await setDoc(doc(db, "bibliotek/cps-bada"), anteckning({ skapadAv: skapare(BADA), rubrik: "Bådas" }));
    await setDoc(doc(db, "bibliotek/cps-avslutad"), anteckning({ skapadAv: skapare(AVSLUTAD), rubrik: "Avslutads" }));
  });
});

after(async () => {
  await miljo?.cleanup();
});

/** @param {string} uid */
const db = (uid) => miljo.authenticatedContext(uid).firestore();
let lopnr = 0;
/** Ett nytt id per försök, så att ett skapande aldrig råkar bli en ändring. */
const nyttId = () => `bibliotek/ny-${++lopnr}`;
const skapa = (uid, rad) => setDoc(doc(db(uid), nyttId()), rad);

describe("bibliotekets regler: läsa", () => {
  it("en medlem läser sin grupp och inte den andra, och inte hela samlingen", async () => {
    await assertSucceeds(getDoc(doc(db(MEDLEM), "bibliotek/cps-protokoll")));
    await assertFails(getDoc(doc(db(MEDLEM), "bibliotek/miranda-hemlig")));
    await assertFails(getDocs(query(collection(db(MEDLEM), "bibliotek"))));
    await assertSucceeds(getDocs(query(collection(db(MEDLEM), "bibliotek"), where("groupId", "==", CPS))));
    await assertFails(getDocs(query(collection(db(MEDLEM), "bibliotek"), where("groupId", "==", MIRANDA))));
  });

  it("ett medlemskap som inte är aktivt läser ingenting", async () => {
    await assertFails(getDoc(doc(db(AVSLUTAD), "bibliotek/cps-protokoll")));
    await assertFails(getDocs(query(collection(db(AVSLUTAD), "bibliotek"), where("groupId", "==", CPS))));
  });
});

describe("bibliotekets regler: skapa", () => {
  it("en medlem skapar en anteckning och en länk som sig själv", async () => {
    await assertSucceeds(skapa(MEDLEM, ny()));
    await assertSucceeds(skapa(MEDLEM, nyLank()));
  });

  it("inte i en annan grupp, och inte i någon annans namn", async () => {
    await assertFails(skapa(MEDLEM, ny({ groupId: MIRANDA })));
    await assertFails(skapa(MEDLEM, ny({ skapadAv: skapare(ANNAN) })));
  });

  it("inte med ett medlemskap som inte är aktivt, och inte som agent", async () => {
    await assertFails(skapa(AVSLUTAD, ny({ skapadAv: skapare(AVSLUTAD) })));
    await assertFails(skapa(AGENT, ny({ skapadAv: skapare(AGENT) })));
    await assertFails(skapa(MEDLEM, ny({ skapadAv: { ...skapare(MEDLEM), typ: "agent" } })));
  });

  it("inte med ett extra fält, på posten eller på skaparen", async () => {
    await assertFails(skapa(MEDLEM, ny({ artist: "Någon" })));
    await assertFails(skapa(MEDLEM, ny({ skapadAv: { ...skapare(MEDLEM), roll: "admin" } })));
  });

  it("fel typ på ett fält är ett nej, också där regeln inte prövar typen för sig", async () => {
    await assertFails(skapa(MEDLEM, ny({ groupId: 42 })));
    await assertFails(skapa(MEDLEM, ny({ rubrik: 42 })));
    await assertFails(skapa(MEDLEM, ny({ text: 42 })));
    await assertFails(skapa(MEDLEM, nyLank({ url: 42 })));
    await assertFails(skapa(MEDLEM, ny({ skapadAv: "Kim" })));
    const { kalla: _k, ...utanKalla } = skapare(MEDLEM);
    await assertFails(skapa(MEDLEM, ny({ skapadAv: utanKalla })));
    await assertFails(skapa(MEDLEM, ny({ skapadAv: { ...skapare(MEDLEM), namn: 42 } })));
    await assertFails(skapa(MEDLEM, ny({ skapadAv: { ...skapare(MEDLEM), kalla: 42 } })));
    const nu = Date.now();
    await assertFails(skapa(MEDLEM, ny({ skapad: nu + 0.5, andrad: nu + 1 })));
  });

  it("klockslagen är serverns, och andrad ligger inte före skapad", async () => {
    await assertFails(skapa(MEDLEM, ny({ skapad: 1700000000000 })));
    await assertFails(skapa(MEDLEM, ny({ andrad: Date.now() + 9e12 })));
    const nu = Date.now();
    await assertFails(skapa(MEDLEM, ny({ skapad: nu, andrad: nu - 1000 })));
  });

  it("rubrik och text: mellanslag är tomt, och taken håller", async () => {
    await assertFails(skapa(MEDLEM, ny({ rubrik: "   " })));
    await assertFails(skapa(MEDLEM, ny({ text: "  \n " })));
    await assertSucceeds(skapa(MEDLEM, ny({ rubrik: "r".repeat(MAX_BIBLIOTEKRUBRIK), text: "t".repeat(MAX_BIBLIOTEKTEXT) })));
    await assertFails(skapa(MEDLEM, ny({ rubrik: "r".repeat(MAX_BIBLIOTEKRUBRIK + 1) })));
    await assertFails(skapa(MEDLEM, ny({ text: "t".repeat(MAX_BIBLIOTEKTEXT + 1) })));
  });

  it("tomhet är Firestores trim: U+00A0, U+3000, U+2028 och U+FEFF är inte tomt, U+001F är det", async () => {
    // Granskningen av #304: regeln släppte in de här och modellen sade "Rubriken saknas.",
    // så raden hamnade i trasiga för alltid. Modellen ska säga samma sak som regeln.
    for (const rubrik of ["\u00A0", "\u3000", "\u2028", "\uFEFF"]) {
      await assertSucceeds(skapa(MEDLEM, ny({ rubrik })));
      assert.equal(inmatningsfel({ typ: "anteckning", rubrik, text: "T" }), null, `rubrik U+${rubrik.codePointAt(0).toString(16)}`);
    }
    for (const text of ["\u00A0", "\u3000"]) {
      await assertSucceeds(skapa(MEDLEM, ny({ text })));
      assert.equal(inmatningsfel({ typ: "anteckning", rubrik: "R", text }), null, `text U+${text.codePointAt(0).toString(16)}`);
    }
    await assertFails(skapa(MEDLEM, ny({ rubrik: "\u001F" })));
    assert.match(String(inmatningsfel({ typ: "anteckning", rubrik: "\u001F", text: "T" })), /Rubriken saknas/);
  });

  it("regeln och modellen räknar tomhet lika, tecken för tecken", async () => {
    // ⛔ Listan är inte en kopia av någon av de två (regel 4). Den är kontrolltecknen och
    // ASCII upp till "@", plus varje tecken som JavaScripts \s känner som blanksteg. Svaret
    // kommer från emulatorn och jämförs med modellens, så ingen sida facit för sig själv.
    const kandidater = [];
    for (let c = 0; c <= 0x40; c++) kandidater.push(c);
    for (let c = 0x41; c <= 0xffff; c++) if (/\s/.test(String.fromCharCode(c))) kandidater.push(c);
    const avvikelser = [];
    const bada = { ja: 0, nej: 0 };
    for (const c of kandidater) {
      const v = String.fromCharCode(c);
      for (const falt of ["rubrik", "text"]) {
        const rad = ny({ [falt]: v });
        let regel = true;
        try {
          await skapa(MEDLEM, rad);
        } catch {
          regel = false;
        }
        const modell = inmatningsfel(rad) === null;
        // Och raden som byggPost skriver ska klara postFel. Annars kan byggPost trimma med en annan
        // regel än postFel och skriva en rad som läsningen sedan lägger i trasiga.
        let byggd = true;
        try {
          byggd = postFel(byggPost(rad)) === null;
        } catch {
          byggd = false;
        }
        const tecken = `${falt} U+${c.toString(16).padStart(4, "0")}`;
        if (regel !== modell) avvikelser.push(`${tecken}: regeln ${regel ? "ja" : "nej"}, modellen ${modell ? "ja" : "nej"}`);
        if (regel !== byggd) avvikelser.push(`${tecken}: regeln ${regel ? "ja" : "nej"}, postFel(byggPost) ${byggd ? "ja" : "nej"}`);
        if (regel === modell && regel === byggd) bada[regel ? "ja" : "nej"] += 1;
      }
    }
    // Golv: listan har minst 80 tecken, och båda svaren förekommer, annars mäter jämförelsen ingenting.
    assert.ok(kandidater.length >= 80, `bara ${kandidater.length} tecken prövades`);
    assert.ok(bada.ja > 0 && bada.nej > 0, `regeln och modellen var eniga bara åt ett håll: ${JSON.stringify(bada)}`);
    assert.deepEqual(avvikelser, []);
  });

  it("adressen: http eller https, inget mellanslag, och taket håller", async () => {
    const bas = "https://e.se/";
    await assertSucceeds(skapa(MEDLEM, nyLank({ url: bas + "a".repeat(MAX_BIBLIOTEKURL - bas.length) })));
    await assertFails(skapa(MEDLEM, nyLank({ url: bas + "a".repeat(MAX_BIBLIOTEKURL - bas.length + 1) })));
    await assertFails(skapa(MEDLEM, nyLank({ url: "javascript:alert(1)" })));
    await assertFails(skapa(MEDLEM, nyLank({ url: "http://exa mple" })));
  });

  it("typen är sluten, och en anteckning och en länk bär inte varandras fält", async () => {
    await assertFails(skapa(MEDLEM, ny({ typ: "song" })));
    await assertFails(skapa(MEDLEM, ny({ url: "https://bolagsverket.se/" })));
    await assertFails(skapa(MEDLEM, nyLank({ text: "Brödtext." })));
    const { text: _t, ...utanText } = ny();
    await assertFails(skapa(MEDLEM, { ...utanText, url: "https://bolagsverket.se/" }));
    const { url: _u, ...utanUrl } = nyLank();
    await assertFails(skapa(MEDLEM, { ...utanUrl, text: "Brödtext." }));
  });
});

describe("bibliotekets regler: ändra och radera", () => {
  it("författaren ändrar sin rad, en annan medlem gör det inte, admin gör det", async () => {
    await assertSucceeds(updateDoc(doc(db(MEDLEM), "bibliotek/cps-protokoll"), { text: "Vi beslutade om bokslutet.", andrad: Date.now() }));
    await assertFails(updateDoc(doc(db(MEDLEM), "bibliotek/cps-annans"), { text: "Överskrivet.", andrad: Date.now() }));
    await assertSucceeds(updateDoc(doc(db(ADMIN), "bibliotek/cps-annans"), { text: "Admin rättade.", andrad: Date.now() }));
  });

  it("admin i en annan grupp ändrar inte, och inte heller en författare som inte längre är aktiv", async () => {
    await assertFails(updateDoc(doc(db(MIRANDA_ADMIN), "bibliotek/cps-annans"), { text: "Fel grupp.", andrad: Date.now() }));
    await assertFails(updateDoc(doc(db(AVSLUTAD), "bibliotek/cps-avslutad"), { text: "Efter utträdet.", andrad: Date.now() }));
  });

  it("gruppen står stilla, också för den som är medlem i båda", async () => {
    await assertFails(updateDoc(doc(db(BADA), "bibliotek/cps-bada"), { groupId: MIRANDA, andrad: Date.now() }));
    await assertFails(updateDoc(doc(db(BADA), "bibliotek/cps-bada"), { groupId: deleteField(), andrad: Date.now() }));
  });

  it("typen står stilla, också när den andra typens fält byts korrekt", async () => {
    await assertFails(updateDoc(doc(db(MEDLEM), "bibliotek/cps-protokoll"), {
      typ: "lank",
      text: deleteField(),
      url: "https://bolagsverket.se/",
      andrad: Date.now(),
    }));
  });

  it("skapad och skapadAv står stilla", async () => {
    await assertFails(updateDoc(doc(db(MEDLEM), "bibliotek/cps-protokoll"), { skapad: T0 - 1000, andrad: Date.now() }));
    await assertFails(updateDoc(doc(db(MEDLEM), "bibliotek/cps-protokoll"), { skapadAv: { ...skapare(MEDLEM), namn: "Någon annan" }, andrad: Date.now() }));
    await assertFails(updateDoc(doc(db(ADMIN), "bibliotek/cps-annans"), { skapadAv: skapare(ADMIN), andrad: Date.now() }));
  });

  it("inget extra fält, ingen tom rubrik, och andrad är serverns klocka och inte före skapad", async () => {
    await assertFails(updateDoc(doc(db(MEDLEM), "bibliotek/cps-protokoll"), { artist: "Någon", andrad: Date.now() }));
    await assertFails(updateDoc(doc(db(MEDLEM), "bibliotek/cps-protokoll"), { rubrik: "  ", andrad: Date.now() }));
    await assertFails(updateDoc(doc(db(MEDLEM), "bibliotek/cps-protokoll"), { text: "Framtid.", andrad: Date.now() + 9e12 }));
    await assertFails(updateDoc(doc(db(MEDLEM), "bibliotek/cps-protokoll"), { text: "Bakåt.", andrad: T0 - 1000 }));
  });

  it("författaren, admin och ägare raderar, och ingen annan", async () => {
    const AGARE = "uid-cps-agare";
    await miljo.withSecurityRulesDisabled(async (ctx) => {
      const adminDb = ctx.firestore();
      await setDoc(doc(adminDb, `memberships/${medlemskapsId(AGARE, CPS)}`), {
        userId: AGARE, groupId: CPS, roll: "agare", typ: "person", status: "aktiv",
      });
      await setDoc(doc(adminDb, "bibliotek/radera-forfattare"), anteckning({ rubrik: "Raderas av författaren" }));
      await setDoc(doc(adminDb, "bibliotek/radera-admin"), anteckning({ skapadAv: skapare(ANNAN), rubrik: "Raderas av admin" }));
      await setDoc(doc(adminDb, "bibliotek/radera-agare"), anteckning({ skapadAv: skapare(ANNAN), rubrik: "Raderas av ägare" }));
      await setDoc(doc(adminDb, "bibliotek/radera-nej"), anteckning({ rubrik: "Står kvar" }));
    });
    await assertSucceeds(deleteDoc(doc(db(MEDLEM), "bibliotek/radera-forfattare")));
    await assertSucceeds(deleteDoc(doc(db(ADMIN), "bibliotek/radera-admin")));
    await assertSucceeds(deleteDoc(doc(db(AGARE), "bibliotek/radera-agare")));
    await assertFails(deleteDoc(doc(db(ANNAN), "bibliotek/radera-nej")));
    await assertFails(deleteDoc(doc(db(MIRANDA_ADMIN), "bibliotek/radera-nej")));
    await assertFails(deleteDoc(doc(db(AVSLUTAD), "bibliotek/cps-avslutad")));
    await assertFails(deleteDoc(doc(db(AGENT), "bibliotek/radera-nej")));
    await assertFails(deleteDoc(doc(miljo.unauthenticatedContext().firestore(), "bibliotek/radera-nej")));
    /** @type {import("firebase/firestore").DocumentSnapshot | undefined} */
    let kvar;
    await miljo.withSecurityRulesDisabled(async (ctx) => {
      kvar = await getDoc(doc(ctx.firestore(), "bibliotek/radera-nej"));
    });
    assert.equal(kvar?.exists(), true);
  });
});
