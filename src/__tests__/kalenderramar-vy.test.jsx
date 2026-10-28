import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { OpsCalendar } from "../components/OpsCalendar.jsx";
import { OpsDoldMarke, DOLD_RAD_KLASS } from "../components/OpsDoldMarke.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { useKalenderSynlighet } from "../lib/useKalenderSynlighet.js";
import { LANGTRYCK_MS } from "../lib/talk.js";

/**
 * Två ramar inuti varandra, högst två (0.151.0, CP 2026-10-28), och märket Dold som både snabbtitten och appens Dagen ritar.
 *
 * jsdom kör ingen CSS: här prövas VAD som ritas (vilka ramar, i vilken ordning, med vilken ton). Att ramarna syns, ligger inuti varandra och inte täcker siffran eller brickorna
 * mäts i Chromium (`scripts/kalenderramar-matt.mjs`, 320, 390, 768 och 1280 px).
 */

afterEach(() => vi.useRealTimers());

const IDAG = new Date(2026, 9, 5, 12);
const KAL = [
  { id: "gruppen", namn: "Styrelsen", farg: 4, grupp: true, forvald: true },
  { id: "resor", namn: "Resor", farg: 1, grupp: true },
  { id: "mina", namn: "Privat", farg: 5 },
];
const kal = (/** @type {string} */ id) => {
  const k = /** @type {typeof KAL[number]} */ (KAL.find((x) => x.id === id));
  return { id: k.id, namn: k.namn, farg: k.farg };
};
const POSTER = [
  { id: "p1", title: "Möte", date: "2026-10-12", kalender: kal("gruppen") },
  { id: "p2", title: "Resa", date: "2026-10-12", kalender: kal("resor") },
  { id: "p3", title: "Kaffe", date: "2026-10-12", kalender: kal("mina") },
  { id: "p4", title: "Lunch", date: "2026-10-13", kalender: kal("resor") },
];

function minne(/** @type {Record<string, any>} */ visning = {}) {
  const varden = new Map([["ops-kalender-synlighet:p:g", JSON.stringify({ v: 1, syns: {}, visning })]]);
  return { varden, getItem: (/** @type {string} */ n) => (varden.has(n) ? /** @type {string} */ (varden.get(n)) : null), setItem: (/** @type {string} */ n, /** @type {string} */ v) => void varden.set(n, v) };
}
/** @param {Record<string, any>} visning @param {Record<string, any>} [extra] */
function rita(visning, extra = {}) {
  return render(<OpsCalendar ariaLabel="Kalender" today={IDAG} monthsBack={0} monthsForward={0} entries={POSTER} kalendrar={KAL} kalenderMinne="p:g" lagring={minne(visning)} {...extra} />);
}
const dag = (/** @type {string} */ d) => /** @type {HTMLElement} */ (document.querySelector(`[data-cal-day="${d}"]`));
const yttre = (/** @type {string} */ d) => dag(d).querySelector("[data-dagram]");
const inre = (/** @type {string} */ d) => dag(d).querySelector("[data-dagram-inre]");

