import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsGastGrupp } from "../components/OpsGastGrupp.jsx";
import { GastsidaInfo } from "../components/gastsidaInfo.js";
import { GASTGRUPPATGARDER } from "../lib/gast.js";
import { gastBesokNyckel, lasGastBesok, minne } from "../lib/gastminne.js";

/**
 * Gästens översikt, förslag B (0.198.0, cllp/ops-framework#536): en ruta per område med det som hänt sedan gästens senaste besök, samma siffror i bottenraden,
 * och det som sällan behövs i tre stängda rader. jsdom mäter vad som står och vad som anropas; hur det ser ut mäts i check-skalyta (scenen gastgrupp-sida).
 */

const ID = "b".repeat(64);
const IDAG = new Date(2026, 10, 7, 12, 0);
const IGAR = new Date(2026, 10, 6, 9, 30).getTime();
const GRUPP = { namn: "Skarv", beskrivning: "Låtarna och repen inför skivan.", funktioner: ["chatt", "kalender", "bibliotek", "arenden"], nedladdning: true, kommentera: false };

const OVERSIKT = {
  ok: true,
  chatt: { nya: 3, fler: false, senaste: [{ id: "m3", namn: "Maja", text: "Bra tänkt.", tid: IGAR + 3000, egen: false }] },
  kalender: { nasta: { id: "h1", titel: "Repetition", plats: "Studion", datum: "2026-11-10", slutDatum: null, tid: "19:00", slutTid: null, heldag: false, kravSvar: true, mitt: null } },
  bibliotek: { nya: 2, senaste: [{ id: "p2", rubrik: "Hamnen, mix 3", typ: "fil", tid: IGAR + 2000 }, { id: "p1", rubrik: "Oklart.Edit1", typ: "fil", tid: IGAR + 1000 }], antal: 24, filer: 24, fler: false },
};

function lagringMed(start = {}) {
  /** @type {Record<string, string>} */
  const d = { ...start };
  return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = String(v); }, removeItem: (k) => { delete d[k]; }, d };
}

function apiMed(oversikt = OVERSIKT) {
  return Object.fromEntries(
    GASTGRUPPATGARDER.map((a) => [
      a,
      vi.fn(async () => {
        if (a === "oversikt") return oversikt;
        if (a === "chatt") return { ok: true, meddelanden: [], fler: false };
        if (a === "handelse") return { ok: true, handelse: { id: "h1", titel: "Repetition", datum: "2026-11-10", tid: "19:00", kravSvar: true }, svar: { kommer: 0, kanske: 0, kommerInte: 0, ejSvarat: 1, text: "1 har inte svarat", mitt: null } };
        if (a === "arenden") return { ok: true, poster: [], avkortad: false };
        return { ok: true, poster: [], handelser: [], kalendrar: [], avkortad: false, ejVisade: 0 };
      }),
    ]),
  );
}

/** @param {{ lagring?: ReturnType<typeof lagringMed>, api?: any, grupp?: any }} [v] */
function rita({ lagring = lagringMed(), api = apiMed(), grupp = GRUPP } = {}) {
  const mem = minne(lagring);
  const { unmount } = render(
    <GastsidaInfo.Provider value={{ integritet: <section data-gast-integritet=""><details><summary>Integritet och dina uppgifter</summary></details></section>, namn: <p data-gast-namn-visas="">Du syns som Collan</p>, minne: mem, inbjudan: ID }}>
      <OpsGastGrupp grupp={grupp} api={api} intervallMs={0} idag={IDAG} />
    </GastsidaInfo.Provider>,
  );
  return { lagring, api, mem, unmount };
}

