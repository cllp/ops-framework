import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsEventList } from "../components/OpsEventList.jsx";
import { OpsHandelsePanel } from "../components/OpsHandelsePanel.jsx";
import { createMemorySource } from "../data/adapters.js";
import { collectEvents, splitTodayUpcoming } from "../lib/events.js";
import { DATUM_EJ_SATT, HANDELSEKONTRAKT, handelsefel, handelsensDagar, harPasserat, svarsrader } from "../lib/handelsemodell.js";
import { handelsetid } from "../lib/handelsepanel.js";
import { medlemskapsId } from "../lib/grupp.js";
import { createDelningService } from "../node/delning.js";

/**
 * "Datum ej satt" (0.127.0, cllp/lifehub.app#383): `datum` valfritt i HANDELSEKONTRAKT.
 *
 * ⛔ CP 2026-10-19: "Ingen falsk dag." Läget är att `datum` SAKNAS. Varje rad nedan gäller en läsare av `datum` som skulle kasta eller ljuga om det saknades.
 * Det som redan tålde ett saknat datum (Idag, Kommande, den publika sidan) är en spärr och ingen rättelse: de är gröna både före och efter, och PR-texten säger
 * det, med en mutation per spärr som visar att provet blir rött när beteendet ändras (punkt 4).
 */

describe("handelsefel: Datum ej satt är ett val, inte ett nytt standardläge", () => {
  const bas = { groupId: "g" };

  it("⛔ utan valet är en händelse utan datum fortfarande ett fel, med valet är den inte det", () => {
    expect(handelsefel(bas)).toEqual(["Välj ett datum"]);
    expect(handelsefel(bas, { datumEjSatt: false })).toEqual(["Välj ett datum"]);
    expect(handelsefel(bas, { datumEjSatt: true })).toEqual([]);
  });

  it("⛔ med valet saknas allt som hänger på dagen: tid, sluttid, slutdatum och heldag nekas, med skälet", () => {
    for (const falt of [{ tid: "18:00" }, { slutTid: "20:00" }, { slutDatum: "2026-10-20" }, { heldag: true }, { heldag: false }]) {
      const fel = handelsefel({ ...bas, ...falt }, { datumEjSatt: true });
      expect(fel.length, JSON.stringify(falt)).toBeGreaterThan(0);
      expect(fel[0]).toMatch(/utan datum har varken/);
      expect(fel[0]).toContain(Object.keys(falt)[0]);
    }
    // Och tid med datum är oförändrat.
    expect(handelsefel({ ...bas, datum: "2026-10-20", tid: "18:00" }, { datumEjSatt: true })).toEqual([]);
  });

  it("⛔ läget är att nyckeln saknas: ett tomt eller null-datum är inget Datum ej satt", () => {
    expect(handelsefel({ ...bas, datum: "" }, { datumEjSatt: true })).toEqual(["Välj ett datum"]);
    expect(handelsefel({ ...bas, datum: null }, { datumEjSatt: true })).toEqual(["Välj ett datum"]);
    // Ett datum som finns prövas som förut, med eller utan valet.
    expect(handelsefel({ ...bas, datum: "2026-02-30" }, { datumEjSatt: true })).toEqual(["Datumet finns inte"]);
  });

  it("kontraktets lista är oförändrad: datum står kvar i den, tolkningen är det som ändrats", () => {
    expect(HANDELSEKONTRAKT).toEqual(["groupId", "kalenderId", "datum", "slutDatum", "tid", "slutTid", "heldag", "kravSvar"]);
  });
});

describe("läsarna av datum tål att det saknas", () => {
  const utanDatum = { id: "h1", kravSvar: true };
  const medDatum = { id: "h2", datum: "2026-10-20", tid: "18:00", kravSvar: true };

  it("⛔ handelsensDagar ger null, inte ett objekt med date: undefined, och en spridning av det är tillåten", () => {
    expect(handelsensDagar(utanDatum)).toBeNull();
    expect({ id: "x", ...handelsensDagar(utanDatum) }).toEqual({ id: "x" });
    expect(handelsensDagar({ datum: "" })).toBeNull();
    expect(handelsensDagar(medDatum)).toEqual({ date: "2026-10-20" });
    expect(handelsensDagar({ datum: "2026-10-20", slutDatum: "2026-10-22", heldag: true })).toEqual({ date: "2026-10-20", endDate: "2026-10-22", allDay: true });
  });

  it("⛔ harPasserat svarar falskt utan datum, och räknar som förut med ett", () => {
    expect(harPasserat(utanDatum, "2030-01-01")).toBe(false);
    expect(harPasserat(medDatum, "2026-10-21")).toBe(true);
    expect(harPasserat(medDatum, "2026-10-20")).toBe(false);
  });

  it("⛔ svarsrader kastar inte på en datumlös händelse och ger ingen rad för den", () => {
    const rader = svarsrader({ handelser: [utanDatum, medDatum, { id: "h3", datum: "2026-10-19", kravSvar: true }], mina: new Map(), idag: "2026-10-18" });
    expect(rader.map((h) => h.id)).toEqual(["h3", "h2"]);
    // Golv: bara datumlösa är ett svar, inte ett fel.
    expect(svarsrader({ handelser: [utanDatum], mina: {}, idag: "2026-10-18" })).toEqual([]);
  });

  it("handelsetid ger tomma delar utan datum, också när en tid ändå skulle finnas", () => {
    expect(handelsetid({ tid: "18:00" }, "sv")).toEqual({ start: "", slut: "", tid: "" });
    expect(handelsetid({ datum: "2026-10-20", tid: "18:00" }, "sv").tid).toBe("18:00");
  });

  it("orden bor på ett ställe, på båda språken", () => {
    expect(DATUM_EJ_SATT).toEqual({ sv: "Datum ej satt", en: "Date not set" });
    expect(Object.isFrozen(DATUM_EJ_SATT)).toBe(true);
  });
});

