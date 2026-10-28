import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { OpsKalenderLista } from "../components/OpsKalenderLista.jsx";
import { OpsCalendar } from "../components/OpsCalendar.jsx";
import { kalenderSynlighetNyckel } from "../lib/kalendersynlighet.js";
import { useKalenderSynlighet } from "../lib/useKalenderSynlighet.js";
import { LANGTRYCK_MS } from "../lib/apparark.js";
import { registreraFelmottagare } from "../lib/felrapport.js";
import { KORTKOMMANDO } from "../components/useLangtryck.js";

/**
 * Långtryck i kalenderlistan visar bara den kalendern (0.151.0, CP 2026-10-28: "kör").
 *
 * Provet gör det en person gör: håller in en rad, släpper, och ser att de andra är avslagna; håller in samma rad igen och ser att allt är som förut. Med mus och tangentbord nås
 * samma val med högerklick, Shift+F10 och knappen "Visa bara den här". Ett vanligt tryck gör som förut. ⛔ Valet sparas som vilket synlighetsval som helst, med "före" i samma dokument.
 */

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const KAL = [
  { id: "gruppen", namn: "Styrelsen", farg: 4, grupp: true, forvald: true },
  { id: "mina", namn: "Privat", farg: 5 },
  { id: "apple", namn: "Apple Calendar", farg: 2, sektion: "Från Mitt konto" },
  { id: "arenden", namn: "Ärenden", farg: 6, sektion: "Ärenden", avFranStart: true },
];

function minne(/** @type {any} */ start) {
  const varden = new Map(start ? [[kalenderSynlighetNyckel("p:g"), JSON.stringify(start)]] : []);
  return { varden, getItem: (/** @type {string} */ n) => (varden.has(n) ? varden.get(n) : null), setItem: (/** @type {string} */ n, /** @type {string} */ v) => void varden.set(n, v) };
}

/** @param {{ kalendrar?: any[], lagring?: any, konto?: any, sprak?: string }} [p] */
function Lista({ kalendrar = KAL, lagring, konto, sprak }) {
  const syn = useKalenderSynlighet({ minne: "p:g", kalendrar, lagring, konto });
  return <OpsKalenderLista kalendrar={kalendrar} syn={syn} sprak={sprak} />;
}

/** jsdom saknar PointerEvent: en MouseEvent med pekartypens namn, som i `atgardsblad-langtryck`. @param {EventTarget} el @param {string} typ @param {Record<string, number>} [pos] */
function peka(el, typ, pos = {}) {
  act(() => {
    el.dispatchEvent(new MouseEvent(typ, { bubbles: true, cancelable: true, clientX: 40, clientY: 100, button: 0, ...pos }));
  });
}
const rad = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.querySelector(`[data-kalenderrad="${id}"]`));
const yta = (/** @type {string} */ id) => /** @type {HTMLElement} */ (rad(id).querySelector("[data-kalenderrad-yta]"));
const paslagna = () => screen.getAllByRole("switch").filter((s) => /** @type {HTMLInputElement} */ (s).checked).map((s) => s.getAttribute("aria-labelledby") && document.getElementById(/** @type {string} */ (s.getAttribute("aria-labelledby")))?.textContent);

/** Håller in en rad och släpper: ett långtryck, med fingret som lyfts efteråt och klicket som följer. @param {string} id */
function langtryck(id) {
  peka(yta(id), "pointerdown");
  act(() => {
    vi.advanceTimersByTime(LANGTRYCK_MS + 50);
  });
  peka(document, "pointerup");
  // Klicket webbläsaren skickar när fingret lyfts, på etiketten.
  fireEvent.click(/** @type {HTMLElement} */ (rad(id).querySelector("label")));
}

