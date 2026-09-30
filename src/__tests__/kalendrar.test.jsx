import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { OpsCalendar, VECKONUMMER_NYCKEL } from "../components/OpsCalendar.jsx";
import {
  KALENDERFALT,
  byggGruppkalender,
  byggKalenderpost,
  byggMinKalender,
  forvaldKalender,
  giltigtDatum,
  idagI,
  kontrolleraTidszon,
  postTillRad,
  validateGruppkalendrar,
  validateMinaKalendrar,
} from "../lib/kalendrar.js";
import { KATEGORIFALT } from "../lib/katalog.js";
import { bandIVecka, datumOmfang, isoVecka, kalenderfonster, perDay, traffar, valjDag, valjIntervall, valjVecka } from "../lib/calendar.js";

/*
 * 0.36.0 (#179 F0 och F1). Datakontraktet för kalendrarna och de delar av månadsvyn som är logik. Regelproven ligger i
 * `rules/__tests__/kalendrar.test.mjs`, och det som bara syns i en riktig webbläsare (höjder, band, piller vid 390 och
 * 1280) mäts i `check-skalyta` avsnitt 30.
 */

const gk = (extra = {}) => ({ id: "styrelse", namn: { sv: "Styrelsen" }, farg: 4, ikon: "kalender", groupId: "cps-ab", ...extra });

describe("gruppens kalendrar: en katalog på typernas motor (F0)", () => {
  it("bygger en kalender utan fas, med forvald och iFlodet som riktiga booleaner", () => {
    const k = byggGruppkalender(gk({ forvald: true }));
    expect(k).toEqual({ id: "styrelse", namn: { sv: "Styrelsen" }, farg: 4, ikon: "kalender", ordning: 0, arkiverad: false, texter: {}, groupId: "cps-ab", forvald: true, iFlodet: false });
    // ⛔ Ingen `fas`-nyckel alls, inte `fas: null`: regelns `hasOnly` tillåter den inte.
    expect("fas" in k).toBe(false);
  });

  it("härleder fälten ur katalogens och lägger till två, så att en ändring i katalogen följer med", () => {
    expect(KALENDERFALT).toEqual([...KATEGORIFALT.filter((f) => f !== "fas"), "forvald", "iFlodet"]);
    // ⛔ Och varje fält bygget skriver finns i listan regeln läser.
    expect(Object.keys(byggGruppkalender(gk())).every((f) => KALENDERFALT.includes(f))).toBe(true);
  });

  it("⛔ kräver groupId, avvisar fas, en sjunde färg, en okänd ikon och en sträng som boolean", () => {
    expect(() => byggGruppkalender({ ...gk(), groupId: undefined })).toThrow(/groupId/);
    expect(() => byggGruppkalender(gk({ fas: "aktiv" }))).toThrow(/fas/);
    expect(() => byggGruppkalender(gk({ farg: 7 }))).toThrow(/farg/);
    expect(() => byggGruppkalender(gk({ ikon: "gitarr" }))).toThrow(/ikon/);
    expect(() => byggGruppkalender(gk({ forvald: "true" }))).toThrow(/forvald/);
  });

  it("⛔ tillåter högst en förvald, aldrig en arkiverad förvald, och bara en grupp per lista", () => {
    expect(() => validateGruppkalendrar([gk({ forvald: true }), gk({ id: "resor", forvald: true })])).toThrow(/2 kalendrar är förvalda/);
    expect(() => validateGruppkalendrar([gk({ forvald: true, arkiverad: true })])).toThrow(/arkiverad/);
    expect(() => validateGruppkalendrar([gk(), gk({ id: "annan", groupId: "miranda-ab" })])).toThrow(/2 grupper/);
    expect(() => validateGruppkalendrar([gk(), gk()])).toThrow(/två gånger/);
  });

  it("härleder den förvalda ur ordningen när ingen valt, och tar den markerade när någon gjort det", () => {
    const lista = validateGruppkalendrar([gk({ id: "b", ordning: 2 }), gk({ id: "a", ordning: 1 }), gk({ id: "c", ordning: 0, arkiverad: true })]);
    expect(forvaldKalender(lista)?.id).toBe("a");
    expect(forvaldKalender(validateGruppkalendrar([gk({ id: "a", ordning: 1 }), gk({ id: "b", ordning: 2, forvald: true })]))?.id).toBe("b");
    expect(forvaldKalender([])).toBeNull();
  });
});

