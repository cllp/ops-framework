import { describe, expect, it } from "vitest";
import { BIBLIOTEKFALT, BIBLIOTEKTYPER, byggPost, filtreraBibliotek, inmatningsfel, postFel } from "../lib/bibliotek.js";
import { SKAPARFALT, byggSkapare } from "../lib/skapare.js";

/**
 * Bibliotekets form (analys 0004, #192, skiva 1).
 *
 * Proven mäter vad som avvisas. En byggare som bara provas med giltig data
 * är grön genom felet den finns för att fånga.
 */

const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const tid = 1_700_000_000_000;

const anteckning = {
  groupId: "cps-ab",
  typ: "anteckning",
  rubrik: "Protokoll",
  text: "Vi beslutade.",
  skapadAv: skapare,
  skapad: tid,
  andrad: tid,
};

describe("bibliotekets post", () => {
  it("bygger en anteckning utan adress och en länk utan text", () => {
    const a = byggPost(anteckning);
    expect(a.typ).toBe("anteckning");
    expect(a.text).toBe("Vi beslutade.");
    expect(Object.hasOwn(a, "url")).toBe(false);
    const l = byggPost({ ...anteckning, typ: "lank", text: undefined, url: "https://bolagsverket.se" });
    expect(l.url).toBe("https://bolagsverket.se/");
    expect(Object.hasOwn(l, "text")).toBe(false);
    expect(BIBLIOTEKTYPER).toEqual(["anteckning", "lank"]);
    expect(BIBLIOTEKFALT).toContain("groupId");
  });

  it("avvisar javascript-adress, låt och ett fält som inte hör hit", () => {
    expect(inmatningsfel({ typ: "lank", rubrik: "X", url: "javascript:alert(1)" })).toMatch(/http eller https/);
    expect(postFel({ ...anteckning, typ: "song", text: "a" })).toMatch(/song/);
    expect(postFel({ ...anteckning, artist: "Någon" })).toMatch(/artist/);
    expect(() => byggPost({ ...anteckning, url: "https://exempel.se" })).toThrow(/ingen adress/);
  });

  it("skaparens fältlista är byggarens nycklar", () => {
    expect(Object.keys(byggSkapare(skapare)).sort()).toEqual([...SKAPARFALT].sort());
  });

  it("filtrerar på typ och sök, och noll träffar är en tom lista", () => {
    const poster = [
      { ...byggPost(anteckning), id: "a" },
      { ...byggPost({ ...anteckning, typ: "lank", text: undefined, url: "https://bolagsverket.se", rubrik: "Verket", andrad: tid + 1 }), id: "b" },
    ];
    expect(filtreraBibliotek(poster, { flik: "lank" }).map((p) => p.id)).toEqual(["b"]);
    expect(filtreraBibliotek(poster, { sok: "beslutade" }).map((p) => p.id)).toEqual(["a"]);
    expect(filtreraBibliotek(poster, { sok: "finns inte" })).toEqual([]);
  });
});
