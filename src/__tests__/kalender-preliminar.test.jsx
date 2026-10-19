import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsCalendar } from "../components/OpsCalendar.jsx";
import { LANGTRYCK_MS } from "../lib/talk.js";
import { arPreliminar, perDay, preliminarFel } from "../lib/calendar.js";
import { postklasser, prickklass } from "../lib/kalenderfarg.js";

/**
 * Preliminära poster i kalendern (0.127.0, cllp/lifehub.app#383): en händelse vars datum inte är satt ritas på varje FÖRESLAGEN dag, streckad.
 *
 * ⛔ Hur det SER UT (en ring på 6 px, en streckad kant) mäts i en riktig webbläsare, `check-skalyta` avsnitt 50: jsdom kör ingen CSS, så proven
 * här mäter vad som ritas och vilka klasser det bär, inte hur det syns. Klassnamnen är det som mätningen i webbläsaren sedan visar blir en ring.
 */

const TODAY = new Date(2026, 9, 5);

/** Två förslag för samma händelse (olika dagar, olika id, samma handelseId) och en vanlig post på en av dagarna. */
const POSTER = [
  { id: "rep~f1", date: "2026-10-12", title: "Rösta för rep", handelseId: "h-rep", preliminar: true, slag: 1, slagLabel: "Möte" },
  { id: "rep~f2", date: "2026-10-14", title: "Rösta för rep", handelseId: "h-rep", preliminar: true, slag: 1, slagLabel: "Möte" },
  { id: "vanlig", date: "2026-10-12", title: "Styrelsemöte", handelseId: "h-sty", slag: 1, slagLabel: "Möte" },
];

const ruta = (/** @type {string} */ dag) => /** @type {HTMLElement} */ (document.querySelector(`[data-cal-day="${dag}"]`));
const klasser = (/** @type {Element | null} */ el) => String(el?.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);

function rendera(extra = {}) {
  return render(<OpsCalendar entries={POSTER} ariaLabel="Kalender" today={TODAY} onOppnaHandelse={() => {}} {...extra} />);
}

describe("en preliminär post ritas på varje föreslagen dag", () => {
  it("⛔ den ligger på båda dagarna, med samma handelseId, och pricken är ihålig medan en vanlig post är fylld", () => {
    rendera();
    const a = ruta("2026-10-12").querySelector('[data-prick="rep~f1"]');
    const b = ruta("2026-10-14").querySelector('[data-prick="rep~f2"]');
    expect(a, "förslaget den 12").not.toBeNull();
    expect(b, "förslaget den 14").not.toBeNull();
    for (const p of [a, b]) {
      expect(p?.hasAttribute("data-preliminar")).toBe(true);
      const k = klasser(p);
      // Ihålig: ingen fyllning, och slagets färg som kant.
      expect(k).toContain("bg-transparent");
      expect(k).toContain("border-[1.5px]");
      expect(k).toContain("border-slag-1");
      expect(k).not.toContain("bg-slag-1");
    }
    // Den vanliga posten på samma dag är fylld i samma färg, och bär inget märke. Klass för klass som före 0.127.0.
    const vanlig = ruta("2026-10-12").querySelector('[data-prick="vanlig"]');
    expect(vanlig?.hasAttribute("data-preliminar")).toBe(false);
    expect(klasser(vanlig)).toEqual(["size-1.5", "shrink-0", "rounded-full", "bg-slag-1"]);
  });

  it("⛔ en preliminär post är aldrig ett band, och en dag med ett förslag och en vanlig post räknar båda", () => {
    rendera();
    expect(document.querySelectorAll("[data-bandbit]")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "12, 2 poster" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "14, 1 post" })).toBeInTheDocument();
  });

  it("pillret från 640 px har streckad kant och ingen fyllning, ett vanligt piller är oförändrat", () => {
    rendera();
    const piller = ruta("2026-10-12").querySelectorAll("[data-kalender-piller] > span");
    const prel = [...piller].find((p) => p.textContent === "Rösta för rep");
    const vanligt = [...piller].find((p) => p.textContent === "Styrelsemöte");
    expect(prel && vanligt).toBeTruthy();
    const k = klasser(prel ?? null);
    expect(k).toEqual(expect.arrayContaining(["border", "border-dashed", "bg-transparent", "border-slag-1"]));
    expect(k).not.toContain("border-l-3");
    expect(k).not.toContain("bg-ink-secondary/15");
    // Samma höjd som ett vanligt piller: luften över och under är 0 när kanten är 1 px.
    expect(k).toContain("py-0");
    expect(klasser(vanligt ?? null)).toEqual(expect.arrayContaining(["border-l-3", "bg-ink-secondary/15", "border-l-slag-1", "py-px"]));
    expect(klasser(vanligt ?? null)).not.toContain("border-dashed");
  });
});

