import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

/*
 * ⛔ .md-tolkningen läses in när den behövs (0.209.1), och en inläsning som faller säger det (granskningen av PR 555).
 * RÖTT UTAN ÄNDRINGEN: före den svarade läsningen `null` både när delen inte gick att hämta och när filen inte gick att läsa, och vyn sade "Filen gick inte att läsa."
 * först vid Spara. Delen som tolkar ersätts här av en modul som inte går att läsa in, som en äldre version efter en uppdatering.
 */

afterEach(() => {
  cleanup();
  vi.doUnmock("../lib/anteckningsfil.js");
  vi.resetModules();
});

it("⛔ går delen som tolkar en .md inte att hämta säger vyn det direkt när filen väljs, och inte att filen är fel", async () => {
  vi.resetModules();
  vi.doMock("../lib/anteckningsfil.js", () => {
    throw new Error("Failed to fetch dynamically imported module");
  });
  const { OpsBibliotek } = await import("../components/OpsBibliotek.jsx");
  const onSpara = vi.fn();
  render(<OpsBibliotek poster={[]} jag={{ uid: "uid-1", roll: "medlem" }} skapar="fil" onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={onSpara} hubHref="/hub" />);
  fireEvent.change(/** @type {HTMLInputElement} */ (document.querySelector('input[type="file"][aria-label="Fil"]')), { target: { files: [new File(["# Plan"], "plan.md")] } });
  expect(await screen.findByText("Delen som läser in .md-filer gick inte att hämta. Ladda om sidan och försök igen.")).toBeTruthy();
  expect(screen.queryByText("Filen gick inte att läsa.")).toBeNull();
  expect(onSpara).not.toHaveBeenCalled();
});
