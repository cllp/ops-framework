import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { LANGTRYCK_MS } from "../lib/apparark.js";
import { flytandeSkapaPa, flytandeSkapaSyns } from "../lib/flytandeSkapa.js";

/**
 * Den flytande Skapa-knappen på telefon (ej utgivet, cllp/lifehub.app#582, CP 2026-11-02).
 *
 * Under 768 px är mittknappen en mikrofon och skapa-listan ligger bakom ett långtryck som inget på skärmen avslöjar. Plustecknet på
 * mikrofonen togs bort i 0.104.0, så svaret är en EGEN knapp. jsdom kör ingen CSS: att den är `md:hidden` provas här som klass, och
 * att den faktiskt försvinner på dator och står där den ska på 390 px mäts i Chromium (`scripts/flytande-skapa-montage.mjs`).
 */

const fasta = { idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };
/** En inspelare utan mikrofon. */
const inspelare = () => ({
  starta: vi.fn(() => Promise.resolve()),
  stoppa: vi.fn(() => Promise.resolve({ blob: new Blob(["ljud"], { type: "audio/webm" }), mimeType: "audio/webm", sekunder: 1 })),
  kasta: vi.fn(),
  niva: () => 0.5,
});
/** @param {any} [extra] */
const Skal = ({ barn = <p>innehåll</p>, ...extra } = {}) => (
  <OpsAppShell
    brand="Ops"
    fasta={fasta}
    moduler={[]}
    activeHref="/kalender"
    talk={{ onTalk: vi.fn(), inspelare: inspelare() }}
    skapa={{ arende: <p>ärendeformulär</p> }}
    flytandeSkapa={["/kalender"]}
    {...extra}
  >
    {barn}
  </OpsAppShell>
);
const flyt = () => /** @type {HTMLElement | null} */ (document.querySelector("[data-ops-flytande-skapa]"));
const mik = () => /** @type {HTMLElement} */ (document.querySelector("[data-talk-knapp]"));
const flush = () => act(async () => {});
const rot = () => document.documentElement;

describe("flytandeSkapaPa: appens besked är en lista eller en funktion", () => {
  it("utelämnad är av", () => {
    expect(flytandeSkapaPa(undefined, "/kalender")).toBe(false);
  });

  it("en lista gäller adressen och dess undersidor, och '/' bara startsidan", () => {
    expect(flytandeSkapaPa(["/kalender"], "/kalender")).toBe(true);
    expect(flytandeSkapaPa(["/kalender"], "/kalender/2026-11")).toBe(true);
    expect(flytandeSkapaPa(["/kalender"], "/kalender?dag=1")).toBe(true);
    expect(flytandeSkapaPa(["/kalender"], "/kalenderlager")).toBe(false);
    expect(flytandeSkapaPa(["/kalender"], "/hub")).toBe(false);
    expect(flytandeSkapaPa(["/"], "/")).toBe(true);
    expect(flytandeSkapaPa(["/"], "/kalender")).toBe(false);
    expect(flytandeSkapaPa([], "/kalender")).toBe(false);
  });

  it("en funktion får aktiv adress och svarar true eller false", () => {
    const f = vi.fn((/** @type {string} */ href) => href.startsWith("/kal"));
    expect(flytandeSkapaPa(f, "/kalender")).toBe(true);
    expect(flytandeSkapaPa(f, "/hub")).toBe(false);
    expect(f).toHaveBeenCalledWith("/hub");
  });

  it("⛔ fel form kastar i stället för att tyst bli av", () => {
    // @ts-expect-error provar fel form med flit
    expect(() => flytandeSkapaPa(true, "/")).toThrow(/lista med adresser/);
    // @ts-expect-error
    expect(() => flytandeSkapaPa([1], "/")).toThrow(/lista med adresser/);
    // @ts-expect-error
    expect(() => flytandeSkapaPa(() => undefined, "/")).toThrow(/true eller false/);
  });
});

