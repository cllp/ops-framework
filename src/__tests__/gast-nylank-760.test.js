import { describe, expect, it, vi } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { GASTLANKDAGAR, GASTNYLANK_BREV_PER_DYGN, GASTNYLANK_GILTIG_MS, GASTNYLANK_MAX_LANKAR, GASTNYLANK_SVAR, GASTNYLANKIP_MAX } from "../lib/gast.js";
import { medlemskapsId } from "../lib/grupp.js";
import { createGastService } from "../node/gast.js";

/**
 * Brevet "Mina inbjudningar" (`nyLank({ epost })`, 0.215.0, cllp/lifehub.app#760 skiva 3).
 *
 * MÄTT FÖRE ÄNDRINGEN (scratch-mätningen i rapporten, samma tjänst och minneskälla): länken i det insamlade brevet gällde 30 dagar och gick att lösa in två gånger, också två dygn senare; med ett utskick på 80 ms tog en
 * träff 81 ms och en miss 0,1 ms. Taken (10 per IP och timme, 3 brev per adress och dygn, 5 länkar per brev) var tysta: samma svar varje gång.
 *
 * ⛔ VARJE PROV HAR SETTS FALLA: mutationerna och utfallen står i rapporten. Listorna har golv.
 */

const NU = 1_800_000_000_000;
const GRUPP = "g1";
const AGARE = "uid-agare";
const DYGN = 24 * 60 * 60 * 1000;

/** @param {{ golv?: number, sandMs?: number }} [val] */
function bygg({ golv = 0, sandMs = 0 } = {}) {
  const grund = createMemorySource({
    memberships: [{ id: medlemskapsId(AGARE, GRUPP), userId: AGARE, groupId: GRUPP, roll: "agare", typ: "person", status: "aktiv", namn: "Ägaren" }],
    groups: [{ id: GRUPP, namn: "Källan" }],
    handelser: Array.from({ length: 8 }, (_, i) => ({ id: `h${i}`, groupId: GRUPP, rubrik: `Möte ${i}`, datum: "2026-12-01" })),
    gastinbjudningar: [],
    gastsessioner: [],
    gastplatser: [],
    gastraknare: [],
  });
  /** @type {any[]} */
  const brev = [];
  const tid = { nu: NU };
  const tjanst = createGastService({
    kalla: grund,
    samlingar: { inbjudningar: "gastinbjudningar", sessioner: "gastsessioner", platser: "gastplatser", raknare: "gastraknare", handelser: "handelser" },
    farBjuda: () => true,
    skicka: async (b) => {
      if (sandMs) await new Promise((r) => setTimeout(r, sandMs));
      brev.push(b);
    },
    rapportera: vi.fn(),
    klocka: () => tid.nu,
    nyLankGolvMs: golv,
    grupp: {
      samlingar: { grupper: "groups", samtal: "samtal", meddelanden: "meddelanden", bibliotek: "bibliotek", svar: "svar" },
      lagring: { signeradAdress: async () => "x" },
      handelseSida: (h) => ({ titel: h.rubrik }),
      omrostning: { falt: ["forslag"], bygg: async () => ({ forslag: [] }), rosta: async () => ({ ok: true }) },
    },
    radering: {},
  });
  let ip = 0;
  const nyIp = () => `203.0.113.${(ip++ % 250) + 1}`;
  return { grund, tjanst, brev, tid, nyIp };
}

/** Bjuder in Per till hela gruppen och svarar inbjudans id. */
const bjudGrupp = async (/** @type {ReturnType<typeof bygg>} */ h, epost = "per@extern.se") => (await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, epost })).id;

