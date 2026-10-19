import { describe, it, expect } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { createFlyttaService, FLYTTFELKODER } from "../node/flytta.js";
import * as nod from "../node/index.js";
import { medlemskapsId } from "../lib/grupp.js";
import { byggGruppkalender, byggKalenderpost, byggMinKalender, gruppkalendernyckel } from "../lib/kalendrar.js";
import { handelsefel } from "../lib/handelsemodell.js";

/**
 * 0.123.0 (cllp/lifehub.app#371): servern som flyttar en post eller en händelse till en annan kalender.
 *
 * ⛔ Händelsen: CP 2026-10-19, GSEMS-händelsen i Barnveckor: "Det går dock inte att ändra en händelse. Vidare borde det gå att flytta en
 * händelse till en annan kalender." Provet läser DATAN efter anropet (posten, händelsen, medlemskapen), inte funktionsnamn, och varje
 * nekande prov kontrollerar BÅDE felkoden och att inget ändrades: ett nekande som kastar av ett annat skäl är ingen vakt (arbetsreglernas
 * punkt 4, närvarogrepp).
 */

const ANNA = "uid-anna";
const BERT = "uid-bert";
const CECIL = "uid-cecil";
const G = "bolaget";
const H = "grannarna";
const NU = new Date("2026-10-19T18:00:00.000Z");

/** @param {string} id @param {object} [extra] */
const gk = (id, extra = {}) => ({ ...byggGruppkalender({ id, namn: { sv: id }, farg: 2, ikon: "kalender", groupId: G, ...extra }), id: gruppkalendernyckel(extra.groupId ?? G, id) });
/** @param {string} id @param {object} [extra] */
const mk = (id, extra = {}) => byggMinKalender({ id, namn: id, farg: 3, ikon: "hjarta", ...extra });
/** @param {object} [extra] */
const post = (extra = {}) => ({ id: "tandlakare", ...byggKalenderpost({ id: "tandlakare", kalenderId: "privat", titel: "Tandläkaren", start: "2026-10-27T09:00", slut: "2026-10-27T10:00", ...extra }) });
const medl = (uid, gid, extra = {}) => ({ id: medlemskapsId(uid, gid), userId: uid, groupId: gid, roll: "medlem", typ: "person", status: "aktiv", ...extra });

/** Appens händelse, som lifehubs `byggHandelse`: rubrik, text, typ, vem och när. Tiden är inte appens. */
const appensHandelse = (/** @type {any} */ { post: p, uid, nu }) => ({ typ: "annat", rubrik: p.titel, ...(p.beskrivning ? { text: p.beskrivning } : {}), skapadAv: { uid }, skapad: nu.toISOString(), arkiverad: false });

/** @param {{ poster?: any[], handelser?: any[], medlemskap?: any[], mina?: any[], gruppkalendrar?: any[] }} [d] */
function bygg(d = {}) {
  const minne = createMemorySource({
    handelser: d.handelser ?? [],
    memberships: d.medlemskap ?? [medl(ANNA, G), medl(BERT, G), medl(ANNA, H)],
    gruppkalendrar: d.gruppkalendrar ?? [gk("kalender", { forvald: true }), gk("barnveckor", { ordning: 10 }), gk("gammal", { ordning: 20, arkiverad: true }), gk("hos-dem", { groupId: H, forvald: true })],
    [`users/${ANNA}/kalenderposter`]: d.poster ?? [post()],
    [`users/${ANNA}/minaKalendrar`]: d.mina ?? [mk("privat", { forvald: true }), mk("jobb", { ordning: 10 }), mk("gammal", { ordning: 20, arkiverad: true })],
    [`users/${BERT}/kalenderposter`]: [],
    [`users/${BERT}/minaKalendrar`]: [mk("privat", { forvald: true }), mk("jobb", { ordning: 10 })],
  });
  /** @type {any[][]} */
  const batcher = [];
  const kalla = /** @type {any} */ ({ ...minne, batch: async (/** @type {any[]} */ ops) => { batcher.push(ops); return minne.batch?.(ops); } });
  const tjanst = createFlyttaService({ kalla, samlingar: { handelser: "handelser" }, byggHandelse: appensHandelse, klocka: () => NU });
  return { minne, kalla, batcher, tjanst };
}

