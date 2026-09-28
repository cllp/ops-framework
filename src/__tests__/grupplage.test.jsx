import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ALLA_GRUPPER,
  grupperAttFraga,
  gruppenAttSkapaI,
  grupplagetsNyckel,
  lasAktivGrupp,
  minaGrupper,
  navForLage,
  slaIhopSvar,
  sparaAktivGrupp,
  valtLage,
} from "../lib/grupplage.js";
import { gruppLista, gruppSkapa, listaPerGrupp, raderPerGrupp } from "../data/gruppkalla.js";
import { createMemorySource } from "../data/adapters.js";
import { defineModule } from "../lib/modul.js";
import { OpsGruppvaljare } from "../components/OpsGruppvaljare.jsx";
import { OpsGruppfilter } from "../components/OpsGruppfilter.jsx";
import { OpsGruppmarke } from "../components/OpsGruppmarke.jsx";

/**
 * Fas 2.5 i epiken #92: gruppväljare, gruppfilter och sammanslagning (#139).
 *
 * ⛔ BESLUTEN PROVAS DÄR DE BOR, ALLTSÅ I RENA FUNKTIONER. Dagens lärdom från
 * #138: ett prov som trycker på en Radix-popover i jsdom blir grönt av att
 * ingenting hände. Väljaren och filtret är därför vanliga knappar, och proven
 * trycker på dem på riktigt.
 */

const skapare = { uid: "uid-1", namn: "CP", typ: "manniska", kalla: "prov" };
/** @param {string} id @param {string} namn @param {object} [extra] */
const grupp = (id, namn, extra = {}) => ({ id, namn: { sv: namn }, moduler: [], arkiverad: false, skapadAv: skapare, ...extra });
/** @param {string} groupId @param {object} [extra] */
const medlem = (groupId, extra = {}) => ({ id: `uid-1_${groupId}`, userId: "uid-1", groupId, roll: "medlem", typ: "person", status: "aktiv", ...extra });

const BOLAGET = grupp("bolaget", "Bolaget", { moduler: ["ekonomi"] });
const PRIVAT = grupp("privat", "Privat");
const ARKIVERAD = grupp("gammalt", "Arkiverat", { arkiverad: true });

describe("mina grupper", () => {
  it("tar bara med aktiva medlemskap i grupper som inte är arkiverade", () => {
    const mina = minaGrupper(
      [medlem("bolaget"), medlem("privat", { status: "avslutad" }), medlem("gammalt")],
      [BOLAGET, PRIVAT, ARKIVERAD],
    );
    expect(mina.map((g) => g.id)).toEqual(["bolaget"]);
  });

  it("sorterar på namnet så att ordningen inte beror på svarens ordning", () => {
    const mina = minaGrupper([medlem("b"), medlem("a")], [grupp("b", "Örnen"), grupp("a", "Almen")]);
    expect(mina.map((g) => g.id)).toEqual(["a", "b"]);
  });

  it("avvisar en grupp som heter alla, eftersom den krockar med att titta i allihop", () => {
    expect(() => minaGrupper([medlem(ALLA_GRUPPER)], [grupp(ALLA_GRUPPER, "Alla")])).toThrow(/krockar/);
  });
});

describe("det sparade valet", () => {
  it("nycklas per person, inte per webbläsare", () => {
    expect(grupplagetsNyckel("uid-1")).not.toBe(grupplagetsNyckel("uid-2"));
  });

  it("kräver uid, annars delar alla på samma nyckel", () => {
    expect(() => grupplagetsNyckel("  ")).toThrow(/uid krävs/);
  });

  it("sparas och läses tillbaka", () => {
    /** @type {Record<string, string>} */
    const bak = {};
    const lagring = { getItem: (n) => bak[n] ?? null, setItem: (n, v) => { bak[n] = v; } };
    sparaAktivGrupp("uid-1", "bolaget", lagring);
    expect(lasAktivGrupp("uid-1", lagring)).toBe("bolaget");
    expect(lasAktivGrupp("uid-2", lagring)).toBe(null);
  });

  it("avvisar tomt, eftersom ALLA_GRUPPER är det utskrivna svaret", () => {
    expect(() => sparaAktivGrupp("uid-1", "", { getItem: () => null, setItem: () => {} })).toThrow(/lage krävs/);
  });
});

