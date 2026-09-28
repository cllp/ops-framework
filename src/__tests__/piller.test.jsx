import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OpsButton } from "../components/OpsButton.jsx";

/**
 * ⛔ #164, CP-BESLUT 2026-09-28 18:20: "KNAPPARNA BLIR PILLER SOM
 * SESSIONSTUDIO." Se filhuvudet i `OpsButton.jsx` för hela skälet
 * (mätt mot `v7PrimaryButtonClass`, SessionStudios `LoginScreen.jsx`).
 *
 * RÖTT UTAN FIXEN: sätt tillbaka `round ? "rounded-full" : "rounded-md"`
 * i `OpsButton.jsx` (den gamla ternären, utan `|| !iconOnly`) och alla
 * fyra proven nedan om textknappar faller, eftersom klassen då alltid
 * blir `rounded-md` för en textknapp.
 */
describe("OpsButton: piller (#164)", () => {
  it("en textknapp (primary) är rounded-full, inte rounded-md", () => {
    render(<OpsButton variant="primary">Spara</OpsButton>);
    const knapp = screen.getByRole("button", { name: "Spara" });
    expect(knapp.className).toContain("rounded-full");
    expect(knapp.className).not.toContain("rounded-md");
  });

  it("gäller alla fyra varianter, inte bara primary", () => {
    for (const variant of /** @type {const} */ (["primary", "secondary", "ghost", "danger"])) {
      const { unmount } = render(<OpsButton variant={variant}>X</OpsButton>);
      expect(screen.getByRole("button", { name: "X" }).className).toContain("rounded-full");
      unmount();
    }
  });

  it("⛔ en IKONKNAPP ändras INTE: fortfarande rounded-md, inte piller", () => {
    render(<OpsButton iconOnly ariaLabel="Ta bort">×</OpsButton>);
    const knapp = screen.getByRole("button", { name: "Ta bort" });
    expect(knapp.className).toContain("rounded-md");
    expect(knapp.className).not.toContain("rounded-full");
  });

  it("round (kräver iconOnly) ger fortfarande cirkeln, oförändrat", () => {
    render(
      <OpsButton iconOnly round ariaLabel="Skapa">
        +
      </OpsButton>,
    );
    expect(screen.getByRole("button", { name: "Skapa" }).className).toContain("rounded-full");
  });

  // ══ Samma pass: tyngd och storlek mätt mot SessionStudios ProfileView r604
  // och AppHeader.jsx (annan agent, samma commit som pillerformen) ═════════
  it("⛔ font-medium (500), inte font-semibold (600)", () => {
    render(<OpsButton>Spara</OpsButton>);
    const knapp = screen.getByRole("button", { name: "Spara" });
    expect(knapp.className).toContain("font-medium");
    expect(knapp.className).not.toContain("font-semibold");
  });

  it("⛔ size=\"md\" är text-sm (14px, som SessionStudios Spara-knapp), inte text-base (16px)", () => {
    render(<OpsButton size="md">Spara</OpsButton>);
    const knapp = screen.getByRole("button", { name: "Spara" });
    expect(knapp.className).toContain("text-sm");
    expect(knapp.className).not.toContain("text-base");
  });

  it("min-h-11 (44px träffyta) är ORÖRD av storleksrättningen", () => {
    render(<OpsButton size="md">Spara</OpsButton>);
    expect(screen.getByRole("button", { name: "Spara" }).className).toContain("min-h-11");
  });
});
