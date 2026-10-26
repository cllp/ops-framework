import { describe, expect, it, vi } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import {
  GASTDELTAATGARDER,
  GASTDELTAHANDELSEFALT,
  GASTDELTALISTFALT,
  GASTDELTARADFALT,
  GASTDELTASVAR,
  GASTFUNKTIONER,
  GASTGRUPPATGARDER,
  GASTANROP_PER_MINUT,
  GASTSVARSFALT,
  GAST_PLATSER_GRATIS,
  gastId,
  gastOmfangGer,
  gastomfangsnyckel,
} from "../lib/gast.js";
import { SVARSVAL } from "../lib/handelsemodell.js";
import { medlemskapsId } from "../lib/grupp.js";
import { byggGastinbjudan, createGastService, gastInbjudningsId, nyGastnyckel } from "../node/gast.js";
import { andringsnyckel } from "../node/ics.js";

/**
 * Gästerna, funktionen `delta` (0.146.0, cllp/ops-framework#445, skiva 1): en gäst för en sak svarar Kommer, Kommer inte eller Kanske på en händelse och ser dess rubrik, tid och plats, inget annat.
 *
 * ⛔ UTAN NÄTVERK OCH UTAN FIREBASE: minneskällan räcker, och appens delar (händelsens fält, omröstningen, ärendena, lagringen) är små stand-ins som provet äger.
 * ⛔ VARJE PROV HAR BEVISATS I BÅDA RIKTNINGARNA (arbetsreglerna, punkt 4): rött utan ändringen (funktionen och metoderna finns inte), och för vakterna rött med koden muterad. Utfallen står i PR-texten.
 */

const NU = 1_800_000_000_000;
const MINUT = 60 * 1000;
const GRUPP = "kallan";
const GRANNEN = "grannen";
const AGARE = "uid-agare-d1";
const ADMIN = "uid-admin-d2";
const SKAPARE = "uid-skapare-d3";
const MEDLEM = "uid-medlem-d4";
const SLUTAD = "uid-slutad-d5";
const AGENT = "uid-agent-d6";
const UTANFOR = "uid-utanfor-d7";
const IP = "203.0.113.9";

const ANNA = "anna@foretag.se";
const BO = "bo@foretag.se";

const medlemskap = (uid, groupId, roll, namn, extra = {}) => ({ id: medlemskapsId(uid, groupId), userId: uid, groupId, roll, typ: "person", status: "aktiv", namn, epost: `${namn.split(" ")[0].toLowerCase()}.hemlig@privat.example`, ...extra });

/** Det som aldrig får nå en delta-gäst. Positiv kontroll av vad som SKA synas görs separat. */
const HEMLIGHETER = [
  "HEMLIG-BESKRIVNING",
  "HEMLIGT-APPFALT",
  "uid-agare-d1",
  "uid-skapare-d3",
  "uid-medlem-d4",
  "agda.hemlig@privat.example",
  "maja.hemlig@privat.example",
  "PRIVAT-SAMTALSTEXT",
  "GRUPPENS-ARENDE",
  "GRANNENS-HEMLIGHET",
  "OMROSTNINGENS-FORSLAG",
  "bo@foretag.se",
  "HANDELSEFIL-HEMLIG",
  "Möte i Grannen",
];

function seed() {
  return {
    memberships: [
      medlemskap(AGARE, GRUPP, "agare", "Agda Ägare"),
      medlemskap(ADMIN, GRUPP, "admin", "Adam Admin"),
      medlemskap(SKAPARE, GRUPP, "medlem", "Sture Skapare"),
      medlemskap(MEDLEM, GRUPP, "medlem", "Maja Medlem"),
      medlemskap(SLUTAD, GRUPP, "medlem", "Gunnar Gammal", { status: "avslutad" }),
      medlemskap(AGENT, GRUPP, "admin", "Agent", { typ: "agent" }),
      medlemskap(UTANFOR, GRANNEN, "agare", "Ulla Utanför"),
    ],
    groups: [{ id: GRUPP, namn: "Källan" }],
    handelser: [
      { id: "h-mote", groupId: GRUPP, rubrik: "Möte", text: "HEMLIG-BESKRIVNING", plats: "Salen, Visby", datum: "2026-12-02", tid: "18:00", slutTid: "20:00", kravSvar: true, skapadAv: { uid: SKAPARE, epost: "agda.hemlig@privat.example" }, intern: "HEMLIGT-APPFALT" },
      { id: "h-dag", groupId: GRUPP, rubrik: "Städdag", datum: "2026-12-05", slutDatum: "2026-12-06", heldag: true, skapadAv: { uid: SKAPARE } },
      { id: "h-ejsatt", groupId: GRUPP, rubrik: "Fika", text: "Vilken dag passar?", kravSvar: true, skapadAv: { uid: SKAPARE } },
      { id: "h-arkiv", groupId: GRUPP, rubrik: "Gammal", datum: "2026-01-01", arkiverad: true, skapadAv: { uid: SKAPARE } },
      { id: "h-grannen", groupId: GRANNEN, rubrik: "Möte i Grannen", plats: "GRANNENS-HEMLIGHET", datum: "2026-12-03", skapadAv: { uid: UTANFOR } },
    ],
    "handelser/h-mote/svar": [{ id: MEDLEM, svar: "kommer" }],
    "handelser/h-ejsatt/svar": [],
    [`samtal/${GRUPP}|grupp/meddelanden`]: [{ id: "m1", text: "Välkommen", av: AGARE, tid: 1000 }],
    [`samtal/${GRUPP}|${ADMIN}|${MEDLEM}/meddelanden`]: [{ id: "p1", text: "PRIVAT-SAMTALSTEXT", av: ADMIN, tid: 1500 }],
    bibliotek: [
      { id: "p-pdf", groupId: GRUPP, typ: "fil", rubrik: "Låtlista", fil: { sokvag: "grupper/kallan/bibliotek/p-pdf/lat.pdf", namn: "lat.pdf", mime: "application/pdf", byte: 1200, klar: true }, skapadAv: { uid: MEDLEM, namn: "Maja Medlem" }, skapad: 5000, andrad: 5000 },
      { id: "p-hand", groupId: `handelse~${GRUPP}~h-mote`, typ: "fil", rubrik: "HANDELSEFIL-HEMLIG", fil: { sokvag: "grupper/handelse~kallan~h-mote/bibliotek/p-hand/x.pdf", namn: "x.pdf", mime: "application/pdf", byte: 1, klar: true }, skapadAv: { uid: AGARE, namn: "Agda" }, skapad: 1, andrad: 1 },
    ],
    arenden: [{ id: "a-grupp", groupId: GRUPP, rubrik: "GRUPPENS-ARENDE", text: "x", status: "ny", skapad: "2026-10-08", mottagare: { slag: "grupp" } }],
    datumroster: [],
    gastinbjudningar: [],
    gastsessioner: [],
    gastplatser: [],
    gastraknare: [],
    mejlko: [],
  };
}

/**
 * @param {object} [val]
 * @param {(k: any) => any} [val.omslut]
 * @param {boolean} [val.utanDelta]
 * @param {boolean} [val.utanGrupp]
 * @param {(a: any) => boolean} [val.farBjuda]
 */
