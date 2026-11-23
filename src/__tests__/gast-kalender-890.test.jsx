import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsCalendar } from "../components/OpsCalendar.jsx";
import { OpsGastGrupp } from "../components/OpsGastGrupp.jsx";
import { GastsidaInfo } from "../components/gastsidaInfo.js";
import { GASTGRUPPATGARDER } from "../lib/gast.js";
import { veckansDagar } from "../lib/calendar.js";
import { gastPost, gastkalenderUrval, typVisning, typerIFiltret } from "../lib/gastkalender.js";
import { GASTKALENDERLAGE, lasGastKalenderlage, skrivGastKalenderlage } from "../lib/gastminne.js";

/**
 * Gästens kalender: Lista, Månad och Vecka, filtret på händelsetyp och typens ikon och färg (0.257.0, cllp/lifehub.app#890).
 *
 * CP godkände 18 nov: växling Lista, Månad och Vecka (Lista förvald i mobil, Månad på dator, senaste valet sparas), filter som chips per händelsetyp med ikon och färg plus
 * Visa passerade (av som standard), typens ikon och färg i både lista och kalender, och ramverkets kalendervy återanvänd ("Bygg ingen ny"). Gästen läser, svarar och röstar som förut.
 */

const klicka = async (/** @type {Element} */ el) => {
  await act(async () => {
    fireEvent.click(el);
  });
};
const valjFlik = async (/** @type {Element} */ el) => {
  await act(async () => {
    fireEvent.mouseDown(el, { button: 0 });
  });
};

const GRUPP = { namn: "Resan", funktioner: ["chatt", "kalender", "bibliotek"] };
const TYPER = [
  { id: "flyg", namn: { sv: "Flyg", en: "Flights" }, ikon: "trending-up", farg: 3 },
  { id: "boende", namn: { sv: "Boende" }, ikon: "building-2", farg: 1 },
  // En typ ingen händelse har: inget chip.
  { id: "deadline", namn: { sv: "Deadline" }, ikon: "clock", farg: 2 },
];
const bas = { beskrivning: null, plats: null, slutDatum: null, tid: null, slutTid: null, heldag: false, kalenderId: null, kravSvar: false, ejSatt: false };
const HANDELSER = [
  { ...bas, id: "h-flyg", titel: "Flyg till Lissabon", datum: "2026-11-24", tid: "07:10", typ: "flyg" },
  { ...bas, id: "h-hotell", titel: "Hotell Alfama", datum: "2026-11-24", slutDatum: "2026-11-27", heldag: true, typ: "boende" },
  { ...bas, id: "h-fika", titel: "Fika", datum: "2026-11-21", tid: "15:00", typ: null },
  { ...bas, id: "h-forr", titel: "Förmöte", datum: "2026-11-02", tid: "18:00", typ: "flyg" },
  { ...bas, id: "h-omrostning", titel: "Vilken dag åker vi hem?", datum: null, ejSatt: true, kravSvar: true, typ: null },
];
// idag är fredag 20 november 2026, vecka 47 (16 till 22 november).
const IDAG = new Date(2026, 10, 20);

function apiMed(extra = {}) {
  /** @type {Record<string, (a: any) => Promise<any>>} */
  const svar = {
    chatt: async () => ({ ok: true, meddelanden: [], fler: false }),
    kalender: async () => ({ ok: true, handelser: HANDELSER, kalendrar: [], typer: TYPER, avkortad: false, ejVisade: 0 }),
    handelse: async ({ handelseId }) => ({ ok: true, handelse: HANDELSER.find((h) => h.id === handelseId), svar: null }),
    bibliotek: async () => ({ ok: true, poster: [], avkortad: false }),
    arenden: async () => ({ ok: true, poster: [], avkortad: false }),
    oversikt: async () => ({ ok: true, chatt: null, kalender: null, bibliotek: null }),
    ...extra,
  };
  return Object.fromEntries(GASTGRUPPATGARDER.map((a) => [a, vi.fn(async (args) => (svar[a] ? svar[a](args ?? {}) : { ok: true }))]));
}

