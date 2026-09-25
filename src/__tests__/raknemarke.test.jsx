import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OpsCountBadge, STATUS_TONES, statusTone } from "../index.js";

describe("OpsCountBadge (#97)", () => {
  it("ritar ingenting utan något att räkna", () => {
    const { container } = render(<OpsCountBadge count={0} text="nya" />);
    expect(container.innerHTML).toBe("");
  });

  it("⛔ en storlek och en färg: 16 px, minsta typsteget, badge-tokens", () => {
    const { container } = render(<OpsCountBadge count={7} text="nya" placement="icon" />);
    const el = container.querySelector("[data-ops-count-badge]");
    for (const k of ["h-4", "min-w-4", "text-xs", "tabular-nums", "bg-badge", "text-badge-contrast"]) {
      expect(el.className).toContain(k);
    }
    // Aldrig accenten: kräm i mörkt tema, det var klumpen CP såg.
    expect(el.className).not.toMatch(/bg-accent|text-on-accent|font-bold/);
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
