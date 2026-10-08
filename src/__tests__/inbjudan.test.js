import { describe, it, expect, vi } from "vitest";
import { medlemskapsId } from "../lib/grupp.js";
import { createMemorySource } from "../data/adapters.js";
import { createInvitationService, inbjudningsId } from "../node/inbjudan.js";

/**
 * Fas 2.5: inbjudan och acceptans (#137).
 *
 * ⛔ UTAN NÄTVERK. Datakällan skickas in, alltså räcker minneskällan. Samma
 * mönster som `skapaArende` i bolag-ops, och det är hela skälet att källan är
 * en parameter: en callable som bara går att prova mot en riktig databas blir
 * inte provad.
 */

const AGARE = "uid-agare";
const MEDLEM = "uid-medlem";
const GRUPP = "bolaget";

const bygg = (/** @type {{users?: any[], memberships?: any[], invitations?: any[]}} */ seed = {}) => {
  const kalla = createMemorySource({
    users: seed.users ?? [],
    memberships: seed.memberships ?? [
      { id: medlemskapsId(AGARE, GRUPP), userId: AGARE, groupId: GRUPP, roll: "agare", typ: "person", status: "aktiv" },
    ],
    invitations: seed.invitations ?? [],
  });
  return { kalla, tjanst: createInvitationService({ kalla }) };
};

