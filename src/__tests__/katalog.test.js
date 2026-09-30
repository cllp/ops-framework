import { describe, it, expect } from "vitest";
import { AVSLUTADE_FASER, FASER, KATEGORIFALT, arAvslutad, byggKategori, gruppensRader, katalognyckel, kategorin, valjbara, validateKatalog } from "../lib/katalog.js";
import { RESERVSPRAK, SPRAK, arGammalNamn, byggNamn, saknadeSprak, text } from "../lib/sprak.js";
import { SLAGPLATSER } from "../lib/slag.js";

/**
 * Fas 2 i epiken #92: katalogschemat (#108) och två språk (#109).
 *
 * ⛔ PROVEN HÄR HANDLAR OM VAD SOM AVVISAS, inte om vad som accepteras. En
 * validering som bara provas med giltig data är en funktion som returnerar sitt
 * argument, och den är grön hela vägen genom felet den finns för att fånga.
 *
 * ══ ⛔ MUTATIONSSVEPET 2026-09-27, OCH VAD DET HITTADE ═════════════════
 *
 * En granskning (cllp/bolag-ops#420) noterade att katalogproven saknade
 * synligt bevis på rött utan sin fix. Beviset togs genom att slå ut varje
 * kontroll i `byggKategori` och `validateKatalog`, en i taget, och köra de
 * fyra katalogprovfilerna mot den trasiga koden:
 *
 *   id-formen                    RÖD, 2 prov dog
 *   okända fält avvisas          RÖD, 3
 *   farg i en färglös katalog    RÖD, 1
 *   farg är en palettplats       RÖD, 4
 *   ikon ur tillåtelselistan     RÖD, 3
 *   fas ur de fem                RÖD, 2
 *   textnyckelns form            RÖD, 1
 *   texterna som krävs           RÖD, 4
 *   dubbla id                    RÖD, 1
 *   ⛔ id KRÄVS                  GRÖN
 *   ⛔ ikon KRÄVS                GRÖN
 *
 * ⛔ TVÅ KONTROLLER GICK ALLTSÅ ATT TA BORT UTAN ATT NÅGOT BLEV RÖTT, och de
 * två proven längst ned i det här blocket är svaret. Skälet att de överlevde
 * är lärorikt: en tom `id` föll ändå på ID-formen och en tom `ikon` föll ändå
 * på tillåtelselistan, så BETEENDET såg rätt ut medan felmeddelandet blev ett
 * annat. Det håller bara så länge en tillåtelselista SKICKAS IN, och
 * `functions/katalog.js` skickar med flit ingen.
 */

/** En giltig kategori, som allt annat varieras ifrån. Med groupId: obligatoriskt sedan 0.33.0. */
const giltig = { id: "uppgift", namn: { sv: "Uppgifter", en: "Tasks" }, farg: 1, ikon: "check", fas: "aktiv", ordning: 10, groupId: "g1" };
const IKONER = ["check", "bell", "file"];

