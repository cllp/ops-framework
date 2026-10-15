// @ts-check
import { describe, expect, it } from "vitest";
import { FOKUS_TECKEN, fokusKort } from "../../scripts/lib/fokusKort.mjs";

describe("fokusKort (#389)", () => {
  it("⛔ hela dokumentets text på body blir taggnamnet och de första 60 tecknen, inte 5,8 MB", () => {
    const dokument = "Boka rep med bandet. ".repeat(Math.ceil(5_800_000 / 21));
    const rad = fokusKort("BODY", dokument);
    expect(dokument.length).toBeGreaterThan(5_000_000);
    expect(rad.startsWith("body ")).toBe(true);
    expect(rad).toContain(dokument.trim().slice(0, FOKUS_TECKEN));
    expect(rad.endsWith('…"')).toBe(true);
    // Taggen, citattecknen, de 60 tecknen och ellipsen, med lite marginal.
    expect(rad.length).toBeLessThanOrEqual(FOKUS_TECKEN + 10);
  });

  it("en kort text kommer med hel och utan ellips, och exakt 60 tecken kapas inte", () => {
    expect(fokusKort("BUTTON", "  Meddelande ")).toBe('button "Meddelande"');
    const sextio = "x".repeat(FOKUS_TECKEN);
    expect(fokusKort("P", sextio)).toBe(`p "${sextio}"`);
    expect(fokusKort("P", `${sextio}y`)).toBe(`p "${sextio}…"`);
  });

  it("⛔ inget element med fokus och tom text säger det, i stället för ett tomt mellanrum", () => {
    expect(fokusKort(null, "text")).toBe("inget element");
    expect(fokusKort(undefined, undefined)).toBe("inget element");
    expect(fokusKort("DIV", null)).toBe('div ""');
  });
});
