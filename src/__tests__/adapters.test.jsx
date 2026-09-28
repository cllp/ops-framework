import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createMemorySource } from "../data/adapters.js";
import { createFirestoreSource } from "../data/firestore.js";
import { createPostgresSource } from "../data/postgres.js";
import { OpsAuthGate, OpsAuthProvider, createAuth, createGoogleAuth } from "../auth/auth.jsx";

/**
 * ⛔ Adaptrarna testas mot en INJICERAD attrapp, inte mot en riktig databas.
 *
 * Det är inte en genväg, det är hela poängen med att ramverket inte importerar
 * någon SDK: översättningen från CRUD till anrop går att prova utan att någon
 * behöver en Firestore-instans eller en Postgres igång. Det som INTE testas här
 * är att den riktiga databasen beter sig som attrappen, och det ska provas mot
 * en emulator i appen.
 */

function fakeFirestore() {
  const request = [];
  const sdk = {
    collection: (_db, s) => ({ __samling: s }),
    doc: (_db, s, id) => ({ __samling: s, __id: id }),
    getDoc: vi.fn(async (ref) => ({ exists: () => ref.__id !== "saknas", id: ref.__id, data: () => ({ name: "Telia" }) })),
    getDocs: vi.fn(async () => ({ docs: [{ id: "1", data: () => ({ name: "Telia" }) }] })),
    addDoc: vi.fn(async () => ({ id: "nytt" })),
    setDoc: vi.fn(async () => {}),
    updateDoc: vi.fn(async () => {}),
    deleteDoc: vi.fn(async () => {}),
    query: (base, ...conditions) => ({ base, conditions }),
    where: (f, op, v) => ({ kind: "where", f, op, v }),
    orderBy: (f, r) => ({ kind: "orderBy", f, r }),
    limit: (n) => ({ kind: "limit", n }),
    // ⛔ Tillagd när adaptern fick `subscribe` (#133). Den hör hit och inte i
    // en uppmjukning av uppstartskontrollen: adaptern LOVAR att kunna
    // prenumerera, alltså behöver den funktionen. Att i stället ta bort
    // `onSnapshot` ur kraven hade gjort testet grönt genom att ta bort kravet
    // det testar. Prenumerationens eget beteende provas i realtid.test.jsx.
    onSnapshot: vi.fn(() => () => {}),
  };
  return { sdk, request };
}

describe("firestore-adaptern", () => {
  it("vägrar en ofullständig sdk vid uppstart, inte vid första anropet", () => {
    expect(() => createFirestoreSource({ db: {}, sdk: { collection: () => {} } })).toThrow(/sdk saknar/);
  });

  it("skiljer ett dokument som saknas från ett som är tomt", async () => {
    const { sdk } = fakeFirestore();
    const source = createFirestoreSource({ db: {}, sdk });
    expect(await source.read("kostnader", "saknas")).toBeNull();
    expect(await source.read("kostnader", "1")).toMatchObject({ id: "1", name: "Telia" });
  });

  it("översätter en fråga till where, orderBy och limit", async () => {
    const { sdk } = fakeFirestore();
    const source = createFirestoreSource({ db: {}, sdk });
    await source.list("kostnader", { where: { status: "oppen" }, sortBy: "belopp", direction: "desc", limit: 5 });

    const skickat = sdk.getDocs.mock.calls[0][0];
    expect(skickat.conditions).toEqual([
      { kind: "where", f: "status", op: "==", v: "oppen" },
      { kind: "orderBy", f: "belopp", r: "desc" },
      { kind: "limit", n: 5 },
    ]);
  });

  // ⛔ setDoc skriver över utan att säga ifrån. Skillnaden mot addDoc måste
  // styras av om anroparen gav ett id, inte av slump.
  it("använder addDoc utan id och setDoc med id", async () => {
    const { sdk } = fakeFirestore();
    const source = createFirestoreSource({ db: {}, sdk });

    expect(await source.create("k", { name: "A" })).toMatchObject({ id: "nytt" });
    expect(sdk.addDoc).toHaveBeenCalledOnce();

    expect(await source.create("k", { id: "eget", name: "B" })).toMatchObject({ id: "eget" });
    expect(sdk.setDoc).toHaveBeenCalledOnce();
  });

  // ⛔ Läser tillbaka i stället för att gissa: servertidsstämplar och regler kan
  // ändra värdet, och då stämmer inte appens objekt med databasen.
  it("läser tillbaka efter uppdatering", async () => {
    const { sdk } = fakeFirestore();
    const source = createFirestoreSource({ db: {}, sdk });
    await source.update("k", "1", { name: "Nytt" });
    expect(sdk.getDoc).toHaveBeenCalled();
  });
});

