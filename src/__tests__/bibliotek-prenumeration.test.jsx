import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createBibliotekskalla } from "../data/bibliotekkalla.js";

/*
 * En ny post syns direkt (cllp/ops-framework#403, 0.114.0).
 *
 * CP 2026-10-17: efter en röstinspelning i biblioteket syntes inspelningen inte förrän han laddat om. "Jag skulle vilja att den dök
 * upp direkt." Rotorsaken, läst i koden: `createBibliotekskalla` hade bara `las()`, en engångsläsning, och listan prenumererade inte.
 * Inspelningen sparas av en annan källa (appens `sparaTillBiblioteket`), och ingenting sade åt listan att läsa om.
 *
 * ⛔ DEN STRÖMMANDE KÄLLAN HÄR ÄR ETT MINNE MED `subscribe`. `createMemorySource` strömmar inte (en JSON-fil kan inte pusha, och
 * minnet är bara ett prov), så provet lägger prenumerationen runt den: varje skrivning meddelar lyssnarna med de rader frågan nu ger.
 * Det mäter bibliotekskällan och vyn mot kontraktet i `contract.js`, inte Firestore.
 */

const skapare = () => ({ uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" });
const anteckning = (/** @type {string} */ id, /** @type {string} */ rubrik) => ({ id, groupId: "cps-ab", typ: "anteckning", rubrik, text: "Text.", skapadAv: skapare(), skapad: 1, andrad: 1 });

/**
 * @param {Record<string, any[]>} [seed]
 * @param {{ canSubscribe?: (c: string) => boolean }} [val]
 */
function stromKalla(seed = {}, val = {}) {
  const bas = createMemorySource(seed);
  /** @type {Set<{ coll: string, fraga: any, lyssnare: { onData: (r: any[]) => void, onError: (e: Error) => void } }>} */
  const lyssnare = new Set();
  const meddela = async () => {
    for (const l of [...lyssnare]) l.lyssnare.onData(await bas.list(l.coll, l.fraga));
  };
  const source = {
    ...bas,
    create: async (/** @type {string} */ c, /** @type {any} */ d) => {
      const r = await bas.create(c, d);
      await meddela();
      return r;
    },
    update: async (/** @type {string} */ c, /** @type {string} */ id, /** @type {any} */ d) => {
      const r = await bas.update(c, id, d);
      await meddela();
      return r;
    },
    remove: async (/** @type {string} */ c, /** @type {string} */ id) => {
      await bas.remove(c, id);
      await meddela();
    },
    subscribe: vi.fn((/** @type {string} */ coll, /** @type {any} */ fraga, /** @type {any} */ l) => {
      const post = { coll, fraga, lyssnare: l };
      lyssnare.add(post);
      void bas.list(coll, fraga).then((rader) => lyssnare.has(post) && l.onData(rader));
      return () => lyssnare.delete(post);
    }),
    ...(val.canSubscribe ? { canSubscribe: val.canSubscribe } : {}),
  };
  return { source, antalLyssnare: () => lyssnare.size, lyssnare };
}

const flush = () =>
  act(async () => {
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
  });

describe("createBibliotekskalla.prenumerera", () => {
  it("finns bara när datakällan har subscribe, och en routande källa som inte strömmar samlingen räknas som utan", () => {
    const med = stromKalla();
    expect(typeof createBibliotekskalla({ source: med.source, collection: "bibliotek", groupId: "cps-ab", skapare }).prenumerera).toBe("function");
    const utan = createMemorySource();
    expect("prenumerera" in createBibliotekskalla({ source: utan, collection: "bibliotek", groupId: "cps-ab", skapare })).toBe(false);
    const nej = stromKalla({}, { canSubscribe: () => false });
    expect("prenumerera" in createBibliotekskalla({ source: nej.source, collection: "bibliotek", groupId: "cps-ab", skapare })).toBe(false);
    const ja = stromKalla({}, { canSubscribe: (c) => c === "bibliotek" });
    expect(typeof createBibliotekskalla({ source: ja.source, collection: "bibliotek", groupId: "cps-ab", skapare }).prenumerera).toBe("function");
  });

  it("⛔ en rad som skrivs i källan efter första leveransen kommer som en ny leverans, utan omläsning", async () => {
    const { source } = stromKalla({ bibliotek: [anteckning("a", "Första")] });
    const kalla = createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare });
    const svar = /** @type {any[]} */ ([]);
    const avreg = /** @type {() => void} */ (kalla.prenumerera)((s) => svar.push(s), () => {});
    await flush();
    expect(svar).toHaveLength(1);
    expect(svar[0].poster.map((/** @type {any} */ p) => p.rubrik)).toEqual(["Första"]);
    expect(svar[0]).toMatchObject({ kalla: "databas", fel: null, trasiga: [] });

    // En annan källa skriver (appens inspelning). Ingen `las()` har anropats.
    // Spionen sätts efter första leveransen: noll anrop till `source.list` därefter betyder att inget läste om (ingen `las()`).
    const listaFore = vi.spyOn(source, "list");
    await createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare }).spara({ typ: "anteckning", rubrik: "Inspelning", text: "Ny." });
    await flush();
    expect(svar).toHaveLength(2);
    expect(svar[1].poster.map((/** @type {any} */ p) => p.rubrik).sort()).toEqual(["Första", "Inspelning"]);
    expect(listaFore.mock.calls.filter((c) => c[0] === "bibliotek")).toHaveLength(0);
    avreg();
  });

  it("⛔ samma kontroll per rad som las(): en trasig rad och en rad från en annan grupp hamnar i trasiga, inte i poster", async () => {
    const rader = [
      anteckning("ok", "Hel"),
      { id: "halv", groupId: "cps-ab", typ: "anteckning", rubrik: "Halv" },
      { ...anteckning("annan", "Deras"), groupId: "miranda-ab" },
    ];
    // En källa som släpper igenom allt, som i testet av `las()`: kontrollen ska sitta i kallan och inte i källans fråga.
    const source = { list: async () => rader, read: async () => null, create: async () => ({ id: "n" }), update: async () => {}, subscribe: (/** @type {string} */ _c, /** @type {any} */ _f, /** @type {any} */ l) => { l.onData(rader); return () => {}; } };
    const kalla = createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare });
    const fran = await kalla.las();
    const svar = /** @type {any[]} */ ([]);
    /** @type {() => void} */ (kalla.prenumerera)((s) => svar.push(s), () => {})();
    expect(svar[0].poster.map((/** @type {any} */ p) => p.id)).toEqual(["ok"]);
    expect(svar[0].trasiga.map((/** @type {any} */ t) => t.id).sort()).toEqual(["annan", "halv"]);
    expect(svar[0]).toEqual(fran);
  });

  it("⛔ ett fel går till onFel och försvinner aldrig tyst: källans onError, ett kast vid öppnandet, och en leverans som inte går att bygga", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { source, lyssnare } = stromKalla();
      const kalla = createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare });
      const fel = /** @type {Error[]} */ ([]);
      const svar = /** @type {any[]} */ ([]);
      const avreg = /** @type {() => void} */ (kalla.prenumerera)((s) => svar.push(s), (e) => fel.push(e));
      await flush();
      [...lyssnare][0].lyssnare.onError(new Error("Nekad av reglerna."));
      expect(fel.map((e) => e.message)).toEqual(["Nekad av reglerna."]);
      // Ett kast som inte är en Error blir en Error.
      [...lyssnare][0].lyssnare.onError(/** @type {any} */ ("sträng"));
      expect(fel[1]).toBeInstanceOf(Error);
      // En leverans som inte är en lista går till onFel och inte till lyssnaren.
      [...lyssnare][0].lyssnare.onData(/** @type {any} */ (null));
      expect(fel).toHaveLength(3);
      expect(svar).toHaveLength(1);
      avreg();

      const kastar = { ...source, subscribe: () => { throw new Error("Kunde inte öppna strömmen."); } };
      const fel2 = /** @type {Error[]} */ ([]);
      const av2 = /** @type {() => void} */ (createBibliotekskalla({ source: kastar, collection: "bibliotek", groupId: "cps-ab", skapare }).prenumerera)(() => {}, (e) => fel2.push(e));
      expect(fel2.map((e) => e.message)).toEqual(["Kunde inte öppna strömmen."]);
      expect(() => av2()).not.toThrow();
    } finally {
      konsol.mockRestore();
    }
  });

  it("kräver lyssnare och onFel: utan felväg hade vyn fortsatt visa en gammal lista", () => {
    const { source } = stromKalla();
    const kalla = createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare });
    expect(() => /** @type {any} */ (kalla.prenumerera)(() => {})).toThrow(/onFel krävs/);
    expect(() => /** @type {any} */ (kalla.prenumerera)(undefined, () => {})).toThrow(/lyssnare krävs/);
  });

  it("avregistreringen stänger källans prenumeration, tål att anropas flera gånger, och efter den kommer inget mer", async () => {
    const { source, antalLyssnare } = stromKalla();
    const kalla = createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare });
    const svar = /** @type {any[]} */ ([]);
    const avreg = /** @type {() => void} */ (kalla.prenumerera)((s) => svar.push(s), () => {});
    await flush();
    expect(antalLyssnare()).toBe(1);
    avreg();
    avreg();
    expect(antalLyssnare()).toBe(0);
    await kalla.spara({ typ: "anteckning", rubrik: "Efter", text: "x" });
    await flush();
    expect(svar).toHaveLength(1);
  });

  it("frågan är gruppens: where groupId, som las()", async () => {
    const { source } = stromKalla();
    const kalla = createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare });
    /** @type {() => void} */ (kalla.prenumerera)(() => {}, () => {})();
    expect(source.subscribe).toHaveBeenCalledWith("bibliotek", { where: { groupId: "cps-ab" } }, expect.any(Object));
  });
});

