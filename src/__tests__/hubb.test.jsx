import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { defineModule, validateModuler } from "../lib/modul.js";
import { byggOmdirigeringar, hubbForGrupp, hubbPoster, kontrolleraOmdirigeringar, modulLage, omdirigera, valbaraModuler } from "../lib/hubb.js";
import { OpsGruppHubb } from "../components/OpsHub.jsx";
import { OpsModulSida } from "../components/OpsModulSida.jsx";
import { OpsGruppFormular } from "../components/OpsGruppFormular.jsx";

/**
 * Hubben per grupp och modulens insida (0.37.0, #184).
 *
 * ⛔ PROVEN KRÄVER ETT STYCKE AV MEDDELANDET, inte bara att något kastades (samma skäl som modul.test.js): ett
 * `toThrow()` utan mönster är grönt även när manifestet föll på något helt annat än provet heter.
 *
 * ⛔ EKONOMINS ADRESSER ÄR MÄTTA, INTE PÅHITTADE. `GAMLA` är varje sida hubben i bolag-ops ledde till vid
 * cllp/bolag-ops@94aec4d (`web/src/app/navigering.jsx`, `byggModuler`, och `App.jsx:694-728`). Provet över listan
 * är alltså ett prov över det som faktiskt fanns, och en glömd adress blir röd.
 */

const I = (/** @type {string} */ n) => <svg data-ikon={n} />;

/** Delarna i Ekonomi, i navigationens ordning. Id och gammal adress per del. */
const DELAR = /** @type {const} */ ([
  ["oversikt", "Översikt", "/oversikt"],
  ["inkomster", "Inkomster", "/inkomster"],
  ["kostnader", "Kostnader", "/kostnader"],
  ["abonnemang", "Abonnemang", "/abonnemang"],
  ["tillgangar", "Tillgångar", "/tillgangar"],
  ["pension", "Pension", "/pension"],
  ["forsakringar", "Försäkringar", "/forsakringar"],
  ["liv", "Liv", "/liv"],
  ["schema", "Schema", "/schema"],
  ["cutover", "Cutover", "/process"],
  ["bolaget", "Bolaget", "/bolaget"],
  ["kontakter", "Kontakter", "/kontakter"],
  ["lankar", "Länkar", "/lankar"],
  ["jamforelse", "Jämförelse", "/jamforelse"],
]);

/** Hubbens sidor i bolag-ops före flytten: alla som hubben (kort eller barn) ledde till, plus modulsidan. */
const GAMLA = ["/oversikt", "/hub/ekonomi", "/ekonomi", "/inkomster", "/kostnader", "/abonnemang", "/tillgangar", "/pension", "/forsakringar", "/liv", "/schema", "/process", "/bolaget", "/kontakter", "/lankar", "/jamforelse"];

const EKONOMI = () => ({
  id: "ekonomi",
  namn: { sv: "Ekonomi", en: "Finance" },
  nav: [],
  routes: [],
  samlingar: [],
  kallor: {},
  skapar: [],
  hubb: {
    ikon: I("wallet"),
    rutt: "/ekonomi",
    startsida: "oversikt",
    delar: DELAR.map(([id, sv]) => ({ id, namn: { sv }, ikon: I(id), rutt: `/ekonomi/${id}` })),
  },
});

const RESOR = () => ({
  id: "resor",
  namn: { sv: "Resor" },
  nav: [],
  routes: [],
  samlingar: [],
  kallor: {},
  skapar: [],
  hubb: { ikon: I("plan"), rutt: "/resor", startsida: "kommande", delar: [{ id: "kommande", namn: { sv: "Kommande" }, ikon: I("k"), rutt: "/resor/kommande" }] },
});

const INKORG = () => ({ id: "inkorg", namn: { sv: "Inkorg" }, nav: [], routes: [], samlingar: [], kallor: {}, skapar: [], hubb: null });

const moduler = () => validateModuler([EKONOMI(), RESOR(), INKORG()]);

/** @param {(m: any) => void} f */
const med = (f) => {
  const m = EKONOMI();
  f(m);
  return () => defineModule(m);
};

