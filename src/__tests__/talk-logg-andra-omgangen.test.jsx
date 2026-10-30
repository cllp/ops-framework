import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useTalk } from "../components/OpsTalk.jsx";
import { webblasarensIgenkanning, webblasarensInspelare } from "../lib/talk.js";
import { forraOmgangen, glomForraOmgangen, LOGG_LANGD, noteraOmgangsslut, skapaOmgangslogg } from "../lib/talklogg.js";

/*
 * Andra omgången på en iPhone (cllp/lifehub.app#253, ramverket 0.155.0).
 *
 * CP mätte 2026-10-29 21:09 på en riktig iPhone: första inspelningen (taligenkänning i skalets TALK, vald Agent) fungerade och agenten svarade.
 * Nästa omgång, direkt efter svaret, gav "Mikrofonen gav inget ljud, och inget hördes som text", och nästa tryck (Spela in igen) fungerade, liksom
 * alla efter det. Den texten finns bara i den väg där en INSPELARE kört (`tomt-ljud`): en omgång med bara igenkänningen ger i stället "Talet kunde
 * inte skrivas ut medan du pratade". Andra omgången var alltså en inspelning, i en annan `useTalk`-instans än den första (chattens skrivfält, inte skalets TALK).
 *
 * ⛔ DET HÄR ÄR MODELLER, INTE EN iPHONE. Det som provas är ramverkets kod mot den regel hypotesen säger att WebKit följer, och loggen som ska
 * avgöra saken ur nästa mätning. Regeln mot Apple är inte mätt: `skapaOmgangslogg` och felrapportens `loggInsp`, `loggIgk` och `forra` finns just för det.
 */

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const flush = () =>
  act(async () => {
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
  });

describe("skapaOmgangslogg", () => {
  it("noterar namn och tid, räknar upprepningar och bär aldrig annat än namn, koder och tider", () => {
    let t = 1000;
    const logg = skapaOmgangslogg({ nu: () => t });
    logg.notera("anrop");
    t = 1212;
    logg.notera("audiostart");
    t = 1400;
    logg.notera("result");
    t = 1500;
    logg.notera("result");
    t = 1600;
    logg.notera("result");
    t = 3012;
    logg.notera("error", "no-speech");
    expect(logg.text()).toBe("anrop:0.audiostart:212.result:400x3.error-no-speech:2012");
    // Ett namn rensas till [a-z0-9-]: en mening eller en text kan inte komma med.
    logg.notera("Hej, jag heter Anna!");
    expect(logg.text()).not.toMatch(/[A-Z ,!]/);
  });

  it("⛔ tom logg är en tom sträng (ett svar, inte ett utelämnat fält), och en lång logg kapas bakifrån med antalet som föll bort", () => {
    expect(skapaOmgangslogg().text()).toBe("");
    const logg = skapaOmgangslogg({ nu: () => 0 });
    for (let i = 0; i < 39; i += 1) logg.notera(`handelse-nummer-${i}`);
    const ut = logg.text();
    expect(ut.length).toBeLessThanOrEqual(LOGG_LANGD);
    expect(ut.startsWith("handelse-nummer-0:0.handelse-nummer-1:0")).toBe(true);
    expect(ut).toMatch(/\.\+\d+$/);
  });
});

