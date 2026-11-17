import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { talkNasta } from "../lib/talk.js";
import { ROST_INGET_TAL_MS, ROST_LAS_START_MS, ROST_MAX_VARV, ROST_SVAR_MAX_MS, ROST_TYSTNAD_MS, UPPLASNING_NYCKEL, arKlarfras, samtalssvar, talkrostUr, vidareISamtal, webblasarensUpplasning } from "../lib/talkrost.js";
import { OpsSamtal } from "../components/OpsMeddelanden.jsx";
import { createSamtalskalla } from "../data/samtalskalla.js";
import { levandeKalla } from "./levandeKalla.js";

/*
 * TALK pratar tillbaka (cllp/lifehub.app#870, skiva 4). Robs första möte med LifeHub, punkt 12: "agenten tar vid direkt tills man är klar
 * och vill gå vidare." CP sade kör 2026-11-17.
 *
 * ⛔ UPPLÄSNINGEN OCH IGENKÄNNINGEN ÄR FALSKA OCH INJICERADE (regel 4): uppläsningen är ett objekt vars `las` provet själv avgör, och
 * igenkänningen ger text genom samma `onText` som webbläsarens. Proven går genom skalet, så att vägen från appens `talk` till fältet provas.
 */

/** En inspelare utan mikrofon. */
function falskInspelare() {
  return {
    starta: vi.fn(() => Promise.resolve()),
    stoppa: vi.fn(() => Promise.resolve({ blob: new Blob(["ljud"], { type: "audio/webm" }), mimeType: "audio/webm", sekunder: 2 })),
    kasta: vi.fn(),
    niva: () => 0.5,
  };
}

/**
 * En igenkänning som provet pratar i: `saga(text)` skickar texten genom `onText`, och `stoppa` ger det som senast sades i omgången.
 * Första omgången hör `forsta` utan att provet säger något, som `talk-samtalet`.
 * @param {string} forsta
 */
function falskIgenkanning(forsta) {
  /** @type {((t: string) => void) | null} */
  let onText = null;
  let senast = forsta;
  const g = {
    starta: vi.fn((/** @type {{ onText: (t: string) => void }} */ o) => {
      onText = o.onText;
    }),
    stoppa: vi.fn(() => {
      const t = senast;
      senast = "";
      return Promise.resolve(t);
    }),
    kasta: vi.fn(),
    /** @param {string} t */
    saga: (t) => {
      senast = t;
      onText?.(t);
    },
  };
  return g;
}

/** En uppläsning där provet avgör när den är klar: `pagar` är den som pågår. */
function falskUpplasning() {
  /** @type {{ losa: () => void, avvisa: (e: Error) => void, text: string, sprak: string } | null} */
  let pagar = null;
  const u = {
    las: vi.fn((/** @type {string} */ text, /** @type {{ sprak: string }} */ val) => new Promise((losa, avvisa) => {
      pagar = { losa: () => losa(undefined), avvisa, text, sprak: val.sprak };
    })),
    stoppa: vi.fn(),
    forbered: vi.fn(),
    pagar: () => pagar,
  };
  return u;
}

/**
 * Ett samtal med agenten i appen: varje svar är nästa ur `svaren`, och `vidare` ger ett nytt samtal.
 * @param {string[]} svaren
 */
function falsktSamtal(svaren) {
  let i = 0;
  const vidare = vi.fn(async () => rost());
  const svar = vi.fn(async () => svaren[Math.min(i++, svaren.length - 1)]);
  const rost = () => ({ svar, vidare });
  return { rost, svar, vidare };
}

const fasta = { idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };
const flush = () => act(async () => {});
const tick = (/** @type {number} */ ms) => act(async () => {
  await vi.advanceTimersByTimeAsync(ms);
});
const falt = () => screen.queryByRole("dialog", { name: "TALK" });
const lage = () => falt()?.getAttribute("data-lage") ?? "vila";
const rostSteg = () => document.querySelector("[data-talk-rost]")?.getAttribute("data-talk-rost") ?? null;
const huvudMikrofon = () => /** @type {HTMLElement} */ (document.querySelector("[data-talk-huvud]"));