/** Appens ikon för ett namn: ett spann som bär namnet, så att provet ser att just den ikonen ritades. */
const ritaTypIkon = vi.fn((/** @type {string} */ namn) => <span data-ikonnamn={namn} />);

async function oppnaKalendern(props = {}) {
  const utf = render(<OpsGastGrupp grupp={GRUPP} api={apiMed()} intervallMs={0} idag={IDAG} ritaTypIkon={ritaTypIkon} {...props} />);
  await valjFlik(screen.getByRole("tab", { name: "Kalender" }));
  await screen.findByRole("tablist", { name: "Visa kalendern som" });
  return utf;
}

const radIdn = () => [...document.querySelectorAll("[data-gast-kalender] [data-gast-pagang]")].map((r) => r.getAttribute("data-gast-pagang"));

describe("växeln Lista, Månad och Vecka", () => {
  it("listan är förvald utan bred skärm, och har typens ikon i typens färg och ordet i raden; en händelse utan typ har en neutral prick", async () => {
    await oppnaKalendern();
    expect(screen.getByRole("tab", { name: "Lista" })).toHaveAttribute("aria-selected", "true");
    // Golv: fyra rader (Förmöte har varit). Utan datum först, sedan i tidsordning, heldag före klockslag samma dag.
    expect(radIdn()).toEqual(["h-omrostning", "h-fika", "h-hotell", "h-flyg"]);
    const flyg = /** @type {HTMLElement} */ (document.querySelector('[data-gast-pagang="h-flyg"]'));
    const marke = /** @type {HTMLElement} */ (flyg.querySelector("[data-gast-typmarke]"));
    expect(marke.getAttribute("data-gast-typmarke")).toBe("ikon");
    expect(marke.className).toContain("text-slag-3");
    expect(marke.querySelector('[data-ikonnamn="trending-up"]')).not.toBeNull();
    expect(flyg.textContent).toContain("Flyg ·");
    const fika = /** @type {HTMLElement} */ (document.querySelector('[data-gast-pagang="h-fika"]'));
    expect(fika.querySelector("[data-gast-typmarke]")?.getAttribute("data-gast-typmarke")).toBe("neutral");
  });

  it("Månad ritar ramverkets kalender med gästens poster, och en vald dag visar typens ikon i typens färg; ingen skapa, inga kalendrar, ingen årsvy", async () => {
    await oppnaKalendern();
    await klicka(screen.getByRole("tab", { name: "Månad" }));
    const kalender = await screen.findByRole("region", { name: "Kalender" }, { timeout: 5000 });
    expect(kalender.querySelector('[data-kalender-manad="2026-11"]')).not.toBeNull();
    await klicka(/** @type {Element} */ (kalender.querySelector('[data-cal-day="2026-11-24"]')));
    const panel = /** @type {HTMLElement} */ (document.querySelector("[data-dagpanel]"));
    expect(within(panel).getByText("Flyg till Lissabon")).toBeInTheDocument();
    const ikon = /** @type {HTMLElement} */ (panel.querySelector('[data-postikon] [data-ikonnamn="trending-up"]')?.parentElement);
    expect(ikon.className).toContain("text-slag-3");
    // Läsa, inte ändra.
    for (const namn of [/^Skapa/, /^Kalendrar/, /Visa året/, /Tillgänglighet/, /Hantera kalendrar/]) expect(screen.queryByRole("button", { name: namn })).toBeNull();
    // Händelsen utan datum står kvar ovanför rutnätet: den har ingen ruta, och det är den gästen ska rösta på.
    expect(document.querySelector('[data-gast-kalender-utandatum] [data-gast-pagang="h-omrostning"]')).not.toBeNull();
  });

  it("Vecka är en rad ur samma kalender: veckan med idag, veckans dagar med poster under utan stängkryss, och Nästa vecka byter vecka", async () => {
    await oppnaKalendern();
    await klicka(screen.getByRole("tab", { name: "Vecka" }));
    const vecka = /** @type {HTMLElement} */ (await waitFor(() => {
      const v = document.querySelector("[data-kalender-vecka]");
      if (!v) throw new Error("ingen vecka");
      return v;
    }, { timeout: 5000 }));
    expect(vecka.getAttribute("data-kalender-vecka")).toBe("2026-11-16");
    expect([...vecka.querySelectorAll("[data-cal-day]")].map((d) => d.getAttribute("data-cal-day"))).toEqual(veckansDagar("2026-11-16"));
    expect(screen.getByRole("heading", { name: /Vecka 47/ })).toBeInTheDocument();
    // Översikten: bara dagen med en post (Fika, 21 november), och inget kryss som tar bort ett urval ingen gjort.
    const panel = /** @type {HTMLElement} */ (document.querySelector("[data-dagpanel]"));
    expect(within(panel).getByText("Fika")).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /^Stäng|^Ta bort/ })).toBeNull();
    await klicka(screen.getByRole("button", { name: "Nästa vecka" }));
    expect(document.querySelector("[data-kalender-vecka]")?.getAttribute("data-kalender-vecka")).toBe("2026-11-23");
    expect(within(/** @type {HTMLElement} */ (document.querySelector("[data-dagpanel]"))).getByText("Flyg till Lissabon")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Skapa/ })).toBeNull();
  });

  it("senaste läget sparas på enheten och väljs nästa gång", async () => {
    const lagrat = new Map();
    const minne = { las: (/** @type {string} */ k) => lagrat.get(k) ?? null, skriv: (/** @type {string} */ k, /** @type {string} */ v) => void lagrat.set(k, v) };
    const info = /** @type {any} */ ({ integritet: null, namn: null, minne, inbjudan: null });
    const forsta = render(
      <GastsidaInfo.Provider value={info}>
        <OpsGastGrupp grupp={GRUPP} api={apiMed()} intervallMs={0} idag={IDAG} />
      </GastsidaInfo.Provider>,
    );
    await valjFlik(screen.getByRole("tab", { name: "Kalender" }));
    await klicka(await screen.findByRole("tab", { name: "Vecka" }));
    expect(lagrat.get(GASTKALENDERLAGE)).toBe("vecka");
    forsta.unmount();
    render(
      <GastsidaInfo.Provider value={info}>
        <OpsGastGrupp grupp={GRUPP} api={apiMed()} intervallMs={0} idag={IDAG} />
      </GastsidaInfo.Provider>,
    );
    await valjFlik(screen.getByRole("tab", { name: "Kalender" }));
    expect(await screen.findByRole("tab", { name: "Vecka" })).toHaveAttribute("aria-selected", "true");
  });

  it("Tillbaka från en händelse visar samma läge och samma filter som gästen lämnade", async () => {
    await oppnaKalendern();
    await klicka(screen.getByRole("button", { name: "Flyg" }));
    expect(radIdn()).toEqual(["h-flyg"]);
    await klicka(screen.getByRole("button", { name: "Flyg till Lissabon" }));
    await klicka(await screen.findByRole("button", { name: "Tillbaka" }));
    expect(screen.getByRole("button", { name: "Flyg" })).toHaveAttribute("aria-pressed", "true");
    expect(radIdn()).toEqual(["h-flyg"]);
  });
});