function bygg({ omslut = (k) => k, utanDelta = false, utanGrupp = false, farBjuda: farBjudaEgen = null } = {}) {
  const grund = createMemorySource(seed());
  const kalla = omslut(grund);
  let nu = NU;
  /** @type {any[]} */
  const brev = [];
  const skickaFel = { fel: /** @type {null | ((b: any) => boolean)} */ (null) };
  const skicka = vi.fn(async (b) => {
    if (skickaFel.fel && skickaFel.fel(b)) throw new Error("brevtjänsten nekade");
    brev.push(b);
  });
  const bygget = vi.fn(async ({ handelse }) => ({ forslag: [{ id: "f1", datum: "2026-12-01", rubrik: "OMROSTNINGENS-FORSLAG" }], titel: handelse.rubrik }));
  const arendeStandIn = {
    samling: "arenden",
    falt: ["rubrik", "text", "status"],
    bygg: ({ rad }) => ({ rubrik: rad.rubrik, text: rad.text, status: rad.status }),
    kommentarer: async () => [],
    kommentera: async () => ({ id: "k1" }),
    markeraKlart: async () => ({ ok: true }),
    radera: async () => 0,
  };
  const tjanst = createGastService({
    kalla,
    samlingar: { inbjudningar: "gastinbjudningar", sessioner: "gastsessioner", platser: "gastplatser", raknare: "gastraknare", handelser: "handelser" },
    // Appens regel, per funktion: omröstningen bara medan datumet inte är valt (som i lifehub.app), delta för skaparen, en admin eller en ägare.
    farBjuda: farBjudaEgen ?? (({ uid, medlemskap: m, handelse, funktion }) => (funktion === "delta" ? handelse.skapadAv?.uid === uid || m.roll === "agare" || m.roll === "admin" : !handelse.datum && (handelse.skapadAv?.uid === uid || m.roll === "agare" || m.roll === "admin"))),
    skicka,
    rapportera: vi.fn(),
    klocka: () => nu,
    sak: { falt: ["forslag", "titel"], bygg: bygget },
    radering: { roster: vi.fn(async () => {}) },
    ...(utanDelta ? {} : { delta: { handelseSida: (h) => ({ titel: h.rubrik, plats: h.plats }) } }),
    ...(utanGrupp
      ? {}
      : {
          grupp: {
            samlingar: { grupper: "groups", samtal: "samtal", meddelanden: "meddelanden", bibliotek: "bibliotek", svar: "svar" },
            lagring: { signeradAdress: async () => "https://lagring.example/x" },
            handelseSida: (h) => ({ titel: h.rubrik, beskrivning: h.text, plats: h.plats }),
            arenden: arendeStandIn,
            omrostning: { falt: ["forslag"], bygg: async () => null, rosta: async () => ({ ok: true }) },
          },
        }),
  });
  return { grund, kalla, tjanst, brev, skicka, skickaFel, bygget, tid: (/** @type {number} */ t) => { nu = t; }, nu: () => nu };
}

/** Bjuder in en delta-gäst, löser in länken och ger sessionsnyckeln. */
async function deltaGast(h, { epost = ANNA, handelseId = "h-mote", uid = SKAPARE } = {}) {
  const svar = await h.tjanst.bjud({ uid, handelseId, funktion: "delta", epost });
  const lank = h.brev[h.brev.length - 1].lankar[0];
  const inl = await h.tjanst.los({ id: lank.id, nyckel: lank.nyckel, epost, ip: IP });
  expect(inl.ok, "inlösen").toBe(true);
  return { ...svar, sessionsnyckel: inl.sessionsnyckel, lank };
}

/** Samma för en omröstningsgäst (skiva 1, funktionen rosta) på en händelse utan datum. */
async function rostaGast(h, { epost = "rosta@foretag.se", handelseId = "h-ejsatt", uid = SKAPARE } = {}) {
  const svar = await h.tjanst.bjud({ uid, handelseId, epost });
  const lank = h.brev[h.brev.length - 1].lankar[0];
  const inl = await h.tjanst.los({ id: lank.id, nyckel: lank.nyckel, epost, ip: IP });
  expect(inl.ok).toBe(true);
  return { ...svar, sessionsnyckel: inl.sessionsnyckel, lank };
}

/** Samma för hela gruppen. */
async function gruppGast(h, epost = "grupp@foretag.se") {
  await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, epost });
  const lank = h.brev[h.brev.length - 1].lankar[0];
  const inl = await h.tjanst.los({ id: lank.id, nyckel: lank.nyckel, epost, ip: IP });
  expect(inl.ok).toBe(true);
  return { sessionsnyckel: inl.sessionsnyckel, lank };
}

const rader = async (h) => (await h.grund.list("gastinbjudningar")).sort((a, b) => a.skapad - b.skapad || a.id.localeCompare(b.id));
const rad = async (h, id) => (await h.grund.list("gastinbjudningar")).find((r) => r.id === id);

describe("lib: funktionen delta är en rad i en lista, och rosta är orörd", () => {
  it("GASTFUNKTIONER bär rosta och delta, och omfångets nyckel har funktionen i sig: rosta-id:t är exakt det skiva 1 skrev", () => {
    expect([...GASTFUNKTIONER]).toEqual(["rosta", "delta"]);
    expect(gastomfangsnyckel({ slag: "sak", funktion: "rosta", handelseId: "h1" })).toBe("sak:rosta:h1");
    expect(gastomfangsnyckel({ slag: "sak", funktion: "delta", handelseId: "h1" })).toBe("sak:delta:h1");
    expect(() => gastomfangsnyckel({ slag: "sak", funktion: "folja", handelseId: "h1" })).toThrow(/finns inte/);
    // Samma adress till samma händelse med två funktioner är två rader.
    const d = { groupId: GRUPP, epost: ANNA };
    expect(gastInbjudningsId({ ...d, omfang: { slag: "sak", funktion: "delta", handelseId: "h1" } })).not.toBe(gastInbjudningsId({ ...d, omfang: { slag: "sak", funktion: "rosta", handelseId: "h1" } }));
  });

  it("⛔ ett omfång ger EN funktion: delta ger delta och inget annat, rosta ger rosta, och inget av dem ger en gruppfunktion", () => {
    const delta = { slag: "sak", funktion: "delta", handelseId: "h1" };
    const rosta = { slag: "sak", funktion: "rosta", handelseId: "h1" };
    const grupp = { slag: "grupp" };
    expect(gastOmfangGer(delta, { slag: "sak", funktion: "delta" })).toBe(true);
    expect(gastOmfangGer(delta, { funktion: "delta" })).toBe(true);
    expect(gastOmfangGer(delta, { slag: "sak", funktion: "rosta" })).toBe(false);
    expect(gastOmfangGer(rosta, { slag: "sak", funktion: "delta" })).toBe(false);
    expect(gastOmfangGer(grupp, { slag: "sak", funktion: "delta" })).toBe(false);
    for (const f of ["chatt", "kalender", "bibliotek", "arenden"]) {
      expect(gastOmfangGer(delta, { slag: "grupp", funktion: f }), f).toBe(false);
      expect(gastOmfangGer(delta, { funktion: f }), f).toBe(false);
    }
  });

  it("svaren är medlemmens två (härledda, inte omskrivna) och kanske, och kanske finns inte hos medlemmen", () => {
    expect([...GASTDELTASVAR]).toEqual([...SVARSVAL, "kanske"]);
    expect(GASTDELTASVAR).toHaveLength(3);
    expect(SVARSVAL).not.toContain("kanske");
  });

  it("det en delta-gäst får se av händelsen är rubrik, plats och tid, och ingen beskrivning, ingen grupp och ingen annan", () => {
    expect([...GASTDELTAHANDELSEFALT].sort()).toEqual(["datum", "heldag", "plats", "slutDatum", "slutTid", "tid", "titel"].sort());
    for (const forbjuden of ["beskrivning", "text", "groupId", "skapadAv", "filer", "kommentarer"]) expect([...GASTDELTAHANDELSEFALT]).not.toContain(forbjuden);
    expect([...GASTDELTAATGARDER]).toEqual(["deltaSvara"]);
    expect([...GASTGRUPPATGARDER]).not.toContain("deltaSvara");
    expect([...GASTSVARSFALT]).toContain("delta");
    expect([...GASTDELTALISTFALT]).toEqual(["deltasvar"]);
    expect([...GASTDELTARADFALT]).toEqual(["deltasvar", "sekvens", "andringsnyckel"]);
  });
});

