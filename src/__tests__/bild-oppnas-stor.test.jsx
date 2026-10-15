import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsKommentarer } from "../components/OpsKommentarer.jsx";
import { BilagaVisning } from "../components/BilagaVisning.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";

/*
 * Bild i kommentarer (0.106.0, #386 skiva 9). Mätt före bygget: kommentarerna hade redan en knapp (Bifoga bild eller fil),
 * inklistring och förhandsvisning före sändning (0.73.0), och bilden krymps och ligger i kommentarens eget dokument. Det som
 * saknades var att bilden öppnas stor: miniatyren var en nedladdningslänk, och ett tryck sparade filen. Samma vy i chatten.
 */

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const bild = { dataUrl: PNG, namn: "skarm.png", typ: "image/png", tecken: PNG.length };
const kommentar = { id: "a1", text: "Så här ser det ut", skapad: "2026-10-14T09:00:00.000Z", skapadAv: { uid: "bo", namn: "Bo Lind" }, bilaga: bild };

describe("en bild öppnas stor vid tryck", () => {
  it("⛔ i en kommentar är miniatyren en knapp, inte en nedladdning, och den öppnar bilden i full storlek", async () => {
    render(<OpsKommentarer kommentarer={[kommentar]} uid="anna" onSkriv={() => {}} />);
    const knapp = screen.getByRole("button", { name: "Visa större: Bilaga från Bo Lind: skarm.png" });
    expect(knapp.tagName).toBe("BUTTON");
    expect(knapp.hasAttribute("download")).toBe(false);
    expect(knapp.getAttribute("data-kommentar-bilaga-visad")).toBe("bild");
    expect(within(knapp).getByRole("img", { name: "Bilaga från Bo Lind: skarm.png" })).toBeInTheDocument();
    fireEvent.click(knapp);
    const dialog = await screen.findByRole("dialog", { name: "skarm.png" });
    const stor = /** @type {HTMLImageElement} */ (dialog.querySelector("[data-bilaga-stor]"));
    expect(stor.getAttribute("src")).toBe(PNG);
    // Nedladdningen finns kvar, i dialogens fot.
    const ned = within(dialog).getByRole("link", { name: "Ladda ned" });
    expect(ned).toHaveAttribute("download", "skarm.png");
    // Stäng lämnar fokus på miniatyren.
    fireEvent.click(within(dialog).getByRole("button", { name: "Stäng" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(knapp));
  });

  it("⛔ samma vy i chatten och på engelska", async () => {
    render(
      <OpsSprakProvider sprak="en">
        <BilagaVisning bilaga={bild} alt="Attachment from Bo Lind: skarm.png" marke="data-meddelande-bilaga" />
      </OpsSprakProvider>,
    );
    const knapp = screen.getByRole("button", { name: "View larger: Attachment from Bo Lind: skarm.png" });
    expect(knapp.getAttribute("data-meddelande-bilaga")).toBe("bild");
    fireEvent.click(knapp);
    const dialog = await screen.findByRole("dialog", { name: "skarm.png" });
    expect(within(dialog).getByRole("link", { name: "Download" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("⛔ en fil som inte är en bild laddas fortfarande ned, utan dialog", () => {
    const pdf = "data:application/pdf;base64,JVBERi0=";
    render(<BilagaVisning bilaga={{ dataUrl: pdf, namn: "utdrag.pdf", typ: "application/pdf", tecken: pdf.length }} alt="pdf" />);
    expect(screen.getByRole("link", { name: /utdrag\.pdf/ })).toHaveAttribute("download", "utdrag.pdf");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
