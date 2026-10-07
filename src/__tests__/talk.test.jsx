import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { LANGTRYCK_MS, MIKROFON_SPARRAD_AV_SIDAN, TALK_ORD, mikrofonenTillatenAvSidan, talkFeltext, talkNasta, valjFormat } from "../lib/talk.js";

/*
 * 0.57.0, cllp/lifehub.app#2. CP 2026-10-04: långtryck på plusset visar bara TALK, ett fält kommer fram så att man
 * pratar vidare utan att hålla inne, mikrofonen skickar och krysset avbryter. Raden "TALK, prata in" står först i Skapa.
 */

describe("flödet är en ren funktion", () => {
  const steg = (/** @type {any[]} */ ...h) => h.reduce((nu, x) => talkNasta(nu, x), { lage: "vila" });

  it("ett kort tryck är ett klick, och startar aldrig en inspelning", () => {
    const efterNer = talkNasta({ lage: "vila" }, { typ: "ner" });
    expect(efterNer.lage).toBe("trycker");
    expect(talkNasta(efterNer, { typ: "upp" })).toEqual({ lage: "vila", gor: "klick" });
  });

  it("långtrycket startar, och ⛔ släppet efteråt avslutar INTE", () => {
    expect(talkNasta({ lage: "trycker" }, { typ: "langtryck" })).toEqual({ lage: "haller", gor: "starta" });
    expect(talkNasta({ lage: "haller" }, { typ: "upp" })).toEqual({ lage: "lyssnar", gor: null });
  });

  it("bara mikrofonen skickar och bara krysset kastar", () => {
    expect(steg({ typ: "ner" }, { typ: "langtryck" }, { typ: "upp" }, { typ: "skicka" })).toEqual({ lage: "skickar", gor: "skicka" });
    expect(steg({ typ: "ner" }, { typ: "langtryck" }, { typ: "upp" }, { typ: "avbryt" })).toEqual({ lage: "vila", gor: "kasta" });
    expect(talkNasta({ lage: "skickar" }, { typ: "klar" }).lage).toBe("vila");
  });

  it("raden i Skapa går rakt till fältet, och taket skickar det som spelats in", () => {
    expect(talkNasta({ lage: "vila" }, { typ: "direkt" })).toEqual({ lage: "lyssnar", gor: "starta" });
    expect(talkNasta({ lage: "lyssnar" }, { typ: "tak" })).toEqual({ lage: "skickar", gor: "skicka" });
  });

  it("⛔ direkt under håll, lyssnar och skickar startar ingen andra inspelning (#276)", () => {
    for (const lage of /** @type {const} */ (["haller", "lyssnar", "skickar"])) {
      expect(talkNasta({ lage }, { typ: "direkt" })).toEqual({ lage, gor: null });
    }
  });

  it("felet bär sin text, och mikrofonen släpps när starten föll", () => {
    expect(talkNasta({ lage: "haller" }, { typ: "fel", text: "nej" })).toEqual({ lage: "fel", gor: "kasta", fel: "nej" });
    expect(talkNasta({ lage: "fel", fel: "nej" }, { typ: "avbryt" }).lage).toBe("vila");
  });

  it("formatet är det första webbläsaren kan, och iOS får mp4", () => {
    expect(valjFormat((f) => f === "audio/mp4")).toBe("audio/mp4");
    expect(valjFormat(() => true)).toBe("audio/webm;codecs=opus");
    expect(valjFormat(undefined)).toBe("");
  });

  it("felet säger vad man gör, inte webbläsarens namn", () => {
    expect(talkFeltext({ name: "NotAllowedError" })).toMatch(/Mikrofonen är inte tillåten/);
    expect(talkFeltext({ name: "NotFoundError" })).toBe("Ingen mikrofon hittades.");
  });

  it("⛔ en mikrofon som sidans Permissions-Policy spärrar skickar inte personen till webbläsarens inställningar (lane 13)", () => {
    const nej = { name: "NotAllowedError" };
    expect(talkFeltext(nej, { sidanTillater: false })).toBe(MIKROFON_SPARRAD_AV_SIDAN);
    expect(talkFeltext(nej, { sidanTillater: false })).not.toMatch(/inställningar/);
    expect(talkFeltext(nej, { sidanTillater: true })).toMatch(/webbläsarens inställningar/);
    // Kan webbläsaren inte svara står texten om inställningarna kvar.
    expect(talkFeltext(nej, { sidanTillater: null })).toMatch(/webbläsarens inställningar/);
    const fraga = vi.fn((/** @type {string} */ f) => f !== "microphone");
    expect(mikrofonenTillatenAvSidan({ permissionsPolicy: { allowsFeature: fraga } })).toBe(false);
    expect(fraga).toHaveBeenCalledWith("microphone");
    expect(mikrofonenTillatenAvSidan({ featurePolicy: { allowsFeature: () => true } })).toBe(true);
    expect(mikrofonenTillatenAvSidan({})).toBeNull();
    expect(mikrofonenTillatenAvSidan({ permissionsPolicy: { allowsFeature: () => { throw new Error("x"); } } })).toBeNull();
  });
});

