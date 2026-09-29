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
 *
 * ══ ⛔ #162: KÄLLAN ÄR NU GRUPPENS EGEN, OCH DET ÄR ETT EGET BLOCK ══════
 *
 * Väg C i cllp/ops-framework#160. `collection` är fortfarande en delad
 * Firestore-samling, men varje `createCatalogSource` är en grupps VY av den:
 * `groupId` krävs i konfigurationen, och varje läsning och skrivning skopas på
 * den. Blocket "gruppens egen katalog" längst ner bevisar isoleringen i båda
 * riktningar, mot samma minneskälla, med två grupper i samma samling.
 */

const IKONER = ["check", "bell"];
const STANDARD = [
  { id: "uppgift", namn: { sv: "Uppgifter", en: "Tasks" }, farg: 1, ikon: "check", fas: "aktiv", ordning: 0 },
  { id: "paminnelse", namn: { sv: "Påminnelser", en: "Reminders" }, farg: 2, ikon: "bell", fas: "vantar", ordning: 1 },
];

const CPS_AB = "cps-ab";

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
    const source = createMemorySource({ kataloger: STANDARD.map((k) => ({ ...k, groupId: CPS_AB })) });
    const katalog = createCatalogSource({ source, collection: "kataloger", groupId: CPS_AB, standard: STANDARD, ikoner: IKONER });

    const svar = await katalog.las();
    expect(svar.kalla).toBe("databas");
    expect(svar.fel).toBeNull();
    expect(svar.kategorier.map((k) => k.id)).toEqual(["uppgift", "paminnelse"]);
    expect(svar.kategorier.every((k) => k.groupId === CPS_AB)).toBe(true);
  });

  it("⛔ ett läsfel ger standardvärdena OCH säger att det är reserven", async () => {
    /*
     * Ett tyst fall tillbaka betyder att den som nyss arkiverade en kategori
     * ser den kvar och tror att knappen inte fungerade. Svaret måste gå att
     * skilja från ett lyckat.
     */
    const katalog = createCatalogSource({ source: trasigKalla(), collection: "kataloger", groupId: CPS_AB, standard: STANDARD, ikoner: IKONER });

    const svar = await katalog.las();
    expect(svar.kalla).toBe("reserv");
    expect(svar.fel).toBeInstanceOf(Error);
    expect(svar.fel?.message).toMatch(/permissions/);
    expect(svar.kategorier.map((k) => k.id)).toEqual(["uppgift", "paminnelse"]);
    // ⛔ Reserven bär den här källans grupp, inte ingen alls: en banderoll utan
    // grupp hade sett ut som ett hål i datan i stället för mallen den är.
    expect(svar.kategorier.every((k) => k.groupId === CPS_AB)).toBe(true);
  });

  it("⛔ läsaren kastar aldrig, inte ens när källan gör det", async () => {
    // En vy som får ett kastat fel ritar antingen ingenting eller en tom lista,
    // och en tom lista är samma sak som "det finns inga kategorier".
    const katalog = createCatalogSource({ source: trasigKalla(), collection: "kataloger", groupId: CPS_AB, standard: STANDARD, ikoner: IKONER });
    await expect(katalog.las()).resolves.toBeTruthy();
  });

  it("⛔ en TOM samling är inte reserven, det är läget före seedningen", async () => {
    const source = createMemorySource({ kataloger: [] });
    const katalog = createCatalogSource({ source, collection: "kataloger", groupId: CPS_AB, standard: STANDARD, ikoner: IKONER });

    const svar = await katalog.las();
    expect(svar.kalla).toBe("databas");
    expect(svar.kategorier).toEqual([]);
  });

  it("⛔ trasig data i databasen faller till reserven i stället för att ta ned appen", async () => {
    // En kategori med hex i farg är ett fel, och valideringen kastar. Här ska
    // det bli en banderoll, inte en vit sida.
    const source = createMemorySource({ kataloger: [{ ...STANDARD[0], groupId: CPS_AB, farg: "#c8a227" }] });
    const katalog = createCatalogSource({ source, collection: "kataloger", groupId: CPS_AB, standard: STANDARD, ikoner: IKONER });

    const svar = await katalog.las();
    expect(svar.kalla).toBe("reserv");
    expect(svar.fel?.message).toMatch(/palettplats/);
  });
});

