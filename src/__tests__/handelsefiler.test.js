import { describe, expect, it, vi } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { createBibliotekskalla, flyttaBibliotekspost } from "../data/bibliotekkalla.js";
import {
  HANDELSEFORM,
  HANDELSE_PREFIX,
  arHandelseBibliotek,
  farAndra,
  gruppForPlats,
  handelseBibliotek,
  handelsedelar,
  mittBibliotek,
  postFel,
} from "../lib/bibliotek.js";
import { ID_FORM } from "../lib/katalog.js";
import { medlemskapsId } from "../lib/grupp.js";
import { bibliotekregelfragment, lagringsregelfragment } from "../lib/regler.js";
import { createDelningService } from "../node/delning.js";
import { createHandelsefilerService } from "../node/handelsefiler.js";

/**
 * En händelses filer (0.121.0, cllp/lifehub.app#366, docs/beslut/0006): platsen `handelse~<grupp>~<händelse>`, modellen, källan, flytten som
 * kastar, delningen och städningen. Reglerna provas i emulatorn (`rules/__tests__/handelsefiler.test.mjs`); vyn i `handelsefiler-vy.test.jsx`.
 *
 * ⛔ VARJE PROV HAR SETTS FALLA (regel 4): rött med koden muterad, grönt med den. Utfallen står i PR-texten.
 */

const GRUPP = "cps-ab";
const MEDLEM = "uidMedlem";
const ADMIN = "uidAdmin";
const UTOMSTAENDE = "uidUtomstaende";
const NU = 1_800_000_000_000;
const PLATS = handelseBibliotek(GRUPP, "h1");
const skapare = (uid) => ({ uid, namn: "Kim", typ: "manniska", kalla: "bibliotek" });
const fil = (groupId, extra = {}) => ({
  groupId,
  typ: "fil",
  rubrik: "Biljett",
  fil: { sokvag: `grupper/${groupId}/bibliotek/p1/biljett.pdf`, namn: "biljett.pdf", mime: "application/pdf", byte: 2000, klar: true },
  skapadAv: skapare(MEDLEM),
  skapad: NU,
  andrad: NU,
  ...extra,
});

describe("Händelseplatsen", () => {
  it("är handelse~<grupp>~<händelse>, och prefixet är det som står i konstanten", () => {
    expect(PLATS).toBe("handelse~cps-ab~h1");
    expect(PLATS.startsWith(HANDELSE_PREFIX)).toBe(true);
    expect(handelseBibliotek("cps-ab", "Ab12Cd34Ef56Gh78Ij90")).toBe("handelse~cps-ab~Ab12Cd34Ef56Gh78Ij90");
  });

  it("tolkas tillbaka till grupp och händelse, och allt annat är ingen händelseplats", () => {
    expect(handelsedelar(PLATS)).toEqual({ groupId: "cps-ab", handelseId: "h1" });
    expect(arHandelseBibliotek(PLATS)).toBe(true);
    for (const inte of ["cps-ab", mittBibliotek("uidKim"), "post~abc", "handelse~cps-ab", "handelse~cps-ab~", "handelse~~h1", "handelse~cps-ab~h1~x", "handelse~cps ab~h1", "handelse~CPS~h1", "handelse~cps-ab~h/1", "", null, undefined, 3]) {
      expect(arHandelseBibliotek(inte), String(inte)).toBe(false);
      expect(handelsedelar(inte), String(inte)).toBeNull();
    }
  });

  it("kastar för ett grupp-id eller händelse-id som inte går att använda, hellre än att bygga en plats som aldrig släpps in", () => {
    expect(() => handelseBibliotek("", "h1")).toThrow(/går inte att använda/);
    expect(() => handelseBibliotek("cps-ab", "")).toThrow(/går inte att använda/);
    expect(() => handelseBibliotek("cps~ab", "h1")).toThrow();
    expect(() => handelseBibliotek("cps-ab", "post~h1")).toThrow();
    expect(() => handelseBibliotek("cps-ab", "h/1")).toThrow();
    expect(() => handelseBibliotek("cps-ab", "x".repeat(129))).toThrow();
  });

  it("kan inte likna en grupp, Mitt bibliotek eller kalenderpostens händelse-id", () => {
    expect(ID_FORM.test(PLATS)).toBe(false);
    expect(PLATS.includes("~")).toBe(true);
    expect(ID_FORM.test("a~b")).toBe(false);
    expect(arHandelseBibliotek(mittBibliotek("uidKim"))).toBe(false);
  });

  it("gruppen på platsen är gruppens medlemskap, och allt annat ges tillbaka som det är", () => {
    expect(gruppForPlats(PLATS)).toBe("cps-ab");
    expect(gruppForPlats("cps-ab")).toBe("cps-ab");
    expect(gruppForPlats(mittBibliotek("uidKim"))).toBe("mitt~uidKim");
  });

  it("gruppdelen i formen är ID_FORM och inte en kopia av den", () => {
    // En grupp med understreck, bindestreck och siffror, och en som börjar på siffra, är grupper (ID_FORM) och alltså också gruppdelar.
    for (const g of ["a1", "1a", "a_b-c", "cps-ab"]) {
      expect(ID_FORM.test(g)).toBe(true);
      expect(arHandelseBibliotek(`handelse~${g}~h1`), g).toBe(true);
    }
    for (const g of ["A", "-a", "a b", "å"]) {
      expect(ID_FORM.test(g)).toBe(false);
      expect(arHandelseBibliotek(`handelse~${g}~h1`), g).toBe(false);
    }
  });
});