/** @param {{ talk?: any, sprak?: string, igenkanning?: any, upplasning?: any }} [val] */
function Skal({ talk = {}, sprak, igenkanning, upplasning } = {}) {
  const t = { onTalk: vi.fn(async () => {}), onMeddelande: vi.fn(), inspelare: falskInspelare(), igenkanning, upplasning, ...talk };
  const skal = (
    <OpsAppShell brand="Ops" fasta={fasta} moduler={[]} activeHref="/" talk={t}>
      <p>innehåll</p>
    </OpsAppShell>
  );
  render(sprak ? <OpsSprakProvider sprak={sprak}>{skal}</OpsSprakProvider> : skal);
  return t;
}

/** Pratar in, trycker Klar och väljer Agent. */
async function tillAgenten() {
  fireEvent.click(huvudMikrofon());
  await flush();
  fireEvent.click(screen.getByRole("button", { name: /^(Klar|Done)/ }));
  await flush();
  fireEvent.click(screen.getByRole("button", { name: "Agent" }));
  await flush();
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("TALK pratar tillbaka genom skalet", () => {
  it("⛔ svaret läses upp, mikrofonen lyssnar igen, det sagda går till vidare utan meny, och 'tack' avslutar", async () => {
    const igk = falskIgenkanning("Hur långt är det till Visby?");
    const u = falskUpplasning();
    const s = falsktSamtal(["Det är 200 kilometer.", "Färjan går klockan nio."]);
    const onAgent = vi.fn(async () => s.rost());
    const t = Skal({ talk: { onAgent }, igenkanning: igk, upplasning: u });
    await tillAgenten();
    expect(onAgent).toHaveBeenCalledWith("Hur långt är det till Visby?");
    // ⛔ Låst upp i trycket, före svaret (hypotesen om iOS).
    expect(u.forbered).toHaveBeenCalledTimes(1);
    expect(lage()).toBe("rost");
    expect(u.las).toHaveBeenCalledWith("Det är 200 kilometer.", { sprak: "sv-SE" });
    expect(rostSteg()).toBe("laser");
    expect(screen.getByText("Läser upp…")).toBeTruthy();
    const starterFore = t.inspelare.starta.mock.calls.length;
    await act(async () => u.pagar()?.losa());
    await flush();
    expect(lage()).toBe("lyssnar");
    expect(t.inspelare.starta.mock.calls.length).toBe(starterFore + 1);
    expect(rostSteg()).toBe("lyssnar");
    act(() => igk.saga("Och färjan i morgon?"));
    await tick(ROST_TYSTNAD_MS - 100);
    expect(s.vidare).not.toHaveBeenCalled();
    await tick(200);
    await flush();
    expect(s.vidare).toHaveBeenCalledWith("Och färjan i morgon?");
    expect(document.querySelector("[data-talk-val]")).toBeNull();
    expect(u.las).toHaveBeenLastCalledWith("Färjan går klockan nio.", { sprak: "sv-SE" });
    await act(async () => u.pagar()?.losa());
    await flush();
    act(() => igk.saga("Tack, det var allt."));
    await tick(ROST_TYSTNAD_MS + 100);
    await flush();
    expect(s.vidare).toHaveBeenCalledTimes(1);
    expect(falt()).toBeNull();
    expect(t.onTalk).not.toHaveBeenCalled();
  });

  it("på engelska läses svaret upp med en-US", async () => {
    const u = falskUpplasning();
    const s = falsktSamtal(["It is 200 kilometres."]);
    Skal({ sprak: "en", talk: { onAgent: async () => s.rost() }, igenkanning: falskIgenkanning("How far to Visby?"), upplasning: u });
    await tillAgenten();
    expect(u.las).toHaveBeenCalledWith("It is 200 kilometres.", { sprak: "en-US" });
    expect(screen.getByText("Reading aloud…")).toBeTruthy();
  });

  it("⛔ Klar medan det läses upp stoppar uppläsningen och stänger, och en sen uppläsning startar ingen mikrofon", async () => {
    const u = falskUpplasning();
    const s = falsktSamtal(["Ett långt svar."]);
    const t = Skal({ talk: { onAgent: async () => s.rost() }, igenkanning: falskIgenkanning("Fråga"), upplasning: u });
    await tillAgenten();
    const starter = t.inspelare.starta.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Klar, avsluta samtalet" }));
    await flush();
    expect(u.stoppa).toHaveBeenCalled();
    expect(falt()).toBeNull();
    await act(async () => u.pagar()?.losa());
    await flush();
    expect(t.inspelare.starta.mock.calls.length).toBe(starter);
    expect(falt()).toBeNull();
  });

  it("⛔ Stoppa uppläsningen tystar direkt och lyssnar, och en sen uppläsning startar inte en andra omgång", async () => {
    const u = falskUpplasning();
    const s = falsktSamtal(["Ett långt svar."]);
    const t = Skal({ talk: { onAgent: async () => s.rost() }, igenkanning: falskIgenkanning("Fråga"), upplasning: u });
    await tillAgenten();
    const starter = t.inspelare.starta.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Stoppa uppläsningen" }));
    await flush();
    expect(u.stoppa).toHaveBeenCalled();
    expect(lage()).toBe("lyssnar");
    expect(t.inspelare.starta.mock.calls.length).toBe(starter + 1);
    await act(async () => u.pagar()?.losa());
    await flush();
    expect(t.inspelare.starta.mock.calls.length).toBe(starter + 1);
  });

  it("⛔ väntan syns: Väntar på svaret… medan svaret dröjer, och efter taket ett lugnt besked i stället för en evig väntan", async () => {
    const u = falskUpplasning();
    /** @type {AbortSignal | undefined} */
    let signal;
    const svar = vi.fn((/** @type {{ signal?: AbortSignal } | undefined} */ opt) => {
      signal = opt?.signal;
      return new Promise(() => {});
    });
    Skal({ talk: { onAgent: async () => ({ svar, vidare: vi.fn() }) }, igenkanning: falskIgenkanning("Fråga"), upplasning: u });
    await tillAgenten();
    expect(rostSteg()).toBe("vantar");
    expect(screen.getByText("Väntar på svaret…")).toBeTruthy();
    expect(signal?.aborted).toBe(false);
    await tick(ROST_SVAR_MAX_MS);
    await flush();
    // ⛔ Väntan är över, så källan får stänga sin prenumeration (`samtalssvar`). Utan avbrottet levde den kvar.
    expect(signal?.aborted).toBe(true);
    expect(lage()).toBe("sparat");
    expect(screen.getByText("Svaret dröjer. Det kommer som text i chatten.")).toBeTruthy();
    expect(u.las).not.toHaveBeenCalled();
  });

  it("⛔ en uppläsning som faller: svaret visas, en rad säger varför, och samtalet fortsätter som text", async () => {
    const igk = falskIgenkanning("Fråga");
    const u = falskUpplasning();
    const s = falsktSamtal(["Första svaret", "Andra svaret"]);
    Skal({ talk: { onAgent: async () => s.rost() }, igenkanning: igk, upplasning: u });
    await tillAgenten();
    await act(async () => u.pagar()?.avvisa(new Error("Uppläsningen föll: synthesis-failed")));
    await flush();
    expect(lage()).toBe("lyssnar");
    expect(document.querySelector("[data-talk-rost-svar]")?.textContent).toContain("Första svaret");
    expect(screen.getByText("Svaret gick inte att läsa upp, så det visas som text.")).toBeTruthy();
    act(() => igk.saga("Mer"));
    await tick(ROST_TYSTNAD_MS + 50);
    await flush();
    // Uppläsningen prövas inte igen i samma samtal: nästa svar visas bara, och mikrofonen lyssnar.
    expect(u.las).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-talk-rost-svar]")?.textContent).toContain("Andra svaret");
    expect(lage()).toBe("lyssnar");
  });

  it("⛔ utan uppläsning fortsätter samtalet som text: svaret visas, en rad säger varför, och ingen högtalarknapp ritas", async () => {
    const s = falsktSamtal(["Svar"]);
    Skal({ talk: { onAgent: async () => s.rost() }, igenkanning: falskIgenkanning("Fråga"), upplasning: false });
    await tillAgenten();
    expect(s.svar).toHaveBeenCalledTimes(1);
    expect(lage()).toBe("lyssnar");
    expect(document.querySelector("[data-talk-rost-svar]")?.textContent).toContain("Svar");
    expect(screen.getByText("Svaret kan inte läsas upp här, så det visas som text.")).toBeTruthy();
    expect(document.querySelector("[data-talk-hogtalare]")).toBeNull();
  });

  it("⛔ svaret som inte kom ger ett besked, aldrig tystnad", async () => {
    const u = falskUpplasning();
    const svar = async () => {
      throw new Error("nät");
    };
    Skal({ talk: { onAgent: async () => ({ svar, vidare: vi.fn() }) }, igenkanning: falskIgenkanning("Fråga"), upplasning: u });
    await tillAgenten();
    await flush();
    expect(lage()).toBe("sparat");
    expect(screen.getByText("Svaret kunde inte hämtas hit. Det står i chatten när det kommer.")).toBeTruthy();
  });

  it("⛔ taket på tystnad: hörs inget i ett varv slutar samtalet med ett besked, och mikrofonen stängs", async () => {
    const u = falskUpplasning();
    const s = falsktSamtal(["Svar"]);
    const t = Skal({ talk: { onAgent: async () => s.rost() }, igenkanning: falskIgenkanning("Fråga"), upplasning: u });
    await tillAgenten();
    await act(async () => u.pagar()?.losa());
    await flush();
    expect(lage()).toBe("lyssnar");
    await tick(ROST_INGET_TAL_MS - 100);
    expect(lage()).toBe("lyssnar");
    await tick(200);
    expect(lage()).toBe("sparat");
    expect(screen.getByText("Inget mer hördes, så samtalet är avslutat. Tryck på mikrofonen för att fortsätta.")).toBeTruthy();
    expect(t.inspelare.kasta).toHaveBeenCalled();
    expect(s.vidare).not.toHaveBeenCalled();
  });

  it(`⛔ taket på varv: efter ${ROST_MAX_VARV} upplästa svar lyssnar mikrofonen inte igen av sig själv`, async () => {
    const igk = falskIgenkanning("Fråga");
    const u = falskUpplasning();
    const s = falsktSamtal(["Svar"]);
    const t = Skal({ talk: { onAgent: async () => s.rost() }, igenkanning: igk, upplasning: u });
    await tillAgenten();
    for (let varv = 1; varv < ROST_MAX_VARV; varv++) {
      await act(async () => u.pagar()?.losa());
      await flush();
      expect(lage()).toBe("lyssnar");
      act(() => igk.saga(`fråga ${varv}`));
      await tick(ROST_TYSTNAD_MS + 50);
      await flush();
    }
    expect(u.las).toHaveBeenCalledTimes(ROST_MAX_VARV);
    const starter = t.inspelare.starta.mock.calls.length;
    await act(async () => u.pagar()?.losa());
    await flush();
    expect(lage()).toBe("sparat");
    expect(screen.getByText("Samtalet pausas här. Tryck på mikrofonen för att fortsätta.")).toBeTruthy();
    expect(t.inspelare.starta.mock.calls.length).toBe(starter);
  });

  it("⛔ faller vidare står menyn med det sagda och felet, och samtalet med röst är slut", async () => {
    const igk = falskIgenkanning("Fråga");
    const u = falskUpplasning();
    const vidare = vi.fn(async () => {
      throw new Error("Agenten nåddes inte.");
    });
    Skal({ talk: { onAgent: async () => ({ svar: async () => "Svar", vidare }) }, igenkanning: igk, upplasning: u });
    await tillAgenten();
    await act(async () => u.pagar()?.losa());
    await flush();
    act(() => igk.saga("En sak till"));
    await tick(ROST_TYSTNAD_MS + 50);
    await flush();
    expect(lage()).toBe("hort");
    expect(screen.getByText("Agenten nåddes inte.")).toBeTruthy();
    expect(document.querySelector("[data-talk-val]")).not.toBeNull();
    expect(rostSteg()).toBeNull();
  });

  it("⛔ en öppen tråd (samtalet.direkt) vars onText ger en Talkrost pratar tillbaka på samma sätt", async () => {
    const u = falskUpplasning();
    const s = falsktSamtal(["Svar i tråden"]);
    const onText = vi.fn(async () => s.rost());
    Skal({ talk: { onAgent: vi.fn(), samtalet: { namn: "Hugo", direkt: true, onText } }, igenkanning: falskIgenkanning("Fråga"), upplasning: u });
    fireEvent.click(huvudMikrofon());
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /^Klar/ }));
    await flush();
    await flush();
    expect(onText).toHaveBeenCalledWith("Fråga");
    expect(u.forbered).toHaveBeenCalled();
    expect(u.las).toHaveBeenCalledWith("Svar i tråden", { sprak: "sv-SE" });
  });

  it("en mottagare som inte ger en Talkrost stänger fältet som förut, och svaret läses inte upp", async () => {
    const u = falskUpplasning();
    Skal({ talk: { onAgent: vi.fn(async () => {}) }, igenkanning: falskIgenkanning("Fråga"), upplasning: u });
    await tillAgenten();
    expect(falt()).toBeNull();
    expect(u.las).not.toHaveBeenCalled();
  });
});

