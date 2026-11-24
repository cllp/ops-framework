import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exempelkarta } from "../../examples/karta/dahab.js";

/**
 * ⛔ HÄNDELSEN (0.234.0). CP 2026-11-16: "Jag kan inte få en fullscreen för kartor, det är ett måste." Kartan får PDF-vyns Helskärm
 * (0.196.0, `useHelskarm`): webbläsarens helskärm där den finns, annars ett fast lager med Stäng och Escape, och kartan ritas om till
 * den nya storleken.
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
      // Som MapLibre 6.17.0: `cooperativeGestures` är en hanterare med enable och disable (maplibre-gl.d.ts, CooperativeGesturesHandler).
      this.cooperativeGestures = { pa: Boolean(opts.cooperativeGestures), enable() { this.pa = true; }, disable() { this.pa = false; }, isEnabled() { return this.pa; } };
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
    trigger() {
      this.triggad = (this.triggad ?? 0) + 1;
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

const forr = { enabled: Object.getOwnPropertyDescriptor(document, "fullscreenEnabled"), element: Object.getOwnPropertyDescriptor(document, "fullscreenElement"), request: HTMLElement.prototype.requestFullscreen, exit: document.exitFullscreen };

beforeEach(() => {
  globalThis.__opsKartor = [];
  sattFarger();
});

afterEach(() => {
  cleanup();
  for (const namn of Object.keys(FALGER)) document.documentElement.style.removeProperty(namn);
  if (forr.enabled) Object.defineProperty(document, "fullscreenEnabled", forr.enabled);
  else delete (/** @type {any} */ (document)).fullscreenEnabled;
  if (forr.element) Object.defineProperty(document, "fullscreenElement", forr.element);
  else delete (/** @type {any} */ (document)).fullscreenElement;
  HTMLElement.prototype.requestFullscreen = forr.request;
  document.exitFullscreen = forr.exit;
});

async function rita() {
  const { OpsKarta } = await import("../components/OpsKarta.jsx");
  render(<OpsKarta data={exempelkarta} />);
  const region = await screen.findByRole("region", { name: "Karta" });
  // Regionen ritas före effekten som bygger kartan: vänta på kartan, inte bara på regionen.
  await waitFor(() => expect(globalThis.__opsKartor.length).toBeGreaterThan(0));
  return { region, karta: globalThis.__opsKartor.at(-1) };
}

describe("⛔ kartans helskärm", () => {
  it("knappen Helskärm finns på kartan", async () => {
    await rita();
    expect(screen.getByRole("button", { name: "Helskärm" })).toBeTruthy();
  });

  it("helskärm anropas på kartans yta där webbläsaren har den, och kartan ritas om", async () => {
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, get: () => true });
    let i = null;
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => i });
    const request = vi.fn(function () {
      i = this;
      document.dispatchEvent(new Event("fullscreenchange"));
      return Promise.resolve();
    });
    HTMLElement.prototype.requestFullscreen = /** @type {any} */ (request);
    document.exitFullscreen = /** @type {any} */ (vi.fn(() => {
      i = null;
      document.dispatchEvent(new Event("fullscreenchange"));
      return Promise.resolve();
    }));
    const { region, karta } = await rita();
    const fore = karta.storlekar ?? 0;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Helskärm" }));
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.contexts[0]).toBe(region);
    expect(region.getAttribute("data-karta-helskarm")).toBe("helskarm");
    expect(karta.storlekar ?? 0).toBeGreaterThan(fore);
    const iHelskarm = karta.storlekar;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Stäng helskärm" }));
    });
    expect(document.exitFullscreen).toHaveBeenCalled();
    expect(region.getAttribute("data-karta-helskarm")).toBeNull();
    expect(karta.storlekar).toBeGreaterThan(iHelskarm);
  });

  it("utan API:t öppnas ett fast lager över skärmen, med Stäng och Escape", async () => {
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, get: () => false });
    const { region, karta } = await rita();
    const fore = karta.storlekar ?? 0;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Helskärm" }));
    });
    expect(region.getAttribute("data-karta-helskarm")).toBe("fonster");
    expect(region.className).toContain("fixed");
    expect(region.className).toContain("inset-0");
    expect(region.className).toContain("pt-(--safe-top)");
    expect(karta.storlekar).toBeGreaterThan(fore);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Stäng helskärm" }));
    });
    expect(region.getAttribute("data-karta-helskarm")).toBeNull();
    expect(region.className).not.toContain("fixed");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Helskärm" }));
    });
    expect(region.getAttribute("data-karta-helskarm")).toBe("fonster");
    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(region.getAttribute("data-karta-helskarm")).toBeNull();
  });

  /**
   * ⛔ HÄNDELSEN (0.258.0, cllp/lifehub.app#950 skiva 1). Tvåfingersläget finns för att sidan ska gå att rulla förbi kartan. I helskärm finns
   * ingen sida att rulla, och där flyttade ett finger ingenting, som om kartan var trasig. Rött utan ändringen: tvåfingersläget stod kvar på.
   */
  it("i helskärm flyttar ett finger kartan, och utanför helskärm krävs två igen", async () => {
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, get: () => false });
    const { karta } = await rita();
    expect(karta.cooperativeGestures.isEnabled()).toBe(true);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Helskärm" }));
    });
    expect(karta.cooperativeGestures.isEnabled()).toBe(false);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Stäng helskärm" }));
    });
    expect(karta.cooperativeGestures.isEnabled()).toBe(true);
  });

  it("avslår webbläsaren helskärmen blir det lagret, aldrig ingenting", async () => {
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, get: () => true });
    HTMLElement.prototype.requestFullscreen = /** @type {any} */ (vi.fn(() => Promise.reject(new Error("nej"))));
    const { region } = await rita();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Helskärm" }));
    });
    expect(region.getAttribute("data-karta-helskarm")).toBe("fonster");
  });
});