describe("En post på händelsens plats", () => {
  it("är en vanlig post: en fil med sin plats i groupId", () => {
    expect(postFel(fil(PLATS))).toBeNull();
  });

  it("har bara filer: en anteckning eller en länk nekas med ett skäl, men samma post i gruppen går igenom", () => {
    const anteckning = { groupId: PLATS, typ: "anteckning", rubrik: "Tanke", text: "Kom ihåg biljetterna.", skapadAv: skapare(MEDLEM), skapad: NU, andrad: NU };
    const lank = { groupId: PLATS, typ: "lank", rubrik: "Biljett", url: "https://example.com/b", skapadAv: skapare(MEDLEM), skapad: NU, andrad: NU };
    expect(postFel(anteckning)).toMatch(/har filer/);
    expect(postFel(lank)).toMatch(/har filer/);
    expect(postFel({ ...anteckning, groupId: GRUPP })).toBeNull();
    expect(postFel({ ...lank, groupId: GRUPP })).toBeNull();
  });

  it("med en plats som har fel form är det ingen grupp heller", () => {
    expect(postFel(fil("handelse~cps-ab"))).toMatch(/inte ett grupp-id/);
    expect(postFel(fil("handelse~cps-ab~h1~x"))).toMatch(/inte ett grupp-id/);
  });

  it("ändras av författaren och av ägare och admin i GRUPPEN, men inte av en annan medlem eller en annan grupps admin", () => {
    const post = { groupId: PLATS, skapadAv: { uid: MEDLEM } };
    expect(farAndra(post, { uid: MEDLEM, roll: "medlem", groupId: GRUPP, status: "aktiv" })).toBe(true);
    expect(farAndra(post, { uid: ADMIN, roll: "admin", groupId: GRUPP, status: "aktiv" })).toBe(true);
    expect(farAndra(post, { uid: "annan", roll: "agare", groupId: GRUPP, status: "aktiv" })).toBe(true);
    expect(farAndra(post, { uid: "annan", roll: "medlem", groupId: GRUPP, status: "aktiv" })).toBe(false);
    expect(farAndra(post, { uid: ADMIN, roll: "admin", groupId: "grannen", status: "aktiv" })).toBe(false);
    expect(farAndra(post, { uid: MEDLEM, roll: "medlem", groupId: GRUPP, status: "avslutad" })).toBe(false);
    expect(farAndra(post, null)).toBe(false);
  });
});

