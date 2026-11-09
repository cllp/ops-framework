import { describe, expect, it } from "vitest";
import { MAX_BIBLIOTEKTEXT, inmatningsfel } from "../lib/bibliotek.js";
import { bibliotekregelfragment } from "../lib/regler.js";

/**
 * CP 2026-10-30: en anteckning får vara 20000 tecken (var 8000), 0.161.0.
 * CP i cllp/lifehub.app#706: taket blir "50 000" (0.209.0), så att en uppladdad .md ryms som anteckning.
 * Samma tal i klienten och i regeln.
 * ⛔ RÖTT UTAN ÄNDRINGEN: mot 0.208.0 är taket 20000, inmatningsfelet säger "Taket är 20000." och regeln har `<= 20000`.
 */
describe("taket för en anteckning (0.209.0)", () => {
  it("är 50000 tecken", () => {
    expect(MAX_BIBLIOTEKTEXT).toBe(50000);
  });
  it("inmatningsfelet släpper in 50000 tecken och säger taket vid 50001", () => {
    expect(inmatningsfel({ typ: "anteckning", rubrik: "Plan", text: "t".repeat(50000) })).toBeNull();
    expect(inmatningsfel({ typ: "anteckning", rubrik: "Plan", text: "t".repeat(50001) })).toBe("Texten är 50001 tecken. Taket är 50000.");
  });
  it("regeln har samma tak", () => {
    const r = String(bibliotekregelfragment("bibliotek"));
    expect(r).toContain("d.text.size() <= 50000");
    expect(r).not.toContain("d.text.size() <= 20000");
    expect(r).not.toContain("d.text.size() <= 8000");
  });
});
