import { describe, expect, it } from "vitest";
import { PALETT_LAGEN, PALETT_NYCKLAR, STANDARDPALETT, granskaPalett, harledLage, kontrastkvot } from "../lib/palett.js";
import { hallbarLjushet, hexTillHsl, hslTillHex, palettBesked, riktningsbesked } from "../lib/palettomfang.js";

/**
 * Färgväljarens skala och granskningens besked (0.219.0, cllp/lifehub.app#798). Se filhuvudet i `palettomfang.js`.
 *
 * ⛔ PROVEN JÄMFÖR MOT `granskaPalett`, inte mot funktionen själv: en ljushet som skalan säger håller ska ge noll fynd för färgen i
 * granskningen, och en som den säger inte håller ska ge minst ett. Annars hade provet varit en tautologi (arbetsreglernas punkt 4).
 */

/** CP:s palett på skärmbilden 2026-11-12: förvalet med accenten #94a37e i ljust läge. */
const CP = { ljus: { ...STANDARDPALETT.ljus, accent: "#94a37e" }, mork: { ...STANDARDPALETT.mork } };

/** @param {any} p @param {"ljus" | "mork"} lage @param {string} nyckel @param {string} farg */
const med = (p, lage, nyckel, farg) => ({ ...p, [lage]: { ...p[lage], [nyckel]: farg } });

/** Granskningens fynd i ett läge som nämner ett token ur en mängd, eller temats ordning. */
/** @param {any} p @param {"ljus" | "mork"} lage @param {(t: string) => boolean} rör */
const fyndSom = (p, lage, rör) => granskaPalett(p).filter((x) => x.lage === lage && (rör(x.text) || rör(x.yta) || (x.bas !== undefined && rör(x.bas))));
const accenttoken = (/** @type {string} */ t) => t.startsWith("accent");

