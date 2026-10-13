import { describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import { OpsInspelning, useTalk } from "../components/OpsTalk.jsx";
import { igenkanningensSprak, webblasarensIgenkanning } from "../lib/talk.js";

/*
 * Text medan man pratar (0.96.0, cllp/lifehub.app#209). CP 2026-10-13: "det tar lång tid för transkribering och det är ingen
 * smidig AI upplevelse."
 *
 * ⛔ TRE SAKER PROVAS, ALLA MED EN FEJKAD WEBBLÄSARE: att texten växer medan man pratar och följer med till appen, att en
 * igenkänning som faller ger TOM text (aldrig en halv som ser hel ut), och att ljudet följer med i båda fallen.
 */

/** En fejkad `SpeechRecognition`. Provet styr resultat, fel och slut. */
function fejkadIgenkanning() {
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
      instanser.push(this);
    }
    start() {
      this.startad = true;
    }
    stop() {
      queueMicrotask(() => this.onend?.());
    }
    abort() {
      this.avbruten = true;
    }
  }
  /** @param {any} rec @param {Array<[string, boolean]>} rader */
  const resultat = (rec, rader, fran = 0) =>
    rec.onresult({ resultIndex: fran, results: rader.map(([t, slut]) => Object.assign([{ transcript: t }], { isFinal: slut })) });
  return { SR, instanser, resultat };
}

