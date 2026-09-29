import { describe, it, expect } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { createGroupService } from "../node/grupp.js";
import { medlemskapsId } from "../lib/grupp.js";

/**
 * Vitlistan, skapa grupp och inbjudan vid skapandet (#160, #161, 0.32.0 #180).
 *
 * ⛔ UTAN NÄTVERK, SAMMA MÖNSTER SOM `inbjudan.test.js`: datakällan skickas in,
 * alltså räcker minneskällan.
 */

const UID = "uid-vitlistad";
const EPOST = "vitlistad@example.com";

const bygg = (/** @type {{vitlista?: any[], memberships?: any[], groups?: any[], users?: any[]}} */ seed = {}) => {
  const kalla = createMemorySource({
    vitlista: seed.vitlista ?? [{ id: EPOST, epost: EPOST, tillagdAv: { uid: "uid-agare", namn: "Ägaren", typ: "manniska", kalla: "test" }, tid: "2026-09-28T00:00:00.000Z" }],
    memberships: seed.memberships ?? [],
    groups: seed.groups ?? [],
    users: seed.users ?? [],
    invitations: [],
  });
  return { kalla, tjanst: createGroupService({ kalla }) };
};

const skapa = (/** @type {any} */ tjanst, /** @type {any} */ extra = {}, /** @type {any} */ grupp = { namn: "Mitt bolag" }) => tjanst.skapaGrupp({ uid: UID, epost: EPOST, grupp, ...extra });

describe("⛔ vitlistan kontrolleras, INNAN allt annat", () => {
  it("en vitlistad adress skapar sin grupp", async () => {
    const { tjanst, kalla } = bygg();
    const svar = await skapa(tjanst);
    const grupp = await kalla.read("groups", svar.groupId);
    expect(grupp.namn).toEqual({ sv: "Mitt bolag", en: "Mitt bolag" });
    expect(grupp.moduler).toEqual([]);
  });

  it("⛔ en adress som INTE står på vitlistan kastar, och skapar ingenting", async () => {
    const { tjanst, kalla } = bygg({ vitlista: [] });
    await expect(tjanst.skapaGrupp({ uid: UID, epost: "utanfor@example.com", grupp: { namn: "Ska inte bli av" } })).rejects.toThrow(/står inte på vitlistan/);
    expect(await kalla.list("groups")).toEqual([]);
    expect(await kalla.list("memberships")).toEqual([]);
  });

  it("⛔ E-POSTEN JÄMFÖRS I GEMENER, ALLTID", async () => {
    const { tjanst } = bygg({ vitlista: [{ id: EPOST, epost: EPOST, tillagdAv: {}, tid: "x" }] });
    const svar = await tjanst.skapaGrupp({ uid: UID, epost: "VITLISTAD@Example.com", grupp: { namn: "Versaler" } });
    expect(svar.groupId).toBeTruthy();
  });

  it("⛔ vitlistan kontrolleras FÖRE att inbjudningarna ens läses: en icke-vitlistad med fel adress i listan får vitlistefelet, inget skrivs", async () => {
    const { tjanst, kalla } = bygg({ vitlista: [] });
    await expect(tjanst.skapaGrupp({ uid: UID, epost: "x@example.com", grupp: { namn: "G" }, inbjudningar: [{ epost: "ny@example.com" }] })).rejects.toThrow(/står inte på vitlistan/);
    expect(await kalla.list("invitations")).toEqual([]);
  });
});

describe("⛔ flera grupper per person (0.32.0, #180)", () => {
  it("en person med ett aktivt medlemskap skapar en andra grupp, och båda finns", async () => {
    const { tjanst, kalla } = bygg({
      memberships: [{ id: `${UID}|bolaget`, userId: UID, groupId: "bolaget", roll: "agare", typ: "person", status: "aktiv" }],
    });
    const svar = await skapa(tjanst, {}, { namn: "Andra bolaget" });
    const rader = (await kalla.list("memberships", { where: { userId: UID } })).filter((m) => m.status === "aktiv");
    expect(rader.map((r) => r.groupId).sort()).toEqual(["bolaget", svar.groupId].sort());
  });

  it("ett AVSLUTAT medlemskap spärrar inte heller", async () => {
    const { tjanst } = bygg({
      memberships: [{ id: `${UID}|gammal`, userId: UID, groupId: "gammal", roll: "agare", typ: "person", status: "avslutad" }],
    });
    expect((await skapa(tjanst, {}, { namn: "Ny start" })).groupId).toBeTruthy();
  });
});

