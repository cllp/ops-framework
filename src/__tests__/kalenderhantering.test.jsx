import { afterEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsAppShell, useOppnaSkapa } from "../components/OpsAppShell.jsx";
import { OpsKalendrar } from "../components/OpsKalendrar.jsx";
import { OpsSvar, OpsSvarsrad } from "../components/OpsSvar.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createKalenderkalla, createSvarskalla } from "../data/kalenderkalla.js";
import { filtreraPoster, forvaldKalenderId } from "../lib/calendar.js";
import { byggSvar, handelsefel, handelsensDagar, handelsensKalenderId, harPasserat, sammanstallSvar, svarsrader } from "../lib/handelsemodell.js";
import {
  arkiveraKalender,
  byggGruppkalender,
  byggMinKalender,
  flyttaKalender,
  kalenderIdUrNamn,
  kalenderval,
  nastaOrdning,
  valjForvald,
} from "../lib/kalendrar.js";

/*
 * 0.37.0 (#179 F2 och F3, #206). Hantera kalendrar, kalenderfiltret som ren funktion, händelsemodellen, svaren och
 * inkorgens rader, källorna mot minneskällan, och skalets "Ny händelse" med kalender, Kräv svar och dagen i adressen.
 * Regelproven ligger i `rules/__tests__/kalenderhantering.test.mjs`, det som syns i en riktig webbläsare i
 * `check-skalyta` avsnitt 31 och 32.
 */

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

const G = "cps-ab";
const gk = (id, extra = {}) => byggGruppkalender({ id, namn: { sv: id[0].toUpperCase() + id.slice(1) }, farg: 4, ikon: "kalender", groupId: G, ...extra });
const mk = (id, extra = {}) => byggMinKalender({ id, namn: id[0].toUpperCase() + id.slice(1), farg: 2, ikon: "hjarta", ...extra });

describe("hantera kalendrar: de rena funktionerna (F2)", () => {
  it("ett id ur namnet, utan å, ä och ö, och unikt i listan", () => {
    expect(kalenderIdUrNamn("Möten & Resor", [])).toBe("moten-resor");
    expect(kalenderIdUrNamn("Möten & Resor", [{ id: "moten-resor" }, { id: "moten-resor-2" }])).toBe("moten-resor-3");
    expect(kalenderIdUrNamn("  ", [])).toBe("kalender");
  });

  it("nästa ordning läggs sist, med luft", () => {
    expect(nastaOrdning([])).toBe(0);
    expect(nastaOrdning([gk("a", { ordning: 0 }), gk("b", { ordning: 30 })])).toBe(40);
  });

  it("⛔ flytta numrerar om, så att två kalendrar med samma ordning faktiskt byter plats, och skriver bara de som ändrats", () => {
    const lista = [gk("alfa"), gk("beta"), gk("gamma")]; // alla ordning 0, namnet avgör: Alfa, Beta, Gamma
    const andrade = flyttaKalender(lista, "gamma", -1);
    const efter = lista.map((k) => andrade.find((a) => a.id === k.id) ?? k).sort((a, b) => a.ordning - b.ordning);
    expect(efter.map((k) => k.id)).toEqual(["alfa", "gamma", "beta"]);
    // Alfa stod redan på 0 och skrivs inte.
    expect(andrade.map((k) => k.id).sort()).toEqual(["beta", "gamma"]);
    expect(flyttaKalender(lista, "alfa", -1)).toEqual([]);
    // ⛔ En arkiverad rörs inte.
    expect(flyttaKalender([...lista, gk("delta", { arkiverad: true })], "gamma", 1).some((k) => k.id === "delta")).toBe(false);
  });

  it("⛔ att byta förvald ger TVÅ rader: den nya och den gamla", () => {
    const lista = [gk("alfa", { forvald: true }), gk("beta")];
    expect(valjForvald(lista, "beta").map((k) => [k.id, k.forvald])).toEqual([["alfa", false], ["beta", true]]);
    expect(() => valjForvald([gk("x", { arkiverad: true })], "x")).toThrow(/arkiverad/);
  });

  it("⛔ en arkiverad kalender är aldrig förvald, och den förvalda härleds då ur ordningen", () => {
    const lista = [gk("alfa", { forvald: true, ordning: 0 }), gk("beta", { ordning: 10 })];
    const ark = arkiveraKalender(lista, "alfa");
    expect(ark).toMatchObject({ arkiverad: true, forvald: false });
    const val = kalenderval({ gruppens: [ark, lista[1]] });
    expect(val.map((k) => [k.id, k.forvald])).toEqual([["beta", true]]);
  });

  it("kalenderval: gruppens först, sedan mina, bara valbara, förvald en per sida", () => {
    const val = kalenderval({ gruppens: [gk("styrelse", { ordning: 10 }), gk("resor", { ordning: 0 })], mina: [mk("privat"), mk("gammal", { arkiverad: true })] });
    expect(val.map((k) => `${k.grupp ? "g" : "m"}:${k.id}:${k.forvald}`)).toEqual(["g:resor:true", "g:styrelse:false", "m:privat:true"]);
  });
});

