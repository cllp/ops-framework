import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsAppShell, useOppnaSkapa } from "../components/OpsAppShell.jsx";

/**
 * 0.34.1: `?skapa=` för en post som kommer SENT, och `useOppnaSkapa()`.
 *
 * ⛔ Händelsen: appens "Nytt meddelande" gjorde `location.assign(pathname + "?skapa=meddelande")`, men skalet läste adressen
 * bara vid monteringen, och `skapa.meddelande` skickas in först när samtalskällan finns. Panelen öppnades aldrig.
 */

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

const meddelande = () => ({ formId, groupId }) => <form id={formId} aria-label="Meddelandeformulär"><p>grupp {String(groupId)}</p></form>;

function Skal({ skapa, barn = <p>appens vy</p> }) {
  return (
    <OpsAppShell brand="Ops" nav={[{ href: "/", label: "Start" }]} activeHref="/" skapa={skapa}>
      {barn}
    </OpsAppShell>
  );
}

const grund = { sparaEtikett: "Spara", skickaEtikett: "Skicka", lage: "g" };
const panelen = () => screen.queryByRole("region", { name: "Nytt meddelande" });

describe("⛔ en skapa-post som dyker upp efter monteringen", () => {
  it("öppnar panelen när posten kommer och adressen bär ?skapa=meddelande", async () => {
    window.history.replaceState(null, "", "/?skapa=meddelande");
    // Ett annat plusrad finns redan (arende), meddelande saknas vid monteringen.
    const { rerender } = render(<Skal skapa={{ ...grund, arende: <p>ärende</p> }} />);
    expect(panelen()).toBeNull();
    rerender(<Skal skapa={{ ...grund, arende: <p>ärende</p>, meddelande: meddelande() }} />);
    await waitFor(() => expect(panelen()).not.toBeNull());
  });

  it("en användare som stängt panelen får den inte tillbaka vid en senare omrendering", async () => {
    window.history.replaceState(null, "", "/?skapa=meddelande");
    const skapa1 = { ...grund, arende: <p>ärende</p> };
    const { rerender } = render(<Skal skapa={skapa1} />);
    rerender(<Skal skapa={{ ...skapa1, meddelande: meddelande() }} />);
    await waitFor(() => expect(panelen()).not.toBeNull());
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Avbryt|Stäng/ }));
    await waitFor(() => expect(panelen()).toBeNull());
    await act(async () => {});
    // En ny nyckel dyker upp och skalet renderas om: panelen ska förbli stängd.
    rerender(<Skal skapa={{ ...skapa1, meddelande: meddelande(), grupp: () => <p>g</p> }} />);
    await act(async () => {});
    expect(panelen()).toBeNull();
    expect(new URL(window.location.href).searchParams.has("skapa")).toBe(false);
  });
});

describe("useOppnaSkapa", () => {
  function Knapp({ nyckel = "meddelande" }) {
    const oppna = useOppnaSkapa();
    return <button type="button" onClick={() => oppna(nyckel)}>Öppna via hook</button>;
  }

  it("öppnar panelen inuti skalet och sätter ?skapa=meddelande", async () => {
    render(<Skal skapa={{ ...grund, meddelande: meddelande() }} barn={<Knapp />} />);
    expect(panelen()).toBeNull();
    await userEvent.setup().click(screen.getByRole("button", { name: "Öppna via hook" }));
    await waitFor(() => expect(panelen()).not.toBeNull());
    expect(new URL(window.location.href).searchParams.get("skapa")).toBe("meddelande");
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