describe("⛔ gruppen och ägarens medlemskap skrivs båda", () => {
  it("gruppen finns, och ägarens medlemskap pekar på den, med rollen agare", async () => {
    const { tjanst, kalla } = bygg();
    const svar = await skapa(tjanst);

    const rader = await kalla.list("memberships", { where: { userId: UID } });
    expect(rader).toHaveLength(1);
    expect(rader[0].groupId).toBe(svar.groupId);
    expect(rader[0].roll).toBe("agare");
    expect(rader[0].status).toBe("aktiv");
  });

  it("⛔ medlemskapets namn är PERSONENS ur users, inte gruppens (#138)", async () => {
    const { tjanst, kalla } = bygg({ users: [{ id: UID, namn: "Claes Philip", epost: EPOST, bild: "https://x/b.png" }] });
    const svar = await skapa(tjanst);
    const rad = await kalla.read("memberships", medlemskapsId(UID, svar.groupId));
    expect(rad).toMatchObject({ namn: "Claes Philip", bild: "https://x/b.png" });
    expect((await kalla.read("groups", svar.groupId)).skapadAv.namn).toBe("Claes Philip");
  });

  it("⛔ två grupper med samma namn får olika id, ingen tyst ersätter den andra", async () => {
    const { tjanst } = bygg();
    const forsta = await tjanst.skapaGrupp({ uid: "uid-forsta", epost: EPOST, grupp: { namn: "Bolaget" } });
    const andra = await tjanst.skapaGrupp({ uid: "uid-andra", epost: EPOST, grupp: { namn: "Bolaget" } });
    expect(forsta.groupId).not.toBe(andra.groupId);
  });

  it("ett grupp-id håller sig till ID_FORM även med svenska bokstäver i namnet", async () => {
    const { tjanst } = bygg();
    expect((await skapa(tjanst, {}, { namn: "Åkeriet Örebro" })).groupId).toMatch(/^[a-z0-9][a-z0-9_-]*$/);
  });

  it("⛔ utseende och uppgifter skrivs på gruppen (0.32.0)", async () => {
    const { tjanst, kalla } = bygg();
    const svar = await skapa(tjanst, {}, { namn: "Åkeriet", farg: "4", ikon: "initialer:ÅK", beskrivning: "Vi kör", ort: "Visby", epostsprak: "en" });
    expect(await kalla.read("groups", svar.groupId)).toMatchObject({ farg: "4", ikon: "initialer:ÅK", beskrivning: "Vi kör", ort: "Visby", epostsprak: "en", bild: "" });
  });

  it("⛔ ett ogiltigt utseende kastar FÖRE första skrivningen, inget blir kvar", async () => {
    const { tjanst, kalla } = bygg();
    await expect(skapa(tjanst, {}, { namn: "G", farg: "guld" })).rejects.toThrow(/groups: färgen "guld"/);
    await expect(skapa(tjanst, {}, { namn: "G", beskrivning: "x".repeat(300) })).rejects.toThrow(/groups: beskrivningen/);
    expect(await kalla.list("groups")).toEqual([]);
    expect(await kalla.list("memberships")).toEqual([]);
  });

  it("ett Namn med båda språken tas emot som det är", async () => {
    const { tjanst, kalla } = bygg();
    const svar = await skapa(tjanst, {}, { namn: { sv: "Bolaget", en: "The company" } });
    expect((await kalla.read("groups", svar.groupId)).namn).toEqual({ sv: "Bolaget", en: "The company" });
  });
});

