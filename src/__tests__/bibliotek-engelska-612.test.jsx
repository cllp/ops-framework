import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";

/*
 * 0.251.0, cllp/ops-framework#612. CP 2026-11-17, med engelska valt i appen: "Har engelska i systemet men modulen Bibliotek är på svenska".
 * På samma skärm stod "Search...", "Paste" och "Tags" på engelska och rubriken "Bibliotek", knappen "Ny" och "Biblioteket är tomt." på
 * svenska: de tre senare var skrivna direkt i komponenten. Provet ritar det tomma biblioteket på engelska och på svenska. Den svenska
 * texten är densamma som före 0.251.0, så att proven som letar efter den förblir gröna.
 */

/** @param {{ sprak: "sv" | "en" }} p */
function Vy({ sprak }) {
  return (
    <OpsSprakProvider sprak={sprak}>
      <OpsBibliotek
        poster={[]}
        fel={null}
        jag={{ uid: "uid-1", roll: "medlem" }}
        vald={null}
        skapar={null}
        onOppna={() => {}}
        onStang={() => {}}
        onSkapa={() => {}}
        onSpara={() => {}}
        hubHref="/hub"
      />
    </OpsSprakProvider>
  );
}

describe("Biblioteket följer språket (#612)", () => {
  it("på engelska: rubriken, Ny-knappen och det tomma läget", async () => {
    const user = userEvent.setup();
    render(<Vy sprak="en" />);
    expect(screen.getByRole("heading", { name: "Library" })).toBeInTheDocument();
    const ny = screen.getByRole("button", { name: "New item" });
    expect(ny).toHaveTextContent("New");
    expect(screen.getByText("The library is empty.")).toBeInTheDocument();
    expect(screen.getByText("Add a note, a link, a recording or a file.")).toBeInTheDocument();
    expect(screen.queryByText("Biblioteket är tomt.")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Bibliotek" })).toBeNull();
    // Menyn bakom Ny: typerna på engelska.
    await user.click(ny);
    for (const namn of ["Note", "Link", "File", "List"]) expect(screen.getByRole("menuitem", { name: namn })).toBeInTheDocument();
  });

  it("på svenska: samma text som före 0.251.0", () => {
    render(<Vy sprak="sv" />);
    expect(screen.getByRole("heading", { name: "Bibliotek" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ny post" })).toHaveTextContent("Ny");
    expect(screen.getByText("Biblioteket är tomt.")).toBeInTheDocument();
    expect(screen.getByText("Lägg till en anteckning, en länk, ett ljud eller en fil.")).toBeInTheDocument();
  });
});
