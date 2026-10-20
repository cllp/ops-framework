import { describe, expect, it } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { createBibliotekskalla, flyttaBibliotekspost } from "../data/bibliotekkalla.js";
import { BIBLIOTEKFLIKAR, MAX_LISTPOSTER, POSTIDFORM, byggPost, farAndra, filtreraBibliotek, inmatningsfel, listaFel, postFel } from "../lib/bibliotek.js";
import { kandidaterForLista, laggTillPost, listorAttLaggaI, losLista, taBortPost } from "../lib/biblioteklista.js";
import { bibliotekregelfragment } from "../lib/regler.js";

/**
 * Listor i Biblioteket (0.128.0, cllp/lifehub.app#378): modellen, läsningen mot platsens poster, och att en lista aldrig flyttas till en annan plats.
 */

const tid = 1_700_000_000_000;
const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const skapareFn = () => skapare;
const lista = (extra = {}) => ({ groupId: "cps-ab", typ: "lista", rubrik: "Spellista", poster: ["a", "b", "c"], skapadAv: skapare, skapad: tid, andrad: tid, ...extra });
const anteckning = (id, rubrik = id) => ({ ...byggPost({ groupId: "cps-ab", typ: "anteckning", rubrik, text: "x", skapadAv: skapare, skapad: tid, andrad: tid }), id });

