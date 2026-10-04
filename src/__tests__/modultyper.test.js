import { describe, expect, it } from "vitest";
import { defineModule, validateModuler } from "../lib/modul.js";
import { byggKategori } from "../lib/katalog.js";
import { regelfragment } from "../lib/regler.js";
import { byggGrupp, ADMINGRUPPFALT, AGARGRUPPFALT } from "../lib/grupp.js";
import {
  MAX_TYPAVVIKELSER,
  MAX_TYPID,
  MODULTYPID_FORM,
  TYPAVVIKELSEFALT,
  MAX_TYPNAMN,
  MODULTYPAVGRANSARE,
  TYPYTOR,
  bidragForGrupp,
  byggTypavvikelser,
  delaModultypId,
  medAvvikelse,
  modultypId,
  typenForRad,
  typerForGrupp,
  typerTillValg,
  typmarke,
} from "../lib/modultyper.js";

/**
 * Modulernas bidrag till typer (0.42.0, #217). Proven mäter beteende: vad en grupp ser i sina val, vad en rad
 * visar när modulen är av, och vad som avvisas. Inget prov söker efter ett funktionsnamn i källan.
 */

/** @param {Record<string, any>} [over] */
const manifest = (over = {}) => ({
  id: "ekonomi",
  namn: { sv: "Ekonomi", en: "Economy" },
  nav: [],
  routes: [],
  samlingar: [],
  kallor: {},
  skapar: [],
  hubb: null,
  ...over,
});

const EKONOMI_TYPER = {
  inkorg: [
    { id: "uppdatering", namn: { sv: "Ekonomisk uppdatering", en: "Financial update" }, farg: 2, ikon: "wallet" },
    { id: "kvitto", namn: { sv: "Kvitto, utlägg" } },
  ],
  kalender: [{ id: "bokslut", namn: { sv: "Bokslut" }, farg: 1 }],
};
const RESOR_TYPER = { inkorg: [{ id: "kvitto", namn: { sv: "Reskvitto" } }] };

const ekonomi = () => defineModule(manifest({ typer: EKONOMI_TYPER }));
const resor = () => defineModule(manifest({ id: "resor", namn: { sv: "Resor" }, typer: RESOR_TYPER }));

/** @param {string} id @param {number} ordning @param {Record<string, any>} [over] */
const kat = (id, ordning, over = {}) =>
  byggKategori({ id, namn: { sv: id.toUpperCase() }, farg: 1, ikon: "inbox", ordning, groupId: "cps-ab", ...over }, { faser: false, ikoner: ["inbox", "wallet"] });
const BAS = [kat("arende", 0), kat("bugg", 1), kat("gammal", 2, { arkiverad: true })];

/** @param {Record<string, any>} [over] */
const ctx = (over = {}) => ({ bas: BAS, moduler: [ekonomi()], modulerPa: ["ekonomi"], avvikelser: [], ...over });
const idn = (/** @type {any[]} */ l) => l.map((t) => t.id);

