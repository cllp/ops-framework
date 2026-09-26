import { describe, it, expect } from "vitest";
import { arAvslutad, byggKategori, texten, validateKatalog } from "../lib/katalog.js";
import { saknadeSprak } from "../lib/sprak.js";

/**
 * Katalogens texter (#117).
 *
 * ⛔ DET VIKTIGASTE PROVET HÄR ÄR DET SOM KRÄVER ETT LJUD. Att `texter` finns
 * är den lilla halvan. Den stora är att ett fält som skrivits på fel ställe
 * inte längre försvinner tyst, för det var så luckan kunde bo i katalogmotorn
 * hela vägen fram till att appens halva skulle börja.
 */

const IKONER = ["check", "bell"];
const GRUND = { id: "kvitto", namn: { sv: "Kvitto" }, farg: 1, ikon: "check", fas: "ny" };
const bygg = (extra = {}, config = {}) => byggKategori({ ...GRUND, ...extra }, { ikoner: IKONER, ...config });

describe("textpåsen", () => {
  it("bär namngivna texter på båda språken", () => {
    const k = bygg({ texter: { lofte: { sv: "Försvinner när den är bokförd.", en: "Gone once booked." } } });
    expect(texten(k, "lofte")).toBe("Försvinner när den är bokförd.");
    expect(texten(k, "lofte", "en")).toBe("Gone once booked.");
  });

  it("tar emot en sträng och gör den till svenska, som migreringen kräver", () => {
    // Samma ordning som resten av epiken: läsaren tål båda formerna innan
    // skrivarna byter. Appens listor är strängar i dag.
    const k = bygg({ texter: { lofte: "Försvinner när den är bokförd." } });
    expect(k.texter.lofte).toEqual({ sv: "Försvinner när den är bokförd." });
  });

  it("faller tillbaka på svenskan när engelskan saknas", () => {
    const k = bygg({ texter: { lofte: { sv: "Bokförs." } } });
    expect(texten(k, "lofte", "en")).toBe("Bokförs.");
  });

  it("⛔ en text utan svenska är rött, eftersom svenskan är reserven", () => {
    expect(() => bygg({ texter: { lofte: { en: "Gone once booked." } } })).toThrow(/texten "lofte"/);
    expect(() => bygg({ texter: { lofte: { en: "Gone once booked." } } })).toThrow(/sv krävs/);
  });

  it("⛔ en textnyckel med punkt är rött, för den blir en sökväg i en regel", () => {
    expect(() => bygg({ texter: { "kvitto.lofte": { sv: "X" } } })).toThrow(/textnyckeln "kvitto.lofte"/);
  });

  it("⛔ texter som inte är ett objekt är rött och säger vad det var", () => {
    expect(() => bygg({ texter: ["Försvinner."] })).toThrow(/måste vara ett objekt/);
    expect(() => bygg({ texter: "Försvinner." })).toThrow(/inte string/);
  });
});

describe("okända fält", () => {
  it("⛔ ett fält på fel ställe är rött, det försvinner inte tyst", () => {
    /*
     * Felklassen i #117, mätt före fixen: `lofte` och `titleHint` högst upp kom
     * ut ur byggKategori utan att något kastades. Den som skrev fick en grön
     * uppstart och en tom rad i vyn, alltså letade i vyn efter ett fel som låg i
     * katalogen.
     */
    const fel = () => bygg({ lofte: "Försvinner när den är bokförd." });
    expect(fel).toThrow(/lofte/);
    expect(fel).toThrow(/känns inte igen/);
  });

  it("⛔ och felet säger vart texten hör hemma i stället", () => {
    // Ett fel som bara säger nej lämnar den som skriver med samma fråga som
    // innan. Det här ska gå att rätta utan att läsa källan.
    expect(() => bygg({ lofte: "Försvinner." })).toThrow(/texter: \{ lofte: \{ sv: "\.\.\." \} \}/);
  });

  it("räknar upp alla okända på en gång", () => {
    expect(() => bygg({ lofte: "a", titleHint: "b" })).toThrow(/lofte, titleHint/);
  });

  it("de kända fälten går fortfarande igenom", () => {
    const k = bygg({ ordning: 3, arkiverad: true, texter: { row: "Kvitto" } });
    expect(k.ordning).toBe(3);
    expect(k.arkiverad).toBe(true);
  });
});

