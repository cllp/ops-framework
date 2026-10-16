import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { OpsAppShell, useOppnaInspelning } from "../components/OpsAppShell.jsx";
import { validateModuler } from "../lib/modul.js";

/*
 * TALK med valen på WebKit kör BARA igenkänningen (cllp/ops-framework#402, tillägg 3, 0.114.0).
 *
 * Sedan 0.110.0 (#253) gav `webblasarensIgenkanning` `null` på WebKit, eftersom SpeechRecognition och MediaRecorder slogs om mikrofonen.
 * Följden: iPhone och iPad fick aldrig levande text, och då aldrig de snabba valen. Det är regressionen CP märkte. Nu kör TALK med valen
 * (`onAgent`, inget låst inspelningsmål) bara igenkänningen på WebKit och startar ingen inspelare, så ingen slåss om mikrofonen. Faller
 * igenkänningen eller blir texten tom säger fältet det och erbjuder "Spela in i stället", som kör inspelningen utan igenkänning.
 *
 * ⛔ WEBKIT SIMULERAS MED USER AGENT-STRÄNGEN (`arWebKit`), och SpeechRecognition är en falsk klass på `globalThis`: det som provas är
 * ramverkets val av väg, inte Apples taltjänst. Det mäter koden mot regeln, inte regeln mot en riktig iPhone.
 */

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const fasta = { idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };
const flush = () =>
  act(async () => {
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
  });
const falt = () => screen.queryByRole("dialog", { name: "TALK" });
const huvudMikrofon = () => /** @type {HTMLElement} */ (document.querySelector("[data-talk-huvud]"));
const valen = () => [...document.querySelectorAll("[data-talk-valt]")].map((k) => /** @type {string} */ (k.textContent));
const klar = async () => {
  fireEvent.click(screen.getByRole("button", { name: /^(Klar|Done)/ }));
  await flush();
};

/** @type {any[]} */
let igenkannare = [];
class FalskSR {
  constructor() {
    this.lang = "";
    /** @type {any} */ this.onresult = null;
    /** @type {any} */ this.onerror = null;
    /** @type {any} */ this.onend = null;
    /** @type {any} */ this.onstart = null;
    this.startad = false;
    igenkannare.push(this);
  }
  start() {
    this.startad = true;
  }
  stop() {
    queueMicrotask(() => this.onend?.());
  }
  abort() {
    queueMicrotask(() => this.onend?.());
  }
}
/** Personen säger något: den senaste igenkännaren hör det. @param {string} t */
const sag = (t) => act(() => igenkannare[igenkannare.length - 1].onresult({ resultIndex: 0, results: [Object.assign([{ transcript: t }], { isFinal: true })] }));

function falskInspelare() {
  return {
    starta: vi.fn(() => Promise.resolve()),
    stoppa: vi.fn(() => Promise.resolve({ blob: new Blob(["ljud"], { type: "audio/mp4" }), mimeType: "audio/mp4", sekunder: 2 })),
    kasta: vi.fn(),
    niva: () => 0.5,
  };
}

/** @param {{ talk?: any, children?: any, skapa?: any }} [val] */
function Skal({ talk = {}, children = <p>innehåll</p>, skapa } = {}) {
  const t = { onTalk: vi.fn(async () => {}), inspelare: falskInspelare(), igenkanning: true, ...talk };
  render(
    <OpsAppShell brand="Ops" fasta={fasta} moduler={[]} activeHref="/" talk={t} {...(skapa ? { skapa } : {})}>
      {children}
    </OpsAppShell>,
  );
  return t;
}

/** @param {import("vitest").MockInstance} konsol @param {string} steg */
const rapporter = (konsol, steg) => konsol.mock.calls.filter((c) => c[2] && typeof c[2] === "object" && c[2].steg === steg).map((c) => c[2]);