describe("typer i defineModule", () => {
  it("⛔ en modul utan typer bär ändå en tom lista per yta, också aktivitet, och de är frysta", () => {
    const m = defineModule(manifest());
    expect(Object.keys(m.typer).sort()).toEqual([...TYPYTOR].sort());
    for (const yta of TYPYTOR) expect(m.typer[yta]).toEqual([]);
    expect(Object.isFrozen(m.typer)).toBe(true);
    expect(Object.isFrozen(m.typer.inkorg)).toBe(true);
    expect(TYPYTOR).toContain("aktivitet");
  });

  it("ett giltigt bidrag byggs med namn, ikon och färg, och saknade ikon och färg blir null", () => {
    const m = ekonomi();
    expect(m.typer.inkorg).toHaveLength(2);
    expect(m.typer.inkorg[0]).toEqual({ id: "uppdatering", namn: { sv: "Ekonomisk uppdatering", en: "Financial update" }, ikon: "wallet", farg: 2 });
    expect(m.typer.inkorg[1]).toEqual({ id: "kvitto", namn: { sv: "Kvitto, utlägg" }, ikon: null, farg: null });
    expect(m.typer.kalender.map((t) => t.id)).toEqual(["bokslut"]);
    expect(m.typer.handelser).toEqual([]);
    expect(Object.isFrozen(m.typer.inkorg[0])).toBe(true);
  });

  it("⛔ en okänd yta avvisas, och 'händelser' med ä säger att nyckeln är ASCII", () => {
    expect(() => defineModule(manifest({ typer: { "händelser": [] } }))).toThrow(/händelser.*finns inte.*ASCII/s);
    expect(() => defineModule(manifest({ typer: { sok: [] } }))).toThrow(/typer\.sok.*finns inte/s);
  });

  it("typer måste vara ett objekt och varje yta en lista", () => {
    expect(() => defineModule(manifest({ typer: [] }))).toThrow(/en lista/);
    expect(() => defineModule(manifest({ typer: null }))).toThrow(/null/);
    expect(() => defineModule(manifest({ typer: { inkorg: "kvitto" } }))).toThrow(/typer\.inkorg.*lista/);
  });

  it("⛔ en post med okänt fält, saknat id, kolon eller versaler i id, och dubblett i samma yta avvisas", () => {
    expect(() => defineModule(manifest({ typer: { inkorg: [{ id: "a", namn: { sv: "A" }, fas: "klar" }] } }))).toThrow(/fas.*inte känns igen/s);
    expect(() => defineModule(manifest({ typer: { inkorg: [{ namn: { sv: "A" } }] } }))).toThrow(/\.id.*krävs/);
    expect(() => defineModule(manifest({ typer: { inkorg: [{ id: "a:b", namn: { sv: "A" } }] } }))).toThrow(/avgränsare/);
    expect(() => defineModule(manifest({ typer: { inkorg: [{ id: "Kvitto", namn: { sv: "A" } }] } }))).toThrow(/små bokstäver/);
    expect(() => defineModule(manifest({ typer: { inkorg: [{ id: "a", namn: { sv: "A" } }, { id: "a", namn: { sv: "B" } }] } }))).toThrow(/står två gånger/);
  });

  it("samma id i två olika ytor är lagligt", () => {
    expect(() => defineModule(manifest({ typer: { inkorg: [{ id: "a", namn: { sv: "A" } }], kalender: [{ id: "a", namn: { sv: "A" } }] } }))).not.toThrow();
  });

  it("namn är { sv, en } och inte en sträng, och sv krävs", () => {
    expect(() => defineModule(manifest({ typer: { inkorg: [{ id: "a", namn: "A" }] } }))).toThrow(/är en sträng/);
    expect(() => defineModule(manifest({ typer: { inkorg: [{ id: "a", namn: { en: "A" } }] } }))).toThrow(/sv krävs/);
  });

  it("färgen är en palettplats och ikonen ett icke-tomt namn", () => {
    expect(() => defineModule(manifest({ typer: { inkorg: [{ id: "a", namn: { sv: "A" }, farg: 9 }] } }))).toThrow(/palettplats/);
    expect(() => defineModule(manifest({ typer: { inkorg: [{ id: "a", namn: { sv: "A" }, farg: "#fff" }] } }))).toThrow(/palettplats/);
    expect(() => defineModule(manifest({ typer: { inkorg: [{ id: "a", namn: { sv: "A" }, ikon: "  " }] } }))).toThrow(/ikon/);
  });

  it("två moduler kan ha samma lokala id, eftersom värdet bär modulen", () => {
    expect(() => validateModuler([manifest({ typer: EKONOMI_TYPER }), manifest({ id: "resor", namn: { sv: "Resor" }, typer: RESOR_TYPER })])).not.toThrow();
    expect(modultypId("ekonomi", "kvitto")).not.toBe(modultypId("resor", "kvitto"));
  });
});