describe("katalogens schema", () => {
  it("bygger en kategori och fyller i det som har förval", () => {
    const k = byggKategori({ id: "x", namn: { sv: "X" }, farg: 2, ikon: "bell", fas: "ny", groupId: "g1" }, { ikoner: IKONER });
    // ⛔ `texter` är en tom påse och inte `undefined`. En kategori utan texter
    // och en kategori vars påse inte byggts ska inte gå att skilja åt i en vy,
    // för då måste varje uppslagning fråga vilket av de två det är.
    expect(k).toEqual({ id: "x", namn: { sv: "X" }, farg: 2, ikon: "bell", fas: "ny", ordning: 0, arkiverad: false, texter: {}, groupId: "g1" });
    // ⛔ En MALL (grupp: false) bär ingen groupId-nyckel alls (0.29.1). En `groupId: null`
    // faller på en konsuments `hasOnly` utan groupId, mätt i bolag-ops regelprov.
    const mall = byggKategori({ id: "x", namn: { sv: "X" }, farg: 2, ikon: "bell", fas: "ny" }, { ikoner: IKONER, grupp: false });
    expect(Object.hasOwn(mall, "groupId")).toBe(false);
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

  it("⛔ avvisar en kategori UTAN id, och säger att id krävs", () => {
    /*
     * ⛔ ÖVERLEVDE MUTATIONSSVEPET 2026-09-27. Att ta bort `if (!id)` gav inget
     * rött prov, eftersom en tom sträng ändå föll på ID-formen. Beteendet var
     * alltså rätt och MEDDELANDET blev fel: "id \"\" får bara innehålla små
     * bokstäver" säger till den som glömt fältet att hen stavat det fel.
     *
     * Provet läser därför meddelandet och inte bara att det kastar.
     *
     * Planterad defekt: byt `if (!id)` mot `if (false)`.
     */
    const utan = { namn: { sv: "X" }, ikon: "check", fas: "ny", farg: 1, groupId: "g1" };
    expect(() => byggKategori(utan, { ikoner: IKONER })).toThrow(/id krävs/);
    expect(() => byggKategori({ ...utan, id: "   " }, { ikoner: IKONER })).toThrow(/id krävs/);
  });

  it("⛔ avvisar en kategori UTAN ikon, också när ingen tillåtelselista skickats", () => {
    /*
     * ⛔ ÖVERLEVDE MUTATIONSSVEPET, och det här är det farliga av de två.
     *
     * Med en tillåtelselista föll en tom ikon ändå på listan. UTAN lista fanns
     * ingenting kvar: `if (!ikon)` var det enda som stod mellan en kategori
     * utan ikon och ett tyst godkännande.
     *
     * ⛔ OCH DET LÄGET ÄR INTE HYPOTETISKT. `functions/katalog.js` i bolag-ops
     * bygger sin katalogkälla helt utan `ikoner`, med flit: en ikon som appen
     * känner men inte functions skulle annars fälla hela katalogen till
     * reserven för något som bara rör en vy.
     *
     * Planterad defekt: byt `if (!ikon)` mot `if (false)`.
     */
    const utan = { id: "x", namn: { sv: "X" }, fas: "ny", farg: 1, groupId: "g1" };
    expect(() => byggKategori(utan, { ikoner: IKONER })).toThrow(/ikon för "x" krävs/);
    // ⛔ Utan lista, alltså functions väg. Det är den här raden som är ny.
    expect(() => byggKategori(utan)).toThrow(/ikon för "x" krävs/);
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

describe("katalogen som en grupps egen (#162, väg C i #160, obligatoriskt sedan 0.33.0)", () => {
  /*
   * ⛔ SAMMA BEVISFORM SOM RESTEN AV FILEN: vad som AVVISAS, inte bara vad som
   * accepteras. Sedan 0.33.0 är `grupp` förvalt SANT, alltså bär varje prov
   * ovanför det här blocket ett groupId. Det första provet nedan är det som
   * bevisar förvalet: röd mot 0.32.1, där samma anrop gav en kategori utan grupp.
   */
  const { groupId: _g, ...UTAN_GRUPP } = giltig;

  it("⛔ FÖRVALET kräver groupId: en kategori utan grupp avvisas utan att någon bett om det", () => {
    // Planterad defekt: `grupp = false` som förval i byggKategori. Då är den här raden grön i
    // 0.32.1 och röd nu, och det är hela skillnaden mellan "tillåtet" och "obligatoriskt".
    const fel = () => byggKategori(UTAN_GRUPP, { ikoner: IKONER });
    expect(fel).toThrow(/groupId för "uppgift" krävs/);
    expect(fel).toThrow(/grupp: false/);
    expect(() => validateKatalog([UTAN_GRUPP], { ikoner: IKONER })).toThrow(/groupId för "uppgift" krävs/);
  });

  it("en mall eller kodkatalog (grupp: false) avvisar groupId, den ignoreras inte", () => {
    const fel = () => byggKategori(giltig, { ikoner: IKONER, grupp: false });
    expect(fel).toThrow(/hör inte hemma i den här katalogen/);
    expect(fel).toThrow(/grupp: false/);
    expect(byggKategori(UTAN_GRUPP, { ikoner: IKONER, grupp: false }).id).toBe("uppgift");
  });

  it("⛔ tomt groupId räknas som saknat, inte som ett värde", () => {
    expect(() => byggKategori({ ...giltig, groupId: "   " }, { ikoner: IKONER })).toThrow(/groupId för "uppgift" krävs/);
  });

  it("⛔ groupId med punkt, versal eller mellanslag avvisas, samma form som id", () => {
    // Samma skäl som för id: punkten blir en sökväg i en Firestore-regel.
    for (const groupId of ["cps.ab", "Cps-Ab", "cps ab"]) {
      expect(() => byggKategori({ ...giltig, groupId }, { ikoner: IKONER })).toThrow(/små bokstäver/);
    }
  });

  it("en giltig kategori bär sitt groupId oförändrat", () => {
    const k = byggKategori({ ...giltig, groupId: "cps-ab" }, { ikoner: IKONER });
    expect(k.groupId).toBe("cps-ab");
  });

  it("⛔ två grupper får var sin katalog: samma id, olika groupId, ingen krockar som dubblett", () => {
    // validateKatalog fäller dubbletter av id inom EN katalog. Två grupper är
    // två separata listor (frågade var för sig, se gruppkalla.js), så samma
    // id i båda är inte samma fel, det är precis poängen med väg C.
    const mirandaAb = validateKatalog([{ ...giltig, groupId: "miranda-ab" }], { ikoner: IKONER });
    const cpsAb = validateKatalog([{ ...giltig, groupId: "cps-ab" }], { ikoner: IKONER });
    expect(mirandaAb[0].groupId).toBe("miranda-ab");
    expect(cpsAb[0].groupId).toBe("cps-ab");
  });

  it("groupId hör hemma i KATEGORIFALT, annars vore fältet i sig avvisat", () => {
    // ⛔ Det här är den rad som `check-gruppnyckel` (#136) läser. Mätningen i
    // cllp/bolag-ops#447 var precis detta: fältet stod inte i listan, alltså
    // kastade byggKategori på "känns inte igen" oavsett vad grupp sattes till.
    expect(KATEGORIFALT).toContain("groupId");
  });
});

describe("katalognyckel och gruppensRader (0.33.0)", () => {
  it("nyckeln är groupId|id och vägrar en del som inte har id-formen", () => {
    expect(katalognyckel("cps-ab", "uppgift")).toBe("cps-ab|uppgift");
    expect(() => katalognyckel("cps.ab", "uppgift")).toThrow(/id-formen/);
    expect(() => katalognyckel("cps-ab", "")).toThrow(/id-formen/);
  });

  const RADER = [
    { id: "cps-ab|uppgift", groupId: "cps-ab", x: 1 },
    { id: "miranda-ab|uppgift", groupId: "miranda-ab", x: 2 },
    { id: "gammal", x: 3 },
  ];

  it("⛔ en annan grupps rad faller bort, den egna packas upp", () => {
    const { rader, utanGrupp, andraGrupper } = gruppensRader(RADER, { groupId: "cps-ab" });
    expect(rader.map((r) => r.id)).toEqual(["uppgift", "gammal"]);
    expect(rader.some((r) => r.x === 2)).toBe(false);
    expect(andraGrupper).toBe(1);
    // ⛔ Utan övergång står raden utan grupp kvar OFÖRÄNDRAD, så att valideringen säger "groupId krävs".
    expect(utanGrupp).toBe(1);
    expect(rader[1].groupId).toBeUndefined();
    const { x: _x, ...utanX } = rader[1];
    expect(() => validateKatalog([{ ...giltig, groupId: undefined, ...utanX }], { ikoner: IKONER })).toThrow(/groupId för "gammal" krävs/);
  });

  it("⛔ övergången: raden utan grupp räknas som den här gruppens, och räknaren säger hur många", () => {
    const { rader, utanGrupp } = gruppensRader(RADER, { groupId: "cps-ab", overgang: true });
    expect(rader.find((r) => r.id === "gammal")?.groupId).toBe("cps-ab");
    expect(utanGrupp).toBe(1);
    // Noll är ett svar, inte en utelämnad rad (regel 5).
    expect(gruppensRader([RADER[0]], { groupId: "cps-ab", overgang: true }).utanGrupp).toBe(0);
  });

  it("⛔ utan groupId vägrar den, i stället för att läsa allas rader", () => {
    expect(() => gruppensRader(RADER, /** @type {any} */ ({}))).toThrow(/groupId krävs/);
  });
});
