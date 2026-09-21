import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpsFilterPanel } from "../components/OpsFilterPanel.jsx";

/**
 * Att testmiljöns stubbar finns kvar, mätt i tid.
 *
 * ── ⛔ VARFÖR DET HÄR PROVET SER UNDERLIGT UT ──────────────────────────
 *
 * Det mäter en klocka, och det gör inget annat prov i sviten. Skälet är att
 * defekten det vaktar INTE SYNS SOM ETT FEL: utan stubben i `setup.js` blir
 * varje prov som öppnar en popover fortfarande grönt, det tar bara fjorton
 * sekunder i stället för en tiondel. Mätt 2026-09-21 på den här filen:
 *
 *   filterpanel.test.jsx med stubben      1,4 s
 *   filterpanel.test.jsx utan stubben   127,5 s
 *
 * En regression som bara kostar tid upptäcks aldrig av sig själv. Den blir
 * "jsdom är trögt", och sedan ligger den kvar i åratal.
 *
 * ⛔ GRÄNSEN ÄR SATT MED SJU GÅNGERS MARGINAL, inte för att träffa rätt på
 * millisekunden. Provet ska svara på "är stubben borta", inte på "hur snabb är
 * den här maskinen", och en gräns nära det uppmätta hade blivit rött på en
 * långsam CI-körning i stället för på en riktig regression.
 */
describe("jsdom-stubbar", () => {
  it("öppnar en popover utan att kosta sekunder", async () => {
    render(
      <OpsFilterPanel
        grupper={[{ id: "a", label: "A", options: [{ value: "x", label: "X" }] }]}
        value={{ a: null }}
        onChange={() => {}}
        ariaLabel="Filter"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Filter" }));

    const start = Date.now();
    // ⛔ VÄNTAN ÄR SJÄLVA MÄTNINGEN. Öppningen i sig är snabb även utan stubben;
    // kostnaden ligger i att händelseslingan sedan står still medan floating-ui
    // frågar varje förfader om den är ett popover-lager.
    // ⛔ INNE I `act`, och det är inte formalia. Utanför varnar React för en
    // uppdatering som inte omslöts, och en varning i ett nytt prov lär en att
    // varningar är normala. Det är dessutom precis så `findBy*` väntar, alltså
    // mäter provet samma väg som de prov kostnaden faktiskt drabbar.
    await act(async () => {
      await new Promise((klar) => {
        setTimeout(klar, 0);
      });
    });

    expect(Date.now() - start).toBeLessThan(2000);
  });

  it("lämnar vanliga väljare i fred", () => {
    // ⛔ Stubben får inte bli en genväg som svarar på allt. Svarade den false på
    // varje väljare skulle Radix egna kontroller sluta hitta sina element, och
    // det felet hade sett ut som en trasig komponent.
    expect(document.body.matches("body")).toBe(true);
    expect(document.body.matches("div")).toBe(false);
  });
});
