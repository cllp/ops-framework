import { describe, expect, it } from "vitest";
import {
  MAX_KALENDERVAL,
  TOM_SYNLIGHET,
  aterstallKalenderSynlighet,
  arEnsamSynlig,
  arKalenderSynlig,
  doldaKalenderIds,
  harKalenderVal,
  kalenderValDokument,
  lasKalenderSynlighet,
  rensaKalenderSynlighet,
  skrivKalenderSynlighet,
  vaxlaKalenderSynlighet,
  visaBaraKalender,
} from "../lib/kalendersynlighet.js";
import { arPostIDoldKalender, delaPosterPaSynlighet, filtreraPoster, kalenderNyckelForPost } from "../lib/calendar.js";

/**
 * "Visa bara den här", dokumentet på kontot och vad som är dolt (0.151.0, CP 2026-10-28).
 *
 * ⛔ Rena funktioner, så att varje beslut går att pröva utan en webbläsare: vem som blir ensam, vad som tas tillbaka, och att "före" aldrig läcker in i ett senare val.
 */

const A = { id: "a" };
const B = { id: "b" };
const C = { id: "c", avFranStart: true };
const RADER = [A, B, C];
const ids = (/** @type {any} */ val) => RADER.filter((r) => arKalenderSynlig(r, val)).map((r) => r.id);

