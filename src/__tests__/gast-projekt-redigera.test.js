import { describe, expect, it, vi } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { MAX_BIBLIOTEKRUBRIK } from "../lib/bibliotek.js";
import {
  GASTFALT,
  GASTFELKODER,
  GASTGRUPPATGARDER,
  GASTGRUPPSVARSFALT,
  GASTPROJEKTLISTFALT,
  GASTSKRIV_MAX_TECKEN,
  GASTSKRIV_PER_MINUT,
  GASTUPPLADDNING_PER_DYGN,
  gastGruppApi,
  gastId,
} from "../lib/gast.js";
import { gastBehorighetsrader } from "../lib/gastBehorighet.js";
import { medlemskapsId } from "../lib/grupp.js";
import { byggGastinbjudan, createGastService } from "../node/gast.js";

/**
 * En projektgäst som får ladda upp och ändra (0.254.0, cllp/lifehub.app#928 del 2, CP "kör"). Reglaget "Får ladda upp och ändra" på en projektinbjudan (`redigera`, av som förval) ger gästen fem åtgärder:
 * `laddaUpp` och `laddaUppKlar` (en fil till projektets plats), `bytNamnPost` och `taBortPost` (en fil eller en anteckning på projektets plats) och `skapaArende` (ett ärende i projektet). Inget annat.
 *
 * ⛔ VARJE VAKT HÄR HAR SETTS FALLA: mutationerna och utfallen står i PR-texten (arbetsreglernas punkt 4). Listorna har golv, så att ett prov som läser noll rader inte blir grönt av att ingenting lästes.
 */

const NU = 1_800_000_000_000;
const GRUPP = "kallan";
const GRANNEN = "grannen";
const AGARE = "uid-agare-r1";
const ADMIN = "uid-admin-r2";
const MEDLEM = "uid-medlem-r3";
const IP = "203.0.113.9";
const KOK = `plats~${GRUPP}~koket`;

const medlemskap = (uid, groupId, roll) => ({ id: medlemskapsId(uid, groupId), userId: uid, groupId, roll, typ: "person", status: "aktiv", namn: uid });
const fil = (id, plats, namn = "a.pdf") => ({ id, groupId: plats, typ: "fil", rubrik: id.toUpperCase(), fil: { sokvag: `grupper/${plats}/bibliotek/${id}/${namn}`, namn, mime: "application/pdf", byte: 10, klar: true }, skapad: 1, andrad: 1, skapadAv: { uid: AGARE, namn: "Ägaren" } });

function seed() {
  return {
    memberships: [medlemskap(AGARE, GRUPP, "agare"), medlemskap(ADMIN, GRUPP, "admin"), medlemskap(MEDLEM, GRUPP, "medlem"), medlemskap("uid-granne", GRANNEN, "agare")],
    groups: [{ id: GRUPP, namn: "Källan" }, { id: GRANNEN, namn: "Grannen" }],
    handelser: [],
    arenden: [{ id: "a-koket", groupId: GRUPP, taggar: ["koket"], rubrik: "Beställ luckor", text: "Vita", status: "ny", skapad: "2026-11-01" }],
    bibliotek: [
      fil("p-ritning", KOK),
      { id: "p-not", groupId: KOK, typ: "anteckning", rubrik: "Mått", text: "240 cm", skapad: 2, andrad: 2, skapadAv: { uid: AGARE, namn: "Ägaren" } },
      { id: "p-lank", groupId: KOK, typ: "lank", rubrik: "Leverantören", url: "https://exempel.se", skapad: 3, andrad: 3, skapadAv: { uid: AGARE, namn: "Ägaren" } },
      { id: "p-lista", groupId: KOK, typ: "lista", rubrik: "Att köpa", poster: [], skapad: 4, andrad: 4, skapadAv: { uid: AGARE, namn: "Ägaren" } },
      fil("p-grupp", GRUPP),
      fil("p-badrum", `plats~${GRUPP}~badrum`),
      fil("p-grannen", `plats~${GRANNEN}~koket`),
    ],
    gastinbjudningar: [],
    gastsessioner: [],
    gastplatser: [],
    gastraknare: [],
  };
}

/** Allt utanför köket, som en gäst i köket aldrig rör. Golv: minst fyra. */
const UTANFOR = ["p-grupp", "p-badrum", "p-grannen", "p-lank", "p-lista", "p-finns-inte"];

/**
 * Appens skrivningar, som stand-in: samma form som lifehub.app ska ge (`grupp.projekt.redigering`). Reservationen minns platsen och gästen och prövas i `filKlar`, som appens ska.
 * `lage.vagra`: appen säger nej till filen. `lage.felSvar`: appens `nyFil` svarar utan form. `lage.felPlats`: `filKlar` pekar på gruppens fil. `lage.utanfor`: ärendet skrivs utan projektets tagg.
 */
