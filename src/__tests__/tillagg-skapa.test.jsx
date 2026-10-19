import { afterEach, describe, expect, it, vi } from "vitest";
import { memo } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsAppShell, useOppnaSkapa } from "../components/OpsAppShell.jsx";
import { HANDELSE_PLATSER, PLATSER, synsPa, tillaggFor } from "../lib/tillagg.js";
import { validateModuler } from "../lib/modul.js";
import { byggGruppkalender, byggMinKalender } from "../lib/kalendrar.js";

/**
 * Platsen `handelse.skapa` (0.127.0, cllp/lifehub.app#383, beslut 0003): en ruta i formuläret för en NY händelse, efter "Kräv svar".
 *
 * ⛔ CP 2026-10-19: "ja det är bättre att röstningen går till så" (svar på förslaget att välja omröstningen redan i formuläret Ny händelse).
 * Ramverket känner inte appen Datumomröstning: det proven mäter är PLATSEN. Tillägget här heter `omrostning` bara för att läsas som det som ska komma.
 *
 * Hur rutan SER UT mäts inte här (jsdom kör ingen CSS): `check-skalyta` avsnitt 40 mäter tilläggsplatserna.
 */

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

const G = "cps-ab";
const gk = (/** @type {string} */ id, extra = {}) => byggGruppkalender({ id, namn: { sv: id[0].toUpperCase() + id.slice(1) }, farg: 4, ikon: "kalender", groupId: G, ...extra });
const mk = (/** @type {string} */ id) => byggMinKalender({ id, namn: id[0].toUpperCase() + id.slice(1), farg: 2, ikon: "hjarta" });
const kalendrar = { gruppens: [gk("styrelse", { forvald: true })], mina: [mk("privat")] };

/** @param {any[]} tillagg @param {string} [id] */
const MODUL = (tillagg, id = "omrostning") => ({
  id,
  namn: { sv: "Datumomröstning", en: "Date poll" },
  nav: [],
  routes: [],
  samlingar: [],
  kallor: {},
  skapar: [],
  hubb: null,
  tillagg,
});

/** Tillägget i formuläret: en knapp som slår på läget "rösta om datum", och ett värde som skalet håller. */
function Ruta({ grupp, varde, onVarde }) {
  return (
    <div data-prov-ruta={String(grupp?.id)}>
      <button type="button" onClick={() => onVarde({ pa: true, forslag: ["2026-10-12", "2026-10-14"] })}>Låt gruppen rösta om datum</button>
      <output data-varde="">{JSON.stringify(varde ?? null)}</output>
    </div>
  );
}

/** @param {Record<string, unknown>} [skapa] @param {Record<string, unknown>} [over] */
const TILLAGG = (skapa = { datumEjSatt: (/** @type {any} */ v) => v?.pa === true }, over = {}) => ({
  plats: "handelse.skapa",
  id: "rosta",
  etikett: { sv: "Rösta om datum", en: "Vote on date" },
  komponent: Ruta,
  skapa,
  ...over,
});