describe("dagpanelen och snabbtitten säger Datum ej satt", () => {
  it("⛔ kortet har streckad kant och ordet, och båda förslagen öppnar SAMMA händelse", () => {
    const oppna = vi.fn();
    rendera({ onOppnaHandelse: oppna });
    fireEvent.click(ruta("2026-10-12"));
    fireEvent.click(ruta("2026-10-14"));
    const panel = /** @type {HTMLElement} */ (document.querySelector("[data-dagpanel]"));
    const kort = [...panel.querySelectorAll("[data-postrad]")];
    const prel = kort.filter((k) => k.hasAttribute("data-preliminar"));
    expect(prel).toHaveLength(2);
    for (const k of prel) {
      expect(klasser(k)).toContain("border-dashed");
      expect(k.textContent).toContain("Datum ej satt");
    }
    // Det vanliga kortet säger inget om datum och är inte streckat.
    const vanligt = kort.find((k) => k.textContent?.includes("Styrelsemöte"));
    expect(vanligt?.textContent).not.toContain("Datum ej satt");
    expect(klasser(vanligt ?? null)).not.toContain("border-dashed");
    // Båda förslagen leder till samma händelse.
    for (const k of prel) fireEvent.click(within(/** @type {HTMLElement} */ (k)).getByRole("link", { name: "Rösta för rep" }));
    expect(oppna.mock.calls.map((c) => c[0])).toEqual(["h-rep", "h-rep"]);
  });

  it("på engelska säger kortet Date not set", () => {
    rendera({ locale: "en-GB" });
    fireEvent.click(ruta("2026-10-12"));
    const panel = /** @type {HTMLElement} */ (document.querySelector("[data-dagpanel]"));
    expect(panel.textContent).toContain("Date not set");
    expect(panel.textContent).not.toContain("Datum ej satt");
  });

  it("snabbtittens rad har en ihålig prick och ordet", () => {
    vi.useFakeTimers();
    try {
      rendera();
      fireEvent.pointerDown(ruta("2026-10-12"), { pointerId: 1, clientX: 10, clientY: 10, button: 0 });
      act(() => vi.advanceTimersByTime(LANGTRYCK_MS));
      fireEvent.pointerUp(ruta("2026-10-12"), { pointerId: 1 });
      fireEvent.click(ruta("2026-10-12"));
      const titt = /** @type {HTMLElement} */ (document.querySelector("[data-snabbtitt]"));
      const rader = [...titt.querySelectorAll("[data-titt-rad]")];
      expect(rader).toHaveLength(2);
      const prel = /** @type {HTMLElement} */ (rader.find((r) => r.textContent?.includes("Rösta för rep")));
      expect(prel.textContent).toContain("Datum ej satt");
      expect(klasser(prel.querySelector("[data-preliminar]"))).toEqual(expect.arrayContaining(["bg-transparent", "border-slag-1"]));
      const vanlig = /** @type {HTMLElement} */ (rader.find((r) => r.textContent?.includes("Styrelsemöte")));
      expect(vanlig.textContent).not.toContain("Datum ej satt");
      expect(vanlig.querySelector("[data-preliminar]")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("⛔ ett förslag är en dag", () => {
  it("en preliminär post med endDate eller allDay kastar, med postens id", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const band = { id: "bandet", date: "2026-10-12", endDate: "2026-10-14", title: "X", preliminar: true };
    expect(() => render(<OpsCalendar entries={[band]} ariaLabel="K" today={TODAY} />)).toThrow(/"bandet" är preliminär.*endDate eller allDay/);
    expect(() => render(<OpsCalendar entries={[{ id: "heldag", date: "2026-10-12", title: "X", preliminar: true, allDay: true }]} ariaLabel="K" today={TODAY} />)).toThrow(/"heldag" är preliminär/);
    // En vanlig post med spann är oförändrad, och kastar inte.
    expect(() => render(<OpsCalendar entries={[{ ...band, preliminar: undefined }]} ariaLabel="K" today={TODAY} />)).not.toThrow();
    spy.mockRestore();
  });

  it("preliminarFel och arPreliminar: bara true räknas, och en post utan datum tappas inte tyst men ritas inte heller", () => {
    expect(arPreliminar({ id: "a", date: "2026-10-12", title: "A", preliminar: true })).toBe(true);
    // @ts-expect-error provar ett värde som inte är sant
    expect(arPreliminar({ id: "a", date: "2026-10-12", title: "A", preliminar: "ja" })).toBe(false);
    expect(arPreliminar(null)).toBe(false);
    expect(preliminarFel([{ id: "a", date: "2026-10-12", title: "A", preliminar: true }])).toBeNull();
    expect(preliminarFel([])).toBeNull();
    // `perDay` hoppar över en post utan `date` (förut också): därför ger `handelsensDagar` null för en händelse utan datum, och appen skickar en post per FÖRESLAGEN dag.
    expect(perDay(/** @type {any} */ ([{ id: "x", title: "Utan dag", preliminar: true }])).size).toBe(0);
  });

  it("ringens färg kommer ur samma ordning som pricken: slag, kalender, accent", () => {
    const slag = { id: "a", date: "2026-10-12", title: "A", slag: 2, slagLabel: "Påminnelse", preliminar: true };
    expect(postklasser(slag).ring).toBe("border-slag-2");
    expect(postklasser(slag).prick).toBe("bg-slag-2");
    const kal = { id: "b", date: "2026-10-12", title: "B", kalender: { id: "k", namn: "Rep", farg: /** @type {const} */ (3) }, preliminar: true };
    expect(postklasser(kal).ring).toBe("border-identity-3");
    expect(postklasser({ id: "c", date: "2026-10-12", title: "C", preliminar: true }).ring).toBe("border-accent");
    // I en vald ruta är fyllningen rutans textfärg: pricken blir en ring i samma färg, inte i postens.
    expect(prickklass(slag, true)).toBe("border-[1.5px] border-ink bg-transparent");
    expect(prickklass({ ...slag, preliminar: undefined }, true)).toBe("bg-ink");
  });
});
