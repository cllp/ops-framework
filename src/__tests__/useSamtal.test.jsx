import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useSamtal } from "../data/useSamtal.jsx";

/**
 * `useSamtal.laggIn` (0.63.0, #263, granskningen av PR 264): raden står kvar tills källan kommit ikapp, och ett samtal i en
 * annan grupp läggs aldrig in.
 */
const samtal = (groupId, id = `${groupId}|anna|bo`) => ({ id, groupId, slag: /** @type {const} */ ("personer"), deltagare: ["anna", "bo"], skapad: 1, skapadAv: "anna" });

describe("useSamtal.laggIn", () => {
  it("⛔ ett samtal i en annan grupp läggs inte in; ett i gruppen gör det och står kvar mot en källa som svarar tomt", async () => {
    const kalla = /** @type {any} */ ({ oversikt: vi.fn(async () => []) });
    const { result } = renderHook(() => useSamtal({ kalla, groupId: "g", uid: "anna" }));
    await waitFor(() => expect(result.current.laddar).toBe(false));
    await act(async () => result.current.laggIn(samtal("h")));
    expect(result.current.rader).toHaveLength(0);
    await act(async () => result.current.laggIn(samtal("g")));
    expect(result.current.rader.map((r) => r.samtal.id)).toEqual(["g|anna|bo"]);
    expect(result.current.rader[0].motpart).toBe("bo");
  });

  it("raden glöms när källan svarat med samtalet och ett lika nytt meddelande, och källans rad vinner då", async () => {
    let svar = /** @type {any[]} */ ([]);
    const kalla = /** @type {any} */ ({ oversikt: vi.fn(async () => svar) });
    const { result } = renderHook(() => useSamtal({ kalla, groupId: "g", uid: "anna" }));
    await waitFor(() => expect(result.current.laddar).toBe(false));
    const m = { id: "m1", text: "Hej", av: "anna", tid: 10 };
    await act(async () => result.current.laggIn(samtal("g"), m));
    expect(result.current.rader[0].senaste?.text).toBe("Hej");
    svar = [{ samtal: samtal("g"), senaste: m, olasta: 0, lastTill: 10, motpart: "bo" }];
    await act(async () => result.current.lasOm());
    svar = [];
    await act(async () => result.current.lasOm());
    expect(result.current.rader).toHaveLength(0);
  });

  it("⛔ gruppbytet glömmer de lokala raderna: en rad lagd i g står inte i h", async () => {
    const kalla = /** @type {any} */ ({ oversikt: vi.fn(async () => []) });
    const { result, rerender } = renderHook(({ g }) => useSamtal({ kalla, groupId: g, uid: "anna" }), { initialProps: { g: "g" } });
    await waitFor(() => expect(result.current.laddar).toBe(false));
    await act(async () => result.current.laggIn(samtal("g")));
    expect(result.current.rader).toHaveLength(1);
    rerender({ g: "h" });
    await waitFor(() => expect(result.current.laddar).toBe(false));
    expect(result.current.rader).toHaveLength(0);
  });

  it("⛔ gruppbytet glömmer källans förra svar: en inläggning i h innan h svarat tar inte med g:s rader", async () => {
    const gRad = { samtal: samtal("g", "g|grupp"), senaste: { id: "x", text: "Bara i g", av: "bo", tid: 5 }, olasta: 1, lastTill: 0, motpart: null };
    /** @type {(v: any) => void} */
    let hSvar = () => {};
    const kalla = /** @type {any} */ ({
      oversikt: vi.fn(async (/** @type {any} */ f) => (f.groupId === "g" ? [gRad] : new Promise((r) => (hSvar = r)))),
    });
    const { result, rerender } = renderHook(({ g }) => useSamtal({ kalla, groupId: g, uid: "anna" }), { initialProps: { g: "g" } });
    await waitFor(() => expect(result.current.rader).toHaveLength(1));
    rerender({ g: "h" });
    await act(async () => result.current.laggIn(samtal("h")));
    expect(result.current.rader.map((r) => r.samtal.id)).toEqual(["h|anna|bo"]);
    await act(async () => hSvar([]));
  });

  it("⛔ en laggIn ur en rendering för en annan grupp gör ingenting, också när samtalet är dess egen grupps", async () => {
    const kalla = /** @type {any} */ ({ oversikt: vi.fn(async () => []) });
    const { result, rerender } = renderHook(({ g }) => useSamtal({ kalla, groupId: g, uid: "anna" }), { initialProps: { g: "g" } });
    await waitFor(() => expect(result.current.laddar).toBe(false));
    const gamlaLaggIn = result.current.laggIn;
    rerender({ g: "h" });
    await waitFor(() => expect(result.current.laddar).toBe(false));
    await act(async () => gamlaLaggIn(samtal("g")));
    expect(result.current.rader).toHaveLength(0);
  });

  it("⛔ en lasOm ur en rendering för en annan grupp skriver inte in den gruppens översikt", async () => {
    const gRad = { samtal: samtal("g", "g|grupp"), senaste: { id: "x", text: "Bara i g", av: "bo", tid: 5 }, olasta: 1, lastTill: 0, motpart: null };
    const kalla = /** @type {any} */ ({ oversikt: vi.fn(async (/** @type {any} */ f) => (f.groupId === "g" ? [gRad] : [])) });
    const { result, rerender } = renderHook(({ g }) => useSamtal({ kalla, groupId: g, uid: "anna" }), { initialProps: { g: "g" } });
    await waitFor(() => expect(result.current.rader).toHaveLength(1));
    const gamlaLasOm = result.current.lasOm;
    rerender({ g: "h" });
    await waitFor(() => expect(result.current.rader).toHaveLength(0));
    await act(async () => gamlaLasOm());
    expect(result.current.rader).toHaveLength(0);
  });

  it("⛔ en gammal lasOm efter gruppbytet kastar inte den nya gruppens läsning som är på väg", async () => {
    const hRad = { samtal: samtal("h", "h|grupp"), senaste: { id: "y", text: "Bara i h", av: "bo", tid: 6 }, olasta: 1, lastTill: 0, motpart: null };
    /** @type {(v: any) => void} */
    let hSvar = () => {};
    const kalla = /** @type {any} */ ({ oversikt: vi.fn(async (/** @type {any} */ f) => (f.groupId === "g" ? [] : new Promise((r) => (hSvar = r)))) });
    const { result, rerender } = renderHook(({ g }) => useSamtal({ kalla, groupId: g, uid: "anna" }), { initialProps: { g: "g" } });
    await waitFor(() => expect(result.current.laddar).toBe(false));
    const gamlaLasOm = result.current.lasOm;
    rerender({ g: "h" });
    await waitFor(() => expect(kalla.oversikt).toHaveBeenLastCalledWith({ groupId: "h", uid: "anna" }));
    // h:s läsning är på väg. Den gamla lasOm körs (ett fokus ur en gammal stängning) innan h svarar.
    await act(async () => gamlaLasOm());
    await act(async () => hSvar([hRad]));
    expect(result.current.laddar).toBe(false);
    expect(result.current.rader.map((r) => r.samtal.id)).toEqual(["h|grupp"]);
  });
});
