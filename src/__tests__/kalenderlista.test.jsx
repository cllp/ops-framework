import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsCalendar } from "../components/OpsCalendar.jsx";
import { OpsHandelsePanel } from "../components/OpsHandelsePanel.jsx";
import { filtreraPoster } from "../lib/calendar.js";
import { kalenderSynlighetNyckel } from "../lib/kalendersynlighet.js";
import { useKalenderSynlighet } from "../lib/useKalenderSynlighet.js";

/**
 * Kalendrarna som en lista med ett minne, visning per kalender, läspanel för en extern händelse och Kopiera till… (0.134.0, cllp/lifehub.app#402).
 *
 * ⛔ Händelsen: CP 2026-10-20, med bild: "Men varför kommer dom upp som både kalendrar och kalenderlager? Kaka på kaka. Det är allvarliga saker som skall fixas." Och 2026-10-21: "Utan fördröjning.
 * Ett tryck ändrar kalendern direkt ur det som redan är laddat, och valet sparas i bakgrunden. Ett prov med ett tak (100 ms från tryck till ändrad kalender) gör det mätt."
 *
 * Provet mäter det en person gör: trycker på en växel, ser dagen ändras, öppnar en händelse från Apple och kan inte ändra den. jsdom kör ingen CSS, så hur det SER UT mäts i en riktig webbläsare
 * (skärmbilderna i PR-texten, tagna med Playwright mot ett byggt exempel).
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

const IDAG = new Date(2026, 9, 5, 12);

/** @typedef {import("../components/OpsCalendar.jsx").KalenderVal} Rad */
/** @type {Rad[]} */
const KALENDRAR = [
  { id: "gruppen", namn: "Styrelsen", farg: 4, grupp: true, forvald: true },
  { id: "mina", namn: "Privat", farg: 5 },
  { id: "apple", namn: "Apple Calendar", farg: 2, sektion: "Från Mitt konto", marke: "Apple, skrivskyddad" },
  { id: "arenden", namn: "Ärenden", farg: 6, sektion: "Ärenden", avFranStart: true },
];
const SEKTIONER = [
  { namn: "Gruppens kalendrar" },
  { namn: "Mina kalendrar", tomText: "Du har inga egna kalendrar ännu." },
  { namn: "Från Mitt konto", tomText: "Du har inga kalendrar från Mitt konto ännu." },
  { namn: "Ärenden" },
];

/** @param {string} id @param {string} titel @param {string} datum @param {Record<string, any>} [extra] */
const post = (id, titel, datum, extra = {}) => ({ id, title: titel, date: datum, ...extra });
const kal = (/** @type {Rad} */ r) => ({ id: r.id, namn: r.namn, farg: r.farg });

const POSTER = [
  post("mote", "Styrelsemöte", "2026-10-12"),
  post("kaffe", "Kaffe med Anna", "2026-10-12", { kalender: kal(KALENDRAR[1]) }),
  post("tandlakare", "Tandläkare", "2026-10-12", {
    kalender: kal(KALENDRAR[2]),
    extern: { kalla: "Från Apple, ändras i Apple", tid: "09:30", slutTid: "10:15", plats: "Tandvården, Visby", beskrivning: "Ta med remissen." },
  }),
  post("arende", "Skicka fakturan", "2026-10-13", { kalender: kal(KALENDRAR[3]) }),
];

/** @returns {{ getItem: (n: string) => string | null, setItem: (n: string, v: string) => void, varden: Map<string, string> }} */
function minne(/** @type {Record<string, string>} */ start = {}) {
  const varden = new Map(Object.entries(start));
  return {
    varden,
    getItem: (n) => (varden.has(n) ? /** @type {string} */ (varden.get(n)) : null),
    setItem: (n, v) => {
      varden.set(n, v);
    },
  };
}

/** @param {Record<string, any>} [extra] */
function rita(extra = {}) {
  return render(
    <OpsCalendar
      ariaLabel="Kalender"
      today={IDAG}
      monthsBack={0}
      monthsForward={0}
      entries={POSTER}
      kalendrar={KALENDRAR}
      kalendersektioner={SEKTIONER}
      kalenderMinne="person-a:grupp-1"
      lagring={minne()}
      {...extra}
    />,
  );
}

