import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { OpsAuthProvider, createAuth } from "../auth/auth.jsx";
import { OpsMottagare } from "../components/OpsMottagare.jsx";
import { OpsMedlemmar } from "../components/OpsMedlemmar.jsx";
import { OpsGruppSida } from "../components/OpsGruppSida.jsx";
import { OpsSvar } from "../components/OpsSvar.jsx";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla, samtalsnotiser } from "../data/samtalskalla.js";
import { NAMN_SAKNAS, glomVarnade, personnamn, varnaNamnSaknas } from "../lib/personnamn.js";
import { byggMedlemskap, medlemskapsId } from "../lib/grupp.js";
import { sakerstallAnvandare } from "../lib/profil.js";
import { createGroupService } from "../node/grupp.js";
import { createInvitationService } from "../node/inbjudan.js";
import { bakfyllMedlemsnamn, uppdateraProfil } from "../node/profil.js";
import { lasFlaggor, rapport } from "../../scripts/bakfyll-medlemsnamn.mjs";

/**
 * #218: ett uid visas aldrig för en människa, och ett medlemskap som kan få ett namn får det.
 *
 * CP 2026-10-01, skärmbild från telefonen av "Nytt ärende": under "Till" stod den inloggade som
 * `eA2ILzNei5TQ2rcHy68aBZPpR1B3 (du)`. "Bra om användarnamnet inte är Guid."
 */

const CP = "eA2ILzNei5TQ2rcHy68aBZPpR1B3";
const ANNAN = "Xq9TmP4aLw2RbVn7Kc1HdYe3Zs6F";

/** @param {{ id: string, namn?: string } | null} user */
function medInloggad(user, barn) {
  const auth = createAuth({
    signIn: async () => {},
    signOut: async () => {},
    subscribe: (l) => {
      l(/** @type {any} */ (user));
      return () => {};
    },
  });
  return <OpsAuthProvider authentication={auth}>{barn}</OpsAuthProvider>;
}

beforeEach(() => glomVarnade());
afterEach(() => vi.restoreAllMocks());

describe("personnamn (ren)", () => {
  it("medlemskapets namn först", () => {
    expect(personnamn("Anna Ek", { id: CP, inloggad: { id: CP, namn: "Annat" } })).toEqual({ text: "Anna Ek", saknas: false });
  });
  it("⛔ saknas namnet och raden är den inloggades: namnet ur inloggningen", () => {
    expect(personnamn("", { id: CP, inloggad: { id: CP, namn: "Claes Philip" } })).toEqual({ text: "Claes Philip", saknas: false });
  });
  it("⛔ saknas namnet och raden är någon annans: 'Namn saknas', aldrig id:t", () => {
    const svar = personnamn("", { id: ANNAN, inloggad: { id: CP, namn: "Claes Philip" } });
    expect(svar).toEqual({ text: NAMN_SAKNAS, saknas: true });
    expect(svar.text).not.toContain(ANNAN);
  });
  it("den inloggade utan eget namn i inloggningen faller också till 'Namn saknas'", () => {
    expect(personnamn(undefined, { id: CP, inloggad: { id: CP } })).toEqual({ text: NAMN_SAKNAS, saknas: true });
  });
  it("varnar en gång per id, och nämner id:t bara i konsolen", () => {
    const varna = vi.spyOn(console, "warn").mockImplementation(() => {});
    varnaNamnSaknas(ANNAN);
    varnaNamnSaknas(ANNAN);
    expect(varna).toHaveBeenCalledTimes(1);
    expect(String(varna.mock.calls[0][0])).toContain(ANNAN);
  });
});

