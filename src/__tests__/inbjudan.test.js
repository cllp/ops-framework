import { describe, it, expect, vi } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { createInvitationService } from "../node/inbjudan.js";

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
      { id: `${AGARE}_${GRUPP}`, userId: AGARE, groupId: GRUPP, roll: "agare", typ: "person", status: "aktiv" },
    ],
    invitations: seed.invitations ?? [],
  });
  return { kalla, tjanst: createInvitationService({ kalla }) };
};

describe("⛔ ägarskapet kontrolleras i funktionen, inte bara i reglerna", () => {
  it("en medlem får inte bjuda in", async () => {
    const { tjanst, kalla } = bygg();
    await kalla.create("memberships", { id: `${MEDLEM}_${GRUPP}`, userId: MEDLEM, groupId: GRUPP, roll: "medlem", typ: "person", status: "aktiv" });
    await expect(tjanst.bjudIn({ avUid: MEDLEM, groupId: GRUPP, epost: "ny@x.se" })).rejects.toThrow(
      /uid-medlem är inte aktiv ägare i gruppen "bolaget"/,
    );
  });

  it("en utomstående får inte bjuda in", async () => {
    const { tjanst } = bygg();
    await expect(tjanst.bjudIn({ avUid: "uid-frammande", groupId: GRUPP, epost: "ny@x.se" })).rejects.toThrow(/inte aktiv ägare/);
  });

  it("en avslutad ägare får inte bjuda in", async () => {
    const { tjanst } = bygg({
      memberships: [{ id: `${AGARE}_${GRUPP}`, userId: AGARE, groupId: GRUPP, roll: "agare", typ: "person", status: "avslutad" }],
    });
    await expect(tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se" })).rejects.toThrow(/inte aktiv ägare/);
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
    expect(svar).toEqual({ resultat: "medlemskap", id: `${MEDLEM}_${GRUPP}` });
    expect(await kalla.read("memberships", `${MEDLEM}_${GRUPP}`)).toMatchObject({ roll: "medlem", status: "aktiv" });
    expect(await kalla.list("invitations", {})).toHaveLength(0);
  });

  it("ett andra klick skapar ingen andra rad", async () => {
    const { tjanst, kalla } = bygg();
    const ett = await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se" });
    const tva = await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se" });
    expect(tva).toEqual({ resultat: "fanns", id: ett.id });
    expect(await kalla.list("invitations", {})).toHaveLength(1);
  });

  it("en som redan är medlem ger fanns, inte en dubblett", async () => {
    const { tjanst, kalla } = bygg({ users: [{ id: AGARE, epost: "agare@x.se" }] });
    expect(await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "agare@x.se" })).toEqual({ resultat: "fanns", id: `${AGARE}_${GRUPP}` });
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
      id: `${MEDLEM}_${GRUPP}`,
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
    expect(svar).toEqual({ accepterade: [GRUPP] });
    expect(await kalla.read("memberships", `uid-ny_${GRUPP}`)).toMatchObject({ roll: "medlem", status: "aktiv" });
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
    expect(andra).toEqual({ accepterade: [] });
    expect(await kalla.list("memberships", {})).toHaveLength(2);
  });

  it("⛔ tomhet är ett svar: ingen inbjudan ger en tom lista, inte ett fel", async () => {
    const { tjanst } = bygg();
    expect(await tjanst.accepteraInbjudningar({ uid: "uid-ny", epost: "ingen@x.se" })).toEqual({ accepterade: [] });
  });

  it("flera inbjudningar blir flera medlemskap", async () => {
    const { tjanst, kalla } = bygg({
      memberships: [
        { id: `${AGARE}_${GRUPP}`, userId: AGARE, groupId: GRUPP, roll: "agare", typ: "person", status: "aktiv" },
        { id: `${AGARE}_annat`, userId: AGARE, groupId: "annat", roll: "agare", typ: "person", status: "aktiv" },
      ],
    });
    await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se" });
    await tjanst.bjudIn({ avUid: AGARE, groupId: "annat", epost: "ny@x.se" });
    expect((await tjanst.accepteraInbjudningar({ uid: "uid-ny", epost: "ny@x.se" })).accepterade.sort()).toEqual(["annat", "bolaget"]);
    expect(await kalla.read("memberships", "uid-ny_annat")).toBeTruthy();
  });

  it("rollen ur inbjudan följer med till medlemskapet", async () => {
    const { tjanst, kalla } = bygg();
    await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se", roll: "agare" });
    await tjanst.accepteraInbjudningar({ uid: "uid-ny", epost: "ny@x.se" });
    expect(await kalla.read("memberships", `uid-ny_${GRUPP}`)).toMatchObject({ roll: "agare" });
  });

  /*
   * ⛔ TRE PROV UR MUTATIONSSVEPET, och alla tre fanns inte förrän svepet
   * visade att kontrollerna de rör gick att ta bort utan att något blev rött.
   */

  it("⛔ en ÅTERKALLAD inbjudan blir inte ett medlemskap", async () => {
    const { tjanst, kalla } = bygg();
    const { id } = await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "ny@x.se" });
    await kalla.update("invitations", id, { status: "aterkallad" });
    expect(await tjanst.accepteraInbjudningar({ uid: "uid-ny", epost: "ny@x.se" })).toEqual({ accepterade: [] });
    expect(await kalla.read("memberships", `uid-ny_${GRUPP}`)).toBeNull();
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
      id: `uid-ny_${GRUPP}`,
      userId: "uid-ny",
      groupId: GRUPP,
      roll: "agare",
      typ: "person",
      status: "aktiv",
    });

    expect(await tjanst.accepteraInbjudningar({ uid: "uid-ny", epost: "ny@x.se" })).toEqual({ accepterade: [] });
    // ⛔ Och rollen är kvar. Hade raden skrivits om hade ägaren blivit medlem.
    expect(await kalla.read("memberships", `uid-ny_${GRUPP}`)).toMatchObject({ roll: "agare" });
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
    const m = await kalla.read("memberships", `uid-ny_${GRUPP}`);
    expect(m.namn).toBe("Ny Person");
    expect(m.bild).toBe("https://exempel/ny.png");
  });

  it("accepteraInbjudningar skriver namn och bild ur profilen", async () => {
    const { kalla, tjanst } = bygg({
      users: [{ id: "uid-ny", namn: "Ny Person", epost: "ny@example.com", bild: "" }],
      invitations: [{ id: "i1", epost: "ny@example.com", groupId: GRUPP, roll: "medlem", status: "vantar", skapadAv: { uid: AGARE, namn: "A", typ: "manniska", kalla: "prov" } }],
    });
    await tjanst.accepteraInbjudningar({ uid: "uid-ny", epost: "ny@example.com" });
    const m = await kalla.read("memberships", `uid-ny_${GRUPP}`);
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
    const m = await kalla.read("memberships", `uid-ny_${GRUPP}`);
    expect(m.namn).toBe("");
  });
});

describe("fabriken", () => {
  it("kräver en datakälla med read, list och create", () => {
    expect(() => createInvitationService({ kalla: /** @type {any} */ ({}) })).toThrow(
      /createInvitationService: en datakälla med read, list och create krävs/,
    );
  });
});
