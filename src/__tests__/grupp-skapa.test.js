import { describe, it, expect } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { createGroupService } from "../node/grupp.js";
import { createCatalogSource } from "../data/katalogkalla.js";
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

describe("⛔ katalogerna seedas I SAMMA BATCH som gruppen, bara när appen anger dem (#162, 0.33.0)", () => {
  const HANDELSETYPER = [
    { id: "mote", namn: { sv: "Möte", en: "Meeting" }, farg: 1, ikon: "check", fas: "aktiv", ordning: 0 },
    { id: "resa", namn: { sv: "Resa", en: "Trip" }, farg: 2, ikon: "check", fas: "aktiv", ordning: 1 },
  ];
  const SORTER = { standard: [{ id: "kvitto", namn: { sv: "Kvitto" }, ikon: "check" }], faser: false, farger: false };

  it("skriver gruppens kategorier med groupId, i samma batch som gruppen och ägaren", async () => {
    const { kalla } = bygg();
    /** @type {any[][]} */
    const batcher = [];
    const raknande = /** @type {any} */ ({ ...kalla, batch: async (/** @type {any[]} */ ops) => { batcher.push(ops); return kalla.batch?.(ops); } });
    const tjanst = createGroupService({ kalla: raknande, kataloger: { handelsetyper: HANDELSETYPER, sorter: SORTER } });
    const svar = await skapa(tjanst);
    const rader = await kalla.list("handelsetyper", {});
    expect(rader).toHaveLength(2);
    expect(rader.every((r) => r.groupId === svar.groupId)).toBe(true);
    expect(rader.map((r) => r.id).sort()).toEqual([`${svar.groupId}|mote`, `${svar.groupId}|resa`]);
    // ⛔ EN batch med allt: grupp, medlemskap, två händelsetyper och en sort. Röd mot 0.32.1, där
    // katalogerna skrevs med create, en i taget, efter att batchen redan gått igenom.
    expect(batcher).toHaveLength(1);
    expect(batcher[0].map((o) => o.collection)).toEqual(["groups", "memberships", "handelsetyper", "handelsetyper", "sorter"]);
  });

  it("⛔ en nyskapad grupp har standardvärdena på plats innan första vyn ritas: katalogkällan läser dem ur databasen, inte ur reserven", async () => {
    const { kalla } = bygg();
    const tjanst = createGroupService({ kalla, kataloger: { handelsetyper: HANDELSETYPER } });
    const svar = await skapa(tjanst);
    // Den väg en vy läser med, direkt efter att skapaGrupp svarat. "databas" och inte "reserv" eller tom.
    const las = await createCatalogSource({ source: kalla, collection: "handelsetyper", groupId: svar.groupId, standard: HANDELSETYPER }).las();
    expect(las.kalla).toBe("databas");
    expect(las.kategorier.map((k) => k.id)).toEqual(["mote", "resa"]);
  });

  it("⛔ ALLT ELLER INGET: faller batchen finns varken grupp, ägare eller en enda kategori", async () => {
    const minne = createMemorySource({ vitlista: [{ id: EPOST, epost: EPOST, tillagdAv: {}, tid: "x" }], memberships: [], groups: [], users: [], invitations: [] });
    // Varje skrivning till katalogen faller, vare sig den går i batchen eller som en egen create. Minnesadapterns
    // batch återställer då hela lagret. Röd mot 0.32.1: där gick batchen (grupp, ägare) igenom FÖRST, och
    // seedningen efteråt föll, så gruppen stod kvar utan kataloger.
    const trasigKatalog = (/** @type {any} */ o) => (o.collection === "handelsetyper" ? { op: "update", collection: "handelsetyper", id: "finns-inte", data: {} } : o);
    const kalla = /** @type {any} */ ({
      ...minne,
      create: async (/** @type {string} */ c, /** @type {any} */ d) => {
        if (c === "handelsetyper") throw new Error("skrivningen av katalogen föll");
        return minne.create(c, d);
      },
      batch: async (/** @type {any[]} */ ops) => minne.batch?.(ops.map(trasigKatalog)),
    });
    const tjanst = createGroupService({ kalla, kataloger: { handelsetyper: HANDELSETYPER } });
    await expect(skapa(tjanst)).rejects.toThrow();
    expect(await minne.list("groups")).toEqual([]);
    expect(await minne.list("memberships")).toEqual([]);
    expect(await minne.list("handelsetyper")).toEqual([]);
  });

  it("⛔ en trasig standardkategori stoppar tjänsten när den BYGGS, inte när någon skapar en grupp", () => {
    const { kalla } = bygg();
    expect(() => createGroupService({ kalla, kataloger: { handelsetyper: [{ id: "Trasig Nyckel", namn: { sv: "X" }, farg: 1, ikon: "check", fas: "aktiv" }] } })).toThrow(/små bokstäver/);
  });

  it("en andra grupp får sina EGNA kataloger bredvid den förstas, i samma samling", async () => {
    const { kalla } = bygg();
    const tjanst = createGroupService({ kalla, kataloger: { handelsetyper: HANDELSETYPER } });
    const a = await skapa(tjanst, {}, { namn: "Första" });
    const b = await skapa(tjanst, {}, { namn: "Andra" });
    const rader = await kalla.list("handelsetyper", {});
    expect(rader).toHaveLength(4);
    expect(rader.filter((r) => r.groupId === a.groupId)).toHaveLength(2);
    expect(rader.filter((r) => r.groupId === b.groupId)).toHaveLength(2);
  });

  it("utan kataloger seedas ingenting, och ingen tom samling skapas", async () => {
    const { kalla, tjanst } = bygg();
    await skapa(tjanst);
    expect(await kalla.list("handelsetyper", {})).toHaveLength(0);
  });
});

