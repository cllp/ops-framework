import { describe, expect, it } from "vitest";

import { DIREKTSAMTAL, SAMTALSSLAG, byggDirektsamtal, delaDirektnyckel, delaSamtalsnyckel, direktnyckel, samtalsnyckel } from "../lib/samtal.js";
import { samtalsregelfragment } from "../lib/regler.js";

/*
 * Direktsamtalet (cllp/lifehub.app#946 skiva 1): två personer i samma hubb utan gemensam grupp. Regelproven mot emulatorn står i rules/__tests__/direktsamtal.test.mjs.
 */

describe("direktsamtalets nyckel och form", () => {
  it("nyckeln är ~direkt och de två sorterade, och samma par ger samma nyckel åt båda håll", () => {
    expect(direktnyckel(["bo", "anna"])).toBe(`${DIREKTSAMTAL}|anna|bo`);
    expect(direktnyckel(["anna", "bo"])).toBe(direktnyckel(["bo", "anna"]));
    expect(() => direktnyckel(["a", "a"])).toThrow();
    expect(() => direktnyckel(["a"])).toThrow();
  });

  it("⛔ ett direktsamtal är inget femte slag: ett Samtal har alltid en grupp", () => {
    expect(SAMTALSSLAG).not.toContain("direkt");
    expect(() => samtalsnyckel(/** @type {any} */ ({ groupId: "g1", slag: "direkt", deltagare: ["a", "b"] }))).toThrow(/finns inte/);
  });

  it("⛔ en grupp som börjar med ~ kan inte bära ett samtal: nyckeln hade haft ett direktsamtals form", () => {
    expect(() => samtalsnyckel({ groupId: "~direkt", slag: "personer", deltagare: ["a", "b"] })).toThrow(/reserverat/);
    expect(() => samtalsnyckel({ groupId: "~x", slag: "grupp" })).toThrow(/reserverat/);
    expect(samtalsnyckel({ groupId: "g~1", slag: "grupp" })).toBe("g~1|grupp");
  });

  it("byggDirektsamtal bygger ett samtal utan grupp, med skaparen bland de två", () => {
    const s = byggDirektsamtal({ deltagare: ["bo", "anna"], skapadAv: "anna", skapad: 5 });
    expect(s).toEqual({ id: `${DIREKTSAMTAL}|anna|bo`, slag: "direkt", deltagare: ["anna", "bo"], skapad: 5, skapadAv: "anna" });
    expect("groupId" in s).toBe(false);
    expect(() => byggDirektsamtal({ deltagare: ["bo", "anna"], skapadAv: "cecilia", skapad: 5 })).toThrow(/en av deltagarna/);
    expect(() => byggDirektsamtal(/** @type {any} */ ({ groupId: "g1", deltagare: ["bo", "anna"], skapadAv: "anna" }))).toThrow(/groupId hör inte/);
  });

  it("⛔ nyckeln läses baklänges som ett direktsamtal utan grupp, aldrig som ett personsamtal i gruppen ~direkt", () => {
    expect(delaDirektnyckel(`${DIREKTSAMTAL}|anna|bo`)).toEqual({ slag: "direkt", deltagare: ["anna", "bo"] });
    expect(delaSamtalsnyckel(`${DIREKTSAMTAL}|anna|bo`), "en grupps läsare får ingen grupp ur ett direktsamtal").toBeNull();
    expect(delaDirektnyckel("g1|anna|bo")).toBeNull();
    expect(delaDirektnyckel(`${DIREKTSAMTAL}|bo|anna`)).toBeNull();
    expect(delaDirektnyckel(`${DIREKTSAMTAL}|anna|bo|a_x`)).toBeNull();
    expect(delaSamtalsnyckel("~annat|anna|bo")).toBeNull();
    expect(delaSamtalsnyckel("g1|anna|bo")).toEqual({ groupId: "g1", deltagare: ["anna", "bo"] });
  });
});

describe("regelfragmentet med direkt: true", () => {
  const VAL = { tradar: "tradar", status: "status", reaktioner: "reaktioner", omrostningsval: "omrostningsval", omrostningsroster: "omrostningsroster", omnamnanden: true, citat: true, fasta: "fasta", bilagor: true, bilagaSamling: "bilagor", tyst: "tyst", amnen: true, projekt: true };

  it("utan nyckeln finns inget om direktsamtal i texten", () => {
    const utan = samtalsregelfragment(VAL);
    expect(utan).not.toMatch(/direkt|opsSomPersonISamtalet/);
  });

  it("⛔ med nyckeln läser direktsamtalets deltagare ur nyckeln, och ingen regel slår upp gruppen för ett direktsamtal", () => {
    const med = samtalsregelfragment({ ...VAL, direkt: true });
    expect(med).toContain("function opsArDirektsid(sid)");
    expect(med).toContain("(s.slag == 'direkt' && request.auth.uid in s.deltagare) ||");
    expect(med).toContain("&& !d.groupId.matches('~.*')");
    // Varje ställe som krävde "aktiv person i samtalets grupp" går genom hjälpfunktionen, och uppslaget finns kvar bara i den.
    expect((med.match(/opsArAktivTyp\(request\.auth\.uid, get\(opsSamtalet\(sid\)\)\.data\.groupId, 'person'\)/g) ?? []).length).toBe(1);
    expect((med.match(/opsSomPersonISamtalet\(sid\)/g) ?? []).length).toBeGreaterThanOrEqual(9);
  });

  it("direkt är true eller utelämnat", () => {
    expect(() => samtalsregelfragment({ direkt: /** @type {any} */ ("ja") })).toThrow(/direkt är true/);
  });
});