function appensRedigering(grund, lage) {
  let n = 0;
  /** @type {Map<string, { plats: string, gastId: string, filnamn: string, typ: string, storlek: number, rubrik: string }>} */
  const reserverade = new Map();
  return {
    nyFil: vi.fn(async ({ plats, gastId, filnamn, typ, storlek, rubrik }) => {
      if (lage.vagra) throw Object.assign(new Error("appen: för stor"), { kod: "for-stor" });
      if (lage.felSvar) return { id: "u/1", url: "http://inte-https", huvuden: [] };
      const id = `u${++n}`;
      reserverade.set(id, { plats, gastId, filnamn, typ, storlek, rubrik });
      return { id, url: `https://lagring.example/put/${id}`, huvuden: { "Content-Type": typ } };
    }),
    filKlar: vi.fn(async ({ plats, gastId, namn, id }) => {
      if (lage.felPlats) return { postId: "p-grupp" };
      const r = reserverade.get(id);
      if (!r || r.plats !== plats || r.gastId !== gastId) throw new Error("appen: ingen sådan reservation");
      await grund.createNew("bibliotek", { id, groupId: plats, typ: "fil", rubrik: r.rubrik, fil: { sokvag: `grupper/${plats}/bibliotek/${id}/${r.filnamn}`, namn: r.filnamn, mime: r.typ, byte: r.storlek, klar: true }, skapad: NU, andrad: NU, skapadAv: { uid: gastId, namn } });
      return { postId: id };
    }),
    bytNamn: vi.fn(async ({ post, rubrik }) => {
      await grund.update("bibliotek", post.id, { rubrik });
    }),
    taBort: vi.fn(async ({ post }) => {
      await grund.remove("bibliotek", post.id);
    }),
    skapaArende: vi.fn(async ({ groupId, tagg, gastId, namn, rubrik, text }) => {
      const id = `a-ny-${++n}`;
      await grund.createNew("arenden", { id, groupId, taggar: lage.utanfor ? [] : [tagg], rubrik, text, status: "ny", skapad: "2026-11-22", skapadAv: { gastId, namn } });
      return { id };
    }),
  };
}

function bygg({ utanRedigering = false } = {}) {
  const grund = createMemorySource(seed());
  /** @type {any[]} */
  const brev = [];
  const lage = { vagra: false, felSvar: false, felPlats: false, utanfor: false };
  const redigering = appensRedigering(grund, lage);
  const projekt = {
    urval: async ({ groupId, tagg }) =>
      groupId === GRUPP && (tagg === "koket" || tagg === "badrum")
        ? { namn: tagg === "koket" ? "Köket" : "Badrummet", status: { sv: "Pågår", en: "In progress" }, texter: [], handelse: () => false, arende: (r) => Array.isArray(r.taggar) && r.taggar.includes(tagg) }
        : null,
    ...(utanRedigering ? {} : { redigering }),
  };
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
      samlingar: { grupper: "groups", samtal: "samtal", meddelanden: "meddelanden", bibliotek: "bibliotek", svar: "svar" },
      lagring: { signeradAdress: async ({ sokvag }) => `https://lagring.example/s/${encodeURIComponent(sokvag)}` },
      handelseSida: (h) => ({ titel: h.rubrik }),
      projekt,
      arenden: {
        samling: "arenden",
        falt: ["rubrik", "text", "status"],
        bygg: ({ rad }) => ({ rubrik: rad.rubrik, text: rad.text, status: rad.status }),
        kommentarer: async () => [],
        kommentera: async () => ({ id: "k1" }),
        markeraKlart: async () => ({ ok: true }),
        radera: async () => 0,
      },
    },
    radering: {},
  });
  return { grund, tjanst, brev, redigering, lage };
}

/** Bjuder in en gäst till köket (eller hela gruppen) och löser in länken. `redigera` slås på efteråt av en admin, som i vyn. */
async function gast(h, { slag = "projekt", epost = "per@extern.se", namn = "Per", redigera = true } = {}) {
  const svar = await h.tjanst.bjud({ uid: AGARE, slag, groupId: GRUPP, ...(slag === "projekt" ? { tagg: "koket" } : {}), epost, namn });
  if (redigera && slag === "projekt") await h.tjanst.sattRedigera({ uid: ADMIN, id: svar.id, pa: true });
  const lank = h.brev[h.brev.length - 1].lankar[0];
  const inl = await h.tjanst.los({ id: lank.id, nyckel: lank.nyckel, ip: IP });
  expect(inl.ok, "inlösen").toBe(true);
  return { ...svar, sessionsnyckel: inl.sessionsnyckel };
}

/** De fem åtgärdernas giltiga indata mot grunddatan. Golv: fem. */
const INDATA = {
  laddaUpp: { filnamn: "foto.jpg", typ: "image/jpeg", storlek: 1000 },
  laddaUppKlar: { id: "u1" },
  bytNamnPost: { postId: "p-ritning", rubrik: "Ny ritning" },
  taBortPost: { postId: "p-not" },
  skapaArende: { rubrik: "Luckorna är fel", text: "Två är för smala" },
};
/** @type {Record<keyof typeof INDATA, (t: any, k: string, extra?: Record<string, unknown>) => Promise<any>>} */
const ATGARDER = /** @type {any} */ (Object.fromEntries(Object.entries(INDATA).map(([a, d]) => [a, (t, k, extra = {}) => t[a]({ sessionsnyckel: k, ...d, ...extra })])));

