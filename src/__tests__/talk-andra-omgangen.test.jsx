import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { useTalk } from "../components/OpsTalk.jsx";
import { IGENKANNING_VANTA_MS, TALK_TEXTFEL, webblasarensIgenkanning, webblasarensInspelare } from "../lib/talk.js";

/*
 * Andra omgången i TALK (0.99.0), flyttat hit ur `talk-svara-andra-gangen.test.jsx` när Svara togs bort i 0.105.0. ⛔ PROVEN HÄR
 * MÄTTE ALDRIG SVARA, bara att en andra omgång fungerar, och den finns kvar: man stänger fältet och trycker på mikrofonen igen.
 * Granskningen av PR 387 fann att de försvann med filen. De står här oförändrade utom att andra omgången startas med mikrofonen.
 *
 * Händelsen, CP 2026-10-13 22:15, iPhone/Safari: "Det är som att andra gången jag försöker spela in så funkar det inte." Rotorsaken
 * som går att visa i koden: `webblasarensIgenkanning().stoppa()` gav upp efter `IGENKANNING_VANTA_MS` när webbläsaren aldrig sade
 * `end`, men lät igenkännaren leva. Safari tillåter bara EN aktiv igenkänning, så `start()` på nästa omgångs instans kastade
 * InvalidStateError. Felet sväljdes: texten blev tom, platstexten stod kvar, och ingenting förklarade varför. ⛔ Provet använder en
 * fejkad Safari-igenkänning med den regeln. Den är inte en riktig iPhone: det som är mätt är koden mot regeln, inte regeln mot Apple.
 */

const flush = () => act(async () => {});
const falt = () => screen.queryByRole("dialog", { name: "TALK" });
const huvudMikrofon = () => /** @type {HTMLElement} */ (document.querySelector("[data-talk-huvud]"));
const fasta = { idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };

/** @param {any} talk @param {import("react").ReactNode} [barn] */
const Skal = (talk, barn = <p>innehåll</p>) => (
  <OpsAppShell brand="Ops" fasta={fasta} moduler={[]} activeHref="/" talk={talk}>
    {barn}
  </OpsAppShell>
);

/** En inspelare som räknar starterna. */
function falskInspelare() {
  return {
    starta: vi.fn(() => Promise.resolve()),
    stoppa: vi.fn(() => Promise.resolve({ blob: new Blob(["ljud"], { type: "audio/webm" }), mimeType: "audio/webm", sekunder: 2 })),
    kasta: vi.fn(),
    niva: () => 0.5,
  };
}

describe("tak som följer målet, direkt på kroken", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("⛔ byts taket mitt i en inspelning räknas det om från starten, åt båda håll (flyttat hit ur skalprovet, 0.99.0)", async () => {
    // Skalet kan inte längre byta till ett moduls mål mitt i en inspelning (mikrofonen erbjuder bara appens mål). Taket följer
    // fortfarande `maxSekunder`, och den som bygger egen rad med `useTalk` kan byta det, så beteendet provas på kroken.
    const insp = falskInspelare();
    const hook = renderHook(({ max }) => useTalk({ onTalk: async () => {}, onKlick: () => {}, inspelare: insp, igenkanning: false, maxSekunder: max }), { initialProps: { max: 120 } });
    act(() => hook.result.current.direkt());
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    hook.rerender({ max: 600 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000);
    });
    expect(insp.stoppa).not.toHaveBeenCalled();
    hook.rerender({ max: 120 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(insp.stoppa).toHaveBeenCalledTimes(1);
  });
});

/**
 * En fejkad Safari-igenkänning. Regeln den efterliknar: bara EN igenkänning får vara aktiv, `start()` på en andra kastar
 * InvalidStateError, och `stop()` kan lämna igenkänningen utan att `end` någonsin kommer (`stop: "tyst"`).
 * @param {{ stop?: "slut" | "tyst", blockerad?: boolean }} [bete] Muterbart: provet byter beteende mellan omgångarna.
 */
function safariIgenkanning(bete = {}) {
  const b = { stop: "slut", blockerad: false, ...bete };
  /** @type {any[]} */
  const instanser = [];
  class SR {
    constructor() {
      this.lang = "";
      this.continuous = false;
      this.interimResults = false;
      /** @type {any} */ this.onresult = null;
      /** @type {any} */ this.onerror = null;
      /** @type {any} */ this.onend = null;
      this.startad = false;
      this.slut = false;
      instanser.push(this);
    }
    start() {
      const fel = () => Object.assign(new Error("recognition has already started"), { name: "InvalidStateError" });
      if (b.blockerad) throw fel();
      if (this.startad) throw fel();
      if (instanser.some((i) => i !== this && i.startad && !i.slut)) throw fel();
      this.startad = true;
    }
    stop() {
      if (b.stop === "slut") this.avsluta();
    }
    abort() {
      this.avsluta();
    }
    avsluta() {
      if (this.slut) return;
      this.slut = true;
      queueMicrotask(() => this.onend?.());
    }
  }
  /** Webbläsaren hör något. Bara en startad igenkänning hör. */
  const hor = (/** @type {any} */ rec, /** @type {string} */ t) => {
    if (!rec.startad || rec.slut) return;
    rec.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: t }], { isFinal: true })] });
  };
  return { SR, instanser, hor, bete: b };
}

