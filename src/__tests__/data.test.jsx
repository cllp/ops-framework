import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createDataSource, applyQuery } from "../data/contract.js";
import { createJsonSource, createMemorySource } from "../data/adapters.js";
import { OpsDataProvider, useCollection } from "../data/useData.jsx";

describe("datakontraktet", () => {
  // ⛔ En halv adapter kraschar annars först den dag någon anropar just den
  // metoden, och felet pekar då mot anropsstället i stället för mot adaptern.
  it("vägrar en adapter som saknar en operation", () => {
    expect(() => createDataSource({ name: "halv", read: async () => null })).toThrow(/saknar list, create, update, remove/);
  });

  it("vägrar något som inte är en adapter alls", () => {
    expect(() => createDataSource(/** @type {any} */ (null))).toThrow(/adapter krävs/);
  });
});

describe("frågor", () => {
  const rows = [
    { id: "1", name: "Telia", belopp: 449, status: "oppen" },
    { id: "2", name: "Fortnox", belopp: 399, status: "stangd" },
    { id: "3", name: "Ahlsell", belopp: 1200, status: "oppen" },
  ];

  it("filtrerar, sorterar och begränsar", () => {
    const out = applyQuery(rows, { where: { status: "oppen" }, sortBy: "belopp", direction: "desc" });
    expect(out.map((r) => r.id)).toEqual(["3", "1"]);
    expect(applyQuery(rows, { limit: 2 })).toHaveLength(2);
  });

  // 0.132.0 (gäster, skiva 3): ett punktat fältnamn går in i en karta, som Firestores fältsökvägar. En rad utan kartan stämmer inte men kastar inte, och ett fält som heter som sökvägen rakt av går före.
  it("där med ett punktat fältnamn träffar rader vars karta har värdet, och saknad karta är ingen träff och inget fel", () => {
    const poster = [
      { id: "1", groupId: "g", mottagare: { slag: "gast", gastId: "g_a" } },
      { id: "2", groupId: "g", mottagare: { slag: "gast", gastId: "g_b" } },
      { id: "3", groupId: "g", mottagare: { slag: "person", uid: "u" } },
      { id: "4", groupId: "g" },
      { id: "5", groupId: "g", mottagare: null },
      { id: "6", groupId: "g", mottagare: ["g_a"] },
      { id: "7", groupId: "andra", mottagare: { slag: "gast", gastId: "g_a" } },
      { id: "8", groupId: "g", "mottagare.gastId": "g_a" },
    ];
    expect(applyQuery(poster, { where: { groupId: "g", "mottagare.gastId": "g_a" } }).map((r) => r.id)).toEqual(["1", "8"]);
    expect(applyQuery(poster, { where: { "mottagare.slag": "person" } }).map((r) => r.id)).toEqual(["3"]);
    expect(applyQuery(poster, { where: { "mottagare.gastId": "g_zzz" } })).toEqual([]);
    expect(applyQuery(poster, { where: { "mottagare.gastId.mer": "g_a" } })).toEqual([]);
    // Utan punkt är det som förut.
    expect(applyQuery(poster, { where: { groupId: "andra" } }).map((r) => r.id)).toEqual(["7"]);
  });

  // ⛔ Array.sort muterar. En adapter som sorterade om sin egen lagring hade
  // tyst ändrat ordningen för nästa läsare.
  it("muterar inte listan den fick", () => {
    const original = [...rows];
    applyQuery(rows, { sortBy: "namn" });
    expect(rows).toEqual(original);
  });
});

