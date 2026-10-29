import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { OpsSkapaPanel } from "../components/OpsSkapaPanel.jsx";
import { useSkapaPanelKlar, useSkapaPanelStatus } from "../components/skapaPanelStatus.js";

/*
 * Formuläret säger att det är klart (0.153.0, cllp/ops-framework#460 punkt 4, lifehub.app QA-fynd 12c): "Panelens fasta Spara/Avbryt står kvar i kvittoläget."
 *
 * ⛔ RÖTT UTAN ÄNDRINGEN: `useSkapaPanelKlar` finns inte, och panelen ritar alltid sin knapprad.
 */

/** Ett formulär som sparar och sedan ritar ett kvitto med "Lägg in en till", som Nytt ärende i appen. */
function Formular() {
  const [sparad, setSparad] = useState(false);
  useSkapaPanelKlar(sparad);
  return sparad ? (
    <div data-kvitto="">
      <p>Det ligger i inkorgen.</p>
      <button type="button" onClick={() => setSparad(false)}>
        Lägg in en till
      </button>
    </div>
  ) : (
    <form
      id="nytt"
      onSubmit={(e) => {
        e.preventDefault();
        setSparad(true);
      }}
    >
      <input aria-label="Rubrik" />
    </form>
  );
}

const knappar = () => document.querySelector("[data-skapa-knappar]");

describe("klar-signalen till skapa-panelen", () => {
  it("⛔ Spara och Avbryt döljs när formuläret säger klar, och kommer tillbaka när det startar om", () => {
    render(
      <OpsSkapaPanel titel="Nytt ärende" onTillbaka={() => {}} sparaEtikett="Spara" formId="nytt">
        <Formular />
      </OpsSkapaPanel>,
    );
    expect(screen.getByRole("button", { name: "Spara" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Avbryt" })).toBeTruthy();
    fireEvent.submit(document.querySelector("form#nytt") ?? document.body);
    expect(screen.getByText("Det ligger i inkorgen.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Spara" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Avbryt" })).toBeNull();
    expect(knappar()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Lägg in en till" }));
    expect(screen.getByRole("button", { name: "Spara" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Avbryt" })).toBeTruthy();
  });

  it("⛔ vägen ut är kvar: Tillbaka högst upp och kvittots egen knapp", () => {
    render(
      <OpsSkapaPanel titel="Nytt ärende" onTillbaka={() => {}} sparaEtikett="Spara" formId="nytt">
        <Formular />
      </OpsSkapaPanel>,
    );
    fireEvent.submit(document.querySelector("form#nytt") ?? document.body);
    expect(screen.getByRole("button", { name: /Tillbaka/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Lägg in en till" })).toBeTruthy();
  });

  it("utan klar-signal ritas knappraden som förut", () => {
    render(
      <OpsSkapaPanel titel="Ny grupp" onTillbaka={() => {}} sparaEtikett="Spara" formId="x">
        <form id="x" />
      </OpsSkapaPanel>,
    );
    expect(knappar()).not.toBeNull();
  });

  it("utanför en panel gör anropet ingenting och svarar falskt, så formuläret behåller sitt eget kvitto", () => {
    /** @type {boolean | null} */
    let svar = null;
    /** @type {boolean | null} */
    let statusSvar = null;
    function Ensam() {
      svar = useSkapaPanelKlar(true);
      statusSvar = useSkapaPanelStatus(false, "x");
      return <p>Ensam</p>;
    }
    render(<Ensam />);
    expect(svar).toBe(false);
    expect(statusSvar).toBe(false);
  });

  it("väntan och klar är två signaler: en panel som väntar och sedan är klar visar varken Spara eller statusraden", () => {
    function Vantar() {
      const [steg, setSteg] = useState(0);
      useSkapaPanelStatus(steg === 1, "Sparar");
      useSkapaPanelKlar(steg === 2);
      return <button type="button" onClick={() => setSteg((s) => s + 1)}>Nästa</button>;
    }
    render(
      <OpsSkapaPanel titel="Nytt" onTillbaka={() => {}} sparaEtikett="Spara" formId="v">
        <Vantar />
      </OpsSkapaPanel>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Nästa" }));
    expect(document.querySelector("[data-skapa-status]")?.textContent).toBe("Sparar");
    fireEvent.click(screen.getByRole("button", { name: "Nästa" }));
    expect(knappar()).toBeNull();
    expect(document.querySelector("[data-skapa-status]")).toBeNull();
  });
});
