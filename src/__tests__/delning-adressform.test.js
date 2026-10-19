import { describe, expect, it } from "vitest";
import * as delning from "../lib/delning.js";
import {
  ADRESSSEGMENT,
  KODLANGD,
  MAX_ADRESSDEL,
  adressUrUppslag,
  adressdel,
  arAdressdel,
  byggAdress,
  delningsSokvag,
  delningsUrl,
  foreslaAdress,
  kodFel,
  nastaAdressdel,
  normaliseraKod,
  tolkaAdress,
} from "../lib/delning.js";
import { DELAD_SPRAKNYCKEL, antalDagar, deladTid, kortDatum, lasSparatSprak, sparaSprak, valdSprak, webblasarSprak } from "../lib/deladdatum.js";

/**
 * Formen på en delningsadress och datumen på den publika sidan (0.125.0, cllp/lifehub.app#377). Rena funktioner: ingen maskin, ingen webbläsare.
 */

describe("adressdel: text till en del av en adress", () => {
  it("gemener, å/ä/ö till a/a/o, och allt annat till ETT bindestreck", () => {
    expect(adressdel("Resa med kusiner")).toBe("resa-med-kusiner");
    expect(adressdel("Åke på Öland, äntligen!")).toBe("ake-pa-oland-antligen");
    expect(adressdel("Café Æsir & Ørsted \u2013 ß")).toBe("cafe-aesir-orsted-ss");
    expect(adressdel("  --Hej   världen--  ")).toBe("hej-varlden");
    expect(adressdel("a___b///c")).toBe("a-b-c");
  });

  it("⛔ punkten blir ett bindestreck (en punkt i en adress läses som ett filnamn)", () => {
    expect(adressdel("bubbelglasen.ver2")).toBe("bubbelglasen-ver2");
    expect(adressdel("låt.final.mp3")).toBe("lat-final-mp3");
    expect(adressdel("...")).toBe("");
    expect(adressdel("../etc/passwd")).toBe("etc-passwd");
  });

  it("högst 40 tecken, kapat vid ett ord, och aldrig ett bindestreck sist", () => {
    const lang = adressdel("en mycket lång titel som aldrig tar slut och som måste kortas ned");
    expect(lang.length).toBeLessThanOrEqual(MAX_ADRESSDEL);
    expect(lang.endsWith("-")).toBe(false);
    expect(lang).toBe("en-mycket-lang-titel-som-aldrig-tar-slut");
    expect(adressdel("a".repeat(100))).toBe("a".repeat(MAX_ADRESSDEL));
    expect(adressdel("x".repeat(30) + " " + "y".repeat(30))).toBe("x".repeat(30));
  });

  it("skräp ger en tom sträng och kastar aldrig", () => {
    for (const v of [undefined, null, 42, {}, "", "!!!", "   "]) expect(adressdel(v), String(v)).toBe("");
  });

  it("allt adressdel ger är en giltig del, eller tomt", () => {
    for (const t of ["Resa med kusiner", "Åäö", "x.y.z", "1 2 3", "A-B", "😀 hej"]) {
      const d = adressdel(t);
      if (d) expect(arAdressdel(d), t).toBe(true);
    }
  });
});

describe("arAdressdel", () => {
  it("gemener, siffror och enstaka bindestreck, och inget annat", () => {
    for (const ok of ["a", "resa", "resa-2", "a-b-c", "123"]) expect(arAdressdel(ok), ok).toBe(true);
    for (const fel of ["", "Resa", "a b", "a.b", "a/b", "-a", "a-", "a--b", "å", "a_b", "a".repeat(41), undefined, 5]) expect(arAdressdel(fel), String(fel)).toBe(false);
    expect(arAdressdel("a".repeat(64), 64)).toBe(true);
  });
});