describe("minneskällan", () => {
  // ⛔ Kontraktet får inte avslöja att just den här källan är snabb. Ett
  // synkront API hade tvingat fram en omskrivning av varje anropsställe den dag
  // källan blev ett nätverksanrop.
  it("är asynkron även om inget väntar", () => {
    const source = createMemorySource();
    expect(source.list("x")).toBeInstanceOf(Promise);
  });

  it("skapar med id, läser tillbaka och uppdaterar", async () => {
    const source = createMemorySource();
    const entry = await source.create("kostnader", { name: "Telia", belopp: 449 });
    expect(entry.id).toBeTruthy();

    expect(await source.read("kostnader", entry.id)).toMatchObject({ name: "Telia" });

    const updatedAt = await source.update("kostnader", entry.id, { belopp: 500 });
    expect(updatedAt).toMatchObject({ id: entry.id, name: "Telia", belopp: 500 });
  });

  // ⛔ "Finns inte" är inte ett fel. Skillnaden mot "kunde inte fråga" måste gå
  // att hantera olika, annars går den inte att hantera alls.
  it("ger null för en post som inte finns, inte ett fel", async () => {
    const source = createMemorySource();
    await expect(source.read("kostnader", "saknas")).resolves.toBeNull();
  });

  it("kastar när något uppdateras som inte finns, i stället för att skapa det tyst", async () => {
    const source = createMemorySource();
    await expect(source.update("kostnader", "saknas", { belopp: 1 })).rejects.toThrow(/finns inte/);
  });

  it("lämnar inte ut sin interna lagring", async () => {
    const source = createMemorySource({ kostnader: [{ id: "1", belopp: 100 }] });
    const rows = await source.list("kostnader");
    rows[0].belopp = 999;
    expect((await source.list("kostnader"))[0].belopp).toBe(100);
  });
});

describe("json-källan", () => {
  /** @param {any} data @param {number} status */
  const answer = (data, status = 200) =>
    vi.fn(async () => /** @type {any} */ ({ ok: status >= 200 && status < 300, status, json: async () => data }));

  it("läser en samling ur en fil", async () => {
    const load = answer([{ id: "1", name: "Telia" }]);
    const source = createJsonSource({ base: "/assets/data", load });
    expect(await source.list("kostnader")).toHaveLength(1);
    expect(load).toHaveBeenCalledWith("/assets/data/kostnader.json");
  });

  // ⛔ fetch kastar INTE på 404 eller 500. Utan kontrollen blir ett serverfel en
  // tom lista, och appen visar "inga träffar" när sanningen är att den inte
  // kunde fråga.
  it("gör ett serverfel till ett fel, inte till en tom lista", async () => {
    const source = createJsonSource({ base: "/d", load: answer(null, 500) });
    await expect(source.list("kostnader")).rejects.toThrow(/svarade 500/);
  });

  it("vägrar en fil som inte innehåller en lista", async () => {
    const source = createJsonSource({ base: "/d", load: answer({ inte: "en lista" }) });
    await expect(source.list("kostnader")).rejects.toThrow(/inte en lista/);
  });

  // ⛔ En skrivning som ser ut att lyckas men försvinner vid omladdning är värre
  // än ett tydligt nej.
  it("nekar skrivningar i stället för att låtsas", async () => {
    const source = createJsonSource({ base: "/d", load: answer([]) });
    await expect(source.create("kostnader", {})).rejects.toThrow(/Byt datakälla/);
  });
});

describe("useCollection", () => {
  /** @param {{ collectionName?: string }} props */
  function Prov({ collectionName = "kostnader" }) {
    const { data, loading, error } = useCollection(collectionName);
    if (loading) return <p>loading</p>;
    if (error) return <p>error: {error.message}</p>;
    return <p>rows: {data.length}</p>;
  }

  it("visar laddar först och data sedan", async () => {
    const source = createMemorySource({ kostnader: [{ id: "1" }, { id: "2" }] });
    render(
      <OpsDataProvider source={source}>
        <Prov />
      </OpsDataProvider>,
    );
    expect(screen.getByText("loading")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("rows: 2")).toBeInTheDocument());
  });

  // ⛔ Ett fel får aldrig se ut som tomhet. Att visa "0 rader" när servern
  // svarade 500 får användaren att dra en slutsats om sin data som inte stämmer.
  it("skiljer ett fel från en tom lista", async () => {
    const trasig = createJsonSource({ base: "/d", load: vi.fn(async () => /** @type {any} */ ({ ok: false, status: 500 })) });
    render(
      <OpsDataProvider source={trasig}>
        <Prov />
      </OpsDataProvider>,
    );
    await waitFor(() => expect(screen.getByText(/error: .*svarade 500/)).toBeInTheDocument());
    expect(screen.queryByText("rows: 0")).not.toBeInTheDocument();
  });

  it("kräver en provider i stället för att tyst ge noll rader", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<Prov />)).toThrow(/ingen OpsDataProvider/);
    } finally {
      tyst.mockRestore();
    }
  });
});
