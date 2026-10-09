import { describe, expect, it } from "vitest";
import { identityTone } from "../lib/identity.js";
import { lagerFarg, lagerNyckel, lagerSektioner, lasDoldaLager, synligaLager, vaxlaDoltLager } from "../lib/kalenderlager.js";

/**
 * Räkningen för lagren, utan att rita.
 *
 * ⛔ ETT DOLT LAGER ÄR BORTA UR LISTAN. Provet jämför mot en lista där id:t saknas. Hade `synligaLager` släppt igenom
 * allt hade raden med "jobb" funnits kvar, och det är det utfallet som ska vara rött.
 */

describe("kalenderlager", () => {
  const lista = [
    { id: "ical:jobb", namn: "Jobb", farg: /** @type {const} */ (2), sektion: "Externa kalendrar" },
    { id: "ical:familj", namn: "Familj", sektion: "Externa kalendrar" },
    { id: "helg", namn: "Helgdagar", sektion: "Helgdagar" },
  ];

  it("döljer bara det id personen slagit av, och lämnar resten i ordning", () => {
    expect(synligaLager(lista, []).map((l) => l.id)).toEqual(["ical:jobb", "ical:familj", "helg"]);
    expect(synligaLager(lista, ["ical:jobb"]).map((l) => l.id)).toEqual(["ical:familj", "helg"]);
    expect(synligaLager(lista, ["borta"]).map((l) => l.id)).toEqual(["ical:jobb", "ical:familj", "helg"]);
  });

  it("en trasig sparad post är allt synligt, inte ett kast", () => {
    expect(lasDoldaLager(null)).toEqual([]);
    expect(lasDoldaLager("inte json")).toEqual([]);
    expect(lasDoldaLager(JSON.stringify(["ical:jobb", 3, ""]))).toEqual(["ical:jobb"]);
  });

  it("växlar ett id till och från den dolda listan", () => {
    expect(vaxlaDoltLager([], "ical:jobb")).toEqual(["ical:jobb"]);
    expect(vaxlaDoltLager(["ical:jobb", "helg"], "ical:jobb")).toEqual(["helg"]);
  });

  it("nyckeln är personens, så två personer inte delar val", () => {
    expect(lagerNyckel("a")).toBe("ops-kalender-lager:a");
    expect(lagerNyckel("a")).not.toBe(lagerNyckel("b"));
  });

  it("färgen är en identitetston, och en ogiltig färg räknas ur id, inte ur en gruppkulör", () => {
    expect(lagerFarg({ id: "ical:jobb", farg: 4 })).toBe(4);
    expect(lagerFarg({ id: "ical:familj" })).toBe(identityTone("ical:familj"));
    expect(lagerFarg({ id: "ical:familj" })).toBe(lagerFarg({ id: "ical:familj" }));
    expect(lagerFarg({ id: "ical:familj", farg: /** @type {1} */ (/** @type {unknown} */ ("kulor:210")) })).toBe(identityTone("ical:familj"));
    expect(lagerFarg({ id: "ical:familj", farg: 9 })).toBe(identityTone("ical:familj"));
  });

  it("sektionerna kommer i den ordning de dyker upp", () => {
    const ut = lagerSektioner(lista);
    expect(ut.map((s) => s.namn)).toEqual(["Externa kalendrar", "Helgdagar"]);
    expect(ut[0].lager.map((l) => l.id)).toEqual(["ical:jobb", "ical:familj"]);
  });
});
