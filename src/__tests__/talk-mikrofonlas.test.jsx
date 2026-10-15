import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsAuthProvider } from "../auth/auth.jsx";
import { useTalk } from "../components/OpsTalk.jsx";
import { IGENKANNING_SLAPP_MS, IGENKANNING_VANTA_MS, LJUDKONTEXT_VANTA_MS, STOPP_VANTA_MS, TALK_INGET_LJUD, webblasarensIgenkanning, webblasarensInspelare } from "../lib/talk.js";

/*
 * "Det är som att mikrofonen låser sig" (cllp/lifehub.app#253). CP 2026-10-15 07:25 på iPhone, appen på ramverket 0.104.0: efter
 * agentens svar gick det inte att spela in igen, och fältet sade `TALK_INGET_LJUD`. Både ljudet och taligenkänningens text var
 * tomma, och diagnosen som skulle ha sagt varför nådde aldrig appen.
 *
 * ⛔ VAD SOM ÄR MÄTT OCH VAD SOM ÄR HYPOTES. Mätt i koden, och här: att `rapporteraFel` från OpsTalk inte nådde appens mottagare
 * (del A), och fyra sätt koden kunde lämna något från förra omgången öppet när nästa började (del B). Hypotes, inte mätt på en
 * iPhone: att WebKit håller telefonens ljudpass medan en taligenkännare inte sagt `end`, och då ger nästa `getUserMedia` ett tyst
 * spår och nästa igenkännare ingen text. Telefonen nedan följer den regeln. Den mäter koden mot regeln, inte regeln mot Apple.
 */

const flush = () => act(async () => {
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
});
/** @param {number} ms */
const vantaMs = (ms) => act(async () => {
  await vi.advanceTimersByTimeAsync(ms);
});
const falt = () => screen.queryByRole("dialog", { name: "TALK" });
const huvudMikrofon = () => /** @type {HTMLElement} */ (document.querySelector("[data-talk-huvud]"));
const fasta = { idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };
const klar = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Klar, spara inspelningen" }));
  await flush();
};

/**
 * En telefon med ett ljudpass. ⛔ REGELN, HYPOTES: medan en igenkännare har startat och inte sagt `end` håller den ljudpasset. Ett
 * `getUserMedia` då ger ett tyst spår, och en igenkännare som startar då hör ingenting.
 *
 * `stoppEndMs[i]` är hur länge igenkännare nummer i tar på sig att säga `end` efter `stop()`. `abort()` ger `end` efter `abortEndMs`.
 * @param {{ stoppEndMs?: number[], abortEndMs?: number }} [val]
 */
function telefonMedEttLjudpass({ stoppEndMs = [], abortEndMs = 300 } = {}) {
  /** @type {any[]} */
  const igenkannare = [];
  const haller = (/** @type {any} */ utom) => igenkannare.some((r) => r !== utom && r.startad && !r.slut);
  /** @type {any[]} */
  const spar = [];
  const mediaDevices = {
    getUserMedia: vi.fn(async () => {
      const t = { muted: haller(null), readyState: "live", enabled: true, stoppad: false, stop() { this.stoppad = true; this.readyState = "ended"; } };
      spar.push(t);
      return { getTracks: () => [t], getAudioTracks: () => [t] };
    }),
  };
  class MR {
    /** @param {any} strom */
    constructor(strom) {
      this.strom = strom;
      this.state = "inactive";
      this.mimeType = "audio/mp4";
      /** @type {any} */ this.ondataavailable = null;
      /** @type {any} */ this.onstop = null;
    }
    static isTypeSupported(/** @type {string} */ t) {
      return t === "audio/mp4";
    }
    start() {
      this.state = "recording";
    }
    stop() {
      if (this.state === "inactive") return;
      this.state = "inactive";
      const t = this.strom.getAudioTracks()[0];
      if (!t.muted && t.readyState === "live") this.ondataavailable?.({ data: new Blob(["aac"], { type: "audio/mp4" }) });
      queueMicrotask(() => this.onstop?.());
    }
  }
  class SR {
    constructor() {
      this.nummer = igenkannare.length;
      /** @type {any} */ this.onresult = null;
      /** @type {any} */ this.onerror = null;
      /** @type {any} */ this.onend = null;
      this.startad = false;
      this.slut = false;
      this.dov = false;
      /** @type {number | null} */ this.endVid = null;
      igenkannare.push(this);
    }
    start() {
      this.startad = true;
      this.dov = haller(this);
    }
    stop() {
      this.planera(stoppEndMs[this.nummer] ?? 0);
    }
    abort() {
      this.planera(abortEndMs);
    }
    /** @param {number} ms */
    planera(ms) {
      if (this.slut) return;
      const vid = Date.now() + ms;
      if (this.endVid !== null && this.endVid <= vid) return;
      this.endVid = vid;
      setTimeout(() => {
        if (this.slut || this.endVid !== vid) return;
        this.slut = true;
        this.onend?.();
      }, ms);
    }
  }
  /** Personen säger något. Hörs bara av den senaste igenkännaren, och bara när den inte startade medan passet hölls. @param {string} t */
  const sag = (t) => {
    const rec = igenkannare[igenkannare.length - 1];
    if (!rec || !rec.startad || rec.slut || rec.dov) return;
    rec.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: t }], { isFinal: true })] });
  };
  const inspelare = webblasarensInspelare({ mediaDevices: /** @type {any} */ (mediaDevices), MediaRecorder: /** @type {any} */ (MR), AudioContext: undefined });
  const igenkanning = /** @type {NonNullable<ReturnType<typeof webblasarensIgenkanning>>} */ (webblasarensIgenkanning({ SpeechRecognition: SR }));
  return { mediaDevices, spar, igenkannare, sag, inspelare, igenkanning };
}

