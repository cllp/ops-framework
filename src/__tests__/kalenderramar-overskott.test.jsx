import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { OpsCalendar } from "../components/OpsCalendar.jsx";
import { aterstallHornmarkenVarning } from "../components/OpsCalendarDagruta.jsx";
import { kalenderRamarAlla, ramarEfterText } from "../lib/kalenderramar.js";
import { LANGTRYCK_MS } from "../lib/talk.js";

/**
 * Lagerbrickan visar kalendrarna med ram som inte får plats (0.151.0, CP 2026-10-28): "+1" för tre kalendrar, "+2" för fyra, ingenting för två eller färre.
 *
 * Räknas av ramverket ur samma uppräkning som ramarna (appen skickar inget), och dagen säger det i sitt namn på båda språken. Ett tryck på dagen öppnar dagpanelen eller snabbtitten,
 * som listar kalendrarna med ram. jsdom kör ingen CSS: att brickan inte krockar med siffran, ramarna eller tillgänglighetsbrickan mäts i Chromium (`scripts/kalenderramar-matt.mjs`).
 */

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  aterstallHornmarkenVarning();
});

const IDAG = new Date(2026, 9, 5, 12);
const KAL = [
  { id: "a", namn: "Styrelsen", farg: 4, grupp: true, forvald: true },
  { id: "b", namn: "Resor", farg: 1, grupp: true },
  { id: "c", namn: "Privat", farg: 5 },
  { id: "d", namn: "Familj", farg: 2 },
];
const kal = (/** @type {string} */ id) => {
  const k = /** @type {typeof KAL[number]} */ (KAL.find((x) => x.id === id));
  return { id: k.id, namn: k.namn, farg: k.farg };
};
/** Dag 12: fyra kalendrar, dag 13: tre, dag 14: två, dag 15: en. */
const POSTER = [
  ...["a", "b", "c", "d"].map((k) => ({ id: `${k}12`, title: `P ${k}`, date: "2026-10-12", kalender: kal(k) })),
  ...["a", "b", "c"].map((k) => ({ id: `${k}13`, title: `P ${k}`, date: "2026-10-13", kalender: kal(k) })),
  ...["a", "b"].map((k) => ({ id: `${k}14`, title: `P ${k}`, date: "2026-10-14", kalender: kal(k) })),
  { id: "a15", title: "P a", date: "2026-10-15", kalender: kal("a") },
];
const ALLA_RAM = { a: "ram", b: "bada", c: "ram", d: "ram" };

/** @param {Record<string, any>} [extra] @param {Record<string, string>} [visning] */
function rita(extra = {}, visning = ALLA_RAM) {
  const v = new Map([["ops-kalender-synlighet:p:g", JSON.stringify({ v: 1, syns: {}, visning })]]);
  return render(
    <OpsCalendar ariaLabel="Kalender" today={IDAG} monthsBack={0} monthsForward={0} entries={POSTER} kalendrar={KAL} kalenderMinne="p:g" lagring={{ getItem: (n) => v.get(n) ?? null, setItem: () => {} }} {...extra} />,
  );
}
const dag = (/** @type {string} */ d) => /** @type {HTMLElement} */ (document.querySelector(`[data-cal-day="${d}"]`));
const bricka = (/** @type {string} */ d) => [...dag(d).querySelectorAll('[data-hornmarke="lager"]')].map((b) => b.textContent);
const rad = (/** @type {string} */ d) => [...dag(d).querySelectorAll('[data-indikator="lager"]')].map((b) => b.textContent);

describe("lagerbrickan för ramar som inte får plats", () => {
  it("⛔ tre kalendrar med ram ger +1, fyra ger +2, två eller färre ger ingen bricka", () => {
    rita();
    expect(bricka("2026-10-12")).toEqual(["+2"]);
    expect(bricka("2026-10-13")).toEqual(["+1"]);
    expect(bricka("2026-10-14")).toEqual([]);
    expect(bricka("2026-10-15")).toEqual([]);
    // Samma antal i raden bredvid siffran från 640 px.
    expect(rad("2026-10-12")).toEqual(["+2"]);
    expect(rad("2026-10-13")).toEqual(["+1"]);
    expect(rad("2026-10-14")).toEqual([]);
    // Ramarna är fortfarande högst två.
    expect(dag("2026-10-12").querySelectorAll("[data-dagram], [data-dagram-inre]")).toHaveLength(2);
  });

  it("brickan är Layers-ikonen (lagerbrickans), inte en ny sorts bricka", () => {
    rita();
    const b = /** @type {HTMLElement} */ (dag("2026-10-13").querySelector('[data-hornmarke="lager"]'));
    expect(b.querySelector("svg")).toBeTruthy();
    expect(b.className).toContain("border-ink-muted");
  });

  it("⛔ dagens namn säger det, på båda språken", () => {
    rita();
    expect(dag("2026-10-13").getAttribute("aria-label")).toBe("13, 3 poster, 1 kalender till med ram");
    expect(dag("2026-10-12").getAttribute("aria-label")).toBe("12, 4 poster, 2 kalendrar till med ram");
    expect(dag("2026-10-14").getAttribute("aria-label")).toBe("14, 2 poster");
    document.body.innerHTML = "";
    rita({ locale: "en-GB" });
    expect(dag("2026-10-13").getAttribute("aria-label")).toContain("1 more calendar with a frame");
    expect(dag("2026-10-12").getAttribute("aria-label")).toContain("2 more calendars with a frame");
    expect(ramarEfterText(1, "sv")).toBe("1 kalender till med ram");
    expect(ramarEfterText(3, "en")).toBe("3 more calendars with a frame");
  });

  it("en kalender som slås av har ingen ram och räknas inte: fyra blir tre och +2 blir +1", () => {
    rita();
    fireEvent.click(screen.getByRole("button", { name: /^Kalendrar: / }));
    // Listan öppnas i ett ark: slå av Familj.
    fireEvent.click(screen.getByRole("switch", { name: "Familj" }));
    expect(bricka("2026-10-12")).toEqual(["+1"]);
  });

  it("utan visningsval, eller med Händelser, finns ingen bricka", () => {
    rita({}, {});
    expect(bricka("2026-10-12")).toEqual([]);
    document.body.innerHTML = "";
    rita({}, { a: "handelser", b: "handelser", c: "handelser", d: "ram" });
    expect(bricka("2026-10-12")).toEqual([]);
  });

  it("tillgänglighetsbrickan (borta) ligger kvar, och lagerbrickan kommer efter den", () => {
    rita({ dagdekor: (/** @type {string} */ d) => (d === "2026-10-13" ? { borta: { antal: 2 } } : undefined) });
    const ids = [...dag("2026-10-13").querySelectorAll("[data-hornmarke]")].map((b) => b.getAttribute("data-hornmarke"));
    expect(ids).toEqual(["borta", "lager"]);
    expect(dag("2026-10-13").getAttribute("aria-label")).toBe("13, 3 poster, 2 borta, 1 kalender till med ram");
  });
});

