import { describe, expect, it, vi } from "vitest";
import { FALT_BORT, faltAttTaBort } from "../data/contract.js";
import { createMemorySource } from "../data/adapters.js";
import { createFirestoreSource } from "../data/firestore.js";
import { createPostgresSource } from "../data/postgres.js";
import { createHttpSource } from "../data/http.js";

/**
 * 0.40.0 (#214): `FALT_BORT`, att ta bort ett fält vid `update`.
 *
 * ⛔ Händelsen: CP 2026-10-01: "Kolla med sessionstudio också så att det går att editera en händelse." Att redigera en händelse betyder att
 * kunna tömma ett fält (beskrivningen, klockslaget, slutdagen). `update` slog bara samman, så ett utelämnat fält blev kvar, och `""`
 * avvisas av appens regel (`slutDatum` måste vara ett datum, `slutTid` kräver `tid`). Det fanns ingen väg att ta bort ett fält.
 * Varje adapter måste göra det på sitt sätt, och en som inte kan KASTAR: ett fält som tyst blir kvar säger "sparat" om något som inte sparades.
 */

describe("FALT_BORT", () => {
  it("minnet tar bort nyckeln och rör inte resten, och en vanlig update är oförändrad", async () => {
    const k = createMemorySource({ h: [{ id: "h1", rubrik: "Möte", text: "Hej", tid: "10:00", slutTid: "11:00" }] });
    const ny = await k.update("h", "h1", { text: FALT_BORT, slutTid: FALT_BORT, rubrik: "Flyttat" });
    expect(Object.keys(ny).sort()).toEqual(["id", "rubrik", "tid"]);
    expect(ny).toEqual({ id: "h1", rubrik: "Flyttat", tid: "10:00" });
    expect("text" in (await k.read("h", "h1"))).toBe(false);
    expect(await k.update("h", "h1", { rubrik: "Igen" })).toEqual({ id: "h1", rubrik: "Igen", tid: "10:00" });
  });

  it("minnets batch tar bort nyckeln på samma sätt", async () => {
    const k = createMemorySource({ h: [{ id: "h1", rubrik: "Möte", text: "Hej" }] });
    await k.batch([{ op: "update", collection: "h", id: "h1", data: { text: FALT_BORT } }]);
    // ⛔ Nycklarna och inte `toEqual`: `{ text: undefined }` är lika med `{}` för `toEqual`, och provet hade varit grönt även utan symbolen.
    expect(Object.keys(await k.read("h", "h1")).sort()).toEqual(["id", "rubrik"]);
  });

  it("Firestore skickar deleteField() för fältet och värdet för resten, också i en batch", async () => {
    const BORT = { __deleteField: true };
    const update = vi.fn();
    const sdk = {
      collection: () => ({}), doc: (_d, s, id) => ({ s, id }), getDoc: async (r) => ({ exists: () => true, id: r.id, data: () => ({}) }),
      getDocs: async () => ({ docs: [] }), addDoc: async () => ({ id: "x" }), setDoc: async () => {}, updateDoc: async (_r, f) => update(f),
      deleteDoc: async () => {}, query: () => ({}), where: () => ({}), orderBy: () => ({}), limit: () => ({}), onSnapshot: () => () => {},
      deleteField: () => BORT,
      writeBatch: () => ({ update: (_r, f) => update(f), commit: async () => {} }),
    };
    const k = createFirestoreSource({ db: {}, sdk });
    await k.update("h", "h1", { text: FALT_BORT, rubrik: "Nytt" });
    expect(update).toHaveBeenLastCalledWith({ text: BORT, rubrik: "Nytt" });
    const svar = await /** @type {any} */ (k).batch([{ op: "update", collection: "h", id: "h1", data: { tid: FALT_BORT, rubrik: "B" } }]);
    expect(update).toHaveBeenLastCalledWith({ tid: BORT, rubrik: "B" });
    // Svaret nämner inte fältet som togs bort.
    expect(svar[0]).toEqual({ id: "h1", rubrik: "B" });
  });

  it("Firestore utan deleteField i sdk:n KASTAR och skriver inget, i stället för att låta fältet bli kvar", async () => {
    const updateDoc = vi.fn();
    const sdk = {
      collection: () => ({}), doc: () => ({}), getDoc: async () => ({ exists: () => true, id: "h1", data: () => ({}) }), getDocs: async () => ({ docs: [] }),
      addDoc: async () => ({ id: "x" }), setDoc: async () => {}, updateDoc, deleteDoc: async () => {}, query: () => ({}), where: () => ({}), orderBy: () => ({}),
      limit: () => ({}), onSnapshot: () => () => {},
    };
    const k = createFirestoreSource({ db: {}, sdk });
    await expect(k.update("h", "h1", { text: FALT_BORT })).rejects.toThrow(/kräver `deleteField`/);
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it("Postgres skriver NULL som parameter, och HTTP skickar null i kroppen", async () => {
    const query = vi.fn(async () => [{ id: "h1" }]);
    await createPostgresSource({ query }).update("h", "h1", { text: FALT_BORT, rubrik: "N" });
    expect(query.mock.calls[0][1]).toEqual([null, "N", "h1"]);

    const f = vi.fn(async () => ({ ok: true, status: 200, statusText: "OK", json: async () => ({ id: "h1" }), text: async () => "{}" }));
    await createHttpSource({ baseUrl: "https://api.example.se/v1", load: f }).update("h", "h1", { text: FALT_BORT, rubrik: "N" });
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ text: null, rubrik: "N" });
  });

  it("är en symbol: en text som en användare skriver kan aldrig bli en borttagning", () => {
    expect(typeof FALT_BORT).toBe("symbol");
    expect(faltAttTaBort({ a: "FALT_BORT", b: FALT_BORT, c: null })).toEqual(["b"]);
  });
});
