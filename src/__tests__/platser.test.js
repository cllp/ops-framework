import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { createBibliotekskalla, flyttaBibliotekspost } from "../data/bibliotekkalla.js";
import { createPlatskalla } from "../data/platskalla.js";
import {
  PLATSFORM,
  PLATSIDFORM,
  PLATS_PREFIX,
  arArendeBibliotek,
  arHandelseBibliotek,
  arObjektbibliotek,
  arPlatsBibliotek,
  arendeBibliotek,
  beskrivObjektbibliotek,
  byggPost,
  farAndra,
  gruppForPlats,
  handelseBibliotek,
  mittBibliotek,
  platsBibliotek,
  platsdelar,
  postFel,
} from "../lib/bibliotek.js";
import { harledKategoriId, ID_FORM } from "../lib/katalog.js";
import { MAX_PLATSNAMN, PLATSFALT, PLATSFALT_FORVALTAD, arForvaltad, byggForvaltadPlats, uppdateraForvaltadPlats, byggPlats, farAndraPlats, harledPlatsId, lasPlatser, platsFranRad, platsidFel, platsnamnFel, platsnyckel, platsval } from "../lib/platser.js";
import { bibliotekregelfragment, lagringsregelfragment, platsregelfragment } from "../lib/regler.js";

/**
 * Gruppens egna platser (0.155.0, cllp/ops-framework#469): platsformen, modellen, källan, flytten och regelfragmenten (byte för byte utan valet). Reglerna provas i emulatorn
 * (`rules/__tests__/platser.test.mjs`); vyn i `platser-vy.test.jsx`.
 *
 * ⛔ VARJE PROV HAR SETTS FALLA (regel 4): rött med koden muterad eller borttagen, grönt med den. Utfallen står i PR-texten och i CHANGELOG.
 */

const GRUPP = "cps-ab";
const KIM = "uidKim";
const ANNA = "uidAnna";
const NU = 1_800_000_000_000;
const rot = path.resolve(__dirname, "..", "..");
const fixtur = (namn) => fs.readFileSync(path.join(rot, "rules", "__fixturer__", namn), "utf8");
const skapare = (uid = KIM) => ({ uid, namn: "Kim", typ: "manniska", kalla: "bibliotek" });

describe("Platsen plats~<grupp>~<id>", () => {
  it("är plats~<grupp>~<id>, och prefixet är det som står i konstanten", () => {
    expect(platsBibliotek(GRUPP, "demos")).toBe("plats~cps-ab~demos");
    expect(platsBibliotek(GRUPP, "demos").startsWith(PLATS_PREFIX)).toBe(true);
    expect(platsBibliotek(GRUPP, "a".repeat(24))).toBe(`plats~cps-ab~${"a".repeat(24)}`);
    // Projekt-modulen gör platsens id till projektets tagg: gemener, siffror och bindestreck.
    expect(platsBibliotek(GRUPP, "ombyggnad-2027")).toBe("plats~cps-ab~ombyggnad-2027");
  });

  it("tolkas tillbaka till grupp och plats, och allt annat är ingen egen plats", () => {
    expect(platsdelar("plats~cps-ab~demos")).toEqual({ groupId: "cps-ab", platsId: "demos" });
    expect(arPlatsBibliotek("plats~cps-ab~demos")).toBe(true);
    const inte = ["cps-ab", mittBibliotek(KIM), handelseBibliotek(GRUPP, "h1"), arendeBibliotek(GRUPP, "a1"), "post~abc", "plats~cps-ab", "plats~cps-ab~", "plats~~demos", "plats~cps-ab~demos~x", "plats~CPS~demos", "plats~cps-ab~Demos", "plats~cps-ab~de mos", "plats~cps-ab~a/b", `plats~cps-ab~${"a".repeat(25)}`, "plats~cps ab~demos", "", null, undefined, 3];
    for (const i of inte) {
      expect(arPlatsBibliotek(i), String(i)).toBe(false);
      expect(platsdelar(i), String(i)).toBeNull();
    }
  });

  it("kastar för ett grupp-id eller plats-id som inte går att använda, hellre än att bygga en plats som aldrig släpps in", () => {
    expect(() => platsBibliotek("", "demos")).toThrow(/går inte att använda/);
    expect(() => platsBibliotek(GRUPP, "")).toThrow(/går inte att använda/);
    expect(() => platsBibliotek(GRUPP, "Demos")).toThrow();
    expect(() => platsBibliotek(GRUPP, "a".repeat(25))).toThrow();
    expect(() => platsBibliotek("cps~ab", "demos")).toThrow();
    expect(() => platsBibliotek(GRUPP, "a~b")).toThrow();
  });

  it("kan inte likna en grupp, Mitt bibliotek, en händelse eller ett ärende, och är inget objekt", () => {
    const p = platsBibliotek(GRUPP, "demos");
    expect(ID_FORM.test(p)).toBe(false);
    expect(arHandelseBibliotek(p)).toBe(false);
    expect(arArendeBibliotek(p)).toBe(false);
    // ⛔ En egen plats är sortering och inget objekt: den får anteckningar och länkar, och filerna flyttas dit och därifrån.
    expect(arObjektbibliotek(p)).toBe(false);
    expect(beskrivObjektbibliotek(p)).toBeNull();
  });

  it("gruppen på platsen är gruppens medlemskap, och en felaktig plats ges tillbaka som den är", () => {
    expect(gruppForPlats("plats~cps-ab~demos")).toBe("cps-ab");
    expect(gruppForPlats("cps-ab")).toBe("cps-ab");
    expect(gruppForPlats("plats~cps-ab")).toBe("plats~cps-ab");
    expect(gruppForPlats("plats~cps-ab~demos~x")).toBe("plats~cps-ab~demos~x");
  });

  it("gruppdelen i formen är ID_FORM och id-delen är PLATSIDFORM", () => {
    for (const g of ["a1", "1a", "a_b-c", "cps-ab"]) expect(arPlatsBibliotek(`plats~${g}~x`), g).toBe(true);
    for (const g of ["A", "-a", "a b", "å"]) expect(arPlatsBibliotek(`plats~${g}~x`), g).toBe(false);
    expect(PLATSFORM.source).toContain(PLATSIDFORM.source.replace(/^\^|\$$/g, ""));
  });

  it("en post på platsen är en giltig post av alla fyra typer, och författaren får ändra enligt gruppens roller", () => {
    const plats = platsBibliotek(GRUPP, "demos");
    const bas = { groupId: plats, rubrik: "Demo", skapadAv: skapare(), skapad: NU, andrad: NU };
    expect(postFel({ ...bas, typ: "anteckning", text: "x" })).toBeNull();
    expect(postFel({ ...bas, typ: "lank", url: "https://example.com/" })).toBeNull();
    expect(postFel({ ...bas, typ: "lista", poster: [] })).toBeNull();
    expect(postFel({ ...bas, typ: "fil", fil: { sokvag: `grupper/${plats}/bibliotek/p1/d.pdf`, namn: "d.pdf", mime: "application/pdf", byte: 4 } })).toBeNull();
    expect(byggPost({ ...bas, typ: "anteckning", text: "x" }).groupId).toBe(plats);
    expect(postFel({ ...bas, groupId: "plats~cps-ab", typ: "anteckning", text: "x" })).toMatch(/inte ett grupp-id/);
    const post = { groupId: plats, skapadAv: { uid: KIM } };
    expect(farAndra(post, { uid: KIM, roll: "medlem", groupId: GRUPP, status: "aktiv" })).toBe(true);
    expect(farAndra(post, { uid: ANNA, roll: "admin", groupId: GRUPP, status: "aktiv" })).toBe(true);
    expect(farAndra(post, { uid: ANNA, roll: "medlem", groupId: GRUPP, status: "aktiv" })).toBe(false);
    // Medlemskapet i en ANNAN grupp ger ingenting på platsen.
    expect(farAndra(post, { uid: ANNA, roll: "admin", groupId: "andra-ab", status: "aktiv" })).toBe(false);
  });
});