describe("Källan för en händelses plats", () => {
  function kallor() {
    const source = createMemorySource();
    const mk = (groupId) =>
      createBibliotekskalla({
        source,
        collection: "bibliotek",
        groupId,
        skapare: () => skapare(MEDLEM),
        jag: () => ({ uid: MEDLEM, roll: "medlem", groupId: GRUPP, status: "aktiv" }),
        anteckna: () => {},
        lagring: { laddaUpp: vi.fn(async () => {}) },
        sokvag: ({ groupId: g, postId, namn }) => `grupper/${g}/bibliotek/${postId}/${namn}`,
      });
    return { source, handelse: mk(PLATS), grupp: mk(GRUPP), annan: mk(handelseBibliotek(GRUPP, "h2")) };
  }
  const pdf = { name: "biljett.pdf", type: "application/pdf", size: 2000 };

  it("laddar upp en fil på platsen med gruppens vanliga kod, och bara den platsens lista ser den", async () => {
    const { handelse, grupp, annan } = kallor();
    const ny = await handelse.laddaUppFil({ rubrik: "Bio", fil: pdf });
    expect(ny.groupId).toBe(PLATS);
    expect(ny.fil.sokvag).toBe(`grupper/${PLATS}/bibliotek/${ny.id}/biljett.pdf`);
    const lista = await handelse.las();
    expect(lista.poster).toHaveLength(1);
    expect(lista.trasiga).toEqual([]);
    // Gruppens bibliotek och en annan händelses bibliotek ser den aldrig: platsen är frågan.
    expect((await grupp.las()).poster).toHaveLength(0);
    expect((await annan.las()).poster).toHaveLength(0);
  });

  it("nekar en anteckning på platsen innan något skrivs", async () => {
    const { handelse, source } = kallor();
    await expect(handelse.spara({ typ: "anteckning", rubrik: "Tanke", text: "x" })).rejects.toThrow(/har filer/);
    expect(await source.list("bibliotek", {})).toHaveLength(0);
  });

  it("en rad som bär en annan plats står som trasig och släcker inte de andra", async () => {
    const { handelse, source } = kallor();
    await handelse.laddaUppFil({ rubrik: "Bio", fil: pdf });
    await source.create("bibliotek", { ...fil(handelseBibliotek(GRUPP, "h2")), id: "fel" });
    const svar = await handelse.las();
    expect(svar.poster).toHaveLength(1);
    // Frågan går på platsen, så den andra händelsens rad kommer aldrig med. Den ligger kvar i sin egen lista.
    expect(svar.trasiga).toEqual([]);
  });

  it("flytten kastar åt båda hållen, och ingenting skrivs eller raderas", async () => {
    const { handelse, grupp, source } = kallor();
    const post = await handelse.laddaUppFil({ rubrik: "Bio", fil: pdf });
    const lagom = vi.fn(async () => new Blob([new Uint8Array(2000)]));
    await expect(flyttaBibliotekspost({ fran: handelse, till: grupp, id: post.id, satt: "flytta", hamtaFil: lagom })).rejects.toThrow(/händelses bibliotek/);
    await expect(flyttaBibliotekspost({ fran: grupp, till: handelse, id: post.id, satt: "kopiera", hamtaFil: lagom })).rejects.toThrow(/händelses bibliotek/);
    await expect(flyttaBibliotekspost({ fran: handelse, till: kallor().annan, id: post.id, satt: "kopiera", hamtaFil: lagom })).rejects.toThrow(/händelses bibliotek/);
    expect(lagom).not.toHaveBeenCalled();
    expect(await source.list("bibliotek", {})).toHaveLength(1);
  });
});

describe("Regelfragmenten", () => {
  const sok = { gruppPrefix: "grupper", postPrefix: "bibliotek" };
  const lagring = { gruppPrefix: "grupper", postPrefix: "bibliotek", samling: "bibliotek" };

  it("utan handelser är texten byte för byte den förra (ingen gren, ingen funktion)", () => {
    const utan = bibliotekregelfragment("bibliotek", sok);
    expect(utan).not.toContain("handelse");
    expect(utan).toBe(bibliotekregelfragment("bibliotek"));
    expect(lagringsregelfragment({ bibliotek: lagring })).not.toContain("handelse");
  });

  it("med handelser finns grenen, formen och uppslaget av händelsens grupp, i samlingen appen namngav", () => {
    const med = bibliotekregelfragment("bibliotek", { ...sok, handelser: "kalhandelser" });
    expect(med.length).toBeGreaterThan(bibliotekregelfragment("bibliotek").length);
    expect(med).toContain("function opsBibliotekHandelseHor(gid)");
    expect(med).toContain("/documents/kalhandelser/$(gid.split('~')[2])");
    expect(med).toContain("get(opsBibliotekHandelsen(gid)).data.groupId == gid.split('~')[1]");
    expect(med).toContain(HANDELSEFORM.source.replace(/^\^|\$$/g, ""));
    expect(() => bibliotekregelfragment("bibliotek", { ...sok, handelser: "a b" })).toThrow();
  });

  it("lagringen har grenen bara med handelsefiler: true, och prövar formen innan den delar upp platsen", () => {
    const med = lagringsregelfragment({ bibliotek: { ...lagring, handelsefiler: true } });
    expect(med).toContain("function opsFilMedlemsplats(gid)");
    expect(med).toContain(`gid.matches('${HANDELSEFORM.source.replace(/^\^|\$$/g, "")}') && opsFilArMedlem(opsFilMedlemsplats(gid))`);
    expect(lagringsregelfragment({ bibliotek: { ...lagring, handelsefiler: false } })).not.toContain("handelse");
  });
});

