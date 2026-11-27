import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, render } from "@testing-library/react";
import { useRef } from "react";

import { useToppradRyms } from "../components/useToppradRyms.js";

/*
 * ⛔ TOPPRADEN MÄTS OM NÄR NÅGOT I DEN BYTER STORLEK (0.266.0, cllp/lifehub.app#909). CP lade ärendet i Att göra igen 2026-11-26. Kroken mätte bara när
 * skalet renderades, och en bild, ett typsnitt eller en räknare som växer efteråt ändrar inte radens egen bredd: ingen rendering, ingen mätning, och raden
 * rullade. Rött före: storleksbytet på en ikon gav ingen ny mätning, och taket förblev null fast raden inte rymdes.
 *
 * jsdom mäter ingen layout, så provet ger raden mått: varje synlig ikon är 44 px, och "bred" lägger till det som laddades in efteråt.
 */
let bred = false;
/** @type {{ cb: ResizeObserverCallback, mal: Set<Element> }[]} */
let iakttagare = [];
const original = { RO: globalThis.ResizeObserver, sw: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollWidth"), cw: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth"), gbcr: HTMLElement.prototype.getBoundingClientRect };

const synligaIkoner = (/** @type {Element} */ rad) => [...rad.querySelectorAll("a")].filter((a) => /** @type {HTMLElement} */ (a).style.display !== "none").length;

beforeEach(() => {
  bred = false;
  iakttagare = [];
  globalThis.ResizeObserver = /** @type {any} */ (
    class {
      /** @param {ResizeObserverCallback} cb */
      constructor(cb) {
        this.post = { cb, mal: new Set() };
        iakttagare.push(this.post);
      }
      /** @param {Element} el */
      observe(el) {
        this.post.mal.add(el);
      }
      unobserve() {}
      disconnect() {
        this.post.mal.clear();
      }
    }
  );
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get() { return this.dataset.rad !== undefined ? 300 : 0; } });
  Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
    configurable: true,
    get() {
      return this.dataset.rad !== undefined ? 44 * synligaIkoner(this) + (bred ? 200 : 100) : 0;
    },
  });
  HTMLElement.prototype.getBoundingClientRect = function () {
    const w = this.tagName === "A" && this.style.display !== "none" ? 44 : 0;
    return /** @type {DOMRect} */ ({ width: w, height: 44, top: 0, left: 0, right: w, bottom: 44, x: 0, y: 0, toJSON() {} });
  };
});

afterEach(() => {
  globalThis.ResizeObserver = original.RO;
  if (original.sw) Object.defineProperty(HTMLElement.prototype, "scrollWidth", original.sw);
  if (original.cw) Object.defineProperty(HTMLElement.prototype, "clientWidth", original.cw);
  HTMLElement.prototype.getBoundingClientRect = original.gbcr;
});

function Rad() {
  const ref = useRef(/** @type {HTMLDivElement | null} */ (null));
  const tak = useToppradRyms(ref, 3);
  return (
    <div ref={ref} data-rad="" data-tak={tak === null ? "null" : String(tak)}>
      {[0, 1, 2].map((i) => (
        <span key={i} data-huvudmeny-plats="" style={{ display: "contents" }}>
          <a href={`#app${i}`} style={{ display: tak !== null && i >= tak ? "none" : "" }}>
            app {i}
          </a>
        </span>
      ))}
      <img alt="profilbild" />
    </div>
  );
}

describe("⛔ toppraden mäts om när något i den byter storlek (#909)", () => {
  it("raden ryms vid renderingen; när en bild laddas och raden växer flyttas en ikon bakom «", () => {
    const { container } = render(<Rad />);
    const rad = /** @type {HTMLElement} */ (container.querySelector("[data-rad]"));
    expect(rad.dataset.tak).toBe("null");
    // Profilbilden laddas: raden blir bredare, men inget renderas om av sig själv.
    bred = true;
    const bild = /** @type {Element} */ (rad.querySelector("img"));
    const hor = iakttagare.filter((i) => i.mal.has(bild));
    expect(hor.length).toBeGreaterThan(0);
    act(() => {
      for (const i of hor) i.cb([{ target: bild }], /** @type {any} */ (null));
    });
    // 3 ikoner: 132 + 200 = 332 > 300. 2 ikoner: 88 + 200 = 288, ryms.
    expect(rad.dataset.tak).toBe("2");
    expect(rad.scrollWidth).toBeLessThanOrEqual(rad.clientWidth);
  });
});
