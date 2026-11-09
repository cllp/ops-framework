import { describe, expect, it, vi } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { medlemskapsId } from "../lib/grupp.js";
import { ANTECKNINGSSVARSFALT, MAX_ANTECKNINGSBILDER, MAX_ANTECKNINGSBILDER_PER_SVAR, SIGNERAD_SEKUNDER, anteckningsbildSokvag } from "../lib/delning.js";
import { createDelningService } from "../node/delning.js";

/**
 * Serverns halva av bilder i en delad anteckning (0.207.0, cllp/lifehub.app#696 skiva 2): `createDelningService` signerar bilderna i en anteckning och lägger dem i `bilder`.
 * Gästens bibliotek (`createGastService`) provas i `gast-grupp-tjanst.test.js`, med samma `anteckningsbildAdresser`.
 *
 * ⛔ UTAN NÄTVERK OCH UTAN FIREBASE. `finns` är en mängd sökvägar, och `signeradAdress` lämnar sökvägen synlig i adressen så att provet ser exakt vad som signerades.
 */

const NU = 1_800_000_000_000;
const GRUPP = "kallan";
const MEDLEM = "uid-medlem";

const medlemskap = (uid, groupId, roll) => ({ id: medlemskapsId(uid, groupId), userId: uid, groupId, roll, typ: "person", status: "aktiv", namn: `Namn ${uid}` });
const av = { uid: MEDLEM, namn: "Skaparen", typ: "manniska", kalla: "bibliotek" };
const anteckning = (id, text, groupId = GRUPP) => ({ id, typ: "anteckning", groupId, rubrik: `Rubrik ${id}`, text, skapadAv: av, skapad: NU - 1000, andrad: NU - 1000 });
const lista = (id, poster) => ({ id, typ: "lista", groupId: GRUPP, rubrik: `Rubrik ${id}`, poster, skapadAv: av, skapad: NU - 1000, andrad: NU - 1000 });
const bilder = (n, prefix = "b") => Array.from({ length: n }, (_, i) => `![](${prefix}${String(i).padStart(2, "0")}.jpg)`).join("\n");

/** @param {{ poster?: any[], filer?: string[], finns?: any, lagring?: Record<string, any> }} [val] */
function bygg({ poster = [], filer = [], finns, lagring = {} } = {}) {
  const kalla = createMemorySource({ memberships: [medlemskap(MEDLEM, GRUPP, "medlem")], bibliotek: poster, delningar: [] });
  const finnsMangd = new Set(filer);
  const finnsFn = finns === undefined ? vi.fn(async ({ sokvag }) => finnsMangd.has(sokvag)) : finns;
  const signeradAdress = vi.fn(async ({ sokvag, sekunder, disposition, mime }) => `https://lagring.test/${sokvag}?s=${sekunder}&d=${encodeURIComponent(disposition)}&m=${encodeURIComponent(mime)}`);
  const tjanst = createDelningService({
    kalla,
    lagring: { signeradAdress, ...(finnsFn === null ? {} : { finns: finnsFn }), ...lagring },
    samlingar: { delningar: "delningar", bibliotek: "bibliotek" },
    klocka: () => NU,
  });
  return { tjanst, signeradAdress, finns: finnsFn };
}

let nr = 0;
async function hamta(tjanst, postId) {
  const { adress } = await tjanst.skapa({ uid: MEDLEM, postId, groupId: GRUPP, dagar: 7, gruppdel: "kallan-grupp", fildel: `del-${nr++}` });
  const svar = await tjanst.hamta(adress);
  expect(svar.ok, JSON.stringify(svar)).toBe(true);
  return svar.delning;
}

const sokvagar = (/** @type {any} */ fn) => fn.mock.calls.map((/** @type {any[]} */ c) => c[0].sokvag);

