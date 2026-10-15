import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsAuthProvider } from "../auth/auth.jsx";
import { TALK_INGET_LJUD, webblasarensIgenkanning, webblasarensInspelare } from "../lib/talk.js";

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
      expect(sammanhang).toMatchObject({ yta: "OpsTalk", tystVidStart: true, omhamtad: true, bitar: 0 });
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
    } finally {
      konsol.mockRestore();
    }
  });
});