describe("arKlarfras", () => {
  it.each(["Klar.", "Tack!", "okej tack, det var allt", "Nej tack", "Thanks", "That's all.", "I'm done", "tack så mycket"])("%s avslutar", (t) => {
    expect(arKlarfras(t)).toBe(true);
  });
  it.each(["tack, och boka tandläkaren", "nej", "", "klara saker i morgon", "Det är klart att jag vill"])("%j avslutar inte", (t) => {
    expect(arKlarfras(t)).toBe(false);
  });
});

describe("talkNasta i samtalet med röst", () => {
  it("skickar går till rost, rost lyssnar igen, avbryts, ger besked och ignorerar ett tryck", () => {
    expect(talkNasta({ lage: "skickar" }, { typ: "rost" })).toEqual({ lage: "rost", gor: null });
    expect(talkNasta({ lage: "rost" }, { typ: "direkt" })).toEqual({ lage: "lyssnar", gor: "starta" });
    expect(talkNasta({ lage: "rost" }, { typ: "avbryt" })).toEqual({ lage: "vila", gor: "kasta" });
    expect(talkNasta({ lage: "rost" }, { typ: "rostSlut" })).toEqual({ lage: "sparat", gor: null });
    expect(talkNasta({ lage: "lyssnar" }, { typ: "rostSlut" })).toEqual({ lage: "sparat", gor: "kasta" });
    expect(talkNasta({ lage: "rost" }, { typ: "ner" })).toEqual({ lage: "rost", gor: null });
  });
});

