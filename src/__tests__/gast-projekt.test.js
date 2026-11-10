import { describe, expect, it, vi } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { PLATSIDFORM, platsBibliotek } from "../lib/bibliotek.js";
import { GASTGRUPPFUNKTIONER, GASTPROJEKTFUNKTIONER, GASTPROJEKTKORTFALT, GASTPROJEKTTAGGFORM, GASTSLAG, GAST_PLATSER_GRATIS, arGruppslag, gastId, gastOmfangGer, gastomfangsnyckel } from "../lib/gast.js";
import { medlemskapsId } from "../lib/grupp.js";
import { createGastService, gastInbjudningsId } from "../node/gast.js";

/**
 * Gäst i ett projekt (0.215.0, cllp/lifehub.app#760 skiva 1). CP 2026-11-10: "Jag skulle vilja kunna samarbeta med externa i projekt, de har inte tillgång till hela gruppen, men bara projekt."
 *
 * Omfånget `{ slag: "projekt", tagg }` är en gäst i gruppen med kalendern, biblioteket och ärendena, allt avgränsat till projektet på servern, och ingen chatt.
 * ⛔ VARJE PROV HAR SETTS FALLA: mutationerna och utfallen står i PR-texten (arbetsreglernas punkt 4). Listorna nedan har golv, så att ett prov som läser noll rader inte blir grönt av att ingenting lästes.
 */

const NU = 1_800_000_000_000;
const GRUPP = "kallan";
const GRANNEN = "grannen";
const AGARE = "uid-agare-p1";
const ADMIN = "uid-admin-p2";
const MEDLEM = "uid-medlem-p3";
const IP = "203.0.113.9";
const PERS = gastId("per@extern.se");

const medlemskap = (uid, groupId, roll) => ({ id: medlemskapsId(uid, groupId), userId: uid, groupId, roll, typ: "person", status: "aktiv", namn: uid });

/** Gruppens två projekt och ett arkiverat: `koket` har en egen kalender, `badrum` ligger i gruppens förvalda och bär därför sina händelser med taggen. */
const PROJEKT = {
  koket: { namn: "Ombyggnad av köket", status: "pagar", kalender: "kal-koket", syfte: "Nytt kök före jul", nulage: "Ritningen är klar", nastaSteg: "", oppnaFragor: "Vilken bänkskiva?", repo: "HEMLIGT-REPO/x" },
  badrum: { namn: "Badrummet", status: "planerad", kalender: "grupp" },
  gammalt: { namn: "Gammalt", status: "klar", kalender: "grupp", arkiverad: true },
};