describe("WebKit: TALK med valen kör bara igenkänningen", () => {
  /** @type {import("vitest").MockInstance} */
  let ua;
  beforeEach(() => {
    vi.useFakeTimers();
    igenkannare = [];
    /** @type {any} */ (globalThis).webkitSpeechRecognition = FalskSR;
    ua = vi.spyOn(navigator, "userAgent", "get").mockReturnValue(IPHONE);
  });
  afterEach(() => {
    vi.useRealTimers();
    ua.mockRestore();
    delete (/** @type {any} */ (globalThis).webkitSpeechRecognition);
    cleanup();
  });

  it("⛔ igenkänningen startar och ingen inspelare, texten växer fram, och valen kommer direkt vid Klar", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const onAgent = vi.fn(async () => {});
      const t = Skal({ talk: { onAgent } });
      fireEvent.click(huvudMikrofon());
      await flush();
      expect(igenkannare).toHaveLength(1);
      expect(igenkannare[0].startad).toBe(true);
      expect(t.inspelare.starta).not.toHaveBeenCalled();
      // Textytan är där från början, med sin platstext.
      expect(document.querySelector("[data-talk-platstext]")).not.toBeNull();

      await sag("boka rep på torsdag");
      expect(within(/** @type {HTMLElement} */ (falt())).getByText("boka rep på torsdag")).toBeTruthy();

      await klar();
      const dialog = /** @type {HTMLElement} */ (falt());
      expect(dialog.getAttribute("data-lage")).toBe("hort");
      expect(valen()).toEqual(["Agent"]);
      expect(within(dialog).getByText("boka rep på torsdag")).toBeTruthy();
      expect(t.inspelare.stoppa).not.toHaveBeenCalled();
      expect(t.onTalk).not.toHaveBeenCalled();
      expect(onAgent).not.toHaveBeenCalled();
      // Inget ingen-text: texten kom.
      expect(rapporter(konsol, "ingen-text")).toHaveLength(0);

      fireEvent.click(screen.getByRole("button", { name: "Agent" }));
      await flush();
      expect(onAgent).toHaveBeenCalledWith("boka rep på torsdag");
      expect(t.onTalk).not.toHaveBeenCalled();
      expect(falt()).toBeNull();
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ faller igenkänningen med not-allowed visas felet med Spela in i stället, och trycket startar inspelaren utan igenkänning och sedan tillText", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const onAgent = vi.fn(async () => {});
      const tillText = vi.fn(async () => "ring revisorn");
      const t = Skal({ talk: { onAgent, tillText } });
      fireEvent.click(huvudMikrofon());
      await flush();
      act(() => igenkannare[0].onerror({ error: "not-allowed" }));
      await flush();

      const dialog = /** @type {HTMLElement} */ (falt());
      expect(dialog.getAttribute("data-lage")).toBe("fel");
      expect(within(dialog).getByRole("alert").textContent).toMatch(/kunde inte skrivas ut medan du pratade/);
      // Felet rapporteras med ingen-text och felkoden, som tidigare.
      const rapport = rapporter(konsol, "ingen-text");
      expect(rapport).toHaveLength(1);
      expect(rapport[0]).toMatchObject({ igenkanning: true, igenkanningFelkod: "not-allowed", igenkanningStartade: true, baraIgenkanning: true, omgang: 1 });
      expect(t.inspelare.starta).not.toHaveBeenCalled();
      expect(t.onTalk).not.toHaveBeenCalled();

      // Spela in i stället: inspelningen, utan någon ny igenkänning (WebKit ger ingen vid en vanlig omgång).
      fireEvent.click(within(dialog).getByRole("button", { name: "Spela in i stället" }));
      await flush();
      expect(t.inspelare.starta).toHaveBeenCalledTimes(1);
      expect(igenkannare).toHaveLength(1);
      expect(/** @type {HTMLElement} */ (falt()).getAttribute("data-lage")).toBe("lyssnar");

      await klar();
      expect(t.inspelare.stoppa).toHaveBeenCalledTimes(1);
      // Ljudet skrivs ut av appen, och valen står med texten. Inget lämnades av sig självt.
      expect(tillText).toHaveBeenCalledTimes(1);
      expect(/** @type {HTMLElement} */ (falt()).getAttribute("data-lage")).toBe("hort");
      expect(within(/** @type {HTMLElement} */ (falt())).getByText("ring revisorn")).toBeTruthy();
      expect(onAgent).not.toHaveBeenCalled();
      expect(t.onTalk).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Agent" }));
      await flush();
      expect(onAgent).toHaveBeenCalledWith("ring revisorn");
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ en tom text vid Klar (bara tystnad) ger samma väg: felet, felkoden no-speech, och Spela in i stället", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const t = Skal({ talk: { onAgent: vi.fn() } });
      fireEvent.click(huvudMikrofon());
      await flush();
      act(() => igenkannare[0].onerror({ error: "no-speech" }));
      await klar();
      const dialog = /** @type {HTMLElement} */ (falt());
      expect(dialog.getAttribute("data-lage")).toBe("fel");
      expect(within(dialog).getByRole("button", { name: "Spela in i stället" })).toBeTruthy();
      expect(rapporter(konsol, "ingen-text")[0]).toMatchObject({ igenkanningFelkod: "no-speech", baraIgenkanning: true });
      expect(t.onTalk).not.toHaveBeenCalled();
      expect(t.inspelare.starta).not.toHaveBeenCalled();
      // Krysset stänger, och då finns inget kvar att skicka.
      fireEvent.click(within(dialog).getByRole("button", { name: "Avbryt" }));
      await flush();
      expect(falt()).toBeNull();
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ en app utan onAgent behåller dagens WebKit-väg: bara inspelning, ingen igenkänning, ljudet till onTalk", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const t = Skal({ talk: {} });
      fireEvent.click(huvudMikrofon());
      await flush();
      expect(t.inspelare.starta).toHaveBeenCalledTimes(1);
      expect(igenkannare).toHaveLength(0);
      await klar();
      expect(t.onTalk).toHaveBeenCalledTimes(1);
      expect(/** @type {Blob} */ (/** @type {any} */ (t.onTalk.mock.calls[0])[0]).size).toBeGreaterThan(0);
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ ett låst inspelningsmål (Biblioteket, Röstinspelning) startar bara inspelaren, också med onAgent", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const spara = vi.fn(async () => {});
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
      const onAgent = vi.fn();
      const Rad = () => {
        const oppna = useOppnaInspelning();
        return <button type="button" onClick={() => oppna("bibliotek")}>Röstinspelning i Biblioteket</button>;
      };
      const t = Skal({
        talk: { onAgent },
        children: <Rad />,
        skapa: { lage: "g", moduler: validateModuler([modul]), aktivGrupp: { id: "g", moduler: ["bibliotek"] } },
      });
      fireEvent.click(screen.getByRole("button", { name: "Röstinspelning i Biblioteket" }));
      await flush();
      expect(t.inspelare.starta).toHaveBeenCalledTimes(1);
      expect(igenkannare).toHaveLength(0);
      await klar();
      expect(spara).toHaveBeenCalledTimes(1);
      expect(/** @type {Blob} */ (/** @type {any} */ (spara.mock.calls[0])[0].blob).size).toBeGreaterThan(0);
      expect(onAgent).not.toHaveBeenCalled();
      expect(t.onTalk).not.toHaveBeenCalled();
    } finally {
      konsol.mockRestore();
    }
  });

  it("utanför WebKit (Chrome) ändras inget: igenkänning och inspelning samtidigt", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      ua.mockReturnValue(CHROME);
      const onAgent = vi.fn();
      const t = Skal({ talk: { onAgent } });
      fireEvent.click(huvudMikrofon());
      await flush();
      expect(igenkannare).toHaveLength(1);
      expect(t.inspelare.starta).toHaveBeenCalledTimes(1);
      await sag("hej");
      await klar();
      expect(/** @type {HTMLElement} */ (falt()).getAttribute("data-lage")).toBe("hort");
      expect(t.inspelare.stoppa).toHaveBeenCalledTimes(1);
    } finally {
      konsol.mockRestore();
    }
  });

  it("utan igenkanning: true (appen har stängt av den) finns ingen igenkänning på WebKit heller, och inspelningen körs", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const t = Skal({ talk: { onAgent: vi.fn(), igenkanning: false } });
      fireEvent.click(huvudMikrofon());
      await flush();
      expect(igenkannare).toHaveLength(0);
      expect(t.inspelare.starta).toHaveBeenCalledTimes(1);
    } finally {
      konsol.mockRestore();
    }
  });
});