describe("värdet ett bidrag har: modul:id", () => {
  it("modultypId och delaModultypId är varandras motsats", () => {
    expect(MODULTYPAVGRANSARE).toBe(":");
    expect(modultypId("ekonomi", "kvitto")).toBe("ekonomi:kvitto");
    expect(delaModultypId("ekonomi:kvitto")).toEqual({ modul: "ekonomi", id: "kvitto" });
  });

  it("⛔ en egen kategori har aldrig kolon, så delaModultypId ger null för den", () => {
    expect(delaModultypId("arende")).toBeNull();
    expect(delaModultypId("")).toBeNull();
    expect(delaModultypId("a:")).toBeNull();
    expect(delaModultypId("A:b")).toBeNull();
    expect(delaModultypId("a:b:c")).toBeNull();
    expect(delaModultypId(undefined)).toBeNull();
  });

  it("⛔ ID_FORM släpper inte kolon, så gruppen kan aldrig skapa en kategori vars id krockar med ett bidrag", () => {
    expect(() => kat("ekonomi:kvitto", 0)).toThrow(/små bokstäver/);
  });

  it("modultypId avvisar en halva som inte har id-formen", () => {
    expect(() => modultypId("Ekonomi", "kvitto")).toThrow(/id-formen/);
    expect(() => modultypId("ekonomi", "a:b")).toThrow(/id-formen/);
  });
});

