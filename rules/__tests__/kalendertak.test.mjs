/**
 * Regelprov för taken i mina kalendrar och deras poster (0.153.0, cllp/ops-framework#463), mot Firestore-emulatorn.
 *
 * ══ ⛔ VAD SOM MÄTS ═══════════════════════════════════════════════════════════
 *
 * Före 0.153.0 mättes i emulatorn att `users/{uid}/minaKalendrar` släppte in ett id på 1 400 tecken, ett id med versaler och blanksteg och en `ikon` på 900 kB,
 * och att `users/{uid}/kalenderposter` släppte in ett id på 1 400 tecken. Ingenting läcker (bara personen själv skriver), men en person kunde fylla sina egna dokument utan gräns.
 *
 *   MINA KALENDRAR
 *     id på 1 400 tecken, id med versaler och blanksteg, id på 81 tecken, ett id på exakt 80        nej, nej, nej, ja     <- röda mot 0.152.0 (de tre första)
 *     ikon på 900 kB, ikon på 41 tecken, ikon på exakt 40, ikon som en data-URL, ikon som inte är text  nej, nej, ja, nej, nej  <- röda mot 0.152.0 (alla utom 40)
 *     ordning som text, forvald som text, iFlodet som karta, arkiverad som tal                      nej  <- röda mot 0.152.0
 *     en vanlig kalender med varje namn ur KALENDERIKONER                                           ja   <- inget som ramverket själv skriver nekas
 *
 *   POSTER
 *     id på 1 400 tecken, id med versaler, id på 81 tecken, ett id på exakt 80                      nej, nej, nej, ja     <- röda mot 0.152.0 (de tre första)
 *     beskrivning eller plats som en lista (size() är antalet element), blockerar som text          nej  <- röda mot 0.152.0
 *
 *   ⛔ INGEN LÅSS UTE (det mätningen i produktion ska bekräfta att den inte behövs för, se CHANGELOG 0.153.0)
 *     en redan befintlig kalender med ett id utanför formen (skriven med reglerna av) kan ändras och arkiveras    ja
 *     en redan befintlig post med ett id utanför formen kan ändras och raderas                                     ja
 *     en befintlig kalender med en jättelik ikon kan INTE skrivas om med ikonen kvar                                nej
 *     ... men LÄSNINGEN (`createKalenderkalla().mina`) läker raden, och den läkta raden skrivs                      ja   <- hela poängen med läkningen
 *     samma för en post med en lista i `beskrivning`                                                                ja
 *
 * Kör: npm run test:rules
 */

import { KALENDERIKONER, byggKalenderpost, byggMinKalender, kalenderformFel } from "../../src/lib/kalendrar.js";
import { createFirestoreSource } from "../../src/data/firestore.js";
import { createKalenderkalla } from "../../src/data/kalenderkalla.js";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import * as sdk from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { deleteDoc, doc, setDoc, updateDoc } = sdk;
const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const AGARE = "uid-tak-agare";
const ANNAN = "uid-tak-annan";
/** Äger de dokument vars id ligger utanför formen. De får en egen ägare: ett id utanför `ID_FORM` kastar vid läsning (`byggMinKalender`) och hade fällt AGARES lista. */
const GAMMAL = "uid-tak-gammal";

const utanId = (/** @type {Record<string, any>} */ { id: _id, ...r }) => r;
/** Raden som adaptern skriver: byggd av ramverkets egen byggare, utan `id` (nyckeln står i sökvägen). */
const kal = (extra = {}) => utanId(byggMinKalender({ id: "privat", namn: "Privat", farg: 2, ikon: "hjarta", ...extra }));
const post = (extra = {}) => utanId(byggKalenderpost({ id: "tand", kalenderId: "privat", titel: "Tandläkaren", start: "2026-10-05T09:00", slut: "2026-10-05T10:00", ...extra }));
const lang = (/** @type {number} */ n, tecken = "a") => tecken.repeat(n);

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;

