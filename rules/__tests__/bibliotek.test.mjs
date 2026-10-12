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
 *            en annan grupp, avslutat medlemskap, avslutad admin, agent och
 *            utloggad: nej (#311)
 *
 * Reglerna skrivs av `scripts/skriv-provregler.mjs` ur `bibliotekregelfragment("bibliotek")`.
 */

import { medlemskapsId } from "../../src/lib/grupp.js";
import { MAX_BIBLIOTEKRUBRIK, MAX_BIBLIOTEKTEXT, MAX_BIBLIOTEKURL, MAX_BIBLIOTEKUTSKRIFT, byggPost, inmatningsfel, postFel } from "../../src/lib/bibliotek.js";
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
const AVSLUTAD_ADMIN = "uid-cps-avslutad-admin";
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
/** Ett ljud som lades in för en timme sedan, utan längd och våg. */
const EN_TIMME = 3_600_000;
const gammaltLjud = (uid, postId) => {
  const { text: _text, ...utanText } = anteckning({ skapadAv: skapare(uid), skapad: T0 - EN_TIMME, andrad: T0 - EN_TIMME });
  return {
    ...utanText,
    typ: "fil",
    rubrik: "Idé",
    fil: { sokvag: `grupper/cps-ab/bibliotek/${postId}/ide.webm`, namn: "ide.webm", mime: "audio/webm", byte: 1200 },
  };
};
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
      // En grupp vars id är början på en annans ("cps" mot "cps-ab"): en prefixjämförelse hade blandat ihop dem.
      medlemskap(MEDLEM, "cps", "medlem"),
      medlemskap(ANNAN, CPS, "medlem"),
      medlemskap(ADMIN, CPS, "admin"),
      medlemskap(AVSLUTAD, CPS, "medlem", "person", "avslutad"),
      medlemskap(AVSLUTAD_ADMIN, CPS, "admin", "person", "avslutad"),
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
    await setDoc(doc(db, "bibliotek/cps-fil"), gammaltLjud(MEDLEM, "cps-fil"));
    // Två ljud utan längd och våg, för en timme sedan: klockan är ur fönstret, så ett oförändrat `andrad` går inte som "nu".
    await setDoc(doc(db, "bibliotek/cps-ljud-eget"), gammaltLjud(MEDLEM, "cps-ljud-eget"));
    await setDoc(doc(db, "bibliotek/cps-ljud-annans"), gammaltLjud(ANNAN, "cps-ljud-annans"));
    await setDoc(doc(db, "bibliotek/cps-ljud-nekas"), gammaltLjud(MEDLEM, "cps-ljud-nekas"));
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
/**
 * `{postId}` i en filsökväg byts mot postens eget id: sökvägen bär postens id, och regeln jämför dem (0.93.0).
 * @param {string} uid
 * @param {Record<string, any>} rad
 */
const skapa = (uid, rad) => {
  const vag = nyttId();
  const postId = vag.split("/")[1];
  const medId = rad.fil && typeof rad.fil.sokvag === "string" ? { ...rad, fil: { ...rad.fil, sokvag: rad.fil.sokvag.replaceAll("{postId}", postId) } } : rad;
  return setDoc(doc(db(uid), vag), medId);
};

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

  it("en fil med giltig MIME går in, fel format och för stor fil gör det inte", async () => {
    const { text: _t, ...utanText } = ny();
    const fil = {
      ...utanText,
      typ: "fil",
      rubrik: "Kvitto",
      fil: { sokvag: "grupper/cps-ab/bibliotek/{postId}/kvitto.jpg", namn: "kvitto.jpg", mime: "image/jpeg", byte: 1200 },
    };
    await assertSucceeds(skapa(MEDLEM, fil));
    await assertFails(skapa(MEDLEM, { ...fil, fil: { ...fil.fil, mime: "application/zip" } }));
    await assertFails(skapa(MEDLEM, { ...fil, fil: { ...fil.fil, mime: "audio/webm;codecs=opus" } }));
    await assertFails(skapa(MEDLEM, { ...fil, fil: { ...fil.fil, byte: 25 * 1024 * 1024 + 1 } }));
    await assertFails(skapa(MEDLEM, { ...fil, text: "Inte en fil." }));
    await assertFails(skapa(MEDLEM, { ...ny(), fil: fil.fil }));
  });

  it("en utskrift hör till ett ljud, och en bild eller en för lång text får den inte", async () => {
    const { text: _t, ...utanText } = ny();
    const ljud = {
      ...utanText,
      typ: "fil",
      rubrik: "Idé",
      fil: { sokvag: "grupper/cps-ab/bibliotek/{postId}/ide.webm", namn: "ide.webm", mime: "audio/webm", byte: 1200 },
    };
    const bild = {
      ...ljud,
      fil: { sokvag: "grupper/cps-ab/bibliotek/{postId}/k.jpg", namn: "k.jpg", mime: "image/jpeg", byte: 1200 },
    };
    await assertSucceeds(skapa(MEDLEM, { ...ljud, utskrift: "Hej" }));
    await assertSucceeds(skapa(MEDLEM, { ...ljud, utskrift: "" }));
    await assertFails(skapa(MEDLEM, { ...bild, utskrift: "Hej" }));
    await assertFails(skapa(MEDLEM, { ...ljud, utskrift: "x".repeat(MAX_BIBLIOTEKUTSKRIFT + 1) }));
    await assertFails(skapa(MEDLEM, ny({ utskrift: "Hej" })));
    await assertFails(skapa(MEDLEM, { ...ljud, utskrift: 42 }));
  });

  it("⛔ filens sökväg måste ligga i postens egen grupp (0.93.0), segment för segment", async () => {
    const { text: _t, ...utanText } = ny();
    const fil = (sokvag, extra = {}) => ({
      ...utanText,
      typ: "fil",
      rubrik: "Kvitto",
      fil: { sokvag, namn: "kvitto.jpg", mime: "image/jpeg", byte: 1200 },
      ...extra,
    });
    // Rätt sökväg i egen grupp, och i gruppen "cps" som är början på "cps-ab".
    await assertSucceeds(skapa(MEDLEM, fil("grupper/cps-ab/bibliotek/{postId}/kvitto.jpg")));
    await assertSucceeds(skapa(MEDLEM, fil("grupper/cps/bibliotek/{postId}/kvitto.jpg", { groupId: "cps" })));
    // En annan grupps mapp.
    await assertFails(skapa(MEDLEM, fil("grupper/miranda-ab/bibliotek/{postId}/kvitto.jpg")));
    // Id-prefix åt båda håll: gruppen "cps" pekar på "cps-ab"s fil, och "cps-ab" pekar på "cps"s.
    await assertFails(skapa(MEDLEM, fil("grupper/cps-ab/bibliotek/{postId}/kvitto.jpg", { groupId: "cps" })));
    await assertFails(skapa(MEDLEM, fil("grupper/cps/bibliotek/{postId}/kvitto.jpg")));
    // Fel mapp: en annan rot, en annan undermapp, en profilbild, för kort, och gruppen på fel plats.
    await assertFails(skapa(MEDLEM, fil("profilbilder/uid-cps-medlem/kvitto.jpg")));
    await assertFails(skapa(MEDLEM, fil("grupper/cps-ab/annat/p1/kvitto.jpg")));
    await assertFails(skapa(MEDLEM, fil("andra/cps-ab/bibliotek/{postId}/kvitto.jpg")));
    await assertFails(skapa(MEDLEM, fil("bibliotek/cps-ab/grupper/p1/kvitto.jpg")));
    await assertFails(skapa(MEDLEM, fil("grupper/cps-ab/bibliotek/kvitto.jpg")));
  });

  it("⛔ sökvägen har exakt fem rena segment och postens eget id (0.93.0): radbrytning, tomt segment, ./, extra segment, avslutande / och fel postId", async () => {
    const { text: _t, ...utanText } = ny();
    const fil = (sokvag) => ({
      ...utanText,
      typ: "fil",
      rubrik: "Kvitto",
      fil: { sokvag, namn: "kvitto.jpg", mime: "image/jpeg", byte: 1200 },
    });
    const ok = "grupper/cps-ab/bibliotek/{postId}/kvitto.jpg";
    await assertSucceeds(skapa(MEDLEM, fil(ok)));
    // Granskningens fynd: RE2:s `.` matchar inte radbrytning, så `.*\\.\\..*` släppte igenom en sökväg som lämnar mappen.
    await assertFails(skapa(MEDLEM, fil("grupper/cps-ab/bibliotek/{postId}\n/../../../miranda-ab/bibliotek/q/f")));
    await assertFails(skapa(MEDLEM, fil("grupper/cps-ab/bibliotek/{postId}/kvi\ntto.jpg")));
    await assertFails(skapa(MEDLEM, fil("grupper/cps-ab/bibliotek/{postId}/kvi\ttto.jpg")));
    await assertFails(skapa(MEDLEM, fil("grupper/cps-ab/bibliotek/{postId}/kvi\u0000tto.jpg")));
    // Tomt segment, punkt och dubbelpunkt som segment.
    await assertFails(skapa(MEDLEM, fil("grupper/cps-ab/bibliotek/{postId}/")));
    await assertFails(skapa(MEDLEM, fil("grupper/cps-ab/bibliotek//kvitto.jpg")));
    await assertFails(skapa(MEDLEM, fil("grupper/cps-ab/bibliotek/{postId}/.")));
    await assertFails(skapa(MEDLEM, fil("grupper/cps-ab/bibliotek/{postId}/..")));
    await assertFails(skapa(MEDLEM, fil("./grupper/cps-ab/bibliotek/{postId}/kvitto.jpg")));
    await assertFails(skapa(MEDLEM, fil("grupper/cps-ab/./bibliotek/{postId}/kvitto.jpg")));
    await assertFails(skapa(MEDLEM, fil("grupper/cps-ab/bibliotek/../bibliotek/{postId}/kvitto.jpg")));
    // Extra segment, för få segment och avslutande snedstreck.
    await assertFails(skapa(MEDLEM, fil("grupper/cps-ab/bibliotek/{postId}/under/kvitto.jpg")));
    await assertFails(skapa(MEDLEM, fil("grupper/cps-ab/bibliotek/{postId}")));
    await assertFails(skapa(MEDLEM, fil("grupper/cps-ab/bibliotek/{postId}/kvitto.jpg/")));
    // Fel postId: en annan posts mapp, och en tom.
    await assertFails(skapa(MEDLEM, fil("grupper/cps-ab/bibliotek/en-annan-post/kvitto.jpg")));
    await assertFails(skapa(MEDLEM, fil("grupper/cps-ab/bibliotek/{postId}x/kvitto.jpg")));
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

  it("⛔ en ändring får inte skriva om filens sökväg till en annan grupp (0.93.0)", async () => {
    const nu = () => Date.now();
    const bytFil = (sokvag) => ({ fil: { sokvag, namn: "ide.webm", mime: "audio/webm", byte: 1200 }, andrad: nu() });
    await assertFails(updateDoc(doc(db(MEDLEM), "bibliotek/cps-fil"), bytFil("grupper/miranda-ab/bibliotek/cps-fil/ide.webm")));
    await assertFails(updateDoc(doc(db(MEDLEM), "bibliotek/cps-fil"), bytFil("grupper/cps/bibliotek/cps-fil/ide.webm")));
    await assertFails(updateDoc(doc(db(MEDLEM), "bibliotek/cps-fil"), bytFil("grupper/cps-ab/annat/p1/ide.webm")));
    // Samma grupp, en annan fil, går.
    await assertSucceeds(updateDoc(doc(db(MEDLEM), "bibliotek/cps-fil"), bytFil("grupper/cps-ab/bibliotek/cps-fil/ny.webm")));
  });

  it("⛔ bara längd och våg får lämna andrad som den var (0.93.0), allt annat kräver serverns klocka", async () => {
    const gammal = T0 - EN_TIMME;
    // Författaren fyller i längden utan att röra klockan, och admin gör det på någon annans ljud.
    //
    // ⛔ VÅGEN (`peaks`) PROVAS INTE HÄR, MED FLIT. Mätt 2026-10-12 på main före den här ändringen: en skrivning med 48 toppar,
    // både skapa och ändra, nekas av emulatorn med "maximum of 1000 expressions to evaluate has been reached". Det är
    // en gräns som `opsBibliotekToppar` redan går över, oberoende av klockan, och ett prov som väntar sig ja där vore rött
    // av fel skäl. Se PR-texten. Klockundantaget gäller även `peaks` i texten, men bevisas bara för `durationMs`.
    await assertSucceeds(updateDoc(doc(db(MEDLEM), "bibliotek/cps-ljud-eget"), { durationMs: 4000, andrad: gammal }));
    await assertSucceeds(updateDoc(doc(db(ADMIN), "bibliotek/cps-ljud-annans"), { durationMs: 4100, andrad: gammal }));
    // En annan medlem får inte skriva, med eller utan klockan.
    await assertFails(updateDoc(doc(db(ANNAN), "bibliotek/cps-ljud-nekas"), { durationMs: 4000, andrad: gammal }));
    // Samma gamla klocka med något annat i samma skrivning är ett nej: rubrik, utskrift, och en annan gammal klocka.
    await assertFails(updateDoc(doc(db(MEDLEM), "bibliotek/cps-ljud-nekas"), { durationMs: 4000, rubrik: "Ny rubrik", andrad: gammal }));
    await assertFails(updateDoc(doc(db(MEDLEM), "bibliotek/cps-ljud-nekas"), { utskrift: "Hej", andrad: gammal }));
    await assertFails(updateDoc(doc(db(MEDLEM), "bibliotek/cps-ljud-nekas"), { durationMs: 4000, andrad: gammal + 1 }));
    // Giltigheten gäller som vanligt: en längd som inte är ett heltal, eller noll, avvisas.
    await assertFails(updateDoc(doc(db(MEDLEM), "bibliotek/cps-ljud-nekas"), { durationMs: 0, andrad: gammal }));
    await assertFails(updateDoc(doc(db(MEDLEM), "bibliotek/cps-ljud-nekas"), { durationMs: 4000.5, andrad: gammal }));
    // En anteckning har ingen längd, med vilken klocka som helst.
    await assertFails(updateDoc(doc(db(MEDLEM), "bibliotek/cps-protokoll"), { durationMs: 4000, andrad: T0 }));
    // Med serverns klocka går en längd på ljudet som förut.
    await assertSucceeds(updateDoc(doc(db(MEDLEM), "bibliotek/cps-ljud-nekas"), { durationMs: 4000, andrad: Date.now() }));
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
    await assertFails(deleteDoc(doc(db(AVSLUTAD_ADMIN), "bibliotek/radera-nej")));
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