/** En mottagare av formen `{ fanga, satt }`. */
const attrapp = () => ({ fanga: vi.fn(), satt: vi.fn() });
/** En inloggning som säger "ingen inloggad" direkt. */
const ingenInloggad = () => ({ subscribe: (/** @type {(u: any) => void} */ cb) => { cb(null); return () => {}; }, signOut: async () => {} });

describe("A. felkanalen når komponenterna (lifehub.app#253)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("⛔ OpsTalks tomma inspelning når mottagaren som gavs till OpsAuthProvider, med diagnosen", async () => {
    // Varje ström är tyst och ingen igenkänning finns: inspelningen blir tom.
    const tel = telefonMedEttLjudpass();
    tel.mediaDevices.getUserMedia.mockImplementation(async () => {
      const t = { muted: true, readyState: "live", enabled: true, stoppad: false, stop() { this.stoppad = true; this.readyState = "ended"; } };
      tel.spar.push(t);
      return { getTracks: () => [t], getAudioTracks: () => [t] };
    });
    const felmottagare = attrapp();
    const onTalk = vi.fn(async () => {});
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(
        <OpsAuthProvider authentication={/** @type {any} */ (ingenInloggad())} felmottagare={felmottagare}>
          {/* ⛔ Skalet får INGEN felmottagare: det är registreringen i inloggningen som ska bära den hit. */}
          <OpsAppShell brand="Ops" fasta={fasta} moduler={[]} activeHref="/" talk={{ onTalk, inspelare: tel.inspelare, mal: [{ id: "agenten", etikett: "Agenten" }] }}>
            <p>innehåll</p>
          </OpsAppShell>
        </OpsAuthProvider>,
      );
      fireEvent.click(huvudMikrofon());
      await flush();
      await klar();
      expect(within(/** @type {HTMLElement} */ (falt())).getByRole("alert").textContent).toBe(TALK_INGET_LJUD);
      expect(onTalk).not.toHaveBeenCalled();

      // Röd utan registreringen: OpsTalk anropade `rapporteraFel(fel, sammanhang)` utan mottagare, och bara konsolen fick det.
      const tomma = felmottagare.fanga.mock.calls.filter((c) => /** @type {any} */ (c[1])?.steg === "tomt-ljud");
      expect(tomma).toHaveLength(1);
      const sammanhang = /** @type {any} */ (tomma[0][1]);
      expect(sammanhang).toMatchObject({ yta: "OpsTalk", omgang: 1, tystVidStart: true, omhamtad: true, bitar: 0, ljudkontextVidStart: "ingen", forraIgenkanningHann: null });
      expect(sammanhang.sparVidStart).toEqual([{ readyState: "live", muted: true, enabled: true }]);
      expect(sammanhang.sparVidStopp).toEqual([{ readyState: "live", muted: true, enabled: true }]);
      // ⛔ Ingen text och inget om personen: bara tal, sanningsvärden och tillstånd.
      for (const v of Object.values(sammanhang)) expect(["string", "number", "boolean", "object"]).toContain(typeof v);
      expect(JSON.stringify(sammanhang)).not.toMatch(/@/);
    } finally {
      konsol.mockRestore();
    }
  });

  it("mottagaren avregistreras när inloggningen avmonteras", async () => {
    const { registreraFelmottagare, rapporteraFel } = await import("../lib/felrapport.js");
    const felmottagare = attrapp();
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const vy = render(<OpsAuthProvider authentication={/** @type {any} */ (ingenInloggad())} felmottagare={felmottagare}><p>x</p></OpsAuthProvider>);
      rapporteraFel(new Error("ett"));
      expect(felmottagare.fanga).toHaveBeenCalledTimes(1);
      vy.unmount();
      rapporteraFel(new Error("två"));
      expect(felmottagare.fanga).toHaveBeenCalledTimes(1);
      // Den senast registrerade gäller, och en avregistrering tar bara bort sin egen post.
      const forsta = attrapp();
      const andra = attrapp();
      const avForsta = registreraFelmottagare(forsta);
      const avAndra = registreraFelmottagare(andra);
      rapporteraFel(new Error("tre"));
      expect(andra.fanga).toHaveBeenCalledTimes(1);
      avForsta();
      rapporteraFel(new Error("fyra"));
      expect(andra.fanga).toHaveBeenCalledTimes(2);
      expect(forsta.fanga).not.toHaveBeenCalled();
      avAndra();
      expect(() => registreraFelmottagare(/** @type {any} */ ({ satt: () => {} }))).toThrow(/fanga/);
      // (Granskningen av PR 392, KAN 3) Också satt: inloggningen anropar den vid varje byte.
      expect(() => registreraFelmottagare(/** @type {any} */ ({ fanga: () => {} }))).toThrow(/satt/);
    } finally {
      konsol.mockRestore();
    }
  });
});

