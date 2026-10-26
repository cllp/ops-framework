import { describe, expect, it } from "vitest";
import { byggRadId, kallaForRad, lasRadId, losKnapprad, radkallaEtikett, validateRadkallor } from "../lib/radkallor.js";

/**
 * 0.145.0 (cllp/ops-framework#446): radens id `<källa>:<id>` och manifestet som ramverket tar emot.
 *
 * ⛔ Provet mäter formen och vakterna, inte att en komponent ritar något: panelen provas i `radpanel.test.jsx`. Varje vakt här har ett
 * motsatt fall (en giltig form som INTE kastar), så att ett prov inte blir grönt av att allt kastar.
 */

describe("⛔ radens id: <källa>:<id> går fram och tillbaka", () => {
  it("bygger och läser samma sak, också när appens id själv har kolon", () => {
    const fall = [
      ["paminnelse", "abc"],
      ["ekonomi", "kundfaktura:2026-114"],
      ["kalender", "2026-10-28:Attest större leverantörsfakturor"],
      ["ical", "x:y:z"],
    ];
    for (const [kalla, id] of fall) {
      const radId = byggRadId(kalla, id);
      expect(radId).toBe(`${kalla}:${id}`);
      expect(lasRadId(radId)).toEqual({ kalla, id });
    }
    // Källan är allt före FÖRSTA kolonet: ett kolon i appens id flyttar inte gränsen.
    expect(lasRadId("kalender:2026-10-28:Attest")).toEqual({ kalla: "kalender", id: "2026-10-28:Attest" });
  });

  it("ett id utan formen är ingen rad med en källa: lasRadId ger null och kastar inte", () => {
    for (const v of ["abc", ":abc", "abc:", "", "a b:c", "ä:c", undefined, null, 42, {}]) expect(lasRadId(v), String(v)).toBeNull();
  });

  it("byggRadId kastar på en källa eller ett id som inte går att läsa tillbaka", () => {
    expect(() => byggRadId("", "x")).toThrow(/källan/);
    expect(() => byggRadId("a:b", "x")).toThrow(/källan/);
    expect(() => byggRadId("a b", "x")).toThrow(/källan/);
    expect(() => byggRadId("paminnelse", "")).toThrow(/id krävs/);
    expect(() => byggRadId(/** @type {any} */ (undefined), "x")).toThrow(/källan/);
    expect(() => byggRadId("paminnelse", "x")).not.toThrow();
  });
});

describe("⛔ manifestet kontrolleras när det tas emot", () => {
  const ok = { paminnelse: { etikett: "Påminnelse" } };

  it("utelämnat är null (allt som förut), en giltig karta går igenom orörd", () => {
    expect(validateRadkallor(undefined, "T")).toBeNull();
    expect(validateRadkallor(null, "T")).toBeNull();
    expect(validateRadkallor(ok, "T")).toBe(ok);
    expect(validateRadkallor({}, "T")).toEqual({});
  });

  it("kastar på det som skulle ge en tyst tom panel", () => {
    expect(() => validateRadkallor([], "T")).toThrow(/karta/);
    expect(() => validateRadkallor("x", "T")).toThrow(/karta/);
    expect(() => validateRadkallor({ "a:b": { etikett: "A" } }, "T")).toThrow(/giltigt namn/);
    expect(() => validateRadkallor({ ekonomi: {} }, "T")).toThrow(/saknar etikett/);
    expect(() => validateRadkallor({ ekonomi: { etikett: "  " } }, "T")).toThrow(/saknar etikett/);
    expect(() => validateRadkallor({ ekonomi: { etikett: 3 } }, "T")).toThrow(/saknar etikett/);
    expect(() => validateRadkallor({ ical: { etikett: (/** @type {any} */ r) => r.kalenderNamn } }, "T")).not.toThrow();
    expect(() => validateRadkallor({ ekonomi: { etikett: "E", atgarder: [] } }, "T")).toThrow(/atgarder måste vara en funktion/);
    expect(() => validateRadkallor({ ekonomi: { etikett: "E", dela: true } }, "T")).toThrow(/dela måste vara en funktion/);
    expect(() => validateRadkallor({ ekonomi: { etikett: "E", atgarder: () => [], dela: () => ({ skal: "x" }) } }, "T")).not.toThrow();
  });

  it("kallaForRad hittar källan på id:t, och ger null för det manifestet inte känner", () => {
    const k = validateRadkallor({ ekonomi: { etikett: "Ekonomi" } }, "T");
    expect(kallaForRad(k, "ekonomi:f1")?.manifest.etikett).toBe("Ekonomi");
    expect(kallaForRad(k, "ekonomi:f1")).toMatchObject({ kalla: "ekonomi", id: "f1" });
    expect(kallaForRad(k, "inkorg:x")).toBeNull();
    expect(kallaForRad(k, "ingenkalla")).toBeNull();
    expect(kallaForRad(null, "ekonomi:f1")).toBeNull();
    // Ett id som liknar en inbyggd nyckel i objektet är ingen källa.
    expect(kallaForRad(k, "constructor:x")).toBeNull();
    expect(kallaForRad(k, "toString:x")).toBeNull();
  });
});

