import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { OpsCalendar } from "../components/OpsCalendar.jsx";
import { iKlockordning, klockslag, perDay } from "../lib/calendar.js";
import { postTillRad } from "../lib/kalendrar.js";
import { LANGTRYCK_MS } from "../lib/talk.js";

/**
 * Dagen står i klockans ordning (0.255.0, cllp/lifehub.app#944).
 *
 * ⛔ CP 2026-11-22, Kalendern i gruppen TAM, den 23 november: "Roller och behörigheter 13:30-14:30 först, sedan en heldagsuppgift,
 * sedan Adhoc projektmöte 13:00-13:30 och sist Statusmöte AOP Advania PoC 10:30-11:30." Förväntat: heldag först, sedan 10:30, 13:00,
 * 13:30, dolda sist, och samma ordning i rutan (snabbtitten) och i kortet (dagpanelen). Händelserna var skapade genom API:et samma kväll,
 * alltså i den ordning som syntes. Ramverket la posterna per dag i den ordning appen skickade dem och sorterade aldrig.
 */

afterEach(() => vi.useRealTimers());

const DAG = "2026-11-23";
/** CP:s dag, i den ordning den kom in. */
const CP_DAG = [
  { id: "roller", title: "Roller och behörigheter", date: DAG, tid: "13:30", not: "13:30-14:30" },
  { id: "uppgift", title: "Heldagsuppgift", date: DAG, allDay: true },
  { id: "adhoc", title: "Adhoc projektmöte", date: DAG, tid: "13:00", not: "13:00-13:30" },
  { id: "status", title: "Statusmöte AOP Advania PoC", date: DAG, tid: "10:30", not: "10:30-11:30" },
];
const idn = (/** @type {ReadonlyArray<{ id: string }>} */ l) => l.map((p) => p.id);

describe("perDay: klockans ordning", () => {
  it("⛔ CP:s dag: heldag först, sedan 10:30, 13:00, 13:30", () => {
    expect(idn(/** @type {any} */ (perDay(CP_DAG).get(DAG)))).toEqual(["uppgift", "status", "adhoc", "roller"]);
  });

  it("poster utan klockslag behåller appens ordning, och lika tider också", () => {
    const ut = perDay([
      { id: "t2", title: "B", date: DAG, tid: "09:00" },
      { id: "u1", title: "Faktura", date: DAG },
      { id: "t1", title: "A", date: DAG, tid: "09:00" },
      { id: "u2", title: "Uppgift", date: DAG },
    ]).get(DAG);
    expect(idn(/** @type {any} */ (ut))).toEqual(["u1", "u2", "t2", "t1"]);
  });

  it("⛔ en flerdagspost har sitt klockslag bara den dag den börjar", () => {
    const ut = perDay([
      { id: "kvall", title: "Resa", date: "2026-11-22", endDate: DAG, tid: "22:00" },
      { id: "morgon", title: "Frukost", date: DAG, tid: "08:00" },
    ]);
    // Den 23:e täcker resan hela dagen och står bland det utan klockslag, före 08:00.
    expect(idn(/** @type {any} */ (ut.get(DAG)))).toEqual(["kvall", "morgon"]);
  });

  it("läser `extern.tid` när `tid` saknas, och ett felskrivet klockslag räknas som inget", () => {
    const extern = /** @type {any} */ ({ id: "e", title: "Från Apple", date: DAG, extern: { kalla: "Apple", tid: "07:15" } });
    expect(klockslag(extern, DAG)).toBe("07:15");
    expect(klockslag(/** @type {any} */ ({ id: "x", title: "X", date: DAG, tid: "7.15" }), DAG)).toBe("");
    expect(klockslag(/** @type {any} */ ({ id: "h", title: "H", date: DAG, allDay: true, tid: "09:00" }), DAG)).toBe("");
    expect(idn(iKlockordning([{ id: "t", title: "T", date: DAG, tid: "09:00" }, extern], DAG))).toEqual(["e", "t"]);
  });

  it("en egen kalenders post bär sin starttid (`postTillRad`), en heldag ingen", () => {
    const k = [{ id: "k", namn: "Privat", farg: 1 }];
    expect(postTillRad({ id: "p", kalenderId: "k", titel: "Tandläkare", start: `${DAG}T14:00`, slut: `${DAG}T15:00` }, k).tid).toBe("14:00");
    expect(postTillRad({ id: "q", kalenderId: "k", titel: "Ledig", start: DAG, slut: DAG, heldag: true }, k).tid).toBeUndefined();
  });
});

const IDAG = new Date(2026, 10, 22, 20);
const KAL = [
  { id: "gruppen", namn: "TAM", farg: 4, grupp: true, forvald: true },
  { id: "arenden", namn: "Ärenden", farg: 2, grupp: true },
];
const POSTER = [
  { ...CP_DAG[0], kalender: { id: "gruppen", namn: "TAM", farg: 4 } },
  { id: "arende", title: "Dolt ärende", date: DAG, kalender: { id: "arenden", namn: "Ärenden", farg: 2 } },
  { ...CP_DAG[1], kalender: { id: "gruppen", namn: "TAM", farg: 4 } },
  { ...CP_DAG[2], kalender: { id: "gruppen", namn: "TAM", farg: 4 } },
  { ...CP_DAG[3], kalender: { id: "gruppen", namn: "TAM", farg: 4 } },
];
const lagring = { getItem: () => JSON.stringify({ v: 1, syns: { arenden: false }, visning: {} }), setItem: () => {} };
const rita = () => render(<OpsCalendar ariaLabel="Kalender" today={IDAG} monthsBack={0} monthsForward={1} entries={POSTER} kalendrar={KAL} kalenderMinne="p:g" lagring={lagring} />);
const ruta = () => /** @type {HTMLElement} */ (document.querySelector(`[data-cal-day="${DAG}"]`));
const VANTAT = ["Heldagsuppgift", "Statusmöte AOP Advania PoC", "Adhoc projektmöte", "Roller och behörigheter"];
/** Titlarna i elementets ordning, bland de givna. @param {Element} el */
const ordning = (el) => {
  const text = el.textContent || "";
  return [...VANTAT, "Dolt ärende"].filter((t) => text.includes(t)).sort((a, b) => text.indexOf(a) - text.indexOf(b));
};

describe("samma ordning i rutan och i kortet", () => {
  it("⛔ dagpanelen (kortet) står i klockordning", () => {
    rita();
    fireEvent.click(ruta());
    const panel = /** @type {HTMLElement} */ (document.querySelector("[data-dagpanel]"));
    expect(panel).not.toBeNull();
    expect(ordning(panel)).toEqual(VANTAT);
  });

  it("⛔ snabbtitten (rutan) står i klockordning med dolda sist", () => {
    vi.useFakeTimers();
    rita();
    fireEvent.pointerDown(ruta(), { pointerId: 1, clientX: 10, clientY: 10, button: 0 });
    act(() => vi.advanceTimersByTime(LANGTRYCK_MS));
    fireEvent.pointerUp(ruta(), { pointerId: 1 });
    fireEvent.click(ruta());
    const titt = /** @type {HTMLElement} */ (document.querySelector("[data-snabbtitt]"));
    const rader = [...titt.querySelectorAll("[data-titt-rad]")];
    // Golv: alla fem raderna lästes.
    expect(rader).toHaveLength(5);
    expect(rader.map((r) => r.getAttribute("data-titt-rad"))).toEqual(["synlig", "synlig", "synlig", "synlig", "dold"]);
    expect(ordning(titt)).toEqual([...VANTAT, "Dolt ärende"]);
  });
});