describe("seedningen", () => {
  it("skriver standardvärdena i en tom samling, med gruppens groupId på varje rad", async () => {
    const source = createMemorySource({ kataloger: [] });
    const katalog = createCatalogSource({ source, collection: "kataloger", groupId: CPS_AB, standard: STANDARD, ikoner: IKONER });

    expect(await katalog.seeda()).toEqual({ seedade: true, antal: 2 });
    // ⛔ Den LOGISKA läsvägen: `id` är den korta maskinnyckeln, precis som
    // innan #162. Vad som faktiskt sparas i den delade samlingen prövas
    // separat nedan, i blocket om gruppens egen katalog.
    const svar = await katalog.las();
    expect(svar.kategorier.map((k) => k.id)).toEqual(["uppgift", "paminnelse"]);
    expect(svar.kategorier.every((k) => k.groupId === CPS_AB)).toBe(true);
  });

  it("⛔ rör ALDRIG en samling som redan har värden FÖR DEN HÄR GRUPPEN", async () => {
    /*
     * Annars kommer en kategori som arkiverats tillbaka vid nästa
     * driftsättning, och det ser ut som ett spöke.
     */
    const source = createMemorySource({ kataloger: [{ ...STANDARD[0], groupId: CPS_AB, arkiverad: true }] });
    const katalog = createCatalogSource({ source, collection: "kataloger", groupId: CPS_AB, standard: STANDARD, ikoner: IKONER });

    expect(await katalog.seeda()).toEqual({ seedade: false, antal: 1, orsak: "samlingen har redan värden för den här gruppen" });
    const kvar = await source.list("kataloger");
    expect(kvar).toHaveLength(1);
    expect(kvar[0].arkiverad).toBe(true);
  });

  it("⛔ en annan grupps värden i SAMMA samling stoppar inte seedningen", async () => {
    // ⛔ Det här är hela poängen med #162, bevisad på seedningsvägen: samlingen
    // är delad, men "har den redan värden" frågas PER GRUPP.
    const source = createMemorySource({ kataloger: [{ ...STANDARD[0], groupId: "miranda-ab" }] });
    const katalog = createCatalogSource({ source, collection: "kataloger", groupId: CPS_AB, standard: STANDARD, ikoner: IKONER });

    expect(await katalog.seeda()).toEqual({ seedade: true, antal: 2 });
    const svar = await katalog.las();
    expect(svar.kategorier.map((k) => k.id)).toEqual(["uppgift", "paminnelse"]);
  });

  it("⛔ svarar med VAD som hände, så de två utfallen går att skilja åt i en logg", async () => {
    const tom = createCatalogSource({ source: createMemorySource({ kataloger: [] }), collection: "kataloger", groupId: CPS_AB, standard: STANDARD, ikoner: IKONER });
    const fylld = createCatalogSource({ source: createMemorySource({ kataloger: STANDARD.map((k) => ({ ...k, groupId: CPS_AB })) }), collection: "kataloger", groupId: CPS_AB, standard: STANDARD, ikoner: IKONER });

    const a = await tom.seeda();
    const b = await fylld.seeda();
    expect(a.seedade).not.toBe(b.seedade);
    expect(b.orsak).toBeTruthy();
  });

  it("utan standardvärden säger den det, i stället för att låtsas ha seedat", async () => {
    const katalog = createCatalogSource({ source: createMemorySource({ kataloger: [] }), collection: "kataloger", groupId: CPS_AB, standard: [], ikoner: IKONER });
    expect(await katalog.seeda()).toEqual({ seedade: false, antal: 0, orsak: "inga standardvärden att skriva" });
  });
});

