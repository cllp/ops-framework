import { describe, expect, it } from "vitest";
import {
  KALENDERVISNINGAR,
  TOM_SYNLIGHET,
  aterstallKalenderSynlighet,
  arForvaldSynlighet,
  arKalenderSynlig,
  kalenderSynlighetNyckel,
  kalenderVisning,
  lasKalenderSynlighet,
  sattKalenderVisning,
  skrivKalenderSynlighet,
  synligaKalenderRader,
  vaxlaKalenderSynlighet,
} from "../lib/kalendersynlighet.js";

/**
 * Minnet för vilka kalendrar som syns och hur (0.134.0, cllp/lifehub.app#402).
 *
 * ⛔ GOLVET: provet nedan går igenom ALLA kombinationer av förval, sparat val och synlig/dold, 8 rader, och räknar dem. Ett prov som
 * går igenom noll kombinationer är grönt av att ingenting mättes (arbetsreglernas punkt 4, tomt underlag).
 */

const FRAN_START = { id: "arenden", avFranStart: true };
const SYNS = { id: "gruppen" };

describe("synlighetsminnet: förvalet och personens val", () => {
  it("nyckeln bär appens minne och inget annat", () => {
    expect(kalenderSynlighetNyckel("person-a:grupp-1")).toBe("ops-kalender-synlighet:person-a:grupp-1");
  });

  it("⛔ varje kombination av förval och sparat val ger rätt svar (golv: 6 fall)", () => {
    /** @type {Array<[object, boolean | undefined, boolean]>} */
    const fall = [
      [SYNS, undefined, true],
      [SYNS, true, true],
      [SYNS, false, false],
      [FRAN_START, undefined, false],
      [FRAN_START, true, true],
      [FRAN_START, false, false],
    ];
    expect(fall.length).toBeGreaterThanOrEqual(6);
    for (const [rad, valt, vantat] of fall) {
      const val = valt === undefined ? TOM_SYNLIGHET : { ...TOM_SYNLIGHET, syns: { [/** @type {any} */ (rad).id]: valt } };
      expect(arKalenderSynlig(/** @type {any} */ (rad), val), JSON.stringify({ rad, valt })).toBe(vantat);
    }
  });

  it("ett nytt id syns av sig självt, och ett id med avFranStart gör det inte", () => {
    const val = lasKalenderSynlighet(JSON.stringify({ v: 1, syns: { gammal: false }, visning: {} }));
    expect(arKalenderSynlig({ id: "ny" }, val)).toBe(true);
    expect(arKalenderSynlig({ id: "ny-arenden", avFranStart: true }, val)).toBe(false);
  });

  it("ett tryck byter, två tryck är tillbaka, och valet är uttryckligt", () => {
    const dold = vaxlaKalenderSynlighet(SYNS, TOM_SYNLIGHET);
    expect(dold.syns).toEqual({ gruppen: false });
    expect(arKalenderSynlig(SYNS, dold)).toBe(false);
    const tillbaka = vaxlaKalenderSynlighet(SYNS, dold);
    expect(arKalenderSynlig(SYNS, tillbaka)).toBe(true);
    // Ett byte ändrar inte det som gavs in.
    expect(TOM_SYNLIGHET.syns).toEqual({});
  });

  it("visning: förvalet är Händelser, ett val sparas och Händelser tar bort posten", () => {
    expect(kalenderVisning(SYNS, TOM_SYNLIGHET)).toBe("handelser");
    const ram = sattKalenderVisning(SYNS, "ram", TOM_SYNLIGHET);
    expect(kalenderVisning(SYNS, ram)).toBe("ram");
    expect(ram.visning).toEqual({ gruppen: "ram" });
    const bada = sattKalenderVisning(SYNS, "bada", ram);
    expect(bada.visning).toEqual({ gruppen: "bada" });
    expect(sattKalenderVisning(SYNS, "handelser", bada).visning).toEqual({});
    expect(KALENDERVISNINGAR).toEqual(["handelser", "ram", "bada"]);
  });

  it("⛔ en okänd visning kastar och sparas aldrig", () => {
    expect(() => sattKalenderVisning(SYNS, /** @type {any} */ ("kant"), TOM_SYNLIGHET)).toThrow(/okänd visning "kant"/);
  });

  it("visa alla tömmer synligheten men rör inte visningen", () => {
    const val = sattKalenderVisning(SYNS, "ram", vaxlaKalenderSynlighet(SYNS, TOM_SYNLIGHET));
    const ater = aterstallKalenderSynlighet(val);
    expect(ater.syns).toEqual({});
    expect(ater.visning).toEqual({ gruppen: "ram" });
  });

  it("raderna som syns kommer i radernas ordning, och en rad utan id hoppas över", () => {
    const rader = [{ id: "c" }, { id: "" }, { id: "a", avFranStart: true }, { id: "b" }];
    expect(synligaKalenderRader(rader, TOM_SYNLIGHET).map((r) => r.id)).toEqual(["c", "b"]);
    const med = { ...TOM_SYNLIGHET, syns: { a: true, c: false } };
    expect(synligaKalenderRader(rader, med).map((r) => r.id)).toEqual(["a", "b"]);
    expect(synligaKalenderRader(null, TOM_SYNLIGHET)).toEqual([]);
  });

  it("allt är förvalt tills något ändrats, och en rad som är på fast den borde vara av räknas som ändrad", () => {
    const rader = [SYNS, FRAN_START];
    expect(arForvaldSynlighet(rader, TOM_SYNLIGHET)).toBe(true);
    expect(arForvaldSynlighet(rader, vaxlaKalenderSynlighet(SYNS, TOM_SYNLIGHET))).toBe(false);
    expect(arForvaldSynlighet(rader, vaxlaKalenderSynlighet(FRAN_START, TOM_SYNLIGHET))).toBe(false);
    expect(arForvaldSynlighet(rader, aterstallKalenderSynlighet(vaxlaKalenderSynlighet(SYNS, TOM_SYNLIGHET)))).toBe(true);
    expect(arForvaldSynlighet([], TOM_SYNLIGHET)).toBe(true);
  });
});