describe("⛔ ägarskapet kontrolleras i funktionen, inte bara i reglerna", () => {
  it("en medlem får inte bjuda in", async () => {
    const { tjanst, kalla } = bygg();
    await kalla.create("memberships", { id: medlemskapsId(MEDLEM, GRUPP), userId: MEDLEM, groupId: GRUPP, roll: "medlem", typ: "person", status: "aktiv" });
    await expect(tjanst.bjudIn({ avUid: MEDLEM, groupId: GRUPP, epost: "ny@x.se" })).rejects.toThrow(
      /uid-medlem är inte aktiv ägare eller admin i gruppen "bolaget"/,
    );
  });

  it("en utomstående får inte bjuda in", async () => {
    const { tjanst } = bygg();
    await expect(tjanst.bjudIn({ avUid: "uid-frammande", groupId: GRUPP, epost: "ny@x.se" })).rejects.toThrow(/inte aktiv ägare/);
  });

  it("en avslutad ägare får inte bjuda in", async () => {
    const { tjanst } = bygg({
      memberships: [{ id: medlemskapsId(AGARE, GRUPP), userId: AGARE, groupId: GRUPP, roll: "agare", typ: "person", status: "avslutad" }],
    });
    await expect(tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se" })).rejects.toThrow(/inte aktiv ägare/);
  });

  it("⛔ en admin får bjuda in till medlem och admin (0.32.0, #180)", async () => {
    const { tjanst, kalla } = bygg();
    await kalla.create("memberships", { id: medlemskapsId("uid-admin", GRUPP), userId: "uid-admin", groupId: GRUPP, roll: "admin", typ: "person", status: "aktiv" });
    expect((await tjanst.bjudIn({ avUid: "uid-admin", groupId: GRUPP, epost: "a@x.se" })).resultat).toBe("inbjudan");
    expect((await tjanst.bjudIn({ avUid: "uid-admin", groupId: GRUPP, epost: "b@x.se", roll: "admin" })).resultat).toBe("inbjudan");
  });

  it("⛔ en admin får INTE bjuda in till rollen agare, och inget skrivs", async () => {
    const { tjanst, kalla } = bygg();
    await kalla.create("memberships", { id: medlemskapsId("uid-admin", GRUPP), userId: "uid-admin", groupId: GRUPP, roll: "admin", typ: "person", status: "aktiv" });
    await expect(tjanst.bjudIn({ avUid: "uid-admin", groupId: GRUPP, epost: "c@x.se", roll: "agare" })).rejects.toThrow(/får inte bjuda in till rollen agare/);
    expect(await kalla.list("invitations", {})).toHaveLength(0);
  });

  it("ägaren får", async () => {
    const { tjanst } = bygg();
    await expect(tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se" })).resolves.toMatchObject({ resultat: "inbjudan" });
  });
});

describe("bjudIn", () => {
  it("skriver en inbjudan när personen inte finns", async () => {
    const { tjanst, kalla } = bygg();
    const svar = await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "Ny@Example.com" });
    expect(svar.resultat).toBe("inbjudan");
    const rader = await kalla.list("invitations", {});
    expect(rader).toHaveLength(1);
    // ⛔ Gemener, annars matchar acceptansen inte.
    expect(rader[0]).toMatchObject({ epost: "ny@example.com", groupId: GRUPP, status: "vantar" });
  });

  it("⛔ skriver medlemskapet DIREKT när personen redan finns", async () => {
    const { tjanst, kalla } = bygg({ users: [{ id: MEDLEM, epost: "finns@x.se" }] });
    const svar = await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "finns@x.se" });
    expect(svar).toEqual({ resultat: "medlemskap", id: medlemskapsId(MEDLEM, GRUPP) });
    expect(await kalla.read("memberships", medlemskapsId(MEDLEM, GRUPP))).toMatchObject({ roll: "medlem", status: "aktiv" });
    expect(await kalla.list("invitations", {})).toHaveLength(0);
  });

  it("ett andra klick skapar ingen andra rad, och säger att man skickar om i stället (0.80.1)", async () => {
    const { tjanst, kalla } = bygg();
    const ett = await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se" });
    expect(ett).toEqual({ resultat: "inbjudan", id: inbjudningsId(GRUPP, "ny@x.se"), ateroppnad: false });
    await expect(tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se" })).rejects.toThrow(/redan en väntande inbjudan.*Skicka om den i stället/);
    expect(await kalla.list("invitations", {})).toHaveLength(1);
  });

  it("en som redan är medlem ger fanns, inte en dubblett", async () => {
    const { tjanst, kalla } = bygg({ users: [{ id: AGARE, epost: "agare@x.se" }] });
    expect(await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "agare@x.se" })).toEqual({ resultat: "fanns", id: medlemskapsId(AGARE, GRUPP) });
    expect(await kalla.list("memberships", {})).toHaveLength(1);
  });

  /*
   * ⛔ UPPSLAGET MOT `users` MÅSTE OCKSÅ VARA I GEMENER. Svepet tog bort
   * `toLowerCase` i `bjudIn` och ingenting blev rött, eftersom varje prov
   * bjöd in med samma skrivsätt som användarraden bar. `byggInbjudan`
   * normaliserar det som SKRIVS, men inte det som SÖKS PÅ.
   */
  it("⛔ en befintlig person hittas även när adressen skrivs med versaler", async () => {
    const { tjanst, kalla } = bygg({ users: [{ id: MEDLEM, epost: "finns@x.se" }] });
    expect(await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "Finns@X.SE" })).toEqual({
      resultat: "medlemskap",
      id: medlemskapsId(MEDLEM, GRUPP),
    });
    expect(await kalla.list("invitations", {})).toHaveLength(0);
  });

  it("rollen följer med inbjudan", async () => {
    const { tjanst, kalla } = bygg();
    await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se", roll: "agare" });
    expect((await kalla.list("invitations", {}))[0].roll).toBe("agare");
  });

  it("avUid, groupId och epost krävs", async () => {
    const { tjanst } = bygg();
    await expect(tjanst.bjudIn({ groupId: GRUPP, epost: "a@b.se" })).rejects.toThrow(/bjudIn: avUid krävs/);
    await expect(tjanst.bjudIn({ avUid: AGARE, epost: "a@b.se" })).rejects.toThrow(/bjudIn: groupId krävs/);
    await expect(tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP })).rejects.toThrow(/bjudIn: epost krävs/);
  });
});

