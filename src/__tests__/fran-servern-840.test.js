import { describe, expect, it } from "vitest";
import { createFirestoreSource } from "../data/firestore.js";
import { createMemorySource } from "../data/adapters.js";

/**
 * 0.229.2 (cllp/lifehub.app#840): `list(..., { franServern: true })` avvisar ett svar ur Firestores cache.
 *
 * ⛔ Händelsen: CP 2026-11-14, LifeHub på Mac efter vila: "Du är inte med i någon grupp än" fast han är med i många. Offline gav `getDocs`
 * en tom lista ur minnescachen och inget fel, och grinden läste tomheten som ett svar. Proven nedan kör adapterns riktiga `list` mot ett
 * SDK som svarar som Firestore gör offline (`metadata.fromCache: true`), och mot ett som svarar från servern.
 */

/** @param {{ fromCache: boolean, rader: Array<Record<string, unknown>> }} svar */
const sdkSomSvarar = (svar) => ({
  collection: () => ({}),
  doc: () => ({}),
  getDoc: async () => ({ exists: () => false }),
  getDocs: async () => ({
    metadata: { fromCache: svar.fromCache },
    docs: svar.rader.map(({ id, ...data }) => ({ id, data: () => data })),
  }),
  addDoc: async () => ({ id: "x" }),
  setDoc: async () => {},
  updateDoc: async () => {},
  deleteDoc: async () => {},
  query: () => ({}),
  where: () => ({}),
  orderBy: () => ({}),
  limit: () => ({}),
  onSnapshot: () => () => {},
});

describe("franServern (0.229.2, lifehub.app#840)", () => {
  it("⛔ ett tomt svar ur cachen med flaggan är ett fel med koden unavailable, aldrig en tom lista", async () => {
    const kalla = createFirestoreSource({ db: {}, sdk: sdkSomSvarar({ fromCache: true, rader: [] }) });
    await expect(kalla.list("memberships", { where: { userId: "u1" }, franServern: true })).rejects.toMatchObject({ code: "unavailable" });
  });

  it("⛔ också ett svar ur cachen med rader avvisas: cachen kan vara gammal, och flaggan frågar efter servern", async () => {
    const kalla = createFirestoreSource({ db: {}, sdk: sdkSomSvarar({ fromCache: true, rader: [{ id: "m1", userId: "u1" }] }) });
    await expect(kalla.list("memberships", { franServern: true })).rejects.toMatchObject({ code: "unavailable" });
  });

  it("utan flaggan ges cachens lista som förut", async () => {
    const kalla = createFirestoreSource({ db: {}, sdk: sdkSomSvarar({ fromCache: true, rader: [{ id: "m1", userId: "u1" }] }) });
    expect(await kalla.list("memberships", { where: { userId: "u1" } })).toEqual([{ id: "m1", userId: "u1" }]);
    expect(await kalla.list("memberships")).toHaveLength(1);
  });

  it("med flaggan ges serverns svar, också när det är tomt", async () => {
    const full = createFirestoreSource({ db: {}, sdk: sdkSomSvarar({ fromCache: false, rader: [{ id: "m1", userId: "u1" }] }) });
    expect(await full.list("memberships", { franServern: true })).toEqual([{ id: "m1", userId: "u1" }]);
    const tom = createFirestoreSource({ db: {}, sdk: sdkSomSvarar({ fromCache: false, rader: [] }) });
    expect(await tom.list("memberships", { franServern: true })).toEqual([]);
  });

  it("minnets källa har ingen cache och ignorerar flaggan", async () => {
    const kalla = createMemorySource({ memberships: [{ id: "m1", userId: "u1" }] });
    expect(await kalla.list("memberships", { where: { userId: "u1" }, franServern: true })).toEqual([{ id: "m1", userId: "u1" }]);
  });
});
