import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import {
  GASTANROP_PER_MINUT,
  GASTARENDE_MAX,
  GASTARENDE_SKANNA_MAX,
  GASTARENDEFALT,
  GASTARENDEKOMMENTARER_MAX,
  GASTARENDEKOMMENTARFALT,
  GASTBIBLIOTEK_MAX,
  GASTCHATT_SIDA,
  GASTFIL_PER_DYGN,
  GASTGRUPPATGARDER,
  GASTGRUPPFUNKTIONER,
  GASTNAMNLOS,
  GASTSKRIV_MAX_TECKEN,
  GASTSKRIV_PER_MINUT,
  arGastId,
  GASTGRUPPSVARSFALT,
  GASTSESSIONSDAGAR,
  GAST_PLATSER_GRATIS,
  byggGastMottagare,
  gastDelegerad,
  gastId,
  gastplatsId,
  tolkaGastMottagare,
} from "../lib/gast.js";
import { SIGNERAD_SEKUNDER } from "../lib/delning.js";
import { medlemskapsId } from "../lib/grupp.js";
import { createGastService, gastInbjudningsId } from "../node/gast.js";

/**
 * Gästerna, skiva 2 (0.132.0, cllp/lifehub.app#389): hela gruppen. Tjänsten bakom gästens chatt, kalender, ärenden och bibliotek, och raderingen.
 *
 * ⛔ UTAN NÄTVERK OCH UTAN FIREBASE: minneskällan räcker, och appens delar (händelsens fält, ärendenas form, omröstningen, lagringen) är små stand-ins som provet äger.
 * ⛔ VARJE PROV HAR BEVISATS I BÅDA RIKTNINGARNA (arbetsreglerna, punkt 4): rött med koden muterad, grönt med den. Utfallen står i PR-texten.
 */

const NU = 1_800_000_000_000;
const MINUT = 60 * 1000;
const DYGN = 24 * 60 * 60 * 1000;
const GRUPP = "kallan";
const GRANNEN = "grannen";
const AGARE = "uid-agare-x91";
const ADMIN = "uid-admin-x93";
const MEDLEM = "uid-medlem-x92";
const SLUTAD = "uid-slutad-x94";
const AGENT = "uid-agent-x95";
const UTANFOR = "uid-utanfor-x96";
const FRAMLING = "uid-framling-x97";

const ANNA = gastId("anna@foretag.se");
const BO = gastId("bo@foretag.se");

const sha = (/** @type {string} */ t) => createHash("sha256").update(t).digest("hex");
const medlemskap = (uid, groupId, roll, namn, extra = {}) => ({ id: medlemskapsId(uid, groupId), userId: uid, groupId, roll, typ: "person", status: "aktiv", namn, epost: `${namn.split(" ")[0].toLowerCase()}.hemlig@privat.example`, ...extra });

/** Det som ska hända med en medlems adress, uid och andras innehåll: ingenting av det får lämna servern. Minst tolv, och en positiv kontroll för vad som SKA synas. */
const HEMLIGHETER = [
  "agda.hemlig@privat.example",
  "maja.hemlig@privat.example",
  "uid-agare-x91",
  "uid-medlem-x92",
  "uid-admin-x93",
  "uid-slutad-x94",
  "uid-agent-x95",
  "HEMLIGT-GITHUB-REPO",
  "andra-gasten@foretag.se",
  "PRIVAT-SAMTALSTEXT",
  "AGENT-SAMTALSTEXT",
  "GRANNENS-HEMLIGHET",
  "EKONOMI-BELOPP-4711",
  "PERSONLIG-KALENDERPOST",
  "HANDELSEFIL-HEMLIG",
  "MITT-BIBLIOTEK-HEMLIG",
  "AGENTENS-SVAR-I-GRUPPCHATTEN",
  "grupper/kallan/bibliotek",
  "HEMLIGT-APPFALT",
  "anna@foretag.se",
  "GRUPPENS-ARENDE",
  "PRIVAT-ARENDE-AGDA",
  "BOS-ARENDE",
  "BOS-KOMMENTAR",
  "ARENDE-UTAN-ANSVARIG",
];

function seed() {
  /** @type {Record<string, any[]>} */
  const d = {
    memberships: [
      medlemskap(AGARE, GRUPP, "agare", "Agda Ägare"),
      medlemskap(ADMIN, GRUPP, "admin", "Adam Admin"),
      medlemskap(MEDLEM, GRUPP, "medlem", "Maja Medlem"),
      medlemskap(SLUTAD, GRUPP, "medlem", "Gunnar Gammal", { status: "avslutad" }),
      medlemskap(AGENT, GRUPP, "admin", "Agent", { typ: "agent" }),
      medlemskap(UTANFOR, GRANNEN, "agare", "Ulla Utanför"),
      medlemskap(FRAMLING, GRUPP, "agare", "Fredrik Främling", { status: "avslutad" }),
    ],
    groups: [{ id: GRUPP, namn: "Källan", hemligt: "HEMLIGT-APPFALT" }, { id: GRANNEN, namn: "Grannen" }],
    handelser: [
      { id: "h-mote", groupId: GRUPP, rubrik: "Möte", text: "Vi ses i salen", plats: "Salen", datum: "2026-11-02", tid: "18:00", slutTid: "20:00", kravSvar: true, skapadAv: { uid: AGARE, epost: "agda.hemlig@privat.example" }, intern: "HEMLIGT-APPFALT" },
      { id: "h-fri", groupId: GRUPP, rubrik: "Repetition", datum: "2026-11-09", heldag: true },
      { id: "h-ejsatt", groupId: GRUPP, rubrik: "Fika", text: "Vilken dag passar?", kravSvar: true, skapadAv: { uid: AGARE } },
      { id: "h-arkiv", groupId: GRUPP, rubrik: "Gammal", datum: "2026-01-01", arkiverad: true },
      { id: "h-trasig", groupId: GRUPP, rubrik: "Trasig", datum: "inte-ett-datum" },
      { id: "h-grannen", groupId: GRANNEN, rubrik: "GRANNENS-HEMLIGHET", datum: "2026-11-03", kravSvar: true },
    ],
    "handelser/h-mote/svar": [{ id: MEDLEM, svar: "kommer" }, { id: AGARE, svar: "kommerInte" }],
    "handelser/h-ejsatt/svar": [],
    [`samtal/${GRUPP}|grupp/meddelanden`]: [
      { id: "m1", text: "Välkommen till gruppen", av: AGARE, tid: 1000 },
      { id: "m2", text: "Tack Agda", av: MEDLEM, tid: 2000, namner: [AGARE, "alla"] },
      { id: "m3", text: "AGENTENS-SVAR-I-GRUPPCHATTEN", av: AGENT, tid: 3000 },
      { id: "m4", text: "Jag citerar", av: ADMIN, tid: 4000, svarPa: "m1" },
      { id: "m5", text: "Från en som lämnat", av: "uid-okand-x98", tid: 5000 },
      { id: "m6", text: "Se bilden", av: SLUTAD, tid: 6000, bilaga: { namn: "bild.png", typ: "image/png", dataUrl: "data:HEMLIG" } },
    ],
    [`samtal/${GRUPP}|${ADMIN}|${MEDLEM}/meddelanden`]: [{ id: "p1", text: "PRIVAT-SAMTALSTEXT", av: ADMIN, tid: 1500 }],
    [`samtal/${GRUPP}|${AGARE}|${AGENT}/meddelanden`]: [{ id: "a1", text: "AGENT-SAMTALSTEXT", av: AGARE, tid: 1600 }],
    [`samtal/${GRANNEN}|grupp/meddelanden`]: [{ id: "g1", text: "GRANNENS-HEMLIGHET", av: UTANFOR, tid: 1700 }],
    utgifter: [{ id: "u1", groupId: GRUPP, belopp: "EKONOMI-BELOPP-4711" }],
    [`users/${AGARE}/kalenderposter`]: [{ id: "k1", titel: "PERSONLIG-KALENDERPOST" }],
    // (Skiva 3) Appens ärenden: en platt samling med groupId, en `mottagare` och en GitHub-adress som aldrig får lämna servern.
    arenden: [
      { id: "a-anna", groupId: GRUPP, rubrik: "Bygg scenen", text: "Skruvar saknas", status: "ny", forfallodag: "2026-11-20", skapad: "2026-10-12", url: "https://github.com/HEMLIGT-GITHUB-REPO/x/issues/1", sort: "uppgift", skapadAv: { uid: AGARE, epost: "agda.hemlig@privat.example" }, mottagare: { slag: "gast", gastId: ANNA, namn: "Anna" } },
      { id: "a-anna2", groupId: GRUPP, rubrik: "Städa efter", text: "Kvasta", status: "ny", skapad: "2026-10-10", sort: "uppgift", mottagare: { slag: "gast", gastId: ANNA, namn: "Anna" } },
      { id: "a-anna-klar", groupId: GRUPP, rubrik: "Gammalt jobb", text: "Klart", status: "hanterad", skapad: "2026-09-01", sort: "uppgift", mottagare: { slag: "gast", gastId: ANNA, namn: "Anna" } },
      { id: "a-bo", groupId: GRUPP, rubrik: "BOS-ARENDE", text: "x", status: "ny", skapad: "2026-10-11", sort: "uppgift", mottagare: { slag: "gast", gastId: BO, namn: "Bo" } },
      { id: "a-person", groupId: GRUPP, rubrik: "PRIVAT-ARENDE-AGDA", text: "EKONOMI-BELOPP-4711", status: "ny", skapad: "2026-10-09", sort: "kvitto", mottagare: { slag: "person", uid: AGARE } },
      { id: "a-grupp", groupId: GRUPP, rubrik: "GRUPPENS-ARENDE", text: "x", status: "ny", skapad: "2026-10-08", sort: "uppgift", mottagare: { slag: "grupp" } },
      { id: "a-ingen", groupId: GRUPP, rubrik: "ARENDE-UTAN-ANSVARIG", text: "x", status: "ny", skapad: "2026-10-07", sort: "uppgift" },
    ],
    "arenden/a-anna/kommentarer": [
      { id: "c1", text: "Jag tar den", skapad: 1000, skapadAv: { uid: AGARE, namn: "Agda Ägare", typ: "manniska" } },
      { id: "c2", text: "Tack Agda", skapad: 2000, skapadAv: { uid: MEDLEM, namn: "Maja Medlem", typ: "manniska" } },
    ],
    "arenden/a-bo/kommentarer": [{ id: "c9", text: "BOS-KOMMENTAR", skapad: 1, skapadAv: { uid: MEDLEM, namn: "Maja Medlem", typ: "manniska" } }],
    bibliotek: [
      { id: "p-pdf", groupId: GRUPP, typ: "fil", rubrik: "Låtlista", fil: { sokvag: "grupper/kallan/bibliotek/p-pdf/lat.pdf", namn: "lat.pdf", mime: "application/pdf", byte: 1200, klar: true }, skapadAv: { uid: MEDLEM, namn: "Maja Medlem", epost: "maja.hemlig@privat.example" }, skapad: 5000, andrad: 5000 },
      { id: "p-doc", groupId: GRUPP, typ: "fil", rubrik: "Kontrakt", fil: { sokvag: "grupper/kallan/bibliotek/p-doc/avtal.docx", namn: "avtal är åäö.docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", byte: 30, klar: true }, skapadAv: { uid: AGARE, namn: "Agda Ägare" }, skapad: 4000, andrad: 4000 },
      { id: "p-ljud", groupId: GRUPP, typ: "fil", rubrik: "Demo", fil: { sokvag: "grupper/kallan/bibliotek/p-ljud/demo.mp3", namn: "demo.mp3", mime: "audio/mpeg", byte: 3000, klar: true }, durationMs: 61000, peaks: "abc", skapadAv: { uid: AGARE, namn: "Agda Ägare" }, skapad: 3500, andrad: 3500 },
      { id: "p-not", groupId: GRUPP, typ: "anteckning", rubrik: "Anteckning", text: "Kom ihåg tejp", taggar: ["scen"], skapadAv: { uid: AGARE, namn: "Agda Ägare" }, skapad: 3000, andrad: 3000 },
      { id: "p-lank", groupId: GRUPP, typ: "lank", rubrik: "Spellista", url: "https://open.spotify.com/track/abc", kalla: "spotify", skapadAv: { uid: AGARE, namn: "Agda Ägare" }, skapad: 2900, andrad: 2900 },
      { id: "p-hand", groupId: `handelse~${GRUPP}~h-mote`, typ: "fil", rubrik: "HANDELSEFIL-HEMLIG", fil: { sokvag: "grupper/handelse~kallan~h-mote/bibliotek/p-hand/x.pdf", namn: "x.pdf", mime: "application/pdf", byte: 1, klar: true }, skapadAv: { uid: AGARE, namn: "Agda" }, skapad: 1, andrad: 1 },
      { id: "p-mitt", groupId: `mitt~${AGARE}`, typ: "anteckning", rubrik: "MITT-BIBLIOTEK-HEMLIG", text: "x", skapadAv: { uid: AGARE, namn: "Agda" }, skapad: 1, andrad: 1 },
      { id: "p-grannen", groupId: GRANNEN, typ: "fil", rubrik: "GRANNENS-HEMLIGHET", fil: { sokvag: "grupper/grannen/bibliotek/p-grannen/y.pdf", namn: "y.pdf", mime: "application/pdf", byte: 1, klar: true }, skapadAv: { uid: UTANFOR, namn: "Ulla" }, skapad: 1, andrad: 1 },
      // En medlem som skrivit en post i Källan som pekar på Grannens fil: sökvägen hör inte till postens grupp och signeras aldrig.
      { id: "p-pek", groupId: GRUPP, typ: "fil", rubrik: "Pekar fel", fil: { sokvag: "grupper/grannen/bibliotek/p-grannen/y.pdf", namn: "y.pdf", mime: "application/pdf", byte: 1, klar: true }, skapadAv: { uid: MEDLEM, namn: "Maja" }, skapad: 10, andrad: 10 },
      { id: "p-dot", groupId: GRUPP, typ: "fil", rubrik: "Punkter", fil: { sokvag: "grupper/kallan/bibliotek/../p-dot/x.pdf", namn: "x.pdf", mime: "application/pdf", byte: 1, klar: true }, skapadAv: { uid: MEDLEM, namn: "Maja" }, skapad: 9, andrad: 9 },
      { id: "p-ejklar", groupId: GRUPP, typ: "fil", rubrik: "Laddas upp", fil: { sokvag: "grupper/kallan/bibliotek/p-ejklar/z.pdf", namn: "z.pdf", mime: "application/pdf", byte: 1, klar: false }, skapadAv: { uid: MEDLEM, namn: "Maja" }, skapad: 8, andrad: 8 },
      { id: "p-andraid", groupId: GRUPP, typ: "fil", rubrik: "Fel post i sökvägen", fil: { sokvag: "grupper/kallan/bibliotek/en-annan-post/z.pdf", namn: "z.pdf", mime: "application/pdf", byte: 1, klar: true }, skapadAv: { uid: MEDLEM, namn: "Maja" }, skapad: 7, andrad: 7 },
    ],
    gastinbjudningar: [],
    gastsessioner: [],
    gastplatser: [],
    gastraknare: [],
    datumroster: [],
    mejlko: [],
  };
  return d;
}

/** Alla samlingar provet rör, så att "inga spår" kan söka igenom hela lagret. */
const SAMLINGAR_ATT_SOKA = [`samtal/${GRUPP}|grupp/meddelanden`, "gastinbjudningar", "gastsessioner", "gastplatser", "gastraknare", "datumroster", "mejlko", "handelser/h-mote/svar", "handelser/h-ejsatt/svar", "handelser/h-fri/svar", "handelser/h-arkiv/svar", "handelser/h-trasig/svar", "handelser/h-grannen/svar", "arenden", "arenden/a-anna/kommentarer", "arenden/a-anna2/kommentarer", "arenden/a-bo/kommentarer"];

/**
 * @param {object} [val]
 * @param {(k: any) => any} [val.omslut]
 * @param {boolean} [val.utanGrupp]
 * @param {boolean} [val.utanArenden] Appen har ingen ärendedelegering till gäster (skiva 3 av).
 * @param {Record<string, any[]>} [val.extra]
 */