describe("talkrostUr", () => {
  it("ger null för ett svar som inte är ett samtal, och för ett felformat som rapporteras", () => {
    const fel = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(talkrostUr(undefined)).toBeNull();
    expect(talkrostUr({ sid: "x" })).toBeNull();
    expect(fel).not.toHaveBeenCalled();
    expect(talkrostUr({ svar: "text", vidare: () => {} })).toBeNull();
    expect(fel).toHaveBeenCalledTimes(1);
    fel.mockRestore();
    const r = { svar: async () => "", vidare: () => {} };
    expect(talkrostUr(r)).toEqual(r);
  });
});

describe("webblasarensUpplasning", () => {
  /** Ett fönster med en falsk `speechSynthesis` där provet avgör vilka händelser som kommer. */
  function fonster({ roster = [{ lang: "sv-SE", name: "Alva" }, { lang: "en-US", name: "Sam" }] } = {}) {
    /** @type {any[]} */
    const talade = [];
    class Yttrande {
      /** @param {string} text */
      constructor(text) {
        this.text = text;
        /** @type {any} */ this.onstart = null;
        /** @type {any} */ this.onend = null;
        /** @type {any} */ this.onerror = null;
      }
    }
    const synt = { speaking: false, pending: false, speak: vi.fn((/** @type {any} */ u) => talade.push(u)), cancel: vi.fn(), getVoices: () => roster };
    return { f: { speechSynthesis: synt, SpeechSynthesisUtterance: Yttrande }, synt, talade };
  }

  it("är null utan speechSynthesis", () => {
    expect(webblasarensUpplasning({ fonster: {} })).toBeNull();
  });

  it("läser med språket och rätt röst, och löser vid end", async () => {
    const { f, talade } = fonster();
    const u = /** @type {import("../lib/talkrost.js").Upplasning} */ (webblasarensUpplasning({ fonster: f }));
    const klar = vi.fn();
    u.las("Hej", { sprak: "sv-SE" }).then(klar);
    expect(talade[0].lang).toBe("sv-SE");
    expect(talade[0].voice.name).toBe("Alva");
    talade[0].onstart();
    await vi.advanceTimersByTimeAsync(ROST_LAS_START_MS + 10);
    expect(klar).not.toHaveBeenCalled();
    talade[0].onend();
    await vi.advanceTimersByTimeAsync(0);
    expect(klar).toHaveBeenCalled();
  });

  it("⛔ avvisar när uppläsningen aldrig startar (objektet finns men ingenting hörs)", async () => {
    const { f, synt } = fonster({ roster: [] });
    const u = /** @type {import("../lib/talkrost.js").Upplasning} */ (webblasarensUpplasning({ fonster: f }));
    const fel = vi.fn();
    u.las("Hej", { sprak: "sv-SE" }).catch(fel);
    await vi.advanceTimersByTimeAsync(ROST_LAS_START_MS + 10);
    expect(fel).toHaveBeenCalled();
    expect(synt.cancel).toHaveBeenCalled();
  });

  it("⛔ avvisar på synthesis-failed (mätt i Chromium utan röster), men inte på vår egen stoppa", async () => {
    const { f, talade } = fonster();
    const u = /** @type {import("../lib/talkrost.js").Upplasning} */ (webblasarensUpplasning({ fonster: f }));
    const fel = vi.fn();
    u.las("Hej", { sprak: "sv-SE" }).catch(fel);
    talade[0].onerror({ error: "synthesis-failed" });
    await vi.advanceTimersByTimeAsync(0);
    expect(fel).toHaveBeenCalled();
    const klar = vi.fn();
    u.las("Igen", { sprak: "sv-SE" }).then(klar);
    talade[1].onstart();
    talade[1].onerror({ error: "interrupted" });
    await vi.advanceTimersByTimeAsync(0);
    expect(klar).toHaveBeenCalled();
  });

  it("förbereder en gång, med en tom och tyst uppläsning", () => {
    const { f, talade } = fonster();
    const u = /** @type {import("../lib/talkrost.js").Upplasning} */ (webblasarensUpplasning({ fonster: f }));
    u.forbered?.();
    u.forbered?.();
    expect(talade).toHaveLength(1);
    expect(talade[0].text).toBe("");
    expect(talade[0].volume).toBe(0);
  });
});

