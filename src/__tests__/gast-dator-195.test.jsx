import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsGastChatt } from "../components/OpsGastChatt.jsx";
import { OpsGastGrupp } from "../components/OpsGastGrupp.jsx";
import { OpsGastSida } from "../components/OpsGastSida.jsx";
import { Skrivfalt, texterPa } from "../components/OpsMeddelanden.jsx";
import { GASTGRUPPATGARDER } from "../lib/gast.js";

/**
 * Gästens sida på datorn (0.195.0), CP 2026-11-06 med skärmbilder från datorn:
 *   "Kan sidan gå ända ner eller hur blir det i chatten i Web? Och kan vi ha ljust/mörkt läge switch där också?"
 *   "Det finns en rund border i web, den yttersta som känns överflödig"
 *   "Vet inte var man skall skriva in chattmeddelanden. Konstigt om den ligger längst ner kanske? Hur brukar det se ut?"
 *   "Du kan ta bort ett streck mellan här också vid chatten. avdelaren."
 * Och samma dag: loggan och en rad om appen (`omAppen`).
 *
 * jsdom mäter klasser, attribut och vad som står var. Hur det ser ut mäts i montaget (Playwright mot ett byggt paket).
 * ⛔ VARJE PROV HAR SETTS FALLA (regel 4): rött med ändringen bortplockad, grönt med den. Utfallen står i ändringsloggen och i rapporten.
 */

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  vi.spyOn(window.navigator, "language", "get").mockReturnValue("sv-SE");
});
afterEach(() => vi.restoreAllMocks());

const ID = "a".repeat(64);
const SESSION = "S".repeat(43);
const GRUPP = { namn: "Skarv", funktioner: ["chatt", "kalender"] };
const MEDDELANDEN = [
  { id: "m1", av: { namn: "Bo" }, text: "Hej", tid: Date.UTC(2026, 10, 6, 9, 0), svar: 1 },
  { id: "m2", av: { namn: "Anna" }, text: "Hej själv", tid: Date.UTC(2026, 10, 6, 9, 5), egen: true, gast: true },
];

function apiMed() {
  return Object.fromEntries(
    GASTGRUPPATGARDER.map((a) => [
      a,
      vi.fn(async (/** @type {any} */ args) => {
        if (a === "chatt" && args?.trad) return { ok: true, rot: MEDDELANDEN[0], meddelanden: [], fler: false };
        if (a === "chatt") return { ok: true, meddelanden: MEDDELANDEN, fler: false };
        return { ok: true, poster: [], handelser: [], kalendrar: [], avkortad: false, ejVisade: 0 };
      }),
    ]),
  );
}

/** Radix aktiverar en flik vid `mousedown`, inte vid `click`. */
const valjFlik = async (/** @type {HTMLElement} */ el) => {
  await act(async () => {
    fireEvent.mouseDown(el, { button: 0 });
  });
};

const lagringMed = (start = {}) => {
  const d = { ...start };
  return { getItem: (/** @type {string} */ k) => d[k] ?? null, setItem: (/** @type {string} */ k, /** @type {string} */ v) => { d[k] = v; }, removeItem: (/** @type {string} */ k) => { delete d[k]; }, d };
};

const MARKE = { ljus: "/marke-ljus.png", mork: "/marke-mork.png", namn: "LifeHub" };

/** Gästsidan inloggad i gruppen, på datorn (jsdom har ingen `matchMedia`: datorns flikrad). */
const ritaSida = (/** @type {Record<string, any>} */ extra = {}) =>
  render(
    <OpsGastSida
      lank={null}
      onLos={vi.fn()}
      onHamta={vi.fn(async () => ({ ok: true, namn: "", funktion: "grupp", grupp: GRUPP }))}
      onNyLank={vi.fn()}
      renderGrupp={({ grupp }) => <OpsGastGrupp grupp={grupp} api={apiMed()} intervallMs={0} />}
      intervallMs={0}
      marke={MARKE}
      lagring={lagringMed({ [`ops-gast:${ID}`]: SESSION, "ops-gast:senaste": ID })}
      {...extra}
    />,
  );