describe("webblasarensIgenkanning", () => {
  it("finns inte när webbläsaren saknar taligenkänning", () => {
    expect(webblasarensIgenkanning({ SpeechRecognition: undefined })).toBe(null);
  });

  it("ger hela texten medan man pratar, och den slutliga när den stoppas", async () => {
    const f = fejkadIgenkanning();
    const igk = /** @type {NonNullable<ReturnType<typeof webblasarensIgenkanning>>} */ (webblasarensIgenkanning({ SpeechRecognition: f.SR }));
    /** @type {string[]} */
    const sett = [];
    igk.starta({ sprak: "sv-SE", onText: (t) => sett.push(t) });
    const rec = f.instanser[0];
    expect(rec.lang).toBe("sv-SE");
    expect(rec.continuous && rec.interimResults).toBe(true);
    f.resultat(rec, [["boka rep", false]]);
    f.resultat(rec, [["boka rep på torsdag", true]]);
    f.resultat(rec, [["boka rep på torsdag", true], ["klockan sju", false]], 1);
    expect(sett).toEqual(["boka rep", "boka rep på torsdag", "boka rep på torsdag klockan sju"]);
    // Webbläsaren gör det sista slutligt när den stoppas, som Chrome gör.
    f.resultat(rec, [["boka rep på torsdag", true], ["klockan sju", true]], 1);
    await expect(igk.stoppa()).resolves.toBe("boka rep på torsdag klockan sju");
  });

  it("startar om när webbläsaren avslutar mitt i, och behåller det som redan hörts", async () => {
    const f = fejkadIgenkanning();
    const igk = /** @type {any} */ (webblasarensIgenkanning({ SpeechRecognition: f.SR }));
    igk.starta({ sprak: "sv-SE", onText: () => {} });
    f.resultat(f.instanser[0], [["första delen", true]]);
    f.instanser[0].onend();
    expect(f.instanser).toHaveLength(2);
    expect(f.instanser[1].startad).toBe(true);
    f.resultat(f.instanser[1], [["andra delen", true]]);
    await expect(igk.stoppa()).resolves.toBe("första delen andra delen");
  });

  it("ett fel mitt i ger tom text, aldrig en halv som ser hel ut", async () => {
    const f = fejkadIgenkanning();
    const igk = /** @type {any} */ (webblasarensIgenkanning({ SpeechRecognition: f.SR }));
    igk.starta({ sprak: "sv-SE", onText: () => {} });
    f.resultat(f.instanser[0], [["det här hördes", true]]);
    f.instanser[0].onerror({ error: "network" });
    await expect(igk.stoppa()).resolves.toBe("");
  });

  it("tystnad är inget fel", async () => {
    const f = fejkadIgenkanning();
    const igk = /** @type {any} */ (webblasarensIgenkanning({ SpeechRecognition: f.SR }));
    igk.starta({ sprak: "sv-SE", onText: () => {} });
    f.instanser[0].onerror({ error: "no-speech" });
    f.resultat(f.instanser[0], [["ändå hört", true]]);
    await expect(igk.stoppa()).resolves.toBe("ändå hört");
  });

  it("⛔ en avbruten igenkännare som svarar sent skriver inte in i nästa försök och startar ingen andra (MÅSTE 1)", async () => {
    const f = fejkadIgenkanning();
    const igk = /** @type {any} */ (webblasarensIgenkanning({ SpeechRecognition: f.SR }));
    igk.starta({ sprak: "sv-SE", onText: () => {} });
    const gammal = f.instanser[0];
    igk.kasta();
    igk.starta({ sprak: "sv-SE", onText: () => {} });
    expect(f.instanser).toHaveLength(2);
    f.resultat(gammal, [["från förra försöket", true]]);
    gammal.onend();
    expect(f.instanser).toHaveLength(2);
    f.resultat(f.instanser[1], [["det nya", true]]);
    await expect(igk.stoppa()).resolves.toBe("det nya");
  });

  it("⛔ bara preliminär text kvar när den stoppas ger tom text (MÅSTE 2)", async () => {
    const f = fejkadIgenkanning();
    const igk = /** @type {any} */ (webblasarensIgenkanning({ SpeechRecognition: f.SR }));
    igk.starta({ sprak: "sv-SE", onText: () => {} });
    f.resultat(f.instanser[0], [["boka rep på", false]]);
    await expect(igk.stoppa()).resolves.toBe("");
  });

  it("⛔ när webbläsaren aldrig ger sitt sista besked blir texten tom (MÅSTE 2)", async () => {
    const f = fejkadIgenkanning();
    /** @type {Function[]} */
    const tidtagare = [];
    const igk = /** @type {any} */ (webblasarensIgenkanning({ SpeechRecognition: f.SR, setTimeout: /** @type {any} */ ((fn) => tidtagare.push(fn)) }));
    igk.starta({ sprak: "sv-SE", onText: () => {} });
    f.resultat(f.instanser[0], [["hörd text", true]]);
    f.instanser[0].stop = () => {};
    const ut = igk.stoppa();
    tidtagare.forEach((fn) => fn());
    await expect(ut).resolves.toBe("");
  });

  it("⛔ ett avbrott utifrån (aborted) gör texten ogiltig (MÅSTE 2)", async () => {
    const f = fejkadIgenkanning();
    const igk = /** @type {any} */ (webblasarensIgenkanning({ SpeechRecognition: f.SR }));
    igk.starta({ sprak: "sv-SE", onText: () => {} });
    f.resultat(f.instanser[0], [["hälften av", true]]);
    f.instanser[0].onerror({ error: "aborted" });
    await expect(igk.stoppa()).resolves.toBe("");
  });

  it("en igenkännare som tar slut direkt efter start loopar inte (BÖR 2)", async () => {
    const f = fejkadIgenkanning();
    const igk = /** @type {any} */ (webblasarensIgenkanning({ SpeechRecognition: f.SR, nu: () => 1000 }));
    igk.starta({ sprak: "sv-SE", onText: () => {} });
    for (let i = 0; i < 10; i += 1) f.instanser.at(-1).onend();
    expect(f.instanser.length).toBeLessThanOrEqual(4);
    await expect(igk.stoppa()).resolves.toBe("");
  });

  it("språket följer appens", () => {
    expect(igenkanningensSprak("sv")).toBe("sv-SE");
    expect(igenkanningensSprak("en")).toBe("en-US");
    expect(igenkanningensSprak("")).toBe("sv-SE");
  });
});

/** En inspelare som svarar direkt. */
function inspelare() {
  return {
    starta: vi.fn(async () => {}),
    stoppa: vi.fn(async () => ({ blob: new Blob(["ljud"], { type: "audio/webm" }), mimeType: "audio/webm", sekunder: 3 })),
    kasta: vi.fn(),
    niva: () => 0,
  };
}

/** En igenkänning som provet styr. @param {string} slut */
function styrdIgenkanning(slut) {
  /** @type {(t: string) => void} */
  let skriv = () => {};
  return {
    starta: vi.fn((/** @type {{ onText: (t: string) => void }} */ v) => {
      skriv = v.onText;
    }),
    stoppa: vi.fn(async () => slut),
    kasta: vi.fn(),
    skriv: (/** @type {string} */ t) => skriv(t),
  };
}

const vanta = () => act(async () => {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
});

