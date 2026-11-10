import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { useTalk } from "../components/OpsTalk.jsx";
import { IGENKANNING_VANTA_MS, webblasarensIgenkanning } from "../lib/talk.js";
import { registreraFelmottagare } from "../lib/felrapport.js";
import { glomForraOmgangen } from "../lib/talklogg.js";

/*
 * Andra omgången i TALK på en iPhone, och raden den lämnar (cllp/lifehub.app#253, ramverket 0.213.0).
 *
 * CP 2026-11-10 09.10, iPhone iOS 18.7, appen v1.0.1158: första inspelningen gick fram och agenten svarade med en fråga. Andra inspelningen
 * gav "Talet kunde inte skrivas ut medan du pratade." Felkanalen fick EN rad: "Taligenkänningen föll: aborted, kod=aborted", utan omgången,
 * utan om igenkänningen startade och utan något om vem som avbröt. Försöket 09.40 lämnade ingen rad alls.
 *
 * Vad som är mätt i koden, och som proven här återger:
 * - Igenkänningen rapporterade `igenkanning` med bara `kod`, och `useTalk` skickade `ingen-text` (med omgången) direkt efter. Appens
 *   felmottagare skriver med en transaktion och returnerar löftet, och `rapporteraFel` håller mottagaren tills det avgjorts: den andra raden
 *   gick bara till konsolen. Det är exakt radens form från iPhonen.
 * - Vår egen `abort()` när `stoppa` gav upp lät igenkännaren gälla, så ett sent `aborted` från den rapporterades som att webbläsaren föll.
 * - Två vägar där omgången föll utan att något rapporterades alls: mikrofonen upptagen av en annan instans, och en start som avvisades.
 *
 * ⛔ DET HÄR ÄR EN MODELL AV WEBKIT, INTE EN iPHONE. `WebKitSR` följer det som står i WebKits källkod (main, läst 2026-11-10):
 * `abort()` på en igenkännare som lyssnar ger `end` och sedan `error: aborted` (`speechRecognitionTaskWasCancelled` och sedan
 * `didFinishSuccessfully:NO`, `WebSpeechRecognizerTask.mm`), och en uppgift som Apple avslutar utan framgång ger `error: aborted` och sedan
 * `end`. VARFÖR telefonens andra omgång avslutades är inte mätt: det är det `avbrot`, `msSedanStart` och `loggIgk` i raden ska avgöra.
 */

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.2 Mobile/15E148 Safari/604.1";
const fasta = { idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };
const flush = () =>
  act(async () => {
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
  });
const falt = () => screen.queryByRole("dialog", { name: "TALK" });
const huvudMikrofon = () => /** @type {HTMLElement} */ (document.querySelector("[data-talk-huvud]"));
const klar = async () => {
  fireEvent.click(screen.getByRole("button", { name: /^(Klar|Done)/ }));
  await flush();
};

/** @type {WebKitSR[]} */
let igenkannare = [];
/** En igenkännare med WebKits ordning för stopp, avbrott och misslyckad uppgift. */
class WebKitSR {
  constructor() {
    this.lang = "";
    this.lage = "inaktiv";
    /** @type {any} */ this.onresult = null;
    /** @type {any} */ this.onerror = null;
    /** @type {any} */ this.onend = null;
    /** @type {any} */ this.onstart = null;
    /** Sant: `stop()` ger aldrig `end` (Apples sista besked dröjer). */
    this.stoppHanger = false;
    igenkannare.push(this);
  }
  start() {
    if (this.lage !== "inaktiv") throw Object.assign(new Error("Recognition is being started or already started"), { name: "InvalidStateError" });
    this.lage = "lyssnar";
    queueMicrotask(() => this.onstart?.());
  }
  stop() {
    if (this.lage !== "lyssnar") return;
    this.lage = "stoppar";
    if (this.stoppHanger) return;
    queueMicrotask(() => this.slut());
  }
  /** WebKit: avbruten uppgift ger `end` och sedan `aborted`. */
  abort() {
    if (this.lage === "inaktiv" || this.lage === "avbryter") return;
    this.lage = "avbryter";
    queueMicrotask(() => {
      this.slut();
      this.onerror?.({ error: "aborted" });
    });
  }
  /** Apple avslutar uppgiften utan framgång, utan att sidan bett om det: `aborted` och sedan `end`. */
  webblasarenAvbryter() {
    this.lage = "inaktiv";
    this.onerror?.({ error: "aborted" });
    this.onend?.();
  }
  slut() {
    this.lage = "inaktiv";
    this.onend?.();
  }
}
/** Personen säger något: den senaste igenkännaren hör det. @param {string} t */
const sag = (t) => act(() => igenkannare[igenkannare.length - 1].onresult({ resultIndex: 0, results: [Object.assign([{ transcript: t }], { isFinal: true })] }));

