import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import {
  PALETT_STIL_ID,
  PALETT_TOKEN,
  STANDARDPALETT,
  byggPalett,
  granskaPalett,
  harledPalett,
  kontrastkvot,
  lasPalett,
  normaliseraHex,
  palettTillCss,
  tillampaPalett,
} from "../lib/palett.js";

/**
 * En hubbs egna färger (0.218.0, cllp/lifehub.app#786). Se filhuvudet i `src/lib/palett.js` för händelsen.
 */

const TOKENS = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "tokens", "tokens.css"), "utf8");

/** SessionStudios gamla palett, föreslagen till hubben (se PR-texten). */
const SESSIONSTUDIO = {
  ljus: { bakgrund: "#f8f7f4", yta: "#f0ede8", text: "#1a1a1a", accent: "#5a564c" },
  mork: { bakgrund: "#121218", yta: "#1f1f25", text: "#e8e4df", accent: "#e8e0d0" },
};

afterEach(() => {
  document.getElementById(PALETT_STIL_ID)?.remove();
});

describe("ingen palett: appen är exakt som förut", () => {
  it("ingen stil i dokumentet, och en tidigare palett tas bort helt (Återställ)", () => {
    tillampaPalett(null);
    expect(document.getElementById(PALETT_STIL_ID)).toBeNull();
    tillampaPalett(SESSIONSTUDIO);
    expect(document.getElementById(PALETT_STIL_ID)).not.toBeNull();
    tillampaPalett(null);
    expect(document.getElementById(PALETT_STIL_ID)).toBeNull();
    // ⛔ GOLV: tokens.css lästes och bär förvalet. En tom fil hade gett noll träffar och gröna prov.
    expect(TOKENS.length).toBeGreaterThan(10000);
  });

  it("ett saknat, halvt eller felformat dokument läses som ingen palett", () => {
    expect(lasPalett(undefined)).toBeNull();
    expect(lasPalett({ ljus: SESSIONSTUDIO.ljus })).toBeNull();
    expect(lasPalett({ ...SESSIONSTUDIO, mork: { ...SESSIONSTUDIO.mork, accent: "beige" } })).toBeNull();
    expect(lasPalett(SESSIONSTUDIO)).toEqual(SESSIONSTUDIO);
  });

  it("förvalet är tokens.css egna tal (generatorn), och det håller sin egen granskning", () => {
    expect(TOKENS).toContain(`--color-canvas: ${STANDARDPALETT.ljus.bakgrund}`);
    expect(TOKENS).toContain(`--dark-raised: ${STANDARDPALETT.mork.yta}`);
    expect(TOKENS.toLowerCase()).toContain(`--color-ink: ${STANDARDPALETT.ljus.text}`);
    expect(granskaPalett(STANDARDPALETT)).toEqual([]);
  });
});