const kod = async (/** @type {Promise<any>} */ p) => {
  try {
    await p;
  } catch (e) {
    return /** @type {any} */ (e).kod ?? `utan-kod: ${/** @type {Error} */ (e).message}`;
  }
  return "inget fel";
};

const lasPost = (/** @type {any} */ minne, uid = ANNA, id = "tandlakare") => minne.read(`users/${uid}/kalenderposter`, id);

describe("flyttaPost: en post byter egen kalender", () => {
  it("kalendern byts på posten, resten är orört", async () => {
    const { minne, tjanst } = bygg();
    const svar = await tjanst.flyttaPost({ uid: ANNA, postId: "tandlakare", tillKalenderId: "jobb" });
    expect(svar).toEqual({ atgard: "byt", postId: "tandlakare", kalenderId: "jobb" });
    const efter = await lasPost(minne);
    expect(efter).toEqual({ ...post(), kalenderId: "jobb" });
  });

  it("⛔ en annans post nås inte: Bert kan inte flytta Annas post, och posten ligger kvar", async () => {
    const { minne, tjanst } = bygg();
    expect(await kod(tjanst.flyttaPost({ uid: BERT, postId: "tandlakare", tillKalenderId: "jobb" }))).toBe("finns-inte");
    expect((await lasPost(minne)).kalenderId).toBe("privat");
  });

  it("⛔ till en kalender som inte finns, en annans, eller en arkiverad: nekas och posten ligger kvar", async () => {
    const { minne, tjanst } = bygg();
    for (const mal of ["saknas", "gammal"]) {
      expect(await kod(tjanst.flyttaPost({ uid: ANNA, postId: "tandlakare", tillKalenderId: mal }))).toBe("ogiltigt-mal");
    }
    // Bert har en kalender "jobb", Anna har också en: "annans" betyder en som bara den andra har.
    const b = bygg({ mina: [mk("privat", { forvald: true })] });
    expect(await kod(b.tjanst.flyttaPost({ uid: ANNA, postId: "tandlakare", tillKalenderId: "jobb" }))).toBe("ogiltigt-mal");
    expect((await lasPost(minne)).kalenderId).toBe("privat");
    expect((await lasPost(b.minne)).kalenderId).toBe("privat");
  });

  it("till kalendern den redan ligger i: nekas, ingen skrivning", async () => {
    const { tjanst } = bygg();
    expect(await kod(tjanst.flyttaPost({ uid: ANNA, postId: "tandlakare", tillKalenderId: "privat" }))).toBe("ogiltigt-mal");
  });

  it("en post som inte finns", async () => {
    const { tjanst } = bygg();
    expect(await kod(tjanst.flyttaPost({ uid: ANNA, postId: "saknas", tillKalenderId: "jobb" }))).toBe("finns-inte");
  });
});