describe("⛔ Escape och tryck medan kalendern är dold bakom en öppen händelse (granskningen av 0.257.0)", () => {
  it("Escape och ett tryck i händelsens panel rör inte den dolda kalenderns valda dag, och Tillbaka visar dagen som gästen valde", async () => {
    await oppnaKalendern();
    await klicka(screen.getByRole("tab", { name: "Månad" }));
    const kalender = await screen.findByRole("region", { name: "Kalender" }, { timeout: 5000 });
    await klicka(/** @type {Element} */ (kalender.querySelector('[data-cal-day="2026-11-24"]')));
    // Golv: dagen är vald och dagpanelen öppen innan händelsen öppnas.
    expect(document.querySelector("[data-dagpanel]")).not.toBeNull();
    await klicka(within(/** @type {HTMLElement} */ (document.querySelector("[data-dagpanel]"))).getByText("Flyg till Lissabon"));
    const tillbaka = await screen.findByRole("button", { name: "Tillbaka" });
    expect(document.querySelector("[data-gast-kalender-plats]")?.hasAttribute("hidden")).toBe(true);
    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
      fireEvent.pointerDown(tillbaka);
    });
    await klicka(tillbaka);
    const panel = /** @type {HTMLElement} */ (document.querySelector("[data-dagpanel]"));
    expect(panel).not.toBeNull();
    expect(within(panel).getByText("Flyg till Lissabon")).toBeInTheDocument();
  });

  it("en synlig dagpanel stängs fortfarande med Escape", () => {
    render(<OpsCalendar ariaLabel="K" today={new Date(2026, 10, 20)} entries={[{ id: "a", date: "2026-11-24", title: "Middag" }]} />);
    fireEvent.click(/** @type {Element} */ (document.querySelector('[data-cal-day="2026-11-24"]')));
    expect(document.querySelector("[data-dagpanel]")).not.toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.querySelector("[data-dagpanel]")).toBeNull();
  });
});