describe("högtalarknappen (CP 2026-11-18)", () => {
  it("⛔ av under uppläsningen: tystnar direkt, mikrofonen lyssnar, valet sparas, och nästa svar visas utan att läsas upp", async () => {
    const igk = falskIgenkanning("Fråga");
    const u = falskUpplasning();
    const s = falsktSamtal(["Första", "Andra"]);
    Skal({ talk: { onAgent: async () => s.rost() }, igenkanning: igk, upplasning: u });
    await tillAgenten();
    const knapp = /** @type {HTMLElement} */ (document.querySelector("[data-talk-hogtalare]"));
    expect(knapp.getAttribute("aria-label")).toBe("Läs upp svaren");
    expect(knapp.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(knapp);
    await flush();
    expect(u.stoppa).toHaveBeenCalled();
    expect(lage()).toBe("lyssnar");
    expect(localStorage.getItem(UPPLASNING_NYCKEL)).toBe("av");
    expect(document.querySelector("[data-talk-hogtalare]")?.getAttribute("aria-pressed")).toBe("false");
    act(() => igk.saga("Mer"));
    await tick(ROST_TYSTNAD_MS + 50);
    await flush();
    expect(u.las).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-talk-rost-svar]")?.textContent).toContain("Andra");
    expect(lage()).toBe("lyssnar");
    // Ingen rad om varför: det var personens val.
    expect(document.querySelector("[data-talk-rost-notis]")).toBeNull();
  });

  it("⛔ valet gäller nästa gång: sparat av läses inget upp, och på igen sparas", async () => {
    localStorage.setItem(UPPLASNING_NYCKEL, "av");
    const igk = falskIgenkanning("Fråga");
    const u = falskUpplasning();
    const s = falsktSamtal(["Svar"]);
    Skal({ talk: { onAgent: async () => s.rost() }, igenkanning: igk, upplasning: u });
    await tillAgenten();
    expect(u.forbered).not.toHaveBeenCalled();
    expect(u.las).not.toHaveBeenCalled();
    expect(lage()).toBe("lyssnar");
    fireEvent.click(/** @type {HTMLElement} */ (document.querySelector("[data-talk-hogtalare]")));
    await flush();
    expect(localStorage.getItem(UPPLASNING_NYCKEL)).toBe("pa");
    act(() => igk.saga("Mer"));
    await tick(ROST_TYSTNAD_MS + 50);
    await flush();
    expect(u.las).toHaveBeenCalledTimes(1);
  });
});

