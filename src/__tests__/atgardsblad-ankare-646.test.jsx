import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsAtgardsblad } from "../components/OpsAtgardsblad.jsx";
import { LANGTRYCK_MS } from "../lib/apparark.js";
import { bottenReservPx, punktRekt } from "../lib/menyAnkare.js";

/**
 * ⛔ RUTAN SITTER VID DET SOM ÖPPNADE DEN, OCH ALDRIG BAKOM BOTTENRADEN (0.185.0).
 *
 * CP 2026-11-04, lifehub.app v1.0.1114, Ärenden på telefon: menyn för ett kort öppnades under hela kortet och täckte nästa kort,
 * eller hamnade bakom bottenraden. Mätt här med en telefon på 390 x 844: kortet 400 till 500, ⋮ 410 till 454, bottenraden från 760.
 * En meny på 300 px får inte plats under ⋮ ovanför bottenraden (458 + 300 > 760 - 8) och ska vändas uppåt (410 - 4 - 300 = 106).
 * Med förankringen vid hela kortet och utan bottenraden som kant låg den under kortet, på 504, och nådde in bakom raden.
 */

const RUTA = { w: 224, h: 300 };
/** @type {Map<string, { top: number, left: number, w: number, h: number }>} */
const RUTOR = new Map([
  ["kort", { top: 400, left: 16, w: 358, h: 100 }],
  ["knapp", { top: 410, left: 326, w: 44, h: 44 }],
  ["nav", { top: 760, left: 0, w: 390, h: 84 }],
]);

/** @param {{ top: number, left: number, w: number, h: number }} r */
const rekt = (r) => ({ x: r.left, y: r.top, left: r.left, top: r.top, right: r.left + r.w, bottom: r.top + r.h, width: r.w, height: r.h, toJSON: () => ({}) });

beforeEach(() => {
  vi.stubGlobal("innerWidth", 390);
  vi.stubGlobal("innerHeight", 844);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
    const el = /** @type {HTMLElement} */ (this);
    if (el.matches("[data-ops-bottenrad]")) return /** @type {DOMRect} */ (rekt(/** @type {any} */ (RUTOR.get("nav"))));
    if (el.matches("[data-ops-atgard-knapp]")) return /** @type {DOMRect} */ (rekt(/** @type {any} */ (RUTOR.get("knapp"))));
    if (el.matches("[data-ops-atgard]")) return /** @type {DOMRect} */ (rekt(/** @type {any} */ (RUTOR.get("kort"))));
    if (el.matches("[role='dialog'], [data-radix-popper-content-wrapper]")) return /** @type {DOMRect} */ (rekt({ top: 0, left: 0, w: RUTA.w, h: RUTA.h }));
    return /** @type {DOMRect} */ (rekt({ top: 0, left: 0, w: 0, h: 0 }));
  });
  // Floating UI läser fönstrets storlek ur dokumentets clientWidth och clientHeight, som jsdom har som 0.
  vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(390);
  vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(844);
  for (const [k, v] of Object.entries({ offsetWidth: RUTA.w, offsetHeight: RUTA.h })) {
    vi.spyOn(HTMLElement.prototype, /** @type {any} */ (k), "get").mockImplementation(function () {
      return /** @type {HTMLElement} */ (this).matches("[role='dialog'], [data-radix-popper-content-wrapper]") ? v : 0;
    });
  }
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.innerHTML = "";
});

function rendera() {
  const nav = document.createElement("nav");
  nav.setAttribute("data-ops-bottenrad", "");
  document.body.appendChild(nav);
  render(
    <OpsAtgardsblad namn="Ärendet" kort poster={[{ id: "p", etikett: "Pågår", onValj: () => {} }, { id: "h", etikett: "Hanterad", onValj: () => {} }]}>
      <span>Ärendet</span>
    </OpsAtgardsblad>,
  );
}

/** Rutans läge som Radix satt det: `transform: translate(x, y)` på omslaget. */
async function lage() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  const omslag = /** @type {HTMLElement} */ (document.querySelector("[data-radix-popper-content-wrapper]"));
  const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(omslag.style.transform);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
}

describe("menyns ankare och bottenraden (0.185.0)", () => {
  it("bottenradens höjd mäts, och är 0 när raden saknas", () => {
    expect(bottenReservPx()).toBe(0);
    const nav = document.createElement("nav");
    nav.setAttribute("data-ops-bottenrad", "");
    document.body.appendChild(nav);
    expect(bottenReservPx()).toBe(84);
    expect(punktRekt({ left: 16, top: 400 }, { x: 24, y: 20 })).toMatchObject({ left: 40, top: 420, width: 0, height: 0 });
  });

  it("⋮ öppnar rutan vid ⋮, och den vänds uppåt i stället för att hamna bakom bottenraden", async () => {
    rendera();
    fireEvent.click(screen.getByRole("button", { name: /Ärendet/ }));
    const p = await lage();
    expect(p).not.toBeNull();
    expect(p?.y).toBe(106);
  });

  it("ett långtryck öppnar rutan vid fingret", async () => {
    vi.useFakeTimers();
    rendera();
    const rad = /** @type {HTMLElement} */ (document.querySelector("[data-ops-atgard]"));
    const ev = new MouseEvent("pointerdown", { bubbles: true, clientX: 60, clientY: 420 });
    Object.defineProperty(ev, "pointerType", { value: "touch" });
    Object.defineProperty(ev, "pointerId", { value: 1 });
    rad.dispatchEvent(ev);
    act(() => {
      vi.advanceTimersByTime(LANGTRYCK_MS + 10);
    });
    vi.useRealTimers();
    const p = await lage();
    // Fingret på y 420: rutan står direkt under fingret (424 + 300 = 724, ovanför bottenradens kant på 752), inte under hela kortet (504).
    expect(p?.y).toBe(424);
  });
});
