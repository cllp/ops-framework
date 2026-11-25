import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useHelskarm } from "../index.js";

/**
 * ⛔ HÄNDELSEN (0.262.0, cllp/lifehub.app#933). CP 2026-11-25 om tavlan: "Kan den komma ihåg om man hade helskärm så att den utgår ifrån det om man
 * kom ifrån helskärm. Det ger en upplevelse om att man inte lämnat." Kortet öppnas i sin egen vy, och tavlans avmontering avslutade helskärmen.
 *
 * jsdom har ingen helskärm, så den byggs här som i `helskarm-avmontering-921.test.jsx`.
 *
 * ⛔ RÖTT UTAN ÄNDRINGEN: `behall` finns inte (anropet kastar), och `start` ignoreras, så den nya tavlan börjar i vanligt läge.
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

/** Som tavlan: hela sidan blir helskärm. `start` är läget den hade, och Lämna är "öppna ett kort". @param {{ start?: any }} p */
function Tavlan({ start }) {
  const sidan = useRef(/** @type {HTMLElement | null} */ (document.documentElement));
  const { lage, oppna, avsluta, behall } = useHelskarm(sidan, { start });
  return (
    <div data-lage={lage || "av"}>
      <button type="button" onClick={oppna}>
        Helskärm
      </button>
      <button type="button" onClick={avsluta}>
        Stäng
      </button>
      <button type="button" onClick={behall}>
        Lämna
      </button>
    </div>
  );
}

const tryck = async (/** @type {string} */ namn) => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: namn }));
  });
};
const lagetI = (/** @type {HTMLElement} */ c) => /** @type {HTMLElement} */ (c.firstElementChild).getAttribute("data-lage");

describe("tavlan börjar i helskärm igen när man kom därifrån (0.262.0)", () => {
  it("⛔ behall: ett kort öppnas och webbläsarens helskärm ligger kvar, och den nya tavlan tar över den med Stäng", async () => {
    const forsta = render(<Tavlan />);
    await tryck("Helskärm");
    await tryck("Lämna");
    forsta.unmount();
    expect(exit).not.toHaveBeenCalled();
    expect(document.fullscreenElement).toBe(document.documentElement);

    const andra = render(<Tavlan start="helskarm" />);
    expect(lagetI(andra.container)).toBe("helskarm");
    await tryck("Stäng");
    expect(exit).toHaveBeenCalledTimes(1);
    expect(document.fullscreenElement).toBe(null);
  });

  it("⛔ en övertagen helskärm är krokens egen: avmonteras den utan behall avslutas den som förut", async () => {
    iHelskarm = document.documentElement;
    const { container, unmount } = render(<Tavlan start="helskarm" />);
    expect(lagetI(container)).toBe("helskarm");
    unmount();
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("⛔ har webbläsaren lämnat helskärmen ritas lagret, eftersom webbläsaren bara släpper in sin helskärm i ett tryck", () => {
    const { container } = render(<Tavlan start="helskarm" />);
    expect(lagetI(container)).toBe("fonster");
    expect(exit).not.toHaveBeenCalled();
  });

  it("lagret som start ger lagret", () => {
    const { container } = render(<Tavlan start="fonster" />);
    expect(lagetI(container)).toBe("fonster");
  });

  it("utan start är allt som förut: vanligt läge, och avmonteringen avslutar helskärmen", async () => {
    const { container, unmount } = render(<Tavlan />);
    expect(lagetI(container)).toBe("av");
    await tryck("Helskärm");
    unmount();
    expect(exit).toHaveBeenCalledTimes(1);
  });
});