describe("vågikonen i TALK-fältet (CP 2026-11-18)", () => {
  it("⛔ medan man pratar: det sagda går direkt till onAgent utan meny, och samtalet pratar tillbaka", async () => {
    const u = falskUpplasning();
    const s = falsktSamtal(["Svar"]);
    const onAgent = vi.fn(async () => s.rost());
    Skal({ talk: { onAgent }, igenkanning: falskIgenkanning("Hur långt är det till Visby?"), upplasning: u });
    fireEvent.click(huvudMikrofon());
    await flush();
    const vag = screen.getByRole("button", { name: "Samtal med agenten" });
    expect(vag.hasAttribute("data-talk-samtal")).toBe(true);
    fireEvent.click(vag);
    expect(u.forbered).toHaveBeenCalledTimes(1);
    await flush();
    await flush();
    expect(onAgent).toHaveBeenCalledWith("Hur långt är det till Visby?");
    expect(document.querySelector("[data-talk-val]")).toBeNull();
    expect(lage()).toBe("rost");
    expect(u.las).toHaveBeenCalledWith("Svar", { sprak: "sv-SE" });
    // I samtalet står ingen vågikon: det pågår redan.
    await act(async () => u.pagar()?.losa());
    await flush();
    expect(lage()).toBe("lyssnar");
    expect(document.querySelector("[data-talk-samtal]")).toBeNull();
  });

  it("utan onAgent ritas ingen vågikon", async () => {
    Skal({ igenkanning: falskIgenkanning("Fråga"), upplasning: falskUpplasning() });
    fireEvent.click(huvudMikrofon());
    await flush();
    expect(lage()).toBe("lyssnar");
    expect(document.querySelector("[data-talk-samtal]")).toBeNull();
  });

  it("hördes inget står menyn som förut, och ingenting lämnas till agenten", async () => {
    const onAgent = vi.fn();
    Skal({ talk: { onAgent }, igenkanning: falskIgenkanning(""), upplasning: falskUpplasning() });
    fireEvent.click(huvudMikrofon());
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Samtal med agenten" }));
    await flush();
    expect(onAgent).not.toHaveBeenCalled();
    expect(lage()).toBe("hort");
  });
});