describe("typerForGrupp: bas ∪ bidrag(påslagna), märkta", () => {
  it("⛔ med modulen PÅ ligger bidragen efter gruppens egna, och arkiverade egna är borta", () => {
    const t = typerForGrupp("inkorg", ctx());
    expect(idn(t)).toEqual(["arende", "bugg", "ekonomi:uppdatering", "ekonomi:kvitto"]);
    expect(t.map((x) => x.kalla)).toEqual(["bas", "bas", { modul: "ekonomi" }, { modul: "ekonomi" }]);
    expect(t.every((x) => x.tillstand === "aktiv")).toBe(true);
  });

  it("⛔ med modulen AV bidrar den inte, och bidraget syns inte som val", () => {
    expect(idn(typerForGrupp("inkorg", ctx({ modulerPa: [] })))).toEqual(["arende", "bugg"]);
  });

  it("en modul som är installerad men inte i gruppens lista bidrar inte, och en påslagen modul som inte är installerad kastar inte", () => {
    expect(idn(typerForGrupp("inkorg", ctx({ modulerPa: ["resor"] })))).toEqual(["arende", "bugg"]);
    expect(idn(typerForGrupp("inkorg", ctx({ modulerPa: ["ekonomi", "borttagen"] })))).toEqual(["arende", "bugg", "ekonomi:uppdatering", "ekonomi:kvitto"]);
  });

  it("ytorna är åtskilda: kalenderns bidrag syns inte i inkorgen och tvärtom", () => {
    expect(idn(typerForGrupp("kalender", ctx()))).toEqual(["arende", "bugg", "ekonomi:bokslut"]);
    expect(idn(typerForGrupp("handelser", ctx()))).toEqual(["arende", "bugg"]);
  });

  it("⛔ en kategori med samma lokala id som ett bidrag är en annan rad: båda syns, och de går att skilja åt", () => {
    const bas = [...BAS, kat("kvitto", 3)];
    const t = typerForGrupp("inkorg", ctx({ bas }));
    expect(idn(t).filter((i) => i.endsWith("kvitto"))).toEqual(["kvitto", "ekonomi:kvitto"]);
    expect(new Set(idn(t)).size).toBe(t.length);
  });

  it("två moduler med samma lokala id ger två rader med varsitt värde", () => {
    const t = typerForGrupp("inkorg", ctx({ moduler: [ekonomi(), resor()], modulerPa: ["ekonomi", "resor"] }));
    expect(idn(t)).toEqual(["arende", "bugg", "ekonomi:uppdatering", "ekonomi:kvitto", "resor:kvitto"]);
  });

  it("⛔ ägaren döljer ett bidrag: det försvinner ur valen men inte ur bidragslistan", () => {
    const avvikelser = [{ yta: "inkorg", id: "ekonomi:kvitto", dold: true }];
    expect(idn(typerForGrupp("inkorg", ctx({ avvikelser })))).toEqual(["arende", "bugg", "ekonomi:uppdatering"]);
    const lista = bidragForGrupp("inkorg", ctx({ avvikelser }));
    expect(lista.map((t) => [t.id, t.tillstand])).toEqual([["ekonomi:uppdatering", "aktiv"], ["ekonomi:kvitto", "dold"]]);
  });

  it("⛔ ägaren döper om ett bidrag: valet bär det nya namnet, och bara i den ytan", () => {
    const avvikelser = [{ yta: "inkorg", id: "ekonomi:uppdatering", dold: false, namn: { sv: "Pengar" } }];
    const t = typerForGrupp("inkorg", ctx({ avvikelser }));
    expect(t.find((x) => x.id === "ekonomi:uppdatering")?.namn).toEqual({ sv: "Pengar" });
    expect(t.find((x) => x.id === "ekonomi:uppdatering")?.omdopt).toBe(true);
    // Samma lokala id i en annan yta rörs inte.
    const k = typerForGrupp("kalender", ctx({ avvikelser: [{ yta: "inkorg", id: "ekonomi:bokslut", dold: true }] }));
    expect(idn(k)).toContain("ekonomi:bokslut");
  });

  it("⛔ en avvikelse som pekar på ett bidrag som inte finns skapar ingenting", () => {
    const avvikelser = [{ yta: "inkorg", id: "ekonomi:hittepa", dold: false, namn: { sv: "Fejk" } }, { yta: "inkorg", id: "falsk:typ", dold: false, namn: { sv: "Fejk" } }];
    expect(idn(typerForGrupp("inkorg", ctx({ avvikelser })))).toEqual(["arende", "bugg", "ekonomi:uppdatering", "ekonomi:kvitto"]);
  });

  it("ägarens namn gäller ett påslaget bidrag men inte en avstängd modul", () => {
    const avvikelser = [{ yta: "inkorg", id: "ekonomi:uppdatering", dold: false, namn: { sv: "Pengar" } }];
    expect(bidragForGrupp("inkorg", ctx({ avvikelser, modulerPa: [] }))).toEqual([]);
  });

  it("⛔ en lista som saknas är ett fel och inget tyst nedsläpp", () => {
    for (const nyckel of ["bas", "moduler", "modulerPa", "avvikelser"]) {
      const c = /** @type {Record<string, any>} */ (ctx());
      delete c[nyckel];
      expect(() => typerForGrupp("inkorg", /** @type {any} */ (c))).toThrow(new RegExp(`${nyckel} krävs`));
    }
    expect(() => typerForGrupp("inkorg", /** @type {any} */ (undefined))).toThrow(/bas krävs/);
  });

  it("en okänd yta och en modul som inte är byggd avvisas", () => {
    expect(() => typerForGrupp(/** @type {any} */ ("sok"), ctx())).toThrow(/finns inte/);
    expect(() => typerForGrupp("inkorg", ctx({ moduler: [{ id: "ekonomi" }] }))).toThrow(/byggda moduler/);
    expect(() => typerForGrupp("inkorg", ctx({ moduler: [manifest()] }))).toThrow(/byggda moduler/);
  });

  it("bas får vara tom, och en grupp utan modulerna får bara sina egna", () => {
    expect(idn(typerForGrupp("inkorg", ctx({ bas: [], modulerPa: [] })))).toEqual([]);
  });
});

