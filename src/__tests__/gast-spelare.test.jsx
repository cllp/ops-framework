import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsGastGrupp } from "../components/OpsGastGrupp.jsx";
import { GASTGRUPPATGARDER } from "../lib/gast.js";
import { nollstallSpelare } from "../lib/ljudspelare.js";

/**
 * Gästens spelare är appens (0.190.0, CP 2026-11-05 i cllp/lifehub.app#658, del P): "Jag vill ju att spelaren skall bli såhär och att man kan få upp den på samma sätt
 * som i appen." Ett tryck på Spela i gästens bibliotek visar spelraden (titel, Tryck för att spola, paus, stäng), och ett tryck på den öppnar arket (Spelar, vågen,
 * -10/+10, hastighet och Ladda ned). Adressen är gästens signerade (`fil`), hämtad först när någon trycker på Spela.
 *
 * ⛔ jsdom spelar inget: `play` och `pause` följer händelserna som i en webbläsare (samma som `spelare.test.jsx`). Var raden ligger (ovanför bottenraden i 390 px,
 * längst ned i 1280 px) mäts i en riktig webbläsare efter release.
 */

beforeEach(() => {
  nollstallSpelare();
  window.localStorage.clear();
  HTMLMediaElement.prototype.play = function play() {
    Object.defineProperty(this, "paused", { configurable: true, value: false });
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  };
  HTMLMediaElement.prototype.pause = function pause() {
    Object.defineProperty(this, "paused", { configurable: true, value: true });
    this.dispatchEvent(new Event("pause"));
  };
  HTMLMediaElement.prototype.load = function load() {};
});
afterEach(() => vi.restoreAllMocks());

const POSTER = [
  { id: "p-ljud", typ: "fil", rubrik: "Demo", fil: { sokvag: "p-ljud", namn: "demo.mp3", mime: "audio/mpeg", byte: 3000, klar: true }, durationMs: 61000, skapad: 4000, andrad: 4000, skapadAvNamn: "Agda" },
  { id: "p-pdf", typ: "fil", rubrik: "Låtlista", fil: { sokvag: "p-pdf", namn: "lat.pdf", mime: "application/pdf", byte: 1200, klar: true }, skapad: 5000, andrad: 5000, skapadAvNamn: "Maja" },
];

function apiMed() {
  const svar = {
    chatt: async () => ({ ok: true, meddelanden: [], fler: false }),
    bibliotek: async () => ({ ok: true, poster: POSTER, avkortad: false }),
    fil: async ({ postId }) => ({ ok: true, url: `https://lagring.example/${postId}?signerad=1`, namn: "x", mime: "audio/mpeg" }),
  };
  return Object.fromEntries(GASTGRUPPATGARDER.map((a) => [a, vi.fn(async (args) => (svar[a] ? svar[a](args ?? {}) : { ok: true, poster: [] }))]));
}