describe("OpsHandelsePanel: informationsrutan säger Datum ej satt", () => {
  const handelse = { id: "h1", titel: "Rösta för rep", typ: { namn: "Möte" } };

  it("⛔ ordet står i stället för datumet, ingen tid ritas, och inget 'undefined' hamnar på sidan", () => {
    const { container } = render(<OpsHandelsePanel handelse={handelse} onTillbaka={() => {}} />);
    const rad = /** @type {HTMLElement} */ (container.querySelector("[data-handelsedatum]"));
    expect(rad.getAttribute("data-handelsedatum")).toBe("ej-satt");
    expect(rad.textContent).toBe("Datum ej satt");
    expect(container.querySelector("[data-handelsetid]")).toBeNull();
    expect(container.textContent).not.toMatch(/undefined|Invalid/);
  });

  it("på engelska säger den Date not set, och appen kan byta ordet", () => {
    const { container, unmount } = render(<OpsHandelsePanel handelse={handelse} onTillbaka={() => {}} sprak="en" />);
    expect(container.querySelector("[data-handelsedatum]")?.textContent).toBe("Date not set");
    unmount();
    const eget = render(<OpsHandelsePanel handelse={handelse} onTillbaka={() => {}} datumEjSattEtikett="Väntar på dag" />);
    expect(eget.container.querySelector("[data-handelsedatum]")?.textContent).toBe("Väntar på dag");
  });

  it("en händelse med datum är oförändrad: datumet, inget ord", () => {
    const { container } = render(<OpsHandelsePanel handelse={{ ...handelse, datum: "2026-10-20", tid: "18:00" }} onTillbaka={() => {}} />);
    const rad = /** @type {HTMLElement} */ (container.querySelector("[data-handelsedatum]"));
    expect(rad.getAttribute("data-handelsedatum")).toBe("");
    expect(rad.textContent).toMatch(/20 oktober 2026/);
    expect(container.textContent).not.toContain("Datum ej satt");
    expect(container.querySelector("[data-handelsetid]")?.textContent).toBe("18:00");
  });
});

describe("Idag och Kommande: en rad utan dag ligger i Kommande och kastar inte", () => {
  const utan = { id: "u", title: "Rösta för rep", daysLeft: null, when: "Datum ej satt" };
  const idag = { id: "i", title: "Styrelsemöte", daysLeft: 0 };
  const sen = { id: "s", title: "Årsmöte", daysLeft: 12 };

  it("collectEvents lägger den sist, och splitTodayUpcoming i Kommande, aldrig i Idag", () => {
    const samlad = collectEvents({ sources: [[utan], [sen, idag]] });
    expect(samlad.map((e) => e.id)).toEqual(["i", "s", "u"]);
    const { today, upcoming } = splitTodayUpcoming(samlad);
    expect(today.map((e) => e.id)).toEqual(["i"]);
    expect(upcoming.map((e) => e.id)).toEqual(["s", "u"]);
  });

  it("OpsEventList ritar raden med appens ord, utan att kasta", () => {
    render(<OpsEventList events={[utan, idag]} />);
    expect(screen.getByText("Rösta för rep")).toBeInTheDocument();
    expect(screen.getByText("Datum ej satt")).toBeInTheDocument();
  });
});

describe("den publika sidan: en händelse utan datum öppnar ingen länk", () => {
  it("⛔ hamta svarar handelse-saknas och kastar inte, och en händelse med datum öppnas som förut", async () => {
    const GRUPP = "kallan";
    const MEDLEM = "uid-medlem";
    const handelse = (/** @type {string} */ id, /** @type {Record<string, unknown>} */ extra) => ({
      id,
      groupId: GRUPP,
      rubrik: `Händelse ${id}`,
      kravSvar: false,
      skapadAv: { uid: MEDLEM, namn: "Skaparen" },
      ...extra,
    });
    const kalla = createMemorySource({
      memberships: [{ id: medlemskapsId(MEDLEM, GRUPP), userId: MEDLEM, groupId: GRUPP, roll: "medlem", typ: "person", status: "aktiv", namn: "Medlem" }],
      bibliotek: [],
      handelser: [handelse("utan", {}), handelse("med", { datum: "2026-12-26" })],
      delningar: [],
    });
    const tjanst = createDelningService({
      kalla,
      lagring: { signeradAdress: vi.fn(async () => "https://lagring.test/x") },
      samlingar: { delningar: "delningar", bibliotek: "bibliotek", handelser: "handelser" },
      handelseSida: (/** @type {any} */ h) => ({ titel: h.rubrik }),
      klocka: () => 1_800_000_000_000,
    });
    const utan = await tjanst.skapa({ uid: MEDLEM, handelseId: "utan", gruppdel: "travel", handelsedel: "utan-dag" });
    expect(await tjanst.hamta(utan.adress)).toEqual({ ok: false, orsak: "handelse-saknas" });
    const med = await tjanst.skapa({ uid: MEDLEM, handelseId: "med", gruppdel: "travel", handelsedel: "med-dag" });
    const svar = /** @type {any} */ (await tjanst.hamta(med.adress));
    expect(svar.ok).toBe(true);
    expect(svar.delning.datum).toBe("2026-12-26");
  });
});
