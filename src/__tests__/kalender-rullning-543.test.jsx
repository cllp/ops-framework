import { afterEach, describe, expect, it, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { OpsCalendar } from "../components/OpsCalendar.jsx";

/**
 * 0.166.0 (cllp/lifehub.app#543): kalenderns rulle står kvar när den syns igen efter att ha varit dold.
 * ⛔ RÖTT MOT 0.165.0: efter Avbryt i Ny händelse stod rullen överst, tolv månader bakåt.
 */

const orig = globalThis.ResizeObserver;
afterEach(() => {
  globalThis.ResizeObserver = orig;
});

describe("⛔ rullningen efter en dold period (#543)", () => {
  it("lägger tillbaka den senast sparade rullningen när ytan får höjd igen", () => {
    /** @type {Array<() => void>} */
    const svar = [];
    globalThis.ResizeObserver = class {
      constructor(cb) {
        svar.push(() => cb([]));
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    let hojd = 600;
    const hojdSpion = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(() => hojd);
    try {
      const { container } = render(<OpsCalendar ariaLabel="Kalender" entries={[]} />);
      const rulle = /** @type {HTMLElement} */ (container.querySelector("[data-kalender-rulle]"));
      rulle.scrollTop = 4800;
      act(() => {
        rulle.dispatchEvent(new Event("scroll"));
      });
      // Dold: höjden blir 0 och webbläsaren nollar rullningen.
      hojd = 0;
      act(() => svar.forEach((f) => f()));
      rulle.scrollTop = 0;
      // Synlig igen.
      hojd = 600;
      act(() => svar.forEach((f) => f()));
      expect(rulle.scrollTop).toBe(4800);
    } finally {
      hojdSpion.mockRestore();
    }
  });
});

describe("⛔ kalendern monterad medan dold öppnar på idag (lifehub.app#583)", () => {
  it("hoppet till idag väntar tills ytan får höjd", () => {
    /** @type {Array<() => void>} */
    const svar = [];
    globalThis.ResizeObserver = class {
      constructor(cb) {
        svar.push(() => cb([]));
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    let hojd = 0;
    const hojdSpion = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(() => hojd);
    const toppSpion = vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(function () {
      return this.hasAttribute?.("data-kalender-rulle") ? 0 : 3000;
    });
    try {
      const { container } = render(<OpsCalendar ariaLabel="Kalender" entries={[]} />);
      const rulle = /** @type {HTMLElement} */ (container.querySelector("[data-kalender-rulle]"));
      const till = [];
      rulle.scrollTo = (o) => till.push(o.top);
      expect(till).toEqual([]);
      hojd = 600;
      act(() => svar.forEach((f) => f()));
      expect(till.length).toBe(1);
      expect(till[0]).toBeGreaterThan(0);
    } finally {
      hojdSpion.mockRestore();
      toppSpion.mockRestore();
    }
  });
});
