import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contrast } from "../../scripts/vendor/validate_palette.js";
import { exempelkarta } from "../../examples/karta/dahab.js";
import { KARTA_PALETT, ORTNAMN_LAGER, TERRANG_RESERV, TERRANG_UNDERLAG, basPensel, berika, byggStil, granser, grundensSynlighet, kartansLager, lagerFilter, lasGeojson, lasHuvud, objektFarg, objektId, objektPensel, popupElement, popupTexter, terrangKalla, terrangSkugga } from "../lib/karta.js";

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
  djuphav: "#aaaaaa",
  oliv: "#bbbbbb",
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
    for (const tal of ["#faf7f1", "#f3eee4", "#d9e4e7", "#cfc6b6", "#8a8073", "#2e2a24", "#4e7558", "#bf9522", "#c0683a"]) {
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
    // (0.263.0, cllp/lifehub.app#967) Havet är Sardinienkartans `--hav`, ljust blågrått, inte salvia.
    expect(hex("--color-karta-vatten")).toBe("#d9e4e7");
    expect(hex("--color-karta-djuphav")).toBe("#1f4e5f");
    expect(hex("--color-karta-oliv")).toBe("#7a8450");
    expect(contrast("#2e2a24", "#faf7f1")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#2e2a24", "#f3eee4")).toBeGreaterThanOrEqual(4.5);
    // Ortnamn på havet (vattnets namn) läses också.
    expect(contrast("#2e2a24", hex("--color-karta-vatten"))).toBeGreaterThanOrEqual(4.5);
    expect(css).toContain("--font-karta-ort: var(--font-display-publik)");
    expect(css).toContain("--font-karta-etikett: var(--font-sans)");
  });
});

/** En punkt med egenskaper, för proven nedan. */
function punkt(egenskaper, id) {
  return { type: "Feature", ...(id === undefined ? {} : { id }), geometry: { type: "Point", coordinates: [9.6, 40.0] }, properties: egenskaper };
}

/**
 * ⛔ KONTRAKTET (0.258.0, cllp/lifehub.app#950 skiva 0). Kartans data är GeoJSON. Lagret är `typ`, ett valfritt huvud i `karta` byter etikett,
 * färg och ordning, och ett objekts id är bara det som står i filen. Beslutat av CP 2026-11-24 efter Claudes analys och Fables granskning.
 */
describe("⛔ kartans huvud", () => {
  it("läses ur samlingen och följer med i lasGeojson", () => {
    const last = lasGeojson({ type: "FeatureCollection", karta: { titel: " Sardinien ", beskrivning: "Bas för resan", lager: [{ typ: "boende", etikett: "Boende", farg: "djuphav" }] }, features: [punkt({ typ: "boende" })] });
    expect(last.ok).toBe(true);
    expect(last.samling.karta).toEqual({ titel: "Sardinien", beskrivning: "Bas för resan", lager: [{ typ: "boende", etikett: "Boende", farg: "djuphav" }], fel: [] });
  });

  it("utan huvud är huvudet tomt, inte saknat", () => {
    expect(lasGeojson({ type: "FeatureCollection", features: [] }).samling.karta).toEqual({ titel: "", beskrivning: "", lager: [], fel: [] });
  });

  it("det som inte går att använda står i fel, aldrig tyst", () => {
    const h = lasHuvud({ lager: [{ typ: "mat", farg: "#ff0000" }, { etikett: "Utan typ" }, { typ: "mat" }, { typ: "bad", farg: "rosa" }] });
    expect(h.lager).toEqual([{ typ: "mat", etikett: "mat", farg: "" }, { typ: "bad", etikett: "bad", farg: "" }]);
    expect(h.fel).toEqual(["farg:okand:#ff0000", "lager:utan-typ", "lager:dubblett:mat", "farg:okand:rosa"]);
    expect(lasHuvud("titel").fel).toEqual(["huvud:form"]);
    expect(lasHuvud({ lager: "boende" }).fel).toEqual(["lager:form"]);
  });
});

