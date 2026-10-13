import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { OpsAppShell, useOppnaInspelning } from "../components/OpsAppShell.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { useTalk } from "../components/OpsTalk.jsx";
import { IGENKANNING_VANTA_MS, TALK_TEXTFEL, webblasarensIgenkanning, webblasarensInspelare } from "../lib/talk.js";
import { validateModuler } from "../lib/modul.js";

/*
 * Svara efter ett kvitto, och att andra omgången fungerar (0.99.0). Två händelser, båda CP 2026-10-13 kväll:
 *
 * 22:13, med en skärmbild av panelen efter att agenten ställt en följdfråga: "Efter att jag pratat en gång finns bara stäng. Sedan
 * kan jag inte börja om." Kvittot hade Ångra och Stäng, och ingen väg att svara i samma panel.
 *
 * 22:15, iPhone/Safari: "Det är som att andra gången jag försöker spela in så funkar det inte." Rotorsaken som går att visa i koden:
 * `webblasarensIgenkanning().stoppa()` gav upp efter `IGENKANNING_VANTA_MS` när webbläsaren aldrig sade `end`, men lät igenkännaren
 * leva. Safari tillåter bara EN aktiv igenkänning, så `start()` på nästa omgångs instans kastade InvalidStateError. Felet sväljdes:
 * texten blev tom, platstexten stod kvar, och ingenting förklarade varför. ⛔ Provet använder en fejkad Safari-igenkänning med den
 * regeln. Den är inte en riktig iPhone: det som är mätt är koden mot regeln, inte regeln mot Apple.
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

/** Klar, och vänta tills kvittot (eller sparningen) står. */
async function klar() {
  fireEvent.click(screen.getByRole("button", { name: "Klar, spara inspelningen" }));
  await flush();
}