/** Har appen fått något anrop alls? Ett nej ska vara ramverkets, före appen. */
const appenAnropad = (h) => Object.values(h.redigering).reduce((n, f) => n + f.mock.calls.length, 0);

describe("modellen: redigera på en projektinbjudan", () => {
  it("fältet, listans fält, de fem åtgärderna med sina svarsfält, taket och felkoden finns, och api:t bär dem", () => {
    expect(GASTFALT).toContain("redigera");
    expect(GASTPROJEKTLISTFALT).toEqual(["redigera"]);
    expect(GASTGRUPPSVARSFALT.hamta).toContain("redigera");
    expect(GASTUPPLADDNING_PER_DYGN).toBe(20);
    expect(GASTFELKODER).toContain("ogiltig-fil");
    const fem = Object.keys(ATGARDER);
    expect(fem).toHaveLength(5);
    for (const a of fem) {
      expect(GASTGRUPPATGARDER, a).toContain(a);
      expect(Array.isArray(GASTGRUPPSVARSFALT[a]), a).toBe(true);
      expect(GASTGRUPPSVARSFALT[a][0], a).toBe("ok");
    }
    expect(GASTGRUPPSVARSFALT.laddaUpp).toEqual(["ok", "id", "url", "huvuden"]);
    expect(GASTGRUPPSVARSFALT.laddaUppKlar).toEqual(["ok", "postId"]);
    expect(GASTGRUPPSVARSFALT.skapaArende).toEqual(["ok", "arende"]);
    const anrop = vi.fn(async () => ({ ok: true }));
    const api = gastGruppApi(anrop, "a".repeat(43));
    for (const a of fem) expect(typeof api[a], a).toBe("function");
  });

  it("byggGastinbjudan: ett projekt får redigera false som förval och true när det anges; hela gruppen och en sak får aldrig fältet och kastar på ett värde", () => {
    const bas = { groupId: GRUPP, epost: "per@extern.se", skapadAv: { uid: AGARE }, skapad: NU, nyckel: "x".repeat(43) };
    expect(byggGastinbjudan({ ...bas, omfang: { slag: "projekt", tagg: "koket" } }).redigera).toBe(false);
    expect(byggGastinbjudan({ ...bas, omfang: { slag: "projekt", tagg: "koket" }, redigera: true }).redigera).toBe(true);
    expect(byggGastinbjudan({ ...bas, omfang: { slag: "projekt", tagg: "koket" }, redigera: false }).redigera).toBe(false);
    expect(byggGastinbjudan({ ...bas, omfang: { slag: "grupp" } })).not.toHaveProperty("redigera");
    expect(byggGastinbjudan({ ...bas, omfang: { slag: "sak", funktion: "rosta", handelseId: "h1" } })).not.toHaveProperty("redigera");
    expect(() => byggGastinbjudan({ ...bas, omfang: { slag: "grupp" }, redigera: true })).toThrow(/redigera gäller bara/);
    expect(() => byggGastinbjudan({ ...bas, omfang: { slag: "sak", funktion: "rosta", handelseId: "h1" }, redigera: false })).toThrow(/redigera gäller bara/);
    expect(() => byggGastinbjudan({ ...bas, omfang: { slag: "projekt", tagg: "koket" }, redigera: "true" })).toThrow(/sant eller falskt/);
  });

  it("en ny projektgäst har redigera false på raden, och Bjud in igen ändrar det inte", async () => {
    const h = bygg();
    const { id } = await h.tjanst.bjud({ uid: AGARE, slag: "projekt", groupId: GRUPP, tagg: "koket", epost: "per@extern.se" });
    expect((await h.grund.read("gastinbjudningar", id)).redigera).toBe(false);
    await h.tjanst.sattRedigera({ uid: AGARE, id, pa: true });
    await h.tjanst.bjud({ uid: AGARE, slag: "projekt", groupId: GRUPP, tagg: "koket", epost: "per@extern.se" });
    expect((await h.grund.read("gastinbjudningar", id)).redigera).toBe(true);
  });
});