describe("kravet på texter", () => {
  const KRAVDA = ["row", "lofte"];

  it("⛔ en deklarerad text som saknas är rött vid uppstart", () => {
    /*
     * Utan det här kravet är "texterna tappas inte i flytten" ett löfte utan
     * vakt: en kategori som läggs till i inställningsvyn föds utan hjälptexter
     * och ger ett formulär med tomma fält och inga exempel.
     */
    const fel = () => bygg({ texter: { row: "Kvitto" } }, { textnycklar: KRAVDA });
    expect(fel).toThrow(/lofte/);
    expect(fel).toThrow(/saknas för "kvitto"/);
  });

  it("räknar upp alla som saknas, inte en i taget", () => {
    expect(() => bygg({}, { textnycklar: KRAVDA })).toThrow(/row, lofte/);
  });

  it("med alla på plats är den grön", () => {
    expect(() => bygg({ texter: { row: "Kvitto", lofte: "Bokförs." } }, { textnycklar: KRAVDA })).not.toThrow();
  });

  it("⛔ kravet gäller VARJE kategori i katalogen, inte den första", () => {
    // Skrevs kravet per rad kunde en ny kategori läggas till utan, och då finns
    // kravet kvar men inte dess verkan.
    const katalog = [
      { ...GRUND, texter: { row: "Kvitto", lofte: "Bokförs." } },
      { id: "resa", namn: { sv: "Resa" }, farg: 2, ikon: "bell", fas: "ny", texter: { row: "Resa" } },
    ];
    expect(() => validateKatalog(katalog, { ikoner: IKONER, textnycklar: KRAVDA })).toThrow(/lofte/);
    expect(() => validateKatalog(katalog, { ikoner: IKONER, textnycklar: KRAVDA })).toThrow(/"resa"/);
  });

  it("en extra text utöver de krävda är tillåten", () => {
    // Appen kan sluta kräva en text utan att vilja radera den ur varje kategori.
    const k = bygg({ texter: { row: "Kvitto", lofte: "Bokförs.", gammal: "Står kvar." } }, { textnycklar: KRAVDA });
    expect(texten(k, "gammal")).toBe("Står kvar.");
  });
});

describe("uppslagningen i en vy", () => {
  const k = bygg({ texter: { row: { sv: "Kvitto" } } });

  it("⛔ svarar tom sträng och kastar aldrig, till skillnad från bygget", () => {
    /*
     * Den körs i en vy, på en rad som kan peka på en kategori som hunnit
     * arkiveras eller tas bort ur standardvärdena. En vy som kastar där tar ned
     * hela listan i stället för en rad.
     */
    expect(texten(k, "finns-inte")).toBe("");
    expect(texten(null, "row")).toBe("");
    expect(texten(k, undefined)).toBe("");
    expect(texten({ id: "utan" }, "row")).toBe("");
  });
});

describe("vakten mot halva översättningar", () => {
  it("⛔ räknar texterna i påsen och inte bara namnet", () => {
    /*
     * Inkorgens sorter bär nio texter var, alltså vida mer ord än namnen.
     * Tittade vakten bara på nyckeln `namn` skulle den visa noll medan
     * merparten av appens ytor var enspråkiga, alltså vara som grönast när
     * läget är sämst.
     */
    const k = bygg({ namn: { sv: "Kvitto", en: "Receipt" }, texter: { row: { sv: "Kvitto" }, lofte: { sv: "Bokförs.", en: "Booked." } } });
    expect(saknadeSprak(k)).toEqual(["texter.row"]);
  });

  it("en påse där allt är översatt ger noll", () => {
    const k = bygg({ namn: { sv: "Kvitto", en: "Receipt" }, texter: { row: { sv: "Kvitto", en: "Receipt" } } });
    expect(saknadeSprak(k)).toEqual([]);
  });

  it("sökvägen pekar på raden i en hel katalog, inte bara på nyckeln", () => {
    const katalog = [bygg({ namn: { sv: "Kvitto", en: "Receipt" }, texter: { row: { sv: "Kvitto" } } })];
    expect(saknadeSprak({ kategorier: katalog })).toEqual(["kategorier.0.texter.row"]);
  });
});