describe("⛔ ATOMISKT: faller det andra skrivandet finns inget av det första (0.32.0)", () => {
  /**
   * En källa vars skrivning av medlemskap alltid faller, oavsett om tjänsten skriver den med `create`
   * eller i en `batch`. Provet mäter alltså resultatet och inte vilken väg tjänsten valde: en
   * implementation som skriver gruppen och SEDAN medlemskapet med två anrop lämnar gruppen kvar och
   * är röd här.
   */
  const trasig = () => {
    const minne = createMemorySource({
      vitlista: [{ id: EPOST, epost: EPOST, tillagdAv: {}, tid: "x" }],
      memberships: [],
      groups: [],
      users: [],
      invitations: [],
    });
    return {
      minne,
      kalla: /** @type {any} */ ({
        ...minne,
        create: async (/** @type {string} */ c, /** @type {any} */ d) => {
          if (c === "memberships") throw new Error("skrivningen av medlemskapet föll");
          return minne.create(c, d);
        },
        batch: async (/** @type {any[]} */ ops) => minne.batch(ops.map((o) => (o.collection === "memberships" ? { op: "update", collection: "memberships", id: "finns-inte", data: {} } : o))),
      }),
    };
  };

  it("⛔ ingen grupp blir kvar utan ägare", async () => {
    const { kalla, minne } = trasig();
    const tjanst = createGroupService({ kalla });
    await expect(tjanst.skapaGrupp({ uid: UID, epost: EPOST, grupp: { namn: "Halv" } })).rejects.toThrow();
    expect(await minne.list("groups")).toEqual([]);
    expect(await minne.list("memberships")).toEqual([]);
  });

  it("⛔ och inga inbjudningar skickas när gruppen föll", async () => {
    const { kalla, minne } = trasig();
    const tjanst = createGroupService({ kalla });
    await expect(tjanst.skapaGrupp({ uid: UID, epost: EPOST, grupp: { namn: "Halv" }, inbjudningar: [{ epost: "ny@example.com" }] })).rejects.toThrow();
    expect(await minne.list("invitations")).toEqual([]);
  });

  it("minnesadapterns batch återställer HELA lagret, också det som fanns före", async () => {
    const minne = createMemorySource({ a: [{ id: "1", v: 1 }] });
    await expect(
      minne.batch?.([
        { op: "create", collection: "a", data: { id: "2", v: 2 } },
        { op: "update", collection: "a", id: "1", data: { v: 9 } },
        { op: "remove", collection: "a", id: "finns-inte" },
      ]),
    ).rejects.toThrow(/finns inte/);
    expect(await minne.list("a")).toEqual([{ id: "1", v: 1 }]);
  });

  it("en batch som går igenom skriver alla, i ordning, och svarar med posterna", async () => {
    const minne = createMemorySource({ a: [{ id: "1", v: 1 }] });
    const svar = await minne.batch?.([
      { op: "create", collection: "a", data: { id: "2", v: 2 } },
      { op: "update", collection: "a", id: "1", data: { v: 9 } },
      { op: "remove", collection: "a", id: "2" },
    ]);
    expect(svar).toEqual([{ id: "2", v: 2 }, { id: "1", v: 9 }, null]);
    expect(await minne.list("a")).toEqual([{ id: "1", v: 9 }]);
  });

  it("en tom batch är ett fel, inte en lyckad", async () => {
    await expect(createMemorySource().batch?.([])).rejects.toThrow(/minst en skrivning/);
  });
});

describe("⛔ inbjudningarna vid skapandet: efter commit, best effort, ett svar med allt", () => {
  it("en adress med konto blir medlemskap direkt, en utan blir en väntande inbjudan, med rollerna", async () => {
    const { tjanst, kalla } = bygg({ users: [{ id: "uid-kollega", epost: "kollega@example.com", namn: "Kollega" }] });
    const svar = await skapa(tjanst, { inbjudningar: [{ epost: "Kollega@Example.com", roll: "admin" }, { epost: "ny@example.com" }] });

    expect(svar.tillagda).toEqual(["kollega@example.com"]);
    expect(svar.inbjudna).toEqual(["ny@example.com"]);
    expect(svar.fel).toEqual([]);
    expect(await kalla.read("memberships", medlemskapsId("uid-kollega", svar.groupId))).toMatchObject({ roll: "admin", status: "aktiv", namn: "Kollega" });
    const inb = await kalla.list("invitations");
    expect(inb).toHaveLength(1);
    expect(inb[0]).toMatchObject({ epost: "ny@example.com", groupId: svar.groupId, roll: "medlem", status: "vantar" });
  });

  it("⛔ tomhet är ett svar: utan inbjudningar är alla tre listorna tomma, inte utelämnade", async () => {
    const { tjanst } = bygg();
    const svar = await skapa(tjanst);
    expect(svar).toEqual({ groupId: expect.any(String), tillagda: [], inbjudna: [], fel: [] });
  });

  it("skaparens egen adress och dubbletter tas bort tyst, inte som fel", async () => {
    const { tjanst, kalla } = bygg();
    const svar = await skapa(tjanst, { inbjudningar: [{ epost: EPOST }, { epost: "ny@example.com" }, { epost: "NY@example.com" }] });
    expect(svar.inbjudna).toEqual(["ny@example.com"]);
    expect(svar.fel).toEqual([]);
    expect(await kalla.list("invitations")).toHaveLength(1);
  });

  it("⛔ en inbjudan som faller gör INTE att gruppen faller, och felet säger vilken adress och varför", async () => {
    const { kalla, minne } = (() => {
      const m = createMemorySource({ vitlista: [{ id: EPOST, epost: EPOST, tillagdAv: {}, tid: "x" }], memberships: [], groups: [], users: [], invitations: [] });
      return {
        minne: m,
        kalla: /** @type {any} */ ({
          ...m,
          create: async (/** @type {string} */ c, /** @type {any} */ d) => {
            if (c === "invitations" && d.epost === "trasig@example.com") throw new Error("nätverket föll");
            return m.create(c, d);
          },
        }),
      };
    })();
    const tjanst = createGroupService({ kalla });
    const svar = await skapa(tjanst, { inbjudningar: [{ epost: "trasig@example.com" }, { epost: "hel@example.com" }] });
    expect(await minne.read("groups", svar.groupId)).toBeTruthy();
    expect(svar.inbjudna).toEqual(["hel@example.com"]);
    expect(svar.fel).toEqual([{ epost: "trasig@example.com", fel: "nätverket föll" }]);
  });

  it("⛔ en adress som inte är en adress kastar FÖRE första skrivningen", async () => {
    const { tjanst, kalla } = bygg();
    await expect(skapa(tjanst, { inbjudningar: [{ epost: "ny@example.com" }, { epost: "inte-en-adress" }] })).rejects.toThrow(/"inte-en-adress" är inte en e-postadress. Inget har skrivits/);
    expect(await kalla.list("groups")).toEqual([]);
    expect(await kalla.list("invitations")).toEqual([]);
  });

  it("⛔ rollen agare går inte att bjuda in till vid skapandet", async () => {
    const { tjanst, kalla } = bygg();
    await expect(skapa(tjanst, { inbjudningar: [{ epost: "ny@example.com", roll: "agare" }] })).rejects.toThrow(/rollen "agare"/);
    expect(await kalla.list("groups")).toEqual([]);
  });
});

