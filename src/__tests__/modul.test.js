import { describe, it, expect } from "vitest";
import { KALLTYPER, defineModule, validateModuler } from "../lib/modul.js";

/**
 * Fas 3 i epiken #92: modulmanifestet (#128).
 *
 * ⛔ PROVEN HANDLAR OM VAD SOM AVVISAS, inte om vad som accepteras. Samma skäl
 * som katalogproven: en validering som bara provas med giltig data är en
 * funktion som returnerar sitt argument, och den står grön hela vägen genom
 * felet den finns för att fånga.
 *
 * ⛔ OCH VARJE PROV KRÄVER ETT STYCKE AV MEDDELANDET, inte bara att något
 * kastades. Ett `toThrow()` utan mönster är grönt även när manifestet föll på
 * något helt annat än det provet heter, och då mäter provet att koden kraschar
 * och inte att den säger vad som är fel. Klarkriteriet i #128 är uttryckligen
 * att felet ska säga VILKET FÄLT i VILKEN MODUL.
 */

/** Ett giltigt manifest, som allt annat varieras ifrån. */
const LIV = () => ({
  id: "liv",
  namn: { sv: "Liv", en: "Life" },
  nav: [{ href: "/liv", label: "Liv" }],
  routes: [{ path: "/liv", vy: () => null }],
  samlingar: ["matningar"],
  kallor: {},
  skapar: [],
});

describe("modulmanifestet tas emot", () => {
  it("bygger en modul av ett helt manifest", () => {
    const modul = defineModule(LIV());
    expect(modul.id).toBe("liv");
    expect(modul.namn).toEqual({ sv: "Liv", en: "Life" });
    expect(modul.routes).toHaveLength(1);
    /*
     * ⛔ SAMLINGARNA ÄR UTSKRIVNA ÄVEN NÄR MANIFESTET SKREV EN STRÄNG (#130).
     * Strängformen är utgiven i 0.25.0 och tas fortfarande emot, men läsaren
     * får alltid samma form: en sträng och ett objekt ska inte kräva två
     * kodvägar hos den som konsumerar manifestet.
     */
    expect(modul.samlingar).toEqual([{ namn: "matningar", falt: null, agareKravsForSkrivning: false }]);
  });

  it("fryser det den lämnar ifrån sig, så valideringen fortsätter gälla", () => {
    const modul = defineModule(LIV());
    expect(Object.isFrozen(modul)).toBe(true);
    expect(Object.isFrozen(modul.routes)).toBe(true);
    expect(Object.isFrozen(modul.samlingar)).toBe(true);
  });

  /*
   * ⛔ BÅDA HALVORNA, OCH DET ÄR ETT MUTATIONSFYND. Provet mätte först bara
   * att anroparens lista är ofryst, och det är sant även när ramverket inte
   * fryser någonting alls: svepet bytte `Object.freeze(d.nav.slice())` mot
   * `d.nav` och provet stod grönt. En kopia bevisas av att den ena är fryst
   * OCH den andra inte.
   */
  it("fryser en KOPIA av nav och inte anroparens lista", () => {
    const manifest = LIV();
    const modul = defineModule(manifest);
    expect(Object.isFrozen(modul.nav)).toBe(true);
    expect(Object.isFrozen(manifest.nav)).toBe(false);
  });

  it("tar emot en tom modul, alltså en som bara finns för sina källor", () => {
    const modul = defineModule({ ...LIV(), nav: [], routes: [], samlingar: [], kallor: { handelser: () => [] } });
    expect(modul.nav).toEqual([]);
    expect(Object.keys(modul.kallor)).toEqual(["handelser"]);
  });
});

