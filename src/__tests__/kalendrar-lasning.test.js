import { describe, expect, it } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { createKalenderkalla } from "../data/kalenderkalla.js";
import { KALENDERIKONER, MAX_KALENDERID, MAX_KALENDERIKON, byggKalenderpost, byggMinKalender, lasKalenderpost, lasMinKalender, lasMinaKalendrar, validateMinaKalendrar, kalenderformFel, kalenderformMatning, kalenderformSlutkod } from "../lib/kalendrar.js";
import { kalenderregelfragment } from "../lib/regler.js";

/*
 * Läsvägen läker (0.153.0, cllp/ops-framework#463): reglerna nekar från 0.153.0 en ikon som inte är ett kort namn och fält av fel sort, och ett dokument som redan står i databasen med ett sådant fält hade
 * följt med i varje skrivning och nekats. Emulatorn mäter det mot de riktiga reglerna (`rules/__tests__/kalendertak.test.mjs`); här mäts själva läkningen.
 *
 * ⛔ RÖTT UTAN ÄNDRINGEN: `lasMinKalender`, `lasKalenderpost` och `lasMinaKalendrar` finns inte, och `createKalenderkalla().mina` kastade på en rad med en ikon utanför listan.
 */

const kal = (extra = {}) => ({ id: "privat", namn: "Privat", farg: 2, ikon: "hjarta", ordning: 0, forvald: false, iFlodet: false, arkiverad: false, ...extra });
const post = (extra = {}) => ({ id: "tand", kalenderId: "privat", titel: "Tandläkaren", beskrivning: "", plats: "", start: "2026-10-05T09:00", slut: "2026-10-05T10:00", heldag: false, blockerar: false, ...extra });

describe("lasMinKalender", () => {
  it("⛔ en ikon på 900 kB, en ikon som inte är text och en ikon som saknas blir den första ur listan", () => {
    expect(lasMinKalender(kal({ ikon: "x".repeat(900_000) })).ikon).toBe(KALENDERIKONER[0]);
    expect(lasMinKalender(kal({ ikon: 7 })).ikon).toBe(KALENDERIKONER[0]);
    const { ikon: _i, ...utanIkon } = kal();
    expect(lasMinKalender(utanIkon).ikon).toBe(KALENDERIKONER[0]);
  });
  it("⛔ skrivvägen är strikt mot det reglerna nekar: en ikon över taket kastar i byggMinKalender", () => {
    expect(() => byggMinKalender(kal({ ikon: "x".repeat(900) }))).toThrow(/ikon/);
    expect(() => validateMinaKalendrar([kal({ ikon: "x".repeat(50) })])).toThrow(/ikon/);
  });
  it("⛔ ett fält utanför MINKALENDERFALT släpps, ordning som inte är ett heltal blir 0 och sanningsvärden som inte är det blir false", () => {
    const k = lasMinKalender({ ...kal(), stor: "x".repeat(10), ordning: "fem", forvald: "ja", iFlodet: { a: 1 }, arkiverad: 1 });
    expect(k).toEqual({ id: "privat", namn: "Privat", farg: 2, ikon: "hjarta", ordning: 0, forvald: false, iFlodet: false, arkiverad: false });
    expect(Object.keys(k)).not.toContain("stor");
  });
  it("det som inte läker kastar som förut, med skälet: id utanför formen, tomt namn, ogiltig färg", () => {
    expect(() => lasMinKalender(kal({ id: "Min Kalender" }))).toThrow(/id "Min Kalender"/);
    expect(() => lasMinKalender(kal({ namn: "" }))).toThrow(/namn/);
    expect(() => lasMinKalender(kal({ farg: 9 }))).toThrow(/farg/);
  });
  it("en vanlig rad är oförändrad, och en läkt rad klarar skrivvägen", () => {
    expect(lasMinKalender(kal())).toEqual(byggMinKalender(kal()));
    expect(() => byggMinKalender(lasMinKalender(kal({ ikon: "x".repeat(900) })))).not.toThrow();
  });
});

