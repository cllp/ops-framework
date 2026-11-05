import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";

/*
 * Snabbmenyn läses in när den behövs (0.187.0, cllp/ops-framework#518). Före: `OpsAppShell` importerade `OpsSnabbmeny` statiskt, och menyns kod låg i varje apps startfil (cirka 1,7 kB gzip
 * i lifehub.app) för en meny som ritas först vid ett tryck på plus eller Appar.
 *
 * ⛔ DET HÄR MÄTER BETEENDET, INTE KÄLLTEXTEN: modulen `OpsSnabbmeny.jsx` ersätts av en som räknar hur många gånger den utvärderats. Ett grep efter ordet `lazy` hade stått grönt genom en statisk import som
 * någon lagt tillbaka. Bytesmåttet i bundeln (`check:delbarhet`) är det andra benet.
 */
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetModules();
});

describe("OpsSnabbmenyLat", () => {
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
    vi.doMock("../components/OpsSnabbmeny.jsx", async () => {
      utvarderad();
      const verklig = await vi.importActual("../components/OpsSnabbmeny.jsx");
      return verklig;
    });
    const { OpsSnabbmenyLat } = await import("../components/OpsSnabbmenyLat.jsx");
    return { OpsSnabbmenyLat, utvarderad };
  }

  function Host({ Meny, startOppen = false }) {
    const [oppen, setOppen] = useState(startOppen);
    return (
      <>
        <button type="button" data-ops-skapa-knapp="" onClick={() => setOppen(true)}>Plus</button>
        <Meny oppen={oppen} onOppen={setOppen} variant="skapa" etikett="Skapa" ankare="[data-ops-skapa-knapp]" poster={[{ id: "handelse", etikett: "Ny händelse", ikon: "nyHandelse", onValj: () => {} }]} />
      </>
    );
  }

  it("⛔ monteringen hämtar inte menyns kod: den hämtas först när webbläsaren har tid över, eller när någon trycker", async () => {
    const { OpsSnabbmenyLat, utvarderad } = await iBeredskap();
    render(<Host Meny={OpsSnabbmenyLat} />);
    expect(utvarderad).not.toHaveBeenCalled();
    expect(idle).toHaveLength(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("⛔ förladdningen hämtar modulen utan något tryck, och menyn öppnas sedan vid första trycket", async () => {
    const { OpsSnabbmenyLat, utvarderad } = await iBeredskap();
    render(<Host Meny={OpsSnabbmenyLat} />);
    idle[0]();
    await waitFor(() => expect(utvarderad).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Plus" }));
    expect(await screen.findByRole("dialog", { name: "Skapa" })).toBeTruthy();
    expect(utvarderad).toHaveBeenCalledTimes(1);
  });

  it("⛔ första trycket före förladdningen öppnar menyn ändå, utan en synlig väntan emellan", async () => {
    const { OpsSnabbmenyLat, utvarderad } = await iBeredskap();
    render(<Host Meny={OpsSnabbmenyLat} />);
    fireEvent.click(screen.getByRole("button", { name: "Plus" }));
    // Medan biten hämtas: ingen dialog, ingen snurra, inget felmeddelande.
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(await screen.findByRole("dialog", { name: "Skapa" })).toBeTruthy();
    expect(utvarderad).toHaveBeenCalledTimes(1);
  });

  it("saknas requestIdleCallback används en timer, och den hämtar modulen", async () => {
    // @ts-expect-error provet tar bort funktionen
    delete window.requestIdleCallback;
    vi.useFakeTimers();
    const { OpsSnabbmenyLat, utvarderad } = await iBeredskap();
    render(<Host Meny={OpsSnabbmenyLat} />);
    expect(utvarderad).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2000);
    vi.useRealTimers();
    await waitFor(() => expect(utvarderad).toHaveBeenCalledTimes(1));
  });

  it("menyn stannar monterad efter första öppningen: stängs och öppnas den igen är det samma meny", async () => {
    const { OpsSnabbmenyLat } = await iBeredskap();
    render(<Host Meny={OpsSnabbmenyLat} />);
    for (let gang = 1; gang <= 2; gang++) {
      fireEvent.click(screen.getByRole("button", { name: "Plus" }));
      await screen.findByRole("dialog", { name: "Skapa" });
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Skapa" }), `gång ${gang}`).toBeNull());
    }
  });

  it("⛔ går biten inte att hämta står en mening där menyn skulle ha varit, och ingen tyst meny", async () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.doMock("../components/OpsSnabbmeny.jsx", () => {
      throw new Error("Failed to fetch dynamically imported module");
    });
    const { OpsSnabbmenyLat } = await import("../components/OpsSnabbmenyLat.jsx");
    render(<Host Meny={OpsSnabbmenyLat} />);
    fireEvent.click(screen.getByRole("button", { name: "Plus" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Menyn gick inte att läsa in. Ladda om sidan.");
    tyst.mockRestore();
  });

  it("öppen från start monteras direkt", async () => {
    const { OpsSnabbmenyLat } = await iBeredskap();
    render(<Host Meny={OpsSnabbmenyLat} startOppen />);
    expect(await screen.findByRole("dialog", { name: "Skapa" })).toBeTruthy();
  });
});
