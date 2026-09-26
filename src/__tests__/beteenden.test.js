import { describe, it, expect } from "vitest";
import { beteendet, kopplaBeteenden } from "../lib/beteenden.js";
import { validateKatalog } from "../lib/katalog.js";

/**
 * Väg A (#111): data i katalogen, beteende i koden, och en vakt som binder
 * ihop dem åt BÅDA håll.
 *
 * ⛔ Provet som saknades i cllp/bolag-ops#144 är raden om en kategori utan
 * hanterare. Sorten `bugg` lades till i appen, blev aldrig ett GitHub-ärende,
 * och ingenting blev rött. Buggrapporter försvann tyst.
 */

const IKONER = ["check", "bell"];
const KATALOG = validateKatalog(
  [
    { id: "uppgift", namn: { sv: "Uppgifter" }, farg: 1, ikon: "check", fas: "aktiv" },
    { id: "bugg", namn: { sv: "Buggar" }, farg: 2, ikon: "bell", fas: "ny" },
  ],
  { ikoner: IKONER },
);

describe("kopplingen katalog till kod", () => {
  it("binder ihop varje kategori med sin hanterare", () => {
    const kopplade = kopplaBeteenden(KATALOG, { uppgift: { rutt: "register" }, bugg: { rutt: "github" } });
    expect(Object.keys(kopplade).sort()).toEqual(["bugg", "uppgift"]);
    expect(kopplade.bugg.beteende).toEqual({ rutt: "github" });
    expect(kopplade.bugg.kategori.namn.sv).toBe("Buggar");
  });

  it("⛔ en kategori utan hanterare är rött, och det är felet från #144", () => {
    /*
     * En sådan kategori ritas, går att välja och gör sedan ingenting. Det syns
     * ingenstans: inte i ett bygge, inte i en vy, bara som arbete som aldrig
     * blev av.
     */
    const fel = () => kopplaBeteenden(KATALOG, { uppgift: {} });
    expect(fel).toThrow(/bugg/);
    expect(fel).toThrow(/saknar hanterare/);
  });

  it("⛔ en hanterare utan kategori är också rött", () => {
    // Död kod som ser levande ut städas aldrig, eftersom nästa läsare antar
    // att den används av något hen inte hittat.
    const fel = () => kopplaBeteenden(KATALOG, { uppgift: {}, bugg: {}, gammal: {} });
    expect(fel).toThrow(/gammal/);
    expect(fel).toThrow(/saknar kategori/);
  });

  it("⛔ samlar BÅDA felen i ett meddelande, inte ett i taget", () => {
    // Här är felet en lista som ska stämma med en annan lista, och den som ska
    // laga vill se hela skillnaden i stället för att köra om fyra gånger.
    const fel = () => kopplaBeteenden(KATALOG, { gammal: {} });
    expect(fel).toThrow(/saknar hanterare/);
    expect(fel).toThrow(/saknar kategori/);
  });

  it("⛔ en ARKIVERAD kategori kräver också en hanterare", () => {
    /*
     * Den går inte att välja för nya poster, men de gamla raderna finns kvar
     * och ska ritas och räknas som förut. Undantogs de skulle arkivering tyst
     * göra historiken obrukbar, alltså vara värre än det raderande den
     * ersätter.
     */
    const medArkiverad = validateKatalog([...KATALOG, { id: "gammal", namn: { sv: "Gammal" }, farg: 1, ikon: "check", fas: "klar", arkiverad: true }], {
      ikoner: IKONER,
    });
    expect(() => kopplaBeteenden(medArkiverad, { uppgift: {}, bugg: {} })).toThrow(/gammal/);
    expect(() => kopplaBeteenden(medArkiverad, { uppgift: {}, bugg: {}, gammal: {} })).not.toThrow();
  });

  it("felet säger vilken katalog det gäller", () => {
    expect(() => kopplaBeteenden(KATALOG, {}, { katalog: "inkorgssorter" })).toThrow(/inkorgssorter:/);
  });

  it("en tom katalog med tomma hanterare är i sin ordning", () => {
    // Läget före seedningen. Ett fel där gör appen omöjlig att starta första
    // gången.
    expect(kopplaBeteenden([], {})).toEqual({});
  });
});

describe("uppslagningen i en vy", () => {
  const kopplade = kopplaBeteenden(KATALOG, { uppgift: { rutt: "register" }, bugg: { rutt: "github" } });

  it("ger hanteraren för ett id", () => {
    expect(beteendet(kopplade, "bugg")).toEqual({ rutt: "github" });
  });

  it("⛔ svarar null i stället för att kasta, till skillnad från kopplingen", () => {
    /*
     * Kopplingen körs vid uppstart och ska stoppa en felaktig uppsättning. Den
     * här körs i en vy, på en rad som kan peka på en kategori som hunnit tas
     * bort, och en vy som kastar där tar ned hela listan i stället för en rad.
     */
    expect(beteendet(kopplade, "finns-inte")).toBeNull();
    expect(beteendet(kopplade, undefined)).toBeNull();
    expect(beteendet(null, "bugg")).toBeNull();
  });
});