describe("långtryck på en rad", () => {
  it("gör den ensam synlig, och ett nytt långtryck på samma rad tar tillbaka valen som gällde före", () => {
    render(<Lista lagring={minne()} />);
    // Före: personen har själv slagit av Privat och på Ärenden.
    fireEvent.click(screen.getByRole("switch", { name: "Privat" }));
    fireEvent.click(screen.getByRole("switch", { name: "Ärenden" }));
    expect(paslagna()).toEqual(["Styrelsen", "Apple Calendar", "Ärenden"]);

    langtryck("apple");
    expect(paslagna()).toEqual(["Apple Calendar"]);
    // ⛔ Klicket som följde släppet växlade inte raden: den är kvar på.
    expect(screen.getByRole("switch", { name: "Apple Calendar" })).toBeChecked();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    langtryck("apple");
    expect(paslagna()).toEqual(["Styrelsen", "Apple Calendar", "Ärenden"]);
  });

  it("en dold rad blir synlig och ensam", () => {
    render(<Lista lagring={minne()} />);
    expect(screen.getByRole("switch", { name: "Ärenden" })).not.toBeChecked();
    langtryck("arenden");
    expect(paslagna()).toEqual(["Ärenden"]);
  });

  it("⛔ ett vanligt tryck gör som förut: växlar raden, och ingenting annat", () => {
    render(<Lista lagring={minne()} />);
    fireEvent.click(screen.getByRole("switch", { name: "Apple Calendar" }));
    expect(paslagna()).toEqual(["Styrelsen", "Privat"]);
    fireEvent.click(screen.getByRole("switch", { name: "Apple Calendar" }));
    expect(paslagna()).toEqual(["Styrelsen", "Privat", "Apple Calendar"]);
  });

  it("ett tryck som släpps före tiden är ett vanligt tryck, och ett finger som rör sig avbryter", () => {
    render(<Lista lagring={minne()} />);
    peka(yta("apple"), "pointerdown");
    act(() => {
      vi.advanceTimersByTime(LANGTRYCK_MS - 100);
    });
    peka(document, "pointerup");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(paslagna()).toEqual(["Styrelsen", "Privat", "Apple Calendar"]);
    // Rullar listan: fingret flyttar sig mer än toleransen.
    peka(yta("apple"), "pointerdown");
    peka(document, "pointermove", { clientY: 160 });
    act(() => {
      vi.advanceTimersByTime(LANGTRYCK_MS + 100);
    });
    expect(paslagna()).toEqual(["Styrelsen", "Privat", "Apple Calendar"]);
  });

  it("valet sparas som vilket val som helst, med 'före' i samma dokument", () => {
    const lag = minne();
    render(<Lista lagring={lag} />);
    fireEvent.click(screen.getByRole("switch", { name: "Privat" }));
    langtryck("apple");
    const sparat = JSON.parse(lag.varden.get("ops-kalender-synlighet:p:g"));
    expect(sparat).toEqual({ v: 1, syns: { mina: false, gruppen: false }, visning: {}, fore: { mina: false } });
  });

  it("visningen rörs inte", () => {
    const lag = minne();
    lag.varden.set("ops-kalender-synlighet:p:g", JSON.stringify({ v: 1, syns: {}, visning: { gruppen: "ram" } }));
    render(<Lista lagring={lag} />);
    langtryck("apple");
    expect(JSON.parse(lag.varden.get("ops-kalender-synlighet:p:g")).visning).toEqual({ gruppen: "ram" });
  });
});

describe("⛔ mus och tangentbord: samma val utan långtryck", () => {
  it("Shift+F10 på raden, och menytangenten, gör samma sak", () => {
    render(<Lista lagring={minne()} />);
    fireEvent.keyDown(screen.getByRole("switch", { name: "Apple Calendar" }), { key: "F10", shiftKey: true });
    expect(paslagna()).toEqual(["Apple Calendar"]);
    fireEvent.keyDown(screen.getByRole("switch", { name: "Apple Calendar" }), { key: "ContextMenu" });
    expect(paslagna()).toEqual(["Styrelsen", "Privat", "Apple Calendar"]);
    expect(KORTKOMMANDO).toBe("Shift+F10");
  });

  it("högerklick på raden gör samma sak", () => {
    render(<Lista lagring={minne()} />);
    fireEvent.contextMenu(yta("mina"));
    expect(paslagna()).toEqual(["Privat"]);
  });

  it("knappen 'Visa bara den här' finns på en dold rad som egen rad, och i utfällningen på en synlig", () => {
    render(<Lista lagring={minne()} />);
    // Dold rad (Ärenden): knappen syns utan att något fälls ut.
    const dold = within(rad("arenden")).getByRole("button", { name: "Visa bara den här" });
    // Synlig rad (Apple): knappen finns först när utfällningen är öppen.
    expect(within(rad("apple")).queryByRole("button", { name: "Visa bara den här" })).toBeNull();
    fireEvent.click(within(rad("apple")).getByRole("button", { name: /Visas som/ }));
    const synlig = within(rad("apple")).getByRole("button", { name: "Visa bara den här" });
    fireEvent.click(synlig);
    expect(paslagna()).toEqual(["Apple Calendar"]);
    // Raden är ensam: knappen heter nu Visa som förut, och tar tillbaka.
    expect(within(rad("apple")).getByRole("button", { name: "Visa som förut" })).toBeTruthy();
    fireEvent.click(within(rad("apple")).getByRole("button", { name: "Visa som förut" }));
    expect(paslagna()).toEqual(["Styrelsen", "Privat", "Apple Calendar"]);
    // Och den dolda radens knapp gör den ensam.
    fireEvent.click(dold);
    expect(paslagna()).toEqual(["Ärenden"]);
  });
});

