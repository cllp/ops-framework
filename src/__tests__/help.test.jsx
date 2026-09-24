import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpsHelp } from "../components/OpsHelp.jsx";
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
    render(<OpsHelp title={<h1>Idag</h1>}>Vad som kräver dig nu.</OpsHelp>);

    expect(screen.getByText("Vad som kräver dig nu.")).not.toBeVisible();
    fireEvent.click(screen.getByText("Idag"));
    expect(screen.getByText("Vad som kräver dig nu.")).toBeVisible();
  });

  it("ritar ingen knapp alls när det inte finns något att förklara", () => {
    /*
     * ⛔ EN KNAPP SOM ÖPPNAR INGENTING ÄR ETT LÖFTE SOM INTE INFRIAS, samma
     * regel som kalenderkortets chevron fick. Rubriken ska stå kvar, naken.
     */
    const { container } = render(<OpsHelp title={<h1>Idag</h1>} />);
    expect(screen.getByRole("heading", { name: "Idag", level: 1 })).toBeInTheDocument();
    expect(container.querySelector("details")).toBeNull();
  });

  it("låter rubriken vara en rubrik även inuti summary", () => {
    /*
     * ⛔ INNEHÅLLSMODELLEN TILLÅTER ETT RUBRIKELEMENT I ETT `<summary>`, och det
     * är skälet att hela raden får vara träffytan utan att kosta något: den som
     * navigerar på rubriker hittar sidan som förut.
     */
    render(<OpsHelp title={<h1>Idag</h1>}>Förklaringen.</OpsHelp>);
    const theTitle = screen.getByRole("heading", { name: "Idag", level: 1 });
    expect(theTitle.closest("summary")).not.toBeNull();
  });

  it("är stängd från start, varje gång", () => {
    /*
     * ⛔ INGET MINNE, MED FLIT. Ett `storageKey` som `OpsDisclosure` har vore
     * lätt att lägga till och fel: mindes texten sig öppen vore vi tillbaka i en
     * mening som står kvar för alltid, alltså precis det som skulle bort.
     */
    const { container, unmount } = render(<OpsHelp title={<h1>Idag</h1>}>Förklaringen.</OpsHelp>);
    fireEvent.click(screen.getByText("Idag"));
    expect(container.querySelector("details")?.open).toBe(true);
    unmount();

    const andra = render(<OpsHelp title={<h1>Idag</h1>}>Förklaringen.</OpsHelp>);
    expect(andra.container.querySelector("details")?.open).toBe(false);
  });

  it("⛔ ritar ringen i bläck och inte i linjefärgen, så den syns i vila", () => {
    /*
     * CP 2026-09-24, mörkt läge på telefon: frågetecknet såg "hängande" ut.
     *
     * ⛔ MÄTT SOM WCAG-KVOT MOT YTAN, inte tyckt: `border-line` ger 1,14:1 i
     * mörkt och 1,19:1 i ljust. Golvet för en kontrollyta är 3:1, alltså fanns
     * ringen inte i NÅGOT av lägena. `ink-secondary` ger 4,93 respektive 9,47.
     *
     * ⛔ PROVET LÅSER KLASSEN OCH INTE UTSEENDET. jsdom räknar ingen CSS, så
     * ett prov om faktisk kontrast hade varit grönt oavsett. Det som går att
     * hålla fast är vilket TOKEN ringen hämtar sin färg ur, och att det inte
     * är linjefärgen, som per definition är den som ska viska.
     */
    const { container } = render(<OpsHelp title={<h1>Idag</h1>}>Förklaringen.</OpsHelp>);
    const ringen = container.querySelector("summary span[aria-hidden='true']");
    expect(ringen).not.toBeNull();

    const klasser = String(ringen.className).split(/\s+/);
    expect(klasser).toContain("border-ink-secondary");
    expect(klasser).not.toContain("border-line");

    /*
     * ⛔ OCH DET ÖPPNA LÄGET SKA VARA KVAR. Skillnaden mellan stängt och öppet
     * ska vara att ringen blir LJUSARE, inte att den dyker upp ur ingenting.
     * Utan den här raden hade en fix som tog bort accentläget varit grön.
     */
    expect(klasser).toContain("group-open:border-accent");
  });

  it("ger tecknet ett ord för den som lyssnar", () => {
    // ⛔ "?" är en bild för örat. Utan `label` heter knappen bara rubriken.
    render(<OpsHelp title={<h1>Idag</h1>} label="Visa förklaring">Förklaringen.</OpsHelp>);
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
    const theButton = screen.getByRole("button", { name: "Lägg till" });
    expect(theButton).toBeInTheDocument();
    expect(container.querySelector("details")?.contains(theButton)).toBe(false);
  });
});