/** Telefonen: bottenraden ritas när `matchMedia` svarar ja på den smala frågan. */
function telefon() {
  vi.spyOn(window, "matchMedia").mockImplementation((q) => /** @type {any} */ ({ matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
}

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window.navigator, "language", "get").mockReturnValue("sv-SE");
  if (typeof window.matchMedia !== "function") window.matchMedia = /** @type {any} */ (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => vi.restoreAllMocks());

const ruta = (/** @type {string} */ f) => /** @type {HTMLElement} */ (document.querySelector(`[data-gast-ruta="${f}"]`));

describe("rutorna: en per område, med det som hänt sedan senaste besöket", () => {
  it("⛔ chatten och biblioteket räknas från besöket i går, kalendern ber om svar, och ärenden utan något till gästen säger det och är ingen knapp", async () => {
    const lagring = lagringMed({ [gastBesokNyckel(ID, "chatt")]: String(IGAR), [gastBesokNyckel(ID, "bibliotek")]: String(IGAR), [gastBesokNyckel(ID, "kalender")]: String(IGAR) });
    const { api } = rita({ lagring });
    await waitFor(() => expect(ruta("chatt").textContent).toContain("3 nya sedan i går"));
    // Tiderna för besöken skickas, och servern räknar.
    expect(api.oversikt).toHaveBeenCalledWith({ sedan: { chatt: IGAR, bibliotek: IGAR }, idag: "2026-11-07" });
    expect(ruta("chatt").getAttribute("data-antal")).toBe("3");
    expect(ruta("bibliotek").textContent).toContain("2 nya filer");
    // (Nästa version) Det nya ovanför, och hur mycket som finns under.
    expect([...ruta("bibliotek").querySelectorAll("[data-gast-ruta-rad]")].map((e) => e.textContent)).toEqual(["2 nya filer", "24 filer"]);
    expect(ruta("kalender").textContent).toContain("Repetition, tis 19:00");
    expect(within(ruta("kalender")).getByText("Svara").getAttribute("data-gast-ruta-rad")).toBe("accent");
    expect(ruta("arenden").textContent).toContain("Inget till dig");
    expect(ruta("arenden").tagName).toBe("DIV");
    expect(ruta("chatt").tagName).toBe("BUTTON");
    // Ordningen är områdenas, och bara de gruppen har.
    expect([...document.querySelectorAll("[data-gast-ruta]")].map((e) => e.getAttribute("data-gast-ruta"))).toEqual(["chatt", "kalender", "bibliotek", "arenden"]);
  });

  it("⛔ första besöket räknar inget som nytt: inga tider skickas, och enheten minns tiden nu till nästa gång", async () => {
    const { api, lagring, mem } = rita({ api: apiMed({ ...OVERSIKT, chatt: { ...OVERSIKT.chatt, nya: 0 }, bibliotek: { ...OVERSIKT.bibliotek, nya: 0 } }) });
    // ⛔ (Nästa version, CP 2026-11-07) Första besöket säger vad som finns, inte "Inget nytt": när det senast skrevs, och hur mycket biblioteket har.
    await waitFor(() => expect(ruta("chatt").textContent).toContain("Senast i går 09:30"));
    expect(api.oversikt).toHaveBeenCalledWith({ sedan: {}, idag: "2026-11-07" });
    expect(ruta("chatt").textContent).not.toContain("Inget nytt");
    expect(ruta("bibliotek").textContent).toContain("24 filer");
    expect(ruta("bibliotek").textContent).not.toContain("Inget nytt");
    const sparat = lasGastBesok(mem, ID);
    expect(Object.keys(sparat).sort()).toEqual(["bibliotek", "chatt", "kalender"]);
    expect(Object.keys(lagring.d).filter((k) => k.startsWith("ops-gast:besok:")).length).toBe(3);
  });

  it("ett område utan något nytt står kvar med en lugn rad, aldrig tom", async () => {
    const lagring = lagringMed({ [gastBesokNyckel(ID, "chatt")]: String(IGAR), [gastBesokNyckel(ID, "bibliotek")]: String(IGAR) });
    rita({ lagring, api: apiMed({ ok: true, chatt: { nya: 0, fler: false, senaste: [{ id: "m1", namn: "Bo", text: "x", tid: IGAR, egen: false }] }, kalender: { nasta: null }, bibliotek: { nya: 0, senaste: [], antal: 0, filer: 0, fler: false } }) });
    await waitFor(() => expect(ruta("chatt").textContent).toContain("Senast i går 09:30"));
    expect(ruta("kalender").textContent).toContain("Inget på gång");
    expect(ruta("bibliotek").textContent).toContain("Inget här än");
  });

  it("⛔ biblioteket säger hur mycket som finns: poster när inte allt är filer, och + när servern inte läst allt", async () => {
    const lagring = lagringMed({ [gastBesokNyckel(ID, "chatt")]: String(IGAR), [gastBesokNyckel(ID, "bibliotek")]: String(IGAR + 5000) });
    rita({ lagring, api: apiMed({ ...OVERSIKT, bibliotek: { ...OVERSIKT.bibliotek, nya: 0, antal: 200, filer: 150, fler: true } }) });
    await waitFor(() => expect(ruta("bibliotek").textContent).toContain("200+ poster"));
    expect(ruta("bibliotek").textContent).not.toContain("nya");
    expect(ruta("bibliotek").textContent).not.toContain("Inget nytt");
  });

  it("⛔ rutan för kalendern öppnar nästa händelse, där svaret ges; ett svar som redan finns visas i stället för Svara", async () => {
    const { api } = rita();
    await waitFor(() => expect(ruta("kalender").textContent).toContain("Svara"));
    await act(async () => { fireEvent.click(ruta("kalender")); });
    await waitFor(() => expect(api.handelse).toHaveBeenCalledWith({ handelseId: "h1" }));
    expect(screen.getByRole("tab", { name: "Kalender" })).toHaveAttribute("aria-selected", "true");
  });

  it("med gästens svar står svaret i rutan och inte Svara", async () => {
    rita({ api: apiMed({ ...OVERSIKT, kalender: { nasta: { ...OVERSIKT.kalender.nasta, mitt: "kommer" } } }) });
    await waitFor(() => expect(ruta("kalender").textContent).toContain("Du kommer"));
    expect(ruta("kalender").textContent).not.toContain("Svara");
  });
});

describe("raden under namnet, Du och de tre raderna", () => {
  it("⛔ gruppens egen beskrivning och Du är gäst. på samma rad, och utan beskrivning bara Du är gäst.", async () => {
    const { unmount } = rita();
    const rad = /** @type {HTMLElement} */ (document.querySelector("[data-gast-roll-rad]"));
    expect(rad.textContent).toBe("Låtarna och repen inför skivan. Du är gäst.");
    unmount();
    rita({ grupp: { ...GRUPP, beskrivning: "" } });
    expect(document.querySelector("[data-gast-roll-rad]")?.textContent).toBe("Du är gäst.");
  });

  it("⛔ rubriken Du bär namnet, och Vad kan jag göra här?, hemskärmen och integriteten är rader i en grupp, stängda från början", async () => {
    rita();
    const du = /** @type {HTMLElement} */ (document.querySelector("[data-gast-du]"));
    expect(within(du).getByRole("heading", { level: 2 }).textContent).toBe("Du");
    expect(du.textContent).toContain("Du syns som Collan");
    const hjalp = /** @type {HTMLElement} */ (document.querySelector("[data-gast-hjalp]"));
    expect(hjalp.textContent).toContain("Vad kan jag göra här?");
    expect(hjalp.textContent).toContain("Integritet och dina uppgifter");
    const detaljer = [...hjalp.querySelectorAll("details")];
    expect(detaljer.length).toBeGreaterThanOrEqual(2);
    for (const d of detaljer) expect(d.open).toBe(false);
    // Rättigheterna står inne i raden, inte överst på översikten.
    expect(hjalp.querySelector("[data-gast-behorighet]")?.textContent).toMatch(/chatten/);
    expect(document.querySelector("[data-gast-oversikt] > [data-gast-behorighet]")).toBeNull();
  });
});

describe("bottenraden: samma siffror, och de försvinner när området öppnas", () => {
  it("⛔ Chatt 3, Kalender 1 (inte svarat) och Bibliotek 2; i chatten försvinner siffran och besöket sparas", async () => {
    telefon();
    const lagring = lagringMed({ [gastBesokNyckel(ID, "chatt")]: String(IGAR), [gastBesokNyckel(ID, "bibliotek")]: String(IGAR), [gastBesokNyckel(ID, "kalender")]: String(IGAR) });
    rita({ lagring });
    const nav = await screen.findByRole("navigation", { name: "Gruppens delar" });
    const siffra = (/** @type {string} */ namn) => within(nav).getByRole("link", { name: new RegExp(`${namn}$`) }).querySelector("[data-ops-count-badge]")?.textContent?.trim() ?? null;
    await waitFor(() => expect(siffra("Chatt")).toMatch(/^3/));
    expect(siffra("Kalender")).toMatch(/^1/);
    expect(siffra("Bibliotek")).toMatch(/^2/);
    expect(siffra("Översikt")).toBeNull();
    const fore = Date.now();
    await act(async () => { fireEvent.click(within(nav).getByRole("link", { name: /Chatt$/ })); });
    await waitFor(() => expect(siffra("Chatt")).toBeNull());
    expect(Number(lagring.d[gastBesokNyckel(ID, "chatt")])).toBeGreaterThanOrEqual(fore);
    // De andra står kvar tills de öppnas.
    expect(siffra("Bibliotek")).toMatch(/^2/);
  });
});