describe("byggGastinbjudan: en delta-rad bär svaret och SEQUENCE, de andra raderna är som förut", () => {
  const d = { groupId: GRUPP, epost: ANNA, namn: "", omfang: { slag: "sak", funktion: "delta", handelseId: "h-mote" }, skapadAv: { uid: SKAPARE, namn: "S" }, skapad: NU, nyckel: nyGastnyckel() };

  it("deltasvar är null, sekvens 0 och andringsnyckel är den som gavs, och en delta-rad utan nyckel kastar", () => {
    const r = byggGastinbjudan({ ...d, andringsnyckel: "abc123" });
    expect(r).toMatchObject({ deltasvar: null, sekvens: 0, andringsnyckel: "abc123" });
    expect(() => byggGastinbjudan(d)).toThrow(/andringsnyckel/);
    expect(() => byggGastinbjudan({ ...d, andringsnyckel: "" })).toThrow(/andringsnyckel/);
  });

  it("en rosta-rad och en grupp-rad har inga delta-fält", () => {
    for (const omfang of [{ slag: "sak", funktion: "rosta", handelseId: "h-mote" }, { slag: "grupp" }]) {
      const r = byggGastinbjudan({ ...d, omfang });
      for (const f of GASTDELTARADFALT) expect(Object.keys(r), f).not.toContain(f);
    }
  });
});

describe("createGastService: delta kräver det som skyddar", () => {
  const ok = () => ({ kalla: createMemorySource({}), samlingar: { inbjudningar: "a", sessioner: "b", platser: "c", raknare: "d", handelser: "e" }, farBjuda: () => true, skicka: async () => {} });

  it("delta kräver handelseSida och radering: en gäst som sparar adress och svar måste gå att radera", () => {
    expect(() => createGastService({ ...ok(), delta: { handelseSida: () => ({ titel: "x" }) }, radering: {} })).not.toThrow();
    expect(() => createGastService({ ...ok(), delta: {}, radering: {} })).toThrow(/delta\.handelseSida/);
    expect(() => createGastService({ ...ok(), delta: null, radering: {} })).toThrow(/delta\.handelseSida/);
    expect(() => createGastService({ ...ok(), delta: { handelseSida: () => ({ titel: "x" }) } })).toThrow(/radering krävs med delta/);
  });
});

describe("bjud med funktionen delta: vem får, och vad som skrivs", () => {
  it("en skapare bjuder in: raden bär svaret, SEQUENCE och nyckeln, brevet bär länken med händelsen, och inget returvärde bär nyckeln", async () => {
    const h = bygg();
    const svar = await h.tjanst.bjud({ uid: SKAPARE, handelseId: "h-mote", funktion: "delta", epost: " Anna@Foretag.se ", namn: "Anna" });
    expect(svar).toMatchObject({ ny: true, vackt: false, gastId: gastId(ANNA) });
    const [r] = await rader(h);
    expect(r).toMatchObject({ epost: ANNA, omfang: { slag: "sak", funktion: "delta", handelseId: "h-mote" }, deltasvar: null, sekvens: 0, aterkallad: null });
    expect(r.andringsnyckel).toBe(andringsnyckel({ datum: "2026-12-02", slutDatum: null, tid: "18:00", slutTid: "20:00", heldag: false, plats: "Salen, Visby" }));
    expect(h.brev).toHaveLength(1);
    expect(h.brev[0]).toMatchObject({ typ: "inbjudan", till: ANNA, namn: "Anna" });
    expect(h.brev[0].lankar).toEqual([
      {
        id: r.id,
        nyckel: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
        groupId: GRUPP,
        omfang: { slag: "sak", funktion: "delta", handelseId: "h-mote" },
        sekvens: 0,
        handelse: { id: "h-mote", titel: "Möte", plats: "Salen, Visby", datum: "2026-12-02", slutDatum: null, tid: "18:00", slutTid: "20:00", heldag: false },
      },
    ]);
    expect(JSON.stringify(svar)).not.toContain(h.brev[0].lankar[0].nyckel);
    // Brevets händelse bär samma tre fält som sidan, och ingenting annat appen har på händelsen.
    expect(JSON.stringify(h.brev[0].lankar[0].handelse)).not.toMatch(/HEMLIG-BESKRIVNING|HEMLIGT-APPFALT|uid-skapare|agda\.hemlig/);
  });

  it("⛔ appens regel får funktionen: omröstningens ('bara medan datumet inte är valt') stänger rosta på en vald dag men inte delta", async () => {
    const h = bygg();
    await expect(h.tjanst.bjud({ uid: SKAPARE, handelseId: "h-mote", epost: ANNA })).rejects.toMatchObject({ kod: "ej-behorig" });
    await expect(h.tjanst.bjud({ uid: SKAPARE, handelseId: "h-mote", funktion: "rosta", epost: ANNA })).rejects.toMatchObject({ kod: "ej-behorig" });
    await expect(h.tjanst.bjud({ uid: SKAPARE, handelseId: "h-mote", funktion: "delta", epost: ANNA })).resolves.toMatchObject({ ny: true });
    const sedda = [];
    const h2 = bygg({ farBjuda: (a) => (sedda.push(a.funktion), true) });
    await h2.tjanst.bjud({ uid: SKAPARE, handelseId: "h-mote", funktion: "delta", epost: ANNA });
    await h2.tjanst.bjud({ uid: SKAPARE, handelseId: "h-ejsatt", epost: BO });
    expect(sedda).toEqual(["delta", "rosta"]);
  });

  it("ägare och admin bjuder in; en vanlig medlem, en agent, en före detta medlem, en utomstående och ingen alls får det inte", async () => {
    const h = bygg();
    for (const [uid, epost] of [[AGARE, "a@foretag.se"], [ADMIN, "b@foretag.se"], [SKAPARE, "c@foretag.se"]]) {
      await expect(h.tjanst.bjud({ uid, handelseId: "h-mote", funktion: "delta", epost }), uid).resolves.toMatchObject({ ny: true });
    }
    for (const uid of [MEDLEM, AGENT, SLUTAD, UTANFOR, "uid-okand"]) {
      await expect(h.tjanst.bjud({ uid, handelseId: "h-mote", funktion: "delta", epost: "d@foretag.se" }), uid).rejects.toMatchObject({ kod: "ej-behorig" });
    }
    expect(await rader(h)).toHaveLength(3);
  });

  it("⛔ en händelse utan datum, en arkiverad och en i en annan grupp ger ett fel och skriver ingenting: ingen rad, ingen plats, inget brev", async () => {
    const h = bygg();
    await expect(h.tjanst.bjud({ uid: AGARE, handelseId: "h-ejsatt", funktion: "delta", epost: ANNA })).rejects.toMatchObject({ kod: "ogiltigt-omfang" });
    await expect(h.tjanst.bjud({ uid: AGARE, handelseId: "h-arkiv", funktion: "delta", epost: ANNA })).rejects.toMatchObject({ kod: "finns-inte" });
    await expect(h.tjanst.bjud({ uid: AGARE, handelseId: "h-grannen", funktion: "delta", epost: ANNA })).rejects.toMatchObject({ kod: "ej-behorig" });
    await expect(h.tjanst.bjud({ uid: AGARE, handelseId: "finns-inte", funktion: "delta", epost: ANNA })).rejects.toMatchObject({ kod: "finns-inte" });
    expect(await rader(h)).toHaveLength(0);
    expect(await h.grund.list("gastplatser")).toHaveLength(0);
    expect(h.brev).toHaveLength(0);
  });

  it("en funktion som inte finns, en funktion på hela gruppen och delta i en tjänst utan delta ger ogiltigt-omfang", async () => {
    const h = bygg();
    await expect(h.tjanst.bjud({ uid: AGARE, handelseId: "h-mote", funktion: "folja", epost: ANNA })).rejects.toMatchObject({ kod: "ogiltigt-omfang" });
    await expect(h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, funktion: "delta", epost: ANNA })).rejects.toMatchObject({ kod: "ogiltigt-omfang" });
    const utan = bygg({ utanDelta: true });
    await expect(utan.tjanst.bjud({ uid: AGARE, handelseId: "h-mote", funktion: "delta", epost: ANNA })).rejects.toMatchObject({ kod: "ogiltigt-omfang" });
    expect(await rader(utan)).toHaveLength(0);
    // Omröstningen är som förut också i en tjänst utan delta.
    await expect(utan.tjanst.bjud({ uid: SKAPARE, handelseId: "h-ejsatt", epost: ANNA })).resolves.toMatchObject({ ny: true });
  });

  it("samma adress till samma händelse med delta och rosta är två rader men EN person och EN plats; samma delta två gånger är en rad", async () => {
    const h = bygg();
    const a = await h.tjanst.bjud({ uid: SKAPARE, handelseId: "h-mote", funktion: "delta", epost: ANNA });
    const b = await h.tjanst.bjud({ uid: SKAPARE, handelseId: "h-ejsatt", epost: ANNA });
    const c = await h.tjanst.bjud({ uid: SKAPARE, handelseId: "h-mote", funktion: "delta", epost: ANNA });
    expect(c).toMatchObject({ id: a.id, ny: false });
    expect(b.id).not.toBe(a.id);
    expect(await rader(h)).toHaveLength(2);
    expect(await h.grund.list("gastplatser")).toHaveLength(1);
  });

  it("delta-gäster tar platser som alla andra: den sjätte nekas", async () => {
    const h = bygg();
    for (let n = 0; n < GAST_PLATSER_GRATIS; n++) await h.tjanst.bjud({ uid: SKAPARE, handelseId: "h-mote", funktion: "delta", epost: `gast${n}@foretag.se` });
    await expect(h.tjanst.bjud({ uid: SKAPARE, handelseId: "h-mote", funktion: "delta", epost: "sjatte@foretag.se" })).rejects.toMatchObject({ kod: "platser-slut" });
  });
});