describe("typenForRad: en skriven rad tappas aldrig", () => {
  it("en egen kategori, också en arkiverad, ger sin rad, och ett okänt omärkt id ger null", () => {
    expect(typenForRad("arende", "inkorg", ctx())?.kalla).toBe("bas");
    const gammal = typenForRad("gammal", "inkorg", ctx());
    expect(gammal?.tillstand).toBe("arkiverad");
    expect(typenForRad("finnsinte", "inkorg", ctx())).toBeNull();
    expect(typenForRad("", "inkorg", ctx())).toBeNull();
    expect(typenForRad(undefined, "inkorg", ctx())).toBeNull();
  });

  it("⛔ ett bidrag från en påslagen modul ger raden, aktiv", () => {
    const t = typenForRad("ekonomi:kvitto", "inkorg", ctx());
    expect(t?.tillstand).toBe("aktiv");
    expect(t?.kalla).toEqual({ modul: "ekonomi" });
    expect(t?.namn).toEqual({ sv: "Kvitto, utlägg" });
  });

  it("⛔ MODULEN ÄR AV: raden försvinner inte, den blir en arkiverad modul med sitt riktiga namn", () => {
    const t = typenForRad("ekonomi:kvitto", "inkorg", ctx({ modulerPa: [] }));
    expect(t?.tillstand).toBe("modul-av");
    expect(t?.namn).toEqual({ sv: "Kvitto, utlägg" });
    expect(typmarke(/** @type {any} */ (t))).toBe("arkiverad modul");
  });

  it("⛔ MODULEN ELLER TYPEN FINNS INTE LÄNGRE: raden bär id-halvan som namn och märks arkiverad modul", () => {
    const utanModul = typenForRad("borttagen:kvitto", "inkorg", ctx());
    expect(utanModul?.tillstand).toBe("modul-okand");
    expect(utanModul?.namn).toEqual({ sv: "kvitto" });
    expect(utanModul?.kalla).toEqual({ modul: "borttagen" });
    expect(typmarke(/** @type {any} */ (utanModul))).toBe("arkiverad modul");
    const utanTyp = typenForRad("ekonomi:hittepa", "inkorg", ctx());
    expect(utanTyp?.tillstand).toBe("modul-okand");
  });

  it("ett dolt bidrag visas fortfarande på raderna som bär det, märkt dold", () => {
    const t = typenForRad("ekonomi:kvitto", "inkorg", ctx({ avvikelser: [{ yta: "inkorg", id: "ekonomi:kvitto", dold: true }] }));
    expect(t?.tillstand).toBe("dold");
    expect(typmarke(/** @type {any} */ (t))).toBe("från Ekonomi, dold");
  });

  it("ett omdöpt bidrag visas med ägarens namn på raderna", () => {
    const t = typenForRad("ekonomi:kvitto", "inkorg", ctx({ avvikelser: [{ yta: "inkorg", id: "ekonomi:kvitto", dold: false, namn: { sv: "Underlag" } }] }));
    expect(t?.namn).toEqual({ sv: "Underlag" });
  });

  it("ytan avgör: samma värde i fel yta är ett okänt bidrag", () => {
    expect(typenForRad("ekonomi:bokslut", "inkorg", ctx())?.tillstand).toBe("modul-okand");
    expect(typenForRad("ekonomi:bokslut", "kalender", ctx())?.tillstand).toBe("aktiv");
  });
});

describe("märket och valen", () => {
  it("«från <modul>» på valt språk, och ingenting för en egen kategori", () => {
    const [arende, , uppdatering] = typerForGrupp("inkorg", ctx());
    expect(typmarke(arende)).toBeNull();
    expect(typmarke(uppdatering)).toBe("från Ekonomi");
    expect(typmarke(uppdatering, "en")).toBe("from Economy");
  });

  it("typerTillValg ger value, label och hint, och hint saknas för en egen kategori", () => {
    const v = typerTillValg(typerForGrupp("inkorg", ctx()));
    expect(v[0]).toEqual({ value: "arende", label: "ARENDE" });
    expect("hint" in v[0]).toBe(false);
    expect(v[2]).toEqual({ value: "ekonomi:uppdatering", label: "Ekonomisk uppdatering", hint: "från Ekonomi" });
    expect(typerTillValg(typerForGrupp("inkorg", ctx()), "en")[2]).toEqual({ value: "ekonomi:uppdatering", label: "Financial update", hint: "from Economy" });
  });
});