describe("anteckningsbildSokvag: postens egen mapp, och ingenting annat", () => {
  const bas = { gruppPrefix: "grupper", postPrefix: "bibliotek", groupId: GRUPP, postId: "a1" };
  it("en bild i postens mapp", () => {
    expect(anteckningsbildSokvag({ ...bas, namn: "kvitto.jpg" })).toBe("grupper/kallan/bibliotek/a1/kvitto.jpg");
    expect(anteckningsbildSokvag({ ...bas, groupId: "plats~kallan~p1", namn: "a.WEBP" })).toBe("grupper/plats~kallan~p1/bibliotek/a1/a.WEBP");
  });
  it("⛔ aldrig utanför postens mapp, aldrig en annan sorts fil", () => {
    for (const namn of ["../ut.jpg", "a/b.jpg", "..", ".jpg/..", "sida.html", "x.pdf", "x", "", "a b.jpg"]) expect(anteckningsbildSokvag({ ...bas, namn }), namn).toBeNull();
    for (const groupId of ["a/b", "..", ".", "", "a\\b", "a\u0000b", 7]) expect(anteckningsbildSokvag({ ...bas, groupId, namn: "k.jpg" }), String(groupId)).toBeNull();
    for (const postId of ["a/b", "..", "", null]) expect(anteckningsbildSokvag({ ...bas, postId, namn: "k.jpg" }), String(postId)).toBeNull();
  });
});

