import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsAppShell, useOppnaSkapa } from "../components/OpsAppShell.jsx";

/**
 * 0.34.1: `?skapa=` för en post som kommer SENT, och `useOppnaSkapa()`.
 *
 * ⛔ Händelsen: appens "Nytt meddelande" gjorde `location.assign(pathname + "?skapa=meddelande")`, men skalet läste adressen
 * bara vid monteringen, och `skapa.meddelande` skickas in först när samtalskällan finns. Panelen öppnades aldrig.
 *
 * ⛔ 0.63.0 (#263): "meddelande" öppnar ingen panel längre, den anropar `skapa.nyttMeddelande`. Den sena posten provas därför
 * med "Ny grupp", och meddelandets väg provas för sig längst ned.
 */

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

const grupp = () => ({ formId }) => <form id={formId} aria-label="Gruppformulär"><p>grupp</p></form>;

function Skal({ skapa, barn = <p>appens vy</p> }) {
  return (
    <OpsAppShell brand="Ops" nav={[{ href: "/", label: "Start" }]} activeHref="/" skapa={skapa}>
      {barn}
    </OpsAppShell>
  );
}

const grund = { sparaEtikett: "Spara", lage: "g" };
const panelen = () => screen.queryByRole("region", { name: "Ny grupp" });

describe("⛔ en skapa-post som dyker upp efter monteringen", () => {
  it("öppnar panelen när posten kommer och adressen bär ?skapa=grupp", async () => {
    window.history.replaceState(null, "", "/?skapa=grupp");
    // Ett annat plusrad finns redan (arende), grupp saknas vid monteringen.
    const { rerender } = render(<Skal skapa={{ ...grund, arende: <p>ärende</p> }} />);
    expect(panelen()).toBeNull();
    rerender(<Skal skapa={{ ...grund, arende: <p>ärende</p>, grupp: grupp() }} />);
    await waitFor(() => expect(panelen()).not.toBeNull());
  });

  it("en användare som stängt panelen får den inte tillbaka vid en senare omrendering", async () => {
    window.history.replaceState(null, "", "/?skapa=grupp");
    const skapa1 = { ...grund, arende: <p>ärende</p> };
    const { rerender } = render(<Skal skapa={skapa1} />);
    rerender(<Skal skapa={{ ...skapa1, grupp: grupp() }} />);
    await waitFor(() => expect(panelen()).not.toBeNull());
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Avbryt|Stäng/ }));
    await waitFor(() => expect(panelen()).toBeNull());
    await act(async () => {});
    // En ny nyckel dyker upp och skalet renderas om: panelen ska förbli stängd.
    rerender(<Skal skapa={{ ...skapa1, grupp: grupp(), arende: <p>ärende 2</p>, handelse: <p>h</p> }} />);
    await act(async () => {});
    expect(panelen()).toBeNull();
    expect(new URL(window.location.href).searchParams.has("skapa")).toBe(false);
  });
});

describe("useOppnaSkapa", () => {
  function Knapp({ nyckel = "grupp" }) {
    const oppna = useOppnaSkapa();
    return <button type="button" onClick={() => oppna(nyckel)}>Öppna via hook</button>;
  }

  it("öppnar panelen inuti skalet och sätter ?skapa=grupp", async () => {
    render(<Skal skapa={{ ...grund, grupp: grupp() }} barn={<Knapp />} />);
    expect(panelen()).toBeNull();
    await userEvent.setup().click(screen.getByRole("button", { name: "Öppna via hook" }));
    await waitFor(() => expect(panelen()).not.toBeNull());
    expect(new URL(window.location.href).searchParams.get("skapa")).toBe("grupp");
  });

  it("kastar ett tydligt fel utanför skalet", () => {
    const orig = console.error;
    console.error = () => {};
    try {
      expect(() => render(<Knapp />)).toThrow(/utanför OpsAppShell/);
    } finally {
      console.error = orig;
    }
  });

  it("kastar (tyst ingenting är förbjudet) när skalet inte har posten", async () => {
    let fel = null;
    function Prov() {
      const oppna = useOppnaSkapa();
      return <button type="button" onClick={() => { try { oppna("meddelande"); } catch (e) { fel = e; } }}>Prova</button>;
    }
    render(<Skal skapa={{ ...grund, arende: <p>ärende</p> }} barn={<Prov />} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Prova" }));
    expect(String(fel?.message)).toMatch(/ingen post för "meddelande"/);
  });
});

describe("⛔ meddelande öppnar ingen panel, den leder till Meddelanden i läget nytt (0.63.0, #263)", () => {
  function Knapp() {
    const oppna = useOppnaSkapa();
    return <button type="button" onClick={() => oppna("meddelande")}>Öppna via hook</button>;
  }
  const ingenPanel = () => expect(screen.queryByRole("region", { name: "Nytt meddelande" })).toBeNull();

  it("useOppnaSkapa()(\"meddelande\") anropar skapa.nyttMeddelande en gång, och adressen får ingen ?skapa", async () => {
    const nyttMeddelande = vi.fn();
    render(<Skal skapa={{ ...grund, nyttMeddelande }} barn={<Knapp />} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Öppna via hook" }));
    expect(nyttMeddelande).toHaveBeenCalledTimes(1);
    ingenPanel();
    expect(new URL(window.location.href).searchParams.has("skapa")).toBe(false);
  });

  it("adressens ?skapa=meddelande anropar den när posten kommer sent, en gång, och tas bort ur adressen", async () => {
    window.history.replaceState(null, "", "/?skapa=meddelande");
    const nyttMeddelande = vi.fn();
    const { rerender } = render(<Skal skapa={{ ...grund, arende: <p>ärende</p> }} />);
    expect(nyttMeddelande).not.toHaveBeenCalled();
    rerender(<Skal skapa={{ ...grund, arende: <p>ärende</p>, nyttMeddelande }} />);
    await waitFor(() => expect(nyttMeddelande).toHaveBeenCalledTimes(1));
    expect(new URL(window.location.href).searchParams.has("skapa")).toBe(false);
    rerender(<Skal skapa={{ ...grund, arende: <p>ärende</p>, nyttMeddelande, grupp: grupp() }} />);
    await act(async () => {});
    expect(nyttMeddelande).toHaveBeenCalledTimes(1);
    ingenPanel();
  });

  it("⛔ skapa.meddelande (0.34.0 till 0.62.0) kastar med vägen till skapa.nyttMeddelande, i stället för att raden tyst försvinner", () => {
    const orig = console.error;
    console.error = () => {};
    try {
      expect(() => render(<Skal skapa={{ ...grund, meddelande: () => <p>gammal panel</p> }} />)).toThrow(/skapa\.meddelande är borttagen i 0\.63\.0.*skapa\.nyttMeddelande/);
    } finally {
      console.error = orig;
    }
  });
});