describe("1. ingen yttre ram på datorn", () => {
  it("⛔ gruppen har ingen ram, inga rundade hörn och ingen egen bakgrund, på någon bredd", () => {
    render(<OpsGastGrupp grupp={GRUPP} api={apiMed()} intervallMs={0} />);
    const grupp = /** @type {HTMLElement} */ (document.querySelector("[data-gast-grupp]"));
    expect(grupp).not.toBeNull();
    const klasser = grupp.className.split(/\s+/);
    expect(klasser.filter((k) => /(^|:)(rounded|border|bg-|p-\d)/.test(k))).toEqual([]);
  });
});

describe("2. chatten fyller höjden på datorn", () => {
  it("⛔ i Chatt står chatten i en uppmätt yta och har data-fyll, och skrivfältet står efter loggen", async () => {
    render(<OpsGastGrupp grupp={GRUPP} api={apiMed()} intervallMs={0} />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    await valjFlik(screen.getByRole("tab", { name: "Chatt" }));
    await waitFor(() => expect(document.querySelector("[data-gast-chatt-logg]")).not.toBeNull());
    const yta = /** @type {HTMLElement} */ (document.querySelector("[data-gast-datoryta]"));
    expect(yta).not.toBeNull();
    expect(yta.className).toContain("h-[calc(var(--fullhojd-botten)_-_var(--fullhojd-topp))]");
    // Marginalen tar tillbaka `main`:s nedre utfyllnad på datorn, så att sidan inte rullar ovanpå loggen.
    expect(yta.className).toMatch(/(^|\s)-mb-16(\s|$)/);
    expect(yta.style.getPropertyValue("--fullhojd-botten")).toMatch(/px$/);
    const chatt = /** @type {HTMLElement} */ (yta.querySelector("[data-gast-chatt]"));
    expect(chatt.hasAttribute("data-fyll")).toBe(true);
    const skriv = /** @type {HTMLElement} */ (chatt.querySelector("[data-gast-chatt-skriv]"));
    expect(skriv.className).toMatch(/mt-auto/);
    expect(chatt.querySelector("[data-gast-chatt-logg]")?.compareDocumentPosition(skriv) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("Kalender rullar sidan som förut: ingen uppmätt yta runt den", async () => {
    render(<OpsGastGrupp grupp={GRUPP} api={apiMed()} intervallMs={0} />);
    await valjFlik(screen.getByRole("tab", { name: "Kalender" }));
    await waitFor(() => expect(screen.getByRole("tab", { name: "Kalender" })).toHaveAttribute("aria-selected", "true"));
    expect(document.querySelector("[data-gast-datoryta]")).toBeNull();
  });
});

describe("3. skrivfältet säger vart meddelandet går", () => {
  it("⛔ platstexten är 'Meddelande till {gruppen}', på engelska 'Message to {group}', och tråden säger 'Svara i tråden'", async () => {
    const onLasTrad = vi.fn(async () => ({ rot: MEDDELANDEN[0], meddelanden: [] }));
    const { unmount } = render(<OpsGastChatt meddelanden={MEDDELANDEN} onSkriv={vi.fn(async () => {})} gruppnamn="Skarv" onLasTrad={onLasTrad} onSkrivITrad={vi.fn(async () => {})} fyll />);
    const falt = /** @type {HTMLTextAreaElement} */ (document.querySelector("[data-gast-chatt-skriv] textarea"));
    expect(falt.placeholder).toBe("Meddelande till Skarv");
    // Skicka syns så fort något står i fältet.
    fireEvent.change(falt, { target: { value: "Hej" } });
    expect(within(/** @type {HTMLElement} */ (document.querySelector("[data-gast-chatt-skriv]"))).getByRole("button", { name: "Skicka" })).toBeEnabled();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "1 svar" }));
    });
    await waitFor(() => expect(document.querySelector("[data-gast-chatt-tradskriv] textarea")).not.toBeNull());
    expect(/** @type {HTMLTextAreaElement} */ (document.querySelector("[data-gast-chatt-tradskriv] textarea")).placeholder).toBe("Svara i tråden");
    unmount();
    render(<OpsGastChatt meddelanden={MEDDELANDEN} onSkriv={vi.fn(async () => {})} gruppnamn="Skarv" sprak="en" />);
    expect(/** @type {HTMLTextAreaElement} */ (document.querySelector("[data-gast-chatt-skriv] textarea")).placeholder).toBe("Message to Skarv");
  });

  it("gruppvyn ger chatten gruppens namn", async () => {
    render(<OpsGastGrupp grupp={GRUPP} api={apiMed()} intervallMs={0} />);
    await valjFlik(screen.getByRole("tab", { name: "Chatt" }));
    await waitFor(() => expect(document.querySelector("[data-gast-chatt-skriv] textarea")).not.toBeNull());
    expect(/** @type {HTMLTextAreaElement} */ (document.querySelector("[data-gast-chatt-skriv] textarea")).placeholder).toBe("Meddelande till Skarv");
  });
});

