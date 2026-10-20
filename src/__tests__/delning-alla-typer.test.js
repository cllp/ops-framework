import { describe, expect, it, vi } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { medlemskapsId } from "../lib/grupp.js";
import { mittBibliotek } from "../lib/bibliotek.js";
import {
  ANTECKNINGSSVARSFALT,
  DELNINGSSVARSFALT,
  LANKSVARSFALT,
  LISTRADSKAL,
  LISTSVARSFALT,
  MAX_DELADE_LISTPOSTER,
} from "../lib/delning.js";
import { createDelningService } from "../node/delning.js";

/**
 * Publik länk till ALLA fyra typer (0.133.0, lifehub.app#356). CP 2026-10-18: "Vi skall ju ha en publik länk till varje artefakt med option på att den som ser kan ladda ner."
 * CP 2026-10-20: "EN lista måste kunna delas ... alla sakerna i listan delas", och: "Ändras listan kan den ju bara ändras för alla som den delas med. Om en låt tas bort kan den bara
 * tas bort precis som för den som skapade den."
 *
 * ⛔ UTAN NÄTVERK OCH UTAN FIREBASE, som `delning.test.js`. Varje prov har bevisats rött utan ändringen och grönt med den (utfallen står i PR-texten).
 */

const NU = 1_800_000_000_000;
const GRUPP = "kallan";
const ANNAN_GRUPP = "grannen";
const AGARE = "uid-agare";
const ADMIN = "uid-admin";
const MEDLEM = "uid-medlem";
const ANNAN = "uid-annan";
const HEMLIG = "HEMLIG-TAGG";

const medlemskap = (uid, groupId, roll) => ({ id: medlemskapsId(uid, groupId), userId: uid, groupId, roll, typ: "person", status: "aktiv", namn: `Namn ${uid}` });
const av = (uid) => ({ uid, namn: "Skaparen", typ: "manniska", kalla: "bibliotek" });
const grund = (id, typ, groupId, uid, extra) => ({ id, typ, groupId, rubrik: `Rubrik ${id}`, skapadAv: av(uid), skapad: NU - 1000, andrad: NU - 1000, taggar: [HEMLIG], ...extra });
const ljud = (id, groupId = GRUPP, uid = MEDLEM, extra = {}) =>
  grund(id, "fil", groupId, uid, { fil: { sokvag: `grupper/${groupId}/bibliotek/${id}/${id}.mp3`, namn: `${id}.mp3`, mime: "audio/mpeg", byte: 4_000_000, klar: true }, durationMs: 180000, utskrift: "Hemlig utskrift", ...extra });
const pdf = (id, groupId = GRUPP, uid = MEDLEM) =>
  grund(id, "fil", groupId, uid, { fil: { sokvag: `grupper/${groupId}/bibliotek/${id}/${id}.pdf`, namn: `${id}.pdf`, mime: "application/pdf", byte: 2048, klar: true } });
const anteckning = (id, groupId = GRUPP, uid = MEDLEM, extra = {}) => grund(id, "anteckning", groupId, uid, { text: `Text i ${id}\nandra raden`, ...extra });
const lank = (id, url = "https://exempel.se/sida", groupId = GRUPP, uid = MEDLEM, extra = {}) => grund(id, "lank", groupId, uid, { url, kalla: "annat", bild: "https://bilder.exempel.se/omslag.jpg", ...extra });
const lista = (id, poster, groupId = GRUPP, uid = MEDLEM, extra = {}) => grund(id, "lista", groupId, uid, { poster, ...extra });

function bygg({ poster = [], omslut = (k) => k } = {}) {
  const grundkalla = createMemorySource({
    memberships: [
      medlemskap(AGARE, GRUPP, "agare"),
      medlemskap(ADMIN, GRUPP, "admin"),
      medlemskap(MEDLEM, GRUPP, "medlem"),
      medlemskap(ANNAN, GRUPP, "medlem"),
      medlemskap("uid-utanfor", ANNAN_GRUPP, "agare"),
    ],
    bibliotek: [
      anteckning("a1"),
      lank("k1"),
      ljud("s1"),
      ljud("s2"),
      pdf("d1"),
      ...poster,
    ],
    delningar: [],
  });
  const kalla = omslut(grundkalla);
  const signeradAdress = vi.fn(async ({ sokvag, sekunder, disposition }) => `https://lagring.test/${sokvag}?s=${sekunder}&d=${encodeURIComponent(disposition)}`);
  const tjanst = createDelningService({ kalla, lagring: { signeradAdress }, samlingar: { delningar: "delningar", bibliotek: "bibliotek" }, klocka: () => NU });
  return { kalla: grundkalla, tjanst, signeradAdress };
}