describe("⛔ ingen vy ritar ett id (#218)", () => {
  const rad = (/** @type {string} */ userId, /** @type {object} */ extra = {}) => ({ userId, namn: "", typ: "person", status: "aktiv", ...extra });

  it("OpsMottagare: den inloggade utan namn på raden ritas med sitt namn ur inloggningen, inget uid", async () => {
    const { container } = render(
      medInloggad({ id: CP, namn: "Claes Philip" }, <OpsMottagare lage="arende" medlemmar={[rad(CP), rad(ANNAN, { namn: "Bo Lind" })]} uid={CP} value={{ slag: "grupp" }} onChange={() => {}} />),
    );
    await waitFor(() => expect(screen.getByRole("radio", { name: /Claes Philip \(du\)/ })).toBeInTheDocument());
    expect(container.textContent).not.toContain(CP);
    expect(container.querySelector("[data-namn-saknas]")).toBeNull();
  });

  it("OpsMottagare: en annan utan namn ritas som 'Namn saknas', märkt, aldrig med uid", () => {
    const varna = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(<OpsMottagare lage="arende" medlemmar={[rad(CP, { namn: "Claes Philip" }), rad(ANNAN)]} uid={CP} value={{ slag: "grupp" }} onChange={() => {}} />);
    expect(container.textContent).not.toContain(ANNAN);
    const markt = container.querySelectorAll("[data-namn-saknas]");
    expect(markt).toHaveLength(1);
    expect(markt[0].textContent).toBe(NAMN_SAKNAS);
    expect(varna).toHaveBeenCalled();
  });

  it("OpsMottagare: utan provider och utan namn är inte ens den egna raden ett uid", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(<OpsMottagare lage="arende" medlemmar={[rad(CP)]} uid={CP} value={{ slag: "grupp" }} onChange={() => {}} />);
    expect(container.textContent).not.toContain(CP);
    expect(container.textContent).toContain(`${NAMN_SAKNAS} (du)`);
  });

  it("OpsMedlemmar: raden utan namn ritas som 'Namn saknas', inte med uid", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const m = { id: `${ANNAN}_g`, userId: ANNAN, groupId: "g", roll: "medlem", typ: "person", status: "aktiv", namn: "", bild: "" };
    const { container } = render(<OpsMedlemmar medlemmar={[{ medlemskap: /** @type {any} */ (m) }]} migUid={CP} />);
    expect(container.textContent).not.toContain(ANNAN);
    expect(container.querySelector("[data-namn-saknas]")?.textContent).toBe(NAMN_SAKNAS);
  });

  it("OpsGruppSida: medlemslistan ritar inget uid", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(<OpsGruppSida grupp={/** @type {any} */ ({ id: "g", namn: { sv: "Alfa", en: "Alfa" }, roll: "agare" })} medlemmar={[{ id: ANNAN, namn: "", bild: "", roll: "medlem" }]} />);
    expect(container.textContent).not.toContain(ANNAN);
    expect(container.querySelector("[data-namn-saknas]")?.textContent).toBe(NAMN_SAKNAS);
  });

  it("OpsSvar: en medlem utan namn är inte en tom rad", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(<OpsSvar svar={[]} medlemmar={[{ uid: ANNAN, namn: "" }]} uid={CP} onSvara={() => {}} />);
    expect(container.querySelector(`[data-svarsrad="${ANNAN}"] [data-namn-saknas]`)?.textContent).toBe(NAMN_SAKNAS);
  });

  it("OpsMeddelanden: avsändaren utan namn är 'Namn saknas' i gruppchatten, aldrig uid", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const kalla = createMemorySource({});
    const samtal = createSamtalskalla({ kalla });
    const g = await samtal.oppnaGrupp({ groupId: "g", uid: CP });
    await samtal.skicka(g.id, { text: "Hej alla", av: ANNAN });
    const { container } = render(<OpsMeddelanden kalla={samtal} uid={CP} groupId="g" gruppNamn="Alfa AB" medlemmar={[rad(CP, { namn: "Claes Philip" }), rad(ANNAN)]} />);
    const knapp = await screen.findByRole("button", { name: /Alfa AB/ });
    knapp.click();
    const vy = await screen.findByRole("log", { name: "Alfa AB" });
    await waitFor(() => expect(within(vy).getByText(NAMN_SAKNAS)).toBeInTheDocument());
    expect(container.textContent).not.toContain(ANNAN);
  });

  it("samtalsnotiser: titeln bär aldrig uid", async () => {
    const kalla = createMemorySource({});
    const samtal = createSamtalskalla({ kalla });
    const p = await samtal.oppnaPrivat({ groupId: "g", uid: ANNAN, annan: CP });
    await samtal.skicka(p.id, { text: "Hej", av: ANNAN });
    const notiser = await samtalsnotiser({ samtal, uid: CP, namnFor: () => "" })({ groupId: "g" });
    expect(notiser).toHaveLength(1);
    expect(notiser[0].titel).not.toContain(ANNAN);
    expect(notiser[0].titel).toContain(NAMN_SAKNAS);
  });
});

