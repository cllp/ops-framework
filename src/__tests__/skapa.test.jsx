import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { defineModule, validateModuler } from "../lib/modul.js";
import { skaparFor, kontrolleraSkaparkataloger, typerAttValja, skapalaget } from "../lib/skapa.js";
import { OpsSkapa } from "../components/OpsSkapa.jsx";

/**
 * Fas 3: skapa-kontraktet (#150). Spegelbilden av källorna.
 */

const REG = (/** @type {string} */ id, /** @type {string | null} */ katalog = null) => ({
  id,
  namn: { sv: id, en: id },
  ikon: "gem",
  katalog,
  form: () => <p>{`form ${id}`}</p>,
});

const modul = (/** @type {string} */ id, /** @type {any[]} */ skapar) =>
  defineModule({ id, namn: { sv: id }, nav: [], routes: [], samlingar: [], kallor: {}, skapar });

describe("manifestets sjunde del", () => {
  it("tar emot en registrering och fryser den", () => {
    const m = modul("inkorg", [REG("arende", "sorter")]);
    expect(m.skapar).toHaveLength(1);
    expect(m.skapar[0].katalog).toBe("sorter");
    expect(Object.isFrozen(m.skapar)).toBe(true);
  });

  it("⛔ skapar krävs, även tomt", () => {
    // Samma skäl som kallor: en modul som INTE kan skapa något och en som
    // glömt fältet ser likadana ut om det är valfritt.
    expect(() => defineModule({ id: "x", namn: { sv: "X" }, nav: [], routes: [], samlingar: [], kallor: {} })).toThrow(
      /skapar krävs och måste vara en lista/,
    );
  });

  it("⛔ katalog krävs även när den är null, och undefined är ett fel", () => {
    // null är ett svar, saknad är en gissning. Ett kvitto har ingen typ.
    const utan = { ...REG("kvitto") };
    delete (/** @type {any} */ (utan)).katalog;
    expect(() => modul("kvitton", [utan])).toThrow(/katalog för "kvitto" krävs/);
    expect(() => modul("kvitton", [REG("kvitto", null)])).not.toThrow();
  });

  it("⛔ ett lazy-formulär tas emot, eftersom lazy ger ett objekt", () => {
    // Mätt: exempelmodulen MÅSTE ladda sitt formulär lat, annars går manifestet
    // inte att läsa ur regelgeneratorns Node-skript. En typeof-function-koll
    // hade gjort det enda rätta sättet omöjligt.
    const lat = { $$typeof: Symbol.for("react.lazy"), _payload: {}, _init: () => null };
    expect(() => modul("liv", [{ ...REG("matning"), form: lat }])).not.toThrow();
  });

  it("⛔ ett saknat formulär är ett fel", () => {
    expect(() => modul("liv", [{ ...REG("matning"), form: null }])).toThrow(/form för "matning" krävs/);
  });

  it("okända fält i en registrering avvisas", () => {
    expect(() => modul("liv", [{ ...REG("matning"), farg: 3 }])).toThrow(/bär fälten farg som inte känns igen/);
  });

  it("två registreringar med samma id i samma modul avvisas", () => {
    expect(() => modul("liv", [REG("matning"), REG("matning")])).toThrow(/står två gånger i samma modul/);
  });

  it("⛔ två MODULER som registrerar samma id avvisas av validateModuler", () => {
    // Var för sig giltiga, tillsammans en flik vars innehåll avgörs av
    // registreringsordningen. Samma felform som två moduler på samma route.
    const a = { id: "inkorg", namn: { sv: "a" }, nav: [], routes: [], samlingar: [], kallor: {}, skapar: [REG("arende")] };
    const b = { id: "liv", namn: { sv: "b" }, nav: [], routes: [], samlingar: [], kallor: {}, skapar: [REG("arende")] };
    expect(() => validateModuler([a, b])).toThrow(/registrerar båda att de skapar "arende"/);
  });
});

