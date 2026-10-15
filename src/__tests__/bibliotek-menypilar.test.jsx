import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { menyPilar, PlatsValjare, TaggFilter } from "../components/OpsBibliotek.jsx";

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

/** ⛔ #372 (Claude BÖR 1): pilarna ska vara kopplade i de riktiga menyerna, inte bara i hjälpfunktionen. */
describe("menyPilar i PlatsValjare och TaggFilter (#372)", () => {
  it("PlatsValjare: pil ned flyttar fokus till nästa plats", async () => {
    render(<PlatsValjare platser={[{ id: "a", namn: "Ett" }, { id: "b", namn: "Två" }]} plats="a" onPlats={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Vilket bibliotek/ }));
    const meny = await screen.findByRole("menu", { name: "Vilket bibliotek" });
    const [ett, tva] = screen.getAllByRole("menuitemradio");
    ett.focus();
    fireEvent.keyDown(meny, { key: "ArrowDown" });
    expect(document.activeElement).toBe(tva);
  });
  it("TaggFilter: pil ned flyttar fokus till nästa tagg", async () => {
    render(<TaggFilter taggar={[{ tagg: "x", antal: 1 }, { tagg: "y", antal: 2 }]} valda={[]} onValda={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Taggar" }));
    const meny = await screen.findByRole("menu", { name: "Taggar" });
    const [x, y] = screen.getAllByRole("menuitemcheckbox");
    x.focus();
    fireEvent.keyDown(meny, { key: "ArrowDown" });
    expect(document.activeElement).toBe(y);
  });
});
