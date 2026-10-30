import { describe, expect, it } from "vitest";
import { MAX_BIBLIOTEKTEXT } from "../lib/bibliotek.js";
import { bibliotekregelfragment } from "../lib/regler.js";

/** CP 2026-10-30: en anteckning får vara 20000 tecken (var 8000). Samma tal i klienten och i regeln. */
describe("taket för en anteckning (0.161.0)", () => {
  it("är 20000 tecken", () => {
    expect(MAX_BIBLIOTEKTEXT).toBe(20000);
  });
  it("regeln har samma tak", () => {
    const r = String(bibliotekregelfragment("bibliotek"));
    expect(r).toContain("d.text.size() <= 20000");
    expect(r).not.toContain("d.text.size() <= 8000");
  });
});
