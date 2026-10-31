import { render, screen, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useState } from "react";
import { OpsSkapaPanel } from "../components/OpsSkapaPanel.jsx";
import { DoljNarKlar, useSkapaPanelKlar } from "../components/skapaPanelStatus.js";

function Formular({ klar }) {
  useSkapaPanelKlar(klar);
  return <p>formulär</p>;
}

describe("#538 skalets val göms under kvittot", () => {
  it("DoljNarKlar och knappraden försvinner när formuläret är klart", () => {
    let satt;
    function Prov() {
      const [klar, setKlar] = useState(false);
      satt = setKlar;
      return (
        <OpsSkapaPanel titel="Ny" onTillbaka={() => {}} sparaEtikett="Spara" formId="f">
          <Formular klar={klar} />
          <DoljNarKlar><p>Kräv svar</p></DoljNarKlar>
        </OpsSkapaPanel>
      );
    }
    render(<Prov />);
    expect(screen.getByText("Kräv svar")).toBeInTheDocument();
    expect(screen.getByText("Spara")).toBeInTheDocument();
    act(() => satt(true));
    expect(screen.queryByText("Kräv svar")).toBeNull();
    expect(screen.queryByText("Spara")).toBeNull();
    act(() => satt(false));
    expect(screen.getByText("Kräv svar")).toBeInTheDocument();
  });
  it("utanför en panel visas innehållet", () => {
    render(<DoljNarKlar><p>x</p></DoljNarKlar>);
    expect(screen.getByText("x")).toBeInTheDocument();
  });
});

import { fireEvent } from "@testing-library/react";
import { OpsInspelning } from "../components/OpsTalk.jsx";

describe("#540 frågan Kasta? stängs när vyn byts", () => {
  it("byter vy, frågan försvinner och inspelningen står kvar", () => {
    const p = { lage: "lyssnar", niva: 0, sekunder: 30, tak: 120, onAvbryt: () => {}, onKlar: () => {} };
    const { rerender } = render(<OpsInspelning {...p} vy="/idag" />);
    fireEvent.click(document.querySelector("[data-talk-avbryt]"));
    expect(document.querySelector('[data-inspelning="fraga"]')).not.toBeNull();
    rerender(<OpsInspelning {...p} vy="/bibliotek" />);
    expect(document.querySelector('[data-inspelning="fraga"]')).toBeNull();
  });
});
