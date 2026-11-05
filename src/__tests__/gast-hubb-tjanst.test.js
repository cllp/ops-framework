import { describe, expect, it, vi } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { GASTIP_MAX, GASTLANKDAGAR, GASTSESSIONSDAGAR } from "../lib/gast.js";
import { medlemskapsId } from "../lib/grupp.js";
import { createGastService } from "../node/gast.js";

/**
 * Gästgrupperna i hubben (0.188.0, cllp/lifehub.app#658 punkt 0): en inloggad person med BEKRÄFTAD adress ser sina gruppinbjudningar och öppnar dem utan mejllänken.
 *
 * ⛔ UTAN NÄTVERK OCH UTAN FIREBASE, som `gast-grupp-tjanst.test.js`. ⛔ VARJE PROV HAR BEVISATS I BÅDA RIKTNINGARNA (regel 4): rött med koden muterad, grönt med den. Utfallen står i PR-texten.
 */

const NU = 1_800_000_000_000;
const DYGN = 24 * 60 * 60 * 1000;
const GRUPP = "kallan";
const GRANNEN = "grannen";
const AGARE = "uid-agare";
const IP = "203.0.113.7";

const medlemskap = (uid, groupId, roll) => ({ id: medlemskapsId(uid, groupId), userId: uid, groupId, roll, typ: "person", status: "aktiv", namn: `Namn ${uid}` });

function bygg() {
  const grund = createMemorySource({
    memberships: [medlemskap(AGARE, GRUPP, "agare"), medlemskap(AGARE, GRANNEN, "agare")],
    groups: [{ id: GRUPP, namn: "Källan" }, { id: GRANNEN, namn: "Ängen" }],
    handelser: [{ id: "h1", groupId: GRUPP, rubrik: "Möte", skapadAv: { uid: AGARE } }],
    gastinbjudningar: [],
    gastsessioner: [],
    gastplatser: [],
    gastraknare: [],
  });
  let nu = NU;
  /** @type {any[]} */
  const brev = [];
  const tjanst = createGastService({
    kalla: grund,
    samlingar: { inbjudningar: "gastinbjudningar", sessioner: "gastsessioner", platser: "gastplatser", raknare: "gastraknare", handelser: "handelser" },
    farBjuda: ({ uid, handelse }) => handelse.skapadAv?.uid === uid,
    skicka: async (b) => void brev.push(b),
    rapportera: vi.fn(),
    klocka: () => nu,
    grupp: {
      samlingar: { grupper: "groups", samtal: "samtal", meddelanden: "meddelanden", bibliotek: "bibliotek", svar: "svar" },
      lagring: { signeradAdress: async () => "https://lagring.example/x" },
      handelseSida: (h) => ({ titel: h.rubrik }),
    },
    radering: { roster: async () => {}, spar: async () => {} },
  });
  return { grund, tjanst, brev, tid: (/** @type {number} */ t) => { nu = t; } };
}

/** Bjuder in till hela gruppen och ger inbjudans id. */
async function bjudGrupp(h, epost, groupId = GRUPP) {
  return (await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId, epost, namn: "Collan" })).id;
}

