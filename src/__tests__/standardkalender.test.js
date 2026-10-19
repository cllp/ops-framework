import { describe, it, expect } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { createGroupService } from "../node/grupp.js";
import { createStandardkalenderService } from "../node/standardkalender.js";
import { KALENDERFALT, STANDARDKALENDER_ID, byggGruppkalender, forvaldKalender, validateGruppkalendrar } from "../lib/kalendrar.js";

/**
 * 0.120.0 (cllp/lifehub.app#367): varje grupp har en standardkalender.
 *
 * ⛔ Händelsen: en ny grupp hade inga namngivna kalendrar ("gruppen är kalendern", #309), och förvalet för en ny händelse föll då på
 * personens egen kalender. Provet läser BATCHEN som `skapaGrupp` skriver och raderna som engångssteget lämnar efter sig, inte källan
 * efter funktionsnamn (arbetsreglernas punkt 4, närvarogrep). Utan fixen finns varken optionen eller tjänsten, och proven är röda.
 */

const UID = "uid-vitlistad";
const EPOST = "vitlistad@example.com";

const bygg = (/** @type {object} */ konfig = {}) => {
  const kalla = createMemorySource({
    vitlista: [{ id: EPOST, epost: EPOST, tillagdAv: {}, tid: "x" }],
    memberships: [],
    groups: [],
    users: [],
    invitations: [],
    gruppkalendrar: [],
  });
  /** @type {any[][]} */
  const batcher = [];
  const raknande = /** @type {any} */ ({ ...kalla, batch: async (/** @type {any[]} */ ops) => { batcher.push(ops); return kalla.batch?.(ops); } });
  return { kalla, batcher, tjanst: createGroupService({ kalla: raknande, ...konfig }) };
};
const skapa = (/** @type {any} */ tjanst, namn = "Mitt bolag") => tjanst.skapaGrupp({ uid: UID, epost: EPOST, grupp: { namn } });

describe("⛔ en ny grupp får exakt en standardkalender, i samma batch (#367)", () => {
  it("batchen har exakt en gruppkalendrar-rad, med nyckeln groupId|kalender, och den går genom läsvägen", async () => {
    const { kalla, batcher, tjanst } = bygg({ standardkalender: true });
    const svar = await skapa(tjanst);
    expect(batcher).toHaveLength(1);
    const kalenderOps = batcher[0].filter((o) => o.collection === "gruppkalendrar");
    expect(kalenderOps).toHaveLength(1);
    expect(batcher[0].map((o) => o.collection)).toEqual(["groups", "memberships", "gruppkalendrar"]);
    const rad = kalenderOps[0].data;
    expect(rad.id).toBe(`${svar.groupId}|${STANDARDKALENDER_ID}`);
    expect(rad).toMatchObject({ groupId: svar.groupId, namn: { sv: "Kalender", en: "Calendar" }, arkiverad: false, forvald: false });
    expect(Object.keys(rad).every((k) => KALENDERFALT.includes(k))).toBe(true);
    // Samma läsning som kalendervyn: raden validerar, och är gruppens förvalda utan att bära `forvald`.
    const lasta = validateGruppkalendrar((await kalla.list("gruppkalendrar", { where: { groupId: svar.groupId } })).map((r) => ({ ...r, id: r.id.split("|")[1] })));
    expect(lasta).toHaveLength(1);
    expect(forvaldKalender(lasta)?.id).toBe("kalender");
  });

  it("två grupper får var sin kalender, med var sin nyckel", async () => {
    const { kalla, tjanst } = bygg({ standardkalender: true });
    const a = await tjanst.skapaGrupp({ uid: "uid-a", epost: EPOST, grupp: { namn: "Alfa" } });
    const b = await tjanst.skapaGrupp({ uid: "uid-b", epost: EPOST, grupp: { namn: "Beta" } });
    const rader = await kalla.list("gruppkalendrar", {});
    expect(rader.map((r) => r.id).sort()).toEqual([`${a.groupId}|kalender`, `${b.groupId}|kalender`].sort());
  });

  it("samlingens namn skickas in, och ramverket skriver i den appen anger", async () => {
    const { kalla, tjanst } = bygg({ standardkalender: true, samlingar: { gruppkalendrar: "kalendrar_x" } });
    await skapa(tjanst);
    expect(await kalla.list("kalendrar_x", {})).toHaveLength(1);
    expect(await kalla.list("gruppkalendrar", {})).toHaveLength(0);
  });

  it("utan optionen är det som förut: ingen kalenderrad (en app som inte säger något beter sig som förut)", async () => {
    const { kalla, batcher, tjanst } = bygg();
    await skapa(tjanst);
    expect(batcher[0].map((o) => o.collection)).toEqual(["groups", "memberships"]);
    expect(await kalla.list("gruppkalendrar", {})).toEqual([]);
  });

  it("⛔ ALLT ELLER INGET: faller kalenderskrivningen finns varken grupp, ägare eller kalender", async () => {
    const minne = createMemorySource({ vitlista: [{ id: EPOST, epost: EPOST, tillagdAv: {}, tid: "x" }], memberships: [], groups: [], users: [], invitations: [], gruppkalendrar: [] });
    const trasig = (/** @type {any} */ o) => (o.collection === "gruppkalendrar" ? { op: "update", collection: "gruppkalendrar", id: "finns-inte", data: {} } : o);
    const kalla = /** @type {any} */ ({ ...minne, batch: async (/** @type {any[]} */ ops) => minne.batch?.(ops.map(trasig)) });
    const tjanst = createGroupService({ kalla, standardkalender: true });
    await expect(skapa(tjanst)).rejects.toThrow();
    expect(await minne.list("groups")).toEqual([]);
    expect(await minne.list("memberships")).toEqual([]);
    expect(await minne.list("gruppkalendrar")).toEqual([]);
  });

  it("standardkalender måste vara true eller false, när tjänsten byggs", () => {
    expect(() => createGroupService({ kalla: createMemorySource(), standardkalender: /** @type {any} */ ("ja") })).toThrow(/standardkalender måste vara true eller false/);
  });
});

