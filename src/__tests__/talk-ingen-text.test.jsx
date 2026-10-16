import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { talkMiljo, talkNasta, webblasarensIgenkanning } from "../lib/talk.js";

/*
 * Ljud utan text: valen står ändå, Anteckning är ett val, och orsaken mäts (cllp/ops-framework#402, 0.114.0).
 *
 * CP 2026-10-17, iPhone: han pratade in, "Agenten arbetar…" visades, och han hamnade direkt i chatten utan att få välja. *"Man ska få
 * valet när man har pratat in, inte att agenten går iväg och lägger det i chatten direkt."* Rotorsaken, läst i koden: valen (läget
 * `hort`) ritades bara när taligenkänningen gav text medan personen pratade. Utan text gick ljudet till `onTalk`, och appen skickade det
 * vidare till agenten: appen valde åt personen. Varför telefonens text uteblev var inte mätt, och felrapporten skickades bara när
 * varken ljud eller text fanns.
 *
 * ⛔ PROVEN GÅR GENOM SKALET (`OpsAppShell talk={...}`), så att vägen från appens `talk` till fältet och valen provas, som i talk-val.
 */

/** En inspelare med ett ljud som har byte. */
function falskInspelare() {
  return {
    starta: vi.fn(() => Promise.resolve()),
    stoppa: vi.fn(() => Promise.resolve({ blob: new Blob(["ljud"], { type: "audio/webm" }), mimeType: "audio/webm", sekunder: 2 })),
    kasta: vi.fn(),
    niva: () => 0.5,
  };
}

/** En igenkänning som aldrig hör något: texten blir tom. */
function stumIgenkanning() {
  return { starta: vi.fn(), stoppa: vi.fn().mockResolvedValue(""), kasta: vi.fn() };
}

const fasta = { idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };
const FORMULAR = { lage: "g1", handelse: { form: () => <form />, katalog: null }, arende: () => <form /> };
const flush = () =>
  act(async () => {
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
  });
const falt = () => screen.queryByRole("dialog", { name: "TALK" });
const huvudMikrofon = () => /** @type {HTMLElement} */ (document.querySelector("[data-talk-huvud]"));
const valen = () => [...document.querySelectorAll("[data-talk-valt]")].map((k) => /** @type {string} */ (k.textContent));
/** @param {string} namn */
const val = (namn) => screen.getByRole("button", { name: namn });

/** @returns {{ lofte: Promise<string>, los: (t: string) => void, avvisa: (e: Error) => void }} */
function uppskjuten() {
  /** @type {any} */ let los;
  /** @type {any} */ let avvisa;
  const lofte = new Promise((a, b) => {
    los = a;
    avvisa = b;
  });
  return { lofte, los, avvisa };
}

/** @param {{ talk?: any, skapa?: any }} [val] */
function Skal({ talk = {}, skapa } = {}) {
  const onTalk = vi.fn(async () => {});
  const t = { onTalk, inspelare: falskInspelare(), igenkanning: stumIgenkanning(), ...talk };
  render(
    <OpsAppShell brand="Ops" fasta={fasta} moduler={[]} activeHref="/" talk={t} {...(skapa ? { skapa } : {})}>
      <p>innehåll</p>
    </OpsAppShell>,
  );
  return t;
}

async function prata() {
  fireEvent.click(huvudMikrofon());
  await flush();
  fireEvent.click(screen.getByRole("button", { name: /^(Klar|Done)/ }));
  await flush();
}

/**
 * Felrapporterna med ett visst steg, ur konsolen (`rapporteraFel` skriver alltid dit).
 * @param {import("vitest").MockInstance} konsol @param {string} steg
 */
function rapporter(konsol, steg) {
  return konsol.mock.calls.filter((c) => c[2] && typeof c[2] === "object" && c[2].steg === steg).map((c) => c[2]);
}