describe("hamta: en delta-gäst ser händelsens rubrik, tid och plats och sitt eget svar, och inget annat", () => {
  it("svaret är exakt det, och rubriken, platsen och tiden är de enda fälten om händelsen", async () => {
    const h = bygg();
    const g = await deltaGast(h);
    const svar = await h.tjanst.hamta({ sessionsnyckel: g.sessionsnyckel });
    expect(svar).toEqual({ ok: true, namn: "", funktion: "delta", delta: { handelse: { titel: "Möte", plats: "Salen, Visby", datum: "2026-12-02", slutDatum: null, tid: "18:00", slutTid: "20:00", heldag: false }, mitt: null } });
    // Golv: svaret bär något, så att "inget läckt" inte är grönt av ett tomt svar.
    expect(Object.keys(svar.delta.handelse).sort()).toEqual([...GASTDELTAHANDELSEFALT].sort());
    for (const k of Object.keys(svar)) expect([...GASTSVARSFALT]).toContain(k);
    const json = JSON.stringify(svar);
    for (const forbjuden of HEMLIGHETER) expect(json, forbjuden).not.toContain(forbjuden);
    for (const forbjuden of [GRUPP, "Källan", ANNA]) expect(json, forbjuden).not.toContain(forbjuden);
  });

  it("en heldag över flera dagar bär sina fält, och en plats som saknas är null och inte utelämnad", async () => {
    const h = bygg();
    const g = await deltaGast(h, { handelseId: "h-dag" });
    const { delta } = await h.tjanst.hamta({ sessionsnyckel: g.sessionsnyckel });
    expect(delta.handelse).toEqual({ titel: "Städdag", plats: null, datum: "2026-12-05", slutDatum: "2026-12-06", tid: null, slutTid: null, heldag: true });
  });

  it("⛔ appens sak.bygg (omröstningens kort, med förslag) anropas aldrig för en delta-gäst, men anropas för en rosta-gäst", async () => {
    const h = bygg();
    const g = await deltaGast(h);
    await h.tjanst.hamta({ sessionsnyckel: g.sessionsnyckel });
    expect(h.bygget).not.toHaveBeenCalled();
    const r = await rostaGast(h);
    const svar = await h.tjanst.hamta({ sessionsnyckel: r.sessionsnyckel });
    expect(h.bygget).toHaveBeenCalledTimes(1);
    expect(svar).toMatchObject({ funktion: "rosta", sak: { forslag: [expect.objectContaining({ rubrik: "OMROSTNINGENS-FORSLAG" })] } });
    expect(Object.keys(svar)).not.toContain("delta");
  });

  it("en arkiverad händelse ger saknas, en återkallad inbjudan ger aterkallad, och en tjänst utan delta ger nej", async () => {
    const h = bygg();
    const g = await deltaGast(h);
    await h.grund.update("handelser", "h-mote", { arkiverad: true });
    expect(await h.tjanst.hamta({ sessionsnyckel: g.sessionsnyckel })).toEqual({ ok: false, orsak: "saknas" });
    await h.grund.update("handelser", "h-mote", { arkiverad: false });
    await h.tjanst.aterkalla({ uid: SKAPARE, id: g.id });
    expect(await h.tjanst.hamta({ sessionsnyckel: g.sessionsnyckel })).toEqual({ ok: false, orsak: "aterkallad" });
    // Samma rad i en tjänst som inte har delta påslaget.
    const u = bygg();
    const g2 = await deltaGast(u);
    const utan = createGastService({
      kalla: u.grund,
      samlingar: { inbjudningar: "gastinbjudningar", sessioner: "gastsessioner", platser: "gastplatser", raknare: "gastraknare", handelser: "handelser" },
      farBjuda: () => true,
      skicka: async () => {},
      klocka: () => NU,
    });
    expect(await utan.hamta({ sessionsnyckel: g2.sessionsnyckel })).toEqual({ ok: false, orsak: "nej" });
  });
});

