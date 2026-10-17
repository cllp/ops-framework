import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsInspelning } from "../components/OpsTalk.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { IGENKANNING_AVTA_MS, skapaIgenkanningsniva, talkAnteckningsLank } from "../lib/talk.js";

/*
 * TALK efter 0.114.0, finputsen (cllp/lifehub.app#345 och #347, 0.115.0).
 *
 * CP på iPhone 2026-10-17: "det går snabbt och fint och texten kommer upp i realtid, även menyerna", men inga ljudvågor, textytan rullar
 * inte med, ingen bekräftelse efter Anteckning, och ingen urklippsknapp. Fyra saker, och provet för var och en är skrivet så att det är
 * rött utan ändringen och grönt med den.
 *
 * ⛔ WEBKIT SIMULERAS MED USER AGENT-STRÄNGEN och SpeechRecognition är en falsk klass: det som provas är ramverkets val av väg och vad som
 * ritas, inte Apples taltjänst. jsdom har ingen layout och ingen CSS, så rullningen provas mot mått som provet själv sätter
 * (`scrollHeight`, `clientHeight`) och höjden på prickarna mot deras `style`. Hur det SER UT på en telefon provar de här inte.
 */

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const fasta = { idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };
const flush = () =>
  act(async () => {
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
  });
/** Låter tiden gå och React rita om. @param {number} ms */
const gaTid = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const falt = () => screen.queryByRole("dialog", { name: "TALK" });
const huvudMikrofon = () => /** @type {HTMLElement} */ (document.querySelector("[data-talk-huvud]"));
const valen = () => [...document.querySelectorAll("[data-talk-valt]")].map((k) => /** @type {string} */ (k.textContent));
/** @param {string} namn */
const val = (namn) => screen.getByRole("button", { name: namn });
/** Höjderna på nivåprickarna i px, äldst först. */
const hojder = () => [...document.querySelectorAll("[data-talk-prickar] > span")].map((s) => parseInt(/** @type {HTMLElement} */ (s).style.height, 10));
/** Genomskinligheten på prickarna. */
const dis = () => [...document.querySelectorAll("[data-talk-prickar] > span")].map((s) => Number(/** @type {HTMLElement} */ (s).style.opacity));
const PLAN = 6;

/** @param {import("vitest").MockInstance} konsol @param {string} steg */
const rapporter = (konsol, steg) => konsol.mock.calls.filter((c) => c[2] && typeof c[2] === "object" && c[2].steg === steg).map((c) => c[2]);

/** @type {any[]} */
let igenkannare = [];
class FalskSR {
  constructor() {
    this.lang = "";
    /** @type {any} */ this.onresult = null;
    /** @type {any} */ this.onerror = null;
    /** @type {any} */ this.onend = null;
    /** @type {any} */ this.onstart = null;
    /** @type {any} */ this.onsoundstart = null;
    /** @type {any} */ this.onspeechstart = null;
    /** @type {any} */ this.onspeechend = null;
    igenkannare.push(this);
  }
  start() {}
  stop() {
    queueMicrotask(() => this.onend?.());
  }
  abort() {
    queueMicrotask(() => this.onend?.());
  }
}
/** Personen säger något: den senaste igenkännaren hör det. @param {string} t */
const sag = (t) => act(() => igenkannare[igenkannare.length - 1].onresult({ resultIndex: 0, results: [Object.assign([{ transcript: t }], { isFinal: true })] }));
/** En av webbläsarens ljudhändelser på den senaste igenkännaren. @param {"onsoundstart" | "onspeechstart" | "onspeechend"} namn */
const handelse = (namn) => act(() => igenkannare[igenkannare.length - 1][namn]?.());

function falskInspelare(niva = 0.5) {
  return {
    starta: vi.fn(() => Promise.resolve()),
    stoppa: vi.fn(() => Promise.resolve({ blob: new Blob(["ljud"], { type: "audio/mp4" }), mimeType: "audio/mp4", sekunder: 2 })),
    kasta: vi.fn(),
    niva: () => niva,
  };
}