describe("visaBaraKalender", () => {
  it("gör raden ensam synlig och döljer de andra, också de som syntes av förval", () => {
    expect(ids(TOM_SYNLIGHET)).toEqual(["a", "b"]);
    const v = visaBaraKalender(B, RADER, TOM_SYNLIGHET);
    expect(ids(v)).toEqual(["b"]);
    expect(arEnsamSynlig(B, RADER, v)).toBe(true);
  });

  it("en rad som är av från start kan göras ensam, och de andra döljs", () => {
    const v = visaBaraKalender(C, RADER, TOM_SYNLIGHET);
    expect(ids(v)).toEqual(["c"]);
  });

  it("bara det som skiljer sig från förvalet står i minnet", () => {
    const v = visaBaraKalender(B, RADER, TOM_SYNLIGHET);
    // a syntes av förval och döljs nu: står där. c var av av förval och är kvar av: står inte. b syns av förval: står inte.
    expect(v.syns).toEqual({ a: false });
  });

  it("⛔ sparar valen som gällde före, och ett nytt anrop på samma rad tar tillbaka dem exakt", () => {
    const fore = vaxlaKalenderSynlighet(C, vaxlaKalenderSynlighet(A, TOM_SYNLIGHET)); // a av, c på
    expect(ids(fore)).toEqual(["b", "c"]);
    const bara = visaBaraKalender(B, RADER, fore);
    expect(ids(bara)).toEqual(["b"]);
    expect(bara.fore).toEqual({ a: false, c: true });
    const tillbaka = visaBaraKalender(B, RADER, bara);
    expect(ids(tillbaka)).toEqual(["b", "c"]);
    expect(tillbaka.syns).toEqual({ a: false, c: true });
    expect("fore" in tillbaka).toBe(false);
  });

  it("⛔ visningen rörs aldrig: visa bara svarar på vilka som syns, inte hur", () => {
    const start = { ...TOM_SYNLIGHET, visning: { a: /** @type {const} */ ("ram") } };
    const bara = visaBaraKalender(B, RADER, start);
    expect(bara.visning).toEqual({ a: "ram" });
    expect(visaBaraKalender(B, RADER, bara).visning).toEqual({ a: "ram" });
  });

  it("en rad som inte är ensam får en ny 'före' varje gång den görs ensam", () => {
    const v1 = visaBaraKalender(A, RADER, TOM_SYNLIGHET);
    const v2 = visaBaraKalender(B, RADER, v1);
    // Från a ensam till b ensam: före är a ensam (det som gällde då), inte det ursprungliga.
    expect(ids(v2)).toEqual(["b"]);
    expect(v2.fore).toEqual(v1.syns);
    expect(ids(visaBaraKalender(B, RADER, v2))).toEqual(ids(v1));
  });

  it("⛔ raden är ensam av egna tryck (ingen 'före'): återtaget är förvalen, inte ingenting", () => {
    let v = vaxlaKalenderSynlighet(B, TOM_SYNLIGHET); // b av
    v = vaxlaKalenderSynlighet(A, v); // a av: nu syns ingen
    v = vaxlaKalenderSynlighet(B, v); // b på: ensam, utan fore
    expect(arEnsamSynlig(B, RADER, v)).toBe(true);
    expect(v.fore).toBeUndefined();
    expect(ids(visaBaraKalender(B, RADER, v))).toEqual(["a", "b"]);
  });

  it("⛔ ett tryck på en växel, 'Alla kalendrar' och en återställning tar bort 'före': ett senare val är ett nytt läge", () => {
    const bara = visaBaraKalender(B, RADER, TOM_SYNLIGHET);
    expect(bara.fore).toBeDefined();
    expect("fore" in vaxlaKalenderSynlighet(A, bara)).toBe(false);
    expect("fore" in aterstallKalenderSynlighet(bara)).toBe(false);
  });

  it("'före' kan vara tom (förvalen) och skiljer sig då från att 'före' saknas", () => {
    const bara = visaBaraKalender(B, RADER, TOM_SYNLIGHET);
    expect(bara.fore).toEqual({});
    expect(harKalenderVal(bara)).toBe(true);
    const text = skrivKalenderSynlighet(bara);
    expect(JSON.parse(text).fore).toEqual({});
    expect(lasKalenderSynlighet(text).fore).toEqual({});
  });

  it("en kalender som tillkommit emellan följer sitt förval vid återtaget, och en som syns av förval gör att raden inte längre är ensam", () => {
    const bara = visaBaraKalender(B, [A, B], TOM_SYNLIGHET);
    const av = { id: "ny-av", avFranStart: true };
    const pa = { id: "ny-pa" };
    // Av från start: b är fortfarande ensam, och återtaget ger a tillbaka och låter den nya stå kvar av.
    const tillbaka = visaBaraKalender(B, [A, B, av], bara);
    expect([A, B, av].filter((r) => arKalenderSynlig(r, tillbaka)).map((r) => r.id)).toEqual(["a", "b"]);
    // På från start: b är inte längre ensam (den nya syns), så ett långtryck gör b ensam igen i stället för att ta tillbaka.
    expect(arEnsamSynlig(B, [A, B, pa], bara)).toBe(false);
    expect([A, B, pa].filter((r) => arKalenderSynlig(r, visaBaraKalender(B, [A, B, pa], bara))).map((r) => r.id)).toEqual(["b"]);
  });

  it("en rad som inte finns i listan görs ändå synlig", () => {
    const v = visaBaraKalender({ id: "okand" }, RADER, TOM_SYNLIGHET);
    expect(v.syns.okand).toBe(true);
    expect(ids(v)).toEqual([]);
  });

  it("rör inte det den fick", () => {
    const start = Object.freeze({ v: /** @type {const} */ (1), syns: Object.freeze({ a: false }), visning: Object.freeze({}) });
    expect(() => visaBaraKalender(B, RADER, start)).not.toThrow();
    expect(start.syns).toEqual({ a: false });
  });
});

