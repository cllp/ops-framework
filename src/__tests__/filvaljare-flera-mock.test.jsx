import { useState } from "react";
import { flushSync } from "react-dom";
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
    // Utan kön börjar b läsas medan a läses; utan väntan på appens commit börjar b läsas innan appen ritat a.
    expect(logg.filter((x) => ["läs:a.pdf", "ritar:a", "läs:b.pdf", "ritar:a,b"].includes(x))).toEqual(["läs:a.pdf", "ritar:a", "läs:b.pdf", "ritar:a,b"]);
  });
});

describe("OpsFilePicker flera: appens omritning kommer efter en timer", () => {
  /**
   * ⛔ DET HÄR PROVET ÄR DETERMINISTISKT, OBEROENDE AV MASKINENS LAST (#475). Provet ovan fångar samma fel bara om omritningen råkar komma efter
   * ett `setTimeout(0)`, och det avgörs av lasten: det var grönt lokalt och rött i CI på samma commit. Här kommer appens omritning medvetet
   * EFTER en egen timer som är längre än varje andetag väljaren kan ta (60 ms mot 0 ms), så en väljare som väntar på en timer läser alltid
   * en gammal lista. Appen ritar om synkront i sin timer (`flushSync`) så att provet inte i sin tur hänger på Reacts schemaläggare.
   */
  it("andra omgången läser appens lista EFTER den förra, och båda filerna finns i listan till slut", async () => {
    logg.length = 0;
    /** @type {string[][]} */
    const anrop = [];
    /** @type {any[]} */
    let senaste = [];
    function Yta() {
      const [lista, setLista] = useState(/** @type {any[]} */ ([]));
      senaste = lista;
      return (
        <OpsFilePicker
          flera
          value={lista}
          onChange={(ny) => {
            anrop.push(ny.map((/** @type {any} */ b) => b.namn));
            setTimeout(() => flushSync(() => setLista(ny)), 60);
          }}
          maxChars={100000}
        />
      );
    }
    render(<Yta />);

    klistra([new File(["a"], "a.pdf", { type: "application/pdf" })]);
    klistra([new File(["b"], "b.pdf", { type: "application/pdf" })]);

    await waitFor(() => expect(senaste.map((b) => b.namn)).toEqual(["a.pdf", "b.pdf"]), { timeout: 3000 });
    // Den andra omgången byggde på appens lista med a i, inte på den tomma som gällde när b började läsas.
    expect(anrop).toEqual([["a.pdf"], ["a.pdf", "b.pdf"]]);
  });

  it("en app som vägrar ändringen stoppar inte kön: nästa omgång läses ändå, ur det appen har", async () => {
    /** @type {string[][]} */
    const anrop = [];
    function Yta() {
      const [lista, setLista] = useState(/** @type {any[]} */ ([]));
      return (
        <OpsFilePicker
          flera
          value={lista}
          onChange={(ny) => {
            anrop.push(ny.map((/** @type {any} */ b) => b.namn));
            // Vägrar den första filen, tar den andra.
            if (ny.some((/** @type {any} */ b) => b.namn === "ja.pdf")) setLista(ny);
          }}
          maxChars={100000}
        />
      );
    }
    render(<Yta />);

    klistra([new File(["a"], "nej.pdf", { type: "application/pdf" })]);
    klistra([new File(["b"], "ja.pdf", { type: "application/pdf" })]);

    await waitFor(() => expect(anrop).toHaveLength(2), { timeout: 3000 });
    expect(anrop).toEqual([["nej.pdf"], ["ja.pdf"]]);
    await waitFor(() => expect(screen.getByText("ja.pdf")).toBeInTheDocument());
    expect(screen.queryByText("nej.pdf")).toBeNull();
  });
});