describe("B. mikrofonlåset: förra omgången är släppt innan nästa öppnas (lifehub.app#253)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("⛔ omgång 1 med igenkänning, svar, omgång 2: en `end` som kommer sent låser inte nästa omgång", async () => {
    // Första igenkännaren säger `end` först 2 s efter `stop()`, efter att `stoppa` gett upp (IGENKANNING_VANTA_MS) och anropat
    // `abort()`, som ger `end` 300 ms senare. Svaret kommer före det, och personen trycker på mikrofonen direkt.
    const tel = telefonMedEttLjudpass({ stoppEndMs: [2000, 0], abortEndMs: 300 });
    const onTalk = vi.fn(async (/** @type {Blob} */ _blob, /** @type {{ text?: string }} */ meta) => ({ kvitto: meta.text ? `Inlagt: ${meta.text}` : "Vilken dag är repet?" }));
    const felmottagare = attrapp();
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(
        <OpsAppShell brand="Ops" fasta={fasta} moduler={[]} activeHref="/" felmottagare={felmottagare} talk={{ onTalk, inspelare: tel.inspelare, igenkanning: tel.igenkanning, mal: [{ id: "agenten", etikett: "Agenten" }] }}>
          <p>innehåll</p>
        </OpsAppShell>,
      );
      fireEvent.click(huvudMikrofon());
      await flush();
      act(() => tel.sag("påminn mig om repet"));
      await klar();
      await vantaMs(IGENKANNING_VANTA_MS);
      await flush();
      expect(onTalk).toHaveBeenCalledTimes(1);
      expect(within(/** @type {HTMLElement} */ (falt())).getByRole("status").textContent).toBe("Vilken dag är repet?");
      // Förra igenkännaren har fått `abort()` men inte sagt `end`.
      expect(tel.igenkannare[0].slut).toBe(false);

      fireEvent.click(huvudMikrofon());
      await flush();
      await vantaMs(IGENKANNING_SLAPP_MS);
      await flush();
      act(() => tel.sag("på torsdag"));
      await klar();
      await vantaMs(50);
      await flush();

      // Röd före rättelsen: mikrofonen öppnades medan förra igenkännaren höll passet, spåret var tyst, den nya igenkännaren hörde
      // ingenting, och fältet sade TALK_INGET_LJUD.
      expect(screen.queryByText(TALK_INGET_LJUD)).toBeNull();
      expect(onTalk).toHaveBeenCalledTimes(2);
      const [blob, meta] = /** @type {[Blob, { text?: string }]} */ (/** @type {unknown} */ (onTalk.mock.calls[1]));
      expect(meta.text).toBe("på torsdag");
      expect(blob.size).toBeGreaterThan(0);
      expect(tel.spar[1].muted).toBe(false);
      expect(tel.igenkannare).toHaveLength(2);
      expect(tel.spar.every((s) => s.stoppad)).toBe(true);
    } finally {
      konsol.mockRestore();
    }
  });

  it("väntar högst IGENKANNING_SLAPP_MS på en `end` som aldrig kommer, och diagnosen säger det", async () => {
    // `end` kommer aldrig, varken efter stop() eller abort(). Fältet får inte hänga: omgång 2 startar ändå efter taket.
    const tel = telefonMedEttLjudpass({ stoppEndMs: [1e9, 0], abortEndMs: 1e9 });
    const onTalk = vi.fn(async () => ({ kvitto: "Sparat i inkorgen" }));
    const felmottagare = attrapp();
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(
        <OpsAppShell brand="Ops" fasta={fasta} moduler={[]} activeHref="/" felmottagare={felmottagare} talk={{ onTalk, inspelare: tel.inspelare, igenkanning: tel.igenkanning, mal: [{ id: "agenten", etikett: "Agenten" }] }}>
          <p>innehåll</p>
        </OpsAppShell>,
      );
      fireEvent.click(huvudMikrofon());
      await flush();
      await klar();
      await vantaMs(IGENKANNING_VANTA_MS);
      await flush();
      fireEvent.click(huvudMikrofon());
      await flush();
      expect(tel.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
      await vantaMs(IGENKANNING_SLAPP_MS);
      await flush();
      // Två till: den tysta strömmen hämtas om en gång (`omhamtad`), och också den är tyst.
      expect(tel.mediaDevices.getUserMedia).toHaveBeenCalledTimes(3);
      // Spåret är tyst (passet hålls fortfarande) och igenkännaren döv: tomt, och diagnosen säger att förra inte hann.
      await klar();
      await vantaMs(IGENKANNING_VANTA_MS);
      await flush();
      expect(within(/** @type {HTMLElement} */ (falt())).getByRole("alert").textContent).toBe(TALK_INGET_LJUD);
      const tomma = felmottagare.fanga.mock.calls.filter((c) => /** @type {any} */ (c[1])?.steg === "tomt-ljud");
      expect(tomma).toHaveLength(1);
      expect(tomma[0][1]).toMatchObject({ omgang: 2, forraIgenkanningHann: false, omhamtad: true, tystVidStart: true });
      // Räknat från att förra omgången bad om `stop()`: väntetiden i `stoppa` plus taket i `slapp`.
      expect(/** @type {any} */ (tomma[0][1]).forraIgenkanningMs).toBeGreaterThanOrEqual(IGENKANNING_SLAPP_MS);
    } finally {
      konsol.mockRestore();
    }
  });
});