describe("vilket val som gäller i dag", () => {
  const mina = [BOLAGET, PRIVAT];

  it("faller tillbaka till alla när medlemskapet tagit slut", () => {
    expect(valtLage("gammalt", mina)).toBe(ALLA_GRUPPER);
  });

  it("faller tillbaka till alla när ingenting är sparat", () => {
    expect(valtLage(null, mina)).toBe(ALLA_GRUPPER);
  });

  it("behåller en grupp jag fortfarande är med i", () => {
    expect(valtLage("privat", mina)).toBe("privat");
  });
});

describe("grupperna som frågas", () => {
  const mina = [BOLAGET, PRIVAT];

  it("är alla mina i läget alla", () => {
    expect(grupperAttFraga({ lage: ALLA_GRUPPER, mina }).map((g) => g.id)).toEqual(["bolaget", "privat"]);
  });

  it("blir färre när filtret kryssat bort en", () => {
    expect(grupperAttFraga({ lage: ALLA_GRUPPER, mina, bortkryssade: ["bolaget"] }).map((g) => g.id)).toEqual(["privat"]);
  });

  it("är bara den valda, och filtret gäller inte där", () => {
    expect(grupperAttFraga({ lage: "bolaget", mina, bortkryssade: ["bolaget"] }).map((g) => g.id)).toEqual(["bolaget"]);
  });

  it("är tom när valet pekar på en grupp som inte längre är min", () => {
    expect(grupperAttFraga({ lage: "gammalt", mina })).toEqual([]);
  });
});

describe("navet", () => {
  const ramnav = [{ href: "/", label: "Idag" }, { href: "/sok", label: "Sök" }];
  const ekonomi = defineModule({
    id: "ekonomi",
    namn: { sv: "Ekonomi" },
    nav: [{ href: "/ekonomi", label: "Ekonomi" }],
    routes: [],
    samlingar: [],
    kallor: {},
    skapar: [],
  });

  it("visar bara ramverkets ytor i läget alla", () => {
    const { nav, saknade } = navForLage({ lage: ALLA_GRUPPER, ramnav, moduler: [ekonomi], mina: [BOLAGET] });
    expect(nav.map((p) => p.href)).toEqual(["/", "/sok"]);
    expect(saknade).toEqual([]);
  });

  it("lägger till gruppens moduler när en grupp är vald", () => {
    const { nav } = navForLage({ lage: "bolaget", ramnav, moduler: [ekonomi], mina: [BOLAGET] });
    expect(nav.map((p) => p.href)).toEqual(["/", "/sok", "/ekonomi"]);
  });

  it("skriver ut en modul gruppen pekar på men appen inte installerat", () => {
    const { nav, saknade } = navForLage({ lage: "bolaget", ramnav, moduler: [], mina: [BOLAGET] });
    expect(saknade).toEqual(["ekonomi"]);
    expect(nav.map((p) => p.href)).toEqual(["/", "/sok"]);
  });

  it("rör inte listan anroparen skickade in", () => {
    navForLage({ lage: "bolaget", ramnav, moduler: [ekonomi], mina: [BOLAGET] });
    expect(ramnav.map((p) => p.href)).toEqual(["/", "/sok"]);
  });
});

describe("att skapa kräver en vald grupp", () => {
  it("ger ingen grupp i läget alla", () => {
    expect(gruppenAttSkapaI(ALLA_GRUPPER)).toBe(null);
  });

  it("ger gruppen när en är vald", () => {
    expect(gruppenAttSkapaI("bolaget")).toBe("bolaget");
  });

  it("avvisar ett skapande utan grupp, i körtid och inte bara i typen", async () => {
    const kalla = createMemorySource({ rader: [] });
    await expect(gruppSkapa(kalla, "rader", /** @type {any} */ ({ titel: "utan grupp" }))).rejects.toThrow(/groupId krävs/);
  });

  it("stämplar gruppen på raden som skapas", async () => {
    const kalla = createMemorySource({ rader: [] });
    const rad = await gruppSkapa(kalla, "rader", /** @type {any} */ ({ titel: "med grupp", groupId: "bolaget" }));
    expect(/** @type {any} */ (rad).groupId).toBe("bolaget");
  });

  /*
   * ⛔ DET HÄR PROVET SAKNADES, OCH SVEPET VISADE DET. Mutationen som slutade
   * stämpla om gruppen överlevde, eftersom alla prov skickade in ett redan
   * städat id. Stämpeln gör en sak: den skriver tillbaka det TRIMMADE värdet.
   * Ett groupId med blanksteg matchar aldrig `memberships/{uid}_{groupId}`,
   * alltså blir följden en rad som skrivs och sedan inte går att läsa.
   */
  it("skriver tillbaka gruppen städad, så att den matchar medlemskapets nyckel", async () => {
    const kalla = createMemorySource({ rader: [] });
    const rad = await gruppSkapa(kalla, "rader", /** @type {any} */ ({ titel: "med mellanslag", groupId: "  bolaget  " }));
    expect(/** @type {any} */ (rad).groupId).toBe("bolaget");
  });
});

