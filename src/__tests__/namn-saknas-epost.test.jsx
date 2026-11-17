import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { OpsMottagare } from "../components/OpsMottagare.jsx";
import { OpsMedlemmar } from "../components/OpsMedlemmar.jsx";
import { OpsGruppSida } from "../components/OpsGruppSida.jsx";
import { OpsSvar } from "../components/OpsSvar.jsx";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla } from "../data/samtalskalla.js";
import { NAMN_SAKNAS, glomVarnade, personnamn } from "../lib/personnamn.js";
import { agentMedlemskap, byggMedlemskap, medlemskapsId } from "../lib/grupp.js";
import { medlemsinfo } from "../lib/gruppmedlemmar.js";
import { createGroupService } from "../node/grupp.js";
import { createInvitationService } from "../node/inbjudan.js";
import { bakfyllMedlemsnamn, uppdateraProfil } from "../node/profil.js";
import { rapport } from "../../scripts/bakfyll-medlemsnamn.mjs";

/**
 * ⛔ HÄNDELSEN (0.234.0, cllp/lifehub.app#861). CP 2026-11-16: "När Collan hade loggat in stod hans namn som Namn Saknas
 * innan han gick ut och sparade om sin profil." Och samma kväll: "Det får ALDRIG stå namn saknas. Det måste alltid finnas
 * en fallback på eposten."
 *
 * Proven mäter tre saker: att adressen visas i stället för "Namn saknas" i varje vy som ritar en medlem, att medlemskapet
 * bär adressen från början, och att ett tomt namn aldrig skrivs, varken som ny rad eller över en befintlig.
 */

const CP = "eA2ILzNei5TQ2rcHy68aBZPpR1B3";
const COLLAN = "Xq9TmP4aLw2RbVn7Kc1HdYe3Zs6F";
const ADRESS = "collan@exempel.se";

beforeEach(() => glomVarnade());
afterEach(() => vi.restoreAllMocks());

describe("personnamn: adressen före 'Namn saknas'", () => {
  it("⛔ en annans rad utan namn men med adress visar adressen, inte 'Namn saknas'", () => {
    expect(personnamn("", { id: COLLAN, inloggad: { id: CP, namn: "Claes Philip" }, epost: ADRESS })).toEqual({ text: ADRESS, saknas: false });
  });
  it("utan både namn och adress står 'Namn saknas', märkt som saknat", () => {
    expect(personnamn("", { id: COLLAN, inloggad: { id: CP }, epost: "" })).toEqual({ text: NAMN_SAKNAS, saknas: true });
    expect(personnamn(undefined, { id: COLLAN })).toEqual({ text: NAMN_SAKNAS, saknas: true });
  });
  it("ett namn som finns vinner alltid över adressen", () => {
    expect(personnamn("Collan", { id: COLLAN, epost: ADRESS })).toEqual({ text: "Collan", saknas: false });
  });
  it("den inloggades eget namn går före radens adress", () => {
    expect(personnamn("", { id: CP, inloggad: { id: CP, namn: "Claes Philip" }, epost: "cp@staiger.se" }).text).toBe("Claes Philip");
  });
});