describe("ljud utan text med agent: valen står, och inget lämnas förrän personen trycker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("⛔ valen visas direkt, och varken onAgent, onTalk eller något val anropas av sig självt", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const onAgent = vi.fn();
      const onMeddelande = vi.fn();
      const t = Skal({ talk: { onAgent, onMeddelande }, skapa: FORMULAR });
      await prata();
      const dialog = /** @type {HTMLElement} */ (falt());
      expect(dialog.getAttribute("data-lage")).toBe("hort");
      expect(valen()).toEqual(["Meddelande", "Händelse", "Ärende", "Agent"]);
      expect(t.onTalk).not.toHaveBeenCalled();
      expect(onAgent).not.toHaveBeenCalled();
      expect(onMeddelande).not.toHaveBeenCalled();
      // Inget har lämnats kvar att skriva ut: utan `tillText` säger fältet det rakt ut (regel 5), och valen står kvar.
      expect(within(dialog).getByRole("alert").textContent).toMatch(/Ingen text kom fram/);
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ utan text och utan tillText gör ett tryck på Agent ingenting med ljudet: beskedet står kvar och inget lämnas", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const onAgent = vi.fn();
      const t = Skal({ talk: { onAgent } });
      await prata();
      fireEvent.click(val("Agent"));
      await flush();
      expect(onAgent).not.toHaveBeenCalled();
      expect(t.onTalk).not.toHaveBeenCalled();
      expect(/** @type {HTMLElement} */ (falt()).getAttribute("data-lage")).toBe("hort");
      expect(within(/** @type {HTMLElement} */ (falt())).getByRole("alert").textContent).toMatch(/Ingen text kom fram/);
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ med tillText: Skriver ut… medan den arbetar, texten fylls i, och Agent lämnar den ifyllda texten", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const u = uppskjuten();
      const tillText = vi.fn(() => u.lofte);
      const onAgent = vi.fn(async () => {});
      const t = Skal({ talk: { onAgent, tillText } });
      await prata();
      const dialog = /** @type {HTMLElement} */ (falt());
      expect(dialog.getAttribute("data-lage")).toBe("hort");
      expect(tillText).toHaveBeenCalledTimes(1);
      const [blob, meta] = /** @type {[Blob, any]} */ (/** @type {unknown} */ (tillText.mock.calls[0]));
      expect(blob.size).toBeGreaterThan(0);
      expect(meta).toEqual({ mimeType: "audio/webm", sekunder: 2 });
      expect(within(dialog).getByRole("status").textContent).toBe("Skriver ut…");
      // Valen går att trycka under tiden, och inget har lämnats.
      expect(valen()).toEqual(["Agent"]);
      expect(onAgent).not.toHaveBeenCalled();
      expect(t.onTalk).not.toHaveBeenCalled();

      await act(async () => u.los("  Boka rep på torsdag  "));
      await flush();
      expect(within(dialog).getByText("Boka rep på torsdag")).toBeTruthy();
      expect(within(dialog).getByRole("status").textContent).toBe("");
      expect(onAgent).not.toHaveBeenCalled();

      fireEvent.click(val("Agent"));
      await flush();
      expect(onAgent).toHaveBeenCalledTimes(1);
      expect(onAgent).toHaveBeenCalledWith("Boka rep på torsdag");
      expect(t.onTalk).not.toHaveBeenCalled();
      expect(falt()).toBeNull();
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ ett val före texten väntar på den, och lämnar den en gång när den kommit", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const u = uppskjuten();
      const onAgent = vi.fn(async () => {});
      Skal({ talk: { onAgent, tillText: () => u.lofte } });
      await prata();
      fireEvent.click(val("Agent"));
      await flush();
      // Texten finns inte än: ingenting lämnas, och valet väntar.
      expect(onAgent).not.toHaveBeenCalled();
      expect(val("Agent").getAttribute("aria-busy")).toBe("true");
      await act(async () => u.los("Ring revisorn"));
      await flush();
      expect(onAgent).toHaveBeenCalledTimes(1);
      expect(onAgent).toHaveBeenCalledWith("Ring revisorn");
      expect(falt()).toBeNull();
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ faller utskriften står felet i fältet och valen kvar, ingenting lämnas, och ett tryck skriver ut igen", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const tillText = vi.fn().mockRejectedValueOnce(new Error("Utskriften nådde inte servern.")).mockResolvedValueOnce("Köp noter");
      const onAgent = vi.fn(async () => {});
      const t = Skal({ talk: { onAgent, tillText } });
      await prata();
      const dialog = /** @type {HTMLElement} */ (falt());
      expect(within(dialog).getByRole("alert").textContent).toBe("Utskriften nådde inte servern.");
      expect(valen()).toEqual(["Agent"]);
      expect(onAgent).not.toHaveBeenCalled();
      expect(t.onTalk).not.toHaveBeenCalled();
      expect(rapporter(konsol, "utskrift")).toHaveLength(1);

      // Trycket försöker igen, och valet väntar på det nya svaret.
      fireEvent.click(val("Agent"));
      await flush();
      expect(tillText).toHaveBeenCalledTimes(2);
      expect(onAgent).toHaveBeenCalledTimes(1);
      expect(onAgent).toHaveBeenCalledWith("Köp noter");
      expect(t.onTalk).not.toHaveBeenCalled();
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ en tom utskrift är ett fel och inte en text: inget lämnas", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const onAgent = vi.fn();
      Skal({ talk: { onAgent, tillText: async () => "   " } });
      await prata();
      expect(within(/** @type {HTMLElement} */ (falt())).getByRole("alert").textContent).toMatch(/Ingen text kom fram/);
      expect(onAgent).not.toHaveBeenCalled();
    } finally {
      konsol.mockRestore();
    }
  });

  it("Stäng medan utskriften arbetar kastar ljudet, och ett sent svar gör ingenting", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const u = uppskjuten();
      const onAgent = vi.fn();
      Skal({ talk: { onAgent, tillText: () => u.lofte } });
      await prata();
      fireEvent.click(screen.getByRole("button", { name: "Stäng" }));
      await flush();
      expect(falt()).toBeNull();
      await act(async () => u.los("för sent"));
      await flush();
      expect(falt()).toBeNull();
      expect(onAgent).not.toHaveBeenCalled();
    } finally {
      konsol.mockRestore();
    }
  });
});