function seed() {
  return {
    memberships: [medlemskap(AGARE, GRUPP, "agare"), medlemskap(ADMIN, GRUPP, "admin"), medlemskap(MEDLEM, GRUPP, "medlem"), medlemskap("uid-granne", GRANNEN, "agare")],
    groups: [{ id: GRUPP, namn: "Källan", beskrivning: "GRUPPENS-BESKRIVNING" }, { id: GRANNEN, namn: "Grannen" }],
    gruppkalendrar: [
      { id: "kal-koket", groupId: GRUPP, namn: { sv: "Köket" }, farg: 1, ikon: "kalender" },
      { id: "kal-annan", groupId: GRUPP, namn: { sv: "ANNAN-KALENDER" }, farg: 2, ikon: "kalender" },
    ],
    handelser: [
      { id: "h-koket", groupId: GRUPP, kalenderId: "kal-koket", rubrik: "Snickaren kommer", datum: "2026-11-12", tid: "08:00", kravSvar: true },
      { id: "h-koket2", groupId: GRUPP, kalenderId: "kal-koket", rubrik: "Elektrikern", datum: "2026-11-20", heldag: true },
      { id: "h-badrum", groupId: GRUPP, rubrik: "BADRUMMETS-MOTE", datum: "2026-11-13", taggar: ["badrum"] },
      { id: "h-grupp", groupId: GRUPP, rubrik: "GRUPPENS-MOTE", datum: "2026-11-14", kravSvar: true },
      { id: "h-annan", groupId: GRUPP, kalenderId: "kal-annan", rubrik: "ANNAN-KALENDERS-MOTE", datum: "2026-11-15", taggar: ["koket"] },
      { id: "h-grannen", groupId: GRANNEN, kalenderId: "kal-koket", rubrik: "GRANNENS-MOTE", datum: "2026-11-16" },
    ],
    arenden: [
      { id: "a-koket", groupId: GRUPP, taggar: ["koket"], rubrik: "Beställ luckor", text: "Vita", status: "ny", skapad: "2026-11-01" },
      { id: "a-koket-per", groupId: GRUPP, taggar: ["koket", "inkop"], rubrik: "Mät väggen", text: "Före fredag", status: "ny", skapad: "2026-11-02", mottagare: { slag: "gast", gastId: PERS, namn: "Per" } },
      { id: "a-badrum", groupId: GRUPP, taggar: ["badrum"], rubrik: "BADRUMMETS-ARENDE", text: "x", status: "ny", skapad: "2026-11-03" },
      { id: "a-grupp", groupId: GRUPP, rubrik: "GRUPPENS-ARENDE", text: "EKONOMI-4711", status: "ny", skapad: "2026-11-04" },
      { id: "a-grupp-per", groupId: GRUPP, rubrik: "GRUPPARENDE-HOS-PER", text: "x", status: "ny", skapad: "2026-11-05", mottagare: { slag: "gast", gastId: PERS, namn: "Per" } },
      { id: "a-grannen", groupId: GRANNEN, taggar: ["koket"], rubrik: "GRANNENS-ARENDE", text: "x", status: "ny", skapad: "2026-11-06" },
    ],
    bibliotek: [
      { id: "p-ritning", groupId: `plats~${GRUPP}~koket`, typ: "fil", rubrik: "Ritning", fil: { sokvag: `grupper/plats~${GRUPP}~koket/bibliotek/p-ritning/ritning.pdf`, namn: "ritning.pdf", mime: "application/pdf", byte: 100, klar: true }, skapad: 3000, andrad: 3000 },
      { id: "p-koket-not", groupId: `plats~${GRUPP}~koket`, typ: "anteckning", rubrik: "Mått", text: "240 cm", skapad: 2000, andrad: 2000 },
      { id: "p-badrum", groupId: `plats~${GRUPP}~badrum`, typ: "fil", rubrik: "BADRUMMETS-FIL", fil: { sokvag: `grupper/plats~${GRUPP}~badrum/bibliotek/p-badrum/b.pdf`, namn: "b.pdf", mime: "application/pdf", byte: 1, klar: true }, skapad: 1, andrad: 1 },
      { id: "p-grupp", groupId: GRUPP, typ: "fil", rubrik: "GRUPPENS-FIL", fil: { sokvag: `grupper/${GRUPP}/bibliotek/p-grupp/g.pdf`, namn: "g.pdf", mime: "application/pdf", byte: 1, klar: true }, skapad: 1, andrad: 1 },
      { id: "p-grannen", groupId: `plats~${GRANNEN}~koket`, typ: "fil", rubrik: "GRANNENS-FIL", fil: { sokvag: `grupper/plats~${GRANNEN}~koket/bibliotek/p-grannen/n.pdf`, namn: "n.pdf", mime: "application/pdf", byte: 1, klar: true }, skapad: 1, andrad: 1 },
    ],
    [`samtal/${GRUPP}|grupp/meddelanden`]: [{ id: "m1", text: "GRUPPCHATTEN", av: AGARE, tid: 1 }],
    gastinbjudningar: [],
    gastsessioner: [],
    gastplatser: [],
    gastraknare: [],
  };
}

/** Allt som en projektgäst i `koket` aldrig får se. Golv: minst tio. */
const UTANFOR_PROJEKTET = ["BADRUMMETS-MOTE", "GRUPPENS-MOTE", "ANNAN-KALENDERS-MOTE", "GRANNENS-MOTE", "BADRUMMETS-ARENDE", "GRUPPENS-ARENDE", "EKONOMI-4711", "GRUPPARENDE-HOS-PER", "GRANNENS-ARENDE", "BADRUMMETS-FIL", "GRUPPENS-FIL", "GRANNENS-FIL", "GRUPPCHATTEN", "GRUPPENS-BESKRIVNING", "ANNAN-KALENDER", "HEMLIGT-REPO"];

/**
 * Appens projekt, som stand-in: samma regel som lifehub.app (`projektetsHandelserRa`): en egen kalender ger allt i den, gruppens förvalda ger bara händelser med taggen. Ärenden: taggen.
 * @param {{ trasigt: boolean }} [lage] `trasigt`: appens svar saknar `handelse` och `arende` (ett fel i appen).
 */