describe("foreslaAdress och nastaAdressdel", () => {
  it("förslaget är gruppens namn och titeln, med ord som reserv när något saknas", () => {
    expect(foreslaAdress({ grupp: "Travel", titel: "Resa med kusiner", slag: "handelse" })).toEqual({ gruppdel: "travel", sista: "resa-med-kusiner" });
    // ⛔ 0.127.0: gruppdelen har ingen reserv. Ett fast ord hade gått till den första gruppen som saknade namn, och alla andra hade fått "används av en annan grupp".
    expect(foreslaAdress({ grupp: "", titel: "", slag: "handelse" })).toEqual({ gruppdel: "", sista: "handelse" });
    expect(foreslaAdress({ grupp: undefined, titel: "???", slag: "post" })).toEqual({ gruppdel: "", sista: "fil" });
    expect(foreslaAdress({ grupp: "???", titel: "Resa", slag: "post" }).gruppdel).toBe("");
    expect(foreslaAdress({ grupp: "Musik", titel: "bubbelglasen.ver2", slag: "post" })).toEqual({ gruppdel: "musik", sista: "bubbelglasen-ver2" });
  });

  it("nästa förslag: -2, -3, och delen hålls under taket", () => {
    expect(nastaAdressdel("resa")).toBe("resa-2");
    expect(nastaAdressdel("resa-2")).toBe("resa-3");
    expect(nastaAdressdel("resa-9")).toBe("resa-10");
    const lang = nastaAdressdel("a".repeat(MAX_ADRESSDEL));
    expect(lang.length).toBeLessThanOrEqual(MAX_ADRESSDEL);
    expect(lang.endsWith("-2")).toBe(true);
    expect(arAdressdel(lang)).toBe(true);
  });
});

describe("tolkaAdress: typsegmentet är en fast lista", () => {
  it("lib är en fil och event är en händelse, och inget annat segment", () => {
    expect(ADRESSSEGMENT).toEqual({ post: "lib", handelse: "event" });
    expect(tolkaAdress("travel/lib/bubbelglasen-ver2")).toMatchObject({ slag: "post", gruppdel: "travel", sista: "bubbelglasen-ver2" });
    expect(tolkaAdress("travel/event/resa-med-kusiner")).toMatchObject({ slag: "handelse", gruppdel: "travel", sista: "resa-med-kusiner" });
    for (const fel of ["travel/resa", "travel/arende/x", "travel/lib", "travel/lib/", "/lib/x", "travel/event/x/y", "Travel/event/x", "travel/event/X", "travel/event/x.y", "", "a", null, undefined, 4]) {
      expect(tolkaAdress(fel), String(fel)).toBeNull();
    }
  });

  it("inga reserverade ord behövs i sista delen: event/lib är en vanlig händelse", () => {
    expect(delning.RESERVERADE_ADRESSDELAR).toBeUndefined();
    expect(tolkaAdress("travel/event/lib")).toMatchObject({ slag: "handelse", sista: "lib" });
    expect(tolkaAdress("travel/lib/event")).toMatchObject({ slag: "post", sista: "event" });
  });

  it("byggAdress och tolkaAdress är varandras motsats", () => {
    for (const slag of ["post", "handelse"]) {
      const adress = byggAdress({ slag, gruppdel: "travel", sista: "resa-med-kusiner-k7f3q9x2" });
      expect(tolkaAdress(adress)).toMatchObject({ slag, gruppdel: "travel", sista: "resa-med-kusiner-k7f3q9x2", adress });
    }
  });
});