describe("B. inspelaren släpper allt den öppnat", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** En ström vars spår går att följa. */
  const strom = () => {
    const t = { muted: false, readyState: "live", enabled: true, stoppad: false, stop() { this.stoppad = true; this.readyState = "ended"; } };
    return { t, s: { getTracks: () => [t], getAudioTracks: () => [t] } };
  };

  it("⛔ en inspelare som stannat av sig själv (spåret tog slut) hänger inte stoppa, och spåren släpps", async () => {
    const { t, s } = strom();
    /** @type {any} */
    let rec = null;
    class MR {
      constructor() {
        this.state = "inactive";
        this.mimeType = "audio/mp4";
        /** @type {any} */ this.ondataavailable = null;
        /** @type {any} */ this.onstop = null;
        rec = this;
      }
      start() {
        this.state = "recording";
      }
      // Som i webbläsaren: stop() på en inspelare som inte spelar in gör ingenting, och inget stop-event kommer.
      stop() {
        if (this.state === "inactive") return;
        this.state = "inactive";
        queueMicrotask(() => this.onstop?.());
      }
    }
    const insp = webblasarensInspelare({ mediaDevices: /** @type {any} */ ({ getUserMedia: async () => s }), MediaRecorder: /** @type {any} */ (MR), AudioContext: undefined });
    await insp.starta();
    // Spåret tar slut (ett samtal, ett annat ljudpass): inspelaren stannar och skickar sitt stop-event innan någon lyssnar.
    rec.state = "inactive";
    t.readyState = "ended";
    rec.onstop?.();
    let svar = /** @type {any} */ (null);
    insp.stoppa().then((v) => {
      svar = v;
    });
    await vi.advanceTimersByTimeAsync(STOPP_VANTA_MS + 10);
    // Röd före rättelsen: löftet löstes aldrig, fältet stod på Sparar, och mikrofonspärren släpptes aldrig.
    expect(svar).not.toBeNull();
    expect(svar.diagnos).toMatchObject({ stannadeSjalv: true, stoppetHann: true, sparVidStopp: [{ readyState: "ended", muted: false, enabled: true }] });
    expect(t.stoppad).toBe(true);
  });

  it("⛔ en start som faller efter att mikrofonen öppnats stänger spåret själv", async () => {
    const { t, s } = strom();
    class MR {
      constructor() {
        throw Object.assign(new Error("NotSupportedError"), { name: "NotSupportedError" });
      }
    }
    const insp = webblasarensInspelare({ mediaDevices: /** @type {any} */ ({ getUserMedia: async () => s }), MediaRecorder: /** @type {any} */ (MR), AudioContext: undefined });
    await expect(insp.starta()).rejects.toThrow("NotSupportedError");
    // Röd före rättelsen: strömmen stod kvar öppen tills någon utifrån anropade kasta().
    expect(t.stoppad).toBe(true);
  });

  it("⛔ en mikrofon som öppnas efter kasta() spelar inte in, och stängs", async () => {
    const { t, s } = strom();
    /** @type {(v: any) => void} */
    let lamna = () => {};
    const MR = vi.fn(function MR() {
      return { state: "inactive", mimeType: "audio/mp4", start() { this.state = "recording"; }, stop() { this.state = "inactive"; } };
    });
    /** @type {any} */ (MR).isTypeSupported = () => true;
    const insp = webblasarensInspelare({ mediaDevices: /** @type {any} */ ({ getUserMedia: () => new Promise((l) => { lamna = l; }) }), MediaRecorder: /** @type {any} */ (MR), AudioContext: undefined });
    const start = insp.starta();
    insp.kasta();
    lamna(s);
    await expect(start).rejects.toThrow();
    // Röd före rättelsen: strömmen kopplades in och en MediaRecorder började spela in, utan att någon fält visade det.
    expect(MR).not.toHaveBeenCalled();
    expect(t.stoppad).toBe(true);
  });

  it("⛔ nästa omgång öppnar mikrofonen först när förra omgångens AudioContext stängts, högst LJUDKONTEXT_VANTA_MS", async () => {
    /** @type {string[]} */
    const logg = [];
    class AC {
      constructor() {
        this.state = "running";
      }
      createMediaStreamSource() {
        return { connect() {} };
      }
      createAnalyser() {
        return { fftSize: 0, frequencyBinCount: 4, getByteTimeDomainData() {} };
      }
      close() {
        logg.push("close");
        return new Promise((l) => {
          setTimeout(() => {
            this.state = "closed";
            logg.push("stängd");
            l(undefined);
          }, 400);
        });
      }
    }
    class MR {
      constructor() {
        this.state = "inactive";
        this.mimeType = "audio/mp4";
        /** @type {any} */ this.ondataavailable = null;
        /** @type {any} */ this.onstop = null;
      }
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["aac"]) });
        queueMicrotask(() => this.onstop?.());
      }
    }
    const md = {
      getUserMedia: vi.fn(async () => {
        logg.push("getUserMedia");
        return strom().s;
      }),
    };
    const insp = webblasarensInspelare({ mediaDevices: /** @type {any} */ (md), MediaRecorder: /** @type {any} */ (MR), AudioContext: /** @type {any} */ (AC) });
    await insp.starta();
    const forsta = await insp.stoppa();
    expect(forsta.diagnos).toMatchObject({ ljudkontextVidStart: "running", ljudkontextVidStopp: "running", forraLjudkontext: null });
    const andra = insp.starta();
    await vi.advanceTimersByTimeAsync(500);
    await andra;
    // Röd före rättelsen: getUserMedia kom direkt efter close(), innan ljudkontexten stängts.
    expect(logg).toEqual(["getUserMedia", "close", "stängd", "getUserMedia"]);
    const ut = await insp.stoppa();
    expect(ut.diagnos?.forraLjudkontext).toEqual({ hann: true, ms: 400 });
    expect(LJUDKONTEXT_VANTA_MS).toBeGreaterThan(400);
  });
});