describe("deltaSvara: gästen svarar på sin händelse, och bara på den", () => {
  it("varje svar lagras som ett fält på gästens egen inbjudan, syns i hamta och i medlemmens lista, och ett nytt svar ersätter det förra", async () => {
    const h = bygg();
    const g = await deltaGast(h);
    for (const val of GASTDELTASVAR) {
      expect(await h.tjanst.deltaSvara({ sessionsnyckel: g.sessionsnyckel, val }), val).toEqual({ ok: true, mitt: val });
      expect((await rad(h, g.id)).deltasvar, val).toBe(val);
      expect((await h.tjanst.hamta({ sessionsnyckel: g.sessionsnyckel })).delta.mitt, val).toBe(val);
      const lista = await h.tjanst.lista({ uid: SKAPARE, handelseId: "h-mote", funktion: "delta" });
      expect(lista.gaster.map((x) => x.deltasvar), val).toEqual([val]);
    }
    // Ingen svarsrad bland medlemmarnas: svaret hör till inbjudan, inte till händelsens svarssamling.
    expect((await h.grund.list("handelser/h-mote/svar")).map((r) => r.id)).toEqual([MEDLEM]);
  });

  it("ett svar som inte är ett av tre kastar för en giltig session, men en ogiltig session får ett nej innan svaret ens läses", async () => {
    const h = bygg();
    const g = await deltaGast(h);
    for (const val of ["", "ja", "KOMMER", undefined, null, 7, "kommer ", { svar: "kommer" }]) {
      await expect(h.tjanst.deltaSvara({ sessionsnyckel: g.sessionsnyckel, val }), String(val)).rejects.toThrow(/val är/);
    }
    expect((await rad(h, g.id)).deltasvar).toBeNull();
    expect(await h.tjanst.deltaSvara({ sessionsnyckel: nyGastnyckel(), val: "inte-ett-svar" })).toEqual({ ok: false, orsak: "nej" });
  });

  it("⛔ svaret hamnar på sessionens egen inbjudan och ingen annans: inget id, ingen adress, ingen händelse och ingen grupp kommer från anropet", async () => {
    const h = bygg();
    const anna = await deltaGast(h, { epost: ANNA });
    const bo = await deltaGast(h, { epost: BO });
    const annaAndra = await deltaGast(h, { epost: ANNA, handelseId: "h-dag" });
    const annaRosta = await rostaGast(h, { epost: ANNA });
    await h.tjanst.deltaSvara({ sessionsnyckel: anna.sessionsnyckel, val: "kommer", id: bo.id, inbjudningId: bo.id, epost: BO, gastId: gastId(BO), handelseId: "h-dag", groupId: GRANNEN });
    expect((await rad(h, anna.id)).deltasvar).toBe("kommer");
    expect((await rad(h, bo.id)).deltasvar).toBeNull();
    expect((await rad(h, annaAndra.id)).deltasvar).toBeNull();
    expect((await rad(h, annaRosta.id)).deltasvar).toBeUndefined();
    // Och tvärtom.
    await h.tjanst.deltaSvara({ sessionsnyckel: bo.sessionsnyckel, val: "kommerInte", id: anna.id });
    expect([(await rad(h, anna.id)).deltasvar, (await rad(h, bo.id)).deltasvar]).toEqual(["kommer", "kommerInte"]);
  });

  it("⛔ en rosta-session, en grupp-session, en okänd nyckel och en tjänst utan delta ger nej, och ingenting skrivs", async () => {
    const h = bygg();
    const d = await deltaGast(h);
    const r = await rostaGast(h);
    const gr = await gruppGast(h);
    for (const [namn, nyckel] of [["rosta", r.sessionsnyckel], ["grupp", gr.sessionsnyckel], ["okänd", nyGastnyckel()], ["trasig", "kort"], ["saknas", undefined]]) {
      expect(await h.tjanst.deltaSvara({ sessionsnyckel: nyckel, val: "kommer" }), namn).toEqual({ ok: false, orsak: "nej" });
    }
    // Ingen rad fick ett svar: delta-raden har fortfarande null och övriga raders fält finns inte.
    for (const r2 of await rader(h)) expect(r2.deltasvar, r2.id).toBe(r2.omfang?.funktion === "delta" ? null : undefined);
    expect((await rad(h, d.id)).deltasvar).toBeNull();
    const utan = bygg({ utanDelta: true });
    expect(await utan.tjanst.deltaSvara({ sessionsnyckel: d.sessionsnyckel, val: "kommer" })).toEqual({ ok: false, orsak: "nej" });
  });

  it("⛔ appens rosta-väg släpper inte in en delta-gäst: sessionen med kravet rosta är ett nej", async () => {
    const h = bygg();
    const d = await deltaGast(h);
    const r = await rostaGast(h);
    expect(await h.tjanst.session({ sessionsnyckel: d.sessionsnyckel, krav: { slag: "sak", funktion: "rosta" } })).toEqual({ ok: false, orsak: "nej" });
    expect(await h.tjanst.session({ sessionsnyckel: d.sessionsnyckel, krav: { funktion: "rosta" } })).toEqual({ ok: false, orsak: "nej" });
    expect(await h.tjanst.session({ sessionsnyckel: r.sessionsnyckel, krav: { slag: "sak", funktion: "delta" } })).toEqual({ ok: false, orsak: "nej" });
    expect(await h.tjanst.session({ sessionsnyckel: d.sessionsnyckel, krav: { slag: "sak", funktion: "delta" } })).toMatchObject({ ok: true, inbjudan: { slag: "sak", funktion: "delta", handelseId: "h-mote" } });
  });

  it("⛔ en återkallad inbjudan nekas, och ingenting skrivs", async () => {
    const h = bygg();
    const g = await deltaGast(h);
    await h.tjanst.deltaSvara({ sessionsnyckel: g.sessionsnyckel, val: "kommer" });
    await h.tjanst.aterkalla({ uid: SKAPARE, id: g.id });
    expect(await h.tjanst.deltaSvara({ sessionsnyckel: g.sessionsnyckel, val: "kommerInte" })).toEqual({ ok: false, orsak: "aterkallad" });
    expect((await rad(h, g.id)).deltasvar).toBe("kommer");
  });

  it("⛔ en återkallelse som korsar svaret vinner: villkoret i skrivningen hindrar ett svar på en dragen inbjudan", async () => {
    let armad = false;
    /** @type {null | (() => Promise<unknown>)} */
    let aterkalla = null;
    const korsad = (/** @type {any} */ k) =>
      new Proxy(k, {
        get(mal, prop) {
          if (prop !== "read") return typeof mal[prop] === "function" ? mal[prop].bind(mal) : mal[prop];
          return async (samling, id) => {
            const svar = await mal.read(samling, id);
            // Händelsen läses efter sessionen och före skrivningen: där hinner en återkallelse in.
            if (armad && samling === "handelser" && aterkalla) {
              armad = false;
              await aterkalla();
            }
            return svar;
          };
        },
      });
    const h = bygg({ omslut: korsad });
    const g = await deltaGast(h);
    aterkalla = () => h.tjanst.aterkalla({ uid: SKAPARE, id: g.id });
    armad = true;
    expect(await h.tjanst.deltaSvara({ sessionsnyckel: g.sessionsnyckel, val: "kommer" })).toEqual({ ok: false, orsak: "aterkallad" });
    expect((await rad(h, g.id)).deltasvar).toBeNull();
    expect((await rad(h, g.id)).aterkallad).not.toBeNull();
  });

  it("en arkiverad händelse ger saknas och ingenting skrivs", async () => {
    const h = bygg();
    const g = await deltaGast(h);
    await h.grund.update("handelser", "h-mote", { arkiverad: true });
    expect(await h.tjanst.deltaSvara({ sessionsnyckel: g.sessionsnyckel, val: "kommer" })).toEqual({ ok: false, orsak: "saknas" });
    expect((await rad(h, g.id)).deltasvar).toBeNull();
  });

  it("anropen räknas per inbjudan och minut: efter taket är svaret for-manga, och nästa minut går det igen", async () => {
    const h = bygg();
    const g = await deltaGast(h);
    for (let n = 0; n < GASTANROP_PER_MINUT; n++) expect((await h.tjanst.deltaSvara({ sessionsnyckel: g.sessionsnyckel, val: "kommer" })).ok, String(n)).toBe(true);
    expect(await h.tjanst.deltaSvara({ sessionsnyckel: g.sessionsnyckel, val: "kommerInte" })).toEqual({ ok: false, orsak: "for-manga" });
    expect((await rad(h, g.id)).deltasvar).toBe("kommer");
    h.tid(NU + 2 * MINUT);
    expect(await h.tjanst.deltaSvara({ sessionsnyckel: g.sessionsnyckel, val: "kommerInte" })).toEqual({ ok: true, mitt: "kommerInte" });
  });
});