describe("en palett skriver över ramverkets token, i båda lägena", () => {
  it("varje token paletten skriver finns i tokens.css, som --color-* och som --dark-*", () => {
    // ⛔ GOLV: femton token. Färre betyder att härledningen tappat något.
    expect(PALETT_TOKEN.length).toBeGreaterThanOrEqual(15);
    for (const n of PALETT_TOKEN) {
      expect(TOKENS, `--color-${n}`).toMatch(new RegExp(`--color-${n}:`));
      expect(TOKENS, `--dark-${n}`).toMatch(new RegExp(`--dark-${n}:`));
    }
  });

  it("ljust i lagret theme som --color-*, mörkt olagrat som --dark-*, och stilen ligger sist i head", () => {
    const fore = document.createElement("style");
    fore.id = "ramverket";
    document.head.appendChild(fore);
    tillampaPalett(SESSIONSTUDIO);
    const stil = /** @type {HTMLStyleElement} */ (document.getElementById(PALETT_STIL_ID));
    const css = stil.textContent ?? "";
    const [lager, rot] = css.split(/\n}\n:root/);
    expect(lager).toMatch(/^@layer theme \{\n {2}:root \{/);
    expect(lager).toContain("--color-canvas: #f8f7f4;");
    expect(lager).toContain("--color-raised: #f0ede8;");
    expect(lager).toContain("--color-ink: #1a1a1a;");
    expect(lager).toContain("--color-accent: #5a564c;");
    expect(lager).not.toContain("--dark-");
    expect(rot).toContain("--dark-canvas: #121218;");
    expect(rot).toContain("--dark-raised: #1f1f25;");
    expect(rot).toContain("--dark-ink: #e8e4df;");
    expect(rot).toContain("--dark-accent: #e8e0d0;");
    expect(rot).not.toContain("--color-");
    expect(document.head.lastElementChild).toBe(stil);
    fore.remove();
  });

  it("⛔ aldrig som style på <html>: då hade det ljusa värdet gällt i mörkt läge också", () => {
    tillampaPalett(SESSIONSTUDIO);
    expect(document.documentElement.getAttribute("style") ?? "").not.toMatch(/--color-|--dark-/);
  });

  it("ett nytt val skriver om samma stil, inte en till", () => {
    tillampaPalett(SESSIONSTUDIO);
    tillampaPalett(STANDARDPALETT);
    expect(document.querySelectorAll(`#${PALETT_STIL_ID}`)).toHaveLength(1);
    expect(document.getElementById(PALETT_STIL_ID)?.textContent).toContain(`--dark-canvas: ${STANDARDPALETT.mork.bakgrund};`);
  });

  it("härledningen ger ungefär ramverkets egna steg ur förvalet", () => {
    const t = harledPalett(STANDARDPALETT);
    expect(t.mork.hover).toBe("#363c35");
    expect(t.mork.sunken).toBe("#1c201c");
    expect(t.ljus.line).toBe("#e7e3de");
    expect(t.ljus["accent-contrast"]).toBe("#000000");
  });
});

describe("oläsligt nekas, med en mening som säger varför", () => {
  it("SessionStudios föreslagna palett håller", () => {
    expect(granskaPalett(SESSIONSTUDIO)).toEqual([]);
  });

  it("ljusgrå text på vit yta nekas, med läget, kvoten och vad som hjälper", () => {
    const fynd = granskaPalett({ ...SESSIONSTUDIO, ljus: { ...SESSIONSTUDIO.ljus, yta: "#ffffff", text: "#aaaaaa" } });
    const yta = fynd.find((f) => f.lage === "ljus" && f.text === "ink" && f.yta === "raised");
    expect(yta).toBeDefined();
    expect(yta?.kvot).toBeLessThan(4.5);
    expect(yta?.meddelande.sv).toBe("Ljust läge: texten mot ytan är för svag, 2,32:1 där 4,5:1 behövs för att läsas. Gör texten mörkare eller ytan ljusare, eller tvärtom.");
    expect(yta?.meddelande.en).toMatch(/^Light mode: text on the surface is too weak, 2\.32:1 where 4\.5:1/);
    expect(fynd.every((f) => f.lage === "ljus")).toBe(true);
  });

  it("en accent som går i ett med bakgrunden nekas (grafik, 3:1)", () => {
    const fynd = granskaPalett({ ...SESSIONSTUDIO, mork: { ...SESSIONSTUDIO.mork, accent: "#202028" } });
    expect(fynd.some((f) => f.lage === "mork" && f.text === "accent" && f.yta === "canvas")).toBe(true);
  });

  it("kontrastkvoten är WCAG:s: svart mot vitt 21, samma färg 1", () => {
    expect(kontrastkvot("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(kontrastkvot("#777777", "#777777")).toBe(1);
  });
});

describe("bara #rrggbb", () => {
  it("normaliserar en inmatning till formen, och nekar det som inte är en färg", () => {
    expect(normaliseraHex(" #ABC ")).toBe("#aabbcc");
    expect(normaliseraHex("1f1f25")).toBe("#1f1f25");
    for (const fel of ["beige", "#12345", "rgb(1,2,3)", "#1234567", "", null, 12]) expect(normaliseraHex(fel), String(fel)).toBeNull();
  });

  it("byggPalett kastar på en icke-färg, ett okänt fält och ett saknat läge", () => {
    expect(() => byggPalett({ ...SESSIONSTUDIO, ljus: { ...SESSIONSTUDIO.ljus, text: "svart" } })).toThrow(/text i läget ljus är inte en färg/);
    expect(() => byggPalett({ ...SESSIONSTUDIO, hemlig: true })).toThrow(/känner inte hemlig/);
    expect(() => byggPalett({ ...SESSIONSTUDIO, ljus: { ...SESSIONSTUDIO.ljus, kant: "#000000" } })).toThrow(/känner inte kant/);
    expect(() => byggPalett({ ljus: SESSIONSTUDIO.ljus })).toThrow(/saknar läget mork/);
    expect(byggPalett({ ...SESSIONSTUDIO, ljus: { ...SESSIONSTUDIO.ljus, text: "#1A1A1A" } }).ljus.text).toBe("#1a1a1a");
  });

  it("CSS:en bär bara värden ur formen eller härledda ur den", () => {
    const css = palettTillCss(SESSIONSTUDIO);
    for (const m of css.matchAll(/: ([^;]+);/g)) expect(m[1]).toMatch(/^(#[0-9a-f]{6}|rgba\(\d+, \d+, \d+, 0\.\d+\))$/);
  });
});