describe("4. inget streck mellan loggen och skrivfältet", () => {
  it("⛔ gästens skrivfält har inget border-t, och den fyllda loggen ingen egen ram", () => {
    render(<OpsGastChatt meddelanden={MEDDELANDEN} onSkriv={vi.fn(async () => {})} fyll />);
    const form = /** @type {HTMLElement} */ (document.querySelector("[data-gast-chatt-skriv] [data-skrivfalt]"));
    expect(form.className.split(/\s+/)).not.toContain("border-t");
    const logg = /** @type {HTMLElement} */ (document.querySelector("[data-gast-chatt-logg]"));
    expect(logg.className.split(/\s+/).filter((k) => /^(border|rounded|bg-)/.test(k))).toEqual([]);
  });

  it("⛔ skrivfältet har samma vänster- och högerkant som meddelandena: inget eget indrag eller egen marginal som loggen saknar (CP från telefonen)", () => {
    render(<OpsGastChatt meddelanden={MEDDELANDEN} onSkriv={vi.fn(async () => {})} fyll />);
    /** Klasser som flyttar en kant i sidled: indrag och marginal, på alla bredder. @param {Element} el */
    const sidled = (el) => el.className.split(/\s+/).filter((k) => /^(?:[a-z]+:)*-?(?:p[xlrse]?|m[xlrse]?)-/.test(k) && !/^(?:[a-z]+:)*-?[pm]y-/.test(k));
    const logg = /** @type {HTMLElement} */ (document.querySelector("[data-gast-chatt-logg]"));
    const skriv = /** @type {HTMLElement} */ (document.querySelector("[data-gast-chatt-skriv]"));
    const form = /** @type {HTMLElement} */ (skriv.querySelector("[data-skrivfalt]"));
    expect(sidled(logg)).toEqual([]);
    expect(sidled(skriv)).toEqual([]);
    expect(sidled(form)).toEqual([]);
  });

  it("appens skrivfält har kvar sitt streck (förval), och loggen utan fyll har kvar sin ruta", () => {
    render(<Skrivfalt text="" setText={() => {}} skickar={false} onSkicka={() => {}} texter={texterPa("sv", {})} sprak="sv" />);
    expect(/** @type {HTMLElement} */ (document.querySelector("[data-skrivfalt]")).className.split(/\s+/)).toContain("border-t");
    render(<OpsGastChatt meddelanden={MEDDELANDEN} />);
    expect(/** @type {HTMLElement} */ (document.querySelector("[data-gast-chatt-logg]")).className).toMatch(/\bborder\b/);
  });
});