function appensProjekt(lage = { trasigt: false, oklar: false }) {
  return {
    urval: vi.fn(async ({ groupId, tagg }) => {
      const p = groupId === GRUPP ? PROJEKT[/** @type {keyof typeof PROJEKT} */ (tagg)] : undefined;
      if (!p || /** @type {any} */ (p).arkiverad) return null;
      // `lage.oklar`: appens urval kastar för händelser och svarar 1 (inte `true`) för ärenden. Inget av det får läsas som ja.
      if (lage.oklar) return { namn: p.namn, status: { sv: "Pågår", en: "In progress" }, texter: [], handelse: () => { throw new Error("appen föll"); }, arende: () => 1 };
      if (lage.trasigt) return { namn: p.namn, status: { sv: "Pågår", en: "In progress" }, texter: [] };
      const egen = p.kalender !== "grupp";
      return {
        namn: p.namn,
        status: { sv: p.status === "pagar" ? "Pågår" : "Planerad", en: p.status === "pagar" ? "In progress" : "Planned" },
        texter: [
          { rubrik: { sv: "Syfte", en: "Purpose" }, text: /** @type {any} */ (p).syfte ?? "" },
          { rubrik: { sv: "Nuläge", en: "Current state" }, text: /** @type {any} */ (p).nulage ?? "" },
          { rubrik: { sv: "Nästa steg", en: "Next step" }, text: /** @type {any} */ (p).nastaSteg ?? "" },
          { rubrik: { sv: "Öppna frågor", en: "Open questions" }, text: /** @type {any} */ (p).oppnaFragor ?? "" },
        ],
        handelse: (h) => (egen ? h.kalenderId === p.kalender : !h.kalenderId && Array.isArray(h.taggar) && h.taggar.includes(tagg)),
        arende: (r) => Array.isArray(r.taggar) && r.taggar.includes(tagg),
        repo: /** @type {any} */ (p).repo,
      };
    }),
  };
}

function bygg({ utanProjekt = false } = {}) {
  const grund = createMemorySource(seed());
  /** @type {any[]} */
  const brev = [];
  const signera = vi.fn(async ({ sokvag }) => `https://lagring.example/s/${encodeURIComponent(sokvag)}`);
  const lage = { trasigt: false, oklar: false };
  const projekt = appensProjekt(lage);
  const kommentarer = /** @type {any[]} */ ([]);
  const tjanst = createGastService({
    kalla: grund,
    samlingar: { inbjudningar: "gastinbjudningar", sessioner: "gastsessioner", platser: "gastplatser", raknare: "gastraknare", handelser: "handelser" },
    farBjuda: () => true,
    skicka: async (b) => {
      brev.push(b);
    },
    rapportera: vi.fn(),
    klocka: () => NU,
    grupp: {
      samlingar: { grupper: "groups", samtal: "samtal", meddelanden: "meddelanden", bibliotek: "bibliotek", svar: "svar", gruppkalendrar: "gruppkalendrar" },
      lagring: { signeradAdress: signera },
      handelseSida: (h) => ({ titel: h.rubrik }),
      ...(utanProjekt ? {} : { projekt }),
      arenden: {
        samling: "arenden",
        falt: ["rubrik", "text", "status"],
        bygg: ({ rad }) => ({ rubrik: rad.rubrik, text: rad.text, status: rad.status }),
        kommentarer: async () => [],
        kommentera: async ({ rad, text }) => {
          kommentarer.push({ id: rad.id, text });
          return { id: `k${kommentarer.length}` };
        },
        markeraKlart: async ({ rad }) => ({ ok: (await grund.updateIf("arenden", rad.id, { status: "ny" }, { status: "hanterad" })).updated }),
        radera: async () => 0,
      },
      omrostning: { falt: ["forslag"], bygg: async () => ({ forslag: [] }), rosta: async () => ({ ok: true }) },
    },
    radering: {},
  });
  return { grund, tjanst, brev, signera, projekt, kommentarer, lage };
}

/** Bjuder in en gäst till ett projekt och löser in länken. */
async function projektGast(h, { epost = "per@extern.se", tagg = "koket", uid = AGARE, laddaNed = undefined } = {}) {
  const svar = await h.tjanst.bjud({ uid, slag: "projekt", groupId: GRUPP, tagg, epost, ...(laddaNed !== undefined ? { laddaNed } : {}) });
  const lank = h.brev[h.brev.length - 1].lankar[0];
  const inl = await h.tjanst.los({ id: lank.id, nyckel: lank.nyckel, ip: IP });
  expect(inl.ok, "inlösen").toBe(true);
  return { ...svar, sessionsnyckel: inl.sessionsnyckel };
}

const allaTexter = (v) => JSON.stringify(v);

