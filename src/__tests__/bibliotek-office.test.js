import { describe, expect, it } from "vitest";
import { FILMIME, byggPost, filContentTypeMonster, filInmatningsfel, filMimeMonster, mimeUrFilnamn } from "../lib/bibliotek.js";
import { lagringsregelfragment } from "../lib/regler.js";

/**
 * Officedokument i Biblioteket (0.180.0). CP 2026-11-03, med en skärmbild av felet
 * "Formatet application/vnd.openxmlformats-officedocument.wordprocessingml.document går inte att lägga in": "VI behöver kunna ha officedokument i LIfe Hub."
 *
 * Word, Excel och PowerPoint i sina nuvarande format tas emot. De äldre formaten och makroformaten tas inte emot (de kan bära makron).
 * Det som mäts är det personen såg: att samma val nu ger en post i stället för felet, och att lagringsregeln släpper in samma typ (en klient
 * som säger ja och en regel som säger nej hade gett ett fel först vid uppladdningen).
 */

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const KIM = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const tid = 1_700_000_000_000;

const fil = (/** @type {string} */ mime, /** @type {string} */ namn) =>
  byggPost({ groupId: "cps-ab", typ: "fil", rubrik: namn, fil: { sokvag: `grupper/cps-ab/bibliotek/p1/${namn}`, namn, mime, byte: 2048, klar: true }, skapadAv: KIM, skapad: tid, andrad: tid });

describe("officedokument", () => {
  it("⛔ Word, Excel och PowerPoint blir en filpost, och felet från skärmbilden kommer inte", () => {
    for (const [mime, namn] of [[DOCX, "Avtal.docx"], [XLSX, "Budget.xlsx"], [PPTX, "Presentation.pptx"]]) {
      expect(FILMIME, mime).toContain(mime);
      expect(filInmatningsfel({ namn, mime, byte: 2048 }), mime).toBeNull();
      expect(fil(mime, namn).fil.mime, mime).toBe(mime);
    }
  });

  it("⛔ båda reglerna släpper in samma tre typer, ur samma lista", () => {
    for (const mime of [DOCX, XLSX, PPTX]) {
      expect(new RegExp(filMimeMonster()).test(mime), mime).toBe(true);
      expect(new RegExp(filContentTypeMonster()).test(mime), mime).toBe(true);
    }
    // Lagringsregeln som appen skriver in bär mönstret ordagrant.
    expect(lagringsregelfragment({ bibliotek: { gruppPrefix: "grupper", postPrefix: "bibliotek", samling: "bibliotek" } })).toContain(DOCX);
  });

  it("⛔ de äldre formaten och makroformaten tas inte emot", () => {
    for (const mime of [
      "application/msword",
      "application/vnd.ms-excel",
      "application/vnd.ms-powerpoint",
      "application/vnd.ms-word.document.macroEnabled.12",
      "application/vnd.ms-excel.sheet.macroEnabled.12",
      "application/vnd.ms-powerpoint.presentation.macroEnabled.12",
    ]) {
      expect(FILMIME, mime).not.toContain(mime);
      expect(new RegExp(filMimeMonster()).test(mime), mime).toBe(false);
    }
  });

  it(".docx, .xlsx och .pptx ger sina typer när webbläsaren inte säger någon, och .doc och .docm ger ingen", () => {
    expect(mimeUrFilnamn("Avtal.DOCX")).toBe(DOCX);
    expect(mimeUrFilnamn("Budget.xlsx")).toBe(XLSX);
    expect(mimeUrFilnamn("Bilder.pptx")).toBe(PPTX);
    expect(mimeUrFilnamn("gammal.doc")).toBe("");
    expect(mimeUrFilnamn("makro.docm")).toBe("");
  });
});
