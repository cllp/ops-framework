import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsAtgardsblad } from "../components/OpsAtgardsblad.jsx";
import { LANGTRYCK_MS } from "../lib/apparark.js";

/**
 * ⛔ FINGRET SOM ÖPPNADE MENYN VÄLJER INGET NÄR DET LYFTS (0.100.1, lifehub.app#226).
 *
 * Mätt i Chromium med pekskärm i iPhone-storlek mot lifehub.app:s mätbygge: ett långt tryck på rad ett och två i Biblioteket gav
 * menyn, på rad tre och fyra öppnades posten. Arket ritas nerifrån, och på en låg rad låg det under fingret när det lyftes. Klicket
 * som följer släppet träffade Öppna. Provet kör samma ordning: långt tryck, menyn öppnas, fingret lyfts, klicket kommer på en rad.
 *
 * ⛔ 0.102.0: arket är borta, menyn är samma ruta vid raden på alla bredder (CP 2026-10-14). Spärren står kvar, för rutan förankras i
 * raden som hölls in och kan ligga under fingret på samma sätt. Proven körs därför på båda bredderna: att komponenten inte längre läser
 * bredden ska inte göra spärren till något som bara gällde telefonen.
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
    it(`${smal ? "smal skärm" : "bred skärm"}: klicket från samma tryck väljer inget, nästa tryck väljer`, () => {
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

  for (const smal of [true, false]) {
    it(`${smal ? "smal skärm" : "bred skärm"}: klicket i släppet väljer ingen rad, inte heller en annan än Öppna, och rutan står kvar (granskningen av PR 364)`, () => {
      // Förut provade det här Stäng i arket. Stäng finns inte längre (Escape och klick utanför stänger), så det som skyddas är
      // detsamma med en annan knapp: ett klick i släppet får inte välja något, och rutan får inte stängas av det.
      medBredd(smal);
      const radera = vi.fn();
      const oppna = vi.fn();
      render(
        <OpsAtgardsblad namn="Tankning" poster={[{ id: "oppna", etikett: "Öppna", onValj: oppna }, { id: "radera", etikett: "Radera", fara: true, onValj: radera }]}>
          <button type="button">Tankning</button>
        </OpsAtgardsblad>,
      );
      hallIn();
      peka(document, "pointerup");
      fireEvent.click(screen.getByRole("menuitem", { name: "Radera" }));
      expect(radera).not.toHaveBeenCalled();
      expect(oppna).not.toHaveBeenCalled();
      expect(screen.getByRole("menu", { name: "Tankning" })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "Radera" })).toBeInTheDocument();
      // Golv: samma rad går att välja när släppet passerat, så raden ovan är inte grön av en rad som aldrig svarar.
      act(() => {
        vi.advanceTimersByTime(500);
      });
      fireEvent.click(screen.getByRole("menuitem", { name: "Radera" }));
      expect(radera).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("menu", { name: "Tankning" })).toBeNull();
    });
  }

  it("⛔ rutan bär postens namn överst och ingen Stäng, på båda bredderna, och Escape stänger (0.102.0)", () => {
    // Klick utanför provas inte här: jsdom registrerar inget tryck utanför en Radix-popover (samma sak i `appfilter.test.jsx`).
    // Det mäts i webbläsaren.
    for (const smal of [true, false]) {
      medBredd(smal);
      rendera();
      fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Tankning" }));
      const ruta = /** @type {HTMLElement} */ (document.querySelector("[data-ops-atgard-namn]")?.parentElement);
      expect(document.querySelector("[data-ops-atgard-namn]")?.textContent).toBe("Tankning");
      // Namnet står före raderna, inte efter.
      expect(ruta.firstElementChild?.hasAttribute("data-ops-atgard-namn")).toBe(true);
      expect(ruta.querySelector("[role='menu']")).not.toBeNull();
      expect(screen.queryByRole("button", { name: "Stäng" })).toBeNull();
      fireEvent.keyDown(screen.getByRole("menu", { name: "Tankning" }), { key: "Escape" });
      expect(screen.queryByRole("menu", { name: "Tankning" })).toBeNull();
      cleanup();
      vi.unstubAllGlobals();
    }
  });

  it("pointercancel räknas som släpp, och rörelse efter att menyn öppnats avbryter inte mätningen", () => {
    medBredd(true);
    const oppna = rendera();
    hallIn();
    // Fingret glider en bit över arket innan det lyfts. Släppet ska fortfarande vara skyddat.
    act(() => {
      document.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 120, clientY: 520 }));
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    peka(document, "pointercancel");
    fireEvent.click(screen.getByRole("menuitem", { name: "Öppna" }));
    expect(oppna).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "Öppna" }));
    expect(oppna).toHaveBeenCalledTimes(1);
  });

  it("ett släpp som aldrig kommer låser inte menyn: efter taket går ett tryck fram", () => {
    medBredd(true);
    const oppna = rendera();
    hallIn();
    act(() => {
      vi.advanceTimersByTime(2100);
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
