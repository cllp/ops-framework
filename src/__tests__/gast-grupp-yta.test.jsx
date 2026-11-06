import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

const rita = (/** @type {Record<string, any>} */ { lagring: _bortlagd, ...props } = {}) => render(<OpsGastGrupp grupp={GRUPP} api={apiMed()} intervallMs={0} idag={new Date(2026, 10, 5)} {...props} />);
const ingress = () => document.querySelector("[data-gast-grupp-ingress]");

describe("översikten (0.192.0)", () => {
  it("⛔ landar på översikt: gruppnamnet är rubriken, Du är gäst står där, och behörigheten följer funktionerna", () => {
    rita();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Källan");
    expect(document.querySelector("[data-gast-roll]")?.textContent).toBe("Du är gäst.");
    expect(document.querySelector("[data-gast-oversikt]")?.textContent).toMatch(/Du kan läsa och skriva i chatten, från början/);
    expect(document.querySelector("[data-gast-oversikt]")?.textContent).toMatch(/Du kan se vad som är på gång/);
    expect(document.querySelector("[data-gast-oversikt]")?.textContent).not.toMatch(/biblioteket|ladda ned|ärenden/i);
    expect(document.querySelector("[data-gast-grupp-info]")).toBeNull();
    expect(ingress()).toBeNull();
    expect(screen.queryByText(/Du är gäst i Källan/)).toBeNull();
  });

  it("på engelska heter fliken Overview och rollen sägs på engelska", () => {
    rita({ sprak: "en" });
    expect(screen.getAllByRole("tab").map((f) => f.textContent)[0]).toBe("Overview");
    expect(document.querySelector("[data-gast-roll]")?.textContent).toBe("You are a guest.");
  });
});

