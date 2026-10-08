import { describe, expect, it } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { createMinneskalla } from "../data/minneskalla.js";
import { byggMinnesrad, farAndraMinne, minnesradFel } from "../lib/minne.js";

const NU = 1_700_000_000_000;
const kalla = { slag: "trad", samtal: "cps-ab|grupp", trad: "rot", meddelande: "svar" };
const person = (uid, typ = "manniska") => ({ uid, namn: "Kim", typ, kalla: "minne" });
const rad = (extra = {}) => ({
  groupId: "cps-ab",
  text: "Budgeten är klar.",
  kalla,
  lyftAv: person("kim"),
  lyft: NU,
  andrad: NU,
  ...extra,
});

describe("minnesraden", () => {
  it("bygger en rad och nekar agenten, tom text och en annan grupps form", () => {
    expect(byggMinnesrad(rad()).text).toBe("Budgeten är klar.");
    expect(minnesradFel(rad({ lyftAv: person("agenten", "agent") }))).toMatch(/Agenten skriver inte/);
    expect(minnesradFel(rad({ text: "   " }))).toMatch(/Texten saknas/);
    expect(minnesradFel(rad({ groupId: "Annan" }))).toMatch(/inte ett grupp-id/);
  });

  it("ägaren och den som lyfte får ändra, admin får det inte", () => {
    const post = rad();
    expect(farAndraMinne(post, { uid: "kim", roll: "medlem" })).toBe(true);
    expect(farAndraMinne(post, { uid: "aga", roll: "agare" })).toBe(true);
    expect(farAndraMinne(post, { uid: "adm", roll: "admin" })).toBe(false);
    expect(farAndraMinne(post, { uid: "bo", roll: "medlem" })).toBe(false);
  });
});

describe("minneskällan", () => {
  it("lyfter i den egna gruppen och tar inte med en annan grupps rad", async () => {
    const source = createMemorySource({
      gruppmine: [{ id: "annan", ...rad({ groupId: "annan-grupp", text: "Hemlig." }) }],
    });
    const k = createMinneskalla({
      source,
      collection: "gruppmine",
      groupId: "cps-ab",
      skapare: () => person("kim"),
    });
    const skapad = await k.lyft({ text: "Vi tar den på fredag.", kalla });
    const las = await k.las();
    expect(las.kalla).toBe("databas");
    expect(las.fel).toBeNull();
    expect(las.rader.map((r) => r.text)).toEqual(["Vi tar den på fredag."]);
    expect(las.rader[0].lyftAv.typ).toBe("manniska");
    expect(skapad.id).toBeTruthy();
    await expect(k.taBort("annan")).rejects.toThrow(/annan-grupp/);
  });

  it("en tom läsning är ett svar, och ett läsfel är ett annat", async () => {
    const tom = createMinneskalla({
      source: createMemorySource({}),
      collection: "gruppmine",
      groupId: "cps-ab",
      skapare: () => person("kim"),
    });
    const las = await tom.las();
    expect(las).toMatchObject({ rader: [], kalla: "databas", fel: null, trasiga: [] });
    const trasig = createMinneskalla({
      source: { list: async () => { throw new Error("nere"); }, read() {}, create() {}, update() {}, remove() {} },
      collection: "gruppmine",
      groupId: "cps-ab",
      skapare: () => person("kim"),
    });
    const fel = await trasig.las();
    expect(fel.kalla).toBe("fel");
    expect(fel.rader).toEqual([]);
    expect(fel.fel?.message).toBe("nere");
  });
});
