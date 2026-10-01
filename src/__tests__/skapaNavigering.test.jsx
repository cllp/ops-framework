import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsAppShell, useOppnaSkapa } from "../components/OpsAppShell.jsx";

/**
 * 0.38.0 (#194): skapa-panelen låste all annan navigering.
 *
 * ⛔ Händelsen: CP 2026-09-30: "Nytt ärende-panelen låser all annan navigering i appen. Samma sak med Ny händelse. Topnav
 * (Idag/Kalender/Hub) och övrigt går inte att använda medan panelen är uppe." Panelen är ingen dialog och ingenting är `inert`:
 * länkarna var klickbara och appen navigerade, men skalet höll `skapaForm` kvar, och appens vy ligger DOLD medan panelen visas.
 * Adressen bytte sida och skärmen stod still. Provet mäter det en person ser: klicket stänger panelen och appens nya vy syns.
 */

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

const nav = [
  { href: "/", label: "Idag" },
  { href: "/kalender", label: "Kalender" },
];

function OppnaKnapp() {
  const oppna = useOppnaSkapa();
  return (
    <button type="button" onClick={() => oppna("arende")}>
      Öppna ärende
    </button>
  );
}

/** En app som byter vy ur `activeHref`, som en riktig router. `foljAdress` styr om `activeHref` uppdateras vid klick. */
function App({ foljAdress = true, extraActions = null }) {
  const [href, setHref] = useState("/");
  return (
    <OpsAppShell
      brand="Ops"
      nav={nav}
      activeHref={href}
      onNavigate={(h, e) => {
        e.preventDefault();
        if (foljAdress) setHref(h);
      }}
      skapa={{ arende: <p>Ärendeformulär</p>, sparaEtikett: "Spara", lage: "g" }}
      actions={extraActions ? extraActions({ gaTill: setHref }) : undefined}
    >
      <p>{href === "/" ? "Idag-vyn" : "Kalender-vyn"}</p>
      <OppnaKnapp />
    </OpsAppShell>
  );
}

const panelen = () => screen.queryByRole("region", { name: "Nytt ärende" });
const toppnav = () => screen.getAllByRole("navigation").find((n) => n.closest("header"));

async function oppnaPanelen(user) {
  await user.click(screen.getByRole("button", { name: "Öppna ärende" }));
  await waitFor(() => expect(panelen()).not.toBeNull());
}

describe("⛔ #194: att navigera medan skapa-panelen är öppen stänger den", () => {
  it("klick på en flik i toppnavigeringen stänger panelen och visar den nya vyn", async () => {
    const user = userEvent.setup();
    render(<App />);
    await oppnaPanelen(user);
    expect(new URL(window.location.href).searchParams.get("skapa")).toBe("arende");
    const kalender = Array.from(toppnav().querySelectorAll("a")).find((a) => a.textContent === "Kalender");
    await user.click(/** @type {HTMLElement} */ (kalender));
    await waitFor(() => expect(panelen()).toBeNull());
    expect(screen.getByText("Kalender-vyn").closest("[hidden]")).toBeNull();
    // Posten i adressen följer med, annars öppnar en omladdning panelen igen.
    expect(new URL(window.location.href).searchParams.has("skapa")).toBe(false);
  });

  it("klick på flik för SAMMA sida som man står på stänger också panelen (adressen ändras inte, så den räcker inte som signal)", async () => {
    const user = userEvent.setup();
    render(<App />);
    await oppnaPanelen(user);
    const idag = Array.from(toppnav().querySelectorAll("a")).find((a) => a.textContent === "Idag");
    await user.click(/** @type {HTMLElement} */ (idag));
    await waitFor(() => expect(panelen()).toBeNull());
    expect(screen.getByText("Idag-vyn").closest("[hidden]")).toBeNull();
  });

  it("en länk som skalet inte hör klicket på (en ikon i actions) stänger panelen när appens aktiva adress byts", async () => {
    const user = userEvent.setup();
    render(
      <App
        extraActions={({ gaTill }) => (
          <button type="button" onClick={() => gaTill("/kalender")}>
            Inkorg
          </button>
        )}
      />,
    );
    await oppnaPanelen(user);
    await user.click(screen.getByRole("button", { name: "Inkorg" }));
    await waitFor(() => expect(panelen()).toBeNull());
    expect(screen.getByText("Kalender-vyn").closest("[hidden]")).toBeNull();
  });

  it("Tillbaka stänger fortfarande panelen, utan att något navigeras", async () => {
    const user = userEvent.setup();
    render(<App />);
    await oppnaPanelen(user);
    await user.click(screen.getByRole("button", { name: "Tillbaka" }));
    await waitFor(() => expect(panelen()).toBeNull());
    expect(screen.getByText("Idag-vyn").closest("[hidden]")).toBeNull();
  });
});
