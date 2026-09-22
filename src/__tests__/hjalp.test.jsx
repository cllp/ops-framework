import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpsHjalp } from "../components/OpsHjalp.jsx";
import { OpsViewHeader } from "../components/OpsView.jsx";

/**
 * Hjälptexten bakom frågetecknet.
 *
 * ⛔ CP 2026-09-22: "Låt texter komma fram med hjälp av att man trycker på ett
 * frågetecken, så blir appen lite renare."
 */

describe("OpsHjalp", () => {
  it("gömmer förklaringen tills man trycker, och visar den sedan", () => {
    /*
     * ⛔ `toBeVisible` OCH INTE `queryByText(...)).toBeNull()`. Texten LIGGER i
     * dokumentet hela tiden, det är så `<details>` fungerar, och ett prov som
     * kräver att den saknas hade tvingat fram en egen knapp med state, alltså
     * bort från plattformen och in i det `OpsDisclosure` redan varnar för.
     */
    render(<OpsHjalp rubrik={<h1>Idag</h1>}>Vad som kräver dig nu.</OpsHjalp>);

    expect(screen.getByText("Vad som kräver dig nu.")).not.toBeVisible();
    fireEvent.click(screen.getByText("Idag"));
    expect(screen.getByText("Vad som kräver dig nu.")).toBeVisible();
  });

  it("ritar ingen knapp alls när det inte finns något att förklara", () => {
    /*
     * ⛔ EN KNAPP SOM ÖPPNAR INGENTING ÄR ETT LÖFTE SOM INTE INFRIAS, samma
     * regel som kalenderkortets chevron fick. Rubriken ska stå kvar, naken.
     */
    const { container } = render(<OpsHjalp rubrik={<h1>Idag</h1>} />);
    expect(screen.getByRole("heading", { name: "Idag", level: 1 })).toBeInTheDocument();
    expect(container.querySelector("details")).toBeNull();
  });

  it("låter rubriken vara en rubrik även inuti summary", () => {
    /*
     * ⛔ INNEHÅLLSMODELLEN TILLÅTER ETT RUBRIKELEMENT I ETT `<summary>`, och det
     * är skälet att hela raden får vara träffytan utan att kosta något: den som
     * navigerar på rubriker hittar sidan som förut.
     */
    render(<OpsHjalp rubrik={<h1>Idag</h1>}>Förklaringen.</OpsHjalp>);
    const rubriken = screen.getByRole("heading", { name: "Idag", level: 1 });
    expect(rubriken.closest("summary")).not.toBeNull();
  });

  it("är stängd från start, varje gång", () => {
    /*
     * ⛔ INGET MINNE, MED FLIT. Ett `storageKey` som `OpsDisclosure` har vore
     * lätt att lägga till och fel: mindes texten sig öppen vore vi tillbaka i en
     * mening som står kvar för alltid, alltså precis det som skulle bort.
     */
    const { container, unmount } = render(<OpsHjalp rubrik={<h1>Idag</h1>}>Förklaringen.</OpsHjalp>);
    fireEvent.click(screen.getByText("Idag"));
    expect(container.querySelector("details")?.open).toBe(true);
    unmount();

    const andra = render(<OpsHjalp rubrik={<h1>Idag</h1>}>Förklaringen.</OpsHjalp>);
    expect(andra.container.querySelector("details")?.open).toBe(false);
  });

  it("ger tecknet ett ord för den som lyssnar", () => {
    // ⛔ "?" är en bild för örat. Utan `label` heter knappen bara rubriken.
    render(<OpsHjalp rubrik={<h1>Idag</h1>} label="Visa förklaring">Förklaringen.</OpsHjalp>);
    expect(screen.getByText("Visa förklaring")).toBeInTheDocument();
  });
});

describe("OpsViewHeader, förklaringen bakom frågetecknet", () => {
  it("lägger varje vys beskrivning bakom tecknet, utan att vyn gör något", () => {
    /*
     * ⛔ DET HÄR ÄR HELA VINSTEN. Arton vyer skickar redan in `description`.
     * Ändringen bor på ETT ställe, så ingen vy får bygga sin egen gest och
     * ingen kan glömma.
     */
    render(<OpsViewHeader title="Kostnader" description="Vad som lämnar bolaget varje månad." />);

    expect(screen.getByRole("heading", { name: "Kostnader", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Vad som lämnar bolaget varje månad.")).not.toBeVisible();

    fireEvent.click(screen.getByText("Kostnader"));
    expect(screen.getByText("Vad som lämnar bolaget varje månad.")).toBeVisible();
  });

  it("rör inte en rubrik utan beskrivning", () => {
    const { container } = render(<OpsViewHeader title="Kostnader" />);
    expect(screen.getByRole("heading", { name: "Kostnader", level: 1 })).toBeInTheDocument();
    expect(container.querySelector("details")).toBeNull();
  });

  it("låter knapparna till höger stå kvar", () => {
    // ⛔ `actions` ligger utanför `<details>`. Hamnade de innanför skulle ett
    // tryck på en knapp också fälla ut texten, alltså två saker på ett tryck.
    const { container } = render(
      <OpsViewHeader title="Kostnader" description="Förklaringen." actions={<button type="button">Lägg till</button>} />,
    );
    const knappen = screen.getByRole("button", { name: "Lägg till" });
    expect(knappen).toBeInTheDocument();
    expect(container.querySelector("details")?.contains(knappen)).toBe(false);
  });
});
