import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OpsModulTyper } from "../components/OpsModulTyper.jsx";
import { OpsRadioGroup } from "../components/OpsRadioGroup.jsx";
import { defineModule } from "../lib/modul.js";
import { bidragForGrupp, typerForGrupp, typerTillValg } from "../lib/modultyper.js";

/**
 * Typerna modulerna bidrar med, som vyerna ritar dem (0.42.0, #217). Hur det SER UT mäts i `check-skalyta` avsnitt 37 (jsdom kör ingen
 * CSS), här mäts vad vyn gör: vad den skriver ut, vad den skickar till `onAndra` och vad den vägrar.
 */

const ekonomi = defineModule({
  id: "ekonomi",
  namn: { sv: "Ekonomi", en: "Economy" },
  nav: [], routes: [], samlingar: [], kallor: {}, skapar: [], hubb: null,
  typer: { inkorg: [{ id: "uppdatering", namn: { sv: "Ekonomisk uppdatering" } }, { id: "kvitto", namn: { sv: "Kvitto, utlägg" } }] },
});
const sammanhang = (over = {}) => ({ bas: [], moduler: [ekonomi], modulerPa: ["ekonomi"], avvikelser: [], ...over });
const rita = (props = {}, ctx = sammanhang()) => render(<OpsModulTyper yta="inkorg" bidrag={bidragForGrupp("inkorg", ctx)} kanAndra onAndra={() => {}} {...props} />);

describe("OpsModulTyper", () => {
  it("⛔ varje bidrag bär märket «från Ekonomi»", () => {
    rita();
    expect(screen.getAllByText("från Ekonomi")).toHaveLength(2);
    expect(screen.getByText("Ekonomisk uppdatering")).toBeTruthy();
  });

  it("⛔ tomhet är ett svar: en grupp utan bidrag får en rad som säger det", () => {
    rita({}, sammanhang({ modulerPa: [] }));
    expect(screen.getByText(/Ingen modul i den här gruppen bidrar med typer/)).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("Dölj skickar det önskade tillståndet, och ett dolt bidrag får Visa och märket «dold»", () => {
    const onAndra = vi.fn();
    const { unmount } = rita({ onAndra });
    fireEvent.click(screen.getAllByRole("button", { name: /Dölj/ })[0]);
    expect(onAndra).toHaveBeenCalledWith({ yta: "inkorg", id: "ekonomi:uppdatering", dold: true, namn: null });
    unmount();

    const onAndra2 = vi.fn();
    rita({ onAndra: onAndra2 }, sammanhang({ avvikelser: [{ yta: "inkorg", id: "ekonomi:uppdatering", dold: true }] }));
    expect(screen.getByText("från Ekonomi, dold")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Visa/ }));
    expect(onAndra2).toHaveBeenCalledWith({ yta: "inkorg", id: "ekonomi:uppdatering", dold: false, namn: null });
  });

  it("Byt namn öppnar ett formulär, Spara skickar det egna namnet, och tomt namn återställer modulens", () => {
    const onAndra = vi.fn();
    rita({ onAndra });
    fireEvent.click(screen.getAllByRole("button", { name: /Byt namn/ })[0]);
    fireEvent.change(document.querySelector('input[name="typnamn-sv"]'), { target: { value: "Pengar" } });
    fireEvent.change(document.querySelector('input[name="typnamn-en"]'), { target: { value: "Money" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    expect(onAndra).toHaveBeenCalledWith({ yta: "inkorg", id: "ekonomi:uppdatering", dold: false, namn: { sv: "Pengar", en: "Money" } });

    onAndra.mockClear();
    fireEvent.click(screen.getAllByRole("button", { name: /Byt namn/ })[0]);
    fireEvent.change(document.querySelector('input[name="typnamn-sv"]'), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    expect(onAndra).toHaveBeenCalledWith({ yta: "inkorg", id: "ekonomi:uppdatering", dold: false, namn: null });
  });

  it("⛔ utan kanAndra finns inga knappar, och vyn säger att den inte är låset", () => {
    rita({ kanAndra: false });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/Du kan läsa listan, inte ändra den/)).toBeTruthy();
  });

  it("det finns ingen knapp för att lägga till ett bidrag: ett modul-id hittas inte på", () => {
    rita();
    expect(screen.queryByRole("button", { name: /Lägg till|Ny typ/i })).toBeNull();
  });

  it("vägrar monteras utan lista och utan yta", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsModulTyper yta="inkorg" bidrag={/** @type {any} */ (undefined)} />)).toThrow(/bidrag krävs/);
    expect(() => render(<OpsModulTyper bidrag={[]} />)).toThrow(/yta krävs/);
    tyst.mockRestore();
  });
});

describe("valen i ett skapa-formulär", () => {
  it("⛔ typerTillValg i OpsRadioGroup skriver märket under bidragen och ingenting under de egna", () => {
    const bas = [{ id: "arende", namn: { sv: "Ärende" }, farg: null, ikon: "inbox", fas: null, ordning: 0, arkiverad: false, texter: {}, groupId: "g" }];
    render(<OpsRadioGroup options={typerTillValg(typerForGrupp("inkorg", sammanhang({ bas })))} value="arende" onChange={() => {}} ariaLabel="Typ" />);
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getAllByText("från Ekonomi")).toHaveLength(2);
    expect(screen.getByRole("radio", { name: /^Ärende$/ })).toBeTruthy();
  });
});

describe("⛔ rubriken på samma nivå som katalogernas (0.44.0, bolag-ops#507)", () => {
  it("nivå 2, och sektionen bär den som namn", () => {
    rita({ rubrik: "Inkorgens typer från moduler" });
    expect(screen.getByRole("heading", { level: 2, name: "Inkorgens typer från moduler" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Inkorgens typer från moduler" })).toBeTruthy();
  });
});