/**
 * ⛔ DEN FÖRSTA EGNA GRUPPEN OCH APPARNA EN NY GRUPP BÖRJAR MED (0.51.0, cllp/lifehub.app#21).
 *
 * CP 2026-10-04: "Saknar man grupp ska man kunna skapa en egen ... Första gruppen är gratis, utan prenumeration och utan
 * paywall." Varje prov nedan som släpper igenom någon utan vitlista har ett motprov som visar att samma person nekas
 * när valet är av eller när hen redan äger en grupp: annars mäter provet bara att en dörr står öppen.
 */
describe("⛔ forstaGruppenFri: den första egna gruppen utan vitlista (0.51.0)", () => {
  const fri = (/** @type {any} */ seed = {}, /** @type {any} */ extra = {}) => {
    const kalla = createMemorySource({ vitlista: [], memberships: seed.memberships ?? [], groups: [], users: seed.users ?? [], invitations: [] });
    return { kalla, tjanst: createGroupService({ kalla, forstaGruppenFri: true, ...extra }) };
  };

  it("den som aldrig ägt en grupp skapar sin första, utan vitlista och utan e-post, och blir ägare", async () => {
    const { kalla, tjanst } = fri();
    const svar = await tjanst.skapaGrupp({ uid: UID, epost: "", namn: "Prov Person", grupp: { namn: "Mitt projekt" } });
    const grupp = await kalla.read("groups", svar.groupId);
    expect(grupp.namn).toEqual({ sv: "Mitt projekt", en: "Mitt projekt" });
    const agare = await kalla.read("memberships", medlemskapsId(UID, svar.groupId));
    expect(agare).toMatchObject({ roll: "agare", status: "aktiv", namn: "Prov Person" });
    expect(grupp.skapadAv).toMatchObject({ uid: UID, namn: "Prov Person" });
  });

  it("⛔ motprov: samma person utan forstaGruppenFri nekas, och ingenting skrivs", async () => {
    const kalla = createMemorySource({ vitlista: [], memberships: [], groups: [], users: [], invitations: [] });
    const tjanst = createGroupService({ kalla });
    await expect(tjanst.skapaGrupp({ uid: UID, epost: "privat@example.com", grupp: { namn: "Mitt projekt" } })).rejects.toThrow(/står inte på vitlistan/);
    await expect(tjanst.skapaGrupp({ uid: UID, epost: "", grupp: { namn: "Mitt projekt" } })).rejects.toThrow(/epost krävs/);
    expect(await kalla.list("groups")).toEqual([]);
  });

  it("⛔ den andra gruppen går genom vitlistan: den som äger en grupp nekas utan vitlistning", async () => {
    const { kalla, tjanst } = fri();
    await tjanst.skapaGrupp({ uid: UID, epost: "privat@example.com", grupp: { namn: "Mitt projekt" } });
    await expect(tjanst.skapaGrupp({ uid: UID, epost: "privat@example.com", grupp: { namn: "Ett till" } })).rejects.toThrow(/står inte på vitlistan/);
    await expect(tjanst.skapaGrupp({ uid: UID, epost: "", grupp: { namn: "Ett till" } })).rejects.toThrow(/epost krävs/);
    expect((await kalla.list("groups")).length).toBe(1);
  });

  it("⛔ ett AVSLUTAT ägarskap räknas: den fria gruppen går inte att få två gånger genom att lämna den första", async () => {
    const { tjanst } = fri({ memberships: [{ id: `${UID}|gammal`, userId: UID, groupId: "gammal", roll: "agare", typ: "person", status: "avslutad" }] });
    await expect(tjanst.skapaGrupp({ uid: UID, epost: "", grupp: { namn: "Mitt projekt" } })).rejects.toThrow(/epost krävs/);
  });

  it("att vara MEDLEM i någon annans grupp hindrar inte den första egna", async () => {
    const { tjanst } = fri({ memberships: [{ id: `${UID}|annan`, userId: UID, groupId: "annan", roll: "medlem", typ: "person", status: "aktiv" }] });
    expect((await tjanst.skapaGrupp({ uid: UID, epost: "", grupp: { namn: "Mitt projekt" } })).groupId).toBeTruthy();
  });

  it("den vitlistade som redan äger grupper skapar fler, som förut", async () => {
    const kalla = createMemorySource({
      vitlista: [{ id: EPOST, epost: EPOST, tillagdAv: {}, tid: "x" }],
      memberships: [{ id: `${UID}|bolaget`, userId: UID, groupId: "bolaget", roll: "agare", typ: "person", status: "aktiv" }],
      groups: [],
      users: [],
      invitations: [],
    });
    const tjanst = createGroupService({ kalla, forstaGruppenFri: true });
    expect((await tjanst.skapaGrupp({ uid: UID, epost: EPOST, grupp: { namn: "Andra" } })).groupId).toBeTruthy();
  });

  it("⛔ forstaGruppenFri som inte är true eller false avvisas när tjänsten byggs", () => {
    const kalla = createMemorySource({});
    expect(() => createGroupService({ kalla, forstaGruppenFri: /** @type {any} */ ("ja") })).toThrow(/forstaGruppenFri/);
  });
});

