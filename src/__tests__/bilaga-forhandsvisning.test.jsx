import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { BilagaVisning } from "../components/BilagaVisning.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";

/*
 * ⛔ EN PDF OCH EN TEXTFIL I EN BILAGA ÖPPNAS I EN DIALOG (0.178.0, cllp/lifehub.app#524).
 *
 * Händelsen: en textfil bifogad i chatten visades som 56 B mot Bibliotekets 40 B, och ett klick på den laddade ned den i stället för att visa den. Storleken lagades i 0.168.0. Omtestet var DELVIS: klicket gav fortfarande
 * en `data:`-länk med `download`. Orsaken var `BilagaVisning`, som gjorde allt utom bild och ljud till `<a href={dataUrl} download>`.
 *
 * Det som mäts är det som såg fel ut för användaren: ingen `a[download]` förrän dialogen är öppen, innehållet syns i dialogen, och nedladdningen finns kvar i dialogens fot.
 * jsdom har ingen `URL.createObjectURL`, så PDF-provet ger den en attrapp och mäter att ramen får en `src` och att adressen städas bort.
 */

const b64 = (/** @type {string} */ t) => btoa(unescape(encodeURIComponent(t)));
const fil = (/** @type {string} */ typ, /** @type {string} */ namn, /** @type {string} */ text) => {
  const dataUrl = `data:${typ};base64,${b64(text)}`;
  return { dataUrl, namn, typ, tecken: dataUrl.length };
};

describe("textfil och CSV", () => {
  it("⛔ ingen a[download] förrän dialogen är öppen, sedan texten i en <pre> och Ladda ned i foten", async () => {
    render(<BilagaVisning bilaga={fil("text/plain", "qa-biblioteksfil.txt", "Hej på dig\nRad två")} alt="Bilaga: qa-biblioteksfil.txt" marke="data-meddelande-bilaga" />);
    const knapp = screen.getByRole("button", { name: "Visa: qa-biblioteksfil.txt" });
    expect(knapp.hasAttribute("download")).toBe(false);
    expect(knapp.getAttribute("data-meddelande-bilaga")).toBe("fil");
    expect(document.querySelector("a[download]")).toBeNull();
    fireEvent.click(knapp);
    const dialog = await screen.findByRole("dialog", { name: "qa-biblioteksfil.txt" });
    const pre = await waitFor(() => {
      const el = dialog.querySelector("pre[data-bibliotek-text='klar']");
      if (!el) throw new Error("texten är inte ritad än");
      return /** @type {HTMLElement} */ (el);
    });
    expect(pre.textContent).toBe("Hej på dig\nRad två");
    const ned = within(dialog).getByRole("link", { name: "Ladda ned" });
    expect(ned).toHaveAttribute("download", "qa-biblioteksfil.txt");
    fireEvent.click(within(dialog).getByRole("button", { name: "Stäng" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(knapp));
    expect(document.querySelector("a[download]")).toBeNull();
  });

  it("CSV visas som text på samma sätt, och på engelska står orden på engelska", async () => {
    render(
      <OpsSprakProvider sprak="en">
        <BilagaVisning bilaga={fil("text/csv", "tal.csv", "a;b\n1;2")} alt="Attachment: tal.csv" />
      </OpsSprakProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "View: tal.csv" }));
    const dialog = await screen.findByRole("dialog", { name: "tal.csv" });
    await waitFor(() => expect(dialog.querySelector("pre")?.textContent).toBe("a;b\n1;2"));
    expect(within(dialog).getByRole("link", { name: "Download" })).toBeInTheDocument();
  });

  it("⛔ en tom textfil säger att den är tom, i stället för en tom ruta", async () => {
    // En tom bilaga kan inte göras till en Blob (`bilagaTillBlob` kastar med skälet), och dialogen skriver ut felet.
    render(<BilagaVisning bilaga={fil("text/plain", "tom.txt", "")} alt="Bilaga: tom.txt" />);
    fireEvent.click(screen.getByRole("button", { name: "Visa: tom.txt" }));
    const dialog = await screen.findByRole("dialog", { name: "tom.txt" });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/Bilagan är tom/);
  });
});

describe("PDF", () => {
  const skapade = /** @type {string[]} */ ([]);
  const stadade = /** @type {string[]} */ ([]);
  const original = { skapa: URL.createObjectURL, stada: URL.revokeObjectURL };
  beforeEach(() => {
    skapade.length = 0;
    stadade.length = 0;
    URL.createObjectURL = vi.fn(() => {
      const u = `blob:prov/${skapade.length + 1}`;
      skapade.push(u);
      return u;
    });
    URL.revokeObjectURL = vi.fn((u) => void stadade.push(u));
  });
  afterEach(() => {
    URL.createObjectURL = original.skapa;
    URL.revokeObjectURL = original.stada;
  });

  it("⛔ ingen a[download] förrän dialogen är öppen, sedan en ram med blob-adress, och adressen städas när dialogen stängs", async () => {
    render(<BilagaVisning bilaga={fil("application/pdf", "utdrag.pdf", "%PDF-1.4 prov")} alt="Bilaga: utdrag.pdf" />);
    expect(document.querySelector("a[download]")).toBeNull();
    expect(document.querySelector("iframe")).toBeNull();
    expect(skapade).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Visa: utdrag.pdf" }));
    const dialog = await screen.findByRole("dialog", { name: "utdrag.pdf" });
    const ram = await waitFor(() => {
      const el = dialog.querySelector("iframe[data-bilaga-pdf]");
      if (!el) throw new Error("ramen är inte ritad än");
      return /** @type {HTMLIFrameElement} */ (el);
    });
    expect(ram.getAttribute("src")).toBe(skapade[0]);
    expect(ram.getAttribute("title")).toBe("utdrag.pdf");
    expect(within(dialog).getByRole("link", { name: "Ladda ned" })).toHaveAttribute("download", "utdrag.pdf");
    expect(stadade).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole("button", { name: "Stäng" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(stadade).toEqual(skapade);
  });

  it("⛔ kan blobben inte göras står det i en rad och ingen tom ram ritas, med nedladdningen kvar", async () => {
    URL.createObjectURL = vi.fn(() => {
      throw new Error("ingen blob här");
    });
    render(<BilagaVisning bilaga={fil("application/pdf", "utdrag.pdf", "%PDF-1.4 prov")} alt="Bilaga: utdrag.pdf" />);
    fireEvent.click(screen.getByRole("button", { name: "Visa: utdrag.pdf" }));
    const dialog = await screen.findByRole("dialog", { name: "utdrag.pdf" });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("PDF:en gick inte att visa här. Ladda ned den i stället.");
    expect(dialog.querySelector("iframe")).toBeNull();
    expect(within(dialog).getByRole("link", { name: "Ladda ned" })).toBeInTheDocument();
  });
});