function bygg({ omslut = (k) => k, utanGrupp = false, utanArenden = false, arendeFalt = null, extra = {}, signeringsfel = null, kommenteraFel = null } = {}) {
  const grund = createMemorySource({ ...seed(), ...extra });
  const kalla = omslut(grund);
  let nu = NU;
  /** @type {any[]} */
  const brev = [];
  const signera = vi.fn(async ({ sokvag, sekunder, disposition, mime }) => {
    if (signeringsfel) throw signeringsfel;
    return `https://lagring.example/signerat/${sha(sokvag).slice(0, 16)}?s=${sekunder}&d=${encodeURIComponent(disposition)}&m=${encodeURIComponent(mime)}`;
  });
  const rostlogg = /** @type {any[]} */ ([]);
  const roster = vi.fn(async ({ gastId: g, groupId }) => {
    for (const r of await grund.list("datumroster", { where: { groupId } })) if (r.gastId === g) await grund.remove("datumroster", r.id);
  });
  const spar = vi.fn(async ({ epost }) => {
    for (const r of await grund.list("mejlko")) if (r.till === epost) await grund.remove("mejlko", r.id);
  });
  /** Appens ärendemodell, som ett stand-in: kommentarer i en undersamling, klart via updateIf på status, och radering som tar bort gästens spår. */
  const arendelogg = /** @type {any[]} */ ([]);
  const arenden = {
    samling: "arenden",
    falt: ["rubrik", "text", "status", "forfallodag"],
    // Appens bygge sprider medvetet ut MER än falt (GitHub-adressen, uid, ett internt fält): ramverket ska ta bort det.
    bygg: ({ rad }) => ({ rubrik: rad.rubrik, text: rad.text, status: rad.status, forfallodag: rad.forfallodag, url: rad.url, skapadAv: rad.skapadAv, hemlig: "HEMLIGT-APPFALT" }),
    kommentarer: async ({ rad }) => (await grund.list(`arenden/${rad.id}/kommentarer`)).map((k) => ({ id: k.id, text: k.text, tid: k.skapad, namn: k.skapadAv?.namn ?? "", ...(k.gastId ? { gastId: k.gastId } : {}) })),
    kommentera: async ({ rad, groupId, gastId: g, namn, text }) => {
      arendelogg.push({ typ: "kommentera", id: rad.id, g, namn, text });
      if (kommenteraFel) throw kommenteraFel;
      return grund.create(`arenden/${rad.id}/kommentarer`, { text, skapad: nu, skapadAv: { uid: null, namn, typ: "gast" }, gastId: g, groupId });
    },
    markeraKlart: async ({ rad, gastId: g, namn }) => {
      arendelogg.push({ typ: "klar", id: rad.id, g, namn });
      const r = await grund.updateIf("arenden", rad.id, { status: "ny" }, { status: "hanterad", resultat: { url: null, not: `Markerad klar av gästen ${namn}` }, closed: nu });
      return { ok: r.updated };
    },
    radera: async ({ gastId: g, groupId }) => {
      let rorda = 0;
      for (const rad of await grund.list("arenden", { where: { groupId } })) {
        for (const k of await grund.list(`arenden/${rad.id}/kommentarer`)) if (k.gastId === g) await grund.remove(`arenden/${rad.id}/kommentarer`, k.id);
        if (rad.mottagare?.gastId === g) {
          await grund.update("arenden", rad.id, { mottagare: null });
          rorda++;
        }
      }
      return rorda;
    },
  };
  const tjanst = createGastService({
    kalla,
    samlingar: { inbjudningar: "gastinbjudningar", sessioner: "gastsessioner", platser: "gastplatser", raknare: "gastraknare", handelser: "handelser" },
    farBjuda: ({ uid, handelse }) => handelse.skapadAv?.uid === uid,
    skicka: async (b) => {
      brev.push(b);
      // Appens mejlkö bär adressen i klartext, som verkligheten.
      await grund.create("mejlko", { till: b.till, typ: b.typ });
    },
    rapportera: vi.fn(),
    klocka: () => nu,
    ...(utanGrupp
      ? {}
      : {
          grupp: {
            samlingar: { grupper: "groups", samtal: "samtal", meddelanden: "meddelanden", bibliotek: "bibliotek", svar: "svar" },
            lagring: { signeradAdress: signera },
            handelseSida: (h) => ({ titel: h.rubrik, beskrivning: h.text, plats: h.plats }),
            ...(utanArenden ? {} : { arenden: arendeFalt ? { ...arenden, falt: arendeFalt } : arenden }),
            omrostning: {
              falt: ["forslag", "mina"],
              bygg: async ({ handelse, gastId: g }) => (handelse.id === "h-ejsatt" ? { forslag: [{ id: "f1", datum: "2026-12-01" }], mina: (await grund.list("datumroster")).filter((r) => r.gastId === g).map((r) => r.val), hemlig: "HEMLIGT-APPFALT" } : null),
              rosta: async ({ gastId: g, groupId, forslagId, val }) => {
                rostlogg.push({ g, groupId, forslagId, val });
                if (!["ja", "kanske", "nej"].includes(val)) return { ok: false };
                await grund.create("datumroster", { id: `${g}|${forslagId}`, gastId: g, groupId, forslagId, val });
                return { ok: true };
              },
            },
          },
          radering: { roster, spar },
        }),
  });
  return { grund, kalla, tjanst, brev, signera, roster, spar, rostlogg, arendelogg, arenden, tid: (/** @type {number} */ t) => { nu = t; }, nu: () => nu };
}

const IP = "203.0.113.7";

/** Bjuder in en gäst till hela gruppen, löser in länken och ger sessionsnyckeln. */
async function gruppGast(h, epost = "anna@foretag.se", { uid = AGARE, namn = "" } = {}) {
  const svar = await h.tjanst.bjud({ uid, slag: "grupp", groupId: GRUPP, epost, namn });
  const lank = h.brev[h.brev.length - 1].lankar[0];
  const inl = await h.tjanst.los({ id: lank.id, nyckel: lank.nyckel, epost, ip: IP });
  expect(inl.ok, "inlösen").toBe(true);
  return { ...svar, sessionsnyckel: inl.sessionsnyckel, lank };
}

/** Samma för en omröstningsgäst (skiva 1). */
async function sakGast(h, epost = "sak@foretag.se", handelseId = "h-ejsatt", uid = AGARE) {
  const svar = await h.tjanst.bjud({ uid, handelseId, epost });
  const lank = h.brev[h.brev.length - 1].lankar[0];
  const inl = await h.tjanst.los({ id: lank.id, nyckel: lank.nyckel, epost, ip: IP });
  expect(inl.ok).toBe(true);
  return { ...svar, sessionsnyckel: inl.sessionsnyckel, lank };
}

/** Alla åtgärder en gruppgäst har, med giltiga indata mot grunddatan. Namnet är åtgärden. */
const ATGARDER = {
  hamta: (t, k) => t.hamta({ sessionsnyckel: k }),
  chatt: (t, k) => t.chatt({ sessionsnyckel: k }),
  kalender: (t, k) => t.kalender({ sessionsnyckel: k }),
  handelse: (t, k) => t.handelse({ sessionsnyckel: k, handelseId: "h-mote" }),
  svara: (t, k) => t.svara({ sessionsnyckel: k, handelseId: "h-mote", val: "kommer" }),
  rosta: (t, k) => t.rosta({ sessionsnyckel: k, handelseId: "h-ejsatt", forslagId: "f1", val: "ja" }),
  skrivChatt: (t, k) => t.skrivChatt({ sessionsnyckel: k, text: "Hej från gästen" }),
  bibliotek: (t, k) => t.bibliotek({ sessionsnyckel: k }),
  fil: (t, k) => t.fil({ sessionsnyckel: k, postId: "p-pdf" }),
  arenden: (t, k) => t.arenden({ sessionsnyckel: k }),
  kommenteraArende: (t, k) => t.kommenteraArende({ sessionsnyckel: k, arendeId: "a-anna", text: "Jag fixar det" }),
  markeraArendeKlart: (t, k) => t.markeraArendeKlart({ sessionsnyckel: k, arendeId: "a-anna2" }),
};

describe("bjud till hela gruppen: vem får, och vad som skrivs", () => {
  it("ägare och admin bjuder in; en vanlig medlem, en agent, en före detta medlem, en utomstående och ingen alls får det inte", async () => {
    const h = bygg();
    for (const [uid, epost] of [[AGARE, "a@foretag.se"], [ADMIN, "b@foretag.se"]]) {
      await expect(h.tjanst.bjud({ uid, slag: "grupp", groupId: GRUPP, epost }), uid).resolves.toMatchObject({ ny: true });
    }
    for (const uid of [MEDLEM, AGENT, SLUTAD, FRAMLING, UTANFOR, "uid-okand"]) {
      await expect(h.tjanst.bjud({ uid, slag: "grupp", groupId: GRUPP, epost: "c@foretag.se" }), uid).rejects.toMatchObject({ kod: "ej-behorig" });
    }
    // Skaparen av en omröstning får inte mer för att hen skapat den: hela gruppen är mer än en omröstning.
    await expect(h.tjanst.bjud({ uid: MEDLEM, slag: "grupp", groupId: GRUPP, epost: "c@foretag.se" })).rejects.toMatchObject({ kod: "ej-behorig" });
    expect(await h.grund.list("gastinbjudningar")).toHaveLength(2);
  });

  it("inbjudan bär omfånget { slag: grupp } och inget annat, id:t är hashen av (grupp, adress, grupp), och brevet bär omfånget", async () => {
    const h = bygg();
    const { id } = await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, epost: "Anna@Foretag.se", namn: "Anna" });
    const [rad] = await h.grund.list("gastinbjudningar");
    expect(rad.omfang).toEqual({ slag: "grupp" });
    expect(rad.id).toBe(id);
    expect(id).toBe(sha(JSON.stringify([GRUPP, "anna@foretag.se", "grupp"])));
    expect(id).toBe(gastInbjudningsId({ groupId: GRUPP, epost: "anna@foretag.se", omfang: { slag: "grupp" } }));
    expect(h.brev[0].lankar[0]).toMatchObject({ id, groupId: GRUPP, omfang: { slag: "grupp" } });
    expect(h.brev[0]).toMatchObject({ typ: "inbjudan", till: "anna@foretag.se" });
  });

  it("en gruppinbjudan med en händelse, ett okänt slag, eller utan att tjänsten fått grupp, avvisas med ogiltigt-omfang innan något skrivs", async () => {
    const h = bygg();
    await expect(h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, handelseId: "h-mote", epost: "a@foretag.se" })).rejects.toMatchObject({ kod: "ogiltigt-omfang" });
    await expect(h.tjanst.bjud({ uid: AGARE, slag: "allt", groupId: GRUPP, epost: "a@foretag.se" })).rejects.toMatchObject({ kod: "ogiltigt-omfang" });
    const utan = bygg({ utanGrupp: true });
    await expect(utan.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, epost: "a@foretag.se" })).rejects.toMatchObject({ kod: "ogiltigt-omfang" });
    for (const k of [h, utan]) {
      expect(await k.grund.list("gastinbjudningar")).toHaveLength(0);
      expect(await k.grund.list("gastplatser")).toHaveLength(0);
    }
  });

  it("gruppen läses ur anropet men prövas mot medlemskapet: en ägare i grannen kan inte bjuda in till Källan", async () => {
    const h = bygg();
    await expect(h.tjanst.bjud({ uid: UTANFOR, slag: "grupp", groupId: GRUPP, epost: "a@foretag.se" })).rejects.toMatchObject({ kod: "ej-behorig" });
    await expect(h.tjanst.bjud({ uid: UTANFOR, slag: "grupp", groupId: GRANNEN, epost: "a@foretag.se" })).resolves.toMatchObject({ ny: true });
  });

  it("tjänsten kräver radering när den får grupp: en gruppgäst som inte går att radera ska inte gå att bjuda in", () => {
    const h = bygg();
    expect(() =>
      createGastService({
        kalla: h.kalla,
        samlingar: { inbjudningar: "a", sessioner: "b", platser: "c", raknare: "d", handelser: "e" },
        farBjuda: () => true,
        skicka: async () => {},
        grupp: { samlingar: { grupper: "g", samtal: "s", meddelanden: "m", bibliotek: "bib", svar: "sv" }, lagring: { signeradAdress: async () => "" }, handelseSida: () => ({ titel: "x" }) },
      }),
    ).toThrow(/radering krävs/);
    expect(() =>
      createGastService({
        kalla: h.kalla,
        samlingar: { inbjudningar: "a", sessioner: "b", platser: "c", raknare: "d", handelser: "e" },
        farBjuda: () => true,
        skicka: async () => {},
        radering: {},
        grupp: { samlingar: { grupper: "a", samtal: "s", meddelanden: "m", bibliotek: "bib", svar: "sv" }, lagring: { signeradAdress: async () => "" }, handelseSida: () => ({ titel: "x" }) },
      }),
    ).toThrow(/eget namn/);
  });
});

describe("taket 5 delas mellan omfången, och en person tar en plats", () => {
  const platser = async (h) => (await h.grund.list("gastplatser")).sort((a, b) => a.id.localeCompare(b.id));

  it("tre omröstningsgäster och två gruppgäster fyller taket, och den sjätte nekas oavsett omfång", async () => {
    const h = bygg();
    for (let n = 0; n < 3; n++) await h.tjanst.bjud({ uid: AGARE, handelseId: "h-mote", epost: `sak${n}@foretag.se` });
    for (let n = 0; n < 2; n++) await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, epost: `grupp${n}@foretag.se` });
    expect(await platser(h)).toHaveLength(GAST_PLATSER_GRATIS);
    await expect(h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, epost: "sjatte@foretag.se" })).rejects.toMatchObject({ kod: "platser-slut" });
    await expect(h.tjanst.bjud({ uid: AGARE, handelseId: "h-mote", epost: "sjatte@foretag.se" })).rejects.toMatchObject({ kod: "platser-slut" });
    expect(await h.grund.list("gastinbjudningar")).toHaveLength(5);
  });

  it("samma person med en omröstning OCH hela gruppen är två rader men EN plats", async () => {
    const h = bygg();
    await h.tjanst.bjud({ uid: AGARE, handelseId: "h-mote", epost: "anna@foretag.se" });
    await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, epost: "anna@foretag.se" });
    expect(await h.grund.list("gastinbjudningar")).toHaveLength(2);
    expect(await platser(h)).toHaveLength(1);
  });

  it("sju parallella inbjudningar med blandade omfång och en dubblett ger exakt fem platser", async () => {
    const h = bygg();
    const jobb = [0, 1, 2, 3, 4, 5, 6].map((n) =>
      n % 2 === 0 ? h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, epost: `p${n}@foretag.se` }) : h.tjanst.bjud({ uid: AGARE, handelseId: "h-mote", epost: `p${n}@foretag.se` }),
    );
    // Dubbletten: p0 igen, men med den andra sortens omfång. Samma person: ingen ny plats.
    jobb.push(h.tjanst.bjud({ uid: AGARE, handelseId: "h-mote", epost: "p0@foretag.se" }));
    const utfall = await Promise.allSettled(jobb);
    const rader = await h.grund.list("gastinbjudningar");
    const personer = new Set(rader.map((r) => gastId(r.epost)));
    expect(personer.size).toBe(GAST_PLATSER_GRATIS);
    expect(await platser(h)).toHaveLength(GAST_PLATSER_GRATIS);
    expect(utfall.filter((u) => u.status === "rejected").length).toBe(jobb.length - rader.length);
    for (const u of utfall) if (u.status === "rejected") expect(u.reason).toMatchObject({ kod: "platser-slut" });
    // Golv: provet har bjudit in fler än taket, annars mäter det ingenting.
    expect(jobb.length).toBeGreaterThan(GAST_PLATSER_GRATIS + 1);
  });

  it("platsen släpps först när ingen inbjudan är aktiv: hela gruppen återkallad medan omröstningen lever behåller platsen", async () => {
    const h = bygg();
    const g = await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, epost: "anna@foretag.se" });
    const s = await h.tjanst.bjud({ uid: AGARE, handelseId: "h-mote", epost: "anna@foretag.se" });
    await h.tjanst.aterkalla({ uid: AGARE, id: g.id });
    expect(await platser(h)).toHaveLength(1);
    await h.tjanst.aterkalla({ uid: AGARE, id: s.id });
    expect(await platser(h)).toHaveLength(0);
  });
});

