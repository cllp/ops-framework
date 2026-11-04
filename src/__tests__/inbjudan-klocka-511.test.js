import { describe, it, expect } from "vitest";
import { INBJUDNING_GILTIGHET_DAGAR, medlemskapsId } from "../lib/grupp.js";
import { createMemorySource } from "../data/adapters.js";
import { createGroupService } from "../node/grupp.js";
import { createInvitationService, inbjudningsId } from "../node/inbjudan.js";

/**
 * Inbjudningstjänstens klocka är ett argument (0.183.1, cllp/ops-framework#511).
 *
 * ⛔ Mätt 2026-11-04 08:12 i cllp/lifehub.app: ett prov med fast klocka och en fixtur som gick ut 08:00 samma morgon blev rött
 * på main och på varje gren, eftersom tjänsten prövade giltigheten mot `Date.now()` och inte mot appens klocka. Klockorna här
 * ligger år 2020, långt före väggklockan: utan argumentet räknar tjänsten på väggklockan, och då är varje rad här utgången.
 */

const AGARE = "uid-agare";
const MEDLEM = "uid-medlem";
const GRUPP = "bolaget";
const EPOST = "ny@x.se";
const GILTIG_TILL = "2020-01-10T00:00:00.000Z";
const FORE = Date.parse("2020-01-05T00:00:00.000Z");
const EFTER = Date.parse("2020-01-15T00:00:00.000Z");

const vantande = () => ({ id: inbjudningsId(GRUPP, EPOST), epost: EPOST, groupId: GRUPP, roll: "medlem", status: "vantar", skapadAv: { uid: AGARE }, tokenHash: "", giltigTill: GILTIG_TILL });

const bygg = (/** @type {number} */ tid) => {
  const kalla = createMemorySource({
    users: [],
    memberships: [{ id: medlemskapsId(AGARE, GRUPP), userId: AGARE, groupId: GRUPP, roll: "agare", typ: "person", status: "aktiv" }],
    invitations: [vantande()],
  });
  return { kalla, tjanst: createInvitationService({ kalla, nu: () => tid }) };
};

describe("⛔ inbjudningarna räknar med appens klocka, inte väggklockan (#511)", () => {
  it("en rad som är giltig enligt klockan väntar: ett nytt bjudIn nekas", async () => {
    const { tjanst } = bygg(FORE);
    await expect(tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: EPOST })).rejects.toThrow(/redan en väntande inbjudan/);
  });

  it("en rad som gått ut enligt klockan öppnas igen, och den nya giltigTill räknas från samma klocka", async () => {
    const { tjanst, kalla } = bygg(EFTER);
    expect(await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: EPOST })).toEqual({ resultat: "inbjudan", id: inbjudningsId(GRUPP, EPOST), ateroppnad: true, fran: "utgangen" });
    const rad = await kalla.read("invitations", inbjudningsId(GRUPP, EPOST));
    expect(rad.giltigTill).toBe(new Date(EFTER + INBJUDNING_GILTIGHET_DAGAR * 86_400_000).toISOString());
  });

  it("en ny inbjudan får giltigTill från klockan", async () => {
    const { tjanst, kalla } = bygg(FORE);
    await tjanst.bjudIn({ avUid: AGARE, groupId: GRUPP, epost: "annan@x.se" });
    const rad = await kalla.read("invitations", inbjudningsId(GRUPP, "annan@x.se"));
    expect(rad.giltigTill).toBe(new Date(FORE + INBJUDNING_GILTIGHET_DAGAR * 86_400_000).toISOString());
  });

  it("accepten följer samma klocka: före giltigTill accepteras den, efter räknas den som utgången", async () => {
    expect(await bygg(FORE).tjanst.accepteraInbjudningar({ uid: MEDLEM, epost: EPOST, epostVerifierad: true })).toEqual({ accepterade: [GRUPP], utgangna: [] });
    expect(await bygg(EFTER).tjanst.accepteraInbjudningar({ uid: MEDLEM, epost: EPOST, epostVerifierad: true })).toEqual({ accepterade: [], utgangna: [GRUPP] });
  });

  it("en klocka som inte är en funktion, eller som inte ger millisekunder, är ett fel som säger det", async () => {
    const kalla = createMemorySource({ users: [], memberships: [], invitations: [] });
    expect(() => createInvitationService({ kalla, nu: /** @type {any} */ (5) })).toThrow(/nu ska vara en funktion/);
    const tjanst = createInvitationService({ kalla, nu: /** @type {any} */ (() => "2020-01-01") });
    await expect(tjanst.accepteraInbjudningar({ uid: MEDLEM, epost: EPOST, epostVerifierad: true })).rejects.toThrow(/inte en tid i millisekunder/);
  });

  it("createGroupService skickar klockan vidare: inbjudan som skapas med gruppen får giltigTill från klockan", async () => {
    const kalla = createMemorySource({ vitlista: [], memberships: [], groups: [], users: [], invitations: [] });
    const tjanst = createGroupService({ kalla, nu: () => FORE, vitlistaKravs: false });
    const svar = await tjanst.skapaGrupp({ uid: AGARE, epost: "agare@x.se", grupp: { namn: "Klockan" }, inbjudningar: [{ epost: EPOST }] });
    expect(svar.inbjudna).toEqual([EPOST]);
    const rad = await kalla.read("invitations", inbjudningsId(svar.groupId, EPOST));
    expect(rad.giltigTill).toBe(new Date(FORE + INBJUDNING_GILTIGHET_DAGAR * 86_400_000).toISOString());
  });
});