describe("vågikonen i agentens chatt (CP 2026-11-18)", () => {
  const MEDLEMMAR = [
    { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
    { userId: "ops", namn: "Ops-agenten", typ: "agent", status: "aktiv" },
  ];
  /** @param {{ slag?: string, skal?: boolean }} [val] */
  async function ritaChatt({ slag = "agent", skal = true } = {}) {
    const kalla = levandeKalla();
    const s = createSamtalskalla({ kalla, status: "status" });
    const samtal = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "ops", slag });
    const igk = falskIgenkanning("");
    const u = falskUpplasning();
    const chatt = <OpsSamtal kalla={s} uid="anna" samtal={samtal} rubrik="Ops" namnFor={(/** @type {string} */ x) => x} medlemmar={MEDLEMMAR} />;
    if (skal) {
      render(
        <OpsAppShell brand="Ops" fasta={fasta} moduler={[]} activeHref="/" talk={{ onTalk: vi.fn(), onAgent: vi.fn(), igenkanning: igk, upplasning: u, inspelare: falskInspelare() }}>
          {chatt}
        </OpsAppShell>,
      );
    } else render(chatt);
    await flush();
    return { s, samtal, igk, u };
  }

  it("⛔ ett tryck börjar ett röstsamtal i samtalet: det sagda skickas där, och agentens svar läses upp", async () => {
    const { s, samtal, igk, u } = await ritaChatt();
    const vag = screen.getByRole("button", { name: "Samtal med agenten" });
    expect(vag.hasAttribute("data-rost-samtal")).toBe(true);
    fireEvent.click(vag);
    await flush();
    expect(lage()).toBe("lyssnar");
    expect(u.forbered).toHaveBeenCalled();
    act(() => igk.saga("Vilka fakturor är obetalda?"));
    await tick(ROST_TYSTNAD_MS + 50);
    await flush();
    const efterSkick = await s.meddelanden(samtal.id);
    expect(efterSkick.map((m) => [m.av, m.text])).toEqual([["anna", "Vilka fakturor är obetalda?"]]);
    expect(rostSteg()).toBe("vantar");
    await act(async () => {
      await s.skicka(samtal.id, { text: "Två fakturor.", av: "ops" });
    });
    await flush();
    expect(u.las).toHaveBeenCalledWith("Två fakturor.", { sprak: "sv-SE" });
  });

  it("i ett samtal med människor, och utanför ett skal, ritas ingen vågikon", async () => {
    await ritaChatt({ slag: "personer" });
    expect(document.querySelector("[data-skrivfalt]")).not.toBeNull();
    expect(document.querySelector("[data-rost-samtal]")).toBeNull();
    cleanup();
    await ritaChatt({ skal: false });
    expect(document.querySelector("[data-skrivfalt]")).not.toBeNull();
    expect(document.querySelector("[data-rost-samtal]")).toBeNull();
  });
});