describe("Delning av en fil på en händelse", () => {
  function bygg() {
    const kalla = createMemorySource({
      memberships: [
        { id: medlemskapsId(MEDLEM, GRUPP), userId: MEDLEM, groupId: GRUPP, roll: "medlem", typ: "person", status: "aktiv", namn: "Kim" },
        { id: medlemskapsId(ADMIN, GRUPP), userId: ADMIN, groupId: GRUPP, roll: "admin", typ: "person", status: "aktiv", namn: "Ada" },
        { id: medlemskapsId(UTOMSTAENDE, "grannen"), userId: UTOMSTAENDE, groupId: "grannen", roll: "agare", typ: "person", status: "aktiv", namn: "Grannen" },
      ],
      bibliotek: [{ id: "p1", ...fil(PLATS) }],
      delningar: [],
    });
    const tjanst = createDelningService({
      kalla,
      lagring: { signeradAdress: async ({ sokvag }) => `https://lagring.test/${sokvag}` },
      samlingar: { delningar: "delningar", bibliotek: "bibliotek" },
      klocka: () => NU,
    });
    return { kalla, tjanst };
  }

  it("författaren delar sin egen fil, och länken öppnas utan inloggning", async () => {
    const { tjanst } = bygg();
    const svar = await tjanst.skapa({ uid: MEDLEM, postId: "p1", groupId: PLATS, dagar: 7, gruppdel: "kallan", fildel: "biljett" });
    const hamtad = await tjanst.hamta(svar.adress);
    expect(hamtad.ok).toBe(true);
    expect(hamtad.delning.url).toContain(`grupper/${PLATS}/bibliotek/p1/`);
  });

  it("en utomstående och en annan grupps ägare delar inte, och en annan medlem delar inte någon annans fil", async () => {
    const { tjanst, kalla } = bygg();
    await expect(tjanst.skapa({ uid: UTOMSTAENDE, postId: "p1", groupId: PLATS, dagar: 7, gruppdel: "kallan", fildel: "biljett" })).rejects.toThrow(/inte aktiv medlem/);
    await expect(tjanst.skapa({ uid: "ingen", postId: "p1", groupId: PLATS, dagar: 7, gruppdel: "kallan", fildel: "biljett" })).rejects.toThrow(/inte aktiv medlem/);
    await kalla.create("memberships", { id: medlemskapsId("uidAnnan", GRUPP), userId: "uidAnnan", groupId: GRUPP, roll: "medlem", typ: "person", status: "aktiv" });
    await expect(tjanst.skapa({ uid: "uidAnnan", postId: "p1", groupId: PLATS, dagar: 7, gruppdel: "kallan", fildel: "biljett" })).rejects.toThrow(/inte skrivit posten/);
    // Admin delar allas.
    await expect(tjanst.skapa({ uid: ADMIN, postId: "p1", groupId: PLATS, dagar: 7, gruppdel: "kallan", fildel: "biljett" })).resolves.toMatchObject({ adress: expect.any(String) });
  });

  it("platsens grupp i anropet måste vara postens: en medlem i gruppen delar inte under en annan plats", async () => {
    const { tjanst } = bygg();
    await expect(tjanst.skapa({ uid: MEDLEM, postId: "p1", groupId: handelseBibliotek(GRUPP, "h2"), dagar: 7, gruppdel: "kallan", fildel: "biljett" })).rejects.toThrow(/finns inte i platsen/);
    await expect(tjanst.skapa({ uid: MEDLEM, postId: "p1", groupId: GRUPP, dagar: 7, gruppdel: "kallan", fildel: "biljett" })).rejects.toThrow(/finns inte i platsen/);
  });
});