describe("⛔ kraven på indata", () => {
  it("uid krävs", async () => {
    const { tjanst } = bygg();
    await expect(tjanst.skapaGrupp({ uid: "", epost: EPOST, grupp: { namn: "X" } })).rejects.toThrow(/uid krävs/);
  });

  it("epost krävs", async () => {
    const { tjanst } = bygg();
    await expect(tjanst.skapaGrupp({ uid: UID, epost: "", grupp: { namn: "X" } })).rejects.toThrow(/epost krävs/);
  });

  it("grupp krävs", async () => {
    const { tjanst } = bygg();
    await expect(tjanst.skapaGrupp({ uid: UID, epost: EPOST })).rejects.toThrow(/grupp krävs/);
  });

  it("namn krävs, också som tomt Namn", async () => {
    const { tjanst } = bygg();
    await expect(skapa(tjanst, {}, { namn: "" })).rejects.toThrow(/namn krävs/);
    await expect(skapa(tjanst, {}, { namn: { sv: "  ", en: "x" } })).rejects.toThrow(/namn krävs/);
  });

  it("⛔ createGroupService kräver en datakälla med read, list och create", () => {
    expect(() => createGroupService({ kalla: /** @type {any} */ ({}) })).toThrow(
      /createGroupService: en datakälla med read, list och create krävs/,
    );
  });

  it("⛔ createGroupService kräver batch: en källa utan den avvisas när tjänsten byggs, inte när första gruppen skapas", () => {
    const utanBatch = /** @type {any} */ ({ ...createMemorySource(), batch: undefined });
    expect(() => createGroupService({ kalla: utanBatch })).toThrow(/datakällan saknar batch/);
  });
});

describe("⛔ katalogerna seedas för den nya gruppen, efter commit, bara när appen anger dem (#162)", () => {
  it("skriver gruppens kategorier med groupId efter gruppen och ägaren", async () => {
    const { kalla } = bygg();
    const tjanst = createGroupService({
      kalla,
      kataloger: { handelsetyper: [{ id: "mote", namn: { sv: "Möte", en: "Meeting" }, farg: 1, ikon: "check", fas: "aktiv", ordning: 0 }] },
    });
    const svar = await skapa(tjanst);
    const rader = await kalla.list("handelsetyper", {});
    expect(rader).toHaveLength(1);
    expect(rader[0].groupId).toBe(svar.groupId);
    expect(rader[0].id).toBe(`${svar.groupId}|mote`); // den lagrade nyckeln, `groupId|id` (#162), inte ett andra id-fält
  });

  it("utan kataloger seedas ingenting, och ingen tom samling skapas", async () => {
    const { kalla, tjanst } = bygg();
    await skapa(tjanst);
    expect(await kalla.list("handelsetyper", {})).toHaveLength(0);
  });
});
