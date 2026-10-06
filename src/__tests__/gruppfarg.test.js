import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { createElement } from "react";
import { ARV_TON_KULOR, GRUPPKULORFORSLAG, fargTillKulor, gruppKulor, kulorTillFarg, narmasteKulornamn } from "../lib/gruppfarg.js";
import { hexKulor } from "../lib/oklch.js";
import { identityTone } from "../lib/identity.js";
import { OpsIdentity } from "../components/OpsIdentity.jsx";

/** Gruppens kulör (0.65.0, #265). */

const tokens = fs.readFileSync(path.resolve(__dirname, "../../tokens/tokens.css"), "utf8");

describe("⛔ de äldre tonerna läses vidare som sin egen kulör", () => {
  it.each([1, 2, 3, 4, 5, 6])("ton %i: ARV_TON_KULOR är kulören ur --color-identity-%i i tokens.css", (n) => {
    const hex = new RegExp(`--color-identity-${n}: (#[0-9a-f]{6});`).exec(tokens)?.[1];
    expect(hex, `--color-identity-${n}`).toBeTruthy();
    expect(ARV_TON_KULOR[/** @type {1} */ (n)]).toBe(hexKulor(/** @type {string} */ (hex)));
  });

  it("en grupp utan färg får kulören dess ton ur id hade haft", () => {
    for (const id of ["g1", "bolaget", "familjen", "x"]) expect(gruppKulor({ id })).toBe(ARV_TON_KULOR[identityTone(id)]);
  });
});

describe("⛔ lagringsformen", () => {
  it("kulor:0 till kulor:359, en äldre ton, eller tom", () => {
    expect(fargTillKulor("kulor:0")).toBe(0);
    expect(fargTillKulor("kulor:359")).toBe(359);
    expect(fargTillKulor("kulor:360")).toBeNull();
    expect(fargTillKulor("kulor:abc")).toBeNull();
    // ⛔ En lagrad form per kulör (granskningen av PR 266): inga inledande nollor.
    expect(fargTillKulor("kulor:007")).toBeNull();
    expect(fargTillKulor("kulor:07")).toBeNull();
    expect(fargTillKulor("kulor:00")).toBeNull();
    expect(fargTillKulor("kulor:7")).toBe(7);
    expect(fargTillKulor("#ff0000")).toBeNull();
    expect(fargTillKulor("3")).toBe(ARV_TON_KULOR[3]);
    expect(fargTillKulor("")).toBeNull();
    expect(kulorTillFarg(210)).toBe("kulor:210");
    expect(() => kulorTillFarg(360)).toThrow();
    expect(() => kulorTillFarg(1.5)).toThrow();
  });

  it("närmaste kulörnamn runt cirkeln", () => {
    expect(narmasteKulornamn(227)).toBe("Turkos");
    expect(narmasteKulornamn(359)).toBe("Rosa");
    expect(narmasteKulornamn(5)).toBe("Hallon");
    expect(narmasteKulornamn(10, "en")).toBe("Raspberry");
  });

  it("golv: minst tolv snabbval, unika, inom 0 till 359", () => {
    expect(GRUPPKULORFORSLAG.length).toBeGreaterThanOrEqual(12);
    const k = GRUPPKULORFORSLAG.map((f) => f.kulor);
    expect(new Set(k).size).toBe(k.length);
    for (const g of k) expect(g >= 0 && g <= 359).toBe(true);
  });
});

describe("⛔ märket: ikonen i kulören på en tonad platta", () => {
  it("med kulör ritas gruppmärket, inte tonens fyllda ruta", () => {
    const { container } = render(createElement(OpsIdentity, { name: "Bandet", seed: "g1", kulor: 195 }));
    const el = /** @type {HTMLElement} */ (container.firstElementChild);
    expect(el).toHaveClass("ops-gruppmarke");
    expect(el.className).not.toMatch(/bg-identity-/);
    expect(el.style.getPropertyValue("--grupp-kulor")).toBe("195");
  });

  it("en kulör utanför 0 till 359 hålls inom cirkeln", () => {
    const { container } = render(createElement(OpsIdentity, { name: "X", seed: "g1", kulor: -30 }));
    expect(/** @type {HTMLElement} */ (container.firstElementChild).getAttribute("data-grupp-kulor")).toBe("330");
  });

  it("utan kulör ritas en person som förut", () => {
    const { container } = render(createElement(OpsIdentity, { name: "Anna", seed: "u1", tone: 2 }));
    expect(container.firstElementChild).toHaveClass("bg-identity-2");
  });

  it("⛔ tokens.css ritar märket ur temat i båda lägena", () => {
    expect(tokens).toMatch(/\.ops-gruppmarke \{[^}]*oklch\(var\(--gruppmarke-platta-l\) var\(--gruppmarke-platta-c\) var\(--grupp-kulor\)\)/);
    for (const n of ["ikon-l", "ikon-c", "platta-l", "platta-c"]) {
      expect(tokens).toMatch(new RegExp(`--gruppmarke-${n}: var\\(--dark-gruppmarke-${n}\\);`));
    }
  });
});
