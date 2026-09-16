import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsDisclosure } from "../components/OpsDisclosure.jsx";

/**
 * Prov för OpsDisclosure. Reglerna som testas är de som annars ger tyst fel:
 * rubriken ska alltid synas, ostyrt läge ska fälla ut vid klick, styrt läge ska
 * INTE ändra sig självt utan lämna beslutet till appen (annars två sanningar).
 */
describe("OpsDisclosure", () => {
  it("visar rubriken och är hopfälld från start (ostyrt)", () => {
    render(<OpsDisclosure summary={<span>Rubrik</span>}>Kroppen</OpsDisclosure>);
    expect(screen.getByText("Rubrik")).toBeInTheDocument();
    // <details> utan open-attribut = hopfälld.
    const details = screen.getByText("Rubrik").closest("details");
    expect(details).not.toHaveAttribute("open");
  });

  it("defaultOpen fäller ut från start", () => {
    render(<OpsDisclosure summary={<span>Rubrik</span>} defaultOpen>Kroppen</OpsDisclosure>);
    const details = screen.getByText("Rubrik").closest("details");
    expect(details).toHaveAttribute("open");
  });

  it("ostyrt: klick fäller ut och anropar onOpenChange", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <OpsDisclosure summary={<span>Rubrik</span>} onOpenChange={onOpenChange}>
        Kroppen
      </OpsDisclosure>,
    );
    const details = screen.getByText("Rubrik").closest("details");
    expect(details).not.toHaveAttribute("open");
    await user.click(screen.getByText("Rubrik"));
    expect(details).toHaveAttribute("open");
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("styrt: open äger läget, appen får beslutet via onOpenChange", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <OpsDisclosure summary={<span>Rubrik</span>} open={false} onOpenChange={onOpenChange}>
        Kroppen
      </OpsDisclosure>,
    );
    await user.click(screen.getByText("Rubrik"));
    // Appen underrättas om avsikten men styr själv; komponenten öppnar sig inte
    // på egen hand i styrt läge.
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
});
