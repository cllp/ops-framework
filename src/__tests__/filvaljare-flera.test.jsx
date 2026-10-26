import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsFilePicker } from "../components/OpsFilePicker.jsx";

/**
 * OpsFilePicker tar flera filer (0.149.0).
 *
 * ⛔ HÄNDELSEN: appen behöver kvitton, och ett kvitto är ofta flera bilder ur bildbiblioteket. Väljaren tog en fil i taget, så fem sidor
 * var fem omgångar av Välj fil. `flera` är en ny, frivillig prop: `value` är då en lista av Bilaga och `onChange` får en lista.
 *
 * ⛔ UTAN `flera` ÄR BETEENDET EXAKT SOM I DAG. Det första blocket nedan låser det (en fil, ingen dragning, ingen `multiple`) och är grönt
 * både före och efter ändringen, med avsikt. Resten är rött mot koden utan `flera` och grönt med den.
 */

/** @param {string} innehall @param {string} name @param {string} kind */
function fil(innehall, name, kind = "application/pdf") {
  return new File([innehall], name, { type: kind });
}

/** @param {File[]} filer */
function dataTransfer(filer) {
  return { files: filer, types: filer.length ? ["Files"] : ["text/plain"] };
}

/** @param {File[]} filer */
function klistra(filer) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: { files: filer } });
  fireEvent(document, event);
  return event;
}

