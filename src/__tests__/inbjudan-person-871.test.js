import { describe, it, expect } from "vitest";
import { byggInbjudan, medlemskapsId } from "../lib/grupp.js";
import { createMemorySource } from "../data/adapters.js";
import { createInvitationService, inbjudningsId, inbjudningsIdForPerson } from "../node/inbjudan.js";

/**
 * En inbjudan till en person i stället för en adress (0.253.0, cllp/lifehub.app#871). Personen hittades i sökningen i LifeHub, och den
 * som bjuder in får inte se adressen (spärren 2026-11-17 i #871). Raden bär `forUid` och en maskerad adress (`visas`), aldrig adressen,
 * eftersom gruppens ägare och admin får läsa `invitations`. Accepten matchar uid:t ur inloggningen.
 */

const AGARE = "uid-agare";
const GRUPP = "bolaget";
const PERSON = "uid-karin";

const bygg = () => {
  const kalla = createMemorySource({
    users: [],
    memberships: [{ id: medlemskapsId(AGARE, GRUPP), userId: AGARE, groupId: GRUPP, roll: "agare", typ: "person", status: "aktiv" }],
    invitations: [],
  });
  return { kalla, tjanst: createInvitationService({ kalla }) };
};

describe("bjudIn till en person (forUid)", () => {
  it("⛔ raden bär uid:t och den maskerade adressen, och ingen adress", async () => {
    const { tjanst, kalla } = bygg();
    const svar = await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, forUid: PERSON, visas: "ka***@exempel.se" });
    expect(svar).toMatchObject({ resultat: "inbjudan", ateroppnad: false, id: inbjudningsIdForPerson(GRUPP, PERSON) });
    const [rad] = await kalla.list("invitations", {});
    expect(rad).toMatchObject({ forUid: PERSON, visas: "ka***@exempel.se", groupId: GRUPP, status: "vantar" });
    expect("epost" in rad).toBe(false);
  });

  it("ett andra klick till samma person säger att man skickar om, och skriver ingen andra rad", async () => {
    const { tjanst, kalla } = bygg();
    await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, forUid: PERSON, visas: "ka***@exempel.se" });
    await expect(tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, forUid: PERSON, visas: "ka***@exempel.se" })).rejects.toThrow(/redan en väntande inbjudan/);
    expect(await kalla.list("invitations", {})).toHaveLength(1);
  });

  it("⛔ adress och person samtidigt nekas, och en person utan visas nekas, och inget skrivs", async () => {
    const { tjanst, kalla } = bygg();
    await expect(tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "k@x.se", forUid: PERSON, visas: "k***@x.se" })).rejects.toThrow(/går inte att skicka båda/);
    await expect(tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, forUid: PERSON })).rejects.toThrow(/visas krävs/);
    expect(await kalla.list("invitations", {})).toHaveLength(0);
  });

  it("⛔ id:t för en person och för en adress krockar aldrig", () => {
    expect(inbjudningsIdForPerson(GRUPP, "k@x.se")).not.toBe(inbjudningsId(GRUPP, "k@x.se"));
  });
});

describe("accepten av en inbjudan till en person", () => {
  it("⛔ personen med uid:t blir medlem, med sin egen adress ur inloggningen", async () => {
    const { tjanst, kalla } = bygg();
    await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, forUid: PERSON, visas: "ka***@exempel.se", roll: "admin" });
    const svar = await tjanst.accepteraInbjudningar({ uid: PERSON, epost: "karin.lind@exempel.se", epostVerifierad: true });
    expect(svar.accepterade).toEqual([GRUPP]);
    expect(await kalla.read("memberships", medlemskapsId(PERSON, GRUPP))).toMatchObject({ status: "aktiv", roll: "admin" });
  });

  it("⛔ någon annan, också med samma adress som den maskerade, blir inte medlem", async () => {
    const { tjanst, kalla } = bygg();
    await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, forUid: PERSON, visas: "ka***@exempel.se" });
    const svar = await tjanst.accepteraInbjudningar({ uid: "uid-annan", epost: "karin.lind@exempel.se", epostVerifierad: true });
    expect(svar.accepterade).toEqual([]);
    expect(await kalla.read("memberships", medlemskapsId("uid-annan", GRUPP))).toBeFalsy();
    expect((await kalla.list("invitations", {}))[0].status).toBe("vantar");
  });
});

describe("byggInbjudan", () => {
  const bas = { id: "x", groupId: GRUPP, roll: "medlem", status: "vantar" };
  it("⛔ kräver precis en av epost och forUid, och visas bara med forUid", () => {
    expect(() => byggInbjudan({ ...bas })).toThrow(/epost krävs för "x", eller forUid/);
    expect(() => byggInbjudan({ ...bas, epost: "a@x.se", forUid: PERSON, visas: "a***@x.se" })).toThrow(/både epost och forUid/);
    expect(() => byggInbjudan({ ...bas, forUid: PERSON })).toThrow(/visas krävs/);
    expect(() => byggInbjudan({ ...bas, epost: "a@x.se", visas: "a***@x.se" })).toThrow(/visas hör bara till/);
    expect(byggInbjudan({ ...bas, epost: "A@x.se" })).toMatchObject({ epost: "a@x.se" });
  });
});