describe("skaparFor", () => {
  const moduler = [modul("inkorg", [REG("arende", "sorter")]), modul("liv", [REG("matning")])];

  it("⛔ en avstängd modul bidrar inte", () => {
    // En flik som skapar rader ingen kan se efteråt är värre än ingen flik.
    expect(skaparFor(moduler, ["inkorg"]).map((r) => r.id)).toEqual(["arende"]);
  });

  it("stämplar modulId, och det tas inte ur registreringen", () => {
    expect(skaparFor(moduler, ["inkorg", "liv"]).map((r) => r.modulId)).toEqual(["inkorg", "liv"]);
  });

  it("en grupp utan påslagna moduler ger noll registreringar, inte ett fel", () => {
    expect(skaparFor(moduler, [])).toEqual([]);
  });
});

describe("kontrolleraSkaparkataloger", () => {
  it("⛔ en katalog gruppen inte har är ett FEL, inte en tom lista", () => {
    // En tom typväljare ser ut som en katalog någon glömt fylla, alltså som
    // något användaren kan rätta. Det här är ett programmeringsfel.
    expect(() => kontrolleraSkaparkataloger([{ id: "arende", katalog: "sorter", modulId: "inkorg" }], [])).toThrow(
      /katalogen "sorter" finns inte i gruppen/,
    );
  });

  it("en registrering utan katalog passerar", () => {
    expect(() => kontrolleraSkaparkataloger([{ id: "kvitto", katalog: null }], [])).not.toThrow();
  });

  it("en känd katalog passerar", () => {
    expect(() => kontrolleraSkaparkataloger([{ id: "arende", katalog: "sorter" }], ["sorter"])).not.toThrow();
  });

  it("⛔ en utelämnad lista kända kataloger är ett fel, inte en tom", () => {
    expect(() => kontrolleraSkaparkataloger([], /** @type {any} */ (undefined))).toThrow(/måste vara en lista katalog-id/);
  });
});

describe("typerAttValja", () => {
  const kataloger = [
    {
      id: "sorter",
      kategorier: [
        { id: "b", namn: { sv: "B" }, ordning: 2 },
        { id: "a", namn: { sv: "A" }, ordning: 1 },
        { id: "gammal", namn: { sv: "Gammal" }, ordning: 0, arkiverad: true },
      ],
    },
  ];

  it("sorterar på ordning", () => {
    expect(typerAttValja("sorter", kataloger).map((k) => k.id)).toEqual(["a", "b"]);
  });

  it("⛔ arkiverade går inte att välja", () => {
    // De försvinner inte ur gamla rader: en rad som pekar på en borttagen
    // kategori blir en rad utan ord. Därför arkivering och inte radering.
    expect(typerAttValja("sorter", kataloger).map((k) => k.id)).not.toContain("gammal");
  });

  it("ingen katalog ger tom lista, och en okänd katalog också", () => {
    expect(typerAttValja(null, kataloger)).toEqual([]);
    expect(typerAttValja("finns-inte", kataloger)).toEqual([]);
  });
});

describe("skapalaget", () => {
  it("⛔ utan grupp (personen är inte med i någon) är svaret ingenGrupp, även när det finns registreringar", () => {
    // Gruppfrågan går först. Frågades tomheten först hade en grupplös
    // användare fått veta att det inte finns något att skapa, vilket är fel
    // svar på rätt fråga.
    expect(skapalaget({ lage: null, registreringar: [{ id: "a" }] }).tillstand).toBe("ingenGrupp");
  });

  it("en grupp utan registreringar är tomt, inte ingenGrupp", () => {
    expect(skapalaget({ lage: "bolaget", registreringar: [] })).toEqual({ tillstand: "tomt", grupp: "bolaget" });
  });

  it("⛔ utan grupp OCH noll registreringar ger ändå ingenGrupp", () => {
    // Mutationsfynd: provet ovan hade registreringar, så båda ordningarna gav
    // samma svar och att byta dem överlevde svepet. Det är HÄR ordningen syns.
    expect(skapalaget({ lage: null, registreringar: [] })).toEqual({ tillstand: "ingenGrupp", grupp: null });
  });

  it("en grupp med registreringar är redo, och bär gruppen", () => {
    expect(skapalaget({ lage: "bolaget", registreringar: [{ id: "a" }] })).toEqual({ tillstand: "redo", grupp: "bolaget" });
  });
});

