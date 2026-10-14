import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla } from "../data/samtalskalla.js";

/**
 * ⛔ CHATTENS RÖST-ORD FÖLJER SPRÅKET (0.104.0, granskningen av PR 384, MÅSTE 1). När TALK:s yta fick engelska ord blev det synliga
 * ordet på Klar "Done" i en engelsk chatt, men namnet som läses upp var chattens svenska "Klar, skicka det du sagt". Det synliga
 * ordet och namnet ska stämma på båda språken, och chattens egna röst-ord (mikrofonens namn, statusraderna, felen) ska vara på
 * chattens språk. Språket kommer antingen ur `sprak`-propen eller ur appens `OpsSprakProvider`; båda vägarna mäts.
 */

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "ops", namn: "Ops-agenten", typ: "agent", status: "aktiv" },
];

function provinspelare() {
  const blob = new Blob(["ljud"], { type: "audio/webm" });
  return {
    starta: vi.fn(async () => {}),
    stoppa: vi.fn(async () => ({ blob, mimeType: "audio/webm", sekunder: 2 })),
    kasta: vi.fn(),
    niva: () => 0.5,
  };
}

async function underlag() {
  const kalla = createMemorySource({});
  const s = /** @type {any} */ (createSamtalskalla({ kalla }));
  const a = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "ops", slag: "agent" });
  await s.skicka(a.id, { text: "Hej", av: "anna" });
  return { s, a };
}

const yta = () => /** @type {HTMLElement} */ (document.querySelector("[data-rostyta]"));

/** @param {"prop" | "leverantor"} vag @param {(blob: Blob) => Promise<string>} onTranscribe */
async function chattPaEngelska(vag, onTranscribe) {
  const { s, a } = await underlag();
  const chatt = <OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={a.id} onTranscribe={onTranscribe} inspelare={provinspelare()} {...(vag === "prop" ? { sprak: "en" } : {})} />;
  render(vag === "prop" ? chatt : <OpsSprakProvider sprak="en">{chatt}</OpsSprakProvider>);
  await within(await screen.findByRole("log")).findByText("Hej");
}

describe("chattens röst-ord på chattens språk", () => {
  for (const vag of /** @type {const} */ (["prop", "leverantor"])) {
    it(`⛔ på engelska (${vag === "prop" ? "sprak-propen" : "OpsSprakProvider"}) heter Klar "Done, send what you said" och visar "Done"`, async () => {
      await chattPaEngelska(vag, async () => "remind me on Friday");
      fireEvent.click(screen.getByRole("button", { name: "Dictate" }));
      const klar = await within(yta()).findByRole("button", { name: "Done, send what you said" });
      expect(klar.textContent).toBe("Done");
      expect(within(yta()).getByRole("button", { name: "Cancel" })).toBeTruthy();
    });

    it(`⛔ på engelska (${vag === "prop" ? "sprak-propen" : "OpsSprakProvider"}) säger chatten på engelska att utskriften föll`, async () => {
      await chattPaEngelska(vag, async () => {
        throw new Error("");
      });
      fireEvent.click(screen.getByRole("button", { name: "Dictate" }));
      fireEvent.click(await within(yta()).findByRole("button", { name: "Done, send what you said" }));
      await waitFor(() => expect(within(yta()).getByRole("alert").textContent).toBe("The recording could not be transcribed."));
    });
  }

  it("⛔ på svenska är allt som förut: Klar visar Klar och heter Klar, skicka det du sagt", async () => {
    const { s, a } = await underlag();
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={a.id} onTranscribe={async () => "x"} inspelare={provinspelare()} />);
    await within(await screen.findByRole("log")).findByText("Hej");
    fireEvent.click(screen.getByRole("button", { name: "Prata in" }));
    const klar = await within(yta()).findByRole("button", { name: "Klar, skicka det du sagt" });
    expect(klar.textContent).toBe("Klar");
  });

  it("⛔ appens egen text vinner över förvalet på båda språken", async () => {
    const { s, a } = await underlag();
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={a.id} sprak="en" texter={{ talKlar: "Done, post it" }} onTranscribe={async () => "x"} inspelare={provinspelare()} />);
    await within(await screen.findByRole("log")).findByText("Hej");
    fireEvent.click(screen.getByRole("button", { name: "Dictate" }));
    expect(await within(yta()).findByRole("button", { name: "Done, post it" })).toBeTruthy();
  });
});