describe("frågan bär alltid sin grupp", () => {
  it("avvisar en fråga utan groupId", async () => {
    const kalla = createMemorySource({ rader: [] });
    await expect(gruppLista(kalla, "rader", /** @type {any} */ ({ sortBy: "datum" }))).rejects.toThrow(/groupId krävs/);
  });

  it("lägger gruppen i where och kan inte skrivas över av anroparen", async () => {
    const list = vi.fn(async () => []);
    const kalla = /** @type {any} */ ({ list });
    await gruppLista(kalla, "rader", { groupId: "bolaget", where: { groupId: "privat", status: "oppen" } });
    expect(list).toHaveBeenCalledWith("rader", { where: { status: "oppen", groupId: "bolaget" }, sortBy: undefined, direction: undefined, limit: undefined });
  });

  it("läser bara den grupp som frågades", async () => {
    const kalla = createMemorySource({
      rader: [
        { id: "a", groupId: "bolaget", titel: "A" },
        { id: "b", groupId: "privat", titel: "B" },
      ],
    });
    const rader = await gruppLista(kalla, "rader", { groupId: "bolaget" });
    expect(rader.map((r) => r.id)).toEqual(["a"]);
  });
});

describe("sammanslagningen", () => {
  const kalla = () =>
    createMemorySource({
      rader: [
        { id: "a1", groupId: "bolaget", datum: "2026-09-01" },
        { id: "a2", groupId: "bolaget", datum: "2026-09-03" },
        { id: "b1", groupId: "privat", datum: "2026-09-02" },
        { id: "c1", groupId: "tredje", datum: "2026-09-04" },
      ],
    });
  const TREDJE = grupp("tredje", "Tredje");

  it("frågar en gång per grupp, inte en gång för allihop", async () => {
    const inre = kalla();
    const list = vi.fn(inre.list);
    await listaPerGrupp(/** @type {any} */ ({ ...inre, list }), "rader", [BOLAGET, PRIVAT, TREDJE]);
    expect(list).toHaveBeenCalledTimes(3);
    expect(list.mock.calls.map((c) => /** @type {any} */ (c[1]).where.groupId)).toEqual(["bolaget", "privat", "tredje"]);
  });

  it("skickar med taket i varje delfråga, så att tre grupper inte hämtar trettio rader för tio", async () => {
    const inre = kalla();
    const list = vi.fn(inre.list);
    await listaPerGrupp(/** @type {any} */ ({ ...inre, list }), "rader", [BOLAGET, PRIVAT, TREDJE], { sortBy: "datum", limit: 2 });
    expect(list.mock.calls.map((c) => /** @type {any} */ (c[1]).limit)).toEqual([2, 2, 2]);
  });

  it("slår ihop tre grupper och märker varje rad med sin", async () => {
    const rader = await listaPerGrupp(kalla(), "rader", [BOLAGET, PRIVAT, TREDJE], { sortBy: "datum" });
    expect(rader.map((r) => r.id)).toEqual(["a1", "b1", "a2", "c1"]);
    expect(rader.map((r) => r.gruppmarke.id)).toEqual(["bolaget", "privat", "bolaget", "tredje"]);
  });

  it("tar bort en grupp ur vyn när filtret kryssat bort den", async () => {
    const grupper = grupperAttFraga({ lage: ALLA_GRUPPER, mina: [BOLAGET, PRIVAT, TREDJE], bortkryssade: ["privat"] });
    const rader = await listaPerGrupp(kalla(), "rader", grupper, { sortBy: "datum" });
    expect(rader.map((r) => r.id)).toEqual(["a1", "a2", "c1"]);
  });

  it("lägger taket på det ihopslagna och inte på varje delfråga", async () => {
    const rader = await listaPerGrupp(kalla(), "rader", [BOLAGET, PRIVAT, TREDJE], { sortBy: "datum", limit: 2 });
    expect(rader.map((r) => r.id)).toEqual(["a1", "b1"]);
  });

  it("avvisar en rad som redan bär ett gruppmarke", () => {
    expect(() => slaIhopSvar([{ grupp: BOLAGET, rader: [{ id: "x", gruppmarke: { id: "privat", namn: { sv: "Privat" } } }] }])).toThrow(/bär redan gruppmarke/);
  });

  it("räknar rader per grupp och skriver ut nollan", async () => {
    const grupper = [BOLAGET, PRIVAT, TREDJE];
    const rader = await listaPerGrupp(kalla(), "rader", grupperAttFraga({ lage: ALLA_GRUPPER, mina: grupper, bortkryssade: ["privat"] }), {});
    expect(raderPerGrupp(rader, grupper)).toEqual({ bolaget: 2, privat: 0, tredje: 1 });
  });
});

