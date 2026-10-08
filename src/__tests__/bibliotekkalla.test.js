import { describe, expect, it } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { createBibliotekskalla } from "../data/bibliotekkalla.js";

const skapare = () => ({ uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" });

describe("createBibliotekskalla", () => {
  it("kräver samling, grupp och skapare", () => {
    const source = createMemorySource();
    expect(() => createBibliotekskalla({ source, collection: "", groupId: "cps-ab", skapare })).toThrow(/collection/);
    expect(() => createBibliotekskalla({ source, collection: "bibliotek", groupId: "", skapare })).toThrow(/groupId/);
  });

  it("läser bara den här gruppens rader och skriver författaren själv", async () => {
    const source = createMemorySource({
      bibliotek: [
        { id: "annan", groupId: "miranda-ab", typ: "anteckning", rubrik: "Deras", text: "Hemlig.", skapadAv: { uid: "u2", namn: "M", typ: "manniska", kalla: "b" }, skapad: 1, andrad: 1 },
      ],
    });
    const kalla = createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare });
    const tom = await kalla.las();
    expect(tom.kalla).toBe("databas");
    expect(tom.poster).toEqual([]);
    expect(tom.fel).toBeNull();
    const sparad = await kalla.spara({ typ: "anteckning", rubrik: "Protokoll", text: "Vi beslutade." });
    expect(sparad.skapadAv.uid).toBe("uid-1");
    expect(sparad.groupId).toBe("cps-ab");
    const efter = await kalla.las();
    expect(efter.poster.map((p) => p.rubrik)).toEqual(["Protokoll"]);
  });

  it("en trasig rad märks och släcker inte de andra", async () => {
    const hel = { groupId: "cps-ab", typ: "anteckning", rubrik: "Hel", text: "Läsbar.", skapadAv: skapare(), skapad: 1, andrad: 1 };
    const source = createMemorySource({
      bibliotek: [
        { id: "x", groupId: "cps-ab", typ: "anteckning", rubrik: "Halv" },
        { id: "mellanslag", ...hel, text: "   " },
        { id: "ok", ...hel },
      ],
    });
    const kalla = createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare });
    const svar = await kalla.las();
    expect(svar.kalla).toBe("databas");
    expect(svar.fel).toBeNull();
    expect(svar.poster.map((p) => p.id)).toEqual(["ok"]);
    expect(svar.trasiga.map((t) => t.id).sort()).toEqual(["mellanslag", "x"]);
    expect(svar.trasiga.find((t) => t.id === "x")?.fel).toMatch(/saknar text/);
  });

  it("en rad från en annan grupp märks, även om källan släpper igenom den", async () => {
    const rad = { id: "fel-grupp", groupId: "miranda-ab", typ: "anteckning", rubrik: "Deras", text: "Hemlig.", skapadAv: skapare(), skapad: 1, andrad: 1 };
    const source = { list: async () => [rad], read: async () => null, create: async () => ({ id: "n" }), update: async () => {} };
    const kalla = createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare });
    const svar = await kalla.las();
    expect(svar.poster).toEqual([]);
    expect(svar.trasiga).toEqual([{ id: "fel-grupp", fel: expect.stringMatching(/miranda-ab/) }]);
  });

  it("en läsning som föll är kalla fel, inte ett tomt bibliotek", async () => {
    const source = { list: async () => { throw new Error("nere"); }, read: async () => null, create: async () => ({ id: "n" }), update: async () => {} };
    const kalla = createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare });
    const svar = await kalla.las();
    expect(svar.kalla).toBe("fel");
    expect(svar.fel?.message).toBe("nere");
  });
});
