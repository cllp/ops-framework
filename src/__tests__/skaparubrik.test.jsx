import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsKalendrar } from "../components/OpsKalendrar.jsx";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { OpsSkapaPanel } from "../components/OpsSkapaPanel.jsx";
import { OpsSkapaRubrik } from "../components/OpsSkapaRubrik.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla } from "../data/samtalskalla.js";
import { byggPost } from "../lib/bibliotek.js";
import { byggMinKalender } from "../lib/kalendrar.js";

/**
 * Skapa-vyns rubrik är text. Plusknappen hör till ingången.
 *
 * Händelsen: CP 2026-10-09. Efter ett tryck på "+ Nytt meddelande" stod pluscirkeln
 * kvar i compose-huvudet, och den såg ut som en knapp till. Samma regel i de andra
 * skapa-vyerna: Ny händelse, Ny anteckning, Ny kalender.
 *
 * jsdom mäter att pluset inte är en kontroll i vyn. Hur raden ser ut i pixlar mäts
 * inte här.
 */

function rubrikUtanPlus(/** @type {HTMLElement} */ rubrik) {
  expect(rubrik.closest("button")).toBeNull();
  expect(rubrik.querySelector("svg")).toBeNull();
  expect(rubrik.parentElement?.querySelector(":scope > .rounded-full")).toBeNull();
  expect(rubrik).toHaveAttribute("data-skapa-rubrik", "");
}

describe("skapa-vyns rubrik", () => {
  it("Nytt meddelande: pluset finns bara i listan, compose visar en vanlig rubrik och Tillbaka", async () => {
    render(
      <OpsMeddelanden
        kalla={createSamtalskalla({ kalla: createMemorySource({}) })}
        uid="anna"
        groupId="g"
        gruppNamn="Alfa"
        medlemmar={[]}
      />,
    );
    const lista = /** @type {HTMLElement} */ (document.querySelector("[data-samtalslista]"));
    const knapp = within(lista).getByRole("button", { name: "Nytt meddelande" });
    expect(knapp.querySelector("svg")).not.toBeNull();
    await userEvent.setup().click(knapp);

    const nytt = /** @type {HTMLElement} */ (document.querySelector("[data-ops-nytt]"));
    const region = screen.getByRole("region", { name: "Nytt meddelande" });
    const huvud = /** @type {HTMLElement} */ (nytt.querySelector("header"));
    rubrikUtanPlus(within(huvud).getByRole("heading", { level: 3, name: "Nytt meddelande" }));
    expect(within(huvud).queryByRole("button")).toBeNull();
    expect(huvud.querySelector("svg")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Nytt meddelande" })).toEqual([knapp]);
    expect(nytt.contains(knapp)).toBe(false);
    expect(within(region).getByRole("button", { name: "Tillbaka" })).toBeTruthy();
  });

  it("Ny händelse: panelens rubrik är text, utan pluscirkel, och Tillbaka finns", () => {
    render(
      <OpsSkapaPanel titel="Ny händelse" onTillbaka={() => {}}>
        <p>formulär</p>
      </OpsSkapaPanel>,
    );
    const panel = screen.getByRole("region", { name: "Ny händelse" });
    rubrikUtanPlus(within(panel).getByRole("heading", { level: 2, name: "Ny händelse" }));
    expect(within(panel).queryByRole("button", { name: "Ny händelse" })).toBeNull();
    expect(within(panel).getByRole("button", { name: "Tillbaka" })).toBeTruthy();
  });

  it("Ny anteckning: pluset Ny finns i listan, och skapa-vyn har en vanlig rubrik och Tillbaka", () => {
    function Harness() {
      const [skapar, setSkapar] = useState(/** @type {"anteckning" | "lank" | "fil" | null} */ (null));
      return (
        <OpsBibliotek
          poster={[]}
          jag={{ uid: "uid-1", roll: "medlem" }}
          vald={null}
          skapar={skapar}
          onOppna={() => {}}
          onStang={() => setSkapar(null)}
          onSkapa={(typ) => setSkapar(typ)}
          onSpara={() => {}}
          hubHref="/hub"
        />
      );
    }
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Ny post" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ny post" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Anteckning" }));
    const detalj = /** @type {HTMLElement} */ (document.querySelector("[data-bibliotek-detalj]"));
    const rubrik = within(detalj).getByRole("heading", { name: "Ny anteckning" });
    expect(rubrik.closest("button")).toBeNull();
    expect(within(detalj).queryByRole("button", { name: /Ny anteckning|Ny post/ })).toBeNull();
    expect(within(detalj).getByRole("button", { name: "Tillbaka" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ny post" })).toBeNull();
  });

  it("Ny kalender: plusknappen försvinner när formuläret är öppet, och titeln är inte en knapp", () => {
    render(
      <OpsKalendrar
        groupId="g"
        gruppens={[]}
        mina={[byggMinKalender({ id: "privat", namn: "Privat", farg: 2, ikon: "hjarta" })]}
        kanAndraGruppens={false}
        onSparaGruppens={() => {}}
        onSparaMina={() => {}}
      />,
    );
    const sektion = screen.getByRole("region", { name: "Mina kalendrar" });
    fireEvent.click(within(sektion).getByRole("button", { name: "Ny kalender" }));
    const red = /** @type {HTMLElement} */ (sektion.querySelector("[data-kalenderredigerare]"));
    expect(within(sektion).queryByRole("button", { name: "Ny kalender" })).toBeNull();
    const titel = within(red).getByText("Ny kalender");
    expect(titel.closest("button")).toBeNull();
    expect(titel.closest("[data-skapa-rubrik], p, h2, h3")).toBe(titel);
  });

  it("en okänd variant kastas, den blir inte en tyst panelrubrik", () => {
    expect(() => render(<OpsSkapaRubrik variant={/** @type {any} */ ("knapp")}>Ny</OpsSkapaRubrik>)).toThrow(/okänd variant/);
  });
});
