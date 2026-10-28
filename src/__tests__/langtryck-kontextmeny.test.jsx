import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useLangtryck } from "../components/useLangtryck.js";
import { OpsAtgardsblad } from "../components/OpsAtgardsblad.jsx";
import { LANGTRYCK_MS } from "../lib/apparark.js";

/**
 * Långtrycket och kontextmenyn (0.151.0, granskningen av PR 458, fynd 2 och 5).
 *
 * ⛔ FYND 2: Android skickar `contextmenu` mitt i ett fingertryck. Med `hogerklick` anropades genvägen då av kontextmenyn OCH av timern, och en genväg som växlar
 * ("visa bara den här") tog ut sig själv. Genvägen ska anropas EN gång, i varje ordning händelserna kommer.
 * ⛔ FYND 5: ett långsamt musklick är inget långtryck där musen har en egen väg (`utanMus`).
 */

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** @param {{ hogerklick?: boolean, utanMus?: boolean }} val @param {() => void} pa */
function Yta({ pa, ...val }) {
  const { handelser } = useLangtryck({ onLangtryck: pa, ...val });
  return <div data-testid="yta" {...handelser}>rad</div>;
}
const yta = () => screen.getByTestId("yta");
/** @param {EventTarget} el @param {string} typ @param {{ pekare?: string, knapp?: number }} [v] */
function peka(el, typ, { pekare, knapp = 0 } = {}) {
  const ev = new MouseEvent(typ, { bubbles: true, cancelable: true, clientX: 40, clientY: 40, button: knapp });
  if (pekare) Object.defineProperty(ev, "pointerType", { value: pekare });
  act(() => {
    el.dispatchEvent(ev);
  });
  return ev;
}
const tid = (/** @type {number} */ ms) => act(() => void vi.advanceTimersByTime(ms));

for (const hogerklick of [true, false]) {
  describe(`hogerklick: ${hogerklick}`, () => {
    it("⛔ pointerdown, contextmenu efter 300 ms, timern, pointerup: ETT anrop, och kontextmenyn stoppas", () => {
      const pa = vi.fn();
      render(<Yta pa={pa} hogerklick={hogerklick} />);
      peka(yta(), "pointerdown", { pekare: "touch" });
      tid(300);
      const cm = peka(yta(), "contextmenu");
      expect(cm.defaultPrevented).toBe(true);
      expect(pa).toHaveBeenCalledTimes(1);
      tid(LANGTRYCK_MS);
      peka(document, "pointerup");
      tid(1000);
      expect(pa).toHaveBeenCalledTimes(1);
    });

    it("⛔ omvänd ordning: pointerdown, timern, contextmenu, pointerup: ETT anrop", () => {
      const pa = vi.fn();
      render(<Yta pa={pa} hogerklick={hogerklick} />);
      peka(yta(), "pointerdown", { pekare: "touch" });
      tid(LANGTRYCK_MS + 50);
      expect(pa).toHaveBeenCalledTimes(1);
      const cm = peka(yta(), "contextmenu");
      expect(cm.defaultPrevented).toBe(true);
      peka(document, "pointerup");
      tid(1000);
      expect(pa).toHaveBeenCalledTimes(1);
    });
  });
}

describe("hogerklick: true", () => {
  it("⛔ kontextmenyn som kommer EFTER att fingret lyfts är inte ett andra anrop", () => {
    const pa = vi.fn();
    render(<Yta pa={pa} hogerklick />);
    peka(yta(), "pointerdown", { pekare: "touch" });
    tid(LANGTRYCK_MS + 50);
    peka(document, "pointerup");
    const cm = peka(yta(), "contextmenu");
    expect(cm.defaultPrevented).toBe(true);
    expect(pa).toHaveBeenCalledTimes(1);
  });

  it("ett högerklick med mus (inget tryck pågår) öppnar genvägen en gång, och ett senare högerklick en gång till", () => {
    const pa = vi.fn();
    render(<Yta pa={pa} hogerklick />);
    peka(yta(), "pointerdown", { pekare: "mouse", knapp: 2 });
    const cm = peka(yta(), "contextmenu", { pekare: "mouse" });
    expect(cm.defaultPrevented).toBe(true);
    expect(pa).toHaveBeenCalledTimes(1);
    tid(2000);
    peka(yta(), "contextmenu", { pekare: "mouse" });
    expect(pa).toHaveBeenCalledTimes(2);
  });
});

describe("hogerklick: false (som förut)", () => {
  it("ett högerklick med mus får sin vanliga meny och öppnar ingenting", () => {
    const pa = vi.fn();
    render(<Yta pa={pa} />);
    const cm = peka(yta(), "contextmenu", { pekare: "mouse" });
    expect(cm.defaultPrevented).toBe(false);
    expect(pa).not.toHaveBeenCalled();
  });
});

describe("utanMus", () => {
  it("⛔ ett långsamt musklick är inget långtryck, men fingret och pennan håller in", () => {
    const pa = vi.fn();
    render(<Yta pa={pa} hogerklick utanMus />);
    peka(yta(), "pointerdown", { pekare: "mouse" });
    tid(LANGTRYCK_MS * 3);
    peka(document, "pointerup");
    expect(pa).not.toHaveBeenCalled();
    for (const pekare of ["touch", "pen"]) {
      peka(yta(), "pointerdown", { pekare });
      tid(LANGTRYCK_MS + 50);
      peka(document, "pointerup");
      tid(1000);
    }
    expect(pa).toHaveBeenCalledTimes(2);
  });

  it("utan utanMus håller musen in som förut (bottenradens ikoner har ingen annan musväg)", () => {
    const pa = vi.fn();
    render(<Yta pa={pa} />);
    peka(yta(), "pointerdown", { pekare: "mouse" });
    tid(LANGTRYCK_MS + 50);
    expect(pa).toHaveBeenCalledTimes(1);
  });
});

describe("OpsAtgardsblad beter sig som förut, utom att musen inte håller in", () => {
  const rita = () =>
    render(
      <OpsAtgardsblad namn="Tankning" poster={[{ id: "oppna", etikett: "Öppna", onValj: () => {} }]}>
        <button type="button">Tankning</button>
      </OpsAtgardsblad>,
    );
  const rad = () => /** @type {HTMLElement} */ (document.querySelector("[data-ops-atgard]"));

  it("fingret öppnar menyn efter hålltiden, med contextmenu mitt i trycket öppnas den en gång och finns kvar", () => {
    rita();
    peka(rad(), "pointerdown", { pekare: "touch" });
    tid(300);
    peka(rad(), "contextmenu");
    expect(screen.getByRole("menuitem", { name: "Öppna" })).toBeInTheDocument();
    tid(LANGTRYCK_MS);
    peka(document, "pointerup");
    expect(screen.getAllByRole("menuitem", { name: "Öppna" })).toHaveLength(1);
  });

  it("musen: långsamt klick öppnar ingen meny, högerklick gör", () => {
    rita();
    peka(rad(), "pointerdown", { pekare: "mouse" });
    tid(LANGTRYCK_MS * 3);
    peka(document, "pointerup");
    expect(screen.queryByRole("menuitem", { name: "Öppna" })).toBeNull();
    fireEvent.contextMenu(rad());
    expect(screen.getByRole("menuitem", { name: "Öppna" })).toBeInTheDocument();
  });
});
