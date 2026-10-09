import { describe, expect, it } from "vitest";
import { AGENTMODELLER, FORVALD_AGENTMODELL, modellKanValjas, modellUrId } from "../lib/agentmodeller.js";

describe("agentens modellista", () => {
  it("har en modell per leverantör som kan chatta, och exakt en utan nyckel", () => {
    expect(AGENTMODELLER.map((m) => m.leverantor)).toEqual(["vertex", "google", "openai", "anthropic"]);
    expect(new Set(AGENTMODELLER.map((m) => m.id)).size).toBe(AGENTMODELLER.length);
    expect(FORVALD_AGENTMODELL.id).toBe("gemini-2.5-flash-lite");
    expect(FORVALD_AGENTMODELL.nyckel).toBe(false);
    expect(AGENTMODELLER.filter((m) => m.nyckel === false)).toEqual([FORVALD_AGENTMODELL]);
    for (const m of AGENTMODELLER) {
      expect(m.namn.sv).not.toBe(m.id);
      expect(m.beskrivning.sv.length).toBeGreaterThan(10);
    }
  });

  it("ett okänt eller tomt id är null, och visningsnamnet träffar samma modell", () => {
    expect(modellUrId("")).toBeNull();
    expect(modellUrId("  ")).toBeNull();
    expect(modellUrId(null)).toBeNull();
    expect(modellUrId("okand-modell")).toBeNull();
    expect(modellUrId("gemini-2.5-flash-lite")?.namn.sv).toBe("Gemini Flash Lite");
    expect(modellUrId("Gemini Flash Lite")?.id).toBe("gemini-2.5-flash-lite");
  });

  it("en modell med nyckel är valbar bara när leverantören är kopplad", () => {
    const google = modellUrId("gemini-2.5-flash");
    expect(modellKanValjas(FORVALD_AGENTMODELL, [])).toBe(true);
    expect(modellKanValjas(FORVALD_AGENTMODELL, undefined)).toBe(true);
    expect(modellKanValjas(google, [])).toBe(false);
    expect(modellKanValjas(google, undefined)).toBe(false);
    expect(modellKanValjas(google, ["openai"])).toBe(false);
    expect(modellKanValjas(google, ["google"])).toBe(true);
    expect(modellKanValjas(null, ["google"])).toBe(false);
  });
});