const oppnaListan = async () => {
  fireEvent.click(screen.getByRole("button", { name: /^Kalendrar: / }));
  return /** @type {HTMLElement} */ (await screen.findByRole("dialog", { name: "Kalendrar" }));
};
const dag = (/** @type {string} */ d) => /** @type {HTMLElement} */ (document.querySelector(`[data-cal-day="${d}"]`));
const dagnamn = (/** @type {string} */ d) => dag(d).getAttribute("aria-label");

describe("listan Kalendrar: en rad per kalender, en växel per rad", () => {
  it("sektionerna kommer från appen, varje rad har prick, namn, märke och en växel, och ärenden är av från start", async () => {
    rita();
    const lista = await oppnaListan();
    const sektioner = [...lista.querySelectorAll("[data-kalendersektion]")].map((s) => s.getAttribute("data-kalendersektion"));
    expect(sektioner).toEqual(["Gruppens kalendrar", "Mina kalendrar", "Från Mitt konto", "Ärenden"]);
    // Golv: fyra rader lästa, inte noll. Ett prov som går igenom en tom lista är grönt av att ingenting mättes.
    const rader = [...lista.querySelectorAll("[data-kalenderrad]")];
    expect(rader.map((r) => r.getAttribute("data-kalenderrad"))).toEqual(["gruppen", "mina", "apple", "arenden"]);

    const apple = /** @type {HTMLElement} */ (lista.querySelector('[data-kalenderrad="apple"]'));
    expect(within(apple).getByText("Apple, skrivskyddad")).toBeTruthy();
    expect(apple.querySelector('[data-kalenderprick="2"]')?.className).toContain("bg-identity-2");
    expect(within(lista).getByRole("switch", { name: "Apple Calendar" })).toBeChecked();
    expect(within(lista).getByRole("switch", { name: "Styrelsen" })).toBeChecked();
    expect(within(lista).getByRole("switch", { name: "Ärenden" })).not.toBeChecked();
  });

  it("⛔ inga råa kryssrutor: varje rad är en OpsSwitch, och ingen kontroll i listan har rollen kryssruta", async () => {
    rita();
    const lista = await oppnaListan();
    expect(within(lista).getAllByRole("switch")).toHaveLength(4);
    expect(within(lista).queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("⛔ en tom sektion med en tomtext säger det, och en utan tomtext ritas inte som en ensam rubrik", async () => {
    rita({ kalendrar: [KALENDRAR[0]], entries: [] });
    const lista = await oppnaListan();
    expect(within(lista).getByText("Du har inga egna kalendrar ännu.")).toBeTruthy();
    expect(within(lista).getByText("Du har inga kalendrar från Mitt konto ännu.")).toBeTruthy();
    expect(lista.querySelector('[data-kalendersektion="Ärenden"]')).toBeNull();
  });

  it("utan deklarerade sektioner gäller de två gamla: gruppens (bara med rader) och mina (alltid)", async () => {
    rita({ kalendrar: [KALENDRAR[1]], kalendersektioner: undefined, entries: [] });
    const lista = await oppnaListan();
    expect(within(lista).getByText("Mina kalendrar")).toBeTruthy();
    expect(within(lista).queryByText("Gruppens kalendrar")).toBeNull();
  });
});

describe("valet: ändras direkt och sparas efteråt, per person och grupp", () => {
  it("ett tryck på en växel tar bort kalenderns händelser ur rutnätet och sparar valet under appens nyckel", async () => {
    const lagring = minne();
    rita({ lagring });
    expect(dagnamn("2026-10-12")).toBe("12, 3 poster");
    const lista = await oppnaListan();
    fireEvent.click(within(lista).getByRole("switch", { name: "Apple Calendar" }));
    expect(dagnamn("2026-10-12")).toBe("12, 2 poster");
    await waitFor(() => expect(lagring.varden.has(kalenderSynlighetNyckel("person-a:grupp-1"))).toBe(true));
    expect(JSON.parse(/** @type {string} */ (lagring.varden.get("ops-kalender-synlighet:person-a:grupp-1")))).toEqual({ v: 1, syns: { apple: false }, visning: {} });
  });

  it("minnet överlever en ny montering, och en annan grupp har sitt eget", async () => {
    const lagring = minne();
    const forsta = rita({ lagring });
    fireEvent.click(within(await oppnaListan()).getByRole("switch", { name: "Apple Calendar" }));
    await waitFor(() => expect(lagring.varden.size).toBe(1));
    forsta.unmount();

    rita({ lagring });
    expect(dagnamn("2026-10-12")).toBe("12, 2 poster");
    document.body.innerHTML = "";

    render(<OpsCalendar ariaLabel="Kalender" today={IDAG} monthsBack={0} monthsForward={0} entries={POSTER} kalendrar={KALENDRAR} kalenderMinne="person-a:grupp-2" lagring={lagring} />);
    expect(dagnamn("2026-10-12")).toBe("12, 3 poster");
  });

  it("⛔ ett trasigt minne ger förvalen och ett kast i lagringen kraschar inte kalendern", () => {
    rita({ lagring: minne({ "ops-kalender-synlighet:person-a:grupp-1": "{trasig" }) });
    expect(dagnamn("2026-10-12")).toBe("12, 3 poster");
    document.body.innerHTML = "";
    const kastar = { getItem: () => { throw new Error("blockerad"); }, setItem: () => { throw new Error("full"); } };
    const f = vi.spyOn(console, "error").mockImplementation(() => {});
    rita({ lagring: kastar });
    expect(dagnamn("2026-10-12")).toBe("12, 3 poster");
    f.mockRestore();
  });

  it("onSynligaKalendrar får id:n som syns vid start och varje gång mängden ändras", async () => {
    /** @type {string[][]} */
    const anrop = [];
    rita({ onSynligaKalendrar: (/** @type {string[]} */ ids) => anrop.push(ids) });
    expect(anrop).toEqual([["gruppen", "mina", "apple"]]);
    const lista = await oppnaListan();
    fireEvent.click(within(lista).getByRole("switch", { name: "Privat" }));
    fireEvent.click(within(lista).getByRole("switch", { name: "Ärenden" }));
    expect(anrop.at(-1)).toEqual(["gruppen", "apple", "arenden"]);
    expect(anrop).toHaveLength(3);
  });

  it("Alla kalendrar tar fram allt som är på från start igen, och rör inte visningen", async () => {
    rita();
    const lista = await oppnaListan();
    fireEvent.click(within(lista).getByRole("switch", { name: "Apple Calendar" }));
    fireEvent.click(within(lista).getByRole("switch", { name: "Ärenden" }));
    expect(screen.getByRole("button", { name: "Kalendrar: 3 kalendrar" })).toBeTruthy();
    fireEvent.click(within(lista).getByRole("button", { name: "Alla kalendrar" }));
    expect(screen.getByRole("button", { name: "Kalendrar: Alla kalendrar" })).toBeTruthy();
    expect(within(lista).getByRole("switch", { name: "Ärenden" })).not.toBeChecked();
    expect(within(lista).getByRole("switch", { name: "Apple Calendar" })).toBeChecked();
  });

  it("utan kalenderMinne fungerar listan för den här visningen, och inget skrivs", async () => {
    const lagring = minne();
    rita({ lagring, kalenderMinne: undefined });
    fireEvent.click(within(await oppnaListan()).getByRole("switch", { name: "Apple Calendar" }));
    expect(dagnamn("2026-10-12")).toBe("12, 2 poster");
    await new Promise((klar) => setTimeout(klar, 20));
    expect(lagring.varden.size).toBe(0);
  });

  it("hooken ger en annan vy samma val ur samma minne", () => {
    const lagring = minne({ "ops-kalender-synlighet:p:g": JSON.stringify({ v: 1, syns: { apple: false, arenden: true }, visning: { mina: "ram" } }) });
    /** @type {any} */
    let ut;
    function Idag() {
      ut = useKalenderSynlighet({ minne: "p:g", kalendrar: KALENDRAR, lagring });
      return null;
    }
    render(<Idag />);
    expect(ut.synliga).toEqual(["gruppen", "mina", "arenden"]);
    expect(ut.visning("mina")).toBe("ram");
    expect(ut.visning("gruppen")).toBe("handelser");
  });
});

describe("⛔ utan fördröjning: ett tryck ändrar kalendern direkt, mätt", () => {
  it("tryck till ändrad DOM tar under 100 ms, utan ett löfte och utan en hämtning", async () => {
    const hamta = vi.fn(() => Promise.reject(new Error("ingen hämtning ska ske")));
    vi.stubGlobal("fetch", hamta);
    // Ett löfte som aldrig löses: väntade kalendern på att valet sparas skulle den aldrig ändras.
    const sparar = vi.fn(() => new Promise(() => {}));
    const lagring = { getItem: () => null, setItem: sparar };
    // Många poster i det som redan är laddat, ett år bakåt och framåt (förvalet): 25 månader, 4 poster per dag i Apple-kalendern.
    const manga = [...POSTER.filter((p) => p.id !== "tandlakare")];
    for (let d = 1; d <= 28; d++) for (let m = 0; m < 3; m++) manga.push(post(`a-${m}-${d}`, `Apple ${m}-${d}`, `2026-10-${String(d).padStart(2, "0")}`, { kalender: kal(KALENDRAR[2]), extern: { kalla: "Från Apple, ändras i Apple" } }));
    render(<OpsCalendar ariaLabel="Kalender" today={IDAG} entries={manga} kalendrar={KALENDRAR} kalenderMinne="p:g" lagring={lagring} />);
    const lista = await oppnaListan();
    const vaxel = within(lista).getByRole("switch", { name: "Apple Calendar" });

    const foreMarken = document.querySelectorAll("[data-prick]").length;
    expect(dagnamn("2026-10-20")).toBe("20, 3 poster");
    const t0 = performance.now();
    fireEvent.click(vaxel);
    const ms = performance.now() - t0;
    // Golv: en händelse försvann faktiskt. Ett prov som mäter tiden för ett tryck som inte gjorde något är grönt av fel skäl.
    expect(dagnamn("2026-10-20")).toBe("20");
    expect(document.querySelectorAll("[data-prick]").length).toBeLessThan(foreMarken);
    expect(hamta).not.toHaveBeenCalled();
    expect(ms).toBeLessThan(100);
    // Sparandet har börjat (efter ritningen) men ingenting väntar på det.
    await waitFor(() => expect(sparar).toHaveBeenCalledOnce());
    console.log(`[mätning] tryck till ändrad DOM: ${ms.toFixed(1)} ms, ${foreMarken} märken före, ${document.querySelectorAll("[data-prick]").length} efter`);
  });
});

describe("visning per kalender: Händelser, Ram eller Båda", () => {
  /** @param {HTMLElement} lista @param {string} id @param {string} visning */
  async function valjVisning(lista, id, visning) {
    const rad = /** @type {HTMLElement} */ (lista.querySelector(`[data-kalenderrad="${id}"]`));
    const knapp = within(rad).getByRole("button", { name: /Visas som/ });
    if (knapp.getAttribute("aria-expanded") !== "true") fireEvent.click(knapp);
    fireEvent.click(within(rad).getByRole("tab", { name: visning }));
  }
  const prickar = () => [...document.querySelectorAll("[data-prick]")].map((p) => p.getAttribute("data-prick"));
  const ramTon = (/** @type {string} */ d) => dag(d).querySelector("[data-dagram]")?.getAttribute("data-dagram") ?? null;

  it("Händelser är förvalet: märken i rutnätet och ingen ram", () => {
    rita();
    expect(prickar()).toContain("tandlakare");
    expect(ramTon("2026-10-12")).toBeNull();
  });

  it("Ram ritar dagens ram i kalenderns färg och inga märken, och posten står kvar i dagpanelen", async () => {
    rita();
    const lista = await oppnaListan();
    await valjVisning(lista, "apple", "Ram");
    expect(prickar()).not.toContain("tandlakare");
    expect(prickar()).toContain("mote");
    expect(ramTon("2026-10-12")).toBe("2");
    // Dagen räknar posten: den finns, den ritas bara som ram.
    expect(dagnamn("2026-10-12")).toBe("12, 3 poster");
    expect(ramTon("2026-10-13")).toBeNull();
    fireEvent.keyDown(document.body, { key: "Escape" });
    fireEvent.click(dag("2026-10-12"));
    const panel = document.querySelector("[data-dagpanel]");
    expect(panel).toBeTruthy();
    expect(within(/** @type {HTMLElement} */ (panel)).getByText("Tandläkare")).toBeTruthy();
  });

  it("Båda ritar både märket och ramen", async () => {
    rita();
    const lista = await oppnaListan();
    await valjVisning(lista, "apple", "Båda");
    expect(prickar()).toContain("tandlakare");
    expect(ramTon("2026-10-12")).toBe("2");
  });

  it("visningen sparas i samma minne som synligheten, och Händelser tar bort posten igen", async () => {
    const lagring = minne();
    rita({ lagring });
    const lista = await oppnaListan();
    await valjVisning(lista, "apple", "Ram");
    await waitFor(() => expect(JSON.parse(/** @type {string} */ (lagring.varden.get("ops-kalender-synlighet:person-a:grupp-1"))).visning).toEqual({ apple: "ram" }));
    await valjVisning(lista, "apple", "Händelser");
    await waitFor(() => expect(JSON.parse(/** @type {string} */ (lagring.varden.get("ops-kalender-synlighet:person-a:grupp-1"))).visning).toEqual({}));
  });

  it("en kalender som slås av har ingen ram, oavsett visning", async () => {
    rita();
    const lista = await oppnaListan();
    await valjVisning(lista, "apple", "Ram");
    expect(ramTon("2026-10-12")).toBe("2");
    fireEvent.click(within(lista).getByRole("switch", { name: "Apple Calendar" }));
    expect(ramTon("2026-10-12")).toBeNull();
  });

  it("⛔ appens egen ram (dagdekor) vinner över kalenderns, och en app utan visningsval får ingen ram alls", () => {
    rita({ dagdekor: (/** @type {string} */ d) => (d === "2026-10-12" ? { ram: 3 } : undefined) });
    expect(ramTon("2026-10-12")).toBe("3");
  });
});

describe("läspanelen för en extern händelse: samma panel, bara för läsning", () => {
  async function oppnaTandlakaren() {
    fireEvent.click(dag("2026-10-12"));
    fireEvent.click(await screen.findByRole("button", { name: "Tandläkare" }));
    return /** @type {HTMLElement} */ (await screen.findByRole("dialog"));
  }

  it("visar titel, tid, plats, beskrivning och källraden, och ingenting går att ändra", async () => {
    rita();
    const panel = await oppnaTandlakaren();
    expect(panel.querySelector("h1")?.textContent).toBe("Tandläkare");
    expect(panel.querySelector("[data-handelsetid]")?.textContent).toMatch(/09:30/);
    expect(panel.querySelector("[data-handelseplats]")?.textContent).toBe("Tandvården, Visby");
    expect(panel.querySelector("[data-handelsebeskrivning]")?.textContent).toBe("Ta med remissen.");
    expect(panel.querySelector("[data-handelsekalla]")?.textContent).toBe("Från Apple, ändras i Apple");
    expect(panel.querySelector("[data-handelsekalender]")?.textContent).toBe("Apple Calendar");
    // ⛔ Golvet och själva beviset: ingen knapp finns som ändrar något. Bara Tillbaka (och dialogens stäng) är knappar.
    expect(panel.querySelector("[data-handelse-redigera]")).toBeNull();
    expect(panel.querySelector("[data-handelseflytta]")).toBeNull();
    expect(panel.querySelector("[data-handelsedelning]")).toBeNull();
    expect(panel.querySelector("[data-handelsesvar]")).toBeNull();
    expect(within(panel).queryByRole("button", { name: /Redigera|Flytta|Dela|Radera|Ta bort|Spara/ })).toBeNull();
    expect(within(panel).getAllByRole("button").map((b) => b.textContent?.trim() || b.getAttribute("aria-label"))).toEqual(["Tillbaka"]);
  });

  it("Tillbaka lämnar kalendern som den var, med dagen vald", async () => {
    rita();
    const panel = await oppnaTandlakaren();
    fireEvent.click(within(panel).getByRole("button", { name: "Tillbaka" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(dag("2026-10-12").getAttribute("aria-pressed")).toBe("true");
  });

  it("snabbtittens rad öppnar samma panel, och titten stängs", async () => {
    rita();
    fireEvent.contextMenu(dag("2026-10-12"));
    const titt = /** @type {HTMLElement} */ (document.querySelector("[data-snabbtitt]"));
    fireEvent.click(within(titt).getByRole("button", { name: "Tandläkare" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(document.querySelector("[data-snabbtitt]")).toBeNull();
  });

  it("⛔ en extern post utan källrad kastar, och en post med handelseId öppnar sin egen panel och inte läspanelen", () => {
    const f = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => rita({ entries: [post("x", "X", "2026-10-12", { extern: { kalla: " " } })] })).toThrow(/extern.kalla/);
    f.mockRestore();
    const oppna = vi.fn();
    rita({ entries: [post("h", "Egen händelse", "2026-10-12", { handelseId: "h1", extern: { kalla: "Från Apple, ändras i Apple" } })], onOppnaHandelse: oppna });
    fireEvent.click(dag("2026-10-12"));
    fireEvent.click(screen.getByRole("link", { name: "Egen händelse" }));
    expect(oppna).toHaveBeenCalledWith("h1");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Kopiera till…: i panelen för alla händelser", () => {
  const MAL = [
    { id: "familj", namn: "Familj", farg: /** @type {const} */ (3) },
    { id: "jobb", namn: "Jobb", farg: /** @type {const} */ (1) },
  ];
  const HANDELSE = { id: "h1", titel: "Tandläkare", datum: "2026-10-12", tid: "09:30" };

  function Panel(/** @type {Record<string, any>} */ props) {
    return <OpsHandelsePanel handelse={HANDELSE} onTillbaka={() => {}} kopieraTill={MAL} {...props} />;
  }

  it("en egen händelse får knappen, väljaren listar kalendrarna, och onKopiera får händelsen och målet", async () => {
    const onKopiera = vi.fn();
    render(<Panel onKopiera={onKopiera} />);
    fireEvent.click(screen.getByRole("button", { name: "Kopiera till…" }));
    const ruta = await screen.findByRole("dialog");
    expect(within(ruta).getAllByRole("button", { name: /Familj|Jobb/ })).toHaveLength(2);
    fireEvent.click(within(ruta).getByRole("button", { name: "Jobb" }));
    await waitFor(() => expect(onKopiera).toHaveBeenCalledOnce());
    expect(onKopiera).toHaveBeenCalledWith({ handelse: HANDELSE, malKalenderId: "jobb" });
    // Ramverket öppnar inget formulär: rutan stängs och ingenting annat ritas.
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("samma knapp finns i läspanelen för en extern händelse, med samma anrop", async () => {
    const onKopiera = vi.fn();
    rita({ kopieraTill: MAL, onKopiera });
    fireEvent.click(dag("2026-10-12"));
    fireEvent.click(await screen.findByRole("button", { name: "Tandläkare" }));
    fireEvent.click(await screen.findByRole("button", { name: "Kopiera till…" }));
    const ruta = (await screen.findAllByRole("dialog")).at(-1);
    fireEvent.click(within(/** @type {HTMLElement} */ (ruta)).getByRole("button", { name: "Familj" }));
    await waitFor(() => expect(onKopiera).toHaveBeenCalledOnce());
    expect(onKopiera.mock.calls[0][0].malKalenderId).toBe("familj");
    expect(onKopiera.mock.calls[0][0].handelse).toMatchObject({ id: "tandlakare", titel: "Tandläkare", plats: "Tandvården, Visby", kalla: "Från Apple, ändras i Apple" });
  });

  it("⛔ en händelse som redan är kopierad säger det, och väljaren varnar innan en ny kopia till samma kalender görs", async () => {
    const onKopiera = vi.fn();
    render(<Panel onKopiera={onKopiera} kopierad={[{ kalenderId: "familj", namn: "Familj" }]} />);
    expect(screen.getByText("Redan kopierad till Familj")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Kopiera till…" }));
    const ruta = await screen.findByRole("dialog");
    expect(within(ruta).getByText("Redan kopierad")).toBeTruthy();

    fireEvent.click(within(ruta).getByRole("button", { name: /Familj/ }));
    // Varningen står, och ingenting är kopierat än.
    expect(within(ruta).getByRole("alert").textContent).toMatch(/Tandläkare är redan kopierad till Familj/);
    expect(onKopiera).not.toHaveBeenCalled();

    fireEvent.click(within(ruta).getByRole("button", { name: "Avbryt" }));
    expect(onKopiera).not.toHaveBeenCalled();
    fireEvent.click(within(ruta).getByRole("button", { name: /Familj/ }));
    fireEvent.click(within(ruta).getByRole("button", { name: "Kopiera ändå" }));
    await waitFor(() => expect(onKopiera).toHaveBeenCalledOnce());
    expect(onKopiera).toHaveBeenCalledWith({ handelse: HANDELSE, malKalenderId: "familj" });
  });

  it("en kopia till en ANNAN kalender frågar inte, fast en kopia redan finns", async () => {
    const onKopiera = vi.fn();
    render(<Panel onKopiera={onKopiera} kopierad={[{ kalenderId: "familj", namn: "Familj" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Kopiera till…" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Jobb" }));
    await waitFor(() => expect(onKopiera).toHaveBeenCalledWith({ handelse: HANDELSE, malKalenderId: "jobb" }));
  });

  it("⛔ ett fel från appen skrivs ut och lämnar rutan öppen", async () => {
    const onKopiera = vi.fn().mockRejectedValue(new Error("Servern svarar inte"));
    render(<Panel onKopiera={onKopiera} />);
    fireEvent.click(screen.getByRole("button", { name: "Kopiera till…" }));
    const ruta = await screen.findByRole("dialog");
    fireEvent.click(within(ruta).getByRole("button", { name: "Familj" }));
    expect((await within(ruta).findByRole("alert")).textContent).toBe("Det gick inte att kopiera: Servern svarar inte");
  });

  it("utan val ritas ingen knapp, men en redan gjord kopia syns; och val utan onKopiera kastar", () => {
    const { unmount } = render(<Panel kopieraTill={[]} onKopiera={vi.fn()} kopierad={[{ kalenderId: "familj", namn: "Familj" }]} />);
    expect(screen.queryByRole("button", { name: "Kopiera till…" })).toBeNull();
    expect(screen.getByText("Redan kopierad till Familj")).toBeTruthy();
    unmount();
    const f = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Panel />)).toThrow(/onKopiera saknas/);
    f.mockRestore();
  });
});

describe("filtreraPoster: doldaKalendrar", () => {
  const poster = [post("a", "A", "2026-10-12"), post("b", "B", "2026-10-12", { kalender: { id: "x", namn: "X", farg: 1 } }), post("c", "C", "2026-10-12", { kalender: { id: "okand", namn: "Okänd", farg: 1 } })];
  it("döljer en avslagen kalender, låter en okänd vara kvar, och räknar en post utan kalender till den förvalda", () => {
    expect(filtreraPoster(poster, { forvaldId: "gruppen", doldaKalendrar: ["x"] }).map((p) => p.id)).toEqual(["a", "c"]);
    expect(filtreraPoster(poster, { forvaldId: "gruppen", doldaKalendrar: ["gruppen"] }).map((p) => p.id)).toEqual(["b", "c"]);
    expect(filtreraPoster(poster, { forvaldId: "gruppen" }).map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
});

/* Lämnas som referens för den som läser: provet av hooken i en vy som byter grupp. */
describe("hooken byter minne med gruppen", () => {
  it("läser den nya gruppens val under samma ritning", () => {
    const lagring = minne({ "ops-kalender-synlighet:g2": JSON.stringify({ v: 1, syns: { apple: false }, visning: {} }) });
    /** @type {string[][]} */
    const sett = [];
    function Vy() {
      const [g, setG] = useState("g1");
      const syn = useKalenderSynlighet({ minne: g, kalendrar: KALENDRAR, lagring });
      sett.push(syn.synliga);
      return <button onClick={() => setG("g2")}>byt</button>;
    }
    render(<Vy />);
    fireEvent.click(screen.getByRole("button", { name: "byt" }));
    expect(sett.at(-1)).toEqual(["gruppen", "mina"]);
    // Aldrig en ritning med g1:s val under g2: den förra gruppens val skrivs inte över den nya gruppens.
    expect(lagring.varden.get("ops-kalender-synlighet:g2")).toBe(JSON.stringify({ v: 1, syns: { apple: false }, visning: {} }));
  });
});