describe("länkarna i brevet Mina inbjudningar", () => {
  it("⛔ gäller en gång: den första inlösen ger en session, den andra är utgången, och en prövning förbrukar ingenting", async () => {
    const h = bygg();
    await bjudGrupp(h);
    await h.tjanst.nyLank({ epost: "per@extern.se", ip: h.nyIp() });
    const b = h.brev.at(-1);
    expect(b).toMatchObject({ typ: "ny-lank", engangs: true, fler: 0 });
    const l = b.lankar[0];
    expect(await h.tjanst.prova({ id: l.id, nyckel: l.nyckel, ip: h.nyIp() })).toEqual({ ok: true });
    expect(await h.tjanst.prova({ id: l.id, nyckel: l.nyckel, ip: h.nyIp() })).toEqual({ ok: true });
    const forsta = await h.tjanst.los({ id: l.id, nyckel: l.nyckel, ip: h.nyIp() });
    expect(forsta.ok).toBe(true);
    expect(await h.tjanst.los({ id: l.id, nyckel: l.nyckel, ip: h.nyIp() })).toEqual({ ok: false, orsak: "utgangen" });
    // Sessionen som gavs lever.
    expect((await h.tjanst.hamta({ sessionsnyckel: /** @type {any} */ (forsta).sessionsnyckel })).ok).toBe(true);
  });

  it("⛔ gäller ett dygn och inte trettio", async () => {
    const h = bygg();
    const id = await bjudGrupp(h);
    await h.tjanst.nyLank({ epost: "per@extern.se", ip: h.nyIp() });
    const l = h.brev.at(-1).lankar[0];
    const rad = await h.grund.read("gastinbjudningar", id);
    expect(rad.lankGiltigTill - NU).toBe(GASTNYLANK_GILTIG_MS);
    expect(GASTNYLANK_GILTIG_MS).toBeLessThan(GASTLANKDAGAR * DYGN);
    h.tid.nu = NU + GASTNYLANK_GILTIG_MS + 1;
    expect(await h.tjanst.los({ id: l.id, nyckel: l.nyckel, ip: h.nyIp() })).toEqual({ ok: false, orsak: "utgangen" });
  });

  it("⛔ två samtidiga inlösen ger exakt en session", async () => {
    const h = bygg();
    await bjudGrupp(h);
    await h.tjanst.nyLank({ epost: "per@extern.se", ip: h.nyIp() });
    const l = h.brev.at(-1).lankar[0];
    const svar = await Promise.all([h.tjanst.los({ id: l.id, nyckel: l.nyckel, ip: h.nyIp() }), h.tjanst.los({ id: l.id, nyckel: l.nyckel, ip: h.nyIp() })]);
    expect(svar.filter((s) => s.ok)).toHaveLength(1);
    expect((await h.grund.list("gastsessioner")).length).toBe(1);
  });

  it("en ny länk ur en förbrukad länk och Skicka igen från den som bjöd in är vanliga länkar: flera gånger, trettio dagar", async () => {
    const h = bygg();
    const id = await bjudGrupp(h);
    await h.tjanst.nyLank({ epost: "per@extern.se", ip: h.nyIp() });
    const l = h.brev.at(-1).lankar[0];
    await h.tjanst.los({ id: l.id, nyckel: l.nyckel, ip: h.nyIp() });
    // Skicka en ny länk på sidan för en förbrukad länk: brevet går till inbjudans egen adress.
    await h.tjanst.nyLank({ id: l.id, nyckel: l.nyckel, ip: h.nyIp() });
    const ny = h.brev.at(-1);
    expect(ny.engangs).toBeUndefined();
    const nl = ny.lankar[0];
    expect((await h.tjanst.los({ id: nl.id, nyckel: nl.nyckel, ip: h.nyIp() })).ok).toBe(true);
    expect((await h.tjanst.los({ id: nl.id, nyckel: nl.nyckel, ip: h.nyIp() })).ok).toBe(true);
    expect((await h.grund.read("gastinbjudningar", id)).lankGiltigTill - NU).toBe(GASTLANKDAGAR * DYGN);
    // Skicka igen från den som bjöd in, efter en ny engångslänk.
    await h.tjanst.nyLank({ epost: "per@extern.se", ip: h.nyIp() });
    await h.tjanst.skickaOm({ uid: AGARE, id });
    const om = h.brev.at(-1).lankar[0];
    expect((await h.tjanst.los({ id: om.id, nyckel: om.nyckel, ip: h.nyIp() })).ok).toBe(true);
    expect((await h.tjanst.los({ id: om.id, nyckel: om.nyckel, ip: h.nyIp() })).ok).toBe(true);
  });
});