describe("flyttaHandelse: en händelse byter kalender i samma grupp", () => {
  const handelse = (extra = {}) => ({ id: "h1", groupId: G, rubrik: "GSEMS", datum: "2026-10-30", typ: "annat", arkiverad: false, kalenderId: "kalender", skapadAv: { uid: ANNA }, skapad: "2026-10-01T00:00:00.000Z", ...extra });

  it("kalendern byts, resten av händelsen är orört", async () => {
    const { minne, tjanst } = bygg({ handelser: [handelse()] });
    const svar = await tjanst.flyttaHandelse({ uid: BERT, handelseId: "h1", tillKalenderId: "barnveckor" });
    expect(svar).toEqual({ atgard: "byt", handelseId: "h1", groupId: G, kalenderId: "barnveckor" });
    expect(await minne.read("handelser", "h1")).toEqual(handelse({ kalenderId: "barnveckor" }));
  });

  it("⛔ den som inte är medlem i gruppen nekas, och händelsen ligger kvar", async () => {
    const { minne, tjanst } = bygg({ handelser: [handelse()] });
    expect(await kod(tjanst.flyttaHandelse({ uid: CECIL, handelseId: "h1", tillKalenderId: "barnveckor" }))).toBe("ej-behorig");
    // En medlem i en ANNAN grupp (Anna är med i grannarna) räknas inte: medlemskapet slås upp i händelsens grupp.
    const b = bygg({ handelser: [handelse()], medlemskap: [medl(CECIL, H)] });
    expect(await kod(b.tjanst.flyttaHandelse({ uid: CECIL, handelseId: "h1", tillKalenderId: "barnveckor" }))).toBe("ej-behorig");
    expect((await minne.read("handelser", "h1")).kalenderId).toBe("kalender");
    expect((await b.minne.read("handelser", "h1")).kalenderId).toBe("kalender");
  });

  it("⛔ ett avslutat medlemskap och en agent får inte flytta", async () => {
    for (const extra of [{ status: "avslutad" }, { typ: "agent" }]) {
      const { minne, tjanst } = bygg({ handelser: [handelse()], medlemskap: [medl(BERT, G, extra)] });
      expect(await kod(tjanst.flyttaHandelse({ uid: BERT, handelseId: "h1", tillKalenderId: "barnveckor" }))).toBe("ej-behorig");
      expect((await minne.read("handelser", "h1")).kalenderId).toBe("kalender");
    }
  });

  it("⛔ appens egen regel (farRedigera) kan vara snävare, och prövas efter medlemskapet", async () => {
    const { minne, kalla } = bygg({ handelser: [handelse()] });
    /** @type {any[]} */
    const anrop = [];
    const tjanst = createFlyttaService({
      kalla,
      samlingar: { handelser: "handelser" },
      byggHandelse: appensHandelse,
      farRedigera: async (a) => {
        anrop.push(a);
        return a.handelse.skapadAv.uid === a.uid;
      },
    });
    expect(await kod(tjanst.flyttaHandelse({ uid: BERT, handelseId: "h1", tillKalenderId: "barnveckor" }))).toBe("ej-behorig");
    expect((await minne.read("handelser", "h1")).kalenderId).toBe("kalender");
    await tjanst.flyttaHandelse({ uid: ANNA, handelseId: "h1", tillKalenderId: "barnveckor" });
    expect((await minne.read("handelser", "h1")).kalenderId).toBe("barnveckor");
    // Cecil är inte medlem: appens regel frågas inte ens (medlemskapet först), annars hade ett tillåtande svar släppt in henne.
    expect(anrop.map((a) => a.uid)).toEqual([BERT, ANNA]);
    expect(anrop[0]).toMatchObject({ groupId: G, medlemskap: { userId: BERT } });
    expect(await kod(tjanst.flyttaHandelse({ uid: CECIL, handelseId: "h1", tillKalenderId: "kalender" }))).toBe("ej-behorig");
    expect(anrop).toHaveLength(2);
  });

  it("⛔ aldrig till en annan grupps kalender och aldrig till en egen: händelsen stannar i gruppen", async () => {
    const { minne, tjanst } = bygg({ handelser: [handelse()] });
    // "hos-dem" finns bara i grannarna: nyckeln är grupp|id, så den finns inte i bolaget.
    expect(await kod(tjanst.flyttaHandelse({ uid: ANNA, handelseId: "h1", tillKalenderId: "hos-dem" }))).toBe("ogiltigt-mal");
    // "privat" är en av Annas egna kalendrar, inte en gruppkalender.
    expect(await kod(tjanst.flyttaHandelse({ uid: ANNA, handelseId: "h1", tillKalenderId: "privat" }))).toBe("ogiltigt-mal");
    expect(await kod(tjanst.flyttaHandelse({ uid: ANNA, handelseId: "h1", tillKalenderId: "gammal" }))).toBe("ogiltigt-mal");
    expect(await minne.read("handelser", "h1")).toEqual(handelse());
    expect(await minne.list("users/uid-anna/kalenderposter")).toHaveLength(1);
  });

  it("en händelse utan kalenderId ligger i gruppens förvalda: dit flyttas den inte, men till en annan", async () => {
    const { minne, tjanst } = bygg({ handelser: [(({ kalenderId: _k, ...h }) => h)(handelse())] });
    expect(await kod(tjanst.flyttaHandelse({ uid: ANNA, handelseId: "h1", tillKalenderId: "kalender" }))).toBe("ogiltigt-mal");
    await tjanst.flyttaHandelse({ uid: ANNA, handelseId: "h1", tillKalenderId: "barnveckor" });
    expect((await minne.read("handelser", "h1")).kalenderId).toBe("barnveckor");
  });

  it("⛔ en arkiverad händelse flyttas inte, och en som inte finns ger finns-inte", async () => {
    const { minne, tjanst } = bygg({ handelser: [handelse({ arkiverad: true })] });
    expect(await kod(tjanst.flyttaHandelse({ uid: ANNA, handelseId: "h1", tillKalenderId: "barnveckor" }))).toBe("ogiltigt-mal");
    expect((await minne.read("handelser", "h1")).kalenderId).toBe("kalender");
    expect(await kod(tjanst.flyttaHandelse({ uid: ANNA, handelseId: "saknas", tillKalenderId: "barnveckor" }))).toBe("finns-inte");
  });
});