/** Dokument som skrevs med reglerna av, före 0.153.0: kalendrar och poster som inte följer den nya formen. */
const GAMLA_KALENDRAR = {
  "jattelik-ikon": { ...kal({ namn: "Jättelik ikon" }), ikon: lang(900_000, "x") },
  "okand-ikon": { ...kal({ namn: "Okänd ikon" }), ikon: "stjarna-med-sju-armar" },
  "fel-sort": { ...kal({ namn: "Fel sort" }), ordning: "5", forvald: "ja" },
};

before(async () => {
  const regler = path.join(rot, "rules", "provregler.rules");
  if (!fs.existsSync(regler)) throw new Error("rules/provregler.rules saknas. Kör npm run regler:skriv först.");
  miljo = await initializeTestEnvironment({
    projectId: "regelprov",
    firestore: { rules: fs.readFileSync(regler, "utf8"), host: "127.0.0.1", port: 8080 },
  });
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `users/${AGARE}/minaKalendrar/privat`), kal());
    for (const [id, rad] of Object.entries(GAMLA_KALENDRAR)) await setDoc(doc(db, `users/${AGARE}/minaKalendrar/${id}`), rad);
    await setDoc(doc(db, `users/${GAMMAL}/minaKalendrar/Gammal Kalender`), kal({ namn: "Versaler och blanksteg i id:t" }));
    await setDoc(doc(db, `users/${GAMMAL}/minaKalendrar/privat`), kal());
    await setDoc(doc(db, `users/${GAMMAL}/kalenderposter/Gammal Post`), post());
    await setDoc(doc(db, `users/${AGARE}/kalenderposter/lista-i-text`), { ...post(), beskrivning: ["a", "b", "c"], blockerar: "ja" });
    await setDoc(doc(db, `users/${ANNAN}/minaKalendrar/privat`), kal());
  });
});

after(async () => {
  if (miljo) await miljo.cleanup();
});

/** @param {string} uid */
const som = (uid) => miljo.authenticatedContext(uid).firestore();
const minVag = (/** @type {string} */ id) => `users/${AGARE}/minaKalendrar/${id}`;
const postVag = (/** @type {string} */ id) => `users/${AGARE}/kalenderposter/${id}`;
/** @param {string} uid */
const kalla = (uid) => createKalenderkalla({ kalla: createFirestoreSource({ db: som(uid), sdk }) });

describe("⛔ mina kalendrar: id", () => {
  it("ett vanligt id skapas", async () => {
    await assertSucceeds(setDoc(doc(som(AGARE), minVag("resor")), kal({ id: "resor", namn: "Resor" })));
  });
  it("⛔ ett id på 1 400 tecken nekas", async () => {
    await assertFails(setDoc(doc(som(AGARE), minVag(lang(1400))), kal()));
  });
  it("⛔ ett id med versaler och blanksteg nekas", async () => {
    await assertFails(setDoc(doc(som(AGARE), minVag("Min Kalender")), kal()));
  });
  it("⛔ ett id på 81 tecken nekas, ett på exakt 80 släpps in", async () => {
    await assertFails(setDoc(doc(som(AGARE), minVag(lang(81))), kal()));
    await assertSucceeds(setDoc(doc(som(AGARE), minVag(lang(80))), kal()));
  });
});