describe("gästens spelare", () => {
  it("⛔ Spela på ett ljud i biblioteket hämtar gästens signerade adress och visar spelraden; ett tryck på raden öppnar arket med Ladda ned på samma adress", async () => {
    const api = apiMed();
    render(<OpsGastGrupp grupp={{ namn: "Källan", funktioner: ["chatt", "bibliotek"] }} api={api} intervallMs={0} />);
    await act(async () => {
      fireEvent.mouseDown(screen.getByRole("tab", { name: "Bibliotek" }), { button: 0 });
    });
    await screen.findByText("Demo");
    // Ingen signering för listan: bara den som spelas.
    expect(api.fil).not.toHaveBeenCalled();
    expect(document.querySelector("[data-ops-spelrad]")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Spela Demo" }));
    });
    await waitFor(() => expect(api.fil).toHaveBeenCalledTimes(1));
    expect(api.fil).toHaveBeenCalledWith({ postId: "p-ljud" });
    const rad = /** @type {HTMLElement} */ (await waitFor(() => {
      const r = document.querySelector("[data-ops-spelrad]");
      expect(r).not.toBeNull();
      return r;
    }));
    expect(within(rad).getByText("Demo")).toBeInTheDocument();
    expect(within(rad).getByText("Tryck för att spola")).toBeInTheDocument();
    expect(within(rad).getByRole("button", { name: "Pausa Demo" })).toBeInTheDocument();
    expect(within(rad).getByRole("button", { name: "Stäng spelaren" })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(within(rad).getByRole("button", { name: "Öppna spelaren för Demo" }));
    });
    const ark = /** @type {HTMLElement} */ (document.querySelector("[data-ops-spelarark]"));
    expect(ark).not.toBeNull();
    expect(within(ark).getByText("Spelar")).toBeInTheDocument();
    expect(within(ark).getByRole("slider", { name: "Spola i Demo" })).toBeInTheDocument();
    expect(within(ark).getByRole("button", { name: "10 sekunder bakåt" })).toBeInTheDocument();
    expect(within(ark).getByRole("link", { name: "Ladda ned Demo" })).toHaveAttribute("href", "https://lagring.example/p-ljud?signerad=1");
    // Fortfarande en enda signering: arket använder adressen som redan hämtats.
    expect(api.fil).toHaveBeenCalledTimes(1);
  });

  it("på engelska är spelraden och arket engelska", async () => {
    render(<OpsGastGrupp grupp={{ namn: "Källan", funktioner: ["chatt", "bibliotek"] }} api={apiMed()} intervallMs={0} sprak="en" />);
    await act(async () => {
      fireEvent.mouseDown(screen.getByRole("tab", { name: "Library" }), { button: 0 });
    });
    await screen.findByText("Demo");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Play Demo" }));
    });
    const rad = /** @type {HTMLElement} */ (await waitFor(() => {
      const r = document.querySelector("[data-ops-spelrad]");
      expect(r).not.toBeNull();
      return r;
    }));
    expect(within(rad).getByText("Tap to scrub")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(within(rad).getByRole("button", { name: "Open the player for Demo" }));
    });
    const ark = /** @type {HTMLElement} */ (document.querySelector("[data-ops-spelarark]"));
    expect(within(ark).getByText("Playing")).toBeInTheDocument();
    expect(within(ark).getByRole("link", { name: "Download Demo" })).toHaveTextContent("Download");
    expect(ark.textContent).not.toMatch(/Spelar|Ladda ned|längd okänd/);
  });

  it("⛔ med nedladdning: false ritas ingen Ladda ned, varken i spelarens ark eller i en öppnad fil; spela och visa går som förut (0.190.0, del Q)", async () => {
    const api = apiMed();
    render(<OpsGastGrupp grupp={{ namn: "Källan", funktioner: ["chatt", "bibliotek"], nedladdning: false }} api={api} intervallMs={0} />);
    await act(async () => {
      fireEvent.mouseDown(screen.getByRole("tab", { name: "Bibliotek" }), { button: 0 });
    });
    await screen.findByText("Demo");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Spela Demo" }));
    });
    const rad = /** @type {HTMLElement} */ (await waitFor(() => {
      const r = document.querySelector("[data-ops-spelrad]");
      expect(r).not.toBeNull();
      return r;
    }));
    await act(async () => {
      fireEvent.click(within(rad).getByRole("button", { name: "Öppna spelaren för Demo" }));
    });
    const ark = /** @type {HTMLElement} */ (document.querySelector("[data-ops-spelarark]"));
    // Spelaren är kvar: vågen och knapparna.
    expect(within(ark).getByRole("slider", { name: "Spola i Demo" })).toBeInTheDocument();
    expect(within(ark).queryByRole("link", { name: /Ladda ned/ })).toBeNull();
    expect(ark.textContent).not.toContain("Ladda ned");
    await act(async () => {
      fireEvent.click(within(ark).getByRole("button", { name: "Fäll ihop spelaren" }));
    });
    // En PDF: den visas i appens egen vy och kan presenteras (CP 2026-11-06, #530: gäster får presentera), men ingen Ladda ned.
    const hamta = vi.spyOn(globalThis, "fetch").mockResolvedValue(/** @type {any} */ ({ ok: true, status: 200, blob: async () => new Blob(["%PDF"], { type: "application/pdf" }) }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Låtlista" }));
    });
    expect(await screen.findByRole("button", { name: "Helskärm" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ladda ned" })).toBeNull();
    expect(document.querySelector("[data-bibliotek-ladda-ned], [data-pdf-ladda-ned]")).toBeNull();
    hamta.mockRestore();
  });

  it("utan nedladdning i svaret (som förut) står Ladda ned i en öppnad fil", async () => {
    render(<OpsGastGrupp grupp={{ namn: "Källan", funktioner: ["chatt", "bibliotek"] }} api={apiMed()} intervallMs={0} />);
    await act(async () => {
      fireEvent.mouseDown(screen.getByRole("tab", { name: "Bibliotek" }), { button: 0 });
    });
    await screen.findByText("Låtlista");
    const hamta = vi.spyOn(globalThis, "fetch").mockResolvedValue(/** @type {any} */ ({ ok: true, status: 200, blob: async () => new Blob(["%PDF"], { type: "application/pdf" }) }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Låtlista" }));
    });
    // (0.193.0, #530) Ladda ned står i PDF-vyns rad.
    expect(await screen.findByRole("button", { name: "Ladda ned" })).toBeTruthy();
    expect(document.querySelector("[data-pdf-ladda-ned]")).not.toBeNull();
    hamta.mockRestore();
  });
});