describe("Svara efter ett kvitto", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("⛔ efter kvittot finns Svara (primär, med mikrofonen) och Stäng, och Svara startar en ny omgång till SAMMA mål", async () => {
    const insp = falskInspelare();
    const onTalk = vi.fn(async () => ({ kvitto: "Vill du ha ett ärende eller en påminnelse?" }));
    render(Skal({ onTalk, inspelare: insp, mal: [{ id: "agenten", etikett: "Agenten" }] }));
    fireEvent.click(huvudMikrofon());
    await flush();
    expect(insp.starta).toHaveBeenCalledTimes(1);
    await klar();
    const dialog = /** @type {HTMLElement} */ (falt());
    expect(within(dialog).getByRole("status").textContent).toBe("Vill du ha ett ärende eller en påminnelse?");
    const svara = within(dialog).getByRole("button", { name: "Svara" });
    expect(svara.querySelector("svg")).not.toBeNull();
    expect(svara.className).toContain("bg-accent");
    expect(within(dialog).getByRole("button", { name: "Stäng" }).className).not.toContain("bg-accent ");
    // ⛔ Fokus på Svara: det naturliga nästa steget i en dialog med agenten.
    expect(document.activeElement).toBe(svara);

    fireEvent.click(svara);
    await flush();
    // En ny omgång i SAMMA panel: inspelaren startad igen, kvittot borta, fältet lyssnar.
    expect(insp.starta).toHaveBeenCalledTimes(2);
    expect(falt()).not.toBeNull();
    expect(screen.queryByText("Vill du ha ett ärende eller en påminnelse?")).toBeNull();
    expect(screen.queryByRole("button", { name: "Svara" })).toBeNull();
    await klar();
    expect(onTalk).toHaveBeenCalledTimes(2);
    expect(/** @type {any[]} */ (onTalk.mock.calls[0])[1].mal).toEqual({ id: "agenten" });
    expect(/** @type {any[]} */ (onTalk.mock.calls[1])[1].mal).toEqual({ id: "agenten" });
  });

  it("⛔ Ångra finns kvar bredvid Svara och fungerar", async () => {
    const angra = vi.fn(async () => {});
    render(Skal({ onTalk: async () => ({ kvitto: "Inlagt: Rep", angra }), inspelare: falskInspelare() }));
    fireEvent.click(huvudMikrofon());
    await flush();
    await klar();
    const dialog = /** @type {HTMLElement} */ (falt());
    expect(within(dialog).getByRole("button", { name: "Svara" })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Ångra" }));
    await flush();
    expect(angra).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByRole("status").textContent).toBe("Ångrat");
  });

  it("⛔ en gammal text står inte kvar under det nya svaret medan mikrofonen öppnas", async () => {
    // Utan rensning låg förra omgångens text kvar i hela tiden mikrofonprompten tog, och såg ut som det nya svaret.
    const insp = falskInspelare();
    const igenkanning = { starta: vi.fn(), stoppa: vi.fn(async () => "boka rep torsdag"), kasta: vi.fn() };
    render(Skal({ onTalk: async () => ({ kvitto: "Vilken tid?" }), inspelare: insp, igenkanning }));
    fireEvent.click(huvudMikrofon());
    await flush();
    await klar();
    expect(falt()).not.toBeNull();
    let oppna = () => {};
    insp.starta.mockImplementationOnce(() => new Promise((a) => { oppna = () => a(undefined); }));
    fireEvent.click(screen.getByRole("button", { name: "Svara" }));
    await flush();
    expect(document.querySelector("[data-talk-text]")).toBeNull();
    expect(screen.queryByText("boka rep torsdag")).toBeNull();
    oppna();
    await flush();
    expect(igenkanning.starta).toHaveBeenCalledTimes(2);
  });

  it("⛔ Svara spärras medan Ångra pågår: en ny omgång hade rensat kvittot under en Ångra som inte svarat", async () => {
    let klarAngra = () => {};
    const angra = vi.fn(() => new Promise((a) => { klarAngra = () => a(undefined); }));
    const insp = falskInspelare();
    render(Skal({ onTalk: async () => ({ kvitto: "Inlagt: Rep", angra }), inspelare: insp }));
    fireEvent.click(huvudMikrofon());
    await flush();
    await klar();
    fireEvent.click(screen.getByRole("button", { name: "Ångra" }));
    await flush();
    const svara = screen.getByRole("button", { name: "Svara" });
    expect(svara).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(svara);
    await flush();
    expect(insp.starta).toHaveBeenCalledTimes(1);
    klarAngra();
    await flush();
    expect(screen.getByRole("status").textContent).toBe("Ångrat");
  });

  it("ordet följer språket och kan bytas av appen", async () => {
    const { unmount } = render(<OpsSprakProvider sprak="en">{Skal({ onTalk: async () => ({ kvitto: "Done" }), inspelare: falskInspelare() })}</OpsSprakProvider>);
    fireEvent.click(huvudMikrofon());
    await flush();
    await klar();
    expect(screen.getByRole("button", { name: "Reply" })).toBeTruthy();
    unmount();
    render(Skal({ onTalk: async () => ({ kvitto: "Klart" }), inspelare: falskInspelare(), svaraText: "Fortsätt" }));
    fireEvent.click(huvudMikrofon());
    await flush();
    await klar();
    expect(screen.getByRole("button", { name: "Fortsätt" })).toBeTruthy();
  });

  it("⛔ skalet kastar på en tom svaraText vid uppstart", () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(Skal({ onTalk: async () => {}, svaraText: " " }))).toThrow(/svaraText/);
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ en inspelning låst till Biblioteket fortsätter till Biblioteket när man trycker Svara (utan val)", async () => {
    const spara = vi.fn(async () => ({ kvitto: "Sparat i Biblioteket" }));
    const modul = {
      id: "bibliotek",
      namn: { sv: "Bibliotek", en: "Library" },
      nav: [],
      routes: [],
      samlingar: [],
      kallor: {},
      skapar: [],
      hubb: null,
      tillagg: [{ plats: "inspelning.mal", id: "spara", etikett: { sv: "Spara i Biblioteket", en: "Save in the library" }, spara }],
    };
    function Rad() {
      const oppna = useOppnaInspelning();
      return <button type="button" onClick={() => oppna("bibliotek")}>Röstinspelning i Biblioteket</button>;
    }
    const onTalk = vi.fn();
    render(
      <OpsAppShell brand="Ops" fasta={fasta} activeHref="/" talk={{ onTalk, inspelare: falskInspelare(), mal: [{ id: "agenten", etikett: "Agenten" }] }} skapa={{ lage: "g", moduler: validateModuler([modul]), aktivGrupp: { id: "g", moduler: ["bibliotek"] } }}>
        <Rad />
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Röstinspelning i Biblioteket" }));
    await flush();
    expect(screen.queryByRole("radio")).toBeNull();
    await klar();
    expect(spara).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Svara" }));
    await flush();
    expect(screen.queryByRole("radio")).toBeNull();
    await klar();
    expect(spara).toHaveBeenCalledTimes(2);
    expect(onTalk).not.toHaveBeenCalled();
  });
});

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
