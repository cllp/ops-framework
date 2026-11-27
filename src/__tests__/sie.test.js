import { describe, expect, it } from "vitest";
import { avkodaSie, sieFalt, sieOre, tolkaSie } from "../lib/sie.js";
import { FILMIME, arSieFil, filInmatningsfel, mimeForFil, mimeUrFilnamn } from "../lib/bibliotek.js";
import { SIE_MIME } from "../lib/sie.js";

/*
 * En SIE-fil tolkad (0.268.0, cllp/lifehub.app#884, CP 2026-11-18: "Jag skulle vilja kunna ha stöd för SIE filer i biblioteket och API:et").
 * ⛔ SYNTETISK FIL, INGA RIKTIGA BOLAGSDATA I REPOT (ärendets punkt 5). Röda före 0.268.0: modulen fanns inte, och en `.se` nekades vid uppladdningen.
 */

/** Text som PC8 (CP437), så som bokföringsprogrammen skriver SIE: å 0x86, ä 0x84, ö 0x94, Å 0x8f, Ä 0x8e, Ö 0x99. */
const PC8 = { å: 0x86, ä: 0x84, ö: 0x94, Å: 0x8f, Ä: 0x8e, Ö: 0x99 };
const somPc8 = (/** @type {string} */ s) => new Uint8Array([...s].map((c) => (c in PC8 ? PC8[/** @type {keyof typeof PC8} */ (c)] : c.charCodeAt(0))));

const FIL = [
  "#FLAGGA 0",
  '#PROGRAM "Provprogrammet" 1.0',
  "#FORMAT PC8",
  "#GEN 20260115",
  "#SIETYP 4",
  '#FNAMN "Övningsbolaget i Åre AB"',
  "#ORGNR 556000-0000",
  "#RAR 0 20250101 20251231",
  "#RAR -1 20240101 20241231",
  '#KONTO 1930 "Företagskonto"',
  '#KONTO 3001 "Försäljning inom Sverige"',
  '#KONTO 5410 "Förbrukningsinventarier"',
  "#KTYP 1930 T",
  "#IB 0 1930 10000.00",
  "#UB 0 1930 22500.50",
  "#IB -1 1930 5000.00",
  "#RES 0 3001 -15000.00",
  "#RES 0 5410 2499.50",
  '#VER A 1 20250310 "Kund betalar \\"faktura\\" 12" 20250311',
  "{",
  '#TRANS 1930 {} 15000.00 "" "Inbetalning"',
  "#TRANS 3001 {1 \"100\"} -15000.00",
  "}",
  '#VER A 2 20250412 "Köp av lampa"',
  "{",
  "#RTRANS 5410 {} 2499.50",
  "#TRANS 5410 {} 2499.50",
  "#TRANS 1930 {} -2499.50",
  "#TRANS 1930 {} inte-ett-belopp",
  "}",
  "#PSALDO 0 202501 3001 {} -1000.00",
].join("\r\n");

describe("avkodningen: PC8 enligt standarden, UTF-8 när filen är det", () => {
  it("PC8 ger åäö rätt", () => {
    expect(avkodaSie(somPc8("Åre åäö ÅÄÖ"))).toBe("Åre åäö ÅÄÖ");
  });
  it("giltig UTF-8 med åäö läses som UTF-8, med BOM borttagen", () => {
    const utf8 = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("#FNAMN \"Åre\"")]);
    expect(avkodaSie(utf8)).toBe('#FNAMN "Åre"');
  });
  it("bara ASCII är samma text i båda", () => {
    expect(avkodaSie(new TextEncoder().encode("#SIETYP 4"))).toBe("#SIETYP 4");
  });
});