describe("uppsättningen", () => {
  it("⛔ kräver ett samlingsnamn, eftersom ramverket aldrig känner det självt", async () => {
    const source = createMemorySource({ kataloger: [] });
    expect(() => createCatalogSource({ source, groupId: CPS_AB, standard: STANDARD })).toThrow(/collection krävs/);
    expect(() => createCatalogSource({ source, collection: "  ", groupId: CPS_AB, standard: STANDARD })).toThrow(/collection krävs/);
  });

  it("kräver en datakälla, och säger vilken sorts sak som saknas", () => {
    expect(() => createCatalogSource({ collection: "kataloger", groupId: CPS_AB })).toThrow(/source krävs/);
    expect(() => createCatalogSource({ source: {}, collection: "kataloger", groupId: CPS_AB })).toThrow(/source krävs/);
    // ⛔ Ett anrop UTAN argument ska ge samma begripliga fel och inte
    // "Cannot destructure property", som pekar in i ramverket.
    expect(() => createCatalogSource()).toThrow(/source krävs/);
  });

  it("⛔ kräver ett groupId (#162): katalogen är en grupps egen", () => {
    const source = createMemorySource({ kataloger: [] });
    expect(() => createCatalogSource({ source, collection: "kataloger", standard: STANDARD })).toThrow(/groupId krävs/);
    expect(() => createCatalogSource({ source, collection: "kataloger", groupId: "   ", standard: STANDARD })).toThrow(/groupId krävs/);
  });

  it("⛔ standardvärdena valideras vid UPPSTART, inte vid seedning", async () => {
    /*
     * Ett fel i repots egna värden är ett programfel. Upptäcktes det först vid
     * seedning vore det ett fel i produktion hos den första kunden, alltså i
     * exakt det ögonblick ingen vill ha det.
     */
    const source = createMemorySource({ kataloger: [] });
    expect(() => createCatalogSource({ source, collection: "kataloger", groupId: CPS_AB, standard: [{ ...STANDARD[0], ikon: "rocket" }], ikoner: IKONER })).toThrow(
      /standardvärden/,
    );
  });

  it("standardvärdena går att läsa ut, som kopior, och utan groupId eftersom de är mallen och inte en grupps rad", () => {
    const katalog = createCatalogSource({ source: createMemorySource({ kataloger: [] }), collection: "kataloger", groupId: CPS_AB, standard: STANDARD, ikoner: IKONER });
    const ett = katalog.standardvarden();
    expect(Object.hasOwn(ett[0], "groupId")).toBe(false);
    ett[0].id = "ändrad";
    // ⛔ Kopior och inte referenser: en anropare som råkar ändra i svaret ska
    // inte kunna ändra vad nästa seedning skriver.
    expect(katalog.standardvarden()[0].id).toBe("uppgift");
  });
});

describe("⛔ gruppens egen katalog (#162): isolering mot samma minneskälla, i båda riktningar", () => {
  /*
   * ⛔ SAMMA SAMLING, TVÅ KÄLLOR. Det är det som gör provet till ett bevis på
   * #162 och inte bara på att `where` fungerar: `cps-ab` och `miranda-ab`
   * delar `source` och `collection`, precis som i produktion, och skillnaden
   * är BARA `groupId`.
   */
  const kataloger = (groupId) => {
    const source = createMemorySource({ kataloger: [] });
    return { source, katalog: createCatalogSource({ source, collection: "kataloger", groupId, standard: STANDARD, ikoner: IKONER }) };
  };

  it("varje grupp seedas med sina egna standardvärden, i samma samling", async () => {
    const cps = kataloger(CPS_AB);
    // ⛔ Delar samma underliggande lagring: miranda ab seedas mot SAMMA
    // `source` som cps ab, inte en egen minneskälla.
    const miranda = { source: cps.source, katalog: createCatalogSource({ source: cps.source, collection: "kataloger", groupId: "miranda-ab", standard: STANDARD, ikoner: IKONER }) };

    await cps.katalog.seeda();
    await miranda.katalog.seeda();

    const alla = await cps.source.list("kataloger");
    expect(alla).toHaveLength(4);
  });

  it("⛔ MUTATIONSFYND: samma maskinnyckel i två grupper skrev tidigare över varandra i samlingen", async () => {
    /*
     * Bevisat rött: innan den lagrade nyckeln blandade `groupId` in i
     * dokumentets id (`lagradId`), skrev `seeda()` bara med kategorins egna
     * `id` ("uppgift") som Firestore-nyckel. miranda ab:s seedning skrev då
     * över cps ab:s rad med SAMMA maskinnyckel, och samlingen hade två rader
     * i stället för fyra efter att båda seedats.
     */
    const cps = kataloger(CPS_AB);
    const miranda = createCatalogSource({ source: cps.source, collection: "kataloger", groupId: "miranda-ab", standard: STANDARD, ikoner: IKONER });

    await cps.katalog.seeda();
    await miranda.seeda();

    const alla = await cps.source.list("kataloger");
    expect(alla).toHaveLength(4);
    // ⛔ Den lagrade nyckeln bär BÅDA grupperna, inte bara den senast skrivna.
    const nycklar = alla.map((r) => r.id).sort();
    expect(nycklar).toEqual(["cps-ab|paminnelse", "cps-ab|uppgift", "miranda-ab|paminnelse", "miranda-ab|uppgift"]);
  });

  it("⛔ en grupp läser aldrig den andras kategorier, prövat mot en TREDJE kategori bara den ena har", async () => {
    const cps = kataloger(CPS_AB);
    await cps.katalog.seeda();
    // miranda ab har en egen kategori, cps ab har aldrig sett dess id.
    await cps.source.create("kataloger", { id: "hemlig-hos-miranda", namn: { sv: "Hemlig" }, farg: 1, ikon: "check", fas: "ny", ordning: 9, groupId: "miranda-ab" });

    const svar = await cps.katalog.las();
    expect(svar.kategorier.map((k) => k.id)).not.toContain("hemlig-hos-miranda");
    expect(svar.kategorier).toHaveLength(2);
  });

  it("⛔ och tvärtom: miranda ab läser aldrig cps ab:s kategorier", async () => {
    const cps = kataloger(CPS_AB);
    const miranda = createCatalogSource({ source: cps.source, collection: "kataloger", groupId: "miranda-ab", standard: STANDARD, ikoner: IKONER });

    await cps.katalog.seeda();
    // miranda ab:s samling är fortfarande tom: den ska seedas, inte se cps
    // ab:s rader och tro sig redan ha värden.
    expect(await miranda.seeda()).toEqual({ seedade: true, antal: 2 });

    const svar = await miranda.las();
    expect(svar.kategorier.every((k) => k.groupId === "miranda-ab")).toBe(true);
  });
});

