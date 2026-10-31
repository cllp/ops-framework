import { describe, it, expect } from "vitest";
import { ARKIVTAGG, arArkiverad, filtreraBibliotek, normaliseraTagg } from "../lib/bibliotek.js";

/*
 * Arkivet i Biblioteket (0.163.0, lifehub.app#283, CP 2026-10-28): att arkivera är en tagg som döljs som standard, med sök i arkivet. Inget eget läge och ingen egen vy.
 * ⛔ RÖTT UTAN ÄNDRINGEN: `ARKIVTAGG` fanns inte, och en arkiverad post syntes i listan.
 */
const p = (id, taggar = [], rubrik = id) => ({ id, typ: "anteckning", rubrik, text: "", taggar, andrad: 1 });
const poster = [p("a"), p("b", [ARKIVTAGG]), p("c", ["kvitto", ARKIVTAGG], "Kvitto mars")];

describe("Arkivet är en dold tagg", () => {
  it("taggen är en giltig tagg som den normaliseras", () => {
    expect(normaliseraTagg(ARKIVTAGG)).toBe(ARKIVTAGG);
    expect(arArkiverad(poster[1])).toBe(true);
    expect(arArkiverad(poster[0])).toBe(false);
  });
  it("⛔ en arkiverad post syns inte i listan, inte heller i en sökning", () => {
    expect(filtreraBibliotek(poster).map((x) => x.id)).toEqual(["a"]);
    expect(filtreraBibliotek(poster, { sok: "kvitto" }).map((x) => x.id)).toEqual([]);
    expect(filtreraBibliotek(poster, { taggar: ["kvitto"] }).map((x) => x.id)).toEqual([]);
  });
  it("⛔ med arkivtaggen vald syns arkivet, och sökningen söker i det", () => {
    expect(filtreraBibliotek(poster, { taggar: [ARKIVTAGG] }).map((x) => x.id).sort()).toEqual(["b", "c"]);
    expect(filtreraBibliotek(poster, { taggar: [ARKIVTAGG], sok: "mars" }).map((x) => x.id)).toEqual(["c"]);
  });
});