describe("⛔ lagren är typ", () => {
  it("utan huvud blir varje typ ett lager, i den ordning den först förekommer, och objekt utan typ sist", () => {
    const samling = lasGeojson({ type: "FeatureCollection", features: [punkt({ typ: "mat" }), punkt({ namn: "utan" }), punkt({ type: "bad" }), punkt({ typ: "mat" })] }).samling;
    expect(kartansLager(samling)).toEqual([
      { typ: "mat", etikett: "mat", farg: "salvia", antal: 2 },
      { typ: "bad", etikett: "bad", farg: "ockra", antal: 1 },
      { typ: "", etikett: "", farg: "", antal: 1 },
    ]);
  });

  it("huvudets lager kommer först, också utan objekt, och dess färg tas inte av ett annat lager", () => {
    const samling = lasGeojson({
      type: "FeatureCollection",
      karta: { lager: [{ typ: "bad", etikett: "Bad och stränder", farg: "salvia" }, { typ: "byar", etikett: "Byar" }] },
      features: [punkt({ typ: "mat" }), punkt({ typ: "bad" })],
    }).samling;
    expect(kartansLager(samling)).toEqual([
      { typ: "bad", etikett: "Bad och stränder", farg: "salvia", antal: 1 },
      { typ: "byar", etikett: "Byar", farg: "ockra", antal: 0 },
      { typ: "mat", etikett: "mat", farg: "terrakotta", antal: 1 },
    ]);
  });

  /**
   * ⛔ HÄNDELSEN. Förr valdes färgen ur typens teckenkoder bland tre färger, så två lager kunde få samma färg redan vid två typer, och
   * Sardinienkartan har sex lager (Fables granskning i #950). Rött utan ändringen: sex typer gav högst tre olika färger.
   */
  it("sex typer får sex olika färger, och objektet ritas i sitt lagers färg", () => {
    const typer = ["boende", "bad", "mat", "byar", "snorkling", "vandring"];
    const samling = lasGeojson({ type: "FeatureCollection", features: typer.map((typ) => punkt({ typ })) }).samling;
    const farger = berika(samling, SENTINEL).features.map((f) => f.properties._markor);
    expect(new Set(farger).size).toBe(6);
    expect(farger).toEqual(KARTA_PALETT.map((namn) => SENTINEL[namn]));
  });

  it("huvudets palettnamn styr objektets färg, och simplestyle vinner fortfarande", () => {
    const samling = lasGeojson({ type: "FeatureCollection", karta: { lager: [{ typ: "boende", farg: "djuphav" }] }, features: [punkt({ typ: "boende" }), punkt({ typ: "boende", "marker-color": "#c0683a" })] }).samling;
    const [a, b] = berika(samling, SENTINEL).features;
    expect(a.properties._markor).toBe(SENTINEL.djuphav);
    expect(b.properties._markor).toBe("#c0683a");
  });
});

describe("⛔ objektets id", () => {
  it("är det som står i filen: properties.id före feature.id", () => {
    expect(objektId(punkt({ id: " gigli-house " }, 7))).toBe("gigli-house");
    expect(objektId(punkt({ id: 12 }))).toBe("12");
    expect(objektId(punkt({}, "cala-luna"))).toBe("cala-luna");
  });

  it("saknas det är svaret null, aldrig radnumret", () => {
    expect(objektId(punkt({ namn: "Utan id" }))).toBeNull();
    expect(objektId(punkt({ id: "  " }))).toBeNull();
    const samling = lasGeojson({ type: "FeatureCollection", features: [punkt({ namn: "a" }), punkt({ namn: "b" })] }).samling;
    expect(samling.features.map(objektId)).toEqual([null, null]);
  });
});