describe("funktionsmatrisen: bara en gruppsession ger gruppens funktioner, och en omröstningssession ger bara rösten", () => {
  it("tre funktioner mot fem sorters sessioner: bara gruppsessionen på sin funktion ger ja (15 fall)", async () => {
    const h = bygg();
    // Utgången först: dess session är äldre än 90 dagar när de andra skapas, så den är den enda som gått ut.
    const utgangen = await gruppGast(h, "gammal@foretag.se");
    h.tid(NU + (GASTSESSIONSDAGAR + 1) * DYGN);
    const nyaGrupp = await gruppGast(h, "ny@foretag.se");
    const sak = await sakGast(h, "sak@foretag.se");
    const atkallad = await gruppGast(h, "borta@foretag.se");
    await h.tjanst.aterkalla({ uid: AGARE, id: atkallad.id });
    let fall = 0;
    for (const funktion of GASTGRUPPFUNKTIONER) {
      const prov = (nyckel) => h.tjanst.session({ sessionsnyckel: nyckel, krav: { slag: "grupp", funktion } });
      expect(await prov(nyaGrupp.sessionsnyckel), `grupp/${funktion}`).toMatchObject({ ok: true, inbjudan: { slag: "grupp", groupId: GRUPP } });
      expect(await prov(sak.sessionsnyckel), `sak/${funktion}`).toEqual({ ok: false, orsak: "nej" });
      expect(await prov(atkallad.sessionsnyckel), `aterkallad/${funktion}`).toEqual({ ok: false, orsak: "aterkallad" });
      expect(await prov("X".repeat(43)), `okand/${funktion}`).toEqual({ ok: false, orsak: "nej" });
      expect(await prov(utgangen.sessionsnyckel), `utgangen/${funktion}`).toEqual({ ok: false, orsak: "nej" });
      fall += 5;
    }
    expect(fall).toBeGreaterThanOrEqual(15);
    // Och tvärtom: en gruppsession ger inte rösten på en sak, och en omröstningssession ger rösten.
    expect(await h.tjanst.session({ sessionsnyckel: nyaGrupp.sessionsnyckel, krav: { slag: "sak", funktion: "rosta" } })).toEqual({ ok: false, orsak: "nej" });
    expect(await h.tjanst.session({ sessionsnyckel: nyaGrupp.sessionsnyckel, krav: { funktion: "rosta" } })).toEqual({ ok: false, orsak: "nej" });
    expect(await h.tjanst.session({ sessionsnyckel: sak.sessionsnyckel, krav: { slag: "sak", funktion: "rosta" } })).toMatchObject({ ok: true });
    expect(await h.tjanst.session({ sessionsnyckel: sak.sessionsnyckel, krav: { funktion: "rosta" } })).toMatchObject({ ok: true });
    // Kravet på ett annat slag än omfångets är nej även när funktionen finns hos det andra slaget.
    expect(await h.tjanst.session({ sessionsnyckel: nyaGrupp.sessionsnyckel, krav: { slag: "grupp", funktion: "rosta" } })).toEqual({ ok: false, orsak: "nej" });
  });

  it("en återkallad gruppgäst nekas vid nästa anrop i VARJE åtgärd, och en tidigare giltig session återfår inget", async () => {
    const h = bygg();
    const g = await gruppGast(h);
    for (const [namn, anrop] of Object.entries(ATGARDER)) expect(await anrop(h.tjanst, g.sessionsnyckel), `${namn} före`).toMatchObject({ ok: true });
    await h.tjanst.aterkalla({ uid: AGARE, id: g.id });
    h.signera.mockClear();
    for (const [namn, anrop] of Object.entries(ATGARDER)) expect(await anrop(h.tjanst, g.sessionsnyckel), `${namn} efter`).toEqual({ ok: false, orsak: "aterkallad" });
    // Ingen adress efter återkallelsen: signeringen anropades aldrig.
    expect(h.signera).not.toHaveBeenCalled();
    // Raderna är oförändrade av nekade anrop: inget svar skrevs.
    expect((await h.grund.list("handelser/h-mote/svar")).filter((r) => r.id.startsWith("g_")).length).toBe(1);
  });

  it("en gäst med omfånget en sak når inte gruppens kalender, bibliotek eller chatt (och inte skriver i den), och inte heller en annan sak", async () => {
    const h = bygg();
    const s = await sakGast(h);
    for (const [namn, anrop] of Object.entries(ATGARDER)) {
      if (namn === "hamta") continue;
      expect(await anrop(h.tjanst, s.sessionsnyckel), namn).toEqual({ ok: false, orsak: "nej" });
    }
    // hamta ger omröstningens sak (skiva 1), aldrig en gruppbild.
    const hamta = await h.tjanst.hamta({ sessionsnyckel: s.sessionsnyckel });
    expect(hamta).toMatchObject({ ok: true, funktion: "rosta" });
    expect(hamta.grupp).toBeUndefined();
    expect(h.signera).not.toHaveBeenCalled();
  });

  it("utan sessionsnyckel, med en trasig eller en annan sorts nyckel är svaret nej i varje åtgärd", async () => {
    const h = bygg();
    for (const nyckel of [undefined, "", "kort", 5, "Z".repeat(43)]) {
      for (const [namn, anrop] of Object.entries(ATGARDER)) expect(await anrop(h.tjanst, nyckel), `${namn}/${String(nyckel)}`).toEqual({ ok: false, orsak: "nej" });
    }
  });
});

describe("vitlistade fält: ingen medlems adress, uid eller hemlighet lämnar servern", () => {
  async function allaSvar(h, nyckel) {
    const svar = [];
    for (const anrop of [ATGARDER.hamta, ATGARDER.chatt, ATGARDER.kalender, ATGARDER.bibliotek, ATGARDER.fil]) svar.push(await anrop(h.tjanst, nyckel));
    svar.push(await h.tjanst.handelse({ sessionsnyckel: nyckel, handelseId: "h-mote" }));
    svar.push(await h.tjanst.handelse({ sessionsnyckel: nyckel, handelseId: "h-ejsatt" }));
    svar.push(await h.tjanst.svara({ sessionsnyckel: nyckel, handelseId: "h-mote", val: "kommer" }));
    svar.push(await h.tjanst.rosta({ sessionsnyckel: nyckel, handelseId: "h-ejsatt", forslagId: "f1", val: "ja" }));
    svar.push(await ATGARDER.arenden(h.tjanst, nyckel));
    svar.push(await ATGARDER.kommenteraArende(h.tjanst, nyckel));
    svar.push(await ATGARDER.markeraArendeKlart(h.tjanst, nyckel));
    svar.push(await ATGARDER.skrivChatt(h.tjanst, nyckel));
    return svar;
  }

  it("seedade medlemmar, andra gäster, privata samtal, agenten, pengar och en annan grupp: inget av det finns i något svar (20 hemligheter), och det som ska synas gör det", async () => {
    const h = bygg();
    // En annan gäst finns, med sin adress och sin nyckelhash i databasen.
    await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, epost: "andra-gasten@foretag.se" });
    const g = await gruppGast(h);
    const rader = await h.grund.list("gastinbjudningar");
    const dynamiska = [...rader.map((r) => r.nyckelHash), gastId("andra-gasten@foretag.se"), gastId("anna@foretag.se"), g.sessionsnyckel, g.lank.nyckel, ...rader.map((r) => r.id)];
    const svar = await allaSvar(h, g.sessionsnyckel);
    const text = JSON.stringify(svar);
    // Golv: svaren är inte tomma. Ett prov som blir grönt av att inget kom tillbaka mäter ingenting.
    expect(svar.filter((s) => s.ok === true).length).toBe(svar.length);
    expect(text.length).toBeGreaterThan(2000);
    expect(HEMLIGHETER.length).toBeGreaterThanOrEqual(12);
    for (const hemlighet of [...HEMLIGHETER, ...dynamiska]) {
      // Gästens egen sessionsnyckel och dess hash är inte en hemlighet MOT gästen, men de ligger inte i svaren heller.
      expect(text.includes(hemlighet), `läcker: ${hemlighet}`).toBe(false);
    }
    // Det som ska synas: avsändarnamn, texter, händelser, poster och en signerad adress.
    for (const synligt of ["Agda Ägare", "Välkommen till gruppen", "Möte", "Låtlista", "https://lagring.example/signerat/", "Källan"]) expect(text, synligt).toContain(synligt);
    // Hela svaret är byggt av listorna: inga okända nycklar på översta nivån.
    expect(Object.keys(svar[1]).every((k) => GASTGRUPPSVARSFALT.chatt.includes(k))).toBe(true);
    expect(Object.keys(svar[2]).every((k) => GASTGRUPPSVARSFALT.kalender.includes(k))).toBe(true);
    expect(Object.keys(svar[3]).every((k) => GASTGRUPPSVARSFALT.bibliotek.includes(k))).toBe(true);
    expect(Object.keys(svar[4]).every((k) => GASTGRUPPSVARSFALT.fil.includes(k))).toBe(true);
    expect(Object.keys(svar[svar.length - 1]).every((k) => GASTGRUPPSVARSFALT.skrivChatt.includes(k))).toBe(true);
    expect(Object.keys(svar[0]).sort()).toEqual(["funktion", "grupp", "namn", "ok"]);
  });

  it("appens omröstningsbygge som sprider ut mer än falt släpper ändå bara igenom falt", async () => {
    const h = bygg();
    const g = await gruppGast(h);
    const d = await h.tjanst.handelse({ sessionsnyckel: g.sessionsnyckel, handelseId: "h-ejsatt" });
    expect(Object.keys(d.omrostning)).toEqual(["forslag", "mina"]);
    expect(JSON.stringify(d)).not.toContain("HEMLIGT-APPFALT");
  });

  it("hamta för en gruppgäst svarar med gruppens namn och funktionerna: chatt, kalender, bibliotek och ärenden, och utan appens ärendedelegering bara de tre första", async () => {
    const h = bygg();
    const g = await gruppGast(h);
    expect(await h.tjanst.hamta({ sessionsnyckel: g.sessionsnyckel })).toEqual({ ok: true, namn: "", funktion: "grupp", grupp: { namn: "Källan", funktioner: ["chatt", "kalender", "bibliotek", "arenden"] } });
    const utan = bygg({ utanArenden: true });
    const u = await gruppGast(utan);
    expect(await utan.tjanst.hamta({ sessionsnyckel: u.sessionsnyckel })).toEqual({ ok: true, namn: "", funktion: "grupp", grupp: { namn: "Källan", funktioner: ["chatt", "kalender", "bibliotek"] } });
  });
});