/**
 * ⛔ VITLISTAN GÅR ATT STÄNGA AV (0.59.0). `forstaGruppenFri` betyder fortfarande bara den första egna gruppen
 * när vitlistan krävs, och det är vad proven ovan låser. Här låses det andra: appen kan slå av kravet tills
 * betalning finns, och då skapas både den första och de följande utan vitlista och utan e-post.
 */
describe("⛔ vitlistaKravs: vitlistan går att stänga av (0.59.0)", () => {
  it("första och vidare grupper skapas utan vitlista och utan e-post, också efter ett avslutat ägarskap", async () => {
    const kalla = createMemorySource({
      vitlista: [],
      memberships: [{ id: `${UID}|gammal`, userId: UID, groupId: "gammal", roll: "agare", typ: "person", status: "avslutad" }],
      groups: [],
      users: [],
      invitations: [],
    });
    /** @type {string[]} */
    const lasningar = [];
    const original = kalla.read.bind(kalla);
    kalla.read = async (samling, id) => {
      lasningar.push(samling);
      return original(samling, id);
    };
    const tjanst = createGroupService({ kalla, vitlistaKravs: false, forstaGruppenFri: true });
    const a = await tjanst.skapaGrupp({ uid: UID, epost: "", grupp: { namn: "Travel" } });
    const b = await tjanst.skapaGrupp({ uid: UID, epost: "", grupp: { namn: "Ett till" } });
    expect(a.groupId).toBeTruthy();
    expect(b.groupId).not.toBe(a.groupId);
    expect((await kalla.list("groups")).length).toBe(2);
    expect(lasningar).not.toContain("vitlista");
  });

  it("⛔ motprov: förvalet kräver fortfarande vitlistan för den som redan äger en grupp", async () => {
    const kalla = createMemorySource({
      vitlista: [],
      memberships: [{ id: `${UID}|bolaget`, userId: UID, groupId: "bolaget", roll: "agare", typ: "person", status: "aktiv" }],
      groups: [],
      users: [],
      invitations: [],
    });
    const tjanst = createGroupService({ kalla, forstaGruppenFri: true });
    await expect(tjanst.skapaGrupp({ uid: UID, epost: "", grupp: { namn: "Ett till" } })).rejects.toThrow(/epost krävs/);
    expect(await kalla.list("groups")).toEqual([]);
  });

  it("⛔ vitlistaKravs som inte är true eller false avvisas när tjänsten byggs", () => {
    const kalla = createMemorySource({});
    expect(() => createGroupService({ kalla, vitlistaKravs: /** @type {any} */ ("nej") })).toThrow(/vitlistaKravs/);
  });
});

describe("⛔ moduler: apparna en ny grupp börjar med (0.51.0)", () => {
  it("en ny grupp får appens förvalda appar", async () => {
    const { kalla } = bygg();
    const tjanst = createGroupService({ kalla, moduler: ["ekonomi"] });
    const svar = await tjanst.skapaGrupp({ uid: UID, epost: EPOST, grupp: { namn: "Mitt projekt" } });
    expect((await kalla.read("groups", svar.groupId)).moduler).toEqual(["ekonomi"]);
  });

  it("utan moduler börjar gruppen tom, som förut", async () => {
    const { kalla, tjanst } = bygg();
    const svar = await tjanst.skapaGrupp({ uid: UID, epost: EPOST, grupp: { namn: "Tom" } });
    expect((await kalla.read("groups", svar.groupId)).moduler).toEqual([]);
  });

  it("⛔ ett felstavat modul-id avvisas när tjänsten byggs, inte när någon skapar en grupp", () => {
    const kalla = createMemorySource({});
    const medBatch = { ...kalla, batch: async () => [] };
    expect(() => createGroupService({ kalla: medBatch, moduler: ["Ekonomi!"] })).toThrow(/moduler\[0\]/);
    expect(() => createGroupService({ kalla: medBatch, moduler: /** @type {any} */ ("ekonomi") })).toThrow(/moduler måste vara en lista/);
  });
});