/**
 * Appens felmottagare i den form som räknas: den skriver asynkront (en transaktion i Firestore) och returnerar löftet, som
 * `web/src/data/felrapporter.js` gör. `rader` är det som faktiskt skrevs.
 */
function asynkronMottagare() {
  /** @type {Array<Record<string, any>>} */
  const rader = [];
  const m = {
    fanga: (/** @type {unknown} */ fel, /** @type {any} */ sammanhang) => {
      rader.push({ meddelande: fel instanceof Error ? fel.message : String(fel), ...(sammanhang ?? {}) });
      return new Promise((klart) => setTimeout(klart, 300));
    },
    satt: () => {},
  };
  return { m, rader };
}

describe("⛔ två omgångar med agentens svar emellan: andra omgångens fel lämnar EN hel rad (lifehub.app#253)", () => {
  /** @type {import("vitest").MockInstance} */
  let ua;
  /** @type {import("vitest").MockInstance} */
  let konsol;
  /** @type {() => void} */
  let avregistrera = () => {};
  beforeEach(() => {
    vi.useFakeTimers();
    igenkannare = [];
    glomForraOmgangen();
    /** @type {any} */ (globalThis).webkitSpeechRecognition = WebKitSR;
    ua = vi.spyOn(navigator, "userAgent", "get").mockReturnValue(IPHONE);
    konsol = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    avregistrera();
    vi.useRealTimers();
    ua.mockRestore();
    konsol.mockRestore();
    delete (/** @type {any} */ (globalThis).webkitSpeechRecognition);
    cleanup();
  });

  it("⛔ webbläsaren avbryter andra omgången: raden bär omgång 2, vem som avbröt, att den startade, förra omgången och loggen; inget tomt anrop; nästa tryck fungerar", async () => {
    const { m, rader } = asynkronMottagare();
    avregistrera = registreraFelmottagare(m);
    const onAgent = vi.fn(async () => {});
    const t = { onTalk: vi.fn(async () => {}), inspelare: { starta: vi.fn(), stoppa: vi.fn(), kasta: vi.fn(), niva: () => 0 }, igenkanning: true, onAgent };
    render(
      <OpsAppShell brand="Ops" fasta={fasta} moduler={[]} activeHref="/" talk={t}>
        <p>innehåll</p>
      </OpsAppShell>,
    );

    // Omgång 1: personen pratar, Klar, Agent. Agenten svarar med en fråga (appens sak, utanför fältet).
    fireEvent.click(huvudMikrofon());
    await flush();
    sag("Hej agenten är du igång");
    await klar();
    fireEvent.click(screen.getByRole("button", { name: "Agent" }));
    await flush();
    expect(onAgent).toHaveBeenCalledWith("Hej agenten är du igång");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    // Omgång 2: personen trycker igen och börjar svara. Webbläsaren avslutar igenkännaren av sig själv.
    fireEvent.click(huvudMikrofon());
    await flush();
    expect(igenkannare).toHaveLength(2);
    act(() => igenkannare[1].webblasarenAvbryter());
    await flush();
    expect(/** @type {HTMLElement} */ (falt()).getAttribute("data-lage")).toBe("fel");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // ⛔ EN rad, och den räcker ensam. Förut: `{ kod: "aborted" }` och inget mer, och `ingen-text` bara i konsolen.
    const talkrader = rader.filter((r) => r.yta === "talk" || r.yta === "OpsTalk");
    expect(talkrader.map((r) => r.steg)).toEqual(["igenkanning"]);
    expect(talkrader[0]).toMatchObject({
      meddelande: "Taligenkänningen föll: aborted",
      kod: "aborted",
      avbrot: "webblasaren",
      omgang: 2,
      igenkanningStartade: true,
      igenkanningStartHandelse: true,
      baraIgenkanning: true,
      medVal: true,
    });
    expect(talkrader[0].forra).toMatch(/^igenkanning:text:\d+$/);
    expect(talkrader[0].loggIgk).toMatch(/^anrop:\d+\.start:\d+\.error-aborted:\d+/);
    expect(typeof talkrader[0].msSedanStart).toBe("number");
    // Inget föll bara till konsolen medan mottagaren skrev (`rapporteraFel` säger det med den här raden).
    expect(konsol.mock.calls.some((c) => String(c[0]).includes("medan felmottagaren hanterade"))).toBe(false);

    // ⛔ Inget tomt anrop: agenten fick bara omgång 1:s text.
    expect(onAgent).toHaveBeenCalledTimes(1);
    expect(t.onTalk).not.toHaveBeenCalled();

    // ⛔ Nästa tryck på mikrofonen fungerar: en ny igenkännare, texten kommer och Agent lämnar den.
    fireEvent.click(huvudMikrofon());
    await flush();
    expect(igenkannare).toHaveLength(3);
    sag("ja på torsdag");
    await klar();
    fireEvent.click(screen.getByRole("button", { name: "Agent" }));
    await flush();
    expect(onAgent).toHaveBeenLastCalledWith("ja på torsdag");
    expect(onAgent.mock.calls.every((c) => typeof c[0] === "string" && c[0].trim() !== "")).toBe(true);
  });

  it("⛔ när stoppa ger upp är vårt eget abort inget fel från webbläsaren: ingen rad om igenkänningen, bara ingen-text med vantan-slut", async () => {
    const { m, rader } = asynkronMottagare();
    avregistrera = registreraFelmottagare(m);
    const onAgent = vi.fn(async () => {});
    const hook = renderHook(() => useTalk({ onTalk: async () => {}, onKlick: () => {}, onAgent, igenkanning: true }));
    act(() => hook.result.current.direkt());
    await flush();
    igenkannare[0].stoppHanger = true;
    await act(async () => hook.result.current.skickaIn());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(IGENKANNING_VANTA_MS + 10);
    });
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    const talkrader = rader.filter((r) => r.yta === "talk" || r.yta === "OpsTalk");
    expect(talkrader.map((r) => r.steg)).toEqual(["ingen-text"]);
    expect(talkrader[0].loggIgk).toMatch(/vantan-slut/);
    expect(talkrader[0].igenkanningAvbrot).toBe(null);
    expect(onAgent).not.toHaveBeenCalled();
  });
});