describe("⛔ varje vy som ritar en medlem visar adressen när namnet saknas", () => {
  const rad = (/** @type {string} */ userId, /** @type {object} */ extra = {}) => ({ userId, typ: "person", status: "aktiv", ...extra });

  it("OpsMedlemmar", () => {
    const m = byggMedlemskap({ userId: COLLAN, groupId: "g", roll: "medlem", typ: "person", status: "aktiv", bild: "", epost: ADRESS });
    const { container } = render(<OpsMedlemmar medlemmar={[{ medlemskap: m }]} migUid={CP} />);
    expect(container.textContent).toContain(ADRESS);
    expect(container.textContent).not.toContain(NAMN_SAKNAS);
    expect(container.querySelector("[data-namn-saknas]")).toBeNull();
  });

  it("OpsGruppSida, med raderna ur medlemsinfo", () => {
    const { medlemmar } = medlemsinfo([{ userId: COLLAN, groupId: "g", roll: "medlem", typ: "person", status: "aktiv", epost: ADRESS }]);
    const { container } = render(<OpsGruppSida grupp={/** @type {any} */ ({ id: "g", namn: { sv: "Alfa", en: "Alfa" }, roll: "medlem" })} medlemmar={medlemmar} />);
    expect(container.textContent).toContain(ADRESS);
    expect(container.querySelector("[data-namn-saknas]")).toBeNull();
  });

  it("OpsMottagare", () => {
    const { container } = render(<OpsMottagare lage="arende" medlemmar={[rad(CP, { namn: "Claes Philip" }), rad(COLLAN, { epost: ADRESS })]} uid={CP} value={{ slag: "grupp" }} onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: ADRESS })).toBeInTheDocument();
    expect(container.querySelector("[data-namn-saknas]")).toBeNull();
  });

  it("OpsSvar", () => {
    const { container } = render(<OpsSvar svar={[]} medlemmar={[{ uid: COLLAN, namn: "", epost: ADRESS }]} uid={CP} onSvara={() => {}} />);
    expect(container.querySelector(`[data-svarsrad="${COLLAN}"]`)?.textContent).toContain(ADRESS);
    expect(container.querySelector("[data-namn-saknas]")).toBeNull();
  });

  it("OpsMeddelanden: avsändaren i gruppchatten", async () => {
    const kalla = createMemorySource({});
    const samtal = createSamtalskalla({ kalla });
    const g = await samtal.oppnaGrupp({ groupId: "g", uid: CP });
    await samtal.skicka(g.id, { text: "Hej alla", av: COLLAN });
    const { container } = render(<OpsMeddelanden kalla={samtal} uid={CP} groupId="g" gruppNamn="Alfa AB" medlemmar={[rad(CP, { namn: "Claes Philip" }), rad(COLLAN, { epost: ADRESS })]} />);
    (await screen.findByRole("button", { name: /Alfa AB/ })).click();
    const vy = await screen.findByRole("log", { name: "Alfa AB" });
    expect(await within(vy).findByText(ADRESS, { exact: false })).toBeInTheDocument();
    expect(container.textContent).not.toContain(NAMN_SAKNAS);
  });
});

describe("medlemsinfo bär adressen", () => {
  it("⛔ medlemmar och avatarer har epost, tom sträng när den saknas", () => {
    const info = medlemsinfo([
      { userId: COLLAN, groupId: "g", roll: "medlem", typ: "person", status: "aktiv", epost: ADRESS },
      { userId: CP, groupId: "g", roll: "agare", typ: "person", status: "aktiv", namn: "Claes Philip" },
    ]);
    expect(info.medlemmar.find((m) => m.id === COLLAN)?.epost).toBe(ADRESS);
    expect(info.medlemmar.find((m) => m.id === CP)?.epost).toBe("");
    expect(info.avatarer.find((a) => a.id === COLLAN)?.epost).toBe(ADRESS);
  });
});

describe("byggMedlemskap: aldrig ett tomt namn, adressen i gemener", () => {
  it("⛔ ett tomt namn utelämnas, det skrivs inte som tom sträng", () => {
    const m = byggMedlemskap({ userId: COLLAN, groupId: "g", roll: "medlem", typ: "person", status: "aktiv", namn: "  ", bild: "" });
    expect("namn" in m).toBe(false);
  });
  it("⛔ adressen följer med, i gemener, och utelämnas när den saknas", () => {
    expect(byggMedlemskap({ userId: COLLAN, groupId: "g", roll: "medlem", typ: "person", status: "aktiv", epost: " Collan@Exempel.SE " }).epost).toBe(ADRESS);
    expect("epost" in byggMedlemskap({ userId: COLLAN, groupId: "g", roll: "medlem", typ: "person", status: "aktiv" })).toBe(false);
  });
  it("en agent bär sitt namn och ingen adress", () => {
    const a = agentMedlemskap("g");
    expect(a.namn).toBeTruthy();
    expect("epost" in a).toBe(false);
  });
});