describe("accepteraInbjudningar", () => {
  it("gör en väntande inbjudan till ett medlemskap", async () => {
    const { tjanst, kalla } = bygg();
    await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se" });
    const svar = await tjanst.accepteraInbjudningar({ uid: "uid-ny", epost: "Ny@X.se" });
    expect(svar).toEqual({ accepterade: [GRUPP], utgangna: [] });
    expect(await kalla.read("memberships", medlemskapsId("uid-ny", GRUPP))).toMatchObject({ roll: "medlem", status: "aktiv" });
  });

  it("markerar inbjudan accepterad", async () => {
    const { tjanst, kalla } = bygg();
    const { id } = await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se" });
    await tjanst.accepteraInbjudningar({ uid: "uid-ny", epost: "ny@x.se" });
    expect(await kalla.read("invitations", id)).toMatchObject({ status: "accepterad" });
  });

  it("⛔ IDEMPOTENT: en andra körning gör ingenting och kastar inte", async () => {
    const { tjanst, kalla } = bygg();
    await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se" });
    await tjanst.accepteraInbjudningar({ uid: "uid-ny", epost: "ny@x.se" });
    const andra = await tjanst.accepteraInbjudningar({ uid: "uid-ny", epost: "ny@x.se" });
    expect(andra).toEqual({ accepterade: [], utgangna: [] });
    expect(await kalla.list("memberships", {})).toHaveLength(2);
  });

  it("⛔ tomhet är ett svar: ingen inbjudan ger en tom lista, inte ett fel", async () => {
    const { tjanst } = bygg();
    expect(await tjanst.accepteraInbjudningar({ uid: "uid-ny", epost: "ingen@x.se" })).toEqual({ accepterade: [], utgangna: [] });
  });

  it("flera inbjudningar blir flera medlemskap", async () => {
    const { tjanst, kalla } = bygg({
      memberships: [
        { id: medlemskapsId(AGARE, GRUPP), userId: AGARE, groupId: GRUPP, roll: "agare", typ: "person", status: "aktiv" },
        { id: medlemskapsId(AGARE, "annat"), userId: AGARE, groupId: "annat", roll: "agare", typ: "person", status: "aktiv" },
      ],
    });
    await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se" });
    await tjanst.bjudIn({ avUid: AGARE, groupId: "annat", epost: "ny@x.se" });
    expect((await tjanst.accepteraInbjudningar({ uid: "uid-ny", epost: "ny@x.se" })).accepterade.sort()).toEqual(["annat", "bolaget"]);
    expect(await kalla.read("memberships", medlemskapsId("uid-ny", "annat"))).toBeTruthy();
  });

  it("rollen ur inbjudan följer med till medlemskapet", async () => {
    const { tjanst, kalla } = bygg();
    await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se", roll: "agare" });
    await tjanst.accepteraInbjudningar({ uid: "uid-ny", epost: "ny@x.se" });
    expect(await kalla.read("memberships", medlemskapsId("uid-ny", GRUPP))).toMatchObject({ roll: "agare" });
  });

  /*
   * ⛔ TRE PROV UR MUTATIONSSVEPET, och alla tre fanns inte förrän svepet
   * visade att kontrollerna de rör gick att ta bort utan att något blev rött.
   */

  it("⛔ en ÅTERKALLAD inbjudan blir inte ett medlemskap", async () => {
    const { tjanst, kalla } = bygg();
    const { id } = await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se" });
    await kalla.update("invitations", id, { status: "aterkallad" });
    expect(await tjanst.accepteraInbjudningar({ uid: "uid-ny", epost: "ny@x.se" })).toEqual({ accepterade: [], utgangna: [] });
    expect(await kalla.read("memberships", medlemskapsId("uid-ny", GRUPP))).toBeNull();
  });

  /*
   * ⛔ IDEMPOTENSEN VILADE PÅ FEL SAK I PROVEN. Att andra körningen inte gör
   * något följde av att inbjudan redan markerats accepterad, inte av
   * kontrollen mot ett befintligt medlemskap. Det här är fallet där de skiljer
   * sig: inbjudan väntar ännu, men personen har blivit medlem på annat sätt.
   */
  it("⛔ en väntande inbjudan till någon som REDAN är medlem skapar inget nytt", async () => {
    const { tjanst, kalla } = bygg();
    await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se" });
    await kalla.create("memberships", {
      id: medlemskapsId("uid-ny", GRUPP),
      userId: "uid-ny",
      groupId: GRUPP,
      roll: "agare",
      typ: "person",
      status: "aktiv",
    });

    expect(await tjanst.accepteraInbjudningar({ uid: "uid-ny", epost: "ny@x.se" })).toEqual({ accepterade: [], utgangna: [] });
    // ⛔ Och rollen är kvar. Hade raden skrivits om hade ägaren blivit medlem.
    expect(await kalla.read("memberships", medlemskapsId("uid-ny", GRUPP))).toMatchObject({ roll: "agare" });
  });

  it("uid och epost krävs", async () => {
    const { tjanst } = bygg();
    await expect(tjanst.accepteraInbjudningar({ epost: "a@b.se" })).rejects.toThrow(/accepteraInbjudningar: uid krävs/);
    await expect(tjanst.accepteraInbjudningar({ uid: "u" })).rejects.toThrow(/accepteraInbjudningar: epost krävs/);
  });
});