describe("Platsens id", () => {
  it("härleds ur namnet: gemener, å och ä till a, ö till o, högst 24 tecken, och det följer alltid PLATSIDFORM", () => {
    expect(harledPlatsId("Demos")).toBe("demos");
    expect(harledPlatsId("Räksmörgåsar och Annat")).toBe("raksmorgasar-och-anna");
    expect(harledPlatsId("Live 2026")).toBe("live-2026");
    expect(harledPlatsId("Ett mycket långt namn som aldrig ryms i ett plats-id")).toHaveLength(21);
    for (const namn of ["Demos", "Ett mycket långt namn som aldrig ryms i ett plats-id", "!!!", "日本語", "å", "-x-", "A_B"]) {
      expect(PLATSIDFORM.test(harledPlatsId(namn)), namn).toBe(true);
      expect(PLATSIDFORM.test(harledPlatsId(namn, [harledPlatsId(namn)])), `${namn} med suffix`).toBe(true);
    }
  });

  it("ger plats när namnet inte ger något tecken, och ett suffix när id:t finns (arkiverade räknas också)", () => {
    expect(harledPlatsId("!!!")).toBe("plats");
    expect(harledPlatsId("Demos", ["demos"])).toBe("demos-2");
    expect(harledPlatsId("Demos", ["demos", "demos-2"])).toBe("demos-3");
    // Det långa namnet får plats för suffixet inom 24 tecken.
    const lang = "x".repeat(40);
    expect(harledPlatsId(lang, [harledPlatsId(lang)])).toHaveLength(23);
  });

  it("delar sin normalisering med kategorins id och ändrar inte den", () => {
    expect(harledKategoriId("Räksmörgåsar och Annat")).toBe("raksmorgasar-och-annat");
    expect(harledKategoriId("!!!")).toBe("kategori");
    expect(harledKategoriId("x".repeat(60))).toHaveLength(48);
    expect(harledKategoriId("Demos", ["demos"])).toBe("demos-2");
  });

  it("platsidFel säger varför ett id inte går att använda", () => {
    expect(platsidFel("demos")).toBeNull();
    for (const id of ["Demos", "", "a b", "a".repeat(25), "-a", "a~b", 5, null]) expect(platsidFel(id), String(id)).toMatch(/går inte att använda/);
  });
});

