import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { OpsInspelning } from "../components/OpsTalk.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { OpsField, OpsTextarea } from "../components/OpsField.jsx";
import { TALK_INGET_LJUD, kanSpelaInIgen, webblasarensInspelare } from "../lib/talk.js";

/*
 * TALK:s yta på appens språk (0.104.0). Upptäckt när `OpsTextarea` fick tal: fältets egna ord var engelska i en app på engelska, men
 * inspelningsytans "Klar", "Avbryt" och "Försök igen" stod kvar på svenska. Orden kommer nu ur `ORD_TALK` och `useOpsSprak`.
 */

/** @param {{ sprak?: string } & Record<string, any>} p */
function Yta({ sprak = "en", ...p }) {
  return (
    <OpsSprakProvider sprak={sprak}>
      <OpsInspelning niva={() => 0.5} sekunder={1} tak={120} framsteg={null} kanIgen={false} onKlar={() => {}} onAvbryt={() => {}} onIgen={() => {}} lage="lyssnar" {...p} />
    </OpsSprakProvider>
  );
}

describe("TALK:s yta följer språket", () => {
  it("⛔ medan man pratar: Done och Cancel på engelska, med platstexten", () => {
    render(<Yta medText />);
    const klar = screen.getByRole("button", { name: "Done, save the recording" });
    expect(klar.textContent).toBe("Done");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(document.querySelector("[data-talk-platstext]")?.textContent).toBe("Speak, and the text appears here");
    expect(document.body.textContent).not.toMatch(/Klar|Avbryt|Prata/);
  });

  it("⛔ ett fel: Try again och TALK:s eget fel på engelska, medan tillståndet bär den svenska texten", () => {
    render(<Yta lage="fel" fel="Det inspelade kunde inte sparas." kanIgen />);
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("The recording could not be saved.");
  });

  it("⛔ inget ljud: Record again, och felet känns fortfarande igen på sin svenska text", () => {
    expect(kanSpelaInIgen(TALK_INGET_LJUD)).toBe(true);
    render(<Yta lage="fel" fel={TALK_INGET_LJUD} onTillatMikrofon={() => {}} />);
    expect(screen.getByRole("button", { name: "Record again" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/^The microphone gave no audio/);
  });

  it("⛔ sparat och statusraden medan det sparas står på engelska", () => {
    const { rerender } = render(<Yta lage="skickar" skickarText="Sparar…" />);
    expect(screen.getByRole("status").textContent).toContain("Saving…");
    rerender(<Yta lage="sparat" />);
    expect(screen.getByRole("status").textContent).toBe("Saved");
  });

  it("⛔ appens egen text ritas som den är", () => {
    render(<Yta lage="fel" fel="Servern svarade inte." kanIgen />);
    expect(screen.getByRole("alert").textContent).toBe("Servern svarade inte.");
  });

  it("på svenska är ytan som förut", () => {
    render(<Yta sprak="sv" lage="fel" fel="Det inspelade kunde inte sparas." kanIgen />);
    expect(screen.getByRole("button", { name: "Försök igen" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Avbryt" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("Det inspelade kunde inte sparas.");
  });

  it("⛔ textfältets yta på engelska: hela ytan, inte bara fältets egna ord", async () => {
    const insp = { starta: vi.fn(async () => {}), stoppa: vi.fn(async () => ({ blob: new Blob(["x"]), mimeType: "audio/webm", sekunder: 1 })), kasta: vi.fn(), niva: () => 0.5 };
    function F() {
      const [v, setV] = useState("");
      return (
        <OpsSprakProvider sprak="en">
          <OpsField label="Describe">
            <OpsTextarea value={v} onChange={setV} tal={{ onTranscribe: async () => "x", inspelare: insp }} />
          </OpsField>
        </OpsSprakProvider>
      );
    }
    render(<F />);
    fireEvent.click(screen.getByRole("button", { name: "Dictate" }));
    await waitFor(() => expect(insp.starta).toHaveBeenCalled());
    const yta = /** @type {HTMLElement} */ (document.querySelector("[data-rostyta]"));
    const klar = within(yta).getByRole("button", { name: "Done, insert what you said" });
    expect(klar.textContent).toBe("Done");
    expect(within(yta).getByRole("button", { name: "Cancel" })).toBeTruthy();
  });
});

/*
 * ⛔ INSPELARENS EGNA FEL (granskningen av PR 384, BÖR 3). Två fel som webbläsarens inspelare kastar stod inte i `ORD_TALK` och ritades
 * därför på svenska i en app på engelska. Felen hämtas här ur inspelaren själv, inte ur en avskrift, så att provet följer texten den kastar.
 */
describe("inspelarens fel följer språket", () => {
  it("⛔ en webbläsare utan inspelning, och ett stopp utan inspelning, ritas på engelska", async () => {
    const insp = webblasarensInspelare({});
    const utanStod = await insp.starta().then(() => "", (e) => e.message);
    const utanInspelning = await insp.stoppa().then(() => "", (e) => e.message);
    expect(utanStod).not.toBe("");
    expect(utanInspelning).not.toBe("");
    const { unmount } = render(<Yta lage="fel" fel={utanStod} kanIgen={false} />);
    expect(screen.getByRole("alert").textContent).toBe("This browser cannot record audio.");
    unmount();
    render(<Yta lage="fel" fel={utanInspelning} kanIgen={false} />);
    expect(screen.getByRole("alert").textContent).toBe("No recording is in progress.");
  });
});
