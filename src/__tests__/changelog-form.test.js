import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * Formen på CHANGELOG (0.158.0, granskningen av PR 470): en utgiven version har sina punkter UNDER en rubrik (`###`), aldrig lösa före den första.
 *
 * Händelsen: Groks PR 470 la rubriken "### Ändrat" mitt i "Ej utgivet", ovanför en rad som inte hörde dit ("Visionen i kanon"). I den platta formen,
 * lösa punkter före och efter en rubrik, går det inte att se vilka punkter som hör till rubriken. Alla utgivna versioner med rubriker följer redan formen (mätt
 * när regeln skrevs), och "Ej utgivet" får vara platt eftersom det är en arbetsyta tills versionen får sitt nummer.
 */

/**
 * @param {string} text
 * @returns {string[]} Rubrikerna på de versionsavsnitt som bryter mot formen, med skälet.
 */
export function avsnittSomBryter(text) {
  const delar = text.split(/^## /m).slice(1);
  /** @type {string[]} */
  const brott = [];
  let lasta = 0;
  for (const del of delar) {
    const rader = del.split("\n");
    const titel = rader[0].trim();
    if (!/^\d+\.\d+\.\d+$/.test(titel)) continue;
    const forstaRubrik = rader.findIndex((r) => r.startsWith("### "));
    // En gammal version utan rubriker alls (platt form från före 0.110) är hel och följer ingen rubrik att bryta mot.
    if (forstaRubrik < 0) continue;
    lasta += 1;
    if (rader.slice(1, forstaRubrik).some((r) => /^[-*] /.test(r))) brott.push(`${titel}: en punkt står före den första ### rubriken`);
  }
  if (lasta === 0) brott.push("inga versionsavsnitt lästes (golv)");
  return brott;
}

describe("CHANGELOG: punkterna står under en rubrik", () => {
  it("varje utgiven version följer formen (golv: minst 30 versioner lästa)", () => {
    const text = readFileSync("CHANGELOG.md", "utf8");
    const antal = text.split(/^## /m).slice(1).filter((d) => /^\d+\.\d+\.\d+$/.test(d.split("\n")[0].trim()) && d.includes("\n### ")).length;
    expect(antal).toBeGreaterThanOrEqual(30);
    expect(avsnittSomBryter(text)).toEqual([]);
  });

  it("⛔ vakten är röd för formen som PR 470 gav: en lös punkt, en rubrik, och ännu en lös punkt, i en version", () => {
    const fel = [
      "## 0.9.0",
      "",
      "- Spelraden dockad.",
      "",
      "### Ändrat",
      "- `OpsModulRam`: ikonraden.",
      "",
      "- **Visionen i kanon**",
      "",
      "## 0.8.0",
      "",
      "### Rätt",
      "- En punkt.",
    ].join("\n");
    expect(avsnittSomBryter(fel)).toEqual(["0.9.0: en punkt står före den första ### rubriken"]);
    expect(avsnittSomBryter("## 0.9.0\n\nBara text.\n")).toEqual(["inga versionsavsnitt lästes (golv)"]);
    expect(avsnittSomBryter("## Ej utgivet\n\n- Platt är tillåtet här.\n")).toEqual(["inga versionsavsnitt lästes (golv)"]);
  });
});
