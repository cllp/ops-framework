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
  "--color-karta-vatten": "#d9e4e7",
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
    // (0.263.0) Zoomen är ramverkets knappar, som anropar kartans egna metoder.
    zoomIn() {
      this.zoom = (this.zoom ?? 0) + 1;
    }
    zoomOut() {
      this.zoom = (this.zoom ?? 0) - 1;
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
    // ⛔ (0.263.0, mätt i montaget för #967) Aldrig `relative` bredvid `fixed`: i Tailwinds ordning vinner `relative`, och lagret blev aldrig fast.
    expect(region.className.split(/\s+/)).not.toContain("relative");
    // (0.263.0, cllp/lifehub.app#967) Kartan fyller hela skärmen utan egen marginal. Stäng står innanför den säkra zonen.
    expect(region.className).not.toMatch(/\bp[trbl]?-\(--safe/);
    const stang = /** @type {HTMLElement} */ (screen.getByRole("button", { name: "Stäng helskärm" }));
    expect(stang.style.top).toContain("--safe-top");
    expect(stang.style.left).toContain("--safe-left");
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

  /**
   * ⛔ HÄNDELSEN (0.263.1, CP 2026-11-25 med en skärmbild av Sardinien rutt v12 i Biblioteket: "kommer upp fullskärm men inom samma ram ...
   * Den här fullscreen viewn är helt oanvändbar i web"). Läget sätts till helskärm innan webbläsaren svarat, och kartan hade då bara `relative`:
   * den litade på att webbläsaren gav den storleken. Medan begäran väntade, eller om den aldrig blev av, låg kartan kvar i sin ram med Stäng synligt.
   * PDF-vyn har alltid ett eget fast lager. Kartan har det nu också. Rött utan ändringen: klassen var `relative`.
   */
  it("medan webbläsarens helskärm väntar är kartan redan ett fast lager över skärmen", async () => {
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, get: () => true });
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => null });
    HTMLElement.prototype.requestFullscreen = /** @type {any} */ (vi.fn(() => new Promise(() => {})));
    const { region } = await rita();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Helskärm" }));
    });
    expect(region.getAttribute("data-karta-helskarm")).toBe("helskarm");
    const klasser = region.className.split(/\s+/);
    expect(klasser).toContain("fixed");
    expect(klasser).toContain("inset-0");
    expect(klasser).not.toContain("relative");
    expect(klasser).not.toContain("h-72");
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
    expect(document.querySelector("[data-karta-panelknapp]")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Helskärm" }));
    });
    expect(document.querySelectorAll("[data-karta-panelknapp]").length).toBe(2);
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
    expect(screen.getByRole("button", { name: "Lager" }).getAttribute("aria-expanded")).toBe("true");
    // Ett tryck eller Enter på handtaget är ett klick (tangentbord och skärmläsare ger inga pekarhändelser).
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Visa panelen över nästan hela skärmen" }));
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

  it("dator: de flytande knapparna fäller ut panelerna till höger, och läget minns", async () => {
    bredd(true);
    await oppnaHelskarm();
    expect(document.querySelector("[data-karta-panel]")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Lager" }));
    });
    expect(document.querySelector('[data-karta-panel="lager"]')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("ops-karta-paneler-v1") ?? "{}")).toEqual({ lager: true, installningar: false });
    cleanup();
    await oppnaHelskarm();
    expect(document.querySelector('[data-karta-panel="lager"]')).toBeTruthy();
    expect(document.querySelector('[data-karta-panel="installningar"]')).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Fäll in lager" }));
    });
    expect(document.querySelector('[data-karta-panel="lager"]')).toBeNull();
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

/**
 * ⛔ HÄNDELSEN (0.263.0, cllp/lifehub.app#967). CP 2026-11-25 om kartan i helskärm på iPhone: "det ska vara lite svårare att stänga helskärmsläge, man får
 * aktivt trycka för att stänga helskärm. Annars så stängs den nästan hela tiden när man sveper runt." Mätt i WebKits källa: på iPhone och iPad stänger ett
 * svep nedåt webbläsarens helskärm (`WKFullScreenWindowControllerIOS.mm`, `UISwipeGestureRecognizer` nedåt och en `UIPanGestureRecognizer`, påslagna på hela
 * iOS-familjen), och sidan kan inte stänga av det. Kartan väljer därför lagret där. Rött utan ändringen: `requestFullscreen` anropades på iPhone och läget
 * blev `helskarm`.
 */
