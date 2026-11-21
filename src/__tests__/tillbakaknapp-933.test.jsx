// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { OpsTillbakaKnapp } from "../index.js";

/**
 * Tillbaka för en vy som appen själv ritar (0.250.0, cllp/lifehub.app#933). CP 2026-11-21: "öppna ärendet ... i sin egna vy, men med en pil
 * tillbaka". Provet läser knappen ur paketets index, alltså samma väg som appen: utan exporten är den `undefined` och provet rött.
 */
describe("OpsTillbakaKnapp (#933)", () => {
  it("ritar ordet och leder tillbaka vid ett tryck", () => {
    const tillbaka = vi.fn();
    render(<OpsTillbakaKnapp onClick={tillbaka} etikett="Tillbaka" />);
    const knapp = screen.getByRole("button", { name: "Tillbaka" });
    fireEvent.click(knapp);
    expect(tillbaka).toHaveBeenCalledTimes(1);
  });

  it("⛔ stängt API: en klass från appen når inte knappen", () => {
    render(<OpsTillbakaKnapp onClick={() => {}} etikett="Tillbaka" {...{ className: "rod" }} />);
    expect(screen.getByRole("button", { name: "Tillbaka" }).className).not.toMatch(/\brod\b/);
  });
});