describe("byggTypavvikelser", () => {
  it("frånvarande ger en tom, fryst lista", () => {
    const l = byggTypavvikelser(undefined, "g");
    expect(l).toEqual([]);
    expect(Object.isFrozen(l)).toBe(true);
  });

  it("giltiga poster byggs, med namn normaliserat", () => {
    const l = byggTypavvikelser([{ yta: "inkorg", id: "ekonomi:kvitto", dold: true }, { yta: "kalender", id: "ekonomi:bokslut", dold: false, namn: { sv: " Bokslutet ", en: "" } }], "g");
    expect(l).toEqual([{ yta: "inkorg", id: "ekonomi:kvitto", dold: true }, { yta: "kalender", id: "ekonomi:bokslut", dold: false, namn: { sv: "Bokslutet" } }]);
  });

  it("⛔ en avvikelse som inte gör något avvisas", () => {
    expect(() => byggTypavvikelser([{ yta: "inkorg", id: "ekonomi:kvitto", dold: false }], "g")).toThrow(/gör ingenting/);
  });

  it("form: lista, okända fält, krävda fält, yta, id, dold, namn, dubblett och tak", () => {
    expect(() => byggTypavvikelser("x", "g")).toThrow(/lista/);
    expect(() => byggTypavvikelser([1], "g")).toThrow(/objekt/);
    expect(() => byggTypavvikelser([{ yta: "inkorg", id: "ekonomi:kvitto", dold: true, extra: 1 }], "g")).toThrow(/extra/);
    expect(() => byggTypavvikelser([{ yta: "inkorg", id: "ekonomi:kvitto" }], "g")).toThrow(/saknar dold/);
    expect(() => byggTypavvikelser([{ yta: "sok", id: "ekonomi:kvitto", dold: true }], "g")).toThrow(/ytan/);
    expect(() => byggTypavvikelser([{ yta: "inkorg", id: "kvitto", dold: true }], "g")).toThrow(/modul:id/);
    expect(() => byggTypavvikelser([{ yta: "inkorg", id: "Ekonomi:kvitto", dold: true }], "g")).toThrow(/modul:id/);
    expect(() => byggTypavvikelser([{ yta: "inkorg", id: "ekonomi:kvitto", dold: "ja" }], "g")).toThrow(/true eller false/);
    expect(() => byggTypavvikelser([{ yta: "inkorg", id: "ekonomi:kvitto", dold: false, namn: "Underlag" }], "g")).toThrow(/\{ sv, en \}/);
    expect(() => byggTypavvikelser([{ yta: "inkorg", id: "ekonomi:kvitto", dold: false, namn: { sv: "A", fr: "B" } }], "g")).toThrow(/fr/);
    expect(() => byggTypavvikelser([{ yta: "inkorg", id: "ekonomi:kvitto", dold: false, namn: { en: "A" } }], "g")).toThrow(/sv krävs/);
    expect(() => byggTypavvikelser([{ yta: "inkorg", id: "ekonomi:kvitto", dold: false, namn: { sv: "x".repeat(MAX_TYPNAMN + 1) } }], "g")).toThrow(/längre/);
    expect(() => byggTypavvikelser([{ yta: "inkorg", id: "ekonomi:kvitto", dold: true }, { yta: "inkorg", id: "ekonomi:kvitto", dold: true }], "g")).toThrow(/två gånger/);
    const manga = Array.from({ length: MAX_TYPAVVIKELSER + 1 }, (_, i) => ({ yta: "inkorg", id: `ekonomi:t${i}`, dold: true }));
    expect(() => byggTypavvikelser(manga, "g")).toThrow(/Taket/);
    expect(() => byggTypavvikelser(manga.slice(0, MAX_TYPAVVIKELSER), "g")).not.toThrow();
  });

  it("samma id i två ytor är två avvikelser och inte en dubblett", () => {
    expect(() => byggTypavvikelser([{ yta: "inkorg", id: "ekonomi:kvitto", dold: true }, { yta: "kalender", id: "ekonomi:kvitto", dold: true }], "g")).not.toThrow();
  });

  it("⛔ med kända moduler avvisas ett påhittat modul-id och en typ modulen inte lämnat", () => {
    const rad = [{ yta: "inkorg", id: "hittepa:kvitto", dold: true }];
    expect(() => byggTypavvikelser(rad, "g", [ekonomi()])).toThrow(/modulen "hittepa", som inte är registrerad/);
    expect(() => byggTypavvikelser(rad, "g", ["ekonomi"])).toThrow(/modulen "hittepa", som inte är registrerad/);
    expect(() => byggTypavvikelser([{ yta: "inkorg", id: "ekonomi:hittepa", dold: true }], "g", [ekonomi()])).toThrow(/bidrar inte med någon typ "hittepa"/);
    expect(() => byggTypavvikelser([{ yta: "kalender", id: "ekonomi:kvitto", dold: true }], "g", [ekonomi()])).toThrow(/bidrar inte med någon typ/);
    expect(() => byggTypavvikelser([{ yta: "inkorg", id: "ekonomi:kvitto", dold: true }], "g", [ekonomi()])).not.toThrow();
  });

  it("med bara modul-id kan bara modulen kontrolleras, inte typen", () => {
    expect(() => byggTypavvikelser([{ yta: "inkorg", id: "ekonomi:vadsomhelst", dold: true }], "g", ["ekonomi"])).not.toThrow();
  });
});