describe("sattRedigera: bara ägare och admin, bara ett projekt", () => {
  it("ägaren och admin slår på och av; bara redigera ändras på raden", async () => {
    const h = bygg();
    const { id } = await h.tjanst.bjud({ uid: AGARE, slag: "projekt", groupId: GRUPP, tagg: "koket", epost: "per@extern.se" });
    const fore = await h.grund.read("gastinbjudningar", id);
    expect(await h.tjanst.sattRedigera({ uid: ADMIN, id, pa: true })).toEqual({ id, redigera: true });
    const efter = await h.grund.read("gastinbjudningar", id);
    expect(efter).toEqual({ ...fore, redigera: true });
    expect(await h.tjanst.sattRedigera({ uid: AGARE, id, pa: false })).toEqual({ id, redigera: false });
    expect((await h.grund.read("gastinbjudningar", id)).redigera).toBe(false);
  });

  it("en vanlig medlem, en annan grupps ägare och en okänd nekas med ej-behorig, och raden står kvar", async () => {
    const h = bygg();
    const { id } = await h.tjanst.bjud({ uid: AGARE, slag: "projekt", groupId: GRUPP, tagg: "koket", epost: "per@extern.se" });
    for (const uid of [MEDLEM, "uid-granne", "uid-okand"]) {
      await expect(h.tjanst.sattRedigera({ uid, id, pa: true }), uid).rejects.toMatchObject({ kod: "ej-behorig" });
    }
    expect((await h.grund.read("gastinbjudningar", id)).redigera).toBe(false);
  });

  it("⛔ en inbjudan till hela gruppen nekas med ogiltigt-omfang och får inget fält, och fel indata nekas", async () => {
    const h = bygg();
    const { id } = await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, epost: "anna@extern.se" });
    await expect(h.tjanst.sattRedigera({ uid: AGARE, id, pa: true })).rejects.toMatchObject({ kod: "ogiltigt-omfang" });
    expect(await h.grund.read("gastinbjudningar", id)).not.toHaveProperty("redigera");
    const p = await h.tjanst.bjud({ uid: AGARE, slag: "projekt", groupId: GRUPP, tagg: "koket", epost: "per@extern.se" });
    for (const pa of ["true", 1, null, undefined]) await expect(h.tjanst.sattRedigera({ uid: AGARE, id: p.id, pa }), String(pa)).rejects.toMatchObject({ kod: "ogiltigt-omfang" });
    await expect(h.tjanst.sattRedigera({ uid: AGARE, id: "0".repeat(64), pa: true })).rejects.toMatchObject({ kod: "finns-inte" });
    await expect(h.tjanst.sattRedigera({ uid: AGARE, id: "kort", pa: true })).rejects.toMatchObject({ kod: "finns-inte" });
  });
});

describe("lista och hamta bär redigera, bara för ett projekt", () => {
  it("medlemmens lista: en projektrad har redigera (false, sedan true) och laddaNed; en gruppinbjudan har inget redigera", async () => {
    const h = bygg();
    const p = await h.tjanst.bjud({ uid: AGARE, slag: "projekt", groupId: GRUPP, tagg: "koket", epost: "per@extern.se" });
    await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, epost: "anna@extern.se" });
    const rad = async (epost) => (await h.tjanst.lista({ uid: MEDLEM, groupId: GRUPP })).personer.find((x) => x.epost === epost).inbjudningar[0];
    expect(await rad("per@extern.se")).toMatchObject({ omfang: { slag: "projekt", tagg: "koket" }, laddaNed: false, redigera: false });
    await h.tjanst.sattRedigera({ uid: AGARE, id: p.id, pa: true });
    expect((await rad("per@extern.se")).redigera).toBe(true);
    const grupprad = await rad("anna@extern.se");
    expect(grupprad).toHaveProperty("laddaNed");
    expect(grupprad).not.toHaveProperty("redigera");
  });

  it("hamta: en projektgäst har redigera false som förval och true när det slagits på; en gruppgäst har inget redigera", async () => {
    const h = bygg();
    const av = await gast(h, { redigera: false });
    expect((await h.tjanst.hamta({ sessionsnyckel: av.sessionsnyckel })).grupp.redigera).toBe(false);
    await h.tjanst.sattRedigera({ uid: ADMIN, id: av.id, pa: true });
    expect((await h.tjanst.hamta({ sessionsnyckel: av.sessionsnyckel })).grupp.redigera).toBe(true);
    const g = await gast(h, { slag: "grupp", epost: "anna@extern.se" });
    expect((await h.tjanst.hamta({ sessionsnyckel: g.sessionsnyckel })).grupp).not.toHaveProperty("redigera");
  });

  it("⛔ hamta säger false för en gäst med redigera true när appen inte gett redigering, och de fem åtgärderna är nej", async () => {
    const h = bygg({ utanRedigering: true });
    const g = await gast(h);
    expect((await h.grund.read("gastinbjudningar", g.id)).redigera).toBe(true);
    expect((await h.tjanst.hamta({ sessionsnyckel: g.sessionsnyckel })).grupp.redigera).toBe(false);
    for (const [namn, anrop] of Object.entries(ATGARDER)) expect(await anrop(h.tjanst, g.sessionsnyckel), namn).toEqual({ ok: false, orsak: "nej" });
  });

  it("behörighetsraden säger det bara för en projektgäst med redigera", () => {
    const fn = ["chatt", "kalender", "bibliotek", "arenden"];
    const rad = "Du kan ladda upp filer, byta namn på och ta bort filer och anteckningar i projektet, och skapa ärenden.";
    expect(gastBehorighetsrader({ funktioner: fn, projekt: { tagg: "koket" }, redigera: true })).toContain(rad);
    expect(gastBehorighetsrader({ funktioner: fn, projekt: { tagg: "koket" }, redigera: true }, "en")).toContain("You can upload files, rename and delete files and notes in the project, and create cases.");
    expect(gastBehorighetsrader({ funktioner: fn, projekt: { tagg: "koket" }, redigera: false })).not.toContain(rad);
    expect(gastBehorighetsrader({ funktioner: fn, redigera: true }).join(" ")).not.toMatch(/ladda upp/);
    expect(gastBehorighetsrader({ funktioner: ["chatt", "arenden"], projekt: { tagg: "koket" }, redigera: true })).toContain("Du kan skapa ärenden i projektet.");
  });
});