describe("goraPostTillHandelse: en post blir en gruppens händelse, i en batch", () => {
  it("händelsen skapas med postens id, tid, grupp och kalender, och posten är borta", async () => {
    const { minne, batcher, tjanst } = bygg({ poster: [post({ beskrivning: "Ta med kortet" })] });
    const svar = await tjanst.goraPostTillHandelse({ uid: ANNA, postId: "tandlakare", groupId: G, tillKalenderId: "barnveckor" });
    expect(svar).toEqual({ atgard: "konvertera", handelseId: "tandlakare", groupId: G, kalenderId: "barnveckor" });
    expect(await minne.read("handelser", "tandlakare")).toEqual({
      id: "tandlakare",
      typ: "annat",
      rubrik: "Tandläkaren",
      text: "Ta med kortet",
      skapadAv: { uid: ANNA },
      skapad: NU.toISOString(),
      arkiverad: false,
      datum: "2026-10-27",
      tid: "09:00",
      slutTid: "10:00",
      groupId: G,
      kalenderId: "barnveckor",
    });
    expect(await lasPost(minne)).toBeNull();
    // ⛔ EN BATCH MED BÅDA SKRIVNINGARNA, i den ordningen: provet läser vad som skickades, inte om funktionen finns.
    expect(batcher).toHaveLength(1);
    expect(batcher[0].map((/** @type {any} */ o) => `${o.op}:${o.collection}`)).toEqual(["create:handelser", "remove:users/uid-anna/kalenderposter"]);
  });

  it("⛔ tiden är postens och inte appens: en heldag över flera dagar, och en app som försöker skriva egna tidsfält", async () => {
    const { minne, kalla } = bygg({ poster: [post({ heldag: true, start: "2026-12-23", slut: "2026-12-26" })] });
    const tjanst = createFlyttaService({
      kalla,
      samlingar: { handelser: "handelser" },
      byggHandelse: (a) => ({ ...appensHandelse(a), datum: "1999-01-01", tid: "03:00", slutTid: "04:00", heldag: false, slutDatum: "2000-01-01", groupId: "fel", kalenderId: "fel", id: "fel" }),
    });
    await tjanst.goraPostTillHandelse({ uid: ANNA, postId: "tandlakare", groupId: G, tillKalenderId: "kalender" });
    const h = await minne.read("handelser", "tandlakare");
    expect(h).toMatchObject({ id: "tandlakare", datum: "2026-12-23", slutDatum: "2026-12-26", heldag: true, groupId: G, kalenderId: "kalender" });
    expect("tid" in h).toBe(false);
    expect("slutTid" in h).toBe(false);
  });

  it("tiden går igenom händelsemodellens egna kontroll för varje form en post kan ha", async () => {
    const former = [
      post(),
      post({ slut: "2026-10-27T09:00" }),
      post({ start: "2026-10-27T22:00", slut: "2026-10-28T02:00" }),
      post({ heldag: true, start: "2026-10-27", slut: "2026-10-27" }),
      post({ heldag: true, start: "2026-10-27", slut: "2026-10-30" }),
    ];
    for (const p of former) {
      const { minne, tjanst } = bygg({ poster: [p] });
      await tjanst.goraPostTillHandelse({ uid: ANNA, postId: "tandlakare", groupId: G, tillKalenderId: "kalender" });
      const h = await minne.read("handelser", "tandlakare");
      expect(handelsefel(h, {})).toEqual([]);
    }
  });

  it("⛔ MEDLEMSKAP I MÅLGRUPPEN KRÄVS: den som inte är med nekas, och posten ligger kvar och ingen händelse skrevs", async () => {
    const { minne, batcher, tjanst } = bygg({ medlemskap: [medl(ANNA, H)] });
    // Anna är med i grannarna men inte i bolaget.
    expect(await kod(tjanst.goraPostTillHandelse({ uid: ANNA, postId: "tandlakare", groupId: G, tillKalenderId: "barnveckor" }))).toBe("ej-behorig");
    expect((await lasPost(minne))?.kalenderId).toBe("privat");
    expect(await minne.list("handelser")).toEqual([]);
    expect(batcher).toEqual([]);
  });

  it("⛔ ett avslutat medlemskap och en agent nekas", async () => {
    for (const extra of [{ status: "avslutad" }, { status: "avstangd" }, { typ: "agent" }]) {
      const { minne, tjanst } = bygg({ medlemskap: [medl(ANNA, G, extra)] });
      expect(await kod(tjanst.goraPostTillHandelse({ uid: ANNA, postId: "tandlakare", groupId: G, tillKalenderId: "barnveckor" }))).toBe("ej-behorig");
      expect(await lasPost(minne)).not.toBeNull();
      expect(await minne.list("handelser")).toEqual([]);
    }
  });

  it("⛔ appens regel om vem som får skapa (farSkapa) kan vara snävare, men släpper aldrig in en icke-medlem", async () => {
    const { minne, kalla } = bygg({ medlemskap: [medl(ANNA, G, { roll: "medlem" }), medl(BERT, G, { roll: "admin" })] });
    const tjanst = createFlyttaService({ kalla, samlingar: { handelser: "handelser" }, byggHandelse: appensHandelse, farSkapa: async (a) => a.medlemskap.roll === "admin" });
    expect(await kod(tjanst.goraPostTillHandelse({ uid: ANNA, postId: "tandlakare", groupId: G, tillKalenderId: "barnveckor" }))).toBe("ej-behorig");
    expect(await lasPost(minne)).not.toBeNull();
    expect(await minne.list("handelser")).toEqual([]);
  });

  it("⛔ posten måste vara personens egen: Bert har ingen post att göra till en händelse, Annas ligger kvar", async () => {
    const { minne, tjanst } = bygg();
    expect(await kod(tjanst.goraPostTillHandelse({ uid: BERT, postId: "tandlakare", groupId: G, tillKalenderId: "barnveckor" }))).toBe("finns-inte");
    expect(await lasPost(minne)).not.toBeNull();
    expect(await minne.list("handelser")).toEqual([]);
  });

  it("⛔ målkalendern måste höra till gruppen, vara en gruppkalender och inte vara arkiverad", async () => {
    const { minne, tjanst } = bygg();
    // "hos-dem" är grannarnas kalender, "privat" är Annas egen, "gammal" är arkiverad i bolaget.
    for (const mal of ["hos-dem", "privat", "gammal", "saknas"]) {
      expect(await kod(tjanst.goraPostTillHandelse({ uid: ANNA, postId: "tandlakare", groupId: G, tillKalenderId: mal }))).toBe("ogiltigt-mal");
    }
    expect(await lasPost(minne)).not.toBeNull();
    expect(await minne.list("handelser")).toEqual([]);
  });

  it("⛔ ALLT ELLER INGET: faller batchen finns posten kvar och ingen händelse skrevs", async () => {
    const { minne, kalla } = bygg();
    const trasig = /** @type {any} */ ({ ...kalla, batch: async (/** @type {any[]} */ ops) => minne.batch?.([...ops.slice(0, 1), { op: "update", collection: "handelser", id: "finns-inte", data: {} }]) });
    const tjanst = createFlyttaService({ kalla: trasig, samlingar: { handelser: "handelser" }, byggHandelse: appensHandelse });
    await expect(tjanst.goraPostTillHandelse({ uid: ANNA, postId: "tandlakare", groupId: G, tillKalenderId: "barnveckor" })).rejects.toThrow();
    expect(await lasPost(minne)).not.toBeNull();
    expect(await minne.list("handelser")).toEqual([]);
  });

  it("⛔ två anrop för samma post ger EN händelse (nyckeln är postens id), och det andra anropet finner ingen post", async () => {
    const { minne, tjanst } = bygg();
    const a = { uid: ANNA, postId: "tandlakare", groupId: G, tillKalenderId: "barnveckor" };
    await tjanst.goraPostTillHandelse(a);
    expect(await kod(tjanst.goraPostTillHandelse(a))).toBe("finns-inte");
    expect(await minne.list("handelser")).toHaveLength(1);
  });

  it("⛔ skriver aldrig över en annan händelse som har samma id", async () => {
    const { minne, tjanst } = bygg({ handelser: [{ id: "tandlakare", groupId: H, rubrik: "Någon annans", datum: "2026-01-01", typ: "annat", arkiverad: false }] });
    expect(await kod(tjanst.goraPostTillHandelse({ uid: ANNA, postId: "tandlakare", groupId: G, tillKalenderId: "barnveckor" }))).toBe("ogiltigt-mal");
    expect((await minne.read("handelser", "tandlakare")).rubrik).toBe("Någon annans");
    expect(await lasPost(minne)).not.toBeNull();
  });

  it("en rad som inte blir en giltig händelse stoppas innan något skrivs", async () => {
    const { minne, kalla } = bygg();
    const tjanst = createFlyttaService({ kalla, samlingar: { handelser: "handelser" }, byggHandelse: () => /** @type {any} */ (null) });
    expect(await kod(tjanst.goraPostTillHandelse({ uid: ANNA, postId: "tandlakare", groupId: G, tillKalenderId: "barnveckor" }))).toBe("ogiltig-rad");
    expect(await lasPost(minne)).not.toBeNull();
    expect(await minne.list("handelser")).toEqual([]);
  });
});

