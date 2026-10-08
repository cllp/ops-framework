import { describe, expect, it } from "vitest";
import { ADRESSFORM, BIBLIOTEKFALT, BIBLIOTEKTYPER, MAX_BIBLIOTEKUTSKRIFT, byggPost, farAndra, filtreraBibliotek, ideRubrik, inmatningsfel, normaliseraAdress, postFel, trimSomRegeln } from "../lib/bibliotek.js";
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
    expect(BIBLIOTEKTYPER).toEqual(["anteckning", "lank", "fil"]);
    expect(BIBLIOTEKFALT).toContain("groupId");
  });

  it("en idé heter Idé plus datum och tid", () => {
    expect(ideRubrik(new Date(2026, 9, 8, 21, 5))).toBe("Idé 2026-10-08 21:05");
  });

  it("en fil med bild, dokument eller ljud går att bygga, och fel format eller för stor fil gör det inte", () => {
    const bas = { ...anteckning, typ: "fil", text: undefined, rubrik: "Kvitto" };
    const fil = { sokvag: "grupper/cps-ab/bibliotek/p1/kvitto.jpg", namn: "kvitto.jpg", mime: "image/jpeg", byte: 1200 };
    expect(inmatningsfel({ typ: "fil", rubrik: "Kvitto", fil })).toBeNull();
    const byggd = byggPost({ ...bas, fil });
    expect(byggd.fil.mime).toBe("image/jpeg");
    expect(Object.hasOwn(byggd, "text")).toBe(false);
    expect(byggPost({ ...bas, fil: { ...fil, mime: "audio/webm;codecs=opus", namn: "ide.webm", sokvag: "grupper/cps-ab/bibliotek/p1/ide.webm" } }).fil.mime).toBe("audio/webm");
    expect(postFel({ ...bas, fil: { ...fil, mime: "application/zip" } })).toMatch(/application\/zip/);
    expect(postFel({ ...bas, fil: { ...fil, byte: 25 * 1024 * 1024 + 1 } })).toMatch(/Taket/);
    expect(postFel({ ...anteckning, fil })).toMatch(/ingen fil/);
  });

  it("en utskrift hör bara till ett ljud, och en tom utskrift är ett svar", () => {
    const bas = { ...anteckning, typ: "fil", text: undefined, rubrik: "Idé" };
    const ljud = { sokvag: "grupper/cps-ab/bibliotek/p1/ide.webm", namn: "ide.webm", mime: "audio/webm", byte: 100 };
    const bild = { sokvag: "grupper/cps-ab/bibliotek/p1/k.jpg", namn: "k.jpg", mime: "image/jpeg", byte: 100 };
    expect(postFel({ ...bas, fil: ljud, utskrift: "Hej" })).toBeNull();
    expect(byggPost({ ...bas, fil: ljud, utskrift: "" }).utskrift).toBe("");
    expect(Object.hasOwn(byggPost({ ...bas, fil: ljud }), "utskrift")).toBe(false);
    expect(postFel({ ...bas, fil: ljud, utskrift: "x".repeat(MAX_BIBLIOTEKUTSKRIFT + 1) })).toMatch(/Taket/);
    expect(postFel({ ...bas, fil: bild, utskrift: "Hej" })).toMatch(/Bara ett ljud/);
    expect(postFel({ ...anteckning, utskrift: "Hej" })).toMatch(/ingen utskrift/);
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

  it("mellanslag är tomt, och adressen prövas mot ADRESSFORM som regeln", () => {
    expect(postFel({ ...anteckning, rubrik: "   " })).toMatch(/Rubriken saknas/);
    expect(postFel({ ...anteckning, text: " \n\t " })).toMatch(/saknar text/);
    const lank = { ...anteckning, typ: "lank", text: undefined };
    expect(postFel({ ...lank, url: "http://exa mple" })).toMatch(/går inte att läsa/);
    expect(postFel({ ...lank, url: "https://" })).toMatch(/går inte att läsa/);
    expect(postFel({ ...lank, url: "https://bolagsverket.se/" })).toBeNull();
    expect(ADRESSFORM.test("http://exa mple")).toBe(false);
    expect(ADRESSFORM.test("javascript:alert(1)")).toBe(false);
    expect(normaliseraAdress(" https://sv.wikipedia.org/wiki/Åre ")).toBe("https://sv.wikipedia.org/wiki/%C3%85re");
    expect(ADRESSFORM.test(normaliseraAdress("https://sv.wikipedia.org/wiki/Åre"))).toBe(true);
  });

  it("tomhet räknas som Firestores trim: bara U+0000 till U+0020 (granskningen av #304)", () => {
    // Regeln släpper in de här, och emulatorn bekräftar det i rules/__tests__/bibliotek.test.mjs.
    // Med JavaScripts trim sade modellen "Rubriken saknas." och raden hamnade i trasiga för alltid.
    for (const rubrik of ["\u00A0", "\u3000", "\u2028", "\uFEFF"]) {
      expect(postFel({ ...anteckning, rubrik })).toBeNull();
      expect(inmatningsfel({ typ: "anteckning", rubrik, text: "T" })).toBeNull();
      expect(byggPost({ ...anteckning, rubrik }).rubrik).toBe(rubrik);
    }
    for (const text of ["\u00A0", "\u3000"]) {
      expect(postFel({ ...anteckning, text })).toBeNull();
      expect(byggPost({ ...anteckning, text }).text).toBe(text);
    }
    // Och tvärtom: U+001F trimmas av regeln men inte av JavaScript.
    expect(postFel({ ...anteckning, rubrik: "\u001F" })).toMatch(/Rubriken saknas/);
    expect(postFel({ ...anteckning, text: "\u0000\u001F " })).toMatch(/saknar text/);
    expect(byggPost({ ...anteckning, rubrik: "\u001F \u00A0Protokoll\u00A0\t" }).rubrik).toBe("\u00A0Protokoll\u00A0");
    expect(trimSomRegeln(42)).toBe("");
  });

  it("klockslagen är heltal, och andrad ligger inte före skapad", () => {
    expect(postFel({ ...anteckning, skapad: 1.5 })).toMatch(/heltal/);
    expect(postFel({ ...anteckning, andrad: tid - 1 })).toMatch(/före skapad/);
  });

  it("farAndra är regelns update: författaren eller ägare och admin", () => {
    const post = { ...byggPost(anteckning), id: "a" };
    expect(farAndra(post, { uid: "uid-1", roll: "medlem" })).toBe(true);
    expect(farAndra(post, { uid: "uid-2", roll: "medlem" })).toBe(false);
    expect(farAndra(post, { uid: "uid-2", roll: "admin" })).toBe(true);
    expect(farAndra(post, { uid: "uid-2", roll: "agare" })).toBe(true);
    expect(farAndra(post, { uid: "uid-2", roll: "admin", groupId: "miranda-ab" })).toBe(false);
    expect(farAndra(post, null)).toBe(false);
  });
});