describe("två ramar på en dag", () => {
  it("⛔ två kalendrar med ram samma dag ritar båda, den andra inuti den första, i listans ordning", () => {
    rita({ gruppen: "ram", resor: "bada" });
    expect(yttre("2026-10-12")?.getAttribute("data-dagram")).toBe("4");
    expect(inre("2026-10-12")?.getAttribute("data-dagram-inre")).toBe("1");
    expect(yttre("2026-10-12")?.className).toContain("border-identity-4");
    expect(inre("2026-10-12")?.className).toContain("border-identity-1");
    // Den yttre ligger före den inre i rutan (och alltså under den i stapelordning).
    const barn = [...dag("2026-10-12").children];
    expect(barn.indexOf(/** @type {Element} */ (yttre("2026-10-12")))).toBeLessThan(barn.indexOf(/** @type {Element} */ (inre("2026-10-12"))));
  });

  it("⛔ ordningen är listans och inte postens: byter listan plats byter ramarna plats", () => {
    const omvand = [KAL[1], KAL[0], KAL[2]];
    render(<OpsCalendar ariaLabel="Kalender" today={IDAG} monthsBack={0} monthsForward={0} entries={POSTER} kalendrar={omvand} kalenderMinne="p:g" lagring={minne({ gruppen: "ram", resor: "ram" })} />);
    expect(yttre("2026-10-12")?.getAttribute("data-dagram")).toBe("1");
    expect(inre("2026-10-12")?.getAttribute("data-dagram-inre")).toBe("4");
  });

  it("⛔ fler än två: bara de två första i listan ritas", () => {
    rita({ gruppen: "ram", resor: "ram", mina: "ram" });
    expect(dag("2026-10-12").querySelectorAll("[data-dagram], [data-dagram-inre]")).toHaveLength(2);
    expect(yttre("2026-10-12")?.getAttribute("data-dagram")).toBe("4");
    expect(inre("2026-10-12")?.getAttribute("data-dagram-inre")).toBe("1");
  });

  it("⛔ EN RAM ÄR EXAKT SOM FÖRUT: samma element, samma klasser, ingen inre", () => {
    rita({ resor: "ram" });
    // 12:e har bara Resor med ram, 13:e likaså.
    for (const d of ["2026-10-12", "2026-10-13"]) {
      expect(inre(d)).toBeNull();
      expect(yttre(d)?.getAttribute("data-dagram")).toBe("1");
      expect((yttre(d)?.className ?? "").split(/\s+/).sort()).toEqual(
        "pointer-events-none absolute -inset-px z-1 rounded-base border-2 sm:inset-0.5 sm:rounded-sm sm:opacity-70 border-identity-1".split(" ").sort(),
      );
    }
  });

  it("en dag där bara en av två kalendrar har ram får en ram, och en dag utan får ingen", () => {
    rita({ resor: "ram", gruppen: "handelser" });
    expect(yttre("2026-10-12")?.getAttribute("data-dagram")).toBe("1");
    expect(inre("2026-10-12")).toBeNull();
    expect(yttre("2026-10-14")).toBeNull();
  });

  it("en dold kalender har ingen ram, så nästa kalender i listan flyttar ut", async () => {
    rita({ gruppen: "ram", resor: "ram" });
    fireEvent.click(screen.getByRole("button", { name: /^Kalendrar: / }));
    const lista = await screen.findByRole("dialog", { name: "Kalendrar" });
    fireEvent.click(within(lista).getByRole("switch", { name: "Styrelsen" }));
    expect(yttre("2026-10-12")?.getAttribute("data-dagram")).toBe("1");
    expect(inre("2026-10-12")).toBeNull();
  });

  it("den valda dagen har ingen ram, som förut", () => {
    rita({ gruppen: "ram", resor: "ram" });
    fireEvent.click(dag("2026-10-12"));
    expect(yttre("2026-10-12")).toBeNull();
    expect(inre("2026-10-12")).toBeNull();
  });

  it("⛔ appens egen ram (dagdekor.ram) vinner och är en, som förut; appens ramar utan ram ritar kalendrarnas", () => {
    rita({ gruppen: "ram", resor: "ram" }, { dagdekor: (/** @type {string} */ d) => (d === "2026-10-12" ? { ram: 3 } : undefined) });
    expect(yttre("2026-10-12")?.getAttribute("data-dagram")).toBe("3");
    expect(inre("2026-10-12")).toBeNull();
    // 13:e har bara Resor: dess ram.
    expect(yttre("2026-10-13")?.getAttribute("data-dagram")).toBe("1");
  });

  it("⛔ en app som själv ger ramar (dagdekor.ramar) får två, och ger den också ram vinner ram", () => {
    rita({}, { dagdekor: (/** @type {string} */ d) => (d === "2026-10-12" ? { ramar: [2, 3] } : d === "2026-10-13" ? { ram: 5, ramar: [2, 3] } : d === "2026-10-14" ? { ramar: [1, 2, 3] } : undefined) });
    expect(yttre("2026-10-12")?.getAttribute("data-dagram")).toBe("2");
    expect(inre("2026-10-12")?.getAttribute("data-dagram-inre")).toBe("3");
    // `ram` är appens äldre, enda ram och går före `ramar`.
    expect(yttre("2026-10-13")?.getAttribute("data-dagram")).toBe("5");
    expect(inre("2026-10-13")).toBeNull();
    // Högst två, också när appen ger fler.
    expect(dag("2026-10-14").querySelectorAll("[data-dagram], [data-dagram-inre]")).toHaveLength(2);
  });

  it("utan något visningsval finns ingen ram alls", () => {
    rita({});
    expect(document.querySelectorAll("[data-dagram], [data-dagram-inre]")).toHaveLength(0);
  });
});

