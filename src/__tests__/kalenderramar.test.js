import { describe, expect, it } from "vitest";
import { MAX_KALENDERRAMAR, kalenderRamar } from "../lib/kalenderramar.js";
import { ARV_TON_KULOR } from "../lib/gruppfarg.js";

/** Kulörerna som de äldre tonerna ritas med (0.238.0, cllp/lifehub.app#882): ramarna är kulörer, och tonerna läses som sin kulör. @param {...number} n */
const T = (...n) => n.map((x) => ARV_TON_KULOR[/** @type {1} */ (x)]);

/**
 * Dagens ramar (0.151.0, CP 2026-10-28): högst två, den första kalendern i listan ytterst. Ren funktion, så att ordning och tak går att pröva utan webbläsare.
 * Hur ramarna SER UT på en ruta mäts i Chromium (`scripts/kalenderramar-matt.mjs`).
 */

const K = [
  { id: "a", farg: 1 },
  { id: "b", farg: 2 },
  { id: "c", farg: 3 },
];
const p = (/** @type {string} */ id, /** @type {string | undefined} */ kal, /** @type {string} */ date, /** @type {Record<string, any>} */ extra = {}) => ({
  id,
  title: id,
  date,
  ...(kal ? { kalender: { id: kal, namn: kal, farg: /** @type {any} */ (K.find((k) => k.id === kal)?.farg ?? 4) } } : {}),
  ...extra,
});
const alla = (/** @type {string} */ v) => () => v;
const per = (/** @type {Record<string, string>} */ karta) => (/** @type {any} */ e) => karta[e.kalender ? e.kalender.id : ""] ?? "handelser";

describe("kalenderRamar", () => {
  it("en kalender med Ram ger en ram, som förut", () => {
    const ut = kalenderRamar([p("1", "b", "2026-10-12")], { kalendrar: K, forvaldId: "", visningAv: alla("ram") });
    expect(ut.get("2026-10-12")).toEqual(T(2));
  });

  it("⛔ två kalendrar samma dag ger två ramar, den första i listan ytterst", () => {
    // Posterna kommer i omvänd ordning mot listan: ordningen avgörs av listan och inte av posterna.
    const ut = kalenderRamar([p("1", "b", "2026-10-12"), p("2", "a", "2026-10-12")], { kalendrar: K, forvaldId: "", visningAv: alla("bada") });
    expect(ut.get("2026-10-12")).toEqual(T(1, 2));
  });

  it("⛔ fler än två: bara de två första i listan ritas", () => {
    const ut = kalenderRamar([p("1", "c", "2026-10-12"), p("2", "b", "2026-10-12"), p("3", "a", "2026-10-12")], { kalendrar: K, forvaldId: "", visningAv: alla("ram") });
    expect(ut.get("2026-10-12")).toEqual(T(1, 2));
    expect(ut.get("2026-10-12")?.length).toBe(MAX_KALENDERRAMAR);
  });

  it("en kalender räknas en gång per dag, hur många poster den än har", () => {
    const ut = kalenderRamar([p("1", "a", "2026-10-12"), p("2", "a", "2026-10-12"), p("3", "a", "2026-10-12")], { kalendrar: K, forvaldId: "", visningAv: alla("ram") });
    expect(ut.get("2026-10-12")).toEqual(T(1));
  });

  it("bara Ram och Båda ger ram, Händelser ger ingen, och en dag utan ram står inte i kartan", () => {
    const poster = [p("1", "a", "2026-10-12"), p("2", "b", "2026-10-12"), p("3", "c", "2026-10-13")];
    const ut = kalenderRamar(poster, { kalendrar: K, forvaldId: "", visningAv: per({ a: "handelser", b: "bada", c: "handelser" }) });
    expect(ut.get("2026-10-12")).toEqual(T(2));
    expect(ut.has("2026-10-13")).toBe(false);
  });

  it("en flerdagspost ger ramen på varje dag den täcker, och en dag kan ha olika antal ramar", () => {
    const poster = [p("1", "a", "2026-10-12", { endDate: "2026-10-14", allDay: true }), p("2", "b", "2026-10-13")];
    const ut = kalenderRamar(poster, { kalendrar: K, forvaldId: "", visningAv: alla("ram") });
    expect(ut.get("2026-10-12")).toEqual(T(1));
    expect(ut.get("2026-10-13")).toEqual(T(1, 2));
    expect(ut.get("2026-10-14")).toEqual(T(1));
  });

  it("en post utan kalender hör till den förvalda och ger dess ram", () => {
    const ut = kalenderRamar([p("1", undefined, "2026-10-12"), p("2", "b", "2026-10-12")], { kalendrar: K, forvaldId: "c", visningAv: alla("ram") });
    expect(ut.get("2026-10-12")).toEqual(T(2, 3));
  });

  it("en kalender utanför listan kommer sist, i den ordning posterna kommer", () => {
    const poster = [p("1", "x", "2026-10-12"), p("2", "y", "2026-10-12"), p("3", "b", "2026-10-12")];
    const ut = kalenderRamar(poster, { kalendrar: K, forvaldId: "", visningAv: alla("ram") });
    expect(ut.get("2026-10-12")?.length).toBe(2);
    expect(ut.get("2026-10-12")?.[0]).toBe(ARV_TON_KULOR[2]);
  });

  it("golv: ingen post, ingen ram", () => {
    expect(kalenderRamar([], { kalendrar: K, forvaldId: "", visningAv: alla("ram") }).size).toBe(0);
  });

  it("⛔ en kalender med en kulör ger sin kulör, och en med en äldre ton tonens kulör (0.238.0)", () => {
    const kal = [{ id: "ny", farg: "kulor:210" }, { id: "gammal", farg: 3 }];
    const post = (/** @type {string} */ id, /** @type {string} */ k) => ({ id, title: id, date: "2026-10-12", kalender: { id: k, namn: k, farg: /** @type {any} */ (kal.find((x) => x.id === k)?.farg) } });
    const ut = kalenderRamar([post("1", "ny"), post("2", "gammal")], { kalendrar: kal, forvaldId: "", visningAv: alla("ram") });
    expect(ut.get("2026-10-12")).toEqual([210, ARV_TON_KULOR[3]]);
  });
});