/** En liten slumpgenerator med frö, så att varje körning prövar samma paletter. @param {number} fro */
function slump(fro) {
  let s = fro >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe("hexTillHsl och hslTillHex", () => {
  it("en färgkod går fram och tillbaka utan att ändras (golv: 4096 färger)", () => {
    let provade = 0;
    for (let r = 0; r < 256; r += 17) {
      for (let g = 0; g < 256; g += 17) {
        for (let b = 0; b < 256; b += 17) {
          const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
          const { kulor, mattnad, ljushet } = hexTillHsl(hex);
          expect(hslTillHex(kulor, mattnad, ljushet)).toBe(hex);
          provade++;
        }
      }
    }
    expect(provade).toBeGreaterThanOrEqual(4096);
  });

  it("kända punkter", () => {
    expect(hexTillHsl("#ff0000")).toEqual({ kulor: 0, mattnad: 100, ljushet: 50 });
    expect(hslTillHex(120, 100, 25)).toBe("#008000");
    expect(hexTillHsl("#808080").mattnad).toBe(0);
    expect(() => hexTillHsl("beige")).toThrow(/#rrggbb/);
  });
});

describe("hallbarLjushet", () => {
  it("CP:s skärmbild: accenten #94a37e i ljust läge håller inte (2,62:1 mot kortet där 3:1 behövs), och närmaste som håller är mörkare", () => {
    const o = hallbarLjushet(CP, "ljus", "accent", "#94a37e");
    expect(o.haller).toBe(false);
    expect(o.riktning).toBe("morkare");
    const kortet = o.fynd.find((x) => x.text === "accent" && x.yta === "raised");
    expect(kortet?.kvot).toBe(2.62);
    expect(kortet?.krav).toBe(3);
    // Mot kortet räknat för sig, utan granskningen: 2,62 före och minst 3 efter.
    expect(kontrastkvot("#94a37e", harledLage(CP.ljus).raised)).toBeLessThan(3);
    const narmaste = /** @type {string} */ (o.narmaste);
    expect(kontrastkvot(narmaste, harledLage({ ...CP.ljus, accent: narmaste }).raised)).toBeGreaterThanOrEqual(3);
    expect(/** @type {number} */ (o.narmasteLjushet)).toBeLessThan(o.ljushet);
    // Samma kulör och mättnad (inom en hexsiffras avrundning), bara mörkare.
    const n = hexTillHsl(narmaste);
    expect(Math.abs(n.kulor - o.kulor)).toBeLessThan(3);
    expect(n.ljushet).toBeLessThan(hexTillHsl("#94a37e").ljushet);
    // Och granskningen har inget kvar för accenten i ljust läge, och inget alls i paletten.
    expect(granskaPalett(med(CP, "ljus", "accent", narmaste))).toEqual([]);
    // Färgen står inte i något intervall, och närmaste gör det.
    const inne = (/** @type {number} */ l) => o.intervall.some((d) => l >= d.fran - 1e-9 && l <= d.till + 1e-9);
    expect(inne(o.ljushet)).toBe(false);
    expect(inne(/** @type {number} */ (o.narmasteLjushet))).toBe(true);
    // ⛔ NÄRMASTE, inte bara en som håller: en halv procent ljusare än den (mot färgen) håller inte, mätt i granskningen.
    const forbi = hslTillHex(o.kulor, o.mattnad, /** @type {number} */ (o.narmasteLjushet) + 0.5);
    expect(fyndSom(med(CP, "ljus", "accent", forbi), "ljus", accenttoken).length).toBeGreaterThan(0);
    expect(o.narmasteLjushet).toBeCloseTo(50.78, 1);
  });

  it("varje färg i förvalet håller i båda lägena, och står i ett intervall", () => {
    let provade = 0;
    for (const lage of PALETT_LAGEN) {
      for (const nyckel of PALETT_NYCKLAR) {
        const o = hallbarLjushet(STANDARDPALETT, lage, nyckel, STANDARDPALETT[lage][nyckel]);
        expect(o.haller, `${lage} ${nyckel}`).toBe(true);
        expect(o.riktning).toBeNull();
        expect(o.narmaste).toBe(STANDARDPALETT[lage][nyckel]);
        expect(o.fynd).toEqual([]);
        expect(o.intervall.some((d) => o.ljushet >= d.fran - 1e-9 && o.ljushet <= d.till + 1e-9), `${lage} ${nyckel}`).toBe(true);
        provade++;
      }
    }
    expect(provade).toBe(8);
  });

  it("för mörk text i mörkt läge: gör den ljusare", () => {
    const p = med(STANDARDPALETT, "mork", "text", "#6a6f68");
    const o = hallbarLjushet(p, "mork", "text", "#6a6f68");
    expect(o.haller).toBe(false);
    expect(o.riktning).toBe("ljusare");
    expect(granskaPalett(med(p, "mork", "text", /** @type {string} */ (o.narmaste)))).toEqual([]);
  });

  it("⛔ skalan stämmer med granskningen: mitt i ett intervall håller accenten, mitt i en lucka gör den inte (golv: 20 kulörer)", () => {
    let mitt = 0;
    let lucka = 0;
    for (let kulor = 0; kulor < 360; kulor += 18) {
      const farg = hslTillHex(kulor, 45, 55);
      const o = hallbarLjushet(med(CP, "ljus", "accent", farg), "ljus", "accent", farg);
      let fore = 0;
      for (const d of o.intervall) {
        if (d.fran - fore > 2) {
          const l = (fore + d.fran) / 2;
          expect(fyndSom(med(CP, "ljus", "accent", hslTillHex(o.kulor, o.mattnad, l)), "ljus", accenttoken).length, `lucka ${kulor} ${l}`).toBeGreaterThan(0);
          lucka++;
        }
        const l = (d.fran + d.till) / 2;
        expect(fyndSom(med(CP, "ljus", "accent", hslTillHex(o.kulor, o.mattnad, l)), "ljus", accenttoken), `mitt ${kulor} ${l}`).toEqual([]);
        mitt++;
        fore = d.till;
      }
    }
    expect(mitt).toBeGreaterThanOrEqual(20);
    expect(lucka).toBeGreaterThanOrEqual(20);
  });

  it("⛔ bara fynden som hänger på färgen räknas: en oläslig text gör inte accentens skala röd", () => {
    const p = med(STANDARDPALETT, "ljus", "text", "#c8beb4");
    expect(granskaPalett(p).some((x) => x.text === "ink")).toBe(true);
    const o = hallbarLjushet(p, "ljus", "accent", p.ljus.accent);
    expect(o.haller).toBe(true);
    expect(o.intervall.length).toBeGreaterThan(0);
    expect(hallbarLjushet(p, "ljus", "text", p.ljus.text).riktning).toBe("morkare");
  });

  it("temats ordning räknas för texten men aldrig för accenten", () => {
    // Bakgrunden mörkare än texten i ljust läge: ett `ordning`-fynd, som hänger på texten.
    const p = med(STANDARDPALETT, "ljus", "text", "#fffefe");
    expect(granskaPalett(p).some((x) => x.text === "ordning" && x.lage === "ljus")).toBe(true);
    expect(hallbarLjushet(p, "ljus", "text", "#fffefe").fynd.some((x) => x.text === "ordning")).toBe(true);
    expect(hallbarLjushet(p, "ljus", "accent", p.ljus.accent).fynd.some((x) => x.text === "ordning")).toBe(false);
  });

  it("ingen ljushet håller: tom lista, ingen riktning, ingen närmaste", () => {
    // Ytan mitt på skalan i mörkt läge (#989898, mätt): accenten måste nå 3:1 mot kortet och mot sidan, och samtidigt bära svart eller
    // vit text med 4,5:1. Det går inte att få båda med förvalets kulör, vid någon ljushet.
    const p = med(STANDARDPALETT, "mork", "yta", "#989898");
    const o = hallbarLjushet(p, "mork", "accent", p.mork.accent);
    expect(o.intervall).toEqual([]);
    expect(o.haller).toBe(false);
    expect(o.riktning).toBeNull();
    expect(o.narmaste).toBeNull();
    expect(riktningsbesked(o).sv).toMatch(/^Ingen ljushet håller/);
  });

  it("skala: grått får färgväljarens kulör, och svart är fortfarande svart", () => {
    const o = hallbarLjushet(CP, "ljus", "accent", "#000000", { kulor: 84, mattnad: 17 });
    expect(o.kulor).toBe(84);
    expect(o.mattnad).toBe(17);
    expect(o.ljushet).toBe(0);
    expect(o.farg).toBe("#000000");
  });

  it("kastar på det som inte är en palett, ett läge, en färg eller en färgkod", () => {
    expect(() => hallbarLjushet(/** @type {any} */ ({ ljus: {} }), "ljus", "accent", "#000000")).toThrow(/palett/);
    expect(() => hallbarLjushet(CP, /** @type {any} */ ("dag"), "accent", "#000000")).toThrow(/varken/);
    expect(() => hallbarLjushet(CP, "ljus", /** @type {any} */ ("kant"), "#000000")).toThrow(/färger/);
    expect(() => hallbarLjushet(CP, "ljus", "accent", "grön")).toThrow(/#rrggbb/);
  });
});

describe("palettBesked", () => {
  it("CP:s skärmbild: en rad om accenten i ljust läge, en röd prick på ljust, och raden i mörkt läge", () => {
    const b = palettBesked(CP);
    expect(b.rader.map((r) => r.text.sv)).toEqual(["Accenten i ljust tema är för ljus. Gör den mörkare."]);
    expect(b.rader[0].text.en).toBe("The accent in light mode is too light. Make it darker.");
    expect(b.rader[0].lage).toBe("ljus");
    expect(b.rader[0].nyckel).toBe("accent");
    expect(b.rader[0].riktning).toBe("morkare");
    expect(b.rader[0].narmaste).toBe(hallbarLjushet(CP, "ljus", "accent", "#94a37e").narmaste);
    // Kvoten finns kvar för den som vill läsa den, men står inte i rubriken.
    expect(b.rader[0].fynd.find((x) => x.yta === "raised")?.kvot).toBe(2.62);
    expect(b.rader[0].text.sv).not.toMatch(/\d/);
    expect(b.lagenMedFel).toEqual(["ljus"]);
    expect(b.iAnnatLage.mork?.sv).toBe("Ljust tema behöver ändras innan du kan spara.");
    expect(b.iAnnatLage.ljus).toBeNull();
    expect(b.ovriga).toEqual([]);
  });

  it("⛔ tomhet är ett svar: förvalet ger inga rader, inga lägen med fel och ingen rad i det andra läget", () => {
    expect(palettBesked(STANDARDPALETT)).toEqual({ rader: [], lagenMedFel: [], iAnnatLage: { ljus: null, mork: null }, ovriga: [] });
  });

  it("fel i båda lägena: båda har prick, och varje läge säger att det andra behöver ändras", () => {
    const p = med(CP, "mork", "text", "#6a6f68");
    const b = palettBesked(p);
    expect(b.lagenMedFel).toEqual(["ljus", "mork"]);
    expect(b.iAnnatLage.ljus?.sv).toBe("Mörkt tema behöver ändras innan du kan spara.");
    expect(b.iAnnatLage.mork?.sv).toBe("Ljust tema behöver ändras innan du kan spara.");
    expect(b.rader.map((r) => r.text.sv)).toContain("Texten i mörkt tema är för mörk. Gör den ljusare.");
  });

  it("⛔ slumpvisa paletter: varje fynd står i en rad, och varje rads närmaste färg tar bort radens fynd (golv: 25 paletter med fynd)", () => {
    const r = slump(798);
    let medFynd = 0;
    for (let i = 0; i < 60; i++) {
      // Nära förvalet, så att fynden är få och verkliga, och inte en palett där allt faller.
      const p = structuredClone(STANDARDPALETT);
      const lage = r() < 0.5 ? "ljus" : "mork";
      const nyckel = PALETT_NYCKLAR[Math.floor(r() * 4)];
      const h = hexTillHsl(p[lage][nyckel]);
      p[lage][nyckel] = hslTillHex(h.kulor + (r() - 0.5) * 60, Math.min(100, h.mattnad + r() * 30), Math.min(100, Math.max(0, h.ljushet + (r() - 0.5) * 70)));
      const alla = granskaPalett(p);
      const b = palettBesked(p);
      expect(b.ovriga, JSON.stringify(p)).toEqual([]);
      expect(b.lagenMedFel).toEqual(PALETT_LAGEN.filter((l) => alla.some((x) => x.lage === l)));
      if (alla.length === 0) {
        expect(b.rader).toEqual([]);
        continue;
      }
      medFynd++;
      expect(b.rader.length).toBeGreaterThan(0);
      for (const rad of b.rader) {
        if (!rad.narmaste) continue;
        const efter = granskaPalett(med(p, rad.lage, rad.nyckel, rad.narmaste));
        for (const x of rad.fynd) {
          expect(efter.some((y) => y.lage === x.lage && y.text === x.text && y.yta === x.yta && y.bas === x.bas), `${JSON.stringify(p)} ${rad.nyckel}`).toBe(false);
        }
      }
    }
    expect(medFynd).toBeGreaterThanOrEqual(25);
  });

  it("kastar på det som inte är en palett", () => {
    expect(() => palettBesked(/** @type {any} */ (null))).toThrow(/palett/);
  });
});