describe("OpsFilePicker utan flera (låser att ingenting ändrades)", () => {
  it("fältet är enkelt, knappen heter Välj fil, och en vald fil ger Byt fil och en enda Ta bort", () => {
    const { container, rerender } = render(<OpsFilePicker value={null} onChange={() => {}} maxChars={100000} />);
    expect(container.querySelector('input[type="file"]')).not.toHaveAttribute("multiple");
    expect(screen.getByRole("button", { name: "Välj fil" })).toBeInTheDocument();

    rerender(
      <OpsFilePicker value={{ dataUrl: "data:application/pdf;base64,x", namn: "a.pdf", typ: "application/pdf", tecken: 1400 }} onChange={() => {}} maxChars={100000} />,
    );
    expect(screen.getByRole("button", { name: "Byt fil" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Ta bort" })).toHaveLength(1);
  });

  it("tar bara den första av flera valda filer och ger en Bilaga, inte en lista", async () => {
    const onChange = vi.fn();
    render(<OpsFilePicker value={null} onChange={onChange} maxChars={100000} />);
    fireEvent.change(screen.getByLabelText("Bifoga fil"), { target: { files: [fil("a", "a.pdf"), fil("b", "b.pdf")] } });

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(Array.isArray(onChange.mock.calls[0][0])).toBe(false);
    expect(onChange.mock.calls[0][0].namn).toBe("a.pdf");
  });

  it("tar bara den första av flera inklistrade filer", async () => {
    const onChange = vi.fn();
    render(<OpsFilePicker value={null} onChange={onChange} maxChars={100000} />);
    klistra([fil("a", "a.pdf"), fil("b", "b.pdf")]);

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange.mock.calls[0][0].namn).toBe("a.pdf");
  });

  it("tar inte emot en fil som släpps på väljaren", async () => {
    const onChange = vi.fn();
    const { container } = render(<OpsFilePicker value={null} onChange={onChange} maxChars={100000} />);
    const event = fireEvent.drop(container.firstElementChild, { dataTransfer: dataTransfer([fil("a", "a.pdf")]) });

    await new Promise((r) => setTimeout(r, 30));
    expect(onChange).not.toHaveBeenCalled();
    // fireEvent ger false när någon kallat preventDefault. Utan flera tar väljaren inte över släppet.
    expect(event).toBe(true);
  });

  it("ett fel för en enskild fil nollställer värdet med onChange(null), som förut", async () => {
    const onChange = vi.fn();
    render(<OpsFilePicker value={null} onChange={onChange} maxChars={40} />);
    fireEvent.change(screen.getByLabelText("Bifoga fil"), { target: { files: [fil("x".repeat(5000), "stor.pdf")] } });

    expect((await screen.findByRole("alert")).textContent).toMatch(/för stor/);
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe("OpsFilePicker med flera", () => {
  it("filfältet tar flera filer och knappen heter Välj filer", () => {
    const { container } = render(<OpsFilePicker flera value={[]} onChange={() => {}} maxChars={100000} />);
    expect(container.querySelector('input[type="file"]')).toHaveAttribute("multiple");
    expect(screen.getByRole("button", { name: "Välj filer" })).toBeInTheDocument();
  });

  it("flera valda filer ger EN lista, i den ordning de valdes", async () => {
    const onChange = vi.fn();
    render(<OpsFilePicker flera value={[]} onChange={onChange} maxChars={100000} />);
    fireEvent.change(screen.getByLabelText("Bifoga filer"), {
      target: { files: [fil("1", "ett.pdf"), fil("2", "tva.pdf"), fil("3", "tre.pdf")] },
    });

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    const lista = onChange.mock.calls[0][0];
    expect(Array.isArray(lista)).toBe(true);
    expect(lista.map((/** @type {any} */ b) => b.namn)).toEqual(["ett.pdf", "tva.pdf", "tre.pdf"]);
    expect(lista[0].dataUrl.startsWith("data:application/pdf")).toBe(true);
  });

  it("nya filer läggs till de som redan finns och ersätter dem inte", async () => {
    const onChange = vi.fn();
    const redan = { dataUrl: "data:application/pdf;base64,eA==", namn: "redan.pdf", typ: "application/pdf", tecken: 30 };
    render(<OpsFilePicker flera value={[redan]} onChange={onChange} maxChars={100000} />);
    expect(screen.getByRole("button", { name: "Lägg till fler" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Bifoga filer"), { target: { files: [fil("1", "ny1.pdf"), fil("2", "ny2.pdf")] } });

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange.mock.calls[0][0].map((/** @type {any} */ b) => b.namn)).toEqual(["redan.pdf", "ny1.pdf", "ny2.pdf"]);
  });

  it("en fil över taket avvisas med besked och namn, och de andra tappas inte", async () => {
    const onChange = vi.fn();
    // 200 tecken ryms för en liten fil men inte för en på 5000 byte.
    render(<OpsFilePicker flera value={[]} onChange={onChange} maxChars={200} />);
    fireEvent.change(screen.getByLabelText("Bifoga filer"), {
      target: { files: [fil("a", "liten1.pdf"), fil("x".repeat(5000), "stor.pdf"), fil("b", "liten2.pdf")] },
    });

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange.mock.calls[0][0].map((/** @type {any} */ b) => b.namn)).toEqual(["liten1.pdf", "liten2.pdf"]);
    const larm = await screen.findByRole("alert");
    expect(larm.textContent).toMatch(/stor\.pdf/);
    expect(larm.textContent).toMatch(/för stor/);
    // Besked för den som avvisades, inget för de som togs.
    expect(larm.textContent).not.toMatch(/liten/);
  });

  it("en fil av fel typ avvisas för sig, hur den än kom in", async () => {
    const onChange = vi.fn();
    render(<OpsFilePicker flera value={[]} onChange={onChange} maxChars={100000} typer={["application/pdf"]} />);
    fireEvent.change(screen.getByLabelText("Bifoga filer"), {
      target: { files: [fil("a", "ok.pdf"), fil("b", "fel.csv", "text/csv"), fil("c", "ok2.pdf")] },
    });

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange.mock.calls[0][0].map((/** @type {any} */ b) => b.namn)).toEqual(["ok.pdf", "ok2.pdf"]);
    expect((await screen.findByRole("alert")).textContent).toMatch(/fel\.csv: Filtypen "text\/csv"/);
  });

  it("två avvisade filer får var sitt besked, och när ALLA avvisas ändras ingenting alls (inte ens onChange(null))", async () => {
    const onChange = vi.fn();
    const redan = { dataUrl: "data:application/pdf;base64,eA==", namn: "redan.pdf", typ: "application/pdf", tecken: 30 };
    render(<OpsFilePicker flera value={[redan]} onChange={onChange} maxChars={200} />);
    fireEvent.change(screen.getByLabelText("Bifoga filer"), {
      target: { files: [fil("x".repeat(5000), "stor1.pdf"), fil("y".repeat(5000), "stor2.pdf")] },
    });

    const larm = await screen.findByRole("alert");
    await waitFor(() => expect(larm.textContent).toMatch(/stor2\.pdf/));
    expect(larm.textContent).toMatch(/stor1\.pdf/);
    expect(onChange).not.toHaveBeenCalled();
    // Den som redan var vald står kvar.
    expect(screen.getByText("redan.pdf")).toBeInTheDocument();
  });

  it("ett nytt val med lyckade filer tar bort det gamla beskedet", async () => {
    const onChange = vi.fn();
    render(<OpsFilePicker flera value={[]} onChange={onChange} maxChars={200} />);
    const falt = screen.getByLabelText("Bifoga filer");
    fireEvent.change(falt, { target: { files: [fil("x".repeat(5000), "stor.pdf")] } });
    await screen.findByRole("alert");

    fireEvent.change(falt, { target: { files: [fil("a", "ok.pdf")] } });
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("inklistrade filer läggs till, alla och inte bara den första, och text lämnas i fred", async () => {
    const onChange = vi.fn();
    render(<OpsFilePicker flera value={[]} onChange={onChange} maxChars={100000} />);

    const text = klistra([]);
    expect(text.defaultPrevented).toBe(false);
    expect(onChange).not.toHaveBeenCalled();

    const filer = klistra([fil("a", "a.pdf"), fil("b", "b.pdf")]);
    expect(filer.defaultPrevented).toBe(true);
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange.mock.calls[0][0].map((/** @type {any} */ b) => b.namn)).toEqual(["a.pdf", "b.pdf"]);
  });

  it("paste={false} stänger av inklistringen också med flera", async () => {
    const onChange = vi.fn();
    render(<OpsFilePicker flera value={[]} onChange={onChange} maxChars={100000} paste={false} />);
    klistra([fil("a", "a.pdf")]);
    await new Promise((r) => setTimeout(r, 30));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("filer som dras hit läggs till, och bara släpp som bär filer tas", async () => {
    const onChange = vi.fn();
    const { container } = render(<OpsFilePicker flera value={[]} onChange={onChange} maxChars={100000} />);
    const yta = /** @type {HTMLElement} */ (container.querySelector("[data-filvaljare-flera]"));

    // Ett dragöver som bär filer måste avbrytas, annars släpper webbläsaren aldrig filen på ytan.
    expect(fireEvent.dragOver(yta, { dataTransfer: dataTransfer([fil("a", "a.pdf")]) })).toBe(false);
    // Text som dras över ytan är inte vår.
    expect(fireEvent.dragOver(yta, { dataTransfer: dataTransfer([]) })).toBe(true);
    // Ett släpp utan filer är inte heller vårt.
    expect(fireEvent.drop(yta, { dataTransfer: dataTransfer([]) })).toBe(true);
    expect(onChange).not.toHaveBeenCalled();

    expect(fireEvent.drop(yta, { dataTransfer: dataTransfer([fil("a", "a.pdf"), fil("b", "b.pdf")]) })).toBe(false);
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange.mock.calls[0][0].map((/** @type {any} */ b) => b.namn)).toEqual(["a.pdf", "b.pdf"]);
  });

  it("varje vald fil har sin egen Ta bort, med filens namn, och de andra står kvar", async () => {
    const onChange = vi.fn();
    const b = (/** @type {string} */ namn) => ({ dataUrl: `data:application/pdf;base64,eA==`, namn, typ: "application/pdf", tecken: 30 });
    render(<OpsFilePicker flera value={[b("a.pdf"), b("b.pdf"), b("c.pdf")]} onChange={onChange} maxChars={100000} />);

    expect(screen.getAllByRole("button", { name: /^Ta bort/ })).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Ta bort b.pdf" }));
    expect(onChange).toHaveBeenCalledWith([b("a.pdf"), b("c.pdf")]);
  });

  it("en bild visas som miniatyr och en fil med sitt namn, var och en i listan", () => {
    render(
      <OpsFilePicker
        flera
        value={[
          { dataUrl: "data:image/jpeg;base64,x", namn: "kvitto.jpg", typ: "image/jpeg", tecken: 1400, bredd: 800, hojd: 600 },
          { dataUrl: "data:application/pdf;base64,x", namn: "utdrag.pdf", typ: "application/pdf", tecken: 1400 },
        ]}
        onChange={() => {}}
        maxChars={100000}
      />,
    );
    const lista = screen.getByRole("list");
    expect(within(lista).getAllByRole("listitem")).toHaveLength(2);
    expect(within(lista).getByRole("img", { name: "Vald bilaga: kvitto.jpg" })).toBeInTheDocument();
    expect(within(lista).getByText("utdrag.pdf")).toBeInTheDocument();
  });

  it("två tillägg i följd tappar ingen av dem, även när appen svarar först efteråt", async () => {
    /** @type {{ lista: any[] }} */
    const sista = { lista: [] };
    function Yta() {
      const [lista, setLista] = useState(/** @type {any[]} */ ([]));
      sista.lista = lista;
      return <OpsFilePicker flera value={lista} onChange={setLista} maxChars={100000} />;
    }
    render(<Yta />);

    klistra([fil("a", "forsta.pdf")]);
    klistra([fil("b", "andra.pdf")]);

    await waitFor(() => expect(sista.lista.map((b) => b.namn).sort()).toEqual(["andra.pdf", "forsta.pdf"]));
  });

  it("value måste vara en lista eller null, och en enstaka Bilaga vägras med besked", () => {
    const enBilaga = { dataUrl: "data:application/pdf;base64,x", namn: "a.pdf", typ: "application/pdf", tecken: 30 };
    const fel = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsFilePicker flera value={/** @type {any} */ (enBilaga)} onChange={() => {}} maxChars={100000} />)).toThrow(/lista/);
    fel.mockRestore();
    // null och utelämnad är en tom lista.
    expect(() => render(<OpsFilePicker flera value={null} onChange={() => {}} maxChars={100000} />)).not.toThrow();
    expect(() => render(<OpsFilePicker flera onChange={() => {}} maxChars={100000} />)).not.toThrow();
  });

  it("kastar utan tak också med flera", () => {
    const fel = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsFilePicker flera value={[]} onChange={() => {}} maxChars={0} />)).toThrow(/maxChars/);
    fel.mockRestore();
  });

  it("med gemknappen (knappPlats) tar fältet också flera, och varje fil har sin Ta bort", async () => {
    const plats = document.createElement("div");
    document.body.appendChild(plats);
    const redan = { dataUrl: "data:application/pdf;base64,eA==", namn: "redan.pdf", typ: "application/pdf", tecken: 30 };
    /** @type {{ lista: any[] }} */
    const sista = { lista: [redan] };
    function Yta() {
      const [lista, setLista] = useState(/** @type {any[]} */ ([redan]));
      sista.lista = lista;
      return <OpsFilePicker flera value={lista} onChange={setLista} maxChars={100000} knappPlats={plats} ariaLabel="Bifoga kvitton" />;
    }
    const { container } = render(<Yta />);

    expect(within(plats).getByRole("button", { name: "Bifoga kvitton" })).toBeInTheDocument();
    const falt = /** @type {HTMLInputElement} */ (container.querySelector('input[type="file"]'));
    expect(falt).toHaveAttribute("multiple");
    fireEvent.change(falt, { target: { files: [fil("1", "ny1.pdf"), fil("2", "ny2.pdf")] } });

    await waitFor(() => expect(sista.lista.map((x) => x.namn)).toEqual(["redan.pdf", "ny1.pdf", "ny2.pdf"]));
    fireEvent.click(screen.getByRole("button", { name: "Ta bort redan.pdf" }));
    expect(sista.lista.map((x) => x.namn)).toEqual(["ny1.pdf", "ny2.pdf"]);
    plats.remove();
  });
});