/** En inspelare utan mikrofon. */
function falskInspelare({ startFel } = /** @type {{ startFel?: Error }} */ ({})) {
  return {
    starta: vi.fn(() => (startFel ? Promise.reject(startFel) : Promise.resolve())),
    stoppa: vi.fn(() => Promise.resolve({ blob: new Blob(["ljud"], { type: "audio/webm" }), mimeType: "audio/webm", sekunder: 2.5 })),
    kasta: vi.fn(),
    niva: () => 0.5,
  };
}

const fasta = { idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };
/** @param {any} [extra] */
const Skal = (extra = {}) => (
  <OpsAppShell brand="Ops" fasta={fasta} moduler={[]} activeHref="/" {...extra}>
    <p>innehåll</p>
  </OpsAppShell>
);
const plus = () => /** @type {HTMLElement} */ (document.querySelector("[data-talk-knapp]"));
const flush = () => act(async () => {});

describe("plusset i bottenraden", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("⛔ långtryck visar bara TALK, släppet lämnar fältet öppet, och mikrofonen skickar ljudet till appen", async () => {
    const insp = falskInspelare();
    const onTalk = vi.fn();
    render(Skal({ talk: { onTalk, inspelare: insp } }));
    fireEvent.pointerDown(plus(), { button: 0 });
    act(() => vi.advanceTimersByTime(LANGTRYCK_MS));
    await flush();
    expect(insp.starta).toHaveBeenCalledTimes(1);
    expect(plus().textContent).toBe(TALK_ORD);
    expect(plus().getAttribute("aria-label")).toBe(TALK_ORD);

    fireEvent.pointerUp(plus());
    fireEvent.click(plus());
    expect(screen.getByRole("dialog", { name: "TALK" })).toBeTruthy();
    // ⛔ Klicket efter långtrycket öppnade inte Skapa.
    expect(screen.queryByRole("dialog", { name: "Skapa" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Skicka" }));
    await flush();
    expect(onTalk).toHaveBeenCalledTimes(1);
    expect(onTalk.mock.calls[0][1]).toEqual({ mimeType: "audio/webm", sekunder: 2.5 });
    expect(screen.queryByRole("dialog", { name: "TALK" })).toBeNull();
  });

  it("ett vanligt tryck öppnar Skapa som förut, och spelar inte in", async () => {
    const insp = falskInspelare();
    render(Skal({ talk: { onTalk: vi.fn(), inspelare: insp } }));
    fireEvent.pointerDown(plus(), { button: 0 });
    act(() => vi.advanceTimersByTime(LANGTRYCK_MS - 100));
    fireEvent.pointerUp(plus());
    fireEvent.click(plus());
    await flush();
    expect(insp.starta).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Skapa" })).toBeTruthy();
  });

  it("krysset kastar, och appen får ingenting", async () => {
    const insp = falskInspelare();
    const onTalk = vi.fn();
    render(Skal({ talk: { onTalk, inspelare: insp } }));
    fireEvent.pointerDown(plus(), { button: 0 });
    act(() => vi.advanceTimersByTime(LANGTRYCK_MS));
    await flush();
    fireEvent.pointerUp(plus());
    fireEvent.click(screen.getByRole("button", { name: "Avbryt" }));
    expect(insp.kasta).toHaveBeenCalled();
    expect(onTalk).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "TALK" })).toBeNull();
  });

  it("⛔ en mikrofon som inte får öppnas säger det i fältet, med orden", async () => {
    const fel = Object.assign(new Error("x"), { name: "NotAllowedError" });
    render(Skal({ talk: { onTalk: vi.fn(), inspelare: falskInspelare({ startFel: fel }) } }));
    fireEvent.pointerDown(plus(), { button: 0 });
    act(() => vi.advanceTimersByTime(LANGTRYCK_MS));
    await flush();
    expect(document.querySelector("[data-talk-fel]")?.textContent).toMatch(/Mikrofonen är inte tillåten/);
  });

  it("⛔ i en ram som spärrar mikrofonen säger fältet det, och inte att personen ska ändra inställningarna (lane 13)", async () => {
    const fel = Object.assign(new Error("x"), { name: "NotAllowedError" });
    Object.defineProperty(document, "permissionsPolicy", { configurable: true, value: { allowsFeature: (/** @type {string} */ f) => f !== "microphone" } });
    try {
      render(Skal({ talk: { onTalk: vi.fn(), inspelare: falskInspelare({ startFel: fel }) } }));
      fireEvent.pointerDown(plus(), { button: 0 });
      act(() => vi.advanceTimersByTime(LANGTRYCK_MS));
      await flush();
      expect(document.querySelector("[data-talk-fel]")?.textContent).toBe(MIKROFON_SPARRAD_AV_SIDAN);
    } finally {
      delete (/** @type {any} */ (document)).permissionsPolicy;
    }
  });

  it("⛔ en mottagare som fallerar syns i fältet, ett tyst fel hade sett ut som skickat", async () => {
    const onTalk = vi.fn(() => Promise.reject(new Error("Servern svarade inte.")));
    render(Skal({ talk: { onTalk, inspelare: falskInspelare() } }));
    fireEvent.pointerDown(plus(), { button: 0 });
    act(() => vi.advanceTimersByTime(LANGTRYCK_MS));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Skicka" }));
    await flush();
    expect(document.querySelector("[data-talk-fel]")?.textContent).toBe("Servern svarade inte.");
  });
});

