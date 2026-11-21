import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { GOLV_JSX, TAK, rakna } from "../../scripts/check-bibliotek-text.mjs";

/*
 * 0.251.0, cllp/ops-framework#612. CP 2026-11-17, med engelska valt: "Har engelska i systemet men modulen Bibliotek är på svenska".
 * Vakten räknar svensk text som står direkt i koden i stället för i en ordbok. Här provas räknefunktionen mot små snuttar, så att varje
 * undantag är sett i båda riktningarna: samma text räknas när den står fritt och räknas inte när den står där den ska.
 */

const snutt = (kropp) => `export function X() {\n  ${kropp}\n}\n`;

describe("check-bibliotek-text: rakna", () => {
  it("svensk JSX-text räknas", () => {
    expect(rakna(snutt("return <p>Biblioteket är tomt.</p>;")).traffar).toHaveLength(1);
  });

  it("samma text i en ordpost ({ sv, en }) räknas inte", () => {
    expect(rakna(snutt('const ORD = { tom: { sv: "Biblioteket är tomt.", en: "The library is empty." } }; return <p>{ORD.tom.sv}</p>;')).traffar).toHaveLength(0);
  });

  it("en text i new Error räknas inte (den är riktad till en utvecklare)", () => {
    expect(rakna(snutt('throw new Error("Biblioteket är tomt.");')).traffar).toHaveLength(0);
    expect(rakna(snutt('const e = new TypeError("Posten kunde inte läsas."); return e;')).traffar).toHaveLength(0);
  });

  it("en svensk sträng i ett attribut räknas, men inte i data-* eller className", () => {
    expect(rakna(snutt('return <button aria-label="Ny post" />;')).traffar).toHaveLength(1);
    expect(rakna(snutt('return <div data-lage="Ny post" className="text-rubrik text-ink" />;')).traffar).toHaveLength(0);
  });

  it("ett internt värde (gemener, ett ord) räknas inte, men samma ord som etikett gör det", () => {
    expect(rakna(snutt('const flik = "alla"; return flik === "ny";')).traffar).toHaveLength(0);
    expect(rakna(snutt('return <span>{"Ny"}</span>;')).traffar).toHaveLength(1);
  });

  it("en mallsträng med svensk text räknas, ett internt id gör det inte", () => {
    expect(rakna(snutt("const namn = 'x'; return `Flyttad till ${namn}.`;")).traffar).toHaveLength(1);
    expect(rakna(snutt("const id = 'x'; return `anteckning:${id}:1`;")).traffar).toHaveLength(0);
  });

  it("en kommentar och ett konsolmeddelande räknas inte", () => {
    expect(rakna(snutt('// Biblioteket är tomt.\n  console.error("Längden kunde inte sparas.");')).traffar).toHaveLength(0);
  });

  it("OpsBibliotek.jsx ligger på taket och över golvet", () => {
    const kod = fs.readFileSync(path.resolve(__dirname, "../components/OpsBibliotek.jsx"), "utf8");
    const { traffar, jsxNoder } = rakna(kod);
    expect(jsxNoder).toBeGreaterThanOrEqual(GOLV_JSX);
    expect(traffar.length).toBe(TAK);
  });
});
