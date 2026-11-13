import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exempelkarta } from "../../examples/karta/dahab.js";

/*
 * Kartan hämtas när den ritas (0.223.0, cllp/ops-framework#570). Modulen `OpsKartaVy` ersätts av en som räknar utvärderingar.
 * Ett grep efter ordet import hade stått grönt genom en statisk import. Bytesmåttet är `check:delbarhet`.
 */

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.doUnmock("../components/OpsKartaVy.jsx");
});

beforeEach(() => {
  vi.resetModules();
});

describe("OpsKarta är lat", () => {
  it("importen av komponenten hämtar inte vyn, ritningen gör det", async () => {
    const utvarderad = vi.fn();
    vi.doMock("../components/OpsKartaVy.jsx", () => {
      utvarderad();
      return { OpsKartaVy: () => <p>Kartan är här</p> };
    });
    const { OpsKarta } = await import("../components/OpsKarta.jsx");
    expect(utvarderad).not.toHaveBeenCalled();
    render(<OpsKarta data={exempelkarta} />);
    expect(await screen.findByText("Kartan är här")).toBeTruthy();
    expect(utvarderad).toHaveBeenCalledTimes(1);
  });

  it("en tom fil hämtar inte vyn", async () => {
    const utvarderad = vi.fn();
    vi.doMock("../components/OpsKartaVy.jsx", () => {
      utvarderad();
      return { OpsKartaVy: () => null };
    });
    const { OpsKarta } = await import("../components/OpsKarta.jsx");
    render(<OpsKarta data={{ type: "FeatureCollection", features: [] }} />);
    expect(screen.getByRole("status").textContent).toBe("Kartan har inget att visa.");
    expect(utvarderad).not.toHaveBeenCalled();
  });

  it("en vy som inte går att hämta säger det, och Försök igen hämtar på nytt", async () => {
    let forsok = 0;
    vi.doMock("../components/OpsKartaVy.jsx", () => {
      forsok += 1;
      throw new Error("nätet föll");
    });
    const { OpsKarta } = await import("../components/OpsKarta.jsx");
    render(<OpsKarta data={exempelkarta} />);
    const fel = await screen.findByRole("alert");
    expect(fel.textContent).toContain("Kartan gick inte att hämta");
    expect(forsok).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Försök igen" }));
    await waitFor(() => expect(forsok).toBe(2));
    expect(screen.getByRole("alert").textContent).toContain("Kartan gick inte att hämta");
  });
});