describe("filtret: chips per typ och Visa passerade", () => {
  it("bara typerna som finns bland händelserna är chips, och ett chip visar bara sin typ i listan", async () => {
    await oppnaKalendern();
    const filter = /** @type {HTMLElement} */ (document.querySelector("[data-gast-kalender-filter]"));
    expect(within(filter).getAllByRole("button").map((b) => b.textContent)).toEqual(["Flyg", "Boende", "Visa passerade"]);
    expect(filter.querySelector('[data-gast-chip-typ="boende"]')?.querySelector('[data-ikonnamn="building-2"]')).not.toBeNull();
    expect(filter.querySelector('[data-gast-chip-typ="boende"]')?.className).toContain("text-slag-1");
    await klicka(within(filter).getByRole("button", { name: "Boende" }));
    expect(radIdn()).toEqual(["h-hotell"]);
    await klicka(within(filter).getByRole("button", { name: "Flyg" }));
    expect(radIdn()).toEqual(["h-hotell", "h-flyg"]);
  });

  it("Visa passerade är av från början och tar med det som har varit", async () => {
    await oppnaKalendern();
    expect(radIdn()).not.toContain("h-forr");
    await klicka(screen.getByRole("button", { name: "Visa passerade" }));
    expect(radIdn()).toEqual(["h-omrostning", "h-forr", "h-fika", "h-hotell", "h-flyg"]);
  });

  it("utan typer i svaret (en app utan grupp.handelsetyper) finns inga typchips och varje rad är neutral", async () => {
    render(<OpsGastGrupp grupp={GRUPP} api={apiMed({ kalender: async () => ({ ok: true, handelser: HANDELSER, kalendrar: [], avkortad: false, ejVisade: 0 }) })} intervallMs={0} idag={IDAG} />);
    await valjFlik(screen.getByRole("tab", { name: "Kalender" }));
    const filter = /** @type {HTMLElement} */ (await waitFor(() => document.querySelector("[data-gast-kalender-filter]")));
    expect(within(filter).getAllByRole("button").map((b) => b.textContent)).toEqual(["Visa passerade"]);
    const marken = [...document.querySelectorAll("[data-gast-typmarke]")].map((m) => m.getAttribute("data-gast-typmarke"));
    expect(marken.length).toBeGreaterThanOrEqual(4);
    expect(new Set(marken)).toEqual(new Set(["neutral"]));
  });
});