describe("⛔ mina kalendrar: ikon är ett namn och aldrig en bild", () => {
  it("⛔ en ikon på 900 kB nekas", async () => {
    await assertFails(setDoc(doc(som(AGARE), minVag("stor-ikon")), { ...kal(), ikon: lang(900_000, "x") }));
  });
  it("⛔ en ikon på 41 tecken nekas, en på exakt 40 släpps in", async () => {
    await assertFails(setDoc(doc(som(AGARE), minVag("ikon-41")), { ...kal(), ikon: lang(41) }));
    await assertSucceeds(setDoc(doc(som(AGARE), minVag("ikon-40")), { ...kal(), ikon: lang(40) }));
  });
  it("⛔ en data-URL, en länk och en ikon med blanksteg nekas (de är inte ett namn)", async () => {
    for (const ikon of ["data:image/png;base64,AAAA", "https://x.se/a.png", "en ikon"]) {
      await assertFails(setDoc(doc(som(AGARE), minVag("url-ikon")), { ...kal(), ikon }), `ikonen ${ikon} borde nekas`);
    }
  });
  it("⛔ en ikon som inte är text nekas", async () => {
    for (const ikon of [7, true, { a: 1 }, ["kalender"]]) {
      await assertFails(setDoc(doc(som(AGARE), minVag("typ-ikon")), { ...kal(), ikon }), `ikonen ${JSON.stringify(ikon)} borde nekas`);
    }
  });
  it("varje ikon ur KALENDERIKONER släpps in: inget ramverket själv skriver nekas", async () => {
    for (const ikon of KALENDERIKONER) await assertSucceeds(setDoc(doc(som(AGARE), minVag(`ikon-${ikon}`)), kal({ ikon })));
  });
});

describe("⛔ mina kalendrar: fälten har rätt sort", () => {
  it("⛔ ordning som text, forvald som text, iFlodet som karta och arkiverad som tal nekas var för sig", async () => {
    for (const falt of [{ ordning: "5" }, { forvald: "ja" }, { iFlodet: { a: 1 } }, { arkiverad: 1 }]) {
      await assertFails(setDoc(doc(som(AGARE), minVag("fel-sort-ny")), { ...kal(), ...falt }), `${JSON.stringify(falt)} borde nekas`);
    }
  });
  it("en kalender som utelämnar de valfria fälten släpps in (byggaren fyller i, men en annan skrivare behöver inte)", async () => {
    await assertSucceeds(setDoc(doc(som(AGARE), minVag("minimal")), { namn: "Minimal", farg: 1 }));
  });
  it("⛔ det som redan nekades nekas fortfarande: tomt namn, färg utanför de sex, okänt fält", async () => {
    await assertFails(setDoc(doc(som(AGARE), minVag("tomt")), { ...kal(), namn: "" }));
    await assertFails(setDoc(doc(som(AGARE), minVag("farg")), { ...kal(), farg: 7 }));
    await assertFails(setDoc(doc(som(AGARE), minVag("okant")), { ...kal(), stor: "x" }));
  });
});

describe("⛔ posterna: id och fältens sort", () => {
  it("ett vanligt id skapas", async () => {
    await assertSucceeds(setDoc(doc(som(AGARE), postVag("p-abc123")), post({ id: "p-abc123" })));
  });
  it("⛔ ett id på 1 400 tecken nekas", async () => {
    await assertFails(setDoc(doc(som(AGARE), postVag(lang(1400))), post()));
  });
  it("⛔ ett id med versaler och blanksteg nekas", async () => {
    await assertFails(setDoc(doc(som(AGARE), postVag("Min Post")), post()));
  });
  it("⛔ ett id på 81 tecken nekas, ett på exakt 80 släpps in", async () => {
    await assertFails(setDoc(doc(som(AGARE), postVag(lang(81))), post()));
    await assertSucceeds(setDoc(doc(som(AGARE), postVag(lang(80))), post()));
  });
  it("⛔ beskrivning eller plats som en lista nekas: size() på en lista är antalet element och gick förbi längdprövningen", async () => {
    await assertFails(setDoc(doc(som(AGARE), postVag("lista-b")), { ...post(), beskrivning: ["a", "b"] }));
    await assertFails(setDoc(doc(som(AGARE), postVag("lista-p")), { ...post(), plats: ["a"] }));
    await assertFails(setDoc(doc(som(AGARE), postVag("karta-b")), { ...post(), beskrivning: { a: 1 } }));
  });
  it("⛔ blockerar som text nekas", async () => {
    await assertFails(setDoc(doc(som(AGARE), postVag("blockerar-text")), { ...post(), blockerar: "ja" }));
  });
  it("en post utan beskrivning, plats och blockerar släpps in", async () => {
    const { beskrivning: _b, plats: _p, blockerar: _k, ...minimal } = post();
    await assertSucceeds(setDoc(doc(som(AGARE), postVag("minimal-post")), minimal));
  });
  it("⛔ det som redan nekades nekas fortfarande: en annans samling, slut före start, okänt fält", async () => {
    await assertFails(setDoc(doc(som(ANNAN), postVag("annans-skrivning")), post()));
    await assertFails(setDoc(doc(som(AGARE), postVag("slut-fore")), { ...post(), slut: "2026-10-05T08:00" }));
    await assertFails(setDoc(doc(som(AGARE), postVag("okant")), { ...post(), stor: "x" }));
  });
});