describe("namnet och bilden följer med in i medlemskapet (#138, beslut A)", () => {
  /*
   * ⛔ UTAN DE HÄR FÄLTEN HAR MEDLEMSLISTAN INGENTING ATT VISA. `users` läses
   * bara av sig själv, så en lista byggd på profiler visar en rad och sedan
   * tomma rutor. Provet mäter alltså inte en bekvämlighet utan att vyn alls
   * går att rita.
   */
  it("bjudIn skriver namn och bild när personen redan finns", async () => {
    const { kalla, tjanst } = bygg({ users: [{ id: "uid-ny", namn: "Ny Person", epost: "ny@example.com", bild: "https://exempel/ny.png" }] });
    await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@example.com" });
    const m = await kalla.read("memberships", medlemskapsId("uid-ny", GRUPP));
    expect(m.namn).toBe("Ny Person");
    expect(m.bild).toBe("https://exempel/ny.png");
  });

  it("accepteraInbjudningar skriver namn och bild ur profilen", async () => {
    const { kalla, tjanst } = bygg({
      users: [{ id: "uid-ny", namn: "Ny Person", epost: "ny@example.com", bild: "" }],
      invitations: [{ id: "i1", epost: "ny@example.com", groupId: GRUPP, roll: "medlem", status: "vantar", skapadAv: { uid: AGARE, namn: "A", typ: "manniska", kalla: "prov" } }],
    });
    await tjanst.accepteraInbjudningar({ uid: "uid-ny", epost: "ny@example.com" });
    const m = await kalla.read("memberships", medlemskapsId("uid-ny", GRUPP));
    expect(m.namn).toBe("Ny Person");
    expect(m.bild).toBe("");
  });

  it("läser profilen EN gång även när tre inbjudningar accepteras", async () => {
    const inb = (/** @type {string} */ g) => ({ id: `i-${g}`, epost: "ny@example.com", groupId: g, roll: "medlem", status: "vantar", skapadAv: { uid: AGARE, namn: "A", typ: "manniska", kalla: "prov" } });
    const { kalla, tjanst } = bygg({
      users: [{ id: "uid-ny", namn: "Ny Person", epost: "ny@example.com", bild: "" }],
      invitations: [inb("g1"), inb("g2"), inb("g3")],
    });
    const read = vi.fn(kalla.read);
    const tjanst2 = createInvitationService({ kalla: { ...kalla, read } });
    void tjanst;
    await tjanst2.accepteraInbjudningar({ uid: "uid-ny", epost: "ny@example.com" });
    expect(read.mock.calls.filter((c) => c[0] === "users").length).toBe(1);
  });

  it("tål att profilen inte finns, och skriver tomt i stället för att kasta", async () => {
    const { kalla, tjanst } = bygg({
      invitations: [{ id: "i1", epost: "ny@example.com", groupId: GRUPP, roll: "medlem", status: "vantar", skapadAv: { uid: AGARE, namn: "A", typ: "manniska", kalla: "prov" } }],
    });
    await tjanst.accepteraInbjudningar({ uid: "uid-ny", epost: "ny@example.com" });
    const m = await kalla.read("memberships", medlemskapsId("uid-ny", GRUPP));
    expect(m.namn).toBe("");
  });
});

describe("fabriken", () => {
  it("kräver en datakälla med read, list och create", () => {
    expect(() => createInvitationService({ kalla: /** @type {any} */ ({}) })).toThrow(
      /createInvitationService: en datakälla med read, list och create krävs/,
    );
  });

  it("⛔ kräver createNew, och säger det när tjänsten byggs (0.80.1)", () => {
    const { createNew: _bort, ...utan } = createMemorySource();
    expect(() => createInvitationService({ kalla: /** @type {any} */ (utan) })).toThrow(/createInvitationService: datakällan saknar createNew/);
  });

  it("⛔ kräver updateIf, och säger det när tjänsten byggs (0.80.1)", () => {
    const { updateIf: _bort, ...utan } = createMemorySource();
    expect(() => createInvitationService({ kalla: /** @type {any} */ (utan) })).toThrow(/createInvitationService: datakällan saknar updateIf/);
  });
});

/*
 * ⛔ ID:T KAN INTE KROCKA MELLAN GRUPPER (0.80.1, granskningen av lifehub.app PR 117, punkt 4). Före 0.80.1 var
 * id:t `${groupId}_${epost}`, och `_` är lagligt i ett grupp-id. Mätt i lifehub: `acme` + `team_bob@x.se` skrev
 * över `acme_team` + `bob@x.se`.
 */
