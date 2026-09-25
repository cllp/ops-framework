import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OpsCountBadge, STATUS_TONES, statusTone } from "../index.js";

describe("OpsCountBadge (#97)", () => {
  it("ritar ingenting utan något att räkna", () => {
    const { container } = render(<OpsCountBadge count={0} text="nya" />);
    expect(container.innerHTML).toBe("");
  });

  it("⛔ inkorgens gamla märke, samma på klockan: 16 px, 8 px-siffra, samma hörn", () => {
    // Förlagan är Counter i 414c56d (CP 18:10: "Du skulle ta den som var på inkorg innan").
    const { container } = render(
      <>
        <OpsCountBadge count={7} text="nya" placement="icon" />
        <OpsCountBadge count={10} text="olästa" placement="icon" />
      </>,
    );
    const [inkorg, klocka] = container.querySelectorAll("[data-ops-count-badge]");
    expect(inkorg.className).toBe(klocka.className);
    for (const k of ["-top-0.5", "-right-0.5", "h-4", "min-w-4", "px-0.5", "text-[8px]", "font-bold", "tabular-nums", "bg-badge", "text-badge-contrast"]) {
      expect(inkorg.className.split(/\s+/)).toContain(k);
    }
    // Aldrig accenten (kräm i mörkt tema) och aldrig den stora siffran eller ringen.
    expect(inkorg.className).not.toMatch(/bg-accent|text-on-accent|text-xs|ring-/);
  });

  it("kapar vid 99+ och läser upp det riktiga talet", () => {
    render(<OpsCountBadge count={150} text="olästa" />);
    expect(screen.getByText("99+")).toBeInTheDocument();
    expect(screen.getByText("150 olästa")).toBeInTheDocument();
  });

  it("vägrar en okänd placering", () => {
    expect(() => render(<OpsCountBadge count={1} placement="mitten" />)).toThrow(/placement/);
  });
});

describe("STATUS_TONES (bolag-ops #363)", () => {
  it("⛔ Ny är info, samma ton överallt", () => {
    expect(STATUS_TONES.ny).toBe("info");
    expect(statusTone("hanterad")).toBe("success");
    expect(statusTone("okänt")).toBe("neutral");
    expect(statusTone(null)).toBe("neutral");
  });
});
