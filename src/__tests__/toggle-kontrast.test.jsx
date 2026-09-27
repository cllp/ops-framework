import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";

import { OpsSwitch } from "../components/OpsToggle.jsx";
import { PAR, lasTokens } from "../../scripts/check-kontrast.mjs";

/**
 * Reglaget ska gå att se (cllp/bolag-ops#417).
 *
 * ══ ⛔ VARFÖR DET HÄR PROVET FINNS BREDVID `check-kontrast` ════════════
 *
 * Vakten mäter TOKENS. Den kan svara på om `ink-secondary` mot `raised` når
 * 3:1, och det är rätt fråga att ställa en gång per par.
 *
 * ⛔ MEN DEN VET INGENTING OM ATT KOMPONENTEN ANVÄNDER DEM. Tas kanten bort ur
 * `OpsToggle` är vakten fortfarande grön: paret håller, det är bara ingen som
 * ritar det. Det är exakt samma felklass som kostade ett dygn i bolag-ops i
 * går, där en vakt matchade texten i ett anrop och inte såg att importen ovanför
 * slutat ge något.
 *
 * Det här provet är länken: komponenten ritar de klasser vakten mäter.
 */
describe("reglagets kontrast", () => {
  /** Spåret och knoppen, ur den renderade switchen. */
  const delar = () => {
    render(<OpsSwitch label="Visa systemhändelser (58)" checked={false} onChange={() => {}} />);
    const spar = document.querySelector("span[aria-hidden='true']");
    return { spar, knopp: spar && spar.querySelector("span") };
  };

  it("⛔ spåret har en KANT och inte bara en fyllning", () => {
    /*
     * Fyllningen kan inte bära kravet: `sunken` ligger per definition nära
     * ytan den vilar på, och mätt gav den 1,00:1 i mörkt läge mot panelen.
     * Kanten är hela fixen, så det är kanten provet kräver.
     */
    const { spar } = delar();
    expect(spar).toBeTruthy();
    expect(spar.className).toContain("border-ink-secondary");
  });

  it("⛔ knoppen har också en kant, för den var osynlig i BÅDA temana", () => {
    // `bg-canvas` mot `bg-sunken` var 1,09:1 i ljust och 1,14:1 i mörkt.
    const { knopp } = delar();
    expect(knopp).toBeTruthy();
    expect(knopp.className).toContain("border-ink-secondary");
  });

  it("⛔ knoppen ligger på `raised`, inte på `canvas`", () => {
    /*
     * `raised` är tokenet för det som ligger OVANPÅ något, och det är dessutom
     * det enda som når 3:1 mot `accent` i mörkt läge (12,46:1), där kanten inte
     * räcker (2,44:1).
     */
    const { knopp } = delar();
    expect(knopp.className).toContain("bg-raised");
    expect(knopp.className).not.toContain("bg-canvas");
  });

  it("⛔ läget avgörs inte av färg ensam: knoppen FLYTTAR sig", () => {
    /*
     * WCAG 1.4.1. Den som inte skiljer tonerna åt ska ändå kunna läsa läget,
     * och rörelsen är den avläsningen. Utan den vore en färgändring hela
     * skillnaden.
     */
    const { unmount } = render(<OpsSwitch label="På" checked onChange={() => {}} />);
    const pa = document.querySelector("span[aria-hidden='true'] span").className;
    unmount();
    render(<OpsSwitch label="Av" checked={false} onChange={() => {}} />);
    const av = document.querySelector("span[aria-hidden='true'] span").className;
    expect(pa).toContain("translate-x-4");
    expect(av).not.toContain("translate-x-4");
  });

  it("och etiketten når användaren", () => {
    delar();
    expect(screen.getByRole("switch", { name: /Visa systemhändelser/ })).toBeInTheDocument();
  });
});

describe("vakten och komponenten pekar på samma tokens", () => {
  /*
   * ⛔ PAREN LÄSES UR VAKTEN, inte skrivna av här. En kopia av namnen hade
   * varit ännu ett par som kan glida isär, alltså samma felklass provet ovan
   * finns till för.
   */
  const reglagets = PAR.filter((p) => p.vad.startsWith("reglagets"));

  it("vakten bär reglagets par alls", () => {
    expect(reglagets.length).toBeGreaterThan(0);
  });

  it("⛔ och varje token vakten mäter ritas faktiskt av komponenten", () => {
    const kalla = fs.readFileSync(path.join(import.meta.dirname, "..", "components", "OpsToggle.jsx"), "utf8");
    for (const p of reglagets) {
      for (const roll of ["text", "yta"]) {
        const tok = p[roll];
        // `raised`, `sunken`, `accent` och `ink-secondary` ska alla synas som
        // en klass i filen, annars mäter vakten något som inte ritas.
        expect(kalla, `${p.vad}: tokenet ${tok} står i vakten men ritas inte i OpsToggle`).toMatch(
          new RegExp(`(bg|border|text)-${tok}\\b`),
        );
      }
    }
  });

  it("⛔ och paren håller mot de riktiga tokenvärdena, i båda temana", () => {
    /*
     * Spegelraden mot `check-kontrast`. Den körs i CI som ett eget steg, men
     * ett prov som är grönt medan vakten är röd är två sanningar om samma sak.
     */
    const css = fs.readFileSync(path.join(import.meta.dirname, "..", "..", "tokens", "tokens.css"), "utf8");
    const lum = (h) => {
      const r = h.replace("#", "");
      const full = r.length === 3 ? [...r].map((c) => c + c).join("") : r;
      const c = [0, 2, 4]
        .map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
        .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const kontrast = (a, b) => {
      const [la, lb] = [lum(a), lum(b)];
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };

    for (const tema of ["light", "dark"]) {
      const t = lasTokens(css, tema);
      for (const p of reglagets) {
        expect(kontrast(t[p.text], t[p.yta]), `${tema}: ${p.vad}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