describe("minneskällan svarar som Firestore på samma anrop", () => {
  /*
   * ⛔ DE TVÅ MÅSTE VARA ÖVERENS, och det är inte en smaksak. Minneskällan
   * finns för att stå in för den riktiga i prov och i utveckling. Svarar den
   * annorlunda på samma anrop mäter provsviten en app som inte finns.
   *
   * Mätt i cllp/bolag-ops 2026-09-27: inställningsvyn sparar en kategori med
   * `create` och kategorins eget id. Firestore gör `setDoc`, alltså skriver
   * över. Minnet la till en ANDRA rad med samma id, så `list()` gav två poster
   * och `find(r => r.id === x)` svarade med den gamla. Provet var rött mot en
   * app som var rätt, och nästa gång hade det lika gärna kunnat vara grönt mot
   * en app som var fel.
   */
  it("⛔ create med ett EGET id ersätter, precis som setDoc", async () => {
    const source = createMemorySource({ k: [{ id: "eget", name: "A" }] });

    await source.create("k", { id: "eget", name: "B" });

    const rader = await source.list("k");
    expect(rader).toHaveLength(1);
    expect(rader[0]).toMatchObject({ id: "eget", name: "B" });
  });

  it("⛔ och ersättningen är hel, den slås inte ihop med den gamla raden", async () => {
    /*
     * `setDoc` utan merge ersätter dokumentet. En sammanslagning här hade dolt
     * en bugg där appen skickar en delmängd: den hade fungerat i provet och
     * tappat fält i produktionen. Det är `update` som slår ihop, och de två
     * ska inte likna varandra.
     */
    const source = createMemorySource({ k: [{ id: "eget", name: "A", extra: "kvar?" }] });

    await source.create("k", { id: "eget", name: "B" });

    const rader = await source.list("k");
    expect(rader[0].extra).toBeUndefined();
  });

  it("utan id skapas en ny post, precis som addDoc", async () => {
    const source = createMemorySource({ k: [{ id: "eget", name: "A" }] });

    const skapad = await source.create("k", { name: "B" });

    expect(skapad.id).toBeTruthy();
    expect(skapad.id).not.toBe("eget");
    expect(await source.list("k")).toHaveLength(2);
  });

  it("⛔ update kräver fortfarande att raden finns, och create gör inte det", async () => {
    // De två operationerna svarar på olika frågor. En uppdatering av något som
    // saknas är ett fel; en skapelse med ett bestämt id är en seedning.
    const source = createMemorySource({});
    await expect(source.update("k", "saknas", { name: "A" })).rejects.toThrow(/finns inte/);
    await expect(source.create("k", { id: "saknas", name: "A" })).resolves.toMatchObject({ id: "saknas" });
  });
});

describe("postgres-adaptern", () => {
  const spion = () => vi.fn(async () => [{ id: "1", name: "Telia" }]);

  // ⛔ SÄKERHETSKRITISKT. Tabell- och kolumnnamn kan inte skickas som
  // parametrar, så de hamnar i SQL-texten. Ett namn som slipper igenom är en
  // väg in för injektion, och en injektion som fungerar syns inte i något test
  // som inte letar efter den.
  it("vägrar tabellnamn som inte är rena identifierare", async () => {
    const source = createPostgresSource({ query: spion() });
    await expect(source.list('kostnader"; DROP TABLE users; --')).rejects.toThrow(/duger inte som tabell/);
    await expect(source.list("kostnader", { where: { "a; DELETE FROM x": 1 } })).rejects.toThrow(/duger inte som tabell/);
    await expect(source.list("kostnader", { sortBy: "1 OR 1=1" })).rejects.toThrow(/duger inte som tabell/);
  });

  it("skickar värden som parametrar, aldrig som text", async () => {
    const query = spion();
    const source = createPostgresSource({ query });
    await source.list("kostnader", { where: { status: "oppen" }, limit: 10 });

    const [sql, params] = query.mock.calls[0];
    expect(sql).toBe('SELECT * FROM "kostnader" WHERE "status" = $1 LIMIT $2');
    expect(params).toEqual(["oppen", 10]);
    expect(sql).not.toContain("oppen");
  });

  it("använder RETURNING i stället för att gissa resultatet", async () => {
    const query = spion();
    const source = createPostgresSource({ query });
    await source.create("kostnader", { name: "Telia" });
    expect(query.mock.calls[0][0]).toContain("RETURNING *");
  });

  // ⛔ Noll rader betyder att posten inte fanns. Att returnera undefined hade
  // låtit anropsstället tro att uppdateringen lyckades.
  it("kastar när ingen rad träffades", async () => {
    const source = createPostgresSource({ query: vi.fn(async () => []) });
    await expect(source.update("k", "1", { name: "x" })).rejects.toThrow(/Ingen rad uppdaterades/);
    await expect(source.remove("k", "1")).rejects.toThrow(/Ingen rad togs bort/);
  });
});

