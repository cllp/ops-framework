import { describe, it, expect, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { defineModule, validateModuler } from "../lib/modul.js";
import { byggOmdirigeringar, hubbForGrupp, hubbPoster, huvudmenyPoster, kontrolleraOmdirigeringar, modulLage, omdirigera, valbaraModuler } from "../lib/hubb.js";
import { OpsGruppHubb } from "../components/OpsHub.jsx";
import { OpsModulSida } from "../components/OpsModulSida.jsx";
import { OpsGruppFormular } from "../components/OpsGruppFormular.jsx";
import { OpsTabPanel, OpsTabs } from "../components/OpsTabs.jsx";
import { FLIKRAD } from "../lib/modulram.js";

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

  it("en grupp med Ekonomi har EN ruta, och den leder till modulen", () => {
    const nav = vi.fn((_h, e) => e.preventDefault());
    render(<OpsGruppHubb grupp={G(["ekonomi"])} moduler={moduler()} onNavigate={nav} info={{ ekonomi: "Skatten förfaller 12 oktober" }} />);
    const lista = screen.getByRole("list", { name: "Verktyg i Claes Philip Staiger AB" });
    const rutor = within(lista).getAllByRole("link");
    expect(rutor).toHaveLength(1);
    expect(rutor[0].getAttribute("href")).toBe("/ekonomi");
    // ⛔ 0.239.0: rutan har ingen infolinje. `info` tas emot (appen skickar den) men ritas inte på den här sidan.
    expect(document.body.textContent).not.toContain("Skatten förfaller 12 oktober");
    // Delarna nås inne i verktyget, inte här.
    expect(screen.queryByRole("link", { name: "Inkomster" })).toBeNull();
    fireEvent.click(rutor[0]);
    expect(nav).toHaveBeenCalledWith("/ekonomi", expect.anything());
  });

  it("⛔ en grupp utan moduler visar appar som kan läggas till, och vägen till valet bara när ägaren får den (0.87.0, lifehub.app#129)", () => {
    render(<OpsGruppHubb grupp={G([])} moduler={moduler()} />);
    expect(screen.getByText("Gruppen har inga verktyg ännu")).toBeTruthy();
    expect(screen.getByText(/Claes Philip Staiger AB har inga verktyg ännu. Ägaren väljer/)).toBeTruthy();
    const lista = screen.getByRole("list", { name: "Verktyg som kan läggas till" });
    expect(within(lista).getByText("Ekonomi")).toBeTruthy();
    expect(within(lista).getByText("Resor")).toBeTruthy();
    // Inkorg har hubb: null och blir inget kort. Den står inte i listan.
    expect(within(lista).queryByText("Inkorg")).toBeNull();
    // Utan väg till valet är rutorna inget att trycka på.
    expect(within(lista).queryAllByRole("link")).toHaveLength(0);
    // Inget att lägga till med. Sedan 0.240.0 har varje ruta en (i) som bara visar mer, och den är ingen väg att installera.
    expect(within(lista).queryAllByRole("button").filter((k) => !/^Om /.test(k.getAttribute("aria-label") ?? ""))).toHaveLength(0);
  });

  it("⛔ ägarens väg är en länk eller en knapp per app, och den byter meningen", () => {
    const gick = vi.fn();
    const { unmount } = render(<OpsGruppHubb grupp={G([])} moduler={moduler()} installera={{ href: "/installningar" }} onNavigate={gick} />);
    expect(screen.getByText(/Välj vilka som ska finnas här/)).toBeTruthy();
    const lank = screen.getByRole("link", { name: "Lägg till Ekonomi" });
    expect(lank.getAttribute("href")).toBe("/installningar");
    fireEvent.click(lank);
    expect(gick).toHaveBeenCalledWith("/installningar", expect.anything());
    unmount();
    const klick = vi.fn();
    render(<OpsGruppHubb grupp={G([])} moduler={moduler()} installera={{ onClick: klick }} />);
    fireEvent.click(screen.getByRole("button", { name: "Lägg till Resor" }));
    expect(klick).toHaveBeenCalledWith("resor");
  });

  it("⛔ en grupp som redan har appar erbjuder de som saknas, till exempel Bibliotek i Travel", () => {
    const klick = vi.fn();
    const { unmount } = render(<OpsGruppHubb grupp={G(["ekonomi"])} moduler={moduler()} installera={{ onInstallera: klick }} />);
    expect(screen.getByRole("link", { name: /^Ekonomi/ })).toBeTruthy();
    const lista = screen.getByRole("list", { name: "Verktyg som kan läggas till" });
    expect(within(lista).getByText("Resor")).toBeTruthy();
    expect(within(lista).queryByText("Ekonomi")).toBeNull();
    expect(within(lista).queryByText("Inkorg")).toBeNull();
    fireEvent.click(within(lista).getByRole("button", { name: "Lägg till Resor" }));
    expect(klick).toHaveBeenCalledTimes(1);
    expect(klick).toHaveBeenCalledWith("resor");
    unmount();
    render(<OpsGruppHubb grupp={G(["ekonomi"])} moduler={moduler()} />);
    expect(screen.getByText("Resor")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Lägg till/ })).toBeNull();
    expect(screen.getByText("Ägaren installerar dem i gruppens inställningar.")).toBeTruthy();
  });

  it("⛔ en modul som inte ritas får en rad som säger varför", () => {
    const { container } = render(<OpsGruppHubb grupp={G(["ekonomi", "bokning", "inkorg"])} moduler={moduler()} />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(container.querySelector('[data-saknad="inte-registrerad"]')?.textContent).toContain('Verktyget "bokning" visas inte: det finns inte här');
    expect(container.querySelector('[data-saknad="inget-kort"]')?.textContent).toContain('Verktyget "inkorg" visas inte: det har inget kort');
  });

  it("⛔ pekar gruppen bara på moduler som inte ritas står det, inte 'inga moduler'", () => {
    render(<OpsGruppHubb grupp={G(["bokning"])} moduler={moduler()} />);
    expect(screen.queryByText("Inga verktyg i gruppen")).toBeNull();
    expect(screen.getByText("Inget av gruppens verktyg kan visas")).toBeTruthy();
  });
});