describe("⛔ källans namn: en text, eller en funktion av raden", () => {
  it("Apple och Google kan ligga under samma källa och ändå säga rätt namn", () => {
    const ical = { etikett: (/** @type {any} */ r) => r.kalenderNamn };
    expect(radkallaEtikett(ical, { id: "ical:1", kalenderNamn: "Apple" }, "T")).toBe("Apple");
    expect(radkallaEtikett(ical, { id: "ical:2", kalenderNamn: "Google" }, "T")).toBe("Google");
    expect(radkallaEtikett({ etikett: "Ekonomi" }, { id: "ekonomi:1" }, "T")).toBe("Ekonomi");
  });

  it("ett tomt svar kastar: 'Från ' utan namn säger inte varifrån raden kommer", () => {
    const ical = { etikett: (/** @type {any} */ r) => r.kalenderNamn };
    expect(() => radkallaEtikett(ical, { id: "ical:3" }, "T")).toThrow(/måste ge en text/);
    expect(() => radkallaEtikett(ical, { id: "ical:3", kalenderNamn: "  " }, "T")).toThrow(/måste ge en text/);
  });
});

describe("⛔ knappraden som källan levererar", () => {
  const rad = { id: "paminnelse:p1", title: "Attest" };

  it("åtgärderna går igenom i sin ordning, och en källa utan dela ger null (ramverkets skäl gäller)", () => {
    const a = [
      { id: "klar", etikett: "Klar", onClick: () => {} },
      { id: "rutin", etikett: "Öppna rutinen", href: "/rutiner/attest" },
    ];
    const k = losKnapprad({ etikett: "Påminnelse", atgarder: (r) => (r === rad ? a : []) }, rad, "T");
    expect(k.atgarder.map((x) => x.id)).toEqual(["klar", "rutin"]);
    expect(k.dela).toBeNull();
    expect(losKnapprad({ etikett: "E" }, rad, "T")).toEqual({ atgarder: [], dela: null });
  });

  it("kastar på en knapp som inte gör något, har två sätt, saknar namn eller dubbleras", () => {
    const med = (/** @type {any} */ a) => () => losKnapprad({ etikett: "E", atgarder: () => a }, rad, "T");
    expect(med([{ id: "a", etikett: "A" }])).toThrow(/exakt en av onClick och href/);
    expect(med([{ id: "a", etikett: "A", onClick: () => {}, href: "/x" }])).toThrow(/exakt en av onClick och href/);
    expect(med([{ id: "a", etikett: "", onClick: () => {} }])).toThrow(/formen/);
    expect(med([{ etikett: "A", onClick: () => {} }])).toThrow(/formen/);
    expect(med([{ id: "a", etikett: "A", onClick: () => {} }, { id: "a", etikett: "B", href: "/b" }])).toThrow(/två gånger/);
    expect(med([{ id: "a", etikett: "A", href: "javascript:alert(1)" }])).toThrow(/kör kod/);
    expect(med("inte en lista")).toThrow(/ge en lista/);
    expect(med(undefined)).toThrow(/ge en lista/);
    expect(med([{ id: "a", etikett: "A", href: "/x" }])).not.toThrow();
    expect(med([])).not.toThrow();
  });

  it("dela svarar alltid: en knapp eller ett skäl, och inget annat", () => {
    const med = (/** @type {any} */ d) => () => losKnapprad({ etikett: "E", dela: () => d }, rad, "T");
    expect(losKnapprad({ etikett: "E", dela: () => ({ skal: "Delas inte", istallet: "Dela i Ekonomi" }) }, rad, "T").dela).toEqual({ skal: "Delas inte", istallet: "Dela i Ekonomi" });
    expect(losKnapprad({ etikett: "E", dela: () => ({ skal: "Delas inte" }) }, rad, "T").dela).toEqual({ skal: "Delas inte" });
    expect(med({ onClick: () => {} })).not.toThrow();
    expect(med({ href: "/dela/1" })).not.toThrow();
    expect(med(undefined)).toThrow(/måste svara/);
    expect(med({})).toThrow(/exakt en av onClick, href och skal/);
    expect(med({ onClick: () => {}, href: "/x" })).toThrow(/exakt en av onClick, href och skal/);
    expect(med({ skal: "" })).toThrow(/skal som är tomt/);
    expect(med({ skal: "x", istallet: 3 })).toThrow(/istallet/);
    expect(med({ href: "javascript:x" })).toThrow(/kör kod/);
  });
});
