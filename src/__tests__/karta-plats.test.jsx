import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exempelkarta } from "../../examples/karta/dahab.js";
import { KARTLANK_MAX_PUNKTER, arAppleEnhet, glesaRutt, kartlankar } from "../lib/karta.js";

/**
 * ⛔ HÄNDELSEN (0.234.0). CP 2026-11-16: "Kan man få sin position i en karta också?" och "Samt en länk, öppna rutt eller position i telefonens
 * Kartor eller Google Maps om det är installerat." Kartan har MapLibres positionskontroll, och ett nej syns som en rad. En punkt och en rutt
 * har länkar ut, Kartor bara på en Apple-enhet.
 */

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
  "--color-karta-djuphav": "#1f4e5f",
  "--color-karta-oliv": "#7a8450",
  "--color-accent": "#8E7A4E",
  "--font-karta-ort": "Georgia, serif",
  "--font-karta-etikett": "sans-serif",
};

vi.mock("maplibre-gl", () => {
  class Map {
    constructor(opts) {
      // ⛔ SOM MAPLIBRE 6.17.0 UTAN WEBGL (map.ts:4242, GPUInitializationError): konstruktorn kastar synkront, före varje lyssnare.
      if (globalThis.__opsKartaUtanWebgl) throw new Error("Failed to initialize WebGL");
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
      (this.kontroller ??= []).push(kontroll);
      this.kontroll ??= kontroll;
      return this;
    }
    getSource(id) {
      if (id !== "objekt") return undefined;
      return { setData: (data) => { this.data = data; } };
    }
    setPaintProperty(lager, prop, varde) {
      this.paints.push([lager, prop, varde]);
    }
    // (0.258.0) Kartgrund, ortnamn och lagerfilter: anropen sparas, så att proven ser vad vyn satte.
    setLayoutProperty(lager, prop, varde) {
      (this.layouter ??= []).push([lager, prop, varde]);
    }
    getLayoutProperty(lager, prop) {
      return [...(this.layouter ?? [])].reverse().find(([l, p]) => l === lager && p === prop)?.[2];
    }
    setFilter(lager, filter) {
      (this.filter ??= {})[lager] = filter;
    }
    getLayer(id) {
      return (this.tillagda ?? []).includes(id) || !id.startsWith("terrang") ? { id } : undefined;
    }
    addLayer(lager) {
      (this.tillagda ??= []).push(lager.id);
    }
    removeLayer(id) {
      this.tillagda = (this.tillagda ?? []).filter((x) => x !== id);
    }
    addSource(id, kalla) {
      (this.kallor ??= {})[id] = kalla;
    }
    removeSource(id) {
      delete (this.kallor ?? {})[id];
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
    resize() {
      this.storlekar = (this.storlekar ?? 0) + 1;
    }
    remove() {
      this.borttagen = true;
    }
  }
  class Popup {
    constructor(opts) {
      this.opts = opts;
      (globalThis.__opsPopuper ??= []).push(this);
    }
    on(ev, fn) {
      (this._on ??= {})[ev] = fn;
      return this;
    }
    remove() {
      this.borttagen = true;
      this.el?.remove();
      this._on?.close?.();
      return this;
    }
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
  class GeolocateControl {
    constructor(val) {
      this.val = val;
      this._on = {};
      (globalThis.__opsPlatskontroller ??= []).push(this);
    }
    on(ev, fn) {
      this._on[ev] = fn;
      return this;
    }
  }
  class NavigationControl {
    constructor(val) {
      this.val = val;
    }
  }
  return { Map, Popup, NavigationControl, GeolocateControl, setWorkerUrl: vi.fn(), getWorkerUrl: () => "" };
});

function sattFarger() {
  for (const [namn, varde] of Object.entries(FALGER)) document.documentElement.style.setProperty(namn, varde);
}

const UA = Object.getOwnPropertyDescriptor(window.navigator, "userAgent");

beforeEach(() => {
  globalThis.__opsKartor = [];
  globalThis.__opsPlatskontroller = [];
  sattFarger();
});

afterEach(() => {
  cleanup();
  for (const namn of Object.keys(FALGER)) document.documentElement.style.removeProperty(namn);
  if (UA) Object.defineProperty(window.navigator, "userAgent", UA);
  else delete (/** @type {any} */ (window.navigator)).userAgent;
});

/** @param {string} ua */
function sattUa(ua) {
  Object.defineProperty(window.navigator, "userAgent", { configurable: true, get: () => ua });
}

async function rita() {
  const { OpsKarta } = await import("../components/OpsKarta.jsx");
  render(<OpsKarta data={exempelkarta} />);
  await screen.findByRole("region", { name: "Karta" });
  // ⛔ Regionen ritas före effekten som bygger kartan. Första provet i filen (som också hämtar vyn) läste annars kontrollen innan den fanns
  // (rött en gång i `npm run check`, grönt ensamt: en mätning som misslyckades, regel 14). Vänta på kartan, inte på regionen.
  await waitFor(() => expect(globalThis.__opsPlatskontroller.length).toBe(1));
  return { karta: globalThis.__opsKartor.at(-1), plats: globalThis.__opsPlatskontroller.at(-1) };
}

/** @param {any} karta @param {string} typ */
async function oppna(karta, typ) {
  const f = exempelkarta.features.find((x) => x.geometry.type === typ);
  karta.traff = [{ ...f, layer: { id: typ === "Point" ? "objekt-punkt" : "objekt-linje" } }];
  await act(async () => {
    karta._on.click({ point: { x: 10, y: 10 }, lngLat: { lng: 34.5, lat: 28.5 } });
  });
  return f;
}

describe("⛔ min position", () => {
  it("kontrollen läggs till med följ-läge och träffsäkerhetens cirkel, under zoomen", async () => {
    const { karta, plats } = await rita();
    expect(plats).toBeTruthy();
    expect(plats.val).toMatchObject({ trackUserLocation: true, showAccuracyCircle: true, showUserLocation: true });
    expect(karta.kontroller.indexOf(plats)).toBeGreaterThan(0);
    expect(karta.opts.locale["GeolocateControl.FindMyLocation"]).toBe("Visa min position");
  });

  it("ett nej visar raden om telefonens inställningar, och en hittad position tar bort den", async () => {
    const { plats } = await rita();
    expect(document.querySelector("[data-karta-plats-fel]")).toBeNull();
    await act(async () => plats._on.error({ code: 1 }));
    const rad = /** @type {HTMLElement} */ (document.querySelector("[data-karta-plats-fel]"));
    expect(rad.getAttribute("data-karta-plats-fel")).toBe("nekad");
    expect(rad.textContent).toBe("Platsen är avstängd i telefonens inställningar. Slå på den för att se var du är.");
    expect(rad.getAttribute("role")).toBe("status");
    await act(async () => plats._on.error({ code: 3 }));
    expect(document.querySelector("[data-karta-plats-fel]")?.textContent).toBe("Din position gick inte att hitta just nu.");
    await act(async () => plats._on.geolocate({}));
    expect(document.querySelector("[data-karta-plats-fel]")).toBeNull();
  });
});

describe("⛔ kartlankar: punkt och rutt", () => {
  it("en punkt ger lat,lng i rätt ordning och namnet kodat", () => {
    const l = kartlankar({ geometry: { type: "Point", coordinates: [18.0686, 59.3293] }, properties: { namn: "Café & Bar Ö" } });
    expect(l).toEqual({
      apple: "https://maps.apple.com/?ll=59.3293,18.0686&q=Caf%C3%A9%20%26%20Bar%20%C3%96",
      google: "https://www.google.com/maps/search/?api=1&query=59.3293%2C18.0686",
    });
  });

  it("en rutt ger start, slut och mellanpunkter, högst nio totalt", () => {
    const koord = Array.from({ length: 30 }, (_, i) => [10 + i, 50 + i / 10]);
    const l = /** @type {{ apple: string, google: string }} */ (kartlankar({ geometry: { type: "LineString", coordinates: koord } }));
    expect(l.apple).toBe("https://maps.apple.com/?saddr=50,10&daddr=52.9,39");
    const u = new URL(l.google);
    expect(u.origin + u.pathname).toBe("https://www.google.com/maps/dir/");
    expect(u.searchParams.get("api")).toBe("1");
    expect(u.searchParams.get("origin")).toBe("50,10");
    expect(u.searchParams.get("destination")).toBe("52.9,39");
    const mellan = /** @type {string} */ (u.searchParams.get("waypoints")).split("|");
    expect(mellan.length + 2).toBe(KARTLANK_MAX_PUNKTER);
    expect(mellan[0]).not.toBe("50,10");
    // En kort rutt behåller alla punkter, och två punkter ger inga mellanpunkter.
    const kort = new URL(/** @type {any} */ (kartlankar({ geometry: { type: "LineString", coordinates: [[1, 2], [3, 4]] } })).google);
    expect(kort.searchParams.has("waypoints")).toBe(false);
  });

  it("glesaRutt behåller start och slut, och en yta eller ogiltig koordinat ger ingen länk", () => {
    expect(glesaRutt([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 3)).toEqual([1, 6, 11]);
    expect(glesaRutt([1, 2], 9)).toEqual([1, 2]);
    expect(kartlankar({ geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } })).toBeNull();
    expect(kartlankar({ geometry: { type: "Point", coordinates: [200, 95] } })).toBeNull();
  });
});

describe("⛔ länkarna i popupen", () => {
  it("på en iPhone står Kartor och Google Maps, och de öppnas utanför appen", async () => {
    sattUa("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15");
    const { karta } = await rita();
    await oppna(karta, "Point");
    const apple = screen.getByRole("link", { name: "Öppna i Kartor" });
    const google = screen.getByRole("link", { name: "Öppna i Google Maps" });
    expect(apple.getAttribute("href")).toMatch(/^https:\/\/maps\.apple\.com\/\?ll=/);
    expect(google.getAttribute("target")).toBe("_blank");
    expect(google.getAttribute("rel")).toContain("noopener");
  });

  it("utanför en Apple-enhet står bara Google Maps, också för en rutt", async () => {
    sattUa("Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130 Mobile");
    expect(arAppleEnhet()).toBe(false);
    const { karta } = await rita();
    await oppna(karta, "LineString");
    expect(screen.queryByRole("link", { name: "Öppna i Kartor" })).toBeNull();
    expect(screen.getByRole("link", { name: "Öppna i Google Maps" }).getAttribute("href")).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1/);
  });
});