describe("mina kalendrar och deras poster (F0)", () => {
  const min = (extra = {}) => ({ id: "privat", namn: "Privat", farg: 2, ikon: "hjarta", ...extra });

  it("bygger en av mina kalendrar utan grupp och utan texter", () => {
    expect(byggMinKalender(min())).toEqual({ id: "privat", namn: "Privat", farg: 2, ikon: "hjarta", ordning: 0, forvald: false, iFlodet: false, arkiverad: false });
    expect(() => byggMinKalender(min({ groupId: "cps-ab" }))).toThrow(/groupId/);
    expect(() => byggMinKalender(min({ namn: "" }))).toThrow(/namn/);
    expect(() => validateMinaKalendrar([min({ forvald: true }), min({ id: "b", forvald: true })])).toThrow(/förvalda/);
  });

  const post = (extra = {}) => ({ id: "p1", kalenderId: "privat", titel: "Tandläkaren", start: "2026-10-05T09:00", slut: "2026-10-05T10:00", ...extra });

  it("bygger en post med beskrivning och plats som tomma strängar när de saknas (punkt 5)", () => {
    expect(byggKalenderpost(post())).toEqual({ id: "p1", kalenderId: "privat", titel: "Tandläkaren", beskrivning: "", plats: "", start: "2026-10-05T09:00", slut: "2026-10-05T10:00", heldag: false, blockerar: false });
    // Utan slut blir slut samma som start.
    expect(byggKalenderpost(post({ slut: undefined })).slut).toBe("2026-10-05T09:00");
  });

  it("⛔ avvisar slut före start, fel form för heldag, ett datum som inte finns och en arkiverad kalender", () => {
    expect(() => byggKalenderpost(post({ slut: "2026-10-05T08:00" }))).toThrow(/före start/);
    expect(() => byggKalenderpost(post({ heldag: true }))).toThrow(/heldag/);
    expect(() => byggKalenderpost(post({ start: "2026-10-05", slut: "2026-10-05" }))).toThrow(/YYYY-MM-DDTHH:MM/);
    expect(() => byggKalenderpost(post({ heldag: true, start: "2026-02-30", slut: "2026-02-30" }))).toThrow(/finns inte/);
    expect(() => byggKalenderpost(post(), { kalendrar: [{ id: "privat", arkiverad: true }] })).toThrow(/arkiverad/);
    expect(() => byggKalenderpost(post(), { kalendrar: [{ id: "annan" }] })).toThrow(/finns inte bland/);
    expect(() => byggKalenderpost(post({ titel: " " }))).toThrow(/titel/);
    expect(giltigtDatum("2028-02-29")).toBe(true);
    expect(giltigtDatum("2026-02-29")).toBe(false);
  });

  it("gör en post till en rad i kalendern: spann, heldag och kalendern med namn och färg", () => {
    const rad = postTillRad(byggKalenderpost(post({ heldag: true, start: "2026-10-12", slut: "2026-10-14", plats: "Visby" })), [{ id: "privat", namn: "Privat", farg: 2 }]);
    expect(rad).toEqual({ id: "p1", date: "2026-10-12", endDate: "2026-10-14", allDay: true, title: "Tandläkaren", not: "Visby", kalender: { id: "privat", namn: "Privat", farg: 2 } });
    expect(postTillRad(byggKalenderpost(post()), []).not).toBe("09:00-10:00");
  });
});

describe("tidszonen är en inställning, inte en konstant (F0)", () => {
  it("räknar idag i zonen och inte i webbläsarens", () => {
    // 2026-10-05 23:30 UTC är redan den 6:e i Stockholm (sommartid, UTC+2) men fortfarande den 5:e i New York.
    const nu = new Date(Date.UTC(2026, 9, 5, 23, 30));
    expect(idagI("Europe/Stockholm", nu)).toBe("2026-10-06");
    expect(idagI("America/New_York", nu)).toBe("2026-10-05");
  });

  it("⛔ kastar på en zon som inte finns, vid uppstart", () => {
    expect(() => kontrolleraTidszon("Europe/Visby")).toThrow(/finns inte/);
    expect(kontrolleraTidszon("Europe/Stockholm")).toBe("Europe/Stockholm");
    expect(() => render(<OpsCalendar ariaLabel="K" entries={[]} tidszon="Mars/Olympus" />)).toThrow(/finns inte/);
  });
});