describe("samtalssvar och vidareISamtal", () => {
  it("⛔ svaret är första meddelandet efter det skickade från någon annan, inte ett äldre", async () => {
    const kalla = levandeKalla();
    const s = createSamtalskalla({ kalla, status: "status" });
    const samtal = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "ops", slag: "agent" });
    await s.skicka(samtal.id, { text: "Gammalt svar", av: "ops" });
    // Klockan står still under falska timrar: meddelandena får var sin tid, som på riktigt.
    vi.advanceTimersByTime(10);
    const vidare = vidareISamtal({ kalla: s, sid: samtal.id, uid: "anna" });
    const r = await vidare("Ny fråga");
    const svar = vi.fn();
    r.svar().then(svar);
    await flush();
    expect(svar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10);
    await act(async () => {
      await s.skicka(samtal.id, { text: "Nytt svar", av: "ops" });
    });
    await flush();
    expect(svar).toHaveBeenCalledWith("Nytt svar");
  });

  it("avvisar när källan inte kan prenumerera", async () => {
    await expect(samtalssvar({ kalla: { prenumerera: () => null }, sid: "x", uid: "a", efter: { id: "m" } })).rejects.toThrow("Samtalet går inte att följa här");
  });

  it("stänger prenumerationen när väntan avbryts, också när svaret aldrig kommer", async () => {
    const stang = vi.fn();
    const avbryt = new AbortController();
    const svar = samtalssvar({ kalla: { prenumerera: () => stang }, sid: "x", uid: "a", efter: { id: "m" }, signal: avbryt.signal });
    expect(stang).not.toHaveBeenCalled();
    avbryt.abort();
    await expect(svar).rejects.toThrow("avbröts");
    expect(stang).toHaveBeenCalledTimes(1);
  });
});