describe("⛔ skrivvägarna ger medlemskapet ett namn när ett fanns (#218)", () => {
  it("sakerstallAnvandare fyller ett TOMT namn på en befintlig rad, men skriver aldrig över ett ifyllt", async () => {
    const kalla = createMemorySource({ users: [{ id: CP, namn: "", epost: "cp@staiger.se" }] });
    const fyllt = await sakerstallAnvandare({ kalla, inloggad: { uid: CP, namn: "Claes Philip", epost: "cp@staiger.se" } });
    expect(fyllt.anvandare.namn).toBe("Claes Philip");
    expect((await kalla.read("users", CP))?.namn).toBe("Claes Philip");

    const redigerat = createMemorySource({ users: [{ id: CP, namn: "Eget Namn", epost: "cp@staiger.se" }] });
    const svar = await sakerstallAnvandare({ kalla: redigerat, inloggad: { uid: CP, namn: "Google Namn", epost: "cp@staiger.se" } });
    expect(svar.anvandare.namn).toBe("Eget Namn");
    expect((await redigerat.read("users", CP))?.namn).toBe("Eget Namn");
  });

  it("skapaGrupp: profilen utan namn men inloggningen med ett ger ägarens medlemskap det namnet", async () => {
    const kalla = createMemorySource({ vitlista: [{ id: "cp@staiger.se", epost: "cp@staiger.se", tillagdAv: { uid: "x", namn: "X", typ: "manniska", kalla: "t" }, tid: "2026-09-28T00:00:00.000Z" }], memberships: [], groups: [], users: [{ id: CP, namn: "", epost: "cp@staiger.se" }], invitations: [] });
    const { skapaGrupp } = createGroupService({ kalla });
    const svar = await skapaGrupp({ uid: CP, epost: "cp@staiger.se", grupp: { namn: "Mitt bolag" }, namn: "Claes Philip" });
    expect((await kalla.read("memberships", medlemskapsId(CP, svar.groupId)))?.namn).toBe("Claes Philip");
  });

  it("skapaGrupp: profilens namn går före inloggningens", async () => {
    const kalla = createMemorySource({ vitlista: [{ id: "cp@staiger.se", epost: "cp@staiger.se", tillagdAv: { uid: "x", namn: "X", typ: "manniska", kalla: "t" }, tid: "2026-09-28T00:00:00.000Z" }], memberships: [], groups: [], users: [{ id: CP, namn: "Profilnamn", epost: "cp@staiger.se" }], invitations: [] });
    const { skapaGrupp } = createGroupService({ kalla });
    const svar = await skapaGrupp({ uid: CP, epost: "cp@staiger.se", grupp: { namn: "Mitt bolag" }, namn: "Inloggningsnamn" });
    expect((await kalla.read("memberships", medlemskapsId(CP, svar.groupId)))?.namn).toBe("Profilnamn");
  });

  it("accepteraInbjudningar: samma reserv, och en profil med namn vinner", async () => {
    const mk = (/** @type {string} */ namn) =>
      createMemorySource({
        users: [{ id: CP, namn, epost: "cp@staiger.se" }],
        memberships: [],
        invitations: [{ id: "i1", epost: "cp@staiger.se", groupId: "g", roll: "medlem", status: "vantar", skapadAv: { uid: null, namn: "", typ: "okand", kalla: "" } }],
      });
    const tom = mk("");
    await createInvitationService({ kalla: tom }).accepteraInbjudningar({ uid: CP, epost: "cp@staiger.se", epostVerifierad: true, namn: "Claes Philip" });
    expect((await tom.read("memberships", medlemskapsId(CP, "g")))?.namn).toBe("Claes Philip");
    const full = mk("Profilnamn");
    await createInvitationService({ kalla: full }).accepteraInbjudningar({ uid: CP, epost: "cp@staiger.se", epostVerifierad: true, namn: "Claes Philip" });
    expect((await full.read("memberships", medlemskapsId(CP, "g")))?.namn).toBe("Profilnamn");
  });

  it("uppdateraProfil: ett namnbyte ger ett medlemskap som saknade namn det nya, och rör inte andras", async () => {
    const utan = byggMedlemskap({ userId: CP, groupId: "g", roll: "agare", typ: "person", status: "aktiv", namn: "", bild: "" });
    const annans = byggMedlemskap({ userId: ANNAN, groupId: "g", roll: "medlem", typ: "person", status: "aktiv", namn: "", bild: "" });
    const kalla = createMemorySource({ users: [{ id: CP, namn: "", epost: "cp@staiger.se" }], memberships: [utan, annans] });
    const svar = await uppdateraProfil({ kalla, uid: CP, andring: { namn: "Claes Philip" } });
    expect(svar.medlemskapUppdaterade).toBe(1);
    expect((await kalla.read("memberships", utan.id))?.namn).toBe("Claes Philip");
    expect((await kalla.read("memberships", annans.id))?.namn).toBe("");
  });
});

