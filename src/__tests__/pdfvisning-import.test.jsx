import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsPdfVy } from "../components/OpsPdfVy.jsx";

/*
 * Importen av pdf.js faller (0.193.0, cllp/ops-framework#530): nätet föll, eller en ny version lades ut och den gamla biten finns inte längre. Vyn ska säga det med Försök igen, aldrig stå kvar på "Hämtar dokumentet."
 * och aldrig ta med sig sidan (regel 5). Egen fil, eftersom atrappen av `pdfjs-dist` gäller hela filen.
 *
 * ⛔ RÖTT UTAN ÄNDRINGEN: utan grenen för `import` i `OpsPdfVisning` står hämtningstexten kvar och provet hittar ingen felrad.
 */
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => {
  throw new Error("Failed to fetch dynamically imported module");
});

describe("⛔ pdf.js går inte att hämta", () => {
  it("en rad med Försök igen, och hämtningen av filen hindrar inte raden", async () => {
    const hamta = vi.fn(async () => new Blob(["%PDF"], { type: "application/pdf" }));
    render(<OpsPdfVy hamta={hamta} sokvag="s" namn="kvartal.pdf" />);
    const fel = await screen.findByRole("alert");
    expect(fel.textContent).toBe("Visningen för PDF gick inte att hämta. Kontrollera nätet och försök igen.");
    expect(screen.queryByText("Hämtar dokumentet.")).toBeNull();
    expect(screen.getByRole("button", { name: "Helskärm" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Försök igen" }));
    // Ett nytt försök hämtar på nytt: ett minne av felet hade gjort knappen död.
    expect((await screen.findByRole("alert")).textContent).toContain("Visningen för PDF");
    expect(hamta).toHaveBeenCalledTimes(2);
  });
});