describe("flytandeSkapaSyns: den rena regeln", () => {
  const basta = { pa: true, tangentbordUppe: false, panelOppen: false, dialogOppen: false, talkLage: "vila" };

  it("syns när appen slagit på den och inget står i vägen", () => {
    expect(flytandeSkapaSyns(basta)).toBe(true);
  });

  it("syns inte utan påslag", () => {
    expect(flytandeSkapaSyns({ ...basta, pa: false })).toBe(false);
  });

  it("⛔ döljs av var och en av de fyra sakerna för sig", () => {
    expect(flytandeSkapaSyns({ ...basta, tangentbordUppe: true })).toBe(false);
    expect(flytandeSkapaSyns({ ...basta, panelOppen: true })).toBe(false);
    expect(flytandeSkapaSyns({ ...basta, dialogOppen: true })).toBe(false);
    for (const talkLage of ["trycker", "haller", "lyssnar", "skickar", "hort", "sparat", "fel"]) {
      expect(flytandeSkapaSyns({ ...basta, talkLage })).toBe(false);
    }
  });
});

describe("den flytande Skapa-knappen i skalet", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    // Skalets skapa-panel öppnas via adressen (`?skapa=`), som annars följer med in i nästa prov.
    window.history.replaceState(null, "", "/");
    rot().style.removeProperty("--flytande-skapa-h");
  });

  it("⛔ syns på en vy som appen slagit på den för, och är en riktig knapp med rätt namn och minst 44 px", () => {
    render(Skal());
    const k = flyt();
    expect(k).not.toBeNull();
    expect(k?.tagName).toBe("BUTTON");
    expect(k?.getAttribute("type")).toBe("button");
    expect(k?.getAttribute("aria-label")).toBe("Skapa");
    expect(k?.getAttribute("aria-haspopup")).toBe("dialog");
    // Storleken kommer ur token (3.5rem, 2.75rem på låga skärmar): aldrig under träffytans golv.
    expect(k?.className).toContain("size-(--flytande-skapa-storlek)");
    expect(k?.className).toContain("focus-visible:outline-2");
    expect(k?.className).toContain("bg-accent");
  });

  it("namnet följer språket", () => {
    render(Skal({ sprak: "en", skapaLabel: undefined }));
    expect(flyt()?.getAttribute("aria-label")).toBe("Create");
  });

  it("⛔ syns inte när appen inte slagit på den", () => {
    render(Skal({ flytandeSkapa: undefined }));
    expect(flyt()).toBeNull();
  });

  it("⛔ syns inte på en vy som inte står i listan, och kommer när vyn byts", () => {
    const { rerender } = render(Skal({ activeHref: "/hub" }));
    expect(flyt()).toBeNull();
    rerender(Skal({ activeHref: "/kalender" }));
    expect(flyt()).not.toBeNull();
  });

  it("⛔ syns inte på dator: knappen är md:hidden", () => {
    render(Skal());
    expect(flyt()?.className).toContain("md:hidden");
  });

  it("⛔ utan talk är mittknappen redan plusset, så ingen andra knapp ritas", () => {
    render(Skal({ talk: undefined }));
    expect(flyt()).toBeNull();
  });

  it("⛔ utan något i skapa-listan utöver TALK finns inget att öppna, så ingen knapp ritas", () => {
    render(Skal({ skapa: undefined }));
    expect(flyt()).toBeNull();
  });

  it("⛔ ett tryck öppnar skapa-listan, och det är SAMMA lista som mikrofonens långtryck", async () => {
    render(Skal());
    fireEvent.click(/** @type {HTMLElement} */ (flyt()));
    await flush();
    const viaKnapp = screen.getByRole("dialog", { name: "Skapa" });
    const radernaViaKnapp = [...viaKnapp.querySelectorAll("button")].map((b) => b.textContent);
    expect(viaKnapp.textContent).toContain("Nytt ärende");
    // Stäng och öppna samma lista med långtrycket.
    fireEvent.keyDown(viaKnapp, { key: "Escape" });
    await flush();
    expect(screen.queryByRole("dialog", { name: "Skapa" })).toBeNull();
    fireEvent.pointerDown(mik(), { button: 0 });
    act(() => vi.advanceTimersByTime(LANGTRYCK_MS));
    fireEvent.pointerUp(mik());
    fireEvent.click(mik());
    await flush();
    const viaLangtryck = screen.getByRole("dialog", { name: "Skapa" });
    expect([...viaLangtryck.querySelectorAll("button")].map((b) => b.textContent)).toEqual(radernaViaKnapp);
  });

  it("⛔ långtrycket på mikrofonen finns kvar", async () => {
    render(Skal());
    fireEvent.pointerDown(mik(), { button: 0 });
    act(() => vi.advanceTimersByTime(LANGTRYCK_MS));
    fireEvent.pointerUp(mik());
    fireEvent.click(mik());
    await flush();
    expect(screen.getByRole("dialog", { name: "Skapa" })).toBeTruthy();
  });

  it("⛔ döljs medan skapa-listan är öppen, och kommer tillbaka när den stängs", async () => {
    render(Skal());
    fireEvent.click(/** @type {HTMLElement} */ (flyt()));
    await flush();
    expect(flyt()).toBeNull();
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Skapa" }), { key: "Escape" });
    await flush();
    expect(flyt()).not.toBeNull();
  });

  it("⛔ döljs när skalets skapa-panel är öppen", async () => {
    render(Skal());
    fireEvent.click(/** @type {HTMLElement} */ (flyt()));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Nytt ärende" }));
    act(() => vi.advanceTimersByTime(10));
    await flush();
    expect(screen.getByText("ärendeformulär")).toBeTruthy();
    expect(flyt()).toBeNull();
  });

  it("⛔ döljs när bottenradens Meny-ark (en Radix-dialog) är öppet", async () => {
    render(Skal());
    expect(flyt()).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Meny" }));
    await flush();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(flyt()).toBeNull();
  });

  it("⛔ döljs medan TALK lyssnar, och kommer tillbaka när den vilar", async () => {
    render(Skal());
    fireEvent.click(mik());
    await flush();
    expect(mik().getAttribute("data-talk-knapp")).toBe("lyssnar");
    expect(flyt()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Avbryt" }));
    await flush();
    expect(mik().getAttribute("data-talk-knapp")).toBe("vila");
    expect(flyt()).not.toBeNull();
  });

  describe("tangentbord", () => {
    const ursprung = Object.getOwnPropertyDescriptor(window, "visualViewport");
    afterEach(() => {
      if (ursprung) Object.defineProperty(window, "visualViewport", ursprung);
      else delete (/** @type {any} */ (window)).visualViewport;
    });

    it("⛔ döljs när ett textfält har fokus och visualViewport krympt tydligt, och kommer tillbaka när det släpps", async () => {
      const vv = Object.assign(new EventTarget(), { height: window.innerHeight, scale: 1, offsetTop: 0 });
      Object.defineProperty(window, "visualViewport", { configurable: true, value: vv });
      render(Skal({ barn: <input aria-label="skriv" /> }));
      expect(flyt()).not.toBeNull();
      const falt = screen.getByLabelText("skriv");
      await act(async () => falt.focus());
      // Fokus ensamt räcker inte: ingen krympning betyder ett externt tangentbord.
      expect(flyt()).not.toBeNull();
      await act(async () => {
        vv.height = window.innerHeight - 300;
        vv.dispatchEvent(new Event("resize"));
      });
      expect(flyt()).toBeNull();
      await act(async () => {
        vv.height = window.innerHeight;
        vv.dispatchEvent(new Event("resize"));
      });
      expect(flyt()).not.toBeNull();
    });
  });

  it("⛔ innehållsytan får knappens höjd som bottenmarginal medan den syns, och tappar den när den går undan", async () => {
    render(Skal());
    const main = /** @type {HTMLElement} */ (document.querySelector("main"));
    // Marginalen är en del av main:s padding-bottom, räknad ur samma mått som komponenten sätter på <html>.
    expect(main.className).toContain("var(--flytande-skapa-h,0px)");
    expect(rot().style.getPropertyValue("--flytande-skapa-h")).toBe("calc(var(--flytande-skapa-storlek) + var(--flytande-skapa-luft))");
    fireEvent.click(mik());
    await flush();
    expect(rot().style.getPropertyValue("--flytande-skapa-h")).toBe("");
  });

  it("utan påslag sätts ingen marginal", () => {
    render(Skal({ flytandeSkapa: undefined }));
    expect(rot().style.getPropertyValue("--flytande-skapa-h")).toBe("");
  });

  it("⛔ ingen göm-vid-rullning: knappen står kvar medan sidan rullas", () => {
    render(Skal());
    for (const y of [0, 400, 800, 200]) {
      Object.defineProperty(window, "scrollY", { configurable: true, value: y });
      fireEvent.scroll(window);
      fireEvent.scroll(document);
      expect(flyt()).not.toBeNull();
    }
    expect(flyt()?.className).not.toMatch(/translate-y|animate-|transition-transform|opacity-0/);
  });

  it("⛔ fel form på propen kastar", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(Skal({ flytandeSkapa: true }))).toThrow(/lista med adresser/);
    } finally {
      tyst.mockRestore();
    }
  });
});
