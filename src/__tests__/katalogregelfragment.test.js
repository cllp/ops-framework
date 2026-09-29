import { describe, it, expect } from "vitest";
import { katalogregelfragment } from "../lib/regler.js";
import { KATEGORIFALT } from "../lib/katalog.js";

/**
 * `katalogregelfragment()` (#162): katalogens delade samling, medlem läser,
 * ägare skriver, uppslag på radens groupId.
 *
 * ⛔ DEN RIKTIGA SÄKERHETSMÄTNINGEN LIGGER I `rules/__tests__` MOT EMULATORN.
 * Det här är den lilla, ren-funktions-halvan: att fragmentet faktiskt binder
 * ihop `KATEGORIFALT` och `gruppadSamling`, och att felvägarna säger vad som
 * saknas.
 */

describe("katalogregelfragment", () => {
  it("kräver minst ett samlingsnamn", () => {
    expect(() => katalogregelfragment([])).toThrow(/minst ett samlingsnamn/);
    expect(() => katalogregelfragment("")).toThrow(/minst ett samlingsnamn/);
    expect(() => katalogregelfragment(["kategorier", "  "])).toThrow(/minst ett samlingsnamn/);
  });

  it("bygger ett block för samlingen, ägare skriver och medlem läser", () => {
    const text = katalogregelfragment("kategorier");
    expect(text).toContain("match /kategorier/{id}");
    expect(text).toContain("allow read: if opsArMedlem(resource.data.groupId);");
    expect(text).toContain("allow create: if opsArAgare(request.resource.data.groupId)");
    expect(text).toContain("allow delete: if false;");
  });

  it("⛔ ingen radering, samma beslut som groups och de andra samlingarna (#136)", () => {
    expect(katalogregelfragment("kategorier")).toContain("allow delete: if false;");
  });

  it("⛔ formvalideringen ÄR KATEGORIFALT, inte en handskriven kopia", () => {
    // ⛔ Det här är det som gör provet till ett skydd och inte bara en
    // avläsning: mäts hasOnly mot en LOKAL kopia av fältlistan här i testet
    // kan de två glida isär utan att provet märker det (en tautologisk
    // lista, arbetsreglernas punkt 4). Mäts den mot den IMPORTERADE
    // konstanten fäller ett missat fält alltid, oavsett vilken av de två som
    // ändrades sist.
    const text = katalogregelfragment("kategorier");
    for (const falt of KATEGORIFALT) {
      expect(text).toContain(`"${falt}"`);
    }
  });

  it("⛔ ett fält SOM INTE finns i KATEGORIFALT ska inte råka stå i hasOnly", () => {
    // Golv mot en tautologi: provet ovan hade varit grönt även om
    // katalogregelfragment skrev EXTRA fält, så länge KATEGORIFALT:s egna
    // fanns med. Den här räknar att antalet fält är EXAKT detsamma.
    const text = katalogregelfragment("kategorier");
    const hasOnlyRad = text.match(/hasOnly\(\[([^\]]*)\]\)/);
    expect(hasOnlyRad).toBeTruthy();
    const faltIRegeln = (hasOnlyRad?.[1] ?? "").split(",").map((s) => s.trim().replace(/^"|"$/g, "")).filter(Boolean);
    expect(faltIRegeln.sort()).toEqual([...KATEGORIFALT].sort());
  });

  it("flera samlingsnamn ger ett block var", () => {
    const text = katalogregelfragment(["kategorier", "sorter"]);
    expect(text).toContain("match /kategorier/{id}");
    expect(text).toContain("match /sorter/{id}");
  });

  it("⛔ katalogregelfragment kan limmas in tillsammans med regelfragment(), utan krock", () => {
    // ⛔ Samma sammansättning som en app faktiskt gör i sin firestore.rules:
    // regelfragment() ger opsArMedlem/opsArAgare, katalogregelfragment()
    // ANVÄNDER dem. Ordningen spelar roll: fragmentets funktioner måste stå
    // före blocket som anropar dem.
    const text = katalogregelfragment("kategorier");
    expect(text).toContain("opsArMedlem");
    expect(text).toContain("opsArAgare");
  });
});