describe("filtret (F2 klart när)", () => {
  const poster = [
    { id: "mote", date: "2026-10-12", title: "Styrelsemöte" }, // utan kalender: den förvalda
    { id: "tag", date: "2026-10-12", title: "Tåg", kalender: { id: "resor", namn: "Resor", farg: /** @type {const} */ (2) } },
    { id: "tand", date: "2026-10-12", title: "Tandläkaren", kalender: { id: "privat", namn: "Privat", farg: /** @type {const} */ (3) } },
  ];
  const kalendrar = [
    { id: "styrelse", namn: "Styrelsen", farg: /** @type {const} */ (4), grupp: true, forvald: true },
    { id: "resor", namn: "Resor", farg: /** @type {const} */ (2), grupp: true },
    { id: "privat", namn: "Privat", farg: /** @type {const} */ (3) },
  ];
  const forvaldId = forvaldKalenderId(kalendrar);
  const syns = (/** @type {string[] | null} */ valda) => filtreraPoster(poster, { valdaKalendrar: valda, forvaldId }).map((p) => p.id);

  it("⛔ en post i en bortvald kalender syns inte, och syns igen när kalendern väljs", () => {
    expect(syns(null)).toEqual(["mote", "tag", "tand"]);
    expect(syns(["styrelse", "privat"])).toEqual(["mote", "tand"]); // Resor bortvald: tåget syns inte
    expect(syns(["styrelse", "privat", "resor"])).toEqual(["mote", "tag", "tand"]); // Resor vald igen
  });

  it("⛔ en post utan kalender hör till gruppens förvalda, inte till mina", () => {
    expect(forvaldId).toBe("styrelse");
    expect(syns(["privat"])).toEqual(["tand"]);
    expect(forvaldKalenderId([{ id: "privat", forvald: true }, { id: "resor", grupp: true }])).toBe("resor");
  });
});