describe("med redigera på: gästen laddar upp, byter namn, tar bort och skapar ett ärende i projektet", () => {
  it("laddaUpp och laddaUppKlar: appen får platsen och gästen ur inbjudan, filen blir en post på projektets plats och syns i gästens bibliotek", async () => {
    const h = bygg();
    const g = await gast(h);
    const steg1 = await h.tjanst.laddaUpp({ sessionsnyckel: g.sessionsnyckel, filnamn: "foto.jpg", typ: "image/jpeg", storlek: 1000 });
    expect(steg1).toEqual({ ok: true, id: "u1", url: "https://lagring.example/put/u1", huvuden: { "Content-Type": "image/jpeg" } });
    expect(h.redigering.nyFil).toHaveBeenCalledWith({ groupId: GRUPP, tagg: "koket", plats: KOK, gastId: gastId("per@extern.se"), namn: "Per", filnamn: "foto.jpg", typ: "image/jpeg", storlek: 1000, rubrik: "foto" });
    const steg2 = await h.tjanst.laddaUppKlar({ sessionsnyckel: g.sessionsnyckel, id: steg1.id });
    expect(steg2).toEqual({ ok: true, postId: "u1" });
    const b = await h.tjanst.bibliotek({ sessionsnyckel: g.sessionsnyckel });
    expect(b.poster.map((p) => p.id)).toContain("u1");
    expect(b.poster.find((p) => p.id === "u1")).toMatchObject({ rubrik: "foto", skapadAvNamn: "Per" });
  });

  it("en egen rubrik används, trimmad; en rubrik över taket nekas", async () => {
    const h = bygg();
    const g = await gast(h);
    await h.tjanst.laddaUpp({ sessionsnyckel: g.sessionsnyckel, filnamn: "a.pdf", typ: "application/pdf", storlek: 5, rubrik: "  Ritning v2  " });
    expect(h.redigering.nyFil.mock.calls[0][0].rubrik).toBe("Ritning v2");
    await expect(h.tjanst.laddaUpp({ sessionsnyckel: g.sessionsnyckel, filnamn: "a.pdf", typ: "application/pdf", storlek: 5, rubrik: "x".repeat(MAX_BIBLIOTEKRUBRIK + 1) })).rejects.toMatchObject({ kod: "ogiltig-text" });
  });

  it("bytNamnPost och taBortPost på en fil och en anteckning på projektets plats", async () => {
    const h = bygg();
    const g = await gast(h);
    expect(await h.tjanst.bytNamnPost({ sessionsnyckel: g.sessionsnyckel, postId: "p-ritning", rubrik: "  Ny ritning " })).toEqual({ ok: true });
    expect((await h.grund.read("bibliotek", "p-ritning")).rubrik).toBe("Ny ritning");
    expect(h.redigering.bytNamn.mock.calls[0][0]).toMatchObject({ groupId: GRUPP, tagg: "koket", plats: KOK, rubrik: "Ny ritning", gastId: gastId("per@extern.se"), namn: "Per", post: { id: "p-ritning" } });
    expect(await h.tjanst.bytNamnPost({ sessionsnyckel: g.sessionsnyckel, postId: "p-not", rubrik: "Måtten" })).toEqual({ ok: true });
    expect(await h.tjanst.taBortPost({ sessionsnyckel: g.sessionsnyckel, postId: "p-not" })).toEqual({ ok: true });
    expect(await h.grund.read("bibliotek", "p-not")).toBeNull();
    expect(await h.tjanst.taBortPost({ sessionsnyckel: g.sessionsnyckel, postId: "p-ritning" })).toEqual({ ok: true });
    expect((await h.tjanst.bibliotek({ sessionsnyckel: g.sessionsnyckel })).poster.map((p) => p.id).sort()).toEqual(["p-lank", "p-lista"]);
  });

  it("skapaArende: ärendet får projektets tagg av appen, byggs som i listan och syns i arenden; gästens namn är Gäst när inget finns", async () => {
    const h = bygg();
    const g = await gast(h, { namn: "" });
    const svar = await h.tjanst.skapaArende({ sessionsnyckel: g.sessionsnyckel, rubrik: "  Luckorna är fel ", text: " Två är för smala " });
    expect(svar.ok).toBe(true);
    expect(Object.keys(svar).sort()).toEqual(["arende", "ok"]);
    expect(svar.arende).toMatchObject({ rubrik: "Luckorna är fel", text: "Två är för smala", status: "ny", kommentarer: [], hosDig: false });
    expect(h.redigering.skapaArende).toHaveBeenCalledWith({ groupId: GRUPP, tagg: "koket", gastId: gastId("per@extern.se"), namn: "Gäst", rubrik: "Luckorna är fel", text: "Två är för smala" });
    const lista = await h.tjanst.arenden({ sessionsnyckel: g.sessionsnyckel });
    expect(lista.poster.find((p) => p.id === svar.arende.id)).toEqual(svar.arende);
    // Utan text: en tom text, inget fel.
    expect((await h.tjanst.skapaArende({ sessionsnyckel: g.sessionsnyckel, rubrik: "Bara rubrik" })).arende.text).toBe("");
  });
});