describe("bakfyllMedlemsnamn", () => {
  const m = (/** @type {string} */ u, /** @type {string} */ g, /** @type {object} */ extra = {}) =>
    byggMedlemskap({ userId: u, groupId: g, roll: "medlem", typ: "person", status: "aktiv", namn: "", bild: "", ...extra });
  const underlag = () =>
    createMemorySource({
      users: [
        { id: CP, namn: "Claes Philip", epost: "cp@staiger.se" },
        { id: "u-utan-namn", namn: "", epost: "a@x.se" },
        { id: "u-har", namn: "Profilens", epost: "b@x.se" },
      ],
      memberships: [
        m(CP, "g1"),
        m(CP, "g2"),
        m("u-utan-namn", "g1"),
        m("u-utan-rad", "g1"),
        m("u-har", "g1", { namn: "Medlemskapets eget" }),
        m("agent-1", "g1", { typ: "agent" }),
      ],
    });

  it("⛔ torrkörning (förval) skriver ingenting och räknar allt, också nollorna", async () => {
    const kalla = underlag();
    const svar = await bakfyllMedlemsnamn({ kalla });
    expect(svar).toMatchObject({ skarpt: false, lasta: 6, saknar: 4, attFylla: 2, fyllda: 0, utanProfilnamn: 1, utanAnvandare: 1, fel: [] });
    expect(svar.kvar.map((k) => `${k.userId}:${k.skal}`).sort()).toEqual(["u-utan-namn:utan-profilnamn", "u-utan-rad:utan-anvandare"]);
    expect((await kalla.read("memberships", medlemskapsId(CP, "g1")))?.namn).toBe("");
  });

  it("⛔ skarpt fyller de som går, rör inte ett ifyllt namn, och en andra körning har inget kvar att fylla", async () => {
    const kalla = underlag();
    const svar = await bakfyllMedlemsnamn({ kalla, skarpt: true });
    expect(svar).toMatchObject({ skarpt: true, fyllda: 2, utanProfilnamn: 1, utanAnvandare: 1, fel: [] });
    expect((await kalla.read("memberships", medlemskapsId(CP, "g1")))?.namn).toBe("Claes Philip");
    expect((await kalla.read("memberships", medlemskapsId(CP, "g2")))?.namn).toBe("Claes Philip");
    expect((await kalla.read("memberships", medlemskapsId("u-har", "g1")))?.namn).toBe("Medlemskapets eget");
    const igen = await bakfyllMedlemsnamn({ kalla, skarpt: true });
    expect(igen).toMatchObject({ saknar: 2, attFylla: 0, fyllda: 0 });
  });

  it("kräver en datakälla med list, read och update, och namnger sig", async () => {
    await expect(bakfyllMedlemsnamn(/** @type {any} */ ({ kalla: { list() {} } }))).rejects.toThrow(/bakfyllMedlemsnamn: en datakälla/);
  });
});

describe("scripts/bakfyll-medlemsnamn.mjs", () => {
  it("kräver --projekt, och skriver bara med --skarpt", () => {
    expect(() => lasFlaggor([])).toThrow(/--projekt/);
    expect(lasFlaggor(["--projekt", "p"])).toEqual({ projekt: "p", skarpt: false, anvandare: "users", medlemskap: "memberships" });
    expect(lasFlaggor(["--projekt", "p", "--skarpt"]).skarpt).toBe(true);
  });
  it("⛔ rapporten skriver ut varje mått också när det är 0", () => {
    const text = rapport({ skarpt: false, lasta: 0, saknar: 0, attFylla: 0, fyllda: 0, utanProfilnamn: 0, utanAnvandare: 0, kvar: [], fel: [] }).join("\n");
    for (const rubrik of ["lästa:", "saknar namn:", "att fylla:", "fyllda:", "utan profilnamn:", "utan användare:", "fel:"]) expect(text).toContain(rubrik);
    expect(text).toContain("TORRKÖRNING");
  });
});
