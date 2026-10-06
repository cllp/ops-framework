import { describe, expect, it } from "vitest";
import { bortaAntal, tillganglighetForDag } from "../lib/tillganglighet.js";

/**
 * Tillgängligheten (0.61.0, #259 skiva 1). Varje skydd här är sett rött: se rapporten i CHANGELOG 0.61.0.
 */

const MEDLEMMAR = [
  { uid: "o", namn: "Örjan" },
  { uid: "a", namn: "Anna" },
  { uid: "b", namn: "Bo" },
];

/** @param {any[]} poster @param {string} [dag] @param {string} [tidszon] */
const dag = (poster, d = "2026-10-06", tidszon) => tillganglighetForDag({ medlemmar: MEDLEMMAR, poster, dag: d, ...(tidszon ? { tidszon } : {}) });

describe("tillganglighetForDag", () => {
  it("heldag med exklusivt slut, som ICS: täcker dagarna före slutet och inte slutdagen", () => {
    const p = [{ uid: "a", heldag: true, start: "2026-10-05", slut: "2026-10-07", lage: "upptagen" }];
    expect(dag(p, "2026-10-05").map((x) => x.lage)).toEqual(["borta"]);
    expect(dag(p, "2026-10-06").map((x) => x.lage)).toEqual(["borta"]);
    expect(dag(p, "2026-10-07")).toEqual([]);
    expect(dag(p, "2026-10-04")).toEqual([]);
  });

  it("heldag utan slut är en dag", () => {
    const p = [{ uid: "a", heldag: true, start: "2026-10-06", lage: "upptagen" }];
    expect(dag(p).map((x) => x.lage)).toEqual(["borta"]);
    expect(dag(p, "2026-10-07")).toEqual([]);
  });

  it("tidsatt: skär dagen ger upptagen, täcker 00:00 till 24:00 ger borta", () => {
    expect(dag([{ uid: "a", start: "2026-10-06T09:00", slut: "2026-10-06T10:00", lage: "upptagen" }])).toEqual([{ uid: "a", namn: "Anna", lage: "upptagen", orsak: null }]);
    expect(dag([{ uid: "a", start: "2026-10-06T00:00", slut: "2026-10-07T00:00", lage: "upptagen" }]).map((x) => x.lage)).toEqual(["borta"]);
    expect(dag([{ uid: "a", start: "2026-10-05T18:00", slut: "2026-10-08T08:00", lage: "upptagen" }]).map((x) => x.lage)).toEqual(["borta"]);
    // En minut kort av midnatt täcker inte dagen.
    expect(dag([{ uid: "a", start: "2026-10-06T00:00", slut: "2026-10-06T23:59", lage: "upptagen" }]).map((x) => x.lage)).toEqual(["upptagen"]);
    // Slutar exakt vid dagens början: rör inte dagen.
    expect(dag([{ uid: "a", start: "2026-10-05T20:00", slut: "2026-10-06T00:00", lage: "upptagen" }])).toEqual([]);
  });

  it("dagen räknas i tidszonen, också nära midnatt och i en annan zon", () => {
    // 22:30 UTC den 5 oktober är 00:30 den 6 i Stockholm (sommartid, +02) och 18:30 den 5 i New York.
    const p = [{ uid: "a", start: "2026-10-05T22:30:00Z", slut: "2026-10-05T23:30:00Z", lage: "upptagen" }];
    expect(dag(p, "2026-10-06").map((x) => x.lage)).toEqual(["upptagen"]);
    expect(dag(p, "2026-10-05")).toEqual([]);
    expect(dag(p, "2026-10-05", "America/New_York").map((x) => x.lage)).toEqual(["upptagen"]);
    expect(dag(p, "2026-10-06", "America/New_York")).toEqual([]);
    // Hela dygnet i Stockholm uttryckt i UTC är borta där, men bara upptagen i New York.
    const dygn = [{ uid: "a", start: "2026-10-05T22:00:00Z", slut: "2026-10-06T22:00:00Z", lage: "upptagen" }];
    expect(dag(dygn).map((x) => x.lage)).toEqual(["borta"]);
    expect(dag(dygn, "2026-10-06", "America/New_York").map((x) => x.lage)).toEqual(["upptagen"]);
  });

  it("dagen då sommartiden tar slut har 25 timmar, och ett lokalt 00:00 till 24:00 täcker den", () => {
    const p = [{ uid: "a", start: "2026-10-25T00:00", slut: "2026-10-26T00:00", lage: "upptagen" }];
    expect(dag(p, "2026-10-25").map((x) => x.lage)).toEqual(["borta"]);
    // 24 timmar från midnatt i UTC-tid räcker inte den dagen.
    const kort = [{ uid: "a", start: "2026-10-24T22:00:00Z", slut: "2026-10-25T22:00:00Z", lage: "upptagen" }];
    expect(dag(kort, "2026-10-25").map((x) => x.lage)).toEqual(["upptagen"]);
  });

  it("flera poster för samma person ger en rad, och borta vinner över upptagen åt båda håll", () => {
    const upptagenForst = [
      { uid: "a", start: "2026-10-06T09:00", slut: "2026-10-06T10:00", lage: "upptagen" },
      { uid: "a", heldag: true, start: "2026-10-06", lage: "upptagen" },
    ];
    expect(dag(upptagenForst)).toEqual([{ uid: "a", namn: "Anna", lage: "borta", orsak: null }]);
    expect(dag([...upptagenForst].reverse())).toEqual([{ uid: "a", namn: "Anna", lage: "borta", orsak: null }]);
  });

  it("orsaken är rubriken bara vid delad, och bara från poster med läget som vann", () => {
    expect(dag([{ uid: "a", heldag: true, start: "2026-10-06", lage: "delad", rubrik: "Jobbresa | Tyskland" }])).toEqual([{ uid: "a", namn: "Anna", lage: "borta", orsak: "Jobbresa | Tyskland" }]);
    expect(dag([{ uid: "a", heldag: true, start: "2026-10-06", lage: "upptagen", rubrik: "Hemligt" }])[0].orsak).toBeNull();
    // En delad lunch säger inget om varför personen är borta hela dagen.
    const blandat = [
      { uid: "a", heldag: true, start: "2026-10-06", lage: "upptagen", rubrik: "Hemligt" },
      { uid: "a", start: "2026-10-06T12:00", slut: "2026-10-06T13:00", lage: "delad", rubrik: "Lunch" },
    ];
    expect(dag(blandat)).toEqual([{ uid: "a", namn: "Anna", lage: "borta", orsak: null }]);
    const tva = [
      { uid: "a", start: "2026-10-06T15:00", slut: "2026-10-06T16:00", lage: "delad", rubrik: "Tandläkare" },
      { uid: "a", start: "2026-10-06T09:00", slut: "2026-10-06T10:00", lage: "delad", rubrik: "Möte" },
    ];
    expect(dag(tva)[0].orsak).toBe("Möte, Tandläkare");
  });

  it("⛔ en dold post räknas inte alls, inte ens som upptagen, och dess rubrik läcker aldrig", () => {
    expect(dag([{ uid: "a", heldag: true, start: "2026-10-06", lage: "dold", rubrik: "Hemligt" }])).toEqual([]);
    const medDold = dag([
      { uid: "a", heldag: true, start: "2026-10-06", lage: "dold", rubrik: "Hemligt" },
      { uid: "a", start: "2026-10-06T09:00", slut: "2026-10-06T10:00", lage: "upptagen" },
    ]);
    expect(medDold).toEqual([{ uid: "a", namn: "Anna", lage: "upptagen", orsak: null }]);
    expect(JSON.stringify(medDold)).not.toContain("Hemligt");
    // En dold post läses inte: inte ens ett trasigt datum i den kan kasta.
    expect(dag([{ uid: "a", start: "inte ett datum", lage: "dold" }])).toEqual([]);
  });

  it("upptagen utan orsak, och en tom delad rubrik ger ingen orsak", () => {
    expect(dag([{ uid: "b", start: "2026-10-06T09:00", slut: "2026-10-06T10:00", lage: "upptagen" }])).toEqual([{ uid: "b", namn: "Bo", lage: "upptagen", orsak: null }]);
    expect(dag([{ uid: "b", start: "2026-10-06T09:00", slut: "2026-10-06T10:00", lage: "delad", rubrik: "  " }])[0].orsak).toBeNull();
  });

  it("sorteras på namn med svensk ordning (Ö sist), och den som inte är medlem saknas", () => {
    const p = ["o", "b", "a", "x"].map((uid) => ({ uid, heldag: true, start: "2026-10-06", lage: "upptagen" }));
    expect(dag(p).map((x) => x.namn)).toEqual(["Anna", "Bo", "Örjan"]);
  });

  it("tomt: inga poster, inga medlemmar, eller poster en annan dag, ger en tom lista och noll", () => {
    expect(dag([])).toEqual([]);
    expect(tillganglighetForDag({ medlemmar: [], poster: [{ uid: "a", heldag: true, start: "2026-10-06", lage: "upptagen" }], dag: "2026-10-06" })).toEqual([]);
    expect(bortaAntal(dag([{ uid: "a", heldag: true, start: "2026-10-09", lage: "upptagen" }]))).toBe(0);
  });

  it("bortaAntal räknar borta och upptagna tillsammans, som SS blockedCount", () => {
    const lista = dag([
      { uid: "a", heldag: true, start: "2026-10-06", lage: "upptagen" },
      { uid: "b", start: "2026-10-06T09:00", slut: "2026-10-06T10:00", lage: "delad", rubrik: "Möte" },
    ]);
    expect(lista.map((x) => x.lage)).toEqual(["borta", "upptagen"]);
    expect(bortaAntal(lista)).toBe(2);
  });

  it("⛔ en post som inte går att läsa kastar med posten i meddelandet, i stället för att visa personen som tillgänglig", () => {
    expect(() => dag([{ uid: "a", start: "2026-10-06T25:00", slut: "2026-10-06T26:00", lage: "upptagen" }])).toThrow(/ingen ISO-tid/);
    expect(() => dag([{ uid: "a", start: "2026-10-06T09:00", lage: "upptagen" }])).toThrow(/slut saknas/);
    expect(() => dag([{ uid: "a", heldag: true, start: "2026-10-06", slut: "2026-10-06", lage: "upptagen" }])).toThrow(/exklusivt/);
    expect(() => dag([{ uid: "a", heldag: true, start: "2026-02-30", lage: "upptagen" }])).toThrow(/inget datum/);
    expect(() => dag([{ uid: "a", heldag: true, start: "2026-10-06", lage: "privat" }])).toThrow(/delningen "privat"/);
  });

  it("⛔ en tid med zon prövas strikt: datumet måste finnas och formen vara ISO, annars kastar den (Date.parse ensam godtar 30 februari)", () => {
    expect(() => dag([{ uid: "a", start: "2026-02-30T10:00Z", slut: "2026-02-30T11:00Z", lage: "upptagen" }], "2026-03-02")).toThrow(/inget datum/);
    expect(() => dag([{ uid: "a", start: "2026-10-06 10:00Z", slut: "2026-10-06T11:00Z", lage: "upptagen" }])).toThrow(/ingen ISO-tid/);
    expect(() => dag([{ uid: "a", start: "2026-10-06T24:00+02:00", slut: "2026-10-06T25:00+02:00", lage: "upptagen" }])).toThrow(/ingen ISO-tid/);
    // Giltiga former: Z, ±hh:mm, ±hhmm, med sekunder och bråkdel.
    expect(dag([{ uid: "a", start: "2026-10-06T09:00:00.000+02:00", slut: "2026-10-06T10:00+0200", lage: "upptagen" }]).map((x) => x.lage)).toEqual(["upptagen"]);
  });

  it("orsakerna ordnas på den tolkade tiden, inte på strängen", () => {
    // 07:30Z är 09:30 i Stockholm, alltså efter 09:00 lokal tid, fast strängen "2026-10-06T07:30Z" sorterar först.
    const p = [
      { uid: "a", start: "2026-10-06T07:30Z", slut: "2026-10-06T08:00Z", lage: "delad", rubrik: "Senare" },
      { uid: "a", start: "2026-10-06T09:00", slut: "2026-10-06T09:15", lage: "delad", rubrik: "Tidigare" },
    ];
    expect(dag(p)[0].orsak).toBe("Tidigare, Senare");
  });

  it("en post från någon som inte är medlem läses inte, och kastar alltså inte ens med ett trasigt datum", () => {
    expect(dag([{ uid: "x", start: "inte ett datum", lage: "upptagen" }])).toEqual([]);
  });
});
