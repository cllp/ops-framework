import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { createDataSource } from "../data/contract.js";
import { createMemorySource } from "../data/adapters.js";
import { createFirestoreSource } from "../data/firestore.js";
import { OpsDataProvider, useLiveCollection } from "../data/useData.jsx";

/**
 * Realtid, bevisad utan Firestore.
 *
 * ⛔ TESTERNA KÖR MOT EN EGEN STRÖMMANDE KÄLLA och inte mot en mockad
 * Firestore-SDK. Skälet är att det som ska bevisas är HOOKENS beteende: att den
 * frågar källan om den kan strömma, att den städar upp efter sig, att ett fel
 * inte tömmer listan. En mock av SDK:n hade bevisat att vi kan skriva en mock.
 *
 * Adaptern testas separat, längst ned, och där är frågan en annan: att
 * `onSnapshot` faktiskt kopplas in och att felkanalen går till `onError`.
 */

/**
 * En minneskälla som också kan prenumerera.
 *
 * `skicka()` är testets hand: den simulerar att servern levererar ett nytt
 * urval. `errorа()` simulerar en avvisning.
 */
function strommandeKalla() {
  const lyssnare = new Set();
  let avslutade = 0;

  const bas = createMemorySource();

  return {
    source: createDataSource({
      ...bas,
      name: "strommande-minne",
      subscribe(_samling, _fraga, l) {
        lyssnare.add(l);
        return () => {
          avslutade += 1;
          lyssnare.delete(l);
        };
      },
    }),
    skicka: (rows) => act(() => lyssnare.forEach((l) => l.onData(rows))),
    fela: (e) => act(() => lyssnare.forEach((l) => l.onError(e))),
    antalLyssnare: () => lyssnare.size,
    antalAvslutade: () => avslutade,
  };
}

/** @param {{ collectionName?: string, query?: any }} props */
function Lista({ collectionName = "inkorg", query }) {
  const { data, loading, error, update, realtime } = useLiveCollection(collectionName, query);
  return (
    <div>
      <p data-testid="lage">{loading ? "laddar" : "klar"}</p>
      <p data-testid="realtid">{realtime ? "ja" : "nej"}</p>
      <p data-testid="fel">{error ? error.message : "-"}</p>
      <ul>
        {data.map((r) => (
          <li key={r.id}>{r.title}</li>
        ))}
      </ul>
      <button type="button" onClick={update}>
        Uppdatera
      </button>
    </div>
  );
}