describe("händelsemodellen (F3)", () => {
  it("fel utskrivna som meningar, och inga för en giltig händelse", () => {
    expect(handelsefel({ datum: "2026-10-12", tid: "18:00", slutTid: "20:00", kalenderId: "styrelse", kravSvar: true })).toEqual([]);
    expect(handelsefel({ datum: "2026-02-31" })).toContain("Datumet finns inte");
    expect(handelsefel({ datum: "2026-10-12", slutDatum: "2026-10-12" })[0]).toMatch(/Slutdatumet måste vara efter/);
    expect(handelsefel({ datum: "2026-10-12", heldag: true, tid: "10:00" })).toContain("En heldagshändelse har varken från eller till");
    expect(handelsefel({ datum: "2026-10-12", tid: "18:00", slutTid: "17:00" })).toContain("Till måste vara senare än Från");
    // ⛔ Över flera dagar får slutet vara tidigare på dagen.
    expect(handelsefel({ datum: "2026-10-12", slutDatum: "2026-10-13", tid: "22:00", slutTid: "02:00" })).toEqual([]);
    expect(handelsefel({ datum: "2026-10-12", kravSvar: "ja" })).toContain("Kräv svar är sant eller falskt");
  });

  it("prövar kalendern mot gruppens: finns, och inte arkiverad", () => {
    const gruppkalendrar = [gk("styrelse"), gk("gammal", { arkiverad: true })];
    expect(handelsefel({ datum: "2026-10-12", kalenderId: "okand" }, { gruppkalendrar })).toContain("Kalendern finns inte bland gruppens kalendrar");
    expect(handelsefel({ datum: "2026-10-12", kalenderId: "gammal" }, { gruppkalendrar })[0]).toMatch(/arkiverad/);
  });

  it("⛔ en händelse utan kalenderId hör till gruppens förvalda (ingen bakfyllnad)", () => {
    const gruppkalendrar = [gk("resor", { ordning: 10 }), gk("styrelse", { ordning: 0 })];
    expect(handelsensKalenderId({}, gruppkalendrar)).toBe("styrelse");
    expect(handelsensKalenderId({ kalenderId: "resor" }, gruppkalendrar)).toBe("resor");
    expect(handelsensKalenderId({}, [])).toBeNull();
  });

  it("flerdag och heldag som kalenderns fält", () => {
    expect(handelsensDagar({ datum: "2026-10-05", slutDatum: "2026-10-07" })).toEqual({ date: "2026-10-05", endDate: "2026-10-07" });
    expect(handelsensDagar({ datum: "2026-10-05", heldag: true })).toEqual({ date: "2026-10-05", allDay: true });
    expect(harPasserat({ datum: "2026-09-28", slutDatum: "2026-10-01" }, "2026-09-30")).toBe(false);
    expect(harPasserat({ datum: "2026-09-28" }, "2026-09-30")).toBe(true);
  });
});

describe("svaren (F3)", () => {
  it("⛔ sammanställningen skriver ut alla tre delarna, också nollor", () => {
    expect(sammanstallSvar([], ["a", "b"]).text).toBe("0 kommer, 0 kommer inte, 2 har inte svarat");
    const s = sammanstallSvar([{ id: "a", svar: "kommer" }, { id: "b", svar: "kommer" }, { id: "c", svar: "kommer" }, { id: "d", svar: "kommerInte" }], ["a", "b", "c", "d", "e", "f"]);
    expect(s.text).toBe("3 kommer, 1 kommer inte, 2 har inte svarat");
  });

  it("⛔ bara medlemmarnas svar räknas", () => {
    expect(sammanstallSvar([{ id: "gick", svar: "kommer" }, { id: "a", svar: "kommerInte" }], ["a", "b"])).toMatchObject({ kommer: 0, kommerInte: 1, ejSvarat: 1 });
  });

  it("två svar och inga andra", () => {
    expect(byggSvar("kommer")).toEqual({ svar: "kommer" });
    expect(() => byggSvar("kanske")).toThrow(/finns inte/);
  });

  it("⛔ inkorgens rader räknas fram: kräver svar, inte besvarad, inte passerad; och raden försvinner när man svarat", () => {
    const handelser = [
      { id: "mote", datum: "2026-10-12", tid: "18:00", kravSvar: true },
      { id: "fika", datum: "2026-10-02", kravSvar: true },
      { id: "fri", datum: "2026-10-03" }, // frågar inte
      { id: "forbi", datum: "2026-09-01", kravSvar: true }, // passerad
    ];
    expect(svarsrader({ handelser, mina: new Map(), idag: "2026-09-30" }).map((h) => h.id)).toEqual(["fika", "mote"]);
    expect(svarsrader({ handelser, mina: new Map([["fika", "kommer"]]), idag: "2026-09-30" }).map((h) => h.id)).toEqual(["mote"]);
    expect(() => svarsrader({ handelser, mina: {}, idag: "30 sep" })).toThrow();
  });
});