describe("⛔ ett fält i taget avvisas, med fältnamn och modul-id i felet", () => {
  it("manifestet måste vara ett objekt", () => {
    expect(() => defineModule(/** @type {any} */ ("liv"))).toThrow(/manifestet måste vara ett objekt, inte string/);
    expect(() => defineModule(/** @type {any} */ ([]))).toThrow(/manifestet måste vara ett objekt, inte en lista/);
  });

  it("id krävs", () => {
    const { id: _id, ...utan } = LIV();
    expect(() => defineModule(utan)).toThrow(/id krävs/);
  });

  it("id följer samma form som ett kategori-id", () => {
    expect(() => defineModule({ ...LIV(), id: "Liv.Modul" })).toThrow(/id "Liv.Modul" får bara innehålla små bokstäver/);
  });

  it("okända fält avvisas, de slängs inte", () => {
    expect(() => defineModule({ ...LIV(), ikoner: ["Heart"] })).toThrow(/modul "liv": fälten ikoner känns inte igen/);
  });

  it("⛔ ett namn som är en sträng kastar, till skillnad från i katalogerna", () => {
    expect(() => defineModule({ ...LIV(), namn: "Liv" })).toThrow(/modul "liv": namn är en sträng/);
  });

  it("ett namn utan svenska kastar", () => {
    expect(() => defineModule({ ...LIV(), namn: { en: "Life" } })).toThrow(/modul "liv": namn sv krävs/);
  });

  /*
   * ⛔ FELET KOMMER UR `validateNav` OCH INTE UR EN EGEN KONTROLL. Se noten i
   * modul.js: den egna kontrollen togs bort när svepet visade att den var en
   * dubblett. Provet står kvar, eftersom BETEENDET fortfarande är ett krav.
   */
  it("nav krävs som lista, även tom, och det är validateNav som säger det", () => {
    const { nav: _nav, ...utan } = LIV();
    expect(() => defineModule(utan)).toThrow(/modul "liv": nav krävs och måste vara en lista av \{ href, label \}/);
  });

  it("⛔ nav valideras av validateNav, alltså med samma regler som skalet", () => {
    const djupt = [{ href: "/liv", label: "Liv", children: [{ href: "/liv/a", label: "A", children: [{ href: "/liv/a/b", label: "B" }] }] }];
    expect(() => defineModule({ ...LIV(), nav: djupt })).toThrow(/modul "liv": nav får ha EN nivå barn/);
  });

  it("routes krävs som lista, även tom", () => {
    const { routes: _routes, ...utan } = LIV();
    expect(() => defineModule(utan)).toThrow(/modul "liv": routes krävs och måste vara en lista/);
  });

  it("en route måste vara ett objekt", () => {
    expect(() => defineModule({ ...LIV(), routes: ["/liv"] })).toThrow(/modul "liv": routes\[0\] måste vara ett objekt/);
  });

  it("okända fält i en route avvisas", () => {
    expect(() => defineModule({ ...LIV(), routes: [{ path: "/liv", vy: () => null, titel: "Liv" }] })).toThrow(/modul "liv": fälten titel i routes\[0\] känns inte igen/);
  });

  it("route utan path avvisas", () => {
    expect(() => defineModule({ ...LIV(), routes: [{ vy: () => null }] })).toThrow(/modul "liv": routes\[0\].path krävs/);
  });

  it("en relativ path avvisas", () => {
    expect(() => defineModule({ ...LIV(), routes: [{ path: "liv", vy: () => null }] })).toThrow(/routes\[0\].path "liv" måste börja med snedstreck/);
  });

  it("samma path två gånger avvisas", () => {
    const routes = [
      { path: "/liv", vy: () => null },
      { path: "/liv", vy: () => null },
    ];
    expect(() => defineModule({ ...LIV(), routes })).toThrow(/routes\[1\].path "\/liv" står två gånger/);
  });

  it("route utan vy avvisas", () => {
    expect(() => defineModule({ ...LIV(), routes: [{ path: "/liv" }] })).toThrow(/routes\[0\].vy krävs för "\/liv"/);
  });

  it("⛔ en vy som är ett objekt tas emot, eftersom memo och forwardRef ger objekt", () => {
    const memoLik = { $$typeof: Symbol.for("react.memo"), type: () => null };
    expect(() => defineModule({ ...LIV(), routes: [{ path: "/liv", vy: memoLik }] })).not.toThrow();
  });

  it("samlingar krävs som lista, även tom", () => {
    const { samlingar: _s, ...utan } = LIV();
    expect(() => defineModule(utan)).toThrow(/modul "liv": samlingar krävs och måste vara en lista/);
  });

  it("⛔ ett samlingsnamn med snedstreck avvisas, eftersom roten är appens", () => {
    expect(() => defineModule({ ...LIV(), samlingar: ["kunder/liv/matningar"] })).toThrow(/samlingar\[0\] "kunder\/liv\/matningar" är en sökväg och inte ett namn/);
  });

  it("ett samlingsnamn med versaler avvisas", () => {
    expect(() => defineModule({ ...LIV(), samlingar: ["Matningar"] })).toThrow(/samlingar\[0\] "Matningar" får bara innehålla små bokstäver/);
  });

  it("samma samling två gånger avvisas", () => {
    expect(() => defineModule({ ...LIV(), samlingar: ["matningar", "matningar"] })).toThrow(/samlingar\[1\] "matningar" står två gånger/);
  });

  it("kallor krävs som objekt, även tomt", () => {
    const { kallor: _k, ...utan } = LIV();
    expect(() => defineModule(utan)).toThrow(/modul "liv": kallor krävs och måste vara ett objekt/);
  });

  it("en okänd yta avvisas", () => {
    expect(() => defineModule({ ...LIV(), kallor: { vader: () => [] } })).toThrow(/modul "liv": kallan "vader" finns inte/);
  });

  it("en källa som inte är en funktion avvisas", () => {
    expect(() => defineModule({ ...LIV(), kallor: { sok: [] } })).toThrow(/modul "liv": kallan "sok" måste vara en funktion, inte object/);
  });

  it("alla sex ytorna tas emot", () => {
    /** @type {Record<string, Function>} */
    const kallor = {};
    for (const yta of KALLTYPER) kallor[yta] = () => [];
    const modul = defineModule({ ...LIV(), kallor });
    expect(Object.keys(modul.kallor)).toEqual([...KALLTYPER]);
  });
});

describe("⛔ krockar mellan moduler, som inte syns i ett manifest", () => {
  it("två moduler med samma id avvisas", () => {
    expect(() => validateModuler([LIV(), LIV()])).toThrow(/två moduler har id "liv"/);
  });

  it("två moduler som gör anspråk på samma route avvisas", () => {
    const annan = { ...LIV(), id: "halsa", samlingar: ["steg"] };
    expect(() => validateModuler([LIV(), annan])).toThrow(/modulerna "liv" och "halsa" gör båda anspråk på routen "\/liv"/);
  });

  it("två moduler som gör anspråk på samma samling avvisas", () => {
    const annan = { ...LIV(), id: "halsa", routes: [{ path: "/halsa", vy: () => null }] };
    expect(() => validateModuler([LIV(), annan])).toThrow(/modulerna "liv" och "halsa" gör båda anspråk på samlingen "matningar"/);
  });

  it("två moduler utan krockar tas emot", () => {
    const annan = { ...LIV(), id: "halsa", nav: [], routes: [{ path: "/halsa", vy: () => null }], samlingar: ["steg"] };
    expect(validateModuler([LIV(), annan]).map((m) => m.id)).toEqual(["liv", "halsa"]);
  });

  it("listan måste vara en lista", () => {
    expect(() => validateModuler(/** @type {any} */ ({}))).toThrow(/moduler måste vara en lista/);
  });
});