describe("⛔ inbjudans id", () => {
  it("acme + team_bob@x.se och acme_team + bob@x.se ger olika id", () => {
    expect(inbjudningsId("acme", "team_bob@x.se")).not.toBe(inbjudningsId("acme_team", "bob@x.se"));
  });

  it("samma grupp och samma adress ger samma id, oavsett versaler", () => {
    expect(inbjudningsId("acme", "Bob@X.se")).toBe(inbjudningsId("acme", "bob@x.se"));
    expect(inbjudningsId("acme", "bob@x.se")).toMatch(/^acme\|[0-9a-f]{64}$/);
  });

  it("adressen står inte i klartext i id:t", () => {
    expect(inbjudningsId("acme", "bob@x.se")).not.toContain("bob");
  });

  it("⛔ ett grupp-id med avgränsaren kastar", () => {
    expect(() => inbjudningsId("acme|x", "bob@x.se")).toThrow(/innehåller avgränsaren/);
    expect(() => inbjudningsId("", "bob@x.se")).toThrow(/både groupId och epost krävs/);
  });

  it("⛔ två grupper vars namn bara skiljer i understrecket får var sin rad", async () => {
    const { tjanst, kalla } = bygg({
      memberships: [
        { id: medlemskapsId(AGARE, "acme"), userId: AGARE, groupId: "acme", roll: "agare", typ: "person", status: "aktiv" },
        { id: medlemskapsId(AGARE, "acme_team"), userId: AGARE, groupId: "acme_team", roll: "agare", typ: "person", status: "aktiv" },
      ],
    });
    const ett = await tjanst.bjudIn({ avUid: AGARE, groupId: "acme", epost: "team_bob@x.se" });
    const tva = await tjanst.bjudIn({ avUid: AGARE, groupId: "acme_team", epost: "bob@x.se" });
    expect(ett.id).not.toBe(tva.id);
    const rader = await kalla.list("invitations", {});
    expect(rader.map((r) => [r.groupId, r.epost]).sort()).toEqual([["acme", "team_bob@x.se"], ["acme_team", "bob@x.se"]]);
  });
});

/*
 * ⛔ EN ADRESS SOM REDAN HAR EN RAD I GRUPPEN (0.80.1, arkitektens beslut i PR 308). Raden för (grupp, adress)
 * avgör: återkallad eller utgången öppnas igen med updateIf, väntande och accepterad kastar, ingen rad skapas
 * med createNew. Raden skapas aldrig på nytt och skrivs aldrig över med create.
 */
