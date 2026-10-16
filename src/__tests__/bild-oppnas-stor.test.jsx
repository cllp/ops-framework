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

describe("bläddra mellan trådens bilder (#369)", () => {
  it("med två bilder visar den stora vyn 1 av 2, och Nästa och piltangenten växlar", async () => {
    const PNG2 = "data:image/png;base64,iVBORw0KGgoB";
    const andra = { id: "a2", text: "Och här", skapad: "2026-10-14T09:05:00.000Z", skapadAv: { uid: "bo", namn: "Bo Lind" }, bilaga: { dataUrl: PNG2, namn: "andra.png", typ: "image/png", tecken: PNG2.length } };
    render(<OpsKommentarer kommentarer={[kommentar, andra]} uid="anna" onSkriv={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Visa större: Bilaga från Bo Lind: skarm.png" }));
    const dialog = await screen.findByRole("dialog", { name: "skarm.png" });
    expect(dialog.querySelector("[data-bilaga-plats]")?.textContent).toBe("1 av 2");
    fireEvent.click(within(dialog).getByRole("button", { name: "Nästa bild" }));
    expect(dialog.querySelector("[data-bilaga-stor]")?.getAttribute("src")).toBe(PNG2);
    // ⛔ MÅSTE 2 (granskningen av PR 398): tangenten trycks där fokus faktiskt står, inte på galleriet.
    fireEvent.keyDown(/** @type {Element} */ (document.activeElement), { key: "ArrowRight" });
    expect(dialog.querySelector("[data-bilaga-stor]")?.getAttribute("src")).toBe(PNG);
    fireEvent.keyDown(/** @type {Element} */ (document.activeElement), { key: "ArrowLeft" });
    expect(dialog.querySelector("[data-bilaga-stor]")?.getAttribute("src")).toBe(PNG2);
  });

  it("⛔ piltangenten fungerar med fokus där dialogen lägger det när den öppnas", async () => {
    const PNG2 = "data:image/png;base64,iVBORw0KGgoB";
    const andra = { id: "a2", text: "", skapad: "2026-10-14T09:05:00.000Z", skapadAv: { uid: "bo", namn: "Bo Lind" }, bilaga: { dataUrl: PNG2, namn: "andra.png", typ: "image/png", tecken: PNG2.length } };
    render(<OpsKommentarer kommentarer={[kommentar, andra]} uid="anna" onSkriv={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Visa större: Bilaga från Bo Lind: skarm.png" }));
    const dialog = await screen.findByRole("dialog", { name: "skarm.png" });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(/** @type {Element} */ (document.activeElement), { key: "ArrowRight" });
    expect(dialog.querySelector("[data-bilaga-plats]")?.textContent).toBe("2 av 2");
  });

  it("⛔ BÖR 2: samma bild två gånger öppnas på sin egen plats", async () => {
    const tre = [
      kommentar,
      { ...kommentar, id: "a2", skapad: "2026-10-14T09:01:00.000Z" },
      { ...kommentar, id: "a3", skapad: "2026-10-14T09:02:00.000Z", bilaga: { ...bild, dataUrl: "data:image/png;base64,iVBORw0KGgoC", namn: "tredje.png" } },
    ];
    render(<OpsKommentarer kommentarer={tre} uid="anna" onSkriv={() => {}} />);
    const knappar = screen.getAllByRole("button", { name: "Visa större: Bilaga från Bo Lind: skarm.png" });
    fireEvent.click(knappar[1]);
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector("[data-bilaga-plats]")?.textContent).toBe("2 av 3");
  });

  it("⛔ med en enda bild finns ingen bläddring", async () => {
    render(<OpsKommentarer kommentarer={[kommentar]} uid="anna" onSkriv={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Visa större: Bilaga från Bo Lind: skarm.png" }));
    const dialog = await screen.findByRole("dialog", { name: "skarm.png" });
    expect(within(dialog).queryByRole("button", { name: "Nästa bild" })).toBeNull();
  });
});
