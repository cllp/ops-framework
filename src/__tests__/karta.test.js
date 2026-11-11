import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contrast } from "../../scripts/vendor/validate_palette.js";
import { exempelkarta } from "../../examples/karta/dahab.js";
import { basPensel, berika, byggStil, granser, lasGeojson, objektFarg, objektPensel, popupElement, popupTexter } from "../lib/karta.js";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Färger som inte är temats, så ett hårdkodat tal i stilen syns. */
const SENTINEL = {
  papper: "#111111",
  creme: "#222222",
  vatten: "#333333",
  linje: "#444444",
  lera: "#555555",
  text: "#666666",
  salvia: "#777777",
  ockra: "#888888",
  terrakotta: "#999999",
  accent: "#abcdef",
  ort: "Georgia, serif",
  etikett: "sans-serif",
};

const tom = { type: "FeatureCollection", features: [] };

describe("GeoJSON", () => {
  it("läser en samling, en feature, en geometri och en JSON-sträng", () => {
    const samling = lasGeojson(exempelkarta);
    expect(samling.ok).toBe(true);
    if (!samling.ok) return;
    expect(samling.samling.features.map((f) => f.geometry.type)).toEqual(["Point", "Point", "Point", "LineString", "Polygon"]);
    const en = lasGeojson(exempelkarta.features[0]);
    expect(en.ok && en.samling.features).toHaveLength(1);
    const punkt = lasGeojson({ type: "Point", coordinates: [18.29, 57.63] });
    expect(punkt.ok && punkt.samling.features[0].geometry.type).toBe("Point");
    const text = lasGeojson(JSON.stringify(exempelkarta));
    expect(text.ok && text.samling.features).toHaveLength(5);
  });

  it("en trasig sträng och en okänd form är fel, inte ett kast", () => {
    expect(lasGeojson("{").fel).toBe("json");
    expect(lasGeojson(null).fel).toBe("form");
    expect(lasGeojson({ type: "FeatureCollection" }).fel).toBe("form");
    expect(lasGeojson({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "GeometryCollection", geometries: [{ type: "Point", coordinates: [1, 2] }, { type: "Banana" }] }, properties: { namn: "Delad" } }] }).samling.features).toHaveLength(1);
  });

  it("exemplet har punkt, linje och yta, med namn och beskrivning", () => {
    const slag = new Set(exempelkarta.features.map((f) => f.geometry.type));
    expect(slag.has("Point") && slag.has("LineString") && slag.has("Polygon")).toBe(true);
    for (const feature of exempelkarta.features) {
      const texter = popupTexter(feature);
      expect(texter.namn.length).toBeGreaterThan(0);
      expect(texter.beskrivning.length).toBeGreaterThan(0);
    }
  });
});

describe("färg per objekt", () => {
  const farger = SENTINEL;

  it("simplestyle vinner över typ och accent", () => {
    const med = objektFarg({ type: "Feature", geometry: { type: "Point", coordinates: [0, 0] }, properties: { "marker-color": "#c0683a", typ: "hamn" } }, farger);
    const utan = objektFarg({ type: "Feature", geometry: { type: "Point", coordinates: [0, 0] }, properties: { typ: "hamn" } }, farger);
    expect(med._markor).toBe("#c0683a");
    expect(utan._markor).not.toBe("#c0683a");
    expect(utan._markor).not.toBe(farger.accent);
  });

  it("samma typ får samma palettfärg, och utan typ används accenten", () => {
    const a = objektFarg({ type: "Feature", geometry: { type: "Point", coordinates: [0, 0] }, properties: { typ: "hamn" } }, farger);
    const b = objektFarg({ type: "Feature", geometry: { type: "Point", coordinates: [1, 1] }, properties: { type: "hamn" } }, farger);
    const c = objektFarg({ type: "Feature", geometry: { type: "Point", coordinates: [0, 0] }, properties: { namn: "Bara namn" } }, farger);
    expect(a._markor).toBe(b._markor);
    expect([farger.salvia, farger.ockra, farger.terrakotta]).toContain(a._markor);
    expect(c._markor).toBe(farger.accent);
  });

  it("en ogiltig färg faller igenom, och opacitet utanför 0 till 1 ignoreras", () => {
    const feature = { type: "Feature", geometry: { type: "Polygon", coordinates: [] }, properties: { fill: "rod", "fill-opacity": 4, stroke: "#4e7558", "stroke-width": 3 } };
    const farg = objektFarg(feature, farger);
    expect(farg._fyll).toBe("#4e7558");
    expect(farg._fyllOpacitet).toBe(0.6);
    expect(farg._streckBredd).toBe(3);
  });

  it("exemplet: terrakotta på Blue Hole, palett på fyren, accent på Eel Garden, ockra på kusten, salvia på lagunen", () => {
    const [hal, fyr, tradgard, kust, lagun] = berika(exempelkarta, farger).features;
    expect(hal.properties._markor).toBe("#c0683a");
    expect(hal.properties._radie).toBe(10);
    expect([farger.salvia, farger.ockra, farger.terrakotta]).toContain(fyr.properties._markor);
    expect(fyr.properties._markor).not.toBe(farger.accent);
    expect(tradgard.properties._markor).toBe(farger.accent);
    expect(kust.properties._streck).toBe("#bf9522");
    expect(kust.properties._streckBredd).toBe(3);
    expect(lagun.properties._fyll).toBe("#4e7558");
    expect(lagun.properties._fyllOpacitet).toBe(0.45);
  });
});