describe("utan agent är beteendet som förut", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("⛔ ljud utan text går till onTalk, tillText anropas inte, och orsaken mäts ändå", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const tillText = vi.fn(async () => "x");
      const t = Skal({ talk: { tillText } });
      await prata();
      expect(document.querySelector("[data-talk-val]")).toBeNull();
      expect(t.onTalk).toHaveBeenCalledTimes(1);
      expect(/** @type {any} */ (t.onTalk.mock.calls[0])[1].text).toBeUndefined();
      expect(tillText).not.toHaveBeenCalled();
      expect(rapporter(konsol, "ingen-text")).toHaveLength(1);
    } finally {
      konsol.mockRestore();
    }
  });
});

describe("felrapporten ingen-text", () => {
  /** @type {any} */
  let matchMediaFore;
  beforeEach(() => {
    vi.useFakeTimers();
    matchMediaFore = window.matchMedia;
  });
  afterEach(() => {
    vi.useRealTimers();
    window.matchMedia = matchMediaFore;
    cleanup();
  });

  /** En falsk SpeechRecognition som startar och sedan kan fälla med en felkod. */
  function falskSR() {
    /** @type {any[]} */
    const instanser = [];
    class SR {
      constructor() {
        this.lang = "";
        /** @type {any} */ this.onresult = null;
        /** @type {any} */ this.onerror = null;
        /** @type {any} */ this.onend = null;
        /** @type {any} */ this.onstart = null;
        instanser.push(this);
      }
      start() {}
      stop() {
        queueMicrotask(() => this.onend?.());
      }
      abort() {
        queueMicrotask(() => this.onend?.());
      }
    }
    return { SR, instanser };
  }

  it.each(["not-allowed", "service-not-allowed", "no-speech", "aborted"])("⛔ bär igenkänningens felkod %s, och inget av det personen sa", async (kod) => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      window.matchMedia = /** @type {any} */ (vi.fn(() => ({ matches: true })));
      const { SR, instanser } = falskSR();
      const igenkanning = webblasarensIgenkanning({ SpeechRecognition: SR });
      Skal({ talk: { onAgent: vi.fn(), igenkanning } });
      fireEvent.click(huvudMikrofon());
      await flush();
      act(() => instanser[0].onstart?.());
      act(() => instanser[0].onerror({ error: kod }));
      fireEvent.click(screen.getByRole("button", { name: /^Klar/ }));
      await flush();

      const rapport = rapporter(konsol, "ingen-text");
      expect(rapport).toHaveLength(1);
      expect(rapport[0]).toMatchObject({
        yta: "OpsTalk",
        steg: "ingen-text",
        igenkanning: true,
        utanIgenkanning: null,
        igenkanningStartade: true,
        igenkanningStartHandelse: true,
        igenkanningFelkod: kod,
        omgang: 1,
        standalone: true,
        userAgent: navigator.userAgent,
        sekunder: 2,
        medVal: true,
        medUtskrift: false,
      });
      // Ingen text från personen i rapporten: bara siffror, flaggor och koder.
      expect(Object.values(rapport[0]).every((v) => v === null || ["string", "number", "boolean"].includes(typeof v))).toBe(true);
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ en igenkänning som aldrig startade bär startade: false och ingen felkod", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      window.matchMedia = /** @type {any} */ (vi.fn(() => ({ matches: false })));
      class SR {
        constructor() {
          /** @type {any} */ this.onend = null;
        }
        start() {
          throw new DOMException("Redan igång", "InvalidStateError");
        }
        stop() {}
        abort() {}
      }
      Skal({ talk: { onAgent: vi.fn(), igenkanning: webblasarensIgenkanning({ SpeechRecognition: /** @type {any} */ (SR) }) } });
      await prata();
      const rapport = rapporter(konsol, "ingen-text");
      expect(rapport).toHaveLength(1);
      expect(rapport[0]).toMatchObject({ igenkanning: true, igenkanningStartade: false, igenkanningStartHandelse: false, igenkanningFelkod: "InvalidStateError", standalone: false });
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ utan igenkänning säger rapporten varför: avstängd av appen", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      Skal({ talk: { onAgent: vi.fn(), igenkanning: false } });
      await prata();
      const rapport = rapporter(konsol, "ingen-text");
      expect(rapport).toHaveLength(1);
      expect(rapport[0]).toMatchObject({ igenkanning: false, utanIgenkanning: "avstangd", igenkanningStartade: null, igenkanningFelkod: null });
    } finally {
      konsol.mockRestore();
    }
  });

  it("golvet: hördes text skickas ingen ingen-text, så provet mäter villkoret och inte ett fält som alltid rapporterar", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const igenkanning = { starta: vi.fn(), stoppa: vi.fn().mockResolvedValue("Hej"), kasta: vi.fn() };
      Skal({ talk: { onAgent: vi.fn(), igenkanning } });
      await prata();
      expect(/** @type {HTMLElement} */ (falt()).getAttribute("data-lage")).toBe("hort");
      expect(rapporter(konsol, "ingen-text")).toHaveLength(0);
    } finally {
      konsol.mockRestore();
    }
  });
});