describe("⛔ ingen låses ute: det som redan står i databasen går att ändra", () => {
  it("en kalender med ett id utanför formen kan ändras och arkiveras (id:t prövas bara vid create)", async () => {
    await assertSucceeds(updateDoc(doc(som(GAMMAL), `users/${GAMMAL}/minaKalendrar/Gammal Kalender`), { namn: "Nytt namn" }));
    await assertSucceeds(setDoc(doc(som(GAMMAL), `users/${GAMMAL}/minaKalendrar/Gammal Kalender`), { ...kal(), arkiverad: true }));
  });
  it("en post med ett id utanför formen kan ändras och raderas", async () => {
    await assertSucceeds(updateDoc(doc(som(GAMMAL), `users/${GAMMAL}/kalenderposter/Gammal Post`), { titel: "Ny titel" }));
    await assertSucceeds(deleteDoc(doc(som(GAMMAL), `users/${GAMMAL}/kalenderposter/Gammal Post`)));
  });
  it("⛔ en kalender med en jättelik ikon kan inte skrivas om med ikonen kvar", async () => {
    await assertFails(setDoc(doc(som(AGARE), minVag("jattelik-ikon")), GAMLA_KALENDRAR["jattelik-ikon"]));
    await assertFails(updateDoc(doc(som(AGARE), minVag("jattelik-ikon")), { namn: "Annat namn" }));
  });
  it("... men läsningen läker raden, och den läkta raden går att skriva (kalenderkalla().mina, sedan sparaMina)", async () => {
    const k = kalla(AGARE);
    const mina = await k.mina(AGARE);
    const jattelik = mina.find((x) => x.id === "jattelik-ikon");
    assert.equal(jattelik?.ikon, KALENDERIKONER[0], "ikonen utanför listan ersätts vid läsning");
    assert.equal(mina.find((x) => x.id === "okand-ikon")?.ikon, KALENDERIKONER[0]);
    assert.equal(mina.find((x) => x.id === "minimal")?.ikon, KALENDERIKONER[0], "en rad utan ikon (reglerna kräver inte fältet) går att läsa");
    const fel = mina.find((x) => x.id === "fel-sort");
    assert.equal(fel?.ordning, 0);
    assert.equal(fel?.forvald, false);
    assert.ok(jattelik);
    await assertSucceeds(k.sparaMina(AGARE, [{ ...jattelik, namn: "Läkt" }]));
    await assertSucceeds(k.sparaMina(AGARE, [/** @type {any} */ (fel)]));
    const efter = (await k.mina(AGARE)).find((x) => x.id === "jattelik-ikon");
    assert.equal(efter?.namn, "Läkt");
    assert.equal(efter?.ikon, KALENDERIKONER[0]);
  });
  it("⛔ en post med en lista i beskrivning kan inte skrivas om som den är, men läsningen läker den och den läkta raden skrivs", async () => {
    await assertFails(updateDoc(doc(som(AGARE), postVag("lista-i-text")), { titel: "Ny" }));
    const k = kalla(AGARE);
    const poster = await k.poster(AGARE);
    const rad = poster.find((p) => p.id === "lista-i-text");
    assert.equal(rad?.beskrivning, "");
    assert.equal(rad?.blockerar, false);
    const mina = await k.mina(AGARE);
    await assertSucceeds(k.sparaPost(AGARE, { .../** @type {any} */ (rad), titel: "Läkt post" }, mina));
  });
});