describe("lasMinKalender förstör inte giltig data (granskningen av PR 464)", () => {
  /*
   * ⛔ LÄKNINGEN FÅR BARA SLÄPPA DET REGLERNA NEKAR. Före rättelsen blev `ordning: "3"` 0 (byggaren läser den som 3, och 3 klarar reglerna), och en ikon som klarar reglerna men som den här
   * versionen av ramverket inte känner (en nyare klient har lagt till den) skrevs om till `kalender`: en äldre klient hade då skrivit över den nyare klientens ikon vid nästa sparning.
   */
  it("⛔ ordning som numerisk text läses som talet", () => {
    expect(lasMinKalender(kal({ ordning: "3" })).ordning).toBe(3);
    expect(lasMinKalender(kal({ ordning: " 40 " })).ordning).toBe(40);
    expect(lasMinKalender(kal({ ordning: "-10" })).ordning).toBe(-10);
  });
  it("ordning som inte är ett heltal, som tal eller som text, blir 0", () => {
    for (const ordning of ["3.5", "tre", "", true, null, 2.5, {}]) expect(lasMinKalender(kal({ ordning })).ordning).toBe(0);
  });
  it("⛔ en ikon som klarar reglerna men saknas i KALENDERIKONER behålls i datan, och skrivvägen tar emot den", () => {
    const k = lasMinKalender(kal({ ikon: "stjarna-med-sju-armar" }));
    expect(k.ikon).toBe("stjarna-med-sju-armar");
    expect(byggMinKalender(k).ikon).toBe("stjarna-med-sju-armar");
    expect(kalenderformFel("kalender", "privat", { ...k, id: undefined })).not.toContain("ikon");
  });
  it("en ikon som reglerna nekar blir den första ur listan, och skrivvägen kastar på den", () => {
    for (const ikon of ["x".repeat(MAX_KALENDERIKON + 1), "x".repeat(900_000), "Stor Ikon", "data:image/png;base64,AA", 7]) {
      expect(lasMinKalender(kal({ ikon })).ikon).toBe(KALENDERIKONER[0]);
      expect(() => byggMinKalender(kal({ ikon }))).toThrow(/ikon/);
    }
    expect(lasMinKalender(kal({ ikon: "x".repeat(MAX_KALENDERIKON) })).ikon).toBe("x".repeat(MAX_KALENDERIKON));
  });
});

describe("lasMinaKalendrar", () => {
  it("läker varje rad och behåller kontrollerna: unika id och högst en förvald", () => {
    expect(lasMinaKalendrar([kal(), kal({ id: "resor", ikon: "Okänd Ikon" }), kal({ id: "ny", ikon: "okand" })]).map((k) => k.ikon)).toEqual(["hjarta", KALENDERIKONER[0], "okand"]);
    expect(() => lasMinaKalendrar([kal(), kal()])).toThrow(/finns två gånger/);
    expect(() => lasMinaKalendrar([kal({ forvald: true }), kal({ id: "resor", forvald: true })])).toThrow(/förvald/i);
    expect(() => lasMinaKalendrar("inte en lista")).toThrow(/lista/);
  });
});

describe("lasKalenderpost", () => {
  it("⛔ beskrivning och plats som inte är text blir tomma, blockerar som inte är ett sanningsvärde blir false, okända fält släpps", () => {
    const p = lasKalenderpost({ ...post(), beskrivning: ["a", "b"], plats: { a: 1 }, blockerar: "ja", stor: "x" });
    expect(p).toEqual(byggKalenderpost(post()));
  });
  it("tider, titel och kalender kastar som förut", () => {
    expect(() => lasKalenderpost(post({ titel: "" }))).toThrow(/titel/);
    expect(() => lasKalenderpost(post({ start: "igår" }))).toThrow(/start/);
    expect(() => lasKalenderpost(post({ kalenderId: "Stora Bokstäver" }))).toThrow(/kalenderId/);
  });
});

describe("createKalenderkalla läser med läkning", () => {
  it("⛔ mina() och poster() ger läkta rader i stället för att kasta, medan sparaMina är strikt", async () => {
    const kalla = createKalenderkalla({
      kalla: createMemorySource({
        "users/u1/minaKalendrar": [kal({ ikon: "x".repeat(900_000) }), kal({ id: "resor", namn: "Resor", ordning: 10, ikon: "Okänd Ikon" })],
        "users/u1/kalenderposter": [post({ beskrivning: ["a"], blockerar: "ja" })],
      }),
    });
    const mina = await kalla.mina("u1");
    expect(mina.map((k) => [k.id, k.ikon])).toEqual([["privat", KALENDERIKONER[0]], ["resor", KALENDERIKONER[0]]]);
    expect((await kalla.poster("u1"))[0]).toMatchObject({ beskrivning: "", blockerar: false });
    await expect(kalla.sparaMina("u1", [{ ...kal(), ikon: "x".repeat(900) }])).rejects.toThrow(/ikon/);
    await expect(kalla.sparaMina("u1", mina)).resolves.toMatchObject({ skrivna: 2 });
  });
});

describe("taken i reglerna är härledda ur konstanterna", () => {
  it("kalenderregelfragment bär MAX_KALENDERID, MAX_KALENDERIKON och id-formen, och prövar id bara vid create", () => {
    const regler = kalenderregelfragment();
    expect(regler).toContain(`kid.size() <= ${MAX_KALENDERID}`);
    expect(regler).toContain(`pid.size() <= ${MAX_KALENDERID}`);
    expect(regler).toContain(`d.ikon.size() <= ${MAX_KALENDERIKON}`);
    expect(regler).toContain("kid.matches('[a-z0-9][a-z0-9_-]*')");
    const blocket = regler.slice(regler.indexOf("match /users/{uid}/minaKalendrar/{kid}"));
    const update = blocket.slice(blocket.indexOf("allow update:"), blocket.indexOf("allow delete"));
    expect(update).not.toContain("kid.matches");
  });
});