describe("useLiveCollection mot en källa som kan strömma", () => {
  it("visar det källan skickar, utan omladdning", async () => {
    const s = strommandeKalla();
    render(
      <OpsDataProvider source={s.source}>
        <Lista />
      </OpsDataProvider>,
    );

    expect(screen.getByTestId("lage")).toHaveTextContent("laddar");

    s.skicka([{ id: "1", title: "Riksbyggen höjde avgiften" }]);
    await waitFor(() => expect(screen.getByText("Riksbyggen höjde avgiften")).toBeInTheDocument());
    expect(screen.getByTestId("lage")).toHaveTextContent("klar");
    expect(screen.getByTestId("realtid")).toHaveTextContent("ja");

    // ⛔ Det här är hela poängen med #133: en post till dyker upp utan att
    // någonting i vyn frågat efter den.
    s.skicka([
      { id: "1", title: "Riksbyggen höjde avgiften" },
      { id: "2", title: "Säg upp Canva" },
    ]);
    await waitFor(() => expect(screen.getByText("Säg upp Canva")).toBeInTheDocument());
  });

  it("speglar en ändring på en post, inte bara nya rader", async () => {
    // Agenten sätter status hanterad via Admin SDK. Kortet ska ändra sig.
    const s = strommandeKalla();
    render(
      <OpsDataProvider source={s.source}>
        <Lista />
      </OpsDataProvider>,
    );

    s.skicka([{ id: "1", title: "Ny" }]);
    await waitFor(() => expect(screen.getByText("Ny")).toBeInTheDocument());

    s.skicka([{ id: "1", title: "Hanterad" }]);
    await waitFor(() => expect(screen.getByText("Hanterad")).toBeInTheDocument());
    expect(screen.queryByText("Ny")).not.toBeInTheDocument();
  });

  it("tömmer INTE listan när prenumerationen avvisas", async () => {
    // ⛔ Samma regel som i useCollection, och den som spelar störst roll i praktiken:
    // permission-denied är exakt vad Firestore svarar när reglerna för samlingen
    // saknas. En tömd lista hade sagt "inkorgen är tom" till någon vars inkorg
    // är full.
    const s = strommandeKalla();
    render(
      <OpsDataProvider source={s.source}>
        <Lista />
      </OpsDataProvider>,
    );

    s.skicka([{ id: "1", title: "Kvar" }]);
    await waitFor(() => expect(screen.getByText("Kvar")).toBeInTheDocument());

    s.fela(new Error("Missing or insufficient permissions."));
    await waitFor(() => expect(screen.getByTestId("fel")).toHaveTextContent("Missing or insufficient permissions."));
    expect(screen.getByText("Kvar")).toBeInTheDocument();
    expect(screen.getByTestId("lage")).toHaveTextContent("klar");
  });

  it("släcker felet när data kommer fram igen", async () => {
    const s = strommandeKalla();
    render(
      <OpsDataProvider source={s.source}>
        <Lista />
      </OpsDataProvider>,
    );

    s.fela(new Error("tappade kontakten"));
    await waitFor(() => expect(screen.getByTestId("fel")).toHaveTextContent("tappade kontakten"));

    s.skicka([{ id: "1", title: "Tillbaka" }]);
    await waitFor(() => expect(screen.getByTestId("fel")).toHaveTextContent("-"));
  });

  it("stänger lyssnaren när vyn stängs", async () => {
    // ⛔ En lyssnare som lever vidare syns inte i UI:t. Den syns i notan, och
    // till slut i minnet, och då är orsaken långt borta.
    const s = strommandeKalla();
    const { unmount } = render(
      <OpsDataProvider source={s.source}>
        <Lista />
      </OpsDataProvider>,
    );

    await waitFor(() => expect(s.antalLyssnare()).toBe(1));
    unmount();
    expect(s.antalLyssnare()).toBe(0);
    expect(s.antalAvslutade()).toBe(1);
  });

  it("startar om prenumerationen vid uppdatera, i stället för att hämta vid sidan av", async () => {
    // ⛔ Efter ett avvisat lyssnande återansluter Firestore inte själv. En
    // engångshämtning hade gett en bild som genast slutar uppdateras igen,
    // alltså sett ut som att felet gick över.
    const s = strommandeKalla();
    render(
      <OpsDataProvider source={s.source}>
        <Lista />
      </OpsDataProvider>,
    );

    await waitFor(() => expect(s.antalLyssnare()).toBe(1));
    act(() => screen.getByRole("button", { name: "Uppdatera" }).click());

    await waitFor(() => expect(s.antalAvslutade()).toBe(1));
    expect(s.antalLyssnare()).toBe(1);
  });

  it("byter prenumeration när frågan ändras, och bara då", async () => {
    const s = strommandeKalla();
    const { rerender } = render(
      <OpsDataProvider source={s.source}>
        <Lista query={{ where: { status: "ny" } }} />
      </OpsDataProvider>,
    );
    await waitFor(() => expect(s.antalLyssnare()).toBe(1));

    // ⛔ Nytt objekt, samma innehåll. Utan innehållsjämförelsen i hooken hade
    // varje rendering rivit och satt upp en ny lyssnare mot servern.
    rerender(
      <OpsDataProvider source={s.source}>
        <Lista query={{ where: { status: "ny" } }} />
      </OpsDataProvider>,
    );
    expect(s.antalAvslutade()).toBe(0);

    rerender(
      <OpsDataProvider source={s.source}>
        <Lista query={{ where: { status: "hanterad" } }} />
      </OpsDataProvider>,
    );
    await waitFor(() => expect(s.antalAvslutade()).toBe(1));
  });
});