describe("inloggning", () => {
  /** @param {{ id: string, role?: string } | null} user */
  function fakeAuth(user) {
    return createAuth({
      signIn: async () => {},
      signOut: async () => {},
      subscribe: (l) => {
        l(user);
        return () => {};
      },
    });
  }

  it("visar inloggning när ingen är inloggad", async () => {
    render(
      <OpsAuthProvider authentication={fakeAuth(null)}>
        <OpsAuthGate>
          <p>hemligt</p>
        </OpsAuthGate>
      </OpsAuthProvider>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: /Logga in med Google/ })).toBeInTheDocument());
    expect(screen.queryByText("hemligt")).not.toBeInTheDocument();
  });

  it("släpper in den som är inloggad", async () => {
    render(
      <OpsAuthProvider authentication={fakeAuth({ id: "u1" })}>
        <OpsAuthGate>
          <p>hemligt</p>
        </OpsAuthGate>
      </OpsAuthProvider>,
    );
    await waitFor(() => expect(screen.getByText("hemligt")).toBeInTheDocument());
  });

  it("nekar den som är inloggad men saknar rollen", async () => {
    render(
      <OpsAuthProvider authentication={fakeAuth({ id: "u1", role: "lasare" })}>
        <OpsAuthGate allowedRoles={["admin"]}>
          <p>hemligt</p>
        </OpsAuthGate>
      </OpsAuthProvider>,
    );
    await waitFor(() => expect(screen.getByText(/inte tillgång/)).toBeInTheDocument());
    expect(screen.queryByText("hemligt")).not.toBeInTheDocument();
  });

  // ⛔ Ett fel i profiluppslagningen får aldrig ge MER behörighet än en som
  // lyckades. Den som inte går att slå upp loggas in utan roll.
  it("ger ingen roll när profiluppslagningen misslyckas", async () => {
    const sdk = {
      GoogleAuthProvider: class {},
      signInWithPopup: async () => {},
      signOut: async () => {},
      onAuthStateChanged: (_a, cb) => {
        cb({ uid: "u1", email: "a@b.se" });
        return () => {};
      },
    };
    const authentication = createGoogleAuth({
      auth: {},
      sdk,
      fetchProfile: async () => {
        throw new Error("nätverket nere");
      },
    });

    render(
      <OpsAuthProvider authentication={authentication}>
        <OpsAuthGate allowedRoles={["admin"]}>
          <p>hemligt</p>
        </OpsAuthGate>
      </OpsAuthProvider>,
    );
    await waitFor(() => expect(screen.getByText(/inte tillgång/)).toBeInTheDocument());
  });

  // ══ #159: felmottagare.satt vid inloggning ══════════════════════════════
  describe("#159: felmottagare.satt", () => {
    it("kallas med uid när någon loggar in", async () => {
      const satt = vi.fn();
      render(
        <OpsAuthProvider authentication={fakeAuth({ id: "u1" })} felmottagare={{ fanga: vi.fn(), satt }}>
          <p>klar</p>
        </OpsAuthProvider>,
      );
      await waitFor(() => expect(satt).toHaveBeenCalledWith({ uid: "u1", groupId: undefined }));
    });

    it("kallas med null vid utloggning", async () => {
      const satt = vi.fn();
      render(
        <OpsAuthProvider authentication={fakeAuth(null)} felmottagare={{ fanga: vi.fn(), satt }}>
          <p>klar</p>
        </OpsAuthProvider>,
      );
      await waitFor(() => expect(satt).toHaveBeenCalledWith(null));
    });

    it("⛔ e-posten skickas ALDRIG med, bara uid och groupId", async () => {
      const satt = vi.fn();
      const authentication = createAuth({
        signIn: async () => {},
        signOut: async () => {},
        subscribe: (l) => {
          l(/** @type {any} */ ({ id: "u1", email: "cp@staiger.se", groupId: "bolaget" }));
          return () => {};
        },
      });
      render(
        <OpsAuthProvider authentication={authentication} felmottagare={{ fanga: vi.fn(), satt }}>
          <p>klar</p>
        </OpsAuthProvider>,
      );
      await waitFor(() => expect(satt).toHaveBeenCalledWith({ uid: "u1", groupId: "bolaget" }));
      expect(satt.mock.calls[0][0]).not.toHaveProperty("email");
    });

    it("utan felmottagare kastar ingenting", async () => {
      render(
        <OpsAuthProvider authentication={fakeAuth({ id: "u1" })}>
          <p>klar</p>
        </OpsAuthProvider>,
      );
      await waitFor(() => expect(screen.getByText("klar")).toBeInTheDocument());
    });
  });
});
