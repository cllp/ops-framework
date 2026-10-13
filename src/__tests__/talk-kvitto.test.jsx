import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsInspelning, useTalk } from "../components/OpsTalk.jsx";
import { LANGTRYCK_MS, SPARAT_MS, TALK_PLATSTEXT, talkKvitto } from "../lib/talk.js";

/*
 * Kvitto, Ångra och statusraden (0.97.0, lifehub.app#219). CP 2026-10-13: TALK ska gå till gruppens agent, som gör det man bad
 * om och svarar med ett kvitto som går att ångra. Och om panelen: "knapparna är asfula", "Kanske texten ska vara lite större".
 *
 * ⛔ PROVEN GÅR GENOM SKALET (`OpsAppShell talk={...}`) där det går, så att vägen från appens alternativ till fältet provas och
 * inte bara komponenten. Kroken provas direkt där ett knapptryck inte kan visa felet: ett andra tryck på en inaktiv knapp når
 * aldrig `onClick`, och en avmontering har ingen knapp alls.
 */

/** En inspelare utan mikrofon. */
function falskInspelare() {
  return {
    starta: vi.fn(() => Promise.resolve()),
    stoppa: vi.fn(() => Promise.resolve({ blob: new Blob(["ljud"], { type: "audio/webm" }), mimeType: "audio/webm", sekunder: 2.5 })),
    kasta: vi.fn(),
    niva: () => 0.5,
  };
}

/** Ett löfte provet löser när det vill. */
function uppskjutet() {
  /** @type {(v?: any) => void} */
  let los = () => {};
  /** @type {(e: any) => void} */
  let avvisa = () => {};
  const lofte = new Promise((a, b) => {
    los = a;
    avvisa = b;
  });
  return { lofte, los, avvisa };
}

const fasta = { idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };
/** @param {any} talk */
const Skal = (talk) => (
  <OpsAppShell brand="Ops" fasta={fasta} moduler={[]} activeHref="/" talk={talk}>
    <p>innehåll</p>
  </OpsAppShell>
);
const plus = () => /** @type {HTMLElement} */ (document.querySelector("[data-talk-knapp]"));
const flush = () => act(async () => {});
const falt = () => screen.queryByRole("dialog", { name: "TALK" });

/** Långtryck, släpp och Klar. */
async function prataOchKlar() {
  fireEvent.pointerDown(plus(), { button: 0 });
  act(() => vi.advanceTimersByTime(LANGTRYCK_MS));
  await flush();
  fireEvent.pointerUp(plus());
  fireEvent.click(plus());
  fireEvent.click(screen.getByRole("button", { name: "Klar, spara inspelningen" }));
  await flush();
}

describe("kvittot i fältet", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("⛔ ett kvitto står kvar tills personen stänger det, med Ångra och Stäng", async () => {
    const angra = vi.fn(async () => {});
    render(Skal({ onTalk: async () => ({ kvitto: "Inlagt: Rep, torsdag 22 okt 19:00", angra }), inspelare: falskInspelare() }));
    await prataOchKlar();
    const dialog = /** @type {HTMLElement} */ (falt());
    expect(within(dialog).getByRole("status").textContent).toBe("Inlagt: Rep, torsdag 22 okt 19:00");
    expect(within(dialog).getByRole("button", { name: "Ångra" })).toBeTruthy();
    // ⛔ Döljs inte av sig självt, som Sparat gör.
    act(() => vi.advanceTimersByTime(SPARAT_MS * 5));
    expect(falt()).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Stäng" }));
    expect(falt()).toBeNull();
    expect(angra).not.toHaveBeenCalled();
  });

  it("utan angra ritas ingen Ångra, bara Stäng", async () => {
    render(Skal({ onTalk: async () => ({ kvitto: "Ärendet ligger i Inkorgen" }), inspelare: falskInspelare() }));
    await prataOchKlar();
    expect(screen.getByRole("status").textContent).toBe("Ärendet ligger i Inkorgen");
    expect(screen.queryByRole("button", { name: "Ångra" })).toBeNull();
    expect(screen.getByRole("button", { name: "Stäng" })).toBeTruthy();
  });

  it("Ångra lyckas: knappen säger att det pågår, sedan Ångrat, sedan stängs fältet", async () => {
    const svar = uppskjutet();
    const angra = vi.fn(() => svar.lofte);
    render(Skal({ onTalk: async () => ({ kvitto: "Inlagt: Rep", angra }), inspelare: falskInspelare() }));
    await prataOchKlar();
    fireEvent.click(screen.getByRole("button", { name: "Ångra" }));
    await flush();
    const pagar = screen.getByRole("button", { name: "Ångrar…" });
    expect(pagar).toBeDisabled();
    expect(pagar.getAttribute("aria-busy")).toBe("true");
    expect(pagar.querySelector("svg")).not.toBeNull();
    expect(angra).toHaveBeenCalledTimes(1);
    act(() => svar.los());
    await flush();
    expect(screen.getByRole("status").textContent).toBe("Ångrat");
    expect(screen.queryByRole("button", { name: "Ångra" })).toBeNull();
    act(() => vi.advanceTimersByTime(SPARAT_MS));
    expect(falt()).toBeNull();
  });

  it("⛔ Ångra faller: felet står med role=alert, Stäng finns kvar, och fältet döljs inte", async () => {
    const angra = vi.fn(async () => {
      throw new Error("Händelsen gick inte att ta bort.");
    });
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(Skal({ onTalk: async () => ({ kvitto: "Inlagt: Rep", angra }), inspelare: falskInspelare() }));
      await prataOchKlar();
      fireEvent.click(screen.getByRole("button", { name: "Ångra" }));
      await flush();
      expect(screen.getByRole("alert").textContent).toBe("Händelsen gick inte att ta bort.");
      expect(screen.getByRole("status").textContent).toBe("Inlagt: Rep");
      expect(screen.getByRole("button", { name: "Stäng" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Ångra" })).not.toBeDisabled();
      act(() => vi.advanceTimersByTime(SPARAT_MS * 5));
      expect(falt()).not.toBeNull();
    } finally {
      konsol.mockRestore();
    }
  });

  it("utan kvitto är det Sparat och fältet stängs, som före 0.97.0", async () => {
    render(Skal({ onTalk: async () => "ett-id", inspelare: falskInspelare() }));
    await prataOchKlar();
    expect(screen.getByRole("status").textContent).toBe("Sparat");
    act(() => vi.advanceTimersByTime(SPARAT_MS));
    expect(falt()).toBeNull();
  });

  it("skickarText står i statusraden medan appen arbetar", async () => {
    render(Skal({ onTalk: () => new Promise(() => {}), skickarText: "Agenten arbetar…", inspelare: falskInspelare() }));
    await prataOchKlar();
    expect(screen.getByRole("status").textContent).toBe("Agenten arbetar…");
  });

  it("⛔ skalet kastar på en tom skickarText vid uppstart", () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(Skal({ onTalk: async () => {}, skickarText: "  " }))).toThrow(/skickarText/);
    } finally {
      konsol.mockRestore();
    }
  });
});