describe("useLiveCollection mot en källa som inte kan strömma", () => {
  it("hämtar en gång och SÄGER att det inte är realtid", async () => {
    // ⛔ Det tysta alternativet hade varit att falla tillbaka utan att säga
    // något. Då ser en app som tror sig strömma exakt likadan ut som en som gör
    // det, ända tills någon undrar varför en post aldrig dök upp.
    const source = createMemorySource({ inkorg: [{ id: "1", title: "Från minnet" }] });
    render(
      <OpsDataProvider source={source}>
        <Lista />
      </OpsDataProvider>,
    );

    await waitFor(() => expect(screen.getByText("Från minnet")).toBeInTheDocument());
    expect(screen.getByTestId("realtid")).toHaveTextContent("nej");
    expect(screen.getByTestId("fel")).toHaveTextContent("-");
  });

  it("kastar inte, utan visar felet, när hämtningen misslyckas", async () => {
    const trasig = createDataSource({
      name: "trasig",
      read: async () => null,
      list: async () => {
        throw new Error("servern svarade 500");
      },
      create: async (_s, d) => /** @type {any} */ (d),
      update: async (_s, _i, d) => /** @type {any} */ (d),
      remove: async () => {},
    });

    render(
      <OpsDataProvider source={trasig}>
        <Lista />
      </OpsDataProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("fel")).toHaveTextContent("servern svarade 500"));
    expect(screen.getByTestId("lage")).toHaveTextContent("klar");
  });
});

describe("Firestore-adapterns prenumeration", () => {
  /** Minsta SDK som tar sig förbi uppstartskontrollen. */
  function sdk(extra = {}) {
    const stub = () => ({});
    return {
      collection: stub,
      doc: stub,
      getDoc: async () => ({ exists: () => false }),
      getDocs: async () => ({ docs: [] }),
      addDoc: async () => ({ id: "x" }),
      setDoc: async () => {},
      updateDoc: async () => {},
      deleteDoc: async () => {},
      query: (...a) => ({ conditions: a.slice(1) }),
      where: (f, _op, v) => ({ where: [f, v] }),
      orderBy: (f, r) => ({ sortBy: [f, r] }),
      limit: (n) => ({ limit: n }),
      onSnapshot: () => () => {},
      ...extra,
    };
  }

  it("kräver onSnapshot vid uppstart, inte vid första anropet", () => {
    const utan = sdk();
    delete utan.onSnapshot;
    // ⛔ Felet ska peka mot uppkopplingen, inte mot vyn som råkade vara först
    // att vilja strömma.
    expect(() => createFirestoreSource({ db: {}, sdk: utan })).toThrow(/saknar onSnapshot/);
  });

  it("kopplar snapshotens dokument till vidData", () => {
    let snapshotHandler;
    const source = createFirestoreSource({
      db: {},
      sdk: sdk({
        onSnapshot: (_q, pa) => {
          snapshotHandler = pa;
          return () => {};
        },
      }),
    });

    const rows = [];
    source.subscribe("inkorg", undefined, { onData: (r) => rows.push(...r), onError: () => {} });
    snapshotHandler({ docs: [{ id: "a", data: () => ({ title: "Hej" }) }] });

    expect(rows).toEqual([{ id: "a", title: "Hej" }]);
  });

  it("skickar felet till vidFel, aldrig som en tom lista", () => {
    let felHandler;
    const source = createFirestoreSource({
      db: {},
      sdk: sdk({
        onSnapshot: (_q, _pa, onError) => {
          felHandler = onError;
          return () => {};
        },
      }),
    });

    const onData = vi.fn();
    const error = [];
    source.subscribe("inkorg", undefined, { onData, onError: (e) => error.push(e) });
    felHandler(new Error("Missing or insufficient permissions."));

    expect(onData).not.toHaveBeenCalled();
    expect(error[0].message).toMatch(/insufficient permissions/);
  });

  it("översätter frågan likadant som lista gör", () => {
    // ⛔ En hämtning och en prenumeration på samma samling måste ge samma urval.
    // Stod översättningen på två ställen skulle de kunna glida isär, och den
    // skillnaden syns inte: båda returnerar rader, bara inte samma.
    let fragan;
    const source = createFirestoreSource({
      db: {},
      sdk: sdk({
        onSnapshot: (q) => {
          fragan = q;
          return () => {};
        },
      }),
    });

    source.subscribe("inkorg", { where: { status: "ny" }, sortBy: "skapad", direction: "desc", limit: 10 }, {
      onData: () => {},
      onError: () => {},
    });

    expect(fragan.conditions).toEqual([{ where: ["status", "ny"] }, { sortBy: ["skapad", "desc"] }, { limit: 10 }]);
  });

  it("returnerar funktionen som stänger lyssnandet", () => {
    const avsluta = vi.fn();
    const source = createFirestoreSource({ db: {}, sdk: sdk({ onSnapshot: () => avsluta }) });
    const ut = source.subscribe("inkorg", undefined, { onData: () => {}, onError: () => {} });
    ut();
    expect(avsluta).toHaveBeenCalled();
  });
});