describe("stil och popup", () => {
  it("varje pensel syns i stilen, och inget av temats tal ligger kvar när färgerna byts", () => {
    const stil = byggStil(SENTINEL, tom);
    const text = JSON.stringify(stil);
    for (const [id, prop, varde] of [...basPensel(SENTINEL), ...objektPensel(SENTINEL)]) {
      const lager = stil.layers.find((l) => l.id === id);
      expect(lager, id).toBeTruthy();
      expect(lager.paint[prop]).toEqual(varde);
    }
    for (const tal of ["#faf7f1", "#f3eee4", "#adbdac", "#cfc6b6", "#8a8073", "#2e2a24", "#4e7558", "#bf9522", "#c0683a"]) {
      expect(text.includes(tal)).toBe(false);
    }
    expect(stil.sources.openmaptiles.url).toBe("https://tiles.openfreemap.org/planet");
    expect(stil.sources.openmaptiles.attribution).toContain("OpenStreetMap");
    expect(stil.sources.openmaptiles.attribution).toContain("OpenFreeMap");
  });

  it("gränserna runt exemplet rymmer varje hörn", () => {
    const ruta = granser(exempelkarta);
    expect(ruta[0][0]).toBeCloseTo(34.5132);
    expect(ruta[1][0]).toBeCloseTo(34.5384);
    expect(ruta[0][1]).toBeCloseTo(28.4387);
    expect(ruta[1][1]).toBeCloseTo(28.5721);
    expect(granser(tom)).toBeNull();
  });

  it("popupen tar namn och beskrivning som text, aldrig som HTML", () => {
    const el = popupElement({ type: "Feature", geometry: { type: "Point", coordinates: [0, 0] }, properties: { title: "<img src=x onerror=alert(1)>", description: "En rad" } });
    expect(el.querySelector("img")).toBeNull();
    expect(el.textContent).toContain("<img src=x onerror=alert(1)>");
    expect(el.textContent).toContain("En rad");
    expect(el.querySelector("p").className).toContain("font-karta-ort");
    expect(popupElement({ type: "Feature", geometry: { type: "Point", coordinates: [0, 0] }, properties: {} })).toBeNull();
    expect(popupTexter({ type: "Feature", geometry: null, properties: { namn: "Svensk", beskrivning: "Text" } })).toEqual({ namn: "Svensk", beskrivning: "Text" });
  });
});

describe("tokens", () => {
  const css = fs.readFileSync(path.join(rot, "tokens/tokens.css"), "utf8");

  function hex(namn) {
    const m = css.match(new RegExp(`${namn}:\\s*(#[0-9a-fA-F]{6})`));
    return m?.[1] ?? "";
  }

  it("de ljusa värdena är skissramverkets, och texten håller AA mot land och creme i båda lägen", () => {
    expect(hex("--color-karta-papper")).toBe("#faf7f1");
    expect(hex("--color-karta-creme")).toBe("#f3eee4");
    expect(hex("--color-karta-linje")).toBe("#cfc6b6");
    expect(hex("--color-karta-lera")).toBe("#8a8073");
    expect(hex("--color-karta-text")).toBe("#2e2a24");
    expect(hex("--color-karta-salvia")).toBe("#4e7558");
    expect(hex("--color-karta-ockra")).toBe("#bf9522");
    expect(hex("--color-karta-terrakotta")).toBe("#c0683a");
    expect(hex("--color-karta-vatten")).toBe("#adbdac");
    expect(contrast("#2e2a24", "#faf7f1")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#2e2a24", "#f3eee4")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(hex("--dark-karta-text"), hex("--dark-karta-papper"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(hex("--dark-karta-text"), hex("--dark-karta-creme"))).toBeGreaterThanOrEqual(4.5);
    expect(css).toContain("--font-karta-ort: var(--font-display-publik)");
    expect(css).toContain("--font-karta-etikett: var(--font-sans)");
  });
});
