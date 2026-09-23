import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OpsFilePicker } from "../components/OpsFilePicker.jsx";
import { OpsIconLink } from "../components/OpsIconLink.jsx";
import { isImage, attachmentSize, sizeText } from "../lib/file.js";

/**
 * ⛔ jsdom HAR INGEN `createImageBitmap`, och det är inte ett hinder utan själva
 * poängen med de här proven.
 *
 * En webbläsare som inte kan avkoda ett bildformat är precis det verkliga fallet
 * (HEIC i Chrome på en dator), och komponenten ska då bifoga filen som fil i
 * stället för att säga nej. jsdom härmar alltså det fallet gratis. Det proven
 * INTE kan se är nedskalningen, eftersom ingen duk ritar något här, och det står
 * skrivet i stället för att låtsas mätas.
 */

/** @param {string} innehall @param {string} name @param {string} kind */
function file(innehall, name, kind) {
  return new File([innehall], name, { type: kind });
}

describe("OpsFilePicker", () => {
  it("bifogar en fil som inte är en bild, i stället för att kräva en skärmbild av den", async () => {
    // ⛔ Det här är hela skälet till att komponenten inte heter OpsImagePicker.
    // Rapporten var ordagrant: "det kan vara ett kontoutdrag, pdf, excel, eller
    // bild".
    const onChange = vi.fn();
    render(<OpsFilePicker value={null} onChange={onChange} maxChars={100000} />);

    fireEvent.change(screen.getByLabelText("Bifoga fil"), {
      target: { files: [file("kontoutdrag", "utdrag.pdf", "application/pdf")] },
    });

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const attachment = onChange.mock.calls[0][0];
    expect(attachment.namn).toBe("utdrag.pdf");
    expect(attachment.typ).toBe("application/pdf");
    expect(attachment.dataUrl.startsWith("data:application/pdf")).toBe(true);
  });

  it("tar emot en inklistrad skärmbild utan att man först klickat i ett fält", async () => {
    // ⛔ Man klistrar in där blicken är, inte där fokus råkar ligga. En
    // inklistring som bara fungerar efter ett klick i rätt ruta läses som att
    // funktionen inte finns.
    const onChange = vi.fn();
    render(<OpsFilePicker value={null} onChange={onChange} maxChars={100000} />);

    const handelse = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(handelse, "clipboardData", { value: { files: [file("png", "", "image/png")] } });
    fireEvent(document, handelse);

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    // Urklippsbilder saknar filnamn. Ett tomt namn i en lista ser ut som en
    // trasig post, så den får säga vad den är.
    expect(onChange.mock.calls[0][0].namn).toBe("Urklipp");
  });

  it("lämnar en inklistring som bara bär text i fred", () => {
    // ⛔ Samma händelse bär text när man klistrar in i ett skrivfält. En
    // filväljare som svalde den hade stulit inklistringen från fältet man
    // faktiskt skrev i.
    const onChange = vi.fn();
    render(<OpsFilePicker value={null} onChange={onChange} maxChars={100000} />);

    const handelse = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(handelse, "clipboardData", { value: { files: [] } });
    fireEvent(document, handelse);

    expect(onChange).not.toHaveBeenCalled();
    expect(handelse.defaultPrevented).toBe(false);
  });

  it("slutar lyssna på inklistring när paste är av", () => {
    // ⛔ Två monterade väljare tar annars emot samma inklistring, och det går
    // inte att lösa inifrån komponenten. Därför måste avstängningen bita.
    const onChange = vi.fn();
    render(<OpsFilePicker value={null} onChange={onChange} maxChars={100000} paste={false} />);

    const handelse = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(handelse, "clipboardData", { value: { files: [file("png", "bild.png", "image/png")] } });
    fireEvent(document, handelse);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("säger vad man ska göra åt en för stor fil, inte bara att den är för stor", async () => {
    // ⛔ "Kunde inte spara" lämnar den som försöker med ett val mellan att ge upp
    // och att försöka igen i blindo. Det är så folk slutar rapportera saker.
    const onChange = vi.fn();
    render(<OpsFilePicker value={null} onChange={onChange} maxChars={40} />);

    fireEvent.change(screen.getByLabelText("Bifoga fil"), {
      target: { files: [file("x".repeat(5000), "stor.pdf", "application/pdf")] },
    });

    const larm = await screen.findByRole("alert");
    expect(larm.textContent).toMatch(/för stor/);
    expect(larm.textContent).toMatch(/Dela upp den|skärmbild/);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("nämner bildformatet i felet när det var en bild webbläsaren inte kunde läsa", async () => {
    // ⛔ Utan den meningen ser en HEIC ut som "din bild är för stor", och rådet
    // blir att beskära den, vilket inte hjälper: problemet är formatet.
    render(<OpsFilePicker value={null} onChange={() => {}} maxChars={40} />);

    fireEvent.change(screen.getByLabelText("Bifoga fil"), {
      target: { files: [file("x".repeat(5000), "bild.heic", "image/heic")] },
    });

    const larm = await screen.findByRole("alert");
    expect(larm.textContent).toMatch(/JPEG eller PNG/);
  });

  it("visar en vald bild men bara namnet på en fil", () => {
    // ⛔ Ingen `<iframe>` med PDF:en. Den renderas olika i varje webbläsare och en
    // ruta som ibland är tom ser ut som att filen inte kom fram.
    const { rerender } = render(
      <OpsFilePicker
        value={{ dataUrl: "data:image/jpeg;base64,x", namn: "kvitto.jpg", typ: "image/jpeg", tecken: 1400, bredd: 800, hojd: 600 }}
        onChange={() => {}}
        maxChars={100000}
      />,
    );
    expect(screen.getByRole("img", { namn: /kvitto\.jpg/ })).toBeInTheDocument();

    rerender(
      <OpsFilePicker
        value={{ dataUrl: "data:application/pdf;base64,x", namn: "utdrag.pdf", typ: "application/pdf", tecken: 1400 }}
        onChange={() => {}}
        maxChars={100000}
      />,
    );
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("utdrag.pdf")).toBeInTheDocument();
  });

  it("kastar utan tak i stället för att skriva något lagringen avvisar", () => {
    // ⛔ Ett avslag från databasen når användaren som "kunde inte spara", alltså
    // långt från den enda plats där felet gick att förhindra.
    expect(() => render(<OpsFilePicker value={null} onChange={() => {}} maxChars={0} />)).toThrow(/maxChars/);
  });
});

describe("fil-hjälparna", () => {
  it("svarar på bildfrågan utifrån typen, så samma fråga funkar före och efter lagring", () => {
    expect(isImage("image/png")).toBe(true);
    expect(isImage("application/pdf")).toBe(false);
    // ⛔ Tom typ är "vet inte", och "vet inte" är inte "ja". En okänd fil som
    // renderas som `<img>` blir en trasig bildikon.
    expect(isImage("")).toBe(false);
    expect(isImage(undefined)).toBe(false);
  });

  it("skriver storleken i den enhet talet faktiskt hör hemma i", () => {
    expect(sizeText(512)).toBe("512 B");
    expect(sizeText(2048)).toBe("2 kB");
    expect(sizeText(3 * 1024 * 1024)).toBe("3,0 MB");
    // Noll är inte en storlek utan en avsaknad av mätning.
    expect(sizeText(0)).toBe("");
  });

  it("räknar tillbaka från lagrade tecken till en ungefärlig filstorlek", () => {
    // ⛔ Finns för att base64-faktorn inte ska stå som en magisk 1,4 i varje app
    // som visar en bilaga. En bilaga lagrar `chars` och inte byte, eftersom det
    // är tecknen som räknas mot dokumentgränsen.
    expect(attachmentSize(2867)).toBe("2 kB");
    // ⛔ Ungefärlig, inte exakt: 1,4 är en avrundning uppåt av 4/3 plus prefixet.
    // Skillnaden syns inte i "2 kB", vilket är den precision frågan har.
    expect(attachmentSize(1400)).toBe("1000 B");
  });
});

describe("OpsIconLink", () => {
  it("är en länk med ett namn, inte en ikon med en adress", () => {
    // ⛔ Utan namn läses adressen upp, alltså "/inkorg", och det är inte ett namn
    // på något.
    render(<OpsIconLink href="/inkorg" icon={<span />} label="Inkorg" />);
    expect(screen.getByRole("link", { namn: "Inkorg" })).toHaveAttribute("href", "/inkorg");
  });

  it("kastar hellre än att rendera en ikon utan namn", () => {
    expect(() => render(<OpsIconLink href="/inkorg" icon={<span />} label="" />)).toThrow(/label krävs/);
  });

  it("räknar bara när det finns något att räkna", () => {
    // ⛔ En nolla i en cirkel är en notis om att det inte finns någon notis.
    const { rerender } = render(<OpsIconLink href="/inkorg" icon={<span />} label="Inkorg" badge={0} badgeText="nya" />);
    expect(screen.queryByText("nya", { exact: false })).toBeNull();

    rerender(<OpsIconLink href="/inkorg" icon={<span />} label="Inkorg" badge={3} badgeText="nya" />);
    expect(screen.getByText("3 nya")).toBeInTheDocument();
  });

  it("håller antalet utanför länkens namn", () => {
    // ⛔ Vore talet också i namnet skulle "Inkorg, 3 nya, 3 nya" läsas upp.
    render(<OpsIconLink href="/inkorg" icon={<span />} label="Inkorg" badge={3} badgeText="nya" />);
    expect(screen.getByRole("link", { namn: "Inkorg" })).toBeInTheDocument();
  });

  it("kapar räknaren vid 9+ men säger det riktiga antalet i uppläsningen", () => {
    // ⛔ En tvåsiffrig räknare spränger cirkeln. Siffran svarar på "finns det
    // något", men den som lyssnar ska få veta hur mycket.
    render(<OpsIconLink href="/inkorg" icon={<span />} label="Inkorg" badge={42} badgeText="nya" />);
    expect(screen.getByText("9+")).toBeInTheDocument();
    expect(screen.getByText("42 nya")).toBeInTheDocument();
  });

  it("låter appens router ta över klicket i stället för en sidladdning", () => {
    const onNavigate = vi.fn();
    render(<OpsIconLink href="/inkorg" icon={<span />} label="Inkorg" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("link", { namn: "Inkorg" }));
    expect(onNavigate).toHaveBeenCalledWith("/inkorg", expect.anything());
  });
});
