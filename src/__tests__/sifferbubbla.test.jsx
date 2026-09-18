import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { OpsStickySummary } from "../components/OpsStickySummary.jsx";

/**
 * ⛔ DET SOM PROVAS ÄR ATT DEN INTE FÖRSVINNER, INTE ATT DEN SYNS.
 *
 * En bubbla som går att fälla ihop har två sätt att gå sönder, och bara det ena
 * märks: att den inte fäller ihop, och att den fäller ihop till ingenting. Det
 * senare ser ut som en fungerande knapp ända tills någon vill ha tillbaka
 * siffran och inte hittar något att trycka på.
 *
 * ⛔ Färgerna går INTE att prova här. jsdom räknar ingen CSS, så ett prov som
 * påstår sig kontrollera att bubblan funkar i mörkt läge hade varit grönt oavsett.
 * Det som går att göra i stället är gjort: komponenten använder bara tokens
 * (`bg-raised`, `border-line`, `text-ink`, `text-success`, `text-danger`,
 * `shadow-lg`), och alla sex byter med temat i `tokens.css`. Ramverkets
 * `check-closed-api` fäller varje egen färg, och vyportvakten mäter mörkt läge
 * i en riktig webbläsare.
 */
describe("OpsStickySummary", () => {
  beforeEach(() => {
    try {
      globalThis.localStorage?.clear();
    } catch {
      // Inget minne, inget att rensa.
    }
  });

  it("visar namnet och siffran utfälld", () => {
    render(<OpsStickySummary label="Månadskassaflöde" value="+23 256 kr" />);
    expect(screen.getByText("Månadskassaflöde")).toBeInTheDocument();
    expect(screen.getByText("+23 256 kr")).toBeInTheDocument();
  });

  it("behåller siffran när den fälls ihop, och tappar bara namnet", () => {
    render(<OpsStickySummary label="Månadskassaflöde" value="+23 256 kr" />);
    fireEvent.click(screen.getByRole("button"));

    // ⛔ Det här är provets hela poäng: ihopfälld är inte borta.
    expect(screen.getByText("+23 256 kr")).toBeInTheDocument();
    expect(screen.queryByText("Månadskassaflöde")).not.toBeInTheDocument();
  });

  it("går att fälla ut igen", () => {
    render(<OpsStickySummary label="Netto" value="+1 kr" />);
    const knapp = screen.getByRole("button");
    fireEvent.click(knapp);
    fireEvent.click(knapp);
    expect(screen.getByText("Netto")).toBeInTheDocument();
  });

  it("säger sitt läge för den som lyssnar, inte bara för den som ser", () => {
    render(<OpsStickySummary label="Netto" value="+1 kr" />);
    const knapp = screen.getByRole("button");
    expect(knapp).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(knapp);
    expect(knapp).toHaveAttribute("aria-expanded", "false");
    // Namnet är borta ur texten men finns kvar i etiketten, annars är knappen
    // "plus ett kronor" och ingenting mer.
    expect(knapp.getAttribute("aria-label")).toContain("Netto");
  });

  it("visar hinten utfälld och inte ihopfälld", () => {
    render(<OpsStickySummary label="Netto" value="+1 kr" hint="−2 344 kr mot nuläget" />);
    expect(screen.getByText("−2 344 kr mot nuläget")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByText("−2 344 kr mot nuläget")).not.toBeInTheDocument();
  });

  it("minns läget mellan besök när den fått en nyckel", () => {
    const { unmount } = render(<OpsStickySummary label="Netto" value="+1 kr" storageKey="prov-bubbla" />);
    fireEvent.click(screen.getByRole("button"));
    unmount();

    render(<OpsStickySummary label="Netto" value="+1 kr" storageKey="prov-bubbla" />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
  });

  it("minns ingenting utan nyckel, alltså startar utfälld varje gång", () => {
    const { unmount } = render(<OpsStickySummary label="Netto" value="+1 kr" />);
    fireEvent.click(screen.getByRole("button"));
    unmount();

    render(<OpsStickySummary label="Netto" value="+1 kr" />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });

  it("kastar hellre än att rendera en bubbla utan siffra eller utan namn", () => {
    expect(() => render(<OpsStickySummary label="Netto" value="" />)).toThrow(/label och value/);
    expect(() => render(<OpsStickySummary label="" value="+1 kr" />)).toThrow(/label och value/);
  });

  it("bottnar ovanför bottenraden, inte ovanpå den", () => {
    // ⛔ Klassen kontrolleras för att det inte finns något annat sätt: jsdom
    // räknar ingen layout. Utan den här raden kan `--bottom-nav-h` falla bort i
    // en omskrivning, och då lägger sig bubblan över telefonens navigering.
    const { container } = render(<OpsStickySummary label="Netto" value="+1 kr" />);
    expect(container.firstChild.className).toContain("--bottom-nav-h");
    expect(container.firstChild.className).toContain("--safe-bottom");
  });

  it("ligger på innehållets lager och inte på appskalets", () => {
    // ⛔ Tar bubblan `--z-chrome` lägger den sig över headern och bottenraden,
    // alltså om exakt det fel ops-framework#47 rättade.
    const { container } = render(<OpsStickySummary label="Netto" value="+1 kr" />);
    expect(container.firstChild.className).toContain("z-(--z-sticky)");
    expect(container.firstChild.className).not.toContain("z-(--z-chrome)");
  });
});