/** En inspelare som svarar direkt, för kroken. */
const vanta = () =>
  act(async () => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
  });

/** Kroken i läget sparat med ett kvitto. @param {() => Promise<void>} angra */
async function krokMedKvitto(angra) {
  const hook = renderHook(() => useTalk({ onTalk: async () => ({ kvitto: "Inlagt: Rep", angra }), onKlick: () => {}, inspelare: falskInspelare(), igenkanning: false }));
  act(() => hook.result.current.direkt());
  await vanta();
  act(() => hook.result.current.skickaIn());
  await vanta();
  expect(hook.result.current.lage).toBe("sparat");
  expect(hook.result.current.kvitto?.text).toBe("Inlagt: Rep");
  return hook;
}

describe("useTalk och kvittot", () => {
  it("⛔ ett andra tryck på Ångra medan det pågår gör ingenting", async () => {
    const svar = uppskjutet();
    const angra = vi.fn(() => svar.lofte);
    const { result } = await krokMedKvitto(angra);
    act(() => {
      result.current.angra();
      result.current.angra();
    });
    act(() => result.current.angra());
    await vanta();
    expect(angra).toHaveBeenCalledTimes(1);
    expect(result.current.kvitto?.angrar).toBe(true);
  });

  it("⛔ en ny inspelning från sparat rensar kvittot", async () => {
    const { result } = await krokMedKvitto(async () => {});
    act(() => result.current.direkt());
    await vanta();
    expect(result.current.lage).toBe("lyssnar");
    expect(result.current.kvitto).toBe(null);
  });

  it("⛔ en Ångra som faller efter avmonteringen sätter inget och rapporterar inget", async () => {
    const svar = uppskjutet();
    const { result, unmount } = await krokMedKvitto(() => svar.lofte);
    act(() => result.current.angra());
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      unmount();
      svar.avvisa(new Error("för sent"));
      await vanta();
      expect(konsol).not.toHaveBeenCalled();
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ ett felformat kvitto rapporteras, och fältet säger Sparat i stället för att visa en tom rad", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { result } = renderHook(() => useTalk({ onTalk: async () => ({ kvitto: "" }), onKlick: () => {}, inspelare: falskInspelare(), igenkanning: false }));
      act(() => result.current.direkt());
      await vanta();
      act(() => result.current.skickaIn());
      await vanta();
      expect(result.current.lage).toBe("sparat");
      expect(result.current.kvitto).toBe(null);
      expect(konsol.mock.calls.some((c) => /kvitto/.test(String(c[2]?.steg)))).toBe(true);
    } finally {
      konsol.mockRestore();
    }
  });

  it("skickarText har förvalet Sparar…, och en sträng utan innehåll eller något annat kastar", () => {
    const bas = { onTalk: async () => {}, onKlick: () => {}, inspelare: falskInspelare(), igenkanning: false };
    expect(renderHook(() => useTalk(bas)).result.current.skickarText).toBe("Sparar…");
    expect(renderHook(() => useTalk({ ...bas, skickarText: "Agenten arbetar…" })).result.current.skickarText).toBe("Agenten arbetar…");
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => renderHook(() => useTalk({ ...bas, skickarText: "" }))).toThrow(/skickarText/);
      expect(() => renderHook(() => useTalk({ ...bas, skickarText: /** @type {any} */ (5) }))).toThrow(/skickarText/);
    } finally {
      konsol.mockRestore();
    }
  });
});