describe("omfånget projekt i ramverkets modell", () => {
  it("är ett slag, en gäst i gruppen, och ger kalender, bibliotek och ärenden men aldrig chatt", () => {
    expect(GASTSLAG).toContain("projekt");
    expect(arGruppslag({ slag: "projekt", tagg: "koket" })).toBe(true);
    expect(arGruppslag({ slag: "grupp" })).toBe(true);
    expect(arGruppslag({ slag: "sak", funktion: "rosta", handelseId: "h" })).toBe(false);
    expect(GASTPROJEKTFUNKTIONER).toEqual(["kalender", "bibliotek", "arenden"]);
    for (const f of GASTPROJEKTFUNKTIONER) expect(GASTGRUPPFUNKTIONER, f).toContain(f);
    const o = { slag: "projekt", tagg: "koket" };
    for (const f of GASTPROJEKTFUNKTIONER) {
      expect(gastOmfangGer(o, { slag: ["grupp", "projekt"], funktion: f }), f).toBe(true);
      expect(gastOmfangGer(o, { slag: "projekt", funktion: f }), f).toBe(true);
    }
    expect(gastOmfangGer(o, { slag: ["grupp", "projekt"], funktion: "chatt" })).toBe(false);
    expect(gastOmfangGer(o, { slag: "grupp", funktion: "kalender" })).toBe(false);
    expect(gastOmfangGer(o, { funktion: "rosta" })).toBe(false);
    // En rad med en tagg utan form ger ingenting, inte ens det en projektgäst annars har.
    expect(gastOmfangGer({ slag: "projekt", tagg: "Köket" }, { slag: "projekt", funktion: "kalender" })).toBe(false);
    // En gruppgäst ger fortfarande chatt med listkravet, och en sakgäst ingenting.
    expect(gastOmfangGer({ slag: "grupp" }, { slag: ["grupp", "projekt"], funktion: "chatt" })).toBe(true);
    expect(gastOmfangGer({ slag: "sak", funktion: "rosta", handelseId: "h" }, { slag: ["grupp", "projekt"], funktion: "kalender" })).toBe(false);
  });

  it("nyckeln är projekt:<tagg>, bara med taggen, och en tagg utan form kastar", () => {
    expect(gastomfangsnyckel({ slag: "projekt", tagg: "koket" })).toBe("projekt:koket");
    expect(gastomfangsnyckel({ slag: "projekt", tagg: "eaop-extended-aop" })).toBe("projekt:eaop-extended-aop");
    for (const fel of ["", "Köket", "-koket", "koket-", "kök", "a b", "x".repeat(25), "kok~et", "kok/et", "kok_et"]) {
      expect(() => gastomfangsnyckel({ slag: "projekt", tagg: fel }), fel).toThrow(/tagg/);
    }
    expect(() => gastomfangsnyckel({ slag: "projekt", tagg: "koket", handelseId: "h" })).toThrow(/bara tagg/);
    expect(() => gastomfangsnyckel({ slag: "projekt" })).toThrow(/tagg/);
    // Ett projekt-id krockar inte med gruppens eller en saks.
    const id = (omfang) => gastInbjudningsId({ groupId: GRUPP, epost: "per@extern.se", omfang });
    expect(new Set([id({ slag: "projekt", tagg: "koket" }), id({ slag: "projekt", tagg: "badrum" }), id({ slag: "grupp" })]).size).toBe(3);
  });

  it("varje giltig projekttagg är också ett giltigt plats-id (projektets plats i biblioteket), provat på ett urval med golv", () => {
    const giltiga = ["a", "0", "koket", "eaop-extended-aop", "x".repeat(24), "a-b-c", "2026-budget", "ab"];
    expect(giltiga.length).toBeGreaterThanOrEqual(8);
    for (const t of giltiga) {
      expect(GASTPROJEKTTAGGFORM.test(t), t).toBe(true);
      expect(PLATSIDFORM.test(t), t).toBe(true);
      expect(() => platsBibliotek(GRUPP, t), t).not.toThrow();
    }
    expect(GASTPROJEKTKORTFALT).toEqual(["tagg", "status", "texter"]);
  });
});