describe("⛔ det som inte får gå", () => {
  it("med redigera av: alla fem är nej, och appen anropas aldrig", async () => {
    expect(Object.keys(ATGARDER).length).toBeGreaterThanOrEqual(5);
    const h = bygg();
    const g = await gast(h, { redigera: false });
    for (const [namn, anrop] of Object.entries(ATGARDER)) expect(await anrop(h.tjanst, g.sessionsnyckel), namn).toEqual({ ok: false, orsak: "nej" });
    expect(appenAnropad(h)).toBe(0);
    expect((await h.grund.read("bibliotek", "p-ritning")).rubrik).toBe("P-RITNING");
  });

  it("en gäst i hela gruppen är nej i alla fem, också med ett redigera inskrivet direkt på raden", async () => {
    const h = bygg();
    const g = await gast(h, { slag: "grupp", epost: "anna@extern.se" });
    await h.grund.update("gastinbjudningar", g.id, { redigera: true });
    for (const [namn, anrop] of Object.entries(ATGARDER)) expect(await anrop(h.tjanst, g.sessionsnyckel), namn).toEqual({ ok: false, orsak: "nej" });
    // Positiv kontroll: samma anrop på gruppens fil säger fortfarande nej, och gruppens bibliotek är orört.
    expect(await h.tjanst.taBortPost({ sessionsnyckel: g.sessionsnyckel, postId: "p-grupp" })).toEqual({ ok: false, orsak: "nej" });
    expect(await h.grund.read("bibliotek", "p-grupp")).not.toBeNull();
    expect(appenAnropad(h)).toBe(0);
  });

  it("en post utanför projektets plats, en länk, en lista eller en som inte finns är saknas, och appen anropas inte", async () => {
    expect(UTANFOR.length).toBeGreaterThanOrEqual(4);
    const h = bygg();
    const g = await gast(h);
    for (const postId of [...UTANFOR, "../p-grupp", "", 7]) {
      expect(await h.tjanst.bytNamnPost({ sessionsnyckel: g.sessionsnyckel, postId, rubrik: "Kapat" }), `byt ${postId}`).toEqual({ ok: false, orsak: "saknas" });
      expect(await h.tjanst.taBortPost({ sessionsnyckel: g.sessionsnyckel, postId }), `ta bort ${postId}`).toEqual({ ok: false, orsak: "saknas" });
    }
    expect(appenAnropad(h)).toBe(0);
    for (const id of ["p-grupp", "p-badrum", "p-grannen", "p-lank", "p-lista"]) expect(await h.grund.read("bibliotek", id), id).not.toBeNull();
  });

  it("en återkallad gäst är aterkallad i alla fem, och en gäst vars redigera slagits av är nej vid nästa anrop", async () => {
    const h = bygg();
    const g = await gast(h);
    expect((await ATGARDER.bytNamnPost(h.tjanst, g.sessionsnyckel)).ok).toBe(true);
    await h.tjanst.sattRedigera({ uid: ADMIN, id: g.id, pa: false });
    for (const [namn, anrop] of Object.entries(ATGARDER)) expect(await anrop(h.tjanst, g.sessionsnyckel), namn).toEqual({ ok: false, orsak: "nej" });
    await h.tjanst.sattRedigera({ uid: ADMIN, id: g.id, pa: true });
    await h.tjanst.aterkalla({ uid: ADMIN, id: g.id });
    for (const [namn, anrop] of Object.entries(ATGARDER)) expect(await anrop(h.tjanst, g.sessionsnyckel), namn).toEqual({ ok: false, orsak: "aterkallad" });
  });

  it("platsen, taggen, gruppen och vem som skriver kommer ur inbjudan: ett anrop som skickar dem kastar, och appen anropas inte", async () => {
    const h = bygg();
    const g = await gast(h);
    for (const extra of [{ plats: `plats~${GRUPP}~badrum` }, { tagg: "badrum" }, { groupId: GRANNEN }, { gastId: "g_x" }, { namn: "Ägaren" }]) {
      for (const [namn, anrop] of Object.entries(ATGARDER)) {
        await expect(anrop(h.tjanst, g.sessionsnyckel, extra), `${namn} ${JSON.stringify(extra)}`).rejects.toMatchObject({ kod: "ogiltigt-omfang" });
      }
    }
    expect(appenAnropad(h)).toBe(0);
  });

  it("ett projekt som tagits bort är saknas i alla fem", async () => {
    const h = bygg();
    const g = await gast(h);
    await h.grund.update("gastinbjudningar", g.id, { omfang: { slag: "projekt", tagg: "borta" } });
    for (const [namn, anrop] of Object.entries(ATGARDER)) expect(await anrop(h.tjanst, g.sessionsnyckel), namn).toEqual({ ok: false, orsak: "saknas" });
  });

  it("filen prövas med bibliotekets regel före appen och räknaren: fel sort, tom, för stor, ett snedstreck i namnet", async () => {
    const h = bygg();
    const g = await gast(h);
    for (const [filnamn, typ, storlek] of [["virus.exe", "application/x-msdownload", 10], ["tom.pdf", "application/pdf", 0], ["stor.pdf", "application/pdf", 26 * 1024 * 1024], ["a/b.pdf", "application/pdf", 10], ["", "application/pdf", 10], ["a.pdf", "application/pdf", "10"]]) {
      await expect(h.tjanst.laddaUpp({ sessionsnyckel: g.sessionsnyckel, filnamn, typ, storlek }), filnamn).rejects.toMatchObject({ kod: "ogiltig-fil" });
    }
    expect(appenAnropad(h)).toBe(0);
    // Ingen uppladdning har räknats: den enda räknaren som står över noll är anropens (`gastanrop`).
    expect((await h.grund.list("gastraknare")).filter((r) => r.antal > 0)).toHaveLength(1);
  });

  it("rubriker och texter: tom eller för lång nekas med ogiltig-text, före takten", async () => {
    const h = bygg();
    const g = await gast(h);
    for (const rubrik of ["", "   ", undefined, 5, "x".repeat(MAX_BIBLIOTEKRUBRIK + 1)]) {
      await expect(h.tjanst.bytNamnPost({ sessionsnyckel: g.sessionsnyckel, postId: "p-ritning", rubrik }), String(rubrik)).rejects.toMatchObject({ kod: "ogiltig-text" });
    }
    for (const b of [{ rubrik: "" }, { rubrik: "x".repeat(GASTSKRIV_MAX_TECKEN + 1) }, { rubrik: "Ok", text: "x".repeat(GASTSKRIV_MAX_TECKEN + 1) }, { rubrik: "Ok", text: 7 }]) {
      await expect(h.tjanst.skapaArende({ sessionsnyckel: g.sessionsnyckel, ...b }), JSON.stringify(b).slice(0, 40)).rejects.toMatchObject({ kod: "ogiltig-text" });
    }
    expect(appenAnropad(h)).toBe(0);
    // Takten är orörd: tio skrivningar går fortfarande.
    for (let n = 0; n < GASTSKRIV_PER_MINUT; n++) expect((await h.tjanst.bytNamnPost({ sessionsnyckel: g.sessionsnyckel, postId: "p-ritning", rubrik: `R${n}` })).ok, `skrivning ${n}`).toBe(true);
  });

  it("ett ärende som appen skrev utanför projektet visas inte: svaret är nej", async () => {
    const h = bygg();
    const g = await gast(h);
    h.lage.utanfor = true;
    expect(await ATGARDER.skapaArende(h.tjanst, g.sessionsnyckel)).toEqual({ ok: false, orsak: "nej" });
  });

  it("ett svar från appen utan form kastar och ger tillbaka uppladdningen; filKlar som pekar utanför platsen kastar", async () => {
    const h = bygg();
    const g = await gast(h);
    h.lage.felSvar = true;
    await expect(ATGARDER.laddaUpp(h.tjanst, g.sessionsnyckel)).rejects.toThrow(/nyFil/);
    h.lage.felSvar = false;
    h.lage.felPlats = true;
    await ATGARDER.laddaUpp(h.tjanst, g.sessionsnyckel);
    await expect(h.tjanst.laddaUppKlar({ sessionsnyckel: g.sessionsnyckel, id: "u1" })).rejects.toThrow(/projektets plats/);
    // En reservation med fel form når aldrig appen.
    expect(await h.tjanst.laddaUppKlar({ sessionsnyckel: g.sessionsnyckel, id: "u/1" })).toEqual({ ok: false, orsak: "saknas" });
  });
});