describe("manifestets hubb: vad som avvisas", () => {
  it("tar emot ett helt kort och fryser det", () => {
    const m = defineModule(EKONOMI());
    expect(m.hubb?.rutt).toBe("/ekonomi");
    expect(m.hubb?.delar).toHaveLength(14);
    expect(Object.isFrozen(m.hubb)).toBe(true);
    expect(Object.isFrozen(m.hubb?.delar[0])).toBe(true);
  });

  it("⛔ hubb krävs, även när den är null", () => {
    const m = /** @type {any} */ (EKONOMI());
    delete m.hubb;
    expect(() => defineModule(m)).toThrow(/modul "ekonomi": hubb krävs/);
    expect(defineModule(INKORG()).hubb).toBeNull();
  });

  it("⛔ en lista eller en sträng är inget kort", () => {
    expect(med((m) => (m.hubb = []))).toThrow(/hubb måste vara ett objekt.*inte en lista/);
    expect(med((m) => (m.hubb = "ekonomi"))).toThrow(/hubb måste vara ett objekt/);
  });

  it("⛔ okända fält i kortet avvisas", () => {
    expect(med((m) => (m.hubb.barn = []))).toThrow(/fälten barn i hubb känns inte igen/);
  });

  it("⛔ ikonen är ett element, inte ett namn eller en komponent", () => {
    expect(med((m) => (m.hubb.ikon = "wallet"))).toThrow(/hubb.ikon måste vara ett React-element/);
    expect(med((m) => (m.hubb.ikon = () => null))).toThrow(/hubb.ikon måste vara ett React-element/);
    expect(med((m) => (m.hubb.delar[2].ikon = undefined))).toThrow(/hubb.delar\[2\].ikon för "kostnader" måste vara ett React-element/);
  });

  it("⛔ modulens adress börjar med snedstreck och slutar inte med ett", () => {
    expect(med((m) => (m.hubb.rutt = "ekonomi"))).toThrow(/hubb.rutt "ekonomi" måste vara en adress/);
    expect(med((m) => (m.hubb.rutt = "/ekonomi/"))).toThrow(/hubb.rutt "\/ekonomi\/" måste vara en adress/);
    expect(med((m) => (m.hubb.rutt = "/"))).toThrow(/hubb.rutt "\/" måste vara en adress/);
  });

  it("⛔ en modul utan delar har ingen insida", () => {
    expect(med((m) => (m.hubb.delar = []))).toThrow(/hubb.delar krävs och måste ha minst en del/);
  });

  it("⛔ en dels adress ligger under modulens", () => {
    expect(med((m) => (m.hubb.delar[1].rutt = "/inkomster"))).toThrow(/hubb.delar\[1\].rutt "\/inkomster" för "inkomster" måste ligga under modulens adress, alltså börja med \/ekonomi\//);
    expect(med((m) => (m.hubb.delar[1].rutt = "/ekonomi"))).toThrow(/måste ligga under modulens adress/);
    expect(med((m) => (m.hubb.delar[1].rutt = "/ekonomisk/x"))).toThrow(/måste ligga under modulens adress/);
  });

  it("⛔ två delar med samma id eller samma adress avvisas", () => {
    expect(med((m) => (m.hubb.delar[1].id = "oversikt"))).toThrow(/hubb.delar\[1\].id "oversikt" står två gånger/);
    expect(med((m) => (m.hubb.delar[1].rutt = "/ekonomi/oversikt"))).toThrow(/hubb.delar\[1\].rutt "\/ekonomi\/oversikt" står två gånger/);
  });

  it("⛔ en dels namn är { sv, en }, inte en sträng", () => {
    expect(med((m) => (m.hubb.delar[0].namn = "Översikt"))).toThrow(/hubb.delar\[0\].namn för "oversikt" är en sträng/);
  });

  it("⛔ okända fält på en del avvisas", () => {
    expect(med((m) => (m.hubb.delar[0].vy = () => null))).toThrow(/hubb.delar\[0\] bär fälten vy som inte känns igen/);
  });

  it("⛔ en dels id har id-formen", () => {
    expect(med((m) => (m.hubb.delar[0].id = "Översikt"))).toThrow(/hubb.delar\[0\].id "Översikt" måste vara ett id/);
  });

  it("⛔ startsidan är en av delarna", () => {
    expect(med((m) => (m.hubb.startsida = "hem"))).toThrow(/hubb.startsida "hem" måste vara en av delarna \(oversikt, inkomster/);
    expect(med((m) => delete m.hubb.startsida)).toThrow(/hubb.startsida undefined måste vara en av delarna/);
  });
});

describe("validateModuler: det som bara syns mellan två kort", () => {
  it("⛔ två moduler på samma adress i hubben avvisas", () => {
    const b = RESOR();
    b.hubb.rutt = "/ekonomi";
    b.hubb.delar[0].rutt = "/ekonomi/kommande";
    expect(() => validateModuler([EKONOMI(), b])).toThrow(/modulerna "ekonomi" och "resor" gör båda anspråk på adressen "\/ekonomi"/);
  });

  it("⛔ en del som krockar med en annan moduls del avvisas", () => {
    const b = RESOR();
    b.hubb.rutt = "/ekonomi-resor";
    b.hubb.delar[0].rutt = "/ekonomi-resor/kommande";
    const a = EKONOMI();
    a.hubb.delar[0].rutt = "/ekonomi/oversikt";
    expect(() => validateModuler([a, b])).not.toThrow();
  });

  it("⛔ en modul inuti en annan avvisas", () => {
    const b = RESOR();
    b.hubb.rutt = "/ekonomi/resor";
    b.hubb.delar[0].rutt = "/ekonomi/resor/kommande";
    expect(() => validateModuler([EKONOMI(), b])).toThrow(/modulen "resor" \(\/ekonomi\/resor\) ligger inuti modulen "ekonomi"/);
  });
});

describe("hubbForGrupp: gruppens moduler och inget annat", () => {
  it("ritar gruppens moduler i gruppens ordning, inte registrets", () => {
    const { kort, saknade } = hubbForGrupp({ grupp: { id: "g", moduler: ["resor", "ekonomi"] }, moduler: moduler() });
    expect(kort.map((m) => m.id)).toEqual(["resor", "ekonomi"]);
    expect(saknade).toEqual([]);
  });

  it("⛔ en modul appen inte registrerat ritas inte, och det sägs varför", () => {
    const { kort, saknade } = hubbForGrupp({ grupp: { id: "g", moduler: ["ekonomi", "bokning"] }, moduler: moduler() });
    expect(kort.map((m) => m.id)).toEqual(["ekonomi"]);
    expect(saknade).toEqual([{ id: "bokning", skal: "inte-registrerad" }]);
  });

  it("⛔ en modul utan kort ritas inte, och det sägs varför", () => {
    const { kort, saknade } = hubbForGrupp({ grupp: { id: "g", moduler: ["inkorg"] }, moduler: moduler() });
    expect(kort).toEqual([]);
    expect(saknade).toEqual([{ id: "inkorg", skal: "inget-kort" }]);
  });

  it("en grupp utan moduler ger inga kort och inga saknade", () => {
    expect(hubbForGrupp({ grupp: { id: "g", moduler: [] }, moduler: moduler() })).toEqual({ kort: [], saknade: [] });
  });

  it("⛔ utan grupp finns ingen hubb", () => {
    expect(() => hubbForGrupp({ grupp: /** @type {any} */ (null), moduler: moduler() })).toThrow(/hubbForGrupp: grupp krävs/);
    expect(() => hubbForGrupp({ grupp: { id: "g", moduler: [] }, moduler: /** @type {any} */ (undefined) })).toThrow(/hubbForGrupp: moduler krävs/);
  });

  /*
   * ⛔ ÄNDRAT I 0.60.0 (#251, beslut 0003). Provet hette "valbara är de registrerade med ett kort" och väntade sig ["ekonomi", "resor"].
   * CP 2026-10-05: inställningarna ska visa alla appar, också de utan egen yta. Inkorg här har `hubb: null` och står nu med.
   */
  it("valbara är alla registrerade, också de utan kort", () => {
    expect(valbaraModuler(moduler()).map((m) => m.id)).toEqual(["ekonomi", "resor", "inkorg"]);
  });

  it("⛔ hubbens meny listar bara moduler: inga barn", () => {
    const poster = hubbPoster(hubbForGrupp({ grupp: { id: "g", moduler: ["ekonomi"] }, moduler: moduler() }).kort, { info: { ekonomi: null }, badge: { ekonomi: 2 } });
    expect(poster).toHaveLength(1);
    expect(poster[0]).toMatchObject({ href: "/ekonomi", label: "Ekonomi", info: null, badge: 2 });
    expect(poster[0]).not.toHaveProperty("children");
    expect(hubbPoster(hubbForGrupp({ grupp: { id: "g", moduler: ["ekonomi"] }, moduler: moduler() }).kort, { sprak: "en" })[0]).not.toHaveProperty("info");
    expect(hubbPoster(hubbForGrupp({ grupp: { id: "g", moduler: ["ekonomi"] }, moduler: moduler() }).kort, { sprak: "en" })[0].label).toBe("Finance");
  });
});

describe("modulLage: vilken modul och vilken del en adress hör till", () => {
  it("modulens egen adress är startsidan", () => {
    const l = modulLage(moduler(), "/ekonomi");
    expect(l?.modul.id).toBe("ekonomi");
    expect(l?.del?.id).toBe("oversikt");
  });

  it("en dels adress, med och utan frågetecken och avslutande snedstreck", () => {
    expect(modulLage(moduler(), "/ekonomi/kostnader")?.del?.id).toBe("kostnader");
    expect(modulLage(moduler(), "/ekonomi/kostnader?ar=2026#x")?.del?.id).toBe("kostnader");
    expect(modulLage(moduler(), "/ekonomi/kostnader/")?.del?.id).toBe("kostnader");
  });

  it("⛔ en undersida till en del markerar delen", () => {
    expect(modulLage(moduler(), "/ekonomi/kontakter/anna")?.del?.id).toBe("kontakter");
  });

  it("en sida i modulen utanför navigationen har ingen del", () => {
    const l = modulLage(moduler(), "/ekonomi/annat");
    expect(l?.modul.id).toBe("ekonomi");
    expect(l?.del).toBeNull();
  });

  it("⛔ en adress som bara börjar likadant hör inte till modulen", () => {
    expect(modulLage(moduler(), "/ekonomisk")).toBeNull();
    expect(modulLage(moduler(), "/kalender")).toBeNull();
  });
});

describe("gamla adresser: omdirigeringarna", () => {
  const LISTA = () => [
    ...DELAR.map(([id, , gammal]) => ({ fran: gammal, till: { modul: "ekonomi", del: id } })),
    { fran: "/hub/ekonomi", till: { modul: "ekonomi", del: null } },
  ];

  it("⛔ VARJE SIDA HUBBEN LEDDE TILL FÖRE FLYTTEN LEDER TILL EN DEL, mätt över bolag-ops lista", () => {
    const m = moduler();
    const rader = kontrolleraOmdirigeringar({ gamla: GAMLA, omdirigeringar: byggOmdirigeringar(LISTA(), m), moduler: m });
    expect(rader).toHaveLength(GAMLA.length);
    expect(rader.find((r) => r.fran === "/process")).toEqual({ fran: "/process", till: "/ekonomi/cutover", modul: "ekonomi", del: "cutover" });
    expect(rader.find((r) => r.fran === "/hub/ekonomi")).toEqual({ fran: "/hub/ekonomi", till: "/ekonomi", modul: "ekonomi", del: "oversikt" });
    expect(rader.find((r) => r.fran === "/ekonomi")?.del).toBe("oversikt");
    // Golv: listan är inte tom, och varje del nås av minst en gammal adress.
    expect(new Set(rader.map((r) => r.del)).size).toBe(DELAR.length);
  });

  it("⛔ en glömd adress blir röd och nämns", () => {
    const m = moduler();
    const utan = LISTA().filter((r) => r.fran !== "/process");
    expect(() => kontrolleraOmdirigeringar({ gamla: GAMLA, omdirigeringar: byggOmdirigeringar(utan, m), moduler: m })).toThrow(/1 av 16 gamla adresser leder ingenstans:\n {2}\/process: ingen omdirigering/);
  });

  it("⛔ ett prov över en tom lista är inget prov", () => {
    const m = moduler();
    expect(() => kontrolleraOmdirigeringar({ gamla: [], omdirigeringar: byggOmdirigeringar(LISTA(), m), moduler: m })).toThrow(/gamla krävs och måste ha minst en adress/);
  });

  it("⛔ en omdirigering till modulen men inte till en del räknas inte", () => {
    const m = moduler();
    const o = [{ fran: "/x", till: "/ekonomi/finns-inte", modul: "ekonomi", del: null }];
    expect(() => kontrolleraOmdirigeringar({ gamla: ["/x"], omdirigeringar: o, moduler: m })).toThrow(/\/x -> \/ekonomi\/finns-inte: målet är ingen del i en modul/);
  });

  it("målet härleds ur manifestet, och ? # och undersidor följer med", () => {
    const o = byggOmdirigeringar(LISTA(), moduler());
    expect(omdirigera("/inkomster", o)).toBe("/ekonomi/inkomster");
    expect(omdirigera("/kostnader?ar=2026#rad", o)).toBe("/ekonomi/kostnader?ar=2026#rad");
    expect(omdirigera("/kontakter/anna", o)).toBe("/ekonomi/kontakter/anna");
    expect(omdirigera("/kontakter/", o)).toBe("/ekonomi/kontakter");
    expect(omdirigera("/kontakterna", o)).toBeNull();
    expect(omdirigera("/kalender", o)).toBeNull();
    expect(omdirigera("/ekonomi/inkomster", o)).toBeNull();
  });

  it("⛔ ett id som inte finns kastar vid uppstart", () => {
    const m = moduler();
    expect(() => byggOmdirigeringar([{ fran: "/x", till: { modul: "resa", del: null } }], m)).toThrow(/pekar på modulen "resa", som inte är registrerad/);
    expect(() => byggOmdirigeringar([{ fran: "/x", till: { modul: "ekonomi", del: "moms" } }], m)).toThrow(/pekar på delen "moms", som inte finns i "ekonomi"/);
    expect(() => byggOmdirigeringar([{ fran: "/x", till: { modul: "inkorg", del: null } }], m)).toThrow(/har hubb: null/);
  });

  it("⛔ del: null skrivs ut, en utelämnad del kastar", () => {
    expect(() => byggOmdirigeringar([/** @type {any} */ ({ fran: "/x", till: { modul: "ekonomi" } })], moduler())).toThrow(/saknar till.del/);
  });

  it("⛔ en gammal adress som lever, eller ligger ovanför en modul, avvisas", () => {
    const m = moduler();
    expect(() => byggOmdirigeringar([{ fran: "/ekonomi/inkomster", till: { modul: "ekonomi", del: "kostnader" } }], m)).toThrow(/är en adress i en modul/);
    expect(() => byggOmdirigeringar([{ fran: "/ekonomi", till: { modul: "resor", del: null } }], m)).toThrow(/är en adress i en modul/);
    const r = RESOR();
    r.hubb.rutt = "/hub/resor";
    r.hubb.delar[0].rutt = "/hub/resor/kommande";
    expect(() => byggOmdirigeringar([{ fran: "/hub", till: { modul: "ekonomi", del: null } }], validateModuler([EKONOMI(), r]))).toThrow(/ligger ovanför modulen "resor"/);
  });

  it("⛔ två rader från samma adress, eller en adress som inte är en adress, avvisas", () => {
    const m = moduler();
    expect(() => byggOmdirigeringar([{ fran: "/x", till: { modul: "ekonomi", del: null } }, { fran: "/x", till: { modul: "resor", del: null } }], m)).toThrow(/står två gånger/);
    expect(() => byggOmdirigeringar([{ fran: "/", till: { modul: "ekonomi", del: null } }], m)).toThrow(/har ingen giltig fran/);
    expect(() => byggOmdirigeringar([{ fran: "x", till: { modul: "ekonomi", del: null } }], m)).toThrow(/har ingen giltig fran/);
    expect(() => byggOmdirigeringar([/** @type {any} */ ({ fran: "/x", till: "/ekonomi" })], m)).toThrow(/saknar till: \{ modul, del \}/);
    expect(() => byggOmdirigeringar([/** @type {any} */ ({ fran: "/x", till: { modul: "ekonomi", del: null }, typ: 301 })], m)).toThrow(/bär fälten typ/);
    expect(() => byggOmdirigeringar(/** @type {any} */ ("x"), m)).toThrow(/listan måste vara en lista/);
  });
});

describe("OpsGruppHubb: ritad", () => {
  const G = (/** @type {string[]} */ ids) => ({ id: "bolaget", namn: { sv: "Claes Philip Staiger AB" }, moduler: ids });

  it("en grupp med Ekonomi har ETT kort, och det leder till modulen", () => {
    const nav = vi.fn((_h, e) => e.preventDefault());
    render(<OpsGruppHubb grupp={G(["ekonomi"])} moduler={moduler()} onNavigate={nav} info={{ ekonomi: "Skatten förfaller 12 oktober" }} />);
    const lista = screen.getByRole("list", { name: "Appar i Claes Philip Staiger AB" });
    const kort = within(lista).getAllByRole("link");
    expect(kort).toHaveLength(1);
    expect(kort[0].getAttribute("href")).toBe("/ekonomi");
    expect(kort[0].textContent).toContain("Skatten förfaller 12 oktober");
    // ⛔ Delarna står INTE i hubben.
    expect(screen.queryByText("Inkomster")).toBeNull();
    fireEvent.click(kort[0]);
    expect(nav).toHaveBeenCalledWith("/ekonomi", expect.anything());
  });

  it("⛔ en grupp utan moduler säger det, med sitt namn", () => {
    render(<OpsGruppHubb grupp={G([])} moduler={moduler()} />);
    expect(screen.getByText("Inga appar i gruppen")).toBeTruthy();
    expect(screen.getByText(/Claes Philip Staiger AB har inga appar installerade/)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("⛔ en modul som inte ritas får en rad som säger varför", () => {
    const { container } = render(<OpsGruppHubb grupp={G(["ekonomi", "bokning", "inkorg"])} moduler={moduler()} />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(container.querySelector('[data-saknad="inte-registrerad"]')?.textContent).toContain('Appen "bokning" visas inte: den finns inte här');
    expect(container.querySelector('[data-saknad="inget-kort"]')?.textContent).toContain('Appen "inkorg" visas inte: den har inget kort');
  });

  it("⛔ pekar gruppen bara på moduler som inte ritas står det, inte 'inga moduler'", () => {
    render(<OpsGruppHubb grupp={G(["bokning"])} moduler={moduler()} />);
    expect(screen.queryByText("Inga appar i gruppen")).toBeNull();
    expect(screen.getByText("Ingen av gruppens appar kan visas")).toBeTruthy();
  });
});

describe("OpsModulSida: modulens egen navigation", () => {
  it("en länk per del i manifestets ordning, och startsidan är öppen på modulens adress", () => {
    render(
      <OpsModulSida modul={moduler()[0]} activeHref="/ekonomi" hubHref="/hub">
        <p>översikten</p>
      </OpsModulSida>,
    );
    const nav = screen.getByRole("navigation", { name: "Ekonomi: delar" });
    const lankar = within(nav).getAllByRole("link");
    expect(lankar.map((a) => a.textContent)).toEqual(DELAR.map(([, sv]) => sv));
    expect(lankar.map((a) => a.getAttribute("href"))).toEqual(DELAR.map(([id]) => `/ekonomi/${id}`));
    expect(lankar.filter((a) => a.getAttribute("aria-current") === "page").map((a) => a.textContent)).toEqual(["Översikt"]);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Ekonomi");
    expect(screen.getByRole("link", { name: "Tillbaka till Appar" }).getAttribute("href")).toBe("/hub");
    expect(screen.getByText("översikten")).toBeTruthy();
  });

  it("⛔ en undersida markerar sin del, och ett klick går till delen", () => {
    const nav = vi.fn((_h, e) => e.preventDefault());
    render(
      <OpsModulSida modul={moduler()[0]} activeHref="/ekonomi/kontakter/anna" hubHref="/hub" onNavigate={nav}>
        <p>Anna</p>
      </OpsModulSida>,
    );
    const aktiv = screen.getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page");
    expect(aktiv.map((a) => a.textContent)).toEqual(["Kontakter"]);
    fireEvent.click(screen.getByRole("link", { name: "Länkar" }));
    expect(nav).toHaveBeenCalledWith("/ekonomi/lankar", expect.anything());
  });

  it("⛔ en modul utan kort har ingen insida", () => {
    expect(() => render(<OpsModulSida modul={moduler()[2]} activeHref="/inkorg" hubHref="/hub"><p /></OpsModulSida>)).toThrow(/modulen "inkorg" har inget kort i hubben/);
  });
});

describe("OpsGruppFormular: ägaren väljer moduler", () => {
  const GRUPP = { id: "bolaget", namn: { sv: "Bolaget" }, moduler: ["gammal"] };

  it("⛔ ägaren ser valet, och det sparas i valordningen med ett okänt id kvar", async () => {
    const onSpara = vi.fn(async () => {});
    const { container } = render(<OpsGruppFormular formId="f" grupp={GRUPP} onSpara={onSpara} moduler={{ valbara: valbaraModuler(moduler()), agare: true }} />);
    const sektion = screen.getByRole("region", { name: "Appar" });
    const knappar = within(sektion).getAllByRole("button");
    // ⛔ 0.60.0 (#251): namnet ur `aria-label`, eftersom raden "Syns på" nu står i knappen. Inkorg (utan kort) står med.
    expect(knappar.map((b) => b.getAttribute("aria-label"))).toEqual(["Ekonomi", "Resor", "Inkorg"]);
    expect(knappar.every((b) => b.getAttribute("aria-pressed") === "false")).toBe(true);
    expect(container.querySelector('[data-modul-okand="gammal"]')?.textContent).toContain("gammal är installerad i gruppen men finns inte här");
    fireEvent.click(knappar[1]);
    fireEvent.click(knappar[0]);
    expect(knappar[0].getAttribute("aria-pressed")).toBe("true");
    fireEvent.submit(/** @type {HTMLFormElement} */ (container.querySelector("form")));
    await vi.waitFor(() => expect(onSpara).toHaveBeenCalled());
    expect(/** @type {any} */ (onSpara.mock.calls[0])[0].grupp.moduler).toEqual(["gammal", "resor", "ekonomi"]);
  });

  it("⛔ ett andra tryck väljer bort modulen", async () => {
    const onSpara = vi.fn(async () => {});
    const { container } = render(<OpsGruppFormular grupp={{ ...GRUPP, moduler: ["ekonomi"] }} onSpara={onSpara} moduler={{ valbara: valbaraModuler(moduler()), agare: true }} />);
    fireEvent.click(screen.getByRole("button", { name: "Ekonomi" }));
    fireEvent.submit(/** @type {HTMLFormElement} */ (container.querySelector("form")));
    await vi.waitFor(() => expect(onSpara).toHaveBeenCalled());
    expect(/** @type {any} */ (onSpara.mock.calls[0])[0].grupp.moduler).toEqual([]);
  });

  it("⛔ en admin ser inget modulval och skickar aldrig fältet", async () => {
    const onSpara = vi.fn(async () => {});
    const { container } = render(<OpsGruppFormular grupp={GRUPP} onSpara={onSpara} moduler={{ valbara: valbaraModuler(moduler()), agare: false }} />);
    expect(screen.queryByRole("region", { name: "Appar" })).toBeNull();
    fireEvent.submit(/** @type {HTMLFormElement} */ (container.querySelector("form")));
    await vi.waitFor(() => expect(onSpara).toHaveBeenCalled());
    expect(/** @type {any} */ (onSpara.mock.calls[0])[0].grupp).not.toHaveProperty("moduler");
  });

  it("⛔ när en ny grupp skapas finns inget modulval", () => {
    render(<OpsGruppFormular onSkapa={async () => ({ groupId: "x" })} moduler={{ valbara: valbaraModuler(moduler()), agare: true }} />);
    expect(screen.queryByRole("region", { name: "Appar" })).toBeNull();
  });

  it("⛔ utan registrerade moduler säger valet det", () => {
    const { container } = render(<OpsGruppFormular grupp={{ ...GRUPP, moduler: [] }} onSpara={async () => {}} moduler={{ valbara: [], agare: true }} />);
    expect(container.querySelector("[data-moduler-tomt]")?.textContent).toBe("Det finns inga appar att installera.");
  });
});
