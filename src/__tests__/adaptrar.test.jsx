import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { skapaFirestoreKalla } from "../data/firestore.js";
import { skapaPostgresKalla } from "../data/postgres.js";
import { OpsAuthGate, OpsAuthProvider, skapaAutentisering, skapaGoogleAuth } from "../auth/auth.jsx";

/**
 * ⛔ Adaptrarna testas mot en INJICERAD attrapp, inte mot en riktig databas.
 *
 * Det är inte en genväg, det är hela poängen med att ramverket inte importerar
 * någon SDK: översättningen från CRUD till anrop går att prova utan att någon
 * behöver en Firestore-instans eller en Postgres igång. Det som INTE testas här
 * är att den riktiga databasen beter sig som attrappen, och det ska provas mot
 * en emulator i appen.
 */

function fejkFirestore() {
  const anrop = [];
  const sdk = {
    collection: (_db, s) => ({ __samling: s }),
    doc: (_db, s, id) => ({ __samling: s, __id: id }),
    getDoc: vi.fn(async (ref) => ({ exists: () => ref.__id !== "saknas", id: ref.__id, data: () => ({ namn: "Telia" }) })),
    getDocs: vi.fn(async () => ({ docs: [{ id: "1", data: () => ({ namn: "Telia" }) }] })),
    addDoc: vi.fn(async () => ({ id: "nytt" })),
    setDoc: vi.fn(async () => {}),
    updateDoc: vi.fn(async () => {}),
    deleteDoc: vi.fn(async () => {}),
    query: (bas, ...villkor) => ({ bas, villkor }),
    where: (f, op, v) => ({ typ: "where", f, op, v }),
    orderBy: (f, r) => ({ typ: "orderBy", f, r }),
    limit: (n) => ({ typ: "limit", n }),
    // ⛔ Tillagd när adaptern fick `prenumerera` (#133). Den hör hit och inte i
    // en uppmjukning av uppstartskontrollen: adaptern LOVAR att kunna
    // prenumerera, alltså behöver den funktionen. Att i stället ta bort
    // `onSnapshot` ur kraven hade gjort testet grönt genom att ta bort kravet
    // det testar. Prenumerationens eget beteende provas i realtid.test.jsx.
    onSnapshot: vi.fn(() => () => {}),
  };
  return { sdk, anrop };
}

describe("firestore-adaptern", () => {
  it("vägrar en ofullständig sdk vid uppstart, inte vid första anropet", () => {
    expect(() => skapaFirestoreKalla({ db: {}, sdk: { collection: () => {} } })).toThrow(/sdk saknar/);
  });

  it("skiljer ett dokument som saknas från ett som är tomt", async () => {
    const { sdk } = fejkFirestore();
    const kalla = skapaFirestoreKalla({ db: {}, sdk });
    expect(await kalla.las("kostnader", "saknas")).toBeNull();
    expect(await kalla.las("kostnader", "1")).toMatchObject({ id: "1", namn: "Telia" });
  });

  it("översätter en fråga till where, orderBy och limit", async () => {
    const { sdk } = fejkFirestore();
    const kalla = skapaFirestoreKalla({ db: {}, sdk });
    await kalla.lista("kostnader", { dar: { status: "oppen" }, sortera: "belopp", riktning: "ner", antal: 5 });

    const skickat = sdk.getDocs.mock.calls[0][0];
    expect(skickat.villkor).toEqual([
      { typ: "where", f: "status", op: "==", v: "oppen" },
      { typ: "orderBy", f: "belopp", r: "desc" },
      { typ: "limit", n: 5 },
    ]);
  });

  // ⛔ setDoc skriver över utan att säga ifrån. Skillnaden mot addDoc måste
  // styras av om anroparen gav ett id, inte av slump.
  it("använder addDoc utan id och setDoc med id", async () => {
    const { sdk } = fejkFirestore();
    const kalla = skapaFirestoreKalla({ db: {}, sdk });

    expect(await kalla.skapa("k", { namn: "A" })).toMatchObject({ id: "nytt" });
    expect(sdk.addDoc).toHaveBeenCalledOnce();

    expect(await kalla.skapa("k", { id: "eget", namn: "B" })).toMatchObject({ id: "eget" });
    expect(sdk.setDoc).toHaveBeenCalledOnce();
  });

  // ⛔ Läser tillbaka i stället för att gissa: servertidsstämplar och regler kan
  // ändra värdet, och då stämmer inte appens objekt med databasen.
  it("läser tillbaka efter uppdatering", async () => {
    const { sdk } = fejkFirestore();
    const kalla = skapaFirestoreKalla({ db: {}, sdk });
    await kalla.uppdatera("k", "1", { namn: "Nytt" });
    expect(sdk.getDoc).toHaveBeenCalled();
  });
});