describe("⛔ en inbjudan till en adress som redan har en rad i gruppen", () => {
  const ID = inbjudningsId(GRUPP, "ny@x.se");
  const GAMMAL_HASH = "b".repeat(64);
  const NY_HASH = "c".repeat(64);
  /** @param {Record<string, any>} falt */
  const rad = (falt) => ({
    id: ID, epost: "ny@x.se", groupId: GRUPP, roll: "medlem", skapadAv: { uid: "uid-forra" },
    tokenHash: GAMMAL_HASH, giltigTill: "2026-01-01T00:00:00.000Z", skickad: "2025-12-02T10:00:00.000Z", antalSkickade: 3, ...falt,
  });

  it("⛔ en återkallad rad öppnas igen: vantar, ny kod, ny utgångstid, den nya rollen och den som bjöd in", async () => {
    const { tjanst, kalla } = bygg({ invitations: [rad({ status: "aterkallad" })] });
    const fore = Date.now();
    const svar = await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se", roll: "admin", skapadAv: { uid: AGARE }, tokenHash: NY_HASH });
    expect(svar).toEqual({ resultat: "inbjudan", id: ID, ateroppnad: true });
    const efter = await kalla.read("invitations", ID);
    expect(efter).toMatchObject({ status: "vantar", roll: "admin", tokenHash: NY_HASH, skapadAv: { uid: AGARE }, antalSkickade: 3 });
    expect(Date.parse(efter.giltigTill)).toBeGreaterThan(fore + 29 * 86_400_000);
    expect(await kalla.list("invitations", {})).toHaveLength(1);
  });

  it("⛔ den gamla kodens hash överlever aldrig en återöppning, inte heller utan en ny kod", async () => {
    const { tjanst, kalla } = bygg({ invitations: [rad({ status: "aterkallad" })] });
    await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se" });
    expect((await kalla.read("invitations", ID)).tokenHash).toBe("");
  });

  it("⛔ en utgången väntande rad öppnas igen med en ny utgångstid", async () => {
    const { tjanst, kalla } = bygg({ invitations: [rad({ status: "vantar" })] });
    const svar = await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se", tokenHash: NY_HASH });
    expect(svar).toEqual({ resultat: "inbjudan", id: ID, ateroppnad: true });
    const efter = await kalla.read("invitations", ID);
    expect(efter).toMatchObject({ status: "vantar", tokenHash: NY_HASH });
    expect(Date.parse(efter.giltigTill)).toBeGreaterThan(Date.now());
  });

  it("⛔ en väntande rad som gäller kastar: skicka om i stället, och raden står kvar", async () => {
    const giltigTill = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const { tjanst, kalla } = bygg({ invitations: [rad({ status: "vantar", giltigTill })] });
    await expect(tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se", roll: "admin", tokenHash: NY_HASH })).rejects.toThrow(
      /redan en väntande inbjudan.*Skicka om den i stället/,
    );
    expect(await kalla.read("invitations", ID)).toMatchObject({ status: "vantar", roll: "medlem", tokenHash: GAMMAL_HASH, giltigTill });
  });

  it("⛔ en accepterad rad kastar: personen är redan medlem, och raden står kvar", async () => {
    const { tjanst, kalla } = bygg({ invitations: [rad({ status: "accepterad" })] });
    await expect(tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se", tokenHash: NY_HASH })).rejects.toThrow(/redan medlem/);
    expect(await kalla.read("invitations", ID)).toMatchObject({ status: "accepterad", tokenHash: GAMMAL_HASH });
  });

  it("⛔ två samtidiga återöppningar ger en vinnare, och den andra får veta att inbjudan redan väntar", async () => {
    const { tjanst, kalla } = bygg({ invitations: [rad({ status: "aterkallad" })] });
    const utfall = await Promise.allSettled([
      tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se", tokenHash: "d".repeat(64) }),
      tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se", tokenHash: "e".repeat(64) }),
    ]);
    const vann = utfall.filter((u) => u.status === "fulfilled");
    const fall = utfall.filter((u) => u.status === "rejected");
    expect(vann).toHaveLength(1);
    expect(fall).toHaveLength(1);
    expect(String(/** @type {PromiseRejectedResult} */ (fall[0]).reason)).toMatch(/redan en väntande inbjudan/);
    const efter = await kalla.read("invitations", ID);
    expect(efter.status).toBe("vantar");
    // ⛔ Raden bär vinnarens kod och ingen annans: den förlorande kodens mejl hade annars gått ut med en kod som inte gäller.
    expect(efter.tokenHash).toBe(utfall[0].status === "fulfilled" ? "d".repeat(64) : "e".repeat(64));
  });

  /**
   * Två återöppningar samtidigt, och utfallet. Båda läser innan någon av dem skriver: minneskällans
   * anrop väntar på varandra i tur och ordning, så listningen hinner göras två gånger före första skrivningen.
   * @param {any} tjanst
   */
  const tvaSamtidigt = async (tjanst) => {
    const utfall = await Promise.allSettled([
      tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se", tokenHash: "d".repeat(64) }),
      tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se", tokenHash: "e".repeat(64) }),
    ]);
    return { vann: utfall.filter((u) => u.status === "fulfilled").length, fall: utfall.filter((u) => u.status === "rejected") };
  };

  /*
   * ⛔ VILLKORETS TVÅ DELAR PROVAS VAR FÖR SIG (granskningen av PR 308, B1). Provet ovan använder en återkallad rad
   * med `giltigTill`, och där täcker `status` och `giltigTill` för varandra: granskaren tog bort den ena, sedan den
   * andra, och sviten var grön båda gångerna. En utgången rad har `vantar` både före och efter, så bara `giltigTill`
   * skiljer den första återöppningen från den andra. En återkallad rad utan `giltigTill` har bara `status`.
   */
  it("⛔ två samtidiga återöppningar av en UTGÅNGEN rad ger exakt en vinnare, giltigTill i villkoret avgör", async () => {
    const { tjanst, kalla } = bygg({ invitations: [rad({ status: "vantar" })] });
    const { vann, fall } = await tvaSamtidigt(tjanst);
    expect(vann).toBe(1);
    expect(fall).toHaveLength(1);
    expect(String(/** @type {PromiseRejectedResult} */ (fall[0]).reason)).toMatch(/redan en väntande inbjudan/);
    expect((await kalla.read("invitations", ID)).status).toBe("vantar");
  });

  it("⛔ två samtidiga återöppningar av en återkallad rad UTAN giltigTill ger exakt en vinnare, status i villkoret avgör", async () => {
    const { giltigTill: _bort, ...utan } = rad({ status: "aterkallad" });
    const { tjanst, kalla } = bygg({ invitations: [utan] });
    const { vann, fall } = await tvaSamtidigt(tjanst);
    expect(vann).toBe(1);
    expect(fall).toHaveLength(1);
    expect(String(/** @type {PromiseRejectedResult} */ (fall[0]).reason)).toMatch(/redan en väntande inbjudan/);
    expect((await kalla.read("invitations", ID)).status).toBe("vantar");
  });

  /*
   * ⛔ RADEN VÄLJS DETERMINISTISKT (granskningen av PR 308, K2). En accepterad eller giltig väntande rad går före en
   * återkallad, oavsett id och oavsett i vilken ordning källan listar dem.
   */
  for (const ordning of ["gammal först", "ny först"]) {
    it(`⛔ en gammal ACCEPTERAD rad och en ny ÅTERKALLAD: personen är redan medlem, ingen återöppning (${ordning})`, async () => {
      const gammal = { ...rad({ status: "accepterad" }), id: `${GRUPP}_ny@x.se` };
      const ny = rad({ status: "aterkallad" });
      const { tjanst, kalla } = bygg({ invitations: ordning === "gammal först" ? [gammal, ny] : [ny, gammal] });
      await expect(tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se", tokenHash: NY_HASH })).rejects.toThrow(/redan medlem/);
      expect(await kalla.read("invitations", ID)).toMatchObject({ status: "aterkallad", tokenHash: GAMMAL_HASH });
      expect(await kalla.read("invitations", gammal.id)).toMatchObject({ status: "accepterad" });
    });

    it(`⛔ en gammal giltig VÄNTANDE rad och en ny ÅTERKALLAD: skicka om i stället (${ordning})`, async () => {
      const gammal = { ...rad({ status: "vantar", giltigTill: new Date(Date.now() + 86_400_000).toISOString() }), id: `${GRUPP}_ny@x.se` };
      const ny = rad({ status: "aterkallad" });
      const { tjanst, kalla } = bygg({ invitations: ordning === "gammal först" ? [gammal, ny] : [ny, gammal] });
      await expect(tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se" })).rejects.toThrow(new RegExp(`redan en väntande inbjudan.*${GRUPP}_ny@x.se`));
      expect(await kalla.read("invitations", ID)).toMatchObject({ status: "aterkallad" });
    });
  }

  it("felet bär inte adressen, bara gruppen och id:t", async () => {
    const { tjanst } = bygg({ invitations: [rad({ status: "accepterad" })] });
    const fel = await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se" }).catch((/** @type {Error} */ e) => e);
    expect(fel).toBeInstanceOf(Error);
    expect(String(fel)).toContain(GRUPP);
    expect(String(fel)).not.toContain("ny@x.se");
  });

  it("⛔ en rad som dyker upp mellan listningen och skapandet skrivs inte över", async () => {
    const { tjanst, kalla } = bygg();
    const lista = kalla.list.bind(kalla);
    /** @type {any} */ (kalla).list = async (/** @type {string} */ c, /** @type {any} */ q) => {
      const svar = await lista(c, q);
      if (c === "invitations") await kalla.create("invitations", rad({ status: "accepterad" }));
      return svar;
    };
    await expect(tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se" })).rejects.toThrow(/redan medlem/);
    expect(await kalla.read("invitations", ID)).toMatchObject({ status: "accepterad", tokenHash: GAMMAL_HASH });
  });
});

/*
 * ⛔ GAMLA ID:N LÄSES SOM FÖRUT. En rad skriven före 0.80.1 har id:t `${groupId}_${epost}`. Varje uppslag går på
 * fältet `epost`, aldrig på id:t, så raden återanvänds och accepteras med det id den har.
 */
/*
 * ⛔ ACCEPTEN HÅLLER SAMMA LÖFTE SOM ÅTERKALLELSEN (granskningen av PR 308, K1). En utgången inbjudan accepteras
 * inte, och en återkallelse mellan acceptens läsning och skrivning vinner: inget medlemskap, och raden står kvar
 * som återkallad.
 */
describe("⛔ accepten och en återkallad eller utgången inbjudan", () => {
  const ID = inbjudningsId(GRUPP, "ny@x.se");
  /** @param {Record<string, any>} falt */
  const rad = (falt) => ({ id: ID, epost: "ny@x.se", groupId: GRUPP, roll: "admin", status: "vantar", giltigTill: new Date(Date.now() + 86_400_000).toISOString(), ...falt });

  it("⛔ en utgången väntande inbjudan accepteras inte, och svaret säger vilken grupp", async () => {
    const { tjanst, kalla } = bygg({ invitations: [rad({ giltigTill: "2026-01-01T00:00:00.000Z" })] });
    expect(await tjanst.accepteraInbjudningar({ uid: "uid-ny", epost: "ny@x.se" })).toEqual({ accepterade: [], utgangna: [GRUPP] });
    expect(await kalla.read("memberships", medlemskapsId("uid-ny", GRUPP))).toBeNull();
    expect((await kalla.read("invitations", ID)).status).toBe("vantar");
  });

  it("⛔ en återkallelse mellan acceptens läsning och skrivning vinner: inget medlemskap, raden står kvar återkallad", async () => {
    const { tjanst, kalla } = bygg({ invitations: [rad({})] });
    const lista = kalla.list.bind(kalla);
    /** @type {any} */ (kalla).list = async (/** @type {string} */ c, /** @type {any} */ q) => {
      const svar = await lista(c, q);
      if (c === "invitations") await kalla.update("invitations", ID, { status: "aterkallad" });
      return svar;
    };
    expect(await tjanst.accepteraInbjudningar({ uid: "uid-ny", epost: "ny@x.se" })).toEqual({ accepterade: [], utgangna: [] });
    expect(await kalla.read("memberships", medlemskapsId("uid-ny", GRUPP))).toBeNull();
    expect((await kalla.read("invitations", ID)).status).toBe("aterkallad");
  });

  it("⛔ faller skrivningen av medlemskapet lämnas inbjudan tillbaka som väntande, och felet går vidare", async () => {
    const { tjanst, kalla } = bygg({ invitations: [rad({})] });
    const skapa = kalla.create.bind(kalla);
    /** @type {any} */ (kalla).create = async (/** @type {string} */ c, /** @type {any} */ d) => {
      if (c === "memberships") throw new Error("nätet föll");
      return skapa(c, d);
    };
    await expect(tjanst.accepteraInbjudningar({ uid: "uid-ny", epost: "ny@x.se" })).rejects.toThrow(/nätet föll/);
    expect((await kalla.read("invitations", ID)).status).toBe("vantar");
  });
});

describe("⛔ en inbjudan med det gamla id:t (före 0.80.1)", () => {
  const GAMMALT = `${GRUPP}_ny@x.se`;
  const gammal = () => ({ id: GAMMALT, epost: "ny@x.se", groupId: GRUPP, roll: "medlem", status: "vantar" });

  it("en väntande gammal rad räknas: bjudIn kastar och ger ingen andra rad", async () => {
    const { tjanst, kalla } = bygg({ invitations: [{ ...gammal(), giltigTill: new Date(Date.now() + 86_400_000).toISOString() }] });
    await expect(tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se" })).rejects.toThrow(new RegExp(`redan en väntande inbjudan.*${GAMMALT}`));
    expect(await kalla.list("invitations", {})).toHaveLength(1);
  });

  it("en återkallad gammal rad öppnas igen under sitt gamla id, och ingen ny rad skapas", async () => {
    const { tjanst, kalla } = bygg({ invitations: [{ ...gammal(), status: "aterkallad" }] });
    expect(await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se" })).toEqual({ resultat: "inbjudan", id: GAMMALT, ateroppnad: true });
    expect(await kalla.list("invitations", {})).toEqual([expect.objectContaining({ id: GAMMALT, status: "vantar" })]);
  });

  it("accepteras och markeras accepterad under sitt gamla id", async () => {
    const { tjanst, kalla } = bygg({ invitations: [gammal()] });
    expect(await tjanst.accepteraInbjudningar({ uid: "uid-ny", epost: "ny@x.se" })).toEqual({ accepterade: [GRUPP], utgangna: [] });
    expect(await kalla.read("invitations", GAMMALT)).toMatchObject({ status: "accepterad" });
  });
});
