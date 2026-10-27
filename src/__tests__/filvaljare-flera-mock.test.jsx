import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OpsFilePicker } from "../components/OpsFilePicker.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";

/**
 * Prov som behöver en utbytt `readAttachment` (0.149.0): språket i inklistringens lyssnare, och i vilken ordning två omgångar läses.
 *
 * Inklistringens lyssnare i flera-läget håller inga gamla ord.
 *
 * ⛔ Lyssnaren sitter på dokumentet och registrerades förut om bara när `paste`, `maxChars` eller `typer` ändrades. Språket, som felets reservtext
 * läser, hängde inte med: en person som bytte språk fick felet på det gamla. Provet behöver en läsning som kastar något som inte är ett Error
 * (då är det reservtexten som visas), och det går bara att få genom att byta ut `readAttachment`.
 */
const { logg } = vi.hoisted(() => ({ logg: /** @type {string[]} */ ([]) }));
vi.mock("../lib/file.js", async (importOriginal) => {
  const riktig = /** @type {any} */ (await importOriginal());
  return {
    ...riktig,
    readAttachment: async (/** @type {File} */ fil, /** @type {any} */ granser) => {
      logg.push(`läs:${fil.name}`);
      if (fil.name === "kasta.pdf") throw "inget Error";
      // Läsningen tar en stund, som en riktig fil gör.
      await new Promise((klar) => setTimeout(klar, 5));
      return riktig.readAttachment(fil, granser);
    },
  };
});

/** @param {File[]} filer */
function klistra(filer) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: { files: filer } });
  fireEvent(document, event);
}

describe("OpsFilePicker flera: språket i inklistringens lyssnare", () => {
  it("felets reservtext följer språket även efter ett byte, med samma monterade väljare", async () => {
    const kasta = () => new File(["x"], "kasta.pdf", { type: "application/pdf" });
    const yta = (/** @type {string} */ sprak) => (
      <OpsSprakProvider sprak={sprak}>
        <OpsFilePicker flera value={[]} onChange={() => {}} maxChars={100000} />
      </OpsSprakProvider>
    );
    const { rerender } = render(yta("sv"));

    klistra([kasta()]);
    expect((await screen.findByRole("alert")).textContent).toBe("kasta.pdf: Filen kunde inte läsas.");

    rerender(yta("en"));
    klistra([kasta()]);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("kasta.pdf: The file could not be read."));
  });
});

describe("OpsFilePicker flera: två omgångar i följd", () => {
  it("nästa omgång börjar läsas först när appen har ritat den förra, så att den bygger på appens lista", async () => {
    logg.length = 0;
    function Yta() {
      const [lista, setLista] = useState(/** @type {any[]} */ ([]));
      logg.push(`ritar:${lista.map((b) => b.namn.replace(".pdf", "")).join(",")}`);
      return <OpsFilePicker flera value={lista} onChange={setLista} maxChars={100000} />;
    }
    render(<Yta />);

    klistra([new File(["a"], "a.pdf", { type: "application/pdf" })]);
    klistra([new File(["b"], "b.pdf", { type: "application/pdf" })]);

    await waitFor(() => expect(logg).toContain("ritar:a,b"));
    // Utan kön börjar b läsas medan a läses; utan andetaget börjar b läsas innan appen ritat a.
    expect(logg.filter((x) => ["läs:a.pdf", "ritar:a", "läs:b.pdf", "ritar:a,b"].includes(x))).toEqual(["läs:a.pdf", "ritar:a", "läs:b.pdf", "ritar:a,b"]);
  });
});
