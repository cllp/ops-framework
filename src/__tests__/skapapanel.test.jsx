import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsSkapaI } from "../components/OpsSkapaI.jsx";
import { ALLA_GRUPPER } from "../lib/grupplage.js";

/**
 * Skapa är en panel, inte en modal, och "Skapa i" som SS (0.31.0, avsnitt 16, CP 2026-09-29).
 *
 * ⛔ Ritningen (helskärm under md, fast knapprad, 880 px) mäts i Chromium, check-skalyta avsnitt 15. Här mäts beteendet:
 * att formuläret inte ligger i en dialog, att Tillbaka återställer vyn, att målet visas och byts, och att läget "Alla" frågar
 * först. Varje prov är rött på 0.30.1, där formuläret låg i en `role="dialog"` och ingen väljare fanns.
 */

const grupper = [
  { id: "g1", namn: { sv: "Alfa AB" }, medlemsantal: 2 },
  { id: "g2", namn: { sv: "Beta AB" }, medlemsantal: 5 },
];

/** @param {{ groupId: string | null, formId?: string, mal?: any }} props */
function Form({ groupId, formId, mal }) {
  return (
    <form id={formId} data-testid="formular">
      <p data-testid="props">{`groupId=${groupId} mal=${mal ? mal.id : "-"}`}</p>
    </form>
  );
}

/** @param {{ lage?: string, aktiv?: string, skapa?: object }} [o] */
function skal({ lage = "g1", aktiv = "g1", skapa = {} } = {}) {
  return render(
    <OpsAppShell
      brand="Ops"
      nav={[{ href: "/", label: "Start" }]}
      activeHref="/"
      grupper={{ lista: grupper, aktiv, onValj: () => {} }}
      skapa={{ handelse: { form: Form, katalog: null }, lage, ...skapa }}
    >
      <p>appens vy</p>
    </OpsAppShell>,
  );
}

const oppnaSkapa = () => {
  fireEvent.click(screen.getByRole("button", { name: "Skapa" }));
  fireEvent.click(screen.getByRole("button", { name: "Ny händelse" }));
};

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("panelen i stället för modalen", () => {
  it("formuläret ligger i en region med rubrik, inte i en dialog", () => {
    skal();
    oppnaSkapa();
    expect(screen.queryByRole("dialog")).toBeNull();
    const panel = screen.getByRole("region", { name: "Ny händelse" });
    expect(within(panel).getByTestId("formular")).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "Tillbaka" })).toBeTruthy();
  });

  it("Tillbaka återställer vyn man kom från", () => {
    skal();
    expect(screen.getByText("appens vy")).toBeVisible();
    oppnaSkapa();
    expect(screen.getByText("appens vy")).not.toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Tillbaka" }));
    expect(screen.queryByRole("region", { name: "Ny händelse" })).toBeNull();
    expect(screen.getByText("appens vy")).toBeVisible();
  });

  it("Avbryt gör detsamma som Tillbaka", () => {
    skal();
    oppnaSkapa();
    fireEvent.click(screen.getByRole("button", { name: "Avbryt" }));
    expect(screen.queryByRole("region", { name: "Ny händelse" })).toBeNull();
  });

  it("Spara i den fasta knappraden är kopplad till formuläret med formId", () => {
    skal({ skapa: { sparaEtikett: "Skicka in" } });
    oppnaSkapa();
    const spara = screen.getByRole("button", { name: "Skicka in" });
    expect(spara.getAttribute("type")).toBe("submit");
    expect(spara.getAttribute("form")).toBe(screen.getByTestId("formular").id);
    expect(spara.getAttribute("form")).toBeTruthy();
  });

  it("utan sparaEtikett ritas ingen Spara: formuläret har egen knapp", () => {
    skal();
    oppnaSkapa();
    expect(screen.queryByRole("button", { name: /Spara|Skicka/ })).toBeNull();
  });

  it("adressen bär ?skapa= medan panelen är öppen och tappar den efter Tillbaka", async () => {
    skal();
    oppnaSkapa();
    expect(new URL(window.location.href).searchParams.get("skapa")).toBe("handelse");
    fireEvent.click(screen.getByRole("button", { name: "Tillbaka" }));
    await waitFor(() => expect(new URL(window.location.href).searchParams.has("skapa")).toBe(false));
  });

  it("en adress med ?skapa=handelse öppnar panelen vid inläsning", () => {
    window.history.replaceState(null, "", "/?skapa=handelse");
    skal();
    expect(screen.getByRole("region", { name: "Ny händelse" })).toBeTruthy();
  });
});