let nr = 0;
/** Delar en post som MEDLEM (om inget annat sägs) och ger adressen. */
const dela = async (tjanst, postId, extra = {}) =>
  (await tjanst.skapa({ uid: MEDLEM, postId, groupId: GRUPP, dagar: 7, gruppdel: "kallan-grupp", fildel: `del-${nr++}`, ...extra })).adress;
const hamta = async (tjanst, postId, extra = {}) => {
  const svar = await tjanst.hamta(await dela(tjanst, postId, extra));
  expect(svar.ok, `${postId}: ${JSON.stringify(svar)}`).toBe(true);
  return svar.delning;
};

describe("anteckning: rubrik och texten, inget annat", () => {
  it("svaret har exakt ANTECKNINGSSVARSFALT och läcker ingenting om posten", async () => {
    const { tjanst } = bygg();
    const d = await hamta(tjanst, "a1");
    expect(Object.keys(d).sort()).toEqual([...ANTECKNINGSSVARSFALT].sort());
    expect(d).toEqual({ typ: "anteckning", rubrik: "Rubrik a1", text: "Text i a1\nandra raden" });
    const text = JSON.stringify(d);
    for (const forbjudet of [HEMLIG, MEDLEM, GRUPP, "Namn", "Skaparen"]) expect(text, forbjudet).not.toContain(forbjudet);
  });

  it("en ändrad anteckning syns vid nästa besök (inget är kopierat)", async () => {
    const { tjanst, kalla } = bygg();
    const ref = await dela(tjanst, "a1");
    await kalla.update("bibliotek", "a1", { text: "Ny text", rubrik: "Nytt namn" });
    expect((await tjanst.hamta(ref)).delning).toEqual({ typ: "anteckning", rubrik: "Nytt namn", text: "Ny text" });
  });

  it("en raderad anteckning svarar 'saknas', utan rubrik eller text", async () => {
    const { tjanst, kalla } = bygg();
    const ref = await dela(tjanst, "a1");
    await kalla.remove("bibliotek", "a1");
    expect(await tjanst.hamta(ref)).toEqual({ ok: false, orsak: "saknas" });
  });

  it("⛔ nedladdning går inte att slå på för en anteckning, varken vid skapandet eller efteråt", async () => {
    const { tjanst, kalla } = bygg();
    await expect(dela(tjanst, "a1", { nedladdning: true })).rejects.toThrow(/ingenting att ladda ner/);
    expect(await kalla.list("delningar")).toHaveLength(0);
    const { id } = await tjanst.skapa({ uid: MEDLEM, postId: "a1", groupId: GRUPP, dagar: 7, gruppdel: "kallan-grupp", fildel: "x" });
    await expect(tjanst.andraNedladdning({ uid: MEDLEM, id, nedladdning: true })).rejects.toThrow(/ingenting att ladda ner/);
    expect((await kalla.read("delningar", id)).nedladdning).toBe(false);
  });
});

describe("länk: rubrik och adressen, bara http och https", () => {
  it("svaret har exakt LANKSVARSFALT: inte källan, inte omslaget, inte vem som la till den", async () => {
    const { tjanst } = bygg();
    const d = await hamta(tjanst, "k1");
    expect(Object.keys(d).sort()).toEqual([...LANKSVARSFALT].sort());
    expect(d).toEqual({ typ: "lank", rubrik: "Rubrik k1", url: "https://exempel.se/sida" });
    const text = JSON.stringify(d);
    for (const forbjudet of ["bilder.exempel.se", "annat", HEMLIG, MEDLEM, GRUPP]) expect(text, forbjudet).not.toContain(forbjudet);
  });

  it("⛔ en länk med en annan adress än http eller https delas aldrig, och en som blivit det efteråt öppnas aldrig", async () => {
    const { tjanst, kalla } = bygg({ poster: [lank("farlig", "javascript:alert(1)"), lank("ftp", "ftp://exempel.se/fil")] });
    for (const postId of ["farlig", "ftp"]) await expect(dela(tjanst, postId), postId).rejects.toThrow(/går inte att dela/);
    const ref = await dela(tjanst, "k1");
    await kalla.update("bibliotek", "k1", { url: "javascript:alert(1)" });
    const svar = await tjanst.hamta(ref);
    expect(svar).toEqual({ ok: false, orsak: "saknas" });
    expect(JSON.stringify(svar)).not.toContain("javascript");
  });
});