describe("⛔ igenkänningen säger vem som avbröt (avbrot)", () => {
  it("webbläsaren och ramverkets stopp skiljs åt, och sammanhanget följer med utan att kunna skriva över koden", () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      /** @type {WebKitSR[]} */
      const lista = [];
      class SR extends WebKitSR {
        constructor() {
          super();
          lista.push(this);
        }
      }
      let t = 0;
      // Tiden står still: inga väntetider löper ut, och ingen omstart sker av sig själv (`vanta` samlar bara).
      /** @type {Array<() => void>} */
      const vantande = [];
      const g = /** @type {any} */ (webblasarensIgenkanning({ SpeechRecognition: SR, nu: () => t, setTimeout: /** @type {any} */ ((/** @type {() => void} */ f) => vantande.push(f)) }));
      const rapporter = () => konsol.mock.calls.filter((c) => c[2]?.steg === "igenkanning").map((c) => c[2]);

      // Webbläsaren avbryter utan att någon bett om det.
      g.starta({ sprak: "sv-SE", onText: () => {}, onFel: () => {}, sammanhang: () => ({ omgang: 7, kod: "skrivs-inte-over" }) });
      t = 2500;
      lista[0].webblasarenAvbryter();
      expect(rapporter().at(-1)).toMatchObject({ kod: "aborted", avbrot: "webblasaren", omgang: 7, msSedanStart: 2500, igenkanningStartade: true });
      expect(g.diagnos().avbrot).toBe("webblasaren");

      // Ramverket bad om stopp, och webbläsaren svarade med ett fel i stället för ett slut.
      g.starta({ sprak: "sv-SE", onText: () => {}, onFel: () => {} });
      lista[1].stoppHanger = true;
      void g.stoppa();
      lista[1].onerror({ error: "aborted" });
      expect(rapporter().at(-1)).toMatchObject({ kod: "aborted", avbrot: "egen:stopp" });

      // Ett kast i sammanhanget fäller inte rapporten.
      g.starta({ sprak: "sv-SE", onText: () => {}, onFel: () => {}, sammanhang: () => { throw new Error("x"); } });
      lista[2].webblasarenAvbryter();
      expect(rapporter().at(-1)).toMatchObject({ kod: "aborted", avbrot: "webblasaren", sammanhangFoll: true });
    } finally {
      konsol.mockRestore();
    }
  });
});