describe("andra omgången med en Safari-lik igenkänning", () => {
  it("⛔ webblasarensIgenkanning: en igenkännare som stoppa() gett upp på blockerar inte nästa omgång", async () => {
    vi.useFakeTimers();
    try {
      const f = safariIgenkanning({ stop: "tyst" });
      const igk = /** @type {NonNullable<ReturnType<typeof webblasarensIgenkanning>>} */ (webblasarensIgenkanning({ SpeechRecognition: f.SR }));
      const onFel = vi.fn();
      /** @type {string[]} */
      const sett = [];
      igk.starta({ sprak: "sv-SE", onText: (t) => sett.push(t), onFel });
      f.hor(f.instanser[0], "första");
      const klart = igk.stoppa();
      await vi.advanceTimersByTimeAsync(IGENKANNING_VANTA_MS);
      // Webbläsaren sade aldrig end: texten är opålitlig och blir tom, som förut.
      expect(await klart).toBe("");

      igk.starta({ sprak: "sv-SE", onText: (t) => sett.push(t), onFel });
      // Röd före rättningen: instans 2 kastade InvalidStateError i start() och blev aldrig startad, utan att någon fick veta.
      expect(f.instanser[1].startad).toBe(true);
      expect(onFel).not.toHaveBeenCalled();
      f.hor(f.instanser[1], "andra");
      f.bete.stop = "slut";
      expect(await igk.stoppa()).toBe("andra");
    } finally {
      vi.useRealTimers();
    }
  });

  it("⛔ en start som ändå kastar säger det (onFel + felrapport), aldrig tyst", () => {
    const f = safariIgenkanning({ blockerad: true });
    const igk = /** @type {NonNullable<ReturnType<typeof webblasarensIgenkanning>>} */ (webblasarensIgenkanning({ SpeechRecognition: f.SR }));
    const onFel = vi.fn();
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      igk.starta({ sprak: "sv-SE", onText: () => {}, onFel });
      expect(onFel).toHaveBeenCalledWith("InvalidStateError");
      expect(konsol).toHaveBeenCalled();
    } finally {
      konsol.mockRestore();
    }
  });

  describe("genom skalet: öppna, prata, kvitto, stäng, öppna, prata", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    it("⛔ den andra omgångens ord når appen, och fältet sa aldrig att något var fel", async () => {
      const f = safariIgenkanning({ stop: "tyst" });
      vi.stubGlobal("webkitSpeechRecognition", f.SR);
      const onTalk = vi.fn(async () => ({ kvitto: "Noterat" }));
      render(Skal({ onTalk, inspelare: falskInspelare(), igenkanning: true, mal: [{ id: "agenten", etikett: "Agenten" }] }));

      fireEvent.click(huvudMikrofon());
      await flush();
      expect(f.instanser[0].startad).toBe(true);
      f.hor(f.instanser[0], "boka rep");
      fireEvent.click(screen.getByRole("button", { name: "Klar, spara inspelningen" }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(IGENKANNING_VANTA_MS);
      });
      expect(onTalk).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("button", { name: "Stäng" }));
      expect(falt()).toBeNull();

      // ⛔ ANDRA OMGÅNGEN MED MIKROFONEN (0.105.0): Svara finns inte längre.
      f.bete.stop = "slut";
      fireEvent.click(huvudMikrofon());
      await flush();
      // Röd före rättningen: den första igenkännaren levde kvar, och instans 2 kastade i start().
      expect(f.instanser[1].startad).toBe(true);
      expect(document.querySelector("[data-talk-textfel]")).toBeNull();
      act(() => f.hor(f.instanser[1], "andra gången"));
      expect(screen.getByText("andra gången")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Klar, spara inspelningen" }));
      await flush();
      expect(onTalk).toHaveBeenCalledTimes(2);
      expect(/** @type {any[]} */ (onTalk.mock.calls[1])[1].text).toBe("andra gången");
    });

    it("⛔ går igenkänningen inte att starta säger fältet det, och ljudet sparas ändå", async () => {
      const f = safariIgenkanning({ blockerad: true });
      vi.stubGlobal("webkitSpeechRecognition", f.SR);
      const onTalk = vi.fn(async () => ({ kvitto: "Noterat" }));
      const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        render(Skal({ onTalk, inspelare: falskInspelare(), igenkanning: true }));
        fireEvent.click(huvudMikrofon());
        await flush();
        const besked = screen.getByRole("alert");
        expect(besked.textContent).toBe(TALK_TEXTFEL);
        // Platstexten lovar text som inte kommer, och ska inte stå kvar bredvid beskedet.
        expect(document.querySelector("[data-talk-platstext]")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Klar, spara inspelningen" }));
        await flush();
        expect(onTalk).toHaveBeenCalledTimes(1);
        expect(/** @type {any[]} */ (onTalk.mock.calls[0])[1].text).toBeUndefined();
      } finally {
        konsol.mockRestore();
      }
    });
  });
});

describe("mikrofonströmmen mellan omgångarna", () => {
  it("webblasarensInspelare släpper sin ström efter varje omgång, och andra omgången får en ny (teorin om en kvarlämnad ström stämde inte)", async () => {
    /** @type {Array<{ stoppad: boolean }>} */
    const spar = [];
    const mediaDevices = {
      getUserMedia: vi.fn(async () => {
        const spor = { stoppad: false, stop() { this.stoppad = true; } };
        spar.push(spor);
        return { getTracks: () => [spor] };
      }),
    };
    class MR {
      constructor() {
        this.state = "inactive";
        this.mimeType = "audio/mp4";
        /** @type {any} */ this.ondataavailable = null;
        /** @type {any} */ this.onstop = null;
      }
      static isTypeSupported() {
        return true;
      }
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        queueMicrotask(() => this.onstop?.());
      }
    }
    const insp = webblasarensInspelare({ mediaDevices: /** @type {any} */ (mediaDevices), MediaRecorder: /** @type {any} */ (MR), AudioContext: undefined });
    await insp.starta();
    await insp.stoppa();
    await insp.starta();
    await insp.stoppa();
    expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
    expect(spar.every((s) => s.stoppad)).toBe(true);
  });
});