describe("⛔ mätningen i produktion och reglerna säger samma sak (kalenderformFel)", () => {
  // En mätning som kan gå isär från regeln mäter inte regeln. Varje dokument här skrivs till emulatorn, och `kalenderformFel` (utan `id`, som bara prövas vid create) ska säga "inga avvikelser" om och bara om regeln släpper in det.
  const { id: _k, ...kalData } = kal();
  const { id: _p, ...postData } = post();
  /** @type {Array<[string, Record<string, any>]>} */
  const kalendrar = [
    ["vanlig", kalData],
    ["minimal", { namn: "Minimal", farg: 1 }],
    ["ikon på 900 kB", { ...kalData, ikon: lang(900_000, "x") }],
    ["ikon 40 tecken", { ...kalData, ikon: lang(40) }],
    ["ikon 41 tecken", { ...kalData, ikon: lang(41) }],
    ["ikon som länk", { ...kalData, ikon: "https://x.se/a.png" }],
    ["ikon som tal", { ...kalData, ikon: 7 }],
    ["ordning som text", { ...kalData, ordning: "5" }],
    ["ordning som decimaltal", { ...kalData, ordning: 2.5 }],
    ["forvald som text", { ...kalData, forvald: "ja" }],
    ["iFlodet som karta", { ...kalData, iFlodet: { a: 1 } }],
    ["arkiverad som tal", { ...kalData, arkiverad: 1 }],
    ["okänt fält", { ...kalData, stor: "x" }],
    ["tomt namn", { ...kalData, namn: "" }],
    ["namn på 81 tecken", { ...kalData, namn: lang(81) }],
    ["färg 7", { ...kalData, farg: 7 }],
  ];
  /** @type {Array<[string, Record<string, any>]>} */
  const poster = [
    ["vanlig", postData],
    ["minimal", { kalenderId: "privat", titel: "T", heldag: true, start: "2026-10-05", slut: "2026-10-05" }],
    ["beskrivning som lista", { ...postData, beskrivning: ["a"] }],
    ["beskrivning på 2001 tecken", { ...postData, beskrivning: lang(2001) }],
    ["plats som karta", { ...postData, plats: { a: 1 } }],
    ["blockerar som text", { ...postData, blockerar: "ja" }],
    ["heldag som text", { ...postData, heldag: "ja" }],
    ["heldag med klockslag", { ...postData, heldag: true }],
    ["slut före start", { ...postData, slut: "2026-10-05T08:00" }],
    ["tom titel", { ...postData, titel: "" }],
    ["okänt fält", { ...postData, stor: "x" }],
  ];
  let n = 0;
  for (const [namn, data] of kalendrar) {
    it(`kalender: ${namn}`, async () => {
      n += 1;
      const gav = kalenderformFel("kalender", "par", data).length === 0;
      await (gav ? assertSucceeds : assertFails)(setDoc(doc(som(AGARE), minVag(`par-${n}`)), data));
    });
  }
  for (const [namn, data] of poster) {
    it(`post: ${namn}`, async () => {
      n += 1;
      const gav = kalenderformFel("post", "par", data).length === 0;
      await (gav ? assertSucceeds : assertFails)(setDoc(doc(som(AGARE), postVag(`par-${n}`)), data));
    });
  }
  it("golv: båda listorna är inte tomma, och både godkända och nekade fall finns (annars mäter provet ingenting)", () => {
    const utfall = [...kalendrar.map(([, d]) => kalenderformFel("kalender", "par", d)), ...poster.map(([, d]) => kalenderformFel("post", "par", d))].map((f) => f.length === 0);
    assert.ok(kalendrar.length >= 10 && poster.length >= 8);
    assert.ok(utfall.filter(Boolean).length >= 5 && utfall.filter((x) => !x).length >= 10);
  });
});