describe("postgres-adaptern", () => {
  const spion = () => vi.fn(async () => [{ id: "1", namn: "Telia" }]);

  // ⛔ SÄKERHETSKRITISKT. Tabell- och kolumnnamn kan inte skickas som
  // parametrar, så de hamnar i SQL-texten. Ett namn som slipper igenom är en
  // väg in för injektion, och en injektion som fungerar syns inte i något test
  // som inte letar efter den.
  it("vägrar tabellnamn som inte är rena identifierare", async () => {
    const kalla = skapaPostgresKalla({ fraga: spion() });
    await expect(kalla.lista('kostnader"; DROP TABLE users; --')).rejects.toThrow(/duger inte som tabell/);
    await expect(kalla.lista("kostnader", { dar: { "a; DELETE FROM x": 1 } })).rejects.toThrow(/duger inte som tabell/);
    await expect(kalla.lista("kostnader", { sortera: "1 OR 1=1" })).rejects.toThrow(/duger inte som tabell/);
  });

  it("skickar värden som parametrar, aldrig som text", async () => {
    const fraga = spion();
    const kalla = skapaPostgresKalla({ fraga });
    await kalla.lista("kostnader", { dar: { status: "oppen" }, antal: 10 });

    const [sql, params] = fraga.mock.calls[0];
    expect(sql).toBe('SELECT * FROM "kostnader" WHERE "status" = $1 LIMIT $2');
    expect(params).toEqual(["oppen", 10]);
    expect(sql).not.toContain("oppen");
  });

  it("använder RETURNING i stället för att gissa resultatet", async () => {
    const fraga = spion();
    const kalla = skapaPostgresKalla({ fraga });
    await kalla.skapa("kostnader", { namn: "Telia" });
    expect(fraga.mock.calls[0][0]).toContain("RETURNING *");
  });

  // ⛔ Noll rader betyder att posten inte fanns. Att returnera undefined hade
  // låtit anropsstället tro att uppdateringen lyckades.
  it("kastar när ingen rad träffades", async () => {
    const kalla = skapaPostgresKalla({ fraga: vi.fn(async () => []) });
    await expect(kalla.uppdatera("k", "1", { namn: "x" })).rejects.toThrow(/Ingen rad uppdaterades/);
    await expect(kalla.taBort("k", "1")).rejects.toThrow(/Ingen rad togs bort/);
  });
});

describe("inloggning", () => {
  /** @param {{ id: string, roll?: string } | null} anvandare */
  function fejkAuth(anvandare) {
    return skapaAutentisering({
      loggaIn: async () => {},
      loggaUt: async () => {},
      lyssna: (l) => {
        l(anvandare);
        return () => {};
      },
    });
  }

  it("visar inloggning när ingen är inloggad", async () => {
    render(
      <OpsAuthProvider autentisering={fejkAuth(null)}>
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
      <OpsAuthProvider autentisering={fejkAuth({ id: "u1" })}>
        <OpsAuthGate>
          <p>hemligt</p>
        </OpsAuthGate>
      </OpsAuthProvider>,
    );
    await waitFor(() => expect(screen.getByText("hemligt")).toBeInTheDocument());
  });

  it("nekar den som är inloggad men saknar rollen", async () => {
    render(
      <OpsAuthProvider autentisering={fejkAuth({ id: "u1", roll: "lasare" })}>
        <OpsAuthGate tillatnaRoller={["admin"]}>
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
    const autentisering = skapaGoogleAuth({
      auth: {},
      sdk,
      hamtaProfil: async () => {
        throw new Error("nätverket nere");
      },
    });

    render(
      <OpsAuthProvider autentisering={autentisering}>
        <OpsAuthGate tillatnaRoller={["admin"]}>
          <p>hemligt</p>
        </OpsAuthGate>
      </OpsAuthProvider>,
    );
    await waitFor(() => expect(screen.getByText(/inte tillgång/)).toBeInTheDocument());
  });
});
