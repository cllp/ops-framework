import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { useRef } from "react";

import { useFullHeight } from "../lib/fullHeight.js";

/*
 * cllp/ops-framework#525: `useFullHeight(ref)` körde sin effekt bara när ref-objektet byttes, aldrig när `ref.current` byttes.
 * Granskningen av PR 524 (0.190.0): gästens telefonsida blev 965 px hög i 844 när ljud spelade, eftersom ett `key` bytte elementet under hooken och
 * mätningen satt kvar på det gamla, urkopplade elementet. Rättat då i komponenten; det här provet vaktar hooken själv.
 * ⛔ RÖTT MOT DEN GAMLA HOOKEN: efter bytet mäts fortfarande det gamla elementets topp (100), inte det nyas (300).
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** @param {{ nyckel: string }} props */
function Yta({ nyckel }) {
  const ref = useRef(/** @type {HTMLDivElement | null} */ (null));
  const stil = useFullHeight(ref);
  return <div key={nyckel} ref={ref} data-yta={nyckel} data-topp={/** @type {any} */ (stil)["--fullhojd-topp"]} />;
}

describe("useFullHeight följer elementet, inte bara ref-objektet (#525)", () => {
  it("⛔ när elementet under hooken byts mäts det nya elementet", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
      const topp = this.getAttribute("data-yta") === "b" ? 300 : 100;
      return /** @type {DOMRect} */ ({ top: topp, bottom: topp + 10, left: 0, right: 0, width: 0, height: 10, x: 0, y: topp, toJSON() {} });
    });
    const { rerender, container } = render(<Yta nyckel="a" />);
    expect(container.querySelector("[data-yta]")?.getAttribute("data-topp")).toBe("100px");
    act(() => rerender(<Yta nyckel="b" />));
    const yta = container.querySelector("[data-yta]");
    expect(yta?.getAttribute("data-yta")).toBe("b");
    expect(yta?.getAttribute("data-topp")).toBe("300px");
  });
});