describe("taket i stoppa (granskningen av PR 392, MÅSTE 1)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /**
   * En inspelare vars stop-event dröjer. `fordrojning[i]` är hur länge inspelare nummer i väntar efter `stop()` innan den lämnar sin
   * sista bit (`text[i]`) och sitt stop-event. `Infinity` betyder aldrig.
   * @param {number[]} fordrojning @param {string[]} text
   */
  function sengInspelning(fordrojning, text) {
    /** @type {any[]} */
    const spar = [];
    let n = 0;
    class MR {
      constructor() {
        this.nummer = n;
        n += 1;
        this.state = "inactive";
        this.mimeType = "audio/mp4";
        /** @type {any} */ this.ondataavailable = null;
        /** @type {any} */ this.onstop = null;
      }
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        const ms = fordrojning[this.nummer];
        if (!Number.isFinite(ms)) return;
        setTimeout(() => {
          this.ondataavailable?.({ data: new Blob([text[this.nummer]], { type: "audio/mp4" }) });
          this.onstop?.();
        }, ms);
      }
    }
    const md = {
      getUserMedia: async () => {
        const t = { muted: false, readyState: "live", enabled: true, stoppad: false, stop() { this.stoppad = true; this.readyState = "ended"; } };
        spar.push(t);
        return { getTracks: () => [t], getAudioTracks: () => [t] };
      },
    };
    const insp = webblasarensInspelare({ mediaDevices: /** @type {any} */ (md), MediaRecorder: /** @type {any} */ (MR), AudioContext: undefined });
    return { insp, spar };
  }

  it("⛔ ett stop-event som aldrig kommer: stoppa svarar efter STOPP_VANTA_MS och släpper spåret", async () => {
    const { insp, spar } = sengInspelning([Infinity], ["x"]);
    await insp.starta();
    let svar = /** @type {any} */ (null);
    insp.stoppa().then((v) => {
      svar = v;
    });
    await vi.advanceTimersByTimeAsync(STOPP_VANTA_MS - 10);
    expect(svar).toBeNull();
    await vi.advanceTimersByTimeAsync(20);
    // Röd utan taket: löftet löstes aldrig, fältet stod på Sparar och mikrofonspärren släpptes aldrig.
    expect(svar).not.toBeNull();
    expect(svar.diagnos).toMatchObject({ stannadeSjalv: false, stoppetHann: false });
    expect(spar[0].stoppad).toBe(true);
  });

  it("⛔ en bit som kommer efter taket hamnar inte i nästa omgångs ljud", async () => {
    // Omgång 1 lämnar 6 byte "GAMMAL" 3 s efter stop(), alltså efter taket. Omgång 2 lämnar 2 byte "ny" direkt.
    const { insp } = sengInspelning([3000, 0], ["GAMMAL", "ny"]);
    await insp.starta();
    const forsta = insp.stoppa();
    await vi.advanceTimersByTimeAsync(STOPP_VANTA_MS + 10);
    const ett = await forsta;
    expect(ett.diagnos?.stoppetHann).toBe(false);
    expect(ett.blob.size).toBe(0);
    await insp.starta();
    // Förra omgångens bit kommer nu, medan omgång 2 spelar in.
    await vi.advanceTimersByTimeAsync(1500);
    const andra = insp.stoppa();
    await vi.advanceTimersByTimeAsync(10);
    const tva = await andra;
    // Röd utan nollningen av `ondataavailable`: 8 byte, förra omgångens ljud först.
    expect(tva.blob.size).toBe(2);
  });

  it("⛔ kasta: en bit som kommer efter kastet hamnar inte i nästa omgångs ljud", async () => {
    const { insp } = sengInspelning([500, 0], ["GAMMAL", "ny"]);
    await insp.starta();
    insp.kasta();
    await insp.starta();
    await vi.advanceTimersByTimeAsync(600);
    const andra = insp.stoppa();
    await vi.advanceTimersByTimeAsync(10);
    const tva = await andra;
    // Röd utan nollningen i `kasta`: 8 byte.
    expect(tva.blob.size).toBe(2);
  });
});

