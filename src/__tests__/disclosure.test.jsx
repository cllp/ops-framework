import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsDisclosure } from "../components/OpsDisclosure.jsx";

/**
 * Prov för OpsDisclosure. Reglerna som testas är de som annars ger tyst fel:
 * rubriken ska alltid synas, ostyrt läge ska fälla ut vid klick, styrt läge ska
 * INTE ändra sig självt utan lämna beslutet till appen (annars två sanningar).
 */
afterEach(() => {
  try {
    globalThis.localStorage?.clear();
  } catch {
    // Testmiljön har lagring, men kontrollen kostar inget.
  }
});

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

  /**
   * ⛔ Tilläggen nedan kom från en andra, dubblerad implementation som annars
   * hade kastats bort helt. De är just tillägg: de gör inte samma sak som
   * `summary` och `open` på ett andra sätt, de gör nya saker.
   */
  it("minns sitt läge mellan monteringar när en storageKey finns", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <OpsDisclosure summary={<span>Rubrik</span>} storageKey="prov-disclosure">
        Kroppen
      </OpsDisclosure>,
    );
    await user.click(screen.getByText("Rubrik"));
    unmount();

    render(
      <OpsDisclosure summary={<span>Rubrik</span>} storageKey="prov-disclosure">
        Kroppen
      </OpsDisclosure>,
    );
    expect(screen.getByText("Rubrik").closest("details")).toHaveAttribute("open");
  });

  it("fungerar när localStorage kastar", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blockerad lagring");
      },
    });
    try {
      expect(() =>
        render(
          <OpsDisclosure summary={<span>Rubrik</span>} storageKey="spelar-ingen-roll" defaultOpen>
            Kroppen
          </OpsDisclosure>,
        ),
      ).not.toThrow();
      expect(screen.getByText("Rubrik").closest("details")).toHaveAttribute("open");
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
    }
  });

  it("visar en siffra bara när den är över noll", () => {
    const { rerender } = render(
      <OpsDisclosure summary={<span>Gäster</span>} badge={0}>
        Kroppen
      </OpsDisclosure>,
    );
    expect(screen.queryByText("0")).toBeNull();
    rerender(
      <OpsDisclosure summary={<span>Gäster</span>} badge={3}>
        Kroppen
      </OpsDisclosure>,
    );
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  /**
   * Golvet mäts i webbläsaren av check-scaffold; jsdom lägger ingen CSS och kan
   * inte mäta höjd. Här kontrolleras bara att klassen sitter kvar, så att en
   * omskrivning av rubrikraden inte tyst tar bort den.
   */
  it("behåller höjdgolvet på rubrikraden", () => {
    const { container } = render(<OpsDisclosure summary={<span>Rubrik</span>}>Kroppen</OpsDisclosure>);
    expect(container.querySelector("summary")?.className).toContain("min-h-11");
  });
});