describe("skiva 3: ärenden som delegerats till en gäst", () => {
  const KOMMENTARER = (id) => `arenden/${id}/kommentarer`;
  const rad = async (h, id) => h.grund.read("arenden", id);

  it("gästen ser BARA de ärenden som är delegerade till hen: öppna först, vitlistade fält, och inget av gruppens övriga ärenden, GitHub-adressen eller ett uid", async () => {
    const h = bygg();
    const g = await gruppGast(h, "anna@foretag.se", { namn: "Anna" });
    const svar = await h.tjanst.arenden({ sessionsnyckel: g.sessionsnyckel });
    // Golv: tre ärenden, och ordningen är öppna först (nyast först) och sedan avslutade.
    expect(svar.ok).toBe(true);
    expect(svar.poster.map((p) => p.id)).toEqual(["a-anna", "a-anna2", "a-anna-klar"]);
    expect(svar.avkortad).toBe(false);
    expect(Object.keys(svar).sort()).toEqual(["avkortad", "ok", "poster"]);
    const forsta = svar.poster[0];
    expect(forsta).toEqual({
      id: "a-anna",
      rubrik: "Bygg scenen",
      text: "Skruvar saknas",
      status: "ny",
      forfallodag: "2026-11-20",
      kommentarer: [
        { id: "c1", text: "Jag tar den", tid: 1000, av: { namn: "Agda Ägare" }, gast: false, egen: false },
        { id: "c2", text: "Tack Agda", tid: 2000, av: { namn: "Maja Medlem" }, gast: false, egen: false },
      ],
    });
    for (const p of svar.poster) expect(Object.keys(p).every((k) => GASTARENDEFALT.includes(k))).toBe(true);
    for (const k of forsta.kommentarer) expect(Object.keys(k).every((f) => GASTARENDEKOMMENTARFALT.includes(f))).toBe(true);
    const text = JSON.stringify(svar);
    // Allt som inte är Annas, och allt appens bygge spred ut utöver falt:
    for (const hemlighet of ["GRUPPENS-ARENDE", "PRIVAT-ARENDE-AGDA", "BOS-ARENDE", "BOS-KOMMENTAR", "GRANNENS-ARENDE", "ARENDE-UTAN-ANSVARIG", "EKONOMI-BELOPP-4711", "HEMLIGT-GITHUB-REPO", "github.com", "HEMLIGT-APPFALT", AGARE, MEDLEM, "agda.hemlig@privat.example", BO, "mottagare", "uppgift"]) {
      expect(text.includes(hemlighet), `läcker: ${hemlighet}`).toBe(false);
    }
  });

  it("två gäster ser var sin lista, och en gäst utan något delegerat får en tom lista som ett svar (ok: true)", async () => {
    const h = bygg();
    const anna = await gruppGast(h, "anna@foretag.se");
    const bo = await gruppGast(h, "bo@foretag.se", { namn: "Bo" });
    const cia = await gruppGast(h, "cia@foretag.se");
    expect((await h.tjanst.arenden({ sessionsnyckel: bo.sessionsnyckel })).poster.map((p) => p.id)).toEqual(["a-bo"]);
    expect((await h.tjanst.arenden({ sessionsnyckel: anna.sessionsnyckel })).poster).toHaveLength(3);
    expect(await h.tjanst.arenden({ sessionsnyckel: cia.sessionsnyckel })).toEqual({ ok: true, poster: [], avkortad: false });
  });

  it("samma gäst är ansvarig i en annan grupp: Källans gäst ser det aldrig (gastId följer adressen, så gruppen prövas på raden)", async () => {
    const h = bygg();
    const g = await gruppGast(h);
    await h.grund.create("arenden", { id: "a-grannen", groupId: GRANNEN, rubrik: "GRANNENS-ARENDE", text: "x", status: "ny", skapad: "2026-10-06", sort: "uppgift", mottagare: { slag: "gast", gastId: ANNA, namn: "Anna" } });
    const ut = (await h.tjanst.arenden({ sessionsnyckel: g.sessionsnyckel })).poster.map((p) => p.id);
    expect(await h.grund.read("arenden", "a-grannen")).toMatchObject({ groupId: GRANNEN, mottagare: { gastId: ANNA } });
    expect(ut).not.toContain("a-grannen");
    // Kommentar och klar på grannens ärende nekas också, med samma nej som ett ärende som inte finns.
    expect(await h.tjanst.kommenteraArende({ sessionsnyckel: g.sessionsnyckel, arendeId: "a-grannen", text: "hej" })).toEqual({ ok: false, orsak: "nej" });
    expect(await h.tjanst.markeraArendeKlart({ sessionsnyckel: g.sessionsnyckel, arendeId: "a-grannen" })).toEqual({ ok: false, orsak: "nej" });
    expect((await rad(h, "a-grannen")).status).toBe("ny");
  });

  it("⛔ kommentera: på ett ärende som är gästens skrivs kommentaren via appen med gästens id och namn (aldrig ett uid), och syns därefter som gästens egen med märket Gäst", async () => {
    const h = bygg();
    const g = await gruppGast(h, "anna@foretag.se", { namn: "Anna Gäst" });
    const svar = await h.tjanst.kommenteraArende({ sessionsnyckel: g.sessionsnyckel, arendeId: "a-anna", text: "  Jag köper skruvar  " });
    expect(svar).toMatchObject({ ok: true, kommentar: { text: "Jag köper skruvar", tid: NU, av: { namn: "Anna Gäst" }, gast: true, egen: true } });
    expect(Object.keys(svar).sort()).toEqual(["kommentar", "ok"]);
    expect(h.arendelogg).toEqual([{ typ: "kommentera", id: "a-anna", g: ANNA, namn: "Anna Gäst", text: "Jag köper skruvar" }]);
    const sparad = (await h.grund.list(KOMMENTARER("a-anna"))).find((k) => k.gastId === ANNA);
    expect(sparad).toMatchObject({ text: "Jag köper skruvar", skapadAv: { uid: null, namn: "Anna Gäst", typ: "gast" }, gastId: ANNA });
    const efter = (await h.tjanst.arenden({ sessionsnyckel: g.sessionsnyckel })).poster.find((p) => p.id === "a-anna");
    expect(efter.kommentarer).toHaveLength(3);
    expect(efter.kommentarer[2]).toMatchObject({ text: "Jag köper skruvar", av: { namn: "Anna Gäst" }, gast: true, egen: true });
    // Annas kommentar är en gäst för en annan gäst: Gäst, men inte egen. (Bo ser inte Annas ärende: kommentaren läses via ärendet, som Bo inte har.)
    expect(efter.kommentarer.slice(0, 2).every((k) => k.gast === false && k.egen === false)).toBe(true);
    // Ett ärende i grannens ärende lämnas orört.
    expect(await h.grund.list(KOMMENTARER("a-bo"))).toHaveLength(1);
  });

  it("⛔ nej utan spår: ett ärende som delegerats till någon annan, en person, hela gruppen, ingen, en annan grupp, ett okänt id och id:n som försöker bli en sökväg nekas likadant, och inget skrivs", async () => {
    const h = bygg();
    const g = await gruppGast(h);
    const fore = JSON.stringify(await Promise.all(["arenden", KOMMENTARER("a-anna"), KOMMENTARER("a-bo")].map((s) => h.grund.list(s))));
    const ogiltiga = ["a-bo", "a-person", "a-grupp", "a-ingen", "a-grannen", "finns-inte", "a-anna/kommentarer/c1", "../a-bo", "", " ", "a-anna\u0000"];
    for (const arendeId of ogiltiga) {
      expect(await h.tjanst.kommenteraArende({ sessionsnyckel: g.sessionsnyckel, arendeId, text: "hej" }), `kommentera ${JSON.stringify(arendeId)}`).toEqual({ ok: false, orsak: "nej" });
      expect(await h.tjanst.markeraArendeKlart({ sessionsnyckel: g.sessionsnyckel, arendeId }), `klar ${JSON.stringify(arendeId)}`).toEqual({ ok: false, orsak: "nej" });
    }
    expect(ogiltiga.length).toBeGreaterThanOrEqual(10);
    expect(h.arendelogg).toEqual([]);
    expect(JSON.stringify(await Promise.all(["arenden", KOMMENTARER("a-anna"), KOMMENTARER("a-bo")].map((s) => h.grund.list(s))))).toBe(fore);
    // Ett id som inte är en text är ett programfel i anroparen, inte ett nej att lära sig något av.
    for (const arendeId of [undefined, null, 5, {}, ["a-anna"]]) {
      expect(await h.tjanst.kommenteraArende({ sessionsnyckel: g.sessionsnyckel, arendeId, text: "hej" })).toEqual({ ok: false, orsak: "nej" });
    }
  });

  it("markera klar: ärendet blir hanterat via appen med en not som säger vem, andra ärenden rörs inte, och det går inte en andra gång", async () => {
    const h = bygg();
    const g = await gruppGast(h, "anna@foretag.se", { namn: "Anna Gäst" });
    expect(await h.tjanst.markeraArendeKlart({ sessionsnyckel: g.sessionsnyckel, arendeId: "a-anna" })).toEqual({ ok: true });
    expect(await rad(h, "a-anna")).toMatchObject({ status: "hanterad", resultat: { url: null, not: "Markerad klar av gästen Anna Gäst" }, closed: NU });
    expect(h.arendelogg).toEqual([{ typ: "klar", id: "a-anna", g: ANNA, namn: "Anna Gäst" }]);
    for (const id of ["a-anna2", "a-bo", "a-person", "a-grupp"]) expect((await rad(h, id)).status, id).toBe("ny");
    // Redan klart: appens updateIf på status ger ok: false, och ramverket svarar nej. Ingenting skrivs om.
    expect(await h.tjanst.markeraArendeKlart({ sessionsnyckel: g.sessionsnyckel, arendeId: "a-anna" })).toEqual({ ok: false, orsak: "nej" });
    expect(await h.tjanst.markeraArendeKlart({ sessionsnyckel: g.sessionsnyckel, arendeId: "a-anna-klar" })).toEqual({ ok: false, orsak: "nej" });
    // Listan visar det nya läget, med det klara ärendet sist.
    expect((await h.tjanst.arenden({ sessionsnyckel: g.sessionsnyckel })).poster.map((p) => `${p.id}:${p.status}`)).toEqual(["a-anna2:ny", "a-anna:hanterad", "a-anna-klar:hanterad"]);
  });

  it("⛔ efter en återkallelse försvinner ärendena ur gästens vy i varje åtgärd, men delegeringen står kvar och medlemmarna ser den som återkallad; en ny inbjudan ger tillbaka dem", async () => {
    const h = bygg();
    const g = await gruppGast(h, "anna@foretag.se", { namn: "Anna" });
    expect((await h.tjanst.arenden({ sessionsnyckel: g.sessionsnyckel })).poster).toHaveLength(3);
    const fore = JSON.stringify(await h.grund.list("arenden"));
    await h.tjanst.aterkalla({ uid: AGARE, id: g.id });
    for (const [namn, anrop] of Object.entries({ arenden: ATGARDER.arenden, kommenteraArende: ATGARDER.kommenteraArende, markeraArendeKlart: ATGARDER.markeraArendeKlart })) {
      expect(await anrop(h.tjanst, g.sessionsnyckel), namn).toEqual({ ok: false, orsak: "aterkallad" });
    }
    expect(h.arendelogg).toEqual([]);
    // Ärendet och delegeringen rördes inte: allt står som förut.
    expect(JSON.stringify(await h.grund.list("arenden"))).toBe(fore);
    expect(await rad(h, "a-anna")).toMatchObject({ mottagare: { slag: "gast", gastId: ANNA, namn: "Anna" } });
    // Medlemmarna: gästen finns inte längre bland de levande, så raden läser "inbjudan återkallad". Ärendets egen rad har inget märke.
    const levande = (await h.tjanst.levandeGaster({ uid: MEDLEM, groupId: GRUPP })).gaster;
    expect(levande.map((x) => x.gastId)).not.toContain(ANNA);
    expect(tolkaGastMottagare((await rad(h, "a-anna")).mottagare, levande)).toEqual({ gastId: ANNA, namn: "Anna", aterkallad: true });
    expect(Object.keys(await rad(h, "a-anna")).some((k) => /aterkall/i.test(k))).toBe(false);
    // Samma adress bjuds in igen: samma inbjudan väcks och gästens ärenden är där igen (delegeringen var aldrig borta).
    await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, epost: "anna@foretag.se" });
    const lank = h.brev[h.brev.length - 1].lankar[0];
    const ny = await h.tjanst.los({ id: lank.id, nyckel: lank.nyckel, epost: "anna@foretag.se", ip: IP });
    expect((await h.tjanst.arenden({ sessionsnyckel: ny.sessionsnyckel })).poster).toHaveLength(3);
    expect(tolkaGastMottagare((await rad(h, "a-anna")).mottagare, (await h.tjanst.levandeGaster({ uid: MEDLEM, groupId: GRUPP })).gaster)).toEqual({ gastId: ANNA, namn: "Anna", aterkallad: false });
  });

  it("en omröstningsgäst (bara en sak) och en gäst utan session har inga ärenden: nej i alla tre åtgärderna", async () => {
    const h = bygg();
    const s = await sakGast(h);
    for (const anrop of [ATGARDER.arenden, ATGARDER.kommenteraArende, ATGARDER.markeraArendeKlart]) {
      expect(await anrop(h.tjanst, s.sessionsnyckel)).toEqual({ ok: false, orsak: "nej" });
      expect(await anrop(h.tjanst, undefined)).toEqual({ ok: false, orsak: "nej" });
    }
    expect(h.arendelogg).toEqual([]);
  });

  it("⛔ längdtak och text: 1000 tecken går, 1001, en tom text och blanksteg avvisas med ogiltig-text, och bilaga, citat, avsändare och namn kastas tillbaka innan något skrivs", async () => {
    const h = bygg();
    const g = await gruppGast(h);
    const kom = (text, extra = {}) => h.tjanst.kommenteraArende({ sessionsnyckel: g.sessionsnyckel, arendeId: "a-anna", text, ...extra });
    expect(GASTSKRIV_MAX_TECKEN).toBe(1000);
    expect((await kom("x".repeat(1000))).ok).toBe(true);
    for (const text of ["x".repeat(1001), "", "   ", undefined, 5]) await expect(kom(text), JSON.stringify(text)).rejects.toMatchObject({ kod: "ogiltig-text" });
    for (const extra of [{ bilaga: { namn: "a.png" } }, { svarPa: "c1" }, { namner: [AGARE] }, { av: AGARE }, { tid: 1 }, { namn: "Någon annan" }, { gastId: BO }]) {
      await expect(kom("hej", extra), JSON.stringify(extra)).rejects.toMatchObject({ kod: "ogiltig-text" });
    }
    expect(h.arendelogg).toHaveLength(1);
    // Inget av de avvisade försöken kostade en av de tio skrivningarna i minuten: nio till går.
    for (let n = 0; n < 9; n++) expect((await kom(`nr ${n}`)).ok, `nr ${n}`).toBe(true);
    expect(await kom("elfte")).toEqual({ ok: false, orsak: "for-manga" });
  });

  it("⛔ takten är chattens: en gäst har tio skrivningar per minut för chatt och kommentarer tillsammans, ett nej på ärendet kostar ingen, och efter en minut går det igen", async () => {
    const h = bygg();
    const g = await gruppGast(h);
    expect(GASTSKRIV_PER_MINUT).toBe(10);
    for (let n = 0; n < 5; n++) expect((await h.tjanst.skrivChatt({ sessionsnyckel: g.sessionsnyckel, text: `chatt ${n}` })).ok).toBe(true);
    // Fem nej på ett ärende som inte är gästens: ingen räknare går åt.
    for (let n = 0; n < 5; n++) expect(await h.tjanst.kommenteraArende({ sessionsnyckel: g.sessionsnyckel, arendeId: "a-bo", text: "nej" })).toEqual({ ok: false, orsak: "nej" });
    for (let n = 0; n < 5; n++) expect((await h.tjanst.kommenteraArende({ sessionsnyckel: g.sessionsnyckel, arendeId: "a-anna", text: `kommentar ${n}` })).ok, `kommentar ${n}`).toBe(true);
    expect(await h.tjanst.kommenteraArende({ sessionsnyckel: g.sessionsnyckel, arendeId: "a-anna", text: "elfte" })).toEqual({ ok: false, orsak: "for-manga" });
    expect(await h.tjanst.skrivChatt({ sessionsnyckel: g.sessionsnyckel, text: "elfte i chatten" })).toEqual({ ok: false, orsak: "for-manga" });
    // En annan gäst har sin egen takt.
    const bo = await gruppGast(h, "bo@foretag.se", { namn: "Bo" });
    expect((await h.tjanst.skrivChatt({ sessionsnyckel: bo.sessionsnyckel, text: "Bo skriver" })).ok).toBe(true);
    h.tid(NU + MINUT + 1);
    expect((await h.tjanst.kommenteraArende({ sessionsnyckel: g.sessionsnyckel, arendeId: "a-anna", text: "efter en minut" })).ok).toBe(true);
  });

  it("en kommentar som appen inte kunde skriva ger tillbaka försöket och kastar felet vidare", async () => {
    const fel = new Error("databasen sa nej");
    const h = bygg({ kommenteraFel: fel });
    const g = await gruppGast(h);
    for (let n = 0; n < 15; n++) await expect(h.tjanst.kommenteraArende({ sessionsnyckel: g.sessionsnyckel, arendeId: "a-anna", text: "försök" })).rejects.toBe(fel);
    // Femton misslyckade försök åt ingen av de tio: chatten går fortfarande.
    expect((await h.tjanst.skrivChatt({ sessionsnyckel: g.sessionsnyckel, text: "chatten lever" })).ok).toBe(true);
  });

  it("levandeGaster: en aktiv medlem får { gastId, namn } för gäster med levande gruppinbjudan, en per person, och aldrig en adress, en återkallad, en omröstningsgäst eller en annan grupps gäst", async () => {
    const h = bygg();
    await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, epost: "anna@foretag.se", namn: "Anna" });
    await h.tjanst.bjud({ uid: AGARE, handelseId: "h-mote", epost: "anna@foretag.se" });
    await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, epost: "bo@foretag.se" });
    const borta = await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, epost: "borta@foretag.se", namn: "Borta" });
    await h.tjanst.aterkalla({ uid: AGARE, id: borta.id });
    await h.tjanst.bjud({ uid: AGARE, handelseId: "h-mote", epost: "bara-sak@foretag.se", namn: "Bara Sak" });
    await h.tjanst.bjud({ uid: UTANFOR, slag: "grupp", groupId: GRANNEN, epost: "grannens@foretag.se", namn: "Grannens" });
    for (const uid of [MEDLEM, AGARE, ADMIN]) {
      const svar = await h.tjanst.levandeGaster({ uid, groupId: GRUPP });
      expect(svar).toEqual({ gaster: [{ gastId: ANNA, namn: "Anna" }, { gastId: BO, namn: "Gäst" }] });
    }
    const text = JSON.stringify(await h.tjanst.levandeGaster({ uid: MEDLEM, groupId: GRUPP }));
    for (const inte of ["@", "Borta", "Bara Sak", "Grannens", "nyckel", "status"]) expect(text.includes(inte), inte).toBe(false);
    for (const uid of [UTANFOR, SLUTAD, FRAMLING, AGENT, "uid-okand"]) await expect(h.tjanst.levandeGaster({ uid, groupId: GRUPP }), uid).rejects.toMatchObject({ kod: "ej-behorig" });
    await expect(h.tjanst.levandeGaster({ uid: "", groupId: GRUPP })).rejects.toThrow();
  });

  it("⛔ frågan är på gästen och inte på gruppen: tvåtusen andra ärenden i gruppen läses inte, två likhetsvillkor går till källan, och gästens tre ärenden kommer ändå", async () => {
    const frågor = /** @type {any[]} */ ([]);
    const radersLasta = { n: 0 };
    const omslut = (k) =>
      new Proxy(k, {
        get(mal, prop) {
          if (prop === "list") return async (samling, q) => { const r = await mal.list(samling, q); if (samling === "arenden") { frågor.push(q); radersLasta.n += r.length; } return r; };
          return typeof mal[prop] === "function" ? mal[prop].bind(mal) : mal[prop];
        },
      });
    const h = bygg({ omslut });
    const g = await gruppGast(h);
    for (let n = 0; n < GASTARENDE_SKANNA_MAX + 100; n++) await h.grund.create("arenden", { id: `fyll-${n}`, groupId: GRUPP, rubrik: `Fyllnad ${n}`, status: "ny", mottagare: { slag: "grupp" } });
    radersLasta.n = 0;
    frågor.length = 0;
    const svar = await h.tjanst.arenden({ sessionsnyckel: g.sessionsnyckel });
    expect(svar.poster.map((p) => p.id)).toEqual(["a-anna", "a-anna2", "a-anna-klar"]);
    expect(svar.avkortad).toBe(false);
    expect(frågor).toHaveLength(1);
    expect(frågor[0].where).toEqual({ groupId: GRUPP, "mottagare.gastId": ANNA });
    // Golv: källan hade över två tusen ärenden, och bara gästens egna lästes.
    expect((await h.grund.list("arenden")).length).toBeGreaterThan(GASTARENDE_SKANNA_MAX);
    expect(radersLasta.n).toBe(3);
  });

  it("⛔ svaret prövas rad för rad även när källan ger för mycket: en källa som struntar i frågan ger ändå aldrig en gäst en annans, en annan grupps eller ingens ärende", async () => {
    const omslut = (k) =>
      new Proxy(k, {
        get(mal, prop) {
          // En källa som tolkar frågan fel: den ger HELA samlingen, hur frågan än ser ut.
          if (prop === "list") return async (samling, q) => mal.list(samling, q && samling === "arenden" ? { limit: q.limit } : q);
          return typeof mal[prop] === "function" ? mal[prop].bind(mal) : mal[prop];
        },
      });
    const h = bygg({ omslut });
    await h.grund.create("arenden", { id: "a-grannen", groupId: GRANNEN, rubrik: "GRANNENS-ARENDE", status: "ny", skapad: "2026-10-06", mottagare: { slag: "gast", gastId: ANNA, namn: "Anna" } });
    const g = await gruppGast(h);
    // Golv: källan har åtta ärenden i två grupper och ger alla åtta oavsett fråga.
    expect((await h.grund.list("arenden")).length).toBe(8);
    const svar = await h.tjanst.arenden({ sessionsnyckel: g.sessionsnyckel });
    expect(svar.poster.map((p) => p.id)).toEqual(["a-anna", "a-anna2", "a-anna-klar"]);
    expect(JSON.stringify(svar)).not.toContain("GRANNENS-ARENDE");
  });

  it("⛔ appens falt är hela listan: en app som bara listar rubriken släpper inte ut text, status eller förfallodag, hur mycket bygg än ger", async () => {
    const h = bygg({ arendeFalt: ["rubrik"] });
    const g = await gruppGast(h);
    const svar = await h.tjanst.arenden({ sessionsnyckel: g.sessionsnyckel });
    expect(svar.poster).toHaveLength(3);
    for (const p of svar.poster) expect(Object.keys(p).sort()).toEqual(["id", "kommentarer", "rubrik"]);
    expect(JSON.stringify(svar)).not.toContain("Skruvar saknas");
  });

  it("⛔ ett id som försöker bli en sökväg når inte ett dokument någon annanstans: med en källa som läser 'samling/id' som en sökväg (som Firestore) nekas det, och ett vanligt id går", async () => {
    // Firestore läser `doc("arenden", "a-bo/andra/x")` som sökvägen arenden/a-bo/andra/x. Minneskällan gör det inte, så provet gör som Firestore.
    const somFirestore = (k) =>
      new Proxy(k, {
        get(mal, prop) {
          if (prop === "read") return async (samling, id) => { const delar = `${samling}/${id}`.split("/"); const sista = delar.pop(); return mal.read(delar.join("/"), sista); };
          return typeof mal[prop] === "function" ? mal[prop].bind(mal) : mal[prop];
        },
      });
    const h = bygg({ omslut: somFirestore });
    // Ett dokument i en undersamling som SER UT som Annas ärende: rätt grupp och rätt mottagare, men inte i ärendesamlingen.
    await h.grund.create("arenden/a-bo/andra", { id: "x", groupId: GRUPP, rubrik: "NEDGRAVT-ARENDE", status: "ny", mottagare: { slag: "gast", gastId: ANNA, namn: "Anna" } });
    const g = await gruppGast(h);
    expect(await h.tjanst.kommenteraArende({ sessionsnyckel: g.sessionsnyckel, arendeId: "a-bo/andra/x", text: "hej" })).toEqual({ ok: false, orsak: "nej" });
    expect(await h.tjanst.markeraArendeKlart({ sessionsnyckel: g.sessionsnyckel, arendeId: "a-bo/andra/x" })).toEqual({ ok: false, orsak: "nej" });
    expect(h.arendelogg).toEqual([]);
    expect((await h.tjanst.kommenteraArende({ sessionsnyckel: g.sessionsnyckel, arendeId: "a-anna", text: "hej" })).ok).toBe(true);
  });

  it("gästen får högst GASTARENDE_MAX ärenden och högst GASTARENDEKOMMENTARER_MAX kommentarer per ärende, de senaste, och ärendet säger att fler finns", async () => {
    const h = bygg();
    for (let n = 0; n < GASTARENDE_MAX + 20; n++) await h.grund.create("arenden", { id: `egen-${n}`, groupId: GRUPP, rubrik: `Egen ${n}`, status: "ny", skapad: `2026-01-01T00:${String(n % 60).padStart(2, "0")}`, mottagare: { slag: "gast", gastId: ANNA, namn: "Anna" } });
    for (let n = 0; n < GASTARENDEKOMMENTARER_MAX + 5; n++) await h.grund.create(KOMMENTARER("a-anna"), { id: `k${String(n).padStart(3, "0")}`, text: `Kommentar ${n}`, skapad: 10_000 + n, skapadAv: { uid: AGARE, namn: "Agda Ägare" } });
    const g = await gruppGast(h);
    const svar = await h.tjanst.arenden({ sessionsnyckel: g.sessionsnyckel });
    expect(svar.poster).toHaveLength(GASTARENDE_MAX);
    // Gästen har 123 ärenden och 100 visas: svaret säger det.
    expect(svar.avkortad).toBe(true);
    const anna = svar.poster.find((p) => p.id === "a-anna");
    // a-anna är nyast av de öppna (2026-10-12 mot 2026-01-01...): den är med.
    expect(anna.kommentarer).toHaveLength(GASTARENDEKOMMENTARER_MAX);
    expect(anna.fler).toBe(true);
    expect(anna.kommentarer[anna.kommentarer.length - 1].text).toBe(`Kommentar ${GASTARENDEKOMMENTARER_MAX + 4}`);
    expect(svar.poster.find((p) => p.id !== "a-anna").fler).toBeUndefined();
  });

  it("⛔ regeln i tjänsten: grupp.arenden kräver samling, falt ur listan och alla fem funktionerna, och ska ha ett eget samlingsnamn", () => {
    const h = bygg();
    const konfig = (arenden) => ({
      kalla: h.kalla,
      samlingar: { inbjudningar: "a", sessioner: "b", platser: "c", raknare: "d", handelser: "e" },
      farBjuda: () => true,
      skicka: async () => {},
      radering: {},
      grupp: { samlingar: { grupper: "g", samtal: "s", meddelanden: "m", bibliotek: "bib", svar: "sv" }, lagring: { signeradAdress: async () => "" }, handelseSida: () => ({ titel: "x" }), arenden },
    });
    const ok = { ...h.arenden, samling: "arendena" };
    expect(() => createGastService(konfig(ok))).not.toThrow();
    expect(() => createGastService(konfig({ ...ok, samling: undefined }))).toThrow(/samling krävs/);
    expect(() => createGastService(konfig({ ...ok, samling: "bib" }))).toThrow(/eget namn/);
    for (const falt of [[], ["id"], ["kommentarer"], ["url"], ["rubrik", ""], "rubrik", undefined]) expect(() => createGastService(konfig({ ...ok, falt })), JSON.stringify(falt)).toThrow(/falt är en icke-tom lista/);
    for (const f of ["bygg", "kommentarer", "kommentera", "markeraKlart", "radera"]) expect(() => createGastService(konfig({ ...ok, [f]: undefined })), f).toThrow(new RegExp(`grupp.arenden.${f} krävs`));
  });

  it("utan grupp.arenden finns inga ärendeåtgärder: alla tre svarar nej, och funktionen finns inte i hamta", async () => {
    const h = bygg({ utanArenden: true });
    const g = await gruppGast(h);
    for (const anrop of [ATGARDER.arenden, ATGARDER.kommenteraArende, ATGARDER.markeraArendeKlart]) expect(await anrop(h.tjanst, g.sessionsnyckel)).toEqual({ ok: false, orsak: "nej" });
    expect((await h.tjanst.hamta({ sessionsnyckel: g.sessionsnyckel })).grupp.funktioner).not.toContain("arenden");
  });

  it("⛔ radering: gästens kommentarer på ärenden och gästens id och namn på delegeringarna är borta, medlemmarnas kommentarer och andras delegeringar står kvar, och resultatet säger hur många ärenden som rördes", async () => {
    const h = bygg();
    const g = await gruppGast(h, "anna@foretag.se", { namn: "UNIKT-GASTNAMN" });
    await h.tjanst.kommenteraArende({ sessionsnyckel: g.sessionsnyckel, arendeId: "a-anna", text: "Gästens egen kommentar" });
    const bo = await gruppGast(h, "bo@foretag.se", { namn: "Bo" });
    const text = async () => JSON.stringify([await h.grund.list("arenden"), await h.grund.list(KOMMENTARER("a-anna")), await h.grund.list(KOMMENTARER("a-bo"))]);
    // Golv: spåren FANNS före raderingen.
    expect(await text()).toContain(ANNA);
    expect(await text()).toContain("Gästens egen kommentar");
    const ut = await h.tjanst.radera({ uid: AGARE, groupId: GRUPP, gastId: ANNA });
    // Tre ärenden i Källan pekade på Anna.
    expect(ut).toMatchObject({ arenden: 3, grupper: [GRUPP] });
    const efter = await text();
    expect(efter).not.toContain("Gästens egen kommentar");
    expect(efter).not.toContain("UNIKT-GASTNAMN");
    expect((await h.grund.list(KOMMENTARER("a-anna"))).map((k) => k.id).sort()).toEqual(["c1", "c2"]);
    expect(await rad(h, "a-anna")).toMatchObject({ mottagare: null, rubrik: "Bygg scenen" });
    // Bos delegering och kommentar är kvar, och Bos ärende ser Bo.
    expect(await rad(h, "a-bo")).toMatchObject({ mottagare: { gastId: BO } });
    expect((await h.tjanst.arenden({ sessionsnyckel: bo.sessionsnyckel })).poster.map((p) => p.id)).toEqual(["a-bo"]);
    // Gästens egen begäran gör detsamma (alla grupper), och en app utan ärenden ger inget `arenden`-tal att räkna.
    const h2 = bygg();
    const g2 = await gruppGast(h2);
    expect(await h2.tjanst.raderaMig({ sessionsnyckel: g2.sessionsnyckel })).toEqual({ ok: true });
    expect(JSON.stringify(await h2.grund.list("arenden"))).not.toContain(ANNA);
  });

  it("⛔ en radering som appens ärendedel inte klarar lämnar inbjudan kvar, så att den går att köra om", async () => {
    const h = bygg();
    const g = await gruppGast(h);
    h.arenden.radera = async () => {
      throw new Error("ärendedatabasen nere");
    };
    await expect(h.tjanst.radera({ uid: AGARE, groupId: GRUPP, gastId: ANNA })).rejects.toThrow(/ärendedatabasen nere/);
    expect(await h.grund.list("gastinbjudningar")).toHaveLength(1);
    expect((await h.tjanst.hamta({ sessionsnyckel: g.sessionsnyckel })).ok).toBe(true);
  });

  it("byggGastMottagare, gastDelegerad och tolkaGastMottagare: formen, urvalet och de tre utfallen (levande, återkallad, okänt)", () => {
    expect(byggGastMottagare({ slag: "gast", gastId: ANNA, namn: "  Anna  " })).toEqual({ slag: "gast", gastId: ANNA, namn: "Anna" });
    expect(byggGastMottagare({ slag: "gast", gastId: ANNA })).toEqual({ slag: "gast", gastId: ANNA, namn: GASTNAMNLOS });
    expect(byggGastMottagare({ slag: "gast", gastId: ANNA, namn: "A" }, [{ gastId: ANNA }])).toMatchObject({ gastId: ANNA });
    expect(() => byggGastMottagare({ slag: "gast", gastId: ANNA }, [{ gastId: BO }])).toThrow(/ingen levande gruppinbjudan/);
    for (const m of [{ slag: "person", uid: "x" }, { slag: "gast" }, { slag: "gast", gastId: "uid-123" }, { slag: "gast", gastId: ANNA, epost: "a@b.se" }, { slag: "gast", gastId: ANNA, namn: "x".repeat(81) }, null, "gast"]) {
      expect(() => byggGastMottagare(m), JSON.stringify(m)).toThrow();
    }
    expect(gastDelegerad({ slag: "gast", gastId: ANNA, namn: "x" }, ANNA)).toBe(true);
    for (const [m, id] of [[{ slag: "gast", gastId: ANNA }, BO], [{ slag: "person", gastId: ANNA }, ANNA], [{ slag: "grupp", gastId: ANNA }, ANNA], [{ gastId: ANNA }, ANNA], [{ slag: "person", uid: ANNA }, ANNA], [{ slag: "grupp" }, ANNA], [null, ANNA], [undefined, ANNA], ["gast", ANNA], [{ slag: "gast", gastId: ANNA }, "uid-123"], [{ slag: "gast", gastId: ANNA }, undefined], [{ slag: "gast", gastId: "g_x" }, "g_x"]]) {
      expect(gastDelegerad(m, id), JSON.stringify([m, id])).toBe(false);
    }
    const m = { slag: "gast", gastId: ANNA, namn: "Gammalt namn" };
    expect(tolkaGastMottagare(m, [{ gastId: ANNA, namn: "Nytt namn" }])).toEqual({ gastId: ANNA, namn: "Nytt namn", aterkallad: false });
    expect(tolkaGastMottagare(m, [])).toEqual({ gastId: ANNA, namn: "Gammalt namn", aterkallad: true });
    expect(tolkaGastMottagare(m)).toEqual({ gastId: ANNA, namn: "Gammalt namn", aterkallad: null });
    expect(tolkaGastMottagare({ slag: "gast", gastId: ANNA }, [])).toMatchObject({ namn: GASTNAMNLOS });
    for (const x of [null, undefined, { slag: "person", uid: "a" }, { slag: "grupp" }, { slag: "gast", gastId: "nej" }, "gast"]) expect(tolkaGastMottagare(x, []), JSON.stringify(x)).toBeNull();
  });
});

