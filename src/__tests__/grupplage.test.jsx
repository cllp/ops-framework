import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { aktivGrupp, grupplagetsNyckel, lasAktivGrupp, minaGrupper, navForGrupp, sparaAktivGrupp } from "../lib/grupplage.js";
import * as index from "../index.js";
import { gruppLista, gruppSkapa } from "../data/gruppkalla.js";
import { createMemorySource } from "../data/adapters.js";
import { defineModule } from "../lib/modul.js";
import { OpsGruppvaljare } from "../components/OpsGruppvaljare.jsx";

/**
 * Fas 2.5 i epiken #92 (#139), och sedan 0.35.0 (#190) utan läget "Alla mina grupper"
 * och utan läsning över flera grupper.
 *
 * ⛔ BESLUTEN PROVAS DÄR DE BOR, ALLTSÅ I RENA FUNKTIONER. Lärdomen från
 * #138: ett prov som trycker på en Radix-popover i jsdom blir grönt av att
 * ingenting hände. Väljaren är därför vanliga knappar, och proven trycker på
 * dem på riktigt.
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

  it("en grupp som heter alla är en grupp bland andra (0.35.0: det finns inget läge att krocka med)", () => {
    expect(minaGrupper([medlem("alla")], [grupp("alla", "Alla")]).map((g) => g.id)).toEqual(["alla"]);
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

  it("avvisar tomt, eftersom det alltid finns exakt en aktiv grupp", () => {
    expect(() => sparaAktivGrupp("uid-1", "", { getItem: () => null, setItem: () => {} })).toThrow(/groupId krävs/);
  });
});

describe("den aktiva gruppen (0.35.0, #190)", () => {
  const mina = [BOLAGET, PRIVAT];

  it("behåller en grupp jag fortfarande är med i", () => {
    expect(aktivGrupp("privat", mina)).toBe("privat");
  });

  it("blir den första av mina grupper när medlemskapet tagit slut", () => {
    expect(aktivGrupp("gammalt", mina)).toBe("bolaget");
  });

  it("blir den första av mina grupper när ingenting är sparat", () => {
    expect(aktivGrupp(null, mina)).toBe("bolaget");
    expect(aktivGrupp("  ", mina)).toBe("bolaget");
  });

  /*
   * ⛔ ETT SPARAT "alla" FRÅN EN VERSION FÖRE 0.35.0. Det ligger i localStorage
   * hos var och en som valde läget, och uppgraderingen får varken kasta eller ge
   * ett tomt läge: den ger den första av personens grupper.
   */
  it("⛔ ett sparat \"alla\" från en tidigare version blir den första gruppen, inte ett fel och inte tomt", () => {
    /** @type {Record<string, string>} */
    const bak = { [grupplagetsNyckel("uid-1")]: "alla" };
    const lagring = { getItem: (/** @type {string} */ n) => bak[n] ?? null, setItem: (/** @type {string} */ n, /** @type {string} */ v) => { bak[n] = v; } };
    const sparat = lasAktivGrupp("uid-1", lagring);
    expect(sparat).toBe("alla");
    const aktiv = aktivGrupp(sparat, mina);
    expect(aktiv).toBe("bolaget");
    expect(aktiv).not.toBe(null);
    expect(aktiv).not.toBe("");
  });

  it("är null bara när jag inte har någon grupp alls, och det är det enda tillståndet utan aktiv grupp", () => {
    expect(aktivGrupp("alla", [])).toBe(null);
    expect(aktivGrupp("bolaget", [])).toBe(null);
  });
});

describe("⛔ läget \"Alla mina grupper\" och läsningen över flera grupper finns inte i paketets yta (0.35.0, #190)", () => {
  it("exporterna som bar läget är borta, och ersättarna finns", () => {
    const yta = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (index));
    for (const borta of ["ALLA_GRUPPER", "valtLage", "navForLage", "gruppenAttSkapaI", "raderPerGrupp", "OpsGruppfilter", "grupperAttFraga", "slaIhopSvar", "listaPerGrupp", "OpsGruppmarke"]) {
      expect(yta[borta], borta).toBeUndefined();
    }
    for (const kvar of ["aktivGrupp", "navForGrupp", "medAktivGrupp", "gruppLista", "gruppSkapa"]) {
      expect(typeof yta[kvar], kvar).toBe("function");
    }
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

  it("visar bara ramverkets ytor när jag inte har någon grupp", () => {
    const { nav, saknade } = navForGrupp({ groupId: null, ramnav, moduler: [ekonomi], mina: [] });
    expect(nav.map((p) => p.href)).toEqual(["/", "/sok"]);
    expect(saknade).toEqual([]);
  });

  it("lägger till gruppens moduler när en grupp är vald", () => {
    const { nav } = navForGrupp({ groupId: "bolaget", ramnav, moduler: [ekonomi], mina: [BOLAGET] });
    expect(nav.map((p) => p.href)).toEqual(["/", "/sok", "/ekonomi"]);
  });

  it("skriver ut en modul gruppen pekar på men appen inte installerat", () => {
    const { nav, saknade } = navForGrupp({ groupId: "bolaget", ramnav, moduler: [], mina: [BOLAGET] });
    expect(saknade).toEqual(["ekonomi"]);
    expect(nav.map((p) => p.href)).toEqual(["/", "/sok"]);
  });

  it("rör inte listan anroparen skickade in", () => {
    navForGrupp({ groupId: "bolaget", ramnav, moduler: [ekonomi], mina: [BOLAGET] });
    expect(ramnav.map((p) => p.href)).toEqual(["/", "/sok"]);
  });
});

describe("att skapa kräver en grupp", () => {
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

describe("gruppväljaren", () => {
  function rendera(extra = {}) {
    const onValj = vi.fn();
    const ut = render(<OpsGruppvaljare grupper={[BOLAGET, PRIVAT]} aktiv="bolaget" onValj={onValj} {...extra} />);
    return { onValj, ...ut };
  }

  it("visar mina grupper och ingen rad för alla (0.35.0)", () => {
    rendera();
    expect(screen.getByRole("button", { name: /Bolaget/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Privat/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Alla/ })).toBe(null);
    expect(screen.getAllByRole("button").length).toBe(2);
  });

  it("märker ut den aktiva med aria-current och inte bara med en färg", () => {
    rendera({ aktiv: "privat" });
    expect(screen.getByRole("button", { name: /Privat/ }).getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("button", { name: /Bolaget/ }).getAttribute("aria-current")).toBe(null);
  });

  it("byter grupp när raden trycks", () => {
    const { onValj } = rendera();
    fireEvent.click(screen.getByRole("button", { name: /Privat/ }));
    expect(onValj).toHaveBeenCalledWith("privat");
  });

  it("skriver ut tomheten i stället för en rubrik utan rader", () => {
    rendera({ grupper: [] });
    expect(screen.getByText(/inte medlem i någon grupp/)).toBeTruthy();
  });

  it("kastar utan onValj, i stället för att rita en kontroll som inte gör något", () => {
    expect(() => render(<OpsGruppvaljare grupper={[]} aktiv="bolaget" onValj={/** @type {any} */ (undefined)} />)).toThrow(/onValj krävs/);
  });
});
