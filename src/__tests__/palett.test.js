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
  palettStil,
  palettTillCss,
  tillampaPalett,
} from "../lib/palett.js";
import { PAR } from "../lib/kontrastpar.js";
import { PAR as VAKTENS_PAR } from "../../scripts/check-kontrast.mjs";

/**
 * En hubbs egna färger (0.218.0, cllp/lifehub.app#786). Se filhuvudet i `src/lib/palett.js` för händelsen.
 */

const TOKENS = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "tokens", "tokens.css"), "utf8");

/** SessionStudios gamla palett, föreslagen till hubben (se PR-texten). */
const SESSIONSTUDIO = {
  ljus: { bakgrund: "#f8f7f4", yta: "#ffffff", text: "#1a1a1a", accent: "#5a564c" },
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
    expect(lager).toContain("--color-raised: #ffffff;");
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

  it("ljusgrå text på vit yta nekas, med temat, kvoten och vad som hjälper", () => {
    const fynd = granskaPalett({ ...SESSIONSTUDIO, ljus: { ...SESSIONSTUDIO.ljus, yta: "#ffffff", text: "#aaaaaa" } });
    const yta = fynd.find((f) => f.lage === "ljus" && f.text === "ink" && f.yta === "raised");
    expect(yta).toBeDefined();
    expect(yta?.kvot).toBeLessThan(4.5);
    expect(yta?.meddelande.sv).toBe("Ljust tema: panelens rubrik är för svag, 2,32:1 där 4,5:1 behövs. Gör texten mörkare eller bakgrunden och ytan ljusare, eller tvärtom.");
    expect(yta?.meddelande.en).toMatch(/^Light mode: ink on raised is too weak, 2\.32:1 where 4\.5:1/);
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
    expect(() => byggPalett({ ...SESSIONSTUDIO, ljus: { ...SESSIONSTUDIO.ljus, text: "svart" } })).toThrow(/text i temat ljus är inte en färg/);
    expect(() => byggPalett({ ...SESSIONSTUDIO, hemlig: true })).toThrow(/känner inte hemlig/);
    expect(() => byggPalett({ ...SESSIONSTUDIO, ljus: { ...SESSIONSTUDIO.ljus, kant: "#000000" } })).toThrow(/känner inte kant/);
    expect(() => byggPalett({ ljus: SESSIONSTUDIO.ljus })).toThrow(/saknar temat mork/);
    expect(byggPalett({ ...SESSIONSTUDIO, ljus: { ...SESSIONSTUDIO.ljus, text: "#1A1A1A" } }).ljus.text).toBe("#1a1a1a");
  });

  it("CSS:en bär bara värden ur formen eller härledda ur den", () => {
    const css = palettTillCss(SESSIONSTUDIO);
    for (const m of css.matchAll(/: ([^;]+);/g)) expect(m[1]).toMatch(/^(#[0-9a-f]{6}|rgba\(\d+, \d+, \d+, 0\.\d+\))$/);
  });
});

/**
 * ⛔ GRANSKNINGEN AV 0.218.0. Granskningen hade först en egen lista på sju par. Mätt av en oberoende granskning: slumpvisa paletter
 * som släpptes igenom gav dämpad text på sidan 2,45:1, accenten mot headern 2,69:1, och en palett gav felraden 1,17:1.
 */
describe("⛔ samma par som check-kontrast, och ramverkets statusfärger mot hubbens ytor", () => {
  /** Paren, utskrivna för hand (text, yta, bas). En rad som försvinner ur `kontrastpar.js` gör provet rött. */
  const VANTADE = [
    "ink|raised|", "ink-secondary|raised|", "info|info-bg|raised", "info|info-bg|surface", "info|info-bg|canvas", "badge-contrast|badge|",
    "badge|surface|", "badge|raised|", "danger|raised|", "danger|surface|", "ink-secondary|sunken|", "accent-contrast|accent|",
    "accent-contrast|accent-hover|", "accent|canvas|", "accent|surface|", "marke-accent|surface|", "marke-accent|canvas|", "ink|surface|",
    "ink-secondary|surface|", "ink-secondary|canvas|", "ink-secondary|hover|", "ink|canvas|", "ink|sunken|", "ink|hover|", "accent|raised|",
    "danger|canvas|", "success|canvas|", "success|surface|", "success|raised|", "warning|canvas|", "warning|surface|", "warning|raised|",
    "info|canvas|", "info|surface|", "info|raised|", "badge|canvas|", "marke-accent|raised|",
    /* Kartans text (0.223.0, #570): kartans egna tokens, oberoende av hubbens palett, som räknemärket. */
    "karta-text|karta-papper|", "karta-text|karta-creme|",
  ];
  const nyckel = (/** @type {{ text: string, yta: string, bas?: string }} */ p) => `${p.text}|${p.yta}|${p.bas ?? ""}`;

  it("vakten och granskningen läser samma lista, och den bär varje par", () => {
    expect(VAKTENS_PAR).toBe(PAR);
    expect([...new Set(PAR.map(nyckel))].sort()).toEqual([...VANTADE].sort());
  });

  /**
   * En palett per par som fäller just det paret (ljust tema; det mörka är SessionStudios, som håller). Hittade med en sökning över
   * slumpvisa ljusa paletter i rätt ordning, se PR-texten. `badge-contrast` mot `badge` är ramverkets två egna färger och beror inte
   * på paletten, så den har ingen.
   */
  /** @type {Array<[string, { bakgrund: string, yta: string, text: string, accent: string }]>} */
  const FALLER = [
  ["ink|raised|", {"bakgrund":"#fafee9","yta":"#f1fb83","text":"#37822e","accent":"#ba1562"}],
  ["ink-secondary|raised|", {"bakgrund":"#fafee9","yta":"#f1fb83","text":"#37822e","accent":"#ba1562"}],
  ["info|info-bg|raised", {"bakgrund":"#fafea9","yta":"#aaf8c7","text":"#61231a","accent":"#62600b"}],
  ["info|info-bg|surface", {"bakgrund":"#fafea9","yta":"#aaf8c7","text":"#61231a","accent":"#62600b"}],
  ["info|info-bg|canvas", {"bakgrund":"#fdccee","yta":"#f2fdeb","text":"#791f2f","accent":"#94450c"}],
  ["badge|surface|", {"bakgrund":"#fdfc9f","yta":"#dc84fd","text":"#4a1816","accent":"#541567"}],
  ["badge|raised|", {"bakgrund":"#fbfafa","yta":"#bcbdc5","text":"#191b1e","accent":"#565403"}],
  ["danger|raised|", {"bakgrund":"#fafcec","yta":"#89ea81","text":"#0e2952","accent":"#596cb4"}],
  ["danger|surface|", {"bakgrund":"#ff87ce","yta":"#f8fcd1","text":"#03450b","accent":"#560e3e"}],
  ["ink-secondary|sunken|", {"bakgrund":"#fafee9","yta":"#f1fb83","text":"#37822e","accent":"#ba1562"}],
  ["accent-contrast|accent|", {"bakgrund":"#fafcec","yta":"#89ea81","text":"#0e2952","accent":"#596cb4"}],
  ["accent-contrast|accent-hover|", {"bakgrund":"#fefbab","yta":"#dcffea","text":"#153006","accent":"#a229e8"}],
  ["accent|canvas|", {"bakgrund":"#f6ff9c","yta":"#f0f1dc","text":"#0e480b","accent":"#59de3f"}],
  ["accent|surface|", {"bakgrund":"#f6ff9c","yta":"#f0f1dc","text":"#0e480b","accent":"#59de3f"}],
  ["marke-accent|surface|", {"bakgrund":"#f3eefc","yta":"#f2ffcc","text":"#0e0f56","accent":"#852f78"}],
  ["marke-accent|canvas|", {"bakgrund":"#f3eefc","yta":"#f2ffcc","text":"#0e0f56","accent":"#852f78"}],
  ["ink|surface|", {"bakgrund":"#fafee9","yta":"#f1fb83","text":"#37822e","accent":"#ba1562"}],
  ["ink-secondary|surface|", {"bakgrund":"#fafee9","yta":"#f1fb83","text":"#37822e","accent":"#ba1562"}],
  ["ink-secondary|canvas|", {"bakgrund":"#fafee9","yta":"#f1fb83","text":"#37822e","accent":"#ba1562"}],
  ["ink-secondary|hover|", {"bakgrund":"#f6ff9c","yta":"#f0f1dc","text":"#0e480b","accent":"#59de3f"}],
  ["ink|canvas|", {"bakgrund":"#e5feba","yta":"#faf3e8","text":"#61792a","accent":"#3c58d7"}],
  ["ink|sunken|", {"bakgrund":"#e5feba","yta":"#faf3e8","text":"#61792a","accent":"#3c58d7"}],
  ["ink|hover|", {"bakgrund":"#fafee9","yta":"#f1fb83","text":"#37822e","accent":"#ba1562"}],
  ["accent|raised|", {"bakgrund":"#fcfacb","yta":"#f4dfe4","text":"#6e0746","accent":"#459c14"}],
  ["danger|canvas|", {"bakgrund":"#90e493","yta":"#faffff","text":"#481405","accent":"#7d8226"}],
  ["success|canvas|", {"bakgrund":"#f3eefc","yta":"#f2ffcc","text":"#0e0f56","accent":"#852f78"}],
  ["success|surface|", {"bakgrund":"#fafea9","yta":"#aaf8c7","text":"#61231a","accent":"#62600b"}],
  ["success|raised|", {"bakgrund":"#fafea9","yta":"#aaf8c7","text":"#61231a","accent":"#62600b"}],
  ["warning|canvas|", {"bakgrund":"#f3eefc","yta":"#f2ffcc","text":"#0e0f56","accent":"#852f78"}],
  ["warning|surface|", {"bakgrund":"#f3eefc","yta":"#f2ffcc","text":"#0e0f56","accent":"#852f78"}],
  ["warning|raised|", {"bakgrund":"#fafea9","yta":"#aaf8c7","text":"#61231a","accent":"#62600b"}],
  ["info|canvas|", {"bakgrund":"#fdccee","yta":"#f2fdeb","text":"#791f2f","accent":"#94450c"}],
  ["info|surface|", {"bakgrund":"#8adbd1","yta":"#f9fd95","text":"#072036","accent":"#991259"}],
  ["info|raised|", {"bakgrund":"#fff8ed","yta":"#cbee8b","text":"#2f0a4e","accent":"#7c3fba"}],
  ["badge|canvas|", {"bakgrund":"#e5ad8d","yta":"#edfbd6","text":"#411e0a","accent":"#860646"}],
  ["marke-accent|raised|", {"bakgrund":"#fafea9","yta":"#aaf8c7","text":"#61231a","accent":"#62600b"}],
  ];

  it("varje par som beror på paletten fälls av sin palett", () => {
    // ⛔ GOLV: varje par utom de tre som inte beror på paletten (räknemärket och kartans två, 0.223.0).
    expect(FALLER.length).toBe(VANTADE.length - 3);
    for (const [k, ljus] of FALLER) {
      const fynd = granskaPalett({ ljus, mork: SESSIONSTUDIO.mork });
      expect(fynd.some((f) => f.lage === "ljus" && nyckel(f) === k), k).toBe(true);
    }
  });

  it("granskningens exempel nekas: magenta och laxrosa, och en palett med vänt tema", () => {
    expect(granskaPalett({ ljus: { bakgrund: "#ff08ff", yta: "#f3cfc1", text: "#422118", accent: "#680b45" }, mork: SESSIONSTUDIO.mork }).length).toBeGreaterThan(0);
    const vand = granskaPalett({
      ljus: { bakgrund: "#7a2e28", yta: "#8a3a32", text: "#ffffff", accent: "#ffd166" },
      mork: { bakgrund: "#d97669", yta: "#e08a7e", text: "#000000", accent: "#1a1a1a" },
    });
    expect(vand.filter((f) => f.text === "ordning").map((f) => f.lage).sort()).toEqual(["ljus", "mork"]);
    expect(vand.some((f) => f.lage === "ljus" && f.text === "danger")).toBe(true);
    expect(vand.some((f) => f.lage === "mork" && f.text === "danger")).toBe(true);
  });

  it("ljust tema med ytan mörkare än texten nekas, och mörkt tema tvärtom, också när kontrasten håller", () => {
    const ljus = granskaPalett({ ljus: { bakgrund: "#f8f7f4", yta: "#111111", text: "#f5f5f5", accent: "#5a564c" }, mork: SESSIONSTUDIO.mork });
    expect(ljus.find((f) => f.text === "ordning")?.meddelande.sv).toBe("Ljust tema: bakgrunden och ytan ska vara ljusare än texten.");
    const mork = granskaPalett({ ljus: SESSIONSTUDIO.ljus, mork: { bakgrund: "#121218", yta: "#f0f0f0", text: "#101010", accent: "#e8e0d0" } });
    expect(mork.find((f) => f.text === "ordning")?.meddelande.sv).toBe("Mörkt tema: bakgrunden och ytan ska vara mörkare än texten.");
  });
});

describe("⛔ ingen sträng rakt in i stilen", () => {
  const ATTACK = "red}}body{display:none}@layer theme{:root{--x:1";
  const ond = { ...SESSIONSTUDIO, ljus: { ...SESSIONSTUDIO.ljus, text: ATTACK } };

  it("palettTillCss och granskaPalett kastar", () => {
    expect(() => palettTillCss(/** @type {any} */ (ond))).toThrow(/inte en palett/);
    expect(() => granskaPalett(/** @type {any} */ (ond))).toThrow(/inte en palett/);
  });

  it("tillampaPalett tar bort stilen i stället för att skriva den", () => {
    tillampaPalett(SESSIONSTUDIO);
    tillampaPalett(/** @type {any} */ (ond));
    expect(document.getElementById(PALETT_STIL_ID)).toBeNull();
    expect(document.head.innerHTML).not.toContain("display:none");
  });

  it("palettStil ger ingen stil", () => {
    expect(palettStil(/** @type {any} */ (ond), "ljus")).toEqual({});
    expect(palettStil(SESSIONSTUDIO, /** @type {any} */ ("annat"))).toEqual({});
  });
});