describe("takterna", () => {
  it(`högst ${GASTUPPLADDNING_PER_DYGN} uppladdningar per inbjudan och dygn; en som appen nekar kostar ingen`, async () => {
    const h = bygg();
    const g = await gast(h);
    h.lage.vagra = true;
    for (let n = 0; n < 3; n++) await expect(ATGARDER.laddaUpp(h.tjanst, g.sessionsnyckel)).rejects.toMatchObject({ kod: "for-stor" });
    h.lage.vagra = false;
    for (let n = 0; n < GASTUPPLADDNING_PER_DYGN; n++) expect((await ATGARDER.laddaUpp(h.tjanst, g.sessionsnyckel)).ok, `uppladdning ${n}`).toBe(true);
    expect(await ATGARDER.laddaUpp(h.tjanst, g.sessionsnyckel)).toEqual({ ok: false, orsak: "for-manga" });
    expect(h.redigering.nyFil).toHaveBeenCalledTimes(3 + GASTUPPLADDNING_PER_DYGN);
    // Uppladdningarna delar inte skrivtakten: ett namnbyte går fortfarande.
    expect((await ATGARDER.bytNamnPost(h.tjanst, g.sessionsnyckel)).ok).toBe(true);
  });

  it(`namnbyten, borttagningar, nya ärenden och chatten delar en skrivtakt: ${GASTSKRIV_PER_MINUT} i minuten`, async () => {
    const h = bygg();
    const g = await gast(h);
    await h.tjanst.skrivChatt({ sessionsnyckel: g.sessionsnyckel, text: "Hej" });
    for (let n = 0; n < GASTSKRIV_PER_MINUT - 3; n++) expect((await h.tjanst.bytNamnPost({ sessionsnyckel: g.sessionsnyckel, postId: "p-ritning", rubrik: `R${n}` })).ok, `namn ${n}`).toBe(true);
    expect((await ATGARDER.skapaArende(h.tjanst, g.sessionsnyckel)).ok).toBe(true);
    expect((await ATGARDER.taBortPost(h.tjanst, g.sessionsnyckel)).ok).toBe(true);
    expect(await ATGARDER.skapaArende(h.tjanst, g.sessionsnyckel)).toEqual({ ok: false, orsak: "for-manga" });
    expect(await ATGARDER.bytNamnPost(h.tjanst, g.sessionsnyckel)).toEqual({ ok: false, orsak: "for-manga" });
  });
});