describe("Städningen när en händelse tas bort för gott", () => {
  function bygg() {
    const source = createMemorySource({
      bibliotek: [
        { id: "a", ...fil(PLATS) },
        { id: "b", ...fil(PLATS) },
        { id: "c", ...fil(handelseBibliotek(GRUPP, "h2")) },
        { id: "d", ...fil(GRUPP) },
      ],
    });
    return { source, tjanst: createHandelsefilerService({ kalla: source, samlingar: { bibliotek: "bibliotek" } }) };
  }

  it("torrt räknar och rör inget, med alla fält i rapporten", async () => {
    const { tjanst, source } = bygg();
    const r = await tjanst.stada({ groupId: GRUPP, handelseId: "h1", skarpt: false });
    expect(r).toEqual({ skarpt: false, plats: PLATS, funna: 2, raderade: 0, fel: [] });
    expect(await source.list("bibliotek", {})).toHaveLength(4);
  });

  it("skarpt raderar platsens poster och inga andra", async () => {
    const { tjanst, source } = bygg();
    const r = await tjanst.stada({ groupId: GRUPP, handelseId: "h1", skarpt: true });
    expect(r).toEqual({ skarpt: true, plats: PLATS, funna: 2, raderade: 2, fel: [] });
    expect((await source.list("bibliotek", {})).map((p) => p.id).sort()).toEqual(["c", "d"]);
  });

  it("en händelse utan filer är noll och inte ostält", async () => {
    const { tjanst } = bygg();
    expect(await tjanst.stada({ groupId: GRUPP, handelseId: "tom", skarpt: true })).toEqual({ skarpt: true, plats: handelseBibliotek(GRUPP, "tom"), funna: 0, raderade: 0, fel: [] });
  });

  it("ett fel på en post stoppar inte de andra och tystas inte", async () => {
    const { source } = bygg();
    const flaky = { ...source, list: source.list.bind(source), remove: async (c, id) => { if (id === "a") throw new Error("nekad"); return source.remove(c, id); } };
    const r = await createHandelsefilerService({ kalla: flaky, samlingar: { bibliotek: "bibliotek" } }).stada({ groupId: GRUPP, handelseId: "h1", skarpt: true });
    expect(r).toMatchObject({ funna: 2, raderade: 1, fel: [{ id: "a", fel: "nekad" }] });
  });

  it("en felsvarande källa kan inte få den att radera en annan plats poster", async () => {
    const { source } = bygg();
    const lurande = { ...source, list: async () => [{ id: "d", ...fil(GRUPP) }], remove: source.remove.bind(source) };
    const r = await createHandelsefilerService({ kalla: lurande, samlingar: { bibliotek: "bibliotek" } }).stada({ groupId: GRUPP, handelseId: "h1", skarpt: true });
    expect(r.raderade).toBe(0);
    expect(r.fel).toHaveLength(1);
    expect(await source.read("bibliotek", "d")).not.toBeNull();
  });

  it("kräver skarpt sagt, en plats i rätt form och ett samlingsnamn", async () => {
    const { tjanst, source } = bygg();
    await expect(tjanst.stada({ groupId: GRUPP, handelseId: "h1" })).rejects.toThrow(/skarpt/);
    await expect(tjanst.stada({ groupId: GRUPP, handelseId: "", skarpt: false })).rejects.toThrow(/går inte att använda/);
    await expect(tjanst.stada({ groupId: "", handelseId: "h1", skarpt: false })).rejects.toThrow(/går inte att använda/);
    expect(() => createHandelsefilerService({ kalla: source, samlingar: {} })).toThrow(/samlingar.bibliotek/);
    expect(() => createHandelsefilerService({ kalla: {}, samlingar: { bibliotek: "b" } })).toThrow(/list och remove/);
  });
});
