import { describe, it, expect } from "vitest";
import { readCaseFlow } from "../lib/caseFlow.js";

/**
 * ⛔ HELA FILEN HANDLAR OM SKILLNADEN MELLAN TRE UTFALL, och att två av dem såg
 * likadana ut i den form den ersätter:
 *
 *   const poster = (flode && Array.isArray(flode.items) && flode.items) || [];
 *
 * Den raden gör ett oläsligt flöde till en tom lista, alltså till "du har inga
 * uppgifter". Vyn säger "allt klart" när sanningen är "det gick inte att läsa".
 */

const gott = { updated: "2026-09-17", source: "https://exempel/urval", label: "drift", items: [{ number: 1 }] };

describe("inget flöde ännu", () => {
  it("är inte ett fel", () => {
    // ⛔ `null` betyder oftast "har inte hämtats än". Ett felmeddelande under
    // laddning är ett fel användaren inte kan göra något åt, och det lär hen att
    // ignorera felmeddelanden.
    for (const empty of [null, undefined, ""]) {
      const last = readCaseFlow(empty);
      expect(last.error).toBeNull();
      expect(last.existed).toBe(false);
      expect(last.entries).toEqual([]);
    }
  });
});

describe("flöde med noll poster", () => {
  it("är ett giltigt svar och inget fel", () => {
    const last = readCaseFlow({ ...gott, items: [] });
    expect(last.error).toBeNull();
    expect(last.existed).toBe(true);
    expect(last.entries).toEqual([]);
  });

  it("går att skilja från inget flöde alls", () => {
    // ⛔ DET HÄR ÄR HELA FUNKTIONENS EXISTENSBERÄTTIGANDE. Båda ger noll poster,
    // och `existed` är det enda som säger vilket av dem det var.
    expect(readCaseFlow({ ...gott, items: [] }).existed).toBe(true);
    expect(readCaseFlow(null).existed).toBe(false);
  });
});

describe("oläsligt flöde", () => {
  it("saknad items-lista är ett fel, inte noll uppgifter", () => {
    // ⛔ Raden som var tyst. Utan den här grenen blev svaret "inga uppgifter",
    // alltså ett påstående om verksamheten när sanningen är ett påstående om datan.
    const last = readCaseFlow({ updated: "2026-09-17", label: "drift" });
    expect(last.existed).toBe(false);
    expect(last.error).toMatch(/saknar en lista/);
    expect(last.entries).toEqual([]);
  });

  it("items som något annat än en lista är ett fel, och felet säger vad det var", () => {
    expect(readCaseFlow({ ...gott, items: "tre" }).error).toMatch(/string/);
    expect(readCaseFlow({ ...gott, items: 3 }).error).toMatch(/number/);
    expect(readCaseFlow({ ...gott, items: {} }).error).toMatch(/object/);
  });

  it("trasig JSON är ett fel med orsaken kvar", () => {
    const last = readCaseFlow("{ inte json");
    expect(last.existed).toBe(false);
    expect(last.error).toMatch(/inte giltig JSON/);
  });

  it("en lista på toppnivå är inte ett flöde", () => {
    // ⛔ Ett vanligt misstag är att spara bara posterna. Utan den här grenen hade
    // `items` varit undefined och felet sagt "saknar en lista", vilket är sant men
    // skickar läsaren att leta efter ett fält i stället för att se att hela
    // omslaget saknas.
    const last = readCaseFlow([{ number: 1 }]);
    expect(last.error).toMatch(/inte ett objekt/);
  });

  it("behåller datumstämpeln även när posterna är trasiga", () => {
    // ⛔ Den säger hur gammalt det trasiga är, vilket är det första man vill veta.
    expect(readCaseFlow({ updated: "2026-09-01" }).updatedAt).toBe("2026-09-01");
  });
});

describe("det som läses igenom", () => {
  it("ger posterna som de är, utan att tolka dem", () => {
    // ⛔ Läsaren normaliserar INTE posterna. Vad ett fält betyder är appens sak,
    // och en tystad eller ifylld post ser ut som en post från källan.
    const last = readCaseFlow({ ...gott, items: [{ number: 1, egetFalt: "kvar" }] });
    expect(last.entries[0]).toEqual({ number: 1, egetFalt: "kvar" });
  });

  it("läser en JSON-sträng lika bra som ett objekt", () => {
    expect(readCaseFlow(JSON.stringify(gott)).entries).toEqual(gott.items);
  });

  it("tål ett flöde utan datumstämpel", () => {
    const last = readCaseFlow({ items: [] });
    expect(last.existed).toBe(true);
    expect(last.updatedAt).toBeNull();
  });
});
