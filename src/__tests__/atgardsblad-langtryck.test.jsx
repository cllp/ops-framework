import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsAtgardsblad } from "../components/OpsAtgardsblad.jsx";
import { LANGTRYCK_MS } from "../lib/apparark.js";

/**
 * ⛔ FINGRET SOM ÖPPNADE MENYN VÄLJER INGET NÄR DET LYFTS (0.100.1, lifehub.app#226).
 *
 * Mätt i Chromium med pekskärm i iPhone-storlek mot lifehub.app:s mätbygge: ett långt tryck på rad ett och två i Biblioteket gav
 * menyn, på rad tre och fyra öppnades posten. Arket ritas nerifrån, och på en låg rad låg det under fingret när det lyftes. Klicket
 * som följer släppet träffade Öppna. Provet kör samma ordning: långt tryck, menyn öppnas, fingret lyfts, klicket kommer på en rad.
 */

/** @param {boolean} smal */
function medBredd(smal) {
  vi.stubGlobal("matchMedia", (/** @type {string} */ q) => ({ matches: smal, media: q, addEventListener: () => {}, removeEventListener: () => {} }));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function rendera() {
  const oppna = vi.fn();
  render(
    <OpsAtgardsblad namn="Tankning" poster={[{ id: "oppna", etikett: "Öppna", onValj: oppna }, { id: "radera", etikett: "Radera", onValj: () => {} }]}>
      <button type="button">Tankning</button>
    </OpsAtgardsblad>,
  );
  return oppna;
}

/** jsdom saknar PointerEvent, så händelsen är en MouseEvent med pekartypens namn (samma som `bibliotek-vy.test.jsx`). @param {EventTarget} el @param {string} typ */
function peka(el, typ) {
  act(() => {
    el.dispatchEvent(new MouseEvent(typ, { bubbles: true, cancelable: true, clientX: 40, clientY: 460, button: 0 }));
  });
}

/** Ett långt tryck på raden, med fingret kvar. */
function hallIn() {
  const rad = /** @type {HTMLElement} */ (document.querySelector("[data-ops-atgard]"));
  peka(rad, "pointerdown");
  act(() => {
    vi.advanceTimersByTime(LANGTRYCK_MS + 50);
  });
}

describe("⛔ långtrycket och släppet", () => {
  for (const smal of [true, false]) {
    it(`${smal ? "arket" : "menyn"}: klicket från samma tryck väljer inget, nästa tryck väljer`, () => {
      medBredd(smal);
      const oppna = rendera();
      hallIn();
      const rad = screen.getByRole("menuitem", { name: "Öppna" });
      // Fingret lyfts över raden i menyn, och klicket följer släppet.
      peka(document, "pointerup");
      fireEvent.click(rad);
      expect(oppna).not.toHaveBeenCalled();
      expect(screen.getByRole("menuitem", { name: "Öppna" })).toBeInTheDocument();
      // Ett nytt tryck på raden väljer den.
      act(() => {
        vi.advanceTimersByTime(500);
      });
      fireEvent.click(screen.getByRole("menuitem", { name: "Öppna" }));
      expect(oppna).toHaveBeenCalledTimes(1);
    });
  }

  it("spärren släpps av sig själv när släppet inte träffade menyn: nästa tryck väljer", () => {
    medBredd(true);
    const oppna = rendera();
    hallIn();
    peka(document, "pointerup");
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "Öppna" }));
    expect(oppna).toHaveBeenCalledTimes(1);
  });

  it("⋮ öppnar utan spärr: första trycket på en rad väljer den", () => {
    medBredd(true);
    const oppna = rendera();
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Tankning" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Öppna" }));
    expect(oppna).toHaveBeenCalledTimes(1);
  });
});