describe("Skapas i", () => {
  it("visar den aktiva gruppen och skickar den till formuläret", () => {
    skal();
    oppnaSkapa();
    const panel = screen.getByRole("region", { name: "Ny händelse" });
    expect(within(panel).getByRole("button", { name: "Skapas i: Alfa AB" })).toBeTruthy();
    expect(within(panel).getByTestId("props").textContent).toBe("groupId=g1 mal=-");
  });

  it("raden öppnar väljaren, och ett val byter målet", () => {
    skal();
    oppnaSkapa();
    fireEvent.click(screen.getByRole("button", { name: "Skapas i: Alfa AB" }));
    const dialog = screen.getByRole("dialog", { name: "Skapa i" });
    // den aktiva raden är vald (accentkant), och en annan går att välja
    expect(within(dialog).getByRole("button", { name: /Alfa AB/ }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(dialog).getByRole("button", { name: /Beta AB/ }));
    const panel = screen.getByRole("region", { name: "Ny händelse" });
    expect(within(panel).getByRole("button", { name: "Skapas i: Beta AB" })).toBeTruthy();
    expect(within(panel).getByTestId("props").textContent).toBe("groupId=g2 mal=g2");
  });

  it("i läget Alla visas väljaren FÖRST, panelen först efter ett val", () => {
    skal({ lage: ALLA_GRUPPER, aktiv: ALLA_GRUPPER });
    oppnaSkapa();
    expect(screen.getByRole("dialog", { name: "Skapa i" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Ny händelse" })).toBeNull();
    fireEvent.click(within(screen.getByRole("dialog", { name: "Skapa i" })).getByRole("button", { name: /Beta AB/ }));
    const panel = screen.getByRole("region", { name: "Ny händelse" });
    expect(within(panel).getByTestId("props").textContent).toBe("groupId=g2 mal=g2");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Avbryt i den första väljaren avbryter hela skapandet", () => {
    skal({ lage: ALLA_GRUPPER, aktiv: ALLA_GRUPPER });
    oppnaSkapa();
    fireEvent.click(within(screen.getByRole("dialog", { name: "Skapa i" })).getByRole("button", { name: "Avbryt" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("region", { name: "Ny händelse" })).toBeNull();
    expect(screen.getByText("appens vy")).toBeVisible();
  });

  it("appens egna mål (kalendrar) får en egen sektion och når formuläret som mal", () => {
    const skapaISektioner = [{ id: "kalendrar", rubrik: "Mina kalendrar", poster: [{ id: "k1", namn: "Semester" }] }];
    skal({ lage: ALLA_GRUPPER, aktiv: ALLA_GRUPPER, skapa: { skapaISektioner } });
    oppnaSkapa();
    const dialog = screen.getByRole("dialog", { name: "Skapa i" });
    expect(within(dialog).getByText("Mina kalendrar")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: /Semester/ }));
    const panel = screen.getByRole("region", { name: "Ny händelse" });
    expect(within(panel).getByTestId("props").textContent).toBe("groupId=null mal=k1");
    expect(within(panel).getByRole("button", { name: "Skapas i: Semester" })).toBeTruthy();
  });
});

describe("OpsSkapaI", () => {
  it("ritar Grupper med antal och en vald rad, och ett tomt läge säger det", () => {
    const { rerender } = render(<OpsSkapaI open onOpenChange={() => {}} grupper={grupper} vald="g2" onValj={() => {}} />);
    const dialog = screen.getByRole("dialog", { name: "Skapa i" });
    expect(within(dialog).getByText("Grupper")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: /Beta AB/ }).getAttribute("aria-pressed")).toBe("true");
    expect(within(dialog).getByRole("button", { name: /Alfa AB/ }).getAttribute("aria-pressed")).toBe("false");
    rerender(<OpsSkapaI open onOpenChange={() => {}} grupper={[]} onValj={vi.fn()} />);
    expect(screen.getByText("Inga destinationer tillgängliga.")).toBeTruthy();
  });
});

describe("skapa.arende: nod eller funktion (0.31.1)", () => {
  /** @param {object} skapa */
  const skalArende = (skapa) =>
    render(
      <OpsAppShell brand="Ops" nav={[{ href: "/", label: "Start" }]} activeHref="/" grupper={{ lista: grupper, aktiv: "g1", onValj: () => {} }} skapa={{ lage: "g1", ...skapa }}>
        <p>appens vy</p>
      </OpsAppShell>,
    );
  const oppnaArende = () => {
    fireEvent.click(screen.getByRole("button", { name: "Skapa" }));
    fireEvent.click(screen.getByRole("button", { name: "Nytt ärende" }));
  };

  it("en funktion får `formId` och `mal`, och panelens Spara pekar på samma formulär", () => {
    skalArende({
      arende: ({ formId, mal }) => (
        <form id={formId} data-testid="arendeform">
          <p>{`mal=${mal === null ? "inget" : mal.id}`}</p>
        </form>
      ),
      sparaEtikett: "Skicka in",
    });
    oppnaArende();
    const form = screen.getByTestId("arendeform");
    expect(form.id).toBeTruthy();
    const spara = screen.getByRole("button", { name: "Skicka in" });
    expect(spara.getAttribute("type")).toBe("submit");
    expect(spara.getAttribute("form")).toBe(form.id);
    expect(screen.getByRole("region", { name: "Nytt ärende" })).toBeTruthy();
    expect(screen.getByText("mal=inget")).toBeTruthy();
  });

  it("en funktion får använda hooks", () => {
    skalArende({
      arende: ({ formId }) => {
        const [v] = useState("hook-ok");
        return <form id={formId}>{v}</form>;
      },
    });
    oppnaArende();
    expect(screen.getByText("hook-ok")).toBeTruthy();
  });

  it("en färdig nod fungerar som förut, men utan död Spara (noden kan inte få `formId`)", () => {
    skalArende({ arende: <form data-testid="nodform">nod</form>, sparaEtikett: "Skicka in" });
    oppnaArende();
    expect(screen.getByTestId("nodform")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Skicka in" })).toBeNull();
    expect(screen.getByRole("button", { name: "Avbryt" })).toBeTruthy();
  });
});