describe("en lista är en post", () => {
  it("byggPost skriver rubrik och poster i ordning, och inga andra innehållsfält", () => {
    const p = byggPost(lista());
    expect(p.typ).toBe("lista");
    expect(p.rubrik).toBe("Spellista");
    expect(p.poster).toEqual(["a", "b", "c"]);
    for (const falt of ["text", "url", "kalla", "bild", "fil", "utskrift", "durationMs", "peaks"]) expect(Object.hasOwn(p, falt), falt).toBe(false);
  });

  it("⛔ en TOM lista sparas som `poster: []` och inte utan fältet: tom lista och lista utan form är inte samma sak (regel 5)", () => {
    expect(byggPost(lista({ poster: [] })).poster).toEqual([]);
    expect(Object.hasOwn(byggPost(lista({ poster: [] })), "poster")).toBe(true);
    expect(inmatningsfel({ ...lista(), poster: undefined })).toMatch(/Listan saknar poster/);
    expect(() => byggPost({ ...lista(), poster: undefined })).toThrow(/Listan saknar poster/);
    expect(inmatningsfel(lista({ poster: "a,b" }))).toMatch(/Listan saknar poster/);
  });

  it("ordningen är listans: byggPost ändrar den inte, och en kopia delas inte med indata", () => {
    const indata = ["z", "y", "x"];
    const p = byggPost(lista({ poster: indata }));
    expect(p.poster).toEqual(["z", "y", "x"]);
    indata.push("w");
    expect(p.poster).toEqual(["z", "y", "x"]);
  });

  it("taket är MAX_LISTPOSTER, inklusive gränsen; dubbletter och id med fel form avvisas med sitt skäl", () => {
    const ids = (n) => Array.from({ length: n }, (_, i) => `p${i}`);
    expect(MAX_LISTPOSTER).toBe(200);
    expect(listaFel(ids(200))).toBeNull();
    expect(listaFel(ids(201))).toMatch(/201 poster. Taket är 200/);
    expect(listaFel(["a", "a"])).toMatch(/Samma post står två gånger/);
    for (const dalig of ["", "a/b", "a~b", "-a", "a b", "å", "a".repeat(129), 5, null]) {
      expect(listaFel([dalig]), String(dalig).slice(0, 20)).toMatch(/inte ett postid/);
    }
    expect(listaFel(["a".repeat(128)])).toBeNull();
    expect(POSTIDFORM.test("b_1700000000_abc")).toBe(true);
    expect(POSTIDFORM.test("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("andra innehållsfält på en lista avvisas, och poster på något som inte är en lista också", () => {
    expect(inmatningsfel(lista({ text: "hej" }))).toMatch(/fältet text hör inte dit/);
    expect(inmatningsfel(lista({ url: "https://x.se" }))).toMatch(/fältet url hör inte dit/);
    const anteckn = { groupId: "cps-ab", typ: "anteckning", rubrik: "P", text: "x", skapadAv: skapare, skapad: tid, andrad: tid };
    expect(inmatningsfel({ ...anteckn, poster: ["a"] })).toMatch(/fältet poster hör inte dit/);
    expect(inmatningsfel({ groupId: "cps-ab", typ: "lank", rubrik: "L", url: "https://x.se", poster: ["a"], skapadAv: skapare })).toMatch(/inga poster/);
    expect(inmatningsfel({ groupId: "cps-ab", typ: "fil", rubrik: "F", poster: ["a"], fil: { sokvag: "grupper/cps-ab/bibliotek/p/a.pdf", namn: "a.pdf", mime: "application/pdf", byte: 5 } })).toMatch(/fältet poster hör inte dit/);
  });

  it("rubriken krävs som på varje post, och en lista får taggar", () => {
    expect(inmatningsfel(lista({ rubrik: "   " }))).toBe("Rubriken saknas.");
    expect(byggPost(lista({ taggar: ["musik"] })).taggar).toEqual(["musik"]);
  });

  it("en händelses och ett ärendes bibliotek har inga listor: bara filer", () => {
    expect(postFel(lista({ groupId: "handelse~cps-ab~h1" }))).toMatch(/har filer, och inga anteckningar, länkar eller listor/);
    expect(postFel(lista({ groupId: "arende~cps-ab~i1" }))).toMatch(/har filer, och inga anteckningar, länkar eller listor/);
  });

  it("flikarna har `lista`, och bara listor syns under den; antalet är härlett ur posterna", () => {
    expect(BIBLIOTEKFLIKAR).toContain("lista");
    const poster = [anteckning("a"), { ...byggPost(lista({ andrad: tid + 5 })), id: "l1" }, { ...byggPost(lista({ rubrik: "Två", andrad: tid + 6 })), id: "l2" }];
    expect(filtreraBibliotek(poster, { flik: "lista" }).map((p) => p.id)).toEqual(["l2", "l1"]);
    expect(filtreraBibliotek(poster, { flik: "anteckning" }).map((p) => p.id)).toEqual(["a"]);
    expect(filtreraBibliotek(poster, { flik: "alla" })).toHaveLength(3);
  });
});

describe("losLista: listan läses mot platsens poster", () => {
  const platsen = [anteckning("a", "Aaa"), anteckning("c", "Ccc")];

  it("⛔ ALLA id kommer med, i listans ordning: antalet rader är listans längd vilka poster som än finns (inget filtreras tyst)", () => {
    const rader = losLista({ poster: ["c", "b", "a", "d"] }, platsen);
    expect(rader.map((r) => r.id)).toEqual(["c", "b", "a", "d"]);
    expect(rader).toHaveLength(4);
    expect(rader.map((r) => r.post?.rubrik ?? null)).toEqual(["Ccc", null, "Aaa", null]);
    expect(rader.map((r) => r.skal)).toEqual([null, "saknas", null, "saknas"]);
  });

  it("⛔ BARA FRÅN SAMMA PLATS: ett id som finns på en annan plats är en rad som saknas, aldrig innehåll därifrån", () => {
    const annanPlats = { ...anteckning("x", "Från en annan plats"), groupId: "miranda-ab" };
    // Vyn har bara platsens egna poster. Även om en annan plats' post av misstag skulle ha samma id som något i listan hittas den inte.
    const rader = losLista({ poster: ["x"] }, platsen);
    expect(rader).toEqual([{ id: "x", post: null, skal: "saknas" }]);
    expect(JSON.stringify(rader)).not.toContain(annanPlats.rubrik);
  });

  it("en lista i en lista visas inte som innehåll: raden står kvar med skälet `lista`", () => {
    const rader = losLista({ poster: ["l1", "a"] }, [{ ...byggPost(lista()), id: "l1" }, ...platsen]);
    expect(rader[0]).toEqual({ id: "l1", post: null, skal: "lista" });
    expect(rader[1]?.post?.id).toBe("a");
  });

  it("en tom lista, och en lista utan fältet, ger inga rader utan att kasta", () => {
    expect(losLista({ poster: [] }, platsen)).toEqual([]);
    expect(losLista({}, platsen)).toEqual([]);
    expect(losLista(null, platsen)).toEqual([]);
  });
});

describe("att lägga till och ta bort", () => {
  it("laggTillPost lägger sist, lämnar en dubblett orörd, och kastar när listan är full", () => {
    expect(laggTillPost(["a"], "b")).toEqual({ poster: ["a", "b"], andrad: true });
    expect(laggTillPost(["a", "b"], "a")).toEqual({ poster: ["a", "b"], andrad: false });
    const full = Array.from({ length: 200 }, (_, i) => `p${i}`);
    expect(() => laggTillPost(full, "ny")).toThrow(/Listan är full: högst 200 poster/);
    expect(laggTillPost(full, "p5").andrad).toBe(false);
    expect(() => laggTillPost(["a"], "a/b")).toThrow(/inte ett postid/);
  });

  it("taBortPost tar bort ett id och lämnar ordningen; ett okänt id ändrar inget", () => {
    expect(taBortPost(["a", "b", "c"], "b")).toEqual(["a", "c"]);
    expect(taBortPost(["a", "b"], "z")).toEqual(["a", "b"]);
  });

  it("kandidaterna är platsens poster utom listor och dem som redan ligger i listan", () => {
    const platsen = [anteckning("a"), anteckning("b"), anteckning("c"), { ...byggPost(lista()), id: "l1" }];
    expect(kandidaterForLista({ poster: ["a"] }, platsen).map((p) => p.id)).toEqual(["b", "c"]);
    expect(kandidaterForLista({ poster: ["a", "b", "c"] }, platsen)).toEqual([]);
  });

  it("listorna en post kan läggas i är dem personen får ändra och som inte är fulla, nyast ändrad först", () => {
    const egen = { ...byggPost(lista({ rubrik: "Min", andrad: tid + 2 })), id: "egen" };
    const annans = { ...byggPost(lista({ rubrik: "Annans", skapadAv: { ...skapare, uid: "uid-2" }, andrad: tid + 3 })), id: "annans" };
    const fullLista = { ...byggPost(lista({ rubrik: "Full", poster: Array.from({ length: 200 }, (_, i) => `p${i}`), andrad: tid + 4 })), id: "full" };
    const jag = { uid: "uid-1", roll: "medlem", groupId: "cps-ab", status: "aktiv" };
    expect(listorAttLaggaI([anteckning("a"), egen, annans, fullLista], (l) => farAndra(l, jag)).map((l) => l.id)).toEqual(["egen"]);
    const admin = { uid: "uid-9", roll: "admin", groupId: "cps-ab", status: "aktiv" };
    expect(listorAttLaggaI([egen, annans, fullLista], (l) => farAndra(l, admin)).map((l) => l.id)).toEqual(["annans", "egen"]);
  });
});

describe("källan sparar poster och omslag", () => {
  function kallan(start = []) {
    const source = createMemorySource({ bibliotek: start });
    return { source, kalla: createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare: skapareFn }) };
  }

  it("spara skapar en lista med `poster`, och en ändring av bara rubriken behåller posterna", async () => {
    const { kalla, source } = kallan();
    const ny = await kalla.spara({ typ: "lista", rubrik: "Lista", poster: ["a", "b"] });
    expect(ny.poster).toEqual(["a", "b"]);
    await kalla.spara({ id: ny.id, rubrik: "Nytt namn" });
    const rad = await source.read("bibliotek", ny.id);
    expect(rad?.rubrik).toBe("Nytt namn");
    expect(rad?.poster).toEqual(["a", "b"]);
  });

  it("en ny ordning skrivs som den är, och en tom lista som `[]`", async () => {
    const { kalla, source } = kallan();
    const ny = await kalla.spara({ typ: "lista", rubrik: "Lista", poster: ["a", "b", "c"] });
    await kalla.spara({ id: ny.id, rubrik: "Lista", poster: ["c", "a", "b"] });
    expect((await source.read("bibliotek", ny.id))?.poster).toEqual(["c", "a", "b"]);
    await kalla.spara({ id: ny.id, rubrik: "Lista", poster: [] });
    expect((await source.read("bibliotek", ny.id))?.poster).toEqual([]);
  });

  it("⛔ en lista med en dubblett eller ett dåligt id sparas inte, och inget skrivs", async () => {
    const { kalla, source } = kallan();
    await expect(kalla.spara({ typ: "lista", rubrik: "L", poster: ["a", "a"] })).rejects.toThrow(/Samma post står två gånger/);
    await expect(kalla.spara({ typ: "lista", rubrik: "L", poster: ["a/b"] })).rejects.toThrow(/inte ett postid/);
    expect(await source.list("bibliotek", {})).toEqual([]);
  });

  it("en länk får `kalla` skriven av källan och `bild` när den ges; en ändring av bara rubriken behåller omslaget", async () => {
    const { kalla, source } = kallan();
    const ny = await kalla.spara({ typ: "lank", rubrik: "Låt, Artist", url: "https://open.spotify.com/track/x", bild: "https://i.scdn.co/image/abc" });
    expect(ny.kalla).toBe("spotify");
    expect(ny.bild).toBe("https://i.scdn.co/image/abc");
    await kalla.spara({ id: ny.id, rubrik: "Nytt namn" });
    const rad = await source.read("bibliotek", ny.id);
    expect(rad?.bild).toBe("https://i.scdn.co/image/abc");
    expect(rad?.kalla).toBe("spotify");
  });

  it("⛔ byts adressen utan ett nytt omslag tas omslaget bort ur dokumentet, och `null` tar bort det också", async () => {
    const { kalla, source } = kallan();
    const ny = await kalla.spara({ typ: "lank", rubrik: "Låt", url: "https://open.spotify.com/track/x", bild: "https://i.scdn.co/image/abc" });
    await kalla.spara({ id: ny.id, url: "https://youtu.be/dQw4w9WgXcQ" });
    const efter = await source.read("bibliotek", ny.id);
    expect(efter?.kalla).toBe("youtube");
    expect(Object.hasOwn(efter ?? {}, "bild")).toBe(false);

    const två = await kalla.spara({ typ: "lank", rubrik: "Två", url: "https://open.spotify.com/track/y", bild: "https://i.scdn.co/image/def" });
    await kalla.spara({ id: två.id, bild: null });
    expect(Object.hasOwn((await source.read("bibliotek", två.id)) ?? {}, "bild")).toBe(false);
  });

  it("en gammal länk utan `kalla` får den när den läses, härledd ur adressen", async () => {
    const { kalla } = kallan([{ id: "g", groupId: "cps-ab", typ: "lank", rubrik: "Gammal", url: "https://music.apple.com/se/album/x/1", skapadAv: skapare, skapad: tid, andrad: tid }]);
    const svar = await kalla.las();
    expect(svar.poster[0]?.kalla).toBe("applemusic");
    expect(svar.trasiga).toEqual([]);
  });

  it("⛔ en lista flyttas eller kopieras inte till en annan plats: den pekar på poster här, så flytten kastar med skälet (regel 5)", async () => {
    const source = createMemorySource({ bibliotek: [] });
    const fran = createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare: skapareFn });
    const till = createBibliotekskalla({ source, collection: "bibliotek", groupId: "mitt~uid-1", skapare: skapareFn });
    const ny = await fran.spara({ typ: "lista", rubrik: "Lista", poster: ["a"] });
    for (const satt of /** @type {const} */ (["flytta", "kopiera"])) {
      await expect(flyttaBibliotekspost({ fran, till, id: ny.id, satt })).rejects.toThrow(/En lista flyttas eller kopieras inte till en annan plats/);
    }
    expect((await source.list("bibliotek", { where: { groupId: "mitt~uid-1" } })) ?? []).toEqual([]);
    expect(await fran.hamta(ny.id)).not.toBeNull();
  });

  it("en länk som flyttas tar sitt omslag med sig", async () => {
    const source = createMemorySource({ bibliotek: [] });
    const fran = createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare: skapareFn });
    const till = createBibliotekskalla({ source, collection: "bibliotek", groupId: "mitt~uid-1", skapare: skapareFn });
    const ny = await fran.spara({ typ: "lank", rubrik: "Låt", url: "https://open.spotify.com/track/x", bild: "https://i.scdn.co/image/abc" });
    const flyttad = await flyttaBibliotekspost({ fran, till, id: ny.id, satt: "kopiera" });
    expect(flyttad.bild).toBe("https://i.scdn.co/image/abc");
    expect(flyttad.kalla).toBe("spotify");
  });
});

describe("regelfragmentet har listan och omslaget", () => {
  const regler = bibliotekregelfragment("bibliotek");

  it("taket och id-formen kommer ur samma konstanter som modellen (regel 2)", () => {
    expect(regler).toContain(`p.size() <= ${MAX_LISTPOSTER}`);
    const id = POSTIDFORM.source.replace(/^\^/, "").replace(/\$$/, "");
    expect(regler).toContain(`p.join(',').matches('${id}(,${id})*')`);
    expect(regler).toContain('d.typ == "lista"');
    expect(regler).toContain('d.keys().hasAll(["poster"])');
  });
});