describe("manifestet: platsen och dess fält valideras vid uppstart", () => {
  it("platsen står i listorna, och 'Syns på' säger Händelser för en modul som bara har den", () => {
    expect(HANDELSE_PLATSER).toEqual(["handelse.sektion", "handelse.atgard", "handelse.skapa"]);
    expect(PLATSER).toContain("handelse.skapa");
    const [m] = validateModuler([MODUL([TILLAGG()])]);
    expect(synsPa(/** @type {any} */ (m))).toEqual({ egenYta: false, ytor: ["handelse"] });
  });

  it("godtar skapa med någon av de tre funktionerna, fryser det, och en omvalidering går igenom", () => {
    const fel = () => [];
    const [m] = validateModuler([MODUL([TILLAGG({ fel }), TILLAGG({ efterSkapa: async () => {} }, { id: "andra", etikett: { sv: "Andra", en: "Second" } })])]);
    const t = /** @type {any} */ (m).tillagg;
    expect(Object.keys(t[0].skapa)).toEqual(["fel"]);
    expect(t[0].skapa.fel).toBe(fel);
    expect(Object.isFrozen(t[0].skapa)).toBe(true);
    expect(() => validateModuler([m])).not.toThrow();
    // memo-komponenter släpps in som på de andra händelseplatserna.
    expect(() => validateModuler([MODUL([TILLAGG({ fel }, { komponent: memo(() => null) })])])).not.toThrow();
  });

  it("⛔ skapa krävs på platsen, och avvisas med modulens namn och fältet i felet", () => {
    expect(() => validateModuler([MODUL([TILLAGG(/** @type {any} */ (null))])])).toThrow(/modul "omrostning": tillagg\[0\]\.skapa för "rosta" krävs på handelse\.skapa/);
    expect(() => validateModuler([MODUL([TILLAGG(/** @type {any} */ ("nej"))])])).toThrow(/tillagg\[0\]\.skapa för "rosta" krävs på handelse\.skapa/);
    expect(() => validateModuler([MODUL([TILLAGG({})])])).toThrow(/måste bära minst en av datumEjSatt, fel, efterSkapa/);
  });

  it("⛔ okända fält och fält som inte är funktioner avvisas", () => {
    expect(() => validateModuler([MODUL([TILLAGG({ fel: () => [], titel: "x" })])])).toThrow(/bär fälten titel som inte känns igen/);
    expect(() => validateModuler([MODUL([TILLAGG({ datumEjSatt: true })])])).toThrow(/skapa för "rosta"\.datumEjSatt måste vara en funktion, inte boolean/);
  });

  it("⛔ skapa hör bara hemma på handelse.skapa: på handelse.sektion, handelse.atgard och inspelning.mal avvisas det", () => {
    const skapa = { fel: () => [] };
    for (const plats of ["handelse.sektion", "handelse.atgard"]) {
      expect(() => validateModuler([MODUL([TILLAGG(skapa, { plats })])]), plats).toThrow(/skapa för "rosta" hör bara hemma på platsen handelse\.skapa/);
    }
    const mal = { plats: "inspelning.mal", id: "spara", etikett: { sv: "Spara", en: "Save" }, spara: () => {}, skapa };
    expect(() => validateModuler([MODUL([mal])])).toThrow(/skapa för "spara" hör bara hemma på platsen handelse\.skapa/);
  });

  it("handelse.skapa kräver en komponent som de andra händelseplatserna", () => {
    expect(() => validateModuler([MODUL([TILLAGG({ fel: () => [] }, { komponent: undefined })])])).toThrow(/komponent för "rosta" krävs/);
  });
});