describe("källorna mot minneskällan", () => {
  it("gruppens kalendrar: sparas med gruppens nyckel, läses tillbaka, och ett byte av förvald skrivs i en batch", async () => {
    const kalla = createMemorySource();
    const k = createKalenderkalla({ kalla });
    await k.sparaGruppens(G, [gk("styrelse", { forvald: true }), gk("resor", { ordning: 10 })]);
    // ⛔ Nyckeln är katalogens `groupId|id`.
    expect((await kalla.list("gruppkalendrar")).map((r) => r.id).sort()).toEqual([`${G}|resor`, `${G}|styrelse`]);
    let lista = await k.gruppens(G);
    expect(lista.map((x) => [x.id, x.forvald])).toEqual([["styrelse", true], ["resor", false]]);
    let batchar = 0;
    const med = createKalenderkalla({ kalla: { ...kalla, batch: async (/** @type {any} */ ops) => { batchar += 1; return kalla.batch(ops); } } });
    const svar = await med.sparaGruppens(G, valjForvald(lista, "resor"));
    expect(svar).toEqual({ skrivna: 2, atomar: true });
    expect(batchar).toBe(1);
    lista = await k.gruppens(G);
    expect(lista.find((x) => x.forvald)?.id).toBe("resor");
    await expect(k.sparaGruppens(G, [{ ...gk("x"), groupId: "annan" }])).rejects.toThrow(/sparas inte/);
  });

  it("mina kalendrar och poster ligger under användaren, och en post i en arkiverad kalender vägras", async () => {
    const kalla = createMemorySource();
    const k = createKalenderkalla({ kalla });
    await k.sparaMina("u1", [mk("privat"), mk("gammal", { arkiverad: true })]);
    expect((await k.mina("u1")).map((x) => x.id)).toEqual(["gammal", "privat"]);
    const mina = await k.mina("u1");
    const p = await k.sparaPost("u1", { id: "tand", kalenderId: "privat", titel: "Tandläkaren", start: "2026-10-20T09:00", slut: "2026-10-20T10:00", blockerar: true }, mina);
    expect(p.blockerar).toBe(true);
    expect((await k.poster("u1")).map((x) => x.id)).toEqual(["tand"]);
    await expect(k.sparaPost("u1", { id: "x", kalenderId: "gammal", titel: "X", start: "2026-10-20T09:00" }, mina)).rejects.toThrow(/arkiverad/);
    await k.taBortPost("u1", "tand");
    expect(await k.poster("u1")).toEqual([]);
    expect(await k.mina("u2")).toEqual([]);
  });

  it("svaren: ett per person och händelse, och ändrat svar skriver om samma rad", async () => {
    const kalla = createMemorySource();
    const s = createSvarskalla({ kalla });
    await s.svara("mote", "anna", "kommer");
    await s.svara("mote", "bo", "kommerInte");
    await s.svara("mote", "anna", "kommerInte");
    expect((await s.lista("mote")).map((r) => [r.id, r.svar]).sort()).toEqual([["anna", "kommerInte"], ["bo", "kommerInte"]]);
    expect([...(await s.mina(["mote", "fika"], "anna"))]).toEqual([["mote", "kommerInte"]]);
    await expect(s.svara("mote", "anna", /** @type {any} */ ("kanske"))).rejects.toThrow();
  });
});

