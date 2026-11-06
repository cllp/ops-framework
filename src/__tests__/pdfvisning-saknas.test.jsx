import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsPdfVy } from "../components/OpsPdfVy.jsx";

/*
 * Appen har inte installerat `pdfjs-dist` (0.193.0, cllp/ops-framework#530). Paketet är ett valfritt peer-beroende, så att det inte följer med in i en Cloud Functions-installation där ingen PDF ritas.
 * Saknas det ersätter Vite importen med en tom modul i appens bygge (mätt: `__vite-optional-peer-dep:pdfjs-dist/...`, `export default {}`). Vyn ska då säga att visningen inte är installerad, synligt
 * och inte som ett nätfel. Atrappen här är samma tomma modul.
 *
 * ⛔ RÖTT UTAN ÄNDRINGEN: utan kontrollen i `laddaPdfjs` blir det ett TypeError och raden säger "Kontrollera nätet".
 */
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({ default: {} }));

describe("⛔ pdfjs-dist saknas i appen", () => {
  it("raden säger att visningen inte är installerad", async () => {
    render(<OpsPdfVy hamta={async () => new Blob(["%PDF"], { type: "application/pdf" })} sokvag="s" namn="kvartal.pdf" />);
    expect((await screen.findByRole("alert")).textContent).toBe("Visningen för PDF är inte installerad i den här appen.");
    expect(screen.getByRole("button", { name: "Helskärm" }).hasAttribute("disabled")).toBe(true);
  });
});