describe("Anteckning, det femte valet", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  /** @param {any} [talk] */
  const medText = (talk = {}) => Skal({ talk: { igenkanning: { starta: vi.fn(), stoppa: vi.fn().mockResolvedValue("Kom ihåg kablarna"), kasta: vi.fn() }, ...talk }, skapa: FORMULAR });

  it("⛔ syns bara när onAnteckning getts, före Agent, och inte annars", async () => {
    medText({ onAgent: vi.fn(), onMeddelande: vi.fn() });
    await prata();
    expect(valen()).toEqual(["Meddelande", "Händelse", "Ärende", "Agent"]);
    cleanup();

    medText({ onAgent: vi.fn(), onMeddelande: vi.fn(), onAnteckning: vi.fn() });
    await prata();
    expect(valen()).toEqual(["Meddelande", "Händelse", "Ärende", "Anteckning", "Agent"]);
    // Fem val: det sista tar hela raden, så rutnätet inte lämnar ett hål.
    expect(val("Agent").className).toContain("col-span-2");
    expect(val("Anteckning").className).not.toContain("col-span-2");
  });

  it("⛔ anropar onAnteckning med texten, säger Sparar… medan löftet arbetar, och stänger fältet när det löst sig", async () => {
    const u = uppskjuten();
    const onAnteckning = vi.fn(() => u.lofte.then(() => {}));
    const onAgent = vi.fn();
    const t = medText({ onAgent, onAnteckning });
    await prata();
    expect(onAnteckning).not.toHaveBeenCalled();
    fireEvent.click(val("Anteckning"));
    await flush();
    expect(onAnteckning).toHaveBeenCalledTimes(1);
    expect(onAnteckning).toHaveBeenCalledWith("Kom ihåg kablarna");
    const dialog = /** @type {HTMLElement} */ (falt());
    expect(dialog.getAttribute("data-lage")).toBe("skickar");
    expect(within(dialog).getByRole("status").textContent).toBe("Sparar…");
    await act(async () => u.los("klart"));
    await flush();
    expect(falt()).toBeNull();
    expect(onAgent).not.toHaveBeenCalled();
    expect(t.onTalk).not.toHaveBeenCalled();
  });

  it("⛔ en Anteckning säger Sparar… och inte appens text för agenten", async () => {
    const u = uppskjuten();
    medText({ onAgent: vi.fn(), onAnteckning: () => u.lofte.then(() => {}), skickarText: "Agenten arbetar…" });
    await prata();
    fireEvent.click(val("Anteckning"));
    await flush();
    expect(within(/** @type {HTMLElement} */ (falt())).getByRole("status").textContent).toBe("Sparar…");
    await act(async () => u.los("x"));
    await flush();
  });

  it("⛔ faller onAnteckning står felet i fältet, texten och alla valen kvar, och ett nytt tryck försöker igen", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const onAnteckning = vi.fn().mockRejectedValueOnce(new Error("Biblioteket svarade inte.")).mockResolvedValue(undefined);
      medText({ onAgent: vi.fn(), onMeddelande: vi.fn(), onAnteckning });
      await prata();
      fireEvent.click(val("Anteckning"));
      await flush();
      const dialog = /** @type {HTMLElement} */ (falt());
      expect(dialog.getAttribute("data-lage")).toBe("hort");
      expect(within(dialog).getByRole("alert").textContent).toBe("Biblioteket svarade inte.");
      expect(within(dialog).getByText("Kom ihåg kablarna")).toBeTruthy();
      expect(valen()).toEqual(["Meddelande", "Händelse", "Ärende", "Anteckning", "Agent"]);
      expect(rapporter(konsol, "anteckning")).toHaveLength(1);
      fireEvent.click(val("Anteckning"));
      await flush();
      expect(onAnteckning).toHaveBeenCalledTimes(2);
      expect(falt()).toBeNull();
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ en Anteckning som tryckts före texten väntar på den, och sparar den utskrivna texten", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const u = uppskjuten();
      const onAnteckning = vi.fn(async () => {});
      Skal({ talk: { onAgent: vi.fn(), onAnteckning, tillText: () => u.lofte } });
      await prata();
      fireEvent.click(val("Anteckning"));
      await flush();
      expect(onAnteckning).not.toHaveBeenCalled();
      await act(async () => u.los("Ring Kim"));
      await flush();
      expect(onAnteckning).toHaveBeenCalledWith("Ring Kim");
      expect(falt()).toBeNull();
    } finally {
      konsol.mockRestore();
    }
  });

  it("skalet kastar på en onAnteckning eller tillText som inte är en funktion", () => {
    const onTalk = async () => {};
    expect(() => render(<OpsAppShell brand="Ops" fasta={fasta} moduler={[]} activeHref="/" talk={/** @type {any} */ ({ onTalk, onAnteckning: "x" })}><p>a</p></OpsAppShell>)).toThrow(/talk\.onAnteckning ska vara en funktion/);
    expect(() => render(<OpsAppShell brand="Ops" fasta={fasta} moduler={[]} activeHref="/" talk={/** @type {any} */ ({ onTalk, tillText: 5 })}><p>a</p></OpsAppShell>)).toThrow(/talk\.tillText ska vara en funktion/);
  });
});

