import { describe, it, expect } from "vitest";
import { konfigloggregelfragment } from "../lib/regler.js";
import { KONFIGHANDELSER, KONFIGLOGGFALT } from "../lib/konfiglogg.js";

/**
 * `konfigloggregelfragment()` (0.39.0, #188): ändringsloggen över en grupps katalog.
 *
 * ⛔ SÄKERHETSMÄTNINGEN LIGGER I `rules/__tests__/konfiglogg.test.mjs` MOT EMULATORN. Det här är den lilla, rena
 * halvan: att fragmentet binder ihop `KONFIGLOGGFALT` och `KONFIGHANDELSER`, att villkoren är de som ska gälla och att
 * felvägen säger vad som saknas.
 */

describe("konfigloggregelfragment", () => {
  it("kräver ett samlingsnamn utan snedstreck", () => {
    expect(() => konfigloggregelfragment("")).toThrow(/konfiglogg/);
    expect(() => konfigloggregelfragment("a/b")).toThrow(/samlingsnamn/);
    // @ts-expect-error: provar felvägen
    expect(() => konfigloggregelfragment(undefined)).toThrow(/samlingsnamn/);
  });

  it("medlem i RADENS grupp läser, admin i radens grupp skriver, ingen ändrar eller raderar", () => {
    const text = konfigloggregelfragment("konfiglogg");
    expect(text).toContain("match /konfiglogg/{id}");
    expect(text).toContain("allow read: if opsArMedlem(resource.data.groupId);");
    expect(text).toContain("allow create: if opsArAdmin(request.resource.data.groupId)");
    expect(text).toContain("allow update, delete: if false;");
    expect(text).not.toContain("opsArAgare");
  });

  it("⛔ skrivvillkoret är SAMMA som katalogens (opsArAdmin), annars går sparningen igenom och loggraden nekas", () => {
    // Det var felet i #188 med appens handskrivna regel: den frågade efter appens grupp, inte radens.
    const text = konfigloggregelfragment("konfiglogg");
    expect(text).not.toMatch(/appensGrupp|cps-ab/);
  });

  it("⛔ formen ÄR KONFIGLOGGFALT och KONFIGHANDELSER, inte handskrivna kopior", () => {
    const text = konfigloggregelfragment("konfiglogg");
    const hasOnly = (text.match(/hasOnly\(\[([^\]]*)\]\)/) || [])[1] || "";
    const faltIRegel = hasOnly.split(",").map((x) => x.trim().replace(/"/g, "")).filter(Boolean);
    expect(faltIRegel.sort()).toEqual([...KONFIGLOGGFALT].sort());
    expect(faltIRegel).toContain("groupId");
    const handelser = (text.match(/handelse in \[([^\]]*)\]/) || [])[1] || "";
    expect(handelser.split(",").map((x) => x.trim().replace(/"/g, "")).sort()).toEqual([...KONFIGHANDELSER].sort());
  });

  it("samlingsnamnet är appens val och används som det är", () => {
    expect(konfigloggregelfragment("andringslogg")).toContain("match /andringslogg/{id}");
  });
});