describe("dokumentet på kontot", () => {
  it("rensaKalenderSynlighet släpper trasiga poster och ger null för något som inte är ett minne", () => {
    expect(rensaKalenderSynlighet(null)).toBeNull();
    expect(rensaKalenderSynlighet([])).toBeNull();
    expect(rensaKalenderSynlighet({ v: 2, syns: {} })).toBeNull();
    expect(rensaKalenderSynlighet({ v: 1, syns: { a: false, b: "nej", c: 1 }, visning: { a: "ram", b: "stor" }, fore: { a: true, b: "ja" } })).toEqual({
      v: 1,
      syns: { a: false },
      visning: { a: "ram" },
      fore: { a: true },
    });
    expect(rensaKalenderSynlighet({ v: 1 })).toEqual({ v: 1, syns: {}, visning: {} });
  });

  it("samma form i webbläsaren och på kontot: dokumentet är det som JSON-skrivs", () => {
    const val = { v: /** @type {const} */ (1), syns: { a: false }, visning: { b: /** @type {const} */ ("bada") }, fore: { a: true } };
    expect(JSON.parse(skrivKalenderSynlighet(val))).toEqual(kalenderValDokument(val));
    expect(kalenderValDokument(TOM_SYNLIGHET)).toEqual({ v: 1, syns: {}, visning: {} });
    expect("fore" in kalenderValDokument(TOM_SYNLIGHET)).toBe(false);
  });

  it("⛔ ett gammalt minne utan 'fore' skrivs oförändrat: ingen skrivning av ingenting nytt", () => {
    expect(skrivKalenderSynlighet({ v: 1, syns: { a: false }, visning: {} })).toBe('{"v":1,"syns":{"a":false},"visning":{}}');
  });

  it("kastar med ett begripligt fel över taket, innan reglerna hinner neka", () => {
    const syns = Object.fromEntries(Array.from({ length: MAX_KALENDERVAL + 1 }, (_, i) => [`k${i}`, true]));
    expect(() => kalenderValDokument({ v: 1, syns, visning: {} })).toThrow(/syns har 201 poster, högst 200/);
    // ⛔ Webbläsarens text kastar aldrig: taket är kontots.
    expect(() => skrivKalenderSynlighet({ v: 1, syns, visning: {} })).not.toThrow();
    expect(() => kalenderValDokument({ v: 1, syns: Object.fromEntries(Object.entries(syns).slice(0, MAX_KALENDERVAL)), visning: {} })).not.toThrow();
  });

  it("harKalenderVal: tomt är inget val, allt annat är ett", () => {
    expect(harKalenderVal(TOM_SYNLIGHET)).toBe(false);
    expect(harKalenderVal({ v: 1, syns: { a: true }, visning: {} })).toBe(true);
    expect(harKalenderVal({ v: 1, syns: {}, visning: { a: "ram" } })).toBe(true);
  });
});

describe("vad som är dolt: en sanning för filtret, snabbtitten och Dagen", () => {
  const poster = [
    { id: "1", kalender: { id: "a" } },
    { id: "2", kalender: { id: "b" } },
    { id: "3" }, // utan kalender: hör till den förvalda
    { id: "4", kalender: { id: "okand" } },
  ];

  it("doldaKalenderIds ger de avslagna i listans ordning", () => {
    expect(doldaKalenderIds(RADER, TOM_SYNLIGHET)).toEqual(["c"]);
    expect(doldaKalenderIds(RADER, visaBaraKalender(B, RADER, TOM_SYNLIGHET))).toEqual(["a", "c"]);
    expect(doldaKalenderIds(null, TOM_SYNLIGHET)).toEqual([]);
  });

  it("delaPosterPaSynlighet delar efter kalender, och en post utan kalender följer den förvalda", () => {
    const d = delaPosterPaSynlighet(poster, { dolda: ["a"], forvaldId: "b" });
    expect(d.dolda.map((p) => p.id)).toEqual(["1"]);
    expect(d.synliga.map((p) => p.id)).toEqual(["2", "3", "4"]);
    const e = delaPosterPaSynlighet(poster, { dolda: new Set(["b"]), forvaldId: "b" });
    expect(e.dolda.map((p) => p.id)).toEqual(["2", "3"]);
  });

  it("⛔ en post vars kalender saknar rad är aldrig dold, och utan gruppkalender (tom nyckel) hör en post utan kalender ingen knapp till", () => {
    const d = delaPosterPaSynlighet(poster, { dolda: ["a", "b"], forvaldId: "" });
    expect(d.dolda.map((p) => p.id)).toEqual(["1", "2"]);
    expect(kalenderNyckelForPost({}, "")).toBe("");
    expect(arPostIDoldKalender({}, new Set(["a"]), "")).toBe(false);
  });

  it("⛔ SAMMA SVAR SOM FILTRET: det filtreraPoster tar bort är exakt det delaPosterPaSynlighet kallar dolt", () => {
    const dolda = ["a", "okand"];
    const kvar = filtreraPoster(/** @type {any} */ (poster), { doldaKalendrar: dolda, forvaldId: "b" }).map((p) => p.id);
    const delat = delaPosterPaSynlighet(poster, { dolda, forvaldId: "b" });
    expect(delat.synliga.map((p) => p.id)).toEqual(kvar);
    expect(delat.dolda.length + delat.synliga.length).toBe(poster.length);
    // Golv: något blev faktiskt dolt, annars är jämförelsen tom.
    expect(delat.dolda.length).toBeGreaterThan(0);
  });
});