describe("bjud till ett projekt", () => {
  it("ägare och admin bjuder in; en vanlig medlem och en utomstående får det inte", async () => {
    const h = bygg();
    await expect(h.tjanst.bjud({ uid: AGARE, slag: "projekt", groupId: GRUPP, tagg: "koket", epost: "a@extern.se" })).resolves.toMatchObject({ ny: true });
    await expect(h.tjanst.bjud({ uid: ADMIN, slag: "projekt", groupId: GRUPP, tagg: "koket", epost: "b@extern.se" })).resolves.toMatchObject({ ny: true });
    for (const uid of [MEDLEM, "uid-granne", "uid-okand"]) {
      await expect(h.tjanst.bjud({ uid, slag: "projekt", groupId: GRUPP, tagg: "koket", epost: "c@extern.se" }), uid).rejects.toMatchObject({ kod: "ej-behorig" });
    }
    const rader = await h.grund.list("gastinbjudningar");
    expect(rader).toHaveLength(2);
    for (const r of rader) {
      expect(r.omfang).toEqual({ slag: "projekt", tagg: "koket" });
      expect(r.laddaNed).toBe(false);
    }
    expect(h.brev[0].lankar[0].omfang).toEqual({ slag: "projekt", tagg: "koket" });
  });

  it("ett projekt som inte finns, ett arkiverat, en tagg utan form och en tjänst utan projekt nekas innan något skrivs", async () => {
    const h = bygg();
    await expect(h.tjanst.bjud({ uid: AGARE, slag: "projekt", groupId: GRUPP, tagg: "finnsinte", epost: "a@extern.se" })).rejects.toMatchObject({ kod: "finns-inte" });
    await expect(h.tjanst.bjud({ uid: AGARE, slag: "projekt", groupId: GRUPP, tagg: "gammalt", epost: "a@extern.se" })).rejects.toMatchObject({ kod: "finns-inte" });
    for (const tagg of ["Köket", "", undefined, "../x", "x".repeat(25)]) {
      await expect(h.tjanst.bjud({ uid: AGARE, slag: "projekt", groupId: GRUPP, tagg, epost: "a@extern.se" }), String(tagg)).rejects.toMatchObject({ kod: "ogiltigt-omfang" });
    }
    await expect(h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, tagg: "koket", epost: "a@extern.se" })).rejects.toMatchObject({ kod: "ogiltigt-omfang" });
    const utan = bygg({ utanProjekt: true });
    await expect(utan.tjanst.bjud({ uid: AGARE, slag: "projekt", groupId: GRUPP, tagg: "koket", epost: "a@extern.se" })).rejects.toMatchObject({ kod: "ogiltigt-omfang" });
    for (const k of [h, utan]) {
      expect(await k.grund.list("gastinbjudningar")).toHaveLength(0);
      expect(await k.grund.list("gastplatser")).toHaveLength(0);
      expect(k.brev).toHaveLength(0);
    }
  });

  it("⛔ projektgäster tar platser ur samma fem som gruppgäster: fyra i gruppen och en i projektet fyller taket, den sjätte nekas", async () => {
    const h = bygg();
    for (let i = 0; i < GAST_PLATSER_GRATIS - 1; i++) await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, epost: `g${i}@extern.se` });
    await h.tjanst.bjud({ uid: AGARE, slag: "projekt", groupId: GRUPP, tagg: "koket", epost: "p@extern.se" });
    expect(await h.grund.list("gastplatser")).toHaveLength(GAST_PLATSER_GRATIS);
    await expect(h.tjanst.bjud({ uid: AGARE, slag: "projekt", groupId: GRUPP, tagg: "badrum", epost: "p2@extern.se" })).rejects.toMatchObject({ kod: "platser-slut" });
    // Samma person i två projekt är en plats.
    await expect(h.tjanst.bjud({ uid: AGARE, slag: "projekt", groupId: GRUPP, tagg: "badrum", epost: "p@extern.se" })).resolves.toMatchObject({ ny: true });
    expect(await h.grund.list("gastplatser")).toHaveLength(GAST_PLATSER_GRATIS);
  });

  it("medlemmens lista visar projektets omfång med taggen och nedladdningen, och nedladdningen går att slå på", async () => {
    const h = bygg();
    const { id } = await h.tjanst.bjud({ uid: AGARE, slag: "projekt", groupId: GRUPP, tagg: "koket", epost: "per@extern.se", namn: "Per" });
    await h.tjanst.sattNedladdning({ uid: ADMIN, id, pa: true });
    const { personer } = await h.tjanst.lista({ uid: MEDLEM, groupId: GRUPP });
    expect(personer).toHaveLength(1);
    expect(personer[0].inbjudningar[0]).toMatchObject({ id, omfang: { slag: "projekt", tagg: "koket" }, laddaNed: true });
    await expect(h.tjanst.sattNedladdning({ uid: MEDLEM, id, pa: false })).rejects.toMatchObject({ kod: "ej-behorig" });
  });
});