describe("med en enda kalender finns varken gesten eller knappen", () => {
  it("'bara den här' betyder ingenting när det inte finns någon annan", () => {
    const lag = minne();
    render(<Lista kalendrar={[KAL[0]]} lagring={lag} />);
    expect(screen.queryByRole("button", { name: "Visa bara den här" })).toBeNull();
    fireEvent.click(within(rad("gruppen")).getByRole("button", { name: /Visas som/ }));
    expect(screen.queryByRole("button", { name: "Visa bara den här" })).toBeNull();
    // Ingen gest: ett långt tryck är bara ett långsamt tryck, och klicket efter släppet växlar raden som vilket klick som helst.
    langtryck("gruppen");
    expect(paslagna()).toEqual([]);
    expect(yta("gruppen").className).not.toContain("select-none");
    expect(JSON.parse(lag.varden.get("ops-kalender-synlighet:p:g"))).toEqual({ v: 1, syns: { gruppen: false }, visning: {} });
  });
});

describe("språket", () => {
  it("listans egna ord följer språket, och appens ord passerar orörda", () => {
    render(<Lista lagring={minne()} sprak="en" />);
    expect(screen.getByRole("button", { name: "All calendars" })).toBeTruthy();
    expect(within(rad("arenden")).getByRole("button", { name: "Show only this" })).toBeTruthy();
    fireEvent.click(within(rad("apple")).getByRole("button", { name: /Shown as/ }));
    expect(within(rad("apple")).getByRole("tab", { name: "Frame" })).toBeTruthy();
    expect(within(rad("apple")).getByRole("tablist", { name: "Display for Apple Calendar" })).toBeTruthy();
    // Appens eget namn och sektionsnamn är appens.
    expect(screen.getByRole("switch", { name: "Apple Calendar" })).toBeTruthy();
    expect(document.querySelector('[data-kalendersektion="Från Mitt konto"]')).toBeTruthy();
    // De två förvalda sektionerna är listans, på listans språk.
    expect(document.querySelector('[data-kalendersektion="Group calendars"]')).toBeTruthy();
    expect(document.querySelector('[data-kalendersektion="My calendars"]')).toBeTruthy();
  });

  it("svenska är förvalet", () => {
    render(<Lista lagring={minne()} />);
    expect(screen.getByRole("button", { name: "Alla kalendrar" })).toBeTruthy();
    expect(document.querySelector('[data-kalendersektion="Gruppens kalendrar"]')).toBeTruthy();
  });
});