describe("skalet: tilläggsrutan i formuläret för en ny händelse", () => {
  /** @type {any[]} */
  let mottaget = [];
  /** @param {any} p */
  function Form(p) {
    mottaget.push({ ...p });
    return (
      <form id={p.formId} aria-label="Händelseformulär">
        <p data-dag="">{String(p.datum)}</p>
      </form>
    );
  }
  const senast = () => mottaget[mottaget.length - 1];
  const skapaPaGrupp = (/** @type {any} */ moduler, /** @type {string[]} */ pa = ["omrostning"], /** @type {any} */ extra = {}) => ({
    sparaEtikett: "Spara",
    lage: G,
    moduler,
    aktivGrupp: { id: G, moduler: pa },
    handelse: { form: Form, katalog: "handelsetyper", kalendrar, redigera: () => ({ laddar: false, finns: true, typ: "mote", kalenderId: "styrelse", kravSvar: false }), ...extra },
    kataloger: [{ id: "handelsetyper", kategorier: [{ id: "mote", namn: { sv: "Möte" }, ordning: 0 }] }],
  });
  function Knapp({ redigera }) {
    const oppna = useOppnaSkapa();
    return <button type="button" onClick={() => oppna("handelse", redigera ? { id: "h1" } : undefined)}>{redigera ? "Ändra händelsen" : "Öppna formuläret"}</button>;
  }
  /** @param {{ skapa: any, redigera?: boolean }} a */
  function Skal({ skapa, redigera = false }) {
    return (
      <OpsAppShell brand="Ops" nav={[{ href: "/", label: "Start" }]} activeHref="/" grupper={{ lista: [{ id: G, namn: "CPS AB", roll: "agare" }], aktiv: G, onValj: () => {} }} skapa={skapa}>
        <Knapp redigera={redigera} />
      </OpsAppShell>
    );
  }
  const moduler = () => validateModuler([MODUL([TILLAGG()])]);
  const oppnaPanelen = async (namn = "Öppna formuläret") => {
    await userEvent.setup().click(screen.getByRole("button", { name: namn }));
    return screen.findByRole("region", { name: /händelse/i });
  };

  it("⛔ rutan ritas efter Kräv svar, i en påslagen modul, och får grupp, varde och onVarde", async () => {
    mottaget = [];
    render(<Skal skapa={skapaPaGrupp(moduler())} />);
    const panel = await oppnaPanelen();
    const ruta = /** @type {HTMLElement} */ (panel.querySelector('[data-skapa-tillagg="omrostning:rosta"]'));
    expect(ruta).not.toBeNull();
    expect(ruta.querySelector("[data-prov-ruta]")?.getAttribute("data-prov-ruta")).toBe(G);
    expect(ruta.querySelector("[data-varde]")?.textContent).toBe("null");
    const krav = /** @type {HTMLElement} */ (panel.querySelector("[data-krav-svar]"));
    expect(krav).not.toBeNull();
    // Efter "Kräv svar" i dokumentordning.
    expect(krav.compareDocumentPosition(ruta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Skalet håller värdet: komponenten anropar onVarde och får det tillbaka.
    fireEvent.click(within(ruta).getByRole("button", { name: "Låt gruppen rösta om datum" }));
    expect(JSON.parse(/** @type {string} */ (ruta.querySelector("[data-varde]")?.textContent))).toEqual({ pa: true, forslag: ["2026-10-12", "2026-10-14"] });
  });

  it("⛔ formuläret får tillagg med tre svar, och datumEjSatt följer tilläggets värde", async () => {
    mottaget = [];
    render(<Skal skapa={skapaPaGrupp(moduler())} />);
    const panel = await oppnaPanelen();
    await waitFor(() => expect(senast()).toBeDefined());
    expect(Object.keys(senast().tillagg).sort()).toEqual(["datumEjSatt", "efterSkapa", "fel"]);
    expect(senast().tillagg.datumEjSatt).toBe(false);
    expect(senast().tillagg.fel).toEqual([]);
    fireEvent.click(within(panel).getByRole("button", { name: "Låt gruppen rösta om datum" }));
    await waitFor(() => expect(senast().tillagg.datumEjSatt).toBe(true));
  });

  it("⛔ en avslagen modul ritar ingen ruta och dess funktioner anropas inte", async () => {
    mottaget = [];
    const datumEjSatt = vi.fn(() => true);
    const avslagen = validateModuler([MODUL([TILLAGG({ datumEjSatt })])]);
    render(<Skal skapa={skapaPaGrupp(avslagen, [])} />);
    const panel = await oppnaPanelen();
    expect(panel.querySelector("[data-skapa-tillagg]")).toBeNull();
    expect(datumEjSatt).not.toHaveBeenCalled();
    expect("tillagg" in senast()).toBe(false);
  });

  it("⛔ en app utan tillägg får exakt de props den fick före 0.127.0: ingen tillagg-nyckel", async () => {
    mottaget = [];
    render(<Skal skapa={skapaPaGrupp(undefined)} />);
    const panel = await oppnaPanelen();
    expect(panel.querySelector("[data-skapa-tillagg]")).toBeNull();
    expect(Object.keys(senast()).sort()).toEqual(["blockerar", "datum", "forifyllt", "formId", "groupId", "kalender", "kravSvar", "mal", "onKlar", "typ"]);
  });

  it("⛔ inte när händelsen ändras: redigeringsläget har ingen ruta och formuläret inget tillagg", async () => {
    mottaget = [];
    render(<Skal skapa={skapaPaGrupp(moduler())} redigera />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Ändra händelsen" }));
    await screen.findByRole("region", { name: /händelse/i });
    await waitFor(() => expect(senast()).toBeDefined());
    expect(document.querySelector("[data-skapa-tillagg]")).toBeNull();
    expect("tillagg" in senast()).toBe(false);
    expect(senast().redigera).toBe("h1");
  });

  it("⛔ inte i en av Mina kalendrar: en post har inga svar och ingen omröstning, och rutan är tillbaka i gruppens", async () => {
    mottaget = [];
    render(<Skal skapa={skapaPaGrupp(moduler())} />);
    const user = userEvent.setup();
    const panel = await oppnaPanelen();
    expect(panel.querySelector("[data-skapa-tillagg]")).not.toBeNull();
    await user.click(within(panel).getByRole("button", { name: /^Kalender: Styrelse/ }));
    const valjare = await screen.findByRole("dialog", { name: "Kalender" });
    await user.click(within(within(valjare).getByRole("region", { name: "Mina kalendrar" })).getByRole("button", { name: "Privat" }));
    await waitFor(() => expect(senast().kalender).toMatchObject({ id: "privat", slag: "mina" }));
    expect(panel.querySelector("[data-skapa-tillagg]")).toBeNull();
    expect("tillagg" in senast()).toBe(false);
    await user.click(within(panel).getByRole("button", { name: /^Kalender: Privat/ }));
    const igen = await screen.findByRole("dialog", { name: "Kalender" });
    await user.click(within(within(igen).getByRole("region", { name: /: kalendrar$/ })).getByRole("button", { name: "Styrelse" }));
    await waitFor(() => expect(panel.querySelector("[data-skapa-tillagg]")).not.toBeNull());
  });

  it("⛔ värdet nollställs varje gång formuläret öppnas", async () => {
    mottaget = [];
    render(<Skal skapa={skapaPaGrupp(moduler())} />);
    const user = userEvent.setup();
    const panel = await oppnaPanelen();
    fireEvent.click(within(panel).getByRole("button", { name: "Låt gruppen rösta om datum" }));
    await waitFor(() => expect(senast().tillagg.datumEjSatt).toBe(true));
    await user.click(within(panel).getByRole("button", { name: "Avbryt" }));
    expect(screen.queryByRole("region", { name: /händelse/i })).toBeNull();
    await oppnaPanelen();
    await waitFor(() => expect(senast().tillagg.datumEjSatt).toBe(false));
  });

  it("fel från tilläggen samlas, i den ordning tilläggen står", async () => {
    mottaget = [];
    const flera = validateModuler([
      MODUL([TILLAGG({ fel: (/** @type {any} */ v) => (v?.pa ? [] : ["Välj minst två dagar"]) }), TILLAGG({ fel: () => ["Sista svarsdag har passerat"] }, { id: "andra", etikett: { sv: "Andra", en: "Second" } })]),
    ]);
    render(<Skal skapa={skapaPaGrupp(flera)} />);
    await oppnaPanelen();
    await waitFor(() => expect(senast()).toBeDefined());
    expect(senast().tillagg.fel).toEqual(["Välj minst två dagar", "Sista svarsdag har passerat"]);
    expect(senast().tillagg.datumEjSatt).toBe(false);
  });

  it("⛔ en funktion som svarar fel kastar med tilläggets namn, och tystas inte till 'inga fel'", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const felaktigFel = validateModuler([MODUL([TILLAGG({ fel: () => /** @type {any} */ ("ett fel") })])]);
    render(<Skal skapa={skapaPaGrupp(felaktigFel)} />);
    expect(() => fireEvent.click(screen.getByRole("button", { name: "Öppna formuläret" }))).toThrow(/tillägget "omrostning:rosta" \(handelse\.skapa\) gav "ett fel" från fel/);
    cleanup();
    // Panelens adress (?skapa=handelse) stannar kvar efter felet och hade öppnat formuläret direkt vid nästa rendering.
    window.history.replaceState(null, "", "/");
    const felaktigDatum = validateModuler([MODUL([TILLAGG({ datumEjSatt: () => /** @type {any} */ (undefined) })])]);
    render(<Skal skapa={skapaPaGrupp(felaktigDatum)} />);
    expect(() => fireEvent.click(screen.getByRole("button", { name: "Öppna formuläret" }))).toThrow(/tillägget "omrostning:rosta" \(handelse\.skapa\) gav undefined från datumEjSatt/);
    spy.mockRestore();
  });

  it("⛔ efterSkapa anropas en gång med händelsens id, värdet som gällde vid Spara och gruppen, och alla tillägg körs även om ett faller", async () => {
    mottaget = [];
    const anrop = /** @type {any[]} */ ([]);
    const m = validateModuler([
      MODUL([
        TILLAGG({ datumEjSatt: (/** @type {any} */ v) => v?.pa === true, efterSkapa: async (/** @type {any} */ a) => { anrop.push(["rosta", a]); throw new Error("förslagen skrevs inte"); } }),
        TILLAGG({ efterSkapa: async (/** @type {any} */ a) => { anrop.push(["andra", a]); } }, { id: "andra", etikett: { sv: "Andra", en: "Second" } }),
      ]),
    ]);
    render(<Skal skapa={skapaPaGrupp(m)} />);
    const panel = await oppnaPanelen();
    fireEvent.click(within(panel).getAllByRole("button", { name: "Låt gruppen rösta om datum" })[0]);
    await waitFor(() => expect(senast().tillagg.datumEjSatt).toBe(true));
    // Appen sparar med `tillagg` från en tidigare rendering; värdet som gäller är ändå det senaste.
    const gammal = senast().tillagg;
    await expect(gammal.efterSkapa("h-ny")).rejects.toThrow("förslagen skrevs inte");
    expect(anrop.map((a) => a[0])).toEqual(["rosta", "andra"]);
    expect(anrop[0][1]).toEqual({ handelseId: "h-ny", varde: { pa: true, forslag: ["2026-10-12", "2026-10-14"] }, grupp: { id: G, moduler: ["omrostning"] } });
    expect(anrop[1][1].varde).toBeUndefined();
    expect(anrop[1][1].handelseId).toBe("h-ny");
  });

  it("flera fel i efterSkapa blir ett fel med alla orden, och inget sväljs", async () => {
    mottaget = [];
    const m = validateModuler([
      MODUL([
        TILLAGG({ efterSkapa: async () => { throw new Error("första"); } }),
        TILLAGG({ efterSkapa: async () => { throw new Error("andra"); } }, { id: "andra", etikett: { sv: "Andra", en: "Second" } }),
      ]),
    ]);
    render(<Skal skapa={skapaPaGrupp(m)} />);
    await oppnaPanelen();
    await waitFor(() => expect(senast()).toBeDefined());
    await expect(senast().tillagg.efterSkapa("h")).rejects.toThrow("första andra");
  });
});

describe("tillaggFor: platsen följer samma filter som de andra", () => {
  it("en kärnmodul är alltid påslagen, en avslagen bidrar inte", () => {
    const m = validateModuler([MODUL([TILLAGG()])]);
    expect(tillaggFor({ moduler: m, grupp: { moduler: ["omrostning"] }, plats: "handelse.skapa" }).map((t) => t.id)).toEqual(["rosta"]);
    expect(tillaggFor({ moduler: m, grupp: { moduler: [] }, plats: "handelse.skapa" })).toEqual([]);
    expect(tillaggFor({ moduler: m, grupp: undefined, plats: "handelse.skapa" })).toEqual([]);
  });
});
