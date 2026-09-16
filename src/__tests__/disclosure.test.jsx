import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsDisclosure } from "../components/OpsDisclosure.jsx";

afterEach(() => {
  try {
    globalThis.localStorage?.clear();
  } catch {
    // Testmiljön har lagring, men kontrollen kostar inget.
  }
});

describe("OpsDisclosure", () => {
  it("börjar hopfälld och fälls ut av ett klick", async () => {
    render(
      <OpsDisclosure label="Mer inställningar">
        <p>hemligheten</p>
      </OpsDisclosure>,
    );
    const knapp = screen.getByRole("button", { name: "Mer inställningar" });
    expect(knapp).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(knapp);
    expect(knapp).toHaveAttribute("aria-expanded", "true");
  });

  it("pekar ut sin panel med aria-controls, så skärmläsaren hittar dit", () => {
    render(
      <OpsDisclosure label="Mer" defaultOpen>
        <p>innehåll</p>
      </OpsDisclosure>,
    );
    const knapp = screen.getByRole("button", { name: "Mer" });
    const panel = screen.getByRole("region", { name: "Mer" });
    expect(knapp.getAttribute("aria-controls")).toBe(panel.getAttribute("id"));
  });

  /**
   * ⛔ Den här är hela skälet till att komponenten inte bara är en div med
   * `max-height: 0`.
   *
   * Hopfälld panel har noll höjd men ligger kvar i DOM:en. Utan `inert` går det
   * att tabba in i den, och den som gör det ser fokusringen försvinna från
   * skärmen medan Tab verkar sluta fungera. Det är en bugg man aldrig hittar
   * genom att titta på sidan, bara genom att använda tangentbordet.
   */
  it("tar hopfälld panel ur tabbordningen, och släpper in den igen när den öppnas", async () => {
    render(
      <OpsDisclosure label="Mer">
        <button type="button">Inuti</button>
      </OpsDisclosure>,
    );
    const panel = screen.getByRole("region", { hidden: true });
    expect(panel.inert).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Mer" }));
    expect(panel.inert).toBe(false);
  });

  it("minns sitt läge mellan monteringar när en storageKey finns", async () => {
    const { unmount } = render(
      <OpsDisclosure label="Mer" storageKey="prov-disclosure">
        <p>x</p>
      </OpsDisclosure>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Mer" }));
    unmount();

    render(
      <OpsDisclosure label="Mer" storageKey="prov-disclosure">
        <p>x</p>
      </OpsDisclosure>,
    );
    expect(screen.getByRole("button", { name: "Mer" })).toHaveAttribute("aria-expanded", "true");
  });

  /**
   * ⛔ Blockerad lagring är inte ett undantagsfall, det är privat läge och varje
   * webbläsare med skärpta inställningar. Kastar läsningen blir ett hopfällbart
   * avsnitt anledningen att hela sidan är vit.
   */
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
          <OpsDisclosure label="Mer" storageKey="spelar-ingen-roll" defaultOpen>
            <p>x</p>
          </OpsDisclosure>,
        ),
      ).not.toThrow();
      expect(screen.getByRole("button", { name: "Mer" })).toHaveAttribute("aria-expanded", "true");
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
    }
  });

  it("visar en siffra efter rubriken bara när den är över noll", () => {
    const { rerender } = render(
      <OpsDisclosure label="Gäster" badge={0}>
        <p>x</p>
      </OpsDisclosure>,
    );
    expect(screen.getByRole("button", { name: "Gäster" })).toBeInTheDocument();

    rerender(
      <OpsDisclosure label="Gäster" badge={3}>
        <p>x</p>
      </OpsDisclosure>,
    );
    expect(screen.getByRole("button", { name: "Gäster (3)" })).toBeInTheDocument();
  });

  it("låter ett eget ariaLabel ta över när rubriken inte räcker", () => {
    render(
      <OpsDisclosure label="Mer" ariaLabel="Fler inställningar för sessionen">
        <p>x</p>
      </OpsDisclosure>,
    );
    expect(screen.getByRole("button", { name: "Fler inställningar för sessionen" })).toBeInTheDocument();
  });

  it("stänger igen vid andra klicket", async () => {
    render(
      <OpsDisclosure label="Mer" defaultOpen>
        <p>x</p>
      </OpsDisclosure>,
    );
    const knapp = screen.getByRole("button", { name: "Mer" });
    await userEvent.click(knapp);
    expect(knapp).toHaveAttribute("aria-expanded", "false");
  });

  it("öppnas och stängs med tangentbordet", async () => {
    render(
      <OpsDisclosure label="Mer">
        <p>x</p>
      </OpsDisclosure>,
    );
    const knapp = screen.getByRole("button", { name: "Mer" });
    knapp.focus();
    await userEvent.keyboard("{Enter}");
    expect(knapp).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard(" ");
    expect(knapp).toHaveAttribute("aria-expanded", "false");
  });

  it("kastar inte när storageKey saknas", async () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(
        <OpsDisclosure label="Mer">
          <p>x</p>
        </OpsDisclosure>,
      );
      await userEvent.click(screen.getByRole("button", { name: "Mer" }));
      expect(tyst).not.toHaveBeenCalled();
    } finally {
      tyst.mockRestore();
    }
  });
});