/** @param {{ talk?: any, skapa?: any, sprak?: string, onNavigate?: any }} [val] */
function Skal({ talk = {}, skapa, sprak, onNavigate } = {}) {
  const t = { onTalk: vi.fn(async () => {}), inspelare: falskInspelare(), igenkanning: true, ...talk };
  // ⛔ Orden i fältet följer språket i sammanhanget (`OpsSprakProvider`), som en app lägger runt hela skalet.
  render(
    <OpsSprakProvider sprak={sprak ?? "sv"}>
      <OpsAppShell brand="Ops" fasta={fasta} moduler={[]} activeHref="/" talk={t} {...(skapa ? { skapa } : {})} {...(onNavigate ? { onNavigate } : {})}>
        <p>innehåll</p>
      </OpsAppShell>
    </OpsSprakProvider>,
  );
  return t;
}

/** @type {Array<() => void>} */
let aterstall = [];
/** @param {string} nyckel @param {() => any} get */
function stubbaEgenskap(proto, nyckel, get) {
  Object.defineProperty(proto, nyckel, { configurable: true, get });
  aterstall.push(() => delete proto[nyckel]);
}

/** @param {boolean} reducerad */
function stubbaMatchMedia(reducerad) {
  const fore = Object.getOwnPropertyDescriptor(window, "matchMedia");
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (/** @type {string} */ q) => ({ matches: reducerad && q.includes("prefers-reduced-motion"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  });
  aterstall.push(() => {
    if (fore) Object.defineProperty(window, "matchMedia", fore);
    else delete (/** @type {any} */ (window)).matchMedia;
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  igenkannare = [];
  aterstall = [];
  // Provet styr bildrutorna: 16 ms med den falska klockan, och tidsstämpeln är den falska klockans.
  vi.stubGlobal("requestAnimationFrame", (/** @type {(t: number) => void} */ cb) => setTimeout(() => cb(Date.now()), 16));
  vi.stubGlobal("cancelAnimationFrame", (/** @type {any} */ id) => clearTimeout(id));
});
afterEach(() => {
  cleanup();
  for (const f of aterstall.reverse()) f();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete (/** @type {any} */ (globalThis)).webkitSpeechRecognition;
});

/* ═══ 1. LJUDVÅGOR NÄR BARA IGENKÄNNINGEN KÖR (#345 a) ═══════════════════════════════════════════════════════════════════════ */

describe("vågorna drivs av igenkänningens egna händelser", () => {
  /** @type {import("vitest").MockInstance} */
  let ua;
  beforeEach(() => {
    /** @type {any} */ (globalThis).webkitSpeechRecognition = FalskSR;
    ua = vi.spyOn(navigator, "userAgent", "get").mockReturnValue(IPHONE);
  });
  afterEach(() => ua.mockRestore());

  /** Öppnar fältet på WebKit med valen, så att omgången kör bara igenkänningen. */
  async function oppna(talk = {}) {
    // ⛔ Inspelaren ger 0,9 om den tillfrågas. I en omgång utan inspelare får ingen fråga den, så prickarna ska vara stilla ändå.
    const t = Skal({ talk: { onAgent: vi.fn(async () => {}), inspelare: falskInspelare(0.9), ...talk } });
    fireEvent.click(huvudMikrofon());
    await flush();
    expect(igenkannare).toHaveLength(1);
    expect(t.inspelare.starta).not.toHaveBeenCalled();
    return t;
  }

  it("⛔ prickarna står stilla så länge inget hörts", async () => {
    await oppna();
    await gaTid(1000);
    expect(hojder()).toHaveLength(10);
    expect(hojder().every((h) => h === PLAN)).toBe(true);
  });

  it("⛔ ny text ger en puls: prickarna rör sig när igenkänningen ger ett resultat", async () => {
    await oppna();
    await gaTid(200);
    // Stilla först, så att det som syns efteråt är pulsen och inte en nivå som alltid stod där.
    expect(hojder().every((h) => h === PLAN)).toBe(true);
    await sag("boka rep på torsdag");
    await gaTid(100);
    expect(Math.max(...hojder())).toBeGreaterThan(PLAN);
  });

  it("⛔ pulsens höjd följer hur mycket text som kom", async () => {
    await oppna();
    await sag("ja");
    await gaTid(100);
    const liten = Math.max(...hojder());
    // Tystnad så att pulsen hunnit ut ur raden, sedan en lång mening.
    await gaTid(1500);
    expect(hojder().every((h) => h === PLAN)).toBe(true);
    await sag("och sedan ska vi också prata om kablarna i replokalen");
    await gaTid(100);
    const stor = Math.max(...hojder());
    expect(liten).toBeGreaterThan(PLAN);
    expect(stor).toBeGreaterThan(liten);
  });

  it("⛔ pulsen avtar när det blir tyst: utan ny text är prickarna stilla igen", async () => {
    await oppna();
    await sag("boka rep på torsdag");
    await gaTid(100);
    expect(Math.max(...hojder())).toBeGreaterThan(PLAN);
    // Ingen ny text på mer än avtagandetiden, plus tiden det tar för pulsen att skjutas ut ur de tio prickarna.
    await gaTid(IGENKANNING_AVTA_MS + 10 * 80 + 200);
    expect(hojder().every((h) => h === PLAN)).toBe(true);
  });

  it("⛔ onspeechend avtar pulsen snabbare än tystnaden ensam", async () => {
    // Kontrollen först: utan onspeechend är den senaste pricken fortfarande hög 300 ms efter pulsen.
    await oppna();
    await sag("boka rep på torsdag");
    await gaTid(300);
    expect(hojder().at(-1)).toBeGreaterThan(PLAN);
    cleanup();
    igenkannare = [];

    await oppna();
    await sag("boka rep på torsdag");
    await handelse("onspeechend");
    await gaTid(300);
    expect(hojder().at(-1)).toBe(PLAN);
  });

  it("⛔ onsoundstart och onspeechstart visar att det lyssnar med en liten puls", async () => {
    await oppna();
    await handelse("onsoundstart");
    await gaTid(100);
    const ljud = Math.max(...hojder());
    expect(ljud).toBeGreaterThan(PLAN);
    await gaTid(1500);
    expect(hojder().every((h) => h === PLAN)).toBe(true);
    await handelse("onspeechstart");
    await gaTid(100);
    expect(Math.max(...hojder())).toBeGreaterThan(PLAN);
    // Den är lägre än en puls av en hel mening: den säger bara att det lyssnar.
    await gaTid(1500);
    await sag("och sedan ska vi också prata om kablarna i replokalen");
    await gaTid(100);
    expect(Math.max(...hojder())).toBeGreaterThan(ljud);
  });

  it("⛔ en ny omgång börjar stilla: förra omgångens puls följer inte med", async () => {
    await oppna();
    await sag("och sedan ska vi också prata om kablarna i replokalen");
    await gaTid(50);
    fireEvent.click(screen.getByRole("button", { name: "Avbryt" }));
    await flush();
    fireEvent.click(huvudMikrofon());
    await flush();
    expect(igenkannare).toHaveLength(2);
    await gaTid(100);
    expect(hojder().every((h) => h === PLAN)).toBe(true);
  });

  it("⛔ prefers-reduced-motion: prickarna ändrar inte höjd, och pulsen syns som ljusstyrka", async () => {
    stubbaMatchMedia(true);
    await oppna();
    await gaTid(200);
    const stilla = dis();
    await sag("och sedan ska vi också prata om kablarna i replokalen");
    await gaTid(100);
    expect(hojder().every((h) => h === PLAN)).toBe(true);
    expect(Math.max(...dis())).toBeGreaterThan(Math.max(...stilla));
  });

  it("⛔ prefers-reduced-motion gäller också när inspelaren matar prickarna (samma komponent)", async () => {
    stubbaMatchMedia(true);
    ua.mockReturnValue(CHROME);
    Skal({ talk: { onAgent: vi.fn(async () => {}) } });
    fireEvent.click(huvudMikrofon());
    await flush();
    await gaTid(200);
    expect(hojder().every((h) => h === PLAN)).toBe(true);
  });

  it("utan reducerad rörelse och med en inspelare i Chrome är det inspelarens nivå som ritas, som förut", async () => {
    stubbaMatchMedia(false);
    ua.mockReturnValue(CHROME);
    Skal({ talk: { onAgent: vi.fn(async () => {}), inspelare: falskInspelare(0.5) } });
    fireEvent.click(huvudMikrofon());
    await flush();
    await gaTid(1000);
    // Inspelaren ger 0,5 hela tiden: 6 + 14 * 0,5 = 13 px, och igenkänningens händelser mäts inte in.
    expect(hojder().every((h) => h === 13)).toBe(true);
    expect(igenkannare[0].onspeechend).toBeNull();
    await sag("och sedan ska vi också prata om kablarna i replokalen");
    await gaTid(100);
    expect(hojder().every((h) => h === 13)).toBe(true);
  });
});

describe("skapaIgenkanningsniva: nivån ur igenkänningens händelser", () => {
  /** En klocka provet styr. */
  function klocka() {
    let t = 1000;
    return { nu: () => t, ga: (/** @type {number} */ ms) => { t += ms; } };
  }

  it("⛔ börjar på noll, ger en puls av ny text, och avtar linjärt till noll på avtagandetiden", () => {
    const k = klocka();
    const n = skapaIgenkanningsniva({ nu: k.nu });
    expect(n.niva()).toBe(0);
    n.text(10);
    const topp = n.niva();
    expect(topp).toBeGreaterThan(0.4);
    k.ga(IGENKANNING_AVTA_MS / 2);
    expect(n.niva()).toBeCloseTo(topp / 2, 5);
    k.ga(IGENKANNING_AVTA_MS / 2);
    expect(n.niva()).toBe(0);
    k.ga(5000);
    expect(n.niva()).toBe(0);
  });

  it("⛔ mer text ger en högre puls, aldrig över 1, och en ny puls tar aldrig ned en som pågår", () => {
    const k = klocka();
    const n = skapaIgenkanningsniva({ nu: k.nu });
    n.text(1);
    const ett = n.niva();
    n.nolla();
    n.text(8);
    const atta = n.niva();
    n.nolla();
    n.text(500);
    expect(atta).toBeGreaterThan(ett);
    expect(n.niva()).toBeLessThanOrEqual(1);
    expect(n.niva()).toBeGreaterThanOrEqual(atta);
    n.nolla();
    n.text(50);
    k.ga(IGENKANNING_AVTA_MS / 4);
    const fore = n.niva();
    n.text(1);
    expect(n.niva()).toBeGreaterThanOrEqual(fore);
  });

  it("ljud och tal är en liten puls, lägre än en hel mening, och tystnad kortar avtagandet", () => {
    const k = klocka();
    const n = skapaIgenkanningsniva({ nu: k.nu });
    n.ljud();
    const ljud = n.niva();
    expect(ljud).toBeGreaterThan(0);
    n.nolla();
    n.text(40);
    expect(n.niva()).toBeGreaterThan(ljud);
    k.ga(10);
    n.tystnad();
    k.ga(IGENKANNING_AVTA_MS / 2);
    expect(n.niva()).toBe(0);
    n.nolla();
    expect(n.niva()).toBe(0);
  });
});

/* ═══ 2. TEXTYTAN RULLAR MED (#345 b) ═══════════════════════════════════════════════════════════════════════════════════════ */

describe("textytan rullar med ny text, utom när personen rullat upp", () => {
  const mat = { scrollHeight: 500, clientHeight: 100 };
  beforeEach(() => {
    mat.scrollHeight = 500;
    mat.clientHeight = 100;
    // jsdom har ingen layout: måtten är provets egna, och bara för textytan. `scrollTop` lagras och läses av jsdom som det är.
    stubbaEgenskap(HTMLElement.prototype, "scrollHeight", function () {
      return this.hasAttribute("data-talk-text") ? mat.scrollHeight : 0;
    });
    stubbaEgenskap(HTMLElement.prototype, "clientHeight", function () {
      return this.hasAttribute("data-talk-text") ? mat.clientHeight : 0;
    });
  });

  /** @param {Record<string, any>} p */
  const Yta = (p) => (
    <OpsSprakProvider sprak="sv">
      <OpsInspelning lage="lyssnar" medText niva={() => 0} sekunder={1} tak={120} framsteg={null} kanIgen={false} onKlar={() => {}} onAvbryt={() => {}} onIgen={() => {}} {...p} />
    </OpsSprakProvider>
  );
  const yta = () => /** @type {HTMLElement} */ (document.querySelector("[data-talk-text]"));

  it("⛔ rullar till slutet när ny text kommer", () => {
    const { rerender } = render(<Yta text="Första raden" />);
    expect(yta().scrollTop).toBe(500);
    mat.scrollHeight = 700;
    rerender(<Yta text="Första raden och en andra rad som gör texten längre" />);
    expect(yta().scrollTop).toBe(700);
  });

  it("⛔ stannar där personen rullat till när hen rullat upp, och texten växer ändå", () => {
    const { rerender } = render(<Yta text="Första raden" />);
    yta().scrollTop = 100;
    fireEvent.scroll(yta());
    mat.scrollHeight = 700;
    rerender(<Yta text="Första raden och en andra rad som gör texten längre" />);
    expect(yta().scrollTop).toBe(100);
    mat.scrollHeight = 900;
    rerender(<Yta text="Första raden och en andra rad som gör texten längre, sedan en tredje" />);
    expect(yta().scrollTop).toBe(100);
  });

  it("⛔ följer med igen när personen rullat tillbaka till slutet", () => {
    const { rerender } = render(<Yta text="Första raden" />);
    yta().scrollTop = 100;
    fireEvent.scroll(yta());
    mat.scrollHeight = 700;
    rerender(<Yta text="Första raden och en andra rad" />);
    expect(yta().scrollTop).toBe(100);
    // 700 - 600 - 100 = 0 kvar till slutet.
    yta().scrollTop = 600;
    fireEvent.scroll(yta());
    mat.scrollHeight = 900;
    rerender(<Yta text="Första raden och en andra rad och en tredje" />);
    expect(yta().scrollTop).toBe(900);
  });

  it("⛔ några pixlar från slutet räknas som längst ner (webbläsare avrundar)", () => {
    const { rerender } = render(<Yta text="Första raden" />);
    yta().scrollTop = 395;
    fireEvent.scroll(yta());
    mat.scrollHeight = 700;
    rerender(<Yta text="Första raden och en andra rad" />);
    expect(yta().scrollTop).toBe(700);
  });

  it("⛔ i det riktiga flödet: texten som växer fram rullas fram på en iPhone", async () => {
    stubbaMatchMedia(false);
    /** @type {any} */ (globalThis).webkitSpeechRecognition = FalskSR;
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(IPHONE);
    Skal({ talk: { onAgent: vi.fn(async () => {}) } });
    fireEvent.click(huvudMikrofon());
    await flush();
    await sag("första meningen");
    expect(yta().scrollTop).toBe(500);
    yta().scrollTop = 50;
    fireEvent.scroll(yta());
    await sag("och en andra");
    expect(yta().scrollTop).toBe(50);
  });
});

/* ═══ 3. BEKRÄFTELSE EFTER ANTECKNING (#345 c) ═════════════════════════════════════════════════════════════════════════════ */

describe("Anteckning visar ett kvitto i fältet", () => {
  const FORMULAR = { lage: "g1", handelse: { form: () => <form />, katalog: null }, arende: () => <form /> };
  /** @param {any} [talk] @param {any} [rest] */
  const medText = (talk = {}, rest = {}) =>
    Skal({ talk: { igenkanning: { starta: vi.fn(), stoppa: vi.fn().mockResolvedValue("Kom ihåg kablarna"), kasta: vi.fn() }, onAgent: vi.fn(), ...talk }, skapa: FORMULAR, ...rest });
  async function prata() {
    fireEvent.click(huvudMikrofon());
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /^(Klar|Done)/ }));
    await flush();
  }
  const status = () => within(/** @type {HTMLElement} */ (falt())).getByRole("status");

  it("⛔ löser onAnteckning till undefined står kvittot kvar utan länk, och fältet stängs inte av sig självt", async () => {
    const onAnteckning = vi.fn(async () => {});
    medText({ onAnteckning });
    await prata();
    fireEvent.click(val("Anteckning"));
    await flush();
    const dialog = /** @type {HTMLElement} */ (falt());
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute("data-lage")).toBe("sparat");
    expect(status().textContent).toBe("Anteckningen är sparad");
    expect(status().hasAttribute("data-talk-kvitto")).toBe(true);
    expect(within(dialog).queryByRole("link")).toBeNull();
    // Samma som andra kvitton: det står tills personen stänger det, och Ångra finns inte eftersom ingen angra getts.
    await gaTid(10000);
    expect(falt()).not.toBeNull();
    expect(within(dialog).queryByRole("button", { name: "Ångra" })).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Stäng" }));
    await flush();
    expect(falt()).toBeNull();
  });

  it("⛔ löser onAnteckning till { href, etikett } ritas länken i kvittot", async () => {
    medText({ onAnteckning: vi.fn(async () => ({ href: "/bibliotek/abc", etikett: "Öppna i biblioteket" })) });
    await prata();
    fireEvent.click(val("Anteckning"));
    await flush();
    const lank = within(/** @type {HTMLElement} */ (falt())).getByRole("link", { name: "Öppna i biblioteket" });
    expect(lank.getAttribute("href")).toBe("/bibliotek/abc");
    expect(status().textContent).toContain("Anteckningen är sparad");
    expect(status().contains(lank)).toBe(true);
  });

  it("⛔ bara href ger ramverkets eget ord på länken, på svenska och på engelska", async () => {
    medText({ onAnteckning: vi.fn(async () => ({ href: "/bibliotek/abc" })) });
    await prata();
    fireEvent.click(val("Anteckning"));
    await flush();
    expect(within(/** @type {HTMLElement} */ (falt())).getByRole("link", { name: "Öppna anteckningen" }).getAttribute("href")).toBe("/bibliotek/abc");
    cleanup();

    medText({ onAnteckning: vi.fn(async () => ({ href: "/bibliotek/abc" })) }, { sprak: "en" });
    await prata();
    fireEvent.click(val("Note"));
    await flush();
    expect(status().textContent).toContain("The note is saved");
    expect(within(/** @type {HTMLElement} */ (falt())).getByRole("link", { name: "Open the note" })).toBeTruthy();
  });

  it("⛔ ett felformat svar är ett fel i appen, men anteckningen ÄR sparad: kvittot står, utan länk, och felet rapporteras", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      for (const svar of [{ href: 5 }, { etikett: "Öppna" }, { href: "" }, { href: "/a", etikett: "" }, { href: "javascript:alert(1)" }]) {
        medText({ onAnteckning: vi.fn(async () => svar) });
        await prata();
        fireEvent.click(val("Anteckning"));
        await flush();
        expect(status().textContent).toBe("Anteckningen är sparad");
        expect(within(/** @type {HTMLElement} */ (falt())).queryByRole("link")).toBeNull();
        cleanup();
      }
      expect(rapporter(konsol, "anteckning-lank")).toHaveLength(5);
    } finally {
      konsol.mockRestore();
    }
  });

  it("allt annat som onAnteckning löser till (ett id, en sträng, null, {}) är ett kvitto utan länk, utan fel", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      for (const svar of ["abc", null, {}, 7]) {
        medText({ onAnteckning: vi.fn(async () => svar) });
        await prata();
        fireEvent.click(val("Anteckning"));
        await flush();
        expect(status().textContent).toBe("Anteckningen är sparad");
        expect(within(/** @type {HTMLElement} */ (falt())).queryByRole("link")).toBeNull();
        cleanup();
      }
      expect(rapporter(konsol, "anteckning-lank")).toHaveLength(0);
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ ett tryck på länken går via skalets onNavigate och stänger fältet", async () => {
    const onNavigate = vi.fn((/** @type {string} */ _href, /** @type {any} */ e) => e.preventDefault());
    medText({ onAnteckning: vi.fn(async () => ({ href: "/bibliotek/abc", etikett: "Öppna i biblioteket" })) }, { onNavigate });
    await prata();
    fireEvent.click(val("Anteckning"));
    await flush();
    fireEvent.click(within(/** @type {HTMLElement} */ (falt())).getByRole("link", { name: "Öppna i biblioteket" }));
    await flush();
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate.mock.calls[0][0]).toBe("/bibliotek/abc");
    expect(falt()).toBeNull();
  });

  it("⛔ faller onAnteckning visas inget kvitto: felet står kvar med valen, som förut", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      medText({ onAnteckning: vi.fn().mockRejectedValue(new Error("Biblioteket svarade inte.")) });
      await prata();
      fireEvent.click(val("Anteckning"));
      await flush();
      const dialog = /** @type {HTMLElement} */ (falt());
      expect(dialog.getAttribute("data-lage")).toBe("hort");
      expect(within(dialog).getByRole("alert").textContent).toBe("Biblioteket svarade inte.");
      expect(dialog.querySelector("[data-talk-kvitto]")).toBeNull();
      expect(valen()).toContain("Anteckning");
    } finally {
      konsol.mockRestore();
    }
  });

  it("kvittot ligger inte kvar i nästa omgång: en ny inspelning börjar utan det", async () => {
    medText({ onAnteckning: vi.fn(async () => ({ href: "/bibliotek/abc" })) });
    await prata();
    fireEvent.click(val("Anteckning"));
    await flush();
    expect(falt()?.querySelector("[data-talk-kvitto]")).not.toBeNull();
    fireEvent.click(huvudMikrofon());
    await flush();
    const dialog = /** @type {HTMLElement} */ (falt());
    expect(dialog.getAttribute("data-lage")).toBe("lyssnar");
    expect(dialog.querySelector("[data-talk-kvitto]")).toBeNull();
    expect(within(dialog).queryByRole("link")).toBeNull();
  });
});