describe("5. ljust och mörkt i gästens huvud", () => {
  it("⛔ temaknappen står i huvudet bredvid språkvalet, växlar <html data-theme> och sparar valet som i appen", async () => {
    ritaSida();
    await screen.findByRole("heading", { name: "Skarv" });
    const huvud = /** @type {HTMLElement} */ (document.querySelector("header [data-gast-huvud-val]"));
    expect(huvud).not.toBeNull();
    expect(within(huvud).getByRole("group", { name: "Språk" })).toBeInTheDocument();
    const knapp = within(huvud).getByRole("button", { name: "Utseende: Följ systemet" });
    await act(async () => {
      fireEvent.click(knapp);
    });
    await act(async () => {
      fireEvent.click(await screen.findByText("Mörkt"));
    });
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem("ops-theme")).toBe("dark");
    expect(within(huvud).getByRole("button", { name: "Utseende: Mörkt" })).toBeInTheDocument();
  });

  it("knappen har etikett på engelska när sidan är engelsk", async () => {
    ritaSida({ sprak: "en" });
    await screen.findByRole("heading", { name: "Skarv" });
    expect(within(/** @type {HTMLElement} */ (document.querySelector("header [data-gast-huvud-val]"))).getByRole("button", { name: "Appearance: Follow the system" })).toBeInTheDocument();
  });

  it("⛔ sidans ljusa ton är temats egna färger, så sidan följer ljust och mörkt", () => {
    const css = readFileSync("tokens/tokens.css", "utf8");
    expect(css).toMatch(/--color-publik-ljus:\s*var\(--color-canvas\);/);
    expect(css).toMatch(/--color-publik-ljus-text:\s*var\(--color-ink\);/);
    expect(css).toMatch(/--color-publik-ljus-dampad:\s*var\(--color-ink-secondary\);/);
  });
});

describe("6. loggan och en rad om appen (omAppen)", () => {
  const OM = { href: "https://life-hub.app", namn: "LifeHub" };

  it("⛔ med omAppen är märket en länk i ny flik med etikett, och översikten slutar med raden och Läs mer", async () => {
    ritaSida({ omAppen: OM });
    await screen.findByRole("heading", { name: "Skarv" });
    const marke = screen.getByRole("link", { name: "Om LifeHub, öppnas i en ny flik" });
    expect(marke).toHaveAttribute("href", "https://life-hub.app");
    expect(marke).toHaveAttribute("target", "_blank");
    expect(marke).toHaveAttribute("rel", "noopener noreferrer");
    expect(marke.hasAttribute("data-gast-marke")).toBe(true);
    const oversikt = /** @type {HTMLElement} */ (document.querySelector("[data-gast-oversikt]"));
    const rad = /** @type {HTMLElement} */ (oversikt.lastElementChild);
    expect(rad.hasAttribute("data-gast-om-appen")).toBe(true);
    expect(rad.textContent).toBe("Skarv använder LifeHub, där grupper organiserar sig utan att jaga varandra. Läs mer");
    const lasMer = within(rad).getByRole("link", { name: "Läs mer" });
    expect(lasMer).toHaveAttribute("href", "https://life-hub.app");
    expect(lasMer).toHaveAttribute("target", "_blank");
    expect(lasMer).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("på engelska", async () => {
    ritaSida({ omAppen: OM, sprak: "en" });
    await screen.findByRole("heading", { name: "Skarv" });
    expect(screen.getByRole("link", { name: "About LifeHub, opens in a new tab" })).toBeInTheDocument();
    expect(document.querySelector("[data-gast-om-appen]")?.textContent).toBe("Skarv uses LifeHub, where groups get organised without chasing each other. Read more");
  });

  it("utan omAppen är allt som förut: märket är ingen länk och raden saknas", async () => {
    ritaSida();
    await screen.findByRole("heading", { name: "Skarv" });
    expect(document.querySelector("[data-gast-marke]")?.tagName).toBe("SPAN");
    expect(screen.queryByRole("link", { name: /LifeHub/ })).toBeNull();
    expect(document.querySelector("[data-gast-om-appen]")).toBeNull();
  });

  it("⛔ href måste vara https: http, javascript och ett namn som saknas kastar", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => ritaSida({ omAppen: { href: "http://life-hub.app", namn: "LifeHub" } })).toThrow(/https/);
    expect(() => ritaSida({ omAppen: { href: "javascript:alert(1)", namn: "LifeHub" } })).toThrow(/https/);
    expect(() => ritaSida({ omAppen: { href: "https://life-hub.app", namn: " " } })).toThrow(/namn/);
  });
});