describe("månadsvyns logik (F1)", () => {
  it("räknar ISO-veckor över årsskiften", () => {
    expect(isoVecka(2026, 0, 1)).toBe(1);
    expect(isoVecka(2020, 11, 31)).toBe(53);
    expect(isoVecka(2021, 0, 3)).toBe(53);
    expect(isoVecka(2026, 9, 5)).toBe(41);
  });

  it("ger appen samma fönster som vyn ritar: tolv månader bakåt och tolv framåt", () => {
    expect(kalenderfonster("2026-10-05")).toEqual({ fran: "2025-10-01", till: "2027-10-31" });
    expect(kalenderfonster("2026-10-05", 0, 0)).toEqual({ fran: "2026-10-01", till: "2026-10-31" });
  });

  it("lägger en flerdagspost på varje dag den täcker, över ett månadsskifte", () => {
    const byKey = perDay([{ id: "s", date: "2026-10-30", endDate: "2026-11-02", title: "Semester" }]);
    expect([...byKey.keys()]).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(datumOmfang("2026-11-02", "2026-10-30")).toHaveLength(4);
  });

  it("staplar överlappande band i filer och säger var de börjar och slutar", () => {
    const vecka = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"];
    const bitar = bandIVecka(vecka, [
      { id: "a", date: "2026-10-01", endDate: "2026-10-07", title: "A" },
      { id: "b", date: "2026-10-06", endDate: "2026-10-20", title: "B" },
      { id: "c", date: "2026-10-09", allDay: true, title: "C" },
      { id: "d", date: "2026-10-09", title: "Inte ett band" },
    ]);
    expect(bitar.map((b) => [b.entry.id, b.startCol, b.colSpan, b.borjar, b.slutar, b.fil])).toEqual([
      ["a", 0, 3, false, true, 0],
      ["b", 1, 6, true, false, 1],
      ["c", 4, 1, true, true, 0],
    ]);
  });

  it("väljer, veckar och drar som SS", () => {
    expect(valjDag(["2026-10-12"], "2026-10-05")).toEqual(["2026-10-05", "2026-10-12"]);
    expect(valjDag(["2026-10-05", "2026-10-12"], "2026-10-12")).toEqual(["2026-10-05"]);
    const v = ["2026-10-05", "2026-10-06"];
    expect(valjVecka(["2026-10-05"], v)).toEqual(v);
    expect(valjVecka(v, v)).toEqual([]);
    expect(valjIntervall(["2026-10-20"], ["2026-10-05"])).toEqual(["2026-10-20"]);
    expect(valjIntervall(["2026-10-20"], ["2026-10-05", "2026-10-06"])).toEqual(["2026-10-05", "2026-10-06", "2026-10-20"]);
  });

  it("söker i titel, not och kalenderns namn", () => {
    const e = { id: "x", date: "2026-10-05", title: "Styrelsemöte", not: "Visby", kalender: { id: "s", namn: "Styrelsen", farg: /** @type {4} */ (4) } };
    expect(traffar(e, "möte")).toBe(true);
    expect(traffar(e, "VISBY")).toBe(true);
    expect(traffar(e, "styrelsen")).toBe(true);
    expect(traffar(e, "lön")).toBe(false);
  });
});

const IDAG = new Date(2026, 9, 5, 12);
const KALENDRAR = [
  { id: "styrelse", namn: "Styrelsen", farg: /** @type {4} */ (4), grupp: true, forvald: true },
  { id: "resor", namn: "Resor", farg: /** @type {2} */ (2), grupp: true },
  { id: "privat", namn: "Privat", farg: /** @type {5} */ (5) },
];
const POSTER = [
  { id: "mote", date: "2026-10-12", title: "Styrelsemöte", typ: "mote", status: "oppet" },
  { id: "resa", date: "2026-10-12", title: "Tåg till Malmö", kalender: { id: "resor", namn: "Resor", farg: /** @type {2} */ (2) }, typ: "resa", status: "klart" },
  { id: "semester", date: "2026-10-14", endDate: "2026-10-16", allDay: true, title: "Semester", kalender: { id: "privat", namn: "Privat", farg: /** @type {5} */ (5) } },
];

/** @param {Record<string, any>} [extra] */
function kal(extra = {}) {
  return render(
    <OpsCalendar
      ariaLabel="Kalender"
      entries={POSTER}
      today={IDAG}
      monthsBack={0}
      monthsForward={0}
      kalendrar={KALENDRAR}
      typer={[{ id: "mote", namn: "Möte" }, { id: "resa", namn: "Resa" }]}
      statusWords={{ oppet: "Öppet", klart: "Klart" }}
      lagring={{ getItem: () => null, setItem: () => {} }}
      {...extra}
    />,
  );
}

