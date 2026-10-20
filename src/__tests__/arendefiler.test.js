import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { createBibliotekskalla, flyttaBibliotekspost } from "../data/bibliotekkalla.js";
import {
  ARENDEFORM,
  ARENDEIDFORM,
  ARENDE_PREFIX,
  HANDELSEIDFORM,
  arArendeBibliotek,
  arHandelseBibliotek,
  arObjektbibliotek,
  arendeBibliotek,
  arendedelar,
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
import { createHandelsefilerService, createPlatsfilerService } from "../node/handelsefiler.js";

/**
 * Ett ärendes filer (0.122.0, cllp/lifehub.app#366 punkt 3, docs/beslut/0007): platsen `arende~<grupp>~<inkorgspostens id>`, modellen, källan, flytten
 * som kastar, regelfragmenten (byte för byte utan valen), delningen och städningen. Reglerna provas i emulatorn (`rules/__tests__/arendefiler.test.mjs`); vyn i
 * `arendefiler-vy.test.jsx`.
 *
 * ⛔ VARJE PROV HAR SETTS FALLA (regel 4): rött med koden muterad, grönt med den. Utfallen står i PR-texten.
 */

const GRUPP = "cps-ab";
const MEDLEM = "uidMedlem";
const ADMIN = "uidAdmin";
const UTOMSTAENDE = "uidUtomstaende";
const NU = 1_800_000_000_000;
const PLATS = arendeBibliotek(GRUPP, "a1");
const HPLATS = handelseBibliotek(GRUPP, "h1");
const rot = path.resolve(__dirname, "..", "..");
const fixtur = (namn) => fs.readFileSync(path.join(rot, "rules", "__fixturer__", namn), "utf8");
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

describe("Ärendeplatsen", () => {
  it("är arende~<grupp>~<id>, och prefixet är det som står i konstanten", () => {
    expect(PLATS).toBe("arende~cps-ab~a1");
    expect(PLATS.startsWith(ARENDE_PREFIX)).toBe(true);
    expect(arendeBibliotek("cps-ab", "Ab12Cd34Ef56Gh78Ij90")).toBe("arende~cps-ab~Ab12Cd34Ef56Gh78Ij90");
    // Inkorgens stabila id (raden "att-merga") är ett ärende-id som alla andra.
    expect(arendeBibliotek("cps-ab", "att-merga")).toBe("arende~cps-ab~att-merga");
  });

  it("tolkas tillbaka till grupp och ärende, och allt annat är ingen ärendeplats", () => {
    expect(arendedelar(PLATS)).toEqual({ groupId: "cps-ab", arendeId: "a1" });
    expect(arArendeBibliotek(PLATS)).toBe(true);
    for (const inte of ["cps-ab", mittBibliotek("uidKim"), HPLATS, "post~abc", "arende~cps-ab", "arende~cps-ab~", "arende~~a1", "arende~cps-ab~a1~x", "arende~cps ab~a1", "arende~CPS~a1", "arende~cps-ab~a/1", "", null, undefined, 3]) {
      expect(arArendeBibliotek(inte), String(inte)).toBe(false);
      expect(arendedelar(inte), String(inte)).toBeNull();
    }
  });

  it("kastar för ett grupp-id eller ärende-id som inte går att använda, hellre än att bygga en plats som aldrig släpps in", () => {
    expect(() => arendeBibliotek("", "a1")).toThrow(/går inte att använda/);
    expect(() => arendeBibliotek("cps-ab", "")).toThrow(/går inte att använda/);
    expect(() => arendeBibliotek("cps~ab", "a1")).toThrow();
    expect(() => arendeBibliotek("cps-ab", "post~a1")).toThrow();
    expect(() => arendeBibliotek("cps-ab", "a/1")).toThrow();
    expect(() => arendeBibliotek("cps-ab", "x".repeat(129))).toThrow();
    // Felet säger vad det gäller, och inte att det är en händelse.
    expect(() => arendeBibliotek("cps-ab", "")).toThrow(/ärende/);
  });

  it("kan inte likna en grupp, Mitt bibliotek, kalenderpostens id eller en händelseplats, och en händelseplats är inget ärende", () => {
    expect(ID_FORM.test(PLATS)).toBe(false);
    expect(arArendeBibliotek(mittBibliotek("uidKim"))).toBe(false);
    expect(arArendeBibliotek(HPLATS)).toBe(false);
    expect(arHandelseBibliotek(PLATS)).toBe(false);
    expect(arendedelar(HPLATS)).toBeNull();
    expect(handelsedelar(PLATS)).toBeNull();
  });

  it("gruppen på platsen är gruppens medlemskap, för både ärenden och händelser, och allt annat ges tillbaka som det är", () => {
    expect(gruppForPlats(PLATS)).toBe("cps-ab");
    expect(gruppForPlats(HPLATS)).toBe("cps-ab");
    expect(gruppForPlats("cps-ab")).toBe("cps-ab");
    expect(gruppForPlats(mittBibliotek("uidKim"))).toBe("mitt~uidKim");
    // Fel form är ingen plats och ges tillbaka som den är: ett medlemskap med den som grupp finns inte, så den släpper aldrig in någon.
    expect(gruppForPlats("arende~cps-ab")).toBe("arende~cps-ab");
  });

  it("gruppdelen i formen är ID_FORM och id-delen delar källa med händelsens", () => {
    for (const g of ["a1", "1a", "a_b-c", "cps-ab"]) {
      expect(ID_FORM.test(g)).toBe(true);
      expect(arArendeBibliotek(`arende~${g}~a1`), g).toBe(true);
    }
    for (const g of ["A", "-a", "a b", "å"]) {
      expect(ID_FORM.test(g)).toBe(false);
      expect(arArendeBibliotek(`arende~${g}~a1`), g).toBe(false);
    }
    expect(ARENDEIDFORM).toBe(HANDELSEIDFORM);
    expect(ARENDEFORM.source).toContain(ARENDEIDFORM.source.replace(/^\^|\$$/g, ""));
  });

  it("arObjektbibliotek är sant för en händelses och ett ärendes plats och falskt för allt annat", () => {
    expect(arObjektbibliotek(PLATS)).toBe(true);
    expect(arObjektbibliotek(HPLATS)).toBe(true);
    for (const inte of ["cps-ab", mittBibliotek("uidKim"), "arende~cps-ab", "handelse~cps-ab", "", null, undefined]) {
      expect(arObjektbibliotek(inte), String(inte)).toBe(false);
    }
  });
});

describe("En post på ärendets plats", () => {
  it("är en vanlig post: en fil med sin plats i groupId", () => {
    expect(postFel(fil(PLATS))).toBeNull();
  });

  it("har bara filer: en anteckning eller en länk nekas med ett skäl som nämner ärendet, men samma post i gruppen går igenom", () => {
    const anteckning = { groupId: PLATS, typ: "anteckning", rubrik: "Tanke", text: "Köp biljetterna.", skapadAv: skapare(MEDLEM), skapad: NU, andrad: NU };
    const lank = { groupId: PLATS, typ: "lank", rubrik: "Biljett", url: "https://example.com/b", skapadAv: skapare(MEDLEM), skapad: NU, andrad: NU };
    expect(postFel(anteckning)).toMatch(/Ett ärendes bibliotek har filer/);
    expect(postFel(lank)).toMatch(/Ett ärendes bibliotek har filer/);
    expect(postFel({ ...anteckning, groupId: GRUPP })).toBeNull();
    expect(postFel({ ...lank, groupId: GRUPP })).toBeNull();
    // Händelsens text är den förra.
    expect(postFel({ ...anteckning, groupId: HPLATS })).toMatch(/En händelses bibliotek har filer/);
  });

  it("med en plats som har fel form är det ingen grupp heller", () => {
    expect(postFel(fil("arende~cps-ab"))).toMatch(/inte ett grupp-id/);
    expect(postFel(fil("arende~cps-ab~a1~x"))).toMatch(/inte ett grupp-id/);
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

describe("Källan för ett ärendes plats", () => {
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
    return { source, arende: mk(PLATS), grupp: mk(GRUPP), annan: mk(arendeBibliotek(GRUPP, "a2")), handelse: mk(HPLATS) };
  }
  const pdf = { name: "biljett.pdf", type: "application/pdf", size: 2000 };

  it("laddar upp en fil på platsen med gruppens vanliga kod, och bara den platsens lista ser den", async () => {
    const { arende, grupp, annan, handelse } = kallor();
    const ny = await arende.laddaUppFil({ rubrik: "Bio", fil: pdf });
    expect(ny.groupId).toBe(PLATS);
    expect(ny.fil.sokvag).toBe(`grupper/${PLATS}/bibliotek/${ny.id}/biljett.pdf`);
    const lista = await arende.las();
    expect(lista.poster).toHaveLength(1);
    expect(lista.trasiga).toEqual([]);
    // Gruppens bibliotek, ett annat ärende och en händelse ser den aldrig: platsen är frågan.
    expect((await grupp.las()).poster).toHaveLength(0);
    expect((await annan.las()).poster).toHaveLength(0);
    expect((await handelse.las()).poster).toHaveLength(0);
  });

  it("nekar en anteckning på platsen innan något skrivs", async () => {
    const { arende, source } = kallor();
    await expect(arende.spara({ typ: "anteckning", rubrik: "Tanke", text: "x" })).rejects.toThrow(/har filer/);
    expect(await source.list("bibliotek", {})).toHaveLength(0);
  });

  it("flytten kastar åt alla håll, med ett skäl som nämner ärendet, och ingenting skrivs eller raderas", async () => {
    const { arende, grupp, handelse, source } = kallor();
    const post = await arende.laddaUppFil({ rubrik: "Bio", fil: pdf });
    const lagom = vi.fn(async () => new Blob([new Uint8Array(2000)]));
    await expect(flyttaBibliotekspost({ fran: arende, till: grupp, id: post.id, satt: "flytta", hamtaFil: lagom })).rejects.toThrow(/ett ärendes bibliotek flyttas inte/);
    await expect(flyttaBibliotekspost({ fran: grupp, till: arende, id: post.id, satt: "kopiera", hamtaFil: lagom })).rejects.toThrow(/ett ärendes bibliotek flyttas inte/);
    await expect(flyttaBibliotekspost({ fran: arende, till: kallor().annan, id: post.id, satt: "kopiera", hamtaFil: lagom })).rejects.toThrow(/ett ärendes bibliotek/);
    // Mellan ett ärende och en händelse också: det är två objekt med var sin synlighet.
    await expect(flyttaBibliotekspost({ fran: arende, till: handelse, id: post.id, satt: "kopiera", hamtaFil: lagom })).rejects.toThrow(/bibliotek flyttas inte/);
    expect(lagom).not.toHaveBeenCalled();
    expect(await source.list("bibliotek", {})).toHaveLength(1);
  });
});

describe("Regelfragmenten", () => {
  const sok = { gruppPrefix: "grupper", postPrefix: "bibliotek" };
  const lagring = { gruppPrefix: "grupper", postPrefix: "bibliotek", samling: "bibliotek" };

  it("utan arenden är Firestore-texten byte för byte fixturen (0.128.0 plus utskriftsjobbet i 0.133.0: klienten får inte skriva utskriftJobb, se rules/__tests__/bibliotek.test.mjs; filnamnen är oförändrade), med och utan handelser", () => {
    expect(bibliotekregelfragment("bibliotek")).toBe(fixtur("bibliotekregelfragment-0.128.0.rules"));
    expect(bibliotekregelfragment("bibliotek", sok)).toBe(fixtur("bibliotekregelfragment-0.128.0.rules"));
    expect(bibliotekregelfragment("bibliotek", { ...sok, handelser: "handelser" })).toBe(fixtur("bibliotekregelfragment-0.128.0-handelser.rules"));
  });

  it("utan arendefiler är Storage-texten byte för byte den som 0.127.0 skrev (0.121.0 plus video), med och utan handelsefiler", () => {
    expect(lagringsregelfragment({ bibliotek: lagring })).toBe(fixtur("lagringsregelfragment-0.127.0.rules"));
    expect(lagringsregelfragment({ bibliotek: { ...lagring, arendefiler: false } })).toBe(fixtur("lagringsregelfragment-0.127.0.rules"));
    expect(lagringsregelfragment({ bibliotek: { ...lagring, handelsefiler: true } })).toBe(fixtur("lagringsregelfragment-0.127.0-handelsefiler.rules"));
    expect(lagringsregelfragment({ bibliotek: { ...lagring, handelsefiler: true, arendefiler: false } })).toBe(fixtur("lagringsregelfragment-0.127.0-handelsefiler.rules"));
  });

  it("fixturerna är inte tomma (golv), och en ändring som skulle ge andra tecken bryter jämförelsen", () => {
    for (const f of ["bibliotekregelfragment-0.128.0.rules", "bibliotekregelfragment-0.128.0-handelser.rules", "lagringsregelfragment-0.127.0.rules", "lagringsregelfragment-0.127.0-handelsefiler.rules"]) {
      expect(fixtur(f).length, f).toBeGreaterThan(4000);
    }
    expect(bibliotekregelfragment("bibliotek", { ...sok, handelser: "handelser", arenden: "inkorg" })).not.toBe(fixtur("bibliotekregelfragment-0.128.0-handelser.rules"));
    expect(lagringsregelfragment({ bibliotek: { ...lagring, handelsefiler: true, arendefiler: true } })).not.toBe(fixtur("lagringsregelfragment-0.127.0-handelsefiler.rules"));
  });

  it("utan arenden finns ingen ärendegren, och en händelse rubbas inte av att ärendet läggs till", () => {
    const utan = bibliotekregelfragment("bibliotek", { ...sok, handelser: "handelser" });
    expect(utan).not.toContain("Arende");
    expect(utan).not.toContain("arende");
    const med = bibliotekregelfragment("bibliotek", { ...sok, handelser: "handelser", arenden: "inkorg" });
    // Allt händelsen hade finns kvar i texten, ordagrant, och ärendegrenen har kommit till.
    const handelserader = utan.split("\n").filter((r) => /Handelse/.test(r) && !/opsBibliotekPlats|return opsBibliotekArHandelse|^\s*opsBibliotekArHandelse|\? opsBibliotekHandelsePerson/.test(r));
    // Golv: ett prov över ingenting vore grönt av fel skäl.
    expect(handelserader.length).toBeGreaterThan(9);
    for (const rad of handelserader) expect(med, rad).toContain(rad);
    expect(med.length).toBeGreaterThan(utan.length);
  });

  it("med arenden finns grenen, formen och uppslaget av ärendets grupp, i samlingen appen namngav", () => {
    const med = bibliotekregelfragment("bibliotek", { ...sok, arenden: "inkorg" });
    expect(med.length).toBeGreaterThan(bibliotekregelfragment("bibliotek").length);
    expect(med).toContain("function opsBibliotekArendeHor(gid)");
    expect(med).toContain("/documents/inkorg/$(gid.split('~')[2])");
    expect(med).toContain("get(opsBibliotekArendet(gid)).data.groupId == gid.split('~')[1]");
    expect(med).toContain(ARENDEFORM.source.replace(/^\^|\$$/g, ""));
    // Bara ärendet: ingen händelsegren följer med.
    expect(med).not.toContain("Handelse");
    expect(() => bibliotekregelfragment("bibliotek", { ...sok, arenden: "a b" })).toThrow();
    // Samlingsnamnet är appens: ett annat namn ger ett annat uppslag, och ramverket har inget förval.
    expect(bibliotekregelfragment("bibliotek", { ...sok, arenden: "arendeposter" })).toContain("/documents/arendeposter/$(gid.split('~')[2])");
  });

  it("med både handelser och arenden slås varje id upp i sin egen samling", () => {
    const bada = bibliotekregelfragment("bibliotek", { ...sok, handelser: "handelser", arenden: "inkorg" });
    expect(bada).toContain("/documents/handelser/$(gid.split('~')[2])");
    expect(bada).toContain("/documents/inkorg/$(gid.split('~')[2])");
    expect(bada).toContain("opsBibliotekArHandelse(gid) ? opsBibliotekHandelseMedlem(gid) : opsBibliotekArArende(gid) ? opsBibliotekArendeMedlem(gid) : opsBibliotekArMitt(gid)");
  });

  it("lagringen har ärendegrenen bara med arendefiler: true, och prövar formen innan den delar upp platsen", () => {
    const med = lagringsregelfragment({ bibliotek: { ...lagring, arendefiler: true } });
    expect(med).toContain("function opsFilArArende(gid)");
    expect(med).toContain(`gid.matches('${ARENDEFORM.source.replace(/^\^|\$$/g, "")}') && opsFilArMedlem(opsFilMedlemsplats(gid))`);
    expect(med).not.toContain("opsFilArHandelse");
    const bada = lagringsregelfragment({ bibliotek: { ...lagring, handelsefiler: true, arendefiler: true } });
    expect(bada).toContain("opsFilArHandelse(gid) || opsFilArArende(gid) ? gid.split('~')[1] : gid");
    expect(lagringsregelfragment({ bibliotek: { ...lagring, arendefiler: false } })).not.toContain("arende");
  });
});

describe("Delning av en fil på ett ärende", () => {
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

  it("en utomstående och en annan grupps ägare delar inte, och admin delar allas", async () => {
    const { tjanst } = bygg();
    await expect(tjanst.skapa({ uid: UTOMSTAENDE, postId: "p1", groupId: PLATS, dagar: 7, gruppdel: "kallan", fildel: "biljett" })).rejects.toThrow(/inte aktiv medlem/);
    await expect(tjanst.skapa({ uid: "ingen", postId: "p1", groupId: PLATS, dagar: 7, gruppdel: "kallan", fildel: "biljett" })).rejects.toThrow(/inte aktiv medlem/);
    await expect(tjanst.skapa({ uid: ADMIN, postId: "p1", groupId: PLATS, dagar: 7, gruppdel: "kallan", fildel: "biljett" })).resolves.toMatchObject({ adress: expect.any(String) });
  });

  it("platsens grupp i anropet måste vara postens: en medlem i gruppen delar inte under ett annat ärende", async () => {
    const { tjanst } = bygg();
    await expect(tjanst.skapa({ uid: MEDLEM, postId: "p1", groupId: arendeBibliotek(GRUPP, "a2"), dagar: 7, gruppdel: "kallan", fildel: "biljett" })).rejects.toThrow(/finns inte i platsen/);
    await expect(tjanst.skapa({ uid: MEDLEM, postId: "p1", groupId: GRUPP, dagar: 7, gruppdel: "kallan", fildel: "biljett" })).rejects.toThrow(/finns inte i platsen/);
  });
});

describe("Städningen när ett ärende tas bort för gott", () => {
  function bygg() {
    const source = createMemorySource({
      bibliotek: [
        { id: "a", ...fil(PLATS) },
        { id: "b", ...fil(PLATS) },
        { id: "c", ...fil(arendeBibliotek(GRUPP, "a2")) },
        { id: "d", ...fil(GRUPP) },
        { id: "e", ...fil(HPLATS) },
      ],
    });
    return { source, tjanst: createPlatsfilerService({ kalla: source, samlingar: { bibliotek: "bibliotek" } }) };
  }

  it("torrt räknar och rör inget, med alla fält i rapporten", async () => {
    const { tjanst, source } = bygg();
    const r = await tjanst.stada({ plats: PLATS, skarpt: false });
    expect(r).toEqual({ skarpt: false, plats: PLATS, funna: 2, raderade: 0, fel: [] });
    expect(await source.list("bibliotek", {})).toHaveLength(5);
  });

  it("skarpt raderar ärendets poster och inga andra, inte heller en händelses eller gruppens", async () => {
    const { tjanst, source } = bygg();
    const r = await tjanst.stada({ plats: PLATS, skarpt: true });
    expect(r).toEqual({ skarpt: true, plats: PLATS, funna: 2, raderade: 2, fel: [] });
    expect((await source.list("bibliotek", {})).map((p) => p.id).sort()).toEqual(["c", "d", "e"]);
  });

  it("en händelseplats städas av samma tjänst, och gamla createHandelsefilerService gör som förut", async () => {
    const { tjanst, source } = bygg();
    expect(await tjanst.stada({ plats: HPLATS, skarpt: true })).toEqual({ skarpt: true, plats: HPLATS, funna: 1, raderade: 1, fel: [] });
    const gammal = createHandelsefilerService({ kalla: source, samlingar: { bibliotek: "bibliotek" } });
    expect(await gammal.stada({ groupId: GRUPP, handelseId: "h1", skarpt: false })).toEqual({ skarpt: false, plats: HPLATS, funna: 0, raderade: 0, fel: [] });
  });

  it("ett ärende utan filer är noll och inte ostält", async () => {
    const { tjanst } = bygg();
    expect(await tjanst.stada({ plats: arendeBibliotek(GRUPP, "tom"), skarpt: true })).toEqual({ skarpt: true, plats: arendeBibliotek(GRUPP, "tom"), funna: 0, raderade: 0, fel: [] });
  });

  it("gruppens egen plats, Mitt bibliotek och en plats med fel form städas inte: allt kastar innan något läses eller raderas", async () => {
    const { tjanst, source } = bygg();
    const lasa = vi.spyOn(source, "list");
    const rada = vi.spyOn(source, "remove");
    for (const plats of [GRUPP, mittBibliotek("uidKim"), "arende~cps-ab", "arende~cps-ab~a1~x", "", undefined, null]) {
      await expect(tjanst.stada({ plats, skarpt: true }), String(plats)).rejects.toThrow(/ingen händelses eller ärendes plats/);
    }
    expect(lasa).not.toHaveBeenCalled();
    expect(rada).not.toHaveBeenCalled();
    expect(await source.list("bibliotek", {})).toHaveLength(5);
  });

  it("ett fel på en post stoppar inte de andra och tystas inte", async () => {
    const { source } = bygg();
    const flaky = { ...source, list: source.list.bind(source), remove: async (c, id) => { if (id === "a") throw new Error("nekad"); return source.remove(c, id); } };
    const r = await createPlatsfilerService({ kalla: flaky, samlingar: { bibliotek: "bibliotek" } }).stada({ plats: PLATS, skarpt: true });
    expect(r).toMatchObject({ funna: 2, raderade: 1, fel: [{ id: "a", fel: "nekad" }] });
  });

  it("en felsvarande källa kan inte få den att radera en annan plats poster", async () => {
    const { source } = bygg();
    const lurande = { ...source, list: async () => [{ id: "d", ...fil(GRUPP) }], remove: source.remove.bind(source) };
    const r = await createPlatsfilerService({ kalla: lurande, samlingar: { bibliotek: "bibliotek" } }).stada({ plats: PLATS, skarpt: true });
    expect(r.raderade).toBe(0);
    expect(r.fel).toHaveLength(1);
    expect(await source.read("bibliotek", "d")).not.toBeNull();
  });

  it("kräver skarpt sagt och ett samlingsnamn, och felen pekar på den fabrik som anropades", async () => {
    const { tjanst, source } = bygg();
    await expect(tjanst.stada({ plats: PLATS })).rejects.toThrow(/skarpt/);
    expect(() => createPlatsfilerService({ kalla: source, samlingar: {} })).toThrow(/createPlatsfilerService: samlingar.bibliotek/);
    expect(() => createPlatsfilerService({ kalla: {}, samlingar: { bibliotek: "b" } })).toThrow(/createPlatsfilerService: en datakälla med list och remove/);
    expect(() => createHandelsefilerService({ kalla: source, samlingar: {} })).toThrow(/createHandelsefilerService: samlingar.bibliotek/);
  });
});
