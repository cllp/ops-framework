import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsAuthGate, OpsAuthProvider } from "../auth/auth.jsx";

/**
 * Långsam inloggning (0.31.0, fynd 7 i cllp/bolag-ops#475): ett skelett och, efter en tidsgräns, "Försök igen".
 * Auth svarar aldrig här (`subscribe` anropar aldrig sin lyssnare), alltså är sidan i laddningsläget hela provet.
 */
const aldrigSvar = {
  subscribe: () => () => {},
  signOut: async () => {},
};

/** @param {object} [props] */
function gate(props = {}) {
  return render(
    <OpsAuthProvider authentication={/** @type {any} */ (aldrigSvar)}>
      <OpsAuthGate {...props}>
        <p>hemligt</p>
      </OpsAuthGate>
    </OpsAuthProvider>,
  );
}

describe("OpsAuthGate medan auth inte svarat", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("ritar ett skelett av huvud och innehåll, med statusordet som text för skärmläsare", () => {
    const { container } = gate();
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Kontrollerar inloggning");
    expect(container.querySelector("[data-skelett]")).not.toBeNull();
    // Blocken är dekor: minst huvudets och innehållets, alla dolda för skärmläsare.
    const dolda = container.querySelectorAll('[aria-hidden="true"]');
    expect(dolda.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole("button", { name: "Försök igen" })).toBeNull();
    expect(screen.queryByText("hemligt")).toBeNull();
  });

  it("efter tidsgränsen kommer en tydlig rad med Försök igen som anropar onForsokIgen", () => {
    const onForsokIgen = vi.fn();
    gate({ onForsokIgen, laddaLangsamMs: 3000 });
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.queryByRole("button", { name: "Försök igen" })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(screen.getByText(/längre tid än väntat/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Försök igen" }));
    expect(onForsokIgen).toHaveBeenCalledTimes(1);
  });

  it("tidsgränsen är 8 sekunder som förval", () => {
    gate();
    act(() => {
      vi.advanceTimersByTime(7999);
    });
    expect(screen.queryByRole("button", { name: "Försök igen" })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(screen.getByRole("button", { name: "Försök igen" })).toBeTruthy();
  });
});
