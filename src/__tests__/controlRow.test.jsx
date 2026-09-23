import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsControlRow } from "../components/OpsControlRow.jsx";

/**
 * Kontrollraden: regeln för vad som händer när raden inte ryms.
 */

function theRow() {
  const el = screen.getByText("ett").parentElement;
  if (!el) throw new Error("Hittar ingen rad kring kontrollerna");
  return el;
}

describe("OpsKontrollrad", () => {
  it("bryter raden i stället för att krympa kontrollerna", () => {
    /*
     * ⛔ DET HÄR ÄR HELA KOMPONENTEN. Utan `flex-wrap` krymper flex-barnen i
     * stället, och en knapp som krympt under sin egen träffyta är värre än en
     * som flyttat ner en rad: den ser fortfarande ut att gå att trycka på.
     */
    render(
      <OpsControlRow>
        <button type="button">ett</button>
      </OpsControlRow>,
    );
    expect(theRow().className).toContain("flex-wrap");
    // ⛔ Och kontrollerna står mitt för varandra i höjdled, inte toppställda.
    expect(theRow().className).toContain("items-center");
  });

  it("håller samma luft mellan kontrollerna som resten av ramverket", () => {
    /*
     * ⛔ ETT TAL OCH INTE ETT PER VY. Två rader på samma sida med olika gap är
     * exakt den skillnaden som uppstod när varje vy skrev raden själv, och den
     * upptäcktes först när telefonen låg bredvid datorn.
     */
    render(
      <OpsControlRow>
        <button type="button">ett</button>
      </OpsControlRow>,
    );
    expect(theRow().className).toContain("gap-2");
  });

  it("ligger i mitten som förval och i vänsterkant på begäran", () => {
    /*
     * ⛔ FÖRVALET ÄR MITTEN, eftersom en ensam kontroll över en lista hör hemma
     * över listans mitt. `start` är för rader med FLERA kontroller: då är
     * vänsterkanten den enda punkt som ligger still när en av dem byter bredd,
     * och en rad vars ikoner hoppar i sidled när ett filter tänds är en rad man
     * måste sikta om på varje gång.
     */
    const { unmount } = render(
      <OpsControlRow>
        <button type="button">ett</button>
      </OpsControlRow>,
    );
    expect(theRow().className).toContain("justify-center");
    unmount();

    render(
      <OpsControlRow align="start">
        <button type="button">ett</button>
      </OpsControlRow>,
    );
    expect(theRow().className).toContain("justify-start");
    expect(theRow().className).not.toContain("justify-center");
  });

  it("kastar på en justering som inte finns", () => {
    /*
     * ⛔ EN TYST RESERV GÖR ETT STAVFEL TILL EN RAD SOM SER NÄSTAN RÄTT UT, och
     * nästan rätt upptäcks aldrig: `align="vanster"` hade centrerats, och
     * den som skrev det hade trott att ramverket inte kunde vänsterställa.
     */
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() =>
        render(
          /* @ts-expect-error avsiktligt fel värde */
          <OpsControlRow align="vanster">
            <button type="button">ett</button>
          </OpsControlRow>,
        ),
      ).toThrow(/okänd align/);
    } finally {
      tyst.mockRestore();
    }
  });
});
