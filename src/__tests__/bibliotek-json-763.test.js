import { describe, expect, it } from "vitest";
import { FILMIME, filContentTypeMonster, filInmatningsfel, filMimeMonster, mimeUrFilnamn } from "../lib/bibliotek.js";
import { bibliotekregelfragment, lagringsregelfragment } from "../lib/regler.js";

/**
 * JSON och GeoJSON i Biblioteket (0.222.0, cllp/lifehub.app#763). CP 2026-11-11: Travel Agent behöver lägga kartdata (Dahab) i Biblioteket, och en
 * .geojson fick laddas upp som text. Det som mäts är det personen gör: väljer filen, och klienten, posten och lagringen säger samma sak.
 *
 * ⛔ Mönstret i reglerna byggdes med `join("|")`. `+` i `application/geo+json` hade blivit en kvantifierare, och regeln hade nekat den riktiga typen
 * men släppt in `application/geoojson`. Proven nedan läser mönstret med RegExp, samma tolkning som reglernas RE2 för teckenklasser.
 */

const MONSTER = () => [new RegExp(filMimeMonster()), new RegExp(filContentTypeMonster())];

describe("JSON och GeoJSON (#763)", () => {
  it("⛔ en .geojson och en .json tas emot med rätt typ, också när webbläsaren inte säger någon", () => {
    expect(mimeUrFilnamn("Dahab.geojson")).toBe("application/geo+json");
    expect(mimeUrFilnamn("rutt.JSON")).toBe("application/json");
    for (const [namn, mime] of [["Dahab.geojson", "application/geo+json"], ["rutt.json", "application/json"]]) {
      expect(FILMIME).toContain(mime);
      expect(filInmatningsfel({ namn, mime, byte: 4096 }), namn).toBeNull();
    }
  });

  it("⛔ båda reglernas mönster släpper in de två typerna och inget som bara liknar dem", () => {
    for (const re of MONSTER()) {
      expect(re.test("application/geo+json")).toBe(true);
      expect(re.test("application/json")).toBe(true);
      for (const fel of ["application/geoojson", "application/geojson", "application/json5", "application/javascript", "text/javascript"]) expect(re.test(fel), fel).toBe(false);
    }
  });

  it("⛔ punkterna i Office-typerna är bokstavliga, inte vilket tecken som helst", () => {
    for (const re of MONSTER()) {
      expect(re.test("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(true);
      expect(re.test("application/vndXopenxmlformats-officedocument.wordprocessingml.document")).toBe(false);
    }
  });

  it("lagringsregeln och postens regel bär samma mönster, ur samma lista", () => {
    const bibliotek = { gruppPrefix: "grupper", postPrefix: "bibliotek", samling: "bibliotek" };
    expect(lagringsregelfragment({ bibliotek })).toContain("application/geo[+]json");
    expect(String(bibliotekregelfragment("bibliotek"))).toContain("application/geo[+]json");
  });
});