describe("sortkatalogen, alltså en katalog utan faser", () => {
  /*
   * ⛔ Mätt i cllp/bolag-ops#384: av appens åtta listor är varenda en som
   * flyttar en SORTLISTA, och `arAvslutad` och `AVSLUTADE_FASER` används
   * ingenstans i appen. Fasen hör till en STATUSKATALOG, där kategorierna är
   * stegen i ett flöde.
   */
  const SORT = { id: "kvitto", namn: { sv: "Kvitto" }, farg: 1, ikon: "check" };

  it("bygger utan fas, och fältet blir null och inte tom sträng", () => {
    // null säger "den här katalogen har inga faser". En tom sträng hade sett
    // ut som en fas någon glömt fylla i.
    const k = byggKategori(SORT, { ikoner: IKONER, faser: false });
    expect(k.fas).toBeNull();
  });

  it("⛔ en fas som ändå skickas in AVVISAS, den ignoreras inte", () => {
    /*
     * Vore fas bara valfri kunde två kategorier i samma katalog skilja sig åt,
     * och då kan ingen vy lita på svaret. Det är katalogen som avgör, inte
     * raden.
     */
    const fel = () => byggKategori({ ...SORT, fas: "aktiv" }, { ikoner: IKONER, faser: false });
    expect(fel).toThrow(/hör inte hemma i den här katalogen/);
    expect(fel).toThrow(/sortkatalog/);
  });

  it("⛔ och en statuskatalog kräver fortfarande sin fas", () => {
    // Förvalet är oförändrat. Hade det bytt hade varje befintlig katalog tyst
    // slutat kräva fasen.
    expect(() => byggKategori(SORT, { ikoner: IKONER })).toThrow(/fas/);
  });

  it("arAvslutad svarar falskt på en sortkategori i stället för att kasta", () => {
    const k = byggKategori(SORT, { ikoner: IKONER, faser: false });
    expect(arAvslutad(k.fas)).toBe(false);
  });

  it("hela katalogen går igenom utan faser", () => {
    const katalog = validateKatalog([SORT, { id: "resa", namn: { sv: "Resa" }, farg: 2, ikon: "bell" }], { ikoner: IKONER, faser: false });
    expect(katalog.map((k) => k.fas)).toEqual([null, null]);
  });
});

describe("en katalog utan färger", () => {
  /*
   * ⛔ Mätt i cllp/bolag-ops#384: inkorgens SEX sorter skiljs åt med ikon och
   * aldrig med färg, varken i vyn eller i datan. Slagpaletten har tre platser,
   * en mätt gräns där en fjärde faller i mörkt läge, så sex kategorier KAN
   * inte få var sin. Att kräva en palettplats hade tvingat fram dubbletter i
   * ett schema som annars är strikt, och två kategorier med samma färg är en
   * färg som slutat betyda något.
   */
  const SORT = { id: "kvitto", namn: { sv: "Kvitto" }, ikon: "check" };

  it("bygger utan färg, och fältet blir null", () => {
    const k = byggKategori(SORT, { ikoner: IKONER, faser: false, farger: false });
    expect(k.farg).toBeNull();
    expect(k.ikon).toBe("check");
  });

  it("⛔ en färg som ändå skickas in AVVISAS", () => {
    const fel = () => byggKategori({ ...SORT, farg: 1 }, { ikoner: IKONER, faser: false, farger: false });
    expect(fel).toThrow(/hör inte hemma i den här katalogen/);
    expect(fel).toThrow(/skiljs kategorierna åt med ikon/);
  });

  it("⛔ och en katalog MED färger kräver fortfarande sin palettplats", () => {
    // Förvalet är oförändrat. Hade det bytt hade varje befintlig katalog tyst
    // slutat kräva färgen, och då ritas korten utan kant.
    expect(() => byggKategori(SORT, { ikoner: IKONER, faser: false })).toThrow(/måste vara en palettplats/);
  });

  it("⛔ ikonen krävs fortfarande, för den är det enda som skiljer dem åt", () => {
    // Utan färg bär ikonen hela igenkänningen. En kategori utan ikon vore då
    // omöjlig att skilja från nästa.
    expect(() => byggKategori({ id: "x", namn: { sv: "X" } }, { ikoner: IKONER, faser: false, farger: false })).toThrow(/ikon/);
  });

  it("sex kategorier går igenom, vilket tre palettplatser aldrig tillåtit", () => {
    const sex = ["ekonomi", "kvitto", "arende", "forbattring", "bugg", "ovrigt"].map((id) => ({ id, namn: { sv: id }, ikon: "check" }));
    const katalog = validateKatalog(sex, { ikoner: IKONER, faser: false, farger: false });
    expect(katalog).toHaveLength(6);
    expect(katalog.every((k) => k.farg === null)).toBe(true);
  });
});
