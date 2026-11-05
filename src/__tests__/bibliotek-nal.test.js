import { describe, it, expect } from "vitest";
import { ARKIVTAGG, NALTAGG, arNalad, filtreraBibliotek, normaliseraTagg } from "../lib/bibliotek.js";
import * as hela from "../index.js";

/*
 * Nålen i Biblioteket (0.187.0, cllp/lifehub.app#653, CP: "Stjärna = bara personen, Nål = överst för alla på platsen"): att nåla fast är en tagg, som arkivet. Ingen ny posttyp och inget nytt fält.
 * ⛔ RÖTT UTAN ÄNDRINGEN: `NALTAGG` och `arNalad` fanns inte, en nålad post stod där sorteringen la den, och `stjarnmarkta` filtrerade ingenting.
 */
const p = (id, taggar = [], rubrik = id, andrad = 1) => ({ id, typ: "anteckning", rubrik, text: "", taggar, andrad });

describe("Nålen är en tagg som arkivet", () => {
  it("taggen är giltig som den är, och arNalad läser den", () => {
    expect(NALTAGG).toBe("nal");
    expect(normaliseraTagg(NALTAGG)).toBe(NALTAGG);
    expect(arNalad(p("a", [NALTAGG]))).toBe(true);
    expect(arNalad(p("b", ["kvitto"]))).toBe(false);
    expect(arNalad({})).toBe(false);
    expect(arNalad(null)).toBe(false);
  });

  it("exporteras från huvudingången", () => {
    expect(hela.NALTAGG).toBe("nal");
    expect(hela.arNalad(p("a", [NALTAGG]))).toBe(true);
  });
});

describe("⛔ nålade poster står först, efter sök och filter, och inom grupperna i vanlig ordning", () => {
  const poster = [p("ny", [], "Ny", 30), p("gammal-nal", [NALTAGG], "Gammal nål", 10), p("mitt", [], "Mitt", 20), p("ny-nal", [NALTAGG], "Ny nål", 25)];

  it("de nålade först, nyast först inom dem, sedan de andra nyast först", () => {
    expect(filtreraBibliotek(poster).map((x) => x.id)).toEqual(["ny-nal", "gammal-nal", "ny", "mitt"]);
  });

  it("sök och flik gäller först: en nålad post som inte matchar kommer inte med", () => {
    expect(filtreraBibliotek(poster, { sok: "ny" }).map((x) => x.id)).toEqual(["ny-nal", "ny"]);
    expect(filtreraBibliotek([...poster, { ...p("lank", [NALTAGG], "Länk"), typ: "lank", url: "https://exempel.se" }], { flik: "lank" }).map((x) => x.id)).toEqual(["lank"]);
  });

  it("⛔ en arkiverad nålad post är aldrig först: arkivet döljer den, och med arkivet valt har den vanlig ordning", () => {
    const med = [...poster, p("arkiv-nal", [NALTAGG, ARKIVTAGG], "Arkiverad nål", 1)];
    expect(filtreraBibliotek(med).map((x) => x.id)).toEqual(["ny-nal", "gammal-nal", "ny", "mitt"]);
    expect(filtreraBibliotek(med, { taggar: [ARKIVTAGG] }).map((x) => x.id)).toEqual(["arkiv-nal"]);
    // Arkivet valt tillsammans med en nålad som inte är arkiverad kan inte hända (taggarna är "och"), men ordningen ska inte flytta en arkiverad post över en annan.
    const tva = [p("a", [ARKIVTAGG], "A", 5), p("b", [ARKIVTAGG, NALTAGG], "B", 1)];
    expect(filtreraBibliotek(tva, { taggar: [ARKIVTAGG] }).map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("⛔ nålen är en dold tagg: att söka på den ger inte de nålade posterna", () => {
    expect(filtreraBibliotek(poster, { sok: "nal" }).map((x) => x.id)).toEqual([]);
    expect(filtreraBibliotek([p("x", [NALTAGG], "Rubrik"), p("y", [], "Rubrik två")], { sok: "#nal" }).map((x) => x.id)).toEqual([]);
  });
});

describe("stjarnmarkta: bara poster personen stjärnmärkt", () => {
  const poster = [p("a"), p("b"), p("c")];
  it("en Set, en lista eller ingenting", () => {
    expect(filtreraBibliotek(poster, { stjarnmarkta: new Set(["b"]) }).map((x) => x.id)).toEqual(["b"]);
    expect(filtreraBibliotek(poster, { stjarnmarkta: ["a", "c"] }).map((x) => x.id).sort()).toEqual(["a", "c"]);
    expect(filtreraBibliotek(poster).map((x) => x.id).sort()).toEqual(["a", "b", "c"]);
  });
  it("⛔ en tom mängd ger en tom lista och inte alla", () => {
    expect(filtreraBibliotek(poster, { stjarnmarkta: new Set() })).toEqual([]);
  });
  it("ett id som inte finns i listan (raderad post, annan plats) gör ingenting", () => {
    expect(filtreraBibliotek(poster, { stjarnmarkta: new Set(["finns-inte", "a"]) }).map((x) => x.id)).toEqual(["a"]);
  });
});