describe("⛔ ogrupperat läge, groupId: null uttryckligen (0.29.0, övergången i cllp/bolag-ops#447)", () => {
  it("null läser hela samlingen med id:n orörda och seedar rader utan groupId, som före #162", async () => {
    const source = createMemorySource();
    const kalla = createCatalogSource({ source, collection: "kataloger", groupId: null, standard: STANDARD, ikoner: IKONER });
    const seed = await kalla.seeda();
    expect(seed).toEqual({ seedade: true, antal: 2 });
    const rader = await source.list("kataloger", {});
    expect(rader.map((r) => r.id).sort()).toEqual(["paminnelse", "uppgift"]);
    expect(rader.every((r) => !Object.hasOwn(r, "groupId"))).toBe(true);
    const svar = await kalla.las();
    expect(svar.kalla).toBe("databas");
    expect(svar.kategorier.map((k) => k.id).sort()).toEqual(["paminnelse", "uppgift"]);
  });

  it("null ser raderna från före #162 (rena id:n) men inte en grupps rader (nyckel groupId|id), och gruppen ser inte de ogrupperade", async () => {
    const source = createMemorySource();
    await source.create("kataloger", { ...STANDARD[0], groupId: null });
    await createCatalogSource({ source, collection: "kataloger", groupId: CPS_AB, standard: [STANDARD[1]], ikoner: IKONER }).seeda();
    const ogrupperat = await createCatalogSource({ source, collection: "kataloger", groupId: null, standard: [], ikoner: IKONER }).las();
    expect(ogrupperat.kalla).toBe("databas");
    expect(ogrupperat.kategorier.map((k) => k.id)).toEqual(["uppgift"]);
    const gruppen = await createCatalogSource({ source, collection: "kataloger", groupId: CPS_AB, standard: [], ikoner: IKONER }).las();
    expect(gruppen.kalla).toBe("databas");
    expect(gruppen.kategorier.map((k) => k.id)).toEqual(["paminnelse"]);
  });

  it("reserven i ogrupperat läge bär inget groupId", async () => {
    const kalla = createCatalogSource({ source: trasigKalla(), collection: "kataloger", groupId: null, standard: STANDARD, ikoner: IKONER });
    const svar = await kalla.las();
    expect(svar.kalla).toBe("reserv");
    expect(svar.kategorier.every((k) => !Object.hasOwn(k, "groupId"))).toBe(true);
  });

  it("⛔ ett utelämnat groupId är fortfarande rött, och felet pekar på null", () => {
    const source = createMemorySource();
    expect(() => createCatalogSource({ source, collection: "kataloger", standard: STANDARD })).toThrow(/groupId: null uttryckligen/);
    expect(() => createCatalogSource({ source, collection: "kataloger", groupId: undefined, standard: STANDARD })).toThrow(/groupId krävs/);
  });
});