describe("talkAnteckningsLank", () => {
  it("läser { href, etikett } och ger null för allt som inte är en länk", () => {
    expect(talkAnteckningsLank(undefined)).toBeNull();
    expect(talkAnteckningsLank(null)).toBeNull();
    expect(talkAnteckningsLank({})).toBeNull();
    expect(talkAnteckningsLank("abc")).toBeNull();
    expect(talkAnteckningsLank(7)).toBeNull();
    expect(talkAnteckningsLank({ href: " /bibliotek/a ", etikett: " Öppna " })).toEqual({ href: "/bibliotek/a", etikett: "Öppna" });
    expect(talkAnteckningsLank({ href: "https://exempel.se/a" })).toEqual({ href: "https://exempel.se/a", etikett: null });
  });

  it("⛔ kastar på det som är en länk men fel formad, och på adresser som kör kod", () => {
    expect(() => talkAnteckningsLank({ href: 5 })).toThrow(/href/);
    expect(() => talkAnteckningsLank({ href: "  " })).toThrow(/href/);
    expect(() => talkAnteckningsLank({ etikett: "Öppna" })).toThrow(/href/);
    expect(() => talkAnteckningsLank({ href: "/a", etikett: "" })).toThrow(/etikett/);
    expect(() => talkAnteckningsLank({ href: "/a", etikett: 3 })).toThrow(/etikett/);
    expect(() => talkAnteckningsLank({ href: "javascript:alert(1)" })).toThrow(/href/);
    expect(() => talkAnteckningsLank({ href: " JavaScript:alert(1)" })).toThrow(/href/);
    expect(() => talkAnteckningsLank({ href: "data:text/html,x" })).toThrow(/href/);
  });
});

