import { describe, it, expect } from "vitest";
import { createCatalogSource } from "../data/katalogkalla.js";
import { createMemorySource } from "../data/adapters.js";

/**
 * Katalogkällan (#110). Firestore är sanningen, repot bär standardvärdena.
 *
 * ⛔ PROVEN HANDLAR OM DE TRE FRÅGOR SOM ANNARS BESVARAS I ETT HUVUD: när
 * seedas något, vad händer när databasen inte svarar, och går de två utfallen
 * att skilja åt efteråt. Ett prov som bara läser en fylld samling svarar på
 * ingen av dem.
 */

const IKONER = ["check", "bell"];
const STANDARD = [
  { id: "uppgift", namn: { sv: "Uppgifter", en: "Tasks" }, farg: 1, ikon: "check", fas: "aktiv", ordning: 0 },
  { id: "paminnelse", namn: { sv: "Påminnelser", en: "Reminders" }, farg: 2, ikon: "bell", fas: "vantar", ordning: 1 },
];

/** En källa som alltid faller, för att prova reservvägen. */
const trasigKalla = (fel = new Error("Missing or insufficient permissions.")) => ({
  name: "trasig",
  read: async () => { throw fel; },
  list: async () => { throw fel; },
  create: async () => { throw fel; },
  update: async () => { throw fel; },
  remove: async () => { throw fel; },
});

describe("katalogkällan", () => {
  it("läser ur databasen när den svarar, och säger att det var därifrån", async () => {
    const source = createMemorySource({ kataloger: STANDARD });
    const katalog = createCatalogSource({ source, collection: "kataloger", standard: STANDARD, ikoner: IKONER });

    const svar = await katalog.las();
    expect(svar.kalla).toBe("databas");
    expect(svar.fel).toBeNull();
    expect(svar.kategorier.map((k) => k.id)).toEqual(["uppgift", "paminnelse"]);
  });

  it("⛔ ett läsfel ger standardvärdena OCH säger att det är reserven", async () => {
    /*
     * Ett tyst fall tillbaka betyder att den som nyss arkiverade en kategori
     * ser den kvar och tror att knappen inte fungerade. Svaret måste gå att
     * skilja från ett lyckat.
     */
    const katalog = createCatalogSource({ source: trasigKalla(), collection: "kataloger", standard: STANDARD, ikoner: IKONER });

    const svar = await katalog.las();
    expect(svar.kalla).toBe("reserv");
    expect(svar.fel).toBeInstanceOf(Error);
    expect(svar.fel?.message).toMatch(/permissions/);
    expect(svar.kategorier.map((k) => k.id)).toEqual(["uppgift", "paminnelse"]);
  });

  it("⛔ läsaren kastar aldrig, inte ens när källan gör det", async () => {
    // En vy som får ett kastat fel ritar antingen ingenting eller en tom lista,
    // och en tom lista är samma sak som "det finns inga kategorier".
    const katalog = createCatalogSource({ source: trasigKalla(), collection: "kataloger", standard: STANDARD, ikoner: IKONER });
    await expect(katalog.las()).resolves.toBeTruthy();
  });

  it("⛔ en TOM samling är inte reserven, det är läget före seedningen", async () => {
    const source = createMemorySource({ kataloger: [] });
    const katalog = createCatalogSource({ source, collection: "kataloger", standard: STANDARD, ikoner: IKONER });

    const svar = await katalog.las();
    expect(svar.kalla).toBe("databas");
    expect(svar.kategorier).toEqual([]);
  });

  it("⛔ trasig data i databasen faller till reserven i stället för att ta ned appen", async () => {
    // En kategori med hex i farg är ett fel, och valideringen kastar. Här ska
    // det bli en banderoll, inte en vit sida.
    const source = createMemorySource({ kataloger: [{ ...STANDARD[0], farg: "#c8a227" }] });
    const katalog = createCatalogSource({ source, collection: "kataloger", standard: STANDARD, ikoner: IKONER });

    const svar = await katalog.las();
    expect(svar.kalla).toBe("reserv");
    expect(svar.fel?.message).toMatch(/palettplats/);
  });
});

