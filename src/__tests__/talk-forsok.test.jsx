import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useTalk } from "../components/OpsTalk.jsx";
import { MAX_SEKUNDER, webblasarensInspelare } from "../lib/talk.js";

/*
 * #281 och granskningen av PR 286. ⛔ ETT SVAR FRÅN getUserMedia HÖR TILL ETT FÖRSÖK. Förut jämförde `starta().then` bara läget,
 * så ett försök som avbrutits eller avmonterats medan mikrofonen öppnades spelade in ändå, och ljudet skickades till appen efter
 * 120 s. HÄR RÄKNAS ÖPPNA STRÖMMAR med en fejkad getUserMedia, och appens mottagare räknas efter avmonteringen.
 */

/** En fejkad webbläsare: getUserMedia svarar först när provet säger till, och varje ström räknas tills den stoppas. */
function webblasare() {
  /** @type {Array<() => void>} */
  const vantande = [];
  const oppna = new Set();
  let skapade = 0;
  const mediaDevices = {
    getUserMedia: vi.fn(
      () =>
        new Promise((klar) => {
          vantande.push(() => {
            skapade += 1;
            const id = skapade;
            oppna.add(id);
            klar({ getTracks: () => [{ stop: () => oppna.delete(id) }] });
          });
        }),
    ),
  };
  class MediaRecorder {
    constructor() {
      this.state = "inactive";
      this.mimeType = "audio/webm";
      /** @type {null | (() => void)} */
      this.onstop = null;
      /** @type {null | ((e: { data: Blob }) => void)} */
      this.ondataavailable = null;
    }
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob(["ljud"], { type: "audio/webm" }) });
      this.onstop?.();
    }
  }
  return {
    miljo: { mediaDevices, MediaRecorder, AudioContext: undefined },
    /** Låter det äldsta väntande anropet svara. */
    svara: async () => {
      const f = vantande.shift();
      if (!f) throw new Error("inget anrop väntar");
      await act(async () => {
        f();
        await Promise.resolve();
        await Promise.resolve();
      });
    },
    oppna: () => oppna.size,
    anrop: () => mediaDevices.getUserMedia.mock.calls.length,
  };
}

/** En inspelare som inte själv vet vilket försök som gäller: provar krokens eget nummer. */
function enkelInspelare() {
  /** @type {Array<() => void>} */
  const vantande = [];
  return {
    starta: vi.fn(() => new Promise((klar) => vantande.push(() => klar(undefined)))),
    stoppa: vi.fn(async () => ({ blob: new Blob(["ljud"]), mimeType: "audio/webm", sekunder: 1 })),
    kasta: vi.fn(),
    niva: () => 0,
    svara: async () => {
      await act(async () => {
        vantande.shift()?.();
        await Promise.resolve();
      });
    },
  };
}

afterEach(() => vi.useRealTimers());

describe("ett svar från starta hör till sitt försök (#281)", () => {
  it("⛔ S4: avmonterad medan mikrofonen öppnas: strömmen stängs, och appen får inget ljud efter 120 s", async () => {
    vi.useFakeTimers();
    const w = webblasare();
    const onTalk = vi.fn();
    const { result, unmount } = renderHook(() => useTalk({ onTalk, onKlick: () => {}, inspelare: webblasarensInspelare(w.miljo) }));
    act(() => result.current.direkt());
    unmount();
    await w.svara();
    expect(w.oppna()).toBe(0);
    await act(async () => {
      vi.advanceTimersByTime((MAX_SEKUNDER + 1) * 1000);
    });
    expect(onTalk).not.toHaveBeenCalled();
  });

  it("⛔ S4 med en inspelare som inte vet om försöket: kroken stänger den och skickar inget", async () => {
    vi.useFakeTimers();
    const insp = enkelInspelare();
    const onTalk = vi.fn();
    const { result, unmount } = renderHook(() => useTalk({ onTalk, onKlick: () => {}, inspelare: insp }));
    act(() => result.current.direkt());
    unmount();
    const kastadeVidAvmontering = insp.kasta.mock.calls.length;
    await insp.svara();
    expect(insp.kasta.mock.calls.length).toBeGreaterThan(kastadeVidAvmontering);
    await act(async () => {
      vi.advanceTimersByTime((MAX_SEKUNDER + 1) * 1000);
    });
    expect(insp.stoppa).not.toHaveBeenCalled();
    expect(onTalk).not.toHaveBeenCalled();
  });

  it("⛔ S5 (#281): starta, avbryt medan mikrofonen öppnas, starta igen, avbryt: ingen ström står kvar", async () => {
    const w = webblasare();
    const { result } = renderHook(() => useTalk({ onTalk: vi.fn(), onKlick: () => {}, inspelare: webblasarensInspelare(w.miljo) }));
    act(() => result.current.direkt());
    act(() => result.current.avbryt());
    act(() => result.current.direkt());
    expect(w.anrop()).toBe(2);
    await w.svara();
    await w.svara();
    expect(w.oppna()).toBe(1);
    expect(result.current.lage).toBe("lyssnar");
    act(() => result.current.avbryt());
    expect(w.oppna()).toBe(0);
  });

  it("⛔ S5, sista försöket gäller: det som spelas in efter två starter når appen, och strömmen stängs", async () => {
    const w = webblasare();
    const onTalk = vi.fn();
    const { result } = renderHook(() => useTalk({ onTalk, onKlick: () => {}, inspelare: webblasarensInspelare(w.miljo) }));
    act(() => result.current.direkt());
    act(() => result.current.avbryt());
    act(() => result.current.direkt());
    await w.svara();
    await w.svara();
    await act(async () => {
      result.current.skickaIn();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(onTalk).toHaveBeenCalledTimes(1);
    expect(w.oppna()).toBe(0);
  });

  it("⛔ Skicka innan mikrofonen hunnit öppnas: när den öppnas stängs den, i stället för att spela in i bakgrunden", async () => {
    vi.useFakeTimers();
    const insp = enkelInspelare();
    const { result, unmount } = renderHook(() => useTalk({ onTalk: vi.fn(), onKlick: () => {}, inspelare: insp }));
    act(() => result.current.direkt());
    await act(async () => {
      result.current.skickaIn();
      await Promise.resolve();
    });
    const fore = insp.kasta.mock.calls.length;
    await insp.svara();
    expect(insp.kasta.mock.calls.length).toBe(fore + 1);
    await act(async () => {
      vi.advanceTimersByTime((MAX_SEKUNDER + 1) * 1000);
    });
    expect(insp.stoppa).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("⛔ en start som faller släpper spärren, så att nästa del av sidan kan spela in", async () => {
    const fel = { starta: vi.fn(async () => Promise.reject(Object.assign(new Error("nej"), { name: "NotAllowedError" }))), stoppa: vi.fn(), kasta: vi.fn(), niva: () => 0 };
    const ok = enkelInspelare();
    const a = renderHook(() => useTalk({ onTalk: vi.fn(), onKlick: () => {}, inspelare: fel }));
    const b = renderHook(() => useTalk({ onTalk: vi.fn(), onKlick: () => {}, inspelare: ok }));
    await act(async () => {
      a.result.current.direkt();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(a.result.current.lage).toBe("fel");
    act(() => b.result.current.direkt());
    expect(ok.starta).toHaveBeenCalledTimes(1);
    expect(b.result.current.lage).toBe("lyssnar");
    act(() => b.result.current.avbryt());
    a.unmount();
    b.unmount();
  });
});