describe("OpsSkapa (#168: bara listan, popovern och modalen hör till OpsAppShell)", () => {
  it("⛔ utan grupp säger panelen att personen inte är med i någon grupp, inte att det är tomt", () => {
    render(<OpsSkapa registreringar={[{ ...REG("arende", "sorter"), modulId: "inkorg" }]} lage={null} />);
    expect(screen.getByText(/inte med i någon grupp/)).toBeTruthy();
  });

  it("⛔ en tom lista visar en text, aldrig ett tomt plus", () => {
    render(<OpsSkapa registreringar={[]} lage="bolaget" />);
    expect(screen.getByText(/Ingen av gruppens moduler kan skapa något än/)).toBeTruthy();
  });

  // ══ #164, korrigering D: platt lista, ikon + ord, ingen rubrik, inga
  // flikar. Ett tryck kallar `onValj` med registreringen (#168: skalet
  // bestämmer vad som händer sen, listan vet det inte). ══════════════════
  it("⛔ N registreringar ger N RADER med ikon och ord, ingen tablist, ingen rubrik", () => {
    const ikonRitare = (/** @type {string} */ namn) => <svg data-testid={`ikon-${namn}`} />;
    render(
      <OpsSkapa
        registreringar={[
          { ...REG("arende", "sorter"), modulId: "inkorg" },
          { ...REG("kvitto"), modulId: "kvitton" },
        ]}
        lage="bolaget"
        ikonRitare={ikonRitare}
      />,
    );
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByRole("heading")).toBeNull();
    const rader = screen.getAllByRole("button");
    expect(rader).toHaveLength(2);
    expect(screen.getByText("arende")).toBeTruthy();
    expect(screen.getByText("kvitto")).toBeTruthy();
    // ikon-per-rad, via appens EGEN ikonRitare (ramverket känner inte ikonen "gem").
    expect(screen.getAllByTestId("ikon-gem")).toHaveLength(2);
  });

  it("utan ikonRitare ritas ingen ikon, bara ordet", () => {
    render(<OpsSkapa registreringar={[{ ...REG("kvitto"), modulId: "kvitton" }]} lage="bolaget" />);
    expect(screen.getByText("kvitto")).toBeTruthy();
  });

  it("⛔ ETT TRYCK PÅ RADEN kallar onValj med HELA registreringen, listan byts inte ut", () => {
    const onValj = vi.fn();
    const arende = { ...REG("arende", "sorter"), modulId: "inkorg" };
    render(
      <OpsSkapa
        registreringar={[arende, { ...REG("kvitto"), modulId: "kvitton" }]}
        lage="bolaget"
        onValj={onValj}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "arende" }));
    expect(onValj).toHaveBeenCalledTimes(1);
    expect(onValj).toHaveBeenCalledWith(arende);
    // ⛔ #168: LISTAN STANNAR KVAR. Det är popovern (skalet) som stänger sig
    // själv och öppnar modalen, inte OpsSkapa som byter sitt eget innehåll.
    expect(screen.getByRole("button", { name: "arende" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "kvitto" })).toBeTruthy();
  });

  it("⛔ MUTATIONSSVEP: utan onValj kastar ett klick inget fel, det är bara ett handslag ingen tar emot", () => {
    render(<OpsSkapa registreringar={[{ ...REG("arende", "sorter"), modulId: "inkorg" }]} lage="bolaget" />);
    expect(() => fireEvent.click(screen.getByRole("button", { name: "arende" }))).not.toThrow();
  });

  it("⛔ en avdelare mellan TVÅ MODULER, ingen avdelare mellan rader i SAMMA modul", () => {
    render(
      <OpsSkapa
        registreringar={[
          { ...REG("arende", "sorter"), modulId: "inkorg" },
          { ...REG("kvitto"), modulId: "inkorg" },
          { ...REG("matning"), modulId: "liv" },
        ]}
        lage="bolaget"
      />,
    );
    // ⛔ GOLV: minst en avdelare (arbetsreglernas punkt 4, ett tomt underlag
    // ger inte grönt av misstag). Exakt en: mellan "inkorg" och "liv".
    expect(screen.getAllByRole("separator")).toHaveLength(1);
  });
});