describe("flikraden sitter kvar", () => {
  it("⛔ gästens flikrad är sticky under sidhuvudet och har bakgrund, de tre flikarna är oförändrade", () => {
    rita();
    const rad = screen.getByRole("tablist");
    expect(rad.className).toMatch(/\bsticky\b/);
    expect(rad.className).toMatch(/top-12/);
    expect(rad.className).toMatch(/bg-canvas/);
    expect(screen.getAllByRole("tab").map((f) => f.textContent)).toEqual(["Översikt", "Chatt", "Kalender"]);
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

// (0.190.0, del C) "Kalendern får resten av höjden" (0.188.0) mätte månadsvyns egen rullyta. Gästen har ingen månadsvy längre, och höjden på telefonen
// bärs av gästens yta mellan huvudet och bottenraden (del B nedan), samma mekanism som skalet.

describe("telefonen: bottenrad och hela höjden (0.190.0, del B)", () => {
  /** @param {boolean} smal */
  const skarm = (smal) => vi.stubGlobal("matchMedia", (/** @type {string} */ q) => ({ matches: q.includes("max-width") ? smal : false, media: q, addEventListener: () => {}, removeEventListener: () => {} }));
  afterEach(() => vi.unstubAllGlobals());

  it("⛔ gruppens namn står en gång (0.195.0): på telefonen som rubrik i Översikt och inte i de andra flikarna, på datorn över flikarna", async () => {
    skarm(true);
    const { unmount } = render(<OpsGastGrupp grupp={{ namn: "Källan", funktioner: ["chatt", "kalender"] }} api={apiMed()} intervallMs={0} idag={new Date(2026, 10, 5)} />);
    const rubriker = screen.getAllByRole("heading", { level: 1 });
    expect(rubriker.map((h) => h.textContent)).toEqual(["Källan"]);
    expect(rubriker[0].closest("[data-gast-oversikt]")).not.toBeNull();
    fireEvent.click(within(/** @type {HTMLElement} */ (document.querySelector("nav[data-ops-bottenrad]"))).getByText("Chatt"));
    await waitFor(() => expect(document.querySelector("[data-gast-chatt]")).not.toBeNull());
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    unmount();
    skarm(false);
    render(<OpsGastGrupp grupp={{ namn: "Källan", funktioner: ["chatt", "kalender"] }} api={apiMed()} intervallMs={0} idag={new Date(2026, 10, 5)} />);
    const dator = screen.getAllByRole("heading", { level: 1 });
    expect(dator.map((h) => h.textContent)).toEqual(["Källan"]);
    expect(dator[0].closest("[data-gast-oversikt]")).toBeNull();
    expect(dator[0].compareDocumentPosition(screen.getByRole("tablist")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("⛔ under md är flikarna en bottenrad utan Meny och utan mittknapp, och innehållet fyller höjden ut till raden", async () => {
    skarm(true);
    const api = apiMed();
    render(<OpsGastGrupp grupp={{ namn: "Källan", funktioner: ["chatt", "kalender", "bibliotek"] }} api={api} intervallMs={0} idag={new Date(2026, 10, 5)} />);
    expect(screen.queryByRole("tablist")).toBeNull();
    const rad = /** @type {HTMLElement} */ (document.querySelector("nav[data-ops-bottenrad]"));
    expect(rad).not.toBeNull();
    // Golv: tre platser, alla länkar, ingen Meny och ingen rund knapp.
    expect([...rad.querySelectorAll("a")].map((a) => a.textContent)).toEqual(["Översikt", "Chatt", "Kalender", "Bibliotek"]);
    expect(rad.querySelectorAll("button")).toHaveLength(0);
    expect(rad.querySelector("a[aria-current='page']")?.textContent).toBe("Översikt");
    const yta = /** @type {HTMLElement} */ (document.querySelector("[data-gast-telefonyta]"));
    expect(yta.className).toContain("h-[calc(var(--fullhojd-botten)_-_var(--fullhojd-topp))]");
    expect(yta.style.getPropertyValue("--fullhojd-botten")).toMatch(/px$/);
    expect(yta.querySelector("[data-gast-oversikt]")).not.toBeNull();
    expect(yta.querySelector("[data-gast-chatt]")).toBeNull();
    fireEvent.click(within(rad).getByText("Chatt"));
    await waitFor(() => expect(document.querySelector("[data-gast-chatt][data-fyll]")).not.toBeNull());
    // Kalender i raden byter innehåll, och adressen ändras inte.
    fireEvent.click(within(rad).getByText("Kalender"));
    await waitFor(() => expect(api.kalender).toHaveBeenCalledTimes(1));
    expect(document.querySelector("[data-gast-telefonyta]")?.getAttribute("data-gast-telefonyta")).toBe("kalender");
    expect(rad.querySelector("a[aria-current='page']")?.textContent).toBe("Kalender");
    expect(window.location.hash).toBe("");
  });

  it("på dator ligger flikarna kvar högst upp och ingen bottenrad ritas", () => {
    skarm(false);
    render(<OpsGastGrupp grupp={{ namn: "Källan", funktioner: ["chatt", "kalender"] }} api={apiMed()} intervallMs={0} />);
    expect(screen.getByRole("tablist").className).toMatch(/\bsticky\b/);
    expect(document.querySelector("nav[data-ops-bottenrad]")).toBeNull();
    expect(document.querySelector("[data-gast-chatt][data-fyll]")).toBeNull();
  });

  it("⛔ OpsBottomNav utanMeny kastar när en post inte får plats i raden, i stället för att gömma den", async () => {
    const { OpsBottomNav } = await import("../components/OpsBottomNav.jsx");
    const nav = ["a", "b", "c", "d", "e"].map((x) => ({ href: `#${x}`, label: x }));
    expect(() => render(<OpsBottomNav nav={nav} activeHref="#a" utanMeny />)).not.toThrow();
    expect(() => render(<OpsBottomNav nav={[...nav, { href: "#f", label: "f" }]} activeHref="#a" utanMeny />)).toThrow(/får inte plats/);
    const { unmount } = render(<OpsBottomNav nav={nav.slice(0, 3)} activeHref="#a" utanMeny />);
    expect(screen.queryByText("Meny")).toBeNull();
    unmount();
    render(<OpsBottomNav nav={nav.slice(0, 3)} activeHref="#a" />);
    expect(screen.getByText("Meny")).toBeInTheDocument();
  });
});