describe("⛔ skrivvägarna ger medlemskapet adressen", () => {
  /** Collans läge: profilraden speglade en token utan namn, och anropet bar inget namn heller. */
  const collansKalla = () =>
    createMemorySource({
      users: [{ id: COLLAN, namn: "", epost: ADRESS }],
      memberships: [],
      invitations: [{ id: "i1", epost: ADRESS, groupId: "g", roll: "medlem", status: "vantar", skapadAv: { uid: null, namn: "", typ: "okand", kalla: "" } }],
    });

  it("accepteraInbjudningar: utan namn får medlemskapet adressen och inget tomt namn", async () => {
    const kalla = collansKalla();
    await createInvitationService({ kalla }).accepteraInbjudningar({ uid: COLLAN, epost: ADRESS, epostVerifierad: true });
    const m = await kalla.read("memberships", medlemskapsId(COLLAN, "g"));
    expect(m?.epost).toBe(ADRESS);
    expect(m && "namn" in m).toBe(false);
  });

  it("accepteraInbjudningar: adressen ur inloggningen när profilraden saknas", async () => {
    const kalla = createMemorySource({
      users: [],
      memberships: [],
      invitations: [{ id: "i1", epost: ADRESS, groupId: "g", roll: "medlem", status: "vantar", skapadAv: { uid: null, namn: "", typ: "okand", kalla: "" } }],
    });
    await createInvitationService({ kalla }).accepteraInbjudningar({ uid: COLLAN, epost: "Collan@Exempel.se", epostVerifierad: true, namn: "Collan" });
    const m = await kalla.read("memberships", medlemskapsId(COLLAN, "g"));
    expect(m).toMatchObject({ namn: "Collan", epost: ADRESS });
  });

  it("⛔ hela kedjan: den som just gått med syns med sin adress för de andra, inte som 'Namn saknas'", async () => {
    const kalla = collansKalla();
    await createInvitationService({ kalla }).accepteraInbjudningar({ uid: COLLAN, epost: ADRESS, epostVerifierad: true });
    const rader = /** @type {any[]} */ (await kalla.list("memberships"));
    const { container } = render(<OpsMedlemmar medlemmar={rader.map((medlemskap) => ({ medlemskap }))} migUid={CP} />);
    expect(container.textContent).toContain(ADRESS);
    expect(container.textContent).not.toContain(NAMN_SAKNAS);
  });

  it("accepteraInbjudningar: ett avslutat medlemskap utan adress får den när det återaktiveras", async () => {
    const gammal = byggMedlemskap({ userId: COLLAN, groupId: "g", roll: "medlem", typ: "person", status: "avslutad", bild: "" });
    const kalla = createMemorySource({
      users: [{ id: COLLAN, namn: "", epost: ADRESS }],
      memberships: [gammal],
      invitations: [{ id: "i1", epost: ADRESS, groupId: "g", roll: "medlem", status: "vantar", skapadAv: { uid: null, namn: "", typ: "okand", kalla: "" } }],
    });
    const svar = await createInvitationService({ kalla }).accepteraInbjudningar({ uid: COLLAN, epost: ADRESS, epostVerifierad: true, namn: "Collan" });
    expect(svar.accepterade).toEqual(["g"]);
    expect(await kalla.read("memberships", gammal.id)).toMatchObject({ status: "aktiv", epost: ADRESS, namn: "Collan" });
  });

  it("skapaGrupp: ägarens medlemskap bär adressen, och inget tomt namn", async () => {
    const kalla = createMemorySource({ memberships: [], groups: [], users: [{ id: CP, namn: "", epost: "" }], invitations: [] });
    const { skapaGrupp } = createGroupService({ kalla, vitlistaKravs: false });
    const svar = await skapaGrupp({ uid: CP, epost: "CP@staiger.se", grupp: { namn: "Mitt bolag" } });
    const m = await kalla.read("memberships", medlemskapsId(CP, svar.groupId));
    expect(m?.epost).toBe("cp@staiger.se");
    expect(m && "namn" in m).toBe(false);
  });
});

describe("⛔ uppdateraProfil: ett tomt namn skriver aldrig över ett befintligt", () => {
  it("en token med bild men utan namn lämnar namnet i users och i medlemskapen", async () => {
    const mitt = byggMedlemskap({ userId: COLLAN, groupId: "g", roll: "medlem", typ: "person", status: "aktiv", namn: "Collan", bild: "" });
    const kalla = createMemorySource({ users: [{ id: COLLAN, namn: "Collan", epost: ADRESS }], memberships: [mitt] });
    await uppdateraProfil({ kalla, uid: COLLAN, andring: { namn: "", bild: "https://exempel.se/b.png" } });
    expect((await kalla.read("users", COLLAN))?.namn).toBe("Collan");
    const m = await kalla.read("memberships", mitt.id);
    expect(m?.namn).toBe("Collan");
    expect(m?.bild).toBe("https://exempel.se/b.png");
  });

  it("utan namn någonstans skrivs inget tomt namn på medlemskapet", async () => {
    const utan = byggMedlemskap({ userId: COLLAN, groupId: "g", roll: "medlem", typ: "person", status: "aktiv", bild: "", epost: ADRESS });
    const kalla = createMemorySource({ users: [{ id: COLLAN, namn: "", epost: ADRESS }], memberships: [utan] });
    await uppdateraProfil({ kalla, uid: COLLAN, andring: { namn: "", bild: "https://exempel.se/b.png" } });
    const m = await kalla.read("memberships", utan.id);
    expect(m?.namn ?? null).toBeNull();
    expect(m?.epost).toBe(ADRESS);
  });
});