describe("useTalk med text", () => {
  it("texten syns medan man pratar och följer med till appen tillsammans med ljudet", async () => {
    const igk = styrdIgenkanning("lägg in rep på torsdag");
    const onTalk = vi.fn(async () => {});
    const { result } = renderHook(() => useTalk({ onTalk, onKlick: () => {}, inspelare: inspelare(), igenkanning: igk }));
    act(() => result.current.direkt());
    await vanta();
    expect(igk.starta).toHaveBeenCalledTimes(1);
    act(() => igk.skriv("lägg in rep"));
    expect(result.current.text).toBe("lägg in rep");
    act(() => result.current.skickaIn());
    await vanta();
    expect(onTalk).toHaveBeenCalledTimes(1);
    const [blob, meta] = /** @type {any} */ (onTalk.mock.calls[0]);
    expect(blob).toBeInstanceOf(Blob);
    expect(meta.text).toBe("lägg in rep på torsdag");
  });

  it("utan hel text får appen bara ljudet, som förut", async () => {
    const igk = styrdIgenkanning("");
    const onTalk = vi.fn(async () => {});
    const { result } = renderHook(() => useTalk({ onTalk, onKlick: () => {}, inspelare: inspelare(), igenkanning: igk }));
    act(() => result.current.direkt());
    await vanta();
    act(() => result.current.skickaIn());
    await vanta();
    const [, meta] = /** @type {any} */ (onTalk.mock.calls[0]);
    expect("text" in meta).toBe(false);
  });

  it("avbryt kastar också texten", async () => {
    const igk = styrdIgenkanning("x");
    const { result } = renderHook(() => useTalk({ onTalk: async () => {}, onKlick: () => {}, inspelare: inspelare(), igenkanning: igk }));
    act(() => result.current.direkt());
    await vanta();
    act(() => igk.skriv("något"));
    act(() => result.current.avbryt());
    await vanta();
    expect(igk.kasta).toHaveBeenCalled();
    expect(result.current.text).toBe("");
  });

  it("⛔ av som förval: utan igenkanning används inte webbläsarens taligenkänning, fast den finns (MÅSTE 3)", async () => {
    const f = fejkadIgenkanning();
    vi.stubGlobal("webkitSpeechRecognition", f.SR);
    try {
      const onTalk = vi.fn(async () => {});
      const { result } = renderHook(() => useTalk({ onTalk, onKlick: () => {}, inspelare: inspelare() }));
      act(() => result.current.direkt());
      await vanta();
      act(() => result.current.skickaIn());
      await vanta();
      expect(f.instanser).toHaveLength(0);
      expect("text" in /** @type {any} */ (onTalk.mock.calls[0])[1]).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("true slår på webbläsarens taligenkänning", async () => {
    const f = fejkadIgenkanning();
    vi.stubGlobal("webkitSpeechRecognition", f.SR);
    try {
      const { result } = renderHook(() => useTalk({ onTalk: async () => {}, onKlick: () => {}, inspelare: inspelare(), igenkanning: true }));
      act(() => result.current.direkt());
      await vanta();
      expect(f.instanser).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("false stänger av igenkänningen", async () => {
    const onTalk = vi.fn(async () => {});
    const { result } = renderHook(() => useTalk({ onTalk, onKlick: () => {}, inspelare: inspelare(), igenkanning: false }));
    act(() => result.current.direkt());
    await vanta();
    act(() => result.current.skickaIn());
    await vanta();
    expect("text" in /** @type {any} */ (onTalk.mock.calls[0])[1]).toBe(false);
  });
});

describe("OpsInspelning visar texten", () => {
  it("medan man pratar", () => {
    render(<OpsInspelning lage="lyssnar" niva={() => 0} sekunder={2} tak={120} framsteg={null} kanIgen={false} text="boka rep" onKlar={() => {}} onAvbryt={() => {}} onIgen={() => {}} />);
    const p = screen.getByText("boka rep");
    expect(p.getAttribute("data-talk-text")).toBe("");
    expect(p.getAttribute("aria-live")).toBe("polite");
  });

  it("inte när inget hörts", () => {
    const { container } = render(<OpsInspelning lage="lyssnar" niva={() => 0} sekunder={2} tak={120} framsteg={null} kanIgen={false} onKlar={() => {}} onAvbryt={() => {}} onIgen={() => {}} />);
    expect(container.querySelector("[data-talk-text]")).toBe(null);
  });
});