describe("seedningen", () => {
  it("skriver standardvärdena i en tom samling", async () => {
    const source = createMemorySource({ kataloger: [] });
    const katalog = createCatalogSource({ source, collection: "kataloger", standard: STANDARD, ikoner: IKONER });

    expect(await katalog.seeda()).toEqual({ seedade: true, antal: 2 });
    expect((await source.list("kataloger")).map((k) => k.id)).toEqual(["uppgift", "paminnelse"]);
  });

  it("⛔ rör ALDRIG en samling som redan har värden", async () => {
    /*
     * Annars kommer en kategori som arkiverats tillbaka vid nästa
     * driftsättning, och det ser ut som ett spöke.
     */
    const source = createMemorySource({ kataloger: [{ ...STANDARD[0], arkiverad: true }] });
    const katalog = createCatalogSource({ source, collection: "kataloger", standard: STANDARD, ikoner: IKONER });

    expect(await katalog.seeda()).toEqual({ seedade: false, antal: 1, orsak: "samlingen har redan värden" });
    const kvar = await source.list("kataloger");
    expect(kvar).toHaveLength(1);
    expect(kvar[0].arkiverad).toBe(true);
  });

  it("⛔ svarar med VAD som hände, så de två utfallen går att skilja åt i en logg", async () => {
    const tom = createCatalogSource({ source: createMemorySource({ kataloger: [] }), collection: "kataloger", standard: STANDARD, ikoner: IKONER });
    const fylld = createCatalogSource({ source: createMemorySource({ kataloger: STANDARD }), collection: "kataloger", standard: STANDARD, ikoner: IKONER });

    const a = await tom.seeda();
    const b = await fylld.seeda();
    expect(a.seedade).not.toBe(b.seedade);
    expect(b.orsak).toBeTruthy();
  });

  it("utan standardvärden säger den det, i stället för att låtsas ha seedat", async () => {
    const katalog = createCatalogSource({ source: createMemorySource({ kataloger: [] }), collection: "kataloger", standard: [], ikoner: IKONER });
    expect(await katalog.seeda()).toEqual({ seedade: false, antal: 0, orsak: "inga standardvärden att skriva" });
  });
});

describe("uppsättningen", () => {
  it("⛔ kräver ett samlingsnamn, eftersom ramverket aldrig känner det självt", async () => {
    const source = createMemorySource({ kataloger: [] });
    expect(() => createCatalogSource({ source, standard: STANDARD })).toThrow(/collection krävs/);
    expect(() => createCatalogSource({ source, collection: "  ", standard: STANDARD })).toThrow(/collection krävs/);
  });

  it("kräver en datakälla, och säger vilken sorts sak som saknas", () => {
    expect(() => createCatalogSource({ collection: "kataloger" })).toThrow(/source krävs/);
    expect(() => createCatalogSource({ source: {}, collection: "kataloger" })).toThrow(/source krävs/);
    // ⛔ Ett anrop UTAN argument ska ge samma begripliga fel och inte
    // "Cannot destructure property", som pekar in i ramverket.
    expect(() => createCatalogSource()).toThrow(/source krävs/);
  });

  it("⛔ standardvärdena valideras vid UPPSTART, inte vid seedning", async () => {
    /*
     * Ett fel i repots egna värden är ett programfel. Upptäcktes det först vid
     * seedning vore det ett fel i produktion hos den första kunden, alltså i
     * exakt det ögonblick ingen vill ha det.
     */
    const source = createMemorySource({ kataloger: [] });
    expect(() => createCatalogSource({ source, collection: "kataloger", standard: [{ ...STANDARD[0], ikon: "rocket" }], ikoner: IKONER })).toThrow(
      /standardvärden/,
    );
  });

  it("standardvärdena går att läsa ut, som kopior", () => {
    const katalog = createCatalogSource({ source: createMemorySource({ kataloger: [] }), collection: "kataloger", standard: STANDARD, ikoner: IKONER });
    const ett = katalog.standardvarden();
    ett[0].id = "ändrad";
    // ⛔ Kopior och inte referenser: en anropare som råkar ändra i svaret ska
    // inte kunna ändra vad nästa seedning skriver.
    expect(katalog.standardvarden()[0].id).toBe("uppgift");
  });
});