describe("taket på fem länkar: brevet säger och N till", () => {
  it("⛔ med sju inbjudningar bär brevet fem länkar, hela gruppen först, och fler: 2", async () => {
    const h = bygg();
    for (let i = 0; i < 6; i++) await h.tjanst.bjud({ uid: AGARE, handelseId: `h${i}`, epost: "per@extern.se" });
    await bjudGrupp(h);
    await h.tjanst.nyLank({ epost: "per@extern.se", ip: h.nyIp() });
    const b = h.brev.at(-1);
    expect(b.lankar).toHaveLength(GASTNYLANK_MAX_LANKAR);
    expect(b.lankar[0].omfang).toEqual({ slag: "grupp" });
    expect(b.fler).toBe(2);
  });
  it("med en inbjudan är fler 0", async () => {
    const h = bygg();
    await bjudGrupp(h);
    await h.tjanst.nyLank({ epost: "per@extern.se", ip: h.nyIp() });
    expect(h.brev.at(-1).fler).toBe(0);
  });
});

describe("⛔ samma svar och samma tid, och taken är tysta", () => {
  it("en träff och en miss tar lika lång tid: golvet döljer utskickets tid", async () => {
    const SAND = 30;
    const GOLV = 120;
    const h = bygg({ golv: GOLV, sandMs: SAND });
    await bjudGrupp(h);
    const matt = async (/** @type {string} */ epost) => {
      const s = performance.now();
      const r = await h.tjanst.nyLank({ epost, ip: h.nyIp() });
      return { ms: performance.now() - s, r };
    };
    const traff = [];
    const miss = [];
    for (let i = 0; i < 3; i++) traff.push(await matt("per@extern.se"));
    for (let i = 0; i < 3; i++) miss.push(await matt(`ingen${i}@extern.se`));
    // Golv: tre träffar skickade brev, tre missar inget.
    expect(h.brev.filter((b) => b.typ === "ny-lank")).toHaveLength(3);
    for (const x of [...traff, ...miss]) {
      expect(x.r).toEqual({ ok: true, svar: GASTNYLANK_SVAR });
      expect(x.ms).toBeGreaterThanOrEqual(GOLV - 2);
    }
    const medel = (/** @type {{ ms: number }[]} */ a) => a.reduce((n, x) => n + x.ms, 0) / a.length;
    expect(Math.abs(medel(traff) - medel(miss))).toBeLessThan(SAND / 2);
  });

  it("utan golv syns utskickets tid: mätningen före ändringen", async () => {
    const SAND = 30;
    const h = bygg({ golv: 0, sandMs: SAND });
    await bjudGrupp(h);
    const s1 = performance.now();
    await h.tjanst.nyLank({ epost: "per@extern.se", ip: h.nyIp() });
    const traff = performance.now() - s1;
    const s2 = performance.now();
    await h.tjanst.nyLank({ epost: "ingen@extern.se", ip: h.nyIp() });
    const miss = performance.now() - s2;
    expect(traff - miss).toBeGreaterThanOrEqual(SAND - 5);
  });

  it("⛔ taket per IP och taket per adress svarar som vanligt och skickar inget", async () => {
    const h = bygg();
    await bjudGrupp(h);
    const ip = "198.51.100.7";
    const svar = [];
    for (let i = 0; i < GASTNYLANKIP_MAX + 2; i++) svar.push(await h.tjanst.nyLank({ epost: "per@extern.se", ip }));
    expect(svar).toHaveLength(GASTNYLANKIP_MAX + 2);
    for (const s of svar) expect(s).toEqual({ ok: true, svar: GASTNYLANK_SVAR });
    // Brev per adress och dygn: taket, inte fler, fast tolv bad.
    expect(h.brev.filter((b) => b.typ === "ny-lank")).toHaveLength(GASTNYLANK_BREV_PER_DYGN);
  });
});