describe("fälten och beloppen", () => {
  it("ord, strängar med \\\" och objektlistor", () => {
    expect(sieFalt('#VER A 1 20250310 "Kund betalar \\"faktura\\" 12" 20250311')).toEqual(["#VER", "A", "1", "20250310", 'Kund betalar "faktura" 12', "20250311"]);
    expect(sieFalt('#TRANS 3001 {1 "100"} -15000.00')).toEqual(["#TRANS", "3001", '1 "100"', "-15000.00"]);
  });
  it("⛔ belopp i öre, utan flyttal", () => {
    expect([sieOre("1234.5"), sieOre("-0.01"), sieOre("12,34"), sieOre("7"), sieOre("0.125"), sieOre("x"), sieOre("")]).toEqual([123450, -1, 1234, 700, 13, null, null]);
  });
});

describe("hela filen", () => {
  const ut = tolkaSie(avkodaSie(somPc8(FIL)));
  if (!ut.ok) throw new Error(ut.skal);
  const { sie } = ut;

  it("företaget, orgnr, räkenskapsåren och programmet, med åäö ur PC8", () => {
    expect([sie.foretag, sie.orgnr, sie.sietyp, sie.program, sie.genererad]).toEqual(["Övningsbolaget i Åre AB", "556000-0000", "4", "Provprogrammet 1.0", "2026-01-15"]);
    expect(sie.rakenskapsar).toEqual([
      { ar: 0, start: "2025-01-01", slut: "2025-12-31" },
      { ar: -1, start: "2024-01-01", slut: "2024-12-31" },
    ]);
  });

  it("kontoplanen med saldon för år 0, och inte förra årets", () => {
    expect(sie.konton).toEqual([
      { nr: "1930", namn: "Företagskonto", typ: "T", ib: 1000000, ub: 2250050, res: null },
      { nr: "3001", namn: "Försäljning inom Sverige", typ: null, ib: null, ub: null, res: -1500000 },
      { nr: "5410", namn: "Förbrukningsinventarier", typ: null, ib: null, ub: null, res: 249950 },
    ]);
  });

  it("⛔ verifikationerna, utan #RTRANS (den hade räknats två gånger), och en trasig rad räknas som varning", () => {
    expect(sie.verifikationer.map((v) => [v.serie, v.nr, v.datum, v.text, v.rader.length, v.summa])).toEqual([
      ["A", "1", "2025-03-10", 'Kund betalar "faktura" 12', 2, 1500000],
      ["A", "2", "2025-04-12", "Köp av lampa", 2, 249950],
    ]);
    expect(sie.verifikationer[0].rader[0]).toEqual({ konto: "1930", belopp: 1500000, datum: null, text: "Inbetalning" });
    expect(sie.varningar).toEqual([{ rad: 29, text: "En #TRANS utan konto eller belopp." }]);
  });

  it("en fil som inte är SIE säger det", () => {
    expect(tolkaSie("Hej, det här är ett brev.")).toEqual({ ok: false, skal: "Filen är inte en SIE-fil: den saknar #FLAGGA och #SIETYP." });
  });
});

describe("Biblioteket tar emot SIE", () => {
  it("⛔ ändelsen ger typen, och typen tas emot (före 0.268.0 nekades en .se)", () => {
    for (const n of ["bokforing.se", "BOKFORING.SI", "a.sie"]) expect(mimeUrFilnamn(n)).toBe(SIE_MIME);
    expect(mimeForFil("bokforing.se", "")).toBe(SIE_MIME);
    expect(mimeForFil("bokforing.se", "application/octet-stream")).toBe(SIE_MIME);
    expect(FILMIME).toContain(SIE_MIME);
    expect(filInmatningsfel({ namn: "bokforing.se", mime: SIE_MIME, byte: 100 })).toBeNull();
  });
  it("arSieFil: typen, eller ändelsen när en webbläsare sade text/plain", () => {
    expect(arSieFil({ fil: { namn: "x.bin", mime: SIE_MIME } })).toBe(true);
    expect(arSieFil({ fil: { namn: "bokforing.se", mime: "text/plain" } })).toBe(true);
    expect(arSieFil({ fil: { namn: "brev.txt", mime: "text/plain" } })).toBe(false);
    expect(arSieFil(null)).toBe(false);
  });
});
