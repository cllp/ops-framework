import { describe, it, expect } from "vitest";
import { daysBetween, daysUntil, collectEvents, splitTodayUpcoming } from "../lib/events.js";

/**
 * ⛔ PROVEN ANVÄNDER PÅHITTADE ORD ("leverans", "besiktning") MED FLIT.
 * Ramverket får inte kunna bero på bolag-ops vokabulär, och ett prov som säger
 * "kundfaktura" hade gjort det svårt att se när det börjar göra det.
 */

/** @param {object} h */
const handelse = (h) => ({ id: String(h.id), title: String(h.title || h.id), daysLeft: null, ...h });

describe("dagarMellan", () => {
  it("räknar kalenderdagar, inte dygn", () => {
    // ⛔ Det egentliga provet i filen. Två minuter isär, men över midnatt.
    // En rak millisekundsdifferens svarar 0 här, och då säger raden "Idag" om
    // något som förfaller i morgon bitti.
    const sent = new Date(2026, 8, 17, 23, 59);
    const tidigt = new Date(2026, 8, 18, 0, 1);
    expect(daysBetween(sent, tidigt)).toBe(1);
  });

  it("ger noll inom samma dygn oavsett klockslag", () => {
    expect(daysBetween(new Date(2026, 8, 17, 0, 1), new Date(2026, 8, 17, 23, 59))).toBe(0);
  });

  it("är negativ bakåt", () => {
    expect(daysBetween(new Date(2026, 8, 20), new Date(2026, 8, 17))).toBe(-3);
  });

  it("överlever sommartidsskiftet", () => {
    // Sista söndagen i mars 2026 är den 29:e. Dygnet är 23 timmar långt.
    expect(daysBetween(new Date(2026, 2, 28), new Date(2026, 2, 30))).toBe(2);
    // Sista söndagen i oktober 2026 är den 25:e. Dygnet är 25 timmar långt.
    expect(daysBetween(new Date(2026, 9, 24), new Date(2026, 9, 26))).toBe(2);
  });

  it("räknar över månads- och årsskifte", () => {
    expect(daysBetween(new Date(2026, 11, 30), new Date(2027, 0, 2))).toBe(3);
  });
});

describe("dagarTill", () => {
  const today = new Date(2026, 8, 17, 14, 30);

  it("läser ISO-datum som lokal midnatt", () => {
    expect(daysUntil("2026-09-17", today)).toBe(0);
    expect(daysUntil("2026-09-18", today)).toBe(1);
    expect(daysUntil("2026-09-10", today)).toBe(-7);
  });

  it("ger null och inte noll vid oläsligt datum", () => {
    // ⛔ Noll betyder "idag" i hela kedjan. Ett trasigt datumfält som svarar noll
    // lägger posten överst under Idag med full brådska, alltså ett fel som ser ut
    // som en deadline.
    expect(daysUntil("inte ett datum", today)).toBeNull();
    expect(daysUntil("", today)).toBeNull();
    expect(daysUntil("2026-13-45", today)).toBeNull();
  });
});

describe("samlaHandelser", () => {
  it("slår ihop källorna och sorterar närmast först", () => {
    const a = [handelse({ id: "a1", daysLeft: 5 }), handelse({ id: "a2", daysLeft: 1 })];
    const b = [handelse({ id: "b1", daysLeft: 3 })];
    expect(collectEvents({ kallor: [a, b] }).map((h) => h.id)).toEqual(["a2", "b1", "a1"]);
  });

  it("lägger odaterat sist, inte först", () => {
    // ⛔ Det här är felet en naiv sortering gör: null är mindre än varje tal, så
    // allt odaterat hamnar överst, precis framför det som brinner. Listan ser
    // sorterad ut, och det är därför felet överlever.
    const kallor = [[handelse({ id: "utan" }), handelse({ id: "med", daysLeft: 4 })]];
    expect(collectEvents({ kallor }).map((h) => h.id)).toEqual(["med", "utan"]);
  });

  it("behandlar undefined dagarKvar som odaterat", () => {
    const kallor = [[{ id: "oskrivet", title: "oskrivet" }, handelse({ id: "med", daysLeft: 9 })]];
    expect(collectEvents({ kallor }).map((h) => h.id)).toEqual(["med", "oskrivet"]);
  });

  it("sorterar försenat före dagens", () => {
    const kallor = [[handelse({ id: "idag", daysLeft: 0 }), handelse({ id: "sent", daysLeft: -3 })]];
    expect(collectEvents({ kallor }).map((h) => h.id)).toEqual(["sent", "idag"]);
  });

  it("bryter lika dagar med appens ordningsfunktion", () => {
    const kallor = [
      [
        handelse({ id: "maskin", daysLeft: 2, role: "auto" }),
        handelse({ id: "manniska", daysLeft: 2, role: "human" }),
      ],
    ];
    const ordning = (/** @type {any} */ h) => (h.role === "human" ? 0 : 1);
    expect(collectEvents({ kallor, ordning }).map((h) => h.id)).toEqual(["manniska", "maskin"]);
  });

  it("ordningsfunktionen bryter aldrig dagordningen", () => {
    // ⛔ Tie-break betyder INOM samma dag. En rollvikt som får gå före dagarKvar
    // hade lyft något som ligger tre veckor bort över något som förfaller i dag,
    // bara för att en människa råkar äga det.
    const kallor = [[handelse({ id: "fjarran", daysLeft: 21, role: "human" }), handelse({ id: "nara", daysLeft: 0, role: "auto" })]];
    const ordning = (/** @type {any} */ h) => (h.role === "human" ? 0 : 1);
    expect(collectEvents({ kallor, ordning }).map((h) => h.id)).toEqual(["nara", "fjarran"]);
  });

  it("behåller källornas ordning när inget skiljer dem åt", () => {
    const kallor = [[handelse({ id: "forst", daysLeft: 2 }), handelse({ id: "sedan", daysLeft: 2 }), handelse({ id: "sist", daysLeft: 2 })]];
    expect(collectEvents({ kallor }).map((h) => h.id)).toEqual(["forst", "sedan", "sist"]);
  });

  it("tål tomma och saknade källor utan att tappa de andra", () => {
    const kallor = [[], [handelse({ id: "kvar", daysLeft: 1 })], /** @type {any} */ (null)];
    expect(collectEvents({ kallor }).map((h) => h.id)).toEqual(["kvar"]);
  });

  it("utan argument är svaret en tom lista och inte ett fel", () => {
    expect(collectEvents()).toEqual([]);
    expect(collectEvents({})).toEqual([]);
  });

  it("matar delaIdagKommande utan mellansteg", () => {
    // ⛔ De två funktionerna används alltid ihop, och provet finns för att visa
    // att `collectEvents` inte formar om något som `splitTodayUpcoming` behöver.
    const kallor = [
      [
        handelse({ id: "sent", daysLeft: -2 }),
        handelse({ id: "idag", daysLeft: 0 }),
        handelse({ id: "pagar", daysLeft: 4, pagar: true }),
        handelse({ id: "framat", daysLeft: 4 }),
        handelse({ id: "odaterat" }),
      ],
    ];
    const { today, kommande, forsenat } = splitTodayUpcoming(collectEvents({ kallor }));
    expect(forsenat).toBe(1);
    expect(today.map((h) => h.id)).toEqual(["sent", "idag", "pagar"]);
    expect(kommande.map((h) => h.id)).toEqual(["framat", "odaterat"]);
  });
});
