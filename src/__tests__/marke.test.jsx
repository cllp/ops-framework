import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { OpsBrand, delaNamn, standardMonogram } from "../components/OpsBrand.jsx";
import { OpsAppShell } from "../components/OpsAppShell.jsx";

/**
 * 0.31.0: märket är text. Provet mäter det som går att mäta utan CSS: vilka rader som ritas, vilken text de
 * bär, vilket monogram som härleds och att inget är en bild. Hur det SER UT (typsnitt, färg, spärrning,
 * centrering) mäts i en riktig webbläsare av `scripts/check-skalyta.mjs`, sektion 10.
 */

/** @param {() => void} kor @param {RegExp} message */
function forvantaKrasch(kor, message) {
  const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect(kor).toThrow(message);
  } finally {
    tyst.mockRestore();
  }
}

const rad1 = (/** @type {HTMLElement} */ c) => c.querySelector('[data-marke="rad1"]');
const rad2 = (/** @type {HTMLElement} */ c) => c.querySelector('[data-marke="rad2"]');

describe("OpsBrand: props och förval", () => {
  it("förvalet är OPS HUB med monogrammet OH, utan undertext", () => {
    const { container } = render(<OpsBrand panelInfalld={false} />);
    expect(rad1(container)?.textContent).toBe("OPS HUB");
    expect(rad2(container)).toBeNull();
    expect(container.querySelector('[data-marke="ruta"]')?.textContent).toBe("OH");
  });

  it("första ordet och resten är två spann, så de kan få varsin färg", () => {
    const { container } = render(<OpsBrand namn="OPS HUB" />);
    const spann = rad1(container)?.querySelectorAll("span") ?? [];
    expect(spann).toHaveLength(2);
    expect(spann[0].textContent).toBe("OPS");
    expect(spann[0].className).toContain("text-ink");
    expect(spann[1].textContent).toBe("HUB");
    expect(spann[1].className).toContain("text-marke-accent");
  });

  it("ett objekt { forsta, andra } bestämmer delningen själv", () => {
    const { container } = render(<OpsBrand namn={{ forsta: "TAM", andra: "STUDIO ÖST" }} />);
    const spann = rad1(container)?.querySelectorAll("span") ?? [];
    expect(spann[0].textContent).toBe("TAM");
    expect(spann[1].textContent).toBe("STUDIO ÖST");
    expect(container.querySelector('[data-marke="ruta"]')?.textContent).toBe("TSÖ");
  });

  it("`undertext` blir rad 2, och utan den finns ingen rad 2", () => {
    const { container, rerender } = render(<OpsBrand undertext="Claes Philip Staiger AB" />);
    expect(rad2(container)?.textContent).toBe("Claes Philip Staiger AB");
    rerender(<OpsBrand undertext="   " />);
    expect(rad2(container)).toBeNull();
  });

  it("`monogram` ersätter förvalet", () => {
    const { container } = render(<OpsBrand monogram="CP" />);
    expect(container.querySelector('[data-marke="ruta"]')?.textContent).toBe("CP");
  });

  it("ett namn med ett enda ord ger ett monogram med en bokstav och bara ett spann", () => {
    const { container } = render(<OpsBrand namn="TAM" />);
    expect(rad1(container)?.querySelectorAll("span")).toHaveLength(1);
    expect(container.querySelector('[data-marke="ruta"]')?.textContent).toBe("T");
  });

  it("vägrar ett tomt namn och en okänd storlek", () => {
    forvantaKrasch(() => render(<OpsBrand namn="   " />), /namn får inte vara tomt/);
    // @ts-expect-error avsiktligt fel storlek
    forvantaKrasch(() => render(<OpsBrand storlek="jätte" />), /okänd storlek/);
  });

  it("inga bilder, någonstans", () => {
    for (const el of [<OpsBrand key="a" />, <OpsBrand key="b" panelInfalld />, <OpsBrand key="c" storlek="stor" undertext="Appen" />]) {
      const { container, unmount } = render(el);
      expect(container.querySelectorAll("img")).toHaveLength(0);
      unmount();
    }
  });

  it("namnet står EN gång för skärmläsare och formerna är dolda för den", () => {
    const { container } = render(<OpsBrand panelInfalld={false} undertext="Testgruppen" />);
    expect(container.querySelector(".sr-only")?.textContent).toBe("OPS HUB, Testgruppen");
    expect(container.querySelector('[data-marke="ordmarke"]')?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector('[data-marke="monogram"]')?.getAttribute("aria-hidden")).toBe("true");
  });

  it("storlek stor ritar bara ordmärket, aldrig ett monogram", () => {
    const { container } = render(<OpsBrand storlek="stor" undertext="Bolag Ops" />);
    expect(rad1(container)?.className).toContain("text-(length:--marke-storlek-stor)");
    expect(container.querySelector('[data-marke="ruta"]')).toBeNull();
  });
});

