import { describe, it, expect } from "vitest";
import { flyttmal, postensTidsfalt } from "../lib/flytta.js";
import { byggGruppkalender, byggKalenderpost, byggMinKalender } from "../lib/kalendrar.js";
import { handelsefel } from "../lib/handelsemodell.js";

/**
 * 0.123.0 (cllp/lifehub.app#371): vart en post eller en händelse får flyttas.
 *
 * ⛔ Händelsen: CP 2026-10-19: "Det går dock inte att ändra en händelse. Vidare borde det gå att flytta en händelse till en annan kalender."
 * CP:s beslut samma dag: mellan egna kalendrar direkt, inom gruppen för den som får redigera, från egen till grupp med en bekräftelse, och
 * från grupp till egen erbjuds INTE. Provet mäter LISTAN som panelen ritar, och varje rad som inte ska finnas är ett eget prov: en lista som
 * råkar vara kortare än väntat är inte samma sak som en som är rätt (arbetsreglernas punkt 4).
 */

const mk = (/** @type {string} */ id, extra = {}) => byggMinKalender({ id, namn: id, farg: 3, ikon: "hjarta", ...extra });
const gk = (/** @type {string} */ groupId, /** @type {string} */ id, extra = {}) => byggGruppkalender({ id, namn: { sv: id, en: `${id}-en` }, farg: 2, ikon: "kalender", groupId, ...extra });

const mina = [mk("privat", { forvald: true }), mk("jobb", { ordning: 10 }), mk("gammal", { ordning: 20, arkiverad: true })];
const bolaget = { id: "bolaget", namn: "Bolaget", kalendrar: [gk("bolaget", "kalender", { forvald: true }), gk("bolaget", "barnveckor", { ordning: 10 }), gk("bolaget", "arkiv", { ordning: 20, arkiverad: true })] };
const grannar = { id: "grannar", namn: { sv: "Grannarna", en: "Neighbours" }, kalendrar: [gk("grannar", "grannkal", { forvald: true })] };

/** @param {any[]} mal */
const ider = (mal) => mal.map((m) => `${m.atgard}:${m.groupId ?? "mina"}/${m.id}`);

describe("en post i en egen kalender", () => {
  it("kan flyttas till mina andra kalendrar (byt) och till varje grupps kalendrar (konvertera), i den ordningen", () => {
    const mal = flyttmal({ fran: { slag: "post", kalenderId: "privat" }, mina, grupper: [bolaget, grannar] });
    expect(ider(mal)).toEqual(["byt:mina/jobb", "konvertera:bolaget/kalender", "konvertera:bolaget/barnveckor", "konvertera:grannar/grannkal"]);
  });

  it("bär gruppens namn, så att bekräftelsen kan säga vilken grupp", () => {
    const mal = flyttmal({ fran: { slag: "post", kalenderId: "privat" }, mina, grupper: [grannar], sprak: "en" });
    expect(mal.filter((m) => m.groupId)).toEqual([{ id: "grannkal", namn: "grannkal-en", farg: 2, ikon: "kalender", atgard: "konvertera", groupId: "grannar", gruppnamn: "Neighbours" }]);
  });

  it("⛔ erbjuder inte kalendern den redan ligger i, och inte en arkiverad", () => {
    const fran = { slag: /** @type {const} */ ("post"), kalenderId: "jobb" };
    const mal = flyttmal({ fran, mina, grupper: [bolaget] });
    expect(ider(mal)).not.toContain("byt:mina/jobb");
    expect(ider(mal)).not.toContain("byt:mina/gammal");
    expect(ider(mal)).not.toContain("konvertera:bolaget/arkiv");
    expect(ider(mal)).toContain("byt:mina/privat");
  });

  it("⛔ en person som inte får skapa i någon grupp (appen skickar inga grupper) får bara sina egna kalendrar", () => {
    expect(ider(flyttmal({ fran: { slag: "post", kalenderId: "privat" }, mina, grupper: [] }))).toEqual(["byt:mina/jobb"]);
  });

  it("med bara en kalender och inga grupper finns inget att flytta till: tom lista, inte ett fel", () => {
    expect(flyttmal({ fran: { slag: "post", kalenderId: "privat" }, mina: [mk("privat")], grupper: [] })).toEqual([]);
  });

  it("farRedigera gäller inte en post: den är alltid personens egen", () => {
    const utan = flyttmal({ fran: { slag: "post", kalenderId: "privat" }, mina, grupper: [bolaget] });
    const med = flyttmal({ fran: { slag: "post", kalenderId: "privat" }, mina, grupper: [bolaget], farRedigera: false });
    expect(med).toEqual(utan);
  });
});