describe("kalenderformFel och mätningen i produktion", () => {
  const { id: _k, ...kalData } = kal();
  const { id: _p, ...postData } = post();
  it("⛔ en vanlig rad ger inga avvikelser, och varje avvikelse får sin egen kod", () => {
    expect(kalenderformFel("kalender", "privat", kalData)).toEqual([]);
    expect(kalenderformFel("post", "tand", postData)).toEqual([]);
    expect(kalenderformFel("kalender", "Min Kalender", kalData)).toEqual(["id"]);
    expect(kalenderformFel("kalender", "a".repeat(81), kalData)).toEqual(["id"]);
    expect(kalenderformFel("kalender", "a".repeat(80), kalData)).toEqual([]);
    expect(kalenderformFel("kalender", "privat", { ...kalData, ikon: "x".repeat(900_000) })).toEqual(["ikon"]);
    expect(kalenderformFel("kalender", "privat", { ...kalData, ikon: "data:image/png;base64,AA" })).toEqual(["ikon"]);
    expect(kalenderformFel("kalender", "privat", { ...kalData, ordning: "5", forvald: "ja", iFlodet: {}, arkiverad: 1 })).toEqual(["ordning", "forvald", "iFlodet", "arkiverad"]);
    expect(kalenderformFel("kalender", "privat", { ...kalData, stor: 1 })).toEqual(["okant-falt"]);
    expect(kalenderformFel("post", "tand", { ...postData, beskrivning: ["a"], plats: {}, blockerar: "ja" })).toEqual(["beskrivning", "plats", "blockerar"]);
    expect(kalenderformFel("post", "tand", { ...postData, slut: "2026-10-05T08:00" })).toEqual(["tidsordning"]);
    expect(kalenderformFel("post", "tand", { ...postData, heldag: true })).toEqual(["start", "slut"]);
  });
  it("fält som saknas är inte avvikelser: byggaren fyller i dem, och reglerna prövar dem bara när de finns", () => {
    expect(kalenderformFel("kalender", "privat", { namn: "Minimal", farg: 1 })).toEqual([]);
    const { beskrivning: _b, plats: _pl, blockerar: _bl, ...minimal } = postData;
    expect(kalenderformFel("post", "tand", minimal)).toEqual([]);
  });
  /*
   * ⛔ SLUTKODEN (granskningen av PR 464). Förut räknade skriptet inte `id`, fast CHANGELOG säger "Noll avvikelser (också id)" innan reglerna deployas: ett körskript som sade 0
   * med dokument som ramverket inte kan läsa hade sett ut som ett klartecken. Allt som reglerna nekar är kod 1; `stor` låser inte ute någon och står bara i utskriften.
   */
  describe("kalenderformSlutkod", () => {
    const svar = (/** @type {Record<string, number>} */ perKod, lasta = 3) => ({ lasta, perKod });
    it("⛔ id ger kod 1", () => {
      expect(kalenderformSlutkod([svar({ id: 1 }), svar({})])).toBe(1);
    });
    it("⛔ varje annan kod som reglerna nekar ger kod 1", () => {
      for (const k of ["ikon", "ordning", "okant-falt", "beskrivning", "tidsordning", "namn"]) expect(kalenderformSlutkod([svar({}), svar({ [k]: 2 })])).toBe(1);
    });
    it("⛔ stor ensam ger kod 0: den låser inte ute någon", () => {
      expect(kalenderformSlutkod([svar({ stor: 4 }), svar({})])).toBe(0);
      expect(kalenderformSlutkod([svar({ stor: 4, id: 1 }), svar({})])).toBe(1);
    });
    it("⛔ noll lästa dokument i en samling ger kod 1: noll är inte ett svar", () => {
      expect(kalenderformSlutkod([svar({}, 0), svar({})])).toBe(1);
      expect(kalenderformSlutkod([svar({}), svar({})])).toBe(0);
    });
  });

  it("⛔ mätningen räknar per kod, kortar inte bort noll och flaggar stora dokument", () => {
    const dok = [
      { sokvag: "users/abcdefghij/minaKalendrar/privat", id: "privat", data: kalData, byte: 100 },
      { sokvag: "users/klmnopqrst/minaKalendrar/stor", id: "stor", data: { ...kalData, ikon: "x".repeat(900_000) }, byte: 900_100 },
      { sokvag: "users/uvwxyz0123/minaKalendrar/Dålig Id", id: "Dålig Id", data: kalData, byte: 100 },
    ];
    const svar = kalenderformMatning(dok, { slag: "kalender" });
    expect(svar).toMatchObject({ lasta: 3, medAvvikelse: 2, stora: 1, perKod: { ikon: 1, stor: 1, id: 1 }, personer: 3, flestHosEnPerson: 1 });
    const tva = kalenderformMatning([...dok, { sokvag: "users/abcdefghij/minaKalendrar/resor", id: "resor", data: kalData, byte: 100 }], { slag: "kalender" });
    expect(tva).toMatchObject({ personer: 3, flestHosEnPerson: 2 });
    expect(kalenderformMatning([], { slag: "post" })).toMatchObject({ lasta: 0, medAvvikelse: 0, perKod: {}, personer: 0, flestHosEnPerson: 0 });
  });
});