describe("OpsKalendrar (F2)", () => {
  /** @param {Partial<Parameters<typeof OpsKalendrar>[0]>} [extra] */
  function visa(extra = {}) {
    /** @type {any[]} */
    const gruppens = [];
    /** @type {any[]} */
    const mina = [];
    render(
      <OpsKalendrar
        groupId={G}
        gruppens={[gk("styrelse", { forvald: true, ordning: 0 }), gk("resor", { ordning: 10 })]}
        mina={[mk("privat")]}
        kanAndraGruppens
        onSparaGruppens={(r) => { gruppens.push(r); }}
        onSparaMina={(r) => { mina.push(r); }}
        {...extra}
      />,
    );
    return { gruppens, mina };
  }

  it("skapar en av mina kalendrar med namn, färg och ikon, och ett id ur namnet", async () => {
    const { mina } = visa();
    const sektion = screen.getByRole("region", { name: "Mina kalendrar" });
    fireEvent.click(within(sektion).getByRole("button", { name: "Ny kalender" }));
    fireEvent.change(within(sektion).getByRole("textbox"), { target: { value: "Träning" } });
    fireEvent.click(within(sektion).getByRole("button", { name: "Färg 5" }));
    fireEvent.click(within(sektion).getByRole("button", { name: "Stjärna" }));
    fireEvent.click(within(sektion).getByRole("button", { name: "Skapa kalender" }));
    await waitFor(() => expect(mina).toHaveLength(1));
    expect(mina[0]).toEqual([{ id: "traning", namn: "Träning", farg: 5, ikon: "stjarna", ordning: 10, forvald: false, iFlodet: false, arkiverad: false }]);
  });

  it("byter namn på gruppens kalender och gör den förvald: två rader i samma sparning", async () => {
    const { gruppens } = visa();
    const sektion = screen.getByRole("region", { name: "Gruppens kalendrar" });
    fireEvent.click(within(sektion).getByRole("button", { name: "Redigera Resor" }));
    fireEvent.change(within(sektion).getByRole("textbox"), { target: { value: "Resor och möten" } });
    fireEvent.click(within(sektion).getByRole("checkbox", { name: /Förvald/ }));
    fireEvent.click(within(sektion).getByRole("button", { name: "Spara ändringar" }));
    await waitFor(() => expect(gruppens).toHaveLength(1));
    expect(gruppens[0].map((/** @type {any} */ k) => [k.id, text(k.namn), k.forvald])).toEqual([["styrelse", "Styrelse", false], ["resor", "Resor och möten", true]]);
  });

  it("arkiverar och flyttar, och arkiverade står under en egen rubrik", async () => {
    const { gruppens } = visa({ gruppens: [gk("styrelse", { ordning: 0 }), gk("resor", { ordning: 10 }), gk("gammal", { arkiverad: true })] });
    const sektion = screen.getByRole("region", { name: "Gruppens kalendrar" });
    expect(within(sektion).getByText("Arkiverade (1)")).toBeInTheDocument();
    fireEvent.click(within(sektion).getByRole("button", { name: "Flytta upp Resor" }));
    await waitFor(() => expect(gruppens).toHaveLength(1));
    expect(gruppens[0].map((/** @type {any} */ k) => [k.id, k.ordning])).toEqual([["resor", 0], ["styrelse", 10]]);
    expect(within(sektion).getByRole("button", { name: "Flytta upp Styrelse" })).toBeDisabled();
    fireEvent.click(within(sektion).getByRole("button", { name: "Arkivera Styrelse" }));
    await waitFor(() => expect(gruppens).toHaveLength(2));
    expect(gruppens[1]).toEqual([expect.objectContaining({ id: "styrelse", arkiverad: true, forvald: false })]);
  });

  it("⛔ utan rätt att ändra gruppens: inga knappar, och en rad som säger varför", () => {
    visa({ kanAndraGruppens: false });
    const sektion = screen.getByRole("region", { name: "Gruppens kalendrar" });
    expect(within(sektion).queryByRole("button")).toBeNull();
    expect(within(sektion).getByText("Bara gruppens ägare och admin ändrar gruppens kalendrar.")).toBeInTheDocument();
  });

  it("⛔ ett fel från sparningen står utskrivet, det sväljs inte", async () => {
    visa({ onSparaMina: () => Promise.reject(new Error("Missing or insufficient permissions.")) });
    const sektion = screen.getByRole("region", { name: "Mina kalendrar" });
    fireEvent.click(within(sektion).getByRole("button", { name: "Arkivera Privat" }));
    expect(await within(sektion).findByRole("alert")).toHaveTextContent("Missing or insufficient permissions.");
  });

  it("tomt är ett svar i båda sektionerna", () => {
    visa({ gruppens: [], mina: [] });
    expect(screen.getByText("Gruppen har inga kalendrar ännu.")).toBeInTheDocument();
    expect(screen.getByText("Du har inga egna kalendrar ännu.")).toBeInTheDocument();
  });
});