describe("⛔ kartans palett i temat", () => {
  const css = fs.readFileSync(path.join(rot, "tokens/tokens.css"), "utf8");
  /** @param {string} namn */
  const hex = (namn) => css.match(new RegExp(`${namn}:\\s*(#[0-9a-fA-F]{6})`))?.[1] ?? "";

  /**
   * ⛔ OCKRA I LJUST LÄGE ÄR UNDANTAGET, MÄTT 2026-11-24: 2,61:1 mot papper. Färgen är CP:s sedan 0.223.0 och ändras inte här. En punkt
   * syns ändå, eftersom den har en mjuk skugga i textens färg runt sin ljusa ring (`objektPensel`, `PUNKT_SKUGGA`, 0.263.0; till 0.262.0 en ring i textens färg). En linje eller yta i ockra är svagare, och det
   * står som en observation i #950. Undantaget är en lista med ett namn, så att en ny färg under 3:1 blir röd.
   */
  const UNDER_TRE_I_LJUST = ["ockra"];

  it("varje palettfärg finns och syns mot land med minst 3:1", () => {
    expect(KARTA_PALETT.length).toBe(6);
    expect(contrast(hex("--color-karta-ockra"), hex("--color-karta-papper"))).toBeLessThan(3);
    for (const namn of KARTA_PALETT) {
      const ljus = hex(`--color-karta-${namn}`);
      expect(ljus, namn).toMatch(/^#/);
      if (!UNDER_TRE_I_LJUST.includes(namn)) expect(contrast(ljus, hex("--color-karta-papper")), namn).toBeGreaterThanOrEqual(3);
    }
  });

  /**
   * ⛔ HÄNDELSEN (0.263.0, cllp/lifehub.app#967). CP 2026-11-25, med appens karta i mörkt läge (brun mark, grönt hav) bredvid Sardinienkartan: "ljusa upp den
   * lite grann så här". Kartans yta är ljus också i mörkt läge: mörkt läge skriver inte om någon `--color-karta-*`, och `--dark-karta-*` finns inte. Rött utan
   * ändringen: de elva aliasen stod i båda mörkerblocken och `--dark-karta-papper` var #2a2622.
   */
  it("kartans yta är ljus också i mörkt läge: inget mörkerblock skriver om kartans färger", () => {
    expect(css).not.toMatch(/--dark-karta-[a-z]+\s*:/);
    expect(css).not.toMatch(/--color-karta-[a-z]+:\s*var\(--dark-/);
    // Golv: kartans tokens finns, en gång var, så att provet inte är grönt för att filen inte lästes.
    for (const namn of ["papper", "creme", "vatten", "linje", "lera", "text", ...KARTA_PALETT]) {
      expect(css.match(new RegExp(`--color-karta-${namn}:`, "g"))?.length, namn).toBe(1);
    }
  });

  /**
   * (0.263.0) Punkterna ligger ofta längs kusten, alltså på havet. Mätt 2026-11-25 mot havet #d9e4e7: salvia 4,04, terrakotta 3,07, djuphav 7,00, oliv 3,09,
   * lera 2,99 och ockra 2,15. ⛔ LERA OCH OCKRA ÄR UNDANTAGEN MOT HAVET, med samma skäl som ockra mot land: punkten har skuggan och den ljusa ringen som kant.
   * Lera är sjätte lagrets färg och kommer bara med på kartor med sex lager. Listan har två namn, så att en ny färg under 3:1 mot havet blir röd.
   */
  const UNDER_TRE_MOT_HAVET = ["ockra", "lera"];

  it("varje palettfärg utom ockra och lera syns mot havet med minst 3:1", () => {
    expect(contrast(hex("--color-karta-lera"), hex("--color-karta-vatten"))).toBeLessThan(3);
    for (const namn of KARTA_PALETT) {
      if (UNDER_TRE_MOT_HAVET.includes(namn)) continue;
      expect(contrast(hex(`--color-karta-${namn}`), hex("--color-karta-vatten")), namn).toBeGreaterThanOrEqual(3);
    }
  });
});

/**
 * ⛔ SKIVA 2 (0.258.0, cllp/lifehub.app#950). Kartgrunderna Karta och Terräng, ortnamnen i nivåer, och lagrens filter.
 */
describe("⛔ kartgrunder och ortnamn", () => {
  const stil = byggStil(SENTINEL, tom);
  const lagret = (id) => stil.layers.find((l) => l.id === id);

  it("terrängens källa finns inte i stilen: ingen adress skickas till höjddatan förrän någon väljer Terräng", () => {
    expect(Object.keys(stil.sources)).toEqual(["openmaptiles", "objekt"]);
    expect(JSON.stringify(stil)).not.toContain("mapterhorn");
    expect(lagret("mark-skog").layout.visibility).toBe("none");
    expect(lagret("mark-gras").layout.visibility).toBe("none");
  });

  it("terrängens källa är Mapterhorn, och reserven är AWS Terrain Tiles med samma kodning", () => {
    expect(terrangKalla()).toMatchObject({ type: "raster-dem", url: TERRANG_UNDERLAG, encoding: "terrarium" });
    expect(terrangKalla(true)).toMatchObject({ type: "raster-dem", tiles: [TERRANG_RESERV], encoding: "terrarium", tileSize: 256 });
    expect(terrangSkugga(SENTINEL)).toMatchObject({ id: "terrang-skugga", type: "hillshade", source: "terrang" });
    expect(terrangSkugga(SENTINEL).paint["hillshade-shadow-color"]).toBe(SENTINEL.text);
  });

  /**
   * ⛔ HÄNDELSEN. Tätort, by och småort låg i ett lager från zoom 8 utan rangordning, så en småort kunde tränga undan en tätort, och öar ritades
   * inte alls (Fables granskning i #950). Rött utan ändringen: lagren `ort-by`, `ort-smaort` och `ort-o` fanns inte.
   */
  it("ortnamnen har nivåer som mallen, öar kommer med, och lägst rank vinner inom en nivå", () => {
    const zoom = Object.fromEntries(ORTNAMN_LAGER.map((id) => [id, lagret(id)?.minzoom]));
    expect(zoom).toEqual({ "ort-land": 1, "ort-stad": 4, "ort-tator": 8, "ort-by": 10, "ort-smaort": 12, "ort-o": 9 });
    expect(JSON.stringify(lagret("ort-tator").filter)).not.toContain("village");
    expect(JSON.stringify(lagret("ort-o").filter)).toContain("island");
    for (const id of ORTNAMN_LAGER) expect(lagret(id).layout["symbol-sort-key"], id).toEqual(["coalesce", ["get", "rank"], 99]);
  });

  it("en grund slår på sina lager och av de andras, och ortnamnen följer reglaget", () => {
    expect(grundensSynlighet("karta", true)).toContainEqual(["mark-skog", "none"]);
    expect(grundensSynlighet("terrang", true)).toContainEqual(["mark-skog", "visible"]);
    expect(grundensSynlighet("terrang", false)).toContainEqual(["ort-by", "none"]);
    expect(grundensSynlighet("karta", true).filter(([, v]) => v === "visible").map(([id]) => id)).toEqual([...ORTNAMN_LAGER]);
  });
});

describe("⛔ lagrens filter", () => {
  it("utan avslagna lager är filtret grundfiltret, så ingenting ändras för den som inte rör panelen", () => {
    const grund = ["match", ["geometry-type"], ["Point"], true, false];
    expect(lagerFilter(grund, [])).toBe(grund);
    expect(lagerFilter(grund, ["mat", ""])).toEqual(["all", grund, ["!", ["in", ["get", "_lager"], ["literal", ["mat", ""]]]]]);
  });

  it("berika sätter objektets lager ur typen, och tom typ för objekt utan typ", () => {
    const samling = lasGeojson({ type: "FeatureCollection", features: [punkt({ typ: "mat" }), punkt({ type: "bad" }), punkt({})] }).samling;
    expect(berika(samling, SENTINEL).features.map((f) => f.properties._lager)).toEqual(["mat", "bad", ""]);
  });
});

/**
 * ⛔ HÄNDELSEN (0.263.0, cllp/lifehub.app#967). Krediten stod med adresserna i parentes i texten och blev tre rader mitt över kartan på en telefon (mätt i montaget).
 * Samma namn och adresser står nu som länkar. Rött utan ändringen: texten bar "(https://".
 */
describe("⛔ krediten är länkar", () => {
  it("varje källa har sina namn som länkar till sina adresser, och ingen adress står i texten", () => {
    const stil = byggStil(SENTINEL, tom);
    const kredit = stil.sources.openmaptiles.attribution;
    for (const [namn, adress] of [["© OpenStreetMap", "https://www.openstreetmap.org/copyright"], ["© OpenFreeMap", "https://openfreemap.org/"], ["© OpenMapTiles", "https://openmaptiles.org/"]]) {
      expect(kredit).toContain(`<a href="${adress}" target="_blank" rel="noopener noreferrer">${namn}</a>`);
    }
    for (const k of [kredit, terrangKalla(false).attribution, terrangKalla(true).attribution]) expect(k.replace(/<[^>]+>/g, "")).not.toMatch(/\(https?:/);
  });
});