describe("radering: det gästen laddat upp hör till projektet", () => {
  it("filen och ärendet gästen lade in ligger kvar, och uppladdningsräknaren tas bort", async () => {
    const h = bygg();
    const g = await gast(h);
    const steg1 = await ATGARDER.laddaUpp(h.tjanst, g.sessionsnyckel);
    await h.tjanst.laddaUppKlar({ sessionsnyckel: g.sessionsnyckel, id: steg1.id });
    const { arende } = await ATGARDER.skapaArende(h.tjanst, g.sessionsnyckel);
    // Golv: anropen, skrivningen och uppladdningen har var sin räknare över noll.
    expect((await h.grund.list("gastraknare")).filter((r) => r.antal > 0).length).toBeGreaterThanOrEqual(3);
    await h.tjanst.radera({ uid: AGARE, groupId: GRUPP, gastId: gastId("per@extern.se") });
    expect(await h.grund.read("bibliotek", steg1.id)).not.toBeNull();
    expect(await h.grund.read("arenden", arende.id)).not.toBeNull();
    expect(await h.grund.list("gastinbjudningar")).toHaveLength(0);
    // Ingen räknare som hör till gästen står kvar. De som får stå kvar (per IP) har inget räknat.
    expect((await h.grund.list("gastraknare")).filter((r) => r.antal > 0)).toEqual([]);
  });
});

describe("appens konfiguration", () => {
  const konfig = (projekt) => ({
    kalla: createMemorySource(seed()),
    samlingar: { inbjudningar: "gastinbjudningar", sessioner: "gastsessioner", platser: "gastplatser", raknare: "gastraknare", handelser: "handelser" },
    farBjuda: () => true,
    skicka: async () => {},
    grupp: {
      samlingar: { grupper: "groups", samtal: "samtal", meddelanden: "meddelanden", bibliotek: "bibliotek", svar: "svar" },
      lagring: { signeradAdress: async () => "https://x" },
      handelseSida: (h) => ({ titel: h.rubrik }),
      projekt,
      arenden: { samling: "arenden", falt: ["rubrik"], bygg: () => ({}), kommentarer: async () => [], kommentera: async () => ({ id: "k" }), markeraKlart: async () => ({ ok: true }), radera: async () => 0 },
    },
    radering: {},
  });
  const alla = { nyFil: () => ({}), filKlar: () => ({}), bytNamn: () => {}, taBort: () => {}, skapaArende: () => ({}) };

  it("alla fem funktioner krävs tillsammans; en som saknas eller inte är en funktion kastar med namnet", () => {
    expect(() => createGastService(konfig({ urval: () => null, redigering: alla }))).not.toThrow();
    expect(() => createGastService(konfig({ urval: () => null }))).not.toThrow();
    for (const f of Object.keys(alla)) {
      const utan = { ...alla };
      delete utan[f];
      expect(() => createGastService(konfig({ urval: () => null, redigering: utan })), f).toThrow(new RegExp(`redigering\\.${f} krävs`));
      expect(() => createGastService(konfig({ urval: () => null, redigering: { ...alla, [f]: "inte en funktion" } })), f).toThrow(new RegExp(`redigering\\.${f} krävs`));
    }
    for (const fel of [null, "ja", 1]) expect(() => createGastService(konfig({ urval: () => null, redigering: fel })), String(fel)).toThrow(/redigering är/);
  });

  it("redigering kräver grupp.arenden: ett nytt ärende byggs genom dem", () => {
    const k = konfig({ urval: () => null, redigering: alla });
    delete k.grupp.arenden;
    expect(() => createGastService(k)).toThrow(/kräver grupp\.arenden/);
  });
});