describe("OpsCalendar som SS (F1)", () => {
  it("filtrerar på kalender: en bortvald kalender syns inte, och syns igen när den väljs", async () => {
    kal();
    expect(screen.getByRole("button", { name: "12, 2 poster" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kalendrar: Alla kalendrar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Styrelsen" }));
    // ⛔ En post utan `kalender` hör till den förvalda, alltså syns mötet och inte resan.
    expect(screen.getByRole("button", { name: "12, 1 post" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resor" }));
    expect(screen.getByRole("button", { name: "12, 2 poster" })).toBeInTheDocument();
  });

  it("⛔ ett tomt kalenderurval är Alla, inte Inga", async () => {
    // Bortvald sista kalender hade annars ritat en tom månad som ser ut som att posterna saknas.
    kal();
    fireEvent.click(screen.getByRole("button", { name: "Kalendrar: Alla kalendrar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Styrelsen" }));
    fireEvent.click(screen.getByRole("button", { name: "Styrelsen" }));
    expect(screen.getByRole("button", { name: "Kalendrar: Alla kalendrar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "12, 2 poster" })).toBeInTheDocument();
  });

  it("⛔ ramar in idag i appens tidszon och inte i webbläsarens", () => {
    // 5 oktober 23:30 UTC är den 6:e i Stockholm och den 5:e i New York.
    const nu = new Date(Date.UTC(2026, 9, 5, 23, 30));
    const idagsSiffra = () => [...document.querySelectorAll("[data-dagnummer]")].filter((n) => String(n.className).includes("rounded-full")).map((n) => n.textContent);
    const { unmount } = kal({ today: nu, tidszon: "America/New_York" });
    expect(idagsSiffra()).toEqual(["5"]);
    unmount();
    kal({ today: nu });
    expect(idagsSiffra()).toEqual(["6"]);
  });

  it("säger var Hantera kalendrar hör hemma när appen inte gett en väg dit (punkt 5)", async () => {
    kal();
    fireEvent.click(screen.getByRole("button", { name: "Kalendrar: Alla kalendrar" }));
    expect(await screen.findByText(/Hantera kalendrar kommer i nästa steg/)).toBeInTheDocument();
  });

  it("filtrerar på typ och status i samma meny", async () => {
    kal();
    fireEvent.click(screen.getByRole("button", { name: "Typ och status" }));
    fireEvent.click(await screen.findByRole("button", { name: "Resa" }));
    expect(screen.getByRole("button", { name: "12, 1 post" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Öppet" }));
    expect(screen.getByRole("button", { name: "12" })).toBeInTheDocument();
  });

  it("visar filtrets dolda poster i snabbtitten, märkta Dold", async () => {
    kal();
    fireEvent.click(screen.getByRole("button", { name: "Kalendrar: Alla kalendrar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Styrelsen" }));
    fireEvent.keyDown(document.body, { key: "Escape" });
    fireEvent.contextMenu(screen.getByRole("button", { name: "12, 1 post" }));
    const titt = document.querySelector("[data-snabbtitt]");
    expect(titt).not.toBeNull();
    expect([...titt.querySelectorAll("[data-titt-rad]")].map((r) => r.getAttribute("data-titt-rad"))).toEqual(["synlig", "dold"]);
    expect(within(/** @type {HTMLElement} */ (titt)).getByText("Dold")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.querySelector("[data-snabbtitt]")).toBeNull();
  });

  it("väljer hela veckan på veckonumret, och sparar veckonumren per enhet", () => {
    /** @type {Record<string, string>} */
    const minne = {};
    kal({ lagring: { getItem: (n) => minne[n] ?? null, setItem: (n, v) => void (minne[n] = v) } });
    fireEvent.click(screen.getByRole("button", { name: "Veckonummer" }));
    expect(minne[VECKONUMMER_NYCKEL]).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "Välj vecka 42" }));
    expect(screen.getByRole("region", { name: "Poster för 7 valda dagar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Välj vecka 42" })).toHaveAttribute("aria-pressed", "true");
  });

  /** jsdom saknar `PointerEvent`: ett vanligt `Event` med pekarens fält räcker för fönstrets lyssnare. */
  const pekar = (/** @type {string} */ typ, /** @type {Record<string, number | string>} */ f) => Object.assign(new Event(typ, { bubbles: true }), f);

  it("drar över dagarna och lägger intervallet i urvalet, först efter 12 px", () => {
    kal();
    const fran = screen.getByRole("button", { name: "12, 2 poster" });
    const till = screen.getByRole("button", { name: "13" });
    const org = document.elementFromPoint;
    document.elementFromPoint = () => till;
    try {
      fireEvent(fran, pekar("pointerdown", { pointerId: 1, clientX: 10, clientY: 10, button: 0, pointerType: "mouse" }));
      // Under tröskeln: inget drag.
      act(() => void window.dispatchEvent(pekar("pointermove", { pointerId: 1, clientX: 15, clientY: 12 })));
      act(() => void window.dispatchEvent(pekar("pointermove", { pointerId: 1, clientX: 60, clientY: 10 })));
      act(() => void window.dispatchEvent(pekar("pointerup", { pointerId: 1, clientX: 60, clientY: 10 })));
      fireEvent.click(fran);
    } finally {
      document.elementFromPoint = org;
    }
    expect(screen.getByRole("region", { name: "Poster för 2 valda dagar" })).toBeInTheDocument();
  });

  it("⛔ sväljer inte nästa tryck efter ett drag som slutade på en annan ruta", () => {
    // Mätt i check-skalyta avsnitt 30: ett drag från en ruta till en annan ger inget klick på någon ruta, och flaggan som
    // skulle svälja det stod kvar och åt upp nästa riktiga tryck.
    kal();
    const fran = screen.getByRole("button", { name: "12, 2 poster" });
    const till = screen.getByRole("button", { name: "13" });
    const org = document.elementFromPoint;
    document.elementFromPoint = () => till;
    try {
      fireEvent(fran, pekar("pointerdown", { pointerId: 2, clientX: 10, clientY: 10, button: 0, pointerType: "mouse" }));
      act(() => void window.dispatchEvent(pekar("pointermove", { pointerId: 2, clientX: 60, clientY: 10 })));
      act(() => void window.dispatchEvent(pekar("pointerup", { pointerId: 2, clientX: 60, clientY: 10 })));
    } finally {
      document.elementFromPoint = org;
    }
    const tjugo = screen.getByRole("button", { name: "20" });
    fireEvent(tjugo, pekar("pointerdown", { pointerId: 3, clientX: 5, clientY: 5, button: 0, pointerType: "mouse" }));
    act(() => void window.dispatchEvent(pekar("pointerup", { pointerId: 3, clientX: 5, clientY: 5 })));
    fireEvent.click(tjugo);
    expect(screen.getByRole("region", { name: "Poster för 3 valda dagar" })).toBeInTheDocument();
  });

  it("ritar heldag och flerdag som band, och räknar semestern på varje dag den täcker", () => {
    kal();
    expect(document.querySelectorAll('[data-bandbit="semester"]').length).toBe(1);
    for (const d of ["14", "15", "16"]) expect(screen.getByRole("button", { name: `${d}, 1 post` })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "15, 1 post" }));
    expect(within(screen.getByRole("region", { name: "Poster den 15 oktober" })).getByText(/14 oktober till 16 oktober · Heldag/)).toBeInTheDocument();
  });

  it("tonar ned dagar utan träff när man söker, och säger antalet, också noll", () => {
    kal();
    fireEvent.click(screen.getByRole("button", { name: "Sök i kalendern" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Sök i kalendern" }), { target: { value: "malmö" } });
    expect(screen.getByRole("button", { name: "12, 2 poster" }).querySelector("[data-nedtonad]")).toBeNull();
    expect(screen.getByRole("button", { name: "20" }).querySelector("[data-nedtonad]")?.getAttribute("data-nedtonad")).toBe("sok");
    expect(document.querySelector("[data-sok-antal]")?.textContent).toBe("1 dag");
    fireEvent.change(screen.getByRole("searchbox", { name: "Sök i kalendern" }), { target: { value: "finns inte" } });
    expect(document.querySelector("[data-sok-antal]")?.textContent).toBe("Inga träffar");
  });

  it("ger + de valda dagarna, och idag när ingen är vald", () => {
    /** @type {string[][]} */
    const fatt = [];
    kal({ onSkapa: (/** @type {string[]} */ d) => fatt.push(d) });
    fireEvent.click(screen.getByRole("button", { name: "Skapa" }));
    fireEvent.click(screen.getByRole("button", { name: "12, 2 poster" }));
    fireEvent.click(screen.getByRole("button", { name: "Skapa den 12 oktober" }));
    expect(fatt).toEqual([["2026-10-05"], ["2026-10-12"]]);
  });

  it("utan kalendrar, typer och onSkapa finns inga av de kontrollerna, men veckonummer och sök finns", () => {
    render(<OpsCalendar ariaLabel="K" entries={[]} today={IDAG} monthsBack={0} monthsForward={0} lagring={{ getItem: () => null, setItem: () => {} }} />);
    const rad = /** @type {HTMLElement} */ (document.querySelector("[data-kalender-verktyg]"));
    expect(within(rad).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Veckonummer", "Sök i kalendern"]);
  });
});