describe("gastkalender som data", () => {
  it("urvalet: typfilter, passerat och ordning", () => {
    const idn = (/** @type {any[]} */ l) => l.map((h) => h.id);
    expect(idn(gastkalenderUrval(HANDELSER, { idag: "2026-11-20" }))).toEqual(["h-omrostning", "h-fika", "h-hotell", "h-flyg"]);
    // En resa som började före idag och slutar efter är på gång.
    expect(idn(gastkalenderUrval(HANDELSER, { idag: "2026-11-26" }))).toEqual(["h-omrostning", "h-hotell"]);
    expect(idn(gastkalenderUrval(HANDELSER, { idag: "2026-11-20", valdaTyper: ["flyg"], visaPasserade: true }))).toEqual(["h-forr", "h-flyg"]);
    expect(typerIFiltret(TYPER, HANDELSER).map((t) => t.id)).toEqual(["flyg", "boende"]);
  });

  it("en gemensam rendering: samma typ ger samma ord och färg i raden och i kalenderns post; utan typ inget slag", () => {
    const karta = new Map(TYPER.map((t) => [t.id, t]));
    const typ = typVisning("flyg", karta, "en");
    expect(typ).toEqual({ id: "flyg", ord: "Flights", slag: 3, ikon: "trending-up" });
    expect(gastPost(/** @type {any} */ (HANDELSER[0]), typ, "x")).toMatchObject({ id: "h-flyg", handelseId: "h-flyg", date: "2026-11-24", tid: "07:10", slag: 3, slagLabel: "Flights" });
    expect(gastPost(/** @type {any} */ (HANDELSER[1]), typVisning("boende", karta, "en"), "x")).toMatchObject({ endDate: "2026-11-27", allDay: true, slagLabel: "Boende" });
    expect(typVisning(null, karta, "sv")).toBeNull();
    expect(typVisning("finns-inte", karta, "sv")).toBeNull();
    expect(gastPost(/** @type {any} */ (HANDELSER[2]), null, "x")).not.toHaveProperty("slag");
  });

  it("läget i minnet: bara ett av de tre orden läses och skrivs", () => {
    const lagrat = new Map();
    const minne = { las: (/** @type {string} */ k) => lagrat.get(k) ?? null, skriv: (/** @type {string} */ k, /** @type {string} */ v) => void lagrat.set(k, v) };
    expect(lasGastKalenderlage(minne)).toBeNull();
    skrivGastKalenderlage(minne, "inte-ett-lage");
    expect(lagrat.size).toBe(0);
    skrivGastKalenderlage(minne, "manad");
    expect(lasGastKalenderlage(minne)).toBe("manad");
    lagrat.set(GASTKALENDERLAGE, "år");
    expect(lasGastKalenderlage(minne)).toBeNull();
  });
});

describe("OpsCalendar lage=\"vecka\"", () => {
  it("veckansDagar: måndag till söndag, också över en månadsgräns och från en söndag", () => {
    expect(veckansDagar("2026-10-31")).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
    expect(veckansDagar("2026-11-01")[0]).toBe("2026-10-26");
    expect(veckansDagar("2026-11-02")[0]).toBe("2026-11-02");
  });

  it("en vecka över en månadsgräns är EN rad med sju dagar, och ett okänt läge kastar", () => {
    render(<OpsCalendar ariaLabel="K" lage="vecka" today={new Date(2026, 9, 31)} entries={[{ id: "a", date: "2026-11-01", title: "Söndagsmiddag" }]} />);
    const vecka = /** @type {HTMLElement} */ (document.querySelector("[data-kalender-vecka]"));
    expect(vecka.querySelectorAll("[data-veckorad]")).toHaveLength(1);
    expect([...vecka.querySelectorAll("[data-cal-day]")].map((d) => d.getAttribute("data-cal-day"))).toEqual(veckansDagar("2026-10-31"));
    expect(document.querySelector("[data-kalender-manad]")).toBeNull();
    expect(within(/** @type {HTMLElement} */ (document.querySelector("[data-dagpanel]"))).getByText("Söndagsmiddag")).toBeInTheDocument();
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsCalendar ariaLabel="K" lage={/** @type {any} */ ("ar")} entries={[]} />)).toThrow(/lage är "manad" eller "vecka"/);
  });

  it("en vecka utan poster säger det, och Den här veckan finns bara när man är någon annanstans", async () => {
    render(<OpsCalendar ariaLabel="K" lage="vecka" today={new Date(2026, 10, 20)} entries={[]} />);
    expect(document.querySelector("[data-kalender-vecka-tom]")).toHaveTextContent("Inget den här veckan.");
    expect(document.querySelector("[data-kalender-denna-vecka]")).toBeNull();
    await klicka(screen.getByRole("button", { name: "Föregående vecka" }));
    expect(document.querySelector("[data-kalender-vecka]")?.getAttribute("data-kalender-vecka")).toBe("2026-11-09");
    await klicka(/** @type {Element} */ (document.querySelector("[data-kalender-denna-vecka]")));
    expect(document.querySelector("[data-kalender-vecka]")?.getAttribute("data-kalender-vecka")).toBe("2026-11-16");
  });
});