describe("lista: hela listan delas, som en spellista", () => {
  const spellista = () => lista("l1", ["s1", "a1", "k1", "d1"], GRUPP, MEDLEM);

  it("svaret har exakt LISTSVARSFALT, och posterna kommer i listans ordning med sin typ", async () => {
    const { tjanst } = bygg({ poster: [spellista()] });
    const d = await hamta(tjanst, "l1");
    expect(Object.keys(d).sort()).toEqual([...LISTSVARSFALT].sort());
    expect(d).toMatchObject({ typ: "lista", rubrik: "Rubrik l1", nedladdning: false, ejVisade: 0 });
    expect(d.poster.map((p) => p.typ)).toEqual(["ljud", "anteckning", "lank", "pdf"]);
    expect(d.poster.map((p) => p.rubrik)).toEqual(["Rubrik s1", "Rubrik a1", "Rubrik k1", "Rubrik d1"]);
  });

  it("⛔ varje post har SAMMA vitlistade fält som om den delats ensam (plus en ogenomskinlig nyckel)", async () => {
    const { tjanst } = bygg({ poster: [spellista()] });
    const d = await hamta(tjanst, "l1");
    const ensamt = { s1: await hamta(tjanst, "s1"), a1: await hamta(tjanst, "a1"), k1: await hamta(tjanst, "k1"), d1: await hamta(tjanst, "d1") };
    const [s, a, k, p] = d.poster;
    for (const [rad, ensam] of [[s, ensamt.s1], [a, ensamt.a1], [k, ensamt.k1], [p, ensamt.d1]]) {
      const { id, ...utanNyckel } = rad;
      expect(typeof id).toBe("string");
      expect(utanNyckel).toEqual(ensam);
    }
    expect(Object.keys(s).sort()).toEqual(["id", ...DELNINGSSVARSFALT].sort());
    expect(Object.keys(a).sort()).toEqual(["id", ...ANTECKNINGSSVARSFALT].sort());
    expect(Object.keys(k).sort()).toEqual(["id", ...LANKSVARSFALT].sort());
  });

  it("⛔ en fil i listan får en egen signerad adress som gäller 15 minuter", async () => {
    const { tjanst, signeradAdress } = bygg({ poster: [lista("l2", ["s1", "s2"])] });
    signeradAdress.mockClear();
    const d = await hamta(tjanst, "l2");
    expect(d.poster.map((p) => p.url)).toEqual([expect.stringContaining("/s1.mp3?s=900"), expect.stringContaining("/s2.mp3?s=900")]);
    expect(new Set(d.poster.map((p) => p.url)).size).toBe(2);
    expect(signeradAdress).toHaveBeenCalledTimes(2);
  });

  it("⛔ nedladdningsvalet gäller varje fil i listan: av ger inline, på ger attachment och en visa-adress för en PDF", async () => {
    const { tjanst } = bygg({ poster: [lista("l3", ["s1", "d1", "a1"])] });
    const av_ = await hamta(tjanst, "l3");
    expect(av_.nedladdning).toBe(false);
    for (const p of av_.poster.filter((r) => r.url && r.mime)) {
      expect(p.nedladdning).toBe(false);
      expect(p.url).toContain("d=inline");
    }
    const pa = await hamta(tjanst, "l3", { nedladdning: true });
    expect(pa.nedladdning).toBe(true);
    const filer = pa.poster.filter((r) => r.mime);
    expect(filer).toHaveLength(2);
    for (const p of filer) {
      expect(p.nedladdning).toBe(true);
      expect(decodeURIComponent(p.url)).toContain("attachment");
    }
    expect(filer.find((p) => p.typ === "pdf")?.visaUrl).toContain("d=inline");
  });

  it("⛔ listan är en LEVANDE SPEGEL: en post som tas ur listan saknas i nästa svar, och ordningen följer med", async () => {
    const { tjanst, kalla } = bygg({ poster: [spellista()] });
    const ref = await dela(tjanst, "l1");
    expect((await tjanst.hamta(ref)).delning.poster.map((p) => p.rubrik)).toEqual(["Rubrik s1", "Rubrik a1", "Rubrik k1", "Rubrik d1"]);
    // Ta bort anteckningen ur listan: den finns kvar som post men syns inte för mottagaren.
    await kalla.update("bibliotek", "l1", { poster: ["s1", "k1", "d1"] });
    const efterBorttag = (await tjanst.hamta(ref)).delning.poster;
    expect(efterBorttag.map((p) => p.rubrik)).toEqual(["Rubrik s1", "Rubrik k1", "Rubrik d1"]);
    expect(JSON.stringify(efterBorttag)).not.toContain("Rubrik a1");
    expect(await kalla.read("bibliotek", "a1")).not.toBeNull();
    // Byt ordning: svaret följer efter.
    await kalla.update("bibliotek", "l1", { poster: ["d1", "k1", "s1"] });
    expect((await tjanst.hamta(ref)).delning.poster.map((p) => p.rubrik)).toEqual(["Rubrik d1", "Rubrik k1", "Rubrik s1"]);
    // Lägg till en post.
    await kalla.update("bibliotek", "l1", { poster: ["d1", "k1", "s1", "s2"] });
    expect((await tjanst.hamta(ref)).delning.poster.map((p) => p.rubrik)).toEqual(["Rubrik d1", "Rubrik k1", "Rubrik s1", "Rubrik s2"]);
  });

  it("⛔ ingen ögonblicksbild: delningsraden bär varken poster eller rubriker ur listan", async () => {
    const { tjanst, kalla } = bygg({ poster: [spellista()] });
    const { id } = await tjanst.skapa({ uid: MEDLEM, postId: "l1", groupId: GRUPP, dagar: 7, gruppdel: "kallan-grupp", fildel: "spel" });
    const rad = await kalla.read("delningar", id);
    expect(rad.postId).toBe("l1");
    expect(Object.keys(rad)).not.toContain("poster");
    // Exakt samma fält som en fildelning: inget har tillkommit för att bära listan.
    expect(Object.keys(rad).sort()).toEqual(["adress", "aterkallad", "felAntal", "felFonster", "giltigTill", "groupId", "id", "nedladdning", "postId", "rattighet", "skapad", "skapadAv", "slag"]);
    for (const id of ["s1", "a1", "k1", "d1"]) expect(JSON.stringify(rad)).not.toContain(`"${id}"`);
    expect(JSON.stringify(rad)).not.toContain("Rubrik");
  });

  it("en lista som får ett nytt namn visas med det, och en raderad lista svarar 'saknas'", async () => {
    const { tjanst, kalla } = bygg({ poster: [spellista()] });
    const ref = await dela(tjanst, "l1");
    await kalla.update("bibliotek", "l1", { rubrik: "Gig 12 november" });
    expect((await tjanst.hamta(ref)).delning.rubrik).toBe("Gig 12 november");
    await kalla.remove("bibliotek", "l1");
    expect(await tjanst.hamta(ref)).toEqual({ ok: false, orsak: "saknas" });
  });

  it("⛔ en post som raderats visas som medlemmens egen listvy visar den: en rad 'saknas' utan några andra fält, och inget av postens innehåll", async () => {
    const { tjanst, kalla } = bygg({ poster: [spellista()] });
    const ref = await dela(tjanst, "l1");
    await kalla.remove("bibliotek", "a1");
    const poster = (await tjanst.hamta(ref)).delning.poster;
    expect(poster).toHaveLength(4);
    expect(poster[1]).toEqual({ typ: "saknas" });
    expect(JSON.stringify(poster)).not.toContain("Rubrik a1");
    // En fil som inte blev klar har inget att visa och blir samma rad.
    await kalla.update("bibliotek", "s1", { fil: { sokvag: "x/y/z/w/v", namn: "v.mp3", mime: "audio/mpeg", byte: 1, klar: false } });
    expect((await tjanst.hamta(ref)).delning.poster[0]).toEqual({ typ: "saknas" });
    // En länk vars adress blivit något annat än http eller https blir också samma rad.
    await kalla.update("bibliotek", "k1", { url: "javascript:alert(1)" });
    const efter = JSON.stringify((await tjanst.hamta(ref)).delning);
    expect(efter).not.toContain("javascript");
    expect((await tjanst.hamta(ref)).delning.poster[2]).toEqual({ typ: "saknas" });
  });

  it("⛔ en post från en annan plats läses aldrig in: raden säger 'saknas' och läcker ingenting därifrån", async () => {
    const annanPlats = ljud("grannens", ANNAN_GRUPP, "uid-utanfor", { rubrik: "Grannens hemliga låt" });
    const { tjanst } = bygg({ poster: [annanPlats, lista("l4", ["grannens", "s1"])] });
    const d = await hamta(tjanst, "l4");
    expect(d.poster[0]).toEqual({ typ: "saknas" });
    expect(d.poster[1].rubrik).toBe("Rubrik s1");
    expect(JSON.stringify(d)).not.toMatch(/Grannens|grannens|grannen/);
  });

  it("⛔ en lista i en lista visas inte: raden är 'lista-i-lista' och ingen rekursion sker, inte ens när listan pekar på sig själv", async () => {
    const { tjanst } = bygg({ poster: [lista("inre", ["s2"]), lista("yttre", ["inre", "s1", "yttre"])] });
    const d = await hamta(tjanst, "yttre");
    expect(d.poster).toHaveLength(3);
    expect(d.poster[0]).toEqual({ typ: "lista-i-lista" });
    expect(d.poster[1].rubrik).toBe("Rubrik s1");
    expect(d.poster[2]).toEqual({ typ: "lista-i-lista" });
    expect([...LISTRADSKAL]).toEqual(["saknas", "lista-i-lista"]);
  });

  it("en tom lista delas och visas som tom (inte som en trasig länk)", async () => {
    const { tjanst } = bygg({ poster: [lista("tom", [])] });
    expect(await hamta(tjanst, "tom")).toEqual({ typ: "lista", rubrik: "Rubrik tom", nedladdning: false, poster: [], ejVisade: 0 });
  });

  it("⛔ TAKET: en lista över taket visar högst MAX_DELADE_LISTPOSTER poster, ejVisade säger hur många som kapats, och bara de visade får en signerad adress", async () => {
    const antal = MAX_DELADE_LISTPOSTER + 7;
    const manga = Array.from({ length: antal }, (_, i) => ljud(`m${i}`));
    const { tjanst, signeradAdress } = bygg({ poster: [...manga, lista("stor", manga.map((p) => p.id))] });
    signeradAdress.mockClear();
    const d = await hamta(tjanst, "stor");
    expect(d.poster).toHaveLength(MAX_DELADE_LISTPOSTER);
    expect(d.ejVisade).toBe(7);
    expect(d.poster[0].rubrik).toBe("Rubrik m0");
    expect(d.poster.at(-1).rubrik).toBe(`Rubrik m${MAX_DELADE_LISTPOSTER - 1}`);
    expect(signeradAdress).toHaveBeenCalledTimes(MAX_DELADE_LISTPOSTER);
    expect(MAX_DELADE_LISTPOSTER).toBe(100);
  });

  it("⛔ en lista som inte är över taket har ejVisade 0 (ett tal, inte ett fält som saknas)", async () => {
    const { tjanst } = bygg({ poster: [spellista()] });
    expect((await hamta(tjanst, "l1")).ejVisade).toBe(0);
  });

  it("⛔ radnyckeln är densamma vid varje hämtning, olika per post och per delning, och innehåller inte postens id", async () => {
    const { tjanst } = bygg({ poster: [spellista()] });
    const ref1 = await dela(tjanst, "l1");
    const ref2 = await dela(tjanst, "l1");
    const a = (await tjanst.hamta(ref1)).delning.poster;
    const b = (await tjanst.hamta(ref1)).delning.poster;
    const c = (await tjanst.hamta(ref2)).delning.poster;
    expect(a.map((p) => p.id)).toEqual(b.map((p) => p.id));
    expect(new Set(a.map((p) => p.id)).size).toBe(a.length);
    expect(a.map((p) => p.id)).not.toEqual(c.map((p) => p.id));
    // 16 hextecken, en hash och inget id: ett postid som "a1" kan inte läsas ur den.
    for (const p of a) expect(p.id).toMatch(/^[0-9a-f]{16}$/);
  });

  it("⛔ inget internt lämnar servern: inte grupp, uid, taggar, utskrift, sökvägar eller postens id", async () => {
    const { tjanst } = bygg({ poster: [spellista()] });
    const d = await hamta(tjanst, "l1");
    const text = JSON.stringify(d).replace(/https:\/\/lagring\.test\/[^"]+/g, "");
    for (const forbjudet of [GRUPP, MEDLEM, HEMLIG, "Hemlig utskrift", "grupper/", "bibliotek/", "taggar", "utskrift", "skapadAv", "groupId", "sokvag", "bilder.exempel.se", '"s1"', '"k1"', '"l1"']) {
      expect(text, forbjudet).not.toContain(forbjudet);
    }
  });

  it("⛔ en post som inte har postidform slås aldrig upp (databasen får inget konstigt id)", async () => {
    const lasta = [];
    const { tjanst } = bygg({
      poster: [lista("konstig", ["s1", "../utanfor", "a/b", ""])],
      omslut: (k) => ({ ...k, read: async (samling, id) => { lasta.push(`${samling}/${id}`); return k.read(samling, id); } }),
    });
    const d = await hamta(tjanst, "konstig");
    expect(d.poster.map((p) => p.typ)).toEqual(["ljud", "saknas", "saknas", "saknas"]);
    expect(lasta.filter((l) => l.startsWith("bibliotek/"))).not.toContain("bibliotek/../utanfor");
    expect(lasta.filter((l) => l.startsWith("bibliotek/")).some((l) => /\/(a\/b)?$/.test(l) && l !== "bibliotek/konstig")).toBe(false);
  });
});

describe("vem får dela: listan prövas som varje annan post (farAndra)", () => {
  it("en medlem delar sin egen lista men inte någon annans, och admin och ägare delar andras", async () => {
    const { tjanst } = bygg({ poster: [lista("hennes", ["s1"], GRUPP, ANNAN)] });
    await expect(tjanst.skapa({ uid: MEDLEM, postId: "hennes", groupId: GRUPP, dagar: 7, gruppdel: "kallan-grupp", fildel: "x" })).rejects.toThrow(/inte skrivit posten/);
    for (const uid of [ADMIN, AGARE]) {
      const svar = await tjanst.skapa({ uid, postId: "hennes", groupId: GRUPP, dagar: 7, gruppdel: "kallan-grupp", fildel: `y-${uid}` });
      expect(svar.adress).toMatch(/^kallan-grupp\/lib\/y-/);
    }
  });

  it("⛔ den som delar listan delar också posterna i den, också andras (CP-beslutet), men bara dem på listans plats", async () => {
    const { tjanst } = bygg({ poster: [ljud("annans-lat", GRUPP, ANNAN), lista("min", ["annans-lat"], GRUPP, MEDLEM)] });
    expect((await hamta(tjanst, "min")).poster[0].rubrik).toBe("Rubrik annans-lat");
  });

  it("Mitt bibliotek: bara ägaren delar sin lista, och posterna läses på den platsen", async () => {
    const mitt = mittBibliotek(MEDLEM);
    const { tjanst } = bygg({ poster: [ljud("mitt-lat", mitt, MEDLEM), lista("mitt-lista", ["mitt-lat", "s1"], mitt, MEDLEM)] });
    await expect(tjanst.skapa({ uid: ADMIN, postId: "mitt-lista", groupId: mitt, dagar: 7, gruppdel: "kallan-grupp", fildel: "x" })).rejects.toThrow(/äger inte biblioteket/);
    const svar = await tjanst.skapa({ uid: MEDLEM, postId: "mitt-lista", groupId: mitt, dagar: 7, gruppdel: "kallan-grupp", fildel: "mitt" });
    const d = (await tjanst.hamta(svar.adress)).delning;
    expect(d.poster[0].rubrik).toBe("Rubrik mitt-lat");
    expect(d.poster[1]).toEqual({ typ: "saknas" });
  });

  it("en fil som inte blev klar går fortfarande inte att dela, men en lista med en sådan fil i går", async () => {
    const halv = ljud("halv", GRUPP, MEDLEM, { fil: { sokvag: "x/y/z/w/v", namn: "v.mp3", mime: "audio/mpeg", byte: 1, klar: false } });
    const { tjanst } = bygg({ poster: [halv, lista("med-halv", ["halv", "s1"])] });
    await expect(dela(tjanst, "halv")).rejects.toThrow(/går inte att dela/);
    const d = await hamta(tjanst, "med-halv");
    expect(d.poster.map((p) => p.typ)).toEqual(["saknas", "ljud"]);
  });
});