describe("vad en projektgäst ser: bara projektet, urvalet görs på servern", () => {
  it("hamta: projektets namn som rubrik, tre funktioner utan chatt, kortet och ingenting om gruppen", async () => {
    const h = bygg();
    const g = await projektGast(h);
    const svar = await h.tjanst.hamta({ sessionsnyckel: g.sessionsnyckel });
    expect(svar.funktion).toBe("grupp");
    expect(svar.grupp.namn).toBe("Ombyggnad av köket");
    expect(svar.grupp.funktioner).toEqual(["kalender", "bibliotek", "arenden"]);
    expect(svar.grupp.kommentera).toBe(false);
    expect(svar.grupp.beskrivning).toBe("");
    expect(svar.grupp.projekt.tagg).toBe("koket");
    expect(svar.grupp.projekt.status).toEqual({ sv: "Pågår", en: "In progress" });
    // Tomma texter tas bort, och bara kortets fält lämnar servern.
    expect(svar.grupp.projekt.texter.map((x) => x.rubrik.sv)).toEqual(["Syfte", "Nuläge", "Öppna frågor"]);
    expect(Object.keys(svar.grupp.projekt).sort()).toEqual([...GASTPROJEKTKORTFALT].sort());
    for (const s of UTANFOR_PROJEKTET) expect(allaTexter(svar), s).not.toContain(s);
  });

  it("kalendern: projektets egen kalender, aldrig gruppens förvalda, en annan kalender, ett annat projekt eller en annan grupp", async () => {
    const h = bygg();
    const g = await projektGast(h);
    const k = await h.tjanst.kalender({ sessionsnyckel: g.sessionsnyckel });
    expect(k.ok).toBe(true);
    expect(k.handelser.map((x) => x.id).sort()).toEqual(["h-koket", "h-koket2"]);
    expect(k.kalendrar.map((x) => x.id)).toEqual(["kal-koket"]);
    expect(k.ejVisade).toBe(0);
    for (const s of UTANFOR_PROJEKTET) expect(allaTexter(k), s).not.toContain(s);
    // Projektet i gruppens förvalda kalender: bara händelser med taggen.
    const b = await projektGast(h, { epost: "bea@extern.se", tagg: "badrum" });
    const kb = await h.tjanst.kalender({ sessionsnyckel: b.sessionsnyckel });
    expect(kb.handelser.map((x) => x.id)).toEqual(["h-badrum"]);
  });

  it("en händelse utanför projektet är saknas, och en projektgäst svarar och röstar inte (skiva 1)", async () => {
    const h = bygg();
    const g = await projektGast(h);
    for (const id of ["h-grupp", "h-badrum", "h-annan", "h-grannen"]) {
      expect(await h.tjanst.handelse({ sessionsnyckel: g.sessionsnyckel, handelseId: id }), id).toEqual({ ok: false, orsak: "saknas" });
    }
    const egen = await h.tjanst.handelse({ sessionsnyckel: g.sessionsnyckel, handelseId: "h-koket" });
    expect(egen.ok).toBe(true);
    expect(egen.handelse.titel).toBe("Snickaren kommer");
    expect(egen.svar).toBeUndefined();
    expect(egen.omrostning).toBeUndefined();
    expect(await h.tjanst.svara({ sessionsnyckel: g.sessionsnyckel, handelseId: "h-koket", val: "kommer" })).toEqual({ ok: false, orsak: "nej" });
    expect(await h.tjanst.rosta({ sessionsnyckel: g.sessionsnyckel, handelseId: "h-koket", forslagId: "f1", val: "ja" })).toEqual({ ok: false, orsak: "nej" });
    expect(await h.grund.list("handelser/h-koket/svar")).toHaveLength(0);
  });

  it("biblioteket: bara projektets plats, och en fil signeras bara där", async () => {
    const h = bygg();
    const g = await projektGast(h, { laddaNed: true });
    const b = await h.tjanst.bibliotek({ sessionsnyckel: g.sessionsnyckel });
    expect(b.poster.map((p) => p.id)).toEqual(["p-ritning", "p-koket-not"]);
    for (const s of UTANFOR_PROJEKTET) expect(allaTexter(b), s).not.toContain(s);
    const fil = await h.tjanst.fil({ sessionsnyckel: g.sessionsnyckel, postId: "p-ritning" });
    expect(fil.ok).toBe(true);
    for (const id of ["p-grupp", "p-badrum", "p-grannen"]) {
      expect(await h.tjanst.fil({ sessionsnyckel: g.sessionsnyckel, postId: id }), id).toEqual({ ok: false, orsak: "saknas" });
      expect(await h.tjanst.anteckningsbilder({ sessionsnyckel: g.sessionsnyckel, postId: id }), id).toEqual({ ok: false, orsak: "saknas" });
    }
    expect(h.signera).toHaveBeenCalledTimes(1);
    expect(h.signera.mock.calls[0][0].sokvag).toBe(`grupper/plats~${GRUPP}~koket/bibliotek/p-ritning/ritning.pdf`);
  });

  it("ärendena: alla med projektets tagg, inga andra; kommentera på projektets, markera klart bara på det som ligger hos gästen", async () => {
    const h = bygg();
    const g = await projektGast(h);
    const a = await h.tjanst.arenden({ sessionsnyckel: g.sessionsnyckel });
    expect(a.poster.map((p) => p.id).sort()).toEqual(["a-koket", "a-koket-per"]);
    expect(Object.fromEntries(a.poster.map((p) => [p.id, p.hosDig]))).toEqual({ "a-koket": false, "a-koket-per": true });
    for (const s of UTANFOR_PROJEKTET) expect(allaTexter(a), s).not.toContain(s);
    // Kommentera: projektets ja, allt annat nej. Ett ärende hos gästen utanför projektet är också nej.
    expect((await h.tjanst.kommenteraArende({ sessionsnyckel: g.sessionsnyckel, arendeId: "a-koket", text: "Jag kollar" })).ok).toBe(true);
    for (const id of ["a-badrum", "a-grupp", "a-grupp-per", "a-grannen"]) {
      expect(await h.tjanst.kommenteraArende({ sessionsnyckel: g.sessionsnyckel, arendeId: id, text: "x" }), id).toEqual({ ok: false, orsak: "nej" });
    }
    expect(h.kommentarer).toEqual([{ id: "a-koket", text: "Jag kollar" }]);
    expect(await h.tjanst.markeraArendeKlart({ sessionsnyckel: g.sessionsnyckel, arendeId: "a-koket" })).toEqual({ ok: false, orsak: "nej" });
    expect(await h.tjanst.markeraArendeKlart({ sessionsnyckel: g.sessionsnyckel, arendeId: "a-grupp-per" })).toEqual({ ok: false, orsak: "nej" });
    expect(await h.tjanst.markeraArendeKlart({ sessionsnyckel: g.sessionsnyckel, arendeId: "a-koket-per" })).toEqual({ ok: true });
  });

  it("översikten läser samma urval: nästa händelse i projektet, utan Svara, projektets bibliotek och ingen chatt", async () => {
    const h = bygg();
    const g = await projektGast(h);
    const o = await h.tjanst.oversikt({ sessionsnyckel: g.sessionsnyckel, idag: "2026-11-11", sedan: {} });
    expect(o.ok).toBe(true);
    expect(o.chatt).toBeNull();
    expect(o.kalender.nasta).toMatchObject({ id: "h-koket", mitt: null });
    expect(o.bibliotek.antal).toBe(2);
    for (const s of UTANFOR_PROJEKTET) expect(allaTexter(o), s).not.toContain(s);
  });

  it("⛔ chatten är stängd för en projektgäst: läsa, skriva och kommentera en post är nej", async () => {
    const h = bygg();
    const g = await projektGast(h);
    expect(await h.tjanst.chatt({ sessionsnyckel: g.sessionsnyckel })).toEqual({ ok: false, orsak: "nej" });
    expect(await h.tjanst.skrivChatt({ sessionsnyckel: g.sessionsnyckel, text: "hej" })).toEqual({ ok: false, orsak: "nej" });
    expect(await h.tjanst.kommenteraPost({ sessionsnyckel: g.sessionsnyckel, postId: "p-ritning", text: "hej" })).toEqual({ ok: false, orsak: "nej" });
    expect(await h.grund.list(`samtal/${GRUPP}|grupp/meddelanden`)).toHaveLength(1);
  });
});