/*
 * ⛔ 0.124.0: CP 2026-10-19, "Datumomröstning finns inte". Hubbens nivå sade att grupper kan lägga till modulen, och gruppens
 * Appar erbjöd den aldrig, eftersom erbjudandet filtrerade på `m.hubb` och en modul som bara är ett tillägg har `hubb: null`.
 * Röda mot 0.123.0: där fanns varken knappen Installera eller sektionen "Tillägg i gruppen".
 */
describe("OpsGruppHubb: en modul som bara är ett tillägg (0.124.0)", () => {
  const G = (/** @type {string[]} */ ids) => ({ id: "travel", namn: { sv: "Travel" }, moduler: ids });
  const OMROSTNING = () => ({
    id: "datumomrostning",
    namn: { sv: "Datumomröstning", en: "Date poll" },
    nav: [],
    routes: [],
    samlingar: [],
    kallor: {},
    skapar: [],
    hubb: null,
    tillagg: [{ plats: "handelse.sektion", id: "rosta", etikett: { sv: "Rösta på datum", en: "Vote on dates" }, komponent: () => null }],
  });
  const alla = () => validateModuler([EKONOMI(), INKORG(), OMROSTNING()]);

  it("⛔ erbjuds under Verktyg som kan läggas till, och rutan installerar just den", () => {
    const klick = vi.fn();
    render(<OpsGruppHubb grupp={G(["ekonomi"])} moduler={alla()} installera={{ onInstallera: klick }} />);
    const lista = screen.getByRole("list", { name: "Verktyg som kan läggas till" });
    expect(within(lista).getByText("Datumomröstning")).toBeTruthy();
    // Raden säger var den syns, med tilläggets etikett och ytans namn ur samma källa som gruppens inställningar.
    expect(within(lista).getByText("Rösta på datum · Syns på: Händelser")).toBeTruthy();
    // En modul utan kort och utan tillägg erbjuds fortfarande inte.
    expect(within(lista).queryByText("Inkorg")).toBeNull();
    fireEvent.click(within(lista).getByRole("button", { name: "Lägg till Datumomröstning" }));
    expect(klick).toHaveBeenCalledTimes(1);
    expect(klick).toHaveBeenCalledWith("datumomrostning");
  });

  it("⛔ erbjuds också i en tom grupp, och på engelska med engelska ord", () => {
    render(<OpsGruppHubb grupp={G([])} moduler={alla()} installera={{ onInstallera: () => {} }} sprak="en" />);
    const lista = screen.getByRole("list", { name: "Tools that can be added" });
    expect(within(lista).getByText("Date poll")).toBeTruthy();
    expect(within(lista).getByText("Vote on dates · Visible in: Events")).toBeTruthy();
  });

  it("⛔ installerad: syns under 'Tillägg i gruppen' med var den syns, och erbjuds inte igen", () => {
    const { container } = render(<OpsGruppHubb grupp={G(["ekonomi", "datumomrostning"])} moduler={alla()} installera={{ onInstallera: () => {} }} />);
    const sektion = screen.getByRole("region", { name: "Tillägg i gruppen" });
    expect(within(sektion).getByText("Datumomröstning")).toBeTruthy();
    expect(within(sektion).getByText("Rösta på datum · Syns på: Händelser")).toBeTruthy();
    // Ingen knapp och ingen länk: den har ingen egen sida, och den är redan på.
    expect(within(sektion).queryByRole("button")).toBeNull();
    expect(within(sektion).queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button", { name: /Lägg till Datumomröstning/ })).toBeNull();
    // Inget utvecklarord i det användaren ser, och ingen rad om att appen "inte visas".
    expect(container.textContent).not.toMatch(/hubb|null|tillagg/);
    expect(container.querySelector('[data-hubb-saknade]')).toBeNull();
  });

  it("⛔ en grupp vars enda app är ett tillägg är inte 'utan appar'", () => {
    render(<OpsGruppHubb grupp={G(["datumomrostning"])} moduler={alla()} />);
    expect(screen.queryByText("Gruppen har inga verktyg ännu")).toBeNull();
    expect(screen.queryByText("Inget av gruppens verktyg kan visas")).toBeNull();
    expect(screen.getByRole("region", { name: "Tillägg i gruppen" })).toBeTruthy();
  });

  it("⛔ en installerad modul utan kort och utan tillägg får ingen tilläggsrad, bara raden om att den inte visas", () => {
    const { container } = render(<OpsGruppHubb grupp={G(["ekonomi", "inkorg"])} moduler={alla()} />);
    expect(screen.queryByRole("region", { name: "Tillägg i gruppen" })).toBeNull();
    expect(container.querySelector('[data-saknad="inget-kort"]')).not.toBeNull();
  });
});

/*
 * ⛔ 0.239.0: CP 2026-11-18, "ja, bygg rutorna" (cllp/lifehub.app#864, skissen i #842 del C). Verktyg är rutor: en länk per
 * installerat verktyg som öppnar det, ingenting som fälls ut, räknaren kvar på rutan, och de som kan läggas till som streckade
 * rutor vars tryck installerar. Ersätter proven för chevronen (0.83.0, CP 2026-10-08), som gällde den här sidan till 0.238.2.
 * Röda mot 0.238.2 (korten med chevron): se CHANGELOG 0.239.0 för antalet.
 */
describe("OpsGruppHubb: verktyg som rutor (0.239.0)", () => {
  const G = (/** @type {string[]} */ ids) => ({ id: "bolaget", namn: { sv: "Claes Philip Staiger AB" }, moduler: ids });
  const BOKNING = () => ({ id: "bokning", namn: { sv: "Bokning", en: "Booking" }, nav: [], routes: [], samlingar: [], kallor: {}, skapar: [], hubb: { ikon: I("bok"), rutt: "/bokning", startsida: "idag", delar: [{ id: "idag", namn: { sv: "Idag" }, ikon: I("i"), rutt: "/bokning/idag" }] } });
  const fyra = () => validateModuler([EKONOMI(), RESOR(), INKORG(), BOKNING()]);

  it("varje installerat verktyg är EN länk som öppnar verktyget, i gruppens ordning, och en stängd (i) bredvid (0.240.0)", () => {
    const nav = vi.fn((_h, e) => e.preventDefault());
    render(<OpsGruppHubb grupp={G(["resor", "ekonomi"])} moduler={fyra()} onNavigate={nav} installera={{ onInstallera: () => {} }} />);
    const lista = screen.getByRole("list", { name: "Verktyg i Claes Philip Staiger AB" });
    const rader = within(lista).getAllByRole("listitem");
    expect(rader).toHaveLength(2);
    // En ruta: länken, och sedan 0.240.0 en (i) bredvid den, aldrig i den. Ingen chevron.
    for (const rad of rader) {
      expect(within(rad).getAllByRole("link")).toHaveLength(1);
      expect(within(rad).getAllByRole("button")).toHaveLength(1);
      expect(within(rad).getByRole("link").querySelector("button")).toBeNull();
    }
    const rutor = within(lista).getAllByRole("link");
    expect(rutor.map((a) => a.getAttribute("href"))).toEqual(["/resor", "/ekonomi"]);
    expect(rutor.map((a) => a.textContent)).toEqual(["Resor", "Ekonomi"]);
    // Ikonen står på rutan och är dold för skärmläsaren: namnet är rutans namn.
    expect(rutor[1].querySelector('[aria-hidden="true"] svg[data-ikon="wallet"]')).not.toBeNull();
    // (i) är stängd från början: ingen panel och inga delar på sidan förrän den trycks.
    expect([...lista.querySelectorAll("[aria-expanded]")].map((e) => e.getAttribute("aria-expanded"))).toEqual(["false", "false"]);
    expect(screen.queryByRole("button", { name: /Visa delarna/ })).toBeNull();
    fireEvent.click(rutor[1]);
    expect(nav).toHaveBeenCalledTimes(1);
    expect(nav).toHaveBeenCalledWith("/ekonomi", expect.anything());
    // Delarna står inte på sidan, varken synliga eller dolda.
    expect(document.querySelector('a[href="/ekonomi/inkomster"]')).toBeNull();
  });

  it("räknaren står kvar som ett märke på sin ruta, med skärmläsartext, och en ruta utan tal får inget märke", () => {
    render(<OpsGruppHubb grupp={G(["ekonomi", "resor"])} moduler={fyra()} badge={{ ekonomi: 3, resor: 0 }} />);
    const ekonomi = screen.getByRole("link", { name: "Ekonomi 3 nya" });
    expect(ekonomi.querySelector("[data-ops-count-badge]")?.textContent).toContain("3");
    const resor = screen.getByRole("link", { name: "Resor" });
    expect(resor.querySelector("[data-ops-count-badge]")).toBeNull();
    // På engelska är ordet engelskt, och appens eget ord vinner.
    cleanup();
    render(<OpsGruppHubb grupp={G(["ekonomi"])} moduler={fyra()} badge={{ ekonomi: 2 }} sprak="en" />);
    expect(screen.getByRole("link", { name: "Finance 2 new" })).toBeTruthy();
    cleanup();
    render(<OpsGruppHubb grupp={G(["ekonomi"])} moduler={fyra()} badge={{ ekonomi: 2 }} badgeText="väntar" />);
    expect(screen.getByRole("link", { name: "Ekonomi 2 väntar" })).toBeTruthy();
  });

  it("⛔ de som kan läggas till är streckade rutor efter de installerade, och ett tryck lägger till just det verktyget", () => {
    const klick = vi.fn();
    render(<OpsGruppHubb grupp={G(["ekonomi"])} moduler={fyra()} installera={{ onInstallera: klick }} />);
    const installerade = screen.getByRole("list", { name: "Verktyg i Claes Philip Staiger AB" });
    const valbara = screen.getByRole("list", { name: "Verktyg som kan läggas till" });
    // Ordningen: de installerade först, sedan rubriken och de som kan läggas till.
    expect(installerade.compareDocumentPosition(valbara) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Verktyg som kan läggas till" }).compareDocumentPosition(valbara) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const knappar = within(valbara).getAllByRole("button", { name: /^Lägg till / });
    expect(knappar.map((k) => k.getAttribute("aria-label"))).toEqual(["Lägg till Resor", "Lägg till Bokning"]);
    // Sedan 0.240.0 har varje streckad ruta också en (i), stängd från början.
    expect(within(valbara).getAllByRole("button", { name: /^Om / }).map((k) => k.getAttribute("aria-expanded"))).toEqual(["false", "false"]);
    // Streckad och nedtonad: plattan bär en streckad kant, namnet den dämpade textfärgen.
    for (const k of knappar) {
      expect(k.querySelector(".border-dashed")).not.toBeNull();
      expect(k.querySelector(".text-ink-secondary")).not.toBeNull();
    }
    fireEvent.click(within(valbara).getByRole("button", { name: "Lägg till Bokning" }));
    expect(klick).toHaveBeenCalledTimes(1);
    expect(klick).toHaveBeenCalledWith("bokning");
    // Ingen separat knapp "Installera" per rad finns kvar.
    expect(screen.queryByRole("button", { name: /^Installera/ })).toBeNull();
    expect(within(valbara).queryAllByRole("link")).toHaveLength(0);
  });

  it("på engelska heter rutan Add och verktygets engelska namn, och appens etikett byter första ordet", () => {
    const { unmount } = render(<OpsGruppHubb grupp={G(["ekonomi"])} moduler={fyra()} installera={{ onInstallera: () => {} }} sprak="en" />);
    expect(screen.getByRole("button", { name: "Add Booking" })).toBeTruthy();
    unmount();
    render(<OpsGruppHubb grupp={G(["ekonomi"])} moduler={fyra()} installera={{ onInstallera: () => {}, etikett: "Installera" }} />);
    expect(screen.getByRole("button", { name: "Installera Bokning" })).toBeTruthy();
  });

  it("⛔ en ruta som väntar på appens löfte visar det och tar inte emot ett andra tryck", async () => {
    /** @type {(v?: unknown) => void} */
    let los = () => {};
    const lagg = vi.fn(() => new Promise((r) => (los = r)));
    render(<OpsGruppHubb grupp={G(["ekonomi"])} moduler={fyra()} installera={{ onInstallera: lagg }} />);
    const ruta = () => screen.getByRole("button", { name: "Lägg till Resor" });
    expect(ruta()).not.toHaveAttribute("aria-busy");
    fireEvent.click(ruta());
    await waitFor(() => expect(ruta()).toHaveAttribute("aria-busy", "true"));
    expect(ruta()).toBeDisabled();
    fireEvent.click(ruta());
    expect(lagg).toHaveBeenCalledTimes(1);
    await act(async () => los());
    await waitFor(() => expect(ruta()).not.toHaveAttribute("aria-busy"));
  });
});

describe("hubbPoster med delar, och huvudmenyPoster (0.83.0)", () => {
  it("delar ger children till en modul med fler än en del, och inga till en med en", () => {
    const kort = hubbForGrupp({ grupp: { id: "g", moduler: ["ekonomi", "resor"] }, moduler: moduler() }).kort;
    const [ekonomi, resor] = hubbPoster(kort, { delar: true });
    expect(ekonomi.children?.map((c) => c.href).slice(0, 2)).toEqual(["/ekonomi/oversikt", "/ekonomi/inkomster"]);
    expect(resor).not.toHaveProperty("children");
    expect(hubbPoster(kort)[0]).not.toHaveProperty("children");
  });

  it("huvudmenyn är gruppens moduler i gruppens ordning, filtrerade på valet, och tom utan fältet", () => {
    const m = moduler();
    expect(huvudmenyPoster({ grupp: { moduler: ["resor", "ekonomi"], huvudmeny: ["ekonomi", "resor"] }, moduler: m }).map((p) => p.href)).toEqual(["/resor", "/ekonomi"]);
    expect(huvudmenyPoster({ grupp: { moduler: ["resor", "ekonomi"], huvudmeny: ["ekonomi"] }, moduler: m })).toEqual([
      { id: "ekonomi", href: "/ekonomi", label: "Ekonomi", icon: expect.anything() },
    ]);
    expect(huvudmenyPoster({ grupp: { moduler: ["ekonomi"] }, moduler: m })).toEqual([]);
    expect(huvudmenyPoster({ grupp: null, moduler: m })).toEqual([]);
    expect(huvudmenyPoster({ grupp: { moduler: ["ekonomi"], huvudmeny: ["ekonomi"] }, moduler: m, sprak: "en" })[0].label).toBe("Finance");
  });

  it("⛔ en modul i huvudmenyn som inte är en av gruppens, eller saknar kort, ritas inte", () => {
    const m = moduler();
    expect(huvudmenyPoster({ grupp: { moduler: ["ekonomi"], huvudmeny: ["resor"] }, moduler: m })).toEqual([]);
    expect(huvudmenyPoster({ grupp: { moduler: ["inkorg", "ekonomi"], huvudmeny: ["inkorg", "ekonomi"] }, moduler: m }).map((p) => p.id)).toEqual(["ekonomi"]);
  });

  it("räknaren följer med ikonen, och en modul utan tal får inget märke", () => {
    const m = moduler();
    const rader = huvudmenyPoster({
      grupp: { moduler: ["resor", "ekonomi"], huvudmeny: ["resor", "ekonomi"] },
      moduler: m,
      badge: { ekonomi: 4 },
      badgeFler: { ekonomi: true },
    });
    expect(rader.find((r) => r.id === "ekonomi")).toMatchObject({ badge: 4, badgeFler: true });
    expect(rader.find((r) => r.id === "resor")).not.toHaveProperty("badge");
  });
});

describe("⛔ samma rad i modulen och i biblioteket (0.83.0)", () => {
  it("den öppna delen i OpsModulSida och den valda fliken i OpsTabs medOrd bär samma klasser, och de övriga likaså", () => {
    const { container } = render(
      <>
        <OpsModulSida modul={moduler()[0]} activeHref="/ekonomi" hubHref="/hub">
          <p>översikten</p>
        </OpsModulSida>
        <OpsTabs medOrd ariaLabel="Typ" value="a" onChange={() => {}} tabs={[{ id: "a", label: "A", icon: I("a") }, { id: "b", label: "B", icon: I("b") }]}>
          <OpsTabPanel id="a">x</OpsTabPanel>
        </OpsTabs>
      </>,
    );
    const oppenDel = /** @type {HTMLElement} */ (container.querySelector('[data-modulnav] a[aria-current="page"]'));
    const stangdDel = /** @type {HTMLElement} */ (container.querySelector('[data-modulnav] a:not([aria-current])'));
    const vald = screen.getByRole("tab", { name: "A" });
    const ovald = screen.getByRole("tab", { name: "B" });
    expect(oppenDel.className.length).toBeGreaterThan(40);
    expect(vald.className.startsWith(oppenDel.className)).toBe(true);
    expect(ovald.className.startsWith(stangdDel.className)).toBe(true);
    expect(/** @type {HTMLElement} */ (oppenDel.querySelector("span[aria-hidden]")).className).toBe(/** @type {HTMLElement} */ (vald.querySelector("span[aria-hidden]")).className);
    // ⛔ Behållaren är samma sträng. En skillnad här är två sanningar om samma rad.
    // 0.88.0: `flex-nowrap` och `overflow-x-auto`, plus `min-w-0` på omslaget. Utan omslaget växer flexbarnet
    // och sidan rullar i stället för raden (det 0.87.0 mätte och sedan bröt raden för).
    expect(screen.getByRole("tablist").className).toBe(FLIKRAD);
    expect(container.querySelector("[data-modulnav] ul")?.className).toBe(FLIKRAD);
    // ⛔ 0.88.0: en rad som rullar. `flex-nowrap` innehåller teckenföljden `flex-wrap`, så jämförelsen är på klasslistan.
    const klasser = FLIKRAD.split(/\s+/);
    expect(klasser).toContain("flex-nowrap");
    expect(klasser).toContain("overflow-x-auto");
    expect(klasser).not.toContain("flex-wrap");
    expect(screen.getByRole("tablist").parentElement?.className ?? "").toContain("min-w-0");
    expect(container.querySelector("[data-modulnav]")?.className ?? "").toContain("min-w-0");
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
    expect(screen.getByRole("link", { name: "Tillbaka till Verktyg" }).getAttribute("href")).toBe("/hub");
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
    const { container } = render(<OpsGruppFormular formId="f" grupp={GRUPP} onSpara={onSpara} moduler={{ valbara: valbaraModuler(moduler()), farAndra: true }} />);
    const sektion = screen.getByRole("region", { name: "Verktyg" });
    const knappar = within(sektion).getAllByRole("button");
    // ⛔ 0.60.0 (#251): namnet ur `aria-label`, eftersom raden "Syns på" nu står i knappen. Inkorg (utan kort) står med.
    expect(knappar.map((b) => b.getAttribute("aria-label"))).toEqual(["Ekonomi", "Resor", "Inkorg"]);
    expect(knappar.every((b) => b.getAttribute("aria-pressed") === "false")).toBe(true);
    expect(container.querySelector('[data-modul-okand="gammal"]')?.textContent).toContain("gammal är installerat i gruppen men finns inte här");
    fireEvent.click(knappar[1]);
    fireEvent.click(knappar[0]);
    expect(knappar[0].getAttribute("aria-pressed")).toBe("true");
    fireEvent.submit(/** @type {HTMLFormElement} */ (container.querySelector("form")));
    await vi.waitFor(() => expect(onSpara).toHaveBeenCalled());
    expect(/** @type {any} */ (onSpara.mock.calls[0])[0].grupp.moduler).toEqual(["gammal", "resor", "ekonomi"]);
  });

  it("⛔ ett andra tryck väljer bort modulen", async () => {
    const onSpara = vi.fn(async () => {});
    const { container } = render(<OpsGruppFormular grupp={{ ...GRUPP, moduler: ["ekonomi"] }} onSpara={onSpara} moduler={{ valbara: valbaraModuler(moduler()), farAndra: true }} />);
    fireEvent.click(screen.getByRole("button", { name: "Ekonomi" }));
    fireEvent.submit(/** @type {HTMLFormElement} */ (container.querySelector("form")));
    await vi.waitFor(() => expect(onSpara).toHaveBeenCalled());
    expect(/** @type {any} */ (onSpara.mock.calls[0])[0].grupp.moduler).toEqual([]);
  });

  it("⛔ en admin ser inget modulval och skickar aldrig fältet", async () => {
    const onSpara = vi.fn(async () => {});
    const { container } = render(<OpsGruppFormular grupp={GRUPP} onSpara={onSpara} moduler={{ valbara: valbaraModuler(moduler()), farAndra: false }} />);
    expect(screen.queryByRole("region", { name: "Verktyg" })).toBeNull();
    fireEvent.submit(/** @type {HTMLFormElement} */ (container.querySelector("form")));
    await vi.waitFor(() => expect(onSpara).toHaveBeenCalled());
    expect(/** @type {any} */ (onSpara.mock.calls[0])[0].grupp).not.toHaveProperty("moduler");
  });

  it("⛔ när en ny grupp skapas finns inget modulval", () => {
    render(<OpsGruppFormular onSkapa={async () => ({ groupId: "x" })} moduler={{ valbara: valbaraModuler(moduler()), farAndra: true }} />);
    expect(screen.queryByRole("region", { name: "Verktyg" })).toBeNull();
  });

  /*
   * ⛔ 0.89.0: CP 2026-10-09. Pinnen ritas inte i gruppvyn. En installerad app med kort får en länk
   * när appen ger en adress. Att välja en app sätter inte huvudmenyn.
   */
  it("gruppvyn har ingen pinne, och en installerad app med kort kan länka till inställningarna", async () => {
    const onSpara = vi.fn(async () => {});
    const onNavigate = vi.fn((_h, e) => e.preventDefault());
    const { container } = render(
      <OpsGruppFormular
        grupp={{ ...GRUPP, moduler: [] }}
        onSpara={onSpara}
        moduler={{
          valbara: valbaraModuler(moduler()),
          farAndra: true,
          installningarHref: (m) => (m.hubb ? `${m.hubb.rutt}?lage=installningar` : ""),
          onNavigate,
        }}
      />,
    );
    expect(screen.queryByRole("switch", { name: "Visa i huvudmenyn" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Inställningar" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ekonomi" }));
    fireEvent.click(screen.getByRole("button", { name: "Inkorg" }));
    const lank = screen.getByRole("link", { name: "Inställningar" });
    expect(lank.getAttribute("href")).toBe("/ekonomi?lage=installningar");
    expect(container.querySelector('[data-modul-installningar="ekonomi"]')).not.toBeNull();
    expect(container.querySelector('[data-modul-installningar="inkorg"]')).toBeNull();
    fireEvent.click(lank);
    expect(onNavigate).toHaveBeenCalledWith("/ekonomi?lage=installningar", expect.anything());
    fireEvent.submit(/** @type {HTMLFormElement} */ (container.querySelector("form")));
    await vi.waitFor(() => expect(onSpara).toHaveBeenCalled());
    expect(/** @type {any} */ (onSpara.mock.calls[0])[0].grupp).toMatchObject({ moduler: ["ekonomi", "inkorg"], huvudmeny: [] });
  });

  it("⛔ en app som väljs bort tas ur huvudmenyn i samma sparning", async () => {
    const onSpara = vi.fn(async () => {});
    const { container } = render(<OpsGruppFormular grupp={{ ...GRUPP, moduler: ["ekonomi", "resor"], huvudmeny: ["ekonomi", "resor"] }} onSpara={onSpara} moduler={{ valbara: valbaraModuler(moduler()), farAndra: true }} />);
    expect(screen.queryByRole("switch", { name: "Visa i huvudmenyn" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ekonomi" }));
    fireEvent.submit(/** @type {HTMLFormElement} */ (container.querySelector("form")));
    await vi.waitFor(() => expect(onSpara).toHaveBeenCalled());
    expect(/** @type {any} */ (onSpara.mock.calls[0])[0].grupp).toMatchObject({ moduler: ["resor"], huvudmeny: ["resor"] });
  });

  it("⛔ en admin skickar aldrig huvudmenyn", async () => {
    const onSpara = vi.fn(async () => {});
    const { container } = render(<OpsGruppFormular grupp={{ ...GRUPP, huvudmeny: ["ekonomi"] }} onSpara={onSpara} moduler={{ valbara: valbaraModuler(moduler()), farAndra: false }} />);
    expect(screen.queryByRole("switch", { name: "Visa i huvudmenyn" })).toBeNull();
    fireEvent.submit(/** @type {HTMLFormElement} */ (container.querySelector("form")));
    await vi.waitFor(() => expect(onSpara).toHaveBeenCalled());
    expect(/** @type {any} */ (onSpara.mock.calls[0])[0].grupp).not.toHaveProperty("huvudmeny");
  });

  it("⛔ utan registrerade moduler säger valet det", () => {
    const { container } = render(<OpsGruppFormular grupp={{ ...GRUPP, moduler: [] }} onSpara={async () => {}} moduler={{ valbara: [], farAndra: true }} />);
    expect(container.querySelector("[data-moduler-tomt]")?.textContent).toBe("Det finns inga verktyg att installera.");
  });
});

describe("⛔ hubbPoster: ett modul-id som heter som något på Object.prototype (#283)", () => {
  // `m.id in info` nådde prototypkedjan, så en modul med id `constructor` fick Object-konstruktorn som infolinje.
  for (const id of ["constructor", "toString", "__proto__"]) {
    it(`modulen "${id}" utan infolinje får ingen info`, () => {
      const kort = /** @type {any} */ ([{ id, namn: { sv: "Modul" }, hubb: { rutt: "/m", ikon: null } }]);
      expect(hubbPoster(kort, { info: {} })[0]).not.toHaveProperty("info");
      expect(hubbPoster(kort, { info: { [id]: "Två nya" } })[0]).toHaveProperty("info", "Två nya");
    });
  }
});

describe("⛔ Appar har vyns tunna huvud med åtgärden (0.103.0, CP 2026-10-14)", () => {
  const G = (/** @type {string[]} */ ids) => ({ id: "bolaget", namn: { sv: "Claes Philip Staiger AB" }, moduler: ids });
  it("rubriken Appar står i huvudet, och appens åtgärd står på samma rad och gör det den ska", async () => {
    const { OpsVyAtgard } = await import("../components/OpsTillbaka.jsx");
    const skapa = vi.fn();
    render(<OpsGruppHubb grupp={G(["ekonomi"])} moduler={moduler()} atgard={<OpsVyAtgard onClick={skapa}>Skapa app</OpsVyAtgard>} />);
    const rubrik = screen.getByRole("heading", { name: "Verktyg" });
    const huvud = rubrik.closest("[data-vyhuvud]");
    expect(huvud).toBeTruthy();
    const knapp = within(/** @type {HTMLElement} */ (huvud)).getByRole("button", { name: "Skapa app" });
    fireEvent.click(knapp);
    expect(skapa).toHaveBeenCalledTimes(1);
  });

  it("utan åtgärd står bara rubriken, och en åtgärd utan onClick kastar", async () => {
    const { OpsVyAtgard } = await import("../components/OpsTillbaka.jsx");
    render(<OpsGruppHubb grupp={G(["ekonomi"])} moduler={moduler()} />);
    const huvud = screen.getByRole("heading", { name: "Verktyg" }).closest("[data-vyhuvud]");
    expect(within(/** @type {HTMLElement} */ (huvud)).queryAllByRole("button")).toHaveLength(0);
    expect(() => render(<OpsVyAtgard onClick={/** @type {any} */ (undefined)}>X</OpsVyAtgard>)).toThrow(/onClick krävs/);
  });
});

describe("⛔ en ensam del och modulens egen åtgärd (0.160.0, CP 2026-10-30)", () => {
  it("en modul med en del ritar ingen flikrad, en med flera gör det", () => {
    const en = render(
      <OpsModulSida modul={moduler()[1]} activeHref="/resor/kommande" hubHref="/hub">
        <p>kommande</p>
      </OpsModulSida>,
    );
    expect(en.container.querySelector("[data-modulnav]")).toBeNull();
    expect(en.container.querySelector('[data-moduldel="kommande"]')?.textContent).toBe("kommande");
    en.unmount();
    const flera = render(
      <OpsModulSida modul={moduler()[0]} activeHref="/ekonomi/oversikt" hubHref="/hub">
        <p>x</p>
      </OpsModulSida>,
    );
    expect(flera.container.querySelector("[data-modulnav]")).not.toBeNull();
  });

  it("åtgärden står i huvudet före kugghjulet, och inte i inställningsläget", () => {
    const knapp = <button type="button">Nytt</button>;
    const visning = render(
      <OpsModulSida modul={moduler()[1]} activeHref="/resor/kommande" hubHref="/hub" ram={{ farAndra: true }} atgard={knapp}>
        <p>x</p>
      </OpsModulSida>,
    );
    const nytt = screen.getByRole("button", { name: "Nytt" });
    const kugg = /** @type {HTMLElement} */ (visning.container.querySelector('[data-modul-lage-knapp="installningar"]'));
    expect(kugg).not.toBeNull();
    expect(nytt.compareDocumentPosition(kugg) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    visning.unmount();
    render(
      <OpsModulSida modul={moduler()[1]} activeHref="/resor/kommande?lage=installningar" hubHref="/hub" ram={{ farAndra: true }} atgard={knapp}>
        <p>x</p>
      </OpsModulSida>,
    );
    expect(screen.queryByRole("button", { name: "Nytt" })).toBeNull();
  });
});

/*
 * ⛔ 0.240.0: CP 2026-11-18, "man skall kunna expandera ett verktyg för att läsa mer om verktyget ... Kanske en (i) eller info som
 * visar status", och om förslaget: "Perfekt". (i) på rutan fäller ut en panel i full bredd under raden: läget (`info`), delarna och
 * Öppna. En åt gången, och den stängs med (i), Stäng eller Escape. Röda mot 0.239.0, där rutan inte hade någon (i).
 */
describe("OpsGruppHubb: (i) fäller ut ett verktyg (0.240.0)", () => {
  const G = (/** @type {string[]} */ ids) => ({ id: "bolaget", namn: { sv: "Claes Philip Staiger AB" }, moduler: ids });
  const tva = () => validateModuler([EKONOMI(), RESOR(), INKORG()]);
  const INFO = { ekonomi: "2 obetalda kundfakturor, nästa förfaller 2026-10-05", resor: null };

  it("⛔ (i) öppnar en panel med läget, delarna och Öppna, direkt efter rutan och över hela raden", () => {
    const nav = vi.fn((_h, e) => e.preventDefault());
    render(<OpsGruppHubb grupp={G(["ekonomi", "resor"])} moduler={tva()} info={INFO} onNavigate={nav} />);
    const info = screen.getByRole("button", { name: "Om Ekonomi" });
    expect(info.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(info);
    expect(info.getAttribute("aria-expanded")).toBe("true");
    const panel = screen.getByRole("region", { name: "Ekonomi" });
    expect(info.getAttribute("aria-controls")).toBe(panel.id);
    // Läget är appens info, ordagrant.
    expect(within(panel).getByText("2 obetalda kundfakturor, nästa förfaller 2026-10-05")).toBeTruthy();
    // Delarna som länkar, i manifestets ordning, och Öppna till verktygets start.
    const delar = within(within(panel).getByRole("navigation", { name: "Delar: Ekonomi" })).getAllByRole("link");
    expect(delar.map((a) => a.getAttribute("href"))).toEqual(DELAR.map(([id]) => `/ekonomi/${id}`));
    expect(within(panel).getByRole("link", { name: "Öppna Ekonomi" }).getAttribute("href")).toBe("/ekonomi");
    fireEvent.click(delar[1]);
    expect(nav).toHaveBeenCalledWith(`/ekonomi/${DELAR[1][0]}`, expect.anything());
    // ⛔ Panelen står direkt efter sin ruta och spänner hela raden; rutnätet packas tätt så att den hamnar på raden under.
    const panelRad = /** @type {HTMLElement} */ (panel.closest("li"));
    const ruta = /** @type {HTMLElement} */ (info.closest("li"));
    expect(ruta.nextElementSibling).toBe(panelRad);
    expect(panelRad.className).toContain("col-span-full");
    expect(screen.getByRole("list", { name: "Verktyg i Claes Philip Staiger AB" }).className).toContain("grid-flow-row-dense");
  });

  it("en panel åt gången, och (i) igen stänger", () => {
    render(<OpsGruppHubb grupp={G(["ekonomi", "resor"])} moduler={tva()} info={INFO} />);
    fireEvent.click(screen.getByRole("button", { name: "Om Ekonomi" }));
    fireEvent.click(screen.getByRole("button", { name: "Om Resor" }));
    expect(screen.queryByRole("region", { name: "Ekonomi" })).toBeNull();
    expect(screen.getByRole("region", { name: "Resor" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Om Resor" }));
    expect(screen.queryByRole("region", { name: "Resor" })).toBeNull();
    expect(document.querySelector("[data-verktygspanel]")).toBeNull();
  });

  it("⛔ Stäng och Escape stänger, och fokus går tillbaka till (i)", () => {
    render(<OpsGruppHubb grupp={G(["ekonomi", "resor"])} moduler={tva()} info={INFO} />);
    const info = screen.getByRole("button", { name: "Om Ekonomi" });
    fireEvent.click(info);
    fireEvent.click(within(screen.getByRole("region", { name: "Ekonomi" })).getByRole("button", { name: "Stäng" }));
    expect(screen.queryByRole("region", { name: "Ekonomi" })).toBeNull();
    expect(document.activeElement).toBe(info);
    fireEvent.click(info);
    fireEvent.keyDown(within(screen.getByRole("region", { name: "Ekonomi" })).getByRole("link", { name: "Öppna Ekonomi" }), { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Ekonomi" })).toBeNull();
    expect(document.activeElement).toBe(info);
  });

  it("⛔ info null är ett svar och ritas som Inget nytt; saknas nyckeln står ingen lägesrad (regel 5)", () => {
    render(<OpsGruppHubb grupp={G(["ekonomi", "resor"])} moduler={tva()} info={{ resor: null }} />);
    fireEvent.click(screen.getByRole("button", { name: "Om Resor" }));
    expect(within(screen.getByRole("region", { name: "Resor" })).getByText("Inget nytt")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Om Ekonomi" }));
    expect(screen.getByRole("region", { name: "Ekonomi" }).querySelector("[data-verktyg-lage]")).toBeNull();
  });

  it("på engelska: About, Open, Close och Nothing new", () => {
    render(<OpsGruppHubb grupp={G(["ekonomi", "resor"])} moduler={tva()} info={{ ekonomi: null }} sprak="en" />);
    fireEvent.click(screen.getByRole("button", { name: "About Finance" }));
    const panel = screen.getByRole("region", { name: "Finance" });
    expect(within(panel).getByText("Nothing new")).toBeTruthy();
    expect(within(panel).getByRole("link", { name: "Open Finance" })).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "Close" })).toBeTruthy();
  });
});

/*
 * ⛔ 0.240.0, CP om första skärmbilden: "Men ekonomi skall ju också vara en rund ring tills man fäller ut den eller hur? Och de som
 * inte är installerade vill man kunna veta mer om innan man installerar." Och: "Så att det blir som förslaget."
 */
describe("OpsGruppHubb: ringen och de som kan läggas till (0.240.0)", () => {
  const G = (/** @type {string[]} */ ids) => ({ id: "bolaget", namn: { sv: "Claes Philip Staiger AB" }, moduler: ids });
  const BESKRIVEN = () => ({ ...EKONOMI(), beskrivning: { sv: "Bolagets pengar: inkomster, kostnader och fakturor.", en: "The company's money." } });
  const mods = () => validateModuler([BESKRIVEN(), RESOR(), INKORG()]);

  it("⛔ den öppna rutan förblir en rund ring: en ring runt plattan, ingen ruta bakom", () => {
    render(<OpsGruppHubb grupp={G(["ekonomi", "resor"])} moduler={mods()} />);
    const lank = screen.getByRole("link", { name: "Ekonomi" });
    const platta = /** @type {HTMLElement} */ (lank.querySelector('[aria-hidden="true"].rounded-full'));
    expect(platta.className).not.toContain("ring-accent");
    fireEvent.click(screen.getByRole("button", { name: "Om Ekonomi" }));
    expect(platta.className).toContain("ring-accent");
    expect(lank.className.split(/\s+/)).not.toContain("bg-surface");
  });

  it("⛔ en streckad ruta har (i): panelen säger vad verktyget är, vilka delar det har, och Lägg till går samma väg", async () => {
    let slapp = () => {};
    const installera = vi.fn(() => new Promise((klar) => { slapp = () => klar(undefined); }));
    render(<OpsGruppHubb grupp={G(["resor"])} moduler={mods()} installera={{ onInstallera: installera }} />);
    const valbara = screen.getByRole("list", { name: "Verktyg som kan läggas till" });
    fireEvent.click(within(valbara).getByRole("button", { name: "Om Ekonomi" }));
    const panel = screen.getByRole("region", { name: "Ekonomi" });
    expect(within(panel).getByText("Bolagets pengar: inkomster, kostnader och fakturor.")).toBeTruthy();
    expect(panel.querySelector("[data-verktyg-delar]")?.textContent).toBe(`Delar: ${DELAR.map(([, sv]) => sv).join(", ")}`);
    // Inte installerat: inga länkar in i verktyget.
    expect(within(panel).queryAllByRole("link")).toHaveLength(0);
    // Panelen står direkt efter sin ruta och spänner raden.
    const rad = /** @type {HTMLElement} */ (panel.closest("li"));
    expect(/** @type {HTMLElement} */ (within(valbara).getByRole("button", { name: "Om Ekonomi" }).closest("li")).nextElementSibling).toBe(rad);
    expect(rad.className).toContain("col-span-full");
    expect(valbara.className).toContain("grid-flow-row-dense");
    // Lägg till i panelen anropar appen med verktygets id och delar rutans väntan.
    fireEvent.click(within(panel).getByRole("button", { name: "Lägg till Ekonomi" }));
    expect(installera).toHaveBeenCalledWith("ekonomi");
    // Panelen står i samma lista som rutorna, så rutan hämtas med sitt eget märke.
    const ruta = /** @type {HTMLElement} */ (valbara.querySelector('[data-hubb-valbar="ekonomi"] [data-valbar-ruta]'));
    await waitFor(() => expect(ruta.getAttribute("aria-busy")).toBe("true"));
    expect(within(panel).getByRole("button", { name: "Lägg till Ekonomi" }).getAttribute("aria-busy")).toBe("true");
    await act(async () => slapp());
    expect(installera).toHaveBeenCalledTimes(1);
  });

  it("en medlem får läsa men inte lägga till: panelen säger att ägaren gör det", () => {
    render(<OpsGruppHubb grupp={G(["resor"])} moduler={mods()} />);
    fireEvent.click(screen.getByRole("button", { name: "Om Ekonomi" }));
    const panel = screen.getByRole("region", { name: "Ekonomi" });
    expect(within(panel).queryByRole("button", { name: /^Lägg till/ })).toBeNull();
    expect(within(panel).getByText("Ägaren installerar dem i gruppens inställningar.")).toBeTruthy();
  });

  it("⛔ en panel åt gången på hela sidan, över de installerade och de som kan läggas till", () => {
    render(<OpsGruppHubb grupp={G(["resor"])} moduler={mods()} installera={{ onInstallera: () => {} }} />);
    fireEvent.click(screen.getByRole("button", { name: "Om Resor" }));
    expect(screen.getByRole("region", { name: "Resor" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Om Ekonomi" }));
    expect(screen.queryByRole("region", { name: "Resor" })).toBeNull();
    expect(screen.getByRole("region", { name: "Ekonomi" })).toBeTruthy();
    expect(document.querySelectorAll("[data-verktygspanel], [data-valbarpanel]")).toHaveLength(1);
  });

  it("beskrivningen står också i den installerades panel, och saknas den står ingen rad", () => {
    render(<OpsGruppHubb grupp={G(["ekonomi", "resor"])} moduler={mods()} />);
    fireEvent.click(screen.getByRole("button", { name: "Om Ekonomi" }));
    expect(within(screen.getByRole("region", { name: "Ekonomi" })).getByText("Bolagets pengar: inkomster, kostnader och fakturor.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Om Resor" }));
    expect(screen.getByRole("region", { name: "Resor" }).querySelector("[data-verktyg-beskrivning]")).toBeNull();
  });

  it("⛔ beskrivning i manifestet är { sv, en }, null när den saknas, och en sträng avvisas", () => {
    expect(defineModule(BESKRIVEN()).beskrivning).toEqual({ sv: "Bolagets pengar: inkomster, kostnader och fakturor.", en: "The company's money." });
    expect(defineModule(RESOR()).beskrivning).toBeNull();
    expect(() => defineModule({ ...RESOR(), beskrivning: "Resor" })).toThrow(/beskrivning är en sträng/);
  });
});
