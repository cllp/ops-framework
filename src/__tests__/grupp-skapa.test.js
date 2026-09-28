import { describe, it, expect } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { createGroupService } from "../node/grupp.js";

/**
 * Vitlistan och den första gruppen (#160, #161).
 *
 * ⛔ UTAN NÄTVERK, SAMMA MÖNSTER SOM `inbjudan.test.js`: datakällan skickas in,
 * alltså räcker minneskällan.
 */

const UID = "uid-vitlistad";
const EPOST = "vitlistad@example.com";

const bygg = (/** @type {{vitlista?: any[], memberships?: any[], groups?: any[]}} */ seed = {}) => {
  const kalla = createMemorySource({
    vitlista: seed.vitlista ?? [{ id: EPOST, epost: EPOST, tillagdAv: { uid: "uid-agare", namn: "Ägaren", typ: "manniska", kalla: "test" }, tid: "2026-09-28T00:00:00.000Z" }],
    memberships: seed.memberships ?? [],
    groups: seed.groups ?? [],
  });
  return { kalla, tjanst: createGroupService({ kalla }) };
};

describe("⛔ vitlistan kontrolleras, INNAN allt annat", () => {
  it("en vitlistad adress skapar sin grupp", async () => {
    const { tjanst } = bygg();
    const grupp = await tjanst.skapaGrupp({ uid: UID, epost: EPOST, namn: "Mitt bolag" });
    expect(grupp.namn).toEqual({ sv: "Mitt bolag", en: "Mitt bolag" });
    expect(grupp.moduler).toEqual([]);
  });

  it("⛔ en adress som INTE står på vitlistan kastar, och skapar ingenting", async () => {
    const { tjanst, kalla } = bygg({ vitlista: [] });
    await expect(tjanst.skapaGrupp({ uid: UID, epost: "utanfor@example.com", namn: "Ska inte bli av" })).rejects.toThrow(/står inte på vitlistan/);
    expect(await kalla.list("groups")).toEqual([]);
  });

  it("⛔ E-POSTEN JÄMFÖRS I GEMENER, ALLTID", async () => {
    const { tjanst } = bygg({ vitlista: [{ id: EPOST, epost: EPOST, tillagdAv: {}, tid: "x" }] });
    const grupp = await tjanst.skapaGrupp({ uid: UID, epost: "VITLISTAD@Example.com", namn: "Versaler" });
    expect(grupp.id).toBeTruthy();
  });
});

describe("⛔ en grupp per person, tills #162", () => {
  it("en person med ett aktivt medlemskap kan inte skapa en till grupp", async () => {
    const { tjanst } = bygg({
      memberships: [{ id: `${UID}|bolaget`, userId: UID, groupId: "bolaget", roll: "agare", typ: "person", status: "aktiv" }],
    });
    await expect(tjanst.skapaGrupp({ uid: UID, epost: EPOST, namn: "Andra bolaget" })).rejects.toThrow(/#162/);
  });

  it("ett AVSLUTAT medlemskap spärrar inte en ny grupp", async () => {
    const { tjanst } = bygg({
      memberships: [{ id: `${UID}|gammal`, userId: UID, groupId: "gammal", roll: "agare", typ: "person", status: "avslutad" }],
    });
    const grupp = await tjanst.skapaGrupp({ uid: UID, epost: EPOST, namn: "Ny start" });
    expect(grupp.id).toBeTruthy();
  });
});

describe("⛔ gruppen och ägarens medlemskap skrivs båda", () => {
  it("gruppen finns, och ägarens medlemskap pekar på den, med rollen agare", async () => {
    const { tjanst, kalla } = bygg();
    const grupp = await tjanst.skapaGrupp({ uid: UID, epost: EPOST, namn: "Mitt bolag" });

    const rader = await kalla.list("memberships", { where: { userId: UID } });
    expect(rader).toHaveLength(1);
    expect(rader[0].groupId).toBe(grupp.id);
    expect(rader[0].roll).toBe("agare");
    expect(rader[0].status).toBe("aktiv");
  });

  it("⛔ två grupper med samma namn får olika id, ingen tyst ersätter den andra", async () => {
    const { tjanst } = bygg({ memberships: [] });
    const forsta = await tjanst.skapaGrupp({ uid: "uid-forsta", epost: EPOST, namn: "Bolaget" });
    const andra = await tjanst.skapaGrupp({ uid: "uid-andra", epost: EPOST, namn: "Bolaget" });
    expect(forsta.id).not.toBe(andra.id);
  });

  it("ett grupp-id håller sig till ID_FORM även med svenska bokstäver i namnet", async () => {
    const { tjanst } = bygg();
    const grupp = await tjanst.skapaGrupp({ uid: UID, epost: EPOST, namn: "Åkeriet Örebro" });
    expect(grupp.id).toMatch(/^[a-z0-9][a-z0-9_-]*$/);
  });
});

describe("⛔ kraven på indata", () => {
  it("uid krävs", async () => {
    const { tjanst } = bygg();
    await expect(tjanst.skapaGrupp({ uid: "", epost: EPOST, namn: "X" })).rejects.toThrow(/uid krävs/);
  });

  it("epost krävs", async () => {
    const { tjanst } = bygg();
    await expect(tjanst.skapaGrupp({ uid: UID, epost: "", namn: "X" })).rejects.toThrow(/epost krävs/);
  });

  it("namn krävs", async () => {
    const { tjanst } = bygg();
    await expect(tjanst.skapaGrupp({ uid: UID, epost: EPOST, namn: "" })).rejects.toThrow(/namn krävs/);
  });

  it("⛔ createGroupService kräver en datakälla med read, list och create", () => {
    expect(() => createGroupService({ kalla: /** @type {any} */ ({}) })).toThrow(
      /createGroupService: en datakälla med read, list och create krävs/,
    );
  });
});
