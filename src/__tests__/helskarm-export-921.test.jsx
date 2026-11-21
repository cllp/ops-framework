import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it } from "vitest";

import * as ramverket from "../index.js";

/**
 * ⛔ HÄNDELSEN (0.249.0, cllp/lifehub.app#921). CP 2026-11-21: "En sak som jag önskar om Tavlan. Är att den kan öppnas i helskärm, precis som
 * html och pdf", och sedan "så att man slipper scrolla i sidled". Tavlan är appens vy, och helskärmen med sin reserv bodde i ramverket utan att
 * exporteras (`useHelskarm`, 0.234.0). En egen kopia i appen hade varit en andra sanning om helskärm (regel 2), så kroken och dess ord exporteras.
 *
 * ⛔ RÖTT UTAN ÄNDRINGEN: `useHelskarm`, `ORD_HELSKARM` och `IKON_FOR.oppna` saknas i paketets ingång.
 */

afterEach(cleanup);

/** En yta som appen ritar själv, med kroken ur paketets ingång. */
function Yta() {
  const yta = useRef(/** @type {HTMLDivElement | null} */ (null));
  const { lage, oppna, avsluta } = ramverket.useHelskarm(yta);
  return (
    <div ref={yta} data-yta={lage || "av"}>
      <button type="button" onClick={() => (lage ? avsluta() : oppna())}>
        {lage ? ramverket.ORD_HELSKARM.avsluta.sv : ramverket.ORD_HELSKARM.helskarm.sv}
      </button>
    </div>
  );
}

describe("helskärmen exporteras till appen (0.249.0)", () => {
  it("kroken och orden finns i paketets ingång", () => {
    expect(typeof ramverket.useHelskarm).toBe("function");
    expect(ramverket.ORD_HELSKARM.helskarm).toEqual({ sv: "Helskärm", en: "Full screen" });
    expect(ramverket.ORD_HELSKARM.avsluta).toEqual({ sv: "Stäng helskärm", en: "Close full screen" });
  });

  it("⛔ öppna detaljen har en egen ikon i lexikonet, skild från helskärmen", () => {
    expect(ramverket.IKON_FOR.oppna).toBeTruthy();
    expect(ramverket.IKON_FOR.oppna).not.toBe(ramverket.IKON_FOR.helskarm);
  });

  it("⛔ utan webbläsarens helskärm blir ytan ett lager, och Escape stänger det och släpper sidan", () => {
    render(<Yta />);
    const yta = () => document.querySelector("[data-yta]")?.getAttribute("data-yta");
    expect(yta()).toBe("av");
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Helskärm" }));
    });
    expect(yta()).toBe("fonster");
    expect(document.documentElement.style.overflow).toBe("hidden");
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(yta()).toBe("av");
    expect(document.documentElement.style.overflow).toBe("");
  });
});