describe("minaGruppgaster: vad hubben listar", () => {
  it("listar gruppen med id och namn, och bara det, för en bekräftad adress (versaler och mellanrum spelar ingen roll)", async () => {
    const h = bygg();
    const id = await bjudGrupp(h, "collan@foretag.se");
    const svar = await h.tjanst.minaGruppgaster({ epost: "  Collan@Foretag.se ", epostBekraftad: true });
    expect(svar).toEqual({ gruppgaster: [{ id, groupId: GRUPP, namn: "Källan" }] });
    // Inget annat än id, grupp och namn lämnar tjänsten: ingen adress, ingen nyckel, ingen inbjudare.
    expect(JSON.stringify(svar)).not.toMatch(/collan@|nyckel|uid-agare/i);
  });

  it("en obekräftad adress ger en tom lista och inget fel, hur inbjudan än ser ut", async () => {
    const h = bygg();
    await bjudGrupp(h, "collan@foretag.se");
    for (const epostBekraftad of [false, undefined, "true", 1, null]) {
      await expect(h.tjanst.minaGruppgaster({ epost: "collan@foretag.se", epostBekraftad }), String(epostBekraftad)).resolves.toEqual({ gruppgaster: [] });
    }
    await expect(h.tjanst.minaGruppgaster({ epost: "collan@foretag.se" })).resolves.toEqual({ gruppgaster: [] });
  });

  it("en annan adress ser inget, och en adress som inte är en adress ser inget", async () => {
    const h = bygg();
    await bjudGrupp(h, "collan@foretag.se");
    await expect(h.tjanst.minaGruppgaster({ epost: "annan@foretag.se", epostBekraftad: true })).resolves.toEqual({ gruppgaster: [] });
    await expect(h.tjanst.minaGruppgaster({ epost: "", epostBekraftad: true })).resolves.toEqual({ gruppgaster: [] });
    await expect(h.tjanst.minaGruppgaster({ epostBekraftad: true })).resolves.toEqual({ gruppgaster: [] });
  });

  it("en återkallad och en inbjudan till en raderad grupp räknas inte; en levande gör det", async () => {
    const h = bygg();
    const levande = await bjudGrupp(h, "collan@foretag.se");
    const aterkallad = await bjudGrupp(h, "collan@foretag.se", GRANNEN);
    await h.tjanst.aterkalla({ uid: AGARE, id: aterkallad });
    expect((await h.tjanst.minaGruppgaster({ epost: "collan@foretag.se", epostBekraftad: true })).gruppgaster.map((g) => g.id)).toEqual([levande]);

    // Raderad grupp: inbjudan finns kvar men gruppen inte.
    await h.grund.remove("groups", GRUPP);
    await expect(h.tjanst.minaGruppgaster({ epost: "collan@foretag.se", epostBekraftad: true })).resolves.toEqual({ gruppgaster: [] });
  });

  it("⛔ EN INBJUDAN VARS LÄNK GÅTT UT LISTAS ÄNDÅ för den bekräftade adressen: länkens giltighet skyddar mejlnyckeln, inte den inloggade vägen", async () => {
    const h = bygg();
    const id = await bjudGrupp(h, "collan@foretag.se");
    h.tid(NU + (GASTLANKDAGAR + 1) * DYGN);
    expect((await h.tjanst.minaGruppgaster({ epost: "collan@foretag.se", epostBekraftad: true })).gruppgaster.map((g) => g.id)).toEqual([id]);
    // Men inte efter en återkallelse, hur gammal länken än är.
    await h.tjanst.aterkalla({ uid: AGARE, id });
    await expect(h.tjanst.minaGruppgaster({ epost: "collan@foretag.se", epostBekraftad: true })).resolves.toEqual({ gruppgaster: [] });
  });

  it("en inbjudan till en omröstning eller en händelse är ingen grupp och listas inte", async () => {
    const h = bygg();
    await h.tjanst.bjud({ uid: AGARE, handelseId: "h1", epost: "collan@foretag.se" });
    await expect(h.tjanst.minaGruppgaster({ epost: "collan@foretag.se", epostBekraftad: true })).resolves.toEqual({ gruppgaster: [] });
  });

  it("listar flera grupper i namnordning (Källan före Ängen), en rad per inbjudan", async () => {
    const h = bygg();
    const a = await bjudGrupp(h, "collan@foretag.se", GRANNEN);
    const b = await bjudGrupp(h, "collan@foretag.se", GRUPP);
    expect((await h.tjanst.minaGruppgaster({ epost: "collan@foretag.se", epostBekraftad: true })).gruppgaster.map((g) => g.id)).toEqual([b, a]);
  });
});