describe("createDelningService: bilderna i en delad anteckning", () => {
  const TEXT = "Kvitton\n\n![Taxi](kvitto.jpg) ![](saknas.png) ![](../ut.jpg) ![](sida.html) ![](annan.jpg)\n\n```\n![](kod.jpg)\n```";
  const FILER = ["grupper/kallan/bibliotek/b1/kvitto.jpg", "grupper/kallan/bibliotek/b1/sida.html", "grupper/kallan/bibliotek/annan/annan.jpg", "grupper/kallan/bibliotek/b1/kod.jpg"];

  it("en bild som finns signeras i postens mapp, 15 minuter, inline och som bild", async () => {
    const { tjanst, signeradAdress } = bygg({ poster: [anteckning("b1", TEXT)], filer: FILER });
    signeradAdress.mockClear();
    const d = await hamta(tjanst, "b1");
    expect(d.bilder).toEqual({ "kvitto.jpg": `https://lagring.test/grupper/kallan/bibliotek/b1/kvitto.jpg?s=${SIGNERAD_SEKUNDER}&d=inline&m=image%2Fjpeg` });
    expect(sokvagar(signeradAdress)).toEqual(["grupper/kallan/bibliotek/b1/kvitto.jpg"]);
    // ⛔ Vitlistan släpper igenom fältet, och bara det.
    expect(Object.keys(d).sort()).toEqual([...ANTECKNINGSSVARSFALT].sort());
  });

  it("⛔ en saknad fil utelämnas, ett osäkert namn, `../`, en HTML-fil och en kodsnutt frågas aldrig om, och en annan posts fil nås inte", async () => {
    const { tjanst, finns } = bygg({ poster: [anteckning("b1", TEXT)], filer: FILER });
    const d = await hamta(tjanst, "b1");
    expect(Object.keys(d.bilder)).toEqual(["kvitto.jpg"]);
    const fragade = sokvagar(finns);
    expect(fragade).toEqual(["grupper/kallan/bibliotek/b1/kvitto.jpg", "grupper/kallan/bibliotek/b1/saknas.png", "grupper/kallan/bibliotek/b1/annan.jpg"]);
    expect(fragade.join(" ")).not.toMatch(/\.\.|sida\.html|kod\.jpg|\/annan\//);
  });

  it("⛔ taket per anteckning håller: de första 20 i textens ordning", async () => {
    const filer = Array.from({ length: 25 }, (_, i) => `grupper/kallan/bibliotek/b1/b${String(i).padStart(2, "0")}.jpg`);
    const { tjanst, finns } = bygg({ poster: [anteckning("b1", bilder(25))], filer });
    const d = await hamta(tjanst, "b1");
    expect(MAX_ANTECKNINGSBILDER).toBe(20);
    expect(Object.keys(d.bilder)).toEqual(Array.from({ length: 20 }, (_, i) => `b${String(i).padStart(2, "0")}.jpg`));
    expect(finns).toHaveBeenCalledTimes(20);
  });

  it("⛔ i en delad lista delar posterna svarets tak, i listans ordning, och en anteckning efter taket får inget `bilder`", async () => {
    const antal = MAX_ANTECKNINGSBILDER_PER_SVAR / MAX_ANTECKNINGSBILDER + 1;
    const noter = Array.from({ length: antal }, (_, i) => anteckning(`n${i}`, bilder(MAX_ANTECKNINGSBILDER)));
    const filer = noter.flatMap((n) => Array.from({ length: MAX_ANTECKNINGSBILDER }, (_, i) => `grupper/kallan/bibliotek/${n.id}/b${String(i).padStart(2, "0")}.jpg`));
    const { tjanst, finns } = bygg({ poster: [...noter, lista("l1", noter.map((n) => n.id))], filer });
    const d = await hamta(tjanst, "l1");
    const rader = d.poster;
    expect(rader).toHaveLength(antal);
    for (const r of rader.slice(0, -1)) expect(Object.keys(r.bilder)).toHaveLength(MAX_ANTECKNINGSBILDER);
    expect(rader[rader.length - 1].bilder).toBeUndefined();
    expect(finns).toHaveBeenCalledTimes(MAX_ANTECKNINGSBILDER_PER_SVAR);
    // Varje rad signeras i sin EGEN posts mapp.
    expect(Object.values(rader[1].bilder).every((u) => /** @type {string} */ (u).includes("/bibliotek/n1/"))).toBe(true);
  });

  it("utan `finns` skickas inga bilder och ingenting signeras för dem", async () => {
    const { tjanst, signeradAdress } = bygg({ poster: [anteckning("b1", TEXT)], filer: FILER, finns: null });
    signeradAdress.mockClear();
    const d = await hamta(tjanst, "b1");
    expect(d).toEqual({ typ: "anteckning", rubrik: "Rubrik b1", text: TEXT });
    expect(signeradAdress).not.toHaveBeenCalled();
  });

  it("en anteckning utan bild har inget `bilder`, och frågar inte lagringen", async () => {
    const { tjanst, finns } = bygg({ poster: [anteckning("b1", "Bara text")] });
    expect(await hamta(tjanst, "b1")).toEqual({ typ: "anteckning", rubrik: "Rubrik b1", text: "Bara text" });
    expect(finns).not.toHaveBeenCalled();
  });

  it("⛔ en `finns` som inte svarar true eller false kastar (Admin SDK svarar [boolean]), i stället för att varje bild tyst blir saknad", async () => {
    const { tjanst } = bygg({ poster: [anteckning("b1", "![](kvitto.jpg)")], finns: async () => [true] });
    const { adress } = await tjanst.skapa({ uid: MEDLEM, postId: "b1", groupId: GRUPP, dagar: 7, gruppdel: "kallan-grupp", fildel: "del-kast" });
    await expect(tjanst.hamta(adress)).rejects.toThrow(/lagring\.finns ska svara true eller false/);
  });

  it("lagringens prefix följer appens (samma som lagringsregeln), och en felaktig `finns` eller ett prefix som inte är ett namn kastar vid bygget", async () => {
    const { tjanst, signeradAdress } = bygg({ poster: [anteckning("b1", "![](k.png)")], filer: ["g/kallan/filer/b1/k.png"], lagring: { gruppPrefix: "g", postPrefix: "filer" } });
    signeradAdress.mockClear();
    expect(Object.keys((await hamta(tjanst, "b1")).bilder)).toEqual(["k.png"]);
    expect(sokvagar(signeradAdress)).toEqual(["g/kallan/filer/b1/k.png"]);
    expect(() => bygg({ finns: "ja" })).toThrow(/lagring\.finns är en funktion/);
    expect(() => bygg({ lagring: { gruppPrefix: "a/b" } })).toThrow(/lagring\.gruppPrefix är ett namn/);
  });
});