/* ═══ 4. URKLIPP (#347) ═══════════════════════════════════════════════════════════════════════════════════════════════════════ */

describe("Kopiera: en liten ikonknapp bland valen när det finns text", () => {
  /** @param {any} urklipp */
  function stubbaUrklipp(urklipp) {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: urklipp });
    aterstall.push(() => delete (/** @type {any} */ (navigator)).clipboard);
  }
  /** @param {Record<string, any>} p */
  const Yta = ({ sprak = "sv", ...p }) => (
    <OpsSprakProvider sprak={sprak}>
      <OpsInspelning lage="hort" niva={() => 0} sekunder={1} tak={120} framsteg={null} kanIgen onKlar={() => {}} onAvbryt={() => {}} onIgen={() => {}} text="Kom ihåg kablarna" onAgent={() => {}} {...p} />
    </OpsSprakProvider>
  );
  const kopiera = () => screen.getByRole("button", { name: /^(Kopiera|Copy)$/ });

  it("⛔ knappen finns när det finns text, har ikon och inget synligt ord, och ligger bland valen", () => {
    render(<Yta />);
    const k = kopiera();
    expect(k.querySelector("svg")).not.toBeNull();
    expect(k.textContent).toBe("");
    expect(k.hasAttribute("data-talk-kopiera")).toBe(true);
    // Bland valen: i samma grupp som Meddelande, Agent och Stäng.
    expect(k.closest("[data-talk-val]")).not.toBeNull();
  });

  it("⛔ ingen knapp när ingen text finns (ljud som väntar på utskrift, eller ingen text alls)", () => {
    const { rerender } = render(<Yta text="" textVantar />);
    expect(screen.queryByRole("button", { name: "Kopiera" })).toBeNull();
    rerender(<Yta text="" />);
    expect(screen.queryByRole("button", { name: "Kopiera" })).toBeNull();
    rerender(<Yta text="   " />);
    expect(screen.queryByRole("button", { name: "Kopiera" })).toBeNull();
  });

  it("⛔ skriver texten till urklipp och säger Kopierat en kort stund, utan att stänga fältet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubbaUrklipp({ writeText });
    const onAvbryt = vi.fn();
    render(<Yta onAvbryt={onAvbryt} />);
    fireEvent.click(kopiera());
    await flush();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("Kom ihåg kablarna");
    expect(screen.getByRole("status").textContent).toBe("Kopierat");
    expect(onAvbryt).not.toHaveBeenCalled();
    // Valen och texten står kvar.
    expect(screen.getByText("Kom ihåg kablarna")).toBeTruthy();
    expect(valen()).toEqual(["Agent"]);
    await gaTid(5000);
    expect(screen.getByRole("status").textContent).toBe("");
    expect(screen.queryByRole("alert")?.textContent ?? "").toBe("");
  });

  it("⛔ faller urklippet (nekas) visas felet i fältet, inget Kopierat, och fältet står kvar", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      stubbaUrklipp({ writeText: vi.fn().mockRejectedValue(Object.assign(new Error("denied"), { name: "NotAllowedError" })) });
      const onAvbryt = vi.fn();
      render(<Yta onAvbryt={onAvbryt} />);
      fireEvent.click(kopiera());
      await flush();
      expect(screen.getByRole("alert").textContent).toBe("Texten gick inte att kopiera till urklipp.");
      expect(screen.getByRole("status").textContent).toBe("");
      expect(onAvbryt).not.toHaveBeenCalled();
      expect(rapporter(konsol, "kopiera")).toHaveLength(1);
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ finns inget clipboard-API visas samma fel, och ett kast i writeText också", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(<Yta />);
      expect(navigator.clipboard).toBeUndefined();
      fireEvent.click(kopiera());
      await flush();
      expect(screen.getByRole("alert").textContent).toBe("Texten gick inte att kopiera till urklipp.");
      expect(screen.getByRole("status").textContent).toBe("");
      cleanup();

      stubbaUrklipp({ writeText: () => { throw new Error("sync"); } });
      render(<Yta />);
      fireEvent.click(kopiera());
      await flush();
      expect(screen.getByRole("alert").textContent).toBe("Texten gick inte att kopiera till urklipp.");
      expect(rapporter(konsol, "kopiera")).toHaveLength(2);
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ ett lyckat försök efter ett fel tar bort felet", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const writeText = vi.fn().mockRejectedValueOnce(new Error("nej")).mockResolvedValue(undefined);
      stubbaUrklipp({ writeText });
      render(<Yta />);
      fireEvent.click(kopiera());
      await flush();
      expect(screen.getByRole("alert").textContent).toMatch(/gick inte att kopiera/);
      fireEvent.click(kopiera());
      await flush();
      expect(screen.getByRole("status").textContent).toBe("Kopierat");
      expect(screen.getByRole("alert").textContent).toBe("");
    } finally {
      konsol.mockRestore();
    }
  });

  it("ord på engelska: Copy, Copied och felet", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValue(new Error("nej"));
      stubbaUrklipp({ writeText });
      render(<Yta sprak="en" />);
      fireEvent.click(kopiera());
      await flush();
      expect(screen.getByRole("status").textContent).toBe("Copied");
      await gaTid(5000);
      fireEvent.click(kopiera());
      await flush();
      expect(screen.getByRole("alert").textContent).toBe("The text could not be copied to the clipboard.");
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ i det riktiga flödet kopierar knappen texten och lämnar ingenting till appen", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubbaUrklipp({ writeText });
    const onAgent = vi.fn();
    const onAnteckning = vi.fn();
    const t = Skal({ talk: { onAgent, onAnteckning, igenkanning: { starta: vi.fn(), stoppa: vi.fn().mockResolvedValue("Ring Kim"), kasta: vi.fn() } } });
    fireEvent.click(huvudMikrofon());
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /^(Klar|Done)/ }));
    await flush();
    fireEvent.click(kopiera());
    await flush();
    expect(writeText).toHaveBeenCalledWith("Ring Kim");
    const dialog = /** @type {HTMLElement} */ (falt());
    expect(dialog.getAttribute("data-lage")).toBe("hort");
    expect(within(dialog).getByRole("status").textContent).toBe("Kopierat");
    expect(onAgent).not.toHaveBeenCalled();
    expect(onAnteckning).not.toHaveBeenCalled();
    expect(t.onTalk).not.toHaveBeenCalled();
  });

  it("Kopierat försvinner när fältet lämnar läget hört", async () => {
    stubbaUrklipp({ writeText: vi.fn().mockResolvedValue(undefined) });
    const { rerender } = render(<Yta />);
    fireEvent.click(kopiera());
    await flush();
    expect(screen.getByRole("status").textContent).toBe("Kopierat");
    rerender(<Yta lage="sparat" />);
    rerender(<Yta lage="hort" />);
    expect(screen.getByRole("status").textContent).toBe("");
  });
});