/**
 * ⛔ HÄNDELSEN (0.234.0). CP 2026-11-16, med en skärmbild i mörkt läge: "kontrasterna funkar inte på locations". Rubriken stod i
 * `text-karta-text`, som är nästan vit i mörkt läge, på MapLibres vita ruta. Rutan bär nu appens yta och texten appens bläck, och
 * krysset är en knapp med namn och en träffyta på 44 px.
 */
describe("⛔ popupen i appens token", () => {
  async function oppnaPopup() {
    globalThis.__opsPopuper = [];
    const { karta } = await rita();
    const punkt = exempelkarta.features.find((f) => f.geometry.type === "Point");
    karta.traff = [{ ...punkt, layer: { id: "objekt-punkt" } }];
    await act(async () => {
      karta._on.click({ point: { x: 10, y: 10 }, lngLat: { lng: 34.5, lat: 28.5 } });
    });
    return { popup: globalThis.__opsPopuper.at(-1), namn: punkt.properties.namn };
  }

  it("rutan och texten kommer från appens token, aldrig vitt", async () => {
    const { popup, namn } = await oppnaPopup();
    expect(popup.opts).toMatchObject({ closeButton: false, className: "ops-karta-popup" });
    const stil = document.getElementById("ops-karta-popup-stil")?.textContent ?? "";
    expect(stil).toMatch(/\.ops-karta-popup \.maplibregl-popup-content\{[^}]*background:var\(--color-raised\)/);
    expect(stil).toMatch(/\.ops-karta-popup \.maplibregl-popup-content\{[^}]*color:var\(--color-ink\)/);
    expect(stil).toMatch(/maplibregl-popup-anchor-bottom \.maplibregl-popup-tip[^{]*\{border-top-color:var\(--color-raised\)/);
    expect(stil).not.toMatch(/#fff|white/i);
    const rubrik = screen.getByText(namn);
    expect(rubrik.className).toContain("text-ink");
    expect(rubrik.className).not.toContain("text-karta-text");
  });

  it("Stäng är en knapp med namn och 44 px, och stänger popupen", async () => {
    const { popup } = await oppnaPopup();
    const stang = screen.getByRole("button", { name: "Stäng" });
    expect(stang.className).toContain("size-11");
    fireEvent.click(stang);
    expect(popup.borttagen).toBe(true);
    expect(screen.queryByRole("button", { name: "Stäng" })).toBeNull();
  });
});

/** Sätter skärmbredden som `useBredKarta` läser: dator från 768 px, annars telefon. */
function bredd(dator) {
  window.matchMedia = /** @type {any} */ ((q) => ({ matches: dator && q.includes("768"), media: q, addEventListener() {}, removeEventListener() {} }));
}

async function oppnaHelskarm() {
  Object.defineProperty(document, "fullscreenEnabled", { configurable: true, get: () => false });
  const r = await rita();
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Helskärm" }));
  });
  return r;
}

/**
 * ⛔ SKIVA 3 (0.258.0, cllp/lifehub.app#950). CP 2026-11-24: panelerna Lager och Inställningar, som går att fälla ut på ett bra sätt, och bara i den
 * öppnade kartan. Info kommer i skiva 5.
 */
describe("⛔ kartans paneler", () => {
  const forrMedia = window.matchMedia;
  afterEach(() => {
    window.matchMedia = forrMedia;
    try {
      localStorage.removeItem("ops-karta-paneler-v1");
    } catch {
      // ingen lagring i miljön
    }
  });

  it("finns inte i rutan, bara i den öppnade kartan", async () => {
    bredd(false);
    await rita();
    expect(document.querySelector("[data-karta-paneler]")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Helskärm" }));
    });
    expect(document.querySelector('[data-karta-paneler="telefon"]')).toBeTruthy();
  });

  it("telefon: allt är infällt, en knapp öppnar ett halvt ark, handtaget växlar till helt och krysset fäller in", async () => {
    bredd(false);
    await oppnaHelskarm();
    expect(document.querySelector("[data-karta-ark]")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Lager" }));
    });
    const ark = () => document.querySelector("[data-karta-ark]");
    expect(ark()?.getAttribute("data-karta-ark")).toBe("halv");
    expect(ark()?.getAttribute("data-karta-panel")).toBe("lager");
    await act(async () => {
      fireEvent.keyDown(screen.getByRole("button", { name: "Visa panelen över nästan hela skärmen" }), { key: "Enter" });
    });
    expect(ark()?.getAttribute("data-karta-ark")).toBe("hel");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Inställningar" }));
    });
    expect(ark()?.getAttribute("data-karta-panel")).toBe("installningar");
    expect(document.querySelectorAll("[data-karta-ark]").length).toBe(1);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Fäll in inställningar" }));
    });
    expect(ark()).toBeNull();
  });

  it("dator: panelerna är flikar vid kanten, en flik fäller ut, och läget minns", async () => {
    bredd(true);
    await oppnaHelskarm();
    expect(document.querySelector('[data-karta-flik="lager"]')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Fäll ut lager" }));
    });
    expect(document.querySelector('[data-karta-panel="lager"]')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("ops-karta-paneler-v1") ?? "{}")).toEqual({ lager: true, installningar: false });
    cleanup();
    await oppnaHelskarm();
    expect(document.querySelector('[data-karta-panel="lager"]')).toBeTruthy();
    expect(document.querySelector('[data-karta-flik="installningar"]')).toBeTruthy();
  });

  it("ett lager som slås av filtreras bort ur kartan, och på igen tar tillbaka det", async () => {
    bredd(false);
    const { karta } = await oppnaHelskarm();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Lager" }));
    });
    const reglage = screen.getAllByRole("switch");
    expect(reglage.length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.click(reglage[0]);
    });
    expect(JSON.stringify(karta.filter["objekt-punkt"])).toContain("_lager");
    await act(async () => {
      fireEvent.click(screen.getAllByRole("switch")[0]);
    });
    expect(JSON.stringify(karta.filter["objekt-punkt"])).not.toContain("_lager");
  });

  it("Terräng lägger till höjddatan först när den väljs, och faller den byts källan till reserven och sedan sägs det", async () => {
    bredd(false);
    const { karta } = await oppnaHelskarm();
    expect(karta.kallor?.terrang).toBeUndefined();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Inställningar" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: "Terräng" }));
    });
    expect(karta.kallor.terrang.url).toContain("mapterhorn");
    expect(karta.tillagda).toContain("terrang-skugga");
    expect(karta.getLayoutProperty("mark-skog", "visibility")).toBe("visible");
    await act(async () => {
      karta._on.error({ sourceId: "terrang", error: new Error("404") });
    });
    expect(karta.kallor.terrang.tiles[0]).toContain("elevation-tiles-prod");
    expect(document.querySelector("[data-karta-terrang-fel]")).toBeNull();
    await act(async () => {
      karta._on.error({ sourceId: "terrang", error: new Error("404") });
    });
    expect(document.querySelector("[data-karta-terrang-fel]")?.textContent).toBe("Terrängen gick inte att hämta. Kartan visas utan skuggning.");
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: "Karta" }));
    });
    expect(karta.getLayoutProperty("terrang-skugga", "visibility")).toBe("none");
    expect(karta.getLayoutProperty("mark-skog", "visibility")).toBe("none");
  });

  it("ortnamnen går att slå av, och Min position går genom kartans egen kontroll", async () => {
    bredd(false);
    const { karta } = await oppnaHelskarm();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Inställningar" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("switch", { name: /Ortnamn/ }));
    });
    expect(karta.getLayoutProperty("ort-by", "visibility")).toBe("none");
    const plats = globalThis.__opsPlatskontroller.at(-1);
    await act(async () => {
      fireEvent.click(screen.getByRole("switch", { name: /Min position/ }));
    });
    expect(plats.triggad).toBe(1);
  });
});