describe("byggPlats och namnet", () => {
  it("bygger raden som skrivs: nyckel, plats, och exakt fälten i PLATSFALT, oarkiverad", () => {
    const p = byggPlats({ groupId: GRUPP, namn: "  Demos  ", skapadAv: skapare(), skapad: NU });
    expect(p.nyckel).toBe("cps-ab|demos");
    expect(p.plats).toBe("plats~cps-ab~demos");
    expect(Object.keys(p.rad).sort()).toEqual([...PLATSFALT].sort());
    expect(p.rad).toMatchObject({ groupId: GRUPP, namn: "Demos", skapad: NU, arkiverad: false });
    expect(p).not.toHaveProperty("rad.id");
  });

  it("id anges av anroparen, annars härleds det, och ett id som finns eller inte går att använda kastar", () => {
    expect(byggPlats({ groupId: GRUPP, namn: "Ombyggnad", id: "ombyggnad-2027", skapadAv: skapare() }).id).toBe("ombyggnad-2027");
    expect(byggPlats({ groupId: GRUPP, namn: "Demos", skapadAv: skapare(), befintliga: [{ id: "demos", namn: "Gamla" }] }).id).toBe("demos-2");
    expect(() => byggPlats({ groupId: GRUPP, namn: "X", id: "demos", skapadAv: skapare(), befintliga: [{ id: "demos", namn: "Demos" }] })).toThrow(/redan en plats med id:t demos/);
    expect(() => byggPlats({ groupId: GRUPP, namn: "X", id: "Demos", skapadAv: skapare() })).toThrow(/går inte att använda/);
  });

  it("kastar för en grupp som inte är ett grupp-id, en skapare utan uid eller som inte är en människa, och ett tomt eller dubbelt namn", () => {
    expect(() => byggPlats({ groupId: "plats~x~y", namn: "X", skapadAv: skapare() })).toThrow(/groupId/);
    expect(() => byggPlats({ groupId: GRUPP, namn: "X", skapadAv: { namn: "x", typ: "manniska", kalla: "x" } })).toThrow();
    expect(() => byggPlats({ groupId: GRUPP, namn: "X", skapadAv: { ...skapare(), typ: "agent" } })).toThrow(/manniska/);
    expect(() => byggPlats({ groupId: GRUPP, namn: "   ", skapadAv: skapare() })).toThrow(/behöver ett namn/);
    expect(() => byggPlats({ groupId: GRUPP, namn: "demos", skapadAv: skapare(), befintliga: [{ id: "a", namn: "Demos" }] })).toThrow(/redan en plats som heter Demos/);
  });

  it("namnet prövas som regeln gör: trimmat som Firestores trim, högst MAX_PLATSNAMN, och felet finns på båda språken", () => {
    expect(platsnamnFel("Demos")).toBeNull();
    expect(platsnamnFel("å".repeat(MAX_PLATSNAMN))).toBeNull();
    expect(platsnamnFel("å".repeat(MAX_PLATSNAMN + 1))).toMatch(/Taket är 60/);
    // U+00A0 är inte ett blanktecken för Firestores trim, och modellen räknar tomhet som regeln: namnet är då inte tomt.
    expect(platsnamnFel(" ")).toBeNull();
    expect(platsnamnFel("")).toBe("Platsen behöver ett namn.");
    expect(platsnamnFel("  ", { sprak: "en" })).toBe("The place needs a name.");
    expect(platsnamnFel("x".repeat(61), { sprak: "en" })).toBe("The name is 61 characters. The limit is 60.");
    expect(platsnamnFel("DEMOS", { befintliga: [{ id: "a", namn: "demos" }], sprak: "en" })).toBe("There is already a place called demos.");
    // Byta namn på sig själv räknas inte som en dubblett.
    expect(platsnamnFel("Demos", { befintliga: [{ id: "a", namn: "Demos" }], utom: "a" })).toBeNull();
  });

  it("platsnyckel kräver grupp-id och plats-id", () => {
    expect(platsnyckel(GRUPP, "demos")).toBe("cps-ab|demos");
    expect(() => platsnyckel("a|b", "demos")).toThrow();
    expect(() => platsnyckel(GRUPP, "a|b")).toThrow();
    expect(() => platsnyckel(GRUPP, "Demos")).toThrow();
  });
});

describe("Raderna som platser", () => {
  const rad = (id, extra = {}) => ({ id, groupId: GRUPP, namn: "Demos", skapadAv: skapare(), skapad: NU, arkiverad: false, ...extra });

  it("läser en rad till en plats med adressen, och en trasig rad står i trasiga i stället för att tystas", () => {
    const { platser, trasiga } = lasPlatser([rad("cps-ab|live", { namn: "Live" }), rad("cps-ab|demos"), rad("dålig-nyckel"), rad("cps-ab|x", { groupId: "andra-ab" }), rad("cps-ab|y", { namn: "  " })]);
    expect(platser.map((p) => [p.id, p.plats, p.namn])).toEqual([["demos", "plats~cps-ab~demos", "Demos"], ["live", "plats~cps-ab~live", "Live"]]);
    expect(trasiga.map((t) => t.id).sort()).toEqual(["cps-ab|x", "cps-ab|y", "dålig-nyckel"]);
    expect(trasiga.every((t) => t.fel.length > 0)).toBe(true);
  });

  it("tomt är ett svar: noll rader ger noll platser och noll trasiga", () => {
    expect(lasPlatser([])).toEqual({ platser: [], trasiga: [] });
  });

  it("en arkiverad plats finns i listan men inte bland valen", () => {
    const { platser } = lasPlatser([rad("cps-ab|demos"), rad("cps-ab|gamla", { namn: "Gamla", arkiverad: true })]);
    expect(platser).toHaveLength(2);
    expect(platsval(platser)).toEqual([{ id: "plats~cps-ab~demos", namn: "Demos" }]);
    expect(platsFranRad(rad("cps-ab|gamla", { arkiverad: true }))).toMatchObject({ plats: { arkiverad: true } });
  });

  it("farAndraPlats: skaparen, ägare och admin som aktiva personer i platsens grupp, ingen annan", () => {
    const plats = { groupId: GRUPP, skapadAv: { uid: KIM } };
    const jag = (extra) => ({ uid: ANNA, roll: "medlem", groupId: GRUPP, status: "aktiv", ...extra });
    expect(farAndraPlats(plats, jag({ uid: KIM }))).toBe(true);
    expect(farAndraPlats(plats, jag({ roll: "admin" }))).toBe(true);
    expect(farAndraPlats(plats, jag({ roll: "agare" }))).toBe(true);
    expect(farAndraPlats(plats, jag())).toBe(false);
    expect(farAndraPlats(plats, jag({ uid: KIM, status: "avslutad" }))).toBe(false);
    expect(farAndraPlats(plats, jag({ roll: "admin", groupId: "andra-ab" }))).toBe(false);
    expect(farAndraPlats(plats, jag({ uid: KIM, typ: "agent" }))).toBe(false);
    expect(farAndraPlats(plats, null)).toBe(false);
    expect(farAndraPlats(plats, { roll: "admin" })).toBe(false);
  });
});

