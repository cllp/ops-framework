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
});