describe("⛔ en delta-gäst ser aldrig resten av gruppen", () => {
  /** Alla åtgärder en gruppgäst har, med giltiga indata mot grunddatan. */
  const GRUPPATGARDER = {
    chatt: (t, k) => t.chatt({ sessionsnyckel: k }),
    skrivChatt: (t, k) => t.skrivChatt({ sessionsnyckel: k, text: "Hej från en delta-gäst" }),
    kalender: (t, k) => t.kalender({ sessionsnyckel: k }),
    handelse: (t, k) => t.handelse({ sessionsnyckel: k, handelseId: "h-mote" }),
    svara: (t, k) => t.svara({ sessionsnyckel: k, handelseId: "h-mote", val: "kommer" }),
    rosta: (t, k) => t.rosta({ sessionsnyckel: k, handelseId: "h-ejsatt", forslagId: "f1", val: "ja" }),
    bibliotek: (t, k) => t.bibliotek({ sessionsnyckel: k }),
    fil: (t, k) => t.fil({ sessionsnyckel: k, postId: "p-pdf" }),
    arenden: (t, k) => t.arenden({ sessionsnyckel: k }),
    kommenteraArende: (t, k) => t.kommenteraArende({ sessionsnyckel: k, arendeId: "a-grupp", text: "Hej" }),
    markeraArendeKlart: (t, k) => t.markeraArendeKlart({ sessionsnyckel: k, arendeId: "a-grupp" }),
  };

  it("alla elva gruppåtgärder är ett nej för en delta-gäst, och samma anrop fungerar för en gruppgäst (positiv kontroll)", async () => {
    const h = bygg();
    const d = await deltaGast(h);
    const gr = await gruppGast(h);
    expect(Object.keys(GRUPPATGARDER).sort()).toEqual([...GASTGRUPPATGARDER].filter((a) => !["los", "hamta"].includes(a)).sort());
    for (const [namn, anrop] of Object.entries(GRUPPATGARDER)) {
      expect(await anrop(h.tjanst, d.sessionsnyckel), `${namn} som delta-gäst`).toEqual({ ok: false, orsak: "nej" });
    }
    // Golvet: samma anrop ger ok för gruppgästen, annars är nejet ovan grönt av ett anrop som aldrig kunde lyckas.
    for (const namn of ["chatt", "kalender", "handelse", "svara", "bibliotek", "arenden"]) {
      expect((await GRUPPATGARDER[namn](h.tjanst, gr.sessionsnyckel)).ok, `${namn} som gruppgäst`).toBe(true);
    }
  });

  it("och tvärtom: en gruppgäst kan inte svara som delta-gäst, och en delta-gäst för en händelse når inte en annan", async () => {
    const h = bygg();
    const gr = await gruppGast(h);
    expect(await h.tjanst.deltaSvara({ sessionsnyckel: gr.sessionsnyckel, val: "kommer" })).toEqual({ ok: false, orsak: "nej" });
    const d = await deltaGast(h);
    // Sessionen bär sin inbjudan: hamta ger alltid h-mote, hur anropet än är formulerat.
    const svar = await h.tjanst.hamta({ sessionsnyckel: d.sessionsnyckel, handelseId: "h-dag", id: "x" });
    expect(svar.delta.handelse.titel).toBe("Möte");
  });
});

describe("återkallelse, radering och platser", () => {
  it("att återkalla släpper platsen när det var gästens sista aktiva inbjudan, och nästa session, hamta och svar nekas med aterkallad", async () => {
    const h = bygg();
    const g = await deltaGast(h);
    expect(await h.grund.list("gastplatser")).toHaveLength(1);
    await h.tjanst.aterkalla({ uid: SKAPARE, id: g.id });
    expect(await h.grund.list("gastplatser")).toHaveLength(0);
    expect(await h.tjanst.session({ sessionsnyckel: g.sessionsnyckel })).toEqual({ ok: false, orsak: "aterkallad" });
    expect(await h.tjanst.hamta({ sessionsnyckel: g.sessionsnyckel })).toEqual({ ok: false, orsak: "aterkallad" });
    expect(await h.tjanst.deltaSvara({ sessionsnyckel: g.sessionsnyckel, val: "kommer" })).toEqual({ ok: false, orsak: "aterkallad" });
  });

  it("den som bjöd, en admin och en ägare får dra tillbaka; en vanlig medlem och en agent får det inte", async () => {
    const h = bygg();
    const g = await deltaGast(h);
    await expect(h.tjanst.aterkalla({ uid: MEDLEM, id: g.id })).rejects.toMatchObject({ kod: "ej-behorig" });
    await expect(h.tjanst.aterkalla({ uid: AGENT, id: g.id })).rejects.toMatchObject({ kod: "ej-behorig" });
    await expect(h.tjanst.aterkalla({ uid: ADMIN, id: g.id })).resolves.toMatchObject({ id: g.id });
  });

  it("⛔ radering tar bort inbjudan och därmed svaret, sessionerna och platsen: inga spår av adressen eller svaret finns kvar", async () => {
    const h = bygg();
    const g = await deltaGast(h);
    await h.tjanst.deltaSvara({ sessionsnyckel: g.sessionsnyckel, val: "kanske" });
    expect(JSON.stringify(await rader(h))).toContain("kanske");
    const svar = await h.tjanst.radera({ uid: SKAPARE, groupId: GRUPP, gastId: gastId(ANNA) });
    expect(svar).toMatchObject({ inbjudningar: 1, sessioner: 1, platserSlappta: 1 });
    for (const samling of ["gastinbjudningar", "gastsessioner", "gastplatser"]) {
      const json = JSON.stringify(await h.grund.list(samling));
      expect(json, samling).not.toContain(ANNA);
      expect(json, samling).not.toContain("kanske");
      expect(await h.grund.list(samling), samling).toHaveLength(0);
    }
    expect(await h.tjanst.deltaSvara({ sessionsnyckel: g.sessionsnyckel, val: "kommer" })).toEqual({ ok: false, orsak: "nej" });
  });

  it("gästen raderar sig själv från sin sida, och en gäst med både delta och rosta tappar båda", async () => {
    const h = bygg();
    const d = await deltaGast(h);
    await rostaGast(h, { epost: ANNA });
    expect(await h.tjanst.raderaMig({ sessionsnyckel: d.sessionsnyckel })).toEqual({ ok: true });
    expect(await rader(h)).toHaveLength(0);
  });
});

