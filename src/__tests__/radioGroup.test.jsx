import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { OpsRadioGroup } from "../components/OpsRadioGroup.jsx";

const choice = [
  { value: "ekonomi", label: "Ekonomisk uppdatering", hint: "En siffra som ändrats." },
  { value: "kvitto", label: "Kvitto", hint: "Ett utlägg att bokföra." },
  { value: "arende", label: "Ärende" },
  { value: "ovrigt", label: "Övrigt" },
];

describe("OpsRadioGroup", () => {
  it("är nativa radioknappar, inte knappar med aria", () => {
    /*
     * ⛔ DET HÄR ÄR HELA POÄNGEN MED KOMPONENTEN.
     *
     * Nativa radios ger piltangentnavigering, gruppering, formulärsemantik och
     * "3 av 4" uppläst, gratis och korrekt. Skrivs de om till
     * `<button role="radio">` måste allt det byggas för hand, och den koden är
     * fel i något hörn i varje kodbas som har den, utan att det syns förrän
     * någon provar med tangentbord.
     */
    render(<OpsRadioGroup options={choice} value="ekonomi" onChange={() => {}} ariaLabel="Vad gäller det" />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);
    for (const r of radios) expect(r.tagName).toBe("INPUT");
    expect(screen.getByRole("radiogroup", { name: "Vad gäller det" })).toBeInTheDocument();
  });

  it("hör ihop som EN grupp, alltså delar name", () => {
    // ⛔ Utan gemensamt `name` är de fyra oberoende kryssrutor i radioskepnad:
    // piltangenterna hoppar inte mellan dem och två kan bli valda samtidigt.
    render(<OpsRadioGroup options={choice} value="ekonomi" onChange={() => {}} ariaLabel="Sort" />);
    const name = new Set(screen.getAllByRole("radio").map((r) => r.getAttribute("name")));
    expect(name.size).toBe(1);
    expect([...name][0]).toBeTruthy();
  });

  it("markerar det valda och bara det", () => {
    render(<OpsRadioGroup options={choice} value="kvitto" onChange={() => {}} ariaLabel="Sort" />);
    expect(screen.getByRole("radio", { name: /Kvitto/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Ärende/ })).not.toBeChecked();
  });

  it("svarar med värdet när man väljer", () => {
    const onChange = vi.fn();
    render(<OpsRadioGroup options={choice} value="ekonomi" onChange={onChange} ariaLabel="Sort" />);
    fireEvent.click(screen.getByRole("radio", { name: /Kvitto/ }));
    expect(onChange).toHaveBeenCalledWith("kvitto");
  });

  it("låter förklaringen ingå i alternativets namn", () => {
    // ⛔ Hinten ligger inuti etiketten, inte bredvid den. Ligger den utanför hörs
    // den inte när man stegar med piltangenter, och skillnaden mellan "Ärende"
    // och "Övrigt" finns bara i förklaringen.
    render(<OpsRadioGroup options={choice} value="ekonomi" onChange={() => {}} ariaLabel="Sort" />);
    expect(screen.getByRole("radio", { name: /En siffra som ändrats/ })).toBeInTheDocument();
  });

  it("kastar hellre än att visa ett val som inte är ett val", () => {
    // ⛔ Ett ensamt alternativ är inget val, och noll är ett tomt formulärfält
    // som ser ut att ladda.
    expect(() => render(<OpsRadioGroup options={[choice[0]]} value="a" onChange={() => {}} />)).toThrow(/minst två/);
    expect(() => render(<OpsRadioGroup options={[]} value="a" onChange={() => {}} />)).toThrow(/minst två/);
  });
});