describe("synlighetsminnet: läsa och skriva", () => {
  it("rundar: det som skrivs läses tillbaka lika", () => {
    const val = sattKalenderVisning(FRAN_START, "bada", vaxlaKalenderSynlighet(FRAN_START, vaxlaKalenderSynlighet(SYNS, TOM_SYNLIGHET)));
    expect(lasKalenderSynlighet(skrivKalenderSynlighet(val))).toEqual(val);
  });

  it("⛔ ett trasigt minne ger förvalen och aldrig ett kast (golv: 8 trasiga former)", () => {
    const trasiga = [null, undefined, "", "{", "[]", "42", JSON.stringify({ v: 2, syns: { a: false } }), JSON.stringify({ syns: { a: false } }), JSON.stringify({ v: 1, syns: "x", visning: 3 })];
    expect(trasiga.length).toBeGreaterThanOrEqual(8);
    for (const t of trasiga) {
      const val = lasKalenderSynlighet(/** @type {any} */ (t));
      expect(val.syns, String(t)).toEqual({});
      expect(val.visning, String(t)).toEqual({});
      expect(arKalenderSynlig(SYNS, val)).toBe(true);
    }
  });

  it("⛔ ett värde som inte är ett boolean, och en visning utanför de tre, läses som om det inte fanns", () => {
    const val = lasKalenderSynlighet(JSON.stringify({ v: 1, syns: { a: "nej", b: false, c: 0, d: true }, visning: { a: "kant", b: "ram", c: null } }));
    expect(val.syns).toEqual({ b: false, d: true });
    expect(val.visning).toEqual({ b: "ram" });
  });
});
