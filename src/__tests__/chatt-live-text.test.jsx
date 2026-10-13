import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla } from "../data/samtalskalla.js";

/*
 * Text i chattens skrivfält medan man pratar (0.98.0). CP 2026-10-13, med en skärmbild av "Skriver ut det inspelade…" under skrivfältet:
 * "VI behöver ha samma snabba text utskrift även i chatten."
 *
 * ⛔ HÄR MÄTS BETEENDE MED EN FEJKAD WEBBLÄSARE (samma `SpeechRecognition` som TALK:s prov): orden syns i fältet medan de sägs, den
 * slutliga texten ligger kvar när man stoppar utan att något skickas, det som stod i fältet före mikrofonen ligger kvar, och utan
 * igenkänning eller när den faller gäller den gamla vägen (inspelning och `onTranscribe`) oförändrad. Att igenkänningen är AV som förval
 * mäts i chatt-skrivfalt.test.jsx och rörs inte här.
 */

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "ops", namn: "Ops-agenten", typ: "agent", status: "aktiv" },
];

function provinspelare() {
  const blob = new Blob(["ljud"], { type: "audio/webm" });
  return {
    blob,
    starta: vi.fn(async () => {}),
    stoppa: vi.fn(async () => ({ blob, mimeType: "audio/webm", sekunder: 2 })),
    kasta: vi.fn(),
    niva: () => 0.5,
  };
}

/** En fejkad `SpeechRecognition`. Provet styr resultat, fel och slut. */
function fejkadIgenkanning() {
  /** @type {any[]} */
  const instanser = [];
  class SR {
    constructor() {
      /** @type {any} */ this.onresult = null;
      /** @type {any} */ this.onerror = null;
      /** @type {any} */ this.onend = null;
      this.startad = false;
      instanser.push(this);
    }
    start() {
      this.startad = true;
    }
    stop() {
      queueMicrotask(() => this.onend?.());
    }
    abort() {}
  }
  /** @param {any} rec @param {Array<[string, boolean]>} rader */
  const resultat = (rec, rader, fran = 0) =>
    act(() => rec.onresult({ resultIndex: fran, results: rader.map(([t, slut]) => Object.assign([{ transcript: t }], { isFinal: slut })) }));
  return { SR, instanser, resultat };
}

async function underlag() {
  const kalla = createMemorySource({});
  const s = /** @type {any} */ (createSamtalskalla({ kalla }));
  const a = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "ops", slag: "agent" });
  await s.skicka(a.id, { text: "Hej", av: "anna" });
  return { kalla, s, a };
}

const ruta = () => /** @type {HTMLTextAreaElement} */ (screen.getByRole("textbox", { name: "Skriv ett meddelande" }));

/** Renderar chatten med igenkänning påslagen och trycker på mikrofonen. Ger igenkännaren när den lyssnar. */
async function borjaPrata(/** @type {{ igenkanning?: boolean, onTranscribe?: any, fore?: string }} */ val = {}) {
  const { kalla, s, a } = await underlag();
  const insp = provinspelare();
  const f = fejkadIgenkanning();
  vi.stubGlobal("webkitSpeechRecognition", f.SR);
  const onTranscribe = val.onTranscribe ?? vi.fn(async () => "från servern");
  render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={a.id} onTranscribe={onTranscribe} inspelare={insp} igenkanning={val.igenkanning ?? true} />);
  await within(await screen.findByRole("log")).findByText("Hej");
  if (val.fore !== undefined) fireEvent.change(ruta(), { target: { value: val.fore } });
  fireEvent.click(screen.getByRole("button", { name: "Prata in" }));
  await waitFor(() => expect(f.instanser[0]?.startad).toBe(true));
  return { kalla, a, insp, f, onTranscribe, rec: f.instanser[0] };
}