describe("7. tangentbordet på telefonen: ytan följer visualViewport som appens chatt", () => {
  // CP 2026-11-06 från iPhone i gästens Chatt på 0.192.0: "När man börjar skriva hoppar den upp så här." Appens chatt på samma telefon gör rätt.
  // jsdom kör ingen CSS och har inget tangentbord: provet styr ett eget `visualViewport` (som `tangentbord.test.jsx`) och läser talet och uttrycket på ytan.
  const ursprung = Object.getOwnPropertyDescriptor(window, "visualViewport");
  afterEach(() => {
    if (ursprung) Object.defineProperty(window, "visualViewport", ursprung);
    else delete (/** @type {any} */ (window)).visualViewport;
    vi.unstubAllGlobals();
  });
  const falskVv = () => {
    const vv = Object.assign(new EventTarget(), { height: window.innerHeight, scale: 1, offsetTop: 0 });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: vv });
    return vv;
  };
  /** @param {any} vv @param {number} px @param {number} [forskjutning] */
  const tangentbord = async (vv, px, forskjutning = 0) => {
    await act(async () => {
      vv.height = window.innerHeight - px;
      vv.offsetTop = px ? forskjutning : 0;
      vv.dispatchEvent(new Event(forskjutning ? "scroll" : "resize"));
    });
  };
  const telefon = () => vi.stubGlobal("matchMedia", (/** @type {string} */ q) => ({ matches: q.includes("max-width"), media: q, addEventListener: () => {}, removeEventListener: () => {} }));

  it("⛔ med tangentbordet uppe bär ytan tangentbordets höjd i --tangentbord, i appens uttryck, och ingen uppmätt underkant", async () => {
    const vv = falskVv();
    telefon();
    render(<OpsGastGrupp grupp={GRUPP} api={apiMed()} intervallMs={0} />);
    fireEvent.click(within(/** @type {HTMLElement} */ (document.querySelector("nav[data-ops-bottenrad]"))).getByText("Chatt"));
    await waitFor(() => expect(document.querySelector("[data-gast-chatt-skriv] textarea")).not.toBeNull());
    const yta = () => /** @type {HTMLElement} */ (document.querySelector("[data-gast-telefonyta]"));
    // Samma uttryck som appens chatt (`OpsMeddelanden`): 100dvh, minus det största av bottenraden och tangentbordet, minus spelraden.
    expect(yta().className).toContain("100dvh");
    expect(yta().className).toContain("max(var(--bottom-nav-h)+var(--safe-bottom),var(--tangentbord,0px))");
    expect(yta().className).toContain("-var(--spelrad-h,0px))]");
    expect(yta().style.getPropertyValue("--fullhojd-botten")).toBe("");
    expect(yta().style.height).toBe("");
    expect(yta().style.getPropertyValue("--tangentbord")).toBe("");
    await act(async () => /** @type {HTMLElement} */ (document.querySelector("[data-gast-chatt-skriv] textarea")).focus());
    await tangentbord(vv, 300);
    expect(yta().style.getPropertyValue("--tangentbord")).toBe("300px");
    expect(yta().style.height).toBe("");
    // Bottenraden göms medan man skriver, som i appen.
    expect(/** @type {HTMLElement} */ (document.querySelector("nav[data-ops-bottenrad]")).classList.contains("hidden")).toBe(true);
    // Safari flyttar den synliga ytan ned lika mycket: inget ligger då under den, och ytan dras inte ihop en gång till.
    await tangentbord(vv, 300, 300);
    expect(yta().style.getPropertyValue("--tangentbord")).toBe("");
    await tangentbord(vv, 0);
    expect(yta().style.getPropertyValue("--tangentbord")).toBe("");
  });
});
