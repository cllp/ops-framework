import { describe, it, expect } from "vitest";
import { dagarMellan, dagarTill, samlaHandelser, delaIdagKommande } from "../lib/handelser.js";

/**
 * ⛔ PROVEN ANVÄNDER PÅHITTADE ORD ("leverans", "besiktning") MED FLIT.
 * Ramverket får inte kunna bero på bolag-ops vokabulär, och ett prov som säger
 * "kundfaktura" hade gjort det svårt att se när det börjar göra det.
 */

/** @param {object} h */
const handelse = (h) => ({ id: String(h.id), titel: String(h.titel || h.id), dagarKvar: null, ...h });

describe("dagarMellan", () => {
  it("räknar kalenderdagar, inte dygn", () => {
    // ⛔ Det egentliga provet i filen. Två minuter isär, men över midnatt.
    // En rak millisekundsdifferens svarar 0 här, och då säger raden "Idag" om
    // något som förfaller i morgon bitti.
    const sent = new Date(2026, 8, 17, 23, 59);
    const tidigt = new Date(2026, 8, 18, 0, 1);
    expect(dagarMellan(sent, tidigt)).toBe(1);
  });

  it("ger noll inom samma dygn oavsett klockslag", () => {
    expect(dagarMellan(new Date(2026, 8, 17, 0, 1), new Date(2026, 8, 17, 23, 59))).toBe(0);
  });

  it("är negativ bakåt", () => {
    expect(dagarMellan(new Date(2026, 8, 20), new Date(2026, 8, 17))).toBe(-3);
  });

  it("överlever sommartidsskiftet", () => {
    // Sista söndagen i mars 2026 är den 29:e. Dygnet är 23 timmar långt.
    expect(dagarMellan(new Date(2026, 2, 28), new Date(2026, 2, 30))).toBe(2);
    // Sista söndagen i oktober 2026 är den 25:e. Dygnet är 25 timmar långt.
    expect(dagarMellan(new Date(2026, 9, 24), new Date(2026, 9, 26))).toBe(2);
  });

  it("räknar över månads- och årsskifte", () => {
    expect(dagarMellan(new Date(2026, 11, 30), new Date(2027, 0, 2))).toBe(3);
  });
});

describe("dagarTill", () => {
  const idag = new Date(2026, 8, 17, 14, 30);

  it("läser ISO-datum som lokal midnatt", () => {
    expect(dagarTill("2026-09-17", idag)).toBe(0);
    expect(dagarTill("2026-09-18", idag)).toBe(1);
    expect(dagarTill("2026-09-10", idag)).toBe(-7);
  });

  it("ger null och inte noll vid oläsligt datum", () => {
    // ⛔ Noll betyder "idag" i hela kedjan. Ett trasigt datumfält som svarar noll
    // lägger posten överst under Idag med full brådska, alltså ett fel som ser ut
    // som en deadline.
    expect(dagarTill("inte ett datum", idag)).toBeNull();
    expect(dagarTill("", idag)).toBeNull();
    expect(dagarTill("2026-13-45", idag)).toBeNull();
  });
});

describe("samlaHandelser", () => {
  it("slår ihop källorna och sorterar närmast först", () => {
    const a = [handelse({ id: "a1", dagarKvar: 5 }), handelse({ id: "a2", dagarKvar: 1 })];
    const b = [handelse({ id: "b1", dagarKvar: 3 })];
    expect(samlaHandelser({ kallor: [a, b] }).map((h) => h.id)).toEqual(["a2", "b1", "a1"]);
  });

  it("lägger odaterat sist, inte först", () => {
    // ⛔ Det här är felet en naiv sortering gör: null är mindre än varje tal, så
    // allt odaterat hamnar överst, precis framför det som brinner. Listan ser
    // sorterad ut, och det är därför felet överlever.
    const kallor = [[handelse({ id: "utan" }), handelse({ id: "med", dagarKvar: 4 })]];
    expect(samlaHandelser({ kallor }).map((h) => h.id)).toEqual(["med", "utan"]);
  });

  it("behandlar undefined dagarKvar som odaterat", () => {
    const kallor = [[{ id: "oskrivet", titel: "oskrivet" }, handelse({ id: "med", dagarKvar: 9 })]];
    expect(samlaHandelser({ kallor }).map((h) => h.id)).toEqual(["med", "oskrivet"]);
  });

  it("sorterar försenat före dagens", () => {
    const kallor = [[handelse({ id: "idag", dagarKvar: 0 }), handelse({ id: "sent", dagarKvar: -3 })]];
    expect(samlaHandelser({ kallor }).map((h) => h.id)).toEqual(["sent", "idag"]);
  });

  it("bryter lika dagar med appens ordningsfunktion", () => {
    const kallor = [
      [
        handelse({ id: "maskin", dagarKvar: 2, roll: "auto" }),
        handelse({ id: "manniska", dagarKvar: 2, roll: "human" }),
      ],
    ];
    const ordning = (/** @type {any} */ h) => (h.roll === "human" ? 0 : 1);
    expect(samlaHandelser({ kallor, ordning }).map((h) => h.id)).toEqual(["manniska", "maskin"]);
  });

  it("ordningsfunktionen bryter aldrig dagordningen", () => {
    // ⛔ Tie-break betyder INOM samma dag. En rollvikt som får gå före dagarKvar
    // hade lyft något som ligger tre veckor bort över något som förfaller i dag,
    // bara för att en människa råkar äga det.
    const kallor = [[handelse({ id: "fjarran", dagarKvar: 21, roll: "human" }), handelse({ id: "nara", dagarKvar: 0, roll: "auto" })]];
    const ordning = (/** @type {any} */ h) => (h.roll === "human" ? 0 : 1);
    expect(samlaHandelser({ kallor, ordning }).map((h) => h.id)).toEqual(["nara", "fjarran"]);
  });

  it("behåller källornas ordning när inget skiljer dem åt", () => {
    const kallor = [[handelse({ id: "forst", dagarKvar: 2 }), handelse({ id: "sedan", dagarKvar: 2 }), handelse({ id: "sist", dagarKvar: 2 })]];
    expect(samlaHandelser({ kallor }).map((h) => h.id)).toEqual(["forst", "sedan", "sist"]);
  });

  it("tål tomma och saknade källor utan att tappa de andra", () => {
    const kallor = [[], [handelse({ id: "kvar", dagarKvar: 1 })], /** @type {any} */ (null)];
    expect(samlaHandelser({ kallor }).map((h) => h.id)).toEqual(["kvar"]);
  });

  it("utan argument är svaret en tom lista och inte ett fel", () => {
    expect(samlaHandelser()).toEqual([]);
    expect(samlaHandelser({})).toEqual([]);
  });

  it("matar delaIdagKommande utan mellansteg", () => {
    // ⛔ De två funktionerna används alltid ihop, och provet finns för att visa
    // att `samlaHandelser` inte formar om något som `delaIdagKommande` behöver.
    const kallor = [
      [
        handelse({ id: "sent", dagarKvar: -2 }),
        handelse({ id: "idag", dagarKvar: 0 }),
        handelse({ id: "pagar", dagarKvar: 4, pagar: true }),
        handelse({ id: "framat", dagarKvar: 4 }),
        handelse({ id: "odaterat" }),
      ],
    ];
    const { idag, kommande, forsenat } = delaIdagKommande(samlaHandelser({ kallor }));
    expect(forsenat).toBe(1);
    expect(idag.map((h) => h.id)).toEqual(["sent", "idag", "pagar"]);
    expect(kommande.map((h) => h.id)).toEqual(["framat", "odaterat"]);
  });
});