/** @param {Partial<Parameters<typeof OpsBibliotek>[0]>} extra */
function Vy(extra) {
  return (
    <OpsBibliotek
      jag={{ uid: "uid-1", roll: "medlem" }}
      hubHref="/hub"
      vald={null}
      skapar={null}
      onOppna={() => {}}
      onStang={() => {}}
      onSkapa={() => {}}
      onSpara={() => {}}
      {...extra}
    />
  );
}

describe("OpsBibliotek med kalla", () => {
  it("⛔ en rad som skrivs i källan efter att listan ritats syns utan omladdning", async () => {
    const { source } = stromKalla({ bibliotek: [anteckning("a", "Protokoll")] });
    const kalla = createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare });
    await act(async () => {
      render(<Vy kalla={kalla} />);
    });
    await flush();
    expect(screen.getByRole("button", { name: "Protokoll" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Inspelning 14:03" })).toBeNull();

    // Appens inspelning skriver via en annan källa.
    await act(async () => {
      await createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare }).spara({ typ: "anteckning", rubrik: "Inspelning 14:03", text: "Ny." });
    });
    await flush();
    expect(screen.getByRole("button", { name: "Inspelning 14:03" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Protokoll" })).toBeInTheDocument();
  });

  it("⛔ utan subscribe läser vyn med las() en gång och fungerar som förut", async () => {
    const source = createMemorySource({ bibliotek: [anteckning("a", "Protokoll")] });
    const kalla = createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare });
    const las = vi.spyOn(kalla, "las");
    await act(async () => {
      render(<Vy kalla={kalla} />);
    });
    await flush();
    expect(screen.getByRole("button", { name: "Protokoll" })).toBeInTheDocument();
    expect(las).toHaveBeenCalledTimes(1);
    // Ingen polling: en rad som skrivs efteråt syns inte av sig själv.
    await kalla.spara({ typ: "anteckning", rubrik: "Senare", text: "x" });
    await flush();
    expect(screen.queryByRole("button", { name: "Senare" })).toBeNull();
    expect(las).toHaveBeenCalledTimes(1);
  });

  it("⛔ ett fel i strömmen står i vyn och försvinner inte tyst, och nästa lyckade leverans tar bort det", async () => {
    const { source, lyssnare } = stromKalla({ bibliotek: [anteckning("a", "Protokoll")] });
    const kalla = createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare });
    await act(async () => {
      render(<Vy kalla={kalla} />);
    });
    await flush();
    act(() => [...lyssnare][0].lyssnare.onError(new Error("Strömmen föll.")));
    expect(screen.getByRole("alert")).toHaveTextContent("Strömmen föll.");
    await act(async () => {
      await createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare }).spara({ typ: "anteckning", rubrik: "Efter felet", text: "x" });
    });
    await flush();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Efter felet" })).toBeInTheDocument();
  });

  it("prenumerationen stängs när vyn lämnas", async () => {
    const { source, antalLyssnare } = stromKalla();
    const kalla = createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare });
    /** @type {import("@testing-library/react").RenderResult} */
    let ritad;
    await act(async () => {
      ritad = render(<Vy kalla={kalla} />);
    });
    const { unmount } = /** @type {any} */ (ritad);
    await flush();
    expect(antalLyssnare()).toBe(1);
    unmount();
    expect(antalLyssnare()).toBe(0);
  });

  it("kalla och poster tillsammans kastar, och varken kalla eller poster kastar", () => {
    const { source } = stromKalla();
    const kalla = createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare });
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<Vy kalla={kalla} poster={[]} />)).toThrow(/kan inte ges tillsammans/);
      expect(() => render(<Vy />)).toThrow(/poster krävs, eller kalla/);
    } finally {
      konsol.mockRestore();
    }
  });
});
