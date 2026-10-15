import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { menyPilar } from "../components/OpsBibliotek.jsx";

/** ⛔ #372: PlatsValjare och TaggFilter har role="menu", och en meny ska gå med pilarna. */
describe("menyPilar (#372)", () => {
  const meny = () =>
    render(
      <div role="menu" aria-label="M" onKeyDown={menyPilar}>
        <button type="button" role="menuitemradio" aria-checked="true">A</button>
        <button type="button" role="menuitemradio" aria-checked="false">B</button>
        <button type="button" role="menuitemcheckbox" aria-checked="false">C</button>
      </div>,
    );
  it("ned, upp, runt, Home och End flyttar fokus mellan raderna", () => {
    meny();
    const m = screen.getByRole("menu");
    const [a, b, c] = ["A", "B", "C"].map((n) => screen.getByText(n));
    a.focus();
    fireEvent.keyDown(m, { key: "ArrowDown" });
    expect(document.activeElement).toBe(b);
    fireEvent.keyDown(m, { key: "ArrowDown" });
    fireEvent.keyDown(m, { key: "ArrowDown" });
    expect(document.activeElement).toBe(a);
    fireEvent.keyDown(m, { key: "ArrowUp" });
    expect(document.activeElement).toBe(c);
    fireEvent.keyDown(m, { key: "Home" });
    expect(document.activeElement).toBe(a);
    fireEvent.keyDown(m, { key: "End" });
    expect(document.activeElement).toBe(c);
  });
  it("andra tangenter rör inte fokus", () => {
    meny();
    const a = screen.getByText("A");
    a.focus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "x" });
    expect(document.activeElement).toBe(a);
  });
});
