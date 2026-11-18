import { describe, expect, it } from "vitest";
import * as huvud from "../index.js";
import * as talkrost from "../lib/talkrost.js";
import * as kalenderfarg from "../lib/kalenderfarg.js";

/*
 * TALK:s röstsamtal går att bygga i appen (cllp/lifehub.app#870, skiva 4).
 *
 * Händelsen: 0.238.0 lät `OpsTalk` samtala när appens `onAgent` löser till en `Talkrost`, och ändringsloggen bad appen bygga den
 * med `samtalssvar` och `vidareISamtal`. Ingen av dem fanns i huvudingången. Mätt vid lifehub.app:s ompinning 2026-11-18: appen
 * kunde inte importera dem, och den enda andra vägen hade varit en egen kopia av logiken (regel 2).
 *
 * Provet läser namnen ur huvudingången och kräver att de är SAMMA funktioner som i `lib/talkrost.js`, ingen kopia.
 */
describe("huvudingången bär röstsamtalets byggstenar", () => {
  it.each(["samtalssvar", "vidareISamtal", "talkrostUr"])("%s finns och är samma funktion som i lib/talkrost.js", (namn) => {
    expect(typeof /** @type {any} */ (huvud)[namn]).toBe("function");
    expect(/** @type {any} */ (huvud)[namn]).toBe(/** @type {any} */ (talkrost)[namn]);
  });
});

/*
 * Kalenderns kulör (cllp/lifehub.app#882). Sedan 0.238.0 bär dagrutans ram kalenderns kulör (`data-dagram`), räknad med `kalenderKulor`.
 * Mätt vid appens ompinning: appens prov för ramen jämförde med `lagerFarg` (en ton, 6) och fick kulören (119), och kunde inte importera
 * funktionen som ger rätt värde.
 */
describe("huvudingången bär kalenderns kulör", () => {
  it.each(["kalenderKulor", "kalenderfargKulor"])("%s finns och är samma funktion som i lib/kalenderfarg.js", (namn) => {
    expect(typeof /** @type {any} */ (huvud)[namn]).toBe("function");
    expect(/** @type {any} */ (huvud)[namn]).toBe(/** @type {any} */ (kalenderfarg)[namn]);
  });
});
