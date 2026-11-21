import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useHelskarm } from "../index.js";

/**
 * ⛔ HÄNDELSEN (0.249.1, GPT:s granskning av cllp/lifehub.app PR 922). Tavlan lägger hela sidan (`document.documentElement`) i helskärm, och sidan
 * finns kvar när tavlan avmonteras. Mätt i byggd Chromium på 390 och 1280: Helskärm, öppna ett kort med ikonen, tillbaka till tavlan. Då var
 * `document.fullscreenElement` fortfarande sidan, och den nya tavlan hade ingen Stäng helskärm. Personen satt kvar i webbläsarens helskärm utan
 * tavlans utväg.
 *
 * jsdom har ingen helskärm, så den byggs här: `requestFullscreen` sätter `fullscreenElement` och skickar `fullscreenchange`, som en webbläsare.
 *
 * ⛔ RÖTT UTAN ÄNDRINGEN: provet "avmonteras i helskärm" faller, eftersom kroken bara tog bort sina lyssnare och lät sidan stå kvar i helskärm.
 * Provet "avmonteras medan begäran väntar" faller utan lyssningen vid avmonteringen: begäran kommer fram efteråt och ingen avslutar den.
 */

/** @type {Element | null} */
let iHelskarm = null;
const exit = vi.fn(async () => {
  iHelskarm = null;
  document.dispatchEvent(new Event("fullscreenchange"));
});

beforeEach(() => {
  iHelskarm = null;
  exit.mockClear();
  Object.defineProperty(document, "fullscreenEnabled", { configurable: true, get: () => true });
  Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => iHelskarm });
  Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exit });
  Object.defineProperty(document.documentElement, "requestFullscreen", {
    configurable: true,
    value: async function () {
      iHelskarm = this;
      document.dispatchEvent(new Event("fullscreenchange"));
    },
  });
});

afterEach(() => {
  cleanup();
  for (const namn of ["fullscreenEnabled", "fullscreenElement", "exitFullscreen"]) delete (/** @type {any} */ (document))[namn];
  delete (/** @type {any} */ (document.documentElement)).requestFullscreen;
});

/** Som tavlan: hela sidan blir helskärm, och sidan finns kvar när ytan avmonteras. */
function Sidan() {
  const sidan = useRef(/** @type {HTMLElement | null} */ (document.documentElement));
  const { lage, oppna } = useHelskarm(sidan);
  return (
    <button type="button" data-lage={lage || "av"} onClick={oppna}>
      Helskärm
    </button>
  );
}

const oppnaHelskarm = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Helskärm" }));
  });
};

describe("helskärmen avslutas när ägaren avmonteras (0.249.1)", () => {
  it("⛔ avmonteras i helskärm: sidan lämnar helskärmen, så ingen sitter kvar utan utväg", async () => {
    const { unmount } = render(<Sidan />);
    await oppnaHelskarm();
    expect(document.fullscreenElement).toBe(document.documentElement);
    expect(screen.getByRole("button").getAttribute("data-lage")).toBe("helskarm");
    unmount();
    expect(exit).toHaveBeenCalledTimes(1);
    expect(document.fullscreenElement).toBe(null);
  });

  it("en helskärm som någon annan bett om lämnas orörd vid avmonteringen", async () => {
    const { unmount } = render(<Sidan />);
    await oppnaHelskarm();
    const annan = document.createElement("div");
    await act(async () => {
      iHelskarm = annan;
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(screen.getByRole("button").getAttribute("data-lage")).toBe("av");
    unmount();
    expect(exit).not.toHaveBeenCalled();
    expect(document.fullscreenElement).toBe(annan);
  });

  it("⛔ avmonteras medan begäran väntar: helskärmen som kommer fram efteråt avslutas (GPT:s granskning av PR 636)", async () => {
    /** @type {() => void} */
    let slapp = () => {};
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: function () {
        return new Promise((klar) => {
          slapp = () => {
            iHelskarm = this;
            document.dispatchEvent(new Event("fullscreenchange"));
            klar(undefined);
          };
        });
      },
    });
    const { unmount } = render(<Sidan />);
    await oppnaHelskarm();
    expect(document.fullscreenElement).toBe(null);
    unmount();
    expect(exit).not.toHaveBeenCalled();
    await act(async () => {
      slapp();
    });
    expect(exit).toHaveBeenCalledTimes(1);
    expect(document.fullscreenElement).toBe(null);
  });

  it("en väntande begäran som avslås efter avmonteringen lämnar ingen lyssnare och avslutar ingenting", async () => {
    Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: () => new Promise(() => {}) });
    const { unmount } = render(<Sidan />);
    await oppnaHelskarm();
    unmount();
    document.dispatchEvent(new Event("fullscreenerror"));
    const annan = document.createElement("div");
    iHelskarm = annan;
    document.dispatchEvent(new Event("fullscreenchange"));
    expect(exit).not.toHaveBeenCalled();
    expect(document.fullscreenElement).toBe(annan);
  });

  it("utan helskärm gör avmonteringen ingenting", () => {
    const { unmount } = render(<Sidan />);
    unmount();
    expect(exit).not.toHaveBeenCalled();
  });
});