describe("⛔ inspelaren på WebKit: ingen ljudkontext efter att mikrofonen öppnats (hypotes, se webblasarensInspelare)", () => {
  /**
   * En falsk telefon som följer hypotesens regel: en ljudkontext som skapas MEDAN en inspelning rullar tystar strömmens spår, och en tyst ström ger
   * inga bitar. `pumpa()` är tiden som går: en inspelare som rullar på en levande ström lämnar en bit.
   */
  function falskTelefon() {
    /** @type {any[]} */
    const spar = [];
    const kontexter = { skapade: 0 };
    class Spar {
      constructor() {
        this.muted = false;
        this.readyState = "live";
        this.enabled = true;
        /** @type {Record<string, Array<() => void>>} */
        this.lyssnare = {};
        spar.push(this);
      }
      addEventListener(/** @type {string} */ typ, /** @type {() => void} */ f) {
        (this.lyssnare[typ] ??= []).push(f);
      }
      sag(/** @type {string} */ typ) {
        for (const f of this.lyssnare[typ] ?? []) f();
      }
      stop() {
        this.readyState = "ended";
      }
    }
    const mediaDevices = {
      getUserMedia: vi.fn(async () => {
        const t = new Spar();
        return { getTracks: () => [t], getAudioTracks: () => [t] };
      }),
    };
    /** @type {any[]} */
    const inspelare = [];
    class MR {
      static isTypeSupported() {
        return true;
      }
      constructor(/** @type {any} */ strom) {
        this.strom = strom;
        this.state = "inactive";
        this.mimeType = "audio/mp4";
        /** @type {any} */ this.ondataavailable = null;
        /** @type {any} */ this.onstop = null;
        inspelare.push(this);
      }
      start() {
        this.state = "recording";
      }
      pumpa() {
        const levande = this.strom.getAudioTracks().every((/** @type {any} */ t) => t.readyState === "live" && !t.muted);
        if (this.state === "recording" && levande) this.ondataavailable?.({ data: new Blob(["ljud"], { type: "audio/mp4" }) });
        else if (this.state === "recording") this.ondataavailable?.({ data: new Blob([]) });
      }
      stop() {
        this.pumpa();
        this.state = "inactive";
        queueMicrotask(() => this.onstop?.());
      }
    }
    class AC {
      constructor() {
        kontexter.skapade += 1;
        this.state = "running";
        // Hypotesens regel: en ljudkontext som skapas medan en inspelning rullar byter ljudpass och tystar spåren.
        for (const t of spar) {
          if (t.readyState === "live") {
            t.muted = true;
            t.sag("mute");
          }
        }
      }
      createMediaStreamSource() {
        return { connect() {} };
      }
      createAnalyser() {
        return { fftSize: 0, frequencyBinCount: 8, getByteTimeDomainData() {} };
      }
      close() {
        return Promise.resolve();
      }
    }
    return { spar, kontexter, mediaDevices, MR, AC, pumpa: () => inspelare.forEach((r) => r.pumpa()) };
  }

  /** @param {string} userAgent */
  async function enOmgang(userAgent) {
    const tel = falskTelefon();
    let t = 0;
    const insp = webblasarensInspelare({ mediaDevices: /** @type {any} */ (tel.mediaDevices), MediaRecorder: /** @type {any} */ (tel.MR), AudioContext: /** @type {any} */ (tel.AC), userAgent, nu: () => t, setTimeout: () => 0 });
    await insp.starta();
    t = 300;
    tel.pumpa();
    t = 600;
    tel.pumpa();
    t = 900;
    const ut = await insp.stoppa();
    return { tel, ut };
  }

  it("på WebKit skapas ingen ljudkontext, spåren hålls vid liv och ljudet kommer fram, och loggen säger ctx-utesluten", async () => {
    const { tel, ut } = await enOmgang(IPHONE);
    expect(tel.kontexter.skapade).toBe(0);
    expect(ut.blob.size).toBeGreaterThan(0);
    expect(ut.diagnos).toMatchObject({ tystVidStopp: false, ljudkontextVidStart: "ingen", ljudkontextVidStopp: "ingen" });
    expect(/** @type {any} */ (ut.diagnos).bitar).toBeGreaterThan(0);
    expect(/** @type {any} */ (ut.diagnos).logg).toBe("anrop:0.gum:0.rec:0.ctx-utesluten:0.data:300x3.stoppbegard:900.stop:900");
  });

  it("utanför WebKit (Chrome) är det som förut: ljudkontexten skapas, och under hypotesens regel dör strömmen, vilket loggen visar som mute före första biten med innehåll", async () => {
    const { tel, ut } = await enOmgang(CHROME);
    expect(tel.kontexter.skapade).toBe(1);
    // Modellens utfall utan lagningen: spåret tystades av ljudkontexten och inspelaren lämnade bara tomma bitar.
    expect(ut.blob.size).toBe(0);
    expect(/** @type {any} */ (ut.diagnos).bitar).toBe(0);
    expect(/** @type {any} */ (ut.diagnos).tystVidStopp).toBe(true);
    const logg = /** @type {string} */ (/** @type {any} */ (ut.diagnos).logg);
    expect(logg).toBe("anrop:0.gum:0.rec:0.mute:0.ctx-running:0.data0:300x3.stoppbegard:900.stop:900");
    expect(logg).not.toContain("ctx-utesluten");
  });
});