describe("märket Dold: en komponent för snabbtitten och Dagen", () => {
  it("ritar ordet på båda språken, ur språket i providern eller i propen", () => {
    const { rerender } = render(<OpsDoldMarke />);
    expect(screen.getByText("Dold")).toBeTruthy();
    rerender(<OpsSprakProvider sprak="en"><OpsDoldMarke /></OpsSprakProvider>);
    expect(screen.getByText("Hidden")).toBeTruthy();
    rerender(<OpsSprakProvider sprak="en"><OpsDoldMarke sprak="sv" /></OpsSprakProvider>);
    expect(screen.getByText("Dold")).toBeTruthy();
    expect(DOLD_RAD_KLASS).toBe("opacity-50");
  });

  it("⛔ snabbtittens dolda rad bär samma märke och samma blekning, på kalenderns språk", () => {
    vi.useFakeTimers();
    for (const [locale, ord] of /** @type {const} */ ([["sv-SE", "Dold"], ["en-GB", "Hidden"]])) {
      const { unmount } = render(
        <OpsCalendar ariaLabel="Kalender" locale={locale} today={IDAG} monthsBack={0} monthsForward={0} entries={POSTER} kalendrar={KAL} kalenderMinne="p:g" lagring={{ getItem: () => JSON.stringify({ v: 1, syns: { resor: false }, visning: {} }), setItem: () => {} }} />,
      );
      fireEvent.pointerDown(dag("2026-10-12"), { pointerId: 1, clientX: 10, clientY: 10, button: 0 });
      act(() => vi.advanceTimersByTime(LANGTRYCK_MS));
      fireEvent.pointerUp(dag("2026-10-12"), { pointerId: 1 });
      fireEvent.click(dag("2026-10-12"));
      const titt = /** @type {HTMLElement} */ (document.querySelector("[data-snabbtitt]"));
      const dold = /** @type {HTMLElement} */ (titt.querySelector('[data-titt-rad="dold"]'));
      expect(dold.textContent).toContain("Resa");
      expect(dold.querySelector("[data-dold-marke]")?.textContent).toBe(ord);
      expect(dold.className).toContain(DOLD_RAD_KLASS);
      // De synliga raderna har varken märke eller blekning. Golv: de finns.
      const synliga = titt.querySelectorAll('[data-titt-rad="synlig"]');
      expect(synliga.length).toBe(2);
      for (const s of synliga) {
        expect(s.querySelector("[data-dold-marke]")).toBeNull();
        expect(s.className).not.toContain(DOLD_RAD_KLASS);
      }
      unmount();
    }
  });
});

describe("Dagen i appen: syn.dela ger det som är dolt, utan att ändra valen", () => {
  it("delar en dags poster i synliga och dolda ur samma val som kalendern, och rör inget", () => {
    const lag = { getItem: () => JSON.stringify({ v: 1, syns: { resor: false, gruppen: false }, visning: {} }), setItem: vi.fn() };
    /** @type {any} */
    let ut;
    function Dagen() {
      const syn = useKalenderSynlighet({ minne: "p:g", kalendrar: KAL, lagring: lag });
      ut = { syn, ...syn.dela(POSTER.filter((p) => p.date === "2026-10-12")) };
      return null;
    }
    render(<Dagen />);
    expect(ut.dolda.map((/** @type {any} */ p) => p.id)).toEqual(["p1", "p2"]);
    expect(ut.synliga.map((/** @type {any} */ p) => p.id)).toEqual(["p3"]);
    expect(ut.syn.dolda).toEqual(["gruppen", "resor"]);
    // Att fråga ändrar ingenting: inget skrevs, och valen är desamma.
    expect(lag.setItem).not.toHaveBeenCalled();
    expect(ut.syn.synliga).toEqual(["mina"]);
  });
});