describe("taket på väntan efter förra AudioContext (granskningen av PR 392, BÖR 2)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("⛔ en close() som aldrig löser sig låser inte nästa omgång: den startar efter LJUDKONTEXT_VANTA_MS", async () => {
    class AC {
      constructor() {
        this.state = "running";
      }
      createMediaStreamSource() {
        return { connect() {} };
      }
      createAnalyser() {
        return { fftSize: 0, frequencyBinCount: 4, getByteTimeDomainData() {} };
      }
      close() {
        return new Promise(() => {});
      }
    }
    class MR {
      constructor() {
        this.state = "inactive";
        this.mimeType = "audio/mp4";
        /** @type {any} */ this.ondataavailable = null;
        /** @type {any} */ this.onstop = null;
      }
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        queueMicrotask(() => this.onstop?.());
      }
    }
    const md = { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop() {} }], getAudioTracks: () => [{ stop() {} }] })) };
    const insp = webblasarensInspelare({ mediaDevices: /** @type {any} */ (md), MediaRecorder: /** @type {any} */ (MR), AudioContext: /** @type {any} */ (AC) });
    await insp.starta();
    await insp.stoppa();
    let startad = false;
    insp.starta().then(() => {
      startad = true;
    });
    await vi.advanceTimersByTimeAsync(LJUDKONTEXT_VANTA_MS - 10);
    expect(startad).toBe(false);
    expect(md.getUserMedia).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(20);
    // Röd utan taket: getUserMedia anropades aldrig och omgången startade aldrig.
    expect(startad).toBe(true);
    expect(md.getUserMedia).toHaveBeenCalledTimes(2);
    const ut = await insp.stoppa();
    expect(ut.diagnos?.forraLjudkontext).toEqual({ hann: false, ms: LJUDKONTEXT_VANTA_MS });
  });
});