describe("⛔ helskärmen stängs bara med ett aktivt tryck", () => {
  const forrUa = Object.getOwnPropertyDescriptor(window.navigator, "userAgent");
  const forrTryck = Object.getOwnPropertyDescriptor(window.navigator, "maxTouchPoints");
  afterEach(() => {
    if (forrUa) Object.defineProperty(window.navigator, "userAgent", forrUa);
    else delete (/** @type {any} */ (window.navigator)).userAgent;
    if (forrTryck) Object.defineProperty(window.navigator, "maxTouchPoints", forrTryck);
    else delete (/** @type {any} */ (window.navigator)).maxTouchPoints;
  });
  /** @param {string} ua @param {number} tryck */
  function enhet(ua, tryck) {
    Object.defineProperty(window.navigator, "userAgent", { configurable: true, get: () => ua });
    Object.defineProperty(window.navigator, "maxTouchPoints", { configurable: true, get: () => tryck });
  }
  function webblasarHelskarm() {
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, get: () => true });
    const request = vi.fn(() => Promise.resolve());
    HTMLElement.prototype.requestFullscreen = /** @type {any} */ (request);
    return request;
  }

  it("på en iPhone öppnas lagret, aldrig webbläsarens helskärm, och ett svep över kartan stänger ingenting", async () => {
    enhet("Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1", 5);
    const request = webblasarHelskarm();
    const { region, karta } = await rita();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Helskärm" }));
    });
    expect(request).not.toHaveBeenCalled();
    expect(region.getAttribute("data-karta-helskarm")).toBe("fonster");
    // Ett tryck på kartan (utan punkt) och ett svep nedåt över ytan: lagret står kvar.
    const yta = /** @type {HTMLElement} */ (region.querySelector("[data-karta-yta]"));
    await act(async () => {
      karta._on.click({ point: { x: 5, y: 5 }, lngLat: { lng: 34.5, lat: 28.5 } });
      fireEvent.touchStart(yta, { touches: [{ clientX: 100, clientY: 100 }] });
      fireEvent.touchMove(yta, { touches: [{ clientX: 100, clientY: 500 }] });
      fireEvent.touchEnd(yta);
    });
    expect(region.getAttribute("data-karta-helskarm")).toBe("fonster");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Stäng helskärm" }));
    });
    expect(region.getAttribute("data-karta-helskarm")).toBeNull();
  });

  it("en iPad i skrivbordsläge räknas som pekskärm, en Mac utan pekskärm får webbläsarens helskärm", async () => {
    const { svepStangerHelskarm } = await import("../components/useHelskarm.js");
    expect(svepStangerHelskarm({ userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)", maxTouchPoints: 5 })).toBe(true);
    expect(svepStangerHelskarm({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15", maxTouchPoints: 5 })).toBe(true);
    expect(svepStangerHelskarm({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15", maxTouchPoints: 0 })).toBe(false);
    expect(svepStangerHelskarm({ userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/130 Mobile", maxTouchPoints: 5 })).toBe(false);
    enhet("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15", 0);
    const request = webblasarHelskarm();
    const { region } = await rita();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Helskärm" }));
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(region.getAttribute("data-karta-helskarm")).toBe("helskarm");
  });
});

/**
 * ⛔ HÄNDELSEN (0.263.0, cllp/lifehub.app#967). CP 2026-11-25 om MapLibres vita zoomrutor och positionens röda snedstreck: "Ser bara lite 90-tal buggigt
 * ut." Zoom och Min position är ramverkets runda knappar. Rött utan ändringen: knapparna fanns inte (zoomen var MapLibres `NavigationControl`).
 */
describe("⛔ zoom och Min position är ramverkets knappar", () => {
  const forrGeo = Object.getOwnPropertyDescriptor(window.navigator, "geolocation");
  afterEach(() => {
    if (forrGeo) Object.defineProperty(window.navigator, "geolocation", forrGeo);
    else delete (/** @type {any} */ (window.navigator)).geolocation;
  });
  function medPosition() {
    Object.defineProperty(window.navigator, "geolocation", { configurable: true, get: () => ({ watchPosition() {}, clearWatch() {}, getCurrentPosition() {} }) });
  }

  it("zooma in och ut går genom kartan, i samma runda form som de andra knapparna, med 44 px", async () => {
    medPosition();
    const { karta } = await rita();
    const inKnapp = screen.getByRole("button", { name: "Zooma in" });
    expect(inKnapp.className).toContain("size-11");
    await act(async () => {
      fireEvent.click(inKnapp);
      fireEvent.click(inKnapp);
      fireEvent.click(screen.getByRole("button", { name: "Zooma ut" }));
    });
    expect(karta.zoom).toBe(1);
    expect(screen.getByRole("button", { name: "Visa min position" }).className).toContain("rounded-full");
  });

  it("Min position styr kartans positionskontroll och visar dess läge, och MapLibres egen knapp döljs", async () => {
    medPosition();
    await rita();
    const plats = globalThis.__opsPlatskontroller.at(-1);
    const knapp = () => /** @type {HTMLElement} */ (document.querySelector("[data-karta-plats-knapp]"));
    expect(knapp().getAttribute("aria-pressed")).toBe("false");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Visa min position" }));
    });
    expect(plats.triggad).toBe(1);
    await act(async () => plats._on.trackuserlocationstart());
    expect(knapp().getAttribute("data-karta-plats-knapp")).toBe("foljer");
    expect(knapp().getAttribute("aria-pressed")).toBe("true");
    await act(async () => {
      plats._on.trackuserlocationend();
      plats._on.userlocationlostfocus();
    });
    expect(knapp().getAttribute("data-karta-plats-knapp")).toBe("bakgrund");
    const stil = document.getElementById("ops-karta-popup-stil")?.textContent ?? "";
    expect(stil).toContain(".maplibregl-ctrl-group:has(.maplibregl-ctrl-geolocate){display:none}");
  });

  it("en position som saknas är en dämpad knapp med ett namn som säger varför, aldrig en egen ikon", async () => {
    medPosition();
    await rita();
    const plats = globalThis.__opsPlatskontroller.at(-1);
    await act(async () => plats._on.error({ code: 1 }));
    const nekad = screen.getByRole("button", { name: "Platsen är avstängd i telefonens inställningar. Slå på den för att se var du är." });
    expect(nekad.getAttribute("data-karta-plats-knapp")).toBe("fel");
    expect(nekad.className).toContain("opacity-60");
    // Utan geolocation i webbläsaren: samma knapp, dämpad och spärrad.
    cleanup();
    delete (/** @type {any} */ (window.navigator)).geolocation;
    await rita();
    const saknas = screen.getByRole("button", { name: "Positionen går inte att visa" });
    expect(saknas.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(saknas);
    expect(globalThis.__opsPlatskontroller.at(-1).triggad ?? 0).toBe(0);
  });
});

/**
 * ⛔ HÄNDELSEN (0.263.0, cllp/lifehub.app#967). CP 2026-11-25: "lägga till ett fält längst ner som man kan dra upp när kartan är helskärm med information
 * också." Infofältet bär kartans titel nere och beskrivningen och lagren uppe, och en vald punkt står i fältet i stället för i en popup. Rött utan ändringen:
 * fältet fanns inte, och ett tryck på en punkt i helskärm öppnade en popup.
 */
describe("⛔ infofältet i helskärm", () => {
  const forrMedia = window.matchMedia;
  const forrPe = /** @type {any} */ (window).PointerEvent;
  beforeEach(() => {
    // jsdom har ingen PointerEvent: utan den bär en pekarhändelse ingen `clientY`.
    /** @type {any} */ (window).PointerEvent = class extends MouseEvent {
      /** @param {string} typ @param {any} init */
      constructor(typ, init = {}) {
        super(typ, init);
        this.pointerId = init.pointerId ?? 1;
      }
    };
  });
  afterEach(() => {
    window.matchMedia = forrMedia;
    /** @type {any} */ (window).PointerEvent = forrPe;
  });
  const MED_HUVUD = { ...exempelkarta, karta: { titel: "Dahab runt", beskrivning: "Tre dagar vid Röda havet.", lager: [{ typ: "hamn", etikett: "Hamnar", farg: "djuphav" }] } };

  async function oppnaMedHuvud() {
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, get: () => false });
    const { OpsKarta } = await import("../components/OpsKarta.jsx");
    render(<OpsKarta data={MED_HUVUD} />);
    await screen.findByRole("region", { name: "Karta" });
    await waitFor(() => expect(globalThis.__opsKartor.length).toBeGreaterThan(0));
    const karta = globalThis.__opsKartor.at(-1);
    expect(document.querySelector("[data-karta-info]")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Helskärm" }));
    });
    return karta;
  }
  const handtag = () => /** @type {HTMLElement} */ (document.querySelector("[data-karta-info-handtag]"));
  const lage = () => document.querySelector("[data-karta-info]")?.getAttribute("data-karta-info");

  it("nere är det ett handtag med kartans titel, och ett tryck fäller ut beskrivningen och lagren med färg, namn och antal", async () => {
    bredd(false);
    await oppnaMedHuvud();
    expect(lage()).toBe("nere");
    expect(handtag().getAttribute("aria-expanded")).toBe("false");
    expect(handtag().textContent).toBe("Dahab runt");
    expect(screen.queryByText("Tre dagar vid Röda havet.")).toBeNull();
    await act(async () => {
      fireEvent.click(handtag());
    });
    expect(lage()).toBe("uppe");
    expect(handtag().getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Tre dagar vid Röda havet.")).toBeTruthy();
    const rader = [...document.querySelectorAll("[data-karta-info-lager] li")].map((li) => li.textContent);
    expect(rader[0]).toBe("Hamnar1 plats");
    expect(rader.length).toBeGreaterThanOrEqual(2);
  });

  it("handtaget dras upp och ned med pekaren, och klicket efter ett drag räknas inte som ett tryck", async () => {
    bredd(false);
    await oppnaMedHuvud();
    await act(async () => {
      fireEvent.pointerDown(handtag(), { clientY: 700 });
      fireEvent.pointerMove(handtag(), { clientY: 600 });
      fireEvent.pointerUp(handtag(), { clientY: 560 });
      fireEvent.click(handtag());
    });
    expect(lage()).toBe("uppe");
    await act(async () => {
      fireEvent.pointerDown(handtag(), { clientY: 300 });
      fireEvent.pointerUp(handtag(), { clientY: 420 });
      fireEvent.click(handtag());
    });
    expect(lage()).toBe("nere");
    // Ett kort tryck (under tröskeln) är ett vanligt tryck.
    await act(async () => {
      fireEvent.pointerDown(handtag(), { clientY: 700 });
      fireEvent.pointerUp(handtag(), { clientY: 705 });
      fireEvent.click(handtag());
    });
    expect(lage()).toBe("uppe");
  });

  it("ett tryck på en punkt visar namn, beskrivning och länkar i fältet, utan popup, och stänger arket på telefon", async () => {
    bredd(false);
    globalThis.__opsPopuper = [];
    const karta = await oppnaMedHuvud();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Lager" }));
    });
    expect(document.querySelector("[data-karta-ark]")).toBeTruthy();
    const punkt = exempelkarta.features.find((f) => f.geometry.type === "Point");
    karta.traff = [{ ...punkt, layer: { id: "objekt-punkt" } }];
    await act(async () => {
      karta._on.click({ point: { x: 10, y: 10 }, lngLat: { lng: 34.5, lat: 28.5 } });
    });
    expect(globalThis.__opsPopuper.length).toBe(0);
    expect(document.querySelector("[data-karta-ark]")).toBeNull();
    expect(lage()).toBe("uppe");
    expect(handtag().textContent).toBe(punkt.properties.namn);
    expect(screen.getByText(punkt.properties.beskrivning)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Öppna i Google Maps" })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Tillbaka till översikten" }));
    });
    expect(handtag().textContent).toBe("Dahab runt");
    expect(document.querySelector("[data-karta-info-lager]")).toBeTruthy();
    expect(document.querySelector('[data-karta="" ]')?.getAttribute("data-karta-helskarm")).toBe("fonster");
  });

  it("på dator står fältet nere till vänster, och kartans titel är kartans namn när huvudet saknar titel", async () => {
    bredd(true);
    await oppnaHelskarm();
    const falt = /** @type {HTMLElement} */ (document.querySelector("[data-karta-info]"));
    expect(falt.className).toContain("w-[22rem]");
    expect(falt.style.left).toContain("--safe-left");
    expect(handtag().textContent).toBe("Karta");
  });
});