describe("SEQUENCE: stiger när tid eller plats ändrats, och bara då", () => {
  const sekvensen = async (h, id) => (await rad(h, id)).sekvens;
  const senaste = (h) => h.brev[h.brev.length - 1].lankar[0];

  it("Skicka igen utan ändring behåller SEQUENCE; en ändrad tid höjer den med ett; en ändrad rubrik rör den inte; en ändrad plats höjer den", async () => {
    const h = bygg();
    const g = await deltaGast(h);
    expect(senaste(h).sekvens).toBe(0);
    await h.tjanst.skickaOm({ uid: SKAPARE, id: g.id });
    expect(senaste(h).sekvens).toBe(0);
    await h.grund.update("handelser", "h-mote", { tid: "19:00" });
    await h.tjanst.skickaOm({ uid: SKAPARE, id: g.id });
    expect(senaste(h)).toMatchObject({ sekvens: 1, handelse: { tid: "19:00" } });
    expect(await sekvensen(h, g.id)).toBe(1);
    await h.tjanst.skickaOm({ uid: SKAPARE, id: g.id });
    expect(senaste(h).sekvens).toBe(1);
    await h.grund.update("handelser", "h-mote", { rubrik: "Årsmöte" });
    await h.tjanst.skickaOm({ uid: SKAPARE, id: g.id });
    expect(senaste(h)).toMatchObject({ sekvens: 1, handelse: { titel: "Årsmöte" } });
    await h.grund.update("handelser", "h-mote", { plats: "Hamnen" });
    await h.tjanst.skickaOm({ uid: SKAPARE, id: g.id });
    expect(senaste(h)).toMatchObject({ sekvens: 2, handelse: { plats: "Hamnen" } });
  });

  it("Bjud in igen efter en återkallelse jämför mot det som skickades sist, och Skicka igen på en händelse som försvunnit ger finns-inte", async () => {
    const h = bygg();
    const g = await deltaGast(h);
    await h.tjanst.aterkalla({ uid: SKAPARE, id: g.id });
    await h.grund.update("handelser", "h-mote", { datum: "2026-12-09" });
    await h.tjanst.bjud({ uid: SKAPARE, handelseId: "h-mote", funktion: "delta", epost: ANNA });
    expect(senaste(h)).toMatchObject({ sekvens: 1, handelse: { datum: "2026-12-09" } });
    await h.grund.update("handelser", "h-mote", { arkiverad: true });
    await expect(h.tjanst.skickaOm({ uid: SKAPARE, id: g.id })).rejects.toMatchObject({ kod: "finns-inte" });
  });

  it("en ny länk (nyLank) bär händelsen och SEQUENCE, hoppar över en delta-inbjudan på en händelse som försvunnit, och svaret är detsamma", async () => {
    const h = bygg();
    const g = await deltaGast(h);
    await h.grund.update("handelser", "h-mote", { slutTid: "21:00" });
    h.brev.length = 0;
    const svar = await h.tjanst.nyLank({ epost: ANNA, ip: "198.51.100.1" });
    expect(h.brev).toHaveLength(1);
    expect(h.brev[0].lankar[0]).toMatchObject({ id: g.id, sekvens: 1, handelse: { slutTid: "21:00" } });
    // Händelsen försvinner: ingen länk till en sida som inte finns, och den som bad får samma svar.
    await h.grund.update("handelser", "h-mote", { arkiverad: true });
    h.brev.length = 0;
    const svar2 = await h.tjanst.nyLank({ epost: ANNA, ip: "198.51.100.2" });
    expect(h.brev).toHaveLength(0);
    expect(svar2).toEqual(svar);
  });
});

describe("tidAndrad: ett nytt brev till den som har ett gammalt, en gång", () => {
  async function tre(h) {
    const anna = await deltaGast(h, { epost: ANNA });
    const bo = await deltaGast(h, { epost: BO });
    const cia = await deltaGast(h, { epost: "cia@foretag.se" });
    return { anna, bo, cia };
  }

  it("utan ändring skickas inget, men svaret säger hur många som är aktiva", async () => {
    const h = bygg();
    await tre(h);
    h.brev.length = 0;
    expect(await h.tjanst.tidAndrad({ handelseId: "h-mote" })).toEqual({ skickade: 0, aktiva: 3, saknas: false });
    expect(h.brev).toHaveLength(0);
  });

  it("en ändrad tid ger ett brev (andrad-tid) till varje aktiv delta-gäst med den nya posten, högre SEQUENCE och en ny länk; en återkallad får inget; andra gången skickas inget mer", async () => {
    const h = bygg();
    const { anna, bo, cia } = await tre(h);
    await h.tjanst.aterkalla({ uid: SKAPARE, id: cia.id });
    // En rosta-gäst på en annan händelse och en gruppgäst får aldrig ett tidsbrev.
    await rostaGast(h);
    await gruppGast(h);
    const gammalLank = anna.lank;
    h.brev.length = 0;
    await h.grund.update("handelser", "h-mote", { tid: "17:00", slutTid: "19:00" });
    expect(await h.tjanst.tidAndrad({ handelseId: "h-mote" })).toEqual({ skickade: 2, aktiva: 2, saknas: false });
    expect(h.brev.map((b) => b.till).sort()).toEqual([ANNA, BO].sort());
    for (const b of h.brev) {
      expect(b).toMatchObject({ typ: "andrad-tid", skickadAv: null });
      expect(b.lankar).toHaveLength(1);
      expect(b.lankar[0]).toMatchObject({ sekvens: 1, handelse: { id: "h-mote", tid: "17:00", slutTid: "19:00" }, omfang: { funktion: "delta" } });
    }
    expect((await rad(h, anna.id)).sekvens).toBe(1);
    expect((await rad(h, bo.id)).sekvens).toBe(1);
    expect((await rad(h, cia.id)).sekvens).toBe(0);
    // Den nya länken fungerar, den gamla inte.
    const ny = h.brev.find((b) => b.till === ANNA).lankar[0];
    expect((await h.tjanst.los({ id: ny.id, nyckel: ny.nyckel, epost: ANNA, ip: IP })).ok).toBe(true);
    expect(await h.tjanst.los({ id: gammalLank.id, nyckel: gammalLank.nyckel, epost: ANNA, ip: IP })).toEqual({ ok: false, orsak: "nej" });
    // Idempotent: ingen ny ändring, inga nya brev.
    h.brev.length = 0;
    expect(await h.tjanst.tidAndrad({ handelseId: "h-mote" })).toEqual({ skickade: 0, aktiva: 2, saknas: false });
    expect(h.brev).toHaveLength(0);
  });

  it("en ändrad rubrik ger inget brev, en ändrad plats gör det", async () => {
    const h = bygg();
    await deltaGast(h);
    h.brev.length = 0;
    await h.grund.update("handelser", "h-mote", { rubrik: "Årsmöte" });
    expect((await h.tjanst.tidAndrad({ handelseId: "h-mote" })).skickade).toBe(0);
    await h.grund.update("handelser", "h-mote", { plats: "Hamnen" });
    expect((await h.tjanst.tidAndrad({ handelseId: "h-mote" })).skickade).toBe(1);
    expect(h.brev[0].lankar[0].handelse).toMatchObject({ titel: "Årsmöte", plats: "Hamnen" });
  });

  it("⛔ ett brev som inte gick är ett fel med kod och ändringen glöms inte: de som gick sparas, den som föll tas nästa gång", async () => {
    const h = bygg();
    const { anna, bo } = await tre(h);
    h.brev.length = 0;
    await h.grund.update("handelser", "h-mote", { tid: "17:00" });
    h.skickaFel.fel = (b) => b.till === BO;
    await expect(h.tjanst.tidAndrad({ handelseId: "h-mote" })).rejects.toMatchObject({ kod: "brev-misslyckades", skickade: 2, misslyckade: 1 });
    expect((await rad(h, anna.id)).sekvens).toBe(1);
    expect((await rad(h, bo.id)).sekvens).toBe(0);
    h.skickaFel.fel = null;
    h.brev.length = 0;
    expect(await h.tjanst.tidAndrad({ handelseId: "h-mote" })).toEqual({ skickade: 1, aktiva: 3, saknas: false });
    expect(h.brev.map((b) => b.till)).toEqual([BO]);
    expect((await rad(h, bo.id)).sekvens).toBe(1);
  });

  it("en händelse som försvunnit ger saknas, en tjänst utan delta kastar, och en omröstningsgäst på samma händelse rörs inte", async () => {
    const h = bygg();
    await h.tjanst.bjud({ uid: SKAPARE, handelseId: "h-ejsatt", epost: ANNA });
    h.brev.length = 0;
    await h.grund.update("handelser", "h-ejsatt", { datum: "2026-12-20" });
    expect(await h.tjanst.tidAndrad({ handelseId: "h-ejsatt" })).toEqual({ skickade: 0, aktiva: 0, saknas: false });
    expect(h.brev).toHaveLength(0);
    expect(await h.tjanst.tidAndrad({ handelseId: "finns-inte" })).toEqual({ skickade: 0, aktiva: 0, saknas: true });
    expect(await h.tjanst.tidAndrad({ handelseId: "h-arkiv" })).toEqual({ skickade: 0, aktiva: 0, saknas: true });
    await expect(bygg({ utanDelta: true }).tjanst.tidAndrad({ handelseId: "h-mote" })).rejects.toMatchObject({ kod: "ogiltigt-omfang" });
    await expect(h.tjanst.tidAndrad({})).rejects.toThrow(/handelseId/);
  });
});

