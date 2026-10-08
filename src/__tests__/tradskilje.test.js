/**
 * Avgränsaren i en trådbilagas nyckel, som den hamnar i regeltexten (0.80.0, granskningen av PR 307).
 *
 * ⛔ GENERATORN KASTAR PÅ ETT OSÄKERT TECKEN. `BILAGA_TRADSKILJE` står oescapad i en teckenklass (`[~]`), i `split` (som
 * i reglerna tar ett reguljärt uttryck) och inom `'...'`. Ett tecken som bryter något av dem hade gett en regel som tyst
 * nekar allt, eller släpper in det den skulle neka. Provet byter konstanten via `vi.mock` och läser att generatorn
 * vägrar, så att det är kopplingen som mäts och inte bara hjälpfunktionen.
 */

import { describe, expect, it, vi } from "vitest";

const avgransare = vi.hoisted(() => ({ varde: "~" }));

vi.mock("../lib/samtal.js", async (importOriginal) => {
  const riktig = /** @type {Record<string, unknown>} */ (await importOriginal());
  return {
    ...riktig,
    get BILAGA_TRADSKILJE() {
      return avgransare.varde;
    },
  };
});

const { samtalsregelfragment, tradskiljeTeckenklass } = await import("../lib/regler.js");

const NAMN = { tradar: "tradar", bilagor: /** @type {const} */ (true), bilagaSamling: "bilagor" };

describe("avgränsaren i trådbilagans nyckel", () => {
  it("~ blir teckenklassen [~] i regeln, i samtalet och i tråden", () => {
    expect(tradskiljeTeckenklass("~")).toBe("[~]");
    avgransare.varde = "~";
    const r = samtalsregelfragment(NAMN);
    expect(r.split("!mid.matches('.*[~].*')").length - 1).toBe(2);
  });

  it.each(["]", "^", "\\", "-"])("⛔ %s kastar, eftersom tecknet ändrar betydelse i en teckenklass", (t) => {
    expect(() => tradskiljeTeckenklass(t)).toThrow(/inte säkert i en teckenklass/);
    avgransare.varde = t;
    try {
      expect(() => samtalsregelfragment(NAMN)).toThrow(/BILAGA_TRADSKILJE/);
    } finally {
      avgransare.varde = "~";
    }
  });

  it.each([".", "|", "'", " ", "a", "_"])("⛔ %j kastar: metatecken i split, citattecken, blanktecken eller en del av ett id", (t) => {
    expect(() => tradskiljeTeckenklass(t)).toThrow(/inte säkert/);
  });

  it.each(["", "~~", "ab"])("⛔ %j kastar, eftersom det inte är ett enda tecken", (t) => {
    expect(() => tradskiljeTeckenklass(t)).toThrow(/ett enda tecken/);
  });

  it("utan bilagor prövas inte avgränsaren, och regeltexten är den gamla", () => {
    avgransare.varde = "]";
    try {
      expect(() => samtalsregelfragment()).not.toThrow();
    } finally {
      avgransare.varde = "~";
    }
  });
});
