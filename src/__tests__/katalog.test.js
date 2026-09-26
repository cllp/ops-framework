import { describe, it, expect } from "vitest";
import { AVSLUTADE_FASER, FASER, arAvslutad, byggKategori, kategorin, valjbara, validateKatalog } from "../lib/katalog.js";
import { RESERVSPRAK, SPRAK, arGammalNamn, byggNamn, saknadeSprak, text } from "../lib/sprak.js";
import { SLAGPLATSER } from "../lib/slag.js";

/**
 * Fas 2 i epiken #92: katalogschemat (#108) och två språk (#109).
 *
 * ⛔ PROVEN HÄR HANDLAR OM VAD SOM AVVISAS, inte om vad som accepteras. En
 * validering som bara provas med giltig data är en funktion som returnerar sitt
 * argument, och den är grön hela vägen genom felet den finns för att fånga.
 */

/** En giltig kategori, som allt annat varieras ifrån. */
const giltig = { id: "uppgift", namn: { sv: "Uppgifter", en: "Tasks" }, farg: 1, ikon: "check", fas: "aktiv", ordning: 10 };
const IKONER = ["check", "bell", "file"];

describe("katalogens schema", () => {
  it("bygger en kategori och fyller i det som har förval", () => {
    const k = byggKategori({ id: "x", namn: { sv: "X" }, farg: 2, ikon: "bell", fas: "ny" }, { ikoner: IKONER });
    expect(k).toEqual({ id: "x", namn: { sv: "X" }, farg: 2, ikon: "bell", fas: "ny", ordning: 0, arkiverad: false });
  });

  it("⛔ avvisar hex i farg, och säger varför en palettplats krävs", () => {
    // En hex i konfigurationen är ett tema som inte följer med när mörkt läge
    // eller en ny identitet kommer.
    expect(() => byggKategori({ ...giltig, farg: "#c8a227" }, { ikoner: IKONER })).toThrow(/palettplats/);
    expect(() => byggKategori({ ...giltig, farg: 99 }, { ikoner: IKONER })).toThrow(/palettplats/);
  });

  it("⛔ avvisar en ikon utanför tillåtelselistan, och räknar upp den", () => {
    const fel = () => byggKategori({ ...giltig, ikon: "rocket" }, { ikoner: IKONER });
    expect(fel).toThrow(/rocket/);
    expect(fel).toThrow(/check, bell, file/);
  });

  it("⛔ avvisar en okänd fas, eftersom faserna är ramverkets", () => {
    expect(() => byggKategori({ ...giltig, fas: "pagar" }, { ikoner: IKONER })).toThrow(/går inte att lägga till/);
  });

  it("⛔ avvisar ett id med punkt, versal eller mellanslag", () => {
    // Punkten är den som kostar: den blir en sökväg i en Firestore-regel.
    for (const id of ["min.kategori", "MinKategori", "min kategori"]) {
      expect(() => byggKategori({ ...giltig, id }, { ikoner: IKONER })).toThrow(/små bokstäver/);
    }
  });

  it("⛔ avvisar ett namn utan svenska, eftersom svenskan är reserven", () => {
    expect(() => byggKategori({ ...giltig, namn: { en: "Tasks" } }, { ikoner: IKONER })).toThrow(/sv krävs/);
  });

  it("felet säger vilken katalog och vilket fält, inte bara att något är fel", () => {
    // ⛔ Ett meddelande som säger "ogiltig kategori" lämnar den som ändrade att
    // leta i en lista. Det här är skillnaden mellan ett fel för utvecklaren och
    // ett fel för den som just tryckte spara i inställningsvyn.
    const fel = () => byggKategori({ ...giltig, ikon: "rocket" }, { ikoner: IKONER, katalog: "handelsetyper" });
    expect(fel).toThrow(/handelsetyper:/);
    expect(fel).toThrow(/uppgift/);
  });
});

describe("validateKatalog vid uppstart", () => {
  it("släpper igenom en giltig katalog och svarar med de byggda posterna", () => {
    const ut = validateKatalog([giltig, { ...giltig, id: "paminnelse", farg: 2, ikon: "bell" }], { ikoner: IKONER });
    expect(ut.map((k) => k.id)).toEqual(["uppgift", "paminnelse"]);
  });

  it("⛔ avvisar två kategorier med samma id", () => {
    /*
     * Två med samma id ser ut som en i varje vy, och raderna som pekar på den
     * andra ritas med den förstas namn och färg. Det är den sortens fel som tar
     * en dag att tro på.
     */
    expect(() => validateKatalog([giltig, { ...giltig, namn: { sv: "En till" } }], { ikoner: IKONER })).toThrow(/två gånger/);
  });

  it("⛔ en tom katalog är tillåten, det är läget före seedningen", () => {
    expect(validateKatalog([], { ikoner: IKONER })).toEqual([]);
  });

  it("⛔ något som inte är en lista avvisas med vad det var i stället", () => {
    expect(() => validateKatalog(null, { katalog: "kategorier" })).toThrow(/kategorier: kategorier krävs/);
    expect(() => validateKatalog({ uppgift: giltig })).toThrow(/måste vara en lista/);
  });

  it("palettplatserna kommer ur slagpaletten och inte ur en egen lista", () => {
    // ⛔ En sanning per faktum. Vore platserna avskrivna här skulle en fjärde
    // plats i tokens.css inte gå att välja, utan att något sade ifrån.
    expect(() => byggKategori({ ...giltig, farg: SLAGPLATSER[SLAGPLATSER.length - 1] }, { ikoner: IKONER })).not.toThrow();
    expect(() => byggKategori({ ...giltig, farg: SLAGPLATSER.length + 1 }, { ikoner: IKONER })).toThrow(/palettplats/);
  });
});