describe("⛔ omgångar som föll utan en rad (CP:s försök 09.40 lämnade ingen)", () => {
  beforeEach(() => glomForraOmgangen());
  afterEach(() => cleanup());

  it("mikrofonen upptagen av en annan instans rapporteras", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const insp = () => ({ starta: vi.fn(() => Promise.resolve()), stoppa: vi.fn(), kasta: vi.fn(), niva: () => 0 });
      const forsta = renderHook(() => useTalk({ onTalk: async () => {}, onKlick: () => {}, inspelare: /** @type {any} */ (insp()), igenkanning: false }));
      const andra = renderHook(() => useTalk({ onTalk: async () => {}, onKlick: () => {}, inspelare: /** @type {any} */ (insp()), igenkanning: false }));
      act(() => forsta.result.current.direkt());
      await flush();
      act(() => andra.result.current.direkt());
      await flush();
      expect(andra.result.current.lage).toBe("fel");
      const rapport = konsol.mock.calls.filter((c) => c[2]?.steg === "upptagen").map((c) => c[2]);
      expect(rapport).toHaveLength(1);
      expect(rapport[0]).toMatchObject({ yta: "OpsTalk", omgang: 0, baraIgenkanning: false });
      act(() => forsta.result.current.avbryt());
    } finally {
      konsol.mockRestore();
    }
  });

  it("en start som avvisas (mikrofonen gick inte att öppna) rapporteras med omgången", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const upptagen = Object.assign(new Error("Could not start audio source"), { name: "NotReadableError" });
      const insp = { starta: vi.fn(() => Promise.reject(upptagen)), stoppa: vi.fn(), kasta: vi.fn(), niva: () => 0 };
      const hook = renderHook(() => useTalk({ onTalk: async () => {}, onKlick: () => {}, inspelare: /** @type {any} */ (insp), igenkanning: false }));
      act(() => hook.result.current.direkt());
      await flush();
      expect(hook.result.current.lage).toBe("fel");
      const rapport = konsol.mock.calls.filter((c) => c[2]?.steg === "starta");
      expect(rapport).toHaveLength(1);
      expect(rapport[0][1]).toBe(upptagen);
      expect(rapport[0][2]).toMatchObject({ yta: "OpsTalk", omgang: 1, forra: "ingen" });
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ en nekad mikrofon (NotAllowedError, personens val) rapporteras inte som fel, men fältet säger det (granskningen av 0.213.0)", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const nekad = Object.assign(new Error("Permission denied"), { name: "NotAllowedError" });
      const insp = { starta: vi.fn(() => Promise.reject(nekad)), stoppa: vi.fn(), kasta: vi.fn(), niva: () => 0 };
      const hook = renderHook(() => useTalk({ onTalk: async () => {}, onKlick: () => {}, inspelare: /** @type {any} */ (insp), igenkanning: false }));
      act(() => hook.result.current.direkt());
      await flush();
      expect(hook.result.current.lage).toBe("fel");
      expect(konsol.mock.calls.filter((c) => c[2]?.steg === "starta")).toHaveLength(0);
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ en egen igenkänning från appen som faller i en omgång utan inspelare lämnar en rad (granskningen av 0.213.0)", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    const ua = vi.spyOn(navigator, "userAgent", "get").mockReturnValue(IPHONE);
    try {
      /** @type {((kod: string) => void) | undefined} */
      let onFel;
      const egen = {
        starta: vi.fn((/** @type {any} */ val) => {
          onFel = val.onFel;
        }),
        stoppa: vi.fn(async () => ""),
        kasta: vi.fn(),
      };
      const hook = renderHook(() => useTalk({ onTalk: async () => {}, onKlick: () => {}, onAgent: async () => {}, igenkanning: /** @type {any} */ (egen) }));
      act(() => hook.result.current.direkt());
      await flush();
      expect(egen.starta).toHaveBeenCalledTimes(1);
      act(() => onFel?.("network"));
      await flush();
      const rapport = konsol.mock.calls.filter((c) => c[2]?.steg === "igenkanning").map((c) => c[2]);
      expect(rapport).toHaveLength(1);
      expect(rapport[0]).toMatchObject({ yta: "OpsTalk", kod: "network", egenIgenkanning: true, omgang: 1, baraIgenkanning: true, medVal: true });
    } finally {
      ua.mockRestore();
      konsol.mockRestore();
    }
  });
});
