import { describe, expect, it } from "vitest";
import { TALK_INGET_TAL, TYSTNADSGRANS, barTystnad, kanSpelaInIgen } from "../lib/talk.js";

describe("#539: bara tystnad skickas aldrig", () => {
  it("en toppnivå under gränsen är tystnad", () => {
    expect(barTystnad(0)).toBe(true);
    expect(barTystnad(TYSTNADSGRANS / 2)).toBe(true);
  });
  it("tal, okänd nivå och WebKit (null) är aldrig tystnad", () => {
    expect(barTystnad(0.3)).toBe(false);
    expect(barTystnad(TYSTNADSGRANS)).toBe(false);
    expect(barTystnad(null)).toBe(false);
    expect(barTystnad(undefined)).toBe(false);
    expect(barTystnad(Number.NaN)).toBe(false);
  });
  it("fältet erbjuder Spela in igen och säger att inget skickades", () => {
    expect(kanSpelaInIgen(TALK_INGET_TAL)).toBe(true);
    expect(TALK_INGET_TAL).toMatch(/Ingenting skickades/);
  });
});