describe("att läsa katalogen", () => {
  const katalog = validateKatalog(
    [
      { ...giltig, id: "b", namn: { sv: "Beta" }, ordning: 0 },
      { ...giltig, id: "a", namn: { sv: "Alfa" }, ordning: 0 },
      { ...giltig, id: "gammal", namn: { sv: "Gammal" }, ordning: 1, arkiverad: true },
    ],
    { ikoner: IKONER },
  );

  it("arkiverade faller bort, en gång och inte i varje vy", () => {
    expect(valjbara(katalog).map((k) => k.id)).toEqual(["a", "b"]);
  });

  it("⛔ lika ordning sorteras på namnet, så listan inte byter ordning av sig själv", () => {
    // Tre med samma `ordning` ligger annars i den ordning databasen råkar
    // svara, och den ändrar sig mellan två laddningar.
    expect(valjbara(katalog).map((k) => k.id)).toEqual(["a", "b"]);
  });

  it("uppslagningen svarar null i stället för att kasta", () => {
    // En rad kan peka på en kategori som tagits bort ur standardvärdena, och en
    // vy som kastar där tar ned hela listan i stället för en rad.
    expect(kategorin(katalog, "a")?.id).toBe("a");
    expect(kategorin(katalog, "finns-inte")).toBeNull();
    expect(kategorin(katalog, undefined)).toBeNull();
  });

  it("de avslutade faserna är två, och avskriven är inte klar", () => {
    expect([...FASER]).toEqual(["ny", "aktiv", "vantar", "klar", "avskriven"]);
    expect([...AVSLUTADE_FASER]).toEqual(["klar", "avskriven"]);
    expect(arAvslutad("klar")).toBe(true);
    expect(arAvslutad("avskriven")).toBe(true);
    expect(arAvslutad("vantar")).toBe(false);
  });
});

describe("två språk", () => {
  it("läsaren svarar på valt språk och faller tillbaka på svenska", () => {
    expect(text({ sv: "Uppgifter", en: "Tasks" }, "en")).toBe("Tasks");
    expect(text({ sv: "Uppgifter" }, "en")).toBe("Uppgifter");
    expect(text({ sv: "Uppgifter", en: "Tasks" })).toBe("Uppgifter");
  });

  it("⛔ läsaren tål en sträng, precis som skapadAv-läsaren gjorde i Fas 1", () => {
    /*
     * Migreringsordningen är tvingande: läsaren måste tåla båda formerna INNAN
     * skrivarna byter, annars visar varje vy tomt för varje omigrerat värde i
     * samma sekund. Appens listor är strängar i dag (cllp/bolag-ops#384).
     */
    expect(text("Uppgifter", "en")).toBe("Uppgifter");
    expect(arGammalNamn("Uppgifter")).toBe(true);
    expect(arGammalNamn({ sv: "Uppgifter" })).toBe(false);
  });

  it("⛔ toleransen är inte tyst: en sträng räknas som saknad översättning", () => {
    // Räknades den inte skulle vakten visa noll så länge ingenting migrerats,
    // alltså vara som grönast när läget är sämst.
    expect(saknadeSprak({ namn: "Uppgifter" })).toEqual(["namn"]);
  });

  it("vakten svarar med sökvägar, inte med en siffra", () => {
    const kataloger = { kategorier: [{ namn: { sv: "Alfa", en: "Alpha" } }, { namn: { sv: "Beta" } }] };
    expect(saknadeSprak(kataloger)).toEqual(["kategorier.1.namn"]);
  });

  it("ett namn som har båda språken räknas inte", () => {
    expect(saknadeSprak({ namn: { sv: "Alfa", en: "Alpha" } })).toEqual([]);
  });

  it("en tom lista är ett svar, och det är noll saknade", () => {
    expect(saknadeSprak({})).toEqual([]);
    expect(saknadeSprak([])).toEqual([]);
  });

  it("byggNamn kastar utan svenska och rensar blanksteg", () => {
    expect(byggNamn({ sv: "  Uppgifter  ", en: " Tasks " })).toEqual({ sv: "Uppgifter", en: "Tasks" });
    expect(byggNamn({ sv: "Bara svenska" })).toEqual({ sv: "Bara svenska" });
    expect(() => byggNamn({ en: "Tasks" })).toThrow(/sv krävs/);
    expect(() => byggNamn({ sv: "   " })).toThrow(/sv krävs/);
  });

  it("språken och reservspråket är utskrivna värden", () => {
    expect([...SPRAK]).toEqual(["sv", "en"]);
    expect(RESERVSPRAK).toBe("sv");
  });

  it("ett trasigt värde ger tom sträng i stället för att kasta i en vy", () => {
    // ⛔ Samma val som `laesSkapare`: en vy som kastar på en enda trasig rad tar
    // ned hela listan.
    expect(text(null)).toBe("");
    expect(text(undefined)).toBe("");
    expect(text(42)).toBe("");
  });
});