describe("OpsSvar och inkorgens rad (F3)", () => {
  const medlemmar = [{ uid: "anna", namn: "Anna" }, { uid: "bo", namn: "Bo" }, { uid: "cissi", namn: "Cissi" }];

  it("skriver sammanställningen, och bara min rad har knappar", async () => {
    /** @type {string[]} */
    const svarat = [];
    render(<OpsSvar svar={[{ id: "bo", svar: "kommerInte" }]} medlemmar={medlemmar} uid="anna" onSvara={(v) => { svarat.push(v); }} />);
    expect(screen.getByText("0 kommer, 1 kommer inte, 2 har inte svarat")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Kommer/ })).toHaveLength(2);
    expect(within(/** @type {HTMLElement} */ (document.querySelector('[data-svarsrad="bo"]'))).getByText("Kommer inte")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kommer, Anna" }));
    await waitFor(() => expect(svarat).toEqual(["kommer"]));
  });

  it("inkorgens rad har Kommer och Kommer inte", async () => {
    /** @type {string[]} */
    const svarat = [];
    render(<OpsSvarsrad titel="Styrelsemöte" nar="Måndag 12 oktober, 18:00" onSvara={(v) => { svarat.push(v); }} />);
    expect(screen.getByText("Måndag 12 oktober, 18:00 · Svar önskas")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kommer inte, Styrelsemöte" }));
    await waitFor(() => expect(svarat).toEqual(["kommerInte"]));
  });
});

/** @param {any} n @returns {string} */
function text(n) {
  return typeof n === "string" ? n : n.sv;
}