describe("medAvvikelse", () => {
  it("lägger till, ersätter och rör inte de övriga", () => {
    let l = medAvvikelse([], { yta: "inkorg", id: "ekonomi:kvitto", dold: true });
    expect(l).toEqual([{ yta: "inkorg", id: "ekonomi:kvitto", dold: true }]);
    l = medAvvikelse(l, { yta: "inkorg", id: "ekonomi:uppdatering", dold: false, namn: { sv: "Pengar" } });
    expect(l).toHaveLength(2);
    l = medAvvikelse(l, { yta: "inkorg", id: "ekonomi:kvitto", dold: true, namn: { sv: "Underlag" } });
    expect(l.find((x) => x.id === "ekonomi:kvitto")).toEqual({ yta: "inkorg", id: "ekonomi:kvitto", dold: true, namn: { sv: "Underlag" } });
    expect(l).toHaveLength(2);
  });

  it("⛔ ett önskat tillstånd som inte avviker tar bort raden i stället för att skriva den", () => {
    const l = medAvvikelse([{ yta: "inkorg", id: "ekonomi:kvitto", dold: true }], { yta: "inkorg", id: "ekonomi:kvitto", dold: false, namn: null });
    expect(l).toEqual([]);
    expect(medAvvikelse([], { yta: "inkorg", id: "ekonomi:kvitto", dold: false })).toEqual([]);
    expect(medAvvikelse([], { yta: "inkorg", id: "ekonomi:kvitto", dold: false, namn: { sv: "  " } })).toEqual([]);
  });

  it("kräver en lista och ett objekt", () => {
    expect(() => medAvvikelse(/** @type {any} */ (undefined), { yta: "inkorg", id: "ekonomi:kvitto", dold: true })).toThrow(/lista/);
    expect(() => medAvvikelse([], /** @type {any} */ (null))).toThrow(/objekt/);
  });
});