describe("oppnaGruppgast: samma session som länken, utan länken", () => {
  it("rätt person med bekräftad adress får en session som bara når den gruppen, och inget medlemskap skrivs", async () => {
    const h = bygg();
    const id = await bjudGrupp(h, "collan@foretag.se");
    const andra = await bjudGrupp(h, "collan@foretag.se", GRANNEN);
    const medlemmarFore = await h.grund.list("memberships");
    const svar = await h.tjanst.oppnaGruppgast({ id, epost: "Collan@foretag.se", epostBekraftad: true, ip: IP });
    expect(svar).toMatchObject({ ok: true });
    const s = await h.tjanst.session({ sessionsnyckel: svar.sessionsnyckel });
    expect(s).toMatchObject({ ok: true, inbjudan: { id, groupId: GRUPP, slag: "grupp" } });
    // Sessionen hör till EN inbjudan: den andra gruppen når den inte.
    expect(s.inbjudan.groupId).not.toBe(GRANNEN);
    expect(andra).not.toBe(id);
    expect(await h.tjanst.hamta({ sessionsnyckel: svar.sessionsnyckel })).toMatchObject({ ok: true, funktion: "grupp", grupp: { namn: "Källan" } });
    // Inget medlemskap och ingen annan skrivning än sessionen och första inloggningen.
    expect(await h.grund.list("memberships")).toEqual(medlemmarFore);
    expect((await h.grund.read("gastinbjudningar", id)).forstInloggad).toBe(NU);
    expect(await h.grund.list("gastsessioner")).toHaveLength(1);
  });

  it("sessionen har samma form som den länken ger (samma rad i sessioner, samma livslängd)", async () => {
    const h = bygg();
    const id = await bjudGrupp(h, "collan@foretag.se");
    const lank = h.brev[0].lankar[0];
    const viaLank = await h.tjanst.los({ id: lank.id, nyckel: lank.nyckel, epost: "collan@foretag.se", ip: IP });
    const viaHubb = await h.tjanst.oppnaGruppgast({ id, epost: "collan@foretag.se", epostBekraftad: true, ip: IP });
    const [a, b] = await h.grund.list("gastsessioner");
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
    expect(a.inbjudningId).toBe(b.inbjudningId);
    expect(viaLank.sessionsnyckel).not.toBe(viaHubb.sessionsnyckel);
    h.tid(NU + (GASTSESSIONSDAGAR - 1) * DYGN);
    expect((await h.tjanst.session({ sessionsnyckel: viaHubb.sessionsnyckel })).ok).toBe(true);
  });

  it("fel adress, obekräftad adress, okänd inbjudan, inbjudan av fel slag och skräp är ETT nej, byte för byte", async () => {
    const h = bygg();
    const id = await bjudGrupp(h, "collan@foretag.se");
    const sak = (await h.tjanst.bjud({ uid: AGARE, handelseId: "h1", epost: "collan@foretag.se" })).id;
    const nej = { ok: false, orsak: "nej" };
    const fall = [
      { id, epost: "annan@foretag.se", epostBekraftad: true },
      { id, epost: "collan@foretag.se", epostBekraftad: false },
      { id, epost: "collan@foretag.se" },
      { id, epost: "collan@foretag.se", epostBekraftad: "true" },
      { id: "0".repeat(64), epost: "collan@foretag.se", epostBekraftad: true },
      { id: sak, epost: "collan@foretag.se", epostBekraftad: true },
      { id: "kort", epost: "collan@foretag.se", epostBekraftad: true },
      { epost: "collan@foretag.se", epostBekraftad: true },
      { id, epost: 7, epostBekraftad: true },
    ];
    for (const f of fall) expect(await h.tjanst.oppnaGruppgast({ ...f, ip: IP }), JSON.stringify(f)).toEqual(nej);
    expect(await h.grund.list("gastsessioner")).toHaveLength(0);
    expect((await h.grund.read("gastinbjudningar", id)).forstInloggad).toBeNull();
  });

  it("en återkallad inbjudan nekas (aterkallad), men bara när adressen stämde", async () => {
    const h = bygg();
    const id = await bjudGrupp(h, "collan@foretag.se");
    await h.tjanst.aterkalla({ uid: AGARE, id });
    expect(await h.tjanst.oppnaGruppgast({ id, epost: "collan@foretag.se", epostBekraftad: true, ip: IP })).toEqual({ ok: false, orsak: "aterkallad" });
    // En främling får inte veta att den är återkallad.
    expect(await h.tjanst.oppnaGruppgast({ id, epost: "annan@foretag.se", epostBekraftad: true, ip: IP })).toEqual({ ok: false, orsak: "nej" });
    expect(await h.grund.list("gastsessioner")).toHaveLength(0);
  });

  it("⛔ en inbjudan vars länk gått ut öppnas ändå för den bekräftade adressen (som nyLank skickar en ny länk), och sessionen gäller", async () => {
    const h = bygg();
    const id = await bjudGrupp(h, "collan@foretag.se");
    h.tid(NU + (GASTLANKDAGAR + 1) * DYGN);
    const svar = await h.tjanst.oppnaGruppgast({ id, epost: "collan@foretag.se", epostBekraftad: true, ip: IP });
    expect(svar).toMatchObject({ ok: true });
    expect(await h.tjanst.hamta({ sessionsnyckel: svar.sessionsnyckel })).toMatchObject({ ok: true, funktion: "grupp" });
  });

  it("samma tak per IP som länken: efter GASTIP_MAX misslyckade försök nekas också en rätt person (for-manga), och ett lyckat anrop ger tillbaka sitt försök", async () => {
    const h = bygg();
    const id = await bjudGrupp(h, "collan@foretag.se");
    // Lyckade anrop äter inte taket.
    for (let i = 0; i < GASTIP_MAX + 3; i++) expect((await h.tjanst.oppnaGruppgast({ id, epost: "collan@foretag.se", epostBekraftad: true, ip: IP })).ok, `lyckat ${i}`).toBe(true);
    for (let i = 0; i < GASTIP_MAX; i++) expect(await h.tjanst.oppnaGruppgast({ id, epost: "fel@foretag.se", epostBekraftad: true, ip: IP })).toEqual({ ok: false, orsak: "nej" });
    expect(await h.tjanst.oppnaGruppgast({ id, epost: "collan@foretag.se", epostBekraftad: true, ip: IP })).toEqual({ ok: false, orsak: "for-manga" });
    // Länkens väg delar räknaren: samma IP är redan stoppad där.
    const lank = h.brev[0].lankar[0];
    expect(await h.tjanst.los({ id: lank.id, nyckel: lank.nyckel, epost: "collan@foretag.se", ip: IP })).toEqual({ ok: false, orsak: "for-manga" });
    // En annan IP påverkas inte.
    expect((await h.tjanst.oppnaGruppgast({ id, epost: "collan@foretag.se", epostBekraftad: true, ip: "198.51.100.9" })).ok).toBe(true);
  });

  it("ett misslyckande låser inte ute gästen på inbjudan: ingen räknare per inbjudan, bara per IP", async () => {
    const h = bygg();
    const id = await bjudGrupp(h, "collan@foretag.se");
    for (let i = 0; i < 20; i++) await h.tjanst.oppnaGruppgast({ id, epost: "fel@foretag.se", epostBekraftad: true, ip: `198.51.100.${i}` });
    expect((await h.grund.read("gastinbjudningar", id)).felAntal).toBe(0);
    expect((await h.tjanst.oppnaGruppgast({ id, epost: "collan@foretag.se", epostBekraftad: true, ip: IP })).ok).toBe(true);
  });

  it("ip krävs som i los: utan den kastar tjänsten i stället för att tyst sluta räkna", async () => {
    const h = bygg();
    const id = await bjudGrupp(h, "collan@foretag.se");
    await expect(h.tjanst.oppnaGruppgast({ id, epost: "collan@foretag.se", epostBekraftad: true })).rejects.toThrow(/ip krävs/);
  });
});