describe("igenkänningens händelseförlopp i andra omgången", () => {
  /**
   * En igenkänning som, till skillnad från de enklare i de andra proven, tar emot `addEventListener` som en riktig: de händelser som bara loggas
   * (`audiostart`, `soundstart`, `nomatch`) kommer den vägen.
   */
  class SR {
    constructor() {
      this.lang = "";
      this.continuous = false;
      this.interimResults = false;
      /** @type {any} */ this.onresult = null;
      /** @type {any} */ this.onerror = null;
      /** @type {any} */ this.onend = null;
      /** @type {any} */ this.onstart = null;
      /** @type {Record<string, Array<() => void>>} */
      this.lyssnare = {};
      SR.alla.push(this);
    }
    addEventListener(/** @type {string} */ typ, /** @type {() => void} */ f) {
      (this.lyssnare[typ] ??= []).push(f);
    }
    sag(/** @type {string} */ typ) {
      for (const f of this.lyssnare[typ] ?? []) f();
    }
    start() {}
    stop() {}
    abort() {}
  }
  /** @type {SR[]} */
  SR.alla = [];

  it("⛔ loggen bär händelserna i ordning med tider: audiostart, soundstart, nomatch, felkod och end, och ingenting av det som sades", () => {
    SR.alla = [];
    let t = 5000;
    const igk = /** @type {NonNullable<ReturnType<typeof webblasarensIgenkanning>>} */ (webblasarensIgenkanning({ SpeechRecognition: /** @type {any} */ (SR), nu: () => t, setTimeout: /** @type {any} */ (() => 0) }));
    // Omgång 1 i tråden: en vanlig omgång med text.
    igk.starta({ sprak: "sv-SE", onText: () => {}, onFel: () => {} });
    SR.alla[0].onstart();
    SR.alla[0].onresult({ resultIndex: 0, results: [Object.assign([{ transcript: "hemlig mening" }], { isFinal: true })] });
    // Omgång 2: hela förloppet iPhone ska läsas ur. Klockan nollas av starten.
    t = 20_000;
    igk.starta({ sprak: "sv-SE", onText: () => {}, onFel: () => {} });
    const andra = SR.alla[1];
    t = 20_040;
    andra.onstart();
    t = 20_055;
    andra.sag("audiostart");
    t = 20_410;
    andra.sag("soundstart");
    t = 21_900;
    andra.sag("nomatch");
    t = 23_000;
    andra.onerror({ error: "no-speech" });
    t = 23_012;
    andra.onend();
    const diag = /** @type {any} */ (igk).diagnos();
    expect(diag.logg).toBe("anrop:0.start:40.audiostart:55.soundstart:410.nomatch:1900.error-no-speech:3000.end:3012");
    expect(diag.logg).not.toContain("hemlig");
    expect(diag).toMatchObject({ startade: true, startHandelse: true, felkod: "no-speech" });
  });

  it("⛔ en gammal igenkännare som säger end under nästa omgång syns som gammal-end i den nya loggen", () => {
    SR.alla = [];
    let t = 0;
    const igk = /** @type {NonNullable<ReturnType<typeof webblasarensIgenkanning>>} */ (webblasarensIgenkanning({ SpeechRecognition: /** @type {any} */ (SR), nu: () => t, setTimeout: /** @type {any} */ (() => 0) }));
    igk.starta({ sprak: "sv-SE", onText: () => {}, onFel: () => {} });
    t = 8000;
    igk.starta({ sprak: "sv-SE", onText: () => {}, onFel: () => {} });
    t = 8120;
    SR.alla[0].onend();
    expect(/** @type {any} */ (igk).diagnos().logg).toBe("anrop:0.gammal-end:120");
  });
});