describe("chatten: hela historiken, bara gruppens samtal, och agenten syns inte", () => {
  it("hela gruppchatten i tidsordning med avsändarnamn, citat, omnämnanden och bilagans namn, utan agentens meddelande, privata samtal och bilagans innehåll", async () => {
    const h = bygg();
    const g = await gruppGast(h);
    const svar = await h.tjanst.chatt({ sessionsnyckel: g.sessionsnyckel });
    expect(svar.ok).toBe(true);
    expect(svar.fler).toBe(false);
    expect(svar.meddelanden.map((m) => m.id)).toEqual(["m1", "m2", "m4", "m5", "m6"]);
    const m2 = svar.meddelanden.find((m) => m.id === "m2");
    expect(m2).toEqual({ id: "m2", av: { namn: "Maja Medlem" }, text: "Tack Agda", tid: 2000, namner: ["Agda Ägare", "alla"], gast: false, egen: false });
    expect(svar.meddelanden.find((m) => m.id === "m4").svarPa).toEqual({ id: "m1", namn: "Agda Ägare", text: "Välkommen till gruppen" });
    // En avsändare utan medlemskap heter "Tidigare medlem", aldrig tomt och aldrig ett uid.
    expect(svar.meddelanden.find((m) => m.id === "m5").av).toEqual({ namn: "Tidigare medlem" });
    // Bilagan bär namn och typ, aldrig innehållet.
    expect(svar.meddelanden.find((m) => m.id === "m6").bilaga).toEqual({ namn: "bild.png", typ: "image/png" });
    expect(JSON.stringify(svar)).not.toContain("data:HEMLIG");
  });

  it("historiken är hel: 120 meddelanden läses i sidor om 50, äldre via fore, utan dubbletter och utan hål", async () => {
    const mån = Array.from({ length: 120 }, (_, i) => ({ id: `n${String(i).padStart(3, "0")}`, text: `Meddelande ${i}`, av: AGARE, tid: 10_000 + i }));
    const h = bygg({ extra: { [`samtal/${GRUPP}|grupp/meddelanden`]: mån } });
    const g = await gruppGast(h);
    const sid1 = await h.tjanst.chatt({ sessionsnyckel: g.sessionsnyckel });
    expect(sid1.meddelanden).toHaveLength(GASTCHATT_SIDA);
    expect(sid1.fler).toBe(true);
    expect(sid1.meddelanden[0].id).toBe("n070");
    expect(sid1.meddelanden[49].id).toBe("n119");
    const sid2 = await h.tjanst.chatt({ sessionsnyckel: g.sessionsnyckel, fore: sid1.meddelanden[0].tid });
    const sid3 = await h.tjanst.chatt({ sessionsnyckel: g.sessionsnyckel, fore: sid2.meddelanden[0].tid });
    expect(sid2.fler).toBe(true);
    expect(sid3.fler).toBe(false);
    const alla = [...sid3.meddelanden, ...sid2.meddelanden, ...sid1.meddelanden].map((m) => m.id);
    expect(alla).toEqual(mån.map((m) => m.id));
  });

  it("pingen svarar ingetNytt med en läsning, och ett nyare meddelande ger sidan", async () => {
    const h = bygg();
    const g = await gruppGast(h);
    expect(await h.tjanst.chatt({ sessionsnyckel: g.sessionsnyckel, nyast: 6000 })).toEqual({ ok: true, meddelanden: [], fler: false, ingetNytt: true });
    expect((await h.tjanst.chatt({ sessionsnyckel: g.sessionsnyckel, nyast: 5999 })).meddelanden.length).toBeGreaterThan(0);
    await expect(h.tjanst.chatt({ sessionsnyckel: g.sessionsnyckel, nyast: "x" })).rejects.toThrow(/nyast/);
  });

  it("gruppen kommer ur inbjudan: en gäst i grannen ser aldrig Källans chatt, och Källans gäst aldrig grannens", async () => {
    const h = bygg();
    const k = await gruppGast(h);
    await h.tjanst.bjud({ uid: UTANFOR, slag: "grupp", groupId: GRANNEN, epost: "granne@foretag.se" });
    const lank = h.brev[h.brev.length - 1].lankar[0];
    const inl = await h.tjanst.los({ id: lank.id, nyckel: lank.nyckel, epost: "granne@foretag.se", ip: IP });
    const grannens = await h.tjanst.chatt({ sessionsnyckel: inl.sessionsnyckel });
    expect(grannens.meddelanden.map((m) => m.text)).toEqual(["GRANNENS-HEMLIGHET"]);
    expect(JSON.stringify(await h.tjanst.chatt({ sessionsnyckel: k.sessionsnyckel }))).not.toContain("GRANNENS-HEMLIGHET");
  });
});