describe("raden i Skapa", () => {
  it("TALK, prata in står först och öppnar fältet utan att man håller", async () => {
    const insp = falskInspelare();
    render(Skal({ talk: { onTalk: vi.fn(), inspelare: insp }, skapa: { arende: true } }));
    fireEvent.click(plus());
    const ark = screen.getByRole("dialog", { name: "Skapa" });
    const knappar = Array.from(ark.querySelectorAll("button")).map((b) => b.textContent?.trim()).filter(Boolean);
    expect(knappar[0]).toBe("TALK, prata in");
    fireEvent.click(screen.getByRole("button", { name: "TALK, prata in" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(insp.starta).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: "TALK" })).toBeTruthy();
  });

  it("⛔ utan talk finns varken raden eller långtrycket", () => {
    render(Skal({ skapa: { arende: true } }));
    expect(screen.queryByText("TALK, prata in")).toBeNull();
    expect(document.querySelector("[data-talk-knapp]")).toBeNull();
  });

  it("⛔ talk utan mottagare kastar", () => {
    expect(() => render(Skal({ talk: {} }))).toThrow(/onTalk/);
  });
});

/*
 * #276. CP 2026-10-06 21:37: "TALK förtjänar en egen knapp i web. Och i mobil vet vi ju hur den skall sitta." En
 * mikrofonknapp i huvudet, bredvid plusset, bara på dator och bara med `talk`. Samma väg som raden i Skapa.
 * ⛔ jsdom kör ingen CSS: "bara på dator" mäts här som klassen som bär display, och på riktigt i `check-skalyta` avsnitt 43.
 */