describe("appens egen lager och ram", () => {
  it("⛔ ramverkets räkning gäller på en dag med ramar som inte får plats: appens `lager` ritas inte den dagen, och en varning skrivs en gång", () => {
    const varna = vi.spyOn(console, "warn").mockImplementation(() => {});
    rita({ dagdekor: (/** @type {string} */ d) => (d === "2026-10-13" || d === "2026-10-12" ? { lager: { antal: 5 } } : d === "2026-10-14" ? { lager: { antal: 3 } } : undefined) });
    expect(bricka("2026-10-13")).toEqual(["+1"]);
    expect(dag("2026-10-13").getAttribute("aria-label")).not.toContain("lager");
    // En dag utan ramar som inte får plats: appens lager som förut.
    expect(bricka("2026-10-14")).toEqual(["3"]);
    expect(dag("2026-10-14").getAttribute("aria-label")).toBe("14, 2 poster, 3 lager");
    expect(varna).toHaveBeenCalledTimes(1);
    expect(String(varna.mock.calls[0][0])).toContain("Skicka inte `lager`");
  });

  it("appens egen ram är en och har inget som blir över: ingen bricka", () => {
    rita({ dagdekor: (/** @type {string} */ d) => (d === "2026-10-12" ? { ram: 3 } : undefined) });
    expect(bricka("2026-10-12")).toEqual([]);
    expect(dag("2026-10-12").querySelectorAll("[data-dagram]")).toHaveLength(1);
  });
});

describe("dagpanelen och snabbtitten säger vilka kalendrar som har ram", () => {
  const namn = (/** @type {Element | null} */ el) => [...(el?.querySelectorAll("[data-ramar-prick]") ?? [])].map((p) => p.parentElement?.textContent);

  it("⛔ ett tryck på dagen öppnar dagpanelen som förut, med en rad i listans ordning, bara när något inte får plats", () => {
    rita();
    fireEvent.click(dag("2026-10-13"));
    const panel = /** @type {HTMLElement} */ (document.querySelector("[data-dagpanel]"));
    expect(panel).toBeTruthy();
    expect(namn(panel.querySelector("[data-ramar-rad]"))).toEqual(["Styrelsen", "Resor", "Privat"]);
    expect(panel.querySelector("[data-ramar-rad]")?.textContent).toContain("Kalendrar med ram:");
    fireEvent.click(dag("2026-10-13"));
    fireEvent.click(dag("2026-10-14"));
    expect(document.querySelector("[data-ramar-rad]")).toBeNull();
  });

  it("flera valda dagar: en rad per dag som har ramar som inte får plats, med datum", () => {
    rita();
    fireEvent.click(dag("2026-10-12"));
    fireEvent.click(dag("2026-10-14"));
    fireEvent.click(dag("2026-10-13"));
    const rader = [...document.querySelectorAll("[data-ramar-rad]")];
    expect(rader.map((r) => r.getAttribute("data-ramar-rad")).length).toBe(2);
    expect(rader[0].textContent).toContain("Familj");
    expect(rader[1].textContent).not.toContain("Familj");
  });

  it("snabbtitten har samma rad, på kalenderns språk", () => {
    vi.useFakeTimers();
    rita({ locale: "en-GB" });
    fireEvent.pointerDown(dag("2026-10-12"), { pointerId: 1, clientX: 10, clientY: 10, button: 0 });
    act(() => vi.advanceTimersByTime(LANGTRYCK_MS));
    fireEvent.pointerUp(dag("2026-10-12"), { pointerId: 1 });
    fireEvent.click(dag("2026-10-12"));
    const titt = /** @type {HTMLElement} */ (document.querySelector("[data-snabbtitt]"));
    expect(namn(titt.querySelector("[data-ramar-rad]"))).toEqual(["Styrelsen", "Resor", "Privat", "Familj"]);
    expect(titt.querySelector("[data-ramar-rad]")?.textContent).toContain("Calendars with a frame:");
  });
});

describe("kalenderRamarAlla", () => {
  it("ger alla kalendrar med ram i listans ordning, med namn, och kalenderRamar tar de två första ur samma", () => {
    const alla = kalenderRamarAlla(POSTER, { kalendrar: KAL, forvaldId: "", visningAv: () => "ram" });
    expect(alla.get("2026-10-12")?.map((k) => k.namn)).toEqual(["Styrelsen", "Resor", "Privat", "Familj"]);
    expect(alla.get("2026-10-15")?.map((k) => k.id)).toEqual(["a"]);
  });
});