describe("kalendern, händelsen, svaret och rösten", () => {
  it("kalendern har gruppens händelser i datumordning, med lägena Datum ej satt och heldag, utan arkiverade, trasiga och andra gruppers, och skriver ut vad som inte visas", async () => {
    const h = bygg();
    const g = await gruppGast(h);
    const k = await h.tjanst.kalender({ sessionsnyckel: g.sessionsnyckel });
    expect(k.ok).toBe(true);
    expect(k.handelser.map((x) => x.id)).toEqual(["h-mote", "h-fri", "h-ejsatt"]);
    expect(k.handelser[0]).toEqual({ id: "h-mote", titel: "Möte", beskrivning: "Vi ses i salen", plats: "Salen", datum: "2026-11-02", slutDatum: null, tid: "18:00", slutTid: "20:00", heldag: false, kalenderId: null, kravSvar: true, ejSatt: false });
    expect(k.handelser[1]).toMatchObject({ heldag: true, tid: null });
    expect(k.handelser[2]).toMatchObject({ datum: null, ejSatt: true, kravSvar: true });
    expect(k.avkortad).toBe(false);
    expect(k.ejVisade).toBe(1);
    expect(k.kalendrar).toEqual([]);
  });

  it("kalendern kapas vid taket och säger det (avkortad), i stället för att se ut som hela listan", async () => {
    const manga = Array.from({ length: 5003 }, (_, i) => ({ id: `x${i}`, groupId: GRUPP, rubrik: `H ${i}`, datum: "2026-12-01" }));
    const h = bygg({ extra: { handelser: [...seed().handelser, ...manga] } });
    const g = await gruppGast(h);
    const k = await h.tjanst.kalender({ sessionsnyckel: g.sessionsnyckel });
    expect(k.avkortad).toBe(true);
    expect(k.handelser.length).toBeLessThanOrEqual(5000);
    expect(k.handelser.length).toBeGreaterThan(4000);
  });

  it("händelsen i detalj: summan räknar medlemmar och gäster som en mängd, aldrig namn, och gästens eget svar visas", async () => {
    const h = bygg();
    const g = await gruppGast(h);
    // Före: 4 aktiva personer (ägare, admin, medlem; agenten och den avslutade räknas inte) plus 1 gäst = 4 + ... se nedan.
    const fore = await h.tjanst.handelse({ sessionsnyckel: g.sessionsnyckel, handelseId: "h-mote" });
    // Aktiva personer: Agda, Adam, Maja (3) + gästen (1) = 4. Agda har svarat Kommer inte, Maja Kommer.
    expect(fore.svar).toEqual({ kommer: 1, kommerInte: 1, ejSvarat: 2, text: "1 kommer, 1 kommer inte, 2 har inte svarat", mitt: null });
    expect(await h.tjanst.svara({ sessionsnyckel: g.sessionsnyckel, handelseId: "h-mote", val: "kommer" })).toEqual({ ok: true });
    const efter = await h.tjanst.handelse({ sessionsnyckel: g.sessionsnyckel, handelseId: "h-mote" });
    expect(efter.svar).toEqual({ kommer: 2, kommerInte: 1, ejSvarat: 1, text: "2 kommer, 1 kommer inte, 1 har inte svarat", mitt: "kommer" });
    // Svarsraden är medlemmens form, med gästens g_-id: en rad { id, svar } och inget mer.
    const rad = (await h.grund.list("handelser/h-mote/svar")).find((r) => r.id === gastId("anna@foretag.se"));
    expect(rad).toEqual({ id: gastId("anna@foretag.se"), svar: "kommer" });
    // Ett andra svar är en uppdatering av samma rad, inte en ny.
    await h.tjanst.svara({ sessionsnyckel: g.sessionsnyckel, handelseId: "h-mote", val: "kommerInte" });
    expect((await h.grund.list("handelser/h-mote/svar")).filter((r) => r.id.startsWith("g_"))).toHaveLength(1);
    expect(JSON.stringify(efter)).not.toMatch(/Maja|Agda|Adam/);
  });

  it("en återkallad gästs svar räknas inte i summan (som en medlem som lämnat)", async () => {
    const h = bygg();
    const a = await gruppGast(h, "anna@foretag.se");
    const b = await gruppGast(h, "bo@foretag.se");
    await h.tjanst.svara({ sessionsnyckel: a.sessionsnyckel, handelseId: "h-mote", val: "kommer" });
    expect((await h.tjanst.handelse({ sessionsnyckel: b.sessionsnyckel, handelseId: "h-mote" })).svar.kommer).toBe(2);
    await h.tjanst.aterkalla({ uid: AGARE, id: a.id });
    expect((await h.tjanst.handelse({ sessionsnyckel: b.sessionsnyckel, handelseId: "h-mote" })).svar).toMatchObject({ kommer: 1, ejSvarat: 2 });
  });

  /**
   * Samma tabell som medlemmens regel för ett svar (handelseregelfragment): händelsen finns i gruppen, är inte arkiverad och ber om svar (`kravSvar == true`), och värdet är kommer eller
   * kommerInte. 14 fall. `rules/__tests__/gaster-grupp.test.mjs` kör SAMMA tabell mot de riktiga reglerna som medlem, så att servern inte kan vara lösare än reglerna.
   */
  it("svara följer medlemsregelns villkor i 14 fall från den delade tabellen (kravSvar, arkiverad, annan grupp, saknas och värdet)", async () => {
    const { SVARFALL } = await import("../../rules/__tests__/svarfall.mjs");
    expect(SVARFALL.length).toBeGreaterThanOrEqual(12);
    for (const f of SVARFALL) {
      const h = bygg({
        extra: {
          handelser: [
            ...seed().handelser,
            { id: "f-ja", groupId: GRUPP, rubrik: "F", datum: "2026-11-05", kravSvar: true },
            { id: "f-nej", groupId: GRUPP, rubrik: "F", datum: "2026-11-05", kravSvar: false },
            { id: "f-utan", groupId: GRUPP, rubrik: "F", datum: "2026-11-05" },
            { id: "f-arkiv", groupId: GRUPP, rubrik: "F", datum: "2026-11-05", kravSvar: true, arkiverad: true },
            { id: "f-annan", groupId: GRANNEN, rubrik: "F", datum: "2026-11-05", kravSvar: true },
          ],
        },
      });
      const g = await gruppGast(h);
      const utfall = f.val === "kommer" || f.val === "kommerInte" ? await h.tjanst.svara({ sessionsnyckel: g.sessionsnyckel, handelseId: f.handelse, val: f.val }) : await h.tjanst.svara({ sessionsnyckel: g.sessionsnyckel, handelseId: f.handelse, val: f.val }).catch(() => ({ ok: false, kastade: true }));
      expect(utfall.ok === true, f.namn).toBe(f.gast);
      // Servern är aldrig lösare än medlemmens regel.
      if (f.gast) expect(f.medlem, `${f.namn}: servern släpper in där regeln nekar`).toBe(true);
      const skriven = (await h.grund.list(`handelser/${f.handelse}/svar`)).some((r) => r.id.startsWith("g_"));
      expect(skriven, `${f.namn} skrev`).toBe(f.gast);
    }
  });

  it("en gäst röstar via appens omröstning, en annan grupps händelse ger saknas, och utan omröstning är svaret nej", async () => {
    const h = bygg();
    const g = await gruppGast(h);
    expect(await h.tjanst.rosta({ sessionsnyckel: g.sessionsnyckel, handelseId: "h-ejsatt", forslagId: "f1", val: "ja" })).toEqual({ ok: true });
    expect(h.rostlogg).toEqual([{ g: gastId("anna@foretag.se"), groupId: GRUPP, forslagId: "f1", val: "ja" }]);
    expect((await h.tjanst.handelse({ sessionsnyckel: g.sessionsnyckel, handelseId: "h-ejsatt" })).omrostning.mina).toEqual(["ja"]);
    // Appen avvisar ett värde: svaret är nej, och inget skrevs.
    expect(await h.tjanst.rosta({ sessionsnyckel: g.sessionsnyckel, handelseId: "h-ejsatt", forslagId: "f1", val: "kanske-kanske" })).toEqual({ ok: false, orsak: "nej" });
    // En annan grupps, en arkiverad och en obefintlig händelse är samma svar.
    for (const handelseId of ["h-grannen", "h-arkiv", "finns-inte", undefined, 7]) {
      expect(await h.tjanst.rosta({ sessionsnyckel: g.sessionsnyckel, handelseId, forslagId: "f1", val: "ja" }), String(handelseId)).toEqual({ ok: false, orsak: "saknas" });
      expect(await h.tjanst.handelse({ sessionsnyckel: g.sessionsnyckel, handelseId }), String(handelseId)).toEqual({ ok: false, orsak: "saknas" });
    }
    expect(h.rostlogg).toHaveLength(2);
  });
});

describe("bibliotek", () => {
  it("biblioteket är gruppens egen plats: inte händelsens, Mitt bibliotek eller en annan grupps, och sökvägen är postens id, aldrig lagringens", async () => {
    const h = bygg();
    const g = await gruppGast(h);
    const b = await h.tjanst.bibliotek({ sessionsnyckel: g.sessionsnyckel });
    const ids = b.poster.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(["p-pdf", "p-doc", "p-ljud", "p-not", "p-lank"]));
    for (const fel of ["p-hand", "p-mitt", "p-grannen"]) expect(ids, fel).not.toContain(fel);
    expect(b.avkortad).toBe(false);
    const pdf = b.poster.find((p) => p.id === "p-pdf");
    expect(pdf).toEqual({ id: "p-pdf", typ: "fil", rubrik: "Låtlista", fil: { sokvag: "p-pdf", namn: "lat.pdf", mime: "application/pdf", byte: 1200, klar: true }, skapad: 5000, andrad: 5000, skapadAvNamn: "Maja Medlem" });
    expect(b.poster.find((p) => p.id === "p-ljud")).toMatchObject({ durationMs: 61000, peaks: "abc" });
    expect(b.poster.find((p) => p.id === "p-not")).toMatchObject({ text: "Kom ihåg tejp", taggar: ["scen"] });
    expect(b.poster.find((p) => p.id === "p-lank")).toMatchObject({ url: "https://open.spotify.com/track/abc", kalla: "spotify" });
    // Nyast först.
    expect(b.poster[0].id).toBe("p-pdf");
  });

  it("⛔ biblioteket prövas rad för rad även när källan ger för mycket: en källa som struntar i frågan ger ändå aldrig en annan grupps, händelsens eller Mitt biblioteks poster", async () => {
    const omslut = (k) =>
      new Proxy(k, {
        get(mal, prop) {
          if (prop === "list") return async (samling, q) => mal.list(samling, q && samling === "bibliotek" ? { limit: q.limit } : q);
          return typeof mal[prop] === "function" ? mal[prop].bind(mal) : mal[prop];
        },
      });
    const vanlig = bygg();
    const felkalla = bygg({ omslut });
    const g1 = await gruppGast(vanlig);
    const g2 = await gruppGast(felkalla);
    // Golv: källan ger alla poster, också de som inte är gruppens.
    expect((await felkalla.grund.list("bibliotek")).some((p) => p.groupId !== GRUPP)).toBe(true);
    const rätt = (await vanlig.tjanst.bibliotek({ sessionsnyckel: g1.sessionsnyckel })).poster.map((p) => p.id);
    const fel = (await felkalla.tjanst.bibliotek({ sessionsnyckel: g2.sessionsnyckel })).poster.map((p) => p.id);
    expect(fel).toEqual(rätt);
    for (const annan of ["p-hand", "p-mitt", "p-grannen"]) expect(fel, annan).not.toContain(annan);
  });

  it("biblioteket kapas vid taket och säger det", async () => {
    const manga = Array.from({ length: GASTBIBLIOTEK_MAX + 5 }, (_, i) => ({ id: `q${i}`, groupId: GRUPP, typ: "anteckning", rubrik: `Post ${i}`, text: "x", skapadAv: { uid: AGARE, namn: "A" }, skapad: i, andrad: i }));
    const h = bygg({ extra: { bibliotek: manga } });
    const g = await gruppGast(h);
    const b = await h.tjanst.bibliotek({ sessionsnyckel: g.sessionsnyckel });
    expect(b.poster).toHaveLength(GASTBIBLIOTEK_MAX);
    expect(b.avkortad).toBe(true);
  });
});

describe("nedladdning: en signerad adress, rätt fil, tak per dygn, och ingen adress efter återkallelsen", () => {
  it("rätt fil signeras med rätt sökväg, 15 minuter och rätt disposition: en PDF öppnas inline, ett dokument hämtas med ett rensat filnamn", async () => {
    const h = bygg();
    const g = await gruppGast(h);
    const pdf = await h.tjanst.fil({ sessionsnyckel: g.sessionsnyckel, postId: "p-pdf" });
    expect(pdf).toMatchObject({ ok: true, namn: "lat.pdf", mime: "application/pdf" });
    expect(h.signera).toHaveBeenLastCalledWith({ sokvag: "grupper/kallan/bibliotek/p-pdf/lat.pdf", sekunder: SIGNERAD_SEKUNDER, disposition: "inline", mime: "application/pdf" });
    expect(SIGNERAD_SEKUNDER).toBe(900);
    const doc = await h.tjanst.fil({ sessionsnyckel: g.sessionsnyckel, postId: "p-doc" });
    expect(doc.ok).toBe(true);
    const anrop = h.signera.mock.calls.at(-1)[0];
    expect(anrop.sokvag).toBe("grupper/kallan/bibliotek/p-doc/avtal.docx");
    expect(anrop.disposition).toMatch(/^attachment; filename="avtal_ _\.docx|^attachment; filename="avtal/);
    expect(anrop.disposition).toContain("filename*=UTF-8''");
    // Ljud öppnas inline, och bifoga: true tvingar en nedladdning.
    await h.tjanst.fil({ sessionsnyckel: g.sessionsnyckel, postId: "p-ljud" });
    expect(h.signera.mock.calls.at(-1)[0].disposition).toBe("inline");
    await h.tjanst.fil({ sessionsnyckel: g.sessionsnyckel, postId: "p-ljud", bifoga: true });
    expect(h.signera.mock.calls.at(-1)[0].disposition).toMatch(/^attachment/);
  });

  it("bara gruppens egna färdiga filer med exakt sökväg: händelsens, Mitt bibliotek, en annan grupps, en som pekar på en annans fil, en med punkter, en som inte är klar och en med fel post i sökvägen nekas", async () => {
    const h = bygg();
    const g = await gruppGast(h);
    for (const postId of ["p-hand", "p-mitt", "p-grannen", "p-pek", "p-dot", "p-ejklar", "p-andraid", "p-not", "p-lank", "finns-inte", "", undefined, 5]) {
      expect(await h.tjanst.fil({ sessionsnyckel: g.sessionsnyckel, postId }), String(postId)).toEqual({ ok: false, orsak: "saknas" });
    }
    expect(h.signera).not.toHaveBeenCalled();
    // Gruppen prövas på BÅDA ställena, var för sig: en post i grannen med en sökväg in i Källans plats, och en post i Källan med en sökväg in i grannens plats (där postens id ändå stämmer).
    await h.grund.create("bibliotek", { id: "p-korsad-a", groupId: GRANNEN, typ: "fil", rubrik: "KORSAD-A", fil: { sokvag: "grupper/kallan/bibliotek/p-korsad-a/z.pdf", namn: "z.pdf", mime: "application/pdf", byte: 1, klar: true }, skapadAv: { uid: UTANFOR, namn: "Ulla" }, skapad: 1, andrad: 1 });
    await h.grund.create("bibliotek", { id: "p-korsad-b", groupId: GRUPP, typ: "fil", rubrik: "KORSAD-B", fil: { sokvag: "grupper/grannen/bibliotek/p-korsad-b/z.pdf", namn: "z.pdf", mime: "application/pdf", byte: 1, klar: true }, skapadAv: { uid: MEDLEM, namn: "Maja" }, skapad: 1, andrad: 1 });
    for (const postId of ["p-korsad-a", "p-korsad-b"]) expect(await h.tjanst.fil({ sessionsnyckel: g.sessionsnyckel, postId }), postId).toEqual({ ok: false, orsak: "saknas" });
    expect(h.signera).not.toHaveBeenCalled();
    // Nekade försök kostar inget av dygnstaket. (En ny minut: tretton anrop plus femtio är fler än minutens 60.)
    h.tid(NU + 2 * MINUT);
    for (let n = 0; n < GASTFIL_PER_DYGN; n++) expect(await h.tjanst.fil({ sessionsnyckel: g.sessionsnyckel, postId: "p-pdf" })).toMatchObject({ ok: true });
  });

  it("taket är 50 filer per inbjudan och dygn, räknas före signeringen, nollas nästa dygn och gäller per inbjudan", async () => {
    const h = bygg();
    const a = await gruppGast(h, "anna@foretag.se");
    const b = await gruppGast(h, "bo@foretag.se");
    for (let n = 0; n < GASTFIL_PER_DYGN; n++) expect(await h.tjanst.fil({ sessionsnyckel: a.sessionsnyckel, postId: "p-pdf" }), `fil ${n}`).toMatchObject({ ok: true });
    h.signera.mockClear();
    expect(await h.tjanst.fil({ sessionsnyckel: a.sessionsnyckel, postId: "p-pdf" })).toEqual({ ok: false, orsak: "for-manga" });
    expect(h.signera).not.toHaveBeenCalled();
    // En annan inbjudan har sitt eget tak.
    expect(await h.tjanst.fil({ sessionsnyckel: b.sessionsnyckel, postId: "p-pdf" })).toMatchObject({ ok: true });
    // Nästa dygn.
    h.tid(NU + DYGN + 1000);
    expect(await h.tjanst.fil({ sessionsnyckel: a.sessionsnyckel, postId: "p-pdf" })).toMatchObject({ ok: true });
  });

  it("en signering som faller ger tillbaka försöket och kastar felet", async () => {
    const h = bygg({ signeringsfel: new Error("IAM nere") });
    const g = await gruppGast(h);
    await expect(h.tjanst.fil({ sessionsnyckel: g.sessionsnyckel, postId: "p-pdf" })).rejects.toThrow(/IAM nere/);
    const rakn = (await h.grund.list("gastraknare")).find((r) => r.antal !== undefined && r.id === sha(`gastfil|${g.id}`));
    expect(rakn.antal).toBe(0);
  });
});