describe("tjänsten bygger inte med fel indata", () => {
  it("samlingsnamnen skickas in: appens händelsesamling har inget förval, och en annan samling används av alla tre flytter", async () => {
    const { minne, kalla } = bygg();
    expect(() => createFlyttaService({ kalla, samlingar: /** @type {any} */ ({}), byggHandelse: appensHandelse })).toThrow(/samlingar\.handelser/);
    const k2 = createMemorySource({
      kalender_x: [gk("kalender", { forvald: true })],
      medlemmar_x: [medl(ANNA, G)],
      gruppkal_x: [gk("kalender", { forvald: true }), gk("barnveckor")],
      [`personer/${ANNA}/poster_x`]: [post()],
      [`personer/${ANNA}/mina_x`]: [mk("privat", { forvald: true }), mk("jobb")],
    });
    const tjanst = createFlyttaService({
      kalla: k2,
      samlingar: { handelser: "kalender_x", medlemskap: "medlemmar_x", gruppkalendrar: "gruppkal_x", anvandare: "personer", kalenderposter: "poster_x", minaKalendrar: "mina_x" },
      byggHandelse: appensHandelse,
    });
    await tjanst.flyttaPost({ uid: ANNA, postId: "tandlakare", tillKalenderId: "jobb" });
    expect((await k2.read(`personer/${ANNA}/poster_x`, "tandlakare")).kalenderId).toBe("jobb");
    await tjanst.goraPostTillHandelse({ uid: ANNA, postId: "tandlakare", groupId: G, tillKalenderId: "barnveckor" });
    expect((await k2.read("kalender_x", "tandlakare")).kalenderId).toBe("barnveckor");
    expect(await k2.list(`personer/${ANNA}/poster_x`)).toEqual([]);
    // De ramverkets förvalda samlingar rördes inte.
    expect(await minne.list("handelser")).toEqual([]);
    expect(() => createFlyttaService({ kalla, samlingar: { handelser: "a/b" }, byggHandelse: appensHandelse })).toThrow(/samlingsnamn/);
  });

  it("⛔ en källa utan batch nekas när tjänsten byggs, inte först när en post ska flyttas", () => {
    const { minne } = bygg();
    const { batch: _bortsett, ...utanBatch } = /** @type {any} */ (minne);
    expect(() => createFlyttaService({ kalla: utanBatch, samlingar: { handelser: "handelser" }, byggHandelse: appensHandelse })).toThrow(/batch/);
  });

  it("byggHandelse krävs, policyfunktionerna måste vara funktioner, och anropen kräver sina fält", async () => {
    const { kalla, tjanst } = bygg();
    expect(() => createFlyttaService({ kalla, samlingar: { handelser: "handelser" }, byggHandelse: /** @type {any} */ (undefined) })).toThrow(/byggHandelse/);
    expect(() => createFlyttaService({ kalla, samlingar: { handelser: "handelser" }, byggHandelse: appensHandelse, farRedigera: /** @type {any} */ (true) })).toThrow(/farRedigera/);
    expect(() => createFlyttaService({ kalla, samlingar: { handelser: "handelser" }, byggHandelse: appensHandelse, farSkapa: /** @type {any} */ ("ja") })).toThrow(/farSkapa/);
    await expect(tjanst.flyttaPost(/** @type {any} */ ({ uid: ANNA, postId: "tandlakare" }))).rejects.toThrow(/tillKalenderId/);
    await expect(tjanst.flyttaHandelse(/** @type {any} */ ({ uid: "", handelseId: "h1", tillKalenderId: "x" }))).rejects.toThrow(/uid/);
    await expect(tjanst.goraPostTillHandelse(/** @type {any} */ ({ uid: ANNA, postId: "tandlakare", tillKalenderId: "x" }))).rejects.toThrow(/groupId/);
  });

  it("felkoderna är fyra och exporteras, och tjänsten ligger bara i nodingången", async () => {
    expect([...FLYTTFELKODER]).toEqual(["finns-inte", "ej-behorig", "ogiltigt-mal", "ogiltig-rad"]);
    expect(typeof nod.createFlyttaService).toBe("function");
    expect(nod.FLYTTFELKODER).toBe(FLYTTFELKODER);
    const huvud = await import("../index.js");
    expect("createFlyttaService" in huvud).toBe(false);
    expect(typeof huvud.flyttmal).toBe("function");
  });
});