describe("bakfyllMedlemsnamn med reserv", () => {
  const underlag = () =>
    createMemorySource({
      users: [
        { id: COLLAN, namn: "", epost: ADRESS },
        { id: "u-har", namn: "Profilens", epost: "b@x.se" },
      ],
      memberships: [
        byggMedlemskap({ userId: COLLAN, groupId: "g1", roll: "medlem", typ: "person", status: "aktiv", bild: "" }),
        byggMedlemskap({ userId: COLLAN, groupId: "g2", roll: "medlem", typ: "person", status: "aktiv", bild: "" }),
        byggMedlemskap({ userId: "u-utan-rad", groupId: "g1", roll: "medlem", typ: "person", status: "aktiv", bild: "" }),
        byggMedlemskap({ userId: "u-har", groupId: "g1", roll: "medlem", typ: "person", status: "aktiv", bild: "" }),
      ],
    });
  const identity = /** @type {Record<string, string>} */ ({ [COLLAN]: "Collan Identity", "u-utan-rad": "Utan Rad" });

  it("⛔ torrkörning (förval) frågar reserven, räknar planen och skriver ingenting", async () => {
    const kalla = underlag();
    const reserv = vi.fn(async (/** @type {string} */ uid) => identity[uid]);
    const svar = await bakfyllMedlemsnamn({ kalla, reserv });
    expect(svar).toMatchObject({ skarpt: false, saknar: 4, attFylla: 4, franReserv: 3, fyllda: 0, utanProfilnamn: 0, utanAnvandare: 0, fel: [] });
    expect(reserv).toHaveBeenCalledTimes(2);
    expect((await kalla.read("memberships", medlemskapsId(COLLAN, "g1")))?.namn ?? null).toBeNull();
  });

  it("⛔ skarpt fyller ur reserven när profilen saknar namn, och ur profilen när den har ett", async () => {
    const kalla = underlag();
    const svar = await bakfyllMedlemsnamn({ kalla, skarpt: true, reserv: (uid) => identity[uid] });
    expect(svar).toMatchObject({ fyllda: 4, franReserv: 3, fel: [] });
    expect((await kalla.read("memberships", medlemskapsId(COLLAN, "g2")))?.namn).toBe("Collan Identity");
    expect((await kalla.read("memberships", medlemskapsId("u-utan-rad", "g1")))?.namn).toBe("Utan Rad");
    expect((await kalla.read("memberships", medlemskapsId("u-har", "g1")))?.namn).toBe("Profilens");
  });

  it("en reserv som kastar blir ett fel i listan, och raden står kvar med sitt skäl", async () => {
    const kalla = underlag();
    const svar = await bakfyllMedlemsnamn({
      kalla,
      skarpt: true,
      reserv: () => {
        throw new Error("Identity svarade 503");
      },
    });
    expect(svar.fel.some((f) => f.includes("Identity svarade 503"))).toBe(true);
    expect(svar).toMatchObject({ fyllda: 1, franReserv: 0, utanProfilnamn: 2, utanAnvandare: 1 });
  });

  it("en reserv som inte är en funktion avvisas", async () => {
    await expect(bakfyllMedlemsnamn({ kalla: underlag(), reserv: /** @type {any} */ ("Identity") })).rejects.toThrow(/reserv ska vara en funktion/);
  });

  it("rapporten skriver raden 'ur reserven', också när den är 0", () => {
    const text = rapport({ skarpt: false, lasta: 0, saknar: 0, attFylla: 0, franReserv: 0, fyllda: 0, utanProfilnamn: 0, utanAnvandare: 0, kvar: [], fel: [] }).join("\n");
    expect(text).toContain("ur reserven:      0");
  });
});