describe("typavvikelser på gruppen", () => {
  const rad = (/** @type {Record<string, any>} */ over = {}) => ({ id: "cps-ab", namn: { sv: "Bolaget" }, moduler: ["ekonomi"], arkiverad: false, skapadAv: { uid: "u1", namn: "CP", typ: "manniska", kalla: "test" }, ...over });

  it("en grupp utan fältet läses med en tom lista, utan migrering", () => {
    expect(byggGrupp(rad()).typavvikelser).toEqual([]);
  });

  it("⛔ skrivvägen med modulerna avvisar ett påhittat modul-id, läsvägen utan dem tål det", () => {
    const med = rad({ typavvikelser: [{ yta: "inkorg", id: "hittepa:kvitto", dold: true }] });
    expect(() => byggGrupp(med, [ekonomi()])).toThrow(/inte är registrerad/);
    expect(byggGrupp(med).typavvikelser).toHaveLength(1);
  });

  it("⛔ fältet är ÄGARENS: det står i AGARGRUPPFALT och inte i ADMINGRUPPFALT", () => {
    expect(AGARGRUPPFALT).toContain("typavvikelser");
    expect(ADMINGRUPPFALT).not.toContain("typavvikelser");
  });

  it("namnet är ASCII, som varje annat fält i modellen", () => {
    expect("typavvikelser").toMatch(/^[\x00-\x7f]+$/);
  });
});

describe("reglerna härleds ur samma listor och gränser (inga handskrivna kopior)", () => {
  const regler = regelfragment();

  it("⛔ ägaren, inte admin, får skriva fältet: AGARGRUPPFALT-listan i regeln bär det och ADMINGRUPPFALT-listan inte", () => {
    const owner = regler.match(/opsTypavvikelserGiltiga\(request\.resource\.data\)\)\s*&& request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasOnly\(\[([^\]]*)\]\)/);
    const admin = regler.match(/opsArAdmin\(gid\)\s*&& request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasOnly\(\[([^\]]*)\]\)/);
    expect(owner?.[1]).toContain('"typavvikelser"');
    expect(admin?.[1]).toBeTruthy();
    expect(admin?.[1]).not.toContain("typavvikelser");
  });

  it("⛔ create och update kräver båda valideringen, och update bär den i ägarens gren", () => {
    expect(regler).toMatch(/allow create: if opsArAgare\(gid\)[^;]*opsTypavvikelserGiltiga\(request\.resource\.data\);/);
    // 0.42.1 (#223): update validerar typavvikelser bara när den ändras, som externaDatakallor.
    expect(regler).toMatch(/allow update: if \(opsArAgare\(gid\)[\s\S]*?&& \(!opsAndrad\(request\.resource\.data, resource\.data, 'typavvikelser'\) \|\| opsTypavvikelserGiltiga\(request\.resource\.data\)\)\s*&& request\.resource\.data\.diff/);
  });

  it("postens fält, ytorna, id-formen, id-taket och antalet utrullade poster kommer ur modulens konstanter", () => {
    expect(regler).toContain(`p.keys().hasOnly([${TYPAVVIKELSEFALT.map((f) => `'${f}'`).join(", ")}])`);
    expect(regler).toContain(`p.yta in [${TYPYTOR.map((f) => `'${f}'`).join(", ")}]`);
    expect(regler).toContain(`p.id.size() <= ${MAX_TYPID}`);
    const form = MODULTYPID_FORM.source.replace(/^\^/, "").replace(/\$$/, "");
    expect(regler).toContain(`p.id.matches('${form}')`);
    expect(regler).toContain(`l.size() <= ${MAX_TYPAVVIKELSER}\n`);
    expect(regler.match(/opsTypavvikelse\(l\[\d+\]\)/g)).toHaveLength(MAX_TYPAVVIKELSER);
  });

  it("⛔ regelns id-uttryck släpper bara det byggaren släpper", () => {
    const re = new RegExp(`^${MODULTYPID_FORM.source.replace(/^\^/, "").replace(/\$$/, "")}$`);
    for (const ok of ["ekonomi:kvitto", "a1:b_2-c"]) expect(re.test(ok)).toBe(true);
    for (const fel of ["kvitto", "Ekonomi:kvitto", "a:b:c", ":b", "a:", "-a:b"]) expect(re.test(fel)).toBe(false);
  });
});
