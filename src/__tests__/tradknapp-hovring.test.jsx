import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsGastGrupp } from "../components/OpsGastGrupp.jsx";
import { tradknappKlass } from "../components/OpsMeddelanden.jsx";
import { GASTGRUPPATGARDER } from "../lib/gast.js";

/*
 * 0.200.1: "Svara i tråd" och "N svar" får ingen fylld bakgrund vid hovring.
 *
 * CP 2026-11-07, med en skärmbild av gästens chatt på datorn: "själva bubblan vid hover har samma färg och ingen ram, så den smälter ihop."
 * Knappen står mellan två meddelanden och går in i raderna med `-my-2` (så att träffytan är 44 px utan att raden växer). Med `hover:bg-hover`
 * fick den samma ton som bubblorna och såg ut som en tredje bubbla mellan dem. Nu ändras bara texten (färg och understrykning), och
 * fokusramen för tangentbordet står kvar. Knappen är densamma i medlemmens chatt (`tradknappKlass`), så båda följer.
 * ⛔ RÖTT UTAN ÄNDRINGEN (regel 4): med 0.200.0:s `tradknappKlass` faller alla tre fallen.
 */

/** Klasserna som fyller en bakgrund vid hovring eller via gruppens hovring. @param {string} klass */
const fyllning = (klass) => klass.split(/\s+/).filter((k) => /^(?:[a-z-]+:)*hover:bg-/.test(k) || /^(?:[a-z-]+:)*group-hover:bg-/.test(k));

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window.navigator, "language", "get").mockReturnValue("sv-SE");
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("trådknappen fyller ingen bakgrund vid hovring", () => {
  it("⛔ Svara i tråd (ingen tråd än): ingen hover:bg, men texten ändras vid hovring och fokusramen står kvar", () => {
    const k = tradknappKlass(false);
    expect(fyllning(k)).toEqual([]);
    expect(k.split(/\s+/)).toContain("hover:text-ink");
    expect(k.split(/\s+/)).toContain("focus-visible:outline-2");
  });

  it("⛔ N svar (tråd finns): ingen hover:bg, understruken vid hovring", () => {
    const k = tradknappKlass(true);
    expect(fyllning(k)).toEqual([]);
    expect(k.split(/\s+/)).toContain("hover:underline");
  });

  it("⛔ den ritade Svara i tråd i gästens chatt (CP:s skärmbild) har ingen fyllning", async () => {
    const T = (m) => Date.UTC(2026, 9, 19, 9, m);
    const meddelanden = [
      { id: "m1", av: { namn: "Agda Ägare" }, text: "Välkommen", tid: T(0), svar: 2 },
      { id: "m2", av: { namn: "Maja Medlem" }, text: "Hej alla", tid: T(5) },
    ];
    const api = Object.fromEntries(
      GASTGRUPPATGARDER.map((a) => [a, vi.fn(async () => (a === "chatt" ? { ok: true, meddelanden, fler: false } : { ok: false, orsak: "nej" }))]),
    );
    render(<OpsGastGrupp grupp={{ namn: "Källan", funktioner: ["chatt"] }} api={api} intervallMs={0} idag={new Date(2026, 9, 20)} />);
    const flik = screen.queryByRole("tab", { name: "Chatt" });
    if (flik) {
      await act(async () => {
        fireEvent.mouseDown(flik, { button: 0 });
      });
    }
    await screen.findByText("Välkommen", { selector: "[data-bubbla] *" });
    const knappar = /** @type {HTMLElement[]} */ ([...document.querySelectorAll("button[data-tradmarke]")]);
    // Golv (regel 4): Svara i tråd under meddelandet utan svar. Meddelandet med svar visar "2 svar" i stället (gästens egen knapp, inte trådknappen).
    expect(knappar.length).toBeGreaterThanOrEqual(1);
    expect(knappar.map((b) => b.dataset.tradmarke)).toContain("ny");
    for (const b of knappar) expect(fyllning(b.className)).toEqual([]);
  });
});
