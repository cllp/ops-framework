import fs from "node:fs";
import path from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpsDatePicker } from "../components/OpsDatePicker.jsx";
import { OpsField } from "../components/OpsField.jsx";
import { OpsTimePicker, delaTid } from "../components/OpsTimePicker.jsx";

/**
 * Datum och tid i ett formulär (0.31.0, avsnitt 11).
 *
 * ⛔ JSDOM KAN INTE DRIVA EN RADIX SELECT (se profilvy.test.jsx), så det som mäts här är det som går att se: tidens
 * delning, att båda listorna finns med sina namn och visar sitt värde, och att kalendern går att bläddra i med ett valt
 * datum. Att listorna faktiskt ritas ÖVER en modal och går att välja i mäts i Chromium, check-skalyta avsnitt 14.
 */
describe("delaTid", () => {
  it("delar HH:MM och kapar till 24 h", () => {
    expect(delaTid("09:30")).toEqual({ timme: "09", minut: "30" });
    expect(delaTid("9:05")).toEqual({ timme: "09", minut: "05" });
    expect(delaTid("27:75")).toEqual({ timme: "23", minut: "59" });
  });
  it("ger null för allt som inte är en tid", () => {
    expect(delaTid(undefined)).toBeNull();
    expect(delaTid("")).toBeNull();
    expect(delaTid("halv nio")).toBeNull();
  });
});

describe("OpsTimePicker", () => {
  it("ritar två listor med egna namn och tidens värde", () => {
    render(<OpsTimePicker value="09:30" onChange={() => {}} />);
    const tim = screen.getByRole("combobox", { name: "Timme" });
    const min = screen.getByRole("combobox", { name: "Minut" });
    expect(within(tim).getByText("09")).toBeTruthy();
    expect(within(min).getByText("30")).toBeTruthy();
  });
  it("visar -- när ingen tid är vald", () => {
    render(<OpsTimePicker onChange={() => {}} />);
    expect(within(screen.getByRole("combobox", { name: "Timme" })).getByText("--")).toBeTruthy();
    expect(within(screen.getByRole("combobox", { name: "Minut" })).getByText("--")).toBeTruthy();
  });
  it("timlistan är kopplad till fältets etikett", () => {
    render(
      <OpsField label="Tid">
        <OpsTimePicker onChange={() => {}} timAriaLabel="Tid, timme" />
      </OpsField>,
    );
    expect(screen.getByRole("combobox", { name: "Tid, timme" })).toBeTruthy();
  });
});

describe("OpsDatePicker: månaden går att bläddra i med ett valt datum", () => {
  it("nästa månad byter rubrik", () => {
    render(<OpsDatePicker value="2026-10-12" onChange={() => {}} ariaLabel="Datum" />);
    fireEvent.click(screen.getByRole("button", { name: "Datum" }));
    expect(screen.getByText("oktober 2026")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /next month|nästa/i }));
    expect(screen.getByText("november 2026")).toBeInTheDocument();
    expect(screen.queryByText("oktober 2026")).not.toBeInTheDocument();
  });
});

describe("lagren", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../../tokens/tokens.css"), "utf8");
  /** @param {string} n */
  const z = (n) => Number(new RegExp(`--z-${n}:\\s*(\\d+);`).exec(css)?.[1]);
  it("en lista som öppnas ur en kontroll ligger ovanför modalen och under toasten", () => {
    expect(z("modal")).toBeGreaterThan(0);
    expect(z("dropdown")).toBeGreaterThan(z("modal"));
    expect(z("dropdown")).toBeLessThan(z("toast"));
    expect(z("overlay")).toBeLessThan(z("modal"));
  });
});