describe("flödet och miljön", () => {
  it("talkNasta: Anteckning går från hört till skickar, ett fel tillbaka till hört med felet, och lämnat stänger", () => {
    expect(talkNasta({ lage: "hort" }, { typ: "anteckning" })).toEqual({ lage: "skickar", gor: "anteckning" });
    expect(talkNasta({ lage: "skickar" }, { typ: "anteckningFel", text: "Nej" })).toEqual({ lage: "hort", gor: null, fel: "Nej" });
    expect(talkNasta({ lage: "skickar" }, { typ: "lamnat" })).toEqual({ lage: "vila", gor: "kasta" });
    // Utanför hört gör Anteckning ingenting.
    expect(talkNasta({ lage: "vila" }, { typ: "anteckning" })).toEqual({ lage: "vila", gor: null });
  });

  it("talkMiljo: standalone ur display-mode eller navigator.standalone, null när det inte går att mäta", () => {
    expect(talkMiljo({ matchMedia: () => ({ matches: true }), navigator: { userAgent: "UA" } })).toEqual({ standalone: true, userAgent: "UA" });
    expect(talkMiljo({ matchMedia: () => ({ matches: false }), navigator: { userAgent: "UA" } })).toEqual({ standalone: false, userAgent: "UA" });
    expect(talkMiljo({ matchMedia: () => ({ matches: false }), navigator: { standalone: true, userAgent: "UA" } }).standalone).toBe(true);
    expect(talkMiljo({ navigator: { standalone: false, userAgent: "UA" }, matchMedia: undefined })).toMatchObject({ userAgent: "UA" });
    expect(talkMiljo({ matchMedia: () => { throw new Error("nej"); }, navigator: { userAgent: "UA" } })).toEqual({ standalone: null, userAgent: "UA" });
  });

  it("webblasarensIgenkanning.diagnos: nollas av varje omgång och bär den senaste felkoden", () => {
    /** @type {any[]} */
    const instanser = [];
    class SR {
      constructor() {
        instanser.push(this);
      }
      start() {}
      stop() {}
      abort() {}
    }
    const g = /** @type {NonNullable<ReturnType<typeof webblasarensIgenkanning>>} */ (webblasarensIgenkanning({ SpeechRecognition: /** @type {any} */ (SR) }));
    expect(/** @type {any} */ (g).diagnos()).toEqual({ startade: false, startHandelse: false, felkod: null });
    g.starta({ sprak: "sv-SE", onText: () => {}, onFel: () => {} });
    instanser[0].onstart();
    instanser[0].onerror({ error: "no-speech" });
    expect(/** @type {any} */ (g).diagnos()).toEqual({ startade: true, startHandelse: true, felkod: "no-speech" });
    g.starta({ sprak: "sv-SE", onText: () => {}, onFel: () => {} });
    expect(/** @type {any} */ (g).diagnos()).toEqual({ startade: true, startHandelse: false, felkod: null });
  });
});
