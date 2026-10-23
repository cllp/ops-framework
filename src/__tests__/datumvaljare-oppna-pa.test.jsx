import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsDatePicker } from "../components/OpsDatePicker.jsx";

/**
 * 0.142.0 (lifehub.app#450): `oppnaPa` styr månaden för en TOM väljare, `tidigast` gör dagar före den ovalbara.
 * ⛔ Datumen är fasta (juli 2027), aldrig "idag". Juli 2027 ligger långt från provets "idag", så en väljare som öppnar på idag är röd.
 */

/** @param {any} extra */
function oppna(extra) {
  render(<OpsDatePicker onChange={() => {}} ariaLabel="Slutdatum" {...extra} />);
  fireEvent.click(screen.getByRole("button", { name: "Slutdatum" }));
}
const ruta = (/** @type {string} */ d) => document.body.querySelector(`[data-day="${d}"]`);

describe("OpsDatePicker: oppnaPa och tidigast", () => {
  it("en tom väljare med oppnaPa öppnar på den månaden", () => {
    oppna({ oppnaPa: "2027-07-02" });
    expect(ruta("2027-07-15")).not.toBeNull();
  });

  it("anropar onManadVisas med oppnaPas månad", () => {
    const visas = vi.fn();
    oppna({ oppnaPa: "2027-07-02", onManadVisas: visas });
    expect(visas).toHaveBeenCalledWith("2027-07-01");
  });

  it("en väljare med värde ignorerar oppnaPa", () => {
    oppna({ value: "2026-03-10", oppnaPa: "2027-07-02" });
    expect(ruta("2026-03-15")).not.toBeNull();
    expect(ruta("2027-07-15")).toBeNull();
  });

  it("tidigast gör dagar före den ovalbara och dagen själv valbar", () => {
    const valt = vi.fn();
    oppna({ oppnaPa: "2027-07-02", tidigast: "2027-07-02", onChange: valt });
    const fore = /** @type {HTMLButtonElement} */ (ruta("2027-07-01")?.querySelector("button"));
    const samma = /** @type {HTMLButtonElement} */ (ruta("2027-07-02")?.querySelector("button"));
    expect(fore.disabled).toBe(true);
    expect(samma.disabled).toBe(false);
    fireEvent.click(samma);
    expect(valt).toHaveBeenCalledWith("2027-07-02");
  });

  it("kastar för en oppnaPa som inte är en ISO-dag", () => {
    expect(() => render(<OpsDatePicker onChange={() => {}} oppnaPa="2 juli" />)).toThrow(/oppnaPa/);
  });
});