describe("⛔ det som inte får gå: förfalskad tagg, återkallad inbjudan, borttaget projekt", () => {
  /** Varje åtgärd en projektgäst har, med en förfalskad tagg och grupp i anropet. Golv: sju. */
  const ATGARDER = {
    hamta: (t, k) => t.hamta({ sessionsnyckel: k, tagg: "badrum", groupId: GRANNEN }),
    oversikt: (t, k) => t.oversikt({ sessionsnyckel: k, tagg: "badrum", idag: "2026-11-11" }),
    kalender: (t, k) => t.kalender({ sessionsnyckel: k, tagg: "badrum", groupId: GRANNEN }),
    handelse: (t, k) => t.handelse({ sessionsnyckel: k, handelseId: "h-koket", tagg: "badrum" }),
    bibliotek: (t, k) => t.bibliotek({ sessionsnyckel: k, tagg: "badrum", plats: `plats~${GRUPP}~badrum` }),
    fil: (t, k) => t.fil({ sessionsnyckel: k, postId: "p-ritning", tagg: "badrum" }),
    arenden: (t, k) => t.arenden({ sessionsnyckel: k, tagg: "badrum" }),
  };

  it("en tagg eller grupp i anropet läses aldrig: gästen i köket ser köket, vad anropet än säger", async () => {
    expect(Object.keys(ATGARDER).length).toBeGreaterThanOrEqual(7);
    const h = bygg();
    const g = await projektGast(h, { laddaNed: true });
    for (const [namn, anrop] of Object.entries(ATGARDER)) {
      const svar = await anrop(h.tjanst, g.sessionsnyckel);
      expect(svar.ok, namn).toBe(true);
      for (const s of UTANFOR_PROJEKTET) expect(allaTexter(svar), `${namn}/${s}`).not.toContain(s);
    }
    // Urvalet frågades bara om köket.
    for (const [arg] of h.projekt.urval.mock.calls) expect(arg).toEqual({ groupId: GRUPP, tagg: "koket" });
  });

  it("en inbjudningsrad vars tagg ändrats till något utan form ger nej i varje åtgärd", async () => {
    const h = bygg();
    const g = await projektGast(h);
    await h.grund.update("gastinbjudningar", g.id, { omfang: { slag: "projekt", tagg: "../badrum" } });
    for (const [namn, anrop] of Object.entries(ATGARDER)) expect(await anrop(h.tjanst, g.sessionsnyckel), namn).toEqual({ ok: false, orsak: "nej" });
  });

  it("en återkallad inbjudan slutar fungera i varje åtgärd, och platsen släpps", async () => {
    const h = bygg();
    const g = await projektGast(h);
    expect((await h.tjanst.kalender({ sessionsnyckel: g.sessionsnyckel })).ok).toBe(true);
    await h.tjanst.aterkalla({ uid: ADMIN, id: g.id });
    for (const [namn, anrop] of Object.entries(ATGARDER)) expect(await anrop(h.tjanst, g.sessionsnyckel), namn).toEqual({ ok: false, orsak: "aterkallad" });
    expect(await h.grund.list("gastplatser")).toHaveLength(0);
  });

  it("den som bjöd in och sedan blev vanlig medlem får dra tillbaka men inte skicka igen", async () => {
    const h = bygg();
    const { id } = await h.tjanst.bjud({ uid: ADMIN, slag: "projekt", groupId: GRUPP, tagg: "koket", epost: "per@extern.se" });
    await h.grund.update("memberships", medlemskapsId(ADMIN, GRUPP), { roll: "medlem" });
    await expect(h.tjanst.skickaOm({ uid: ADMIN, id })).rejects.toMatchObject({ kod: "ej-behorig" });
    await expect(h.tjanst.aterkalla({ uid: ADMIN, id })).resolves.toMatchObject({ id });
  });

  it("ett projekt som arkiverats efter inbjudan stänger allt med saknas, och ett trasigt urval kastar i stället för att öppna", async () => {
    const h = bygg();
    const g = await projektGast(h);
    /** @type {any} */ (PROJEKT.koket).arkiverad = true;
    try {
      for (const [namn, anrop] of Object.entries(ATGARDER)) expect(await anrop(h.tjanst, g.sessionsnyckel), namn).toEqual({ ok: false, orsak: "saknas" });
    } finally {
      delete (/** @type {any} */ (PROJEKT.koket).arkiverad);
    }
    const t = bygg();
    const tg = await projektGast(t);
    t.lage.trasigt = true;
    await expect(t.tjanst.kalender({ sessionsnyckel: tg.sessionsnyckel })).rejects.toThrow(/handelse och arende/);
  });

  it("⛔ ett urval som kastar eller svarar något annat än true stänger: ingen händelse och inget ärende syns", async () => {
    const h = bygg();
    const g = await projektGast(h);
    h.lage.oklar = true;
    expect((await h.tjanst.kalender({ sessionsnyckel: g.sessionsnyckel })).handelser).toEqual([]);
    expect(await h.tjanst.handelse({ sessionsnyckel: g.sessionsnyckel, handelseId: "h-koket" })).toEqual({ ok: false, orsak: "saknas" });
    expect((await h.tjanst.arenden({ sessionsnyckel: g.sessionsnyckel })).poster).toEqual([]);
    expect(await h.tjanst.kommenteraArende({ sessionsnyckel: g.sessionsnyckel, arendeId: "a-koket", text: "x" })).toEqual({ ok: false, orsak: "nej" });
  });

  it("en gruppgäst påverkas inte: hela gruppens kalender, bibliotek och chatt som förut, och inget hosDig på ärendena", async () => {
    const h = bygg();
    await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, epost: "per@extern.se" });
    const lank = h.brev[h.brev.length - 1].lankar[0];
    const { sessionsnyckel } = await h.tjanst.los({ id: lank.id, nyckel: lank.nyckel, ip: IP });
    const k = await h.tjanst.kalender({ sessionsnyckel });
    expect(k.handelser.map((x) => x.id).sort()).toEqual(["h-annan", "h-badrum", "h-grupp", "h-koket", "h-koket2"]);
    expect((await h.tjanst.bibliotek({ sessionsnyckel })).poster.map((p) => p.id)).toEqual(["p-grupp"]);
    expect((await h.tjanst.chatt({ sessionsnyckel })).ok).toBe(true);
    const a = await h.tjanst.arenden({ sessionsnyckel });
    expect(a.poster.map((p) => p.id).sort()).toEqual(["a-grupp-per", "a-koket-per"]);
    for (const p of a.poster) expect(p.hosDig).toBeUndefined();
    expect(h.projekt.urval).not.toHaveBeenCalled();
  });
});