describe("mikrofonknappen i huvudet", () => {
  const huvudknapp = () => /** @type {HTMLElement | null} */ (document.querySelector("header [data-talk-huvud]"));

  it("finns i huvudet med talk, med ett namn, och saknas utan talk", () => {
    const { unmount } = render(Skal({ talk: { onTalk: vi.fn(), inspelare: falskInspelare() }, skapa: { arende: true } }));
    const knapp = huvudknapp();
    expect(knapp).toBeTruthy();
    expect(knapp?.tagName).toBe("BUTTON");
    expect(knapp?.getAttribute("aria-label")).toBe("TALK, prata in");
    // Bredvid plusset: knappen är plussets närmaste granne i klustret.
    const plusIHuvud = /** @type {HTMLElement} */ (document.querySelector("header button[aria-label='Skapa']"));
    expect(plusIHuvud).toBeTruthy();
    expect(plusIHuvud.nextElementSibling).toBe(knapp);
    unmount();

    render(Skal({ skapa: { arende: true } }));
    expect(huvudknapp()).toBeNull();
    expect(document.querySelector("header [aria-label^='TALK']")).toBeNull();
  });

  it("startar samma inspelning som raden: samma inspelare, samma fält, och ljudet når appen", async () => {
    const insp = falskInspelare();
    const onTalk = vi.fn();
    render(Skal({ talk: { onTalk, inspelare: insp }, skapa: { arende: true } }));
    fireEvent.click(/** @type {HTMLElement} */ (huvudknapp()));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(insp.starta).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: "TALK" })).toBeTruthy();
    expect(document.querySelector("[data-ops-talk]")?.getAttribute("data-lage")).toBe("lyssnar");
    // ⛔ Samma tillstånd som plusset och raden, inte en andra krok: bottenradens plus står i samma läge.
    expect(plus().getAttribute("data-talk-knapp")).toBe("lyssnar");
    // Läget syns på knappen och i dess namn.
    expect(huvudknapp()?.getAttribute("data-talk-huvud")).toBe("lyssnar");
    expect(huvudknapp()?.getAttribute("aria-label")).toBe("TALK, lyssnar");
    expect(huvudknapp()?.className.split(/\s+/)).toContain("text-accent");

    fireEvent.click(screen.getByRole("button", { name: "Skicka" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(onTalk).toHaveBeenCalledTimes(1);
    expect(huvudknapp()?.getAttribute("aria-label")).toBe("TALK, prata in");
  });

  it("namnet säger TALK, skickar medan ljudet lämnas till appen, och prata in igen när det är klart", async () => {
    /** @type {(v?: unknown) => void} */
    let klar = () => {};
    const onTalk = vi.fn(() => new Promise((r) => (klar = r)));
    render(Skal({ talk: { onTalk, inspelare: falskInspelare() }, skapa: { arende: true } }));
    fireEvent.click(/** @type {HTMLElement} */ (huvudknapp()));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Skicka" }));
    await flush();
    expect(onTalk).toHaveBeenCalledTimes(1);
    expect(huvudknapp()?.getAttribute("data-talk-huvud")).toBe("skickar");
    expect(huvudknapp()?.getAttribute("aria-label")).toBe("TALK, skickar");
    expect(huvudknapp()?.className.split(/\s+/)).toContain("text-accent");
    await act(async () => klar());
    expect(huvudknapp()?.getAttribute("aria-label")).toBe("TALK, prata in");
  });

  it("⛔ ett tryck under lyssnar, skickar eller håll startar ingen andra inspelning", async () => {
    vi.useFakeTimers();
    try {
      // Håll: långtryck på bottenradens plus, sedan huvudets knapp medan fingret ligger kvar.
      const insp = falskInspelare();
      const { unmount } = render(Skal({ talk: { onTalk: vi.fn(), inspelare: insp }, skapa: { arende: true } }));
      fireEvent.pointerDown(plus(), { button: 0 });
      act(() => vi.advanceTimersByTime(LANGTRYCK_MS));
      await flush();
      expect(plus().getAttribute("data-talk-knapp")).toBe("haller");
      fireEvent.click(/** @type {HTMLElement} */ (huvudknapp()));
      await flush();
      expect(insp.starta).toHaveBeenCalledTimes(1);
      expect(plus().getAttribute("data-talk-knapp")).toBe("haller");
      unmount();
    } finally {
      vi.useRealTimers();
    }

    // Lyssnar och skickar: huvudets knapp startar, sedan trycks den igen i varje läge.
    /** @type {(v?: unknown) => void} */
    let klar = () => {};
    const insp = falskInspelare();
    render(Skal({ talk: { onTalk: vi.fn(() => new Promise((r) => (klar = r))), inspelare: insp }, skapa: { arende: true } }));
    fireEvent.click(/** @type {HTMLElement} */ (huvudknapp()));
    await flush();
    expect(insp.starta).toHaveBeenCalledTimes(1);
    fireEvent.click(/** @type {HTMLElement} */ (huvudknapp()));
    await flush();
    expect(insp.starta).toHaveBeenCalledTimes(1);
    expect(huvudknapp()?.getAttribute("data-talk-huvud")).toBe("lyssnar");
    fireEvent.click(screen.getByRole("button", { name: "Skicka" }));
    await flush();
    expect(huvudknapp()?.getAttribute("data-talk-huvud")).toBe("skickar");
    fireEvent.click(/** @type {HTMLElement} */ (huvudknapp()));
    await flush();
    expect(insp.starta).toHaveBeenCalledTimes(1);
    expect(insp.stoppa).toHaveBeenCalledTimes(1);
    expect(huvudknapp()?.getAttribute("data-talk-huvud")).toBe("skickar");
    await act(async () => klar());
  });

  it("⛔ saknas på mobil: display bärs av EN klass, gömd under md, och bottenraden får ingen mikrofon", () => {
    render(Skal({ talk: { onTalk: vi.fn(), inspelare: falskInspelare() }, skapa: { arende: true } }));
    const klasser = /** @type {HTMLElement} */ (huvudknapp()).className.split(/\s+/);
    expect(klasser).toContain("hidden");
    expect(klasser).toContain("md:inline-flex");
    // Bar `inline-flex` vid sidan av `hidden` vinner i Tailwinds ordning och hade visat knappen på mobil.
    expect(klasser).not.toContain("inline-flex");
    expect(document.querySelectorAll("[data-talk-huvud]")).toHaveLength(1);
    expect(document.querySelector("nav [data-talk-huvud]")).toBeNull();
  });
});