describe("⛔ förra omgången på sidan följer med i felrapporten, också över två useTalk-instanser (skalets TALK, chattens skrivfält)", () => {
  /** @type {any[]} */
  let igenkannare = [];
  class FalskSR {
    constructor() {
      this.lang = "";
      /** @type {any} */ this.onresult = null;
      /** @type {any} */ this.onerror = null;
      /** @type {any} */ this.onend = null;
      /** @type {any} */ this.onstart = null;
      igenkannare.push(this);
    }
    addEventListener() {}
    start() {
      queueMicrotask(() => this.onstart?.());
    }
    stop() {
      queueMicrotask(() => this.onend?.());
    }
    abort() {
      queueMicrotask(() => this.onend?.());
    }
  }
  /** @type {import("vitest").MockInstance} */
  let ua;
  /** @type {import("vitest").MockInstance} */
  let konsol;
  beforeEach(() => {
    igenkannare = [];
    glomForraOmgangen();
    /** @type {any} */ (globalThis).webkitSpeechRecognition = FalskSR;
    ua = vi.spyOn(navigator, "userAgent", "get").mockReturnValue(IPHONE);
    konsol = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    ua.mockRestore();
    konsol.mockRestore();
    delete (/** @type {any} */ (globalThis).webkitSpeechRecognition);
    glomForraOmgangen();
  });

  /** @param {string} steg */
  const rapporter = (steg) => konsol.mock.calls.filter((c) => c[2] && typeof c[2] === "object" && c[2].steg === steg).map((c) => c[2]);

  /** En inspelare som inte får något ur mikrofonen: 0 byte. */
  const tystInspelare = () => ({
    starta: vi.fn(() => Promise.resolve()),
    stoppa: vi.fn(() => Promise.resolve({ blob: new Blob([]), mimeType: "audio/mp4", sekunder: 3, diagnos: { logg: "anrop:0.gum:310.rec:318.mute:900.stoppbegard:6000.stop:6012" } })),
    kasta: vi.fn(),
    niva: () => 0,
  });

  it("första omgången på sidan har ingen förra: fältet säger ingen, det utelämnas inte", async () => {
    const { result } = renderHook(() => useTalk({ onTalk: async () => {}, onKlick: () => {}, inspelare: /** @type {any} */ (tystInspelare()), igenkanning: false }));
    act(() => result.current.direkt());
    await flush();
    await act(async () => result.current.skickaIn());
    await flush();
    const rapport = rapporter("tomt-ljud");
    expect(rapport).toHaveLength(1);
    expect(rapport[0]).toMatchObject({ forra: "ingen", forraLogg: "", loggInsp: "anrop:0.gum:310.rec:318.mute:900.stoppbegard:6000.stop:6012" });
    // Ingen igenkänning kördes, så ingen tom `loggIgk` tar en av appens begränsade platser.
    expect(rapport[0]).not.toHaveProperty("loggIgk");
    // ⛔ Appens felmottagare tar ett begränsat antal nycklar i den ordning de står: det som ska mätas står före det äldre.
    expect(Object.keys(rapport[0]).slice(0, 5)).toEqual(["yta", "steg", "loggInsp", "forra", "forraLogg"]);
  });

  it("⛔ ingen-text när igenkänningen faller bär loggIgk med felkoden och forra, också när det är sidans första omgång", async () => {
    const onAgent = vi.fn(async () => {});
    const skal = renderHook(() => useTalk({ onTalk: async () => {}, onKlick: () => {}, onAgent, inspelare: /** @type {any} */ (tystInspelare()), igenkanning: true }));
    act(() => skal.result.current.direkt());
    await flush();
    act(() => igenkannare[0].onerror({ error: "not-allowed" }));
    await flush();
    const rapport = rapporter("ingen-text");
    expect(rapport).toHaveLength(1);
    expect(rapport[0].forra).toBe("ingen");
    expect(rapport[0].loggIgk).toMatch(/^anrop:\d+\.start:\d+\.error-not-allowed:\d+$/);
    expect(Object.keys(rapport[0]).slice(0, 4)).toEqual(["yta", "steg", "forra", "forraLogg"]);
    // Omgången noteras som fel för nästa.
    expect(forraOmgangen()?.forra).toMatch(/^igenkanning:fel:/);
  });

  it("⛔ skalets omgång (igenkänning, Agent) och sedan chattens inspelning med 0 byte: rapporten bär mekanism, utfall, tid och förra loggen", async () => {
    // Omgång 1: skalets TALK på WebKit, bara igenkänningen, texten kommer, Agent väljs.
    const onAgent = vi.fn(async () => {});
    const skal = renderHook(() => useTalk({ onTalk: async () => {}, onKlick: () => {}, onAgent, inspelare: /** @type {any} */ (tystInspelare()), igenkanning: true }));
    act(() => skal.result.current.direkt());
    await flush();
    expect(igenkannare).toHaveLength(1);
    act(() => igenkannare[0].onresult({ resultIndex: 0, results: [Object.assign([{ transcript: "fråga agenten något" }], { isFinal: true })] }));
    await act(async () => skal.result.current.skickaIn());
    await flush();
    act(() => skal.result.current.agent());
    await flush();
    expect(onAgent).toHaveBeenCalledWith("fråga agenten något");

    // Omgång 2: chattens skrivfält, en ANNAN instans, bara inspelning (ingen igenkänning på WebKit), 0 byte.
    const chatt = renderHook(() => useTalk({ onTalk: async () => {}, onKlick: () => {}, inspelare: /** @type {any} */ (tystInspelare()), igenkanning: false }));
    act(() => chatt.result.current.direkt());
    await flush();
    await act(async () => chatt.result.current.skickaIn());
    await flush();

    const rapport = rapporter("tomt-ljud");
    expect(rapport).toHaveLength(1);
    expect(rapport[0].forra).toMatch(/^igenkanning:text:\d+$/);
    expect(rapport[0].forraLogg).toMatch(/^anrop:\d+\.start:\d+\.result:\d+\.slutlig:\d+\.stopp:\d+\.end:\d+$/);
    expect(rapport[0].forraLogg).not.toContain("agenten");
    expect(rapport[0].loggInsp).toBe("anrop:0.gum:310.rec:318.mute:900.stoppbegard:6000.stop:6012");
  });

  it("⛔ ett kastat fält efter ett lyckat val skriver inte över hur omgången gick, och en avbruten omgång noteras som kastad", async () => {
    const onAgent = vi.fn(async () => {});
    const skal = renderHook(() => useTalk({ onTalk: async () => {}, onKlick: () => {}, onAgent, inspelare: /** @type {any} */ (tystInspelare()), igenkanning: true }));
    act(() => skal.result.current.direkt());
    await flush();
    act(() => igenkannare[0].onresult({ resultIndex: 0, results: [Object.assign([{ transcript: "hej" }], { isFinal: true })] }));
    await act(async () => skal.result.current.skickaIn());
    await flush();
    act(() => skal.result.current.agent());
    await flush();
    expect(forraOmgangen()?.forra).toMatch(/^igenkanning:text:/);

    // En ny omgång som avbryts: kastad.
    act(() => skal.result.current.direkt());
    await flush();
    act(() => skal.result.current.avbryt());
    await flush();
    expect(forraOmgangen()?.forra).toMatch(/^igenkanning:kastad:/);
  });
});

describe("forraOmgangen", () => {
  it("ger null före första omgången, och annars mekanism, utfall och millisekunder sedan den slutade", () => {
    glomForraOmgangen();
    expect(forraOmgangen()).toBeNull();
    noteraOmgangsslut({ mekanism: "inspelning", utfall: "tomt", logg: "anrop:0", vid: 10_000 });
    expect(forraOmgangen(() => 18_400)).toEqual({ forra: "inspelning:tomt:8400", forraLogg: "anrop:0" });
    glomForraOmgangen();
  });
});
