import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { OpsFargruta, OpsPalettForhandsvisning } from "../components/OpsPalett.jsx";
import { STANDARDPALETT, harledPalett } from "../lib/palett.js";

/** Förhandsvisningen och färgrutan (0.218.0, cllp/lifehub.app#786). Se filhuvudet i `OpsPalett.jsx`. */

const SS = {
  ljus: { bakgrund: "#f8f7f4", yta: "#f0ede8", text: "#1a1a1a", accent: "#5a564c" },
  mork: { bakgrund: "#121218", yta: "#1f1f25", text: "#e8e4df", accent: "#e8e0d0" },
};

afterEach(cleanup);

describe("OpsPalettForhandsvisning", () => {
  it("bär det valda temats token på rutan, och bara på rutan", () => {
    const { container } = render(<OpsPalettForhandsvisning palett={SS} lage="mork" rubrik="Repetition" detalj="Torsdag" knapp="Spara" />);
    const ruta = /** @type {HTMLElement} */ (container.querySelector("[data-forhandsvisning]"));
    expect(ruta.getAttribute("data-forhandsvisning")).toBe("mork");
    expect(ruta.style.getPropertyValue("--color-canvas")).toBe("#121218");
    expect(ruta.style.getPropertyValue("--color-raised")).toBe("#1f1f25");
    expect(ruta.style.getPropertyValue("--color-accent-contrast")).toBe(harledPalett(SS).mork["accent-contrast"]);
    expect(ruta.getAttribute("aria-hidden")).toBe("true");
    expect(document.documentElement.getAttribute("style") ?? "").not.toContain("--color-");
  });

  it("ett annat tema ger det temats värden", () => {
    const { container } = render(<OpsPalettForhandsvisning palett={STANDARDPALETT} lage="ljus" rubrik="R" detalj="D" knapp="K" />);
    expect(/** @type {HTMLElement} */ (container.querySelector("[data-forhandsvisning]")).style.getPropertyValue("--color-canvas")).toBe(STANDARDPALETT.ljus.bakgrund);
  });
});

describe("OpsFargruta", () => {
  it("ritar en färg i formen, och en tom ruta för allt annat", () => {
    const { container } = render(
      <>
        <OpsFargruta farg="#1f1f25" />
        <OpsFargruta farg="beige" />
        <OpsFargruta farg="#1F1F25" />
      </>,
    );
    const [ok, ord, versal] = /** @type {HTMLElement[]} */ ([...container.querySelectorAll("[data-fargruta]")]);
    expect(ok.style.backgroundColor).toBe("rgb(31, 31, 37)");
    expect(ord.getAttribute("style")).toBeNull();
    expect(versal.getAttribute("style")).toBeNull();
  });
});