describe("uppslag, sökväg och url", () => {
  it("uppslaget görs om till gemener och tål ett snedstreck sist, men inte skräp", () => {
    expect(adressUrUppslag("Travel/Event/Resa-K7F3Q9X2/")).toBe("travel/event/resa-k7f3q9x2");
    expect(adressUrUppslag("  travel/lib/a ")).toBe("travel/lib/a");
    for (const fel of ["travel/event", "../x/y", "travel/event/a b", "", null, undefined]) expect(adressUrUppslag(fel), String(fel)).toBeNull();
  });

  it("sökvägen börjar på /g/, och domänen kommer från appen", () => {
    expect(delningsSokvag("travel/event/resa-xxxxxxxx")).toBe("/g/travel/event/resa-xxxxxxxx");
    expect(delningsUrl("https://my.life-hub.app", "/g/travel/event/resa")).toBe("https://my.life-hub.app/g/travel/event/resa");
    expect(delningsUrl("https://my.life-hub.app//", "/g/travel/lib/x")).toBe("https://my.life-hub.app/g/travel/lib/x");
    expect(delningsUrl("http://localhost:5173", "/g/a/lib/b")).toBe("http://localhost:5173/g/a/lib/b");
  });

  it("en basadress utan protokoll eller med en sökväg, och en sökväg utan /g/, kastar", () => {
    for (const bas of ["my.life-hub.app", "https://my.life-hub.app/app", "", undefined, "ftp://x.test"]) expect(() => delningsUrl(bas, "/g/a/lib/b"), String(bas)).toThrow(/basadressen/);
    expect(() => delningsUrl("https://my.life-hub.app", "/d/token")).toThrow(/börjar på \/g\//);
    expect(() => delningsUrl("https://my.life-hub.app", "g/a/lib/b")).toThrow(/börjar på \/g\//);
  });
});

describe("koden", () => {
  it("ingen kod är inget fel, och längden är min till max efter normalisering", () => {
    for (const v of [undefined, null, "", "   "]) expect(kodFel(v), String(v)).toBe("");
    expect(kodFel("a".repeat(KODLANGD.min))).toBe("");
    expect(kodFel("a".repeat(KODLANGD.min - 1))).toMatch(/minst 6/);
    expect(kodFel("a".repeat(KODLANGD.max))).toBe("");
    expect(kodFel("a".repeat(KODLANGD.max + 1))).toMatch(/högst 64/);
    expect(kodFel(12345678)).toMatch(/text/);
    expect(kodFel("  abcdef  ")).toBe("");
    expect(kodFel("  abcde  ")).toMatch(/minst 6/);
  });

  it("koden normaliseras (NFC och trim)", () => {
    expect(normaliseraKod("  blåbär ")).toBe("blåbär");
    expect(normaliseraKod(undefined)).toBe("");
    expect(normaliseraKod(5)).toBe("");
  });
});

describe("kortDatum, antalDagar och deladTid", () => {
  it("datumet har veckodag, dag, månad och år, på båda språken och utan punkt", () => {
    expect(kortDatum("2026-12-26", "sv")).toBe("lör 26 dec 2026");
    expect(kortDatum("2027-01-10", "sv")).toBe("sön 10 jan 2027");
    expect(kortDatum("2026-12-26", "en")).toBe("Sat 26 Dec 2026");
    expect(kortDatum("2027-01-10", "en")).toBe("Sun 10 Jan 2027");
    expect(kortDatum("2026-05-04", "sv")).toBe("mån 4 maj 2026");
    expect(kortDatum("inte-ett-datum", "sv")).toBe("inte-ett-datum");
    expect(kortDatum("2026-12-26")).toBe("lör 26 dec 2026");
  });

  it("antalet dagar är inklusive båda ändarna", () => {
    expect(antalDagar("2026-12-26", "2027-01-10")).toBe(16);
    expect(antalDagar("2026-02-27", "2026-03-01")).toBe(3);
    expect(antalDagar("2024-02-28", "2024-03-01")).toBe(3);
    expect(antalDagar("2026-12-26", "2026-12-26")).toBe(0);
    expect(antalDagar("2026-12-26", "2026-12-01")).toBe(0);
    expect(antalDagar("x", "2026-12-01")).toBe(0);
  });

  it("⛔ CP:s exempel: lör 26 dec 2026 till sön 10 jan 2027, 16 dagar", () => {
    const t = deladTid({ datum: "2026-12-26", slutDatum: "2027-01-10" }, "sv");
    expect(`${t.start} till ${t.slut}, ${t.dagar}`).toBe("lör 26 dec 2026 till sön 10 jan 2027, 16 dagar");
    const e = deladTid({ datum: "2026-12-26", slutDatum: "2027-01-10" }, "en");
    expect(`${e.start} to ${e.slut}, ${e.dagar}`).toBe("Sat 26 Dec 2026 to Sun 10 Jan 2027, 16 days");
  });

  it("heldag, klockslag och ett enda klockslag skrivs ut, och en endagshändelse har varken slut eller dagar", () => {
    expect(deladTid({ datum: "2026-12-26", heldag: true }, "sv")).toEqual({ start: "lör 26 dec 2026", slut: "", dagar: "", tid: "Heldag" });
    expect(deladTid({ datum: "2026-12-26", heldag: true }, "en").tid).toBe("All day");
    expect(deladTid({ datum: "2026-12-26", tid: "09:00", slutTid: "17:00" }, "sv").tid).toBe("09:00 - 17:00");
    expect(deladTid({ datum: "2026-12-26", tid: "09:00" }, "sv").tid).toBe("kl 09:00");
    expect(deladTid({ datum: "2026-12-26", tid: "09:00" }, "en").tid).toBe("at 09:00");
    expect(deladTid({ datum: "2026-12-26" }, "sv").tid).toBe("");
    expect(deladTid({ datum: "2026-12-26", slutDatum: null, tid: null }, "sv")).toMatchObject({ slut: "", dagar: "", tid: "" });
  });

  it("över flera dagar hör klockslagen till första och sista dagen", () => {
    expect(deladTid({ datum: "2026-12-26", slutDatum: "2027-01-02", tid: "22:00", slutTid: "02:00" }, "sv").tid).toBe("börjar kl 22:00, slutar kl 02:00");
    expect(deladTid({ datum: "2026-12-26", slutDatum: "2027-01-02", tid: "22:00", slutTid: "02:00" }, "en").tid).toBe("starts at 22:00, ends at 02:00");
    expect(deladTid({ datum: "2026-12-26", slutDatum: "2027-01-02", tid: "22:00" }, "sv").tid).toBe("börjar kl 22:00");
  });

  it("⛔ inga tankstreck någonstans i det sidan skriver", () => {
    const alla = [deladTid({ datum: "2026-12-26", slutDatum: "2027-01-10", tid: "09:00", slutTid: "17:00" }, "sv"), deladTid({ datum: "2026-12-26", heldag: true }, "en")];
    expect(JSON.stringify(alla)).not.toMatch(/[\u2014\u2013]/);
  });
});

describe("språket på den publika sidan", () => {
  it("webbläsarens språk: svenska om det börjar på sv, annars engelska", () => {
    for (const sv of ["sv", "sv-SE", "sv-FI", "SV", "sv_SE", " sv-SE "]) expect(webblasarSprak(sv), sv).toBe("sv");
    for (const en of ["en", "en-US", "de", "svx", "", undefined, null, 4, "no-SV"]) expect(webblasarSprak(en), String(en)).toBe("en");
  });

  it("det sparade valet vinner över webbläsarens, men bara om det är ett av våra", () => {
    expect(valdSprak({ sparat: "en", webblasare: "sv-SE" })).toBe("en");
    expect(valdSprak({ sparat: "sv", webblasare: "en-US" })).toBe("sv");
    expect(valdSprak({ sparat: "de", webblasare: "sv-SE" })).toBe("sv");
    expect(valdSprak({ sparat: null, webblasare: "fr" })).toBe("en");
    expect(valdSprak({})).toBe("en");
  });

  it("⛔ lagringen kan saknas eller kasta, och då kastar inte sidan", () => {
    expect(lasSparatSprak(null)).toBeNull();
    expect(lasSparatSprak({ getItem: () => { throw new Error("blockerad"); } })).toBeNull();
    expect(sparaSprak("en", null)).toBe(false);
    expect(sparaSprak("en", { setItem: () => { throw new Error("full"); } })).toBe(false);
    expect(sparaSprak("de", { setItem: () => {} })).toBe(false);
    const minne = new Map();
    expect(sparaSprak("en", { setItem: (k, v) => minne.set(k, v) })).toBe(true);
    expect(minne.get(DELAD_SPRAKNYCKEL)).toBe("en");
    expect(lasSparatSprak({ getItem: (k) => minne.get(k) ?? null })).toBe("en");
  });
});
