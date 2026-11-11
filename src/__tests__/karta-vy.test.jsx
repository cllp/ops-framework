import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { exempelkarta } from "../../examples/karta/dahab.js";

const FALGER = {
  "--color-karta-papper": "#faf7f1",
  "--color-karta-creme": "#f3eee4",
  "--color-karta-vatten": "#adbdac",
  "--color-karta-linje": "#cfc6b6",
  "--color-karta-lera": "#8a8073",
  "--color-karta-text": "#2e2a24",
  "--color-karta-salvia": "#4e7558",
  "--color-karta-ockra": "#bf9522",
  "--color-karta-terrakotta": "#c0683a",
  "--color-accent": "#8E7A4E",
  "--font-karta-ort": "Georgia, serif",
  "--font-karta-etikett": "sans-serif",
};

vi.mock("maplibre-gl", () => {
  class Map {
    constructor(opts) {
      this.opts = opts;
      this._on = {};
      this.paints = [];
      this.data = null;
      this.passning = null;
      this.traff = [];
      this.borttagen = false;
      this._laddad = false;
      (globalThis.__opsKartor ??= []).push(this);
    }
    on(ev, fn) {
      this._on[ev] = fn;
      if (ev === "load") queueMicrotask(() => {
        this._laddad = true;
        fn();
      });
      return this;
    }
    addControl(kontroll) {
      this.kontroll = kontroll;
      return this;
    }
    getSource(id) {
      if (id !== "objekt") return undefined;
      return { setData: (data) => { this.data = data; } };
    }
    setPaintProperty(lager, prop, varde) {
      this.paints.push([lager, prop, varde]);
    }
    queryRenderedFeatures() {
      return this.traff;
    }
    isStyleLoaded() {
      return this._laddad;
    }
    fitBounds(ruta, val) {
      this.passning = { ruta, val };
    }
    jumpTo(val) {
      this.passning = val;
    }
    resize() {}
    remove() {
      this.borttagen = true;
    }
  }
  class Popup {
    setLngLat(ll) {
      this.ll = ll;
      return this;
    }
    setDOMContent(el) {
      this.el = el;
      return this;
    }
    addTo(karta) {
      karta.opts.container.append(this.el);
      return this;
    }
  }
  class NavigationControl {
    constructor(val) {
      this.val = val;
    }
  }
  return { Map, Popup, NavigationControl, setWorkerUrl: vi.fn(), getWorkerUrl: () => "" };
});

function sattFarger() {
  for (const [namn, varde] of Object.entries(FALGER)) document.documentElement.style.setProperty(namn, varde);
}

beforeEach(() => {
  globalThis.__opsKartor = [];
  sattFarger();
});

afterEach(() => {
  cleanup();
  for (const namn of Object.keys(FALGER)) document.documentElement.style.removeProperty(namn);
});

describe("OpsKarta ritar exemplet", () => {
  it("visar en punkt, en linje och en yta, och ett tryck ger namn och beskrivning", async () => {
    const { OpsKarta } = await import("../components/OpsKarta.jsx");
    render(<OpsKarta data={exempelkarta} />);
    expect(await screen.findByRole("region", { name: "Karta" })).toBeTruthy();
    const karta = globalThis.__opsKartor[0];
    expect(karta.opts.style.layers.map((l) => l.id)).toEqual(expect.arrayContaining(["objekt-punkt", "objekt-linje", "objekt-yta"]));
    expect(karta.opts.attributionControl).toEqual({ compact: false });
    expect(karta.opts.cooperativeGestures).toBe(true);
    expect(karta.passning.ruta[0][1]).toBeCloseTo(28.4387);
    karta.traff = [{ layer: { id: "objekt-punkt" }, properties: { namn: "Blue Hole", beskrivning: "Dykplatsen norr om fyren." }, geometry: { type: "Point" } }];
    karta._on.click({ point: {}, lngLat: { lng: 34.5384, lat: 28.5721 } });
    expect(screen.getByText("Blue Hole").className).toContain("font-karta-ort");
    expect(screen.getByText("Dykplatsen norr om fyren.").className).toContain("font-karta-etikett");
  });

  it("ett namn som ser ut som HTML ritas som text", async () => {
    const { OpsKarta } = await import("../components/OpsKarta.jsx");
    render(<OpsKarta data={{ type: "FeatureCollection", features: [{ type: "Feature", properties: { namn: "Ren" }, geometry: { type: "Point", coordinates: [1, 2] } }] }} />);
    await screen.findByRole("region", { name: "Karta" });
    const karta = globalThis.__opsKartor.at(-1);
    karta.traff = [{ layer: { id: "objekt-punkt" }, properties: { namn: "<img src=x>", beskrivning: "ok" }, geometry: { type: "Point" } }];
    karta._on.click({ point: {}, lngLat: { lng: 1, lat: 2 } });
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText("<img src=x>")).toBeTruthy();
  });

  it("byter färg när temat byter, utan att flytta kartan", async () => {
    const { OpsKarta } = await import("../components/OpsKarta.jsx");
    render(<OpsKarta data={exempelkarta} />);
    await screen.findByRole("region", { name: "Karta" });
    const karta = globalThis.__opsKartor.at(-1);
    const fore = karta.passning;
    karta.paints = [];
    document.documentElement.style.setProperty("--color-karta-papper", "#010101");
    document.documentElement.setAttribute("data-theme", "dark");
    await waitFor(() => expect(karta.paints.some((p) => p[0] === "bakgrund" && p[2] === "#010101")).toBe(true));
    expect(karta.passning).toBe(fore);
    document.documentElement.removeAttribute("data-theme");
  });

  it("engelska ord när språket är engelska", async () => {
    const { OpsKarta } = await import("../components/OpsKarta.jsx");
    render(<OpsSprakProvider sprak="en"><OpsKarta data={exempelkarta} /></OpsSprakProvider>);
    expect(await screen.findByRole("region", { name: "Map" })).toBeTruthy();
    expect(globalThis.__opsKartor.at(-1).opts.locale["NavigationControl.ZoomIn"]).toBe("Zoom in");
  });

  it("saknade färger sägs, och ingen karta skapas", async () => {
    for (const namn of Object.keys(FALGER)) document.documentElement.style.removeProperty(namn);
    const { OpsKarta } = await import("../components/OpsKarta.jsx");
    const fore = globalThis.__opsKartor.length;
    render(<OpsKarta data={exempelkarta} />);
    expect((await screen.findByRole("alert")).textContent).toBe("Kartans färger saknas i temat.");
    expect(globalThis.__opsKartor.length).toBe(fore);
  });
});

describe("tomt och trasigt är svar", () => {
  it("en tom samling säger det, och en trasig fil säger att den inte går att läsa", async () => {
    const { OpsKarta } = await import("../components/OpsKarta.jsx");
    const { rerender } = render(<OpsKarta data={{ type: "FeatureCollection", features: [] }} />);
    expect(screen.getByRole("status").textContent).toBe("Kartan har inget att visa.");
    rerender(<OpsKarta data="{" />);
    expect(screen.getByRole("alert").textContent).toBe("Kartfilen går inte att läsa.");
  });

  it("utan data kastas det", async () => {
    const { OpsKarta } = await import("../components/OpsKarta.jsx");
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<OpsKarta />)).toThrow(/kräver data/);
    } finally {
      tyst.mockRestore();
    }
  });
});