describe("Platskällan", () => {
  function kalla(extra = {}) {
    const source = createMemorySource();
    const k = createPlatskalla({ source, platser: "bibliotekplatser", groupId: GRUPP, skapare: () => skapare(), ...extra });
    return { source, k };
  }

  it("kräver källa, samlingsnamn, grupp och skapare, och väljer aldrig något av dem själv", () => {
    const source = createMemorySource();
    expect(() => createPlatskalla({ platser: "p", groupId: GRUPP, skapare })).toThrow(/source krävs/);
    expect(() => createPlatskalla({ source, groupId: GRUPP, skapare })).toThrow(/Ramverket känner aldrig samlingsnamnet/);
    expect(() => createPlatskalla({ source, platser: "p", skapare })).toThrow(/groupId krävs/);
    expect(() => createPlatskalla({ source, platser: "p", groupId: "plats~a~b", skapare })).toThrow(/groupId krävs/);
    expect(() => createPlatskalla({ source, platser: "p", groupId: GRUPP })).toThrow(/skapare krävs/);
    expect(() => createPlatskalla({ source, platser: "a/b", groupId: GRUPP, skapare })).toThrow(/Ramverket känner aldrig samlingsnamnet/);
  });

  it("skapar en plats med nyckeln <grupp>|<id>, skaparen från appen och klockan nu, och las visar den", async () => {
    const { source, k } = kalla();
    expect(await k.las()).toMatchObject({ platser: [], trasiga: [], kalla: "databas", fel: null });
    const ny = await k.skapa({ namn: "Demos" });
    expect(ny).toMatchObject({ id: "demos", groupId: GRUPP, plats: "plats~cps-ab~demos", namn: "Demos", arkiverad: false });
    expect(ny.skapadAv.uid).toBe(KIM);
    const lagrad = await source.read("bibliotekplatser", "cps-ab|demos");
    expect(lagrad).toMatchObject({ groupId: GRUPP, namn: "Demos", arkiverad: false });
    expect(Object.keys(lagrad).sort()).toEqual([...PLATSFALT, "id"].sort());
    expect(Math.abs(lagrad.skapad - Date.now())).toBeLessThan(5000);
    expect((await k.las()).platser.map((p) => p.plats)).toEqual(["plats~cps-ab~demos"]);
  });

  it("id anges av anroparen (Projekt: projektets tagg), och ett dubblettnamn eller id kastar innan något skrivs", async () => {
    const { source, k } = kalla();
    expect((await k.skapa({ namn: "Ombyggnad", id: "ombyggnad-2027" })).plats).toBe("plats~cps-ab~ombyggnad-2027");
    await expect(k.skapa({ namn: "Annat", id: "ombyggnad-2027" })).rejects.toThrow(/redan en plats med id:t/);
    await expect(k.skapa({ namn: "OMBYGGNAD" })).rejects.toThrow(/redan en plats som heter Ombyggnad/);
    await expect(k.skapa({ namn: "  " })).rejects.toThrow(/behöver ett namn/);
    expect(await source.list("bibliotekplatser", {})).toHaveLength(1);
    // Ett namn som ger samma id men ett annat namn får ett suffix.
    expect((await k.skapa({ namn: "Demo", id: "demo" })).id).toBe("demo");
    expect((await k.skapa({ namn: "Demo!" })).id).toBe("demo-2");
  });

  it("skriver aldrig över: med createNew säger ett upptaget id det, och en nekad skrivning blir en mening", async () => {
    const source = createMemorySource();
    const k = createPlatskalla({ source, platser: "p", groupId: GRUPP, skapare: () => skapare() });
    await k.skapa({ namn: "Demos" });
    const raceSource = { ...source, list: async () => [], createNew: source.createNew, read: source.read, update: source.update, create: source.create };
    const k2 = createPlatskalla({ source: raceSource, platser: "p", groupId: GRUPP, skapare: () => skapare(ANNA) });
    await expect(k2.skapa({ namn: "Demos" })).rejects.toThrow(/redan en plats med id:t demos/);
    expect((await source.read("p", "cps-ab|demos")).skapadAv.uid).toBe(KIM);
    const nekad = { ...source, create: async () => { throw Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" }); } };
    delete nekad.createNew;
    const k3 = createPlatskalla({ source: nekad, platser: "q", groupId: GRUPP, skapare: () => skapare() });
    await expect(k3.skapa({ namn: "Live" })).rejects.toThrow(/Platsen skapades inte\. Platsen kan redan finnas med det id:t, eller så får du inte ändra den/);
  });

  it("byter namn utan att röra id:t, arkiverar och tar fram, och ingenting raderas", async () => {
    const { source, k } = kalla();
    await k.skapa({ namn: "Demos" });
    await k.skapa({ namn: "Live" });
    const nytt = await k.byttNamn("demos", "Demoinspelningar");
    expect(nytt).toMatchObject({ id: "demos", namn: "Demoinspelningar", plats: "plats~cps-ab~demos" });
    await expect(k.byttNamn("demos", "live")).rejects.toThrow(/redan en plats som heter Live/);
    await expect(k.byttNamn("demos", " ")).rejects.toThrow(/behöver ett namn/);
    expect((await k.arkivera("demos")).arkiverad).toBe(true);
    expect(platsval((await k.las()).platser)).toEqual([{ id: "plats~cps-ab~live", namn: "Live" }]);
    expect((await k.taFram("demos")).arkiverad).toBe(false);
    expect(await source.list("bibliotekplatser", {})).toHaveLength(2);
    await expect(k.arkivera("finns-inte")).rejects.toThrow();
  });

  it("läsningen kastar inte: ett fel i källan blir kalla fel, och bara gruppens egna platser ingår", async () => {
    const { source, k } = kalla();
    await source.create("bibliotekplatser", { id: "andra-ab|x", groupId: "andra-ab", namn: "Annans", skapadAv: skapare(), skapad: NU, arkiverad: false });
    await k.skapa({ namn: "Demos" });
    expect((await k.las()).platser.map((p) => p.namn)).toEqual(["Demos"]);
    const trasig = createPlatskalla({ source: { ...source, list: async () => { throw new Error("nere"); } }, platser: "bibliotekplatser", groupId: GRUPP, skapare: () => skapare() });
    expect(await trasig.las()).toMatchObject({ platser: [], kalla: "fel", fel: expect.objectContaining({ message: "nere" }) });
  });

  it("prenumerera finns bara när källan kan strömma, kräver onFel och ger samma svar som las", () => {
    const { k } = kalla();
    expect(k.prenumerera).toBeUndefined();
    const lyssnare = vi.fn();
    const avreg = vi.fn();
    const subscribe = vi.fn((samling, fraga, { onData }) => {
      onData([{ id: "cps-ab|demos", groupId: GRUPP, namn: "Demos", skapadAv: skapare(), skapad: NU, arkiverad: false }]);
      return avreg;
    });
    const k2 = createPlatskalla({ source: { ...createMemorySource(), subscribe }, platser: "p", groupId: GRUPP, skapare: () => skapare() });
    expect(() => k2.prenumerera(lyssnare)).toThrow(/onFel krävs/);
    const stang = k2.prenumerera(lyssnare, () => {});
    expect(subscribe.mock.calls[0][1]).toEqual({ where: { groupId: GRUPP } });
    expect(lyssnare.mock.calls[0][0].platser.map((p) => p.id)).toEqual(["demos"]);
    stang();
    stang();
    expect(avreg).toHaveBeenCalledTimes(1);
  });
});

describe("Posterna på en egen plats, och flytten dit", () => {
  const pdf = { name: "demo.pdf", type: "application/pdf", size: 2000 };
  function kallor() {
    const source = createMemorySource();
    const mk = (groupId) =>
      createBibliotekskalla({
        source,
        collection: "bibliotek",
        groupId,
        skapare: () => skapare(),
        jag: () => ({ uid: KIM, roll: "medlem", groupId: GRUPP, status: "aktiv" }),
        anteckna: () => {},
        lagring: { laddaUpp: vi.fn(async () => {}) },
        sokvag: ({ groupId: g, postId, namn }) => `grupper/${g}/bibliotek/${postId}/${namn}`,
      });
    return { source, plats: mk(platsBibliotek(GRUPP, "demos")), annan: mk(platsBibliotek(GRUPP, "live")), grupp: mk(GRUPP), handelse: mk(handelseBibliotek(GRUPP, "h1")) };
  }

  it("platsen tar emot en anteckning, en länk och en fil, och bara platsens lista ser dem", async () => {
    const { plats, grupp, annan } = kallor();
    await plats.spara({ typ: "anteckning", rubrik: "Idé", text: "x" });
    await plats.spara({ typ: "lank", rubrik: "Länk", url: "https://example.com/" });
    const fil = await plats.laddaUppFil({ rubrik: "Demo", fil: pdf });
    expect(fil.fil.sokvag).toBe(`grupper/plats~cps-ab~demos/bibliotek/${fil.id}/demo.pdf`);
    expect((await plats.las()).poster).toHaveLength(3);
    expect((await plats.las()).trasiga).toEqual([]);
    expect((await grupp.las()).poster).toHaveLength(0);
    expect((await annan.las()).poster).toHaveLength(0);
  });

  it("en post flyttas mellan gruppens plats och en egen plats, och mellan två egna, åt båda håll", async () => {
    const { plats, grupp, annan } = kallor();
    const p = await grupp.spara({ typ: "anteckning", rubrik: "Protokoll", text: "t", taggar: ["styrelse"] });
    const hit = await flyttaBibliotekspost({ fran: grupp, till: plats, id: p.id, satt: "flytta" });
    expect(hit).toMatchObject({ groupId: "plats~cps-ab~demos", rubrik: "Protokoll", taggar: ["styrelse"] });
    expect((await grupp.las()).poster).toHaveLength(0);
    const vidare = await flyttaBibliotekspost({ fran: plats, till: annan, id: hit.id, satt: "kopiera" });
    expect(vidare.groupId).toBe("plats~cps-ab~live");
    expect((await plats.las()).poster).toHaveLength(1);
    await flyttaBibliotekspost({ fran: annan, till: grupp, id: vidare.id, satt: "flytta" });
    expect((await annan.las()).poster).toHaveLength(0);
    expect((await grupp.las()).poster.map((x) => x.rubrik)).toEqual(["Protokoll"]);
    await expect(flyttaBibliotekspost({ fran: plats, till: plats, id: hit.id, satt: "flytta" })).rejects.toThrow("Posten ligger redan där.");
  });

  it("en fil flyttas genom sina byte till platsens sökväg, och in i en händelse går det inte", async () => {
    const { source, plats, grupp, handelse } = kallor();
    const f = await grupp.laddaUppFil({ rubrik: "Demo", fil: pdf });
    const blob = new Blob([new Uint8Array(2000)]);
    const hamtaFil = vi.fn(async () => blob);
    const ny = await flyttaBibliotekspost({ fran: grupp, till: plats, id: f.id, satt: "flytta", hamtaFil });
    expect(hamtaFil).toHaveBeenCalledWith(f.fil.sokvag);
    expect(ny.fil.sokvag).toBe(`grupper/plats~cps-ab~demos/bibliotek/${ny.id}/demo.pdf`);
    await expect(flyttaBibliotekspost({ fran: plats, till: handelse, id: ny.id, satt: "kopiera", hamtaFil })).rejects.toThrow(/händelses bibliotek flyttas inte till/);
    expect(await source.list("bibliotek", {})).toHaveLength(1);
  });
});

describe("Regelfragmenten", () => {
  const sok = { gruppPrefix: "grupper", postPrefix: "bibliotek", handelser: "handelser", arenden: "inkorg" };
  const lagring = { gruppPrefix: "grupper", postPrefix: "bibliotek", samling: "bibliotek", handelsefiler: true, arendefiler: true };

  it("utan platser är texten byte för byte den förra (mätt mot de sparade fixturerna)", () => {
    expect(bibliotekregelfragment("bibliotek")).toBe(fixtur("bibliotekregelfragment-0.128.0.rules"));
    expect(bibliotekregelfragment("bibliotek", { handelser: "handelser" })).toBe(fixtur("bibliotekregelfragment-0.128.0-handelser.rules"));
    expect(lagringsregelfragment({ bibliotek: { gruppPrefix: "grupper", postPrefix: "bibliotek", samling: "bibliotek" } })).toBe(fixtur("lagringsregelfragment-0.127.0.rules"));
    expect(bibliotekregelfragment("bibliotek", sok)).not.toContain("plats~");
    expect(lagringsregelfragment({ bibliotek: lagring })).not.toContain("plats~");
    expect(bibliotekregelfragment("bibliotek", { ...sok, platser: false })).toBe(bibliotekregelfragment("bibliotek", sok));
  });

  it("med platser läggs en gren till, utan uppslag, och händelsens och ärendets grenar är oförändrade", () => {
    const utan = bibliotekregelfragment("bibliotek", sok);
    const med = bibliotekregelfragment("bibliotek", { ...sok, platser: true });
    expect(med).toContain("opsBibliotekArEgenPlats(gid) ? opsBibliotekEgenPlatsMedlem(gid)");
    expect(med).toContain("opsBibliotekArEgenPlats(gid) ? opsBibliotekEgenPlatsAdmin(gid)");
    expect(med).toContain("opsBibliotekArEgenPlats(request.resource.data.groupId)");
    // Grenen slår inte upp någon samling: ingen get() eller exists() mellan funktionens start och slut.
    const funktioner = med.slice(med.indexOf("function opsBibliotekArEgenPlats"), med.indexOf("function opsBibliotekPlatsMedlem"));
    expect(funktioner).not.toMatch(/\bget\(|\bexists\(|documents\//);
    // Alla fyra typer släpps in: inget typ == "fil"-villkor för platsen.
    expect(med).not.toMatch(/opsBibliotekArEgenPlats\(d\.groupId\)/);
    // Händelsens och ärendets funktioner finns kvar, ordagrant.
    const fran = utan.indexOf("function opsBibliotekArHandelse");
    const sista = utan.indexOf("function opsBibliotekArendePerson");
    const till = utan.indexOf("\n    }\n", sista) + "\n    }\n".length;
    expect(fran, "golv: händelsens första funktion hittades").toBeGreaterThan(0);
    expect(sista, "golv: ärendets sista funktion hittades").toBeGreaterThan(fran);
    const block = utan.slice(fran, till);
    expect(block.split("\n").length, "golv: minst 40 rader jämförda").toBeGreaterThan(40);
    expect(med).toContain(block);
    expect(med).toContain("gid.matches('plats~[a-z0-9][a-z0-9_-]*~[a-z0-9][a-z0-9_-]{0,23}')");
  });

  it("lagringsregeln får samma gren, med medlemskapet tolkat ur platsen och ingen uppslagning av platsen", () => {
    const med = lagringsregelfragment({ bibliotek: { ...lagring, platser: true } });
    expect(med).toContain("opsFilArPlats(gid)");
    expect(med).toContain("gid.matches('plats~[a-z0-9][a-z0-9_-]*~[a-z0-9][a-z0-9_-]{0,23}') && opsFilArMedlem(opsFilMedlemsplats(gid))");
    expect(med).toContain("opsFilArHandelse(gid) || opsFilArArende(gid) || opsFilArPlats(gid)");
    // Medlemsplatsen hämtar gruppen ur alla tre objekten.
    expect(lagringsregelfragment({ bibliotek: lagring })).toBe(lagringsregelfragment({ bibliotek: { ...lagring, platser: false } }));
  });

  it("platsregelfragment: nyckeln, fälten, rollerna och att inget raderas står i texten, och krockande samlingsnamn kastar", () => {
    const text = platsregelfragment("bibliotekplatser");
    expect(text).toContain("match /bibliotekplatser/{id}");
    expect(text).toContain('d.keys().hasOnly(["groupId", "namn", "skapadAv", "skapad", "arkiverad", "forvaltas"])');
    expect(text).toContain("id.matches(request.resource.data.groupId + '[|][a-z0-9][a-z0-9_-]{0,23}')");
    expect(text).toContain('affectedKeys().hasOnly(["namn", "arkiverad"])');
    expect(text).toContain("allow delete: if false;");
    expect(text).toContain("opsFarAndraPlatsen(resource.data.groupId, resource.data.skapadAv.uid)");
    expect(() => platsregelfragment("memberships")).toThrow(/en av ramverkets egna/);
    expect(() => platsregelfragment("users")).toThrow(/en av ramverkets egna/);
    expect(() => platsregelfragment("a/b")).toThrow();
  });

  it("platsernas fält i regeln är PLATSFALT och namntaket är MAX_PLATSNAMN (en sanning)", () => {
    const text = platsregelfragment("p");
    expect(text).toContain(`d.namn.size() <= ${MAX_PLATSNAMN}`);
    for (const f of PLATSFALT) expect(text).toContain(`"${f}"`);
  });
});

describe("En plats en modul förvaltar (0.155.0)", () => {
  const FRAN = { groupId: GRUPP, namn: "Ombyggnad", skapadAv: skapare(), skapad: NU, modul: "projekt", id: "ombyggnad-2027" };

  it("byggForvaltadPlats ger dokumentet med forvaltas, nyckeln och namnprövningen, och byggPlats ger aldrig fältet", () => {
    const b = byggForvaltadPlats(FRAN);
    expect(b.nyckel).toBe("cps-ab|ombyggnad-2027");
    expect(b.plats).toBe("plats~cps-ab~ombyggnad-2027");
    expect(b.rad).toMatchObject({ groupId: GRUPP, namn: "Ombyggnad", arkiverad: false, forvaltas: { modul: "projekt" } });
    expect(Object.keys(b.rad).sort()).toEqual([...PLATSFALT_FORVALTAD].sort());
    expect(Object.hasOwn(byggPlats({ groupId: GRUPP, namn: "Fri", skapadAv: skapare() }).rad, "forvaltas")).toBe(false);
    // Samma prövning som vid en fri plats: namn, id, dubbletter och skaparen.
    expect(() => byggForvaltadPlats({ ...FRAN, namn: "  " })).toThrow(/behöver ett namn/);
    expect(() => byggForvaltadPlats({ ...FRAN, namn: "a".repeat(61) })).toThrow(/Taket är 60/);
    expect(() => byggForvaltadPlats({ ...FRAN, id: "Fel Id" })).toThrow(/går inte att använda/);
    expect(() => byggForvaltadPlats({ ...FRAN, befintliga: [{ id: "ombyggnad-2027", namn: "Annat" }] })).toThrow(/redan en plats med id:t/);
    expect(() => byggForvaltadPlats({ ...FRAN, befintliga: [{ id: "x", namn: "ombyggnad" }] })).toThrow(/redan en plats som heter/);
    expect(() => byggForvaltadPlats({ ...FRAN, skapadAv: { uid: KIM, namn: "Bot", typ: "agent", kalla: "agent" } })).toThrow(/skapas av en medlem/);
    // Modulen: krävs, och i id-form.
    expect(() => byggForvaltadPlats({ ...FRAN, modul: undefined })).toThrow(/förvaltare/);
    expect(() => byggForvaltadPlats({ ...FRAN, modul: "Projekt!" })).toThrow(/förvaltare/);
    expect(() => byggForvaltadPlats({ ...FRAN, modul: "a".repeat(49) })).toThrow(/förvaltare/);
  });

  it("id:t härleds ur namnet när det inte anges, som för en fri plats", () => {
    expect(byggForvaltadPlats({ ...FRAN, id: undefined, namn: "Demos" }).id).toBe("demos");
  });

  it("raden läses tillbaka som förvaltad, och en trasig forvaltas räknas som förvaltad (fail closed)", () => {
    const b = byggForvaltadPlats(FRAN);
    const { plats } = /** @type {any} */ (platsFranRad({ id: b.nyckel, ...b.rad }));
    expect(plats.forvaltas).toEqual({ modul: "projekt" });
    expect(arForvaltad(plats)).toBe(true);
    expect(arForvaltad(/** @type {any} */ (platsFranRad({ id: "cps-ab|fri", groupId: GRUPP, namn: "Fri", skapadAv: skapare(), skapad: NU, arkiverad: false })).plats)).toBe(false);
    const trasig = /** @type {any} */ (platsFranRad({ id: b.nyckel, ...b.rad, forvaltas: "projekt" })).plats;
    expect(arForvaltad(trasig)).toBe(true);
    expect(trasig.forvaltas).toEqual({ modul: "" });
    expect(platsval([plats]).map((p) => p.namn)).toEqual(["Ombyggnad"]);
  });

  it("farAndraPlats säger nej för en förvaltad plats, också till skaparen, ägaren och admin", () => {
    const b = byggForvaltadPlats(FRAN);
    const { plats } = /** @type {any} */ (platsFranRad({ id: b.nyckel, ...b.rad }));
    for (const roll of ["medlem", "admin", "agare"]) {
      expect(farAndraPlats(plats, { uid: KIM, roll, groupId: GRUPP, status: "aktiv" }), roll).toBe(false);
    }
    expect(farAndraPlats({ ...plats, forvaltas: undefined }, { uid: KIM, roll: "medlem", groupId: GRUPP, status: "aktiv" })).toBe(true);
  });

  it("uppdateraForvaltadPlats ger bara de fält som ändras, och kastar för fel modul, en fri plats, ett dåligt namn och en tom ändring", () => {
    const b = byggForvaltadPlats(FRAN);
    const { plats } = /** @type {any} */ (platsFranRad({ id: b.nyckel, ...b.rad }));
    expect(uppdateraForvaltadPlats({ plats, modul: "projekt", namn: " Ombyggnad B " })).toEqual({ nyckel: "cps-ab|ombyggnad-2027", andring: { namn: "Ombyggnad B" } });
    expect(uppdateraForvaltadPlats({ plats, modul: "projekt", arkiverad: true }).andring).toEqual({ arkiverad: true });
    expect(uppdateraForvaltadPlats({ plats, modul: "projekt", namn: "Nytt", arkiverad: false }).andring).toEqual({ namn: "Nytt", arkiverad: false });
    // Platsens eget namn är inte en krock med sig själv, men en annans är det.
    expect(uppdateraForvaltadPlats({ plats, modul: "projekt", namn: "Ombyggnad", befintliga: [{ id: plats.id, namn: "Ombyggnad" }] }).andring).toEqual({ namn: "Ombyggnad" });
    expect(() => uppdateraForvaltadPlats({ plats, modul: "projekt", namn: "Live", befintliga: [{ id: "live", namn: "Live" }] })).toThrow(/redan en plats som heter Live/);
    expect(() => uppdateraForvaltadPlats({ plats, modul: "projekt", namn: "" })).toThrow(/behöver ett namn/);
    expect(() => uppdateraForvaltadPlats({ plats, modul: "annan", namn: "X" })).toThrow(/förvaltas av modulen "projekt", inte av "annan"/);
    expect(() => uppdateraForvaltadPlats({ plats: { ...plats, forvaltas: undefined }, modul: "projekt", namn: "X" })).toThrow(/förvaltas inte av någon modul/);
    expect(() => uppdateraForvaltadPlats({ plats, modul: "projekt" })).toThrow(/ingenting att ändra/);
    expect(() => uppdateraForvaltadPlats({ plats, modul: "projekt", arkiverad: /** @type {any} */ ("ja") })).toThrow(/sant eller falskt/);
  });

  it("källan: en klient byter inte namn på, arkiverar eller tar fram en förvaltad plats, med skälet, och ingenting skrivs", async () => {
    const source = createMemorySource();
    const b = byggForvaltadPlats(FRAN);
    await source.create("bibliotekplatser", { id: b.nyckel, ...b.rad });
    const k = createPlatskalla({ source, platser: "bibliotekplatser", groupId: GRUPP, skapare: () => skapare() });
    await expect(k.byttNamn("ombyggnad-2027", "Kapad")).rejects.toThrow(/sköts från modulen projekt och ändras där/);
    await expect(k.arkivera("ombyggnad-2027")).rejects.toThrow(/sköts från modulen projekt/);
    await expect(k.taFram("ombyggnad-2027")).rejects.toThrow(/sköts från modulen projekt/);
    const kvar = (await k.las()).platser[0];
    expect(kvar).toMatchObject({ namn: "Ombyggnad", arkiverad: false, forvaltas: { modul: "projekt" } });
    // Servern skriver raden som uppdateraForvaltadPlats ger, och källan läser den.
    const { nyckel, andring } = uppdateraForvaltadPlats({ plats: kvar, modul: "projekt", namn: "Ombyggnad B", arkiverad: true });
    await source.update("bibliotekplatser", nyckel, andring);
    expect((await k.las()).platser[0]).toMatchObject({ namn: "Ombyggnad B", arkiverad: true, forvaltas: { modul: "projekt" } });
    // En fri plats i samma samling går som förut.
    await k.skapa({ namn: "Fri" });
    await expect(k.byttNamn("fri", "Fri 2")).resolves.toMatchObject({ namn: "Fri 2" });
  });

  it("regelfragmentet: klienten sätter inte fältet och ändrar inget på en plats som har det, och kostar inget extra", () => {
    const text = platsregelfragment("bibliotekplatser");
    expect(text).toContain("!('forvaltas' in request.resource.data)");
    expect(text).toContain("!('forvaltas' in resource.data)");
    expect(text).toContain(`d.keys().hasOnly([${PLATSFALT_FORVALTAD.map((x) => `"${x}"`).join(", ")}])`);
    // Villkoren läser fält på dokumentet: ingen ny get() eller exists() mellan platsens funktioner.
    expect(text.match(/\bget\(|\bexists\(/g) ?? []).toHaveLength(0);
  });
});