describe("⛔ felet mot kontot syns i listan, med en knapp", () => {
  it("ett skrivfel skrivs ut i listan, och Försök igen skriver det senaste valet", async () => {
    vi.useRealTimers();
    const av = registreraFelmottagare({ fanga: () => {}, satt: () => {} });
    let nekar = true;
    const skriv = vi.fn(() => (nekar ? Promise.reject(new Error("nekad")) : Promise.resolve()));
    const konto = { las: () => Promise.resolve(null), skriv };
    render(<Lista lagring={minne()} konto={konto} />);
    await act(async () => {});
    fireEvent.click(screen.getByRole("switch", { name: "Apple Calendar" }));
    await act(async () => {});
    const larm = await screen.findByRole("alert");
    expect(larm.textContent).toContain("Valet sparades inte på kontot");
    expect(larm.getAttribute("data-kalender-kontofel")).toBe("skriv");
    // Valet står kvar.
    expect(screen.getByRole("switch", { name: "Apple Calendar" })).not.toBeChecked();
    nekar = false;
    fireEvent.click(within(larm).getByRole("button", { name: "Försök igen" }));
    await act(async () => {});
    expect(skriv).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
    av();
  });

  it("ett läsfel säger att det som visas är den här enhetens, på det språk som gäller", async () => {
    vi.useRealTimers();
    const av = registreraFelmottagare({ fanga: () => {}, satt: () => {} });
    const konto = { las: () => Promise.reject(new Error("offline")), skriv: () => Promise.resolve() };
    render(<Lista lagring={minne()} konto={konto} sprak="en" />);
    await act(async () => {});
    const larm = await screen.findByRole("alert");
    expect(larm.textContent).toContain("could not be fetched from your account");
    expect(within(larm).getByRole("button", { name: "Try again" })).toBeTruthy();
    av();
  });

  it("utan fel finns ingen rad om fel", async () => {
    vi.useRealTimers();
    render(<Lista lagring={minne()} konto={{ las: () => Promise.resolve(null), skriv: () => Promise.resolve() }} />);
    await act(async () => {});
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("⛔ för många val sparade: eget besked på listans språk, ingen Försök igen-knapp, inget skrivförsök och en rapport", async () => {
    vi.useRealTimers();
    const fanget = /** @type {string[]} */ ([]);
    const av = registreraFelmottagare({ fanga: (fel) => void fanget.push(String(/** @type {Error} */ (fel).message)), satt: () => {} });
    const skriv = vi.fn(() => Promise.resolve());
    const konto = { las: () => Promise.resolve(null), skriv };
    const manga = Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`k${i}`, true]));
    render(<Lista lagring={minne({ v: 1, syns: manga, visning: {} })} konto={konto} />);
    await act(async () => {});
    const larm = await screen.findByRole("alert");
    expect(larm.getAttribute("data-kalender-kontofel")).toBe("formanga");
    expect(larm.textContent).toContain("För många val sparade");
    expect(within(larm).queryByRole("button")).toBeNull();
    // Tryck vid tryck: inga skrivförsök, ingen ny rapport.
    fireEvent.click(screen.getByRole("switch", { name: "Apple Calendar" }));
    await act(async () => {});
    fireEvent.click(screen.getByRole("switch", { name: "Apple Calendar" }));
    await act(async () => {});
    expect(skriv).not.toHaveBeenCalled();
    expect(fanget).toHaveLength(1);
    av();
  });

});

describe("genom OpsCalendar: kalendern ändras i samma stund", () => {
  it("långtryck i väljaren döljer de andra kalendrarnas märken i rutnätet, och ett till tar tillbaka dem", async () => {
    vi.useRealTimers();
    const poster = [
      { id: "p1", title: "Styrelsemöte", date: "2026-10-12" },
      { id: "p2", title: "Kaffe", date: "2026-10-12", kalender: { id: "mina", namn: "Privat", farg: 5 } },
      { id: "p3", title: "Tandläkare", date: "2026-10-13", kalender: { id: "apple", namn: "Apple Calendar", farg: 2 } },
    ];
    render(<OpsCalendar ariaLabel="Kalender" today={new Date(2026, 9, 5, 12)} monthsBack={0} monthsForward={0} entries={poster} kalendrar={KAL} kalenderMinne="p:g" lagring={minne()} />);
    fireEvent.click(screen.getByRole("button", { name: /^Kalendrar: / }));
    await screen.findByRole("dialog", { name: "Kalendrar" });
    const prickar = () => [...document.querySelectorAll("[data-prick]")].map((p) => p.getAttribute("data-prick"));
    expect(prickar()).toEqual(expect.arrayContaining(["p1", "p2", "p3"]));
    vi.useFakeTimers();
    langtryck("apple");
    expect(prickar()).toEqual(["p3"]);
    expect(screen.getByRole("button", { name: "Kalendrar: Apple Calendar" })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    langtryck("apple");
    expect(prickar()).toEqual(expect.arrayContaining(["p1", "p2", "p3"]));
    expect(screen.getByRole("button", { name: "Kalendrar: Alla kalendrar" })).toBeTruthy();
  });
});

describe("listan följer kalenderns språk", () => {
  it("en engelsk locale ger en engelsk lista, annars gäller språket ur providern", async () => {
    vi.useRealTimers();
    const { unmount } = render(<OpsCalendar ariaLabel="Calendar" locale="en-GB" today={new Date(2026, 9, 5, 12)} monthsBack={0} monthsForward={0} entries={[]} kalendrar={KAL} kalenderMinne="p:g" lagring={minne()} />);
    fireEvent.click(screen.getByRole("button", { name: /^Kalendrar: / }));
    const lista = await screen.findByRole("dialog", { name: "Kalendrar" });
    expect(within(lista).getByRole("button", { name: "All calendars" })).toBeTruthy();
    expect(within(lista).getAllByRole("button", { name: "Show only this" }).length).toBeGreaterThan(0);
    unmount();
  });
});
