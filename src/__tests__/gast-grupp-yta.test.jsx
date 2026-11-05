import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsGastGrupp } from "../components/OpsGastGrupp.jsx";
import { OpsTabs, OpsTabPanel } from "../components/OpsTabs.jsx";
import { GASTGRUPPATGARDER } from "../lib/gast.js";

/**
 * Gästens gruppvy tar mindre plats i huvudet (0.188.0, cllp/lifehub.app#658, CP: "Flikarna är bra. Men kalender får inget utrymme"): ingressen bakom (i) efter första gången, och flikraden sitter kvar när sidan rullas.
 * jsdom mäter klasser, variabler och vad som finns i DOM:en; hur mycket plats kalendern får mäts i en riktig webbläsare (`web/e2e/gastkalender-658.mjs` i lifehub.app).
 * ⛔ VARJE PROV HAR SETTS FALLA (regel 4): rött med koden muterad, grönt med den. Utfallen står i PR-texten.
 */

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window.navigator, "language", "get").mockReturnValue("sv-SE");
});
afterEach(() => vi.restoreAllMocks());

const GRUPP = { namn: "Källan", funktioner: ["chatt", "kalender"] };
const HANDELSER = [{ id: "h1", titel: "Möte", datum: "2026-11-02", tid: "18:00", kravSvar: false, ejSatt: false }];

function apiMed() {
  const svar = {
    chatt: async () => ({ ok: true, meddelanden: [], fler: false }),
    kalender: async () => ({ ok: true, handelser: HANDELSER, kalendrar: [], avkortad: false, ejVisade: 0 }),
  };
  return Object.fromEntries(GASTGRUPPATGARDER.map((a) => [a, vi.fn(async (args) => (svar[a] ? svar[a](args ?? {}) : { ok: true }))]));
}

const lagringMed = (start = {}) => {
  const d = { ...start };
  return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; }, d };
};

const rita = (props = {}) => render(<OpsGastGrupp grupp={GRUPP} api={apiMed()} intervallMs={0} idag={new Date(2026, 10, 5)} {...props} />);
const ingress = () => document.querySelector("[data-gast-grupp-ingress]");
const infoKnapp = () => /** @type {HTMLElement} */ (document.querySelector("[data-gast-grupp-info]"));

describe("ingressen bakom (i)", () => {
  it("⛔ öppen första gången, och minns att den setts", async () => {
    const lagring = lagringMed();
    rita({ lagring });
    expect(ingress()?.textContent).toMatch(/Du är gäst i Källan/);
    expect(infoKnapp().getAttribute("aria-expanded")).toBe("true");
    await waitFor(() => expect(lagring.d["ops-gast:ingress-sedd"]).toBe("1"));
  });

  it("⛔ nästa gång är den stängd, (i) öppnar och stänger den, och knappen bär ett namn", () => {
    rita({ lagring: lagringMed({ "ops-gast:ingress-sedd": "1" }) });
    expect(ingress()).toBeNull();
    expect(infoKnapp().getAttribute("aria-expanded")).toBe("false");
    expect(infoKnapp().getAttribute("aria-label")).toBe("Om din roll som gäst");
    fireEvent.click(infoKnapp());
    expect(ingress()?.textContent).toMatch(/Du är gäst i Källan/);
    expect(infoKnapp().getAttribute("aria-controls")).toBe(ingress()?.id);
    fireEvent.click(infoKnapp());
    expect(ingress()).toBeNull();
  });

  it("⛔ går minnet inte att läsa (kastar, eller är null) är den öppen varje gång, och ett minne som inte går att skriva kastar inte", () => {
    const kastar = { getItem: () => { throw new Error("blockerat"); }, setItem: () => { throw new Error("blockerat"); } };
    const { unmount } = rita({ lagring: kastar });
    expect(ingress()).not.toBeNull();
    unmount();
    rita({ lagring: null });
    expect(ingress()).not.toBeNull();
  });

  it("på engelska säger (i) det på engelska", () => {
    rita({ sprak: "en", lagring: lagringMed({ "ops-gast:ingress-sedd": "1" }) });
    expect(infoKnapp().getAttribute("aria-label")).toBe("About your role as a guest");
  });
});

describe("flikraden sitter kvar", () => {
  it("⛔ gästens flikrad är sticky under sidhuvudet och har bakgrund, de tre flikarna är oförändrade", () => {
    rita({ lagring: lagringMed() });
    const rad = screen.getByRole("tablist");
    expect(rad.className).toMatch(/\bsticky\b/);
    expect(rad.className).toMatch(/top-14/);
    expect(rad.className).toMatch(/bg-canvas/);
    expect(screen.getAllByRole("tab").map((f) => f.textContent)).toEqual(["Chatt", "Kalender"]);
  });

  it("OpsTabs är som förut utan `fast`", () => {
    render(
      <OpsTabs tabs={[{ id: "a", label: "A" }]} value="a" onChange={() => {}} ariaLabel="Delar">
        <OpsTabPanel id="a">x</OpsTabPanel>
      </OpsTabs>,
    );
    expect(screen.getByRole("tablist").className).not.toMatch(/sticky/);
  });
});

describe("kalendern får resten av höjden (samma mekanism som skalet)", () => {
  it("⛔ kalenderns rullyta bär höjden ur --fullhojd-variablerna, och variablerna är satta på samma element", async () => {
    rita({ lagring: lagringMed() });
    await act(async () => {
      fireEvent.mouseDown(screen.getByRole("tab", { name: "Kalender" }), { button: 0 });
    });
    await waitFor(() => expect(document.querySelector("[data-gast-kalender]")).not.toBeNull());
    const yta = /** @type {HTMLElement | null} */ (document.querySelector('[data-gast-kalender] [class*="fullhojd"]'));
    expect(yta).not.toBeNull();
    expect(yta?.className).toMatch(/h-\[calc\(var\(--fullhojd-botten\)_-_var\(--fullhojd-topp\)\)\]/);
    expect(yta?.style.getPropertyValue("--fullhojd-topp")).toMatch(/^\d+px$/);
    expect(yta?.style.getPropertyValue("--fullhojd-botten")).toMatch(/^\d+px$/);
  });
});