describe("gruppväljaren", () => {
  function rendera(extra = {}) {
    const onValj = vi.fn();
    const ut = render(<OpsGruppvaljare grupper={[BOLAGET, PRIVAT]} aktiv={ALLA_GRUPPER} onValj={onValj} {...extra} />);
    return { onValj, ...ut };
  }

  it("visar alla mina grupper plus alla", () => {
    rendera();
    expect(screen.getByRole("button", { name: /Alla grupper/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Bolaget/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Privat/ })).toBeTruthy();
  });

  it("märker ut den aktiva med aria-current och inte bara med en färg", () => {
    rendera({ aktiv: "privat" });
    expect(screen.getByRole("button", { name: /Privat/ }).getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("button", { name: /Alla grupper/ }).getAttribute("aria-current")).toBe(null);
  });

  it("byter grupp när raden trycks", () => {
    const { onValj } = rendera();
    fireEvent.click(screen.getByRole("button", { name: /Bolaget/ }));
    expect(onValj).toHaveBeenCalledWith("bolaget");
  });

  it("skriver ut tomheten i stället för en rubrik utan rader", () => {
    rendera({ grupper: [] });
    expect(screen.getByText(/inte medlem i någon grupp/)).toBeTruthy();
  });

  it("kastar utan onValj, i stället för att rita en kontroll som inte gör något", () => {
    expect(() => render(<OpsGruppvaljare grupper={[]} aktiv={ALLA_GRUPPER} onValj={/** @type {any} */ (undefined)} />)).toThrow(/onValj krävs/);
  });
});

describe("gruppfiltret", () => {
  function rendera(extra = {}) {
    const onAndra = vi.fn();
    const ut = render(<OpsGruppfilter grupper={[BOLAGET, PRIVAT]} bortkryssade={[]} onAndra={onAndra} {...extra} />);
    return { onAndra, ...ut };
  }

  it("visar vilka som är med i vyn med aria-pressed", () => {
    rendera({ bortkryssade: ["privat"] });
    expect(screen.getByRole("button", { name: /Bolaget/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /Privat/ }).getAttribute("aria-pressed")).toBe("false");
  });

  it("kryssar bort en grupp", () => {
    const { onAndra } = rendera();
    fireEvent.click(screen.getByRole("button", { name: /Bolaget/ }));
    expect(onAndra).toHaveBeenCalledWith(["bolaget"]);
  });

  it("kryssar tillbaka en grupp", () => {
    const { onAndra } = rendera({ bortkryssade: ["bolaget", "privat"] });
    fireEvent.click(screen.getByRole("button", { name: /Privat/ }));
    expect(onAndra).toHaveBeenCalledWith(["bolaget"]);
  });

  it("skriver ut antalet, också när det är noll", () => {
    rendera({ antal: { bolaget: 2, privat: 0 } });
    expect(screen.getByRole("button", { name: /Privat/ }).textContent).toContain("0");
  });
});

describe("märket på raden", () => {
  it("skriver ut gruppens namn och inte bara initialerna", () => {
    render(<OpsGruppmarke gruppmarke={{ id: "bolaget", namn: { sv: "Bolaget" } }} />);
    expect(screen.getAllByText("Bolaget").length).toBeGreaterThan(0);
  });

  it("kastar utan märke, eftersom en omärkt rad i läget alla är oläsbar", () => {
    expect(() => render(<OpsGruppmarke gruppmarke={/** @type {any} */ (null)} />)).toThrow(/gruppmarke krävs/);
  });
});