describe("talkKvitto", () => {
  it("bara ett svar med kvitto är ett kvitto", () => {
    expect(talkKvitto(undefined)).toBe(null);
    expect(talkKvitto("ett-id")).toBe(null);
    expect(talkKvitto({ id: "x" })).toBe(null);
    expect(talkKvitto({ kvitto: " Inlagt " })).toEqual({ text: "Inlagt", angra: null });
  });

  it("⛔ ett kvitto utan text eller med en angra som inte är en funktion kastar", () => {
    expect(() => talkKvitto({ kvitto: "" })).toThrow(/utan text/);
    expect(() => talkKvitto({ kvitto: 3 })).toThrow(/utan text/);
    expect(() => talkKvitto({ kvitto: "Inlagt", angra: "ja" })).toThrow(/angra/);
  });
});

const faltProps = { niva: () => 0, sekunder: 2, tak: 120, framsteg: null, kanIgen: false, onKlar: () => {}, onAvbryt: () => {}, onIgen: () => {} };

describe("fältets form", () => {
  it("⛔ med text på väg och inget hört står platstexten i textytan", () => {
    const { container } = render(<OpsInspelning lage="lyssnar" medText {...faltProps} />);
    const p = /** @type {HTMLElement} */ (container.querySelector("[data-talk-platstext]"));
    expect(p.textContent).toBe(TALK_PLATSTEXT);
    expect(p.className).toContain("text-ink-muted");
    expect(container.querySelector("[data-talk-text]")).toBe(null);
  });

  it("⛔ utan igenkänning lovar fältet ingen text", () => {
    const { container } = render(<OpsInspelning lage="lyssnar" {...faltProps} />);
    expect(container.querySelector("[data-talk-platstext]")).toBe(null);
  });

  it("⛔ texten man pratar in är brödtext med en fast minsta höjd, och den rullar inuti", () => {
    render(<OpsInspelning lage="lyssnar" medText text="boka rep" {...faltProps} />);
    const klasser = screen.getByText("boka rep").className.split(/\s+/);
    expect(klasser).toEqual(expect.arrayContaining(["text-brod", "min-h-18", "overflow-y-auto"]));
  });

  it("kroken säger om text kan komma", () => {
    const bas = { onTalk: async () => {}, onKlick: () => {}, inspelare: falskInspelare() };
    expect(renderHook(() => useTalk({ ...bas, igenkanning: false })).result.current.medText).toBe(false);
    const igk = { starta: () => {}, stoppa: async () => "", kasta: () => {} };
    expect(renderHook(() => useTalk({ ...bas, igenkanning: igk })).result.current.medText).toBe(true);
  });

  it("⛔ målvalet är en rad med radioknappar under en etikett, inte staplade knappar", () => {
    const onValj = vi.fn();
    const mal = [
      { id: "forslag", etikett: "Förslag" },
      { id: "bibliotek", etikett: "Bibliotek" },
      { id: "handelse", etikett: "Händelse" },
    ];
    render(<OpsInspelning lage="lyssnar" mal={mal} valt="bibliotek" onValj={onValj} {...faltProps} />);
    const grupp = screen.getByRole("radiogroup", { name: "Skickas till" });
    const radio = within(grupp).getAllByRole("radio");
    expect(radio.map((r) => r.getAttribute("aria-checked"))).toEqual(["false", "true", "false"]);
    // En rad: alla delar i samma flexrad, lika breda, och raden staplar inte.
    expect(radio.every((r) => r.parentElement === grupp)).toBe(true);
    expect(grupp.className.split(/\s+/)).not.toContain("flex-col");
    expect(radio.every((r) => r.className.split(/\s+/).includes("flex-1") && r.className.split(/\s+/).includes("basis-0"))).toBe(true);
    fireEvent.click(within(grupp).getByRole("radio", { name: "Händelse" }));
    expect(onValj).toHaveBeenCalledWith("handelse");
  });

  it("⛔ X står till vänster och Klar fyller resten, i samma höjd", () => {
    render(<OpsInspelning lage="lyssnar" {...faltProps} />);
    const avbryt = screen.getByRole("button", { name: "Avbryt" });
    const klar = screen.getByRole("button", { name: "Klar, spara inspelningen" });
    expect(avbryt.parentElement).toBe(klar.parentElement);
    expect(avbryt.nextElementSibling).toBe(klar);
    expect(klar.className.split(/\s+/)).toContain("flex-1");
    expect(avbryt.className.split(/\s+/)).toContain("size-12");
    expect(klar.className.split(/\s+/)).toContain("min-h-12");
  });
});