describe("chattens mikrofon med text medan man pratar", () => {
  it("⛔ orden syns i fältet medan de sägs, fältet är skrivskyddat och en polite status säger att det lyssnar", async () => {
    try {
      const { f, rec } = await borjaPrata();
      f.resultat(rec, [["boka rep", false]]);
      expect(ruta().value).toBe("boka rep");
      f.resultat(rec, [["boka rep på torsdag", false]]);
      expect(ruta().value).toBe("boka rep på torsdag");
      expect(ruta().readOnly).toBe(true);
      const knapp = screen.getByRole("button", { name: "Skriv ut det inspelade" });
      expect(knapp.getAttribute("aria-pressed")).toBe("true");
      const status = document.querySelector("[data-rostlage='spelar']");
      expect(status?.getAttribute("role")).toBe("status");
      expect(status?.textContent).toContain("Lyssnar");
      expect(rec.lang).toBe("sv-SE");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("⛔ den slutliga texten ligger kvar efter stopp, fältet öppnas, och ingenting skickas eller transkriberas", async () => {
    try {
      const { kalla, a, f, rec, onTranscribe } = await borjaPrata();
      f.resultat(rec, [["boka rep på torsdag", true]]);
      fireEvent.click(screen.getByRole("button", { name: "Skriv ut det inspelade" }));
      await waitFor(() => expect(screen.queryByRole("button", { name: "Skriv ut det inspelade" })).toBeNull());
      await waitFor(() => expect(ruta().value).toBe("boka rep på torsdag"));
      expect(ruta().readOnly).toBe(false);
      expect(onTranscribe).not.toHaveBeenCalled();
      expect(await kalla.list(`samtal/${a.id}/meddelanden`)).toHaveLength(1);
      expect(screen.getByRole("button", { name: "Skicka" })).toBeTruthy();
      expect(document.querySelector("[data-rostlage]")).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("⛔ det som stod i fältet före mikrofonen ligger kvar och orden läggs efter", async () => {
    try {
      // Mikrofonen finns bara i ett fält utan innehåll, så det som kan stå där är blanksteg. Basen läses ändå ur fältet.
      const { f, rec } = await borjaPrata({ fore: "  " });
      f.resultat(rec, [["hej", false]]);
      expect(ruta().value).toBe("  hej");
      f.resultat(rec, [["hej alla", true]]);
      fireEvent.click(screen.getByRole("button", { name: "Skriv ut det inspelade" }));
      await waitFor(() => expect(ruta().value).toBe("  hej alla"));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("⛔ Avbryt kastar orden som hörts och lämnar fältet som det var", async () => {
    try {
      const { f, rec, onTranscribe } = await borjaPrata();
      f.resultat(rec, [["boka rep", false]]);
      expect(ruta().value).toBe("boka rep");
      fireEvent.click(screen.getByRole("button", { name: "Avbryt inspelningen" }));
      await waitFor(() => expect(ruta().value).toBe(""));
      expect(onTranscribe).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("⛔ en igenkänning som faller ger den gamla vägen: halva orden försvinner ur fältet och appens transkribering skriver ut", async () => {
    try {
      const { f, rec, onTranscribe } = await borjaPrata();
      f.resultat(rec, [["boka re", false]]);
      expect(ruta().value).toBe("boka re");
      act(() => rec.onerror({ error: "network" }));
      fireEvent.click(screen.getByRole("button", { name: "Skriv ut det inspelade" }));
      await waitFor(() => expect(ruta().value).toBe("från servern"));
      expect(onTranscribe).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("⛔ en igenkänning som faller och en transkribering som faller säger det, aldrig tyst", async () => {
    try {
      const { f, rec } = await borjaPrata({ onTranscribe: vi.fn().mockRejectedValue(new Error("Tjänsten svarade 503.")) });
      f.resultat(rec, [["boka re", false]]);
      act(() => rec.onerror({ error: "network" }));
      fireEvent.click(screen.getByRole("button", { name: "Skriv ut det inspelade" }));
      const fel = await screen.findByRole("alert");
      expect(fel.textContent).toContain("Det inspelade kunde inte skrivas ut.");
      expect(fel.textContent).toContain("Tjänsten svarade 503.");
      // Ljudet finns kvar för Försök igen, och den halva texten ligger inte kvar i fältet som om den vore hel.
      expect(within(fel).getByRole("button", { name: "Försök igen" })).toBeTruthy();
      expect(ruta().value).toBe("");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("utan taligenkänning i webbläsaren gäller den gamla vägen: spelar in, Skriver ut det inspelade…, och appens text i fältet", async () => {
    const { s, a } = await underlag();
    const insp = provinspelare();
    let klar = /** @type {(t: string) => void} */ (() => {});
    const onTranscribe = vi.fn(() => new Promise((res) => (klar = res)));
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={a.id} onTranscribe={onTranscribe} inspelare={insp} igenkanning />);
    await within(await screen.findByRole("log")).findByText("Hej");
    fireEvent.click(screen.getByRole("button", { name: "Prata in" }));
    await waitFor(() => expect(insp.starta).toHaveBeenCalled());
    expect(ruta().readOnly).toBe(false);
    expect(document.querySelector("[data-rostlage='spelar']")?.textContent).toContain("Spelar in. Tryck på ljudvågen");
    fireEvent.click(await screen.findByRole("button", { name: "Skriv ut det inspelade" }));
    expect((await screen.findByRole("status")).textContent).toBe("Skriver ut det inspelade…");
    await act(async () => klar("påminn mig på fredag"));
    await waitFor(() => expect(ruta().value).toBe("påminn mig på fredag"));
  });
});