describe("⛔ sakerstallStandardkalender: idempotent, och rör ingen som redan har en kalender (#367)", () => {
  const kal = (/** @type {string} */ groupId, /** @type {string} */ id, /** @type {boolean} */ arkiverad = false) => ({
    ...byggGruppkalender({ id, namn: { sv: id }, farg: 3, ikon: "kalender", groupId, arkiverad }),
    id: `${groupId}|${id}`,
  });
  const grupper = ["utan", "aktiv", "arkiverad", "kapplopare"].map((id) => ({ id }));
  const bygger = (/** @type {any[]} */ kalendrar = [kal("aktiv", "styrelse"), kal("arkiverad", "gammal", true)]) => {
    const kalla = createMemorySource({ groups: grupper, gruppkalendrar: kalendrar });
    return { kalla, tjanst: createStandardkalenderService({ kalla }) };
  };

  it("tre lägen på fyra grupper: finns, bara arkiverade, saknas, och en skarp körning skriver exakt en rad", async () => {
    const { kalla, tjanst } = bygger();
    expect(await tjanst.sakerstallStandardkalender({ groupId: "aktiv", skarpt: true })).toBe("finns");
    expect(await tjanst.sakerstallStandardkalender({ groupId: "arkiverad", skarpt: true })).toBe("bara_arkiverade");
    expect(await tjanst.sakerstallStandardkalender({ groupId: "utan", skarpt: false })).toBe("saknas");
    expect(await kalla.list("gruppkalendrar", {})).toHaveLength(2); // torrt skrev ingenting
    expect(await tjanst.sakerstallStandardkalender({ groupId: "utan", skarpt: true })).toBe("skapad");
    const rader = await kalla.list("gruppkalendrar", {});
    expect(rader).toHaveLength(3);
    expect(rader.find((r) => r.groupId === "utan")).toMatchObject({ id: "utan|kalender", forvald: false, arkiverad: false });
    // Den arkiverades val rördes inte: ingen ny kalender åt en grupp där en admin arkiverat allt.
    expect(rader.filter((r) => r.groupId === "arkiverad")).toHaveLength(1);
  });

  it("andra körningen skriver ingenting: skapad blir finns", async () => {
    const { kalla, tjanst } = bygger();
    expect(await tjanst.sakerstallStandardkalender({ groupId: "utan", skarpt: true })).toBe("skapad");
    const efterForsta = await kalla.list("gruppkalendrar", {});
    expect(await tjanst.sakerstallStandardkalender({ groupId: "utan", skarpt: true })).toBe("finns");
    expect(await kalla.list("gruppkalendrar", {})).toEqual(efterForsta);
  });

  it("⛔ en kapplöpare som hunnit skapa `kalender` mellan läsningen och skrivningen skrivs inte över", async () => {
    const { kalla } = bygger();
    // Läsningen ser ingen rad, och raden dyker upp före skrivningen: createNew avvisar, svaret är `finns`.
    const lasning = /** @type {any} */ ({
      ...kalla,
      list: async (/** @type {string} */ c, /** @type {any} */ q) => {
        const svar = await kalla.list(c, q);
        if (c === "gruppkalendrar" && q?.where?.groupId === "kapplopare") await kalla.create("gruppkalendrar", { ...kal("kapplopare", "kalender"), namn: { sv: "Min egen", en: "Min egen" } });
        return svar;
      },
      createNew: (/** @type {string} */ c, /** @type {any} */ d) => kalla.createNew?.(c, d),
    });
    const tjanst = createStandardkalenderService({ kalla: lasning });
    expect(await tjanst.sakerstallStandardkalender({ groupId: "kapplopare", skarpt: true })).toBe("finns");
    const rad = await kalla.read("gruppkalendrar", "kapplopare|kalender");
    expect(rad.namn.sv).toBe("Min egen");
  });

  it("sakerstallAlla rapporterar alla siffror, också de som är noll, och ett fel stoppar inte de andra", async () => {
    const { kalla, tjanst } = bygger();
    // Golv (arbetsreglernas punkt 4, tomt underlag): minst fyra grupper lästa.
    const torr = await tjanst.sakerstallAlla({ skarpt: false });
    expect(torr).toEqual({ skarpt: false, lasta: 4, finns: 1, saknas: 2, skapade: 0, bara_arkiverade: ["arkiverad"], fel: [] });
    expect(await kalla.list("gruppkalendrar", {})).toHaveLength(2);
    const skarp = await tjanst.sakerstallAlla({ skarpt: true });
    expect(skarp).toEqual({ skarpt: true, lasta: 4, finns: 1, saknas: 0, skapade: 2, bara_arkiverade: ["arkiverad"], fel: [] });
    const ny = await tjanst.sakerstallAlla({ skarpt: true });
    expect(ny).toEqual({ skarpt: true, lasta: 4, finns: 3, saknas: 0, skapade: 0, bara_arkiverade: ["arkiverad"], fel: [] });

    const trasig = /** @type {any} */ ({ ...kalla, createNew: async () => { throw new Error("skrivningen föll"); }, list: async (/** @type {string} */ c, /** @type {any} */ q) => (c === "groups" ? [{ id: "ny-utan" }, { id: "Fel Id" }] : kalla.list(c, q)) });
    const med = await createStandardkalenderService({ kalla: trasig }).sakerstallAlla({ skarpt: true });
    expect(med.lasta).toBe(2);
    expect(med.skapade).toBe(0);
    expect(med.fel.map((f) => f.groupId)).toEqual(["ny-utan", "Fel Id"]);
    expect(med.fel[0].fel).toMatch(/skrivningen föll/);
  });

  it("skarpt måste anges, och en källa utan createNew nekas när tjänsten byggs", async () => {
    const { tjanst, kalla } = bygger();
    await expect(tjanst.sakerstallStandardkalender(/** @type {any} */ ({ groupId: "utan" }))).rejects.toThrow(/skarpt måste vara true eller false/);
    await expect(tjanst.sakerstallAlla(/** @type {any} */ ({}))).rejects.toThrow(/skarpt måste vara true eller false/);
    await expect(tjanst.sakerstallStandardkalender({ groupId: "", skarpt: false })).rejects.toThrow(/groupId krävs/);
    const { createNew: _bort, ...utan } = kalla;
    expect(() => createStandardkalenderService({ kalla: /** @type {any} */ (utan) })).toThrow(/saknar createNew/);
  });
});