describe("delaNamn och standardMonogram", () => {
  it("delar vid första blanksteget", () => {
    expect(delaNamn("OPS HUB")).toEqual({ forsta: "OPS", andra: "HUB" });
    expect(delaNamn("A B C")).toEqual({ forsta: "A", andra: "B C" });
    expect(delaNamn("  ENSAM ")).toEqual({ forsta: "ENSAM", andra: "" });
    expect(delaNamn({ forsta: "X", andra: "Y" })).toEqual({ forsta: "X", andra: "Y" });
  });

  it("monogrammet är första bokstaven i varje ord, versal", () => {
    expect(standardMonogram("OPS", "HUB")).toBe("OH");
    expect(standardMonogram("ops", "hub")).toBe("OH");
    expect(standardMonogram("A", "B C")).toBe("ABC");
    expect(standardMonogram("ÅSA", "")).toBe("Å");
  });
});

describe("OpsAppShell: märkets undertext är den aktiva gruppen", () => {
  const NAV = [{ href: "/", label: "Start" }];
  const GRUPPER = [
    { id: "g1", namn: { sv: "Claes Philip Staiger AB" } },
    { id: "g2", namn: { sv: "Testgruppen" } },
  ];
  const skal = (/** @type {any} */ grupper, /** @type {any} */ brand) =>
    render(
      <OpsAppShell nav={NAV} activeHref="/" brand={brand} grupper={grupper}>
        <p>x</p>
      </OpsAppShell>,
    );

  it("en vald grupp blir rad 2, i versaler", () => {
    const { container } = skal({ lista: GRUPPER, aktiv: "g1", onValj: () => {} }, undefined);
    expect(rad1(container)?.textContent).toBe("OPS HUB");
    expect(rad2(container)?.textContent).toBe("CLAES PHILIP STAIGER AB");
  });

  it("utan grupp (0.35.0: personen är inte med i någon) och utan undertext ritas bara rad 1", () => {
    const { container } = skal({ lista: [], aktiv: "", onValj: () => {} }, undefined);
    expect(rad2(container)).toBeNull();
  });

  it("utan grupp faller märket tillbaka på appens undertext, och en aktiv grupp vinner över den", () => {
    const ingen = skal({ lista: [], aktiv: "", onValj: () => {} }, <OpsBrand undertext="Bolag Ops" />);
    expect(rad2(ingen.container)?.textContent).toBe("Bolag Ops");
    ingen.unmount();
    const vald = skal({ lista: GRUPPER, aktiv: "g2", onValj: () => {} }, <OpsBrand undertext="Bolag Ops" />);
    expect(rad2(vald.container)?.textContent).toBe("TESTGRUPPEN");
  });

  it("utan grupper används appens undertext som den är", () => {
    const { container } = skal(undefined, <OpsBrand undertext="Bolag Ops" />);
    expect(rad2(container)?.textContent).toBe("Bolag Ops");
  });

  it("brand som sträng är märkets namn", () => {
    const { container } = skal(undefined, "TAM STUDIO");
    expect(rad1(container)?.textContent).toBe("TAM STUDIO");
  });

  it("panelläget följer med: infälld gör monogrammet synligt och ordmärket dolt", () => {
    const { container } = skal({ lista: GRUPPER, aktiv: "g1", onValj: () => {}, infalld: true }, undefined);
    expect(container.querySelector('[data-marke="monogram"]')?.className).toContain("opacity-100");
    expect(container.querySelector('[data-marke="ordmarke"]')?.className).toContain("opacity-0");
  });
});