describe("hastighet och läsningar", () => {
  it("anrop 61 inom en minut ger for-manga, och fönstret nollas efter en minut", async () => {
    const h = bygg();
    const g = await gruppGast(h);
    for (let n = 0; n < GASTANROP_PER_MINUT; n++) expect((await h.tjanst.hamta({ sessionsnyckel: g.sessionsnyckel })).ok, `anrop ${n + 1}`).toBe(true);
    expect(await h.tjanst.hamta({ sessionsnyckel: g.sessionsnyckel })).toEqual({ ok: false, orsak: "for-manga" });
    expect(await h.tjanst.chatt({ sessionsnyckel: g.sessionsnyckel })).toEqual({ ok: false, orsak: "for-manga" });
    h.tid(NU + MINUT + 1000);
    expect((await h.tjanst.hamta({ sessionsnyckel: g.sessionsnyckel })).ok).toBe(true);
  });

  /** Räknar läsningar: en per `read` och en per rad en `list` ger tillbaka. En skrivning är inte en läsning här. */
  function mat() {
    const rakna = { lasningar: 0 };
    const omslut = (k) =>
      new Proxy(k, {
        get(mal, prop) {
          if (prop === "read") return async (...a) => { rakna.lasningar += 1; return mal.read(...a); };
          if (prop === "list") return async (...a) => { const r = await mal.list(...a); rakna.lasningar += Math.max(1, r.length); return r; };
          return typeof mal[prop] === "function" ? mal[prop].bind(mal) : mal[prop];
        },
      });
    return { rakna, omslut };
  }

  it("hamta kostar högst 5 läsningar och chattens ping högst 4, med en grupp på hundra medlemmar och tusen meddelanden", async () => {
    const m = mat();
    const manga = Array.from({ length: 1000 }, (_, i) => ({ id: `n${i}`, text: "x", av: AGARE, tid: 20_000 + i }));
    const fler = Array.from({ length: 100 }, (_, i) => medlemskap(`uid-ytterligare-${i}`, GRUPP, "medlem", `Person ${i}`));
    const h = bygg({ omslut: m.omslut, extra: { [`samtal/${GRUPP}|grupp/meddelanden`]: manga, memberships: [...seed().memberships, ...fler] } });
    const g = await gruppGast(h);
    m.rakna.lasningar = 0;
    expect((await h.tjanst.hamta({ sessionsnyckel: g.sessionsnyckel })).ok).toBe(true);
    expect(m.rakna.lasningar).toBeLessThanOrEqual(5);
    m.rakna.lasningar = 0;
    expect(await h.tjanst.chatt({ sessionsnyckel: g.sessionsnyckel, nyast: 99_999_999 })).toMatchObject({ ingetNytt: true });
    expect(m.rakna.lasningar).toBeLessThanOrEqual(4);
  });
});

describe("återkalla alla, ersatt av medlem, listan och nya länkar", () => {
  it("aterkallaAlla drar tillbaka bara personens inbjudningar i gruppen, är idempotent och släpper platsen", async () => {
    const h = bygg();
    await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, epost: "anna@foretag.se" });
    await h.tjanst.bjud({ uid: AGARE, handelseId: "h-mote", epost: "anna@foretag.se" });
    await h.tjanst.bjud({ uid: UTANFOR, slag: "grupp", groupId: GRANNEN, epost: "anna@foretag.se" });
    await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, epost: "bo@foretag.se" });
    const g = gastId("anna@foretag.se");
    expect(await h.tjanst.aterkallaAlla({ uid: AGARE, groupId: GRUPP, gastId: g })).toEqual({ aterkallade: 2, platsSlappt: true });
    expect(await h.tjanst.aterkallaAlla({ uid: AGARE, groupId: GRUPP, gastId: g })).toEqual({ aterkallade: 0, platsSlappt: false });
    const rader = await h.grund.list("gastinbjudningar");
    // Grannens inbjudan till samma person och Bos inbjudan är orörda: groupId står i villkoret.
    expect(rader.filter((r) => r.aterkallad === null).map((r) => `${r.groupId}/${r.epost}`).sort()).toEqual([`${GRANNEN}/anna@foretag.se`, `${GRUPP}/bo@foretag.se`]);
    expect((await h.grund.list("gastplatser")).filter((p) => p.gastId === g && p.id.startsWith(`${GRUPP}|`)).map((p) => p.id)).toEqual([]);
    // Behörighet: en vanlig medlem får inte, och en person utan inbjudningar ger finns-inte.
    await expect(h.tjanst.aterkallaAlla({ uid: MEDLEM, groupId: GRUPP, gastId: gastId("bo@foretag.se") })).rejects.toMatchObject({ kod: "ej-behorig" });
    await expect(h.tjanst.aterkallaAlla({ uid: AGARE, groupId: GRUPP, gastId: gastId("ingen@foretag.se") })).rejects.toMatchObject({ kod: "finns-inte" });
    await expect(h.tjanst.aterkallaAlla({ uid: AGARE, groupId: GRUPP, gastId: "inte-ett-id" })).rejects.toMatchObject({ kod: "finns-inte" });
    expect((await h.grund.list("gastinbjudningar")).find((r) => r.epost === "bo@foretag.se").aterkallad).toBeNull();
  });

  it("den som bjöd får dra tillbaka sin gruppinbjudan även efter att ha blivit en vanlig medlem, men inte skicka om den", async () => {
    const h = bygg();
    const { id } = await h.tjanst.bjud({ uid: ADMIN, slag: "grupp", groupId: GRUPP, epost: "anna@foretag.se" });
    // Admin degraderas.
    await h.grund.update("memberships", medlemskapsId(ADMIN, GRUPP), { roll: "medlem" });
    await expect(h.tjanst.skickaOm({ uid: ADMIN, id })).rejects.toMatchObject({ kod: "ej-behorig" });
    await expect(h.tjanst.aterkalla({ uid: ADMIN, id })).resolves.toMatchObject({ id });
    // En annan vanlig medlem får varken eller.
    const { id: id2 } = await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, epost: "bo@foretag.se" });
    await expect(h.tjanst.aterkalla({ uid: MEDLEM, id: id2 })).rejects.toMatchObject({ kod: "ej-behorig" });
    await expect(h.tjanst.skickaOm({ uid: AGARE, id: id2 })).resolves.toEqual({ id: id2 });
  });

  it("ersattAvMedlem drar tillbaka personens gästinbjudningar i just den gruppen och släpper platsen; gästens svar står kvar men räknas inte", async () => {
    const h = bygg();
    const g = await gruppGast(h);
    await h.tjanst.svara({ sessionsnyckel: g.sessionsnyckel, handelseId: "h-mote", val: "kommer" });
    await h.tjanst.bjud({ uid: UTANFOR, slag: "grupp", groupId: GRANNEN, epost: "anna@foretag.se" });
    expect(await h.tjanst.ersattAvMedlem({ epost: "ANNA@foretag.se", groupId: GRUPP })).toEqual({ aterkallade: 1, platsSlappt: true });
    expect(await h.tjanst.ersattAvMedlem({ epost: "anna@foretag.se", groupId: GRUPP })).toEqual({ aterkallade: 0, platsSlappt: false });
    expect(await h.tjanst.ersattAvMedlem({ epost: "okand@foretag.se", groupId: GRUPP })).toEqual({ aterkallade: 0, platsSlappt: false });
    const rader = await h.grund.list("gastinbjudningar");
    expect(rader.find((r) => r.groupId === GRANNEN).aterkallad).toBeNull();
    expect((await h.grund.list("handelser/h-mote/svar")).some((r) => r.id === gastId("anna@foretag.se"))).toBe(true);
    expect(await h.tjanst.hamta({ sessionsnyckel: g.sessionsnyckel })).toEqual({ ok: false, orsak: "aterkallad" });
    await expect(h.tjanst.ersattAvMedlem({ epost: "inte-en-adress", groupId: GRUPP })).rejects.toMatchObject({ kod: "ogiltig-epost" });
  });

  it("listan för en grupp har en rad per person med sina inbjudningar och omröstningens rubrik, och platserna", async () => {
    const h = bygg();
    await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, epost: "anna@foretag.se", namn: "Anna" });
    await h.tjanst.bjud({ uid: AGARE, handelseId: "h-mote", epost: "anna@foretag.se" });
    await h.tjanst.bjud({ uid: AGARE, handelseId: "h-mote", epost: "bo@foretag.se" });
    const l = await h.tjanst.lista({ uid: MEDLEM, groupId: GRUPP });
    expect(l.platser).toEqual({ anvanda: 2, totalt: GAST_PLATSER_GRATIS, lediga: 3 });
    expect(l.personer).toHaveLength(2);
    const anna = l.personer.find((p) => p.epost === "anna@foretag.se");
    expect(Object.keys(anna).sort()).toEqual(["epost", "gastId", "inbjudningar", "namn", "status"]);
    expect(anna).toMatchObject({ gastId: gastId("anna@foretag.se"), namn: "Anna", status: "vantar" });
    expect(anna.inbjudningar.map((i) => [i.omfang.slag, i.titel])).toEqual([["grupp", null], ["sak", "Möte"]]);
    expect(JSON.stringify(l)).not.toMatch(/nyckelHash|felAntal/);
    await expect(h.tjanst.lista({ uid: UTANFOR, groupId: GRUPP })).rejects.toMatchObject({ kod: "ej-behorig" });
    await expect(h.tjanst.lista({ uid: MEDLEM, groupId: GRUPP, handelseId: "h-mote" })).rejects.toThrow(/inte båda/);
    // Skiva 1:s lista per händelse är oförändrad.
    expect((await h.tjanst.lista({ uid: AGARE, handelseId: "h-mote" })).gaster).toHaveLength(2);
  });

  it("nya länkar: grupplänken kommer först av högst fem, och svaret är detsamma byte för byte", async () => {
    const h = bygg({ extra: { handelser: [...seed().handelser, ...Array.from({ length: 7 }, (_, i) => ({ id: `e${i}`, groupId: GRUPP, rubrik: "E", datum: "2026-12-01", skapadAv: { uid: AGARE } }))] } });
    // Grupplänken skapas FÖRST, och sex omröstningar efter den: på `skapad` ensam hamnade den utanför de fem.
    await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, epost: "anna@foretag.se" });
    for (let i = 0; i < 6; i++) {
      h.tid(NU + (i + 1) * 1000);
      await h.tjanst.bjud({ uid: AGARE, handelseId: `e${i}`, epost: "anna@foretag.se" });
    }
    h.brev.length = 0;
    const svar = await h.tjanst.nyLank({ epost: "anna@foretag.se", ip: IP });
    const okand = await h.tjanst.nyLank({ epost: "ingen@foretag.se", ip: "198.51.100.9" });
    expect(svar).toEqual(okand);
    expect(h.brev).toHaveLength(1);
    expect(h.brev[0].lankar).toHaveLength(5);
    expect(h.brev[0].lankar[0].omfang).toEqual({ slag: "grupp" });
  });
});