describe("skalets Ny händelse: kalender, Kräv svar och dagen (F2, F3, #206)", () => {
  /** @type {any[]} */
  let mottaget = [];
  /** @param {any} p */
  function Form(p) {
    mottaget.push({ datum: p.datum, kalender: p.kalender, kravSvar: p.kravSvar, blockerar: p.blockerar, typ: p.typ });
    return <form id={p.formId} aria-label="Händelseformulär"><p data-dag="">{String(p.datum)}</p></form>;
  }
  const kalendrar = { gruppens: [gk("styrelse", { forvald: true }), gk("resor", { ordning: 10 })], mina: [mk("privat")] };
  const skapa = (/** @type {any} */ extra = {}) => ({
    sparaEtikett: "Spara",
    lage: G,
    handelse: { form: Form, katalog: "handelsetyper", ...extra },
    kataloger: [{ id: "handelsetyper", kategorier: [{ id: "mote", namn: { sv: "Möte" }, ordning: 0 }] }],
  });
  function Knapp({ datum }) {
    const oppna = useOppnaSkapa();
    return <button type="button" onClick={() => oppna("handelse", datum ? { datum } : undefined)}>Skapa på dagen</button>;
  }
  /** @param {{ extra?: any, datum?: string }} [a] */
  function Skal({ extra, datum } = {}) {
    return (
      <OpsAppShell brand="Ops" nav={[{ href: "/", label: "Start" }]} activeHref="/" grupper={{ lista: [{ id: G, namn: "CPS AB", roll: "agare" }], aktiv: G, onValj: () => {} }} skapa={skapa(extra)}>
        <Knapp datum={datum} />
      </OpsAppShell>
    );
  }
  const senast = () => mottaget[mottaget.length - 1];

  it("#206: dagen följer med vid ett klick och står i adressen", async () => {
    mottaget = [];
    render(<Skal datum="2026-10-12" />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Skapa på dagen" }));
    await waitFor(() => expect(senast()?.datum).toBe("2026-10-12"));
    const u = new URL(window.location.href);
    expect([u.searchParams.get("skapa"), u.searchParams.get("datum")]).toEqual(["handelse", "2026-10-12"]);
  });

  it("#206: dagen följer med vid en omladdning, och inte utan parametern", async () => {
    mottaget = [];
    window.history.replaceState(null, "", "/?skapa=handelse&datum=2026-10-12");
    const { unmount } = render(<Skal />);
    await waitFor(() => expect(senast()?.datum).toBe("2026-10-12"));
    unmount();
    mottaget = [];
    window.history.replaceState(null, "", "/?skapa=handelse");
    render(<Skal />);
    await waitFor(() => expect(mottaget.length).toBeGreaterThan(0));
    expect(senast().datum).toBeNull();
  });

  it("#206: ett datum som inte finns kastar, och dagen stängs ur adressen med panelen", async () => {
    let fel = null;
    function Prov() {
      const oppna = useOppnaSkapa();
      return <button type="button" onClick={() => { try { oppna("handelse", { datum: "2026-02-31" }); } catch (e) { fel = e; } }}>Prova</button>;
    }
    render(<OpsAppShell brand="Ops" nav={[{ href: "/", label: "Start" }]} activeHref="/" skapa={skapa()}><Prov /></OpsAppShell>);
    await userEvent.setup().click(screen.getByRole("button", { name: "Prova" }));
    expect(String(fel?.message)).toMatch(/finns inte/);
  });

  it("⛔ Kalender står överst med gruppens förvalda, Kräv svar är av, och Skicka mejl finns inte", async () => {
    mottaget = [];
    render(<Skal extra={{ kalendrar }} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Skapa på dagen" }));
    const panel = await screen.findByRole("region", { name: "Ny händelse" });
    expect(within(panel).getByRole("button", { name: "Kalender: Styrelse" })).toBeInTheDocument();
    expect(senast()).toMatchObject({ kalender: { id: "styrelse", slag: "grupp" }, kravSvar: false, blockerar: false, typ: "mote" });
    const krav = within(panel).getByRole("switch", { name: /Kräv svar/ });
    expect(krav).not.toBeChecked();
    expect(within(panel).queryByText(/mejl/i)).toBeNull();
    fireEvent.click(krav);
    await waitFor(() => expect(senast().kravSvar).toBe(true));
  });

  it("⛔ i en av mina kalendrar: inga svar, ingen typ, och Blockerar tillgänglighet i stället", async () => {
    mottaget = [];
    render(<Skal extra={{ kalendrar }} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Skapa på dagen" }));
    const panel = await screen.findByRole("region", { name: "Ny händelse" });
    await user.click(within(panel).getByRole("button", { name: "Kalender: Styrelse" }));
    const valjare = await screen.findByRole("dialog", { name: "Kalender" });
    expect(within(valjare).getByRole("region", { name: "CPS AB: kalendrar" })).toBeInTheDocument();
    await user.click(within(within(valjare).getByRole("region", { name: "Mina kalendrar" })).getByRole("button", { name: "Privat" }));
    await waitFor(() => expect(senast()).toMatchObject({ kalender: { id: "privat", slag: "mina" }, kravSvar: false, typ: null }));
    expect(within(panel).queryByRole("switch", { name: /Kräv svar/ })).toBeNull();
    expect(within(panel).getByRole("switch", { name: /Blockerar tillgänglighet/ })).toBeInTheDocument();
    expect(within(panel).queryByRole("combobox", { name: /Typ/ })).toBeNull();
  });

  it("utan kalendrar är formuläret som förut: ingen Kalender-rad och inga nya val", async () => {
    mottaget = [];
    render(<Skal />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Skapa på dagen" }));
    const panel = await screen.findByRole("region", { name: "Ny händelse" });
    expect(within(panel).queryByText(/^Kalender/)).toBeNull();
    expect(within(panel).queryByRole("switch")).toBeNull();
    await act(async () => {});
    expect(senast()).toMatchObject({ kalender: null, kravSvar: false });
  });
});