describe("lista: delta och rosta på samma händelse hålls isär", () => {
  it("lista utan funktion är som förut (bara omröstningens gäster, utan delta-fält), och med funktion delta bara delta-gästerna med sitt svar", async () => {
    const h = bygg();
    const d = await deltaGast(h, { epost: ANNA });
    await deltaGast(h, { epost: BO });
    await h.tjanst.bjud({ uid: SKAPARE, handelseId: "h-ejsatt", epost: "rosta@foretag.se" });
    await h.tjanst.deltaSvara({ sessionsnyckel: d.sessionsnyckel, val: "kommerInte" });
    const rosta = await h.tjanst.lista({ uid: SKAPARE, handelseId: "h-ejsatt" });
    expect(rosta.gaster).toHaveLength(1);
    expect(Object.keys(rosta.gaster[0])).not.toContain("deltasvar");
    // Händelsen h-mote har bara delta-gäster, så omröstningslistan för den är tom (tomt är ett svar).
    expect((await h.tjanst.lista({ uid: SKAPARE, handelseId: "h-mote" })).gaster).toEqual([]);
    const delta = await h.tjanst.lista({ uid: SKAPARE, handelseId: "h-mote", funktion: "delta" });
    expect(delta.gaster.map((g) => [g.epost, g.deltasvar])).toEqual([[ANNA, "kommerInte"], [BO, null]]);
    for (const g of delta.gaster) {
      expect(Object.keys(g).sort()).toEqual(["antalSkickade", "aterkallad", "deltasvar", "epost", "forstInloggad", "gastId", "id", "namn", "omfang", "skapad", "skapadAv", "skickad", "status"].sort());
      expect(JSON.stringify(g)).not.toMatch(/nyckelHash|felAntal|sekvens|andringsnyckel/);
    }
    expect(delta.platser).toMatchObject({ anvanda: 3 });
    await expect(h.tjanst.lista({ uid: SKAPARE, handelseId: "h-mote", funktion: "folja" })).rejects.toThrow(/funktionen/);
    await expect(h.tjanst.lista({ uid: SKAPARE, groupId: GRUPP, funktion: "delta" })).rejects.toThrow(/funktion hör till en händelse/);
    await expect(h.tjanst.lista({ uid: MEDLEM, handelseId: "h-mote", funktion: "delta" })).resolves.toMatchObject({ gaster: expect.any(Array) });
    await expect(h.tjanst.lista({ uid: UTANFOR, handelseId: "h-mote", funktion: "delta" })).rejects.toMatchObject({ kod: "ej-behorig" });
  });

  it("⛔ appens harRostat gäller omröstningen och ger aldrig en delta-gäst statusen har-rostat", async () => {
    const h = bygg();
    const d = await deltaGast(h);
    const lista = await h.tjanst.lista({ uid: SKAPARE, handelseId: "h-mote", funktion: "delta", harRostat: [d.gastId] });
    expect(lista.gaster[0].status).toBe("inloggad");
    const person = await h.tjanst.lista({ uid: SKAPARE, groupId: GRUPP, harRostat: [d.gastId] });
    expect(person.personer[0].inbjudningar[0].status).toBe("inloggad");
  });

  it("listan över hela gruppen bär delta-inbjudan med sin rubrik och sitt svar, också i en tjänst utan grupp, och en omröstningsinbjudan har exakt sina gamla fält", async () => {
    const h = bygg({ utanGrupp: true });
    const d = await deltaGast(h);
    await h.tjanst.bjud({ uid: SKAPARE, handelseId: "h-ejsatt", epost: ANNA });
    await h.tjanst.deltaSvara({ sessionsnyckel: d.sessionsnyckel, val: "kanske" });
    const { personer } = await h.tjanst.lista({ uid: AGARE, groupId: GRUPP });
    expect(personer).toHaveLength(1);
    const [delta, rosta] = [personer[0].inbjudningar.find((i) => i.omfang.funktion === "delta"), personer[0].inbjudningar.find((i) => i.omfang.funktion === "rosta")];
    expect(delta).toMatchObject({ titel: "Möte", deltasvar: "kanske", omfang: { slag: "sak", funktion: "delta", handelseId: "h-mote" } });
    expect(Object.keys(rosta).sort()).toEqual(["aterkallad", "antalSkickade", "forstInloggad", "id", "omfang", "skapad", "skickad", "status", "titel"].sort());
  });
});

describe("gruppens svarssammanställning räknar bara gruppens gäster", () => {
  it("⛔ en delta-gäst är inte en av dem som 'inte har svarat' på gruppens händelser: summan stämmer med det medlemmen ser", async () => {
    const h = bygg();
    const gr = await gruppGast(h);
    const fore = await h.tjanst.handelse({ sessionsnyckel: gr.sessionsnyckel, handelseId: "h-mote" });
    // Medlemmar: Agda, Adam, Sture, Maja (4 aktiva personer; agenten och den avslutade räknas inte) och gruppgästen: 5. Maja har svarat Kommer.
    expect(fore.svar).toMatchObject({ kommer: 1, kommerInte: 0, ejSvarat: 4 });
    await deltaGast(h, { epost: ANNA });
    await deltaGast(h, { epost: BO });
    const efter = await h.tjanst.handelse({ sessionsnyckel: gr.sessionsnyckel, handelseId: "h-mote" });
    expect(efter.svar).toMatchObject({ kommer: 1, kommerInte: 0, ejSvarat: 4 });
    // Och en annan gruppgäst räknas fortfarande.
    await gruppGast(h, "grupp2@foretag.se");
    expect((await h.tjanst.handelse({ sessionsnyckel: gr.sessionsnyckel, handelseId: "h-mote" })).svar).toMatchObject({ ejSvarat: 5 });
  });
});
