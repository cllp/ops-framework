import { describe, expect, it } from "vitest";
import { createKalendervalskalla } from "../data/kalendervalskalla.js";
import { createMemorySource } from "../data/adapters.js";
import { MAX_KALENDERVAL, TOM_SYNLIGHET } from "../lib/kalendersynlighet.js";
import { kalendervalsregelfragment } from "../lib/regler.js";

/**
 * Kalendervalens källa och regelfragment (0.151.0). Reglerna mäts i emulatorn (`rules/__tests__/kalenderval.test.mjs`); här prövas formen på sökvägen, valideringen
 * och att namnet aldrig kommer från ramverket.
 */

describe("createKalendervalskalla", () => {
  const ny = () => createKalendervalskalla({ kalla: createMemorySource(), kalenderval: "kalenderval" });

  it("skriver och läser ett dokument per person och grupp, utan id i svaret", async () => {
    const k = ny();
    expect(await k.las("u1", "g1")).toBeNull();
    await k.skriv("u1", "g1", { v: 1, syns: { a: false }, visning: { b: "ram" } });
    expect(await k.las("u1", "g1")).toEqual({ v: 1, syns: { a: false }, visning: { b: "ram" } });
    // En annan grupp och en annan person ser ingenting.
    expect(await k.las("u1", "g2")).toBeNull();
    expect(await k.las("u2", "g1")).toBeNull();
  });

  it("⛔ sökvägen är <användare>/<uid>/<samling>/<grupp>, med namnen appen valt", async () => {
    const kalla = createMemorySource();
    const k = createKalendervalskalla({ kalla, anvandare: "personer", kalenderval: "mina-val" });
    await k.skriv("u1", "g1", TOM_SYNLIGHET);
    expect(await kalla.read("personer/u1/mina-val", "g1")).toMatchObject({ v: 1 });
    expect(await kalla.read("users/u1/kalenderval", "g1")).toBeNull();
  });

  it("'före' följer med, och ett nytt skrivande ersätter hela dokumentet", async () => {
    const k = ny();
    await k.skriv("u1", "g1", { v: 1, syns: { a: false }, visning: {}, fore: { b: false } });
    expect((await k.las("u1", "g1"))?.fore).toEqual({ b: false });
    await k.skriv("u1", "g1", { v: 1, syns: {}, visning: {} });
    expect(await k.las("u1", "g1")).toEqual({ v: 1, syns: {}, visning: {} });
  });

  it("konto(uid, grupp) är den form hooken tar", async () => {
    const k = ny();
    const konto = k.konto("u1", "g1");
    expect(await konto.las()).toBeNull();
    await konto.skriv({ v: 1, syns: { a: true }, visning: {} });
    expect(await konto.las()).toEqual({ v: 1, syns: { a: true }, visning: {} });
  });

  it("⛔ kräver ett samlingsnamn: ramverket känner det aldrig själv", () => {
    expect(() => createKalendervalskalla({ kalla: createMemorySource() })).toThrow(/kalenderval "undefined" är inte ett samlingsnamn/);
    expect(() => createKalendervalskalla({ kalla: createMemorySource(), kalenderval: "a/b" })).toThrow(/inte ett samlingsnamn/);
    expect(() => createKalendervalskalla({ kalenderval: "x" })).toThrow(/kalla krävs/);
  });

  it("kastar på ett uid eller grupp-id som inte går att använda, innan något skrivs", async () => {
    const k = ny();
    await expect(k.skriv("", "g1", TOM_SYNLIGHET)).rejects.toThrow(/uid/);
    await expect(k.skriv("u/1", "g1", TOM_SYNLIGHET)).rejects.toThrow(/uid/);
    await expect(k.skriv("u1", "Stora", TOM_SYNLIGHET)).rejects.toThrow(/grupp-id/);
    await expect(k.skriv("u1", "a".repeat(81), TOM_SYNLIGHET)).rejects.toThrow(/grupp-id/);
    expect(() => k.konto("u1", "")).toThrow(/grupp-id/);
  });

  it("kastar ett begripligt fel över MAX_KALENDERVAL i stället för att låta reglerna neka", async () => {
    const k = ny();
    const syns = Object.fromEntries(Array.from({ length: MAX_KALENDERVAL + 1 }, (_, i) => [`k${i}`, true]));
    await expect(k.skriv("u1", "g1", { v: 1, syns, visning: {} })).rejects.toThrow(/högst 200/);
  });

  it("⛔ en läsning som kastar kastar vidare: 'fanns inget' och 'kunde inte fråga' är olika saker", async () => {
    const trasig = { read: () => Promise.reject(new Error("nekad")), create: () => Promise.resolve({}) };
    const k = createKalendervalskalla({ kalla: /** @type {any} */ (trasig), kalenderval: "kalenderval" });
    await expect(k.las("u1", "g1")).rejects.toThrow("nekad");
  });
});

describe("kalendervalsregelfragment", () => {
  it("bär samlingsnamnet appen skickade, och aldrig ett förval", () => {
    const t = kalendervalsregelfragment("mina-val");
    expect(t).toContain("match /users/{uid}/mina-val/{gid}");
    expect(t).not.toContain("kalenderval/");
    expect(kalendervalsregelfragment("x", { anvandare: "personer" })).toContain("match /personer/{uid}/x/{gid}");
  });

  it("kräver ett samlingsnamn, och nekar en sökväg", () => {
    expect(() => kalendervalsregelfragment(/** @type {any} */ (undefined))).toThrow(/samlingsnamn/);
    expect(() => kalendervalsregelfragment("a/b")).toThrow(/samlingsnamn/);
    expect(() => kalendervalsregelfragment("x", { anvandare: "u/v" })).toThrow(/samlingsnamn/);
  });

  it("⛔ härleder taken, fälten och visningarna ur klientens egna konstanter", () => {
    const t = kalendervalsregelfragment("kalenderval");
    expect(t).toContain(`d.syns.size() <= ${MAX_KALENDERVAL}`);
    expect(t).toContain('d.keys().hasOnly(["v", "syns", "visning", "fore"])');
    expect(t).toContain('d.visning.values().hasOnly(["handelser", "ram", "bada"])');
    expect(t).toContain("allow delete: if false;");
    expect(t).toContain("request.auth.uid == uid");
  });
});