describe("igenkännaren stängs vid avmontering i varje läge (granskningen av PR 392, BÖR 3)", () => {
  /** En inspelare som svarar direkt. */
  const inspelare = () => ({
    starta: vi.fn(async () => {}),
    stoppa: vi.fn(async () => ({ blob: new Blob(["ljud"]), mimeType: "audio/mp4", sekunder: 1 })),
    kasta: vi.fn(),
    niva: () => 0,
  });

  it("⛔ i läget skickar, medan igenkännaren väntar på sitt sista besked", async () => {
    const igenkanning = { starta: vi.fn(), stoppa: vi.fn(() => new Promise(() => {})), kasta: vi.fn() };
    const { result, unmount } = renderHook(() => useTalk({ onTalk: async () => {}, onKlick: () => {}, inspelare: inspelare(), igenkanning: /** @type {any} */ (igenkanning) }));
    act(() => result.current.direkt());
    await flush();
    act(() => result.current.skickaIn());
    await flush();
    expect(result.current.lage).toBe("skickar");
    expect(igenkanning.kasta).not.toHaveBeenCalled();
    unmount();
    // Röd före rättelsen: kasta anropades bara om läget var haller eller lyssnar.
    expect(igenkanning.kasta).toHaveBeenCalledTimes(1);
  });

  it("⛔ i läget hört, när det sagda står med valen", async () => {
    const igenkanning = { starta: vi.fn(), stoppa: vi.fn(async () => "boka rep"), kasta: vi.fn() };
    const { result, unmount } = renderHook(() => useTalk({ onTalk: async () => {}, onKlick: () => {}, onAgent: async () => {}, inspelare: inspelare(), igenkanning: /** @type {any} */ (igenkanning) }));
    act(() => result.current.direkt());
    await flush();
    act(() => result.current.skickaIn());
    await flush();
    expect(result.current.lage).toBe("hort");
    unmount();
    expect(igenkanning.kasta).toHaveBeenCalledTimes(1);
  });
});