describe("en händelse i en gruppkalender", () => {
  const fran = { slag: /** @type {const} */ ("handelse"), groupId: "bolaget", kalenderId: "kalender" };

  it("kan flyttas till gruppens andra kalendrar (byt) för den som får redigera den", () => {
    expect(ider(flyttmal({ fran, mina, grupper: [bolaget, grannar], farRedigera: true }))).toEqual(["byt:bolaget/barnveckor"]);
  });

  it("⛔ GRUPPKALENDER TILL EGEN KALENDER ERBJUDS INTE: inga av mina kalendrar finns i listan, hur många jag än har", () => {
    const mal = flyttmal({ fran, mina, grupper: [bolaget], farRedigera: true });
    expect(mal.some((m) => m.groupId === undefined)).toBe(false);
    for (const k of mina) expect(mal.map((m) => m.id)).not.toContain(k.id);
    // Och det gäller också när gruppen själv skulle ha en kalender med samma id som en av mina.
    const samma = { id: "bolaget", namn: "Bolaget", kalendrar: [gk("bolaget", "kalender", { forvald: true }), gk("bolaget", "privat", { ordning: 10 })] };
    const m2 = flyttmal({ fran, mina, grupper: [samma], farRedigera: true });
    expect(m2).toHaveLength(1);
    expect(m2[0]).toMatchObject({ id: "privat", groupId: "bolaget", atgard: "byt" });
  });

  it("⛔ ingen annan grupps kalender erbjuds: händelsen lämnar inte sin grupp", () => {
    const mal = flyttmal({ fran, mina, grupper: [bolaget, grannar], farRedigera: true });
    expect(mal.every((m) => m.groupId === "bolaget")).toBe(true);
  });

  it("⛔ den som inte får redigera händelsen får ingen lista, och ett utelämnat farRedigera är 'vet inte', alltså ingen lista", () => {
    expect(flyttmal({ fran, mina, grupper: [bolaget], farRedigera: false })).toEqual([]);
    expect(flyttmal({ fran, mina, grupper: [bolaget] })).toEqual([]);
    expect(flyttmal({ fran, mina, grupper: [bolaget], farRedigera: /** @type {any} */ ("ja") })).toEqual([]);
  });

  it("om gruppen inte finns bland grupperna appen gav: ingen lista", () => {
    expect(flyttmal({ fran, mina, grupper: [grannar], farRedigera: true })).toEqual([]);
  });

  it("⛔ arkiverade erbjuds inte, och inte kalendern den ligger i", () => {
    const mal = flyttmal({ fran, mina, grupper: [bolaget], farRedigera: true });
    expect(ider(mal)).not.toContain("byt:bolaget/arkiv");
    expect(ider(mal)).not.toContain("byt:bolaget/kalender");
  });
});

describe("felaktig indata kastar", () => {
  it("okänt slag, ingen kalender, ingen grupp för en händelse", () => {
    expect(() => flyttmal({ fran: /** @type {any} */ ({ slag: "uppgift", kalenderId: "x" }) })).toThrow(/slag/);
    expect(() => flyttmal({ fran: /** @type {any} */ ({ slag: "post" }) })).toThrow(/kalenderId/);
    expect(() => flyttmal({ fran: /** @type {any} */ ({ slag: "handelse", kalenderId: "x" }), farRedigera: true })).toThrow(/groupId/);
    expect(() => flyttmal(/** @type {any} */ ({}))).toThrow(/slag/);
  });
});

describe("postensTidsfalt: postens tid som en händelses fält", () => {
  const p = (/** @type {object} */ extra) => byggKalenderpost({ id: "p", kalenderId: "privat", titel: "T", start: "2026-10-27T09:00", slut: "2026-10-27T10:00", ...extra });

  it("klockslag samma dag", () => {
    expect(postensTidsfalt(p({}))).toEqual({ datum: "2026-10-27", tid: "09:00", slutTid: "10:00" });
  });

  it("utan slut (slut = start) har ingen slutTid", () => {
    expect(postensTidsfalt(p({ slut: "2026-10-27T09:00" }))).toEqual({ datum: "2026-10-27", tid: "09:00" });
  });

  it("över midnatt: slutDatum och en slutTid som får vara tidigare", () => {
    expect(postensTidsfalt(p({ start: "2026-10-27T22:00", slut: "2026-10-28T02:00" }))).toEqual({ datum: "2026-10-27", slutDatum: "2026-10-28", tid: "22:00", slutTid: "02:00" });
  });

  it("heldag: ingen tid, och slutDatum bara när den sträcker sig", () => {
    expect(postensTidsfalt(p({ heldag: true, start: "2026-10-27", slut: "2026-10-27" }))).toEqual({ datum: "2026-10-27", heldag: true });
    expect(postensTidsfalt(p({ heldag: true, start: "2026-10-27", slut: "2026-10-30" }))).toEqual({ datum: "2026-10-27", slutDatum: "2026-10-30", heldag: true });
  });

  it("resultatet går igenom händelsemodellens egen kontroll för varje form", () => {
    const poster = [p({}), p({ slut: "2026-10-27T09:00" }), p({ start: "2026-10-27T22:00", slut: "2026-10-28T02:00" }), p({ heldag: true, start: "2026-10-27", slut: "2026-10-27" }), p({ heldag: true, start: "2026-10-27", slut: "2026-10-30" })];
    expect(poster).toHaveLength(5);
    for (const post of poster) expect(handelsefel(postensTidsfalt(post), {})).toEqual([]);
  });

  it("en post utan start och slut kastar", () => {
    expect(() => postensTidsfalt(/** @type {any} */ ({}))).toThrow(/start och slut/);
  });
});
