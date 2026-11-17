import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INKORG_TIDSGRANS_MS, SVARAR_INTE, useSamtal } from "../data/useSamtal.jsx";

/*
 * 0.236.0. CP 2026-11-17: Meddelanden stod på "…" och "fastnar såhär". Läsningen hade ingen tidsgräns, så ett anrop som aldrig svarade blev
 * varken rader eller fel. Nu blir det ett fel med koden SVARAR_INTE efter tidsgränsen, ett sent svar ritas ändå, och inkorgen läses om när
 * sidan blir synlig igen och när nätet kommer tillbaka.
 */

/** En källa vars översikt svarar först när provet säger till. */
function kallaSomHanger() {
  /** @type {((v: any) => void)[]} */
  const svar = [];
  const oversikt = vi.fn(() => new Promise((r) => svar.push(r)));
  return { kalla: /** @type {any} */ ({ oversikt, bevakaInkorg: undefined }), oversikt, svara: (/** @type {number} */ i, /** @type {any} */ v) => svar[i](v) };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("inkorgens tidsgräns (0.236.0)", () => {
  it("⛔ en översikt som inte svarar blir ett fel med koden SVARAR_INTE efter tidsgränsen, inte ett laddläge för alltid", async () => {
    const { kalla } = kallaSomHanger();
    const { result } = renderHook(() => useSamtal({ kalla, groupId: "g1", uid: "u1" }));
    expect(result.current.laddar).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(INKORG_TIDSGRANS_MS - 1);
    });
    expect(result.current.laddar).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.laddar).toBe(false);
    expect(/** @type {any} */ (result.current.fel)?.kod).toBe(SVARAR_INTE);
  });

  it("ett svar som kommer efter tidsgränsen ritas, och felet försvinner", async () => {
    const { kalla, svara } = kallaSomHanger();
    const { result } = renderHook(() => useSamtal({ kalla, groupId: "g1", uid: "u1" }));
    await act(async () => {
      vi.advanceTimersByTime(INKORG_TIDSGRANS_MS);
    });
    expect(result.current.fel).not.toBeNull();
    await act(async () => {
      svara(0, []);
    });
    expect(result.current.fel).toBeNull();
    expect(result.current.laddar).toBe(false);
  });

  it("⛔ sidan som blir synlig igen och nätet som kommer tillbaka läser om, men inte två gånger i samma stund", async () => {
    const { kalla, oversikt } = kallaSomHanger();
    renderHook(() => useSamtal({ kalla, groupId: "g1", uid: "u1" }));
    expect(oversikt).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(3_000);
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(oversikt).toHaveBeenCalledTimes(2);
    // Fokus direkt efter: samma stund, ingen tredje läsning.
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(oversikt).toHaveBeenCalledTimes(2);
    await act(async () => {
      vi.advanceTimersByTime(3_000);
      window.dispatchEvent(new Event("online"));
    });
    expect(oversikt).toHaveBeenCalledTimes(3);
  });
});
