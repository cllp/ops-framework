import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { GRUPPIKONKATALOG } from "../lib/gruppikonkatalog.generated.js";
import { VANLIGA_GRUPPIKONER, forslagUrGruppnamn, sokGruppikoner } from "../lib/gruppikonsok.js";
import { ARV_GRUPPIKON, gruppikonKomponent } from "../lib/gruppikoner.js";
import { GRUPPIKONER } from "../lib/grupp.js";
import { GRUPPIKON_SVENSKA, gruppikonEtikett } from "../lib/gruppikonnamn.js";
import { BlixtIkon, BokIkon, ByggnadIkon, GruppIkon, HjartaIkon, HusIkon, JordglobIkon, KronaIkon, PortfoljIkon, StjarnaIkon } from "../components/icons.jsx";

/**
 * Gruppikonernas sökning och katalog (0.65.0, #265).
 *
 * ⛔ Varje prov här har setts falla (regel 4). Mutationerna står i PR:en för #265.
 */

describe("⛔ katalogen: ett set, namn och golv", () => {
  it("golv: minst 150 ikoner, unika namn, inget namn är ett tal", () => {
    expect(GRUPPIKONKATALOG.length).toBeGreaterThanOrEqual(150);
    const namn = GRUPPIKONKATALOG.map((i) => i.namn);
    expect(new Set(namn).size).toBe(namn.length);
    for (const n of namn) expect(n, n).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it("varje ikon har sökord ur Lucide, och varje namn går att rita", () => {
    const utanTaggar = GRUPPIKONKATALOG.filter((i) => i.taggar.length === 0).map((i) => i.namn);
    expect(utanTaggar.length).toBeLessThan(GRUPPIKONKATALOG.length / 10);
    for (const { namn } of GRUPPIKONKATALOG) expect(gruppikonKomponent(namn), namn).toBeTypeOf("function");
  });

  it("tjugo vanliga, alla i katalogen", () => {
    expect(VANLIGA_GRUPPIKONER).toHaveLength(20);
    const finns = new Set(GRUPPIKONKATALOG.map((i) => i.namn));
    for (const n of VANLIGA_GRUPPIKONER) expect(finns.has(n), n).toBe(true);
  });
});

describe("⛔ sökningen går på sökorden, inte på filnamnet", () => {
  it("music ger not, hörlurar, högtalare, gitarr och skiva", () => {
    const t = sokGruppikoner("Music");
    for (const n of ["music", "headphones", "speaker", "guitar", "disc"]) expect(t, n).toContain(n);
    expect(t[0]).toBe("music");
  });

  it("svenska: musik ger samma ikoner, fotboll ger idrottsikoner", () => {
    const t = sokGruppikoner("musik");
    for (const n of ["music", "headphones", "guitar"]) expect(t, n).toContain(n);
    expect(sokGruppikoner("fotboll")).toEqual(expect.arrayContaining(["volleyball"]));
  });

  it("flera ord måste alla träffa, och ingen träff ger en tom lista", () => {
    expect(sokGruppikoner("xyzzy")).toEqual([]);
    expect(sokGruppikoner("")).toEqual([]);
    const tva = sokGruppikoner("music note");
    expect(tva.length).toBeGreaterThan(0);
    expect(tva.length).toBeLessThan(sokGruppikoner("music").length);
  });

  it("⛔ ordningen i katalogen påverkar inte svaret (namnet är nyckeln, inte platsen)", () => {
    const blandad = [...GRUPPIKONKATALOG].reverse();
    expect(sokGruppikoner("music", blandad)).toEqual(sokGruppikoner("music"));
    expect(forslagUrGruppnamn("Bandet", blandad)).toEqual(forslagUrGruppnamn("Bandet"));
  });
});

describe("⛔ förfiltrering ur gruppens namn", () => {
  it("Bandet ger musikikonerna först", () => {
    const f = forslagUrGruppnamn("Bandet");
    expect(f.slice(0, 6)).toEqual(expect.arrayContaining(["guitar", "drum"]));
    expect(f.slice(0, 12)).toContain("music");
  });

  it("Familjen ger familjeikoner, ett namn utan kända ord ger inga förslag", () => {
    expect(forslagUrGruppnamn("Familjen Staiger").slice(0, 8)).toEqual(expect.arrayContaining(["users"]));
    expect(forslagUrGruppnamn("AB")).toEqual([]);
    expect(forslagUrGruppnamn("")).toEqual([]);
  });
});

describe("⛔ de äldre id:na ritas oförändrade", () => {
  const FORE = { grupp: GruppIkon, portfolj: PortfoljIkon, byggnad: ByggnadIkon, hus: HusIkon, bok: BokIkon, jordglob: JordglobIkon, stjarna: StjarnaIkon, hjarta: HjartaIkon, blixt: BlixtIkon, krona: KronaIkon };
  it.each(GRUPPIKONER)("%s ritar samma SVG som före 0.65.0", (id) => {
    const ny = gruppikonKomponent(id);
    expect(ny).toBeTypeOf("function");
    const svg = (/** @type {any} */ K) => renderToStaticMarkup(createElement(K, { size: 20 })).replace(/ class="[^"]*"/, "");
    expect(svg(ny)).toBe(svg(FORE[id]));
    expect(ARV_GRUPPIKON[id]).toBeTypeOf("string");
  });
});

describe("⛔ svenska namn (granskningen av PR 266)", () => {
  it("varje ikon i katalogen har ett svenskt namn, och inga två har samma", () => {
    const namn = GRUPPIKONKATALOG.map((i) => gruppikonEtikett(i.namn, "sv"));
    for (const [i, n] of namn.entries()) expect(GRUPPIKON_SVENSKA[GRUPPIKONKATALOG[i].namn], GRUPPIKONKATALOG[i].namn).toBe(n);
    expect(new Set(namn).size).toBe(namn.length);
    expect(Object.keys(GRUPPIKON_SVENSKA).sort()).toEqual(GRUPPIKONKATALOG.map((i) => i.namn).sort());
  });

  it("engelska ger Lucides namn med mellanslag", () => {
    expect(gruppikonEtikett("book-open", "en")).toBe("book open");
  });
});

describe("⛔ svenska ord som gav noll träffar före granskningen", () => {
  it.each([
    ["hörlur", "headphones"],
    ["hörlurar", "headphones"],
    ["högtalare", "speaker"],
    ["not", "music"],
    ["noter", "music"],
    ["skiva", "disc"],
  ])("%s ger %s först", (ord, forst) => {
    expect(sokGruppikoner(ord)[0]).toBe(forst);
  });
});

describe("⛔ vanliga gruppsorter på svenska ger träffar", () => {
  it.each([
    ["fotboll", "volleyball"],
    ["kontor", "building-2"],
    ["familj", "users"],
    ["skola", "school"],
    ["resa", "luggage"],
    ["mat", "utensils"],
    ["bok", "book"],
    ["kör", "music"],
    ["band", "guitar"],
    ["styrelse", "handshake"],
  ])("%s ger bland annat %s", (ord, ikon) => {
    expect(sokGruppikoner(ord).slice(0, 8)).toContain(ikon);
  });

  it("⛔ styrelse ger ingen tärning: board som i brädspel var fel synonym", () => {
    expect(sokGruppikoner("styrelse")).not.toContain("dice-5");
  });

  it("⛔ kontor ger ingen hantel: en synonym matchar hela ord i taggarna, inte prefix (work blev workout)", () => {
    expect(sokGruppikoner("kontor")).not.toContain("dumbbell");
    expect(sokGruppikoner("kontor").length).toBeGreaterThan(0);
  });
});