describe("gästen skriver i chatten (CP 2026-10-20: gästen får skriva)", () => {
  const MEDD = `samtal/${GRUPP}|grupp/meddelanden`;
  const skrivna = async (h) => (await h.grund.list(MEDD)).filter((m) => arGastId(m.av));

  it("en giltig session skriver: meddelandet sparas med gästens id och namn, aldrig som en medlem, och visas i chatten som Gäst och som gästens eget", async () => {
    const h = bygg();
    const g = await gruppGast(h, "anna@foretag.se", { namn: "Anna Gäst" });
    const svar = await h.tjanst.skrivChatt({ sessionsnyckel: g.sessionsnyckel, text: "  Hej allihopa  " });
    expect(svar).toMatchObject({ ok: true, meddelande: { av: { namn: "Anna Gäst" }, text: "Hej allihopa", tid: NU, gast: true, egen: true } });
    expect(Object.keys(svar).sort()).toEqual(["meddelande", "ok"]);
    // Raden: texten, gästens g_-id, tiden och namnet. Inget uid, ingen bilaga, inget annat fält.
    const rader = await skrivna(h);
    expect(rader).toHaveLength(1);
    expect(Object.keys(rader[0]).sort()).toEqual(["av", "avNamn", "id", "text", "tid"]);
    expect(rader[0]).toMatchObject({ text: "Hej allihopa", av: gastId("anna@foretag.se"), avNamn: "Anna Gäst", tid: NU });
    expect(rader[0].av).not.toBe(AGARE);
    expect(arGastId(rader[0].av)).toBe(true);
    // I chatten: märkt som gäst, och eget för den som skrev men inte för en annan gäst.
    const lasning = await h.tjanst.chatt({ sessionsnyckel: g.sessionsnyckel });
    expect(lasning.meddelanden.find((m) => m.id === svar.meddelande.id)).toEqual({ id: svar.meddelande.id, av: { namn: "Anna Gäst" }, text: "Hej allihopa", tid: NU, gast: true, egen: true });
    const annan = await gruppGast(h, "bo@foretag.se");
    const dennes = (await h.tjanst.chatt({ sessionsnyckel: annan.sessionsnyckel })).meddelanden.find((m) => m.id === svar.meddelande.id);
    expect(dennes).toMatchObject({ gast: true, egen: false, av: { namn: "Anna Gäst" } });
    // Medlemmens meddelanden är inte märkta.
    expect(lasning.meddelanden.filter((m) => m.gast)).toHaveLength(1);
    // Inget uid och ingen adress i något svar.
    expect(JSON.stringify([svar, lasning])).not.toContain("anna@foretag.se");
  });

  it("en gäst utan namn skriver som Gäst", async () => {
    const h = bygg();
    const g = await gruppGast(h);
    const svar = await h.tjanst.skrivChatt({ sessionsnyckel: g.sessionsnyckel, text: "Hej" });
    expect(svar.meddelande.av).toEqual({ namn: GASTNAMNLOS });
    expect((await skrivna(h))[0].avNamn).toBeUndefined();
  });

  it("⛔ utan session, med en trasig, okänd eller utgången nyckel: nej, och ingenting skrivs", async () => {
    const h = bygg();
    for (const nyckel of [undefined, "", "kort", 5, "Z".repeat(43)]) {
      expect(await h.tjanst.skrivChatt({ sessionsnyckel: nyckel, text: "Hej" }), String(nyckel)).toEqual({ ok: false, orsak: "nej" });
    }
    expect(await skrivna(h)).toEqual([]);
  });

  it("⛔ efter en återkallelse nekas skrivandet vid nästa försök, och inget skrevs", async () => {
    const h = bygg();
    const g = await gruppGast(h);
    expect(await h.tjanst.skrivChatt({ sessionsnyckel: g.sessionsnyckel, text: "Före" })).toMatchObject({ ok: true });
    await h.tjanst.aterkalla({ uid: AGARE, id: g.id });
    expect(await h.tjanst.skrivChatt({ sessionsnyckel: g.sessionsnyckel, text: "Efter" })).toEqual({ ok: false, orsak: "aterkallad" });
    expect((await skrivna(h)).map((m) => m.text)).toEqual(["Före"]);
  });

  it("⛔ en omröstningsgäst har inte chatten och skriver inte i den", async () => {
    const h = bygg();
    const s = await sakGast(h);
    expect(await h.tjanst.skrivChatt({ sessionsnyckel: s.sessionsnyckel, text: "Hej" })).toEqual({ ok: false, orsak: "nej" });
    expect(await skrivna(h)).toEqual([]);
  });

  it("⛔ längdtaket: 1000 tecken går, 1001, en tom text och blanksteg avvisas med ogiltig-text, och inget kostar ett av meddelandena i minuten", async () => {
    const h = bygg();
    const g = await gruppGast(h);
    expect(await h.tjanst.skrivChatt({ sessionsnyckel: g.sessionsnyckel, text: "x".repeat(GASTSKRIV_MAX_TECKEN) })).toMatchObject({ ok: true });
    for (const text of ["x".repeat(GASTSKRIV_MAX_TECKEN + 1), "", "   \n ", undefined, 5]) {
      await expect(h.tjanst.skrivChatt({ sessionsnyckel: g.sessionsnyckel, text }), String(text).slice(0, 10)).rejects.toMatchObject({ kod: "ogiltig-text" });
    }
    expect(await skrivna(h)).toHaveLength(1);
    // Avvisade försök räknades inte: resten av takten är kvar.
    for (let i = 0; i < GASTSKRIV_PER_MINUT - 1; i++) expect(await h.tjanst.skrivChatt({ sessionsnyckel: g.sessionsnyckel, text: `m${i}` })).toMatchObject({ ok: true });
    expect(await skrivna(h)).toHaveLength(GASTSKRIV_PER_MINUT);
  });

  it("⛔ takten: tio meddelanden per inbjudan och minut, det elfte ger for-manga, en annan gäst påverkas inte, och efter en minut går det igen", async () => {
    expect(GASTSKRIV_PER_MINUT).toBe(10);
    const h = bygg();
    const g = await gruppGast(h);
    for (let i = 0; i < GASTSKRIV_PER_MINUT; i++) expect(await h.tjanst.skrivChatt({ sessionsnyckel: g.sessionsnyckel, text: `m${i}` }), `m${i}`).toMatchObject({ ok: true });
    expect(await h.tjanst.skrivChatt({ sessionsnyckel: g.sessionsnyckel, text: "för mycket" })).toEqual({ ok: false, orsak: "for-manga" });
    expect(await skrivna(h)).toHaveLength(GASTSKRIV_PER_MINUT);
    const annan = await gruppGast(h, "bo@foretag.se");
    expect(await h.tjanst.skrivChatt({ sessionsnyckel: annan.sessionsnyckel, text: "Hej" })).toMatchObject({ ok: true });
    h.tid(NU + 61 * 1000);
    expect(await h.tjanst.skrivChatt({ sessionsnyckel: g.sessionsnyckel, text: "igen" })).toMatchObject({ ok: true });
  });

  it("⛔ en gäst kan inte bifoga eller skicka något annat än text: bilaga, citat, omnämnanden, avsändare och tid kastas tillbaka", async () => {
    const h = bygg();
    const g = await gruppGast(h);
    for (const extra of [{ bilaga: { namn: "a.png", typ: "image/png", dataUrl: "data:image/png;base64,AAAA" } }, { svarPa: "m1" }, { namner: ["alla"] }, { av: AGARE }, { tid: 1 }]) {
      await expect(h.tjanst.skrivChatt({ sessionsnyckel: g.sessionsnyckel, text: "Hej", ...extra }), Object.keys(extra)[0]).rejects.toMatchObject({ kod: "ogiltig-text" });
    }
    expect(await skrivna(h)).toEqual([]);
  });

  it("skrivChatt finns i gästens åtgärder och ger ett svar av listan", async () => {
    expect(GASTGRUPPATGARDER).toContain("skrivChatt");
    const h = bygg();
    const g = await gruppGast(h);
    const svar = await h.tjanst.skrivChatt({ sessionsnyckel: g.sessionsnyckel, text: "Hej" });
    expect(Object.keys(svar).every((k) => GASTGRUPPSVARSFALT.skrivChatt.includes(k))).toBe(true);
  });
});

describe("radering: inga spår av gästens adress, och platsen frigörs", () => {
  /** Allt som lagras, samlat, som en enda text att söka i. */
  async function allt(h) {
    const delar = [];
    for (const s of SAMLINGAR_ATT_SOKA) delar.push(JSON.stringify(await h.grund.list(s)));
    return delar.join("\n");
  }

  async function fullAvtryck(h, epost = "anna@foretag.se") {
    const g = await gruppGast(h, epost, { namn: "UNIKT-GASTNAMN" });
    await h.tjanst.skrivChatt({ sessionsnyckel: g.sessionsnyckel, text: "Ett meddelande från gästen" });
    const sak = await h.tjanst.bjud({ uid: AGARE, handelseId: "h-ejsatt", epost });
    const lank = h.brev[h.brev.length - 1].lankar[0];
    const inl = await h.tjanst.los({ id: lank.id, nyckel: lank.nyckel, epost, ip: IP });
    await h.tjanst.svara({ sessionsnyckel: g.sessionsnyckel, handelseId: "h-mote", val: "kommer" });
    await h.tjanst.rosta({ sessionsnyckel: g.sessionsnyckel, handelseId: "h-ejsatt", forslagId: "f1", val: "ja" });
    await h.tjanst.fil({ sessionsnyckel: g.sessionsnyckel, postId: "p-pdf" });
    await h.tjanst.nyLank({ epost, ip: IP });
    return { g, sak, saksession: inl.sessionsnyckel };
  }

  it("provet kan se ett spår: före radering finns adressen, identiteten, sessionerna, räknarna, rösten och svaret i lagret", async () => {
    const h = bygg();
    await fullAvtryck(h);
    const text = await allt(h);
    expect(text).toContain("anna@foretag.se");
    expect(text).toContain(gastId("anna@foretag.se"));
    expect((await h.grund.list("gastsessioner")).length).toBe(2);
    expect((await h.grund.list("gastraknare")).length).toBeGreaterThanOrEqual(4);
    expect((await h.grund.list("datumroster")).length).toBe(1);
    expect((await h.grund.list("handelser/h-mote/svar")).some((r) => r.id.startsWith("g_"))).toBe(true);
    expect((await h.grund.list("mejlko")).length).toBeGreaterThan(0);
  });

  it("från medlemmens lista: inbjudningar, sessioner, räknare, röster, svar, platsen och appens mejlkö är borta, och adressen finns ingenstans", async () => {
    const h = bygg();
    await bjudAnnan(h);
    const { g, saksession } = await fullAvtryck(h);
    const annasInbjudningar = (await h.grund.list("gastinbjudningar")).filter((r) => r.epost === "anna@foretag.se").map((r) => r.id);
    expect(annasInbjudningar).toHaveLength(2);
    // Golv: räknarna som hör till hennes inbjudningar FANNS före raderingen, annars är "borta efteråt" grönt av att ingenting fanns.
    const harRaknare = async () => {
      const ids = [sha(`nylank-epost|${gastId("anna@foretag.se")}`), ...annasInbjudningar.flatMap((id) => [sha(`gastanrop|${id}`), sha(`gastfil|${id}`), sha(`gastskriv|${id}`)])];
      return (await Promise.all(ids.map((id) => h.grund.read("gastraknare", id)))).filter(Boolean).length;
    };
    expect(await harRaknare()).toBeGreaterThanOrEqual(4);
    // Gästens meddelande finns i chatten, med namnet, före raderingen.
    expect(await allt(h)).toContain("UNIKT-GASTNAMN");
    const ut = await h.tjanst.radera({ uid: AGARE, groupId: GRUPP, gastId: gastId("anna@foretag.se") });
    expect(await harRaknare()).toBe(0);
    expect(await h.grund.list("gastsessioner")).toEqual([]);
    expect(ut).toMatchObject({ inbjudningar: 2, sessioner: 2, meddelanden: 1, platserSlappta: 1, grupper: [GRUPP] });
    const text = await allt(h);
    expect(text).not.toContain("anna@foretag.se");
    expect(text).not.toContain(gastId("anna@foretag.se"));
    expect(text).not.toContain(g.sessionsnyckel);
    // ⛔ Gästens eget meddelande och namnet på det är borta ur gruppens chatt, och de andras är kvar.
    expect(text).not.toContain("UNIKT-GASTNAMN");
    expect(text).not.toContain("Ett meddelande från gästen");
    expect((await h.grund.list(`samtal/${GRUPP}|grupp/meddelanden`)).some((m) => arGastId(m.av))).toBe(false);
    expect((await h.grund.list(`samtal/${GRUPP}|grupp/meddelanden`)).length).toBeGreaterThan(3);
    expect(await h.grund.list("datumroster")).toEqual([]);
    expect((await h.grund.list("handelser/h-mote/svar")).some((r) => r.id.startsWith("g_"))).toBe(false);
    // Sessionerna är borta, så ingen gammal nyckel öppnar något.
    for (const nyckel of [g.sessionsnyckel, saksession]) expect(await h.tjanst.hamta({ sessionsnyckel: nyckel })).toEqual({ ok: false, orsak: "nej" });
    // Platsen är fri: personen går att bjuda in igen, och den andra gästen berördes inte.
    expect((await h.grund.list("gastplatser")).map((p) => p.gastId)).toEqual([gastId("bo@foretag.se")]);
    expect((await h.grund.list("gastinbjudningar")).map((r) => r.epost)).toEqual(["bo@foretag.se"]);
    expect(h.spar).toHaveBeenCalledWith({ epost: "anna@foretag.se", gastId: gastId("anna@foretag.se"), grupper: [GRUPP], alla: true });
    expect(h.roster).toHaveBeenCalledWith({ gastId: gastId("anna@foretag.se"), groupId: GRUPP });
  });

  /** En annan gäst som inte ska röras av raderingen. */
  async function bjudAnnan(h) {
    await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, epost: "bo@foretag.se" });
  }

  it("på gästens egen begäran från gästsidan: allt i alla grupper, också efter en återkallelse, och sessionen slutar gälla", async () => {
    const h = bygg();
    await bjudAnnan(h);
    const { g } = await fullAvtryck(h);
    // En inbjudan i en annan grupp till samma person.
    await h.tjanst.bjud({ uid: UTANFOR, slag: "grupp", groupId: GRANNEN, epost: "anna@foretag.se" });
    // Återkallad: gästen får ändå radera sig (en dragen inbjudan är inget skäl att behålla en adress).
    await h.tjanst.aterkalla({ uid: AGARE, id: g.id });
    expect(await h.tjanst.raderaMig({ sessionsnyckel: g.sessionsnyckel })).toEqual({ ok: true });
    const text = await allt(h);
    expect(text).not.toContain("anna@foretag.se");
    expect(text).not.toContain(gastId("anna@foretag.se"));
    expect((await h.grund.list("gastinbjudningar")).map((r) => r.epost)).toEqual(["bo@foretag.se"]);
    expect(h.spar).toHaveBeenCalledWith({ epost: "anna@foretag.se", gastId: gastId("anna@foretag.se"), grupper: expect.arrayContaining([GRUPP, GRANNEN]), alla: true });
    expect(await h.tjanst.raderaMig({ sessionsnyckel: g.sessionsnyckel })).toEqual({ ok: false, orsak: "nej" });
    // Taket: platserna för Anna är fria i båda grupperna.
    expect((await h.grund.list("gastplatser")).map((p) => p.gastId)).toEqual([gastId("bo@foretag.se")]);
  });

  it("raderaMig kräver en riktig session: en okänd, trasig eller för gammal nyckel raderar ingenting", async () => {
    const h = bygg();
    const { g } = await fullAvtryck(h);
    const fore = await allt(h);
    for (const nyckel of [undefined, "kort", "Q".repeat(43), 3]) expect(await h.tjanst.raderaMig({ sessionsnyckel: nyckel })).toEqual({ ok: false, orsak: "nej" });
    h.tid(NU + (GASTSESSIONSDAGAR + 1) * DYGN);
    expect(await h.tjanst.raderaMig({ sessionsnyckel: g.sessionsnyckel })).toEqual({ ok: false, orsak: "nej" });
    expect(await allt(h)).toBe(fore);
  });

  it("raderingen från listan kräver samma rätt som att dra tillbaka, för ALLA personens rader, annars raderas ingen", async () => {
    const h = bygg();
    await h.tjanst.bjud({ uid: MEDLEM, handelseId: "h-mote", epost: "anna@foretag.se" }).catch(() => null);
    // MEDLEM skapade inte h-mote (AGARE gjorde det), så den gick inte. Skaparen AGARE bjuder in till sak och gruppen.
    await h.tjanst.bjud({ uid: AGARE, handelseId: "h-mote", epost: "anna@foretag.se" });
    await h.tjanst.bjud({ uid: ADMIN, slag: "grupp", groupId: GRUPP, epost: "anna@foretag.se" });
    const fore = await allt(h);
    // Admin får dra tillbaka båda (admin i gruppen): radera går.
    await expect(h.tjanst.radera({ uid: MEDLEM, groupId: GRUPP, gastId: gastId("anna@foretag.se") })).rejects.toMatchObject({ kod: "ej-behorig" });
    await expect(h.tjanst.radera({ uid: UTANFOR, groupId: GRUPP, gastId: gastId("anna@foretag.se") })).rejects.toMatchObject({ kod: "ej-behorig" });
    expect(await allt(h)).toBe(fore);
    await expect(h.tjanst.radera({ uid: AGARE, groupId: GRUPP, gastId: gastId("ingen@foretag.se") })).rejects.toMatchObject({ kod: "finns-inte" });
    await expect(h.tjanst.radera({ uid: ADMIN, groupId: GRUPP, gastId: gastId("anna@foretag.se") })).resolves.toMatchObject({ inbjudningar: 2 });
  });

  it("utan radering i tjänsten kastar radera och raderaMig i stället för att radera till hälften", async () => {
    const h = bygg({ utanGrupp: true });
    await h.tjanst.bjud({ uid: AGARE, handelseId: "h-mote", epost: "anna@foretag.se" });
    await expect(h.tjanst.radera({ uid: AGARE, groupId: GRUPP, gastId: gastId("anna@foretag.se") })).rejects.toThrow(/ingen radering/);
    expect(await h.grund.list("gastinbjudningar")).toHaveLength(1);
  });

  it("en avbruten radering går att köra om: raderna tas bort sist, så sessionerna syns tills allt annat är borta", async () => {
    const h = bygg();
    const { g } = await fullAvtryck(h);
    let felat = false;
    const trasig = bygg({
      omslut: (k) =>
        new Proxy(k, {
          get(mal, prop) {
            if (prop === "remove") return async (samling, id) => { if (samling === "gastinbjudningar" && !felat) { felat = true; throw new Error("avbrott"); } return mal.remove(samling, id); };
            return typeof mal[prop] === "function" ? mal[prop].bind(mal) : mal[prop];
          },
        }),
    });
    const t = await fullAvtryck(trasig);
    await expect(trasig.tjanst.radera({ uid: AGARE, groupId: GRUPP, gastId: gastId("anna@foretag.se") })).rejects.toThrow(/avbrott/);
    // Sessionerna och rösterna är borta men raderna finns kvar: raderingen går att köra om.
    expect((await trasig.grund.list("gastinbjudningar")).length).toBeGreaterThan(0);
    await expect(trasig.tjanst.radera({ uid: AGARE, groupId: GRUPP, gastId: gastId("anna@foretag.se") })).resolves.toMatchObject({ inbjudningar: expect.any(Number) });
    expect(await allt(trasig)).not.toContain("anna@foretag.se");
    expect(t.g.sessionsnyckel).toBeTruthy();
    expect(g.sessionsnyckel).toBeTruthy();
  });
});
