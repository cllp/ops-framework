import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

/*
 * Tråden på en post och kortets ritning läses in när de behövs (0.191.0, granskningen av PR 526). Före: `OpsBibliotek` importerade `BibliotekKommentarer` statiskt, och appens
 * `check:jsstorlek` växte med 1 318 byte från ramverket ensamt.
 *
 * ⛔ DET HÄR MÄTER BETEENDET, INTE KÄLLTEXTEN, som snabbmenyns prov: modulerna ersätts av sådana som räknar hur många gånger de utvärderats. Bytesmåttet i bundeln (`check:delbarhet`) är
 * det andra benet.
 */
afterEach(() => {
  cleanup();
  vi.resetModules();
});

const POST = { id: "a1", groupId: "kallan", typ: "anteckning", rubrik: "Protokoll", text: "x", skapadAv: { uid: "u", namn: "Kim" }, skapad: 1, andrad: 1 };
const kalla = () => ({ las: vi.fn(async () => ({ rader: [{ id: "post-a1", namn: "Anna", text: "Hej", tid: 1 }] })), kommentera: vi.fn(async () => {}) });

describe("BibliotekKommentarerLat", () => {
  /** @type {Array<() => void>} */
  let idle;
  beforeEach(() => {
    idle = [];
    window.requestIdleCallback = /** @type {any} */ ((fn) => {
      idle.push(fn);
      return idle.length;
    });
    window.cancelIdleCallback = /** @type {any} */ (() => {});
    vi.resetModules();
  });

  async function iBeredskap() {
    const utvarderad = vi.fn();
    vi.doMock("../components/BibliotekKommentarer.jsx", async () => {
      utvarderad();
      return vi.importActual("../components/BibliotekKommentarer.jsx");
    });
    const { OpsBibliotek } = await import("../components/OpsBibliotek.jsx");
    return { OpsBibliotek, utvarderad };
  }

  it("⛔ biblioteket utan en öppen post hämtar inte trådens kod; förladdningen gör det när webbläsaren har tid över, och bara med en källa", async () => {
    const { OpsBibliotek, utvarderad } = await iBeredskap();
    const { unmount } = render(<OpsBibliotek poster={[POST]} jag={null} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={async () => false} utanHubb />);
    expect(idle).toHaveLength(0);
    unmount();
    render(<OpsBibliotek poster={[POST]} jag={null} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={async () => false} utanHubb kommentarer={kalla()} />);
    expect(utvarderad).not.toHaveBeenCalled();
    expect(idle).toHaveLength(1);
    idle[0]();
    await waitFor(() => expect(utvarderad).toHaveBeenCalledTimes(1));
  });

  it("⛔ en öppnad post visar tråden när biten finns, utan snurra eller fel medan den hämtas", async () => {
    const { OpsBibliotek } = await iBeredskap();
    render(<OpsBibliotek poster={[POST]} jag={null} vald={POST} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={async () => false} utanHubb kommentarer={kalla()} />);
    expect(document.querySelector("[data-bibliotek-kommentarer-lasfel]")).toBeNull();
    expect(document.querySelector("[data-bibliotek-kommentarer]")).toBeNull();
    expect(await screen.findByText("Hej")).toBeTruthy();
  });

  it("⛔ går biten inte att hämta står en mening där tråden skulle ha varit, aldrig en tyst post utan tråd", async () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.doMock("../components/BibliotekKommentarer.jsx", () => {
      throw new Error("Failed to fetch dynamically imported module");
    });
    const { OpsBibliotek } = await import("../components/OpsBibliotek.jsx");
    render(<OpsBibliotek poster={[POST]} jag={null} vald={POST} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={async () => false} utanHubb kommentarer={kalla()} />);
    expect(await screen.findByText("Kommentarerna gick inte att läsa in. Ladda om sidan.")).toBeTruthy();
    expect(document.querySelector("[data-bibliotek-kommentarer-lasfel]")?.getAttribute("role")).toBe("alert");
    tyst.mockRestore();
  });
});

describe("kortets ritning", () => {
  it("⛔ bibliotekPostkort hämtar ritningen först när ett kort slås upp, och inte för en adress som inte är en post", async () => {
    const utvarderad = vi.fn();
    vi.doMock("../components/bibliotekPostkortVisning.jsx", async () => {
      utvarderad();
      return vi.importActual("../components/bibliotekPostkortVisning.jsx");
    });
    const { bibliotekPostkort } = await import("../components/bibliotekPostkort.jsx");
    const kort = bibliotekPostkort({ bas: "https://app.exempel.se/bibliotek", hamta: async () => POST });
    expect(utvarderad).not.toHaveBeenCalled();
    expect(await kort.slaUpp("https://extern.se/x")).toBeNull();
    expect(utvarderad).not.toHaveBeenCalled();
    expect(await kort.slaUpp("https://app.exempel.se/bibliotek?plats=kallan&post=a1")).toMatchObject({ titel: "Protokoll", undertitel: "Anteckning" });
    expect(utvarderad).toHaveBeenCalledTimes(1);
  });
});
