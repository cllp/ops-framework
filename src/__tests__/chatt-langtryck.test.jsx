import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpsGastChatt } from "../components/OpsGastChatt.jsx";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { LANGTRYCK_MS } from "../lib/apparark.js";
import { createSamtalskalla } from "../data/samtalskalla.js";
import { levandeKalla } from "./levandeKalla.js";

/**
 * Chattens meny och tid (0.190.0, CP 2026-11-05 i cllp/lifehub.app#658, del D): menyn på ett meddelande öppnas med ett långt tryck på bubblan på
 * pekskärm, ⋮ ritas inte där, och tiden står på namnraden i stället för på en egen rad under bubblan. Gäller alla, inte bara gäster: proven körs
 * både i gästens chatt och i medlemmens.
 *
 * ⛔ jsdom kör ingen CSS och har ingen `matchMedia`: pekskärmen stubbas, och att ⋮ verkligen är dold på pekskärm och syns vid hover med mus mäts i en riktig
 * webbläsare (390 och 1280 px, skärmbilderna efter release, regel 12). Här mäts beteendet och klasserna.
 */

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** En pekskärm på bred skärm (en surfplatta): ⋮ hade inte ritats alls förut, och långtrycket är enda vägen. */
function pekskarm() {
  vi.stubGlobal("matchMedia", (/** @type {string} */ q) => ({ matches: q.includes("coarse"), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
}

/** @param {EventTarget} el @param {string} typ @param {Record<string, unknown>} [extra] */
function peka(el, typ, extra = {}) {
  act(() => {
    const e = new MouseEvent(typ, { bubbles: true, cancelable: true, clientX: 40, clientY: 200, button: 0, ...extra });
    Object.defineProperty(e, "pointerType", { value: extra.pointerType ?? "touch" });
    el.dispatchEvent(e);
  });
}

const T = Date.UTC(2026, 10, 5, 9, 0);
const RADER = [
  { id: "a", av: { namn: "Maja Medlem" }, text: "Hej från Maja", tid: T },
  { id: "b", av: { namn: "Maja Medlem" }, text: "Och en till", tid: T + 60_000 },
  { id: "c", av: { namn: "Bo Gäst" }, text: "Hej från Bo", tid: T + 10 * 60_000, gast: true },
];

describe("gästens chatt: långtryck på bubblan", () => {
  it("⛔ 500 ms på bubblan öppnar meddelandets meny, och ett kortare tryck gör det inte", () => {
    pekskarm();
    vi.useFakeTimers();
    render(<OpsGastChatt meddelanden={RADER} />);
    const bubbla = /** @type {HTMLElement} */ (screen.getByText("Hej från Bo", { selector: "[data-bubbla] *" }).closest("[data-bubbla]"));
    peka(bubbla, "pointerdown");
    act(() => {
      vi.advanceTimersByTime(LANGTRYCK_MS - 100);
    });
    expect(screen.queryByRole("menu")).toBeNull();
    peka(document, "pointerup");
    peka(bubbla, "pointerdown");
    act(() => {
      vi.advanceTimersByTime(LANGTRYCK_MS + 50);
    });
    const meny = screen.getByRole("menu");
    expect(within(meny).getAllByRole("menuitem").map((b) => b.textContent)).toEqual(["Kopiera"]);
  });

  it("⛔ ett finger som rör sig (rullar) avbryter, en mus startar inget, och contextmenu öppnar samma meny", () => {
    pekskarm();
    vi.useFakeTimers();
    render(<OpsGastChatt meddelanden={RADER} />);
    const bubbla = /** @type {HTMLElement} */ (screen.getByText("Hej från Maja", { selector: "[data-bubbla] *" }).closest("[data-bubbla]"));
    peka(bubbla, "pointerdown");
    peka(document, "pointermove", { clientX: 40, clientY: 240 });
    act(() => {
      vi.advanceTimersByTime(LANGTRYCK_MS + 50);
    });
    expect(screen.queryByRole("menu")).toBeNull();
    peka(document, "pointerup");
    peka(bubbla, "pointerdown", { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(LANGTRYCK_MS + 50);
    });
    expect(screen.queryByRole("menu")).toBeNull();
    peka(document, "pointerup", { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    act(() => {
      fireEvent.contextMenu(bubbla, { clientX: 40, clientY: 200 });
    });
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("⛔ tiden står på namnraden efter namnet och märket Gäst, och inte under bubblan; ett meddelande som fortsätter en följd står utan", () => {
    render(<OpsGastChatt meddelanden={RADER} />);
    const namnrader = [...document.querySelectorAll("[data-namnrad]")];
    // Golv: tre meddelanden, två namnrader (Majas andra fortsätter hennes första).
    expect(document.querySelectorAll("[data-bubbla]")).toHaveLength(3);
    expect(namnrader).toHaveLength(2);
    const bo = /** @type {HTMLElement} */ (namnrader[1]);
    // Namnraden är namnets egen span (inget extra element): namnet, märket Gäst och tiden i den ordningen.
    expect(bo.hasAttribute("data-avsandare")).toBe(true);
    expect(bo.firstChild?.textContent).toBe("Bo Gäst");
    expect([...bo.children].map((c) => (c.hasAttribute("data-gast-markning") ? "gast" : c.hasAttribute("data-meddelande-tid") ? "tid" : "?"))).toEqual(["gast", "tid"]);
    expect(document.querySelectorAll("[data-meddelande-tid]")).toHaveLength(2);
    // Ingen tid i raden under någon bubbla.
    for (const b of document.querySelectorAll("[data-bubbla]")) {
      const kolumn = /** @type {HTMLElement} */ (b.closest("[data-meddelande]"));
      const under = /** @type {HTMLElement} */ (kolumn.querySelector("[data-mer]")?.parentElement);
      expect(under.textContent).not.toMatch(/\d{1,2}[:.]\d{2}/);
    }
  });
});

describe("medlemmens chatt: samma långtryck och samma namnrad", () => {
  it("⛔ ett långt tryck på en bubbla öppnar medlemmens meny med Svara i tråd, Fäst och Kopiera, och tiden står på namnraden", async () => {
    pekskarm();
    const kalla = levandeKalla();
    const s = /** @type {any} */ (createSamtalskalla({ kalla, tradar: "tradar", reaktioner: "reaktioner", citat: true, fasta: "fasta" }));
    const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
    await s.skicka(g.id, { text: "Hej gruppen", av: "bo" });
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={[{ userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" }, { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" }]} valt={g.id} />);
    const logg = await screen.findByRole("log");
    const bubbla = /** @type {HTMLElement} */ ((await within(logg).findByText("Hej gruppen")).closest("[data-bubbla]"));
    const rad = /** @type {HTMLElement} */ (bubbla.closest("[data-meddelande]"));
    expect(rad.querySelector("[data-namnrad] [data-meddelande-tid]")).not.toBeNull();
    peka(bubbla, "pointerdown");
    await new Promise((r) => setTimeout(r, LANGTRYCK_MS + 80));
    const meny = await screen.findByRole("menu");
    await waitFor(() => expect(within(meny).getAllByRole("menuitem").map((b) => b.textContent)).toEqual(["Svara i tråd", "Fäst", "Kopiera"]));
  });
});
